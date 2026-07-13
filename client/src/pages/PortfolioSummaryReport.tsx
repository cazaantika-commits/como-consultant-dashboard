import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Loader2 } from "lucide-react";

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════
const CHART_START_YEAR = 2026;
const CHART_START_MONTH = 4; // April 2026
const REPORT_START_YEAR = 2026;
const REPORT_START_MONTH = 8; // August 2026 as requested
const TOTAL_MONTHS = 48;
const ARABIC_MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

type OptionKey = "o1" | "o2" | "o3";
type ScenarioKey = "offplan_escrow" | "offplan_construction" | "no_offplan";
const OPTION_TO_SCENARIO: Record<OptionKey, ScenarioKey> = {
  o1: "offplan_escrow",
  o2: "offplan_construction",
  o3: "no_offplan",
};

interface DelayState {
  designDelay: number;
  offplanDelay: number;
  constructionDelay: number;
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════
function formatAED(amount: number): string {
  if (amount === 0) return "—";
  return Math.round(amount).toLocaleString("en-US");
}

function projectMonthToChartIndex(startDate: string, relativeMonth: number): number {
  const parts = startDate.split("-").map(Number);
  const sy = parts[0];
  const sm = parts[1] || 4;
  const absYear = sy + Math.floor((sm - 1 + relativeMonth) / 12);
  const absMonth = ((sm - 1 + relativeMonth) % 12) + 1;
  return (absYear - CHART_START_YEAR) * 12 + (absMonth - CHART_START_MONTH);
}

function getMonthLabel(chartIdx: number): string {
  const totalMonth = CHART_START_MONTH - 1 + chartIdx;
  const year = CHART_START_YEAR + Math.floor(totalMonth / 12);
  const month = totalMonth % 12;
  return `${ARABIC_MONTHS[month]} ${year}`;
}

// ═══════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function PortfolioSummaryReport() {
  const portfolioQuery = trpc.cashFlowSettings.getPortfolioAllScenarios.useQuery();
  const savedSettingsQuery = trpc.portfolioScenarios.getDefault.useQuery();
  const data = portfolioQuery.data;

  // Parse saved settings (same as original CapitalPortfolioPage)
  const { projectOptions, delays } = useMemo(() => {
    let projectOptions: Record<number, OptionKey> = {};
    let delays: Record<number, DelayState> = {};
    if (savedSettingsQuery.data?.settings) {
      try {
        const parsed = JSON.parse(savedSettingsQuery.data.settings);
        if (parsed.projectOptions) projectOptions = parsed.projectOptions;
        if (parsed.delays) delays = parsed.delays;
      } catch (e) {
        console.error("Failed to parse saved settings:", e);
      }
    }
    return { projectOptions, delays };
  }, [savedSettingsQuery.data]);

  function getProjectOption(projectId: number): OptionKey {
    return projectOptions[projectId] || "o1";
  }

  function getDelay(projectId: number): DelayState {
    return delays[projectId] || { designDelay: 0, offplanDelay: 0, constructionDelay: 0 };
  }

