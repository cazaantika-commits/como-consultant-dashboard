/**
 * seed_new_content.mjs
 * إضافة الخدمات والمتطلبات الجديدة — لا يحذف أي بيانات قديمة
 * تشغيل: DATABASE_URL="mysql://..." node seed_new_content.mjs
 */

import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('❌ يرجى تعيين DATABASE_URL'); process.exit(1); }

function parseUrl(url) {
  const u = new URL(url);
  return { host: u.hostname, port: parseInt(u.port) || 3306, user: u.username, password: u.password, database: u.pathname.replace('/', ''), ssl: { rejectUnauthorized: false } };
}

const conn = await mysql.createConnection(parseUrl(DATABASE_URL));
console.log('✅ متصل بقاعدة البيانات');

async function getNextServiceSort(stageCode) {
  const [r] = await conn.execute('SELECT COALESCE(MAX(sortOrder), 0) + 1 AS n FROM lifecycle_services WHERE stageCode = ?', [stageCode]);
  return r[0].n;
}
async function getNextReqSort(serviceCode) {
  const [r] = await conn.execute('SELECT COALESCE(MAX(sortOrder), 0) + 1 AS n FROM lifecycle_requirements WHERE serviceCode = ?', [serviceCode]);
  return r[0].n;
}
async function insertService(stageCode, serviceCode, nameAr, descriptionAr, durationDays) {
  const [ex] = await conn.execute('SELECT id FROM lifecycle_services WHERE serviceCode = ?', [serviceCode]);
  if (ex.length > 0) { console.log(`  ⚠️  موجودة: ${nameAr}`); return; }
  const sort = await getNextServiceSort(stageCode);
  await conn.execute(
    'INSERT INTO lifecycle_services (serviceCode, stageCode, nameAr, descriptionAr, expectedDurationDays, sortOrder, isMandatory) VALUES (?,?,?,?,?,?,1)',
    [serviceCode, stageCode, nameAr, descriptionAr, durationDays, sort]
  );
  console.log(`  ✅ خدمة: ${nameAr}`);
}
async function insertReq(serviceCode, reqCode, nameAr, reqType, descriptionAr) {
  const [ex] = await conn.execute('SELECT id FROM lifecycle_requirements WHERE requirementCode = ?', [reqCode]);
  if (ex.length > 0) { console.log(`    ⚠️  موجود: ${nameAr}`); return; }
  const sort = await getNextReqSort(serviceCode);
  await conn.execute(
    'INSERT INTO lifecycle_requirements (requirementCode, serviceCode, nameAr, reqType, descriptionAr, isMandatory, sortOrder) VALUES (?,?,?,?,?,1,?)',
    [reqCode, serviceCode, nameAr, reqType, descriptionAr, sort]
  );
  console.log(`    ✅ متطلب: ${nameAr} (${reqType})`);
}
async function updateStageName(stageCode, nameAr) {
  await conn.execute('UPDATE lifecycle_stages SET nameAr = ? WHERE stageCode = ?', [nameAr, stageCode]);
  console.log(`\n🔄 تحديث: ${stageCode} → ${nameAr}`);
}
async function insertStageIfNotExists(stageCode, nameAr, sortOrder) {
  const [ex] = await conn.execute('SELECT id FROM lifecycle_stages WHERE stageCode = ?', [stageCode]);
  if (ex.length > 0) { console.log(`\n⚠️  المرحلة موجودة: ${stageCode}`); return; }
  await conn.execute(
    "INSERT INTO lifecycle_stages (stageCode, nameAr, isActive, sortOrder, defaultStatus) VALUES (?,?,1,?,'not_started')",
    [stageCode, nameAr, sortOrder]
  );
  console.log(`\n✅ مرحلة جديدة: ${nameAr}`);
}

// ═══ STG-10 ═══
await updateStageName('STG-10', 'مرحلة تعيين الاستشاري والتصاميم والتندر');

