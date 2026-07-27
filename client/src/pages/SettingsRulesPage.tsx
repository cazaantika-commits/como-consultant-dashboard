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
import {
  Settings, Save, Loader2, Building2, Calendar,
  Percent, Clock, Banknote, HardHat, Megaphone,
  FileCheck, Palette, AlertTriangle, Landmark, Shield,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════
interface ProjectPhase {
  id: string;
  label: string;
  startRule: string; // human-readable description of when it starts
  durationMonths: number;
  durationEditable: boolean; // can user edit duration?
  startEditable: boolean; // can user edit start offset?
  startOffsetMonths: number; // offset from reference point
  startReference: string; // reference event id
  color: string;
}

interface DesignPaymentPhase {
  id: string;
  label: string;
  labelEn: string;
  pct: number;
  durationWeeks: number;
}

interface ConfigurableRate {
  id: string;
  label: string;
  description: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  step: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULTS
// ═══════════════════════════════════════════════════════════════════════════════
const DEFAULT_PROJECT_PHASES: ProjectPhase[] = [
  { id: "designs", label: "التصاميم", startRule: "بداية المشروع", durationMonths: 0, durationEditable: false, startEditable: false, startOffsetMonths: 0, startReference: "projectStart", color: "#3b82f6" },
  { id: "marketingPrep", label: "تحضير مواد التسويق وإصدار ترخيص التسويق", startRule: "عند اكتمال التصميم التخطيطي", durationMonths: 2, durationEditable: true, startEditable: false, startOffsetMonths: 0, startReference: "schematicEnd", color: "#f59e0b" },
  { id: "reraApprovals", label: "تسجيل المشروع وإصدار ترخيص البيع", startRule: "بعد شهر من اكتمال المخططات التخطيطية", durationMonths: 2, durationEditable: true, startEditable: false, startOffsetMonths: 1, startReference: "schematicEnd", color: "#8b5cf6" },
  { id: "marketingLaunch", label: "التسويق", startRule: "فوراً بعد اكتمال تحضير مواد التسويق وإصدار ترخيص التسويق", durationMonths: 0, durationEditable: false, startEditable: false, startOffsetMonths: 0, startReference: "marketingPrepEnd", color: "#ec4899" },
  { id: "salesStart", label: "بدء البيع", startRule: "بعد شهر من اكتمال تسجيل المشروع وإصدار ترخيص البيع", durationMonths: 0, durationEditable: false, startEditable: false, startOffsetMonths: 1, startReference: "reraApprovalsEnd", color: "#10b981" },
  { id: "construction", label: "الإنشاء", startRule: "من المدخلات العامة", durationMonths: 0, durationEditable: false, startEditable: true, startOffsetMonths: 1, startReference: "designsEnd", color: "#64748b" },
];

const DEFAULT_DESIGN_PAYMENTS: DesignPaymentPhase[] = [
  { id: "mobilization", label: "التعبئة وجمع البيانات", labelEn: "Mobilization & Data Collection", pct: 5, durationWeeks: 2 },
  { id: "concept", label: "التصميم المبدئي", labelEn: "Concept Design", pct: 15, durationWeeks: 4 },
  { id: "schematic", label: "التصميم التخطيطي", labelEn: "Schematic Design", pct: 20, durationWeeks: 4 },
  { id: "dd", label: "تطوير التصميم التفصيلي", labelEn: "Detailed Design Development", pct: 25, durationWeeks: 6 },
  { id: "authorities", label: "اعتماد الجهات", labelEn: "Authorities Approval", pct: 10, durationWeeks: 4 },
  { id: "tender", label: "تأهيل المقاولين ووثائق المناقصة", labelEn: "Prequalification & Tender Documents", pct: 15, durationWeeks: 4 },
  { id: "ifc", label: "صادر للتنفيذ", labelEn: "Issued for Construction", pct: 10, durationWeeks: 2 },
];

const DEFAULT_CONFIGURABLE_RATES: ConfigurableRate[] = [
  { id: "communityFeePerSqft", label: "رسوم المجتمع (لكل قدم مربع)", description: "GFA × هذا المعدل × عدد الدفعات", value: 0.25, unit: "درهم/قدم²", min: 0.1, max: 2, step: 0.05 },
  { id: "reraUnitRegistrationFee", label: "رسوم تسجيل الوحدات — ريرا", description: "عدد الوحدات × هذا المبلغ", value: 520, unit: "درهم/وحدة", min: 100, max: 2000, step: 10 },
  { id: "reraAuditorQuarterlyFee", label: "تقرير مدقق ريرا (ربع سنوي)", description: "يُدفع كل 3 أشهر من فتح حساب الضمان", value: 15000, unit: "درهم", min: 5000, max: 100000, step: 1000 },
  { id: "reraInspectionQuarterlyFee", label: "فحص ريرا (ربع سنوي)", description: "يُدفع كل 3 أشهر من بدء الإنشاء", value: 15000, unit: "درهم", min: 5000, max: 100000, step: 1000 },
  { id: "escrowDepositPct", label: "إيداع حساب الضمان", description: "نسبة من تكلفة الإنشاء — ليس مصروفاً", value: 20, unit: "%", min: 5, max: 50, step: 5 },
  { id: "communityFeeFrequency", label: "دورية رسوم المجتمع", description: "كل X أشهر من بدء التصاميم", value: 6, unit: "شهر", min: 3, max: 12, step: 3 },
];

// ═══════════════════════════════════════════════════════════════════════════════
// INVESTOR PAYMENT RULES (read-only display)
// ═══════════════════════════════════════════════════════════════════════════════
const INVESTOR_RULES = [
  { id: "designFees", label: "أتعاب التصاميم", timing: "موزعة حسب مراحل التصميم السبع (نسبة كل مرحلة × إجمالي الأتعاب)", type: "موزعة" },
  { id: "soilTest", label: "فحص التربة", timing: "دفعة واحدة — الشهر 2 من مرحلة التصاميم", type: "دفعة واحدة" },
  { id: "topographySurvey", label: "المسح الطبوغرافي", timing: "دفعة واحدة — الشهر 2 من مرحلة التصاميم", type: "دفعة واحدة" },
  { id: "surveyorDwg", label: "رسوم المساح DWG", timing: "دفعة واحدة — الشهر 1 من مرحلة تسجيل المشروع وإصدار ترخيص البيع", type: "دفعة واحدة" },
  { id: "communityFees", label: "رسوم المجتمع", timing: "كل 6 أشهر من بدء التصاميم حتى الإنجاز — GFA × المعدل", type: "دورية" },
  { id: "govFees10", label: "رسوم الجهات الحكومية (10%)", timing: "دفعة واحدة — عند اكتمال التصميم التخطيطي", type: "دفعة واحدة" },
  { id: "sortingFees", label: "رسوم الفرز", timing: "دفعة واحدة — الشهر 1 من مرحلة تسجيل المشروع وإصدار ترخيص البيع", type: "دفعة واحدة" },
  { id: "nocDeveloper", label: "رسوم NOC المطور", timing: "دفعة واحدة — الشهر 1 من مرحلة تسجيل المشروع وإصدار ترخيص البيع", type: "دفعة واحدة" },
  { id: "reraProjectReg", label: "تسجيل المشروع — ريرا", timing: "دفعة واحدة — الشهر 2 من مرحلة تسجيل المشروع وإصدار ترخيص البيع", type: "دفعة واحدة" },
  { id: "reraUnitReg", label: "تسجيل الوحدات — ريرا", timing: "دفعة واحدة — الشهر 2 من مرحلة تسجيل المشروع وإصدار ترخيص البيع (عدد الوحدات × 520)", type: "محسوبة" },
  { id: "escrowDeposit", label: "إيداع حساب الضمان", timing: "الشهر 2 من مرحلة تسجيل المشروع وإصدار ترخيص البيع — 20% من تكلفة الإنشاء (ليس مصروفاً)", type: "تحويل" },
  { id: "bankFees", label: "رسوم البنك", timing: "موزعة بالتساوي من الشهر 2 من مرحلة تسجيل المشروع وإصدار ترخيص البيع حتى نهاية المشروع", type: "موزعة" },
  { id: "marketingPrep", label: "تحضير مواد التسويق", timing: "موزعة بالتساوي على مدة مرحلة تحضير المواد", type: "موزعة" },
  { id: "marketing", label: "التسويق", timing: "من صفحة المبيعات والتسويق (وائل يحدد المبلغ والنسبة)", type: "متغير" },
  { id: "contractorMobilization", label: "دفعة مقدمة المقاول (10%)", timing: "الشهر 1 من الإنشاء", type: "دفعة واحدة" },
  { id: "contractorFinalRetention", label: "ريتنشن أخيرة المقاول (5%)", timing: "الشهر +13 بعد الإنجاز", type: "دفعة واحدة" },
];

// ═══════════════════════════════════════════════════════════════════════════════
// ESCROW PAYMENT RULES (read-only display)
// ═══════════════════════════════════════════════════════════════════════════════
const ESCROW_RULES = [
  { id: "contractorProgress", label: "مستخلصات المقاول (80%)", timing: "شهرياً حسب نسبة الإنجاز — تُدفع الشهر التالي", type: "شهرية" },
  { id: "contractorRetention1", label: "ريتنشن المقاول الأولى (5%)", timing: "الشهر +2 بعد الإنجاز", type: "دفعة واحدة" },
  { id: "supervisionFees", label: "أتعاب الإشراف", timing: "نسبة الإشراف × (نسبة الإنجاز الشهرية × تكلفة الإنشاء) — الشهر التالي", type: "شهرية" },
  { id: "surveyorAsbuilt", label: "رسوم المساح As-Built", timing: "دفعة واحدة — الشهر قبل الأخير من الإنشاء", type: "دفعة واحدة" },
  { id: "govFees45a", label: "رسوم الجهات الحكومية (45%)", timing: "عند 80% إنجاز الإنشاء", type: "دفعة واحدة" },
  { id: "govFees45b", label: "رسوم الجهات الحكومية (45%)", timing: "عند 90% إنجاز الإنشاء", type: "دفعة واحدة" },
  { id: "reraAuditor", label: "تقرير مدقق ريرا", timing: "كل 3 أشهر من فتح حساب الضمان حتى الإنجاز", type: "ربع سنوية" },
  { id: "reraInspection", label: "فحص ريرا", timing: "كل 3 أشهر من بدء الإنشاء حتى الإنجاز", type: "ربع سنوية" },
  { id: "salesCommission", label: "عمولة المبيعات", timing: "تُدفع بعد شهر من سداد المشتري 20% من سعر الوحدة", type: "مرتبطة بالمبيعات" },
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
  const [projectPhases, setProjectPhases] = useState<ProjectPhase[]>(DEFAULT_PROJECT_PHASES);
  const [designPayments, setDesignPayments] = useState<DesignPaymentPhase[]>(DEFAULT_DESIGN_PAYMENTS);
  const [configurableRates, setConfigurableRates] = useState<ConfigurableRate[]>(DEFAULT_CONFIGURABLE_RATES);
  const [hasChanges, setHasChanges] = useState(false);

  // ─── Load from DB ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (projectQuery.data) {
      const p = projectQuery.data as any;
      if (p.constructionScheduleJson) {
        try {
          const stored = JSON.parse(p.constructionScheduleJson);
          if (stored.settings) {
            const s = stored.settings;
            if (s.projectPhases) {
              setProjectPhases((prev) =>
                prev.map((ph) => {
                  const saved = s.projectPhases[ph.id];
                  if (!saved) return ph;
                  return {
                    ...ph,
                    durationMonths: saved.durationMonths ?? ph.durationMonths,
                    startOffsetMonths: saved.startOffsetMonths ?? ph.startOffsetMonths,
                  };
                })
              );
            }
            if (s.designPayments) {
              setDesignPayments((prev) =>
                prev.map((r) => {
                  const saved = s.designPayments[r.id];
                  if (typeof saved === 'object' && saved !== null) {
                    return { ...r, pct: saved.pct ?? r.pct, durationWeeks: saved.durationWeeks ?? r.durationWeeks };
                  }
                  return { ...r, pct: typeof saved === 'number' ? saved : r.pct };
                })
              );
            }
            if (s.configurableRates) {
              setConfigurableRates((prev) =>
                prev.map((r) => ({ ...r, value: s.configurableRates[r.id] ?? r.value }))
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
    const existingJson = (projectQuery.data as any)?.constructionScheduleJson;
    let existing: any = {};
    if (existingJson) { try { existing = JSON.parse(existingJson); } catch {} }
    existing.settings = {
      projectPhases: Object.fromEntries(projectPhases.map((ph) => [ph.id, { durationMonths: ph.durationMonths, startOffsetMonths: ph.startOffsetMonths }])),
      designPayments: Object.fromEntries(designPayments.map((r) => [r.id, { pct: r.pct, durationWeeks: r.durationWeeks }])),
      configurableRates: Object.fromEntries(configurableRates.map((r) => [r.id, r.value])),
    };
    updateProject.mutate({ id: selectedProjectId, constructionScheduleJson: JSON.stringify(existing) } as any);
    setHasChanges(false);
  }, [selectedProjectId, projectPhases, designPayments, configurableRates, projectQuery.data, updateProject]);

  // ─── Updaters ──────────────────────────────────────────────────────────────
  const updatePhaseDuration = (id: string, val: number) => {
    setProjectPhases((prev) => prev.map((p) => (p.id === id ? { ...p, durationMonths: val } : p)));
    setHasChanges(true);
  };
  const updatePhaseOffset = (id: string, val: number) => {
    setProjectPhases((prev) => prev.map((p) => (p.id === id ? { ...p, startOffsetMonths: val } : p)));
    setHasChanges(true);
  };
  const updateDesignPayment = (id: string, pct: number) => {
    setDesignPayments((prev) => prev.map((r) => (r.id === id ? { ...r, pct } : r)));
    setHasChanges(true);
  };
  const updateDesignDuration = (id: string, durationWeeks: number) => {
    setDesignPayments((prev) => prev.map((r) => (r.id === id ? { ...r, durationWeeks } : r)));
    setHasChanges(true);
  };
  const updateRate = (id: string, value: number) => {
    setConfigurableRates((prev) => prev.map((r) => (r.id === id ? { ...r, value } : r)));
    setHasChanges(true);
  };

  const designPaymentTotal = designPayments.reduce((s, d) => s + d.pct, 0);
  const totalDesignWeeks = designPayments.reduce((s, p) => s + p.durationWeeks, 0);
  const totalDesignMonths = Math.ceil(totalDesignWeeks / 4.33);

  // ═══════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════════
  return (
    <div className="bg-white p-2" dir="rtl">
      <div className="max-w-full mx-auto space-y-3">
        {/* HEADER */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-teal-600" />
            <h1 className="text-sm font-bold text-gray-900">الإعدادات والقواعد</h1>
          </div>
          <div className="flex items-center gap-2">
            <ProjectSelector selectedId={selectedProjectId} onSelect={(id) => setSelectedProjectId(id)} />
            {hasChanges && (
              <Button size="sm" onClick={handleSave} disabled={updateProject.isPending} className="gap-1.5 bg-teal-600 hover:bg-teal-700">
                {updateProject.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                حفظ
              </Button>
            )}
          </div>
        </div>

        {/* No project selected */}
        {!selectedProjectId && (
          <Card className="border-dashed"><CardContent className="py-4 text-center">
            <Building2 className="w-6 h-6 mx-auto text-gray-300 mb-1" />
            <p className="text-xs text-gray-500">اختر مشروعاً لعرض الإعدادات</p>
          </CardContent></Card>
        )}

        {/* Loading */}
        {selectedProjectId && projectQuery.isLoading && (
          <Card><CardContent className="py-12 text-center"><Loader2 className="w-8 h-8 mx-auto animate-spin text-teal-600" /></CardContent></Card>
        )}

        {/* Main Content - show when project selected (even if data hasn't loaded yet due to auth) */}
        {selectedProjectId && !projectQuery.isLoading && (
          <div className="space-y-3">

            {/* ═══ SECTION 1: PROJECT PHASES ═══ */}
            <section className="rounded-xl border border-teal-100 shadow-sm overflow-hidden">
              <div className="px-4 py-2.5 bg-teal-50 border-b border-teal-100 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-teal-700" />
                <h2 className="text-sm font-bold text-teal-800">مراحل المشروع</h2>
                <Badge className="text-[10px] bg-teal-100 text-teal-700 mr-auto">البداية والمدة</Badge>
              </div>
              <div className="p-3">
                <div className="grid grid-cols-[auto_1fr_120px_120px] gap-x-3 gap-y-1 text-[10px] font-bold text-gray-500 border-b border-gray-100 pb-2 mb-2">
                  <span></span>
                  <span>المرحلة</span>
                  <span className="text-center">البداية</span>
                  <span className="text-center">المدة (أشهر)</span>
                </div>
                {projectPhases.map((phase, idx) => (
                  <div key={phase.id} className="grid grid-cols-[auto_1fr_120px_120px] gap-x-3 gap-y-0 items-center py-2 border-b border-gray-50 last:border-b-0">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white" style={{ backgroundColor: phase.color }}>
                      {idx + 1}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-800">{phase.label}</p>
                      <p className="text-[9px] text-gray-400">{phase.startRule}</p>
                    </div>
                    <div className="text-center">
                      {phase.startEditable ? (
                        <input
                          type="number"
                          value={phase.startOffsetMonths}
                          onChange={(e) => updatePhaseOffset(phase.id, parseInt(e.target.value) || 0)}
                          className="w-12 text-center text-xs font-mono border border-gray-200 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-teal-400"
                          min={0} max={12}
                        />
                      ) : (
                        <span className="text-[10px] text-gray-400">تلقائي</span>
                      )}
                    </div>
                    <div className="text-center">
                      {phase.durationEditable ? (
                        <input
                          type="number"
                          value={phase.durationMonths}
                          onChange={(e) => updatePhaseDuration(phase.id, parseInt(e.target.value) || 0)}
                          className="w-12 text-center text-xs font-mono border border-gray-200 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-teal-400"
                          min={1} max={24}
                        />
                      ) : (
                        <span className="text-[10px] text-gray-400">
                          {phase.id === "designs" ? `${totalDesignMonths} (محسوب)` : "—"}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {/* Visual timeline bar */}
                <div className="mt-3 h-5 rounded-full overflow-hidden flex bg-gray-50 border border-gray-100">
                  {projectPhases.map((phase) => {
                    const dur = phase.id === "designs" ? totalDesignMonths : phase.durationMonths;
                    const total = totalDesignMonths + projectPhases.filter(p => p.id !== "designs" && p.id !== "salesStart").reduce((s, p) => s + p.durationMonths, 0);
                    const widthPct = total > 0 ? (dur / total) * 100 : 0;
                    if (phase.id === "salesStart") return null;
                    return (
                      <div key={phase.id} className="h-full flex items-center justify-center text-[7px] font-bold text-white transition-all"
                        style={{ width: `${widthPct}%`, backgroundColor: phase.color, minWidth: widthPct > 0 ? '20px' : '0' }}>
                        {widthPct > 12 ? phase.label.slice(0, 8) : ""}
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* ═══ SECTION 2: DESIGN PHASES ═══ */}
            <section className="rounded-xl border border-blue-100 shadow-sm overflow-hidden">
              <div className="px-4 py-2.5 bg-blue-50 border-b border-blue-100 flex items-center gap-2">
                <Palette className="w-4 h-4 text-blue-700" />
                <h2 className="text-sm font-bold text-blue-800">مراحل التصميم واستحقاق الاستشاري</h2>
                {designPaymentTotal !== 100 && (
                  <Badge variant="destructive" className="text-[10px] mr-auto">
                    <AlertTriangle className="w-3 h-3 ml-1" />
                    المجموع = {designPaymentTotal}%
                  </Badge>
                )}
                {designPaymentTotal === 100 && (
                  <Badge className="text-[10px] mr-auto bg-emerald-100 text-emerald-700">100% ✓</Badge>
                )}
                <span className="text-[10px] text-gray-400">إجمالي: {totalDesignWeeks} أسبوع ≈ {totalDesignMonths} شهر</span>
              </div>
              <div className="p-3">
                <div className="grid grid-cols-[28px_1fr_1fr_80px_80px] gap-2 mb-2 text-[10px] font-bold text-gray-500 border-b border-gray-100 pb-2">
                  <span>#</span>
                  <span>المرحلة</span>
                  <span className="text-gray-400">English</span>
                  <span className="text-center">أسابيع</span>
                  <span className="text-center">%</span>
                </div>
                {designPayments.map((phase, idx) => (
                  <div key={phase.id} className="grid grid-cols-[28px_1fr_1fr_80px_80px] gap-2 items-center py-1.5 border-b border-gray-50">
                    <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[9px] font-bold">
                      {idx + 1}
                    </div>
                    <span className="text-[11px] font-medium text-gray-800">{phase.label}</span>
                    <span className="text-[9px] text-gray-400">{phase.labelEn}</span>
                    <input
                      type="number" value={phase.durationWeeks}
                      onChange={(e) => updateDesignDuration(phase.id, parseInt(e.target.value) || 0)}
                      className="w-12 mx-auto text-center text-xs font-mono border border-gray-200 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                      min={1} max={52}
                    />
                    <input
                      type="number" value={phase.pct}
                      onChange={(e) => updateDesignPayment(phase.id, parseInt(e.target.value) || 0)}
                      className="w-12 mx-auto text-center text-xs font-mono border border-gray-200 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                      min={0} max={100}
                    />
                  </div>
                ))}
                {/* Visual bars */}
                <div className="mt-3 h-5 rounded-full overflow-hidden flex bg-gray-100">
                  {designPayments.map((phase, idx) => (
                    <div key={phase.id} className="h-full flex items-center justify-center text-[7px] font-bold text-white transition-all"
                      style={{ width: `${phase.pct}%`, backgroundColor: `hsl(${210 + idx * 20}, 70%, ${45 + idx * 5}%)` }}>
                      {phase.pct > 8 ? `${phase.pct}%` : ""}
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* ═══ SECTION 3: CONFIGURABLE RATES ═══ */}
            <section className="rounded-xl border border-amber-100 shadow-sm overflow-hidden">
              <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
                <Banknote className="w-4 h-4 text-amber-700" />
                <h2 className="text-sm font-bold text-amber-800">المعدلات والرسوم القابلة للتعديل</h2>
              </div>
              <div className="p-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {configurableRates.map((rate) => (
                  <div key={rate.id} className="rounded-lg border border-gray-100 p-2.5 hover:border-amber-200 transition-colors">
                    <p className="text-[11px] font-bold text-gray-800 mb-0.5">{rate.label}</p>
                    <p className="text-[9px] text-gray-400 mb-2">{rate.description}</p>
                    <div className="flex items-center gap-2">
                      <input
                        type="number" value={rate.value}
                        onChange={(e) => updateRate(rate.id, parseFloat(e.target.value) || 0)}
                        className="w-20 text-center text-xs font-mono border border-gray-200 rounded px-1 py-1 focus:outline-none focus:ring-1 focus:ring-amber-400"
                        min={rate.min} max={rate.max} step={rate.step}
                      />
                      <span className="text-[10px] text-gray-500">{rate.unit}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* ═══ SECTION 4: INVESTOR PAYMENT RULES ═══ */}
            <section className="rounded-xl border border-emerald-100 shadow-sm overflow-hidden">
              <div className="px-4 py-2.5 bg-emerald-50 border-b border-emerald-100 flex items-center gap-2">
                <Landmark className="w-4 h-4 text-emerald-700" />
                <h2 className="text-sm font-bold text-emerald-800">قواعد الدفع — حساب المستثمر</h2>
                <Badge className="text-[10px] bg-emerald-100 text-emerald-700 mr-auto">{INVESTOR_RULES.length} بند</Badge>
              </div>
              <div className="p-2">
                <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-0 text-[10px] font-bold text-gray-500 border-b border-gray-100 pb-1 mb-1 px-2">
                  <span>البند</span>
                  <span>التوقيت</span>
                  <span>النوع</span>
                </div>
                {INVESTOR_RULES.map((rule, idx) => (
                  <div key={rule.id} className={`grid grid-cols-[1fr_auto_auto] gap-x-3 items-center py-1.5 px-2 rounded ${idx % 2 === 0 ? 'bg-gray-50/50' : ''}`}>
                    <span className="text-[11px] font-medium text-gray-800">{rule.label}</span>
                    <span className="text-[9px] text-gray-500 max-w-[280px]">{rule.timing}</span>
                    <Badge variant="outline" className="text-[8px] px-1.5 py-0">{rule.type}</Badge>
                  </div>
                ))}
              </div>
            </section>

            {/* ═══ SECTION 5: ESCROW PAYMENT RULES ═══ */}
            <section className="rounded-xl border border-violet-100 shadow-sm overflow-hidden">
              <div className="px-4 py-2.5 bg-violet-50 border-b border-violet-100 flex items-center gap-2">
                <Shield className="w-4 h-4 text-violet-700" />
                <h2 className="text-sm font-bold text-violet-800">قواعد الدفع — حساب الضمان (Escrow)</h2>
                <Badge className="text-[10px] bg-violet-100 text-violet-700 mr-auto">{ESCROW_RULES.length} بند</Badge>
              </div>
              <div className="p-2">
                <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-0 text-[10px] font-bold text-gray-500 border-b border-gray-100 pb-1 mb-1 px-2">
                  <span>البند</span>
                  <span>التوقيت</span>
                  <span>النوع</span>
                </div>
                {ESCROW_RULES.map((rule, idx) => (
                  <div key={rule.id} className={`grid grid-cols-[1fr_auto_auto] gap-x-3 items-center py-1.5 px-2 rounded ${idx % 2 === 0 ? 'bg-gray-50/50' : ''}`}>
                    <span className="text-[11px] font-medium text-gray-800">{rule.label}</span>
                    <span className="text-[9px] text-gray-500 max-w-[280px]">{rule.timing}</span>
                    <Badge variant="outline" className="text-[8px] px-1.5 py-0">{rule.type}</Badge>
                  </div>
                ))}
              </div>
            </section>

          </div>
        )}
      </div>
    </div>
  );
}
