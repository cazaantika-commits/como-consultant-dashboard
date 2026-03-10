import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Helper to insert service
async function insertService(serviceCode, nameAr, descriptionAr, stageCode, externalParty, internalOwner, isMandatory, expectedDurationDays) {
  await conn.execute(`
    INSERT IGNORE INTO lifecycle_services
      (serviceCode, nameAr, descriptionAr, stageCode, externalParty, internalOwner, isMandatory, expectedDurationDays)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [serviceCode, nameAr, descriptionAr, stageCode, externalParty, internalOwner, isMandatory, expectedDurationDays]);
}

// Helper to insert requirement
async function insertReq(serviceCode, requirementCode, reqType, nameAr, descriptionAr, sourceNote, isMandatory, timing, internalOwner) {
  await conn.execute(`
    INSERT IGNORE INTO lifecycle_requirements
      (serviceCode, requirementCode, reqType, nameAr, descriptionAr, sourceNote, isMandatory, timing, internalOwner)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [serviceCode, requirementCode, reqType, nameAr, descriptionAr, sourceNote, isMandatory, timing, internalOwner]);
}

// ─── STG-01: تأسيس المطوّر وتسجيله لدى RERA ──────────────────────────────
// Stage already exists in DB from initial seed, just update description if needed
await conn.execute(`
  UPDATE lifecycle_stages SET
    descriptionAr = 'الحصول على الرخصة التجارية وتسجيل الشركة كمطوّر عقاري معتمد لدى RERA',
    sortOrder = 1
  WHERE stageCode = 'STG-01'
`);
console.log('✅ STG-01 stage updated');

// STG-01 Services
await insertService('SRV-SETUP-DED-LICENSE', 'الحصول على رخصة التطوير العقاري من دائرة التنمية الاقتصادية',
  'إتمام إجراءات إصدار الرخصة التجارية لنشاط التطوير العقاري (كود 6499004)',
  'STG-01', 'دائرة التنمية الاقتصادية (DED)', 'الشؤون القانونية + الإدارة العليا', 1, 30);

await insertService('SRV-SETUP-RERA-TRAINING', 'استكمال تدريب واختبار RERA',
  'الحصول على شهادة تدريب RERA المعتمدة من معهد دبي العقاري (DREI) واجتياز الاختبار',
  'STG-01', 'RERA (معهد دبي العقاري)', 'الموظف المعني / إدارة الموارد البشرية', 1, 14);

await insertService('SRV-SETUP-POLICE-CERT', 'الحصول على شهادة حسن السيرة والسلوك',
  'التقديم والحصول على شهادة حسن السيرة والسلوك من شرطة دبي',
  'STG-01', 'شرطة دبي', 'الموظف المعني / إدارة الموارد البشرية', 1, 7);

await insertService('SRV-SETUP-RERA-APPROVAL', 'الحصول على موافقة RERA للمطور',
  'التقديم عبر نظام تراخيصي للحصول على اعتماد RERA كمطور عقاري',
  'STG-01', 'RERA (نظام تراخيصي)', 'الشؤون القانونية + إدارة التطوير', 1, 7);

await insertService('SRV-SETUP-RERA-REGISTRATION', 'تسجيل الشركة لدى RERA كمطور',
  'استكمال التسجيل النهائي للشركة في سجل المطورين لدى RERA',
  'STG-01', 'RERA', 'الشؤون القانونية + إدارة التطوير', 1, 5);

console.log('✅ STG-01 services inserted (5 services)');

// STG-01 Requirements - SRV-SETUP-DED-LICENSE
await insertReq('SRV-SETUP-DED-LICENSE','REQ-DED-DOC-01','document','شهادة حجز الاسم التجاري','شهادة رسمية بحجز الاسم التجاري المختار من دائرة التنمية الاقتصادية','رفع ملف',1,'قبل التقديم','الشؤون القانونية');
await insertReq('SRV-SETUP-DED-LICENSE','REQ-DED-DOC-02','document','الموافقة المبدئية من دائرة التنمية الاقتصادية','موافقة أولية من DED على طلب الرخصة','رفع ملف',1,'قبل التقديم النهائي','الشؤون القانونية');
await insertReq('SRV-SETUP-DED-LICENSE','REQ-DED-DOC-03','document','عقد الإيجار موثّق عبر إيجاري','عقد إيجار مكتب الشركة مسجل رسمياً في نظام إيجاري','رفع ملف',1,'قبل إصدار الرخصة','الإدارة الإدارية');
await insertReq('SRV-SETUP-DED-LICENSE','REQ-DED-DOC-04','document','عقد التأسيس (MoA) موثّق','عقد تأسيس الشركة موثّق من كاتب العدل','رفع ملف',1,'قبل إصدار الرخصة','الشؤون القانونية');
await insertReq('SRV-SETUP-DED-LICENSE','REQ-DED-DOC-05','document','جوازات سفر الشركاء','نسخ من جوازات سفر جميع الشركاء في الشركة','رفع ملف',1,'قبل التقديم','الشؤون القانونية');
await insertReq('SRV-SETUP-DED-LICENSE','REQ-DED-DOC-06','document','إيصال سداد رسوم الرخصة التجارية','إثبات دفع رسوم إصدار الرخصة التجارية','رفع ملف',1,'بعد الدفع','الإدارة المالية');
await insertReq('SRV-SETUP-DED-LICENSE','REQ-DED-DOC-07','document','الرخصة التجارية (نسخة نهائية)','نسخة رسمية من رخصة التطوير العقاري الصادرة من DED','رفع ملف',1,'بعد الإصدار','الشؤون القانونية');
await insertReq('SRV-SETUP-DED-LICENSE','REQ-DED-DATA-01','data','النشاط التجاري المختار','كود النشاط التجاري: 6499004 - التطوير العقاري','إدخال في النظام',1,'قبل التقديم','الشؤون القانونية');
await insertReq('SRV-SETUP-DED-LICENSE','REQ-DED-DATA-02','data','الاسم التجاري للشركة','الاسم التجاري المعتمد والمحجوز','إدخال في النظام',1,'قبل التقديم','الشؤون القانونية');
await insertReq('SRV-SETUP-DED-LICENSE','REQ-DED-DATA-03','data','الشكل القانوني للشركة','نوع الكيان: ذ.م.م / مؤسسة فردية / فرع','إدخال في النظام',1,'قبل التقديم','الشؤون القانونية');

