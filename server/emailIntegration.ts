import { fetchNewEmails, markAsProcessed, sendReply, EmailMessage, markAsSeen } from "./emailMonitor";
import { invokeLLM } from "./_core/llm";
import { storagePut } from "./storage";
import { searchFiles, getDriveClient } from "./googleDrive";
import { Readable } from "stream";

/**
 * Email-Telegram Integration with Agent Routing
 * 
 * Flow:
 * 1. سلوى تفحص الإيميل -> تجد رسائل جديدة
 * 2. سلوى تشعر المالك على تيليجرام بملخص كل إيميل
 * 3. المالك يقرر: رد / تجاهل / توجيه لوكيل
 * 4. خازن يأرشف المرفقات في Google Drive
 * 5. فاروق يحلل العروض الاستشارية ويستخرج الأتعاب
 * 6. سلوى تحدث المنصة بالنتائج
 */

// Types
interface PendingEmail {
  email: EmailMessage;
  notifiedAt: Date;
  status: "pending" | "replied" | "archived" | "ignored";
  farouqAnalysis?: FarouqAnalysis;
}

interface FarouqAnalysis {
  consultantName: string;
  proposalType: string;
  totalFees: string;
  designFees?: string;
  supervisionFees?: string;
  currency: string;
  summary: string;
  notes: string[];
  projectMentioned?: string;
}

interface ReplyDraft {
  uid: number;
  stage: "waiting_approval" | "waiting_custom";
  suggestedReply?: string;
}

// State
const pendingEmails = new Map<string, PendingEmail>();
const replyDrafts = new Map<number, ReplyDraft>();
let ownerChatId: number | null = null;
let botInstance: any = null;

export function initEmailIntegration(bot: any, chatId: number) {
  botInstance = bot;
  ownerChatId = chatId;
  console.log("[EmailIntegration] Initialized with chatId:", chatId);
}

export function setOwnerChatId(chatId: number) {
  ownerChatId = chatId;
}

// Main: Check emails and notify owner
export async function checkAndNotifyEmails(): Promise<number> {
  if (!botInstance || !ownerChatId) {
    console.warn("[EmailIntegration] Bot or chatId not initialized");
    return 0;
  }

  try {
    const newEmails = await fetchNewEmails();
    if (newEmails.length === 0) return 0;

    console.log("[EmailIntegration] Found " + newEmails.length + " new emails");

    for (const email of newEmails) {
      const key = "uid_" + email.uid;
      if (pendingEmails.has(key)) continue;

      pendingEmails.set(key, {
        email,
        notifiedAt: new Date(),
        status: "pending",
      });

      markAsProcessed(email.uid);
      await notifyOwnerAboutEmail(email);
    }

    return newEmails.length;
  } catch (error) {
    console.error("[EmailIntegration] Check error:", error);
    if (botInstance && ownerChatId) {
      await botInstance.sendMessage(ownerChatId, "⚠️ خطأ في فحص الإيميل: " + (error as Error).message);
    }
    return 0;
  }
}

async function notifyOwnerAboutEmail(email: EmailMessage) {
  const attachmentInfo = email.attachments.length > 0
    ? "\n📎 المرفقات: " + email.attachments.length + " ملف (" + email.attachments.map(a => a.filename).join(", ") + ")"
    : "";

  const preview = email.textBody
    ? email.textBody.substring(0, 300).replace(/\n{3,}/g, "\n\n")
    : "(لا يوجد نص)";

  const message = "📧 إيميل جديد\n\n" +
    "👤 من: " + email.fromName + " (" + email.from + ")\n" +
    "📌 الموضوع: " + email.subject + "\n" +
    "📅 التاريخ: " + email.date.toLocaleDateString("ar-AE", { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }) +
    attachmentInfo + "\n\n" +
    "📝 المحتوى:\n" + preview + (email.textBody.length > 300 ? "..." : "");

  const keyboard = {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "✉️ رد عليه", callback_data: "email_reply_" + email.uid },
          { text: "🗂️ أرشف (خازن)", callback_data: "email_archive_" + email.uid },
        ],
        [
          { text: "📋 حلل العرض (فاروق)", callback_data: "email_analyze_" + email.uid },
          { text: "✅ تم", callback_data: "email_done_" + email.uid },
        ],
      ],
    },
  };

  try {
    await botInstance.sendMessage(ownerChatId!, message, keyboard);
  } catch (err) {
    console.error("[EmailIntegration] Failed to send notification:", err);
  }
}

