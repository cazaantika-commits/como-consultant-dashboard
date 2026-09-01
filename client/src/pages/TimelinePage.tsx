import { useState, useEffect, useMemo, useCallback } from "react";
import { useProjectContext } from "@/contexts/ProjectContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/hooks/use-toast";
import { ProjectSelector } from "@/components/ProjectSelector";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DEFAULT_DESIGN_PAYMENT_STAGES, getBuildForSaleSalesTimelineWindow, getMarketingTimelineWindow, getProjectMarketingTiming, getSalesTimelineWindow } from "@/lib/projectTiming";
import { hasApprovedWaelSalesIndicator } from "@/lib/jointVentureInputReadiness";
import { deriveJointVentureTimelineFromSavedPlan } from "@/lib/jointVentureTimeline";
import { default as Calendar } from "lucide-react/dist/esm/icons/calendar.js";
import { default as Palette } from "lucide-react/dist/esm/icons/palette.js";
import { default as Rocket } from "lucide-react/dist/esm/icons/rocket.js";
import { default as FileCheck } from "lucide-react/dist/esm/icons/file-check.js";
import { default as Megaphone } from "lucide-react/dist/esm/icons/megaphone.js";
import { default as Target } from "lucide-react/dist/esm/icons/target.js";
import { default as HardHat } from "lucide-react/dist/esm/icons/hard-hat.js";
import { default as Save } from "lucide-react/dist/esm/icons/save.js";
import { default as Loader2 } from "lucide-react/dist/esm/icons/loader-circle.js";
import { default as Building2 } from "lucide-react/dist/esm/icons/building-2.js";

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════
const PROJECT_PHASES = [
  { id: "design", name: "التصاميم", color: "#3b82f6", icon: Palette },
  { id: "materials", name: "تحضير مواد التسويق وإصدار ترخيص التسويق", color: "#f59e0b", icon: Rocket },
  { id: "rera", name: "تسجيل المشروع وإصدار ترخيص البيع", color: "#8b5cf6", icon: FileCheck },
  { id: "marketing", name: "التسويق", color: "#ec4899", icon: Megaphone },
  { id: "sales", name: "بدء البيع", color: "#10b981", icon: Target },
  { id: "construction", name: "الإنشاء", color: "#64748b", icon: HardHat },
];