// SRV-SETUP-RERA-TRAINING
await insertReq('SRV-SETUP-RERA-TRAINING','REQ-TRN-DOC-01','document','شهادة تدريب RERA المعتمدة','شهادة حضور وإتمام تدريب RERA من معهد دبي العقاري (DREI)','رفع ملف',1,'بعد التدريب','الموظف المعني');
await insertReq('SRV-SETUP-RERA-TRAINING','REQ-TRN-DOC-02','document','شهادة اجتياز اختبار RERA','شهادة رسمية باجتياز امتحان RERA للمطورين','رفع ملف',1,'بعد الاختبار','الموظف المعني');
await insertReq('SRV-SETUP-RERA-TRAINING','REQ-TRN-DOC-03','document','نسخة جواز السفر والهوية الإماراتية للمتدرب','نسخة من جواز السفر والهوية الإماراتية للشخص المتدرب','رفع ملف',1,'قبل التسجيل في التدريب','الموظف المعني');
await insertReq('SRV-SETUP-RERA-TRAINING','REQ-TRN-DATA-01','data','اسم المتدرب الكامل','الاسم الرباعي للشخص المعني بالتدريب','إدخال في النظام',1,'قبل التسجيل','إدارة الموارد البشرية');
await insertReq('SRV-SETUP-RERA-TRAINING','REQ-TRN-DATA-02','data','تاريخ التدريب','تاريخ حضور وإتمام التدريب','إدخال في النظام',1,'بعد التدريب','الموظف المعني');
await insertReq('SRV-SETUP-RERA-TRAINING','REQ-TRN-DATA-03','data','تاريخ الاختبار ونتيجته','تاريخ الاختبار والنتيجة (نجح / رسب)','إدخال في النظام',1,'بعد الاختبار','الموظف المعني');

// SRV-SETUP-POLICE-CERT
await insertReq('SRV-SETUP-POLICE-CERT','REQ-POL-DOC-01','document','شهادة حسن السيرة والسلوك','شهادة رسمية من شرطة دبي بحسن السيرة والسلوك','رفع ملف',1,'بعد الإصدار','الموظف المعني');
await insertReq('SRV-SETUP-POLICE-CERT','REQ-POL-DOC-02','document','نسخة جواز السفر والهوية الإماراتية','نسخة من جواز السفر والهوية الإماراتية لمقدم الطلب','رفع ملف',1,'قبل التقديم','الموظف المعني');
await insertReq('SRV-SETUP-POLICE-CERT','REQ-POL-DATA-01','data','اسم الشخص المعني','الاسم الرباعي للشخص المطلوب له الشهادة','إدخال في النظام',1,'قبل التقديم','إدارة الموارد البشرية');
await insertReq('SRV-SETUP-POLICE-CERT','REQ-POL-DATA-02','data','تاريخ إصدار الشهادة','تاريخ الحصول على شهادة حسن السيرة','إدخال في النظام',1,'بعد الإصدار','الموظف المعني');

// SRV-SETUP-RERA-APPROVAL
await insertReq('SRV-SETUP-RERA-APPROVAL','REQ-RERA-APP-DOC-01','document','شهادة حجز الاسم التجاري','نسخة من شهادة حجز الاسم التجاري','من خدمة الرخصة التجارية',1,'قبل التقديم','الشؤون القانونية');
await insertReq('SRV-SETUP-RERA-APPROVAL','REQ-RERA-APP-DOC-02','document','شهادة تدريب RERA','نسخة من شهادة تدريب RERA المعتمدة','من خدمة التدريب',1,'قبل التقديم','الموظف المعني');
await insertReq('SRV-SETUP-RERA-APPROVAL','REQ-RERA-APP-DOC-03','document','شهادة اجتياز اختبار RERA','نسخة من شهادة اجتياز اختبار RERA','من خدمة التدريب',1,'قبل التقديم','الموظف المعني');
await insertReq('SRV-SETUP-RERA-APPROVAL','REQ-RERA-APP-DOC-04','document','شهادة حسن السيرة والسلوك','نسخة من شهادة الشرطة','من خدمة شهادة الشرطة',1,'قبل التقديم','الموظف المعني');
await insertReq('SRV-SETUP-RERA-APPROVAL','REQ-RERA-APP-DOC-05','document','نسخة جواز السفر والهوية الإماراتية','نسخ من جواز السفر والهوية الإماراتية لمقدم الطلب','رفع ملف',1,'قبل التقديم','الموظف المعني');
await insertReq('SRV-SETUP-RERA-APPROVAL','REQ-RERA-APP-DOC-06','document','موافقة RERA الخارجية','نسخة من موافقة RERA الصادرة عبر تراخيصي','رفع ملف',1,'بعد الموافقة','إدارة التطوير');
await insertReq('SRV-SETUP-RERA-APPROVAL','REQ-RERA-APP-DATA-01','data','رقم طلب تراخيصي','رقم الطلب في نظام تراخيصي','إدخال في النظام',1,'بعد التقديم','إدارة التطوير');

