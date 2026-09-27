import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCheck, ChevronLeft, FileSearch, PencilLine, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export type IntakeProposal = {
  id: number;
  projectId: number;
  projectName?: string | null;
  workFileId?: number | null;
  workFileTitle?: string | null;
  sourceMessageId?: number | null;
  sourceMessageSubject?: string | null;
  sourceMessageFrom?: string | null;
  sourceMessageOccurredAt?: string | null;
  proposalKind: "action" | "decision" | "communication_draft" | "risk" | "note";
  title: string;
  content?: string | null;
  acceptanceCriteria?: string | null;
  proposedOwnerType?: "human" | "manus" | "team" | null;
  proposedPriority?: "normal" | "important" | "urgent" | null;
  proposedDueAt?: string | null;
  evidenceExcerpt?: string | null;
  evidenceReference?: string | null;
  reviewStatus: "pending" | "applied" | "dismissed";
  targetType?: string | null;
  targetId?: number | null;
  reviewNote?: string | null;
  reviewedAt?: string | null;
  createdAt?: string | null;
};

type ProposalForm = {
  title: string;
  description: string;
  acceptanceCriteria: string;
  ownerType: "human" | "manus" | "team";
  priority: "normal" | "important" | "urgent";
  dueAt: string;
  reviewNote: string;
};

const kindMeta: Record<IntakeProposal["proposalKind"], { label: string; effect: string; tone: string }> = {
  action: { label: "إجراء مقترح", effect: "إنشاء إجراء داخلي داخل ملف الموضوع", tone: "border-emerald-100 bg-emerald-50 text-emerald-800" },
  decision: { label: "قرار مقترح", effect: "فتح قرار يحتاج حسم صاحب الصلاحية", tone: "border-rose-100 bg-rose-50 text-rose-800" },
  communication_draft: { label: "مسودة مراسلة", effect: "إنشاء مسودة داخلية فقط؛ لا إرسال", tone: "border-sky-100 bg-sky-50 text-sky-800" },
  risk: { label: "مخاطرة مقترحة", effect: "حفظ ملاحظة مخاطرة للمراجعة داخل الملف", tone: "border-amber-100 bg-amber-50 text-amber-800" },
  note: { label: "ملاحظة مقترحة", effect: "حفظ ملاحظة داخلية مرتبطة بالدليل", tone: "border-violet-100 bg-violet-50 text-violet-800" },
};

const statusLabel: Record<IntakeProposal["reviewStatus"], string> = {
  pending: "بانتظار مراجعتك",
  applied: "تم تطبيقه",
  dismissed: "مستبعد",
};

const ownerLabel: Record<ProposalForm["ownerType"], string> = { human: "عبد الرحمن", manus: "Manus", team: "فريق داخلي" };
const priorityLabel: Record<ProposalForm["priority"], string> = { normal: "عادية", important: "مهمة", urgent: "عاجلة" };

