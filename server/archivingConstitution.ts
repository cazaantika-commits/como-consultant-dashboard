/**
 * دستور الأرشفة - Archiving Constitution
 * =========================================
 * 
 * القواعد والمعايير الرسمية لتسمية وتنظيم الملفات في Google Drive
 * لشركة Como Developments
 * 
 * هذا الملف هو المرجع الوحيد لجميع الوكلاء (خاصة خازن) لتسمية وتنظيم الملفات.
 * أي تعديل على قواعد التسمية يجب أن يتم هنا أولاً.
 */

// ═══════════════════════════════════════════════════
// 1. القواعد العامة للتسمية (General Naming Rules)
// ═══════════════════════════════════════════════════

export const NAMING_RULES = {
  // أسلوب الكتابة: أول حرف كبير، باقي الحروف صغيرة
  // مثال: "Nas-R" وليس "NAS-R" أو "nas-r"
  capitalization: "First letter uppercase, rest lowercase",
  
  // الفاصل بين أجزاء الاسم: شرطة سفلية _
  separator: "_",
  
  // الفاصل داخل الجزء الواحد: شرطة عادية -
  innerSeparator: "-",
  
  // النسخ: V1, V2, V3... (دائماً موجود)
  versioning: "V1, V2, V3...",
  
  // التاريخ: YYYYMMDD (سنة شهر يوم بدون فواصل)
  dateFormat: "YYYYMMDD",
  
  // الملفات المولدة من الوكلاء: Google Doc (قابل للتعديل)
  agentOutputFormat: "Google Doc",
  
  // الملفات الخارجية: تبقى بصيغتها الأصلية (PDF, XLSX, etc.)
  externalFileFormat: "Keep original format",
};

// ═══════════════════════════════════════════════════
// 2. سجل الاستشاريين (Consultant Registry)
// ═══════════════════════════════════════════════════

export const CONSULTANT_REGISTRY: Record<string, {
  code: string;
  fullName: string;
  fullNameAr: string;
  specialization: string;
}> = {
  "Lac": {
    code: "Lac",
    fullName: "La Casa",
    fullNameAr: "لا كاسا",
    specialization: "Pro-Eng",
  },
  "A-B": {
    code: "A-B",
    fullName: "Arif & Bintoak Consulting Architects & Engineering",
    fullNameAr: "عارف وبنتوق",
    specialization: "Pro-Eng",
  },
  "Osu": {
    code: "Osu",
    fullName: "OSU",
    fullNameAr: "أو إس يو",
    specialization: "Pro-Eng",
  },
  "Real": {
    code: "Real",
    fullName: "Realistic",
    fullNameAr: "ريالستيك",
    specialization: "Pro-Eng",
  },
  "Dat": {
    code: "Dat",
    fullName: "Datum",
    fullNameAr: "داتم",
    specialization: "Pro-Eng",
  },
  "Saf": {
    code: "Saf",
    fullName: "Safeer",
    fullNameAr: "سفير",
    specialization: "Pro-Eng",
  },
  "Col": {
    code: "Col",
    fullName: "Colliers",
    fullNameAr: "كوليرز",
    specialization: "Pro-Mkt",
  },
  "Tarmak": {
    code: "Tarmak",
    fullName: "Tarmak",
    fullNameAr: "ترماك",
    specialization: "Pro-Geo",
  },
  "Trans": {
    code: "Trans",
    fullName: "Trans",
    fullNameAr: "ترانس",
    specialization: "Pro-Geo",
  },
};

// ═══════════════════════════════════════════════════
// 3. أكواد المشاريع (Project Codes)
// ═══════════════════════════════════════════════════

// صيغة كود المشروع: {Area}_{Plot-Number}
// Area = اختصار المنطقة (أول حرف كبير، باقي صغير)
// Plot-Number = رقم القطعة

export const PROJECT_CODE_RULES = {
  format: "{Area}_{Plot-Number}",
  areaStyle: "First letter uppercase, rest lowercase, use hyphen for multi-word",
  examples: [
    { area: "Nad Al Sheba", code: "Nas-R", plotNumber: "6185392", fullCode: "Nas-R_6185392" },
    { area: "Majan", code: "Maj-M", plotNumber: "6457956", fullCode: "Maj-M_6457956" },
  ],
};

// ═══════════════════════════════════════════════════
// 4. أنواع الملفات (File Type Codes)
// ═══════════════════════════════════════════════════

