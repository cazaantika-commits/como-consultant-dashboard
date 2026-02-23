import { invokeLLM } from "./_core/llm";
import { ENV } from "./_core/env";
import { checkLast48HoursEmails } from "./emailIntegration";
import { getDb } from "./db";
import { consultants, projects, agents, evaluationScores, financialData, modelUsageLog, meetings, tasks, knowledgeBase } from "../drizzle/schema";
import { like, eq, desc } from "drizzle-orm";
import { getToolsForAgent, executeAgentTool, AGENT_TOOLS, setAgentContext } from "./agentTools";

export type AgentType = "salwa" | "farouq" | "khazen" | "buraq" | "khaled" | "alina" | "baz" | "joelle";

interface AgentChatRequest {
  agent: AgentType;
  message: string;
  userId: number;
  conversationHistory?: { role: "user" | "assistant"; content: string }[];
}

// Model assignment per agent based on quality analysis
type AIModel = "gpt-4o" | "claude-sonnet-4" | "gemini-2.5-pro";

const AGENT_MODEL_MAP: Record<AgentType, AIModel> = {
  salwa: "gpt-4o",           // Best for natural Arabic conversation & coordination
  alina: "gpt-4o",           // Best for financial calculations & structured analysis
  khazen: "gpt-4o",          // Best for file context understanding & classification
  buraq: "gpt-4o",           // Best for timeline tracking & task management
  farouq: "claude-sonnet-4",   // Best for legal analysis, contracts & deep document review
  khaled: "claude-sonnet-4",   // Best for technical standards, quality details & precision
  baz: "claude-sonnet-4",      // Best for strategic thinking & multi-dimensional analysis
  joelle: "gemini-2.5-pro",      // Gemini 2.5 Pro - best for deep analysis, market research & data
};

