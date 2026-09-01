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

function cleanGroupLabel(value: unknown) {
  return String(value || "نطاق التصميم").replace(/^\d+\s*[—-]\s*/, "");
}

export function ProjectConsultantRequirements({ projectId, projectName, onBack }: { projectId: number; projectName: string; onBack: () => void }) {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const currentQuery = trpc.consultantRequirements.project.getCurrent.useQuery({ projectId });
  const invalidate = () => utils.consultantRequirements.project.getCurrent.invalidate({ projectId });
  const createMutation = trpc.consultantRequirements.project.createFromReference.useMutation({ onSuccess: invalidate, onError: (error) => toast({ title: "تعذر تهيئة نطاق التصميم", description: error.message, variant: "destructive" }) });
  const revisionMutation = trpc.consultantRequirements.project.createRevision.useMutation({ onSuccess: invalidate });
  const saveSelectionMutation = trpc.consultantRequirements.project.saveSelection.useMutation({
    onSuccess: () => { invalidate(); toast({ title: "تم حفظ نطاق التصميم للمشروع" }); },
    onError: (error) => toast({ title: "تعذر حفظ نطاق التصميم", description: error.message, variant: "destructive" }),
  });
  const approveMutation = trpc.consultantRequirements.project.approve.useMutation({ onSuccess: invalidate });
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const data = currentQuery.data as any;
  const set = data?.set as any;
  const requirements = ((data?.requirements ?? []) as any[]).filter((item) => item.workstream === "DESIGN");
  const isDraft = set?.status === "DRAFT";
  const isFinalEncyclopedia = String(set?.notes ?? "").startsWith("DESIGN_SCOPE_ENCYCLOPEDIA_V1");

  useEffect(() => {
    setSelectedIds(new Set(requirements.filter((item) => Number(item.is_required) === 1).map((item) => Number(item.id))));
  }, [set?.id, requirements.length]);

  const grouped = useMemo(() => {
    const term = search.trim().toLowerCase();
    const groups = new Map<string, any[]>();
    requirements.forEach((item) => {
      const haystack = `${item.label ?? ""} ${item.description ?? ""} ${item.code ?? ""} ${item.requirement_group ?? ""}`.toLowerCase();
      if (term && !haystack.includes(term)) return;
      const group = String(item.requirement_group || "نطاق التصميم");
      const current = groups.get(group) ?? [];
      current.push(item);
      groups.set(group, current);
    });
    return Array.from(groups.entries());
  }, [requirements, search]);

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
      toast({ title: "تم اعتماد نطاق التصميم للمقارنة" });
    } catch {
      // Mutation callbacks show the actionable error.
    }
  };

  if (currentQuery.isLoading) return <div className="py-12 text-center text-sm text-slate-500">جاري تحميل نطاق التصميم…</div>;

  if (!set) return (
    <div className="space-y-5" dir="rtl">
      <Card className="border-sky-200 bg-sky-50/70 shadow-none"><CardContent className="p-5"><h2 className="font-bold text-slate-900">نطاق التصميم — {projectName}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">سيُنشأ لهذا المشروع نطاق مستقل من موسوعة التصميم النهائية ذات 43 بندًا. لا توجد تصنيفات مشاريع، ولا بنود قانونية أو إشرافية داخل هذه القائمة.</p><div className="mt-4 flex flex-wrap gap-2"><Button onClick={() => createMutation.mutate({ projectId })} disabled={createMutation.isPending} className="gap-1"><Copy className="h-4 w-4" />تهيئة نطاق التصميم</Button><Button variant="outline" onClick={onBack}>رجوع</Button></div></CardContent></Card>
    </div>
  );

  return (
    <div className="space-y-4" dir="rtl">
      <Card className={isDraft ? "border-amber-200 bg-amber-50/60 shadow-none" : "border-emerald-200 bg-emerald-50/60 shadow-none"}>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2 font-bold text-slate-900">
              {set?.title || `نطاق التصميم — ${projectName}`}
              <Badge className={isDraft ? "border-amber-200 bg-white text-amber-800" : "border-emerald-200 bg-white text-emerald-800"}>{isDraft ? "قابل للتعديل" : "معتمد"}</Badge>
              {isFinalEncyclopedia && <Badge className="border-sky-200 bg-white text-sky-700">موسوعة التصميم النهائية</Badge>}
            </div>
            <p className="mt-1 text-xs leading-5 text-slate-600">هذه نسخة مستقلة خاصة بمشروع {projectName}. اختر ما يحتاجه المشروع من البنود الـ43؛ لا يؤثر الحفظ في المكتبة أو في أي مشروع آخر.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="bg-white">{selectedIds.size} مختار من {requirements.length}</Badge>
            {isDraft ? <><Button size="sm" onClick={saveSelection} disabled={saveSelectionMutation.isPending} className="gap-1"><Save className="h-4 w-4" />حفظ الاختيارات</Button><Button size="sm" variant="outline" onClick={approveSelection} disabled={!selectedIds.size || approveMutation.isPending || saveSelectionMutation.isPending} className="gap-1 border-emerald-300 text-emerald-700"><CheckCircle className="h-4 w-4" />اعتماد نطاق التصميم</Button></> : <Button size="sm" variant="outline" onClick={() => revisionMutation.mutate({ setId: set.id })} disabled={revisionMutation.isPending} className="gap-1"><Copy className="h-4 w-4" />تعديل النطاق</Button>}
            <Button size="sm" variant="outline" onClick={onBack}>رجوع</Button>
          </div>
        </CardContent>
      </Card>

      <div className="relative"><Search className="absolute right-3 top-3 h-4 w-4 text-slate-400" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ابحث في بنود التصميم…" className="pr-9" /></div>

      {grouped.map(([group, items]) => {
        const visibleIds = items.map((item) => Number(item.id));
        const allVisibleSelected = visibleIds.every((id) => selectedIds.has(id));
        return (
          <section key={group} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
              <div><h3 className="font-bold text-slate-900">{cleanGroupLabel(group)}</h3><span className="text-xs text-slate-500">{items.length} بند تصميم</span></div>
              {isDraft && <Button size="sm" variant="outline" onClick={() => setSelectedIds((current) => { const next = new Set(current); visibleIds.forEach((id) => allVisibleSelected ? next.delete(id) : next.add(id)); return next; })}>{allVisibleSelected ? "إلغاء اختيار المجموعة" : "اختيار المجموعة"}</Button>}
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[760px] w-full table-fixed text-xs">
                <colgroup><col className="w-14" /><col className="w-[34%]" /><col /><col className="w-32" /></colgroup>
                <thead className="text-slate-500"><tr className="border-b border-slate-100"><th className="p-3 text-center">الرقم</th><th className="p-3 text-left">الاسم الإنجليزي الرسمي</th><th className="p-3 text-right">الشرح العربي للمعنى</th><th className="p-3 text-center">ضمن نطاق المشروع</th></tr></thead>
                <tbody>{items.map((item) => <tr key={item.id} className={selectedIds.has(Number(item.id)) ? "border-b border-sky-100 bg-sky-50/40 align-top" : "border-b border-slate-100 align-top hover:bg-slate-50/70"}><td className="p-3 text-center font-bold tabular-nums text-sky-800">{item.sort_order}</td><td className="p-3 text-left" dir="ltr"><div className="font-semibold leading-5 text-slate-900">{item.label}</div><div className="mt-0.5 font-mono text-[10px] text-slate-500">{item.code}</div></td><td className="p-3 leading-6 text-slate-700">{item.description || "—"}</td><td className="p-3"><div className="flex justify-center"><Switch checked={selectedIds.has(Number(item.id))} disabled={!isDraft} onCheckedChange={(checked) => toggle(Number(item.id), checked)} /></div></td></tr>)}</tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}
