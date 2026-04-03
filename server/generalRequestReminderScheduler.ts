/**
 * General Request Reminder Scheduler
 * Sends reminder emails every 36 hours for any pending general requests
 * (non-financial: proposal approval, contract, meeting, zoom, inquiry, decision)
 * at each party (Wael, Sheikh Issa).
 */

import { getDb } from "./db";
import { generalRequests, approvalSettings } from "../drizzle/schema";
import { inArray } from "drizzle-orm";
import { sendReply } from "./emailMonitor";

const DEFAULT_WAEL_EMAIL = "wael@zooma.ae";
const DEFAULT_SHEIKH_EMAIL = "essaabuseif@gmail.com";
const DEFAULT_SUBMITTER_EMAIL = "a.zaqout@comodevelopments.com";

const REMINDER_INTERVAL_MS = 36 * 60 * 60 * 1000; // 36 hours

let schedulerInterval: ReturnType<typeof setInterval> | null = null;
let lastReminderSentAt: number | null = null;

const REQUEST_TYPE_LABELS: Record<string, string> = {
  proposal_approval: "اعتماد عرض",
  contract_approval: "اعتماد عقد",
  meeting_request: "طلب اجتماع",
  zoom_meeting: "اجتماع زووم",
  inquiry: "استفسار",
  decision_request: "طلب قرار",
  other: "أخرى",
};

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
    };
  } catch {
    return {
      waelEmail: DEFAULT_WAEL_EMAIL,
      waelName: "وائل",
      sheikhEmail: DEFAULT_SHEIKH_EMAIL,
      sheikhName: "الشيخ عيسى",
    };
  }
}

function buildReminderEmail(params: {
  recipientName: string;
  pendingRequests: Array<{
    requestNumber: string;
    requestType: string;
    subject: string;
    projectName: string | null;
    relatedParty: string | null;
    createdAt: string;
  }>;
  role: "wael" | "sheikh";
}) {
  const { recipientName, pendingRequests, role } = params;
  const roleLabel = role === "wael" ? "مراجعتك وموافقتك" : "اعتمادكم";

  const rows = pendingRequests.map((r, i) => {
    const bg = i % 2 === 0 ? "#f0f4f8" : "#ffffff";
    const hoursAgo = Math.round((Date.now() - new Date(r.createdAt).getTime()) / (1000 * 60 * 60));
    const typeLabel = REQUEST_TYPE_LABELS[r.requestType] || r.requestType;
    return `
      <tr style="background: ${bg};">
        <td style="padding: 10px 14px; font-weight: bold; color: #1a3c5e;">${r.requestNumber}</td>
        <td style="padding: 10px 14px;">${typeLabel}</td>
        <td style="padding: 10px 14px;">${r.subject}</td>
        <td style="padding: 10px 14px;">${r.projectName || "—"}</td>
        <td style="padding: 10px 14px;">${r.relatedParty || "—"}</td>
        <td style="padding: 10px 14px; color: #e65c00;">${hoursAgo} ساعة</td>
      </tr>`;
  }).join("");

  return `
<div style="font-family: Arial, sans-serif; direction: rtl; max-width: 750px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
  <div style="background: #7c3aed; color: white; padding: 20px 30px; text-align: right;">
    <h2 style="margin: 0; font-size: 20px;">🔔 تذكير: طلبات واستفسارات معلقة</h2>
    <p style="margin: 5px 0 0; opacity: 0.9; font-size: 13px;">كومو للتطوير العقاري</p>
  </div>
  <div style="padding: 25px 30px; background: #f9f9f9; text-align: right;">
    <p style="color: #333; font-size: 15px;">
      ${recipientName}، يوجد <strong>${pendingRequests.length}</strong> طلب/استفسار معلق يحتاج ${roleLabel}:
    </p>
    <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 6px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <thead>
        <tr style="background: #7c3aed; color: white;">
          <th style="padding: 10px 14px; text-align: right;">رقم الطلب</th>
          <th style="padding: 10px 14px; text-align: right;">النوع</th>
          <th style="padding: 10px 14px; text-align: right;">الموضوع</th>
          <th style="padding: 10px 14px; text-align: right;">المشروع</th>
          <th style="padding: 10px 14px; text-align: right;">الجهة المعنية</th>
          <th style="padding: 10px 14px; text-align: right;">منذ</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="margin-top: 20px; padding: 15px; background: #f3e8ff; border-right: 4px solid #7c3aed; border-radius: 4px;">
      <p style="margin: 0; font-size: 13px; color: #5b21b6;">
        ⏰ هذا تذكير تلقائي يُرسل كل 36 ساعة لأي طلب معلق. يرجى الدخول على المنصة والبت في هذه الطلبات.
      </p>
    </div>
  </div>
  <div style="padding: 15px 30px; background: #1a3c5e; color: rgba(255,255,255,0.7); font-size: 12px; text-align: center;">
    Como Developments | نظام الطلبات والاستفسارات التلقائي
  </div>
</div>`;
}

