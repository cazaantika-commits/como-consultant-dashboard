import TelegramBot from "node-telegram-bot-api";
import { getDb } from "./db";
import { tasks } from "../drizzle/schema";
import { invokeLLM } from "./_core/llm";
import { notifyOwner } from "./_core/notification";
import { transcribeAudio } from "./_core/voiceTranscription";
import { storagePut } from "./storage";
import { eq, desc, and, sql } from "drizzle-orm";
import { searchFiles, listFilesInFolder, listSharedDrives } from "./googleDrive";

/**
 * Salwa Telegram Bot - وكيل سلوى على تيليجرام
 * 
 * Commands:
 * /start      - رسالة ترحيبية
 * /help       - عرض الأوامر المتاحة
 * /tasks      - عرض ملخص المهام
 * /mytasks    - عرض مهام المستخدم
 * /newtask    - إنشاء مهمة جديدة
 * /search     - البحث في ملفات Google Drive
 * /stats      - إحصائيات المهام
 * /email      - تحليل بريد إلكتروني وتحويله لمهام
 * 
 * Free text messages are analyzed by AI to determine intent
 */

let bot: TelegramBot | null = null;
let isInitialized = false;

// Authorized chat IDs (can be expanded via admin commands)
const authorizedChats = new Set<number>();

// Conversation state for multi-step interactions
interface ConversationState {
  step: string;
  data: Record<string, any>;
  timestamp: number;
}
const conversations = new Map<number, ConversationState>();

// Known projects for matching
const KNOWN_PROJECTS = [
  "الجداف", "Al Jaddaf",
  "مجان", "Majan Building",
  "ند الشبا", "Nad Al Sheba",
  "الفلل", "Villas",
  "المول", "Mall",
  "عام", "General",
];

const KNOWN_OWNERS = [
  "عبدالرحمن", "Abdalrahman",
  "الشيخ عيسى", "Sheikh Issa",
  "أحمد", "Ahmad",
];

/**
 * Initialize the Telegram bot
 */
export async function initTelegramBot(): Promise<TelegramBot | null> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn("[TelegramBot] TELEGRAM_BOT_TOKEN not set, skipping initialization");
    return null;
  }

  if (isInitialized && bot) {
    return bot;
  }

  try {
    // Step 1: Delete any webhook
    try {
      await fetch(`https://api.telegram.org/bot${token}/deleteWebhook?drop_pending_updates=true`);
    } catch (e) {
      console.warn("[TelegramBot] Could not clear webhook:", e);
    }

    // Step 2: Force-claim the polling session by making a short getUpdates call
    // This terminates any other long-polling connection
    try {
      await fetch(`https://api.telegram.org/bot${token}/getUpdates?timeout=0&offset=-1`);
      // Wait for the old polling session to fully release
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (e) {
      console.warn("[TelegramBot] Could not force-claim polling:", e);
    }

    bot = new TelegramBot(token, {
      polling: {
        interval: 2000,
        autoStart: true,
        params: {
          timeout: 10,
        },
      },
    });
    isInitialized = true;

    // Track consecutive conflict errors
    let conflictCount = 0;

    // Handle polling errors gracefully (don't crash)
    bot.on("polling_error", (error: any) => {
      if (error?.code === "ETELEGRAM" && error?.message?.includes("409 Conflict")) {
        conflictCount++;
        // Only log every 10th conflict to avoid spam
        if (conflictCount % 10 === 1) {
          console.warn(`[TelegramBot] Polling conflict #${conflictCount} - published version may also be running.`);
        }
      } else {
        console.error("[TelegramBot] Polling error:", error?.message || error);
      }
    });

    // Register command handlers
    registerCommands(bot);

    console.log("[TelegramBot] \u2705 Salwa bot initialized and polling for messages");
    return bot;
  } catch (error) {
    console.error("[TelegramBot] Failed to initialize:", error);
    return null;
  }
}

/**
 * Stop the Telegram bot
 */
export async function stopTelegramBot(): Promise<void> {
  if (bot) {
    try {
      await bot.stopPolling();
    } catch {
      // ignore
    }
    bot = null;
    isInitialized = false;
    console.log("[TelegramBot] Bot stopped");
  }
}

/**
 * Get the bot instance
 */
export function getBot(): TelegramBot | null {
  return bot;
}

/**
 * Register all command handlers
 */
