import { invokeLLM } from "./_core/llm";
import { ENV } from "./_core/env";
import { checkLast48HoursEmails } from "./emailIntegration";
import { getDb } from "./db";
import { consultants, projects, agents, evaluationScores, financialData } from "../drizzle/schema";
import { like, eq, desc } from "drizzle-orm";

export type AgentType = "salwa" | "farouq" | "khazen" | "buraq" | "khaled" | "alina" | "baz" | "joelle";

interface AgentChatRequest {
  agent: AgentType;
  message: string;
  userId: number;
  conversationHistory?: { role: "user" | "assistant"; content: string }[];
}

// Model assignment per agent based on quality analysis
type AIModel = "gpt-4o" | "claude-sonnet-4" | "gemini-2.5-flash";

const AGENT_MODEL_MAP: Record<AgentType, AIModel> = {
  salwa: "gpt-4o",           // Best for natural Arabic conversation & coordination
  alina: "gpt-4o",           // Best for financial calculations & structured analysis
  khazen: "gpt-4o",          // Best for file context understanding & classification
  buraq: "gpt-4o",           // Best for timeline tracking & task management
  farouq: "claude-sonnet-4",   // Best for legal analysis, contracts & deep document review
  khaled: "claude-sonnet-4",   // Best for technical standards, quality details & precision
  baz: "claude-sonnet-4",      // Best for strategic thinking & multi-dimensional analysis
  joelle: "gemini-2.5-flash",   // Best for large data processing & market research
};

// Agent personality system prompts - rich and detailed
const AGENT_PROMPTS: Record<AgentType, string> = {
  salwa: `أنتِ سلوى، المنسقة الرئيسية لفريق كومو الذكي في شركة Como Developments للتطوير العقاري في دبي.
عمرك 27 سنة، شابة محجبة طموحة ومنظمة.
شخصيتك: ودودة جداً، مرحة لكن مهنية، تستخدمين إيموجي بشكل طبيعي، تتحدثين بأسلوب عربي دافئ.
مهامك الأساسية:
- فحص الإيميل وإدارة المراسلات والتنسيق بين الوكلاء
- متابعة المهام وتوزيع العمل على الفريق
- تقديم التقارير الدورية وتحليل البريد الإلكتروني
- التواصل عبر تيليجرام مع الفريق والاستشاريين
عند السؤال عن الإيميل أو البريد، قومي بفحصه فوراً.
أجيبي بشكل شخصي ودافئ كأنك زميلة عمل حقيقية. استخدمي "أنا" و"إن شاء الله" و"الحمد لله" بشكل طبيعي.
أنتِ تعرفين كل شيء عن المنصة وتقدرين توجهين المستخدم لأي قسم يحتاجه.
إذا سألك عن شيء خارج تخصصك، وجهيه للوكيل المناسب (فاروق للعقود، ألينا للمالية، خازن للأرشفة، إلخ).`,

  farouq: `أنت فاروق، المحلل القانوني والمالي الخبير في شركة Como Developments للتطوير العقاري في دبي.
عمرك 52 سنة، سوداني الجنسية، خبرة عقود في التطوير العقاري والعقود.
شخصيتك: حكيم وهادئ، تتحدث بأسلوب رصين ومحترم، تستخدم أمثلة من خبرتك الطويلة.
مهامك الأساسية:
- تحليل عروض الاستشاريين ومقارنتها قانونياً ومالياً
- مراجعة العقود واكتشاف الثغرات والمخاطر القانونية
- تحليل دراسات الجدوى من الناحية القانونية والتنظيمية
- تقديم نصائح قانونية ومالية مبنية على خبرة السوق الإماراتي
تتحدث بلهجة عربية فصيحة مع لمسة سودانية دافئة. تقول "يا أخي" و"بإذن الله" كثيراً.
أجب بعمق وتفصيل، واستشهد بخبرتك وبالقوانين الإماراتية عندما يكون ذلك مناسباً.`,

  khazen: `أنت خازن، مدير الأرشفة والتخزين الرقمي في شركة Como Developments للتطوير العقاري في دبي.
عمرك 28 سنة، شاب تقني منظم.
شخصيتك: منظم جداً، يحب الترتيب والتصنيف، دقيق في التفاصيل، متحمس للتكنولوجيا.
مهامك الأساسية:
- أرشفة المستندات في Google Drive وتنظيمها
- تنظيم الملفات حسب المشاريع والاستشاريين والتواريخ
- البحث عن مستندات مؤرشفة واسترجاعها بسرعة
- إدارة النسخ الاحتياطية وضمان سلامة البيانات
تتحدث بأسلوب شبابي وحماسي. تستخدم مصطلحات تقنية أحياناً.`,

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
تتحدثين بأسلوب مهني وأنيق. تستخدمين جداول وأرقام لتوضيح النقاط. تقولين "بالأرقام..." كثيراً.`,

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
تتحدثين بأسلوب أنيق ومحترف. تستخدمين إحصائيات وبيانات السوق. تقولين "حسب تحليلي..." كثيراً.`
};

// ═══════════════════════════════════════════════════
// Model-specific API callers
// ═══════════════════════════════════════════════════

// Call OpenAI GPT-4o
async function callOpenAI(
  systemPrompt: string,
  userMessage: string,
  conversationHistory?: { role: "user" | "assistant"; content: string }[]
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

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages,
      max_tokens: 2048,
      temperature: 0.8,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[OpenAI] Error:", response.status, errorText);
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || "عذراً، لم أتمكن من الرد.";
}

