import { TRPCError } from '@trpc/server';
import { and, eq, notInArray, sql } from 'drizzle-orm';
import { comoNextActions, comoNextCommunications, comoNextEmailMessages, comoNextWorkFiles, comoNextWorkMemory } from '../../drizzle/schema';
import { getDb } from '../db';
import { appendEvent, requireProjectAccess } from './comoNextCommands';

export type LifecycleKind = 'payment' | 'deliverable' | 'external_response';
export function classifyLifecycleAction(action: { title: string; sourceSystem?: string | null }): LifecycleKind | 'ambiguous' | null {
 const text=action.title.toLowerCase();
 const payment=/فاتور|سداد|صرف|دفع|invoice|payment|disburs/.test(text) || action.sourceSystem==='finance_payment_watch';
 const deliverable=/تسليم|تقرير|تحليل مالي|نموذج مالي|deliverable|report|financial analysis|financial model/.test(text);
 if(payment && deliverable) return 'ambiguous';
 return payment?'payment':deliverable?'deliverable':null;
}
export function ownerAssertsPaymentPaid(text: string) {
 const t=text.replace(/[\u064B-\u065F]/g,'').toLowerCase();
 if(/(?:إذا|اذا|عندما|بعد أن|بعد ان)\s+(?:تم|يتم)\s*(?:ال)?(?:سداد|تسديد|دفع)|\b(?:if|when|once)\s+(?:the\s+)?(?:invoice|payment|we|i)\b/.test(t)) return false;
 if(/(?:لم|ما|ليس|غير|لا)\s*(?:يتم|تم|تسدد|نسدد|ندفع|مدفوع)|not\s+(?:yet\s+)?paid|unpaid|payment\s+(?:is\s+)?pending|هل\s+.*(?:سداد|دفع)|has\s+.*\s+been\s+paid\?/.test(t)) return false;
 return /(?:^|\s)(?:تم|جرى)\s*(?:تأكيد\s*)?(?:ال)?(?:سداد|تسديد|دفع)|الفاتورة\s*(?:مدفوعة|مسددة)|(?:invoice|payment).{0,65}(?:confirmed\s+as\s+paid|(?:is|has been|now|was)\s+(?:now\s+)?(?:confirmed\s+as\s+)?paid)|(?:we|i)\s+(?:have\s+)?paid/.test(t);
}
export function invoiceKeys(text: string) {
 return Array.from(new Set(Array.from(text.matchAll(/(?:invoice|فاتور[ةه])[^\d\n]{0,65}(\d{6,20})/gi)).map(m=>m[1])));
}
function resultRows<T>(result: unknown): T[] { return (Array.isArray(result)&&Array.isArray(result[0])?result[0]:result) as T[]; }
function nowSql(){return new Date().toISOString().slice(0,19).replace('T',' ')}
export async function readWorkFileLifecycle(workFileId: number) {
 const db=await getDb();if(!db)throw new Error('database_unavailable');
 const result=await db.execute(sql`SELECT lane_key AS \`key\`,kind,title,status,source_kind AS sourceKind,evidence_reference AS evidenceReference,source_text AS sourceText,recorded_at AS recordedAt,action_id AS actionId,next_action_id AS nextActionId,next_action_title AS nextActionTitle,next_owner_type AS nextOwnerType,due_at AS dueAt,attention_at AS attentionAt FROM como_next_lifecycle_lanes WHERE work_file_id=${workFileId} ORDER BY kind,lane_key`);
 return resultRows<Record<string, any>>(result);
}
export async function applyOwnerPaymentAssertion(input: {userId:number;workFileId:number;updateId:number;text:string;assertionReference?:string}) {
 if(!ownerAssertsPaymentPaid(input.text))return {applied:false,closedActionIds:[] as number[],lifecycleResults:[] as string[]};
 const db=await getDb();if(!db)throw new Error('database_unavailable');
 const [file]=await db.select().from(comoNextWorkFiles).where(eq(comoNextWorkFiles.id,input.workFileId)).limit(1);
 if(!file)throw new TRPCError({code:'NOT_FOUND',message:'ملف الموضوع غير موجود'});
 await requireProjectAccess(db,file.projectId,input.userId,'write');
 const sourceRef=input.assertionReference || `إفادة المالك في التوجيه #${input.updateId}`;
 return db.transaction(async tx=>{
  await tx.execute(sql`SELECT id FROM como_next_work_files WHERE id=${file.id} FOR UPDATE`);
  const actions=await tx.select().from(comoNextActions).where(and(eq(comoNextActions.workFileId,file.id),notInArray(comoNextActions.actionStatus,['verified','cancelled'])));
  const paymentActions=actions.filter(a=>classifyLifecycleAction(a)==='payment');
  const explicitKeys=invoiceKeys(input.text);
  const comms=await tx.select().from(comoNextCommunications).where(eq(comoNextCommunications.workFileId,file.id));
  const candidates=Array.from(new Set([...paymentActions.flatMap(a=>invoiceKeys(`${a.title} ${a.description||''}`)),...comms.filter(c=>/فاتور|invoice/i.test(c.subject)).flatMap(c=>invoiceKeys(`${c.subject} ${c.body}`))]));
  const matchingKeys=explicitKeys.length?explicitKeys.filter(k=>candidates.includes(k)):candidates;
  if(matchingKeys.length!==1 || explicitKeys.length>1 || (explicitKeys.length===1 && matchingKeys[0]!==explicitKeys[0]))throw new TRPCError({code:'PRECONDITION_FAILED',message:'إفادة السداد محفوظة، لكن توجد فواتير متعددة أو فاتورة غير محددة؛ لم يُغلق أي إجراء مالي قبل مطابقة الفاتورة الصحيحة.'});
  const invoice=matchingKeys[0];const laneKey=`invoice:${invoice}`;
  const existing=resultRows<any>(await tx.execute(sql`SELECT * FROM como_next_lifecycle_lanes WHERE work_file_id=${file.id} AND lane_key=${laneKey}`))[0];
  if(existing?.status==='paid_document_verified')return {applied:true,invoiceKey:invoice,closedActionIds:[],lifecycleResults:[`الفاتورة ${invoice}: لها دليل مستندي قائم؛ حفظ إفادتك لا يلغي ذلك الدليل، ولا يغلق تسليم التقرير.`]};
  const closedActionIds:number[]=[];
  for(const a of paymentActions){
   const keys=invoiceKeys(`${a.title} ${a.description||''}`);
   if(keys.length && !keys.includes(invoice))continue;
   if(!keys.length && paymentActions.length!==1)continue;
   if(a.sourceSystem==='finance_payment_watch') {
    const emailId=Number(a.sourceRecordId?.match(/^sent-email-(\d+)$/)?.[1]||0);
    const [email]=emailId?await tx.select().from(comoNextEmailMessages).where(eq(comoNextEmailMessages.id,emailId)).limit(1):[];
    if(!email || !invoiceKeys(`${email.subject} ${email.bodyText}`).includes(invoice))continue;
   }
   await tx.update(comoNextActions).set({title:`فاتورة ${invoice} — مسددة بإفادة المالك`,description:`انتهى انتظار السداد بالمصدر: ${sourceRef}. تاريخ الدفع الفعلي غير محدد وإيصال البنك غير مرفق؛ يبقى التقرير إجراءً مستقلاً.`,actionStatus:'verified',completedAt:nowSql(),verifiedAt:nowSql(),followUpAt:null,attentionAt:null,evidenceReference:`${sourceRef} — سداد مبلغ الفاتورة ${invoice} بإفادة المالك، لا إثبات بنكي`,acceptanceCriteria:'انتهى طلب تأكيد السداد بإفادة المالك الصريحة؛ لا يمثل إيصالًا أو تحققًا بنكيًا، ولا يغلق تسليم التقرير.'}).where(eq(comoNextActions.id,a.id));
   closedActionIds.push(a.id);
  }
  await tx.execute(sql`INSERT INTO como_next_lifecycle_lanes (user_id,project_id,work_file_id,lane_key,kind,title,status,source_kind,evidence_reference,source_text,recorded_at,action_id,next_owner_type) VALUES (${input.userId},${file.projectId},${file.id},${laneKey},'payment',${`سداد الفاتورة ${invoice}`},'paid_owner_reported','owner_statement',${sourceRef},${input.text},UTC_TIMESTAMP(),${closedActionIds[0]||existing?.action_id||null},NULL) ON DUPLICATE KEY UPDATE status='paid_owner_reported',source_kind='owner_statement',evidence_reference=VALUES(evidence_reference),source_text=VALUES(source_text),recorded_at=IF(status='paid_owner_reported',recorded_at,UTC_TIMESTAMP()),next_action_id=NULL,next_action_title=NULL,next_owner_type=NULL,attention_at=NULL`);
  const memoryKey=`payment-assertion:${input.updateId}:${invoice}`;
  const [oldMemory]=await tx.select({id:comoNextWorkMemory.id}).from(comoNextWorkMemory).where(and(eq(comoNextWorkMemory.sourceSystem,'como_lifecycle'),eq(comoNextWorkMemory.sourceRecordId,memoryKey))).limit(1);
  if(!oldMemory)await tx.insert(comoNextWorkMemory).values({projectId:file.projectId,workFileId:file.id,memoryType:'note',entryType:'payment_owner_statement',title:`فاتورة ${invoice} — مسددة بإفادة المالك`,body:`${sourceRef}\n${input.text}\n\nالمصدر إفادة المالك فقط؛ لم يُرفق إيصال بنكي بهذا التوجيه. تاريخ السداد الفعلي غير محدد. حالة تسليم التقرير مستقلة ولم تُغلق.`,sourceStatus:'paid_owner_reported',sourceSystem:'como_lifecycle',sourceRecordId:memoryKey,occurredAt:nowSql(),isCurrent:1});
  if(!existing || closedActionIds.length)await appendEvent(tx,{userId:input.userId,projectId:file.projectId,workFileId:file.id,actorType:'manus',actorUserId:null,eventType:'payment_owner_statement_applied',summary:`سداد الفاتورة ${invoice} بإفادة المالك؛ إغلاق انتظار الدفع فقط، وبقاء التقرير مستقلًا`,payload:{updateId:input.updateId,invoiceKey:invoice,closedActionIds:closedActionIds.join(','),bankReceipt:false},idempotencyKey:`lifecycle-paid:${input.updateId}:${invoice}`});
  // Old mailbox bytes remain untouched. Operational pointers are superseded, not erased.
  for(const c of comms.filter(c=>['draft','approved_for_send','archived'].includes(c.communicationStatus)&&invoiceKeys(`${c.subject} ${c.body}`).includes(invoice)&&/سداد|صرف|payment|invoice/i.test(c.subject)&&!/(?:report|analysis|تقرير|تحليل)/i.test(c.subject))){
   await tx.update(comoNextCommunications).set({communicationStatus:'cancelled',reviewNote:`استُبدلت بإفادة السداد: ${sourceRef}. لا ترسل تذكير الدفع القديم؛ محتوى البريد لم يُحذف.`}).where(eq(comoNextCommunications.id,c.id));
  }
  return {applied:true,invoiceKey:invoice,closedActionIds,lifecycleResults:[`الفاتورة ${invoice}: مسددة بإفادتك، وليس بإيصال بنكي. انتهى انتظار الدفع فقط؛ متابعة التقرير ما زالت مفتوحة.`]};
 });
}