function registerCommands(bot: TelegramBot) {
  // /start command
  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    authorizedChats.add(chatId);

    const welcomeMessage = `🏗️ *مرحباً! أنا سلوى - المساعدة التنفيذية الذكية لشركة كومو للتطوير العقاري*

أنا أنسق بين فريق الوكلاء المتخصصين وأوزع المهام وأقدم التقارير.

*فريق العمل:*

📦 *خازن* - مدير الأرشفة والتخزين
⚖️ *فاروق* - محامي خبير (العقود والقانون)
⏱ *براق* - مراقب التنفيذ والجدول الزمني
✅ *خالد* - مدقق الجودة والامتثال الفني
💰 *قاسم* - المدير المالي
🚀 *باز* - المستشار الاستراتيجي
📊 *جويل* - محللة دراسات الجدوى والسوق

*يمكنني مساعدتك في:*
📋 إدارة المهام وتوزيعها
📧 تحليل البريد الإلكتروني
📁 البحث في ملفات Google Drive
📊 الإحصائيات والتقارير

اكتب /help لعرض جميع الأوامر المتاحة.`;

    await bot.sendMessage(chatId, welcomeMessage, { parse_mode: "Markdown" });
    await logActivity("سلوى", "telegram_start", `مستخدم جديد بدأ المحادثة: ${msg.from?.first_name || chatId}`);
  });

  // /help command
  bot.onText(/\/help/, async (msg) => {
    const chatId = msg.chat.id;
    const helpMessage = `📖 *الأوامر المتاحة:*

🔹 /tasks - عرض ملخص جميع المهام
🔹 /mytasks - عرض مهامي الحالية
🔹 /newtask - إنشاء مهمة جديدة (تفاعلي)
🔹 /search \\[كلمة\\] - البحث في ملفات Drive
🔹 /stats - إحصائيات المهام
🔹 /email - تحليل بريد إلكتروني
🔹 /team - عرض فريق الوكلاء

💡 *نصائح:*
• يمكنك إرسال أي رسالة نصية وسأحاول فهم طلبك
• أرسل محتوى بريد إلكتروني مباشرة وسأحوله لمهام
• اكتب "مهمة جديدة: ..." لإنشاء مهمة سريعة`;

    await bot.sendMessage(chatId, helpMessage, { parse_mode: "Markdown" });
  });

  // /team command - show agent team
  bot.onText(/\/team/, async (msg) => {
    const chatId = msg.chat.id;
    const teamMessage = `👥 *فريق وكلاء كومو للتطوير العقاري*\n\n` +
      `🤖 *سلوى* - المساعدة التنفيذية الذكية\n` +
      `   التنسيق بين الفريق وتوزيع المهام وتقديم التقارير\n\n` +
      `📦 *خازن* - مدير الأرشفة والتخزين\n` +
      `   تنظيم الملفات وتسميتها وحفظها في Google Drive\n\n` +
      `⚖️ *فاروق* - محامي خبير\n` +
      `   تدقيق العقود واكتشاف الثغرات القانونية وتقديم الرأي القانوني\n\n` +
      `⏱ *براق* - مراقب التنفيذ والجدول الزمني\n` +
      `   متابعة نسب الإنجاز والتنبيه عند التأخر\n\n` +
      `✅ *خالد* - مدقق الجودة والامتثال الفني\n` +
      `   ضمان معايير الجودة والامتثال لنظام BIM\n\n` +
      `💰 *قاسم* - المدير المالي\n` +
      `   تحليل الميزانيات والمستخلصات ومقارنة العروض\n\n` +
      `🚀 *باز* - المستشار الاستراتيجي\n` +
      `   تحسين الأداء واقتراحات الابتكار\n\n` +
      `📊 *جويل* - محللة دراسات الجدوى والسوق\n` +
      `   دراسات الجدوى وتحليل السوق ومراقبة الانحرافات`;

    await bot.sendMessage(chatId, teamMessage, { parse_mode: "Markdown" });
  });

  // /tasks command - show task summary
  bot.onText(/\/tasks/, async (msg) => {
    const chatId = msg.chat.id;
    try {
      const db = await getDb();
      if (!db) {
        await bot.sendMessage(chatId, "⚠️ قاعدة البيانات غير متاحة حالياً");
        return;
      }

      const allTasks = await db.select().from(tasks).orderBy(desc(tasks.createdAt));
      const today = new Date().toISOString().split("T")[0];

      const total = allTasks.length;
      const newCount = allTasks.filter(t => t.status === "new").length;
      const progress = allTasks.filter(t => t.status === "progress").length;
      const hold = allTasks.filter(t => t.status === "hold").length;
      const done = allTasks.filter(t => t.status === "done").length;
      const cancelled = allTasks.filter(t => t.status === "cancelled").length;
      const overdue = allTasks.filter(t =>
        t.dueDate && t.dueDate < today && t.status !== "done" && t.status !== "cancelled"
      ).length;

      let message = `📊 *ملخص المهام*\n\n`;
      message += `📌 الإجمالي: *${total}*\n`;
      message += `🆕 لم تبدأ: *${newCount}*\n`;
      message += `🔄 قيد التنفيذ: *${progress}*\n`;
      message += `⏸ معلقة: *${hold}*\n`;
      message += `✅ مكتملة: *${done}*\n`;
      message += `❌ ملغاة: *${cancelled}*\n`;
      if (overdue > 0) {
        message += `⚠️ متأخرة: *${overdue}*\n`;
      }

      // Show recent tasks
      const recentTasks = allTasks.slice(0, 5);
      if (recentTasks.length > 0) {
        message += `\n📋 *آخر المهام:*\n`;
        for (const t of recentTasks) {
          const statusIcon = getStatusIcon(t.status);
          const priorityIcon = getPriorityIcon(t.priority);
          message += `${statusIcon} ${priorityIcon} ${t.title}\n   📁 ${t.project} | 👤 ${t.owner}\n`;
        }
      }

      await bot.sendMessage(chatId, message, { parse_mode: "Markdown" });
    } catch (error: any) {
      console.error("[TelegramBot] /tasks error:", error);
      await bot.sendMessage(chatId, `⚠️ حدث خطأ: ${error.message}`);
    }
  });

  // /mytasks command
  bot.onText(/\/mytasks(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const ownerName = match?.[1]?.trim() || msg.from?.first_name || "";

    try {
      const db = await getDb();
      if (!db) {
        await bot.sendMessage(chatId, "⚠️ قاعدة البيانات غير متاحة حالياً");
        return;
      }

      // Search for tasks matching the user's name
      const allTasks = await db.select().from(tasks).orderBy(desc(tasks.createdAt));
      const myTasks = allTasks.filter(t =>
        t.owner.includes(ownerName) ||
        t.owner.toLowerCase().includes(ownerName.toLowerCase())
      );

      if (myTasks.length === 0) {
        await bot.sendMessage(chatId,
          `لم أجد مهام باسم "${ownerName}". جرب:\n/mytasks عبدالرحمن\n/mytasks أحمد`
        );
        return;
      }

      const activeTasks = myTasks.filter(t => t.status !== "done" && t.status !== "cancelled");
      let message = `📋 *مهام ${ownerName}* (${activeTasks.length} نشطة من ${myTasks.length})\n\n`;

      for (const t of activeTasks.slice(0, 10)) {
        const statusIcon = getStatusIcon(t.status);
        const priorityIcon = getPriorityIcon(t.priority);
        message += `${statusIcon} ${priorityIcon} *${t.title}*\n`;
        message += `   📁 ${t.project}`;
        if (t.dueDate) message += ` | 📅 ${t.dueDate}`;
        message += `\n`;
      }

      if (activeTasks.length > 10) {
        message += `\n... و ${activeTasks.length - 10} مهام أخرى`;
      }

      await bot.sendMessage(chatId, message, { parse_mode: "Markdown" });
    } catch (error: any) {
      console.error("[TelegramBot] /mytasks error:", error);
      await bot.sendMessage(chatId, `⚠️ حدث خطأ: ${error.message}`);
    }
  });

  // /newtask command - interactive task creation
  bot.onText(/\/newtask/, async (msg) => {
    const chatId = msg.chat.id;

    conversations.set(chatId, {
      step: "title",
      data: {},
      timestamp: Date.now(),
    });

    await bot.sendMessage(chatId,
      `📝 *إنشاء مهمة جديدة*\n\nالخطوة 1/5: ما عنوان المهمة؟`,
      { parse_mode: "Markdown" }
    );
  });

  // /search command - search Google Drive files
  bot.onText(/\/search(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const query = match?.[1]?.trim();

    if (!query) {
      await bot.sendMessage(chatId, "🔍 أرسل كلمة البحث بعد الأمر:\n/search عقد تصميم");
      return;
    }

    try {
      await bot.sendMessage(chatId, `🔍 جاري البحث عن "${query}" في Google Drive...`);
      const files = await searchFiles(query);

      if (files.length === 0) {
        await bot.sendMessage(chatId, `لم أجد ملفات تطابق "${query}"`);
        return;
      }

      let message = `📁 *نتائج البحث عن "${query}":*\n\n`;
      for (const f of files.slice(0, 10)) {
        const icon = getFileIcon(f.mimeType);
        const link = f.webViewLink ? ` [فتح](${f.webViewLink})` : "";
        message += `${icon} ${f.name}${link}\n`;
      }

      if (files.length > 10) {
        message += `\n... و ${files.length - 10} ملفات أخرى`;
      }

      await bot.sendMessage(chatId, message, {
        parse_mode: "Markdown",
        disable_web_page_preview: true,
      });
    } catch (error: any) {
      console.error("[TelegramBot] /search error:", error);
      await bot.sendMessage(chatId, `⚠️ خطأ في البحث: ${error.message}`);
    }
  });

  // /stats command
  bot.onText(/\/stats/, async (msg) => {
    const chatId = msg.chat.id;
    try {
      const db = await getDb();
      if (!db) {
        await bot.sendMessage(chatId, "⚠️ قاعدة البيانات غير متاحة حالياً");
        return;
      }

      const allTasks = await db.select().from(tasks);

      // Group by project
      const byProject: Record<string, number> = {};
      const byOwner: Record<string, number> = {};
      const byPriority: Record<string, number> = { high: 0, medium: 0, low: 0 };

      for (const t of allTasks) {
        byProject[t.project] = (byProject[t.project] || 0) + 1;
        byOwner[t.owner] = (byOwner[t.owner] || 0) + 1;
        byPriority[t.priority] = (byPriority[t.priority] || 0) + 1;
      }

      let message = `📊 *إحصائيات تفصيلية*\n\n`;

      message += `🏗 *حسب المشروع:*\n`;
      for (const [project, count] of Object.entries(byProject).sort((a, b) => b[1] - a[1])) {
        message += `  • ${project}: ${count}\n`;
      }

      message += `\n👤 *حسب المسؤول:*\n`;
      for (const [owner, count] of Object.entries(byOwner).sort((a, b) => b[1] - a[1])) {
        message += `  • ${owner}: ${count}\n`;
      }

      message += `\n🔴 *حسب الأولوية:*\n`;
      message += `  🔴 عالية: ${byPriority.high}\n`;
      message += `  🟡 متوسطة: ${byPriority.medium}\n`;
      message += `  🟢 منخفضة: ${byPriority.low}\n`;

      // Agent vs manual
      const agentTasks = allTasks.filter(t => t.source === "agent").length;
      const manualTasks = allTasks.filter(t => t.source === "manual").length;
      const commandTasks = allTasks.filter(t => t.source === "command").length;

      message += `\n📥 *حسب المصدر:*\n`;
      message += `  🤖 وكيل: ${agentTasks}\n`;
      message += `  ✋ يدوي: ${manualTasks}\n`;
      message += `  ⌨️ أمر: ${commandTasks}\n`;

      await bot.sendMessage(chatId, message, { parse_mode: "Markdown" });
    } catch (error: any) {
      console.error("[TelegramBot] /stats error:", error);
      await bot.sendMessage(chatId, `⚠️ حدث خطأ: ${error.message}`);
    }
  });

  // /email command - start email analysis
  bot.onText(/\/email/, async (msg) => {
    const chatId = msg.chat.id;

    conversations.set(chatId, {
      step: "email_body",
      data: {},
      timestamp: Date.now(),
    });

    await bot.sendMessage(chatId,
      `📧 *تحليل بريد إلكتروني*\n\nأرسل محتوى البريد الإلكتروني (يمكنك نسخه ولصقه هنا) وسأقوم بتحليله واستخراج المهام منه تلقائياً.`,
      { parse_mode: "Markdown" }
    );
  });

  // Handle voice messages (audio transcription)
  bot.on("voice", async (msg) => {
    const chatId = msg.chat.id;
    await handleVoiceMessage(bot!, chatId, msg);
  });

  // Handle audio files (audio transcription)
  bot.on("audio", async (msg) => {
    const chatId = msg.chat.id;
    await handleVoiceMessage(bot!, chatId, msg);
  });

  // Handle all text messages (for conversations and free-text AI analysis)
  bot.on("message", async (msg) => {
    if (!msg.text || msg.text.startsWith("/")) return;
    const chatId = msg.chat.id;
    const text = msg.text.trim();

    // Check if there's an active conversation
    const convo = conversations.get(chatId);
    if (convo) {
      await handleConversation(bot!, chatId, text, convo, msg);
      return;
    }

    // Free-text AI analysis
    await handleFreeText(bot!, chatId, text, msg);
  });
}