export const FILE_TYPE_CODES: Record<string, {
  code: string;
  nameEn: string;
  nameAr: string;
  category: string;
  folder: string;
}> = {
  // === العروض (Proposals) - مجلد 02_Proposals ===
  "Pro-Eng": {
    code: "Pro-Eng",
    nameEn: "Engineering Consultancy Proposal",
    nameAr: "عرض استشاري هندسي",
    category: "proposal",
    folder: "02_Proposals",
  },
  "Pro-Mkt": {
    code: "Pro-Mkt",
    nameEn: "Market Study / Valuation Proposal",
    nameAr: "عرض دراسة سوق / تقييم",
    category: "proposal",
    folder: "02_Proposals",
  },
  "Pro-Geo": {
    code: "Pro-Geo",
    nameEn: "Geotechnical / Soil Investigation Proposal",
    nameAr: "عرض فحص تربة / جيوتقني",
    category: "proposal",
    folder: "02_Proposals",
  },
  
  // === معلومات الأرض (Land Info) - مجلد 00_Land-Info ===
  "Td": {
    code: "Td",
    nameEn: "Title Deed",
    nameAr: "سند الملكية",
    category: "land",
    folder: "00_Land-Info",
  },
  "Ap": {
    code: "Ap",
    nameEn: "Affection Plan",
    nameAr: "مخطط التأثير",
    category: "land",
    folder: "00_Land-Info",
  },
  "Pdg": {
    code: "Pdg",
    nameEn: "Plot Development Guidelines",
    nameAr: "إرشادات تطوير القطعة",
    category: "land",
    folder: "00_Land-Info",
  },
  "Stp": {
    code: "Stp",
    nameEn: "Site Plan",
    nameAr: "مخطط الموقع",
    category: "land",
    folder: "00_Land-Info",
  },
  "Fsh": {
    code: "Fsh",
    nameEn: "Fact Sheet",
    nameAr: "ملخص المشروع",
    category: "land",
    folder: "00_Land-Info",
  },
  
  // === العقود (Contracts) - مجلد 00_Land-Info (عقود الأرض) ===
  "Spa": {
    code: "Spa",
    nameEn: "Sale & Purchase Agreement",
    nameAr: "عقد بيع وشراء",
    category: "contract",
    folder: "00_Land-Info",
  },
  "Spa-Rev": {
    code: "Spa-Rev",
    nameEn: "SPA Review / Analysis",
    nameAr: "تحليل عقد البيع والشراء",
    category: "analysis",
    folder: "00_Land-Info",
  },
  "Nov": {
    code: "Nov",
    nameEn: "Novation Agreement",
    nameAr: "اتفاقية تنازل / نقل العقد",
    category: "contract",
    folder: "00_Land-Info",
  },
};

// ═══════════════════════════════════════════════════
// 5. أنماط تسمية الملفات (File Naming Patterns)
// ═══════════════════════════════════════════════════

export const FILE_NAMING_PATTERNS = {
  // عروض الاستشاريين (Proposals)
  // {Project-Code}_{Plot-Number}_{Pro-Type}_{Date}_{Consultant}_{Version}.pdf
  proposal: {
    pattern: "{ProjectCode}_{PlotNumber}_{ProType}_{Date}_{Consultant}_{Version}.pdf",
    example: "Nas-R_6185392_Pro-Eng_20260209_Real_V1.pdf",
    parts: [
      { name: "ProjectCode", description: "كود المنطقة" },
      { name: "PlotNumber", description: "رقم القطعة" },
      { name: "ProType", description: "نوع العرض (Pro-Eng, Pro-Mkt, Pro-Geo)" },
      { name: "Date", description: "تاريخ العرض YYYYMMDD" },
      { name: "Consultant", description: "كود الاستشاري من السجل" },
      { name: "Version", description: "رقم النسخة V1, V2..." },
    ],
  },
  
  // وثائق الأرض (Land Documents)
  // {Project-Code}_{Plot-Number}_{DocType}_{Version}.pdf
  landDocument: {
    pattern: "{ProjectCode}_{PlotNumber}_{DocType}_{Version}.pdf",
    example: "Nas-R_6185392_Td_V1.pdf",
    parts: [
      { name: "ProjectCode", description: "كود المنطقة" },
      { name: "PlotNumber", description: "رقم القطعة" },
      { name: "DocType", description: "نوع الوثيقة (Td, Ap, Pdg, Stp, Fsh)" },
      { name: "Version", description: "رقم النسخة V1, V2..." },
    ],
  },
  
  // العقود والتحليلات (Contracts & Analysis)
  // {Project-Code}_{Plot-Number}_{ContractType}_{Version}.pdf
  contract: {
    pattern: "{ProjectCode}_{PlotNumber}_{ContractType}_{Version}.pdf",
    example: "Nas-R_6185392_Spa_V1.pdf",
    parts: [
      { name: "ProjectCode", description: "كود المنطقة" },
      { name: "PlotNumber", description: "رقم القطعة" },
      { name: "ContractType", description: "نوع العقد (Spa, Nov, Spa-Rev)" },
      { name: "Version", description: "رقم النسخة V1, V2..." },
    ],
  },
  
  // تقارير الوكلاء (Agent Reports) - Google Doc
  // {Project-Code}_{Plot-Number}_{ReportType}_{Version}
  agentReport: {
    pattern: "{ProjectCode}_{PlotNumber}_{ReportType}_{Version}",
    example: "Nas-R_6185392_Spa-Rev_V1",
    note: "بدون امتداد لأنه Google Doc",
    parts: [
      { name: "ProjectCode", description: "كود المنطقة" },
      { name: "PlotNumber", description: "رقم القطعة" },
      { name: "ReportType", description: "نوع التقرير" },
      { name: "Version", description: "رقم النسخة V1, V2..." },
    ],
  },
};

