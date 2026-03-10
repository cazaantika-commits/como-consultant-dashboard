import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// ─── STG-10: مرحلة التصميم ورخصة البناء ───────────────────────────────────
await conn.execute(`
  INSERT IGNORE INTO lifecycle_stages (stageCode, nameAr, descriptionAr, defaultStatus, sortOrder)
  VALUES ('STG-10', 'مرحلة التصميم ورخصة البناء',
    'إدارة أعمال الاستشاري والتصميم والحصول على الموافقات من الجهات ورخصة البناء',
    'not_started', 10)
`);
console.log('✅ STG-10 stage inserted');

// ─── STG-10 Services ───────────────────────────────────────────────────────
const stg10Services = [
  ['SRV-DES-CNSLT-APPT', 'تعيين الاستشاري الرئيسي',
   'إكمال إجراءات تعيين الاستشاري وإبرام عقد الخدمات الاستشارية للمشروع',
   'STG-10', 'الاستشاري + جهة اعتماد الاستشاري إن لزم', 'الإدارة العليا + إدارة التطوير', 1, 14],
  ['SRV-DES-CONCEPT-DEV', 'تطوير واعتماد الكونسبت التصميمي',
   'إعداد الكونسبت التصميمي للمشروع واعتماده داخلياً ومع المطوّر الرئيسي إن وجد',
   'STG-10', 'الاستشاري + المطوّر الرئيسي (إن وجد)', 'إدارة التطوير + الاستشاري', 1, 21],
  ['SRV-DES-PRELIM-DESIGN', 'التصميم الابتدائي واعتماده',
   'إعداد مخططات التصميم الابتدائي ورفعها للاعتماد المبدئي من الجهة المختصة',
   'STG-10', 'بلدية دبي أو الجهة التنظيمية (DM/DDA/Trakhees)', 'الاستشاري + إدارة التطوير', 1, 30],
  ['SRV-DES-FINAL-DESIGN', 'التصميم النهائي واعتماد الرسومات',
   'استكمال المخططات التفصيلية (معماري/إنشائي/ميكانيكا) والحصول على اعتماد التصميم النهائي',
   'STG-10', 'DM أو DDA أو الجهة المختصة', 'الاستشاري + إدارة التطوير', 1, 45],
  ['SRV-DES-BLDG-PERMIT', 'الحصول على رخصة البناء',
   'تقديم طلب رخصة البناء ودفع الرسوم واستلام تصريح البناء النهائي',
   'STG-10', 'بلدية دبي أو السلطة المعنية (BPS / بوابة الجهة)', 'الاستشاري + إدارة التطوير + الإدارة المالية', 1, 30],
];