/**
 * Handle multi-step conversations (task creation, email analysis)
 */
async function handleConversation(
  bot: TelegramBot,
  chatId: number,
  text: string,
  convo: ConversationState,
  msg: TelegramBot.Message
) {
  // Timeout old conversations (10 minutes)
  if (Date.now() - convo.timestamp > 10 * 60 * 1000) {
    conversations.delete(chatId);
    await bot.sendMessage(chatId, "⏰ انتهت المحادثة السابقة. أرسل /newtask للبدء من جديد.");
    return;
  }

  // Email analysis flow
  if (convo.step === "email_body") {
    conversations.delete(chatId);
    await analyzeEmailFromTelegram(bot, chatId, text);
    return;
  }

  // Task creation flow
  switch (convo.step) {
    case "title":
      convo.data.title = text;
      convo.step = "project";
      convo.timestamp = Date.now();

      const projectButtons = [
        [{ text: "🏗 الجداف", callback_data: "project_الجداف" }],
        [{ text: "🏢 مجان", callback_data: "project_مجان" }],
        [{ text: "🏠 ند الشبا", callback_data: "project_ند الشبا" }],
        [{ text: "🏘 الفلل", callback_data: "project_الفلل" }],
        [{ text: "🛒 المول", callback_data: "project_المول" }],
        [{ text: "📌 عام", callback_data: "project_عام" }],
      ];

      await bot.sendMessage(chatId,
        `✅ العنوان: *${text}*\n\nالخطوة 2/5: اختر المشروع:`,
        {
          parse_mode: "Markdown",
          reply_markup: { inline_keyboard: projectButtons },
        }
      );
      break;

    case "owner":
      convo.data.owner = text;
      convo.step = "priority";
      convo.timestamp = Date.now();

      const priorityButtons = [
        [
          { text: "🔴 عالية", callback_data: "priority_high" },
          { text: "🟡 متوسطة", callback_data: "priority_medium" },
          { text: "🟢 منخفضة", callback_data: "priority_low" },
        ],
      ];

      await bot.sendMessage(chatId,
        `✅ المسؤول: *${text}*\n\nالخطوة 4/5: اختر الأولوية:`,
        {
          parse_mode: "Markdown",
          reply_markup: { inline_keyboard: priorityButtons },
        }
      );
      break;

    case "description":
      convo.data.description = text;
      conversations.delete(chatId);
      await createTaskFromConversation(bot, chatId, convo.data);
      break;

    default:
      conversations.delete(chatId);
      await bot.sendMessage(chatId, "حدث خطأ في المحادثة. أرسل /newtask للبدء من جديد.");
  }
}

