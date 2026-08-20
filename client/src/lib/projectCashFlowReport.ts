/**
 * Compatibility exporter for the legacy Escrow Cash Flow route.
 * The active Financial Studies workspace remains the canonical interactive report.
 */
type ReportItem = {
  name?: string;
  nameAr?: string;
  totalAmount?: number;
  monthlyAmounts?: number[];
};

type ProjectCashFlowReport = {
  projectName?: string;
  scenario?: string;
  startDate?: string;
  totalMonths?: number;
  monthLabels?: string[];
  grandTotal?: number;
  totalRevenueInflow?: number;
  items?: ReportItem[];
};

function formatAmount(value: number | undefined): string {
  return Math.round(value || 0).toLocaleString("en-US");
}

export function exportProjectCashFlowHTML(report: ProjectCashFlowReport): void {
  const popup = window.open("", "_blank", "width=1400,height=900");
  if (!popup) {
    alert("يرجى السماح بالنوافذ المنبثقة لتصدير التقرير");
    return;
  }

  const labels = report.monthLabels || [];
  const rows = (report.items || [])
    .filter((item) => (item.totalAmount || 0) !== 0 || (item.monthlyAmounts || []).some(Boolean))
    .map((item) => {
      const cells = labels.map((_, index) => {
        const value = item.monthlyAmounts?.[index] || 0;
        return `<td>${value ? formatAmount(value) : "—"}</td>`;
      }).join("");
      return `<tr><td class="item">${item.nameAr || item.name || "بند مالي"}</td><td>${formatAmount(item.totalAmount)}</td>${cells}</tr>`;
    }).join("");

  const monthHeaders = labels.map((label) => `<th>${label}</th>`).join("");
  const now = new Date().toLocaleDateString("ar-AE");
  popup.document.open();
  popup.document.write(`<!doctype html>
    <html lang="ar" dir="rtl"><head><meta charset="utf-8" />
    <title>تقرير التدفقات النقدية — ${report.projectName || "المشروع"}</title>
    <style>
      body{font-family:Arial,sans-serif;background:#fff;color:#172033;margin:24px;direction:rtl}
      h1{font-size:20px;margin:0 0 6px}.meta{color:#526070;font-size:12px;margin-bottom:18px}
      .summary{display:flex;gap:12px;margin:0 0 18px}.card{border:1px solid #cbd5e1;border-radius:8px;padding:12px;min-width:190px;background:#f8fafc}.card b{display:block;font-size:18px;margin-top:5px}
      table{border-collapse:collapse;width:100%;font-size:10px}.item{font-weight:700;text-align:right;min-width:180px}th{background:#334155;color:#fff;font-weight:700}th,td{border:1px solid #cbd5e1;padding:6px;text-align:center;white-space:nowrap}td{color:#243047}
      @media print{body{margin:8mm}.no-print{display:none}}
    </style></head><body>
    <button class="no-print" onclick="window.print()">طباعة / حفظ PDF</button>
    <h1>تقرير التدفقات النقدية — ${report.projectName || "المشروع"}</h1>
    <div class="meta">السيناريو: ${report.scenario || "—"} · المدة: ${report.totalMonths || labels.length} شهر · تاريخ التصدير: ${now}</div>
    <div class="summary"><div class="card">إجمالي التكاليف<b>${formatAmount(report.grandTotal)} AED</b></div><div class="card">إجمالي إيرادات المبيعات<b>${formatAmount(report.totalRevenueInflow)} AED</b></div></div>
    <table><thead><tr><th>البند</th><th>الإجمالي</th>${monthHeaders}</tr></thead><tbody>${rows}</tbody></table>
    </body></html>`);
  popup.document.close();
}
