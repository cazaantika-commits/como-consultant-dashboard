import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { default as ArrowRight } from "lucide-react/dist/esm/icons/arrow-right.js";
import { default as ShieldCheck } from "lucide-react/dist/esm/icons/shield-check.js";

type ReviewStatus = "INCLUDED" | "PARTIAL" | "EXCLUDED" | "NOT_MENTIONED";
type ReviewItem = { requirement_id: number; requirement_label: string; status: ReviewStatus; evidence: string; note: string };

function amount(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n).toLocaleString("en-US") : "—";
}

function statusLabel(status: ReviewStatus) {
  return status === "INCLUDED" ? "مشمول" : status === "PARTIAL" ? "مشمول جزئيًا" : status === "EXCLUDED" ? "مستثنى صراحةً" : "غير مذكور";
}

export default function OfferReaderScreen({ cpaProjectId, projectConsultantId, systemProjectId, consultantName, onBack }: { cpaProjectId: number; projectConsultantId: number; systemProjectId: number; consultantName: string; onBack: () => void }) {
  const utils = trpc.useUtils();
  const sourcesQuery = trpc.offerReader.listSources.useQuery({ systemProjectId, projectConsultantId });
  const readingsQuery = trpc.offerReader.listReadings.useQuery({ projectConsultantId });
  const requestReviewMutation = trpc.offerReader.requestAssistantReview.useMutation({ onSuccess: () => readingsQuery.refetch() });
  const saveReviewMutation = trpc.offerReader.saveAssistantReview.useMutation({ onSuccess: () => { readingsQuery.refetch(); utils.financialOfferComparison.invalidate(); } });
  const [proposalId, setProposalId] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const readings = (readingsQuery.data ?? []) as any[];
  const latest = readings[0] as any;
  const extracted = useMemo(() => {
    if (!latest?.extraction_json) return null;
    try { return JSON.parse(latest.extraction_json); } catch { return null; }
  }, [latest?.extraction_json]);
  const snapshot = useMemo(() => {
    try { return JSON.parse(latest?.input_snapshot || "{}"); } catch { return {}; }
  }, [latest?.input_snapshot]);
  const sourceRequirements = (snapshot.requirements ?? []) as any[];
  const sources = (sourcesQuery.data ?? []) as any[];
  const sourceReady = Boolean(proposalId);
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
  const [designFee, setDesignFee] = useState("");
  const [designMethod, setDesignMethod] = useState("LUMP_SUM");
  const [designEvidence, setDesignEvidence] = useState("");
  const [supervisionFee, setSupervisionFee] = useState("");
  const [supervisionMethod, setSupervisionMethod] = useState("LUMP_SUM");
  const [supervisionEvidence, setSupervisionEvidence] = useState("");
  const [overallNotes, setOverallNotes] = useState("");

  const beginManualReview = () => {
    const currentCoverage = Array.isArray(extracted?.coverage) ? extracted.coverage : [];
    const coverageById = new Map(currentCoverage.map((item: any) => [Number(item.requirement_id), item]));
    setReviewItems(sourceRequirements.map((requirement) => {
      const existing = coverageById.get(Number(requirement.id));
      return { requirement_id: Number(requirement.id), requirement_label: requirement.label, status: existing?.status ?? "NOT_MENTIONED", evidence: existing?.evidence ?? "", note: existing?.note ?? "" };
    }));
    setDesignFee(extracted?.design_fee?.amount ? String(extracted.design_fee.amount) : "");
    setDesignMethod(extracted?.design_fee?.method || "LUMP_SUM");
    setDesignEvidence(extracted?.design_fee?.evidence || "");
    setSupervisionFee(extracted?.supervision_fee?.amount ? String(extracted.supervision_fee.amount) : "");
    setSupervisionMethod(extracted?.supervision_fee?.method || "LUMP_SUM");
    setSupervisionEvidence(extracted?.supervision_fee?.evidence || "");
    setOverallNotes(extracted?.overall_notes || "");
    setIsEditing(true);
  };

  const updateItem = (id: number, patch: Partial<ReviewItem>) => setReviewItems((items) => items.map((item) => item.requirement_id === id ? { ...item, ...patch } : item));
  const saveManualReview = () => {
    if (!latest) return;
    const extraction = {
      design_fee: { method: designMethod, amount: designFee === "" ? null : Number(designFee), percentage: null, evidence: designEvidence, confidence: 100 },
      supervision_fee: { submitted: supervisionFee !== "", method: supervisionMethod, amount: supervisionFee === "" ? null : Number(supervisionFee), percentage: null, duration_months: null, evidence: supervisionEvidence, confidence: 100 },
      coverage: reviewItems.map((item) => ({ ...item, confidence: 100 })),
      overall_notes: overallNotes,
      needs_review: false,
    };
    saveReviewMutation.mutate({ readingId: latest.id, extraction }, { onSuccess: () => setIsEditing(false) });
  };

  const coverage = extracted?.coverage ?? [];
  const counts = coverage.reduce((acc: Record<string, number>, item: any) => { acc[item.status] = (acc[item.status] ?? 0) + 1; return acc; }, {});

  return <div className="space-y-5" dir="rtl">
    <div className="flex items-center gap-3"><Button variant="ghost" size="sm" onClick={onBack} className="gap-1"><ArrowRight className="h-4 w-4" />رجوع</Button><div><h2 className="font-bold text-lg">مراجعة عرض استشاري — {consultantName}</h2><p className="text-sm text-muted-foreground">المساعد يقرأ العرض الأصلي ويثبت النتيجة؛ النظام لا يفسر العرض أو يعتمد قيمة تلقائيًا.</p></div></div>
    <Card className="border-violet-200 bg-violet-50/60 shadow-none"><CardContent className="p-4"><div className="flex items-start gap-2"><ShieldCheck className="mt-0.5 h-5 w-5 text-violet-700" /><div className="text-sm leading-6 text-violet-950"><strong>تقسيم المسؤولية:</strong> تحدد أنت متطلبات المشروع. يراجع المساعد العرض الأصلي بندًا بندًا، ويثبت النص أو الصفحة الدالة عليه. لا يتحول أي بند إلى فجوة أو رقم مالي قبل حفظ مراجعة المساعد.</div></div></CardContent></Card>
    <Card><CardHeader className="pb-3"><CardTitle className="text-base">ملف العرض الأصلي</CardTitle></CardHeader><CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end"><div className="flex-1"><label className="text-xs text-slate-600">اختر الملف المرتبط بهذا المشروع والمكتب</label><Select value={proposalId} onValueChange={setProposalId}><SelectTrigger className="mt-1"><SelectValue placeholder={sourcesQuery.isLoading ? "جاري تحميل الملفات…" : "اختر ملف العرض"} /></SelectTrigger><SelectContent>{sources.map((source) => <SelectItem key={source.id} value={String(source.id)}>{source.fileName || source.title}</SelectItem>)}</SelectContent></Select>{!sourcesQuery.isLoading && !sources.length && <p className="mt-2 text-xs text-amber-700">لا يوجد ملف عرض أصلي مرتبط بهذا المشروع وهذا المكتب بعد. يبقى JSON السابق محفوظًا، لكنه لا يستخدم هنا كمصدر للمراجعة.</p>}</div><Button disabled={!sourceReady || requestReviewMutation.isPending} onClick={() => requestReviewMutation.mutate({ cpaProjectId, projectConsultantId, systemProjectId, proposalId: Number(proposalId) })} className="bg-violet-700 hover:bg-violet-800">{requestReviewMutation.isPending ? "جاري الإرسال…" : "إرسال للمساعد للمراجعة"}</Button></CardContent></Card>
    {latest && <Card className="border-slate-200"><CardHeader className="pb-3"><div className="flex items-center justify-between"><CardTitle className="text-base">حالة مراجعة العرض</CardTitle><Badge className={latest.status === "REVIEWED" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}>{latest.status === "REVIEWED" ? "مراجعة المساعد مكتملة" : "بانتظار مراجعة المساعد"}</Badge></div></CardHeader><CardContent className="space-y-4">{!isEditing && extracted ? <><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div className="rounded-lg border border-slate-200 p-3"><div className="text-xs text-slate-500">أتعاب التصميم المذكورة</div><div className="mt-1 font-bold text-slate-900">{amount(extracted.design_fee?.amount)}</div><div className="text-[11px] text-slate-500">{extracted.design_fee?.method || "غير محدد"}</div></div><div className="rounded-lg border border-slate-200 p-3"><div className="text-xs text-slate-500">أتعاب الإشراف المذكورة</div><div className="mt-1 font-bold text-slate-900">{amount(extracted.supervision_fee?.amount)}</div><div className="text-[11px] text-slate-500">{extracted.supervision_fee?.method || "غير محدد"}</div></div><div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3"><div className="text-xs text-emerald-700">مشمول</div><div className="mt-1 font-bold text-emerald-900">{counts.INCLUDED ?? 0}</div></div><div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3"><div className="text-xs text-amber-700">فجوة أو يحتاج توضيح</div><div className="mt-1 font-bold text-amber-900">{(counts.NOT_MENTIONED ?? 0) + (counts.PARTIAL ?? 0) + (counts.EXCLUDED ?? 0)}</div></div></div><div className="overflow-x-auto rounded-lg border border-slate-200"><table className="min-w-[760px] w-full text-xs"><thead className="bg-slate-50 text-slate-500"><tr><th className="p-3 text-right">متطلب المشروع</th><th className="p-3 text-center">نتيجة مراجعة المساعد</th><th className="p-3 text-right">المصدر في العرض</th></tr></thead><tbody>{coverage.slice(0, 50).map((row: any) => <tr key={row.requirement_id} className="border-t border-slate-100"><td className="p-3 font-medium text-slate-800">{row.requirement_label}</td><td className="p-3 text-center"><Badge variant="outline">{statusLabel(row.status)}</Badge></td><td className="p-3 text-slate-600">{row.evidence || "لا يوجد دليل صريح"}</td></tr>)}</tbody></table></div></> : isEditing ? <div className="space-y-5"><div className="rounded-lg border border-violet-200 bg-violet-50 p-3 text-sm leading-6 text-violet-950">هذا النموذج يُملأ فقط بعد أن يقرأ المساعد الملف الأصلي. اترك البند «غير مذكور» إذا لم يوجد نص صريح؛ لا تحوله إلى «مستثنى» من دون دليل.</div><div className="grid gap-4 lg:grid-cols-2"><div className="space-y-2 rounded-lg border border-slate-200 p-3"><div className="font-semibold text-sm">أتعاب التصميم كما وردت في العرض</div><div className="grid grid-cols-2 gap-2"><Select value={designMethod} onValueChange={setDesignMethod}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="LUMP_SUM">مبلغ مقطوع</SelectItem><SelectItem value="PERCENTAGE">نسبة</SelectItem><SelectItem value="MONTHLY_RATE">شهري</SelectItem></SelectContent></Select><Input type="number" value={designFee} onChange={(event) => setDesignFee(event.target.value)} placeholder="القيمة كما وردت" /></div><Textarea value={designEvidence} onChange={(event) => setDesignEvidence(event.target.value)} placeholder="الصفحة أو النص الدال في العرض" /></div><div className="space-y-2 rounded-lg border border-slate-200 p-3"><div className="font-semibold text-sm">أتعاب الإشراف كما وردت في العرض</div><div className="grid grid-cols-2 gap-2"><Select value={supervisionMethod} onValueChange={setSupervisionMethod}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="LUMP_SUM">مبلغ مقطوع</SelectItem><SelectItem value="PERCENTAGE">نسبة</SelectItem><SelectItem value="MONTHLY_RATE">شهري</SelectItem></SelectContent></Select><Input type="number" value={supervisionFee} onChange={(event) => setSupervisionFee(event.target.value)} placeholder="القيمة كما وردت" /></div><Textarea value={supervisionEvidence} onChange={(event) => setSupervisionEvidence(event.target.value)} placeholder="الصفحة أو النص الدال في العرض" /></div></div><div className="overflow-x-auto rounded-lg border border-slate-200"><table className="min-w-[900px] w-full text-xs"><thead className="bg-slate-50 text-slate-500"><tr><th className="p-3 text-right">متطلب المشروع</th><th className="p-3 text-center">نتيجة مراجعة المساعد</th><th className="p-3 text-right">المصدر أو الصفحة في العرض</th><th className="p-3 text-right">ملاحظة</th></tr></thead><tbody>{reviewItems.map((item) => <tr key={item.requirement_id} className="border-t border-slate-100"><td className="p-3 font-medium text-slate-800">{item.requirement_label}</td><td className="p-2"><Select value={item.status} onValueChange={(value: ReviewStatus) => updateItem(item.requirement_id, { status: value })}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="INCLUDED">مشمول</SelectItem><SelectItem value="PARTIAL">مشمول جزئيًا</SelectItem><SelectItem value="EXCLUDED">مستثنى صراحةً</SelectItem><SelectItem value="NOT_MENTIONED">غير مذكور</SelectItem></SelectContent></Select></td><td className="p-2"><Input value={item.evidence} onChange={(event) => updateItem(item.requirement_id, { evidence: event.target.value })} className="h-8 text-xs" placeholder="نص أو صفحة" /></td><td className="p-2"><Input value={item.note} onChange={(event) => updateItem(item.requirement_id, { note: event.target.value })} className="h-8 text-xs" placeholder="ملاحظة" /></td></tr>)}</tbody></table></div><Textarea value={overallNotes} onChange={(event) => setOverallNotes(event.target.value)} placeholder="ملاحظات عامة عن العرض أو الاستثناءات" /><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setIsEditing(false)}>إلغاء</Button><Button disabled={saveReviewMutation.isPending || !reviewItems.length} onClick={saveManualReview} className="bg-emerald-700 hover:bg-emerald-800">{saveReviewMutation.isPending ? "جاري الحفظ…" : "حفظ مراجعة المساعد"}</Button></div></div> : <div className="flex items-center justify-between gap-4 rounded-lg border border-amber-200 bg-amber-50 p-4"><p className="text-sm leading-6 text-amber-900">تم حفظ طلب المراجعة مع نسخة من متطلبات المشروع وملف العرض. لا توجد نتيجة حتى يقرأ المساعد العرض الأصلي.</p><Button size="sm" onClick={beginManualReview}>بدء إدخال مراجعة المساعد</Button></div>}</CardContent></Card>}
  </div>;
}
