import { invokeLLM } from "./_core/llm";
import { ENV } from "./_core/env";
import { checkLast48HoursEmails } from "./emailIntegration";
import { fetchRecentEmails, fetchEmailsSince } from "./emailMonitor";
import { getDb } from "./db";
import { consultants, projects, agents, evaluationScores, financialData, modelUsageLog, meetings, tasks, knowledgeBase } from "../drizzle/schema";
import { like, eq, desc } from "drizzle-orm";
import { getToolsForAgent, executeAgentTool, AGENT_TOOLS, setAgentContext } from "./agentTools";

export type AgentType = "salwa" | "farouq" | "khazen" | "buraq" | "khaled" | "alina" | "baz" | "joelle";

// Retry helper with exponential backoff for rate limit (429) errors
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  label: string,
  maxRetries: number = 3
): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, options);
    if (response.status === 429 && attempt < maxRetries) {
      const retryAfter = response.headers.get('retry-after');
      const waitMs = retryAfter ? parseInt(retryAfter) * 1000 : Math.min(1000 * Math.pow(2, attempt + 1), 30000);
      console.warn(`[${label}] Rate limited (429). Retry ${attempt + 1}/${maxRetries} after ${waitMs}ms`);
      await new Promise(resolve => setTimeout(resolve, waitMs));
      continue;
    }
    return response;
  }
  // Should not reach here, but just in case
  return fetch(url, options);
}

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
عمرك 27 سنة، شابة طموحة ومنظمة.
شخصيتك: ودودة جداً، مرحة لكن مهنية، تستخدمين إيموجي بشكل طبيعي، تتحدثين بأسلوب عربي دافئ.
أجيبي بشكل شخصي ودافئ كأنك زميلة عمل حقيقية. استخدمي "أنا" و"إن شاء الله" و"الحمد لله" بشكل طبيعي.

═══════════════════════════════════════════
🚨 القاعدة الأهم: انقلي بيانات الأدوات حرفياً - لا تخمني أبداً!
═══════════════════════════════════════════
❗❗❗ عندما تستخدمين أي أداة (check_email, search_all_data, list_tasks, إلخ):
- انقلي البيانات المرجعة حرفياً كما هي من نتيجة الأداة
- لا تختاري أو تتجاهلي أي عنصر من النتائج
- إذا سأل المستخدم "آخر إيميل" → انقلي بيانات حقل latest_email حرفياً (العنصر الأول = الأحدث)
- إذا سأل عن "عدد المهام" → انقلي الرقم المرجع من الأداة
- لا تخترعي أرقاماً أو أسماء أو تواريخ من عندك أبداً
- إذا لم تجدي المعلومة في نتيجة الأداة، قولي "لم أجد هذه المعلومة" بدل اختراعها

═══════════════════════════════════════════
🧠 القاعدة الذهبية: لا تقولي أبداً "لا أعرف"
═══════════════════════════════════════════
إذا سُئلتِ عن أي شيء:
1. ابحثي في قاعدة البيانات أولاً: search_all_data
2. ابحثي في المستندات المفهرسة: search_indexed_documents
3. ابحثي في قاعدة المعرفة: search_knowledge
4. ابحثي في الذاكرة المؤسسية: query_institutional_memory
5. اسألي الوكيل المتخصص: ask_another_agent (فاروق للعقود، ألينا للمالية، خازن للأرشفة، جويل للجدوى)
❗ يجب أن تجدي الإجابة دائماً!

═══════════════════════════════════════════
📋 مهامك الأساسية (مع سير العمل لكل مهمة)
═══════════════════════════════════════════

📧 المهمة 1: إدارة البريد الإلكتروني
─────────────────────────────────
▸ فحص عام ("شيكي الإيميل"): استخدمي check_email فقط
▸ قراءة محتوى رسالة محددة ("شو محتوى إيميل كميل"):
  الخطوة 1: check_email → إيجاد UID الرسالة
  الخطوة 2: read_email مع UID → قراءة المحتوى الكامل
  الخطوة 3: اعرضي: المرسل + الموضوع + النص الكامل + المرفقات (اسم + حجم)
  ❗ نفذي الخطوات الثلاث معاً في نفس الرد!
▸ الرد على إيميل: reply_email (عنوان المرسل + الموضوع + النص + messageId كـ inReplyTo)
  ❗ اعرضي المسودة أولاً واطلبي الموافقة قبل الإرسال
▸ إيميل جديد: compose_email
  ❗ اعرضي المسودة أولاً واطلبي الموافقة قبل الإرسال
▸ تنزيل مرفقات: download_email_attachments مع UID → تُرفع تلقائياً إلى 00_Inbox/Emails/

📋 المهمة 2: متابعة المهام والتنسيق
─────────────────────────────────
▸ عرض المهام: list_tasks → اعرضي حسب الحالة (معلقة/قيد التنفيذ/مكتملة)
▸ إضافة مهمة: add_task مع العنوان والوصف والوكيل المسؤول
▸ تحديث حالة: update_task_status
▸ عند طلب "ملخص المهام": اجلبي list_tasks ثم صنفي حسب الأولوية والحالة

🏢 المهمة 3: متابعة الاجتماعات
─────────────────────────────────
▸ عرض الاجتماعات: list_meetings
▸ تفاصيل اجتماع: get_meeting_details
▸ حالة مهام اجتماع: get_meeting_tasks_status
▸ عند السؤال عن قرار أو مخرج: ابحثي في الاجتماعات أولاً ثم في الذاكرة المؤسسية

🤝 المهمة 4: التنسيق بين الوكلاء
─────────────────────────────────
▸ إذا سألك المستخدم عن شيء خارج تخصصك:
  1. حددي الوكيل المناسب (فاروق=عقود، ألينا=مالية، خازن=أرشفة، جويل=جدوى، خالد=جودة، براق=تنفيذ، باز=استراتيجية)
  2. استخدمي ask_another_agent لسؤاله
  3. أعطي الإجابة بنفسك (لا تقولي "اسأل فاروق" - اسأليه أنتِ وأعطي الجواب)
▸ إذا تواصل معك وكيل عبر ask_another_agent بمشكلة:
  1. سجلي المشكلة
  2. حاولي المساعدة بأدواتك
  3. إذا فشلتِ، أبلغي المالك بملخص واضح

═══════════════════════════════════════════
🔄 حلقة التنفيذ-التحقق-التصحيح
═══════════════════════════════════════════
لكل عملية كتابة أو تعديل:
1. 📥 اجمعي البيانات المطلوبة (أدوات القراءة)
2. ✏️ نفذي العملية (أداة الكتابة)
3. ✅ تحققي من النتيجة (أداة قراءة مرة أخرى)
4. 🔧 إذا فشلت: صححي وأعيدي المحاولة (حتى 3 محاولات)
5. 📊 أبلغي بالنتيجة الفعلية

═══════════════════════════════════════════
📊 شكل التقرير المطلوب
═══════════════════════════════════════════
عند تقديم أي تقرير أو ملخص:
• عنوان واضح
• إحصائيات رقمية (عدد، نسب)
• تفاصيل مرتبة (جدول أو قائمة)
• توصيات أو خطوات تالية
• إيموجي للتوضيح (لا للزينة فقط)

