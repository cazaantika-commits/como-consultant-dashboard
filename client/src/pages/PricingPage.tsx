import { useMemo, useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Building2, Car, Ruler, Calculator, AlertTriangle, CheckCircle,
  Home, Store, Briefcase, Info, DollarSign, TrendingUp, Save, Loader2,
} from "lucide-react";
import { ProjectSelector } from "@/components/ProjectSelector";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  PROJECT_INPUTS,
  RATES,
  dbProjectToInputs,
  dbProjectToRates,
  type ProjectInputs,
  type ProjectRates,
} from "@/lib/projectData";
import { useToast } from "@/hooks/use-toast";

// ═══════════════════════════════════════════
// قاعدة المواقف
// ═══════════════════════════════════════════
function calcParking(type: string, area: number, count: number): number {
  if (type.startsWith("res")) {
    return count * (area < 1500 ? 1 : 2);
  }
  return count * Math.ceil(area / 500);
}

// ═══════════════════════════════════════════
// أنواع الوحدات
// ═══════════════════════════════════════════
interface UnitType {
  key: string;
  label: string;
  category: "residential" | "retail" | "office";
  defaultArea: number;
  defaultPrice: number;
}

const UNIT_TYPES: UnitType[] = [
  { key: "onebed", label: "غرفة وصالة", category: "residential", defaultArea: 750, defaultPrice: 1550 },
  { key: "twobed", label: "غرفتين وصالة", category: "residential", defaultArea: 1300, defaultPrice: 1500 },
  { key: "threebed", label: "ثلاث غرف وصالة", category: "residential", defaultArea: 1650, defaultPrice: 1450 },
  { key: "retail_small", label: "محل صغير", category: "retail", defaultArea: 850, defaultPrice: 3000 },
  { key: "retail_medium", label: "محل متوسط", category: "retail", defaultArea: 1200, defaultPrice: 2500 },
  { key: "retail_large", label: "محل كبير", category: "retail", defaultArea: 1800, defaultPrice: 2000 },
  { key: "office_small", label: "مكتب صغير", category: "office", defaultArea: 1200, defaultPrice: 1900 },
  { key: "office_medium", label: "مكتب متوسط", category: "office", defaultArea: 2000, defaultPrice: 1800 },
  { key: "office_large", label: "مكتب كبير", category: "office", defaultArea: 3500, defaultPrice: 1700 },
];

const DEFAULT_AREAS: Record<string, number> = {
  onebed: 750, twobed: 1300, threebed: 1650,
  retail_small: 850, retail_medium: 1200, retail_large: 1800,
  office_small: 1200, office_medium: 2000, office_large: 3500,
};

const DEFAULT_PRICES: Record<string, number> = {
  onebed: 1550, twobed: 1500, threebed: 1450,
  retail_small: 3000, retail_medium: 2500, retail_large: 2000,
  office_small: 1900, office_medium: 1800, office_large: 1700,
};

// ═══════════════════════════════════════════
// FORMAT HELPERS
// ═══════════════════════════════════════════
function fmtN(n: number): string {
  return Math.round(n).toLocaleString("ar-AE");
}

// ═══════════════════════════════════════════
// MAPPING: PricingPage keys → project DB fields (direct)
// ═══════════════════════════════════════════
const COUNT_MAP: Record<string, string> = {
  onebed: 'residential1brCount',
  twobed: 'residential2brCount',
  threebed: 'residential3brCount',
  retail_small: 'retailSmallCount',
  retail_medium: 'retailMediumCount',
  retail_large: 'retailLargeCount',
  office_small: 'officeSmallCount',
  office_medium: 'officeMediumCount',
  office_large: 'officeLargeCount',
};

const AREA_MAP: Record<string, string> = {
  onebed: 'residential1brArea',
  twobed: 'residential2brArea',
  threebed: 'residential3brArea',
  retail_small: 'retailSmallArea',
  retail_medium: 'retailMediumArea',
  retail_large: 'retailLargeArea',
  office_small: 'officeSmallArea',
  office_medium: 'officeMediumArea',
  office_large: 'officeLargeArea',
};

const PRICE_MAP: Record<string, string> = {
  onebed: 'residential1brPrice',
  twobed: 'residential2brPrice',
  threebed: 'residential3brPrice',
  retail_small: 'retailSmallPrice',
  retail_medium: 'retailMediumPrice',
  retail_large: 'retailLargePrice',
  office_small: 'officeSmallPrice',
  office_medium: 'officeMediumPrice',
  office_large: 'officeLargePrice',
};

