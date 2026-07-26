
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
  RotateCcw, Info, Percent, BarChart3,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Cell,
} from "recharts";

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

  const chartData = useMemo(() => {
    let cumulative = 0;
    return monthlyProgress.map((pct, i) => {
      cumulative += pct;
      return {
        month: i + 1,
        label: `ش${i + 1}`,
        progress: pct,
        cumulative: Math.round(cumulative * 10) / 10,
      };
    });
  }, [monthlyProgress]);

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
      return {
        month: i + 1,
        label: `شهر ${i + 1}`,
        progress: pct,
        payment: Math.round(monthPayment),
        cumPaid: Math.round(cumPaid),
        cumPaidPct: Math.round((cumPaid / constructionCost) * 1000) / 10,
      };
    });
  }, [constructionCost, monthlyProgress, mobilizationPct]);

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
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white rounded-lg p-3 border border-gray-100 shadow-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] text-gray-600">مدة الإنشاء</span>
                  <Badge variant="outline" className="text-[10px] h-5">{constructionMonths} شهر</Badge>
                </div>
                <Slider
                  value={[constructionMonths]}
                  onValueChange={([v]) => handleMonthsChange(v)}
                  min={6}
                  max={48}
                  step={1}
                  className="mt-1"
                />
                <div className="flex justify-between text-[9px] text-gray-400 mt-1">
                  <span>6</span>
                  <span>48</span>
                </div>
              </div>

              <div className="bg-white rounded-lg p-3 border border-gray-100 shadow-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] text-gray-600">دفعة مقدمة</span>
                  <Badge variant="outline" className="text-[10px] h-5">{mobilizationPct}%</Badge>
                </div>
                <Slider
                  value={[mobilizationPct]}
                  onValueChange={([v]) => { setMobilizationPct(v); setIsDirty(true); }}
                  min={0}
                  max={25}
                  step={1}
                  className="mt-1"
                />
                <div className="flex justify-between text-[9px] text-gray-400 mt-1">
                  <span>0%</span>
                  <span>25%</span>
                </div>
              </div>

              <div className="bg-white rounded-lg p-3 border border-red-100 shadow-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] text-red-600">تكلفة الإنشاء</span>
                  <Tooltip>
                    <TooltipTrigger><Info className="w-3 h-3 text-gray-400" /></TooltipTrigger>
                    <TooltipContent>BUA × تكلفة/قدم</TooltipContent>
                  </Tooltip>
                </div>
                <div className="text-base font-bold text-red-700">
                  {constructionCost ? (constructionCost / 1_000_000).toFixed(1) + " م" : "—"}
                </div>
                <p className="text-[10px] text-gray-500">
                  المقدمة: {constructionCost ? ((constructionCost * mobilizationPct / 100) / 1_000_000).toFixed(2) + " م" : "—"}
                </p>
              </div>
            </div>

            {/* Curve Type Selector */}
            <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-teal-600" />
                  نوع منحنى الإنجاز (S-Curve)
                </h3>
                {totalPct !== 100 && (
                  <Badge variant="destructive" className="text-[10px] h-5">
                    المجموع: {totalPct}%
                  </Badge>
                )}
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { id: "standard" as const, label: "قياسي (S)", desc: "بداية بطيئة → تسارع → تباطؤ" },
                  { id: "front_loaded" as const, label: "مبكر", desc: "تسارع في البداية" },
                  { id: "back_loaded" as const, label: "متأخر", desc: "تسارع في النهاية" },
                  { id: "linear" as const, label: "خطي", desc: "توزيع متساوي" },
                ].map(t => (
                  <button
                    key={t.id}
                    onClick={() => handleRegenerateFromTemplate(t.id)}
                    className={`p-2 rounded-lg border text-right transition-all ${
                      curveType === t.id
                        ? "border-teal-500 bg-teal-50 ring-1 ring-teal-500/30"
                        : "border-gray-200 hover:border-teal-300 bg-white"
                    }`}
                  >
                    <div className="font-medium text-[11px] text-gray-800">{t.label}</div>
                    <div className="text-[9px] text-gray-500 mt-0.5">{t.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Monthly Progress Bars (editable) - KEPT */}
            <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                  <Percent className="w-3.5 h-3.5 text-teal-600" />
                  نسب الإنجاز الشهرية
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRegenerateFromTemplate(curveType)}
                  className="gap-1 text-[11px] h-6 text-gray-600 hover:text-teal-700"
                >
                  <RotateCcw className="w-3 h-3" />
                  إعادة توليد
                </Button>
              </div>
              <div className="h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.5} />
                    <XAxis dataKey="label" tick={{ fontSize: 9 }} interval={constructionMonths > 24 ? 2 : 0} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
                    <RechartsTooltip
                      contentStyle={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 11 }}
                      formatter={(value: number) => [`${value}%`, "إنجاز"]}
                    />
                    <Bar dataKey="progress" radius={[2, 2, 0, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell key={index} fill={entry.progress > 8 ? "#0d9488" : entry.progress > 4 ? "#5eead4" : "#ccfbf1"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Editable grid */}
              <div className="mt-3 grid grid-cols-6 gap-1.5">
                {monthlyProgress.map((pct, i) => (
                  <div key={i} className="text-center">
                    <div className="text-[9px] text-gray-400 mb-0.5">ش{i + 1}</div>
                    <input
                      type="number"
                      value={pct}
                      onChange={(e) => handleMonthEdit(i, parseFloat(e.target.value) || 0)}
                      className="w-full text-center text-[11px] py-[2px] rounded border border-gray-200 bg-white focus:border-teal-500 focus:outline-none"
                      min={0}
                      max={30}
                      step={0.5}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Payment Schedule Table */}
            <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-teal-600" />
                <h3 className="text-xs font-bold text-gray-700">جدول دفعات المقاول</h3>
              </div>
              {constructionCost > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-right px-3 py-[4px] font-bold text-gray-700">الشهر</th>
                        <th className="text-right px-3 py-[4px] font-bold text-gray-700">نسبة الإنجاز</th>
                        <th className="text-right px-3 py-[4px] font-bold text-gray-700">الدفعة (درهم)</th>
                        <th className="text-right px-3 py-[4px] font-bold text-gray-700">المدفوع التراكمي</th>
                        <th className="text-right px-3 py-[4px] font-bold text-gray-700">% المدفوع</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Mobilization row */}
                      <tr className="border-b border-gray-100 bg-teal-50/50">
                        <td className="px-3 py-[3px] font-medium text-teal-800">مقدمة</td>
                        <td className="px-3 py-[3px]">—</td>
                        <td className="px-3 py-[3px] tabular-nums">{Math.round(constructionCost * mobilizationPct / 100).toLocaleString()}</td>
                        <td className="px-3 py-[3px] tabular-nums">{Math.round(constructionCost * mobilizationPct / 100).toLocaleString()}</td>
                        <td className="px-3 py-[3px]">{mobilizationPct}%</td>
                      </tr>
                      {paymentSchedule.map((row) => (
                        <tr key={row.month} className="border-b border-gray-50 hover:bg-gray-50/50">
                          <td className="px-3 py-[3px] text-gray-700">شهر {row.month}</td>
                          <td className="px-3 py-[3px] text-gray-600">{row.progress}%</td>
                          <td className="px-3 py-[3px] tabular-nums text-gray-700">{row.payment.toLocaleString()}</td>
                          <td className="px-3 py-[3px] tabular-nums text-gray-700">{row.cumPaid.toLocaleString()}</td>
                          <td className="px-3 py-[3px] text-gray-600">{row.cumPaidPct}%</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-teal-50 font-bold border-t-2 border-teal-200">
                        <td className="px-3 py-[4px] text-teal-800">الإجمالي</td>
                        <td className="px-3 py-[4px] text-teal-800">100%</td>
                        <td className="px-3 py-[4px] text-teal-800 tabular-nums">{constructionCost.toLocaleString()}</td>
                        <td className="px-3 py-[4px] text-teal-800 tabular-nums">{constructionCost.toLocaleString()}</td>
                        <td className="px-3 py-[4px] text-teal-800">100%</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <div className="text-center text-gray-400 p-4 text-xs">
                  أدخل مساحة البناء (BUA) وتكلفة الإنشاء في الإدخالات العامة لعرض جدول الدفعات
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