// SRV-SETUP-RERA-REGISTRATION
await insertReq('SRV-SETUP-RERA-REGISTRATION','REQ-RERA-REG-DOC-01','document','الرخصة التجارية من DED','نسخة رسمية من رخصة التطوير العقاري','من خدمة الرخصة التجارية',1,'قبل التقديم','الشؤون القانونية');
await insertReq('SRV-SETUP-RERA-REGISTRATION','REQ-RERA-REG-DOC-02','document','عقد الإيجار موثّق عبر إيجاري','نسخة من عقد الإيجار المسجل في إيجاري','من خدمة الرخصة التجارية',1,'قبل التقديم','الإدارة الإدارية');
await insertReq('SRV-SETUP-RERA-REGISTRATION','REQ-RERA-REG-DOC-03','document','موافقة RERA الخارجية','نسخة من موافقة RERA للمطور','من خدمة موافقة RERA',1,'قبل التقديم','إدارة التطوير');
await insertReq('SRV-SETUP-RERA-REGISTRATION','REQ-RERA-REG-DOC-04','document','شهادات تدريب RERA','نسخ من شهادات التدريب والاختبار','من خدمة التدريب',1,'قبل التقديم','الموظف المعني');
await insertReq('SRV-SETUP-RERA-REGISTRATION','REQ-RERA-REG-DOC-05','document','شهادة تسجيل المطور لدى RERA','شهادة رسمية بتسجيل الشركة في سجل المطورين لدى RERA','رفع ملف',1,'بعد الموافقة','إدارة التطوير');
await insertReq('SRV-SETUP-RERA-REGISTRATION','REQ-RERA-REG-DATA-01','data','رقم المطور في RERA','رقم تسجيل المطور الفريد في نظام RERA','إدخال في النظام',1,'بعد التسجيل','إدارة التطوير');

console.log('✅ STG-01 requirements inserted (32 reqs)');

// ─── STG-02: Update sort order ─────────────────────────────────────────────
await conn.execute(`UPDATE lifecycle_stages SET sortOrder = 2 WHERE stageCode = 'STG-02'`);

// ─── STG-03: المبيعات على الخارطة وتسجيل العقود في أوكود ─────────────────
await conn.execute(`
  UPDATE lifecycle_stages SET
    descriptionAr = 'إدارة مبيعات الوحدات وتسجيل عقود البيع رسمياً عبر نظام أوكود',
    sortOrder = 3
  WHERE stageCode = 'STG-03'
`);
console.log('✅ STG-03 stage updated');

// STG-03 Services
await insertService('SRV-SALES-SPA-PREP', 'إعداد عقد البيع والشراء النموذجي (SPA)',
  'إعداد نموذج عقد بيع وشراء مطابق لأنظمة RERA وقانون الضمان',
  'STG-03', 'مستشار قانوني', 'الشؤون القانونية + إدارة التطوير', 1, 7);

await insertService('SRV-SALES-UNIT-PRICING', 'تحديد أسعار الوحدات وخطط الدفع',
  'إعداد قائمة أسعار الوحدات وخطط الدفع المرتبطة بمراحل المشروع',
  'STG-03', 'لا يوجد', 'الإدارة المالية + إدارة التطوير', 1, 5);

await insertService('SRV-SALES-OQOOD-REGISTER', 'تسجيل عقد بيع في نظام أوكود',
  'تسجيل عقد بيع وحدة واحدة رسمياً في نظام أوكود (DLD)',
  'STG-03', 'دائرة الأراضي والأملاك (نظام أوكود)', 'إدارة المبيعات + الشؤون القانونية', 1, 1);

await insertService('SRV-SALES-NOC-ISSUE', 'إصدار شهادة عدم ممانعة للمشتري',
  'إصدار شهادة عدم ممانعة (NOC) للمشتري لاستخراج تأشيرة أو قرض عقاري',
  'STG-03', 'لا يوجد (داخلي)', 'إدارة المبيعات + الشؤون القانونية', 0, 2);

console.log('✅ STG-03 services inserted (4 services)');

// STG-03 Requirements - SRV-SALES-SPA-PREP
await insertReq('SRV-SALES-SPA-PREP','REQ-SPA-DOC-01','document','مسودة عقد البيع والشراء','مسودة أولية لعقد البيع والشراء النموذجي','رفع ملف',1,'مرحلة الإعداد','الشؤون القانونية');
await insertReq('SRV-SALES-SPA-PREP','REQ-SPA-DOC-02','document','مراجعة قانونية لعقد SPA','تقرير مراجعة قانونية يؤكد مطابقة العقد لقوانين RERA والضمان','رفع ملف',1,'قبل الاعتماد','الشؤون القانونية (خارجي)');
await insertReq('SRV-SALES-SPA-PREP','REQ-SPA-DOC-03','document','نموذج عقد SPA المعتمد','النموذج النهائي المعتمد من الإدارة لاستخدامه في جميع المبيعات','رفع ملف',1,'بعد الاعتماد','الشؤون القانونية');
await insertReq('SRV-SALES-SPA-PREP','REQ-SPA-DATA-01','data','شروط الدفع الأساسية','ملخص لشروط الدفع النموذجية (دفعة أولى، أقساط، تسليم...)','إدخال في النظام',1,'مرحلة الإعداد','الإدارة المالية');
await insertReq('SRV-SALES-SPA-PREP','REQ-SPA-DATA-02','data','المراحل الإنشائية المرتبطة بالدفع','قائمة بالمراحل الإنشائية ونسبة الدفع لكل مرحلة','إدخال في النظام',1,'مرحلة الإعداد','الإدارة المالية + إدارة التطوير');