  const reportData = useMemo(() => {
    if (!data || data.length === 0) return null;

    const projects = data.map((p: any) => {
      const option = getProjectOption(p.projectId);
      const scenario = OPTION_TO_SCENARIO[option];
      const sc = p.scenarios[scenario];
      if (!sc) {
        const fallbackSc = p.scenarios[p.financingScenario || "offplan_escrow"];
        if (!fallbackSc) return null;
      }
      const scenarioData = sc || p.scenarios[p.financingScenario || "offplan_escrow"];
      
      const paid = scenarioData.sectionTotals?.paid || 0;
      const investorTotal = scenarioData.investorTotal || 0;
      const escrowTotal = scenarioData.escrowTotal || 0;
      const remaining = investorTotal - paid;
      const totalRevenue = p.totalRevenue || 0;
      const totalCosts = p.totalCosts || 0;
      const profit = totalRevenue - totalCosts;
      const profitMarginRevenue = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;
      const profitMarginCost = totalCosts > 0 ? (profit / totalCosts) * 100 : 0;
      const profitMarginCapital = investorTotal > 0 ? (profit / investorTotal) * 100 : 0;

      // Detect non-sale project (mall/commercial center not for sale)
      const nameLC = (p.name || "").toLowerCase();
      const isNonSale = (nameLC.includes("مركز") && nameLC.includes("تجاري")) || nameLC.includes("mall");

      // Apply delays (same logic as original CapitalPortfolioPage)
      const delay = getDelay(p.projectId);
      const monthlyBySection: Record<string, number[]> = scenarioData.monthlyInvestorBySection || scenarioData.monthlyBySection || {};
      const totalMonths = p.totalMonths || (scenarioData.monthlyInvestor?.length || 24);

      const constructionEffectiveDelay = delay.designDelay + delay.constructionDelay;
      const offplanEffectiveDelay = scenario === "offplan_construction"
        ? constructionEffectiveDelay + delay.offplanDelay
        : delay.designDelay + delay.offplanDelay;
      const sectionDelayMap: Record<string, number> = {
        paid: 0,
        design: delay.designDelay,
        offplan: offplanEffectiveDelay,
        construction: constructionEffectiveDelay,
        escrow: constructionEffectiveDelay,
      };

      const chartAmounts: Record<number, number> = {};
      for (const [section, monthlyArr] of Object.entries(monthlyBySection)) {
        if (!monthlyArr || !Array.isArray(monthlyArr)) continue;
        if (section === "paid") continue;
        const delayMonths = sectionDelayMap[section] ?? 0;
        for (let m = 0; m < totalMonths; m++) {
          const val = monthlyArr[m] || 0;
          if (val <= 0) continue;
          const chartIdx = projectMonthToChartIndex(p.startDate, m) + delayMonths;
          if (chartIdx >= 0 && chartIdx < TOTAL_MONTHS) {
            chartAmounts[chartIdx] = (chartAmounts[chartIdx] || 0) + val;
          }
        }
      }
      
      return {
        id: p.projectId,
        name: p.name,
        option,
        startDate: p.startDate,
        totalMonths: p.totalMonths,
        totalRevenue,
        totalCosts,
        profit,
        profitMarginRevenue,
        profitMarginCost,
        profitMarginCapital,
        investorTotal,
        escrowTotal,
        paid,
        remaining,
        chartAmounts,
        isNonSale,
      };
    }).filter(Boolean);

    // Calculate totals (revenue/profit only from sale projects, costs/investor from all)
    const saleProjects = projects.filter((p: any) => !p.isNonSale);
    const totals = {
      totalRevenue: saleProjects.reduce((s: number, p: any) => s + p.totalRevenue, 0),
      totalCosts: projects.reduce((s: number, p: any) => s + p.totalCosts, 0),
      profit: saleProjects.reduce((s: number, p: any) => s + p.profit, 0),
      investorTotal: projects.reduce((s: number, p: any) => s + p.investorTotal, 0),
      escrowTotal: projects.reduce((s: number, p: any) => s + p.escrowTotal, 0),
      paid: projects.reduce((s: number, p: any) => s + p.paid, 0),
      remaining: projects.reduce((s: number, p: any) => s + p.remaining, 0),
      profitMarginRevenue: 0,
      profitMarginCost: 0,
      profitMarginCapital: 0,
      isNonSale: false,
    };
    totals.profitMarginRevenue = totals.totalRevenue > 0 ? (totals.profit / totals.totalRevenue) * 100 : 0;
    totals.profitMarginCost = totals.totalCosts > 0 ? (totals.profit / totals.totalCosts) * 100 : 0;
    totals.profitMarginCapital = totals.investorTotal > 0 ? (totals.profit / totals.investorTotal) * 100 : 0;

    // Build monthly distribution starting from August 2026
    const reportStartIdx = (REPORT_START_YEAR - CHART_START_YEAR) * 12 + (REPORT_START_MONTH - CHART_START_MONTH);
    
    let maxChartIdx = 0;
    for (const p of projects) {
      for (const idx of Object.keys((p as any).chartAmounts).map(Number)) {
        if (idx > maxChartIdx) maxChartIdx = idx;
      }
    }
    
    const monthlyRows: { chartIdx: number; label: string; amounts: number[]; total: number }[] = [];
    for (let ci = reportStartIdx; ci <= maxChartIdx; ci++) {
      const amounts: number[] = [];
      let total = 0;
      for (const p of projects) {
        const val = (p as any).chartAmounts[ci] || 0;
        amounts.push(val);
        total += val;
      }
      if (total > 0 || ci <= maxChartIdx) {
        monthlyRows.push({ chartIdx: ci, label: getMonthLabel(ci), amounts, total });
      }
    }

    return { projects, totals, monthlyRows };
  }, [data, projectOptions, delays]);

