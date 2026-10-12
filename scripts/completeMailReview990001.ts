import {sql} from 'drizzle-orm';
import {getDb} from '../server/db';
import {createReplyDraftFromEmailCommand} from '../server/services/comoNextEmailInbox';
import {completeDispatchedMailReview,readDispatchForDirective} from '../server/services/comoManusDispatch';
import {appendEvent,changeActionStatusCommand} from '../server/services/comoNextCommands';
const rows=(v:any):any[]=>Array.isArray(v)&&Array.isArray(v[0])?v[0]:v;
async function main(){
 const existing=await readDispatchForDirective({directiveId:210001});
 if(!['running','completed'].includes(existing?.state||''))throw Error('review_not_claimed');
 const body=`Dear Tedi,

Thank you for sharing Middle East Survey's quotation.

Before we consider approval, could you kindly have the payment terms aligned with your email: payment upon completion of the works and the Engineer's approval of the survey, rather than before submission of the report as stated in the quotation?

Please also confirm that the required plot coordinates, demarcation certificate and survey control information are available, and share your recommendation on the proposed scope and deliverables.

Thank you for your support.

Kind regards,
Abdalrahman Zaqout
Development Director
COMO Real Estate Development L.L.C
M: +971 55 106 2668
E: a.zaqout@comodevelopments.com`;
 const db=await getDb();if(!db)throw Error('database_unavailable');
 const [existingDraft]=rows(await db.execute(sql`SELECT c.id,c.external_message_ref FROM como_next_email_messages e JOIN como_next_communications c ON c.id=e.reply_draft_communication_id WHERE e.id=990001 AND e.user_id=1`));
 const draft:any=existingDraft?{id:Number(existingDraft.id),replayed:true,mailboxRef:existingDraft.external_message_ref}:await createReplyDraftFromEmailCommand({userId:1,emailId:990001,body,ccText:'wael@zooma.ae'});
 const draftRef=draft.mailboxRef|| (draft.mailboxDraft?.uid?`${draft.mailboxDraft.folder} UID ${draft.mailboxDraft.uid}`:`مراسلة مسودة #${draft.id}`);
 const work=`# مراجعة عرض المسح — بريد COMO #990001

## المصادر التي فُحصت
- رسالة ثيودورا واردة بتاريخ 12 أكتوبر 2026؛ بصمة النص 08c43992ff5fe5127b1cbce4da3e7f57f2af29bc6eb984f6ecaf084b1c794a6c.
- قرأت المرفق Q2026-3849.pdf، الوثيقة #1140003، جميع صفحاته السبع. قُرئت الصور #630001/#630002/#1140001/#1140002؛ هي شعارات وتواقيع بريد لا موافقات أو أدلة مالية. نُزلت المستندات من تخزين COMO وقورنت بصماتها.
- مراجعة الخيط: طلب عبد الرحمن في رده على محضر اجتماع 9 أكتوبر جمع العروض وتوصية أرتك للمراجعة، لا تعيين المختبر أو قبول سعره.

## النتيجة
- المورّد Middle East Survey Engineering LLC، العرض MES-Q2026-3849 بتاريخ 9 أكتوبر 2026 للقطعة 6180578. ليس فاتورة ضريبية مستحقة أو أمر شراء.
- النطاق: المسح الطبوغرافي، تحديد حدود القطعة حسب إحداثيات يقدمها العميل، وتجهيز مخطط المسح؛ شبكة مناسيب موصوفة كل 10 أمتار. لا يشمل فحص التربة الجيوتقني.
- السعر: 1,200 درهم + 60 درهم ضريبة = 1,260 درهم. ليست قيمة مدفوعة. العمل لقطعة واحدة وفق العرض، لا افتراض إضافات.
- التسليم: ملفات متوافقة مع AutoCAD أو MicroStation ومجموعة لوحات A1 بمناسيب وخصائص الموقع وصوره. التعبئة خلال ثلاثة أيام من إسناد كتابي قابل للتفاوض حسب حمل الشركة؛ مدة العمل المقترحة خمسة أيام عمل من البدء. لم يُحدد موعد تقويمي جديد.
- تعارض الدفع: البريد يقول الدفع بعد الإنجاز واعتماد المهندس؛ الصفحة6 من العرض تطلب CDC/TT قبل تقديم التقرير. يجب توحيد النص قبل أي اعتماد.
- على العميل تقديم إحداثيات وشهادة تحديد الحدود والتصاريح وحدود المسح. رسوم نقاط ضبط البلدية الرسمية 5,020 درهم مشروطة بطلبها رسميًا وليست مضافة إلى مبلغ العرض تلقائيًا؛ لا اعتراض على رسوم حكومية متعارف عليها، ولا اعتبارها مستحقة الآن.
- صفحة7 تحتوي إقرار قبول وتكليف موجّه لأرتك؛ لم يوقّع أو يختم Manus أو يقبل نيابة عن المالك.

## ما نُفذ وما بقي
- حُفظ استيضاح مهني إلى ثيودورا مع نسخ وائل ومجد من الخيط، ${draftRef}، مراسلة #${draft.id}، بلا إرسال. يطلب توحيد شرط الدفع وتأكيد مرجعية الإحداثيات والضبط والتوصية. لا قبول أو دفع أو وعد موعد.
- أُنجزت مراجعة Manus الداخلية فقط. المطلوب من المالك الآن مراجعة/إرسال الاستيضاح إن أراد؛ التعاقد النهائي يبقى غير معتمد.
- انتظار عروض فحص التربة وتوصية أرتك يبقى مستقلًا. وصول عرض طبوغرافي واحد لا يغلق كل عروض المسح والتربة.
- لا تذكير خارجي أو انتظار رد جديد يبدأ من حفظ المسودة؛ لا SMTP أو واتساب أو دفع أو توقيع أو تعيين.
`;
 const summary=`راجعت عرض المسح MES-Q2026-3849 ومرفقاته: إجمالي 1,260 درهم، ليس فاتورة مستحقة. تعارض دفع قبل تسليم التقرير مع بريد الدفع بعد الإنجاز والاعتماد. حُفظ استيضاح ${draftRef} بلا إرسال أو اعتماد؛ فحص التربة باقٍ مستقلًا.`;
 const result=await completeDispatchedMailReview({directiveId:210001,bodySha256:'08c43992ff5fe5127b1cbce4da3e7f57f2af29bc6eb984f6ecaf084b1c794a6c',reviewedDocumentIds:[630001,630002,1140001,1140002,1140003],summary,workProductBody:work});
 const [duplicateReview]=rows(await db.execute(sql`SELECT id,action_status FROM como_next_actions WHERE id=720001 AND user_id=1 AND work_file_id=390001 AND description LIKE '%990001%'`));
 if(duplicateReview?.action_status==='open')await changeActionStatusCommand({userId:1,actionId:720001,nextStatus:'in_progress',actorType:'manus',actorUserId:null});
 if(['open','in_progress'].includes(duplicateReview?.action_status))await changeActionStatusCommand({userId:1,actionId:720001,nextStatus:'completed_pending_verification',actorType:'manus',actorUserId:null});
 if(['open','in_progress','completed_pending_verification'].includes(duplicateReview?.action_status))await changeActionStatusCommand({userId:1,actionId:720001,nextStatus:'verified',actorType:'manus',actorUserId:null,evidenceReference:'إيصال مراجعة Manus للتوجيه210001؛ بريدCOMO990001؛ وثيقة1140003؛ لا اعتماد صرف'});
 await db.transaction(async tx=>{
  await tx.execute(sql`SELECT id FROM como_next_work_files WHERE id=390001 FOR UPDATE`);
  await tx.execute(sql`UPDATE como_next_actions SET description='وصل عرض المسح الطبوغرافي MES-Q2026-3849 في بريدCOMO990001 ورُوجع. استيضاح شرط الدفع محفوظ دون إرسال؛ لا اعتماد أو تعيين. يظل انتظار عروض فحص التربة وتوصية أرتك مستقلًا. وصول عرض طبوغرافي واحد لا يغلق الملف كله.' WHERE id=570005 AND work_file_id=390001 AND action_status='waiting_external'`);
  await appendEvent(tx,{userId:1,projectId:6,workFileId:390001,actionId:570005,actorType:'manus',actorUserId:null,eventType:'survey_quotation_review_reconciled',summary:'رُوجع العرض الطبوغرافي وحُفظ الاستيضاح؛ انتظار عروض التربة باقٍ مستقلًا دون اعتماد أو دفع',payload:{emailId:990001,directiveId:210001,communicationId:draft.id,draftRef,externalSideEffect:false},idempotencyKey:'survey-quotation-review-reconciled:990001'});
 });
 console.log(JSON.stringify({draft,result,sent:false},null,2));
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1)});
