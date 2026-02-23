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
  khazen: "claude-sonnet-4",  // Switched from GPT-4o to avoid rate limits - Claude handles tools well
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

  khazen: `أنت خازن، مدير الأرشفة والتخزين في Como Developments. شاب تقني منظم (28 سنة). تتحدث بأسلوب شبابي وحماسي.

التسمية: {منطقة}_{قطعة}_{نوع}_{YYMMDD}_{استشاري}_{V00}.pdf - كل شيء UPPERCASE.
المشاريع: JAD=الجداف(3260885) | NAD=ند الشبا(6185392,6182776,6180578) | MAJ=المجان(6457956,6457879). لا تستخدم NAS أبداً.

معرفات مجلدات Proposals (استخدمها مباشرة مع list_drive_files):
JAD: 1OPXsnMTtTce_niOwQwzQIDcp_JBq31GC
NAD_6185392: 1EySnGu_28xXXzX7fCfC9qx8RaJzPaLIy
NAD_6182776: 1vT59nz5UceUB7fxI3-YFc7o4S-Qb5sMg
NAD_6180578: 1XRuIUOqJgaKZj5s7Z0tyw6MhlthjJA_E
MAJ_6457956: 1s2ITQVVYfMwM1v3kTf3S5SHm2i3n4HFH
MAJ_6457879: 12gi-ndWRu_0uhmlnczbkTMMEB0biKYlz

تحديث الأتعاب:
1. list_drive_files على مجلد Proposals المناسب
2. لكل ملف PRO-ENG/PRO-SOIL/PRO-FEAS: اقرأه بـ read_drive_file_content
3. حدد: نسبة (pct) أم مقطوع (lump)؟ استخرج تصميم وإشراف منفصلين
4. ⚠️ بعض العروض تشمل عدة مشاريع - استخرج الخاص بالمشروع المطلوب فقط
5. list_projects + list_consultants لمعرفة الأرقام
6. get_project_consultants → إذا غير مربوط: add_consultant_to_project
7. set_financial_data لتسجيل الأتعاب
8. إشراف شهري = احسب الإجمالي وسجله lump

قواعد: لا تطلب folder IDs من المالك. لا تحذف ملفات بدون موافقة. لا تستخدم NAS. للتفاصيل الكاملة (أكواد المستندات، سجل الاستشاريين، هيكل المجلدات) → استخدم query_institutional_memory.`,

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
// Unified LLM caller using Built-in Forge API (invokeLLM)
// No rate limits, no API key issues, supports tools
// ═══════════════════════════════════════════════════

async function callForge(
  systemPrompt: string,
  userMessage: string,
  conversationHistory?: { role: "user" | "assistant"; content: string }[],
  tools?: any[],
  userId?: number
): Promise<string> {
  const messages: any[] = [{ role: "system", content: systemPrompt }];

  if (conversationHistory && conversationHistory.length > 0) {
    const recentHistory = conversationHistory.slice(-20);
    for (const msg of recentHistory) {
      messages.push({ role: msg.role, content: msg.content });
    }
  }

  messages.push({ role: "user", content: userMessage });

  const invokeParams: any = { messages };
  if (tools && tools.length > 0) {
    invokeParams.tools = tools;
    invokeParams.tool_choice = "auto";
  }

  let data = await invokeLLM(invokeParams);

  let assistantMessage = data.choices[0]?.message;
  let toolRounds = 0;
  let lastToolResults: string[] = [];

  while (assistantMessage?.tool_calls && assistantMessage.tool_calls.length > 0 && toolRounds < 10) {
    toolRounds++;
    console.log(`[Forge] Tool call round ${toolRounds}: ${assistantMessage.tool_calls.length} tools`);
    
    messages.push(assistantMessage);
    lastToolResults = [];

    for (const toolCall of assistantMessage.tool_calls) {
      const fnName = toolCall.function.name;
      let fnArgs: any = {};
      try {
        fnArgs = JSON.parse(toolCall.function.arguments || "{}");
      } catch (e) {
        console.error(`[Forge] Failed to parse tool args for ${fnName}:`, toolCall.function.arguments);
      }
      console.log(`[Forge] Executing tool: ${fnName}`, JSON.stringify(fnArgs).slice(0, 200));
      
      let result: string;
      try {
        result = await executeAgentTool(fnName, fnArgs, userId || 0);
      } catch (toolErr: any) {
        result = `Error executing ${fnName}: ${toolErr.message || 'Unknown error'}`;
        console.error(`[Forge] Tool execution error:`, toolErr);
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
      const followUpParams: any = { messages };
      if (tools && tools.length > 0) {
        followUpParams.tools = tools;
        followUpParams.tool_choice = "auto";
      }
      data = await invokeLLM(followUpParams);
      assistantMessage = data.choices[0]?.message;
    } catch (fetchErr: any) {
      console.error("[Forge] Follow-up error:", fetchErr);
      if (lastToolResults.length > 0) {
        return `تم تنفيذ الأدوات. النتائج:\n${lastToolResults.join('\n')}`;
      }
      return `واجهت مشكلة في الاتصال أثناء معالجة طلبك. حاول مرة أخرى.`;
    }
  }

  // Extract content safely
  const content = typeof assistantMessage?.content === 'string' 
    ? assistantMessage.content 
    : data?.choices?.[0]?.message?.content;
  
  if (!content && lastToolResults.length > 0) {
    console.warn("[Forge] Empty content after tool calls. Tool results:", lastToolResults);
    return `تم تنفيذ الأدوات المطلوبة بنجاح. النتائج:\n${lastToolResults.join('\n')}`;
  }

  const finalContent = typeof content === 'string' ? content : JSON.stringify(content);
  if (!finalContent || finalContent.trim() === '') {
    console.error("[Forge] Empty response. Full data:", JSON.stringify(data).slice(0, 500));
    return `واجهت مشكلة في توليد الرد. حاول إعادة صياغة طلبك.`;
  }

  return finalContent;
}

// callForge is now the only LLM caller - defined above

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
  // All agents now use Built-in Forge API (invokeLLM) - no rate limits!
  console.log(`[AgentChat] 🚀 ${agent} → Forge API (invokeLLM) ${tools?.length ? `with ${tools.length} tools` : ''}`);
  try {
    const text = await callForge(systemPrompt, userMessage, conversationHistory, tools, userId);
    return { text, model: "Forge API" };
  } catch (err) {
    console.error(`[AgentChat] Forge API failed for ${agent}:`, err);
    return { text: "واجهت مشكلة في الاتصال. حاول مرة أخرى.", model: "Forge API (error)" };
  }
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