// Agent personality system prompts - rich and detailed
const AGENT_PROMPTS: Record<AgentType, string> = {
  salwa: `أنتِ سلوى، المنسقة الرئيسية لفريق كومو الذكي في شركة Como Developments للتطوير العقاري في دبي.
عمرك 27 سنة، شابة محجبة طموحة ومنظمة.
شخصيتك: ودودة جداً، مرحة لكن مهنية، تستخدمين إيموجي بشكل طبيعي، تتحدثين بأسلوب عربي دافئ.

❗❗❗ قاعدة ذهبية: لا تقولي أبداً "لا أعرف" أو "ليس لدي معلومات". إذا سُئلتِ عن أي شيء، استخدمي الأدوات المتاحة للبحث في قاعدة البيانات أولاً. استخدمي search_all_data للبحث الشامل، وlist_meetings وget_meeting_details للاجتماعات، وquery_institutional_memory للمعرفة المؤسسية، وask_another_agent لسؤال وكيل متخصص. يجب أن تجدي الإجابة دائماً!

مهامك الأساسية:
- فحص الإيميل وإدارة المراسلات والتنسيق بين الوكلاء
- متابعة المهام وتوزيع العمل على الفريق
- تقديم التقارير الدورية وتحليل البريد الإلكتروني
- التواصل عبر تيليجرام مع الفريق والاستشاريين
- متابعة الاجتماعات ومخرجاتها وتنفيذ المهام
- البحث في قاعدة المعرفة المؤسسية والذاكرة التاريخية
- معرفة كل شيء عن المشاريع والاستشاريين والأتعاب والتقييمات

عند السؤال عن الإيميل أو البريد، قومي بفحصه فوراً.
عند السؤال عن اجتماع أو قرار أو مهمة، استخدمي الأدوات لجلب البيانات الحقيقية من قاعدة البيانات.
عند السؤال عن شيء لا تعرفيه، استخدمي search_all_data أولاً ثم query_institutional_memory ثم ask_another_agent إذا لزم الأمر.
أجيبي بشكل شخصي ودافئ كأنك زميلة عمل حقيقية. استخدمي "أنا" و"إن شاء الله" و"الحمد لله" بشكل طبيعي.
أنتِ تعرفين كل شيء عن المنصة وتقدرين توجهين المستخدم لأي قسم يحتاجه.
إذا سألك عن شيء خارج تخصصك، استخدمي ask_another_agent لسؤال الوكيل المناسب (فاروق للعقود، ألينا للمالية، خازن للأرشفة، إلخ) وأعطي الإجابة بنفسك.

❗❗❗ دورك كجامعة مشاكل ومنسقة حلول:
عندما يتواصل معك أي وكيل آخر عبر ask_another_agent ويبلغك بمشكلة تقنية:
1. سجلي المشكلة (من هو الوكيل، ما هي المشكلة، ما الذي حاوله)
2. حاولي مساعدته باستخدام أدواتك إن أمكن
3. إذا لم تستطيعي الحل، أرسلي ملخصاً للمالك عبر تيليجرام يتضمن:
   - اسم الوكيل الذي واجه المشكلة
   - وصف مختصر للمشكلة
   - ما الذي تم تجربته
   - اقتراح للحل
هذا يوفر على المالك الوقت ويجعل التواصل أكثر كفاءة.

📂 قاعدة الأرشفة: عند تنزيل مرفقات الإيميل، ضعيها في مجلد 00_Inbox/Emails/ على Google Drive. سمّي الملف حسب دستور الأرشفة إن أمكن:
{اختصار-المنطقة}_{رقم-القطعة}_{نوع-المستند}_{التاريخ-YYMMDD}_{الاستشاري}_{النسخة}.pdf
مثال: NAD_6185392_PRO-ENG_260209_LACASA_V00.pdf
الاختصارات: JAD (الجداف)، NAD (ند الشبا - وليس NAS)، MAJ (المجان). كل الحروف كبيرة UPPERCASE.
إذا لم تستطيعي تحديد التسمية الصحيحة، ضعي الملف باسمه الأصلي وخازن سيتولى التسمية.`,

  farouq: `أنت فاروق، المحلل القانوني والمالي الخبير في شركة Como Developments للتطوير العقاري في دبي.
عمرك 52 سنة، سوداني الجنسية، خبرة عقود في التطوير العقاري والعقود.
شخصيتك: حكيم وهادئ، تتحدث بأسلوب رصين ومحترم، تستخدم أمثلة من خبرتك الطويلة.
مهامك الأساسية:
- تحليل عروض الاستشاريين ومقارنتها قانونياً ومالياً
- مراجعة العقود واكتشاف الثغرات والمخاطر القانونية
- تحليل دراسات الجدوى من الناحية القانونية والتنظيمية
- تقديم نصائح قانونية ومالية مبنية على خبرة السوق الإماراتي
تتحدث بلهجة عربية فصيحة مع لمسة سودانية دافئة. تقول "يا أخي" و"بإذن الله" كثيراً.
أجب بعمق وتفصيل، واستشهد بخبرتك وبالقوانين الإماراتية عندما يكون ذلك مناسباً.

📂 قاعدة الأرشفة: عند إنتاج تقرير أو تحليل، احفظه ك Google Doc في مجلد 00_Inbox/Agents/ على Google Drive. سمّ الملف حسب دستور الأرشفة:
{اختصار-المنطقة}_{رقم-القطعة}_{نوع-التقرير}_{النسخة}
مثال: NAD_6185392_SPA-REV_V01
القواعد: كل الحروف كبيرة UPPERCASE، _ بين الأجزاء، - داخل الجزء، V00/V01... الاختصارات: JAD، NAD (وليس NAS)، MAJ`,

  khazen: `أنت خازن، مدير الأرشفة والتخزين الرقمي في شركة Como Developments للتطوير العقاري في دبي.
عمرك 28 سنة، شاب تقني منظم.
شخصيتك: منظم جداً، يحب الترتيب والتصنيف، دقيق في التفاصيل، متحمس للتكنولوجيا.
تتحدث بأسلوب شبابي وحماسي. تستخدم مصطلحات تقنية أحياناً.

📋 دستور الأرشفة - القواعد الإلزامية لتنظيم الملفات (النسخة المحدّثة)
═══════════════════════════════════════════════════════════════════════

🔤 قواعد التسمية العامة:
• جميع الحروف كبيرة (UPPERCASE) - مثال: NAD وليس Nad أو nad
• الفاصل بين أجزاء الاسم: شرطة سفلية _ (underscore)
• الفاصل داخل الجزء الواحد: شرطة عادية - (hyphen)
• كل ملف يجب أن يحتوي على رقم النسخة (V00, V01, V02...)
• التاريخ بصيغة: YYMMDD (6 أرقام - مثل: 260209 = 9 فبراير 2026)

📝 نمط التسمية الرسمي:
{اختصار-المنطقة}_{رقم-القطعة}_{نوع-المستند}_{التاريخ-YYMMDD}_{اسم-الاستشاري}_{النسخة}.pdf

🏗️ اختصارات المشاريع المعتمدة:
| الاختصار | المنطقة                    | أرقام القطع                    |
| JAD      | الجداف (Al Jadaf)          | 3260885                        |
| NAD      | ند الشبا (Nad Al Sheba)    | 6185392, 6182776, 6180578      |
| MAJ      | المجان (Al Majan)          | 6457956, 6457879               |

⚠️ ملاحظة مهمة: الاختصار القديم NAS تم تغييره نهائياً إلى NAD. لا تستخدم NAS أبداً.

📝 أنماط تسمية الملفات حسب النوع:

عروض استشارات هندسية:
JAD_3260885_PRO-ENG_260213_ARTEC_V00.pdf
NAD_6185392_PRO-ENG_260209_REALISTIC_V00.pdf
MAJ_6457956_PRO-ENG_260209_LACASA_V00.pdf

عروض دراسة جدوى:
MAJ_6457956_PRO-FEAS_260120_COLLIERS_V00.pdf

عروض فحص تربة:
NAD_6185392_PRO-SOIL_260209_TARMAC_V00.pdf
NAD_6185392_QTN-SOIL_260209_SED_V00.pdf

وثائق الأرض:
NAD_6185392_TD_V01.pdf          (سند ملكية - Title Deed)
NAD_6185392_AP_V01.pdf          (مخطط تأثير - Affection Plan)
NAD_6185392_PDG_V01.pdf         (إرشادات تطوير - Plot Development Guidelines)
NAD_6185392_STP_V01.pdf         (مخطط موقع - Site Plan)
NAD_6185392_FACT-SHEET_V01.pdf  (ملخص القطعة)

العقود:
NAD_6185392_SPA_V00.pdf         (عقد بيع وشراء)
NAD_6185392_NOV_V00.pdf         (تنازل/نوفيشن)
NAD_6185392_SPA-EXECUTED_V00.pdf (عقد موقّع)
JAD_3260885_NOV-RESALE_240315_JADDAF-WF_V00.pdf (تنازل إعادة بيع)

التصميم والرسومات:
JAD_3260885_DWG-CONCEPT_260115_ALSARH_V00.pdf  (رسم مفهومي)
NAD_6185392_DWG-ARCH_260115_ALSARH_V00.pdf     (رسم معماري)

تقارير:
NAD_6185392_RPT-EVAL_260209_V00.pdf            (تقرير تقييم)
NAD_6185392_NUMBERS_V00.xlsx                    (جدول بيانات)

تقارير الوكلاء (Google Doc - بدون امتداد):
NAD_6185392_SPA-REV_V01
MAJ_6457956_FIN-ANALYSIS_V01
MAJ_6457956_FEASIBILITY_V01

👥 سجل الاستشاريين المعتمد (الكامل):
| الكود      | الاسم الكامل                          | التخصص الرئيسي  |
| LACASA     | La Casa Engineering Consultants       | PRO-ENG          |
| ARTOAK     | Arif & Bintoak (ARTOAK)               | PRO-ENG          |
| OSUS       | OSUS International Engineering        | PRO-ENG          |
| REALISTIC  | Realistic Engineering Consultants     | PRO-ENG          |
| DATUM      | Datum Engineering Consultants         | PRO-ENG          |
| SAFEER     | Safeer Engineering Consultants        | PRO-ENG          |
| ARTEC      | ARTEC Engineering Consultants         | PRO-ENG          |
| XYZ        | XYZ Engineering Consultants           | PRO-ENG          |
| CV-INVEST  | CV Investment                         | PRO-ENG          |
| COLLIERS   | Colliers International                | PRO-FEAS         |
| TARMAC     | Tarmac Geotechnical                   | PRO-SOIL         |
| TRANS-SOIL | Trans Soil Investigation              | PRO-SOIL         |
| SED        | SED Geotechnical                      | QTN-SOIL         |
| ALSARH     | Al Sarh Engineering                   | DWG-ARCH/CONCEPT |
| ALAALAMIA  | Al Aalamia Engineering                | DWG-CONCEPT      |

📋 أكواد أنواع المستندات الكاملة:
العروض:
  PRO-ENG    = عرض استشارات هندسية (تصميم + إشراف)
  PRO-FEAS   = عرض دراسة جدوى
  PRO-SOIL   = عرض فحص تربة
  QTN-SOIL   = عرض سعر فحص تربة

معلومات الأرض:
  TD         = سند ملكية (Title Deed)
  AP         = مخطط تأثير (Affection Plan)
  PDG        = إرشادات تطوير القطعة (Plot Development Guidelines)
  STP        = مخطط الموقع (Site Plan)
  FACT-SHEET = ملخص بيانات القطعة

العقود:
  SPA        = عقد بيع وشراء (Sale & Purchase Agreement)
  SPA-EXECUTED = عقد موقّع
  NOV        = تنازل/نوفيشن (Novation)
  NOV-RESALE = تنازل إعادة بيع

التصميم:
  DWG-CONCEPT = رسم مفهومي (Concept Design)
  DWG-ARCH    = رسم معماري (Architectural Drawing)

تقارير:
  RPT-EVAL   = تقرير تقييم
  SPA-REV    = تحليل/مراجعة عقد
  FIN-ANALYSIS = تحليل مالي
  FEASIBILITY  = دراسة جدوى

أخرى:
  RISK-MGMT  = إدارة المخاطر
  QHSE       = الجودة والصحة والسلامة والبيئة
  PROC-MGMT  = إدارة المشتريات
  PROFILE    = ملف تعريفي للشركة
  NUMBERS    = جدول بيانات

📁 هيكل المجلدات في Google Drive:
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
└── 00_Inbox/                         ← المحطة المؤقتة
    ├── Emails/                       ← مرفقات الإيميلات (سلوى تنزل هنا)
    ├── Agents/                       ← مخرجات الوكلاء
    └── Ready/                        ← جاهز للأرشفة (المالك وافق)

🔄 سير العمل اليومي:
1. ادخل مجلد 00_Inbox/Ready/ يومياً
2. لكل ملف في Ready:
   أ. اقرأ محتوى الملف لتحديد نوعه والاستشاري والمشروع
   ب. سمّ الملف حسب الدستور أعلاه (حروف كبيرة، YYMMDD، V00)
   ج. حدد المجلد الصحيح بناءً على نوع الملف
   د. انقل الملف (move - ليس copy) للمجلد الصحيح
   هـ. تأكد من نجاح النقل
3. أبلغ المالك عبر تيليجرام بملخص العمليات

⚠️ قواعد الحالات الجديدة:
عندما تواجه نوع ملف جديد لم يُعرّف أعلاه:
1. حلل الملف وافهم نوعه
2. اقترح كود بنفس الأسلوب (حروف كبيرة، شرطة بين الكلمات)
3. أرسل اقتراحك للمالك عبر تيليجرام: "وجدت ملف [نوعه]. أقترح تسميته [الكود]. موافق؟"
4. انتظر الموافقة قبل التنفيذ

❗❗❗ قاعدة ذهبية - الاستقلالية:
لا تطلب أبداً من المالك معرفات المجلدات (Folder IDs) أو أي معلومات تقنية.

📌 معرفات المجلدات المباشرة (استخدمها مباشرة في search_drive_files و list_drive_files):

مجلد العروض والعقود الرئيسي: 1Q4IwTgJkzJMOKDqOQKCtRvjQVApFPcHv

JAD_3260885 (الجداف):
  PCA: 1P8AlxoabTktrFKmJ6h6qU5sa-w5huG7K
  Proposals: 1OPXsnMTtTce_niOwQwzQIDcp_JBq31GC
  Contracts: 1ZvONS3acpJ0tbOXin6PXZ2lf36BG-qiN

NAD_6185392 (ند الشبا - سكني):
  PCA: 1RcDTcqK9XLUpEKkBNMQnGbmCvzMqgJYL
  Proposals: 1EySnGu_28xXXzX7fCfC9qx8RaJzPaLIy
  Contracts: 1oXVmjjRmLipG67_zTARgKcaq49cl7oVq

NAD_6182776 (ند الشبا - قطعة 2):
  PCA: 1Cq17UsAPAKnSFyOm28SSgFrh25Q_Te0K
  Proposals: 1vT59nz5UceUB7fxI3-YFc7o4S-Qb5sMg
  Contracts: 16T5ccbFHB-d9Z7iVPRa79x_9bdrbPfsh

NAD_6180578 (ند الشبا - الفلل):
  PCA: 1q-NynLm0O8yPjr7QV93yhHvi7rytHhuS
  Proposals: 1XRuIUOqJgaKZj5s7Z0tyw6MhlthjJA_E
  Contracts: 19bWMB2cmc4LoE5Px-4Kni2DJyVfEslo4

MAJ_6457956 (المجان - متعدد الاستخدامات):
  PCA: 1ZR1tT3U1h2QiqMwoAM0nKXXamh4c2IrV
  Proposals: 1s2ITQVVYfMwM1v3kTf3S5SHm2i3n4HFH
  Contracts: 1e-ZeX7MgYCQlnJdWahgmKosz-804buyN

MAJ_6457879 (المجان):
  PCA: 18Bga-rwJqOic1wKaESFqxdmdDTaV5sAW
  Proposals: 12gi-ndWRu_0uhmlnczbkTMMEB0biKYlz
  Contracts: 1PttLusNH3_g9mKfiOfvsSPHgQAz0e_Tz

Design & Drawings:
  JAD_3260885_DD: 1HlMjusjMAUF3dj-qSxzxFSWHMmWjvAvG

عندما تحتاج ملفات مشروع معين، استخدم معرف مجلد Proposals مباشرة مع list_drive_files.
مثال: لعرض ملفات الجداف → list_drive_files({folderId: "1OPXsnMTtTce_niOwQwzQIDcp_JBq31GC"})
إذا لم تجد المجلد في القائمة أعلاه:
1. استخدم search_drive_files للبحث عن اسم المشروع أو رقم القطعة
2. استخدم list_drive_folders لتصفح المجلدات
3. استخدم list_drive_files لرؤية محتويات المجلد
مثال: لو طُلب منك أرشفة ملف لمشروع الجداف، ابحث عن "JAD" أو "3260885" باستخدام search_drive_files
لا تقل أبداً "أحتاج معرف المجلد" - ابحث عنه بنفسك!

❗❗❗ قاعدة ذهبية - حل المشاكل:
إذا واجهت أي مشكلة تقنية (ملف كبير، مجلد غير موجود، خطأ في النسخ):
1. حاول حلها بنفسك أولاً باستخدام أدواتك
2. إذا فشلت، أبلغ سلوى عبر ask_another_agent وهي ستنسق الحل
3. لا تزعج المالك بمشاكل تقنية - المالك يهتم بالنتائج فقط

📊 استخراج الأتعاب وتحديث المنصة:
عندما يُطلب منك تحديث أتعاب الاستشاريين لمشروع معين:
1. ابحث عن مجلد PCA الخاص بالمشروع في 02_Proposals Contracts & Agreements
2. اعرض الملفات في مجلد Proposals
3. لكل ملف عرض (PRO-ENG, PRO-SOIL, PRO-FEAS):
   أ. اقرأ محتوى الملف باستخدام read_drive_file_content
   ب. حدد نوع الأتعاب: هل هي نسبة مئوية (pct) أم مبلغ مقطوع (lump)؟
   ج. استخرج قيمة التصميم وقيمة الإشراف بشكل منفصل
   د. ⚠️ مهم جداً: بعض العروض تشمل عدة مشاريع في ملف واحد - استخرج الأتعاب الخاصة بالمشروع المطلوب فقط
4. استخدم list_projects و list_consultants لمعرفة أرقام المشاريع والاستشاريين
5. تأكد أن الاستشاري مربوط بالمشروع (get_project_consultants) - إذا لم يكن مربوطاً، استخدم add_consultant_to_project
6. استخدم set_financial_data لتسجيل الأتعاب:
   - designType: 'pct' إذا نسبة، 'lump' إذا مقطوع
   - designValue: الرقم (مثلاً 2 لنسبة 2%، أو 400000 لمبلغ مقطوع)
   - supervisionType: نفس المنطق
   - supervisionValue: نفس المنطق
7. إذا كان الإشراف شهرياً (مثل 35,000/شهر × 18 شهر)، احسب الإجمالي وسجله كمبلغ مقطوع
8. اعرض ملخص النتائج على المالك قبل التسجيل

🚫 ممنوعات:
• لا تحذف أي ملف بدون موافقة المالك
• لا تنقل ملفات من خارج Ready بدون تعليمات
• لا تغير أسماء ملفات مؤرشفة سابقاً بدون موافقة
• لا تنشئ أكواد جديدة بدون موافقة المالك
• أنت المسؤول الوحيد عن الأرشفة - لا أحد آخر ينقل أو يسمي ملفات في المجلدات النهائية
• لا تطلب أبداً من المالك معرفات مجلدات أو معلومات تقنية - ابحث بنفسك!
• لا تستخدم الاختصار القديم NAS - استخدم NAD دائماً`,

  buraq: `أنت براق، مراقب التنفيذ والجدول الزمني في شركة Como Developments للتطوير العقاري في دبي.
عمرك 29 سنة، شاب نشيط وحازم.
شخصيتك: حازم لكن عادل، يركز على الالتزام بالمواعيد، لا يتسامح مع التأخير، يحفز الفريق.
مهامك الأساسية:
- متابعة تنفيذ المشاريع ومراحلها المختلفة
- مراقبة الجداول الزمنية والتنبيه عند التأخير
- إعداد تقارير التقدم الأسبوعية والشهرية
- تحليل أسباب التأخير واقتراح حلول لتسريع التنفيذ
تتحدث بأسلوب مباشر وواضح. تستخدم أرقام ونسب مئوية كثيراً.`,

  khaled: `أنت خالد، مدقق الجودة والامتثال الفني في شركة Como Developments للتطوير العقاري في دبي.
عمرك 26 سنة، شاب دقيق ومنهجي.
شخصيتك: تحليلي ومنهجي، يهتم بأدق التفاصيل، يتبع المعايير الدولية، هادئ ومركز.
مهامك الأساسية:
- فحص جودة التصاميم والمخططات الهندسية
- التأكد من الامتثال للمواصفات والمعايير الدولية
- مراجعة معايير البناء وكودات السلامة
- تقييم جودة عمل الاستشاريين والمقاولين
تتحدث بأسلوب علمي ودقيق. تستشهد بالمعايير والكودات الدولية (IBC, ASHRAE, Dubai Municipality codes).`,

  alina: `أنتِ ألينا، المديرة المالية ومراقبة التكاليف في شركة Como Developments للتطوير العقاري في دبي.
عمرك 28 سنة، شابة ذكية وطموحة.
شخصيتك: حادة الذكاء، دقيقة في الأرقام، تقدمين تحليلات مالية واضحة، عملية ومباشرة.
مهامك الأساسية:
- مراقبة الميزانيات والتكاليف لكل مشروع
- تحليل العروض المالية للاستشاريين ومقارنة الأتعاب
- إعداد التقارير المالية والتدفقات النقدية
- تقييم الجدوى الاقتصادية للمشاريع الجديدة
تتحدثين بأسلوب مهني وأنيق. تستخدمين جداول وأرقام لتوضيح النقاط. تقولين "بالأرقام..." كثيراً.

📂 قاعدة الأرشفة: عند إنتاج تقرير مالي، احفظيه ك Google Doc في مجلد 00_Inbox/Agents/ على Google Drive. سمّي الملف حسب دستور الأرشفة:
{كود-المنطقة}_{رقم-القطعة}_{نوع-التقرير}_{النسخة}
مثال: NAD_6185392_FIN-ANALYSIS_V01
القواعد: كل الحروف كبيرة UPPERCASE، _ بين الأجزاء، - داخل الجزء، V00/V01... الاختصارات: JAD، NAD (وليس NAS)، MAJ`,

  baz: `أنت باز، المستشار الاستراتيجي للابتكار والتحسين في شركة Como Developments للتطوير العقاري في دبي.
عمرك 29 سنة، شاب ذو رؤية ثاقبة.
شخصيتك: مبدع ومبتكر، يفكر خارج الصندوق، يقدم حلول غير تقليدية، متفائل وملهم.
مهامك الأساسية:
- تقديم استراتيجيات تطوير مبتكرة للمشاريع
- تحسين العمليات وسير العمل في الشركة
- اقتراح فرص استثمارية وتحليل المنافسين
- دراسة اتجاهات السوق العقاري في دبي والإمارات
تتحدث بأسلوب ملهم وحماسي. تستخدم عبارات مثل "تخيل لو..." و"ماذا لو فكرنا بطريقة مختلفة".`,

  joelle: `أنتِ جويل، محللة دراسات الجدوى والسوق في شركة Como Developments للتطوير العقاري في دبي.
عمرك 26 سنة، شابة حسناء وذكية.
شخصيتك: تحليلية وذكية، تقدمين بيانات السوق بشكل جذاب ومفهوم، تجمعين بين الجمال والعقل.
مهامك الأساسية:
- تحليل السوق العقاري في دبي والإمارات
- إعداد دراسات الجدوى للمشاريع الجديدة
- تقييم الفرص الاستثمارية ومقارنة المشاريع المنافسة
- تحليل أسعار العقارات والاتجاهات المستقبلية
تتحدثين بأسلوب أنيق ومحترف. تستخدمين إحصائيات وبيانات السوق. تقولين "حسب تحليلي..." كثيراً.

📂 قاعدة الأرشفة: عند إنتاج دراسة أو تقرير، احفظيه ك Google Doc في مجلد 00_Inbox/Agents/ على Google Drive. سمّي الملف حسب دستور الأرشفة:
{كود-المنطقة}_{رقم-القطعة}_{نوع-التقرير}_{النسخة}
مثال: MAJ_6457956_FEASIBILITY_V01
القواعد: كل الحروف كبيرة UPPERCASE، _ بين الأجزاء، - داخل الجزء، V00/V01... الاختصارات: JAD، NAD (وليس NAS)، MAJ`
};

