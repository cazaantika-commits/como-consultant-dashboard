import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { default as Search } from "lucide-react/dist/esm/icons/search.js";
import { default as ShieldCheck } from "lucide-react/dist/esm/icons/shield-check.js";

const PRICING_LABELS: Record<string, string> = {
  FIXED: "قيمة ثابتة",
  MONTHLY: "قيمة شهرية",
  PERCENT_OF_FEE: "نسبة من الأتعاب",
  MANUAL: "تُحدد للمشروع",
};

function formatAmount(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount).toLocaleString("en-US") : "—";
}

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

function SupervisionReferenceTable({ items }: { items: any[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-[820px] w-full text-xs">
        <thead className="bg-white text-slate-500"><tr className="border-b border-slate-100"><th className="p-3 text-right">البند</th><th className="p-3 text-right">المجموعة</th><th className="p-3 text-center">طريقة القيمة</th><th className="p-3 text-center">القيمة المرجعية</th><th className="p-3 text-center">المدة</th><th className="p-3 text-center">التخصيص</th></tr></thead>
        <tbody>{items.map((item) => <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50/70"><td className="p-3"><div className="font-semibold text-slate-800">{item.label}</div><div className="mt-0.5 text-[11px] text-slate-500">{item.code || "بدون رمز"}</div></td><td className="p-3 text-slate-600">{item.requirement_group}</td><td className="p-3 text-center">{PRICING_LABELS[item.pricing_basis] ?? item.pricing_basis}</td><td className="p-3 text-center font-semibold text-slate-700">{formatAmount(item.default_gap_value_aed)}</td><td className="p-3 text-center">{item.default_duration_months ?? "—"}</td><td className="p-3 text-center">{item.default_allocation_pct ?? "—"}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

export function ConsultantRequirementsReference() {
  const referenceQuery = trpc.consultantRequirements.reference.list.useQuery();
  const [search, setSearch] = useState("");
  const items = (referenceQuery.data ?? []) as any[];
  const groups = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.reduce<{ design: any[]; supervision: any[] }>((result, item) => {
      const haystack = `${item.label ?? ""} ${item.description ?? ""} ${item.code ?? ""} ${item.requirement_group ?? ""}`.toLowerCase();
      if (term && !haystack.includes(term)) return result;
      if (item.source_type === "LEGACY_SUPERVISION") result.supervision.push(item);
      else result.design.push(item);
      return result;
    }, { design: [], supervision: [] });
  }, [items, search]);

  return (
    <div className="space-y-4" dir="rtl">
      <Card className="border-sky-200 bg-sky-50/70 shadow-none">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 font-bold text-slate-900"><ShieldCheck className="h-5 w-5 text-sky-700" />الموسوعة الشاملة لنطاق التصميم والإشراف</div>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-600">تعرض موسوعة التصميم الاسم الإنجليزي الرسمي وشرح المعنى بالعربية. يختار كل مشروع ما يناسبه في نسخة مستقلة، بينما تبقى مكتبة الإشراف منفصلة دون تغيير.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge className="border-sky-200 bg-white text-sky-800">{groups.design.length} بند تصميم</Badge>
            <Badge className="border-emerald-200 bg-white text-emerald-800">{groups.supervision.length} بند إشراف</Badge>
          </div>
        </CardContent>
      </Card>

      <div className="relative"><Search className="absolute right-3 top-3 h-4 w-4 text-slate-400" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ابحث في المكتبة الشاملة…" className="pr-9" /></div>

      {referenceQuery.isLoading ? <div className="py-10 text-center text-sm text-slate-500">جاري تحميل المكتبة…</div> : (
        <div className="space-y-5">
          {([
            ["design", "نطاق التصميم والخدمات الاستشارية"],
            ["supervision", "نطاق الإشراف"],
          ] as const).map(([key, title]) => {
            const groupItems = groups[key];
            if (!groupItems.length) return null;
            return (
              <section key={key} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3"><h3 className="font-bold text-slate-900">{title}</h3><span className="text-xs text-slate-500">{groupItems.length} بند</span></div>
                {key === "design" ? <DesignEncyclopediaTable items={groupItems} /> : <SupervisionReferenceTable items={groupItems} />}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