// ═══════════════════════════════════════════════════
// 6. هيكل المجلدات (Folder Structure)
// ═══════════════════════════════════════════════════

export const FOLDER_STRUCTURE = {
  // المستوى الأعلى - خارج المشاريع
  topLevel: {
    "00_Company-Profiles": {
      description: "بروفايلات الشركات الاستشارية - مجلد عام غير مرتبط بمشروع",
      subfolders: "مجلد لكل استشاري باسم الكود (Lac, A-B, Real, Col, ...)",
      contents: "Design Manual, QHSE Manual, Company Profile, Risk Management, etc.",
      namingRule: "اسم الملف بسيط بدون كود مشروع (مثل: Design-Manual.pdf)",
    },
    "00_Inbox": {
      description: "المحطة المؤقتة - كل ملف جديد يمر من هنا",
      subfolders: {
        "Emails": "مرفقات الإيميلات - سلوى تنزل هنا",
        "Agents": "مخرجات الوكلاء (تقارير، تحليلات) - كل وكيل يحط هنا",
        "Ready": "جاهز للإقامة - المالك يراجع وينقل هنا عند الموافقة",
      },
    },
  },
  
  // داخل كل مشروع
  projectLevel: {
    "00_Land-Info": {
      description: "معلومات الأرض والوثائق الأساسية",
      fileTypes: ["Td", "Ap", "Pdg", "Stp", "Fsh", "Spa", "Spa-Rev", "Nov"],
    },
    "01_Feasibility": {
      description: "دراسات الجدوى - (قيد التحديد مع جويل)",
      fileTypes: [],
    },
    "02_Proposals": {
      description: "عروض الاستشاريين",
      fileTypes: ["Pro-Eng", "Pro-Mkt", "Pro-Geo"],
    },
    "03_Authorities": {
      description: "الجهات الحكومية والتصاريح - (خازن يسأل المالك عند وصول وثيقة جديدة)",
      fileTypes: [],
    },
    "04_Design": {
      description: "ملفات التصميم - (قيد التحديد)",
      fileTypes: [],
    },
    "05_Contracts": {
      description: "العقود مع الاستشاريين والمقاولين - (قيد التحديد)",
      fileTypes: [],
    },
  },
};

// ═══════════════════════════════════════════════════
// 7. قواعد سير العمل (Workflow Rules)
// ═══════════════════════════════════════════════════