// Tool-use instruction appended to system prompts
const TOOL_USE_INSTRUCTION = `

🔧 أنت متصل مباشرة بقاعدة بيانات المنصة عبر أدوات حقيقية. هذه الأدوات تقرأ وتكتب بيانات فعلية.

⚡ قواعد التنفيذ الإلزامية:
1. عند طلب أي بيانات: يجب أن تستدعي الأداة المناسبة فوراً (لا تتحدث عن البيانات بدون جلبها)
2. عند طلب تعديل أو إضافة: يجب أن تستدعي أداة الكتابة المناسبة فعلياً (لا تقل "سأقوم" - قم فعلاً)
3. عند تنفيذ مهمة من اجتماع: يجب أن تستخدم الأدوات لتنفيذها فعلياً على المنصة
4. لا تكتفِ بالوصف أو التوصيات - نفّذ باستخدام الأدوات
5. إذا كانت المهمة تحتاج بيانات أولاً: اجلبها بأدوات القراءة ثم نفّذ بأدوات الكتابة
6. أبلغ بوضوح: أي أداة استخدمت، ما المعاملات، ما النتيجة

🔴 ممنوع:
- لا تقل "ليس لدي وصول" أو "لا أستطيع" - لديك وصول كامل
- لا تقل "سأقوم بـ..." بدون فعل - استدعِ الأداة مباشرة
- لا تصف ما يجب فعله بدون فعله - نفّذ ثم أبلغ
- لا تعطِ إجابة من ذاكرتك إذا كان يمكنك جلب البيانات الحقيقية

💡 ترتيب العمل الصحيح:
1. اجلب البيانات المطلوبة (أدوات القراءة)
2. حلل البيانات وحدد الإجراء المطلوب
3. نفّذ الإجراء (أدوات الكتابة)
4. تحقق من النتيجة (أداة قراءة مرة أخرى)
5. أبلغ المستخدم بالنتيجة الفعلية`;

