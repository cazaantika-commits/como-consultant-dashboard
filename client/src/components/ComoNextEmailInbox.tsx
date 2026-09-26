import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ComoNextIntakeProposals } from "@/components/ComoNextIntakeProposals";
import {
  Archive,
  ArrowLeft,
  Bot,
  FileLock2,
  Inbox,
  Link2,
  Loader2,
  MailCheck,
  MailQuestion,
  Paperclip,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

type InboxFilter = "attention" | "linked" | "dismissed";

function normalizeUtc(value: string | null | undefined) {
  if (!value) return null;
  return /Z$|[+-]\d{2}:?\d{2}$/.test(value) ? value : `${value.replace(" ", "T")}Z`;
}

function formatDateTime(value: string | null | undefined) {
  const normalized = normalizeUtc(value);
  if (!normalized) return "غير مؤرخ";
  return new Intl.DateTimeFormat("ar-AE", { timeZone: "Asia/Dubai", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(normalized));
}

const statusMeta: Record<string, { label: string; className: string }> = {
  unmatched: { label: "غير مطابق", className: "border-slate-200 bg-slate-100 text-slate-700" },
  suggested: { label: "ربط مقترح", className: "border-amber-200 bg-amber-50 text-amber-800" },
  linked: { label: "داخل ملف العمل", className: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  dismissed: { label: "مستبعد", className: "border-slate-200 bg-slate-50 text-slate-500" },
};

const importanceMeta: Record<string, { label: string; className: string }> = {
  unreviewed: { label: "لم يُراجع", className: "border-violet-200 bg-violet-50 text-violet-800" },
  normal: { label: "عادي", className: "border-slate-200 bg-white text-slate-600" },
  important: { label: "مهم", className: "border-amber-200 bg-amber-50 text-amber-800" },
  urgent: { label: "عاجل", className: "border-rose-200 bg-rose-50 text-rose-800" },
};

function MailCard({ item, onOpen }: { item: any; onOpen: (id: number) => void }) {
  const status = statusMeta[item.inboxStatus] || statusMeta.unmatched;
  const importance = importanceMeta[item.importance] || importanceMeta.unreviewed;
  return (
    <button type="button" onClick={() => onOpen(item.id)} className="group w-full rounded-[22px] border border-slate-200 bg-white p-4 text-right shadow-[0_10px_28px_rgba(15,23,42,.035)] transition hover:-translate-y-0.5 hover:border-[#8fb7c2] hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-slate-900">{item.subject}</p>
          <p className="mt-1 truncate text-xs text-slate-500">{item.fromName || item.fromEmail} · <bdi dir="ltr">{item.fromEmail}</bdi></p>
        </div>
        <ArrowLeft className="mt-1 h-4 w-4 shrink-0 text-slate-300 transition group-hover:-translate-x-1 group-hover:text-[#1f6478]" />
      </div>
      <p className="mt-3 line-clamp-2 text-xs leading-6 text-slate-600">{item.analysisSummary || item.bodyPreview || "لا يوجد نص مستخرج"}</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Badge variant="outline" className={`rounded-full text-[10px] ${status.className}`}>{status.label}</Badge>
        <Badge variant="outline" className={`rounded-full text-[10px] ${importance.className}`}>{importance.label}</Badge>
        {!item.serverSeen ? <Badge variant="outline" className="rounded-full border-sky-200 bg-sky-50 text-[10px] text-sky-700">غير مقروءة على الخادم</Badge> : null}
        {item.attachmentCount ? <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500"><Paperclip className="h-3.5 w-3.5" />{item.attachmentCount}</span> : null}
        <span className="ms-auto text-[10px] text-slate-400">{formatDateTime(item.receivedAt)}</span>
      </div>
      {item.suggestedProjectName ? <div className="mt-3 rounded-xl bg-[#f3f8f7] px-3 py-2 text-[11px] font-bold text-[#1f6478]">مقترح: {item.suggestedProjectName}{item.suggestedWorkFileTitle ? ` · ${item.suggestedWorkFileTitle}` : ""}</div> : null}
    </button>
  );
}

function MessageDialog({ emailId, open, onOpenChange, onChanged }: { emailId: number | null; open: boolean; onOpenChange: (value: boolean) => void; onChanged: () => Promise<void> }) {
  const detailQuery = trpc.comoNextEmail.get.useQuery({ emailId: emailId || 0 }, { enabled: Boolean(emailId && open) });
  const optionsQuery = trpc.comoNextEmail.linkingOptions.useQuery(undefined, { enabled: open });
  const linkMutation = trpc.comoNextEmail.linkToWorkFile.useMutation();
  const analyzeMutation = trpc.comoNextEmail.analyze.useMutation();
  const draftMutation = trpc.comoNextEmail.createReplyDraft.useMutation();
  const dismissMutation = trpc.comoNextEmail.dismiss.useMutation();
  const [projectId, setProjectId] = useState("");
  const [workFileId, setWorkFileId] = useState("");
  const [partyId, setPartyId] = useState("none");
  const [replyBody, setReplyBody] = useState("");
  const detail = detailQuery.data;

  const projects = useMemo(() => {
    const map = new Map<number, string>();
    for (const item of optionsQuery.data || []) map.set(item.projectId, item.projectName);
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [optionsQuery.data]);
  const workFiles = useMemo(() => {
    const map = new Map<number, string>();
    for (const item of optionsQuery.data || []) if (String(item.projectId) === projectId) map.set(item.workFileId, item.workFileTitle);
    return [...map.entries()].map(([id, title]) => ({ id, title }));
  }, [optionsQuery.data, projectId]);
  const parties = useMemo(() => {
    const map = new Map<number, string>();
    for (const item of optionsQuery.data || []) if (String(item.projectId) === projectId && item.projectPartyId) map.set(item.projectPartyId, item.partyName || `طرف ${item.projectPartyId}`);
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [optionsQuery.data, projectId]);

  useEffect(() => {
    if (!detail?.message) return;
    const message = detail.message;
    const nextProject = message.linkedProjectId || message.suggestedProjectId;
    const nextFile = message.linkedWorkFileId || message.suggestedWorkFileId;
    const nextParty = message.linkedProjectPartyId || message.suggestedProjectPartyId;
    setProjectId(nextProject ? String(nextProject) : "");
    setWorkFileId(nextFile ? String(nextFile) : "");
    setPartyId(nextParty ? String(nextParty) : "none");
    setReplyBody(detail.analysis?.replyDraftText || "");
  }, [detail]);

  const refresh = async () => { await detailQuery.refetch(); await onChanged(); };

  const linkMessage = async () => {
    if (!emailId || !projectId || !workFileId) { toast.error("اختر المشروع وملف العمل"); return; }
    try {
      const result = await linkMutation.mutateAsync({ emailId, projectId: Number(projectId), workFileId: Number(workFileId), projectPartyId: partyId === "none" ? null : Number(partyId) });
      toast.success(result.replayed ? "الرسالة مرتبطة مسبقًا" : `تم ربط الرسالة وحفظ ${result.documents} مرفق محمي`);
      await refresh();
    } catch (error: any) { toast.error(error?.message || "تعذر ربط الرسالة"); }
  };

  const analyze = async () => {
    if (!emailId) return;
    if (detail?.message.inboxStatus !== "linked") { toast.error("اعتمد ربط الرسالة بالمشروع وملف العمل أولًا"); return; }
    try {
      await analyzeMutation.mutateAsync({ emailId, requestKey: crypto.randomUUID() });
      toast.success("أعد Manus التحليل ومقترحاته للمراجعة دون إنشاء أي عمل تشغيلي");
      await refresh();
    } catch (error: any) { toast.error(error?.message || "تعذر تحليل الرسالة"); }
  };

  const createDraft = async () => {
    if (!emailId || !replyBody.trim()) { toast.error("اكتب أو راجع نص المسودة أولًا"); return; }
    try {
      await draftMutation.mutateAsync({ emailId, body: replyBody.trim() });
      toast.success("حُفظت مسودة الرد داخل ملف العمل — لم تُرسل");
      await refresh();
    } catch (error: any) { toast.error(error?.message || "تعذر حفظ المسودة"); }
  };

  const dismiss = async () => {
    if (!emailId) return;
    try {
      await dismissMutation.mutateAsync({ emailId });
      toast.success("نُقلت الرسالة إلى المستبعد دون تغييرها في الخادم");
      await onChanged();
      onOpenChange(false);
    } catch (error: any) { toast.error(error?.message || "تعذر استبعاد الرسالة"); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-h-[92vh] max-w-5xl overflow-y-auto rounded-[28px] border-slate-200 bg-[#fafbf9] p-0">
        {detailQuery.isLoading ? <div className="flex min-h-80 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-[#1f6478]" /></div> : detail ? <>
          <DialogHeader className="border-b border-slate-200 bg-white px-6 py-5 text-right">
            <div className="flex flex-wrap items-start justify-between gap-3 pe-8">
              <div className="min-w-0"><DialogTitle className="text-xl leading-8">{detail.message.subject}</DialogTitle><DialogDescription className="mt-2"><bdi dir="ltr">{detail.message.fromEmail}</bdi> · {formatDateTime(detail.message.receivedAt)}</DialogDescription></div>
              <div className="flex gap-2"><Badge variant="outline" className={`rounded-full ${statusMeta[detail.message.inboxStatus]?.className}`}>{statusMeta[detail.message.inboxStatus]?.label}</Badge><Badge variant="outline" className={`rounded-full ${importanceMeta[detail.message.importance]?.className}`}>{importanceMeta[detail.message.importance]?.label}</Badge></div>
            </div>
          </DialogHeader>

          <div className="space-y-5 p-6">
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs leading-6 text-emerald-900"><ShieldCheck className="ms-2 inline h-4 w-4" />قراءة داخلية فقط: لا إرسال، لا تحويل، لا حذف، ولا تغيير لحالة القراءة على خادم البريد.</div>

            <Card className="rounded-3xl border-slate-200 bg-white p-5 shadow-sm"><p className="whitespace-pre-wrap text-sm leading-8 text-slate-700">{detail.message.bodyText || "لا يوجد نص مستخرج"}</p></Card>

            {detail.attachments.length ? <Card className="rounded-3xl border-slate-200 bg-white p-5 shadow-sm"><h3 className="flex items-center gap-2 text-sm font-black"><Paperclip className="h-4 w-4 text-[#1f6478]" />المرفقات</h3><div className="mt-3 grid gap-2 sm:grid-cols-2">{detail.attachments.map((attachment: any) => <div key={attachment.id} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-[#fafaf7] p-3"><div className="min-w-0"><p className="truncate text-xs font-bold text-slate-800">{attachment.fileName}</p><p className="mt-1 text-[10px] text-slate-400"><bdi>{Math.ceil(Number(attachment.byteSize) / 1024)}</bdi> KB · {attachment.storageStatus === "stored" ? "محفوظ داخل الملف" : "يُحفظ بعد اعتماد الربط"}</p></div>{attachment.downloadPath ? <a href={attachment.downloadPath} className="text-[11px] font-bold text-[#1f6478]">تنزيل</a> : <FileLock2 className="h-4 w-4 text-slate-300" />}</div>)}</div></Card> : null}

            <Card className="rounded-3xl border-violet-100 bg-[#fbf9ff] p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="flex items-center gap-2 text-sm font-black text-violet-950"><Bot className="h-4 w-4" />مسودة Manus</h3><p className="mt-1 text-xs text-violet-700">بعد اعتماد الربط فقط؛ أي إجراء أو قرار أو مراسلة يبقى مقترحًا حتى تراجعه وتحوله بنفسك.</p></div><Button onClick={analyze} disabled={analyzeMutation.isPending || detail.message.inboxStatus !== "linked"} variant="outline" className="rounded-xl border-violet-200 bg-white text-violet-800">{analyzeMutation.isPending ? <Loader2 className="ms-2 h-4 w-4 animate-spin" /> : <Sparkles className="ms-2 h-4 w-4" />}تكليف Manus</Button></div>
              {detail.analysis ? <div className="mt-4 space-y-3"><p className="text-sm leading-7 text-slate-700">{detail.analysis.summaryAr}</p>{detail.analysis.whyImportant ? <div className="rounded-xl bg-white px-3 py-2 text-xs leading-6 text-slate-600"><strong>لماذا تهم:</strong> {detail.analysis.whyImportant}</div> : null}{detail.analysis.suggestedNextStep ? <div className="rounded-xl bg-white px-3 py-2 text-xs leading-6 text-slate-600"><strong>الخطوة المقترحة:</strong> {detail.analysis.suggestedNextStep}</div> : null}</div> : <p className="mt-4 text-xs text-slate-500">لم يُطلب تحليل هذه الرسالة بعد.</p>}
            </Card>

            <ComoNextIntakeProposals proposals={detail.proposals || []} onChanged={refresh} title="مقترحات Manus المستخرجة من الرسالة" />

            <Card className="rounded-3xl border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="flex items-center gap-2 text-sm font-black"><Link2 className="h-4 w-4 text-[#1f6478]" />الربط بمصدر الحقيقة</h3>
              {detail.message.suggestionReason ? <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-6 text-amber-900">اقتراح أولي: {detail.message.suggestionReason}</p> : <p className="mt-2 text-xs text-slate-500">لم نجد تطابقًا موثوقًا؛ اختر المشروع والملف يدويًا.</p>}
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <div className="grid gap-2"><Label>المشروع</Label><Select value={projectId} onValueChange={value => { setProjectId(value); setWorkFileId(""); setPartyId("none"); }} disabled={detail.message.inboxStatus === "linked"}><SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="اختر المشروع" /></SelectTrigger><SelectContent>{projects.map(project => <SelectItem key={project.id} value={String(project.id)}>{project.name}</SelectItem>)}</SelectContent></Select></div>
                <div className="grid gap-2"><Label>ملف العمل</Label><Select value={workFileId} onValueChange={setWorkFileId} disabled={!projectId || detail.message.inboxStatus === "linked"}><SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="اختر ملف العمل" /></SelectTrigger><SelectContent>{workFiles.map(file => <SelectItem key={file.id} value={String(file.id)}>{file.title}</SelectItem>)}</SelectContent></Select></div>
                <div className="grid gap-2"><Label>الطرف المرتبط</Label><Select value={partyId} onValueChange={setPartyId} disabled={!projectId || detail.message.inboxStatus === "linked"}><SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">دون طرف محدد</SelectItem>{parties.map(party => <SelectItem key={party.id} value={String(party.id)}>{party.name}</SelectItem>)}</SelectContent></Select></div>
              </div>
              <Button onClick={linkMessage} disabled={linkMutation.isPending || detail.message.inboxStatus === "linked"} className="mt-4 rounded-xl bg-[#153746] text-white hover:bg-[#1f5266]">{linkMutation.isPending ? <Loader2 className="ms-2 h-4 w-4 animate-spin" /> : <MailCheck className="ms-2 h-4 w-4" />}{detail.message.inboxStatus === "linked" ? "مرتبطة بملف العمل" : "اعتماد الربط وحفظ المرفقات"}</Button>
            </Card>

            {detail.message.inboxStatus === "linked" ? <Card className="rounded-3xl border-sky-100 bg-[#f7fbfd] p-5 shadow-sm"><h3 className="text-sm font-black text-sky-950">مسودة رد داخلية</h3><p className="mt-1 text-xs text-sky-700">يمكنك تعديلها وحفظها في ملف العمل. لا يوجد زر إرسال في هذا الصندوق.</p><Textarea value={replyBody} onChange={event => setReplyBody(event.target.value)} className="mt-4 min-h-40 rounded-2xl bg-white leading-7" placeholder="اكتب أو راجع مسودة الرد..." /><Button onClick={createDraft} disabled={draftMutation.isPending || Boolean(detail.message.replyDraftCommunicationId)} variant="outline" className="mt-3 rounded-xl border-sky-200 bg-white text-sky-800">{draftMutation.isPending ? <Loader2 className="ms-2 h-4 w-4 animate-spin" /> : <MailQuestion className="ms-2 h-4 w-4" />}{detail.message.replyDraftCommunicationId ? "المسودة محفوظة للمراجعة" : "حفظ مسودة — دون إرسال"}</Button></Card> : null}

            {detail.message.inboxStatus !== "linked" && detail.message.inboxStatus !== "dismissed" ? <div className="flex justify-end"><Button onClick={dismiss} disabled={dismissMutation.isPending} variant="ghost" className="rounded-xl text-slate-500"><Archive className="ms-2 h-4 w-4" />استبعاد من صندوق المطابقة</Button></div> : null}
          </div>
        </> : <div className="p-10 text-center text-sm text-slate-500">تعذر تحميل الرسالة.</div>}
      </DialogContent>
    </Dialog>
  );
}

export function ComoNextEmailInbox({ onOverviewChanged }: { onOverviewChanged: () => Promise<void> }) {
  const [filter, setFilter] = useState<InboxFilter>("attention");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const listQuery = trpc.comoNextEmail.list.useQuery(undefined, { staleTime: 15_000 });
  const syncMutation = trpc.comoNextEmail.syncReadonly.useMutation();
  const items = listQuery.data || [];
  const filtered = items.filter((item: any) => filter === "attention" ? ["unmatched", "suggested"].includes(item.inboxStatus) : item.inboxStatus === filter);
  const counts = {
    attention: items.filter((item: any) => ["unmatched", "suggested"].includes(item.inboxStatus)).length,
    linked: items.filter((item: any) => item.inboxStatus === "linked").length,
    dismissed: items.filter((item: any) => item.inboxStatus === "dismissed").length,
  };
  const refresh = async () => { await listQuery.refetch(); await onOverviewChanged(); };
  const sync = async () => {
    try {
      const result = await syncMutation.mutateAsync({ hours: 168, maxMessages: 100 });
      toast.success(`فُحصت ${result.scanned} رسالة: ${result.imported} جديدة، ${result.duplicates} دون تكرار`);
      await refresh();
    } catch (error: any) { toast.error(error?.message || "تعذرت قراءة صندوق البريد"); }
  };

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden rounded-[28px] border-[#cfe3df] bg-[#102f3a] p-0 text-white shadow-[0_20px_60px_rgba(15,47,58,.15)]">
        <div className="grid gap-6 p-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div><div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10"><Inbox className="h-6 w-6 text-amber-300" /></div><div><p className="text-[11px] font-black tracking-[.16em] text-amber-300">READ-ONLY INBOX</p><h2 className="mt-1 text-2xl font-black">صندوق البريد التنفيذي</h2></div></div><p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">اقرأ الرسائل، راجع اقتراح الربط، ثم اعتمد نقل الرسالة ومرفقاتها إلى ملف العمل. لا إرسال أو رد أو تحويل أو تغيير لحالة القراءة على الخادم.</p></div>
          <Button onClick={sync} disabled={syncMutation.isPending} className="h-12 rounded-2xl bg-amber-400 px-6 font-black text-slate-950 hover:bg-amber-300">{syncMutation.isPending ? <Loader2 className="ms-2 h-5 w-5 animate-spin" /> : <RefreshCw className="ms-2 h-5 w-5" />}قراءة آخر 7 أيام</Button>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">{[
        { key: "attention", label: "تحتاج مراجعة", value: counts.attention, icon: MailQuestion, tone: "text-amber-800 bg-amber-50" },
        { key: "linked", label: "داخل ملفات العمل", value: counts.linked, icon: MailCheck, tone: "text-emerald-800 bg-emerald-50" },
        { key: "dismissed", label: "مستبعدة", value: counts.dismissed, icon: Archive, tone: "text-slate-600 bg-slate-100" },
      ].map(item => { const Icon = item.icon; return <button key={item.key} type="button" onClick={() => setFilter(item.key as InboxFilter)} className={`rounded-3xl border p-5 text-right transition ${filter === item.key ? "border-[#7eaeb5] bg-white shadow-md" : "border-slate-200 bg-white/70 hover:bg-white"}`}><div className="flex items-center justify-between"><div><p className="text-xs font-bold text-slate-500">{item.label}</p><p className="mt-2 text-3xl font-black text-slate-900"><bdi>{item.value}</bdi></p></div><div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${item.tone}`}><Icon className="h-5 w-5" /></div></div></button>; })}</div>

      {listQuery.isLoading ? <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-[#1f6478]" /></div> : filtered.length ? <div className="grid gap-3 lg:grid-cols-2">{filtered.map((item: any) => <MailCard key={item.id} item={item} onOpen={setSelectedId} />)}</div> : <div className="flex min-h-64 flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white/70 p-8 text-center"><Inbox className="h-8 w-8 text-slate-300" /><h3 className="mt-4 text-sm font-black text-slate-800">لا توجد رسائل في هذا القسم</h3><p className="mt-2 text-xs text-slate-500">استخدم القراءة اليدوية لجلب الرسائل الجديدة دون تغيير صندوق البريد.</p></div>}

      <MessageDialog emailId={selectedId} open={selectedId !== null} onOpenChange={value => { if (!value) setSelectedId(null); }} onChanged={refresh} />
    </div>
  );
}
