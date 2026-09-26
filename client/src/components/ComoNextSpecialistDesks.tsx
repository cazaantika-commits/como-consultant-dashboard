import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { default as Bot } from "lucide-react/dist/esm/icons/bot.js";
import { default as BriefcaseBusiness } from "lucide-react/dist/esm/icons/briefcase-business.js";
import { default as CheckCircle2 } from "lucide-react/dist/esm/icons/check-circle-2.js";
import { default as CircleAlert } from "lucide-react/dist/esm/icons/circle-alert.js";
import { default as ClipboardCheck } from "lucide-react/dist/esm/icons/clipboard-check.js";
import { default as FileSearch } from "lucide-react/dist/esm/icons/file-search.js";
import { default as Loader2 } from "lucide-react/dist/esm/icons/loader-2.js";
import { default as LockKeyhole } from "lucide-react/dist/esm/icons/lock-keyhole.js";
import { default as ShieldCheck } from "lucide-react/dist/esm/icons/shield-check.js";
import { default as XCircle } from "lucide-react/dist/esm/icons/x-circle.js";

type SpecialistCode = "project_monitor" | "contract_manager";
type WorkFile = { id: number; title: string; workFileStatus: string };

const specialistMeta: Record<SpecialistCode, {
  title: string;
  subtitle: string;
  defaultRequest: string;
  icon: typeof Bot;
  cardClass: string;
  iconClass: string;
}> = {
  project_monitor: {
    title: "مراقب المشروع والمتابعة التنفيذية",
    subtitle: "يراجع ما تأخر، وما يعتمد على غيره، وما يحتاج قرارًا أو متابعة تالية.",
    defaultRequest: "راجع الوضع التنفيذي الحالي للمشروع وحدد ما يستحق انتباهي الآن، مع ربط كل ملاحظة بدليلها واقتراح الخطوات التالية كمقترحات فقط.",
    icon: ClipboardCheck,
    cardClass: "border-teal-100 bg-gradient-to-br from-white to-[#f2faf8]",
    iconClass: "bg-teal-100 text-teal-800",
  },
  contract_manager: {
    title: "مدير العقود",
    subtitle: "يراجع موقف العقود والتسليمات والالتزامات والتغييرات والمخاطر التجارية.",
    defaultRequest: "راجع الموقف التعاقدي الحالي للمشروع وحدد الالتزامات والمخاطر والأسئلة المفتوحة، من دون افتراض نص غير موجود ومن دون إرسال أي إشعار.",
    icon: BriefcaseBusiness,
    cardClass: "border-amber-100 bg-gradient-to-br from-white to-[#fffaf0]",
    iconClass: "bg-amber-100 text-amber-800",
  },
};

