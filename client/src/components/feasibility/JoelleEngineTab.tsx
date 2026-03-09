import { useState, useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Loader2, Sparkles, CheckCircle2, XCircle, Clock, Play, ChevronDown, ChevronUp,
  Brain, Globe, BarChart3, Target, TrendingUp, DollarSign, Users, ShieldCheck,
  FileText, AlertTriangle, Zap, Database, RefreshCw, Eye,
} from "lucide-react";
import { Streamdown } from "streamdown";

const JOEL_AVATAR = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663200809965/mCOkEovAXTtxsABs.png";

// Stage icons and colors
const STAGE_CONFIG: Record<number, { icon: any; color: string; bgColor: string }> = {
  1: { icon: Database, color: "text-blue-600", bgColor: "bg-blue-50" },
  2: { icon: Globe, color: "text-emerald-600", bgColor: "bg-emerald-50" },
  3: { icon: BarChart3, color: "text-purple-600", bgColor: "bg-purple-50" },
  4: { icon: Target, color: "text-red-600", bgColor: "bg-red-50" },
  5: { icon: TrendingUp, color: "text-amber-600", bgColor: "bg-amber-50" },
  6: { icon: Brain, color: "text-indigo-600", bgColor: "bg-indigo-50" },
  7: { icon: DollarSign, color: "text-green-600", bgColor: "bg-green-50" },
  8: { icon: Users, color: "text-cyan-600", bgColor: "bg-cyan-50" },
  9: { icon: AlertTriangle, color: "text-orange-600", bgColor: "bg-orange-50" },
  10: { icon: ShieldCheck, color: "text-teal-600", bgColor: "bg-teal-50" },
  11: { icon: Zap, color: "text-pink-600", bgColor: "bg-pink-50" },
  12: { icon: FileText, color: "text-violet-600", bgColor: "bg-violet-50" },
};

// Stage names in Arabic
const STAGE_NAMES: Record<number, { name: string; desc: string }> = {
  1: { name: "جمع البيانات", desc: "قراءة بطاقة المشروع + بيانات الأرض + الموقع الجغرافي" },
  2: { name: "تحليل سياق المنطقة", desc: "ديموغرافيا + بنية تحتية + مرافق + جاذبية الموقع" },
  3: { name: "تحليل هيكل السوق", desc: "حجم المعاملات + اتجاهات الأسعار + العرض والطلب" },
  4: { name: "خريطة المنافسين", desc: "مشاريع ضمن 1-3 كم + أسعار + مزيج وحدات + سرعة بيع" },
  5: { name: "توقعات الطلب", desc: "حجم الطلب + توزيع حسب النوع + حصة سوقية + مدة البيع" },
  6: { name: "استراتيجية المنتج", desc: "مزيج الوحدات + المساحات + مستوى التشطيب + التموضع" },
  7: { name: "ذكاء التسعير", desc: "3 سيناريوهات + تحليل حساسية + مقارنة بالمنافسين" },
  8: { name: "محرك الامتصاص", desc: "سرعة البيع + خطة السداد + جدول زمني للمبيعات" },
  9: { name: "ذكاء المخاطر", desc: "5 فئات مخاطر + تقييم + استراتيجيات تخفيف" },
  10: { name: "مصالحة البيانات", desc: "تحقق متعدد المصادر + أوزان ترجيح + حدود تباين" },
  11: { name: "توليد المخرجات", desc: "تعبئة حقول النظام تلقائياً من نتائج التحليل" },
  12: { name: "توليد التقارير", desc: "7 تقارير احترافية شاملة" },
};

// Report names
const REPORT_NAMES: Record<string, string> = {
  market_intelligence: "تقرير الاستخبارات السوقية",
  competitive_analysis: "تقرير التحليل التنافسي",
  product_strategy: "تقرير استراتيجية المنتج",
  pricing_strategy: "تقرير استراتيجية التسعير",
  demand_forecast: "تقرير توقعات الطلب",
  risk_analysis: "تقرير تحليل المخاطر",
  executive_summary: "ملخص مجلس الإدارة",
};

type StageStatus = 'pending' | 'running' | 'completed' | 'error';

interface StageState {
  status: StageStatus;
  output: string | null;
  error: string | null;
  startedAt: number | null;
  completedAt: number | null;
}