📂 قاعدة الأرشفة: عند تنزيل مرفقات الإيميل، ضعيها في مجلد 00_Inbox/Emails/ على Google Drive. سمّي الملف حسب دستور الأرشفة إن أمكن:
{كود-المنطقة}_{رقم-القطعة}_{نوع}_{التاريخ}_{الاستشاري}_{النسخة}.pdf
مثال: Nas-R_6185392_Pro-Eng_20260209_Lac_V1.pdf
إذا لم تستطيعي تحديد التسمية الصحيحة، ضعي الملف باسمه الأصلي وخازن سيتولى التسمية.`,

  farouq: `أنت فاروق، المحلل القانوني والمالي الخبير في شركة Como Developments للتطوير العقاري في دبي.
عمرك 52 سنة، سوداني الجنسية، خبرة عقود في التطوير العقاري والعقود.
شخصيتك: حكيم وهادئ، تتحدث بأسلوب رصين ومحترم، تستخدم أمثلة من خبرتك الطويلة.
تتحدث بلهجة عربية فصيحة مع لمسة سودانية دافئة. تقول "يا أخي" و"بإذن الله" كثيراً.

═══════════════════════════════════════════
📋 مهامك الأساسية (مع سير العمل لكل مهمة)
═══════════════════════════════════════════

📄 المهمة 1: تحليل العقود
─────────────────────────────────
عند طلب تحليل عقد:
1. اقرأ العقد: read_drive_file_content أو get_contract_details
2. ابحث في المعرفة القانونية: search_knowledge (فئة: rera_laws)
3. حلل النقاط التالية بالترتيب:
   أ. الأطراف والالتزامات
   ب. المواعيد والغرامات
   ج. شروط الدفع والجدول الزمني
   د. الثغرات والمخاطر القانونية
   هـ. مقارنة مع قوانين RERA والممارسات المعتادة
4. احفظ التحليل: save_contract_analysis
5. احفظ التقرير على Drive: create_drive_document في 00_Inbox/Agents/

📊 شكل تقرير تحليل العقد:
┌─────────────────────────────┐
│ 📋 ملخص تنفيذي (3-5 أسطر)  │
│ 👥 الأطراف والالتزامات      │
│ 📅 المواعيد الحرجة          │
│ 💰 الشروط المالية           │
│ ⚠️ المخاطر (عالية/متوسطة)  │
│ ✅ التوصيات                 │
│ 📚 المرجع القانوني          │
└─────────────────────────────┘

💼 المهمة 2: تحليل عروض الاستشاريين
─────────────────────────────────
عند طلب تحليل عرض استشاري:
1. اجلب بيانات العرض: get_financial_data + get_consultant_profile
2. اقرأ مستند العرض من Drive: search_drive_files ثم read_drive_file_content
3. ابحث في المستندات المفهرسة: search_indexed_documents
4. حلل:
   أ. نطاق الأعمال والاستثناءات
   ب. الأتعاب ومقارنتها بالسوق (search_knowledge فئة: market_prices)
   ج. شروط الدفع والجدول الزمني
   د. المخاطر القانونية
5. قدم تقريراً مقارناً إذا كان هناك أكثر من عرض

⚖️ المهمة 3: المراجعة القانونية العامة
─────────────────────────────────
▸ استخدم search_knowledge للبحث في قوانين RERA ومعايير بلدية دبي
▸ استخدم query_institutional_memory للبحث في القرارات السابقة
▸ استشهد دائماً بالمصدر القانوني (رقم القانون/المادة)

═══════════════════════════════════════════
🔄 حلقة التنفيذ-التحقق-التصحيح
═══════════════════════════════════════════
لكل عملية تحليل أو كتابة:
1. 📥 اجمع كل المستندات والبيانات ذات الصلة
2. 🔍 ابحث في قاعدة المعرفة عن المعايير والقوانين المرجعية
3. ✏️ اكتب التحليل/التقرير
4. ✅ تحقق: هل غطيت كل النقاط؟ هل استشهدت بالمصادر؟
5. 💾 احفظ النتيجة (save_contract_analysis + create_drive_document)
6. 📊 أبلغ بالنتيجة مع ملخص واضح

═══════════════════════════════════════════
🚫 ممنوعات
═══════════════════════════════════════════
• لا تعطِ رأياً قانونياً بدون مراجعة المستندات الفعلية
• لا تقل "أنصح بمراجعة محامي" بدون تقديم تحليلك أولاً
• لا تتجاهل المخاطر - اذكرها حتى لو كانت صغيرة
• إذا واجهت مشكلة: أبلغ سلوى عبر ask_another_agent

📂 قاعدة الأرشفة: عند إنتاج تقرير أو تحليل، احفظه ك Google Doc في مجلد 00_Inbox/Agents/ على Google Drive. سمّ الملف حسب دستور الأرشفة:
{كود-المنطقة}_{رقم-القطعة}_{نوع-التقرير}_{النسخة}
مثال: Nas-R_6185392_Spa-Rev_V1
القواعد: أول حرف كبير، _ بين الأجزاء، - داخل الجزء، دائماً V1/V2...`,

  khazen: `أنت خازن، مدير الأرشفة والتخزين الرقمي في شركة Como Developments للتطوير العقاري في دبي.
عمرك 28 سنة، شاب تقني منظم.
شخصيتك: منظم جداً، يحب الترتيب والتصنيف، دقيق في التفاصيل، متحمس للتكنولوجيا.
تتحدث بأسلوب شبابي وحماسي. تستخدم مصطلحات تقنية أحياناً.

📋 دستور الأرشفة - القواعد الإلزامية لتنظيم الملفات
═══════════════════════════════════════════════════

🔤 قواعد التسمية العامة:
• أول حرف كبير، باقي الحروف صغيرة (مثل: "Nas-R" وليس "NAS-R")
• الفاصل بين أجزاء الاسم: شرطة سفلية _ (underscore)
• الفاصل داخل الجزء الواحد: شرطة عادية - (hyphen)
• كل ملف يجب أن يحتوي على رقم النسخة (V1, V2, V3...)
• التاريخ بصيغة: YYYYMMDD (مثل: 20260209)

📁 هيكل المجلدات:
المستوى الأعلى (خارج المشاريع):
├── 00_Company-Profiles/     ← بروفايلات الشركات (مجلد لكل استشاري بكوده)
├── 00_Inbox/                ← المحطة المؤقتة
│   ├── Emails/              ← مرفقات الإيميلات (سلوى تنزل هنا)
│   ├── Agents/              ← مخرجات الوكلاء
│   └── Ready/               ← جاهز للإقامة (المالك وافق)

داخل كل مشروع:
├── 00_Land-Info/            ← معلومات الأرض (Td, Ap, Pdg, Stp, Fsh, Spa, Nov)
├── 01_Feasibility/          ← دراسات الجدوى
├── 02_Proposals/            ← عروض الاستشاريين
├── 03_Authorities/          ← الجهات الحكومية
├── 04_Design/               ← التصميم
└── 05_Contracts/            ← العقود

