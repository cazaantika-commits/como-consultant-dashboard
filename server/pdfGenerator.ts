import PDFDocument from "pdfkit";
import https from "https";
import http from "http";

const LOGO_CDN_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663200809965/Q366eAYG4Q7iaM8VuAmmFX/como-logo_1ed757c9.png";
const COMPANY_NAME = "COMO REAL ESTATE DEVELOPMENT L.L.C";
const COMPANY_TAGLINE = "Real Estate Development — UAE";
const BRAND_COLOR = "#1a3c5e";

async function fetchLogoBuffer(): Promise<Buffer | null> {
  return new Promise((resolve) => {
    const client = LOGO_CDN_URL.startsWith("https") ? https : http;
    client.get(LOGO_CDN_URL, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", () => resolve(null));
    }).on("error", () => resolve(null));
  });
}

export interface PaymentOrderData {
  requestNumber: string;
  projectName?: string | null;
  companyName?: string | null;
  beneficiaryName?: string | null;
  accountNumber?: string | null;
  iban?: string | null;
  bankName?: string | null;
  branchName?: string | null;
  amount: string;
  currency: string;
  description: string;
  approvedQuoteUrl?: string | null;
  approvedQuoteName?: string | null;
  contractUrl?: string | null;
  contractName?: string | null;
  additionalAttachments?: Array<{ url: string; name: string }> | null;
  approvalDate: string;
  submittedByName?: string | null;
  waelNotes?: string | null;
  sheikhNotes?: string | null;
}

export interface MonthlyReportData {
  month: string;
  year: string;
  requests: Array<{
    requestNumber: string;
    partnerName: string;
    projectName: string;
    amount: string;
    currency: string;
    status: string;
    description: string;
    createdAt: string;
  }>;
  totalApproved: number;
  totalPending: number;
  totalRejected: number;
  grandTotal: number;
  currency: string;
}

