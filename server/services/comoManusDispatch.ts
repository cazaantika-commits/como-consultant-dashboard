import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { ENV } from '../_core/env';
import { getDb } from '../db';
import { matchesAuthenticatedAppOwner } from './comoAppOwner';
import { appendEvent, requireProjectAccess } from './comoNextCommands';
import { executeExecutiveDirectiveCommand } from './comoNextExecutiveDirectives';

export type ComoManusDispatchState='queued'|'delivered'|'running'|'completed'|'failed'|'delivery_unknown';
type DispatchRow={id:number|string;directiveId:number|string;state:ComoManusDispatchState;queuedAt:string|null;deliveredAt:string|null;startedAt:string|null;lastProgressAt:string|null;completedAt:string|null;deliveryAttempts:number|string;error:string|null;claimToken:string|null;executionSummary:string|null;resultJson:string|null;updateId:number|string|null;communicationDraftId:number|string|null;mailboxDraftRef:string|null;workProductId:number|string|null;nextActionId:number|string|null;targetMetadata:string};
type Db=NonNullable<Awaited<ReturnType<typeof getDb>>>;
const nowSql=()=>new Date().toISOString().slice(0,19).replace('T',' ');
const rowsFrom=<T>(v:any):T[]=>Array.isArray(v)&&Array.isArray(v[0])?v[0]:v;
const affectedRows=(v:any)=>Number((Array.isArray(v)?v[0]:v)?.affectedRows||0);
const asNumber=(v:unknown)=>v==null?null:Number(v);
const SAFE_ERROR_CODES=new Set(['dispatch_webhook_not_configured','dispatch_webhook_rejected','dispatch_delivery_unknown','dispatch_execution_failed','dispatch_payment_precondition_failed','dispatch_not_completed']);
function safeError(v:string|null|undefined){return v&&SAFE_ERROR_CODES.has(v)?v:v?'dispatch_execution_failed':null;}
function safeFailureMessage(v:string|null|undefined){return ({dispatch_webhook_not_configured:'قناة تنفيذ Manus غير مهيأة؛ لم يُسلّم التوجيه.',dispatch_webhook_rejected:'رفضت قناة التنفيذ طلب التسليم؛ لم يبدأ التنفيذ.',dispatch_delivery_unknown:'التسليم غير مؤكد؛ لن نكرر الطلب تلقائيًا.',dispatch_execution_failed:'توقف التنفيذ؛ يجب مصالحة الأثر السابق قبل إعادة التنفيذ.',dispatch_payment_precondition_failed:'إفادة السداد محفوظة، لكن مطابقة الفاتورة أو الدليل تحتاج مراجعة Manus قبل إغلاق الإجراء المالي.',dispatch_not_completed:'استلم Manus الطلب؛ ما زال العمل الإضافي مطلوبًا وليس إنجازًا.'} as Record<string,string>)[safeError(v)||'']||null;}
function canClaimDispatchForWorker(i:{state:ComoManusDispatchState;claimToken:string|null;directiveStatus:string;ownerApproved:boolean}){return i.ownerApproved&&i.directiveStatus==='submitting'&&(!i.claimToken||i.claimToken.startsWith('delivery:'))&&['queued','delivered','delivery_unknown'].includes(i.state);}
function canRetryKnownUndeliveredDispatch(i:{state:ComoManusDispatchState;claimToken:string|null;error?:string|null}){return !i.claimToken&&(i.state==='queued'||(i.state==='failed'&&['dispatch_webhook_not_configured','dispatch_webhook_rejected'].includes(i.error||'')));}
function hasCompletedFulfillment(i:{completedNow?:boolean|null;workProductId?:number|null;communicationDraftId?:number|null;mailboxDraftRef?:string|null}){return Boolean(i.completedNow||i.workProductId||i.mailboxDraftRef);}
function delayFor(row:Pick<DispatchRow,'state'|'queuedAt'|'lastProgressAt'|'startedAt'>){const reference=row.lastProgressAt||row.startedAt||row.queuedAt;const parsed=reference?Date.parse(/Z$|[+-]\d{2}:?\d{2}$/i.test(reference)?reference:`${reference.replace(' ','T')}Z`):NaN;const ageMs=Number.isFinite(parsed)?Math.max(0,Date.now()-parsed):null;return {detected:ageMs!=null&&['queued','delivered','running'].includes(row.state)&&ageMs>=120_000,ageSeconds:ageMs==null?null:Math.floor(ageMs/1000)};}
function publicDispatch(row:DispatchRow){const delay=delayFor(row);const labels:Record<ComoManusDispatchState,string>={queued:'في طابور التسليم؛ الوصول غير مؤكد بعد',delivered:'وصل الطلب إلى Manus؛ النتيجة المكتملة لم تصل بعد',running:'Manus ينفذ التوجيه الآن',completed:'اكتمل التنفيذ وحُفظت النتيجة',failed:'توقف التنفيذ؛ السبب محفوظ في الملف',delivery_unknown:'التسليم غير مؤكد؛ لا إعادة تلقائية'};return {id:Number(row.id),directiveId:Number(row.directiveId),status:row.state,state:row.state,executionState:row.state,label:labels[row.state],delayed:delay.detected,delay,queuedAt:row.queuedAt,deliveredAt:row.deliveredAt,startedAt:row.startedAt,lastProgressAt:row.lastProgressAt,completedAt:row.completedAt,deliveryAttempts:Number(row.deliveryAttempts),error:safeError(row.error),failureMessage:safeFailureMessage(row.error),executionSummary:row.executionSummary,updateId:asNumber(row.updateId),communicationDraftId:asNumber(row.communicationDraftId),mailboxDraftRef:row.mailboxDraftRef,workProductId:asNumber(row.workProductId),nextActionId:asNumber(row.nextActionId)};}
const selectColumns=sql`d.id,d.directive_id AS directiveId,d.state,d.queued_at AS queuedAt,d.delivered_at AS deliveredAt,d.started_at AS startedAt,d.last_progress_at AS lastProgressAt,d.completed_at AS completedAt,d.delivery_attempts AS deliveryAttempts,d.error,d.claim_token AS claimToken,d.execution_summary AS executionSummary,d.result_json AS resultJson,d.update_id AS updateId,d.communication_draft_id AS communicationDraftId,d.mailbox_draft_ref AS mailboxDraftRef,d.work_product_id AS workProductId,d.next_action_id AS nextActionId,d.target_metadata AS targetMetadata`;
async function readRow(db:any,directiveId:number){return rowsFrom<DispatchRow>(await db.execute(sql`SELECT ${selectColumns} FROM como_manus_dispatches d WHERE d.directive_id=${directiveId} LIMIT 1`))[0]||null;}
async function configUrl(db:Db){const env=process.env.COMO_MANUS_DISPATCH_WEBHOOK_URL?.trim();const config=rowsFrom<{webhookUrl:string|null}>(await db.execute(sql`SELECT webhook_url AS webhookUrl FROM como_manus_dispatch_config WHERE id=1 LIMIT 1`))[0];try{const u=new URL(env||config?.webhookUrl||'');return u.protocol==='https:'&&u.hostname==='api.manus.im'&&u.pathname.startsWith('/api/webhook/triggers/')?u.toString():null}catch{return null}}
export async function readDispatchForDirective(input:{directiveId:number}){const db=await getDb();if(!db)return null;const r=await readRow(db,input.directiveId);return r?publicDispatch(r):null;}
export async function readDispatchesForUser(input:{userId:number;directiveIds?:number[]}){const db=await getDb();if(!db)return [];const wanted=input.directiveIds?.length?new Set(input.directiveIds):null;const r=rowsFrom<DispatchRow>(await db.execute(sql`SELECT ${selectColumns} FROM como_manus_dispatches d JOIN como_next_staged_directives sd ON sd.id=d.directive_id WHERE sd.user_id=${input.userId} ORDER BY d.updated_at DESC,d.id DESC LIMIT 160`));return r.filter(x=>!wanted||wanted.has(Number(x.directiveId))).map(publicDispatch);}
export async function isManusDispatchConfigured(){const db=await getDb();return Boolean(db&&await configUrl(db));}
export async function assertDirectiveNotPreviouslyExecuted(input:{userId:number;directiveId:number}){const db=await getDb();if(!db)throw new Error('database_unavailable');const source=rowsFrom<any>(await db.execute(sql`SELECT user_id FROM como_next_staged_directives WHERE id=${input.directiveId}`))[0];if(!source||Number(source.user_id)!==input.userId)throw new Error('directive_not_authorized');const r=await readRow(db,input.directiveId);if(r&&(r.startedAt||r.updateId||r.claimToken||['delivered','running','completed','delivery_unknown'].includes(r.state)))throw new Error('لا يمكن تعديل أو إلغاء توجيه وصل إلى التنفيذ؛ يلزم توجيه تصحيح جديد يحفظ الأثر السابق.');}