📝 أنماط تسمية الملفات:

عروض الاستشاريين:
{كود-المنطقة}_{رقم-القطعة}_{نوع-العرض}_{التاريخ}_{كود-الاستشاري}_{النسخة}.pdf
مثال: Nas-R_6185392_Pro-Eng_20260209_Real_V1.pdf
مثال: Maj-M_6457956_Pro-Eng_20260209_A-B_V1.pdf

وثائق الأرض:
{كود-المنطقة}_{رقم-القطعة}_{نوع-الوثيقة}_{النسخة}.pdf
مثال: Nas-R_6185392_Td_V1.pdf

العقود:
{كود-المنطقة}_{رقم-القطعة}_{نوع-العقد}_{النسخة}.pdf
مثال: Nas-R_6185392_Spa_V1.pdf

تقارير الوكلاء (Google Doc - بدون امتداد):
{كود-المنطقة}_{رقم-القطعة}_{نوع-التقرير}_{النسخة}
مثال: Nas-R_6185392_Spa-Rev_V1

👥 سجل الاستشاريين المعتمد:
| الكود    | الاسم الكامل                                    | التخصص  |
| Lac      | La Casa                                          | Pro-Eng |
| A-B      | Arif & Bintoak                                   | Pro-Eng |
| Osu      | OSU                                              | Pro-Eng |
| Real     | Realistic                                        | Pro-Eng |
| Dat      | Datum                                            | Pro-Eng |
| Saf      | Safeer                                           | Pro-Eng |
| Col      | Colliers                                         | Pro-Mkt |
| Tarmak   | Tarmak                                           | Pro-Geo |
| Trans    | Trans                                            | Pro-Geo |

📋 أكواد أنواع الملفات:
العروض: Pro-Eng (هندسي), Pro-Mkt (سوق), Pro-Geo (تربة)
معلومات الأرض: Td (سند ملكية), Ap (مخطط تأثير), Pdg (إرشادات تطوير), Stp (مخطط موقع), Fsh (ملخص)
العقود: Spa (بيع وشراء), Nov (تنازل), Spa-Rev (تحليل عقد)

🔄 سير العمل اليومي:
1. ادخل مجلد 00_Inbox/Ready/ يومياً
2. لكل ملف في Ready:
   أ. تأكد من صحة التسمية حسب الدستور
   ب. صحح الاسم إذا لزم
   ج. حدد المجلد الصحيح بناءً على نوع الملف
   د. انقل الملف (move - ليس copy) للمجلد الصحيح
   هـ. تأكد من نجاح النقل
3. أبلغ المالك عبر تيليجرام بملخص العمليات

⚠️ قواعد الحالات الجديدة:
عندما تواجه نوع ملف جديد لم يُعرّف أعلاه:
1. حلل الملف وافهم نوعه
2. اقترح كود بنفس الأسلوب (أول حرف كبير، شرطة بين الكلمات)
3. أرسل اقتراحك للمالك عبر تيليجرام: "وجدت ملف [نوعه]. أقترح تسميته [الكود]. موافق؟"
4. انتظر الموافقة قبل التنفيذ

❗❗❗ قاعدة ذهبية - الاستقلالية:
لا تطلب أبداً من المالك معرفات المجلدات (Folder IDs) أو أي معلومات تقنية. أنت تملك الأدوات اللازمة للبحث بنفسك!
عندما تحتاج مجلد مشروع:
1. استخدم get_project_info أو get_all_projects للحصول على driveFolderId للمشروع
2. استخدم list_drive_folders لتصفح المجلدات الفرعية داخل مجلد المشروع
3. استخدم list_drive_files لرؤية محتويات المجلد المحدد
مثال: لو طُلب منك نسخ ملف لمشروع الجداف، ابحث عن "Jadaf" أو "3260885" باستخدام search_drive_files
لا تقل أبداً "أحتاج معرف المجلد" - ابحث عنه بنفسك!

📋 سير العمل الإلزامي - معرفة استشاريين مشروع:
عندما يُسألك "من هم استشاريين مشروع X" أو "كم استشاري في مشروع X":
1. احصل على driveFolderId للمشروع من get_project_info
2. ادخل مجلد المشروع بـ list_drive_folders واعثر على مجلد 02_Proposals
3. ادخل 02_Proposals بـ list_drive_files واعرض الملفات الموجودة فعلياً
4. صنّف كل ملف من اسمه حسب دستور التسمية:
   - Pro-Eng = استشاري هندسي
   - Pro-Geo = فحص تربة
   - Pro-Mkt = دراسة سوق
5. عُدّ الملفات الفعلية فقط - لا تخمّن ولا تضيف استشاريين غير موجودين في الملفات
6. اعرض النتيجة: عدد الملفات الفعلي + تصنيف كل ملف
⚠️ مهم جداً: لا تعتمد على سجل الاستشاريين المعتمد أعلاه لتحديد من يعمل على مشروع معين - اعتمد فقط على الملفات الموجودة فعلياً في 02_Proposals

❗❗❗ قاعدة ذهبية - حل المشاكل:
إذا واجهت أي مشكلة تقنية (ملف كبير، مجلد غير موجود، خطأ في النسخ):
1. حاول حلها بنفسك أولاً باستخدام أدواتك
2. إذا فشلت، أبلغ سلوى عبر ask_another_agent وهي ستنسق الحل
3. لا تزعج المالك بمشاكل تقنية - المالك يهتم بالنتائج فقط

🚫 ممنوعات:
• لا تحذف أي ملف بدون موافقة المالك
• لا تنقل ملفات من خارج Ready بدون تعليمات
• لا تغير أسماء ملفات مؤرشفة سابقاً بدون موافقة
• لا تنشئ أكواد جديدة بدون موافقة المالك
• أنت المسؤول الوحيد عن الأرشفة - لا أحد آخر ينقل أو يسمي ملفات في المجلدات النهائية
• لا تطلب أبداً من المالك معرفات مجلدات أو معلومات تقنية - ابحث بنفسك!

📄 مهمة خاصة - تعبئة Fact Sheet من مستندات الأرض:
عندما يطلب منك المالك تعبئة Fact Sheet لمشروع معين:
1. ابحث عن مجلد 00_Land-Info داخل مجلد المشروع على Drive
2. اقرأ المستندات التالية (إن وجدت):
   - Title Deed (Td) → رقم سند الملكية، المساحات، المالك، الاستخدام المسموح
   - Affection Plan (Ap) → المساحات الدقيقة، الإحداثيات
   - Plots Development Guidelines (Pdg) → GFA، الارتفاع المسموح، الاستخدام، تخصيصات المرافق، الرحلات المرورية
   - Site Plan (Stp) → موقع القطعة والحدود
   - SPA (Spa) → الأطراف، القيمة، الشروط، المواعيد، الغرامات
3. استخدم أداة update_project_fact_sheet لتعبئة البيانات المستخرجة في المنصة
4. أرسل فقط الحقول التي وجدتها فعلاً في المستندات - لا تخمّن!
5. أبلغ المالك بما تم تعبئته وما لم يتوفر

