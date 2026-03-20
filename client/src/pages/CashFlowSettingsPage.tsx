/**
 * CashFlowSettingsPage — إعدادات التدفق النقدي
 *
 * المصادر:
 *  - المبالغ: عرض فقط (تأتي من البطاقة التعريفية + دراسة الجدوى)
 *  - المدد الزمنية: قابلة للتعديل هنا (تصاميم / إنشاء / تسليم)
 *  - لكل بند: المرحلة (تلقائي قابل للتغيير) + طريقة الدفع (دفعة واحدة + شهر، أو موزع)
 *  - منفصل لكل سيناريو
 */

import { useState, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Settings2, Save, RotateCcw, Building2, Clock, CheckCircle2, AlertCircle } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Scenario = "offplan_escrow" | "offplan_construction" | "no_offplan";
type DistributionMethod = "lump_sum" | "equal_spread";
type Phase = "land" | "design" | "offplan" | "construction" | "handover";

interface SettingItem {
  id?: number;
  itemKey: string;
  nameAr: string;
  category: string;
  isActive: boolean;
  sortOrder: number;
  distributionMethod: DistributionMethod;
  /** For lump_sum: which month within the assigned phase (1-based) */
  phaseMonth: number | null;
  /** For equal_spread: absolute start/end months */
  startMonth: number | null;
  endMonth: number | null;
  /** Which phase this item belongs to */
  assignedPhase: Phase;
  fundingSource: "investor" | "escrow";
  computedAmount: number;
}

