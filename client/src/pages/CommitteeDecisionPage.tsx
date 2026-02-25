import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Streamdown } from "streamdown";
import {
  Trophy, DollarSign, Scale, Brain, Shield, AlertTriangle,
  CheckCircle2, ArrowLeft, Gavel, TrendingUp, TrendingDown,
  BarChart3, FileText, Sparkles, Crown, Target, Minus,
  ChevronUp, ChevronDown, Info, Loader2
} from "lucide-react";
import { Link } from "wouter";

// Fee Deviation Zone definitions
const FEE_ZONES = {
  EXTREME_LOW: { label: "خطر رسوم منخفضة", color: "text-blue-600 bg-blue-50 border-blue-200", icon: TrendingDown, penalty: 0, flag: "Low Fee Risk" },
  NORMAL: { label: "نطاق طبيعي", color: "text-green-600 bg-green-50 border-green-200", icon: CheckCircle2, penalty: 0, flag: null },
  MODERATE_HIGH: { label: "انحراف معتدل", color: "text-amber-600 bg-amber-50 border-amber-200", icon: TrendingUp, penalty: 7, flag: null },
  EXTREME_HIGH: { label: "خطر تكلفة عالية", color: "text-red-600 bg-red-50 border-red-200", icon: AlertTriangle, penalty: 15, flag: "High Cost Risk" },
} as const;

type FeeZoneKey = keyof typeof FEE_ZONES;

function calculateFeeZone(fee: number, avgFee: number): { zone: FeeZoneKey; deviation: number } {
  if (avgFee === 0) return { zone: "NORMAL", deviation: 0 };
  const deviation = ((fee - avgFee) / avgFee) * 100;
  if (deviation <= -30) return { zone: "EXTREME_LOW", deviation };
  if (deviation >= 30) return { zone: "EXTREME_HIGH", deviation };
  if (deviation >= 15) return { zone: "MODERATE_HIGH", deviation };
  return { zone: "NORMAL", deviation };
}

// Decision basis options
const DECISION_BASIS_OPTIONS = [
  { value: "highest_technical", label: "أعلى تقييم فني", icon: Trophy, description: "اختيار الاستشاري الأعلى في التقييم الفني" },
  { value: "best_value", label: "أفضل قيمة مقابل السعر", icon: Target, description: "أفضل توازن بين الجودة الفنية والأتعاب" },
  { value: "lowest_fee", label: "أقل أتعاب", icon: DollarSign, description: "اختيار الاستشاري الأقل تكلفة" },
  { value: "negotiated", label: "بعد التفاوض", icon: Scale, description: "اختيار مبني على نتائج التفاوض مع الاستشاري" },
  { value: "other", label: "أسباب أخرى", icon: FileText, description: "قرار مبني على اعتبارات خاصة باللجنة" },
];