/**
 * Handle callback queries from inline keyboards
 */
export function registerCallbackHandler(bot: TelegramBot) {
  bot.on("callback_query", async (query) => {
    const chatId = query.message?.chat.id;
    if (!chatId) return;

    const data = query.data || "";
    const convo = conversations.get(chatId);

    if (!convo) {
      await bot.answerCallbackQuery(query.id, { text: "انتهت المحادثة" });
      return;
    }

    // Project selection
    if (data.startsWith("project_")) {
      const project = data.replace("project_", "");
      convo.data.project = project;
      convo.step = "owner";
      convo.timestamp = Date.now();

      const ownerButtons = [
        [{ text: "👤 عبدالرحمن", callback_data: "owner_عبدالرحمن" }],
        [{ text: "👤 أحمد", callback_data: "owner_أحمد" }],
        [{ text: "👤 الشيخ عيسى", callback_data: "owner_الشيخ عيسى" }],
      ];

      await bot.answerCallbackQuery(query.id);
      await bot.sendMessage(chatId,
        `✅ المشروع: *${project}*\n\nالخطوة 3/5: اختر المسؤول أو اكتب اسمه:`,
        {
          parse_mode: "Markdown",
          reply_markup: { inline_keyboard: ownerButtons },
        }
      );
    }

    // Owner selection
    if (data.startsWith("owner_")) {
      const owner = data.replace("owner_", "");
      convo.data.owner = owner;
      convo.step = "priority";
      convo.timestamp = Date.now();

      const priorityButtons = [
        [
          { text: "🔴 عالية", callback_data: "priority_high" },
          { text: "🟡 متوسطة", callback_data: "priority_medium" },
          { text: "🟢 منخفضة", callback_data: "priority_low" },
        ],
      ];

      await bot.answerCallbackQuery(query.id);
      await bot.sendMessage(chatId,
        `✅ المسؤول: *${owner}*\n\nالخطوة 4/5: اختر الأولوية:`,
        {
          parse_mode: "Markdown",
          reply_markup: { inline_keyboard: priorityButtons },
        }
      );
    }

    // Priority selection
    if (data.startsWith("priority_")) {
      const priority = data.replace("priority_", "");
      convo.data.priority = priority;
      convo.step = "description";
      convo.timestamp = Date.now();

      const priorityLabel = priority === "high" ? "عالية" : priority === "medium" ? "متوسطة" : "منخفضة";

      await bot.answerCallbackQuery(query.id);
      await bot.sendMessage(chatId,
        `✅ الأولوية: *${priorityLabel}*\n\nالخطوة 5/5: أضف وصفاً للمهمة (أو أرسل "تخطي"):`,
        { parse_mode: "Markdown" }
      );
    }
  });
}

