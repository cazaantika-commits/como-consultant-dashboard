import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { default as ArrowRight } from "lucide-react/dist/esm/icons/arrow-right.js";
import { default as FileCheck2 } from "lucide-react/dist/esm/icons/file-check-2.js";
import { default as SearchCheck } from "lucide-react/dist/esm/icons/search-check.js";
import { default as Upload } from "lucide-react/dist/esm/icons/upload.js";

type ReviewStatus = "INCLUDED" | "PARTIAL" | "EXCLUDED" | "NOT_MENTIONED";
type ReviewItem = { requirement_id: number; requirement_label: string; status: ReviewStatus; evidence: string; note: string; confidence: number };

function amount(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n).toLocaleString("en-US") : "—";
}

function statusLabel(status: ReviewStatus) {
  return status === "INCLUDED" ? "مشمول" : status === "PARTIAL" ? "مشمول جزئيًا" : status === "EXCLUDED" ? "مستثنى صراحةً" : "غير مذكور";
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function OfferReaderScreen({ cpaProjectId, projectConsultantId, systemProjectId, consultantName, onBack }: { cpaProjectId: number; projectConsultantId: number; systemProjectId: number; consultantName: string; onBack: () => void }) {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const contextQuery = trpc.offerReader.getUploadContext.useQuery({ cpaProjectId, projectConsultantId });
  const sourcesQuery = trpc.offerReader.listSources.useQuery({ systemProjectId, projectConsultantId });
  const readingsQuery = trpc.offerReader.listReadings.useQuery({ projectConsultantId });
  const uploadMutation = trpc.proposals.upload.useMutation();
  const analyzeMutation = trpc.offerReader.analyzeProposal.useMutation({
    onSuccess: () => { readingsQuery.refetch(); toast({ title: "اكتمل تحليل العرض", description: "راجع النتائج والأدلة قبل إرسالها إلى التقييم." }); },
    onError: (error) => toast({ title: "تعذر تحليل العرض", description: error.message, variant: "destructive" }),
  });
  const approveMutation = trpc.offerReader.approveForEvaluation.useMutation({
    onSuccess: () => { readingsQuery.refetch(); utils.financialOfferComparison.invalidate(); toast({ title: "تم إرسال مدخلات التصميم إلى نظام التقييم" }); },
    onError: (error) => toast({ title: "تعذر اعتماد المراجعة", description: error.message, variant: "destructive" }),
  });
  const correctionMutation = trpc.offerReader.saveOwnerCorrection.useMutation({
    onSuccess: () => { readingsQuery.refetch(); utils.financialOfferComparison.invalidate(); toast({ title: "تم حفظ تصحيح المالك وإرساله إلى التقييم" }); },
    onError: (error) => toast({ title: "تعذر حفظ التصحيح", description: error.message, variant: "destructive" }),
  });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [proposalId, setProposalId] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isCorrection, setIsCorrection] = useState(false);
  const [proposalDate, setProposalDate] = useState("");
  const [proposalReference, setProposalReference] = useState("");
  const [designMethod, setDesignMethod] = useState("NOT_STATED");
  const [designAmount, setDesignAmount] = useState("");
  const [designPercentage, setDesignPercentage] = useState("");
  const [designEvidence, setDesignEvidence] = useState("");
  const [overallNotes, setOverallNotes] = useState("");
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);

  const readings = (readingsQuery.data ?? []) as any[];
  const latest = readings[0] as any;
  const extracted = useMemo(() => {
    if (!latest?.extraction_json) return null;
    try { return JSON.parse(latest.extraction_json); } catch { return null; }
  }, [latest?.extraction_json]);
  const sources = (sourcesQuery.data ?? []) as any[];

  const loadReviewForm = (ownerCorrection = false) => {
    if (!extracted) return;
    setProposalDate(extracted.proposal_date || "");
    setProposalReference(extracted.proposal_reference || "");
    setDesignMethod(extracted.design_fee?.method || "NOT_STATED");
    setDesignAmount(extracted.design_fee?.amount == null ? "" : String(extracted.design_fee.amount));
    setDesignPercentage(extracted.design_fee?.percentage == null ? "" : String(Number(extracted.design_fee.percentage) * 100));
    setDesignEvidence(extracted.design_fee?.evidence || "");
    setOverallNotes(extracted.overall_notes || "");
    setReviewItems(Array.isArray(extracted.coverage) ? extracted.coverage : []);
    setIsCorrection(ownerCorrection);
    setIsEditing(true);
  };

  useEffect(() => {
    if (latest?.status === "DRAFT" && extracted) loadReviewForm(false);
  }, [latest?.id, latest?.status, extracted]);

  const handleFile = (file: File | null) => {
    if (!file) return;
    if (file.type !== "application/pdf") { toast({ title: "ملف غير مدعوم", description: "ارفع ملف PDF الأصلي فقط.", variant: "destructive" }); return; }
    if (file.size > 16 * 1024 * 1024) { toast({ title: "الملف كبير", description: "الحد الأقصى 16 ميجابايت.", variant: "destructive" }); return; }
    setSelectedFile(file);
    setTitle(file.name.replace(/\.pdf$/i, ""));
  };

  const uploadProposal = async () => {
    if (!selectedFile || !title.trim() || !contextQuery.data?.consultantId) return;
    try {
      const fileData = await fileToBase64(selectedFile);
      const uploaded = await uploadMutation.mutateAsync({ consultantId: contextQuery.data.consultantId, projectId: systemProjectId, title: title.trim(), fileData, fileName: selectedFile.name, mimeType: selectedFile.type });
      await sourcesQuery.refetch();
      setProposalId(String(uploaded.proposalId));
      setSelectedFile(null);
      setTitle("");
      toast({ title: "تم رفع العرض الأصلي", description: "يمكنك الآن بدء تحليل المساعد." });
    } catch (error: any) {
      toast({ title: "تعذر رفع العرض", description: error.message, variant: "destructive" });
    }
  };

  const analyze = () => analyzeMutation.mutate({ cpaProjectId, projectConsultantId, systemProjectId, proposalId: Number(proposalId) });
  const updateItem = (id: number, patch: Partial<ReviewItem>) => setReviewItems((items) => items.map((item) => item.requirement_id === id ? { ...item, ...patch } : item));
  const reviewedExtraction = () => ({
    proposal_date: proposalDate.trim() || null,
    proposal_reference: proposalReference.trim() || null,
    design_fee: {
      method: designMethod as "LUMP_SUM" | "PERCENTAGE" | "NOT_STATED",
      amount: designMethod === "LUMP_SUM" && designAmount !== "" ? Number(designAmount) : null,
      percentage: designMethod === "PERCENTAGE" && designPercentage !== "" ? Number(designPercentage) / 100 : null,
      evidence: designEvidence,
      confidence: Number(extracted?.design_fee?.confidence ?? 100),
    },
    coverage: reviewItems,
    overall_notes: overallNotes,
    needs_review: false,
  });
  const saveReview = () => {
    if (!latest) return;
    const extraction = reviewedExtraction();
    if (isCorrection) correctionMutation.mutate({ readingId: Number(latest.id), extraction });
    else approveMutation.mutate({ readingId: Number(latest.id), extraction });
    setIsEditing(false);
  };

  const coverage = extracted?.coverage ?? [];
  const counts = coverage.reduce((acc: Record<string, number>, item: any) => { acc[item.status] = (acc[item.status] ?? 0) + 1; return acc; }, {});

  return <div className="space-y-5" dir="rtl">
    <div className="flex items-center gap-3"><Button variant="ghost" size="sm" onClick={onBack} className="gap-1"><ArrowRight className="h-4 w-4" />رجوع</Button><div><h2 className="text-lg font-bold">تحليل عرض التصميم — {consultantName}</h2><p className="text-sm text-muted-foreground">ارفع العرض الأصلي؛ يقرأه المساعد مقابل نطاق المشروع المعتمد، ثم تراجع النتائج قبل إرسالها إلى التقييم الحالي.</p></div></div>

    <Card className="border-sky-200 bg-sky-50/60 shadow-none"><CardContent className="flex items-start gap-2 p-4"><SearchCheck className="mt-0.5 h-5 w-5 text-sky-700" /><div className="text-sm leading-6 text-sky-950"><strong>حدود التحليل:</strong> نطاق التصميم وأتعابه فقط. لا تُحلل البنود القانونية أو الإشراف، ولا تُحسب فجوة أو تكلفة تلقائيًا. النموذج المستخدم: <strong>Gemini 3.1 Pro</strong>.</div></CardContent></Card>

    <Card><CardHeader className="pb-3"><CardTitle className="text-base">1. رفع ملف العرض الأصلي</CardTitle></CardHeader><CardContent className="grid gap-3 lg:grid-cols-[1fr_1fr_auto] lg:items-end"><div><Label>العنوان</Label><Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="عرض التصميم — اسم المكتب" /></div><div><Label>ملف PDF</Label><Input type="file" accept="application/pdf,.pdf" onChange={(event) => handleFile(event.target.files?.[0] ?? null)} /></div><Button onClick={uploadProposal} disabled={!selectedFile || !title.trim() || uploadMutation.isPending || !contextQuery.data?.consultantId} className="gap-1"><Upload className="h-4 w-4" />{uploadMutation.isPending ? "جاري الرفع…" : "رفع العرض"}</Button></CardContent></Card>

    <Card><CardHeader className="pb-3"><CardTitle className="text-base">2. اختيار العرض وبدء التحليل</CardTitle></CardHeader><CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end"><div className="flex-1"><Label>العرض المرتبط بهذا المشروع والمكتب</Label><Select value={proposalId} onValueChange={setProposalId}><SelectTrigger className="mt-1"><SelectValue placeholder={sourcesQuery.isLoading ? "جاري تحميل العروض…" : "اختر العرض الأصلي"} /></SelectTrigger><SelectContent>{sources.map((source) => <SelectItem key={source.id} value={String(source.id)}>{source.fileName || source.title}</SelectItem>)}</SelectContent></Select>{!sourcesQuery.isLoading && !sources.length && <p className="mt-2 text-xs text-amber-700">لم يُرفع عرض لهذا المشروع والمكتب بعد.</p>}</div><Button disabled={!proposalId || analyzeMutation.isPending} onClick={analyze} className="bg-violet-700 hover:bg-violet-800">{analyzeMutation.isPending ? "المساعد يقرأ العرض…" : "تحليل العرض"}</Button></CardContent></Card>

    {latest?.status === "FAILED" && <Card className="border-red-200 bg-red-50"><CardContent className="p-4 text-sm text-red-800">فشل التحليل: {latest.error_message || "سبب غير معروف"}</CardContent></Card>}

    {latest && extracted && <Card className="border-slate-200"><CardHeader className="pb-3"><div className="flex items-center justify-between gap-3"><CardTitle className="text-base">3. مراجعة المخرجات قبل التقييم</CardTitle><Badge className={latest.status === "REVIEWED" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}>{latest.status === "REVIEWED" ? latest.model_id === "OWNER_CORRECTION" ? "تصحيح المالك معتمد" : "أُرسل إلى التقييم" : "بانتظار مراجعة المالك"}</Badge></div></CardHeader><CardContent className="space-y-4">
      {!isEditing ? <><div className="grid gap-3 sm:grid-cols-3"><div className="rounded-lg border border-slate-200 p-3"><div className="text-xs text-slate-500">أتعاب التصميم</div><div className="mt-1 font-bold text-slate-900">{extracted.design_fee?.method === "PERCENTAGE" ? `${Number(extracted.design_fee?.percentage ?? 0) * 100}%` : amount(extracted.design_fee?.amount)}</div></div><div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3"><div className="text-xs text-emerald-700">مشمول</div><div className="mt-1 font-bold text-emerald-900">{counts.INCLUDED ?? 0}</div></div><div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3"><div className="text-xs text-amber-700">يحتاج مراجعة أو فجوة</div><div className="mt-1 font-bold text-amber-900">{(counts.NOT_MENTIONED ?? 0) + (counts.PARTIAL ?? 0) + (counts.EXCLUDED ?? 0)}</div></div></div><div className="overflow-x-auto rounded-lg border border-slate-200"><table className="min-w-[760px] w-full text-xs"><thead className="bg-slate-50 text-slate-500"><tr><th className="p-3 text-right">بند نطاق المشروع</th><th className="p-3 text-center">نتيجة التحليل</th><th className="p-3 text-right">الدليل من العرض</th></tr></thead><tbody>{coverage.map((row: any) => <tr key={row.requirement_id} className="border-t border-slate-100"><td className="p-3 font-medium text-slate-800">{row.requirement_label}</td><td className="p-3 text-center"><Badge variant="outline">{statusLabel(row.status)}</Badge></td><td className="p-3 text-slate-600">{row.evidence || "لا يوجد دليل صريح"}</td></tr>)}</tbody></table></div><div className="flex justify-end"><Button variant="outline" size="sm" onClick={() => loadReviewForm(latest.status === "REVIEWED")}>{latest.status === "REVIEWED" ? "تصحيح بعد مراجعة المالك" : "متابعة مراجعة التحليل"}</Button></div></> : <div className="space-y-5"><div className="rounded-lg border border-violet-200 bg-violet-50 p-3 text-sm leading-6 text-violet-950">راجع الأتعاب وحالة كل بند ودليله. لن يدخل شيء إلى نظام التقييم حتى تضغط زر الاعتماد.</div><div className="grid gap-4 lg:grid-cols-2"><div className="space-y-2 rounded-lg border border-slate-200 p-3"><div className="font-semibold text-sm">أتعاب التصميم كما وردت في العرض</div><Select value={designMethod} onValueChange={setDesignMethod}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="LUMP_SUM">مبلغ مقطوع</SelectItem><SelectItem value="PERCENTAGE">نسبة</SelectItem><SelectItem value="NOT_STATED">غير مذكورة</SelectItem></SelectContent></Select>{designMethod === "LUMP_SUM" ? <Input type="number" min="0" value={designAmount} onChange={(event) => setDesignAmount(event.target.value)} placeholder="القيمة كما وردت" /> : designMethod === "PERCENTAGE" ? <Input type="number" min="0" max="100" step="0.01" value={designPercentage} onChange={(event) => setDesignPercentage(event.target.value)} placeholder="النسبة مثل 1.8" /> : null}<Textarea value={designEvidence} onChange={(event) => setDesignEvidence(event.target.value)} placeholder="الصفحة أو النص الدال على الأتعاب" /></div><div className="space-y-2 rounded-lg border border-slate-200 p-3"><div className="font-semibold text-sm">بيانات العرض</div><Input value={proposalReference} onChange={(event) => setProposalReference(event.target.value)} placeholder="مرجع العرض" /><Input value={proposalDate} onChange={(event) => setProposalDate(event.target.value)} placeholder="تاريخ العرض" /><Textarea value={overallNotes} onChange={(event) => setOverallNotes(event.target.value)} placeholder="ملاحظات عامة عن عرض التصميم" /></div></div><div className="overflow-x-auto rounded-lg border border-slate-200"><table className="min-w-[940px] w-full text-xs"><thead className="bg-slate-50 text-slate-500"><tr><th className="p-3 text-right">بند نطاق المشروع</th><th className="p-3 text-center">النتيجة</th><th className="p-3 text-right">الدليل من العرض</th><th className="p-3 text-right">ملاحظة</th></tr></thead><tbody>{reviewItems.map((item) => <tr key={item.requirement_id} className="border-t border-slate-100"><td className="p-3 font-medium text-slate-800">{item.requirement_label}</td><td className="p-2"><Select value={item.status} onValueChange={(value) => updateItem(item.requirement_id, { status: value as ReviewStatus })}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="INCLUDED">مشمول</SelectItem><SelectItem value="PARTIAL">مشمول جزئيًا</SelectItem><SelectItem value="EXCLUDED">مستثنى صراحةً</SelectItem><SelectItem value="NOT_MENTIONED">غير مذكور</SelectItem></SelectContent></Select></td><td className="p-2"><Input value={item.evidence} onChange={(event) => updateItem(item.requirement_id, { evidence: event.target.value })} className="h-8 text-xs" placeholder="صفحة أو نص" /></td><td className="p-2"><Input value={item.note} onChange={(event) => updateItem(item.requirement_id, { note: event.target.value })} className="h-8 text-xs" placeholder="ملاحظة" /></td></tr>)}</tbody></table></div><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setIsEditing(false)}>إلغاء</Button><Button disabled={approveMutation.isPending || correctionMutation.isPending || !reviewItems.length} onClick={saveReview} className="gap-1 bg-emerald-700 hover:bg-emerald-800"><FileCheck2 className="h-4 w-4" />{approveMutation.isPending || correctionMutation.isPending ? "جاري الحفظ…" : isCorrection ? "حفظ التصحيح وإرساله للتقييم" : "اعتماد وإرسال إلى التقييم"}</Button></div></div>}
    </CardContent></Card>}
  </div>;
}