export async function generatePaymentOrderPDF(data: PaymentOrderData): Promise<Buffer> {
  const logoBuffer = await fetchLogoBuffer();
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 50,
      info: {
        Title: `Payment Order - ${data.requestNumber}`,
        Author: COMPANY_NAME,
        Subject: "Payment Order",
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const margin = 50;
    const contentWidth = pageWidth - margin * 2;

    // ── Header background ──────────────────────────────────────────────────────
    doc.rect(0, 0, pageWidth, 120).fill(BRAND_COLOR);

    // Company logo (left side)
    if (logoBuffer) {
      // Draw logo image on white background pill
      doc.rect(margin, 15, 160, 90).fill("white").opacity(0.95);
      doc.opacity(1);
      doc.image(logoBuffer, margin + 5, 20, { width: 150, height: 80, fit: [150, 80] });
    } else {
      // Fallback text logo
      doc.fillColor("white")
        .font("Helvetica-Bold")
        .fontSize(18)
        .text("COMO", margin, 22, { width: contentWidth / 2 });
      doc.fillColor("rgba(255,255,255,0.8)")
        .font("Helvetica")
        .fontSize(9)
        .text("REAL ESTATE DEVELOPMENT L.L.C", margin, 46, { width: contentWidth / 2 });
    }

    // "PAYMENT ORDER" title (right side)
    doc.fillColor("white")
      .font("Helvetica-Bold")
      .fontSize(20)
      .text("PAYMENT ORDER", margin + contentWidth / 2, 28, {
        width: contentWidth / 2,
        align: "right",
      });

    doc.fillColor("rgba(255,255,255,0.75)")
      .font("Helvetica")
      .fontSize(11)
      .text(`Order No: ${data.requestNumber}`, margin + contentWidth / 2, 56, {
        width: contentWidth / 2,
        align: "right",
      });

    doc.fillColor("rgba(255,255,255,0.6)")
      .font("Helvetica")
      .fontSize(9)
      .text(COMPANY_NAME, margin + contentWidth / 2, 78, {
        width: contentWidth / 2,
        align: "right",
      });

    // ── Approval stamp (diagonal) ──────────────────────────────────────────────
    doc.save();
    doc.translate(pageWidth - 110, 145);
    doc.rotate(-35, { origin: [0, 0] });
    doc.rect(-55, -22, 160, 44).lineWidth(3).strokeColor("#16a34a").stroke();
    doc.fillColor("#16a34a")
      .font("Helvetica-Bold")
      .fontSize(18)
      .text("APPROVED", -50, -12, { width: 150, align: "center" });
    doc.restore();

    // ── Date line ─────────────────────────────────────────────────────────────
    doc.fillColor("#555")
      .font("Helvetica")
      .fontSize(10)
      .text(`Date: ${data.approvalDate}`, margin, 130, { align: "right", width: contentWidth });

    // ── Section helpers ────────────────────────────────────────────────────────
    let y = 160;

    const drawSectionHeader = (title: string, yPos: number) => {
      doc.rect(margin, yPos, contentWidth, 24).fill(BRAND_COLOR);
      doc.fillColor("white")
        .font("Helvetica-Bold")
        .fontSize(11)
        .text(title, margin + 10, yPos + 6, { width: contentWidth - 20 });
      return yPos + 24;
    };

    const drawRow = (label: string, value: string, yPos: number, highlight = false) => {
      const rowH = 22;
      doc.rect(margin, yPos, contentWidth, rowH).fill(highlight ? "#f0f7ff" : "#fafafa");
      doc.rect(margin, yPos, contentWidth, rowH).lineWidth(0.5).strokeColor("#e0e0e0").stroke();
      const colW = contentWidth * 0.38;
      doc.fillColor("#555").font("Helvetica-Bold").fontSize(9.5)
        .text(label, margin + 8, yPos + 6, { width: colW });
      doc.fillColor("#1a1a1a").font("Helvetica").fontSize(9.5)
        .text(value || "—", margin + colW + 8, yPos + 6, { width: contentWidth - colW - 16 });
      return yPos + rowH;
    };

    // ── Payment Details ────────────────────────────────────────────────────────
    y = drawSectionHeader("PAYMENT DETAILS", y);
    y = drawRow("Order Number", data.requestNumber, y, true);
    y = drawRow("Project", data.projectName || "—", y);
    y = drawRow("Description", data.description, y, true);

    // Amount row (larger, green)
    doc.rect(margin, y, contentWidth, 32).fill("#e8f5e9");
    doc.rect(margin, y, contentWidth, 32).lineWidth(0.5).strokeColor("#a5d6a7").stroke();
    const colW = contentWidth * 0.38;
    doc.fillColor("#2e7d32").font("Helvetica-Bold").fontSize(10)
      .text("AMOUNT", margin + 8, y + 10, { width: colW });
    const amountStr = `${Number(data.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })} ${data.currency}`;
    doc.fillColor("#1b5e20").font("Helvetica-Bold").fontSize(16)
      .text(amountStr, margin + colW + 8, y + 7, { width: contentWidth - colW - 16 });
    y += 32;

    // ── Beneficiary Details ────────────────────────────────────────────────────
    y += 12;
    y = drawSectionHeader("BENEFICIARY DETAILS", y);
    y = drawRow("Company / Beneficiary", data.companyName || "—", y, true);
    y = drawRow("Beneficiary Name", data.beneficiaryName || "—", y);
    y = drawRow("Account Number", data.accountNumber || "—", y, true);
    y = drawRow("IBAN", data.iban || "—", y);
    y = drawRow("Bank Name", data.bankName || "—", y, true);
    y = drawRow("Branch", data.branchName || "—", y);

    // ── Approval Chain ─────────────────────────────────────────────────────────
    y += 12;
    y = drawSectionHeader("APPROVAL CHAIN", y);
    y = drawRow("Submitted By", data.submittedByName || "—", y, true);
    y = drawRow("Reviewed By (Wael)", `Approved${data.waelNotes ? ` — Notes: ${data.waelNotes}` : ""}`, y);
    y = drawRow("Approved By (Sheikh Issa)", `Approved${data.sheikhNotes ? ` — Notes: ${data.sheikhNotes}` : ""}`, y, true);
    y = drawRow("Approval Date", data.approvalDate, y);
    if (data.approvedQuoteUrl) {
      y = drawRow("Approved Quote", data.approvedQuoteName || "Attached", y, true);
    }
    if (data.contractUrl) {
      y = drawRow("Contract Document", data.contractName || "Attached", y);
    }
    if (data.additionalAttachments && data.additionalAttachments.length > 0) {
      data.additionalAttachments.forEach((att, i) => {
        y = drawRow(`Attachment ${i + 1}`, att.name || "Document", y, i % 2 === 0);
      });
    }

    // ── Notice box ────────────────────────────────────────────────────────────
    y += 16;
    if (y + 50 < pageHeight - 60) {
      doc.rect(margin, y, contentWidth, 42).fill("#fff8e1");
      doc.rect(margin, y, contentWidth, 42).lineWidth(1).strokeColor("#ffc107").stroke();
      doc.fillColor("#856404").font("Helvetica-Bold").fontSize(9)
        .text("NOTICE:", margin + 10, y + 8, { continued: true })
        .font("Helvetica")
        .text(`  This is an official payment order approved by ${COMPANY_NAME} management. Please process within 2 business days.`, {
          width: contentWidth - 20,
        });
    }

    // ── Footer ────────────────────────────────────────────────────────────────
    doc.rect(0, pageHeight - 45, pageWidth, 45).fill(BRAND_COLOR);
    doc.fillColor("rgba(255,255,255,0.8)").font("Helvetica").fontSize(9)
      .text(
        `${COMPANY_NAME}  |  Confidential Payment Order  |  System-generated & Officially Approved`,
        margin,
        pageHeight - 28,
        { width: contentWidth, align: "center" }
      );

    doc.end();
  });
}