function dateTimeLocal(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

function formatDate(value?: string | null) {
  if (!value) return "غير محدد";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ar-AE", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function initialForm(proposal: IntakeProposal): ProposalForm {
  return {
    title: proposal.title || "",
    description: proposal.content || "",
    acceptanceCriteria: proposal.acceptanceCriteria || "",
    ownerType: proposal.proposedOwnerType || "human",
    priority: proposal.proposedPriority || "normal",
    dueAt: dateTimeLocal(proposal.proposedDueAt),
    reviewNote: proposal.reviewNote || "",
  };
}

function ProposalListRow({ proposal, onOpen }: { proposal: IntakeProposal; onOpen: () => void }) {
  const meta = kindMeta[proposal.proposalKind];
  return <button type="button" onClick={onOpen} className="group flex min-h-16 w-full items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-right shadow-sm transition hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-md">
    <span className="min-w-0 flex-1">
      <span className={`inline-flex rounded-full border px-2.5 py-1 text-[9px] font-black ${meta.tone}`}>{meta.label}</span>
      <span className="mt-2 block break-words text-sm font-black leading-7 text-slate-950">{proposal.title}</span>
    </span>
    <ChevronLeft className="h-5 w-5 shrink-0 text-slate-300 transition group-hover:-translate-x-1 group-hover:text-violet-700" />
  </button>;
}

function ProposalReviewPanel({ proposal, form, setForm, editOpen, setEditOpen, busy, onReview, onOpenWorkFile }: {
  proposal: IntakeProposal;
  form: ProposalForm;
  setForm: (next: ProposalForm) => void;
  editOpen: boolean;
  setEditOpen: (open: boolean) => void;
  busy: boolean;
  onReview: (decision: "apply" | "dismiss") => void;
  onOpenWorkFile?: (workFileId: number) => void;
}) {
  const meta = kindMeta[proposal.proposalKind];
  const effectTitle = proposal.proposalKind === "action" ? form.title : proposal.title;
  const sourceTitle = proposal.sourceMessageSubject || proposal.evidenceReference || "سجل مرتبط داخل COMO";

  return <div className="min-w-0 space-y-5">
    <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_18px_55px_rgba(20,34,52,.08)]">
      <div className="bg-[radial-gradient(circle_at_10%_0%,rgba(212,178,107,.24),transparent_35%),linear-gradient(135deg,#10283a_0%,#1b4753_68%,#225d55_100%)] p-5 text-white sm:p-7">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="rounded-full border-white/15 bg-white/10 text-amber-100 hover:bg-white/10">مراجعة قبل الأثر</Badge>
          <Badge className="rounded-full border-white/15 bg-white/10 text-white hover:bg-white/10">{meta.label}</Badge>
          <Badge className="rounded-full border-white/15 bg-white/10 text-white/75 hover:bg-white/10">{statusLabel[proposal.reviewStatus]}</Badge>
        </div>
        <h2 className="mt-4 break-words text-2xl font-black leading-10 sm:text-3xl">{proposal.title}</h2>
        <p className="mt-2 text-xs font-bold text-emerald-100">{proposal.projectName || "مشروع مرتبط"}{proposal.workFileTitle ? ` · ${proposal.workFileTitle}` : ""}</p>
      </div>

      <div className="grid gap-4 p-5 sm:p-7 lg:grid-cols-2">
        <section className="rounded-[22px] border border-amber-100 bg-[#fffaf0] p-4 sm:p-5">
          <div className="flex items-center gap-2 text-amber-800"><FileSearch className="h-5 w-5" /><h3 className="text-sm font-black">1. ما الذي وصل؟</h3></div>
          <p className="mt-3 text-xs font-black leading-6 text-slate-900">{sourceTitle}</p>
          {proposal.sourceMessageFrom ? <p className="mt-2 text-[11px] text-slate-500">من: <bdi dir="ltr">{proposal.sourceMessageFrom}</bdi></p> : null}
          <p className="mt-1 text-[11px] text-slate-500">{formatDate(proposal.sourceMessageOccurredAt || proposal.createdAt)}</p>
          {proposal.evidenceExcerpt ? <blockquote className="mt-4 max-h-52 overflow-y-auto whitespace-pre-wrap border-r-4 border-amber-300 pr-3 text-xs leading-7 text-slate-700">{proposal.evidenceExcerpt}</blockquote> : <p className="mt-4 text-xs leading-6 text-slate-500">لا يوجد مقتطف دليل منفصل؛ راجع المرجع المرتبط قبل الاعتماد.</p>}
        </section>

        <section className="rounded-[22px] border border-violet-100 bg-[#faf7ff] p-4 sm:p-5">
          <div className="flex items-center gap-2 text-violet-800"><Sparkles className="h-5 w-5" /><h3 className="text-sm font-black">2. قراءة Manus</h3></div>
          <div className="mt-3 rounded-xl border border-violet-100 bg-white px-3 py-2 text-[10px] font-bold leading-5 text-violet-700">هذه قراءة مقترحة مفصولة عن الدليل؛ ليست حقيقة معتمدة ولا قراراً.</div>
          <p className="mt-4 max-h-64 overflow-y-auto whitespace-pre-wrap text-sm leading-8 text-slate-700">{proposal.content || "لم يُحفظ تفسير مستقل لهذا المقترح."}</p>
        </section>
      </div>
    </section>

    <section className="rounded-[28px] border border-[#cfe3df] bg-[#f3faf7] p-5 shadow-sm sm:p-7">
      <div className="flex items-center gap-2 text-[#1d6577]"><CheckCheck className="h-5 w-5" /><h3 className="text-base font-black">3. ماذا سيحدث إذا اعتمدته؟</h3></div>
      <p className="mt-2 text-sm leading-7 text-slate-600">{meta.effect}. لا يحدث إرسال خارجي، ولا يتغير قرار أو محرك مالي تلقائياً.</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl bg-white p-4"><p className="text-[10px] font-black text-slate-400">السجل الناتج</p><p className="mt-2 text-sm font-black leading-6 text-slate-900">{effectTitle}</p></div>
        <div className="rounded-2xl bg-white p-4"><p className="text-[10px] font-black text-slate-400">المالك المقترح</p><p className="mt-2 text-sm font-black text-slate-900">{ownerLabel[form.ownerType]}</p></div>
        <div className="rounded-2xl bg-white p-4"><p className="text-[10px] font-black text-slate-400">الأولوية</p><p className="mt-2 text-sm font-black text-slate-900">{priorityLabel[form.priority]}</p></div>
        <div className="rounded-2xl bg-white p-4"><p className="text-[10px] font-black text-slate-400">الموعد</p><p className="mt-2 text-sm font-black text-slate-900">{form.dueAt ? formatDate(form.dueAt) : "غير محدد"}</p></div>
      </div>
      {form.acceptanceCriteria ? <div className="mt-3 rounded-2xl bg-white p-4"><p className="text-[10px] font-black text-slate-400">معيار القبول</p><p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">{form.acceptanceCriteria}</p></div> : null}
    </section>

    {proposal.reviewStatus === "pending" ? <>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="button" variant="outline" onClick={() => setEditOpen(!editOpen)} disabled={busy} className="min-h-12 flex-1 rounded-xl bg-white"><PencilLine className="ms-2 h-4 w-4" />{editOpen ? "إغلاق التعديل" : "مناقشة أو تعديل المقترح"}</Button>
        <Button type="button" onClick={() => onReview("apply")} disabled={busy} className="min-h-12 flex-1 rounded-xl bg-emerald-700 text-white hover:bg-emerald-800"><ShieldCheck className="ms-2 h-4 w-4" />اعتماد وتحويل</Button>
        <Button type="button" variant="outline" onClick={() => onReview("dismiss")} disabled={busy} className="min-h-12 rounded-xl border-rose-200 bg-white text-rose-700 hover:bg-rose-50"><Trash2 className="ms-2 h-4 w-4" />استبعاد دون أثر</Button>
      </div>

      {editOpen ? <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="mb-5"><p className="text-[10px] font-black text-violet-700">تحرير ثانوي</p><h3 className="mt-1 text-lg font-black text-slate-950">عدّل ما سيُنشأ، لا الدليل الأصلي</h3></div>
        <div className="space-y-4">
          <div><Label>العنوان</Label><Input className="mt-2 rounded-xl" value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} /></div>
          <div><Label>التفاصيل المقترحة</Label><Textarea className="mt-2 min-h-28 rounded-xl leading-7" value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} /></div>
          {proposal.proposalKind === "action" ? <>
            <div><Label>معيار القبول</Label><Textarea className="mt-2 min-h-24 rounded-xl leading-7" value={form.acceptanceCriteria} onChange={event => setForm({ ...form, acceptanceCriteria: event.target.value })} /></div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div><Label>المالك</Label><Select value={form.ownerType} onValueChange={(value: ProposalForm["ownerType"]) => setForm({ ...form, ownerType: value })}><SelectTrigger className="mt-2 rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="human">عبد الرحمن</SelectItem><SelectItem value="manus">Manus</SelectItem><SelectItem value="team">فريق داخلي</SelectItem></SelectContent></Select></div>
              <div><Label>الأولوية</Label><Select value={form.priority} onValueChange={(value: ProposalForm["priority"]) => setForm({ ...form, priority: value })}><SelectTrigger className="mt-2 rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="normal">عادية</SelectItem><SelectItem value="important">مهمة</SelectItem><SelectItem value="urgent">عاجلة</SelectItem></SelectContent></Select></div>
              <div><Label>الموعد</Label><Input type="datetime-local" className="mt-2 rounded-xl" value={form.dueAt} onChange={event => setForm({ ...form, dueAt: event.target.value })} /></div>
            </div>
          </> : null}
          <div><Label>ملاحظة المراجعة</Label><Textarea className="mt-2 min-h-20 rounded-xl leading-7" value={form.reviewNote} onChange={event => setForm({ ...form, reviewNote: event.target.value })} placeholder="سبب التعديل أو الاستبعاد، إن لزم" /></div>
        </div>
      </section> : null}
    </> : <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4"><div><p className="text-[10px] font-black text-slate-400">نتيجة المراجعة</p><p className="mt-1 text-sm font-black text-slate-900">{statusLabel[proposal.reviewStatus]}{proposal.targetType ? ` · ${proposal.targetType}` : ""}</p></div>{proposal.workFileId && onOpenWorkFile ? <Button type="button" onClick={() => onOpenWorkFile(proposal.workFileId!)} className="rounded-xl bg-[#1d6577] text-white">فتح ملف الموضوع</Button> : null}</div>}
  </div>;
}

function useProposalReview(proposal: IntakeProposal, onChanged: () => void, afterReview?: (decision: "apply" | "dismiss") => void) {
  const reviewMutation = trpc.comoNext.reviewIntakeProposal.useMutation();
  const [form, setForm] = useState<ProposalForm>(() => initialForm(proposal));
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    setForm(initialForm(proposal));
    setEditOpen(false);
  }, [proposal.id]);

  const review = async (decision: "apply" | "dismiss") => {
    try {
      await reviewMutation.mutateAsync({
        proposalId: proposal.id,
        decision,
        reviewNote: form.reviewNote.trim() || undefined,
        action: proposal.proposalKind === "action" ? {
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          acceptanceCriteria: form.acceptanceCriteria.trim(),
          ownerType: form.ownerType,
          priority: form.priority,
          dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : undefined,
        } : undefined,
      });
      toast.success(decision === "apply" ? "تم اعتماد المقترح وتحويله إلى السجل المحدد" : "استُبعد المقترح دون أثر تشغيلي");
      await onChanged();
      afterReview?.(decision);
    } catch (error: any) {
      toast.error(error?.message || "تعذرت مراجعة المقترح");
    }
  };

  return { form, setForm, editOpen, setEditOpen, review, busy: reviewMutation.isPending };
}