/**
 * Create a task from conversation data
 */
async function createTaskFromConversation(
  bot: TelegramBot,
  chatId: number,
  data: Record<string, any>
) {
  try {
    const db = await getDb();
    if (!db) {
      await bot.sendMessage(chatId, "⚠️ قاعدة البيانات غير متاحة");
      return;
    }

    const description = data.description === "تخطي" ? null : data.description;

    const result = await db.insert(tasks).values({
      title: data.title,
      description: description || null,
      project: data.project,
      category: null,
      owner: data.owner,
      priority: data.priority || "medium",
      status: "new",
      progress: 0,
      source: "command",
      sourceAgent: "سلوى-تيليجرام",
    });

    await logActivity(
      "سلوى",
      "telegram_task_created",
      `مهمة جديدة من تيليجرام: ${data.title}`,
      data.project
    );

    const priorityIcon = getPriorityIcon(data.priority);
    await bot.sendMessage(chatId,
      `✅ *تم إنشاء المهمة بنجاح!*\n\n` +
      `📌 *${data.title}*\n` +
      `📁 المشروع: ${data.project}\n` +
      `👤 المسؤول: ${data.owner}\n` +
      `${priorityIcon} الأولوية: ${data.priority === "high" ? "عالية" : data.priority === "medium" ? "متوسطة" : "منخفضة"}\n` +
      (description ? `📝 الوصف: ${description}\n` : "") +
      `\n🤖 المصدر: سلوى - تيليجرام`,
      { parse_mode: "Markdown" }
    );
  } catch (error: any) {
    console.error("[TelegramBot] Create task error:", error);
    await bot.sendMessage(chatId, `⚠️ فشل إنشاء المهمة: ${error.message}`);
  }
}

/**
 * Analyze email content and create tasks
 */