// Handle email callback actions from Telegram buttons
export async function handleEmailCallback(
  bot: any,
  chatId: number,
  callbackData: string,
  callbackQueryId: string
): Promise<boolean> {
  const replyMatch = callbackData.match(/^email_reply_(\d+)$/);
  const archiveMatch = callbackData.match(/^email_archive_(\d+)$/);
  const analyzeMatch = callbackData.match(/^email_analyze_(\d+)$/);
  const doneMatch = callbackData.match(/^email_done_(\d+)$/);
  const confirmReplyMatch = callbackData.match(/^email_confirm_reply_(\d+)$/);
  const editReplyMatch = callbackData.match(/^email_edit_reply_(\d+)$/);

  if (replyMatch) {
    await handleReplyAction(bot, chatId, parseInt(replyMatch[1]), callbackQueryId);
    return true;
  }
  if (archiveMatch) {
    await handleArchiveAction(bot, chatId, parseInt(archiveMatch[1]), callbackQueryId);
    return true;
  }
  if (analyzeMatch) {
    await handleAnalyzeAction(bot, chatId, parseInt(analyzeMatch[1]), callbackQueryId);
    return true;
  }
  if (doneMatch) {
    await handleDoneAction(bot, chatId, parseInt(doneMatch[1]), callbackQueryId);
    return true;
  }
  if (confirmReplyMatch) {
    await handleConfirmReply(bot, chatId, parseInt(confirmReplyMatch[1]), callbackQueryId);
    return true;
  }
  if (editReplyMatch) {
    await bot.answerCallbackQuery(callbackQueryId, { text: "اكتب الرد الذي تريده" });
    await bot.sendMessage(chatId, "✏️ اكتب الرد الذي تريد إرساله:");
    replyDrafts.set(chatId, { uid: parseInt(editReplyMatch[1]), stage: "waiting_custom" });
    return true;
  }

  return false;
}

// Reply handling
async function handleReplyAction(bot: any, chatId: number, uid: number, callbackQueryId: string) {
  const pending = pendingEmails.get("uid_" + uid);
  if (!pending) {
    await bot.answerCallbackQuery(callbackQueryId, { text: "الإيميل غير موجود" });
    return;
  }

  await bot.answerCallbackQuery(callbackQueryId, { text: "⏳ سلوى تحضر رد مقترح..." });

  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "أنت مساعد شركة Como Developments للتطوير العقاري في دبي. اكتب رد إيميل مهني ومختصر باللغة الإنجليزية. الرد يجب أن يكون مهذب ومهني، يؤكد استلام الإيميل، يشكر المرسل، يخبرهم أننا سنراجع المحتوى ونتواصل معهم الأسبوع القادم، ويوقع باسم Abdalrahman Zaqout, Como Developments. اكتب الرد فقط بدون أي شرح إضافي."
        },
        {
          role: "user",
          content: "اكتب رد على هذا الإيميل:\n\nمن: " + pending.email.fromName + " (" + pending.email.from + ")\nالموضوع: " + pending.email.subject + "\nالمحتوى:\n" + pending.email.textBody.substring(0, 1000)
        }
      ],
    });

    const suggestedReply = (typeof response.choices?.[0]?.message?.content === 'string' ? response.choices[0].message.content : '') || "";

    replyDrafts.set(chatId, {
      uid,
      stage: "waiting_approval",
      suggestedReply,
    });

    await bot.sendMessage(chatId,
      "📝 رد مقترح من سلوى:\n\n" + suggestedReply + "\n\nإلى: " + pending.email.from + "\nالموضوع: Re: " + pending.email.subject,
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "✅ أرسل هذا الرد", callback_data: "email_confirm_reply_" + uid },
              { text: "✏️ عدّل الرد", callback_data: "email_edit_reply_" + uid },
            ],
          ],
        },
      }
    );
  } catch (error) {
    console.error("[EmailIntegration] Reply generation error:", error);
    await bot.sendMessage(chatId, "⚠️ فشل إنشاء الرد المقترح. اكتب الرد يدوياً:");
    replyDrafts.set(chatId, { uid, stage: "waiting_custom" });
  }
}

