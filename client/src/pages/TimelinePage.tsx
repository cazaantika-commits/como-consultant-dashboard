import { useState, useEffect, useMemo, useCallback } from "react";
import { useProjectContext } from "@/contexts/ProjectContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/hooks/use-toast";
import { ProjectSelector } from "@/components/ProjectSelector";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DEFAULT_DESIGN_PAYMENT_STAGES, getProjectDesignTiming } from "@/lib/projectTiming";
import {
  Calendar, Palette, Rocket, FileCheck, Megaphone, Target, HardHat,
  Save, Loader2, Building2,
} from "lucide-react";

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

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function TimelinePage({ embedded }: { embedded?: boolean } = {}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { selectedProjectId, setSelectedProjectId } = useProjectContext();

  // ─── DB Queries ─────────────────────────────────────────────────────────────
  const projectQuery = trpc.projects.getById.useQuery(selectedProjectId!, {
    enabled: !!selectedProjectId && !!user,
  });
  const plansQuery = trpc.waelSalesPlan.getByProject.useQuery(
    { projectId: selectedProjectId! },
    { enabled: !!selectedProjectId && !!user }
  );
  const savePlan = trpc.waelSalesPlan.save.useMutation({
    onSuccess: () => { plansQuery.refetch(); toast({ title: "تم حفظ الجدول الزمني ✓" }); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });
  const updateProject = trpc.projects.update.useMutation({
    onSuccess: () => { projectQuery.refetch(); },
  });

  // ─── State ─────────────────────────────────────────────────────────────────
  const [planId, setPlanId] = useState<number | undefined>(undefined);
  const [constructionMonths, setConstructionMonths] = useState(30);
  const [marketingPrepLead, setMarketingPrepLead] = useState(2);
  const [reraLead, setReraLead] = useState(2);
  const [projectStartDate, setProjectStartDate] = useState("");
  const [hasChanges, setHasChanges] = useState(false);
  const [designPayments, setDesignPayments] = useState(DEFAULT_DESIGN_PAYMENT_STAGES);

  // ─── Load from DB ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (projectQuery.data) {
      const p = projectQuery.data as any;
      if (p.constructionMonths) setConstructionMonths(Number(p.constructionMonths));
      if (p.marketingPrepMonths) setMarketingPrepLead(Number(p.marketingPrepMonths));
      if (p.reraLeadMonths) setReraLead(Number(p.reraLeadMonths));
      if (p.startDate) setProjectStartDate(String(p.startDate));
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
      setPlanId(plan.id);
      if (plan.salesAbsorptionJson) {
        try {
          const parsed = JSON.parse(plan.salesAbsorptionJson);
          // marketingPrepLead and reraLead now come from project settings (not salesAbsorptionJson)
        } catch {}
      }
      setHasChanges(false);
    }
  }, [plansQuery.data]);

  // ─── Computed ──────────────────────────────────────────────────────────────
  const totalDesignWeeks = designPayments.reduce((s, p) => s + p.durationWeeks, 0);
  const totalDesignMonths = Math.ceil(totalDesignWeeks / 4.33);
  const designPaymentTotal = designPayments.reduce((s, d) => s + d.pct, 0);

  const schematicCompletionMonth = useMemo(() => {
    const phases = designPayments.slice(0, 3);
    const totalWeeks = phases.reduce((s, p) => s + p.durationWeeks, 0);
    return Math.ceil(totalWeeks / 4.33);
  }, [designPayments]);

  const timeline = useMemo(() => {
    const designEnd = totalDesignMonths;
    const materialsStart = schematicCompletionMonth + 1;
    const reraStart = schematicCompletionMonth + 2;
    const marketingStart = materialsStart + marketingPrepLead;
    const salesStart = reraStart + reraLead + 1;
    const constructionStart = designEnd + 1;
    const projectEnd = constructionStart + constructionMonths - 1;
    return { designEnd, materialsStart, reraStart, marketingStart, salesStart, constructionStart, projectEnd };
  }, [totalDesignMonths, constructionMonths, marketingPrepLead, reraLead, schematicCompletionMonth]);

  // ─── Save ──────────────────────────────────────────────────────────────────
  const handleSave = useCallback(() => {
    if (!selectedProjectId) return;
    // Preserve existing salesAbsorptionJson and update timeline fields
    let existingAbsorption: any = {};
    if (plansQuery.data && plansQuery.data.length > 0) {
      const plan = plansQuery.data[0] as any;
      if (plan.salesAbsorptionJson) {
        try { existingAbsorption = JSON.parse(plan.salesAbsorptionJson); } catch {}
      }
    }
    const updatedAbsorption = {
      ...existingAbsorption,
      marketingPrepLead,
      reraLead,
    };
    savePlan.mutate({
      id: planId,
      projectId: selectedProjectId,
      constructionMonths,
      salesAbsorptionJson: JSON.stringify(updatedAbsorption),
    });
    // Also save to projects table so all pages see the updated values
    updateProject.mutate({
      id: selectedProjectId,
      constructionMonths,
      marketingPrepMonths: marketingPrepLead,
      reraLeadMonths: reraLead,
    });
    setHasChanges(false);
  }, [selectedProjectId, planId, constructionMonths, marketingPrepLead, reraLead, plansQuery.data, savePlan, updateProject]);

  // ═══════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════════
  return (
    <div className="bg-gray-50 p-2" dir="rtl">
      <div className="max-w-full mx-auto space-y-2">
        {/* HEADER */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-blue-600" />
            <h1 className="text-xs font-bold text-gray-900">الجدول الزمني</h1>
          </div>
          <div className="flex items-center gap-2">
            <ProjectSelector selectedId={selectedProjectId} onSelect={(id) => setSelectedProjectId(id)} />
            {hasChanges && (
              <Button size="sm" onClick={handleSave} disabled={savePlan.isPending} className="gap-1.5 bg-blue-600 hover:bg-blue-700">
                {savePlan.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                حفظ
              </Button>
            )}
          </div>
        </div>

        {!selectedProjectId && (
          <Card className="border-dashed"><CardContent className="py-12 text-center">
            <Building2 className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">اختر مشروعاً من القائمة أعلاه</p>
          </CardContent></Card>
        )}

        {selectedProjectId && projectQuery.isLoading && (
          <Card><CardContent className="py-12 text-center"><Loader2 className="w-8 h-8 mx-auto animate-spin text-blue-600" /></CardContent></Card>
        )}

        {selectedProjectId && !projectQuery.isLoading && (
          <>
            {/* SECTION 1: PROJECT PHASES TIMELINE */}
            <section className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-3 py-2 border-b border-gray-100">
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
                    {Array.from({ length: timeline.projectEnd }, (_, i) => {
                      const isDesign = i < totalDesignMonths;
                      const displayNum = isDesign ? i + 1 : i - totalDesignMonths + 1;
                      const MN=["\u064a\u0646\u0627","\u0641\u0628\u0631","\u0645\u0627\u0631","\u0623\u0628\u0631","\u0645\u0627\u064a","\u064a\u0648\u0646","\u064a\u0648\u0644","\u0623\u063a\u0633","\u0633\u0628\u062a","\u0623\u0643\u062a","\u0646\u0648\u0641","\u062f\u064a\u0633"];
                      let ml=""; if(projectStartDate){const pts=projectStartDate.split("-").map(Number);if(pts[0]&&pts[1])ml=MN[(pts[1]-1+i)%12];}
                      return (
                        <div key={i} className="flex-1 text-center flex flex-col items-center leading-tight">
                          <span className={`text-[7px] font-bold ${isDesign ? 'text-blue-600' : 'text-emerald-600'}`}>{ml || displayNum}</span>
                          <span className="text-[6px] text-gray-400">{displayNum}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="p-2">
                <div className="space-y-1.5">
                  {PROJECT_PHASES.map((phase) => {
                    let start = 0, end = 0;
                    if (phase.id === "design") { start = 1; end = timeline.designEnd; }
                    else if (phase.id === "materials") { start = timeline.materialsStart; end = timeline.materialsStart + marketingPrepLead - 1; }
                    else if (phase.id === "rera") { start = timeline.reraStart; end = timeline.reraStart + reraLead - 1; }
                    else if (phase.id === "marketing") { start = timeline.marketingStart; end = timeline.projectEnd; }
                    else if (phase.id === "sales") { start = timeline.salesStart; end = timeline.projectEnd; }
                    else if (phase.id === "construction") { start = timeline.constructionStart; end = timeline.projectEnd; }
                    const total = timeline.projectEnd;
                    const rightPct = ((start - 1) / total) * 100;
                    const widthPct = ((end - start + 1) / total) * 100;
                    const Icon = phase.icon;
                    return (
                      <div key={phase.id} className="flex items-center gap-2">
                        <div className="w-32 flex items-center gap-1.5 flex-shrink-0">
                          <Icon className="w-3 h-3" style={{ color: phase.color }} />
                          <span className="text-[10px] font-medium text-gray-700 truncate">{phase.name}</span>
                        </div>
                        <div className="flex-1 h-5 bg-gray-100 rounded-full relative overflow-hidden" style={{ backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent calc(100% / ' + timeline.projectEnd + ' - 1px), rgba(0,0,0,0.04) calc(100% / ' + timeline.projectEnd + ' - 1px), rgba(0,0,0,0.04) calc(100% / ' + timeline.projectEnd + '))' }}>
                          <div className="absolute h-full rounded-full transition-all" style={{ right: `${rightPct}%`, width: `${widthPct}%`, backgroundColor: phase.color, opacity: 0.8 }} />
                          <span className="absolute inset-0 flex items-center justify-center text-[8px] font-medium text-gray-700">شهر {start} - {end}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-1 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-gray-500">مدة تحضير المواد:</span>
                    <span className="text-[10px] font-bold text-gray-800">{marketingPrepLead}</span>
                    <span className="text-[10px] text-gray-400">شهر</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-gray-500">مدة ريرا:</span>
                    <span className="text-[10px] font-bold text-gray-800">{reraLead}</span>
                    <span className="text-[10px] text-gray-400">شهر</span>
                  </div>
                  <div className="flex items-center gap-1.5 mr-4">
                    <span className="text-[10px] text-gray-500">نقطة الانطلاق (اكتمال المخططات التخطيطية):</span>
                    <Badge className="text-[9px] bg-blue-100 text-blue-700">شهر {schematicCompletionMonth}</Badge>
                  </div>
                </div>
              </div>
            </section>

            {/* SECTION 2: CONSULTANT DESIGN PHASES SCHEDULE */}
            <section className="bg-white rounded-xl border border-blue-100 shadow-sm overflow-hidden">
              <div className="px-3 py-2 bg-blue-50 border-b border-blue-100 flex items-center gap-2">
                <Palette className="w-3.5 h-3.5 text-blue-700" />
                <h2 className="text-[11px] font-bold text-blue-800">مراحل التصميم واستحقاق الاستشاري</h2>
                {designPaymentTotal !== 100 && (
                  <Badge variant="destructive" className="text-[9px] mr-auto">المجموع = {designPaymentTotal}%</Badge>
                )}
                {designPaymentTotal === 100 && (
                  <Badge className="text-[9px] mr-auto bg-emerald-100 text-emerald-700">100% ✓</Badge>
                )}
                <span className="text-[9px] text-gray-400">إجمالي: {totalDesignWeeks} أسبوع ≈ {totalDesignMonths} شهر</span>
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
                    <span className="w-12 mx-auto text-center text-xs font-mono bg-gray-50 border border-gray-100 rounded px-1 py-0.5 text-gray-700">{phase.durationWeeks}</span>
                    <span className="w-12 mx-auto text-center text-xs font-mono bg-gray-50 border border-gray-100 rounded px-1 py-0.5 text-gray-700">{phase.pct}%</span>
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
            </section>
          </>
        )}
      </div>
    </div>
  );
}
