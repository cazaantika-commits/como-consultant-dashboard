import 'dotenv/config';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {eq,sql} from 'drizzle-orm';
import {getDb} from '../server/db';
import {users} from '../drizzle/schema';
import {appendEvent,requireProjectAccess} from '../server/services/comoNextCommands';
import {fetchEmailByUID,fetchReadonlyFolderSince} from '../server/emailMonitor';
import {readDispatchForDirective} from '../server/services/comoManusDispatch';
import {readExecutiveWorkFile} from '../server/services/saraWorkFileReader';
import {comoNextRouter} from '../server/routers/comoNext';
const root='/home/ubuntu/reports/como-directive-2190001-2026-11-10';
const key='owner-soil-noc-payment:20261110:124619';
const norm=(v:any)=>String(v||'').replace(/\r\n?/g,'\n').trim();
const hash=(v:any)=>createHash('sha256').update(v).digest('hex');
const env=(v:any)=>[...new Set(String(v||'').toLowerCase().match(/[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}/g)||[])].sort().join(',');
const load=(n:string)=>JSON.parse(fs.readFileSync(root+'/'+n+'.json','utf8'));
const save=(n:string,v:any)=>fs.writeFileSync(root+'/'+n+'.json',JSON.stringify(v,null,2)+'\n');
const omit=(v:any,ks:string[])=>Object.fromEntries(Object.entries(v).filter(([k])=>!ks.includes(k)));
async function main(){
 const db=await getDb();assert(db);await requireProjectAccess(db,6,1,'write');const q=async(s:any)=>(await db.execute(s))[0]as any[];
 if(fs.existsSync(root+'/receipt.json')){const r=load('receipt');const[l]=await q(sql`SELECT state,sent_uid FROM como_mailbox_draft_ledger WHERE user_id=1 AND communication_id=5430001`);assert(l?.state==='sent_confirmed'&&Number(l.sent_uid)===265);assert.equal((await readDispatchForDirective({directiveId:2190001}))?.state,'completed');console.log(JSON.stringify({...r,replayed:true,mailboxWrite:false}));await(db as any).$client.end();return;}
 const committed=load('db-committed'),review=load('review-result'),proof=load('draft-proof');assert(committed.communicationId===5430001&&committed.draftUid===1022&&committed.ownerActionId===4470001&&review.workProductId===7410002);
 const[c]=await q(sql`SELECT * FROM como_next_communications WHERE id=5430001 AND user_id=1`),[ledger]=await q(sql`SELECT * FROM como_mailbox_draft_ledger WHERE communication_id=5430001 AND user_id=1`);
 assert(c&&ledger&&ledger.draft_key===key);
 const mail=load('final-preflight'),candidate=mail.Sent.messages.find((m:any)=>m.uid===265);assert(candidate);
 const sent=await fetchEmailByUID(265,String(mail.Sent.uidValidity),'Sent');assert(sent&&sent.messageId===candidate.messageId&&sent.attachments.length===1);
 assert.equal(norm(sent.textBody),norm(c.body));assert.equal(sent.subject,c.subject);assert.equal(env(sent.to),env(c.to_text));assert.equal(env(sent.cc),env(c.cc_text));
 assert.equal(hash(sent.attachments[0].content!),proof.attachmentSha256);assert.equal(sent.attachments[0].content!.length,84005);assert.equal(sent.attachments[0].filename,'Soil Investigation NOC - REQ-3113149 - AED1050.png');
 assert.equal(candidate.headers.references,load('context').source.message_id);
 const ds=await fetchReadonlyFolderSince('Drafts',24*365,220);assert(ds.messages.length<220&&!ds.messages.some(m=>m.uid===1022||m.messageId===ledger.message_id||m.headers?.['x-como-draft-key']===key));
 save('sent265-proof',{sentUid:265,uidValidity:mail.Sent.uidValidity,messageId:sent.messageId,date:sent.date,subject:sent.subject,to:sent.to,cc:sent.cc,bodySha256:hash(norm(sent.textBody)),attachmentSha256:proof.attachmentSha256,bodySubjectEnvelopeAttachmentExact:true,originalDraftMessageId:ledger.message_id,sentByManus:false});
 const snapshot=async()=>({projects:await q(sql`SELECT * FROM projects WHERE userId=1 ORDER BY id`),files:await q(sql`SELECT * FROM como_next_work_files WHERE user_id=1 ORDER BY id`),actions:await q(sql`SELECT * FROM como_next_actions WHERE user_id=1 ORDER BY id`),lanes:await q(sql`SELECT * FROM como_next_lifecycle_lanes WHERE user_id=1 ORDER BY id`),decisions:await q(sql`SELECT * FROM como_next_decisions WHERE user_id=1 ORDER BY id`),pending:await q(sql`SELECT * FROM como_next_staged_directives WHERE user_id=1 AND status='pending' ORDER BY id`),communications:await q(sql`SELECT * FROM como_next_communications WHERE user_id=1 ORDER BY id`),ledgers:await q(sql`SELECT * FROM como_mailbox_draft_ledger WHERE user_id=1 ORDER BY id`),emails:await q(sql`SELECT * FROM como_next_email_messages WHERE user_id=1 ORDER BY id`)});
 const before=await snapshot();save('sent265-protected-before',before);
 const[se]=await q(sql`SELECT * FROM como_next_email_messages WHERE folder_name='Sent' AND imap_uid=265 AND user_id=1`);
 if(se)assert(se.message_id===sent.messageId&&se.body_sha256===hash(norm(sent.textBody)));
 const summary='طلب1050 للمالية5430001 أرسلSent265 يوم10نوفمبر12:56:25 دبي إلىشاهدونسرينCCوائل،بالرابط وصورةREQ3113149. المتنوالعنوان والمظارف والمرفق مطابقةحرفيًا،1022 غائبةمنDrafts. يطلب منالمالية الوصلالرسمي بعدالسداد وإرساله إلىثيودورا معنسخةلنا. لا إعادةإرسال. السدادوإصدارNOCومباشرةالمختبرغيرمثبتة؛Manusيتابعالماليةثم الوصل ووصوله لأرتك والتصريح والبدء. أمرالبدء8100/MASW3900 أرسل262 وموافقته محفوظة،MEP/أكتوبر/525 مستقلان.';
 let statusMemoryId=0;
 await db.transaction(async tx=>{
  const tq=async(s:any)=>(await tx.execute(s))[0]as any[];
  await tx.execute(sql`SELECT id FROM como_next_work_files WHERE id=390001 AND user_id=1 FOR UPDATE`);
  const[done]=await tq(sql`SELECT id FROM como_next_work_memory WHERE source_system='mailbox_evidence' AND source_record_id=${key+':sent265'}`);if(done){statusMemoryId=Number(done.id);return;}
  const at=new Date(sent.date).toISOString().slice(0,19).replace('T',' ');
  await tx.execute(sql`UPDATE como_next_communications SET communication_status='sent',external_message_ref='Sent UID 265',sent_at=${at},occurred_at=${at},evidence_reference='Sent265: exact body/subject/envelope/attachment; no Manus send',updated_at=UTC_TIMESTAMP() WHERE id=5430001 AND user_id=1`);
  await tx.execute(sql`UPDATE como_mailbox_draft_ledger SET state='sent_confirmed',sent_folder='Sent',sent_uid=265,body_sha256=${hash(norm(sent.textBody))},review_reason=NULL,confirmed_at=UTC_TIMESTAMP(),updated_at=UTC_TIMESTAMP() WHERE communication_id=5430001 AND user_id=1`);
  if(se){await tx.execute(sql`UPDATE como_next_email_messages SET communication_id=5430001 WHERE id=${se.id} AND user_id=1`);if(se.communication_id&&Number(se.communication_id)!==5430001)await tx.execute(sql`UPDATE como_next_communications SET communication_status='archived',review_note='Historical IMAP Sent265; canonical5430001; no new send',updated_at=UTC_TIMESTAMP() WHERE id=${se.communication_id} AND user_id=1 AND source_system='imap'`);}
  await tx.execute(sql`UPDATE como_next_actions SET action_status='verified',completed_at=UTC_TIMESTAMP(),verified_at=UTC_TIMESTAMP(),evidence_reference='Sent265: finance request sent, not payment; subsequent receipt/NOC/start remain open in work-file follow-up',updated_at=UTC_TIMESTAMP() WHERE id=4470001 AND user_id=1 AND action_status='open'`);
  const ins:any=await tx.execute(sql`INSERT INTO como_next_work_memory(project_id,work_file_id,memory_type,entry_type,title,body,source_status,source_system,source_record_id,is_current,occurred_at) VALUES(6,390001,'work_product','soil_noc_finance_request_sent','طلبمالية1050 مرسل؛انتظارالوصلالرسميثمNOC',${summary},'sent_confirmed','mailbox_evidence',${key+':sent265'},1,UTC_TIMESTAMP())`);statusMemoryId=Number(ins[0].insertId);
  await tx.execute(sql`INSERT IGNORE INTO como_next_work_memory_documents(project_id,work_file_id,memory_id,document_id,relation_type,source_system,source_record_id) VALUES(6,390001,${statusMemoryId},2550001,'attachment','mailbox_evidence',${key+':sent265:2550001'})`);
  const[f]=await tq(sql`SELECT desired_outcome FROM como_next_work_files WHERE id=390001 AND user_id=1`);
  await tx.execute(sql`UPDATE como_next_work_files SET desired_outcome=${'[SoilNOCFinanceSent265]\n'+summary+'\nالطلبمرسل،لاطلبإعادة1022 ولا انتظارعلىمسودة. المصدرالحالييصححعبارةغيرمرسل فيإيصالالمراجعةالقديم7410002 معحفظالتاريخ.\n\nالسجلالسابقمحفوظ:\n'+f.desired_outcome},updated_at=UTC_TIMESTAMP() WHERE id=390001 AND user_id=1`);
  await appendEvent(tx,{userId:1,projectId:6,workFileId:390001,actionId:4470001,actorType:'manus',actorUserId:null,eventType:'soil_noc_finance_sent_confirmed',summary,payload:{communicationId:5430001,ownerReviewActionId:4470001,sentUid:265,sentMessageId:sent.messageId,statusMemoryId,workProductId:7410002,officialReceiptRequiredAfterPayment:true,paymentExecuted:false,nocIssued:false,fieldCommencementProven:false,sentByManus:false},idempotencyKey:key+':sent265'});
 });
 const after=await snapshot();save('sent265-protected-after',after);
 for(const k of['projects','lanes','decisions','pending'])assert.deepEqual((after as any)[k],(before as any)[k],k);
 for(const[k,allowed]of Object.entries({files:[390001],actions:[4470001],communications:[5430001,Number(se?.communication_id||0)],ledgers:[Number(ledger.id)],emails:[Number(se?.id||0)]}))assert.deepEqual((after as any)[k].filter((v:any)=>!allowed.includes(v.id)),(before as any)[k].filter((v:any)=>!allowed.includes(v.id)),k);
 assert.deepEqual(omit(after.files.find(v=>v.id===390001),['desired_outcome','updated_at']),omit(before.files.find(v=>v.id===390001),['desired_outcome','updated_at']));
 const original=load('protected-before'),earlier=load('protected-after');for(const k of['projects','lanes','decisions','pending'])assert.deepEqual(earlier[k],original[k]);
 assert.deepEqual(omit(earlier.emails.find((v:any)=>v.id===3690001),['communication_id','updated_at']),omit(original.emails.find((v:any)=>v.id===3690001),['communication_id','updated_at']));
 const sara:any=await readExecutiveWorkFile({memberId:'abdulrahman',nameAr:'عبدالرحمن',role:'owner'},JSON.stringify({work_file_id:390001,focus:'overview',question:`طلبالمالية5430001أرسلSent265،ذاكرةالحالة${statusMemoryId} وإيصال7410002. لا سدادمثبت؛Manusيتابعالوصلثم أرتكوالNOC. لا إعادة1022.`}));save('status-source-final',sara);assert(sara.found&&JSON.stringify(sara).includes(String(statusMemoryId)));
 const[user]=await db.select().from(users).where(eq(users.id,1));const kitchen:any=await comoNextRouter.createCaller({user,req:{}as any,res:{}as any}).getOverview();save('kitchen-final',kitchen);assert(!kitchen.actions.some((a:any)=>a.id===4470001));assert(!kitchen.sendEvidenceDiagnostics?.some((a:any)=>a.actionId===4470001));
 assert.equal((await readDispatchForDirective({directiveId:2190001}))?.state,'completed');
 for(const s of[sql`SELECT COUNT(*) n FROM como_next_work_file_events WHERE idempotency_key='dispatch-started:2190001'`,sql`SELECT COUNT(*) n FROM como_next_work_memory WHERE source_record_id='dispatch-review:2190001'`,sql`SELECT COUNT(*) n FROM como_next_work_file_events WHERE idempotency_key=${key+':owner-send'}`,sql`SELECT COUNT(*) n FROM como_next_work_file_events WHERE idempotency_key=${key+':sent265'}`,sql`SELECT COUNT(*) n FROM como_mailbox_draft_ledger WHERE communication_id=5430001 AND user_id=1`])assert.equal(Number((await q(s))[0].n),1);
 const r={directiveId:2190001,sourceEmailId:3780001,communicationId:5430001,originalDraftUid:1022,sentUid:265,sentAt:sent.date,sent:true,sentByManus:false,ownerActionId:4470001,ownerMemoryId:7410001,workProductId:7410002,statusMemoryId,to:c.to_text,cc:c.cc_text,trackingNumber:'REQ-3113149',amountAed:1050,officialReceiptRequiredAfterPayment:true,artecNotificationAfterPayment:true,attachmentDocumentId:2550001,paymentExecuted:false,nocIssued:false,fieldCommencementProven:false,startOrderSentUid:262,statusSourceFound:true,protectedRecordsUnchanged:true,decisionsChanged:false,unique:true,liveVerified:true,manusResponsibleForNextStep:true};save('receipt',r);console.log(JSON.stringify(r));await(db as any).$client.end();
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.stack);process.exit(1)});