for (const [serviceCode, nameAr, descriptionAr, stageCode, externalParty, internalParty, isMandatory, durationDays] of stg10Services) {
  await conn.execute(`
    INSERT IGNORE INTO lifecycle_services
      (serviceCode, nameAr, descriptionAr, stageCode, externalParty, internalOwner, isMandatory, expectedDurationDays)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [serviceCode, nameAr, descriptionAr, stageCode, externalParty, internalParty, isMandatory, durationDays]);
}
console.log('✅ STG-10 services inserted (5 services)');

// ─── STG-10 Requirements ───────────────────────────────────────────────────
const stg10Reqs = [
  // SRV-DES-CNSLT-APPT (9 reqs)
  ['SRV-DES-CNSLT-APPT','REQ-CNSLT-DOC-01','document','قائمة مكاتب استشارية معتمدة','قائمة بالمكاتب الاستشارية المؤهلة للمشاركة في المناقصة','رفع ملف / من إعداد داخلي',1,'قبل التقديم','إدارة التطوير'],
  ['SRV-DES-CNSLT-APPT','REQ-CNSLT-DOC-02','document','وثيقة طلب العروض للاستشاري (RFP)','نموذج RFP يحدد نطاق خدمات الاستشاري والمتطلبات الفنية','رفع ملف',1,'قبل إرسال المناقصات','إدارة التطوير'],
  ['SRV-DES-CNSLT-APPT','REQ-CNSLT-DOC-03','document','العروض الفنية والمالية من الاستشاريين','ملف يحتوي العروض المستلمة من المكاتب المرشحة','رفع ملف',1,'أثناء التقييم','الاستشاري أو إدارة التطوير (تجميع)'],
  ['SRV-DES-CNSLT-APPT','REQ-CNSLT-DOC-04','document','تقرير توصية الاستشاري المختار','تقرير يوضح تحليل العروض وتوصية بالاستشاري المفضل','رفع ملف',1,'قبل قرار الترسية','إدارة التطوير'],
  ['SRV-DES-CNSLT-APPT','REQ-CNSLT-DOC-05','document','مسودة عقد الخدمات الاستشارية','مسودة عقد استشاري (مثلاً مبني على نموذج قياسي معدّل)','رفع ملف',1,'قبل التوقيع','الشؤون القانونية'],
  ['SRV-DES-CNSLT-APPT','REQ-CNSLT-DOC-06','document','عقد الاستشاري الموقع','نسخة من عقد الخدمات الاستشارية موقعة من الطرفين','رفع ملف',1,'بعد التوقيع','الشؤون القانونية'],
  ['SRV-DES-CNSLT-APPT','REQ-CNSLT-DATA-01','data','اسم الاستشاري المختار','اسم المكتب الاستشاري الذي تم اختياره للمشروع','إدخال في النظام',1,'قبل التوقيع','إدارة التطوير'],
  ['SRV-DES-CNSLT-APPT','REQ-CNSLT-DATA-02','data','نطاق خدمات الاستشاري','وصف مختصر لنطاق العمل (تصميم، إشراف، إدارة...)','إدخال في النظام',1,'قبل التوقيع','إدارة التطوير'],
  ['SRV-DES-CNSLT-APPT','REQ-CNSLT-DATA-03','data','أتعاب الاستشاري وطريقة الدفع','القيمة الإجمالية للأتعاب والمراحل المرتبطة بالدفع','إدخال في النظام',1,'قبل التوقيع','الإدارة المالية + إدارة التطوير'],

  // SRV-DES-CONCEPT-DEV (7 reqs)
  ['SRV-DES-CONCEPT-DEV','REQ-CONCEPT-DOC-01','document','برنامج المشروع ومتطلبات المطوّر','وثيقة تحتوي المتطلبات الوظيفية والتشغيلية للمشروع (نوع الوحدات، المستهدف، إلخ)','رفع ملف',1,'قبل بدء التصميم','إدارة التطوير'],
  ['SRV-DES-CONCEPT-DEV','REQ-CONCEPT-DOC-02','document','مخططات الكونسبت (معماري)','رسومات الكونسبت الأولية (مخططات طوابق، واجهات، كتل)','رفع ملف (من الاستشاري)',1,'أثناء التطوير','الاستشاري'],
  ['SRV-DES-CONCEPT-DEV','REQ-CONCEPT-DOC-03','document','تقرير تصميم الكونسبت','مذكرة تشرح الفكرة التصميمية الرئيسية والافتراضات','رفع ملف (من الاستشاري)',0,'أثناء التطوير','الاستشاري'],
  ['SRV-DES-CONCEPT-DEV','REQ-CONCEPT-DOC-04','document','اعتماد الكونسبت من المطوّر','محضر اجتماع أو نموذج موافقة داخلية يثبت اعتماد الكونسبت','رفع ملف',1,'قبل الانتقال للتصميم الابتدائي','إدارة التطوير / الإدارة العليا'],
  ['SRV-DES-CONCEPT-DEV','REQ-CONCEPT-DOC-05','document','موافقة أولية من المطوّر الرئيسي (إن وجد)','NOC أو موافقة على الكونسبت من المطوّر الرئيسي للمجتمع','رفع ملف',0,'بعد الكونسبت','إدارة التطوير'],
  ['SRV-DES-CONCEPT-DEV','REQ-CONCEPT-DATA-01','data','عدد الأدوار واستخدام كل دور','وصف مبسط لعدد الطوابق واستخداماتها الرئيسية','إدخال في النظام',1,'أثناء التطوير','الاستشاري + إدارة التطوير'],
  ['SRV-DES-CONCEPT-DEV','REQ-CONCEPT-DATA-02','data','إجمالي المساحة البنائية التقديرية','BUA تقديرية مبنية على الكونسبت','إدخال في النظام',1,'أثناء التطوير','الاستشاري'],

  // SRV-DES-PRELIM-DESIGN (6 reqs)
  ['SRV-DES-PRELIM-DESIGN','REQ-PRELIM-DOC-01','document','مخططات التصميم الابتدائي (معماري)','رسومات معمارية محدثة وفقاً للكونسبت المعتمد','رفع ملف (من الاستشاري)',1,'قبل الرفع للجهة','الاستشاري'],
  ['SRV-DES-PRELIM-DESIGN','REQ-PRELIM-DOC-02','document','مخططات إنشائية أولية','مخططات إنشائية مبدئية تبين النظام الإنشائي المقترح','رفع ملف',1,'قبل الرفع للجهة','الاستشاري'],
  ['SRV-DES-PRELIM-DESIGN','REQ-PRELIM-DOC-03','document','مخططات ميكانيكية/كهربائية أولية','مخططات MEP مبدئية للأنظمة الرئيسية','رفع ملف',1,'قبل الرفع للجهة','الاستشاري'],
  ['SRV-DES-PRELIM-DESIGN','REQ-PRELIM-DOC-04','document','رفع المخططات على نظام الجهة (BPS أو بوابة أخرى)','تأكيد/إثبات أن المخططات رُفعت على نظام البلدية أو DDA','رفع ملف (لقطة شاشة / إيصال)',1,'بعد الرفع','الاستشاري'],
  ['SRV-DES-PRELIM-DESIGN','REQ-PRELIM-DOC-05','document','ملاحظات الجهة على التصميم الابتدائي','نسخة من تعليقات البلدية/الجهة على المخططات','رفع ملف',1,'بعد المراجعة','الاستشاري'],
  ['SRV-DES-PRELIM-DESIGN','REQ-PRELIM-DOC-06','document','محضر اجتماع مراجعة داخلي للتعليقات','وثيقة توضح كيفية التعامل مع تعليقات الجهة','رفع ملف',0,'بعد الملاحظات','إدارة التطوير + الاستشاري'],

  // SRV-DES-FINAL-DESIGN (6 reqs)
  ['SRV-DES-FINAL-DESIGN','REQ-FINAL-DOC-01','document','مخططات معمارية نهائية','رسومات معمارية نهائية جاهزة للاعتماد','رفع ملف (من الاستشاري)',1,'قبل الرفع النهائي','الاستشاري'],
  ['SRV-DES-FINAL-DESIGN','REQ-FINAL-DOC-02','document','مخططات إنشائية نهائية','رسومات إنشائية بتفاصيل كاملة وفق كود الجهة','رفع ملف',1,'قبل الرفع النهائي','الاستشاري'],
  ['SRV-DES-FINAL-DESIGN','REQ-FINAL-DOC-03','document','مخططات ميكانيكية/كهربائية نهائية','مخططات MEP نهائية','رفع ملف',1,'قبل الرفع النهائي','الاستشاري'],
  ['SRV-DES-FINAL-DESIGN','REQ-FINAL-DOC-04','document','اعتمادات/NOC من الدفاع المدني والجهات الخدمية','رسائل أو NOC من الدفاع المدني وDEWA والاتصالات وغيرهم حسب الحاجة','رفع ملف',0,'قبل أو مع الرفع النهائي','الاستشاري'],
  ['SRV-DES-FINAL-DESIGN','REQ-FINAL-DOC-05','document','موافقة التصميم النهائي من الجهة','وثيقة/إشعار باعتماد التصميم النهائي (DM/DDA...)','رفع ملف',1,'بعد الاعتماد','الاستشاري'],
  ['SRV-DES-FINAL-DESIGN','REQ-FINAL-DATA-01','data','المساحة البنائية النهائية وعدد الوحدات','BUA نهائية وعدد الوحدات حسب التصميم المعتمد','إدخال في النظام',1,'بعد الاعتماد','إدارة التطوير + الاستشاري'],

  // SRV-DES-BLDG-PERMIT (5 reqs)
  ['SRV-DES-BLDG-PERMIT','REQ-PERMIT-DOC-01','document','نسخة معتمدة من التصميم النهائي','حزمة المخططات المعتمدة من الجهة (معماري/إنشائي/MEP)','من مخرجات خدمة التصميم النهائي',1,'قبل تقديم الطلب','الاستشاري'],
  ['SRV-DES-BLDG-PERMIT','REQ-PERMIT-DOC-02','document','مستندات الملكية ورخصة المطوّر','سند ملكية الأرض ورخصة الشركة محدثة','من ملفات سابقة',1,'قبل تقديم الطلب','الشؤون القانونية'],
  ['SRV-DES-BLDG-PERMIT','REQ-PERMIT-DOC-03','document','إيصالات سداد الرسوم','إثبات سداد رسوم رخصة البناء ورسوم الجهات الأخرى','رفع ملف',1,'بعد الدفع','الإدارة المالية'],
  ['SRV-DES-BLDG-PERMIT','REQ-PERMIT-DOC-04','document','رخصة البناء الصادرة','نسخة من تصريح/رخصة البناء النهائية','رفع ملف',1,'بعد إصدار الرخصة','الاستشاري + إدارة التطوير'],
  ['SRV-DES-BLDG-PERMIT','REQ-PERMIT-DATA-01','data','رقم رخصة البناء وتاريخها','رقم الرخصة وتاريخ الإصدار وتاريخ الانتهاء إن وجد','إدخال في النظام',1,'بعد إصدار الرخصة','إدارة التطوير'],
];

for (const [serviceCode, requirementCode, reqType, nameAr, descriptionAr, source, isMandatory, timing, responsibleParty] of stg10Reqs) {
  await conn.execute(`
    INSERT IGNORE INTO lifecycle_requirements
      (serviceCode, requirementCode, reqType, nameAr, descriptionAr, sourceNote, isMandatory, timing, internalOwner)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [serviceCode, requirementCode, reqType, nameAr, descriptionAr, source, isMandatory, timing, responsibleParty]);
}
console.log(`✅ STG-10 requirements inserted (${stg10Reqs.length} reqs)`);

