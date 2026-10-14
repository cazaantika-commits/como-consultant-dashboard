import fs from 'node:fs';
import {sql} from 'drizzle-orm';
import {getDb} from '../server/db';
import {createReplyDraftFromEmailCommand} from '../server/services/comoNextEmailInbox';
import {createActionCommand,appendEvent,requireProjectAccess} from '../server/services/comoNextCommands';
import {completeDispatchedMailReview,readDispatchForDirective,recordManusDispatchProgress} from '../server/services/comoManusDispatch';
import {readExecutiveWorkFile} from '../server/services/saraWorkFileReader';
const root='/home/ubuntu/reports/colliers-v3-review-2026-10-14';
const directiveId=480001,emailId=1470001,workFileId=60017,actionId=1290001,documentId=1380001;
const expectedHash='72dce978429af5e52b3aec463c1ff0bf26d52a6a70c4f6404a15fc73921f1236';
const report=fs.readFileSync(`${root}/Colliers_V3_Financial_Review_AR.md`,'utf8');
const body=`Dear Charitha,

Thank you for sharing the updated report and the initial financial analysis for the Majan project.

We confirm receipt of the attachment and appreciate the work your team has put into preparing the analysis.

Kind regards,
Abdalrahman Zaqout
Development Director
COMO Real Estate Development L.L.C.
M: +971 55 106 2668
E: a.zaqout@comodevelopments.com`;
const rows=(v:any)=>v[0] as any[];
async function finalizeRecordedResult(db:any){
 const dispatch=await readDispatchForDirective({directiveId});
 if(dispatch?.state!=='completed'||!dispatch.workProductId||!dispatch.communicationDraftId||!dispatch.nextActionId)throw Error('completed_receipt_missing');
 const [output]=rows(await db.execute(sql`SELECT id,body FROM como_next_work_memory WHERE id=${dispatch.workProductId} AND work_file_id=${workFileId} AND source_record_id='dispatch-review:480001'`));
 if(!output?.body.includes(String(emailId)))throw Error('review_output_not_proven');
 const payment=rows(await db.execute(sql`SELECT * FROM como_next_lifecycle_lanes WHERE work_file_id=${workFileId} AND kind='payment'`));
 const before=JSON.parse(fs.readFileSync(`${root}/lanes-before.json`,'utf8')).filter((l:any)=>l.kind==='payment');
 for(const old of before){const current=payment.find((l:any)=>Number(l.id)===Number(old.id));if(!current||['status','source_kind','evidence_reference','source_text','action_id','next_action_id'].some(k=>String(current[k]??'')!==String(old[k]??'')))throw Error('payment_lane_changed');}
 await db.transaction(async(tx:any)=>{
  await tx.execute(sql`SELECT id FROM como_next_work_files WHERE id=570001 FOR UPDATE`);
  const [exists]=rows(await tx.execute(sql`SELECT id FROM como_next_work_memory WHERE work_file_id=570001 AND source_system='como_mail_execution' AND source_record_id='colliers-v3-related-update:1470001' LIMIT 1`));
  if(!exists)await tx.execute(sql`INSERT INTO como_next_work_memory (project_id,work_file_id,memory_type,entry_type,title,body,source_status,source_system,source_record_id,is_current,occurred_at) VALUES (1,570001,'note','financial_source_update','ماجان — وصل التحليل المالي الأولي لكولييرز',${`تقرير البدائل13أكتوبر محفوظ كتاريخ؛ عبارة انتظار المالية تجاوزها وصولV0.3: COMO1470001/المستند1380001 في13أكتوبر17:19:31دبي. المراجعة الكاملة في ملف60017، مخرج${dispatch.workProductId}. عائد المشروع11.5%عنداستبعادالأرض؛ لا ينقل للبديل السكني ولا يحسم التطوير مقابل البيع. قرارالتريث وإلغاءالحزمة والمدخلات المالية محفوظة.`},'reviewed','como_mail_execution','colliers-v3-related-update:1470001',1,UTC_TIMESTAMP())`);
  await appendEvent(tx,{userId:1,projectId:1,workFileId:570001,actorType:'manus',actorUserId:null,eventType:'colliers_financial_source_updated',summary:'ماجان — وصل التحليل المالي الأولي؛ مراجعته محفوظة بملف كولييرز. تقريرالبدائل السابق تاريخ مؤرخ، لا تحديث لقرار التطوير أو المالية.',payload:{sourceEmailId:emailId,documentId,sourceWorkFileId:workFileId,workProductId:dispatch.workProductId,financialInputsChanged:false},idempotencyKey:'colliers-v3-related-update:1470001'});
 });
 const sara=await readExecutiveWorkFile({memberId:'abdulrahman',nameAr:'عبد الرحمن',role:'owner'},JSON.stringify({work_file_id:workFileId,focus:'analysis'}));
 fs.writeFileSync(`${root}/sara-final-state.json`,JSON.stringify(sara,null,2));
 fs.writeFileSync(`${root}/Acknowledgement_Draft_EN.md`,`# Majan — Colliers Initial Financial Analysis: Receipt\n\n${body}\n\n---\nSaved in COMO: ${dispatch.mailboxDraftRef}; not sent. CC: Grant Nash, Nicholas Brown, Wael.\n`);
 const final={directiveId,sourceEmailId:emailId,documentId,draftId:dispatch.communicationDraftId,mailboxDraftRef:dispatch.mailboxDraftRef,nextActionId:dispatch.nextActionId,paymentLaneUnchanged:true,dispatch,sent:false,documentationRecovered:true};
 fs.writeFileSync(`${root}/completed.json`,JSON.stringify(final,null,2));console.log(JSON.stringify(final,null,2));
}
async function main(){
 const db=await getDb();if(!db)throw Error('database_unavailable');await requireProjectAccess(db,1,1,'write');
 const [source]=rows(await db.execute(sql`SELECT sd.*,d.state,d.claim_token FROM como_next_staged_directives sd JOIN como_manus_dispatches d ON d.directive_id=sd.id WHERE sd.id=${directiveId}`));
 if(!source||Number(source.user_id)!==1||Number(source.project_id)!==1||Number(source.work_file_id)!==workFileId||Number(source.action_id)!==actionId||source.source_member_id!=='system:manus-action')throw Error('authority_changed');
 if(source.state==='completed'){await finalizeRecordedResult(db);return;}
 if(source.state!=='running'||source.status!=='submitting'||!String(source.claim_token).startsWith('worker:'))throw Error('dispatch_not_claimed');
 const [email]=rows(await db.execute(sql`SELECT * FROM como_next_email_messages WHERE id=${emailId} AND user_id=1 AND linked_work_file_id=${workFileId}`));
 if(email?.body_sha256!==expectedHash||email.folder_name!=='INBOX')throw Error('source_changed');
 const [attachment]=rows(await db.execute(sql`SELECT * FROM como_next_email_attachments WHERE email_message_id=${emailId} AND document_id=${documentId} AND storage_status='stored'`));if(!attachment)throw Error('attachment_changed');
 const live=JSON.parse(fs.readFileSync(`${root}/live-outbox-before.json`,'utf8'));
 if(!live.Sent||!live.Drafts)throw Error('live_outbox_not_checked');
 if(live.Sent.messages.some((m:any)=>/V0\.3/i.test(m.subject)&&new Date(m.date).getTime()>=new Date(email.received_at).getTime()))throw Error('owner_reply_observed_requires_reconciliation');
 if(live.Drafts.messages.some((m:any)=>/V0\.3/i.test(m.subject))&&!email.reply_draft_communication_id)throw Error('unlinked_draft_observed_do_not_duplicate');
 await recordManusDispatchProgress({directiveId,summary:'ماجان — فُحص تقرير كولييرز143صفحة والتحليل المالي. الأرقام المطبوعة تعيد11.5%عائد المشروع؛ أبرز الملاحظات قيمة الأرض وصافي التدفق لخدمة الدين والاعتماد على البيع النهائي. جارٍ حفظ النتيجة وتسوية انتظار التسليم؛ السداد مستقل.'});
 const draft=await createReplyDraftFromEmailCommand({userId:1,emailId,body,ccText:'grant.nash@mena.colliers.com, nicholas.brown@mena.colliers.com, wael@zooma.ae'});
 const [comm]=rows(await db.execute(sql`SELECT c.id,c.external_message_ref,c.communication_status,l.state FROM como_next_communications c JOIN como_mailbox_draft_ledger l ON l.communication_id=c.id WHERE c.id=${draft.id} AND c.user_id=1 AND c.work_file_id=${workFileId} AND l.state IN ('draft_saved','sent_confirmed')`));
 if(!comm?.external_message_ref)throw Error('draft_not_proven');const ref=String(comm.external_message_ref);
 const task=await createActionCommand({userId:1,workFileId,title:'ماجان — مراجعة خلاصة التحليل المالي لكولييرز ومسودة الاستلام',description:`وصل التحليل المالي الأولي وفُحص. الخلاصة محفوظة في ملف كولييرز؛ مسودة استلام فقط ${ref}، مراسلة#${draft.id}. راجع النتيجة والمسودة إن رغبت بإرسالها. لا قبول مالي أو موعد اجتماع مؤكد أو طلب إعادة سداد. أبرز النقاط: تكلفة395.7مليون، عائد11.5%، قيمة الأرض مستبعدة وتغطية الدين ضيقة.`,acceptanceCriteria:'مراجعة المالك للنتيجة؛ إرسال أو إلغاء المسودة وفق اختياره. لا يعتبر حفظ المسودة إرسالًا أو اعتمادًا للدراسة.',ownerType:'human',priority:'important',actorType:'manus',actorUserId:null,idempotencyKey:'colliers-v3-owner-review:1470001'});
 const paymentBefore=rows(await db.execute(sql`SELECT * FROM como_next_lifecycle_lanes WHERE work_file_id=${workFileId} AND kind='payment'`));
 await db.transaction(async tx=>{
  await tx.execute(sql`SELECT id FROM como_next_work_files WHERE id=${workFileId} FOR UPDATE`);
  const [current]=rows(await tx.execute(sql`SELECT body_sha256 FROM como_next_email_messages WHERE id=${emailId} AND linked_work_file_id=${workFileId} FOR UPDATE`));if(current?.body_sha256!==expectedHash)throw Error('source_changed');
  const [waiting]=rows(await tx.execute(sql`SELECT * FROM como_next_actions WHERE id=60100 AND work_file_id=${workFileId} FOR UPDATE`));if(!waiting||!['waiting_external','completed_pending_verification','verified'].includes(waiting.action_status))throw Error('report_wait_changed');
  await tx.execute(sql`UPDATE como_next_actions SET title='ماجان — التحليل المالي الأولي من كولييرز مستلم ومراجع',description='وردت نسخةV0.3من143صفحة في13أكتوبر17:19:31دبي، وفُحص التحليل المالي داخليًا14أكتوبر. هذا استلام للتسليم الأولي، لا اعتماد للاستثمار أو استلامExcel أو إغلاق مراحل تنقيح مستقبلية. السداد مستقل.',action_status='verified',completed_at=COALESCE(completed_at,UTC_TIMESTAMP()),verified_at=COALESCE(verified_at,UTC_TIMESTAMP()),evidence_reference='COMO1470001/INBOX496؛ مستند1380001/المسودةالثالثة،143صفحة؛ إيصال مراجعة التوجيه480001',follow_up_at=NULL,attention_at=NULL WHERE id=60100 AND work_file_id=${workFileId}`);
  await tx.execute(sql`UPDATE como_next_lifecycle_lanes SET title='ماجان — التحليل المالي الأولي مستلم ومراجع',status='received',source_kind='como_email',evidence_reference='COMO1470001/INBOX496؛ مستند1380001/ColliersDraftV3',source_text='وصل التحليل المالي الأولي13أكتوبر17:19:31دبي؛ فُحص14أكتوبر. استلامPDFليس اعتمادًا ولا استلامExcel. السداد المسجل مستقل.',next_action_id=${task.id},next_action_title='مراجعة خلاصة التحليل ومسودة الاستلام',next_owner_type='human',due_at=NULL,attention_at=NULL WHERE user_id=1 AND work_file_id=${workFileId} AND kind='deliverable' AND action_id=60100 AND status IN ('waiting_external','received')`);
  await tx.execute(sql`UPDATE como_next_lifecycle_lanes SET status='response_received',title='كولييرز — وصل الرد متضمنًا التحليل المالي الأولي',source_kind='como_email',evidence_reference='COMO1470001/INBOX496؛ مستند1380001',source_text='الرد الفعلي يتضمن التحليل المالي؛ ليس رد غياب آليًا. انتهى انتظار الرد على طلب التسليم الأولي. لا موعد اجتماع مؤكد.',next_action_id=NULL,next_action_title=NULL,next_owner_type='manus',due_at=NULL,attention_at=NULL WHERE user_id=1 AND work_file_id=${workFileId} AND kind='external_response' AND lane_key='response:1500001' AND status IN ('waiting_external','response_received')`);
  await tx.execute(sql`UPDATE como_next_work_files SET title='ماجان — كولييرز: التحليل المالي مستلم ومراجع',governing_question='ما نتائج التحليل المالي الأولي، وما الافتراضات التي تحتاج تحققًا قبل تقرير اتجاه التطوير؟',desired_outcome=${`وصلتV0.3منكولييرز13أكتوبر، وراجعManus143صفحة والمالية14أكتوبر. النتائج والنقاط محفوظة؛ ${ref}شكر استلام فقط للمالك. انتهى انتظار التسليم الأولي، ولا موعد اجتماع مؤكد أو اعتماد للاستثمار. فاتورة7314002290مسددةبإفادةالمالكلا بإيصال بنكي؛ لم تتغير. قرارالتريثوحزمةماجانالملغاة محفوظان.`},work_file_status='open',updated_at=UTC_TIMESTAMP() WHERE id=${workFileId} AND user_id=1`);
  await tx.execute(sql`UPDATE como_next_intake_proposals SET review_status='applied',target_id=${task.id},review_note='أُنجزت مراجعةManusللتوجيه480001بفحص143صفحة وحفظ النتائج؛ أُغلق انتظار التسليم الأولي فقط. لا إنشاء مراجعة أخرى أو19أكتوبر كموعد مفترض. مسودة استلام واحدة للمراجعة، لا إرسال أو اعتماد.',reviewed_at=UTC_TIMESTAMP() WHERE work_file_id=${workFileId} AND source_email_id=${emailId} AND id IN (2010001,2010002) AND review_status='pending'`);
  await appendEvent(tx,{userId:1,projectId:1,workFileId,actionId:60100,actorType:'manus',actorUserId:null,eventType:'colliers_initial_financial_analysis_received',summary:'ماجان — وصل التحليل المالي الأولي وفُحص؛ انتهى انتظار تسليمه. السداد مستقل ولا اعتماد للاستثمار أو موعد مخترع.',payload:{directiveId,sourceEmailId:emailId,documentId,reviewedPages:143,draftId:draft.id,mailboxDraftRef:ref,nextActionId:task.id,received:true,investmentApproved:false,paymentChanged:false,sent:false},idempotencyKey:'colliers-v3-received-reviewed:1470001'});
 });
 const summary=`ماجان — وصل التحليل المالي الأولي من كولييرزوفُحص143صفحة. تكلفة395.7مليون؛ عائدالمشروع11.5%والملكية14.2%وفقالمصدر. الحساب المطبوعةمتسقة؛ قيمةالأرضمستبعدةوتغطيةالدينأقلمن1مرةفي2035و2038والعائد يعتمدعلىبيع2043. أُغلق60100للتسليم الأولي فقط. ${ref}شكر استلام فقط للمالك؛ السداد وقرارالتريث مستقلان، لا موعد أوإرسال أوتعديلمالية.`;
 const result=await completeDispatchedMailReview({directiveId,bodySha256:expectedHash,reviewedDocumentIds:[documentId],summary,workProductBody:`${report}\n\n## إيصال التنفيذ داخل COMO\nرسالة المصدر${emailId}، مستند${documentId}، التوجيه${directiveId}. مسودة${ref}/مراسلة${draft.id}؛ إجراءمراجعةالمالك${task.id}. لمتُرسلرسالةأوتتغيرالماليةأوسدادالفاتورة.`,communicationDraftId:draft.id});
 await db.execute(sql`UPDATE como_manus_dispatches SET next_action_id=${task.id} WHERE directive_id=${directiveId} AND state='completed'`);
 const paymentAfter=rows(await db.execute(sql`SELECT * FROM como_next_lifecycle_lanes WHERE work_file_id=${workFileId} AND kind='payment'`));if(JSON.stringify(paymentBefore)!==JSON.stringify(paymentAfter))throw Error('payment_lane_changed');
 await db.transaction(async tx=>{
  await tx.execute(sql`SELECT id FROM como_next_work_files WHERE id=570001 FOR UPDATE`);
  const [exists]=rows(await tx.execute(sql`SELECT id FROM como_next_work_memory WHERE work_file_id=570001 AND source_system='como_mail_execution' AND source_record_id='colliers-v3-related-update:1470001' LIMIT 1`));
  if(!exists)await tx.execute(sql`INSERT INTO como_next_work_memory (project_id,work_file_id,memory_type,entry_type,title,body,source_status,source_system,source_record_id,is_current,occurred_at) VALUES (1,570001,'note','financial_source_update','ماجان — تحديث المصدر: وصل التحليل المالي الأولي لكولييرز',${`تقريرالبدائل13أكتوبريظلنسختهالتاريخية، لكن عبارةانتظارالماليةتجاوزهاوصولV0.3: COMO1470001/المستند1380001،13أكتوبر17:19:31دبي. المراجعةالكاملةبملف60017، مخرج${result.workProductId}. عائدالمشروع11.5%عنداستبعادالأرض؛ لاينقلإلىالبديلالسكنيأويحسمالتطويرمقابلالبيع. قرارالتريثوإلغاءحزمةالاستشاريينوالمدخلاتالماليةمحفوظة.`},'reviewed','como_mail_execution','colliers-v3-related-update:1470001',1,UTC_TIMESTAMP())`);
  await appendEvent(tx,{userId:1,projectId:1,workFileId:570001,actorType:'manus',actorUserId:null,eventType:'colliers_financial_source_updated',summary:'وصلت دراسة كولييرزالماليةالأولية؛ تُقرأ مراجعتهافيملفها بدل عبارةانتظارالتقرير في النسخة التاريخية. لا تحديث لقرارالمول أوالبديلالسكني أوالمالية.',payload:{sourceEmailId:emailId,documentId,sourceWorkFileId:workFileId,workProductId:result.workProductId,financialInputsChanged:false},idempotencyKey:'colliers-v3-related-update:1470001'});
 });
 const sara=await readExecutiveWorkFile({memberId:'abdulrahman',nameAr:'عبد الرحمن',role:'owner'},JSON.stringify({work_file_id:workFileId,focus:'analysis'}));
 fs.writeFileSync(`${root}/sara-final-state.json`,JSON.stringify(sara,null,2));
 fs.writeFileSync(`${root}/Acknowledgement_Draft_EN.md`,`# Majan — Colliers Initial Financial Analysis: Receipt\n\n${body}\n\n---\nSaved in COMO: ${ref}; not sent. CC: Grant Nash, Nicholas Brown, Wael.\n`);
 const final={directiveId,sourceEmailId:emailId,documentId,draftId:draft.id,mailboxDraftRef:ref,nextActionId:task.id,paymentLaneUnchanged:true,result,dispatch:await readDispatchForDirective({directiveId}),sent:false};
 fs.writeFileSync(`${root}/completed.json`,JSON.stringify(final,null,2));console.log(JSON.stringify(final,null,2));
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1)});
