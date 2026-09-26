import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { default as ArrowRight } from "lucide-react/dist/esm/icons/arrow-right.js";
import { default as BrainCircuit } from "lucide-react/dist/esm/icons/brain-circuit.js";
import { default as Building2 } from "lucide-react/dist/esm/icons/building-2.js";
import { default as CheckCircle2 } from "lucide-react/dist/esm/icons/check-circle-2.js";
import { default as ChevronLeft } from "lucide-react/dist/esm/icons/chevron-left.js";
import { default as CircleAlert } from "lucide-react/dist/esm/icons/circle-alert.js";
import { default as FileCheck2 } from "lucide-react/dist/esm/icons/file-check-2.js";
import { default as FileSearch } from "lucide-react/dist/esm/icons/file-search.js";
import { default as FileUp } from "lucide-react/dist/esm/icons/file-up.js";
import { default as FolderLock } from "lucide-react/dist/esm/icons/folder-lock.js";
import { default as Loader2 } from "lucide-react/dist/esm/icons/loader-circle.js";
import { default as Plus } from "lucide-react/dist/esm/icons/plus.js";
import { default as ShieldCheck } from "lucide-react/dist/esm/icons/shield-check.js";

const statusMeta: Record<string, { label: string; tone: string }> = {
  under_study: { label: "تحت الدراسة", tone: "border-sky-200 bg-sky-50 text-sky-800" },
  under_review: { label: "تحت المراجعة", tone: "border-amber-200 bg-amber-50 text-amber-800" },
  ready_for_approval: { label: "جاهز لاعتمادك", tone: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  approved: { label: "أصبح مشروعًا رسميًا", tone: "border-slate-200 bg-slate-100 text-slate-800" },
};

const documentRoleLabels: Record<string, string> = {
  land_document: "وثيقة أرض",
  developer_contract: "عقد مطور / شراكة",
  fact_sheet: "بيان معلومات",
  other_land_evidence: "مستند تأسيسي آخر",
};

const ownerRelationshipOptions = [
  ["undecided", "غير محسوم بعد"],
  ["owned", "الأرض مملوكة لنا"],
  ["potential_purchase", "شراء محتمل"],
  ["land_for_units", "أرض مقابل وحدات"],
  ["other_partnership", "شراكة أخرى"],
  ["development_management", "إدارة تطوير للغير"],
] as const;

const strategyOptions = [
  ["undecided", "غير محسومة بعد"],
  ["offplan_escrow", "أوف بلان + حساب ضمان"],
  ["offplan_construction", "أوف بلان + تمويل بناء"],
  ["build_for_sale", "بناء للبيع"],
  ["build_for_rent", "بناء للتأجير"],
  ["joint_venture_land_for_units", "مشروع مشترك — الأرض مقابل وحدات"],
] as const;

type FactDraft = { id: number; value: string; reviewStatus: "pending" | "approved" | "edited" | "rejected"; reviewNote: string };

function formatBytes(value: number) {
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} ك.ب`;
  return `${(value / 1024 / 1024).toFixed(1)} م.ب`;
}

function Step({ number, title, done, active }: { number: number; title: string; done: boolean; active: boolean }) {
  return (
    <div className={`flex items-center gap-3 rounded-2xl border px-3 py-3 ${done ? "border-emerald-200 bg-emerald-50" : active ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white"}`}>
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-black ${done ? "bg-emerald-600 text-white" : active ? "bg-amber-400 text-slate-950" : "bg-slate-100 text-slate-500"}`}>{done ? <CheckCircle2 className="h-4 w-4" /> : number}</span>
      <span className="text-xs font-black text-slate-800">{title}</span>
    </div>
  );
}

export default function ComoNextProjectOpeningPage() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const listQuery = trpc.comoNextProjectOpening.list.useQuery(undefined, { retry: false });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const detailQuery = trpc.comoNextProjectOpening.get.useQuery({ opportunityId: selectedId || 1 }, { enabled: Boolean(selectedId), retry: false });
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [provisionalName, setProvisionalName] = useState("");
  const [objective, setObjective] = useState("");
  const [documentRole, setDocumentRole] = useState("land_document");
  const [ownerRelationship, setOwnerRelationship] = useState("undecided");
  const [developmentStrategy, setDevelopmentStrategy] = useState("undecided");
  const [factDrafts, setFactDrafts] = useState<FactDraft[]>([]);
  const [manualDocumentIds, setManualDocumentIds] = useState<number[]>([]);

  const detail = detailQuery.data;
  useEffect(() => {
    if (!selectedId && listQuery.data?.length) setSelectedId(listQuery.data[0].id);
  }, [selectedId, listQuery.data]);
  useEffect(() => {
    if (!detail) return;
    setProvisionalName(detail.opportunity.provisionalName || "");
    setObjective(detail.opportunity.objective || "");
    setOwnerRelationship(detail.opportunity.ownerRelationship || "undecided");
    setDevelopmentStrategy(detail.opportunity.developmentStrategy || "undecided");
    setFactDrafts(detail.facts.map((fact: any) => ({
      id: fact.id,
      value: fact.currentValue || "",
      reviewStatus: ["approved", "edited", "rejected"].includes(fact.reviewStatus) ? fact.reviewStatus : "pending",
      reviewNote: fact.reviewNote || "",
    })));
    setManualDocumentIds(detail.documents.filter((document: any) => document.analysisStatus === "manual_reviewed").map((document: any) => document.id));
  }, [detail]);

  const analyzeMutation = trpc.comoNextProjectOpening.analyzeDocument.useMutation({
    onSuccess: async () => {
      toast.success("أعد Manus مسودة قراءة مرتبطة بالدليل؛ راجعها قبل اعتماد أي معلومة.");
      await detailQuery.refetch();
      await listQuery.refetch();
    },
    onError: error => toast.error(error.message),
  });
  const reviewMutation = trpc.comoNextProjectOpening.review.useMutation({
    onSuccess: async result => {
      toast.success(result.ready ? "اكتملت المراجعة وأصبحت الفرصة جاهزة لاعتماد فتح المشروع." : "حُفظت المراجعة؛ ما زالت هناك نقاط تحتاج حسمًا.");
      await Promise.all([detailQuery.refetch(), listQuery.refetch()]);
    },
    onError: error => toast.error(error.message),
  });
  const approveMutation = trpc.comoNextProjectOpening.approve.useMutation({
    onSuccess: async result => {
      toast.success("تم فتح المشروع الرسمي وملفه التنفيذي من المصدر المراجع.");
      await Promise.all([utils.comoNext.getOverview.invalidate(), listQuery.refetch()]);
      navigate(`/como-next/projects/${result.projectId}`);
    },
    onError: error => toast.error(error.message),
  });

  const currentStatus = detail?.opportunity.opportunityStatus || "under_study";
  const documentsReady = Boolean(detail?.documents.length) && detail!.documents.every((document: any) => ["reviewed", "manual_reviewed"].includes(document.analysisStatus));
  const factsReady = Boolean(detail) && detail!.facts.every((fact: any) => ["approved", "edited", "rejected"].includes(fact.reviewStatus));
  const canSaveReview = Boolean(detail) && factDrafts.every(fact => fact.reviewStatus !== "pending") && ownerRelationship !== "undecided" && developmentStrategy !== "undecided" && provisionalName.trim().length > 0;
  const latestExtraction = useMemo(() => detail?.extractions.find((item: any) => item.extractionStatus === "draft") || detail?.extractions[0], [detail]);

  async function uploadDocument(existingOpportunityId?: number) {
    if (!file) return toast.error("اختر وثيقة أولًا");
    const form = new FormData();
    form.append("file", file);
    form.append("documentRole", documentRole);
    if (existingOpportunityId) form.append("opportunityId", String(existingOpportunityId));
    else {
      form.append("provisionalName", provisionalName);
      form.append("objective", objective);
    }
    setUploading(true);
    try {
      const response = await fetch("/api/como-next/project-opportunities/documents", { method: "POST", body: form, credentials: "include" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "تعذر رفع الوثيقة");
      toast.success(existingOpportunityId ? "أضيفت الوثيقة إلى الفرصة بأمان." : "فُتحت فرصة تحت الدراسة وحُفظت وثيقتها بأمان.");
      setFile(null);
      const input = document.getElementById("project-document-input") as HTMLInputElement | null;
      if (input) input.value = "";
      setSelectedId(Number(payload.opportunityId));
      await Promise.all([listQuery.refetch(), existingOpportunityId ? detailQuery.refetch() : Promise.resolve()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر رفع الوثيقة");
    } finally {
      setUploading(false);
    }
  }

  function updateFact(id: number, patch: Partial<FactDraft>) {
    setFactDrafts(current => current.map(fact => fact.id === id ? { ...fact, ...patch } : fact));
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,#fff8e9_0,#fbfcfb_36%,#eef3f3_100%)] text-slate-900" dir="rtl">
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-7">
          <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#173d4b] text-white"><Building2 className="h-5 w-5" /></div><div><p className="text-sm font-black">بوابة فتح مشروع</p><p className="text-[10px] text-slate-500">وثيقة ← قراءة ← مراجعة ← مشروع رسمي</p></div></div>
          <Button variant="outline" onClick={() => navigate("/")} className="rounded-xl border-slate-200 bg-white"><ArrowRight className="ml-2 h-4 w-4" /> الرئيسية</Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-7 sm:px-7">
        <section className="overflow-hidden rounded-[32px] border border-[#d8e3df] bg-[#102832] text-white shadow-[0_28px_80px_rgba(15,36,45,.16)]">
          <div className="grid gap-6 p-6 sm:p-9 lg:grid-cols-[1.2fr_.8fr]">
            <div><span className="inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-[11px] font-black text-amber-200"><ShieldCheck className="h-4 w-4" /> بوابة محكومة بالدليل</span><h1 className="mt-5 text-3xl font-black leading-tight sm:text-5xl">لا مشروع رسمي<br /><span className="text-amber-300">قبل قراءة وثيقة الأرض.</span></h1><p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">يمكنك البدء بوثيقة واحدة من أي نوع مدعوم. تُحفظ بأمان، ثم يقرأها Manus كمسودة، وأنت تعتمد الحقائق وتحدد علاقتنا بالأرض واستراتيجية التطوير. بعد ذلك فقط يُفتح المشروع وملفه التنفيذي.</p></div>
            <div className="grid content-center gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2"><Step number={1} title="حفظ الوثيقة" done={Boolean(detail?.documents.length)} active={!detail} /><Step number={2} title="قراءة Manus" done={Boolean(detail?.extractions.some((item: any) => item.extractionStatus === "draft"))} active={Boolean(detail?.documents.some((document: any) => document.analysisStatus === "pending"))} /><Step number={3} title="مراجعة عبد الرحمن" done={documentsReady && factsReady} active={currentStatus === "under_review"} /><Step number={4} title="فتح المشروع الرسمي" done={currentStatus === "approved"} active={currentStatus === "ready_for_approval"} /></div>
          </div>
        </section>

        <div className="mt-6 grid gap-5 lg:grid-cols-[330px_1fr]">
          <aside className="space-y-4">
            <Card className="rounded-[26px] border-slate-200 bg-white shadow-sm"><CardContent className="p-5"><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-700"><Plus className="h-5 w-5" /></div><div><h2 className="font-black">فرصة جديدة</h2><p className="text-[11px] text-slate-500">الاسم اختياري في البداية؛ الوثيقة إلزامية.</p></div></div><div className="mt-5 space-y-3"><Input value={selectedId ? "" : provisionalName} disabled={Boolean(selectedId)} onChange={event => setProvisionalName(event.target.value)} placeholder="اسم مؤقت — إن عُرف" className="rounded-xl" /><Textarea value={selectedId ? "" : objective} disabled={Boolean(selectedId)} onChange={event => setObjective(event.target.value)} placeholder="لماذا ندرس هذه الأرض؟ — اختياري" className="min-h-20 rounded-xl" /><Select value={documentRole} onValueChange={setDocumentRole}><SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(documentRoleLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select><Input id="project-document-input" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.json,.jpg,.jpeg,.png,.webp" onChange={event => setFile(event.target.files?.[0] || null)} className="rounded-xl" /><Button onClick={() => uploadDocument(selectedId || undefined)} disabled={!file || uploading} className="w-full rounded-xl bg-[#173d4b] text-white hover:bg-[#214f5e]">{uploading ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <FileUp className="ml-2 h-4 w-4" />}{selectedId ? "إضافة الوثيقة إلى الفرصة" : "فتح فرصة وحفظ الوثيقة"}</Button>{selectedId && <button type="button" onClick={() => { setSelectedId(null); setProvisionalName(""); setObjective(""); setFile(null); }} className="w-full text-center text-[11px] font-bold text-[#1f6478] hover:underline">بدء فرصة أخرى</button>}</div></CardContent></Card>

            <div><p className="mb-2 px-1 text-[11px] font-black text-slate-500">الفرص الحالية</p><div className="space-y-2">{listQuery.isLoading ? <div className="flex justify-center p-6"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div> : listQuery.data?.length ? listQuery.data.map((item: any) => <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} className={`w-full rounded-2xl border p-4 text-right transition ${selectedId === item.id ? "border-[#6ca1ae] bg-white shadow-md" : "border-slate-200 bg-white/75 hover:bg-white"}`}><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-black text-slate-900">{item.provisionalName || `فرصة #${item.id}`}</p><p className="mt-1 text-[10px] text-slate-500">{item.documentCount} وثيقة · {item.pendingFactCount} حقيقة تنتظر المراجعة</p></div><ChevronLeft className="mt-1 h-4 w-4 text-slate-400" /></div><Badge variant="outline" className={`mt-3 ${statusMeta[item.opportunityStatus]?.tone || ""}`}>{statusMeta[item.opportunityStatus]?.label || item.opportunityStatus}</Badge></button>) : <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-5 text-center text-xs text-slate-500">لا توجد فرص بعد. ابدأ بوثيقة واحدة.</div>}</div></div>
          </aside>

          <section>
            {!selectedId ? <Card className="rounded-[28px] border-dashed border-slate-300 bg-white/70"><CardContent className="flex min-h-[430px] flex-col items-center justify-center p-8 text-center"><FolderLock className="h-12 w-12 text-slate-300" /><h2 className="mt-4 text-xl font-black">ابدأ من الوثيقة</h2><p className="mt-2 max-w-md text-sm leading-7 text-slate-500">لن ينشئ النظام مشروعًا فارغًا. تُفتح أولًا فرصة دراسة، ثم تتحول إلى مشروع رسمي بعد مراجعتك.</p></CardContent></Card> : detailQuery.isLoading ? <Card className="rounded-[28px]"><CardContent className="flex min-h-[430px] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-[#1f6478]" /></CardContent></Card> : detailQuery.isError || !detail ? <Card className="rounded-[28px] border-red-200 bg-red-50"><CardContent className="p-8 text-center text-red-800"><CircleAlert className="mx-auto h-7 w-7" /><p className="mt-3 font-black">تعذر قراءة فرصة المشروع</p></CardContent></Card> : (
              <div className="space-y-5">
                <Card className="rounded-[28px] border-slate-200 bg-white shadow-sm"><CardContent className="p-5 sm:p-7"><div className="flex flex-wrap items-start justify-between gap-4"><div><Badge variant="outline" className={statusMeta[currentStatus]?.tone}>{statusMeta[currentStatus]?.label}</Badge><h2 className="mt-3 text-2xl font-black">{detail.opportunity.provisionalName || `فرصة مشروع #${detail.opportunity.id}`}</h2><p className="mt-2 text-xs text-slate-500">لا يظهر في قائمة المشاريع الرسمية حتى تضغط اعتماد فتح المشروع.</p></div>{detail.opportunity.approvedProjectId && <Button onClick={() => navigate(`/como-next/projects/${detail.opportunity.approvedProjectId}`)} className="rounded-xl bg-[#173d4b] text-white">فتح الملف التنفيذي <ChevronLeft className="mr-2 h-4 w-4" /></Button>}</div></CardContent></Card>

                <Card className="rounded-[28px] border-slate-200 bg-white shadow-sm"><CardContent className="p-5 sm:p-7"><div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-black text-[#1f6478]">المصدر الأول</p><h3 className="mt-1 text-lg font-black">الوثائق المحمية وقراءة Manus</h3></div><FileSearch className="h-6 w-6 text-[#1f6478]" /></div><div className="mt-5 space-y-3">{detail.documents.map((document: any) => <div key={document.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-black">{document.fileName}</p><p className="mt-1 text-[10px] text-slate-500">{documentRoleLabels[document.documentRole]} · {formatBytes(document.byteSize)} · {document.sha256.slice(0, 12)}…</p></div><div className="flex flex-wrap gap-2"><a href={document.downloadUrl} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-bold text-slate-700">تنزيل محمي</a>{document.analysisStatus === "pending" && <Button size="sm" onClick={() => analyzeMutation.mutate({ opportunityId: selectedId, opportunityDocumentId: document.id })} disabled={analyzeMutation.isPending} className="rounded-xl bg-[#1f6478] text-white"><BrainCircuit className="ml-1.5 h-4 w-4" /> قراءة Manus</Button>}</div></div><div className="mt-3 flex items-center gap-2 text-[11px]">{document.analysisStatus === "draft" ? <><FileCheck2 className="h-4 w-4 text-amber-600" /><span className="font-bold text-amber-800">مسودة قراءة تنتظر مراجعتك</span></> : document.analysisStatus === "reviewed" ? <><CheckCircle2 className="h-4 w-4 text-emerald-600" /><span className="font-bold text-emerald-800">تمت مراجعة القراءة</span></> : document.analysisStatus === "manual_reviewed" ? <><CheckCircle2 className="h-4 w-4 text-sky-600" /><span className="font-bold text-sky-800">راجعتها يدويًا</span></> : ["pending", "failed"].includes(document.analysisStatus) ? <label className={`flex cursor-pointer items-center gap-2 ${document.analysisStatus === "failed" ? "text-rose-700" : "text-slate-600"}`}><Checkbox checked={manualDocumentIds.includes(document.id)} onCheckedChange={checked => setManualDocumentIds(current => checked ? [...new Set([...current, document.id])] : current.filter(id => id !== document.id))} /> {document.analysisStatus === "failed" ? "تعذر الاستخراج؛ أؤكد أنني راجعت الوثيقة يدويًا" : "أو أؤكد أنني راجعت الوثيقة يدويًا دون تحليل Manus"}</label> : <><Loader2 className="h-4 w-4 animate-spin text-slate-500" /><span className="text-slate-500">قيد القراءة</span></>}</div></div>)}</div>{latestExtraction && <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50/70 p-4"><p className="text-[10px] font-black text-amber-800">خلاصة مسودة — ليست حقيقة معتمدة</p><p className="mt-2 text-sm leading-7 text-slate-700">{latestExtraction.executiveSummary || latestExtraction.errorMessage || "لا توجد خلاصة."}</p>{latestExtraction.conflicts?.length > 0 && <div className="mt-3 text-xs text-rose-800">تعارضات تحتاجك: {latestExtraction.conflicts.map((item: any) => item.topic).join("، ")}</div>}{latestExtraction.missingRequirements?.length > 0 && <div className="mt-2 text-xs text-slate-600">معلومات ناقصة: {latestExtraction.missingRequirements.join("، ")}</div>}</div>}</CardContent></Card>

                <Card className="rounded-[28px] border-slate-200 bg-white shadow-sm"><CardContent className="p-5 sm:p-7"><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-700"><FileCheck2 className="h-5 w-5" /></div><div><h3 className="text-lg font-black">بطاقة التعريف قبل الاعتماد</h3><p className="text-[11px] text-slate-500">يمكنك تعديل كل معلومة أو رفضها. لا شيء يعتمد بصمت.</p></div></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="space-y-1.5 text-xs font-bold text-slate-700">اسم المشروع<Input value={provisionalName} onChange={event => setProvisionalName(event.target.value)} className="rounded-xl" /></label><label className="space-y-1.5 text-xs font-bold text-slate-700">علاقتنا بالأرض<Select value={ownerRelationship} onValueChange={setOwnerRelationship}><SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{ownerRelationshipOptions.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></label><label className="space-y-1.5 text-xs font-bold text-slate-700">استراتيجية التطوير<Select value={developmentStrategy} onValueChange={setDevelopmentStrategy}><SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{strategyOptions.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></label><label className="space-y-1.5 text-xs font-bold text-slate-700 sm:col-span-2">هدف الدراسة<Textarea value={objective} onChange={event => setObjective(event.target.value)} className="min-h-20 rounded-xl" /></label></div>
                  {detail.facts.length > 0 && <><div className="mt-6 flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-black text-[#1f6478]">حقائق الوثيقة</p><p className="text-xs text-slate-500">الدليل ظاهر لكل معلومة.</p></div><Button variant="outline" size="sm" onClick={() => setFactDrafts(current => current.map(fact => ({ ...fact, reviewStatus: fact.reviewStatus === "rejected" ? "rejected" : "approved" })))} className="rounded-xl">اعتماد كل المقترحات كما ظهرت</Button></div><div className="mt-3 space-y-3">{detail.facts.map((fact: any) => { const draft = factDrafts.find(item => item.id === fact.id); if (!draft) return null; return <div key={fact.id} className={`rounded-2xl border p-4 ${fact.reviewStatus === "conflict" ? "border-rose-200 bg-rose-50/40" : "border-slate-200 bg-slate-50/60"}`}><div className="grid gap-3 sm:grid-cols-[1fr_170px]"><label className="space-y-1 text-xs font-bold text-slate-700">{fact.fieldLabel}<Input value={draft.value} disabled={draft.reviewStatus === "rejected"} onChange={event => updateFact(fact.id, { value: event.target.value, reviewStatus: "edited" })} className="rounded-xl bg-white" /></label><label className="space-y-1 text-xs font-bold text-slate-700">قرارك<Select value={draft.reviewStatus} onValueChange={value => updateFact(fact.id, { reviewStatus: value as FactDraft["reviewStatus"] })}><SelectTrigger className="rounded-xl bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pending">لم أراجع بعد</SelectItem><SelectItem value="approved">اعتماد كما هو</SelectItem><SelectItem value="edited">اعتماد بعد التعديل</SelectItem><SelectItem value="rejected">رفض المعلومة</SelectItem></SelectContent></Select></label></div>{fact.sourceExcerpt && <p className="mt-3 rounded-xl border-r-2 border-[#6ca1ae] bg-white px-3 py-2 text-[11px] leading-6 text-slate-500">الدليل: {fact.sourceExcerpt}</p>}</div>; })}</div></>}
                  <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5"><div className="text-[11px] leading-5 text-slate-500"><ShieldCheck className="ml-1 inline h-4 w-4 text-emerald-600" /> حفظ المراجعة لا يفتح مشروعًا ولا يشغّل دراسة مالية.</div><Button onClick={() => reviewMutation.mutate({ opportunityId: selectedId, provisionalName, ownerRelationship: ownerRelationship as any, developmentStrategy: developmentStrategy as any, objective, facts: factDrafts.map(fact => ({ id: fact.id, value: fact.value, reviewStatus: fact.reviewStatus === "pending" ? "approved" : fact.reviewStatus, reviewNote: fact.reviewNote })), manuallyReviewedDocumentIds: manualDocumentIds })} disabled={!canSaveReview || reviewMutation.isPending} className="rounded-xl bg-slate-900 text-white">{reviewMutation.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />} حفظ مراجعتي</Button></div></CardContent></Card>

                {currentStatus === "ready_for_approval" && <Card className="rounded-[28px] border-emerald-200 bg-emerald-50 shadow-sm"><CardContent className="flex flex-wrap items-center justify-between gap-4 p-5 sm:p-7"><div><p className="text-[10px] font-black text-emerald-700">المحطة الأخيرة</p><h3 className="mt-1 text-xl font-black text-emerald-950">كل شروط فتح المشروع مكتملة</h3><p className="mt-2 text-xs leading-6 text-emerald-800">سيُنشأ مشروع رسمي واحد، صلاحية مدير لك، ملف فتح واحد، ذاكرة مصدرها الوثائق، وملف تنفيذي موحد. لا دراسة مالية ولا مراسلة تلقائية.</p></div><Button onClick={() => approveMutation.mutate({ opportunityId: selectedId })} disabled={approveMutation.isPending} className="h-12 rounded-2xl bg-emerald-700 px-6 font-black text-white hover:bg-emerald-800">{approveMutation.isPending ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Building2 className="ml-2 h-4 w-4" />} اعتماد وفتح المشروع</Button></CardContent></Card>}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
