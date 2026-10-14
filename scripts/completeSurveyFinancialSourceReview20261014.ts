import fs from 'node:fs';
import {sql} from 'drizzle-orm';
import {getDb} from '../server/db';
import {completeDispatchedFinancialDocumentReview} from '../server/services/comoManusDispatch';
const root='/home/ubuntu/reports/como-linkage-repair-2026-10-14';
const rows=(v:any):any[]=>Array.isArray(v)&&Array.isArray(v[0])?v[0]:v;
async function main(){
 const db=await getDb();if(!db)throw Error('database_unavailable');
 const snapshot=async()=>rows(await db.execute(sql`SELECT * FROM como_next_lifecycle_lanes WHERE user_id=1 AND kind='payment' ORDER BY id`));
 const before=await snapshot();
 const [source]=rows(await db.execute(sql`SELECT body_sha256 FROM como_next_email_messages WHERE id=1200001 AND user_id=1 AND linked_work_file_id=390001`));
 const [doc]=rows(await db.execute(sql`SELECT document_id,sha256 FROM como_next_email_attachments WHERE email_message_id=1200001 AND mime_type='application/pdf'`));
 if(!doc||doc.sha256!=='cd6117826ed444ad2eafa1d1af80f8007320638af7450961b2d2d36e2de27446')throw Error('survey_pdf_not_matched');
 const [effect]=rows(await db.execute(sql`SELECT * FROM como_next_work_file_updates WHERE id=1620001 AND user_id=1 AND action_id=1590001 AND work_file_id=390001`));
 const [stage]=rows(await db.execute(sql`SELECT directive_text FROM como_next_staged_directives WHERE id=660001 AND source_member_id='system:manus-action' AND user_id=1`));
 if(!effect||effect.update_text!==stage?.directive_text)throw Error('failed_processor_effect_not_matched');
 const summary='الفلل الأربعة — مراجعة عرض المسح MES/2026-3849_1: عرض موقع لوائل للقطعة6180578، إجمالي1260درهم شاملVAT، وليس فاتورة مستحقة جديدة ولا دليل سداد. أُنجز فحص المصدر؛ لا طلب صرف مكرر أو إرسال.';
 const work=`مصدر COMO1200001/INBOX UID489، PDF Q2026-3849_1.pdf؛المستند#${doc.document_id}، SHA-256=${doc.sha256}. فحص المصدرالحيوالصفحاتالسبع وصفحةالقبولالبصرية موثقفي1200001/report.json. المرجعMES/2026-3849_1بتاريخ12أكتوبر2026،العميلMajesticElitePropertiesLLC، النطاقTopographicSurveyوPlotDemarcation للقطعة6180578. اسموتوقيعوختمAHMADWAILMHDNAZEMALKASEM علىصفحةالقبول. الإجماليالمطبوع1260درهمشاملVAT. التصنيف:quotation،ليسفاتورةجديدةولاإثباتدفعأوإنجازالمسح. الصادر215يثبتسبقإحالةالمالك،ولاينشأطلبصرفمكرر. تبقىمتابعةتنفيذالمسحوفحصالتربة570005 والسدادفيالمسارالمستقل؛لمتتغيرطلباتهأو حالته. تعثّرالمنفذالمحدود660001بعدحفظتحديث1620001وقبلإنتاجتحليلأوإجراء؛ صولحذلكالأثر فقطدونإعادةالمنفذ.`;
 const receipt=await completeDispatchedFinancialDocumentReview({directiveId:660001,bodySha256:source.body_sha256,reviewedDocumentIds:[Number(doc.document_id)],classification:'quotation',summary,workProductBody:work});
 await db.execute(sql`UPDATE como_next_work_file_updates SET analysis_status='applied',analysis_summary=${summary},reviewed_at=UTC_TIMESTAMP() WHERE id=1620001 AND user_id=1 AND action_id=1590001 AND update_text=${stage.directive_text} AND analysis_status='not_requested'`);
 if(JSON.stringify(before)!==JSON.stringify(await snapshot()))throw Error('payment_records_changed');
 fs.writeFileSync(root+'/financial-660001-completed.json',JSON.stringify({receipt,paymentRecordsUnchanged:true,processorNotRerun:true,newPaymentRequest:false,sent:false,checkedAt:new Date().toISOString()},null,2)+'\n');
 console.log(JSON.stringify(receipt,null,2));
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1)});