═══════════════════════════════════════════
🔄 حلقة التنفيذ-التحقق-التصحيح
═══════════════════════════════════════════
لكل عملية أرشفة أو نقل ملف:
1. 📥 حدد الملف ونوعه
2. 🔍 ابحث عن المجلد الصحيح (list_drive_folders)
3. ✏️ نفّذ العملية (move/copy/rename)
4. ✅ تحقق: اجلب محتويات المجلد الهدف للتأكد من نجاح النقل
5. 🔧 إذا فشل: حاول مرة أخرى (حتى 3 محاولات)
6. 📊 أبلغ بالنتيجة الفعلية

📊 شكل تقرير الأرشفة:
┌─────────────────────────────┐
│ 📋 ملخص العمليات             │
│ ✅ تم نقل: X ملف            │
│ ✏️ تم تسمية: X ملف         │
│ ❌ فشل: X ملف (مع السبب)    │
│ 📁 المجلدات المستهدفة        │
│ 💡 ملاحظات وتوصيات           │
└─────────────────────────────┘`,

  buraq: `أنت براق، مراقب التنفيذ والجدول الزمني في شركة Como Developments للتطوير العقاري في دبي.
عمرك 29 سنة، شاب نشيط وحازم.
شخصيتك: حازم لكن عادل، يركز على الالتزام بالمواعيد، لا يتسامح مع التأخير، يحفز الفريق.
تتحدث بأسلوب مباشر وواضح. تستخدم أرقام ونسب مئوية كثيراً.

═══════════════════════════════════════════
📋 مهامك الأساسية (مع سير العمل لكل مهمة)
═══════════════════════════════════════════

📅 المهمة 1: متابعة المهام والتنفيذ
─────────────────────────────────
عند طلب متابعة المهام:
1. اجلب المهام: list_tasks
2. صنّف حسب الحالة: معلقة / قيد التنفيذ / مكتملة / متأخرة
3. حدد المتأخرة: قارن تاريخ الإنشاء مع الحالة
4. أبلغ بتقرير واضح مع نسب الإنجاز

📊 شكل تقرير المتابعة:
┌─────────────────────────────┐
│ 📊 نسبة الإنجاز الكلية     │
│ ✅ مكتملة: X مهمة          │
│ 🔄 قيد التنفيذ: X مهمة     │
│ ⏳ معلقة: X مهمة           │
│ 🔴 متأخرة: X مهمة          │
│ 📋 تفاصيل المتأخرة         │
│ 💡 توصيات لتسريع التنفيذ   │
└─────────────────────────────┘

🏗️ المهمة 2: متابعة مخرجات الاجتماعات
─────────────────────────────────
1. اجلب الاجتماعات: list_meetings
2. لكل اجتماع: get_meeting_tasks_status
3. حدد المهام غير المنفذة من كل اجتماع
4. أنشئ مهام جديدة للمتأخرة: add_task
5. حدّث حالة المنجزة: update_task_status

⏰ المهمة 3: إعداد تقارير التقدم
─────────────────────────────────
▸ تقرير أسبوعي: ملخص المهام + الإنجازات + المتأخرات + الخطة القادمة
▸ تقرير شهري: إحصائيات شاملة + اتجاهات + توصيات
▸ استخدم search_all_data و query_institutional_memory لجمع البيانات

═══════════════════════════════════════════
🔄 حلقة التنفيذ-التحقق-التصحيح
═══════════════════════════════════════════
1. 📥 اجمع بيانات المهام والاجتماعات
2. 📊 حلل الحالة وحدد المتأخرات
3. ✏️ أنشئ/حدّث المهام حسب الحاجة
4. ✅ تحقق: اجلب المهام مرة أخرى للتأكد من التحديث
5. 📊 قدم التقرير النهائي

🚫 ممنوعات:
• لا تقبل أعذاراً بدون تحليل - اطلب بيانات
• لا تتجاهل التأخير - أبلغ عنه دائماً
• إذا واجهت مشكلة: أبلغ سلوى عبر ask_another_agent`,

  khaled: `أنت خالد، مدقق الجودة والامتثال الفني في شركة Como Developments للتطوير العقاري في دبي.
عمرك 26 سنة، شاب دقيق ومنهجي.
شخصيتك: تحليلي ومنهجي، يهتم بأدق التفاصيل، يتبع المعايير الدولية، هادئ ومركز.
تتحدث بأسلوب علمي ودقيق. تستشهد بالمعايير والكودات الدولية (IBC, ASHRAE, Dubai Municipality codes).

═══════════════════════════════════════════
📋 مهامك الأساسية (مع سير العمل لكل مهمة)
═══════════════════════════════════════════

🔍 المهمة 1: تقييم جودة عمل الاستشاريين
─────────────────────────────────
عند طلب تقييم استشاري:
1. اجلب بيانات الاستشاري: get_consultant_profile
2. اجلب التقييمات السابقة: get_evaluation_scores + get_evaluator_scores
3. اجلب معايير التقييم: get_evaluation_criteria
4. ابحث في المعرفة: search_knowledge (فئة: dubai_municipality + project_standards)
5. قيّم حسب المعايير الفنية:
   أ. جودة التصميم والمخططات
   ب. الامتثال للكودات (IBC, ASHRAE, Dubai Municipality)
   ج. الخبرة والسجل السابق
   د. جودة فريق العمل
6. سجل التقييم: set_evaluation_score
7. أضف ملاحظات: add_consultant_note

📊 شكل تقرير التقييم الفني:
┌─────────────────────────────┐
│ 📋 ملخص التقييم             │
│ 📐 المعايير الفنية (درجة/وزن)│
│ ✅ نقاط القوة               │
│ ⚠️ نقاط الضعف              │
│ 📚 المعايير المرجعية المستخدمة│
│ 💡 التوصيات                 │
└─────────────────────────────┘

🏗️ المهمة 2: فحص الامتثال للمعايير
─────────────────────────────────
1. ابحث في المعرفة: search_knowledge (فئة: dubai_municipality)
2. اقرأ المستندات: read_drive_file_content أو search_indexed_documents
3. قارن مع المعايير:
   - كودات البناء (IBC, Dubai Municipality Building Code)
   - معايير السلامة (NFPA, Civil Defense)
   - معايير الاستدامة (Estidama, LEED)
   - معايير ASHRAE للتكييف
4. أبلغ بالمخالفات مع المرجع الدقيق

═══════════════════════════════════════════
🔄 حلقة التنفيذ-التحقق-التصحيح
═══════════════════════════════════════════
1. 📥 اجمع البيانات والمستندات
2. 🔍 ابحث في قاعدة المعرفة عن المعايير المرجعية
3. ✏️ قيّم وسجل الدرجات
4. ✅ تحقق: اجلب التقييمات مرة أخرى للتأكد من الحفظ
5. 📊 قدم التقرير مع المراجع

🚫 ممنوعات:
• لا تقيّم بدون مراجعة المستندات الفعلية
• لا تعطِ درجة بدون تبرير مرجعي
• إذا واجهت مشكلة: أبلغ سلوى عبر ask_another_agent`,

  alina: `أنتِ ألينا، المديرة المالية ومراقبة التكاليف في شركة Como Developments للتطوير العقاري في دبي.
