import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb, createEmailNotification } from "../db";
import { businessPartners, paymentRequests, users, approvalSettings } from "../../drizzle/schema";
import { eq, desc, sql } from "drizzle-orm";
import { storagePut } from "../storage";
import { sendReply } from "../emailMonitor";
import { generatePaymentOrderPDF, generateMonthlyReportPDF } from "../pdfGenerator";
import { storagePut as s3Put } from "../storage";

// Finance team emails (defaults - overridden by approval_settings table)
const DEFAULT_FINANCE_EMAILS = ["shahid@zooma.ae", "account.mrt@zooma.ae", "thanseeh@globalhightrend.com"];
const DEFAULT_CC_EMAILS = ["wael@zooma.ae", "a.zaqout@comodevelopments.com"];
const DEFAULT_WAEL_EMAIL = "wael@zooma.ae";
const DEFAULT_SHEIKH_EMAIL = "essaabuseif@gmail.com";

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

function generateRequestNumber(): string {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 9000) + 1000;
  return `PAY-${year}-${random}`;
}

export const businessPartnersRouter = router({
  // ── List all partners ──────────────────────────────────────────────────────
  list: protectedProcedure.query(async () => {
    const db = await getDb();
    return db.select().from(businessPartners).orderBy(desc(businessPartners.createdAt));
  }),

  // ── Get single partner ─────────────────────────────────────────────────────
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      const [partner] = await db.select().from(businessPartners).where(eq(businessPartners.id, input.id));
      return partner || null;
    }),

  // ── Create partner ─────────────────────────────────────────────────────────
  create: protectedProcedure
    .input(z.object({
      companyName: z.string().min(1),
      category: z.string().optional(),
      contactPerson: z.string().optional(),
      mobileNumber: z.string().optional(),
      emailAddress: z.string().optional(),
      website: z.string().optional(),
      status: z.enum(["quoted_only", "under_review", "appointed", "not_selected"]).default("quoted_only"),
      notes: z.string().optional(),
      // Bank
      beneficiaryName: z.string().optional(),
      accountNumber: z.string().optional(),
      iban: z.string().optional(),
      bankName: z.string().optional(),
      branchName: z.string().optional(),
      currency: z.string().optional(),
      bankNotes: z.string().optional(),
      // Signatory
      signatoryName: z.string().optional(),
      signatoryTitle: z.string().optional(),
      signatoryEmail: z.string().optional(),
      signatoryPhone: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      const [result] = await db.insert(businessPartners).values({
        companyName: input.companyName,
        category: input.category,
        contactPerson: input.contactPerson,
        mobileNumber: input.mobileNumber,
        emailAddress: input.emailAddress,
        website: input.website,
        status: input.status,
        notes: input.notes,
        beneficiaryName: input.beneficiaryName,
        accountNumber: input.accountNumber,
        iban: input.iban,
        bankName: input.bankName,
        branchName: input.branchName,
        currency: input.currency || "AED",
        bankNotes: input.bankNotes,
        signatoryName: input.signatoryName,
        signatoryTitle: input.signatoryTitle,
        signatoryEmail: input.signatoryEmail,
        signatoryPhone: input.signatoryPhone,
      });
      return { id: (result as any).insertId };
    }),

  // ── Update partner ─────────────────────────────────────────────────────────
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      companyName: z.string().min(1).optional(),
      category: z.string().optional(),
      contactPerson: z.string().optional(),
      mobileNumber: z.string().optional(),
      emailAddress: z.string().optional(),
      website: z.string().optional(),
      status: z.enum(["quoted_only", "under_review", "appointed", "not_selected"]).optional(),
      notes: z.string().optional(),
      // Bank
      beneficiaryName: z.string().optional(),
      accountNumber: z.string().optional(),
      iban: z.string().optional(),
      bankName: z.string().optional(),
      branchName: z.string().optional(),
      currency: z.string().optional(),
      bankNotes: z.string().optional(),
      // Signatory
      signatoryName: z.string().optional(),
      signatoryTitle: z.string().optional(),
      signatoryEmail: z.string().optional(),
      signatoryPhone: z.string().optional(),
      // Document URLs (set by upload procedure)
      commercialLicenseUrl: z.string().optional(),
      commercialLicenseName: z.string().optional(),
      vatCertificateUrl: z.string().optional(),
      vatCertificateName: z.string().optional(),
      authorizedSignatoryDocUrl: z.string().optional(),
      authorizedSignatoryDocName: z.string().optional(),
      otherDocumentsJson: z.string().optional(),
      signatoryImageUrl: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      const { id, ...data } = input;
      await db.update(businessPartners).set(data).where(eq(businessPartners.id, id));
      return { success: true };
    }),

  // ── Delete partner ─────────────────────────────────────────────────────────
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      await db.delete(businessPartners).where(eq(businessPartners.id, input.id));
      return { success: true };
    }),

  // ── Upload document ────────────────────────────────────────────────────────
  uploadDocument: protectedProcedure
    .input(z.object({
      partnerId: z.number(),
      fieldType: z.enum(["commercialLicense", "vatCertificate", "authorizedSignatoryDoc", "signatoryImage", "other"]),
      fileName: z.string(),
      fileBase64: z.string(),
      mimeType: z.string(),
    }))
    .mutation(async ({ input }) => {
      const buffer = Buffer.from(input.fileBase64, "base64");
      const key = `partners/${input.partnerId}/${input.fieldType}-${Date.now()}-${input.fileName}`;
      const { url } = await storagePut(key, buffer, input.mimeType);

      const db = await getDb();
      const updateData: Record<string, string> = {};

      if (input.fieldType === "commercialLicense") {
        updateData.commercialLicenseUrl = url;
        updateData.commercialLicenseName = input.fileName;
      } else if (input.fieldType === "vatCertificate") {
        updateData.vatCertificateUrl = url;
        updateData.vatCertificateName = input.fileName;
      } else if (input.fieldType === "authorizedSignatoryDoc") {
        updateData.authorizedSignatoryDocUrl = url;
        updateData.authorizedSignatoryDocName = input.fileName;
      } else if (input.fieldType === "signatoryImage") {
        updateData.signatoryImageUrl = url;
      }

      if (Object.keys(updateData).length > 0) {
        await db.update(businessPartners).set(updateData).where(eq(businessPartners.id, input.partnerId));
      }

      return { url, fileName: input.fileName };
    }),
});