export default function CommitteeDecisionPage() {
  const { user } = useAuth();


  // Data queries
  const projectsQuery = trpc.projects.list.useQuery();
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const consultantsQuery = trpc.projects.getConsultants.useQuery(
    { projectId: Number(selectedProjectId) },
    { enabled: !!selectedProjectId }
  );
  const scoresQuery = trpc.evaluatorScores.getByProject.useQuery(
    { projectId: Number(selectedProjectId) },
    { enabled: !!selectedProjectId }
  );
  const feesQuery = trpc.fees.getByProject.useQuery(
    { projectId: Number(selectedProjectId) },
    { enabled: !!selectedProjectId }
  );
  const decisionQuery = trpc.committee.getDecision.useQuery(
    { projectId: Number(selectedProjectId) },
    { enabled: !!selectedProjectId }
  );
  const criteriaQuery = trpc.evaluatorScores.getCriteria.useQuery();
  const feeDeviationQuery = trpc.committee.getFeeDeviation.useQuery(
    { projectId: Number(selectedProjectId) },
    { enabled: !!selectedProjectId }
  );

  // Mutations
  const utils = trpc.useUtils();
  const saveDecisionMut = trpc.committee.saveDecision.useMutation({
    onSuccess: () => {
      utils.committee.getDecision.invalidate({ projectId: Number(selectedProjectId) });
      toast.success("تم حفظ القرار بنجاح");
    },
    onError: (err) => toast.error(err.message || "خطأ"),
  });
  const confirmDecisionMut = trpc.committee.confirmDecision.useMutation({
    onSuccess: () => {
      utils.committee.getDecision.invalidate({ projectId: Number(selectedProjectId) });
      toast.success("تم تأكيد القرار النهائي");
      setShowConfirmDialog(false);
    },
    onError: (err) => toast.error(err.message || "خطأ"),
  });
  const aiAnalysisMut = trpc.committee.generateAiAnalysis.useMutation({
    onSuccess: (data) => {
      setAiAnalysis(data.analysis);
      toast.success("تم إنشاء التحليل الذكي");
    },
    onError: (err) => toast.error(err.message || "خطأ"),
  });
  const postDecisionAiMut = trpc.committee.postDecisionAnalysis.useMutation({
    onSuccess: (data) => {
      setPostDecisionAnalysis(data.analysis);
      toast.success("تم تحليل القرار");
    },
    onError: (err) => toast.error(err.message || "خطأ"),
  });

  // Local state
  const [selectedConsultantId, setSelectedConsultantId] = useState<string>("");
  const [decisionBasis, setDecisionBasis] = useState<string>("");
  const [justification, setJustification] = useState("");
  const [negotiationNotes, setNegotiationNotes] = useState("");
  const [targetFee, setTargetFee] = useState("");
  const [aiAnalysis, setAiAnalysis] = useState<string>("");
  const [postDecisionAnalysis, setPostDecisionAnalysis] = useState<string>("");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [activeTab, setActiveTab] = useState("ranking");

  // Computed data
  const projects = projectsQuery.data || [];
  const consultants = consultantsQuery.data || [];
  const scores = scoresQuery.data || [];
  const fees = feesQuery.data || [];
  const criteria = criteriaQuery.data || [];
  const decision = decisionQuery.data;
  const feeDeviation = feeDeviationQuery.data;

  // Calculate technical rankings
  const rankings = useMemo(() => {
    if (!consultants.length || !scores.length || !criteria.length) return [];

    return consultants.map((c: any) => {
      const consultantScores = scores.filter((s: any) => s.consultantId === c.consultantId);
      const consultantFee = fees.find((f: any) => f.consultantId === c.consultantId);

      // Calculate weighted average per criterion across evaluators
      let totalWeightedScore = 0;
      let totalWeight = 0;

      // Filter out fee-related criteria
      const technicalCriteria = criteria.filter((cr: any) =>
        !cr.name?.toLowerCase().includes("fee") &&
        !cr.name?.toLowerCase().includes("أتعاب") &&
        !cr.name?.toLowerCase().includes("سعر") &&
        !cr.name?.toLowerCase().includes("price") &&
        !cr.name?.toLowerCase().includes("cost") &&
        !cr.name?.toLowerCase().includes("تكلفة")
      );

      technicalCriteria.forEach((criterion: any) => {
        const criterionScores = consultantScores.filter((s: any) => s.criterionId === criterion.id);
        if (criterionScores.length > 0) {
          const avgScore = criterionScores.reduce((sum: number, s: any) => sum + (s.score || 0), 0) / criterionScores.length;
          totalWeightedScore += avgScore * (criterion.weight / 100);
          totalWeight += criterion.weight;
        }
      });

      const technicalScore = totalWeight > 0 ? (totalWeightedScore / totalWeight) * 100 : 0;
      const fee = consultantFee?.totalFee || consultantFee?.fee || 0;

      // Fee zone calculation
      const avgFee = feeDeviation?.averageFee || 0;
      const feeZoneInfo = calculateFeeZone(fee, avgFee);

      const feeZoneDef = FEE_ZONES[feeZoneInfo.zone];

      return {
        consultantId: c.consultantId,
        consultantName: c.consultant?.name || c.consultant?.companyName || `استشاري ${c.consultantId}`,
        technicalScore: Math.round(technicalScore * 10) / 10,
        fee,
        feeZone: feeZoneInfo.zone,
        feeDeviation: Math.round(feeZoneInfo.deviation * 10) / 10,
        penalty: feeZoneDef.penalty,
        flag: feeZoneDef.flag,
      };
    }).sort((a: any, b: any) => b.technicalScore - a.technicalScore);
  }, [consultants, scores, fees, criteria, feeDeviation]);

  // Calculate Value Scores with correct formula
  const valueRankings = useMemo(() => {
    if (!rankings.length) return [];
    const feesWithValues = rankings.filter(r => r.fee > 0);
    const lowestFee = feesWithValues.length > 0 ? Math.min(...feesWithValues.map(r => r.fee)) : 0;
    const T_WEIGHT = 80; // Technical weight %
    const F_WEIGHT = 20; // Financial weight %

    return rankings.map(r => {
      // Financial Score = (Lowest Fee / Consultant Fee) × 100
      const financialScore = r.fee > 0 && lowestFee > 0 ? (lowestFee / r.fee) * 100 : 0;
      // Adjusted Financial Score = Financial Score - Penalty (points)
      const adjustedFinancialScore = Math.max(0, financialScore - r.penalty);
      // Value Score = (Technical × T%) + (Adjusted Financial × F%)
      const valueScore = (r.technicalScore * T_WEIGHT / 100) + (adjustedFinancialScore * F_WEIGHT / 100);

      return {
        ...r,
        financialScore: Math.round(financialScore * 10) / 10,
        adjustedFinancialScore: Math.round(adjustedFinancialScore * 10) / 10,
        valueScore: Math.round(valueScore * 10) / 10,
      };
    }).sort((a, b) => b.valueScore - a.valueScore);
  }, [rankings]);

  // Load existing decision data
  useMemo(() => {
    if (decision) {
      setSelectedConsultantId(decision.selectedConsultantId?.toString() || "");
      setDecisionBasis(decision.decisionBasis || "");
      setJustification(decision.justification || "");
      setNegotiationNotes(decision.negotiationNotes || "");
      setTargetFee(decision.targetFee?.toString() || "");
    }
  }, [decision]);

  const isConfirmed = decision?.isConfirmed === 1;

  const handleSaveDecision = () => {
    if (!selectedProjectId || !selectedConsultantId || !decisionBasis) {
      toast.error("يرجى اختيار الاستشاري وأساس القرار");
      return;
    }
    saveDecisionMut.mutate({
      projectId: Number(selectedProjectId),
      selectedConsultantId: Number(selectedConsultantId),
      decisionBasis,
      justification,
      negotiationNotes,
      targetFee: targetFee ? Number(targetFee) : undefined,
    });
  };

  const handleConfirmDecision = () => {
    if (!selectedProjectId) return;
    confirmDecisionMut.mutate({ projectId: Number(selectedProjectId) });
  };

  const handleGenerateAiAnalysis = () => {
    if (!selectedProjectId) return;
    aiAnalysisMut.mutate({ projectId: Number(selectedProjectId) });
  };

  const handlePostDecisionAnalysis = () => {
    if (!selectedProjectId) return;
    postDecisionAiMut.mutate({ projectId: Number(selectedProjectId) });
  };

  const selectedProject = projects.find((p: any) => p.id === Number(selectedProjectId));

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white" dir="rtl">
      {/* Header */}
      <div className="bg-gradient-to-l from-slate-900 via-slate-800 to-slate-900 text-white">
        <div className="container py-8">
          <div className="flex items-center gap-4 mb-6">
            <Link href="/evaluation">
              <Button variant="ghost" size="sm" className="text-white/70 hover:text-white hover:bg-white/10">
                <ArrowLeft className="h-4 w-4 ml-2" />
                العودة للتقييم
              </Button>
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-500/20 rounded-xl">
              <Gavel className="h-8 w-8 text-amber-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">قرار اللجنة النهائي</h1>
              <p className="text-white/60 mt-1">التصنيف الفني • تحليل الأتعاب • القرار السيادي للجنة</p>
            </div>
          </div>

          {/* Project Selector */}
          <div className="mt-6 max-w-md">
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
              <SelectTrigger className="bg-white/10 border-white/20 text-white">
                <SelectValue placeholder="اختر المشروع..." />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p: any) => (
                  <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {!selectedProjectId ? (
        <div className="container py-20 text-center">
          <Gavel className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-xl text-muted-foreground">اختر مشروعاً لعرض قرار اللجنة</p>
        </div>
      ) : (
        <div className="container py-8">
          {/* Decision Philosophy Banner */}
          <Card className="mb-6 border-amber-200 bg-amber-50/50">
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold text-amber-900">فلسفة القرار</p>
                  <p className="text-sm text-amber-700 mt-1">
                    التقييم الفني مستقل 100% عن الأتعاب • التصنيف مرجعي وليس ملزماً •
                    للجنة حرية اختيار أي استشاري بشرط توثيق المبررات •
                    الذكاء الاصطناعي يدعم التحليل ولا يفرض قرارات
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {isConfirmed && (
            <Card className="mb-6 border-green-300 bg-green-50">
              <CardContent className="py-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-6 w-6 text-green-600" />
                  <div>
                    <p className="font-bold text-green-800 text-lg">تم تأكيد القرار النهائي</p>
                    <p className="text-sm text-green-600">
                      الاستشاري المختار: {rankings.find(r => r.consultantId === decision?.selectedConsultantId)?.consultantName || "—"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-4 mb-6 h-auto">
              <TabsTrigger value="ranking" className="flex flex-col gap-1 py-3">
                <BarChart3 className="h-4 w-4" />
                <span className="text-xs">التصنيف والأتعاب</span>
              </TabsTrigger>
              <TabsTrigger value="ai-analysis" className="flex flex-col gap-1 py-3">
                <Brain className="h-4 w-4" />
                <span className="text-xs">تحليل ذكي</span>
              </TabsTrigger>
              <TabsTrigger value="decision" className="flex flex-col gap-1 py-3">
                <Gavel className="h-4 w-4" />
                <span className="text-xs">القرار</span>
              </TabsTrigger>
              <TabsTrigger value="post-analysis" className="flex flex-col gap-1 py-3">
                <Sparkles className="h-4 w-4" />
                <span className="text-xs">تحليل ما بعد القرار</span>
              </TabsTrigger>
            </TabsList>

            {/* Tab 1: Rankings & Fees */}
            <TabsContent value="ranking" className="space-y-6">
              {/* Technical Ranking */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-amber-500" />
                    التصنيف الفني
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {rankings.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">لا توجد تقييمات بعد</p>
                  ) : (
                    <div className="space-y-3">
                      {rankings.map((r, idx) => (
                        <div
                          key={r.consultantId}
                          className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
                            idx === 0 ? "bg-amber-50 border-amber-200 shadow-sm" :
                            idx === 1 ? "bg-slate-50 border-slate-200" :
                            idx === 2 ? "bg-orange-50/50 border-orange-200" :
                            "bg-white border-border"
                          }`}
                        >
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${
                            idx === 0 ? "bg-amber-500 text-white" :
                            idx === 1 ? "bg-slate-400 text-white" :
                            idx === 2 ? "bg-orange-400 text-white" :
                            "bg-muted text-muted-foreground"
                          }`}>
                            {idx + 1}
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-lg">{r.consultantName}</p>
                            <div className="flex items-center gap-4 mt-1">
                              {r.flag && (
                                <Badge variant="outline" className={
                                  r.flag === "High Cost Risk" ? "text-red-600 border-red-300 bg-red-50" :
                                  "text-blue-600 border-blue-300 bg-blue-50"
                                }>
                                  <AlertTriangle className="h-3 w-3 ml-1" />
                                  {r.flag === "High Cost Risk" ? "خطر تكلفة عالية" : "خطر رسوم منخفضة"}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="text-left space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground">فني:</span>
                              <span className="font-bold text-xl">{r.technicalScore}%</span>
                            </div>
                            {r.fee > 0 && (
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground">أتعاب:</span>
                                <span className="font-semibold">{r.fee.toLocaleString()} AED</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Fee Deviation Analysis */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Scale className="h-5 w-5 text-purple-500" />
                    تحليل انحراف الأتعاب
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {feeDeviation && (
                    <div className="mb-4 p-4 bg-slate-50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">متوسط الأتعاب</span>
                        <span className="font-bold text-lg">{Math.round(feeDeviation.averageFee).toLocaleString()} AED</span>
                      </div>
                    </div>
                  )}
                  <div className="space-y-3">
                    {rankings.map((r) => {
                      const zone = FEE_ZONES[r.feeZone];
                      const ZoneIcon = zone.icon;
                      return (
                        <div key={r.consultantId} className={`flex items-center gap-4 p-4 rounded-lg border ${zone.color}`}>
                          <ZoneIcon className="h-5 w-5 shrink-0" />
                          <div className="flex-1">
                            <p className="font-semibold">{r.consultantName}</p>
                            <p className="text-sm opacity-80">{zone.label}</p>
                          </div>
                          <div className="text-left">
                            <p className="font-bold">{r.fee > 0 ? `${r.fee.toLocaleString()} AED` : "—"}</p>
                            <div className="flex items-center gap-1 text-sm">
                              {r.feeDeviation > 0 ? <ChevronUp className="h-3 w-3" /> : r.feeDeviation < 0 ? <ChevronDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                              <span>{Math.abs(r.feeDeviation)}%</span>
                            </div>
                          </div>
                          {zone.penalty > 0 && (
                            <Badge variant="outline" className="text-xs">
                              عقوبة: −{zone.penalty} نقطة
                            </Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Zone Legend */}
                  <div className="mt-6 p-4 bg-muted/30 rounded-lg">
                    <p className="font-semibold text-sm mb-3 flex items-center gap-2">
                      <Info className="h-4 w-4" />
                      دليل مناطق الانحراف
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex items-center gap-2 p-2 rounded bg-green-50 border border-green-200">
                        <CheckCircle2 className="h-3 w-3 text-green-600" />
                        <span>نطاق طبيعي (±15%): بدون خصم</span>
                      </div>
                      <div className="flex items-center gap-2 p-2 rounded bg-amber-50 border border-amber-200">
                        <TrendingUp className="h-3 w-3 text-amber-600" />
                        <span>انحراف معتدل (+15-30%): عقوبة −7 نقاط</span>
                      </div>
                      <div className="flex items-center gap-2 p-2 rounded bg-red-50 border border-red-200">
                        <AlertTriangle className="h-3 w-3 text-red-600" />
                        <span>تكلفة عالية (+30%+): عقوبة −15 نقطة</span>
                      </div>
                      <div className="flex items-center gap-2 p-2 rounded bg-blue-50 border border-blue-200">
                        <TrendingDown className="h-3 w-3 text-blue-600" />
                        <span>رسوم منخفضة (-30%): بدون خصم + تنبيه</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Value Score Comparison */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-emerald-500" />
                    تصنيف القيمة (مرجعي فقط)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                    <p className="text-xs text-amber-700">
                      <span className="font-bold">الصيغة:</span> Value Score = (فني × 80%) + (مالي معدل × 20%) — هذا التصنيف مرجعي فقط ولا يلزم اللجنة.
                    </p>
                  </div>
                  <div className="space-y-3">
                    {valueRankings.map((r, idx) => (
                      <div key={r.consultantId} className="flex items-center gap-4 p-4 rounded-lg border bg-white">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                          idx === 0 ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"
                        }`}>
                          {idx + 1}
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold">{r.consultantName}</p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            <span>مالي: {r.financialScore}</span>
                            {r.penalty > 0 && <span className="text-red-500">عقوبة: −{r.penalty}</span>}
                            <span>معدل: {r.adjustedFinancialScore}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-6 text-sm">
                          <div>
                            <span className="text-muted-foreground">فني: </span>
                            <span className="font-semibold">{r.technicalScore}%</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">قيمة: </span>
                            <span className="font-bold text-lg text-emerald-600">{r.valueScore}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab 2: AI Analysis */}
            <TabsContent value="ai-analysis" className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Brain className="h-5 w-5 text-purple-500" />
                      التحليل الذكي الشامل
                    </CardTitle>
                    <Button
                      onClick={handleGenerateAiAnalysis}
                      disabled={aiAnalysisMut.isPending}
                      className="bg-purple-600 hover:bg-purple-700"
                    >
                      {aiAnalysisMut.isPending ? (
                        <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4 ml-2" />
                      )}
                      {aiAnalysisMut.isPending ? "جاري التحليل..." : "إنشاء تحليل ذكي"}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {aiAnalysis ? (
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                      <Streamdown>{aiAnalysis}</Streamdown>
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <Brain className="h-16 w-16 mx-auto text-muted-foreground/20 mb-4" />
                      <p className="text-muted-foreground">
                        اضغط "إنشاء تحليل ذكي" للحصول على تحليل شامل يشمل:
                      </p>
                      <div className="mt-4 grid grid-cols-2 gap-3 max-w-lg mx-auto text-sm text-muted-foreground">
                        <div className="flex items-center gap-2 p-2 bg-muted/30 rounded">
                          <Trophy className="h-4 w-4 text-amber-500" />
                          مقارنة فنية تفصيلية
                        </div>
                        <div className="flex items-center gap-2 p-2 bg-muted/30 rounded">
                          <DollarSign className="h-4 w-4 text-green-500" />
                          تحليل الأتعاب والانحرافات
                        </div>
                        <div className="flex items-center gap-2 p-2 bg-muted/30 rounded">
                          <Target className="h-4 w-4 text-blue-500" />
                          تقييم القيمة مقابل السعر
                        </div>
                        <div className="flex items-center gap-2 p-2 bg-muted/30 rounded">
                          <Shield className="h-4 w-4 text-purple-500" />
                          توصيات وملاحظات
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab 3: Committee Decision */}
            <TabsContent value="decision" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Gavel className="h-5 w-5 text-slate-700" />
                    قرار اللجنة
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Select Consultant */}
                  <div>
                    <label className="block text-sm font-semibold mb-2">الاستشاري المختار</label>
                    <Select value={selectedConsultantId} onValueChange={setSelectedConsultantId} disabled={isConfirmed}>
                      <SelectTrigger className="h-12">
                        <SelectValue placeholder="اختر الاستشاري..." />
                      </SelectTrigger>
                      <SelectContent>
                        {rankings.map((r) => (
                          <SelectItem key={r.consultantId} value={r.consultantId.toString()}>
                            <div className="flex items-center gap-3">
                              <span>{r.consultantName}</span>
                              <Badge variant="outline" className="text-xs">فني: {r.technicalScore}%</Badge>
                              {r.fee > 0 && <Badge variant="outline" className="text-xs">{r.fee.toLocaleString()} AED</Badge>}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Decision Basis */}
                  <div>
                    <label className="block text-sm font-semibold mb-3">أساس القرار</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {DECISION_BASIS_OPTIONS.map((opt) => {
                        const OptIcon = opt.icon;
                        const isSelected = decisionBasis === opt.value;
                        return (
                          <button
                            key={opt.value}
                            onClick={() => !isConfirmed && setDecisionBasis(opt.value)}
                            disabled={isConfirmed}
                            className={`p-4 rounded-xl border-2 text-right transition-all ${
                              isSelected
                                ? "border-primary bg-primary/5 shadow-sm"
                                : "border-border hover:border-primary/30 hover:bg-muted/30"
                            } ${isConfirmed ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
                          >
                            <OptIcon className={`h-5 w-5 mb-2 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                            <p className="font-semibold text-sm">{opt.label}</p>
                            <p className="text-xs text-muted-foreground mt-1">{opt.description}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Justification */}
                  <div>
                    <label className="block text-sm font-semibold mb-2">مبررات القرار</label>
                    <Textarea
                      value={justification}
                      onChange={(e) => setJustification(e.target.value)}
                      placeholder="اكتب مبررات اللجنة لاختيار هذا الاستشاري..."
                      rows={4}
                      disabled={isConfirmed}
                      className="text-base"
                    />
                  </div>

                  {/* Negotiation Notes */}
                  {(decisionBasis === "negotiated" || decisionBasis === "best_value") && (
                    <div className="space-y-4 p-4 bg-blue-50 rounded-xl border border-blue-200">
                      <p className="font-semibold text-blue-900 flex items-center gap-2">
                        <Scale className="h-4 w-4" />
                        ملاحظات التفاوض
                      </p>
                      <div>
                        <label className="block text-sm font-medium mb-1 text-blue-800">الأتعاب المستهدفة بعد التفاوض</label>
                        <input
                          type="number"
                          value={targetFee}
                          onChange={(e) => setTargetFee(e.target.value)}
                          placeholder="المبلغ بالدرهم..."
                          disabled={isConfirmed}
                          className="w-full p-3 rounded-lg border border-blue-300 bg-white text-base"
                        />
                      </div>
                      <Textarea
                        value={negotiationNotes}
                        onChange={(e) => setNegotiationNotes(e.target.value)}
                        placeholder="تفاصيل التفاوض وشروطه..."
                        rows={3}
                        disabled={isConfirmed}
                      />
                    </div>
                  )}

                  {/* Action Buttons */}
                  {!isConfirmed && (
                    <div className="flex gap-3 pt-4 border-t">
                      <Button
                        onClick={handleSaveDecision}
                        disabled={saveDecisionMut.isPending || !selectedConsultantId || !decisionBasis}
                        variant="outline"
                        size="lg"
                        className="flex-1"
                      >
                        {saveDecisionMut.isPending ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <FileText className="h-4 w-4 ml-2" />}
                        حفظ كمسودة
                      </Button>
                      <Button
                        onClick={() => setShowConfirmDialog(true)}
                        disabled={!selectedConsultantId || !decisionBasis || !justification}
                        size="lg"
                        className="flex-1 bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle2 className="h-4 w-4 ml-2" />
                        تأكيد القرار النهائي
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab 4: Post-Decision Analysis */}
            <TabsContent value="post-analysis" className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-indigo-500" />
                      تحليل ما بعد القرار
                    </CardTitle>
                    {isConfirmed && (
                      <Button
                        onClick={handlePostDecisionAnalysis}
                        disabled={postDecisionAiMut.isPending}
                        className="bg-indigo-600 hover:bg-indigo-700"
                      >
                        {postDecisionAiMut.isPending ? (
                          <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                        ) : (
                          <Brain className="h-4 w-4 ml-2" />
                        )}
                        {postDecisionAiMut.isPending ? "جاري التحليل..." : "تحليل القرار"}
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {!isConfirmed ? (
                    <div className="text-center py-12">
                      <Gavel className="h-16 w-16 mx-auto text-muted-foreground/20 mb-4" />
                      <p className="text-muted-foreground text-lg">
                        يتوفر تحليل ما بعد القرار بعد تأكيد القرار النهائي
                      </p>
                      <p className="text-sm text-muted-foreground mt-2">
                        سيقوم الذكاء الاصطناعي بتحليل منطق القرار وتقديم ملاحظات
                      </p>
                    </div>
                  ) : postDecisionAnalysis ? (
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                      <Streamdown>{postDecisionAnalysis}</Streamdown>
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <Sparkles className="h-16 w-16 mx-auto text-muted-foreground/20 mb-4" />
                      <p className="text-muted-foreground">
                        اضغط "تحليل القرار" للحصول على تحليل شامل يشمل:
                      </p>
                      <ul className="mt-4 space-y-2 text-sm text-muted-foreground max-w-md mx-auto">
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          تحليل منطق القرار ومدى اتساقه
                        </li>
                        <li className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-blue-500" />
                          تقييم المخاطر المحتملة
                        </li>
                        <li className="flex items-center gap-2">
                          <Target className="h-4 w-4 text-purple-500" />
                          توصيات لمرحلة التعاقد
                        </li>
                        <li className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-amber-500" />
                          نقاط يجب مراعاتها في العقد
                        </li>
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      )}

      {/* Confirm Decision Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Crown className="h-6 w-6 text-amber-500" />
              تأكيد القرار النهائي
            </DialogTitle>
            <DialogDescription>
              هذا الإجراء نهائي ولا يمكن التراجع عنه
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
              <p className="text-sm font-semibold text-amber-900">الاستشاري المختار:</p>
              <p className="text-lg font-bold text-amber-800 mt-1">
                {rankings.find(r => r.consultantId === Number(selectedConsultantId))?.consultantName || "—"}
              </p>
            </div>
            <div className="p-4 bg-slate-50 rounded-lg border">
              <p className="text-sm font-semibold">أساس القرار:</p>
              <p className="text-sm mt-1">{DECISION_BASIS_OPTIONS.find(o => o.value === decisionBasis)?.label || "—"}</p>
            </div>
            {justification && (
              <div className="p-4 bg-slate-50 rounded-lg border">
                <p className="text-sm font-semibold">المبررات:</p>
                <p className="text-sm mt-1">{justification}</p>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              إلغاء
            </Button>
            <Button
              onClick={handleConfirmDecision}
              disabled={confirmDecisionMut.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {confirmDecisionMut.isPending ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 ml-2" />}
              تأكيد نهائي
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
