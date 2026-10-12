import fs from 'node:fs';
import {fetchReadonlyFolderSince} from '../server/emailMonitor';
import {getDb} from '../server/db';
import {sql} from 'drizzle-orm';
const rows=(v:any):any[]=>Array.isArray(v)&&Array.isArray(v[0])?v[0]:v;
async function main(){
 console.log('قراءة المسودات والصادر من صندوق COMO فقط.');
 const [drafts,sent]=await Promise.all([fetchReadonlyFolderSince('Drafts',24*10,500),fetchReadonlyFolderSince('Sent',24*6,300)]);
 const db=await getDb();if(!db)throw Error('database_unavailable');
 const saved=rows(await db.execute(sql`SELECT c.id,c.work_file_id,c.subject,c.to_text,c.body,c.source_record_id,c.external_message_ref,c.review_note,l.message_id AS draft_message_id,l.draft_key,l.state FROM como_next_communications c LEFT JOIN como_mailbox_draft_ledger l ON l.communication_id=c.id WHERE c.user_id=1 AND c.direction='outbound' AND c.external_message_ref LIKE 'Drafts UID %' ORDER BY c.id DESC LIMIT 60`));
 const observations=saved.map(c=>{
  const uid=Number(c.external_message_ref.match(/UID\s+(\d+)/)?.[1]||0);
  const draft=drafts.messages.find(m=>Number(m.uid)===uid||Boolean(c.draft_message_id&&m.messageId===c.draft_message_id));
  const normalized=(s:string)=>String(s||'').replace(/^(re|fw|fwd)\s*:\s*/gi,'').replace(/\s+/g,' ').trim().toLowerCase();
  const targets=String(c.to_text||'').toLowerCase().match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/g)||[];
  const sentExact=sent.messages.find(m=>Boolean(c.draft_message_id&&m.messageId===c.draft_message_id));
  const sentCandidates=sent.messages.filter(m=>normalized(m.subject)===normalized(c.subject)&&targets.some(t=>String(m.to||'').toLowerCase().includes(t)));
  return {communicationId:c.id,workFileId:c.work_file_id,uid,subject:c.subject,to:c.to_text,draftPresent:Boolean(draft),exactSentUid:sentExact?.uid||null,sentCandidates:sentCandidates.map(m=>({uid:m.uid,subject:m.subject,date:m.date,body:m.textBody.slice(0,1500),messageId:m.messageId})),savedBody:c.body,currentDraftBody:draft?.textBody||null,ledgerState:c.state,sourceRecordId:c.source_record_id,reviewNote:c.review_note};
 });
 const result={capturedAt:new Date().toISOString(),draftBatch:{folder:drafts.folderName,uidValidity:drafts.uidValidity,scanned:drafts.messages.length,messages:drafts.messages.map(m=>({uid:m.uid,subject:m.subject,to:m.to,messageId:m.messageId,date:m.date,textBody:m.textBody}))},sentBatch:{folder:sent.folderName,uidValidity:sent.uidValidity,scanned:sent.messages.length,messages:sent.messages},observations};
 const p='/home/ubuntu/reports/como-apply-now-2026-10-12/owner-draft-changes-live.json';fs.writeFileSync(p,JSON.stringify(result,null,2)+'\n');console.log('حُفظ الجرد:',p);console.log(JSON.stringify(observations.filter(x=>x.uid>=927).map(x=>({uid:x.uid,subject:x.subject,present:x.draftPresent,exactSentUid:x.exactSentUid,sentCandidates:x.sentCandidates.map(s=>s.uid)})),null,2));
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1)});