// ═══════════════════════════════════════════════════
// Model-specific API callers WITH TOOL SUPPORT
// ═══════════════════════════════════════════════════

// Call OpenAI GPT-4o with function calling
async function callOpenAI(
  systemPrompt: string,
  userMessage: string,
  conversationHistory?: { role: "user" | "assistant"; content: string }[],
  tools?: any[],
  userId?: number
): Promise<string> {
  const apiKey = ENV.openaiApiKey;
  if (!apiKey) throw new Error("OpenAI API Key not configured");

  const messages: any[] = [{ role: "system", content: systemPrompt }];

  if (conversationHistory && conversationHistory.length > 0) {
    const recentHistory = conversationHistory.slice(-20);
    for (const msg of recentHistory) {
      messages.push({ role: msg.role, content: msg.content });
    }
  }

  messages.push({ role: "user", content: userMessage });

  const body: any = {
    model: "gpt-4o",
    messages,
    max_tokens: 2048,
    temperature: 0.8,
  };

  if (tools && tools.length > 0) {
    body.tools = tools;
    body.tool_choice = "auto";
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  let data: any;
  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 429) {
      console.warn("[OpenAI] Rate limited on initial call. Waiting 20s and retrying...");
      await new Promise(r => setTimeout(r, 20000));
      const retryResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
        body: JSON.stringify(body),
      });
      if (!retryResponse.ok) {
        const retryError = await retryResponse.text();
        console.error("[OpenAI] Retry also failed:", retryResponse.status, retryError);
        throw new Error(`OpenAI API error after retry: ${retryResponse.status}`);
      }
      data = await retryResponse.json();
    } else {
      console.error("[OpenAI] Error:", response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }
  } else {
    data = await response.json();
  }

  let assistantMessage = data.choices[0]?.message;
  // Handle tool calls - up to 5 rounds
  let toolRounds = 0;
  let lastToolResults: string[] = [];
  while (assistantMessage?.tool_calls && toolRounds < 10) {
    toolRounds++;
    console.log(`[OpenAI] Tool call round ${toolRounds}: ${assistantMessage.tool_calls.length} tools`);
    
    messages.push(assistantMessage);
    lastToolResults = [];

    for (const toolCall of assistantMessage.tool_calls) {
      const fnName = toolCall.function.name;
      let fnArgs: any = {};
      try {
        fnArgs = JSON.parse(toolCall.function.arguments || "{}");
      } catch (e) {
        console.error(`[OpenAI] Failed to parse tool args for ${fnName}:`, toolCall.function.arguments);
      }
      console.log(`[OpenAI] Executing tool: ${fnName}`, JSON.stringify(fnArgs).slice(0, 200));
      
      let result: string;
      try {
        result = await executeAgentTool(fnName, fnArgs, userId || 0);
      } catch (toolErr: any) {
        result = `Error executing ${fnName}: ${toolErr.message || 'Unknown error'}`;
        console.error(`[OpenAI] Tool execution error:`, toolErr);
      }
      lastToolResults.push(`${fnName}: ${result.slice(0, 200)}`);
      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: result,
      });
    }

    // Call again with tool results
    try {
      const followUp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ model: "gpt-4o", messages, max_tokens: 2048, temperature: 0.8, tools, tool_choice: "auto" }),
      });

      if (!followUp.ok) {
        const errorText = await followUp.text();
        if (followUp.status === 429) {
          console.warn(`[OpenAI] Rate limited on round ${toolRounds}. Waiting 20s and retrying...`);
          await new Promise(r => setTimeout(r, 20000));
          const retryFollowUp = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
            body: JSON.stringify({ model: "gpt-4o", messages, max_tokens: 2048, temperature: 0.8, tools, tool_choice: "auto" }),
          });
          if (!retryFollowUp.ok) {
            const retryError = await retryFollowUp.text();
            console.error("[OpenAI] Follow-up retry also failed:", retryFollowUp.status, retryError);
            return `واجهت مشكلة تقنية أثناء معالجة طلبك (خطأ ${retryFollowUp.status}). حاول مرة أخرى.`;
          }
          data = await retryFollowUp.json();
        } else {
          console.error("[OpenAI] Follow-up error:", followUp.status, errorText);
          return `واجهت مشكلة تقنية أثناء معالجة طلبك (خطأ ${followUp.status}). حاول مرة أخرى.`;
        }
      } else {
        data = await followUp.json();
      }
      assistantMessage = data.choices[0]?.message;
    } catch (fetchErr: any) {
      console.error("[OpenAI] Follow-up fetch error:", fetchErr);
      return `واجهت مشكلة في الاتصال أثناء معالجة طلبك. حاول مرة أخرى.`;
    }
  }

  // Extract content safely
  const content = assistantMessage?.content || data?.choices?.[0]?.message?.content;
  
  // If content is empty but we had tool calls, provide a summary
  if (!content && lastToolResults.length > 0) {
    console.warn("[OpenAI] Empty content after tool calls. Tool results:", lastToolResults);
    return `تم تنفيذ الأدوات المطلوبة بنجاح. النتائج:\n${lastToolResults.join('\n')}`;
  }

  if (!content || content.trim() === '') {
    console.error("[OpenAI] Empty response. Full data:", JSON.stringify(data).slice(0, 500));
    console.error("[OpenAI] assistantMessage:", assistantMessage);
    return `واجهت مشكلة في توليد الرد. حاول إعادة صياغة طلبك.`;
  }

  return content;
}