const stg10 = [
  { code:'SRV-STG10-RFP', name:'إرسال طلب العروض للاستشاريين', desc:'إعداد مستند طلب العروض وخطاب الدعوة وإرساله للاستشاريين المرشحين.', days:14, reqs:[
    {c:'REQ-STG10-RFP-001', n:'مستند طلب العروض (RFP)', t:'document', d:'وثيقة طلب العروض الرسمية'},
    {c:'REQ-STG10-RFP-002', n:'خطاب الدعوة للاستشاريين', t:'document', d:'خطاب رسمي لدعوة الاستشاريين'},
    {c:'REQ-STG10-RFP-003', n:'قائمة الاستشاريين المرشحين', t:'data', d:'أسماء وبيانات الاستشاريين المدعوين'},
  ]},
  { code:'SRV-STG10-EVAL', name:'استلام العروض وتقييمها وترشيح الاستشاري', desc:'استلام العروض الفنية والمالية وإجراء التقييم وإعداد توصية الاختيار.', days:21, reqs:[
    {c:'REQ-STG10-EVAL-001', n:'العروض الفنية والمالية المستلمة', t:'document', d:'ملفات العروض من الاستشاريين'},
    {c:'REQ-STG10-EVAL-002', n:'محضر تقييم العروض', t:'document', d:'جدول مقارنة وتقييم العروض'},
    {c:'REQ-STG10-EVAL-003', n:'توصية اختيار الاستشاري', t:'document', d:'تقرير التوصية المرفوع للإدارة'},
    {c:'REQ-STG10-EVAL-004', n:'اعتماد الإدارة على التوصية', t:'approval', d:'موافقة الإدارة على الاستشاري المختار'},
  ]},
  { code:'SRV-STG10-CONTRACT', name:'التفاوض النهائي وتوقيع عقد الاستشاري', desc:'التفاوض على نطاق الخدمات والمدد والرسوم وتوقيع العقد وإصدار أمر المباشرة.', days:14, reqs:[
    {c:'REQ-STG10-CONTRACT-001', n:'عقد الاستشاري الموقع', t:'document', d:'نسخة العقد النهائية الموقعة'},
    {c:'REQ-STG10-CONTRACT-002', n:'كتاب التكليف / أمر المباشرة', t:'document', d:'خطاب رسمي بتكليف الاستشاري'},
    {c:'REQ-STG10-CONTRACT-003', n:'تاريخ بدء خدمات الاستشاري', t:'data', d:'التاريخ الرسمي لبدء العمل'},
  ]},
  { code:'SRV-STG10-CONCEPT', name:'إعداد وتصميم الكونسبت', desc:'إعداد الفكرة المعمارية العامة وتحديد الاستعمالات والمساحات وإعداد مخططات أولية.', days:30, reqs:[
    {c:'REQ-STG10-CONCEPT-001', n:'مخططات الكونسبت الأولية', t:'document', d:'المخططات المعمارية الأولية'},
    {c:'REQ-STG10-CONCEPT-002', n:'مناظير خارجية (Renderings)', t:'document', d:'صور ثلاثية الأبعاد للمشروع'},
    {c:'REQ-STG10-CONCEPT-003', n:'التقدير المبدئي للتكلفة', t:'document', d:'تقدير أولي لتكلفة المشروع'},
    {c:'REQ-STG10-CONCEPT-004', n:'اعتماد المالك على الكونسبت', t:'approval', d:'موافقة المالك على الفكرة المعمارية'},
  ]},
  { code:'SRV-STG10-SCHEMATIC', name:'إعداد التصميم التخطيطي', desc:'تطوير التصميم لتحديد توزيع الفراغات وإعداد مخططات الأدوار والواجهات.', days:45, reqs:[
    {c:'REQ-STG10-SCHEMATIC-001', n:'مخططات التصميم التخطيطي', t:'document', d:'مخططات الأدوار والواجهات والمقاطع'},
    {c:'REQ-STG10-SCHEMATIC-002', n:'جداول المساحات (GFA / Net)', t:'data', d:'GFA وNet لكل نوع وحدة'},
    {c:'REQ-STG10-SCHEMATIC-003', n:'اعتماد المالك على التصميم التخطيطي', t:'approval', d:'موافقة رسمية من المالك'},
  ]},
  { code:'SRV-STG10-DETAILED', name:'إعداد التصميم التفصيلي', desc:'إعداد جميع الرسومات التفصيلية المعمارية والإنشائية والميكانيكية والكهربائية.', days:60, reqs:[
    {c:'REQ-STG10-DETAILED-001', n:'حزمة الرسومات التفصيلية الكاملة', t:'document', d:'جميع الرسومات التفصيلية لجميع التخصصات'},
    {c:'REQ-STG10-DETAILED-002', n:'جداول المواد والتشطيبات', t:'document', d:'جداول تفصيلية للمواد والتشطيبات'},
  ]},
  { code:'SRV-STG10-PERMITS', name:'الحصول على موافقات ورخص الجهات الرسمية', desc:'تقديم المخططات للبلدية والجهات الخدمية والدفاع المدني واستكمال الموافقات.', days:90, reqs:[
    {c:'REQ-STG10-PERMITS-001', n:'موافقة البلدية على المخططات', t:'document', d:'ختم وموافقة البلدية'},
    {c:'REQ-STG10-PERMITS-002', n:'موافقة الدفاع المدني', t:'document', d:'NOC من الدفاع المدني'},
    {c:'REQ-STG10-PERMITS-003', n:'موافقات الجهات الخدمية', t:'document', d:'NOCs من الكهرباء والماء وغيرها'},
  ]},
  { code:'SRV-STG10-TENDER-DOCS', name:'إعداد وثائق ورسومات المناقصة', desc:'تجهيز مستندات المناقصة الكاملة: المواصفات الفنية وجداول الكميات والشروط الخاصة.', days:21, reqs:[
    {c:'REQ-STG10-TENDER-001', n:'مستندات المناقصة الكاملة', t:'document', d:'حزمة التندر الكاملة'},
    {c:'REQ-STG10-TENDER-002', n:'جداول الكميات (BOQ)', t:'document', d:'جداول الكميات التفصيلية'},
    {c:'REQ-STG10-TENDER-003', n:'اعتماد المالك على مستندات التندر', t:'approval', d:'موافقة المالك قبل الطرح'},
  ]},
  { code:'SRV-STG10-CONTRACTOR', name:'طرح المناقصة وتقييم عروض المقاولين وتوقيع العقد', desc:'طرح المناقصة واستلام العروض والتقييم والترشيح والتفاوض وإصدار خطاب الترسية وتوقيع العقد.', days:45, reqs:[
    {c:'REQ-STG10-CONTRACTOR-001', n:'عروض المقاولين المستلمة', t:'document', d:'ملفات العروض الفنية والمالية'},
    {c:'REQ-STG10-CONTRACTOR-002', n:'محضر تقييم عروض المقاولين', t:'document', d:'جدول مقارنة وتقييم العروض'},
    {c:'REQ-STG10-CONTRACTOR-003', n:'خطاب الترسية النهائي', t:'document', d:'خطاب رسمي بترسية المناقصة'},
    {c:'REQ-STG10-CONTRACTOR-004', n:'عقد المقاول الرئيسي الموقع', t:'document', d:'نسخة العقد النهائية الموقعة'},
    {c:'REQ-STG10-CONTRACTOR-005', n:'اعتماد الإدارة على اختيار المقاول', t:'approval', d:'موافقة الإدارة على المقاول المختار'},
  ]},
];

