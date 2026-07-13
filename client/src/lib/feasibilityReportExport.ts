/**
 * Feasibility Summary Report — Professional HTML/PDF Export
 * Opens a new window with a print-ready report.
 * User can print to PDF or save as HTML.
 */

export interface FeasibilityReportData {
  projectName: string;
  community?: string;
  plotNumber?: string;
  // Project info card
  permittedUse?: string;
  masterDevName?: string;
  ownershipType?: string;
  titleDeedNumber?: string;
  areaCode?: string;
  landPrice?: number;
  constructionPricePerSqft?: number;
  preConMonths?: number;
  constructionMonths?: number;
  handoverMonths?: number;
  developerFeePct?: number;
  salesCommissionPct?: number;
  marketingPct?: number;
  designFeePct?: number;
  financingScenario?: string;
  // Areas
  plotAreaSqft: number;
  plotAreaSqm: number;
  buaSqft: number;
  gfaTotalSqft: number;
  gfaResSqft: number;
  gfaRetSqft: number;
  gfaOffSqft: number;
  sellableRes: number;
  sellableRet: number;
  sellableOff: number;
  totalSellable: number;
  resPct: number;
  retPct: number;
  offPct: number;
  // Financials
  totalRevenue: number;
  revenueRes: number;
  revenueRet: number;
  revenueOff: number;
  totalCosts: number;
  investedCapital: number;
  profit: number;
  margin: number;
  profitOnCost: number;
  roiOnCapital: number;
  comoFee: number;
  investorProfit: number;
  investorROI: number;
  // Capital breakdown
  paidCapital: number;
  unpaidInvestor: number;
  // Scenarios
  scenarios: {
    optimistic: { revenue: number; profit: number; margin: number };
    base: { revenue: number; profit: number; margin: number };
    conservative: { revenue: number; profit: number; margin: number };
  };
}

function fmt(n: number): string {
  if (!n || isNaN(n)) return "—";
  return Math.round(n).toLocaleString("en-US");
}

function fmtPct(n: number): string {
  if (!n || isNaN(n)) return "—";
  return n.toFixed(1) + "%";
}

