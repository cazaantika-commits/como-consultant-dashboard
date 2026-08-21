
import { useMemo, useState, useCallback, useEffect } from "react";
import { useProjectContext } from "@/contexts/ProjectContext";
import { ProjectSelector } from "@/components/ProjectSelector";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { PROJECT_INPUTS, dbProjectToInputs } from "@/lib/projectData";
import { useToast } from "@/hooks/use-toast";
import { default as Save } from "lucide-react/dist/esm/icons/save.js";
import { default as Loader2 } from "lucide-react/dist/esm/icons/loader-circle.js";
import { default as Car } from "lucide-react/dist/esm/icons/car.js";
import { default as Info } from "lucide-react/dist/esm/icons/info.js";
import { Button } from "@/components/ui/button";
import { formatFullNumber } from "@/lib/numberFormat";
import {
  calculateParkingSummary,
  calculateUnitParking,
  parseParkingRules,
  type ParkingCategory,
} from "@/lib/parkingRules";

interface UnitType {
  key: string;
  label: string;
  category: ParkingCategory;
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
  onebed: "residential1brCount", twobed: "residential2brCount", threebed: "residential3brCount",
  villa: "villaCount", townhouse: "townhouseCount",
  retail_small: "retailSmallCount", retail_medium: "retailMediumCount", retail_large: "retailLargeCount",
  office_small: "officeSmallCount", office_medium: "officeMediumCount", office_large: "officeLargeCount",
};

const AREA_MAP: Record<string, string> = {
  onebed: "residential1brArea", twobed: "residential2brArea", threebed: "residential3brArea",
  villa: "villaArea", townhouse: "townhouseArea",
  retail_small: "retailSmallArea", retail_medium: "retailMediumArea", retail_large: "retailLargeArea",
  office_small: "officeSmallArea", office_medium: "officeMediumArea", office_large: "officeLargeArea",
};

const fmt = (value: number) => formatFullNumber(value, "");
const categoryMeta: Record<ParkingCategory, { label: string; tone: string; text: string }> = {
  residential: { label: "سكني", tone: "bg-blue-50/70 border-blue-200", text: "text-blue-700" },
  retail: { label: "تجزئة", tone: "bg-orange-50/70 border-orange-200", text: "text-orange-700" },
  office: { label: "مكاتب", tone: "bg-teal-50/70 border-teal-200", text: "text-teal-700" },
};