async function handleConfirmReply(bot: any, chatId: number, uid: number, callbackQueryId: string) {
  const draft = replyDrafts.get(chatId);
  const pending = pendingEmails.get("uid_" + uid);

  if (!draft || !pending || !draft.suggestedReply) {
    await bot.answerCallbackQuery(callbackQueryId, { text: "انتهت صلاحية الرد" });
    return;
  }

  await bot.answerCallbackQuery(callbackQueryId, { text: "⏳ جاري الإرسال..." });

  try {
    const htmlBody = draft.suggestedReply.replace(/\n/g, "<br>");
    const success = await sendReply(
      pending.email.from,
      pending.email.subject,
      htmlBody,
      pending.email.messageId
    );

    if (success) {
      pending.status = "replied";
      await markAsSeen(uid);
      await bot.sendMessage(chatId, "✅ تم إرسال الرد بنجاح إلى " + pending.email.from);
    } else {
      await bot.sendMessage(chatId, "⚠️ فشل إرسال الرد. حاول مرة أخرى.");
    }
  } catch (error) {
    console.error("[EmailIntegration] Send reply error:", error);
    await bot.sendMessage(chatId, "⚠️ خطأ في الإرسال: " + (error as Error).message);
  }

  replyDrafts.delete(chatId);
}

// Handle custom reply text from user
export async function handleCustomReplyText(bot: any, chatId: number, text: string): Promise<boolean> {
  const draft = replyDrafts.get(chatId);
  if (!draft || draft.stage !== "waiting_custom") return false;

  const pending = pendingEmails.get("uid_" + draft.uid);
  if (!pending) {
    replyDrafts.delete(chatId);
    return false;
  }

  try {
    const htmlBody = text.replace(/\n/g, "<br>");
    const success = await sendReply(
      pending.email.from,
      pending.email.subject,
      htmlBody,
      pending.email.messageId
    );

    if (success) {
      pending.status = "replied";
      await markAsSeen(draft.uid);
      await bot.sendMessage(chatId, "✅ تم إرسال ردك بنجاح إلى " + pending.email.from);
    } else {
      await bot.sendMessage(chatId, "⚠️ فشل إرسال الرد.");
    }
  } catch (error) {
    await bot.sendMessage(chatId, "⚠️ خطأ: " + (error as Error).message);
  }

  replyDrafts.delete(chatId);
  return true;
}

