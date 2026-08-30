import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { default as CheckCircle } from "lucide-react/dist/esm/icons/circle-check-big.js";
import { default as Copy } from "lucide-react/dist/esm/icons/copy.js";
import { default as Search } from "lucide-react/dist/esm/icons/search.js";
import { default as Save } from "lucide-react/dist/esm/icons/save.js";

type ScopeGroup = "DESIGN" | "SUPERVISION";
const GROUP_LABELS: Record<ScopeGroup, string> = { DESIGN: "نطاق التصميم والخدمات الاستشارية", SUPERVISION: "نطاق الإشراف" };

export function ProjectConsultantRequirements({ projectId, projectName, onBack }: { projectId: number; projectName: string; onBack: () => void }) {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const currentQuery = trpc.consultantRequirements.project.getCurrent.useQuery({ projectId });
  const invalidate = () => utils.consultantRequirements.project.getCurrent.invalidate({ projectId });
  const createMutation = trpc.consultantRequirements.project.createFromReference.useMutation({ onSuccess: invalidate, onError: (error) => toast({ title: "تعذر تهيئة النطاق", description: error.message, variant: "destructive" }) });
  const revisionMutation = trpc.consultantRequirements.project.createRevision.useMutation({ onSuccess: invalidate });
  const updateMutation = trpc.consultantRequirements.project.updateRequirement.useMutation({ onSuccess: invalidate });
  const saveSelectionMutation = trpc.consultantRequirements.project.saveSelection.useMutation({
    onSuccess: () => { invalidate(); toast({ title: "تم حفظ نطاق المشروع" }); },
    onError: (error) => toast({ title: "تعذر حفظ النطاق", description: error.message, variant: "destructive" }),
  });
  const approveMutation = trpc.consultantRequirements.project.approve.useMutation({ onSuccess: invalidate });
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const data = currentQuery.data as any;
  const set = data?.set as any;
  const requirements = (data?.requirements ?? []) as any[];
  const isDraft = set?.status === "DRAFT";
  useEffect(() => {
    setSelectedIds(new Set(requirements.filter((item) => Number(item.is_required) === 1).map((item) => Number(item.id))));
  }, [set?.id, requirements.length]);
  const requiredCount = selectedIds.size;
  const grouped = useMemo(() => {
    const term = search.trim().toLowerCase();
    return requirements.reduce<Record<ScopeGroup, any[]>>((acc, item) => {
      const haystack = `${item.label ?? ""} ${item.code ?? ""} ${item.requirement_group ?? ""}`.toLowerCase();
      if (term && !haystack.includes(term)) return acc;
      const group: ScopeGroup = item.reference_source_type === "LEGACY_SUPERVISION" ? "SUPERVISION" : "DESIGN";
      acc[group].push(item);
      return acc;
    }, { DESIGN: [], SUPERVISION: [] });
  }, [requirements, search]);
  const update = (id: number, fields: Record<string, unknown>) => updateMutation.mutate({ id, fields });
  const toggle = (id: number, checked: boolean) => setSelectedIds((current) => {
    const next = new Set(current);
    if (checked) next.add(id); else next.delete(id);
    return next;
  });
  const saveSelection = () => saveSelectionMutation.mutate({ setId: Number(set.id), requirementIds: Array.from(selectedIds) });
  const approveSelection = async () => {
    try {
      await saveSelectionMutation.mutateAsync({ setId: Number(set.id), requirementIds: Array.from(selectedIds) });
      await approveMutation.mutateAsync({ setId: Number(set.id) });
      toast({ title: "تم اعتماد نطاق المشروع للمقارنة" });
    } catch {
      // Mutation callbacks show the actionable error.
    }
  };

  if (currentQuery.isLoading) return <div className="py-12 text-center text-sm text-slate-500">جاري تحميل متطلبات المشروع…</div>;

  if (!set) return (
    <div className="space-y-5" dir="rtl">
      <Card className="border-sky-200 bg-sky-50/70 shadow-none"><CardContent className="p-5"><h2 className="font-bold text-slate-900">نطاق المشروع — {projectName}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">سيُنشأ لهذا المشروع نطاق مستقل من المكتبة الشاملة الحالية. لن يُضاف أي بند جديد ولن يتأثر أي مشروع آخر.</p><div className="mt-4 flex flex-wrap gap-2"><Button onClick={() => createMutation.mutate({ projectId })} disabled={createMutation.isPending} className="gap-1"><Copy className="h-4 w-4" />تهيئة نطاق المشروع</Button><Button variant="outline" onClick={onBack}>رجوع</Button></div></CardContent></Card>
    </div>
  );

  return (
    <div className="space-y-4" dir="rtl">
      <Card className={isDraft ? "border-amber-200 bg-amber-50/60 shadow-none" : "border-emerald-200 bg-emerald-50/60 shadow-none"}><CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex flex-wrap items-center gap-2 font-bold text-slate-900">نطاق المشروع — {projectName}<Badge className={isDraft ? "border-amber-200 bg-white text-amber-800" : "border-emerald-200 bg-white text-emerald-800"}>{isDraft ? "قابل للتعديل" : "معتمد"}</Badge></div><p className="mt-1 text-xs leading-5 text-slate-600">هذه نسخة مستقلة خاصة بهذا المشروع من المكتبة الشاملة الحالية؛ اختيار أي بند أو إلغاؤه لا يغيّر المكتبة ولا مشاريع أخرى.</p></div><div className="flex flex-wrap gap-2"><Badge variant="outline" className="bg-white">{requiredCount} بند مختار</Badge>{isDraft ? <><Button size="sm" onClick={saveSelection} disabled={saveSelectionMutation.isPending} className="gap-1"><Save className="h-4 w-4" />حفظ الاختيارات</Button><Button size="sm" variant="outline" onClick={approveSelection} disabled={!requiredCount || approveMutation.isPending || saveSelectionMutation.isPending} className="gap-1 border-emerald-300 text-emerald-700"><CheckCircle className="h-4 w-4" />اعتماد للمقارنة</Button></> : <Button size="sm" variant="outline" onClick={() => revisionMutation.mutate({ setId: set.id })} disabled={revisionMutation.isPending} className="gap-1"><Copy className="h-4 w-4" />تعديل النطاق</Button>}<Button size="sm" variant="outline" onClick={onBack}>رجوع</Button></div></CardContent></Card>

      <div className="relative"><Search className="absolute right-3 top-3 h-4 w-4 text-slate-400" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ابحث في بنود التصميم أو الإشراف…" className="pr-9" /></div>

      {(Object.keys(GROUP_LABELS) as ScopeGroup[]).map((workstream) => {
        const items = grouped[workstream];
        if (!items.length) return null;
        const visibleIds = items.map((item) => Number(item.id));
        const allVisibleSelected = visibleIds.every((id) => selectedIds.has(id));
        return <section key={workstream} className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3"><div><h3 className="font-bold text-slate-900">{GROUP_LABELS[workstream]}</h3><span className="text-xs text-slate-500">{items.length} بند من المكتبة الشاملة</span></div>{isDraft && <Button size="sm" variant="outline" onClick={() => setSelectedIds((current) => { const next = new Set(current); visibleIds.forEach((id) => allVisibleSelected ? next.delete(id) : next.add(id)); return next; })}>{allVisibleSelected ? "إلغاء اختيار الظاهر" : "اختيار الظاهر"}</Button>}</div><div className="overflow-x-auto"><table className="min-w-[760px] w-full text-xs"><thead className="text-slate-500"><tr className="border-b border-slate-100"><th className="p-3 text-right">البند الموجود</th><th className="p-3 text-center">ضمن نطاق المشروع</th><th className="p-3 text-right">المجموعة</th><th className="p-3 text-center">قيمة الفجوة / المعدل</th><th className="p-3 text-center">التخصيص</th></tr></thead><tbody>{items.map((item) => <tr key={item.id} className={selectedIds.has(Number(item.id)) ? "border-b border-sky-100 bg-sky-50/40" : "border-b border-slate-100 hover:bg-slate-50/70"}><td className="p-3"><div className="font-semibold text-slate-800">{item.label}</div><div className="mt-0.5 text-[11px] text-slate-500">{item.code || "من المكتبة الشاملة"}</div></td><td className="p-3 text-center"><div className="flex justify-center"><Switch checked={selectedIds.has(Number(item.id))} disabled={!isDraft} onCheckedChange={(checked) => toggle(Number(item.id), checked)} /></div></td><td className="p-3 text-slate-600">{item.requirement_group}</td><td className="p-2"><Input type="number" min="0" disabled={!isDraft || !selectedIds.has(Number(item.id))} defaultValue={item.gap_value_aed ?? ""} key={`${item.id}-${item.gap_value_aed}`} className="h-8 text-center text-xs" onBlur={(e) => update(item.id, { gapValueAed: e.target.value === "" ? null : Number(e.target.value) })} /></td><td className="p-2">{workstream === "SUPERVISION" ? <Input type="number" min="0" max="500" disabled={!isDraft || !selectedIds.has(Number(item.id))} defaultValue={item.allocation_pct ?? ""} key={`${item.id}-${item.allocation_pct}`} className="h-8 text-center text-xs" placeholder="100" onBlur={(e) => update(item.id, { allocationPct: e.target.value === "" ? null : Number(e.target.value) })} /> : <div className="text-center text-slate-400">—</div>}</td></tr>)}</tbody></table></div></section>;
      })}
    </div>
  );
}
