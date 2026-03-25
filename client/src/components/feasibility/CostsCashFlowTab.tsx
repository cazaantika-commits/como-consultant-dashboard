import { useState, useEffect, useMemo, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { DEFAULT_AVG_AREAS } from "@shared/feasibilityUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Loader2, Sparkles, DollarSign,
  TrendingUp, TrendingDown, BarChart3, Save, Zap, CheckCircle2,
  Car
} from "lucide-react";

const JOEL_AVATAR = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663200809965/mCOkEovAXTtxsABs.png";

/* ═══ Parking Standards — Dubai Development Authority (sqft) ═══ */
const PARKING = {
  residential: { threshold: 1615, below: 1, above: 2 },
  retail: { perSqft: 753 },
  offices: { perSqft: 538 },
};

/* ═══ Helpers ═══ */
function fmt(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "0";
  if (n < 100 && n % 1 !== 0) return n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return Math.round(n).toLocaleString("en-US");
}

function EditableNum({ value, onChange, suffix, disabled, className: extraClass }: { value: number; onChange: (v: number) => void; suffix?: string; disabled?: boolean; className?: string }) {
  const [localVal, setLocalVal] = useState("");
  const [focused, setFocused] = useState(false);
  const displayVal = focused ? localVal : (value ? fmt(value) : "");
  return (
    <div className="relative">
      <Input type="text" value={displayVal}
        onFocus={() => { setFocused(true); setLocalVal(value ? String(value) : ""); }}
        onBlur={() => { setFocused(false); const n = parseFloat(localVal.replace(/,/g, "")); if (!isNaN(n)) onChange(n); }}
        onChange={(e) => setLocalVal(e.target.value)}
        className={`h-6 text-[11px] text-center border-0 border-b border-dashed border-gray-300 rounded-none bg-transparent focus:border-blue-400 focus:bg-blue-50/30 px-1 ${extraClass || ""}`}
        disabled={disabled} dir="ltr" />
      {suffix && <span className="absolute left-0.5 top-1/2 -translate-y-1/2 text-[8px] text-gray-400">{suffix}</span>}
    </div>
  );
}

type ScenarioKey = "optimistic" | "base" | "conservative";

/* ═══ Zero-Waste Distribution Algorithm ═══ */
interface UnitType {
  key: string;
  label: string;
  pct: number;
  avgArea: number;
  basePricePerSqft: number;
}

interface DistResult {
  key: string;
  label: string;
  pct: number;
  avgArea: number;
  allocated: number;
  units: number;
  surplus: number;
  parking: number;
  basePricePerSqft: number;
  unitPrice: number;
  totalArea: number;
  revenueBase: number;
  revenueOpt: number;
  revenueCons: number;
}

function zeroWasteDistribute(types: UnitType[], totalSellable: number): DistResult[] {
  if (totalSellable <= 0 || types.length === 0) return [];
  const activeTypes = types.filter(t => t.pct > 0 && t.avgArea > 0);
  if (activeTypes.length === 0) return [];

  let results: DistResult[] = activeTypes.map(t => {
    const allocated = totalSellable * (t.pct / 100);
    const units = Math.floor(allocated / t.avgArea);
    return {
      key: t.key, label: t.label, pct: t.pct, avgArea: t.avgArea,
      allocated, units, surplus: 0, parking: 0,
      basePricePerSqft: t.basePricePerSqft,
      unitPrice: t.avgArea * t.basePricePerSqft,
      totalArea: units * t.avgArea,
      revenueBase: 0, revenueOpt: 0, revenueCons: 0,
    };
  });

  let totalSurplus = results.reduce((s, r) => s + (r.allocated - r.units * r.avgArea), 0);
  const sortedByArea = [...results].sort((a, b) => a.avgArea - b.avgArea);
  for (const item of sortedByArea) {
    while (totalSurplus >= item.avgArea) {
      const r = results.find(r => r.key === item.key)!;
      r.units += 1;
      r.totalArea = r.units * r.avgArea;
      totalSurplus -= item.avgArea;
    }
  }

  const usedArea = results.reduce((s, r) => s + r.units * r.avgArea, 0);
  const finalSurplus = totalSellable - usedArea;
  results = results.map(r => ({ ...r, surplus: 0, totalArea: r.units * r.avgArea }));
  if (finalSurplus > 0 && results.length > 0) {
    const largestIdx = results.reduce((maxIdx, r, i, arr) => r.avgArea > arr[maxIdx].avgArea ? i : maxIdx, 0);
    results[largestIdx].surplus = finalSurplus;
  }
  return results;
}

function calcParking(results: DistResult[], category: "residential" | "retail" | "offices"): DistResult[] {
  return results.map(r => {
    let parking = 0;
    if (category === "residential") {
      parking = r.units * (r.avgArea <= PARKING.residential.threshold ? PARKING.residential.below : PARKING.residential.above);
    } else if (category === "retail") {
      parking = Math.ceil((r.units * r.avgArea) / PARKING.retail.perSqft);
    } else {
      parking = Math.ceil((r.units * r.avgArea) / PARKING.offices.perSqft);
    }
    return { ...r, parking };
  });
}

function calcRevenue(results: DistResult[]): DistResult[] {
  return results.map(r => ({
    ...r,
    unitPrice: r.avgArea * r.basePricePerSqft,
    revenueBase: r.units * r.avgArea * r.basePricePerSqft,
    revenueOpt: r.units * r.avgArea * r.basePricePerSqft * 1.10,
    revenueCons: r.units * r.avgArea * r.basePricePerSqft * 0.90,
  }));
}

