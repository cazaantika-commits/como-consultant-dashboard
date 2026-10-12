import {TRPCError} from '@trpc/server';
import {sql} from 'drizzle-orm';
import {getDb} from '../db';
import {appendEvent,requireProjectAccess} from './comoNextCommands';
const rows=(v:any):any[]=>Array.isArray(v)&&Array.isArray(v[0])?v[0]:v;

/** Owner acknowledgement is sufficient for receipt; it is not a bank receipt or external attestation. */
export async function confirmActionReceiptCommand(input:{userId:number;actionId:number}) {
 const db=await getDb();if(!db)throw new TRPCError({code:'INTERNAL_SERVER_ERROR',message:'قاعدة البيانات غير متاحة'});
 const [identity]=rows(await db.execute(sql`SELECT project_id AS projectId,work_file_id AS workFileId FROM como_next_actions WHERE id=${input.actionId}`));
 if(!identity)throw new TRPCError({code:'NOT_FOUND',message:'لم يُعثر على المهمة'});
 await requireProjectAccess(db,Number(identity.projectId),input.userId,'write');
 return db.transaction(async tx=>{
  await tx.execute(sql`SELECT id FROM como_next_work_files WHERE id=${Number(identity.workFileId)} FOR UPDATE`);
  const [action]=rows(await tx.execute(sql`SELECT id,title,action_status AS status,updated_at AS updatedAt FROM como_next_actions WHERE id=${input.actionId} AND work_file_id=${Number(identity.workFileId)} FOR UPDATE`));
  if(!action)throw new TRPCError({code:'NOT_FOUND',message:'لم يُعثر على المهمة'});
  if(action.status==='verified')return {success:true,replayed:true,actionId:input.actionId,workFileId:Number(identity.workFileId),ownerReported:true};
  if(action.status!=='waiting_external')throw new TRPCError({code:'BAD_REQUEST',message:'زر الاستلام يخص مهمة في الانتظار فقط'});
  const now=new Date().toISOString().slice(0,19).replace('T',' ');
  const evidence=`إفادة المالك #${input.userId} بالاستلام عبر زر «تم الاستلام» بتاريخ ${now} UTC؛ المهمة: ${action.title}. وسيلة الاستلام غير محددة. ليست إيصال سداد أو موافقة على شروط.`;
  await tx.execute(sql`UPDATE como_next_actions SET action_status='verified',completed_at=${now},verified_at=${now},evidence_reference=${evidence},attention_at=NULL,follow_up_at=NULL WHERE id=${input.actionId} AND action_status='waiting_external'`);
  // Only the exact delivery/response associated with this action changes. Payment lanes never change here.
  await tx.execute(sql`UPDATE como_next_lifecycle_lanes SET status='received_owner_reported',source_kind='owner_statement',source_text=${evidence},evidence_reference=${evidence},recorded_at=${now},next_action_id=NULL,next_action_title=NULL,next_owner_type=NULL,attention_at=NULL WHERE user_id=${input.userId} AND work_file_id=${Number(identity.workFileId)} AND (action_id=${input.actionId} OR next_action_id=${input.actionId}) AND kind IN ('deliverable','external_response') AND status NOT IN ('cancelled','completed','verified','received_owner_reported')`);
  await appendEvent(tx,{userId:input.userId,projectId:Number(identity.projectId),workFileId:Number(identity.workFileId),actionId:input.actionId,actorType:'human',actorUserId:input.userId,eventType:'owner_receipt_confirmed',summary:`تم الاستلام: ${action.title}`,payload:{sourceKind:'owner_statement',actionId:input.actionId,paymentChanged:false,otherActionsChanged:false},idempotencyKey:`owner-receipt:${input.actionId}:${String(action.updatedAt)}`});
  const [remaining]=rows(await tx.execute(sql`SELECT
   (SELECT COUNT(*) FROM como_next_actions WHERE work_file_id=${Number(identity.workFileId)} AND action_status NOT IN ('verified','cancelled')) AS actions,
   (SELECT COUNT(*) FROM como_next_decisions WHERE work_file_id=${Number(identity.workFileId)} AND decision_status IN ('required','deferred')) AS decisions,
   (SELECT COUNT(*) FROM como_next_staged_directives WHERE work_file_id=${Number(identity.workFileId)} AND status IN ('pending','submitting','failed')) AS directives,
   (SELECT COUNT(*) FROM como_next_lifecycle_lanes WHERE work_file_id=${Number(identity.workFileId)} AND status NOT IN ('paid_owner_reported','paid_document_verified','completed','verified','cancelled','received_owner_reported')) AS lanes`));
  if(remaining && !Number(remaining.actions) && !Number(remaining.decisions) && !Number(remaining.directives) && !Number(remaining.lanes)){
   await tx.execute(sql`UPDATE como_next_work_files SET work_file_status='ready_to_close' WHERE id=${Number(identity.workFileId)} AND work_file_status NOT IN ('closed','cancelled')`);
  }
  return {success:true,replayed:false,actionId:input.actionId,workFileId:Number(identity.workFileId),ownerReported:true};
 });
}