console.log('\n═══ STG-10 ═══');
for (const s of stg10) {
  await insertService('STG-10', s.code, s.name, s.desc, s.days);
  for (const r of s.reqs) await insertReq(s.code, r.c, r.n, r.t, r.d);
}

// ═══ STG-02 ═══
await updateStageName('STG-02', 'مرحلة التسجيل وريرا والرخص');

const stg02 = [
  { code:'SRV-STG02-OWNERSHIP', name:'تجهيز مستندات الملكية والمستندات القانونية', desc:'تجميع سندات الملكية والمخططات المساحية وعقود الشراء والتفويضات القانونية.', days:14, reqs:[
    {c:'REQ-STG02-OWN-001', n:'سند ملكية الأرض', t:'document', d:'وثيقة ملكية الأرض الرسمية'},
    {c:'REQ-STG02-OWN-002', n:'المخطط المساحي للقطعة', t:'document', d:'المخطط الرسمي من الجهة المختصة'},
    {c:'REQ-STG02-OWN-003', n:'التوكيل القانوني لممثل المالك', t:'document', d:'توكيل رسمي موثق'},
    {c:'REQ-STG02-OWN-004', n:'عقود الشراء أو التطوير', t:'document', d:'عقود ذات صلة بالمشروع'},
  ]},
  { code:'SRV-STG02-MUNICIPALITY', name:'فتح ملف المشروع لدى الجهة البلدية', desc:'فتح ملف المشروع في نظام البلدية وتسجيل بيانات القطعة والاشتراطات التخطيطية.', days:14, reqs:[
    {c:'REQ-STG02-MUN-001', n:'رقم ملف المشروع في البلدية', t:'data', d:'الرقم المرجعي للملف'},
    {c:'REQ-STG02-MUN-002', n:'شهادة الاشتراطات التخطيطية', t:'document', d:'وثيقة الاشتراطات من البلدية'},
  ]},
  { code:'SRV-STG02-RERA-REG', name:'تسجيل المطوّر لدى ريرا', desc:'استكمال متطلبات تسجيل الشركة كمطور عقاري معتمد.', days:21, reqs:[
    {c:'REQ-STG02-RERA-001', n:'شهادة تسجيل المطوّر في ريرا', t:'document', d:'وثيقة التسجيل الرسمية'},
    {c:'REQ-STG02-RERA-002', n:'رقم تسجيل المطوّر', t:'data', d:'الرقم المرجعي للمطوّر في ريرا'},
  ]},
  { code:'SRV-STG02-RERA-DATA', name:'إعداد بيانات ومخططات المشروع لاعتماد ريرا', desc:'تجهيز جداول الوحدات والمساحات واستخراج المخططات المعمارية.', days:14, reqs:[
    {c:'REQ-STG02-DATA-001', n:'جدول الوحدات والمساحات', t:'document', d:'جدول تفصيلي بعدد الوحدات وأنواعها ومساحاتها'},
    {c:'REQ-STG02-DATA-002', n:'المخططات المعمارية لريرا', t:'document', d:'مخططات بالصيغة المطلوبة من ريرا'},
    {c:'REQ-STG02-DATA-003', n:'إجمالي المساحة الإجمالية (GFA)', t:'data', d:'رقم GFA الإجمالي للمشروع'},
    {c:'REQ-STG02-DATA-004', n:'عدد الوحدات الإجمالي', t:'data', d:'العدد الكلي للوحدات في المشروع'},
  ]},
  { code:'SRV-STG02-RERA-SUBMIT', name:'تقديم طلب تسجيل المشروع العقاري لدى ريرا', desc:'تقديم طلب تسجيل مشروع جديد على نظام ريرا مع إرفاق المستندات.', days:7, reqs:[
    {c:'REQ-STG02-SUBMIT-001', n:'رقم طلب التسجيل في ريرا', t:'data', d:'الرقم المرجعي للطلب المقدم'},
    {c:'REQ-STG02-SUBMIT-002', n:'إيصال تقديم الطلب', t:'document', d:'إيصال رسمي من نظام ريرا'},
  ]},
  { code:'SRV-STG02-RERA-APPROVAL', name:'استكمال ملاحظات ريرا والحصول على موافقة التسجيل', desc:'الرد على ملاحظات ريرا وتعديل البيانات والحصول على موافقة التسجيل النهائية.', days:30, reqs:[
    {c:'REQ-STG02-RERA-APP-001', n:'شهادة تسجيل المشروع في ريرا', t:'document', d:'الوثيقة الرسمية لتسجيل المشروع'},
    {c:'REQ-STG02-RERA-APP-002', n:'رقم تسجيل المشروع في ريرا', t:'data', d:'الرقم الرسمي للمشروع في نظام ريرا'},
  ]},
  { code:'SRV-STG02-BP-DOCS', name:'إعداد مستندات طلب رخصة البناء', desc:'تنسيق الحزمة الفنية مع متطلبات البلدية وتجهيز التقارير الإنشائية والميكانيكية والكهربائية.', days:21, reqs:[
    {c:'REQ-STG02-BP-001', n:'حزمة الرسومات التفصيلية للبلدية', t:'document', d:'الرسومات بالصيغة المطلوبة للبلدية'},
    {c:'REQ-STG02-BP-002', n:'التقرير الإنشائي', t:'document', d:'تقرير الاستشاري الإنشائي'},
    {c:'REQ-STG02-BP-003', n:'تقرير الأنظمة الميكانيكية والكهربائية (MEP)', t:'document', d:'تقرير MEP'},
    {c:'REQ-STG02-BP-004', n:'تقرير السلامة والحريق', t:'document', d:'تقرير متطلبات الدفاع المدني'},
  ]},
  { code:'SRV-STG02-BP-SUBMIT', name:'تقديم طلب رخصة البناء للبلدية', desc:'تقديم طلب رخصة البناء على نظام البلدية الإلكتروني ورفع الرسومات والمستندات.', days:7, reqs:[
    {c:'REQ-STG02-BPS-001', n:'رقم طلب رخصة البناء', t:'data', d:'الرقم المرجعي للطلب في نظام البلدية'},
    {c:'REQ-STG02-BPS-002', n:'إيصال تقديم الطلب', t:'document', d:'إيصال رسمي من النظام الإلكتروني'},
  ]},
  { code:'SRV-STG02-NOC', name:'متابعة ملاحظات الجهات والحصول على الـ NOCs', desc:'متابعة ملاحظات البلدية والجهات المختلفة واستكمال كافة الموافقات والـ NOCs.', days:60, reqs:[
    {c:'REQ-STG02-NOC-001', n:'NOC الكهرباء', t:'document', d:'عدم الممانعة من شركة الكهرباء'},
    {c:'REQ-STG02-NOC-002', n:'NOC المياه والصرف الصحي', t:'document', d:'عدم الممانعة من شركة المياه'},
    {c:'REQ-STG02-NOC-003', n:'NOC الدفاع المدني', t:'document', d:'عدم الممانعة من الدفاع المدني'},
    {c:'REQ-STG02-NOC-004', n:'NOCs الجهات الأخرى', t:'document', d:'موافقات الجهات الخدمية الأخرى'},
  ]},
  { code:'SRV-STG02-BP-FINAL', name:'استصدار رخصة البناء النهائية', desc:'استلام رخصة البناء النهائية من البلدية بعد استكمال كل المتطلبات.', days:7, reqs:[
    {c:'REQ-STG02-BP-FINAL-001', n:'رخصة البناء النهائية', t:'document', d:'الرخصة الرسمية من البلدية'},
    {c:'REQ-STG02-BP-FINAL-002', n:'رقم رخصة البناء', t:'data', d:'الرقم الرسمي للرخصة'},
    {c:'REQ-STG02-BP-FINAL-003', n:'تاريخ إصدار الرخصة', t:'data', d:'تاريخ الإصدار الرسمي'},
    {c:'REQ-STG02-BP-FINAL-004', n:'تاريخ انتهاء الرخصة', t:'data', d:'تاريخ انتهاء صلاحية الرخصة'},
  ]},
];