function ProposalDialog({ proposal, onChanged, onOpenWorkFile }: { proposal: IntakeProposal; onChanged: () => void; onOpenWorkFile?: (workFileId: number) => void }) {
  const [open, setOpen] = useState(false);
  const state = useProposalReview(proposal, onChanged, decision => {
    setOpen(false);
    if (decision === "apply" && proposal.workFileId && onOpenWorkFile) onOpenWorkFile(proposal.workFileId);
  });

  useEffect(() => {
    if (!open) state.setEditOpen(false);
  }, [open]);

  return <>
    <ProposalListRow proposal={proposal} onOpen={() => setOpen(true)} />
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent dir="rtl" className="h-[100dvh] w-screen max-w-none overflow-y-auto rounded-none border-0 bg-[#f8f8f5] p-4 pt-14 sm:h-auto sm:max-h-[92vh] sm:max-w-5xl sm:rounded-[30px] sm:border sm:p-6">
        <DialogHeader className="sr-only"><DialogTitle>{proposal.title}</DialogTitle><DialogDescription>مراجعة الدليل والتفسير والأثر المقترح قبل أي تطبيق.</DialogDescription></DialogHeader>
        <ProposalReviewPanel proposal={proposal} {...state} onReview={state.review} onOpenWorkFile={onOpenWorkFile} />
        <DialogFooter className="sm:justify-start"><Button type="button" variant="ghost" onClick={() => setOpen(false)} className="rounded-xl">إغلاق</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}