// ─── STG-20: مرحلة الدعاية والتسويق والمبيعات ─────────────────────────────
await conn.execute(`
  INSERT IGNORE INTO lifecycle_stages (stageCode, nameAr, descriptionAr, defaultStatus, sortOrder)
  VALUES ('STG-20', 'مرحلة الدعاية والتسويق والمبيعات',
    'إدارة الوسطاء والمواد التسويقية وتصاريح الإعلان وإطلاق حملات بيع المشروع',
    'not_started', 20)
`);
console.log('✅ STG-20 stage inserted');

// ─── STG-20 Services ───────────────────────────────────────────────────────
const stg20Services = [
  ['SRV-MKT-BROKERS-SETUP', 'تعيين واعتماد الوسطاء العقاريين للمشروع',
   'اختيار شركات الوساطة المعتمدة وتوقيع اتفاقيات التسويق الخاصة بالمشروع',
   'STG-20', 'شركات الوساطة العقارية المسجلة لدى RERA', 'إدارة التطوير + إدارة المبيعات', 1, 7],
  ['SRV-MKT-MATERIAL-PREP', 'تحضير واعتماد المواد التسويقية',
   'إعداد البروشورات والمخططات التسويقية ومحتوى الحملات واعتمادها داخلياً',
   'STG-20', 'استشاري التصميم + شركات الدعاية (إن وجدت)', 'إدارة التسويق + إدارة التطوير', 1, 10],
  ['SRV-MKT-AD-PERMIT', 'الحصول على تصريح إعلان (تراخيصي)',
   'التقديم على تصريح إعلان/تسويق للمشروع عبر نظام تراخيصي قبل أي حملة',
   'STG-20', 'دائرة الأراضي والأملاك / RERA (نظام تراخيصي)', 'إدارة التسويق + إدارة التطوير', 1, 2],
  ['SRV-MKT-LAUNCH-SALES', 'إطلاق حملة التسويق والمبيعات',
   'بدء الحملة التسويقية والبيع الفعلي للوحدات وفقاً للتصريح ونظام أوكود',
   'STG-20', 'RERA + شركات الوساطة + منصات الإعلان', 'إدارة التسويق + إدارة المبيعات', 1, 30],
];

