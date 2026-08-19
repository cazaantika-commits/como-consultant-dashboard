
import { useMemo, useState, useCallback, useEffect } from "react";
import { useProjectContext } from "@/contexts/ProjectContext";
import { ProjectSelector } from "@/components/ProjectSelector";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { PROJECT_INPUTS, RATES, dbProjectToInputs, dbProjectToRates } from "@/lib/projectData";
import { useToast } from "@/hooks/use-toast";
import { Save, Loader2 } from "lucide-react";
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
  { key: "villa", label: "فيلا", category: "residential", defaultArea: 0 },
  { key: "townhouse", label: "تاون هاوس", category: "residential", defaultArea: 0 },
  { key: "retail_small", label: "محل صغير", category: "retail", defaultArea: 850 },
  { key: "retail_medium", label: "محل متوسط", category: "retail", defaultArea: 1200 },
  { key: "retail_large", label: "محل كبير", category: "retail", defaultArea: 1800 },
  { key: "office_small", label: "مكتب صغير", category: "office", defaultArea: 1200 },
  { key: "office_medium", label: "مكتب متوسط", category: "office", defaultArea: 1200 },
  { key: "office_large", label: "مكتب كبير", category: "office", defaultArea: 3500 },
];

const DEFAULT_AREAS: Record<string, number> = {
  onebed: 750, twobed: 1300, threebed: 1650,
  villa: 0, townhouse: 0,
  retail_small: 850, retail_medium: 1200, retail_large: 1800,
  office_small: 1200, office_medium: 2000, office_large: 3500,
};

const COUNT_MAP: Record<string, string> = {
  onebed: 'residential1brCount', twobed: 'residential2brCount', threebed: 'residential3brCount',
  villa: 'villaCount', townhouse: 'townhouseCount',
  retail_small: 'retailSmallCount', retail_medium: 'retailMediumCount', retail_large: 'retailLargeCount',
  office_small: 'officeSmallCount', office_medium: 'officeMediumCount', office_large: 'officeLargeCount',
};

const AREA_MAP: Record<string, string> = {
  onebed: 'residential1brArea', twobed: 'residential2brArea', threebed: 'residential3brArea',
  villa: 'villaArea', townhouse: 'townhouseArea',
  retail_small: 'retailSmallArea', retail_medium: 'retailMediumArea', retail_large: 'retailLargeArea',
  office_small: 'officeSmallArea', office_medium: 'officeMediumArea', office_large: 'officeLargeArea',
};

function fmt(n: number): string { return Math.round(n).toLocaleString("en-US"); }

