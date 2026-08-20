import { useMemo } from "react";
import { AlertTriangle, CheckCircle2, ShieldAlert, Sparkles } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { formatFullNumber } from "@/lib/numberFormat";
import { Button } from "@/components/ui/button";

const MONTH_NAMES = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const formatMonth = (date: string) => {
  const [year, month] = date.split("-").map(Number);
  return `${MONTH_NAMES[month - 1]} ${year}`;
};
const money = (value: number) => formatFullNumber(value, "0");

export default function V2PortfolioEscrowLiquidity() {
  const liquidityQuery = trpc.cashFlowSettings.getPortfolioEscrowLiquidity.useQuery(undefined, { staleTime: 0 });
  const utils = trpc.useUtils();
  const seedPlans = trpc.cashFlowSettings.seedInitialOffPlanScenarios.useMutation({
    onSuccess: () => {
      utils.cashFlowSettings.getPortfolioEscrowLiquidity.invalidate();
      utils.cashFlowSettings.getPortfolioInvestorNetCashFlows.invalidate();
    },
  });
  const projects = liquidityQuery.data || [];
  const monthDates = useMemo(() => Array.from(new Set(projects.flatMap((project: any) => project.monthDates))).sort(), [projects]);
  const deficitProjects = projects.filter((project: any) => project.liquidity.hasDeficit);
  const earliestDeficit = deficitProjects
    .map((project: any) => ({ project, index: project.liquidity.firstDeficitIndex as number }))
    .sort((left, right) => left.project.monthDates[left.index].localeCompare(right.project.monthDates[right.index]))[0];
  const lowestBalance = projects.reduce((lowest: any, project: any) => !lowest || project.liquidity.minimumBalance < lowest.project.liquidity.minimumBalance ? { project } : lowest, null);

  if (liquidityQuery.isLoading) return <div className="fs-card fs-card-teal p-5 text-sm text-slate-500">جاري تجهيز مقارنة سيولة الإسكرو...</div>;

  return <div className="financial-studies-language mx-auto max-w-[1800px] space-y-4 px-4 py-4" dir="rtl">
    <section className="fs-card fs-card-teal overflow-hidden p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-100 text-teal-700"><ShieldAlert className="h-5 w-5" /></span><div><p className="text-xs font-black text-teal-700">سيولة الإسكرو — المحفظة كاملة</p><h1 className="mt-1 text-lg font-black text-slate-900">إنذار مبكر ومقارنة شهرية من مصادر التدفق المعتمدة</h1><p className="mt-1 text-xs leading-5 text-slate-600">كل رصيد هو رصيد نهاية الشهر نفسه الظاهر في المبيعات وتدفقات الإسكرو؛ لا توجد أرقام إدخال مكررة هنا.</p></div></div>
        <Button onClick={() => seedPlans.mutate()} disabled={seedPlans.isPending} className="bg-teal-700 text-white hover:bg-teal-800">{seedPlans.isPending ? "جاري حفظ السيناريوهات..." : "حفظ السيناريو الأولي للمشاريع بلا خطة"}</Button>
      </div>
    </section>

    <section className="grid gap-3 md:grid-cols-3">
      <div className="fs-card fs-card-red p-4" data-testid="portfolio-escrow-deficit-alert"><p className="text-xs font-bold text-red-700">مشاريع تحتاج قرار سيولة</p><p className="mt-1 text-2xl font-black text-slate-900">{deficitProjects.length}</p><p className="mt-1 text-[11px] text-slate-600">من أصل {projects.length} مشاريع أوف بلان</p></div>
      <div className="fs-card fs-card-orange p-4"><p className="text-xs font-bold text-amber-700">أول إنذار</p><p className="mt-1 text-sm font-black text-slate-900">{earliestDeficit ? `${earliestDeficit.project.name} — ${formatMonth(earliestDeficit.project.monthDates[earliestDeficit.index])}` : "لا يوجد عجز"}</p><p className="mt-1 text-[11px] text-slate-600">{earliestDeficit ? `${money(earliestDeficit.project.liquidity.firstDeficit)} AED` : "الرصيد موجب أو صفري"}</p></div>
      <div className="fs-card fs-card-violet p-4"><p className="text-xs font-bold text-violet-700">أدنى رصيد في المحفظة</p><p className="mt-1 text-sm font-black text-slate-900">{lowestBalance ? `${money(lowestBalance.project.liquidity.minimumBalance)} AED` : "—"}</p><p className="mt-1 text-[11px] text-slate-600">{lowestBalance?.project.name || "لا توجد بيانات"}</p></div>
    </section>

    <section className="fs-card fs-card-blue overflow-hidden" data-testid="portfolio-escrow-liquidity-table">
      <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3"><Sparkles className="h-4 w-4 text-blue-700" /><div><h2 className="text-sm font-black text-slate-900">رصيد نهاية الشهر لكل مشروع</h2><p className="text-[11px] text-slate-500">الأحمر = عجز يتطلب قراراً؛ الأخضر أو الأزرق = رصيد متاح.</p></div></div>
      <div className="overflow-x-auto"><table className="w-full text-[11px]" style={{ minWidth: Math.max(1000, monthDates.length * 105 + 260) }}><thead><tr className="bg-slate-100 text-slate-700"><th className="sticky right-0 z-10 min-w-[220px] border-l border-slate-200 bg-slate-100 px-3 py-3 text-right">المشروع وحالة السيناريو</th>{monthDates.map((date) => <th key={date} className="min-w-[105px] border-l border-slate-200 px-2 py-3 text-center">{formatMonth(date)}</th>)}</tr></thead><tbody>{projects.map((project: any) => <tr key={project.projectId} className="border-b border-slate-100 even:bg-slate-50/70"><td className="sticky right-0 z-10 border-l border-slate-200 bg-inherit px-3 py-2.5"><div className="font-black text-slate-800">{project.name}</div><div className="mt-1 flex items-center gap-1 text-[10px]">{project.liquidity.hasDeficit ? <AlertTriangle className="h-3 w-3 text-red-600" /> : <CheckCircle2 className="h-3 w-3 text-emerald-600" />}<span className={project.liquidity.hasDeficit ? "text-red-700" : "text-emerald-700"}>{project.hasSavedPlan ? "خطة وائل محفوظة" : "سيناريو افتراضي موحد"}</span></div></td>{monthDates.map((date) => { const index = project.monthDates.indexOf(date); const value = index >= 0 ? project.balances[index] || 0 : null; return <td key={date} className={`border-l border-slate-100 px-2 py-2.5 text-center font-bold tabular-nums ${value === null ? "text-slate-300" : value < -0.5 ? "bg-red-50 text-red-700" : value > 0.5 ? "text-emerald-700" : "text-slate-400"}`}>{value === null ? "—" : money(value)}</td>; })}</tr>)}</tbody></table></div>
    </section>
  </div>;
}