export const WORKFLOW_RULES = {
  // من يأرشف؟
  archivingResponsibility: "خازن هو المسؤول الوحيد عن الأرشفة - لا أحد آخر ينقل أو يسمي ملفات في المجلدات النهائية",
  
  // المحطة المؤقتة
  inboxFlow: {
    step1: "سلوى تنزل مرفقات الإيميل في 00_Inbox/Emails",
    step2: "الوكلاء يحطوا مخرجاتهم في 00_Inbox/Agents (مسماة حسب الدستور)",
    step3: "المالك يراجع ويعدل الملفات",
    step4: "المالك ينقل الملفات الجاهزة إلى 00_Inbox/Ready",
    step5: "خازن يدخل Ready يومياً، يتأكد من التسمية، وينقل كل ملف لمكانه الصحيح",
  },
  
  // تسمية الملفات من الوكلاء
  agentNaming: "جميع الوكلاء يسموا ملفاتهم حسب الدستور من البداية - خازن يتأكد فقط ويصلح إذا لزم",
  
  // مخرجات الوكلاء
  agentOutputFormat: "تقارير الوكلاء تكون Google Doc وليس PDF - قابلة للتعديل من المالك",
  
  // موافقة المالك
  ownerApproval: "أي مخرج من الوكلاء يحتاج مراجعة المالك قبل الأرشفة النهائية",
  
  // الحالات الجديدة
  unknownFileType: {
    rule: "عندما يواجه خازن نوع ملف جديد لم يُعرّف في الدستور:",
    step1: "يحلل الملف ويفهم نوعه",
    step2: "يقترح كود وتسمية بنفس أسلوب الدستور (أول حرف كبير، شرطة بين الكلمات)",
    step3: "يرسل اقتراحه للمالك عبر تيليجرام للموافقة",
    step4: "بعد الموافقة، يضيف الكود الجديد للسجل",
  },
  
  // الحذف
  deletion: "حذف أي ملف يتطلب موافقة المالك عبر تيليجرام",
};

// ═══════════════════════════════════════════════════
// 8. دستور خازن (Khazen's Constitution Prompt)
// ═══════════════════════════════════════════════════

