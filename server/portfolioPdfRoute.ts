import express from "express";
import puppeteer from "puppeteer-core";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { effectiveColumns, rawProjects } = req.body;

    if (!effectiveColumns || !Array.isArray(effectiveColumns)) {
      res.status(400).json({ error: "Invalid data" });
      return;
    }

    // Build HTML with proper Arabic font
    const html = generatePortfolioHTML(effectiveColumns, rawProjects);

    // Launch puppeteer with existing chromium
    const browser = await puppeteer.launch({
      executablePath: "/usr/bin/chromium-browser",
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdfData = await page.pdf({
      format: "A3",
      landscape: true,
      printBackground: true,
      margin: { top: "10mm", right: "10mm", bottom: "10mm", left: "10mm" },
    });

    await browser.close();

    const pdfBuffer = Buffer.isBuffer(pdfData) ? pdfData : Buffer.from(pdfData);
    const now = new Date();
    const dateStr = `${now.getDate()}-${now.getMonth() + 1}-${now.getFullYear()}`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="Capital-Portfolio-${dateStr}.pdf"`);
    res.end(pdfBuffer);
  } catch (error) {
    console.error("[PortfolioPDF] Error:", error);
    res.status(500).json({ error: "Failed to generate PDF" });
  }
});

function generatePortfolioHTML(effectiveColumns: any[], rawProjects: any[]): string {
  const grandTotalAll = effectiveColumns.reduce((s, c) => s + c.investorTotal, 0);
  const paidAll = effectiveColumns.reduce((s, c) => s + c.paidTotal, 0);
  const upcomingAll = effectiveColumns.reduce((s, c) => s + c.upcomingTotal, 0);

  const fmt = (n: number) => (n === 0 ? "—" : Math.round(n).toLocaleString("ar-AE"));

  // Group months into quarters
  const quarters: { label: string; indices: number[] }[] = [];
  for (let q = 0; q < 16; q++) {
    const qStart = q * 3;
    const indices = [qStart, qStart + 1, qStart + 2].filter(i => i < 48);
    const hasData = effectiveColumns.some((c: any) =>
      indices.some(idx => (c.chartAmounts[idx] || 0) > 0)
    );
    if (hasData) {
      const d = new Date(2026, 3 + qStart, 1);
      const year = d.getFullYear();
      const label = `الربع ${q + 1} - ${year}`;
      quarters.push({ label, indices });
    }
  }

  const optionLabel: Record<string, string> = { o1: "الخيار 1", o2: "الخيار 2", o3: "الخيار 3" };

  // Build table rows
  let tableRows = "";
  effectiveColumns.forEach((col: any) => {
    const quarterCells = quarters
      .map(({ indices }) => {
        const total = indices.reduce((s, idx) => s + (col.chartAmounts[idx] || 0), 0);
        return `<td style="text-align: center; padding: 8px; border: 1px solid #cbd5e1; font-size: 11px;">${fmt(total)}</td>`;
      })
      .join("");

    tableRows += `
      <tr>
        <td style="text-align: right; padding: 8px; border: 1px solid #cbd5e1; font-weight: 600; font-size: 11px;">${col.name}</td>
        <td style="text-align: center; padding: 8px; border: 1px solid #cbd5e1; font-size: 11px;">${optionLabel[col.option] || col.option}</td>
        <td style="text-align: center; padding: 8px; border: 1px solid #cbd5e1; font-size: 11px;">${fmt(col.grandTotal)}</td>
        <td style="text-align: center; padding: 8px; border: 1px solid #cbd5e1; font-size: 11px;">${fmt(col.investorTotal)}</td>
        <td style="text-align: center; padding: 8px; border: 1px solid #cbd5e1; font-size: 11px;">${fmt(col.paidTotal)}</td>
        <td style="text-align: center; padding: 8px; border: 1px solid #cbd5e1; font-size: 11px;">${fmt(col.upcomingTotal)}</td>
        ${quarterCells}
        <td style="text-align: center; padding: 8px; border: 1px solid #cbd5e1; font-weight: 700; font-size: 11px;">${fmt(col.investorTotal)}</td>
      </tr>
    `;
  });

  // Total row
  const quarterTotals = quarters
    .map(({ indices }) => {
      const total = effectiveColumns.reduce(
        (s, c) => s + indices.reduce((sum, idx) => sum + (c.chartAmounts[idx] || 0), 0),
        0
      );
      return `<td style="text-align: center; padding: 8px; border: 1px solid #cbd5e1; background: #1e293b; color: #fff; font-weight: 700; font-size: 11px;">${fmt(total)}</td>`;
    })
    .join("");

  const totalRow = `
    <tr style="background: #1e293b; color: #fff;">
      <td style="text-align: right; padding: 8px; border: 1px solid #334155; font-weight: 700; font-size: 12px;">الإجمالي</td>
      <td style="text-align: center; padding: 8px; border: 1px solid #334155;"></td>
      <td style="text-align: center; padding: 8px; border: 1px solid #334155; font-weight: 700; font-size: 11px;">${fmt(effectiveColumns.reduce((s, c) => s + c.grandTotal, 0))}</td>
      <td style="text-align: center; padding: 8px; border: 1px solid #334155; font-weight: 700; font-size: 11px;">${fmt(grandTotalAll)}</td>
      <td style="text-align: center; padding: 8px; border: 1px solid #334155; font-weight: 700; font-size: 11px;">${fmt(paidAll)}</td>
      <td style="text-align: center; padding: 8px; border: 1px solid #334155; font-weight: 700; font-size: 11px;">${fmt(upcomingAll)}</td>
      ${quarterTotals}
      <td style="text-align: center; padding: 8px; border: 1px solid #334155; font-weight: 700; font-size: 11px;">${fmt(grandTotalAll)}</td>
    </tr>
  `;

  const quarterHeaders = quarters.map(q => `<th style="padding: 10px; border: 1px solid #334155; font-size: 11px;">${q.label}</th>`).join("");

  const now = new Date();
  const dateStr = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;

  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Cairo', sans-serif;
      background: #fff;
      padding: 20px;
      direction: rtl;
    }
    .header {
      background: #0f172a;
      color: #fff;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
    }
    .header h1 {
      font-size: 22px;
      font-weight: 800;
      margin-bottom: 8px;
    }
    .header .subtitle {
      font-size: 12px;
      color: #94a3b8;
    }
    .header .date {
      font-size: 11px;
      color: #cbd5e1;
      margin-top: 8px;
    }
    .cards {
      display: flex;
      gap: 15px;
      margin-bottom: 20px;
    }
    .card {
      flex: 1;
      background: #f8fafc;
      border-right: 4px solid #0f172a;
      padding: 15px;
      border-radius: 6px;
    }
    .card .label {
      font-size: 10px;
      color: #64748b;
      margin-bottom: 6px;
    }
    .card .value {
      font-size: 16px;
      font-weight: 800;
      color: #0f172a;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    th {
      background: #0f172a;
      color: #fff;
      padding: 12px;
      text-align: center;
      border: 1px solid #334155;
      font-weight: 700;
      font-size: 11px;
    }
    .legend {
      display: flex;
      gap: 20px;
      margin-top: 15px;
      font-size: 10px;
      color: #64748b;
    }
    .legend-item {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .legend-color {
      width: 16px;
      height: 16px;
      border-radius: 3px;
    }
    .footer {
      text-align: center;
      font-size: 9px;
      color: #94a3b8;
      margin-top: 20px;
      padding-top: 15px;
      border-top: 1px solid #e2e8f0;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>تقرير محفظة رأس المال</h1>
    <div class="subtitle">Como Developments - محفظة رأس المال الديناميكية</div>
    <div class="date">تاريخ التصدير: ${dateStr}</div>
  </div>

  <div class="cards">
    <div class="card">
      <div class="label">عدد المشاريع</div>
      <div class="value">${effectiveColumns.length}</div>
    </div>
    <div class="card">
      <div class="label">الإجمالي الكلي (درهم)</div>
      <div class="value">${fmt(grandTotalAll)}</div>
    </div>
    <div class="card">
      <div class="label">المدفوع (درهم)</div>
      <div class="value">${fmt(paidAll)}</div>
    </div>
    <div class="card">
      <div class="label">المتبقي (درهم)</div>
      <div class="value">${fmt(upcomingAll)}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="min-width: 180px;">المشروع</th>
        <th>الخيار</th>
        <th>التكلفة الكلية</th>
        <th>رأس المال</th>
        <th>المدفوع</th>
        <th>المتبقي</th>
        ${quarterHeaders}
        <th>الإجمالي</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows}
      ${totalRow}
    </tbody>
  </table>

  <div class="legend">
    <div class="legend-item">
      <div class="legend-color" style="background: #fb923c;"></div>
      <span>التصاميم</span>
    </div>
    <div class="legend-item">
      <div class="legend-color" style="background: #db2777;"></div>
      <span>التسجيل</span>
    </div>
    <div class="legend-item">
      <div class="legend-color" style="background: #7c3aed;"></div>
      <span>الإنشاء</span>
    </div>
    <div class="legend-item">
      <div class="legend-color" style="background: #64748b;"></div>
      <span>التسليم</span>
    </div>
  </div>

  <div class="footer">
    Como Developments · سري · للاستخدام الداخلي فقط
  </div>
</body>
</html>
  `;
}

export default router;
