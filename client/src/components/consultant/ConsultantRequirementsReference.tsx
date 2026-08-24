import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { default as Plus } from "lucide-react/dist/esm/icons/plus.js";
import { default as ShieldCheck } from "lucide-react/dist/esm/icons/shield-check.js";

type Workstream = "DESIGN" | "ENGINEERING" | "SUPERVISION" | "GENERAL";
type PricingBasis = "FIXED" | "MONTHLY" | "PERCENT_OF_FEE" | "MANUAL";

const WORKSTREAM_LABELS: Record<Workstream, string> = {
  DESIGN: "تصاميم",
  ENGINEERING: "استشارات هندسية",
  SUPERVISION: "إشراف",
  GENERAL: "متطلبات عامة",
};

const PRICING_LABELS: Record<PricingBasis, string> = {
  FIXED: "قيمة ثابتة",
  MONTHLY: "قيمة شهرية",
  PERCENT_OF_FEE: "نسبة من الأتعاب",
  MANUAL: "تُحدد للمشروع",
};

function formatAmount(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount).toLocaleString("en-US") : "—";
}

export function ConsultantRequirementsReference() {
  const utils = trpc.useUtils();
  const referenceQuery = trpc.consultantRequirements.reference.list.useQuery();
  const updateMutation = trpc.consultantRequirements.reference.update.useMutation({
    onSuccess: () => utils.consultantRequirements.reference.list.invalidate(),
  });
  const createMutation = trpc.consultantRequirements.reference.create.useMutation({
    onSuccess: () => {
      setNewItem({ requirementGroup: "متطلبات خاصة", label: "", workstream: "GENERAL", defaultGapValueAed: "", pricingBasis: "FIXED" });
      utils.consultantRequirements.reference.list.invalidate();
    },
  });
  const [newItem, setNewItem] = useState({
    requirementGroup: "متطلبات خاصة",
    label: "",
    workstream: "GENERAL" as Workstream,
    defaultGapValueAed: "",
    pricingBasis: "FIXED" as PricingBasis,
  });

  const items = (referenceQuery.data ?? []) as any[];
  const enabledCount = items.filter((item) => Number(item.default_enabled) === 1).length;
  const grouped = useMemo(() => {
    return items.reduce<Record<string, any[]>>((groups, item) => {
      const key = item.workstream as Workstream;
      (groups[key] ??= []).push(item);
      return groups;
    }, {});
  }, [items]);

  const update = (id: number, fields: Record<string, unknown>) => updateMutation.mutate({ id, fields });

  return (
    <div className="space-y-4" dir="rtl">
      <Card className="border-sky-200 bg-sky-50/70 shadow-none">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 font-bold text-slate-900"><ShieldCheck className="h-5 w-5 text-sky-700" />المرجع الموحد لمتطلبات الاستشاريين</div>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-600">هذه القائمة هي نقطة البداية فقط. عند إنشاء متطلبات مشروع، تُنسخ إلى نسخة مستقلة يمكن تشغيل أو إيقاف كل بند فيها وتعديل قيمته دون تغيير هذا المرجع أو أي مشروع آخر.</p>
          </div>
          <div className="flex gap-2 text-center">
            <Badge className="border-sky-200 bg-white text-sky-800">{items.length} بند مرجعي</Badge>
            <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800">{enabledCount} مفعّل افتراضيًا</Badge>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-none">
        <CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_1.4fr_180px_160px_auto] md:items-end">
          <div><Label className="text-xs">المجموعة</Label><Input value={newItem.requirementGroup} onChange={(e) => setNewItem({ ...newItem, requirementGroup: e.target.value })} className="mt-1" /></div>
          <div><Label className="text-xs">بند جديد</Label><Input value={newItem.label} onChange={(e) => setNewItem({ ...newItem, label: e.target.value })} placeholder="مثال: دراسة حركة المرور" className="mt-1" /></div>
          <div><Label className="text-xs">المسار</Label><Select value={newItem.workstream} onValueChange={(value: Workstream) => setNewItem({ ...newItem, workstream: value })}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(WORKSTREAM_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
          <div><Label className="text-xs">قيمة فجوة افتتاحية</Label><Input type="number" min="0" value={newItem.defaultGapValueAed} onChange={(e) => setNewItem({ ...newItem, defaultGapValueAed: e.target.value })} placeholder="اختياري" className="mt-1" /></div>
          <Button className="gap-1" disabled={!newItem.label.trim() || createMutation.isPending} onClick={() => createMutation.mutate({ requirementGroup: newItem.requirementGroup, label: newItem.label, workstream: newItem.workstream, defaultGapValueAed: newItem.defaultGapValueAed === "" ? null : Number(newItem.defaultGapValueAed), pricingBasis: newItem.pricingBasis })}><Plus className="h-4 w-4" />إضافة</Button>
        </CardContent>
      </Card>

      {referenceQuery.isLoading ? <div className="py-10 text-center text-sm text-slate-500">جاري تحميل المرجع…</div> : (
        <div className="space-y-5">
          {(Object.keys(WORKSTREAM_LABELS) as Workstream[]).map((workstream) => {
            const groupItems = grouped[workstream] ?? [];
            if (!groupItems.length) return null;
            return (
              <section key={workstream} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3"><h3 className="font-bold text-slate-900">{WORKSTREAM_LABELS[workstream]}</h3><span className="text-xs text-slate-500">{groupItems.length} بند</span></div>
                <div className="overflow-x-auto">
                  <table className="min-w-[980px] w-full text-xs">
                    <thead className="bg-white text-slate-500"><tr className="border-b border-slate-100"><th className="p-3 text-right">البند</th><th className="p-3 text-right">المجموعة والمسار</th><th className="p-3 text-center">مفعّل افتراضيًا</th><th className="p-3 text-center">طريقة القيمة</th><th className="p-3 text-center">قيمة الفجوة</th><th className="p-3 text-center">المدة</th><th className="p-3 text-center">التخصيص</th><th className="p-3 text-center">المصدر</th></tr></thead>
                    <tbody>
                      {groupItems.map((item) => {
                        const enabled = Number(item.default_enabled) === 1;
                        const sourceLabel = item.source_type === "CUSTOM" ? "مضاف يدويًا" : item.source_type === "LEGACY_SUPERVISION" ? "دور إشراف قائم" : "بند نطاق قائم";
                        return <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50/70"><td className="p-3"><div className="font-semibold text-slate-800">{item.label}</div><div className="mt-0.5 text-[11px] text-slate-500">{item.code || "بدون رمز"}</div></td><td className="min-w-[230px] p-2"><Input defaultValue={item.requirement_group} key={`${item.id}-${item.requirement_group}`} onBlur={(e) => update(item.id, { requirementGroup: e.target.value.trim() || "متطلبات عامة" })} className="h-8 text-xs" /><Select value={item.workstream} onValueChange={(value: Workstream) => update(item.id, { workstream: value })}><SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(WORKSTREAM_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></td><td className="p-3 text-center"><div className="flex justify-center"><Switch checked={enabled} onCheckedChange={(checked) => update(item.id, { defaultEnabled: checked })} /></div></td><td className="p-2"><Select value={item.pricing_basis} onValueChange={(value: PricingBasis) => update(item.id, { pricingBasis: value })}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(PRICING_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></td><td className="p-2"><Input type="number" min="0" defaultValue={item.default_gap_value_aed ?? ""} key={`${item.id}-${item.default_gap_value_aed}`} onBlur={(e) => update(item.id, { defaultGapValueAed: e.target.value === "" ? null : Number(e.target.value) })} placeholder={formatAmount(item.default_gap_value_aed)} className="h-8 text-center text-xs" /></td><td className="p-2"><Input type="number" min="0" defaultValue={item.default_duration_months ?? ""} key={`${item.id}-${item.default_duration_months}`} onBlur={(e) => update(item.id, { defaultDurationMonths: e.target.value === "" ? null : Number(e.target.value) })} placeholder="—" className="h-8 text-center text-xs" /></td><td className="p-2"><Input type="number" min="0" max="500" defaultValue={item.default_allocation_pct ?? ""} key={`${item.id}-${item.default_allocation_pct}`} onBlur={(e) => update(item.id, { defaultAllocationPct: e.target.value === "" ? null : Number(e.target.value) })} placeholder="—" className="h-8 text-center text-xs" /></td><td className="p-3 text-center"><Badge variant="outline" className="text-[10px] font-normal">{sourceLabel}</Badge></td></tr>;
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