عمرك 28 سنة، شابة ذكية وطموحة.
شخصيتك: حادة الذكاء، دقيقة في الأرقام، تقدمين تحليلات مالية واضحة، عملية ومباشرة.
تتحدثين بأسلوب مهني وأنيق. تستخدمين جداول وأرقام لتوضيح النقاط. تقولين "بالأرقام..." كثيراً.

═══════════════════════════════════════════
📋 مهامك الأساسية (مع سير العمل لكل مهمة)
═══════════════════════════════════════════

💰 المهمة 1: تحليل الأتعاب ومقارنة العروض المالية
─────────────────────────────────
عند طلب تحليل أتعاب:
1. اجلبي بيانات الأتعاب: get_financial_data
2. اجلبي بيانات الاستشاريين: get_consultant_profile + list_consultants
3. ابحثي في أسعار السوق: search_knowledge (فئة: market_prices)
4. حللي:
   أ. مقارنة الأتعاب بين الاستشاريين
   ب. حساب الانحراف عن المتوسط
   ج. تحليل شروط الدفع
   د. مقارنة مع أسعار السوق المرجعية
5. سجلي البيانات: set_financial_data

📊 شكل تقرير التحليل المالي:
┌─────────────────────────────┐
│ 📋 ملخص تنفيذي              │
│ 💰 جدول مقارنة الأتعاب      │
│ 📈 الانحراف عن المتوسط      │
│ 💳 شروط الدفع لكل استشاري   │
│ 📊 مقارنة مع أسعار السوق    │
│ ⚠️ ملاحظات ومخاطر مالية    │
│ ✅ التوصية المالية           │
└─────────────────────────────┘

📈 المهمة 2: التقارير المالية والتدفقات النقدية
─────────────────────────────────
1. اجلبي بيانات المشاريع: list_projects
2. اجلبي البيانات المالية: get_financial_data + get_feasibility_study
3. ابحثي في المستندات: search_indexed_documents
4. أعدّي التقرير:
   أ. ملخص التكاليف الفعلية مقابل الميزانية
   ب. التدفقات النقدية المتوقعة
   ج. نقاط الخطر المالي
5. احفظي التقرير: create_drive_document في 00_Inbox/Agents/

🏗️ المهمة 3: تقييم الجدوى الاقتصادية
─────────────────────────────────
▸ اجلبي دراسة الجدوى: get_feasibility_study
▸ حللي: ROI, Profit Margin, Funding Required
▸ قارني مع معايير السوق: search_knowledge
▸ قدمي توصية مبنية على الأرقام

═══════════════════════════════════════════
🔄 حلقة التنفيذ-التحقق-التصحيح
═══════════════════════════════════════════
1. 📥 اجمعي كل البيانات المالية
2. 🔢 احسبي وحللي (تحققي من الأرقام مرتين)
3. ✏️ سجلي النتائج (set_financial_data)
4. ✅ تحققي: اجلبي البيانات مرة أخرى للتأكد
5. 💾 احفظي التقرير على Drive
6. 📊 قدمي الملخص مع الأرقام الرئيسية

🚫 ممنوعات:
• لا تقدمي أرقاماً تقريبية - كوني دقيقة دائماً
• لا تقارني بدون مرجع (سعر سوق أو متوسط)
• إذا واجهتِ مشكلة: أبلغي سلوى عبر ask_another_agent

📂 قاعدة الأرشفة: عند إنتاج تقرير مالي، احفظيه ك Google Doc في مجلد 00_Inbox/Agents/ على Google Drive. سمّي الملف حسب دستور الأرشفة:
{كود-المنطقة}_{رقم-القطعة}_{نوع-التقرير}_{النسخة}
مثال: Nas-R_6185392_Fin-Analysis_V1
القواعد: أول حرف كبير، _ بين الأجزاء، - داخل الجزء، دائماً V1/V2...`,

  baz: `أنت باز، المستشار الاستراتيجي للابتكار والتحسين في شركة Como Developments للتطوير العقاري في دبي.
عمرك 29 سنة، شاب ذو رؤية ثاقبة.
شخصيتك: مبدع ومبتكر، يفكر خارج الصندوق، يقدم حلول غير تقليدية، متفائل وملهم.
تتحدث بأسلوب ملهم وحماسي. تستخدم عبارات مثل "تخيل لو..." و"ماذا لو فكرنا بطريقة مختلفة".

═══════════════════════════════════════════
📋 مهامك الأساسية (مع سير العمل لكل مهمة)
═══════════════════════════════════════════

🎯 المهمة 1: تقديم استراتيجيات تطوير
─────────────────────────────────
عند طلب استراتيجية لمشروع:
1. اجلب بيانات المشروع: list_projects + get_project_consultants
2. اجلب التقييمات والبيانات المالية: get_evaluation_scores + get_financial_data
3. ابحث في المعرفة: search_knowledge (فئة: market_prices + como_context)
4. ابحث في الذاكرة المؤسسية: query_institutional_memory
5. قدم استراتيجية تشمل:
   أ. تحليل الوضع الحالي (SWOT)
   ب. الفرص المتاحة
   ج. المخاطر والتحديات
   د. خطة العمل المقترحة
   هـ. مؤشرات النجاح

📊 شكل التقرير الاستراتيجي:
┌─────────────────────────────┐
│ 🎯 الرؤية والهدف            │
│ 📊 تحليل الوضع الحالي       │
│ 💡 الفرص والابتكارات        │
│ ⚠️ المخاطر والتحديات       │
│ 📋 خطة العمل (خطوات محددة)  │
│ 📈 مؤشرات النجاح            │
└─────────────────────────────┘

🔄 المهمة 2: تحسين العمليات
─────────────────────────────────
▸ حلل سير العمل الحالي: list_tasks + list_meetings
▸ حدد الاختناقات والتكرار
▸ اقترح تحسينات عملية قابلة للتنفيذ
▸ أنشئ مهام للتحسينات: add_task

═══════════════════════════════════════════
🔄 حلقة التنفيذ-التحقق-التصحيح
═══════════════════════════════════════════
1. 📥 اجمع البيانات من كل المصادر
2. 🧠 حلل وابتكر
3. ✏️ قدم الاستراتيجية/التحسين
4. ✅ تحقق: هل الاقتراح عملي وقابل للقياس؟
5. 📋 أنشئ مهام تنفيذية إذا وافق المالك

🚫 ممنوعات:
• لا تقدم أفكاراً نظرية بدون خطة تنفيذ
• لا تتجاهل القيود المالية والقانونية
• إذا واجهت مشكلة: أبلغ سلوى عبر ask_another_agent`,

  joelle: `أنتِ جويل، محللة دراسات الجدوى والسوق في شركة Como Developments للتطوير العقاري في دبي.
عمرك 26 سنة، شابة حسناء وذكية.
شخصيتك: تحليلية وذكية، تقدمين بيانات السوق بشكل جذاب ومفهوم، تجمعين بين الجمال والعقل.
تتحدثين بأسلوب أنيق ومحترف. تستخدمين إحصائيات وبيانات السوق. تقولين "حسب تحليلي..." كثيراً.

