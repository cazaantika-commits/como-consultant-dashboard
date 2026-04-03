/**
 * Payment Request Reminder Scheduler
 * Sends reminder emails every 36 hours for any pending payment requests
 * at each party (Wael, Sheikh Issa, Finance).
 */

import { getDb } from "./db";
import { paymentRequests, businessPartners, approvalSettings } from "../drizzle/schema";
import { eq, inArray } from "drizzle-orm";
import { sendReply } from "./emailMonitor";

const DEFAULT_WAEL_EMAIL = "wael@zooma.ae";
const DEFAULT_SHEIKH_EMAIL = "essaabuseif@gmail.com";
const DEFAULT_SUBMITTER_EMAIL = "a.zaqout@comodevelopments.com";
const DEFAULT_FINANCE_EMAILS = ["shahid@zooma.ae", "account.mrt@zooma.ae", "thanseeh@globalhightrend.com"];

const REMINDER_INTERVAL_MS = 36 * 60 * 60 * 1000; // 36 hours

let schedulerInterval: ReturnType<typeof setInterval> | null = null;
let lastReminderSentAt: number | null = null;

async function getConfig() {
  try {
    const db = await getDb();
    const rows = await db.select().from(approvalSettings);
    const cfg: Record<string, string> = {};
    for (const row of rows) cfg[row.key] = row.value;
    return {
      waelEmail: cfg["wael_email"] || DEFAULT_WAEL_EMAIL,
      waelName: cfg["wael_name"] || "وائل",
      sheikhEmail: cfg["sheikh_email"] || DEFAULT_SHEIKH_EMAIL,
      sheikhName: cfg["sheikh_name"] || "الشيخ عيسى",
      financeEmails: (cfg["finance_emails"] || DEFAULT_FINANCE_EMAILS.join(",")).split(",").map(e => e.trim()).filter(Boolean),
    };
  } catch {
    return {
      waelEmail: DEFAULT_WAEL_EMAIL,
      waelName: "وائل",
      sheikhEmail: DEFAULT_SHEIKH_EMAIL,
      sheikhName: "الشيخ عيسى",
      financeEmails: DEFAULT_FINANCE_EMAILS,
    };
  }
}

function buildReminderEmail(params: {
  recipientName: string;
  pendingRequests: Array<{
    requestNumber: string;
    partnerName: string;
    projectName: string | null;
    amount: string;
    currency: string;
    description: string;
    createdAt: string;
  }>;
  role: "wael" | "sheikh" | "finance";
}) {
  const { recipientName, pendingRequests, role } = params;

  const roleLabel =
    role === "wael" ? "مراجعتك وموافقتك" :
    role === "sheikh" ? "اعتمادكم" :
    "المعالجة والصرف";

  const rows = pendingRequests.map((r, i) => {
    const bg = i % 2 === 0 ? "#f0f4f8" : "#ffffff";
    const hoursAgo = Math.round((Date.now() - new Date(r.createdAt).getTime()) / (1000 * 60 * 60));
    return `
      <tr style="background: ${bg};">
        <td style="padding: 10px 14px; font-weight: bold; color: #1a3c5e;">${r.requestNumber}</td>
        <td style="padding: 10px 14px;">${r.partnerName}</td>
        <td style="padding: 10px 14px;">${r.projectName || "—"}</td>
        <td style="padding: 10px 14px; font-weight: bold; color: #1a3c5e;">${Number(r.amount).toLocaleString("en-US", { minimumFractionDigits: 0 })} ${r.currency}</td>
        <td style="padding: 10px 14px; color: #e65c00;">${hoursAgo} ساعة</td>
      </tr>`;
  }).join("");

  return `
<div style="font-family: Arial, sans-serif; direction: rtl; max-width: 700px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
  <div style="background: #e65c00; color: white; padding: 20px 30px; text-align: right;">
    <h2 style="margin: 0; font-size: 20px;">🔔 تذكير: طلبات صرف معلقة</h2>
    <p style="margin: 5px 0 0; opacity: 0.9; font-size: 13px;">كومو للتطوير العقاري</p>
  </div>
  <div style="padding: 25px 30px; background: #f9f9f9; text-align: right;">
    <p style="color: #333; font-size: 15px;">
      ${recipientName}، يوجد <strong>${pendingRequests.length}</strong> طلب صرف معلق يحتاج ${roleLabel}:
    </p>
    <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 6px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <thead>
        <tr style="background: #1a3c5e; color: white;">
          <th style="padding: 10px 14px; text-align: right;">رقم الطلب</th>
          <th style="padding: 10px 14px; text-align: right;">الجهة المستفيدة</th>
          <th style="padding: 10px 14px; text-align: right;">المشروع</th>
          <th style="padding: 10px 14px; text-align: right;">المبلغ</th>
          <th style="padding: 10px 14px; text-align: right;">منذ</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="margin-top: 20px; padding: 15px; background: #fff3cd; border-right: 4px solid #e65c00; border-radius: 4px;">
      <p style="margin: 0; font-size: 13px; color: #856404;">
        ⏰ هذا تذكير تلقائي يُرسل كل 36 ساعة لأي طلب معلق. يرجى الدخول على المنصة والبت في هذه الطلبات.
      </p>
    </div>
  </div>
  <div style="padding: 15px 30px; background: #1a3c5e; color: rgba(255,255,255,0.7); font-size: 12px; text-align: center;">
    Como Developments | نظام طلبات الصرف التلقائي
  </div>
</div>`;
}