console.log('\n═══ STG-02 ═══');
for (const s of stg02) {
  await insertService('STG-02', s.code, s.name, s.desc, s.days);
  for (const r of s.reqs) await insertReq(s.code, r.c, r.n, r.t, r.d);
}

// ═══ STG-EXEC ═══
await insertStageIfNotExists('STG-EXEC', 'مرحلة التنفيذ والبناء', 30);
await insertService('STG-EXEC', 'SRV-EXEC-MAIN', 'تنفيذ أعمال المشروع في الموقع', 'تنفيذ أعمال المشروع في الموقع وفق المخططات المعتمدة وعقد المقاول.', 365);
for (const r of [
  {c:'REQ-EXEC-001', n:'تقارير التقدم الشهرية', t:'document', d:'تقارير متابعة التنفيذ الشهرية'},
  {c:'REQ-EXEC-002', n:'نسبة الإنجاز الإجمالية', t:'data', d:'نسبة الإنجاز الفعلية للمشروع'},
  {c:'REQ-EXEC-003', n:'تاريخ بدء التنفيذ الفعلي', t:'data', d:'تاريخ بدء أعمال الموقع'},
  {c:'REQ-EXEC-004', n:'التاريخ المتوقع للاكتمال', t:'data', d:'التاريخ المتوقع لإنهاء الأعمال'},
]) await insertReq('SRV-EXEC-MAIN', r.c, r.n, r.t, r.d);

