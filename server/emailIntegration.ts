import { fetchNewEmails, fetchEmailsSince, fetchEmailByUID, markAsProcessed, sendReply, EmailMessage, markAsSeen } from "./emailMonitor";
import { invokeLLM } from "./_core/llm";
import { storagePut } from "./storage";
import { searchFiles, getDriveClient, createFolder } from "./googleDrive";
import { Readable } from "stream";
import { getDb } from "./db";
import { consultants, projects, financialData, projectConsultants, feasibilityStudies, consultantProfiles } from "../drizzle/schema";
import { eq, and, like } from "drizzle-orm";

/**
 * Email-Telegram Integration with Agent Routing
 * 
 * Flow:
 * 1. سلوى تفحص الإيميل -> تجد رسائل جديدة
 * 2. سلوى تشعر المالك على تيليجرام بملخص كل إيميل
 * 3. المالك يقرر: رد / تجاهل / توجيه لوكيل
 * 4. خازن يأرشف المرفقات في Google Drive
 * 5. فاروق يحلل العروض الاستشارية ويستخرج الأتعاب (يقرأ المرفقات)
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
  documentType: string; // "consultant_proposal" | "feasibility_study" | "contract" | "report" | "other"
  consultantName: string;
  consultantEmail?: string;
  proposalType: string;
  totalFees: string;
  designFees?: string;
  supervisionFees?: string;
  designFeesPct?: string;
  supervisionFeesPct?: string;
  currency: string;
  summary: string;
  notes: string[];
  projectMentioned?: string;
  // Feasibility study fields
  plotArea?: string;
  totalGfa?: string;
  estimatedBua?: string;
  numberOfUnits?: string;
  constructionCost?: string;
  projectValue?: string;
  landPrice?: string;
  // Platform update status
  platformUpdated?: boolean;
  platformUpdateDetails?: string;
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

// ─── Main: Check new (unseen) emails and notify owner ──────────────
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

// ─── Check last 48 hours (read + unread) ───────────────────────────
export async function checkLast48HoursEmails(): Promise<number> {
  if (!botInstance || !ownerChatId) {
    console.warn("[EmailIntegration] Bot or chatId not initialized");
    return 0;
  }

  try {
    const emails = await fetchEmailsSince(48);
    if (emails.length === 0) {
      await botInstance.sendMessage(ownerChatId, "📭 لا توجد إيميلات في آخر 48 ساعة.");
      return 0;
    }

    // Summary message
    const readCount = emails.filter(e => e.isRead).length;
    const unreadCount = emails.filter(e => !e.isRead).length;
    const withAttachments = emails.filter(e => e.attachments.length > 0).length;

    let summaryMsg = "📧 تقرير الإيميلات — آخر 48 ساعة\n\n";
    summaryMsg += "📊 الإحصائيات:\n";
    summaryMsg += "  • إجمالي: " + emails.length + " إيميل\n";
    summaryMsg += "  • غير مقروء: " + unreadCount + "\n";
    summaryMsg += "  • مقروء: " + readCount + "\n";
    summaryMsg += "  • مع مرفقات: " + withAttachments + "\n\n";
    summaryMsg += "📋 القائمة:\n";

    for (const email of emails.slice(0, 20)) {
      const readIcon = email.isRead ? "✅" : "🔴";
      const attachIcon = email.attachments.length > 0 ? " 📎" : "";
      const dateStr = email.date.toLocaleDateString("ar-AE", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
      summaryMsg += readIcon + " " + email.fromName + " — " + email.subject.substring(0, 50) + attachIcon + " (" + dateStr + ")\n";

      // Add to pending for actions
      const key = "uid_" + email.uid;
      if (!pendingEmails.has(key)) {
        pendingEmails.set(key, {
          email,
          notifiedAt: new Date(),
          status: "pending",
        });
      }
    }

    if (emails.length > 20) {
      summaryMsg += "\n... و " + (emails.length - 20) + " إيميل آخر";
    }

    summaryMsg += "\n\n💡 سأعرض الإيميلات مع أزرار التحكم (رد، أرشفة، تحليل) أدناه.";

    await botInstance.sendMessage(ownerChatId, summaryMsg);

    // Send individual notifications with action buttons for all emails with attachments
    // (prioritize unread first, then read with attachments)
    const unreadEmails = emails.filter(e => !e.isRead);
    const readWithAttachments = emails.filter(e => e.isRead && e.attachments.length > 0);
    const toNotify = [...unreadEmails, ...readWithAttachments].slice(0, 10);
    
    for (const email of toNotify) {
      await notifyOwnerAboutEmail(email);
      markAsProcessed(email.uid);
    }

    return emails.length;
  } catch (error) {
    console.error("[EmailIntegration] 48h check error:", error);
    if (botInstance && ownerChatId) {
      await botInstance.sendMessage(ownerChatId, "⚠️ خطأ في فحص إيميلات 48 ساعة: " + (error as Error).message);
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

  const readStatus = email.isRead ? "✅ مقروء" : "🔴 غير مقروء";
  const message = "📧 إيميل (" + readStatus + ")\n\n" +
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

// ─── Reply handling ────────────────────────────────────────────────
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

// ─── خازن: Archive to Google Drive (enhanced) ─────────────────────
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
    // Re-fetch the email with full attachment content
    let emailWithContent: EmailMessage | null = null;
    try {
      emailWithContent = await fetchEmailByUID(uid);
    } catch (fetchErr) {
      console.error("[EmailIntegration] Failed to re-fetch email for archiving:", fetchErr);
    }

    const attachmentsToArchive = emailWithContent?.attachments || pending.email.attachments;
    const archivedFiles: string[] = [];

    // Upload to S3
    for (const att of attachmentsToArchive) {
      if (att.content) {
        const safeFilename = att.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
        const randomSuffix = Math.random().toString(36).substring(2, 8);
        const fileKey = "email-attachments/" + pending.email.from.replace(/[^a-zA-Z0-9@._-]/g, "_") + "/" + Date.now() + "-" + randomSuffix + "-" + safeFilename;
        const { url } = await storagePut(fileKey, att.content, att.contentType);
        archivedFiles.push(att.filename + " ✅ S3");
      }
    }

    // Upload to Google Drive
    let driveResult = "";
    try {
      const drive = getDriveClient();
      const folders = await searchFiles("CONSULTANCY_PROPOSALS");
      let targetFolderId = "";
      
      const targetFolder = folders.find(f => f.mimeType === "application/vnd.google-apps.folder");
      if (targetFolder) {
        targetFolderId = targetFolder.id;
      }

      if (targetFolderId) {
        // Create a subfolder for this consultant
        let consultantFolderName = pending.email.fromName.replace(/[<>:"/\\|?*]/g, "_");
        let consultantFolderId = targetFolderId;

        try {
          const existingFolders = await searchFiles(consultantFolderName);
          const existingFolder = existingFolders.find(f => f.mimeType === "application/vnd.google-apps.folder");
          if (existingFolder) {
            consultantFolderId = existingFolder.id;
          } else {
            const newFolder = await createFolder(consultantFolderName, targetFolderId);
            consultantFolderId = newFolder.id;
          }
        } catch {
          // Use parent folder if subfolder creation fails
          consultantFolderId = targetFolderId;
        }

        let driveUploadCount = 0;
        for (const att of attachmentsToArchive) {
          if (att.content) {
            const stream = new Readable();
            stream.push(att.content);
            stream.push(null);
            
            const dateStr = new Date().toISOString().split("T")[0];
            await drive.files.create({
              requestBody: {
                name: "[" + dateStr + "] " + att.filename,
                parents: [consultantFolderId],
              },
              media: {
                mimeType: att.contentType,
                body: stream,
              },
              supportsAllDrives: true,
            });
            driveUploadCount++;
          }
        }
        driveResult = "\n📁 Google Drive: تم رفع " + driveUploadCount + " ملف(ات) إلى مجلد " + consultantFolderName;
      } else {
        driveResult = "\n⚠️ لم يتم العثور على مجلد CONSULTANCY_PROPOSALS في Google Drive";
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

// ─── فاروق: Analyze consultant proposal (enhanced with attachment reading) ───
async function handleAnalyzeAction(bot: any, chatId: number, uid: number, callbackQueryId: string) {
  const pending = pendingEmails.get("uid_" + uid);
  if (!pending) {
    await bot.answerCallbackQuery(callbackQueryId, { text: "الإيميل غير موجود" });
    return;
  }

  await bot.answerCallbackQuery(callbackQueryId, { text: "⏳ فاروق يحلل العرض..." });
  await bot.sendMessage(chatId, "📋 فاروق يعمل...\nجاري تحليل عرض " + pending.email.fromName + (pending.email.attachments.length > 0 ? "\n📎 يقرأ " + pending.email.attachments.length + " مرفق(ات)..." : ""));

  try {
    // Step 1: Re-fetch email with full attachment content for analysis
    let emailWithContent: EmailMessage | null = null;
    if (pending.email.attachments.length > 0) {
      try {
        emailWithContent = await fetchEmailByUID(uid);
        console.log("[EmailIntegration] Re-fetched email UID " + uid + " with " + (emailWithContent?.attachments?.length || 0) + " attachments");
      } catch (fetchErr) {
        console.error("[EmailIntegration] Failed to re-fetch email for analysis:", fetchErr);
      }
    }

    const attachmentsToAnalyze = emailWithContent?.attachments || pending.email.attachments;

    // Step 2: Upload attachments to S3 and get URLs for LLM analysis
    const attachmentUrls: { filename: string; url: string; contentType: string }[] = [];
    const attachmentTexts: string[] = [];

    for (const att of attachmentsToAnalyze) {
      if (att.content) {
        const safeFilename = att.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
        const randomSuffix = Math.random().toString(36).substring(2, 8);
        const fileKey = "farouq-analysis/" + Date.now() + "-" + randomSuffix + "-" + safeFilename;
        
        try {
          const { url } = await storagePut(fileKey, att.content, att.contentType);
          attachmentUrls.push({ filename: att.filename, url, contentType: att.contentType });
          console.log("[EmailIntegration] Uploaded attachment for analysis: " + att.filename + " -> " + url);
        } catch (uploadErr) {
          console.error("[EmailIntegration] Failed to upload attachment:", uploadErr);
        }

        // Extract text from text-based attachments
        if (att.contentType.includes("text") || att.contentType.includes("csv")) {
          try {
            attachmentTexts.push("--- محتوى ملف: " + att.filename + " ---\n" + att.content.toString("utf-8").substring(0, 5000));
          } catch {}
        }
      }
    }

    // Step 3: Build LLM messages with file content
    const emailContent = "من: " + pending.email.fromName + " (" + pending.email.from + ")\n" +
      "الموضوع: " + pending.email.subject + "\n" +
      "التاريخ: " + pending.email.date.toISOString() + "\n" +
      "المحتوى:\n" + pending.email.textBody + "\n\n" +
      "المرفقات: " + (pending.email.attachments.map(a => a.filename + " (" + a.contentType + ", " + Math.round(a.size / 1024) + "KB)").join(", ") || "لا يوجد");

    // Build multi-modal content for LLM
    const userContent: any[] = [
      {
        type: "text",
        text: "حلل هذا الإيميل واستخرج معلومات العرض الاستشاري. اقرأ المرفقات بعناية لاستخراج الأتعاب والتفاصيل:\n\n" + emailContent +
          (attachmentTexts.length > 0 ? "\n\n" + attachmentTexts.join("\n\n") : "")
      }
    ];

    // Add PDF/document attachments as file_url for LLM to read
    for (const att of attachmentUrls) {
      if (att.contentType === "application/pdf") {
        userContent.push({
          type: "file_url",
          file_url: {
            url: att.url,
            mime_type: "application/pdf",
          }
        });
      }
    }

    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `أنت فاروق، محلل قانوني ومالي خبير في شركة Como Developments للتطوير العقاري في دبي.

مهمتك:
1. حدد نوع المستند أولاً:
   - "consultant_proposal" = عرض سعر أو عرض أتعاب من استشاري هندسي
   - "feasibility_study" = دراسة جدوى مالية لمشروع عقاري
   - "contract" = عقد أو اتفاقية
   - "report" = تقرير فني أو إداري
   - "other" = أي شيء آخر

2. حسب نوع المستند، استخرج البيانات المناسبة:

لعرض الاستشاري:
- اسم الاستشاري/الشركة والإيميل
- نوع العرض (تصميم/إشراف/كلاهما)
- الأتعاب بالتفصيل (إجمالي + تصميم + إشراف) كأرقام ونسب مئوية
- المشروع المذكور

لدراسة الجدوى:
- اسم المشروع
- مساحة الأرض ومساحة البناء (BUA) بالقدم المربع
- عدد الوحدات
- تكلفة البناء لكل قدم مربع
- القيمة الإجمالية للمشروع
- سعر الأرض

اقرأ كل المرفقات بعناية شديدة واستخرج الأرقام بدقة. أجب بصيغة JSON.`
        },
        {
          role: "user",
          content: userContent
        }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "document_analysis",
          strict: true,
          schema: {
            type: "object",
            properties: {
              documentType: { type: "string", description: "consultant_proposal, feasibility_study, contract, report, other" },
              consultantName: { type: "string", description: "اسم الاستشاري أو الشركة المرسلة" },
              consultantEmail: { type: "string", description: "إيميل الاستشاري" },
              proposalType: { type: "string", description: "design, supervision, both, other" },
              totalFees: { type: "string", description: "الأتعاب الإجمالية كرقم" },
              designFees: { type: "string", description: "أتعاب التصميم كرقم" },
              supervisionFees: { type: "string", description: "أتعاب الإشراف كرقم" },
              designFeesPct: { type: "string", description: "نسبة أتعاب التصميم مثل 2.5%" },
              supervisionFeesPct: { type: "string", description: "نسبة أتعاب الإشراف مثل 1.75%" },
              currency: { type: "string", description: "AED, USD, etc." },
              summary: { type: "string", description: "ملخص شامل" },
              notes: { type: "array", items: { type: "string" }, description: "ملاحظات وتحذيرات" },
              projectMentioned: { type: "string", description: "اسم المشروع" },
              plotArea: { type: "string", description: "مساحة الأرض بالقدم المربع (لدراسة الجدوى)" },
              totalGfa: { type: "string", description: "إجمالي GFA بالقدم المربع" },
              estimatedBua: { type: "string", description: "مساحة البناء التقديرية BUA" },
              numberOfUnits: { type: "string", description: "عدد الوحدات" },
              constructionCost: { type: "string", description: "تكلفة البناء لكل قدم مربع" },
              projectValue: { type: "string", description: "القيمة الإجمالية للمشروع" },
              landPrice: { type: "string", description: "سعر الأرض" },
            },
            required: ["documentType", "consultantName", "consultantEmail", "proposalType", "totalFees", "designFees", "supervisionFees", "designFeesPct", "supervisionFeesPct", "currency", "summary", "notes", "projectMentioned", "plotArea", "totalGfa", "estimatedBua", "numberOfUnits", "constructionCost", "projectValue", "landPrice"],
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
        documentType: "other",
        consultantName: pending.email.fromName,
        proposalType: "other",
        totalFees: "غير محدد",
        currency: "AED",
        summary: "لم يتمكن فاروق من تحليل العرض تلقائياً. يرجى المراجعة اليدوية.",
        notes: ["يحتاج مراجعة يدوية"],
      };
    }

    pending.farouqAnalysis = analysis;

    // ─── Auto-update platform database ───
    let platformMsg = "";
    try {
      platformMsg = await updatePlatformFromAnalysis(analysis, pending.email);
    } catch (platformErr) {
      console.error("[EmailIntegration] Platform update error:", platformErr);
      platformMsg = "\n⚠️ فشل تحديث المنصة: " + (platformErr as Error).message;
    }

    const typeMap: Record<string, string> = { design: "تصميم", supervision: "إشراف", both: "تصميم وإشراف", other: "أخرى" };
    const docTypeMap: Record<string, string> = { consultant_proposal: "عرض استشاري", feasibility_study: "دراسة جدوى", contract: "عقد", report: "تقرير", other: "أخرى" };

    const attachmentNote = attachmentUrls.length > 0
      ? "\n📎 تم قراءة " + attachmentUrls.length + " مرفق(ات) لاستخراج البيانات"
      : "\n⚠️ لا توجد مرفقات - التحليل مبني على نص الإيميل فقط";

    let resultMsg = "📋 تقرير فاروق — " + (docTypeMap[analysis.documentType] || "تحليل") + "\n\n";

    if (analysis.documentType === "consultant_proposal") {
      resultMsg += "🏢 الاستشاري: " + analysis.consultantName + "\n" +
        "📄 نوع العرض: " + (typeMap[analysis.proposalType] || analysis.proposalType) + "\n" +
        "💰 الأتعاب الإجمالية: " + analysis.totalFees + " " + analysis.currency + "\n" +
        (analysis.designFees && analysis.designFees !== "N/A" ? "  🎨 تصميم: " + analysis.designFees + (analysis.designFeesPct ? " (" + analysis.designFeesPct + ")" : "") + "\n" : "") +
        (analysis.supervisionFees && analysis.supervisionFees !== "N/A" ? "  👷 إشراف: " + analysis.supervisionFees + (analysis.supervisionFeesPct ? " (" + analysis.supervisionFeesPct + ")" : "") + "\n" : "") +
        (analysis.projectMentioned ? "\n🏗️ المشروع: " + analysis.projectMentioned + "\n" : "");
    } else if (analysis.documentType === "feasibility_study") {
      resultMsg += "🏗️ المشروع: " + (analysis.projectMentioned || "غير محدد") + "\n" +
        (analysis.plotArea && analysis.plotArea !== "N/A" ? "📏 مساحة الأرض: " + analysis.plotArea + " sqft\n" : "") +
        (analysis.estimatedBua && analysis.estimatedBua !== "N/A" ? "🏠 مساحة البناء: " + analysis.estimatedBua + " sqft\n" : "") +
        (analysis.numberOfUnits && analysis.numberOfUnits !== "N/A" ? "🏢 عدد الوحدات: " + analysis.numberOfUnits + "\n" : "") +
        (analysis.constructionCost && analysis.constructionCost !== "N/A" ? "💷 تكلفة البناء/sqft: " + analysis.constructionCost + " AED\n" : "") +
        (analysis.projectValue && analysis.projectValue !== "N/A" ? "💰 قيمة المشروع: " + analysis.projectValue + " AED\n" : "") +
        (analysis.landPrice && analysis.landPrice !== "N/A" ? "🏞️ سعر الأرض: " + analysis.landPrice + " AED\n" : "");
    } else {
      resultMsg += "🏢 المرسل: " + analysis.consultantName + "\n";
      if (analysis.projectMentioned) resultMsg += "🏗️ المشروع: " + analysis.projectMentioned + "\n";
    }

    resultMsg += attachmentNote +
      "\n\n📝 الملخص:\n" + analysis.summary + "\n" +
      (analysis.notes && analysis.notes.length > 0 ? "\n⚠️ ملاحظات:\n" + analysis.notes.map(n => "  • " + n).join("\n") : "") +
      platformMsg;

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

// ─── Auto-update platform from Farouq analysis ───
async function updatePlatformFromAnalysis(analysis: FarouqAnalysis, email: EmailMessage): Promise<string> {
  const db = await getDb();
  if (!db) return "\n⚠️ قاعدة البيانات غير متاحة";

  // Get owner user (userId = 1 for admin)
  const { users } = await import("../drizzle/schema");
  const ownerUsers = await db.select().from(users).where(eq(users.role, "admin")).limit(1);
  const ownerId = ownerUsers.length > 0 ? ownerUsers[0].id : 1;

  const updates: string[] = [];

  if (analysis.documentType === "consultant_proposal") {
    // 1. Find or create consultant
    const consultantName = analysis.consultantName || email.fromName;
    const consultantEmail = analysis.consultantEmail || email.from;
    
    let existingConsultants = await db.select().from(consultants)
      .where(eq(consultants.email, consultantEmail)).limit(1);
    
    if (existingConsultants.length === 0) {
      // Try by name
      existingConsultants = await db.select().from(consultants)
        .where(like(consultants.name, "%" + consultantName.substring(0, 10) + "%")).limit(1);
    }

    let consultantId: number;
    if (existingConsultants.length > 0) {
      consultantId = existingConsultants[0].id;
      updates.push("✅ وُجد الاستشاري: " + existingConsultants[0].name);
    } else {
      // Create new consultant
      const result = await db.insert(consultants).values({
        userId: ownerId,
        name: consultantName,
        email: consultantEmail,
        specialization: analysis.proposalType === "design" ? "تصميم" : analysis.proposalType === "supervision" ? "إشراف" : "تصميم وإشراف",
      });
      consultantId = (result as any)[0]?.insertId || (result as any).insertId;
      updates.push("➕ تم إضافة استشاري جديد: " + consultantName);
    }

    // 2. Find or create project
    if (analysis.projectMentioned && analysis.projectMentioned !== "N/A" && analysis.projectMentioned !== "غير محدد") {
      let existingProjects = await db.select().from(projects)
        .where(like(projects.name, "%" + analysis.projectMentioned.substring(0, 15) + "%")).limit(1);

      let projectId: number;
      if (existingProjects.length > 0) {
        projectId = existingProjects[0].id;
        updates.push("✅ وُجد المشروع: " + existingProjects[0].name);
      } else {
        const result = await db.insert(projects).values({
          userId: ownerId,
          name: analysis.projectMentioned,
          description: analysis.summary?.substring(0, 200),
        });
        projectId = (result as any)[0]?.insertId || (result as any).insertId;
        updates.push("➕ تم إنشاء مشروع جديد: " + analysis.projectMentioned);
      }

      // 3. Link consultant to project
      const existingLink = await db.select().from(projectConsultants)
        .where(and(
          eq(projectConsultants.projectId, projectId),
          eq(projectConsultants.consultantId, consultantId)
        )).limit(1);

      if (existingLink.length === 0) {
        await db.insert(projectConsultants).values({ projectId, consultantId });
        updates.push("🔗 تم ربط الاستشاري بالمشروع");
      }

      // 4. Update financial data
      const parseNum = (s: string | undefined): number | undefined => {
        if (!s || s === "N/A" || s === "غير محدد") return undefined;
        const num = parseInt(s.replace(/[^0-9]/g, ""));
        return isNaN(num) ? undefined : num;
      };
      const parsePct = (s: string | undefined): number | undefined => {
        if (!s || s === "N/A") return undefined;
        const num = parseFloat(s.replace(/[^0-9.]/g, ""));
        return isNaN(num) ? undefined : Math.round(num * 100); // Store as basis points for precision
      };

      const designVal = parseNum(analysis.designFees);
      const supervisionVal = parseNum(analysis.supervisionFees);
      const designPctVal = parsePct(analysis.designFeesPct);
      const supervisionPctVal = parsePct(analysis.supervisionFeesPct);

      const finData: any = {};
      if (designVal !== undefined) {
        finData.designType = "lump";
        finData.designValue = designVal;
      } else if (designPctVal !== undefined) {
        finData.designType = "pct";
        finData.designValue = designPctVal;
      }
      if (supervisionVal !== undefined) {
        finData.supervisionType = "lump";
        finData.supervisionValue = supervisionVal;
      } else if (supervisionPctVal !== undefined) {
        finData.supervisionType = "pct";
        finData.supervisionValue = supervisionPctVal;
      }

      if (Object.keys(finData).length > 0) {
        const existingFin = await db.select().from(financialData)
          .where(and(
            eq(financialData.projectId, projectId),
            eq(financialData.consultantId, consultantId)
          )).limit(1);

        if (existingFin.length > 0) {
          await db.update(financialData).set(finData)
            .where(and(
              eq(financialData.projectId, projectId),
              eq(financialData.consultantId, consultantId)
            ));
        } else {
          await db.insert(financialData).values({ projectId, consultantId, ...finData });
        }
        updates.push("💰 تم تحديث البيانات المالية");
      }
    }

  } else if (analysis.documentType === "feasibility_study") {
    // Update feasibility study data
    const parseNum = (s: string | undefined): number | undefined => {
      if (!s || s === "N/A" || s === "غير محدد") return undefined;
      const num = parseInt(s.replace(/[^0-9]/g, ""));
      return isNaN(num) ? undefined : num;
    };

    const projectName = analysis.projectMentioned || "مشروع جديد - " + new Date().toLocaleDateString("ar");

    // Check if feasibility study exists for this project
    const existingStudy = await db.select().from(feasibilityStudies)
      .where(like(feasibilityStudies.projectName, "%" + projectName.substring(0, 15) + "%")).limit(1);

    const studyData: any = {
      projectName,
      plotArea: parseNum(analysis.plotArea),
      totalGfa: parseNum(analysis.totalGfa),
      estimatedBua: parseNum(analysis.estimatedBua),
      numberOfUnits: parseNum(analysis.numberOfUnits),
      constructionCostPerSqft: parseNum(analysis.constructionCost),
      landPrice: parseNum(analysis.landPrice),
    };

    // Remove undefined values
    Object.keys(studyData).forEach(k => { if (studyData[k] === undefined) delete studyData[k]; });

    if (existingStudy.length > 0) {
      await db.update(feasibilityStudies).set(studyData)
        .where(eq(feasibilityStudies.id, existingStudy[0].id));
      updates.push("📊 تم تحديث دراسة الجدوى: " + projectName);
    } else {
      await db.insert(feasibilityStudies).values({ userId: ownerId, ...studyData });
      updates.push("📊 تم إنشاء دراسة جدوى جديدة: " + projectName);
    }
  }

  if (updates.length > 0) {
    return "\n\n🔄 تحديث المنصة:\n" + updates.map(u => "  " + u).join("\n");
  }
  return "";
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
