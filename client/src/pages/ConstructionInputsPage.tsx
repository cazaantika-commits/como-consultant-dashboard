import { useState, useEffect, useMemo, useCallback } from "react";
import { useProjectContext } from "@/contexts/ProjectContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/hooks/use-toast";
import { ProjectSelector } from "@/components/ProjectSelector";
import { Button } from "@/components/ui/button";
import { Save, Loader2, Pencil, X } from "lucide-react";

// S-CURVE TEMPLATES
function generateSCurve(months: number, type: "standard" | "front_loaded" | "back_loaded" | "linear"): number[] {
  const result: number[] = [];
  if (type === "linear") {
    const pct = 100 / months;
    for (let i = 0; i < months; i++) result.push(Math.round(pct * 10) / 10);
    const sum = result.reduce((a, b) => a + b, 0);
    result[result.length - 1] += Math.round((100 - sum) * 10) / 10;
    return result;
  }
  for (let i = 0; i < months; i++) {
    let cumPrev = 0, cumCurr = 0;
    const k = type === "standard" ? 8 : 6;
    const mid = type === "front_loaded" ? 0.35 : type === "back_loaded" ? 0.65 : 0.5;
    cumPrev = i === 0 ? 0 : 100 / (1 + Math.exp(-k * ((i / months) - mid)));
    cumCurr = 100 / (1 + Math.exp(-k * (((i + 1) / months) - mid)));
    result.push(Math.round((cumCurr - cumPrev) * 10) / 10);
  }
  const sum = result.reduce((a, b) => a + b, 0);
  if (sum !== 100) result[result.length - 1] = Math.round((result[result.length - 1] + (100 - sum)) * 10) / 10;
  return result;
}

function fmt(n: number): string { return Math.round(n).toLocaleString("en-US"); }