async function analyzeEmailFromTelegram(
  bot: TelegramBot,
  chatId: number,
  emailContent: string
) {
  try {
    await bot.sendMessage(chatId, "🔄 جاري تحليل البريد الإلكتروني...");

    const db = await getDb();
    if (!db) {
      await bot.sendMessage(chatId, "⚠️ قاعدة البيانات غير متاحة");
      return;
    }

    const llmResponse = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `أنتِ سلوى - المساعدة التنفيذية الذكية لشركة كومو للتطوير العقاري (COMO Developments) في دبي.
مهمتك تحليل رسائل البريد الإلكتروني واستخراج المهام القابلة للتنفيذ منها.
أنتِ تنسقين بين فريق من الوكلاء: خازن (أرشفة)، فاروق (قانون)، براق (تنفيذ)، خالد (جودة)، قاسم (مالية)، باز (استراتيجية)، جويل (دراسات جدوى).

المشاريع المعروفة:
- الجداف (Al Jaddaf)
- مجان (Majan Building)
- ند الشبا (Nad Al Sheba)
- الفلل (Villas)
- المول (Mall)
- عام (General) - للمهام غير المرتبطة بمشروع محدد

المسؤولون المعروفون:
- عبدالرحمن (Abdalrahman) - المدير
- الشيخ عيسى (Sheikh Issa) - المالك
- أحمد (Ahmad) - مدير المشاريع

الفئات المتاحة:
- تصميم (Design)
- عقود (Contracts)
- تراخيص (Permits)
- مالية (Finance)
- أرشفة (Archiving)
- تقييم (Evaluation)
- اجتماعات (Meetings)
- متابعة (Follow-up)
- عام (General)

قم بتحليل البريد الإلكتروني واستخراج المهام. لكل مهمة حدد:
- title: عنوان المهمة بالعربية
- description: وصف مختصر
- project: اسم المشروع (من القائمة أعلاه)
- category: الفئة
- owner: المسؤول
- priority: high/medium/low
- dueDate: تاريخ الاستحقاق إن وجد (YYYY-MM-DD)

إذا لم يكن هناك مهام قابلة للتنفيذ، أرجع مصفوفة فارغة.`,
        },
        {
          role: "user",
          content: emailContent,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "email_tasks",
          strict: true,
          schema: {
            type: "object",
            properties: {
              tasks: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    description: { type: "string" },
                    project: { type: "string" },
                    category: { type: "string" },
                    owner: { type: "string" },
                    priority: { type: "string", enum: ["high", "medium", "low"] },
                    dueDate: { type: "string" },
                  },
                  required: ["title", "description", "project", "category", "owner", "priority", "dueDate"],
                  additionalProperties: false,
                },
              },
              summary: { type: "string" },
            },
            required: ["tasks", "summary"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = llmResponse.choices[0]?.message?.content;
    if (!content || typeof content !== "string") {
      await bot.sendMessage(chatId, "⚠️ لم أتمكن من تحليل البريد الإلكتروني");
      return;
    }

    const parsed = JSON.parse(content);

    if (parsed.tasks.length === 0) {
      await bot.sendMessage(chatId,
        `📧 *تحليل البريد الإلكتروني*\n\n` +
        `📝 الملخص: ${parsed.summary}\n\n` +
        `ℹ️ لم أجد مهام قابلة للتنفيذ في هذا البريد.`,
        { parse_mode: "Markdown" }
      );
      return;
    }

    // Create tasks
    const createdTasks: any[] = [];
    for (const task of parsed.tasks) {
      const result = await db.insert(tasks).values({
        title: task.title,
        description: task.description || null,
        project: task.project,
        category: task.category || null,
        owner: task.owner,
        priority: task.priority || "medium",
        status: "new",
        progress: 0,
        dueDate: task.dueDate && task.dueDate !== "" ? task.dueDate : null,
        source: "agent",
        sourceAgent: "سلوى-تيليجرام",
      });

      createdTasks.push({
        id: result[0].insertId,
        ...task,
      });
    }

    await logActivity(
      "سلوى",
      "telegram_email_parsed",
      `تحليل إيميل من تيليجرام → ${createdTasks.length} مهام`,
    );

    // Send result
    let message = `📧 *تحليل البريد الإلكتروني*\n\n`;
    message += `📝 *الملخص:* ${parsed.summary}\n\n`;
    message += `✅ *تم إنشاء ${createdTasks.length} مهام:*\n\n`;

    for (const t of createdTasks) {
      const priorityIcon = getPriorityIcon(t.priority);
      message += `${priorityIcon} *${t.title}*\n`;
      message += `   📁 ${t.project} | 👤 ${t.owner}`;
      if (t.dueDate) message += ` | 📅 ${t.dueDate}`;
      message += `\n\n`;
    }

    await bot.sendMessage(chatId, message, { parse_mode: "Markdown" });

    // Notify owner
    try {
      await notifyOwner({
        title: `سلوى أنشأت ${createdTasks.length} مهام من تيليجرام`,
        content: `تم تحليل بريد إلكتروني وإنشاء ${createdTasks.length} مهام:\n${createdTasks.map(t => `• ${t.title} (${t.project})`).join("\n")}`,
      });
    } catch {
      // notification is optional
    }
  } catch (error: any) {
    console.error("[TelegramBot] Email analysis error:", error);
    await bot.sendMessage(chatId, `⚠️ فشل تحليل البريد: ${error.message}`);
  }
}

/**
 * Handle free-text messages using AI
 */
