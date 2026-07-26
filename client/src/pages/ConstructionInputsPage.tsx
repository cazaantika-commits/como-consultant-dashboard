import { useState, useEffect, useMemo, useCallback } from "react";
import { useProjectContext } from "@/contexts/ProjectContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/hooks/use-toast";
import { ProjectSelector } from "@/components/ProjectSelector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Save, Loader2, HardHat, TrendingUp, DollarSign,
  RotateCcw, Info, Percent, BarChart3,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine, Cell,
} from "recharts";

// ═══════════════════════════════════════════════════════════════════
// S-CURVE TEMPLATES
// ═══════════════════════════════════════════════════════════════════
function generateSCurve(months: number, type: "standard" | "front_loaded" | "back_loaded" | "linear"): number[] {
  const result: number[] = [];
  if (type === "linear") {
    const pct = 100 / months;
    for (let i = 0; i < months; i++) result.push(Math.round(pct * 10) / 10);
    // Adjust last to make sum = 100
    const sum = result.reduce((a, b) => a + b, 0);
    result[result.length - 1] += Math.round((100 - sum) * 10) / 10;
    return result;
  }
  // S-curve using logistic function
  for (let i = 0; i < months; i++) {
    const t = (i + 0.5) / months; // midpoint of each month
    let cumPrev = 0, cumCurr = 0;
    if (type === "standard") {
      // Standard S-curve: symmetric
      const k = 8;
      cumPrev = i === 0 ? 0 : 100 / (1 + Math.exp(-k * ((i / months) - 0.5)));
      cumCurr = 100 / (1 + Math.exp(-k * (((i + 1) / months) - 0.5)));
    } else if (type === "front_loaded") {
      // Steeper at start
      const k = 6;
      cumPrev = i === 0 ? 0 : 100 / (1 + Math.exp(-k * ((i / months) - 0.35)));
      cumCurr = 100 / (1 + Math.exp(-k * (((i + 1) / months) - 0.35)));
    } else {
      // Back loaded - steeper at end
      const k = 6;
      cumPrev = i === 0 ? 0 : 100 / (1 + Math.exp(-k * ((i / months) - 0.65)));
      cumCurr = 100 / (1 + Math.exp(-k * (((i + 1) / months) - 0.65)));
    }
    result.push(Math.round((cumCurr - cumPrev) * 10) / 10);
  }
  // Normalize to exactly 100
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

  // Data from DB
  const projectQuery = trpc.projects.getById.useQuery(selectedProjectId!, { enabled: !!selectedProjectId && !!user });
  const updateProject = trpc.projects.update.useMutation({
    onSuccess: () => {
      projectQuery.refetch();
      toast({ title: "تم الحفظ ✓", description: "تم حفظ جدول الإنشاء بنجاح" });
    },
    onError: (err: any) => toast({ title: "خطأ", description: "فشل الحفظ: " + err.message, variant: "destructive" }),
  });

  const project = projectQuery.data;

  // State
  const [constructionMonths, setConstructionMonths] = useState(18);
  const [mobilizationPct, setMobilizationPct] = useState(10);
  const [monthlyProgress, setMonthlyProgress] = useState<number[]>([]);
  const [curveType, setCurveType] = useState<"standard" | "front_loaded" | "back_loaded" | "linear">("standard");
  const [isDirty, setIsDirty] = useState(false);

  // Load from DB
  useEffect(() => {
    if (!project) return;
    const months = project.constructionMonths || 18;
    setConstructionMonths(months);

    // Parse constructionScheduleJson
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
      // Generate default S-curve
      setMonthlyProgress(generateSCurve(months, "standard"));
      setMobilizationPct(10);
      setCurveType("standard");
    }
    setIsDirty(false);
  }, [project]);

  // Regenerate when months or curve type changes
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

  // Manual edit of a single month
  const handleMonthEdit = useCallback((index: number, value: number) => {
    setMonthlyProgress(prev => {
      const updated = [...prev];
      updated[index] = Math.max(0, Math.min(30, value));
      return updated;
    });
    setIsDirty(true);
  }, []);

  // Computed data
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

  // Save
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
  if (!user) return <div className="p-8 text-center text-muted-foreground">يرجى تسجيل الدخول</div>;

  return (
    <TooltipProvider>
      <div className="space-y-2 p-2" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <h1 className="text-xs font-bold flex items-center gap-1">
              <HardHat className="w-3 h-3 text-amber-500" />
              جدول الإنشاء
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <ProjectSelector
              selectedProjectId={selectedProjectId}
              onSelect={setSelectedProjectId}
            />
            <Button size="sm" onClick={handleSave} disabled={!isDirty || updateProject.isPending || !selectedProjectId} className="gap-1 text-xs h-7">
              {updateProject.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              حفظ
            </Button>
          </div>
        </div>

        {!selectedProjectId && (
          <Card className="border-dashed">
            <CardContent className="py-4 text-center text-muted-foreground">
              <p className="text-xs">اختر مشروعاً</p>
            </CardContent>
          </Card>
        )}

        {selectedProjectId && projectQuery.isLoading && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {selectedProjectId && project && (
          <>
            {/* Construction Duration & Mobilization */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">مدة الإنشاء</span>
                    <Badge variant="outline">{constructionMonths} شهر</Badge>
                  </div>
                  <Slider
                    value={[constructionMonths]}
                    onValueChange={([v]) => handleMonthsChange(v)}
                    min={6}
                    max={48}
                    step={1}
                    className="mt-2"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>6 أشهر</span>
                    <span>48 شهر</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">دفعة مقدمة (Mobilization)</span>
                    <Badge variant="outline">{mobilizationPct}%</Badge>
                  </div>
                  <Slider
                    value={[mobilizationPct]}
                    onValueChange={([v]) => { setMobilizationPct(v); setIsDirty(true); }}
                    min={0}
                    max={25}
                    step={1}
                    className="mt-2"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>0%</span>
                    <span>25%</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">تكلفة الإنشاء الإجمالية</span>
                    <Tooltip>
                      <TooltipTrigger><Info className="w-3.5 h-3.5 text-muted-foreground" /></TooltipTrigger>
                      <TooltipContent>BUA × تكلفة/قدم (من الإدخالات العامة)</TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="text-2xl font-bold text-amber-500">
                    {constructionCost ? (constructionCost / 1_000_000).toFixed(1) + " م" : "—"}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    المقدمة: {constructionCost ? ((constructionCost * mobilizationPct / 100) / 1_000_000).toFixed(2) + " م" : "—"}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Curve Type Selector */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    نوع منحنى الإنجاز (S-Curve)
                  </CardTitle>
                  {totalPct !== 100 && (
                    <Badge variant="destructive" className="text-xs">
                      المجموع: {totalPct}% (يجب أن يكون 100%)
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {[
                    { id: "standard" as const, label: "قياسي (S)", desc: "بداية بطيئة → تسارع → تباطؤ" },
                    { id: "front_loaded" as const, label: "مبكر", desc: "تسارع في البداية" },
                    { id: "back_loaded" as const, label: "متأخر", desc: "تسارع في النهاية" },
                    { id: "linear" as const, label: "خطي", desc: "توزيع متساوي" },
                  ].map(t => (
                    <button
                      key={t.id}
                      onClick={() => handleRegenerateFromTemplate(t.id)}
                      className={`p-3 rounded-lg border text-right transition-all ${
                        curveType === t.id
                          ? "border-amber-500 bg-amber-500/10 ring-1 ring-amber-500/30"
                          : "border-border hover:border-amber-500/50"
                      }`}
                    >
                      <div className="font-medium text-sm">{t.label}</div>
                      <div className="text-xs text-muted-foreground mt-1">{t.desc}</div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* S-Curve Chart */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  منحنى الإنجاز التراكمي
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
                      <RechartsTooltip
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                        formatter={(value: number, name: string) => [
                          `${value}%`,
                          name === "cumulative" ? "تراكمي" : "شهري"
                        ]}
                      />
                      <Area
                        type="monotone"
                        dataKey="cumulative"
                        stroke="#f59e0b"
                        fill="#f59e0b"
                        fillOpacity={0.15}
                        strokeWidth={2}
                      />
                      <ReferenceLine y={50} stroke="#666" strokeDasharray="3 3" label={{ value: "50%", position: "right", fontSize: 10 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Monthly Progress Bars (editable) */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Percent className="w-4 h-4" />
                    نسب الإنجاز الشهرية
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRegenerateFromTemplate(curveType)}
                    className="gap-1 text-xs"
                  >
                    <RotateCcw className="w-3 h-3" />
                    إعادة توليد
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                      <XAxis dataKey="label" tick={{ fontSize: 9 }} interval={constructionMonths > 24 ? 2 : 0} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
                      <RechartsTooltip
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                        formatter={(value: number) => [`${value}%`, "إنجاز"]}
                      />
                      <Bar dataKey="progress" radius={[2, 2, 0, 0]}>
                        {chartData.map((entry, index) => (
                          <Cell key={index} fill={entry.progress > 8 ? "#f59e0b" : entry.progress > 4 ? "#fbbf24" : "#fde68a"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Editable sliders grid */}
                <div className="mt-4 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                  {monthlyProgress.map((pct, i) => (
                    <div key={i} className="text-center space-y-1">
                      <div className="text-[10px] text-muted-foreground">ش{i + 1}</div>
                      <input
                        type="number"
                        value={pct}
                        onChange={(e) => handleMonthEdit(i, parseFloat(e.target.value) || 0)}
                        className="w-full text-center text-xs p-1 rounded border border-border bg-background"
                        min={0}
                        max={30}
                        step={0.5}
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Payment Schedule Table */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  جدول دفعات المقاول
                </CardTitle>
              </CardHeader>
              <CardContent>
                {constructionCost > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-right p-2 font-medium">الشهر</th>
                          <th className="text-right p-2 font-medium">نسبة الإنجاز</th>
                          <th className="text-right p-2 font-medium">الدفعة (درهم)</th>
                          <th className="text-right p-2 font-medium">المدفوع التراكمي</th>
                          <th className="text-right p-2 font-medium">% المدفوع</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* Mobilization row */}
                        <tr className="border-b border-border/50 bg-amber-500/5">
                          <td className="p-2 font-medium">مقدمة</td>
                          <td className="p-2">—</td>
                          <td className="p-2 font-mono">{Math.round(constructionCost * mobilizationPct / 100).toLocaleString()}</td>
                          <td className="p-2 font-mono">{Math.round(constructionCost * mobilizationPct / 100).toLocaleString()}</td>
                          <td className="p-2">{mobilizationPct}%</td>
                        </tr>
                        {paymentSchedule.map((row) => (
                          <tr key={row.month} className="border-b border-border/30 hover:bg-muted/30">
                            <td className="p-2">شهر {row.month}</td>
                            <td className="p-2">{row.progress}%</td>
                            <td className="p-2 font-mono">{row.payment.toLocaleString()}</td>
                            <td className="p-2 font-mono">{row.cumPaid.toLocaleString()}</td>
                            <td className="p-2">{row.cumPaidPct}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground p-8">
                    <p>أدخل مساحة البناء (BUA) وتكلفة الإنشاء في الإدخالات العامة لعرض جدول الدفعات</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </TooltipProvider>
  );
}
