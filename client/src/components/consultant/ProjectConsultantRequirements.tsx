import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { default as CheckCircle } from "lucide-react/dist/esm/icons/circle-check-big.js";
import { default as Copy } from "lucide-react/dist/esm/icons/copy.js";
import { default as Plus } from "lucide-react/dist/esm/icons/plus.js";

type Workstream = "DESIGN" | "ENGINEERING" | "SUPERVISION" | "GENERAL";
type PricingBasis = "FIXED" | "MONTHLY" | "PERCENT_OF_FEE" | "MANUAL";

const WORKSTREAMS: Record<Workstream, string> = { DESIGN: "تصاميم", ENGINEERING: "استشارات هندسية", SUPERVISION: "إشراف", GENERAL: "متطلبات عامة" };
const PRICING: Record<PricingBasis, string> = { FIXED: "قيمة ثابتة", MONTHLY: "قيمة شهرية", PERCENT_OF_FEE: "نسبة من الأتعاب", MANUAL: "تُحدد لاحقًا" };

export function ProjectConsultantRequirements({ projectId, projectName, onBack }: { projectId: number; projectName: string; onBack: () => void }) {
  const utils = trpc.useUtils();
  const currentQuery = trpc.consultantRequirements.project.getCurrent.useQuery({ projectId });
  const invalidate = () => utils.consultantRequirements.project.getCurrent.invalidate({ projectId });
  const createMutation = trpc.consultantRequirements.project.createFromReference.useMutation({ onSuccess: invalidate });
  const revisionMutation = trpc.consultantRequirements.project.createRevision.useMutation({ onSuccess: invalidate });
  const updateMutation = trpc.consultantRequirements.project.updateRequirement.useMutation({ onSuccess: invalidate });
  const addMutation = trpc.consultantRequirements.project.addCustomRequirement.useMutation({ onSuccess: () => { setCustom({ group: "متطلبات خاصة", label: "", workstream: "GENERAL", gapValue: "", pricing: "FIXED" }); invalidate(); } });
  const approveMutation = trpc.consultantRequirements.project.approve.useMutation({ onSuccess: invalidate });
  const [custom, setCustom] = useState({ group: "متطلبات خاصة", label: "", workstream: "GENERAL" as Workstream, gapValue: "", pricing: "FIXED" as PricingBasis });
  const data = currentQuery.data as any;
  const set = data?.set as any;
  const requirements = (data?.requirements ?? []) as any[];
  const isDraft = set?.status === "DRAFT";
  const requiredCount = requirements.filter((item) => Number(item.is_required) === 1).length;
  const grouped = useMemo(() => requirements.reduce<Record<string, any[]>>((acc, item) => { (acc[item.workstream] ??= []).push(item); return acc; }, {}), [requirements]);
  const update = (id: number, fields: Record<string, unknown>) => updateMutation.mutate({ id, fields });

  if (currentQuery.isLoading) return <div className="py-12 text-center text-sm text-slate-500">جاري تحميل متطلبات المشروع…</div>;

  if (!set) return (
    <div className="space-y-5" dir="rtl">
      <Card className="border-sky-200 bg-sky-50/70 shadow-none"><CardContent className="p-5"><h2 className="font-bold text-slate-900">متطلبات الاستشاريين — {projectName}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">لم تُنشأ مواصفة مالية لهذا المشروع بعد. سيُنسخ المرجع الموحد إلى مسودة مستقلة، ثم تختار بنفسك ما هو مطلوب وتعدل الأسعار والمدد والتخصيص قبل اعتماد معيار المقارنة.</p><div className="mt-4 flex flex-wrap gap-2"><Button onClick={() => createMutation.mutate({ projectId })} disabled={createMutation.isPending} className="gap-1"><Copy className="h-4 w-4" />إنشاء من المرجع الموحد</Button><Button variant="outline" onClick={onBack}>رجوع</Button></div></CardContent></Card>
    </div>
  );

  return (
    <div className="space-y-4" dir="rtl">
      <Card className={isDraft ? "border-amber-200 bg-amber-50/60 shadow-none" : "border-emerald-200 bg-emerald-50/60 shadow-none"}><CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2 font-bold text-slate-900">متطلبات المشروع — {projectName}<Badge className={isDraft ? "border-amber-200 bg-white text-amber-800" : "border-emerald-200 bg-white text-emerald-800"}>{isDraft ? "مسودة قابلة للتعديل" : "معيار مقارنة معتمد"}</Badge></div><p className="mt-1 text-xs leading-5 text-slate-600">مراجعة {set.revision_no}: {isDraft ? "لن تؤثر على أي عرض أو تقييم قبل الاعتماد." : "تُحفظ هذه المراجعة وتبقى مرجع المقارنة لهذا المشروع."}</p></div><div className="flex flex-wrap gap-2"><Badge variant="outline" className="bg-white">{requiredCount} بند مطلوب</Badge>{isDraft ? <Button size="sm" onClick={() => approveMutation.mutate({ setId: set.id })} disabled={!requiredCount || approveMutation.isPending} className="gap-1 bg-emerald-600 hover:bg-emerald-700"><CheckCircle className="h-4 w-4" />اعتماد معيار المقارنة</Button> : <Button size="sm" variant="outline" onClick={() => revisionMutation.mutate({ setId: set.id })} disabled={revisionMutation.isPending} className="gap-1"><Copy className="h-4 w-4" />إنشاء مراجعة جديدة</Button>}<Button size="sm" variant="outline" onClick={onBack}>رجوع</Button></div></CardContent></Card>

      {isDraft && <Card className="border-slate-200 shadow-none"><CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_1.3fr_150px_150px_auto] md:items-end"><div><Label className="text-xs">المجموعة</Label><Input className="mt-1" value={custom.group} onChange={(e) => setCustom({ ...custom, group: e.target.value })} /></div><div><Label className="text-xs">بند خاص بالمشروع</Label><Input className="mt-1" value={custom.label} onChange={(e) => setCustom({ ...custom, label: e.target.value })} placeholder="مثال: مراجعة متطلبات النخلة" /></div><div><Label className="text-xs">المسار</Label><Select value={custom.workstream} onValueChange={(value: Workstream) => setCustom({ ...custom, workstream: value })}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(WORKSTREAMS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div><div><Label className="text-xs">قيمة فجوة</Label><Input className="mt-1" type="number" min="0" value={custom.gapValue} onChange={(e) => setCustom({ ...custom, gapValue: e.target.value })} /></div><Button disabled={!custom.label.trim() || addMutation.isPending} onClick={() => addMutation.mutate({ setId: set.id, requirementGroup: custom.group, label: custom.label, workstream: custom.workstream, gapValueAed: custom.gapValue === "" ? null : Number(custom.gapValue), pricingBasis: custom.pricing })} className="gap-1"><Plus className="h-4 w-4" />إضافة</Button></CardContent></Card>}

      {(Object.keys(WORKSTREAMS) as Workstream[]).map((workstream) => {
        const items = grouped[workstream] ?? [];
        if (!items.length) return null;
        return <section key={workstream} className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3"><h3 className="font-bold text-slate-900">{WORKSTREAMS[workstream]}</h3><span className="text-xs text-slate-500">{items.length} بند</span></div><div className="overflow-x-auto"><table className="min-w-[1000px] w-full text-xs"><thead className="text-slate-500"><tr className="border-b border-slate-100"><th className="p-3 text-right">البند</th><th className="p-3 text-right">المجموعة</th><th className="p-3 text-center">مطلوب للمشروع</th><th className="p-3 text-center">التسعير</th><th className="p-3 text-center">قيمة الفجوة</th><th className="p-3 text-center">المدة</th><th className="p-3 text-center">التخصيص</th></tr></thead><tbody>{items.map((item) => <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50/70"><td className="p-3"><div className="font-semibold text-slate-800">{item.label}</div><div className="mt-0.5 text-[11px] text-slate-500">{item.code || (item.source_type === "CUSTOM" ? "بند خاص" : "من المرجع")}</div></td><td className="p-2"><Input defaultValue={item.requirement_group} key={`${item.id}-${item.requirement_group}`} disabled={!isDraft} className="h-8 text-xs" onBlur={(e) => update(item.id, { requirementGroup: e.target.value.trim() || "متطلبات عامة" })} /></td><td className="p-3 text-center"><div className="flex justify-center"><Switch checked={Number(item.is_required) === 1} disabled={!isDraft} onCheckedChange={(checked) => update(item.id, { isRequired: checked })} /></div></td><td className="p-2"><Select value={item.pricing_basis} disabled={!isDraft} onValueChange={(value: PricingBasis) => update(item.id, { pricingBasis: value })}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(PRICING).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></td><td className="p-2"><Input type="number" min="0" disabled={!isDraft} defaultValue={item.gap_value_aed ?? ""} key={`${item.id}-${item.gap_value_aed}`} className="h-8 text-center text-xs" onBlur={(e) => update(item.id, { gapValueAed: e.target.value === "" ? null : Number(e.target.value) })} /></td><td className="p-2"><Input type="number" min="0" disabled={!isDraft} defaultValue={item.duration_months ?? ""} key={`${item.id}-${item.duration_months}`} className="h-8 text-center text-xs" onBlur={(e) => update(item.id, { durationMonths: e.target.value === "" ? null : Number(e.target.value) })} /></td><td className="p-2"><Input type="number" min="0" max="500" disabled={!isDraft} defaultValue={item.allocation_pct ?? ""} key={`${item.id}-${item.allocation_pct}`} className="h-8 text-center text-xs" onBlur={(e) => update(item.id, { allocationPct: e.target.value === "" ? null : Number(e.target.value) })} /></td></tr>)}</tbody></table></div></section>;
      })}
    </div>
  );
}
