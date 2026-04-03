import PDFDocument from "pdfkit";

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
  approvalDate: string;
  submittedByName?: string | null;
  waelNotes?: string | null;
  sheikhNotes?: string | null;
}

export async function generatePaymentOrderPDF(data: PaymentOrderData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 50,
      info: {
        Title: `Payment Order - ${data.requestNumber}`,
        Author: "Como Developments",
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
    doc.rect(0, 0, pageWidth, 110).fill("#1a3c5e");

    // Company name (left side)
    doc.fillColor("white")
      .font("Helvetica-Bold")
      .fontSize(22)
      .text("COMO DEVELOPMENTS", margin, 28, { width: contentWidth / 2 });

    doc.fillColor("rgba(255,255,255,0.7)")
      .font("Helvetica")
      .fontSize(11)
      .text("Real Estate Development", margin, 56, { width: contentWidth / 2 });

    // "PAYMENT ORDER" title (right side)
    doc.fillColor("white")
      .font("Helvetica-Bold")
      .fontSize(20)
      .text("PAYMENT ORDER", margin + contentWidth / 2, 28, {
        width: contentWidth / 2,
        align: "right",
      });

    doc.fillColor("rgba(255,255,255,0.7)")
      .font("Helvetica")
      .fontSize(11)
      .text(`Order No: ${data.requestNumber}`, margin + contentWidth / 2, 56, {
        width: contentWidth / 2,
        align: "right",
      });

    // ── Approval stamp (diagonal) ──────────────────────────────────────────────
    doc.save();
    doc.translate(pageWidth - 110, 130);
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
      .text(`Date: ${data.approvalDate}`, margin, 125, { align: "right", width: contentWidth });

    // ── Section: Payment Details ───────────────────────────────────────────────
    let y = 155;

    const drawSectionHeader = (title: string, yPos: number) => {
      doc.rect(margin, yPos, contentWidth, 24).fill("#1a3c5e");
      doc.fillColor("white")
        .font("Helvetica-Bold")
        .fontSize(11)
        .text(title, margin + 10, yPos + 6, { width: contentWidth - 20 });
      return yPos + 24;
    };

    const drawRow = (label: string, value: string, yPos: number, highlight = false) => {
      const rowH = 22;
      if (highlight) {
        doc.rect(margin, yPos, contentWidth, rowH).fill("#f0f7ff");
      } else {
        doc.rect(margin, yPos, contentWidth, rowH).fill("#fafafa");
      }
      doc.rect(margin, yPos, contentWidth, rowH).lineWidth(0.5).strokeColor("#e0e0e0").stroke();

      const colW = contentWidth * 0.38;
      doc.fillColor("#555")
        .font("Helvetica-Bold")
        .fontSize(9.5)
        .text(label, margin + 8, yPos + 6, { width: colW });

      doc.fillColor("#1a1a1a")
        .font("Helvetica")
        .fontSize(9.5)
        .text(value || "—", margin + colW + 8, yPos + 6, { width: contentWidth - colW - 16 });

      return yPos + rowH;
    };

    // Payment Details section
    y = drawSectionHeader("PAYMENT DETAILS", y);
    y = drawRow("Order Number", data.requestNumber, y, true);
    y = drawRow("Project", data.projectName || "—", y);
    y = drawRow("Description", data.description, y, true);

    // Amount row (larger)
    doc.rect(margin, y, contentWidth, 32).fill("#e8f5e9");
    doc.rect(margin, y, contentWidth, 32).lineWidth(0.5).strokeColor("#a5d6a7").stroke();
    const colW = contentWidth * 0.38;
    doc.fillColor("#2e7d32")
      .font("Helvetica-Bold")
      .fontSize(10)
      .text("AMOUNT", margin + 8, y + 10, { width: colW });
    const amountStr = `${Number(data.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })} ${data.currency}`;
    doc.fillColor("#1b5e20")
      .font("Helvetica-Bold")
      .fontSize(16)
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

    // ── Notice box ────────────────────────────────────────────────────────────
    y += 16;
    doc.rect(margin, y, contentWidth, 40).fill("#fff8e1");
    doc.rect(margin, y, contentWidth, 40).lineWidth(1).strokeColor("#ffc107").stroke();
    doc.fillColor("#856404")
      .font("Helvetica-Bold")
      .fontSize(9)
      .text("NOTICE:", margin + 10, y + 8, { continued: true })
      .font("Helvetica")
      .text("  This is an official payment order approved by Como Developments management. Please process within 2 business days.", {
        width: contentWidth - 20,
      });

    // ── Footer ────────────────────────────────────────────────────────────────
    doc.rect(0, pageHeight - 45, pageWidth, 45).fill("#1a3c5e");
    doc.fillColor("rgba(255,255,255,0.8)")
      .font("Helvetica")
      .fontSize(9)
      .text(
        "Como Developments  |  Confidential Payment Order  |  This document is system-generated and officially approved",
        margin,
        pageHeight - 28,
        { width: contentWidth, align: "center" }
      );

    doc.end();
  });
}
