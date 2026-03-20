/**
 * CashFlowSettingsPage — جدول إعدادات التدفق النقدي
 *
 * Allows the user to configure how each cost/revenue item is distributed
 * across the project timeline. Settings are saved per project + scenario.
 *
 * Layout:
 *  - Top: Project selector + Scenario selector
 *  - Main: Settings Table (جدول الإعدادات) — one row per item
 *  - Bottom: Save / Reset buttons
 */

import { useState, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import {
  Settings2, Save, RotateCcw, ChevronDown, ChevronUp, Info,
  Building2, Calendar, DollarSign, Layers, ArrowLeft
} from "lucide-react";
import { Link } from "wouter";

// ─── Types ────────────────────────────────────────────────────────────────────

type Scenario = "offplan_escrow" | "offplan_construction" | "no_offplan";
type DistributionMethod = "lump_sum" | "equal_spread" | "custom";
type FundingSource = "investor" | "escrow";
type Category = "land" | "design" | "offplan_reg" | "construction" | "marketing_sales" | "admin" | "developer_fee" | "revenue" | "other";

interface SettingItem {
  id?: number;
  itemKey: string;
  nameAr: string;
  category: Category;
  isActive: boolean;
  sortOrder: number;
  amountOverride: number | null;
  distributionMethod: DistributionMethod;
  lumpSumMonth: number | null;
  startMonth: number | null;
  endMonth: number | null;
  customJson: string | null;
  fundingSource: FundingSource;
  notes: string | null;
  computedAmount?: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SCENARIO_LABELS: Record<Scenario, string> = {
  offplan_escrow: "أوف بلان مع إيداع في حساب الضمان",
  offplan_construction: "أوف بلان بعد إنجاز 20% من الإنشاء",
  no_offplan: "تطوير بدون بيع على الخارطة",
};

const DISTRIBUTION_LABELS: Record<DistributionMethod, string> = {
  lump_sum: "دفعة واحدة",
  equal_spread: "توزيع متساوٍ",
  custom: "مخصص",
};

const CATEGORY_LABELS: Record<Category, string> = {
  land: "الأرض",
  design: "التصاميم",
  offplan_reg: "تسجيل أوف بلان",
  construction: "الإنشاء",
  marketing_sales: "التسويق والمبيعات",
  admin: "إدارية",
  developer_fee: "أتعاب المطور",
  revenue: "الإيرادات",
  other: "أخرى",
};

const CATEGORY_COLORS: Record<Category, string> = {
  land: "bg-stone-100 text-stone-800 border-stone-300",
  design: "bg-amber-100 text-amber-800 border-amber-300",
  offplan_reg: "bg-violet-100 text-violet-800 border-violet-300",
  construction: "bg-sky-100 text-sky-800 border-sky-300",
  marketing_sales: "bg-pink-100 text-pink-800 border-pink-300",
  admin: "bg-slate-100 text-slate-700 border-slate-300",
  developer_fee: "bg-orange-100 text-orange-800 border-orange-300",
  revenue: "bg-emerald-100 text-emerald-800 border-emerald-300",
  other: "bg-gray-100 text-gray-700 border-gray-300",
};

const FUNDING_LABELS: Record<FundingSource, string> = {
  investor: "المستثمر",
  escrow: "حساب الضمان",
};

function fmt(n: number): string {
  if (!n || isNaN(n)) return "—";
  return n.toLocaleString("ar-AE", { maximumFractionDigits: 0 });
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CashFlowSettingsPage({
  embedded,
  initialProjectId,
  onNavigateToReflection,
}: {
  embedded?: boolean;
  initialProjectId?: number | null;
  onNavigateToReflection?: () => void;
} = {}) {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();

  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(initialProjectId ?? null);
  const [scenario, setScenario] = useState<Scenario>("offplan_escrow");
  const [items, setItems] = useState<SettingItem[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

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
      toast({ title: "تم الحفظ", description: "تم حفظ إعدادات التدفق النقدي بنجاح" });
      setIsDirty(false);
      settingsQuery.refetch();
    },
    onError: (err) => {
      toast({ title: "خطأ في الحفظ", description: err.message, variant: "destructive" });
    },
  });

  const resetSettingsMutation = trpc.cashFlowSettings.resetSettings.useMutation({
    onSuccess: () => {
      toast({ title: "تم الإعادة", description: "تم إعادة الإعدادات إلى القيم الافتراضية" });
      setIsDirty(false);
      settingsQuery.refetch();
    },
  });

  // Load settings into local state when query returns
  useEffect(() => {
    if (settingsQuery.data?.settings) {
      setItems(settingsQuery.data.settings.map(s => ({
        id: s.id,
        itemKey: s.itemKey,
        nameAr: s.nameAr,
        category: s.category as Category,
        isActive: s.isActive !== false && (s as any).isActive !== 0,
        sortOrder: s.sortOrder,
        amountOverride: s.amountOverride != null ? Number(s.amountOverride) : null,
        distributionMethod: s.distributionMethod as DistributionMethod,
        lumpSumMonth: s.lumpSumMonth ?? null,
        startMonth: s.startMonth ?? null,
        endMonth: s.endMonth ?? null,
        customJson: s.customJson ?? null,
        fundingSource: s.fundingSource as FundingSource,
        notes: s.notes ?? null,
        computedAmount: (s as any).computedAmount ?? 0,
      })));
      setIsDirty(false);
    }
  }, [settingsQuery.data]);

  const data = settingsQuery.data;
  const totalMonths = data?.totalMonths || 24;
  const phases = data?.phases;

  // Group items by category
  const groupedItems = useMemo(() => {
    const groups: Record<Category, SettingItem[]> = {
      land: [], design: [], offplan_reg: [], construction: [],
      marketing_sales: [], admin: [], developer_fee: [], revenue: [], other: [],
    };
    for (const item of items) {
      groups[item.category]?.push(item);
    }
    return groups;
  }, [items]);

  function updateItem(itemKey: string, updates: Partial<SettingItem>) {
    setItems(prev => prev.map(item =>
      item.itemKey === itemKey ? { ...item, ...updates } : item
    ));
    setIsDirty(true);
  }

  function toggleExpand(itemKey: string) {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(itemKey)) next.delete(itemKey);
      else next.add(itemKey);
      return next;
    });
  }

  function handleSave() {
    if (!selectedProjectId) return;
    saveSettingsMutation.mutate({
      projectId: selectedProjectId,
      scenario,
      items: items.map(item => ({
        itemKey: item.itemKey,
        nameAr: item.nameAr,
        category: item.category,
        isActive: item.isActive,
        sortOrder: item.sortOrder,
        amountOverride: item.amountOverride,
        distributionMethod: item.distributionMethod,
        lumpSumMonth: item.lumpSumMonth,
        startMonth: item.startMonth,
        endMonth: item.endMonth,
        customJson: item.customJson,
        fundingSource: item.fundingSource,
        notes: item.notes,
      })),
    });
  }

  function handleReset() {
    if (!selectedProjectId) return;
    if (!confirm("هل تريد إعادة الإعدادات إلى القيم الافتراضية؟")) return;
    resetSettingsMutation.mutate({ projectId: selectedProjectId, scenario });
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const selectedProject = (projectsQuery.data || []).find((p: any) => p.id === selectedProjectId);

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Header */}
      {!embedded && (
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between max-w-screen-2xl mx-auto">
            <div className="flex items-center gap-3">
              <Settings2 className="w-6 h-6 text-blue-600" />
              <div>
                <h1 className="text-xl font-bold text-gray-900">إعدادات التدفق النقدي</h1>
                <p className="text-sm text-gray-500">تكوين توزيع التكاليف والإيرادات عبر الزمن</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {onNavigateToReflection && (
                <Button variant="outline" size="sm" onClick={onNavigateToReflection} className="gap-2">
                  <Layers className="w-4 h-4" />
                  جدول الانعكاس
                </Button>
              )}
              <Link href="/excel-cashflow">
                <Button variant="ghost" size="sm" className="gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  التدفق النقدي
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-screen-2xl mx-auto px-4 py-6 space-y-6">
        {/* Controls Row */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="flex flex-wrap items-end gap-4">
            {/* Project Selector */}
            <div className="flex-1 min-w-[200px]">
              <Label className="text-sm font-medium text-gray-700 mb-1.5 block">المشروع</Label>
              <Select
                value={selectedProjectId?.toString() || ""}
                onValueChange={(v) => {
                  setSelectedProjectId(Number(v));
                  setIsDirty(false);
                }}
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

            {/* Scenario Selector */}
            <div className="flex-1 min-w-[280px]">
              <Label className="text-sm font-medium text-gray-700 mb-1.5 block">سيناريو التمويل</Label>
              <Select value={scenario} onValueChange={(v) => { setScenario(v as Scenario); setIsDirty(false); }}>
                <SelectTrigger className="bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(SCENARIO_LABELS) as [Scenario, string][]).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Phase Info */}
            {phases && (
              <div className="flex flex-wrap gap-2">
                {[
                  { label: "التصاميم", color: "bg-amber-100 text-amber-800", start: phases.design.start, dur: phases.design.duration },
                  { label: "أوف بلان", color: "bg-violet-100 text-violet-800", start: phases.offplan.start, dur: phases.offplan.duration },
                  { label: "الإنشاء", color: "bg-sky-100 text-sky-800", start: phases.construction.start, dur: phases.construction.duration },
                  { label: "التسليم", color: "bg-emerald-100 text-emerald-800", start: phases.handover.start, dur: phases.handover.duration },
                ].map(ph => (
                  <div key={ph.label} className={`px-2.5 py-1 rounded-lg text-xs font-medium ${ph.color}`}>
                    {ph.label}: ش{ph.start}–ش{ph.start + ph.dur - 1}
                  </div>
                ))}
              </div>
            )}

            {/* Save / Reset */}
            <div className="flex gap-2 mr-auto">
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
                {saveSettingsMutation.isPending ? "جارٍ الحفظ..." : "حفظ الإعدادات"}
              </Button>
            </div>
          </div>

          {/* Status badges */}
          {selectedProjectId && data && (
            <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100">
              <span className="text-xs text-gray-500">
                {data.hasSavedSettings ? "✅ إعدادات محفوظة" : "⚙️ إعدادات افتراضية"}
              </span>
              <span className="text-xs text-gray-400">|</span>
              <span className="text-xs text-gray-500">إجمالي المدة: {totalMonths} شهر</span>
              {isDirty && (
                <>
                  <span className="text-xs text-gray-400">|</span>
                  <span className="text-xs text-amber-600 font-medium">● تغييرات غير محفوظة</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Loading State */}
        {settingsQuery.isLoading && (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-gray-500">جارٍ تحميل الإعدادات...</p>
          </div>
        )}

        {/* No project selected */}
        {!selectedProjectId && !settingsQuery.isLoading && (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">اختر مشروعاً لعرض إعدادات التدفق النقدي</p>
          </div>
        )}

        {/* Settings Table */}
        {selectedProjectId && !settingsQuery.isLoading && items.length > 0 && (
          <div className="space-y-4">
            {(Object.keys(CATEGORY_LABELS) as Category[]).map(category => {
              const catItems = groupedItems[category];
              if (!catItems || catItems.length === 0) return null;

              return (
                <div key={category} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  {/* Category Header */}
                  <div className={`px-4 py-2.5 flex items-center gap-2 border-b border-gray-100 ${
                    category === "land" ? "bg-stone-50" :
                    category === "design" ? "bg-amber-50" :
                    category === "offplan_reg" ? "bg-violet-50" :
                    category === "construction" ? "bg-sky-50" :
                    category === "marketing_sales" ? "bg-pink-50" :
                    category === "revenue" ? "bg-emerald-50" :
                    category === "developer_fee" ? "bg-orange-50" :
                    "bg-gray-50"
                  }`}>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${CATEGORY_COLORS[category]}`}>
                      {CATEGORY_LABELS[category]}
                    </span>
                    <span className="text-xs text-gray-400">{catItems.length} بند</span>
                    <span className="mr-auto text-xs text-gray-500">
                      إجمالي: {fmt(catItems.reduce((s, i) => s + (i.amountOverride ?? i.computedAmount ?? 0), 0))} د.إ
                    </span>
                  </div>

                  {/* Table */}
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500">
                        <th className="px-3 py-2 text-right font-medium w-8">تفعيل</th>
                        <th className="px-3 py-2 text-right font-medium">البند</th>
                        <th className="px-3 py-2 text-right font-medium w-32">المبلغ (د.إ)</th>
                        <th className="px-3 py-2 text-right font-medium w-36">طريقة التوزيع</th>
                        <th className="px-3 py-2 text-right font-medium w-40">الأشهر</th>
                        <th className="px-3 py-2 text-right font-medium w-28">مصدر التمويل</th>
                        <th className="px-3 py-2 text-center font-medium w-8">تفاصيل</th>
                      </tr>
                    </thead>
                    <tbody>
                      {catItems.map((item, idx) => (
                        <>
                          <tr
                            key={item.itemKey}
                            className={`border-b border-gray-50 transition-colors ${
                              !item.isActive ? "opacity-40" : ""
                            } ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}
                          >
                            {/* Active Toggle */}
                            <td className="px-3 py-2.5">
                              <Switch
                                checked={item.isActive}
                                onCheckedChange={(v) => updateItem(item.itemKey, { isActive: v })}
                                className="scale-75"
                              />
                            </td>

                            {/* Name */}
                            <td className="px-3 py-2.5">
                              <span className="font-medium text-gray-800">{item.nameAr}</span>
                            </td>

                            {/* Amount */}
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-1">
                                <Input
                                  type="number"
                                  value={item.amountOverride ?? ""}
                                  placeholder={fmt(item.computedAmount || 0)}
                                  onChange={(e) => updateItem(item.itemKey, {
                                    amountOverride: e.target.value ? Number(e.target.value) : null
                                  })}
                                  className="h-7 text-xs w-28 text-left"
                                  dir="ltr"
                                />
                                {item.amountOverride == null && (
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <Info className="w-3 h-3 text-gray-400" />
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                      <p className="text-xs">القيمة المحسوبة تلقائياً من بيانات المشروع</p>
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                              </div>
                            </td>

                            {/* Distribution Method */}
                            <td className="px-3 py-2.5">
                              <Select
                                value={item.distributionMethod}
                                onValueChange={(v) => updateItem(item.itemKey, { distributionMethod: v as DistributionMethod })}
                              >
                                <SelectTrigger className="h-7 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {(Object.entries(DISTRIBUTION_LABELS) as [DistributionMethod, string][]).map(([k, l]) => (
                                    <SelectItem key={k} value={k} className="text-xs">{l}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>

                            {/* Month Range */}
                            <td className="px-3 py-2.5">
                              {item.distributionMethod === "lump_sum" ? (
                                <div className="flex items-center gap-1">
                                  <span className="text-xs text-gray-500">شهر</span>
                                  <Input
                                    type="number"
                                    min={0}
                                    max={totalMonths}
                                    value={item.lumpSumMonth ?? ""}
                                    onChange={(e) => updateItem(item.itemKey, { lumpSumMonth: e.target.value ? Number(e.target.value) : null })}
                                    className="h-7 text-xs w-16"
                                    dir="ltr"
                                  />
                                </div>
                              ) : item.distributionMethod === "equal_spread" ? (
                                <div className="flex items-center gap-1">
                                  <Input
                                    type="number"
                                    min={1}
                                    max={totalMonths}
                                    value={item.startMonth ?? ""}
                                    onChange={(e) => updateItem(item.itemKey, { startMonth: e.target.value ? Number(e.target.value) : null })}
                                    className="h-7 text-xs w-14"
                                    dir="ltr"
                                    placeholder="من"
                                  />
                                  <span className="text-xs text-gray-400">—</span>
                                  <Input
                                    type="number"
                                    min={1}
                                    max={totalMonths}
                                    value={item.endMonth ?? ""}
                                    onChange={(e) => updateItem(item.itemKey, { endMonth: e.target.value ? Number(e.target.value) : null })}
                                    className="h-7 text-xs w-14"
                                    dir="ltr"
                                    placeholder="إلى"
                                  />
                                </div>
                              ) : (
                                <span className="text-xs text-gray-400 italic">JSON مخصص</span>
                              )}
                            </td>

                            {/* Funding Source */}
                            <td className="px-3 py-2.5">
                              <Select
                                value={item.fundingSource}
                                onValueChange={(v) => updateItem(item.itemKey, { fundingSource: v as FundingSource })}
                              >
                                <SelectTrigger className="h-7 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="investor" className="text-xs">المستثمر</SelectItem>
                                  <SelectItem value="escrow" className="text-xs">حساب الضمان</SelectItem>
                                </SelectContent>
                              </Select>
                            </td>

                            {/* Expand toggle */}
                            <td className="px-3 py-2.5 text-center">
                              <button
                                onClick={() => toggleExpand(item.itemKey)}
                                className="text-gray-400 hover:text-gray-600 transition-colors"
                              >
                                {expandedRows.has(item.itemKey)
                                  ? <ChevronUp className="w-4 h-4" />
                                  : <ChevronDown className="w-4 h-4" />
                                }
                              </button>
                            </td>
                          </tr>

                          {/* Expanded Row — Custom JSON + Notes */}
                          {expandedRows.has(item.itemKey) && (
                            <tr key={`${item.itemKey}-expanded`} className="bg-blue-50/30">
                              <td colSpan={7} className="px-4 py-3">
                                <div className="grid grid-cols-2 gap-4">
                                  {item.distributionMethod === "custom" && (
                                    <div>
                                      <Label className="text-xs font-medium text-gray-600 mb-1 block">
                                        توزيع مخصص (JSON)
                                      </Label>
                                      <textarea
                                        value={item.customJson || ""}
                                        onChange={(e) => updateItem(item.itemKey, { customJson: e.target.value })}
                                        className="w-full h-20 text-xs font-mono border border-gray-200 rounded-lg p-2 resize-none"
                                        dir="ltr"
                                        placeholder='[{"month": 1, "pct": 30}, {"month": 2, "pct": 70}]'
                                      />
                                    </div>
                                  )}
                                  <div>
                                    <Label className="text-xs font-medium text-gray-600 mb-1 block">ملاحظات</Label>
                                    <textarea
                                      value={item.notes || ""}
                                      onChange={(e) => updateItem(item.itemKey, { notes: e.target.value })}
                                      className="w-full h-16 text-xs border border-gray-200 rounded-lg p-2 resize-none"
                                      placeholder="ملاحظات اختيارية..."
                                    />
                                  </div>
                                  <div className="text-xs text-gray-500 space-y-1">
                                    <div><span className="font-medium">المبلغ المحسوب:</span> {fmt(item.computedAmount || 0)} د.إ</div>
                                    {item.amountOverride != null && (
                                      <div className="text-amber-600"><span className="font-medium">تجاوز يدوي:</span> {fmt(item.amountOverride)} د.إ</div>
                                    )}
                                    <div><span className="font-medium">مفتاح البند:</span> <code className="bg-gray-100 px-1 rounded">{item.itemKey}</code></div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}

            {/* Summary Footer */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <div className="grid grid-cols-3 gap-6">
                <div className="text-center">
                  <p className="text-xs text-gray-500 mb-1">إجمالي التكاليف (المستثمر)</p>
                  <p className="text-lg font-bold text-blue-700">
                    {fmt(items.filter(i => i.isActive && i.fundingSource === "investor" && i.category !== "revenue")
                      .reduce((s, i) => s + (i.amountOverride ?? i.computedAmount ?? 0), 0))} د.إ
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500 mb-1">إجمالي التكاليف (الضمان)</p>
                  <p className="text-lg font-bold text-violet-700">
                    {fmt(items.filter(i => i.isActive && i.fundingSource === "escrow" && i.category !== "revenue")
                      .reduce((s, i) => s + (i.amountOverride ?? i.computedAmount ?? 0), 0))} د.إ
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500 mb-1">إجمالي الإيرادات</p>
                  <p className="text-lg font-bold text-emerald-700">
                    {fmt(items.filter(i => i.isActive && i.category === "revenue")
                      .reduce((s, i) => s + (i.amountOverride ?? i.computedAmount ?? 0), 0))} د.إ
                  </p>
                </div>
              </div>
            </div>

            {/* Bottom Save Bar */}
            {isDirty && (
              <div className="sticky bottom-4 bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center justify-between shadow-lg">
                <span className="text-sm text-amber-700 font-medium">● لديك تغييرات غير محفوظة</span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => settingsQuery.refetch()}
                    className="text-gray-600"
                  >
                    تجاهل
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={saveSettingsMutation.isPending}
                    className="bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    <Save className="w-3.5 h-3.5 ml-1" />
                    حفظ الآن
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
