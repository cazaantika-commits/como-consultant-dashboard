import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {sql} from 'drizzle-orm';
import {getDb} from '../server/db';
import {appendEvent,requireProjectAccess} from '../server/services/comoNextCommands';
import {completeDispatchedMailReview,recordManusDispatchProgress,readDispatchForDirective} from '../server/services/comoManusDispatch';
import {readExecutiveWorkFile} from '../server/services/saraWorkFileReader';
const root='/home/ubuntu/reports/como-directive-1020001-2026-10-23';
const sha=(s:string|Buffer)=>createHash('sha256').update(s).digest('hex');
const norm=(s:string)=>s.replace(/\r\n?/g,'\n').trim();
const env=(s:string)=>Array.from(new Set(s.toLowerCase().match(/[a-z0-9.!#$%&'*+\/?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}/g)||[])).sort().join(',');
const rows=(r:any):any[]=>r[0];
const load=(name:string)=>JSON.parse(fs.readFileSync(`${root}/${name}.json`,'utf8'));
const save=(name:string,v:any)=>fs.writeFileSync(`${root}/${name}.json`,JSON.stringify(v,null,2)+'\n');
const sourceSha='da26a0282e89bb225291085648f17e30793dae529470f4a75b36e192e3230ae4';
const sourceId='<01c4dedddc3946bfa5a9ea5eb6db06a9@artecint.com>';
const report=`# الفلل الأربع — مراجعة رسالة أرتك22أكتوبر وإيصال التوجيه1020001

المصدر COMO2070001 / INBOX507، وصل22أكتوبر2026 الساعة11:20:13بتوقيتدبي من ثيودورا إلىعبدالرحمن، مع ماجد ووائلCC. البصمة الحالية ${sourceSha}. قُرئت الرسالة وخيط ملف الفلل المحفوظ23رسالة، بما فيه طلب المقاسات السابق Sent225 / COMO1770002، ونسخ اجتماع أرتك1830001 و1860001، ورسالة22أكتوبر ثم الرد2100001. لا إذن جديد باعتماد التصميم أو الانتقال للجهات.

## فحص الحزمة الفعلية

فُحصت الصفحات التسع كاملة نصيًا وبصريًا، وليس اعتمادًا على أسماء الملفات: وثيقة1740002لوحة الموقع وجداول المساحات، و1740003القبو العام، و1740004الأرضي العام، و1740005الأول العام، و1740006السطح العام. وثيقتا1740007و1740008 تعرضان قبو/أرضي وأول/سطح فيلا3، ووثيقتا1740009و1740010 تعرضان الطوابق ذاتها لفيلا4. المجموعة تظهر الأربع مع تفاصيل نموذج وسطي وجانبي. كلPDF صفحةA2، ولوحات الموقع1:200، والمساقط العامة1:125، وتفاصيل الفيلتين1:100. تحققت بصمات المرفقات العشرة من الملفات المحفوظة مقابل سجل المرفقات فيCOMO.

ظهرت أبعاد موزعة في المساقط وتفاصيل الغرف والمرور، وتظهر المسابح في الأرضي والخارج، والـVOIDفي المساقط، والمناسيب والدرجات. هذا يثبت وجود مخططات ذات مقاسات، وليس شهادة باكتمال كل قياس مطلوب أو سلامة التصميم أو استيفاء الفواصل الرأسية والزجاج. اللوحات كلها Site/FloorPlans؛ لا يوجد بينها مقطع أو سكيتش رأسي مستقل يحقق طلب التوضيح السابق. وجود علامات إحالة Sectionعلىمسقط لا يثبت وصول المقطع ذاته.

فُتح ZIP1740001،وفُحصت سلامةCRCوقُرئ كل محتواه. يحتوي تسعةPDFفقط، كلها مطابقة بايتًا وبصمةً للمرفقات التسعة المنفصلة. لاRVТأوRVTأوRFAأوIFCأوDWGأوغيرها داخل الأرشيف. تسميةNew_Villas_-_PDFs_and_Revit_Files_updated.zipلا تثبت تسليم نموذجRevit؛ لا يوجد نموذج أصلي يمكن فحصه ضمنهذهالرسالة. بياناتPDFتظهرAdobePDFLibraryولا تكفي وحدها للجزم ببرنامج إنشاء التصميم. فحص الحزمة مكتمل كنطاق مراجعة وارد؛ اعتماد التصميم والتحقق الهندسي التخصصي ليسا منجزين أو مأذونين.

## الرد والصادر

ثبت حيًا أن عبد الرحمن أرسل رد الاستلام الساعة18:56:40دبي22أكتوبر / SentUID230 / COMO2100001 / مراسلة3000001. نصه يطابق مسودة964 / مراسلة2970002 وبصمةالدفتر840001، والمستلمثيودوراCCماجدووائل مطابقان، والعنوان والخيط مطابقان. Referencesتربط بالوارد2070001. Message-IDتغيّر عند الإرسال وغابX-COMO-Draft-Keyعنالصادر؛ لذلك هذه مصالحة يدوية مصدرية بمطابقة فريدة كاملة، لا تعديلfallbackالتلقائي. لا مسودة964فيDrafts،ولا نسخة أخرى من الرد فيالصادر. لم يُرسلManusأي بريد ولم يُنشئ أو يعدل مسودة أو يعيد الشكر.

صُولحت مراسلة2970002والدفتر840001إلىsent/sent_confirmed بدليلSent230، وأُغلقت بطاقة عبد الرحمن2130001لإعادةإرسالالرد باعتبارهاverified. المراجعة2160001والتوجيه1020001مكتملان بإيصال رسمي ومخرجه داخلCOMO؛ إرسالعبدالرحمن مثبت لا يُنسب إلىManus.

## الخطوة التالية القائمة

يبقى انتظار1830001لوائل لتثبيت التوجّه والتعديلات الجديدة بعد نقاشه مع الشيخ عيسى. لا تُعاد مطالبات المقاطع أوRevitالقديمة الآن ولا يُعاد توجيه أرتك بتعديلات قبل ذلك. بعد ورود التوجّه، يتولىManusتنظيم الطلبات الداخلية ومطابقتها مع عبد الرحمن قبل إعداد الرسالة المناسبة؛ لا موعد مختلق أو بدء لRawan. تكليفRawanوفق إفادةعبدالرحمن باقٍ، ولن تبدأ قبل تثبيت الطلبات وتصحيحها معأرتك؛ نطاقاللاندسكيبغيرمحسوم.

لا يتغير سداد5586أو متابعةشاهدونسرين، ولا مسارات المسح/التربة أوالحملالكهربائي أو تصورالمنزلالذكي أو أيةتوجيهاتpendingغيرمسلّمة. وصول هذهالحزمة والشكر ليسا موافقة علىمرحلةتالية أوترخيصًا للتقديم للجهات. لا نشرللتطبيق أوتعديلنبضة أوTriggerأوScheduleTask. وصولالتوجيهاليوم واستيرادSent230يثبتان نشاطًا محددًا، وليس ضمانًا بأن استمرارية المزامنة أُصلحت.
`;
async function main(){
 const db=await getDb();assert(db,'database_unavailable');await requireProjectAccess(db,6,1,'write');
 const current=await readDispatchForDirective({directiveId:1020001});
 if(current?.state==='completed'){save('replay-receipt',{replayed:true,dispatch:current});console.log(JSON.stringify({replayed:true,workProductId:current.workProductId},null,2));return;}
 assert(current?.state==='running','dispatch_not_claimed');
 const [directive]=rows(await db.execute(sql`SELECT * FROM como_next_staged_directives WHERE id=1020001 AND user_id=1 AND project_id=6 AND work_file_id=390001 AND action_id=2160001 AND source_member_id='system:manus-action' AND status='submitting'`));assert(directive,'authority_changed');
 const [email]=rows(await db.execute(sql`SELECT * FROM como_next_email_messages WHERE id=2070001 AND user_id=1 AND linked_work_file_id=390001`));assert(email?.body_sha256===sourceSha&&email.message_id===sourceId,'source_changed');
 const pkg=load('package-proof');assert(pkg.zipCrcValid&&pkg.attachmentProof.length===10&&pkg.archiveEntries.length===9&&pkg.archiveEntries.every((e:any)=>e.fileName.toLowerCase().endsWith('.pdf')&&e.duplicateDocumentId),'archive_changed');
 const attachments=rows(await db.execute(sql`SELECT * FROM como_next_email_attachments WHERE email_message_id=2070001 ORDER BY ordinal`));
 for(const item of pkg.attachmentProof){assert(sha(fs.readFileSync(item.path))===item.verifiedSha256&&attachments.some(a=>Number(a.document_id)===item.documentId&&a.sha256===item.verifiedSha256&&a.storage_status==='stored'),'attachment_changed');}
 const proof=load('live-response-state');const matches=proof.sent.messages.filter((m:any)=>m.uid===230);assert(matches.length===1,'sent_source_missing');const live=matches[0];
 const [sent]=rows(await db.execute(sql`SELECT * FROM como_next_email_messages WHERE id=2100001 AND user_id=1 AND linked_work_file_id=390001 AND folder_name='Sent' AND imap_uid=230`));
 const [communication]=rows(await db.execute(sql`SELECT * FROM como_next_communications WHERE id=2970002 AND user_id=1 AND work_file_id=390001`));const [ledger]=rows(await db.execute(sql`SELECT * FROM como_mailbox_draft_ledger WHERE id=840001 AND user_id=1 AND work_file_id=390001 AND communication_id=2970002`));
 assert(sent&&live.messageId===sent.message_id&&norm(live.textBody)===norm(sent.body_text)&&norm(live.textBody)===norm(communication.body)&&sha(norm(live.textBody))===ledger.body_sha256,'sent_body_mismatch');
 assert(live.subject===email.subject&&live.subject===communication.subject&&env(live.to)===env(communication.to_text)&&env(live.cc)===env(communication.cc_text)&&live.from==='a.zaqout@comodevelopments.com'&&String(live.headers.references||'').includes(sourceId),'sent_envelope_thread_mismatch');
 assert(!proof.drafts.messages.some((m:any)=>m.uid===964||m.headers?.['x-como-draft-key']==='email-reply-draft:2070001'),'draft_still_present');
 assert(proof.sent.messages.filter((m:any)=>norm(m.textBody)===norm(communication.body)).length===1,'sent_not_unique');
 const before=load('protected-before');
 const state=async()=>({file:rows(await db.execute(sql`SELECT * FROM como_next_work_files WHERE id=390001 AND user_id=1`)),actions:rows(await db.execute(sql`SELECT * FROM como_next_actions WHERE work_file_id=390001 AND user_id=1 AND id<>2160001 ORDER BY id`)),lanes:rows(await db.execute(sql`SELECT * FROM como_next_lifecycle_lanes WHERE user_id=1 ORDER BY id`)),pending:rows(await db.execute(sql`SELECT * FROM como_next_staged_directives WHERE user_id=1 AND status='pending' ORDER BY id`)),communications:rows(await db.execute(sql`SELECT * FROM como_next_communications WHERE user_id=1 AND work_file_id=390001 ORDER BY id`)),ledger:rows(await db.execute(sql`SELECT * FROM como_mailbox_draft_ledger WHERE user_id=1 AND work_file_id=390001 ORDER BY id`))});
 assert.deepEqual(await state(),before,'scope_changed_before_application');
 await recordManusDispatchProgress({directiveId:1020001,summary:'الفلل الأربع — فُحصت9لوحاتPDFوZIPمطابق؛الأرشيفلايحويRevitرغماسمه،ولامقاطع/سكيتشاتمستقلة.ثبتردعبدالرحمن22أكتوبر18:56دبي/Sent230؛لاDraftجديد.ستُصالح2970002والدفتر840001وبطاقة2130001فقط،وانتظاروايل1830001والماليةباقيان.'});
 const sentTime=sent.received_at;
 await db.transaction(async tx=>{
  await tx.execute(sql`SELECT id FROM como_next_work_files WHERE id=390001 AND user_id=1 FOR UPDATE`);
  const [c]=rows(await tx.execute(sql`SELECT * FROM como_next_communications WHERE id=2970002 AND user_id=1 AND work_file_id=390001 FOR UPDATE`));const [l]=rows(await tx.execute(sql`SELECT * FROM como_mailbox_draft_ledger WHERE id=840001 AND user_id=1 AND work_file_id=390001 FOR UPDATE`));
  assert(c&&['archived','sent'].includes(c.communication_status)&&l&&['draft_saved','sent_confirmed'].includes(l.state),'sent_reconciliation_scope_changed');
  await tx.execute(sql`UPDATE como_next_communications SET communication_status='sent',sent_at=${sentTime},occurred_at=${sentTime},external_message_ref='Sent UID 230',evidence_reference='إرسال عبد الرحمن مطابق حيًا — Sent230 / COMO2100001؛ تطابق النص والعنوان والمستلمين وReferences، مصالحةManusفقطلا إرسال' WHERE id=2970002 AND user_id=1 AND work_file_id=390001`);
  await tx.execute(sql`UPDATE como_mailbox_draft_ledger SET state='sent_confirmed',sent_folder='Sent',sent_uid=230,confirmed_at=UTC_TIMESTAMP(),claim_token=NULL,claim_expires_at=NULL WHERE id=840001 AND user_id=1 AND work_file_id=390001 AND communication_id=2970002`);
  await tx.execute(sql`UPDATE como_next_actions SET action_status='verified',completed_at=${sentTime},verified_at=UTC_TIMESTAMP(),evidence_reference='Sent UID230 / COMO2100001 / مراسلة2970002؛ أرسلهاعبدالرحمن22أكتوبر18:56دبي،لاشكرمكرر',description=${'الفلل الأربع — أرسل عبد الرحمن رد استلام مخططات أرتك22أكتوبر18:56دبي إلىثيودوراCCماجدووائل.ثبتحيًاSent230/COMO2100001 مطابقًا للمسودة964؛ لا عمل إرسال باقٍ.لا اعتماد للتصميم أو موعد أو بدءRawan؛ انتظار وائل1830001 قائم.'} WHERE id=2130001 AND user_id=1 AND work_file_id=390001 AND owner_type='human' AND action_status='open'`);
  await appendEvent(tx,{userId:1,projectId:6,workFileId:390001,actionId:2130001,actorType:'manus',actorUserId:null,eventType:'artec_dimensioned_package_sent_observed',summary:'الفلل الأربع — ثبتإرسالعبدالرحمنالشكر22أكتوبر18:56دبي/Sent230؛أُغلقت2130001ومصالحةالدفتر،لامسودةمكررةأوإرسالManus.',payload:{directiveId:1020001,sourceEmailId:2070001,sentEmailId:2100001,sentUid:230,communicationId:2970002,ledgerId:840001,priorDraftUid:964,bodyMatched:true,envelopeMatched:true,threadMatched:true,messageIdChanged:true,manualReconciliation:true,manusSent:false},idempotencyKey:'artec-dimensioned:2070001:sent230-observed'});
 });
 const summary='الفلل الأربع — اكتملت مراجعة الوارد2070001 وحزمة9لوحاتPDFوZIPمطابق؛ توجد مقاسات، ولاRevitأو مقاطع/سكيتشات مستقلة رغم اسمZIP. أرسل عبد الرحمن الشكر22أكتوبر18:56دبي/Sent230/COMO2100001؛ صولحت2970002والدفتر840001وأُغلقت2130001، لا مسودة أو إرسال جديد. يبقى الانتظار1830001علىوائل لتثبيت التوجّه؛ لا استئناف للمخططات أو بدءRawan أو اعتماد تصميم أو تغيير سداد.';
 const result=await completeDispatchedMailReview({directiveId:1020001,bodySha256:sourceSha,reviewedDocumentIds:pkg.attachmentProof.map((a:any)=>Number(a.documentId)),summary,workProductBody:report,responseHandling:{kind:'already_replied',sentEmailId:2100001,evidence:'إرسالعبدالرحمنمثبتحيًاSentUID230بتاريخ22أكتوبر18:56:40دبي/COMO2100001، النص والعنوان والمستلمون مطابقون لمسودة964، Referencesللمصدر2070001، وDraftsخاليةمن964. مصالحةيدويةمصدريةللخيطبعدتغيرMessage-ID، لا تعديلfallbackولاإرسالManus.',nextStep:'الانتظارالقائم1830001علىوائللتثبيتالتوجهالجديدبعدنقاشه معالشيخعيسى؛ثمManusينظمالطلباتمععبدالرحمنقبلرسالةأرتك.لامطالبةقديمةبRevitأومقاطعولاوقتأوبدءRawanمفترض.'}});
 const workProductId=Number((result as any)?.workProductId||0);assert(workProductId,'review_receipt_missing');
 await db.transaction(async tx=>{
  await tx.execute(sql`UPDATE como_manus_dispatches SET next_action_id=1830001 WHERE directive_id=1020001 AND state='completed' AND work_product_id=${workProductId}`);
  for(const documentId of pkg.attachmentProof.map((a:any)=>Number(a.documentId)))await tx.execute(sql`INSERT IGNORE INTO como_next_work_memory_documents (project_id,work_file_id,memory_id,document_id,relation_type,source_system,source_record_id) VALUES (6,390001,${workProductId},${documentId},'source','como_mail_execution',${`1020001:doc:${documentId}`})`);
 });
 const after=await state();save('protected-after',after);
 assert.deepEqual(after.file,before.file,'work_file_changed');assert.deepEqual(after.lanes,before.lanes,'payment_or_lifecycle_changed');assert.deepEqual(after.pending,before.pending,'pending_directives_changed');
 assert.deepEqual(after.actions.filter(a=>a.id!==2130001),before.actions.filter((a:any)=>a.id!==2130001),'unrelated_villa_action_changed');assert.deepEqual(after.communications.filter(a=>a.id!==2970002),before.communications.filter((a:any)=>a.id!==2970002),'unrelated_communication_changed');assert.deepEqual(after.ledger.filter(a=>a.id!==840001),before.ledger.filter((a:any)=>a.id!==840001),'unrelated_ledger_changed');
 const sara:any=await readExecutiveWorkFile({memberId:'abdulrahman',nameAr:'عبد الرحمن',role:'owner'},JSON.stringify({work_file_id:390001,focus:'overview',question:'نتيجةمراجعةمخططات22أكتوبروحالةشكرعبدالرحمنSent230والانتظار1830001'}));assert(sara.found===true&&JSON.stringify(sara).includes('2100001')&&JSON.stringify(sara).includes(String(workProductId)),'sara_receipt_missing');save('sara-state',sara);
 save('review-receipt',{result,dispatch:await readDispatchForDirective({directiveId:1020001}),workProductId,sourceEmailId:2070001,sentEmailId:2100001,sentUid:230,communicationId:2970002,humanActionId:2130001,nextActionId:1830001,reviewedDocumentIds:pkg.attachmentProof.map((a:any)=>a.documentId),pdfPageCount:9,zipPdfDuplicates:9,revitFiles:0,dedicatedSectionsOrSketches:0,sourcePackageReviewCompleted:true,designApproved:false,manusSent:false,draftCreated:false,paymentChanged:false,protectedRecordsUnchanged:true,checkedAt:new Date().toISOString()});
 console.log(JSON.stringify({completed:true,workProductId,sentUid:230,sourceEmailId:2070001,closedActions:[2160001,2130001],waitingActionId:1830001,newDraft:false,manusSent:false,paymentChanged:false,saraFound:sara.found},null,2));
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1)});
