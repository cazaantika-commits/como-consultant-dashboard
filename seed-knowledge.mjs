import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const conn = await mysql.createConnection(DATABASE_URL);

// Get the owner user ID
const [users] = await conn.execute("SELECT id FROM users WHERE role='admin' LIMIT 1");
let userId = 1;
if (users.length > 0) userId = users[0].id;
else {
  const [allUsers] = await conn.execute("SELECT id FROM users LIMIT 1");
  if (allUsers.length > 0) userId = allUsers[0].id;
}

console.log(`Using userId: ${userId}`);

// Clear existing knowledge base
await conn.execute("DELETE FROM knowledgeBase");
console.log("Cleared existing knowledge base entries");

const entries = [
  {
    type: 'pattern',
    title: 'دستور الأرشفة - نمط تسمية الملفات الرسمي',
    content: `نمط التسمية الرسمي لجميع ملفات COMO Projects:

{اختصار-المنطقة}_{رقم-القطعة}_{نوع-المستند}_{التاريخ-YYMMDD}_{اسم-الاستشاري}_{النسخة}.pdf

القواعد:
• جميع الحروف كبيرة (UPPERCASE)
• الفاصل بين الأجزاء: _ (underscore)
• الفاصل داخل الجزء: - (hyphen)
• التاريخ بصيغة YYMMDD (6 أرقام) مثل: 260209 = 9 فبراير 2026
• النسخة: V00, V01, V02...
• وثائق الأرض بدون تاريخ أو استشاري: NAD_6185392_TD_V01.pdf

أمثلة فعلية:
NAD_6185392_PRO-ENG_260209_REALISTIC_V00.pdf
JAD_3260885_PRO-ENG_260213_ARTEC_V00.pdf
MAJ_6457956_PRO-FEAS_260120_COLLIERS_V00.pdf
NAD_6185392_PRO-SOIL_260209_TARMAC_V00.pdf
NAD_6185392_TD_V01.pdf
NAD_6185392_SPA_V00.pdf
JAD_3260885_DWG-CONCEPT_260115_ALSARH_V00.pdf`,
    summary: 'نمط التسمية: AREA_PLOT_DOCTYPE_YYMMDD_CONSULTANT_VERSION.pdf - كل الحروف كبيرة',
    tags: JSON.stringify(['تسمية', 'أرشفة', 'ملفات', 'naming', 'convention', 'خازن']),
    sourceAgent: 'khazen',
    importance: 'critical'
  },
  {
    type: 'pattern',
    title: 'اختصارات المشاريع المعتمدة',
    content: `اختصارات المناطق المعتمدة للمشاريع:

| الاختصار | المنطقة | أرقام القطع |
|----------|---------|-------------|
| JAD | الجداف (Al Jadaf) | 3260885 |
| NAD | ند الشبا (Nad Al Sheba) | 6185392, 6182776, 6180578 |
| MAJ | المجان (Al Majan) | 6457956, 6457879 |

⚠️ تحذير مهم: الاختصار القديم NAS تم تغييره نهائياً إلى NAD. لا تستخدم NAS أبداً.

المشاريع الحالية (6 مشاريع):
1. JAD_3260885 - الجداف
2. NAD_6185392 - ند الشبا (قطعة 1)
3. NAD_6182776 - ند الشبا (قطعة 2)
4. NAD_6180578 - ند الشبا (قطعة 3)
5. MAJ_6457956 - المجان (قطعة 1)
6. MAJ_6457879 - المجان (قطعة 2)`,
    summary: 'JAD=الجداف, NAD=ند الشبا (وليس NAS), MAJ=المجان - 6 مشاريع',
    tags: JSON.stringify(['مشاريع', 'اختصارات', 'JAD', 'NAD', 'MAJ', 'NAS']),
    sourceAgent: 'khazen',
    importance: 'critical'
  },
  {
    type: 'pattern',
    title: 'سجل الاستشاريين المعتمد - الأكواد والتخصصات',
    content: `سجل الاستشاريين الكامل المعتمد في COMO Projects:

استشارات هندسية (PRO-ENG):
| الكود | الاسم الكامل |
|-------|-------------|
| LACASA | La Casa Engineering Consultants |
| ARTOAK | Arif & Bintoak |
| OSUS | OSUS International Engineering |
| REALISTIC | Realistic Engineering Consultants |
| DATUM | Datum Engineering Consultants |
| SAFEER | Safeer Engineering Consultants |
| ARTEC | ARTEC Engineering Consultants |
| XYZ | XYZ Engineering Consultants |
| CV-INVEST | CV Investment |

دراسة جدوى (PRO-FEAS):
| COLLIERS | Colliers International |

فحص تربة (PRO-SOIL / QTN-SOIL):
| TARMAC | Tarmac Geotechnical |
| TRANS-SOIL | Trans Soil Investigation |
| SED | SED Geotechnical |

تصميم معماري (DWG-ARCH / DWG-CONCEPT):
| ALSARH | Al Sarh Engineering |
| ALAALAMIA | Al Aalamia Engineering |

ملاحظة: COLLIERS ليست استشارات هندسية - هي استشارات دراسة جدوى (PRO-FEAS).
TARMAC و TRANS-SOIL و SED هي شركات فحص تربة وليست استشارات هندسية.`,
    summary: '15 استشاري معتمد: 9 هندسي + 1 جدوى + 3 تربة + 2 تصميم',
    tags: JSON.stringify(['استشاريين', 'أكواد', 'consultants', 'LACASA', 'ARTOAK', 'OSUS', 'REALISTIC', 'DATUM', 'SAFEER', 'ARTEC', 'XYZ', 'CV-INVEST', 'COLLIERS', 'TARMAC', 'TRANS-SOIL', 'SED', 'ALSARH', 'ALAALAMIA']),
    sourceAgent: 'khazen',
    importance: 'critical'
  },
  {
    type: 'pattern',
    title: 'أكواد أنواع المستندات الكاملة',
    content: `أكواد أنواع المستندات المعتمدة في نظام الأرشفة:

العروض:
  PRO-ENG = عرض استشارات هندسية (تصميم + إشراف)
  PRO-FEAS = عرض دراسة جدوى
  PRO-SOIL = عرض فحص تربة
  QTN-SOIL = عرض سعر فحص تربة (quotation)

معلومات الأرض:
  TD = سند ملكية (Title Deed)
  AP = مخطط تأثير (Affection Plan)
  PDG = إرشادات تطوير القطعة (Plot Development Guidelines)
  STP = مخطط الموقع (Site Plan)
  FACT-SHEET = ملخص بيانات القطعة

العقود:
  SPA = عقد بيع وشراء (Sale & Purchase Agreement)
  SPA-EXECUTED = عقد موقّع
  NOV = تنازل/نوفيشن (Novation)
  NOV-RESALE = تنازل إعادة بيع

التصميم:
  DWG-CONCEPT = رسم مفهومي (Concept Design)
  DWG-ARCH = رسم معماري (Architectural Drawing)

التقارير:
  RPT-EVAL = تقرير تقييم
  SPA-REV = تحليل/مراجعة عقد
  FIN-ANALYSIS = تحليل مالي
  FEASIBILITY = دراسة جدوى

أخرى:
  RISK-MGMT = إدارة المخاطر
  QHSE = الجودة والصحة والسلامة والبيئة
  PROC-MGMT = إدارة المشتريات
  PROFILE = ملف تعريفي للشركة
  NUMBERS = جدول بيانات`,
    summary: 'أكواد المستندات: PRO-ENG, PRO-FEAS, PRO-SOIL, QTN-SOIL, TD, AP, PDG, STP, FACT-SHEET, SPA, NOV, DWG-CONCEPT, DWG-ARCH, RPT-EVAL...',
    tags: JSON.stringify(['أكواد', 'مستندات', 'أنواع', 'document types', 'PRO-ENG', 'PRO-FEAS', 'PRO-SOIL', 'TD', 'AP', 'SPA', 'NOV', 'DWG']),
    sourceAgent: 'khazen',
    importance: 'critical'
  },
  {
    type: 'pattern',
    title: 'هيكل مجلدات Google Drive',
    content: `هيكل المجلدات في Google Drive لمشاريع COMO:

المستوى الأعلى (00- All Projects):
├── 00_Land Ownership & Plot Info/    ← وثائق الأرض لكل مشروع
│   ├── JAD_3260885_LPI/
│   ├── NAD_6185392_LPI/
│   ├── NAD_6182776_LPI/
│   ├── NAD_6180578_LPI/
│   ├── MAJ_6457956_LPI/
│   └── MAJ_6457879_LPI/
├── 01_Studies & Feasibility/         ← دراسات الجدوى (تحت إشراف جويل)
├── 02_Proposals Contracts & Agreements/ ← العروض والعقود
│   ├── JAD_3260885_PCA/
│   │   ├── Proposals/
│   │   └── Contracts/
│   ├── NAD_6185392_PCA/
│   ├── NAD_6182776_PCA/
│   ├── NAD_6180578_PCA/
│   ├── MAJ_6457956_PCA/
│   └── MAJ_6457879_PCA/
├── 04_Design & Drawings/             ← التصميم والرسومات
│   ├── JAD_3260885_DD/
│   ├── NAD_6185392_DD/
│   └── NAD_6180578_DD/
├── 04_Service Providers -Profiles/   ← بروفايلات الاستشاريين
│   ├── ARTEC/
│   ├── COLLIERS/
│   ├── DATUM/
│   ├── LACASA/
│   ├── OSUS/
│   ├── REALISTIC/
│   ├── SAFEER/
│   ├── TARMAC/
│   └── TRANS-SOIL/
└── 00_Inbox/                         ← المحطة المؤقتة
    ├── Emails/                       ← مرفقات الإيميلات
    ├── Agents/                       ← مخرجات الوكلاء
    └── Ready/                        ← جاهز للأرشفة

قواعد توجيه الملفات:
- PRO-ENG, PRO-FEAS, PRO-SOIL, QTN-SOIL → 02_Proposals.../[PROJECT]_PCA/Proposals/
- SPA, NOV, SPA-EXECUTED, NOV-RESALE → 02_Proposals.../[PROJECT]_PCA/Contracts/
- TD, AP, PDG, STP, FACT-SHEET → 00_Land Ownership.../[PROJECT]_LPI/
- DWG-CONCEPT, DWG-ARCH → 04_Design & Drawings/[PROJECT]_DD/
- PROFILE → 04_Service Providers -Profiles/[CONSULTANT]/`,
    summary: 'هيكل Drive: 00_Land, 01_Studies, 02_PCA, 04_DD, 04_Profiles, 00_Inbox',
    tags: JSON.stringify(['مجلدات', 'Google Drive', 'هيكل', 'folders', 'structure']),
    sourceAgent: 'khazen',
    importance: 'critical'
  },
  {
    type: 'lesson',
    title: 'تغيير اختصار NAS إلى NAD - درس مستفاد',
    content: `في فبراير 2026، تم اكتشاف أن الاختصار NAS (المستخدم سابقاً لند الشبا) غير صحيح.
الاختصار الصحيح هو NAD (Nad Al Sheba).

تم تغيير جميع الملفات الموجودة من NAS إلى NAD:
- أكثر من 100 ملف ومجلد تم تحديثهم
- جميع prompts الوكلاء تم تحديثها
- قاعدة البيانات تم تحديثها

الدرس: يجب دائماً التحقق من الاختصارات مع المالك قبل اعتمادها. لا تستخدم NAS أبداً.`,
    summary: 'NAS خطأ → NAD صحيح. تم تغيير 100+ ملف ومجلد.',
    tags: JSON.stringify(['NAS', 'NAD', 'تصحيح', 'درس']),
    sourceAgent: 'khazen',
    importance: 'high'
  },
  {
    type: 'insight',
    title: 'تصنيف الاستشاريين حسب نوع الخدمة',
    content: `ليس كل الاستشاريين يقدمون نفس الخدمة. التصنيف الصحيح:

استشارات هندسية (تصميم + إشراف): LACASA, ARTOAK, OSUS, REALISTIC, DATUM, SAFEER, ARTEC, XYZ, CV-INVEST
→ نوع العرض: PRO-ENG

دراسة جدوى: COLLIERS
→ نوع العرض: PRO-FEAS (وليس PRO-ENG!)

فحص تربة: TARMAC, TRANS-SOIL
→ نوع العرض: PRO-SOIL

عرض سعر فحص تربة: SED
→ نوع العرض: QTN-SOIL

تصميم معماري/مفهومي: ALSARH, ALAALAMIA
→ نوع الملف: DWG-ARCH أو DWG-CONCEPT

مهم: COLLIERS ليست استشارات هندسية! هي متخصصة في دراسات الجدوى والتقييم العقاري.`,
    summary: 'COLLIERS = دراسة جدوى (PRO-FEAS) وليس هندسي. TARMAC/SED = تربة.',
    tags: JSON.stringify(['تصنيف', 'استشاريين', 'COLLIERS', 'TARMAC', 'SED', 'PRO-FEAS', 'PRO-SOIL']),
    sourceAgent: 'khazen',
    importance: 'high'
  },
  {
    type: 'pattern',
    title: 'سير عمل خازن اليومي - أرشفة الملفات',
    content: `سير العمل اليومي لخازن (مدير الأرشفة):

1. فحص مجلد 00_Inbox/Ready/ يومياً
2. لكل ملف جديد في Ready:
   أ. اقرأ محتوى الملف باستخدام read_drive_file_content
   ب. حدد: نوع المستند، الاستشاري، المشروع (رقم القطعة)، التاريخ
   ج. سمّ الملف حسب الدستور: AREA_PLOT_DOCTYPE_YYMMDD_CONSULTANT_V00.pdf
   د. ابحث عن المجلد الصحيح باستخدام search_drive_files أو list_drive_folders
   هـ. انقل الملف (move - ليس copy) للمجلد الصحيح
   و. تأكد من نجاح النقل
3. أبلغ المالك عبر تيليجرام بملخص العمليات

قواعد ذهبية:
- لا تطلب من المالك معرفات المجلدات - ابحث بنفسك!
- لا تحذف أي ملف بدون موافقة المالك
- لا تنشئ أكواد جديدة بدون موافقة
- إذا واجهت مشكلة، أبلغ سلوى عبر ask_another_agent`,
    summary: 'فحص Inbox/Ready → قراءة → تسمية → نقل → إبلاغ',
    tags: JSON.stringify(['سير عمل', 'خازن', 'أرشفة', 'workflow', 'daily']),
    sourceAgent: 'khazen',
    importance: 'high'
  }
];

for (const entry of entries) {
  await conn.execute(
    `INSERT INTO knowledgeBase (userId, type, title, content, summary, tags, sourceAgent, importance) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, entry.type, entry.title, entry.content, entry.summary, entry.tags, entry.sourceAgent, entry.importance]
  );
  console.log(`✅ Added: ${entry.title}`);
}

console.log(`\n✅ Total: ${entries.length} knowledge base entries added successfully`);

// Verify
const [count] = await conn.execute("SELECT COUNT(*) as cnt FROM knowledgeBase");
console.log(`📊 Knowledge base now has ${count[0].cnt} entries`);

await conn.end();