export async function generateMonthlyReportPDF(data: MonthlyReportData): Promise<Buffer> {
  const logoBuffer = await fetchLogoBuffer();
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 50,
      info: {
        Title: `Payment Requests Report — ${data.month} ${data.year}`,
        Author: COMPANY_NAME,
        Subject: "Monthly Payment Report",
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const margin = 50;
    const contentWidth = pageWidth - margin * 2;

    // ── Header ────────────────────────────────────────────────────────────────
    doc.rect(0, 0, pageWidth, 120).fill(BRAND_COLOR);

    if (logoBuffer) {
      doc.rect(margin, 15, 160, 90).fill("white").opacity(0.95);
      doc.opacity(1);
      doc.image(logoBuffer, margin + 5, 20, { width: 150, height: 80, fit: [150, 80] });
    } else {
      doc.fillColor("white").font("Helvetica-Bold").fontSize(18)
        .text("COMO", margin, 28, { width: contentWidth / 2 });
      doc.fillColor("rgba(255,255,255,0.8)").font("Helvetica").fontSize(9)
        .text("REAL ESTATE DEVELOPMENT L.L.C", margin, 50, { width: contentWidth / 2 });
    }

    doc.fillColor("white").font("Helvetica-Bold").fontSize(18)
      .text("MONTHLY PAYMENT REPORT", margin + contentWidth / 2, 28, {
        width: contentWidth / 2, align: "right",
      });
    doc.fillColor("rgba(255,255,255,0.75)").font("Helvetica").fontSize(12)
      .text(`${data.month} ${data.year}`, margin + contentWidth / 2, 56, {
        width: contentWidth / 2, align: "right",
      });
    doc.fillColor("rgba(255,255,255,0.6)").font("Helvetica").fontSize(9)
      .text(`Generated: ${new Date().toLocaleDateString("en-GB")}`, margin + contentWidth / 2, 78, {
        width: contentWidth / 2, align: "right",
      });

    // ── Summary Cards ─────────────────────────────────────────────────────────
    let y = 135;
    const cardW = (contentWidth - 20) / 3;

    const drawSummaryCard = (label: string, amount: number, color: string, xPos: number) => {
      doc.rect(xPos, y, cardW, 52).fill(color);
      doc.fillColor("white").font("Helvetica-Bold").fontSize(9)
        .text(label.toUpperCase(), xPos + 8, y + 8, { width: cardW - 16 });
      doc.fillColor("white").font("Helvetica-Bold").fontSize(15)
        .text(`${amount.toLocaleString("en-US", { minimumFractionDigits: 2 })} ${data.currency}`, xPos + 8, y + 24, { width: cardW - 16 });
    };

    drawSummaryCard("Approved", data.totalApproved, "#16a34a", margin);
    drawSummaryCard("Pending", data.totalPending, "#d97706", margin + cardW + 10);
    drawSummaryCard("Rejected", data.totalRejected, "#dc2626", margin + (cardW + 10) * 2);

    // Grand total
    y += 62;
    doc.rect(margin, y, contentWidth, 30).fill("#1a3c5e");
    doc.fillColor("white").font("Helvetica-Bold").fontSize(11)
      .text("TOTAL REQUESTS VALUE:", margin + 10, y + 8, { continued: true })
      .text(`  ${data.grandTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })} ${data.currency}`, { align: "right", width: contentWidth - 20 });

    // ── Table ─────────────────────────────────────────────────────────────────
    y += 40;
    // Table header
    const cols = [
      { label: "Order #", w: 80 },
      { label: "Partner", w: 120 },
      { label: "Project", w: 100 },
      { label: "Amount", w: 90 },
      { label: "Status", w: 70 },
      { label: "Date", w: 55 },
    ];

    doc.rect(margin, y, contentWidth, 22).fill("#334155");
    let xCursor = margin;
    cols.forEach((col) => {
      doc.fillColor("white").font("Helvetica-Bold").fontSize(8.5)
        .text(col.label, xCursor + 4, y + 6, { width: col.w - 8 });
      xCursor += col.w;
    });
    y += 22;

    // Table rows
    const statusColors: Record<string, string> = {
      approved: "#16a34a",
      pending_wael: "#d97706",
      pending_sheikh: "#d97706",
      rejected: "#dc2626",
      needs_revision: "#7c3aed",
    };

    data.requests.forEach((req, idx) => {
      if (y > pageHeight - 80) {
        doc.addPage();
        y = 50;
      }
      const rowH = 20;
      doc.rect(margin, y, contentWidth, rowH).fill(idx % 2 === 0 ? "#f8fafc" : "#ffffff");
      doc.rect(margin, y, contentWidth, rowH).lineWidth(0.3).strokeColor("#e2e8f0").stroke();

      xCursor = margin;
      const rowData = [
        req.requestNumber,
        req.partnerName,
        req.projectName || "—",
        `${Number(req.amount).toLocaleString("en-US", { minimumFractionDigits: 0 })} ${req.currency}`,
        req.status.replace(/_/g, " ").toUpperCase(),
        new Date(req.createdAt).toLocaleDateString("en-GB"),
      ];

      rowData.forEach((val, i) => {
        const isStatus = i === 4;
        const statusColor = isStatus ? (statusColors[req.status] || "#555") : "#1a1a1a";
        doc.fillColor(statusColor)
          .font(isStatus ? "Helvetica-Bold" : "Helvetica")
          .fontSize(8)
          .text(val, xCursor + 4, y + 5, { width: cols[i].w - 8 });
        xCursor += cols[i].w;
      });
      y += rowH;
    });

    if (data.requests.length === 0) {
      doc.rect(margin, y, contentWidth, 40).fill("#f8fafc");
      doc.fillColor("#94a3b8").font("Helvetica").fontSize(11)
        .text("No payment requests found for this period.", margin, y + 13, {
          width: contentWidth, align: "center",
        });
      y += 40;
    }

    // ── Footer ────────────────────────────────────────────────────────────────
    doc.rect(0, pageHeight - 45, pageWidth, 45).fill(BRAND_COLOR);
    doc.fillColor("rgba(255,255,255,0.8)").font("Helvetica").fontSize(9)
      .text(
        `${COMPANY_NAME}  |  Monthly Payment Report — ${data.month} ${data.year}  |  Confidential`,
        margin,
        pageHeight - 28,
        { width: contentWidth, align: "center" }
      );

    doc.end();
  });
}