for (const [serviceCode, nameAr, descriptionAr, stageCode, externalParty, internalParty, isMandatory, durationDays] of stg20Services) {
  await conn.execute(`
    INSERT IGNORE INTO lifecycle_services
      (serviceCode, nameAr, descriptionAr, stageCode, externalParty, internalOwner, isMandatory, expectedDurationDays)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [serviceCode, nameAr, descriptionAr, stageCode, externalParty, internalParty, isMandatory, durationDays]);
}
console.log('✅ STG-20 services inserted (4 services)');

// ─── STG-20 Requirements ───────────────────────────────────────────────────
const stg20Reqs = [
  // SRV-MKT-BROKERS-SETUP (6 reqs)
  ['SRV-MKT-BROKERS-SETUP','REQ-BRK-DOC-01','document','قائمة الوسطاء المقترحين','قائمة بأسماء شركات الوساطة المرشحة لتسويق المشروع','رفع ملف / إدخال',1,'قبل الاختيار','إدارة التطوير / إدارة المبيعات'],
  ['SRV-MKT-BROKERS-SETUP','REQ-BRK-DOC-02','document','رخص شركات الوساطة','نسخة من الرخصة التجارية لكل شركة وساطة','رفع ملف',1,'قبل الاعتماد','إدارة المبيعات'],
  ['SRV-MKT-BROKERS-SETUP','REQ-BRK-DOC-03','document','بطاقات الوسطاء (RERA Broker Cards)','نسخ من بطاقات الوسطاء المعنيين بالمشروع','رفع ملف',1,'قبل الاعتماد','إدارة المبيعات'],
  ['SRV-MKT-BROKERS-SETUP','REQ-BRK-DOC-04','document','اتفاقية تسويق المشروع مع الوسيط','عقد/اتفاقية تسويق بين المطوّر وشركة الوساطة يحدد الشروط والعمولة','رفع ملف',1,'قبل بدء التسويق','الشؤون القانونية + إدارة المبيعات'],
  ['SRV-MKT-BROKERS-SETUP','REQ-BRK-DATA-01','data','عدد الوسطاء المعتمدين للمشروع','عدد الشركات/الوسطاء المسموح لهم بتسويق المشروع','إدخال',1,'قبل الإغلاق','إدارة المبيعات'],
  ['SRV-MKT-BROKERS-SETUP','REQ-BRK-DATA-02','data','شروط وعمولات الوساطة','ملخص لشروط العمولة لكل وسيط (نسبة، شروط دفع...)','إدخال',1,'قبل الإغلاق','إدارة المبيعات + الإدارة المالية'],

  // SRV-MKT-MATERIAL-PREP (8 reqs)
  ['SRV-MKT-MATERIAL-PREP','REQ-MKT-DOC-01','document','بروشور المشروع (مسودة أولى)','مسودة أولية للبروشور تتضمن صور/رندرات ومعلومات أساسية','رفع ملف',1,'مرحلة الإعداد','إدارة التسويق + الاستشاري'],
  ['SRV-MKT-MATERIAL-PREP','REQ-MKT-DOC-02','document','رندرات وصور خارجية وداخلية','صور ورندرات معمارية تستخدم في الدعاية','رفع ملف',0,'مرحلة الإعداد','الاستشاري / شركة الدعاية'],
  ['SRV-MKT-MATERIAL-PREP','REQ-MKT-DOC-03','document','مخططات الوحدات (Floor Plans) للتسويق','مخططات شقق/محلات بنسخة مناسبة للعميل','رفع ملف',1,'قبل طلب التصريح','الاستشاري + إدارة التسويق'],
  ['SRV-MKT-MATERIAL-PREP','REQ-MKT-DOC-04','document','قائمة الأسعار المبدئية','جدول بأسعار الوحدات أو نطاق الأسعار للمشروع','رفع ملف',1,'قبل طلب التصريح','الإدارة المالية + إدارة التسويق'],
  ['SRV-MKT-MATERIAL-PREP','REQ-MKT-DOC-05','document','نصوص الحملة التسويقية','ملفات تحتوي النصوص المستخدمة في الإعلانات (أونلاين/أوفلاين)','رفع ملف',1,'قبل طلب التصريح','إدارة التسويق'],
  ['SRV-MKT-MATERIAL-PREP','REQ-MKT-DOC-06','document','موافقة داخلية على المواد التسويقية','نموذج/محضر يثبت اعتماد المادة التسويقية من الإدارة','رفع ملف',1,'قبل طلب التصريح','الإدارة العليا / إدارة التطوير'],
  ['SRV-MKT-MATERIAL-PREP','REQ-MKT-DATA-01','data','تاريخ الإطلاق المستهدف','التاريخ المبدئي لبداية الحملة التسويقية','إدخال',1,'خلال الإعداد','إدارة التسويق'],
  ['SRV-MKT-MATERIAL-PREP','REQ-MKT-DATA-02','data','القنوات التسويقية الأساسية','تحديد القنوات (سوشال ميديا، صحف، لوحات، معارض...)','إدخال',1,'خلال الإعداد','إدارة التسويق'],

  // SRV-MKT-AD-PERMIT (8 reqs)
  ['SRV-MKT-AD-PERMIT','REQ-AD-DOC-01','document','شهادة تسجيل المشروع ورقم RERA','إثبات تسجيل المشروع لدى RERA مع رقم المشروع','من خدمة تسجيل المشروع',1,'قبل طلب التصريح','إدارة التطوير'],
  ['SRV-MKT-AD-PERMIT','REQ-AD-DOC-02','document','إثبات فتح حساب الضمان للمشروع','مستند من البنك أو RERA يثبت رقم حساب الضمان','من خدمة فتح حساب الضمان',1,'قبل طلب التصريح','الإدارة المالية + إدارة التطوير'],
  ['SRV-MKT-AD-PERMIT','REQ-AD-DOC-03','document','رخصة المطوّر أو شركة التسويق','رخصة الجهة التي ستتقدم بطلب التصريح (مطور أو شركة وساطة)','من ملف الشركة',1,'قبل طلب التصريح','الشؤون القانونية'],
  ['SRV-MKT-AD-PERMIT','REQ-AD-DOC-04','document','نسخ من المواد التسويقية','النسخ النهائية للبروشور/الإعلان التي سيتم تقديمها للنظام','من خدمة تحضير المواد التسويقية',1,'مع طلب التصريح','إدارة التسويق'],
  ['SRV-MKT-AD-PERMIT','REQ-AD-DOC-05','document','إيصال سداد رسوم التصريح','إثبات دفع رسوم تصريح الإعلان (تراخيصي)','رفع ملف',1,'بعد الدفع','الإدارة المالية'],
  ['SRV-MKT-AD-PERMIT','REQ-AD-DOC-06','document','تصريح الإعلان (رقم التصريح)','نسخة من تصريح الإعلان الرسمي ورقم تصريح تراخيصي','رفع ملف',1,'بعد الموافقة','إدارة التسويق'],
  ['SRV-MKT-AD-PERMIT','REQ-AD-DATA-01','data','نوع الإعلان/الحملة','تحديد نوع الإعلان (أونلاين، لوحات، مطبوعات، معرض...)','إدخال',1,'مع طلب التصريح','إدارة التسويق'],
  ['SRV-MKT-AD-PERMIT','REQ-AD-DATA-02','data','مدة التصريح','فترة سريان تصريح الإعلان (من/إلى)','إدخال',1,'بعد إصدار التصريح','إدارة التسويق'],
  ['SRV-MKT-AD-PERMIT','REQ-AD-DATA-03','data','مبلغ رسوم التصريح','قيمة الرسوم المدفوعة لتصريح الإعلان','إدخال',1,'بعد الدفع','الإدارة المالية'],

  // SRV-MKT-LAUNCH-SALES (7 reqs)
  ['SRV-MKT-LAUNCH-SALES','REQ-LNCH-DOC-01','document','خطة الحملة التسويقية','وثيقة تلخص خطة الحملة (قنوات، ميزانية، فترة...)','رفع ملف',1,'قبل الإطلاق','إدارة التسويق'],
  ['SRV-MKT-LAUNCH-SALES','REQ-LNCH-DOC-02','document','تصريح الإعلان الساري','نسخة من تصريح الإعلان مع رقم التصريح','من خدمة تصريح الإعلان',1,'قبل الإطلاق','إدارة التسويق'],
  ['SRV-MKT-LAUNCH-SALES','REQ-LNCH-DOC-03','document','قائمة الوسطاء المشاركين في الحملة','قائمة بأسماء الوسطاء الذين سيستخدمون التصريح في الإعلانات','من خدمة تعيين الوسطاء',1,'قبل الإطلاق','إدارة المبيعات'],
  ['SRV-MKT-LAUNCH-SALES','REQ-LNCH-DATA-01','data','تاريخ بدء الحملة','تاريخ انطلاق الحملة التسويقية','إدخال',1,'قبل الإطلاق','إدارة التسويق'],
  ['SRV-MKT-LAUNCH-SALES','REQ-LNCH-DATA-02','data','تاريخ نهاية الحملة','تاريخ انتهاء الحملة المخطط','إدخال',1,'قبل الإطلاق','إدارة التسويق'],
  ['SRV-MKT-LAUNCH-SALES','REQ-LNCH-DATA-03','data','ميزانية الحملة','القيمة الإجمالية المخصصة للحملة التسويقية','إدخال',0,'قبل الإطلاق','الإدارة المالية + إدارة التسويق'],
  ['SRV-MKT-LAUNCH-SALES','REQ-LNCH-DATA-04','data','رابط/موقع صفحة المشروع','رابط صفحة المشروع على الموقع أو صفحة الهبوط للحملة','إدخال',1,'قبل الإطلاق','إدارة التسويق'],
];

for (const [serviceCode, requirementCode, reqType, nameAr, descriptionAr, source, isMandatory, timing, responsibleParty] of stg20Reqs) {
  await conn.execute(`
    INSERT IGNORE INTO lifecycle_requirements
      (serviceCode, requirementCode, reqType, nameAr, descriptionAr, sourceNote, isMandatory, timing, internalOwner)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [serviceCode, requirementCode, reqType, nameAr, descriptionAr, source, isMandatory, timing, responsibleParty]);
}
console.log(`✅ STG-20 requirements inserted (${stg20Reqs.length} reqs)`);

// ─── Verification ──────────────────────────────────────────────────────────
const [stages] = await conn.execute('SELECT stageCode, nameAr, sortOrder FROM lifecycle_stages ORDER BY sortOrder');
const [services] = await conn.execute('SELECT stageCode, COUNT(*) as cnt FROM lifecycle_services GROUP BY stageCode ORDER BY stageCode');
const [reqs] = await conn.execute('SELECT serviceCode, COUNT(*) as cnt FROM lifecycle_requirements GROUP BY serviceCode ORDER BY serviceCode');

console.log('\n📊 Verification:');
console.log('Stages:', stages.map(s => `${s.stageCode}: ${s.nameAr}`).join(' | '));
console.log('Services per stage:', services.map(s => `${s.stageCode}=${s.cnt}`).join(', '));
console.log('Requirements per service:');
reqs.forEach(r => console.log(`  ${r.serviceCode}: ${r.cnt}`));

await conn.end();
console.log('\n✅ All done!');