const BUILD_FOR_SALE_PHASE_IDS = new Set(["design", "marketing", "sales", "construction"]);

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function TimelinePage({ embedded }: { embedded?: boolean } = {}) {
  const { user } = useAuth();
  const { selectedProjectId, setSelectedProjectId } = useProjectContext();

  // ─── DB Queries ─────────────────────────────────────────────────────────────
  const projectQuery = trpc.projects.getById.useQuery(selectedProjectId!, {
    enabled: !!selectedProjectId && !!user,
  });
  const plansQuery = trpc.waelSalesPlan.getByProject.useQuery(
    { projectId: selectedProjectId! },
    { enabled: !!selectedProjectId && !!user }
  );
  const updateProject = trpc.projects.update.useMutation({
    onSuccess: () => { projectQuery.refetch(); },
  });

  // ─── State ─────────────────────────────────────────────────────────────────
  const [constructionMonths, setConstructionMonths] = useState(0);
  const [projectStartDate, setProjectStartDate] = useState("");
  const [hasChanges, setHasChanges] = useState(false);
  const [designPayments, setDesignPayments] = useState(DEFAULT_DESIGN_PAYMENT_STAGES);

  // ─── Load from DB ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (projectQuery.data) {
      const p = projectQuery.data as any;
      setConstructionMonths(p.constructionMonths ? Number(p.constructionMonths) : 0);
      setProjectStartDate(p.startDate ? String(p.startDate) : "");
      // Load design payments from constructionScheduleJson
      if (p.constructionScheduleJson) {
        try {
          const stored = JSON.parse(p.constructionScheduleJson);
          if (stored.settings?.designPayments) {
            setDesignPayments(prev => prev.map(r => {
              const saved = stored.settings.designPayments[r.id];
              if (saved) return { ...r, pct: saved.pct ?? r.pct, durationWeeks: saved.durationWeeks ?? r.durationWeeks };
              return r;
            }));
          }
        } catch {}
      }
    }
  }, [projectQuery.data]);

  useEffect(() => {
    if (plansQuery.data && plansQuery.data.length > 0) {
      const plan = plansQuery.data[0] as any;
      if (plan.salesAbsorptionJson) {
        try {
          const parsed = JSON.parse(plan.salesAbsorptionJson);
          // Relative phase rules are read from Settings and Rules.
        } catch {}
      }
      setHasChanges(false);
    }
  }, [plansQuery.data]);

  // ─── Computed ──────────────────────────────────────────────────────────────
  const totalDesignWeeks = designPayments.reduce((s, p) => s + p.durationWeeks, 0);
  const designMonthsFromStages = Math.ceil(totalDesignWeeks / 4.33);
  const designPaymentTotal = designPayments.reduce((s, d) => s + d.pct, 0);

  const schematicCompletionMonth = useMemo(() => {
    const phases = designPayments.slice(0, 3);
    const totalWeeks = phases.reduce((s, p) => s + p.durationWeeks, 0);
    return Math.ceil(totalWeeks / 4.33);
  }, [designPayments]);

  const projectType = (projectQuery.data as any)?.financingScenario as string | undefined;
  const isBuildForSale = projectType === "build_for_sale";
  const isJointVenture = projectType === "joint_venture_land_for_units";
  const isIsolatedJointVenture = Boolean((projectQuery.data as any)?.isTestProject) && isJointVenture;
  const activePlan = (plansQuery.data?.[0] ?? null) as any;
  const hasSavedWaelIndicator = hasApprovedWaelSalesIndicator(activePlan);
  const savedScheduleSettings = useMemo(() => {
    try { return JSON.parse((projectQuery.data as any)?.constructionScheduleJson || "{}")?.settings || {}; }
    catch { return {}; }
  }, [projectQuery.data]);
  const hasDetailedDesignSchedule = Boolean(
    savedScheduleSettings.designPayments
    && typeof savedScheduleSettings.designPayments === "object"
    && Object.keys(savedScheduleSettings.designPayments).length > 0,
  );
  const totalDesignMonths = isIsolatedJointVenture && !hasDetailedDesignSchedule
    ? Math.max(0, Number(activePlan?.designMonths) || 0)
    : designMonthsFromStages;
  const hasExplicitTimelineInputs = useMemo(() => {
    if (!isIsolatedJointVenture) return true;
    const project = projectQuery.data as any;
    return Boolean(project?.startDate)
      && Number(project?.constructionMonths) > 0
      && totalDesignMonths > 0
      && hasSavedWaelIndicator;
  }, [isIsolatedJointVenture, projectQuery.data, totalDesignMonths, hasSavedWaelIndicator]);
  const defaultSharedTiming = useMemo(() => getProjectMarketingTiming(projectQuery.data), [projectQuery.data]);
  const marketingPrepLead = defaultSharedTiming.marketingPrepMonths;
  const reraLead = defaultSharedTiming.reraApprovalMonths;
  const sharedTiming = useMemo(() => {
    if (!isIsolatedJointVenture || !activePlan) return defaultSharedTiming;
    return deriveJointVentureTimelineFromSavedPlan({
      plan: activePlan,
      fallback: defaultSharedTiming,
      designMonths: totalDesignMonths,
      constructionMonths,
      marketingPrepMonths: marketingPrepLead,
      reraLeadMonths: reraLead,
    });
  }, [isIsolatedJointVenture, activePlan, defaultSharedTiming, totalDesignMonths, constructionMonths, marketingPrepLead, reraLead]);
  const timeline = useMemo(() => ({
    designEnd: sharedTiming.designMonths,
    materialsStart: sharedTiming.materialsStartMonth,
    reraStart: sharedTiming.reraStartMonth,
    marketingStart: sharedTiming.marketingStartMonth,
    salesStart: sharedTiming.salesStartMonth,
    constructionStart: sharedTiming.constructionStartMonth,
    projectEnd: sharedTiming.projectEndMonth,
  }), [sharedTiming]);
  const activityWindows = useMemo(() => {
    const plan = (plansQuery.data?.[0] ?? {}) as any;
    let absorption: any = {};
    let results: any = {};
    try { absorption = JSON.parse(plan.salesAbsorptionJson || "{}"); } catch {}
    try { results = JSON.parse(plan.resultsJson || "{}"); } catch {}

    return {
      marketing: getMarketingTimelineWindow({
        settingsStartMonth: timeline.marketingStart,
        projectEndMonth: timeline.projectEnd,
        savedStartMonth: absorption.marketingActualStart,
        savedEndMonth: absorption.marketingActualEnd,
      }),
      sales: getSalesTimelineWindow({
        settingsStartMonth: timeline.salesStart,
        projectEndMonth: timeline.projectEnd,
        salesDistribution: results.salesDistribution ?? (absorption.mode === "manual" ? absorption.manual : undefined),
      }),
    };
  }, [plansQuery.data, timeline.marketingStart, timeline.salesStart, timeline.projectEnd]);
  const buildForSaleMarketing = useMemo(() => {
    try {
      const rates = JSON.parse((projectQuery.data as any)?.constructionScheduleJson || "{}")?.settings?.configurableRates || {};
      return {
        startMonthsBeforeCompletion: Math.max(0, Number(rates.buildForSaleMarketingStartMonthsBeforeCompletion ?? 1)),
        durationMonths: Math.max(1, Number(rates.buildForSaleMarketingDurationMonths ?? 3)),
      };
    } catch {
      return { startMonthsBeforeCompletion: 1, durationMonths: 3 };
    }
  }, [projectQuery.data]);
  const buildForSaleMarketingWindow = useMemo(() => {
    const startMonth = Math.max(1, timeline.projectEnd - buildForSaleMarketing.startMonthsBeforeCompletion);
    return { startMonth, endMonth: startMonth + buildForSaleMarketing.durationMonths - 1 };
  }, [timeline.projectEnd, buildForSaleMarketing]);
  const buildForSaleSalesWindow = useMemo(() => {
    const plan = (plansQuery.data?.[0] ?? {}) as any;
    let results: any = {};
    let absorption: any = {};
    try { results = JSON.parse(plan.resultsJson || "{}"); } catch {}
    try { absorption = JSON.parse(plan.salesAbsorptionJson || "{}"); } catch {}
    const directUnits = results.buildForSaleMonthlyUnits
      ?? absorption.buildForSaleMonthlyUnits
      ?? results.salesDistribution
      ?? [];
    return getBuildForSaleSalesTimelineWindow({
      projectEndMonth: timeline.projectEnd,
      directSalesUnits: Array.isArray(directUnits) ? directUnits : [],
    });
  }, [plansQuery.data, timeline.projectEnd]);
  const displayProjectEnd = isBuildForSale
    ? Math.max(timeline.projectEnd, buildForSaleMarketingWindow.endMonth, buildForSaleSalesWindow.endMonth)
    : isJointVenture
      ? Math.max(timeline.projectEnd, activityWindows.marketing.endMonth, activityWindows.sales.endMonth)
      : timeline.projectEnd;
  const visibleProjectPhases = isBuildForSale
    ? PROJECT_PHASES.filter((phase) => BUILD_FOR_SALE_PHASE_IDS.has(phase.id))
    : PROJECT_PHASES.filter((phase) => {
        if (phase.id === "marketing") return activityWindows.marketing.hasSavedActivity;
        if (phase.id === "sales") return activityWindows.sales.hasSavedActivity;
        return true;
      });

  // ─── Save ──────────────────────────────────────────────────────────────────
  const handleSave = useCallback(() => {
    if (!selectedProjectId) return;
    // Construction duration remains a General Inputs value; all other timing rules come from Settings.
    updateProject.mutate({
      id: selectedProjectId,
      constructionMonths,
    });
    setHasChanges(false);
  }, [selectedProjectId, constructionMonths, updateProject]);

  // ═══════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════════
  return (
    <div className="bg-slate-100 p-2" dir="rtl">
      <div className="max-w-full mx-auto space-y-2">
        {/* HEADER */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-blue-600" />
            <h1 className="text-xs font-bold text-gray-900">الجدول الزمني</h1>
          </div>
          <div className="flex items-center gap-2">
            {!embedded && <ProjectSelector selectedId={selectedProjectId} onSelect={(id) => setSelectedProjectId(id)} />}
            {hasChanges && (
              <Button size="sm" onClick={handleSave} disabled={updateProject.isPending} className="gap-1.5 bg-blue-600 hover:bg-blue-700">
                {updateProject.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                حفظ
              </Button>
            )}
          </div>
        </div>

        {!selectedProjectId && (
          <Card className="border-dashed"><CardContent className="py-12 text-center">
            <Building2 className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">اختر مشروعاً من دليل الدراسات</p>
          </CardContent></Card>
        )}

        {selectedProjectId && projectQuery.isLoading && (
          <Card><CardContent className="py-12 text-center"><Loader2 className="w-8 h-8 mx-auto animate-spin text-blue-600" /></CardContent></Card>
        )}

        {selectedProjectId && !projectQuery.isLoading && !hasExplicitTimelineInputs && (
          <Card className="border-2 border-amber-300 bg-amber-50">
            <CardContent className="py-10 text-center">
              <Calendar className="mx-auto h-9 w-9 text-amber-700" />
              <h2 className="mt-3 text-base font-black text-slate-900">البرنامج الزمني غير مكتمل</h2>
              <p className="mx-auto mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-700">
                أدخل تاريخ بداية المشروع ومدد التصميم ومراحل إجراءات الأوف بلان ومدة الإنشاء أولًا. بعد ذلك يظهر توقيت البيع فقط من مؤشر وائل المحفوظ في صفحة المبيعات، وتظهر التحصيلات وفق خطة سداد المشترين وحساب الضمان.
              </p>
              <p className="mt-2 text-xs font-bold text-amber-800">لا توجد مدد أو تواريخ مفترضة لهذا المشروع التجريبي.</p>
            </CardContent>
          </Card>
        )}

        {selectedProjectId && !projectQuery.isLoading && hasExplicitTimelineInputs && (
          <>
            {/* SECTION 1: PROJECT PHASES TIMELINE */}
            <section className="fs-card fs-card-blue overflow-hidden border-2 border-slate-300">
              <div className="border-b-2 border-slate-300 px-3 py-2">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-blue-600" />
                    <h2 className="text-[11px] font-bold text-gray-800">مراحل المشروع</h2>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-gray-500">تصاميم:</span>
                      <span className="text-[10px] font-bold text-blue-700">{totalDesignMonths}</span>
                      <span className="text-[10px] text-gray-400">شهر</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-gray-500">إنشاء:</span>
                      <span className="text-[10px] font-bold text-emerald-700">{constructionMonths}</span>
                      <span className="text-[10px] text-gray-400">شهر</span>
                    </div>
                  </div>
                </div>
                {/* Month numbers */}
                <div className="flex items-center gap-2">
                  <div className="w-32 flex-shrink-0" />
                  <div className="flex-1 flex">
                    {Array.from({ length: displayProjectEnd }, (_, i) => {
                      const isDesign = i < totalDesignMonths;
                      const displayNum = isDesign ? i + 1 : i - totalDesignMonths + 1;
                      const MN=["\u064a\u0646\u0627","\u0641\u0628\u0631","\u0645\u0627\u0631","\u0623\u0628\u0631","\u0645\u0627\u064a","\u064a\u0648\u0646","\u064a\u0648\u0644","\u0623\u063a\u0633","\u0633\u0628\u062a","\u0623\u0643\u062a","\u0646\u0648\u0641","\u062f\u064a\u0633"];
                      let ml=""; if(projectStartDate){const pts=projectStartDate.split("-").map(Number);if(pts[0]&&pts[1])ml=MN[(pts[1]-1+i)%12];}
                      return (
                        <div key={i} className="flex flex-1 flex-col items-center border-l border-slate-200 text-center leading-tight last:border-l-0">
                          <span className={`text-[7px] font-extrabold ${isDesign ? 'text-blue-700' : 'text-emerald-700'}`}>{ml || displayNum}</span>
                          <span className="text-[6px] font-semibold text-slate-500">{displayNum}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="p-2">
                <div className="space-y-1.5">
                  {visibleProjectPhases.map((phase) => {
                    let start = 0, end = 0;
                    if (phase.id === "design") { start = 1; end = timeline.designEnd; }
                    else if (phase.id === "materials") { start = timeline.materialsStart; end = timeline.materialsStart + marketingPrepLead - 1; }
                    else if (phase.id === "rera") { start = timeline.reraStart; end = timeline.reraStart + reraLead - 1; }
                    else if (phase.id === "marketing") {
                      start = isBuildForSale ? buildForSaleMarketingWindow.startMonth : activityWindows.marketing.startMonth;
                      end = isBuildForSale ? buildForSaleMarketingWindow.endMonth : activityWindows.marketing.endMonth;
                    }
                    else if (phase.id === "sales") {
                      start = isBuildForSale ? buildForSaleSalesWindow.startMonth : activityWindows.sales.startMonth;
                      end = isBuildForSale ? buildForSaleSalesWindow.endMonth : activityWindows.sales.endMonth;
                    }
                    else if (phase.id === "construction") { start = timeline.constructionStart; end = timeline.projectEnd; }
                    const total = displayProjectEnd;
                    const rightPct = ((start - 1) / total) * 100;
                    const widthPct = ((end - start + 1) / total) * 100;
                    const Icon = phase.icon;
                    return (
                      <div key={phase.id} className="flex items-center gap-2">
                        <div className="w-32 flex items-center gap-1.5 flex-shrink-0">
                          <Icon className="w-3 h-3" style={{ color: phase.color }} />
                          <span className="text-[10px] font-medium text-gray-700 truncate">{phase.name}</span>
                        </div>
                        <div className="relative h-6 flex-1 overflow-hidden rounded-md border border-slate-300 bg-slate-100" style={{ backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent calc(100% / ' + displayProjectEnd + ' - 1px), rgba(71,85,105,0.22) calc(100% / ' + displayProjectEnd + ' - 1px), rgba(71,85,105,0.22) calc(100% / ' + displayProjectEnd + '))' }}>
                          <div className="absolute h-full rounded-full transition-all" style={{ right: `${rightPct}%`, width: `${widthPct}%`, backgroundColor: phase.color, opacity: 0.8 }} />
                          <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-slate-800">شهر {start} - {end}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-1 flex-wrap">
                  {!isBuildForSale && <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-gray-500">مدة تحضير المواد:</span>
                    <span className="text-[10px] font-bold text-gray-800">{marketingPrepLead}</span>
                    <span className="text-[10px] text-gray-400">شهر</span>
                  </div>}
                  {!isBuildForSale && <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-gray-500">مدة ريرا:</span>
                    <span className="text-[10px] font-bold text-gray-800">{reraLead}</span>
                    <span className="text-[10px] text-gray-400">شهر</span>
                  </div>}
                  {isBuildForSale && <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-gray-500">تسويق البناء للبيع:</span>
                    <Badge className="fs-pill fs-pill-rose text-[9px]">{buildForSaleMarketing.durationMonths} أشهر بدءًا قبل {buildForSaleMarketing.startMonthsBeforeCompletion} شهر من الإنجاز</Badge>
                  </div>}
                  {hasDetailedDesignSchedule && <div className="flex items-center gap-1.5 mr-4">
                    <span className="text-[10px] text-gray-500">نقطة الانطلاق (اكتمال المخططات التخطيطية):</span>
                    <Badge className="fs-pill fs-pill-blue text-[9px]">شهر {schematicCompletionMonth}</Badge>
                  </div>}
                  <div className="flex items-center gap-1.5 mr-4">
                    <span className="text-[10px] text-gray-500">نطاق التسويق:</span>
                    <Badge className="fs-pill fs-pill-rose text-[9px]">{isBuildForSale ? "إعدادات البناء للبيع" : activityWindows.marketing.hasSavedActivity ? "خطة التسويق المحفوظة" : "بانتظار خطة التسويق"}</Badge>
                  </div>
                  <div className="flex items-center gap-1.5 mr-4">
                    <span className="text-[10px] text-gray-500">نطاق البيع:</span>
                    <Badge className="fs-pill fs-pill-emerald text-[9px]">{isBuildForSale ? buildForSaleSalesWindow.hasSavedActivity ? "خطة البيع المباشر" : "البيع المباشر بعد الإنجاز" : activityWindows.sales.hasSavedActivity ? "مؤشر وائل المحفوظ في صفحة المبيعات" : "بانتظار اعتماد مؤشر وائل"}</Badge>
                  </div>
                </div>
              </div>
            </section>

            {/* SECTION 2: CONSULTANT DESIGN PHASES SCHEDULE */}
            {(!isJointVenture || hasDetailedDesignSchedule) ? <section className="fs-card fs-card-violet overflow-hidden border-2 border-slate-300">
              <div className="flex items-center gap-2 border-b-2 border-slate-300 bg-blue-50 px-3 py-2">
                <Palette className="w-3.5 h-3.5 text-blue-700" />
                <h2 className="text-[11px] font-bold text-blue-800">مراحل التصميم واستحقاق الاستشاري</h2>
                {designPaymentTotal !== 100 && (
                  <Badge variant="destructive" className="text-[9px] mr-auto">المجموع = {designPaymentTotal}%</Badge>
                )}
                {designPaymentTotal === 100 && (
                  <Badge className="fs-pill fs-pill-emerald mr-auto text-[9px]">100% ✓</Badge>
                )}
                <span className="text-[9px] text-gray-400">إجمالي: {totalDesignWeeks} أسبوع ≈ {totalDesignMonths} شهر</span>
              </div>
              <div className="p-3">
                <div className="grid grid-cols-[36px_1fr_1fr_80px_80px] border border-slate-300 bg-slate-900 text-[10px] font-extrabold text-white">
                  <span className="border-l border-slate-600 px-2 py-2">#</span>
                  <span className="border-l border-slate-600 px-2 py-2">المرحلة</span>
                  <span className="border-l border-slate-600 px-2 py-2">English</span>
                  <span className="border-l border-slate-600 px-2 py-2 text-center">أسابيع</span>
                  <span className="px-2 py-2 text-center">%</span>
                </div>
                {designPayments.map((phase, idx) => (
                  <div key={phase.id} className="grid grid-cols-[36px_1fr_1fr_80px_80px] items-center border-x border-b border-slate-300 bg-white">
                    <div className="flex min-h-9 items-center justify-center border-l border-slate-200"><div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[9px] font-extrabold text-blue-800">
                      {idx + 1}
                    </div></div>
                    <span className="border-l border-slate-200 px-2 py-2 text-[11px] font-bold text-slate-900">{phase.label}</span>
                    <span className="border-l border-slate-200 px-2 py-2 text-[9px] font-medium text-slate-600">{phase.labelEn}</span>
                    <span className="border-l border-slate-200 px-2 py-2 text-center font-mono text-xs font-bold text-slate-800">{phase.durationWeeks}</span>
                    <span className="px-2 py-2 text-center font-mono text-xs font-extrabold text-slate-900">{phase.pct}%</span>
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
                {/* Schematic completion marker */}
                <div className="mt-2 pt-2 border-t border-gray-100">
                  <p className="text-[9px] text-gray-500">
                    نقطة الانطلاق = اكتمال المرحلة 3 (التصميم التخطيطي) = بعد {designPayments.slice(0, 3).reduce((s, p) => s + p.durationWeeks, 0)} أسبوع ≈ شهر {schematicCompletionMonth}
                  </p>
                </div>
              </div>
            </section> : <Card className="border-2 border-blue-200 bg-blue-50"><CardContent className="py-5 text-center"><Palette className="mx-auto h-7 w-7 text-blue-700" /><p className="mt-2 text-sm font-black text-slate-900">مدة التصميم المعتمدة في خطة وائل: {totalDesignMonths} أشهر</p><p className="mt-1 text-xs font-semibold text-slate-600">لم تُحفظ بعد مدد مراحل الاستشاري التفصيلية؛ لذلك لا يعرض النظام توزيعًا أسبوعيًا أو استحقاقات افتراضية.</p></CardContent></Card>}
          </>
        )}
      </div>
    </div>
  );
}
