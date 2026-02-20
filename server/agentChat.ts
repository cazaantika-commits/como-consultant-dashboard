import { invokeLLM } from "./_core/llm";
import { ENV } from "./_core/env";
import { checkLast48HoursEmails } from "./emailIntegration";
import { getDb } from "./db";
import { consultants, projects, agents, evaluationScores, financialData, modelUsageLog } from "../drizzle/schema";
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

// Tool-use instruction appended to system prompts
const TOOL_USE_INSTRUCTION = `

🔧 لديك أدوات للوصول إلى بيانات المنصة الحقيقية. استخدمها عندما يطلب منك المستخدم:
- عرض أو البحث عن بيانات (مشاريع، استشاريين، تقييمات، أتعاب، مهام)
- إضافة أو تعديل بيانات (استشاري جديد، مهمة، تقييم، بيانات مالية)
- تحليل معلومات محددة من المنصة

عند استخدام الأدوات:
1. استخدم الأداة المناسبة لجلب البيانات أولاً
2. حلل النتائج وقدمها بأسلوبك الشخصي
3. أضف رأيك وتحليلك المهني
4. لا تقل "ما عندي اكسس" - أنت لديك وصول كامل لبيانات المنصة!`;

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

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[OpenAI] Error:", response.status, errorText);
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  let data = await response.json();
  let assistantMessage = data.choices[0]?.message;

  // Handle tool calls - up to 5 rounds
  let toolRounds = 0;
  while (assistantMessage?.tool_calls && toolRounds < 5) {
    toolRounds++;
    console.log(`[OpenAI] Tool call round ${toolRounds}: ${assistantMessage.tool_calls.length} tools`);
    
    messages.push(assistantMessage);

    for (const toolCall of assistantMessage.tool_calls) {
      const fnName = toolCall.function.name;
      const fnArgs = JSON.parse(toolCall.function.arguments || "{}");
      console.log(`[OpenAI] Executing tool: ${fnName}`, fnArgs);
      
      const result = await executeAgentTool(fnName, fnArgs, userId || 0);
      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: result,
      });
    }

    // Call again with tool results
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
      console.error("[OpenAI] Follow-up error:", followUp.status, errorText);
      break;
    }

    data = await followUp.json();
    assistantMessage = data.choices[0]?.message;
  }

  return assistantMessage?.content || "عذراً، لم أتمكن من الرد.";
}

// Call Anthropic Claude with tool use
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
      contextData += `\n\n📋 المشاريع الحالية في كومو:\n${projectList.map(p => `- ${p.name} (ID: ${p.id})`).join("\n")}`;
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
    "\n\nتعليمات مهمة: أجب بشكل طبيعي وشخصي. تحدث كأنك زميل عمل حقيقي. استخدم الأدوات لجلب البيانات الحقيقية من المنصة عند الحاجة. إذا سُئلت عن بيانات محددة، استخدم الأدوات أولاً ثم حلل النتائج.";

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
