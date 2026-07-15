import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Landmark, PenTool, ShieldCheck, HardHat } from "lucide-react";
import {
  PROJECT_INPUTS,
  RATES,
  calculateProjectFormulas,
  calculatePricingFormulas,
  dbProjectToInputs,
  dbProjectToRates,
  type ProjectInputs,
  type ProjectRates,
} from "@/lib/projectData";
import { useProjectContext } from "@/contexts/ProjectContext";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

// ═══════════════════════════════════════════
// FORMAT HELPERS
// ═══════════════════════════════════════════
function fmt(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} مليون`;
  if (Math.abs(n) >= 1_000) return n.toLocaleString("en-US");
  return n.toString();
}
function fmtFull(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

type Phase = "land" | "design" | "offplan" | "construction" | "post";

interface CostItem {
  label: string;
  totalCost: number;
  investorAmount: number;
  funder: "investor" | "escrow" | "split";
  phase: Phase;
  paid?: boolean;
}

export default function InvestorCapitalPlanPage() {
  const { user } = useAuth();
  const { selectedProjectId } = useProjectContext();
  const projectQuery = trpc.projects.getById.useQuery(selectedProjectId!, { enabled: !!selectedProjectId && !!user });

  const data = useMemo(() => {
    // ═══ ALL DATA FROM DB (same source as ProjectCard) ═══
    const i2: ProjectInputs = projectQuery.data ? dbProjectToInputs(projectQuery.data) : PROJECT_INPUTS;
    const r2: ProjectRates = projectQuery.data ? dbProjectToRates(projectQuery.data) : RATES;
    const projectFormulas = calculateProjectFormulas(i2, r2);
    const p = projectQuery.data as any;
    const defAreas = { res1: 750, res2: 1300, res3: 1650, retS: 850, retM: 1200, retL: 1800, offS: 1200, offM: 2000, offL: 3500 };
    const defPrices = { res1: 1550, res2: 1500, res3: 1450, retS: 3000, retM: 2500, retL: 2000, offS: 1900, offM: 1800, offL: 1700 };
    const hasSavedCounts = p && [p.residential1brCount, p.residential2brCount, p.residential3brCount, p.retailSmallCount, p.retailMediumCount, p.retailLargeCount, p.officeSmallCount, p.officeMediumCount, p.officeLargeCount].some((v: any) => Number(v) > 0);
    let c1 = Number(p?.residential1brCount) || 0, c2 = Number(p?.residential2brCount) || 0, c3 = Number(p?.residential3brCount) || 0;
    let cRS = Number(p?.retailSmallCount) || 0, cRM = Number(p?.retailMediumCount) || 0, cRL = Number(p?.retailLargeCount) || 0;
    let cOS = Number(p?.officeSmallCount) || 0, cOM = Number(p?.officeMediumCount) || 0, cOL = Number(p?.officeLargeCount) || 0;
    if (!hasSavedCounts) {
      const sellRes = i2.gfaResidential * i2.efficiencyResidential;
      const sellRet = i2.gfaRetail * i2.efficiencyRetail;
      const sellOff = i2.gfaOffice * i2.efficiencyOffice;
      if (sellRes > 0) { c1 = Math.round(sellRes * 0.4 / defAreas.res1); c2 = Math.round(sellRes * 0.4 / defAreas.res2); c3 = Math.round(sellRes * 0.2 / defAreas.res3); }
      if (sellRet > 0) { cRS = Math.round(sellRet * 0.4 / defAreas.retS); cRM = Math.round(sellRet * 0.4 / defAreas.retM); cRL = Math.round(sellRet * 0.2 / defAreas.retL); }
      if (sellOff > 0) { cOS = Math.round(sellOff * 0.4 / defAreas.offS); cOM = Math.round(sellOff * 0.4 / defAreas.offM); cOL = Math.round(sellOff * 0.2 / defAreas.offL); }
    }
    const pricingUnits = [
      { name: "غرفة وصالة", category: "residential" as const, area: Number(p?.residential1brArea) || defAreas.res1, price: Number(p?.residential1brPrice) || defPrices.res1, count: c1 },
      { name: "غرفتين وصالة", category: "residential" as const, area: Number(p?.residential2brArea) || defAreas.res2, price: Number(p?.residential2brPrice) || defPrices.res2, count: c2 },
      { name: "ثلاث غرف وصالة", category: "residential" as const, area: Number(p?.residential3brArea) || defAreas.res3, price: Number(p?.residential3brPrice) || defPrices.res3, count: c3 },
      { name: "تجزئة / صغير", category: "retail" as const, area: Number(p?.retailSmallArea) || defAreas.retS, price: Number(p?.retailSmallPrice) || defPrices.retS, count: cRS },
      { name: "تجزئة / متوسط", category: "retail" as const, area: Number(p?.retailMediumArea) || defAreas.retM, price: Number(p?.retailMediumPrice) || defPrices.retM, count: cRM },
      { name: "تجزئة / كبير", category: "retail" as const, area: Number(p?.retailLargeArea) || defAreas.retL, price: Number(p?.retailLargePrice) || defPrices.retL, count: cRL },
      { name: "مكاتب / صغير", category: "office" as const, area: Number(p?.officeSmallArea) || defAreas.offS, price: Number(p?.officeSmallPrice) || defPrices.offS, count: cOS },
      { name: "مكاتب / متوسط", category: "office" as const, area: Number(p?.officeMediumArea) || defAreas.offM, price: Number(p?.officeMediumPrice) || defPrices.offM, count: cOM },
      { name: "مكاتب / كبير", category: "office" as const, area: Number(p?.officeLargeArea) || defAreas.offL, price: Number(p?.officeLargePrice) || defPrices.offL, count: cOL },
    ];
    const pricingFormulas = calculatePricingFormulas(pricingUnits);

    const { landPrice, landRegistration, landBroker, constructionCost, gfaTotal } = projectFormulas;
    const { totalRevenue, totalUnits } = pricingFormulas;

    // Build cost items array
    const items: CostItem[] = [
      // === SECTION 1: LAND ===
      { label: "سعر الأرض", totalCost: landPrice, investorAmount: landPrice, funder: "investor", phase: "land", paid: true },
      { label: "عمولة وسيط الأرض (1%)", totalCost: landBroker, investorAmount: landBroker, funder: "investor", phase: "land", paid: true },
      { label: "رسوم تسجيل الأرض (4%)", totalCost: landRegistration, investorAmount: landRegistration, funder: "investor", phase: "land", paid: true },

      // === SECTION 2: DESIGN & PERMITS ===
      { label: "رسوم الجهات الحكومية (10%)", totalCost: PROJECT_INPUTS.govFeesTotal, investorAmount: PROJECT_INPUTS.govFeesTotal * RATES.govFeesInvestorShare, funder: "split", phase: "design" },
      { label: "فحص تربة", totalCost: PROJECT_INPUTS.soilTest, investorAmount: PROJECT_INPUTS.soilTest, funder: "investor", phase: "design" },
      { label: "المسح الطبوغرافي", totalCost: PROJECT_INPUTS.topography, investorAmount: PROJECT_INPUTS.topography, funder: "investor", phase: "design" },
      { label: "أتعاب الاستشاري — التصاميم (1.8%)", totalCost: constructionCost * RATES.designFee, investorAmount: constructionCost * RATES.designFee, funder: "investor", phase: "design" },
      { label: "أتعاب المطور — التصاميم (1%)", totalCost: totalRevenue * RATES.developerFeeDesign, investorAmount: totalRevenue * RATES.developerFeeDesign, funder: "investor", phase: "design" },

      // === SECTION 3: RERA & OFFPLAN SALES ===
      { label: "أتعاب المطور — أوف بلان (1%)", totalCost: totalRevenue * RATES.developerFeeOffplan, investorAmount: totalRevenue * RATES.developerFeeOffplan, funder: "investor", phase: "offplan" },
      { label: "رسوم الفرز (40 د/قدم²)", totalCost: gfaTotal * RATES.sortingFeePerSqft, investorAmount: gfaTotal * RATES.sortingFeePerSqft, funder: "investor", phase: "offplan" },
      { label: "تسجيل بيع على الخارطة — ريرا", totalCost: PROJECT_INPUTS.reraProjectReg, investorAmount: PROJECT_INPUTS.reraProjectReg, funder: "investor", phase: "offplan" },
      { label: "تسجيل الوحدات — ريرا", totalCost: totalUnits * RATES.reraUnitFee, investorAmount: totalUnits * RATES.reraUnitFee, funder: "investor", phase: "offplan" },
      { label: "رسوم NOC للبيع", totalCost: PROJECT_INPUTS.nocSale, investorAmount: PROJECT_INPUTS.nocSale, funder: "investor", phase: "offplan" },
      { label: "رسوم حساب الضمان", totalCost: PROJECT_INPUTS.escrowAccountFee, investorAmount: PROJECT_INPUTS.escrowAccountFee, funder: "investor", phase: "offplan" },
      { label: "رسوم المجتمع (25%)", totalCost: PROJECT_INPUTS.communityFee, investorAmount: PROJECT_INPUTS.communityFee * RATES.communityOffplanShare, funder: "investor", phase: "offplan" },
      { label: "التسويق والإعلان — أوف بلان (25%)", totalCost: totalRevenue * RATES.marketingRate * RATES.marketingOffplanShare, investorAmount: totalRevenue * RATES.marketingRate * RATES.marketingOffplanShare, funder: "investor", phase: "offplan" },
      { label: "إيداع حساب الضمان (20%)", totalCost: constructionCost * RATES.escrowDeposit, investorAmount: constructionCost * RATES.escrowDeposit, funder: "investor", phase: "offplan" },

      // === SECTION 4: CONSTRUCTION (Investor share only) ===
      { label: "دفعة مقدمة للمقاول (10%)", totalCost: constructionCost * RATES.advancePayment, investorAmount: constructionCost * RATES.advancePayment, funder: "investor", phase: "construction" },
      { label: "احتياطي وطوارئ (2%)", totalCost: constructionCost * RATES.contingency, investorAmount: constructionCost * RATES.contingency, funder: "investor", phase: "construction" },
      { label: "رسوم بنكية", totalCost: PROJECT_INPUTS.bankFees, investorAmount: PROJECT_INPUTS.bankFees, funder: "investor", phase: "construction" },
      { label: "رسوم الجهات الحكومية (90%)", totalCost: PROJECT_INPUTS.govFeesTotal * RATES.govFeesEscrowShare, investorAmount: 0, funder: "escrow", phase: "construction" },
      { label: "دفعات المقاول (70% — من الضمان)", totalCost: constructionCost * RATES.constructionEscrowShare, investorAmount: 0, funder: "escrow", phase: "construction" },
      { label: "رسوم المجتمع (75%)", totalCost: PROJECT_INPUTS.communityFee * RATES.communityConstructionShare, investorAmount: PROJECT_INPUTS.communityFee * RATES.communityConstructionShare, funder: "investor", phase: "construction" },
      { label: "أتعاب المطور — الإشراف (3%)", totalCost: totalRevenue * RATES.developerFeeSupervision, investorAmount: totalRevenue * RATES.developerFeeSupervision, funder: "investor", phase: "construction" },
      { label: "أتعاب الاستشاري — الإشراف", totalCost: constructionCost * RATES.supervisionFee, investorAmount: 0, funder: "escrow", phase: "construction" },
      { label: "رسوم المساح", totalCost: PROJECT_INPUTS.surveyorFee, investorAmount: 0, funder: "escrow", phase: "construction" },
      { label: "تقرير مدقق ريرا", totalCost: PROJECT_INPUTS.reraAuditorReport, investorAmount: 0, funder: "escrow", phase: "construction" },
      { label: "تقرير فحص ريرا", totalCost: PROJECT_INPUTS.reraInspection, investorAmount: 0, funder: "escrow", phase: "construction" },
      { label: "التسويق والإعلان — الإنشاء (75%)", totalCost: totalRevenue * RATES.marketingRate * RATES.marketingConstructionShare, investorAmount: totalRevenue * RATES.marketingRate * RATES.marketingConstructionShare, funder: "investor", phase: "construction" },
      { label: "عمولة وكيل المبيعات (5%)", totalCost: totalRevenue * RATES.salesCommission, investorAmount: 0, funder: "escrow", phase: "construction" },
    ];

    // Totals
    const totalCosts = items.reduce((s, i) => s + i.totalCost, 0);
    const totalInvestor = items.reduce((s, i) => s + i.investorAmount, 0);
    const totalPaid = items.filter(i => i.paid).reduce((s, i) => s + i.investorAmount, 0);
    const totalUnpaid = totalInvestor - totalPaid;

    // Phase totals
    const phases: Record<Phase, { totalCost: number; investorAmount: number }> = {
      land: { totalCost: 0, investorAmount: 0 },
      design: { totalCost: 0, investorAmount: 0 },
      offplan: { totalCost: 0, investorAmount: 0 },
      construction: { totalCost: 0, investorAmount: 0 },
      post: { totalCost: 0, investorAmount: 0 },
    };
    items.forEach(i => {
      phases[i.phase].totalCost += i.totalCost;
      phases[i.phase].investorAmount += i.investorAmount;
    });

    return { items, totalCosts, totalInvestor, totalPaid, totalUnpaid, phases };
  }, [projectQuery.data]);

  const sections = [
    { title: "القسم الأول — المبالغ المدفوعة (الأرض)", icon: Landmark, phase: "land" as Phase },
    { title: "القسم الثاني — التصاميم ورخصة البناء", icon: PenTool, phase: "design" as Phase },
    { title: "القسم الثالث — ريرا والبيع أوف بلان", icon: ShieldCheck, phase: "offplan" as Phase },
    { title: "القسم الرابع — الإنشاء (حصة المستثمر فقط)", icon: HardHat, phase: "construction" as Phase },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-6" dir="rtl">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-white flex items-center justify-center gap-3">
            <Building2 className="w-7 h-7 text-blue-400" />
            خطة رأس مال المستثمر — سيناريو 1
          </h1>
          <p className="text-slate-400 text-sm">{PROJECT_INPUTS.name}</p>
          <p className="text-slate-500 text-xs">أوف بلان — إيداع 20% في حساب الضمان</p>
          <div className="flex justify-center gap-4 mt-3">
            <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/40 px-3 py-1">
              تصاميم: {PROJECT_INPUTS.designDuration} شهور
            </Badge>
            <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 px-3 py-1">
              إنشاء: {PROJECT_INPUTS.constructionDuration} شهر
            </Badge>
            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 px-3 py-1">
              الإجمالي: {PROJECT_INPUTS.designDuration + PROJECT_INPUTS.constructionDuration} شهر
            </Badge>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <SummaryBox label="إجمالي التكاليف" value={data.totalCosts} color="slate" />
          <SummaryBox label="إجمالي المستثمر" value={data.totalInvestor} color="blue" />
          <SummaryBox label="مدفوع" value={data.totalPaid} color="green" />
          <SummaryBox label="غير مدفوع" value={data.totalUnpaid} color="red" />
        </div>

        {/* Main Table */}
        <Card className="bg-slate-800/50 border-slate-700/50 backdrop-blur">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-white">تفصيل المبالغ</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-slate-600">
                    <th className="text-right py-3 px-3 text-slate-300 font-semibold">البند</th>
                    <th className="text-left py-3 px-3 text-slate-300 font-semibold">إجمالي التكاليف</th>
                    <th className="text-left py-3 px-3 text-slate-300 font-semibold">إجمالي المستثمر</th>
                    <th className="text-left py-3 px-3 text-slate-300 font-semibold">مدفوع</th>
                    <th className="text-left py-3 px-3 text-slate-300 font-semibold">غير مدفوع</th>
                  </tr>
                </thead>
                <tbody>
                  {sections.map(section => {
                    const sectionItems = data.items.filter(i => i.phase === section.phase);
                    const sectionTotalCost = sectionItems.reduce((s, i) => s + i.totalCost, 0);
                    const sectionInvestor = sectionItems.reduce((s, i) => s + i.investorAmount, 0);
                    const sectionPaid = sectionItems.filter(i => i.paid).reduce((s, i) => s + i.investorAmount, 0);
                    const sectionUnpaid = sectionInvestor - sectionPaid;

                    return (
                      <React.Fragment key={section.phase}>
                        <tr className="bg-slate-700/30">
                          <td colSpan={5} className="py-2.5 px-3 text-slate-200 font-semibold text-xs">
                            <div className="flex items-center gap-2">
                              <section.icon className="w-4 h-4 text-slate-400" />
                              {section.title}
                            </div>
                          </td>
                        </tr>
                        {sectionItems.map((item, idx) => (
                          <tr key={idx} className="border-b border-slate-700/30 hover:bg-slate-700/10">
                            <td className="py-2.5 px-3 text-slate-200">{item.label}</td>
                            <td className="py-2.5 px-3 text-left font-mono text-slate-300">{fmtFull(item.totalCost)}</td>
                            <td className="py-2.5 px-3 text-left font-mono text-blue-300">
                              {item.investorAmount > 0 ? fmtFull(item.investorAmount) : <span className="text-slate-600">من الضمان</span>}
                            </td>
                            <td className="py-2.5 px-3 text-left font-mono text-emerald-300">
                              {item.paid ? fmtFull(item.investorAmount) : "—"}
                            </td>
                            <td className="py-2.5 px-3 text-left font-mono text-red-300">
                              {!item.paid && item.investorAmount > 0 ? fmtFull(item.investorAmount) : "—"}
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-slate-700/20 border-b border-slate-600">
                          <td className="py-2 px-3 text-slate-400 font-medium text-xs">إجمالي القسم</td>
                          <td className="py-2 px-3 text-left font-mono text-slate-400 text-xs">{fmtFull(sectionTotalCost)}</td>
                          <td className="py-2 px-3 text-left font-mono text-blue-400 text-xs">{fmtFull(sectionInvestor)}</td>
                          <td className="py-2 px-3 text-left font-mono text-emerald-400 text-xs">{fmtFull(sectionPaid)}</td>
                          <td className="py-2 px-3 text-left font-mono text-red-400 text-xs">{fmtFull(sectionUnpaid)}</td>
                        </tr>
                      </React.Fragment>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-500 bg-slate-700/40">
                    <td className="py-3 px-3 text-white font-bold">الإجمالي</td>
                    <td className="py-3 px-3 text-left font-mono text-white font-bold">{fmtFull(data.totalCosts)}</td>
                    <td className="py-3 px-3 text-left font-mono text-blue-200 font-bold">{fmtFull(data.totalInvestor)}</td>
                    <td className="py-3 px-3 text-left font-mono text-emerald-200 font-bold">{fmtFull(data.totalPaid)}</td>
                    <td className="py-3 px-3 text-left font-mono text-red-200 font-bold">{fmtFull(data.totalUnpaid)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Timeline Distribution */}
        <Card className="bg-slate-800/50 border-slate-700/50 backdrop-blur">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-white">التوزيع الزمني — متى يدفع المستثمر؟</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <PhaseBar label="قبل المشروع — الأرض" amount={data.phases.land.investorAmount} total={data.totalInvestor} color="emerald" duration="مدفوع مسبقاً" />
              <PhaseBar label={`مرحلة التصاميم (${PROJECT_INPUTS.designDuration} شهور)`} amount={data.phases.design.investorAmount} total={data.totalInvestor} color="blue" duration={`الشهر 1 — ${PROJECT_INPUTS.designDuration}`} />
              <PhaseBar label="ما قبل الإنشاء — ريرا وأوف بلان" amount={data.phases.offplan.investorAmount} total={data.totalInvestor} color="purple" duration={`الشهر ${PROJECT_INPUTS.designDuration}`} />
              <PhaseBar label={`مرحلة الإنشاء (${PROJECT_INPUTS.constructionDuration} شهر)`} amount={data.phases.construction.investorAmount} total={data.totalInvestor} color="amber" duration={`الشهر ${PROJECT_INPUTS.designDuration + 1} — ${PROJECT_INPUTS.designDuration + PROJECT_INPUTS.constructionDuration}`} />
            </div>

            <div className="mt-6 pt-4 border-t border-slate-700">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                <div className="bg-emerald-500/10 rounded-lg p-3 border border-emerald-500/20">
                  <div className="text-xs text-slate-400">الأرض</div>
                  <div className="text-emerald-300 font-mono font-bold">{fmt(data.phases.land.investorAmount)}</div>
                </div>
                <div className="bg-blue-500/10 rounded-lg p-3 border border-blue-500/20">
                  <div className="text-xs text-slate-400">التصاميم</div>
                  <div className="text-blue-300 font-mono font-bold">{fmt(data.phases.design.investorAmount)}</div>
                </div>
                <div className="bg-purple-500/10 rounded-lg p-3 border border-purple-500/20">
                  <div className="text-xs text-slate-400">ريرا وأوف بلان</div>
                  <div className="text-purple-300 font-mono font-bold">{fmt(data.phases.offplan.investorAmount)}</div>
                </div>
                <div className="bg-amber-500/10 rounded-lg p-3 border border-amber-500/20">
                  <div className="text-xs text-slate-400">الإنشاء</div>
                  <div className="text-amber-300 font-mono font-bold">{fmt(data.phases.construction.investorAmount)}</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════

function SummaryBox({ label, value, color }: { label: string; value: number; color: string }) {
  const colorMap: Record<string, string> = {
    slate: "from-slate-500/20 to-slate-600/10 border-slate-500/30 text-slate-200",
    blue: "from-blue-500/20 to-blue-600/10 border-blue-500/30 text-blue-300",
    green: "from-emerald-500/20 to-emerald-600/10 border-emerald-500/30 text-emerald-300",
    red: "from-red-500/20 to-red-600/10 border-red-500/30 text-red-300",
  };
  return (
    <div className={`rounded-xl border bg-gradient-to-br ${colorMap[color]} p-4`}>
      <div className="text-xs text-slate-400 mb-1">{label}</div>
      <div className={`text-lg font-bold font-mono ${colorMap[color].split(" ").pop()}`}>
        {fmtFull(value)}
      </div>
      <div className="text-[10px] text-slate-500 mt-1">درهم</div>
    </div>
  );
}

function PhaseBar({ label, amount, total, color, duration }: {
  label: string; amount: number; total: number; color: string; duration: string;
}) {
  const pct = total > 0 ? (amount / total) * 100 : 0;
  const barColors: Record<string, string> = {
    emerald: "bg-emerald-500",
    blue: "bg-blue-500",
    purple: "bg-purple-500",
    amber: "bg-amber-500",
  };
  const textColors: Record<string, string> = {
    emerald: "text-emerald-300",
    blue: "text-blue-300",
    purple: "text-purple-300",
    amber: "text-amber-300",
  };

  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-sm text-slate-200">{label}</span>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">{duration}</span>
          <span className={`text-sm font-mono font-bold ${textColors[color]}`}>{fmtFull(amount)}</span>
          <span className="text-xs text-slate-500">({pct.toFixed(1)}%)</span>
        </div>
      </div>
      <div className="w-full bg-slate-700/50 rounded-full h-3">
        <div className={`${barColors[color]} h-3 rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
