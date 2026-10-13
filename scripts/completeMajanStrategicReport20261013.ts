import fs from 'node:fs';
import path from 'node:path';
import {createHash, randomUUID} from 'node:crypto';
import {sql} from 'drizzle-orm';
import {getDb} from '../server/db';
import {ENV} from '../server/_core/env';
import {storagePut} from '../server/storage';
import {matchesAuthenticatedAppOwner} from '../server/services/comoAppOwner';
import {appendEvent, createActionCommand, createWorkFileCommand, changeActionStatusCommand, requireProjectAccess} from '../server/services/comoNextCommands';
import {recordWorkFileUpdateCommand} from '../server/services/comoNextKitchen';
import {readExecutiveWorkFile} from '../server/services/saraWorkFileReader';

const root='/home/ubuntu/reports/colliers-directive-450002-2026-10-13';
const sourceFileId=60017;
const directiveIds=[420001,420002,420003,420004,450001,450002];
const sourceKey='majan-strategic-options:20261013';
const title='ماجان — بدائل استثمار الأرض والتقرير للشيخ عيسى';
const summaries:Record<number,string>={
  420001:'سُجلت نتيجة اجتماع وائل: مشروع المول لم يُحسم بسبب الحاجة إلى التحقق من جدوى المساحات التأجيرية. جُمعت البدائل في تقرير مستقل لمشروع ماجان، دون موافقة على التطوير.',
  420002:'سُجل قرار التريث في اعتماد مسار تطوير ماجان دون اختراع موعد عودة. متابعة التحليل المالي من كولييرز باقية مستقلة؛ لا إعادة فتح للفاتورة المسددة أو حزمة الاستشاريين الملغاة.',
  420003:'أُنجزت مقارنة خيار تطوير المركز التجاري وخيار بيع الأرض ضمن التقرير. سعر الشراء 62 مليون ونطاق البيع 140–150 مليون من إفادة المالك؛ الفرق 78–88 مليون قبل الاستقطاعات، وليس صافي ربح أو عرض شراء مثبتًا.',
  420004:'أُدرج اهتمام جمعية الاتحاد كخيار ثالث بحسب إفادة المالك، وأُعدت محاور اللقاء داخل التقرير. لم يثبت إيجار أو شراء أو شراكة، ولم يُحجز موعد أو يُتواصل خارجيًا.',
  450001:'أُدرج الخيار الرابع: سكن للبيع على المخطط مع مركز تجاري أصغر محتفظ به. وُثّق شرط التحقق من الاستعمال السكني وتعريف مساحة 120,000 قدم²، وعلاوة 25–30% كهدف لا سعر مثبت؛ لا تصميم أو تمويل أو بيع معتمد.',
  450002:'أُنجز التقرير الكامل للشيخ عيسى عن البدائل الأربعة، بعد مراجعة توصيات كولييرز ومخطط القطعة وإفادات الاجتماع. حُفظ PDF ونص التقرير في ملف ماجان مستقل للمراجعة، دون إرسال أو تعديل مالية المشروع.'
};
function rows(r:any):any[]{return Array.isArray(r)&&Array.isArray(r[0])?r[0]:r;}

