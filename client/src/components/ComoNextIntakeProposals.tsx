import { useEffect, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArchiveX, Bot, CheckCircle2, ClipboardCheck, FileText, Loader2, Mail, MessageSquareText, Scale, Sparkles } from "lucide-react";

const kindMeta: Record<string, { label: string; icon: typeof ClipboardCheck; tone: string }> = {
  action: { label: "إجراء مقترح", icon: ClipboardCheck, tone: "border-blue-200 bg-blue-50 text-blue-800" },
  decision: { label: "قرار مقترح", icon: Scale, tone: "border-rose-200 bg-rose-50 text-rose-800" },
  communication_draft: { label: "مسودة مراسلة مقترحة", icon: MessageSquareText, tone: "border-sky-200 bg-sky-50 text-sky-800" },
  note: { label: "ملاحظة مقترحة", icon: FileText, tone: "border-slate-200 bg-slate-50 text-slate-700" },
};

const sourceMeta: Record<string, { label: string; icon: typeof Mail }> = {
  email: { label: "من تحليل بريد", icon: Mail },
  sara: { label: "من حديثك مع سارة", icon: Bot },
};

function toLocalInput(value?: string | null) {
  if (!value) return "";
  const date = new Date(/Z$|[+-]\d{2}:?\d{2}$/.test(value) ? value : `${value.replace(" ", "T")}Z`);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function ProposalDialog({ proposal, open, onOpenChange, onChanged }: { proposal: any; open: boolean; onOpenChange: (value: boolean) => void; onChanged: () => Promise<void> | void }) {
  const reviewMutation = trpc.comoNext.reviewIntakeProposal.useMutation();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [acceptanceCriteria, setAcceptanceCriteria] = useState("");
  const [ownerType, setOwnerType] = useState<"human" | "manus" | "team">("human");
  const [priority, setPriority] = useState<"normal" | "important" | "urgent">("normal");
  const [dueAt, setDueAt] = useState("");
  const [channel, setChannel] = useState<"email" | "whatsapp" | "letter" | "phone_note" | "internal">("internal");
  const [toText, setToText] = useState("");
  const [reviewNote, setReviewNote] = useState("");

  useEffect(() => {
    if (!proposal) return;
    setTitle(proposal.title || "");
    setContent(proposal.content || "");
    setAcceptanceCriteria(proposal.acceptanceCriteria || "");
    setOwnerType(proposal.ownerType || "human");
    setPriority(proposal.priority || "normal");
    setDueAt(toLocalInput(proposal.dueAt));
    setChannel(proposal.channel || "internal");
    setToText(proposal.toText || "");
    setReviewNote("");
  }, [proposal]);

  if (!proposal) return null;
  const kind = kindMeta[proposal.proposalKind] || kindMeta.note;
  const SourceIcon = (sourceMeta[proposal.sourceKind] || sourceMeta.email).icon;
  const targetLabel = proposal.proposalKind === "action" ? "إجراء" : proposal.proposalKind === "decision" ? "قرار مطلوب" : proposal.proposalKind === "communication_draft" ? "مسودة مراسلة" : "ملاحظة مراجعة";

  const submit = async (decision: "apply" | "dismiss") => {
    if (decision === "apply" && !title.trim()) return toast.error("راجع عنوان المقترح أولًا");
    if (decision === "apply" && proposal.proposalKind === "action" && !acceptanceCriteria.trim()) return toast.error("الإجراء يحتاج معيار قبول واضحًا");
    if (decision === "apply" && proposal.proposalKind === "communication_draft" && !content.trim()) return toast.error("مسودة المراسلة تحتاج نصًا");
    try {
      await reviewMutation.mutateAsync({
        proposalId: proposal.id,
        decision,
        reviewNote: reviewNote.trim() || null,
        title: title.trim() || null,
        content: content.trim() || null,
        acceptanceCriteria: acceptanceCriteria.trim() || null,
        ownerType,
        priority,
        dueAt: dueAt ? new Date(dueAt).toISOString() : null,
        channel,
        toText: toText.trim() || null,
      });
      toast.success(decision === "apply" ? `تم اعتماد المقترح وتحويله إلى ${targetLabel}` : "تم استبعاد المقترح دون أثر تشغيلي");
      await onChanged();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error?.message || "تعذرت مراجعة المقترح");
    }
  };

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent dir="rtl" className="!left-0 !top-0 !h-[100dvh] !w-screen !max-w-none !translate-x-0 !translate-y-0 overflow-x-hidden overflow-y-auto rounded-none border-slate-200 bg-[#fbfbf8] p-4 sm:!left-1/2 sm:!top-1/2 sm:!h-[94dvh] sm:!w-full sm:!max-w-3xl sm:!-translate-x-1/2 sm:!-translate-y-1/2 sm:rounded-[28px] sm:p-6">
      <DialogHeader className="text-right">
        <div className="flex items-center gap-2"><Badge variant="outline" className={`rounded-full ${kind.tone}`}>{kind.label}</Badge><Badge variant="outline" className="rounded-full bg-white"><SourceIcon className="ms-1 h-3.5 w-3.5" />{sourceMeta[proposal.sourceKind]?.label}</Badge></div>
        <DialogTitle className="pt-2 text-xl">مراجعة المقترح قبل أي أثر تشغيلي</DialogTitle>
        <DialogDescription>يمكنك تعديل المقترح ثم اعتماده وتحويله، أو استبعاده. لا يوجد تنفيذ أو إرسال تلقائي.</DialogDescription>
      </DialogHeader>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-7 text-amber-950"><strong>الدليل:</strong> «{proposal.evidenceExcerpt}»</div>
      <div className="grid gap-4">
        <div className="grid gap-2"><Label>العنوان</Label><Input value={title} onChange={event => setTitle(event.target.value)} className="h-11 rounded-xl bg-white" /></div>
        <div className="grid gap-2"><Label>{proposal.proposalKind === "decision" ? "السؤال المطلوب حسمه" : proposal.proposalKind === "communication_draft" ? "نص المسودة" : "التفاصيل"}</Label><Textarea value={content} onChange={event => setContent(event.target.value)} className="min-h-28 rounded-2xl bg-white leading-7" /></div>
        {proposal.proposalKind === "action" ? <div className="grid gap-2"><Label>معيار القبول</Label><Textarea value={acceptanceCriteria} onChange={event => setAcceptanceCriteria(event.target.value)} className="min-h-20 rounded-2xl bg-white leading-7" /></div> : null}
        <div className="grid gap-4 md:grid-cols-3">
          {proposal.proposalKind === "action" ? <div className="grid gap-2"><Label>المالك</Label><Select value={ownerType} onValueChange={value => setOwnerType(value as typeof ownerType)}><SelectTrigger className="h-11 rounded-xl bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="human">عبد الرحمن</SelectItem><SelectItem value="manus">Manus</SelectItem><SelectItem value="team">الفريق</SelectItem></SelectContent></Select></div> : null}
          <div className="grid gap-2"><Label>الأولوية</Label><Select value={priority} onValueChange={value => setPriority(value as typeof priority)}><SelectTrigger className="h-11 rounded-xl bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="normal">عادية</SelectItem><SelectItem value="important">مهمة</SelectItem><SelectItem value="urgent">عاجلة</SelectItem></SelectContent></Select></div>
          <div className="grid gap-2"><Label>الموعد</Label><Input type="datetime-local" value={dueAt} onChange={event => setDueAt(event.target.value)} className="h-11 rounded-xl bg-white" /></div>
        </div>
        {proposal.proposalKind === "communication_draft" ? <div className="grid gap-4 md:grid-cols-2"><div className="grid gap-2"><Label>القناة</Label><Select value={channel} onValueChange={value => setChannel(value as typeof channel)}><SelectTrigger className="h-11 rounded-xl bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="email">بريد</SelectItem><SelectItem value="whatsapp">واتساب</SelectItem><SelectItem value="letter">خطاب</SelectItem><SelectItem value="phone_note">ملاحظة اتصال</SelectItem><SelectItem value="internal">داخلي</SelectItem></SelectContent></Select></div><div className="grid gap-2"><Label>إلى</Label><Input value={toText} onChange={event => setToText(event.target.value)} className="h-11 rounded-xl bg-white" /></div></div> : null}
        <div className="grid gap-2"><Label>ملاحظة المراجعة</Label><Textarea value={reviewNote} onChange={event => setReviewNote(event.target.value)} className="min-h-20 rounded-2xl bg-white" placeholder="اختياري" /></div>
      </div>

      <div className="flex flex-wrap justify-end gap-3 border-t border-slate-200 pt-4">
        <Button variant="ghost" onClick={() => submit("dismiss")} disabled={reviewMutation.isPending} className="rounded-xl text-slate-500"><ArchiveX className="ms-2 h-4 w-4" />استبعاد</Button>
        <Button onClick={() => submit("apply")} disabled={reviewMutation.isPending} className="rounded-xl bg-[#163847] text-white hover:bg-[#22566a]">{reviewMutation.isPending ? <Loader2 className="ms-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="ms-2 h-4 w-4" />}اعتماد وتحويل إلى {targetLabel}</Button>
      </div>
    </DialogContent>
  </Dialog>;
}

export function ComoNextIntakeProposals({ proposals, onChanged, onOpenWorkFile, title = "مقترحات تنتظر مراجعتك" }: { proposals: any[]; onChanged: () => Promise<void> | void; onOpenWorkFile?: (workFileId: number) => void; title?: string }) {
  const [selected, setSelected] = useState<any | null>(null);
  if (!proposals?.length) return null;
  return <>
    <div className="space-y-2">{proposals.map(proposal => <button key={proposal.id} type="button" onClick={() => setSelected(proposal)} className="group flex min-h-14 w-full items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-right shadow-sm transition hover:border-violet-300 hover:shadow-md"><h3 className="min-w-0 flex-1 text-sm font-black leading-6 text-slate-900">{proposal.title}</h3><Sparkles className="h-4 w-4 shrink-0 text-violet-300 group-hover:text-violet-700" /></button>)}</div>
    <ProposalDialog proposal={selected} open={Boolean(selected)} onOpenChange={value => { if (!value) setSelected(null); }} onChanged={onChanged} />
  </>;
}