// خازن: Archive to Google Drive
async function handleArchiveAction(bot: any, chatId: number, uid: number, callbackQueryId: string) {
  const pending = pendingEmails.get("uid_" + uid);
  if (!pending) {
    await bot.answerCallbackQuery(callbackQueryId, { text: "الإيميل غير موجود" });
    return;
  }

  if (pending.email.attachments.length === 0) {
    await bot.answerCallbackQuery(callbackQueryId, { text: "لا توجد مرفقات للأرشفة" });
    await bot.sendMessage(chatId, "📂 خازن: لا توجد مرفقات في هذا الإيميل للأرشفة.");
    return;
  }

  await bot.answerCallbackQuery(callbackQueryId, { text: "⏳ خازن يعمل على الأرشفة..." });
  await bot.sendMessage(chatId, "🗂️ خازن يعمل...\nجاري أرشفة " + pending.email.attachments.length + " مرفق(ات) من " + pending.email.fromName);

  try {
    const archivedFiles: string[] = [];

    for (const att of pending.email.attachments) {
      if (att.content) {
        const safeFilename = att.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
        const fileKey = "email-attachments/" + pending.email.from + "/" + Date.now() + "-" + safeFilename;
        const { url } = await storagePut(fileKey, att.content, att.contentType);
        archivedFiles.push(att.filename + " -> " + url);
      }
    }

    // Try Google Drive upload
    let driveResult = "";
    try {
      const drive = getDriveClient();
      const folders = await searchFiles("CONSULTANCY_PROPOSALS");
      const targetFolder = folders.find(f => f.mimeType === "application/vnd.google-apps.folder");
      
      if (targetFolder) {
        for (const att of pending.email.attachments) {
          if (att.content) {
            const stream = new Readable();
            stream.push(att.content);
            stream.push(null);
            
            await drive.files.create({
              requestBody: {
                name: "[" + pending.email.fromName + "] " + att.filename,
                parents: [targetFolder.id],
              },
              media: {
                mimeType: att.contentType,
                body: stream,
              },
              supportsAllDrives: true,
            });
          }
        }
        driveResult = "\n📁 تم الرفع أيضاً إلى Google Drive (مجلد CONSULTANCY_PROPOSALS)";
      }
    } catch (driveErr) {
      driveResult = "\n⚠️ لم يتم الرفع إلى Google Drive: " + (driveErr as Error).message;
    }

    pending.status = "archived";
    await markAsSeen(uid);

    const resultMsg = "✅ خازن أنهى الأرشفة\n\n" +
      "📧 من: " + pending.email.fromName + "\n" +
      "📎 الملفات:\n" + archivedFiles.map(f => "  • " + f).join("\n") +
      driveResult;

    await bot.sendMessage(chatId, resultMsg);
  } catch (error) {
    console.error("[EmailIntegration] Archive error:", error);
    await bot.sendMessage(chatId, "⚠️ خازن: فشل في الأرشفة: " + (error as Error).message);
  }
}

