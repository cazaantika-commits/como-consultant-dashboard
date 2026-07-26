import { useState, useEffect, useCallback, useMemo } from "react";
import { useProjectContext } from "@/contexts/ProjectContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/hooks/use-toast";
import { ProjectSelector } from "@/components/ProjectSelector";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Save, Loader2, HardHat, TrendingUp, DollarSign,
  RotateCcw, Info, Percent,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════
// S-CURVE TEMPLATES
// ═══════════════════════════════════════════════════════════════════
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
    if (type === "standard") {
      const k = 8;
      cumPrev = i === 0 ? 0 : 100 / (1 + Math.exp(-k * ((i / months) - 0.5)));
      cumCurr = 100 / (1 + Math.exp(-k * (((i + 1) / months) - 0.5)));
    } else if (type === "front_loaded") {
      const k = 6;
      cumPrev = i === 0 ? 0 : 100 / (1 + Math.exp(-k * ((i / months) - 0.35)));
      cumCurr = 100 / (1 + Math.exp(-k * (((i + 1) / months) - 0.35)));
    } else {
      const k = 6;
      cumPrev = i === 0 ? 0 : 100 / (1 + Math.exp(-k * ((i / months) - 0.65)));
      cumCurr = 100 / (1 + Math.exp(-k * (((i + 1) / months) - 0.65)));
    }
    result.push(Math.round((cumCurr - cumPrev) * 10) / 10);
  }
  const sum = result.reduce((a, b) => a + b, 0);
  if (sum !== 100) {
    const diff = 100 - sum;
    result[result.length - 1] = Math.round((result[result.length - 1] + diff) * 10) / 10;
  }
  return result;
}