export default function ConstructionInputsPage({ embedded }: { embedded?: boolean } = {}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { selectedProjectId, setSelectedProjectId } = useProjectContext();
  const projectQuery = trpc.projects.getById.useQuery(selectedProjectId!, { enabled: !!selectedProjectId && !!user });
  const updateProject = trpc.projects.update.useMutation({
    onSuccess: () => { projectQuery.refetch(); toast({ title: "تم الحفظ ✓" }); },
    onError: (err: any) => toast({ title: "خطأ", description: err.message, variant: "destructive" }),
  });
  const project = projectQuery.data;

  const [constructionMonths, setConstructionMonths] = useState(18);
  const [mobilizationPct, setMobilizationPct] = useState(10);
  const [monthlyProgress, setMonthlyProgress] = useState<number[]>([]);
  const [curveType, setCurveType] = useState<"standard" | "front_loaded" | "back_loaded" | "linear">("standard");
  const [isDirty, setIsDirty] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (!project) return;
    const months = project.constructionMonths || 18;
    setConstructionMonths(months);
    let schedule: any = null;
    try { if (project.constructionScheduleJson) schedule = JSON.parse(project.constructionScheduleJson); } catch {}
    if (schedule?.monthlyProgress && schedule.monthlyProgress.length === months) {
      setMonthlyProgress(schedule.monthlyProgress);
      setMobilizationPct(schedule.mobilizationPct ?? 10);
      setCurveType((schedule.curveType as any) ?? "standard");
    } else {
      setMonthlyProgress(generateSCurve(months, "standard"));
      setMobilizationPct(10);
      setCurveType("standard");
    }
    setIsDirty(false);
  }, [project]);

  const handleRegenerateFromTemplate = useCallback((type: typeof curveType) => {
    setCurveType(type);
    setMonthlyProgress(generateSCurve(constructionMonths, type));
    setIsDirty(true);
  }, [constructionMonths]);

  const handleMonthsChange = useCallback((newMonths: number) => {
    setConstructionMonths(newMonths);
    setMonthlyProgress(generateSCurve(newMonths, curveType));
    setIsDirty(true);
  }, [curveType]);

  const handleMonthEdit = useCallback((index: number, value: number) => {
    if (!isEditing) return;
    setMonthlyProgress(prev => {
      const updated = [...prev];
      updated[index] = Math.max(0, Math.min(30, value));
      return updated;
    });
    setIsDirty(true);
  }, [isEditing]);

  const totalPct = useMemo(() => Math.round(monthlyProgress.reduce((a, b) => a + b, 0) * 10) / 10, [monthlyProgress]);

  const constructionCost = useMemo(() => {
    if (!project) return 0;
    const bua = Number(project.manualBuaSqft) || 0;
    const costPerSqft = Number(project.estimatedConstructionPricePerSqft) || 400;
    return bua * costPerSqft;
  }, [project]);

  const paymentSchedule = useMemo(() => {
    if (!constructionCost || !monthlyProgress.length) return [];
    const mobilizationAmount = constructionCost * (mobilizationPct / 100);
    const remainingCost = constructionCost - mobilizationAmount;
    let cumPaid = mobilizationAmount;
    return monthlyProgress.map((pct, i) => {
      const monthPayment = remainingCost * (pct / 100);
      cumPaid += monthPayment;
      return { month: i + 1, progress: pct, payment: Math.round(monthPayment), cumPaid: Math.round(cumPaid), cumPaidPct: Math.round((cumPaid / constructionCost) * 1000) / 10 };
    });
  }, [constructionCost, monthlyProgress, mobilizationPct]);

  const handleSave = () => {
    if (!selectedProjectId) return;
    updateProject.mutate({
      id: selectedProjectId,
      constructionMonths,
      constructionScheduleJson: JSON.stringify({ mobilizationPct, monthlyProgress, curveType }),
    });
    setIsDirty(false);
    setIsEditing(false);
  };

  if (!user) return <div className="p-4 text-center text-sm text-gray-500">يرجى تسجيل الدخول</div>;

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
              <Button variant="ghost" size="sm" onClick={() => { setIsEditing(false); setIsDirty(false); projectQuery.refetch(); }} className="h-8 text-sm px-3 gap-1.5">
                <X className="w-3.5 h-3.5" /> إلغاء
              </Button>
              <Button size="sm" onClick={handleSave} disabled={!isDirty || updateProject.isPending} className="h-8 text-sm px-4 gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-md">
                {updateProject.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} حفظ
              </Button>
            </div>
          )}
        </div>
        <div className="text-sm text-gray-500">
          {constructionCost > 0 && <span>تكلفة الإنشاء: <strong className="text-gray-800">{(constructionCost / 1_000_000).toFixed(1)} م</strong></span>}
        </div>
      </div>

      {!selectedProjectId && <div className="text-center text-sm text-gray-400 py-8">اختر مشروعاً</div>}
      {selectedProjectId && projectQuery.isLoading && <div className="text-center py-4"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>}

      {selectedProjectId && project && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-4 gap-4 mb-4">
            <div className="rounded-lg border border-gray-200 p-3 text-center">
              <div className="text-sm text-gray-500">مدة الإنشاء</div>
              <div className="text-lg font-bold text-gray-800 mt-1">{constructionMonths} شهر</div>
            </div>
            <div className="rounded-lg border border-gray-200 p-3 text-center">
              <div className="text-sm text-gray-500">الدفعة المقدمة</div>
              <div className="text-lg font-bold text-gray-800 mt-1">{mobilizationPct}%</div>
            </div>
            <div className="rounded-lg border border-gray-200 p-3 text-center">
              <div className="text-sm text-gray-500">نوع المنحنى</div>
              <div className="text-lg font-bold text-gray-800 mt-1">{curveType === "standard" ? "قياسي" : curveType === "front_loaded" ? "مبكر" : curveType === "back_loaded" ? "متأخر" : "خطي"}</div>
            </div>
            <div className="rounded-lg border border-gray-200 p-3 text-center">
              <div className="text-sm text-gray-500">المجموع</div>
              <div className={`text-lg font-bold mt-1 ${totalPct === 100 ? "text-emerald-600" : "text-red-500"}`}>{totalPct}%</div>
            </div>
          </div>

          {/* Controls row - only in edit mode */}
          {isEditing && (
            <div className="grid grid-cols-3 gap-4 mb-4 p-3 rounded-lg border border-gray-200 bg-gray-50">
              <div>
                <label className="text-sm text-gray-600 block mb-1">مدة الإنشاء (شهر)</label>
                <input type="number" value={constructionMonths} onChange={e => handleMonthsChange(Math.max(6, Math.min(48, parseInt(e.target.value) || 18)))}
                  className="w-full h-8 text-sm text-center rounded border border-gray-300 bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" min={6} max={48} />
              </div>
              <div>
                <label className="text-sm text-gray-600 block mb-1">دفعة مقدمة (%)</label>
                <input type="number" value={mobilizationPct} onChange={e => { setMobilizationPct(Math.max(0, Math.min(25, parseInt(e.target.value) || 0))); setIsDirty(true); }}
                  className="w-full h-8 text-sm text-center rounded border border-gray-300 bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" min={0} max={25} />
              </div>
              <div>
                <label className="text-sm text-gray-600 block mb-1">نوع المنحنى</label>
                <select value={curveType} onChange={e => handleRegenerateFromTemplate(e.target.value as any)}
                  className="w-full h-8 text-sm rounded border border-gray-300 bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500">
                  <option value="standard">قياسي (S)</option>
                  <option value="front_loaded">مبكر</option>
                  <option value="back_loaded">متأخر</option>
                  <option value="linear">خطي</option>
                </select>
              </div>
            </div>
          )}

          {/* Payment Schedule Table */}
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-gray-300 bg-gray-50">
                <th className="py-2 px-3 text-right text-sm text-gray-600 font-medium">الشهر</th>
                <th className="py-2 px-3 text-center text-sm text-gray-600 font-medium w-24">نسبة الإنجاز %</th>
                <th className="py-2 px-3 text-center text-sm text-gray-600 font-medium">الدفعة (درهم)</th>
                <th className="py-2 px-3 text-center text-sm text-gray-600 font-medium">المدفوع التراكمي</th>
                <th className="py-2 px-3 text-center text-sm text-gray-600 font-medium">% المدفوع</th>
              </tr>
            </thead>
            <tbody>
              {/* Mobilization row */}
              <tr className="border-b border-gray-200 bg-amber-50/50">
                <td className="py-2 px-3 text-sm font-medium text-gray-800">مقدمة</td>
                <td className="py-2 px-3 text-center text-sm text-gray-400">—</td>
                <td className="py-2 px-3 text-center text-sm font-medium text-gray-700" dir="ltr">{constructionCost > 0 ? fmt(constructionCost * mobilizationPct / 100) : "—"}</td>
                <td className="py-2 px-3 text-center text-sm text-gray-700" dir="ltr">{constructionCost > 0 ? fmt(constructionCost * mobilizationPct / 100) : "—"}</td>
                <td className="py-2 px-3 text-center text-sm text-gray-600">{mobilizationPct}%</td>
              </tr>
              {paymentSchedule.map((row) => (
                <tr key={row.month} className="border-b border-gray-100 hover:bg-gray-50/50">
                  <td className="py-2 px-3 text-sm text-gray-600">شهر {row.month}</td>
                  <td className="py-2 px-3 text-center">
                    <input type="number" value={row.progress} onChange={e => handleMonthEdit(row.month - 1, parseFloat(e.target.value) || 0)}
                      disabled={!isEditing}
                      className={`w-16 h-7 text-sm text-center rounded ${!isEditing ? "bg-transparent border-none text-gray-800 font-medium" : "bg-white border border-gray-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"}`}
                      min={0} max={30} step={0.5} />
                  </td>
                  <td className="py-2 px-3 text-center text-sm text-gray-700" dir="ltr">{fmt(row.payment)}</td>
                  <td className="py-2 px-3 text-center text-sm text-gray-700" dir="ltr">{fmt(row.cumPaid)}</td>
                  <td className="py-2 px-3 text-center text-sm text-gray-600">{row.cumPaidPct}%</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-400 bg-gray-100 font-bold">
                <td className="py-2 px-3 text-sm">الإجمالي</td>
                <td className="py-2 px-3 text-center text-sm" style={{ color: totalPct === 100 ? '#059669' : '#dc2626' }}>{totalPct}%</td>
                <td className="py-2 px-3 text-center text-sm" dir="ltr">{constructionCost > 0 ? fmt(constructionCost) : "—"}</td>
                <td className="py-2 px-3 text-center text-sm" dir="ltr">{constructionCost > 0 ? fmt(constructionCost) : "—"}</td>
                <td className="py-2 px-3 text-center text-sm">100%</td>
              </tr>
            </tfoot>
          </table>
        </>
      )}
    </div>
  );
}
