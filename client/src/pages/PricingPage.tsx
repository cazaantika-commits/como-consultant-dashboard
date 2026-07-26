import { useProjectContext } from "@/contexts/ProjectContext";
import { useMemo, useState, useCallback, useEffect } from "react";
import { ProjectSelector } from "@/components/ProjectSelector";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { PROJECT_INPUTS, RATES, dbProjectToInputs, dbProjectToRates } from "@/lib/projectData";
import { useToast } from "@/hooks/use-toast";
import { Save, Loader2, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";

function calcParking(type: string, area: number, count: number): number {
  if (type.startsWith("res")) return count * (area < 1500 ? 1 : 2);
  return count * Math.ceil(area / 500);
}

interface UnitType {
  key: string;
  label: string;
  category: "residential" | "retail" | "office";
  defaultArea: number;
}

const UNIT_TYPES: UnitType[] = [
  { key: "onebed", label: "غرفة وصالة", category: "residential", defaultArea: 750 },
  { key: "twobed", label: "غرفتين وصالة", category: "residential", defaultArea: 1300 },
  { key: "threebed", label: "ثلاث غرف وصالة", category: "residential", defaultArea: 1650 },
  { key: "retail_small", label: "محل صغير", category: "retail", defaultArea: 850 },
  { key: "retail_medium", label: "محل متوسط", category: "retail", defaultArea: 1200 },
  { key: "retail_large", label: "محل كبير", category: "retail", defaultArea: 1800 },
  { key: "office_small", label: "مكتب صغير", category: "office", defaultArea: 1200 },
  { key: "office_medium", label: "مكتب متوسط", category: "office", defaultArea: 2000 },
  { key: "office_large", label: "مكتب كبير", category: "office", defaultArea: 3500 },
];

const COUNT_MAP: Record<string, string> = {
  onebed: 'residential1brCount', twobed: 'residential2brCount', threebed: 'residential3brCount',
  retail_small: 'retailSmallCount', retail_medium: 'retailMediumCount', retail_large: 'retailLargeCount',
  office_small: 'officeSmallCount', office_medium: 'officeMediumCount', office_large: 'officeLargeCount',
};
const AREA_MAP: Record<string, string> = {
  onebed: 'residential1brArea', twobed: 'residential2brArea', threebed: 'residential3brArea',
  retail_small: 'retailSmallArea', retail_medium: 'retailMediumArea', retail_large: 'retailLargeArea',
  office_small: 'officeSmallArea', office_medium: 'officeMediumArea', office_large: 'officeLargeArea',
};
const PRICE_MAP: Record<string, string> = {
  onebed: 'residential1brPrice', twobed: 'residential2brPrice', threebed: 'residential3brPrice',
  retail_small: 'retailSmallPrice', retail_medium: 'retailMediumPrice', retail_large: 'retailLargePrice',
  office_small: 'officeSmallPrice', office_medium: 'officeMediumPrice', office_large: 'officeLargePrice',
};
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

function fmt(n: number): string { return Math.round(n).toLocaleString("en-US"); }

export default function PricingPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { selectedProjectId, setSelectedProjectId } = useProjectContext();
  const projectQuery = trpc.projects.getById.useQuery(selectedProjectId!, { enabled: !!selectedProjectId && !!user });
  const updateProject = trpc.projects.update.useMutation();
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const i = useMemo(() => {
    if (projectQuery.data) return dbProjectToInputs(projectQuery.data);
    return PROJECT_INPUTS;
  }, [projectQuery.data]);

  const SELLABLE = useMemo(() => ({
    residential: i.gfaResidential * i.efficiencyResidential,
    retail: i.gfaRetail * i.efficiencyRetail,
    office: i.gfaOffice * i.efficiencyOffice,
  }), [i]);

  const [counts, setCounts] = useState<Record<string, number>>({
    onebed: 0, twobed: 0, threebed: 0,
    retail_small: 0, retail_medium: 0, retail_large: 0,
    office_small: 0, office_medium: 0, office_large: 0,
  });
  const [areas, setAreas] = useState<Record<string, number>>({ ...DEFAULT_AREAS });
  const [prices, setPrices] = useState<Record<string, number>>({ ...DEFAULT_PRICES });

  useEffect(() => {
    if (!selectedProjectId || projectQuery.isLoading || !projectQuery.data) return;
    const p = projectQuery.data as any;
    const hasSavedCounts = Object.values(COUNT_MAP).some(f => Number(p[f]) > 0);
    if (hasSavedCounts) {
      const nc: Record<string, number> = {};
      const na: Record<string, number> = { ...DEFAULT_AREAS };
      const np: Record<string, number> = { ...DEFAULT_PRICES };
      Object.entries(COUNT_MAP).forEach(([k, f]) => { nc[k] = Number(p[f]) || 0; });
      Object.entries(AREA_MAP).forEach(([k, f]) => { const v = Number(p[f]); if (v > 0) na[k] = v; });
      Object.entries(PRICE_MAP).forEach(([k, f]) => { const v = Number(p[f]); if (v > 0) np[k] = v; });
      setCounts(nc); setAreas(na); setPrices(np); setHasUnsavedChanges(false);
    } else {
      const sr = i.gfaResidential * i.efficiencyResidential;
      const srt = i.gfaRetail * i.efficiencyRetail;
      const so = i.gfaOffice * i.efficiencyOffice;
      const sc: Record<string, number> = { onebed: 0, twobed: 0, threebed: 0, retail_small: 0, retail_medium: 0, retail_large: 0, office_small: 0, office_medium: 0, office_large: 0 };
      if (sr > 0) { sc.onebed = Math.round(sr * 0.4 / 750); sc.twobed = Math.round(sr * 0.4 / 1300); sc.threebed = Math.round(sr * 0.2 / 1650); }
      if (srt > 0) { sc.retail_small = Math.round(srt * 0.4 / 850); sc.retail_medium = Math.round(srt * 0.4 / 1200); sc.retail_large = Math.round(srt * 0.2 / 1800); }
      if (so > 0) { sc.office_small = Math.round(so * 0.4 / 1200); sc.office_medium = Math.round(so * 0.4 / 2000); sc.office_large = Math.round(so * 0.2 / 3500); }
      setCounts(sc); setAreas({ ...DEFAULT_AREAS }); setPrices({ ...DEFAULT_PRICES }); setHasUnsavedChanges(true);
    }
  }, [selectedProjectId, projectQuery.data, projectQuery.isLoading, i]);

  const updateCount = useCallback((key: string, val: number) => {
    if (!isEditing) return;
    setCounts(p => ({ ...p, [key]: Math.max(0, val) }));
    setHasUnsavedChanges(true);
  }, [isEditing]);

  const updateArea = useCallback((key: string, val: number) => {
    if (!isEditing) return;
    setAreas(p => ({ ...p, [key]: Math.max(0, val) }));
    setHasUnsavedChanges(true);
  }, [isEditing]);

  const handleSave = useCallback(async () => {
    if (!selectedProjectId || !user) return;
    setIsSaving(true);
    try {
      const d: any = { id: selectedProjectId };
      Object.entries(COUNT_MAP).forEach(([k, f]) => { d[f] = String(counts[k] || 0); });
      Object.entries(AREA_MAP).forEach(([k, f]) => { d[f] = String(areas[k] || 0); });
      Object.entries(PRICE_MAP).forEach(([k, f]) => { d[f] = String(prices[k] || 0); });
      await updateProject.mutateAsync(d);
      setHasUnsavedChanges(false);
      setIsEditing(false);
      toast({ title: "تم الحفظ ✓" });
      projectQuery.refetch();
    } catch { toast({ title: "خطأ", variant: "destructive" }); }
    finally { setIsSaving(false); }
  }, [selectedProjectId, user, counts, areas, prices, updateProject, toast, projectQuery]);

  const calc = useMemo(() => {
    const r: Record<string, { used: number; available: number; diff: number; units: number; parking: number }> = {};
    (["residential", "retail", "office"] as const).forEach(cat => {
      let used = 0, units = 0, parking = 0;
      UNIT_TYPES.filter(ut => ut.category === cat).forEach(ut => {
        const c = counts[ut.key] || 0, a = areas[ut.key] || ut.defaultArea;
        used += c * a; units += c;
        parking += calcParking(cat === "residential" ? "res" : cat, a, c);
      });
      r[cat] = { used, available: SELLABLE[cat], diff: SELLABLE[cat] - used, units, parking };
    });
    return r;
  }, [counts, areas, SELLABLE]);

  const totalUnits = (calc.residential?.units || 0) + (calc.retail?.units || 0) + (calc.office?.units || 0);
  const totalParking = (calc.residential?.parking || 0) + (calc.retail?.parking || 0) + (calc.office?.parking || 0);
  const totalUsed = (calc.residential?.used || 0) + (calc.retail?.used || 0) + (calc.office?.used || 0);

  if (!selectedProjectId) {
    return (<div className="p-4 text-center text-sm text-gray-500" dir="rtl"><ProjectSelector selectedId={selectedProjectId} onSelect={setSelectedProjectId} /><p className="mt-2">اختر مشروعاً</p></div>);
  }
  if (projectQuery.isLoading) {
    return <div className="p-4 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>;
  }

  const renderCategory = (cat: "residential" | "retail" | "office", label: string) => {
    const c = calc[cat];
    return (
      <>
        <tr className="border-t-2 border-gray-300 bg-gray-50">
          <td className="py-2 px-3 font-bold text-sm text-gray-800">{label}</td>
          <td className="py-2 px-3 text-center text-sm text-gray-500">{c?.units || 0}</td>
          <td className="py-2 px-3 text-center text-sm text-gray-500">—</td>
          <td className="py-2 px-3 text-center text-sm font-medium text-gray-700" dir="ltr">{fmt(c?.used || 0)}</td>
          <td className="py-2 px-3 text-center text-sm text-gray-500" dir="ltr">{fmt(c?.available || 0)}</td>
          <td className="py-2 px-3 text-center text-sm font-medium" dir="ltr" style={{ color: (c?.diff || 0) >= 0 ? '#059669' : '#dc2626' }}>{fmt(c?.diff || 0)}</td>
          <td className="py-2 px-3 text-center text-sm text-gray-500">{c?.parking || 0}</td>
        </tr>
        {UNIT_TYPES.filter(ut => ut.category === cat).map((ut) => (
          <tr key={ut.key} className="border-b border-gray-100 hover:bg-gray-50/50">
            <td className="py-2 px-3 text-sm text-gray-600 pr-8">{ut.label}</td>
            <td className="py-2 px-3 text-center">
              <input type="number" min={0} value={counts[ut.key] || 0} onChange={e => updateCount(ut.key, parseInt(e.target.value) || 0)}
                disabled={!isEditing}
                className={`w-16 h-7 text-sm text-center rounded ${!isEditing ? "bg-transparent border-none text-gray-800 font-medium" : "bg-white border border-gray-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"}`} />
            </td>
            <td className="py-2 px-3 text-center">
              <input type="number" min={0} value={areas[ut.key] || ut.defaultArea} onChange={e => updateArea(ut.key, parseInt(e.target.value) || 0)}
                disabled={!isEditing}
                className={`w-20 h-7 text-sm text-center rounded ${!isEditing ? "bg-transparent border-none text-gray-800 font-medium" : "bg-white border border-gray-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"}`} />
            </td>
            <td className="py-2 px-3 text-center text-sm text-gray-700 font-medium" dir="ltr">{(counts[ut.key] || 0) > 0 ? fmt((counts[ut.key] || 0) * (areas[ut.key] || ut.defaultArea)) : "—"}</td>
            <td className="py-2 px-3 text-center text-sm text-gray-400">—</td>
            <td className="py-2 px-3 text-center text-sm text-gray-400">—</td>
            <td className="py-2 px-3 text-center text-sm text-gray-600">{(counts[ut.key] || 0) > 0 ? calcParking(cat === "residential" ? "res" : cat, areas[ut.key] || ut.defaultArea, counts[ut.key] || 0) : "—"}</td>
          </tr>
        ))}
      </>
    );
  };

  return (
    <div className="bg-white p-4" dir="rtl">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <ProjectSelector selectedId={selectedProjectId} onSelect={setSelectedProjectId} />
          {!isEditing ? (
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} className="h-8 text-sm px-3 gap-1.5 rounded-md">
              <Pencil className="w-3.5 h-3.5" /> تعديل
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => { setIsEditing(false); setHasUnsavedChanges(false); projectQuery.refetch(); }} className="h-8 text-sm px-3 gap-1.5">
                <X className="w-3.5 h-3.5" /> إلغاء
              </Button>
              <Button size="sm" onClick={handleSave} disabled={!hasUnsavedChanges || isSaving} className="h-8 text-sm px-4 gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-md">
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} حفظ
              </Button>
            </div>
          )}
        </div>
        <div className="text-sm text-gray-500">{totalUnits} وحدة | {totalParking} موقف</div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="rounded-lg border border-gray-200 p-3 text-center">
          <div className="text-sm text-gray-500">إجمالي الوحدات</div>
          <div className="text-lg font-bold text-gray-800 mt-1">{totalUnits}</div>
        </div>
        <div className="rounded-lg border border-gray-200 p-3 text-center">
          <div className="text-sm text-gray-500">المساحة المستخدمة</div>
          <div className="text-lg font-bold text-gray-800 mt-1" dir="ltr">{fmt(totalUsed)}</div>
        </div>
        <div className="rounded-lg border border-gray-200 p-3 text-center">
          <div className="text-sm text-gray-500">المواقف المطلوبة</div>
          <div className="text-lg font-bold text-gray-800 mt-1">{totalParking}</div>
        </div>
      </div>

      {/* Table */}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2 border-gray-300 bg-gray-50">
            <th className="py-2 px-3 text-right text-sm text-gray-600 font-medium">النوع</th>
            <th className="py-2 px-3 text-center text-sm text-gray-600 font-medium w-20">العدد</th>
            <th className="py-2 px-3 text-center text-sm text-gray-600 font-medium w-24">المساحة/وحدة</th>
            <th className="py-2 px-3 text-center text-sm text-gray-600 font-medium">إجمالي المساحة</th>
            <th className="py-2 px-3 text-center text-sm text-gray-600 font-medium">المتاح</th>
            <th className="py-2 px-3 text-center text-sm text-gray-600 font-medium">الفرق</th>
            <th className="py-2 px-3 text-center text-sm text-gray-600 font-medium w-16">مواقف</th>
          </tr>
        </thead>
        <tbody>
          {renderCategory("residential", "الوحدات السكنية")}
          {renderCategory("retail", "التجزئة")}
          {renderCategory("office", "المكاتب")}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-gray-400 bg-gray-100 font-bold">
            <td className="py-2 px-3 text-sm">الإجمالي</td>
            <td className="py-2 px-3 text-center text-sm">{totalUnits}</td>
            <td className="py-2 px-3 text-center text-sm">—</td>
            <td className="py-2 px-3 text-center text-sm" dir="ltr">{fmt(totalUsed)}</td>
            <td className="py-2 px-3 text-center text-sm" dir="ltr">{fmt(SELLABLE.residential + SELLABLE.retail + SELLABLE.office)}</td>
            <td className="py-2 px-3 text-center text-sm" dir="ltr" style={{ color: (SELLABLE.residential + SELLABLE.retail + SELLABLE.office - totalUsed) >= 0 ? '#059669' : '#dc2626' }}>{fmt(SELLABLE.residential + SELLABLE.retail + SELLABLE.office - totalUsed)}</td>
            <td className="py-2 px-3 text-center text-sm">{totalParking}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
