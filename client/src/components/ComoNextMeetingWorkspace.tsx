import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
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
import {
  Bot,
  CalendarDays,
  CheckCheck,
  ChevronLeft,
  ClipboardCheck,
  FileAudio,
  FileText,
  ListChecks,
  LockKeyhole,
  Mic,
  Plus,
  Radio,
  ShieldCheck,
  Sparkles,
  Square,
  Upload,
  UsersRound,
  Video,
} from "lucide-react";

type SourceKind = "preparation" | "notes" | "transcript";
type ProposalTarget = "agenda_item" | "decision" | "action" | "external_commitment" | "risk" | "note" | "communication_draft";
type MeetingStage = "before" | "during" | "after";

const sourceLabels: Record<SourceKind, string> = {
  preparation: "مادة تحضير",
  notes: "ملاحظات الاجتماع",
  transcript: "تفريغ الاجتماع",
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

const stageMeta: Record<MeetingStage, { title: string; subtitle: string }> = {
  before: { title: "قبل الاجتماع", subtitle: "ما الذي سنقوله ونحسمه؟" },
  during: { title: "أثناء الاجتماع", subtitle: "سجّل وتابع المحاور مباشرة" },
  after: { title: "بعد الاجتماع", subtitle: "تفريغ، تحليل، محضر ومتابعات" },
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

function formatDuration(seconds?: number | null) {
  if (!seconds) return "مدة غير محددة";
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

function formatBytes(bytes?: number | null) {
  if (!bytes) return "";
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function meetingSourcePreview(rawText: string) {
  const [summary] = rawText.split(/\s---\sلقطة المصدر التاريخية:/);
  return summary.trim() || "مرجع تاريخي محفوظ في سجل الاجتماع.";
}

function hasHistoricalSnapshot(rawText: string) {
  return rawText.includes("لقطة المصدر التاريخية:");
}

function defaultStage(meeting: any): MeetingStage {
  if (meeting.meetingStatus === "completed" || meeting.meetingStatus === "cancelled") return "after";
  const start = normalizeUtc(meeting.startsAt);
  const end = normalizeUtc(meeting.endsAt);
  const now = Date.now();
  if (start && new Date(start).getTime() <= now + 30 * 60 * 1000 && (!end || new Date(end).getTime() >= now - 60 * 60 * 1000)) return "during";
  return "before";
}

async function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
    reader.readAsDataURL(blob);
  });
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
      toast.success("أُنشئت غرفة الاجتماع داخل ملف الموضوع");
      setOpen(false);
      onCreated(result.id);
    } catch (error: any) { toast.error(error?.message || "تعذر إنشاء الاجتماع"); }
  };

  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button size="sm" variant="outline" className="rounded-xl border-[#bdd8d2] bg-white text-[#18596a]"><Plus className="ms-1.5 h-4 w-4" />اجتماع جديد</Button></DialogTrigger>
    <DialogContent dir="rtl" className="max-w-2xl rounded-3xl bg-[#fdfcf9]">
      <DialogHeader className="text-right"><DialogTitle>فتح غرفة اجتماع</DialogTitle><DialogDescription>حدّد الاجتماع مرة واحدة؛ بعدها تنتقل بين التحضير والتسجيل والنتيجة من الغرفة نفسها.</DialogDescription></DialogHeader>
      <div className="grid gap-4">
        <div className="grid gap-2"><Label>عنوان الاجتماع</Label><Input value={title} onChange={event => setTitle(event.target.value)} className="h-11 rounded-xl bg-white" /></div>
        <div className="grid gap-2"><Label>ما النتيجة المطلوبة من الاجتماع؟</Label><Textarea value={objective} onChange={event => setObjective(event.target.value)} className="min-h-24 rounded-xl bg-white" /></div>
        <div className="grid gap-4 sm:grid-cols-2"><div className="grid gap-2"><Label>الصيغة</Label><Select value={format} onValueChange={setFormat}><SelectTrigger className="h-11 rounded-xl bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="in_person">حضوري</SelectItem><SelectItem value="zoom">Zoom</SelectItem><SelectItem value="online">اجتماع مرئي آخر</SelectItem><SelectItem value="phone_call">اتصال هاتفي</SelectItem><SelectItem value="internal">داخلي</SelectItem></SelectContent></Select></div><div className="grid gap-2"><Label>المكان أو رابط الاجتماع</Label><Input value={location} onChange={event => setLocation(event.target.value)} className="h-11 rounded-xl bg-white" /></div></div>
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
  const [desiredOutcome, setDesiredOutcome] = useState("");
  const [audience, setAudience] = useState<"discuss" | "internal_only" | "reference">("discuss");
  const [priority, setPriority] = useState<"critical" | "high" | "normal">("normal");
  const [required, setRequired] = useState(false);
  const mutation = trpc.comoNext.addMeetingAgendaItem.useMutation();
  const submit = async () => {
    if (!prompt.trim()) return toast.error("اكتب محور الاجتماع");
    try {
      await mutation.mutateAsync({ meetingId, itemKind: "question", category: category.trim() || undefined, promptAr: prompt.trim(), briefingNote: briefing.trim() || undefined, desiredOutcome: desiredOutcome.trim() || undefined, audience, priority, isRequired: required });
      toast.success("أُضيف المحور إلى مسار الاجتماع");
      setOpen(false); setPrompt(""); setCategory(""); setBriefing(""); setDesiredOutcome(""); onUpdated();
    } catch (error: any) { toast.error(error?.message || "تعذر إضافة المحور"); }
  };
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button size="sm" variant="outline" className="rounded-xl bg-white"><Plus className="ms-1 h-4 w-4" />محور</Button></DialogTrigger>
    <DialogContent dir="rtl" className="max-w-xl rounded-3xl bg-[#fdfcf9]"><DialogHeader className="text-right"><DialogTitle>إضافة محور</DialogTitle><DialogDescription>اكتب ما ستطرحه والنتيجة التي تريد الوصول إليها؛ النقطة الداخلية لا تظهر في المحضر.</DialogDescription></DialogHeader><div className="grid gap-4"><div className="grid gap-2"><Label>الفئة</Label><Input value={category} onChange={event => setCategory(event.target.value)} className="rounded-xl bg-white" /></div><div className="grid gap-2"><Label>المحور أو السؤال</Label><Textarea value={prompt} onChange={event => setPrompt(event.target.value)} className="min-h-24 rounded-xl bg-white" /></div><div className="grid gap-2"><Label>إحاطة سريعة لك</Label><Textarea value={briefing} onChange={event => setBriefing(event.target.value)} className="min-h-20 rounded-xl bg-white" /></div><div className="grid gap-2"><Label>النتيجة المطلوبة</Label><Input value={desiredOutcome} onChange={event => setDesiredOutcome(event.target.value)} className="rounded-xl bg-white" /></div><div className="grid gap-4 sm:grid-cols-2"><Select value={audience} onValueChange={value => setAudience(value as typeof audience)}><SelectTrigger className="rounded-xl bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="discuss">للنقاش</SelectItem><SelectItem value="internal_only">داخلي فقط</SelectItem><SelectItem value="reference">مرجع</SelectItem></SelectContent></Select><Select value={priority} onValueChange={value => setPriority(value as typeof priority)}><SelectTrigger className="rounded-xl bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="critical">حرج</SelectItem><SelectItem value="high">مهم</SelectItem><SelectItem value="normal">عادي</SelectItem></SelectContent></Select></div><label className="flex items-center gap-2 text-sm font-semibold"><Checkbox checked={required} onCheckedChange={value => setRequired(Boolean(value))} />لا ينتهي الاجتماع دون معالجة هذا المحور</label></div><DialogFooter className="sm:justify-start"><Button onClick={submit} disabled={mutation.isPending} className="rounded-xl bg-[#16243b]">حفظ المحور</Button></DialogFooter></DialogContent>
  </Dialog>;
}

