import { and, asc, eq, gt, inArray } from 'drizzle-orm';
import { comoNextActions, comoNextEmailMessages } from '../../drizzle/schema';
import { getDb } from '../db';
import { changeActionStatusCommand } from './comoNextCommands';
import { linkEmailToWorkFileCommand } from './comoNextEmailInbox';

const nowSql = () => new Date().toISOString().slice(0,19).replace('T',' ');

/** The watch is deliberately an internal decision point, never an outbound reminder. */
export function comparableReplySubject(value: string) {
  return value.toLowerCase().replace(/^\s*(?:(?:re|fw|fwd)\s*:\s*)+/i,'')
    .replace(/[\u2010-\u2015\-]+/g,' ').replace(/\s+/g,' ').trim();
}
export function isRelevantWatchReply(input: {
  sentTo: string | null; sentSubject: string; sentAt: string;
  receivedFrom: string; receivedSubject: string; receivedAt: string; receivedBody: string;
}) {
  const recipient = (input.sentTo || '').match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/ig)?.map(x=>x.toLowerCase()) || [];
  if (recipient.length !== 1 || recipient[0] !== input.receivedFrom.toLowerCase()) return false;
  if (new Date(input.receivedAt.replace(' ','T')+'Z').getTime() <= new Date(input.sentAt.replace(' ','T')+'Z').getTime()) return false;
  if (/^\s*(automatic reply|out of office|auto:|undeliverable|delivery status)/i.test(input.receivedSubject)) return false;
  const original=comparableReplySubject(input.sentSubject);
  if (original.length < 20 || comparableReplySubject(input.receivedSubject)!==original) return false;
  const body=input.receivedBody.split(/(?:^|\n)\s*(?:From:|-----Original Message-----|On .+ wrote:)/i,1)[0].trim();
  return body.length > 2;
}

/** Query fetches 501 rows; 501 means the search was truncated, not no reply. */
export function completedConditionalReplySearch(candidateCount: number) {
  return candidateCount <= 500;
}

/**
 * Runs only after the read-only INBOX import, with strict sender/subject/time matching.
 * Leaves non-matching, ambiguous or auto-generated replies for manual review. It never
 * prepares a Draft, sends, schedules a message, or treats silence as authority to send.
 */
export async function reconcileConditionalSentWatches(input: {userId:number; limit?:number; now?:string}) {
  const db=await getDb();if(!db) throw new Error('database_unavailable');
  const now=input.now || nowSql();
  const watches=await db.select().from(comoNextActions).where(and(
    eq(comoNextActions.userId,input.userId),eq(comoNextActions.ownerType,'manus'),
    eq(comoNextActions.sourceSystem,'conditional_sent_watch'),
    inArray(comoNextActions.actionStatus,['open','waiting_external'])
  )).orderBy(asc(comoNextActions.attentionAt),asc(comoNextActions.id)).limit(Math.min(Math.max(input.limit||8,1),20));
  let resolved=0, matured=0;
  const skipped: number[]=[];
  for(const watch of watches){
    const match=/^sent-email-(\d+)$/.exec(watch.sourceRecordId||'');
    if(!match){skipped.push(watch.id);continue;}
    const [sent]=await db.select().from(comoNextEmailMessages).where(and(
      eq(comoNextEmailMessages.id,Number(match[1])),eq(comoNextEmailMessages.userId,input.userId),
      eq(comoNextEmailMessages.folderName,'Sent'),eq(comoNextEmailMessages.linkedWorkFileId,watch.workFileId)
    )).limit(1);
    if(!sent){skipped.push(watch.id);continue;}
    const recipientAddresses=(sent.toText||'').match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/ig)?.map(s=>s.toLowerCase())||[];
    if(recipientAddresses.length!==1){skipped.push(watch.id);continue;}
    const candidates=await db.select().from(comoNextEmailMessages).where(and(
      eq(comoNextEmailMessages.userId,input.userId),eq(comoNextEmailMessages.folderName,'INBOX'),
      gt(comoNextEmailMessages.receivedAt,sent.receivedAt),
      eq(comoNextEmailMessages.fromEmail,recipientAddresses[0]),
    )).orderBy(asc(comoNextEmailMessages.receivedAt)).limit(501);
    const replies=candidates.slice(0,500).filter(item=>isRelevantWatchReply({
      sentTo:sent.toText,sentSubject:sent.subject,sentAt:sent.receivedAt,
      receivedFrom:item.fromEmail,receivedSubject:item.subject,receivedAt:item.receivedAt,receivedBody:item.bodyText,
    }));
    // One sender can reply more than once; resolve against the earliest qualifying answer.
    if(replies.length){
      const reply=replies[0];
      if(reply.linkedWorkFileId && reply.linkedWorkFileId!==watch.workFileId){skipped.push(watch.id);continue;}
      if(!reply.linkedWorkFileId) await linkEmailToWorkFileCommand({userId:input.userId,emailId:Number(reply.id),projectId:watch.projectId,workFileId:watch.workFileId,suppressReplyDraft:true});
      const [latest]=await db.select({actionStatus:comoNextActions.actionStatus}).from(comoNextActions).where(eq(comoNextActions.id,watch.id)).limit(1);
      if(latest && ['open','waiting_external'].includes(latest.actionStatus)) {
        await changeActionStatusCommand({userId:input.userId,actionId:watch.id,nextStatus:'cancelled',actorType:'system'});
      }
      resolved++;
      continue;
    }
    // When the bounded search is saturated, absence of a reply is unproven.
    // Keep the watch waiting for manual reconciliation rather than maturing it.
    if(!completedConditionalReplySearch(candidates.length)){skipped.push(watch.id);continue;}
    if(watch.actionStatus==='waiting_external' && watch.attentionAt && watch.attentionAt<=now){
      await changeActionStatusCommand({userId:input.userId,actionId:watch.id,nextStatus:'open',actorType:'system'});
      matured++;
    }
  }
  return {examined:watches.length,resolved,matured,skipped,externalSideEffects:false as const};
}
