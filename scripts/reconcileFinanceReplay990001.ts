import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { getDb } from '../server/db';
import { isAuthenticatedAppOwner } from '../server/services/comoAppOwner';
import { appendEvent } from '../server/services/comoNextCommands';
import { readExecutiveWorkFile } from '../server/services/saraWorkFileReader';
import { DatabaseFinancePaymentFollowupStore, planFinancePaymentFollowup } from '../server/services/comoFinancePaymentFollowups';

const root='/home/ubuntu/reports/como-directive-990001-2026-10-20';
const expectedHash='ae7e2e8994742eec72de00e021ce30cec19d11a00492e1d7a31b99463b81c308';
const key='finance-payment-review-recorded:990001';
const title='الفلل الأربع — بانتظار تأكيد شاهد ونسرين تنفيذ دفعة أرتك5586';
const summary='الفلل الأربع — صولحت مراجعة مالية أُعيد فتحها بالخطأ: رد شاهدCOMO1950001 هو نفسه المفحوص في930001/المخرج3990001 وبالبصمة نفسها، وليس ردًا جديدًا أو تأكيد سداد. أُعيد انتظار900001 مع شاهد ونسرين دون وائل. لا بريد أو مسودة أو طلب صرف أو تغيير حالة5586.';
const rows=(r:any):any[]=>Array.isArray(r)&&Array.isArray(r[0])?r[0]:r;
const save=(name:string,value:unknown)=>fs.writeFileSync(`${root}/${name}.json`,JSON.stringify(value,null,2)+'\n');
const affected=(r:any)=>Number(r[0]?.affectedRows||0);