async function main(){
 const db=await getDb();if(!db)throw Error('database_unavailable');
 const expected=JSON.parse(fs.readFileSync(path.join(root,'directives-live.json'),'utf8'));
 const sources=rows(await db.execute(sql`SELECT sd.*,d.state AS dispatch_state,d.claim_token,d.update_id AS dispatch_update_id,d.work_product_id AS dispatch_product_id,d.next_action_id AS dispatch_next_action_id,d.result_json AS dispatch_result_json,d.started_at,u.openId AS owner_open_id,u.role AS owner_role,b.user_id AS binding_user_id,b.open_id AS binding_open_id,b.is_active AS binding_active FROM como_next_staged_directives sd JOIN como_manus_dispatches d ON d.directive_id=sd.id JOIN users u ON u.id=sd.user_id LEFT JOIN como_app_owner_identity b ON b.id=1 WHERE sd.id IN (420001,420002,420003,420004,450001,450002) ORDER BY sd.id`));
 if(sources.length!==directiveIds.length)throw Error('missing_submitted_source');
 for(const s of sources){
  const binding=s.binding_user_id==null?null:{userId:Number(s.binding_user_id),openId:s.binding_open_id||'',isActive:Number(s.binding_active||0)};
  if(!matchesAuthenticatedAppOwner({id:Number(s.user_id),openId:s.owner_open_id,role:s.owner_role},binding,ENV.ownerOpenId))throw Error('owner_authority_failed');
  if(Number(s.work_file_id)!==sourceFileId||Number(s.project_id)!==1||!['submitting','submitted','failed'].includes(s.status))throw Error('source_not_submitted');
  const original=expected.find((x:any)=>Number(x.id)===Number(s.id));
  if(!original||original.directive_text!==s.directive_text)throw Error('source_text_changed');
 }
 const userId=Number(sources[0].user_id);await requireProjectAccess(db,1,userId,'write');
 const pdf=fs.readFileSync(path.join(root,'Majan_Strategic_Options_AR.pdf'));
 const body=fs.readFileSync(path.join(root,'Majan_Strategic_Options_AR.md'),'utf8');
 if(!pdf.subarray(0,5).equals(Buffer.from('%PDF-'))||body.length<5000||!body.includes('420001')||!body.includes('450002'))throw Error('report_incomplete');
 const pdfHash=createHash('sha256').update(pdf).digest('hex');
 const opened=await createWorkFileCommand({userId,projectId:1,title,governingQuestion:'أي بديل يحقق أفضل توازن بين السيولة والعائد المستمر والمخاطر للأرض 6457956؟',desiredOutcome:'مراجعة تقرير البدائل الأربعة قبل عرضه على الشيخ عيسى، مع إبقاء قرار التريث وفصل الدراسة عن التصرفات الخارجية.',priority:'important',idempotencyKey:`file:${sourceKey}`});
 const reportFileId=Number(opened.id);
 let doc=rows(await db.execute(sql`SELECT id,sha256,storage_key FROM como_next_documents WHERE source_system='como_strategy_report' AND source_key=${sourceKey} LIMIT 1`))[0];
 if(doc&&doc.sha256!==pdfHash)throw Error('different_report_already_saved');
 if(!doc){
  const key=`como-next/private/documents/${randomUUID()}/content`;
  const stored=await storagePut(key,pdf,'application/pdf');
  const inserted:any=await db.execute(sql`INSERT INTO como_next_documents (title,file_name,mime_type,byte_size,sha256,storage_key,storage_url,source_system,source_key) VALUES (${title},'Majan_Strategic_Options_AR.pdf','application/pdf',${pdf.length},${pdfHash},${key},${stored.url},'como_strategy_report',${sourceKey})`);
  doc={id:Number(inserted[0].insertId),sha256:pdfHash,storage_key:key};
 }
 const product=await db.transaction(async tx=>{
  await tx.execute(sql`SELECT id FROM como_next_work_files WHERE id=${reportFileId} FOR UPDATE`);
  let p=rows(await tx.execute(sql`SELECT id FROM como_next_work_memory WHERE work_file_id=${reportFileId} AND source_system='como_strategy_report' AND source_record_id=${sourceKey} LIMIT 1`))[0];
  if(!p){
   const ins:any=await tx.execute(sql`INSERT INTO como_next_work_memory (project_id,work_file_id,memory_type,entry_type,title,body,source_status,source_file_key,source_file_name,mime_type,is_current,source_system,source_record_id,occurred_at) VALUES (1,${reportFileId},'work_product','strategic_options_report',${title},${body},'done',${doc.storage_key},'Majan_Strategic_Options_AR.pdf','application/pdf',1,'como_strategy_report',${sourceKey},UTC_TIMESTAMP())`);p={id:Number(ins[0].insertId)};
  }
  const link=rows(await tx.execute(sql`SELECT id FROM como_next_work_memory_documents WHERE memory_id=${Number(p.id)} AND document_id=${Number(doc.id)} LIMIT 1`))[0];
  if(!link)await tx.execute(sql`INSERT INTO como_next_work_memory_documents (project_id,work_file_id,memory_id,document_id,relation_type,source_system,source_record_id) VALUES (1,${reportFileId},${Number(p.id)},${Number(doc.id)},'attachment','como_strategy_report',${sourceKey})`);
  await appendEvent(tx,{userId,projectId:1,workFileId:reportFileId,actorType:'manus',actorUserId:null,eventType:'strategic_report_saved',summary:'أُنجز تقرير بدائل ماجان الأربعة وحُفظ للمراجعة؛ لا مراسلات أو التزامات خارجية.',payload:{directiveIds,documentId:Number(doc.id),workProductId:Number(p.id),pdfHash,externalSideEffect:false},idempotencyKey:`report-saved:${sourceKey}`});
  return {id:Number(p.id)};
 });
 const review=await createActionCommand({userId,workFileId:reportFileId,title:'مراجعة تقرير بدائل ماجان قبل عرضه على الشيخ عيسى',description:'التقرير جاهز: تطوير المركز التجاري، بيع الأرض، اهتمام جمعية الاتحاد، أو سكن للبيع مع مركز أصغر محتفظ به. راجع التقرير، لا سجل التاريخ.',acceptanceCriteria:'مراجعة التقرير وتحديد أي تعديل مطلوب قبل العرض، دون اعتبار هذه المراجعة اعتمادًا للبيع أو التطوير أو تواصلًا خارجيًا.',ownerType:'human',priority:'important',actorType:'manus',actorUserId:null,idempotencyKey:`review:${sourceKey}`});
 await db.transaction(async tx=>{
  await tx.execute(sql`SELECT id FROM como_next_work_files WHERE id=${sourceFileId} FOR UPDATE`);
  let ref=rows(await tx.execute(sql`SELECT id FROM como_next_work_memory WHERE work_file_id=${sourceFileId} AND source_system='como_strategy_report' AND source_record_id=${`reference:${sourceKey}`} LIMIT 1`))[0];
  if(!ref){
   const ins:any=await tx.execute(sql`INSERT INTO como_next_work_memory (project_id,work_file_id,memory_type,entry_type,title,body,source_status,is_current,source_system,source_record_id,occurred_at) VALUES (1,${sourceFileId},'work_product','strategic_report_reference',${title},${`التقرير الاستراتيجي الكامل محفوظ في ملف ماجان #${reportFileId}، مستند #${doc.id}، مخرج #${product.id}.\nالتقرير يشمل البدائل الأربعة، وتثبيت قرار التريث بعد اجتماع وائل. لا إحياء للحزمة الملغاة أو تعديل مالية المشروع. متابعة التحليل المالي من كولييرز #60100 باقية، والفاتورة مسددة بإفادة المالك.\n\n${body}`},'done',1,'como_strategy_report',${`reference:${sourceKey}`},UTC_TIMESTAMP())`);ref={id:Number(ins[0].insertId)};
  }
  const link=rows(await tx.execute(sql`SELECT id FROM como_next_work_memory_documents WHERE memory_id=${Number(ref.id)} AND document_id=${Number(doc.id)} LIMIT 1`))[0];
  if(!link)await tx.execute(sql`INSERT INTO como_next_work_memory_documents (project_id,work_file_id,memory_id,document_id,relation_type,source_system,source_record_id) VALUES (1,${sourceFileId},${Number(ref.id)},${Number(doc.id)},'attachment','como_strategy_report',${`reference:${sourceKey}`})`);
  await appendEvent(tx,{userId,projectId:1,workFileId:sourceFileId,actorType:'manus',actorUserId:null,eventType:'strategic_report_linked',summary:`تقرير البدائل جاهز في ملف ماجان #${reportFileId}؛ متابعة كولييرز مستقلة عن قرار مسار التطوير.`,payload:{reportFileId,workProductId:product.id,documentId:doc.id,directiveIds,externalSideEffect:false},idempotencyKey:`reference:${sourceKey}`});
 });
 const base={reportFileId,documentId:Number(doc.id),workProductId:product.id,reviewActionId:Number(review.id),pdfHash,directiveIds};
 fs.writeFileSync(path.join(root,'report-saved.json'),JSON.stringify(base,null,2));
 if(process.argv.includes('--finalize')){
  const live=rows(await db.execute(sql`SELECT sd.id,sd.status,d.state,d.claim_token,d.update_id,d.work_product_id,d.next_action_id,d.result_json FROM como_next_staged_directives sd JOIN como_manus_dispatches d ON d.directive_id=sd.id WHERE sd.id IN (420001,420002,420003,420004,450001,450002) ORDER BY sd.id`));
  if(live.some(s=>s.state==='running'||!s.claim_token?.startsWith('worker:')||!['completed','delivered','failed'].includes(s.state)))throw Error('worker_still_running_or_not_claimed');
  for(const s of live){
   const source=sources.find(x=>Number(x.id)===Number(s.id));
   if(!source)throw Error('source_missing');
   const previousReceipt=JSON.parse(s.result_json||'{}');
   const limitedReceipt=previousReceipt.priorLimitedReceipt??previousReceipt;
   const limitedUpdateId=Number(limitedReceipt.updateId||s.update_id||0);
   const limitedProductId=Number(limitedReceipt.workProductId||s.work_product_id||0);
   const limitedActionId=Number(limitedReceipt.nextActionId||s.next_action_id||0);
   const update=await recordWorkFileUpdateCommand({userId,workFileId:sourceFileId,sourceChannel:'internal',updateText:source.directive_text,actorType:'manus',actorUserId:null,idempotencyKey:`strategic-report-fulfillment:${s.id}`});
   const summary=`${summaries[Number(s.id)]}\nملف التقرير #${reportFileId}؛ المستند #${doc.id}؛ المطلوب من المالك مراجعة التقرير فقط.`;
   await db.transaction(async tx=>{
    await tx.execute(sql`SELECT id FROM como_next_work_files WHERE id=${sourceFileId} FOR UPDATE`);
    const [current]=rows(await tx.execute(sql`SELECT d.state,d.claim_token,sd.status,sd.directive_text FROM como_manus_dispatches d JOIN como_next_staged_directives sd ON sd.id=d.directive_id WHERE d.directive_id=${Number(s.id)} FOR UPDATE`));
    if(current?.state==='running'||current?.claim_token!==s.claim_token||current?.directive_text!==source.directive_text||!['submitting','submitted','failed'].includes(current?.status))throw Error('execution_changed');
    const priorEvent=rows(await tx.execute(sql`SELECT id FROM como_next_work_file_events WHERE idempotency_key=${`strategic-report-final:${s.id}`} LIMIT 1`))[0];
    if(priorEvent)return;
    const receipt={completedNow:true,workProductId:product.id,reportFileId,documentId:Number(doc.id),reviewActionId:Number(review.id),updateId:Number(update.id),executionSummary:summary,externalSideEffect:false,sent:false,priorLimitedReceipt:limitedReceipt};
    await tx.execute(sql`UPDATE como_next_work_file_updates SET analysis_status='applied',analysis_summary=${summary},target_action_id=NULL WHERE id=${Number(update.id)} AND user_id=${userId}`);
    await tx.execute(sql`UPDATE como_manus_dispatches SET state='completed',completed_at=UTC_TIMESTAMP(),last_progress_at=UTC_TIMESTAMP(),execution_summary=${summary},result_json=${JSON.stringify(receipt)},work_product_id=${product.id},update_id=${Number(update.id)},next_action_id=NULL,error=NULL WHERE directive_id=${Number(s.id)} AND claim_token=${s.claim_token}`);
    await tx.execute(sql`UPDATE como_next_staged_directives SET status='submitted',submitted_at=COALESCE(submitted_at,UTC_TIMESTAMP()),execution_summary=${summary},result_json=${JSON.stringify(receipt)},work_product_id=${product.id},update_id=${Number(update.id)},failure_message=NULL WHERE id=${Number(s.id)} AND user_id=${userId}`);
    await appendEvent(tx,{userId,projectId:1,workFileId:sourceFileId,actorType:'manus',actorUserId:null,eventType:'strategic_directive_fulfilled',summary:summary.slice(0,950),payload:receipt,idempotencyKey:`strategic-report-final:${s.id}`});
   });
   // Supersede only the isolated model's report fragment; preserve the original as history.
   if(limitedProductId&&limitedProductId!==product.id)await db.execute(sql`UPDATE como_next_work_memory SET is_current=0 WHERE id=${limitedProductId} AND work_file_id=${sourceFileId} AND source_system='como_directive'`);
   const decisionId=Number(limitedReceipt.nextDecisionId||0);
   if(decisionId)await db.transaction(async tx=>{
    await tx.execute(sql`SELECT id FROM como_next_work_files WHERE id=${sourceFileId} FOR UPDATE`);
    const [d]=rows(await tx.execute(sql`SELECT * FROM como_next_decisions WHERE id=${decisionId} AND work_file_id=${sourceFileId} AND source_record_id=${`decision:executive-directive:${limitedUpdateId}`} AND decision_status='required' FOR UPDATE`));
    if(!d)return;
    const note='استُبدلت مذكرة النموذج الجزئية بتقرير البدائل الأربعة الكامل. قرار التريث قائم، والمطلوب الحالي مراجعة التقرير لا حسم خيار ناقص. لا موافقة أو رفض لأي بديل استثماري.';
    await tx.execute(sql`UPDATE como_next_decisions SET decision_status='superseded',decision_text=${note},evidence_reference=${`تقرير #${product.id}؛ توجيه التريث #420002`},decided_at=UTC_TIMESTAMP() WHERE id=${decisionId} AND decision_status='required'`);
    await appendEvent(tx,{userId,projectId:1,workFileId:sourceFileId,actorType:'manus',actorUserId:null,eventType:'partial_report_decision_superseded',summary:note,payload:{decisionId,originalTitle:d.title,originalQuestion:d.question,reportFileId,workProductId:product.id,choiceApproved:false},idempotencyKey:`${sourceKey}:supersede-partial-decision:${decisionId}`});
   });
   // Only a duplicated preparation action is fulfilled; no broad closure of other work.
   if(limitedActionId){
    const [a]=rows(await db.execute(sql`SELECT id,title,description,owner_type,action_status FROM como_next_actions WHERE id=${limitedActionId} AND work_file_id=${sourceFileId}`));
    if(a&&a.owner_type==='manus'&&/(?:إعداد|تحضير|صياغة).{0,30}تقرير.{0,30}(?:بدائل|خيارات)/.test(a.title)&&!['verified','cancelled'].includes(a.action_status)){
     if(a.action_status!=='completed_pending_verification')await changeActionStatusCommand({userId,actionId:Number(a.id),nextStatus:'completed_pending_verification',actorType:'manus',actorUserId:null});
     await changeActionStatusCommand({userId,actionId:Number(a.id),nextStatus:'verified',evidenceReference:`تقرير البدائل #${product.id}، مستند #${doc.id}`,actorType:'manus',actorUserId:null});
    }
    if(Number(s.id)===420004&&a&&a.owner_type==='manus'&&a.action_status==='open'&&/تثبيت اجتماع/.test(a.title)&&/15–20 أكتوبر/.test(a.description||'')){
     const reason='استُبدلت خطوة حجز الموعد التي اقترحها النموذج بمحاور اللقاء في التقرير الكامل. المالك طرح الاجتماع كبديل للاستكشاف ولم يحدد نوافذ 15–20 أكتوبر أو مدته؛ لا جهة اتصال مثبتة في مراسلات COMO المراجعة، ولا حجز أو إرسال. الخيار الثالث باقٍ للمناقشة.';
     await changeActionStatusCommand({userId,actionId:Number(a.id),nextStatus:'cancelled',evidenceReference:reason,actorType:'manus',actorUserId:null});
     await appendEvent(db,{userId,projectId:1,workFileId:sourceFileId,actionId:Number(a.id),actorType:'manus',actorUserId:null,eventType:'generated_meeting_plan_superseded',summary:reason,payload:{directiveId:420004,originalTitle:a.title,originalDescription:a.description,reportFileId,meetingBooked:false,optionRejected:false},idempotencyKey:`${sourceKey}:meeting-plan-superseded`});
    }
   }
  }
  const [readyReview]=rows(await db.execute(sql`SELECT owner_type,action_status FROM como_next_actions WHERE id=${Number(review.id)} AND work_file_id=${reportFileId}`));
  if(readyReview?.owner_type==='human'&&readyReview?.action_status==='waiting_external')await changeActionStatusCommand({userId,actionId:Number(review.id),nextStatus:'open',actorType:'manus',actorUserId:null,evidenceReference:`التقرير الكامل جاهز؛ مستند #${doc.id}، ليس انتظار رد خارجي`});
  await db.transaction(async tx=>{
   await tx.execute(sql`SELECT id FROM como_next_work_files WHERE id=${sourceFileId} FOR UPDATE`);
   const key='colliers-owner-sent-208:strategic-report-20261013';
   if(rows(await tx.execute(sql`SELECT id FROM como_next_work_file_events WHERE idempotency_key=${key} LIMIT 1`))[0])return;
   const [sent]=rows(await tx.execute(sql`SELECT * FROM como_next_communications WHERE id=1530002 AND work_file_id=${sourceFileId} AND user_id=${userId} AND direction='outbound' AND communication_status='sent' AND source_system='imap' AND source_record_id='imap:8f9b29e32c80ee32489cff2b:Sent:1767637253:208'`));
   if(!sent||!String(sent.from_text).toLowerCase().includes('a.zaqout@comodevelopments.com')||!String(sent.to_text).toLowerCase().includes('abeyratne.charitha@mena.colliers.com')||!String(sent.body).includes('initial financial analysis'))throw Error('colliers_sent_source_not_proven');
   const [waiting]=rows(await tx.execute(sql`SELECT action_status FROM como_next_actions WHERE id=60100 AND work_file_id=${sourceFileId}`));
   const [file]=rows(await tx.execute(sql`SELECT desired_outcome FROM como_next_work_files WHERE id=${sourceFileId}`));
   if(waiting?.action_status==='waiting_external'){
    const note='الفاتورة الثانية 7314002290 مسددة بإفادة المالك؛ لا إيصال بنكي مرفق. أرسل المالك متابعة التحليل المالي إلى شاريثا في 12 أكتوبر (Sent UID 208)، ورد غرانت برد غياب آلي لا يثبت التسليم. ننتظر التحليل المالي من كولييرز؛ لا مطالبة بإعادة إرسال المسودة، ولا مهلة رد مخترعة. تقرير البدائل الاستراتيجية جاهز في ملف ماجان #570001 وهو مستقل عن تسليم كولييرز.';
    await tx.execute(sql`UPDATE como_next_work_files SET desired_outcome=${note} WHERE id=${sourceFileId}`);
    await tx.execute(sql`UPDATE como_next_lifecycle_lanes SET status='waiting_external',source_kind='sent_message_reviewed',evidence_reference='رسالة COMO الصادرة #1530002؛ Sent UID 208؛ راجعها Manus من المصدر',next_action_id=NULL,next_action_title='انتظار رد كولييرز ومراجعة التقرير عند وصوله',next_owner_type='manus',attention_at=NULL WHERE work_file_id=${sourceFileId} AND lane_key='response:1500001' AND status='awaiting_owner_send'`);
    await tx.execute(sql`UPDATE como_next_lifecycle_lanes SET evidence_reference='طلب التحليل المالي؛ متابعة المالك Sent UID 208؛ التقرير لم يصل بعد',next_action_id=NULL,next_action_title='انتظار تسليم التحليل المالي من كولييرز',next_owner_type='manus' WHERE work_file_id=${sourceFileId} AND lane_key='deliverable:60100' AND status='waiting_external'`);
    await appendEvent(tx,{userId,projectId:1,workFileId:sourceFileId,actorType:'manus',actorUserId:null,eventType:'colliers_sent_display_reconciled',summary:'رُصد إرسال المالك لمتابعة كولييرز؛ أُزيلت مطالبة المسودة القديمة وبقي انتظار التقرير، دون تغيير السداد.',payload:{sentCommunicationId:1530002,sentUid:208,previousDesiredOutcome:file?.desired_outcome,reportDelivered:false,paymentChanged:false,ledgerIdentityNotInferred:true},idempotencyKey:key});
   }
  });
  const proof=rows(await db.execute(sql`SELECT sd.id,sd.status,d.state,d.work_product_id,d.update_id FROM como_next_staged_directives sd JOIN como_manus_dispatches d ON d.directive_id=sd.id WHERE sd.id IN (420001,420002,420003,420004,450001,450002) ORDER BY sd.id`));
  if(proof.length!==6||proof.some(x=>x.status!=='submitted'||x.state!=='completed'||Number(x.work_product_id)!==product.id))throw Error('final_receipt_not_saved');
  fs.writeFileSync(path.join(root,'final-receipts.json'),JSON.stringify({base,proof},null,2));
 }
 const sara=await readExecutiveWorkFile({memberId:'abdulrahman',displayName:'عبد الرحمن',role:'owner'} as any,JSON.stringify({work_file_id:reportFileId,focus:'overview'}));
 fs.writeFileSync(path.join(root,'sara-report-state.json'),JSON.stringify(sara,null,2));
 console.log(JSON.stringify(base));
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1)});
