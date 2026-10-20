import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {sql} from 'drizzle-orm';
import {getDb} from '../server/db';
import {appendEvent,createActionCommand,createCommunicationDraftCommand,requireProjectAccess} from '../server/services/comoNextCommands';
import {applyComoCcPolicy,fetchReadonlyFolderSince} from '../server/emailMonitor';
import {readExecutiveWorkFile} from '../server/services/saraWorkFileReader';
import {readMailExecutionHealth} from '../server/services/comoMailExecution';
const root='/home/ubuntu/reports/como-directive-960001-2026-10-20';
const directiveId=960001,emailId=2010001,actionId=2040001,fileId=630001,userId=1,projectId=1;
const key='satwa-documents-ack:2010001:20261020';
const sourceSha='46183fa654e9aae97e07865edabfee42bfec2bc01dad704e5e6b2e03ffe21fbf';
const rows=(v:any):any[]=>Array.isArray(v)&&Array.isArray(v[0])?v[0]:v;
const sha=(v:string|Buffer)=>createHash('sha256').update(v).digest('hex');
const save=(name:string,v:unknown)=>fs.writeFileSync(root+'/'+name,JSON.stringify(v,null,2)+'\n');
const addresses=(v:string)=>String(v||'').toLowerCase().split(',').map(x=>x.trim()).filter(Boolean).sort();
async function readAuthority(db:any){return rows(await db.execute(sql`SELECT sd.*,d.id AS dispatch_id,d.state,d.claim_token,d.delivery_attempts FROM como_next_staged_directives sd JOIN como_manus_dispatches d ON d.directive_id=sd.id WHERE sd.id=${directiveId} AND sd.user_id=${userId}`))[0];}
async function protectedState(db:any){return {payments:rows(await db.execute(sql`SELECT * FROM como_next_lifecycle_lanes WHERE kind='payment' ORDER BY id`)),scenarios:rows(await db.execute(sql`SELECT * FROM cf_scenarios ORDER BY id`)),projects:rows(await db.execute(sql`SELECT id,name FROM projects ORDER BY id`)),files:rows(await db.execute(sql`SELECT id,work_file_status FROM como_next_work_files ORDER BY id`)),otherPending:rows(await db.execute(sql`SELECT id,status,directive_text,result_json FROM como_next_staged_directives WHERE status='pending' ORDER BY id`))};}
async function verifyDraft(){
 const b=await fetchReadonlyFolderSince('Drafts',24*365,100);
 const matches=b.messages.filter(m=>m.headers?.['x-como-draft-key']===key);
 assert.equal(matches.length,1,'exactly_one_ack_draft_required');
 const m=matches[0];const body=fs.readFileSync(root+'/Arif_Bintoak_Documents_Acknowledgement_EN.md','utf8').trim();
 const proof=JSON.parse(fs.readFileSync(root+'/live-proof.json','utf8'));const source=proof.source;
 assert.equal(m.textBody.trim(),body,'draft_body_changed');assert.equal(m.subject,source.subject,'draft_subject_changed');
 assert.deepEqual(addresses(m.to),addresses(source.from),'draft_to_changed');assert.deepEqual(addresses(m.cc),addresses(applyComoCcPolicy({to:source.from,cc:source.cc})),'draft_cc_changed');
 assert.equal(m.headers?.['in-reply-to'],source.messageId,'reply_parent_changed');
 assert.ok(String(m.headers?.references||'').includes(source.messageId),'reply_references_missing');
 assert.ok(!addresses(m.cc).includes('pa@zooma.ae'),'no_mia');
 const sent=await fetchReadonlyFolderSince('Sent',24,100);
 assert.ok(!sent.messages.some(x=>x.messageId===m.messageId||x.headers?.['x-como-draft-key']===key),'ack_already_sent');
 save('live-ack-draft.json',{checkedAt:new Date().toISOString(),folder:'Drafts',uidValidity:b.uidValidity,...m,sent:false});return m;
}
async function main(){
 const db=await getDb();if(!db)throw Error('database_unavailable');await requireProjectAccess(db,projectId,userId,'write');
 const r=await readAuthority(db);assert.ok(r);assert.equal(Number(r.work_file_id),fileId);assert.equal(Number(r.action_id),actionId);assert.equal(r.source_member_id,'system:manus-action');assert.equal(r.stage_key,`system-manus-action:${actionId}`);assert.ok(r.directive_text.includes('مطابقة'));assert.ok(r.directive_text.includes(sourceSha));
 if(r.result_json){const existing=JSON.parse(r.result_json);if(existing.kind==='satwa_source_review_mapping_blocked'){const m=await verifyDraft();assert.equal(m.uid,existing.mailboxDraftUid);console.log(JSON.stringify({replayed:true,completed:false,receipt:existing}));return;}}
 assert.equal(r.status,'submitting');assert.equal(r.state,'running');assert.ok(r.claim_token?.startsWith('worker:'));
 const [e]=rows(await db.execute(sql`SELECT * FROM como_next_email_messages WHERE id=${emailId} AND user_id=${userId}`));assert.ok(e);assert.equal(e.body_sha256,sourceSha);assert.equal(e.linked_work_file_id,null);
 const proof=JSON.parse(fs.readFileSync(root+'/live-proof.json','utf8'));assert.ok(Date.now()-Date.parse(proof.checkedAt)<15*60_000,'source_preflight_stale');
 assert.equal(proof.source.messageId,e.message_id);assert.equal(sha(proof.source.textBody.trim().slice(0,1_000_000)),sourceSha);assert.equal(proof.source.attachments.length,6);
 assert.ok(proof.batches.find((b:any)=>b.folder==='Drafts'));assert.ok(!proof.thread.some((m:any)=>['Sent','Drafts'].includes(m.folder)),'reply_already_exists');
 for(const a of proof.source.attachments)assert.equal(sha(fs.readFileSync(a.file)),a.sha256,'attachment_changed');
 const protectedBefore=await protectedState(db);save('protected-before.json',protectedBefore);
 assert.ok(!protectedBefore.projects.some((p:any)=>/3347343|satwa|السطوة/i.test(p.name)),'project_now_exists_review_mapping_again');
 const [file]=rows(await db.execute(sql`SELECT * FROM como_next_work_files WHERE id=${fileId} AND user_id=${userId}`));assert.equal(file.source_system,'como_mail_linkage');assert.ok(!['closed','cancelled'].includes(file.work_file_status));
 const body=fs.readFileSync(root+'/Arif_Bintoak_Documents_Acknowledgement_EN.md','utf8').trim();
 console.log('السطوة — حفظ رد استلام فقط في الوعاء المحايد، دون ربط المشروع أو المرفقات به');
 const draft=await createCommunicationDraftCommand({userId,workFileId:fileId,channel:'email',subject:proof.source.subject,body,toText:proof.source.from,ccText:applyComoCcPolicy({to:proof.source.from,cc:proof.source.cc}),sourceEmailId:emailId,idempotencyKey:key});
 save('ack-save-receipt.json',draft);assert.ok(!draft.mailboxDraft?.observedInSent,'ack_observed_sent');
 const m=await verifyDraft();const ref=`Drafts UID ${m.uid}`;
 const owner=await createActionCommand({userId,workFileId:fileId,title:'السطوة — عبد الرحمن: مراجعة المطالبة ورد الاستلام وتحديد تبعية المشروع',description:`فحص Manus وثائق أريف وبينتوك للقطعة3347343 كاملة. المطالبة420,000درهم، والفاتورة باسمHazar Akay. راجع رد الاستلام ${ref} والخلاصة، وحدد تبعية المشروع/صفةCOMO قبل تسجيله وربط المطالبة أو اتخاذ قرار مالي. لا طلب لإعادة شرح المستندات، ولا توصية بدفع أو قبول الرصيد. وعاء630001 محايد، ولا يعني أن المشروع ماجان.`,acceptanceCriteria:'مراجعة رد الاستلام وموقف المطالبة وتحديد تبعية مشروع3347343؛ لا إرسال أو قبول دين أو صرف تلقائيًا. يتولى Manus التسجيل والربط والتحقق التعاقدي بعد حسم التبعية.',ownerType:'human',priority:'important',actorType:'manus',actorUserId:null,idempotencyKey:'satwa-owner-review:2010001:20261020'});
 const blocker='مشروع السطوة3347343 غير مسجل فيCOMO؛ الفاتورة باسمHazar Akay، ولم تثبت تبعيةCOMO التعاقدية من الحزمة. لا ربط تخميني بماجان أو الفلل.';
 const summary=`السطوة — فُحص بريد2010001 ومرفقاته الستة كاملة. مطالبة420,000درهم تشمل280,000أتعاب و120,000تغيير و20,000ضريبة؛ ليست دفعة جديدة أو سدادًا. رد استلام محفوظ ${ref}، لم يُرسل. المطابقة بملف مشروع غير مكتملة: ${blocker} على عبد الرحمن مراجعة المطالبة ورد الاستلام وتحديد تبعية المشروع؛ ثم على Manus تسجيله/ربطه والتحقق من العقد وقبول التغيير ومخرجات التسليم. لا قبول دين أو تغيير مالية.`;
 const report=fs.readFileSync(root+'/Arif_Bintoak_Satwa_Invoice_Review_AR.md','utf8');
 const receipt=await db.transaction(async tx=>{
  await tx.execute(sql`SELECT id FROM como_next_work_files WHERE id=${fileId} AND user_id=${userId} FOR UPDATE`);
  const live=await readAuthority(tx);assert.equal(live.state,'running');assert.equal(live.status,'submitting');assert.equal(live.claim_token,r.claim_token);
  const [src]=rows(await tx.execute(sql`SELECT body_sha256,linked_work_file_id FROM como_next_email_messages WHERE id=${emailId} AND user_id=${userId} FOR UPDATE`));assert.equal(src.body_sha256,sourceSha);assert.equal(src.linked_work_file_id,null);
  const [f]=rows(await tx.execute(sql`SELECT work_file_status FROM como_next_work_files WHERE id=${fileId}`));assert.ok(!['closed','cancelled'].includes(f.work_file_status));
  const inserted:any=await tx.execute(sql`INSERT INTO como_next_work_memory (project_id,work_file_id,memory_type,entry_type,title,body,source_status,is_current,source_system,source_record_id,occurred_at) VALUES (${projectId},${fileId},'work_product','mail_linkage_blocker','السطوة3347343 — مراجعة المطالبة وعائق تسجيل المشروع',${report+'\n\n## الحالة المحفوظة\n'+summary},'source_reviewed_mapping_blocked',1,'como_next',${'satwa-source-review:2010001:20261020'},UTC_TIMESTAMP())`);
  const workProductId=Number(inserted[0].insertId);
  const result={kind:'satwa_source_review_mapping_blocked',directiveId,dispatchId:Number(live.dispatch_id),emailId,sourceBodySha256:sourceSha,completed:false,reviewCompleted:true,matchingCompleted:false,disposition:'project_unregistered_relationship_unconfirmed',targetProjectId:null,targetWorkFileId:null,neutralIntakeWorkFileId:fileId,workProductId,communicationDraftId:Number(draft.id),mailboxDraftRef:ref,mailboxDraftUid:m.uid,ownerActionId:Number(owner.id),nextManusActionId:actionId,blocker,summary,replyDisposition:'draft_saved_not_sent',attachmentsReviewed:6,invoiceClaimAED:420000,acceptedDebt:false,paymentStatusChanged:false,externalSideEffects:false,sent:false,checkedAt:new Date().toISOString()};
  await tx.execute(sql`UPDATE como_next_actions SET title='السطوة — Manus: ربط المطالبة بعد تثبيت تبعية المشروع',description=${summary},evidence_reference=${`مخرج ${workProductId}; مصدرCOMO${emailId}; ${ref}; مطابقة غير مكتملة`},action_status='open' WHERE id=${actionId} AND user_id=${userId} AND action_status='open'`);
  await tx.execute(sql`UPDATE como_next_staged_directives SET status='failed',work_product_id=${workProductId},communication_draft_id=${Number(draft.id)},mailbox_draft_ref=${ref},execution_summary=${summary},result_json=${JSON.stringify(result)},failure_message=${blocker} WHERE id=${directiveId} AND user_id=${userId} AND status='submitting'`);
  await tx.execute(sql`UPDATE como_manus_dispatches SET state='failed',last_progress_at=UTC_TIMESTAMP(),error=${blocker},execution_summary=${summary},result_json=${JSON.stringify(result)},work_product_id=${workProductId},communication_draft_id=${Number(draft.id)},mailbox_draft_ref=${ref},next_action_id=${Number(owner.id)} WHERE directive_id=${directiveId} AND state='running' AND claim_token=${r.claim_token}`);
  await appendEvent(tx,{userId,projectId,workFileId:fileId,actionId,actorType:'manus',actorUserId:null,eventType:'mail_linkage_review_blocked',summary,payload:{directiveId,emailId,workProductId,completed:false,reviewCompleted:true,matchingCompleted:false,ownerActionId:Number(owner.id),communicationDraftId:Number(draft.id),mailboxDraftRef:ref,externalSideEffect:false},idempotencyKey:'satwa-source-review-event:2010001:20261020'});
  return result;
 });
 save('review-receipt.json',receipt);
 const protectedAfter=await protectedState(db);save('protected-after.json',protectedAfter);assert.deepEqual(protectedAfter,protectedBefore,'protected_finance_or_project_state_changed');
 const sara=await readExecutiveWorkFile({memberId:'abdulrahman',nameAr:'عبد الرحمن',role:'owner'},JSON.stringify({work_file_id:fileId,focus:'full',question:'السطوة3347343 — ما نتيجة مراجعة أريف وبينتوك، ومن يتولى الخطوة التالية؟'}));save('sara-state.json',sara);assert.ok(sara.found,'sara_file_not_found');assert.ok(JSON.stringify(sara).includes('3347343'),'sara_source_missing');
 const health=await readMailExecutionHealth(userId);save('mail-health.json',health);const mail=health.items.find(x=>Number(x.emailId)===emailId);assert.equal(mail?.state,'blocked_linkage_dispatch','unmapped_mail_must_remain_blocked');
 console.log(JSON.stringify({receipt,saraFound:sara.found,mailState:mail?.state,protectedStateUnchanged:true},null,2));
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1)});
