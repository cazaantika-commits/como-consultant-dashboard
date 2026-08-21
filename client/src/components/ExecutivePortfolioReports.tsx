import { useState } from "react";
import { ArrowRight, BriefcaseBusiness, CalendarClock, CalendarRange, Landmark, ShieldAlert, WalletCards } from "lucide-react";
import V2CapitalPortfolio from "@/pages/V2CapitalPortfolio";
import V2Portfolio from "@/pages/V2Portfolio";
import V2PortfolioEscrowLiquidity from "@/pages/V2PortfolioEscrowLiquidity";
import V2PortfolioMonthly from "@/pages/V2PortfolioMonthly";
import { EXECUTIVE_PORTFOLIO_REPORTS, type ExecutivePortfolioReportId } from "@/lib/executivePortfolioReports";
import { ExecutiveFourMonthFocus } from "@/components/ExecutiveFourMonthFocus";

const REPORT_ICONS: Record<ExecutivePortfolioReportId, typeof BriefcaseBusiness> = {
  portfolio: BriefcaseBusiness,
  portfolio_monthly: CalendarRange,
  portfolio_escrow_liquidity: ShieldAlert,
  capital_portfolio: WalletCards,
};

const REPORT_STYLES: Record<ExecutivePortfolioReportId, { icon: string; border: string; wash: string }> = {
  portfolio: { icon: "bg-indigo-600", border: "border-indigo-200", wash: "from-indigo-50 to-white" },
  portfolio_monthly: { icon: "bg-sky-600", border: "border-sky-200", wash: "from-sky-50 to-white" },
  portfolio_escrow_liquidity: { icon: "bg-rose-600", border: "border-rose-200", wash: "from-rose-50 to-white" },
  capital_portfolio: { icon: "bg-emerald-600", border: "border-emerald-200", wash: "from-emerald-50 to-white" },
};

function ReportContent({ report, onBack }: { report: ExecutivePortfolioReportId; onBack: () => void }) {
  if (report === "portfolio") return <V2Portfolio embedded onBack={onBack} />;
  if (report === "portfolio_monthly") return <V2PortfolioMonthly embedded onBack={onBack} />;
  if (report === "portfolio_escrow_liquidity") return <V2PortfolioEscrowLiquidity readOnly />;
  return <V2CapitalPortfolio embedded onBack={onBack} />;
}

export function ExecutivePortfolioReports({ onBack }: { onBack: () => void }) {
  const [activeReport, setActiveReport] = useState<ExecutivePortfolioReportId | null>(null);
  const [showFourMonthFocus, setShowFourMonthFocus] = useState(false);

  if (activeReport) {
    return (
      <div className="min-h-screen bg-slate-50" dir="rtl">
        <div className="sticky top-16 z-20 flex items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
          <button onClick={() => setActiveReport(null)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-100">
            <ArrowRight className="h-4 w-4" /> العودة إلى التقارير التنفيذية
          </button>
          <div className="flex items-center gap-2"><button onClick={() => setShowFourMonthFocus(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-[11px] font-black text-indigo-700 transition hover:bg-indigo-100"><CalendarClock className="h-3.5 w-3.5" /> الأشهر الأربعة القادمة</button><span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-black text-slate-600">عرض فقط</span></div>
        </div>
        <ReportContent report={activeReport} onBack={() => setActiveReport(null)} />
        {showFourMonthFocus && <ExecutiveFourMonthFocus variant="panel" onClose={() => setShowFourMonthFocus(false)} />}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6" dir="rtl">
      <section className="overflow-hidden rounded-3xl border border-indigo-200 bg-gradient-to-l from-indigo-50 via-white to-slate-50 p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-200"><BriefcaseBusiness className="h-6 w-6" /></span>
            <div>
              <p className="text-[11px] font-black tracking-wide text-indigo-700">مركز القيادة</p>
              <h1 className="mt-1 text-xl font-black text-slate-950">تقارير المحفظة التنفيذية</h1>
              <p className="mt-1 text-sm leading-6 text-slate-600">قراءة موحدة للمحفظة كاملة، من دون إدخالات أو تعديل للبيانات المالية.</p>
            </div>
          </div>
          <span className="self-start rounded-full border border-indigo-200 bg-white px-3 py-1.5 text-[11px] font-black text-indigo-700">4 تقارير جامعة · عرض فقط</span>
        </div>
      </section>

      <ExecutiveFourMonthFocus variant="brief" />

      <div className="grid gap-4 sm:grid-cols-2">
        {EXECUTIVE_PORTFOLIO_REPORTS.map((report) => {
          const Icon = REPORT_ICONS[report.id];
          const style = REPORT_STYLES[report.id];
          return (
            <button key={report.id} onClick={() => setActiveReport(report.id)} className={`group flex min-h-[142px] items-center justify-between gap-4 rounded-2xl border bg-gradient-to-l ${style.wash} p-5 text-right shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${style.border}`}>
              <div className="min-w-0">
                <p className="text-base font-black text-slate-900">{report.label}</p>
                <p className="mt-2 text-xs leading-5 text-slate-600">{report.description}</p>
                <span className="mt-3 inline-flex rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-slate-600 ring-1 ring-slate-200">فتح التقرير</span>
              </div>
              <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white shadow-md transition group-hover:scale-105 ${style.icon}`}><Icon className="h-6 w-6" /></span>
            </button>
          );
        })}
      </div>

      <button onClick={onBack} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-600 transition hover:bg-slate-100"><ArrowRight className="h-4 w-4" /> العودة إلى مركز القيادة</button>
    </div>
  );
}
