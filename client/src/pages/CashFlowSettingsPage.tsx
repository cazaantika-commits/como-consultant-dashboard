/**
 * CashFlowSettingsPage — إعدادات التدفق النقدي
 *
 * الهيكل: نفس أقسام جدول الانعكاس بالضبط
 *  - القسم الأول: الأرض (مدفوع مسبقاً — لا توزيع)
 *  - القسم الثاني: التصاميم ورخصة البناء
 *  - القسم الثالث: ريرا والبيع أوف بلان
 *  - القسم الرابع: الإنشاء (حصة المستثمر)
 *  - من حساب الضمان (تُدفع من إيرادات المشترين)
 *
 * المبالغ: عرض فقط — تأتي من البطاقة التعريفية ودراسة الجدوى
 * التوزيع: دفعة واحدة (+ رقم الشهر) | موزع بالتساوي | نسب مخصصة
 * المدد الزمنية: قابلة للتعديل في الأعلى
 * منفصل لكل سيناريو
 */

import { useState, useEffect, useMemo, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Settings2, Save, RotateCcw, Building2, Clock, CheckCircle2, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Scenario = "offplan_escrow" | "offplan_construction" | "no_offplan";
type DistributionMethod = "lump_sum" | "equal_spread" | "custom";

interface SettingItem {
  id?: number;
  itemKey: string;
  nameAr: string;
  /** Which section this belongs to (matches capital-schedule.html sections) */
  section: "paid" | "design" | "offplan" | "construction" | "escrow";
  /** Category from server (needed to pass back on save) */
  category?: string;
  isActive: boolean;
  sortOrder: number;
  distributionMethod: DistributionMethod;
  /** For lump_sum: which month within the assigned phase (1-based) */
  phaseMonth: number;
  /** For custom: array of percentages per month (length = phase duration) */
  customPercentages: number[];
  fundingSource: "investor" | "escrow";
  computedAmount: number;
  /** Which phase the item distributes within */
  assignedPhase: "design" | "offplan" | "construction" | "handover";
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

/** Maps section → display label + colors */
const SECTION_META = {
  paid: {
    label: "القسم الأول — المبالغ المدفوعة (الأرض)",
    headerBg: "bg-stone-100 border-stone-200",
    headerText: "text-stone-800",
    badge: "bg-stone-200 text-stone-700",
  },
  design: {
    label: "القسم الثاني — التصاميم ورخصة البناء",
    headerBg: "bg-amber-50 border-amber-200",
    headerText: "text-amber-900",
    badge: "bg-amber-100 text-amber-800",
  },
  offplan: {
    label: "القسم الثالث — ريرا والبيع أوف بلان",
    headerBg: "bg-violet-50 border-violet-200",
    headerText: "text-violet-900",
    badge: "bg-violet-100 text-violet-800",
  },
  construction: {
    label: "القسم الرابع — الإنشاء (حصة المستثمر فقط)",
    headerBg: "bg-emerald-50 border-emerald-200",
    headerText: "text-emerald-900",
    badge: "bg-emerald-100 text-emerald-800",
  },
  escrow: {
    label: "من حساب الضمان (تُدفع من إيرادات المشترين)",
    headerBg: "bg-blue-50 border-blue-200",
    headerText: "text-blue-900",
    badge: "bg-blue-100 text-blue-800",
  },
} as const;

const SECTION_ORDER: Array<keyof typeof SECTION_META> = ["paid", "design", "offplan", "construction", "escrow"];

/** Map old category keys → new section keys */
const CAT_TO_SECTION: Record<string, keyof typeof SECTION_META> = {
  land: "paid",
  design: "design",
  offplan_reg: "offplan",
  construction: "construction",
  marketing_sales: "offplan",
  developer_fee: "design",
  admin: "construction",
  other: "construction",
};

/** Map old category keys → default assigned phase */
const CAT_TO_PHASE: Record<string, SettingItem["assignedPhase"]> = {
  land: "design",
  design: "design",
  offplan_reg: "offplan",
  construction: "construction",
  marketing_sales: "offplan",
  developer_fee: "design",
  admin: "construction",
  other: "construction",
};

function fmt(n: number): string {
  if (!n || isNaN(n)) return "—";
  return n.toLocaleString("ar-AE", { maximumFractionDigits: 0 });
}

// ─── CustomPercentagesEditor ──────────────────────────────────────────────────

function CustomPercentagesEditor({
  months,
  percentages,
  onChange,
}: {
  months: number;
  percentages: number[];
  onChange: (p: number[]) => void;
}) {
  const pct = Array.from({ length: months }, (_, i) => percentages[i] ?? 0);
  const total = pct.reduce((s, v) => s + v, 0);
  const isValid = Math.abs(total - 100) < 0.01;

  function update(idx: number, val: number) {
    const next = [...pct];
    next[idx] = val;
    onChange(next);
  }

  function distribute() {
    const each = parseFloat((100 / months).toFixed(4));
    const arr = Array(months).fill(each);
    arr[months - 1] = parseFloat((100 - each * (months - 1)).toFixed(4));
    onChange(arr);
  }

  return (
    <div className="mt-2 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">نسبة كل شهر (المجموع = 100%)</span>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold ${isValid ? "text-emerald-600" : "text-red-500"}`}>
            المجموع: {total.toFixed(1)}%
          </span>
          <button
            onClick={distribute}
            className="text-xs text-blue-600 hover:underline"
          >
            توزيع متساوٍ
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {pct.map((v, i) => (
          <div key={i} className="flex flex-col items-center gap-0.5">
            <span className="text-xs text-gray-400">ش{i + 1}</span>
            <Input
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={v}
              onChange={(e) => update(i, parseFloat(e.target.value) || 0)}
              className="h-7 w-14 text-xs text-center p-1"
              dir="ltr"
            />
            <span className="text-xs text-gray-400">%</span>
          </div>
        ))}
      </div>
      {!isValid && (
        <p className="text-xs text-red-500">⚠ المجموع يجب أن يساوي 100%</p>
      )}
    </div>
  );
}

// ─── ItemRow ──────────────────────────────────────────────────────────────────

function DistributionPreview({
  method,
  phaseStart,
  phaseDuration,
  phaseMonth,
  customPercentages,
  amount,
}: {
  method: DistributionMethod;
  phaseStart: number;
  phaseDuration: number;
  phaseMonth: number;
  customPercentages: number[];
  amount: number;
}) {
  if (!amount || amount === 0) return null;

  const months: { month: number; value: number }[] = [];

  if (method === "lump_sum") {
    const absMonth = phaseStart + phaseMonth - 1;
    months.push({ month: absMonth, value: amount });
  } else if (method === "equal_spread") {
    const perMonth = amount / phaseDuration;
    for (let i = 0; i < phaseDuration; i++) {
      months.push({ month: phaseStart + i, value: perMonth });
    }
  } else if (method === "custom") {
    const pct = Array.from({ length: phaseDuration }, (_, i) => customPercentages[i] ?? 0);
    for (let i = 0; i < phaseDuration; i++) {
      if (pct[i] > 0) {
        months.push({ month: phaseStart + i, value: amount * pct[i] / 100 });
      }
    }
  }

  if (months.length === 0) return null;

  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {months.map(({ month, value }) => (
        <div key={month} className="flex items-center gap-0.5 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5">
          <span className="text-xs text-emerald-700 font-medium">ش{month}</span>
          <span className="text-xs text-emerald-600">: {value.toLocaleString("ar-AE", { maximumFractionDigits: 0 })}</span>
        </div>
      ))}
    </div>
  );
}

function ItemRow({
  item,
  phaseDuration,
  phaseStart,
  onUpdate,
}: {
  item: SettingItem;
  phaseDuration: number;
  phaseStart: number;
  onUpdate: (updates: Partial<SettingItem>) => void;
}) {
  const [showCustom, setShowCustom] = useState(false);
  const isPaid = item.section === "paid";

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
      {/* Name */}
      <td className="px-3 py-2.5 text-right">
        <span className="font-medium text-gray-800 text-sm">{item.nameAr}</span>
      </td>

      {/* Total amount — display only */}
      <td className="px-3 py-2.5 text-left" dir="ltr">
        <span className="text-gray-700 font-mono text-xs bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
          {fmt(item.computedAmount)}
        </span>
      </td>

      {/* Funding source — editable */}
      <td className="px-3 py-2.5 text-center">
        {isPaid ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
            المستثمر
          </span>
        ) : (
          <Select
            value={item.fundingSource}
            onValueChange={(v) => onUpdate({ fundingSource: v as "investor" | "escrow" })}
          >
            <SelectTrigger className={`h-7 text-xs w-32 font-medium border ${
              item.fundingSource === "investor"
                ? "bg-amber-50 border-amber-200 text-amber-800"
                : "bg-blue-50 border-blue-200 text-blue-800"
            }`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="investor" className="text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                  المستثمر
                </span>
              </SelectItem>
              <SelectItem value="escrow" className="text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
                  حساب الضمان
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        )}
      </td>

      {/* Distribution controls */}
      <td className="px-3 py-2.5" colSpan={2}>
        {isPaid ? (
          <span className="text-xs text-stone-500 italic font-medium">مدفوع مسبقاً — لا توزيع</span>
        ) : (
          <div className="space-y-1.5">
            {/* Method selector */}
            <div className="flex items-center gap-2 flex-wrap">
              <Select
                value={item.distributionMethod}
                onValueChange={(v) => {
                  onUpdate({ distributionMethod: v as DistributionMethod });
                  if (v === "custom") setShowCustom(true);
                  else setShowCustom(false);
                }}
              >
                <SelectTrigger className="h-7 text-xs w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lump_sum" className="text-xs">دفعة واحدة</SelectItem>
                  <SelectItem value="equal_spread" className="text-xs">موزع بالتساوي على المرحلة</SelectItem>
                  <SelectItem value="custom" className="text-xs">نسب مخصصة</SelectItem>
                </SelectContent>
              </Select>

              {/* Phase assignment */}
              <Select
                value={item.assignedPhase}
                onValueChange={(v) => onUpdate({ assignedPhase: v as SettingItem["assignedPhase"] })}
              >
                <SelectTrigger className="h-7 text-xs w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="design" className="text-xs">التصاميم</SelectItem>
                  <SelectItem value="offplan" className="text-xs">أوف بلان</SelectItem>
                  <SelectItem value="construction" className="text-xs">الإنشاء</SelectItem>
                  <SelectItem value="handover" className="text-xs">التسليم</SelectItem>
                </SelectContent>
              </Select>

              {/* Lump sum month */}
              {item.distributionMethod === "lump_sum" && (
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-500">الشهر</span>
                  <Input
                    type="number"
                    min={1}
                    max={phaseDuration}
                    value={item.phaseMonth}
                    onChange={(e) => onUpdate({ phaseMonth: Math.min(phaseDuration, Math.max(1, Number(e.target.value) || 1)) })}
                    className="h-7 text-xs w-14 text-center"
                    dir="ltr"
                  />
                  <span className="text-xs text-gray-400">من {phaseDuration}</span>
                </div>
              )}

              {/* Equal spread info */}
              {item.distributionMethod === "equal_spread" && (
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                  موزع على {phaseDuration} شهر
                </span>
              )}

              {/* Custom toggle */}
              {item.distributionMethod === "custom" && (
                <button
                  onClick={() => setShowCustom(s => !s)}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                >
                  {showCustom ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  {showCustom ? "إخفاء النسب" : "تعديل النسب"}
                </button>
              )}
            </div>

            {/* Custom percentages editor */}
            {item.distributionMethod === "custom" && showCustom && (
              <CustomPercentagesEditor
                months={phaseDuration}
                percentages={item.customPercentages}
                onChange={(p) => onUpdate({ customPercentages: p })}
              />
            )}

            {/* Distribution preview */}
            <DistributionPreview
              method={item.distributionMethod}
              phaseStart={phaseStart}
              phaseDuration={phaseDuration}
              phaseMonth={item.phaseMonth}
              customPercentages={item.customPercentages}
              amount={item.computedAmount}
            />
          </div>
        )}
      </td>
    </tr>
  );
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
  const utils = trpc.useUtils();

  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(initialProjectId ?? null);
  const [scenario, setScenario] = useState<Scenario>("offplan_escrow");
  const [scenarioInitialized, setScenarioInitialized] = useState(false);

  // Read the project's actual scenario from DB (same source as CapitalScheduleTablePage)
  const scenariosQuery = trpc.cashFlowProgram.getProjectScenarios.useQuery(undefined, { enabled: isAuthenticated, staleTime: 5000 });
  const [items, setItems] = useState<SettingItem[]>([]);
  const [durations, setDurations] = useState<PhaseDurations>({ design: 6, construction: 16, handover: 2 });
  const [isDirty, setIsDirty] = useState(false);
  const [isDurationDirty, setIsDurationDirty] = useState(false);

  useEffect(() => {
    if (initialProjectId != null) setSelectedProjectId(initialProjectId);
  }, [initialProjectId]);

  // Sync scenario from DB when project changes — single effect to avoid race condition
  const prevSettingsProjectRef = useRef<number | null>(null);
  useEffect(() => {
    // Reset when project changes
    if (selectedProjectId !== prevSettingsProjectRef.current) {
      prevSettingsProjectRef.current = selectedProjectId;
      setScenarioInitialized(false);
    }
    // Set scenario from DB when data is available
    if (selectedProjectId && scenariosQuery.data) {
      const dbScenario = scenariosQuery.data[selectedProjectId] as Scenario | undefined;
      setScenario(dbScenario || "offplan_escrow");
      setScenarioInitialized(true);
    }
  }, [selectedProjectId, scenariosQuery.data]);

  const projectsQuery = trpc.projects.list.useQuery(undefined, { enabled: isAuthenticated });

  // CRITICAL: Only fetch settings AFTER scenario is loaded from DB to prevent saving to wrong scenario
  const settingsQuery = trpc.cashFlowSettings.getSettings.useQuery(
    { projectId: selectedProjectId!, scenario },
    { enabled: !!selectedProjectId && scenarioInitialized, staleTime: 0 }
  );

  const saveSettingsMutation = trpc.cashFlowSettings.saveSettings.useMutation({
    onSuccess: () => {
      toast({ title: "✅ تم الحفظ", description: "تم حفظ إعدادات التوزيع بنجاح" });
      setIsDirty(false);
      settingsQuery.refetch();
      utils.cashFlowSettings.getSettings.invalidate();
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
      utils.cashFlowSettings.getSettings.invalidate();
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
      utils.cashFlowSettings.getSettings.invalidate();
    },
  });

  // Load settings into local state
  useEffect(() => {
    if (settingsQuery.data) {
      const data = settingsQuery.data;

      if (data.phases) {
        setDurations({
          design: data.phases.design?.duration || 6,
          construction: data.phases.construction?.duration || 16,
          handover: data.phases.handover?.duration || 2,
        });
        setIsDurationDirty(false);
      }

      if (data.settings) {
        setItems(data.settings.filter((s: any) => s.category !== "revenue").map((s: any) => {
          // Use section from server (always authoritative — set per item in server defaults)
          const section = (s.section as keyof typeof SECTION_META) || CAT_TO_SECTION[s.category] || "construction";
          // Determine assignedPhase from section (more accurate than category)
          const assignedPhaseFromSection: SettingItem["assignedPhase"] =
            section === "design" ? "design" :
            section === "offplan" ? "offplan" :
            section === "construction" ? "construction" :
            section === "escrow" ? "construction" :
            CAT_TO_PHASE[s.category] || "construction";
          const assignedPhase = assignedPhaseFromSection;

          // Parse custom percentages from customJson if present
          let customPercentages: number[] = [];
          if (s.customJson) {
            try {
              const parsed = JSON.parse(s.customJson);
              if (Array.isArray(parsed)) customPercentages = parsed;
            } catch {}
          }

          // Determine phase month from lumpSumMonth
          const phaseStart = data.phases?.[assignedPhase]?.start || 1;
          const phaseMonth = s.lumpSumMonth != null
            ? Math.max(1, s.lumpSumMonth - phaseStart + 1)
            : 1;

          // Determine distribution method
          let distributionMethod: DistributionMethod = "lump_sum";
          if (s.distributionMethod === "equal_spread") distributionMethod = "equal_spread";
          else if (s.distributionMethod === "custom") distributionMethod = "custom";

          return {
            id: s.id,
            itemKey: s.itemKey,
            nameAr: s.nameAr,
            section,
            category: s.category,
            isActive: s.isActive !== false,
            sortOrder: s.sortOrder,
            distributionMethod,
            phaseMonth,
            customPercentages,
            assignedPhase: (assignedPhase) as SettingItem["assignedPhase"],
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

  function getPhaseDuration(phase: SettingItem["assignedPhase"]): number {
    if (phase === "design") return durations.design;
    if (phase === "offplan") return phases?.offplan?.duration || 2;
    if (phase === "construction") return durations.construction;
    if (phase === "handover") return durations.handover;
    return 1;
  }

  // Group items by section
  const groupedItems = useMemo(() => {
    const groups: Partial<Record<keyof typeof SECTION_META, SettingItem[]>> = {};
    for (const item of items) {
      if (!groups[item.section]) groups[item.section] = [];
      groups[item.section]!.push(item);
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
        const phaseStart = phases?.[item.assignedPhase]?.start || 1;
        const absoluteLumpSumMonth = item.distributionMethod === "lump_sum"
          ? phaseStart + item.phaseMonth - 1
          : null;

        const phaseData = phases?.[item.assignedPhase];
        const spreadStart = phaseData?.start ?? null;
        const spreadEnd = phaseData ? phaseData.start + phaseData.duration - 1 : null;

        return {
          itemKey: item.itemKey,
          nameAr: item.nameAr,
          // category is stored in the item from the server response
          category: (item as any).category || Object.entries(CAT_TO_SECTION).find(([, s]) => s === item.section)?.[0] || "other",
          section: item.section,
          isActive: item.isActive,
          sortOrder: item.sortOrder,
          amountOverride: null,
          distributionMethod: item.distributionMethod,
          lumpSumMonth: absoluteLumpSumMonth,
          startMonth: item.distributionMethod !== "lump_sum" ? spreadStart : null,
          endMonth: item.distributionMethod !== "lump_sum" ? spreadEnd : null,
          customJson: item.distributionMethod === "custom" ? JSON.stringify(item.customPercentages) : null,
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

  const totalMonths = durations.design + 2 + durations.construction + durations.handover;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
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

        {/* ── Project + Scenario selectors ── */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="flex flex-wrap items-end gap-4">
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

        {/* No project */}
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
            {/* ── Phase Durations ── */}
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
                        type="number" min={1} max={36}
                        value={durations.design}
                        onChange={(e) => { setDurations(d => ({ ...d, design: Number(e.target.value) || 6 })); setIsDurationDirty(true); }}
                        className="h-8 text-sm w-16 text-center font-bold" dir="ltr"
                      />
                      <span className="text-xs text-amber-700">شهر</span>
                    </div>
                    <div className="text-xs text-amber-600 mt-1">ش1 — ش{durations.design}</div>
                  </div>

                  {/* Offplan fixed */}
                  <div className="bg-violet-50 rounded-lg p-3 border border-violet-200">
                    <div className="text-xs font-semibold text-violet-800 mb-2">مرحلة أوف بلان</div>
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-16 flex items-center justify-center bg-violet-100 rounded border border-violet-200 text-sm font-bold text-violet-700">2</div>
                      <span className="text-xs text-violet-600">شهر (ثابت)</span>
                    </div>
                    <div className="text-xs text-violet-600 mt-1">ش{durations.design + 1} — ش{durations.design + 2}</div>
                  </div>

                  {/* Construction */}
                  <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-200">
                    <div className="text-xs font-semibold text-emerald-800 mb-2">مرحلة الإنشاء</div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number" min={1} max={60}
                        value={durations.construction}
                        onChange={(e) => { setDurations(d => ({ ...d, construction: Number(e.target.value) || 16 })); setIsDurationDirty(true); }}
                        className="h-8 text-sm w-16 text-center font-bold" dir="ltr"
                      />
                      <span className="text-xs text-emerald-700">شهر</span>
                    </div>
                    <div className="text-xs text-emerald-600 mt-1">ش{durations.design + 3} — ش{durations.design + 2 + durations.construction}</div>
                  </div>

                  {/* Handover */}
                  <div className="bg-sky-50 rounded-lg p-3 border border-sky-200">
                    <div className="text-xs font-semibold text-sky-800 mb-2">مرحلة التسليم</div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number" min={0} max={24}
                        value={durations.handover}
                        onChange={(e) => { setDurations(d => ({ ...d, handover: Number(e.target.value) || 2 })); setIsDurationDirty(true); }}
                        className="h-8 text-sm w-16 text-center font-bold" dir="ltr"
                      />
                      <span className="text-xs text-sky-700">شهر</span>
                    </div>
                    <div className="text-xs text-sky-600 mt-1">ش{durations.design + 3 + durations.construction} — ش{totalMonths}</div>
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

            {/* ── Info note ── */}
            {items.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 text-xs text-blue-800">
                <strong>ملاحظة:</strong> المبالغ تُعرض للمعلومية فقط وتأتي تلقائياً من البطاقة التعريفية ودراسة الجدوى.
                لكل بند: اختر طريقة التوزيع والمرحلة وتفاصيل الدفع.
              </div>
            )}

            {/* ── Sections ── */}
            {items.length > 0 && SECTION_ORDER.map(section => {
              const sectionItems = groupedItems[section];
              if (!sectionItems || sectionItems.length === 0) return null;
              const meta = SECTION_META[section];
              const sectionTotal = sectionItems.reduce((s, i) => s + (i.computedAmount || 0), 0);

              return (
                <div key={section} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  {/* Section header */}
                  <div className={`px-4 py-3 flex items-center gap-3 border-b ${meta.headerBg}`}>
                    <span className={`font-bold text-sm ${meta.headerText}`}>{meta.label}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${meta.badge}`}>
                      {sectionItems.length} بند
                    </span>
                    <span className="mr-auto text-xs font-semibold text-gray-700">
                      {fmt(sectionTotal)} د.إ
                    </span>
                  </div>

                  {/* Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500">
                          <th className="px-3 py-2 text-right font-medium min-w-[200px]">البند</th>
                          <th className="px-3 py-2 text-left font-medium w-36">المبلغ (د.إ)</th>
                          <th className="px-3 py-2 text-center font-medium w-32">مصدر التمويل</th>
                          <th className="px-3 py-2 text-right font-medium" colSpan={2}>طريقة التوزيع</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sectionItems.map(item => {
                          const phaseStart = (() => {
                            // Use actual phase start from server data when available
                            if (phases?.[item.assignedPhase]?.start) return phases[item.assignedPhase]!.start;
                            if (item.assignedPhase === "design") return 1;
                            if (item.assignedPhase === "offplan") return durations.design + 1;
                            if (item.assignedPhase === "construction") return durations.design + 3;
                            if (item.assignedPhase === "handover") return durations.design + 3 + durations.construction;
                            return 1;
                          })();
                          return (
                          <ItemRow
                            key={item.itemKey}
                            item={item}
                            phaseDuration={getPhaseDuration(item.assignedPhase)}
                            phaseStart={phaseStart}
                            onUpdate={(updates) => updateItem(item.itemKey, updates)}
                          />
                           );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}

            {/* ── Save / Reset ── */}
            {items.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex items-center justify-between">
                <div className="text-xs text-gray-500">
                  {isDirty
                    ? <span className="text-amber-600 font-medium">● يوجد تغييرات غير محفوظة في إعدادات التوزيع</span>
                    : <span className="text-emerald-600">✓ جميع الإعدادات محفوظة</span>
                  }
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline" size="sm"
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
            )}
          </>
        )}
      </div>
    </div>
  );
}
