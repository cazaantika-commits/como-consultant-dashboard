import { useState, useEffect, useMemo, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { DEFAULT_AVG_AREAS } from "@shared/feasibilityUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Loader2, Sparkles, DollarSign,
  TrendingUp, TrendingDown, BarChart3, Save, Zap, CheckCircle2,
  Car, AlertTriangle, CheckCircle
} from "lucide-react";

const JOEL_AVATAR = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663200809965/mCOkEovAXTtxsABs.png";

/* ═══ Parking Standards — Dubai (sqft) ═══ */
const PARKING = {
  residential: { threshold: 1615, below: 1, above: 2 },
  retail: { perSqft: 753 },
  offices: { perSqft: 538 },
};

/* ═══ Helpers ═══ */
function fmt(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "0";
  if (n < 100 && n % 1 !== 0) return n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 1 });
  return Math.round(n).toLocaleString("en-US");
}

function EditableNum({ value, onChange, disabled, cls }: { value: number; onChange: (v: number) => void; disabled?: boolean; cls?: string }) {
  const [localVal, setLocalVal] = useState("");
  const [focused, setFocused] = useState(false);
  const display = focused ? localVal : (value ? fmt(value) : "");
  return (
    <Input type="text" value={display}
      onFocus={() => { setFocused(true); setLocalVal(value ? String(value) : ""); }}
      onBlur={() => { setFocused(false); const n = parseFloat(localVal.replace(/,/g, "")); if (!isNaN(n) && n >= 0) onChange(n); }}
      onChange={(e) => setLocalVal(e.target.value)}
      className={`h-6 text-[11px] text-center border-0 border-b border-dashed border-gray-300 rounded-none bg-transparent focus:border-blue-500 focus:bg-blue-50/40 px-0.5 font-mono ${cls || ""}`}
      disabled={disabled} dir="ltr" />
  );
}

type ScenarioKey = "optimistic" | "base" | "conservative";

interface UnitRow {
  key: string; label: string; cat: "residential" | "retail" | "offices";
  catLabel: string; catColor: string; pctKey: string; avgKey: string;
  priceKey: string; baseField: string; divider?: boolean;
  is2br?: boolean;
}

const UNIT_ROWS: UnitRow[] = [
  { key: "studio", label: "استديو", cat: "residential", catLabel: "سكني", catColor: "sky", pctKey: "residentialStudioPct", avgKey: "residentialStudioAvgArea", priceKey: "studioPrice", baseField: "baseStudioPrice" },
  { key: "1br", label: "غرفة وصالة", cat: "residential", catLabel: "", catColor: "sky", pctKey: "residential1brPct", avgKey: "residential1brAvgArea", priceKey: "oneBrPrice", baseField: "base1brPrice" },
  { key: "2br", label: "غرفتان وصالة", cat: "residential", catLabel: "", catColor: "sky", pctKey: "residential2brPct", avgKey: "residential2brAvgArea", priceKey: "twoBrPrice", baseField: "base2brPrice", is2br: true },
  { key: "3br", label: "ثلاث غرف", cat: "residential", catLabel: "", catColor: "sky", pctKey: "residential3brPct", avgKey: "residential3brAvgArea", priceKey: "threeBrPrice", baseField: "base3brPrice" },
  { key: "retSmall", label: "صغيرة", cat: "retail", catLabel: "تجزئة", catColor: "amber", pctKey: "retailSmallPct", avgKey: "retailSmallAvgArea", priceKey: "retailSmallPrice", baseField: "baseRetailSmallPrice", divider: true },
  { key: "retMedium", label: "متوسطة", cat: "retail", catLabel: "", catColor: "amber", pctKey: "retailMediumPct", avgKey: "retailMediumAvgArea", priceKey: "retailMediumPrice", baseField: "baseRetailMediumPrice" },
  { key: "retLarge", label: "كبيرة", cat: "retail", catLabel: "", catColor: "amber", pctKey: "retailLargePct", avgKey: "retailLargeAvgArea", priceKey: "retailLargePrice", baseField: "baseRetailLargePrice" },
  { key: "offSmall", label: "صغيرة", cat: "offices", catLabel: "مكاتب", catColor: "violet", pctKey: "officeSmallPct", avgKey: "officeSmallAvgArea", priceKey: "officeSmallPrice", baseField: "baseOfficeSmallPrice", divider: true },
  { key: "offMedium", label: "متوسطة", cat: "offices", catLabel: "", catColor: "violet", pctKey: "officeMediumPct", avgKey: "officeMediumAvgArea", priceKey: "officeMediumPrice", baseField: "baseOfficeMediumPrice" },
  { key: "offLarge", label: "كبيرة", cat: "offices", catLabel: "", catColor: "violet", pctKey: "officeLargePct", avgKey: "officeLargeAvgArea", priceKey: "officeLargePrice", baseField: "baseOfficeLargePrice" },
];