// فاروق: Analyze consultant proposal
async function handleAnalyzeAction(bot: any, chatId: number, uid: number, callbackQueryId: string) {
  const pending = pendingEmails.get("uid_" + uid);
  if (!pending) {
    await bot.answerCallbackQuery(callbackQueryId, { text: "الإيميل غير موجود" });
    return;
  }

  await bot.answerCallbackQuery(callbackQueryId, { text: "⏳ فاروق يحلل العرض..." });
  await bot.sendMessage(chatId, "📋 فاروق يعمل...\nجاري تحليل عرض " + pending.email.fromName);

  try {
    const emailContent = "من: " + pending.email.fromName + " (" + pending.email.from + ")\n" +
      "الموضوع: " + pending.email.subject + "\n" +
      "التاريخ: " + pending.email.date.toISOString() + "\n" +
      "المحتوى:\n" + pending.email.textBody + "\n\n" +
      "المرفقات: " + (pending.email.attachments.map(a => a.filename + " (" + a.contentType + ", " + Math.round(a.size / 1024) + "KB)").join(", ") || "لا يوجد");

    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "أنت فاروق، محلل قانوني ومالي في شركة Como Developments للتطوير العقاري في دبي. مهمتك تحليل عروض الاستشاريين الهندسيين واستخراج: اسم الاستشاري، نوع العرض (تصميم/إشراف/كلاهما/أخرى)، قيمة الأتعاب، ملخص، وملاحظات. أجب بصيغة JSON."
        },
        {
          role: "user",
          content: "حلل هذا الإيميل واستخرج معلومات العرض الاستشاري:\n\n" + emailContent
        }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "proposal_analysis",
          strict: true,
          schema: {
            type: "object",
            properties: {
              consultantName: { type: "string", description: "اسم الاستشاري" },
              proposalType: { type: "string", description: "design, supervision, both, other" },
              totalFees: { type: "string", description: "الأتعاب الإجمالية" },
              designFees: { type: "string", description: "أتعاب التصميم" },
              supervisionFees: { type: "string", description: "أتعاب الإشراف" },
              currency: { type: "string", description: "العملة" },
              summary: { type: "string", description: "ملخص العرض" },
              notes: { type: "array", items: { type: "string" }, description: "ملاحظات" },
              projectMentioned: { type: "string", description: "المشروع المذكور" },
            },
            required: ["consultantName", "proposalType", "totalFees", "designFees", "supervisionFees", "currency", "summary", "notes", "projectMentioned"],
            additionalProperties: false,
          },
        },
      },
    });

    const analysisText = (typeof response.choices?.[0]?.message?.content === 'string' ? response.choices[0].message.content : '') || "{}";
    let analysis: FarouqAnalysis;
    
    try {
      analysis = JSON.parse(analysisText);
    } catch {
      analysis = {
        consultantName: pending.email.fromName,
        proposalType: "other",
        totalFees: "غير محدد",
        currency: "AED",
        summary: "لم يتمكن فاروق من تحليل العرض تلقائياً. يرجى المراجعة اليدوية.",
        notes: ["يحتاج مراجعة يدوية"],
      };
    }

    pending.farouqAnalysis = analysis;

    const typeMap: Record<string, string> = { design: "تصميم", supervision: "إشراف", both: "تصميم وإشراف", other: "أخرى" };

    const resultMsg = "📋 تقرير فاروق — تحليل العرض\n\n" +
      "🏢 الاستشاري: " + analysis.consultantName + "\n" +
      "📄 نوع العرض: " + (typeMap[analysis.proposalType] || analysis.proposalType) + "\n" +
      "💰 الأتعاب الإجمالية: " + analysis.totalFees + " " + analysis.currency + "\n" +
      (analysis.designFees ? "  🎨 تصميم: " + analysis.designFees + " " + analysis.currency + "\n" : "") +
      (analysis.supervisionFees ? "  👷 إشراف: " + analysis.supervisionFees + " " + analysis.currency + "\n" : "") +
      (analysis.projectMentioned ? "\n🏗️ المشروع: " + analysis.projectMentioned + "\n" : "") +
      "\n📝 الملخص:\n" + analysis.summary + "\n" +
      (analysis.notes && analysis.notes.length > 0 ? "\n⚠️ ملاحظات:\n" + analysis.notes.map(n => "  • " + n).join("\n") : "");

    await bot.sendMessage(chatId, resultMsg, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✉️ رد عليه", callback_data: "email_reply_" + uid },
            { text: "🗂️ أرشف (خازن)", callback_data: "email_archive_" + uid },
          ],
          [
            { text: "✅ تم", callback_data: "email_done_" + uid },
          ],
        ],
      },
    });
  } catch (error) {
    console.error("[EmailIntegration] Analysis error:", error);
    await bot.sendMessage(chatId, "⚠️ فاروق: فشل في التحليل: " + (error as Error).message);
  }
}

// Done action
async function handleDoneAction(bot: any, chatId: number, uid: number, callbackQueryId: string) {
  const pending = pendingEmails.get("uid_" + uid);
  if (!pending) {
    await bot.answerCallbackQuery(callbackQueryId, { text: "تم" });
    return;
  }

  pending.status = "ignored";
  await markAsSeen(uid);
  await bot.answerCallbackQuery(callbackQueryId, { text: "✅ تم" });
  await bot.sendMessage(chatId, "✅ تم — إيميل \"" + pending.email.subject + "\" من " + pending.email.fromName + " تم تعليمه كمقروء.");
}

// Helpers
export function hasPendingReply(chatId: number): boolean {
  return replyDrafts.has(chatId);
}

export function getPendingCount(): number {
  return Array.from(pendingEmails.values()).filter(e => e.status === "pending").length;
}

export function getPendingEmailsInfo() {
  return Array.from(pendingEmails.entries()).map(([_key, val]) => ({
    uid: val.email.uid,
    from: val.email.from,
    fromName: val.email.fromName,
    subject: val.email.subject,
    date: val.email.date,
    status: val.status,
    hasAnalysis: !!val.farouqAnalysis,
    attachmentCount: val.email.attachments.length,
  }));
}
