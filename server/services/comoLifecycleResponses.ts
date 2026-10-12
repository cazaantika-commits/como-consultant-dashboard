import {sql} from 'drizzle-orm';
import {getDb} from '../db';
import {appendEvent,createActionCommand} from './comoNextCommands';
import {normalizeFinanceThreadSubject} from './comoFinancePaymentFollowups';
const rows=(v:any):any[]=>Array.isArray(v)&&Array.isArray(v[0])?v[0]:v;

/** Reads only authoritative Draft-ledger Sent bindings. A draft is not a send. */
export async function reconcileLifecycleResponseLanes(input:{userId:number;limit?:number}) {
 const db=await getDb();if(!db)throw new Error('database_unavailable');
 const limit=Math.max(1,Math.min(input.limit||10,30));
 const lanes=rows(await db.execute(sql`SELECT l.*,c.to_text,c.subject,c.id AS communication_id,ledger.sent_uid,ledger.sent_folder,ledger.message_id AS draft_message_id
 FROM como_next_lifecycle_lanes l JOIN como_next_communications c ON l.lane_key=CONCAT('response:',c.id) AND c.work_file_id=l.work_file_id AND c.user_id=l.user_id
 LEFT JOIN como_mailbox_draft_ledger ledger ON ledger.communication_id=c.id AND ledger.work_file_id=l.work_file_id AND ledger.user_id=l.user_id AND ledger.state='sent_confirmed'
 WHERE l.user_id=${input.userId} AND l.kind='external_response' AND l.status IN ('awaiting_owner_send','waiting_external') ORDER BY l.recorded_at,l.id LIMIT ${limit}`));
 let sentConfirmed=0,responseReviewed=0;
 for(const lane of lanes){
  const sent=lane.sent_uid?rows(await db.execute(sql`SELECT id,received_at,message_id FROM como_next_email_messages WHERE user_id=${input.userId} AND linked_work_file_id=${lane.work_file_id} AND folder_name='Sent' AND imap_uid=${lane.sent_uid} AND communication_id=${lane.communication_id} LIMIT 1`))[0]:null;
  if(!sent)continue;
  if(lane.status==='awaiting_owner_send'){
   await db.transaction(async tx=>{
    await tx.execute(sql`SELECT id FROM como_next_work_files WHERE id=${lane.work_file_id} FOR UPDATE`);
    const changed=await tx.execute(sql`UPDATE como_next_lifecycle_lanes SET status='waiting_external',source_kind='sent_message',evidence_reference=${`Sent UID ${lane.sent_uid}؛ رسالة #${sent.id}`},next_action_id=NULL,next_action_title='بانتظار رد الطرف الخارجي؛ مراقبة Manus للبريد',next_owner_type='manus',attention_at=NULL WHERE id=${lane.id} AND status='awaiting_owner_send'`);
    if(!Number((changed as any)[0]?.affectedRows))return;
    if(lane.next_action_id)await tx.execute(sql`UPDATE como_next_actions SET action_status='verified',completed_at=${sent.received_at},verified_at=UTC_TIMESTAMP(),evidence_reference=${`إرسال فعلي: Sent UID ${lane.sent_uid}`},attention_at=NULL,follow_up_at=NULL WHERE id=${lane.next_action_id} AND source_system='como_lifecycle' AND owner_type='human' AND action_status IN ('open','in_progress')`);
    await tx.execute(sql`UPDATE como_next_lifecycle_lanes SET next_action_id=NULL,next_action_title='مراقبة البريد حتى وصول التقرير أو تحديث من كولييرز',next_owner_type='manus',attention_at=NULL WHERE work_file_id=${lane.work_file_id} AND kind='deliverable' AND action_id=${lane.action_id} AND next_action_id=${lane.next_action_id||null}`);
    await appendEvent(tx,{userId:input.userId,projectId:lane.project_id,workFileId:lane.work_file_id,actorType:'system',actorUserId:null,eventType:'lifecycle_external_request_sent',summary:`ثبت إرسال متابعة التقرير في Sent UID ${lane.sent_uid}؛ يبدأ انتظار الرد، ولا يُغلق التقرير`,payload:{communicationId:lane.communication_id,sentEmailId:sent.id,reportDelivered:false},idempotencyKey:`lifecycle-sent:${lane.id}:${sent.id}`});
    sentConfirmed++;
   });
  }
  const recipient=String(lane.to_text).toLowerCase().match(/[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}/)?.[0];
  if(!recipient)continue;
  const replies=rows(await db.execute(sql`SELECT id,subject,received_at FROM como_next_email_messages WHERE user_id=${input.userId} AND folder_name='INBOX' AND linked_work_file_id=${lane.work_file_id} AND LOWER(from_email)=${recipient} AND received_at>${sent.received_at} ORDER BY received_at LIMIT 100`));
  const reply=replies.find(r=>normalizeFinanceThreadSubject(r.subject)===normalizeFinanceThreadSubject(lane.subject)&&!/^\s*(?:automatic reply|out of office|auto:|undeliverable|delivery status)/i.test(r.subject));
  if(!reply)continue;
  const action=await createActionCommand({userId:input.userId,workFileId:lane.work_file_id,title:'مراجعة الرد الجديد على متابعة التقرير',description:`راجع Manus رسالة COMO الواردة #${reply.id} في الخيط الصحيح، وافحص هل تحتوي التقرير أو مجرد تحديث. الرد وحده لا يثبت اكتمال التسليم.`,acceptanceCriteria:'حفظ نتيجة مراجعة المحتوى وربط المستند إن وُجد؛ لا إغلاق التقرير أو اختراع موعد من وصول البريد وحده.',ownerType:'manus',priority:'important',idempotencyKey:`lifecycle-response-review:${lane.id}:${reply.id}`,actorType:'system',actorUserId:null});
  await db.transaction(async tx=>{
   await tx.execute(sql`SELECT id FROM como_next_work_files WHERE id=${lane.work_file_id} FOR UPDATE`);
   const changed=await tx.execute(sql`UPDATE como_next_lifecycle_lanes SET status='response_received',source_kind='inbound_message',evidence_reference=${`رسالة COMO الواردة #${reply.id}`},next_action_id=${action.id},next_action_title='Manus يراجع الرد والمرفقات',next_owner_type='manus',attention_at=NULL WHERE id=${lane.id} AND status='waiting_external'`);
   if(!Number((changed as any)[0]?.affectedRows))return;
   await tx.execute(sql`UPDATE como_next_lifecycle_lanes SET next_action_id=${action.id},next_action_title='مراجعة محتوى الرد؛ التسليم غير مثبت بعد',next_owner_type='manus' WHERE work_file_id=${lane.work_file_id} AND kind='deliverable' AND action_id=${lane.action_id}`);
   await appendEvent(tx,{userId:input.userId,projectId:lane.project_id,workFileId:lane.work_file_id,actorType:'system',actorUserId:null,eventType:'lifecycle_response_received',summary:'وصل رد في خيط المتابعة؛ أُنشئت مراجعة Manus دون إغلاق التقرير',payload:{emailId:reply.id,nextActionId:Number(action.id),reportDelivered:false},idempotencyKey:`lifecycle-reply:${lane.id}:${reply.id}`});
   responseReviewed++;
  });
 }
 return {examined:lanes.length,sentConfirmed,responseReviewed,externalSideEffects:false as const};
}
