import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { default as ArrowRight } from "lucide-react/dist/esm/icons/arrow-right.js";
import { default as FileSearch } from "lucide-react/dist/esm/icons/file-search.js";
import { default as Loader2 } from "lucide-react/dist/esm/icons/loader-circle.js";
import { default as ShieldCheck } from "lucide-react/dist/esm/icons/shield-check.js";

function amount(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n).toLocaleString("en-US") : "—";
}

export default function OfferReaderScreen({ cpaProjectId, projectConsultantId, systemProjectId, consultantName, onBack }: { cpaProjectId: number; projectConsultantId: number; systemProjectId: number; consultantName: string; onBack: () => void }) {
  const utils = trpc.useUtils();
  const sourcesQuery = trpc.offerReader.listSources.useQuery({ systemProjectId, projectConsultantId });
  const readingsQuery = trpc.offerReader.listReadings.useQuery({ projectConsultantId });
  const runMutation = trpc.offerReader.runDraft.useMutation({ onSuccess: () => readingsQuery.refetch() });
  const reviewMutation = trpc.offerReader.markReviewed.useMutation({ onSuccess: () => readingsQuery.refetch() });
  const [proposalId, setProposalId] = useState("");
  const readings = (readingsQuery.data ?? []) as any[];
  const latest = readings[0] as any;
  const extracted = useMemo(() => {
    if (!latest?.extraction_json) return null;
    try { return JSON.parse(latest.extraction_json); } catch { return null; }
  }, [latest?.extraction_json]);
  const coverage = extracted?.coverage ?? [];
  const counts = coverage.reduce((acc: Record<string, number>, item: any) => { acc[item.status] = (acc[item.status] ?? 0) + 1; return acc; }, {});
  const sources = (sourcesQuery.data ?? []) as any[];
  const sourceReady = Boolean(proposalId);

  return <div className="space-y-5" dir="rtl">
    <div className="flex items-center gap-3"><Button variant="ghost" size="sm" onClick={onBack} className="gap-1"><ArrowRight className="h-4 w-4" />رجوع</Button><div><h2 className="font-bold text-lg">قراءة عرض استشاري — {consultantName}</h2><p className="text-sm text-muted-foreground">المخرجات مسودة دليل فقط؛ لا تعدّل الأتعاب أو الفجوات أو التقييم.</p></div></div>
    <Card className="border-violet-200 bg-violet-50/60 shadow-none"><CardContent className="p-4"><div className="flex items-start gap-2"><ShieldCheck className="mt-0.5 h-5 w-5 text-violet-700" /><div className="text-sm leading-6 text-violet-950"><strong>حماية القرار:</strong> القارئ يطابق النص مع معيار المشروع المعتمد ويُظهر الدليل والثقة فقط. لا يكتب داخل نتائج CPA أو البيانات المالية أو تقييم الاستشاريين، ولا يعتبر أي مكتب فائزًا.</div></div></CardContent></Card>
    <Card><CardHeader className="pb-3"><CardTitle className="text-base">ملف العرض الأصلي</CardTitle></CardHeader><CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end"><div className="flex-1"><label className="text-xs text-slate-600">اختر الملف المرتبط بهذا المشروع والمكتب</label><Select value={proposalId} onValueChange={setProposalId}><SelectTrigger className="mt-1"><SelectValue placeholder={sourcesQuery.isLoading ? "جاري تحميل الملفات…" : "اختر ملف العرض"} /></SelectTrigger><SelectContent>{sources.map((source) => <SelectItem key={source.id} value={String(source.id)}>{source.fileName || source.title}</SelectItem>)}</SelectContent></Select>{!sourcesQuery.isLoading && !sources.length && <p className="mt-2 text-xs text-amber-700">لا يوجد ملف عرض أصلي مرتبط بهذا المشروع وهذا المكتب بعد. يبقى JSON السابق محفوظًا، لكنه لا يستخدم هنا كمصدر للقراءة.</p>}</div><Button disabled={!sourceReady || runMutation.isPending} onClick={() => runMutation.mutate({ cpaProjectId, projectConsultantId, systemProjectId, proposalId: Number(proposalId) })} className="gap-1 bg-violet-700 hover:bg-violet-800">{runMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin" />جاري القراءة…</> : <><FileSearch className="h-4 w-4" />إنشاء مسودة القراءة</>}</Button></CardContent></Card>
    {latest && <Card className="border-slate-200"><CardHeader className="pb-3"><div className="flex items-center justify-between"><CardTitle className="text-base">أحدث مسودة قراءة</CardTitle><Badge className={latest.status === "REVIEWED" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}>{latest.status === "REVIEWED" ? "تمت مراجعتها" : "بانتظار المراجعة"}</Badge></div></CardHeader><CardContent className="space-y-4">{latest.status === "FAILED" ? <p className="text-sm text-red-700">تعذر إنشاء المسودة: {latest.error_message || "خطأ غير محدد"}</p> : extracted ? <><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div className="rounded-lg border border-slate-200 p-3"><div className="text-xs text-slate-500">أتعاب التصميم المذكورة</div><div className="mt-1 font-bold text-slate-900">{amount(extracted.design_fee?.amount)}</div><div className="text-[11px] text-slate-500">{extracted.design_fee?.method || "غير محدد"}</div></div><div className="rounded-lg border border-slate-200 p-3"><div className="text-xs text-slate-500">أتعاب الإشراف المذكورة</div><div className="mt-1 font-bold text-slate-900">{amount(extracted.supervision_fee?.amount)}</div><div className="text-[11px] text-slate-500">{extracted.supervision_fee?.method || "غير محدد"}</div></div><div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3"><div className="text-xs text-emerald-700">مشمول</div><div className="mt-1 font-bold text-emerald-900">{counts.INCLUDED ?? 0}</div></div><div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3"><div className="text-xs text-amber-700">يحتاج مراجعة أو غير مذكور</div><div className="mt-1 font-bold text-amber-900">{(counts.NOT_MENTIONED ?? 0) + (counts.PARTIAL ?? 0) + (counts.EXCLUDED ?? 0)}</div></div></div><div className="overflow-x-auto rounded-lg border border-slate-200"><table className="min-w-[760px] w-full text-xs"><thead className="bg-slate-50 text-slate-500"><tr><th className="p-3 text-right">متطلب المشروع</th><th className="p-3 text-center">ما ظهر في العرض</th><th className="p-3 text-right">الدليل</th><th className="p-3 text-center">الثقة</th></tr></thead><tbody>{coverage.slice(0, 50).map((row: any) => <tr key={row.requirement_id} className="border-t border-slate-100"><td className="p-3 font-medium text-slate-800">{row.requirement_label}</td><td className="p-3 text-center"><Badge variant="outline">{row.status === "INCLUDED" ? "مشمول" : row.status === "PARTIAL" ? "جزئي" : row.status === "EXCLUDED" ? "مستثنى" : "غير مذكور"}</Badge></td><td className="p-3 text-slate-600">{row.evidence || "لا يوجد دليل صريح"}</td><td className="p-3 text-center">{row.confidence}%</td></tr>)}</tbody></table></div>{latest.status === "DRAFT" && <div className="flex justify-end"><Button size="sm" variant="outline" disabled={reviewMutation.isPending} onClick={() => reviewMutation.mutate({ readingId: latest.id })}>تأكيد مراجعة المسودة</Button></div>}</> : <p className="text-sm text-amber-700">المسودة لا تحمل بيانات منظمة صالحة للعرض بعد.</p>}</CardContent></Card>}
  </div>;
}