export default function JoelleEngineTab({ projectId, studyId }: { projectId: number | null; studyId: number | null }) {
  const [stages, setStages] = useState<Record<number, StageState>>({});
  const [expandedStage, setExpandedStage] = useState<number | null>(null);
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [currentRunningStage, setCurrentRunningStage] = useState<number | null>(null);
  const [viewingReport, setViewingReport] = useState<string | null>(null);
  const abortRef = useRef(false);

  // Queries
  const stagesQuery = trpc.joelleEngine.getStages.useQuery(
    projectId || 0,
    { enabled: !!projectId }
  );
  const reportsQuery = trpc.joelleEngine.getReports.useQuery(
    projectId || 0,
    { enabled: !!projectId }
  );

  // Load existing stages from DB
  useEffect(() => {
    if (stagesQuery.data) {
      const stageMap: Record<number, StageState> = {};
      for (const s of stagesQuery.data) {
        stageMap[s.stageNumber] = {
          status: s.stageStatus as StageStatus,
          output: s.stageOutput,
          error: s.errorMessage,
          startedAt: s.startedAt ? new Date(s.startedAt).getTime() : null,
          completedAt: s.completedAt ? new Date(s.completedAt).getTime() : null,
        };
      }
      setStages(stageMap);
    }
  }, [stagesQuery.data]);

  // Engine mutations
  const engine1 = trpc.joelleEngine.runEngine1.useMutation();
  const engine2 = trpc.joelleEngine.runEngine2.useMutation();
  const engine3 = trpc.joelleEngine.runEngine3.useMutation();
  const engine4 = trpc.joelleEngine.runEngine4.useMutation();
  const engine5 = trpc.joelleEngine.runEngine5.useMutation();
  const engine6 = trpc.joelleEngine.runEngine6.useMutation();
  const engine7 = trpc.joelleEngine.runEngine7.useMutation();
  const engine8 = trpc.joelleEngine.runEngine8.useMutation();
  const engine9 = trpc.joelleEngine.runEngine9.useMutation();
  const engine10 = trpc.joelleEngine.runEngine10.useMutation();
  const engine11 = trpc.joelleEngine.runEngine11.useMutation();
  const engine12 = trpc.joelleEngine.runEngine12.useMutation();

  const engines = [engine1, engine2, engine3, engine4, engine5, engine6, engine7, engine8, engine9, engine10, engine11, engine12];

  // Run a single engine
  const runEngine = useCallback(async (stageNumber: number): Promise<boolean> => {
    if (!projectId) return false;
    setStages(prev => ({
      ...prev,
      [stageNumber]: { status: 'running', output: null, error: null, startedAt: Date.now(), completedAt: null },
    }));
    setCurrentRunningStage(stageNumber);
    setExpandedStage(stageNumber);

    try {
      const result = await engines[stageNumber - 1].mutateAsync(projectId);
      setStages(prev => ({
        ...prev,
        [stageNumber]: {
          status: 'completed',
          output: result.output,
          error: null,
          startedAt: prev[stageNumber]?.startedAt || Date.now(),
          completedAt: Date.now(),
        },
      }));
      return true;
    } catch (err: any) {
      setStages(prev => ({
        ...prev,
        [stageNumber]: {
          status: 'error',
          output: null,
          error: err.message || 'خطأ غير معروف',
          startedAt: prev[stageNumber]?.startedAt || Date.now(),
          completedAt: Date.now(),
        },
      }));
      return false;
    }
  }, [projectId, engines]);

  // Run all engines sequentially
  const runAllEngines = useCallback(async () => {
    if (!projectId) return;
    setIsRunningAll(true);
    abortRef.current = false;

    for (let i = 1; i <= 12; i++) {
      if (abortRef.current) {
        toast.info(`تم إيقاف التشغيل عند المحرك ${i}`);
        break;
      }
      const success = await runEngine(i);
      if (!success) {
        toast.error(`فشل المحرك ${i}: ${STAGE_NAMES[i].name}`);
        // Continue to next engine even on failure
      }
    }

    setIsRunningAll(false);
    setCurrentRunningStage(null);
    stagesQuery.refetch();
    reportsQuery.refetch();
    toast.success("اكتمل تشغيل جميع المحركات");
  }, [projectId, runEngine]);

  // Stop running
  const stopRunning = () => {
    abortRef.current = true;
    setIsRunningAll(false);
    setCurrentRunningStage(null);
  };

  // Get completion stats
  const completedCount = Object.values(stages).filter(s => s.status === 'completed').length;
  const errorCount = Object.values(stages).filter(s => s.status === 'error').length;
  const progress = (completedCount / 12) * 100;

  if (!projectId) {
    return (
      <div className="text-center py-16 bg-muted/20 rounded-xl border border-dashed border-border">
        <Brain className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
        <p className="text-sm font-medium text-muted-foreground">اختر مشروع لتشغيل محرك جويل</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header Card */}
      <Card className="border-2 border-primary/20 bg-gradient-to-l from-purple-50/50 to-pink-50/50">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <img src={JOEL_AVATAR} alt="Joelle" className="w-14 h-14 rounded-full border-2 border-primary/30 shadow-md" />
              <div>
                <h2 className="text-xl font-bold text-foreground">محرك جويل للذكاء السوقي</h2>
                <p className="text-sm text-muted-foreground">12 محرك تحليلي • 7 تقارير احترافية • تحقق متعدد المصادر</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isRunningAll ? (
                <Button variant="destructive" onClick={stopRunning} className="gap-2">
                  <XCircle className="w-4 h-4" />
                  إيقاف
                </Button>
              ) : (
                <Button onClick={runAllEngines} className="gap-2 bg-gradient-to-l from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700" disabled={!projectId}>
                  <Play className="w-4 h-4" />
                  تشغيل جميع المحركات
                </Button>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">التقدم: {completedCount}/12 محرك</span>
              <div className="flex items-center gap-3">
                {completedCount > 0 && (
                  <span className="text-emerald-600 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> {completedCount} مكتمل
                  </span>
                )}
                {errorCount > 0 && (
                  <span className="text-red-600 font-medium flex items-center gap-1">
                    <XCircle className="w-3 h-3" /> {errorCount} خطأ
                  </span>
                )}
              </div>
            </div>
            <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-l from-purple-500 to-pink-500 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Engines Grid */}
      <div className="space-y-2">
        {Array.from({ length: 12 }, (_, i) => i + 1).map(stageNum => {
          const config = STAGE_CONFIG[stageNum];
          const info = STAGE_NAMES[stageNum];
          const state = stages[stageNum];
          const Icon = config.icon;
          const isExpanded = expandedStage === stageNum;
          const isRunning = state?.status === 'running';
          const isCompleted = state?.status === 'completed';
          const isError = state?.status === 'error';
          const engineMutation = engines[stageNum - 1];

          return (
            <Card
              key={stageNum}
              className={`transition-all duration-200 ${
                isRunning ? 'border-primary/50 shadow-md ring-2 ring-primary/20' :
                isCompleted ? 'border-emerald-200' :
                isError ? 'border-red-200' :
                'border-border hover:border-border/80'
              }`}
            >
              <CardContent className="p-0">
                {/* Stage Header */}
                <div
                  className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setExpandedStage(isExpanded ? null : stageNum)}
                >
                  {/* Stage Number & Icon */}
                  <div className={`w-10 h-10 rounded-xl ${config.bgColor} flex items-center justify-center shrink-0`}>
                    {isRunning ? (
                      <Loader2 className={`w-5 h-5 ${config.color} animate-spin`} />
                    ) : (
                      <Icon className={`w-5 h-5 ${config.color}`} />
                    )}
                  </div>

                  {/* Stage Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-muted-foreground">محرك {stageNum}</span>
                      <h3 className="text-sm font-bold text-foreground">{info.name}</h3>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{info.desc}</p>
                  </div>

                  {/* Status Badge */}
                  <div className="flex items-center gap-2 shrink-0">
                    {isRunning && (
                      <span className="text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full font-medium flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" /> جاري التحليل...
                      </span>
                    )}
                    {isCompleted && (
                      <span className="text-xs bg-emerald-50 text-emerald-600 px-2.5 py-1 rounded-full font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> مكتمل
                      </span>
                    )}
                    {isError && (
                      <span className="text-xs bg-red-50 text-red-600 px-2.5 py-1 rounded-full font-medium flex items-center gap-1">
                        <XCircle className="w-3 h-3" /> خطأ
                      </span>
                    )}
                    {!state && (
                      <span className="text-xs bg-muted text-muted-foreground px-2.5 py-1 rounded-full font-medium flex items-center gap-1">
                        <Clock className="w-3 h-3" /> في الانتظار
                      </span>
                    )}

                    {/* Run Single Engine Button */}
                    {!isRunning && !isRunningAll && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          runEngine(stageNum);
                        }}
                        disabled={engineMutation.isPending}
                      >
                        {isCompleted ? <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" /> : <Play className="w-3.5 h-3.5 text-primary" />}
                      </Button>
                    )}

                    {/* Expand/Collapse */}
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="border-t border-border px-4 pb-4 pt-3">
                    {state?.output ? (
                      <div className="prose prose-sm max-w-none bg-muted/20 rounded-xl p-4 border border-border" dir="rtl">
                        <Streamdown>{state.output}</Streamdown>
                      </div>
                    ) : state?.error ? (
                      <div className="bg-red-50 rounded-xl p-4 border border-red-200">
                        <p className="text-sm text-red-600 font-medium">خطأ: {state.error}</p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-2 gap-1 text-red-600 border-red-200 hover:bg-red-50"
                          onClick={() => runEngine(stageNum)}
                        >
                          <RefreshCw className="w-3 h-3" /> إعادة المحاولة
                        </Button>
                      </div>
                    ) : isRunning ? (
                      <div className="flex items-center justify-center py-8 gap-3">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                        <span className="text-sm text-muted-foreground">جويل تحلل البيانات...</span>
                      </div>
                    ) : (
                      <div className="text-center py-6 text-muted-foreground">
                        <p className="text-sm">لم يتم تشغيل هذا المحرك بعد</p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-2 gap-1"
                          onClick={() => runEngine(stageNum)}
                        >
                          <Play className="w-3 h-3" /> تشغيل المحرك
                        </Button>
                      </div>
                    )}

                    {/* Timing info */}
                    {state?.startedAt && state?.completedAt && (
                      <div className="mt-2 text-[10px] text-muted-foreground/60 text-left" dir="ltr">
                        Duration: {((state.completedAt - state.startedAt) / 1000).toFixed(1)}s
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Reports Section */}
      <Card className="border-2 border-violet-200/50">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 mb-4 pb-3 border-b border-border">
            <div className="w-9 h-9 rounded-lg bg-violet-100 flex items-center justify-center">
              <FileText className="w-4.5 h-4.5 text-violet-600" />
            </div>
            <div>
              <h3 className="font-bold text-foreground">تقارير جويل</h3>
              <p className="text-xs text-muted-foreground">7 تقارير احترافية مُنشأة من التحليل</p>
            </div>
          </div>

          {reportsQuery.data && reportsQuery.data.length > 0 ? (
            <div className="space-y-2">
              {reportsQuery.data.map((report: any) => (
                <div
                  key={report.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/20 transition-colors cursor-pointer"
                  onClick={() => setViewingReport(viewingReport === report.reportType ? null : report.reportType)}
                >
                  <div className="flex items-center gap-3">
                    <FileText className="w-4 h-4 text-violet-500" />
                    <div>
                      <p className="text-sm font-medium">{REPORT_NAMES[report.reportType] || report.reportTitle}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(report.generatedAt).toLocaleDateString('ar-AE', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-muted-foreground" />
                    {viewingReport === report.reportType ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>
              ))}

              {/* Report Content Viewer */}
              {viewingReport && (() => {
                const report = reportsQuery.data.find((r: any) => r.reportType === viewingReport);
                if (!report) return null;
                return (
                  <div className="mt-3 prose prose-sm max-w-none bg-muted/20 rounded-xl p-6 border border-border" dir="rtl">
                    <Streamdown>{report.reportContent}</Streamdown>
                  </div>
                );
              })()}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-sm">لم تُنشأ تقارير بعد</p>
              <p className="text-xs text-muted-foreground/70 mt-1">شغّل جميع المحركات لإنشاء التقارير السبعة</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