async function handleFreeText(
  bot: TelegramBot,
  chatId: number,
  text: string,
  msg: TelegramBot.Message
) {
  try {
    // Quick task creation pattern: "مهمة جديدة: ..."
    if (text.startsWith("مهمة جديدة:") || text.startsWith("مهمة:")) {
      const taskTitle = text.replace(/^مهمة\s*(جديدة)?:\s*/, "").trim();
      if (taskTitle) {
        await quickCreateTask(bot, chatId, taskTitle);
        return;
      }
    }

    // Use AI to understand the message
    const llmResponse = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `أنت سلوى - المساعدة التنفيذية الذكية لشركة كومو للتطوير العقاري (COMO Developments) في دبي.
أنتِ تنسقين بين فريق من الوكلاء المتخصصين:
- خازن: مدير الأرشفة والتخزين
- فاروق: محامي خبير (العقود والقانون)
- براق: مراقب التنفيذ والجدول الزمني
- خالد: مدقق الجودة والامتثال الفني
- قاسم: المدير المالي
- باز: المستشار الاستراتيجي
- جويل: محللة دراسات الجدوى والسوق

حللي رسالة المستخدم وحددي نيته.

الإجراءات المتاحة:
1. "create_task" - إنشاء مهمة جديدة
2. "query_tasks" - استعلام عن المهام
3. "search_files" - البحث في الملفات
4. "general_response" - رد عام / محادثة

المشاريع: الجداف، مجان، ند الشبا، الفلل، المول، عام
المسؤولون: عبدالرحمن، أحمد، الشيخ عيسى

أجيبي بصيغة JSON فقط.`,
        },
        {
          role: "user",
          content: text,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "intent_analysis",
          strict: true,
          schema: {
            type: "object",
            properties: {
              intent: {
                type: "string",
                enum: ["create_task", "query_tasks", "search_files", "general_response"],
              },
              task_data: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  project: { type: "string" },
                  owner: { type: "string" },
                  priority: { type: "string" },
                  description: { type: "string" },
                },
                required: ["title", "project", "owner", "priority", "description"],
                additionalProperties: false,
              },
              search_query: { type: "string" },
              response_text: { type: "string" },
            },
            required: ["intent", "task_data", "search_query", "response_text"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = llmResponse.choices[0]?.message?.content;
    if (!content || typeof content !== "string") {
      await bot.sendMessage(chatId, "عذراً، لم أفهم طلبك. جرب /help لعرض الأوامر المتاحة.");
      return;
    }

    const parsed = JSON.parse(content);

    switch (parsed.intent) {
      case "create_task":
        if (parsed.task_data?.title) {
          const db = await getDb();
          if (!db) {
            await bot.sendMessage(chatId, "⚠️ قاعدة البيانات غير متاحة");
            return;
          }

          const result = await db.insert(tasks).values({
            title: parsed.task_data.title,
            description: parsed.task_data.description || null,
            project: parsed.task_data.project || "عام",
            category: null,
            owner: parsed.task_data.owner || "عبدالرحمن",
            priority: (parsed.task_data.priority as "high" | "medium" | "low") || "medium",
            status: "new",
            progress: 0,
            source: "agent",
            sourceAgent: "سلوى-تيليجرام",
          });

          await logActivity("سلوى", "telegram_ai_task", `مهمة ذكية: ${parsed.task_data.title}`, parsed.task_data.project);

          const priorityIcon = getPriorityIcon(parsed.task_data.priority);
          await bot.sendMessage(chatId,
            `✅ *فهمت! تم إنشاء المهمة:*\n\n` +
            `📌 *${parsed.task_data.title}*\n` +
            `📁 المشروع: ${parsed.task_data.project || "عام"}\n` +
            `👤 المسؤول: ${parsed.task_data.owner || "عبدالرحمن"}\n` +
            `${priorityIcon} الأولوية: ${parsed.task_data.priority || "medium"}\n` +
            (parsed.task_data.description ? `📝 ${parsed.task_data.description}\n` : "") +
            `\n🤖 تم إنشاؤها بواسطة سلوى (تحليل ذكي)`,
            { parse_mode: "Markdown" }
          );
        }
        break;

      case "search_files":
        if (parsed.search_query) {
          try {
            await bot.sendMessage(chatId, `🔍 جاري البحث عن "${parsed.search_query}"...`);
            const files = await searchFiles(parsed.search_query);

            if (files.length === 0) {
              await bot.sendMessage(chatId, `لم أجد ملفات تطابق "${parsed.search_query}"`);
            } else {
              let message = `📁 *نتائج البحث:*\n\n`;
              for (const f of files.slice(0, 8)) {
                const icon = getFileIcon(f.mimeType);
                const link = f.webViewLink ? ` [فتح](${f.webViewLink})` : "";
                message += `${icon} ${f.name}${link}\n`;
              }
              await bot.sendMessage(chatId, message, {
                parse_mode: "Markdown",
                disable_web_page_preview: true,
              });
            }
          } catch (error: any) {
            await bot.sendMessage(chatId, `⚠️ خطأ في البحث: ${error.message}`);
          }
        }
        break;

      case "query_tasks":
        // Redirect to tasks command
        await bot.sendMessage(chatId, parsed.response_text || "استخدم /tasks لعرض المهام أو /mytasks لعرض مهامك.");
        break;

      case "general_response":
      default:
        await bot.sendMessage(chatId, parsed.response_text || "كيف يمكنني مساعدتك؟ اكتب /help لعرض الأوامر.");
        break;
    }
  } catch (error: any) {
    console.error("[TelegramBot] Free text error:", error);
    await bot.sendMessage(chatId, "عذراً، حدث خطأ في معالجة رسالتك. جرب /help لعرض الأوامر المتاحة.");
  }
}

/**
 * Quick task creation from "مهمة جديدة: ..." pattern
 */
async function quickCreateTask(bot: TelegramBot, chatId: number, title: string) {
  try {
    const db = await getDb();
    if (!db) {
      await bot.sendMessage(chatId, "⚠️ قاعدة البيانات غير متاحة");
      return;
    }

    const result = await db.insert(tasks).values({
      title,
      description: null,
      project: "عام",
      category: null,
      owner: "عبدالرحمن",
      priority: "medium",
      status: "new",
      progress: 0,
      source: "command",
      sourceAgent: "سلوى-تيليجرام",
    });

    await logActivity("سلوى", "telegram_quick_task", `مهمة سريعة: ${title}`);

    await bot.sendMessage(chatId,
      `✅ *تم إنشاء مهمة سريعة:*\n\n` +
      `📌 *${title}*\n` +
      `📁 المشروع: عام\n` +
      `👤 المسؤول: عبدالرحمن\n` +
      `🟡 الأولوية: متوسطة\n\n` +
      `💡 لتخصيص المهمة، استخدم /newtask`,
      { parse_mode: "Markdown" }
    );
  } catch (error: any) {
    console.error("[TelegramBot] Quick task error:", error);
    await bot.sendMessage(chatId, `⚠️ فشل إنشاء المهمة: ${error.message}`);
  }
}

/**
 * Handle voice messages - download, upload to S3, transcribe, then process as text
 */
