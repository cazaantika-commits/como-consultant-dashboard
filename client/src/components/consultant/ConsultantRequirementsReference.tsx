import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { default as Search } from "lucide-react/dist/esm/icons/search.js";
import { default as ShieldCheck } from "lucide-react/dist/esm/icons/shield-check.js";

function DesignEncyclopediaTable({ items }: { items: any[] }) {
  const groupedItems = useMemo(() => {
    const grouped = new Map<string, any[]>();
    items.forEach((item) => {
      const group = String(item.requirement_group || "نطاق التصميم");
      const current = grouped.get(group) ?? [];
      current.push(item);
      grouped.set(group, current);
    });
    return Array.from(grouped.entries());
  }, [items]);

  return (
    <div className="divide-y divide-slate-200">
      {groupedItems.map(([group, groupItems]) => (
        <div key={group}>
          <div className="flex items-center justify-between bg-slate-50/80 px-4 py-2.5">
            <h4 className="text-sm font-bold text-slate-800">{group.replace(/^\d+\s*[—-]\s*/, "")}</h4>
            <span className="text-xs font-semibold text-slate-500">{groupItems.length} بند</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] table-fixed text-xs">
              <colgroup>
                <col className="w-14" />
                <col className="w-44" />
                <col className="w-[31%]" />
                <col />
              </colgroup>
              <thead className="bg-white text-slate-500">
                <tr className="border-y border-slate-100">
                  <th className="p-3 text-center">الرقم</th>
                  <th className="p-3 text-left">الرمز</th>
                  <th className="p-3 text-left">الاسم الإنجليزي الرسمي</th>
                  <th className="p-3 text-right">الشرح العربي للمعنى</th>
                </tr>
              </thead>
              <tbody>
                {groupItems.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100 align-top transition-colors hover:bg-sky-50/40">
                    <td className="p-3 text-center font-bold tabular-nums text-sky-800">{item.sort_order}</td>
                    <td className="p-3 text-left font-mono text-[11px] font-semibold text-slate-600" dir="ltr">{item.code || "—"}</td>
                    <td className="p-3 text-left font-semibold leading-5 text-slate-900" dir="ltr">{item.label}</td>
                    <td className="p-3 text-right leading-6 text-slate-700">{item.description || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ConsultantRequirementsReference() {
  const referenceQuery = trpc.consultantRequirements.reference.list.useQuery();
  const [search, setSearch] = useState("");
  const items = (referenceQuery.data ?? []) as any[];
  const designItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((item) => {
      const haystack = `${item.label ?? ""} ${item.description ?? ""} ${item.code ?? ""} ${item.requirement_group ?? ""}`.toLowerCase();
      return item.workstream === "DESIGN" && (!term || haystack.includes(term));
    });
  }, [items, search]);

  return (
    <div className="space-y-4" dir="rtl">
      <Card className="border-sky-200 bg-sky-50/70 shadow-none">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 font-bold text-slate-900"><ShieldCheck className="h-5 w-5 text-sky-700" />الموسوعة الشاملة لنطاق التصميم</div>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-600">42 بند تصميم مرتبة في خمس مجموعات. يختار كل مشروع ما يناسبه في نسخة مستقلة؛ ولا تحتوي هذه الموسوعة على بنود قانونية أو تعاقدية أو إشرافية.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge className="border-sky-200 bg-white text-sky-800">{designItems.length} بند تصميم</Badge>
          </div>
        </CardContent>
      </Card>

      <div className="relative"><Search className="absolute right-3 top-3 h-4 w-4 text-slate-400" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ابحث في بنود التصميم…" className="pr-9" /></div>

      {referenceQuery.isLoading ? <div className="py-10 text-center text-sm text-slate-500">جاري تحميل المكتبة…</div> : (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3"><h3 className="font-bold text-slate-900">نطاق التصميم</h3><span className="text-xs text-slate-500">{designItems.length} بند</span></div>
          <DesignEncyclopediaTable items={designItems} />
        </section>
      )}
    </div>
  );
}
