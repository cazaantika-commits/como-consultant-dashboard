import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Building2, MapPin, Ruler, Calendar, DollarSign,
  Calculator, Landmark, FileText, ShieldCheck, Hammer,
  TrendingUp, Users, Banknote, ArrowRight, CheckCircle,
} from "lucide-react";

// ═══════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════
type FieldType = "input" | "formula";

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
// PROJECT DATA - MAJAN G+4P+25 POST-COMPLETION
// نفس الإدخالات — فقط النسب تختلف
// ═══════════════════════════════════════════

const INPUTS = {
  projectName: "مجان متعدد الاستخدامات (G+4P+25)",
  landArea: 66879.19,
  bua: 875300,
  constructionCostPerSqft: 400,
  designDuration: 8,
  constructionDuration: 30,
  startDate: "2026-08",
  gfaResidential: 93631,
  gfaRetail: 74904.84,
  gfaOffice: 299618.38,
  sellableRatioResidential: 0.95,
  sellableRatioRetail: 0.80,
  sellableRatioOffice: 0.90,
  pricePerSqftResidential: 1550,
  pricePerSqftRetail: 2500,
  pricePerSqftOffice: 1800,
  landPricePerSqft: 262,  // إدخال — سعر القدم للأرض
  landRegistrationRate: 0.04,
  landBrokerRate: 0.01,
  designFeeRate: 0.018,
  supervisionFeeRate: 0.02,
  soilTestAmount: 45000,
  topographyAmount: 12000,
  communityFeeAmount: 80000,
  govFeesAmount: 7000000,
  sortingFeePerSqft: 40,
  nocDeveloperAmount: 10000,
  unitCount: 520,
  reraUnitFee: 400,
  surveyorFee: 35000,
  // === النسب المختلفة عن الأوف بلان ===
  salesCommissionRate: 0.02,   // 2% بدل 5%
  marketingRate: 0.01,         // 1% بدل 2%
  developerFeeRate: 0.03,      // 3% بدل 5%
  // === بنود غير موجودة في هذا السيناريو ===
  // لا تسجيل مشروع ريرا
  // لا حساب ضمان
  // لا رسوم بنك
  // لا تقرير مدقق ريرا
  // لا فحص ريرا
  // لا تقسيم مستثمر/ضمان — كل شيء من المستثمر
};

