import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Brain, Target, TrendingUp, TrendingDown, ArrowUpDown, Plus,
  BarChart3, Activity, Loader2, CheckCircle2, XCircle, MinusCircle,
  Lightbulb, History, Crosshair, ArrowRight, AlertTriangle
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, ScatterChart, Scatter, ZAxis, Cell, Legend,
  ComposedChart, Area
} from "recharts";

const TYPE_LABELS: Record<string, string> = {
  price_per_sqft: "سعر القدم المربع",
  total_revenue: "إجمالي الإيرادات",
  absorption_rate: "معدل الاستيعاب",
  sell_out_months: "مدة البيع الكامل",
  demand_units: "وحدات الطلب",
  construction_cost: "تكلفة البناء",
  roi: "العائد على الاستثمار",
  irr: "معدل العائد الداخلي",
};

const TYPE_UNITS: Record<string, string> = {
  price_per_sqft: "AED/sqft",
  total_revenue: "AED",
  absorption_rate: "units/year",
  sell_out_months: "months",
  demand_units: "units",
  construction_cost: "AED",
  roi: "%",
  irr: "%",
};

const BIAS_COLORS = {
  over: { bg: "bg-red-50", text: "text-red-600", label: "تقدير مبالغ" },
  under: { bg: "bg-blue-50", text: "text-blue-600", label: "تقدير منخفض" },
  neutral: { bg: "bg-green-50", text: "text-green-600", label: "متوازن" },
};

