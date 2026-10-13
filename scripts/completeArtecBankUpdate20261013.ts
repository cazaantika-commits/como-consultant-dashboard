import fs from 'node:fs';
import {sql} from 'drizzle-orm';
import {getDb} from '../server/db';
import {appendEvent,requireProjectAccess,changeActionStatusCommand} from '../server/services/comoNextCommands';
import {completeDispatchedMailReview,readDispatchForDirective,recordManusDispatchProgress} from '../server/services/comoManusDispatch';
import {confirmSentLineageObservation} from '../server/services/comoMailboxDraftLedger';
import {readExecutiveWorkFile} from '../server/services/saraWorkFileReader';
const root='/home/ubuntu/reports/artec-invoice-update-2026-10-13';
const rows=(v:any)=>v[0] as any[];
const norm=(s:any)=>String(s||'').replace(/\r\n?/g,'\n').trim();
async function main(){
 const db=await getDb();if(!db)throw Error('database_unavailable');await requireProjectAccess(db,6,1,'write');
 const dispatch=await readDispatchForDirective({directiveId:390001});if(dispatch?.state==='completed'){console.log(JSON.stringify({alreadyCompleted:true,dispatch}));return;}if(dispatch?.state!=='running')throw Error('not_claimed');
 const [email]=rows(await db.execute(sql`SELECT * FROM como_next_email_messages WHERE id=1380001 AND user_id=1 AND linked_work_file_id=390001`));
 if(email?.body_sha256!=='9ae671d14a3d1693fff443c6ebe83ab3bf5a57b0b8b1cc150b1f0b5189853f7a')throw Error('source_changed');
 const [sent]=rows(await db.execute(sql`SELECT * FROM como_next_email_messages WHERE id=1380002 AND user_id=1 AND folder_name='Sent' AND imap_uid=217`));
 const [comm]=rows(await db.execute(sql`SELECT * FROM como_next_communications WHERE id=2070001 AND user_id=1 AND work_file_id=390001`));
 const [ledger]=rows(await db.execute(sql`SELECT * FROM como_mailbox_draft_ledger WHERE id=300001 AND communication_id=2070001 AND user_id=1`));
 const proof=JSON.parse(fs.readFileSync(root+'/live-sent-proof.json','utf8'));
 if(proof.uid!==217||proof.folder!=='Sent'||proof.bodyAndRecipientsMatch!==true)throw Error('live_sent_not_checked');
 if(!sent||!comm||!ledger||norm(sent.body_text)!==norm(comm.body)||sent.body_sha256!==ledger.body_sha256||sent.to_text!==comm.to_text||sent.cc_text!==comm.cc_text||sent.from_email!=='a.zaqout@comodevelopments.com')throw Error('sent_match_failed');
 const report=fs.readFileSync(root+'/Artec_Updated_Bank_Letter_Review_AR.md','utf8');
 await recordManusDispatchProgress({directiveId:390001,summary:'الفلل الأربعة — فُحص خطاب بنك13أكتوبر؛ بياناته تطابق السابق والفاتورة5586. رُصد إرسال المالك للشكر10:58دبي بالنص والمستلمين نفسيهما، فلا مسودة جديدة. جارٍ حفظ النتيجة وإزالة مطالبة الشكر المنجزة؛ السداد لم يثبت.'});
 await confirmSentLineageObservation({ledgerId:300001,folder:'Sent',uid:217});
 await db.transaction(async tx=>{
  await tx.execute(sql`SELECT id FROM como_next_work_files WHERE id=390001 FOR UPDATE`);
  await tx.execute(sql`UPDATE como_next_communications SET communication_status='sent',sent_at=${new Date(sent.received_at).toISOString().slice(0,19).replace('T',' ')},external_message_ref='Sent UID 217',evidence_reference='COMO1380002/Sent217؛ مطابق مسودة948 بالنص والمستلمين، تحقق حي',review_note='أرسل المالك الشكر10:58:36دبي13أكتوبر؛ لا إعادة إنشاء.' WHERE id=2070001 AND user_id=1 AND communication_status IN('archived','sent')`);
  await tx.execute(sql`UPDATE como_next_lifecycle_lanes SET evidence_reference='COMO1350001/INBOX492؛ الوثائق الأربع فُحصت؛ خطاب البنك المحدّث COMO1380001/INBOX493 مستند1320001، تاريخ13أكتوبر2026؛ الماليةCC',source_text='وثائق الصرف الأربع مستلمة ومراجعة. خطاب البنك المحدّث13أكتوبر فُحص وبيانات المستفيد والحساب والآيبان تطابق الخطاب السابق والفاتورة5586. شاهد ونسرين مستلمان أصلًا؛ أرسل المالك الشكرCOMO1380002/الصادر217. لا تحويل مكرر ولا دليل سداد.',recorded_at=UTC_TIMESTAMP() WHERE id=60001 AND work_file_id=390001 AND user_id=1 AND status='received' AND kind='deliverable'`);
  await tx.execute(sql`UPDATE como_next_actions SET description=CONCAT(COALESCE(description,''),'\n13أكتوبر: خطاب البنك المحدّث1320001 مؤرخ13أكتوبر وبياناته مطابقة؛ المالية تلقت المستند. أرسل المالك الشكر1380002/Sent217؛ لا إعادة طلب أو شكر. السداد ما زال غير مثبت.') WHERE id=840001 AND work_file_id=390001 AND action_status NOT IN('verified','cancelled') AND description NOT LIKE '%خطاب البنك المحدّث1320001%'`);
  await tx.execute(sql`UPDATE como_next_intake_proposals SET review_status='dismissed',review_note='معلومة وثّقها Manus من فحص المستند1320001 والصادر217 في التوجيه390001؛ لا مهمة جديدة أو موعد7:00افتراضي. متابعة المالية840001مستقلة.',reviewed_at=UTC_TIMESTAMP() WHERE id=1950001 AND source_email_id=1380001 AND proposal_kind='note' AND review_status='pending'`);
  await appendEvent(tx,{userId:1,projectId:6,workFileId:390001,actorType:'manus',actorUserId:null,eventType:'artec_bank_letter_updated_owner_ack_sent',summary:'الفلل الأربعة — فُحص خطاب بنك13أكتوبر ببيانات مطابقة للسابق والفاتورة؛ المالية مستلمة. المالك أرسل الشكر10:58دبي، فلا إعادة رسالة. السداد غير مثبت.',payload:{directiveId:390001,sourceEmailId:1380001,documentId:1320001,observedSentEmailId:1380002,communicationId:2070001,bankDetailsMatch:true,paymentStatusUnchanged:true,noNewMail:true},idempotencyKey:'artec-bank-update:1380001:reconcile'});
 });
 const [a]=rows(await db.execute(sql`SELECT action_status FROM como_next_actions WHERE id=1170001 AND work_file_id=390001`));
 if(a&&!['verified','cancelled'].includes(a.action_status)){
  if(a.action_status!=='completed_pending_verification')await changeActionStatusCommand({userId:1,actionId:1170001,nextStatus:'completed_pending_verification',actorType:'manus',actorUserId:null});
  await changeActionStatusCommand({userId:1,actionId:1170001,nextStatus:'verified',evidenceReference:'المالك أرسلCOMO1380002/Sent217 الساعة10:58:36دبي؛ نص ومستلِمو مسودة948 مطابقون، تحقق حي. لا إرسال نفذهManus.',actorType:'manus',actorUserId:null});
 }
 await db.execute(sql`UPDATE como_manus_dispatches SET next_action_id=NULL WHERE directive_id=360001 AND state='completed' AND next_action_id=1170001`);
 const summary='الفلل الأربعة/6180578 — خطاب بنك أرتك المحدّث13أكتوبر وصل10:42دبي وفُحص، ويطابق الحساب والمستفيد والفاتورة5586. شاهد ونسرين ضمن المستلمين، فلا تحويل مكرر. المالك أرسل الشكر10:58دبي؛ انتهت مطالبة مراجعة948 ولا رسالة جديدة. السداد غير مثبت؛ متابعة المالية16أكتوبر باقية.';
 const result=await completeDispatchedMailReview({directiveId:390001,bodySha256:email.body_sha256,reviewedDocumentIds:[1320001],summary,workProductBody:report+'\n\nحُفظ إيصال فحص1320001؛ مسار الوثائق60001مستلم، الإجراء1170001verifiedبدليل الصادر، الدفع30001والإجراء840001باقيان مستقلين. لا مراسلة جديدة ولا إعادة إرسال.'});
 await db.execute(sql`UPDATE como_manus_dispatches SET next_action_id=840001 WHERE directive_id=390001 AND state='completed'`);
 const sara=await readExecutiveWorkFile({memberId:'abdulrahman',nameAr:'عبد الرحمن',role:'owner'},JSON.stringify({work_file_id:390001,focus:'overview'}));
 fs.writeFileSync(root+'/completed.json',JSON.stringify({result,documentId:1320001,acknowledgementSentByOwner:true,noNewDraft:true,paymentNotConfirmed:true,nextActionId:840001},null,2));
 fs.writeFileSync(root+'/sara-state.json',JSON.stringify(sara,null,2));console.log(JSON.stringify(result,null,2));
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1)});
