import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import {
  Pencil, Trash2, Plus, Save, X, ChevronDown, ChevronUp, Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";

// ── Types ────────────────────────────────────────────────────────────────────

type Rule = {
  id: number;
  sortOrder: number;
  itemKey: string;
  nameAr: string;
  nameEn?: string | null;
  amountType: "fixed" | "pct_construction" | "pct_revenue" | "pct_land";
  fixedAmount?: string | null;
  pctValue?: string | null;
  source: "investor" | "escrow";
  primaryPhase: "land" | "design" | "offplan" | "construction" | "handover";
  distributionMethod: "lump_sum" | "equal_spread" | "split_ratio" | "sales_linked" | "periodic" | "custom";
  relativeMonth?: number | null;
  splitRatioJson?: string | null;
  periodicIntervalMonths?: number | null;
  periodicAmount?: string | null;
  customJson?: string | null;
  notes?: string | null;
  isActive: number;
};

type EditForm = Omit<Rule, "id" | "isActive">;

// ── Labels ───────────────────────────────────────────────────────────────────

const PHASE_LABELS: Record<string, string> = {
  land: "الأرض",
  design: "التصاميم",
  offplan: "أوف بلان",
  construction: "الإنشاء",
  handover: "التسليم",
};

const PHASE_COLORS: Record<string, string> = {
  land: "bg-amber-100 text-amber-800 border-amber-200",
  design: "bg-orange-100 text-orange-800 border-orange-200",
  offplan: "bg-pink-100 text-pink-800 border-pink-200",
  construction: "bg-violet-100 text-violet-800 border-violet-200",
  handover: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

const SOURCE_LABELS: Record<string, string> = {
  investor: "مستثمر",
  escrow: "حساب الضمان",
};

const SOURCE_COLORS: Record<string, string> = {
  investor: "bg-blue-100 text-blue-800 border-blue-200",
  escrow: "bg-teal-100 text-teal-800 border-teal-200",
};

const AMOUNT_TYPE_LABELS: Record<string, string> = {
  fixed: "مبلغ ثابت",
  pct_construction: "% من الإنشاء",
  pct_revenue: "% من الإيرادات",
  pct_land: "% من الأرض",
};

const DIST_METHOD_LABELS: Record<string, string> = {
  lump_sum: "دفعة واحدة",
  equal_spread: "موزع بالتساوي",
  split_ratio: "نسب موزعة",
  sales_linked: "مرتبط بالمبيعات",
  periodic: "دوري",
  custom: "مخصص",
};

const PHASE_ORDER = ["land", "design", "offplan", "construction", "handover"];

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatAmount(rule: Rule): string {
  if (rule.amountType === "fixed") {
    const n = parseFloat(rule.fixedAmount ?? "0");
    if (!n) return "—";
    return n.toLocaleString("en-US") + " د.إ";
  }
  const pct = parseFloat(rule.pctValue ?? "0");
  if (!pct) return "—";
  return (pct * 100).toFixed(2) + "%";
}

function emptyForm(): EditForm {
  return {
    sortOrder: 0,
    itemKey: "",
    nameAr: "",
    nameEn: "",
    amountType: "fixed",
    fixedAmount: null,
    pctValue: null,
    source: "investor",
    primaryPhase: "design",
    distributionMethod: "lump_sum",
    relativeMonth: 1,
    splitRatioJson: null,
    periodicIntervalMonths: null,
    periodicAmount: null,
    customJson: null,
    notes: "",
  };
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function CostDistributionRulesPage() {
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();

  const { data: rules = [], isLoading } = trpc.costDistributionRules.list.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  const createMutation = trpc.costDistributionRules.create.useMutation({
    onSuccess: () => { utils.costDistributionRules.list.invalidate(); toast.success("تم إضافة البند"); setShowAddForm(false); },
    onError: (e) => toast.error("خطأ: " + e.message),
  });
  const updateMutation = trpc.costDistributionRules.update.useMutation({
    onSuccess: () => { utils.costDistributionRules.list.invalidate(); toast.success("تم الحفظ"); setEditingId(null); },
    onError: (e) => toast.error("خطأ: " + e.message),
  });
  const deleteMutation = trpc.costDistributionRules.delete.useMutation({
    onSuccess: () => { utils.costDistributionRules.list.invalidate(); toast.success("تم الحذف"); },
    onError: (e) => toast.error("خطأ: " + e.message),
  });

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<EditForm>(emptyForm());
  const [showAddForm, setShowAddForm] = useState(false);
  const [newForm, setNewForm] = useState<EditForm>(emptyForm());
  const [expandedPhase, setExpandedPhase] = useState<string | null>(null);

  // Group rules by phase
  const grouped = useMemo(() => {
    const map: Record<string, Rule[]> = {};
    for (const phase of PHASE_ORDER) map[phase] = [];
    for (const r of rules) {
      if (map[r.primaryPhase]) map[r.primaryPhase].push(r);
    }
    return map;
  }, [rules]);

  // Totals per source
  const totals = useMemo(() => {
    let investor = 0, escrow = 0;
    for (const r of rules) {
      if (r.amountType === "fixed" && r.fixedAmount) {
        const n = parseFloat(r.fixedAmount);
        if (r.source === "investor") investor += n;
        else escrow += n;
      }
    }
    return { investor, escrow };
  }, [rules]);

  function startEdit(rule: Rule) {
    setEditingId(rule.id);
    setEditForm({
      sortOrder: rule.sortOrder,
      itemKey: rule.itemKey,
      nameAr: rule.nameAr,
      nameEn: rule.nameEn ?? "",
      amountType: rule.amountType,
      fixedAmount: rule.fixedAmount ?? null,
      pctValue: rule.pctValue ?? null,
      source: rule.source,
      primaryPhase: rule.primaryPhase,
      distributionMethod: rule.distributionMethod,
      relativeMonth: rule.relativeMonth ?? 1,
      splitRatioJson: rule.splitRatioJson ?? null,
      periodicIntervalMonths: rule.periodicIntervalMonths ?? null,
      periodicAmount: rule.periodicAmount ?? null,
      customJson: rule.customJson ?? null,
      notes: rule.notes ?? "",
    });
  }

  function saveEdit(id: number) {
    updateMutation.mutate({
      id,
      ...editForm,
      fixedAmount: editForm.fixedAmount ? parseFloat(editForm.fixedAmount as string) : null,
      pctValue: editForm.pctValue ? parseFloat(editForm.pctValue as string) : null,
      periodicAmount: editForm.periodicAmount ? parseFloat(editForm.periodicAmount as string) : null,
      isActive: 1,
    });
  }

  function saveNew() {
    createMutation.mutate({
      ...newForm,
      fixedAmount: newForm.fixedAmount ? parseFloat(newForm.fixedAmount as string) : null,
      pctValue: newForm.pctValue ? parseFloat(newForm.pctValue as string) : null,
      periodicAmount: newForm.periodicAmount ? parseFloat(newForm.periodicAmount as string) : null,
      isActive: 1,
    });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="p-6 max-w-7xl mx-auto" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">قواعد توزيع التكاليف</h1>
            <p className="text-sm text-muted-foreground mt-1">
              الجدول الأساسي لكل بند تكلفة — المصدر والمرحلة وطريقة الصرف
            </p>
          </div>
          <Button
            onClick={() => { setShowAddForm(true); setNewForm(emptyForm()); }}
            className="gap-2"
          >
            <Plus className="w-4 h-4" />
            إضافة بند
          </Button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="rounded-xl border bg-card p-4">
            <div className="text-xs text-muted-foreground mb-1">إجمالي البنود</div>
            <div className="text-2xl font-bold">{rules.length}</div>
          </div>
          <div className="rounded-xl border bg-blue-50 dark:bg-blue-950 p-4">
            <div className="text-xs text-muted-foreground mb-1">بنود المستثمر</div>
            <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
              {rules.filter(r => r.source === "investor").length}
            </div>
          </div>
          <div className="rounded-xl border bg-teal-50 dark:bg-teal-950 p-4">
            <div className="text-xs text-muted-foreground mb-1">بنود حساب الضمان</div>
            <div className="text-2xl font-bold text-teal-700 dark:text-teal-300">
              {rules.filter(r => r.source === "escrow").length}
            </div>
          </div>
        </div>

        {/* Add form */}
        {showAddForm && (
          <div className="mb-6 rounded-xl border border-primary/30 bg-primary/5 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">إضافة بند جديد</h3>
              <Button variant="ghost" size="sm" onClick={() => setShowAddForm(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <RuleForm form={newForm} onChange={setNewForm} />
            <div className="flex gap-2 mt-3">
              <Button size="sm" onClick={saveNew} disabled={createMutation.isPending}>
                <Save className="w-4 h-4 ml-1" /> حفظ
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowAddForm(false)}>إلغاء</Button>
            </div>
          </div>
        )}

        {/* Rules grouped by phase */}
        {PHASE_ORDER.map((phase) => {
          const phaseRules = grouped[phase] || [];
          if (phaseRules.length === 0) return null;
          const isExpanded = expandedPhase === null || expandedPhase === phase;

          return (
            <div key={phase} className="mb-4 rounded-xl border overflow-hidden">
              {/* Phase header */}
              <button
                className="w-full flex items-center justify-between px-4 py-3 bg-muted/50 hover:bg-muted transition-colors"
                onClick={() => setExpandedPhase(isExpanded && expandedPhase === phase ? null : phase)}
              >
                <div className="flex items-center gap-3">
                  <Badge className={`text-xs border ${PHASE_COLORS[phase]}`}>
                    {PHASE_LABELS[phase]}
                  </Badge>
                  <span className="text-sm font-medium">{phaseRules.length} بند</span>
                </div>
                {expandedPhase === phase ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {/* Table */}
              {(expandedPhase === null || expandedPhase === phase) && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/20 text-muted-foreground text-xs">
                        <th className="text-right px-3 py-2 font-medium w-8">#</th>
                        <th className="text-right px-3 py-2 font-medium">البند</th>
                        <th className="text-right px-3 py-2 font-medium">المبلغ / النسبة</th>
                        <th className="text-right px-3 py-2 font-medium">نوع المبلغ</th>
                        <th className="text-right px-3 py-2 font-medium">المصدر</th>
                        <th className="text-right px-3 py-2 font-medium">طريقة الصرف</th>
                        <th className="text-right px-3 py-2 font-medium">ملاحظات</th>
                        <th className="px-3 py-2 w-20"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {phaseRules.map((rule, idx) => (
                        editingId === rule.id ? (
                          <tr key={rule.id} className="border-b bg-yellow-50 dark:bg-yellow-950/20">
                            <td className="px-3 py-2 text-muted-foreground">{idx + 1}</td>
                            <td colSpan={6} className="px-3 py-2">
                              <RuleForm form={editForm} onChange={setEditForm} compact />
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex gap-1">
                                <Button size="sm" variant="default" className="h-7 px-2" onClick={() => saveEdit(rule.id)} disabled={updateMutation.isPending}>
                                  <Save className="w-3 h-3" />
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setEditingId(null)}>
                                  <X className="w-3 h-3" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          <tr key={rule.id} className="border-b hover:bg-muted/30 transition-colors">
                            <td className="px-3 py-2 text-muted-foreground text-xs">{idx + 1}</td>
                            <td className="px-3 py-2">
                              <div className="font-medium">{rule.nameAr}</div>
                              {rule.nameEn && <div className="text-xs text-muted-foreground">{rule.nameEn}</div>}
                            </td>
                            <td className="px-3 py-2 font-mono text-sm font-semibold">
                              {formatAmount(rule)}
                            </td>
                            <td className="px-3 py-2">
                              <span className="text-xs text-muted-foreground">
                                {AMOUNT_TYPE_LABELS[rule.amountType]}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              <Badge className={`text-xs border ${SOURCE_COLORS[rule.source]}`}>
                                {SOURCE_LABELS[rule.source]}
                              </Badge>
                            </td>
                            <td className="px-3 py-2">
                              <span className="text-xs">{DIST_METHOD_LABELS[rule.distributionMethod]}</span>
                              {rule.distributionMethod === "lump_sum" && rule.relativeMonth && (
                                <span className="text-xs text-muted-foreground mr-1">(شهر {rule.relativeMonth})</span>
                              )}
                              {rule.distributionMethod === "periodic" && rule.periodicIntervalMonths && (
                                <span className="text-xs text-muted-foreground mr-1">(كل {rule.periodicIntervalMonths} أشهر)</span>
                              )}
                            </td>
                            <td className="px-3 py-2 max-w-[200px]">
                              {rule.notes && (
                                <Tooltip>
                                  <TooltipTrigger>
                                    <Info className="w-3.5 h-3.5 text-muted-foreground" />
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-xs text-xs">
                                    {rule.notes}
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex gap-1">
                                <Button
                                  size="sm" variant="ghost" className="h-7 px-2 text-muted-foreground hover:text-foreground"
                                  onClick={() => startEdit(rule)}
                                >
                                  <Pencil className="w-3 h-3" />
                                </Button>
                                <Button
                                  size="sm" variant="ghost" className="h-7 px-2 text-muted-foreground hover:text-destructive"
                                  onClick={() => {
                                    if (confirm("هل تريد حذف هذا البند؟")) deleteMutation.mutate({ id: rule.id });
                                  }}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        )
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </TooltipProvider>
  );
}

// ── Rule Form Component ───────────────────────────────────────────────────────

function RuleForm({
  form,
  onChange,
  compact = false,
}: {
  form: EditForm;
  onChange: (f: EditForm) => void;
  compact?: boolean;
}) {
  const set = (key: keyof EditForm, val: unknown) => onChange({ ...form, [key]: val });

  return (
    <div className={`grid gap-2 ${compact ? "grid-cols-4" : "grid-cols-2 md:grid-cols-4"}`}>
      {/* Name Arabic */}
      <div className={compact ? "" : "col-span-2"}>
        <label className="text-xs text-muted-foreground mb-1 block">اسم البند (عربي) *</label>
        <Input
          value={form.nameAr}
          onChange={e => set("nameAr", e.target.value)}
          placeholder="اسم البند بالعربي"
          className="h-8 text-sm"
          dir="rtl"
        />
      </div>

      {/* Name English */}
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">الاسم (إنجليزي)</label>
        <Input
          value={form.nameEn ?? ""}
          onChange={e => set("nameEn", e.target.value)}
          placeholder="English name"
          className="h-8 text-sm"
          dir="ltr"
        />
      </div>

      {/* Item Key */}
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">الكود (item_key)</label>
        <Input
          value={form.itemKey}
          onChange={e => set("itemKey", e.target.value.toLowerCase().replace(/\s+/g, "_"))}
          placeholder="land_cost"
          className="h-8 text-sm font-mono"
          dir="ltr"
        />
      </div>

      {/* Amount Type */}
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">نوع المبلغ *</label>
        <Select value={form.amountType} onValueChange={v => set("amountType", v)}>
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="fixed">مبلغ ثابت (د.إ)</SelectItem>
            <SelectItem value="pct_construction">% من تكلفة الإنشاء</SelectItem>
            <SelectItem value="pct_revenue">% من الإيرادات</SelectItem>
            <SelectItem value="pct_land">% من سعر الأرض</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Amount Value */}
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">
          {form.amountType === "fixed" ? "المبلغ (د.إ)" : "النسبة (مثال: 0.05 = 5%)"}
        </label>
        <Input
          type="number"
          value={form.amountType === "fixed" ? (form.fixedAmount ?? "") : (form.pctValue ?? "")}
          onChange={e => {
            if (form.amountType === "fixed") set("fixedAmount", e.target.value);
            else set("pctValue", e.target.value);
          }}
          placeholder={form.amountType === "fixed" ? "150000" : "0.0500"}
          className="h-8 text-sm font-mono"
          dir="ltr"
          step={form.amountType === "fixed" ? "1" : "0.0001"}
        />
      </div>

      {/* Source */}
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">المصدر *</label>
        <Select value={form.source} onValueChange={v => set("source", v)}>
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="investor">مستثمر</SelectItem>
            <SelectItem value="escrow">حساب الضمان</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Primary Phase */}
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">المرحلة *</label>
        <Select value={form.primaryPhase} onValueChange={v => set("primaryPhase", v)}>
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="land">الأرض</SelectItem>
            <SelectItem value="design">التصاميم</SelectItem>
            <SelectItem value="offplan">أوف بلان</SelectItem>
            <SelectItem value="construction">الإنشاء</SelectItem>
            <SelectItem value="handover">التسليم</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Distribution Method */}
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">طريقة الصرف *</label>
        <Select value={form.distributionMethod} onValueChange={v => set("distributionMethod", v)}>
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="lump_sum">دفعة واحدة</SelectItem>
            <SelectItem value="equal_spread">موزع بالتساوي</SelectItem>
            <SelectItem value="split_ratio">نسب موزعة على مراحل</SelectItem>
            <SelectItem value="sales_linked">مرتبط بالمبيعات</SelectItem>
            <SelectItem value="periodic">دوري (كل N أشهر)</SelectItem>
            <SelectItem value="custom">مخصص</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Relative Month (for lump_sum) */}
      {form.distributionMethod === "lump_sum" && (
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">الشهر النسبي (1=أول، -1=آخر)</label>
          <Input
            type="number"
            value={form.relativeMonth ?? 1}
            onChange={e => set("relativeMonth", parseInt(e.target.value))}
            className="h-8 text-sm font-mono"
            dir="ltr"
          />
        </div>
      )}

      {/* Periodic interval */}
      {form.distributionMethod === "periodic" && (
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">الفترة (أشهر)</label>
          <Input
            type="number"
            value={form.periodicIntervalMonths ?? ""}
            onChange={e => set("periodicIntervalMonths", parseInt(e.target.value))}
            className="h-8 text-sm font-mono"
            dir="ltr"
          />
        </div>
      )}

      {/* Split ratio JSON */}
      {form.distributionMethod === "split_ratio" && (
        <div className="col-span-2">
          <label className="text-xs text-muted-foreground mb-1 block">نسب التوزيع (JSON)</label>
          <Input
            value={form.splitRatioJson ?? ""}
            onChange={e => set("splitRatioJson", e.target.value)}
            placeholder='[{"phase":"design","ratio":0.30},{"phase":"construction","ratio":0.70}]'
            className="h-8 text-xs font-mono"
            dir="ltr"
          />
        </div>
      )}

      {/* Notes */}
      <div className={compact ? "col-span-2" : "col-span-2 md:col-span-4"}>
        <label className="text-xs text-muted-foreground mb-1 block">ملاحظات</label>
        <Input
          value={form.notes ?? ""}
          onChange={e => set("notes", e.target.value)}
          placeholder="ملاحظات أو شرح إضافي"
          className="h-8 text-sm"
          dir="rtl"
        />
      </div>

      {/* Sort Order */}
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">ترتيب العرض</label>
        <Input
          type="number"
          value={form.sortOrder}
          onChange={e => set("sortOrder", parseInt(e.target.value))}
          className="h-8 text-sm font-mono"
          dir="ltr"
          step="10"
        />
      </div>
    </div>
  );
}
