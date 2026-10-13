import fs from 'node:fs';
import {sql} from 'drizzle-orm';
import {getDb} from '../server/db';
import {createReplyDraftFromEmailCommand} from '../server/services/comoNextEmailInbox';
import {createActionCommand,changeActionStatusCommand,appendEvent,requireProjectAccess} from '../server/services/comoNextCommands';
import {completeDispatchedMailReview,readDispatchForDirective} from '../server/services/comoManusDispatch';
import {readExecutiveWorkFile} from '../server/services/saraWorkFileReader';
const root='/home/ubuntu/reports/neb-review-2026-10-13';
const report=fs.readFileSync(`${root}/NEB_Review_AR.md`,'utf8');
const body=`Dear Rex,

Thank you for submitting NEB's consultancy proposal and the proposed design team information for the Majan Shopping Centre project.

We confirm receipt of both attachments and appreciate the time and effort your team has put into the submission.

Kind regards,
Abdalrahman Zaqout
Development Director
COMO Real Estate Development L.L.C
M: +971 55 106 2668
E: a.zaqout@comodevelopments.com`;
const unwrap=(v:any)=>v[0] as any[];
async function main(){
 const db=await getDb();if(!db)throw Error('database_unavailable');
 await requireProjectAccess(db,1,1,'write');
 const source=unwrap(await db.execute(sql`SELECT sd.status,sd.user_id,sd.work_file_id,sd.action_id,sd.source_member_id,d.state FROM como_next_staged_directives sd JOIN como_manus_dispatches d ON d.directive_id=sd.id WHERE sd.id=330001`))[0];
 if(!source||source.user_id!==1||Number(source.work_file_id)!==480001||Number(source.action_id)!==1050001||source.source_member_id!=='system:manus-action')throw Error('authority_changed');
 if(!['running','completed'].includes(source.state))throw Error('not_claimed');
 const draft=await createReplyDraftFromEmailCommand({userId:1,emailId:1320001,body,ccText:'wael@zooma.ae, hossam@zooma.ae'});
 const comm=unwrap(await db.execute(sql`SELECT id,communication_status,external_message_ref FROM como_next_communications WHERE id=${draft.id}`))[0];
 if(!comm||!comm.external_message_ref)throw Error('draft_not_saved');
 const ref=String(comm.external_message_ref);
 const task=await createActionCommand({userId:1,workFileId:480001,title:'ماجان — مراجعة مسودة شكر NEB على استلام العرض',description:`حُفظت مسودة استلام فقط: ${ref}؛ مراسلة #${draft.id}. لا أسئلة تفاوض أو اعتماد أو بدء عمل. حزمة ماجان السابقة ملغاة؛ التقييم التجاري ينتظر تحديث المالك، ولا توجد متابعة إرسال تلقائي.`,acceptanceCriteria:'يراجع المالك المسودة ويرسلها إن أراد؛ لا يُعد حفظها إرسالًا، ولا يبدأ انتظار رد منه.',ownerType:'human',priority:'normal',idempotencyKey:'neb-ack-review:1320001',actorType:'manus',actorUserId:null});
 await db.transaction(async tx=>{
  await tx.execute(sql`SELECT id FROM como_next_work_files WHERE id=480001 FOR UPDATE`);
  await tx.execute(sql`UPDATE como_next_work_files SET title='ماجان — NEB: العرض مستلم ومراجع داخليًا',governing_question='ما الذي ورد في عرض NEB، وما الفروق المثبتة عن طلب العرض؟',desired_outcome='عرض NEB مستلم13أكتوبر ومراجع. مسودة شكر استلام فقط للمالك؛ لا تعيين أو تفاوض أو إحياء حزمة ماجان الملغاة. نتائج المقارنة محفوظة إلى حين تحديث المالك.',updated_at=UTC_TIMESTAMP() WHERE id=480001 AND user_id=1`);
  await tx.execute(sql`INSERT INTO como_next_lifecycle_lanes (user_id,project_id,work_file_id,lane_key,kind,title,status,source_kind,evidence_reference,source_text,action_id,next_action_id,next_action_title,next_owner_type,due_at,attention_at) VALUES (1,1,480001,'neb-proposal-received:1320001','deliverable','ماجان — عرض NEB مستلم ومراجع','received','como_email','COMO INBOX UID491 / email1320001 / documents1260002,1260003','وصل العرض13أكتوبر07:22:55دبي؛ ليس تأكيد استلام فقط. مراجع داخليًا، ولا يعني موافقة على التعيين أو أتعاب أو دفع.',1050001,${task.id},'مراجعة مسودة شكر الاستلام فقط','human',NULL,NULL) ON DUPLICATE KEY UPDATE evidence_reference=VALUES(evidence_reference),source_text=VALUES(source_text),next_action_id=VALUES(next_action_id)`);
  await tx.execute(sql`UPDATE como_next_intake_proposals SET review_status='applied',target_id=${task.id},review_note='اكتملت مراجعة العرض والتقييم الداخلي بمخرج Manus للتوجيه330001؛ مسودة استلام فقط. لا إعادة إنشاء مراجعة أو تفاوض أو إحياء حزمة المالك الملغاة.',reviewed_at=UTC_TIMESTAMP() WHERE id IN(1890001,1890002) AND work_file_id=480001 AND source_email_id=1320001 AND review_status='pending'`);
  await appendEvent(tx,{userId:1,projectId:1,workFileId:480001,actorType:'manus',actorUserId:null,eventType:'neb_proposal_received_and_reviewed',summary:'ماجان — وصل عرض NEB وفُحص مع الفريق؛ مسودة استلام فقط. لا انتظار تقديم عرض، ولا إحياء الحزمة الملغاة.',payload:{sourceEmailId:1320001,reviewedDocumentIds:[1260002,1260003],draftId:draft.id,mailboxDraftRef:ref,nextActionId:task.id,designFee:7570000,printedSupervisionFee:6457500,monthlyCalculatedSupervisionFee:6527500,packageCancelledPreserved:true,sent:false,paid:false},idempotencyKey:'neb-received-reviewed:1320001'});
 });
 for(const actionId of [540001,1050002]){
  let action=unwrap(await db.execute(sql`SELECT action_status FROM como_next_actions WHERE id=${actionId} AND work_file_id=480001 AND owner_type='manus'`))[0];
  if(!action||['verified','cancelled'].includes(action.action_status))continue;
  if(action.action_status!=='completed_pending_verification')await changeActionStatusCommand({userId:1,actionId,nextStatus:'completed_pending_verification',actorType:'manus',actorUserId:null});
  await changeActionStatusCommand({userId:1,actionId,nextStatus:'verified',evidenceReference:'فحص رسالة COMO1320001 ومستندي1260002/1260003؛ وصل عرض استشاري وتم تقييمه، ليس فاتورة أو طلب صرف. إيصال التوجيه330001.',actorType:'manus',actorUserId:null});
 }
 const summary=`ماجان لايف ستايل سنتر — راجعت عرض NEB13صفحة والفريق51صفحة مقابل طلب7أكتوبر. التصميم7,570,000 والإشراف المطبوع6,457,500درهم قبل الضريبة؛ فرق70,000درهم بين الجدول الشهري وإجماليه. فُحص النطاق والاستثناءات. انتهى انتظار العرض والمراجعة المالية المكررة. مسودة شكر ${ref} فقط للمالك؛ الحزمة السابقة تبقى ملغاة، لا تفاوض أو إرسال أو تعيين.`;
 const result=await completeDispatchedMailReview({directiveId:330001,bodySha256:'d43a29ebe9e92e1d749725778264fd27b6746f98ae7f26c9bd0f7a6b249650f8',reviewedDocumentIds:[1260002,1260003],summary,workProductBody:`${report}\n\n## إيصال التنفيذ الفعلي\nالمراسلة #${draft.id}: ${ref}. إجراء مراجعة المسودة #${task.id} للمالك؛ لا إرسال. أُنجزت المراجعتان الداخليتان #540001 و#1050002 بسبب وصول العرض وفحصه، لا بسبب دفع. ملف الحزمة #60014 لم يُعد فتحه.`,communicationDraftId:draft.id});
 await db.execute(sql`UPDATE como_manus_dispatches SET next_action_id=${task.id} WHERE directive_id=330001 AND state='completed'`);
 const sara=await readExecutiveWorkFile({memberId:'abdulrahman',nameAr:'عبد الرحمن',role:'owner'},JSON.stringify({work_file_id:480001,focus:'analysis'}));
 fs.writeFileSync(`${root}/sara-final-state.json`,JSON.stringify(sara,null,2));
 const final={directiveId:330001,draftId:draft.id,mailboxDraftRef:ref,nextActionId:task.id,result,dispatch:await readDispatchForDirective({directiveId:330001}),sent:false};
 fs.writeFileSync(`${root}/completed.json`,JSON.stringify(final,null,2));
 fs.writeFileSync(`${root}/Acknowledgement_Draft_EN.md`,`# Majan — NEB Proposal Acknowledgement\n\n${body}\n\n---\nSaved in COMO: ${ref}; not sent.\n`);
 console.log(JSON.stringify(final,null,2));
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1)});