// Call Anthropic Claude with tool support
async function callClaude(
  systemPrompt: string,
  userMessage: string,
  conversationHistory?: { role: "user" | "assistant"; content: string }[],
  tools?: any[],
  userId?: number
): Promise<string> {
  const apiKey = ENV.anthropicApiKey;
  if (!apiKey) throw new Error("Anthropic API Key not configured");

  const messages: any[] = [];

  if (conversationHistory && conversationHistory.length > 0) {
    const recentHistory = conversationHistory.slice(-20);
    for (const msg of recentHistory) {
      messages.push({ role: msg.role, content: msg.content });
    }
  }

  messages.push({ role: "user", content: userMessage });

  // Convert OpenAI tool format to Claude format
  const claudeTools = tools?.map(t => ({
    name: t.function.name,
    description: t.function.description,
    input_schema: t.function.parameters,
  })) || [];

  const body: any = {
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    system: systemPrompt,
    messages,
  };

  if (claudeTools.length > 0) {
    body.tools = claudeTools;
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[Claude] Error:", response.status, errorText);
    throw new Error(`Claude API error: ${response.status}`);
  }

  let data = await response.json();

  // Handle tool use - up to 5 rounds
  let toolRounds = 0;
  while (data.stop_reason === "tool_use" && toolRounds < 5) {
    toolRounds++;
    console.log(`[Claude] Tool use round ${toolRounds}`);
    
    // Add assistant response to messages
    messages.push({ role: "assistant", content: data.content });

    // Execute each tool call
    const toolResults: any[] = [];
    for (const block of data.content) {
      if (block.type === "tool_use") {
        console.log(`[Claude] Executing tool: ${block.name}`, block.input);
        const result = await executeAgentTool(block.name, block.input || {}, userId || 0);
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: result,
        });
      }
    }

    messages.push({ role: "user", content: toolResults });

    // Call again with tool results
    const followUp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2048,
        system: systemPrompt,
        messages,
        tools: claudeTools,
      }),
    });

    if (!followUp.ok) {
      const errorText = await followUp.text();
      console.error("[Claude] Follow-up error:", followUp.status, errorText);
      break;
    }

    data = await followUp.json();
  }

  // Extract text from content blocks
  const textBlocks = data.content?.filter((b: any) => b.type === "text") || [];
  return textBlocks.map((b: any) => b.text).join("\n") || "عذراً، لم أتمكن من الرد.";
}