/* ═══ MAIN COMPONENT ═══ */
interface CostsCashFlowTabProps {
  projectId: number | null;
  studyId: number | null;
  form: Record<string, any>;
  computed: Record<string, any>;
}

export default function CostsCashFlowTab({ projectId, studyId }: CostsCashFlowTabProps) {
  const projectQuery = trpc.projects.getById.useQuery(projectId || 0, { enabled: !!projectId, staleTime: 5000 });
  const project = projectQuery.data;
  const moQuery = trpc.marketOverview.getByProject.useQuery(projectId || 0, { enabled: !!projectId, staleTime: 5000 });
  const cpQuery = trpc.competitionPricing.getByProject.useQuery(projectId || 0, { enabled: !!projectId, staleTime: 2000, refetchOnWindowFocus: true });
  const joelleStatusQuery = trpc.joelleEngine.getAutoPopulateStatus.useQuery(projectId || 0, { enabled: !!projectId, staleTime: 10000 });

  const applyJoelleMutation = trpc.joelleEngine.applyJoelleOutputs.useMutation({
    onSuccess: (data) => {
      moQuery.refetch(); cpQuery.refetch(); joelleStatusQuery.refetch();
      if (data.marketOverview && data.competitionPricing) toast.success("تم تطبيق مخرجات جويل بنجاح");
      else if (data.marketOverview) toast.success("تم تطبيق توزيع الوحدات");
      else if (data.competitionPricing) toast.success("تم تطبيق التسعير");
      else toast.info("لا توجد مخرجات جاهزة — شغّل المحركات أولاً");
    },
    onError: (err) => toast.error(err.message || "فشل في تطبيق مخرجات جويل"),
  });

  // ═══ Distribution state ═══
  const [moFields, setMoFields] = useState({
    residentialStudioPct: 0, residentialStudioAvgArea: 0,
    residential1brPct: 0, residential1brAvgArea: 0,
    residential2brPct: 0, residential2brAvgArea: 0,
    residential3brPct: 0, residential3brAvgArea: 0,
    retailSmallPct: 0, retailSmallAvgArea: 0,
    retailMediumPct: 0, retailMediumAvgArea: 0,
    retailLargePct: 0, retailLargeAvgArea: 0,
    officeSmallPct: 0, officeSmallAvgArea: 0,
    officeMediumPct: 0, officeMediumAvgArea: 0,
    officeLargePct: 0, officeLargeAvgArea: 0,
  });
  const [moDirty, setMoDirty] = useState(false);
  const [moJoelleSource, setMoJoelleSource] = useState(false);

  // ═══ Pricing state ═══
  const [basePrices, setBasePrices] = useState({
    studioPrice: 0, oneBrPrice: 0, twoBrPrice: 0, threeBrPrice: 0,
    retailSmallPrice: 0, retailMediumPrice: 0, retailLargePrice: 0,
    officeSmallPrice: 0, officeMediumPrice: 0, officeLargePrice: 0,
  });
  const [activeScenario, setActiveScenario] = useState<ScenarioKey>("base");
  const [cpDirty, setCpDirty] = useState(false);
  const [cpJoelleSource, setCpJoelleSource] = useState(false);

  // ═══ Save mutations ═══
  const moSaveMutation = trpc.marketOverview.save.useMutation({
    onSuccess: () => { moQuery.refetch(); toast.success("تم حفظ توزيع الوحدات"); setMoDirty(false); },
    onError: () => toast.error("خطأ في الحفظ"),
  });
  const cpSaveMutation = trpc.competitionPricing.save.useMutation({
    onSuccess: () => { cpQuery.refetch(); toast.success("تم حفظ التسعير"); setCpDirty(false); },
    onError: () => toast.error("خطأ في الحفظ"),
  });

  // ═══ Load data from DB ═══
  useEffect(() => {
    if (moQuery.data) {
      const d = moQuery.data;
      setMoFields({
        residentialStudioPct: parseFloat(d.residentialStudioPct || "0"),
        residentialStudioAvgArea: d.residentialStudioAvgArea || 0,
        residential1brPct: parseFloat(d.residential1brPct || "0"),
        residential1brAvgArea: d.residential1brAvgArea || 0,
        residential2brPct: parseFloat(d.residential2brPct || "0"),
        residential2brAvgArea: d.residential2brAvgArea || 0,
        residential3brPct: parseFloat(d.residential3brPct || "0"),
        residential3brAvgArea: d.residential3brAvgArea || 0,
        retailSmallPct: parseFloat(d.retailSmallPct || "0"),
        retailSmallAvgArea: d.retailSmallAvgArea || 0,
        retailMediumPct: parseFloat(d.retailMediumPct || "0"),
        retailMediumAvgArea: d.retailMediumAvgArea || 0,
        retailLargePct: parseFloat(d.retailLargePct || "0"),
        retailLargeAvgArea: d.retailLargeAvgArea || 0,
        officeSmallPct: parseFloat(d.officeSmallPct || "0"),
        officeSmallAvgArea: d.officeSmallAvgArea || 0,
        officeMediumPct: parseFloat(d.officeMediumPct || "0"),
        officeMediumAvgArea: d.officeMediumAvgArea || 0,
        officeLargePct: parseFloat(d.officeLargePct || "0"),
        officeLargeAvgArea: d.officeLargeAvgArea || 0,
      });
      if (d.aiRecommendationsJson) setMoJoelleSource(true);
    }
  }, [moQuery.data]);

  useEffect(() => {
    if (cpQuery.data) {
      const d = cpQuery.data;
      setBasePrices({
        studioPrice: d.baseStudioPrice || 0,
        oneBrPrice: d.base1brPrice || 0,
        twoBrPrice: d.base2brPrice || 0,
        threeBrPrice: d.base3brPrice || 0,
        retailSmallPrice: d.baseRetailSmallPrice || 0,
        retailMediumPrice: d.baseRetailMediumPrice || 0,
        retailLargePrice: d.baseRetailLargePrice || 0,
        officeSmallPrice: d.baseOfficeSmallPrice || 0,
        officeMediumPrice: d.baseOfficeMediumPrice || 0,
        officeLargePrice: d.baseOfficeLargePrice || 0,
      });
      if (d.activeScenario) setActiveScenario(d.activeScenario as ScenarioKey);
      if (d.aiRecommendationsJson) setCpJoelleSource(true);
    }
  }, [cpQuery.data]);

  const updateMoField = useCallback((key: string, value: number) => {
    setMoFields(prev => ({ ...prev, [key]: value }));
    setMoDirty(true);
  }, []);

  const updateBasePrice = useCallback((key: string, value: number) => {
    setBasePrices(prev => ({ ...prev, [key]: value }));
    setCpDirty(true);
  }, []);

  const getAvg = useCallback((pctKey: string, avgVal: number) => {
    if (avgVal > 0) return avgVal;
    const mapping = DEFAULT_AVG_AREAS[pctKey];
    return mapping ? mapping.defaultArea : 0;
  }, []);

  // ═══ Project data ═══
  const p = project || {} as any;
  const plotAreaSqft = parseFloat(p.plotAreaSqft || "0");
  const plotAreaSqm = parseFloat(p.plotAreaSqm || "0");
  const gfaTotalSqft = parseFloat(p.gfaSqft || "0");
  const gfaResSqft = parseFloat(p.gfaResidentialSqft || "0");
  const gfaRetSqft = parseFloat(p.gfaRetailSqft || "0");
  const gfaOffSqft = parseFloat(p.gfaOfficesSqft || "0");
  const buaSqft = parseFloat(p.manualBuaSqft || "0");

  const sellableRes = gfaResSqft * 0.95;
  const sellableRet = gfaRetSqft * 0.97;
  const sellableOff = gfaOffSqft * 0.95;
  const totalSellable = sellableRes + sellableRet + sellableOff;

  // ═══ Joel's suggestions ═══
  const joelSuggestions = useMemo(() => {
    try {
      const moData = moQuery.data;
      const cpData = cpQuery.data;
      if (!moData?.aiRecommendationsJson && !cpData?.aiRecommendationsJson) return null;
      const moRec = moData?.aiRecommendationsJson ? JSON.parse(moData.aiRecommendationsJson) : {};
      const cpRec = cpData?.aiRecommendationsJson ? JSON.parse(cpData.aiRecommendationsJson) : {};
      return { distribution: moRec, pricing: cpRec };
    } catch { return null; }
  }, [moQuery.data, cpQuery.data]);

  // ═══ Distribution calculations ═══
  const resTypes: UnitType[] = useMemo(() => [
    { key: "studio", label: "استديو", pct: moFields.residentialStudioPct, avgArea: getAvg("residentialStudioPct", moFields.residentialStudioAvgArea), basePricePerSqft: basePrices.studioPrice },
    { key: "1br", label: "غرفة وصالة", pct: moFields.residential1brPct, avgArea: getAvg("residential1brPct", moFields.residential1brAvgArea), basePricePerSqft: basePrices.oneBrPrice },
    { key: "2br", label: "غرفتان وصالة", pct: moFields.residential2brPct, avgArea: getAvg("residential2brPct", moFields.residential2brAvgArea), basePricePerSqft: basePrices.twoBrPrice },
    { key: "3br", label: "ثلاث غرف وصالة", pct: moFields.residential3brPct, avgArea: getAvg("residential3brPct", moFields.residential3brAvgArea), basePricePerSqft: basePrices.threeBrPrice },
  ], [moFields, basePrices, getAvg]);

  const retTypes: UnitType[] = useMemo(() => [
    { key: "retSmall", label: "صغيرة", pct: moFields.retailSmallPct, avgArea: getAvg("retailSmallPct", moFields.retailSmallAvgArea), basePricePerSqft: basePrices.retailSmallPrice },
    { key: "retMedium", label: "متوسطة", pct: moFields.retailMediumPct, avgArea: getAvg("retailMediumPct", moFields.retailMediumAvgArea), basePricePerSqft: basePrices.retailMediumPrice },
    { key: "retLarge", label: "كبيرة", pct: moFields.retailLargePct, avgArea: getAvg("retailLargePct", moFields.retailLargeAvgArea), basePricePerSqft: basePrices.retailLargePrice },
  ], [moFields, basePrices, getAvg]);

  const offTypes: UnitType[] = useMemo(() => [
    { key: "offSmall", label: "صغيرة", pct: moFields.officeSmallPct, avgArea: getAvg("officeSmallPct", moFields.officeSmallAvgArea), basePricePerSqft: basePrices.officeSmallPrice },
    { key: "offMedium", label: "متوسطة", pct: moFields.officeMediumPct, avgArea: getAvg("officeMediumPct", moFields.officeMediumAvgArea), basePricePerSqft: basePrices.officeMediumPrice },
    { key: "offLarge", label: "كبيرة", pct: moFields.officeLargePct, avgArea: getAvg("officeLargePct", moFields.officeLargeAvgArea), basePricePerSqft: basePrices.officeLargePrice },
  ], [moFields, basePrices, getAvg]);

  const resResults = useMemo(() => calcRevenue(calcParking(zeroWasteDistribute(resTypes, sellableRes), "residential")), [resTypes, sellableRes]);
  const retResults = useMemo(() => calcRevenue(calcParking(zeroWasteDistribute(retTypes, sellableRet), "retail")), [retTypes, sellableRet]);
  const offResults = useMemo(() => calcRevenue(calcParking(zeroWasteDistribute(offTypes, sellableOff), "offices")), [offTypes, sellableOff]);

  const totalUnits = [...resResults, ...retResults, ...offResults].reduce((s, r) => s + r.units, 0);
  const totalParking = [...resResults, ...retResults, ...offResults].reduce((s, r) => s + r.parking, 0);
  const totalSurplus = [...resResults, ...retResults, ...offResults].reduce((s, r) => s + r.surplus, 0);
  const totalRevenueBase = [...resResults, ...retResults, ...offResults].reduce((s, r) => s + r.revenueBase, 0);
  const totalRevenueOpt = [...resResults, ...retResults, ...offResults].reduce((s, r) => s + r.revenueOpt, 0);
  const totalRevenueCons = [...resResults, ...retResults, ...offResults].reduce((s, r) => s + r.revenueCons, 0);

  const resTotalPct = moFields.residentialStudioPct + moFields.residential1brPct + moFields.residential2brPct + moFields.residential3brPct;
  const retTotalPct = moFields.retailSmallPct + moFields.retailMediumPct + moFields.retailLargePct;
  const offTotalPct = moFields.officeSmallPct + moFields.officeMediumPct + moFields.officeLargePct;

  // ═══ Save handlers ═══
  const handleSaveMo = () => {
    if (!projectId) return;
    moSaveMutation.mutate({ projectId, ...moFields, finishingQuality: "standard" });
  };
  const handleSaveCp = () => {
    if (!projectId) return;
    cpSaveMutation.mutate({
      projectId,
      baseStudioPrice: basePrices.studioPrice, base1brPrice: basePrices.oneBrPrice, base2brPrice: basePrices.twoBrPrice, base3brPrice: basePrices.threeBrPrice,
      baseRetailSmallPrice: basePrices.retailSmallPrice, baseRetailMediumPrice: basePrices.retailMediumPrice, baseRetailLargePrice: basePrices.retailLargePrice,
      baseOfficeSmallPrice: basePrices.officeSmallPrice, baseOfficeMediumPrice: basePrices.officeMediumPrice, baseOfficeLargePrice: basePrices.officeLargePrice,
      optStudioPrice: Math.round(basePrices.studioPrice * 1.1), opt1brPrice: Math.round(basePrices.oneBrPrice * 1.1), opt2brPrice: Math.round(basePrices.twoBrPrice * 1.1), opt3brPrice: Math.round(basePrices.threeBrPrice * 1.1),
      optRetailSmallPrice: Math.round(basePrices.retailSmallPrice * 1.1), optRetailMediumPrice: Math.round(basePrices.retailMediumPrice * 1.1), optRetailLargePrice: Math.round(basePrices.retailLargePrice * 1.1),
      optOfficeSmallPrice: Math.round(basePrices.officeSmallPrice * 1.1), optOfficeMediumPrice: Math.round(basePrices.officeMediumPrice * 1.1), optOfficeLargePrice: Math.round(basePrices.officeLargePrice * 1.1),
      consStudioPrice: Math.round(basePrices.studioPrice * 0.9), cons1brPrice: Math.round(basePrices.oneBrPrice * 0.9), cons2brPrice: Math.round(basePrices.twoBrPrice * 0.9), cons3brPrice: Math.round(basePrices.threeBrPrice * 0.9),
      consRetailSmallPrice: Math.round(basePrices.retailSmallPrice * 0.9), consRetailMediumPrice: Math.round(basePrices.retailMediumPrice * 0.9), consRetailLargePrice: Math.round(basePrices.retailLargePrice * 0.9),
      consOfficeSmallPrice: Math.round(basePrices.officeSmallPrice * 0.9), consOfficeMediumPrice: Math.round(basePrices.officeMediumPrice * 0.9), consOfficeLargePrice: Math.round(basePrices.officeLargePrice * 0.9),
      activeScenario,
      paymentBookingPct: 10, paymentBookingTiming: "عند التوقيع",
      paymentConstructionPct: 60, paymentConstructionTiming: "أثناء الإنشاء",
      paymentHandoverPct: 30, paymentHandoverTiming: "عند التسليم",
      paymentDeferredPct: 0, paymentDeferredTiming: "",
    });
  };
  const handleSaveAll = () => { handleSaveMo(); handleSaveCp(); };

  const joelleStatus = joelleStatusQuery.data;
  const hasAnyJoelleData = joelleStatus?.engine6Ready || joelleStatus?.engine7Ready;
  const alreadyApplied = joelleStatus?.moHasJoelleData && joelleStatus?.cpHasJoelleData;

  const scenarioConfig: Record<ScenarioKey, { label: string; color: string; bgBadge: string; multiplier: number; icon: any }> = {
    optimistic: { label: "متفائل +10%", color: "text-emerald-700", bgBadge: "bg-emerald-500", multiplier: 1.10, icon: TrendingUp },
    base: { label: "أساسي", color: "text-blue-700", bgBadge: "bg-blue-500", multiplier: 1.00, icon: BarChart3 },
    conservative: { label: "متحفظ -10%", color: "text-orange-700", bgBadge: "bg-orange-500", multiplier: 0.90, icon: TrendingDown },
  };

  // ═══ RENDER ═══
  if (!projectId) return (<div className="text-center py-12 text-muted-foreground"><DollarSign className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>اختر مشروعاً لعرض البيانات</p></div>);
  if (projectQuery.isLoading) return (<div className="text-center py-12"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /><p className="text-sm text-muted-foreground mt-2">جاري تحميل البيانات...</p></div>);

  // ═══ Joel suggestion rows ═══
  const joelRows = [
    { cat: "سكني", catColor: "bg-sky-500", label: "استديو", pctKey: "residentialStudioPct", avgKey: "residentialStudioAvgArea", priceKey: "studioPrice", baseField: "baseStudioPrice" },
    { cat: "", catColor: "", label: "غرفة وصالة", pctKey: "residential1brPct", avgKey: "residential1brAvgArea", priceKey: "oneBrPrice", baseField: "base1brPrice" },
    { cat: "", catColor: "", label: "غرفتان وصالة", pctKey: "residential2brPct", avgKey: "residential2brAvgArea", priceKey: "twoBrPrice", baseField: "base2brPrice" },
    { cat: "", catColor: "", label: "ثلاث غرف", pctKey: "residential3brPct", avgKey: "residential3brAvgArea", priceKey: "threeBrPrice", baseField: "base3brPrice" },
    { cat: "تجزئة", catColor: "bg-amber-500", label: "صغيرة", pctKey: "retailSmallPct", avgKey: "retailSmallAvgArea", priceKey: "retailSmallPrice", baseField: "baseRetailSmallPrice", divider: true },
    { cat: "", catColor: "", label: "متوسطة", pctKey: "retailMediumPct", avgKey: "retailMediumAvgArea", priceKey: "retailMediumPrice", baseField: "baseRetailMediumPrice" },
    { cat: "", catColor: "", label: "كبيرة", pctKey: "retailLargePct", avgKey: "retailLargeAvgArea", priceKey: "retailLargePrice", baseField: "baseRetailLargePrice" },
    { cat: "مكاتب", catColor: "bg-violet-500", label: "صغيرة", pctKey: "officeSmallPct", avgKey: "officeSmallAvgArea", priceKey: "officeSmallPrice", baseField: "baseOfficeSmallPrice", divider: true },
    { cat: "", catColor: "", label: "متوسطة", pctKey: "officeMediumPct", avgKey: "officeMediumAvgArea", priceKey: "officeMediumPrice", baseField: "baseOfficeMediumPrice" },
    { cat: "", catColor: "", label: "كبيرة", pctKey: "officeLargePct", avgKey: "officeLargeAvgArea", priceKey: "officeLargePrice", baseField: "baseOfficeLargePrice" },
  ];

  // ═══ Distribution table fields ═══
  const allDistFields = [
    { key: "studio", label: "استديو", pctKey: "residentialStudioPct", avgKey: "residentialStudioAvgArea", priceKey: "studioPrice", cat: "residential", catLabel: "سكني", catColor: "bg-sky-500" },
    { key: "1br", label: "غرفة وصالة", pctKey: "residential1brPct", avgKey: "residential1brAvgArea", priceKey: "oneBrPrice", cat: "residential", catLabel: "", catColor: "" },
    { key: "2br", label: "غرفتان وصالة", pctKey: "residential2brPct", avgKey: "residential2brAvgArea", priceKey: "twoBrPrice", cat: "residential", catLabel: "", catColor: "" },
    { key: "3br", label: "ثلاث غرف وصالة", pctKey: "residential3brPct", avgKey: "residential3brAvgArea", priceKey: "threeBrPrice", cat: "residential", catLabel: "", catColor: "" },
    { key: "retSmall", label: "صغيرة", pctKey: "retailSmallPct", avgKey: "retailSmallAvgArea", priceKey: "retailSmallPrice", cat: "retail", catLabel: "تجزئة", catColor: "bg-amber-500", divider: true },
    { key: "retMedium", label: "متوسطة", pctKey: "retailMediumPct", avgKey: "retailMediumAvgArea", priceKey: "retailMediumPrice", cat: "retail", catLabel: "", catColor: "" },
    { key: "retLarge", label: "كبيرة", pctKey: "retailLargePct", avgKey: "retailLargeAvgArea", priceKey: "retailLargePrice", cat: "retail", catLabel: "", catColor: "" },
    { key: "offSmall", label: "صغيرة", pctKey: "officeSmallPct", avgKey: "officeSmallAvgArea", priceKey: "officeSmallPrice", cat: "offices", catLabel: "مكاتب", catColor: "bg-violet-500", divider: true },
    { key: "offMedium", label: "متوسطة", pctKey: "officeMediumPct", avgKey: "officeMediumAvgArea", priceKey: "officeMediumPrice", cat: "offices", catLabel: "", catColor: "" },
    { key: "offLarge", label: "كبيرة", pctKey: "officeLargePct", avgKey: "officeLargeAvgArea", priceKey: "officeLargePrice", cat: "offices", catLabel: "", catColor: "" },
  ];

  const allResults = [...resResults, ...retResults, ...offResults];

  // Category subtotals
  const catSummary = (results: DistResult[], sellable: number, totalPct: number, catKey: string) => {
    const units = results.reduce((s, r) => s + r.units, 0);
    const area = results.reduce((s, r) => s + r.totalArea, 0);
    const parking = results.reduce((s, r) => s + r.parking, 0);
    const surplus = results.reduce((s, r) => s + r.surplus, 0);
    const revBase = results.reduce((s, r) => s + r.revenueBase, 0);
    const revOpt = results.reduce((s, r) => s + r.revenueOpt, 0);
    const revCons = results.reduce((s, r) => s + r.revenueCons, 0);
    return { units, area, parking, surplus, revBase, revOpt, revCons, sellable, totalPct };
  };
  const resSummary = catSummary(resResults, sellableRes, resTotalPct, "residential");
  const retSummary = catSummary(retResults, sellableRet, retTotalPct, "retail");
  const offSummary = catSummary(offResults, sellableOff, offTotalPct, "offices");

  return (
    <div className="space-y-3" dir="rtl">

      {/* ═══ JOELLE BANNER ═══ */}
      {hasAnyJoelleData && (
        <div className="flex items-center justify-between bg-gradient-to-l from-purple-50 to-pink-50 border border-purple-200/60 rounded-lg px-3 py-2">
          <div className="flex items-center gap-2">
            <img src={JOEL_AVATAR} className="w-7 h-7 rounded-full border border-purple-200" alt="جويل" />
            <span className="text-[11px] font-semibold text-purple-800">مخرجات جويل جاهزة</span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${joelleStatus?.engine6Ready ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
              {joelleStatus?.engine6Ready ? "✓" : "○"} محرك 6
            </span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${joelleStatus?.engine7Ready ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
              {joelleStatus?.engine7Ready ? "✓" : "○"} محرك 7
            </span>
          </div>
          <Button size="sm" variant="ghost"
            onClick={() => { if (projectId) applyJoelleMutation.mutate(projectId); }}
            disabled={applyJoelleMutation.isPending}
            className={`gap-1 h-7 text-[11px] ${alreadyApplied ? "text-emerald-700" : "text-purple-700 hover:bg-purple-100"}`}
          >
            {applyJoelleMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : alreadyApplied ? <CheckCircle2 className="w-3 h-3" /> : <Zap className="w-3 h-3" />}
            {alreadyApplied ? "إعادة تطبيق" : "تعبئة من جويل"}
          </Button>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* SECTION 1: تفاصيل الأرض و GFA                          */}
      {/* ═══════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-2 border-b border-gray-100 bg-gray-50/50">
          <h3 className="text-xs font-bold text-gray-800">تفاصيل الأرض والمساحات</h3>
        </div>
        <div className="px-4 py-2.5">
          {/* Land info — compact inline */}
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-[11px] mb-2.5">
            <span className="text-gray-500">مساحة الأرض: <b className="text-gray-800 font-mono" dir="ltr">{fmt(plotAreaSqft)}</b> sqft <span className="text-gray-400">({fmt(plotAreaSqm)} م²)</span></span>
            <span className="text-gray-500">BUA: <b className="text-gray-800 font-mono" dir="ltr">{fmt(buaSqft)}</b> sqft</span>
            <span className="text-gray-500">GFA الإجمالي: <b className="text-gray-800 font-mono" dir="ltr">{fmt(gfaTotalSqft)}</b> sqft</span>
          </div>

          {/* GFA Breakdown table — compact */}
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-right py-1.5 pr-1 font-semibold text-gray-600 w-8">#</th>
                <th className="text-right py-1.5 font-semibold text-gray-600">الفئة</th>
                <th className="text-center py-1.5 font-semibold text-gray-600">GFA (sqft)</th>
                <th className="text-center py-1.5 font-semibold text-gray-600">الكفاءة</th>
                <th className="text-center py-1.5 font-semibold text-gray-600">القابل للبيع (sqft)</th>
                <th className="text-center py-1.5 font-semibold text-gray-600">% من الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              {[
                { n: 1, label: "الوحدات السكنية", gfa: gfaResSqft, eff: 0.95, sell: sellableRes, color: "bg-sky-500" },
                { n: 2, label: "وحدات التجزئة", gfa: gfaRetSqft, eff: 0.97, sell: sellableRet, color: "bg-amber-500" },
                { n: 3, label: "المكاتب", gfa: gfaOffSqft, eff: 0.95, sell: sellableOff, color: "bg-violet-500" },
              ].filter(r => r.gfa > 0).map(r => (
                <tr key={r.n} className="border-b border-gray-100 hover:bg-gray-50/50">
                  <td className="py-1.5 pr-1 text-gray-400 font-mono">{r.n}</td>
                  <td className="py-1.5 font-medium text-gray-800 flex items-center gap-1.5"><span className={`w-2 h-2 rounded-full ${r.color} inline-block`} />{r.label}</td>
                  <td className="py-1.5 text-center font-mono text-gray-700" dir="ltr">{fmt(r.gfa)}</td>
                  <td className="py-1.5 text-center"><span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full">{(r.eff * 100).toFixed(0)}%</span></td>
                  <td className="py-1.5 text-center font-mono font-bold text-gray-900" dir="ltr">{fmt(r.sell)}</td>
                  <td className="py-1.5 text-center text-gray-600">{totalSellable > 0 ? ((r.sell / totalSellable) * 100).toFixed(1) : 0}%</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-300 font-bold">
                <td className="py-1.5 pr-1"></td>
                <td className="py-1.5 text-gray-800">الإجمالي</td>
                <td className="py-1.5 text-center font-mono text-gray-700" dir="ltr">{fmt(gfaResSqft + gfaRetSqft + gfaOffSqft)}</td>
                <td className="py-1.5 text-center">—</td>
                <td className="py-1.5 text-center font-mono text-gray-900" dir="ltr">{fmt(totalSellable)}</td>
                <td className="py-1.5 text-center">100%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* SECTION 2: اقتراحات جويل (مرجع)                        */}
      {/* ═══════════════════════════════════════════════════════ */}
      {(moJoelleSource || cpJoelleSource) && (
        <div className="bg-white rounded-lg border border-purple-200/60 overflow-hidden">
          <div className="px-4 py-2 border-b border-purple-100 bg-purple-50/30 flex items-center gap-2">
            <img src={JOEL_AVATAR} className="w-5 h-5 rounded-full" alt="" />
            <h3 className="text-xs font-bold text-purple-800">اقتراحات جويل</h3>
            <span className="text-[9px] bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full font-medium">للقراءة فقط</span>
          </div>
          <div className="px-4 py-1.5">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-purple-100">
                  <th className="text-right py-1.5 font-semibold text-purple-700 w-16">الفئة</th>
                  <th className="text-right py-1.5 font-semibold text-purple-700">النوع</th>
                  <th className="text-center py-1.5 font-semibold text-purple-700 w-16">النسبة</th>
                  <th className="text-center py-1.5 font-semibold text-purple-700 w-20">المساحة</th>
                  <th className="text-center py-1.5 font-semibold text-purple-700 w-20">سعر/قدم²</th>
                </tr>
              </thead>
              <tbody>
                {joelRows.map((row, i) => {
                  const pct = moQuery.data ? parseFloat((moQuery.data as any)[row.pctKey] || "0") : 0;
                  const avg = moQuery.data ? ((moQuery.data as any)[row.avgKey] || 0) : 0;
                  const actualPrice = cpQuery.data ? ((cpQuery.data as any)[row.baseField] || 0) : 0;
                  if (pct === 0 && avg === 0 && actualPrice === 0) return null;
                  return (
                    <tr key={i} className={`border-b ${(row as any).divider ? "border-t-2 border-t-gray-300" : "border-gray-100/60"} hover:bg-purple-50/30`}>
                      <td className="py-1 font-medium text-purple-700 flex items-center gap-1">
                        {row.catColor && <span className={`w-1.5 h-1.5 rounded-full ${row.catColor} inline-block`} />}
                        {row.cat}
                      </td>
                      <td className="py-1 text-gray-700">{row.label}</td>
                      <td className="py-1 text-center">{pct > 0 ? <span className="bg-purple-100 text-purple-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{pct}%</span> : <span className="text-gray-400">—</span>}</td>
                      <td className="py-1 text-center font-mono text-gray-700" dir="ltr">{avg > 0 ? fmt(avg) : "—"}</td>
                      <td className="py-1 text-center font-mono text-gray-700" dir="ltr">{actualPrice > 0 ? fmt(actualPrice) : "—"}</td>
                    </tr>
                  );
                }).filter(Boolean)}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* SECTION 3: التوزيع التفاعلي والتسعير (جدول واحد موحد)  */}
      {/* ═══════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {/* Header with scenario selector */}
        <div className="px-4 py-2 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-xs font-bold text-gray-800">التوزيع التفاعلي والتسعير</h3>
          <div className="flex gap-1">
            {(["optimistic", "base", "conservative"] as const).map(sc => {
              const cfg = scenarioConfig[sc];
              return (
                <button key={sc} onClick={() => { setActiveScenario(sc); setCpDirty(true); }}
                  className={`text-[10px] font-bold px-2.5 py-1 rounded-full transition-all ${activeScenario === sc ? `text-white ${cfg.bgBadge} shadow-sm` : "text-gray-500 bg-gray-100 hover:bg-gray-200"}`}>
                  {cfg.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Single unified table */}
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/80">
                <th className="text-right py-1.5 pr-3 font-semibold text-gray-600 w-14">الفئة</th>
                <th className="text-right py-1.5 font-semibold text-gray-600 w-24">النوع</th>
                <th className="text-center py-1.5 font-semibold text-gray-600 w-14">%</th>
                <th className="text-center py-1.5 font-semibold text-gray-600 w-16">المساحة</th>
                <th className="text-center py-1.5 font-semibold text-gray-600 w-12">الوحدات</th>
                <th className="text-center py-1.5 font-semibold text-gray-600 w-20">إجمالي م²</th>
                <th className="text-center py-1.5 font-semibold text-gray-600 w-12"><Car className="w-3 h-3 mx-auto" /></th>
                <th className="text-center py-1.5 font-semibold text-gray-600 w-14">الفائض</th>
                <th className="text-center py-1.5 font-semibold text-gray-600 w-16">سعر/قدم²</th>
                <th className="text-center py-1.5 font-semibold text-gray-600 w-20">سعر الوحدة</th>
                <th className={`text-center py-1.5 font-semibold w-24 ${scenarioConfig[activeScenario].color}`}>الإيراد</th>
              </tr>
            </thead>
            <tbody>
              {allDistFields.map((f, i) => {
                const r = allResults.find(r => r.key === f.key);
                const pctVal = (moFields as any)[f.pctKey] || 0;
                const avgVal = (moFields as any)[f.avgKey] || 0;
                const priceVal = (basePrices as any)[f.priceKey] || 0;
                const scenarioPrice = Math.round(priceVal * scenarioConfig[activeScenario].multiplier);
                const activeRevenue = r ? (activeScenario === "optimistic" ? r.revenueOpt : activeScenario === "conservative" ? r.revenueCons : r.revenueBase) : 0;
                const sellableForCat = f.cat === "residential" ? sellableRes : f.cat === "retail" ? sellableRet : sellableOff;

                return (
                  <tr key={f.key} className={`border-b ${(f as any).divider ? "border-t-2 border-t-gray-300" : "border-gray-100"} hover:bg-gray-50/50`}>
                    <td className="py-1 pr-3 font-medium text-gray-700">
                      {f.catLabel && (
                        <span className="flex items-center gap-1">
                          <span className={`w-1.5 h-1.5 rounded-full ${f.catColor} inline-block`} />
                          <span className="text-[10px]">{f.catLabel}</span>
                        </span>
                      )}
                    </td>
                    <td className="py-1 text-gray-800 font-medium">{f.label}</td>
                    <td className="py-0.5 w-14"><EditableNum value={pctVal} onChange={(v) => updateMoField(f.pctKey, v)} suffix="%" /></td>
                    <td className="py-0.5 w-16"><EditableNum value={avgVal || getAvg(f.pctKey, avgVal)} onChange={(v) => updateMoField(f.avgKey, v)} /></td>
                    <td className="py-1 text-center font-mono font-bold text-gray-900">{r ? fmt(r.units) : "—"}</td>
                    <td className="py-1 text-center font-mono text-gray-700" dir="ltr">{r ? fmt(r.totalArea) : "—"}</td>
                    <td className="py-1 text-center font-mono text-gray-600">{r ? r.parking : "—"}</td>
                    <td className="py-1 text-center font-mono text-[10px] text-gray-400">{r && r.surplus > 0 ? fmt(r.surplus) : "0"}</td>
                    <td className="py-0.5 w-16"><EditableNum value={priceVal} onChange={(v) => updateBasePrice(f.priceKey, v)} /></td>
                    <td className="py-1 text-center font-mono text-[10px] text-gray-600" dir="ltr">{r ? fmt(r.avgArea * scenarioPrice) : "—"}</td>
                    <td className={`py-1 text-center font-mono font-bold ${scenarioConfig[activeScenario].color}`} dir="ltr">{fmt(activeRevenue)}</td>
                  </tr>
                );
              })}

              {/* ═══ Category subtotals ═══ */}
              {[
                { label: "إجمالي السكني", data: resSummary, color: "bg-sky-50 text-sky-800", show: sellableRes > 0 },
                { label: "إجمالي التجزئة", data: retSummary, color: "bg-amber-50 text-amber-800", show: sellableRet > 0 },
                { label: "إجمالي المكاتب", data: offSummary, color: "bg-violet-50 text-violet-800", show: sellableOff > 0 },
              ].filter(s => s.show).map(s => {
                const activeRev = activeScenario === "optimistic" ? s.data.revOpt : activeScenario === "conservative" ? s.data.revCons : s.data.revBase;
                return (
                  <tr key={s.label} className={`${s.color} font-semibold border-b border-gray-200`}>
                    <td className="py-1.5 pr-3" colSpan={2}>{s.label}</td>
                    <td className="py-1.5 text-center">{s.data.totalPct > 0 ? `${s.data.totalPct.toFixed(0)}%` : "—"}</td>
                    <td className="py-1.5 text-center">—</td>
                    <td className="py-1.5 text-center font-mono">{fmt(s.data.units)}</td>
                    <td className="py-1.5 text-center font-mono" dir="ltr">{fmt(s.data.area)}</td>
                    <td className="py-1.5 text-center font-mono">{fmt(s.data.parking)}</td>
                    <td className="py-1.5 text-center font-mono text-[10px]">{fmt(s.data.surplus)}</td>
                    <td className="py-1.5 text-center">—</td>
                    <td className="py-1.5 text-center">—</td>
                    <td className={`py-1.5 text-center font-mono font-bold ${scenarioConfig[activeScenario].color}`} dir="ltr">{fmt(activeRev)}</td>
                  </tr>
                );
              })}
            </tbody>

            {/* ═══ Grand total ═══ */}
            <tfoot>
              <tr className="bg-gray-800 text-white font-bold">
                <td className="py-2 pr-3" colSpan={2}>الإجمالي الكلي</td>
                <td className="py-2 text-center">—</td>
                <td className="py-2 text-center">—</td>
                <td className="py-2 text-center font-mono">{fmt(totalUnits)}</td>
                <td className="py-2 text-center font-mono" dir="ltr">{fmt(totalUnits > 0 ? [...resResults, ...retResults, ...offResults].reduce((s, r) => s + r.totalArea, 0) : 0)}</td>
                <td className="py-2 text-center font-mono">{fmt(totalParking)}</td>
                <td className="py-2 text-center font-mono text-[10px]">{fmt(totalSurplus)}</td>
                <td className="py-2 text-center">—</td>
                <td className="py-2 text-center">—</td>
                <td className="py-2 text-center font-mono" dir="ltr">
                  {fmt(activeScenario === "optimistic" ? totalRevenueOpt : activeScenario === "conservative" ? totalRevenueCons : totalRevenueBase)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Revenue comparison strip */}
        <div className="grid grid-cols-3 border-t border-gray-200">
          {(["optimistic", "base", "conservative"] as const).map(sc => {
            const rev = sc === "optimistic" ? totalRevenueOpt : sc === "conservative" ? totalRevenueCons : totalRevenueBase;
            const cfg = scenarioConfig[sc];
            const isActive = sc === activeScenario;
            return (
              <div key={sc} className={`px-3 py-2 text-center border-l first:border-l-0 border-gray-200 ${isActive ? "bg-blue-50" : "bg-gray-50/50"}`}>
                <div className={`text-[10px] font-semibold ${isActive ? cfg.color : "text-gray-500"}`}>{cfg.label}</div>
                <div className={`text-sm font-black font-mono ${isActive ? cfg.color : "text-gray-600"}`} dir="ltr">{fmt(rev)}</div>
                <div className="text-[9px] text-gray-400">AED</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Save button */}
      {(moDirty || cpDirty) && (
        <div className="flex justify-end">
          <Button size="sm" onClick={handleSaveAll} disabled={moSaveMutation.isPending || cpSaveMutation.isPending} className="gap-1.5 h-7 text-[11px]">
            {(moSaveMutation.isPending || cpSaveMutation.isPending) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            حفظ التوزيع والتسعير
          </Button>
        </div>
      )}
    </div>
  );
}
