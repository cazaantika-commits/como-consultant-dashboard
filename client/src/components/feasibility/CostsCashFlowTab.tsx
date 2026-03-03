import { useState, useEffect, useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, Sparkles, Save, ShieldCheck, DollarSign, TrendingUp, BarChart3, Calendar, Percent, Building2 } from "lucide-react";
import { Streamdown } from "streamdown";

const JOEL_AVATAR = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663200809965/mCOkEovAXTtxsABs.png";

function fmt(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "0";
  if (n < 100 && n % 1 !== 0) return n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return Math.round(n).toLocaleString("en-US");
}

function EditableNum({ value, onChange, suffix, disabled, className }: { value: number; onChange: (v: number) => void; suffix?: string; disabled?: boolean; className?: string }) {
  const [localVal, setLocalVal] = useState("");
  const [focused, setFocused] = useState(false);
  const displayVal = focused ? localVal : (value ? fmt(value) : "");
  return (
    <div className="relative">
      <Input
        type="text"
        value={displayVal}
        onFocus={() => { setFocused(true); setLocalVal(value ? String(value) : ""); }}
        onBlur={() => { setFocused(false); const n = parseFloat(localVal.replace(/,/g, "")); if (!isNaN(n)) onChange(n); }}
        onChange={(e) => setLocalVal(e.target.value)}
        className={`h-8 text-sm text-center ${className || ""}`}
        disabled={disabled}
        dir="ltr"
      />
      {suffix && <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">{suffix}</span>}
    </div>
  );
}

function CostRow({ label, value, editable, onChange, suffix, pct, highlight }: {
  label: string; value: number; editable?: boolean; onChange?: (v: number) => void;
  suffix?: string; pct?: boolean; highlight?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between py-2 px-3 ${highlight ? "bg-primary/5 rounded-lg font-bold" : ""}`}>
      <span className="text-sm text-right flex-1">{label}</span>
      <div className="w-40 text-left" dir="ltr">
        {editable && onChange ? (
          <EditableNum value={value} onChange={onChange} suffix={pct ? "%" : suffix || "AED"} />
        ) : (
          <span className={`text-sm font-mono ${highlight ? "text-primary text-base" : "text-muted-foreground"}`}>
            {pct ? `${value}%` : `${fmt(value)} ${suffix || "AED"}`}
          </span>
        )}
      </div>
    </div>
  );
}

interface CostsCashFlowTabProps {
  projectId: number | null;
  studyId: number | null;
  form: Record<string, any>;
  computed: Record<string, any>;
}

export default function CostsCashFlowTab({ projectId, studyId, form: feasForm, computed: feasComputed }: CostsCashFlowTabProps) {
  const [smartReport, setSmartReport] = useState("");
  const [isDirty, setIsDirty] = useState(false);

  const [fields, setFields] = useState({
    landPrice: 0,
    agentCommissionLandPct: 1,
    landRegistrationPct: 4,
    soilInvestigation: 0,
    topographySurvey: 0,
    designFeePct: 2,
    supervisionFeePct: 2,
    authoritiesFee: 0,
    separationFeePerM2: 40,
    constructionCostPerSqft: 0,
    communityFee: 0,
    contingenciesPct: 2,
    developerFeePct: 5,
    agentCommissionSalePct: 5,
    marketingPct: 2,
    reraOffplanFee: 150000,
    reraUnitFee: 850,
    nocFee: 10000,
    escrowFee: 140000,
    bankCharges: 20000,
    surveyorFees: 12000,
    reraAuditFees: 18000,
    reraInspectionFees: 70000,
    comoProfitSharePct: 15,
    projectDurationMonths: 36,
    constructionStartMonth: 6,
    constructionDurationMonths: 24,
    salesStartMonth: 1,
    salesDurationMonths: 30,
    salesPhase1Pct: 30,
    salesPhase2Pct: 40,
    salesPhase3Pct: 30,
  });

  const setField = (key: keyof typeof fields, val: number) => {
    setFields(prev => ({ ...prev, [key]: val }));
    setIsDirty(true);
  };

  // Query & mutations
  const costsQuery = trpc.costsCashFlow.getByProject.useQuery(projectId || 0, { enabled: !!projectId });
  const saveMutation = trpc.costsCashFlow.save.useMutation({
    onSuccess: () => { costsQuery.refetch(); toast.success("تم حفظ بيانات التكاليف"); setIsDirty(false); },
    onError: () => toast.error("خطأ في الحفظ"),
  });
  const smartReportMutation = trpc.costsCashFlow.generateSmartReport.useMutation({
    onSuccess: (data) => {
      costsQuery.refetch();
      setSmartReport(data.smartReport);
      try {
        const recs = JSON.parse(data.recommendations);
        setFields(prev => ({
          ...prev,
          constructionCostPerSqft: recs.constructionCostPerSqft || prev.constructionCostPerSqft,
          designFeePct: recs.designFeePct || prev.designFeePct,
          supervisionFeePct: recs.supervisionFeePct || prev.supervisionFeePct,
          contingenciesPct: recs.contingenciesPct || prev.contingenciesPct,
          projectDurationMonths: recs.projectDurationMonths || prev.projectDurationMonths,
          constructionStartMonth: recs.constructionStartMonth || prev.constructionStartMonth,
          constructionDurationMonths: recs.constructionDurationMonths || prev.constructionDurationMonths,
          salesStartMonth: recs.salesStartMonth || prev.salesStartMonth,
          salesDurationMonths: recs.salesDurationMonths || prev.salesDurationMonths,
        }));
        setIsDirty(true);
      } catch { /* ignore parse errors */ }
      toast.success("تم إنشاء التقرير وتعبئة الحقول تلقائياً");
    },
    onError: (err) => toast.error(err.message || "فشل في إنشاء التقرير"),
  });
  const approvalMutation = trpc.costsCashFlow.toggleApproval.useMutation({
    onSuccess: () => { costsQuery.refetch(); toast.success("تم تحديث حالة الاعتماد"); },
  });

  // Load data from DB
  useEffect(() => {
    const d = costsQuery.data;
    if (!d) return;
    setFields({
      landPrice: d.landPrice || 0,
      agentCommissionLandPct: parseFloat(String(d.agentCommissionLandPct || "1")),
      landRegistrationPct: parseFloat(String(d.landRegistrationPct || "4")),
      soilInvestigation: d.soilInvestigation || 0,
      topographySurvey: d.topographySurvey || 0,
      designFeePct: parseFloat(String(d.designFeePct || "2")),
      supervisionFeePct: parseFloat(String(d.supervisionFeePct || "2")),
      authoritiesFee: d.authoritiesFee || 0,
      separationFeePerM2: d.separationFeePerM2 || 40,
      constructionCostPerSqft: d.constructionCostPerSqft || 0,
      communityFee: d.communityFee || 0,
      contingenciesPct: parseFloat(String(d.contingenciesPct || "2")),
      developerFeePct: parseFloat(String(d.developerFeePct || "5")),
      agentCommissionSalePct: parseFloat(String(d.agentCommissionSalePct || "5")),
      marketingPct: parseFloat(String(d.marketingPct || "2")),
      reraOffplanFee: d.reraOffplanFee || 150000,
      reraUnitFee: d.reraUnitFee || 850,
      nocFee: d.nocFee || 10000,
      escrowFee: d.escrowFee || 140000,
      bankCharges: d.bankCharges || 20000,
      surveyorFees: d.surveyorFees || 12000,
      reraAuditFees: d.reraAuditFees || 18000,
      reraInspectionFees: d.reraInspectionFees || 70000,
      comoProfitSharePct: parseFloat(String(d.comoProfitSharePct || "15")),
      projectDurationMonths: d.projectDurationMonths || 36,
      constructionStartMonth: d.constructionStartMonth || 6,
      constructionDurationMonths: d.constructionDurationMonths || 24,
      salesStartMonth: d.salesStartMonth || 1,
      salesDurationMonths: d.salesDurationMonths || 30,
      salesPhase1Pct: parseFloat(String(d.salesPhase1Pct || "30")),
      salesPhase2Pct: parseFloat(String(d.salesPhase2Pct || "40")),
      salesPhase3Pct: parseFloat(String(d.salesPhase3Pct || "30")),
    });
    if (d.aiSmartReport) setSmartReport(d.aiSmartReport);
  }, [costsQuery.data]);

  // Computed values
  const computed = useMemo(() => {
    const bua = feasForm.estimatedBua || feasComputed.estimatedBua || 0;
    const plotAreaM2 = (feasForm.plotArea || 0) * 0.0929;
    const totalUnits = feasComputed.totalUnits || 0;
    const totalRevenue = feasComputed.totalRevenue || 0;

    const agentCommissionLand = fields.landPrice * (fields.agentCommissionLandPct / 100);
    const landRegistration = fields.landPrice * (fields.landRegistrationPct / 100);
    const designFee = (bua * fields.constructionCostPerSqft) * (fields.designFeePct / 100);
    const supervisionFee = (bua * fields.constructionCostPerSqft) * (fields.supervisionFeePct / 100);
    const separationFee = plotAreaM2 * fields.separationFeePerM2;
    const constructionCost = bua * fields.constructionCostPerSqft;
    const contingencies = constructionCost * (fields.contingenciesPct / 100);
    const developerFee = totalRevenue * (fields.developerFeePct / 100);
    const agentCommissionSale = totalRevenue * (fields.agentCommissionSalePct / 100);
    const marketing = totalRevenue * (fields.marketingPct / 100);
    const reraUnitTotal = totalUnits * fields.reraUnitFee;

    const totalCosts = fields.landPrice + agentCommissionLand + landRegistration +
      fields.soilInvestigation + fields.topographySurvey +
      designFee + supervisionFee + fields.authoritiesFee + separationFee +
      constructionCost + fields.communityFee + contingencies +
      developerFee + agentCommissionSale + marketing +
      fields.reraOffplanFee + reraUnitTotal + fields.nocFee +
      fields.escrowFee + fields.bankCharges + fields.surveyorFees +
      fields.reraAuditFees + fields.reraInspectionFees;

    const profit = totalRevenue - totalCosts;
    const roi = totalCosts > 0 ? (profit / totalCosts) * 100 : 0;
    const comoProfit = profit * (fields.comoProfitSharePct / 100);
    const profitMargin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

    return {
      bua, totalRevenue, totalUnits, plotAreaM2,
      agentCommissionLand, landRegistration, designFee, supervisionFee,
      separationFee, constructionCost, contingencies, developerFee,
      agentCommissionSale, marketing, reraUnitTotal, totalCosts,
      profit, roi, comoProfit, profitMargin,
    };
  }, [fields, feasForm, feasComputed]);

  const handleSave = () => {
    if (!projectId) return;
    saveMutation.mutate({ projectId, ...fields });
  };

  if (!projectId) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p>اختر مشروعاً لعرض التكاليف والتدفقات النقدية</p>
      </div>
    );
  }

  const isApproved = costsQuery.data?.isApproved === 1;

  return (
    <div className="space-y-6" dir="rtl">
      {/* شريط الأدوات */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-50"
            onClick={() => smartReportMutation.mutate({ projectId })} disabled={smartReportMutation.isPending}>
            {smartReportMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            تقرير جويل الذكي
          </Button>
          <Button size="sm" variant={isApproved ? "default" : "outline"} className="gap-1.5"
            onClick={() => approvalMutation.mutate({ projectId, approved: !isApproved })}>
            <ShieldCheck className="w-4 h-4" />
            {isApproved ? "معتمد ✓" : "اعتماد"}
          </Button>
        </div>
        <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending || !isDirty} className="gap-1.5">
          {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          حفظ التكاليف
        </Button>
      </div>

      {/* تقرير جويل */}
      {smartReport && (
        <Card className="border-amber-200 bg-gradient-to-br from-amber-50/50 to-orange-50/30">
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 mb-3">
              <img src={JOEL_AVATAR} className="w-7 h-7 rounded-full" alt="Joel" />
              <span className="font-bold text-amber-800">تقرير جويل – تحليل التكاليف</span>
            </div>
            <div className="prose prose-sm max-w-none text-right" dir="rtl">
              <Streamdown>{smartReport}</Streamdown>
            </div>
          </CardContent>
        </Card>
      )}

      {/* بطاقات المؤشرات */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-xs text-blue-600 mb-1">إجمالي الإيرادات</p>
            <p className="text-lg font-bold font-mono text-blue-700" dir="ltr">{fmt(computed.totalRevenue)}</p>
            <p className="text-[10px] text-blue-500">AED</p>
          </CardContent>
        </Card>
        <Card className="bg-red-50 border-red-200">
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-xs text-red-600 mb-1">إجمالي التكاليف</p>
            <p className="text-lg font-bold font-mono text-red-700" dir="ltr">{fmt(computed.totalCosts)}</p>
            <p className="text-[10px] text-red-500">AED</p>
          </CardContent>
        </Card>
        <Card className={computed.profit >= 0 ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}>
          <CardContent className="pt-4 pb-4 text-center">
            <p className={`text-xs mb-1 ${computed.profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>صافي الربح</p>
            <p className={`text-lg font-bold font-mono ${computed.profit >= 0 ? "text-emerald-700" : "text-red-700"}`} dir="ltr">{fmt(computed.profit)}</p>
            <p className={`text-[10px] ${computed.profit >= 0 ? "text-emerald-500" : "text-red-500"}`}>AED</p>
          </CardContent>
        </Card>
        <Card className="bg-purple-50 border-purple-200">
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-xs text-purple-600 mb-1">حصة COMO ({fields.comoProfitSharePct}%)</p>
            <p className="text-lg font-bold font-mono text-purple-700" dir="ltr">{fmt(computed.comoProfit)}</p>
            <p className="text-[10px] text-purple-500">AED</p>
          </CardContent>
        </Card>
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-xs text-amber-600 mb-1">العائد على الاستثمار</p>
            <p className="text-lg font-bold font-mono text-amber-700">{computed.roi.toFixed(1)}%</p>
            <p className="text-[10px] text-amber-500">ROI</p>
          </CardContent>
        </Card>
      </div>

      {/* جدول التكاليف التفصيلي */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-3 border-b pb-2">
                <Building2 className="w-4 h-4 text-primary" />
                <h3 className="font-bold text-sm">تكاليف الأرض</h3>
              </div>
              <div className="space-y-1 divide-y divide-border/30">
                <CostRow label="سعر الأرض" value={fields.landPrice} editable onChange={v => setField("landPrice", v)} />
                <CostRow label="عمولة وسيط الأرض" value={fields.agentCommissionLandPct} editable pct onChange={v => setField("agentCommissionLandPct", v)} />
                <CostRow label="← قيمة العمولة" value={computed.agentCommissionLand} />
                <CostRow label="نسبة تسجيل الأرض" value={fields.landRegistrationPct} editable pct onChange={v => setField("landRegistrationPct", v)} />
                <CostRow label="← رسوم التسجيل" value={computed.landRegistration} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-3 border-b pb-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                <h3 className="font-bold text-sm">تكاليف ما قبل البناء</h3>
              </div>
              <div className="space-y-1 divide-y divide-border/30">
                <CostRow label="فحص التربة" value={fields.soilInvestigation} editable onChange={v => setField("soilInvestigation", v)} />
                <CostRow label="المسح الطبوغرافي" value={fields.topographySurvey} editable onChange={v => setField("topographySurvey", v)} />
                <CostRow label="نسبة أتعاب التصميم" value={fields.designFeePct} editable pct onChange={v => setField("designFeePct", v)} />
                <CostRow label="← أتعاب التصميم" value={computed.designFee} />
                <CostRow label="نسبة أتعاب الإشراف" value={fields.supervisionFeePct} editable pct onChange={v => setField("supervisionFeePct", v)} />
                <CostRow label="← أتعاب الإشراف" value={computed.supervisionFee} />
                <CostRow label="رسوم الجهات الحكومية" value={fields.authoritiesFee} editable onChange={v => setField("authoritiesFee", v)} />
                <CostRow label="رسوم الفصل (لكل م²)" value={fields.separationFeePerM2} editable onChange={v => setField("separationFeePerM2", v)} suffix="AED/m²" />
                <CostRow label="← إجمالي رسوم الفصل" value={computed.separationFee} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-3 border-b pb-2">
                <DollarSign className="w-4 h-4 text-primary" />
                <h3 className="font-bold text-sm">تكاليف البناء</h3>
              </div>
              <div className="space-y-1 divide-y divide-border/30">
                <CostRow label="تكلفة البناء / قدم²" value={fields.constructionCostPerSqft} editable onChange={v => setField("constructionCostPerSqft", v)} suffix="AED/sqft" />
                <CostRow label={`← تكلفة البناء (BUA: ${fmt(computed.bua)} sqft)`} value={computed.constructionCost} />
                <CostRow label="رسوم المجتمع" value={fields.communityFee} editable onChange={v => setField("communityFee", v)} />
                <CostRow label="نسبة الاحتياطي والطوارئ" value={fields.contingenciesPct} editable pct onChange={v => setField("contingenciesPct", v)} />
                <CostRow label="← الاحتياطي والطوارئ" value={computed.contingencies} />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-3 border-b pb-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                <h3 className="font-bold text-sm">تكاليف البيع والتسويق</h3>
              </div>
              <div className="space-y-1 divide-y divide-border/30">
                <CostRow label="نسبة أتعاب المطور (COMO)" value={fields.developerFeePct} editable pct onChange={v => setField("developerFeePct", v)} />
                <CostRow label="← أتعاب المطور" value={computed.developerFee} />
                <CostRow label="نسبة عمولة البيع" value={fields.agentCommissionSalePct} editable pct onChange={v => setField("agentCommissionSalePct", v)} />
                <CostRow label="← عمولة البيع" value={computed.agentCommissionSale} />
                <CostRow label="نسبة التسويق" value={fields.marketingPct} editable pct onChange={v => setField("marketingPct", v)} />
                <CostRow label="← التسويق" value={computed.marketing} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-3 border-b pb-2">
                <Percent className="w-4 h-4 text-primary" />
                <h3 className="font-bold text-sm">الرسوم التنظيمية والإدارية</h3>
              </div>
              <div className="space-y-1 divide-y divide-border/30">
                <CostRow label="رسوم RERA Offplan" value={fields.reraOffplanFee} editable onChange={v => setField("reraOffplanFee", v)} />
                <CostRow label="رسوم تسجيل الوحدة" value={fields.reraUnitFee} editable onChange={v => setField("reraUnitFee", v)} suffix="AED/unit" />
                <CostRow label={`← إجمالي تسجيل الوحدات (${computed.totalUnits} وحدة)`} value={computed.reraUnitTotal} />
                <CostRow label="رسوم NOC" value={fields.nocFee} editable onChange={v => setField("nocFee", v)} />
                <CostRow label="حساب الضمان (Escrow)" value={fields.escrowFee} editable onChange={v => setField("escrowFee", v)} />
                <CostRow label="رسوم البنك" value={fields.bankCharges} editable onChange={v => setField("bankCharges", v)} />
                <CostRow label="أتعاب المساح" value={fields.surveyorFees} editable onChange={v => setField("surveyorFees", v)} />
                <CostRow label="تدقيق RERA" value={fields.reraAuditFees} editable onChange={v => setField("reraAuditFees", v)} />
                <CostRow label="تفتيش RERA" value={fields.reraInspectionFees} editable onChange={v => setField("reraInspectionFees", v)} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-3 border-b pb-2">
                <DollarSign className="w-4 h-4 text-primary" />
                <h3 className="font-bold text-sm">حصة الأرباح</h3>
              </div>
              <CostRow label="نسبة حصة COMO من الأرباح" value={fields.comoProfitSharePct} editable pct onChange={v => setField("comoProfitSharePct", v)} />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ملخص إجمالي التكاليف */}
      <Card className="border-2 border-primary/30 bg-primary/5">
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <span className="font-bold text-lg">إجمالي تكاليف المشروع</span>
            <span className="text-2xl font-bold font-mono text-primary" dir="ltr">{fmt(computed.totalCosts)} AED</span>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-4 text-center text-sm">
            <div>
              <p className="text-muted-foreground text-xs">هامش الربح</p>
              <p className={`font-bold ${computed.profitMargin >= 0 ? "text-emerald-600" : "text-red-600"}`}>{computed.profitMargin.toFixed(1)}%</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">التكلفة / قدم² (BUA)</p>
              <p className="font-bold text-primary" dir="ltr">{computed.bua > 0 ? fmt(computed.totalCosts / computed.bua) : "0"} AED</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">الربح / قدم² (BUA)</p>
              <p className={`font-bold ${computed.profit >= 0 ? "text-emerald-600" : "text-red-600"}`} dir="ltr">
                {computed.bua > 0 ? fmt(computed.profit / computed.bua) : "0"} AED
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* الجدول الزمني */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 mb-4 border-b pb-2">
            <Calendar className="w-4 h-4 text-primary" />
            <h3 className="font-bold text-sm">الجدول الزمني للمشروع</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-muted-foreground">المشروع</h4>
              <CostRow label="مدة المشروع (شهر)" value={fields.projectDurationMonths} editable onChange={v => setField("projectDurationMonths", v)} suffix="شهر" />
            </div>
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-muted-foreground">البناء</h4>
              <CostRow label="بدء البناء (شهر)" value={fields.constructionStartMonth} editable onChange={v => setField("constructionStartMonth", v)} suffix="شهر" />
              <CostRow label="مدة البناء (شهر)" value={fields.constructionDurationMonths} editable onChange={v => setField("constructionDurationMonths", v)} suffix="شهر" />
            </div>
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-muted-foreground">المبيعات</h4>
              <CostRow label="بدء المبيعات (شهر)" value={fields.salesStartMonth} editable onChange={v => setField("salesStartMonth", v)} suffix="شهر" />
              <CostRow label="مدة المبيعات (شهر)" value={fields.salesDurationMonths} editable onChange={v => setField("salesDurationMonths", v)} suffix="شهر" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t">
            <h4 className="text-xs font-bold text-muted-foreground mb-2">توزيع المبيعات على المراحل</h4>
            <div className="grid grid-cols-3 gap-3">
              <CostRow label="المرحلة 1" value={fields.salesPhase1Pct} editable pct onChange={v => setField("salesPhase1Pct", v)} />
              <CostRow label="المرحلة 2" value={fields.salesPhase2Pct} editable pct onChange={v => setField("salesPhase2Pct", v)} />
              <CostRow label="المرحلة 3" value={fields.salesPhase3Pct} editable pct onChange={v => setField("salesPhase3Pct", v)} />
            </div>
            {Math.abs(fields.salesPhase1Pct + fields.salesPhase2Pct + fields.salesPhase3Pct - 100) > 0.1 && (
              <p className="text-xs text-red-500 mt-1 text-center">
                ⚠️ مجموع نسب المراحل = {(fields.salesPhase1Pct + fields.salesPhase2Pct + fields.salesPhase3Pct).toFixed(0)}% (يجب أن يكون 100%)
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* زر الحفظ السفلي */}
      <div className="flex justify-center gap-3 pt-2">
        <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending || !isDirty} className="gap-1.5 min-w-[140px]">
          {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          حفظ التكاليف
        </Button>
      </div>
    </div>
  );
}