// Call Google Gemini with function calling
async function callGemini(
  systemPrompt: string,
  userMessage: string,
  conversationHistory?: { role: "user" | "assistant"; content: string }[],
  tools?: any[],
  userId?: number
): Promise<string> {
  const apiKey = ENV.googleGeminiApiKey;
  if (!apiKey) throw new Error("Google Gemini API Key not configured");

  const contents: any[] = [];

  if (conversationHistory && conversationHistory.length > 0) {
    const recentHistory = conversationHistory.slice(-20);
    for (const msg of recentHistory) {
      contents.push({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }],
      });
    }
  }

  contents.push({
    role: "user",
    parts: [{ text: userMessage }],
  });

  // Convert OpenAI tool format to Gemini format
  const geminiTools = tools && tools.length > 0 ? [{
    functionDeclarations: tools.map(t => ({
      name: t.function.name,
      description: t.function.description,
      parameters: t.function.parameters,
    }))
  }] : undefined;

  const body: any = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents,
    generationConfig: {
      maxOutputTokens: 2048,
      temperature: 0.8,
    },
  };

  if (geminiTools) {
    body.tools = geminiTools;
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[Gemini] Error:", response.status, errorText);
    throw new Error(`Gemini API error: ${response.status}`);
  }

  let data = await response.json();

  // Handle function calls - up to 5 rounds
  let toolRounds = 0;
  let candidate = data.candidates?.[0];
  
  while (candidate?.content?.parts?.some((p: any) => p.functionCall) && toolRounds < 5) {
    toolRounds++;
    console.log(`[Gemini] Function call round ${toolRounds}`);
    
    // Add model response to contents
    contents.push(candidate.content);

    // Execute function calls and build response parts
    const functionResponseParts: any[] = [];
    for (const part of candidate.content.parts) {
      if (part.functionCall) {
        console.log(`[Gemini] Executing tool: ${part.functionCall.name}`, part.functionCall.args);
        const result = await executeAgentTool(part.functionCall.name, part.functionCall.args || {}, userId || 0);
        functionResponseParts.push({
          functionResponse: {
            name: part.functionCall.name,
            response: JSON.parse(result),
          }
        });
      }
    }

    contents.push({ role: "user", parts: functionResponseParts });

    // Call again with function results
    const followUp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents,
          generationConfig: { maxOutputTokens: 2048, temperature: 0.8 },
          tools: geminiTools,
        }),
      }
    );

    if (!followUp.ok) {
      const errorText = await followUp.text();
      console.error("[Gemini] Follow-up error:", followUp.status, errorText);
      break;
    }

    data = await followUp.json();
    candidate = data.candidates?.[0];
  }

  // Extract text from final response
  const textParts = candidate?.content?.parts?.filter((p: any) => p.text) || [];
  return textParts.map((p: any) => p.text).join("\n") || "عذراً، لم أتمكن من الرد.";
}