function fmt(n: number): string {
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + "م";
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(0) + "ك";
  return n.toFixed(0);
}

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════
export default function ConstructionInputsPage({ embedded }: { embedded?: boolean } = {}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { selectedProjectId, setSelectedProjectId } = useProjectContext();

  const projectQuery = trpc.projects.getById.useQuery(selectedProjectId!, { enabled: !!selectedProjectId && !!user });
  const updateProject = trpc.projects.update.useMutation({
    onSuccess: () => {
      projectQuery.refetch();
      toast({ title: "تم الحفظ ✓", description: "تم حفظ جدول الإنشاء بنجاح" });
    },
    onError: (err: any) => toast({ title: "خطأ", description: "فشل الحفظ: " + err.message, variant: "destructive" }),
  });

  const project = projectQuery.data;

  const [constructionMonths, setConstructionMonths] = useState(18);
  const [mobilizationPct, setMobilizationPct] = useState(10);
  const [retentionPct] = useState(10); // 5% + 5% = 10% total retention
  const [monthlyProgress, setMonthlyProgress] = useState<number[]>([]);
  const [curveType, setCurveType] = useState<"standard" | "front_loaded" | "back_loaded" | "linear">("standard");
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (!project) return;
    const months = project.constructionMonths || 18;
    setConstructionMonths(months);

    let schedule: { mobilizationPct?: number; monthlyProgress?: number[]; curveType?: string } | null = null;
    try {
      if (project.constructionScheduleJson) {
        schedule = JSON.parse(project.constructionScheduleJson);
      }
    } catch { /* ignore */ }

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
    setMonthlyProgress(prev => {
      const updated = [...prev];
      updated[index] = Math.max(0, Math.min(30, value));
      return updated;
    });
    setIsDirty(true);
  }, []);

  const totalPct = useMemo(() => Math.round(monthlyProgress.reduce((a, b) => a + b, 0) * 10) / 10, [monthlyProgress]);

  const constructionCost = useMemo(() => {
    if (!project) return 0;
    const bua = Number(project.manualBuaSqft) || 0;
    const costPerSqft = Number(project.estimatedConstructionPricePerSqft) || 400;
    return bua * costPerSqft;
  }, [project]);

  // Total columns: construction months + 13 post-completion months
  const postCompletionMonths = 13;
  const totalColumns = constructionMonths + postCompletionMonths;

  // Payment data for each column
  const paymentData = useMemo(() => {
    if (!constructionCost || !monthlyProgress.length) return [];
    const mobilizationAmount = constructionCost * (mobilizationPct / 100);
    const workCost = constructionCost - mobilizationAmount; // cost excluding mobilization
    const retentionRate = retentionPct / 100; // 10% retained each month (5%+5%)
    const totalRetention1 = constructionCost * 0.05; // 5% released at +2
    const totalRetention2 = constructionCost * 0.05; // 5% released at +13

    let cumulativePaid = 0;
    let cumulativeRetained = 0;

    const data: Array<{
      month: number; // 1-based
      isConstruction: boolean;
      progressPct: number;
      fullAmount: number; // full payment based on %
      actualPaid: number; // 80% of full (or mobilization for month 1)
      retentionHeld: number; // 20% held
      cumulativePaid: number;
      cumulativeRetained: number;
      retention1Release: number; // 5% released at completion+2
      retention2Release: number; // 5% released at completion+13
    }> = [];

    for (let col = 0; col < totalColumns; col++) {
      const monthNum = col + 1;
      const isConstruction = col < constructionMonths;
      let progressPct = 0;
      let fullAmount = 0;
      let actualPaid = 0;
      let retentionHeld = 0;
      let retention1Release = 0;
      let retention2Release = 0;

      if (isConstruction) {
        if (col === 0) {
          // Month 1: mobilization (advance payment)
          progressPct = 0;
          fullAmount = mobilizationAmount;
          actualPaid = mobilizationAmount;
          retentionHeld = 0;
        } else {
          // Month N: pays for progress of month N-1 (1 month delay)
          const progressIdx = col - 1; // progress of previous month
          progressPct = progressIdx < monthlyProgress.length ? monthlyProgress[progressIdx] : 0;
          fullAmount = constructionCost * (progressPct / 100);
          actualPaid = fullAmount * 0.8; // 80% of full amount
          retentionHeld = 0;
        }
      } else {
        // Post-completion months
        const postMonth = col - constructionMonths + 1; // 1-based post month
        if (postMonth === 1) {
          // Pay for last construction month's progress
          const lastIdx = constructionMonths - 1;
          progressPct = lastIdx < monthlyProgress.length ? monthlyProgress[lastIdx] : 0;
          fullAmount = constructionCost * (progressPct / 100);
          actualPaid = fullAmount * 0.8;
          retentionHeld = 0;
        }
        if (postMonth === 2) {
          retention1Release = totalRetention1; // 5% released
        }
        if (postMonth === 13) {
          retention2Release = totalRetention2; // 5% released
        }
      }

      cumulativePaid += actualPaid + retention1Release + retention2Release;
      cumulativeRetained += retentionHeld - (retention1Release > 0 ? totalRetention1 : 0) - (retention2Release > 0 ? totalRetention2 : 0);

      data.push({
        month: monthNum,
        isConstruction,
        progressPct,
        fullAmount,
        actualPaid,
        retentionHeld,
        cumulativePaid,
        cumulativeRetained: Math.max(0, cumulativeRetained),
        retention1Release,
        retention2Release,
      });
    }
    return data;
  }, [constructionCost, monthlyProgress, mobilizationPct, retentionPct, constructionMonths, totalColumns]);

  const handleSave = () => {
    if (!selectedProjectId) return;
    const scheduleData = JSON.stringify({
      mobilizationPct,
      monthlyProgress,
      curveType,
    });
    updateProject.mutate({
      id: selectedProjectId,
      constructionMonths,
      constructionScheduleJson: scheduleData,
    });
    setIsDirty(false);
  };

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════
  if (!user) return <div className="p-4 text-center text-gray-400 text-sm">يرجى تسجيل الدخول</div>;

  return (
    <TooltipProvider>
      <div className="bg-gray-50 px-4 py-2" dir="rtl">
        {/* Toolbar */}
        <div className="bg-white rounded-lg border border-gray-100 shadow-sm px-4 py-2 mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <HardHat className="w-4 h-4 text-teal-600" />
            <span className="text-xs font-bold text-gray-800">جدول الإنشاء</span>
          </div>
          <div className="flex items-center gap-2">
            <ProjectSelector
              selectedId={selectedProjectId}
              onSelect={setSelectedProjectId}
            />
            <Button size="sm" onClick={handleSave} disabled={!isDirty || updateProject.isPending || !selectedProjectId} className="h-7 text-[12px] px-3 gap-1 bg-teal-600 hover:bg-teal-700 text-white">
              {updateProject.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              حفظ
            </Button>
          </div>
        </div>

        {!selectedProjectId && (
          <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-4 text-center text-gray-400 text-xs">
            اختر مشروعاً
          </div>
        )}

        {selectedProjectId && projectQuery.isLoading && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        )}

        {selectedProjectId && project && (
          <div className="space-y-3">
            {/* Summary Cards */}
            <div className="grid grid-cols-4 gap-3">
              <div className="bg-white rounded-lg p-2 border border-gray-100 shadow-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-gray-600">مدة الإنشاء</span>
                  <Badge variant="outline" className="text-[9px] h-4">{constructionMonths} شهر</Badge>
                </div>
                <Slider
                  value={[constructionMonths]}
                  onValueChange={([v]) => handleMonthsChange(v)}
                  min={6} max={48} step={1} className="mt-1"
                />
              </div>

              <div className="bg-white rounded-lg p-2 border border-gray-100 shadow-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-gray-600">دفعة مقدمة</span>
                  <Badge variant="outline" className="text-[9px] h-4">{mobilizationPct}%</Badge>
                </div>
                <Slider
                  value={[mobilizationPct]}
                  onValueChange={([v]) => { setMobilizationPct(v); setIsDirty(true); }}
                  min={0} max={25} step={1} className="mt-1"
                />
              </div>

              <div className="bg-white rounded-lg p-2 border border-red-100 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-red-600">تكلفة الإنشاء</span>
                  <Tooltip>
                    <TooltipTrigger><Info className="w-3 h-3 text-gray-400" /></TooltipTrigger>
                    <TooltipContent>BUA × تكلفة/قدم</TooltipContent>
                  </Tooltip>
                </div>
                <div className="text-sm font-bold text-red-700">
                  {constructionCost ? (constructionCost / 1_000_000).toFixed(1) + " م" : "—"}
                </div>
              </div>

              <div className="bg-white rounded-lg p-2 border border-amber-100 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-amber-700">الريتنشن ({retentionPct}%)</span>
                </div>
                <div className="text-[9px] text-gray-600">5% بعد شهرين | 5% بعد 13 شهر</div>
              </div>
            </div>

            {/* Curve Type Selector */}
            <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-2">
              <div className="flex items-center justify-between mb-1.5">
                <h3 className="text-[11px] font-bold text-gray-700 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-teal-600" />
                  نوع المنحنى
                </h3>
                {totalPct !== 100 && (
                  <Badge variant="destructive" className="text-[9px] h-4">المجموع: {totalPct}%</Badge>
                )}
                <Button variant="ghost" size="sm" onClick={() => handleRegenerateFromTemplate(curveType)} className="gap-1 text-[10px] h-5 text-gray-600 hover:text-teal-700">
                  <RotateCcw className="w-3 h-3" /> إعادة توليد
                </Button>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { id: "standard" as const, label: "قياسي (S)" },
                  { id: "front_loaded" as const, label: "مبكر" },
                  { id: "back_loaded" as const, label: "متأخر" },
                  { id: "linear" as const, label: "خطي" },
                ].map(t => (
                  <button
                    key={t.id}
                    onClick={() => handleRegenerateFromTemplate(t.id)}
                    className={`py-1 px-2 rounded border text-[10px] font-medium transition-all ${
                      curveType === t.id
                        ? "border-teal-500 bg-teal-50 text-teal-700"
                        : "border-gray-200 hover:border-teal-300 bg-white text-gray-700"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════ */}
            {/* MAIN GRID: Month boxes + inputs + payment rows */}
            {/* ═══════════════════════════════════════════════════════════ */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-teal-600" />
                  <h2 className="text-[11px] font-bold text-gray-800">جدول دفعات المقاول</h2>
                  {totalPct !== 100 && <Badge variant="destructive" className="text-[9px]">الإنجاز: {totalPct}% ≠ 100%</Badge>}
                </div>
                <div className="flex items-center gap-2 text-[9px] text-gray-500">
                  <span>المقدمة: {mobilizationPct}%</span>
                  <span>|</span>
                  <span>ريتنشن: {retentionPct}%</span>
                  <span>|</span>
                  <span>صافي الدفع: {100 - retentionPct}%</span>
                </div>
              </div>
              <div className="p-2 overflow-x-auto">
                {constructionCost > 0 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: `70px repeat(${totalColumns}, minmax(40px, 1fr))`, direction: 'rtl' }}>
                    {/* Row 1: Month numbers */}
                    <div className="text-[7px] font-bold text-gray-500 flex items-center justify-center border-b border-gray-200 py-0.5">الشهر</div>
                    {Array.from({ length: totalColumns }, (_, i) => {
                      const isConstruction = i < constructionMonths;
                      const displayNum = isConstruction ? i + 1 : i - constructionMonths + 1;
                      return (
                        <div key={i} className={`text-center text-[7px] font-bold py-0.5 border-b border-l border-gray-200 ${
                          isConstruction ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {isConstruction ? displayNum : `+${displayNum}`}
                        </div>
                      );
                    })}

                    {/* Row 2: Progress % inputs (only during construction, starting from month 1) */}
                    <div className="text-[7px] font-bold text-gray-500 flex items-center justify-center border-b border-gray-200 py-0.5">إنجاز %</div>
                    {Array.from({ length: totalColumns }, (_, i) => {
                      const isConstruction = i < constructionMonths;
                      return (
                        <div key={i} className="flex items-center justify-center border-b border-l border-gray-200 py-0.5">
                          {isConstruction ? (
                            <input
                              type="number" min={0} max={30} step={0.5}
                              value={monthlyProgress[i] ?? 0}
                              onChange={(e) => handleMonthEdit(i, parseFloat(e.target.value) || 0)}
                              className="w-7 h-4 text-center text-[9px] font-bold border border-gray-200 rounded bg-white focus:ring-1 focus:ring-teal-200 outline-none"
                            />
                          ) : (
                            <span className="text-[7px] text-gray-300">-</span>
                          )}
                        </div>
                      );
                    })}





                    {/* Row 5: Contractor payment (80% + retention releases) */}
                    <div className="text-[7px] font-bold text-emerald-700 flex items-center justify-center border-b border-gray-200 py-0.5">دفعة المقاول</div>
                    {paymentData.map((d, i) => {
                      const payment = d.actualPaid + d.retention1Release + d.retention2Release;
                      const isRetention = d.retention1Release > 0 || d.retention2Release > 0;
                      return (
                        <div key={i} className={`text-center text-[7px] py-0.5 border-b border-l border-gray-200 ${isRetention ? 'bg-amber-50' : ''}`}>
                          <span className={isRetention ? 'text-amber-700 font-bold' : 'text-emerald-700'}>
                            {payment > 0 ? fmt(payment) : '-'}
                          </span>
                        </div>
                      );
                    })}



                    {/* Row 8: Cumulative paid */}
                    <div className="text-[7px] font-bold text-gray-800 flex items-center justify-center py-0.5">التراكمي</div>
                    {paymentData.map((d, i) => (
                      <div key={i} className="text-center text-[7px] font-bold py-0.5 border-l border-gray-200 text-gray-800">
                        {d.cumulativePaid > 0 ? fmt(d.cumulativePaid) : '-'}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-gray-400 p-4 text-xs">
                    أدخل مساحة البناء (BUA) وتكلفة الإنشاء في الإدخالات العامة لعرض جدول الدفعات
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Progress Chart */}
        {constructionCost > 0 && constructionMonths > 0 && (
          <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-4 mt-3">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-teal-600" />
              <span className="text-xs font-bold text-gray-800">منحنى الإنجاز الشهري</span>
              <span className="text-[9px] text-gray-400 mr-auto">نسبة الإنجاز % لكل شهر إنشاء</span>
            </div>
            <div className="relative" style={{ height: '140px' }}>
              {/* Y-axis labels */}
              <div className="absolute left-0 top-0 bottom-0 w-8 flex flex-col justify-between text-[7px] text-gray-400 py-1">
                <span>{Math.max(...monthlyProgress.slice(0, constructionMonths), 1).toFixed(0)}%</span>
                <span>{(Math.max(...monthlyProgress.slice(0, constructionMonths), 1) / 2).toFixed(0)}%</span>
                <span>0%</span>
              </div>
              {/* Bars */}
              <div className="mr-0 ml-9 h-full flex items-end gap-[1px]" dir="rtl">
                {monthlyProgress.slice(0, constructionMonths).map((pct, i) => {
                  const maxPct = Math.max(...monthlyProgress.slice(0, constructionMonths), 1);
                  const barHeight = (pct / maxPct) * 100;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
                      <div
                        className="w-full rounded-t transition-all duration-300"
                        style={{
                          height: `${barHeight}%`,
                          background: pct > 0 ? 'linear-gradient(to top, #0d9488, #5eead4)' : '#e5e7eb',
                          minHeight: pct > 0 ? '2px' : '1px',
                        }}
                      />
                      <span className="text-[6px] text-gray-500 mt-0.5 leading-none">{i + 1}</span>
                    </div>
                  );
                })}
              </div>
              {/* Cumulative S-curve line overlay */}
              <svg className="absolute top-0 left-9 right-0 bottom-3 pointer-events-none" preserveAspectRatio="none" viewBox={`0 0 ${constructionMonths * 10} 100`}>
                <polyline
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={
                    monthlyProgress.slice(0, constructionMonths).reduce((acc, pct, i) => {
                      const cumSum = monthlyProgress.slice(0, i + 1).reduce((s, v) => s + v, 0);
                      const x = (i + 0.5) * 10;
                      const y = 100 - cumSum; // inverted Y
                      return acc + `${x},${y} `;
                    }, '')
                  }
                />
              </svg>
            </div>
            <div className="flex items-center justify-center gap-4 mt-2">
              <div className="flex items-center gap-1">
                <div className="w-3 h-2 rounded-sm" style={{ background: 'linear-gradient(to top, #0d9488, #5eead4)' }} />
                <span className="text-[8px] text-gray-500">إنجاز شهري %</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-0.5 bg-amber-500 rounded" />
                <span className="text-[8px] text-gray-500">تراكمي %</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
