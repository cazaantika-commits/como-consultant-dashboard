/**
 * Generate a standalone HTML report for an individual project's cash flow.
 * Same quality and style as the portfolio capital report (CapitalPortfolioPage).
 * Opens in a new window with print/save buttons.
 */

interface ReportItem {
  itemKey: string;
  nameAr: string;
  section: string;
  fundingSource: string;
  totalAmount: number;
  monthlyAmounts: number[];
}

interface PhaseInfo {
  type: string;
  startMonth: number;
  duration: number;
  endMonth: number;
}

interface ProjectReport {
  projectId: number;
  projectName: string;
  scenario: string;
  startDate: string;
  totalMonths: number;
  monthLabels: string[];
  phases: PhaseInfo[];
  durations: { design: number; offplan: number; construction: number; handover: number };
  items: ReportItem[];
  totalPerMonth: number[];
  grandTotal: number;
}

const SCENARIO_LABELS: Record<string, string> = {
  offplan_escrow: "أوف بلان مع حساب ضمان",
  offplan_construction: "أوف بلان بعد إنجاز 20%",
  no_offplan: "تطوير بدون بيع على الخارطة",
};

const PHASE_LABELS: Record<string, string> = {
  design: "التصاميم والاعتمادات",
  offplan: "التسجيل على الخارطة",
  construction: "الإنشاء",
  handover: "التسليم",
  land: "الأرض",
};

const PHASE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  design: { bg: "#fff3e0", border: "#fb923c", text: "#9a3412" },
  offplan: { bg: "#fce4ec", border: "#db2777", text: "#831843" },
  construction: { bg: "#ede7f6", border: "#7c3aed", text: "#4c1d95" },
  handover: { bg: "#e3f2fd", border: "#0ea5e9", text: "#0c4a6e" },
  land: { bg: "#fef3c7", border: "#d97706", text: "#78350f" },
};

const SECTION_LABELS: Record<string, string> = {
  paid: "مدفوع (الأرض)",
  design: "التصاميم والاعتمادات",
  offplan: "التسجيل على الخارطة",
  construction: "الإنشاء (من المستثمر)",
  escrow: "الإنشاء (من الضمان)",
};

function fmt(n: number): string {
  if (!n || n === 0) return "—";
  return Math.round(n).toLocaleString("ar-AE");
}

function getPhaseForMonth(month: number, phases: PhaseInfo[]): string {
  for (const p of phases) {
    if (month >= p.startMonth && month <= p.endMonth) return p.type;
  }
  return "construction";
}