async function sendPaymentReminders() {
  try {
    const db = await getDb();
    const cfg = await getConfig();

    // Fetch all non-archived pending requests with partner info
    const allPending = await db
      .select({
        id: paymentRequests.id,
        requestNumber: paymentRequests.requestNumber,
        status: paymentRequests.status,
        projectName: paymentRequests.projectName,
        amount: paymentRequests.amount,
        currency: paymentRequests.currency,
        description: paymentRequests.description,
        createdAt: paymentRequests.createdAt,
        partnerName: businessPartners.companyName,
      })
      .from(paymentRequests)
      .leftJoin(businessPartners, eq(paymentRequests.partnerId, businessPartners.id))
      .where(
        inArray(paymentRequests.status, ["pending_wael", "pending_sheikh"])
      );

    const nonArchived = allPending.filter(r => !(r as any).isArchived);

    const pendingWael = nonArchived.filter(r => r.status === "pending_wael").map(r => ({
      requestNumber: r.requestNumber,
      partnerName: r.partnerName || "—",
      projectName: r.projectName || null,
      amount: r.amount,
      currency: r.currency,
      description: r.description || "",
      createdAt: r.createdAt,
    }));

    const pendingSheikh = nonArchived.filter(r => r.status === "pending_sheikh").map(r => ({
      requestNumber: r.requestNumber,
      partnerName: r.partnerName || "—",
      projectName: r.projectName || null,
      amount: r.amount,
      currency: r.currency,
      description: r.description || "",
      createdAt: r.createdAt,
    }));

    let sent = 0;

    // Remind Wael about pending_wael requests
    if (pendingWael.length > 0) {
      const body = buildReminderEmail({ recipientName: cfg.waelName, pendingRequests: pendingWael, role: "wael" });
      const subject = `🔔 تذكير: ${pendingWael.length} طلب صرف ينتظر موافقتك`;
      await sendReply(cfg.waelEmail, subject, body, undefined, DEFAULT_SUBMITTER_EMAIL);
      console.log(`[PaymentReminder] Sent Wael reminder for ${pendingWael.length} requests`);
      sent++;
    }

    // Remind Sheikh Issa about pending_sheikh requests
    if (pendingSheikh.length > 0) {
      const body = buildReminderEmail({ recipientName: cfg.sheikhName, pendingRequests: pendingSheikh, role: "sheikh" });
      const subject = `🔔 تذكير: ${pendingSheikh.length} طلب صرف ينتظر اعتمادكم`;
      await sendReply(cfg.sheikhEmail, subject, body, undefined, cfg.waelEmail);
      console.log(`[PaymentReminder] Sent Sheikh reminder for ${pendingSheikh.length} requests`);
      sent++;
    }

    if (sent === 0) {
      console.log("[PaymentReminder] No pending requests — no reminders sent");
    }
  } catch (err) {
    console.error("[PaymentReminder] Error sending reminders:", err);
  }
}

export function startPaymentReminderScheduler() {
  if (schedulerInterval) return;
  console.log("[PaymentReminder] Starting — will send reminders every 36 hours for pending requests");

  // Check every 30 minutes whether 36 hours have passed since last reminder
  schedulerInterval = setInterval(async () => {
    const now = Date.now();
    if (lastReminderSentAt === null || now - lastReminderSentAt >= REMINDER_INTERVAL_MS) {
      lastReminderSentAt = now;
      await sendPaymentReminders();
    }
  }, 30 * 60 * 1000); // check every 30 min
}

export function stopPaymentReminderScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log("[PaymentReminder] Stopped");
  }
}

export { sendPaymentReminders };