// SRV-SALES-UNIT-PRICING
await insertReq('SRV-SALES-UNIT-PRICING','REQ-PRICING-DOC-01','document','قائمة أسعار الوحدات','جدول بأسعار جميع الوحدات حسب النوع والمساحة والموقع','رفع ملف',1,'قبل إطلاق المبيعات','الإدارة المالية');
await insertReq('SRV-SALES-UNIT-PRICING','REQ-PRICING-DOC-02','document','خطط الدفع المتاحة','وثيقة تفصيلية بخطط الدفع المختلفة المتاحة للمشترين','رفع ملف',1,'قبل إطلاق المبيعات','الإدارة المالية');
await insertReq('SRV-SALES-UNIT-PRICING','REQ-PRICING-DATA-01','data','السعر لكل متر مربع (متوسط)','متوسط سعر المتر المربع للمشروع','إدخال في النظام',1,'قبل إطلاق المبيعات','الإدارة المالية');
await insertReq('SRV-SALES-UNIT-PRICING','REQ-PRICING-DATA-02','data','إجمالي قيمة المبيعات المتوقعة','إجمالي القيمة البيعية المتوقعة للمشروع','إدخال في النظام',1,'قبل إطلاق المبيعات','الإدارة المالية');

// SRV-SALES-OQOOD-REGISTER
await insertReq('SRV-SALES-OQOOD-REGISTER','REQ-OQOOD-DOC-01','document','عقد البيع والشراء الموقع','نسخة من عقد البيع والشراء موقع من الطرفين','رفع ملف',1,'قبل تسجيل أوكود','إدارة المبيعات');
await insertReq('SRV-SALES-OQOOD-REGISTER','REQ-OQOOD-DOC-02','document','جواز سفر المشتري','نسخة من جواز سفر المشتري','رفع ملف',1,'قبل تسجيل أوكود','إدارة المبيعات');
await insertReq('SRV-SALES-OQOOD-REGISTER','REQ-OQOOD-DOC-03','document','الهوية الإماراتية للمشتري (إن وجدت)','نسخة من الهوية الإماراتية للمشتري إن كان مقيماً','رفع ملف',0,'قبل تسجيل أوكود','إدارة المبيعات');
await insertReq('SRV-SALES-OQOOD-REGISTER','REQ-OQOOD-DOC-04','document','إثبات الدفعة الأولى','إيصال أو كشف حساب بنكي يثبت دفع الدفعة الأولى للضمان','رفع ملف',1,'قبل تسجيل أوكود','الإدارة المالية');
await insertReq('SRV-SALES-OQOOD-REGISTER','REQ-OQOOD-DOC-05','document','شهادة تسجيل المشروع ورقم RERA','نسخة من شهادة تسجيل المشروع ورقم المشروع في أوكود','من خدمة تسجيل المشروع',1,'قبل تسجيل أوكود','إدارة التطوير');
await insertReq('SRV-SALES-OQOOD-REGISTER','REQ-OQOOD-DOC-06','document','شهادة تسجيل عقد أوكود','شهادة رسمية من DLD بتسجيل العقد في نظام أوكود','رفع ملف',1,'بعد التسجيل','إدارة المبيعات');
await insertReq('SRV-SALES-OQOOD-REGISTER','REQ-OQOOD-DATA-01','data','رقم الوحدة','رقم الوحدة المباعة حسب مخططات المشروع','إدخال في النظام',1,'قبل تسجيل أوكود','إدارة المبيعات');
await insertReq('SRV-SALES-OQOOD-REGISTER','REQ-OQOOD-DATA-02','data','سعر البيع النهائي','سعر بيع الوحدة المتفق عليه','إدخال في النظام',1,'قبل تسجيل أوكود','إدارة المبيعات');
await insertReq('SRV-SALES-OQOOD-REGISTER','REQ-OQOOD-DATA-03','data','رقم عقد أوكود','رقم تسجيل عقد البيع في نظام أوكود','إدخال في النظام',1,'بعد التسجيل','إدارة المبيعات');

// SRV-SALES-NOC-ISSUE
await insertReq('SRV-SALES-NOC-ISSUE','REQ-NOC-DOC-01','document','طلب شهادة عدم ممانعة من المشتري','طلب خطي من المشتري لإصدار شهادة عدم ممانعة','رفع ملف',1,'قبل الإصدار','إدارة المبيعات');
await insertReq('SRV-SALES-NOC-ISSUE','REQ-NOC-DOC-02','document','نسخة من عقد أوكود المسجل','نسخة من شهادة تسجيل عقد أوكود للوحدة','من خدمة تسجيل أوكود',1,'قبل الإصدار','إدارة المبيعات');
await insertReq('SRV-SALES-NOC-ISSUE','REQ-NOC-DOC-03','document','إثبات التزام المشتري بالدفعات','كشف حساب بنكي أو تقرير داخلي يؤكد التزام المشتري بالدفعات','رفع ملف',1,'قبل الإصدار','الإدارة المالية');
await insertReq('SRV-SALES-NOC-ISSUE','REQ-NOC-DOC-04','document','شهادة عدم ممانعة (NOC)','نسخة من شهادة عدم الممانعة الصادرة من الشركة','رفع ملف',1,'بعد الإصدار','الشؤون القانونية');
await insertReq('SRV-SALES-NOC-ISSUE','REQ-NOC-DATA-01','data','سبب طلب الشهادة','تحديد السبب (تأشيرة، قرض عقاري، إلخ)','إدخال في النظام',1,'قبل الإصدار','إدارة المبيعات');