function ConsentDialog({ meetingId, recordingStatus, transcriptionStatus, onUpdated }: { meetingId: number; recordingStatus?: string; transcriptionStatus?: string; onUpdated: () => void }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"granted" | "declined">("granted");
  const [basis, setBasis] = useState("");
  const [evidence, setEvidence] = useState("");
  const mutation = trpc.comoNext.recordMeetingConsent.useMutation();
  const ready = recordingStatus === "granted" && transcriptionStatus === "granted";
  const submit = async () => {
    try {
      await mutation.mutateAsync({ meetingId, consentScope: "recording", consentStatus: status, consentBasis: basis.trim() || undefined, evidenceReference: evidence.trim() || undefined });
      await mutation.mutateAsync({ meetingId, consentScope: "transcription", consentStatus: status, consentBasis: basis.trim() || undefined, evidenceReference: evidence.trim() || undefined });
      toast.success(status === "granted" ? "ثُبتت موافقة التسجيل والتفريغ" : "سُجل رفض التسجيل والتفريغ");
      setOpen(false); onUpdated();
    } catch (error: any) { toast.error(error?.message || "تعذر تسجيل الموافقة"); }
  };
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button size="sm" variant="outline" className={`rounded-xl ${ready ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}><ShieldCheck className="ms-1 h-4 w-4" />{ready ? "الموافقة مثبتة" : "تثبيت الموافقة"}</Button></DialogTrigger>
    <DialogContent dir="rtl" className="max-w-xl rounded-3xl bg-[#fdfcf9]"><DialogHeader className="text-right"><DialogTitle>موافقة التسجيل والتفريغ</DialogTitle><DialogDescription>لا يبدأ الميكروفون قبل هذه الخطوة. سجّل كيف أُبلغ المشاركون ووافقوا.</DialogDescription></DialogHeader><div className="grid gap-4"><Select value={status} onValueChange={value => setStatus(value as typeof status)}><SelectTrigger className="rounded-xl bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="granted">موافقة صريحة</SelectItem><SelectItem value="declined">مرفوض</SelectItem></SelectContent></Select><div className="grid gap-2"><Label>أساس الموافقة</Label><Textarea value={basis} onChange={event => setBasis(event.target.value)} className="min-h-20 rounded-xl bg-white" placeholder="أُبلغ جميع الحاضرين ووافقوا..." /></div><div className="grid gap-2"><Label>مرجع الدليل</Label><Input value={evidence} onChange={event => setEvidence(event.target.value)} className="rounded-xl bg-white" placeholder="بداية التسجيل، الدعوة، أو موافقة Zoom" /></div></div><DialogFooter className="sm:justify-start"><Button onClick={submit} disabled={mutation.isPending} className="rounded-xl bg-[#16243b]">حفظ الحالة</Button></DialogFooter></DialogContent>
  </Dialog>;
}

function AddSourceDialog({ meetingId, consentGranted, onUpdated, defaultKind = "notes", label = "إضافة مادة" }: { meetingId: number; consentGranted: boolean; onUpdated: () => void; defaultKind?: SourceKind; label?: string }) {
  const [open, setOpen] = useState(false);
  const [sourceKind, setSourceKind] = useState<SourceKind>(defaultKind);
  const [visibility, setVisibility] = useState<"meeting_record" | "internal_only">("meeting_record");
  const [title, setTitle] = useState("");
  const [rawText, setRawText] = useState("");
  const mutation = trpc.comoNext.addMeetingSource.useMutation();
  useEffect(() => { if (open) setSourceKind(defaultKind); }, [open, defaultKind]);
  const submit = async () => {
    if (!title.trim() || rawText.trim().length < 10) return toast.error("أدخل عنوانًا ونصًا كافيًا");
    try {
      await mutation.mutateAsync({ meetingId, sourceKind, visibility, title: title.trim(), rawText: rawText.trim(), idempotencyKey: crypto.randomUUID() });
      toast.success("حُفظت المادة دون نتيجة تلقائية"); setOpen(false); setTitle(""); setRawText(""); onUpdated();
    } catch (error: any) { toast.error(error?.message || "تعذر حفظ المادة"); }
  };
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button size="sm" variant="outline" className="rounded-xl bg-white"><FileText className="ms-1 h-4 w-4" />{label}</Button></DialogTrigger>
    <DialogContent dir="rtl" className="max-w-2xl rounded-3xl bg-[#fdfcf9]"><DialogHeader className="text-right"><DialogTitle>{label}</DialogTitle><DialogDescription>الحفظ مستقل عن تحليل Manus؛ أنت تقرر متى تحلل المادة.</DialogDescription></DialogHeader><div className="grid gap-4"><div className="grid gap-4 sm:grid-cols-2"><Select value={sourceKind} onValueChange={value => setSourceKind(value as SourceKind)}><SelectTrigger className="rounded-xl bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="preparation">مادة تحضير</SelectItem><SelectItem value="notes">ملاحظات مكتوبة</SelectItem><SelectItem value="transcript" disabled={!consentGranted}>تفريغ نصي — يحتاج موافقة</SelectItem></SelectContent></Select><Select value={visibility} onValueChange={value => setVisibility(value as typeof visibility)}><SelectTrigger className="rounded-xl bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="meeting_record">سجل الاجتماع</SelectItem><SelectItem value="internal_only">داخلي فقط</SelectItem></SelectContent></Select></div><div className="grid gap-2"><Label>العنوان</Label><Input value={title} onChange={event => setTitle(event.target.value)} className="rounded-xl bg-white" /></div><div className="grid gap-2"><Label>النص</Label><Textarea value={rawText} onChange={event => setRawText(event.target.value)} className="min-h-64 rounded-xl bg-white" /></div></div><DialogFooter className="sm:justify-start"><Button onClick={submit} disabled={mutation.isPending || (sourceKind === "transcript" && !consentGranted)} className="rounded-xl bg-[#16243b]">حفظ المادة</Button></DialogFooter></DialogContent>
  </Dialog>;
}

function AgendaRow({ item, readOnly, onUpdated }: { item: any; readOnly: boolean; onUpdated: () => void }) {
  const [response, setResponse] = useState(item.response || "");
  const mutation = trpc.comoNext.updateMeetingAgendaItem.useMutation();
  useEffect(() => setResponse(item.response || ""), [item.response]);
  const save = async (checked: boolean) => {
    try { await mutation.mutateAsync({ agendaItemId: Number(item.id), response: response.trim() || undefined, isChecked: checked }); toast.success("حُفظت نتيجة المحور"); onUpdated(); }
    catch (error: any) { toast.error(error?.message || "تعذر حفظ المحور"); }
  };
  return <div className={`rounded-2xl border p-4 ${item.audience === "internal_only" ? "border-violet-200 bg-violet-50/70" : item.isRequired ? "border-amber-200 bg-amber-50/40" : "border-slate-200 bg-white"}`}><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><div className="mb-2 flex flex-wrap gap-2"><Badge variant="outline" className="rounded-full bg-white">{item.category || "محور"}</Badge>{item.isRequired ? <Badge variant="outline" className="rounded-full border-rose-200 bg-rose-50 text-rose-700">مطلوب</Badge> : null}{item.priority === "critical" ? <Badge variant="outline" className="rounded-full border-rose-200 bg-rose-50 text-rose-700">حرج</Badge> : null}{item.audience === "internal_only" ? <Badge variant="outline" className="rounded-full border-violet-200 bg-violet-100 text-violet-800"><LockKeyhole className="ms-1 h-3 w-3" />داخلي فقط</Badge> : null}</div><p className="text-sm font-bold leading-7 text-slate-900">{item.promptAr || item.promptEn}</p>{item.briefingNote ? <p className="mt-2 text-xs leading-6 text-slate-600">{item.briefingNote}</p> : null}{item.desiredOutcome ? <p className="mt-2 rounded-xl bg-white/80 px-3 py-2 text-xs font-semibold text-[#18596a]">النتيجة المطلوبة: {item.desiredOutcome}</p> : null}{item.sourceEvidence ? <p className="mt-2 text-[11px] leading-5 text-slate-500">الدليل: {item.sourceEvidence}</p> : null}</div>{item.isChecked ? <CheckCheck className="h-5 w-5 text-emerald-700" /> : null}</div>{!readOnly ? <div className="mt-3 grid gap-2"><Textarea value={response} onChange={event => setResponse(event.target.value)} className="min-h-20 rounded-xl bg-white" placeholder="النتيجة أو الإجابة كما قيلت..." /><div className="flex flex-wrap justify-end gap-2"><Button size="sm" variant="outline" onClick={() => save(false)} disabled={mutation.isPending} className="rounded-xl bg-white">حفظ دون إغلاق</Button><Button size="sm" onClick={() => save(true)} disabled={mutation.isPending} className="rounded-xl bg-emerald-700 hover:bg-emerald-800">تمت المعالجة</Button></div></div> : item.response ? <p className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs leading-6 text-emerald-900">{item.response}</p> : null}</div>;
}

function MeetingAgendaNavigator({ meetingId, items, readOnly, onUpdated }: { meetingId: number; items: any[]; readOnly: boolean; onUpdated: () => void }) {
  const firstOpenIndex = Math.max(0, items.findIndex(item => !item.isChecked));
  const [cursor, setCursor] = useState(firstOpenIndex);
  const safeCursor = Math.min(cursor, Math.max(items.length - 1, 0));
  const currentItem = items[safeCursor];
  const completed = items.filter(item => item.isChecked).length;

  useEffect(() => {
    if (!items.length) return;
    setCursor(previous => Math.min(previous, items.length - 1));
  }, [items.length, meetingId]);

  if (!currentItem) return <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">لا توجد محاور؛ يمكنك حفظ ملاحظات سريعة أو بدء التسجيل مباشرة.</p>;

  return <div className="space-y-3">
    <Card className="rounded-3xl border-[#d7e6e2] bg-[linear-gradient(135deg,#f4fbf9,#fffaf2)] p-4 shadow-none"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#1e6478]">النقطة {safeCursor + 1} من {items.length}</p><p className="mt-1 text-sm font-bold text-slate-800">أنجزت {completed} · بقي {items.length - completed}</p><p className="mt-1 text-[11px] text-slate-500">نقطة واحدة في كل مرة؛ احفظ النتيجة لتنتقل إلى التالية.</p></div><div className="flex items-center gap-2"><Button type="button" size="sm" variant="outline" disabled={safeCursor === 0} onClick={() => setCursor(value => Math.max(0, value - 1))} className="rounded-xl bg-white">السابق</Button><Button type="button" size="sm" variant="outline" disabled={safeCursor === items.length - 1} onClick={() => setCursor(value => Math.min(items.length - 1, value + 1))} className="rounded-xl bg-white">التالي</Button></div></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-[#2a7c77] transition-[width] duration-200" style={{ width: `${Math.round((completed / Math.max(items.length, 1)) * 100)}%` }} /></div></Card>
    <AgendaRow item={currentItem} readOnly={readOnly} onUpdated={() => { onUpdated(); if (!readOnly && safeCursor < items.length - 1) setCursor(safeCursor + 1); }} />
  </div>;
}

function MeetingCapturePanel({ meetingId, consentReady, recordings, readOnly, onUpdated }: { meetingId: number; consentReady: boolean; recordings: any[]; readOnly: boolean; onUpdated: () => void }) {
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [busyLabel, setBusyLabel] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const uploadRecording = trpc.comoNext.uploadMeetingRecording.useMutation();
  const importTranscript = trpc.comoNext.importMeetingTranscript.useMutation();

  const stopTimer = () => { if (timerRef.current) window.clearInterval(timerRef.current); timerRef.current = null; };
  const stopTracks = () => { streamRef.current?.getTracks().forEach(track => track.stop()); streamRef.current = null; };
  useEffect(() => () => { stopTimer(); stopTracks(); }, []);

  const sendRecording = async (blob: Blob, kind: "browser_recording" | "zoom_recording", name: string, durationSeconds?: number) => {
    if (blob.size > 16 * 1024 * 1024) return toast.error("التسجيل أكبر من 16MB. صدّر تفريغ Zoom بصيغة VTT أو TXT وارفعه بدل الفيديو الطويل.");
    setBusyLabel("يُحفظ التسجيل ويُفرّغ الآن...");
    try {
      const audioBase64 = await blobToBase64(blob);
      await uploadRecording.mutateAsync({ meetingId, recordingKind: kind, fileName: name, mimeType: blob.type || "audio/webm", audioBase64, durationSeconds, idempotencyKey: crypto.randomUUID() });
      toast.success("اكتمل حفظ التسجيل والتفريغ. أصبح جاهزًا لتحليل Manus.");
      onUpdated();
    } catch (error: any) { toast.error(error?.message || "تعذر حفظ التسجيل أو تفريغه"); }
    finally { setBusyLabel(null); }
  };

  const startRecording = async () => {
    if (!consentReady) return toast.error("ثبّت موافقة التسجيل والتفريغ أولًا");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") return toast.error("هذا المتصفح لا يدعم التسجيل المباشر");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      const preferred = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find(type => MediaRecorder.isTypeSupported(type));
      const recorder = preferred ? new MediaRecorder(stream, { mimeType: preferred, audioBitsPerSecond: 32000 }) : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = event => { if (event.data.size) chunksRef.current.push(event.data); };
      recorder.onerror = () => toast.error("تعذر استمرار التسجيل");
      recorder.onstop = async () => {
        const duration = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        chunksRef.current = [];
        stopTracks();
        await sendRecording(blob, "browser_recording", `meeting-${meetingId}-${new Date().toISOString().replace(/[:.]/g, "-")}.${recorder.mimeType.includes("mp4") ? "m4a" : "webm"}`, duration);
      };
      mediaRecorderRef.current = recorder;
      streamRef.current = stream;
      startedAtRef.current = Date.now();
      setElapsed(0);
      recorder.start(1000);
      timerRef.current = window.setInterval(() => setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000)), 1000);
      setIsRecording(true);
      toast.success("بدأ التسجيل من هذا الجهاز");
    } catch { toast.error("لم يسمح المتصفح باستخدام الميكروفون"); }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
    stopTimer();
    setIsRecording(false);
  };

  const uploadZoomFile = async (file?: File) => {
    if (!file) return;
    if (!consentReady) return toast.error("ثبّت موافقة التسجيل والتفريغ أولًا");
    const extension = file.name.toLowerCase().split(".").pop();
    if (["txt", "vtt", "srt"].includes(extension || "")) {
      if (file.size > 4 * 1024 * 1024) return toast.error("ملف التفريغ أكبر من 4MB");
      setBusyLabel("يُستورد تفريغ Zoom...");
      try {
        const rawText = await file.text();
        const mimeType = extension === "vtt" ? "text/vtt" : extension === "srt" ? "application/x-subrip" : "text/plain";
        await importTranscript.mutateAsync({ meetingId, fileName: file.name, mimeType, rawText, idempotencyKey: crypto.randomUUID() });
        toast.success("دخل تفريغ Zoom إلى سجل الاجتماع وأصبح جاهزًا للتحليل");
        onUpdated();
      } catch (error: any) { toast.error(error?.message || "تعذر استيراد تفريغ Zoom"); }
      finally { setBusyLabel(null); }
      return;
    }
    await sendRecording(file, "zoom_recording", file.name);
  };

  return <div className="space-y-4">
    {!consentReady ? <Card className="rounded-2xl border-amber-200 bg-amber-50 p-4 shadow-none"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 text-amber-700" /><div><h4 className="font-black text-amber-950">التسجيل مقفل حتى تثبيت الموافقة</h4><p className="mt-1 text-xs leading-6 text-amber-900">أبلغ المشاركين أولًا، ثم سجّل الموافقة من الزر أعلى هذه المرحلة. بعدها يظهر التسجيل والرفع كأدوات عمل عادية.</p></div></div></Card> : null}
    <div className="grid gap-4 md:grid-cols-2">
      <Card className={`rounded-3xl p-5 shadow-none ${isRecording ? "border-rose-300 bg-rose-50" : "border-[#cfe3df] bg-white"}`}><div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><Mic className={`h-5 w-5 ${isRecording ? "text-rose-600" : "text-[#1e6478]"}`} /><h4 className="font-black text-slate-900">تسجيل الاجتماع من هذا الجهاز</h4></div><p className="mt-2 text-xs leading-6 text-slate-600">افتح الاجتماع واضغط بدء. عند الإيقاف يُحفظ الصوت ويُفرّغ تلقائيًا، ولا يبدأ التحليل قبل أن تطلبه.</p></div>{isRecording ? <Badge className="animate-pulse rounded-full bg-rose-600">{formatDuration(elapsed)}</Badge> : null}</div><Button onClick={isRecording ? stopRecording : startRecording} disabled={readOnly || !consentReady || Boolean(busyLabel)} className={`mt-5 w-full rounded-2xl ${isRecording ? "bg-rose-600 hover:bg-rose-700" : "bg-[#16243b] hover:bg-[#203554]"}`}>{isRecording ? <><Square className="ms-2 h-4 w-4 fill-current" />إيقاف وحفظ التسجيل</> : <><Radio className="ms-2 h-4 w-4" />بدء التسجيل</>}</Button></Card>
      <Card className="rounded-3xl border-[#d9d2f0] bg-[#faf8ff] p-5 shadow-none"><div className="flex flex-wrap items-center gap-2"><Video className="h-5 w-5 text-violet-700" /><h4 className="font-black text-slate-900">اجتماع Zoom</h4><Badge variant="outline" className="rounded-full border-violet-200 bg-white text-violet-700">استيراد يدوي الآن</Badge></div><p className="mt-2 text-xs leading-6 text-slate-600">بعد الاجتماع ارفع ملف الصوت القصير، أو الأفضل للاجتماع الطويل: ملف التفريغ VTT/TXT الذي يصدره Zoom. يدخل إلى المسار نفسه. الربط التلقائي مع حساب Zoom غير مفعّل بعد.</p><label className={`mt-5 flex min-h-11 cursor-pointer items-center justify-center rounded-2xl border border-violet-200 bg-white px-4 text-sm font-bold text-violet-800 transition hover:bg-violet-50 ${readOnly || !consentReady || busyLabel ? "pointer-events-none opacity-50" : ""}`}><Upload className="ms-2 h-4 w-4" />رفع تسجيل أو تفريغ Zoom<input type="file" className="hidden" accept="audio/webm,audio/mpeg,audio/wav,audio/ogg,audio/mp4,video/mp4,.txt,.vtt,.srt" onChange={event => { const file = event.target.files?.[0]; void uploadZoomFile(file); event.currentTarget.value = ""; }} /></label></Card>
    </div>
    {busyLabel ? <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm font-bold text-sky-800">{busyLabel} لا تغلق الغرفة حتى تظهر النتيجة.</div> : null}
    {recordings.length ? <div className="grid gap-3 md:grid-cols-2">{recordings.map(recording => <Card key={recording.id} className="rounded-2xl border-slate-200 bg-white p-4 shadow-none"><div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><FileAudio className="h-4 w-4 text-[#1e6478]" /><h5 className="font-bold text-slate-900">{recording.originalFileName}</h5></div><p className="mt-2 text-xs text-slate-500">{recording.recordingKind === "zoom_recording" ? "Zoom" : "تسجيل مباشر"} · {formatDuration(recording.durationSeconds)} · {formatBytes(Number(recording.byteSize))}</p></div><Badge variant="outline" className={`rounded-full ${recording.recordingStatus === "transcribed" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : recording.recordingStatus === "failed" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-amber-200 bg-amber-50 text-amber-800"}`}>{recording.recordingStatus === "transcribed" ? "مفرغ" : recording.recordingStatus === "failed" ? "تعذر التفريغ" : "قيد التفريغ"}</Badge></div><a href={`/api/como-next/documents/${recording.documentId}`} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">تنزيل التسجيل المحمي</a></Card>)}</div> : null}
  </div>;
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
  const autoApplied = String(proposal.reviewNote || "").startsWith("AUTO_MANUS:");
  return <Card className={`rounded-2xl p-4 shadow-none ${proposal.audience === "internal_only" ? "border-violet-200 bg-violet-50/70" : "border-slate-200 bg-white"}`}><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><div className="mb-2 flex flex-wrap gap-2"><Badge variant="outline" className="rounded-full bg-white">{proposalLabels[proposal.proposalKind] || proposal.proposalKind}</Badge>{proposal.audience === "internal_only" ? <Badge variant="outline" className="rounded-full border-violet-200 bg-violet-100 text-violet-800">داخلي فقط</Badge> : null}<Badge variant="outline" className={`rounded-full ${proposal.reviewStatus === "pending" ? "border-amber-200 bg-amber-50 text-amber-800" : proposal.reviewStatus === "applied" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>{proposal.reviewStatus === "pending" ? "قرارك مطلوب" : proposal.reviewStatus === "applied" ? autoApplied ? "تابعه Manus تلقائيًا" : "طُبق بعد المراجعة" : "مستبعد"}</Badge></div><h4 className="font-black leading-6 text-slate-900">{proposal.title}</h4>{proposal.content ? <p className="mt-2 text-xs leading-6 text-slate-600">{proposal.content}</p> : null}<blockquote className="mt-3 border-r-2 border-[#7fb9ad] pr-3 text-[11px] leading-6 text-slate-500">«{proposal.evidenceExcerpt}»</blockquote></div></div>{proposal.reviewStatus === "pending" ? <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4"><div className="grid gap-3 sm:grid-cols-[1fr_1.2fr]"><Select value={target} onValueChange={value => setTarget(value as ProposalTarget)}><SelectTrigger className="rounded-xl bg-white"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(targetLabels).map(([value, label]) => <SelectItem key={value} value={value} disabled={proposal.audience === "internal_only" && value === "communication_draft"}>{label}</SelectItem>)}</SelectContent></Select><Input value={note} onChange={event => setNote(event.target.value)} className="rounded-xl bg-white" placeholder="ملاحظة المراجعة — اختياري" /></div><div className="flex flex-wrap justify-end gap-2"><Button size="sm" variant="outline" onClick={() => decide("dismiss")} disabled={mutation.isPending} className="rounded-xl bg-white">استبعاد</Button><Button size="sm" onClick={() => decide("apply")} disabled={mutation.isPending} className="rounded-xl bg-emerald-700 hover:bg-emerald-800">تطبيق القرار</Button></div></div> : null}</Card>;
}

function MinutesPanel({ meetingId, minutes, meetingStatus, meetingOutcomeSummary, onUpdated }: { meetingId: number; minutes: any[]; meetingStatus: string; meetingOutcomeSummary?: string | null; onUpdated: () => void }) {
  const [summary, setSummary] = useState("");
  const [note, setNote] = useState("");
  const prepare = trpc.comoNext.prepareMeetingMinutes.useMutation();
  const review = trpc.comoNext.reviewMeetingMinutes.useMutation();
  const latest = minutes[0];
  const createDraft = async () => { try { await prepare.mutateAsync({ meetingId, summary: summary.trim() }); toast.success("أُعدت مسودة محضر للمراجعة"); setSummary(""); onUpdated(); } catch (error: any) { toast.error(error?.message || "تعذر إعداد المحضر"); } };
  const reviewDraft = async (decision: "approve" | "reject") => { try { await review.mutateAsync({ minutesId: Number(latest.id), decision, reviewNote: note.trim() || undefined }); toast.success(decision === "approve" ? "اعتمد المحضر وأُغلق الاجتماع" : "رُفضت المسودة"); onUpdated(); } catch (error: any) { toast.error(error?.message || "تعذر مراجعة المحضر"); } };
  return <div className="space-y-3"><div className="flex items-center gap-2"><ClipboardCheck className="h-5 w-5 text-emerald-700" /><div><h3 className="font-black text-slate-900">المحضر والإغلاق</h3><p className="text-xs text-slate-500">يطبق Manus النتائج الداخلية الآمنة؛ تراجع أنت فقط القرار أو الالتزام الخارجي قبل اعتماد المحضر، ولا يُرسل شيء تلقائيًا.</p></div></div>{latest ? <Card className="rounded-2xl border-emerald-100 bg-white p-4 shadow-none"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><Badge variant="outline" className={`rounded-full ${latest.minutesStatus === "approved" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : latest.minutesStatus === "draft" ? "border-amber-200 bg-amber-50 text-amber-800" : "bg-slate-100"}`}>{latest.minutesStatus === "approved" ? "محضر معتمد" : latest.minutesStatus === "draft" ? "مسودة للمراجعة" : "نسخة سابقة"}</Badge><span className="text-[11px] text-slate-400">الإصدار {latest.version}</span></div><ScrollArea className="h-72 rounded-xl border border-slate-100 bg-[#fbfbf8] p-4"><pre dir="rtl" className="whitespace-pre-wrap font-sans text-xs leading-7 text-slate-700">{latest.content}</pre></ScrollArea>{latest.minutesStatus === "draft" ? <div className="mt-3 grid gap-3"><Input value={note} onChange={event => setNote(event.target.value)} className="rounded-xl" placeholder="ملاحظة المراجعة — اختياري" /><div className="flex justify-end gap-2"><Button size="sm" variant="outline" onClick={() => reviewDraft("reject")} className="rounded-xl bg-white">رفض المسودة</Button><Button size="sm" onClick={() => reviewDraft("approve")} className="rounded-xl bg-emerald-700 hover:bg-emerald-800">اعتماد وإغلاق الاجتماع</Button></div></div> : null}</Card> : meetingStatus === "completed" && meetingOutcomeSummary ? <Card className="rounded-2xl border-emerald-100 bg-white p-4 shadow-none"><Badge variant="outline" className="mb-3 rounded-full border-emerald-200 bg-emerald-50 text-emerald-800">محضر معتمد تاريخيًا</Badge><ScrollArea className="h-72 rounded-xl border border-slate-100 bg-[#fbfbf8] p-4"><pre dir="rtl" className="whitespace-pre-wrap font-sans text-xs leading-7 text-slate-700">{meetingOutcomeSummary}</pre></ScrollArea></Card> : meetingStatus !== "completed" ? <Card className="rounded-2xl border-slate-200 bg-white p-4 shadow-none"><Label>الخلاصة التنفيذية التي سيُبنى عليها المحضر</Label><Textarea value={summary} onChange={event => setSummary(event.target.value)} className="mt-2 min-h-28 rounded-xl" placeholder="ما الذي تحقق، وما الذي بقي مفتوحًا؟" /><Button onClick={createDraft} disabled={prepare.isPending || summary.trim().length < 10} className="mt-3 rounded-xl bg-[#16243b]">إعداد مسودة المحضر</Button></Card> : null}</div>;
}

function StageButton({ stage, active, count, onClick }: { stage: MeetingStage; active: boolean; count?: number; onClick: () => void }) {
  return <button onClick={onClick} className={`rounded-2xl border p-3 text-right transition active:scale-[0.98] ${active ? "border-[#77b8ad] bg-[#e8f4f1] shadow-sm" : "border-slate-200 bg-white hover:border-[#bdd8d2]"}`}><div className="flex items-center justify-between gap-2"><span className={`text-sm font-black ${active ? "text-[#14556a]" : "text-slate-800"}`}>{stageMeta[stage].title}</span>{typeof count === "number" ? <Badge variant="outline" className="rounded-full bg-white">{count}</Badge> : null}</div><p className="mt-1 hidden text-[11px] leading-5 text-slate-500 sm:block">{stageMeta[stage].subtitle}</p></button>;
}

function MeetingReferenceStrip({ sources }: { sources: any[] }) {
  const documents = sources.filter(source => Boolean(source.sourceDocumentId));
  if (!documents.length) return null;
  return <Card className="rounded-2xl border-[#d9d2f0] bg-[#faf8ff] p-4 shadow-none"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="flex items-center gap-2"><FileText className="h-4 w-4 text-violet-700" /><h4 className="font-black text-slate-900">مراجع الاجتماع</h4></div><p className="mt-1 text-xs text-slate-500">التقرير والمستندات التي تحتاجها أثناء الحديث أمامك هنا.</p></div><div className="flex flex-wrap gap-2">{documents.map(source => <a key={source.id} href={`/api/como-next/documents/${source.sourceDocumentId}`} target="_blank" rel="noreferrer" className="inline-flex items-center rounded-xl border border-violet-200 bg-white px-3 py-2 text-xs font-bold text-violet-800 hover:bg-violet-50">{source.sourceSystem === "manus_analysis" ? "فتح تحليل Manus" : source.title}</a>)}</div></div></Card>;
}

function SourceCards({ sources, analysesBySource, readOnly, analysisPendingId, runAnalysis }: { sources: any[]; analysesBySource: Set<number>; readOnly: boolean; analysisPendingId: number | null; runAnalysis: (id: number) => void }) {
  return <div className="grid gap-3 md:grid-cols-2">{sources.map(source => { const completedManusAnalysis = source.sourceSystem === "manus_analysis" && Boolean(source.sourceDocumentId); return <Card key={source.id} className="rounded-2xl border-slate-200 bg-white p-4 shadow-none"><div className="flex items-start justify-between gap-3"><div><div className="flex flex-wrap gap-2"><Badge variant="outline" className="rounded-full bg-slate-50">{sourceLabels[source.sourceKind as SourceKind]}</Badge>{completedManusAnalysis ? <Badge variant="outline" className="rounded-full border-emerald-200 bg-emerald-50 text-emerald-800">تحليل Manus مكتمل</Badge> : null}</div><h4 className="mt-2 font-bold text-slate-900">{source.title}</h4><p className="mt-1 text-[10px] font-mono text-slate-400">SHA-256 {source.sourceSha256.slice(0, 12)}…</p></div>{source.visibility === "internal_only" ? <LockKeyhole className="h-4 w-4 text-violet-700" /> : <FileText className="h-4 w-4 text-slate-400" />}</div><p className="mt-3 line-clamp-6 whitespace-pre-wrap rounded-xl bg-[#f8f8f5] p-3 text-[11px] leading-6 text-slate-600">{meetingSourcePreview(source.rawText)}</p>{hasHistoricalSnapshot(source.rawText) ? <p className="mt-2 rounded-xl border border-slate-100 bg-white px-3 py-2 text-[10px] font-bold text-slate-400">اللقطة التقنية الأصلية محفوظة في السجل ولا تُعرض داخل واجهة العمل.</p> : null}{source.sourceDocumentId ? <a href={`/api/como-next/documents/${source.sourceDocumentId}`} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">فتح الملف المحمي</a> : null}{!readOnly && !completedManusAnalysis ? <Button size="sm" onClick={() => runAnalysis(Number(source.id))} disabled={analysesBySource.has(Number(source.id)) || source.sourceStatus === "archived"} className="mt-4 w-full rounded-xl bg-violet-700 hover:bg-violet-800"><Sparkles className="ms-1 h-4 w-4" />{analysisPendingId === Number(source.id) ? "Manus يحلل..." : analysesBySource.has(Number(source.id)) ? "لها مسودة تحليل" : source.sourceStatus === "archived" ? "أرشيف تاريخي" : "حلّل مع Manus"}</Button> : null}</Card>; })}</div>;
}

export function MeetingWorkspaceDialog({ meeting, open, onOpenChange, onUpdated }: { meeting: any; open: boolean; onOpenChange: (open: boolean) => void; onUpdated: () => void }) {
  const query = trpc.comoNext.getMeetingWorkspace.useQuery({ meetingId: Number(meeting.id) }, { enabled: open });
  const utils = trpc.useUtils();
  const refresh = async () => { await query.refetch(); await utils.comoNext.getOverview.invalidate(); onUpdated(); };
  const data = query.data;
  const [activeStage, setActiveStage] = useState<MeetingStage>("before");
  const [analysisPendingId, setAnalysisPendingId] = useState<number | null>(null);
  const analyze = trpc.comoNext.analyzeMeetingSource.useMutation();
  useEffect(() => { if (open) setActiveStage(defaultStage(meeting)); }, [open, meeting.id]);
  const runAnalysis = async (sourceId: number) => { setAnalysisPendingId(sourceId); try { await analyze.mutateAsync({ sourceId, requestKey: crypto.randomUUID() }); toast.success("أعد Manus مسودة تحليل؛ لم ينشئ نتيجة تشغيلية"); await refresh(); } catch (error: any) { toast.error(error?.message || "تعذر تحليل المادة"); } finally { setAnalysisPendingId(null); } };
  const transcriptionConsent = data?.consents.find((item: any) => item.consentScope === "transcription")?.consentStatus;
  const recordingConsent = data?.consents.find((item: any) => item.consentScope === "recording")?.consentStatus;
  const consentReady = transcriptionConsent === "granted" && recordingConsent === "granted";
  const analysesBySource = useMemo(() => new Set((data?.analyses || []).map((item: any) => Number(item.sourceId))), [data?.analyses]);
  const readOnly = data?.meeting.meetingStatus === "completed" || data?.meeting.meetingStatus === "cancelled";
  const preparationSources = (data?.sources || []).filter((source: any) => source.sourceKind === "preparation");
  const outcomeSources = (data?.sources || []).filter((source: any) => source.sourceKind !== "preparation");
  const openRequired = (data?.agenda || []).filter((item: any) => item.isRequired && !item.isChecked).length;
  const pendingProposals = (data?.proposals || []).filter((item: any) => item.reviewStatus === "pending").length;

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent dir="rtl" className="h-[94vh] w-[calc(100vw-16px)] max-w-6xl overflow-hidden rounded-[28px] bg-[#f8f8f5] p-0 sm:w-full">
      <div className="border-b border-slate-200 bg-[#16243b] px-4 py-4 text-white sm:px-6"><DialogHeader className="text-right"><div className="mb-2 flex flex-wrap items-center gap-2"><Badge variant="outline" className="rounded-full border-white/20 bg-white/10 text-white">{readOnly ? "اجتماع مغلق" : "غرفة الاجتماع"}</Badge>{!readOnly ? consentReady ? <Badge variant="outline" className="rounded-full border-emerald-300/30 bg-emerald-300/10 text-emerald-100"><ShieldCheck className="ms-1 h-3 w-3" />التسجيل جاهز</Badge> : <Badge variant="outline" className="rounded-full border-amber-300/30 bg-amber-300/10 text-amber-100">التسجيل يحتاج موافقة</Badge> : null}</div><DialogTitle className="text-lg font-black text-white sm:text-xl">{meeting.title}</DialogTitle><DialogDescription className="line-clamp-2 text-slate-300">{meeting.objective || "تحضير واضح، تسجيل أو استيراد Zoom، ثم تحليل ومحضر ومتابعات."}</DialogDescription></DialogHeader></div>
      <div className="border-b border-slate-200 bg-[#f8f8f5] px-3 py-3 sm:px-6"><div className="grid grid-cols-3 gap-2"><StageButton stage="before" active={activeStage === "before"} count={data?.agenda.length || 0} onClick={() => setActiveStage("before")} /><StageButton stage="during" active={activeStage === "during"} count={openRequired} onClick={() => setActiveStage("during")} /><StageButton stage="after" active={activeStage === "after"} count={pendingProposals} onClick={() => setActiveStage("after")} /></div></div>
      <ScrollArea className="h-[calc(94vh-210px)]"><div className="space-y-5 p-4 sm:p-6">{query.isLoading ? <p className="py-20 text-center text-sm text-slate-500">جاري فتح غرفة الاجتماع...</p> : query.isError ? <p className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{query.error.message}</p> : data ? <>
        <Card className="rounded-3xl border-[#cfe3df] bg-[#f1f8f6] p-4 shadow-none"><div className="grid gap-3 sm:grid-cols-3"><div><p className="text-[11px] font-bold text-slate-400">الموعد</p><p className="mt-1 text-sm font-bold text-slate-800">{formatDateTime(data.meeting.startsAt)}</p></div><div><p className="text-[11px] font-bold text-slate-400">المشاركون</p><p className="mt-1 text-sm font-bold text-slate-800">{data.participants.length}</p></div><div><p className="text-[11px] font-bold text-slate-400">المطلوب المفتوح</p><p className="mt-1 text-sm font-bold text-slate-800">{openRequired}</p></div></div>{data.participants.length ? <div className="mt-3 flex flex-wrap gap-2">{data.participants.map((item: any) => <Badge key={item.id} variant="outline" className="rounded-full border-white bg-white px-3 py-1.5 text-[#18596a]"><UsersRound className="ms-1 h-3 w-3" />{item.displayName}</Badge>)}</div> : null}</Card>

        {activeStage === "before" ? <section className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><ListChecks className="h-5 w-5 text-[#1e6478]" /><div><h3 className="font-black text-slate-900">مسار الحديث في الاجتماع</h3><p className="text-xs text-slate-500">ابدأ بالمطلوب والحرج، واقرأ إحاطتك والنتيجة المطلوبة تحت كل نقطة.</p></div></div>{!readOnly ? <div className="flex flex-wrap gap-2"><AddAgendaDialog meetingId={data.meeting.id} onUpdated={refresh} /><AddSourceDialog meetingId={data.meeting.id} consentGranted={transcriptionConsent === "granted"} onUpdated={refresh} defaultKind="preparation" label="مادة تحضير" /></div> : null}</div><MeetingAgendaNavigator meetingId={data.meeting.id} items={data.agenda} readOnly onUpdated={refresh} />{preparationSources.length ? <div className="space-y-3"><h3 className="font-black text-slate-900">مواد التحضير</h3><SourceCards sources={preparationSources} analysesBySource={analysesBySource} readOnly={readOnly} analysisPendingId={analysisPendingId} runAnalysis={runAnalysis} /></div> : null}<div className="flex justify-end"><Button onClick={() => setActiveStage("during")} className="rounded-xl bg-[#16243b]">انتقل إلى الاجتماع<ChevronLeft className="me-2 h-4 w-4" /></Button></div></section> : null}

        {activeStage === "during" ? <section className="space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-black text-slate-900">التسجيل وإدارة الاجتماع</h3><p className="text-xs text-slate-500">كل شيء هنا: الموافقة، التسجيل، ملف Zoom، والمحاور التي توثق نتائجها أثناء الحديث.</p></div>{!readOnly ? <div className="flex flex-wrap gap-2"><ConsentDialog meetingId={data.meeting.id} recordingStatus={recordingConsent} transcriptionStatus={transcriptionConsent} onUpdated={refresh} /><AddSourceDialog meetingId={data.meeting.id} consentGranted={transcriptionConsent === "granted"} onUpdated={refresh} defaultKind="notes" label="ملاحظة سريعة" /></div> : null}</div><MeetingReferenceStrip sources={preparationSources} /><MeetingCapturePanel meetingId={data.meeting.id} consentReady={consentReady} recordings={data.recordings || []} readOnly={readOnly} onUpdated={refresh} /><div className="space-y-3"><div className="flex items-center justify-between"><h3 className="font-black text-slate-900">المحاور أثناء الحديث</h3><Badge variant="outline" className="rounded-full bg-white">{openRequired} مطلوب مفتوح</Badge></div><MeetingAgendaNavigator meetingId={data.meeting.id} items={data.agenda} readOnly={readOnly} onUpdated={refresh} /></div><div className="flex justify-end"><Button onClick={() => setActiveStage("after")} className="rounded-xl bg-[#16243b]">انتقل إلى النتيجة<ChevronLeft className="me-2 h-4 w-4" /></Button></div></section> : null}

        {activeStage === "after" ? <section className="space-y-6"><div><h3 className="font-black text-slate-900">الدليل والتفريغ</h3><p className="text-xs text-slate-500">أضف ما حدث فقط؛ Manus يحلل الدليل فورًا، يطبق النتائج الداخلية الآمنة، ويعيدك فقط لقرار أو التزام خارجي.</p></div>{(data.recordings || []).length ? <MeetingCapturePanel meetingId={data.meeting.id} consentReady={consentReady} recordings={data.recordings || []} readOnly={readOnly} onUpdated={refresh} /> : !readOnly ? <div className="flex flex-wrap gap-2"><ConsentDialog meetingId={data.meeting.id} recordingStatus={recordingConsent} transcriptionStatus={transcriptionConsent} onUpdated={refresh} /><AddSourceDialog meetingId={data.meeting.id} consentGranted={transcriptionConsent === "granted"} onUpdated={refresh} defaultKind="transcript" label="لصق تفريغ" /></div> : null}{outcomeSources.length ? <SourceCards sources={outcomeSources} analysesBySource={analysesBySource} readOnly={readOnly} analysisPendingId={analysisPendingId} runAnalysis={runAnalysis} /> : <Card className="rounded-2xl border-dashed border-slate-300 bg-white p-8 text-center shadow-none"><FileAudio className="mx-auto h-7 w-7 text-slate-300" /><p className="mt-3 font-bold text-slate-700">لا يوجد تفريغ أو ملاحظات بعد</p><p className="mt-1 text-xs text-slate-500">سجّل الاجتماع أو ارفع تفريغ Zoom من مرحلة «أثناء الاجتماع».</p></Card>}{data.analyses.length ? <section className="space-y-3"><div className="flex items-center gap-2"><Bot className="h-5 w-5 text-violet-700" /><div><h3 className="font-black text-slate-900">نتائج Manus المرتبطة بالدليل</h3><p className="text-xs text-slate-500">العمل الداخلي الآمن يُنفذ تلقائيًا؛ القرار الحقيقي أو الالتزام الخارجي فقط يبقى لمراجعتك.</p></div></div>{data.analyses.map((analysis: any) => <Card key={analysis.id} className="rounded-3xl border-violet-100 bg-[#fbfaff] p-5 shadow-none"><div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><Badge variant="outline" className="rounded-full border-violet-200 bg-white text-violet-800">{analysis.analysisType === "preparation" ? "تحضير" : "استخراج من الدليل"}</Badge><p className="mt-3 text-sm font-semibold leading-7 text-slate-800">{analysis.summary}</p>{analysis.openQuestions?.length ? <ul className="mt-3 list-disc space-y-1 pr-5 text-xs leading-6 text-slate-600">{analysis.openQuestions.map((question: string, index: number) => <li key={index}>{question}</li>)}</ul> : null}</div><Badge variant="outline" className="rounded-full bg-white">{analysis.analysisStatus === "draft" ? "بانتظار المراجعة" : "مراجع"}</Badge></div><div className="space-y-3">{data.proposals.filter((proposal: any) => Number(proposal.analysisId) === Number(analysis.id)).map((proposal: any) => <ProposalCard key={proposal.id} proposal={proposal} onUpdated={refresh} />)}</div></Card>)}</section> : null}<MinutesPanel meetingId={data.meeting.id} minutes={data.minutes} meetingStatus={data.meeting.meetingStatus} meetingOutcomeSummary={data.meeting.outcomeSummary} onUpdated={refresh} /></section> : null}
        <Card className="rounded-2xl border-emerald-100 bg-emerald-50/70 p-4 text-xs leading-6 text-emerald-900"><div className="flex items-start gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /><p><b>القاعدة:</b> الموافقة قبل التسجيل، والتسجيل والتفريغ دليلان؛ Manus يطبق العمل الداخلي الآمن تلقائيًا، والقرار أو الالتزام الخارجي فقط ينتظر مراجعتك.</p></div></Card>
      </> : null}</div></ScrollArea>
    </DialogContent>
  </Dialog>;
}

export function WorkFileMeetingsSection({ workFileId, meetings, isClosed, onUpdated }: { workFileId: number; meetings: any[]; isClosed: boolean; onUpdated: () => void }) {
  const [selected, setSelected] = useState<any | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("focusKind") !== "meeting") return;
    const focusId = Number(params.get("focusId"));
    const focusedMeeting = meetings.find(item => Number(item.id) === focusId);
    if (focusedMeeting) setSelected(focusedMeeting);
  }, [meetings]);
  return <section><div className="mb-3 flex items-center justify-between gap-3"><div className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-[#1e6478]" /><div><h3 className="text-base font-black text-slate-900">الاجتماعات</h3><p className="text-xs text-slate-500">قبل الاجتماع، أثناءه، وبعده — من مكان واحد.</p></div></div>{!isClosed ? <NewMeetingDialog workFileId={workFileId} onCreated={meetingId => { const created = meetings.find(item => Number(item.id) === meetingId); if (created) setSelected(created); onUpdated(); }} /> : null}</div><div className="space-y-3">{meetings.length === 0 ? <Card className="rounded-2xl border-dashed border-slate-300 bg-white p-6 text-center shadow-none"><CalendarDays className="mx-auto h-6 w-6 text-slate-300" /><p className="mt-2 text-sm font-bold text-slate-700">لا يوجد اجتماع بعد</p><p className="mt-1 text-xs text-slate-500">افتح غرفة للتحضير والتسجيل والمحضر داخل ملف الموضوع نفسه.</p></Card> : meetings.map(meetingItem => <button key={meetingItem.id} onClick={() => setSelected(meetingItem)} className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-right shadow-sm transition hover:border-[#9fc8c0] hover:shadow-md active:scale-[0.99]"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h4 className="font-bold leading-6 text-slate-900">{meetingItem.title}</h4><p className="mt-1 text-xs text-slate-500">{meetingItem.partyName || "اجتماع ملف الموضوع"} · {formatDateTime(meetingItem.startsAt)}</p></div><Badge variant="outline" className={`rounded-full ${meetingItem.meetingStatus === "completed" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : meetingItem.meetingStatus === "confirmed" ? "border-sky-200 bg-sky-50 text-sky-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>{meetingItem.meetingStatus === "completed" ? "مكتمل" : meetingItem.meetingStatus === "confirmed" ? "مؤكد" : "مخطط"}</Badge></div></button>)}</div>{selected ? <MeetingWorkspaceDialog meeting={selected} open={Boolean(selected)} onOpenChange={value => { if (!value) setSelected(null); }} onUpdated={onUpdated} /> : null}</section>;
}