interface PhaseDurations {
  design: number;
  construction: number;
  handover: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SCENARIO_LABELS: Record<Scenario, string> = {
  offplan_escrow: "أوف بلان مع إيداع في حساب الضمان",
  offplan_construction: "أوف بلان بعد إنجاز 20% من الإنشاء",
  no_offplan: "تطوير بدون بيع على الخارطة",
};

const SCENARIO_COLORS: Record<Scenario, string> = {
  offplan_escrow: "bg-violet-600 text-white",
  offplan_construction: "bg-blue-600 text-white",
  no_offplan: "bg-emerald-600 text-white",
};

const PHASE_LABELS: Record<Phase, string> = {
  land: "الأرض (مدفوع)",
  design: "التصاميم",
  offplan: "أوف بلان",
  construction: "الإنشاء",
  handover: "التسليم",
};

const PHASE_COLORS: Record<Phase, string> = {
  land: "bg-stone-100 text-stone-700 border-stone-300",
  design: "bg-amber-100 text-amber-800 border-amber-300",
  offplan: "bg-violet-100 text-violet-800 border-violet-300",
  construction: "bg-sky-100 text-sky-800 border-sky-300",
  handover: "bg-emerald-100 text-emerald-800 border-emerald-300",
};

const CATEGORY_SECTION_LABELS: Record<string, string> = {
  land: "القسم الأول — الأرض (مبالغ مدفوعة)",
  design: "القسم الثاني — التصاميم والموافقات",
  offplan_reg: "القسم الثالث — تسجيل أوف بلان",
  construction: "القسم الرابع — الإنشاء",
  marketing_sales: "القسم الخامس — التسويق والمبيعات",
  developer_fee: "أتعاب المطور",
  admin: "رسوم إدارية",
  other: "بنود أخرى",
};

const CATEGORY_ORDER = ["land", "design", "offplan_reg", "construction", "marketing_sales", "developer_fee", "admin", "other"];

function fmt(n: number): string {
  if (!n || isNaN(n)) return "—";
  return n.toLocaleString("ar-AE", { maximumFractionDigits: 0 });
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CashFlowSettingsPage({
  embedded,
  initialProjectId,
}: {
  embedded?: boolean;
  initialProjectId?: number | null;
} = {}) {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();

  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(initialProjectId ?? null);
  const [scenario, setScenario] = useState<Scenario>("offplan_escrow");
  const [items, setItems] = useState<SettingItem[]>([]);
  const [durations, setDurations] = useState<PhaseDurations>({ design: 6, construction: 16, handover: 2 });
  const [isDirty, setIsDirty] = useState(false);
  const [isDurationDirty, setIsDurationDirty] = useState(false);

  // Sync initialProjectId
  useEffect(() => {
    if (initialProjectId != null) setSelectedProjectId(initialProjectId);
  }, [initialProjectId]);

  const projectsQuery = trpc.projects.list.useQuery(undefined, { enabled: isAuthenticated });

  const settingsQuery = trpc.cashFlowSettings.getSettings.useQuery(
    { projectId: selectedProjectId!, scenario },
    { enabled: !!selectedProjectId, staleTime: 0 }
  );

  const saveSettingsMutation = trpc.cashFlowSettings.saveSettings.useMutation({
    onSuccess: () => {
      toast({ title: "✅ تم الحفظ", description: "تم حفظ إعدادات التوزيع بنجاح" });
      setIsDirty(false);
      settingsQuery.refetch();
    },
    onError: (err) => {
      toast({ title: "خطأ في الحفظ", description: err.message, variant: "destructive" });
    },
  });

  const saveDurationsMutation = trpc.cashFlowSettings.saveDurations.useMutation({
    onSuccess: () => {
      toast({ title: "✅ تم حفظ المدد", description: "تم تحديث المدد الزمنية للمراحل" });
      setIsDurationDirty(false);
      settingsQuery.refetch();
    },
    onError: (err) => {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    },
  });

  const resetSettingsMutation = trpc.cashFlowSettings.resetSettings.useMutation({
    onSuccess: () => {
      toast({ title: "تم الإعادة", description: "تم إعادة الإعدادات إلى القيم الافتراضية" });
      setIsDirty(false);
      settingsQuery.refetch();
    },
  });

  // Load settings into local state
  useEffect(() => {
    if (settingsQuery.data) {
      const data = settingsQuery.data;

      // Load durations from phases
      if (data.phases) {
        setDurations({
          design: data.phases.design?.duration || 6,
          construction: data.phases.construction?.duration || 16,
          handover: data.phases.handover?.duration || 2,
        });
        setIsDurationDirty(false);
      }

      if (data.settings) {
        setItems(data.settings.map((s: any) => {
          // Determine assigned phase from category
          const catToPhase: Record<string, Phase> = {
            land: "land",
            design: "design",
            offplan_reg: "offplan",
            construction: "construction",
            marketing_sales: "construction",
            developer_fee: "design",
            admin: "construction",
            other: "construction",
          };

          // Determine phase month from lumpSumMonth and phase start
          const phaseStart = getPhaseStart(s.category, data.phases);
          const phaseMonth = s.lumpSumMonth != null && phaseStart > 0
            ? s.lumpSumMonth - phaseStart + 1
            : s.lumpSumMonth ?? 1;

          return {
            id: s.id,
            itemKey: s.itemKey,
            nameAr: s.nameAr,
            category: s.category,
            isActive: s.isActive !== false,
            sortOrder: s.sortOrder,
            distributionMethod: (s.distributionMethod === "equal_spread" ? "equal_spread" : "lump_sum") as DistributionMethod,
            phaseMonth: Math.max(1, phaseMonth),
            startMonth: s.startMonth ?? null,
            endMonth: s.endMonth ?? null,
            assignedPhase: (catToPhase[s.category] || "construction") as Phase,
            fundingSource: s.fundingSource as "investor" | "escrow",
            computedAmount: (s as any).computedAmount ?? 0,
          };
        }));
        setIsDirty(false);
      }
    }
  }, [settingsQuery.data]);

  const data = settingsQuery.data;
  const phases = data?.phases;

  // Compute absolute month for lump_sum from phase + phaseMonth
  function getPhaseStart(category: string, phasesData: any): number {
    if (!phasesData) return 1;
    const catToPhaseType: Record<string, string> = {
      land: "land",
      design: "design",
      offplan_reg: "offplan",
      construction: "construction",
      marketing_sales: "construction",
      developer_fee: "design",
      admin: "construction",
      other: "construction",
    };
    const phaseType = catToPhaseType[category] || "construction";
    return phasesData[phaseType]?.start || 1;
  }

  function getPhaseStartForPhase(phase: Phase): number {
    if (!phases) return 1;
    return phases[phase]?.start || 1;
  }

  function getPhaseMaxMonths(phase: Phase): number {
    if (!phases) return 6;
    return phases[phase]?.duration || 6;
  }

  // Group items by category
  const groupedItems = useMemo(() => {
    const groups: Record<string, SettingItem[]> = {};
    for (const item of items) {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    }
    return groups;
  }, [items]);

  function updateItem(itemKey: string, updates: Partial<SettingItem>) {
    setItems(prev => prev.map(item =>
      item.itemKey === itemKey ? { ...item, ...updates } : item
    ));
    setIsDirty(true);
  }

  function handleSave() {
    if (!selectedProjectId) return;
    saveSettingsMutation.mutate({
      projectId: selectedProjectId,
      scenario,
      items: items.map(item => {
        // Convert phaseMonth (relative) back to absolute lumpSumMonth
        const phaseStart = getPhaseStartForPhase(item.assignedPhase);
        const absoluteLumpSumMonth = item.distributionMethod === "lump_sum"
          ? phaseStart + (item.phaseMonth ?? 1) - 1
          : null;

        // For equal_spread: use startMonth/endMonth of the assigned phase
        const phaseData = phases?.[item.assignedPhase];
        const spreadStart = item.startMonth ?? phaseData?.start ?? null;
        const spreadEnd = item.endMonth ?? (phaseData ? phaseData.start + phaseData.duration - 1 : null);

        return {
          itemKey: item.itemKey,
          nameAr: item.nameAr,
          category: item.category,
          isActive: item.isActive,
          sortOrder: item.sortOrder,
          amountOverride: null, // never override amounts
          distributionMethod: item.distributionMethod,
          lumpSumMonth: absoluteLumpSumMonth,
          startMonth: item.distributionMethod === "equal_spread" ? spreadStart : null,
          endMonth: item.distributionMethod === "equal_spread" ? spreadEnd : null,
          customJson: null,
          fundingSource: item.fundingSource,
          notes: null,
        };
      }),
    });
  }

  function handleSaveDurations() {
    if (!selectedProjectId) return;
    saveDurationsMutation.mutate({
      projectId: selectedProjectId,
      designMonths: durations.design,
      constructionMonths: durations.construction,
      handoverMonths: durations.handover,
    });
  }

  function handleReset() {
    if (!selectedProjectId) return;
    if (!confirm("هل تريد إعادة الإعدادات إلى القيم الافتراضية؟")) return;
    resetSettingsMutation.mutate({ projectId: selectedProjectId, scenario });
  }

  const selectedProject = (projectsQuery.data || []).find((p: any) => p.id === selectedProjectId);
  const totalMonths = (durations.design + 2 + durations.construction + durations.handover);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Header */}
      {!embedded && (
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <Settings2 className="w-6 h-6 text-blue-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">إعدادات التدفق النقدي</h1>
              <p className="text-sm text-gray-500">تحديد المدد الزمنية وآلية توزيع كل بند على الأشهر</p>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-screen-xl mx-auto px-4 py-6 space-y-5">

        {/* ── Row 1: Project + Scenario selectors ── */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="flex flex-wrap items-end gap-4">
            {/* Project */}
            <div className="flex-1 min-w-[200px]">
              <Label className="text-sm font-medium text-gray-700 mb-1.5 block">المشروع</Label>
              <Select
                value={selectedProjectId?.toString() || ""}
                onValueChange={(v) => { setSelectedProjectId(Number(v)); setIsDirty(false); setIsDurationDirty(false); }}
              >
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="اختر المشروع..." />
                </SelectTrigger>
                <SelectContent>
                  {(projectsQuery.data || []).map((p: any) => (
                    <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Scenario */}
            <div className="flex-1 min-w-[300px]">
              <Label className="text-sm font-medium text-gray-700 mb-1.5 block">سيناريو التمويل</Label>
              <div className="flex gap-2 flex-wrap">
                {(Object.entries(SCENARIO_LABELS) as [Scenario, string][]).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => { setScenario(key); setIsDirty(false); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      scenario === key
                        ? SCENARIO_COLORS[key]
                        : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Status */}
            {selectedProjectId && data && (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                {data.hasSavedSettings
                  ? <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> إعدادات محفوظة</>
                  : <><AlertCircle className="w-3.5 h-3.5 text-amber-500" /> إعدادات افتراضية</>
                }
                {isDirty && <span className="text-amber-600 font-medium">● تغييرات غير محفوظة</span>}
              </div>
            )}
          </div>
        </div>

        {/* No project selected */}
        {!selectedProjectId && (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">اختر مشروعاً لعرض إعدادات التدفق النقدي</p>
          </div>
        )}

        {/* Loading */}
        {selectedProjectId && settingsQuery.isLoading && (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-gray-500">جارٍ تحميل الإعدادات...</p>
          </div>
        )}

        {selectedProjectId && !settingsQuery.isLoading && (
          <>
            {/* ── Row 2: Phase Durations ── */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-blue-50 border-b border-blue-100 flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600" />
                <span className="font-semibold text-blue-900 text-sm">المدد الزمنية للمراحل</span>
                <span className="text-xs text-blue-600 mr-auto">إجمالي المدة: {totalMonths} شهر</span>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {/* Design */}
                  <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
                    <div className="text-xs font-semibold text-amber-800 mb-2">مرحلة التصاميم</div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        max={36}
                        value={durations.design}
                        onChange={(e) => { setDurations(d => ({ ...d, design: Number(e.target.value) || 6 })); setIsDurationDirty(true); }}
                        className="h-8 text-sm w-16 text-center font-bold"
                        dir="ltr"
                      />
                      <span className="text-xs text-amber-700">شهر</span>
                    </div>
                    <div className="text-xs text-amber-600 mt-1">ش1 — ش{durations.design}</div>
                  </div>

                  {/* Offplan (fixed 2 months) */}
                  <div className="bg-violet-50 rounded-lg p-3 border border-violet-200">
                    <div className="text-xs font-semibold text-violet-800 mb-2">مرحلة أوف بلان</div>
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-16 flex items-center justify-center bg-violet-100 rounded border border-violet-200 text-sm font-bold text-violet-700">2</div>
                      <span className="text-xs text-violet-600">شهر (ثابت)</span>
                    </div>
                    <div className="text-xs text-violet-600 mt-1">ش{durations.design + 1} — ش{durations.design + 2}</div>
                  </div>

                  {/* Construction */}
                  <div className="bg-sky-50 rounded-lg p-3 border border-sky-200">
                    <div className="text-xs font-semibold text-sky-800 mb-2">مرحلة الإنشاء</div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        max={60}
                        value={durations.construction}
                        onChange={(e) => { setDurations(d => ({ ...d, construction: Number(e.target.value) || 16 })); setIsDurationDirty(true); }}
                        className="h-8 text-sm w-16 text-center font-bold"
                        dir="ltr"
                      />
                      <span className="text-xs text-sky-700">شهر</span>
                    </div>
                    <div className="text-xs text-sky-600 mt-1">ش{durations.design + 3} — ش{durations.design + 2 + durations.construction}</div>
                  </div>

                  {/* Handover */}
                  <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-200">
                    <div className="text-xs font-semibold text-emerald-800 mb-2">مرحلة التسليم</div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={0}
                        max={24}
                        value={durations.handover}
                        onChange={(e) => { setDurations(d => ({ ...d, handover: Number(e.target.value) || 2 })); setIsDurationDirty(true); }}
                        className="h-8 text-sm w-16 text-center font-bold"
                        dir="ltr"
                      />
                      <span className="text-xs text-emerald-700">شهر</span>
                    </div>
                    <div className="text-xs text-emerald-600 mt-1">ش{durations.design + 3 + durations.construction} — ش{totalMonths}</div>
                  </div>
                </div>

                {isDurationDirty && (
                  <div className="mt-3 flex justify-end">
                    <Button
                      size="sm"
                      onClick={handleSaveDurations}
                      disabled={saveDurationsMutation.isPending}
                      className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <Save className="w-3.5 h-3.5" />
                      {saveDurationsMutation.isPending ? "جارٍ الحفظ..." : "حفظ المدد الزمنية"}
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* ── Row 3: Items Table ── */}
            {items.length > 0 && (
              <div className="space-y-4">
                {/* Table header explanation */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 text-xs text-blue-800">
                  <strong>ملاحظة:</strong> المبالغ تُعرض للمعلومية فقط وتأتي تلقائياً من البطاقة التعريفية ودراسة الجدوى. لا يمكن تعديلها هنا.
                  المرحلة وطريقة الدفع هي ما يمكن تعديله.
                </div>

                {CATEGORY_ORDER.map(category => {
                  const catItems = groupedItems[category];
                  if (!catItems || catItems.length === 0) return null;

                  const sectionLabel = CATEGORY_SECTION_LABELS[category] || category;
                  const sectionTotal = catItems.reduce((s, i) => s + (i.computedAmount || 0), 0);

                  return (
                    <div key={category} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                      {/* Section Header */}
                      <div className={`px-4 py-2.5 flex items-center gap-3 border-b border-gray-100 ${
                        category === "land" ? "bg-stone-50" :
                        category === "design" ? "bg-amber-50" :
                        category === "offplan_reg" ? "bg-violet-50" :
                        category === "construction" ? "bg-sky-50" :
                        category === "marketing_sales" ? "bg-pink-50" :
                        category === "developer_fee" ? "bg-orange-50" :
                        "bg-gray-50"
                      }`}>
                        <span className="font-semibold text-gray-800 text-sm">{sectionLabel}</span>
                        <span className="text-xs text-gray-400">{catItems.length} بند</span>
                        <span className="mr-auto text-xs font-medium text-gray-600">
                          الإجمالي: <span className="font-bold">{fmt(sectionTotal)}</span> د.إ
                        </span>
                      </div>

                      {/* Table */}
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500">
                            <th className="px-3 py-2 text-right font-medium">البند</th>
                            <th className="px-3 py-2 text-left font-medium w-36">المبلغ (د.إ)</th>
                            <th className="px-3 py-2 text-right font-medium w-36">المرحلة</th>
                            <th className="px-3 py-2 text-right font-medium w-32">طريقة الدفع</th>
                            <th className="px-3 py-2 text-right font-medium w-36">الشهر / التوزيع</th>
                            <th className="px-3 py-2 text-right font-medium w-24">مصدر التمويل</th>
                          </tr>
                        </thead>
                        <tbody>
                          {catItems.map((item, idx) => (
                            <tr
                              key={item.itemKey}
                              className={`border-b border-gray-50 ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}
                            >
                              {/* Name */}
                              <td className="px-3 py-2.5">
                                <span className="font-medium text-gray-800">{item.nameAr}</span>
                              </td>

                              {/* Amount — display only */}
                              <td className="px-3 py-2.5 text-left" dir="ltr">
                                <span className="text-gray-700 font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">
                                  {fmt(item.computedAmount)}
                                </span>
                              </td>

                              {/* Phase assignment */}
                              <td className="px-3 py-2.5">
                                {item.category === "land" ? (
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${PHASE_COLORS.land}`}>
                                    {PHASE_LABELS.land}
                                  </span>
                                ) : (
                                  <Select
                                    value={item.assignedPhase}
                                    onValueChange={(v) => updateItem(item.itemKey, { assignedPhase: v as Phase })}
                                  >
                                    <SelectTrigger className="h-7 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {(["design", "offplan", "construction", "handover"] as Phase[]).map(ph => (
                                        <SelectItem key={ph} value={ph} className="text-xs">
                                          {PHASE_LABELS[ph]}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )}
                              </td>

                              {/* Distribution method */}
                              <td className="px-3 py-2.5">
                                {item.category === "land" ? (
                                  <span className="text-xs text-gray-500 italic">مدفوع مسبقاً</span>
                                ) : (
                                  <Select
                                    value={item.distributionMethod}
                                    onValueChange={(v) => updateItem(item.itemKey, { distributionMethod: v as DistributionMethod })}
                                  >
                                    <SelectTrigger className="h-7 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="lump_sum" className="text-xs">دفعة واحدة</SelectItem>
                                      <SelectItem value="equal_spread" className="text-xs">موزع على المرحلة</SelectItem>
                                    </SelectContent>
                                  </Select>
                                )}
                              </td>

                              {/* Month / Range */}
                              <td className="px-3 py-2.5">
                                {item.category === "land" ? (
                                  <span className="text-xs text-gray-400">—</span>
                                ) : item.distributionMethod === "lump_sum" ? (
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs text-gray-500">الشهر</span>
                                    <Input
                                      type="number"
                                      min={1}
                                      max={getPhaseMaxMonths(item.assignedPhase)}
                                      value={item.phaseMonth ?? 1}
                                      onChange={(e) => updateItem(item.itemKey, { phaseMonth: Math.max(1, Number(e.target.value) || 1) })}
                                      className="h-7 text-xs w-14 text-center"
                                      dir="ltr"
                                    />
                                    <span className="text-xs text-gray-400">
                                      من {getPhaseMaxMonths(item.assignedPhase)}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                                    موزع على {getPhaseMaxMonths(item.assignedPhase)} شهر
                                  </span>
                                )}
                              </td>

                              {/* Funding source */}
                              <td className="px-3 py-2.5">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                  item.fundingSource === "investor"
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-blue-100 text-blue-800"
                                }`}>
                                  {item.fundingSource === "investor" ? "المستثمر" : "حساب الضمان"}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })}

                {/* Save / Reset buttons */}
                <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex items-center justify-between">
                  <div className="text-xs text-gray-500">
                    {isDirty
                      ? <span className="text-amber-600 font-medium">● يوجد تغييرات غير محفوظة في إعدادات التوزيع</span>
                      : <span className="text-emerald-600">✓ جميع الإعدادات محفوظة</span>
                    }
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleReset}
                      disabled={!selectedProjectId || resetSettingsMutation.isPending}
                      className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      إعادة تعيين
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSave}
                      disabled={!selectedProjectId || !isDirty || saveSettingsMutation.isPending}
                      className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <Save className="w-3.5 h-3.5" />
                      {saveSettingsMutation.isPending ? "جارٍ الحفظ..." : "حفظ إعدادات التوزيع"}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