console.log('✅ STG-03 requirements inserted (24 reqs)');

// ─── STG-04: الرقابة المالية والإنشائية ───────────────────────────────────
await conn.execute(`
  UPDATE lifecycle_stages SET
    descriptionAr = 'متابعة تقدم المشروع وإدارة السحوبات من حساب الضمان والتقارير الدورية',
    sortOrder = 4
  WHERE stageCode = 'STG-04'
`);
console.log('✅ STG-04 stage updated');

// STG-04 Services
await insertService('SRV-MON-PROGRESS-REPORT', 'إعداد تقرير تقدم المشروع',
  'إعداد تقرير دوري عن التقدم الإنشائي والمالي للمشروع',
  'STG-04', 'استشاري أو مدير مشروع', 'إدارة التطوير + مدير المشروع', 1, 30);

await insertService('SRV-MON-ESCROW-WITHDRAW', 'سحب دفعة من حساب الضمان',
  'تقديم طلب سحب دفعة من حساب الضمان بناءً على إنجاز مرحلة إنشائية',
  'STG-04', 'RERA + البنك الضامن', 'الإدارة المالية + إدارة التطوير', 1, 7);

await insertService('SRV-MON-RERA-INSPECTION', 'زيارة تفتيش من RERA',
  'استقبال زيارة تفتيش دورية أو مفاجئة من RERA للمشروع',
  'STG-04', 'RERA', 'إدارة التطوير + مدير المشروع', 1, 1);

await insertService('SRV-MON-BUYER-UPDATE', 'إرسال تحديث للمشترين',
  'إرسال رسالة دورية للمشترين عن حالة المشروع وتقدم الإنشاء',
  'STG-04', 'لا يوجد', 'إدارة المبيعات + إدارة علاقات العملاء', 0, 7);

console.log('✅ STG-04 services inserted (4 services)');

// STG-04 Requirements - SRV-MON-PROGRESS-REPORT
await insertReq('SRV-MON-PROGRESS-REPORT','REQ-PROG-DOC-01','document','تقرير تقدم المشروع الشهري','تقرير مفصل عن التقدم الإنشائي والمالي','رفع ملف',1,'شهرياً','مدير المشروع');
await insertReq('SRV-MON-PROGRESS-REPORT','REQ-PROG-DOC-02','document','صور فوتوغرافية من الموقع','صور حديثة توثق التقدم في الموقع','رفع ملف',1,'شهرياً','مدير المشروع');
await insertReq('SRV-MON-PROGRESS-REPORT','REQ-PROG-DOC-03','document','تقرير المستشار أو المهندس المشرف','تقرير فني من المستشار المشرف على الموقع','رفع ملف',1,'شهرياً','الاستشاري');
await insertReq('SRV-MON-PROGRESS-REPORT','REQ-PROG-DATA-01','data','نسبة الإنجاز الحالية','نسبة الإنجاز الإجمالية للمشروع (مثلاً 45%)','إدخال في النظام',1,'شهرياً','مدير المشروع');
await insertReq('SRV-MON-PROGRESS-REPORT','REQ-PROG-DATA-02','data','المصروفات الفعلية حتى الآن','إجمالي المصروفات الفعلية حتى تاريخ التقرير','إدخال في النظام',1,'شهرياً','الإدارة المالية');

// SRV-MON-ESCROW-WITHDRAW
await insertReq('SRV-MON-ESCROW-WITHDRAW','REQ-ESCROW-DOC-01','document','طلب سحب دفعة من الضمان','نموذج طلب رسمي لسحب دفعة من حساب الضمان','رفع ملف',1,'قبل التقديم','الإدارة المالية');
await insertReq('SRV-MON-ESCROW-WITHDRAW','REQ-ESCROW-DOC-02','document','تقرير تقدم المشروع','تقرير التقدم الذي يثبت إنجاز المرحلة','من خدمة تقرير التقدم',1,'قبل التقديم','مدير المشروع');
await insertReq('SRV-MON-ESCROW-WITHDRAW','REQ-ESCROW-DOC-03','document','شهادة مهندس الإشراف','شهادة من المهندس المشرف تؤكد إنجاز المرحلة المطلوبة','رفع ملف',1,'قبل التقديم','الاستشاري');
await insertReq('SRV-MON-ESCROW-WITHDRAW','REQ-ESCROW-DOC-04','document','فواتير المقاول والموردين','نسخ من فواتير المقاول المتعلقة بالمرحلة','رفع ملف',1,'قبل التقديم','الإدارة المالية');
await insertReq('SRV-MON-ESCROW-WITHDRAW','REQ-ESCROW-DOC-05','document','موافقة RERA على السحب','خطاب موافقة رسمي من RERA على طلب السحب','رفع ملف',1,'بعد الموافقة','إدارة التطوير');
await insertReq('SRV-MON-ESCROW-WITHDRAW','REQ-ESCROW-DOC-06','document','إشعار تحويل البنك','إشعار من البنك الضامن بتحويل المبلغ المطلوب','رفع ملف',1,'بعد التحويل','الإدارة المالية');
await insertReq('SRV-MON-ESCROW-WITHDRAW','REQ-ESCROW-DATA-01','data','المبلغ المطلوب للسحب','قيمة الدفعة المطلوب سحبها من الضمان','إدخال في النظام',1,'قبل التقديم','الإدارة المالية');
await insertReq('SRV-MON-ESCROW-WITHDRAW','REQ-ESCROW-DATA-02','data','المرحلة الإنشائية المرتبطة','اسم أو رقم المرحلة الإنشائية التي تم إنجازها','إدخال في النظام',1,'قبل التقديم','مدير المشروع');