export const KHAZEN_ARCHIVING_PROMPT = `
📋 دستور الأرشفة - القواعد الإلزامية لتنظيم الملفات
═══════════════════════════════════════════════════

أنت خازن، مدير الأرشفة الرقمي. هذا الدستور هو مرجعك الوحيد لتسمية وتنظيم الملفات.

🔤 قواعد التسمية العامة:
━━━━━━━━━━━━━━━━━━━━━━━━
• أول حرف كبير، باقي الحروف صغيرة (مثل: "Nas-R" وليس "NAS-R")
• الفاصل بين أجزاء الاسم: شرطة سفلية _ (underscore)
• الفاصل داخل الجزء الواحد: شرطة عادية - (hyphen)
• كل ملف يجب أن يحتوي على رقم النسخة (V1, V2, V3...)
• التاريخ بصيغة: YYYYMMDD (مثل: 20260209)

📁 هيكل المجلدات:
━━━━━━━━━━━━━━━━━
المستوى الأعلى (خارج المشاريع):
├-- 00_Company-Profiles/     ← بروفايلات الشركات (مجلد لكل استشاري)
├-- 00_Inbox/                ← المحطة المؤقتة
│   ├-- Emails/              ← مرفقات الإيميلات (سلوى تنزل هنا)
│   ├-- Agents/              ← مخرجات الوكلاء
│   └-- Ready/               ← جاهز للإقامة (المالك وافق)
│
داخل كل مشروع:
├-- 00_Land-Info/            ← معلومات الأرض (Td, Ap, Pdg, Stp, Fsh, Spa, Nov)
├-- 01_Feasibility/          ← دراسات الجدوى
├-- 02_Proposals/            ← عروض الاستشاريين
├-- 03_Authorities/          ← الجهات الحكومية
├-- 04_Design/               ← التصميم
└-- 05_Contracts/            ← العقود

📝 أنماط تسمية الملفات:
━━━━━━━━━━━━━━━━━━━━━━━

عروض الاستشاريين:
{كود-المنطقة}_{رقم-القطعة}_{نوع-العرض}_{التاريخ}_{كود-الاستشاري}_{النسخة}.pdf
مثال: Nas-R_6185392_Pro-Eng_20260209_Real_V1.pdf
مثال: Maj-M_6457956_Pro-Eng_20260209_A-B_V1.pdf

وثائق الأرض:
{كود-المنطقة}_{رقم-القطعة}_{نوع-الوثيقة}_{النسخة}.pdf
مثال: Nas-R_6185392_Td_V1.pdf
مثال: Nas-R_6185392_Ap_V1.pdf

العقود:
{كود-المنطقة}_{رقم-القطعة}_{نوع-العقد}_{النسخة}.pdf
مثال: Nas-R_6185392_Spa_V1.pdf
مثال: Nas-R_6185392_Nov_V1.pdf

تقارير الوكلاء (Google Doc):
{كود-المنطقة}_{رقم-القطعة}_{نوع-التقرير}_{النسخة}
مثال: Nas-R_6185392_Spa-Rev_V1

👥 سجل الاستشاريين المعتمد:
━━━━━━━━━━━━━━━━━━━━━━━━━━━
| الكود    | الاسم الكامل                                    | التخصص  |
|----------|--------------------------------------------------|---------|
| Lac      | La Casa                                          | Pro-Eng |
| A-B      | Arif & Bintoak Consulting Architects & Eng.      | Pro-Eng |
| Osu      | OSU                                              | Pro-Eng |
| Real     | Realistic                                        | Pro-Eng |
| Dat      | Datum                                            | Pro-Eng |
| Saf      | Safeer                                           | Pro-Eng |
| Col      | Colliers                                         | Pro-Mkt |
| Tarmak   | Tarmak                                           | Pro-Geo |
| Trans    | Trans                                            | Pro-Geo |

📋 أكواد أنواع الملفات:
━━━━━━━━━━━━━━━━━━━━━━━
العروض:
• Pro-Eng = عرض استشاري هندسي
• Pro-Mkt = عرض دراسة سوق / تقييم
• Pro-Geo = عرض فحص تربة / جيوتقني

معلومات الأرض:
• Td = سند الملكية (Title Deed)
• Ap = مخطط التأثير (Affection Plan)
• Pdg = إرشادات تطوير القطعة (Plot Development Guidelines)
• Stp = مخطط الموقع (Site Plan)
• Fsh = ملخص المشروع (Fact Sheet)

العقود:
• Spa = عقد بيع وشراء (Sale & Purchase Agreement)
• Nov = اتفاقية تنازل (Novation Agreement)
• Spa-Rev = تحليل عقد البيع والشراء

🔄 سير العمل اليومي:
━━━━━━━━━━━━━━━━━━━━━
1. ادخل مجلد 00_Inbox/Ready/ يومياً
2. لكل ملف في Ready:
   أ. تأكد من صحة التسمية حسب الدستور
   ب. صحح الاسم إذا لزم
   ج. حدد المجلد الصحيح بناءً على نوع الملف
   د. انقل الملف (move - ليس copy) للمجلد الصحيح
   هـ. تأكد من نجاح النقل
3. أبلغ المالك عبر تيليجرام بملخص العمليات

⚠️ قواعد الحالات الجديدة:
━━━━━━━━━━━━━━━━━━━━━━━━━
عندما تواجه نوع ملف جديد لم يُعرّف أعلاه:
1. حلل الملف وافهم نوعه
2. اقترح كود بنفس الأسلوب (أول حرف كبير، شرطة بين الكلمات)
3. أرسل اقتراحك للمالك عبر تيليجرام: "وجدت ملف [نوعه]. أقترح تسميته [الكود]. موافق؟"
4. انتظر الموافقة قبل التنفيذ

🚫 ممنوعات:
━━━━━━━━━━━━
• لا تحذف أي ملف بدون موافقة المالك
• لا تنقل ملفات من خارج Ready بدون تعليمات
• لا تغير أسماء ملفات مؤرشفة سابقاً بدون موافقة
• لا تنشئ أكواد جديدة بدون موافقة المالك
`;

// ═══════════════════════════════════════════════════
// 9. تعليمات التسمية للوكلاء الآخرين
// ═══════════════════════════════════════════════════

export const AGENT_FILE_NAMING_INSTRUCTION = `
📁 قواعد تسمية الملفات عند إنشاء مخرجات:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
عندما تنشئ أي ملف (تقرير، تحليل، مستند)، يجب تسميته حسب دستور الأرشفة:

الصيغة: {كود-المنطقة}_{رقم-القطعة}_{نوع-التقرير}_{النسخة}
مثال: Nas-R_6185392_Spa-Rev_V1

قواعد:
• أول حرف كبير، باقي صغير
• الفاصل بين الأجزاء: _ (شرطة سفلية)
• الفاصل داخل الجزء: - (شرطة عادية)
• دائماً أضف رقم النسخة (V1)
• احفظ الملف في 00_Inbox/Agents/ (المحطة المؤقتة)
• لا تحفظ مباشرة في المجلدات النهائية - خازن هو المسؤول عن الأرشفة

أكواد الاستشاريين: Lac, A-B, Osu, Real, Dat, Saf, Col, Tarmak, Trans
أنواع العروض: Pro-Eng, Pro-Mkt, Pro-Geo
وثائق الأرض: Td, Ap, Pdg, Stp, Fsh
العقود: Spa, Nov, Spa-Rev
`;