/** File lock precedes directive/outbox lock throughout the lifecycle. No network in TX. */
export async function claimSubmittingAndQueueManusDispatch(input:{directiveId:number;userId:number;workFileId:number}){
 const db=await getDb();if(!db)throw new Error('database_unavailable');
 const [file]=rowsFrom<any>(await db.execute(sql`SELECT project_id FROM como_next_work_files WHERE id=${input.workFileId}`));if(!file)throw new Error('work_file_missing');await requireProjectAccess(db,Number(file.project_id),input.userId,'write');
 return db.transaction(async tx=>{
  await tx.execute(sql`SELECT id FROM como_next_work_files WHERE id=${input.workFileId} FOR UPDATE`);
  const source=rowsFrom<any>(await tx.execute(sql`SELECT * FROM como_next_staged_directives WHERE id=${input.directiveId} AND user_id=${input.userId} AND work_file_id=${input.workFileId} FOR UPDATE`))[0];
  const existing=await readRow(tx,input.directiveId);
  const answer=(kind:string,shouldDeliver=false)=>({kind,dispatch:existing?publicDispatch(existing):null,shouldDeliver});
  if(!source)return answer('not_found');if(source.status==='submitted')return answer('submitted');
  if(existing?.state==='delivery_unknown')return answer('delivery_unknown');
  if(existing&&(existing.startedAt||existing.updateId||existing.claimToken||['delivered','running','completed'].includes(existing.state)))return answer('existing');
  if(!['pending','failed','submitting'].includes(source.status))return answer('not_submittable');
  if(existing&&!canRetryKnownUndeliveredDispatch(existing))return answer('not_submittable');
  await tx.execute(sql`UPDATE como_next_staged_directives SET status='submitting',submission_claimed_at=UTC_TIMESTAMP(),failure_message=NULL WHERE id=${input.directiveId} AND user_id=${input.userId}`);
  if(existing){await tx.execute(sql`UPDATE como_manus_dispatches SET state='queued',error=NULL,claim_token=NULL WHERE directive_id=${input.directiveId} AND claim_token IS NULL AND started_at IS NULL`);const r=await readRow(tx,input.directiveId);return {kind:'existing',dispatch:r?publicDispatch(r):null,shouldDeliver:true};}
  await tx.execute(sql`INSERT INTO como_manus_dispatches (directive_id,state,target_metadata) VALUES (${input.directiveId},'queued',${JSON.stringify({target:'current_task',taskId:'Z5M4haoQEFjYNC6L3vkWhu',eventType:'como.manus.dispatch.v1',workFileId:input.workFileId})})`);
  const r=await readRow(tx,input.directiveId);
  await appendEvent(tx,{userId:input.userId,projectId:Number(source.project_id),workFileId:input.workFileId,actorType:source.source_member_id==='system:manus-action'?'system':'human',actorUserId:source.source_member_id==='system:manus-action'?null:input.userId,eventType:'manus_directive_queued',summary:source.source_member_id==='system:manus-action'?'طلب النظام عمل Manus الداخلي؛ محفوظ في قناة الوصول وليس إنجازًا':'سلّم المالك التوجيه؛ الطلب محفوظ في طابور وصول Manus، وليس إنجازًا',payload:{directiveId:input.directiveId,dispatchId:r?Number(r.id):null,externalSideEffect:false},idempotencyKey:`dispatch-queued:${input.directiveId}`});
  return {kind:'queued',dispatch:r?publicDispatch(r):null,shouldDeliver:true};
 });
}
async function finishDelivery(db:Db,id:number,token:string,state:'delivered'|'failed'|'delivery_unknown',error:string|null){await db.execute(sql`UPDATE como_manus_dispatches SET state=${state},delivered_at=IF(${state}='delivered',COALESCE(delivered_at,UTC_TIMESTAMP()),delivered_at),last_progress_at=UTC_TIMESTAMP(),error=${error},claim_token=${state==='delivery_unknown'?token:null} WHERE id=${id} AND claim_token=${token} AND state IN ('queued','failed','delivery_unknown')`);}
export async function deliverQueuedManusDispatch(input:{directiveId:number}){
 const db=await getDb();if(!db)throw new Error('database_unavailable');const before=await readRow(db,input.directiveId);if(!before||!canRetryKnownUndeliveredDispatch(before))return before?publicDispatch(before):null;
 const token=`delivery:${randomUUID()}`;
 const claim=await db.execute(sql`UPDATE como_manus_dispatches SET claim_token=${token},delivery_attempts=delivery_attempts+1,last_progress_at=UTC_TIMESTAMP() WHERE id=${Number(before.id)} AND (state='queued' OR (state='failed' AND error IN ('dispatch_webhook_not_configured','dispatch_webhook_rejected'))) AND claim_token IS NULL AND started_at IS NULL`);if(!affectedRows(claim))return readDispatchForDirective(input);
 const url=await configUrl(db);if(!url){await finishDelivery(db,Number(before.id),token,'failed','dispatch_webhook_not_configured');return readDispatchForDirective(input);}
 try{const meta=JSON.parse(before.targetMetadata||'{}');const response=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({event:'como.manus.dispatch.v1',directiveId:input.directiveId,workFileId:meta.workFileId,dispatchId:Number(before.id)}),signal:AbortSignal.timeout(12_000)});if(response.ok)await finishDelivery(db,Number(before.id),token,'delivered',null);else if(response.status>=400&&response.status<500)await finishDelivery(db,Number(before.id),token,'failed','dispatch_webhook_rejected');else await finishDelivery(db,Number(before.id),token,'delivery_unknown','dispatch_delivery_unknown');}
 catch{await finishDelivery(db,Number(before.id),token,'delivery_unknown','dispatch_delivery_unknown');}
 return readDispatchForDirective(input);
}
/** Existing heartbeat only retries known not-started delivery. Never uncertain sends. */
export async function retryKnownUndeliveredDispatches(input:{limit?:number;olderThanSeconds?:number}={}){const db=await getDb();if(!db)throw new Error('database_unavailable');if(!await configUrl(db))return {considered:0,dispatches:[],unavailable:true};const limit=Math.max(1,Math.min(input.limit||3,3));const age=Math.max(30,Math.min(input.olderThanSeconds||120,86_400));const r=rowsFrom<{directiveId:number}>(await db.execute(sql`SELECT directive_id AS directiveId FROM como_manus_dispatches WHERE (state='queued' OR (state='failed' AND error IN ('dispatch_webhook_not_configured','dispatch_webhook_rejected'))) AND claim_token IS NULL AND started_at IS NULL AND delivery_attempts<3 AND queued_at<=DATE_SUB(UTC_TIMESTAMP(),INTERVAL ${age} SECOND) ORDER BY queued_at,id LIMIT ${limit}`));const results=[];for(const x of r)results.push(await deliverQueuedManusDispatch(x));return {considered:r.length,dispatches:results};}
async function loadWorkerRow(db:Db,id:number){return rowsFrom<any>(await db.execute(sql`SELECT d.*,sd.status AS directive_status,sd.source_member_id,sd.user_id,sd.project_id,sd.work_file_id,sd.action_id,sd.current_decision_id,sd.directive_text,u.openId AS owner_open_id,u.role AS owner_role,b.user_id AS binding_user_id,b.open_id AS binding_open_id,b.is_active AS binding_active FROM como_manus_dispatches d JOIN como_next_staged_directives sd ON sd.id=d.directive_id JOIN users u ON u.id=sd.user_id LEFT JOIN como_app_owner_identity b ON b.id=1 WHERE d.directive_id=${id} LIMIT 1`))[0]||null;}
function isAuthoritativeOwner(r:any){return matchesAuthenticatedAppOwner({id:Number(r.user_id),openId:r.owner_open_id,role:r.owner_role},r.binding_user_id==null?null:{userId:Number(r.binding_user_id),openId:r.binding_open_id||'',isActive:Number(r.binding_active||0)},ENV.ownerOpenId);}