export async function linkReportFollowupDraft(input:{userId:number;workFileId:number;updateId:number;communicationId:number;mailboxDraftRef:string}) {
 const db=await getDb();if(!db)throw new Error('database_unavailable');
 const [file]=await db.select().from(comoNextWorkFiles).where(eq(comoNextWorkFiles.id,input.workFileId)).limit(1);if(!file)throw new Error('work_file_missing');
 await requireProjectAccess(db,file.projectId,input.userId,'write');
 const actions=await db.select().from(comoNextActions).where(and(eq(comoNextActions.workFileId,file.id),notInArray(comoNextActions.actionStatus,['verified','cancelled'])));
 const reportActions=actions.filter(a=>classifyLifecycleAction(a)==='deliverable' && a.sourceSystem!=='como_lifecycle');
 if(reportActions.length!==1)return {lifecycleResults:[] as string[]};
 const report=reportActions[0];
 return db.transaction(async tx=>{
  await tx.execute(sql`SELECT id FROM como_next_work_files WHERE id=${file.id} FOR UPDATE`);
  const [currentReport]=await tx.select().from(comoNextActions).where(eq(comoNextActions.id,report.id)).limit(1);
  if(!currentReport || ['verified','cancelled'].includes(currentReport.actionStatus))return {lifecycleResults:[] as string[]};
  const existingResponse=resultRows<any>(await tx.execute(sql`SELECT status,next_action_id FROM como_next_lifecycle_lanes WHERE work_file_id=${file.id} AND lane_key=${`response:${input.communicationId}`} LIMIT 1`))[0];
  if(existingResponse)return {nextActionId:existingResponse.next_action_id?Number(existingResponse.next_action_id):undefined,lifecycleResults:['مسار متابعة هذه المسودة قائم؛ لم يُعد فتح التقرير أو انتظار الرد عند إعادة التوجيه.']};
  const sourceRecordId=`report-draft-review:${input.communicationId}`;
  const [old]=await tx.select().from(comoNextActions).where(and(eq(comoNextActions.sourceSystem,'como_lifecycle'),eq(comoNextActions.sourceRecordId,sourceRecordId))).limit(1);
  let nextActionId=old?.id;
  if(!nextActionId){const inserted=await tx.insert(comoNextActions).values({userId:input.userId,projectId:file.projectId,workFileId:file.id,title:'مراجعة وإرسال مسودة متابعة التقرير',description:`أعد Manus المسودة ${input.mailboxDraftRef}. المطلوب من المالك مراجعتها وإرسالها من بريد COMO؛ لا يوجد إرسال آلي.`,acceptanceCriteria:'إثبات Sent الفعلي للمسودة نفسها أو إلغاء المالك لها؛ إعداد المسودة ليس إرسالًا ولا استلامًا للتقرير.',ownerType:'human',ownerUserId:input.userId,actionStatus:'open',sourceSystem:'como_lifecycle',sourceRecordId,priority:'important'});nextActionId=Number(inserted[0].insertId);}
  await tx.update(comoNextActions).set({ownerType:'manus',ownerUserId:null,actionStatus:'waiting_external',followUpAt:null,attentionAt:null,description:`تسليم التقرير مستقل عن سداد الفاتورة. أعد Manus متابعة محفوظة ${input.mailboxDraftRef}، وتنتظر مراجعة وإرسال المالك. لا مهلة رد مخترعة ولا تذكير صرف على التقرير.`}).where(eq(comoNextActions.id,report.id));
  await tx.execute(sql`INSERT INTO como_next_lifecycle_lanes (user_id,project_id,work_file_id,lane_key,kind,title,status,source_kind,evidence_reference,source_text,recorded_at,action_id,next_action_id,next_action_title,next_owner_type,due_at,attention_at) VALUES (${input.userId},${file.projectId},${file.id},${`deliverable:${report.id}`},'deliverable',${report.title},'waiting_external','linked_correspondence',${`التوجيه #${input.updateId}؛ ${input.mailboxDraftRef}`},'باقٍ مستقلًا عن السداد؛ إعداد المسودة لا يثبت تسليم التقرير.',UTC_TIMESTAMP(),${report.id},${nextActionId},'مراجعة وإرسال مسودة متابعة التقرير','human',${report.dueAt},NULL) ON DUPLICATE KEY UPDATE status='waiting_external',evidence_reference=VALUES(evidence_reference),next_action_id=VALUES(next_action_id),next_action_title=VALUES(next_action_title),next_owner_type='human',attention_at=NULL`);
  await tx.execute(sql`INSERT INTO como_next_lifecycle_lanes (user_id,project_id,work_file_id,lane_key,kind,title,status,source_kind,evidence_reference,source_text,recorded_at,action_id,next_action_id,next_action_title,next_owner_type) VALUES (${input.userId},${file.projectId},${file.id},${`response:${input.communicationId}`},'external_response','متابعة الرد على طلب التقرير','awaiting_owner_send','mailbox_draft',${input.mailboxDraftRef},'لم تُرسل؛ يبدأ انتظار الرد فقط بعد ظهور الصادر الفعلي.',UTC_TIMESTAMP(),${report.id},${nextActionId},'مراجعة المسودة وإرسالها من البريد','human') ON DUPLICATE KEY UPDATE evidence_reference=VALUES(evidence_reference)`);
  if(!old)await appendEvent(tx,{userId:input.userId,projectId:file.projectId,workFileId:file.id,actionId:report.id,actorType:'manus',actorUserId:null,eventType:'report_followup_draft_prepared',summary:`متابعة التقرير جاهزة: ${input.mailboxDraftRef} — لم تُرسل، ولم يغلق التقرير`,payload:{communicationId:input.communicationId,nextActionId:nextActionId!,updateId:input.updateId,externalSideEffect:false},idempotencyKey:`report-draft-prepared:${input.communicationId}`});
  return {nextActionId,lifecycleResults:[`التقرير: لم يُسجل تسليمه؛ أعد Manus متابعة ${input.mailboxDraftRef}. دورك الآن مراجعة المسودة وإرسالها، ودور كولييرز تسليم التقرير. انتظار الرد لا يبدأ قبل الإرسال الفعلي.`]};
 });
}
