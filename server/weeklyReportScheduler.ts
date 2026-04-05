/**
 * Weekly Summary Report Scheduler
 * Sends a comprehensive weekly email report every Monday at 9:00 AM Dubai time (UTC+4 = 05:00 UTC)
 * covering payment requests and general requests statistics.
 */
import { getDb } from "./db";
import { paymentRequests, generalRequests, approvalSettings } from "../drizzle/schema";
import { eq, inArray, gte } from "drizzle-orm";
import { sendReply } from "./emailMonitor";

const DEFAULT_WAEL_EMAIL = "wael@zooma.ae";
const DEFAULT_SHEIKH_EMAIL = "essaabuseif@gmail.com";
const DEFAULT_ADMIN_EMAIL = "a.zaqout@comodevelopments.com";

let schedulerInterval: ReturnType<typeof setInterval> | null = null;
let lastReportSentDate: string | null = null;
let isRunning = false;

async function getConfig() {
  try {
    const db = await getDb();
    const rows = await db!.select().from(approvalSettings);
    const cfg: Record<string, string> = {};
    for (const row of rows) cfg[row.key] = row.value;
    return {
      waelEmail: cfg["wael_email"] || DEFAULT_WAEL_EMAIL,
      waelName: cfg["wael_name"] || "وائل",
      sheikhEmail: cfg["sheikh_email"] || DEFAULT_SHEIKH_EMAIL,
      sheikhName: cfg["sheikh_name"] || "الشيخ عيسى",
      adminEmail: DEFAULT_ADMIN_EMAIL,
    };
  } catch {
    return {
      waelEmail: DEFAULT_WAEL_EMAIL,
      waelName: "وائل",
      sheikhEmail: DEFAULT_SHEIKH_EMAIL,
      sheikhName: "الشيخ عيسى",
      adminEmail: DEFAULT_ADMIN_EMAIL,
    };
  }
}

function shouldRunNow(): boolean {
  // Run every Monday at 9:00 AM Dubai time (UTC+4)
  const now = new Date();
  const dubaiOffset = 4 * 60; // minutes
  const dubaiMs = now.getTime() + dubaiOffset * 60 * 1000;
  const dubaiDate = new Date(dubaiMs);
  const dubaiHour = dubaiDate.getUTCHours();
  const dubaiMinute = dubaiDate.getUTCMinutes();
  const dubaiDayOfWeek = dubaiDate.getUTCDay(); // 0=Sunday, 1=Monday
  return dubaiDayOfWeek === 1 && dubaiHour === 9 && dubaiMinute === 0;
}

function formatAmount(amount: string | null, currency: string): string {
  if (!amount) return "—";
  const num = parseFloat(amount);
  return num.toLocaleString("ar-AE", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + " " + currency;
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    new: "جديد",
    pending_wael: "بانتظار وائل",
    pending_sheikh: "بانتظار الشيخ عيسى",
    approved: "معتمد",
    rejected: "مرفوض",
    needs_revision: "يحتاج مراجعة",
    disbursed: "تم الصرف",
  };
  return labels[status] || status;
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    new: "#6366f1",
    pending_wael: "#f59e0b",
    pending_sheikh: "#f59e0b",
    approved: "#10b981",
    rejected: "#ef4444",
    needs_revision: "#f97316",
    disbursed: "#059669",
  };
  return colors[status] || "#64748b";
}

function getRequestTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    proposal_approval: "اعتماد عرض",
    contract_approval: "اعتماد عقد",
    meeting_request: "طلب اجتماع",
    zoom_meeting: "اجتماع زووم",
    inquiry: "استفسار",
    decision_request: "طلب قرار",
    other: "أخرى",
  };
  return labels[type] || type;
}