/** Receipt reconciliation requires an applied update AND an observed output, never a task alone. */
export async function recoverDispatchFromAppliedReceipt(input:{directiveId:number;userId:number}){
 const db=await getDb();if(!db)throw new Error('database_unavailable');const source=rowsFrom<any>(await db.execute(sql`SELECT * FROM como_next_staged_directives WHERE id=${input.directiveId} AND user_id=${input.userId}`))[0];if(!source||!['submitting','failed'].includes(source.status))return null;
 const events=rowsFrom<any>(await db.execute(sql`SELECT payload_json FROM como_next_work_file_events WHERE idempotency_key=${`staged-directive:${input.directiveId}`} AND work_file_id=${Number(source.work_file_id)} LIMIT 1`));let updateId=0;try{updateId=Number(JSON.parse(events[0]?.payload_json||'{}').updateId||0)}catch{return null}if(!updateId)return null;
 const [u]=rowsFrom<any>(await db.execute(sql`SELECT * FROM como_next_work_file_updates WHERE id=${updateId} AND user_id=${input.userId} AND analysis_status='applied'`));if(!u)return null;
 const [communication]=rowsFrom<any>(await db.execute(sql`SELECT c.id,c.external_message_ref FROM como_next_communications c JOIN como_mailbox_draft_ledger l ON l.communication_id=c.id AND l.user_id=c.user_id AND l.work_file_id=c.work_file_id AND l.state IN ('draft_saved','sent_confirmed') WHERE c.user_id=${input.userId} AND c.work_file_id=${Number(source.work_file_id)} AND c.source_record_id=${`executive-directive-email-draft:${updateId}`} AND c.communication_status IN ('archived','sent') LIMIT 1`));
 const [workProduct]=rowsFrom<any>(await db.execute(sql`SELECT id FROM como_next_work_memory WHERE source_system='como_directive' AND source_record_id=${`executive-directive:${updateId}`} AND work_file_id=${Number(source.work_file_id)} AND memory_type='work_product' LIMIT 1`));
 if(!communication&&!workProduct)return null;
 const receipt={updateId,completedNow:true,communicationDraftId:communication?Number(communication.id):null,mailboxDraftRef:communication?.external_message_ref||null,workProductId:workProduct?Number(workProduct.id):null,nextActionId:u.target_action_id?Number(u.target_action_id):null,executionSummary:u.analysis_summary||'اكتمل العمل الداخلي وحُفظ أثره.',recovered:true};
 await db.transaction(async tx=>{await tx.execute(sql`SELECT id FROM como_next_work_files WHERE id=${Number(source.work_file_id)} FOR UPDATE`);await tx.execute(sql`UPDATE como_manus_dispatches SET state='completed',completed_at=UTC_TIMESTAMP(),last_progress_at=UTC_TIMESTAMP(),execution_summary=${receipt.executionSummary},result_json=${JSON.stringify(receipt)},update_id=${updateId},communication_draft_id=${receipt.communicationDraftId},mailbox_draft_ref=${receipt.mailboxDraftRef},work_product_id=${receipt.workProductId},next_action_id=${receipt.nextActionId},error=NULL WHERE directive_id=${input.directiveId} AND state IN ('running','failed','delivered','delivery_unknown')`);await tx.execute(sql`UPDATE como_next_staged_directives SET status='submitted',submitted_at=COALESCE(submitted_at,UTC_TIMESTAMP()),update_id=${updateId},communication_draft_id=${receipt.communicationDraftId},mailbox_draft_ref=${receipt.mailboxDraftRef},work_product_id=${receipt.workProductId},execution_summary=${receipt.executionSummary},result_json=${JSON.stringify(receipt)},failure_message=NULL WHERE id=${input.directiveId} AND user_id=${input.userId} AND status IN ('submitting','failed')`);await appendEvent(tx,{userId:input.userId,projectId:Number(source.project_id),workFileId:Number(source.work_file_id),actorType:'manus',actorUserId:null,eventType:'manus_directive_receipt_recovered',summary:'وصل الحدث إلى Manus؛ استعيد إيصال العمل المثبت دون تكرار المسودة أو إرسالها',payload:{directiveId:input.directiveId,updateId,mailboxDraftRef:receipt.mailboxDraftRef,nextActionId:receipt.nextActionId,completed:true,sent:false},idempotencyKey:`dispatch-recovered:${input.directiveId}`});});return readDispatchForDirective({directiveId:input.directiveId});
}
export async function recordManusDispatchProgress(input:{directiveId:number;summary:string}){const db=await getDb();if(!db)throw new Error('database_unavailable');const r=await loadWorkerRow(db,input.directiveId);if(!r||!isAuthoritativeOwner(r)||!r.claim_token?.startsWith('worker:')||!['running','delivered'].includes(r.state))throw new Error('dispatch_not_claimed');await db.transaction(async tx=>{await tx.execute(sql`SELECT id FROM como_next_work_files WHERE id=${Number(r.work_file_id)} FOR UPDATE`);await tx.execute(sql`UPDATE como_manus_dispatches SET last_progress_at=UTC_TIMESTAMP(),execution_summary=${input.summary.slice(0,5000)} WHERE directive_id=${input.directiveId} AND claim_token=${r.claim_token}`);await appendEvent(tx,{userId:Number(r.user_id),projectId:Number(r.project_id),workFileId:Number(r.work_file_id),actorType:'manus',actorUserId:null,eventType:'manus_directive_progress',summary:input.summary.slice(0,950),payload:{directiveId:input.directiveId,completed:false}});});}
/** Invoked only by real Manus after receiving event. Payload never grants authority. */
export async function executeDispatchedDirectiveCommand(input:{directiveId:number}){
 const db=await getDb();if(!db)throw new Error('database_unavailable');const r=await loadWorkerRow(db,input.directiveId);if(!r)return {accepted:false,reason:'dispatch_not_found'};if(!isAuthoritativeOwner(r))return {accepted:false,reason:'directive_not_owner_approved'};
 const recovered=await recoverDispatchFromAppliedReceipt({directiveId:input.directiveId,userId:Number(r.user_id)});if(recovered)return {accepted:true,completed:true,fulfillment:'recovered_receipt',dispatch:recovered};
 if(!canClaimDispatchForWorker({state:r.state,claimToken:r.claim_token,directiveStatus:r.directive_status,ownerApproved:true}))return {accepted:false,reason:'dispatch_already_claimed',dispatch:await readDispatchForDirective(input)};
 const token=`worker:${randomUUID()}`;
 const claimed=await db.transaction(async tx=>{await tx.execute(sql`SELECT id FROM como_next_work_files WHERE id=${Number(r.work_file_id)} FOR UPDATE`);const c=await tx.execute(sql`UPDATE como_manus_dispatches SET state='running',claim_token=${token},started_at=COALESCE(started_at,UTC_TIMESTAMP()),last_progress_at=UTC_TIMESTAMP(),error=NULL WHERE directive_id=${input.directiveId} AND state IN ('queued','delivered','delivery_unknown') AND (claim_token IS NULL OR claim_token LIKE 'delivery:%')`);if(!affectedRows(c))return false;await appendEvent(tx,{userId:Number(r.user_id),projectId:Number(r.project_id),workFileId:Number(r.work_file_id),actorType:'manus',actorUserId:null,eventType:'manus_directive_started',summary:'استلم Manus التوجيه المعتمد وبدأ تنفيذ العمل الداخلي',payload:{directiveId:input.directiveId},idempotencyKey:`dispatch-started:${input.directiveId}`});return true;});if(!claimed)return {accepted:false,reason:'dispatch_already_claimed'};
 try{
  const systemAction = r.source_member_id==='system:manus-action';
  if(systemAction){
    const [action]=rowsFrom<any>(await db.execute(sql`SELECT * FROM como_next_actions WHERE id=${Number(r.action_id)} AND work_file_id=${Number(r.work_file_id)} AND user_id=${Number(r.user_id)} AND owner_type='manus' AND action_status='open' LIMIT 1`));
    const {isInternalSystemActionEligible}=await import('./comoSystemActionDispatch');
    if(!action || !isInternalSystemActionEligible(action.title))throw new Error('system_action_no_longer_eligible');
    if(action.source_system==='como_mail_linkage'){
      const emailId=Number(String(action.source_record_id).match(/^mail-linkage:(\d+)$/)?.[1]||0);
      const [email]=rowsFrom<any>(await db.execute(sql`SELECT * FROM como_next_email_messages WHERE id=${emailId} AND user_id=${Number(r.user_id)} AND folder_name='INBOX' AND inbox_status<>'dismissed'`));
      const expectedSha=String(action.description||'').match(/SHA-256=([a-f0-9]{64})/)?.[1];
      if(!email||!expectedSha||email.body_sha256!==expectedSha)throw Error('mail_linkage_source_changed');
      await recordManusDispatchProgress({directiveId:input.directiveId,summary:`المشاريع — وصلت مطابقة بريد COMO #${emailId} إلى Manus رغم تعذر الربط الآلي. لا ربط تخميني؛ اقرأ الخيط والوثائق وحدد الملف بأدلة. المطابقة لا تعني اكتمال الرد أو المتابعة.`});
      return {accepted:true,completed:false,fulfillment:'requires_agent_mail_linkage',sourceEmailId:emailId,operationalWorkFileId:Number(r.work_file_id),bodySha256:email.body_sha256,projectClassification:false,completionMethod:'completeDispatchedMailLinkageReview',dispatch:await readDispatchForDirective(input)};
    }
    if(action.source_system==='como_mail_execution'){
      const emailId=Number(String(action.source_record_id).match(/^mail-review:(\d+)$/)?.[1]||0);
      const [email]=rowsFrom<any>(await db.execute(sql`SELECT id,linked_work_file_id,body_sha256 FROM como_next_email_messages WHERE id=${emailId} AND user_id=${Number(r.user_id)} AND folder_name='INBOX' AND inbox_status='linked'`));
      if(!email||Number(email.linked_work_file_id)!==Number(r.work_file_id))throw new Error('mail_review_source_changed');
      await recordManusDispatchProgress({directiveId:input.directiveId,summary:`وصلت مراجعة رسالة COMO #${emailId} إلى Manus. قراءة الخيط والمرفقات الفعلية مطلوبة؛ التحليل الآلي ليس إيصال تنفيذ.`});
      return {accepted:true,completed:false,fulfillment:'requires_agent_mail_review',sourceEmailId:emailId,workFileId:Number(r.work_file_id),bodySha256:email.body_sha256,
        completionMethod:'completeDispatchedMailReview',dispatch:await readDispatchForDirective(input)};
    }
    if(action.source_system==='finance_invoice_review'){
      const emailId=Number(String(action.source_record_id).match(/^source-email-(\d+)$/)?.[1]||0);
      const [email]=rowsFrom<any>(await db.execute(sql`SELECT id,body_sha256,linked_work_file_id FROM como_next_email_messages WHERE id=${emailId} AND user_id=${Number(r.user_id)} AND folder_name='INBOX' AND inbox_status='linked'`));
      if(!email||Number(email.linked_work_file_id)!==Number(r.work_file_id))throw Error('financial_review_source_changed');
      await recordManusDispatchProgress({directiveId:input.directiveId,summary:`الفلل/المشاريع — وصلت مراجعة وثيقة COMO #${emailId} إلى Manus؛ تحديد عرض/فاتورة يحتاج فحص المرفق نفسه، لا تحليل عنوانه. لا طلب صرف أو إثبات سداد.`});
      return {accepted:true,completed:false,fulfillment:'requires_agent_financial_document_review',sourceEmailId:emailId,bodySha256:email.body_sha256,completionMethod:'completeDispatchedFinancialDocumentReview',dispatch:await readDispatchForDirective(input)};
    }
  }
  const result=await executeExecutiveDirectiveCommand({userId:Number(r.user_id),workFileId:Number(r.work_file_id),actionId:asNumber(r.action_id),currentDecisionId:asNumber(r.current_decision_id),sourceChannel:'internal',directiveText:r.directive_text,executionSource:systemAction?'executive_control':'owner',idempotencyKey:`staged-directive:${input.directiveId}`});
  if(systemAction && result.completedNow){await db.execute(sql`UPDATE como_next_actions SET action_status='verified',completed_at=UTC_TIMESTAMP(),verified_at=UTC_TIMESTAMP(),evidence_reference=${result.workProductId?`مخرج Manus #${result.workProductId}`:`إيصال تنفيذ #${result.updateId}`} WHERE id=${Number(r.action_id)} AND owner_type='manus' AND action_status='open'`);}
  const completed=hasCompletedFulfillment(result);const receipt={...result,completedNow:completed};const summary=result.executionSummary||result.acknowledgement||'استلم Manus التوجيه.';
  await db.transaction(async tx=>{await tx.execute(sql`SELECT id FROM como_next_work_files WHERE id=${Number(r.work_file_id)} FOR UPDATE`);const c=await tx.execute(sql`UPDATE como_manus_dispatches SET state=${completed?'completed':'delivered'},last_progress_at=UTC_TIMESTAMP(),completed_at=${completed?nowSql():null},execution_summary=${summary},result_json=${JSON.stringify(receipt)},update_id=${result.updateId},communication_draft_id=${result.communicationDraftId},mailbox_draft_ref=${result.mailboxDraftRef},work_product_id=${result.workProductId},next_action_id=${result.nextActionId},error=NULL WHERE directive_id=${input.directiveId} AND state='running' AND claim_token=${token}`);if(!affectedRows(c))throw new Error('dispatch_claim_lost');await tx.execute(sql`UPDATE como_next_staged_directives SET status=${completed?'submitted':'submitting'},update_id=${result.updateId},communication_draft_id=${result.communicationDraftId},mailbox_draft_ref=${result.mailboxDraftRef},work_product_id=${result.workProductId},execution_summary=${summary},result_json=${JSON.stringify(receipt)},failure_message=NULL,submitted_at=${completed?nowSql():null} WHERE id=${input.directiveId} AND user_id=${Number(r.user_id)} AND status='submitting'`);await appendEvent(tx,{userId:Number(r.user_id),projectId:Number(r.project_id),workFileId:Number(r.work_file_id),actorType:'manus',actorUserId:null,eventType:completed?'manus_directive_completed':'manus_directive_requires_work',summary:completed?'اكتمل العمل الداخلي وحُفظ إيصال النتيجة؛ لم تُرسل رسالة':'استلم Manus التوجيه وحفظ خطوة إضافية؛ إنشاؤها لا يعني إنجازها',payload:{directiveId:input.directiveId,updateId:result.updateId,completed,externalSideEffect:false},idempotencyKey:`dispatch-receipt:${input.directiveId}`});});
  return {accepted:true,completed,fulfillment:completed?'completed_receipt':'follow_up_created_not_completed',dispatch:await readDispatchForDirective(input)};
 }catch(error){const code=typeof error==='object'&&error&&'code' in error?(error as any).code:'';const message=error instanceof Error?error.message:'';const safeCode=code==='PRECONDITION_FAILED'&&/فاتورة|invoice|دفع|payment/i.test(message)?'dispatch_payment_precondition_failed':'dispatch_execution_failed';await db.transaction(async tx=>{await tx.execute(sql`SELECT id FROM como_next_work_files WHERE id=${Number(r.work_file_id)} FOR UPDATE`);await tx.execute(sql`UPDATE como_manus_dispatches SET state='failed',last_progress_at=UTC_TIMESTAMP(),error=${safeCode} WHERE directive_id=${input.directiveId} AND state='running' AND claim_token=${token}`);await tx.execute(sql`UPDATE como_next_staged_directives SET status='failed',failure_message=${safeFailureMessage(safeCode)} WHERE id=${input.directiveId} AND user_id=${Number(r.user_id)} AND status='submitting'`);await appendEvent(tx,{userId:Number(r.user_id),projectId:Number(r.project_id),workFileId:Number(r.work_file_id),actorType:'manus',actorUserId:null,eventType:'manus_directive_failed',summary:'توقف تنفيذ التوجيه؛ السبب محفوظ، ولا إعادة تلقائية قبل مصالحة الأثر',payload:{directiveId:input.directiveId,reason:safeCode},idempotencyKey:`dispatch-failed:${input.directiveId}`});});return {accepted:true,completed:false,fulfillment:'execution_failed',dispatch:await readDispatchForDirective(input)};}
}
export const comoManusDispatchInternals={canClaimDispatchForWorker,canRetryKnownUndeliveredDispatch,delayFor,hasCompletedFulfillment,publicDispatch,safeError,safeFailureMessage};

/** Main Manus invokes this only after actually reading the source and every
 * substantive attachment. The website's one-shot analyzer cannot complete it. */
export type MailReviewResponseHandling={kind:'draft_saved'|'already_replied'|'no_reply_needed';evidence:string;sentEmailId?:number;nextStep:string};
export function assertMailReviewV2Handling(required:boolean,handling:MailReviewResponseHandling|undefined){
 if(!required)return;
 if(!handling||!['draft_saved','already_replied','no_reply_needed'].includes(handling.kind)||handling.evidence.trim().length<30||handling.nextStep.trim().length<30)throw Error('mail_review_response_and_next_step_required');
 if(handling.kind==='already_replied'&&!handling.sentEmailId)throw Error('mail_review_sent_evidence_required');
}
export async function completeDispatchedMailReview(input:{directiveId:number;bodySha256:string;reviewedDocumentIds:number[];summary:string;workProductBody:string;communicationDraftId?:number;responseHandling?:MailReviewResponseHandling}){
 const db=await getDb();if(!db)throw Error('database_unavailable');const r=await loadWorkerRow(db,input.directiveId);
 if(!r||!isAuthoritativeOwner(r)||r.source_member_id!=='system:manus-action')throw Error('mail_review_not_authorized');
 if(r.state==='completed')return readDispatchForDirective({directiveId:input.directiveId});
 if(r.state!=='running'||!r.claim_token?.startsWith('worker:'))throw Error('dispatch_not_claimed');
 const [action]=rowsFrom<any>(await db.execute(sql`SELECT * FROM como_next_actions WHERE id=${Number(r.action_id)} AND user_id=${Number(r.user_id)} AND work_file_id=${Number(r.work_file_id)} AND source_system='como_mail_execution' AND action_status='open'`));
 const emailId=Number(String(action?.source_record_id).match(/^mail-review:(\d+)$/)?.[1]||0);if(!emailId)throw Error('mail_review_action_changed');
 assertMailReviewV2Handling(String(action.acceptance_criteria||'').includes('MAIL_REVIEW_V2'),input.responseHandling);
 const [email]=rowsFrom<any>(await db.execute(sql`SELECT * FROM como_next_email_messages WHERE id=${emailId} AND user_id=${Number(r.user_id)} AND linked_work_file_id=${Number(r.work_file_id)} AND inbox_status='linked'`));
 if(!email||email.body_sha256!==input.bodySha256)throw Error('mail_review_source_changed');
 const attachments=rowsFrom<any>(await db.execute(sql`SELECT id,document_id,mime_type,disposition,file_name,storage_status FROM como_next_email_attachments WHERE email_message_id=${emailId}`));
 const substantive=attachments.filter(a=>!(a.disposition==='inline'&&String(a.mime_type).startsWith('image/')));
 if(substantive.some(a=>a.storage_status!=='stored'||!a.document_id||!input.reviewedDocumentIds.includes(Number(a.document_id))))throw Error('mail_review_attachments_not_reviewed');
 if(input.summary.trim().length<20||input.workProductBody.trim().length<80||!input.workProductBody.includes(String(emailId)))throw Error('mail_review_receipt_incomplete');
 const [savedDraft]=rowsFrom<any>(await db.execute(sql`SELECT c.id,c.external_message_ref FROM como_next_communications c JOIN como_mailbox_draft_ledger l ON l.communication_id=c.id AND l.user_id=c.user_id AND l.work_file_id=c.work_file_id AND l.state IN ('draft_saved','sent_confirmed') WHERE c.id=${Number(input.communicationDraftId||email.reply_draft_communication_id||0)} AND c.user_id=${Number(r.user_id)} AND c.work_file_id=${Number(r.work_file_id)} AND c.direction='outbound' AND c.communication_status IN ('archived','sent') LIMIT 1`));
 if(input.communicationDraftId&&!savedDraft)throw Error('mail_review_output_draft_not_proven');
 if(input.responseHandling?.kind==='draft_saved'&&!savedDraft)throw Error('mail_review_response_draft_not_proven');
 if(input.responseHandling?.kind==='already_replied'){
  const [sent]=rowsFrom<any>(await db.execute(sql`SELECT id,subject FROM como_next_email_messages WHERE id=${Number(input.responseHandling.sentEmailId)} AND user_id=${Number(r.user_id)} AND folder_name='Sent' AND linked_work_file_id=${Number(r.work_file_id)}`));
  const subject=(s:string)=>s.replace(/^\s*(?:(?:re|fw|fwd)\s*:\s*)+/i,'').trim().toLowerCase();
  if(!sent||subject(sent.subject)!==subject(email.subject))throw Error('mail_review_response_sent_not_proven');
 }
 return db.transaction(async tx=>{
  const [activeFile]=rowsFrom<any>(await tx.execute(sql`SELECT id,work_file_status FROM como_next_work_files WHERE id=${Number(r.work_file_id)} AND user_id=${Number(r.user_id)} FOR UPDATE`));
  if(!activeFile||['closed','cancelled'].includes(activeFile.work_file_status))throw Error('mail_review_file_closed_during_review');
  const [live]=rowsFrom<any>(await tx.execute(sql`SELECT state,claim_token FROM como_manus_dispatches WHERE directive_id=${input.directiveId} FOR UPDATE`));
  if(live?.state==='completed')return readDispatchForDirective({directiveId:input.directiveId});
  if(live?.state!=='running'||live.claim_token!==r.claim_token)throw Error('dispatch_claim_lost');
  const [current]=rowsFrom<any>(await tx.execute(sql`SELECT body_sha256,linked_work_file_id FROM como_next_email_messages WHERE id=${emailId} AND user_id=${Number(r.user_id)} FOR UPDATE`));
  if(current?.body_sha256!==input.bodySha256||Number(current?.linked_work_file_id)!==Number(r.work_file_id))throw Error('mail_review_source_changed');
  const memory:any=await tx.execute(sql`INSERT INTO como_next_work_memory (project_id,work_file_id,memory_type,entry_type,title,body,source_status,source_system,source_record_id,is_current,occurred_at) VALUES (${Number(r.project_id)},${Number(r.work_file_id)},'work_product','mail_execution_review',${`نتيجة مراجعة رسالة COMO #${emailId}`},${input.workProductBody},'reviewed','como_mail_execution',${`dispatch-review:${input.directiveId}`},1,UTC_TIMESTAMP())`);
  const workProductId=Number(memory[0].insertId);const receipt={completedNow:true,workProductId,sourceEmailId:emailId,bodySha256:input.bodySha256,reviewedDocumentIds:input.reviewedDocumentIds,responseHandling:input.responseHandling||null,executionSummary:input.summary,externalSideEffect:false};
  const communicationDraftId=savedDraft?Number(savedDraft.id):null;const mailboxDraftRef=savedDraft?.external_message_ref||null;
  Object.assign(receipt,{communicationDraftId,mailboxDraftRef});
  await tx.execute(sql`UPDATE como_next_actions SET action_status='verified',completed_at=UTC_TIMESTAMP(),verified_at=UTC_TIMESTAMP(),evidence_reference=${`إيصال مراجعة Manus #${workProductId}؛ رسالة COMO #${emailId}`} WHERE id=${Number(r.action_id)} AND source_system='como_mail_execution' AND action_status='open'`);
  await tx.execute(sql`UPDATE como_manus_dispatches SET state='completed',work_product_id=${workProductId},communication_draft_id=${communicationDraftId},mailbox_draft_ref=${mailboxDraftRef},execution_summary=${input.summary},result_json=${JSON.stringify(receipt)},completed_at=UTC_TIMESTAMP(),last_progress_at=UTC_TIMESTAMP(),error=NULL WHERE directive_id=${input.directiveId} AND state='running' AND claim_token=${r.claim_token}`);
  await tx.execute(sql`UPDATE como_next_staged_directives SET status='submitted',work_product_id=${workProductId},communication_draft_id=${communicationDraftId},mailbox_draft_ref=${mailboxDraftRef},execution_summary=${input.summary},result_json=${JSON.stringify(receipt)},submitted_at=UTC_TIMESTAMP(),failure_message=NULL WHERE id=${input.directiveId} AND user_id=${Number(r.user_id)} AND status='submitting'`);
  await appendEvent(tx,{userId:Number(r.user_id),projectId:Number(r.project_id),workFileId:Number(r.work_file_id),actionId:Number(r.action_id),actorType:'manus',actorUserId:null,eventType:'mail_review_completed',summary:input.summary.slice(0,950),payload:{completedNow:true,workProductId,sourceEmailId:emailId,bodySha256:input.bodySha256,reviewedDocumentIds:input.reviewedDocumentIds.join(','),responseHandlingJson:JSON.stringify(input.responseHandling||null),communicationDraftId,mailboxDraftRef,executionSummary:input.summary,externalSideEffect:false},idempotencyKey:`mail-review-completed:${input.directiveId}`});
  return {directiveId:input.directiveId,state:'completed',workProductId,receipt};
 });
}

/** Completing source matching cannot clear the substantive-review warning.
 * A real, active destination and changed source are rechecked under locks.
 * No linking, documents, network or draft creation occurs in this receipt. */
export async function completeDispatchedMailLinkageReview(input:{directiveId:number;bodySha256:string;targetWorkFileId:number;evidence:string;continueInCurrentTask?:boolean}){
 const db=await getDb();if(!db)throw Error('database_unavailable');
 const r=await loadWorkerRow(db,input.directiveId);
 if(!r||!isAuthoritativeOwner(r)||r.source_member_id!=='system:manus-action')throw Error('mail_linkage_not_authorized');
 if(r.state==='completed')return readDispatchForDirective(input);
 if(r.state!=='running'||!r.claim_token?.startsWith('worker:'))throw Error('dispatch_not_claimed');
 const [a]=rowsFrom<any>(await db.execute(sql`SELECT * FROM como_next_actions WHERE id=${Number(r.action_id)} AND user_id=${Number(r.user_id)} AND work_file_id=${Number(r.work_file_id)} AND source_system='como_mail_linkage' AND action_status='open'`));
 const emailId=Number(String(a?.source_record_id).match(/^mail-linkage:(\d+)$/)?.[1]||0);
 if(!emailId||String(a.description).match(/SHA-256=([a-f0-9]{64})/)?.[1]!==input.bodySha256||input.evidence.trim().length<80||!input.evidence.includes(String(emailId)))throw Error('mail_linkage_receipt_incomplete');
 const [target]=rowsFrom<any>(await db.execute(sql`SELECT * FROM como_next_work_files WHERE id=${input.targetWorkFileId} AND user_id=${Number(r.user_id)} AND work_file_status NOT IN ('closed','cancelled')`));
 if(!target||target.source_system==='como_mail_linkage')throw Error('mail_linkage_active_target_required');
 await requireProjectAccess(db,Number(target.project_id),Number(r.user_id),'write');
 const result=await db.transaction(async tx=>{
  // Lock multiple file ids in stable order to avoid cross-project deadlocks.
  const ids=[Number(r.work_file_id),input.targetWorkFileId].sort((x,y)=>x-y);
  for(const id of ids)await tx.execute(sql`SELECT id FROM como_next_work_files WHERE id=${id} FOR UPDATE`);
  const [live]=rowsFrom<any>(await tx.execute(sql`SELECT state,claim_token FROM como_manus_dispatches WHERE directive_id=${input.directiveId} FOR UPDATE`));
  if(live?.state==='completed')return readDispatchForDirective(input);
  if(live?.state!=='running'||live.claim_token!==r.claim_token)throw Error('dispatch_claim_lost');
  const [email]=rowsFrom<any>(await tx.execute(sql`SELECT body_sha256,linked_work_file_id,inbox_status FROM como_next_email_messages WHERE id=${emailId} AND user_id=${Number(r.user_id)} FOR UPDATE`));
  const [active]=rowsFrom<any>(await tx.execute(sql`SELECT work_file_status FROM como_next_work_files WHERE id=${input.targetWorkFileId} AND user_id=${Number(r.user_id)}`));
  if(!email||email.body_sha256!==input.bodySha256||email.inbox_status!=='linked'||Number(email.linked_work_file_id)!==input.targetWorkFileId||['closed','cancelled'].includes(active?.work_file_status||''))throw Error('mail_linkage_source_or_target_changed');
  const inserted:any=await tx.execute(sql`INSERT INTO como_next_work_memory (project_id,work_file_id,memory_type,entry_type,title,body,source_status,source_system,source_record_id,is_current,occurred_at) VALUES (${Number(r.project_id)},${Number(r.work_file_id)},'work_product','mail_linkage_review',${`المشاريع — نتيجة مطابقة بريد COMO #${emailId}`},${input.evidence},'reviewed','como_mail_linkage',${`dispatch-linkage:${input.directiveId}`},1,UTC_TIMESTAMP())`);
  const workProductId=Number(inserted[0].insertId);
  const summary=`المشاريع — طابق Manus بريد COMO #${emailId} بملف #${input.targetWorkFileId} بأدلة المصدر؛ المطابقة فقط اكتملت، المراجعة الموضوعية والرد والمتابعة تحتاج إيصالًا مستقلًا.`;
  const receipt={completedNow:true,matchingOnly:true,sourceEmailId:emailId,targetWorkFileId:input.targetWorkFileId,workProductId,bodySha256:input.bodySha256,executionSummary:summary,externalSideEffect:false};
  await tx.execute(sql`UPDATE como_next_actions SET action_status='verified',completed_at=UTC_TIMESTAMP(),verified_at=UTC_TIMESTAMP(),evidence_reference=${`مطابقة المصدر #${workProductId}؛ بريد #${emailId}؛ المراجعة الموضوعية لم تُنجز هنا`} WHERE id=${Number(r.action_id)} AND source_system='como_mail_linkage' AND action_status='open'`);
  await tx.execute(sql`UPDATE como_manus_dispatches SET state='completed',work_product_id=${workProductId},execution_summary=${summary},result_json=${JSON.stringify(receipt)},completed_at=UTC_TIMESTAMP(),last_progress_at=UTC_TIMESTAMP(),error=NULL WHERE directive_id=${input.directiveId} AND state='running' AND claim_token=${r.claim_token}`);
  await tx.execute(sql`UPDATE como_next_staged_directives SET status='submitted',work_product_id=${workProductId},execution_summary=${summary},result_json=${JSON.stringify(receipt)},submitted_at=UTC_TIMESTAMP(),failure_message=NULL WHERE id=${input.directiveId} AND user_id=${Number(r.user_id)} AND status='submitting'`);
  await appendEvent(tx,{userId:Number(r.user_id),projectId:Number(r.project_id),workFileId:Number(r.work_file_id),actionId:Number(r.action_id),actorType:'manus',actorUserId:null,eventType:'mail_linkage_completed',summary,payload:receipt,idempotencyKey:`mail-linkage-completed:${input.directiveId}`});
  return {directiveId:input.directiveId,state:'completed',workProductId,receipt};
 });
 // Durable continuation independent of any prior LLM analysis. The existing
 // heartbeat delivers this next stage; completion isn't a task alone.
 const {ensureCurrentMailReviewWork}=await import('./comoMailExecution');
 await ensureCurrentMailReviewWork(Number(r.user_id));
 const [nextAction]=rowsFrom<any>(await db.execute(sql`SELECT id FROM como_next_actions WHERE user_id=${Number(r.user_id)} AND work_file_id=${input.targetWorkFileId} AND source_system='como_mail_execution' AND source_record_id=${`mail-review:${emailId}`} AND action_status='open' LIMIT 1`));
 const {queueSystemManusAction}=await import('./comoSystemActionDispatch');
 const continuation=nextAction?await queueSystemManusAction({userId:Number(r.user_id),actionId:Number(nextAction.id),deliver:!input.continueInCurrentTask}):null;
 return {matchingReceipt:result,continuation};
}

/** Real Manus source review, including recovery after the generic processor failed.
 * This records document classification ONLY. It never creates payment requests,
 * changes invoice/payment lanes, or interprets a signature as payment.
 */
export async function completeDispatchedFinancialDocumentReview(input:{directiveId:number;bodySha256:string;reviewedDocumentIds:number[];classification:'quotation'|'invoice'|'unclear';summary:string;workProductBody:string}){
 const db=await getDb();if(!db)throw Error('database_unavailable');
 const r=await loadWorkerRow(db,input.directiveId);
 if(!r||!isAuthoritativeOwner(r)||r.source_member_id!=='system:manus-action')throw Error('financial_review_not_authorized');
 if(r.state==='completed')return readDispatchForDirective({directiveId:input.directiveId});
 if(!['running','delivered','failed'].includes(r.state)||!r.claim_token?.startsWith('worker:'))throw Error('financial_review_not_claimed');
 const [action]=rowsFrom<any>(await db.execute(sql`SELECT * FROM como_next_actions WHERE id=${Number(r.action_id)} AND user_id=${Number(r.user_id)} AND work_file_id=${Number(r.work_file_id)} AND owner_type='manus' AND action_status='open' AND source_system='finance_invoice_review'`));
 const emailId=Number(String(action?.source_record_id||'').match(/^source-email-(\d+)$/)?.[1]||0);
 const [email]=rowsFrom<any>(await db.execute(sql`SELECT * FROM como_next_email_messages WHERE id=${emailId} AND user_id=${Number(r.user_id)} AND folder_name='INBOX' AND inbox_status='linked' AND linked_work_file_id=${Number(r.work_file_id)}`));
 if(!action||!email||email.body_sha256!==input.bodySha256||input.summary.trim().length<40||input.workProductBody.trim().length<150)throw Error('financial_review_source_or_evidence_invalid');
 const substantive=rowsFrom<any>(await db.execute(sql`SELECT document_id,sha256,storage_status FROM como_next_email_attachments WHERE email_message_id=${emailId} AND NOT (disposition='inline' AND mime_type LIKE 'image/%')`));
 if(!substantive.length||substantive.some(a=>!a.document_id||!a.sha256||a.storage_status!=='stored'||!input.reviewedDocumentIds.includes(Number(a.document_id))))throw Error('financial_review_documents_not_reviewed');
 return db.transaction(async tx=>{
  const [file]=rowsFrom<any>(await tx.execute(sql`SELECT id,work_file_status FROM como_next_work_files WHERE id=${Number(r.work_file_id)} AND user_id=${Number(r.user_id)} FOR UPDATE`));
  if(!file||['closed','cancelled'].includes(file.work_file_status))throw Error('financial_review_file_closed');
  const [live]=rowsFrom<any>(await tx.execute(sql`SELECT state,claim_token FROM como_manus_dispatches WHERE directive_id=${input.directiveId} FOR UPDATE`));
  if(live?.state==='completed')return readDispatchForDirective({directiveId:input.directiveId});
  if(!['running','delivered','failed'].includes(live?.state)||live.claim_token!==r.claim_token)throw Error('financial_review_claim_lost');
  const m:any=await tx.execute(sql`INSERT INTO como_next_work_memory (project_id,work_file_id,memory_type,entry_type,title,body,source_status,source_system,source_record_id,is_current,occurred_at) VALUES (${Number(r.project_id)},${Number(r.work_file_id)},'work_product','financial_document_source_review',${`مراجعة الوثيقة المالية COMO #${emailId}`},${input.workProductBody},'reviewed','finance_invoice_review',${`dispatch-review:${input.directiveId}`},1,UTC_TIMESTAMP())`);
  const workProductId=Number(m[0].insertId);
  const receipt={directiveId:input.directiveId,workProductId,sourceEmailId:emailId,bodySha256:input.bodySha256,reviewedDocumentIds:input.reviewedDocumentIds,classification:input.classification,completedNow:true,executionSummary:input.summary,paymentChanged:false,paymentRequestCreated:false,sent:false};
  await tx.execute(sql`UPDATE como_next_actions SET action_status='verified',completed_at=UTC_TIMESTAMP(),verified_at=UTC_TIMESTAMP(),evidence_reference=${`مراجعة مصدر #${workProductId}؛ ${input.classification}؛ ليس إثبات دفع`} WHERE id=${Number(r.action_id)} AND user_id=${Number(r.user_id)} AND source_system='finance_invoice_review' AND action_status='open'`);
  await tx.execute(sql`UPDATE como_manus_dispatches SET state='completed',work_product_id=${workProductId},execution_summary=${input.summary},result_json=${JSON.stringify(receipt)},completed_at=UTC_TIMESTAMP(),last_progress_at=UTC_TIMESTAMP(),error=NULL WHERE directive_id=${input.directiveId} AND claim_token=${r.claim_token}`);
  await tx.execute(sql`UPDATE como_next_staged_directives SET status='submitted',work_product_id=${workProductId},execution_summary=${input.summary},result_json=${JSON.stringify(receipt)},submitted_at=UTC_TIMESTAMP(),failure_message=NULL WHERE id=${input.directiveId} AND user_id=${Number(r.user_id)} AND status IN ('submitting','failed')`);
  await appendEvent(tx,{userId:Number(r.user_id),projectId:Number(r.project_id),workFileId:Number(r.work_file_id),actionId:Number(r.action_id),actorType:'manus',actorUserId:null,eventType:'financial_document_review_completed',summary:input.summary,payload:{directiveId:input.directiveId,workProductId,sourceEmailId:emailId,classification:input.classification,paymentChanged:false,paymentRequestCreated:false,sent:false},idempotencyKey:`financial-document-review:${input.directiveId}`});
  return receipt;
 });
}