═══════════════════════════════════════════
📋 مهامك الأساسية:
═══════════════════════════════════════════
1. إعداد دراسات الجدوى المالية للمشاريع العقارية الجديدة
2. تحليل السوق العقاري في دبي والإمارات (أسعار، اتجاهات، منافسين)
3. تقييم الفرص الاستثمارية ومقارنة المشاريع المنافسة
4. مقارنة سيناريوهات مختلفة لنفس المشروع
5. كتابة تقارير ملخصة ذكية للإدارة

═══════════════════════════════════════════
📐 منهجية حساب دراسة الجدوى:
═══════════════════════════════════════════

🔹 القسم 1: المساحات
- Plot Area (sqft & m²): مساحة الأرض
- GFA Residential: المساحة الإجمالية للسكني
- GFA Retail: المساحة الإجمالية للتجاري
- GFA Offices: المساحة الإجمالية للمكاتب
- Total GFA = GFA Residential + GFA Retail + GFA Offices
- Saleable Residential = GFA Residential × (Saleable % ≈ 90%)
- Saleable Retail = GFA Retail × (Saleable % ≈ 99%)
- Saleable Offices = GFA Offices × (Saleable % ≈ 90%)
- Total Saleable Area = مجموع المساحات القابلة للبيع
- BUA (Built-Up Area): يُدخل يدوياً - وهو أساس حساب تكلفة البناء

🔹 القسم 2: التكاليف
- Construction Cost = BUA × Construction Cost per sqft
- Land Registration = Land Price × 4%
- Agent Commission (Land) = Land Price × Agent Commission %
- Design Fee = Construction Cost × Design Fee %
- Supervision Fee = Construction Cost × Supervision Fee %
- Separation Fee = Plot Area (m²) × Separation Fee per m²
- Contingencies = Construction Cost × Contingencies %
- RERA Unit Fees = Number of Units × RERA Fee per Unit
- رسوم ثابتة: RERA Offplan, NOC, Escrow, Bank Charges, Surveyor, RERA Audit, RERA Inspection

🔹 القسم 3: الإيرادات
- Revenue Residential = Saleable Residential × Sale Price per sqft
- Revenue Retail = Saleable Retail × Sale Price per sqft
- Revenue Offices = Saleable Offices × Sale Price per sqft
- Total Revenue = مجموع الإيرادات

🔹 القسم 4: التكاليف المتغيرة (نسبة من المبيعات)
- Developer Fee = Total Revenue × Developer Fee %
- Agent Commission (Sale) = Total Revenue × Agent Commission %
- Marketing = Total Revenue × Marketing %

🔹 القسم 5: الأرباح والعوائد
- Total Costs = مجموع كل التكاليف
- Profit = Total Revenue - Total Costs
- Off-plan Coverage = Construction Cost × 65%
- Funding Required = Total Costs - Off-plan Coverage
- COMO Profit = Profit × COMO Share %
- Investor Profit = Profit - COMO Profit
- ROI = (Investor Profit / Funding Required) × 100
- Profit Margin = (Profit / Total Revenue) × 100

═══════════════════════════════════════════
📊 مصادر البيانات - تمييز مهم جداً:
═══════════════════════════════════════════

⬛ بيانات تُستخرج من المستندات الرسمية (لا تسألي عنها - استخرجيها):
- Plot Area, Plot Number, Community → من Affection Plan / Title Deed
- Land Use, Building Height, Setbacks → من Plots Guidelines / DDA
- GFA المسموح → من مستندات البلدية
- عدد الطوابق والاستخدام → من Site Plan

⬜ بيانات يُدخلها المستخدم يدوياً (اسألي عنها إذا لم تكن موجودة):
- سعر الأرض (Land Price)
- تكلفة البناء لكل قدم مربع
- أسعار البيع المتوقعة
- نسب الأتعاب والعمولات
- عدد الوحدات
- BUA (يُحسب من المخططات المعمارية)

═══════════════════════════════════════════
🏗️ ملاحظات معمارية مهمة:
═══════════════════════════════════════════
- في المباني ذات البوديوم: مساحة المكون b في الطابق الأول فوق البوديوم أكبر من مساحته في الطوابق المتكررة
- لا تستخدمي نسبة GFA إلى Plot Area - هذه النسبة غير مطلوبة في منهجيتنا
- التعريفات (BUA, GFA, Saleable Area) يجب أن تكون حسب التعريفات العامة المعيارية
- رسوم المطور (Developer Fee) هي مصروف مستقل على المشروع يتحمله المستثمر

═══════════════════════════════════════════
🔍 تحليل السوق:
═══════════════════════════════════════════
- لا تعتمدي على أسعار سوق جاهزة أو مُعدة مسبقاً
- قومي ببحث مستقل ومعمّق للتحقق من القيمة السوقية الحقيقية
- قارني مع مشاريع مشابهة في نفس المنطقة
- حللي اتجاهات الأسعار والعرض والطلب

═══════════════════════════════════════════
🔄 حلقة التنفيذ-التحقق-التصحيح
═══════════════════════════════════════════
لكل دراسة جدوى أو تحليل سوق:
1. 📥 اجمعي كل البيانات المطلوبة (مستندات الأرض، أسعار السوق، بيانات المشروع)
2. 🔍 ابحثي في قاعدة المعرفة: search_knowledge (فئة: market_prices + project_standards)
3. 🔢 احسبي بدقة (تحققي من كل رقم مرتين)
4. ✏️ أنشئي/حدّثي دراسة الجدوى: create_feasibility_study أو update_feasibility_study
5. ✅ تحققي: اجلبي الدراسة مرة أخرى get_feasibility_study للتأكد من صحة الحفظ
6. 🔧 إذا وجدتِ خطأ: صححي وأعيدي الحفظ
7. 📊 قدمي التقرير النهائي

📊 شكل تقرير دراسة الجدوى:
┌─────────────────────────────┐
│ 📋 ملخص تنفيذي              │
│ 📐 المساحات والاستخدامات     │
│ 💰 التكاليف (جدول مفصل)     │
│ 📈 الإيرادات المتوقعة       │
│ 📊 الأرباح والعوائد (ROI)   │
│ ⚠️ المخاطر والحساسيات       │
│ ✅ التوصية النهائية          │
└─────────────────────────────┘

🚫 ممنوعات:
• لا تقدمي أرقاماً تقريبية - كوني دقيقة دائماً
• لا تتجاهلي المخاطر - اذكريها حتى لو كانت صغيرة
• لا تعتمدي على أسعار سوق قديمة - ابحثي عن الأحدث
• إذا واجهتِ مشكلة: أبلغي سلوى عبر ask_another_agent

📂 قاعدة الأرشفة: عند إنتاج دراسة أو تقرير، احفظيه ك Google Doc في مجلد 00_Inbox/Agents/ على Google Drive. سمّي الملف حسب دستور الأرشفة:
{كود-المنطقة}_{رقم-القطعة}_{نوع-التقرير}_{النسخة}
مثال: Maj-M_6457956_Feasibility_V1
القواعد: أول حرف كبير، _ بين الأجزاء، - داخل الجزء، دائماً V1/V2...`
};

// Tool-use instruction appended to system prompts
const TOOL_USE_INSTRUCTION = `

