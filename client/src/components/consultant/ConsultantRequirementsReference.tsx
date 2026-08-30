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

export function ConsultantRequirementsReference() {
  const referenceQuery = trpc.consultantRequirements.reference.list.useQuery();
  const [search, setSearch] = useState("");
  const items = (referenceQuery.data ?? []) as any[];
  const groups = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.reduce<{ design: any[]; supervision: any[] }>((result, item) => {
      const haystack = `${item.label ?? ""} ${item.code ?? ""} ${item.requirement_group ?? ""}`.toLowerCase();
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
            <div className="flex items-center gap-2 font-bold text-slate-900"><ShieldCheck className="h-5 w-5 text-sky-700" />المكتبة الشاملة لنطاق التصميم والإشراف</div>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-600">هذه هي المكتبة الحالية دون إضافة أو تغيير. يختار كل مشروع ما يناسبه منها في نسخة مستقلة لا تؤثر في المكتبة أو في المشاريع الأخرى.</p>
          </div>
          <Badge className="border-sky-200 bg-white text-sky-800">{items.length} بند موجود</Badge>
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
              <section key={key} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3"><h3 className="font-bold text-slate-900">{title}</h3><span className="text-xs text-slate-500">{groupItems.length} بند</span></div>
                <div className="overflow-x-auto">
                  <table className="min-w-[820px] w-full text-xs">
                    <thead className="bg-white text-slate-500"><tr className="border-b border-slate-100"><th className="p-3 text-right">البند</th><th className="p-3 text-right">المجموعة</th><th className="p-3 text-center">طريقة القيمة</th><th className="p-3 text-center">القيمة المرجعية</th><th className="p-3 text-center">المدة</th><th className="p-3 text-center">التخصيص</th></tr></thead>
                    <tbody>{groupItems.map((item) => <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50/70"><td className="p-3"><div className="font-semibold text-slate-800">{item.label}</div><div className="mt-0.5 text-[11px] text-slate-500">{item.code || "بدون رمز"}</div></td><td className="p-3 text-slate-600">{item.requirement_group}</td><td className="p-3 text-center">{PRICING_LABELS[item.pricing_basis] ?? item.pricing_basis}</td><td className="p-3 text-center font-semibold text-slate-700">{formatAmount(item.default_gap_value_aed)}</td><td className="p-3 text-center">{item.default_duration_months ?? "—"}</td><td className="p-3 text-center">{item.default_allocation_pct ?? "—"}</td></tr>)}</tbody>
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
