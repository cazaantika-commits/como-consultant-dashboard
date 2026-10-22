import fs from 'node:fs';
import assert from 'node:assert/strict';
import {sql} from 'drizzle-orm';
import {getDb} from '../server/db';
import {appendEvent,createActionCommand,requireProjectAccess} from '../server/services/comoNextCommands';
import {readExecutiveWorkFile} from '../server/services/saraWorkFileReader';
const root='/home/ubuntu/reports/artec-incoming-2026-10-22';
const key='artec-receipt-20261022:inbox507';
const rows=(r:any):any[]=>r[0];
const load=(name:string)=>JSON.parse(fs.readFileSync(`${root}/${name}.json`,'utf8'));
const save=(name:string,v:any)=>fs.writeFileSync(`${root}/${name}.json`,JSON.stringify(v,null,2)+'\n');
async function main(){
 const db=await getDb();assert(db,'database_unavailable');await requireProjectAccess(db,6,1,'write');
 const imported=load('imported-source'),draft=load('draft-save-result'),manifest=load('attachment-manifest'),proof=load('draft-recovery-proof'),before=load('protected-before');
 const guard=async()=>{
  const current={file:rows(await db.execute(sql`SELECT * FROM como_next_work_files WHERE id=390001 AND user_id=1`)),actions:rows(await db.execute(sql`SELECT * FROM como_next_actions WHERE work_file_id=390001 AND user_id=1 ORDER BY id`)),lanes:rows(await db.execute(sql`SELECT * FROM como_next_lifecycle_lanes WHERE user_id=1 ORDER BY id`)),pending:rows(await db.execute(sql`SELECT * FROM como_next_staged_directives WHERE user_id=1 AND status='pending' ORDER BY id`))};
  assert.deepEqual(current.file,before.file,'file_state_changed');assert.deepEqual(current.lanes,before.lanes,'lifecycle_changed');assert.deepEqual(current.pending,before.pending,'owner_pending_changed');assert.deepEqual(current.actions.filter(a=>before.actions.some((v:any)=>v.id===a.id)),before.actions,'existing_villa_actions_changed');return current;
 };
 await guard();
 const [event]=rows(await db.execute(sql`SELECT * FROM como_next_work_file_events WHERE user_id=1 AND idempotency_key=${key}`));
 if(event){const receipt=JSON.parse(event.payload_json);assert(receipt.draftVerified===true&&receipt.sent===false,'invalid_receipt');save('replay-receipt',{...receipt,replayed:true});console.log(JSON.stringify({replayed:true,mailboxDraftRef:receipt.mailboxDraftRef,workProductId:receipt.workProductId},null,2));return;}
 const [email]=rows(await db.execute(sql`SELECT * FROM como_next_email_messages WHERE id=${imported.emailId} AND user_id=1 AND linked_work_file_id=390001`));
 const [ledger]=rows(await db.execute(sql`SELECT * FROM como_mailbox_draft_ledger WHERE user_id=1 AND communication_id=${draft.id} AND work_file_id=390001`));
 const [communication]=rows(await db.execute(sql`SELECT * FROM como_next_communications WHERE id=${draft.id} AND user_id=1 AND work_file_id=390001`));
 assert(email&&email.body_sha256===imported.bodySha256&&Number(email.reply_draft_communication_id)===Number(draft.id)&&ledger.state==='draft_saved'&&Number(ledger.draft_uid)===964&&communication.communication_status==='archived','source_or_draft_changed');
 const matches=proof.drafts.messages.filter((m:any)=>m.uid===964);assert(matches.length===1&&proof.drafts.messages.length===1,'draft_not_unique');const live=matches[0];
 assert(live.textBody.trim()===communication.body.trim()&&live.to==='tdimitrova@artecint.com'&&live.cc==='mzakout@artecint.com, wael@zooma.ae'&&live.subject===email.subject,'live_draft_mismatch');
 assert(live.headers['in-reply-to']===email.message_id&&live.headers.references.includes(email.message_id)&&live.headers['x-como-draft-key']===`email-reply-draft:${imported.emailId}`&&live.messageId===ledger.message_id,'reply_headers_mismatch');
 const attachments=rows(await db.execute(sql`SELECT * FROM como_next_email_attachments WHERE email_message_id=${imported.emailId} ORDER BY ordinal`));assert(attachments.length===10&&attachments.every(a=>a.storage_status==='stored'&&manifest.some((m:any)=>m.ordinal===a.ordinal&&m.sha256===a.sha256&&m.documentId===Number(a.document_id))),'attachments_not_saved');
 const human=await createActionCommand({userId:1,workFileId:390001,title:'الفلل الأربع — عبد الرحمن: مراجعة وإرسال شكر استلام مخططات أرتك22أكتوبر',description:'وردت رسالة ثيودورا صباح22أكتوبر11:20دبي / COMO2070001. Manus قرأها وحفظ المرفقات العشرة كمصدر استلام غير مراجع هندسيًا. رد استلام مهني واحد Drafts UID964 / مراسلة2970002 إلىثيودورا مع ماجد ووائل CC؛ لم يُرسل. لا تعليق تصميمي أو اعتماد أو موعد موعود. انتظار توجه وائل1830001 باقٍ؛ Rawan لم تبدأ.',acceptanceCriteria:'يراجع عبد الرحمن نص شكر الاستلام ويرسله من صندوق COMO إذاوافق. لا اعتماد للمخططات أو استئناف لمسار التعديلات المتوقف، ولا سداد أو طلبصرف.',ownerType:'human',priority:'important',idempotencyKey:`artec-receipt-review:${imported.emailId}`,actorType:'manus',actorUserId:null});
 const summary='الفلل الأربع — استُرد وارد أرتك507 / COMO2070001 بتاريخ22أكتوبر11:20دبي الذي لم يدخل المزامنة. قرأ Manus الرسالة وحفظ مرفقاتها العشرة كأدلة استلام، لا مراجعة هندسية. رد استلام واحد Drafts UID964 إلىثيودورا CCماجد ووائل محفوظ ومطابق حيًا للنص والمستلمين والخيط، ولم يُرسل. انتظار وائل1830001 والمالية5586 وحالةRawan والمسح والتربة والحمل الكهربائي لم تتغير. الاستيراد المحدد والرد أُنجزا؛ استمرارية النبضات غير مُصلحة، ولم تُغيّر أتمتة.';
 const receipt={...imported,sourceUid:507,receivedAtDubai:'2026-10-22 11:20:13',communicationDraftId:draft.id,mailboxDraftRef:'Drafts UID 964',ownerReviewActionId:human.id,receiptHandlingCompleted:true,engineeringReviewCompleted:false,reviewedDocumentIds:[],receivedDocumentIds:manifest.map((m:any)=>m.documentId),draftVerified:true,draftUnique:true,replyHeadersVerified:true,sent:false,paymentChanged:false,designApproved:false,rawanStarted:false,automationChanged:false,automationContinuityResolved:false,existingVillaActionsUnchanged:true,waitingForWaelPreserved:true,externalSideEffect:false,checkedAt:new Date().toISOString(),executionSummary:summary};
 await db.transaction(async tx=>{
  await tx.execute(sql`SELECT id FROM como_next_work_files WHERE id=390001 AND user_id=1 FOR UPDATE`);
  const r=await tx.execute(sql`INSERT INTO como_next_work_memory (project_id,work_file_id,memory_type,entry_type,title,body,source_status,source_system,source_record_id,is_current,occurred_at) VALUES (6,390001,'work_product','mail_receipt_handling','الفلل الأربع — إيصالاستلامأرتك22أكتوبرومسودة964',${summary+'\n\nنص ردالاستلام:\n'+communication.body},'reviewed','como_manual_mail_review',${key},1,UTC_TIMESTAMP())`);const workProductId=Number((r as any)[0].insertId);assert(workProductId>0,'receipt_not_saved');
  (receipt as any).workProductId=workProductId;
  await appendEvent(tx,{userId:1,projectId:6,workFileId:390001,actionId:human.id,actorType:'manus',actorUserId:null,eventType:'manus_mail_receipt_reviewed',summary,payload:JSON.parse(JSON.stringify(receipt)),idempotencyKey:key});
 });
 save('protected-after',await guard());
 const sara:any=await readExecutiveWorkFile({memberId:'abdulrahman',nameAr:'عبد الرحمن',role:'owner'},JSON.stringify({work_file_id:390001,focus:'overview',question:'حالةرداستلامأرتك22أكتوبرالمحفوظ964والانتظارالقائم'}));assert(sara.found===true&&JSON.stringify(sara).includes('Drafts UID964'),'sara_result_missing');save('sara-state',sara);save('receipt',receipt);console.log(JSON.stringify(receipt,null,2));
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1)});