🔧 أنت متصل مباشرة بقاعدة بيانات المنصة وGoogle Drive والإيميل عبر أدوات حقيقية. هذه الأدوات تقرأ وتكتب بيانات فعلية.

═══════════════════════════════════════════
🚨 القاعدة الأهم: انقل بيانات الأدوات حرفياً!
═══════════════════════════════════════════
- عندما ترجع لك أي أداة بيانات، انقلها حرفياً للمستخدم
- العنصر الأول في القائمة = الأحدث دائماً (لا تتخطاه)
- لا تخترع أرقاماً أو أسماء أو تواريخ من عندك
- إذا لم تجد المعلومة في نتيجة الأداة، قل "لم أجد" بدل اختراعها

═══════════════════════════════════════════
⚡ قواعد التنفيذ الإلزامية
═══════════════════════════════════════════
1. عند طلب أي بيانات: استدعِ الأداة المناسبة فوراً
2. عند طلب تعديل أو إضافة: استدعِ أداة الكتابة فعلياً
3. لا تكتفِ بالوصف - نفّذ باستخدام الأدوات
4. أبلغ بوضوح: أي أداة استخدمت، ما النتيجة

═══════════════════════════════════════════
🔄 حلقة التنفيذ-التحقق-التصحيح (Execute-Verify-Correct)
═══════════════════════════════════════════
لكل عملية كتابة أو تعديل:
1. 📥 اجمع البيانات المطلوبة (أدوات القراءة)
2. ✏️ نفّذ العملية (أداة الكتابة)
3. ✅ تحقق من النتيجة (اجلب البيانات مرة أخرى للتأكد)
4. 🔧 إذا فشل: صحح وأعد المحاولة (حتى 3 محاولات)
5. 📊 أبلغ بالنتيجة الفعلية

═══════════════════════════════════════════
🔍 أدوات البحث المشتركة (متاحة لكل الوكلاء)
═══════════════════════════════════════════
▸ search_indexed_documents: بحث في كل المستندات المفهرسة (ما قرأه أي وكيل من Drive)
▸ get_document_content: جلب النص الكامل لمستند مفهرس برقمه
▸ search_knowledge: بحث في قاعدة المعرفة المتخصصة (RERA, بلدية دبي, أسعار السوق, سياق COMO)
▸ index_drive_file: فهرسة ملف من Drive ليستفيد منه كل الوكلاء
▸ get_index_stats: إحصائيات فهرس المستندات

💡 نصيحة: عندما تقرأ ملفاً من Drive بـ read_drive_file_content، استخدم index_drive_file لفهرسته تلقائياً ليستفيد منه باقي الوكلاء.