export default function ProjectCardPostCompletionPage() {
  // === FORMULAS (Calculated from inputs) ===
  const calc = useMemo(() => {
    const i = INPUTS;
    const gfaTotal = i.gfaResidential + i.gfaRetail + i.gfaOffice;
    const sellableResidential = i.gfaResidential * i.sellableRatioResidential;
    const sellableRetail = i.gfaRetail * i.sellableRatioRetail;
    const sellableOffice = i.gfaOffice * i.sellableRatioOffice;
    const revenueResidential = sellableResidential * i.pricePerSqftResidential;
    const revenueRetail = sellableRetail * i.pricePerSqftRetail;
    const revenueOffice = sellableOffice * i.pricePerSqftOffice;
    const totalRevenue = revenueResidential + revenueRetail + revenueOffice;
    const constructionCost = i.bua * i.constructionCostPerSqft;
    const landPrice = i.landPricePerSqft * gfaTotal; // فورمولا: سعر القدم × GFA الإجمالي
    const landRegistration = landPrice * i.landRegistrationRate;
    const landBroker = landPrice * i.landBrokerRate;
    const designFee = constructionCost * i.designFeeRate;
    const supervisionFee = constructionCost * i.supervisionFeeRate;
    const sortingFee = gfaTotal * i.sortingFeePerSqft;
    const reraUnits = i.unitCount * i.reraUnitFee;
    const salesCommission = totalRevenue * i.salesCommissionRate;
    const marketing = totalRevenue * i.marketingRate;
    const developerFee = totalRevenue * i.developerFeeRate;

    // كل شيء من المستثمر — لا تقسيم
    const totalCosts = landPrice + landRegistration + landBroker + designFee +
      supervisionFee + i.soilTestAmount + i.topographyAmount + i.communityFeeAmount +
      i.govFeesAmount + sortingFee + i.nocDeveloperAmount + reraUnits +
      salesCommission + marketing + developerFee + i.surveyorFee + constructionCost;

    const profit = totalRevenue - totalCosts;
    const margin = (profit / totalRevenue) * 100;

    return {
      gfaTotal, sellableResidential, sellableRetail, sellableOffice,
      revenueResidential, revenueRetail, revenueOffice, totalRevenue,
      constructionCost, landPrice, landRegistration, landBroker,
      designFee, supervisionFee, sortingFee, reraUnits,
      salesCommission, marketing, developerFee,
      totalCosts, profit, margin,
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-6" dir="rtl">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-8">
        <div className="flex items-center gap-4 mb-2">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <CheckCircle className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">بطاقة المشروع — بيع بعد الإنجاز</h1>
            <p className="text-slate-400 text-sm">{INPUTS.projectName}</p>
          </div>
        </div>
        <div className="flex gap-3 mt-4">
          <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 px-3 py-1">
            <Calendar className="w-3 h-3 ml-1" /> تصاميم: {INPUTS.designDuration} شهور
          </Badge>
          <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 px-3 py-1">
            <Hammer className="w-3 h-3 ml-1" /> إنشاء: {INPUTS.constructionDuration} شهر
          </Badge>
          <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 px-3 py-1">
            <Calendar className="w-3 h-3 ml-1" /> الإجمالي: {INPUTS.designDuration + INPUTS.constructionDuration} شهر
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
                  <FieldRow label="اسم المشروع" value={INPUTS.projectName} type="input" />
                  <FieldRow label="مساحة الأرض (قدم²)" value={fmtFull(INPUTS.landArea)} type="input" />
                  <FieldRow label="مساحة البناء BUA (قدم²)" value={fmtFull(INPUTS.bua)} type="input" />
                  <FieldRow label="تكلفة الإنشاء (درهم/قدم)" value={fmtFull(INPUTS.constructionCostPerSqft)} type="input" />
                  <FieldRow label="تكلفة الإنشاء الإجمالية" value={fmtFull(calc.constructionCost)} type="formula" formula="BUA × تكلفة القدم" />
                  <FieldRow label="مدة التصاميم (شهر)" value={String(INPUTS.designDuration)} type="input" />
                  <FieldRow label="مدة الإنشاء (شهر)" value={String(INPUTS.constructionDuration)} type="input" />
                  <FieldRow label="تاريخ البدء" value={INPUTS.startDate} type="input" />
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
                  <FieldRow label="GFA سكني" value={fmtFull(INPUTS.gfaResidential)} type="input" />
                  <FieldRow label="GFA تجزئة" value={fmtFull(INPUTS.gfaRetail)} type="input" />
                  <FieldRow label="GFA مكاتب" value={fmtFull(INPUTS.gfaOffice)} type="input" />
                  <FieldRow label="GFA إجمالي" value={fmtFull(calc.gfaTotal)} type="formula" formula="سكني + تجزئة + مكاتب" />

                  <tr className="bg-slate-700/20"><td colSpan={4} className="py-2 px-3 text-slate-300 font-semibold text-xs">النسب القابلة للبيع</td></tr>
                  <FieldRow label="نسبة القابل للبيع — سكني" value="95%" type="input" />
                  <FieldRow label="نسبة القابل للبيع — تجزئة" value="80%" type="input" />
                  <FieldRow label="نسبة القابل للبيع — مكاتب" value="90%" type="input" />
                  <FieldRow label="المساحة القابلة — سكني" value={fmtFull(calc.sellableResidential)} type="formula" formula="GFA سكني × 95%" />
                  <FieldRow label="المساحة القابلة — تجزئة" value={fmtFull(calc.sellableRetail)} type="formula" formula="GFA تجزئة × 80%" />
                  <FieldRow label="المساحة القابلة — مكاتب" value={fmtFull(calc.sellableOffice)} type="formula" formula="GFA مكاتب × 90%" />

                  <tr className="bg-slate-700/20"><td colSpan={4} className="py-2 px-3 text-slate-300 font-semibold text-xs">أسعار البيع والإيرادات</td></tr>
                  <FieldRow label="سعر القدم — سكني" value="1,550 درهم" type="input" />
                  <FieldRow label="سعر القدم — تجزئة" value="2,500 درهم" type="input" />
                  <FieldRow label="سعر القدم — مكاتب" value="1,800 درهم" type="input" />
                  <FieldRow label="إيراد سكني" value={fmtFull(calc.revenueResidential)} type="formula" formula="مساحة قابلة × سعر القدم" />
                  <FieldRow label="إيراد تجزئة" value={fmtFull(calc.revenueRetail)} type="formula" formula="مساحة قابلة × سعر القدم" />
                  <FieldRow label="إيراد مكاتب" value={fmtFull(calc.revenueOffice)} type="formula" formula="مساحة قابلة × سعر القدم" />
                  <FieldRow label="إجمالي الإيرادات" value={fmtFull(calc.totalRevenue)} type="formula" formula="مجموع الإيرادات" highlight />
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* ═══════════════════════════════════════════ */}
        {/* SECTION 3: COSTS — ALL FROM INVESTOR */}
        {/* ═══════════════════════════════════════════ */}
        <Card className="bg-slate-800/50 border-slate-700/50 backdrop-blur">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-red-400" />
              التكاليف (كل شيء من المستثمر — لا حساب ضمان)
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
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {/* Land */}
                  <tr className="bg-slate-700/20"><td colSpan={5} className="py-2 px-3 text-slate-300 font-semibold text-xs">الأرض</td></tr>
                  <CostRow label="سعر الأرض" type="formula" rate="262 درهم/قدم" amount={calc.landPrice} formula="سعر القدم × GFA الإجمالي" />
                  <CostRow label="رسوم تسجيل الأرض" type="input" rate="4%" amount={calc.landRegistration} formula="4% × سعر الأرض" />
                  <CostRow label="عمولة وسيط الأرض" type="input" rate="1%" amount={calc.landBroker} formula="1% × سعر الأرض" />

                  {/* Design & Supervision */}
                  <tr className="bg-slate-700/20"><td colSpan={5} className="py-2 px-3 text-slate-300 font-semibold text-xs">التصاميم والإشراف</td></tr>
                  <CostRow label="أتعاب التصاميم" type="input" rate="1.8%" amount={calc.designFee} formula="1.8% × تكلفة الإنشاء" />
                  <CostRow label="أتعاب الإشراف" type="input" rate="2%" amount={calc.supervisionFee} formula="2% × تكلفة الإنشاء" />

                  {/* Studies & Surveys */}
                  <tr className="bg-slate-700/20"><td colSpan={5} className="py-2 px-3 text-slate-300 font-semibold text-xs">الدراسات والمسوحات</td></tr>
                  <CostRow label="فحص التربة" type="input" rate="مبلغ مقطوع" amount={INPUTS.soilTestAmount} formula="—" />
                  <CostRow label="المسح الطبوغرافي" type="input" rate="مبلغ مقطوع" amount={INPUTS.topographyAmount} formula="—" />
                  <CostRow label="رسوم المساح" type="input" rate="مبلغ مقطوع" amount={INPUTS.surveyorFee} formula="—" />

                  {/* Government & Regulatory */}
                  <tr className="bg-slate-700/20"><td colSpan={5} className="py-2 px-3 text-slate-300 font-semibold text-xs">الرسوم الحكومية والتنظيمية</td></tr>
                  <CostRow label="رسوم المجتمع" type="input" rate="مبلغ مقطوع" amount={INPUTS.communityFeeAmount} formula="—" />
                  <CostRow label="رسوم الجهات الحكومية" type="input" rate="مبلغ مقطوع" amount={INPUTS.govFeesAmount} formula="—" />
                  <CostRow label="رسوم الفرز" type="input" rate="40 درهم/قدم" amount={calc.sortingFee} formula="40 × GFA إجمالي" />
                  <CostRow label="رسوم NOC المطور" type="input" rate="مبلغ مقطوع" amount={INPUTS.nocDeveloperAmount} formula="—" />

                  {/* RERA — only unit registration */}
                  <tr className="bg-slate-700/20"><td colSpan={5} className="py-2 px-3 text-slate-300 font-semibold text-xs">ريرا (التنظيم العقاري)</td></tr>
                  <CostRow label="تسجيل الوحدات — ريرا" type="input" rate="400 × عدد الوحدات" amount={calc.reraUnits} formula="400 × 520 وحدة" />

                  {/* Sales & Marketing */}
                  <tr className="bg-slate-700/20"><td colSpan={5} className="py-2 px-3 text-slate-300 font-semibold text-xs">المبيعات والتسويق</td></tr>
                  <CostRow label="عمولة المبيعات" type="input" rate="2%" amount={calc.salesCommission} formula="2% × إجمالي الإيرادات" />
                  <CostRow label="التسويق" type="input" rate="1%" amount={calc.marketing} formula="1% × إجمالي الإيرادات" />
                  <CostRow label="أتعاب المطور" type="input" rate="3%" amount={calc.developerFee} formula="3% × إجمالي الإيرادات" />

                  {/* Construction */}
                  <tr className="bg-slate-700/20"><td colSpan={5} className="py-2 px-3 text-slate-300 font-semibold text-xs">الإنشاء</td></tr>
                  <CostRow label="تكلفة الإنشاء" type="formula" rate="400 درهم/قدم" amount={calc.constructionCost} formula="BUA × تكلفة القدم" />
                </tbody>
                {/* TOTALS */}
                <tfoot>
                  <tr className="border-t-2 border-slate-600 bg-slate-700/30">
                    <td className="py-3 px-3 text-white font-bold">إجمالي التكاليف</td>
                    <td></td>
                    <td></td>
                    <td className="py-3 px-3 text-red-300 font-bold text-left">{fmtFull(calc.totalCosts)} درهم</td>
                    <td></td>
                  </tr>
                  <tr className="bg-blue-900/20">
                    <td className="py-2 px-3 text-blue-300 font-medium">↳ كل شيء من المستثمر</td>
                    <td></td>
                    <td></td>
                    <td className="py-2 px-3 text-blue-300 font-medium text-left">{fmtFull(calc.totalCosts)} درهم</td>
                    <td className="text-xs text-slate-500">لا يوجد حساب ضمان</td>
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
        {/* DIFFERENCES NOTE */}
        {/* ═══════════════════════════════════════════ */}
        <Card className="bg-amber-900/20 border-amber-700/30 backdrop-blur">
          <CardContent className="py-4">
            <h3 className="text-amber-300 font-bold text-sm mb-3">الفروقات عن سيناريو الأوف بلان:</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <ArrowRight className="w-3 h-3 text-amber-400" />
                عمولة المبيعات: 2% (بدل 5%)
              </div>
              <div className="flex items-center gap-2">
                <ArrowRight className="w-3 h-3 text-amber-400" />
                التسويق: 1% (بدل 2%)
              </div>
              <div className="flex items-center gap-2">
                <ArrowRight className="w-3 h-3 text-amber-400" />
                أتعاب المطور: 3% (بدل 5%)
              </div>
              <div className="flex items-center gap-2">
                <ArrowRight className="w-3 h-3 text-amber-400" />
                لا يوجد حساب ضمان (كل شيء من المستثمر)
              </div>
              <div className="flex items-center gap-2">
                <ArrowRight className="w-3 h-3 text-amber-400" />
                لا تسجيل مشروع ريرا / لا رسوم بنك
              </div>
              <div className="flex items-center gap-2">
                <ArrowRight className="w-3 h-3 text-amber-400" />
                لا تقرير مدقق ريرا / لا فحص ريرا
              </div>
            </div>
          </CardContent>
        </Card>

        {/* LEGEND */}
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

function CostRow({ label, type, rate, amount, formula }: {
  label: string; type: FieldType; rate: string; amount: number; formula: string;
}) {
  return (
    <tr>
      <td className="py-2.5 px-3 text-slate-200">{label}</td>
      <td className="py-2.5 px-3 text-center"><TypeBadge type={type} /></td>
      <td className="py-2.5 px-3 text-center text-xs text-slate-400">{rate}</td>
      <td className="py-2.5 px-3 text-left font-mono text-white">{fmtFull(amount)}</td>
      <td className="py-2.5 px-3 text-left text-xs text-slate-500">{formula}</td>
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
