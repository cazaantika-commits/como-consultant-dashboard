/**
 * Time Distribution of Expenses Tab
 * التوزيع الزمني للمصاريف — جدول شهري لجميع بنود التكاليف
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { calculateProjectCosts } from "@/lib/projectCostsCalc";
import {
  calculatePhases,
  getTotalMonths,
  distributeExpense,
  getInvestorExpenses,
  getEscrowExpenses,
  getDefaultCustomDistribution,
  getDefaultRevenue,
  DEFAULT_DURATIONS,
  type PhaseDurations,
} from "@/lib/cashFlowEngine";

const fmt = (n: number) =>
  n === 0 ? "" : new Intl.NumberFormat("ar-AE", { maximumFractionDigits: 0 }).format(Math.round(n));

const ARABIC_MONTHS = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];

function getMonthLabel(monthNum: number, projectStart: Date): string {
  const d = new Date(projectStart);
  d.setMonth(d.getMonth() + monthNum - 1);
  return `${ARABIC_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

// PROJECT_START is now dynamic, computed from the selected project's startDate

// Phase color mapping
const PHASE_COLORS: Record<string, { header: string; cell: string }> = {
  preCon: { header: "bg-amber-600 text-white", cell: "bg-amber-50" },
  construction: { header: "bg-sky-700 text-white", cell: "bg-sky-50" },
  handover: { header: "bg-emerald-700 text-white", cell: "bg-emerald-50" },
};

export default function TimeDistributionTab({ initialProjectId }: { initialProjectId?: number | null } = {}) {
  const { isAuthenticated } = useAuth();
  const projectsQuery = trpc.projects.list.useQuery(undefined, { enabled: isAuthenticated });
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(initialProjectId ?? null);
  const selectedProject = (projectsQuery.data || []).find((p: any) => p.id === selectedProjectId);

  // Read durations from the selected project (single source of truth) with fallback to defaults
  const durations = useMemo<PhaseDurations>(() => {
    if (!selectedProject) return { ...DEFAULT_DURATIONS };
    return {
      preConMonths: selectedProject.preConMonths || DEFAULT_DURATIONS.preConMonths,
      constructionMonths: selectedProject.constructionMonths || DEFAULT_DURATIONS.constructionMonths,
      handoverMonths: (selectedProject as any).handoverMonths || DEFAULT_DURATIONS.handoverMonths,
    };
  }, [selectedProject]);
  const moQuery = trpc.marketOverview.getByProject.useQuery(selectedProjectId || 0, { enabled: !!selectedProjectId });
  const cpQuery = trpc.competitionPricing.getByProject.useQuery(selectedProjectId || 0, { enabled: !!selectedProjectId });

  const costs = useMemo(() => {
    if (!selectedProject) return null;
    return calculateProjectCosts(selectedProject, moQuery.data, cpQuery.data);
  }, [selectedProject, moQuery.data, cpQuery.data]);

  // Compute project start date from the selected project's startDate field
  const projectStart = useMemo(() => {
    if (!selectedProject || !(selectedProject as any).startDate) return new Date(2026, 3, 1); // fallback April 2026
    const [y, m] = (selectedProject as any).startDate.split('-').map(Number);
    return new Date(y, m - 1, 1);
  }, [selectedProject]);

  const phases = useMemo(() => calculatePhases(durations), [durations]);
  const totalMonths = useMemo(() => getTotalMonths(durations), [durations]);

  const defaultRevenue = useMemo(() =>
    getDefaultRevenue(phases, durations, costs?.totalRevenue),
    [phases, durations, costs]
  );

  // Payment percentages from competitionPricing (or defaults)
  const paymentPcts = useMemo(() => {
    const d = cpQuery.data;
    return {
      bookingPct: parseFloat(String(d?.paymentBookingPct ?? 10)) || 10,
      constructionPct: parseFloat(String(d?.paymentConstructionPct ?? 60)) || 60,
      handoverPct: parseFloat(String(d?.paymentHandoverPct ?? 30)) || 30,
      deferredPct: parseFloat(String(d?.paymentDeferredPct ?? 0)) || 0,
    };
  }, [cpQuery.data]);

  // Calculate incoming cash flow rows based on payment percentages
  const incomingCashFlow = useMemo(() => {
    if (!costs || !costs.totalRevenue) return null;
    const totalRev = costs.totalRevenue;
    const conRange = phases.find(p => p.type === "construction");
    const handoverRange = phases.find(p => p.type === "handover");
    const preConRange = phases.find(p => p.type === "preCon");
    if (!conRange || !handoverRange || !preConRange) return null;

    const rows: { label: string; color: string; dist: Record<number, number> }[] = [];

    // 1. Booking: distributed across sales launch (first 2 months of construction)
    if (paymentPcts.bookingPct > 0) {
      const bookingTotal = totalRev * (paymentPcts.bookingPct / 100);
      const dist: Record<number, number> = {};
      const salesStart = conRange.startMonth + 2;
      dist[salesStart] = bookingTotal * 0.6;
      dist[salesStart + 1] = bookingTotal * 0.4;
      rows.push({ label: `إيرادات الحجز (${paymentPcts.bookingPct}%)`, color: "text-violet-700", dist });
    }

    // 2. Construction payments: distributed evenly across construction phase
    if (paymentPcts.constructionPct > 0) {
      const conTotal = totalRev * (paymentPcts.constructionPct / 100);
      const dist: Record<number, number> = {};
      const monthly = conTotal / conRange.duration;
      for (let m = conRange.startMonth; m < conRange.startMonth + conRange.duration; m++) {
        dist[m] = monthly;
      }
      rows.push({ label: `إيرادات أثناء الإنشاء (${paymentPcts.constructionPct}%)`, color: "text-sky-700", dist });
    }

    // 3. Handover: distributed across handover phase
    if (paymentPcts.handoverPct > 0) {
      const handTotal = totalRev * (paymentPcts.handoverPct / 100);
      const dist: Record<number, number> = {};
      const monthly = handTotal / handoverRange.duration;
      for (let m = handoverRange.startMonth; m < handoverRange.startMonth + handoverRange.duration; m++) {
        dist[m] = monthly;
      }
      rows.push({ label: `إيرادات عند التسليم (${paymentPcts.handoverPct}%)`, color: "text-emerald-700", dist });
    }

    // 4. Deferred: 6 months after handover end
    if (paymentPcts.deferredPct > 0) {
      const deferredTotal = totalRev * (paymentPcts.deferredPct / 100);
      const dist: Record<number, number> = {};
      const deferredMonth = handoverRange.startMonth + handoverRange.duration + 6;
      dist[deferredMonth] = deferredTotal;
      rows.push({ label: `إيرادات مؤجلة (${paymentPcts.deferredPct}%)`, color: "text-rose-700", dist });
    }

    return rows;
  }, [costs, phases, paymentPcts]);

  // Build all expense items (investor + escrow)
  const allExpenses = useMemo(() => {
    const investor = getInvestorExpenses(costs || undefined);
    const escrow = getEscrowExpenses(costs || undefined);
    return [...investor, ...escrow];
  }, [costs]);

  // Calculate monthly distributions for all items
  const monthlyDists = useMemo(() => {
    return allExpenses.map(item => {
      if (item.behavior === "CUSTOM") {
        return getDefaultCustomDistribution(item.id, phases, durations, costs || undefined);
      }
      return distributeExpense(item, phases, durations, defaultRevenue);
    });
  }, [allExpenses, phases, durations, costs, defaultRevenue]);

  // Build month columns (1..totalMonths)
  const months = useMemo(() => Array.from({ length: totalMonths }, (_, i) => i + 1), [totalMonths]);

  // Column totals
  const colTotals = useMemo(() => {
    return months.map(m =>
      monthlyDists.reduce((sum, dist, idx) => {
        // For FIXED_ABSOLUTE (land items), skip — they're shown in land column
        if (allExpenses[idx].behavior === "FIXED_ABSOLUTE") return sum;
        return sum + (dist[m] || 0);
      }, 0)
    );
  }, [months, monthlyDists, allExpenses]);

  // Land items total (shown separately)
  const landItems = useMemo(() =>
    allExpenses.filter(e => e.behavior === "FIXED_ABSOLUTE"),
    [allExpenses]
  );
  const landTotal = useMemo(() =>
    landItems.reduce((s, e) => s + e.total, 0),
    [landItems]
  );

  // Grand total
  const grandTotal = useMemo(() =>
    colTotals.reduce((s, v) => s + v, 0) + landTotal,
    [colTotals, landTotal]
  );

  // Phase for each month
  const monthPhase = useMemo(() => {
    const map: Record<number, string> = {};
    for (const phase of phases) {
      if (phase.type === "land") continue;
      for (let m = phase.startMonth; m < phase.startMonth + phase.duration; m++) {
        map[m] = phase.type;
      }
    }
    return map;
  }, [phases]);

  // Phase spans for header row
  const phaseSpans = useMemo(() => {
    const spans: { phase: string; label: string; count: number }[] = [];
    let current = "";
    months.forEach(m => {
      const ph = monthPhase[m] || "preCon";
      const label = phases.find(p => p.type === ph)?.label || ph;
      if (ph !== current) {
        spans.push({ phase: ph, label, count: 1 });
        current = ph;
      } else {
        spans[spans.length - 1].count++;
      }
    });
    return spans;
  }, [months, monthPhase, phases]);

  if (!selectedProjectId) {
    return (
      <div dir="rtl" className="space-y-4">
        {!initialProjectId && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <label className="block text-sm font-bold text-gray-700 mb-2">اختر المشروع</label>
            <select
              className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
              value=""
              onChange={e => setSelectedProjectId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">— اختر مشروعاً —</option>
              {(projectsQuery.data || []).map((p: any) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        )}
        <div className="text-center py-16 text-gray-400 text-sm">اختر مشروعاً لعرض التوزيع الزمني للمصاريف</div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="space-y-4">
      {/* Project selector - only show when NOT embedded from hub */}
      {!initialProjectId && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <label className="block text-sm font-bold text-gray-700 mb-2">اختر المشروع</label>
          <select
            className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
            value={selectedProjectId || ""}
            onChange={e => setSelectedProjectId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">— اختر مشروعاً —</option>
            {(projectsQuery.data || []).map((p: any) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      )}

      {!costs && selectedProjectId && (
        <div className="text-center py-16 text-gray-400 text-sm">جاري تحميل البيانات...</div>
      )}

      {costs && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
            <h3 className="font-bold text-gray-800 text-base">التوزيع الزمني للمصاريف</h3>
            <div className="flex gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-sm bg-amber-200 inline-block"></span> ما قبل البناء
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-sm bg-sky-200 inline-block"></span> البناء
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-sm bg-emerald-200 inline-block"></span> التسليم
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="text-xs border-collapse" style={{ minWidth: `${200 + months.length * 90}px` }}>
              <thead>
                {/* Phase row */}
                <tr>
                  <th className="sticky right-0 z-20 bg-gray-800 text-white px-3 py-2 text-right min-w-[200px] border-b border-gray-600">
                    البند
                  </th>
                  <th className="bg-stone-700 text-white px-3 py-2 text-center whitespace-nowrap border-b border-stone-600">
                    الأرض
                  </th>
                  {phaseSpans.map((span, i) => (
                    <th
                      key={i}
                      colSpan={span.count}
                      className={`px-3 py-2 text-center border-b border-opacity-30 ${PHASE_COLORS[span.phase]?.header || "bg-gray-600 text-white"}`}
                    >
                      {span.label}
                    </th>
                  ))}
                  <th className="bg-gray-800 text-white px-3 py-2 text-center whitespace-nowrap border-b border-gray-600">
                    الإجمالي
                  </th>
                </tr>
                {/* Month labels row */}
                <tr>
                  <th className="sticky right-0 z-20 bg-gray-100 text-gray-600 px-3 py-2 text-right border-b border-gray-200 font-medium">
                    الشهر
                  </th>
                  <th className="bg-stone-100 text-stone-600 px-3 py-2 text-center border-b border-stone-200 font-medium whitespace-nowrap">
                    —
                  </th>
                  {months.map(m => (
                    <th
                      key={m}
                      className={`px-2 py-1.5 text-center border-b border-gray-200 font-medium whitespace-nowrap ${
                        PHASE_COLORS[monthPhase[m]]?.cell || "bg-gray-50"
                      }`}
                    >
                      {getMonthLabel(m, projectStart)}
                    </th>
                  ))}
                  <th className="bg-gray-100 text-gray-600 px-3 py-2 text-center border-b border-gray-200 font-medium">
                    الإجمالي
                  </th>
                </tr>
              </thead>

              <tbody>
                {allExpenses.map((item, idx) => {
                  const dist = monthlyDists[idx];
                  const isLand = item.behavior === "FIXED_ABSOLUTE";
                  const rowTotal = isLand
                    ? item.total
                    : months.reduce((s, m) => s + (dist[m] || 0), 0);

                  return (
                    <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="sticky right-0 z-10 bg-white px-3 py-1.5 text-right text-gray-700 font-medium border-l border-gray-100">
                        {item.name}
                        {item.table === "escrow" && (
                          <span className="mr-1 text-[9px] bg-indigo-100 text-indigo-500 px-1 py-0.5 rounded-full">ضمان</span>
                        )}
                      </td>
                      {/* Land column */}
                      <td className="px-2 py-1.5 text-center text-stone-700 font-mono bg-stone-50">
                        {isLand ? fmt(item.total) : ""}
                      </td>
                      {/* Monthly columns */}
                      {months.map(m => {
                        const val = isLand ? 0 : (dist[m] || 0);
                        const ph = monthPhase[m];
                        return (
                          <td
                            key={m}
                            className={`px-2 py-1.5 text-center font-mono ${
                              val > 0
                                ? `font-semibold ${ph === "preCon" ? "text-amber-700" : ph === "construction" ? "text-sky-700" : "text-emerald-700"}`
                                : "text-gray-300"
                            } ${PHASE_COLORS[ph]?.cell || ""}`}
                          >
                            {val > 0 ? fmt(val) : "·"}
                          </td>
                        );
                      })}
                      {/* Row total */}
                      <td className="px-3 py-1.5 text-center font-bold text-gray-800 font-mono bg-gray-50">
                        {rowTotal > 0 ? fmt(rowTotal) : "—"}
                      </td>
                    </tr>
                  );
                })}

                {/* Incoming cash flow section */}
                {incomingCashFlow && incomingCashFlow.length > 0 && (
                  <>
                    <tr className="bg-emerald-800 text-white">
                      <td colSpan={months.length + 3} className="sticky right-0 px-3 py-2 text-right font-bold text-sm">
                        ↓ التدفقات النقدية الواردة (حسب خطة السداد)
                      </td>
                    </tr>
                    {incomingCashFlow.map((row, ridx) => {
                      const rowTotal = months.reduce((s, m) => s + (row.dist[m] || 0), 0);
                      return (
                        <tr key={ridx} className="border-b border-emerald-100 bg-emerald-50/40 hover:bg-emerald-50">
                          <td className="sticky right-0 z-10 bg-emerald-50 px-3 py-1.5 text-right font-medium border-l border-emerald-100">
                            <span className={row.color}>{row.label}</span>
                          </td>
                          <td className="px-2 py-1.5 text-center text-gray-300">—</td>
                          {months.map(m => {
                            const val = row.dist[m] || 0;
                            return (
                              <td key={m} className={`px-2 py-1.5 text-center font-mono ${val > 0 ? `font-semibold ${row.color}` : "text-gray-300"}`}>
                                {val > 0 ? fmt(val) : "·"}
                              </td>
                            );
                          })}
                          <td className="px-3 py-1.5 text-center font-bold font-mono bg-emerald-50">
                            {rowTotal > 0 ? <span className={row.color}>{fmt(rowTotal)}</span> : "—"}
                          </td>
                        </tr>
                      );
                    })}
                    {/* Net cash flow row */}
                    <tr className="bg-indigo-900 text-white font-bold border-t-2 border-indigo-700">
                      <td className="sticky right-0 z-10 bg-indigo-900 px-3 py-2.5 text-right">
                        صافي التدفق الشهري
                      </td>
                      <td className="px-2 py-2.5 text-center font-mono text-indigo-200">
                        {fmt(-landTotal)}
                      </td>
                      {months.map(m => {
                        const inflow = incomingCashFlow.reduce((s, r) => s + (r.dist[m] || 0), 0);
                        const outflow = colTotals[m - 1] || 0;
                        const net = inflow - outflow;
                        return (
                          <td key={m} className={`px-2 py-2.5 text-center font-mono ${net >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                            {net !== 0 ? fmt(net) : "·"}
                          </td>
                        );
                      })}
                      <td className="px-3 py-2.5 text-center font-mono text-yellow-300">
                        {fmt(incomingCashFlow.reduce((s, r) => s + months.reduce((rs, m) => rs + (r.dist[m] || 0), 0), 0) - grandTotal)}
                      </td>
                    </tr>
                  </>
                )}

                {/* Column totals row */}
                <tr className="bg-gray-800 text-white font-bold border-t-2 border-gray-600">
                  <td className="sticky right-0 z-10 bg-gray-800 px-3 py-2.5 text-right">
                    إجمالي الشهر
                  </td>
                  <td className="px-2 py-2.5 text-center font-mono text-stone-200">
                    {fmt(landTotal)}
                  </td>
                  {months.map(m => (
                    <td key={m} className="px-2 py-2.5 text-center font-mono text-white">
                      {colTotals[m - 1] > 0 ? fmt(colTotals[m - 1]) : "·"}
                    </td>
                  ))}
                  <td className="px-3 py-2.5 text-center font-mono text-yellow-300">
                    {fmt(grandTotal)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
