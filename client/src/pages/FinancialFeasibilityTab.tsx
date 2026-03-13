/**
 * Financial Feasibility Study Tab
 * دراسة الجدوى المالية — جدول ثابت بكل بنود التكاليف والإيرادات والأرباح
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { calculateProjectCosts } from "@/lib/projectCostsCalc";
import { ChevronDown, TrendingUp, TrendingDown, DollarSign, BarChart2, Target } from "lucide-react";

const fmt = (n: number) =>
  n === 0 ? "—" : new Intl.NumberFormat("ar-AE", { maximumFractionDigits: 0 }).format(Math.round(n));

const fmtPct = (n: number) =>
  n === 0 ? "—" : `${n.toFixed(1)}%`;

// Cost line items
interface CostLine {
  id: string;
  label: string;
  group: string;
  getValue: (costs: any) => number;
  isEscrow?: boolean; // paid from escrow (not investor)
  isConstructionReplaced?: boolean; // replaced by advance+deposit in investor calc
}

const COST_LINES: CostLine[] = [
  // === الأرض ===
  { id: "land_price", label: "سعر الأرض", group: "الأرض", getValue: c => c.landPrice },
  { id: "agent_commission", label: "عمولة وسيط الأرض", group: "الأرض", getValue: c => c.agentCommissionLand },
  { id: "land_registration", label: "رسوم تسجيل الأرض (4%)", group: "الأرض", getValue: c => c.landRegistration },

  // === ما قبل البناء ===
  { id: "soil_test", label: "فحص التربة", group: "ما قبل البناء", getValue: c => c.soilTestFee },
  { id: "survey", label: "المسح الطبوغرافي", group: "ما قبل البناء", getValue: c => c.topographicSurveyFee },
  { id: "design_fee", label: "أتعاب التصميم", group: "ما قبل البناء", getValue: c => c.designFee },
  { id: "fraz_fee", label: "رسوم الفرز", group: "ما قبل البناء", getValue: c => c.separationFee },
  { id: "official_bodies", label: "رسوم الجهات الحكومية", group: "ما قبل البناء", getValue: c => c.officialBodiesFees, isEscrow: true },
  { id: "rera_project", label: "تسجيل المشروع - ريرا", group: "ما قبل البناء", getValue: c => c.reraProjectRegFee },
  { id: "rera_units", label: "تسجيل الوحدات - ريرا", group: "ما قبل البناء", getValue: c => c.reraUnitRegFee },
  { id: "developer_noc", label: "رسوم NOC للبيع", group: "ما قبل البناء", getValue: c => c.developerNocFee },
  { id: "escrow_account", label: "رسوم حساب الضمان", group: "ما قبل البناء", getValue: c => c.escrowAccountFee },
  { id: "bank_fees", label: "رسوم بنكية", group: "ما قبل البناء", getValue: c => c.bankFees },
  { id: "surveyor_fees", label: "رسوم المساح", group: "ما قبل البناء", getValue: c => c.surveyorFees },
  { id: "community_fees", label: "رسوم المجتمع", group: "ما قبل البناء", getValue: c => c.communityFees },

  // === البناء ===
  { id: "construction_cost", label: "تكلفة البناء", group: "البناء", getValue: c => c.constructionCost, isConstructionReplaced: true },
  { id: "supervision_fee", label: "أتعاب الإشراف (2%)", group: "البناء", getValue: c => c.supervisionFee, isEscrow: true },
  { id: "contingency", label: "احتياطي وطوارئ (2%)", group: "البناء", getValue: c => c.contingencies },

  // === المبيعات ===
  { id: "developer_fee", label: "أتعاب المطور (5%)", group: "المبيعات والتسويق", getValue: c => c.developerFee },
  { id: "sales_commission", label: "عمولة وكيل المبيعات (5%)", group: "المبيعات والتسويق", getValue: c => c.salesCommission, isEscrow: true },
  { id: "marketing", label: "التسويق والإعلان (2%)", group: "المبيعات والتسويق", getValue: c => c.marketingCost },
  { id: "rera_audit", label: "تقارير تدقيق ريرا", group: "المبيعات والتسويق", getValue: c => c.reraAuditReportFee, isEscrow: true },
  { id: "rera_inspection", label: "تقارير تفتيش ريرا", group: "المبيعات والتسويق", getValue: c => c.reraInspectionReportFee, isEscrow: true },
];

const GROUPS = ["الأرض", "ما قبل البناء", "البناء", "المبيعات والتسويق"];

export default function FinancialFeasibilityTab() {
  const { isAuthenticated } = useAuth();
  const projectsQuery = trpc.projects.list.useQuery(undefined, { enabled: isAuthenticated });
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);

  const selectedProject = (projectsQuery.data || []).find((p: any) => p.id === selectedProjectId);
  const moQuery = trpc.marketOverview.getByProject.useQuery(selectedProjectId || 0, { enabled: !!selectedProjectId });
  const cpQuery = trpc.competitionPricing.getByProject.useQuery(selectedProjectId || 0, { enabled: !!selectedProjectId });

  const costs = useMemo(() => {
    if (!selectedProject) return null;
    return calculateProjectCosts(selectedProject, moQuery.data, cpQuery.data);
  }, [selectedProject, moQuery.data, cpQuery.data]);

  // Calculate totals
  const totalCosts = costs?.totalCosts || 0;
  const totalRevenue = costs?.totalRevenue || 0;
  const profit = totalRevenue - totalCosts;
  const profitPct = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

  // Escrow items total
  const escrowTotal = useMemo(() => {
    if (!costs) return 0;
    return COST_LINES
      .filter(l => l.isEscrow)
      .reduce((sum, l) => sum + l.getValue(costs), 0);
  }, [costs]);

  // Required capital = total costs - escrow items - construction cost + 10% advance + 20% deposit
  const requiredCapital = useMemo(() => {
    if (!costs) return 0;
    const constructionCost = costs.constructionCost;
    const advance = constructionCost * 0.10;
    const deposit = constructionCost * 0.20;
    return totalCosts - escrowTotal - constructionCost + advance + deposit;
  }, [costs, totalCosts, escrowTotal]);

  const returnOnCapital = requiredCapital > 0 ? (profit / requiredCapital) * 100 : 0;

  // Group lines
  const groupedLines = useMemo(() => {
    return GROUPS.map(group => ({
      group,
      lines: COST_LINES.filter(l => l.group === group),
      total: costs
        ? COST_LINES.filter(l => l.group === group).reduce((s, l) => s + l.getValue(costs), 0)
        : 0,
    }));
  }, [costs]);

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(GROUPS));
  const toggleGroup = (g: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g); else next.add(g);
      return next;
    });
  };

  return (
    <div dir="rtl" className="space-y-6">
      {/* Project selector */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <label className="block text-sm font-bold text-gray-700 mb-2">اختر المشروع</label>
        <select
          className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-400"
          value={selectedProjectId || ""}
          onChange={e => setSelectedProjectId(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">— اختر مشروعاً —</option>
          {(projectsQuery.data || []).map((p: any) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {!selectedProjectId && (
        <div className="text-center py-16 text-gray-400 text-sm">اختر مشروعاً لعرض دراسة الجدوى المالية</div>
      )}

      {selectedProjectId && !costs && (
        <div className="text-center py-16 text-gray-400 text-sm">جاري تحميل البيانات...</div>
      )}

      {costs && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <KpiCard
              label="إجمالي التكاليف"
              value={fmt(totalCosts)}
              sub="درهم"
              color="rose"
              icon={<DollarSign className="w-5 h-5" />}
            />
            <KpiCard
              label="إجمالي الإيرادات"
              value={fmt(totalRevenue)}
              sub="درهم"
              color="emerald"
              icon={<TrendingUp className="w-5 h-5" />}
            />
            <KpiCard
              label="صافي الربح"
              value={fmt(profit)}
              sub={`${fmtPct(profitPct)} من الإيرادات`}
              color={profit >= 0 ? "blue" : "red"}
              icon={<BarChart2 className="w-5 h-5" />}
            />
            <KpiCard
              label="رأس المال المطلوب"
              value={fmt(requiredCapital)}
              sub="مصاريف المستثمر"
              color="amber"
              icon={<Target className="w-5 h-5" />}
            />
            <KpiCard
              label="نسبة العائد على رأس المال"
              value={fmtPct(returnOnCapital)}
              sub="ربح ÷ رأس المال"
              color="violet"
              icon={<TrendingUp className="w-5 h-5" />}
            />
          </div>

          {/* Cost Table */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
              <h3 className="font-bold text-gray-800 text-base">تفصيل التكاليف</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-right px-5 py-3 font-semibold text-gray-600 w-1/2">البند</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-600">المبلغ (درهم)</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-600">% من التكاليف</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-600">المصدر</th>
                  </tr>
                </thead>
                {groupedLines.map(({ group, lines, total }) => (
                    <tbody key={`group-${group}`}>
                      {/* Group header */}
                      <tr
                        key={`header-${group}`}
                        className="bg-violet-50 cursor-pointer hover:bg-violet-100 transition-colors"
                        onClick={() => toggleGroup(group)}
                      >
                        <td className="px-5 py-2.5 font-bold text-violet-800 flex items-center gap-2">
                          <ChevronDown
                            className={`w-4 h-4 transition-transform ${expandedGroups.has(group) ? "" : "-rotate-90"}`}
                          />
                          {group}
                        </td>
                        <td className="px-4 py-2.5 text-center font-bold text-violet-800">
                          {fmt(total)}
                        </td>
                        <td className="px-4 py-2.5 text-center text-violet-600">
                          {totalCosts > 0 ? fmtPct((total / totalCosts) * 100) : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-center text-violet-500 text-xs">—</td>
                      </tr>

                      {/* Group lines */}
                      {expandedGroups.has(group) && lines.map(line => {
                        const val = line.getValue(costs);
                        return (
                          <tr key={line.id} className="border-b border-gray-50 hover:bg-gray-50">
                            <td className="px-5 py-2 pr-10 text-gray-700">
                              {line.label}
                              {line.isEscrow && (
                                <span className="mr-2 text-[10px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full">ضمان</span>
                              )}
                              {line.isConstructionReplaced && (
                                <span className="mr-2 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">مستبدل في رأس المال</span>
                              )}
                            </td>
                            <td className="px-4 py-2 text-center text-gray-800 font-mono">
                              {fmt(val)}
                            </td>
                            <td className="px-4 py-2 text-center text-gray-500">
                              {totalCosts > 0 && val > 0 ? fmtPct((val / totalCosts) * 100) : "—"}
                            </td>
                            <td className="px-4 py-2 text-center">
                              {line.isEscrow ? (
                                <span className="text-[10px] bg-indigo-50 text-indigo-500 px-2 py-0.5 rounded-full">حساب الضمان</span>
                              ) : (
                                <span className="text-[10px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full">المستثمر</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  ))}
                  <tbody>
                  {/* Total costs row */}
                  <tr className="bg-rose-50 border-t-2 border-rose-200">
                    <td className="px-5 py-3 font-bold text-rose-800">إجمالي التكاليف</td>
                    <td className="px-4 py-3 text-center font-bold text-rose-800 font-mono">{fmt(totalCosts)}</td>
                    <td className="px-4 py-3 text-center font-bold text-rose-600">100%</td>
                    <td className="px-4 py-3"></td>
                  </tr>
                  </tbody>
              </table>
            </div>
          </div>

          {/* Summary Table */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
              <h3 className="font-bold text-gray-800 text-base">ملخص الجدوى المالية</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <tbody>
                  <SummaryRow label="إجمالي التكاليف" value={fmt(totalCosts)} color="rose" />
                  <SummaryRow label="إجمالي الإيرادات" value={fmt(totalRevenue)} color="emerald" />
                  <SummaryRow label="صافي الربح" value={fmt(profit)} color={profit >= 0 ? "blue" : "red"} />
                  <SummaryRow label="نسبة الربح من الإيرادات" value={fmtPct(profitPct)} color="blue" />
                  <tr className="border-t-2 border-dashed border-gray-200">
                    <td colSpan={2} className="py-1"></td>
                  </tr>
                  <SummaryRow
                    label="بنود حساب الضمان (لا تُحتسب في رأس المال)"
                    value={fmt(escrowTotal)}
                    color="indigo"
                    sub="دفعات المقاول 85% + أتعاب الإشراف + عمولة المبيعات + رسوم ريرا + رسوم حكومية"
                  />
                  <SummaryRow
                    label="تكلفة البناء الكاملة (مستبدلة)"
                    value={fmt(costs.constructionCost)}
                    color="gray"
                    sub="تُستبدل بـ: 10% مقدمة + 20% إيداع ضمان"
                  />
                  <SummaryRow
                    label="دفعة مقدمة للمقاول (10%)"
                    value={fmt(costs.constructionCost * 0.10)}
                    color="amber"
                  />
                  <SummaryRow
                    label="إيداع حساب الضمان (20%)"
                    value={fmt(costs.constructionCost * 0.20)}
                    color="amber"
                  />
                  <tr className="border-t-2 border-amber-200 bg-amber-50">
                    <td className="px-5 py-3 font-bold text-amber-800">رأس المال المطلوب من المستثمر</td>
                    <td className="px-5 py-3 text-left font-bold text-amber-800 font-mono">{fmt(requiredCapital)}</td>
                  </tr>
                  <tr className="bg-violet-50">
                    <td className="px-5 py-3 font-bold text-violet-800">نسبة العائد على رأس المال</td>
                    <td className="px-5 py-3 text-left font-bold text-violet-800">{fmtPct(returnOnCapital)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function KpiCard({ label, value, sub, color, icon }: {
  label: string; value: string; sub?: string; color: string; icon?: React.ReactNode;
}) {
  const colors: Record<string, string> = {
    rose: "bg-rose-50 border-rose-200 text-rose-700",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-700",
    blue: "bg-blue-50 border-blue-200 text-blue-700",
    red: "bg-red-50 border-red-200 text-red-700",
    amber: "bg-amber-50 border-amber-200 text-amber-700",
    violet: "bg-violet-50 border-violet-200 text-violet-700",
    gray: "bg-gray-50 border-gray-200 text-gray-700",
    indigo: "bg-indigo-50 border-indigo-200 text-indigo-700",
  };
  return (
    <div className={`rounded-2xl border p-4 ${colors[color] || colors.gray}`}>
      <div className="flex items-center gap-2 mb-2 opacity-70">{icon}<span className="text-xs font-medium">{label}</span></div>
      <div className="text-xl font-bold font-mono">{value}</div>
      {sub && <div className="text-[11px] mt-1 opacity-60">{sub}</div>}
    </div>
  );
}

function SummaryRow({ label, value, color, sub }: {
  label: string; value: string; color: string; sub?: string;
}) {
  const colors: Record<string, string> = {
    rose: "text-rose-700", emerald: "text-emerald-700", blue: "text-blue-700",
    red: "text-red-700", amber: "text-amber-700", violet: "text-violet-700",
    gray: "text-gray-500", indigo: "text-indigo-700",
  };
  return (
    <tr className="border-b border-gray-50 hover:bg-gray-50">
      <td className="px-5 py-2.5 text-gray-700">
        {label}
        {sub && <div className="text-[10px] text-gray-400 mt-0.5">{sub}</div>}
      </td>
      <td className={`px-5 py-2.5 text-left font-mono font-semibold ${colors[color] || ""}`}>{value}</td>
    </tr>
  );
}