export default function PricingPage({ embedded }: { embedded?: boolean } = {}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { selectedProjectId, setSelectedProjectId } = useProjectContext();
  const projectQuery = trpc.projects.getById.useQuery(selectedProjectId!, { enabled: !!selectedProjectId && !!user });
  const updateProject = trpc.projects.update.useMutation();
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const i = useMemo(() => projectQuery.data ? dbProjectToInputs(projectQuery.data) : PROJECT_INPUTS, [projectQuery.data]);
  const sellable = useMemo(() => ({
    residential: i.gfaResidential * i.efficiencyResidential,
    retail: i.gfaRetail * i.efficiencyRetail,
    office: i.gfaOffice * i.efficiencyOffice,
  }), [i]);

  const [counts, setCounts] = useState<Record<string, number>>({
    onebed: 0, twobed: 0, threebed: 0, villa: 0, townhouse: 0,
    retail_small: 0, retail_medium: 0, retail_large: 0,
    office_small: 0, office_medium: 0, office_large: 0,
  });
  const [areas, setAreas] = useState<Record<string, number>>({ ...DEFAULT_AREAS });

  useEffect(() => {
    if (!selectedProjectId || projectQuery.isLoading || !projectQuery.data) return;
    const project = projectQuery.data as any;
    const hasSavedCounts = Object.values(COUNT_MAP).some(field => Number(project[field]) > 0);
    if (hasSavedCounts) {
      const nextCounts: Record<string, number> = {};
      const nextAreas: Record<string, number> = { ...DEFAULT_AREAS };
      Object.entries(COUNT_MAP).forEach(([key, field]) => { nextCounts[key] = Number(project[field]) || 0; });
      Object.entries(AREA_MAP).forEach(([key, field]) => {
        const value = Number(project[field]);
        if (Number.isFinite(value) && value >= 0) nextAreas[key] = value;
      });
      setCounts(nextCounts); setAreas(nextAreas); setHasUnsavedChanges(false);
    } else {
      const residential = i.gfaResidential * i.efficiencyResidential;
      const retail = i.gfaRetail * i.efficiencyRetail;
      const office = i.gfaOffice * i.efficiencyOffice;
      const suggested: Record<string, number> = { onebed: 0, twobed: 0, threebed: 0, villa: 0, townhouse: 0, retail_small: 0, retail_medium: 0, retail_large: 0, office_small: 0, office_medium: 0, office_large: 0 };
      if (residential > 0) { suggested.onebed = Math.round(residential * 0.4 / 750); suggested.twobed = Math.round(residential * 0.4 / 1300); suggested.threebed = Math.round(residential * 0.2 / 1650); }
      if (retail > 0) { suggested.retail_small = Math.round(retail * 0.4 / 850); suggested.retail_medium = Math.round(retail * 0.4 / 1200); suggested.retail_large = Math.round(retail * 0.2 / 1800); }
      if (office > 0) { suggested.office_small = Math.round(office * 0.4 / 1200); suggested.office_medium = Math.round(office * 0.4 / 2000); suggested.office_large = Math.round(office * 0.2 / 3500); }
      setCounts(suggested); setAreas({ ...DEFAULT_AREAS }); setHasUnsavedChanges(true);
    }
  }, [selectedProjectId, projectQuery.data, projectQuery.isLoading, i]);

  const updateCount = useCallback((key: string, value: number) => { setCounts(previous => ({ ...previous, [key]: Math.max(0, value) })); setHasUnsavedChanges(true); }, []);
  const updateArea = useCallback((key: string, value: number) => { setAreas(previous => ({ ...previous, [key]: Math.max(0, value) })); setHasUnsavedChanges(true); }, []);

  const allocationRows = useMemo(() => UNIT_TYPES.map(unit => ({
    category: unit.category,
    areaSqft: areas[unit.key] ?? unit.defaultArea,
    count: counts[unit.key] || 0,
  })), [areas, counts]);
  const parkingRules = useMemo(() => parseParkingRules((projectQuery.data as any)?.parkingRulesJson), [projectQuery.data]);
  const parkingSummary = useMemo(() => calculateParkingSummary(
    allocationRows,
    parkingRules,
    (projectQuery.data as any)?.parkingAvailableSpaces,
  ), [allocationRows, parkingRules, projectQuery.data]);

  const calc = useMemo(() => {
    const result: Record<ParkingCategory, { used: number; available: number; diff: number; units: number; parking: number | null }> = {} as any;
    (Object.keys(categoryMeta) as ParkingCategory[]).forEach(category => {
      const rows = UNIT_TYPES.filter(unit => unit.category === category);
      const used = rows.reduce((sum, unit) => sum + (counts[unit.key] || 0) * (areas[unit.key] ?? unit.defaultArea), 0);
      const units = rows.reduce((sum, unit) => sum + (counts[unit.key] || 0), 0);
      result[category] = {
        used,
        available: sellable[category],
        diff: sellable[category] - used,
        units,
        parking: parkingSummary.perCategory[category],
      };
    });
    return result;
  }, [areas, counts, parkingSummary.perCategory, sellable]);

  const totalUnits = Object.values(calc).reduce((sum, category) => sum + category.units, 0);
  const totalUsed = Object.values(calc).reduce((sum, category) => sum + category.used, 0);
  const totalAvailable = Object.values(calc).reduce((sum, category) => sum + category.available, 0);
  const totalAreaVariance = totalAvailable - totalUsed;

  const handleSave = useCallback(async () => {
    if (!selectedProjectId || !user) return;
    setIsSaving(true);
    try {
      const data: any = { id: selectedProjectId };
      Object.entries(COUNT_MAP).forEach(([key, field]) => { data[field] = String(counts[key] || 0); });
      Object.entries(AREA_MAP).forEach(([key, field]) => { data[field] = String(areas[key] ?? 0); });
      await updateProject.mutateAsync(data);
      setHasUnsavedChanges(false);
      toast({ title: "تم الحفظ ✓" });
      projectQuery.refetch();
    } catch {
      toast({ title: "خطأ", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  }, [selectedProjectId, user, counts, areas, updateProject, toast, projectQuery]);

  if (!selectedProjectId) {
    return <div className="p-2 text-center text-xs text-gray-400" dir="rtl">{!embedded && <ProjectSelector selectedId={selectedProjectId} onSelect={setSelectedProjectId} />}<p className="mt-1">اختر مشروعاً من دليل الدراسات</p></div>;
  }
  if (projectQuery.isLoading) return <div className="p-2 text-center"><Loader2 className="w-4 h-4 animate-spin mx-auto" /></div>;

  const renderCategory = (category: ParkingCategory) => {
    const summary = calc[category];
    const meta = categoryMeta[category];
    return <>
      <tr className={`border-t ${meta.tone}`}>
        <td colSpan={3} className={`py-1 px-2 font-bold text-[11px] ${meta.text}`}>{meta.label}</td>
        <td className="py-1 px-2 text-center text-[10px] text-slate-600">متاح: {fmt(summary.available)} | فرق: <span className={summary.diff < 0 ? "text-rose-600" : "text-emerald-700"}>{fmt(summary.diff)}</span></td>
        <td className="py-1 px-2 text-center text-[10px] text-slate-600">{summary.parking === null ? "بانتظار الشرط" : summary.parking}</td>
      </tr>
      {UNIT_TYPES.filter(unit => unit.category === category).map((unit, index) => {
        const count = counts[unit.key] || 0;
        const area = areas[unit.key] ?? unit.defaultArea;
        const parking = calculateUnitParking(category, area, count, parkingRules);
        return <tr key={unit.key} className={index % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
          <td className="py-1 px-2 text-[11px] text-slate-700">{unit.label}</td>
          <td className="py-1 px-2 text-center"><input type="number" min={0} value={count} onChange={event => updateCount(unit.key, parseInt(event.target.value) || 0)} className="w-14 h-6 text-[11px] text-center border border-slate-300 rounded bg-white focus:border-teal-500 focus:outline-none" /></td>
          <td className="py-1 px-2 text-center"><input type="number" min={0} value={area} onChange={event => updateArea(unit.key, parseInt(event.target.value) || 0)} className="w-[72px] h-6 text-[11px] text-center border border-slate-300 rounded bg-white focus:border-teal-500 focus:outline-none" /></td>
          <td className="py-1 px-2 text-center text-[11px] text-slate-600 tabular-nums">{count > 0 ? fmt(count * area) : "—"}</td>
          <td className="py-1 px-2 text-center text-[11px] text-slate-600 tabular-nums">{count > 0 ? (parking === null ? "—" : parking) : "—"}</td>
        </tr>;
      })}
    </>;
  };

  const parkingReady = parkingSummary.totalRequired !== null;
  const parkingVarianceTone = parkingSummary.variance === null ? "text-slate-500" : parkingSummary.variance < 0 ? "text-rose-700" : "text-emerald-700";

  return <div className="bg-slate-50 px-3 py-3" dir="rtl">
    <div className="w-full max-w-5xl space-y-3">
      <div className="fs-card fs-card-teal flex flex-wrap items-center gap-2 rounded-lg px-3 py-2">
        {!embedded && <ProjectSelector selectedId={selectedProjectId} onSelect={setSelectedProjectId} />}
        <Button size="sm" onClick={handleSave} disabled={!hasUnsavedChanges || isSaving} className="h-7 gap-1 bg-teal-600 px-3 text-[12px] text-white hover:bg-teal-700">
          {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} حفظ
        </Button>
        <span className="text-[11px] text-slate-600">{totalUnits} وحدة</span>
        <span className="text-[10px] text-amber-700">سعر القدم² يُحدد حصراً من صفحة المبيعات والتسويق</span>
      </div>

      <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,2.1fr)_minmax(245px,0.9fr)]">
        <div className="fs-card fs-card-blue overflow-hidden rounded-lg">
          <table className="w-full border-collapse text-[11px]">
            <thead><tr className="border-b-2 border-slate-300 bg-slate-100">
              <th className="px-2 py-1.5 text-right text-[11px] font-bold text-slate-800">النوع</th>
              <th className="w-16 px-2 py-1.5 text-center text-[11px] font-bold text-slate-800">العدد</th>
              <th className="w-20 px-2 py-1.5 text-center text-[11px] font-bold text-slate-800">المساحة</th>
              <th className="px-2 py-1.5 text-center text-[11px] font-bold text-slate-800">إجمالي المساحة</th>
              <th className="w-24 px-2 py-1.5 text-center text-[11px] font-bold text-slate-800">مواقف مطلوبة</th>
            </tr></thead>
            <tbody>{renderCategory("residential")}{renderCategory("retail")}{renderCategory("office")}</tbody>
            <tfoot><tr className="border-t-2 border-teal-300 bg-teal-50 text-[11px] font-bold text-teal-900">
              <td className="px-2 py-1.5">الإجمالي</td><td className="px-2 py-1.5 text-center">{totalUnits}</td><td className="px-2 py-1.5 text-center">—</td><td className="px-2 py-1.5 text-center tabular-nums">{fmt(totalUsed)}</td><td className="px-2 py-1.5 text-center">{parkingReady ? parkingSummary.totalRequired : "—"}</td>
            </tr></tfoot>
          </table>
        </div>

        <aside className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Metric label="إجمالي الوحدات" value={String(totalUnits)} tone="teal" />
            <Metric label="المساحة الموزعة" value={fmt(totalUsed)} tone="blue" />
            <Metric label="المتاح للبيع" value={fmt(totalAvailable)} tone="violet" />
            <Metric label="فرق المساحة" value={fmt(totalAreaVariance)} tone={totalAreaVariance < 0 ? "rose" : "emerald"} />
          </div>

          <div className="fs-card fs-card-violet rounded-lg p-3">
            <div className="mb-2 flex items-center gap-1.5"><Car className="h-4 w-4 text-indigo-700" /><h3 className="text-xs font-bold text-indigo-900">احتساب المواقف من الوثائق</h3></div>
            {(projectQuery.data as any)?.parkingSourceReference && <p className="mb-2 text-[10px] text-indigo-700">المرجع: {(projectQuery.data as any).parkingSourceReference}</p>}
            {(projectQuery.data as any)?.parkingRequirementsText && <p className="mb-2 rounded border border-indigo-100 bg-white/80 p-2 text-[10px] leading-relaxed text-slate-700">{(projectQuery.data as any).parkingRequirementsText}</p>}
            {parkingSummary.ruleLines.length > 0 ? <div className="space-y-1">{parkingSummary.ruleLines.map(line => <p key={line} className="text-[10px] text-slate-700">• {line}</p>)}</div> : <div className="rounded border border-amber-200 bg-amber-50 p-2 text-[10px] leading-relaxed text-amber-800"><Info className="ml-1 inline h-3 w-3" />لا توجد قاعدة مواقف منظمة مستخرجة بعد. لن تُستخدم أي افتراضات حتى يضيف خازن الشرط من الوثائق.</div>}
            <div className="mt-3 space-y-1 border-t border-indigo-200 pt-2 text-[10px]">
              <SummaryLine label="المطلوب" value={parkingReady ? String(parkingSummary.totalRequired) : "غير مكتمل"} />
              <SummaryLine label="المتاح في الوثائق" value={parkingSummary.available === null ? "غير مذكور" : String(parkingSummary.available)} />
              <SummaryLine label="الفائض / العجز" value={parkingSummary.variance === null ? "بانتظار البيانات" : String(parkingSummary.variance)} valueClass={parkingVarianceTone} />
            </div>
          </div>
        </aside>
      </div>
    </div>
  </div>;
}

function Metric({ label, value, tone }: { label: string; value: string; tone: "teal" | "blue" | "violet" | "emerald" | "rose" }) {
  const tones = {
    teal: "fs-card fs-card-teal text-teal-800",
    blue: "fs-card fs-card-blue text-blue-800",
    violet: "fs-card fs-card-violet text-violet-800",
    emerald: "fs-card fs-card-emerald text-emerald-800",
    rose: "fs-card fs-card-rose text-rose-800",
  };
  return <div className={`rounded-lg border p-2 text-center ${tones[tone]}`}><div className="text-[9px] opacity-75">{label}</div><div className="mt-0.5 text-[13px] font-bold tabular-nums">{value}</div></div>;
}

function SummaryLine({ label, value, valueClass = "text-slate-800" }: { label: string; value: string; valueClass?: string }) {
  return <div className="flex items-center justify-between gap-2"><span className="text-slate-600">{label}</span><span className={`font-bold tabular-nums ${valueClass}`}>{value}</span></div>;
}