export function exportFeasibilityReport(data: FeasibilityReportData): void {
  const now = new Date();
  const dateStr = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;
  const totalDuration = (data.preConMonths || 0) + (data.constructionMonths || 0) + (data.handoverMonths || 0);

  // Build project info rows
  const infoRows: string[] = [];
  if (data.permittedUse) infoRows.push(`<td class="info-label">الاستخدام المسموح</td><td class="info-val">${data.permittedUse}</td>`);
  if (data.masterDevName) infoRows.push(`<td class="info-label">المطور الرئيسي</td><td class="info-val">${data.masterDevName}</td>`);
  if (data.ownershipType) infoRows.push(`<td class="info-label">نوع الملكية</td><td class="info-val">${data.ownershipType}</td>`);
  if (data.titleDeedNumber) infoRows.push(`<td class="info-label">سند الملكية</td><td class="info-val">${data.titleDeedNumber}</td>`);
  if (data.areaCode) infoRows.push(`<td class="info-label">المنطقة</td><td class="info-val">${data.areaCode}</td>`);
  if (data.landPrice && data.landPrice > 0) infoRows.push(`<td class="info-label">سعر الأرض</td><td class="info-val">${fmt(data.landPrice)} AED</td>`);
  if (data.constructionPricePerSqft && data.constructionPricePerSqft > 0) infoRows.push(`<td class="info-label">تكلفة البناء / قدم²</td><td class="info-val">${fmt(data.constructionPricePerSqft)} AED</td>`);
  if (totalDuration > 0) infoRows.push(`<td class="info-label">المدة الزمنية</td><td class="info-val">${data.preConMonths || 0} + ${data.constructionMonths || 0} + ${data.handoverMonths || 0} = ${totalDuration} شهر</td>`);
  if (data.developerFeePct) infoRows.push(`<td class="info-label">أتعاب المطور</td><td class="info-val">${data.developerFeePct}%</td>`);
  if (data.salesCommissionPct) infoRows.push(`<td class="info-label">عمولة المبيعات</td><td class="info-val">${data.salesCommissionPct}%</td>`);
  if (data.marketingPct) infoRows.push(`<td class="info-label">التسويق</td><td class="info-val">${data.marketingPct}%</td>`);
  if (data.designFeePct) infoRows.push(`<td class="info-label">رسوم التصميم</td><td class="info-val">${data.designFeePct}%</td>`);
  if (data.financingScenario) {
    const scenarioLabel = data.financingScenario === 'offplan_escrow' ? 'أوف بلان + ضمان' : data.financingScenario === 'construction_loan' ? 'قرض بناء' : data.financingScenario;
    infoRows.push(`<td class="info-label">سيناريو التمويل</td><td class="info-val">${scenarioLabel}</td>`);
  }

  // Build info table (3 columns of key-value pairs)
  let infoTableRows = "";
  for (let i = 0; i < infoRows.length; i += 3) {
    infoTableRows += `<tr>${infoRows[i] || '<td></td><td></td>'}${infoRows[i + 1] || '<td></td><td></td>'}${infoRows[i + 2] || '<td></td><td></td>'}</tr>`;
  }

  // Area breakdown rows
  const areaRows: string[] = [];
  if (data.gfaResSqft > 0) areaRows.push(`<tr><td class="area-cat"><span class="dot" style="background:#0ea5e9"></span>سكني</td><td class="area-num">${fmt(data.gfaResSqft)}</td><td class="area-num">${Math.round(data.resPct * 100)}%</td><td class="area-num">${fmt(data.sellableRes)}</td></tr>`);
  if (data.gfaRetSqft > 0) areaRows.push(`<tr><td class="area-cat"><span class="dot" style="background:#f97316"></span>تجزئة</td><td class="area-num">${fmt(data.gfaRetSqft)}</td><td class="area-num">${Math.round(data.retPct * 100)}%</td><td class="area-num">${fmt(data.sellableRet)}</td></tr>`);
  if (data.gfaOffSqft > 0) areaRows.push(`<tr><td class="area-cat"><span class="dot" style="background:#8b5cf6"></span>مكاتب</td><td class="area-num">${fmt(data.gfaOffSqft)}</td><td class="area-num">${Math.round(data.offPct * 100)}%</td><td class="area-num">${fmt(data.sellableOff)}</td></tr>`);

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<title>ملخص الجدوى المالية — ${data.projectName}</title>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
<style>
  @page { size: A4 portrait; margin: 15mm; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Cairo',sans-serif; direction:rtl; padding:24px; font-size:11px; background:#f8fafc; color:#1e293b; line-height:1.6; }
  
  .header { background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%); color:#fff; padding:24px 28px; border-radius:12px; margin-bottom:20px; display:flex; justify-content:space-between; align-items:center; }
  .header h1 { font-size:20px; font-weight:900; margin-bottom:4px; }
  .header .sub { font-size:10px; color:#94a3b8; }
  .header .logo { font-size:28px; font-weight:900; background: linear-gradient(135deg, #a78bfa, #7c3aed); -webkit-background-clip:text; -webkit-text-fill-color:transparent; letter-spacing:-1px; }
  
  .section { background:#fff; border-radius:10px; padding:16px 20px; margin-bottom:14px; box-shadow:0 1px 4px rgba(0,0,0,0.06); border:1px solid #e2e8f0; }
  .section-title { font-size:12px; font-weight:800; color:#0f172a; margin-bottom:10px; padding-bottom:6px; border-bottom:2px solid #e2e8f0; display:flex; align-items:center; gap:8px; }
  .section-title .icon { width:24px; height:24px; border-radius:6px; display:flex; align-items:center; justify-content:center; font-size:12px; color:#fff; }
  
  .cards { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-bottom:14px; }
  .card { background:#fff; border-radius:8px; padding:12px 14px; border:1px solid #e2e8f0; box-shadow:0 1px 3px rgba(0,0,0,0.04); }
  .card-label { font-size:9px; color:#64748b; font-weight:600; margin-bottom:4px; }
  .card-value { font-size:18px; font-weight:900; color:#0f172a; font-feature-settings:"tnum"; }
  .card-sub { font-size:8px; color:#94a3b8; margin-top:2px; }
  .card-accent { border-right:4px solid; }
  
  .info-table { width:100%; border-collapse:collapse; }
  .info-table td { padding:5px 8px; font-size:10px; border-bottom:1px solid #f1f5f9; }
  .info-label { color:#64748b; font-weight:600; width:15%; }
  .info-val { color:#0f172a; font-weight:700; width:18%; }
  
  .area-table { width:100%; border-collapse:collapse; }
  .area-table th { font-size:9px; color:#64748b; font-weight:700; padding:6px 8px; border-bottom:2px solid #e2e8f0; text-align:center; }
  .area-table th:first-child { text-align:right; }
  .area-cat { padding:5px 8px; font-size:10px; font-weight:600; display:flex; align-items:center; gap:6px; }
  .area-num { padding:5px 8px; font-size:10px; font-weight:700; text-align:center; font-feature-settings:"tnum"; }
  .dot { width:8px; height:8px; border-radius:50%; display:inline-block; }
  
  .scenario-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; }
  .scenario-card { border-radius:8px; padding:12px; text-align:center; border:1px solid #e2e8f0; }
  .scenario-label { font-size:10px; font-weight:700; margin-bottom:8px; }
  .scenario-val { font-size:12px; font-weight:800; margin-bottom:2px; }
  .scenario-sub { font-size:9px; color:#64748b; }
  
  .profit-bar { height:8px; border-radius:4px; background:#e2e8f0; overflow:hidden; margin-top:8px; }
  .profit-fill { height:100%; border-radius:4px; }
  
  .footer { text-align:center; font-size:9px; color:#94a3b8; margin-top:20px; padding-top:12px; border-top:1px solid #e2e8f0; }
  
  .action-btns { position:fixed; top:20px; left:20px; display:flex; gap:10px; z-index:9999; }
  .action-btn { background:#0f172a; color:#fff; padding:10px 18px; border:none; border-radius:8px; font-size:12px; font-weight:700; cursor:pointer; box-shadow:0 4px 12px rgba(0,0,0,0.3); transition:all 0.2s; font-family:'Cairo',sans-serif; }
  .action-btn:hover { background:#334155; transform:translateY(-1px); }
  .action-btn.secondary { background:#475569; }
  .action-btn.secondary:hover { background:#64748b; }
  
  @media print { 
    .action-btns { display:none !important; } 
    body { background:#fff; padding:10mm; font-size:10px; }
    .section { box-shadow:none; border:1px solid #e2e8f0; break-inside:avoid; }
    .header { border-radius:0; }
    .cards { break-inside:avoid; }
  }
</style>
</head>
<body>
  <div class="action-btns">
    <button class="action-btn" onclick="window.print()">🖨️ طباعة / حفظ PDF</button>
    <button class="action-btn secondary" onclick="saveAsHTML()">💾 حفظ كـ HTML</button>
  </div>

  <div class="header">
    <div>
      <h1>ملخص الجدوى المالية — ${data.projectName}</h1>
      <div class="sub">
        ${data.community ? data.community + ' · ' : ''}${data.plotNumber ? 'قطعة ' + data.plotNumber + ' · ' : ''}تاريخ التصدير: ${dateStr}
      </div>
    </div>
    <div class="logo">COMO</div>
  </div>

  <!-- Project Info -->
  <div class="section">
    <div class="section-title"><span class="icon" style="background:linear-gradient(135deg,#475569,#1e293b)">📋</span>بطاقة المشروع</div>
    <table class="info-table">
      ${infoTableRows}
    </table>
  </div>

  <!-- Key Financials -->
  <div class="cards">
    <div class="card card-accent" style="border-right-color:#10b981">
      <div class="card-label">إجمالي الإيرادات</div>
      <div class="card-value" style="color:#059669">${fmt(data.totalRevenue)}</div>
      <div class="card-sub">درهم إماراتي</div>
    </div>
    <div class="card card-accent" style="border-right-color:#ef4444">
      <div class="card-label">إجمالي التكاليف</div>
      <div class="card-value" style="color:#dc2626">${fmt(data.totalCosts)}</div>
      <div class="card-sub">درهم إماراتي</div>
    </div>
    <div class="card card-accent" style="border-right-color:#7c3aed">
      <div class="card-label">رأس المال المستثمر</div>
      <div class="card-value" style="color:#6d28d9">${fmt(data.investedCapital)}</div>
      <div class="card-sub">درهم إماراتي</div>
    </div>
    <div class="card card-accent" style="border-right-color:${data.profit >= 0 ? '#10b981' : '#ef4444'}">
      <div class="card-label">صافي الربح</div>
      <div class="card-value" style="color:${data.profit >= 0 ? '#059669' : '#dc2626'}">${fmt(data.profit)}</div>
      <div class="card-sub">هامش ${fmtPct(data.margin)}</div>
    </div>
  </div>

  <!-- Profit & Ratios -->
  <div class="section">
    <div class="section-title"><span class="icon" style="background:linear-gradient(135deg,#10b981,#059669)">📊</span>مؤشرات الربحية</div>
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px">
      <div style="text-align:center">
        <div style="font-size:9px;color:#64748b">هامش الربح</div>
        <div style="font-size:16px;font-weight:900;color:${data.margin >= 0 ? '#059669' : '#dc2626'}">${fmtPct(data.margin)}</div>
      </div>
      <div style="text-align:center">
        <div style="font-size:9px;color:#64748b">الربح على التكلفة</div>
        <div style="font-size:16px;font-weight:900;color:#0f172a">${fmtPct(data.profitOnCost)}</div>
      </div>
      <div style="text-align:center">
        <div style="font-size:9px;color:#64748b">العائد على رأس المال</div>
        <div style="font-size:16px;font-weight:900;color:#7c3aed">${fmtPct(data.roiOnCapital)}</div>
      </div>
      <div style="text-align:center">
        <div style="font-size:9px;color:#64748b">رسوم كومو (15%)</div>
        <div style="font-size:16px;font-weight:900;color:#0ea5e9">${fmt(data.comoFee)}</div>
      </div>
      <div style="text-align:center">
        <div style="font-size:9px;color:#64748b">ربح المستثمر</div>
        <div style="font-size:16px;font-weight:900;color:#059669">${fmt(data.investorProfit)}</div>
        <div style="font-size:8px;color:#94a3b8">ROI ${fmtPct(data.investorROI)}</div>
      </div>
    </div>
  </div>

  <!-- Revenue Breakdown -->
  <div class="section">
    <div class="section-title"><span class="icon" style="background:linear-gradient(135deg,#10b981,#059669)">💰</span>توزيع الإيرادات</div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">
      ${data.revenueRes > 0 ? `<div style="text-align:center;padding:8px;background:#f0fdf4;border-radius:6px"><div style="font-size:9px;color:#64748b">سكني</div><div style="font-size:14px;font-weight:800;color:#059669">${fmt(data.revenueRes)}</div><div style="font-size:8px;color:#94a3b8">${data.totalRevenue > 0 ? Math.round((data.revenueRes / data.totalRevenue) * 100) : 0}%</div></div>` : ''}
      ${data.revenueRet > 0 ? `<div style="text-align:center;padding:8px;background:#fff7ed;border-radius:6px"><div style="font-size:9px;color:#64748b">تجزئة</div><div style="font-size:14px;font-weight:800;color:#ea580c">${fmt(data.revenueRet)}</div><div style="font-size:8px;color:#94a3b8">${data.totalRevenue > 0 ? Math.round((data.revenueRet / data.totalRevenue) * 100) : 0}%</div></div>` : ''}
      ${data.revenueOff > 0 ? `<div style="text-align:center;padding:8px;background:#f5f3ff;border-radius:6px"><div style="font-size:9px;color:#64748b">مكاتب</div><div style="font-size:14px;font-weight:800;color:#7c3aed">${fmt(data.revenueOff)}</div><div style="font-size:8px;color:#94a3b8">${data.totalRevenue > 0 ? Math.round((data.revenueOff / data.totalRevenue) * 100) : 0}%</div></div>` : ''}
    </div>
  </div>

  <!-- Areas -->
  <div class="section">
    <div class="section-title"><span class="icon" style="background:linear-gradient(135deg,#0ea5e9,#0284c7)">📐</span>بيانات المساحات</div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:12px">
      <div style="text-align:center;padding:8px;background:#f0f9ff;border-radius:6px">
        <div style="font-size:9px;color:#64748b">مساحة الأرض</div>
        <div style="font-size:14px;font-weight:800">${fmt(data.plotAreaSqft)} sqft</div>
        <div style="font-size:8px;color:#94a3b8">${fmt(data.plotAreaSqm)} م²</div>
      </div>
      <div style="text-align:center;padding:8px;background:#fffbeb;border-radius:6px">
        <div style="font-size:9px;color:#64748b">BUA</div>
        <div style="font-size:14px;font-weight:800">${fmt(data.buaSqft)} sqft</div>
      </div>
      <div style="text-align:center;padding:8px;background:#f0fdf4;border-radius:6px">
        <div style="font-size:9px;color:#64748b">GFA</div>
        <div style="font-size:14px;font-weight:800">${fmt(data.gfaTotalSqft)} sqft</div>
      </div>
      <div style="text-align:center;padding:8px;background:#f5f3ff;border-radius:6px">
        <div style="font-size:9px;color:#64748b">قابل للبيع</div>
        <div style="font-size:14px;font-weight:800">${fmt(data.totalSellable)} sqft</div>
      </div>
    </div>
    ${areaRows.length > 0 ? `
    <table class="area-table">
      <thead><tr><th style="text-align:right">الفئة</th><th>GFA (sqft)</th><th>كفاءة</th><th>قابل للبيع (sqft)</th></tr></thead>
      <tbody>
        ${areaRows.join('')}
        <tr style="border-top:2px solid #0f172a;font-weight:800">
          <td style="padding:6px 8px">الإجمالي</td>
          <td class="area-num">${fmt(data.gfaTotalSqft)}</td>
          <td class="area-num">—</td>
          <td class="area-num">${fmt(data.totalSellable)}</td>
        </tr>
      </tbody>
    </table>` : ''}
  </div>

  <!-- Capital Breakdown -->
  <div class="section">
    <div class="section-title"><span class="icon" style="background:linear-gradient(135deg,#7c3aed,#6d28d9)">🏦</span>هيكل رأس المال</div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">
      <div style="text-align:center;padding:10px;background:#faf5ff;border-radius:6px;border:1px solid #e9d5ff">
        <div style="font-size:9px;color:#64748b">إجمالي رأس المال</div>
        <div style="font-size:16px;font-weight:900;color:#6d28d9">${fmt(data.investedCapital)}</div>
      </div>
      <div style="text-align:center;padding:10px;background:#fef2f2;border-radius:6px;border:1px solid #fecaca">
        <div style="font-size:9px;color:#64748b">مدفوع مسبقاً</div>
        <div style="font-size:16px;font-weight:900;color:#dc2626">${fmt(data.paidCapital)}</div>
      </div>
      <div style="text-align:center;padding:10px;background:#eff6ff;border-radius:6px;border:1px solid #bfdbfe">
        <div style="font-size:9px;color:#64748b">مطلوب ضخه</div>
        <div style="font-size:16px;font-weight:900;color:#2563eb">${fmt(data.unpaidInvestor)}</div>
      </div>
    </div>
  </div>

  <!-- Scenarios -->
  <div class="section">
    <div class="section-title"><span class="icon" style="background:linear-gradient(135deg,#a855f7,#7c3aed)">⚖️</span>مقارنة السيناريوهات</div>
    <div class="scenario-grid">
      <div class="scenario-card" style="background:#fffbeb;border-color:#fde68a">
        <div class="scenario-label" style="color:#d97706">متحفظ -10%</div>
        <div class="scenario-val">${fmt(data.scenarios.conservative.revenue)}</div>
        <div class="scenario-sub">إيرادات</div>
        <div class="scenario-val" style="color:${data.scenarios.conservative.profit >= 0 ? '#059669' : '#dc2626'};margin-top:4px">${fmt(data.scenarios.conservative.profit)}</div>
        <div class="scenario-sub">ربح · هامش ${fmtPct(data.scenarios.conservative.margin)}</div>
      </div>
      <div class="scenario-card" style="background:#eff6ff;border-color:#93c5fd">
        <div class="scenario-label" style="color:#2563eb">أساسي</div>
        <div class="scenario-val">${fmt(data.scenarios.base.revenue)}</div>
        <div class="scenario-sub">إيرادات</div>
        <div class="scenario-val" style="color:${data.scenarios.base.profit >= 0 ? '#059669' : '#dc2626'};margin-top:4px">${fmt(data.scenarios.base.profit)}</div>
        <div class="scenario-sub">ربح · هامش ${fmtPct(data.scenarios.base.margin)}</div>
      </div>
      <div class="scenario-card" style="background:#f0fdf4;border-color:#86efac">
        <div class="scenario-label" style="color:#059669">متفائل +10%</div>
        <div class="scenario-val">${fmt(data.scenarios.optimistic.revenue)}</div>
        <div class="scenario-sub">إيرادات</div>
        <div class="scenario-val" style="color:${data.scenarios.optimistic.profit >= 0 ? '#059669' : '#dc2626'};margin-top:4px">${fmt(data.scenarios.optimistic.profit)}</div>
        <div class="scenario-sub">ربح · هامش ${fmtPct(data.scenarios.optimistic.margin)}</div>
      </div>
    </div>
  </div>

  <div class="footer">
    Como Developments &middot; ملخص الجدوى المالية &middot; سري — للاستخدام الداخلي فقط &middot; ${dateStr}
  </div>

  <script>
    function saveAsHTML() {
      const html = document.documentElement.outerHTML;
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ملخص-الجدوى-${data.projectName.replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, "-")}-' + new Date().toISOString().split('T')[0] + '.html';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  </script>
</body>
</html>`;

  // Open in new window
  const printWin = window.open("", "_blank", "width=1000,height=900");
  if (!printWin) {
    alert("يرجى السماح بالنوافذ المنبثقة لتصدير التقرير");
    return;
  }
  printWin.document.open();
  printWin.document.write(html);
  printWin.document.close();
  setTimeout(() => printWin.focus(), 1500);
}