// SRV-MON-RERA-INSPECTION
await insertReq('SRV-MON-RERA-INSPECTION','REQ-INSP-DOC-01','document','إشعار زيارة التفتيش','إشعار رسمي من RERA بموعد الزيارة (إن وجد)','رفع ملف',0,'عند الاستلام','إدارة التطوير');
await insertReq('SRV-MON-RERA-INSPECTION','REQ-INSP-DOC-02','document','محضر زيارة التفتيش','محضر رسمي من RERA بنتائج الزيارة','رفع ملف',1,'بعد الزيارة','إدارة التطوير');
await insertReq('SRV-MON-RERA-INSPECTION','REQ-INSP-DOC-03','document','خطة تصحيحية (إن وجدت)','خطة معالجة الملاحظات إن كان هناك ملاحظات من RERA','رفع ملف',0,'بعد الزيارة','إدارة التطوير');
await insertReq('SRV-MON-RERA-INSPECTION','REQ-INSP-DATA-01','data','تاريخ الزيارة','تاريخ زيارة مفتش RERA للموقع','إدخال في النظام',1,'بعد الزيارة','إدارة التطوير');
await insertReq('SRV-MON-RERA-INSPECTION','REQ-INSP-DATA-02','data','نتيجة الزيارة','ملخص نتيجة الزيارة (مطابق، ملاحظات، مخالفات)','إدخال في النظام',1,'بعد الزيارة','إدارة التطوير');

// SRV-MON-BUYER-UPDATE
await insertReq('SRV-MON-BUYER-UPDATE','REQ-UPDATE-DOC-01','document','نشرة إخبارية للمشترين','رسالة إخبارية موجهة للمشترين عن حالة المشروع','رفع ملف',1,'ربع سنوي','إدارة المبيعات');
await insertReq('SRV-MON-BUYER-UPDATE','REQ-UPDATE-DOC-02','document','صور ومقاطع فيديو من الموقع','محتوى بصري لإطلاع المشترين على التقدم','رفع ملف',0,'ربع سنوي','إدارة التسويق');
await insertReq('SRV-MON-BUYER-UPDATE','REQ-UPDATE-DATA-01','data','تاريخ الإرسال','تاريخ إرسال التحديث للمشترين','إدخال في النظام',1,'بعد الإرسال','إدارة المبيعات');
await insertReq('SRV-MON-BUYER-UPDATE','REQ-UPDATE-DATA-02','data','عدد المشترين المرسل لهم','إجمالي عدد المشترين الذين استلموا التحديث','إدخال في النظام',1,'بعد الإرسال','إدارة المبيعات');

console.log('✅ STG-04 requirements inserted (22 reqs)');

// ─── STG-05: إغلاق المشروع وتسوية الضمان ─────────────────────────────────
await conn.execute(`
  UPDATE lifecycle_stages SET
    descriptionAr = 'إتمام إجراءات التسليم النهائي وإغلاق المشروع لدى RERA وتسوية حساب الضمان',
    sortOrder = 5
  WHERE stageCode = 'STG-05'
`);
console.log('✅ STG-05 stage updated');

// STG-05 Services
await insertService('SRV-CLOSE-COMPLETION-CERT', 'الحصول على شهادة إتمام البناء',
  'الحصول على شهادة إتمام المشروع من بلدية دبي',
  'STG-05', 'بلدية دبي', 'إدارة التطوير + مدير المشروع', 1, 14);

await insertService('SRV-CLOSE-UNIT-HANDOVER', 'تسليم الوحدات للمشترين',
  'إتمام إجراءات تسليم الوحدات للمشترين والحصول على استلامهم',
  'STG-05', 'لا يوجد', 'إدارة المبيعات + مدير المشروع', 1, 30);

await insertService('SRV-CLOSE-TITLE-DEED-ISSUE', 'إصدار سندات الملكية النهائية',
  'تحويل سندات الملكية النهائية للمشترين بعد التسوية الكاملة',
  'STG-05', 'دائرة الأراضي والأملاك (DLD)', 'إدارة التطوير + الشؤون القانونية', 1, 14);

await insertService('SRV-CLOSE-ESCROW-SETTLEMENT', 'تسوية حساب الضمان وإغلاقه',
  'إعداد الحساب الختامي وإغلاق حساب الضمان بموافقة RERA',
  'STG-05', 'RERA + البنك الضامن', 'الإدارة المالية + إدارة التطوير', 1, 30);

await insertService('SRV-CLOSE-RERA-CLOSURE', 'إغلاق المشروع لدى RERA',
  'تقديم طلب إغلاق المشروع رسمياً في نظام RERA بعد التسوية الكاملة',
  'STG-05', 'RERA', 'إدارة التطوير + الشؤون القانونية', 1, 14);

console.log('✅ STG-05 services inserted (5 services)');

