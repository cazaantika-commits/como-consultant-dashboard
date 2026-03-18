/**
 * seed_new_content.mjs
 * 
 * سكريبت لإضافة الخدمات والمتطلبات الجديدة في:
 * - STG-10: مرحلة تعيين الاستشاري والتصاميم والتندر
 * - STG-02: مرحلة التسجيل وريرا والرخص
 * - STG-EXEC: مرحلة التنفيذ والبناء (جديدة)
 * - STG-CLOSE: مرحلة الإقفال والتسليم والصيانة (جديدة)
 * 
 * تشغيل: DATABASE_URL="mysql://..." node seed_new_content.mjs
 * 
 * ملاحظة: لا يحذف أي بيانات قديمة — يضيف فقط
 */

import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ يرجى تعيين DATABASE_URL');
  process.exit(1);
}

// Parse DATABASE_URL
function parseUrl(url) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: parseInt(u.port) || 3306,
    user: u.username,
    password: u.password,
    database: u.pathname.replace('/', ''),
    ssl: { rejectUnauthorized: false },
  };
}

const conn = await mysql.createConnection(parseUrl(DATABASE_URL));
console.log('✅ متصل بقاعدة البيانات');

// ─── Helper: get next sort order for stage ───
async function getNextServiceSort(stageCode) {
  const [rows] = await conn.execute(
    'SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_sort FROM lifecycle_services WHERE stage_code = ?',
    [stageCode]
  );
  return rows[0].next_sort;
}

async function getNextReqSort(serviceCode) {
  const [rows] = await conn.execute(
    'SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_sort FROM lifecycle_requirements WHERE service_code = ?',
    [serviceCode]
  );
  return rows[0].next_sort;
}

// ─── Helper: insert service ───
async function insertService(stageCode, serviceCode, nameAr, descriptionAr, durationDays) {
  const sortOrder = await getNextServiceSort(stageCode);
  // Check if already exists
  const [existing] = await conn.execute(
    'SELECT id FROM lifecycle_services WHERE service_code = ?',
    [serviceCode]
  );
  if (existing.length > 0) {
    console.log(`  ⚠️  الخدمة موجودة بالفعل: ${serviceCode}`);
    return;
  }
  await conn.execute(
    `INSERT INTO lifecycle_services 
     (service_code, stage_code, name_ar, description_ar, expected_duration_days, sort_order, is_mandatory)
     VALUES (?, ?, ?, ?, ?, ?, 1)`,
    [serviceCode, stageCode, nameAr, descriptionAr, durationDays, sortOrder]
  );
  console.log(`  ✅ خدمة جديدة: ${nameAr}`);
}

