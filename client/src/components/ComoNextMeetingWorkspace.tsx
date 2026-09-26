import { useMemo, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Bot, CalendarDays, CheckCheck, ClipboardCheck, FileText, LockKeyhole, MicOff, Plus, ShieldCheck, Sparkles, UsersRound } from "lucide-react";

type SourceKind = "preparation" | "notes" | "transcript";
type ProposalTarget = "agenda_item" | "decision" | "action" | "external_commitment" | "risk" | "note" | "communication_draft";

const sourceLabels: Record<SourceKind, string> = {
  preparation: "مادة تحضير",
  notes: "ملاحظات الاجتماع",
  transcript: "تفريغ نصي",
};

const proposalLabels: Record<string, string> = {
  question: "سؤال",
  check: "تحقق",
  decision: "قرار مقترح",
  action: "إجراء مقترح",
  external_commitment: "التزام خارجي مقترح",
  risk: "مخاطرة",
  note: "ملاحظة",
};

const targetLabels: Record<ProposalTarget, string> = {
  agenda_item: "محور اجتماع",
  decision: "قرار مطلوب",
  action: "إجراء",
  external_commitment: "التزام خارجي مسجل",
  risk: "مخاطرة في الذاكرة",
  note: "ملاحظة في الذاكرة",
  communication_draft: "مسودة مراسلة — دون إرسال",
};

function normalizeUtc(value?: string | null) {
  if (!value) return null;
  return /Z$|[+-]\d{2}:?\d{2}$/.test(value) ? value : `${value.replace(" ", "T")}Z`;
}