// STG-05 Requirements - SRV-CLOSE-COMPLETION-CERT
await insertReq('SRV-CLOSE-COMPLETION-CERT','REQ-COMP-DOC-01','document','طلب شهادة إتمام البناء','نموذج طلب رسمي لشهادة الإتمام من بلدية دبي','رفع ملف',1,'قبل التقديم','مدير المشروع');
await insertReq('SRV-CLOSE-COMPLETION-CERT','REQ-COMP-DOC-02','document','شهادة المهندس الاستشاري بإتمام الأعمال','شهادة من الاستشاري تؤكد إتمام جميع الأعمال الإنشائية','رفع ملف',1,'قبل التقديم','الاستشاري');
await insertReq('SRV-CLOSE-COMPLETION-CERT','REQ-COMP-DOC-03','document','شهادة مطابقة الدفاع المدني','شهادة سلامة من الدفاع المدني','رفع ملف',1,'قبل التقديم','مدير المشروع');
await insertReq('SRV-CLOSE-COMPLETION-CERT','REQ-COMP-DOC-04','document','شهادة اتصال الكهرباء والماء','إثبات توصيل الكهرباء والماء (DEWA)','رفع ملف',1,'قبل التقديم','مدير المشروع');
await insertReq('SRV-CLOSE-COMPLETION-CERT','REQ-COMP-DOC-05','document','شهادة إتمام البناء','الشهادة الرسمية من بلدية دبي بإتمام المشروع','رفع ملف',1,'بعد الموافقة','مدير المشروع');
await insertReq('SRV-CLOSE-COMPLETION-CERT','REQ-COMP-DATA-01','data','تاريخ الإتمام الفعلي','تاريخ إصدار شهادة الإتمام','إدخال في النظام',1,'بعد الإصدار','مدير المشروع');

// SRV-CLOSE-UNIT-HANDOVER
await insertReq('SRV-CLOSE-UNIT-HANDOVER','REQ-HAND-DOC-01','document','محضر تسليم الوحدة','نموذج تسليم موقع من المشتري يؤكد استلام الوحدة','رفع ملف',1,'عند التسليم','إدارة المبيعات');
await insertReq('SRV-CLOSE-UNIT-HANDOVER','REQ-HAND-DOC-02','document','قائمة فحص الوحدة (Snag List)','قائمة بالعيوب أو الملاحظات إن وجدت','رفع ملف',0,'عند التسليم','مدير المشروع');
await insertReq('SRV-CLOSE-UNIT-HANDOVER','REQ-HAND-DOC-03','document','دليل المالك (Owner\'s Manual)','دليل استخدام وصيانة الوحدة','رفع ملف',1,'عند التسليم','إدارة المبيعات');
await insertReq('SRV-CLOSE-UNIT-HANDOVER','REQ-HAND-DOC-04','document','مفاتيح الوحدة وبطاقات الدخول','تسليم المفاتيح وبطاقات الدخول للمشتري','رفع ملف (إشعار)',1,'عند التسليم','مدير المشروع');
await insertReq('SRV-CLOSE-UNIT-HANDOVER','REQ-HAND-DATA-01','data','رقم الوحدة','رقم الوحدة المسلمة','إدخال في النظام',1,'عند التسليم','إدارة المبيعات');
await insertReq('SRV-CLOSE-UNIT-HANDOVER','REQ-HAND-DATA-02','data','تاريخ التسليم','تاريخ تسليم الوحدة الفعلي','إدخال في النظام',1,'عند التسليم','إدارة المبيعات');

// SRV-CLOSE-TITLE-DEED-ISSUE
await insertReq('SRV-CLOSE-TITLE-DEED-ISSUE','REQ-TITLE-DOC-01','document','محضر تسليم الوحدة','نسخة من محضر تسليم الوحدة الموقع','من خدمة تسليم الوحدات',1,'قبل تحويل السند','إدارة المبيعات');
await insertReq('SRV-CLOSE-TITLE-DEED-ISSUE','REQ-TITLE-DOC-02','document','إثبات التسوية الكاملة للدفعات','تقرير أو كشف حساب يثبت سداد المشتري كامل المبلغ','رفع ملف',1,'قبل تحويل السند','الإدارة المالية');
await insertReq('SRV-CLOSE-TITLE-DEED-ISSUE','REQ-TITLE-DOC-03','document','شهادة عدم ممانعة نهائية من المطور','شهادة رسمية من المطور بعدم وجود مستحقات على الوحدة','رفع ملف',1,'قبل تحويل السند','الشؤون القانونية');
await insertReq('SRV-CLOSE-TITLE-DEED-ISSUE','REQ-TITLE-DOC-04','document','جواز سفر المشتري والهوية الإماراتية','نسخ من جواز السفر والهوية الإماراتية للمشتري','من ملف العقد',1,'قبل تحويل السند','إدارة المبيعات');
await insertReq('SRV-CLOSE-TITLE-DEED-ISSUE','REQ-TITLE-DOC-05','document','سند الملكية النهائي','نسخة من سند الملكية النهائي الصادر من DLD','رفع ملف',1,'بعد التحويل','الشؤون القانونية');
await insertReq('SRV-CLOSE-TITLE-DEED-ISSUE','REQ-TITLE-DATA-01','data','رقم الوحدة','رقم الوحدة المراد تحويل سندها','إدخال في النظام',1,'قبل تحويل السند','إدارة المبيعات');
await insertReq('SRV-CLOSE-TITLE-DEED-ISSUE','REQ-TITLE-DATA-02','data','تاريخ تحويل السند','تاريخ تحويل ملكية الوحدة في DLD','إدخال في النظام',1,'بعد التحويل','الشؤون القانونية');