// ─── Helper: insert requirement ───
async function insertRequirement(serviceCode, reqCode, nameAr, reqType, descriptionAr, isMandatory = 1) {
  const sortOrder = await getNextReqSort(serviceCode);
  const [existing] = await conn.execute(
    'SELECT id FROM lifecycle_requirements WHERE requirement_code = ?',
    [reqCode]
  );
  if (existing.length > 0) {
    console.log(`    ⚠️  المتطلب موجود بالفعل: ${reqCode}`);
    return;
  }
  await conn.execute(
    `INSERT INTO lifecycle_requirements
     (requirement_code, service_code, name_ar, req_type, description_ar, is_mandatory, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [reqCode, serviceCode, nameAr, reqType, descriptionAr, isMandatory, sortOrder]
  );
  console.log(`    ✅ متطلب: ${nameAr} (${reqType})`);
}

// ─── Update stage name ───
async function updateStageName(stageCode, nameAr) {
  await conn.execute(
    'UPDATE lifecycle_stages SET name_ar = ? WHERE stage_code = ?',
    [nameAr, stageCode]
  );
  console.log(`\n🔄 تحديث اسم المرحلة ${stageCode} → ${nameAr}`);
}

// ─── Insert stage if not exists ───
async function insertStageIfNotExists(stageCode, nameAr, sortOrder) {
  const [existing] = await conn.execute(
    'SELECT id FROM lifecycle_stages WHERE stage_code = ?',
    [stageCode]
  );
  if (existing.length > 0) {
    console.log(`\n⚠️  المرحلة موجودة بالفعل: ${stageCode}`);
    return;
  }
  await conn.execute(
    `INSERT INTO lifecycle_stages (stage_code, name_ar, is_active, sort_order, default_status)
     VALUES (?, ?, 1, ?, 'not_started')`,
    [stageCode, nameAr, sortOrder]
  );
  console.log(`\n✅ مرحلة جديدة: ${nameAr} (${stageCode})`);
}

// ═══════════════════════════════════════════════════════════
// STG-10: مرحلة تعيين الاستشاري والتصاميم والتندر
// ═══════════════════════════════════════════════════════════
await updateStageName('STG-10', 'مرحلة تعيين الاستشاري والتصاميم والتندر');

const stg10Services = [
  {
    code: 'SRV-STG10-RFP',
    name: 'إرسال طلب العروض للاستشاريين',
    desc: 'إعداد مستند طلب العروض وخطاب الدعوة وإرساله إلى الاستشاريين المرشحين للحصول على عروضهم لخدمات التصميم والإشراف.',
    days: 14,
    reqs: [
      { code: 'REQ-STG10-RFP-001', name: 'مستند طلب العروض (RFP)', type: 'document', desc: 'وثيقة طلب العروض الرسمية' },
      { code: 'REQ-STG10-RFP-002', name: 'خطاب الدعوة للاستشاريين', type: 'document', desc: 'خطاب رسمي لدعوة الاستشاريين' },
      { code: 'REQ-STG10-RFP-003', name: 'قائمة الاستشاريين المرشحين', type: 'data', desc: 'أسماء وبيانات الاستشاريين المدعوين' },
    ]
  },
  {
    code: 'SRV-STG10-EVAL',
    name: 'استلام العروض وتقييمها وترشيح الاستشاري',
    desc: 'استلام العروض الفنية والمالية، الرد على الاستفسارات، إجراء التقييم الفني والمالي، وإعداد توصية الاختيار.',
    days: 21,
    reqs: [
      { code: 'REQ-STG10-EVAL-001', name: 'العروض الفنية والمالية المستلمة', type: 'document', desc: 'ملفات العروض من الاستشاريين' },
      { code: 'REQ-STG10-EVAL-002', name: 'محضر تقييم العروض', type: 'document', desc: 'جدول مقارنة وتقييم العروض' },
      { code: 'REQ-STG10-EVAL-003', name: 'توصية اختيار الاستشاري', type: 'document', desc: 'تقرير التوصية المرفوع للإدارة' },
      { code: 'REQ-STG10-EVAL-004', name: 'اعتماد الإدارة على التوصية', type: 'approval', desc: 'موافقة الإدارة على الاستشاري المختار' },
    ]
  },
  {
    code: 'SRV-STG10-CONTRACT',
    name: 'التفاوض النهائي وتوقيع عقد الاستشاري',
    desc: 'التفاوض على نطاق الخدمات والمدد والرسوم، الاتفاق على الشروط، توقيع العقد وإصدار أمر المباشرة.',
    days: 14,
    reqs: [
      { code: 'REQ-STG10-CONTRACT-001', name: 'عقد الاستشاري الموقع', type: 'document', desc: 'نسخة العقد النهائية الموقعة' },
      { code: 'REQ-STG10-CONTRACT-002', name: 'كتاب التكليف / أمر المباشرة', type: 'document', desc: 'خطاب رسمي بتكليف الاستشاري' },
      { code: 'REQ-STG10-CONTRACT-003', name: 'تاريخ بدء خدمات الاستشاري', type: 'data', desc: 'التاريخ الرسمي لبدء العمل' },
    ]
  },
  {
    code: 'SRV-STG10-CONCEPT',
    name: 'إعداد وتصميم الكونسبت',
    desc: 'إعداد الفكرة المعمارية العامة، تحديد الاستعمالات والمساحات، إعداد مخططات أولية ومناظير خارجية وتقدير مبدئي للتكلفة.',
    days: 30,
    reqs: [
      { code: 'REQ-STG10-CONCEPT-001', name: 'مخططات الكونسبت الأولية', type: 'document', desc: 'المخططات المعمارية الأولية' },
      { code: 'REQ-STG10-CONCEPT-002', name: 'مناظير خارجية (Renderings)', type: 'document', desc: 'صور ثلاثية الأبعاد للمشروع' },
      { code: 'REQ-STG10-CONCEPT-003', name: 'التقدير المبدئي للتكلفة', type: 'document', desc: 'تقدير أولي لتكلفة المشروع' },
      { code: 'REQ-STG10-CONCEPT-004', name: 'اعتماد المالك على الكونسبت', type: 'approval', desc: 'موافقة المالك على الفكرة المعمارية' },
    ]
  },
  {
    code: 'SRV-STG10-SCHEMATIC',
    name: 'إعداد التصميم التخطيطي',
    desc: 'تطوير التصميم لتحديد توزيع الفراغات، إعداد مخططات الأدوار والواجهات، التنسيق المبدئي مع الأنظمة الإنشائية والميكانيكية والكهربائية.',
    days: 45,
    reqs: [
      { code: 'REQ-STG10-SCHEMATIC-001', name: 'مخططات التصميم التخطيطي', type: 'document', desc: 'مخططات الأدوار والواجهات والمقاطع' },
      { code: 'REQ-STG10-SCHEMATIC-002', name: 'جداول المساحات', type: 'data', desc: 'GFA وNet لكل نوع وحدة' },
      { code: 'REQ-STG10-SCHEMATIC-003', name: 'اعتماد المالك على التصميم التخطيطي', type: 'approval', desc: 'موافقة رسمية من المالك' },
    ]
  },
  {
    code: 'SRV-STG10-DETAILED',
    name: 'إعداد التصميم التفصيلي',
    desc: 'إعداد جميع الرسومات التفصيلية المعمارية والإنشائية والميكانيكية والكهربائية، استكمال التنسيق بين التخصصات.',
    days: 60,
    reqs: [
      { code: 'REQ-STG10-DETAILED-001', name: 'حزمة الرسومات التفصيلية الكاملة', type: 'document', desc: 'جميع الرسومات التفصيلية لجميع التخصصات' },
      { code: 'REQ-STG10-DETAILED-002', name: 'جداول المواد والتشطيبات', type: 'document', desc: 'جداول تفصيلية للمواد والتشطيبات' },
    ]
  },
  {
    code: 'SRV-STG10-PERMITS',
    name: 'الحصول على موافقات ورخص الجهات الرسمية',
    desc: 'تقديم المخططات للبلدية والجهات الخدمية والدفاع المدني، الرد على الملاحظات، استكمال الموافقات لرخصة البناء.',
    days: 90,
    reqs: [
      { code: 'REQ-STG10-PERMITS-001', name: 'موافقة البلدية على المخططات', type: 'document', desc: 'ختم وموافقة البلدية' },
      { code: 'REQ-STG10-PERMITS-002', name: 'موافقة الدفاع المدني', type: 'document', desc: 'NOC من الدفاع المدني' },
      { code: 'REQ-STG10-PERMITS-003', name: 'موافقات الجهات الخدمية', type: 'document', desc: 'NOCs من الكهرباء والماء وغيرها' },
    ]
  },
  {
    code: 'SRV-STG10-TENDER-DOCS',
    name: 'إعداد وثائق ورسومات المناقصة',
    desc: 'تجهيز مستندات المناقصة الكاملة: المواصفات الفنية، جداول الكميات، الشروط الخاصة، ورسومات التندر.',
    days: 21,
    reqs: [
      { code: 'REQ-STG10-TENDER-001', name: 'مستندات المناقصة الكاملة', type: 'document', desc: 'حزمة التندر الكاملة' },
      { code: 'REQ-STG10-TENDER-002', name: 'جداول الكميات (BOQ)', type: 'document', desc: 'جداول الكميات التفصيلية' },
      { code: 'REQ-STG10-TENDER-003', name: 'اعتماد المالك على مستندات التندر', type: 'approval', desc: 'موافقة المالك قبل الطرح' },
    ]
  },
  {
    code: 'SRV-STG10-CONTRACTOR',
    name: 'طرح المناقصة وتقييم عروض المقاولين وتوقيع العقد',
    desc: 'طرح المناقصة، استلام العروض، التقييم والمقارنة، ترشيح المقاول، التفاوض النهائي، إصدار خطاب الترسية وتوقيع العقد.',
    days: 45,
    reqs: [
      { code: 'REQ-STG10-CONTRACTOR-001', name: 'عروض المقاولين المستلمة', type: 'document', desc: 'ملفات العروض الفنية والمالية' },
      { code: 'REQ-STG10-CONTRACTOR-002', name: 'محضر تقييم عروض المقاولين', type: 'document', desc: 'جدول مقارنة وتقييم العروض' },
      { code: 'REQ-STG10-CONTRACTOR-003', name: 'خطاب الترسية النهائي', type: 'document', desc: 'خطاب رسمي بترسية المناقصة' },
      { code: 'REQ-STG10-CONTRACTOR-004', name: 'عقد المقاول الرئيسي الموقع', type: 'document', desc: 'نسخة العقد النهائية الموقعة' },
      { code: 'REQ-STG10-CONTRACTOR-005', name: 'اعتماد الإدارة على اختيار المقاول', type: 'approval', desc: 'موافقة الإدارة على المقاول المختار' },
    ]
  },
];

console.log('\n═══ STG-10: مرحلة تعيين الاستشاري والتصاميم والتندر ═══');
for (const svc of stg10Services) {
  await insertService('STG-10', svc.code, svc.name, svc.desc, svc.days);
  for (const req of svc.reqs) {
    await insertRequirement(svc.code, req.code, req.name, req.type, req.desc);
  }
}

// ═══════════════════════════════════════════════════════════
// STG-02: مرحلة التسجيل وريرا والرخص
// ═══════════════════════════════════════════════════════════
await updateStageName('STG-02', 'مرحلة التسجيل وريرا والرخص');

const stg02Services = [
  {
    code: 'SRV-STG02-OWNERSHIP',
    name: 'تجهيز مستندات الملكية والمستندات القانونية للمشروع',
    desc: 'تجميع سندات الملكية، المخططات المساحية، عقود الشراء، وأي مستندات رهن، وتجهيز التفويضات القانونية.',
    days: 14,
    reqs: [
      { code: 'REQ-STG02-OWN-001', name: 'سند ملكية الأرض', type: 'document', desc: 'وثيقة ملكية الأرض الرسمية' },
      { code: 'REQ-STG02-OWN-002', name: 'المخطط المساحي للقطعة', type: 'document', desc: 'المخطط الرسمي من الجهة المختصة' },
      { code: 'REQ-STG02-OWN-003', name: 'التوكيل القانوني لممثل المالك', type: 'document', desc: 'توكيل رسمي موثق' },
      { code: 'REQ-STG02-OWN-004', name: 'عقود الشراء أو التطوير', type: 'document', desc: 'عقود ذات صلة بالمشروع' },
    ]
  },
  {
    code: 'SRV-STG02-MUNICIPALITY',
    name: 'فتح ملف المشروع لدى الجهة البلدية/التخطيطية',
    desc: 'فتح ملف المشروع في نظام البلدية، تسجيل بيانات القطعة، استعمالات الأرض، والاشتراطات التخطيطية.',
    days: 14,
    reqs: [
      { code: 'REQ-STG02-MUN-001', name: 'رقم ملف المشروع في البلدية', type: 'data', desc: 'الرقم المرجعي للملف' },
      { code: 'REQ-STG02-MUN-002', name: 'شهادة الاشتراطات التخطيطية', type: 'document', desc: 'وثيقة الاشتراطات من البلدية' },
    ]
  },
  {
    code: 'SRV-STG02-RERA-REG',
    name: 'تسجيل المطوّر لدى ريرا',
    desc: 'استكمال متطلبات تسجيل الشركة/الكيان كمطور عقاري معتمد وربط بيانات المطوّر بالمشاريع.',
    days: 21,
    reqs: [
      { code: 'REQ-STG02-RERA-001', name: 'شهادة تسجيل المطوّر في ريرا', type: 'document', desc: 'وثيقة التسجيل الرسمية' },
      { code: 'REQ-STG02-RERA-002', name: 'رقم تسجيل المطوّر', type: 'data', desc: 'الرقم المرجعي للمطوّر في ريرا' },
    ]
  },
  {
    code: 'SRV-STG02-RERA-DATA',
    name: 'إعداد بيانات ومخططات المشروع لاعتماد ريرا',
    desc: 'تجهيز جداول الوحدات والمساحات، استخراج المخططات المعمارية، وإعداد الملخصات والجداول المطلوبة.',
    days: 14,
    reqs: [
      { code: 'REQ-STG02-DATA-001', name: 'جدول الوحدات والمساحات', type: 'document', desc: 'جدول تفصيلي بعدد الوحدات وأنواعها ومساحاتها' },
      { code: 'REQ-STG02-DATA-002', name: 'المخططات المعمارية لريرا', type: 'document', desc: 'مخططات بالصيغة المطلوبة من ريرا' },
      { code: 'REQ-STG02-DATA-003', name: 'إجمالي المساحة الإجمالية (GFA)', type: 'data', desc: 'رقم GFA الإجمالي للمشروع' },
      { code: 'REQ-STG02-DATA-004', name: 'عدد الوحدات الإجمالي', type: 'data', desc: 'العدد الكلي للوحدات في المشروع' },
    ]
  },
  {
    code: 'SRV-STG02-RERA-SUBMIT',
    name: 'تقديم طلب تسجيل المشروع العقاري لدى ريرا',
    desc: 'تقديم طلب تسجيل مشروع جديد على نظام ريرا مع إرفاق المستندات القانونية ومخططات المشروع وجداول الوحدات.',
    days: 7,
    reqs: [
      { code: 'REQ-STG02-SUBMIT-001', name: 'رقم طلب التسجيل في ريرا', type: 'data', desc: 'الرقم المرجعي للطلب المقدم' },
      { code: 'REQ-STG02-SUBMIT-002', name: 'إيصال تقديم الطلب', type: 'document', desc: 'إيصال رسمي من نظام ريرا' },
    ]
  },
  {
    code: 'SRV-STG02-RERA-APPROVAL',
    name: 'استكمال ملاحظات ريرا والحصول على موافقة التسجيل',
    desc: 'الرد على ملاحظات ريرا، تعديل البيانات أو العقود حسب المطلوب، والحصول على موافقة تسجيل المشروع نهائياً.',
    days: 30,
    reqs: [
      { code: 'REQ-STG02-RERA-APP-001', name: 'شهادة تسجيل المشروع في ريرا', type: 'document', desc: 'الوثيقة الرسمية لتسجيل المشروع' },
      { code: 'REQ-STG02-RERA-APP-002', name: 'رقم تسجيل المشروع في ريرا', type: 'data', desc: 'الرقم الرسمي للمشروع في نظام ريرا' },
    ]
  },
  {
    code: 'SRV-STG02-BP-DOCS',
    name: 'إعداد مستندات طلب رخصة البناء',
    desc: 'تنسيق الحزمة الفنية مع متطلبات البلدية، تجهيز التقارير الإنشائية والميكانيكية والكهربائية وتقارير السلامة.',
    days: 21,
    reqs: [
      { code: 'REQ-STG02-BP-001', name: 'حزمة الرسومات التفصيلية للبلدية', type: 'document', desc: 'الرسومات بالصيغة المطلوبة للبلدية' },
      { code: 'REQ-STG02-BP-002', name: 'التقرير الإنشائي', type: 'document', desc: 'تقرير الاستشاري الإنشائي' },
      { code: 'REQ-STG02-BP-003', name: 'تقرير الأنظمة الميكانيكية والكهربائية', type: 'document', desc: 'تقرير MEP' },
      { code: 'REQ-STG02-BP-004', name: 'تقرير السلامة والحريق', type: 'document', desc: 'تقرير متطلبات الدفاع المدني' },
    ]
  },
  {
    code: 'SRV-STG02-BP-SUBMIT',
    name: 'تقديم طلب رخصة البناء للبلدية والجهات المختصة',
    desc: 'تقديم طلب رخصة البناء على نظام البلدية الإلكتروني، رفع الرسومات والمستندات المساندة.',
    days: 7,
    reqs: [
      { code: 'REQ-STG02-BPS-001', name: 'رقم طلب رخصة البناء', type: 'data', desc: 'الرقم المرجعي للطلب في نظام البلدية' },
      { code: 'REQ-STG02-BPS-002', name: 'إيصال تقديم الطلب', type: 'document', desc: 'إيصال رسمي من النظام الإلكتروني' },
    ]
  },
  {
    code: 'SRV-STG02-NOC',
    name: 'متابعة ملاحظات الجهات والحصول على الموافقات والـ NOCs',
    desc: 'متابعة ملاحظات البلدية والجهات المختلفة، تنسيق التعديلات مع الاستشاري، استكمال كافة الموافقات والـ NOCs.',
    days: 60,
    reqs: [
      { code: 'REQ-STG02-NOC-001', name: 'NOC الكهرباء', type: 'document', desc: 'عدم الممانعة من شركة الكهرباء' },
      { code: 'REQ-STG02-NOC-002', name: 'NOC المياه والصرف الصحي', type: 'document', desc: 'عدم الممانعة من شركة المياه' },
      { code: 'REQ-STG02-NOC-003', name: 'NOC الدفاع المدني', type: 'document', desc: 'عدم الممانعة من الدفاع المدني' },
      { code: 'REQ-STG02-NOC-004', name: 'NOCs الجهات الأخرى', type: 'document', desc: 'موافقات الجهات الخدمية الأخرى' },
    ]
  },
  {
    code: 'SRV-STG02-BP-FINAL',
    name: 'استصدار رخصة البناء النهائية',
    desc: 'استلام رخصة البناء النهائية من البلدية بعد استكمال كل المتطلبات، ومشاركتها مع الاستشاري والمقاول.',
    days: 7,
    reqs: [
      { code: 'REQ-STG02-BP-FINAL-001', name: 'رخصة البناء النهائية', type: 'document', desc: 'الرخصة الرسمية من البلدية' },
      { code: 'REQ-STG02-BP-FINAL-002', name: 'رقم رخصة البناء', type: 'data', desc: 'الرقم الرسمي للرخصة' },
      { code: 'REQ-STG02-BP-FINAL-003', name: 'تاريخ إصدار الرخصة', type: 'data', desc: 'تاريخ الإصدار الرسمي' },
      { code: 'REQ-STG02-BP-FINAL-004', name: 'تاريخ انتهاء الرخصة', type: 'data', desc: 'تاريخ انتهاء صلاحية الرخصة' },
    ]
  },
];

console.log('\n═══ STG-02: مرحلة التسجيل وريرا والرخص ═══');
for (const svc of stg02Services) {
  await insertService('STG-02', svc.code, svc.name, svc.desc, svc.days);
  for (const req of svc.reqs) {
    await insertRequirement(svc.code, req.code, req.name, req.type, req.desc);
  }
}

// ═══════════════════════════════════════════════════════════
// STG-EXEC: مرحلة التنفيذ والبناء (جديدة)
// ═══════════════════════════════════════════════════════════
await insertStageIfNotExists('STG-EXEC', 'مرحلة التنفيذ والبناء', 30);

const stgExecServices = [
  {
    code: 'SRV-EXEC-MAIN',
    name: 'تنفيذ أعمال المشروع في الموقع',
    desc: 'تنفيذ أعمال المشروع في الموقع وفق المخططات المعتمدة وعقد المقاول، تشمل أعمال الهيكل والتشطيبات والخدمات والاختبارات.',
    days: 365,
    reqs: [
      { code: 'REQ-EXEC-001', name: 'تقارير التقدم الشهرية', type: 'document', desc: 'تقارير متابعة التنفيذ الشهرية' },
      { code: 'REQ-EXEC-002', name: 'نسبة الإنجاز الإجمالية', type: 'data', desc: 'نسبة الإنجاز الفعلية للمشروع' },
      { code: 'REQ-EXEC-003', name: 'تاريخ بدء التنفيذ الفعلي', type: 'data', desc: 'تاريخ بدء أعمال الموقع' },
      { code: 'REQ-EXEC-004', name: 'التاريخ المتوقع للاكتمال', type: 'data', desc: 'التاريخ المتوقع لإنهاء الأعمال' },
    ]
  },
];

console.log('\n═══ STG-EXEC: مرحلة التنفيذ والبناء ═══');
for (const svc of stgExecServices) {
  await insertService('STG-EXEC', svc.code, svc.name, svc.desc, svc.days);
  for (const req of svc.reqs) {
    await insertRequirement(svc.code, req.code, req.name, req.type, req.desc);
  }
}

// ═══════════════════════════════════════════════════════════
// STG-CLOSE: مرحلة الإقفال والتسليم والصيانة (جديدة)
// ═══════════════════════════════════════════════════════════
await insertStageIfNotExists('STG-CLOSE', 'مرحلة الإقفال والتسليم والصيانة', 40);

const stgCloseServices = [
  {
    code: 'SRV-CLOSE-MAIN',
    name: 'الإقفال والتسليم وإدارة الصيانة',
    desc: 'استكمال الأعمال النهائية وأعمال السناغ، فحص واستلام الأعمال من المقاول، تسليم المشروع للمالك/المشغل، وإدارة فترة الصيانة والضمان.',
    days: 90,
    reqs: [
      { code: 'REQ-CLOSE-001', name: 'محضر الاستلام الابتدائي', type: 'document', desc: 'محضر استلام الأعمال من المقاول' },
      { code: 'REQ-CLOSE-002', name: 'قائمة ملاحظات السناغ', type: 'document', desc: 'قائمة الأعمال الناقصة والملاحظات' },
      { code: 'REQ-CLOSE-003', name: 'محضر التسليم النهائي للمالك', type: 'document', desc: 'محضر رسمي بتسليم المشروع' },
      { code: 'REQ-CLOSE-004', name: 'تاريخ بدء فترة الضمان', type: 'data', desc: 'تاريخ بدء فترة الصيانة والضمان' },
      { code: 'REQ-CLOSE-005', name: 'تاريخ انتهاء فترة الضمان', type: 'data', desc: 'تاريخ انتهاء فترة الصيانة والضمان' },
    ]
  },
];

console.log('\n═══ STG-CLOSE: مرحلة الإقفال والتسليم والصيانة ═══');
for (const svc of stgCloseServices) {
  await insertService('STG-CLOSE', svc.code, svc.name, svc.desc, svc.days);
  for (const req of svc.reqs) {
    await insertRequirement(svc.code, req.code, req.name, req.type, req.desc);
  }
}

await conn.end();
console.log('\n✅ اكتمل السكريبت بنجاح!');
console.log('📌 ملاحظة: لم يتم حذف أي بيانات قديمة — تمت الإضافة فقط.');
