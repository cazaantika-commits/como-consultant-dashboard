import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {sql} from 'drizzle-orm';
import {getDb} from '../server/db';
import {fetchReadonlyFolderSince} from '../server/emailMonitor';
import {importReadonlyBatch,linkEmailToWorkFileCommand} from '../server/services/comoNextEmailInbox';
import {appendEvent,changeActionStatusCommand,createActionCommand} from '../server/services/comoNextCommands';
import {readExecutiveWorkFile} from '../server/services/saraWorkFileReader';
const rows=(v:any):any[]=>Array.isArray(v)&&Array.isArray(v[0])?v[0]:v;
async function main(){
 const db=await getDb();if(!db)throw Error('database_unavailable');
 const batch=await fetchReadonlyFolderSince('Sent',24,30);
 const m=batch.messages.find(x=>x.uid===212);if(!m)throw Error('sent_source_unavailable');
 if(!/a\.zaqout@comodevelopments\.com/i.test(m.from)||!/wael@zooma\.ae/i.test(m.to)||m.subject!=='Fwd: Topographic Survey Quotation — Four Villas, Plot 6180578 — For Signature')throw Error('sent_identity_not_matched');
 if(!m.attachments.some(x=>x.filename==='Q2026-3849_1.pdf'))throw Error('sent_attachment_missing');
 const imported=await importReadonlyBatch(1,{...batch,messages:[m]});
 const [source]=rows(await db.execute(sql`SELECT id FROM como_next_email_messages WHERE user_id=1 AND folder_name='Sent' AND imap_uid=212 AND uid_validity=${batch.uidValidity}`));if(!source)throw Error('sent_import_missing');
 const linked=await linkEmailToWorkFileCommand({userId:1,emailId:Number(source.id),projectId:6,workFileId:390001,suppressReplyDraft:true});
 const [pdf]=rows(await db.execute(sql`SELECT sha256 FROM como_next_email_attachments WHERE email_message_id=${Number(source.id)} AND file_name='Q2026-3849_1.pdf' AND storage_status='stored'`));
 if(pdf?.sha256!=='b4e2f65d003fd4610758eaf503fe352562aa0a40b6b7dbaefc341b585831532e')throw Error('sent_attachment_mismatch');
 const [a]=rows(await db.execute(sql`SELECT action_status FROM como_next_actions WHERE id=870001 AND work_file_id=390001`));
 if(a?.action_status==='open')await changeActionStatusCommand({userId:1,actionId:870001,nextStatus:'completed_pending_verification',actorType:'manus',actorUserId:null});
 if(a&&!['verified','cancelled'].includes(a.action_status))await changeActionStatusCommand({userId:1,actionId:870001,nextStatus:'verified',evidenceReference:`رصد صندوق COMO Sent UID212 بتاريخ${new Date(m.date).toISOString()} إلىوائل، والمرفقQ2026-3849_1.pdf مطابق لبصمة1170001. رسالة${source.id}. الإرسال من المالك وليسManus.`,actorType:'manus',actorUserId:null});
 const wait=await createActionCommand({userId:1,workFileId:390001,title:'انتظار نسخة وائل الموقعة لعرض المسح',description:'أرسل المالك العرض كما هو إلى وائل12أكتوبر13:18:39دبي؛ ننتظر النسخة الموقعة. لا إثبات توقيع أو دفع أو بدء المسح، ولا إعادة الاستيضاح أو العرض. لا موعد مخترع أو تذكير مالي4أيام لهذا العرض.',acceptanceCriteria:'وصول نسخة موقعة من وائل مرتبطة بالعرضMES/2026-3849_1؛ بعدها تحدد الخطوة التالية من الدليل والصلاحيات.',ownerType:'team',priority:'normal',idempotencyKey:'survey-signature-wait:sent212',actorType:'manus',actorUserId:null});
 const [wa]=rows(await db.execute(sql`SELECT action_status FROM como_next_actions WHERE id=${wait.id}`));
 if(wa?.action_status==='open')await changeActionStatusCommand({userId:1,actionId:wait.id,nextStatus:'waiting_external',actorType:'manus',actorUserId:null});
 await db.transaction(async tx=>{
  await tx.execute(sql`SELECT id FROM como_next_work_files WHERE id=390001 FOR UPDATE`);
  const when=new Date(m.date).toISOString().slice(0,19).replace('T',' ');
  await tx.execute(sql`UPDATE como_next_communications SET communication_status='sent',approval_status='not_required',body=${m.textBody},external_message_ref='Sent UID 212',sent_at=${when},occurred_at=${when},evidence_reference=${`صادر COMO${source.id}/UID212؛ PDF مطابق للمصدر1170001`},review_note='أرسله المالك13:18دبي؛ لا إعادة المسودة942. بانتظار نسخة وائل الموقعة.' WHERE id=1740002 AND user_id=1`);
  await tx.execute(sql`UPDATE como_mailbox_draft_ledger SET state='sent_confirmed',sent_folder='Sent',sent_uid=212,confirmed_at=UTC_TIMESTAMP(),review_reason='Main Manus observed owner sender, unique subject and target, exact source PDF hash; mailbox changed message-id',claim_token=NULL,claim_expires_at=NULL WHERE communication_id=1740002`);
  await tx.execute(sql`UPDATE como_next_work_files SET desired_outcome='مرجع العقد الموقع أرسله المالك لشاهد مسبقًا؛ لا إعادة939. المسح: أرسل المالك العرض كما هو لوائل13:18دبي/Sent212؛ ننتظر النسخة الموقعة ولا نعيد942 أو الاستيضاح938. طلب الصرف عند المالية والسداد غير مثبت، وفحص التربة والانتيريور واللاندسكيب والمنزل الذكي مسارات مستقلة.' WHERE id=390001 AND user_id=1`);
  await tx.execute(sql`INSERT INTO como_next_work_memory (project_id,work_file_id,memory_type,entry_type,title,body,source_status,is_current,source_system,source_record_id,occurred_at) SELECT 6,390001,'decision','sent_observation','عرض المسح أرسله المالك لوائل؛ انتظار النسخة الموقعة','ثبت الصادرSent212 بتاريخ12أكتوبر13:18:39دبي إلىوائل ومرفقPDFمطابق لبصمة العرض1170001. أُغلقت مطالبة إرسال942 وصارت الخطوة انتظار توقيع وائل فقط، لا دليل توقيع أو سداد أو بدء الأعمال.','sent_verified',1,'como_next','survey-forward:sent212',${when} WHERE NOT EXISTS(SELECT 1 FROM como_next_work_memory WHERE source_system='como_next' AND source_record_id='survey-forward:sent212')`);
  await appendEvent(tx,{userId:1,projectId:6,workFileId:390001,actorType:'manus',actorUserId:null,eventType:'survey_forward_sent_observed',summary:'أرسل المالك عرض المسح لوائل13:18دبي؛ أُغلقت مطالبة942 والخطوة انتظار التوقيع فقط. لا إعادة إرسال أو إثبات دفع.',payload:{sourceEmailId:source.id,sentUid:212,draftCommunicationId:1740002,sentCommunicationId:linked.communicationId,waitingActionId:wait.id,signed:false,paid:false,manusSent:false},idempotencyKey:'survey-forward:sent212:observed'});
 });
 const member:any={memberId:'abdulrahman'};
 for(const id of [390001,60014]){const r=await readExecutiveWorkFile(member,JSON.stringify({work_file_id:id,focus:'overview'}));fs.writeFileSync(`/home/ubuntu/reports/como-owner-decisions-2026-10-12/sara-verified-${id}.json`,JSON.stringify(r,null,2));console.log('Sara',id,(r as any).found);}
 console.log(JSON.stringify({sourceEmailId:source.id,wait,imported,ownerSent:true,signed:false,paid:false,externalSideEffect:false}));
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1)});
