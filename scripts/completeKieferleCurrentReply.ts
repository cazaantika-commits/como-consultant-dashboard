import {createReplyDraftFromEmailCommand} from '../server/services/comoNextEmailInbox';
import {completeDispatchedMailReview} from '../server/services/comoManusDispatch';
const body=`Dear Conni,

Thank you for your thoughtful response and willingness to explore the arrangement.

Just to clarify, the arrangement we are considering would involve the international retail architect leading Architecture, Interior Design and Landscape across the design stages, rather than at Concept Design only. We would therefore like to discuss K&P's potential role in the engineering disciplines, coordination, BIM and Architect of Record services on that basis.

Please share a few suitable times for a short call so that we can go through the division of responsibilities together.

Warm regards,
Abdalrahman Zaqout
Development Director
COMO Real Estate Development L.L.C
M: +971 55 106 2668
E: a.zaqout@comodevelopments.com`;
async function main(){
 const draft=await createReplyDraftFromEmailCommand({userId:1,emailId:1050001,body,ccText:'wael@zooma.ae'});
 const ref=draft.mailboxDraft?.uid?`${draft.mailboxDraft.folder} UID ${draft.mailboxDraft.uid}`:`مراسلة #${draft.id}`;
 const result=await completeDispatchedMailReview({directiveId:270001,bodySha256:'a1115d576ce31d465982e205177dddafe25a55970acad0858461f654409303d6',reviewedDocumentIds:[],communicationDraftId:draft.id,summary:`راجعت رد كورنيليا وربطته بملف كيفلير510001، لا Design International60019. لديها استعداد للاستكشاف لا قبول أتعاب؛ تحفظها مفهوم فقط بينما ترتيبنا دولي عبر المراحل. حُفظ توضيح مهني ${ref} بلا إرسال أو تعيين أو موعد مؤكد.`,workProductBody:`# مراجعة بريد COMO #1050001 — كيفلير وشركاؤه

## المصدر والربط
قرأت الرد الحالي من كورنيليا وخيطه، وقارنته برسالة عبدالرحمن الصادرة8أكتوبر #780001/Sent UID203 والمراسلة1470001. الاقتراح الآلي60019 خطأ؛ ذلك ملف Design International ومسودته930 مستقلة. رُبط رد كيفلير بالملف المثبت510001 مع أثر مصدر محفوظ، دون إعادة إحياء العرض السابق أو اجتماع6أغسطس. المرفق inline صورة توقيع فقط في البيانات الوصفية؛ لا أزعم مراجعة عرض تجاري مرفق لأنه غير موجود.

## ما ثبت
كورنيليا مستعدة لاستكشاف التعاون وفهم تقسيم المسؤوليات. المثال الذي ذكرته هو تسلم تصميم مفهوم معتمد وإكمال المراحل دون استمرار مصمم المفهوم؛ هذا يختلف عن رسالة COMO8أكتوبر التي تتصور استمرار المعماري الدولي للمعماري والداخلي واللاندسكيب عبر المراحل، مع استشاري رئيسي للهندسة والتنسيق وBIM وArchitect of Record. الاستعداد لا يثبت موافقة على نطاق أو رسوم أو تعيين.

## التنفيذ والخطوة التالية
جهزت مسودة قصيرة محترمة توضح هذا الفرق وتطلب اقتراح أوقات مكالمة، ${ref}، المراسلة${draft.id}. النسخ من الخيط تشمل وائل وكورنيليا البديلة وشيروِن؛ لا ميا قبل وجود موعد مؤكد يخص وائل. لا تفاوض أتعاب أو قبول عرض أو التزام تعاقدي أو إحياء العرض القديم.

اكتملت مراجعة Manus وصياغة التوضيح. المطلوب من المالك مراجعة/إرسال المسودة فقط، وما بعد ذلك يُبنى على الرد الفعلي. حفظ المسودة ليس إرسالًا ولا يبدأ انتظار رد أو تذكيرًا؛ لا SMTP أو واتساب أو دفع أو توقيع.`});
 console.log(JSON.stringify({draft,result,sent:false},null,2));
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1)});
