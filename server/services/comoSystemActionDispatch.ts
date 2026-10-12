import {sql} from 'drizzle-orm';
import {getDb} from '../db';
import {appendEvent} from './comoNextCommands';
import {claimSubmittingAndQueueManusDispatch,deliverQueuedManusDispatch} from './comoManusDispatch';
const rows=(v:any):any[]=>Array.isArray(v)&&Array.isArray(v[0])?v[0]:v;
export function isInternalSystemActionEligible(title:string){
 if(/^(?:مراجعة|تحليل|دراسة|تحضير|إعداد نقاط|قراءة|استخراج|Review|Analyze|Analyse|Prepare meeting)/i.test(title.trim()))return true;
 return !/إرسال|أرسل|ارسل|مراسلة|دفع|سداد|توقيع|تعيين|\bsend\b|\bpay\b|\bsign\b|\bappoint\w*/i.test(title);
}
export async function queueSystemManusAction(input:{userId:number;actionId:number}){
 const db=await getDb();if(!db)throw new Error('database_unavailable');
 const [a]=rows(await db.execute(sql`SELECT a.*,wf.work_file_status FROM como_next_actions a JOIN como_next_work_files wf ON wf.id=a.work_file_id WHERE a.id=${input.actionId} AND a.user_id=${input.userId} AND a.owner_type='manus' AND a.action_status='open' AND wf.work_file_status NOT IN ('closed','cancelled','waiting') AND NOT EXISTS (SELECT 1 FROM como_next_decisions g WHERE g.work_file_id=a.work_file_id AND (g.decision_status='required' OR (g.decision_status='deferred' AND g.due_at>UTC_TIMESTAMP()))) LIMIT 1`));
 if(!a)return {queued:false,reason:'not_eligible_internal_action'};
 if(!isInternalSystemActionEligible(a.title))return {queued:false,reason:'outside_internal_action_authority'};
 const key=`system-manus-action:${a.id}`;
 const directiveId=await db.transaction(async tx=>{
  await tx.execute(sql`SELECT id FROM como_next_work_files WHERE id=${Number(a.work_file_id)} FOR UPDATE`);
  const [old]=rows(await tx.execute(sql`SELECT id FROM como_next_staged_directives WHERE user_id=${input.userId} AND stage_key=${key} LIMIT 1`));if(old)return Number(old.id);
  const text=`طلب النظام: نفّذ العمل الداخلي المسند إلى Manus #${a.id}: ${a.title}.\n${a.description||''}\nمعيار الاكتمال: ${a.acceptance_criteria}.\nهذا ليس توجيهًا ماليًا جديدًا من المالك. لا تغيّر قراراته أو سجّل سدادًا أو أرسل مراسلة. إن احتاج العمل بحثًا أو مستندات، تولّه بنفسك وسجل النتيجة الفعلية. إنشاء خطوة لاحقة ليس إنجازًا.`;
  const inserted:any=await tx.execute(sql`INSERT INTO como_next_staged_directives (user_id,project_id,work_file_id,action_id,source,source_member_id,stage_key,directive_text,status) VALUES (${input.userId},${Number(a.project_id)},${Number(a.work_file_id)},${Number(a.id)},'manual','system:manus-action',${key},${text},'pending')`);
  const id=Number(inserted[0]?.insertId);if(!id)throw new Error('system_directive_not_created');
  await appendEvent(tx,{userId:input.userId,projectId:Number(a.project_id),workFileId:Number(a.work_file_id),actionId:Number(a.id),actorType:'system',actorUserId:null,eventType:'system_manus_work_requested',summary:'طلب النظام تنفيذ عمل Manus الداخلي عبر قناة وصول فعلية؛ لم يُنجز بعد',payload:{directiveId:id,actionId:Number(a.id),externalSideEffect:false},idempotencyKey:`system-work-request:${a.id}`});return id;
 });
 const queue=await claimSubmittingAndQueueManusDispatch({userId:input.userId,workFileId:Number(a.work_file_id),directiveId});
 const dispatch=queue.shouldDeliver?await deliverQueuedManusDispatch({directiveId}):queue.dispatch;
 return {queued:true,directiveId,dispatch,completed:dispatch?.status==='completed',externalSideEffects:false};
}
