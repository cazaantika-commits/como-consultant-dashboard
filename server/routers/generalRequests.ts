/**
 * General Requests & Inquiries Router
 * Non-financial requests: proposal approval, contract approval, meeting, Zoom, inquiry, decision
 * Workflow: new → pending_wael → pending_sheikh → approved / rejected / needs_revision
 * On approval: auto-notify Finance team by email
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { generalRequests, users, approvalSettings } from "../../drizzle/schema";
import { eq, desc, inArray } from "drizzle-orm";
import { sendReply } from "../emailMonitor";
import { storagePut } from "../storage";

// ── Email defaults ─────────────────────────────────────────────────────────────
const DEFAULT_WAEL_EMAIL = "wael@zooma.ae";
const DEFAULT_SHEIKH_EMAIL = "essaabuseif@gmail.com";
const DEFAULT_SUBMITTER_EMAIL = "a.zaqout@comodevelopments.com";
const DEFAULT_FINANCE_EMAILS = ["shahid@zooma.ae", "account.mrt@zooma.ae", "thanseeh@globalhightrend.com"];
const DEFAULT_CC_EMAILS = ["wael@zooma.ae", "a.zaqout@comodevelopments.com"];

async function getApprovalConfig() {
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
      ccEmails: (cfg["cc_emails"] || DEFAULT_CC_EMAILS.join(",")).split(",").map(e => e.trim()).filter(Boolean),
    };
  } catch {
    return {
      waelEmail: DEFAULT_WAEL_EMAIL,
      waelName: "وائل",
      sheikhEmail: DEFAULT_SHEIKH_EMAIL,
      sheikhName: "الشيخ عيسى",
      financeEmails: DEFAULT_FINANCE_EMAILS,
      ccEmails: DEFAULT_CC_EMAILS,
    };
  }
}

// ── Request type labels ────────────────────────────────────────────────────────
const REQUEST_TYPE_LABELS: Record<string, string> = {
  proposal_approval: "اعتماد عرض",
  contract_approval: "اعتماد عقد",
  meeting_request: "طلب اجتماع",
  zoom_meeting: "اجتماع زووم",
  inquiry: "استفسار",
  decision_request: "طلب قرار",
  other: "أخرى",
};

// ── Request number generator ───────────────────────────────────────────────────
function generateRequestNumber(): string {
  const year = new Date().getFullYear();
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `REQ-${year}-${rand}`;
}

// ── Email builder ──────────────────────────────────────────────────────────────
function buildNotificationEmail(params: {
  recipientName: string;
  requestNumber: string;
  requestTypeLabel: string;
  subject: string;
  description: string;
  projectName?: string | null;
  relatedParty?: string | null;
  proposedDate?: string | null;
  submitterName: string;
  actionRequired: string;
  accentColor?: string;
}) {
  const { recipientName, requestNumber, requestTypeLabel, subject, description,
    projectName, relatedParty, proposedDate, submitterName, actionRequired, accentColor = "#1a3c5e" } = params;

  return `
<div style="font-family: Arial, sans-serif; direction: rtl; max-width: 650px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
  <div style="background: ${accentColor}; color: white; padding: 20px 30px; text-align: right;">
    <h2 style="margin: 0; font-size: 20px;">📋 ${requestTypeLabel} — ${requestNumber}</h2>
    <p style="margin: 5px 0 0; opacity: 0.85; font-size: 13px;">كومو للتطوير العقاري</p>
  </div>
  <div style="padding: 25px 30px; background: #f9f9f9; text-align: right;">
    <p style="color: #333; font-size: 15px; margin: 0 0 18px;">
      ${recipientName}، يوجد <strong>${requestTypeLabel}</strong> جديد يحتاج ${actionRequired}:
    </p>
    <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 6px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <tr style="background: #f0f4f8;">
        <td style="padding: 10px 14px; font-weight: bold; color: #555; width: 35%;">رقم الطلب</td>
        <td style="padding: 10px 14px; font-weight: bold; color: ${accentColor};">${requestNumber}</td>
      </tr>
      <tr>
        <td style="padding: 10px 14px; font-weight: bold; color: #555;">نوع الطلب</td>
        <td style="padding: 10px 14px;">${requestTypeLabel}</td>
      </tr>
      <tr style="background: #f0f4f8;">
        <td style="padding: 10px 14px; font-weight: bold; color: #555;">الموضوع</td>
        <td style="padding: 10px 14px;">${subject}</td>
      </tr>
      ${projectName ? `<tr><td style="padding: 10px 14px; font-weight: bold; color: #555;">المشروع</td><td style="padding: 10px 14px;">${projectName}</td></tr>` : ""}
      ${relatedParty ? `<tr style="background: #f0f4f8;"><td style="padding: 10px 14px; font-weight: bold; color: #555;">الجهة المعنية</td><td style="padding: 10px 14px;">${relatedParty}</td></tr>` : ""}
      ${proposedDate ? `<tr><td style="padding: 10px 14px; font-weight: bold; color: #555;">التاريخ المقترح</td><td style="padding: 10px 14px;">${proposedDate}</td></tr>` : ""}
      <tr style="background: #f0f4f8;">
        <td style="padding: 10px 14px; font-weight: bold; color: #555;">التفاصيل</td>
        <td style="padding: 10px 14px;">${description}</td>
      </tr>
      <tr>
        <td style="padding: 10px 14px; font-weight: bold; color: #555;">مقدم الطلب</td>
        <td style="padding: 10px 14px;">${submitterName}</td>
      </tr>
    </table>
    <div style="margin-top: 20px; padding: 15px; background: #e8f4fd; border-right: 4px solid ${accentColor}; border-radius: 4px;">
      <p style="margin: 0; font-size: 13px; color: #1a3c5e;">
        يرجى الدخول على المنصة والبت في هذا الطلب.
      </p>
    </div>
  </div>
  <div style="padding: 15px 30px; background: #1a3c5e; color: rgba(255,255,255,0.7); font-size: 12px; text-align: center;">
    Como Developments | نظام الطلبات والاستفسارات
  </div>
</div>`;
}

// ── Router ─────────────────────────────────────────────────────────────────────
export const generalRequestsRouter = router({

  // ── List all requests ──────────────────────────────────────────────────────
  list: protectedProcedure
    .input(z.object({
      status: z.string().optional(),
      requestType: z.string().optional(),
      showArchived: z.boolean().optional().default(false),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      let query = db.select().from(generalRequests).orderBy(desc(generalRequests.createdAt));
      const rows = await query;
      return rows.filter(r => {
        if (!input.showArchived && r.isArchived) return false;
        if (input.status && r.status !== input.status) return false;
        if (input.requestType && r.requestType !== input.requestType) return false;
        return true;
      });
    }),

  // ── Get single request ─────────────────────────────────────────────────────
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      const [req] = await db.select().from(generalRequests).where(eq(generalRequests.id, input.id));
      return req || null;
    }),

  // ── Create new request ─────────────────────────────────────────────────────
  create: protectedProcedure
    .input(z.object({
      requestType: z.enum(["proposal_approval", "contract_approval", "meeting_request", "zoom_meeting", "inquiry", "decision_request", "other"]),
      subject: z.string().min(1),
      description: z.string().min(1),
      projectName: z.string().optional(),
      relatedParty: z.string().optional(),
      proposedDate: z.string().optional(),
      attachmentUrl: z.string().optional(),
      attachmentName: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      const requestNumber = generateRequestNumber();
      const [result] = await db.insert(generalRequests).values({
        requestNumber,
        requestType: input.requestType,
        subject: input.subject,
        description: input.description,
        projectName: input.projectName,
        relatedParty: input.relatedParty,
        proposedDate: input.proposedDate,
        attachmentUrl: input.attachmentUrl,
        attachmentName: input.attachmentName,
        status: "pending_wael",
        submittedBy: ctx.user.id,
      });

      const cfg = await getApprovalConfig();
      const typeLabel = REQUEST_TYPE_LABELS[input.requestType] || input.requestType;

      // Get submitter name
      let submitterName = ctx.user.name || "—";

      // Notify Wael
      try {
        const emailBody = buildNotificationEmail({
          recipientName: cfg.waelName,
          requestNumber,
          requestTypeLabel: typeLabel,
          subject: input.subject,
          description: input.description,
          projectName: input.projectName,
          relatedParty: input.relatedParty,
          proposedDate: input.proposedDate,
          submitterName,
          actionRequired: "مراجعتك وموافقتك",
          accentColor: "#1a3c5e",
        });
        await sendReply(cfg.waelEmail, `${typeLabel} جديد يحتاج موافقتك — ${requestNumber}`, emailBody, undefined, DEFAULT_SUBMITTER_EMAIL);
      } catch (err) {
        console.error("[GeneralRequests] Failed to notify Wael:", err);
      }

      return { success: true, requestNumber, id: (result as any).insertId };
    }),

  // ── Upload attachment ──────────────────────────────────────────────────────
  uploadAttachment: protectedProcedure
    .input(z.object({
      requestId: z.number().optional(),
      fileName: z.string(),
      fileData: z.string(), // base64
      mimeType: z.string(),
    }))
    .mutation(async ({ input }) => {
      const buffer = Buffer.from(input.fileData, "base64");
      const key = `general-requests/attachments/${Date.now()}-${input.fileName}`;
      const { url } = await storagePut(key, buffer, input.mimeType);

      // If requestId provided, save to DB
      if (input.requestId) {
        const db = await getDb();
        await db.update(generalRequests).set({
          attachmentUrl: url,
          attachmentName: input.fileName,
        }).where(eq(generalRequests.id, input.requestId));
      }

      return { url, fileName: input.fileName };
    }),

  // ── Wael review ───────────────────────────────────────────────────────────
  waelReview: protectedProcedure
    .input(z.object({
      id: z.number(),
      decision: z.enum(["approved", "rejected", "needs_revision"]),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      const [req] = await db.select().from(generalRequests).where(eq(generalRequests.id, input.id));
      if (!req) throw new TRPCError({ code: "NOT_FOUND", message: "الطلب غير موجود" });
      if (req.status !== "pending_wael") throw new TRPCError({ code: "BAD_REQUEST", message: "الطلب ليس في مرحلة مراجعة وائل" });

      const now = new Date().toISOString().slice(0, 19).replace("T", " ");
      let newStatus: string;
      if (input.decision === "approved") newStatus = "pending_sheikh";
      else if (input.decision === "rejected") newStatus = "rejected";
      else newStatus = "needs_revision";

      await db.update(generalRequests).set({
        status: newStatus as any,
        waelDecision: input.decision,
        waelNotes: input.notes || null,
        waelReviewedAt: now,
      }).where(eq(generalRequests.id, input.id));

      const cfg = await getApprovalConfig();
      const typeLabel = REQUEST_TYPE_LABELS[req.requestType] || req.requestType;

      // Notify Sheikh Issa if approved
      if (input.decision === "approved") {
        try {
          const emailBody = buildNotificationEmail({
            recipientName: cfg.sheikhName,
            requestNumber: req.requestNumber,
            requestTypeLabel: typeLabel,
            subject: req.subject,
            description: req.description,
            projectName: req.projectName,
            relatedParty: req.relatedParty,
            proposedDate: req.proposedDate,
            submitterName: "وائل (بعد المراجعة)",
            actionRequired: "اعتمادكم",
            accentColor: "#7c3aed",
          });
          await sendReply(cfg.sheikhEmail, `${typeLabel} يحتاج اعتمادكم — ${req.requestNumber}`, emailBody, undefined, cfg.waelEmail);
        } catch (err) {
          console.error("[GeneralRequests] Failed to notify Sheikh:", err);
        }
      }

      return { success: true, newStatus };
    }),

  // ── Sheikh review ──────────────────────────────────────────────────────────
  sheikhReview: protectedProcedure
    .input(z.object({
      id: z.number(),
      decision: z.enum(["approved", "rejected", "needs_revision"]),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      const [req] = await db.select().from(generalRequests).where(eq(generalRequests.id, input.id));
      if (!req) throw new TRPCError({ code: "NOT_FOUND", message: "الطلب غير موجود" });
      if (req.status !== "pending_sheikh") throw new TRPCError({ code: "BAD_REQUEST", message: "الطلب ليس في مرحلة اعتماد الشيخ عيسى" });

      const now = new Date().toISOString().slice(0, 19).replace("T", " ");
      let newStatus: string;
      if (input.decision === "approved") newStatus = "approved";
      else if (input.decision === "rejected") newStatus = "rejected";
      else newStatus = "needs_revision";

      await db.update(generalRequests).set({
        status: newStatus as any,
        sheikhDecision: input.decision,
        sheikhNotes: input.notes || null,
        sheikhReviewedAt: now,
        financeEmailSentAt: input.decision === "approved" ? now : undefined,
      }).where(eq(generalRequests.id, input.id));

      const cfg = await getApprovalConfig();
      const typeLabel = REQUEST_TYPE_LABELS[req.requestType] || req.requestType;

      // Notify Finance if approved
      if (input.decision === "approved") {
        try {
          const emailBody = buildNotificationEmail({
            recipientName: "فريق المالية",
            requestNumber: req.requestNumber,
            requestTypeLabel: typeLabel,
            subject: req.subject,
            description: req.description,
            projectName: req.projectName,
            relatedParty: req.relatedParty,
            proposedDate: req.proposedDate,
            submitterName: `${cfg.sheikhName} (بعد الاعتماد)`,
            actionRequired: "الإحاطة والمتابعة",
            accentColor: "#059669",
          });
          const financeSubject = `✅ ${typeLabel} معتمد — ${req.requestNumber}`;
          for (const financeEmail of cfg.financeEmails) {
            await sendReply(financeEmail, financeSubject, emailBody, undefined, cfg.ccEmails.join(","));
          }
        } catch (err) {
          console.error("[GeneralRequests] Failed to notify Finance:", err);
        }
      }

      return { success: true, newStatus };
    }),

  // ── Update request (for needs_revision) ────────────────────────────────────
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      subject: z.string().optional(),
      description: z.string().optional(),
      projectName: z.string().optional(),
      relatedParty: z.string().optional(),
      proposedDate: z.string().optional(),
      attachmentUrl: z.string().optional(),
      attachmentName: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      const { id, ...data } = input;
      await db.update(generalRequests).set({
        ...data,
        status: "pending_wael",
        waelDecision: null as any,
        waelNotes: null as any,
        waelReviewedAt: null as any,
        sheikhDecision: null as any,
        sheikhNotes: null as any,
        sheikhReviewedAt: null as any,
      }).where(eq(generalRequests.id, id));
      return { success: true };
    }),

  // ── Archive / Unarchive ────────────────────────────────────────────────────
  archive: protectedProcedure
    .input(z.object({ id: z.number(), archive: z.boolean() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      await db.update(generalRequests).set({
        isArchived: input.archive ? 1 : 0,
        archivedAt: input.archive ? new Date().toISOString().slice(0, 19).replace("T", " ") : null,
      }).where(eq(generalRequests.id, input.id));
      return { success: true };
    }),

  // ── Counts by status ───────────────────────────────────────────────────────
  counts: protectedProcedure.query(async () => {
    const db = await getDb();
    const rows = await db.select().from(generalRequests).where(eq(generalRequests.isArchived, 0));
    const counts = { all: 0, pending_wael: 0, pending_sheikh: 0, approved: 0, rejected: 0, needs_revision: 0 };
    for (const r of rows) {
      counts.all++;
      if (r.status in counts) (counts as any)[r.status]++;
    }
    return counts;
  }),
});