function formatDateTime(value?: string | null) {
  const normalized = normalizeUtc(value);
  if (!normalized) return "غير مؤرخ";
  return new Intl.DateTimeFormat("ar-AE", { timeZone: "Asia/Dubai", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(normalized));
}

function NewMeetingDialog({ workFileId, onCreated }: { workFileId: number; onCreated: (meetingId: number) => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [objective, setObjective] = useState("");
  const [format, setFormat] = useState("in_person");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [location, setLocation] = useState("");
  const [participants, setParticipants] = useState("");
  const mutation = trpc.comoNext.createMeeting.useMutation();

  const submit = async () => {
    if (!title.trim()) return toast.error("أدخل عنوان الاجتماع");
    try {
      const result = await mutation.mutateAsync({
        workFileId,
        title: title.trim(),
        objective: objective.trim() || undefined,
        meetingType: "working_session",
        meetingFormat: format,
        startsAt: startsAt ? new Date(startsAt).toISOString() : undefined,
        endsAt: endsAt ? new Date(endsAt).toISOString() : undefined,
        location: location.trim() || undefined,
        participantNames: participants.split(/[\n,،]/).map(item => item.trim()).filter(Boolean),
        idempotencyKey: crypto.randomUUID(),
      });
      toast.success("أُنشئت غرفة الاجتماع داخل ملف العمل");
      setOpen(false);
      onCreated(result.id);
    } catch (error: any) { toast.error(error?.message || "تعذر إنشاء الاجتماع"); }
  };

  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button size="sm" variant="outline" className="rounded-xl border-[#bdd8d2] bg-white text-[#18596a]"><Plus className="ms-1.5 h-4 w-4" />اجتماع جديد</Button></DialogTrigger>
    <DialogContent dir="rtl" className="max-w-2xl rounded-3xl bg-[#fdfcf9]">
      <DialogHeader className="text-right"><DialogTitle>فتح غرفة اجتماع</DialogTitle><DialogDescription>مساحة عمل للتحضير والمحاور والملاحظات والمراجعة. لا تسجيل ولا إرسال ولا نتيجة تلقائية.</DialogDescription></DialogHeader>
      <div className="grid gap-4">
        <div className="grid gap-2"><Label>عنوان الاجتماع</Label><Input value={title} onChange={event => setTitle(event.target.value)} className="h-11 rounded-xl bg-white" /></div>
        <div className="grid gap-2"><Label>الهدف</Label><Textarea value={objective} onChange={event => setObjective(event.target.value)} className="min-h-24 rounded-xl bg-white" /></div>
        <div className="grid gap-4 sm:grid-cols-2"><div className="grid gap-2"><Label>الصيغة</Label><Select value={format} onValueChange={setFormat}><SelectTrigger className="h-11 rounded-xl bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="in_person">حضوري</SelectItem><SelectItem value="online">اجتماع مرئي</SelectItem><SelectItem value="phone_call">اتصال هاتفي</SelectItem><SelectItem value="internal">داخلي</SelectItem></SelectContent></Select></div><div className="grid gap-2"><Label>المكان أو الرابط الوصفي</Label><Input value={location} onChange={event => setLocation(event.target.value)} className="h-11 rounded-xl bg-white" /></div></div>
        <div className="grid gap-4 sm:grid-cols-2"><div className="grid gap-2"><Label>البداية</Label><Input type="datetime-local" value={startsAt} onChange={event => setStartsAt(event.target.value)} className="h-11 rounded-xl bg-white" /></div><div className="grid gap-2"><Label>النهاية</Label><Input type="datetime-local" value={endsAt} onChange={event => setEndsAt(event.target.value)} className="h-11 rounded-xl bg-white" /></div></div>
        <div className="grid gap-2"><Label>المشاركون — اسم في كل سطر</Label><Textarea value={participants} onChange={event => setParticipants(event.target.value)} className="min-h-24 rounded-xl bg-white" /></div>
      </div>
      <DialogFooter className="sm:justify-start"><Button onClick={submit} disabled={mutation.isPending} className="rounded-xl bg-[#16243b] hover:bg-[#203554]">فتح الغرفة</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}

function AddAgendaDialog({ meetingId, onUpdated }: { meetingId: number; onUpdated: () => void }) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [category, setCategory] = useState("");
  const [briefing, setBriefing] = useState("");
  const [audience, setAudience] = useState<"discuss" | "internal_only" | "reference">("discuss");
  const [priority, setPriority] = useState<"critical" | "high" | "normal">("normal");
  const [required, setRequired] = useState(false);
  const mutation = trpc.comoNext.addMeetingAgendaItem.useMutation();
  const submit = async () => {
    if (!prompt.trim()) return toast.error("اكتب محور الاجتماع");
    try {
      await mutation.mutateAsync({ meetingId, itemKind: "question", category: category.trim() || undefined, promptAr: prompt.trim(), briefingNote: briefing.trim() || undefined, audience, priority, isRequired: required });
      toast.success("أُضيف المحور للمراجعة"); setOpen(false); setPrompt(""); setCategory(""); setBriefing(""); onUpdated();
    } catch (error: any) { toast.error(error?.message || "تعذر إضافة المحور"); }
  };
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button size="sm" variant="outline" className="rounded-xl bg-white"><Plus className="ms-1 h-4 w-4" />محور</Button></DialogTrigger>
    <DialogContent dir="rtl" className="max-w-xl rounded-3xl bg-[#fdfcf9]"><DialogHeader className="text-right"><DialogTitle>إضافة محور</DialogTitle><DialogDescription>المحور الداخلي يبقى داخل COMO ولا يدخل المحضر الخارجي تلقائيًا.</DialogDescription></DialogHeader><div className="grid gap-4"><div className="grid gap-2"><Label>الفئة</Label><Input value={category} onChange={event => setCategory(event.target.value)} className="rounded-xl bg-white" /></div><div className="grid gap-2"><Label>المحور أو السؤال</Label><Textarea value={prompt} onChange={event => setPrompt(event.target.value)} className="min-h-24 rounded-xl bg-white" /></div><div className="grid gap-2"><Label>إحاطة عبد الرحمن</Label><Textarea value={briefing} onChange={event => setBriefing(event.target.value)} className="min-h-20 rounded-xl bg-white" /></div><div className="grid gap-4 sm:grid-cols-2"><Select value={audience} onValueChange={value => setAudience(value as typeof audience)}><SelectTrigger className="rounded-xl bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="discuss">للنقاش</SelectItem><SelectItem value="internal_only">داخلي فقط</SelectItem><SelectItem value="reference">مرجع</SelectItem></SelectContent></Select><Select value={priority} onValueChange={value => setPriority(value as typeof priority)}><SelectTrigger className="rounded-xl bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="critical">حرج</SelectItem><SelectItem value="high">مهم</SelectItem><SelectItem value="normal">عادي</SelectItem></SelectContent></Select></div><label className="flex items-center gap-2 text-sm font-semibold"><Checkbox checked={required} onCheckedChange={value => setRequired(Boolean(value))} />لا ينتهي الاجتماع مسؤولًا دون معالجة هذا المحور</label></div><DialogFooter className="sm:justify-start"><Button onClick={submit} disabled={mutation.isPending} className="rounded-xl bg-[#16243b]">حفظ المحور</Button></DialogFooter></DialogContent>
  </Dialog>;
}

function ConsentDialog({ meetingId, currentStatus, onUpdated }: { meetingId: number; currentStatus?: string; onUpdated: () => void }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"granted" | "declined" | "not_required">("granted");
  const [basis, setBasis] = useState("");
  const [evidence, setEvidence] = useState("");
  const mutation = trpc.comoNext.recordMeetingConsent.useMutation();
  const submit = async () => {
    try {
      await mutation.mutateAsync({ meetingId, consentScope: "transcription", consentStatus: status, consentBasis: basis.trim() || undefined, evidenceReference: evidence.trim() || undefined });
      toast.success("سُجلت حالة الموافقة — لم يبدأ أي تسجيل أو تفريغ"); setOpen(false); onUpdated();
    } catch (error: any) { toast.error(error?.message || "تعذر تسجيل الموافقة"); }
  };
  const granted = currentStatus === "granted";
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button size="sm" variant="outline" className={`rounded-xl ${granted ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}><ShieldCheck className="ms-1 h-4 w-4" />{granted ? "موافقة التفريغ مثبتة" : "موافقة التفريغ"}</Button></DialogTrigger>
    <DialogContent dir="rtl" className="max-w-xl rounded-3xl bg-[#fdfcf9]"><DialogHeader className="text-right"><DialogTitle>تسجيل حالة موافقة التفريغ</DialogTitle><DialogDescription>هذا السجل لا يشغّل الميكروفون ولا يبدأ تسجيلًا أو تفريغًا. إنه يثبت الموافقة فقط قبل قبول نص transcript.</DialogDescription></DialogHeader><div className="grid gap-4"><Select value={status} onValueChange={value => setStatus(value as typeof status)}><SelectTrigger className="rounded-xl bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="granted">موافقة صريحة</SelectItem><SelectItem value="declined">مرفوض</SelectItem><SelectItem value="not_required">غير مطلوب — ملاحظات مكتوبة فقط</SelectItem></SelectContent></Select><div className="grid gap-2"><Label>أساس الموافقة</Label><Textarea value={basis} onChange={event => setBasis(event.target.value)} className="min-h-20 rounded-xl bg-white" placeholder="من وافق وكيف تم إبلاغ المشاركين؟" /></div><div className="grid gap-2"><Label>مرجع الدليل</Label><Input value={evidence} onChange={event => setEvidence(event.target.value)} className="rounded-xl bg-white" placeholder="رسالة، بند الدعوة، أو ملاحظة موثقة" /></div></div><DialogFooter className="sm:justify-start"><Button onClick={submit} disabled={mutation.isPending} className="rounded-xl bg-[#16243b]">حفظ الحالة فقط</Button></DialogFooter></DialogContent>
  </Dialog>;
}

function AddSourceDialog({ meetingId, consentGranted, onUpdated }: { meetingId: number; consentGranted: boolean; onUpdated: () => void }) {
  const [open, setOpen] = useState(false);
  const [sourceKind, setSourceKind] = useState<SourceKind>("notes");
  const [visibility, setVisibility] = useState<"meeting_record" | "internal_only">("meeting_record");
  const [title, setTitle] = useState("");
  const [rawText, setRawText] = useState("");
  const mutation = trpc.comoNext.addMeetingSource.useMutation();
  const submit = async () => {
    if (!title.trim() || rawText.trim().length < 10) return toast.error("أدخل عنوانًا ونصًا كافيًا");
    try {
      await mutation.mutateAsync({ meetingId, sourceKind, visibility, title: title.trim(), rawText: rawText.trim(), idempotencyKey: crypto.randomUUID() });
      toast.success("حُفظت المادة الأولية فقط — لم تُحلل ولم تنشئ نتائج"); setOpen(false); setTitle(""); setRawText(""); onUpdated();
    } catch (error: any) { toast.error(error?.message || "تعذر حفظ المادة"); }
  };
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button size="sm" variant="outline" className="rounded-xl bg-white"><FileText className="ms-1 h-4 w-4" />إضافة مادة</Button></DialogTrigger>
    <DialogContent dir="rtl" className="max-w-2xl rounded-3xl bg-[#fdfcf9]"><DialogHeader className="text-right"><DialogTitle>إضافة مادة أولية</DialogTitle><DialogDescription>ألصق نص التحضير أو الملاحظات أو التفريغ. لا تحليل تلقائي ولا إنشاء إجراءات.</DialogDescription></DialogHeader><div className="grid gap-4"><div className="grid gap-4 sm:grid-cols-2"><Select value={sourceKind} onValueChange={value => setSourceKind(value as SourceKind)}><SelectTrigger className="rounded-xl bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="preparation">مادة تحضير</SelectItem><SelectItem value="notes">ملاحظات مكتوبة</SelectItem><SelectItem value="transcript" disabled={!consentGranted}>تفريغ نصي — يحتاج موافقة</SelectItem></SelectContent></Select><Select value={visibility} onValueChange={value => setVisibility(value as typeof visibility)}><SelectTrigger className="rounded-xl bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="meeting_record">سجل الاجتماع</SelectItem><SelectItem value="internal_only">داخلي فقط</SelectItem></SelectContent></Select></div><div className="grid gap-2"><Label>العنوان</Label><Input value={title} onChange={event => setTitle(event.target.value)} className="rounded-xl bg-white" /></div><div className="grid gap-2"><Label>النص الأصلي</Label><Textarea value={rawText} onChange={event => setRawText(event.target.value)} className="min-h-72 rounded-xl bg-white" /></div>{sourceKind === "transcript" && !consentGranted ? <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-6 text-amber-900">لن يقبل النظام التفريغ قبل تسجيل الموافقة الصريحة.</p> : null}</div><DialogFooter className="sm:justify-start"><Button onClick={submit} disabled={mutation.isPending || (sourceKind === "transcript" && !consentGranted)} className="rounded-xl bg-[#16243b]">حفظ المادة</Button></DialogFooter></DialogContent>
  </Dialog>;
}

function AgendaRow({ item, readOnly, onUpdated }: { item: any; readOnly: boolean; onUpdated: () => void }) {
  const [response, setResponse] = useState(item.response || "");
  const mutation = trpc.comoNext.updateMeetingAgendaItem.useMutation();
  const save = async (checked: boolean) => {
    try { await mutation.mutateAsync({ agendaItemId: Number(item.id), response: response.trim() || undefined, isChecked: checked }); toast.success("حُفظت نتيجة المحور"); onUpdated(); }
    catch (error: any) { toast.error(error?.message || "تعذر حفظ المحور"); }
  };
  return <div className={`rounded-2xl border p-4 ${item.audience === "internal_only" ? "border-violet-200 bg-violet-50/70" : item.isRequired ? "border-amber-200 bg-amber-50/40" : "border-slate-200 bg-white"}`}><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><div className="mb-2 flex flex-wrap gap-2"><Badge variant="outline" className="rounded-full bg-white">{item.category || "محور"}</Badge>{item.isRequired ? <Badge variant="outline" className="rounded-full border-rose-200 bg-rose-50 text-rose-700">مطلوب</Badge> : null}{item.priority === "critical" ? <Badge variant="outline" className="rounded-full border-rose-200 bg-rose-50 text-rose-700">حرج</Badge> : null}{item.audience === "internal_only" ? <Badge variant="outline" className="rounded-full border-violet-200 bg-violet-100 text-violet-800"><LockKeyhole className="ms-1 h-3 w-3" />داخلي فقط</Badge> : null}</div><p className="text-sm font-bold leading-7 text-slate-900">{item.promptAr || item.promptEn}</p>{item.briefingNote ? <p className="mt-2 text-xs leading-6 text-slate-600">{item.briefingNote}</p> : null}{item.sourceEvidence ? <p className="mt-2 rounded-xl bg-white/80 px-3 py-2 text-[11px] leading-5 text-slate-500">الدليل: {item.sourceEvidence}</p> : null}</div>{item.isChecked ? <CheckCheck className="h-5 w-5 text-emerald-700" /> : null}</div>{!readOnly ? <div className="mt-3 grid gap-2"><Textarea value={response} onChange={event => setResponse(event.target.value)} className="min-h-20 rounded-xl bg-white" placeholder="النتيجة أو الإجابة المدعومة..." /><div className="flex justify-end gap-2"><Button size="sm" variant="outline" onClick={() => save(false)} disabled={mutation.isPending} className="rounded-xl bg-white">حفظ دون إغلاق</Button><Button size="sm" onClick={() => save(true)} disabled={mutation.isPending} className="rounded-xl bg-emerald-700 hover:bg-emerald-800">تمت المعالجة</Button></div></div> : item.response ? <p className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs leading-6 text-emerald-900">{item.response}</p> : null}</div>;
}

function ProposalCard({ proposal, onUpdated }: { proposal: any; onUpdated: () => void }) {
  const defaultTarget: ProposalTarget = proposal.proposalKind === "decision" ? "decision" : proposal.proposalKind === "action" ? "action" : proposal.proposalKind === "external_commitment" ? "external_commitment" : proposal.proposalKind === "risk" ? "risk" : proposal.proposalKind === "question" || proposal.proposalKind === "check" ? "agenda_item" : "note";
  const [target, setTarget] = useState<ProposalTarget>(defaultTarget);
  const [note, setNote] = useState("");
  const mutation = trpc.comoNext.reviewMeetingProposal.useMutation();
  const decide = async (decision: "apply" | "dismiss") => {
    try { await mutation.mutateAsync({ proposalId: Number(proposal.id), decision, applyAs: decision === "apply" ? target : undefined, reviewNote: note.trim() || undefined }); toast.success(decision === "apply" ? "طُبق المقترح في السجل المختار" : "استُبعد المقترح"); onUpdated(); }
    catch (error: any) { toast.error(error?.message || "تعذر مراجعة المقترح"); }
  };
  return <Card className={`rounded-2xl p-4 shadow-none ${proposal.audience === "internal_only" ? "border-violet-200 bg-violet-50/70" : "border-slate-200 bg-white"}`}><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><div className="mb-2 flex flex-wrap gap-2"><Badge variant="outline" className="rounded-full bg-white">{proposalLabels[proposal.proposalKind] || proposal.proposalKind}</Badge>{proposal.audience === "internal_only" ? <Badge variant="outline" className="rounded-full border-violet-200 bg-violet-100 text-violet-800">داخلي فقط</Badge> : null}<Badge variant="outline" className={`rounded-full ${proposal.reviewStatus === "pending" ? "border-amber-200 bg-amber-50 text-amber-800" : proposal.reviewStatus === "applied" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>{proposal.reviewStatus === "pending" ? "بانتظار المراجعة" : proposal.reviewStatus === "applied" ? "طُبق بعد المراجعة" : "مستبعد"}</Badge></div><h4 className="font-black leading-6 text-slate-900">{proposal.title}</h4>{proposal.content ? <p className="mt-2 text-xs leading-6 text-slate-600">{proposal.content}</p> : null}<blockquote className="mt-3 border-r-2 border-[#7fb9ad] pr-3 text-[11px] leading-6 text-slate-500">«{proposal.evidenceExcerpt}»</blockquote></div></div>{proposal.reviewStatus === "pending" ? <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4"><div className="grid gap-3 sm:grid-cols-[1fr_1.2fr]"><Select value={target} onValueChange={value => setTarget(value as ProposalTarget)}><SelectTrigger className="rounded-xl bg-white"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(targetLabels).map(([value, label]) => <SelectItem key={value} value={value} disabled={proposal.audience === "internal_only" && value === "communication_draft"}>{label}</SelectItem>)}</SelectContent></Select><Input value={note} onChange={event => setNote(event.target.value)} className="rounded-xl bg-white" placeholder="ملاحظة المراجعة — اختياري" /></div><div className="flex flex-wrap justify-end gap-2"><Button size="sm" variant="outline" onClick={() => decide("dismiss")} disabled={mutation.isPending} className="rounded-xl bg-white">استبعاد</Button><Button size="sm" onClick={() => decide("apply")} disabled={mutation.isPending} className="rounded-xl bg-emerald-700 hover:bg-emerald-800">تطبيق انتقائي</Button></div></div> : null}</Card>;
}

function MinutesPanel({ meetingId, minutes, meetingStatus, meetingOutcomeSummary, onUpdated }: { meetingId: number; minutes: any[]; meetingStatus: string; meetingOutcomeSummary?: string | null; onUpdated: () => void }) {
  const [summary, setSummary] = useState("");
  const [note, setNote] = useState("");
  const prepare = trpc.comoNext.prepareMeetingMinutes.useMutation();
  const review = trpc.comoNext.reviewMeetingMinutes.useMutation();
  const latest = minutes[0];
  const createDraft = async () => { try { await prepare.mutateAsync({ meetingId, summary: summary.trim() }); toast.success("أُعدت مسودة محضر للمراجعة"); setSummary(""); onUpdated(); } catch (error: any) { toast.error(error?.message || "تعذر إعداد المحضر"); } };
  const reviewDraft = async (decision: "approve" | "reject") => { try { await review.mutateAsync({ minutesId: Number(latest.id), decision, reviewNote: note.trim() || undefined }); toast.success(decision === "approve" ? "اعتمد المحضر وأُغلق الاجتماع" : "رُفضت المسودة"); onUpdated(); } catch (error: any) { toast.error(error?.message || "تعذر مراجعة المحضر"); } };
  return <div className="space-y-3"><div className="flex items-center gap-2"><ClipboardCheck className="h-5 w-5 text-emerald-700" /><div><h3 className="font-black text-slate-900">المحضر والإغلاق</h3><p className="text-xs text-slate-500">لا يدخل المحضر نقطة داخلية، ولا يُعتمد قبل معالجة المطلوب ومراجعة المقترحات.</p></div></div>{latest ? <Card className="rounded-2xl border-emerald-100 bg-white p-4 shadow-none"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><Badge variant="outline" className={`rounded-full ${latest.minutesStatus === "approved" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : latest.minutesStatus === "draft" ? "border-amber-200 bg-amber-50 text-amber-800" : "bg-slate-100"}`}>{latest.minutesStatus === "approved" ? "محضر معتمد" : latest.minutesStatus === "draft" ? "مسودة للمراجعة" : "نسخة سابقة"}</Badge><span className="text-[11px] text-slate-400">الإصدار {latest.version}</span></div><ScrollArea className="h-72 rounded-xl border border-slate-100 bg-[#fbfbf8] p-4"><pre dir="rtl" className="whitespace-pre-wrap font-sans text-xs leading-7 text-slate-700">{latest.content}</pre></ScrollArea>{latest.minutesStatus === "draft" ? <div className="mt-3 grid gap-3"><Input value={note} onChange={event => setNote(event.target.value)} className="rounded-xl" placeholder="ملاحظة المراجعة — اختياري" /><div className="flex justify-end gap-2"><Button size="sm" variant="outline" onClick={() => reviewDraft("reject")} className="rounded-xl bg-white">رفض المسودة</Button><Button size="sm" onClick={() => reviewDraft("approve")} className="rounded-xl bg-emerald-700 hover:bg-emerald-800">اعتماد وإغلاق الاجتماع</Button></div></div> : null}</Card> : meetingStatus === "completed" && meetingOutcomeSummary ? <Card className="rounded-2xl border-emerald-100 bg-white p-4 shadow-none"><div className="mb-3 flex items-center justify-between"><Badge variant="outline" className="rounded-full border-emerald-200 bg-emerald-50 text-emerald-800">محضر منقول ومعتمد تاريخيًا</Badge></div><ScrollArea className="h-72 rounded-xl border border-slate-100 bg-[#fbfbf8] p-4"><pre dir="rtl" className="whitespace-pre-wrap font-sans text-xs leading-7 text-slate-700">{meetingOutcomeSummary}</pre></ScrollArea></Card> : meetingStatus !== "completed" ? <Card className="rounded-2xl border-slate-200 bg-white p-4 shadow-none"><Label>الخلاصة التنفيذية التي سيُبنى عليها المحضر</Label><Textarea value={summary} onChange={event => setSummary(event.target.value)} className="mt-2 min-h-28 rounded-xl" placeholder="ما الذي تحقق، وما الذي بقي مفتوحًا؟" /><Button onClick={createDraft} disabled={prepare.isPending || summary.trim().length < 10} className="mt-3 rounded-xl bg-[#16243b]">إعداد مسودة المحضر</Button></Card> : null}</div>;
}

export function MeetingWorkspaceDialog({ meeting, open, onOpenChange, onUpdated }: { meeting: any; open: boolean; onOpenChange: (open: boolean) => void; onUpdated: () => void }) {
  const query = trpc.comoNext.getMeetingWorkspace.useQuery({ meetingId: Number(meeting.id) }, { enabled: open });
  const utils = trpc.useUtils();
  const refresh = async () => { await query.refetch(); await utils.comoNext.getOverview.invalidate(); onUpdated(); };
  const data = query.data;
  const [analysisPendingId, setAnalysisPendingId] = useState<number | null>(null);
  const analyze = trpc.comoNext.analyzeMeetingSource.useMutation();
  const runAnalysis = async (sourceId: number) => { setAnalysisPendingId(sourceId); try { await analyze.mutateAsync({ sourceId, requestKey: crypto.randomUUID() }); toast.success("أعد Manus مسودة تحليل؛ لم ينشئ أي نتيجة تشغيلية"); await refresh(); } catch (error: any) { toast.error(error?.message || "تعذر تحليل المادة"); } finally { setAnalysisPendingId(null); } };
  const transcriptionConsent = data?.consents.find((item: any) => item.consentScope === "transcription")?.consentStatus;
  const analysesBySource = useMemo(() => new Set((data?.analyses || []).map((item: any) => Number(item.sourceId))), [data?.analyses]);
  const readOnly = data?.meeting.meetingStatus === "completed" || data?.meeting.meetingStatus === "cancelled";

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent dir="rtl" className="h-[92vh] max-w-6xl overflow-hidden rounded-[30px] bg-[#f8f8f5] p-0">
      <div className="border-b border-slate-200 bg-[#16243b] px-6 py-5 text-white"><DialogHeader className="text-right"><div className="mb-2 flex flex-wrap items-center gap-2"><Badge variant="outline" className="rounded-full border-white/20 bg-white/10 text-white">{readOnly ? "مغلق" : "غرفة عمل"}</Badge><Badge variant="outline" className="rounded-full border-[#73bdb0]/30 bg-[#73bdb0]/10 text-[#bde8df]"><MicOff className="ms-1 h-3 w-3" />لا تسجيل نشط</Badge></div><DialogTitle className="text-xl font-black text-white">{meeting.title}</DialogTitle><DialogDescription className="text-slate-300">{meeting.objective || "تحضير، إدارة، مراجعة، ثم محضر معتمد داخل ملف العمل."}</DialogDescription></DialogHeader></div>
      <ScrollArea className="h-[calc(92vh-122px)]"><div className="space-y-6 p-6">{query.isLoading ? <p className="py-20 text-center text-sm text-slate-500">جاري فتح غرفة الاجتماع...</p> : query.isError ? <p className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{query.error.message}</p> : data ? <>
        <Card className="rounded-3xl border-[#cfe3df] bg-[#f1f8f6] p-5 shadow-none"><div className="grid gap-4 sm:grid-cols-3"><div><p className="text-[11px] font-bold text-slate-400">الموعد</p><p className="mt-1 text-sm font-bold text-slate-800">{formatDateTime(data.meeting.startsAt)}</p></div><div><p className="text-[11px] font-bold text-slate-400">المشاركون</p><p className="mt-1 text-sm font-bold text-slate-800">{data.participants.length}</p></div><div><p className="text-[11px] font-bold text-slate-400">المحاور المطلوبة المفتوحة</p><p className="mt-1 text-sm font-bold text-slate-800">{data.agenda.filter((item: any) => item.isRequired && !item.isChecked).length}</p></div></div><div className="mt-4 flex flex-wrap gap-2">{data.participants.map((item: any) => <Badge key={item.id} variant="outline" className="rounded-full border-white bg-white px-3 py-1.5 text-[#18596a]"><UsersRound className="ms-1 h-3 w-3" />{item.displayName}</Badge>)}</div></Card>
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-black text-slate-900">التحضير والمحاور</h3><p className="text-xs text-slate-500">الترتيب الميداني أولًا؛ النقاط الداخلية مميزة ولا تدخل المحضر تلقائيًا.</p></div>{!readOnly ? <AddAgendaDialog meetingId={data.meeting.id} onUpdated={refresh} /> : null}</div>
        <Accordion type="multiple" defaultValue={["required"]} className="space-y-3"><AccordionItem value="required" className="rounded-2xl border border-slate-200 bg-white px-4"><AccordionTrigger className="hover:no-underline"><span>المحاور المطلوبة والحرجة ({data.agenda.filter((item: any) => item.isRequired || item.priority === "critical").length})</span></AccordionTrigger><AccordionContent className="space-y-3">{data.agenda.filter((item: any) => item.isRequired || item.priority === "critical").map((item: any) => <AgendaRow key={item.id} item={item} readOnly={readOnly} onUpdated={refresh} />)}</AccordionContent></AccordionItem><AccordionItem value="remaining" className="rounded-2xl border border-slate-200 bg-white px-4"><AccordionTrigger className="hover:no-underline"><span>بقية المحاور ({data.agenda.filter((item: any) => !item.isRequired && item.priority !== "critical").length})</span></AccordionTrigger><AccordionContent className="space-y-3">{data.agenda.filter((item: any) => !item.isRequired && item.priority !== "critical").map((item: any) => <AgendaRow key={item.id} item={item} readOnly={readOnly} onUpdated={refresh} />)}</AccordionContent></AccordionItem></Accordion>
        <section className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-black text-slate-900">مواد الاجتماع والتحليل</h3><p className="text-xs text-slate-500">حفظ المادة لا يحللها. تكليف Manus خطوة منفصلة، والتحليل يبقى مسودة.</p></div>{!readOnly ? <div className="flex flex-wrap gap-2"><ConsentDialog meetingId={data.meeting.id} currentStatus={transcriptionConsent} onUpdated={refresh} /><AddSourceDialog meetingId={data.meeting.id} consentGranted={transcriptionConsent === "granted"} onUpdated={refresh} /></div> : null}</div><div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-6 text-amber-900"><b>حدود الغرفة:</b> لا ميكروفون ولا تسجيل حي ولا تفريغ تلقائي. transcript النصي لا يُقبل قبل الموافقة. التحليل لا ينشئ قرارًا أو إجراءً أو رسالة.</div><div className="grid gap-3 md:grid-cols-2">{data.sources.map((source: any) => <Card key={source.id} className="rounded-2xl border-slate-200 bg-white p-4 shadow-none"><div className="flex items-start justify-between gap-3"><div><Badge variant="outline" className="rounded-full bg-slate-50">{sourceLabels[source.sourceKind as SourceKind]}</Badge><h4 className="mt-2 font-bold text-slate-900">{source.title}</h4><p className="mt-1 text-[10px] font-mono text-slate-400">SHA-256 {source.sourceSha256.slice(0, 12)}…</p></div>{source.visibility === "internal_only" ? <LockKeyhole className="h-4 w-4 text-violet-700" /> : <FileText className="h-4 w-4 text-slate-400" />}</div><p className="mt-3 line-clamp-5 whitespace-pre-wrap rounded-xl bg-[#f8f8f5] p-3 text-[11px] leading-6 text-slate-600">{source.rawText}</p>{source.sourceDocumentId ? <a href={`/api/como-next/documents/${source.sourceDocumentId}`} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">تنزيل الوثيقة المحمية</a> : null}{!readOnly ? <Button size="sm" onClick={() => runAnalysis(Number(source.id))} disabled={analyze.isPending || analysesBySource.has(Number(source.id)) || source.sourceStatus === "archived"} className="mt-4 w-full rounded-xl bg-violet-700 hover:bg-violet-800"><Sparkles className="ms-1 h-4 w-4" />{analysisPendingId === Number(source.id) ? "Manus يحلل..." : analysesBySource.has(Number(source.id)) ? "لها مسودة تحليل" : source.sourceStatus === "archived" ? "أرشيف تاريخي" : "كلف Manus بالتحليل"}</Button> : null}</Card>)}</div></section>
        {data.analyses.length ? <section className="space-y-3"><div className="flex items-center gap-2"><Bot className="h-5 w-5 text-violet-700" /><div><h3 className="font-black text-slate-900">مسودات تحليل Manus</h3><p className="text-xs text-slate-500">الدليل ظاهر، والتطبيق يتم بندًا بندًا بعد مراجعتك.</p></div></div>{data.analyses.map((analysis: any) => <Card key={analysis.id} className="rounded-3xl border-violet-100 bg-[#fbfaff] p-5 shadow-none"><div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><Badge variant="outline" className="rounded-full border-violet-200 bg-white text-violet-800">{analysis.analysisType === "preparation" ? "تحضير" : "استخراج من الدليل"}</Badge><p className="mt-3 text-sm font-semibold leading-7 text-slate-800">{analysis.summary}</p>{analysis.openQuestions?.length ? <ul className="mt-3 list-disc space-y-1 pr-5 text-xs leading-6 text-slate-600">{analysis.openQuestions.map((question: string, index: number) => <li key={index}>{question}</li>)}</ul> : null}</div><Badge variant="outline" className="rounded-full bg-white">{analysis.analysisStatus === "draft" ? "بانتظار المراجعة" : "مراجع"}</Badge></div><div className="space-y-3">{data.proposals.filter((proposal: any) => Number(proposal.analysisId) === Number(analysis.id)).map((proposal: any) => <ProposalCard key={proposal.id} proposal={proposal} onUpdated={refresh} />)}</div></Card>)}</section> : null}
        <MinutesPanel meetingId={data.meeting.id} minutes={data.minutes} meetingStatus={data.meeting.meetingStatus} meetingOutcomeSummary={data.meeting.outcomeSummary} onUpdated={refresh} />
        <Card className="rounded-2xl border-emerald-100 bg-emerald-50/70 p-4 text-xs leading-6 text-emerald-900"><div className="flex items-start gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /><p><b>حواجز ثابتة:</b> لا نتيجة تعتمد آليًا، لا نقطة داخلية تخرج إلى مسودة خارجية، لا تسجيل أو تفريغ دون موافقة، ولا إرسال خارجي من غرفة الاجتماع.</p></div></Card>
      </> : null}</div></ScrollArea>
    </DialogContent>
  </Dialog>;
}

export function WorkFileMeetingsSection({ workFileId, meetings, isClosed, onUpdated }: { workFileId: number; meetings: any[]; isClosed: boolean; onUpdated: () => void }) {
  const [selected, setSelected] = useState<any | null>(null);
  return <section><div className="mb-3 flex items-center justify-between gap-3"><div className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-[#1e6478]" /><div><h3 className="text-base font-black text-slate-900">غرفة الاجتماعات</h3><p className="text-xs text-slate-500">تحضير ومحاور ومادة أولية وتحليل مراجع ومحضر داخل ملف العمل.</p></div></div>{!isClosed ? <NewMeetingDialog workFileId={workFileId} onCreated={() => onUpdated()} /> : null}</div><div className="space-y-3">{meetings.length === 0 ? <Card className="rounded-2xl border-dashed border-slate-300 bg-white p-6 text-center shadow-none"><CalendarDays className="mx-auto h-6 w-6 text-slate-300" /><p className="mt-2 text-sm font-bold text-slate-700">لا يوجد اجتماع بعد</p><p className="mt-1 text-xs text-slate-500">افتح غرفة عندما يحتاج الملف تحضيرًا أو نقاشًا موثقًا.</p></Card> : meetings.map(meeting => <button key={meeting.id} onClick={() => setSelected(meeting)} className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-right shadow-sm transition hover:border-[#9fc8c0] hover:shadow-md"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h4 className="font-bold leading-6 text-slate-900">{meeting.title}</h4><p className="mt-1 text-xs text-slate-500">{meeting.partyName || "اجتماع داخلي"} · <bdi dir="ltr">{formatDateTime(meeting.startsAt)}</bdi></p></div><Badge variant="outline" className={`rounded-full ${meeting.meetingStatus === "completed" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>{meeting.meetingStatus === "completed" ? "مغلق بمحضر" : "قيد التحضير"}</Badge></div>{meeting.outcomeSummary ? <p className="mt-3 line-clamp-3 text-xs leading-6 text-slate-600">{meeting.outcomeSummary}</p> : meeting.objective ? <p className="mt-3 line-clamp-3 text-xs leading-6 text-slate-600">{meeting.objective}</p> : null}<div className="mt-3 flex flex-wrap gap-3 border-t border-slate-100 pt-3 text-[11px] font-bold text-slate-500"><span>{meeting.participantCount} مشارك</span><span>{meeting.agendaItemCount} محور</span>{meeting.unresolvedRequiredCount ? <span className="text-rose-700">{meeting.unresolvedRequiredCount} مطلوب مفتوح</span> : null}{meeting.pendingProposalCount ? <span className="text-violet-700">{meeting.pendingProposalCount} مقترح للمراجعة</span> : null}{meeting.latestMinutesStatus === "draft" ? <span className="text-amber-700">مسودة محضر</span> : null}</div></button>)}</div>{selected ? <MeetingWorkspaceDialog meeting={selected} open={Boolean(selected)} onOpenChange={value => !value && setSelected(null)} onUpdated={onUpdated} /> : null}</section>;
}