const statusMeta: Record<string, { label: string; className: string }> = {
  requested: { label: "قيد الإعداد", className: "border-sky-200 bg-sky-50 text-sky-700" },
  draft: { label: "مسودة للمراجعة", className: "border-amber-200 bg-amber-50 text-amber-800" },
  reviewed: { label: "راجعها عبد الرحمن", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  dismissed: { label: "مستبعدة", className: "border-slate-200 bg-slate-100 text-slate-500" },
  failed: { label: "تعذر الإعداد", className: "border-rose-200 bg-rose-50 text-rose-700" },
};

const riskMeta: Record<string, { label: string; className: string }> = {
  normal: { label: "متابعة عادية", className: "border-slate-200 bg-white text-slate-600" },
  attention: { label: "يحتاج انتباهًا", className: "border-amber-200 bg-amber-50 text-amber-800" },
  urgent: { label: "عاجل", className: "border-rose-200 bg-rose-50 text-rose-700" },
};

function ReviewResult({ review, onRefresh }: { review: any; onRefresh: () => void | Promise<void> }) {
  const reviewMutation = trpc.comoNext.reviewSpecialistDraft.useMutation({
    onSuccess: async (_data, variables) => {
      toast.success(variables.decision === "reviewed" ? "سُجلت مراجعتك للمسودة" : "استُبعدت المسودة دون أثر تشغيلي");
      await onRefresh();
    },
    onError: error => toast.error(error.message),
  });
  const output = review.output;
  const status = statusMeta[review.reviewStatus] || statusMeta.requested;
  const risk = riskMeta[review.riskLevel] || null;
  return <Card className="rounded-[26px] border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={`rounded-full ${status.className}`}>{status.label}</Badge>
          {risk ? <Badge variant="outline" className={`rounded-full ${risk.className}`}>{risk.label}</Badge> : null}
        </div>
        <p className="mt-3 text-xs font-bold text-slate-500">طلب عبد الرحمن</p>
        <p className="mt-1 text-sm font-black leading-7 text-slate-900">{review.requestText}</p>
      </div>
      <span className="text-[10px] text-slate-400">{new Date(review.createdAt).toLocaleString("ar-AE")}</span>
    </div>

    {review.errorMessage ? <p className="mt-4 rounded-2xl bg-rose-50 p-4 text-xs leading-6 text-rose-700">{review.errorMessage}</p> : null}
    {output ? <div className="mt-5 space-y-5">
      <div className="rounded-2xl border border-slate-100 bg-[#fbfbf9] p-4">
        <p className="text-[10px] font-black text-[#1f6478]">الخلاصة التنفيذية</p>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">{output.executiveSummary}</p>
      </div>
      {output.findings?.length ? <div><p className="mb-2 text-xs font-black text-slate-700">الملاحظات المدعومة</p><div className="grid gap-2 lg:grid-cols-2">{output.findings.map((item: any, index: number) => <div key={`${item.title}-${index}`} className="rounded-2xl border border-slate-100 bg-white p-4"><div className="flex items-start justify-between gap-2"><p className="text-sm font-black text-slate-800">{item.title}</p><Badge variant="outline" className={`rounded-full text-[9px] ${(riskMeta[item.severity] || riskMeta.normal).className}`}>{(riskMeta[item.severity] || riskMeta.normal).label}</Badge></div><p className="mt-2 text-xs leading-6 text-slate-600">{item.detail}</p>{item.evidenceRefs?.length ? <p className="mt-3 text-[10px] leading-5 text-slate-400">الدليل: {item.evidenceRefs.join(" · ")}</p> : null}</div>)}</div></div> : null}
      {output.openQuestions?.length ? <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4"><p className="text-xs font-black text-amber-900">أسئلة لا يسمح الدليل بحسمها</p><ul className="mt-3 space-y-2 text-xs leading-6 text-amber-950">{output.openQuestions.map((item: any, index: number) => <li key={`${item.question}-${index}`}>• <b>{item.question}</b><span className="text-amber-800"> — {item.whyItMatters}</span></li>)}</ul></div> : null}
      {output.proposedNextSteps?.length ? <div><p className="mb-2 text-xs font-black text-slate-700">خطوات مقترحة — ليست أوامر</p><div className="space-y-2">{output.proposedNextSteps.map((item: any, index: number) => <div key={`${item.title}-${index}`} className="rounded-2xl border border-violet-100 bg-violet-50/40 p-4"><div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className="rounded-full bg-white text-[9px]">{item.kind}</Badge><Badge variant="outline" className="rounded-full bg-white text-[9px]">{item.priority}</Badge></div><p className="mt-2 text-sm font-black text-slate-800">{item.title}</p><p className="mt-1 text-xs leading-6 text-slate-600">{item.description}</p>{item.evidenceRefs?.length ? <p className="mt-2 text-[10px] text-slate-400">الدليل: {item.evidenceRefs.join(" · ")}</p> : null}</div>)}</div></div> : null}
    </div> : null}

    {review.reviewStatus === "draft" ? <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
      <Button onClick={() => reviewMutation.mutate({ reviewId: review.id, decision: "reviewed" })} disabled={reviewMutation.isPending} className="rounded-xl bg-emerald-700 text-white hover:bg-emerald-600"><CheckCircle2 className="ml-1.5 h-4 w-4" />سجل أنني راجعتها</Button>
      <Button variant="outline" onClick={() => reviewMutation.mutate({ reviewId: review.id, decision: "dismissed" })} disabled={reviewMutation.isPending} className="rounded-xl bg-white text-slate-600"><XCircle className="ml-1.5 h-4 w-4" />استبعاد المسودة</Button>
      <p className="w-full text-[10px] leading-5 text-slate-400">المراجعة لا تحول الخطوات المقترحة إلى أعمال ولا ترسل شيئًا. التحويل التشغيلي يبقى قرارًا منفصلًا داخل ملف العمل.</p>
    </div> : null}
  </Card>;
}

export function ComoNextSpecialistDesks({ projectId, workFiles }: { projectId: number; workFiles: WorkFile[] }) {
  const activeWorkFiles = useMemo(() => workFiles.filter(file => !["closed", "cancelled"].includes(file.workFileStatus)), [workFiles]);
  const defaultWorkFile = activeWorkFiles[0]?.id || null;
  const [requests, setRequests] = useState<Record<SpecialistCode, string>>({
    project_monitor: specialistMeta.project_monitor.defaultRequest,
    contract_manager: specialistMeta.contract_manager.defaultRequest,
  });
  const [workFileIds, setWorkFileIds] = useState<Record<SpecialistCode, number | null>>({ project_monitor: defaultWorkFile, contract_manager: defaultWorkFile });
  useEffect(() => {
    setWorkFileIds(current => ({
      project_monitor: current.project_monitor || defaultWorkFile,
      contract_manager: current.contract_manager || defaultWorkFile,
    }));
  }, [defaultWorkFile]);

  const capabilitiesQuery = trpc.comoNext.listSpecialistCapabilities.useQuery();
  const reviewsQuery = trpc.comoNext.listSpecialistReviews.useQuery({ projectId });
  const runMutation = trpc.comoNext.runSpecialistReview.useMutation({
    onSuccess: async data => {
      toast.success(data.replayed ? "المراجعة نفسها مسجلة سابقًا" : "اكتملت مسودة التخصص وبقيت للمراجعة");
      await reviewsQuery.refetch();
    },
    onError: error => toast.error(error.message),
  });

  if (capabilitiesQuery.error?.data?.code === "FORBIDDEN") return null;
  const capabilities = (capabilitiesQuery.data || []) as Array<{ capabilityCode: SpecialistCode; displayName: string; scopeSummary: string }>;
  const reviews = reviewsQuery.data || [];

  const run = (code: SpecialistCode) => {
    const requestText = requests[code].trim();
    if (requestText.length < 8) return toast.error("اكتب ما تريد مراجعته بوضوح");
    runMutation.mutate({
      projectId,
      workFileId: workFileIds[code],
      capabilityCode: code,
      requestText,
      requestKey: `specialist:${code}:${crypto.randomUUID()}`,
    });
  };

  return <section className="mt-8">
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-[11px] font-black text-[#5b3f75]">قدرات Manus المساندة — تعمل عند طلبك فقط</p>
        <h2 className="mt-1 text-2xl font-black">مراقب المشروع ومدير العقود</h2>
        <p className="mt-1 max-w-3xl text-sm leading-7 text-slate-500">ليسا عقلين منفصلين ولا وكلاء ذاتيي الحركة. لكل منهما نطاق وذاكرة مراجعة داخل المشروع؛ النتيجة مسودة موثقة، ولا تنفذ أو ترسل أو تغيّر حالة.</p>
      </div>
      <Badge variant="outline" className="rounded-full border-violet-200 bg-violet-50 text-violet-700"><ShieldCheck className="ml-1 h-3.5 w-3.5" />مسودة ومراجعة فقط</Badge>
    </div>

    <div className="grid gap-5 xl:grid-cols-2">
      {(["project_monitor", "contract_manager"] as SpecialistCode[]).map(code => {
        const capability = capabilities.find(item => item.capabilityCode === code);
        const meta = specialistMeta[code];
        const Icon = meta.icon;
        return <Card key={code} className={`rounded-[30px] p-6 shadow-sm ${meta.cardClass}`}>
          <div className="flex items-start gap-3"><div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${meta.iconClass}`}><Icon className="h-5 w-5" /></div><div><h3 className="text-lg font-black text-slate-900">{capability?.displayName || meta.title}</h3><p className="mt-1 text-xs leading-6 text-slate-600">{capability?.scopeSummary || meta.subtitle}</p></div></div>
          <div className="mt-5 space-y-3">
            <Textarea value={requests[code]} onChange={event => setRequests(current => ({ ...current, [code]: event.target.value }))} className="min-h-28 rounded-2xl border-slate-200 bg-white text-sm leading-7" />
            <Select value={workFileIds[code] ? String(workFileIds[code]) : "project"} onValueChange={value => setWorkFileIds(current => ({ ...current, [code]: value === "project" ? null : Number(value) }))}>
              <SelectTrigger className="rounded-xl bg-white"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="project">مراجعة المشروع كاملًا</SelectItem>{activeWorkFiles.map(file => <SelectItem key={file.id} value={String(file.id)}>{file.title}</SelectItem>)}</SelectContent>
            </Select>
            <Button onClick={() => run(code)} disabled={runMutation.isPending || capabilitiesQuery.isLoading} className="w-full rounded-xl bg-slate-900 text-white hover:bg-slate-800">{runMutation.isPending && runMutation.variables?.capabilityCode === code ? <Loader2 className="ml-1.5 h-4 w-4 animate-spin" /> : <FileSearch className="ml-1.5 h-4 w-4" />}إعداد مسودة مراجعة</Button>
            <p className="flex items-start gap-1.5 text-[10px] leading-5 text-slate-500"><LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0" />يقرأ السجل الحالي عند الضغط فقط. لا مراقبة في الخلفية ولا إنشاء إجراء أو قرار أو مراسلة.</p>
          </div>
        </Card>;
      })}
    </div>

    {reviews.length ? <div className="mt-6">
      <div className="mb-3 flex items-center justify-between gap-3"><div><p className="text-[10px] font-black text-slate-500">ذاكرة التخصص داخل المشروع</p><h3 className="text-lg font-black">مسودات المراجعة السابقة</h3></div><Badge variant="outline" className="rounded-full bg-white">{reviews.length}</Badge></div>
      <div className="space-y-4">{reviews.map((review: any) => <ReviewResult key={review.id} review={review} onRefresh={() => reviewsQuery.refetch()} />)}</div>
    </div> : null}

    {capabilitiesQuery.error && capabilitiesQuery.error.data?.code !== "FORBIDDEN" ? <p className="mt-4 rounded-2xl bg-rose-50 p-4 text-xs text-rose-700"><CircleAlert className="ml-1 inline h-4 w-4" />تعذر تحميل التخصصات المساندة.</p> : null}
  </section>;
}