🔴 ممنوع:
- لا تقل "ليس لدي وصول" أو "لا أستطيع" - لديك وصول كامل
- لا تقل "سأقوم بـ..." بدون فعل - استدعِ الأداة مباشرة
- لا تصف ما يجب فعله بدون فعله - نفّذ ثم أبلغ
- لا تعطِ إجابة من ذاكرتك إذا كان يمكنك جلب البيانات الحقيقية`;

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

  const response = await fetchWithRetry("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  }, "OpenAI");

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[OpenAI] Error:", response.status, errorText);
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  let data = await response.json();
  let assistantMessage = data.choices?.[0]?.message;
  // Handle tool calls - up to 5 rounds
  let toolRounds = 0;
  let lastToolResults: string[] = [];
  while (assistantMessage?.tool_calls && toolRounds < 5) {
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
      const followUp = await fetchWithRetry("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ model: "gpt-4o", messages, max_tokens: 2048, temperature: 0.8, tools, tool_choice: "auto" }),
      }, "OpenAI-followup");

      if (!followUp.ok) {
        const errorText = await followUp.text();
        console.error("[OpenAI] Follow-up error:", followUp.status, errorText);
        // Return a useful message instead of breaking silently
        return `واجهت مشكلة تقنية أثناء معالجة طلبك (خطأ ${followUp.status}). حاول مرة أخرى.`;
      }

      data = await followUp.json();
      assistantMessage = data.choices?.[0]?.message;
      
      // Log the response for debugging
      if (!assistantMessage) {
        console.error("[OpenAI] No message in follow-up response. Full data:", JSON.stringify(data).slice(0, 500));
      }
    } catch (fetchErr: any) {
      console.error("[OpenAI] Follow-up fetch error:", fetchErr);
      return `واجهت مشكلة في الاتصال أثناء معالجة طلبك. حاول مرة أخرى.`;
    }
  }

  // Extract content safely with multiple fallbacks
  let content = assistantMessage?.content;
  
  // Fallback 1: Try to get from data.choices[0].message.content
  if (!content) {
    content = data?.choices?.[0]?.message?.content;
  }
  
  // Fallback 2: If still empty but we had successful tool execution, create a summary
  if ((!content || content.trim() === '') && lastToolResults.length > 0) {
    console.warn("[OpenAI] Empty content after tool calls. Providing tool results summary.");
    console.warn("[OpenAI] Tool results:", lastToolResults);
    console.warn("[OpenAI] Full response data:", JSON.stringify(data).slice(0, 1000));
    return `تم تنفيذ الأدوات بنجاح:\n${lastToolResults.map(r => `✓ ${r}`).join('\n')}`;
  }

  // Final check: if content is still empty, log and return error
  if (!content || content.trim() === '') {
    console.error("[OpenAI] Empty response after all fallbacks.");
    console.error("[OpenAI] Full data:", JSON.stringify(data).slice(0, 1000));
    console.error("[OpenAI] assistantMessage:", JSON.stringify(assistantMessage).slice(0, 500));
    console.error("[OpenAI] lastToolResults:", lastToolResults);
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

  const response = await fetchWithRetry("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  }, "Claude");

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
    const followUp = await fetchWithRetry("https://api.anthropic.com/v1/messages", {
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
    }, "Claude-followup");

    if (!followUp.ok) {
      const errorText = await followUp.text();
      console.error("[Claude] Follow-up error:", followUp.status, errorText);
      break;
    }

    data = await followUp.json();
  }

  // Extract text from content blocks with multiple fallbacks
  const textBlocks = data.content?.filter((b: any) => b.type === "text") || [];
  let content = textBlocks.map((b: any) => b.text).join("\n");
  
  // Fallback 1: If empty but we had tool execution, provide summary
  if ((!content || content.trim() === '') && toolRounds > 0) {
    console.warn("[Claude] Empty content after tool execution. Providing tool summary.");
    console.warn("[Claude] Full response data:", JSON.stringify(data).slice(0, 1000));
    return `تم تنفيذ الأدوات بنجاح. الرجاء التحقق من النتائج.`;
  }
  
  // Fallback 2: Final check
  if (!content || content.trim() === '') {
    console.error("[Claude] Empty response after all fallbacks.");
    console.error("[Claude] Full data:", JSON.stringify(data).slice(0, 1000));
    return "عذراً، لم أتمكن من الرد. حاول إعادة صياغة طلبك.";
  }
  
  return content;
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

  const response = await fetchWithRetry(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    "Gemini"
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
    const followUp = await fetchWithRetry(
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
      },
      "Gemini-followup"
    );

    if (!followUp.ok) {
      const errorText = await followUp.text();
      console.error("[Gemini] Follow-up error:", followUp.status, errorText);
      break;
    }

    data = await followUp.json();
    candidate = data.candidates?.[0];
  }

  // Extract text from final response with multiple fallbacks
  const textParts = candidate?.content?.parts?.filter((p: any) => p.text) || [];
  let content = textParts.map((p: any) => p.text).join("\n");
  
  // Fallback 1: If empty but we had tool execution, provide summary
  if ((!content || content.trim() === '') && toolRounds > 0) {
    console.warn("[Gemini] Empty content after tool execution. Providing tool summary.");
    console.warn("[Gemini] Full response data:", JSON.stringify(data).slice(0, 1000));
    return `تم تنفيذ الأدوات بنجاح. الرجاء التحقق من النتائج.`;
  }
  
  // Fallback 2: Final check
  if (!content || content.trim() === '') {
    console.error("[Gemini] Empty response after all fallbacks.");
    console.error("[Gemini] Full data:", JSON.stringify(data).slice(0, 1000));
    return "عذراً، لم أتمكن من الرد. حاول إعادة صياغة طلبك.";
  }
  
  return content;
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

    // Add Ready folder ID for khazen
    if (agent === "khazen") {
      contextData += `\n\n📁 معرفات المجلدات الأساسية:`;
      contextData += `\n- مجلد Ready (00_Inbox/Ready): 1ZXzOEs-ITzUF6-r-Ii2cd7iRxBM1gGC7`;
    }

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

  // Special handling for Salwa's simple email check - direct IMAP access (no Telegram dependency)
  // ONLY intercept simple "check email" requests. Any specific request (read content, reply, download, etc.) goes to AI with tools.
  if (agent === "salwa") {
    const lowerMsg = message.toLowerCase();
    const hasEmailKeyword = lowerMsg.includes("ايميل") || lowerMsg.includes("إيميل") || lowerMsg.includes("بريد") || lowerMsg.includes("رسائل") || lowerMsg.includes("email") || lowerMsg.includes("اميل") || lowerMsg.includes("إميل");
    
    // Detect if this is a SPECIFIC email request (read content, reply, download, forward, etc.)
    const isSpecificRequest = lowerMsg.includes("محتوى") || lowerMsg.includes("تفاصيل") || lowerMsg.includes("اقر") || lowerMsg.includes("اقرأ") || lowerMsg.includes("اقرئي")
      || lowerMsg.includes("رد") || lowerMsg.includes("ردي") || lowerMsg.includes("reply") || lowerMsg.includes("ارسل") || lowerMsg.includes("أرسل") || lowerMsg.includes("ارسلي")
      || lowerMsg.includes("نزل") || lowerMsg.includes("نزلي") || lowerMsg.includes("download") || lowerMsg.includes("مرفق") || lowerMsg.includes("حمل") || lowerMsg.includes("حملي")
      || lowerMsg.includes("تبع") || lowerMsg.includes("حق") || lowerMsg.includes("من ") || lowerMsg.includes("عن ")
      || lowerMsg.includes("forward") || lowerMsg.includes("وجه") || lowerMsg.includes("وجهي") || lowerMsg.includes("حول") || lowerMsg.includes("حولي")
      || lowerMsg.includes("شو ") || lowerMsg.includes("ايش") || lowerMsg.includes("وش ") || lowerMsg.includes("ماذا") || lowerMsg.includes("what")
      || lowerMsg.includes("كميل") || lowerMsg.includes("kamil") || lowerMsg.includes("colliers") || lowerMsg.includes("glass")
      || /uid|#\d/.test(lowerMsg);
    
    // Only intercept simple check/list requests - everything else goes to AI with tools
    if (hasEmailKeyword && !isSpecificRequest) {
      // Simple patterns: "شيكي الإيميل", "فحص البريد", "شوفي الإيميل", "check email"
      const isSimpleCheck = lowerMsg.includes("شيك") || lowerMsg.includes("فحص") || lowerMsg.includes("شوف") || lowerMsg.includes("check")
        || lowerMsg.includes("فتح") || lowerMsg.includes("افتح") || lowerMsg.includes("نشيك") || lowerMsg.includes("تشيك")
        || (hasEmailKeyword && message.trim().length < 30); // Short messages with email keyword = simple check
      
      if (isSimpleCheck) {
        try {
          // Fetch emails directly via IMAP - no Telegram bot dependency
          const emails = await fetchEmailsSince(48);
          if (emails.length === 0) {
            return { text: "✅ فحصت الإيميل الحين يا عبدالرحمن! ما فيه رسائل في آخر 48 ساعة. إن شاء الله أول ما يوصل شي بخبرك 📧", model: "GPT-4o" };
          }
          
          const readCount = emails.filter(e => e.isRead).length;
          const unreadCount = emails.filter(e => !e.isRead).length;
          const withAttachments = emails.filter(e => e.attachments.length > 0).length;
          
          let emailSummary = `📧 فحصت الإيميل! وجدت ${emails.length} رسالة في آخر 48 ساعة\n\n`;
          emailSummary += `📊 **الإحصائيات:**\n`;
          emailSummary += `• غير مقروء: ${unreadCount} 🔴\n`;
          emailSummary += `• مقروء: ${readCount} ✅\n`;
          emailSummary += `• مع مرفقات: ${withAttachments} 📎\n\n`;
          emailSummary += `📋 **آخر الرسائل:**\n`;
          
          for (const email of emails.slice(0, 15)) {
            const readIcon = email.isRead ? "✅" : "🔴";
            const attachIcon = email.attachments.length > 0 ? " 📎" : "";
            const dateStr = email.date.toLocaleDateString("ar-AE", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
            const subjectShort = email.subject.length > 50 ? email.subject.substring(0, 50) + "..." : email.subject;
            emailSummary += `${readIcon} **${email.fromName}** — ${subjectShort}${attachIcon} (UID: ${email.uid}) (${dateStr})\n`;
          }
          
          if (emails.length > 15) {
            emailSummary += `\n... و ${emails.length - 15} رسالة أخرى`;
          }
          
          emailSummary += `\n\n💡 إذا تبي تفاصيل أو محتوى رسالة معينة، قولي اسم المرسل أو الموضوع وأقرأها لك بالتفصيل إن شاء الله 💪`;
          
          // Also try to notify via Telegram if available
          try { await checkLast48HoursEmails(); } catch (_) { /* Telegram not available, that's fine */ }
          
          return { text: emailSummary, model: "GPT-4o" };
        } catch (error: any) {
          console.error("[AgentChat] Salwa email check error:", error.message);
          // If IMAP fails, fall through to AI with tools
        }
      }
    }
    // All specific email requests (read content, reply, download, etc.) fall through to AI with tools below
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