  // ─── Export to PDF (same professional style as Capital Portfolio Export) ───
  const handleExportPDF = () => {
    if (!reportData) return;
    const { projects, totals, monthlyRows } = reportData;
    const fmt = (n: number) => n === 0 ? "—" : Math.round(n).toLocaleString("ar-AE");
    const fmtPct = (n: number) => `${n.toFixed(1)}%`;
    const now = new Date();
    const dateStr = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;

    // Summary stats
    const paymentPct = totals.investorTotal > 0 ? Math.round((totals.paid / totals.investorTotal) * 100) : 0;
    const remainingPct = 100 - paymentPct;

    // Summary rows for the main table
    const summaryRows = [
      { label: "الإيرادات", key: "totalRevenue", format: "number", color: "#ecfdf5", borderColor: "#10b981", hideForNonSale: true },
      { label: "تكلفة المشروع", key: "totalCosts", format: "number", color: "#fef2f2", borderColor: "#ef4444", hideForNonSale: false },
      { label: "الربح", key: "profit", format: "number", color: "#eff6ff", borderColor: "#3b82f6", hideForNonSale: true },
      { label: "نسبة الربح من الإيرادات", key: "profitMarginRevenue", format: "pct", color: "#f8fafc", borderColor: "#64748b", hideForNonSale: true },
      { label: "نسبة الربح من التكلفة", key: "profitMarginCost", format: "pct", color: "#f8fafc", borderColor: "#64748b", hideForNonSale: true },
      { label: "نسبة الربح من رأس المال", key: "profitMarginCapital", format: "pct", color: "#f8fafc", borderColor: "#64748b", hideForNonSale: true },
      { label: "المبلغ المطلوب من المستثمر", key: "investorTotal", format: "number", color: "#fffbeb", borderColor: "#f59e0b", hideForNonSale: false },
      { label: "المبلغ المطلوب من حساب الضمان", key: "escrowTotal", format: "number", color: "#faf5ff", borderColor: "#a855f7", hideForNonSale: true },
      { label: "المبلغ المدفوع من المستثمر", key: "paid", format: "number", color: "#f0fdf4", borderColor: "#22c55e", hideForNonSale: false },
      { label: "المبلغ المتبقي على المستثمر", key: "remaining", format: "number", color: "#fff7ed", borderColor: "#f97316", hideForNonSale: false },
    ];

    // Build summary table rows
    const summaryTableRows = summaryRows.map(row => {
      const cells = projects.map((p: any) => {
        if (p.isNonSale && row.hideForNonSale) return `<td style="color:#cbd5e1;text-align:center">—</td>`;
        const val = (p as any)[row.key];
        const display = row.format === "pct" ? fmtPct(val) : fmt(val);
        return `<td style="text-align:center;font-weight:600">${display}</td>`;
      }).join("");
      const totalVal = (totals as any)[row.key];
      const totalDisplay = row.format === "pct" ? fmtPct(totalVal) : fmt(totalVal);
      return `<tr style="background:${row.color}">
        <td style="text-align:right;font-weight:700;border-right:3px solid ${row.borderColor};padding-right:10px">${row.label}</td>
        ${cells}
        <td style="text-align:center;font-weight:800;background:#f1f5f9">${totalDisplay}</td>
      </tr>`;
    }).join("");

    // Build monthly distribution rows
    let cumulative = 0;
    const monthlyTableRows = monthlyRows.map((row, idx) => {
      cumulative += row.total;
      const cells = row.amounts.map(val => {
        if (val <= 0) return `<td style="color:#cbd5e1;text-align:center">—</td>`;
        return `<td style="text-align:center;font-weight:600;color:#0f172a">${fmt(val)}</td>`;
      }).join("");
      const bg = idx % 2 === 0 ? "#ffffff" : "#f8fafc";
      return `<tr style="background:${bg}">
        <td style="text-align:right;font-weight:600;color:#475569">${row.label}</td>
        ${cells}
        <td style="text-align:center;font-weight:700;color:#0f172a;background:#f1f5f9">${fmt(row.total)}</td>
        <td style="text-align:center;font-weight:700;color:#92400e;background:#fffbeb">${fmt(cumulative)}</td>
      </tr>`;
    }).join("");

    // Monthly total footer
    const monthlyTotalCells = projects.map((p: any) => `<td style="text-align:center">${fmt(p.remaining)}</td>`).join("");

    const projectHeaders = projects.map((p: any) => {
      const name = p.name.length > 18 ? p.name.substring(0, 18) + "…" : p.name;
      return `<th style="min-width:100px;white-space:nowrap">${name}</th>`;
    }).join("");

    const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
  @page { size: A3 landscape; margin: 12mm; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Cairo',sans-serif; direction:rtl; padding:16px; font-size:10px; background:#fff; }
  .header { background:#0f172a; color:#fff; padding:18px 24px; border-radius:10px; margin-bottom:18px; display:flex; justify-content:space-between; align-items:center; }
  .header h1 { font-size:22px; font-weight:800; }
  .header .sub { font-size:11px; color:#94a3b8; margin-top:4px; }
  .header .logo { font-size:12px; color:#94a3b8; font-weight:600; }
  .cards { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:18px; }
  .card { background:#f8fafc; padding:14px; border-radius:8px; border-right:4px solid #0f172a; }
  .card .lbl { font-size:9px; color:#64748b; margin-bottom:4px; }
  .card .val { font-size:16px; font-weight:800; color:#0f172a; }
  .card .unit { font-size:8px; color:#94a3b8; margin-top:2px; }
  .card.green { border-right-color:#10b981; }
  .card.orange { border-right-color:#f97316; }
  .card.blue { border-right-color:#0ea5e9; }
  .card.red { border-right-color:#ef4444; }
  .section-title { font-size:13px; font-weight:800; color:#0f172a; margin:16px 0 10px; padding-bottom:6px; border-bottom:2px solid #e2e8f0; }
  table { width:100%; border-collapse:collapse; font-size:9px; table-layout:auto; margin-bottom:16px; }
  th { background:#0f172a; color:#fff; padding:7px 5px; border:1px solid #334155; font-weight:700; text-align:center; font-size:9px; white-space:nowrap; }
  td { padding:6px 5px; border:1px solid #e2e8f0; text-align:center; white-space:nowrap; font-feature-settings:"tnum"; }
  .total-row td { background:#1e293b !important; color:#fff !important; font-weight:700 !important; }
  .progress-bar { height:18px; background:#e2e8f0; border-radius:4px; overflow:hidden; display:flex; margin:8px 0; }
  .progress-bar .seg { display:flex; align-items:center; justify-content:center; font-size:9px; font-weight:700; color:#fff; }
  .footer { text-align:center; font-size:9px; color:#94a3b8; margin-top:16px; padding-top:12px; border-top:1px solid #e2e8f0; }
  .action-btns { position:fixed; top:20px; left:20px; display:flex; gap:12px; z-index:9999; }
  .action-btn { background:#0f172a; color:#fff; padding:12px 20px; border:none; border-radius:8px; font-size:13px; font-weight:700; cursor:pointer; box-shadow:0 4px 12px rgba(0,0,0,0.3); }
  .action-btn:hover { background:#1e293b; }
  .action-btn.secondary { background:#475569; }
  .action-btn.secondary:hover { background:#334155; }
  @media print { .action-btns { display:none; } }
</style>
</head>
<body>
  <div class="header">
    <div>
      <h1>تقرير ملخص المحفظة المالية</h1>
      <div class="sub">${projects.length} مشاريع · السيناريو المعتمد لكل مشروع · تاريخ التصدير: ${dateStr}</div>
    </div>
    <div class="logo">Como Developments</div>
  </div>

  <div class="cards">
    <div class="card green">
      <div class="lbl">إجمالي الإيرادات</div>
      <div class="val">${fmt(totals.totalRevenue)}</div>
      <div class="unit">درهم</div>
    </div>
    <div class="card red">
      <div class="lbl">إجمالي التكاليف</div>
      <div class="val">${fmt(totals.totalCosts)}</div>
      <div class="unit">درهم</div>
    </div>
    <div class="card blue">
      <div class="lbl">صافي الربح</div>
      <div class="val">${fmt(totals.profit)}</div>
      <div class="unit">درهم · ${fmtPct(totals.profitMarginRevenue)} من الإيرادات</div>
    </div>
    <div class="card orange">
      <div class="lbl">رأس المال المطلوب</div>
      <div class="val">${fmt(totals.investorTotal)}</div>
      <div class="unit">درهم</div>
    </div>
  </div>

  <div style="display:flex;gap:12px;margin-bottom:18px">
    <div style="flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px">
      <div style="font-size:9px;color:#64748b;margin-bottom:6px">تقدم الدفع</div>
      <div class="progress-bar">
        <div class="seg" style="width:${paymentPct}%;background:#10b981">${paymentPct}% مدفوع</div>
        <div class="seg" style="width:${remainingPct}%;background:#f97316">${remainingPct}% متبقي</div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:8px;color:#64748b;margin-top:4px">
        <span>المدفوع: ${fmt(totals.paid)} درهم</span>
        <span>المتبقي: ${fmt(totals.remaining)} درهم</span>
      </div>
    </div>
  </div>

  <div class="section-title">📊 الملخص المالي لكل مشروع</div>
  <table>
    <thead>
      <tr>
        <th style="min-width:160px;text-align:right">التفاصيل</th>
        ${projectHeaders}
        <th style="min-width:100px">الإجمالي</th>
      </tr>
    </thead>
    <tbody>
      ${summaryTableRows}
    </tbody>
  </table>

  <div class="section-title">📅 التوزيع الشهري للمبالغ المطلوبة من المستثمر</div>
  <div style="font-size:9px;color:#64748b;margin-bottom:8px">ابتداءً من أغسطس 2026</div>
  <table>
    <thead>
      <tr>
        <th style="min-width:100px;text-align:right">الشهر</th>
        ${projectHeaders}
        <th style="min-width:90px">الإجمالي</th>
        <th style="min-width:90px">التراكمي</th>
      </tr>
    </thead>
    <tbody>
      ${monthlyTableRows}
    </tbody>
    <tfoot>
      <tr class="total-row">
        <td style="text-align:right">الإجمالي</td>
        ${monthlyTotalCells}
        <td>${fmt(totals.remaining)}</td>
        <td>${fmt(totals.remaining)}</td>
      </tr>
    </tfoot>
  </table>

  <div class="footer">Como Developments · سري · للاستخدام الداخلي فقط</div>

  <div class="action-btns">
    <button class="action-btn" onclick="window.print()">🖨️ طباعة / حفظ PDF</button>
    <button class="action-btn secondary" onclick="saveAsHTML()">💾 حفظ كـ HTML</button>
  </div>
  <script>
    function saveAsHTML() {
      const html = document.documentElement.outerHTML;
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'تقرير-ملخص-المحفظة-' + new Date().toISOString().split('T')[0] + '.html';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  </script>
</body>
</html>`;

    const printWin = window.open("", "_blank", "width=1400,height=900");
    if (!printWin) {
      alert("يرجى السماح بالنوافذ المنبثقة لتصدير PDF");
      return;
    }
    printWin.document.open();
    printWin.document.write(html);
    printWin.document.close();
    setTimeout(() => printWin.focus(), 1800);
  };

  if (portfolioQuery.isLoading || savedSettingsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-amber-600 mx-auto mb-3" />
          <p className="text-gray-600 text-sm">جاري تحميل التقرير...</p>
        </div>
      </div>
    );
  }

  if (!reportData) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <p className="text-gray-500">لا توجد بيانات</p>
      </div>
    );
  }

  const { projects, totals, monthlyRows } = reportData;

  // Summary rows definition
  const summaryRows = [
    { label: "الإيرادات", key: "totalRevenue", format: "number" as const, borderColor: "border-emerald-500", bg: "bg-emerald-50/50", hideForNonSale: true },
    { label: "تكلفة المشروع", key: "totalCosts", format: "number" as const, borderColor: "border-red-500", bg: "bg-red-50/50", hideForNonSale: false },
    { label: "الربح", key: "profit", format: "number" as const, borderColor: "border-blue-500", bg: "bg-blue-50/50", hideForNonSale: true },
    { label: "نسبة الربح من الإيرادات", key: "profitMarginRevenue", format: "pct" as const, borderColor: "border-slate-400", bg: "", hideForNonSale: true },
    { label: "نسبة الربح من التكلفة", key: "profitMarginCost", format: "pct" as const, borderColor: "border-slate-400", bg: "", hideForNonSale: true },
    { label: "نسبة الربح من رأس المال", key: "profitMarginCapital", format: "pct" as const, borderColor: "border-slate-400", bg: "", hideForNonSale: true },
    { label: "المبلغ المطلوب من المستثمر", key: "investorTotal", format: "number" as const, borderColor: "border-amber-500", bg: "bg-amber-50/50", hideForNonSale: false },
    { label: "المبلغ المطلوب من حساب الضمان", key: "escrowTotal", format: "number" as const, borderColor: "border-purple-500", bg: "bg-purple-50/50", hideForNonSale: true },
    { label: "المبلغ المدفوع من المستثمر", key: "paid", format: "number" as const, borderColor: "border-green-500", bg: "bg-green-50/50", hideForNonSale: false },
    { label: "المبلغ المتبقي على المستثمر", key: "remaining", format: "number" as const, borderColor: "border-orange-500", bg: "bg-orange-50/50", hideForNonSale: false },
  ];

  return (
    <div className="min-h-screen bg-white" dir="rtl">
      {/* Professional Dark Header */}
      <div className="bg-slate-900 text-white px-6 py-5 rounded-b-xl print:rounded-none">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-extrabold tracking-tight">تقرير ملخص المحفظة المالية</h1>
            <p className="text-slate-400 text-xs mt-1">{projects.length} مشاريع · السيناريو المعتمد لكل مشروع</p>
          </div>
          <div className="flex items-center gap-3 print:hidden">
            <button
              onClick={handleExportPDF}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-900 text-xs font-bold px-4 py-2 rounded-lg transition-colors shadow-lg"
            >
              📄 تصدير PDF
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 max-w-full">
        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-3 mb-5">
          <div className="bg-white border border-slate-200 rounded-lg p-3 border-r-4 border-r-emerald-500 shadow-sm">
            <p className="text-[10px] text-slate-500 mb-1">إجمالي الإيرادات</p>
            <p className="text-base font-extrabold text-slate-900 tabular-nums">{formatAED(totals.totalRevenue)}</p>
            <p className="text-[9px] text-slate-400">درهم</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-3 border-r-4 border-r-red-500 shadow-sm">
            <p className="text-[10px] text-slate-500 mb-1">إجمالي التكاليف</p>
            <p className="text-base font-extrabold text-slate-900 tabular-nums">{formatAED(totals.totalCosts)}</p>
            <p className="text-[9px] text-slate-400">درهم</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-3 border-r-4 border-r-blue-500 shadow-sm">
            <p className="text-[10px] text-slate-500 mb-1">صافي الربح</p>
            <p className="text-base font-extrabold text-slate-900 tabular-nums">{formatAED(totals.profit)}</p>
            <p className="text-[9px] text-slate-400">{totals.profitMarginRevenue.toFixed(1)}% من الإيرادات</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-3 border-r-4 border-r-amber-500 shadow-sm">
            <p className="text-[10px] text-slate-500 mb-1">رأس المال المطلوب</p>
            <p className="text-base font-extrabold text-slate-900 tabular-nums">{formatAED(totals.investorTotal)}</p>
            <p className="text-[9px] text-slate-400">درهم</p>
          </div>
        </div>

        {/* Payment Progress Bar */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-semibold text-slate-600">تقدم الدفع</span>
            <span className="text-[10px] text-slate-500">
              المدفوع: {formatAED(totals.paid)} · المتبقي: {formatAED(totals.remaining)}
            </span>
          </div>
          <div className="h-4 bg-slate-200 rounded-full overflow-hidden flex">
            <div
              className="bg-emerald-500 flex items-center justify-center text-[8px] font-bold text-white"
              style={{ width: `${totals.investorTotal > 0 ? (totals.paid / totals.investorTotal) * 100 : 0}%` }}
            >
              {totals.investorTotal > 0 ? Math.round((totals.paid / totals.investorTotal) * 100) : 0}%
            </div>
            <div
              className="bg-orange-400 flex items-center justify-center text-[8px] font-bold text-white"
              style={{ width: `${totals.investorTotal > 0 ? (totals.remaining / totals.investorTotal) * 100 : 0}%` }}
            >
              {totals.investorTotal > 0 ? Math.round((totals.remaining / totals.investorTotal) * 100) : 0}%
            </div>
          </div>
        </div>

        {/* Summary Table */}
        <div className="mb-5">
          <h2 className="text-sm font-extrabold text-slate-900 mb-2 pb-1 border-b-2 border-slate-200">📊 الملخص المالي لكل مشروع</h2>
          <div className="overflow-x-auto border border-slate-200 rounded-lg shadow-sm">
            <table className="w-full text-[10px] border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white">
                  <th className="px-3 py-2 text-right font-bold border-l border-slate-600 sticky right-0 bg-slate-900 z-10 min-w-[160px]">التفاصيل</th>
                  {projects.map((p: any) => (
                    <th key={p.id} className="px-2 py-2 text-center font-medium border-l border-slate-600 min-w-[105px] whitespace-nowrap">
                      {p.name.length > 18 ? p.name.substring(0, 18) + "…" : p.name}
                    </th>
                  ))}
                  <th className="px-2 py-2 text-center font-bold min-w-[105px] bg-slate-800">الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {summaryRows.map((row) => (
                  <tr key={row.key} className={`border-b border-slate-100 ${row.bg}`}>
                    <td className={`px-3 py-1.5 text-right font-semibold text-slate-800 border-l border-slate-200 sticky right-0 z-10 bg-white border-r-[3px] ${row.borderColor}`}>
                      {row.label}
                    </td>
                    {projects.map((p: any) => (
                      <td key={p.id} className="px-2 py-1.5 text-center text-slate-700 border-l border-slate-100 tabular-nums font-medium">
                        {p.isNonSale && row.hideForNonSale
                          ? <span className="text-slate-300">—</span>
                          : row.format === "pct"
                            ? `${(p as any)[row.key].toFixed(1)}%`
                            : formatAED((p as any)[row.key])}
                      </td>
                    ))}
                    <td className="px-2 py-1.5 text-center font-bold text-slate-900 bg-slate-50 tabular-nums">
                      {row.format === "pct"
                        ? `${(totals as any)[row.key].toFixed(1)}%`
                        : formatAED((totals as any)[row.key])}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Monthly Distribution Table */}
        <div>
          <h2 className="text-sm font-extrabold text-slate-900 mb-1 pb-1 border-b-2 border-slate-200">📅 التوزيع الشهري للمبالغ المطلوبة من المستثمر</h2>
          <p className="text-[10px] text-slate-400 mb-2">ابتداءً من أغسطس 2026</p>
          <div className="overflow-x-auto border border-slate-200 rounded-lg shadow-sm">
            <table className="w-full text-[9px] border-collapse">
              <thead>
                <tr className="bg-slate-800 text-white">
                  <th className="px-2 py-1.5 text-right font-bold border-l border-slate-600 sticky right-0 bg-slate-800 z-10 min-w-[95px]">الشهر</th>
                  {projects.map((p: any) => (
                    <th key={p.id} className="px-1.5 py-1.5 text-center font-medium border-l border-slate-600 min-w-[90px] whitespace-nowrap">
                      {p.name.length > 14 ? p.name.substring(0, 14) + "…" : p.name}
                    </th>
                  ))}
                  <th className="px-2 py-1.5 text-center font-bold min-w-[90px] bg-slate-700">الإجمالي</th>
                  <th className="px-2 py-1.5 text-center font-bold min-w-[90px] bg-slate-900">التراكمي</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  let cumulative = 0;
                  return monthlyRows.map((row, idx) => {
                    cumulative += row.total;
                    const isEven = idx % 2 === 0;
                    return (
                      <tr key={row.chartIdx} className={`border-b border-slate-50 ${isEven ? '' : 'bg-slate-50/60'} hover:bg-amber-50/30`}>
                        <td className={`px-2 py-1 text-right font-semibold text-slate-600 border-l border-slate-200 sticky right-0 z-10 ${isEven ? 'bg-white' : 'bg-slate-50/60'}`}>
                          {row.label}
                        </td>
                        {row.amounts.map((val, pi) => (
                          <td key={pi} className="px-1.5 py-1 text-center text-slate-700 border-l border-slate-50 tabular-nums font-medium">
                            {val > 0 ? formatAED(val) : <span className="text-slate-300">—</span>}
                          </td>
                        ))}
                        <td className="px-2 py-1 text-center font-bold text-slate-900 bg-slate-100/80 tabular-nums">
                          {row.total > 0 ? formatAED(row.total) : "—"}
                        </td>
                        <td className="px-2 py-1 text-center font-bold text-amber-800 bg-amber-50/60 tabular-nums">
                          {formatAED(cumulative)}
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
              <tfoot>
                <tr className="bg-slate-900 text-white font-bold">
                  <td className="px-2 py-1.5 text-right sticky right-0 bg-slate-900 z-10">الإجمالي</td>
                  {projects.map((p: any) => (
                    <td key={p.id} className="px-1.5 py-1.5 text-center border-l border-slate-600 tabular-nums">
                      {formatAED(p.remaining)}
                    </td>
                  ))}
                  <td className="px-2 py-1.5 text-center bg-slate-800 tabular-nums">{formatAED(totals.remaining)}</td>
                  <td className="px-2 py-1.5 text-center bg-slate-800 tabular-nums">{formatAED(totals.remaining)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-[9px] text-slate-400 mt-4 pt-3 border-t border-slate-200">
          Como Developments · سري · للاستخدام الداخلي فقط
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; }
          .print\\:hidden { display: none !important; }
          .print\\:rounded-none { border-radius: 0 !important; }
        }
      `}</style>
    </div>
  );
}