// ═══════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════
export default function PricingPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { selectedProjectId, setSelectedProjectId } = useProjectContext();
  const projectQuery = trpc.projects.getById.useQuery(selectedProjectId!, { enabled: !!selectedProjectId && !!user });

  // Save directly to project table
  const updateProject = trpc.projects.update.useMutation();
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Dynamic project data
  const projectData = useMemo(() => {
    if (projectQuery.data) {
      const i = dbProjectToInputs(projectQuery.data);
      const r = dbProjectToRates(projectQuery.data);
      return { i, r };
    }
    return { i: PROJECT_INPUTS, r: RATES };
  }, [projectQuery.data]);

  const { i } = projectData;

  // Sellable areas from project data
  const SELLABLE = useMemo(() => ({
    residential: i.gfaResidential * i.efficiencyResidential,
    retail: i.gfaRetail * i.efficiencyRetail,
    office: i.gfaOffice * i.efficiencyOffice,
  }), [i]);

  const GFA_TOTAL = i.gfaResidential + i.gfaRetail + i.gfaOffice;

  const [counts, setCounts] = useState<Record<string, number>>({
    onebed: 0, twobed: 0, threebed: 0,
    retail_small: 0, retail_medium: 0, retail_large: 0,
    office_small: 0, office_medium: 0, office_large: 0,
  });

  const [areas, setAreas] = useState<Record<string, number>>({ ...DEFAULT_AREAS });
  const [prices, setPrices] = useState<Record<string, number>>({ ...DEFAULT_PRICES });

  // Load saved data directly from project record
  useEffect(() => {
    if (!selectedProjectId) return;
    if (projectQuery.isLoading) return;
    const p = projectQuery.data;
    if (!p) return;

    // Check if project has saved unit counts (any count > 0)
    const hasSavedCounts = Object.values(COUNT_MAP).some(dbField => {
      const val = (p as any)[dbField];
      return val != null && Number(val) > 0;
    });

    if (hasSavedCounts) {
      // Load from project record
      const newCounts: Record<string, number> = { onebed: 0, twobed: 0, threebed: 0, retail_small: 0, retail_medium: 0, retail_large: 0, office_small: 0, office_medium: 0, office_large: 0 };
      const newAreas: Record<string, number> = { ...DEFAULT_AREAS };
      const newPrices: Record<string, number> = { ...DEFAULT_PRICES };

      Object.entries(COUNT_MAP).forEach(([key, dbField]) => {
        const val = (p as any)[dbField];
        if (val != null && Number(val) > 0) newCounts[key] = Number(val);
      });
      Object.entries(AREA_MAP).forEach(([key, dbField]) => {
        const val = (p as any)[dbField];
        if (val != null && Number(val) > 0) newAreas[key] = Number(val);
      });
      Object.entries(PRICE_MAP).forEach(([key, dbField]) => {
        const val = (p as any)[dbField];
        if (val != null && Number(val) > 0) newPrices[key] = Number(val);
      });

      setCounts(newCounts);
      setAreas(newAreas);
      setPrices(newPrices);
      setHasUnsavedChanges(false);
    } else {
      // Smart auto-fill: distribute units based on 40/40/20 ratios
      const sellableRes = i.gfaResidential * i.efficiencyResidential;
      const sellableRetail = i.gfaRetail * i.efficiencyRetail;
      const sellableOffice = i.gfaOffice * i.efficiencyOffice;

      const smartCounts: Record<string, number> = { onebed: 0, twobed: 0, threebed: 0, retail_small: 0, retail_medium: 0, retail_large: 0, office_small: 0, office_medium: 0, office_large: 0 };

      if (sellableRes > 0) {
        const resArea40 = sellableRes * 0.4;
        const resArea20 = sellableRes * 0.2;
        smartCounts.onebed = Math.round(resArea40 / DEFAULT_AREAS.onebed);
        smartCounts.twobed = Math.round(resArea40 / DEFAULT_AREAS.twobed);
        smartCounts.threebed = Math.round(resArea20 / DEFAULT_AREAS.threebed);
      }
      if (sellableRetail > 0) {
        const retArea40 = sellableRetail * 0.4;
        const retArea20 = sellableRetail * 0.2;
        smartCounts.retail_small = Math.round(retArea40 / DEFAULT_AREAS.retail_small);
        smartCounts.retail_medium = Math.round(retArea40 / DEFAULT_AREAS.retail_medium);
        smartCounts.retail_large = Math.round(retArea20 / DEFAULT_AREAS.retail_large);
      }
      if (sellableOffice > 0) {
        const offArea40 = sellableOffice * 0.4;
        const offArea20 = sellableOffice * 0.2;
        smartCounts.office_small = Math.round(offArea40 / DEFAULT_AREAS.office_small);
        smartCounts.office_medium = Math.round(offArea40 / DEFAULT_AREAS.office_medium);
        smartCounts.office_large = Math.round(offArea20 / DEFAULT_AREAS.office_large);
      }

      setCounts(smartCounts);
      setAreas({ ...DEFAULT_AREAS });
      setPrices({ ...DEFAULT_PRICES });
      setHasUnsavedChanges(true);
    }
  }, [selectedProjectId, projectQuery.data, projectQuery.isLoading, i]);

  // Manual Save function - saves directly to project record
  const handleSave = useCallback(async () => {
    if (!selectedProjectId || !user) return;
    setIsSaving(true);
    try {
      const updateData: any = { id: selectedProjectId };
      Object.entries(COUNT_MAP).forEach(([key, dbField]) => {
        updateData[dbField] = counts[key] || 0;
      });
      Object.entries(AREA_MAP).forEach(([key, dbField]) => {
        updateData[dbField] = areas[key] || 0;
      });
      Object.entries(PRICE_MAP).forEach(([key, dbField]) => {
        updateData[dbField] = prices[key] || 0;
      });
      await updateProject.mutateAsync(updateData);
      // Invalidate project query to refresh data everywhere
      projectQuery.refetch();

      setHasUnsavedChanges(false);
      toast({ title: "تم الحفظ ✓", description: "تم حفظ بيانات التسعير في المشروع" });
    } catch (err) {
      toast({ title: "خطأ", description: "فشل حفظ البيانات", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  }, [selectedProjectId, user, counts, areas, prices, updateProject, toast, projectQuery]);

  const updateCount = useCallback((key: string, val: number) => {
    setCounts(prev => ({ ...prev, [key]: Math.max(0, val) }));
    setHasUnsavedChanges(true);
  }, []);

  const updateArea = useCallback((key: string, val: number) => {
    setAreas(prev => ({ ...prev, [key]: Math.max(0, val) }));
    setHasUnsavedChanges(true);
  }, []);

  const updatePrice = useCallback((key: string, val: number) => {
    setPrices(prev => ({ ...prev, [key]: Math.max(0, val) }));
    setHasUnsavedChanges(true);
  }, []);

  // ═══════════════════════════════════════════
  // CALCULATIONS
  // ═══════════════════════════════════════════
  const calc = useMemo(() => {
    const categoryTotals = { residential: 0, retail: 0, office: 0 };
    const categoryUnits = { residential: 0, retail: 0, office: 0 };
    const categoryParking = { residential: 0, retail: 0, office: 0 };
    const categoryRevenue = { residential: 0, retail: 0, office: 0 };

    const unitDetails = UNIT_TYPES.map(ut => {
      const count = counts[ut.key] || 0;
      const area = areas[ut.key] || ut.defaultArea;
      const price = prices[ut.key] || ut.defaultPrice;
      const totalArea = count * area;
      const revenue = count * area * price;
      const parking = calcParking(ut.category === "residential" ? "res" : ut.category, area, count);
      categoryTotals[ut.category] += totalArea;
      categoryUnits[ut.category] += count;
      categoryParking[ut.category] += parking;
      categoryRevenue[ut.category] += revenue;
      return { ...ut, count, area, price, totalArea, revenue, parking };
    });

    const balance = {
      residential: {
        used: categoryTotals.residential,
        available: SELLABLE.residential,
        diff: SELLABLE.residential - categoryTotals.residential,
        pct: categoryTotals.residential > 0 ? (categoryTotals.residential / SELLABLE.residential) * 100 : 0,
        waste: categoryTotals.residential > 0 ? ((SELLABLE.residential - categoryTotals.residential) / SELLABLE.residential) * 100 : 100,
      },
      retail: {
        used: categoryTotals.retail,
        available: SELLABLE.retail,
        diff: SELLABLE.retail - categoryTotals.retail,
        pct: categoryTotals.retail > 0 ? (categoryTotals.retail / SELLABLE.retail) * 100 : 0,
        waste: categoryTotals.retail > 0 ? ((SELLABLE.retail - categoryTotals.retail) / SELLABLE.retail) * 100 : 100,
      },
      office: {
        used: categoryTotals.office,
        available: SELLABLE.office,
        diff: SELLABLE.office - categoryTotals.office,
        pct: categoryTotals.office > 0 ? (categoryTotals.office / SELLABLE.office) * 100 : 0,
        waste: categoryTotals.office > 0 ? ((SELLABLE.office - categoryTotals.office) / SELLABLE.office) * 100 : 100,
      },
    };

    const totalParking = categoryParking.residential + categoryParking.retail + categoryParking.office;
    const totalUnits = categoryUnits.residential + categoryUnits.retail + categoryUnits.office;
    const totalRevenue = categoryRevenue.residential + categoryRevenue.retail + categoryRevenue.office;

    const avgPrice = {
      residential: categoryTotals.residential > 0 ? categoryRevenue.residential / categoryTotals.residential : 0,
      retail: categoryTotals.retail > 0 ? categoryRevenue.retail / categoryTotals.retail : 0,
      office: categoryTotals.office > 0 ? categoryRevenue.office / categoryTotals.office : 0,
    };

    return { unitDetails, categoryTotals, categoryUnits, categoryParking, categoryRevenue, balance, totalParking, totalUnits, totalRevenue, avgPrice };
  }, [counts, areas, prices, SELLABLE]);

  // Auto-adjust function
  const autoAdjust = useCallback((category: "residential" | "retail" | "office") => {
    const available = SELLABLE[category];
    const categoryTypes = UNIT_TYPES.filter(ut => ut.category === category);
    const totalUnits = categoryTypes.reduce((sum, ut) => sum + (counts[ut.key] || 0), 0);
    if (totalUnits === 0) return;
    const currentTotal = categoryTypes.reduce((sum, ut) => sum + (counts[ut.key] || 0) * (areas[ut.key] || ut.defaultArea), 0);
    if (currentTotal === 0) return;
    const ratio = available / currentTotal;
    const newAreas = { ...areas };
    categoryTypes.forEach(ut => {
      if (counts[ut.key] > 0) {
        newAreas[ut.key] = Math.round((areas[ut.key] || ut.defaultArea) * ratio);
      }
    });
    setAreas(newAreas);
  }, [counts, areas, SELLABLE]);

  function getStatus(balance: { waste: number; pct: number; diff: number }) {
    if (balance.pct === 0) return { color: "text-slate-500", bg: "bg-slate-500/20", icon: Info, label: "لم يُحدد" };
    if (balance.pct > 100.5) return { color: "text-red-400", bg: "bg-red-500/20", icon: AlertTriangle, label: "تجاوز!" };
    if (balance.pct >= 99.5) return { color: "text-emerald-400", bg: "bg-emerald-500/20", icon: CheckCircle, label: "متوازن" };
    if (balance.waste <= 5) return { color: "text-amber-400", bg: "bg-amber-500/20", icon: AlertTriangle, label: "هدر بسيط" };
    return { color: "text-red-400", bg: "bg-red-500/20", icon: AlertTriangle, label: "هدر كبير" };
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-6" dir="rtl">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex items-center gap-4 mb-2">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Calculator className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">التسعير وتوزيع الوحدات</h1>
            <p className="text-slate-400 text-sm">{i.name}</p>
          </div>
          <button
            onClick={handleSave}
            disabled={isSaving || !hasUnsavedChanges || !selectedProjectId}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${!selectedProjectId ? 'bg-slate-700 border border-slate-600 text-slate-500 cursor-not-allowed' : isSaving ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300 cursor-wait' : hasUnsavedChanges ? 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/30 animate-pulse' : 'bg-slate-700 border border-slate-600 text-slate-400 cursor-default'}`}
          >
            {isSaving ? (
              <><Loader2 className="w-4 h-4 animate-spin" /><span>جاري الحفظ...</span></>
            ) : hasUnsavedChanges ? (
              <><Save className="w-4 h-4" /><span>💾 حفظ التغييرات</span></>
            ) : (
              <><CheckCircle className="w-4 h-4" /><span>محفوظ ✓</span></>
            )}
          </button>
        </div>
        <div className="mt-4 mb-4">
          <ProjectSelector selectedId={selectedProjectId} onSelect={setSelectedProjectId} className="" />
        </div>
      </div>

      <div className="max-w-7xl mx-auto space-y-6">

        {/* SECTION 1: LAND & AREAS SUMMARY */}
        <Card className="bg-slate-800/50 border-slate-700/50 backdrop-blur">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <Ruler className="w-5 h-5 text-amber-400" />
              تفاصيل الأرض والمساحات
              <Badge className="bg-slate-700/50 text-slate-400 border-slate-600 text-xs mr-2">من بطاقة المشروع</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4 text-center">
                <div className="text-xs text-slate-400 mb-1">مساحة الأرض</div>
                <div className="text-xl font-bold text-blue-300 font-mono">{fmtN(i.landArea)} sqft</div>
              </div>
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center">
                <div className="text-xs text-slate-400 mb-1">BUA</div>
                <div className="text-xl font-bold text-emerald-300 font-mono">{fmtN(i.bua)} sqft</div>
              </div>
              <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-4 text-center">
                <div className="text-xs text-slate-400 mb-1">GFA الإجمالي</div>
                <div className="text-xl font-bold text-purple-300 font-mono">{fmtN(GFA_TOTAL)} sqft</div>
              </div>
            </div>

            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-right py-2 px-3 text-slate-400">الفئة</th>
                  <th className="text-center py-2 px-3 text-slate-400">GFA (sqft)</th>
                  <th className="text-center py-2 px-3 text-slate-400">الكفاءة</th>
                  <th className="text-center py-2 px-3 text-slate-400">قابل للبيع (sqft)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                <tr>
                  <td className="py-2.5 px-3 text-slate-200 flex items-center gap-2"><Home className="w-4 h-4 text-blue-400" /> سكني</td>
                  <td className="py-2.5 px-3 text-center font-mono text-white">{fmtN(i.gfaResidential)}</td>
                  <td className="py-2.5 px-3 text-center"><Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40">{(i.efficiencyResidential * 100).toFixed(0)}%</Badge></td>
                  <td className="py-2.5 px-3 text-center font-mono text-emerald-300 font-bold">{fmtN(SELLABLE.residential)}</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 text-slate-200 flex items-center gap-2"><Store className="w-4 h-4 text-amber-400" /> تجزئة</td>
                  <td className="py-2.5 px-3 text-center font-mono text-white">{fmtN(i.gfaRetail)}</td>
                  <td className="py-2.5 px-3 text-center"><Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40">{(i.efficiencyRetail * 100).toFixed(0)}%</Badge></td>
                  <td className="py-2.5 px-3 text-center font-mono text-emerald-300 font-bold">{fmtN(SELLABLE.retail)}</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 text-slate-200 flex items-center gap-2"><Briefcase className="w-4 h-4 text-purple-400" /> مكاتب</td>
                  <td className="py-2.5 px-3 text-center font-mono text-white">{fmtN(i.gfaOffice)}</td>
                  <td className="py-2.5 px-3 text-center"><Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40">{(i.efficiencyOffice * 100).toFixed(0)}%</Badge></td>
                  <td className="py-2.5 px-3 text-center font-mono text-emerald-300 font-bold">{fmtN(SELLABLE.office)}</td>
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* SECTION 2: RESIDENTIAL */}
        {SELLABLE.residential > 0 && (
          <CategorySection
            title="الوحدات السكنية"
            icon={<Home className="w-5 h-5 text-blue-400" />}
            category="residential"
            unitTypes={UNIT_TYPES.filter(ut => ut.category === "residential")}
            counts={counts}
            areas={areas}
            prices={prices}
            balance={calc.balance.residential}
            parking={calc.categoryParking.residential}
            revenue={calc.categoryRevenue.residential}
            avgPrice={calc.avgPrice.residential}
            totalUnits={calc.categoryUnits.residential}
            onCountChange={updateCount}
            onAreaChange={updateArea}
            onPriceChange={updatePrice}
            onAutoAdjust={() => autoAdjust("residential")}
            getStatus={getStatus}
          />
        )}

        {/* SECTION 3: RETAIL */}
        {SELLABLE.retail > 0 && (
          <CategorySection
            title="المحلات التجارية"
            icon={<Store className="w-5 h-5 text-amber-400" />}
            category="retail"
            unitTypes={UNIT_TYPES.filter(ut => ut.category === "retail")}
            counts={counts}
            areas={areas}
            prices={prices}
            balance={calc.balance.retail}
            parking={calc.categoryParking.retail}
            revenue={calc.categoryRevenue.retail}
            avgPrice={calc.avgPrice.retail}
            totalUnits={calc.categoryUnits.retail}
            onCountChange={updateCount}
            onAreaChange={updateArea}
            onPriceChange={updatePrice}
            onAutoAdjust={() => autoAdjust("retail")}
            getStatus={getStatus}
          />
        )}

        {/* SECTION 4: OFFICE */}
        {SELLABLE.office > 0 && (
          <CategorySection
            title="المكاتب"
            icon={<Briefcase className="w-5 h-5 text-purple-400" />}
            category="office"
            unitTypes={UNIT_TYPES.filter(ut => ut.category === "office")}
            counts={counts}
            areas={areas}
            prices={prices}
            balance={calc.balance.office}
            parking={calc.categoryParking.office}
            revenue={calc.categoryRevenue.office}
            avgPrice={calc.avgPrice.office}
            totalUnits={calc.categoryUnits.office}
            onCountChange={updateCount}
            onAreaChange={updateArea}
            onPriceChange={updatePrice}
            onAutoAdjust={() => autoAdjust("office")}
            getStatus={getStatus}
          />
        )}

        {/* SECTION 5: PARKING SUMMARY */}
        <Card className="bg-slate-800/50 border-slate-700/50 backdrop-blur">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <Car className="w-5 h-5 text-cyan-400" />
              ملخص المواقف المطلوبة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4 text-center">
                <div className="text-xs text-slate-400 mb-1">سكني</div>
                <div className="text-2xl font-bold text-blue-300 font-mono">{fmtN(calc.categoryParking.residential)}</div>
                <div className="text-xs text-slate-500 mt-1">موقف</div>
              </div>
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-center">
                <div className="text-xs text-slate-400 mb-1">تجزئة</div>
                <div className="text-2xl font-bold text-amber-300 font-mono">{fmtN(calc.categoryParking.retail)}</div>
                <div className="text-xs text-slate-500 mt-1">موقف</div>
              </div>
              <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-4 text-center">
                <div className="text-xs text-slate-400 mb-1">مكاتب</div>
                <div className="text-2xl font-bold text-purple-300 font-mono">{fmtN(calc.categoryParking.office)}</div>
                <div className="text-xs text-slate-500 mt-1">موقف</div>
              </div>
              <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-4 text-center">
                <div className="text-xs text-slate-400 mb-1">الإجمالي</div>
                <div className="text-2xl font-bold text-cyan-300 font-mono">{fmtN(calc.totalParking)}</div>
                <div className="text-xs text-slate-500 mt-1">موقف</div>
              </div>
            </div>
            <div className="mt-4 p-3 rounded-lg bg-slate-700/30 border border-slate-600/30">
              <p className="text-xs text-slate-400">
                <strong className="text-slate-300">قاعدة الحساب:</strong> سكني أقل من 1,500 قدم = 1 موقف | سكني 1,500+ قدم = 2 موقف | تجزئة ومكاتب = 1 موقف لكل 500 قدم
              </p>
            </div>
          </CardContent>
        </Card>

        {/* SECTION 6: REVENUE SUMMARY */}
        <Card className="bg-gradient-to-br from-slate-800/80 to-emerald-900/30 border-emerald-700/30 backdrop-blur">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
              ملخص الإيرادات المتوقعة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4 text-center">
                <div className="text-xs text-slate-400 mb-1">إيراد السكني</div>
                <div className="text-xl font-bold text-blue-300 font-mono">{fmtN(calc.categoryRevenue.residential)}</div>
                <div className="text-xs text-slate-500 mt-1">درهم</div>
                {calc.avgPrice.residential > 0 && (
                  <div className="text-xs text-blue-400 mt-1">متوسط: {fmtN(calc.avgPrice.residential)} د/قدم</div>
                )}
              </div>
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-center">
                <div className="text-xs text-slate-400 mb-1">إيراد التجزئة</div>
                <div className="text-xl font-bold text-amber-300 font-mono">{fmtN(calc.categoryRevenue.retail)}</div>
                <div className="text-xs text-slate-500 mt-1">درهم</div>
                {calc.avgPrice.retail > 0 && (
                  <div className="text-xs text-amber-400 mt-1">متوسط: {fmtN(calc.avgPrice.retail)} د/قدم</div>
                )}
              </div>
              <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-4 text-center">
                <div className="text-xs text-slate-400 mb-1">إيراد المكاتب</div>
                <div className="text-xl font-bold text-purple-300 font-mono">{fmtN(calc.categoryRevenue.office)}</div>
                <div className="text-xs text-slate-500 mt-1">درهم</div>
                {calc.avgPrice.office > 0 && (
                  <div className="text-xs text-purple-400 mt-1">متوسط: {fmtN(calc.avgPrice.office)} د/قدم</div>
                )}
              </div>
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center">
                <div className="text-xs text-slate-400 mb-1">إجمالي الإيرادات</div>
                <div className="text-2xl font-bold text-emerald-300 font-mono">{fmtN(calc.totalRevenue)}</div>
                <div className="text-xs text-slate-500 mt-1">درهم</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* SECTION 7: TOTAL SUMMARY */}
        <Card className="bg-slate-800/50 border-slate-700/50 backdrop-blur">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <Building2 className="w-5 h-5 text-emerald-400" />
              ملخص إجمالي
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center">
                <div className="text-xs text-slate-400 mb-1">إجمالي الوحدات</div>
                <div className="text-2xl font-bold text-emerald-300 font-mono">{fmtN(calc.totalUnits)}</div>
                <div className="text-xs text-slate-500 mt-1">وحدة</div>
              </div>
              <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-4 text-center">
                <div className="text-xs text-slate-400 mb-1">إجمالي المواقف</div>
                <div className="text-2xl font-bold text-cyan-300 font-mono">{fmtN(calc.totalParking)}</div>
                <div className="text-xs text-slate-500 mt-1">موقف</div>
              </div>
              <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-4 text-center">
                <div className="text-xs text-slate-400 mb-1">إجمالي المساحة القابلة</div>
                <div className="text-2xl font-bold text-indigo-300 font-mono">{fmtN(SELLABLE.residential + SELLABLE.retail + SELLABLE.office)}</div>
                <div className="text-xs text-slate-500 mt-1">قدم²</div>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// CATEGORY SECTION COMPONENT
// ═══════════════════════════════════════════
function CategorySection({
  title, icon, category, unitTypes, counts, areas, prices, balance, parking, revenue, avgPrice, totalUnits,
  onCountChange, onAreaChange, onPriceChange, onAutoAdjust, getStatus,
}: {
  title: string;
  icon: React.ReactNode;
  category: string;
  unitTypes: UnitType[];
  counts: Record<string, number>;
  areas: Record<string, number>;
  prices: Record<string, number>;
  balance: { used: number; available: number; diff: number; pct: number; waste: number };
  parking: number;
  revenue: number;
  avgPrice: number;
  totalUnits: number;
  onCountChange: (key: string, val: number) => void;
  onAreaChange: (key: string, val: number) => void;
  onPriceChange: (key: string, val: number) => void;
  onAutoAdjust: () => void;
  getStatus: (b: { waste: number; pct: number; diff: number }) => { color: string; bg: string; icon: any; label: string };
}) {
  const status = getStatus(balance);
  const StatusIcon = status.icon;

  return (
    <Card className="bg-slate-800/50 border-slate-700/50 backdrop-blur">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg text-white flex items-center gap-2">
            {icon}
            {title}
            <Badge className="text-xs mr-2" variant="outline">
              {totalUnits} وحدة
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-3">
            {revenue > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20">
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-xs font-medium text-emerald-300 font-mono">{fmtN(revenue)} د</span>
              </div>
            )}
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${status.bg}`}>
              <StatusIcon className={`w-4 h-4 ${status.color}`} />
              <span className={`text-xs font-medium ${status.color}`}>{status.label}</span>
            </div>
            {balance.pct > 0 && balance.waste > 0.5 && (
              <button
                onClick={onAutoAdjust}
                className="px-3 py-1.5 rounded-lg bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 text-xs hover:bg-indigo-500/30 transition-colors"
              >
                ضبط تلقائي
              </button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Balance bar */}
        <div className="mb-4 p-3 rounded-lg bg-slate-700/30 border border-slate-600/30">
          <div className="flex justify-between text-xs text-slate-400 mb-2">
            <span>المستخدم: {fmtN(balance.used)} قدم²</span>
            <span>المتاح: {fmtN(balance.available)} قدم²</span>
            <span>الفرق: {fmtN(Math.abs(balance.diff))} قدم² {balance.diff >= 0 ? "(متبقي)" : "(تجاوز)"}</span>
          </div>
          <div className="w-full h-3 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                balance.pct > 100 ? "bg-red-500" :
                balance.waste <= 0.5 ? "bg-emerald-500" :
                balance.waste <= 5 ? "bg-amber-500" : "bg-orange-500"
              }`}
              style={{ width: `${Math.min(balance.pct, 100)}%` }}
            />
          </div>
          <div className="text-center mt-1">
            <span className={`text-xs font-mono ${status.color}`}>{balance.pct.toFixed(1)}%</span>
          </div>
        </div>

        {/* Unit table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-right py-2 px-2 text-slate-400">النوع</th>
                <th className="text-center py-2 px-2 text-slate-400">العدد</th>
                <th className="text-center py-2 px-2 text-slate-400">المساحة</th>
                <th className="text-center py-2 px-2 text-slate-400">سعر/قدم</th>
                <th className="text-center py-2 px-2 text-slate-400">إجمالي المساحة</th>
                <th className="text-center py-2 px-2 text-slate-400">سعر الوحدة</th>
                <th className="text-center py-2 px-2 text-slate-400">الإيراد</th>
                <th className="text-center py-2 px-2 text-slate-400">المواقف</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {unitTypes.map(ut => {
                const count = counts[ut.key] || 0;
                const area = areas[ut.key] || ut.defaultArea;
                const price = prices[ut.key] || ut.defaultPrice;
                const total = count * area;
                const unitPrice = area * price;
                const rev = count * area * price;
                const unitParking = calcParking(category === "residential" ? "res" : category, area, count);
                return (
                  <tr key={ut.key}>
                    <td className="py-2.5 px-2 text-slate-200">{ut.label}</td>
                    <td className="py-2.5 px-2 text-center">
                      <input
                        type="number"
                        min={0}
                        value={count}
                        onChange={e => onCountChange(ut.key, parseInt(e.target.value) || 0)}
                        className="w-14 bg-slate-700/50 border border-slate-600 rounded px-1.5 py-1 text-center text-white text-sm focus:border-indigo-500 focus:outline-none"
                      />
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      <input
                        type="number"
                        min={0}
                        value={area}
                        onChange={e => onAreaChange(ut.key, parseInt(e.target.value) || 0)}
                        className="w-16 bg-slate-700/50 border border-slate-600 rounded px-1.5 py-1 text-center text-white text-sm focus:border-indigo-500 focus:outline-none"
                      />
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      <input
                        type="number"
                        min={0}
                        value={price}
                        onChange={e => onPriceChange(ut.key, parseInt(e.target.value) || 0)}
                        className="w-16 bg-amber-900/30 border border-amber-600/50 rounded px-1.5 py-1 text-center text-amber-200 text-sm focus:border-amber-400 focus:outline-none"
                      />
                    </td>
                    <td className="py-2.5 px-2 text-center font-mono text-white text-xs">{count > 0 ? fmtN(total) : "—"}</td>
                    <td className="py-2.5 px-2 text-center font-mono text-slate-300 text-xs">{count > 0 ? fmtN(unitPrice) : "—"}</td>
                    <td className="py-2.5 px-2 text-center font-mono text-emerald-300 text-xs font-bold">{count > 0 ? fmtN(rev) : "—"}</td>
                    <td className="py-2.5 px-2 text-center font-mono text-cyan-300 text-xs">{count > 0 ? unitParking : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-600 bg-slate-700/20">
                <td className="py-2.5 px-2 text-white font-bold">الإجمالي</td>
                <td className="py-2.5 px-2 text-center font-mono text-white font-bold">{totalUnits}</td>
                <td className="py-2.5 px-2 text-center text-slate-500">—</td>
                <td className="py-2.5 px-2 text-center text-xs text-amber-300">{avgPrice > 0 ? `${fmtN(avgPrice)} متوسط` : "—"}</td>
                <td className="py-2.5 px-2 text-center font-mono text-white font-bold text-xs">{fmtN(balance.used)}</td>
                <td className="py-2.5 px-2 text-center text-slate-500">—</td>
                <td className="py-2.5 px-2 text-center font-mono text-emerald-300 font-bold text-xs">{fmtN(revenue)}</td>
                <td className="py-2.5 px-2 text-center font-mono text-cyan-300 font-bold">{parking}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