// SRV-CLOSE-ESCROW-SETTLEMENT
await insertReq('SRV-CLOSE-ESCROW-SETTLEMENT','REQ-ESCL-DOC-01','document','الحساب الختامي للمشروع','تقرير مالي شامل بالإيرادات والمصروفات الفعلية للمشروع','رفع ملف',1,'قبل الإغلاق','الإدارة المالية');
await insertReq('SRV-CLOSE-ESCROW-SETTLEMENT','REQ-ESCL-DOC-02','document','كشوف حسابات الضمان الكاملة','كشوف حسابات مفصلة من البنك لحساب الضمان','رفع ملف',1,'قبل الإغلاق','الإدارة المالية');
await insertReq('SRV-CLOSE-ESCROW-SETTLEMENT','REQ-ESCL-DOC-03','document','قائمة الوحدات المسلمة والسندات المحولة','جدول بجميع الوحدات المسلمة مع تواريخ تحويل السندات','رفع ملف',1,'قبل الإغلاق','إدارة المبيعات');
await insertReq('SRV-CLOSE-ESCROW-SETTLEMENT','REQ-ESCL-DOC-04','document','موافقة RERA على تسوية الضمان','خطاب رسمي من RERA بالموافقة على إغلاق حساب الضمان','رفع ملف',1,'بعد الموافقة','إدارة التطوير');
await insertReq('SRV-CLOSE-ESCROW-SETTLEMENT','REQ-ESCL-DOC-05','document','إشعار إغلاق الحساب من البنك','إشعار رسمي من البنك بإغلاق حساب الضمان','رفع ملف',1,'بعد الإغلاق','الإدارة المالية');
await insertReq('SRV-CLOSE-ESCROW-SETTLEMENT','REQ-ESCL-DATA-01','data','إجمالي المبالغ المحصلة','إجمالي المبالغ التي دخلت حساب الضمان','إدخال في النظام',1,'قبل الإغلاق','الإدارة المالية');
await insertReq('SRV-CLOSE-ESCROW-SETTLEMENT','REQ-ESCL-DATA-02','data','إجمالي المبالغ المسحوبة','إجمالي المبالغ التي تم سحبها أثناء التنفيذ','إدخال في النظام',1,'قبل الإغلاق','الإدارة المالية');
await insertReq('SRV-CLOSE-ESCROW-SETTLEMENT','REQ-ESCL-DATA-03','data','الرصيد المتبقي (إن وجد)','المبلغ المتبقي في حساب الضمان عند الإغلاق','إدخال في النظام',1,'قبل الإغلاق','الإدارة المالية');

// SRV-CLOSE-RERA-CLOSURE
await insertReq('SRV-CLOSE-RERA-CLOSURE','REQ-CLOSE-DOC-01','document','طلب إغلاق المشروع','نموذج طلب رسمي لإغلاق المشروع لدى RERA','رفع ملف',1,'قبل التقديم','إدارة التطوير');
await insertReq('SRV-CLOSE-RERA-CLOSURE','REQ-CLOSE-DOC-02','document','شهادة إتمام البناء','نسخة من شهادة الإتمام من بلدية دبي','من خدمة شهادة الإتمام',1,'قبل التقديم','مدير المشروع');
await insertReq('SRV-CLOSE-RERA-CLOSURE','REQ-CLOSE-DOC-03','document','إثبات تسوية حساب الضمان','نسخة من موافقة RERA على تسوية الضمان','من خدمة تسوية الضمان',1,'قبل التقديم','الإدارة المالية');
await insertReq('SRV-CLOSE-RERA-CLOSURE','REQ-CLOSE-DOC-04','document','قائمة السندات المحولة','جدول بجميع الوحدات التي تم تحويل سنداتها','من خدمة تحويل السندات',1,'قبل التقديم','الشؤون القانونية');
await insertReq('SRV-CLOSE-RERA-CLOSURE','REQ-CLOSE-DOC-05','document','شهادة إغلاق المشروع من RERA','شهادة رسمية من RERA بإغلاق المشروع','رفع ملف',1,'بعد الموافقة','إدارة التطوير');
await insertReq('SRV-CLOSE-RERA-CLOSURE','REQ-CLOSE-DATA-01','data','تاريخ طلب الإغلاق','تاريخ تقديم طلب إغلاق المشروع','إدخال في النظام',1,'بعد التقديم','إدارة التطوير');
await insertReq('SRV-CLOSE-RERA-CLOSURE','REQ-CLOSE-DATA-02','data','تاريخ إغلاق المشروع الفعلي','تاريخ إصدار شهادة الإغلاق من RERA','إدخال في النظام',1,'بعد الإصدار','إدارة التطوير');

console.log('✅ STG-05 requirements inserted (28 reqs)');

// ─── Final Verification ────────────────────────────────────────────────────
const [stages] = await conn.execute('SELECT stageCode, nameAr, sortOrder FROM lifecycle_stages ORDER BY sortOrder');
const [services] = await conn.execute('SELECT stageCode, COUNT(*) as cnt FROM lifecycle_services GROUP BY stageCode ORDER BY stageCode');
const [reqs] = await conn.execute('SELECT serviceCode, COUNT(*) as cnt FROM lifecycle_requirements GROUP BY serviceCode ORDER BY serviceCode');

console.log('\n📊 FINAL VERIFICATION:');
console.log('Total stages:', stages.length);
stages.forEach(s => console.log(`  ${s.stageCode} (order ${s.sortOrder}): ${s.nameAr}`));
console.log('\nServices per stage:');
services.forEach(s => console.log(`  ${s.stageCode}: ${s.cnt} services`));

const totalServices = services.reduce((sum, s) => sum + Number(s.cnt), 0);
const totalReqs = reqs.reduce((sum, r) => sum + Number(r.cnt), 0);
console.log(`\nTotal services: ${totalServices}`);
console.log(`Total requirements: ${totalReqs}`);
console.log('\nRequirements per service:');
reqs.forEach(r => console.log(`  ${r.serviceCode}: ${r.cnt}`));

await conn.end();
console.log('\n✅ All done! DLD/RERA lifecycle is now complete.');
