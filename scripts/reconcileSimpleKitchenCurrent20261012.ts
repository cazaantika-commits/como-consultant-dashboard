import fs from 'node:fs';
import {sql} from 'drizzle-orm';
import {getDb} from '../server/db';
import {linkEmailToWorkFileCommand} from '../server/services/comoNextEmailInbox';
import {appendEvent} from '../server/services/comoNextCommands';
const rows=(v:any):any[]=>Array.isArray(v)&&Array.isArray(v[0])?v[0]:v;
const key='kitchen-current:2026-10-12T13:42:46Z';
async function main(){
 const db=await getDb();if(!db)throw Error('database_unavailable');
 const [source]=rows(await db.execute(sql`SELECT * FROM como_next_email_messages WHERE id=1200002 AND user_id=1`));
 if(source?.folder_name!=='Sent'||source.imap_uid!==214||source.from_email!=='a.zaqout@comodevelopments.com'||!source.to_text.includes('shahid@zooma.ae')||!source.body_text.includes('6180578')||!source.body_text.includes('current service-charge status'))throw Error('shahid_actual_sent_not_proven');
 const [draft]=rows(await db.execute(sql`SELECT body FROM como_next_communications WHERE id=1830001 AND user_id=1 AND work_file_id=540001`));
 if(String(draft?.body||'').trim()!==String(source.body_text).trim())throw Error('owner_changed_request_needs_review');
 await linkEmailToWorkFileCommand({userId:1,emailId:1200002,projectId:1,workFileId:540001,suppressReplyDraft:true});
 await db.transaction(async tx=>{
  await tx.execute(sql`SELECT id FROM como_next_work_files WHERE id=540001 FOR UPDATE`);
  const [seen]=rows(await tx.execute(sql`SELECT id FROM como_next_work_file_events WHERE user_id=1 AND idempotency_key=${key+':shahid'}`));
  if(!seen){
   await tx.execute(sql`UPDATE como_next_communications SET communication_status='sent',sent_at=${source.received_at},occurred_at=${source.received_at},external_message_ref=${source.message_id},evidence_reference='COMO Sent UID214 / email1200002: exact body and recipients verified' WHERE id=1830001 AND user_id=1`);
   await tx.execute(sql`UPDATE como_next_work_files SET title='المشاريع — ماجان، الجداف، ند الشبا: وثائق الأراضي ورسوم الخدمات',desired_outcome='أُرسل طلب الوثائق وبيان رسوم الخدمات إلى شاهد؛ بانتظار الاستلام. الأولوية للفلل الأربع6180578. لا طلب دفع.' WHERE id=540001 AND user_id=1`);
   await tx.execute(sql`UPDATE como_next_actions SET title='شاهد — بانتظار وثائق الأراضي وبيان رسوم الخدمات',action_status='waiting_external',owner_type='manus',attention_at=NULL,follow_up_at=NULL,description='طلب شاهد أرسله المالك15:53دبي12أكتوبر، مع وائل ونسرين نسخة. بانتظار المستندات وبيان رسوم الخدمات للأراضي؛ الأولوية6180578. عند الاستلام بأي وسيلة يضغط المالكتم الاستلام.',acceptance_criteria='استلام الوثائق وبيان الحالة، أو إفادة المالك بالاستلام عبر زرتم الاستلام؛ لا تثبت الحالةطلبدفع أو إيصالسداد.',evidence_reference='COMO Sent UID214 / email1200002' WHERE id=990001 AND action_status='open'`);
   await appendEvent(tx,{userId:1,projectId:1,workFileId:540001,actionId:990001,actorType:'manus',actorUserId:null,eventType:'owner_sent_request_reconciled',summary:'المشاريع — ماجان، الجداف، ند الشبا: أرسل المالك الطلب إلى شاهد؛ بانتظار الاستلام.',payload:{sourceEmailId:1200002,sentUid:214,paymentRequested:false},idempotencyKey:key+':shahid'});
  }
 });
 const completedReviews=[{actionId:960001,directiveId:240002,fileId:390001,projectId:6,note:'مطابقة الفاتورة5586 بالعقد الموقّع أُنجزت في مراجعةManus240002؛ مسودة940ثم تحويلوائلللصرف مثبتان. المطابقةليستسدادًا.'},{actionId:750003,directiveId:240003,fileId:60020,projectId:1,note:'رسالةبينوي1080001راجعتها مهمةManus240003؛ ردانتظارلاوثيقةماليةلصرف. لا تطلبمراجعةماليةمكررة.'}];
 for(const item of completedReviews){
  const [review]=rows(await db.execute(sql`SELECT result_json FROM como_next_staged_directives WHERE id=${item.directiveId} AND user_id=1 AND status='submitted'`));
  if(!review||!JSON.parse(review.result_json||'{}').completedNow)throw Error('review_completion_not_proven:'+item.directiveId);
  await db.transaction(async tx=>{
   await tx.execute(sql`SELECT id FROM como_next_work_files WHERE id=${item.fileId} FOR UPDATE`);
   const change=await tx.execute(sql`UPDATE como_next_actions SET action_status='verified',completed_at=UTC_TIMESTAMP(),verified_at=UTC_TIMESTAMP(),attention_at=NULL,follow_up_at=NULL,evidence_reference=${item.note} WHERE id=${item.actionId} AND user_id=1 AND action_status NOT IN ('verified','cancelled')`);
   if(Number((change as any)[0]?.affectedRows))await appendEvent(tx,{userId:1,projectId:item.projectId,workFileId:item.fileId,actionId:item.actionId,actorType:'manus',actorUserId:null,eventType:'completed_review_reconciled',summary:item.note,payload:{directiveId:item.directiveId,paymentChanged:false},idempotencyKey:key+':review:'+item.actionId});
  });
 }
 const oldNotes=[{id:1530001,fileId:60017,projectId:1,note:'ملاحظة الردالآلي محفوظةفيالبريد960001والملف؛ ليستعملًا أو موعد48ساعةمعتمدًا. متابعةالتقريرمستمرةفي60100.'},{id:1620001,fileId:510001,projectId:1,note:'ردكيفليرراجعناهفي270001؛ استكشافمبدئي لا قبولتعيين أو أتعاب. وثقناه ومسودة941جاهزةدونقبولخارجية.'},{id:1770001,fileId:390001,projectId:6,note:'الصادر1110002وطلبصرفالماليةموثقان؛ لا إعادةالتوثيق. تصحيح: مهلةالعقد15يومًامنتاريخالفاتورة9أكتوبرلاتاريخالإرسال12أكتوبر؛ لااعتماد27أكتوبرمنالمقترح.'},{id:1800001,fileId:390001,projectId:6,note:'عرضالمسحالمحولموثقفيSent212/1140001والإرسال870001متحقق؛ انتظارالتوقيع930001يبقى. الوقتالمعروضقديمًاUTC، الإرسالأصبح13:18دبي.'}];
 for(const p of oldNotes)await db.transaction(async tx=>{
  await tx.execute(sql`SELECT id FROM como_next_work_files WHERE id=${p.fileId} FOR UPDATE`);
  const change=await tx.execute(sql`UPDATE como_next_intake_proposals SET review_status='dismissed',review_note=${p.note},reviewed_by_user_id=1,reviewed_at=UTC_TIMESTAMP() WHERE id=${p.id} AND user_id=1 AND proposal_kind='note' AND review_status='pending'`);
  if(Number((change as any)[0]?.affectedRows))await appendEvent(tx,{userId:1,projectId:p.projectId,workFileId:p.fileId,actorType:'manus',actorUserId:null,eventType:'documentation_duplicate_filed',summary:p.note,payload:{proposalId:p.id,sourcePreserved:true},idempotencyKey:key+':note:'+p.id});
 });
 console.log(JSON.stringify({shahidWaitingAction:990001,ownerSentUid:214,completedReviewActions:[960001,750003],notesFiled:oldNotes.map(p=>p.id),externalSideEffect:false}));
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1)});
