import { useState, useEffect, useMemo, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { DEFAULT_AVG_AREAS } from "@shared/feasibilityUtils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Loader2, Sparkles, DollarSign,
  TrendingUp, TrendingDown, BarChart3, Save, Zap, CheckCircle2,
  ChevronDown, ChevronUp, Building2, MapPin, Car, Ruler,
  LayoutGrid, Calculator
} from "lucide-react";

const JOEL_AVATAR = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663200809965/mCOkEovAXTtxsABs.png";

/* ═══ Parking Standards — Dubai Development Authority (sqft) ═══ */
const PARKING = {
  residential: { threshold: 1615, below: 1, above: 2 }, // ≤1615sqft → 1 spot, >1615sqft → 2 spots
  retail: { perSqft: 753 },    // 1 spot per 753 sqft
  offices: { perSqft: 538 },   // 1 spot per 538 sqft
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
        className={`h-7 text-xs text-center ${extraClass || ""}`}
        disabled={disabled} dir="ltr" />
      {suffix && <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground">{suffix}</span>}
    </div>
  );
}

function SectionHeader({ title, icon: Icon, isOpen, onToggle, badge }: { title: string; icon: any; isOpen: boolean; onToggle: () => void; badge?: string }) {
  return (
    <button onClick={onToggle} className="w-full flex items-center justify-between px-4 py-2.5 bg-gradient-to-l from-muted/40 to-muted/10 border border-border/50 rounded-xl hover:bg-muted/50 transition-all">
      <div className="flex items-center gap-2">
        <Icon className="w-4.5 h-4.5 text-primary" />
        <span className="text-sm font-bold text-foreground">{title}</span>
        {badge && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">{badge}</span>}
      </div>
      {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
    </button>
  );
}

type ScenarioKey = "optimistic" | "base" | "conservative";

/* ═══ Zero-Waste Distribution Algorithm ═══
 * 1. Allocate area by percentage for each type
 * 2. Calculate units = floor(allocated / avgArea)
 * 3. Calculate surplus per type = allocated - (units * avgArea)
 * 4. Sum total surplus
 * 5. Add units from smallest type first using surplus
 * 6. Absorb remaining surplus into largest type (increase its unit count)
 */
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
  revenueBase: number;
  revenueOpt: number;
  revenueCons: number;
}

function zeroWasteDistribute(types: UnitType[], totalSellable: number): DistResult[] {
  if (totalSellable <= 0 || types.length === 0) return [];
  const activeTypes = types.filter(t => t.pct > 0 && t.avgArea > 0);
  if (activeTypes.length === 0) return [];

  // Step 1: Initial allocation
  let results: DistResult[] = activeTypes.map(t => {
    const allocated = totalSellable * (t.pct / 100);
    const units = Math.floor(allocated / t.avgArea);
    const surplus = allocated - (units * t.avgArea);
    return {
      key: t.key,
      label: t.label,
      pct: t.pct,
      avgArea: t.avgArea,
      allocated,
      units,
      surplus,
      parking: 0,
      basePricePerSqft: t.basePricePerSqft,
      unitPrice: t.avgArea * t.basePricePerSqft,
      revenueBase: 0,
      revenueOpt: 0,
      revenueCons: 0,
    };
  });

  // Step 2: Collect total surplus
  let totalSurplus = results.reduce((s, r) => s + r.surplus, 0);

  // Step 3: Add units from smallest type first
  const sortedByArea = [...results].sort((a, b) => a.avgArea - b.avgArea);
  for (const item of sortedByArea) {
    while (totalSurplus >= item.avgArea) {
      const r = results.find(r => r.key === item.key)!;
      r.units += 1;
      totalSurplus -= item.avgArea;
    }
  }

  // Step 4: Absorb remaining surplus into largest type
  if (totalSurplus > 0 && results.length > 0) {
    const largest = [...results].sort((a, b) => b.avgArea - a.avgArea)[0];
    // remaining surplus < smallest unit area, so it's truly wasted — but we mark it
    largest.surplus = totalSurplus;
  }

  // Recalculate surplus for each
  results = results.map(r => ({
    ...r,
    surplus: r.allocated - (r.units * r.avgArea) + (totalSurplus > 0 && r.key === [...results].sort((a, b) => b.avgArea - a.avgArea)[0].key ? 0 : 0),
  }));

  // Final surplus = total sellable - sum of (units * avgArea)
  const usedArea = results.reduce((s, r) => s + r.units * r.avgArea, 0);
  const finalSurplus = totalSellable - usedArea;

  // Distribute final surplus display to the largest type
  results = results.map(r => ({ ...r, surplus: 0 }));
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
  const [showLandDetails, setShowLandDetails] = useState(true);
  const [showJoelTable, setShowJoelTable] = useState(true);
  const [showDistribution, setShowDistribution] = useState(true);

  // ═══ Data queries ═══
  const projectQuery = trpc.projects.getById.useQuery(projectId || 0, { enabled: !!projectId, staleTime: 5000 });
  const project = projectQuery.data;
  const moQuery = trpc.marketOverview.getByProject.useQuery(projectId || 0, { enabled: !!projectId, staleTime: 5000 });
  const cpQuery = trpc.competitionPricing.getByProject.useQuery(projectId || 0, { enabled: !!projectId, staleTime: 2000, refetchOnWindowFocus: true });

  // ═══ Joelle Engine auto-populate status ═══
  const joelleStatusQuery = trpc.joelleEngine.getAutoPopulateStatus.useQuery(projectId || 0, { enabled: !!projectId, staleTime: 10000 });
  const applyJoelleMutation = trpc.joelleEngine.applyJoelleOutputs.useMutation({
    onSuccess: (data) => {
      moQuery.refetch();
      cpQuery.refetch();
      joelleStatusQuery.refetch();
      if (data.marketOverview && data.competitionPricing) {
        toast.success("تم تطبيق مخرجات جويل بنجاح — توزيع الوحدات + التسعير");
      } else if (data.marketOverview) {
        toast.success("تم تطبيق توزيع الوحدات من الدراسات والأبحاث");
      } else if (data.competitionPricing) {
        toast.success("تم تطبيق التسعير من الدراسات والأبحاث");
      } else {
        toast.info("لا توجد مخرجات جاهزة من الدراسات والأبحاث — شغّل المحركات أولاً");
      }
    },
    onError: (err) => toast.error(err.message || "فشل في تطبيق مخرجات جويل"),
  });

  // ═══ Distribution state (from marketOverview) ═══
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

  // ═══ Pricing state (from competitionPricing) — base prices only ═══
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
      // Load base prices
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

  // Sellable areas (efficiency ratios)
  const sellableRes = gfaResSqft * 0.95;
  const sellableRet = gfaRetSqft * 0.97;
  const sellableOff = gfaOffSqft * 0.95;
  const totalSellable = sellableRes + sellableRet + sellableOff;

  // ═══ Joel's suggestions (from AI recommendations JSON) ═══
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

  // Run zero-waste algorithm + parking + revenue
  const resResults = useMemo(() => calcRevenue(calcParking(zeroWasteDistribute(resTypes, sellableRes), "residential")), [resTypes, sellableRes]);
  const retResults = useMemo(() => calcRevenue(calcParking(zeroWasteDistribute(retTypes, sellableRet), "retail")), [retTypes, sellableRet]);
  const offResults = useMemo(() => calcRevenue(calcParking(zeroWasteDistribute(offTypes, sellableOff), "offices")), [offTypes, sellableOff]);

  // Totals
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
    // Auto-generate optimistic (+10%) and conservative (-10%) from base
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

  const handleSaveAll = () => {
    handleSaveMo();
    handleSaveCp();
  };

  // ═══ Joelle status ═══
  const joelleStatus = joelleStatusQuery.data;
  const hasAnyJoelleData = joelleStatus?.engine6Ready || joelleStatus?.engine7Ready;
  const alreadyApplied = joelleStatus?.moHasJoelleData && joelleStatus?.cpHasJoelleData;

  const scenarioConfig: Record<ScenarioKey, { label: string; labelEn: string; color: string; bg: string; border: string; icon: any; multiplier: number }> = {
    optimistic: { label: "المتفائل (+10%)", labelEn: "+10%", color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-300", icon: TrendingUp, multiplier: 1.10 },
    base: { label: "الأساسي", labelEn: "Base", color: "text-blue-700", bg: "bg-blue-50", border: "border-blue-300", icon: BarChart3, multiplier: 1.00 },
    conservative: { label: "المتحفظ (-10%)", labelEn: "-10%", color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-300", icon: TrendingDown, multiplier: 0.90 },
  };

  // ═══ RENDER ═══
  if (!projectId) return (<div className="text-center py-12 text-muted-foreground"><DollarSign className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>اختر مشروعاً لعرض البيانات</p></div>);
  if (projectQuery.isLoading) return (<div className="text-center py-12"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /><p className="text-sm text-muted-foreground mt-2">جاري تحميل البيانات...</p></div>);

  // ═══ Distribution table sub-component ═══
  const DistributionTable = ({ title, category, results, totalPct, sellable, pctFields, avgFields, priceFields }: {
    title: string;
    category: "residential" | "retail" | "offices";
    results: DistResult[];
    totalPct: number;
    sellable: number;
    pctFields: { key: string; label: string; pctKey: string; avgKey: string; priceKey: string }[];
    avgFields?: any;
    priceFields?: any;
  }) => {
    if (sellable <= 0) return null;
    const catUnits = results.reduce((s, r) => s + r.units, 0);
    const catParking = results.reduce((s, r) => s + r.parking, 0);
    const catSurplus = results.reduce((s, r) => s + r.surplus, 0);
    const catRevBase = results.reduce((s, r) => s + r.revenueBase, 0);
    const catRevOpt = results.reduce((s, r) => s + r.revenueOpt, 0);
    const catRevCons = results.reduce((s, r) => s + r.revenueCons, 0);
    const activeRev = activeScenario === "optimistic" ? catRevOpt : activeScenario === "conservative" ? catRevCons : catRevBase;

    return (
      <div className="bg-white rounded-xl border border-border/40 overflow-hidden shadow-sm">
        {/* Header */}
        <div className="px-4 py-2.5 bg-gradient-to-l from-muted/30 to-muted/10 border-b border-border/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-bold">{title}</h4>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${Math.abs(totalPct - 100) < 0.1 ? "bg-emerald-100 text-emerald-700" : totalPct > 0 ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-500"}`}>
              {totalPct > 0 ? `${totalPct.toFixed(1)}%` : "—"}
            </span>
          </div>
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            <span>القابل للبيع: <b className="text-foreground" dir="ltr">{fmt(sellable)}</b> sqft</span>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="bg-muted/10 border-b border-border/20">
                <th className="px-3 py-1.5 text-right font-semibold w-28">النوع</th>
                <th className="px-1.5 py-1.5 text-center font-semibold w-16">النسبة %</th>
                <th className="px-1.5 py-1.5 text-center font-semibold w-20">المساحة</th>
                <th className="px-1.5 py-1.5 text-center font-semibold w-14">الوحدات</th>
                <th className="px-1.5 py-1.5 text-center font-semibold w-16">الفائض</th>
                <th className="px-1.5 py-1.5 text-center font-semibold w-14">
                  <div className="flex items-center justify-center gap-0.5"><Car className="w-3 h-3" /><span>P</span></div>
                </th>
                <th className="px-1.5 py-1.5 text-center font-semibold w-20">سعر/قدم²</th>
                <th className="px-1.5 py-1.5 text-center font-semibold w-24">سعر الوحدة</th>
                <th className={`px-2 py-1.5 text-center font-semibold w-28 ${scenarioConfig[activeScenario].bg} ${scenarioConfig[activeScenario].color}`}>
                  الإيراد ({scenarioConfig[activeScenario].label})
                </th>
              </tr>
            </thead>
            <tbody>
              {pctFields.map((f, i) => {
                const r = results.find(r => r.key === f.key);
                const pctVal = (moFields as any)[f.pctKey] || 0;
                const avgVal = (moFields as any)[f.avgKey] || 0;
                const priceVal = (basePrices as any)[f.priceKey] || 0;
                const scenarioPrice = Math.round(priceVal * scenarioConfig[activeScenario].multiplier);
                const activeRevenue = r ? (activeScenario === "optimistic" ? r.revenueOpt : activeScenario === "conservative" ? r.revenueCons : r.revenueBase) : 0;

                return (
                  <tr key={f.key} className="border-b border-border/10 hover:bg-muted/5">
                    <td className="px-3 py-1 font-medium">{f.label}</td>
                    <td className="px-1 py-1"><EditableNum value={pctVal} onChange={(v) => updateMoField(f.pctKey, v)} suffix="%" /></td>
                    <td className="px-1 py-1"><EditableNum value={avgVal || getAvg(f.pctKey, avgVal)} onChange={(v) => updateMoField(f.avgKey, v)} suffix="sqft" /></td>
                    <td className="px-1.5 py-1 text-center font-mono font-bold">{r ? fmt(r.units) : "—"}</td>
                    <td className="px-1.5 py-1 text-center font-mono text-[10px] text-muted-foreground">{r && r.surplus > 0 ? `${fmt(r.surplus)}` : "0"}</td>
                    <td className="px-1.5 py-1 text-center font-mono">{r ? r.parking : 0}</td>
                    <td className="px-1 py-1"><EditableNum value={priceVal} onChange={(v) => updateBasePrice(f.priceKey, v)} /></td>
                    <td className="px-1.5 py-1 text-center font-mono text-[10px]" dir="ltr">{r ? fmt(r.avgArea * scenarioPrice) : "—"}</td>
                    <td className={`px-2 py-1 text-center font-mono font-bold ${scenarioConfig[activeScenario].color}`} dir="ltr">{fmt(activeRevenue)}</td>
                  </tr>
                );
              })}
            </tbody>
            {/* Totals row */}
            <tfoot>
              <tr className="bg-muted/20 font-bold border-t border-border/30">
                <td className="px-3 py-1.5">الإجمالي</td>
                <td className="px-1.5 py-1.5 text-center">{totalPct.toFixed(0)}%</td>
                <td className="px-1.5 py-1.5 text-center">—</td>
                <td className="px-1.5 py-1.5 text-center font-mono">{fmt(catUnits)}</td>
                <td className="px-1.5 py-1.5 text-center font-mono text-[10px]">{fmt(catSurplus)}</td>
                <td className="px-1.5 py-1.5 text-center font-mono">{fmt(catParking)}</td>
                <td className="px-1.5 py-1.5 text-center">—</td>
                <td className="px-1.5 py-1.5 text-center">—</td>
                <td className={`px-2 py-1.5 text-center font-mono ${scenarioConfig[activeScenario].color}`} dir="ltr">{fmt(activeRev)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4" dir="rtl">

      {/* ═══ JOELLE AUTO-POPULATE BANNER ═══ */}
      {hasAnyJoelleData && (
        <div className="bg-gradient-to-l from-purple-50 to-pink-50 border border-purple-200 rounded-xl p-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <img src={JOEL_AVATAR} className="w-8 h-8 rounded-full border-2 border-purple-200" alt="جويل" />
              <div>
                <h3 className="text-xs font-bold text-purple-800">مخرجات الدراسات والأبحاث جاهزة</h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${joelleStatus?.engine6Ready ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                    {joelleStatus?.engine6Ready ? "✓" : "○"} محرك 6
                  </span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${joelleStatus?.engine7Ready ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                    {joelleStatus?.engine7Ready ? "✓" : "○"} محرك 7
                  </span>
                </div>
              </div>
            </div>
            <Button size="sm"
              onClick={() => { if (projectId) applyJoelleMutation.mutate(projectId); }}
              disabled={applyJoelleMutation.isPending}
              className={`gap-1.5 h-8 text-xs ${alreadyApplied ? "bg-emerald-600 hover:bg-emerald-700" : "bg-gradient-to-l from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"}`}
            >
              {applyJoelleMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : alreadyApplied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Zap className="w-3.5 h-3.5" />}
              {alreadyApplied ? "إعادة تطبيق" : "تعبئة من جويل"}
            </Button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* SECTION 1: تفاصيل الأرض والمساحات                      */}
      {/* ═══════════════════════════════════════════════════════ */}
      <SectionHeader title="تفاصيل الأرض والمساحات" icon={MapPin} isOpen={showLandDetails} onToggle={() => setShowLandDetails(!showLandDetails)} />
      {showLandDetails && (
        <Card className="border-border/50">
          <CardContent className="pt-4 space-y-4">
            {/* Land & Plot info */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <InfoBox label="مساحة الأرض (قدم²)" value={fmt(plotAreaSqft)} icon={<Ruler className="w-3.5 h-3.5" />} />
              <InfoBox label="مساحة الأرض (م²)" value={fmt(plotAreaSqm)} />
              <InfoBox label="BUA (قدم²)" value={fmt(buaSqft)} />
              <InfoBox label="GFA الإجمالي (قدم²)" value={fmt(gfaTotalSqft)} />
            </div>

            {/* GFA Breakdown */}
            <div className="bg-white rounded-xl border border-border/40 overflow-hidden">
              <div className="px-4 py-2 bg-gradient-to-l from-blue-50/50 to-blue-50/20 border-b border-border/30">
                <h4 className="text-xs font-bold flex items-center gap-1.5"><LayoutGrid className="w-3.5 h-3.5 text-blue-600" /> تفصيل المساحات الإجمالية (GFA)</h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="bg-muted/10 border-b border-border/20">
                      <th className="px-4 py-1.5 text-right font-semibold">الفئة</th>
                      <th className="px-3 py-1.5 text-center font-semibold">GFA (قدم²)</th>
                      <th className="px-3 py-1.5 text-center font-semibold">نسبة الكفاءة</th>
                      <th className="px-3 py-1.5 text-center font-semibold">القابل للبيع (قدم²)</th>
                      <th className="px-3 py-1.5 text-center font-semibold">% من الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: "الوحدات السكنية", gfa: gfaResSqft, eff: 0.95, sell: sellableRes, color: "bg-sky-500" },
                      { label: "وحدات التجزئة", gfa: gfaRetSqft, eff: 0.97, sell: sellableRet, color: "bg-amber-500" },
                      { label: "المكاتب", gfa: gfaOffSqft, eff: 0.95, sell: sellableOff, color: "bg-violet-500" },
                    ].filter(r => r.gfa > 0).map(r => (
                      <tr key={r.label} className="border-b border-border/10">
                        <td className="px-4 py-1.5 font-medium flex items-center gap-1.5"><span className={`w-2 h-2 rounded-full ${r.color}`} />{r.label}</td>
                        <td className="px-3 py-1.5 text-center font-mono" dir="ltr">{fmt(r.gfa)}</td>
                        <td className="px-3 py-1.5 text-center">{(r.eff * 100).toFixed(0)}%</td>
                        <td className="px-3 py-1.5 text-center font-mono font-bold" dir="ltr">{fmt(r.sell)}</td>
                        <td className="px-3 py-1.5 text-center">{totalSellable > 0 ? ((r.sell / totalSellable) * 100).toFixed(1) : 0}%</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted/20 font-bold border-t border-border/30">
                      <td className="px-4 py-1.5">الإجمالي</td>
                      <td className="px-3 py-1.5 text-center font-mono" dir="ltr">{fmt(gfaResSqft + gfaRetSqft + gfaOffSqft)}</td>
                      <td className="px-3 py-1.5 text-center">—</td>
                      <td className="px-3 py-1.5 text-center font-mono" dir="ltr">{fmt(totalSellable)}</td>
                      <td className="px-3 py-1.5 text-center">100%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* SECTION 2: اقتراحات جويل (للقراءة فقط)                 */}
      {/* ═══════════════════════════════════════════════════════ */}
      {(moJoelleSource || cpJoelleSource) && (
        <>
          <SectionHeader title="اقتراحات جويل — مرجع" icon={Sparkles} isOpen={showJoelTable} onToggle={() => setShowJoelTable(!showJoelTable)} badge="للقراءة فقط" />
          {showJoelTable && (
            <Card className="border-purple-200/50 bg-gradient-to-br from-purple-50/30 to-pink-50/20">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <img src={JOEL_AVATAR} className="w-6 h-6 rounded-full" alt="" />
                  <span className="text-xs text-purple-700">النسب والأسعار المقترحة من محركات الدراسات والأبحاث — يمكنك تعديلها في الجدول التفاعلي أدناه</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="bg-purple-100/50 border-b border-purple-200/50">
                        <th className="px-3 py-1.5 text-right font-semibold text-purple-800">الفئة</th>
                        <th className="px-3 py-1.5 text-right font-semibold text-purple-800">النوع</th>
                        <th className="px-2 py-1.5 text-center font-semibold text-purple-800">النسبة %</th>
                        <th className="px-2 py-1.5 text-center font-semibold text-purple-800">المساحة (sqft)</th>
                        <th className="px-2 py-1.5 text-center font-semibold text-purple-800">سعر/قدم² (أساسي)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Residential */}
                      {[
                        { cat: "سكني", label: "استديو", pctKey: "residentialStudioPct", avgKey: "residentialStudioAvgArea", priceKey: "studioPrice" },
                        { cat: "", label: "غرفة وصالة", pctKey: "residential1brPct", avgKey: "residential1brAvgArea", priceKey: "oneBrPrice" },
                        { cat: "", label: "غرفتان وصالة", pctKey: "residential2brPct", avgKey: "residential2brAvgArea", priceKey: "twoBrPrice" },
                        { cat: "", label: "ثلاث غرف", pctKey: "residential3brPct", avgKey: "residential3brAvgArea", priceKey: "threeBrPrice" },
                        { cat: "تجزئة", label: "صغيرة", pctKey: "retailSmallPct", avgKey: "retailSmallAvgArea", priceKey: "retailSmallPrice" },
                        { cat: "", label: "متوسطة", pctKey: "retailMediumPct", avgKey: "retailMediumAvgArea", priceKey: "retailMediumPrice" },
                        { cat: "", label: "كبيرة", pctKey: "retailLargePct", avgKey: "retailLargeAvgArea", priceKey: "retailLargePrice" },
                        { cat: "مكاتب", label: "صغيرة", pctKey: "officeSmallPct", avgKey: "officeSmallAvgArea", priceKey: "officeSmallPrice" },
                        { cat: "", label: "متوسطة", pctKey: "officeMediumPct", avgKey: "officeMediumAvgArea", priceKey: "officeMediumPrice" },
                        { cat: "", label: "كبيرة", pctKey: "officeLargePct", avgKey: "officeLargeAvgArea", priceKey: "officeLargePrice" },
                      ].map((row, i) => {
                        const pct = moQuery.data ? parseFloat((moQuery.data as any)[row.pctKey] || "0") : 0;
                        const avg = moQuery.data ? ((moQuery.data as any)[row.avgKey] || 0) : 0;
                        const price = cpQuery.data ? ((cpQuery.data as any)[`base${row.priceKey.charAt(0).toUpperCase() + row.priceKey.slice(1).replace("Price", "Price")}`] || 0) : 0;
                        // Reconstruct the base price field name
                        const baseField = row.priceKey === "studioPrice" ? "baseStudioPrice" :
                          row.priceKey === "oneBrPrice" ? "base1brPrice" :
                          row.priceKey === "twoBrPrice" ? "base2brPrice" :
                          row.priceKey === "threeBrPrice" ? "base3brPrice" :
                          `base${row.priceKey.charAt(0).toUpperCase()}${row.priceKey.slice(1)}`;
                        const actualPrice = cpQuery.data ? ((cpQuery.data as any)[baseField] || 0) : 0;

                        if (pct === 0 && avg === 0 && actualPrice === 0) return null;
                        return (
                          <tr key={i} className="border-b border-purple-100/30">
                            <td className="px-3 py-1 font-medium text-purple-700">{row.cat}</td>
                            <td className="px-3 py-1">{row.label}</td>
                            <td className="px-2 py-1 text-center font-mono">{pct > 0 ? `${pct}%` : "—"}</td>
                            <td className="px-2 py-1 text-center font-mono" dir="ltr">{avg > 0 ? fmt(avg) : "—"}</td>
                            <td className="px-2 py-1 text-center font-mono" dir="ltr">{actualPrice > 0 ? fmt(actualPrice) : "—"}</td>
                          </tr>
                        );
                      }).filter(Boolean)}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* SECTION 3: الجدول التفاعلي — التوزيع والتسعير           */}
      {/* ═══════════════════════════════════════════════════════ */}
      <SectionHeader title="التوزيع التفاعلي والتسعير" icon={Calculator} isOpen={showDistribution} onToggle={() => setShowDistribution(!showDistribution)} />
      {showDistribution && (
        <div className="space-y-3">
          {/* Scenario selector */}
          <div className="flex gap-2">
            {(["optimistic", "base", "conservative"] as const).map(sc => {
              const cfg = scenarioConfig[sc];
              const Icon = cfg.icon;
              return (
                <button key={sc} onClick={() => { setActiveScenario(sc); setCpDirty(true); }}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-bold transition-all ${activeScenario === sc ? `${cfg.bg} ${cfg.border} ${cfg.color}` : "bg-muted/20 border-border/30 text-muted-foreground hover:bg-muted/40"}`}>
                  <Icon className="w-3.5 h-3.5" />{cfg.label}
                </button>
              );
            })}
          </div>

          {/* Distribution tables per category */}
          <DistributionTable
            title="الوحدات السكنية"
            category="residential"
            results={resResults}
            totalPct={resTotalPct}
            sellable={sellableRes}
            pctFields={[
              { key: "studio", label: "استديو", pctKey: "residentialStudioPct", avgKey: "residentialStudioAvgArea", priceKey: "studioPrice" },
              { key: "1br", label: "غرفة وصالة", pctKey: "residential1brPct", avgKey: "residential1brAvgArea", priceKey: "oneBrPrice" },
              { key: "2br", label: "غرفتان وصالة", pctKey: "residential2brPct", avgKey: "residential2brAvgArea", priceKey: "twoBrPrice" },
              { key: "3br", label: "ثلاث غرف وصالة", pctKey: "residential3brPct", avgKey: "residential3brAvgArea", priceKey: "threeBrPrice" },
            ]}
          />

          <DistributionTable
            title="وحدات التجزئة"
            category="retail"
            results={retResults}
            totalPct={retTotalPct}
            sellable={sellableRet}
            pctFields={[
              { key: "retSmall", label: "صغيرة", pctKey: "retailSmallPct", avgKey: "retailSmallAvgArea", priceKey: "retailSmallPrice" },
              { key: "retMedium", label: "متوسطة", pctKey: "retailMediumPct", avgKey: "retailMediumAvgArea", priceKey: "retailMediumPrice" },
              { key: "retLarge", label: "كبيرة", pctKey: "retailLargePct", avgKey: "retailLargeAvgArea", priceKey: "retailLargePrice" },
            ]}
          />

          <DistributionTable
            title="المكاتب"
            category="offices"
            results={offResults}
            totalPct={offTotalPct}
            sellable={sellableOff}
            pctFields={[
              { key: "offSmall", label: "صغيرة", pctKey: "officeSmallPct", avgKey: "officeSmallAvgArea", priceKey: "officeSmallPrice" },
              { key: "offMedium", label: "متوسطة", pctKey: "officeMediumPct", avgKey: "officeMediumAvgArea", priceKey: "officeMediumPrice" },
              { key: "offLarge", label: "كبيرة", pctKey: "officeLargePct", avgKey: "officeLargeAvgArea", priceKey: "officeLargePrice" },
            ]}
          />

          {/* ═══ Grand Totals Banner ═══ */}
          <div className="rounded-2xl overflow-hidden shadow-lg border border-border/20">
            {/* Header */}
            <div className="bg-gradient-to-l from-slate-900 via-slate-800 to-slate-900 px-5 py-2.5 flex items-center gap-2">
              <div className="w-1.5 h-5 rounded-full bg-sky-400" />
              <span className="text-xs font-bold text-white/70 tracking-widest">ملخص الإيرادات والتوزيع</span>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-x-reverse divide-border/20">
              <div className="bg-gradient-to-br from-sky-600 to-sky-700 px-4 py-3 flex flex-col gap-0.5">
                <span className="text-[10px] font-semibold text-sky-100/80">إجمالي الوحدات</span>
                <span className="text-xl font-black text-white tabular-nums">{fmt(totalUnits)}</span>
              </div>
              <div className="bg-gradient-to-br from-slate-600 to-slate-700 px-4 py-3 flex flex-col gap-0.5">
                <span className="text-[10px] font-semibold text-slate-200/80">مواقف السيارات</span>
                <span className="text-xl font-black text-white tabular-nums">{fmt(totalParking)}</span>
              </div>
              <div className="bg-gradient-to-br from-amber-600 to-amber-700 px-4 py-3 flex flex-col gap-0.5">
                <span className="text-[10px] font-semibold text-amber-100/80">الفائض (sqft)</span>
                <span className="text-xl font-black text-white tabular-nums" dir="ltr">{fmt(totalSurplus)}</span>
              </div>
              <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 px-4 py-3 flex flex-col gap-0.5">
                <span className="text-[10px] font-semibold text-emerald-100/80">القابل للبيع (sqft)</span>
                <span className="text-xl font-black text-white tabular-nums" dir="ltr">{fmt(totalSellable)}</span>
              </div>
            </div>

            {/* Revenue comparison */}
            <div className="grid grid-cols-3 divide-x divide-x-reverse divide-border/20">
              {(["optimistic", "base", "conservative"] as const).map(sc => {
                const rev = sc === "optimistic" ? totalRevenueOpt : sc === "conservative" ? totalRevenueCons : totalRevenueBase;
                const cfg = scenarioConfig[sc];
                const isActive = sc === activeScenario;
                return (
                  <div key={sc} className={`px-4 py-3 flex flex-col gap-0.5 ${isActive ? "bg-gradient-to-br from-blue-700 to-blue-800" : "bg-gradient-to-br from-slate-700 to-slate-800"}`}>
                    <span className="text-[10px] font-semibold text-white/70">{cfg.label}</span>
                    <span className="text-sm md:text-lg font-black text-white tabular-nums" dir="ltr">{fmt(rev)}</span>
                    <span className="text-[9px] text-white/50">AED</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Save buttons */}
          {(moDirty || cpDirty) && (
            <div className="flex justify-end gap-2">
              <Button size="sm" onClick={handleSaveAll} disabled={moSaveMutation.isPending || cpSaveMutation.isPending} className="gap-1.5">
                {(moSaveMutation.isPending || cpSaveMutation.isPending) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                حفظ التوزيع والتسعير
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══ Small info box component ═══ */
function InfoBox({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg border border-border/40 px-3 py-2">
      <div className="flex items-center gap-1.5 mb-0.5">
        {icon}
        <span className="text-[10px] text-muted-foreground">{label}</span>
      </div>
      <span className="text-sm font-bold font-mono" dir="ltr">{value}</span>
    </div>
  );
}
