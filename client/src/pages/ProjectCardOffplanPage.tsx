import { useMemo, useState, useEffect, useCallback } from "react";
import { useProjectContext } from "@/contexts/ProjectContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Building2, MapPin, Ruler, Calendar, DollarSign,
  Calculator, Hammer, TrendingUp, Save, Loader2, Pencil,
} from "lucide-react";
import {
  PROJECT_INPUTS,
  RATES,
  PRICING_DEFAULTS,
  calculateProjectFormulas,
  calculatePricingFormulas,
  calculateCosts,
  dbProjectToInputs,
  dbProjectToRates,
  type ProjectInputs,
  type ProjectRates,
} from "@/lib/projectData";
import { ProjectSelector } from "@/components/ProjectSelector";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

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
  return Math.round(n).toLocaleString("ar-AE");
}

function fmtFull(n: number): string {
  return Math.round(n).toLocaleString("ar-AE");
}

// ═══════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════
export default function ProjectCardOffplanPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { selectedProjectId, setSelectedProjectId } = useProjectContext();
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const projectQuery = trpc.projects.getById.useQuery(selectedProjectId!, { enabled: !!selectedProjectId && !!user });
  const updateProject = trpc.projects.update.useMutation({
    onSuccess: () => {
      toast({ title: "تم الحفظ ✓", description: "تم حفظ التعديلات بنجاح" });
      setHasChanges(false);
      setIsEditing(false);
      projectQuery.refetch();
    },
    onError: (err: any) => toast({ title: "خطأ", description: "فشل الحفظ: " + err.message, variant: "destructive" }),
  });

  // Load data from DB into form
  useEffect(() => {
    if (projectQuery.data) {
      const p = projectQuery.data as any;
      setFormData({
        name: p.name || "",
        plotAreaSqft: p.plotAreaSqft || "",
        manualBuaSqft: p.manualBuaSqft || "",
        estimatedConstructionPricePerSqft: p.estimatedConstructionPricePerSqft || "",
        preConMonths: p.preConMonths ? String(p.preConMonths) : "6",
        constructionMonths: p.constructionMonths ? String(p.constructionMonths) : "18",
        gfaResidentialSqft: p.gfaResidentialSqft || "",
        gfaRetailSqft: p.gfaRetailSqft || "",
        gfaOfficesSqft: p.gfaOfficesSqft || "",
        saleableResidentialPct: p.saleableResidentialPct ? String(p.saleableResidentialPct) : "95",
        saleableRetailPct: p.saleableRetailPct ? String(p.saleableRetailPct) : "97",
        saleableOfficesPct: p.saleableOfficesPct ? String(p.saleableOfficesPct) : "95",
        landPrice: p.landPrice || "",
        agentCommissionLandPct: p.agentCommissionLandPct ? String(p.agentCommissionLandPct) : "1",
        designFeePct: p.designFeePct ? String(p.designFeePct) : "1.8",
        supervisionFeePct: p.supervisionFeePct ? String(p.supervisionFeePct) : "2",
        separationFeePerSqft: p.separationFeePerSqft ? String(p.separationFeePerSqft) : "40",
        salesCommissionPct: p.salesCommissionPct ? String(p.salesCommissionPct) : "5",
        marketingPct: p.marketingPct ? String(p.marketingPct) : "2",
        developerFeePct: p.developerFeePct ? String(p.developerFeePct) : "5",
        soilTestFee: p.soilTestFee || "45000",
        topographicSurveyFee: p.topographicSurveyFee || "12000",
        surveyorFees: p.surveyorFees || "35000",
        communityFees: p.communityFees || "80000",
        officialBodiesFees: p.officialBodiesFees || "7000000",
        developerNocFee: p.developerNocFee || "10000",
        reraProjectRegFee: p.reraProjectRegFee || "150000",
        escrowAccountFee: p.escrowAccountFee || "180000",
        bankFees: p.bankFees || "35000",
        reraAuditReportFee: p.reraAuditReportFee || "24000",
        reraInspectionReportFee: p.reraInspectionReportFee || "150000",
      });
      setHasChanges(false);
    }
  }, [projectQuery.data]);

  const updateField = useCallback((key: string, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  }, []);

  const handleSave = useCallback(() => {
    if (!selectedProjectId) return;
    const payload: Record<string, any> = { id: selectedProjectId };
    const intFields = ["preConMonths", "constructionMonths"];
    for (const [key, value] of Object.entries(formData)) {
      if (intFields.includes(key)) {
        payload[key] = value ? parseInt(value) : undefined;
      } else {
        payload[key] = value?.trim() !== "" ? value : undefined;
      }
    }
    updateProject.mutate(payload as any);
  }, [selectedProjectId, formData, updateProject]);

  // === FORMULAS — dynamic from form data ===
  const calc = useMemo(() => {
    const mockDb: any = {
      name: formData.name || "مشروع",
      plotAreaSqft: formData.plotAreaSqft || "0",
      manualBuaSqft: formData.manualBuaSqft || "0",
      estimatedConstructionPricePerSqft: formData.estimatedConstructionPricePerSqft || "400",
      preConMonths: parseInt(formData.preConMonths || "6"),
      constructionMonths: parseInt(formData.constructionMonths || "18"),
      startDate: "2026-08",
      gfaResidentialSqft: formData.gfaResidentialSqft || "0",
      gfaRetailSqft: formData.gfaRetailSqft || "0",
      gfaOfficesSqft: formData.gfaOfficesSqft || "0",
      gfaSqft: "",
      landPrice: formData.landPrice || "0",
      agentCommissionLandPct: formData.agentCommissionLandPct || "1",
      designFeePct: formData.designFeePct || "1.8",
      supervisionFeePct: formData.supervisionFeePct || "2",
      separationFeePerSqft: formData.separationFeePerSqft || "40",
      salesCommissionPct: formData.salesCommissionPct || "5",
      marketingPct: formData.marketingPct || "2",
      developerFeePct: formData.developerFeePct || "5",
      saleableResidentialPct: formData.saleableResidentialPct || "95",
      saleableRetailPct: formData.saleableRetailPct || "97",
      saleableOfficesPct: formData.saleableOfficesPct || "95",
      soilTestFee: formData.soilTestFee || "45000",
      topographicSurveyFee: formData.topographicSurveyFee || "12000",
      surveyorFees: formData.surveyorFees || "35000",
      communityFees: formData.communityFees || "80000",
      officialBodiesFees: formData.officialBodiesFees || "7000000",
      developerNocFee: formData.developerNocFee || "10000",
      reraProjectRegFee: formData.reraProjectRegFee || "150000",
      escrowAccountFee: formData.escrowAccountFee || "180000",
      bankFees: formData.bankFees || "35000",
      reraAuditReportFee: formData.reraAuditReportFee || "24000",
      reraInspectionReportFee: formData.reraInspectionReportFee || "150000",
    };

    const i: ProjectInputs = dbProjectToInputs(mockDb);
    const r: ProjectRates = dbProjectToRates(mockDb);
    const projectFormulas = calculateProjectFormulas(i, r);
    const { gfaTotal, sellableResidential, sellableRetail, sellableOffice, landPrice, landRegistration, landBroker, constructionCost } = projectFormulas;

    // Read unit data from project record (same source as PricingPage)
    const p = projectQuery.data as any;
    const hasSavedCounts = [p?.residential1brCount, p?.residential2brCount, p?.residential3brCount, p?.retailSmallCount, p?.retailMediumCount, p?.retailLargeCount, p?.officeSmallCount, p?.officeMediumCount, p?.officeLargeCount].some(v => Number(v) > 0);

    // Default areas and prices
    const defAreas = { res1: 750, res2: 1300, res3: 1650, retS: 850, retM: 1200, retL: 1800, offS: 1200, offM: 2000, offL: 3500 };
    const defPrices = { res1: 1550, res2: 1500, res3: 1450, retS: 3000, retM: 2500, retL: 2000, offS: 1900, offM: 1800, offL: 1700 };

    // Smart auto-fill counts from GFA (40/40/20) - same logic as PricingPage
    let c1 = Number(p?.residential1brCount) || 0;
    let c2 = Number(p?.residential2brCount) || 0;
    let c3 = Number(p?.residential3brCount) || 0;
    let cRS = Number(p?.retailSmallCount) || 0;
    let cRM = Number(p?.retailMediumCount) || 0;
    let cRL = Number(p?.retailLargeCount) || 0;
    let cOS = Number(p?.officeSmallCount) || 0;
    let cOM = Number(p?.officeMediumCount) || 0;
    let cOL = Number(p?.officeLargeCount) || 0;

    if (!hasSavedCounts) {
      // Calculate from GFA with 40/40/20 ratios (same as PricingPage smart fill)
      const sellRes = i.gfaResidential * i.efficiencyResidential;
      const sellRet = i.gfaRetail * i.efficiencyRetail;
      const sellOff = i.gfaOffice * i.efficiencyOffice;
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
    const { revenueResidential, revenueRetail, revenueOffice, totalRevenue, totalUnits, totalParking } = pricingFormulas;

    const pricePerSqftResidential = sellableResidential > 0 ? revenueResidential / sellableResidential : 0;
    const pricePerSqftRetail = sellableRetail > 0 ? revenueRetail / sellableRetail : 0;
    const pricePerSqftOffice = sellableOffice > 0 ? revenueOffice / sellableOffice : 0;

    const costs = calculateCosts(projectFormulas, pricingFormulas, i, r);

    return {
      i, r,
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
    }, [formData, projectQuery.data]);
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-6" dir="rtl">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-8">
        <div className="flex items-center gap-4 mb-2 flex-wrap">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">بطاقة المشروع — أوف بلان</h1>
            <p className="text-slate-400 text-sm">{formData.name || "اختر مشروع"}</p>
          </div>
          {/* Edit / Save buttons */}
          <div className="flex items-center gap-2 mr-auto">
            {selectedProjectId && !isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 transition-all text-sm font-bold"
              >
                <Pencil className="w-4 h-4" />
                <span>تعديل</span>
              </button>
            )}
            {selectedProjectId && isEditing && (
              <>
                <button
                  onClick={() => { setIsEditing(false); setHasChanges(false); projectQuery.refetch(); }}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-600/50 border border-slate-500/40 text-slate-300 hover:bg-slate-600/70 transition-all text-sm"
                >
                  إلغاء
                </button>
                <button
                  onClick={handleSave}
                  disabled={!hasChanges || updateProject.isPending}
                  className={`flex items-center gap-2 px-5 py-2 rounded-xl font-bold text-sm transition-all ${
                    updateProject.isPending ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300 cursor-wait' :
                    hasChanges ? 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/30' :
                    'bg-slate-700 border border-slate-600 text-slate-400 cursor-default'
                  }`}
                >
                  {updateProject.isPending ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /><span>جاري الحفظ...</span></>
                  ) : (
                    <><Save className="w-4 h-4" /><span>حفظ التعديلات</span></>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
        <div className="mt-4 mb-4">
          <ProjectSelector selectedId={selectedProjectId} onSelect={(id) => { setSelectedProjectId(id); setIsEditing(false); }} className="" />
        </div>
        <div className="flex gap-3 flex-wrap">
          <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 px-3 py-1">
            <Calendar className="w-3 h-3 ml-1" /> تصاميم: {calc.i.designDuration} شهور
          </Badge>
          <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 px-3 py-1">
            <Hammer className="w-3 h-3 ml-1" /> إنشاء: {calc.i.constructionDuration} شهر
          </Badge>
          <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 px-3 py-1">
            <Calendar className="w-3 h-3 ml-1" /> الإجمالي: {calc.i.designDuration + calc.i.constructionDuration} شهر
          </Badge>
        </div>
      </div>

      <div className="max-w-6xl mx-auto space-y-6">

        {/* SECTION 1: PROJECT BASICS */}
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
                    <th className="text-left py-2 px-3 text-slate-400 font-medium">المعادلة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  <EditableRow label="اسم المشروع" fieldKey="name" value={formData.name} editing={isEditing} onChange={updateField} inputType="text" />
                  <EditableRow label="مساحة الأرض (قدم²)" fieldKey="plotAreaSqft" value={formData.plotAreaSqft} editing={isEditing} onChange={updateField} displayValue={fmtFull(parseFloat(formData.plotAreaSqft || "0"))} />
                  <EditableRow label="مساحة البناء BUA (قدم²)" fieldKey="manualBuaSqft" value={formData.manualBuaSqft} editing={isEditing} onChange={updateField} displayValue={fmtFull(parseFloat(formData.manualBuaSqft || "0"))} />
                  <EditableRow label="تكلفة الإنشاء (درهم/قدم)" fieldKey="estimatedConstructionPricePerSqft" value={formData.estimatedConstructionPricePerSqft} editing={isEditing} onChange={updateField} displayValue={fmtFull(parseFloat(formData.estimatedConstructionPricePerSqft || "0"))} />
                  <FormulaRow label="تكلفة الإنشاء الإجمالية" value={fmtFull(calc.constructionCost)} formula="BUA × تكلفة القدم" />
                  <EditableRow label="مدة التصاميم (شهر)" fieldKey="preConMonths" value={formData.preConMonths} editing={isEditing} onChange={updateField} />
                  <EditableRow label="مدة الإنشاء (شهر)" fieldKey="constructionMonths" value={formData.constructionMonths} editing={isEditing} onChange={updateField} />
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* SECTION 2: AREAS & REVENUE */}
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
                    <th className="text-left py-2 px-3 text-slate-400 font-medium">المعادلة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  <tr className="bg-slate-700/20"><td colSpan={4} className="py-2 px-3 text-slate-300 font-semibold text-xs">المساحات الإجمالية GFA</td></tr>
                  <EditableRow label="GFA سكني (قدم²)" fieldKey="gfaResidentialSqft" value={formData.gfaResidentialSqft} editing={isEditing} onChange={updateField} displayValue={fmtFull(parseFloat(formData.gfaResidentialSqft || "0"))} />
                  <EditableRow label="GFA تجزئة (قدم²)" fieldKey="gfaRetailSqft" value={formData.gfaRetailSqft} editing={isEditing} onChange={updateField} displayValue={fmtFull(parseFloat(formData.gfaRetailSqft || "0"))} />
                  <EditableRow label="GFA مكاتب (قدم²)" fieldKey="gfaOfficesSqft" value={formData.gfaOfficesSqft} editing={isEditing} onChange={updateField} displayValue={fmtFull(parseFloat(formData.gfaOfficesSqft || "0"))} />
                  <FormulaRow label="GFA إجمالي" value={fmtFull(calc.gfaTotal)} formula="سكني + تجزئة + مكاتب" />

                  <tr className="bg-slate-700/20"><td colSpan={4} className="py-2 px-3 text-slate-300 font-semibold text-xs">النسب القابلة للبيع</td></tr>
                  <EditableRow label="نسبة القابل للبيع — سكني (%)" fieldKey="saleableResidentialPct" value={formData.saleableResidentialPct} editing={isEditing} onChange={updateField} displayValue={`${formData.saleableResidentialPct || "95"}%`} />
                  <EditableRow label="نسبة القابل للبيع — تجزئة (%)" fieldKey="saleableRetailPct" value={formData.saleableRetailPct} editing={isEditing} onChange={updateField} displayValue={`${formData.saleableRetailPct || "97"}%`} />
                  <EditableRow label="نسبة القابل للبيع — مكاتب (%)" fieldKey="saleableOfficesPct" value={formData.saleableOfficesPct} editing={isEditing} onChange={updateField} displayValue={`${formData.saleableOfficesPct || "95"}%`} />
                  <FormulaRow label="المساحة القابلة — سكني" value={fmtFull(calc.sellableResidential)} formula="GFA سكني × النسبة" />
                  <FormulaRow label="المساحة القابلة — تجزئة" value={fmtFull(calc.sellableRetail)} formula="GFA تجزئة × النسبة" />
                  <FormulaRow label="المساحة القابلة — مكاتب" value={fmtFull(calc.sellableOffice)} formula="GFA مكاتب × النسبة" />

                  <tr className="bg-slate-700/20"><td colSpan={4} className="py-2 px-3 text-slate-300 font-semibold text-xs">الإيرادات (من صفحة التسعير)</td></tr>
                  <FormulaRow label="إيراد سكني" value={fmtFull(calc.revenueResidential)} formula="= من التسعير" />
                  <FormulaRow label="إيراد تجزئة" value={fmtFull(calc.revenueRetail)} formula="= من التسعير" />
                  <FormulaRow label="إيراد مكاتب" value={fmtFull(calc.revenueOffice)} formula="= من التسعير" />
                  <FormulaRow label="إجمالي الإيرادات" value={fmtFull(calc.totalRevenue)} formula="= من التسعير" highlight />

                  <tr className="bg-slate-700/20"><td colSpan={4} className="py-2 px-3 text-slate-300 font-semibold text-xs">متوسط سعر القدم</td></tr>
                  <FormulaRow label="سعر القدم — سكني" value={`${fmtFull(calc.pricePerSqftResidential)} درهم`} formula="إيراد ÷ المساحة القابلة" />
                  <FormulaRow label="سعر القدم — تجزئة" value={`${fmtFull(calc.pricePerSqftRetail)} درهم`} formula="إيراد ÷ المساحة القابلة" />
                  <FormulaRow label="سعر القدم — مكاتب" value={`${fmtFull(calc.pricePerSqftOffice)} درهم`} formula="إيراد ÷ المساحة القابلة" />

                  <tr className="bg-slate-700/20"><td colSpan={4} className="py-2 px-3 text-slate-300 font-semibold text-xs">الوحدات والمواقف</td></tr>
                  <FormulaRow label="عدد الوحدات المتوقعة" value={`${calc.unitCount} وحدة`} formula="= من التسعير" />
                  <FormulaRow label="إجمالي المواقف المطلوبة" value={`${calc.totalParking} موقف`} formula="= من التسعير" />
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* SECTION 3: COSTS */}
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
                  <CostRowEditable label="سعر الأرض" fieldKey="landPrice" value={formData.landPrice} editing={isEditing} onChange={updateField} rate="إدخال" amount={calc.landPrice} formula="إدخال يدوي" funding="investor" />
                  <CostRowFormula label="رسوم تسجيل الأرض" rate="4%" amount={calc.landRegistration} formula="4% × سعر الأرض" funding="investor" />
                  <CostRowEditable label="عمولة وسيط الأرض" fieldKey="agentCommissionLandPct" value={formData.agentCommissionLandPct} editing={isEditing} onChange={updateField} rate={`${formData.agentCommissionLandPct || "1"}%`} amount={calc.landBroker} formula="النسبة × سعر الأرض" funding="investor" />

                  {/* Design & Supervision */}
                  <tr className="bg-slate-700/20"><td colSpan={6} className="py-2 px-3 text-slate-300 font-semibold text-xs">التصاميم والإشراف</td></tr>
                  <CostRowEditable label="أتعاب التصاميم" fieldKey="designFeePct" value={formData.designFeePct} editing={isEditing} onChange={updateField} rate={`${formData.designFeePct || "1.8"}%`} amount={calc.designFee} formula="النسبة × تكلفة الإنشاء" funding="investor" />
                  <CostRowEditable label="أتعاب الإشراف" fieldKey="supervisionFeePct" value={formData.supervisionFeePct} editing={isEditing} onChange={updateField} rate={`${formData.supervisionFeePct || "2"}%`} amount={calc.supervisionFee} formula="النسبة × تكلفة الإنشاء" funding="escrow" />

                  {/* Studies */}
                  <tr className="bg-slate-700/20"><td colSpan={6} className="py-2 px-3 text-slate-300 font-semibold text-xs">الدراسات والمسوحات</td></tr>
                  <CostRowEditable label="فحص التربة" fieldKey="soilTestFee" value={formData.soilTestFee} editing={isEditing} onChange={updateField} rate="مقطوع" amount={parseFloat(formData.soilTestFee || "45000")} formula="—" funding="investor" />
                  <CostRowEditable label="المسح الطبوغرافي" fieldKey="topographicSurveyFee" value={formData.topographicSurveyFee} editing={isEditing} onChange={updateField} rate="مقطوع" amount={parseFloat(formData.topographicSurveyFee || "12000")} formula="—" funding="investor" />
                  <CostRowEditable label="رسوم المساح" fieldKey="surveyorFees" value={formData.surveyorFees} editing={isEditing} onChange={updateField} rate="مقطوع" amount={parseFloat(formData.surveyorFees || "35000")} formula="—" funding="escrow" />

                  {/* Government */}
                  <tr className="bg-slate-700/20"><td colSpan={6} className="py-2 px-3 text-slate-300 font-semibold text-xs">الرسوم الحكومية</td></tr>
                  <CostRowEditable label="رسوم المجتمع" fieldKey="communityFees" value={formData.communityFees} editing={isEditing} onChange={updateField} rate="مقطوع" amount={parseFloat(formData.communityFees || "80000")} formula="—" funding="investor" />
                  <CostRowEditable label="رسوم الجهات الحكومية" fieldKey="officialBodiesFees" value={formData.officialBodiesFees} editing={isEditing} onChange={updateField} rate="مقطوع" amount={parseFloat(formData.officialBodiesFees || "7000000")} formula="10% مستثمر / 90% ضمان" funding="split" />
                  <CostRowEditable label="رسوم الفرز (درهم/قدم)" fieldKey="separationFeePerSqft" value={formData.separationFeePerSqft} editing={isEditing} onChange={updateField} rate={`${formData.separationFeePerSqft || "40"} د/قدم`} amount={calc.sortingFee} formula="المعدل × GFA" funding="investor" />
                  <CostRowEditable label="رسوم NOC المطور" fieldKey="developerNocFee" value={formData.developerNocFee} editing={isEditing} onChange={updateField} rate="مقطوع" amount={parseFloat(formData.developerNocFee || "10000")} formula="—" funding="investor" />

                  {/* RERA */}
                  <tr className="bg-slate-700/20"><td colSpan={6} className="py-2 px-3 text-slate-300 font-semibold text-xs">ريرا</td></tr>
                  <CostRowEditable label="تسجيل المشروع — ريرا" fieldKey="reraProjectRegFee" value={formData.reraProjectRegFee} editing={isEditing} onChange={updateField} rate="مقطوع" amount={parseFloat(formData.reraProjectRegFee || "150000")} formula="—" funding="investor" />
                  <CostRowFormula label="تسجيل الوحدات — ريرا" rate="520 × وحدات" amount={calc.reraUnits} formula={`520 × ${calc.unitCount}`} funding="investor" />
                  <CostRowEditable label="حساب الضمان" fieldKey="escrowAccountFee" value={formData.escrowAccountFee} editing={isEditing} onChange={updateField} rate="مقطوع" amount={parseFloat(formData.escrowAccountFee || "180000")} formula="—" funding="investor" />
                  <CostRowEditable label="رسوم البنك" fieldKey="bankFees" value={formData.bankFees} editing={isEditing} onChange={updateField} rate="مقطوع" amount={parseFloat(formData.bankFees || "35000")} formula="—" funding="investor" />
                  <CostRowEditable label="تقرير مدقق ريرا" fieldKey="reraAuditReportFee" value={formData.reraAuditReportFee} editing={isEditing} onChange={updateField} rate="مقطوع" amount={parseFloat(formData.reraAuditReportFee || "24000")} formula="—" funding="escrow" />
                  <CostRowEditable label="فحص ريرا" fieldKey="reraInspectionReportFee" value={formData.reraInspectionReportFee} editing={isEditing} onChange={updateField} rate="مقطوع" amount={parseFloat(formData.reraInspectionReportFee || "150000")} formula="—" funding="escrow" />

                  {/* Sales & Marketing */}
                  <tr className="bg-slate-700/20"><td colSpan={6} className="py-2 px-3 text-slate-300 font-semibold text-xs">المبيعات والتسويق</td></tr>
                  <CostRowEditable label="عمولة المبيعات" fieldKey="salesCommissionPct" value={formData.salesCommissionPct} editing={isEditing} onChange={updateField} rate={`${formData.salesCommissionPct || "5"}%`} amount={calc.salesCommission} formula="النسبة × الإيرادات" funding="escrow" />
                  <CostRowEditable label="التسويق" fieldKey="marketingPct" value={formData.marketingPct} editing={isEditing} onChange={updateField} rate={`${formData.marketingPct || "2"}%`} amount={calc.marketing} formula="النسبة × الإيرادات" funding="investor" />
                  <CostRowEditable label="أتعاب المطور" fieldKey="developerFeePct" value={formData.developerFeePct} editing={isEditing} onChange={updateField} rate={`${formData.developerFeePct || "5"}%`} amount={calc.developerFee} formula="النسبة × الإيرادات" funding="investor" />

                  {/* Construction */}
                  <tr className="bg-slate-700/20"><td colSpan={6} className="py-2 px-3 text-slate-300 font-semibold text-xs">الإنشاء</td></tr>
                  <CostRowFormula label="تكلفة الإنشاء" rate={`${formData.estimatedConstructionPricePerSqft || "400"} د/قدم`} amount={calc.constructionCost} formula="BUA × تكلفة القدم" funding="split" />
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-600 bg-slate-700/30">
                    <td className="py-3 px-3 text-white font-bold">إجمالي التكاليف</td>
                    <td></td><td></td>
                    <td className="py-3 px-3 text-red-300 font-bold text-left">{fmtFull(calc.totalCosts)} درهم</td>
                    <td></td><td></td>
                  </tr>
                  <tr className="bg-blue-900/20">
                    <td className="py-2 px-3 text-blue-300 font-medium">↳ من المستثمر</td>
                    <td></td><td></td>
                    <td className="py-2 px-3 text-blue-300 font-medium text-left">{fmtFull(calc.totalInvestor)} درهم</td>
                    <td className="text-xs text-slate-500">مجموع بنود المستثمر</td>
                    <td className="text-center"><FundingBadge type="investor" /></td>
                  </tr>
                  <tr className="bg-emerald-900/20">
                    <td className="py-2 px-3 text-emerald-300 font-medium">↳ من حساب الضمان</td>
                    <td></td><td></td>
                    <td className="py-2 px-3 text-emerald-300 font-medium text-left">{fmtFull(calc.totalEscrow)} درهم</td>
                    <td className="text-xs text-slate-500">مجموع بنود الضمان</td>
                    <td className="text-center"><FundingBadge type="escrow" /></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* SECTION 4: PROFIT SUMMARY */}
        <Card className="bg-slate-800/50 border-slate-700/50 backdrop-blur">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-400" />
              ملخص الربحية
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <SummaryCard label="إجمالي الإيرادات" value={calc.totalRevenue} color="blue" />
              <SummaryCard label="إجمالي التكاليف" value={calc.totalCosts} color="red" />
              <SummaryCard label="صافي الربح" value={calc.profit} color="green" />
              <SummaryCard label="هامش الربح" value={calc.margin} color="purple" suffix="%" />
            </div>
          </CardContent>
        </Card>

        {/* LEGEND */}
        <Card className="bg-slate-800/30 border-slate-700/30">
          <CardContent className="py-4">
            <div className="flex flex-wrap gap-6 justify-center text-sm">
              <div className="flex items-center gap-2">
                <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-xs px-2">إدخال</Badge>
                <span className="text-slate-400">= اضغط "تعديل" لتغييره</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/40 text-xs px-2">فورمولا</Badge>
                <span className="text-slate-400">= محسوب تلقائياً</span>
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

function FundingBadge({ type }: { type: "investor" | "escrow" | "split" }) {
  if (type === "investor") return <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/40 text-xs px-2">مستثمر</Badge>;
  if (type === "escrow") return <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-xs px-2">ضمان</Badge>;
  return <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/40 text-xs px-2">مقسّم</Badge>;
}

function FormulaRow({ label, value, formula, highlight }: { label: string; value: string; formula: string; highlight?: boolean }) {
  return (
    <tr className={highlight ? "bg-emerald-900/10" : ""}>
      <td className="py-2.5 px-3 text-slate-200">{label}</td>
      <td className="py-2.5 px-3 text-center"><Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/40 text-xs px-2">فورمولا</Badge></td>
      <td className={`py-2.5 px-3 text-left font-mono ${highlight ? "text-emerald-300 font-bold" : "text-white"}`}>{value}</td>
      <td className="py-2.5 px-3 text-left text-xs text-slate-500">{formula}</td>
    </tr>
  );
}

function EditableRow({ label, fieldKey, value, editing, onChange, displayValue, inputType = "number" }: {
  label: string; fieldKey: string; value: string; editing: boolean; onChange: (key: string, val: string) => void;
  displayValue?: string; inputType?: "text" | "number";
}) {
  if (!editing) {
    return (
      <tr>
        <td className="py-2.5 px-3 text-slate-200">{label}</td>
        <td className="py-2.5 px-3 text-center"><Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-xs px-2">إدخال</Badge></td>
        <td className="py-2.5 px-3 text-left font-mono text-white">{displayValue || value || "—"}</td>
        <td className="py-2.5 px-3 text-left text-xs text-slate-500">إدخال يدوي</td>
      </tr>
    );
  }
  return (
    <tr className="bg-amber-900/5">
      <td className="py-2.5 px-3 text-slate-200">{label}</td>
      <td className="py-2.5 px-3 text-center"><Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-xs px-2">إدخال</Badge></td>
      <td className="py-2.5 px-3 text-left">
        <input
          type={inputType}
          value={value}
          onChange={e => onChange(fieldKey, e.target.value)}
          className="w-full max-w-[200px] bg-slate-700/80 border border-amber-500/50 rounded-lg px-3 py-1.5 text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
          dir="ltr"
        />
      </td>
      <td className="py-2.5 px-3 text-left text-xs text-amber-400">✏️ قابل للتعديل</td>
    </tr>
  );
}

function CostRowFormula({ label, rate, amount, formula, funding }: {
  label: string; rate: string; amount: number; formula: string; funding: "investor" | "escrow" | "split";
}) {
  return (
    <tr>
      <td className="py-2.5 px-3 text-slate-200">{label}</td>
      <td className="py-2.5 px-3 text-center"><Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/40 text-xs px-2">فورمولا</Badge></td>
      <td className="py-2.5 px-3 text-center text-xs text-slate-400">{rate}</td>
      <td className="py-2.5 px-3 text-left font-mono text-white">{fmtFull(amount)}</td>
      <td className="py-2.5 px-3 text-left text-xs text-slate-500">{formula}</td>
      <td className="py-2.5 px-3 text-center"><FundingBadge type={funding} /></td>
    </tr>
  );
}

function CostRowEditable({ label, fieldKey, value, editing, onChange, rate, amount, formula, funding }: {
  label: string; fieldKey: string; value: string; editing: boolean; onChange: (key: string, val: string) => void;
  rate: string; amount: number; formula: string; funding: "investor" | "escrow" | "split";
}) {
  if (!editing) {
    return (
      <tr>
        <td className="py-2.5 px-3 text-slate-200">{label}</td>
        <td className="py-2.5 px-3 text-center"><Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-xs px-2">إدخال</Badge></td>
        <td className="py-2.5 px-3 text-center text-xs text-slate-400">{rate}</td>
        <td className="py-2.5 px-3 text-left font-mono text-white">{fmtFull(amount)}</td>
        <td className="py-2.5 px-3 text-left text-xs text-slate-500">{formula}</td>
        <td className="py-2.5 px-3 text-center"><FundingBadge type={funding} /></td>
      </tr>
    );
  }
  return (
    <tr className="bg-amber-900/5">
      <td className="py-2.5 px-3 text-slate-200">{label}</td>
      <td className="py-2.5 px-3 text-center"><Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-xs px-2">إدخال</Badge></td>
      <td className="py-2.5 px-3 text-center">
        <input
          type="number"
          value={value}
          onChange={e => onChange(fieldKey, e.target.value)}
          className="w-24 bg-slate-700/80 border border-amber-500/50 rounded-lg px-2 py-1 text-white font-mono text-xs text-center focus:outline-none focus:ring-2 focus:ring-amber-500/50"
          dir="ltr"
        />
      </td>
      <td className="py-2.5 px-3 text-left font-mono text-white">{fmtFull(amount)}</td>
      <td className="py-2.5 px-3 text-left text-xs text-amber-400">✏️ {formula}</td>
      <td className="py-2.5 px-3 text-center"><FundingBadge type={funding} /></td>
    </tr>
  );
}

function SummaryCard({ label, value, color, suffix }: { label: string; value: number; color: string; suffix?: string }) {
  const colorMap: Record<string, string> = {
    blue: "from-blue-500/20 to-blue-600/10 border-blue-500/30",
    red: "from-red-500/20 to-red-600/10 border-red-500/30",
    green: "from-emerald-500/20 to-emerald-600/10 border-emerald-500/30",
    purple: "from-purple-500/20 to-purple-600/10 border-purple-500/30",
  };
  const textMap: Record<string, string> = { blue: "text-blue-300", red: "text-red-300", green: "text-emerald-300", purple: "text-purple-300" };
  return (
    <div className={`rounded-xl border bg-gradient-to-br ${colorMap[color]} p-4`}>
      <div className="text-xs text-slate-400 mb-1">{label}</div>
      <div className={`text-xl font-bold font-mono ${textMap[color]}`}>
        {suffix === "%" ? `${value.toFixed(1)}%` : fmt(value)}
      </div>
    </div>
  );
}
