/**
 * قواعد توزيع التكاليف
 * Cost Distribution Rules — Two-level editable table
 *
 * Level 1: Default template rules (applies to all projects unless overridden)
 * Level 2: Per-project overrides (project-specific values and schedules)
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Check, X, Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type Installment = { month: number; pct: number };

type Rule = {
  id: number;
  sortOrder: number;
  itemKey: string;
  nameAr: string;
  nameEn?: string | null;
  amountType: string;
  fixedAmount?: string | null;
  pctValue?: string | null;
  source: string;
  primaryPhase: string;
  distributionMethod: string;
  relativeMonth?: number | null;
  splitRatioJson?: string | null;
  periodicIntervalMonths?: number | null;
  periodicAmount?: string | null;
  customJson?: string | null;
  notes?: string | null;
  isActive: number;
  phaseStartMonth?: number | null;
  phaseEndMonth?: number | null;
  paymentScheduleJson?: string | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const PHASE_LABELS: Record<string, string> = {
  land: "المرحلة 1 — الأرض",
  design: "المرحلة 2 — التصاميم",
  offplan: "المرحلة 3 — أوف بلان",
  construction: "المرحلة 4 — الإنشاء",
  handover: "المرحلة 5 — التسليم",
};

const PHASE_COLORS: Record<string, string> = {
  land: "bg-gray-100 text-gray-700 border-gray-300",
  design: "bg-purple-50 text-purple-700 border-purple-200",
  offplan: "bg-blue-50 text-blue-700 border-blue-200",
  construction: "bg-green-50 text-green-700 border-green-200",
  handover: "bg-orange-50 text-orange-700 border-orange-200",
};

const SOURCE_LABELS: Record<string, string> = {
  investor: "مستثمر",
  escrow: "التدفقات النقدية وحساب الضمان",
};

const DIST_LABELS: Record<string, string> = {
  lump_sum: "دفعة واحدة",
  equal_spread: "موزع بالتساوي",
  split_ratio: "نسب محددة",
  sales_linked: "مرتبط بالمبيعات",
  periodic: "دوري",
  custom: "مخصص",
};

const AMOUNT_LABELS: Record<string, string> = {
  fixed: "مبلغ ثابت",
  pct_construction: "% من البناء",
  pct_revenue: "% من الإيرادات",
  pct_land: "% من الأرض",
};

function parseSchedule(json?: string | null): Installment[] {
  if (!json) return [];
  try { return JSON.parse(json); } catch { return []; }
}

function formatAmount(rule: Rule): string {
  if (rule.amountType === "fixed" && rule.fixedAmount) {
    return Number(rule.fixedAmount).toLocaleString("ar-AE") + " د.إ";
  }
  if (rule.pctValue) {
    const label = AMOUNT_LABELS[rule.amountType] || rule.amountType;
    return `${rule.pctValue}% (${label})`;
  }
  return "—";
}

// ── Schedule Editor ───────────────────────────────────────────────────────────

function ScheduleEditor({
  schedule,
  onChange,
}: {
  schedule: Installment[];
  onChange: (s: Installment[]) => void;
}) {
  const total = schedule.reduce((s, i) => s + i.pct, 0);

  const update = (idx: number, field: "month" | "pct", val: number) => {
    const next = schedule.map((item, i) =>
      i === idx ? { ...item, [field]: val } : item
    );
    onChange(next);
  };

  const remove = (idx: number) => onChange(schedule.filter((_, i) => i !== idx));

  const add = () => onChange([...schedule, { month: schedule.length + 1, pct: 0 }]);

  return (
    <div className="space-y-1">
      {schedule.map((item, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-12">شهر</span>
          <Input
            type="number"
            min={1}
            value={item.month}
            onChange={(e) => update(idx, "month", Number(e.target.value))}
            className="h-7 w-16 text-xs text-center"
          />
          <span className="text-xs text-muted-foreground w-6">%</span>
          <Input
            type="number"
            min={0}
            max={100}
            value={item.pct}
            onChange={(e) => update(idx, "pct", Number(e.target.value))}
            className="h-7 w-16 text-xs text-center"
          />
          <button onClick={() => remove(idx)} className="text-red-400 hover:text-red-600">
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={add}
          className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
        >
          <Plus className="w-3 h-3" /> إضافة دفعة
        </button>
        <span className={`text-xs ml-auto font-medium ${total === 100 ? "text-green-600" : "text-red-500"}`}>
          المجموع: {total}%
        </span>
      </div>
    </div>
  );
}

// ── Rule Row ──────────────────────────────────────────────────────────────────

function RuleRow({ rule, onSave }: { rule: Rule; onSave: (updated: Partial<Rule> & { id: number }) => void }) {
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState<Rule>(rule);
  const [schedule, setSchedule] = useState<Installment[]>(parseSchedule(rule.paymentScheduleJson));

  const handleSave = () => {
    onSave({
      ...draft,
      paymentScheduleJson: JSON.stringify(schedule),
    });
    setEditing(false);
  };

  const handleCancel = () => {
    setDraft(rule);
    setSchedule(parseSchedule(rule.paymentScheduleJson));
    setEditing(false);
  };

  const scheduleItems = parseSchedule(rule.paymentScheduleJson);

  return (
    <>
      <tr className="border-b hover:bg-muted/30 transition-colors">
        {/* Expand toggle */}
        <td className="px-2 py-2 w-8">
          <button onClick={() => setExpanded(!expanded)} className="text-muted-foreground hover:text-foreground">
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </td>

        {/* Name */}
        <td className="px-3 py-2">
          {editing ? (
            <Input value={draft.nameAr} onChange={(e) => setDraft({ ...draft, nameAr: e.target.value })}
              className="h-7 text-sm" />
          ) : (
            <span className="text-sm font-medium">{rule.nameAr}</span>
          )}
        </td>

        {/* Amount */}
        <td className="px-3 py-2 text-sm text-right">
          {editing ? (
            <div className="flex gap-1">
              <Select value={draft.amountType} onValueChange={(v) => setDraft({ ...draft, amountType: v })}>
                <SelectTrigger className="h-7 text-xs w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(AMOUNT_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                value={draft.amountType === "fixed" ? (draft.fixedAmount ?? "") : (draft.pctValue ?? "")}
                onChange={(e) => {
                  if (draft.amountType === "fixed") setDraft({ ...draft, fixedAmount: e.target.value });
                  else setDraft({ ...draft, pctValue: e.target.value });
                }}
                className="h-7 w-24 text-xs text-right"
              />
            </div>
          ) : (
            <span className="font-mono text-xs">{formatAmount(rule)}</span>
          )}
        </td>

        {/* Source */}
        <td className="px-3 py-2">
          {editing ? (
            <Select value={draft.source} onValueChange={(v) => setDraft({ ...draft, source: v })}>
              <SelectTrigger className="h-7 text-xs w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="investor">مستثمر</SelectItem>
                <SelectItem value="escrow">حساب الضمان</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <Badge variant="outline" className={`text-xs ${rule.source === "escrow" ? "border-blue-300 text-blue-700 bg-blue-50" : "border-gray-300 text-gray-700"}`}>
              {SOURCE_LABELS[rule.source] ?? rule.source}
            </Badge>
          )}
        </td>

        {/* Distribution */}
        <td className="px-3 py-2">
          {editing ? (
            <Select value={draft.distributionMethod} onValueChange={(v) => setDraft({ ...draft, distributionMethod: v })}>
              <SelectTrigger className="h-7 text-xs w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(DIST_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className="text-xs text-muted-foreground">{DIST_LABELS[rule.distributionMethod] ?? rule.distributionMethod}</span>
          )}
        </td>

        {/* Schedule summary */}
        <td className="px-3 py-2">
          {scheduleItems.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {scheduleItems.map((s, i) => (
                <span key={i} className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                  ش{s.month}: {s.pct}%
                </span>
              ))}
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </td>

        {/* Actions */}
        <td className="px-3 py-2 w-20">
          {editing ? (
            <div className="flex gap-1">
              <button onClick={handleSave} className="text-green-600 hover:text-green-800">
                <Check className="w-4 h-4" />
              </button>
              <button onClick={handleCancel} className="text-red-400 hover:text-red-600">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button onClick={() => setEditing(true)} className="text-muted-foreground hover:text-foreground">
              <Pencil className="w-4 h-4" />
            </button>
          )}
        </td>
      </tr>

      {/* Expanded schedule editor */}
      {expanded && (
        <tr className="bg-muted/20">
          <td colSpan={7} className="px-8 py-3">
            <div className="max-w-sm">
              <p className="text-xs font-semibold text-muted-foreground mb-2">جدول الدفعات (شهر من بداية المرحلة — نسبة %)</p>
              {editing ? (
                <ScheduleEditor schedule={schedule} onChange={setSchedule} />
              ) : (
                scheduleItems.length > 0 ? (
                  <table className="text-xs w-full">
                    <thead>
                      <tr className="text-muted-foreground">
                        <th className="text-right pb-1">الشهر</th>
                        <th className="text-right pb-1">النسبة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scheduleItems.map((s, i) => (
                        <tr key={i} className="border-t">
                          <td className="py-0.5">الشهر {s.month}</td>
                          <td className="py-0.5">{s.pct}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-xs text-muted-foreground">لا يوجد جدول دفعات محدد</p>
                )
              )}
              {rule.notes && (
                <p className="text-xs text-muted-foreground mt-2 italic">{rule.notes}</p>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Phase Section ─────────────────────────────────────────────────────────────

function PhaseSection({ phase, rules, onSave }: {
  phase: string;
  rules: Rule[];
  onSave: (updated: Partial<Rule> & { id: number }) => void;
}) {
  const phaseTotal = rules.reduce((sum, r) => {
    if (r.amountType === "fixed" && r.fixedAmount) return sum + Number(r.fixedAmount);
    return sum;
  }, 0);

  return (
    <div className="mb-6">
      <div className={`flex items-center justify-between px-4 py-2 rounded-t-lg border ${PHASE_COLORS[phase] ?? ""}`}>
        <h3 className="font-semibold text-sm">{PHASE_LABELS[phase] ?? phase}</h3>
        <div className="flex items-center gap-3">
          <span className="text-xs opacity-70">{rules.length} بند</span>
          {phaseTotal > 0 && (
            <span className="text-xs font-mono font-semibold">
              {phaseTotal.toLocaleString("ar-AE")} د.إ (ثابت)
            </span>
          )}
        </div>
      </div>
      <div className="border border-t-0 rounded-b-lg overflow-hidden">
        <table className="w-full text-right" dir="rtl">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-2 py-2 w-8"></th>
              <th className="px-3 py-2 text-right">البند</th>
              <th className="px-3 py-2 text-right">المبلغ / النسبة</th>
              <th className="px-3 py-2 text-right">المصدر</th>
              <th className="px-3 py-2 text-right">طريقة التوزيع</th>
              <th className="px-3 py-2 text-right">جدول الدفعات</th>
              <th className="px-3 py-2 w-20"></th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => (
              <RuleRow key={rule.id} rule={rule} onSave={onSave} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CostDistributionRulesPage() {
  const { toast } = useToast();
  const { data: rules = [], refetch } = trpc.costDistributionRules.list.useQuery();
  const updateMutation = trpc.costDistributionRules.update.useMutation({
    onSuccess: () => { refetch(); toast({ title: "تم الحفظ", description: "تم تحديث القاعدة بنجاح" }); },
    onError: () => toast({ title: "خطأ", description: "فشل الحفظ", variant: "destructive" }),
  });

  const handleSave = (updated: Partial<Rule> & { id: number }) => {
    const original = rules.find((r) => r.id === updated.id);
    if (!original) return;
    const merged = { ...original, ...updated };
    updateMutation.mutate({
      id: merged.id,
      sortOrder: merged.sortOrder ?? 0,
      itemKey: merged.itemKey,
      nameAr: merged.nameAr,
      nameEn: merged.nameEn ?? null,
      amountType: merged.amountType as any,
      fixedAmount: merged.fixedAmount ? Number(merged.fixedAmount) : null,
      pctValue: merged.pctValue ? Number(merged.pctValue) : null,
      source: merged.source as any,
      primaryPhase: merged.primaryPhase as any,
      distributionMethod: merged.distributionMethod as any,
      relativeMonth: merged.relativeMonth ?? null,
      splitRatioJson: merged.splitRatioJson ?? null,
      periodicIntervalMonths: merged.periodicIntervalMonths ?? null,
      periodicAmount: merged.periodicAmount ? Number(merged.periodicAmount) : null,
      customJson: merged.customJson ?? null,
      notes: merged.notes ?? null,
      isActive: merged.isActive ?? 1,
    });
  };

  const phases = ["land", "design", "offplan", "construction"];
  const byPhase = (phase: string) => rules.filter((r) => r.primaryPhase === phase && r.isActive !== 0);

  const totalInvestor = rules.filter(r => r.source === "investor" && r.amountType === "fixed" && r.fixedAmount)
    .reduce((s, r) => s + Number(r.fixedAmount), 0);
  const totalEscrow = rules.filter(r => r.source === "escrow" && r.amountType === "fixed" && r.fixedAmount)
    .reduce((s, r) => s + Number(r.fixedAmount), 0);

  return (
    <DashboardLayout>
      <div className="p-6 max-w-7xl mx-auto" dir="rtl">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold">قواعد توزيع التكاليف</h1>
          <p className="text-muted-foreground text-sm mt-1">
            القاعدة الافتراضية لكل بند — المبلغ، المصدر، المرحلة، وجدول الدفعات. قابلة للتعديل لكل مشروع على حدة.
          </p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-card border rounded-lg p-4">
            <p className="text-xs text-muted-foreground">إجمالي التكاليف</p>
            <p className="text-lg font-bold font-mono mt-1">{(totalInvestor + totalEscrow).toLocaleString("ar-AE")}</p>
            <p className="text-xs text-muted-foreground">درهم (البنود الثابتة)</p>
          </div>
          <div className="bg-card border rounded-lg p-4">
            <p className="text-xs text-muted-foreground">من المستثمر</p>
            <p className="text-lg font-bold font-mono mt-1 text-amber-600">{totalInvestor.toLocaleString("ar-AE")}</p>
            <p className="text-xs text-muted-foreground">درهم</p>
          </div>
          <div className="bg-card border rounded-lg p-4">
            <p className="text-xs text-muted-foreground">من حساب الضمان</p>
            <p className="text-lg font-bold font-mono mt-1 text-blue-600">{totalEscrow.toLocaleString("ar-AE")}</p>
            <p className="text-xs text-muted-foreground">درهم</p>
          </div>
          <div className="bg-card border rounded-lg p-4">
            <p className="text-xs text-muted-foreground">عدد البنود</p>
            <p className="text-lg font-bold mt-1">{rules.filter(r => r.isActive !== 0).length}</p>
            <p className="text-xs text-muted-foreground">بند نشط</p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="template">
          <TabsList className="mb-4">
            <TabsTrigger value="template">القاعدة الافتراضية</TabsTrigger>
            <TabsTrigger value="project">تخصيص مشروع</TabsTrigger>
          </TabsList>

          {/* Tab 1: Default template */}
          <TabsContent value="template">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-sm text-amber-800">
              <strong>تعليمات:</strong> هذه هي القيم الافتراضية التي تُطبَّق على جميع المشاريع. اضغط على أيقونة التعديل ✏️ لتغيير أي بند. اضغط على السهم ← لعرض وتعديل جدول الدفعات التفصيلي.
            </div>
            {phases.map((phase) => (
              <PhaseSection
                key={phase}
                phase={phase}
                rules={byPhase(phase)}
                onSave={handleSave}
              />
            ))}
          </TabsContent>

          {/* Tab 2: Project overrides */}
          <TabsContent value="project">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
              <strong>قريباً:</strong> هنا ستتمكن من اختيار مشروع محدد وتعديل قيم أي بند (النسبة، المبلغ، جدول الدفعات) بشكل مستقل دون التأثير على القاعدة الافتراضية.
              <br /><br />
              مثال: أتعاب التصميم في مشروع ند الشبا = 1.5% بدلاً من 2%، مع جدول دفعات مختلف.
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