async function snapshot(db:any){
 const q=async(s:any)=>rows(await db.execute(s));
 return {
  directive:await q(sql`SELECT * FROM como_next_staged_directives WHERE id=990001`),
  dispatch:await q(sql`SELECT * FROM como_manus_dispatches WHERE directive_id=990001`),
  action:await q(sql`SELECT * FROM como_next_actions WHERE id=900001`),
  payments:await q(sql`SELECT * FROM como_next_lifecycle_lanes WHERE kind='payment' ORDER BY id`),
  pending:await q(sql`SELECT * FROM como_next_staged_directives WHERE status='pending' AND source_member_id<>'system:manus-action' ORDER BY id`),
  closed:await q(sql`SELECT * FROM como_next_work_files WHERE work_file_status IN ('closed','cancelled') ORDER BY id`),
  file:await q(sql`SELECT * FROM como_next_work_files WHERE id=390001`),
  otherActions:await q(sql`SELECT * FROM como_next_actions WHERE work_file_id=390001 AND id<>900001 ORDER BY id`),
  communications:await q(sql`SELECT * FROM como_next_communications WHERE work_file_id=390001 ORDER BY id`),
  ledger:await q(sql`SELECT * FROM como_mailbox_draft_ledger WHERE work_file_id=390001 ORDER BY id`),
  emails:await q(sql`SELECT * FROM como_next_email_messages WHERE user_id=1 AND linked_work_file_id=390001 ORDER BY id`),
  scenarios:await q(sql`SELECT * FROM cf_scenarios ORDER BY id`),
 };
}
function compareProtection(before:any,after:any){
 for(const field of ['pending','closed','file','otherActions','communications','ledger','emails','scenarios'])assert.deepEqual(after[field],before[field],`protected_${field}_changed`);
 const financial=(list:any[])=>list.map(p=>{
  if(p.user_id===1&&p.work_file_id===390001&&p.lane_key==='payment:5586'){
   const {next_action_title,next_owner_type,...kept}=p; return kept;
  }
  return p;
 });
 assert.deepEqual(financial(after.payments),financial(before.payments),'payment_business_state_changed');
}
async function trustedPrior(tx:any){
 const q=async(s:any)=>rows(await tx.execute(s));
 const [prior]=await q(sql`SELECT d.state,d.work_product_id,d.result_json,sd.user_id,sd.project_id,sd.work_file_id,sd.status AS directive_status,m.memory_type,m.source_status,m.source_system,m.source_record_id,m.project_id AS memory_project,m.work_file_id AS memory_file FROM como_manus_dispatches d JOIN como_next_staged_directives sd ON sd.id=d.directive_id JOIN como_next_work_memory m ON m.id=d.work_product_id WHERE d.directive_id=930001`);
 assert(prior&&prior.state==='completed'&&prior.directive_status==='submitted'&&Number(prior.user_id)===1&&Number(prior.project_id)===6&&Number(prior.work_file_id)===390001&&Number(prior.work_product_id)===3990001&&Number(prior.memory_project)===6&&Number(prior.memory_file)===390001&&prior.memory_type==='work_product'&&prior.source_status==='reviewed'&&prior.source_system==='como_mail_execution'&&prior.source_record_id==='dispatch-review:930001','prior_receipt_not_trusted');
 const receipt=JSON.parse(prior.result_json);
 assert(receipt.completedNow===true&&receipt.workProductId===3990001&&receipt.sourceEmailId===1950001&&receipt.bodySha256===expectedHash&&receipt.responseHandling?.kind==='draft_saved','prior_receipt_source_mismatch');
 const [email]=await q(sql`SELECT * FROM como_next_email_messages WHERE id=1950001 AND user_id=1 FOR UPDATE`);
 assert(email&&email.folder_name==='INBOX'&&email.inbox_status==='linked'&&Number(email.linked_work_file_id)===390001&&Number(email.linked_project_id)===6&&email.from_email==='shahid@zooma.ae'&&email.body_sha256===expectedHash&&createHash('sha256').update(email.body_text).digest('hex')===expectedHash,'reviewed_source_changed');
 return {prior,receipt,email};
}
async function main(){
 const mode=process.argv[2];assert(['--inspect','--apply','--verify'].includes(mode),'invalid_mode');
 const db=await getDb();assert(db,'database_unavailable');
 const [user]=rows(await db.execute(sql`SELECT * FROM users WHERE id=1`));
 assert(user&&await isAuthenticatedAppOwner(user),'app_owner_not_authorized');
 if(mode==='--inspect'){
  const before=await snapshot(db); const d=before.directive[0],x=before.dispatch[0],a=before.action[0];
  assert(d&&d.user_id===1&&d.project_id===6&&d.work_file_id===390001&&d.action_id===900001&&d.source_member_id==='system:manus-action'&&d.status==='submitting','directive_authority_changed');
  assert(x&&x.state==='delivered'&&!x.claim_token&&!x.started_at,'dispatch_already_claimed');
  assert(a&&a.action_status==='open'&&a.source_system==='finance_payment_watch'&&a.source_record_id==='sent-email-1110002','watch_action_changed');
  await db.transaction(async tx=>{await tx.execute(sql`SELECT id FROM como_next_work_files WHERE id=390001 FOR UPDATE`);await trustedPrior(tx);});
  save('safety-current-before',before); console.log('990001: سلطةCOMO والمصدر والإيصال السابق والحماية مطابقة؛ لم يحدث تعديل.'); return;
 }
 if(mode==='--apply'){
  const result=await db.transaction(async tx=>{
   const q=async(s:any)=>rows(await tx.execute(s));
   const [file]=await q(sql`SELECT * FROM como_next_work_files WHERE id=390001 AND user_id=1 AND project_id=6 FOR UPDATE`);
   assert(file&&!['closed','cancelled'].includes(file.work_file_status),'active_file_required');
   const [d]=await q(sql`SELECT * FROM como_next_staged_directives WHERE id=990001 FOR UPDATE`);
   const [dispatch]=await q(sql`SELECT * FROM como_manus_dispatches WHERE directive_id=990001 FOR UPDATE`);
   assert(d&&d.user_id===1&&d.project_id===6&&d.work_file_id===390001&&d.action_id===900001&&d.source_member_id==='system:manus-action','directive_authority_changed');
   const [existing]=await q(sql`SELECT * FROM como_next_work_file_events WHERE user_id=1 AND work_file_id=390001 AND idempotency_key=${key}`);
   if(existing){
    const receipt=JSON.parse(existing.payload_json);
    assert(dispatch.state==='completed'&&d.status==='submitted'&&Number(dispatch.work_product_id)===receipt.workProductId&&Number(d.work_product_id)===receipt.workProductId,'partial_receipt_requires_recovery');
    return {replayed:true,receipt};
   }
   assert(dispatch.state==='running'&&String(dispatch.claim_token).startsWith('worker:')&&d.status==='submitting','dispatch_not_claimed');
   const [action]=await q(sql`SELECT * FROM como_next_actions WHERE id=900001 AND user_id=1 AND project_id=6 AND work_file_id=390001 FOR UPDATE`);
   assert(action&&action.owner_type==='manus'&&action.action_status==='open'&&action.source_system==='finance_payment_watch'&&action.source_record_id==='sent-email-1110002','watch_action_changed');
   await trustedPrior(tx);
   const [lane]=await q(sql`SELECT * FROM como_next_lifecycle_lanes WHERE user_id=1 AND project_id=6 AND work_file_id=390001 AND lane_key='payment:5586' AND kind='payment' FOR UPDATE`);
   assert(lane&&lane.status==='waiting_external'&&Number(lane.next_action_id)===900001,'payment_wait_changed');
   const inserted:any=await tx.execute(sql`INSERT INTO como_next_work_memory (project_id,work_file_id,memory_type,entry_type,title,body,source_status,source_system,source_record_id,is_current,occurred_at) VALUES (6,390001,'work_product','finance_payment_review_replay',${'الفلل الأربع — مصالحة تكرار مراجعة دفعة أرتك5586'},${summary+'\nالمصدر1950001؛ SHA-256='+expectedHash+'؛ إيصال930001/3990001 محفوظ. شكر شاهد أُرسل بإفادة عبد الرحمن20أكتوبر؛ لا إعادة شكر أو صرف. انتظار التأكيد مع شاهد ونسرين فقط، ولا علاقة بمسار المخططات المتوقف أو بدءRawan.'},'reviewed','como_finance_payment_review','dispatch-finance-watch:990001',1,UTC_TIMESTAMP())`);
   const workProductId=Number(inserted[0].insertId);assert(workProductId>0,'work_product_not_saved');
   const receipt={directiveId:990001,workProductId,completedNow:true,reviewCompleted:true,replayReconciled:true,priorDirectiveId:930001,priorWorkProductId:3990001,sentEmailId:1110002,reviewedReplies:[{emailId:1950001,sha256:expectedHash}],nextActionId:900001,paymentStatus:'waiting_external',paymentChanged:false,paymentRequestCreated:false,communicationDraftId:null,mailboxDraftRef:null,sent:false,externalSideEffect:false,executionSummary:summary};
   const changed=await tx.execute(sql`UPDATE como_next_actions SET title=${title},description=${'الفلل الأربع — رد شاهد19أكتوبرCOMO1950001 سبق فحصه وتوثيقه في930001/3990001. ننتظر تأكيد تنفيذ فاتورة أرتك5586 من شاهد ونسرين؛ عبد الرحمن أرسل المتابعة والشكر بحسب الأدلة المحفوظة وإفادته. لا إقحام وائل أو إعادة طلب موافقته. لا سداد مثبت ولا طلب صرف أو وثائق أو مسودة جديدة.'},acceptance_criteria=${'تأكيد صريح لتنفيذ دفعة أرتك5586 أو إيصال دفع مرتبط بها؛ الوعد أو طلب الصرف أو الفاتورة لا يثبت السداد. أي رد جديد يحتاج فحصManus منفصلًا.'},owner_type='team',owner_user_id=NULL,waiting_project_party_id=NULL,action_status='waiting_external',due_at=NULL,follow_up_at=NULL,attention_at=NULL,completed_at=NULL,verified_at=NULL,evidence_reference=${'مصالحة990001؛ ردCOMO1950001 وبصمته المطابقة؛ المراجعة930001/3990001؛ انتظار شاهد ونسرين، السداد غير مثبت'} WHERE id=900001 AND user_id=1 AND source_system='finance_payment_watch' AND action_status='open'`);
   assert(affected(changed)===1,'watch_action_claim_lost');
   await tx.execute(sql`UPDATE como_next_lifecycle_lanes SET next_action_title=${title},next_owner_type='team' WHERE id=${Number(lane.id)} AND status='waiting_external' AND next_action_id=900001`);
   const json=JSON.stringify(receipt);
   const finished=await tx.execute(sql`UPDATE como_manus_dispatches SET state='completed',work_product_id=${workProductId},execution_summary=${summary},result_json=${json},next_action_id=900001,communication_draft_id=NULL,mailbox_draft_ref=NULL,completed_at=UTC_TIMESTAMP(),last_progress_at=UTC_TIMESTAMP(),error=NULL WHERE directive_id=990001 AND state='running' AND claim_token=${dispatch.claim_token}`);
   assert(affected(finished)===1,'dispatch_claim_lost');
   await tx.execute(sql`UPDATE como_next_staged_directives SET status='submitted',work_product_id=${workProductId},execution_summary=${summary},result_json=${json},submitted_at=UTC_TIMESTAMP(),failure_message=NULL,communication_draft_id=NULL,mailbox_draft_ref=NULL WHERE id=990001 AND user_id=1 AND status='submitting'`);
   await appendEvent(tx,{userId:1,projectId:6,workFileId:390001,actionId:900001,actorType:'manus',actorUserId:null,eventType:'finance_payment_review_recorded',summary,payload:JSON.parse(json),idempotencyKey:key});
   return {replayed:false,receipt};
  });
  save(result.replayed?'replay-receipt':'application-receipt',result); console.log(JSON.stringify(result,null,2)); return;
 }
 const after=await snapshot(db),before=JSON.parse(fs.readFileSync(root+'/safety-current-before.json','utf8'));
 compareProtection(before,after);
 assert(after.dispatch[0].state==='completed'&&after.directive[0].status==='submitted'&&after.action[0].action_status==='waiting_external'&&after.action[0].owner_type==='team','completion_or_wait_not_saved');
 const source=after.emails.find((e:any)=>e.id===1110002),reply=after.emails.find((e:any)=>e.id===1950001);
 const sent={id:source.id,userId:source.user_id,projectId:source.linked_project_id,workFileId:source.linked_work_file_id,workFileStatus:after.file[0].work_file_status,mailboxKey:source.mailbox_key,folderName:source.folder_name,fromEmail:source.from_email,toText:source.to_text,ccText:source.cc_text,subject:source.subject,bodyText:source.body_text,sentAt:source.received_at,messageId:source.message_id};
 const planned=planFinancePaymentFollowup(sent);assert('plan' in planned,'watch_plan_unavailable');
 const noReopen=await new DatabaseFinancePaymentFollowupStore().openFinanceReview({action:{id:900001,userId:1,projectId:6,workFileId:390001,actionStatus:'waiting_external'},plan:planned.plan,replies:[{id:1950001,fromEmail:reply.from_email,subject:reply.subject,bodyText:reply.body_text,bodySha256:reply.body_sha256,receivedAt:reply.received_at,linkedWorkFileId:390001}]});
 assert(noReopen===false,'reviewed_reply_reopened');
 const afterGuard=await snapshot(db);assert.deepEqual(afterGuard,after,'guard_replay_mutated_state');
 const sara:any=await readExecutiveWorkFile({memberId:'abdulrahman',nameAr:'عبد الرحمن',role:'owner'},JSON.stringify({work_file_id:390001,focus:'overview',question:'حالة انتظار تأكيد شاهد ونسرين تنفيذ دفعة أرتك5586 ومصالحة مراجعة990001'}));
 assert(sara.found===true,'sara_file_not_found');
 assert(sara.currentState.actions.some((a:any)=>Number(a.id)===900001&&a.status==='waiting_external'&&a.ownerType==='team'),'sara_wait_missing');
 assert(!sara.currentState.actions.some((a:any)=>Number(a.id)===900001&&a.status==='open'),'sara_review_still_open');
 assert(sara.currentState.stagedDirectives.some((d:any)=>Number(d.id)===990001&&d.completed===true),'sara_receipt_missing');
 save('after',afterGuard);save('sara-state',sara);
 save('verification',{checkedAt:new Date().toISOString(),directiveCompleted:true,waitingActionId:900001,waitingWith:['شاهد','نسرين'],saraFound:true,saraReceiptVisible:true,payment5586Status:'waiting_external',paymentBusinessStateUnchanged:true,otherVillaActionsUnchanged:true,ownerPendingUnchanged:true,communicationsAndDraftLedgerUnchanged:true,sourceEmailsUnchanged:true,closedFilesAndScenariosUnchanged:true,guardReplayReturnedFalse:true,guardReplayNoMutation:true});
 console.log('الفلل الأربع — الإيصال مكتمل، انتظار شاهد ونسرين محفوظ، حارس الرد1950001 لم يُعد فتح المراجعة، والحماية وسارة ناجحتان.');
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e instanceof Error?e.message:'reconciliation_failed');process.exit(1);});