export default function SelfLearningPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [showRecordDialog, setShowRecordDialog] = useState(false);

  const dashboardQuery = trpc.selfLearning.getAccuracyDashboard.useQuery();
  const projectsQuery = trpc.riskDashboard.getAllProjectRisks.useQuery();
  const metadataQuery = trpc.selfLearning.getMetadata.useQuery();
  const utils = trpc.useUtils();

  const dashboard = dashboardQuery.data;
  const allProjects = projectsQuery.data?.projects || [];

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">نظام التعلم الذاتي</h1>
                <p className="text-sm text-muted-foreground">مقارنة توقعات جويل بالنتائج الفعلية وتحسين الدقة</p>
              </div>
            </div>
            <Button onClick={() => setShowRecordDialog(true)} className="gap-2 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white">
              <Plus className="w-4 h-4" />
              تسجيل نتيجة فعلية
            </Button>
          </div>
        </div>
      </div>

      <div className="container py-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 text-center">
              <Crosshair className="w-6 h-6 mx-auto text-violet-500 mb-2" />
              <p className="text-2xl font-bold">{dashboard?.totalPredictions ?? 0}</p>
              <p className="text-xs text-muted-foreground">إجمالي التوقعات</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 text-center">
              <CheckCircle2 className="w-6 h-6 mx-auto text-green-500 mb-2" />
              <p className="text-2xl font-bold">{dashboard?.totalOutcomes ?? 0}</p>
              <p className="text-xs text-muted-foreground">نتائج فعلية مسجلة</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 text-center">
              <Activity className="w-6 h-6 mx-auto text-blue-500 mb-2" />
              <p className="text-2xl font-bold">{dashboard?.accuracyByType?.length ?? 0}</p>
              <p className="text-xs text-muted-foreground">أنواع تم تقييمها</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 text-center">
              <BarChart3 className="w-6 h-6 mx-auto text-amber-500 mb-2" />
              <p className="text-2xl font-bold">{dashboard?.predictionsByProject?.length ?? 0}</p>
              <p className="text-xs text-muted-foreground">مشاريع بتوقعات</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview" className="gap-1">
              <BarChart3 className="w-4 h-4" /> نظرة عامة
            </TabsTrigger>
            <TabsTrigger value="comparison" className="gap-1">
              <ArrowUpDown className="w-4 h-4" /> مقارنة التوقعات
            </TabsTrigger>
            <TabsTrigger value="accuracy" className="gap-1">
              <Target className="w-4 h-4" /> سجل الدقة
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Accuracy by Type */}
            {dashboard?.accuracyByType && dashboard.accuracyByType.length > 0 ? (
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">دقة التوقعات حسب النوع (MAPE %)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {dashboard.accuracyByType.map((item: any) => {
                      const mape = item.avgMape ?? 0;
                      const accuracy = Math.max(0, 100 - mape);
                      const biasInfo = BIAS_COLORS[item.bias as keyof typeof BIAS_COLORS] || BIAS_COLORS.neutral;

                      return (
                        <div key={item.type} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">{item.label}</span>
                            <div className="flex items-center gap-2">
                              <Badge className={`${biasInfo.bg} ${biasInfo.text} text-xs`}>{biasInfo.label}</Badge>
                              <span className="text-sm font-bold">{accuracy.toFixed(1)}%</span>
                            </div>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${accuracy}%`,
                                backgroundColor: accuracy >= 80 ? "#10b981" : accuracy >= 60 ? "#f59e0b" : "#ef4444",
                              }}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            MAPE: {mape.toFixed(2)}% | عينات: {item.totalSamples}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-0 shadow-sm">
                <CardContent className="py-16 text-center">
                  <Brain className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">لا توجد بيانات دقة بعد</h3>
                  <p className="text-muted-foreground mb-4">
                    شغّل محرك جويل لإنشاء توقعات، ثم سجّل النتائج الفعلية لبدء التعلم
                  </p>
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1 px-3 py-1.5 bg-violet-50 rounded-lg">
                      <Crosshair className="w-4 h-4 text-violet-500" />
                      <span>توقع</span>
                    </div>
                    <ArrowRight className="w-4 h-4" />
                    <div className="flex items-center gap-1 px-3 py-1.5 bg-green-50 rounded-lg">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      <span>نتيجة فعلية</span>
                    </div>
                    <ArrowRight className="w-4 h-4" />
                    <div className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 rounded-lg">
                      <Target className="w-4 h-4 text-blue-500" />
                      <span>تحسين</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Predictions by Project */}
            {dashboard?.predictionsByProject && dashboard.predictionsByProject.length > 0 && (
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">التوقعات حسب المشروع</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={dashboard.predictionsByProject}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="projectName" tick={{ fontSize: 11 }} />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="عدد التوقعات" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Comparison Tab */}
          <TabsContent value="comparison" className="space-y-4">
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex gap-3 items-center">
                  <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                    <SelectTrigger className="w-[250px]">
                      <SelectValue placeholder="اختر مشروع" />
                    </SelectTrigger>
                    <SelectContent>
                      {allProjects.map((p: any) => (
                        <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {selectedProjectId ? (
              <ComparisonView projectId={Number(selectedProjectId)} />
            ) : (
              <Card className="border-0 shadow-sm">
                <CardContent className="py-16 text-center text-muted-foreground">
                  <ArrowUpDown className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>اختر مشروعاً لعرض مقارنة التوقعات بالنتائج الفعلية</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Accuracy Log Tab */}
          <TabsContent value="accuracy" className="space-y-4">
            <AccuracyLogView />
          </TabsContent>
        </Tabs>
      </div>

      {/* Record Outcome Dialog */}
      {showRecordDialog && (
        <RecordOutcomeDialog
          projects={allProjects}
          onClose={() => setShowRecordDialog(false)}
          onSuccess={() => {
            setShowRecordDialog(false);
            utils.selfLearning.getAccuracyDashboard.invalidate();
          }}
        />
      )}
    </div>
  );
}

function ComparisonView({ projectId }: { projectId: number }) {
  const [filterType, setFilterType] = useState<string>("");
  const comparisonQuery = trpc.selfLearning.getComparison.useQuery({
    projectId,
    predictionType: filterType || undefined,
  });

  const data = comparisonQuery.data || [];

  // Chart data
  const chartData = useMemo(() => {
    return data
      .filter((c: any) => c.outcome)
      .map((c: any) => ({
        type: TYPE_LABELS[c.prediction.predictionType] || c.prediction.predictionType,
        predicted: Number(c.prediction.predictedValue),
        actual: Number(c.outcome.actualValue),
        deviation: c.deviationPct,
      }));
  }, [data]);

  if (comparisonQuery.isLoading) {
    return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="كل الأنواع" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الأنواع</SelectItem>
            {Object.entries(TYPE_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Comparison Chart */}
      {chartData.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">التوقع مقابل الفعلي</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="type" tick={{ fontSize: 10 }} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="predicted" fill="#8b5cf6" name="التوقع" radius={[4, 4, 0, 0]} />
                <Bar dataKey="actual" fill="#10b981" name="الفعلي" radius={[4, 4, 0, 0]} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Comparison List */}
      {data.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-12 text-center text-muted-foreground">
            <Crosshair className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>لا توجد توقعات لهذا المشروع</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {data.map((comp: any, i: number) => {
            const pred = comp.prediction;
            const outcome = comp.outcome;
            const devPct = comp.deviationPct;

            return (
              <Card key={i} className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{TYPE_LABELS[pred.predictionType] || pred.predictionType}</Badge>
                        <span className="text-xs text-muted-foreground">{pred.predictionDate}</span>
                      </div>
                      <div className="flex items-center gap-4 mt-2">
                        <div>
                          <p className="text-xs text-muted-foreground">التوقع</p>
                          <p className="font-bold text-violet-600">
                            {Number(pred.predictedValue).toLocaleString()} {pred.predictedUnit || TYPE_UNITS[pred.predictionType]}
                          </p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-muted-foreground" />
                        {outcome ? (
                          <div>
                            <p className="text-xs text-muted-foreground">الفعلي</p>
                            <p className="font-bold text-green-600">
                              {Number(outcome.actualValue).toLocaleString()} {outcome.actualUnit || TYPE_UNITS[pred.predictionType]}
                            </p>
                          </div>
                        ) : (
                          <div>
                            <p className="text-xs text-muted-foreground">الفعلي</p>
                            <p className="text-sm text-muted-foreground">لم يُسجل بعد</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {devPct !== null ? (
                      <div className="text-left">
                        <p className="text-xs text-muted-foreground">الانحراف</p>
                        <p className={`text-lg font-bold ${Math.abs(devPct) <= 10 ? 'text-green-600' : Math.abs(devPct) <= 25 ? 'text-amber-600' : 'text-red-600'}`}>
                          {devPct > 0 ? '+' : ''}{devPct.toFixed(1)}%
                        </p>
                        <Badge className={`text-xs ${
                          comp.direction === 'under' ? 'bg-blue-50 text-blue-600' :
                          comp.direction === 'over' ? 'bg-red-50 text-red-600' :
                          'bg-green-50 text-green-600'
                        }`}>
                          {comp.direction === 'under' ? 'تقدير منخفض' : comp.direction === 'over' ? 'تقدير مبالغ' : 'دقيق'}
                        </Badge>
                      </div>
                    ) : (
                      <Badge variant="outline" className="text-xs">بانتظار النتيجة</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AccuracyLogView() {
  const logQuery = trpc.selfLearning.getAccuracyLog.useQuery({});
  const logs = logQuery.data || [];

  if (logQuery.isLoading) {
    return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  if (logs.length === 0) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="py-16 text-center text-muted-foreground">
          <History className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>لا يوجد سجل دقة بعد</p>
          <p className="text-xs mt-1">سيتم حساب الدقة تلقائياً عند تسجيل نتائج فعلية</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {logs.map((log: any) => {
        const mape = Number(log.mape || 0);
        const accuracy = Math.max(0, 100 - mape);
        const biasInfo = BIAS_COLORS[log.biasDirection as keyof typeof BIAS_COLORS] || BIAS_COLORS.neutral;

        return (
          <Card key={log.id} className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{TYPE_LABELS[log.predictionType] || log.predictionType}</Badge>
                    <Badge className={`${biasInfo.bg} ${biasInfo.text} text-xs`}>{biasInfo.label}</Badge>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-sm">
                    <span>MAPE: <strong>{mape.toFixed(2)}%</strong></span>
                    <span>عينات: <strong>{log.sampleSize}</strong></span>
                    {log.biasAmount && <span>مقدار الانحراف: <strong>{Number(log.biasAmount).toFixed(2)}</strong></span>}
                  </div>
                </div>
                <div className="text-left">
                  <p className={`text-2xl font-bold ${accuracy >= 80 ? 'text-green-600' : accuracy >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                    {accuracy.toFixed(1)}%
                  </p>
                  <p className="text-xs text-muted-foreground">دقة</p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function RecordOutcomeDialog({ projects, onClose, onSuccess }: { projects: any[]; onClose: () => void; onSuccess: () => void }) {
  const [projectId, setProjectId] = useState<string>("");
  const [outcomeType, setOutcomeType] = useState<string>("");
  const [actualValue, setActualValue] = useState("");
  const [recordedDate, setRecordedDate] = useState(new Date().toISOString().slice(0, 10));
  const [source, setSource] = useState("");
  const [notes, setNotes] = useState("");

  const recordMutation = trpc.selfLearning.recordOutcome.useMutation({
    onSuccess: () => {
      toast.success("تم تسجيل النتيجة الفعلية بنجاح");
      onSuccess();
    },
    onError: (err) => toast.error(`فشل التسجيل: ${err.message}`),
  });

  const handleSubmit = () => {
    if (!projectId || !outcomeType || !actualValue || !recordedDate) {
      toast.error("يرجى ملء جميع الحقول المطلوبة");
      return;
    }
    recordMutation.mutate({
      projectId: Number(projectId),
      outcomeType: outcomeType as any,
      actualValue: Number(actualValue),
      recordedDate,
      source: source || undefined,
      notes: notes || undefined,
    });
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
            تسجيل نتيجة فعلية
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div>
            <Label>المشروع *</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger><SelectValue placeholder="اختر مشروع" /></SelectTrigger>
              <SelectContent>
                {projects.map((p: any) => (
                  <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>نوع القياس *</Label>
            <Select value={outcomeType} onValueChange={setOutcomeType}>
              <SelectTrigger><SelectValue placeholder="اختر النوع" /></SelectTrigger>
              <SelectContent>
                {Object.entries(TYPE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v} ({TYPE_UNITS[k]})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>القيمة الفعلية * {outcomeType && `(${TYPE_UNITS[outcomeType]})`}</Label>
            <Input type="number" value={actualValue} onChange={e => setActualValue(e.target.value)} placeholder="أدخل القيمة" />
          </div>

          <div>
            <Label>تاريخ التسجيل *</Label>
            <Input type="date" value={recordedDate} onChange={e => setRecordedDate(e.target.value)} />
          </div>

          <div>
            <Label>المصدر</Label>
            <Input value={source} onChange={e => setSource(e.target.value)} placeholder="مثال: DLD, تقرير مبيعات, CBRE" />
          </div>

          <div>
            <Label>ملاحظات</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="أي ملاحظات إضافية..." rows={3} />
          </div>

          <Button
            className="w-full gap-2"
            onClick={handleSubmit}
            disabled={recordMutation.isPending || !projectId || !outcomeType || !actualValue}
          >
            {recordMutation.isPending ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> جاري التسجيل...</>
            ) : (
              <><CheckCircle2 className="w-4 h-4" /> تسجيل النتيجة</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