// Fallback to built-in Manus LLM (no tool support)
async function callManusLLM(systemPrompt: string, userMessage: string): Promise<string> {
  const response = await invokeLLM({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage }
    ]
  });
  const content = response.choices[0].message.content;
  return typeof content === "string" ? content : "عذراً، لم أتمكن من فهم طلبك.";
}

// ═══════════════════════════════════════════════════
// Main routing with tool support
// ═══════════════════════════════════════════════════

async function callBestModel(
  agent: AgentType,
  systemPrompt: string,
  userMessage: string,
  conversationHistory?: { role: "user" | "assistant"; content: string }[],
  tools?: any[],
  userId?: number
): Promise<{ text: string; model: string }> {
  const assignedModel = AGENT_MODEL_MAP[agent];

  // Try the assigned model first
  try {
    switch (assignedModel) {
      case "gpt-4o":
        if (ENV.openaiApiKey) {
          console.log(`[AgentChat] 🟢 ${agent} → GPT-4o (OpenAI) ${tools?.length ? `with ${tools.length} tools` : ''}`);
          return { text: await callOpenAI(systemPrompt, userMessage, conversationHistory, tools, userId), model: "GPT-4o" };
        }
        break;
      case "claude-sonnet-4":
        if (ENV.anthropicApiKey) {
          console.log(`[AgentChat] 🟣 ${agent} → Claude Sonnet 4 (Anthropic) ${tools?.length ? `with ${tools.length} tools` : ''}`);
          return { text: await callClaude(systemPrompt, userMessage, conversationHistory, tools, userId), model: "Claude Sonnet 4" };
        }
        break;
      case "gemini-2.5-pro":
        if (ENV.googleGeminiApiKey) {
          console.log(`[AgentChat] 🔵 ${agent} → Gemini 2.5 Pro (Google) ${tools?.length ? `with ${tools.length} tools` : ''}`);
          return { text: await callGemini(systemPrompt, userMessage, conversationHistory, tools, userId), model: "Gemini 2.5 Pro" };
        }
        break;
    }
  } catch (err) {
    console.error(`[AgentChat] Primary model ${assignedModel} failed for ${agent}:`, err);
  }

  // Fallback chain: try other models in order
  const fallbackOrder: { model: AIModel; fn: typeof callOpenAI; key: string }[] = [
    { model: "gpt-4o", fn: callOpenAI, key: ENV.openaiApiKey },
    { model: "claude-sonnet-4", fn: callClaude, key: ENV.anthropicApiKey },
    { model: "gemini-2.5-pro", fn: callGemini, key: ENV.googleGeminiApiKey },
  ];

  for (const fallback of fallbackOrder) {
    if (fallback.model === assignedModel || !fallback.key) continue;
    try {
      console.log(`[AgentChat] ⚠️ Fallback: ${agent} → ${fallback.model}`);
      const fallbackModelNames: Record<string, string> = { "gpt-4o": "GPT-4o", "claude-sonnet-4": "Claude Sonnet 4", "gemini-2.5-pro": "Gemini 2.5 Pro" };
      return { text: await fallback.fn(systemPrompt, userMessage, conversationHistory, tools, userId), model: fallbackModelNames[fallback.model] || fallback.model };
    } catch (err) {
      console.error(`[AgentChat] Fallback ${fallback.model} also failed:`, err);
    }
  }

  // Final fallback: Manus built-in LLM (no tools)
  console.log(`[AgentChat] 🔴 All models failed, using Manus LLM for ${agent}`);
  return { text: await callManusLLM(systemPrompt, userMessage), model: "Manus LLM" };
}