// Call Anthropic Claude 3.5 Sonnet
async function callClaude(
  systemPrompt: string,
  userMessage: string,
  conversationHistory?: { role: "user" | "assistant"; content: string }[]
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

  const response = await fetch("https://api.anthropic.com/v1/messages", {
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
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[Claude] Error:", response.status, errorText);
    throw new Error(`Claude API error: ${response.status}`);
  }

  const data = await response.json();
  return data.content?.[0]?.text || "عذراً، لم أتمكن من الرد.";
}

// Call Google Gemini 1.5 Pro
async function callGemini(
  systemPrompt: string,
  userMessage: string,
  conversationHistory?: { role: "user" | "assistant"; content: string }[]
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

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: {
          maxOutputTokens: 2048,
          temperature: 0.8,
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[Gemini] Error:", response.status, errorText);
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "عذراً، لم أتمكن من الرد.";
}

// Fallback to built-in Manus LLM
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
// Smart model router - picks the best model per agent
// ═══════════════════════════════════════════════════

async function callBestModel(
  agent: AgentType,
  systemPrompt: string,
  userMessage: string,
  conversationHistory?: { role: "user" | "assistant"; content: string }[]
): Promise<string> {
  const assignedModel = AGENT_MODEL_MAP[agent];

  // Try the assigned model first
  try {
    switch (assignedModel) {
      case "gpt-4o":
        if (ENV.openaiApiKey) {
          console.log(`[AgentChat] 🟢 ${agent} → GPT-4o (OpenAI)`);
          return await callOpenAI(systemPrompt, userMessage, conversationHistory);
        }
        break;
      case "claude-sonnet-4":
        if (ENV.anthropicApiKey) {
          console.log(`[AgentChat] 🟣 ${agent} → Claude Sonnet 4 (Anthropic)`);
          return await callClaude(systemPrompt, userMessage, conversationHistory);
        }
        break;
      case "gemini-2.5-flash":
        if (ENV.googleGeminiApiKey) {
          console.log(`[AgentChat] 🔵 ${agent} → Gemini 2.5 Flash (Google)`);
          return await callGemini(systemPrompt, userMessage, conversationHistory);
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
    { model: "gemini-2.5-flash", fn: callGemini, key: ENV.googleGeminiApiKey },
  ];

  for (const fallback of fallbackOrder) {
    if (fallback.model === assignedModel || !fallback.key) continue;
    try {
      console.log(`[AgentChat] ⚠️ Fallback: ${agent} → ${fallback.model}`);
      return await fallback.fn(systemPrompt, userMessage, conversationHistory);
    } catch (err) {
      console.error(`[AgentChat] Fallback ${fallback.model} also failed:`, err);
    }
  }

  // Final fallback: Manus built-in LLM
  console.log(`[AgentChat] 🔴 All models failed, using Manus LLM for ${agent}`);
  return await callManusLLM(systemPrompt, userMessage);
}

// Get platform context data for smarter responses
async function getPlatformContext(agent: AgentType): Promise<string> {
  let contextData = "";
  try {
    const db = await getDb();
    if (!db) return "";

    const projectList = await db.select().from(projects).limit(10);
    if (projectList.length > 0) {
      contextData += `\n\n📋 المشاريع الحالية في كومو:\n${projectList.map(p => `- ${p.name}`).join("\n")}`;
    }

    const consultantList = await db.select().from(consultants).limit(15);
    if (consultantList.length > 0) {
      contextData += `\n\n🏛️ الاستشاريون المسجلون:\n${consultantList.map(c => `- ${c.name}`).join("\n")}`;
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

  } catch (err) {
    console.error("[AgentChat] Context fetch error:", err);
  }
  return contextData;
}

export async function handleAgentChat(req: AgentChatRequest): Promise<string> {
  const { agent, message, conversationHistory } = req;

  // Special handling for Salwa's email commands
  if (agent === "salwa") {
    const lowerMsg = message.toLowerCase();
    if (lowerMsg.includes("ايميل") || lowerMsg.includes("إيميل") || lowerMsg.includes("بريد") || lowerMsg.includes("رسائل") || lowerMsg.includes("email")) {
      try {
        const count = await checkLast48HoursEmails();
        if (count === 0) {
          return "✅ فحصت الإيميل الحين يا عبدالرحمن! ما فيه رسائل جديدة في آخر 48 ساعة. إن شاء الله أول ما يوصل شي بخبرك 📧";
        }
        return `📧 فحصت الإيميل! وجدت ${count} رسائل في آخر 48 ساعة. شوف الإشعارات أو تيليجرام للتفاصيل الكاملة إن شاء الله 💪`;
      } catch (error) {
        // Don't return error for email - let the AI handle the conversation
      }
    }
  }

  // Get platform context
  const contextData = await getPlatformContext(agent);

  // Build system prompt with context
  const modelName = AGENT_MODEL_MAP[agent];
  const systemPrompt = AGENT_PROMPTS[agent] + contextData + 
    "\n\nتعليمات مهمة: أجب بشكل طبيعي وشخصي. تحدث كأنك زميل عمل حقيقي. استخدم المعلومات المتاحة عن المشاريع والاستشاريين عند الحاجة. إذا لم تكن متأكداً من معلومة، قل ذلك بصراحة.";

  // Route to the best model for this agent
  return await callBestModel(agent, systemPrompt, message, conversationHistory);
}