export function exportProjectCashFlowHTML(report: ProjectReport): void {
  const now = new Date();
  const dateStr = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;

  // Group items by section
  const sections: { key: string; label: string; items: ReportItem[] }[] = [];
  const sectionOrder = ["paid", "design", "offplan", "construction", "escrow"];
  for (const sKey of sectionOrder) {
    const sItems = report.items.filter(i => i.section === sKey && i.totalAmount > 0);
    if (sItems.length > 0) {
      sections.push({ key: sKey, label: SECTION_LABELS[sKey] || sKey, items: sItems });
    }
  }

  // Compute section totals
  const sectionTotals = sections.map(s => ({
    ...s,
    total: s.items.reduce((sum, i) => sum + i.totalAmount, 0),
  }));

  // Investor vs Escrow breakdown
  const investorTotal = report.items.filter(i => i.fundingSource === "investor").reduce((s, i) => s + i.totalAmount, 0);
  const escrowTotal = report.items.filter(i => i.fundingSource === "escrow").reduce((s, i) => s + i.totalAmount, 0);

  // Cumulative totals
  const cumulative: number[] = [];
  let cum = 0;
  for (let m = 0; m < report.totalMonths; m++) {
    cum += report.totalPerMonth[m] || 0;
    cumulative.push(cum);
  }

  // Phase distribution percentages
  const phaseAmounts: Record<string, number> = {};
  for (let m = 0; m < report.totalMonths; m++) {
    const phase = getPhaseForMonth(m + 1, report.phases);
    phaseAmounts[phase] = (phaseAmounts[phase] || 0) + (report.totalPerMonth[m] || 0);
  }

  // Build month header with phase coloring
  const monthHeaders = report.monthLabels.map((label, mi) => {
    const phase = getPhaseForMonth(mi + 1, report.phases);
    const color = PHASE_COLORS[phase] || PHASE_COLORS.construction;
    return `<th style="min-width:70px;white-space:nowrap;background:${color.bg};color:${color.text};border-bottom:3px solid ${color.border};font-size:8px;padding:4px 2px">${label}</th>`;
  }).join("");

  // Build phase header row (merged cells)
  const phaseHeaders = report.phases.map(p => {
    const color = PHASE_COLORS[p.type] || PHASE_COLORS.construction;
    return `<th colspan="${p.duration}" style="background:${color.border};color:#fff;padding:6px 4px;font-size:10px;font-weight:700;border:1px solid rgba(255,255,255,0.3)">${PHASE_LABELS[p.type] || p.type}</th>`;
  }).join("");

  // Build item rows grouped by section
  let rowsHtml = "";
  for (const section of sections) {
    // Section header row
    rowsHtml += `<tr><td colspan="${report.totalMonths + 2}" style="background:#1e293b;color:#fff;font-weight:700;padding:6px 10px;font-size:10px;text-align:right">${section.label}</td></tr>`;
    
    for (const item of section.items) {
      const cells = item.monthlyAmounts.map((val, mi) => {
        const phase = getPhaseForMonth(mi + 1, report.phases);
        const color = PHASE_COLORS[phase] || PHASE_COLORS.construction;
        const bg = val > 0 ? color.bg : "#fff";
        return `<td style="background:${bg};padding:3px 2px;text-align:center;font-size:9px;border:1px solid #e2e8f0;color:${val > 0 ? '#1e293b' : '#cbd5e1'}">${val > 0 ? fmt(val) : "—"}</td>`;
      }).join("");
      
      rowsHtml += `<tr>
        <td style="text-align:right;padding:4px 8px;font-size:9px;font-weight:500;white-space:nowrap;border:1px solid #e2e8f0;background:#f8fafc">${item.nameAr}</td>
        <td style="text-align:center;padding:4px;font-size:9px;font-weight:700;border:1px solid #e2e8f0;background:#f1f5f9">${fmt(item.totalAmount)}</td>
        ${cells}
      </tr>`;
    }
  }

  // Total row
  const totalCells = report.totalPerMonth.map((val, mi) => {
    return `<td style="background:#1e293b;color:#fff;padding:4px 2px;text-align:center;font-size:9px;font-weight:700;border:1px solid #334155">${val > 0 ? fmt(val) : "—"}</td>`;
  }).join("");

  // Cumulative row
  const cumCells = cumulative.map((val) => {
    return `<td style="background:#0f172a;color:#94a3b8;padding:4px 2px;text-align:center;font-size:8px;font-weight:600;border:1px solid #334155">${fmt(val)}</td>`;
  }).join("");

  // Summary cards HTML
  const summaryCards = `
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
      <div style="background:#fff;border-right:4px solid #ef4444;padding:12px;border-radius:6px;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
        <div style="font-size:9px;color:#64748b;margin-bottom:4px">إجمالي التكاليف</div>
        <div style="font-size:16px;font-weight:800;color:#0f172a">${fmt(report.grandTotal)}</div>
        <div style="font-size:8px;color:#94a3b8">درهم إماراتي</div>
      </div>
      <div style="background:#fff;border-right:4px solid #7c3aed;padding:12px;border-radius:6px;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
        <div style="font-size:9px;color:#64748b;margin-bottom:4px">رأس مال المستثمر</div>
        <div style="font-size:16px;font-weight:800;color:#0f172a">${fmt(investorTotal)}</div>
        <div style="font-size:8px;color:#94a3b8">${report.grandTotal > 0 ? Math.round((investorTotal / report.grandTotal) * 100) : 0}% من الإجمالي</div>
      </div>
      <div style="background:#fff;border-right:4px solid #0ea5e9;padding:12px;border-radius:6px;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
        <div style="font-size:9px;color:#64748b;margin-bottom:4px">من حساب الضمان</div>
        <div style="font-size:16px;font-weight:800;color:#0f172a">${fmt(escrowTotal)}</div>
        <div style="font-size:8px;color:#94a3b8">${report.grandTotal > 0 ? Math.round((escrowTotal / report.grandTotal) * 100) : 0}% من الإجمالي</div>
      </div>
      <div style="background:#fff;border-right:4px solid #10b981;padding:12px;border-radius:6px;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
        <div style="font-size:9px;color:#64748b;margin-bottom:4px">مدة المشروع</div>
        <div style="font-size:16px;font-weight:800;color:#0f172a">${report.totalMonths}</div>
        <div style="font-size:8px;color:#94a3b8">شهر (${report.monthLabels[0]} → ${report.monthLabels[report.totalMonths - 1]})</div>
      </div>
    </div>
  `;

  // Phase breakdown bar
  const phaseBar = report.phases.map(p => {
    const amt = phaseAmounts[p.type] || 0;
    const pct = report.grandTotal > 0 ? Math.round((amt / report.grandTotal) * 100) : 0;
    const color = PHASE_COLORS[p.type] || PHASE_COLORS.construction;
    return `<div style="flex:${pct || 1};background:${color.border};display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:700;color:#fff;padding:4px 2px;min-width:40px">${PHASE_LABELS[p.type]} ${pct}%</div>`;
  }).join("");

  // Section breakdown table
  const sectionBreakdown = sectionTotals.map(s => {
    const pct = report.grandTotal > 0 ? Math.round((s.total / report.grandTotal) * 100) : 0;
    return `<tr>
      <td style="text-align:right;padding:4px 8px;font-size:10px;font-weight:600">${s.label}</td>
      <td style="text-align:center;padding:4px;font-size:10px;font-weight:700">${fmt(s.total)}</td>
      <td style="text-align:center;padding:4px;font-size:10px;color:#64748b">${pct}%</td>
    </tr>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<title>تقرير التدفقات النقدية — ${report.projectName}</title>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
  @page { size: A3 landscape; margin: 12mm; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Cairo',sans-serif; direction:rtl; padding:16px; font-size:10px; background:#f8fafc; }
  .header { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color:#fff; padding:20px 24px; border-radius:10px; margin-bottom:16px; display:flex; justify-content:space-between; align-items:center; }
  .header h1 { font-size:18px; font-weight:800; margin-bottom:4px; }
  .header .sub { font-size:10px; color:#94a3b8; }
  .header .logo { font-size:24px; font-weight:800; color:#7c3aed; letter-spacing:-1px; }
  .phase-bar { display:flex; height:24px; border-radius:6px; overflow:hidden; margin-bottom:16px; box-shadow:0 1px 3px rgba(0,0,0,0.1); }
  .section-summary { background:#fff; border-radius:8px; padding:12px; margin-bottom:16px; box-shadow:0 1px 3px rgba(0,0,0,0.1); }
  .section-summary h3 { font-size:11px; font-weight:700; color:#0f172a; margin-bottom:8px; border-bottom:2px solid #e2e8f0; padding-bottom:4px; }
  .section-summary table { width:100%; border-collapse:collapse; }
  .section-summary td { border-bottom:1px solid #f1f5f9; }
  table.main { width:100%; border-collapse:collapse; font-size:9px; table-layout:auto; background:#fff; border-radius:8px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.08); }
  .footer { text-align:center; font-size:9px; color:#94a3b8; margin-top:16px; padding-top:12px; border-top:1px solid #e2e8f0; }
  .action-btns { position:fixed; top:20px; left:20px; display:flex; gap:12px; z-index:9999; }
  .action-btn { background:#0f172a; color:#fff; padding:12px 20px; border:none; border-radius:8px; font-size:13px; font-weight:700; cursor:pointer; box-shadow:0 4px 12px rgba(0,0,0,0.3); transition:all 0.2s; }
  .action-btn:hover { background:#334155; transform:translateY(-1px); }
  .action-btn.secondary { background:#475569; }
  .action-btn.secondary:hover { background:#64748b; }
  @media print { 
    .action-btns { display:none; } 
    body { background:#fff; padding:0; }
    .header { border-radius:0; }
  }
</style>
</head>
<body>
  <div class="header">
    <div>
      <h1>تقرير التدفقات النقدية — ${report.projectName}</h1>
      <div class="sub">
        السيناريو: ${SCENARIO_LABELS[report.scenario] || report.scenario} &middot;
        المدة: ${report.totalMonths} شهر &middot;
        البداية: ${report.monthLabels[0]} &middot;
        تاريخ التصدير: ${dateStr}
      </div>
    </div>
    <div class="logo">COMO</div>
  </div>

  ${summaryCards}

  <div class="phase-bar">${phaseBar}</div>

  <div style="display:grid;grid-template-columns:1fr 2fr;gap:16px;margin-bottom:16px">
    <div class="section-summary">
      <h3>توزيع التكاليف حسب المرحلة</h3>
      <table>
        ${sectionBreakdown}
        <tr style="border-top:2px solid #0f172a">
          <td style="text-align:right;padding:6px 8px;font-size:10px;font-weight:800">الإجمالي</td>
          <td style="text-align:center;padding:6px;font-size:10px;font-weight:800">${fmt(report.grandTotal)}</td>
          <td style="text-align:center;padding:6px;font-size:10px;font-weight:800">100%</td>
        </tr>
      </table>
    </div>
    <div class="section-summary">
      <h3>معلومات المراحل</h3>
      <table>
        <tr style="background:#f1f5f9">
          <th style="text-align:right;padding:4px 8px;font-size:9px">المرحلة</th>
          <th style="text-align:center;padding:4px;font-size:9px">المدة</th>
          <th style="text-align:center;padding:4px;font-size:9px">من شهر</th>
          <th style="text-align:center;padding:4px;font-size:9px">إلى شهر</th>
          <th style="text-align:center;padding:4px;font-size:9px">المبلغ</th>
          <th style="text-align:center;padding:4px;font-size:9px">النسبة</th>
        </tr>
        ${report.phases.map(p => {
          const amt = phaseAmounts[p.type] || 0;
          const pct = report.grandTotal > 0 ? Math.round((amt / report.grandTotal) * 100) : 0;
          const color = PHASE_COLORS[p.type] || PHASE_COLORS.construction;
          return `<tr>
            <td style="text-align:right;padding:4px 8px;font-size:9px;font-weight:600;border-right:3px solid ${color.border}">${PHASE_LABELS[p.type]}</td>
            <td style="text-align:center;padding:4px;font-size:9px">${p.duration} شهر</td>
            <td style="text-align:center;padding:4px;font-size:9px">${report.monthLabels[p.startMonth - 1] || p.startMonth}</td>
            <td style="text-align:center;padding:4px;font-size:9px">${report.monthLabels[p.endMonth - 1] || p.endMonth}</td>
            <td style="text-align:center;padding:4px;font-size:9px;font-weight:700">${fmt(amt)}</td>
            <td style="text-align:center;padding:4px;font-size:9px;color:#64748b">${pct}%</td>
          </tr>`;
        }).join("")}
      </table>
    </div>
  </div>

  <table class="main">
    <thead>
      <tr>
        <th style="background:#0f172a;color:#fff;padding:6px 8px;text-align:right;font-size:10px;min-width:160px;border:1px solid #334155">البند</th>
        <th style="background:#0f172a;color:#fff;padding:6px 4px;text-align:center;font-size:10px;min-width:90px;border:1px solid #334155">الإجمالي (د.إ)</th>
        ${phaseHeaders}
      </tr>
      <tr>
        <th style="background:#f1f5f9;padding:3px 8px;text-align:right;font-size:8px;color:#64748b;border:1px solid #e2e8f0"></th>
        <th style="background:#f1f5f9;padding:3px 4px;text-align:center;font-size:8px;color:#64748b;border:1px solid #e2e8f0"></th>
        ${monthHeaders}
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
      <tr>
        <td style="background:#1e293b;color:#fff;padding:6px 8px;text-align:right;font-size:10px;font-weight:800;border:1px solid #334155">إجمالي المصاريف</td>
        <td style="background:#1e293b;color:#fff;padding:6px 4px;text-align:center;font-size:10px;font-weight:800;border:1px solid #334155">${fmt(report.grandTotal)}</td>
        ${totalCells}
      </tr>
      <tr>
        <td style="background:#0f172a;color:#94a3b8;padding:4px 8px;text-align:right;font-size:9px;font-weight:600;border:1px solid #334155">التراكمي</td>
        <td style="background:#0f172a;color:#94a3b8;padding:4px 4px;text-align:center;font-size:9px;border:1px solid #334155">—</td>
        ${cumCells}
      </tr>
    </tbody>
  </table>

  <div class="footer">
    Como Developments &middot; تقرير التدفقات النقدية &middot; سري — للاستخدام الداخلي فقط &middot; ${dateStr}
  </div>

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
      a.download = 'تقرير-التدفقات-النقدية-${report.projectName.replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, "-")}-' + new Date().toISOString().split('T')[0] + '.html';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  </script>
</body>
</html>`;

  // Open in new window
  const printWin = window.open("", "_blank", "width=1400,height=900");
  if (!printWin) {
    alert("يرجى السماح بالنوافذ المنبثقة لتصدير التقرير");
    return;
  }
  printWin.document.open();
  printWin.document.write(html);
  printWin.document.close();
  // Wait for fonts to load
  setTimeout(() => printWin.focus(), 1500);
}
