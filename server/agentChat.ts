import { invokeLLM } from "./_core/llm";
import { checkLast48HoursEmails } from "./emailIntegration";
import { getDb } from "./db";
import { consultants, projects } from "../drizzle/schema";
import { like } from "drizzle-orm";

export type AgentType = "salwa" | "farouq" | "khazen";

interface AgentChatRequest {
  agent: AgentType;
  message: string;
  userId: number;
}

export async function handleAgentChat(req: AgentChatRequest): Promise<string> {
  const { agent, message } = req;

  switch (agent) {
    case "salwa":
      return await handleSalwaChat(message);
    case "farouq":
      return await handleFarouqChat(message);
    case "khazen":
      return await handleKhazenChat(message);
    default:
      return "عذراً، هذا الوكيل غير متوفر حالياً.";
  }
}

// ─── Salwa (Email Assistant) ───
async function handleSalwaChat(message: string): Promise<string> {
  const lowerMsg = message.toLowerCase();

  // Check if user wants to check emails
  if (lowerMsg.includes("ايميل") || lowerMsg.includes("إيميل") || lowerMsg.includes("بريد") || lowerMsg.includes("رسائل")) {
    try {
      const count = await checkLast48HoursEmails();
      if (count === 0) {
        return "✅ لا توجد رسائل جديدة في آخر 48 ساعة.";
      }
      return `📧 تم فحص الإيميل. وجدت ${count} رسائل في آخر 48 ساعة. تحقق من الإشعارات أو تيليجرام للتفاصيل.`;
    } catch (error) {
      return `⚠️ فشل فحص الإيميل: ${(error as Error).message}`;
    }
  }

  // Use LLM for general conversation
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `أنت سلوى، المساعدة التنفيذية لشركة Como Developments للتطوير العقاري في دبي.

مهامك:
- فحص الإيميل وإدارة المراسلات
- الرد على الاستفسارات حول الإيميلات والمراسلات
- توجيه المستخدم لفحص الإيميل أو الرد على رسائل معينة

أجب بشكل ودود ومهني باللغة العربية.`
      },
      {
        role: "user",
        content: message
      }
    ]
  });

  const content = response.choices[0].message.content;
  return typeof content === "string" ? content : "عذراً، لم أتمكن من فهم طلبك.";
}

// ─── Farouq (Legal & Financial Analyst) ───
async function handleFarouqChat(message: string): Promise<string> {
  const lowerMsg = message.toLowerCase();

  // Check if user wants to analyze a consultant or project
  if (lowerMsg.includes("حلل") || lowerMsg.includes("تحليل") || lowerMsg.includes("عرض")) {
    const db = await getDb();
    if (!db) return "⚠️ قاعدة البيانات غير متاحة حالياً.";

    // Try to find consultant or project mentioned
    const words = message.split(/\s+/);
    for (const word of words) {
      if (word.length < 3) continue;

      // Search consultants
      const consultantResults = await db.select().from(consultants)
        .where(like(consultants.name, `%${word}%`))
        .limit(3);

      if (consultantResults.length > 0) {
        const names = consultantResults.map(c => c.name).join("، ");
        return `📊 وجدت استشاريين: ${names}\n\nلتحليل عرض معين، يرجى إرسال المستند عبر الإيميل أو رفعه مباشرة.`;
      }

      // Search projects
      const projectResults = await db.select().from(projects)
        .where(like(projects.name, `%${word}%`))
        .limit(3);

      if (projectResults.length > 0) {
        const names = projectResults.map(p => p.name).join("، ");
        return `🏗️ وجدت مشاريع: ${names}\n\nلتحليل عرض متعلق بهذا المشروع، يرجى إرسال المستند.`;
      }
    }

    return "📋 لتحليل عرض استشاري أو دراسة جدوى، يرجى:\n1. إرسال المستند عبر الإيميل\n2. أو رفعه مباشرة في المنصة\n3. أو الضغط على زر \"حلل العرض\" من إشعارات الإيميل";
  }

  // Use LLM for general conversation
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `أنت فاروق، المحلل القانوني والمالي الخبير في شركة Como Developments للتطوير العقاري في دبي.

مهامك:
- تحليل عروض الاستشاريين واستخراج الأتعاب والتفاصيل
- تحليل دراسات الجدوى واستخراج البيانات المالية
- الإجابة على الأسئلة المتعلقة بالتحليل المالي والقانوني

أجب بشكل مهني ودقيق باللغة العربية.`
      },
      {
        role: "user",
        content: message
      }
    ]
  });

  const content = response.choices[0].message.content;
  return typeof content === "string" ? content : "عذراً، لم أتمكن من فهم طلبك.";
}

// ─── Khazen (Archive Manager) ───
async function handleKhazenChat(message: string): Promise<string> {
  const lowerMsg = message.toLowerCase();

  if (lowerMsg.includes("أرشف") || lowerMsg.includes("ارشف") || lowerMsg.includes("حفظ") || lowerMsg.includes("drive")) {
    return "📁 لأرشفة مستند في Google Drive:\n\n1. افتح إشعار الإيميل الذي يحتوي على المرفقات\n2. اضغط على زر \"أرشف (خازن)\"\n3. سأقوم بتحميل المرفقات ورفعها إلى Google Drive تلقائياً\n\nأو أرسل لي اسم المستند الذي تريد أرشفته.";
  }

  // Use LLM for general conversation
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `أنت خازن، مدير الأرشفة في شركة Como Developments للتطوير العقاري في دبي.

مهامك:
- أرشفة المستندات والمرفقات في Google Drive
- تنظيم الملفات حسب المشاريع والاستشاريين
- مساعدة المستخدم في إيجاد المستندات المؤرشفة

أجب بشكل ودود ومنظم باللغة العربية.`
      },
      {
        role: "user",
        content: message
      }
    ]
  });

  const content = response.choices[0].message.content;
  return typeof content === "string" ? content : "عذراً، لم أتمكن من فهم طلبك.";
}