export default function PricingPage({ embedded }: { embedded?: boolean } = {}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { selectedProjectId, setSelectedProjectId } = useProjectContext();
  const projectQuery = trpc.projects.getById.useQuery(selectedProjectId!, { enabled: !!selectedProjectId && !!user });
  const updateProject = trpc.projects.update.useMutation();
  const [isSaving, setIsSaving] = useState(false);
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
    villa: 0, townhouse: 0,
    retail_small: 0, retail_medium: 0, retail_large: 0,
    office_small: 0, office_medium: 0, office_large: 0,
  });
  const [areas, setAreas] = useState<Record<string, number>>({ ...DEFAULT_AREAS });

  useEffect(() => {
    if (!selectedProjectId || projectQuery.isLoading || !projectQuery.data) return;
    const p = projectQuery.data as any;
    const hasSavedCounts = Object.values(COUNT_MAP).some(f => Number(p[f]) > 0);
    if (hasSavedCounts) {
      const nc: Record<string, number> = {};
      const na: Record<string, number> = { ...DEFAULT_AREAS };
      Object.entries(COUNT_MAP).forEach(([k, f]) => { nc[k] = Number(p[f]) || 0; });
      Object.entries(AREA_MAP).forEach(([k, f]) => { const v = Number(p[f]); if (v > 0) na[k] = v; });
      setCounts(nc); setAreas(na); setHasUnsavedChanges(false);
    } else {
      const sr = i.gfaResidential * i.efficiencyResidential;
      const srt = i.gfaRetail * i.efficiencyRetail;
      const so = i.gfaOffice * i.efficiencyOffice;
      const sc: Record<string, number> = { onebed: 0, twobed: 0, threebed: 0, villa: 0, townhouse: 0, retail_small: 0, retail_medium: 0, retail_large: 0, office_small: 0, office_medium: 0, office_large: 0 };
      if (sr > 0) { sc.onebed = Math.round(sr * 0.4 / 750); sc.twobed = Math.round(sr * 0.4 / 1300); sc.threebed = Math.round(sr * 0.2 / 1650); }
      if (srt > 0) { sc.retail_small = Math.round(srt * 0.4 / 850); sc.retail_medium = Math.round(srt * 0.4 / 1200); sc.retail_large = Math.round(srt * 0.2 / 1800); }
      if (so > 0) { sc.office_small = Math.round(so * 0.4 / 1200); sc.office_medium = Math.round(so * 0.4 / 2000); sc.office_large = Math.round(so * 0.2 / 3500); }
      setCounts(sc); setAreas({ ...DEFAULT_AREAS }); setHasUnsavedChanges(true);
    }
  }, [selectedProjectId, projectQuery.data, projectQuery.isLoading, i]);

  const updateCount = useCallback((key: string, val: number) => { setCounts(p => ({ ...p, [key]: Math.max(0, val) })); setHasUnsavedChanges(true); }, []);
  const updateArea = useCallback((key: string, val: number) => { setAreas(p => ({ ...p, [key]: Math.max(0, val) })); setHasUnsavedChanges(true); }, []);

  const handleSave = useCallback(async () => {
    if (!selectedProjectId || !user) return;
    setIsSaving(true);
    try {
      const d: any = { id: selectedProjectId };
      Object.entries(COUNT_MAP).forEach(([k, f]) => { d[f] = String(counts[k] || 0); });
      Object.entries(AREA_MAP).forEach(([k, f]) => { d[f] = String(areas[k] || 0); });
      await updateProject.mutateAsync(d);
      setHasUnsavedChanges(false);
      toast({ title: "تم الحفظ ✓" });
      projectQuery.refetch();
    } catch { toast({ title: "خطأ", variant: "destructive" }); }
    finally { setIsSaving(false); }
  }, [selectedProjectId, user, counts, areas, updateProject, toast, projectQuery]);

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

  if (!selectedProjectId) {
    return (<div className="p-2 text-center text-xs text-gray-400" dir="rtl">{!embedded && <ProjectSelector selectedId={selectedProjectId} onSelect={setSelectedProjectId} />}<p className="mt-1">اختر مشروعاً من دليل الدراسات</p></div>);
  }
  if (projectQuery.isLoading) {
    return <div className="p-2 text-center"><Loader2 className="w-4 h-4 animate-spin mx-auto" /></div>;
  }

  const renderCategory = (cat: "residential" | "retail" | "office", label: string) => {
    const c = calc[cat];
    return (
      <>
        <tr className={`border-t ${cat === 'residential' ? 'bg-blue-50/60 border-blue-100' : cat === 'retail' ? 'bg-orange-50/60 border-orange-100' : 'bg-teal-50/60 border-teal-100'}`}>
          <td colSpan={3} className={`py-[3px] px-2 font-bold text-[11px] ${cat === 'residential' ? 'text-blue-700' : cat === 'retail' ? 'text-orange-700' : 'text-teal-700'}`}>{label}</td>
          <td className="py-[3px] px-2 text-center text-[10px] text-gray-500">متاح: {fmt(c?.available || 0)} | فرق: <span className={(c?.diff || 0) < 0 ? "text-red-600" : "text-teal-600"}>{fmt(c?.diff || 0)}</span></td>
          <td className="py-[3px] px-2 text-center text-[10px] text-gray-500">{c?.parking || 0}</td>
        </tr>
        {UNIT_TYPES.filter(ut => ut.category === cat).map((ut, idx) => (
          <tr key={ut.key} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"}>
            <td className="py-[2px] px-2 text-[11px] text-gray-700">{ut.label}</td>
            <td className="py-[2px] px-2 text-center">
              <input type="number" min={0} value={counts[ut.key] || 0} onChange={e => updateCount(ut.key, parseInt(e.target.value) || 0)}
                className="w-14 h-[20px] text-[11px] text-center border border-gray-200 rounded bg-white focus:border-teal-500 focus:outline-none" />
            </td>
            <td className="py-[2px] px-2 text-center">
              <input type="number" min={0} value={areas[ut.key] ?? ut.defaultArea} onChange={e => updateArea(ut.key, parseInt(e.target.value) || 0)}
                className="w-16 h-[20px] text-[11px] text-center border border-gray-200 rounded bg-white focus:border-teal-500 focus:outline-none" />
            </td>
            <td className="py-[2px] px-2 text-center text-[11px] text-gray-600 tabular-nums">{(counts[ut.key] || 0) > 0 ? fmt((counts[ut.key] || 0) * (areas[ut.key] ?? ut.defaultArea)) : "—"}</td>
            <td className="py-[2px] px-2 text-center text-[11px] text-gray-600 tabular-nums">{(counts[ut.key] || 0) > 0 ? calcParking(cat === "residential" ? "res" : cat, areas[ut.key] || ut.defaultArea, counts[ut.key] || 0) : "—"}</td>
          </tr>
        ))}
      </>
    );
  };

  return (
    <div className="bg-gray-50 px-4 py-2" dir="rtl">
      {/* Toolbar */}
      <div className="bg-white rounded-lg border border-gray-100 shadow-sm px-4 py-2 mb-3 flex items-center gap-3">
        {!embedded && <ProjectSelector selectedId={selectedProjectId} onSelect={setSelectedProjectId} />}
        <Button size="sm" onClick={handleSave} disabled={!hasUnsavedChanges || isSaving} className="h-7 text-[12px] px-3 gap-1 bg-teal-600 hover:bg-teal-700 text-white">
          {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} حفظ
        </Button>
        <span className="text-[11px] text-gray-500 mr-auto">{totalUnits} وحدة | {totalParking} موقف</span>
        <span className="text-[10px] text-amber-700">سعر القدم² يُحدد حصراً من صفحة المبيعات والتسويق</span>
      </div>

      {/* Table in white rounded container */}
      <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="py-[4px] px-2 text-right text-[11px] font-bold text-gray-700">النوع</th>
              <th className="py-[4px] px-2 text-center text-[11px] font-bold text-gray-700 w-16">العدد</th>
              <th className="py-[4px] px-2 text-center text-[11px] font-bold text-gray-700 w-18">المساحة</th>
              <th className="py-[4px] px-2 text-center text-[11px] font-bold text-gray-700">إجمالي المساحة</th>
              <th className="py-[4px] px-2 text-center text-[11px] font-bold text-gray-700 w-16">مواقف</th>
            </tr>
          </thead>
          <tbody>
            {renderCategory("residential", "سكني")}
            {renderCategory("retail", "تجزئة")}
            {renderCategory("office", "مكاتب")}
          </tbody>
          <tfoot>
            <tr className="bg-teal-50 font-bold border-t-2 border-teal-200 text-[11px]">
              <td className="py-[4px] px-2 text-teal-800">الإجمالي</td>
              <td className="py-[4px] px-2 text-center text-teal-800">{totalUnits}</td>
              <td className="py-[4px] px-2 text-center text-teal-800">—</td>
              <td className="py-[4px] px-2 text-center text-teal-800 tabular-nums">{fmt((calc.residential?.used || 0) + (calc.retail?.used || 0) + (calc.office?.used || 0))}</td>
              <td className="py-[4px] px-2 text-center text-teal-800">{totalParking}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Summary cards - Portfolio style */}
      <div className="mt-3 grid grid-cols-3 gap-3">
        <div className="bg-white rounded-lg p-3 border border-teal-100 shadow-sm text-center">
          <div className="text-[10px] text-teal-600 mb-0.5">إجمالي الوحدات</div>
          <div className="text-base font-bold text-teal-700">{totalUnits}</div>
        </div>
        <div className="bg-white rounded-lg p-3 border border-gray-100 shadow-sm text-center">
          <div className="text-[10px] text-gray-600 mb-0.5">إجمالي المواقف</div>
          <div className="text-base font-bold text-gray-800">{totalParking}</div>
        </div>
        <div className="bg-white rounded-lg p-3 border border-red-100 shadow-sm text-center">
          <div className="text-[10px] text-red-600 mb-0.5">إجمالي المساحة المستخدمة</div>
          <div className="text-base font-bold text-red-700" dir="ltr">{fmt((calc.residential?.used || 0) + (calc.retail?.used || 0) + (calc.office?.used || 0))} <span className="text-[11px] text-gray-400">قدم²</span></div>
        </div>
      </div>
    </div>
  );
}
