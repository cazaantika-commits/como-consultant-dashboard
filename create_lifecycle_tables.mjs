import mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

const tables = [
  `CREATE TABLE IF NOT EXISTS lifecycle_stages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    stageCode VARCHAR(30) NOT NULL UNIQUE,
    nameAr VARCHAR(200) NOT NULL,
    descriptionAr TEXT,
    defaultStatus ENUM('not_started','in_progress','completed','locked') DEFAULT 'not_started',
    sortOrder INT DEFAULT 0,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS lifecycle_services (
    id INT AUTO_INCREMENT PRIMARY KEY,
    serviceCode VARCHAR(50) NOT NULL UNIQUE,
    stageCode VARCHAR(30) NOT NULL,
    nameAr VARCHAR(200) NOT NULL,
    descriptionAr TEXT,
    externalParty VARCHAR(200),
    internalOwner VARCHAR(200),
    isMandatory TINYINT DEFAULT 1,
    expectedDurationDays INT DEFAULT 7,
    sortOrder INT DEFAULT 0,
    dependsOn TEXT,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_svc_stage (stageCode)
  )`,
  `CREATE TABLE IF NOT EXISTS lifecycle_requirements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    requirementCode VARCHAR(60) NOT NULL UNIQUE,
    serviceCode VARCHAR(50) NOT NULL,
    reqType ENUM('document','data','approval','action') DEFAULT 'document',
    nameAr VARCHAR(300) NOT NULL,
    descriptionAr TEXT,
    sourceNote VARCHAR(300),
    isMandatory TINYINT DEFAULT 1,
    timing VARCHAR(100) DEFAULT 'قبل التقديم',
    internalOwner VARCHAR(200),
    sortOrder INT DEFAULT 0,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_req_svc (serviceCode)
  )`,
  `CREATE TABLE IF NOT EXISTS project_service_instances (
    id INT AUTO_INCREMENT PRIMARY KEY,
    projectId INT NOT NULL,
    serviceCode VARCHAR(50) NOT NULL,
    stageCode VARCHAR(30) NOT NULL,
    operationalStatus ENUM('not_started','in_progress','completed','locked','submitted') DEFAULT 'not_started',
    plannedStartDate VARCHAR(20),
    plannedDueDate VARCHAR(20),
    actualStartDate VARCHAR(20),
    actualCloseDate VARCHAR(20),
    notes TEXT,
    submittedAt TIMESTAMP NULL,
    submittedByUserId INT,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_psi_project (projectId),
    INDEX idx_psi_service (serviceCode)
  )`,
  `CREATE TABLE IF NOT EXISTS project_requirement_status (
    id INT AUTO_INCREMENT PRIMARY KEY,
    projectId INT NOT NULL,
    serviceCode VARCHAR(50) NOT NULL,
    requirementCode VARCHAR(60) NOT NULL,
    status ENUM('pending','completed','not_applicable') DEFAULT 'pending',
    fileUrl TEXT,
    fileKey TEXT,
    notes TEXT,
    completedByUserId INT,
    completedAt TIMESTAMP NULL,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_prs_project (projectId),
    INDEX idx_prs_svc_req (serviceCode, requirementCode)
  )`,
  `CREATE TABLE IF NOT EXISTS project_stage_status (
    id INT AUTO_INCREMENT PRIMARY KEY,
    projectId INT NOT NULL,
    stageCode VARCHAR(30) NOT NULL,
    status ENUM('not_started','in_progress','completed','locked') DEFAULT 'not_started',
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_pss_project (projectId)
  )`,
];

for (const sql of tables) {
  const tableName = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/)[1];
  try {
    await conn.execute(sql);
    console.log(`✅ Created: ${tableName}`);
  } catch (e) {
    console.log(`⚠️  ${tableName}: ${e.message}`);
  }
}