async function handleVoiceMessage(
  bot: TelegramBot,
  chatId: number,
  msg: TelegramBot.Message
) {
  try {
    const voice = msg.voice || msg.audio;
    if (!voice) {
      await bot.sendMessage(chatId, "⚠️ لم أتمكن من قراءة الرسالة الصوتية");
      return;
    }

    // Check file size (16MB limit)
    const fileSizeMB = (voice.file_size || 0) / (1024 * 1024);
    if (fileSizeMB > 16) {
      await bot.sendMessage(chatId, `⚠️ الملف الصوتي كبير جداً (${fileSizeMB.toFixed(1)}MB). الحد الأقصى 16MB.`);
      return;
    }

    await bot.sendMessage(chatId, "🎙️ جاري الاستماع إلى رسالتك الصوتية...");

    // Get file link from Telegram
    const fileLink = await bot.getFileLink(voice.file_id);

    // Download the audio file
    const audioResponse = await fetch(fileLink);
    if (!audioResponse.ok) {
      await bot.sendMessage(chatId, "⚠️ فشل تحميل الملف الصوتي من تيليجرام");
      return;
    }

    const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
    const mimeType = voice.mime_type || "audio/ogg";
    const ext = mimeType.includes("ogg") ? "ogg" : mimeType.includes("mp3") ? "mp3" : "ogg";

    // Upload to S3
    const fileKey = `telegram-voice/${chatId}-${Date.now()}.${ext}`;
    const { url: audioUrl } = await storagePut(fileKey, audioBuffer, mimeType);

    // Transcribe using Whisper
    const result = await transcribeAudio({
      audioUrl,
      language: "ar",
      prompt: "تحويل رسالة صوتية عربية إلى نص. قد تحتوي على أسماء مشاريع مثل الجداف، مجان، ند الشبا، الفلل، المول.",
    });

    if ("error" in result) {
      await bot.sendMessage(chatId, `⚠️ فشل تحويل الصوت إلى نص: ${result.error}`);
      return;
    }

    const transcribedText = result.text?.trim();
    if (!transcribedText) {
      await bot.sendMessage(chatId, "⚠️ لم أتمكن من فهم الرسالة الصوتية. حاول مرة أخرى بصوت أوضح.");
      return;
    }

    // Show the transcribed text
    await bot.sendMessage(chatId,
      `🎙️ *سمعتك:*\n\n"${transcribedText}"\n\n⏳ جاري معالجة طلبك...`,
      { parse_mode: "Markdown" }
    );

    // Log the voice activity
    await logActivity("سلوى", "telegram_voice", `رسالة صوتية: ${transcribedText.substring(0, 100)}`);

    // Check if there's an active conversation
    const convo = conversations.get(chatId);
    if (convo) {
      await handleConversation(bot, chatId, transcribedText, convo, msg);
      return;
    }

    // Process the transcribed text as free text
    await handleFreeText(bot, chatId, transcribedText, msg);

  } catch (error: any) {
    console.error("[TelegramBot] Voice message error:", error);
    await bot.sendMessage(chatId, `⚠️ حدث خطأ في معالجة الرسالة الصوتية: ${error.message}`);
  }
}

// ============================================================
// Helper functions
// ============================================================

function getStatusIcon(status: string): string {
  const icons: Record<string, string> = {
    new: "🆕",
    progress: "🔄",
    hold: "⏸",
    done: "✅",
    cancelled: "❌",
  };
  return icons[status] || "📌";
}

function getPriorityIcon(priority: string): string {
  const icons: Record<string, string> = {
    high: "🔴",
    medium: "🟡",
    low: "🟢",
  };
  return icons[priority] || "🟡";
}

function getFileIcon(mimeType: string): string {
  if (mimeType.includes("folder")) return "📁";
  if (mimeType.includes("pdf")) return "📕";
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return "📊";
  if (mimeType.includes("document") || mimeType.includes("word")) return "📄";
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint")) return "📑";
  if (mimeType.includes("image")) return "🖼";
  if (mimeType.includes("video")) return "🎬";
  if (mimeType.includes("audio")) return "🎵";
  if (mimeType.includes("zip") || mimeType.includes("archive")) return "📦";
  return "📎";
}

async function logActivity(
  agentName: string,
  action: string,
  details: string,
  project?: string
) {
  try {
    const db = await getDb();
    if (!db) return;
    await db.execute(
      sql`INSERT INTO agentActivityLog (agentName, action, details, project) VALUES (${agentName}, ${action}, ${details}, ${project || null})`
    );
  } catch (e) {
    try {
      const db = await getDb();
      if (!db) return;
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS agentActivityLog (
          id INT AUTO_INCREMENT PRIMARY KEY,
          agentName VARCHAR(255) NOT NULL,
          action VARCHAR(100) NOT NULL,
          details TEXT,
          project VARCHAR(255),
          createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await db.execute(
        sql`INSERT INTO agentActivityLog (agentName, action, details, project) VALUES (${agentName}, ${action}, ${details}, ${project || null})`
      );
    } catch (e2) {
      console.warn("[TelegramBot] Failed to log activity:", e2);
    }
  }
}

/**
 * Send a message to a specific chat (for external use)
 */
export async function sendTelegramMessage(chatId: number, text: string, parseMode?: "Markdown" | "HTML"): Promise<boolean> {
  if (!bot) return false;
  try {
    await bot.sendMessage(chatId, text, { parse_mode: parseMode });
    return true;
  } catch (error) {
    console.error("[TelegramBot] Send message error:", error);
    return false;
  }
}

/**
 * Get bot info
 */
export async function getBotInfo(): Promise<{ username: string; firstName: string; id: number } | null> {
  if (!bot) return null;
  try {
    const me = await bot.getMe();
    return {
      username: me.username || "",
      firstName: me.first_name,
      id: me.id,
    };
  } catch {
    return null;
  }
}