export const paymentRequestsRouter = router({
  // ── List all payment requests ──────────────────────────────────────────────
  list: protectedProcedure.query(async () => {
    const db = await getDb();
    const requests = await db
      .select({
        id: paymentRequests.id,
        requestNumber: paymentRequests.requestNumber,
        partnerId: paymentRequests.partnerId,
        partnerName: businessPartners.companyName,
        projectName: paymentRequests.projectName,
        description: paymentRequests.description,
        amount: paymentRequests.amount,
        currency: paymentRequests.currency,
        status: paymentRequests.status,
        waelDecision: paymentRequests.waelDecision,
        sheikhDecision: paymentRequests.sheikhDecision,
        financeEmailSentAt: paymentRequests.financeEmailSentAt,
        createdAt: paymentRequests.createdAt,
        approvedQuoteUrl: paymentRequests.approvedQuoteUrl,
        approvedQuoteName: paymentRequests.approvedQuoteName,
      })
      .from(paymentRequests)
      .leftJoin(businessPartners, eq(paymentRequests.partnerId, businessPartners.id))
      .orderBy(desc(paymentRequests.createdAt));
    return requests;
  }),

  // ── Get single request ─────────────────────────────────────────────────────
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      const [req] = await db
        .select()
        .from(paymentRequests)
        .leftJoin(businessPartners, eq(paymentRequests.partnerId, businessPartners.id))
        .where(eq(paymentRequests.id, input.id));
      return req || null;
    }),

  // ── Create payment request ─────────────────────────────────────────────────
  create: protectedProcedure
    .input(z.object({
      partnerId: z.number(),
      projectName: z.string().optional(),
      description: z.string().min(1),
      amount: z.string(), // decimal as string
      currency: z.string().default("AED"),
      approvedQuoteUrl: z.string().optional(),
      approvedQuoteName: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      const requestNumber = generateRequestNumber();
      const [result] = await db.insert(paymentRequests).values({
        requestNumber,
        partnerId: input.partnerId,
        projectName: input.projectName,
        description: input.description,
        amount: input.amount,
        currency: input.currency,
        approvedQuoteUrl: input.approvedQuoteUrl,
        approvedQuoteName: input.approvedQuoteName,
        status: "pending_wael",
        submittedBy: ctx.user.id,
      });
      const insertId = (result as any).insertId;

      // Notify Wael by email about new payment request
      try {
        const [partner] = await db.select().from(businessPartners).where(eq(businessPartners.id, input.partnerId));
        const waelSubject = `طلب صرف جديد يحتاج موافقتك - ${requestNumber}`;
        const waelBody = `
<div style="font-family: Arial, sans-serif; direction: rtl; max-width: 650px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
  <div style="background: #1a3c5e; color: white; padding: 20px 30px; text-align: right;">
    <h2 style="margin: 0; font-size: 20px;">طلب صرف جديد</h2>
    <p style="margin: 5px 0 0; opacity: 0.8; font-size: 13px;">كومو للتطوير العقاري</p>
  </div>
  <div style="padding: 25px 30px; background: #f9f9f9; text-align: right;">
    <p style="color: #333; font-size: 15px;">وائل، يوجد طلب صرف جديد يحتاج موافقتك:</p>
    <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 6px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <tr style="background: #f0f4f8;"><td style="padding: 10px 14px; font-weight: bold; color: #555;">رقم الطلب</td><td style="padding: 10px 14px; font-weight: bold; color: #1a3c5e;">${requestNumber}</td></tr>
      <tr><td style="padding: 10px 14px; font-weight: bold; color: #555;">الجهة المستفيدة</td><td style="padding: 10px 14px;">${partner?.companyName || "—"}</td></tr>
      <tr style="background: #f0f4f8;"><td style="padding: 10px 14px; font-weight: bold; color: #555;">المشروع</td><td style="padding: 10px 14px;">${input.projectName || "—"}</td></tr>
      <tr><td style="padding: 10px 14px; font-weight: bold; color: #555;">المبلغ</td><td style="padding: 10px 14px; font-weight: bold; color: #1a3c5e; font-size: 16px;">${Number(input.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })} ${input.currency}</td></tr>
      <tr style="background: #f0f4f8;"><td style="padding: 10px 14px; font-weight: bold; color: #555;">الوصف</td><td style="padding: 10px 14px;">${input.description}</td></tr>
      <tr><td style="padding: 10px 14px; font-weight: bold; color: #555;">مقدم الطلب</td><td style="padding: 10px 14px;">${ctx.user.name}</td></tr>
    </table>
    <p style="margin-top: 15px; color: #666; font-size: 13px;">يرجى الدخول على المنصة لمراجعة الطلب والبت فيه.</p>
  </div>
</div>`;
        await sendReply(WAEL_EMAIL, waelSubject, waelBody);
      } catch (emailErr) {
        console.error("[PaymentRequest] Failed to send Wael notification email:", emailErr);
      }

      return { id: insertId, requestNumber };
    }),

  // ── Upload approved quote ──────────────────────────────────────────────────
  uploadQuote: protectedProcedure
    .input(z.object({
      requestId: z.number().optional(),
      fileName: z.string(),
      fileBase64: z.string(),
      mimeType: z.string(),
    }))
    .mutation(async ({ input }) => {
      const buffer = Buffer.from(input.fileBase64, "base64");
      const key = `payment-quotes/${Date.now()}-${input.fileName}`;
      const { url } = await storagePut(key, buffer, input.mimeType);

      if (input.requestId) {
        const db = await getDb();
        await db.update(paymentRequests)
          .set({ approvedQuoteUrl: url, approvedQuoteName: input.fileName })
          .where(eq(paymentRequests.id, input.requestId));
      }

      return { url, fileName: input.fileName };
    }),

  // ── Wael review ────────────────────────────────────────────────────────────
  waelReview: protectedProcedure
    .input(z.object({
      id: z.number(),
      decision: z.enum(["approved", "rejected", "needs_revision"]),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      const newStatus = input.decision === "approved" ? "pending_sheikh"
        : input.decision === "rejected" ? "rejected"
        : "needs_revision";

      await db.update(paymentRequests).set({
        waelDecision: input.decision,
        waelNotes: input.notes,
        waelReviewedAt: new Date().toISOString().slice(0, 19).replace("T", " "),
        status: newStatus,
      }).where(eq(paymentRequests.id, input.id));

      // Get request info
      const [pr] = await db.select().from(paymentRequests).where(eq(paymentRequests.id, input.id));

      // Notify submitter internally
      try {
        if (pr?.submittedBy) {
          const decisionLabel = input.decision === "approved" ? "تمت الموافقة عليه من وائل وأُحيل للشيخ عيسى"
            : input.decision === "rejected" ? "تم رفضه من وائل"
            : "يحتاج إلى مراجعة (وائل)";
          await createEmailNotification({
            userId: pr.submittedBy,
            emailUid: Date.now(),
            fromEmail: "noreply@comodevelopments.com",
            fromName: "نظام طلبات الصرف",
            subject: `طلب الصرف ${pr.requestNumber} - ${decisionLabel}`,
            preview: input.notes ? `ملاحظة وائل: ${input.notes}` : decisionLabel,
            receivedAt: Date.now(),
          });
        }
      } catch (notifErr) {
        console.error("[PaymentRequest] Failed to send waelReview notification:", notifErr);
      }

      // If Wael approved → email Sheikh Issa
      if (input.decision === "approved" && pr) {
        try {
          const [partnerRow] = await db.select().from(businessPartners).where(eq(businessPartners.id, pr.partnerId));
          const sheikhSubject = `طلب صرف يحتاج اعتمادك - ${pr.requestNumber}`;
          const sheikhBody = `
<div style="font-family: Arial, sans-serif; direction: rtl; max-width: 650px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
  <div style="background: #1a3c5e; color: white; padding: 20px 30px; text-align: right;">
    <h2 style="margin: 0; font-size: 20px;">طلب صرف يحتاج اعتمادكم</h2>
    <p style="margin: 5px 0 0; opacity: 0.8; font-size: 13px;">كومو للتطوير العقاري</p>
  </div>
  <div style="padding: 25px 30px; background: #f9f9f9; text-align: right;">
    <p style="color: #333; font-size: 15px;">سعادة الشيخ عيسى، وافق وائل على طلب الصرف التالي ويحتاج اعتمادكم:</p>
    <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 6px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <tr style="background: #f0f4f8;"><td style="padding: 10px 14px; font-weight: bold; color: #555;">رقم الطلب</td><td style="padding: 10px 14px; font-weight: bold; color: #1a3c5e;">${pr.requestNumber}</td></tr>
      <tr><td style="padding: 10px 14px; font-weight: bold; color: #555;">الجهة المستفيدة</td><td style="padding: 10px 14px;">${partnerRow?.companyName || "—"}</td></tr>
      <tr style="background: #f0f4f8;"><td style="padding: 10px 14px; font-weight: bold; color: #555;">المشروع</td><td style="padding: 10px 14px;">${pr.projectName || "—"}</td></tr>
      <tr><td style="padding: 10px 14px; font-weight: bold; color: #555;">المبلغ</td><td style="padding: 10px 14px; font-weight: bold; color: #1a3c5e; font-size: 16px;">${Number(pr.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })} ${pr.currency}</td></tr>
      <tr style="background: #f0f4f8;"><td style="padding: 10px 14px; font-weight: bold; color: #555;">الوصف</td><td style="padding: 10px 14px;">${pr.description}</td></tr>
      <tr><td style="padding: 10px 14px; font-weight: bold; color: #555;">ملاحظة وائل</td><td style="padding: 10px 14px;">${input.notes || "—"}</td></tr>
      ${pr.approvedQuoteUrl ? `<tr style="background: #f0f4f8;"><td style="padding: 10px 14px; font-weight: bold; color: #555;">العرض المعتمد</td><td style="padding: 10px 14px;"><a href="${pr.approvedQuoteUrl}" style="color: #1a3c5e;">عرض الملف</a></td></tr>` : ""}
    </table>
    <p style="margin-top: 15px; color: #666; font-size: 13px;">يرجى الدخول على المنصة لمراجعة الطلب واعتماده أو رفضه.</p>
  </div>
</div>`;
          await sendReply(SHEIKH_EMAIL, sheikhSubject, sheikhBody, undefined, WAEL_EMAIL);
        } catch (sheikhEmailErr) {
          console.error("[PaymentRequest] Failed to send Sheikh Issa email:", sheikhEmailErr);
        }
      }

      return { success: true, newStatus };
    }),

  // ── Sheikh Issa review ─────────────────────────────────────────────────────
  sheikhReview: protectedProcedure
    .input(z.object({
      id: z.number(),
      decision: z.enum(["approved", "rejected", "needs_revision"]),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      const newStatus = input.decision === "approved" ? "approved"
        : input.decision === "rejected" ? "rejected"
        : "needs_revision";

      await db.update(paymentRequests).set({
        sheikhDecision: input.decision as any,
        sheikhNotes: input.notes,
        sheikhReviewedAt: new Date().toISOString().slice(0, 19).replace("T", " "),
        status: newStatus,
      }).where(eq(paymentRequests.id, input.id));

      // If approved, send email to finance
      if (input.decision === "approved") {
        // Get full request + partner data
        const [req] = await db
          .select()
          .from(paymentRequests)
          .leftJoin(businessPartners, eq(paymentRequests.partnerId, businessPartners.id))
          .where(eq(paymentRequests.id, input.id));

        if (req) {
          const pr = req.payment_requests;
          const partner = req.business_partners;
          const approvalDate = new Date().toLocaleDateString("en-GB");

          // English email for finance team
          const financeSubject = `Payment Order - ${pr.requestNumber}`;
          const financeBody = `
<div style="font-family: Arial, sans-serif; direction: ltr; max-width: 700px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
  <div style="background: #1a3c5e; color: white; padding: 20px 30px;">
    <h2 style="margin: 0; font-size: 22px;">PAYMENT ORDER</h2>
    <p style="margin: 5px 0 0; opacity: 0.8; font-size: 14px;">Como Developments</p>
  </div>
  <div style="padding: 30px; background: #f9f9f9;">
    <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 6px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <tr style="background: #f0f4f8;">
        <td style="padding: 12px 16px; font-weight: bold; color: #555; width: 40%;">Order Number</td>
        <td style="padding: 12px 16px; font-weight: bold; color: #1a3c5e;">${pr.requestNumber}</td>
      </tr>
      <tr>
        <td style="padding: 12px 16px; font-weight: bold; color: #555;">Project</td>
        <td style="padding: 12px 16px;">${pr.projectName || "—"}</td>
      </tr>
      <tr style="background: #f0f4f8;">
        <td style="padding: 12px 16px; font-weight: bold; color: #555;">Company / Beneficiary</td>
        <td style="padding: 12px 16px;">${partner?.companyName || "—"}</td>
      </tr>
      <tr>
        <td style="padding: 12px 16px; font-weight: bold; color: #555;">Beneficiary Name</td>
        <td style="padding: 12px 16px;">${partner?.beneficiaryName || "—"}</td>
      </tr>
      <tr style="background: #f0f4f8;">
        <td style="padding: 12px 16px; font-weight: bold; color: #555;">Account Number</td>
        <td style="padding: 12px 16px;">${partner?.accountNumber || "—"}</td>
      </tr>
      <tr>
        <td style="padding: 12px 16px; font-weight: bold; color: #555;">IBAN</td>
        <td style="padding: 12px 16px; font-family: monospace;">${partner?.iban || "—"}</td>
      </tr>
      <tr style="background: #f0f4f8;">
        <td style="padding: 12px 16px; font-weight: bold; color: #555;">Bank Name</td>
        <td style="padding: 12px 16px;">${partner?.bankName || "—"}</td>
      </tr>
      <tr>
        <td style="padding: 12px 16px; font-weight: bold; color: #555;">Branch</td>
        <td style="padding: 12px 16px;">${partner?.branchName || "—"}</td>
      </tr>
      <tr style="background: #f0f4f8;">
        <td style="padding: 12px 16px; font-weight: bold; color: #555; font-size: 16px;">Amount</td>
        <td style="padding: 12px 16px; font-weight: bold; color: #1a3c5e; font-size: 18px;">${Number(pr.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })} ${pr.currency}</td>
      </tr>
      <tr>
        <td style="padding: 12px 16px; font-weight: bold; color: #555;">Description</td>
        <td style="padding: 12px 16px;">${pr.description}</td>
      </tr>
      <tr style="background: #f0f4f8;">
        <td style="padding: 12px 16px; font-weight: bold; color: #555;">Approved Quote</td>
        <td style="padding: 12px 16px;">${pr.approvedQuoteUrl ? `<a href="${pr.approvedQuoteUrl}" style="color: #1a3c5e;">View Document</a>` : "—"}</td>
      </tr>
      <tr>
        <td style="padding: 12px 16px; font-weight: bold; color: #555;">Approved By</td>
        <td style="padding: 12px 16px;">Sheikh Issa & Wael</td>
      </tr>
      <tr style="background: #f0f4f8;">
        <td style="padding: 12px 16px; font-weight: bold; color: #555;">Approval Date</td>
        <td style="padding: 12px 16px;">${approvalDate}</td>
      </tr>
    </table>
    <div style="margin-top: 20px; padding: 15px; background: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px;">
      <p style="margin: 0; font-size: 13px; color: #856404;">This is an official payment order approved by Como Developments management. Please process within 2 business days.</p>
    </div>
  </div>
  <div style="padding: 15px 30px; background: #1a3c5e; color: rgba(255,255,255,0.7); font-size: 12px; text-align: center;">
    Como Developments | Confidential Payment Order
  </div>
</div>`;

          // Arabic email for management CC
          const arabicBody = `
<div style="font-family: Arial, sans-serif; direction: rtl; max-width: 700px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
  <div style="background: #1a3c5e; color: white; padding: 20px 30px; text-align: right;">
    <h2 style="margin: 0; font-size: 22px;">أمر صرف معتمد</h2>
    <p style="margin: 5px 0 0; opacity: 0.8; font-size: 14px;">كومو للتطوير العقاري</p>
  </div>
  <div style="padding: 30px; background: #f9f9f9; text-align: right;">
    <p style="color: #333;">تم اعتماد طلب الصرف التالي من قبل الشيخ عيسى ووائل:</p>
    <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 6px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <tr style="background: #f0f4f8;">
        <td style="padding: 12px 16px; font-weight: bold; color: #555; text-align: right;">رقم الأمر</td>
        <td style="padding: 12px 16px; font-weight: bold; color: #1a3c5e; text-align: right;">${pr.requestNumber}</td>
      </tr>
      <tr>
        <td style="padding: 12px 16px; font-weight: bold; color: #555; text-align: right;">المشروع</td>
        <td style="padding: 12px 16px; text-align: right;">${pr.projectName || "—"}</td>
      </tr>
      <tr style="background: #f0f4f8;">
        <td style="padding: 12px 16px; font-weight: bold; color: #555; text-align: right;">الجهة المستفيدة</td>
        <td style="padding: 12px 16px; text-align: right;">${partner?.companyName || "—"}</td>
      </tr>
      <tr>
        <td style="padding: 12px 16px; font-weight: bold; color: #555; text-align: right; font-size: 16px;">المبلغ</td>
        <td style="padding: 12px 16px; font-weight: bold; color: #1a3c5e; font-size: 18px; text-align: right;">${Number(pr.amount).toLocaleString("ar-AE", { minimumFractionDigits: 2 })} ${pr.currency}</td>
      </tr>
      <tr style="background: #f0f4f8;">
        <td style="padding: 12px 16px; font-weight: bold; color: #555; text-align: right;">الوصف</td>
        <td style="padding: 12px 16px; text-align: right;">${pr.description}</td>
      </tr>
      <tr>
        <td style="padding: 12px 16px; font-weight: bold; color: #555; text-align: right;">تاريخ الاعتماد</td>
        <td style="padding: 12px 16px; text-align: right;">${approvalDate}</td>
      </tr>
    </table>
    <p style="margin-top: 15px; color: #666; font-size: 13px;">تم إرسال أمر الصرف الرسمي إلى فريق المالية.</p>
  </div>
</div>`;

          // Send to finance team
          try {
            for (const financeEmail of FINANCE_EMAILS) {
              await sendReply(
                financeEmail,
                financeSubject,
                financeBody,
                undefined,
                CC_EMAILS.join(",")
              );
            }

            // Update finance email sent timestamp
            await db.update(paymentRequests).set({
              financeEmailSentAt: new Date().toISOString().slice(0, 19).replace("T", " "),
            }).where(eq(paymentRequests.id, input.id));
          } catch (emailErr) {
            console.error("[PaymentRequest] Failed to send finance email:", emailErr);
          }
        }
      }

      // Notify submitter about sheikh's decision
      try {
        const [pr] = await db.select().from(paymentRequests).where(eq(paymentRequests.id, input.id));
        if (pr?.submittedBy) {
          const decisionLabel = input.decision === "approved"
            ? "تم اعتماده من الشيخ عيسى ✔️ وسيتم إخطار فريق المالية"
            : input.decision === "needs_revision"
            ? "يحتاج إلى مراجعة (الشيخ عيسى)"
            : "تم رفضه من الشيخ عيسى";
          await createEmailNotification({
            userId: pr.submittedBy,
            emailUid: Date.now() + 1,
            fromEmail: "noreply@comodevelopments.com",
            fromName: "نظام طلبات الصرف",
            subject: `طلب الصرف ${pr.requestNumber} - ${decisionLabel}`,
            preview: input.notes ? `ملاحظة الشيخ عيسى: ${input.notes}` : decisionLabel,
            receivedAt: Date.now() + 1,
          });
        }
      } catch (notifErr) {
        console.error("[PaymentRequest] Failed to send sheikhReview notification:", notifErr);
      }

      return { success: true, newStatus };
    }),

  // ── Update payment request (for needs_revision state) ───────────────────────
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      projectName: z.string().optional(),
      description: z.string().min(1).optional(),
      amount: z.string().optional(),
      currency: z.string().optional(),
      approvedQuoteUrl: z.string().optional(),
      approvedQuoteName: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      const { id, ...data } = input;
      // Reset to pending_wael so it goes through approval again
      await db.update(paymentRequests).set({
        ...data,
        status: "pending_wael",
        waelDecision: null as any,
        waelNotes: null as any,
        waelReviewedAt: null as any,
        sheikhDecision: null as any,
        sheikhNotes: null as any,
        sheikhReviewedAt: null as any,
      }).where(eq(paymentRequests.id, id));
      return { success: true };
    }),

  // ── Check document completeness ────────────────────────────────────────────
  checkCompleteness: protectedProcedure
    .input(z.object({ partnerId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      const [partner] = await db.select().from(businessPartners).where(eq(businessPartners.id, input.partnerId));
      if (!partner) return { complete: false, missing: ["Partner not found"] };

      const missing: string[] = [];
      if (!partner.commercialLicenseUrl) missing.push("Commercial License");
      if (!partner.vatCertificateUrl) missing.push("VAT Certificate");
      if (!partner.authorizedSignatoryDocUrl) missing.push("Authorized Signatory Document");
      if (!partner.beneficiaryName) missing.push("Beneficiary Name");
      if (!partner.accountNumber) missing.push("Account Number");
      if (!partner.iban) missing.push("IBAN");
      if (!partner.bankName) missing.push("Bank Name");

      return { complete: missing.length === 0, missing };
    }),

  // ── Export payment order as PDF ────────────────────────────────────────────
  exportPDF: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      const [req] = await db
        .select()
        .from(paymentRequests)
        .leftJoin(businessPartners, eq(paymentRequests.partnerId, businessPartners.id))
        .where(eq(paymentRequests.id, input.id));

      if (!req) throw new Error("Payment request not found");

      const pr = req.payment_requests;
      const partner = req.business_partners;

      // Get submitter name
      let submittedByName = "—";
      if (pr.submittedBy) {
        const [submitter] = await db.select().from(users).where(eq(users.id, pr.submittedBy));
        submittedByName = submitter?.name || "—";
      }

      const approvalDate = pr.sheikhReviewedAt
        ? new Date(pr.sheikhReviewedAt).toLocaleDateString("en-GB")
        : new Date().toLocaleDateString("en-GB");

      const pdfBuffer = await generatePaymentOrderPDF({
        requestNumber: pr.requestNumber,
        projectName: pr.projectName,
        companyName: partner?.companyName,
        beneficiaryName: partner?.beneficiaryName,
        accountNumber: partner?.accountNumber,
        iban: partner?.iban,
        bankName: partner?.bankName,
        branchName: partner?.branchName,
        amount: pr.amount,
        currency: pr.currency,
        description: pr.description,
        approvedQuoteUrl: pr.approvedQuoteUrl,
        approvedQuoteName: pr.approvedQuoteName,
        approvalDate,
        submittedByName,
        waelNotes: pr.waelNotes,
        sheikhNotes: pr.sheikhNotes,
      });

      const key = `payment-orders/pdf/${pr.requestNumber}-${Date.now()}.pdf`;
      const { url } = await s3Put(key, pdfBuffer, "application/pdf");
      return { url, fileName: `${pr.requestNumber}.pdf` };
    }),

  // ── Monthly report PDF ─────────────────────────────────────────────────────
  monthlyReportPDF: protectedProcedure
    .input(z.object({ year: z.number(), month: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      const requests = await db
        .select({
          id: paymentRequests.id,
          requestNumber: paymentRequests.requestNumber,
          partnerId: paymentRequests.partnerId,
          partnerName: businessPartners.companyName,
          projectName: paymentRequests.projectName,
          description: paymentRequests.description,
          amount: paymentRequests.amount,
          currency: paymentRequests.currency,
          status: paymentRequests.status,
          createdAt: paymentRequests.createdAt,
        })
        .from(paymentRequests)
        .leftJoin(businessPartners, eq(paymentRequests.partnerId, businessPartners.id))
        .orderBy(desc(paymentRequests.createdAt));

      const filtered = requests.filter(r => {
        const d = new Date(r.createdAt);
        return d.getFullYear() === input.year && d.getMonth() + 1 === input.month;
      });

      const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
      const monthName = monthNames[input.month - 1];

      const totalApproved = filtered.filter(r => r.status === "approved").reduce((s, r) => s + Number(r.amount), 0);
      const totalPending = filtered.filter(r => r.status !== "approved" && r.status !== "rejected").reduce((s, r) => s + Number(r.amount), 0);
      const totalRejected = filtered.filter(r => r.status === "rejected").reduce((s, r) => s + Number(r.amount), 0);

      const pdfBuffer = await generateMonthlyReportPDF({
        month: monthName,
        year: String(input.year),
        requests: filtered.map(r => ({
          requestNumber: r.requestNumber,
          partnerName: r.partnerName || "—",
          projectName: r.projectName || "—",
          amount: r.amount,
          currency: r.currency,
          status: r.status,
          description: r.description || "",
          createdAt: r.createdAt,
        })),
        totalApproved,
        totalPending,
        totalRejected,
        grandTotal: totalApproved + totalPending + totalRejected,
        currency: "AED",
      });

      const key = `payment-orders/reports/monthly-${input.year}-${String(input.month).padStart(2, "0")}-${Date.now()}.pdf`;
      const { url } = await s3Put(key, pdfBuffer, "application/pdf");
      return { url, fileName: `Payment-Report-${monthName}-${input.year}.pdf` };
    }),

  // ── Archive / Unarchive ────────────────────────────────────────────────────────────────────────────
  archive: protectedProcedure
    .input(z.object({ id: z.number(), archive: z.boolean() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      await db.update(paymentRequests)
        .set({
          isArchived: input.archive ? 1 : 0,
          archivedAt: input.archive ? new Date().toISOString().slice(0, 19).replace("T", " ") : null,
        })
        .where(eq(paymentRequests.id, input.id));
      return { success: true };
    }),

  // ── Confirm Disbursement ──────────────────────────────────────────────────────────────────────
  confirmDisbursement: protectedProcedure
    .input(z.object({
      id: z.number(),
      note: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      const [pr] = await db.select().from(paymentRequests).where(eq(paymentRequests.id, input.id));
      if (!pr) throw new TRPCError({ code: "NOT_FOUND", message: "الطلب غير موجود" });
      if (pr.status !== "approved") throw new TRPCError({ code: "BAD_REQUEST", message: "يجب أن يكون الطلب معتمداً أولاً" });
      const now = new Date().toISOString().slice(0, 19).replace("T", " ");
      await db.update(paymentRequests).set({
        status: "disbursed",
        disbursedAt: now,
        disbursedBy: ctx.user.id,
        disbursementNote: input.note || null,
      }).where(eq(paymentRequests.id, input.id));
      return { success: true };
    }),
});

// ── Approval Settings Router ───────────────────────────────────────────────────
export const approvalSettingsRouter = router({
  getAll: protectedProcedure.query(async () => {
    const db = await getDb();
    const rows = await db.select().from(approvalSettings);
    const cfg: Record<string, string> = {};
    for (const row of rows) cfg[row.key] = row.value;
    return cfg;
  }),

  update: protectedProcedure
    .input(z.object({
      wael_name: z.string().min(1),
      wael_email: z.string().email(),
      sheikh_name: z.string().min(1),
      sheikh_email: z.string().email(),
      finance_emails: z.string().min(1),
      cc_emails: z.string().optional().default(""),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      const entries = Object.entries(input) as [string, string][];
      for (const [key, value] of entries) {
        await db
          .insert(approvalSettings)
          .values({ key, value })
          .onDuplicateKeyUpdate({ set: { value } });
      }
      return { success: true };
    }),
});