// ═══ STG-CLOSE ═══
await insertStageIfNotExists('STG-CLOSE', 'مرحلة الإقفال والتسليم والصيانة', 40);
await insertService('STG-CLOSE', 'SRV-CLOSE-MAIN', 'الإقفال والتسليم وإدارة الصيانة', 'استكمال الأعمال النهائية وفحص واستلام الأعمال من المقاول وتسليم المشروع للمالك.', 90);
for (const r of [
  {c:'REQ-CLOSE-001', n:'محضر الاستلام الابتدائي', t:'document', d:'محضر استلام الأعمال من المقاول'},
  {c:'REQ-CLOSE-002', n:'قائمة ملاحظات السناغ', t:'document', d:'قائمة الأعمال الناقصة والملاحظات'},
  {c:'REQ-CLOSE-003', n:'محضر التسليم النهائي للمالك', t:'document', d:'محضر رسمي بتسليم المشروع'},
  {c:'REQ-CLOSE-004', n:'تاريخ بدء فترة الضمان', t:'data', d:'تاريخ بدء فترة الصيانة والضمان'},
  {c:'REQ-CLOSE-005', n:'تاريخ انتهاء فترة الضمان', t:'data', d:'تاريخ انتهاء فترة الصيانة والضمان'},
]) await insertReq('SRV-CLOSE-MAIN', r.c, r.n, r.t, r.d);

await conn.end();
console.log('\n✅ اكتمل السكريبت! لم يُحذف أي بيانات قديمة.');