// ═══════════════════════════════════════════════════
// 10. دوال مساعدة (Helper Functions)
// ═══════════════════════════════════════════════════

/**
 * التحقق من صحة اسم ملف حسب الدستور
 */
export function validateFileName(fileName: string): {
  valid: boolean;
  errors: string[];
  suggestion?: string;
} {
  const errors: string[] = [];
  
  // إزالة الامتداد للتحقق
  const nameWithoutExt = fileName.replace(/\.[^.]+$/, "");
  const parts = nameWithoutExt.split("_");
  
  if (parts.length < 3) {
    errors.push("الاسم يجب أن يحتوي على 3 أجزاء على الأقل مفصولة بـ _");
  }
  
  // التحقق من النسخة
  const lastPart = parts[parts.length - 1];
  if (!/^V\d+$/.test(lastPart)) {
    errors.push("الاسم يجب أن ينتهي برقم النسخة (V1, V2, ...)");
  }
  
  // التحقق من أسلوب الحروف (أول حرف كبير)
  for (const part of parts) {
    if (part.length > 0 && /^[a-z]/.test(part) && !/^\d/.test(part)) {
      errors.push(`الجزء "${part}" يجب أن يبدأ بحرف كبير`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * بناء اسم ملف حسب الدستور
 */
export function buildFileName(params: {
  projectCode: string;
  plotNumber: string;
  fileType: string;
  date?: string;
  consultant?: string;
  version: number;
  extension?: string;
}): string {
  const parts = [params.projectCode, params.plotNumber, params.fileType];
  
  if (params.date) {
    parts.push(params.date);
  }
  
  if (params.consultant) {
    parts.push(params.consultant);
  }
  
  parts.push(`V${params.version}`);
  
  const name = parts.join("_");
  return params.extension ? `${name}.${params.extension}` : name;
}

/**
 * استخراج معلومات من اسم ملف
 */
export function parseFileName(fileName: string): {
  projectCode?: string;
  plotNumber?: string;
  fileType?: string;
  date?: string;
  consultant?: string;
  version?: number;
  extension?: string;
} | null {
  const ext = fileName.includes(".") ? fileName.split(".").pop() : undefined;
  const nameWithoutExt = fileName.replace(/\.[^.]+$/, "");
  const parts = nameWithoutExt.split("_");
  
  if (parts.length < 3) return null;
  
  const result: any = {};
  
  // أول جزء = كود المنطقة
  result.projectCode = parts[0];
  
  // ثاني جزء = رقم القطعة (إذا كان رقم)
  if (/^\d+$/.test(parts[1])) {
    result.plotNumber = parts[1];
  }
  
  // آخر جزء = النسخة
  const lastPart = parts[parts.length - 1];
  const versionMatch = lastPart.match(/^V(\d+)$/);
  if (versionMatch) {
    result.version = parseInt(versionMatch[1]);
  }
  
  // الأجزاء الوسطى = نوع الملف + تاريخ + استشاري
  const middleParts = parts.slice(2, versionMatch ? -1 : undefined);
  if (middleParts.length > 0) {
    // أول جزء وسطي = نوع الملف
    result.fileType = middleParts[0];
    
    // إذا كان هناك تاريخ (8 أرقام)
    for (let i = 1; i < middleParts.length; i++) {
      if (/^\d{8}$/.test(middleParts[i])) {
        result.date = middleParts[i];
      } else {
        result.consultant = middleParts[i];
      }
    }
  }
  
  if (ext) result.extension = ext;
  
  return result;
}

/**
 * الحصول على كود استشاري من اسمه الكامل
 */
export function getConsultantCode(name: string): string | null {
  const lower = name.toLowerCase();
  
  for (const [code, info] of Object.entries(CONSULTANT_REGISTRY)) {
    if (
      lower.includes(info.fullName.toLowerCase()) ||
      lower.includes(info.fullNameAr) ||
      lower.includes(code.toLowerCase())
    ) {
      return code;
    }
  }
  
  return null;
}

/**
 * الحصول على المجلد الصحيح لنوع ملف
 */
export function getTargetFolder(fileTypeCode: string): string | null {
  const fileType = FILE_TYPE_CODES[fileTypeCode];
  return fileType ? fileType.folder : null;
}