function buildWeeklyReportEmail(params: {
  weekLabel: string;
  paymentStats: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    disbursed: number;
    needsRevision: number;
    totalAmount: number;
    pendingAmount: number;
    pendingItems: Array<{ requestNumber: string; description: string; amount: string; currency: string; status: string; createdAt: string }>;
  };
  generalStats: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    needsRevision: number;
    pendingItems: Array<{ requestNumber: string; subject: string; requestType: string; status: string; createdAt: string }>;
  };
}): string {
  const { weekLabel, paymentStats, generalStats } = params;

  const pendingPaymentRows = paymentStats.pendingItems.map(r => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-family:Tahoma,Arial,sans-serif;font-size:13px;color:#1e293b;">${r.requestNumber}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-family:Tahoma,Arial,sans-serif;font-size:13px;color:#334155;">${r.description.substring(0, 60)}${r.description.length > 60 ? "..." : ""}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-family:Tahoma,Arial,sans-serif;font-size:13px;color:#0f172a;font-weight:600;">${formatAmount(r.amount, r.currency)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;text-align:center;">
        <span style="background:${getStatusColor(r.status)}20;color:${getStatusColor(r.status)};padding:3px 10px;border-radius:20px;font-size:12px;font-family:Tahoma,Arial,sans-serif;font-weight:600;">${getStatusLabel(r.status)}</span>
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-family:Tahoma,Arial,sans-serif;font-size:12px;color:#64748b;">${r.createdAt.split("T")[0]}</td>
    </tr>`).join("");

  const pendingGeneralRows = generalStats.pendingItems.map(r => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-family:Tahoma,Arial,sans-serif;font-size:13px;color:#1e293b;">${r.requestNumber}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-family:Tahoma,Arial,sans-serif;font-size:13px;color:#334155;">${r.subject.substring(0, 70)}${r.subject.length > 70 ? "..." : ""}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-family:Tahoma,Arial,sans-serif;font-size:12px;color:#64748b;">${getRequestTypeLabel(r.requestType)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;text-align:center;">
        <span style="background:${getStatusColor(r.status)}20;color:${getStatusColor(r.status)};padding:3px 10px;border-radius:20px;font-size:12px;font-family:Tahoma,Arial,sans-serif;font-weight:600;">${getStatusLabel(r.status)}</span>
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-family:Tahoma,Arial,sans-serif;font-size:12px;color:#64748b;">${r.createdAt.split("T")[0]}</td>
    </tr>`).join("");

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Tahoma,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 0;">
  <tr><td align="center">
    <table width="680" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
      <!-- Header -->
      <tr>
        <td style="background:linear-gradient(135deg,#1e3a5f 0%,#2563eb 100%);padding:32px 40px;text-align:center;">
          <div style="font-size:28px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">كومو للتطوير العقاري</div>
          <div style="font-size:15px;color:#93c5fd;margin-top:6px;">التقرير الأسبوعي — ${weekLabel}</div>
        </td>
      </tr>
      <!-- Intro -->
      <tr>
        <td style="padding:28px 40px 0;">
          <p style="font-size:15px;color:#334155;line-height:1.8;margin:0;">
            السادة المحترمون،<br>
            يُرفق طيّه التقرير الأسبوعي الشامل لحالة طلبات الصرف والاعتمادات الرسمية المقدّمة خلال الأسبوع الجاري.
          </p>
        </td>
      </tr>

      <!-- ═══ SECTION 1: Payment Requests ═══ -->
      <tr>
        <td style="padding:28px 40px 0;">
          <div style="font-size:18px;font-weight:700;color:#1e3a5f;border-right:4px solid #f59e0b;padding-right:14px;margin-bottom:20px;">
            💰 طلبات الصرف
          </div>
          <!-- Stats Grid -->
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td width="20%" style="padding:0 6px 0 0;">
                <div style="background:#fef3c7;border-radius:12px;padding:16px;text-align:center;">
                  <div style="font-size:28px;font-weight:800;color:#d97706;">${paymentStats.pending}</div>
                  <div style="font-size:12px;color:#92400e;margin-top:4px;">معلّقة</div>
                </div>
              </td>
              <td width="20%" style="padding:0 6px;">
                <div style="background:#d1fae5;border-radius:12px;padding:16px;text-align:center;">
                  <div style="font-size:28px;font-weight:800;color:#059669;">${paymentStats.approved}</div>
                  <div style="font-size:12px;color:#065f46;margin-top:4px;">معتمدة</div>
                </div>
              </td>
              <td width="20%" style="padding:0 6px;">
                <div style="background:#ecfdf5;border-radius:12px;padding:16px;text-align:center;">
                  <div style="font-size:28px;font-weight:800;color:#10b981;">${paymentStats.disbursed}</div>
                  <div style="font-size:12px;color:#065f46;margin-top:4px;">تم الصرف</div>
                </div>
              </td>
              <td width="20%" style="padding:0 6px;">
                <div style="background:#fee2e2;border-radius:12px;padding:16px;text-align:center;">
                  <div style="font-size:28px;font-weight:800;color:#dc2626;">${paymentStats.rejected}</div>
                  <div style="font-size:12px;color:#7f1d1d;margin-top:4px;">مرفوضة</div>
                </div>
              </td>
              <td width="20%" style="padding:0 0 0 6px;">
                <div style="background:#f0f9ff;border-radius:12px;padding:16px;text-align:center;">
                  <div style="font-size:28px;font-weight:800;color:#0369a1;">${paymentStats.total}</div>
                  <div style="font-size:12px;color:#0c4a6e;margin-top:4px;">إجمالي</div>
                </div>
              </td>
            </tr>
          </table>
          ${paymentStats.pendingAmount > 0 ? `
          <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:14px 18px;margin-top:16px;display:flex;align-items:center;">
            <span style="font-size:14px;color:#92400e;">💵 إجمالي المبالغ المعلّقة: <strong style="font-size:16px;color:#d97706;">${paymentStats.pendingAmount.toLocaleString("ar-AE")} AED</strong></span>
          </div>` : ""}
          ${paymentStats.pendingItems.length > 0 ? `
          <div style="margin-top:20px;">
            <div style="font-size:14px;font-weight:700;color:#374151;margin-bottom:12px;">الطلبات المعلّقة (${paymentStats.pendingItems.length})</div>
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
              <thead>
                <tr style="background:#f8fafc;">
                  <th style="padding:10px 12px;text-align:right;font-size:12px;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0;">رقم الطلب</th>
                  <th style="padding:10px 12px;text-align:right;font-size:12px;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0;">الوصف</th>
                  <th style="padding:10px 12px;text-align:right;font-size:12px;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0;">المبلغ</th>
                  <th style="padding:10px 12px;text-align:center;font-size:12px;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0;">الحالة</th>
                  <th style="padding:10px 12px;text-align:right;font-size:12px;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0;">التاريخ</th>
                </tr>
              </thead>
              <tbody>${pendingPaymentRows}</tbody>
            </table>
          </div>` : `<div style="text-align:center;padding:20px;color:#10b981;font-size:14px;margin-top:16px;">✅ لا توجد طلبات صرف معلّقة</div>`}
        </td>
      </tr>

      <!-- ═══ SECTION 2: General Requests ═══ -->
      <tr>
        <td style="padding:28px 40px 0;">
          <div style="font-size:18px;font-weight:700;color:#1e3a5f;border-right:4px solid #8b5cf6;padding-right:14px;margin-bottom:20px;">
            📋 الاعتمادات الرسمية
          </div>
          <!-- Stats Grid -->
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td width="25%" style="padding:0 6px 0 0;">
                <div style="background:#fef3c7;border-radius:12px;padding:16px;text-align:center;">
                  <div style="font-size:28px;font-weight:800;color:#d97706;">${generalStats.pending}</div>
                  <div style="font-size:12px;color:#92400e;margin-top:4px;">معلّقة</div>
                </div>
              </td>
              <td width="25%" style="padding:0 6px;">
                <div style="background:#d1fae5;border-radius:12px;padding:16px;text-align:center;">
                  <div style="font-size:28px;font-weight:800;color:#059669;">${generalStats.approved}</div>
                  <div style="font-size:12px;color:#065f46;margin-top:4px;">معتمدة</div>
                </div>
              </td>
              <td width="25%" style="padding:0 6px;">
                <div style="background:#fee2e2;border-radius:12px;padding:16px;text-align:center;">
                  <div style="font-size:28px;font-weight:800;color:#dc2626;">${generalStats.rejected}</div>
                  <div style="font-size:12px;color:#7f1d1d;margin-top:4px;">مرفوضة</div>
                </div>
              </td>
              <td width="25%" style="padding:0 0 0 6px;">
                <div style="background:#f0f9ff;border-radius:12px;padding:16px;text-align:center;">
                  <div style="font-size:28px;font-weight:800;color:#0369a1;">${generalStats.total}</div>
                  <div style="font-size:12px;color:#0c4a6e;margin-top:4px;">إجمالي</div>
                </div>
              </td>
            </tr>
          </table>
          ${generalStats.pendingItems.length > 0 ? `
          <div style="margin-top:20px;">
            <div style="font-size:14px;font-weight:700;color:#374151;margin-bottom:12px;">الطلبات المعلّقة (${generalStats.pendingItems.length})</div>
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
              <thead>
                <tr style="background:#f8fafc;">
                  <th style="padding:10px 12px;text-align:right;font-size:12px;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0;">رقم الطلب</th>
                  <th style="padding:10px 12px;text-align:right;font-size:12px;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0;">الموضوع</th>
                  <th style="padding:10px 12px;text-align:right;font-size:12px;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0;">النوع</th>
                  <th style="padding:10px 12px;text-align:center;font-size:12px;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0;">الحالة</th>
                  <th style="padding:10px 12px;text-align:right;font-size:12px;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0;">التاريخ</th>
                </tr>
              </thead>
              <tbody>${pendingGeneralRows}</tbody>
            </table>
          </div>` : `<div style="text-align:center;padding:20px;color:#10b981;font-size:14px;margin-top:16px;">✅ لا توجد طلبات واستفسارات معلّقة</div>`}
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="padding:32px 40px;text-align:center;border-top:1px solid #f1f5f9;margin-top:28px;">
          <p style="font-size:12px;color:#94a3b8;margin:0;">
            هذا التقرير مُولَّد تلقائياً من منصة كومو للتطوير العقاري<br>
            يُرسل كل يوم اثنين الساعة 9:00 صباحاً بتوقيت دبي
          </p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

async function sendWeeklyReport() {
  if (isRunning) return;
  isRunning = true;
  try {
    const db = await getDb();
    if (!db) {
      console.warn("[WeeklyReport] Database not available");
      return;
    }

    const config = await getConfig();

    // Fetch all non-archived payment requests
    const allPayments = await db.select({
      id: paymentRequests.id,
      requestNumber: paymentRequests.requestNumber,
      description: paymentRequests.description,
      amount: paymentRequests.amount,
      currency: paymentRequests.currency,
      status: paymentRequests.status,
      createdAt: paymentRequests.createdAt,
    }).from(paymentRequests).where(eq(paymentRequests.isArchived, 0));

    // Fetch all non-archived general requests
    const allGeneral = await db.select({
      id: generalRequests.id,
      requestNumber: generalRequests.requestNumber,
      subject: generalRequests.subject,
      requestType: generalRequests.requestType,
      status: generalRequests.status,
      createdAt: generalRequests.createdAt,
    }).from(generalRequests).where(eq(generalRequests.isArchived, 0));

    // Payment stats
    const pendingPaymentStatuses = ["new", "pending_wael", "pending_sheikh", "needs_revision"];
    const pendingPayments = allPayments.filter(r => pendingPaymentStatuses.includes(r.status));
    const approvedPayments = allPayments.filter(r => r.status === "approved");
    const rejectedPayments = allPayments.filter(r => r.status === "rejected");
    const disbursedPayments = allPayments.filter(r => r.status === "disbursed");
    const needsRevisionPayments = allPayments.filter(r => r.status === "needs_revision");
    const pendingAmount = pendingPayments.reduce((sum, r) => sum + parseFloat(r.amount || "0"), 0);

    // General stats
    const pendingGeneralStatuses = ["new", "pending_wael", "pending_sheikh", "needs_revision"];
    const pendingGeneral = allGeneral.filter(r => pendingGeneralStatuses.includes(r.status));
    const approvedGeneral = allGeneral.filter(r => r.status === "approved");
    const rejectedGeneral = allGeneral.filter(r => r.status === "rejected");
    const needsRevisionGeneral = allGeneral.filter(r => r.status === "needs_revision");

    // Build week label
    const now = new Date();
    const dubaiMs = now.getTime() + 4 * 60 * 60 * 1000;
    const dubaiDate = new Date(dubaiMs);
    const weekStart = new Date(dubaiMs - (dubaiDate.getUTCDay() === 0 ? 6 : dubaiDate.getUTCDay() - 1) * 86400000);
    const weekEnd = new Date(weekStart.getTime() + 6 * 86400000);
    const weekLabel = `${weekStart.toISOString().split("T")[0]} — ${weekEnd.toISOString().split("T")[0]}`;

    const emailHtml = buildWeeklyReportEmail({
      weekLabel,
      paymentStats: {
        total: allPayments.length,
        pending: pendingPayments.length,
        approved: approvedPayments.length,
        rejected: rejectedPayments.length,
        disbursed: disbursedPayments.length,
        needsRevision: needsRevisionPayments.length,
        totalAmount: allPayments.reduce((sum, r) => sum + parseFloat(r.amount || "0"), 0),
        pendingAmount,
        pendingItems: pendingPayments.map(r => ({
          requestNumber: r.requestNumber,
          description: r.description,
          amount: r.amount,
          currency: r.currency,
          status: r.status,
          createdAt: r.createdAt,
        })),
      },
      generalStats: {
        total: allGeneral.length,
        pending: pendingGeneral.length,
        approved: approvedGeneral.length,
        rejected: rejectedGeneral.length,
        needsRevision: needsRevisionGeneral.length,
        pendingItems: pendingGeneral.map(r => ({
          requestNumber: r.requestNumber,
          subject: r.subject,
          requestType: r.requestType,
          status: r.status,
          createdAt: r.createdAt,
        })),
      },
    });

    const subject = `التقرير الأسبوعي — كومو للتطوير العقاري — ${weekLabel}`;
    const recipients = [config.adminEmail, config.waelEmail, config.sheikhEmail];
    let sentCount = 0;
    for (const email of recipients) {
      try {
        const ok = await sendReply(email, subject, emailHtml);
        if (ok) sentCount++;
      } catch (err) {
        console.error(`[WeeklyReport] Failed to send to ${email}:`, err);
      }
    }
    console.log(`[WeeklyReport] Sent weekly report to ${sentCount}/${recipients.length} recipients`);
  } catch (err) {
    console.error("[WeeklyReport] Error generating report:", err);
  } finally {
    isRunning = false;
  }
}

async function checkSchedule() {
  if (isRunning) return;
  const today = new Date().toISOString().split("T")[0];
  if (shouldRunNow() && lastReportSentDate !== today) {
    lastReportSentDate = today;
    console.log("[WeeklyReport] Monday 9AM Dubai — sending weekly summary report");
    await sendWeeklyReport();
  }
}

export function startWeeklyReportScheduler() {
  if (schedulerInterval) return;
  console.log("[WeeklyReport] Starting — will send every Monday at 9:00 AM Dubai time");
  schedulerInterval = setInterval(checkSchedule, 60 * 1000); // check every minute
}

export function stopWeeklyReportScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log("[WeeklyReport] Stopped");
  }
}

export async function forceWeeklyReport(): Promise<void> {
  console.log("[WeeklyReport] Manual send triggered");
  await sendWeeklyReport();
}