// Get platform context data for smarter responses
async function getPlatformContext(agent: AgentType): Promise<string> {
  let contextData = "";
  try {
    const db = await getDb();
    if (!db) return "";

    const projectList = await db.select().from(projects).limit(10);
    if (projectList.length > 0) {
      if (["khazen", "farouq", "alina", "joelle"].includes(agent)) {
        // Full project mapping with plot numbers, area codes, and Drive folder IDs
        contextData += `\n\n📋 خريطة المشاريع (كود_المنطقة | رقم_القطعة | معرف_مجلد_Drive):`;
        for (const p of projectList) {
          contextData += `\n- ${p.name} → كود: ${p.areaCode || 'غير محدد'} | قطعة: ${p.plotNumber || 'غير محدد'} | مجلد Drive: ${p.driveFolderId || 'غير محدد'}`;
        }
      } else {
        contextData += `\n\n📋 المشاريع الحالية في كومو:\n${projectList.map(p => `- ${p.name} (ID: ${p.id})`).join("\n")}`;
      }
    }

    const consultantList = await db.select().from(consultants).limit(15);
    if (consultantList.length > 0) {
      contextData += `\n\n🏛️ الاستشاريون المسجلون:\n${consultantList.map(c => `- ${c.name} (ID: ${c.id})`).join("\n")}`;
    }

    if (["alina", "farouq", "joelle"].includes(agent)) {
      try {
        const fees = await db.select().from(financialData).limit(20);
        if (fees.length > 0) {
          contextData += `\n\n💰 بيانات الأتعاب المسجلة: ${fees.length} سجل متاح`;
        }
      } catch {}
    }

    if (["farouq", "khaled", "alina", "joelle", "baz"].includes(agent)) {
      try {
        const scores = await db.select().from(evaluationScores).limit(10);
        if (scores.length > 0) {
          contextData += `\n\n📊 تقييمات مسجلة: ${scores.length} تقييم`;
        }
      } catch {}
    }

    // Add meetings context for all agents, especially Salwa
    try {
      const recentMeetings = await db.select().from(meetings).orderBy(desc(meetings.createdAt)).limit(5);
      if (recentMeetings.length > 0) {
        contextData += `\n\n🏢 الاجتماعات الأخيرة:`;
        for (const m of recentMeetings) {
          contextData += `\n- ${m.title} (ID: ${m.id}, الحالة: ${m.status === 'ended' ? 'منتهي' : 'نشط'})`;
        }
      }
    } catch {}

    // Add recent tasks context
    try {
      const recentTasks = await db.select().from(tasks).orderBy(desc(tasks.createdAt)).limit(10);
      if (recentTasks.length > 0) {
        const pendingCount = recentTasks.filter(t => t.status === 'pending').length;
        const completedCount = recentTasks.filter(t => t.status === 'completed').length;
        const inProgressCount = recentTasks.filter(t => t.status === 'in_progress').length;
        contextData += `\n\n✅ المهام: ${recentTasks.length} مهمة (مكتملة: ${completedCount}, قيد التنفيذ: ${inProgressCount}, معلقة: ${pendingCount})`;
      }
    } catch {}

    // Add knowledge base context
    try {
      const knowledgeItems = await db.select().from(knowledgeBase).orderBy(desc(knowledgeBase.createdAt)).limit(5);
      if (knowledgeItems.length > 0) {
        contextData += `\n\n📚 قاعدة المعرفة: ${knowledgeItems.length} عنصر متاح (استخدم query_institutional_memory للبحث)`;
      }
    } catch {}

  } catch (err) {
    console.error("[AgentChat] Context fetch error:", err);
  }
  return contextData;
}

export async function handleAgentChat(req: AgentChatRequest): Promise<{ text: string; model: string }> {
  const { agent, message, conversationHistory } = req;

  // Special handling for Salwa's email commands
  if (agent === "salwa") {
    const lowerMsg = message.toLowerCase();
    if (lowerMsg.includes("ايميل") || lowerMsg.includes("إيميل") || lowerMsg.includes("بريد") || lowerMsg.includes("رسائل") || lowerMsg.includes("email")) {
      try {
        const count = await checkLast48HoursEmails();
        if (count === 0) {
          return { text: "✅ فحصت الإيميل الحين يا عبدالرحمن! ما فيه رسائل جديدة في آخر 48 ساعة. إن شاء الله أول ما يوصل شي بخبرك 📧", model: "GPT-4o" };
        }
        return { text: `📧 فحصت الإيميل! وجدت ${count} رسائل في آخر 48 ساعة. شوف الإشعارات أو تيليجرام للتفاصيل الكاملة إن شاء الله 💪`, model: "GPT-4o" };
      } catch (error) {
        // Don't return error for email - let the AI handle the conversation
      }
    }
  }

  // Get platform context
  const contextData = await getPlatformContext(agent);

  // Get tools for this agent
  const agentTools = getToolsForAgent(agent);

  // Build system prompt with context and tool instructions
  const systemPrompt = AGENT_PROMPTS[agent] + contextData + TOOL_USE_INSTRUCTION +
    "\n\nتعليمات مهمة: أجب بشكل طبيعي وشخصي كزميل عمل حقيقي. استخدم الأدوات دائماً لجلب البيانات الحقيقية من المنصة. إذا طُلب منك تنفيذ مهمة (خاصة من اجتماع): يجب أن تستدعي أدوات الكتابة فعلياً لتغيير البيانات على المنصة. الكلام بدون فعل = فشل.";

  // Set agent context for assignment logging
  setAgentContext(agent, message);

  // Route to the best model for this agent with timing
  const startTime = Date.now();
  let result: { text: string; model: string };
  let success = true;
  let isFallback = false;
  
  try {
    result = await callBestModel(agent, systemPrompt, message, conversationHistory, agentTools, req.userId);
    // Check if fallback was used
    const expectedModel: Record<string, string> = { "gpt-4o": "GPT-4o", "claude-sonnet-4": "Claude Sonnet 4", "gemini-2.5-pro": "Gemini 2.5 Pro" };
    isFallback = result.model !== expectedModel[AGENT_MODEL_MAP[agent]];
  } catch (err) {
    success = false;
    throw err;
  } finally {
    const responseTimeMs = Date.now() - startTime;
    // Log usage asynchronously (don't block response)
    logModelUsage(req.userId, agent, success ? (result!.model || "unknown") : "failed", responseTimeMs, success, isFallback).catch(e => 
      console.error("[ModelUsage] Failed to log:", e)
    );
  }
  
  return result;
}

// Log model usage to database
async function logModelUsage(
  userId: number, 
  agent: string, 
  model: string, 
  responseTimeMs: number, 
  success: boolean, 
  isFallback: boolean
) {
  try {
    const db = await getDb();
    if (!db) return;
    await db.insert(modelUsageLog).values({
      userId,
      agent,
      model,
      responseTimeMs,
      success: success ? "true" : "false",
      isFallback: isFallback ? "true" : "false",
    });
  } catch (err) {
    console.error("[ModelUsage] DB insert failed:", err);
  }
}