const CATS = [
  { key: "residential", label: "سكني", color: "sky", bgSub: "bg-sky-50/60", textSub: "text-sky-800" },
  { key: "retail", label: "تجزئة", color: "amber", bgSub: "bg-amber-50/60", textSub: "text-amber-800" },
  { key: "offices", label: "مكاتب", color: "violet", bgSub: "bg-violet-50/60", textSub: "text-violet-800" },
] as const;

/* ═══ MAIN COMPONENT ═══ */
interface CostsCashFlowTabProps {
  projectId: number | null;
  studyId: number | null;
  form: Record<string, any>;
  computed: Record<string, any>;
}

export default function CostsCashFlowTab({ projectId }: CostsCashFlowTabProps) {
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

  const [unitCounts, setUnitCounts] = useState<Record<string, number>>({});
  const [avgAreas, setAvgAreas] = useState<Record<string, number>>({});
  const [basePrices, setBasePrices] = useState<Record<string, number>>({});
  const [activeScenario, setActiveScenario] = useState<ScenarioKey>("base");
  const [dirty, setDirty] = useState(false);
  const [moJoelleSource, setMoJoelleSource] = useState(false);
  const [cpJoelleSource, setCpJoelleSource] = useState(false);

  const moSaveMutation = trpc.marketOverview.save.useMutation({
    onSuccess: () => { moQuery.refetch(); toast.success("تم حفظ التوزيع"); },
    onError: () => toast.error("خطأ في الحفظ"),
  });
  const cpSaveMutation = trpc.competitionPricing.save.useMutation({
    onSuccess: () => { cpQuery.refetch(); toast.success("تم حفظ التسعير"); },
    onError: () => toast.error("خطأ في الحفظ"),
  });

  /* ═══ Load data from DB ═══ */
  useEffect(() => {
    if (!moQuery.data) return;
    const d = moQuery.data;
    const newAvg: Record<string, number> = {};
    const newCounts: Record<string, number> = {};
    UNIT_ROWS.forEach(row => {
      const pct = parseFloat((d as any)[row.pctKey] || "0");
      const avg = (d as any)[row.avgKey] || 0;
      const defaultArea = DEFAULT_AVG_AREAS[row.pctKey]?.defaultArea || 0;
      const effectiveAvg = avg > 0 ? avg : defaultArea;
      newAvg[row.key] = effectiveAvg;
      const sellable = getSellableFromProject(row.cat);
      if (pct > 0 && effectiveAvg > 0 && sellable > 0) {
        newCounts[row.key] = Math.floor((sellable * pct / 100) / effectiveAvg);
      } else {
        newCounts[row.key] = 0;
      }
    });
    setAvgAreas(newAvg);
    setUnitCounts(prev => {
      const hasManualEdits = Object.values(prev).some(v => v > 0);
      return hasManualEdits ? prev : newCounts;
    });
    if (d.aiRecommendationsJson) setMoJoelleSource(true);
  }, [moQuery.data]);

  useEffect(() => {
    if (!cpQuery.data) return;
    const d = cpQuery.data;
    const newPrices: Record<string, number> = {};
    UNIT_ROWS.forEach(row => { newPrices[row.key] = (d as any)[row.baseField] || 0; });
    setBasePrices(newPrices);
    if (d.activeScenario) setActiveScenario(d.activeScenario as ScenarioKey);
    if (d.aiRecommendationsJson) setCpJoelleSource(true);
  }, [cpQuery.data]);

  function getSellableFromProject(cat: string): number {
    const p2 = project || {} as any;
    const gfaRes = parseFloat(p2.gfaResidentialSqft || "0");
    const gfaRet = parseFloat(p2.gfaRetailSqft || "0");
    const gfaOff = parseFloat(p2.gfaOfficesSqft || "0");
    if (cat === "residential") return gfaRes * 0.95;
    if (cat === "retail") return gfaRet * 0.97;
    return gfaOff * 0.95;
  }

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

  const getSellable = useCallback((cat: string) => {
    if (cat === "residential") return sellableRes;
    if (cat === "retail") return sellableRet;
    return sellableOff;
  }, [sellableRes, sellableRet, sellableOff]);

  /* ═══ Computed results per row (with absorption into 2BR) ═══ */
  const rowResults = useMemo(() => {
    // Step 1: basic calculations
    const basic = UNIT_ROWS.map(row => {
      const count = unitCounts[row.key] || 0;
      const avg = avgAreas[row.key] || DEFAULT_AVG_AREAS[row.pctKey]?.defaultArea || 0;
      const price = basePrices[row.key] || 0;
      const totalArea = count * avg;
      return { ...row, count, avg, price, totalArea };
    });

    // Step 2: per-category surplus → absorb into 2BR
    const results = basic.map(r => {
      const sellable = getSellable(r.cat);
      const catRows = basic.filter(x => x.cat === r.cat);
      const catTotalArea = catRows.reduce((s, x) => s + x.totalArea, 0);
      const surplus = sellable - catTotalArea;

      // Effective area = avg area (default)
      let effectiveAvg = r.avg;

      // If this is 2BR and there's surplus > 0, absorb it
      if (r.is2br && surplus > 0 && r.count > 0) {
        effectiveAvg = r.avg + (surplus / r.count);
      }

      const effectiveTotalArea = r.is2br && surplus > 0 && r.count > 0 ? r.count * effectiveAvg : r.totalArea;
      const pct = sellable > 0 ? (effectiveTotalArea / sellable) * 100 : 0;
      const multiplier = activeScenario === "optimistic" ? 1.10 : activeScenario === "conservative" ? 0.90 : 1.00;
      const scenarioPrice = r.price * multiplier;
      const unitPrice = effectiveAvg * scenarioPrice;
      const revenue = r.count * unitPrice;

      let parking = 0;
      if (r.cat === "residential") {
        parking = r.count * (r.avg <= PARKING.residential.threshold ? PARKING.residential.below : PARKING.residential.above);
      } else if (r.cat === "retail") {
        parking = Math.ceil(r.totalArea / PARKING.retail.perSqft);
      } else {
        parking = Math.ceil(r.totalArea / PARKING.offices.perSqft);
      }

      return { ...r, effectiveAvg, effectiveTotalArea, pct, scenarioPrice, unitPrice, revenue, parking, sellable };
    });

    return results;
  }, [unitCounts, avgAreas, basePrices, activeScenario, getSellable]);

  const catSummary = useCallback((cat: string) => {
    const rows = rowResults.filter(r => r.cat === cat);
    const sellable = getSellable(cat);
    const totalUnits = rows.reduce((s, r) => s + r.count, 0);
    const rawTotalArea = rows.reduce((s, r) => s + r.totalArea, 0);
    const effectiveTotalArea = rows.reduce((s, r) => s + r.effectiveTotalArea, 0);
    const totalParking = rows.reduce((s, r) => s + r.parking, 0);
    const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
    const surplus = sellable - rawTotalArea;
    const usedPct = sellable > 0 ? (rawTotalArea / sellable) * 100 : 0;
    return { totalUnits, rawTotalArea, effectiveTotalArea, totalParking, totalRevenue, surplus, usedPct, sellable };
  }, [rowResults, getSellable]);

  const resSummary = useMemo(() => catSummary("residential"), [catSummary]);
  const retSummary = useMemo(() => catSummary("retail"), [catSummary]);
  const offSummary = useMemo(() => catSummary("offices"), [catSummary]);

  const grandTotalUnits = resSummary.totalUnits + retSummary.totalUnits + offSummary.totalUnits;
  const grandTotalArea = resSummary.effectiveTotalArea + retSummary.effectiveTotalArea + offSummary.effectiveTotalArea;
  const grandTotalParking = resSummary.totalParking + retSummary.totalParking + offSummary.totalParking;
  const grandTotalRevenue = resSummary.totalRevenue + retSummary.totalRevenue + offSummary.totalRevenue;

  const revenueByScenario = useMemo(() => {
    const calc = (mult: number) => rowResults.reduce((s, r) => {
      return s + r.count * r.effectiveAvg * r.price * mult;
    }, 0);
    return { optimistic: calc(1.10), base: calc(1.00), conservative: calc(0.90) };
  }, [rowResults]);

  const joelSuggestions = useMemo(() => {
    try {
      const moData = moQuery.data;
      const cpData = cpQuery.data;
      if (!moData?.aiRecommendationsJson && !cpData?.aiRecommendationsJson) return null;
      return { mo: moData?.aiRecommendationsJson ? JSON.parse(moData.aiRecommendationsJson) : {}, cp: cpData?.aiRecommendationsJson ? JSON.parse(cpData.aiRecommendationsJson) : {} };
    } catch { return null; }
  }, [moQuery.data, cpQuery.data]);

  const updateCount = useCallback((key: string, val: number) => { setUnitCounts(prev => ({ ...prev, [key]: Math.max(0, Math.round(val)) })); setDirty(true); }, []);
  const updateAvg = useCallback((key: string, val: number) => { setAvgAreas(prev => ({ ...prev, [key]: val })); setDirty(true); }, []);
  const updatePrice = useCallback((key: string, val: number) => { setBasePrices(prev => ({ ...prev, [key]: val })); setDirty(true); }, []);

  const handleSave = () => {
    if (!projectId) return;
    const moPayload: any = { projectId, finishingQuality: "standard" };
    UNIT_ROWS.forEach(row => {
      const count = unitCounts[row.key] || 0;
      const avg = avgAreas[row.key] || DEFAULT_AVG_AREAS[row.pctKey]?.defaultArea || 0;
      const sellable = getSellable(row.cat);
      const pct = sellable > 0 ? ((count * avg) / sellable) * 100 : 0;
      moPayload[row.pctKey] = pct;
      moPayload[row.avgKey] = avg;
    });
    moSaveMutation.mutate(moPayload);
    const bp = basePrices;
    cpSaveMutation.mutate({
      projectId,
      baseStudioPrice: bp.studio || 0, base1brPrice: bp["1br"] || 0, base2brPrice: bp["2br"] || 0, base3brPrice: bp["3br"] || 0,
      baseRetailSmallPrice: bp.retSmall || 0, baseRetailMediumPrice: bp.retMedium || 0, baseRetailLargePrice: bp.retLarge || 0,
      baseOfficeSmallPrice: bp.offSmall || 0, baseOfficeMediumPrice: bp.offMedium || 0, baseOfficeLargePrice: bp.offLarge || 0,
      optStudioPrice: Math.round((bp.studio || 0) * 1.1), opt1brPrice: Math.round((bp["1br"] || 0) * 1.1), opt2brPrice: Math.round((bp["2br"] || 0) * 1.1), opt3brPrice: Math.round((bp["3br"] || 0) * 1.1),
      optRetailSmallPrice: Math.round((bp.retSmall || 0) * 1.1), optRetailMediumPrice: Math.round((bp.retMedium || 0) * 1.1), optRetailLargePrice: Math.round((bp.retLarge || 0) * 1.1),
      optOfficeSmallPrice: Math.round((bp.offSmall || 0) * 1.1), optOfficeMediumPrice: Math.round((bp.offMedium || 0) * 1.1), optOfficeLargePrice: Math.round((bp.offLarge || 0) * 1.1),
      consStudioPrice: Math.round((bp.studio || 0) * 0.9), cons1brPrice: Math.round((bp["1br"] || 0) * 0.9), cons2brPrice: Math.round((bp["2br"] || 0) * 0.9), cons3brPrice: Math.round((bp["3br"] || 0) * 0.9),
      consRetailSmallPrice: Math.round((bp.retSmall || 0) * 0.9), consRetailMediumPrice: Math.round((bp.retMedium || 0) * 0.9), consRetailLargePrice: Math.round((bp.retLarge || 0) * 0.9),
      consOfficeSmallPrice: Math.round((bp.offSmall || 0) * 0.9), consOfficeMediumPrice: Math.round((bp.offMedium || 0) * 0.9), consOfficeLargePrice: Math.round((bp.offLarge || 0) * 0.9),
      activeScenario,
      paymentBookingPct: 10, paymentBookingTiming: "عند التوقيع",
      paymentConstructionPct: 60, paymentConstructionTiming: "أثناء الإنشاء",
      paymentHandoverPct: 30, paymentHandoverTiming: "عند التسليم",
      paymentDeferredPct: 0, paymentDeferredTiming: "",
    });
    setDirty(false);
  };

  const joelleStatus = joelleStatusQuery.data;
  const hasAnyJoelleData = joelleStatus?.engine6Ready || joelleStatus?.engine7Ready;
  const alreadyApplied = joelleStatus?.moHasJoelleData && joelleStatus?.cpHasJoelleData;

  const scenarioConfig: Record<ScenarioKey, { label: string; color: string; bgBadge: string; icon: any }> = {
    optimistic: { label: "متفائل +10%", color: "text-emerald-700", bgBadge: "bg-emerald-500", icon: TrendingUp },
    base: { label: "أساسي", color: "text-blue-700", bgBadge: "bg-blue-500", icon: BarChart3 },
    conservative: { label: "متحفظ -10%", color: "text-orange-700", bgBadge: "bg-orange-500", icon: TrendingDown },
  };

  /* ═══ Surplus inline bar ═══ */
  const SurplusInline = ({ surplus, sellable }: { surplus: number; sellable: number }) => {
    if (sellable <= 0) return null;
    const pct = (surplus / sellable) * 100;
    const isNeg = surplus < 0;
    const isZero = Math.abs(surplus) < 1;
    return (
      <div className="flex items-center gap-1.5 py-0.5">
        <span className={`text-[10px] font-bold ${isZero ? "text-emerald-600" : isNeg ? "text-red-600" : "text-amber-600"}`}>
          {isZero ? "✓ صفر" : `${isNeg ? "عجز" : "فائض"}: ${fmt(Math.abs(surplus))} sqft (${Math.abs(pct).toFixed(1)}%)`}
        </span>
        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${isZero ? "bg-emerald-400" : isNeg ? "bg-red-400" : "bg-amber-400"}`}
            style={{ width: `${isZero ? 100 : Math.max(5, 100 - Math.min(100, Math.abs(pct)))}%` }} />
        </div>
      </div>
    );
  };

  /* ═══ RENDER ═══ */
  if (!projectId) return (<div className="text-center py-12 text-muted-foreground"><DollarSign className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>اختر مشروعاً لعرض البيانات</p></div>);
  if (projectQuery.isLoading) return (<div className="text-center py-12"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /><p className="text-sm text-muted-foreground mt-2">جاري تحميل البيانات...</p></div>);

  /* Build aligned row data per category */
  const catData = CATS.map(c => {
    const rows = UNIT_ROWS.filter(r => r.cat === c.key);
    const summary = c.key === "residential" ? resSummary : c.key === "retail" ? retSummary : offSummary;
    const sellable = getSellable(c.key);
    return { ...c, rows, summary, sellable };
  }).filter(c => c.sellable > 0);

  return (
    <div className="max-w-5xl mx-auto space-y-3" dir="rtl">

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
            className={`gap-1 h-7 text-[11px] ${alreadyApplied ? "text-emerald-700" : "text-purple-700 hover:bg-purple-100"}`}>
            {applyJoelleMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : alreadyApplied ? <CheckCircle2 className="w-3 h-3" /> : <Zap className="w-3 h-3" />}
            {alreadyApplied ? "إعادة تطبيق" : "تعبئة من جويل"}
          </Button>
        </div>
      )}

      {/* ═══ SECTION 1: تفاصيل الأرض و GFA ═══ */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="px-4 py-2 border-b border-gray-100 bg-gradient-to-l from-slate-50 to-blue-50/40">
          <h3 className="text-xs font-bold text-gray-800">تفاصيل الأرض والمساحات</h3>
        </div>
        <div className="grid grid-cols-3 gap-0 divide-x divide-gray-100" dir="rtl">
          {[
            { label: "مساحة الأرض", val: `${fmt(plotAreaSqft)} sqft`, sub: `${fmt(plotAreaSqm)} م²`, color: "text-sky-700", bg: "bg-sky-50/40" },
            { label: "BUA", val: `${fmt(buaSqft)} sqft`, sub: "", color: "text-amber-700", bg: "bg-amber-50/40" },
            { label: "GFA الإجمالي", val: `${fmt(gfaTotalSqft)} sqft`, sub: "", color: "text-emerald-700", bg: "bg-emerald-50/40" },
          ].map(item => (
            <div key={item.label} className={`px-3 py-2 ${item.bg}`}>
              <div className="text-[9px] font-bold text-gray-500 uppercase">{item.label}</div>
              <div className={`text-sm font-black font-mono ${item.color}`} dir="ltr">{item.val}</div>
              {item.sub && <div className="text-[9px] text-gray-400 font-mono" dir="ltr">{item.sub}</div>}
            </div>
          ))}
        </div>
        {/* GFA breakdown */}
        <div className="border-t border-gray-100">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="bg-gray-50/60 border-b border-gray-100">
                <th className="text-right py-1 pr-3 font-bold text-gray-500 text-[10px]">الفئة</th>
                <th className="text-center py-1 font-bold text-gray-500 text-[10px]">GFA (sqft)</th>
                <th className="text-center py-1 font-bold text-gray-500 text-[10px]">الكفاءة</th>
                <th className="text-center py-1 font-bold text-gray-500 text-[10px]">قابل للبيع (sqft)</th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: "سكني", gfa: gfaResSqft, eff: 95, sell: sellableRes, dot: "bg-sky-500" },
                { label: "تجزئة", gfa: gfaRetSqft, eff: 97, sell: sellableRet, dot: "bg-amber-500" },
                { label: "مكاتب", gfa: gfaOffSqft, eff: 95, sell: sellableOff, dot: "bg-violet-500" },
              ].filter(r => r.gfa > 0).map(r => (
                <tr key={r.label} className="border-b border-gray-50 hover:bg-gray-50/40">
                  <td className="py-1 pr-3 flex items-center gap-1.5"><span className={`w-2 h-2 rounded-full ${r.dot}`} />{r.label}</td>
                  <td className="py-1 text-center font-mono text-gray-700" dir="ltr">{fmt(r.gfa)}</td>
                  <td className="py-1 text-center"><span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{r.eff}%</span></td>
                  <td className="py-1 text-center font-mono font-semibold text-gray-800" dir="ltr">{fmt(r.sell)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══ SECTION 2: Joel's Suggestions ═══ */}
      {joelSuggestions && (
        <div className="bg-white rounded-xl border border-purple-200/60 overflow-hidden shadow-sm">
          <div className="px-4 py-2 border-b border-purple-100 bg-gradient-to-l from-purple-50 to-pink-50/40 flex items-center gap-2">
            <img src={JOEL_AVATAR} className="w-5 h-5 rounded-full" alt="" />
            <h3 className="text-xs font-bold text-purple-800">اقتراحات جويل</h3>
            <span className="text-[9px] text-purple-500 font-medium">(للقراءة فقط)</span>
          </div>
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b-2 border-purple-100 bg-purple-50/20">
                <th className="text-right py-1.5 pr-3 font-bold text-purple-600">النوع</th>
                <th className="text-center py-1.5 font-bold text-purple-600">النسبة</th>
                <th className="text-center py-1.5 font-bold text-purple-600">المساحة (sqft)</th>
                <th className="text-center py-1.5 font-bold text-purple-600">السعر/قدم²</th>
              </tr>
            </thead>
            <tbody>
              {UNIT_ROWS.map(row => {
                const moRec = joelSuggestions.mo;
                const cpRec = joelSuggestions.cp;
                const pct = moRec?.[row.pctKey] || 0;
                const avg = moRec?.[row.avgKey] || 0;
                const price = cpRec?.[row.baseField] || 0;
                if (!pct && !avg && !price) return null;
                return (
                  <tr key={row.key} className={`border-b ${row.divider ? "border-t-[3px] border-t-purple-200" : "border-purple-50"} hover:bg-purple-50/20`}>
                    <td className="py-1 pr-3 text-gray-700">
                      {row.catLabel && <span className="text-[9px] font-bold text-purple-400 ml-1">{row.catLabel} /</span>}
                      {row.label}
                    </td>
                    <td className="py-1 text-center">{pct > 0 ? <span className="bg-purple-100 text-purple-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{typeof pct === "number" ? pct.toFixed(1) : pct}%</span> : "—"}</td>
                    <td className="py-1 text-center font-mono text-gray-600" dir="ltr">{avg > 0 ? fmt(avg) : "—"}</td>
                    <td className="py-1 text-center font-mono text-gray-600" dir="ltr">{price > 0 ? fmt(price) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ═══ SECTION 3: التوزيع التفاعلي والتسعير ═══ */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="px-4 py-2 border-b border-gray-100 bg-gradient-to-l from-slate-50 to-indigo-50/30 flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-xs font-bold text-gray-800">التوزيع التفاعلي والتسعير</h3>
          <div className="flex gap-1">
            {(["optimistic", "base", "conservative"] as const).map(sc => {
              const cfg = scenarioConfig[sc];
              return (
                <button key={sc} onClick={() => { setActiveScenario(sc); setDirty(true); }}
                  className={`text-[10px] font-bold px-2.5 py-1 rounded-full transition-all ${activeScenario === sc ? `text-white ${cfg.bgBadge} shadow-sm` : "text-gray-500 bg-gray-100 hover:bg-gray-200"}`}>
                  {cfg.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ═══ TWO PANELS — aligned rows ═══ */}
        <div className="flex gap-4 p-3">

          {/* ═══ RIGHT PANEL: المدخلات ═══ */}
          <div className="w-[35%] min-w-0 border border-blue-200/60 rounded-lg overflow-hidden bg-blue-50/10">
            <div className="px-3 py-1.5 bg-blue-50/60 border-b border-blue-200/40">
              <span className="text-[10px] font-bold text-blue-700">المدخلات — غيّر العدد أو المساحة</span>
            </div>
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b-2 border-blue-100 bg-blue-50/30">
                  <th className="text-right py-1 pr-2 font-bold text-blue-600 text-[10px]">النوع</th>
                  <th className="text-center py-1 font-bold text-blue-600 text-[10px] w-14">المساحة</th>
                  <th className="text-center py-1 font-bold text-blue-600 text-[10px] w-12">العدد</th>
                  <th className="text-center py-1 font-bold text-blue-600 text-[10px] w-16">الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {catData.map(cat => (
                  <>
                    {cat.rows.map((row) => {
                      const count = unitCounts[row.key] || 0;
                      const avg = avgAreas[row.key] || DEFAULT_AVG_AREAS[row.pctKey]?.defaultArea || 0;
                      const total = count * avg;
                      const catDotColor: Record<string, string> = { sky: "bg-sky-500", amber: "bg-amber-500", violet: "bg-violet-500" };
                      return (
                        <tr key={row.key} className={`border-b ${row.divider ? "border-t-[3px] border-t-gray-300" : "border-gray-100"} hover:bg-blue-50/20`}>
                          <td className="py-0.5 pr-2 text-[10px] text-gray-700">
                            {row.catLabel ? (
                              <span className="flex items-center gap-1">
                                <span className={`w-2 h-2 rounded-full ${catDotColor[row.catColor]}`} />
                                <span className="font-bold text-gray-500">{row.catLabel} /</span>
                                <span>{row.label}</span>
                              </span>
                            ) : <span className="pr-3">{row.label}</span>}
                          </td>
                          <td className="py-0 w-14"><EditableNum value={avg} onChange={(v) => updateAvg(row.key, v)} /></td>
                          <td className="py-0 w-12"><EditableNum value={count} onChange={(v) => updateCount(row.key, v)} cls="font-bold text-blue-700" /></td>
                          <td className="py-0.5 text-center font-mono text-[10px] text-gray-600 w-16" dir="ltr">{total > 0 ? fmt(total) : "—"}</td>
                        </tr>
                      );
                    })}
                    {/* Surplus for this category — directly below its rows */}
                    <tr className="border-b-2 border-gray-200">
                      <td colSpan={4} className="px-2 py-1">
                        <SurplusInline surplus={cat.summary.surplus} sellable={cat.sellable} />
                      </td>
                    </tr>
                  </>
                ))}
              </tbody>
            </table>
          </div>

          {/* ═══ LEFT PANEL: النتائج ═══ */}
          <div className="w-[65%] min-w-0 border border-emerald-200/60 rounded-lg overflow-hidden bg-emerald-50/10">
            <div className="px-3 py-1.5 bg-emerald-50/60 border-b border-emerald-200/40">
              <span className="text-[10px] font-bold text-emerald-700">النتائج — محسوبة تلقائياً (الفائض يُمتص في غرفتين وصالة)</span>
            </div>
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b-2 border-emerald-100 bg-emerald-50/30">
                  <th className="text-right py-1 pr-2 font-bold text-emerald-600 text-[10px]">النوع</th>
                  <th className="text-center py-1 font-bold text-emerald-600 text-[10px] w-12">النسبة</th>
                  <th className="text-center py-1 font-bold text-emerald-600 text-[10px] w-10">العدد</th>
                  <th className="text-center py-1 font-bold text-emerald-600 text-[10px] w-14">م. الوحدة</th>
                  <th className="text-center py-1 font-bold text-emerald-600 text-[10px] w-16">إجمالي sqft</th>
                  <th className="text-center py-1 font-bold text-emerald-600 text-[10px] w-14">سعر/sqft</th>
                  <th className={`text-center py-1 font-bold text-[10px] w-20 ${scenarioConfig[activeScenario].color}`}>الإيراد</th>
                </tr>
              </thead>
              <tbody>
                {catData.map(cat => {
                  const catRows = rowResults.filter(r => r.cat === cat.key && (r.count > 0 || r.price > 0));
                  return (
                    <>
                      {catRows.map((r, i) => (
                        <tr key={r.key} className={`border-b ${r.divider ? "border-t-[3px] border-t-gray-300" : "border-gray-100"} hover:bg-gray-50/40`}>
                          <td className="py-1 pr-2 text-gray-800 text-[10px]">
                            {i === 0 && <span className="text-[9px] font-bold text-gray-400 ml-1">{cat.label} /</span>}
                            {r.label}
                          </td>
                          <td className="py-1 text-center">
                            {r.pct > 0 ? <span className="bg-gray-100 text-gray-700 text-[9px] font-bold px-1 py-0.5 rounded-full">{r.pct.toFixed(1)}%</span> : "—"}
                          </td>
                          <td className="py-1 text-center font-mono text-[11px] text-gray-800">{r.count || "—"}</td>
                          <td className="py-1 text-center font-mono text-[10px] text-gray-600" dir="ltr">
                            {r.effectiveAvg > 0 ? (
                              r.is2br && r.effectiveAvg !== r.avg ? (
                                <span className="text-emerald-700 font-bold">{fmt(r.effectiveAvg)}</span>
                              ) : fmt(r.effectiveAvg)
                            ) : "—"}
                          </td>
                          <td className="py-1 text-center font-mono text-[10px] text-gray-700 font-semibold" dir="ltr">{r.effectiveTotalArea > 0 ? fmt(r.effectiveTotalArea) : "—"}</td>
                          <td className="py-1 text-center font-mono text-[10px] text-gray-600" dir="ltr">{r.scenarioPrice > 0 ? fmt(r.scenarioPrice) : "—"}</td>
                          <td className={`py-1 text-center font-mono text-[10px] font-bold ${scenarioConfig[activeScenario].color}`} dir="ltr">{r.revenue > 0 ? fmt(r.revenue) : "—"}</td>
                        </tr>
                      ))}
                      {/* Category subtotal */}
                      <tr className={`${cat.bgSub} font-semibold border-b-2 border-gray-200`}>
                        <td className={`py-1 pr-2 text-[10px] ${cat.textSub}`}>إجمالي {cat.label}</td>
                        <td className={`py-1 text-center text-[9px] ${cat.textSub}`}>{cat.summary.sellable > 0 ? "100%" : "—"}</td>
                        <td className={`py-1 text-center font-mono text-[10px] ${cat.textSub}`}>{fmt(cat.summary.totalUnits)}</td>
                        <td className="py-1 text-center text-[10px] text-gray-400">—</td>
                        <td className={`py-1 text-center font-mono text-[10px] font-bold ${cat.textSub}`} dir="ltr">{fmt(cat.summary.effectiveTotalArea)}</td>
                        <td className="py-1 text-center text-[10px] text-gray-400">—</td>
                        <td className={`py-1 text-center font-mono text-[10px] font-bold ${scenarioConfig[activeScenario].color}`} dir="ltr">{fmt(cat.summary.totalRevenue)}</td>
                      </tr>
                    </>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-gradient-to-l from-gray-800 to-gray-900 text-white font-bold">
                  <td className="py-1.5 pr-2 text-[11px]">الإجمالي الكلي</td>
                  <td className="py-1.5 text-center text-[10px]">—</td>
                  <td className="py-1.5 text-center font-mono text-[11px]">{fmt(grandTotalUnits)}</td>
                  <td className="py-1.5 text-center text-[10px]">—</td>
                  <td className="py-1.5 text-center font-mono text-[11px]" dir="ltr">{fmt(grandTotalArea)}</td>
                  <td className="py-1.5 text-center text-[10px]">—</td>
                  <td className="py-1.5 text-center font-mono text-[11px]" dir="ltr">{fmt(grandTotalRevenue)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* ═══ PARKING — separate section ═══ */}
        {grandTotalParking > 0 && (
          <div className="mx-3 mb-3 border border-orange-200/60 rounded-lg overflow-hidden">
            <div className="px-3 py-1.5 bg-orange-50/60 border-b border-orange-200/40 flex items-center gap-2">
              <Car className="w-4 h-4" style={{ color: "#c2410c" }} />
              <span className="text-[10px] font-bold text-orange-800">المواقف المطلوبة — معايير دبي</span>
            </div>
            <div className="px-3 py-2">
              <div className="grid grid-cols-4 gap-2 text-[11px]">
                {[
                  { label: "سكني", val: resSummary.totalParking, show: sellableRes > 0 },
                  { label: "تجزئة", val: retSummary.totalParking, show: sellableRet > 0 },
                  { label: "مكاتب", val: offSummary.totalParking, show: sellableOff > 0 },
                  { label: "الإجمالي", val: grandTotalParking, show: true },
                ].filter(x => x.show).map(x => (
                  <div key={x.label} className="flex items-center justify-between bg-orange-50/40 rounded px-2 py-1">
                    <span className="text-gray-600 font-medium">{x.label}</span>
                    <span className="font-mono font-bold text-orange-800">{fmt(x.val)} <span className="text-[9px] font-normal text-orange-600">موقف</span></span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Revenue comparison strip */}
        <div className="grid grid-cols-3 border-t-2 border-gray-200">
          {(["optimistic", "base", "conservative"] as const).map(sc => {
            const rev = revenueByScenario[sc];
            const cfg = scenarioConfig[sc];
            const isActive = sc === activeScenario;
            const activeBg = sc === "optimistic" ? "bg-emerald-50" : sc === "conservative" ? "bg-orange-50" : "bg-blue-50";
            return (
              <div key={sc} className={`px-3 py-2 text-center border-l first:border-l-0 border-gray-200 transition-colors ${isActive ? activeBg : "bg-gray-50/50"}`}>
                <div className={`text-[10px] font-bold ${isActive ? cfg.color : "text-gray-500"}`}>{cfg.label}</div>
                <div className={`text-sm font-black font-mono ${isActive ? cfg.color : "text-gray-600"}`} dir="ltr">{fmt(rev)}</div>
                <div className="text-[9px] text-gray-400 font-medium">AED</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Save button */}
      {dirty && (
        <div className="flex justify-end">
          <Button size="sm" onClick={handleSave} disabled={moSaveMutation.isPending || cpSaveMutation.isPending} className="gap-1.5 h-7 text-[11px]">
            {(moSaveMutation.isPending || cpSaveMutation.isPending) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            حفظ التوزيع والتسعير
          </Button>
        </div>
      )}
    </div>
  );
}