async function sendGeneralRequestReminders() {
  try {
    const db = await getDb();
    const cfg = await getConfig();

    const allPending = await db
      .select()
      .from(generalRequests)
      .where(inArray(generalRequests.status, ["pending_wael", "pending_sheikh"]));

    const nonArchived = allPending.filter(r => !r.isArchived);

    const pendingWael = nonArchived
      .filter(r => r.status === "pending_wael")
      .map(r => ({
        requestNumber: r.requestNumber,
        requestType: r.requestType,
        subject: r.subject,
        projectName: r.projectName || null,
        relatedParty: r.relatedParty || null,
        createdAt: r.createdAt,
      }));

    const pendingSheikh = nonArchived
      .filter(r => r.status === "pending_sheikh")
      .map(r => ({
        requestNumber: r.requestNumber,
        requestType: r.requestType,
        subject: r.subject,
        projectName: r.projectName || null,
        relatedParty: r.relatedParty || null,
        createdAt: r.createdAt,
      }));

    let sent = 0;

    if (pendingWael.length > 0) {
      const body = buildReminderEmail({ recipientName: cfg.waelName, pendingRequests: pendingWael, role: "wael" });
      const subject = `🔔 تذكير: ${pendingWael.length} طلب/استفسار ينتظر موافقتك`;
      await sendReply(cfg.waelEmail, subject, body, undefined, DEFAULT_SUBMITTER_EMAIL);
      console.log(`[GeneralRequestReminder] Sent Wael reminder for ${pendingWael.length} requests`);
      sent++;
    }

    if (pendingSheikh.length > 0) {
      const body = buildReminderEmail({ recipientName: cfg.sheikhName, pendingRequests: pendingSheikh, role: "sheikh" });
      const subject = `🔔 تذكير: ${pendingSheikh.length} طلب/استفسار ينتظر اعتمادكم`;
      await sendReply(cfg.sheikhEmail, subject, body, undefined, cfg.waelEmail);
      console.log(`[GeneralRequestReminder] Sent Sheikh reminder for ${pendingSheikh.length} requests`);
      sent++;
    }

    if (sent === 0) {
      console.log("[GeneralRequestReminder] No pending requests — no reminders sent");
    }
  } catch (err) {
    console.error("[GeneralRequestReminder] Error sending reminders:", err);
  }
}

export function startGeneralRequestReminderScheduler() {
  if (schedulerInterval) return;
  console.log("[GeneralRequestReminder] Starting — will send reminders every 36 hours for pending requests");

  schedulerInterval = setInterval(async () => {
    const now = Date.now();
    if (lastReminderSentAt === null || now - lastReminderSentAt >= REMINDER_INTERVAL_MS) {
      lastReminderSentAt = now;
      await sendGeneralRequestReminders();
    }
  }, 30 * 60 * 1000); // check every 30 min
}

export function stopGeneralRequestReminderScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log("[GeneralRequestReminder] Stopped");
  }
}

export { sendGeneralRequestReminders };