// Seed STG-01 to STG-05 stages
const stages = [
  ['STG-01', 'تأسيس المطوّر وتسجيله', 'تسجيل الشركة كمطوّر معتمد لدى RERA قبل أي مشروع جديد', 'completed', 1],
  ['STG-02', 'تسجيل المشروع وفتح الضمان', 'تسجيل مشروع محدد لدى RERA وفتح حساب ضمان واعتماد خطة المشروع', 'in_progress', 2],
  ['STG-03', 'المبيعات على الخارطة وأوكود', 'تسجيل عقود البيع على الخارطة وإدارتها في نظام أوكود', 'not_started', 3],
  ['STG-04', 'الرقابة المالية والإنشائية', 'متابعة تقدم الأعمال وربطها بالسحوبات من حساب الضمان', 'not_started', 4],
  ['STG-05', 'إغلاق المشروع', 'تسوية حساب الضمان وإغلاق التزامات المشروع لدى RERA', 'not_started', 5],
];

for (const [code, name, desc, status, order] of stages) {
  await conn.execute(
    `INSERT INTO lifecycle_stages (stageCode, nameAr, descriptionAr, defaultStatus, sortOrder) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE nameAr=VALUES(nameAr)`,
    [code, name, desc, status, order]
  );
}
console.log('✅ Seeded 5 stages');

// Seed STG-02 services
const services = [
  ['SRV-RERA-PROJ-REG', 'STG-02', 'تسجيل مشروع جديد لدى RERA', 'تقديم طلب تسجيل مشروع جديد وربط الأرض بالمطوّر في نظام RERA/Oqood', 'دائرة الأراضي والأملاك / RERA', 'إدارة التطوير + الشؤون القانونية', 1, 7, '01-04-2026', '10-04-2026', null, 1],
  ['SRV-RERA-ESCROW-OPEN', 'STG-02', 'فتح حساب ضمان للمشروع', 'فتح حساب ضمان مستقل للمشروع في بنك معتمد وربطه برقم المشروع', 'بنك ضامن معتمد + RERA', 'الإدارة المالية + الإدارة العليا', 1, 5, '11-04-2026', '16-04-2026', 'SRV-RERA-PROJ-REG', 2],
  ['SRV-RERA-PROJ-PLAN', 'STG-02', 'اعتماد الخطة المالية والزمنية للمشروع', 'اعتماد البرنامج الزمني وتوزيع التكلفة وربط نسب السحب من الضمان بمراحل الإنجاز', 'RERA', 'الإدارة المالية + إدارة التطوير + الاستشاري', 1, 7, '17-04-2026', '24-04-2026', 'SRV-RERA-PROJ-REG,SRV-RERA-ESCROW-OPEN', 3],
  ['SRV-RERA-MKT-PERMIT', 'STG-02', 'تصريح التسويق والإعلان للمشروع', 'الحصول على تصريح إعلان/تسويق للمشروع قبل بدء الحملات والمبيعات', 'RERA / نظام تراخيص الإعلانات', 'إدارة التسويق + إدارة التطوير', 1, 3, '25-04-2026', '28-04-2026', 'SRV-RERA-PROJ-REG,SRV-RERA-ESCROW-OPEN,SRV-RERA-PROJ-PLAN', 4],
];

for (const [code, stage, name, desc, ext, intOwner, mandatory, duration, start, due, deps, order] of services) {
  await conn.execute(
    `INSERT INTO lifecycle_services (serviceCode, stageCode, nameAr, descriptionAr, externalParty, internalOwner, isMandatory, expectedDurationDays, sortOrder, dependsOn) VALUES (?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE nameAr=VALUES(nameAr)`,
    [code, stage, name, desc, ext, intOwner, mandatory, duration, order, deps]
  );
}
console.log('✅ Seeded 4 services for STG-02');

