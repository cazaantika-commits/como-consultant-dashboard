import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useProjectContext } from "@/contexts/ProjectContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/hooks/use-toast";
import { ProjectSelector } from "@/components/ProjectSelector";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  ArrowRight, Settings, Save, Loader2, Building2,
  Calendar, Link2, Percent, Clock, Zap, AlertTriangle,
  Banknote, HardHat, Megaphone, FileCheck, Palette,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════
interface TimingRule {
  id: string;
  category: string;
  label: string;
  description: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  step: number;
  icon: any;
  color: string;
}

interface PercentageRule {
  id: string;
  category: string;
  label: string;
  description: string;
  value: number;
  min: number;
  max: number;
  step: number;
  icon: any;
  color: string;
}

interface PaymentSplitRule {
  id: string;
  category: string;
  label: string;
  investorPct: number;
  escrowPct: number;
  icon: any;
  color: string;
}

interface DesignPaymentPhase {
  id: string;
  label: string;
  pct: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULT RULES
// ═══════════════════════════════════════════════════════════════════════════════
const DEFAULT_TIMING_RULES: TimingRule[] = [
  { id: "marketingPrepLead", category: "التسويق", label: "تحضير مواد الدعاية", description: "تبدأ قبل X شهر من انتهاء التصاميم", value: 3, unit: "شهر", min: 1, max: 8, step: 1, icon: Megaphone, color: "#ec4899" },
  { id: "reraApprovalLead", category: "التسويق", label: "اعتمادات ريرا", description: "تبدأ قبل X شهر من بدء المبيعات", value: 2, unit: "شهر", min: 1, max: 6, step: 1, icon: FileCheck, color: "#8b5cf6" },
  { id: "salesStartOffset", category: "المبيعات", label: "بدء المبيعات", description: "تبدأ قبل X شهر من نهاية التصاميم", value: 1, unit: "شهر", min: 0, max: 6, step: 1, icon: Zap, color: "#10b981" },
  { id: "govFeesMonth", category: "الرسوم", label: "دفع الرسوم الحكومية", description: "تُدفع في الشهر X من المشروع", value: 9, unit: "شهر", min: 1, max: 24, step: 1, icon: Banknote, color: "#f59e0b" },
  { id: "sortingFeesMonth", category: "الرسوم", label: "رسوم الفرز", description: "تُدفع في الشهر X من المشروع", value: 6, unit: "شهر", min: 1, max: 18, step: 1, icon: Banknote, color: "#f97316" },
  { id: "reraRegistrationMonth", category: "الرسوم", label: "تسجيل ريرا", description: "يتم في الشهر X من المشروع", value: 7, unit: "شهر", min: 1, max: 18, step: 1, icon: FileCheck, color: "#6366f1" },
  { id: "constructionStartDelay", category: "الإنشاء", label: "بدء الإنشاء بعد التصاميم", description: "يبدأ بعد X شهر من انتهاء التصاميم", value: 1, unit: "شهر", min: 0, max: 6, step: 1, icon: HardHat, color: "#64748b" },
  { id: "mobilizationMonth", category: "الإنشاء", label: "دفعة التعبئة (Mobilization)", description: "تُدفع في الشهر X من بدء الإنشاء", value: 1, unit: "شهر", min: 1, max: 6, step: 1, icon: HardHat, color: "#475569" },
];

const DEFAULT_PERCENTAGE_RULES: PercentageRule[] = [
  { id: "escrowDepositPct", category: "الضمان", label: "إيداع حساب الضمان", description: "نسبة من تكلفة الإنشاء تودع مقدماً", value: 20, min: 5, max: 50, step: 5, icon: Percent, color: "#8b5cf6" },
  { id: "buyerBookingPct", category: "خطة الدفع", label: "دفعة الحجز من المشتري", description: "نسبة من سعر الوحدة عند التوقيع", value: 10, min: 5, max: 30, step: 5, icon: Percent, color: "#3b82f6" },
  { id: "buyerConstructionPct", category: "خطة الدفع", label: "أقساط الإنشاء", description: "نسبة من سعر الوحدة خلال الإنشاء", value: 60, min: 20, max: 80, step: 5, icon: Percent, color: "#10b981" },
  { id: "buyerHandoverPct", category: "خطة الدفع", label: "دفعة التسليم", description: "نسبة من سعر الوحدة عند التسليم", value: 30, min: 5, max: 50, step: 5, icon: Percent, color: "#f59e0b" },
  { id: "contingencyPct", category: "عام", label: "نسبة الطوارئ", description: "نسبة إضافية على التكاليف للطوارئ", value: 2, min: 0, max: 10, step: 0.5, icon: AlertTriangle, color: "#ef4444" },
];

const DEFAULT_PAYMENT_SPLITS: PaymentSplitRule[] = [
  { id: "constructionSplit", category: "الإنشاء", label: "تكاليف الإنشاء", investorPct: 30, escrowPct: 70, icon: HardHat, color: "#64748b" },
  { id: "govFeesSplit", category: "الرسوم", label: "الرسوم الحكومية", investorPct: 10, escrowPct: 90, icon: Banknote, color: "#f59e0b" },
  { id: "designFeesSplit", category: "التصميم", label: "أتعاب التصميم", investorPct: 100, escrowPct: 0, icon: Palette, color: "#3b82f6" },
  { id: "supervisionSplit", category: "الإشراف", label: "أتعاب الإشراف", investorPct: 50, escrowPct: 50, icon: Settings, color: "#10b981" },
  { id: "marketingSplit", category: "التسويق", label: "تكاليف التسويق", investorPct: 100, escrowPct: 0, icon: Megaphone, color: "#ec4899" },
];

const DEFAULT_DESIGN_PAYMENTS: DesignPaymentPhase[] = [
  { id: "signing", label: "عند التوقيع", pct: 10 },
  { id: "concept", label: "التصميم المبدئي (Concept)", pct: 15 },
  { id: "schematic", label: "السكيماتيك (SD)", pct: 25 },
  { id: "dd", label: "التصميم التفصيلي (DD)", pct: 25 },
  { id: "cd", label: "وثائق الإنشاء (CD)", pct: 20 },
  { id: "asBuilt", label: "As-Built", pct: 5 },
];

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function SettingsRulesPage({ embedded }: { embedded?: boolean } = {}) {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const { selectedProjectId, setSelectedProjectId } = useProjectContext();

  // ─── DB Queries ─────────────────────────────────────────────────────────────
  const projectQuery = trpc.projects.getById.useQuery(selectedProjectId!, {
    enabled: !!selectedProjectId && !!user,
  });
  const updateProject = trpc.projects.update.useMutation({
    onSuccess: () => { projectQuery.refetch(); toast({ title: "تم حفظ الإعدادات ✓" }); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  // ─── State ──────────────────────────────────────────────────────────────────
  const [timingRules, setTimingRules] = useState<TimingRule[]>(DEFAULT_TIMING_RULES);
  const [percentageRules, setPercentageRules] = useState<PercentageRule[]>(DEFAULT_PERCENTAGE_RULES);
  const [paymentSplits, setPaymentSplits] = useState<PaymentSplitRule[]>(DEFAULT_PAYMENT_SPLITS);
  const [designPayments, setDesignPayments] = useState<DesignPaymentPhase[]>(DEFAULT_DESIGN_PAYMENTS);
  const [hasChanges, setHasChanges] = useState(false);

  // ─── Load from DB ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (projectQuery.data) {
      const p = projectQuery.data as any;
      // Load settings from constructionScheduleJson if it contains settings
      if (p.constructionScheduleJson) {
        try {
          const stored = JSON.parse(p.constructionScheduleJson);
          if (stored.settings) {
            const s = stored.settings;
            if (s.timingRules) {
              setTimingRules((prev) =>
                prev.map((r) => ({ ...r, value: s.timingRules[r.id] ?? r.value }))
              );
            }
            if (s.percentageRules) {
              setPercentageRules((prev) =>
                prev.map((r) => ({ ...r, value: s.percentageRules[r.id] ?? r.value }))
              );
            }
            if (s.paymentSplits) {
              setPaymentSplits((prev) =>
                prev.map((r) => ({
                  ...r,
                  investorPct: s.paymentSplits[r.id]?.investor ?? r.investorPct,
                  escrowPct: s.paymentSplits[r.id]?.escrow ?? r.escrowPct,
                }))
              );
            }
            if (s.designPayments) {
              setDesignPayments((prev) =>
                prev.map((r) => ({ ...r, pct: s.designPayments[r.id] ?? r.pct }))
              );
            }
          }
        } catch {}
      }
      setHasChanges(false);
    }
  }, [projectQuery.data]);

  // ─── Save ───────────────────────────────────────────────────────────────────
  const handleSave = useCallback(() => {
    if (!selectedProjectId) return;
    // Merge settings into constructionScheduleJson
    const existingJson = (projectQuery.data as any)?.constructionScheduleJson;
    let existing: any = {};
    if (existingJson) { try { existing = JSON.parse(existingJson); } catch {} }
    existing.settings = {
      timingRules: Object.fromEntries(timingRules.map((r) => [r.id, r.value])),
      percentageRules: Object.fromEntries(percentageRules.map((r) => [r.id, r.value])),
      paymentSplits: Object.fromEntries(paymentSplits.map((r) => [r.id, { investor: r.investorPct, escrow: r.escrowPct }])),
      designPayments: Object.fromEntries(designPayments.map((r) => [r.id, r.pct])),
    };
    updateProject.mutate({ id: selectedProjectId, constructionScheduleJson: JSON.stringify(existing) } as any);
    setHasChanges(false);
  }, [selectedProjectId, timingRules, percentageRules, paymentSplits, designPayments, projectQuery.data, updateProject]);

  const updateTiming = (id: string, value: number) => {
    setTimingRules((prev) => prev.map((r) => (r.id === id ? { ...r, value } : r)));
    setHasChanges(true);
  };
  const updatePercentage = (id: string, value: number) => {
    setPercentageRules((prev) => prev.map((r) => (r.id === id ? { ...r, value } : r)));
    setHasChanges(true);
  };
  const updateSplit = (id: string, investorPct: number) => {
    setPaymentSplits((prev) => prev.map((r) => (r.id === id ? { ...r, investorPct, escrowPct: 100 - investorPct } : r)));
    setHasChanges(true);
  };
  const updateDesignPayment = (id: string, pct: number) => {
    setDesignPayments((prev) => prev.map((r) => (r.id === id ? { ...r, pct } : r)));
    setHasChanges(true);
  };

  const designPaymentTotal = designPayments.reduce((s, d) => s + d.pct, 0);
  const buyerPaymentTotal = percentageRules.filter((r) => r.category === "خطة الدفع").reduce((s, r) => s + r.value, 0);

  // ═══════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════════
  return (
    <div className="bg-white p-2" dir="rtl">
      <div className="max-w-full mx-auto space-y-2">
        {/* HEADER */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div>
              <h1 className="text-xs font-bold text-gray-900 flex items-center gap-1">
                <Settings className="w-3 h-3 text-indigo-600" />
                الإعدادات والقواعد
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ProjectSelector selectedId={selectedProjectId} onSelect={(id) => setSelectedProjectId(id)} />
            {hasChanges && (
              <Button size="sm" onClick={handleSave} disabled={updateProject.isPending} className="gap-1.5 bg-indigo-600 hover:bg-indigo-700">
                {updateProject.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                حفظ الإعدادات
              </Button>
            )}
          </div>
        </div>

        {/* No project */}
        {!selectedProjectId && (
          <Card className="border-dashed"><CardContent className="py-4 text-center">
            <Building2 className="w-6 h-6 mx-auto text-gray-300 mb-1" />
            <p className="text-xs text-gray-500">اختر مشروعاً</p>
          </CardContent></Card>
        )}

        {/* Loading */}
        {selectedProjectId && projectQuery.isLoading && (
          <Card><CardContent className="py-12 text-center"><Loader2 className="w-8 h-8 mx-auto animate-spin text-indigo-600" /></CardContent></Card>
        )}

        {/* Main Content */}
        {selectedProjectId && !projectQuery.isLoading && projectQuery.data && (
          <>
            {/* SECTION 1: TIMING RULES */}
            <section className="bg-white rounded-xl border border-gray-100 shadow-md overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600" />
                <h2 className="text-sm font-bold text-gray-800">قواعد التوقيت</h2>
                <Badge variant="secondary" className="text-[10px]">متى يحدث كل شيء</Badge>
              </div>
              <div className="p-2 grid grid-cols-1 md:grid-cols-2 gap-1">
                {timingRules.map((rule) => {
                  const Icon = rule.icon;
                  return (
                    <div key={rule.id} className="rounded-lg border border-gray-100 p-3 hover:border-gray-200 transition-colors">
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className="w-3.5 h-3.5" style={{ color: rule.color }} />
                        <span className="text-xs font-bold text-gray-800">{rule.label}</span>
                        <Badge variant="outline" className="text-[9px] mr-auto">{rule.category}</Badge>
                      </div>
                      <p className="text-[10px] text-gray-500 mb-2">{rule.description}</p>
                      <div className="flex items-center gap-3">
                        <Slider value={[rule.value]} onValueChange={([v]) => updateTiming(rule.id, v)} min={rule.min} max={rule.max} step={rule.step} className="flex-1" />
                        <div className="flex items-center gap-1 min-w-[60px] justify-end">
                          <span className="text-sm font-bold" style={{ color: rule.color }}>{rule.value}</span>
                          <span className="text-[10px] text-gray-400">{rule.unit}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* SECTION 2: PERCENTAGE RULES */}
            <section className="bg-white rounded-xl border border-gray-100 shadow-md overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                <Percent className="w-4 h-4 text-emerald-600" />
                <h2 className="text-sm font-bold text-gray-800">النسب والقواعد المالية</h2>
                {buyerPaymentTotal !== 100 && (
                  <Badge variant="destructive" className="text-[10px] mr-auto">
                    <AlertTriangle className="w-3 h-3 ml-1" />
                    خطة الدفع = {buyerPaymentTotal}% (يجب 100%)
                  </Badge>
                )}
              </div>
              <div className="p-2 grid grid-cols-1 md:grid-cols-2 gap-1">
                {percentageRules.map((rule) => {
                  const Icon = rule.icon;
                  return (
                    <div key={rule.id} className="rounded-lg border border-gray-100 p-3 hover:border-gray-200 transition-colors">
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className="w-3.5 h-3.5" style={{ color: rule.color }} />
                        <span className="text-xs font-bold text-gray-800">{rule.label}</span>
                        <Badge variant="outline" className="text-[9px] mr-auto">{rule.category}</Badge>
                      </div>
                      <p className="text-[10px] text-gray-500 mb-2">{rule.description}</p>
                      <div className="flex items-center gap-3">
                        <Slider value={[rule.value]} onValueChange={([v]) => updatePercentage(rule.id, v)} min={rule.min} max={rule.max} step={rule.step} className="flex-1" />
                        <span className="text-sm font-bold min-w-[40px] text-left" style={{ color: rule.color }}>{rule.value}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* SECTION 3: PAYMENT SPLITS (Investor vs Escrow) */}
            <section className="bg-white rounded-xl border border-gray-100 shadow-md overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                <Link2 className="w-4 h-4 text-violet-600" />
                <h2 className="text-sm font-bold text-gray-800">تقسيم التمويل (مستثمر / ضمان)</h2>
              </div>
              <div className="p-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                  {paymentSplits.map((rule) => {
                    const Icon = rule.icon;
                    return (
                      <div key={rule.id} className="rounded-lg border border-gray-100 p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Icon className="w-3.5 h-3.5" style={{ color: rule.color }} />
                          <span className="text-xs font-bold text-gray-800">{rule.label}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <Slider value={[rule.investorPct]} onValueChange={([v]) => updateSplit(rule.id, v)} min={0} max={100} step={5} className="w-full" />
                          </div>
                          <div className="flex items-center gap-2 min-w-[120px]">
                            <div className="text-center">
                              <p className="text-[9px] text-gray-400">مستثمر</p>
                              <p className="text-xs font-bold text-blue-700">{rule.investorPct}%</p>
                            </div>
                            <span className="text-gray-300">/</span>
                            <div className="text-center">
                              <p className="text-[9px] text-gray-400">ضمان</p>
                              <p className="text-xs font-bold text-violet-700">{rule.escrowPct}%</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* SECTION 4: DESIGN PAYMENT SCHEDULE */}
            <section className="bg-white rounded-xl border border-gray-100 shadow-md overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                <Palette className="w-4 h-4 text-blue-600" />
                <h2 className="text-sm font-bold text-gray-800">جدول دفعات التصميم</h2>
                {designPaymentTotal !== 100 && (
                  <Badge variant="destructive" className="text-[10px] mr-auto">
                    <AlertTriangle className="w-3 h-3 ml-1" />
                    المجموع = {designPaymentTotal}% (يجب 100%)
                  </Badge>
                )}
                {designPaymentTotal === 100 && (
                  <Badge className="text-[10px] mr-auto bg-emerald-100 text-emerald-700">100% ✓</Badge>
                )}
              </div>
              <div className="p-2">
                <div className="space-y-3">
                  {designPayments.map((phase, idx) => (
                    <div key={phase.id} className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                        {idx + 1}
                      </div>
                      <span className="text-xs font-medium text-gray-700 w-40 flex-shrink-0">{phase.label}</span>
                      <Slider value={[phase.pct]} onValueChange={([v]) => updateDesignPayment(phase.id, v)} min={0} max={50} step={5} className="flex-1" />
                      <span className="text-sm font-bold text-blue-700 min-w-[40px] text-left">{phase.pct}%</span>
                    </div>
                  ))}
                </div>
                {/* Visual bar */}
                <div className="mt-4 h-6 rounded-full overflow-hidden flex bg-gray-100">
                  {designPayments.map((phase, idx) => (
                    <div key={phase.id} className="h-full flex items-center justify-center text-[8px] font-bold text-white transition-all"
                      style={{ width: `${phase.pct}%`, backgroundColor: `hsl(${210 + idx * 20}, 70%, ${45 + idx * 5}%)` }}>
                      {phase.pct > 8 ? `${phase.pct}%` : ""}
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