function ProposalFocusScreen({ proposal, onChanged, onBack, onOpenWorkFile }: { proposal: IntakeProposal; onChanged: () => void; onBack: () => void; onOpenWorkFile?: (workFileId: number) => void }) {
  const state = useProposalReview(proposal, onChanged, decision => {
    if (decision === "apply" && proposal.workFileId && onOpenWorkFile) onOpenWorkFile(proposal.workFileId);
    else onBack();
  });

  return <div className="min-h-[100dvh] min-w-0 max-w-full overflow-x-hidden bg-[#f8f8f5] p-3 pt-4 sm:min-h-0 sm:p-0">
    <button type="button" onClick={onBack} className="mb-4 inline-flex min-h-11 max-w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm"><ArrowLeft className="h-4 w-4 shrink-0" /><span className="break-words text-right">العودة إلى عناوين المقترحات</span></button>
    <ProposalReviewPanel proposal={proposal} {...state} onReview={state.review} onOpenWorkFile={onOpenWorkFile} />
  </div>;
}

export function ComoNextIntakeProposals({ proposals, onChanged, onOpenWorkFile, selectedProposalId, onSelectedProposalChange, title = "مقترحات مراجعة Manus" }: { proposals: IntakeProposal[]; onChanged: () => void; onOpenWorkFile?: (workFileId: number) => void; selectedProposalId?: number | null; onSelectedProposalChange?: (proposalId: number | null) => void; title?: string }) {
  const selectedProposal = useMemo(() => selectedProposalId ? proposals.find(item => item.id === selectedProposalId) || null : null, [proposals, selectedProposalId]);
  if (selectedProposal) return <ProposalFocusScreen proposal={selectedProposal} onChanged={onChanged} onBack={() => onSelectedProposalChange?.(null)} onOpenWorkFile={onOpenWorkFile} />;
  if (!proposals.length) return null;

  return <section>
    <div className="mb-3 flex items-center justify-between gap-3"><div><h3 className="text-base font-black text-slate-900">{title}</h3><p className="mt-1 text-xs text-slate-500">العنوان أولاً؛ افتح مقترحاً واحداً لتراجع دليله وتفسيره وأثره.</p></div><Badge variant="outline" className="rounded-full bg-white">{proposals.length}</Badge></div>
    <div className="space-y-2">{proposals.map(proposal => onSelectedProposalChange ? <ProposalListRow key={proposal.id} proposal={proposal} onOpen={() => onSelectedProposalChange(proposal.id)} /> : <ProposalDialog key={proposal.id} proposal={proposal} onChanged={onChanged} onOpenWorkFile={onOpenWorkFile} />)}</div>
  </section>;
}

export default ComoNextIntakeProposals;