// Seed requirements for SRV-RERA-PROJ-REG
const projRegReqs = [
  ['REQ-PROJ-REG-DOC-01', 'SRV-RERA-PROJ-REG', 'document', 'سند ملكية الأرض / عقد شراء الأرض', 'إثبات ملكية أو حق تطوير الأرض المخصصة للمشروع', 'رفع ملف', 1, 'الشؤون القانونية / إدارة التطوير', 1],
  ['REQ-PROJ-REG-DOC-02', 'SRV-RERA-PROJ-REG', 'document', 'الرخصة التجارية للمطوّر', 'نسخة سارية من الرخصة تتضمن نشاط التطوير العقاري', 'من ملف الشركة', 1, 'الشؤون القانونية', 2],
  ['REQ-PROJ-REG-DOC-03', 'SRV-RERA-PROJ-REG', 'document', 'شهادة تسجيل المطوّر لدى RERA', 'شهادة تثبت أن الشركة مطوّر معتمد لدى RERA', 'من ملف الشركة / رفع ملف', 1, 'الشؤون القانونية', 3],
  ['REQ-PROJ-REG-DOC-04', 'SRV-RERA-PROJ-REG', 'document', 'مخطط موقعي ومخطط أولي للمشروع', 'رسومات توضح حدود الأرض والكونسبت العام للمشروع', 'رفع ملف (من الاستشاري)', 1, 'الاستشاري + إدارة التطوير', 4],
  ['REQ-PROJ-REG-DOC-05', 'SRV-RERA-PROJ-REG', 'document', 'تقرير تكلفة المشروع المبدئية', 'تقرير تقدير تكلفة الإنشاء والتكاليف المرتبطة بالمشروع', 'من خدمة أخرى داخل المنصّة أو رفع ملف', 1, 'الإدارة المالية + الاستشاري', 5],
  ['REQ-PROJ-REG-DATA-01', 'SRV-RERA-PROJ-REG', 'data', 'اسم المشروع', 'اسم المشروع كما سيظهر في جميع المستندات والإعلانات', 'من ملف المشروع', 1, 'إدارة التطوير', 6],
  ['REQ-PROJ-REG-DATA-02', 'SRV-RERA-PROJ-REG', 'data', 'رقم قطعة الأرض والمنطقة', 'رقم القطعة ورقم المخطط واسم المجتمع/المشروع الرئيسي', 'من ملف الأرض', 1, 'إدارة التطوير / الشؤون القانونية', 7],
  ['REQ-PROJ-REG-DATA-03', 'SRV-RERA-PROJ-REG', 'data', 'نوع المشروع واستخداماته', 'سكني / تجاري / مختلط مع وصف الاستخدامات الرئيسية', 'من ملف المشروع', 1, 'إدارة التطوير', 8],
  ['REQ-PROJ-REG-DATA-04', 'SRV-RERA-PROJ-REG', 'data', 'المساحة البنائية وعدد الوحدات', 'إجمالي المساحة البنائية وعدد الوحدات حسب التصميم المبدئي', 'من الاستشاري / ملف المشروع', 1, 'الاستشاري + إدارة التطوير', 9],
  ['REQ-PROJ-REG-DATA-05', 'SRV-RERA-PROJ-REG', 'data', 'تقدير تكلفة الإنشاء', 'الرقم الإجمالي لتكلفة الإنشاء مطابق للتقرير المرفق', 'من الإدارة المالية', 1, 'الإدارة المالية', 10],
];

