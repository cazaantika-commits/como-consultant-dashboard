import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Building2, MapPin, Ruler, Calendar, DollarSign, Percent,
  Calculator, Landmark, FileText, ShieldCheck, Hammer,
  TrendingUp, Users, Banknote, ArrowRight,
} from "lucide-react";
import {
  PROJECT_INPUTS,
  RATES,
  PRICING_DEFAULTS,
  calculateProjectFormulas,
  calculatePricingFormulas,
  calculateCosts,
} from "@/lib/projectData";

// ═══════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════
type FieldType = "input" | "formula";
type FundingSource = "investor" | "escrow" | "none";

interface ProjectField {
  label: string;
  value: number | string;
  type: FieldType;
  formula?: string;
  unit?: string;
  fundingSource?: FundingSource;
  investorAmount?: number;
  escrowAmount?: number;
  rateLabel?: string;
  baseLabel?: string;
}

// ═══════════════════════════════════════════
// FORMAT HELPERS
// ═══════════════════════════════════════════
function fmt(n: number): string {
  if (Math.abs(n) >= 1_000_000) {
    return (n / 1_000_000).toLocaleString("ar-AE", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " مليون";
  }
  if (Math.abs(n) >= 1_000) {
    return Math.round(n).toLocaleString("ar-AE");
  }
  return n.toLocaleString("ar-AE");
}

function fmtFull(n: number): string {
  return Math.round(n).toLocaleString("ar-AE");
}

// ═══════════════════════════════════════════
// المصدر: projectData.ts (مثل الإكسل — غيّر هناك = يتغير هنا)
// ═══════════════════════════════════════════

export default function ProjectCardOffplanPage() {
  // === FORMULAS — كلها من projectData.ts ===
  const calc = useMemo(() => {
    const i = PROJECT_INPUTS;
    const projectFormulas = calculateProjectFormulas();
    const { gfaTotal, sellableResidential, sellableRetail, sellableOffice, landPrice, landRegistration, landBroker, constructionCost } = projectFormulas;

    // الإيرادات من التسعير
    const pricingUnits = PRICING_DEFAULTS.map(u => ({
      name: u.name, category: u.category, area: u.defaultArea, price: u.defaultPrice, count: u.defaultCount,
    }));
    const pricingFormulas = calculatePricingFormulas(pricingUnits);
    const { revenueResidential, revenueRetail, revenueOffice, totalRevenue, totalUnits, totalParking } = pricingFormulas;

    // سعر القدم = فورمولا
    const pricePerSqftResidential = sellableResidential > 0 ? revenueResidential / sellableResidential : 0;
    const pricePerSqftRetail = sellableRetail > 0 ? revenueRetail / sellableRetail : 0;
    const pricePerSqftOffice = sellableOffice > 0 ? revenueOffice / sellableOffice : 0;

    // التكاليف — نفس المعادلة بالضبط
    const costs = calculateCosts(projectFormulas, pricingFormulas);

    return {
      gfaTotal, sellableResidential, sellableRetail, sellableOffice,
      revenueResidential, revenueRetail, revenueOffice, totalRevenue,
      pricePerSqftResidential, pricePerSqftRetail, pricePerSqftOffice,
      unitCount: totalUnits, totalParking,
      constructionCost, landPrice, landRegistration, landBroker,
      designFee: costs.designFee,
      supervisionFee: costs.supervisionFee,
      sortingFee: costs.sortingFee,
      reraUnits: costs.reraUnits,
      salesCommission: costs.salesCommission,
      marketing: costs.marketing,
      developerFee: costs.developerFee,
      constructionInvestor: costs.constructionInvestor,
      constructionEscrow: costs.constructionEscrow,
      govFeesInvestor: costs.govFeesInvestor,
      govFeesEscrow: costs.govFeesEscrow,
      totalInvestor: costs.totalInvestor,
      totalEscrow: costs.totalEscrow,
      totalCosts: costs.totalCosts,
      profit: costs.profit,
      margin: costs.margin,
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-6" dir="rtl">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-8">
        <div className="flex items-center gap-4 mb-2">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">بطاقة المشروع — أوف بلان</h1>
            <p className="text-slate-400 text-sm">{PROJECT_INPUTS.name}</p>
          </div>
        </div>
        <div className="flex gap-3 mt-4">
          <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 px-3 py-1">
            <Calendar className="w-3 h-3 ml-1" /> تصاميم: {PROJECT_INPUTS.designDuration} شهور
          </Badge>
          <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 px-3 py-1">
            <Hammer className="w-3 h-3 ml-1" /> إنشاء: {PROJECT_INPUTS.constructionDuration} شهر
          </Badge>
          <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 px-3 py-1">
            <Calendar className="w-3 h-3 ml-1" /> الإجمالي: {PROJECT_INPUTS.designDuration + PROJECT_INPUTS.constructionDuration} شهر
          </Badge>
        </div>
      </div>

      <div className="max-w-6xl mx-auto space-y-6">

        {/* ═══════════════════════════════════════════ */}
        {/* SECTION 1: PROJECT BASICS */}
        {/* ═══════════════════════════════════════════ */}
        <Card className="bg-slate-800/50 border-slate-700/50 backdrop-blur">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <MapPin className="w-5 h-5 text-amber-400" />
              البيانات الأساسية
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-right py-2 px-3 text-slate-400 font-medium">البند</th>
                    <th className="text-center py-2 px-3 text-slate-400 font-medium w-24">النوع</th>
                    <th className="text-left py-2 px-3 text-slate-400 font-medium">القيمة</th>
                    <th className="text-left py-2 px-3 text-slate-400 font-medium">المعادلة / المصدر</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  <FieldRow label="اسم المشروع" value={PROJECT_INPUTS.name} type="input" />
                  <FieldRow label="مساحة الأرض (قدم²)" value={fmtFull(PROJECT_INPUTS.landArea)} type="input" />
                  <FieldRow label="مساحة البناء BUA (قدم²)" value={fmtFull(PROJECT_INPUTS.bua)} type="input" />
                  <FieldRow label="تكلفة الإنشاء (درهم/قدم)" value={fmtFull(PROJECT_INPUTS.constructionCostPerSqft)} type="input" />
                  <FieldRow label="تكلفة الإنشاء الإجمالية" value={fmtFull(calc.constructionCost)} type="formula" formula="BUA × تكلفة القدم" />
                  <FieldRow label="مدة التصاميم (شهر)" value={String(PROJECT_INPUTS.designDuration)} type="input" />
                  <FieldRow label="مدة الإنشاء (شهر)" value={String(PROJECT_INPUTS.constructionDuration)} type="input" />
                  <FieldRow label="تاريخ البدء" value={PROJECT_INPUTS.startDate} type="input" />
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* ═══════════════════════════════════════════ */}
        {/* SECTION 2: AREAS & REVENUE */}
        {/* ═══════════════════════════════════════════ */}
        <Card className="bg-slate-800/50 border-slate-700/50 backdrop-blur">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <Ruler className="w-5 h-5 text-emerald-400" />
              المساحات والإيرادات
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-right py-2 px-3 text-slate-400 font-medium">البند</th>
                    <th className="text-center py-2 px-3 text-slate-400 font-medium w-24">النوع</th>
                    <th className="text-left py-2 px-3 text-slate-400 font-medium">القيمة</th>
                    <th className="text-left py-2 px-3 text-slate-400 font-medium">المعادلة / المصدر</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  <tr className="bg-slate-700/20"><td colSpan={4} className="py-2 px-3 text-slate-300 font-semibold text-xs">المساحات الإجمالية GFA</td></tr>
                  <FieldRow label="GFA سكني" value={fmtFull(PROJECT_INPUTS.gfaResidential)} type="input" />
                  <FieldRow label="GFA تجزئة" value={fmtFull(PROJECT_INPUTS.gfaRetail)} type="input" />
                  <FieldRow label="GFA مكاتب" value={fmtFull(PROJECT_INPUTS.gfaOffice)} type="input" />
                  <FieldRow label="GFA إجمالي" value={fmtFull(calc.gfaTotal)} type="formula" formula="سكني + تجزئة + مكاتب" />

                  <tr className="bg-slate-700/20"><td colSpan={4} className="py-2 px-3 text-slate-300 font-semibold text-xs">النسب القابلة للبيع</td></tr>
                  <FieldRow label="نسبة القابل للبيع — سكني" value="95%" type="input" />
                  <FieldRow label="نسبة القابل للبيع — تجزئة" value="80%" type="input" />
                  <FieldRow label="نسبة القابل للبيع — مكاتب" value="90%" type="input" />
                  <FieldRow label="المساحة القابلة — سكني" value={fmtFull(calc.sellableResidential)} type="formula" formula="GFA سكني × 95%" />
                  <FieldRow label="المساحة القابلة — تجزئة" value={fmtFull(calc.sellableRetail)} type="formula" formula="GFA تجزئة × 80%" />
                  <FieldRow label="المساحة القابلة — مكاتب" value={fmtFull(calc.sellableOffice)} type="formula" formula="GFA مكاتب × 90%" />

                  <tr className="bg-slate-700/20"><td colSpan={4} className="py-2 px-3 text-slate-300 font-semibold text-xs">الإيرادات (من صفحة التسعير)</td></tr>
                  <FieldRow label="إيراد سكني" value={fmtFull(calc.revenueResidential)} type="formula" formula="= من التسعير" />
                  <FieldRow label="إيراد تجزئة" value={fmtFull(calc.revenueRetail)} type="formula" formula="= من التسعير" />
                  <FieldRow label="إيراد مكاتب" value={fmtFull(calc.revenueOffice)} type="formula" formula="= من التسعير" />
                  <FieldRow label="إجمالي الإيرادات" value={fmtFull(calc.totalRevenue)} type="formula" formula="= من التسعير" highlight />

                  <tr className="bg-slate-700/20"><td colSpan={4} className="py-2 px-3 text-slate-300 font-semibold text-xs">متوسط سعر القدم (فورمولا)</td></tr>
                  <FieldRow label="سعر القدم — سكني" value={`${fmtFull(calc.pricePerSqftResidential)} درهم`} type="formula" formula="إيراد السكني ÷ المساحة القابلة" />
                  <FieldRow label="سعر القدم — تجزئة" value={`${fmtFull(calc.pricePerSqftRetail)} درهم`} type="formula" formula="إيراد التجزئة ÷ المساحة القابلة" />
                  <FieldRow label="سعر القدم — مكاتب" value={`${fmtFull(calc.pricePerSqftOffice)} درهم`} type="formula" formula="إيراد المكاتب ÷ المساحة القابلة" />

                  <tr className="bg-slate-700/20"><td colSpan={4} className="py-2 px-3 text-slate-300 font-semibold text-xs">الوحدات والمواقف (من التسعير)</td></tr>
                  <FieldRow label="عدد الوحدات المتوقعة" value={`${calc.unitCount} وحدة`} type="formula" formula="= من التسعير" />
                  <FieldRow label="إجمالي المواقف المطلوبة" value={`${calc.totalParking} موقف`} type="formula" formula="= من التسعير" />
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* ═══════════════════════════════════════════ */}
        {/* SECTION 3: COSTS WITH FUNDING SOURCE */}
        {/* ═══════════════════════════════════════════ */}
        <Card className="bg-slate-800/50 border-slate-700/50 backdrop-blur">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-red-400" />
              التكاليف وتقسيم التمويل
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-right py-2 px-3 text-slate-400 font-medium">البند</th>
                    <th className="text-center py-2 px-3 text-slate-400 font-medium w-24">النوع</th>
                    <th className="text-center py-2 px-3 text-slate-400 font-medium">النسبة/المعدل</th>
                    <th className="text-left py-2 px-3 text-slate-400 font-medium">المبلغ</th>
                    <th className="text-left py-2 px-3 text-slate-400 font-medium">المعادلة</th>
                    <th className="text-center py-2 px-3 text-slate-400 font-medium">التمويل</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {/* Land */}
                  <tr className="bg-slate-700/20"><td colSpan={6} className="py-2 px-3 text-slate-300 font-semibold text-xs">الأرض</td></tr>
                  <CostRow label="سعر الأرض" type="formula" rate="262 درهم/قدم" amount={calc.landPrice} formula="سعر القدم × GFA الإجمالي" funding="investor" />
                  <CostRow label="رسوم تسجيل الأرض" type="input" rate="4%" amount={calc.landRegistration} formula="4% × سعر الأرض" funding="investor" />
                  <CostRow label="عمولة وسيط الأرض" type="input" rate="1%" amount={calc.landBroker} formula="1% × سعر الأرض" funding="investor" />

                  {/* Design & Supervision */}
                  <tr className="bg-slate-700/20"><td colSpan={6} className="py-2 px-3 text-slate-300 font-semibold text-xs">التصاميم والإشراف</td></tr>
                  <CostRow label="أتعاب التصاميم" type="input" rate="1.8%" amount={calc.designFee} formula="1.8% × تكلفة الإنشاء" funding="investor" />
                  <CostRow label="أتعاب الإشراف" type="input" rate="2%" amount={calc.supervisionFee} formula="2% × تكلفة الإنشاء" funding="escrow" />

                  {/* Studies & Surveys */}
                  <tr className="bg-slate-700/20"><td colSpan={6} className="py-2 px-3 text-slate-300 font-semibold text-xs">الدراسات والمسوحات</td></tr>
                  <CostRow label="فحص التربة" type="input" rate="مبلغ مقطوع" amount={PROJECT_INPUTS.soilTest} formula="—" funding="investor" />
                  <CostRow label="المسح الطبوغرافي" type="input" rate="مبلغ مقطوع" amount={PROJECT_INPUTS.topography} formula="—" funding="investor" />
                  <CostRow label="رسوم المساح" type="input" rate="مبلغ مقطوع" amount={PROJECT_INPUTS.surveyorFee} formula="—" funding="investor" />

                  {/* Government & Regulatory */}
                  <tr className="bg-slate-700/20"><td colSpan={6} className="py-2 px-3 text-slate-300 font-semibold text-xs">الرسوم الحكومية والتنظيمية</td></tr>
                  <CostRow label="رسوم المجتمع" type="input" rate="مبلغ مقطوع" amount={PROJECT_INPUTS.communityFee} formula="—" funding="investor" />
                  <CostRow label="رسوم الجهات الحكومية" type="input" rate="مبلغ مقطوع" amount={PROJECT_INPUTS.govFeesTotal} formula="—" funding="split" splitNote="10% مستثمر / 90% ضمان" investorAmt={calc.govFeesInvestor} escrowAmt={calc.govFeesEscrow} />
                  <CostRow label="رسوم الفرز" type="input" rate="40 درهم/قدم" amount={calc.sortingFee} formula="40 × GFA إجمالي" funding="investor" />
                  <CostRow label="رسوم NOC المطور" type="input" rate="مبلغ مقطوع" amount={PROJECT_INPUTS.nocSale} formula="—" funding="investor" />

                  {/* RERA */}
                  <tr className="bg-slate-700/20"><td colSpan={6} className="py-2 px-3 text-slate-300 font-semibold text-xs">ريرا (التنظيم العقاري)</td></tr>
                  <CostRow label="تسجيل المشروع — ريرا" type="input" rate="مبلغ مقطوع" amount={PROJECT_INPUTS.reraProjectReg} formula="—" funding="investor" />
                  <CostRow label="تسجيل الوحدات — ريرا" type="formula" rate="520 × عدد الوحدات" amount={calc.reraUnits} formula={`520 × ${calc.unitCount} وحدة (من التسعير)`} funding="investor" />
                  <CostRow label="حساب الضمان (رسوم فتح)" type="input" rate="مبلغ مقطوع" amount={PROJECT_INPUTS.escrowAccountFee} formula="—" funding="investor" />
                  <CostRow label="رسوم البنك" type="input" rate="مبلغ مقطوع" amount={PROJECT_INPUTS.bankFees} formula="—" funding="investor" />
                  <CostRow label="تقرير مدقق ريرا" type="input" rate="مبلغ مقطوع" amount={PROJECT_INPUTS.reraAuditorReport} formula="—" funding="escrow" />
                  <CostRow label="فحص ريرا" type="input" rate="مبلغ مقطوع" amount={PROJECT_INPUTS.reraInspection} formula="—" funding="escrow" />

                  {/* Sales & Marketing */}
                  <tr className="bg-slate-700/20"><td colSpan={6} className="py-2 px-3 text-slate-300 font-semibold text-xs">المبيعات والتسويق</td></tr>
                  <CostRow label="عمولة المبيعات" type="input" rate="5%" amount={calc.salesCommission} formula="5% × إجمالي الإيرادات" funding="escrow" />
                  <CostRow label="التسويق" type="input" rate="2%" amount={calc.marketing} formula="2% × إجمالي الإيرادات" funding="investor" />
                  <CostRow label="أتعاب المطور" type="input" rate="5%" amount={calc.developerFee} formula="5% × إجمالي الإيرادات" funding="investor" />

                  {/* Construction */}
                  <tr className="bg-slate-700/20"><td colSpan={6} className="py-2 px-3 text-slate-300 font-semibold text-xs">الإنشاء</td></tr>
                  <CostRow label="تكلفة الإنشاء" type="formula" rate="400 درهم/قدم" amount={calc.constructionCost} formula="BUA × تكلفة القدم" funding="split" splitNote="30% مستثمر / 70% ضمان" investorAmt={calc.constructionInvestor} escrowAmt={calc.constructionEscrow} />
                </tbody>
                {/* TOTALS */}
                <tfoot>
                  <tr className="border-t-2 border-slate-600 bg-slate-700/30">
                    <td className="py-3 px-3 text-white font-bold">إجمالي التكاليف</td>
                    <td></td>
                    <td></td>
                    <td className="py-3 px-3 text-red-300 font-bold text-left">{fmtFull(calc.totalCosts)} درهم</td>
                    <td></td>
                    <td></td>
                  </tr>
                  <tr className="bg-blue-900/20">
                    <td className="py-2 px-3 text-blue-300 font-medium">↳ من المستثمر</td>
                    <td></td>
                    <td></td>
                    <td className="py-2 px-3 text-blue-300 font-medium text-left">{fmtFull(calc.totalInvestor)} درهم</td>
                    <td className="text-xs text-slate-500">مجموع بنود المستثمر</td>
                    <td className="text-center"><FundingBadge type="investor" /></td>
                  </tr>
                  <tr className="bg-emerald-900/20">
                    <td className="py-2 px-3 text-emerald-300 font-medium">↳ من حساب الضمان</td>
                    <td></td>
                    <td></td>
                    <td className="py-2 px-3 text-emerald-300 font-medium text-left">{fmtFull(calc.totalEscrow)} درهم</td>
                    <td className="text-xs text-slate-500">مجموع بنود الضمان</td>
                    <td className="text-center"><FundingBadge type="escrow" /></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* ═══════════════════════════════════════════ */}
        {/* SECTION 4: PROFIT SUMMARY */}
        {/* ═══════════════════════════════════════════ */}
        <Card className="bg-slate-800/50 border-slate-700/50 backdrop-blur">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-400" />
              ملخص الربحية
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <SummaryCard label="إجمالي الإيرادات" value={calc.totalRevenue} color="blue" type="formula" formula="مجموع إيرادات (سكني + تجزئة + مكاتب)" />
              <SummaryCard label="إجمالي التكاليف" value={calc.totalCosts} color="red" type="formula" formula="مجموع كل بنود التكاليف" />
              <SummaryCard label="صافي الربح" value={calc.profit} color="green" type="formula" formula="الإيرادات − التكاليف" />
              <SummaryCard label="هامش الربح" value={calc.margin} color="purple" type="formula" formula="الربح ÷ الإيرادات × 100" suffix="%" />
            </div>
          </CardContent>
        </Card>

        {/* ═══════════════════════════════════════════ */}
        {/* LEGEND */}
        {/* ═══════════════════════════════════════════ */}
        <Card className="bg-slate-800/30 border-slate-700/30">
          <CardContent className="py-4">
            <div className="flex flex-wrap gap-6 justify-center text-sm">
              <div className="flex items-center gap-2">
                <TypeBadge type="input" />
                <span className="text-slate-400">= إدخال يدوي (المستخدم يحدده)</span>
              </div>
              <div className="flex items-center gap-2">
                <TypeBadge type="formula" />
                <span className="text-slate-400">= معادلة محسوبة تلقائياً</span>
              </div>
              <div className="flex items-center gap-2">
                <FundingBadge type="investor" />
                <span className="text-slate-400">= من المستثمر</span>
              </div>
              <div className="flex items-center gap-2">
                <FundingBadge type="escrow" />
                <span className="text-slate-400">= من حساب الضمان</span>
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

function TypeBadge({ type }: { type: FieldType }) {
  if (type === "input") {
    return <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-xs px-2">إدخال</Badge>;
  }
  return <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/40 text-xs px-2">فورمولا</Badge>;
}

function FundingBadge({ type }: { type: "investor" | "escrow" | "split" }) {
  if (type === "investor") {
    return <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/40 text-xs px-2">مستثمر</Badge>;
  }
  if (type === "escrow") {
    return <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-xs px-2">ضمان</Badge>;
  }
  return <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/40 text-xs px-2">مقسّم</Badge>;
}

function FieldRow({ label, value, type, formula, highlight }: {
  label: string; value: string; type: FieldType; formula?: string; highlight?: boolean;
}) {
  return (
    <tr className={highlight ? "bg-emerald-900/10" : ""}>
      <td className="py-2.5 px-3 text-slate-200">{label}</td>
      <td className="py-2.5 px-3 text-center"><TypeBadge type={type} /></td>
      <td className={`py-2.5 px-3 text-left font-mono ${highlight ? "text-emerald-300 font-bold" : "text-white"}`}>{value}</td>
      <td className="py-2.5 px-3 text-left text-xs text-slate-500">{formula || "—"}</td>
    </tr>
  );
}

function CostRow({ label, type, rate, amount, formula, funding, splitNote, investorAmt, escrowAmt }: {
  label: string; type: FieldType; rate: string; amount: number; formula: string;
  funding: "investor" | "escrow" | "split"; splitNote?: string;
  investorAmt?: number; escrowAmt?: number;
}) {
  return (
    <tr>
      <td className="py-2.5 px-3 text-slate-200">{label}</td>
      <td className="py-2.5 px-3 text-center"><TypeBadge type={type} /></td>
      <td className="py-2.5 px-3 text-center text-xs text-slate-400">{rate}</td>
      <td className="py-2.5 px-3 text-left font-mono text-white">{fmtFull(amount)}</td>
      <td className="py-2.5 px-3 text-left text-xs text-slate-500">{formula}</td>
      <td className="py-2.5 px-3 text-center">
        {funding === "split" ? (
          <div className="flex flex-col items-center gap-0.5">
            <FundingBadge type="split" />
            <span className="text-[10px] text-slate-500">{splitNote}</span>
          </div>
        ) : (
          <FundingBadge type={funding} />
        )}
      </td>
    </tr>
  );
}

function SummaryCard({ label, value, color, type, formula, suffix }: {
  label: string; value: number; color: string; type: FieldType; formula: string; suffix?: string;
}) {
  const colorMap: Record<string, string> = {
    blue: "from-blue-500/20 to-blue-600/10 border-blue-500/30",
    red: "from-red-500/20 to-red-600/10 border-red-500/30",
    green: "from-emerald-500/20 to-emerald-600/10 border-emerald-500/30",
    purple: "from-purple-500/20 to-purple-600/10 border-purple-500/30",
  };
  const textMap: Record<string, string> = {
    blue: "text-blue-300",
    red: "text-red-300",
    green: "text-emerald-300",
    purple: "text-purple-300",
  };
  return (
    <div className={`rounded-xl border bg-gradient-to-br ${colorMap[color]} p-4`}>
      <div className="text-xs text-slate-400 mb-1">{label}</div>
      <div className={`text-xl font-bold font-mono ${textMap[color]}`}>
        {suffix === "%" ? `${value.toFixed(1)}%` : fmt(value)}
      </div>
      <div className="flex items-center gap-1 mt-2">
        <TypeBadge type={type} />
        <span className="text-[10px] text-slate-500">{formula}</span>
      </div>
    </div>
  );
}
