import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {eq,sql} from 'drizzle-orm';
import {getDb} from '../server/db';
import {comoNextEmailMessages} from '../drizzle/schema';
import {appendEvent,createCommunicationDraftCommand,requireProjectAccess} from '../server/services/comoNextCommands';
import {confirmValidatedSentLineageCommand} from '../server/services/comoNextEmailInbox';
import {applyComoCcPolicy,fetchReadonlyFolderSince,getConfiguredMailboxAddress} from '../server/emailMonitor';
import {readExecutiveWorkFile} from '../server/services/saraWorkFileReader';
const root='/home/ubuntu/reports/como-directive-1080001-2026-10-26';
const hash=(v:string|Buffer)=>createHash('sha256').update(v).digest('hex');
const canonicalEnvelopeHash=(v:string)=>hash([...new Set(String(v||'').toLowerCase().match(/[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+/gi)||[])].sort().join(','));
const norm=(v:string)=>v.replace(/\r\n?/g,'\n').trim();
const key='email-reply-draft:2190001';
const sourceSha='1fd0a6857cfba2575e6b725735bfb4b6bcc3b0606a77ba7018898cef279de2e0';
const body=`Dear Mr. Ahmad,

Thank you for your follow-up.

We are reviewing the documents provided and the payment position for Project 1641A internally. We cannot confirm a payment date at this stage and will revert with an update once the review is concluded.

Kind regards,
Abdalrahman Zaqout
Development Director
COMO Real Estate Development L.L.C
M: +971 55 106 2668
E: a.zaqout@comodevelopments.com`;
const save=(name:string,value:unknown)=>fs.writeFileSync(root+'/'+name+'.json',JSON.stringify(value,null,2)+'\n');
async function main(){
 const db=await getDb();assert(db);await requireProjectAccess(db,1,1,'write');
 const q=async(s:any)=>(await db.execute(s))[0] as any[];
 const [authority]=await q(sql`SELECT sd.*,d.state,d.claim_token FROM como_next_staged_directives sd JOIN como_manus_dispatches d ON d.directive_id=sd.id WHERE sd.id=1080001 AND sd.user_id=1`);
 assert(authority);assert.equal(authority.source_member_id,'system:manus-action');assert.equal(authority.action_id,2250001);assert.equal(authority.work_file_id,630001);assert.equal(authority.stage_key,'system-manus-action:2250001');assert(authority.directive_text.includes(sourceSha));
 if(authority.result_json){const r=JSON.parse(authority.result_json);if(r.kind==='satwa_followup_review_mapping_blocked'){console.log(JSON.stringify({replayed:true,receipt:r}));return;}}
 assert.equal(authority.status,'submitting');assert.equal(authority.state,'running');assert(authority.claim_token?.startsWith('worker:'));
 const [source]=await q(sql`SELECT * FROM como_next_email_messages WHERE id=2190001 AND user_id=1`);assert.equal(source.body_sha256,sourceSha);assert.equal(source.linked_work_file_id,null);
 const proof=JSON.parse(fs.readFileSync(root+'/live-proof.json','utf8'));assert(Date.now()-Date.parse(proof.checkedAt)<15*60_000);assert.equal(hash(proof.source.textBody.trim().slice(0,1_000_000)),sourceSha);
 assert.equal(proof.source.messageId,source.message_id);assert.equal(proof.source.attachments.length,1);assert.equal(hash(fs.readFileSync(proof.source.attachments[0].file)),proof.source.attachments[0].sha256);
 const [ledger]=await q(sql`SELECT * FROM como_mailbox_draft_ledger WHERE id=780001 AND communication_id=2910001 AND user_id=1 AND work_file_id=630001`);
 const [old]=await q(sql`SELECT * FROM como_next_communications WHERE id=2910001 AND user_id=1 AND work_file_id=630001`);
 const [oldSource]=await q(sql`SELECT message_id FROM como_next_email_messages WHERE id=2010001 AND user_id=1`);
 const sent=proof.sent.messages.filter((m:any)=>hash(norm(m.textBody))===ledger.body_sha256&&hash(norm(m.subject))===ledger.subject_sha256&&canonicalEnvelopeHash(m.to)===ledger.to_envelope_sha256&&canonicalEnvelopeHash(m.cc)===ledger.cc_envelope_sha256);
 assert.equal(sent.length,1);assert.equal(sent[0].uid,229);assert.equal(sent[0].from,getConfiguredMailboxAddress());assert(new Date(sent[0].date).getTime()>=Date.parse(ledger.created_at.replace(' ','T')+'Z'));assert(String(sent[0].headers.references).includes(oldSource.message_id));
 assert.equal(hash(norm(old.body)),ledger.body_sha256);assert(!proof.drafts.messages.some((m:any)=>m.uid===962||m.headers?.['x-como-draft-key']===ledger.draft_key));
 const [storedSent]=await db.select().from(comoNextEmailMessages).where(eq(comoNextEmailMessages.id,2040001));assert(storedSent);assert.equal(storedSent.imapUid,229);assert.equal(storedSent.messageId,sent[0].messageId);assert.equal(norm(storedSent.bodyText),norm(sent[0].textBody));
 const sentConfirmation=await confirmValidatedSentLineageCommand({userId:1,mailboxKey:ledger.mailbox_key,ownerMailbox:getConfiguredMailboxAddress(),email:storedSent,lineage:{kind:'validated',ledgerId:780001,projectId:1,workFileId:630001,communicationId:2910001}});assert.equal(sentConfirmation.kind,'confirmed');save('prior-sent-confirmation',sentConfirmation);
 const protectedState=async()=>({payments:await q(sql`SELECT * FROM como_next_lifecycle_lanes WHERE kind='payment' ORDER BY id`),pending:await q(sql`SELECT * FROM como_next_staged_directives WHERE status='pending' ORDER BY id`),projects:await q(sql`SELECT id,name,plotNumber FROM projects ORDER BY id`),files:await q(sql`SELECT id,work_file_status FROM como_next_work_files ORDER BY id`)});
 const before=await protectedState();save('protected-application-before',before);assert(!before.projects.some(p=>String(p.plotNumber)==='3347343'||/satwa|السطوة/i.test(p.name)));
 const [owner]=await q(sql`SELECT * FROM como_next_actions WHERE id=2070001 AND user_id=1 AND work_file_id=630001 AND owner_type='human'`);assert(owner&&owner.action_status==='open');
 const [wait]=await q(sql`SELECT * FROM como_next_actions WHERE id=2040001 AND user_id=1 AND work_file_id=630001`);assert.equal(wait.action_status,'waiting_external');
 const alreadyAnswered=proof.sent.messages.filter((m:any)=>new Date(m.date).getTime()>=new Date(proof.source.date).getTime()&&String(m.subject).includes('1641A'));assert.equal(alreadyAnswered.length,0);
 const newCC=applyComoCcPolicy({to:source.from_email,cc:source.cc_text});
 let draft:any;
 if(fs.existsSync(root+'/draft-save.json'))draft=JSON.parse(fs.readFileSync(root+'/draft-save.json','utf8'));
 else{draft=await createCommunicationDraftCommand({userId:1,workFileId:630001,channel:'email',subject:source.subject,body,toText:source.from_email,ccText:newCC,sourceEmailId:2190001,idempotencyKey:key});save('draft-save',draft);}
 assert(!draft.mailboxDraft?.observedInSent);
 const [drafts,sentAfter]=await Promise.all([fetchReadonlyFolderSince('Drafts',24*30,100,undefined,'1641A'),fetchReadonlyFolderSince('Sent',24*14,100,undefined,'1641A')]);
 const current=drafts.messages.filter(m=>m.headers?.['x-como-draft-key']===key);assert.equal(current.length,1);const m=current[0];assert.equal(norm(m.textBody),body);assert.equal(m.subject,source.subject);assert.equal(canonicalEnvelopeHash(m.to),canonicalEnvelopeHash(source.from_email));assert.equal(canonicalEnvelopeHash(m.cc),canonicalEnvelopeHash(newCC));assert.equal(m.headers?.['in-reply-to'],source.message_id);assert(String(m.headers?.references).includes(source.message_id));assert(!sentAfter.messages.some(s=>s.messageId===m.messageId||s.headers?.['x-como-draft-key']===key));assert.equal(drafts.messages.length,1,'duplicate_satwa_draft');save('verified-draft',{uidValidity:drafts.uidValidity,...m,sent:false});
 const ref=`Drafts UID ${m.uid}`;
 const blocker='السطوة3347343 غير مسجلة فيCOMO، وصفةCOMO التعاقدية لم تثبت؛ الفاتورة السابقة باسمHazar Akay. لا ربط بماجان أو الفلل ولا استنتاج موقف دفع.';
 const summary=`السطوة — راجع Manus متابعة أحمد2190001/26أكتوبر10:11دبي والخيط والمرفق الوحيد (شعار). يسأل عن حالة وموعددفعة1641A؛ لا فاتورة أو مهلة جديدة. ثبت استلامالوثائق السابق2910001/مسودة962 فيSent229/20أكتوبر18:13دبي؛ لم يُعد. رد جديد واحد ${ref} على سؤال اليوم إلىأحمد وCCالمصدر ووائل؛ لم يُرسل، لا إقرار بالمطالبة أو وعد دفع. المطابقة غير مكتملة: ${blocker} يبقى بندعبدالرحمن2070001 لتحديدالتبعية ومراجعةالرد، وانتظارManus2040001 فقط لاستكمالالربط والفحصالتعاقدي بعدحسمها.`;
 const report=`السطوة — مراجعةمتابعةCOMO2190001\n\n${summary}\n\nالمصدر SHA-256=${sourceSha}. مقارنةالهوية:السّطوة/3347343/1641A/أحمدمنأريفوبينتوك ثابتة؛ الربطبملفمشروعمسجلغيرمتاح. 420000درهم مطالبةاستشاريقديمة حسبمراجعة4020001، لا فاتورةاليومأودليلدفع. مهلة28سبتمبر2026 مقتبسةقديمًا وليست مهلةجديدة. ردعبدالرحمن22سبتمبرالمقتبس مثبت؛ لا نسبةتجاهلإليه. المرفقimage001شعارفقط،فُحصبصريًا، SHA-256=${proof.source.attachments[0].sha256}.\n\nحفظالمصادر فيالوعاء630001 لايغيّرالتصنيفولاينشئمشروعًا. مراجعةالمتابعةوالردأنجزا؛ مطابقةالمشروعوتثبيتالموقفالتعاقديغيرمكتملين. لااستخدامcompleteDispatchedMailLinkageReviewبهدفمحايدأوتخميني.\n\nرد اليوم المحفوظ، لم يرسل:\n${body}`;
 const receipt=await db.transaction(async tx=>{
  await tx.execute(sql`SELECT id FROM como_next_work_files WHERE id=630001 AND user_id=1 FOR UPDATE`);
  const [live]=(await tx.execute(sql`SELECT sd.status,d.state,d.claim_token FROM como_next_staged_directives sd JOIN como_manus_dispatches d ON d.directive_id=sd.id WHERE sd.id=1080001 FOR UPDATE`))[0] as any[];assert.equal(live.state,'running');assert.equal(live.status,'submitting');assert.equal(live.claim_token,authority.claim_token);
  const [fresh]=(await tx.execute(sql`SELECT body_sha256,linked_work_file_id FROM como_next_email_messages WHERE id=2190001 AND user_id=1 FOR UPDATE`))[0] as any[];assert.equal(fresh.body_sha256,sourceSha);assert.equal(fresh.linked_work_file_id,null);
  const inserted:any=await tx.execute(sql`INSERT INTO como_next_work_memory(project_id,work_file_id,memory_type,entry_type,title,body,source_status,is_current,source_system,source_record_id,occurred_at) VALUES(1,630001,'work_product','mail_linkage_blocker','السطوة — مراجعة متابعة26أكتوبر وإرسَال الاستلام السابق المثبت',${report},'source_reviewed_mapping_blocked',1,'como_mail_execution','satwa-followup-review:1080001',UTC_TIMESTAMP())`);const workProductId=Number(inserted[0].insertId);
  const r={kind:'satwa_followup_review_mapping_blocked',directiveId:1080001,sourceEmailId:2190001,sourceBodySha256:sourceSha,completed:false,reviewCompleted:true,matchingCompleted:false,workProductId,neutralIntakeWorkFileId:630001,targetProjectId:null,targetWorkFileId:null,priorSentEmailId:2040001,priorSentUid:229,priorDraftUid:962,priorCommunicationId:2910001,communicationDraftId:Number(draft.id),mailboxDraftRef:ref,mailboxDraftUid:m.uid,ownerActionId:2070001,waitingActionId:2040001,blocker,summary,newInvoice:false,newDeadline:false,acceptedDebt:false,paymentStatusChanged:false,sent:false,checkedAt:new Date().toISOString()};
  await tx.execute(sql`UPDATE como_next_actions SET title='السطوة — مراجعة متابعة26أكتوبر والرد عليها محفوظ؛ الربط معلق في2040001',description=${summary},action_status='verified',completed_at=UTC_TIMESTAMP(),verified_at=UTC_TIMESTAMP(),evidence_reference=${`مراجعةمصدر${workProductId}; مطابقةغيرمكتملةومجمعةفي2040001; ${ref}`} WHERE id=2250001 AND user_id=1 AND action_status='open' AND source_system='como_mail_linkage'`);
  await tx.execute(sql`UPDATE como_next_actions SET title='السطوة — عبد الرحمن: مراجعة رد المتابعة وموقف المطالبة وتحديد تبعية المشروع',description=${summary},evidence_reference=${`المصدر2190001; مخرج${workProductId}; الردالجديد${ref}; استلامالوثائق السابقSent229`} WHERE id=2070001 AND user_id=1 AND action_status='open'`);
  await tx.execute(sql`UPDATE como_next_actions SET description=${`السطوة — انتظار تحديدعبدالرحمنتبعية3347343ومراجعةالردالجديد${ref} في2070001؛ ثم Manusيربطالمصادرويفحصالعقدوقبولالتغييروالمخرجات. المتابعة2190001فُحصتومطالبة420000لمتُقبلأوتتحولسدادًا.`},evidence_reference=${`مراجعتا4020001و${workProductId}; الربطغيرمكتمل`} WHERE id=2040001 AND user_id=1 AND action_status='waiting_external'`);
  await tx.execute(sql`UPDATE como_next_email_messages SET reply_draft_communication_id=${Number(draft.id)} WHERE id=2190001 AND user_id=1 AND body_sha256=${sourceSha}`);
  await tx.execute(sql`UPDATE como_next_staged_directives SET status='failed',work_product_id=${workProductId},communication_draft_id=${Number(draft.id)},mailbox_draft_ref=${ref},execution_summary=${summary},result_json=${JSON.stringify(r)},failure_message=${blocker} WHERE id=1080001 AND user_id=1 AND status='submitting'`);
  await tx.execute(sql`UPDATE como_manus_dispatches SET state='failed',last_progress_at=UTC_TIMESTAMP(),error=${blocker},execution_summary=${summary},result_json=${JSON.stringify(r)},work_product_id=${workProductId},communication_draft_id=${Number(draft.id)},mailbox_draft_ref=${ref},next_action_id=2070001 WHERE directive_id=1080001 AND state='running' AND claim_token=${authority.claim_token}`);
  await appendEvent(tx,{userId:1,projectId:1,workFileId:630001,actionId:2250001,actorType:'manus',actorUserId:null,eventType:'mail_linkage_review_blocked',summary,payload:{...r,externalSideEffect:false},idempotencyKey:'satwa-followup-review:1080001'});
  return r;
 });save('review-receipt',receipt);
 const after=await protectedState();save('protected-application-after',after);assert.deepEqual(after,before,'protected_state_changed');
 const sara:any=await readExecutiveWorkFile({memberId:'abdulrahman',nameAr:'عبد الرحمن',role:'owner'},JSON.stringify({work_file_id:630001,focus:'full',question:'السطوة:متابعة26أكتوبر2190001والردالجديد وإرسال962المثبت وماعلىعبدالرحمنوManus؟'}));save('sara-state',sara);assert(sara.found);assert(JSON.stringify(sara).includes(ref));
 console.log(JSON.stringify({receipt,saraFound:sara.found,protectedStateUnchanged:true},null,2));
 await (db as any).$client.end();
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1)});