// Seed requirements for SRV-RERA-ESCROW-OPEN
const escrowReqs = [
  ['REQ-ESCROW-DOC-01', 'SRV-RERA-ESCROW-OPEN', 'document', 'شهادة تسجيل المشروع ورقم RERA', 'خطاب أو شهادة من RERA تحتوي رقم المشروع المعتمد', 'من مخرجات خدمة تسجيل المشروع', 1, 'الشؤون القانونية / إدارة التطوير', 1],
  ['REQ-ESCROW-DOC-02', 'SRV-RERA-ESCROW-OPEN', 'document', 'سند ملكية الأرض', 'سند ملكية الأرض باسم المطوّر أو اتفاقية تطوير مع المالك', 'من ملف الأرض', 1, 'الشؤون القانونية', 2],
  ['REQ-ESCROW-DOC-03', 'SRV-RERA-ESCROW-OPEN', 'document', 'الرخصة التجارية للمطوّر', 'رخصة الشركة سارية مع نشاط التطوير العقاري', 'من ملف الشركة', 1, 'الشؤون القانونية', 3],
  ['REQ-ESCROW-DOC-04', 'SRV-RERA-ESCROW-OPEN', 'document', 'عقد التأسيس / النظام الأساسي', 'عقد التأسيس يوضح الشركاء وصلاحيات الإدارة', 'من ملف الشركة', 1, 'الشؤون القانونية', 4],
  ['REQ-ESCROW-DOC-05', 'SRV-RERA-ESCROW-OPEN', 'document', 'نماذج توقيع وتفويض للمخولين بالتوقيع', 'جوازات وإقامات وتوقيعات المخولين على الحساب', 'رفع ملف', 1, 'الإدارة العليا / الشؤون القانونية', 5],
  ['REQ-ESCROW-DOC-06', 'SRV-RERA-ESCROW-OPEN', 'document', 'تقرير تكلفة المشروع المحدث', 'تقرير تكلفة المشروع المعتمد أو نسخة محدثة إذا طلب البنك', 'من خدمة إعداد تكلفة المشروع', 1, 'الإدارة المالية', 6],
  ['REQ-ESCROW-DOC-07', 'SRV-RERA-ESCROW-OPEN', 'document', 'نموذج طلب فتح حساب ضمان من البنك', 'النموذج الرسمي للبنك مملوء وموقع', 'رفع ملف', 1, 'الإدارة المالية', 7],
  ['REQ-ESCROW-DATA-01', 'SRV-RERA-ESCROW-OPEN', 'data', 'اسم المشروع ورقم المشروع', 'الاسم الرسمي للمشروع ورقم RERA', 'من خدمة تسجيل المشروع', 1, 'إدارة التطوير', 8],
  ['REQ-ESCROW-DATA-02', 'SRV-RERA-ESCROW-OPEN', 'data', 'بيانات الشركة المطوّرة', 'الاسم القانوني ورقم الرخصة والعنوان ووسائل الاتصال', 'من ملف الشركة', 1, 'الشؤون القانونية', 9],
  ['REQ-ESCROW-DATA-03', 'SRV-RERA-ESCROW-OPEN', 'data', 'بيانات المخولين بالتوقيع', 'الأسماء والمناصب وأرقام الهوية/الإقامة ووسائل الاتصال', 'من ملف الشركة', 1, 'الشؤون القانونية / الإدارة العليا', 10],
  ['REQ-ESCROW-DATA-04', 'SRV-RERA-ESCROW-OPEN', 'data', 'قيمة تكلفة الإنشاء المتوقعة', 'إجمالي تكلفة الإنشاء كما هو معتمد لدى RERA والبنك', 'من الإدارة المالية', 1, 'الإدارة المالية', 11],
  ['REQ-ESCROW-DATA-05', 'SRV-RERA-ESCROW-OPEN', 'data', 'مصادر تمويل المشروع', 'نسبة التمويل الذاتي والتمويل البنكي ومبيعات الخارطة (تقديري)', 'من الإدارة المالية', 0, 'الإدارة المالية', 12],
  ['REQ-ESCROW-DATA-06', 'SRV-RERA-ESCROW-OPEN', 'data', 'البنك المختار ونوع الحساب', 'اسم البنك المختار من قائمة البنوك المعتمدة ونوع حساب الضمان', 'إدخال في النظام', 1, 'الإدارة المالية / الإدارة العليا', 13],
];

const allReqs = [...projRegReqs, ...escrowReqs];
for (const [code, svc, type, name, desc, src, mandatory, owner, order] of allReqs) {
  await conn.execute(
    `INSERT INTO lifecycle_requirements (requirementCode, serviceCode, reqType, nameAr, descriptionAr, sourceNote, isMandatory, internalOwner, sortOrder) VALUES (?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE nameAr=VALUES(nameAr)`,
    [code, svc, type, name, desc, src, mandatory, owner, order]
  );
}
console.log(`✅ Seeded ${allReqs.length} requirements`);

await conn.end();
console.log('\n🎉 All lifecycle tables created and seeded successfully!');
