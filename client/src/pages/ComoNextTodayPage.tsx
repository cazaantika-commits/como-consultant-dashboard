import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { WorkFileMeetingsSection } from "@/components/ComoNextMeetingWorkspace";
import { ComoNextEmailInbox } from "@/components/ComoNextEmailInbox";
import { ComoNextIntakeProposals } from "@/components/ComoNextIntakeProposals";
import { PreservedCapabilityGallery } from "@/components/PreservedCapabilityGallery";
import { ComoPrimaryNav } from "@/components/ComoPrimaryNav";
import {
  AlertCircle,
  ArrowLeft,
  BookOpenCheck,
  Bot,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CalendarClock,
  Check,
  CheckCheck,
  ChevronLeft,
  CirclePause,
  CircleDot,
  Clock3,
  Database,
  FileCheck2,
  FileText,
  FileStack,
  FolderOpen,
  GitMerge,
  LockKeyhole,
  Loader2,
  LogIn,
  Mail,
  Inbox,
  MessagesSquare,
  Paperclip,
  Plus,
  RotateCcw,
  Scale,
  SendHorizontal,
  ShieldCheck,
  Sparkles,
  UserRound,
  UsersRound,
} from "lucide-react";

type ExecutiveSection = "actions" | "decisions" | "communications" | "meetings" | "email" | "intake" | "specialists" | "work-files" | "transfer";
type ExecutiveFocusKind = "action" | "decision" | "communication" | "meeting" | "proposal";
type WorkFileStage = "now" | "evidence" | "outputs" | "decisions" | "execution" | "history";
type QueueOwnerFilter = "all" | "owner" | "manus" | "external" | "scheduled";
type Priority = "normal" | "important" | "urgent";
type OwnerType = "human" | "manus" | "team";
type ActionStatus = "open" | "in_progress" | "waiting_external" | "completed_pending_verification" | "verified" | "cancelled";
type DecisionStatus = "required" | "approved" | "rejected" | "deferred" | "superseded";
type DecisionAuthority = "abdulrahman" | "wael" | "sheikh_issa" | "joint" | "other";
type CommunicationChannel = "email" | "whatsapp" | "letter" | "phone_note" | "internal";

const priorityMeta: Record<Priority, { label: string; className: string }> = {
  normal: { label: "عادي", className: "bg-slate-100 text-slate-700 border-slate-200" },
  important: { label: "مهم", className: "bg-amber-50 text-amber-800 border-amber-200" },
  urgent: { label: "عاجل", className: "bg-rose-50 text-rose-700 border-rose-200" },
};

const workFileStatusMeta: Record<string, { label: string; className: string }> = {
  draft: { label: "مسودة", className: "bg-slate-100 text-slate-700 border-slate-200" },
  open: { label: "نشط", className: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  waiting: { label: "بانتظار رد", className: "bg-amber-50 text-amber-800 border-amber-200" },
  blocked: { label: "متعطل", className: "bg-rose-50 text-rose-700 border-rose-200" },
  ready_to_close: { label: "جاهز للإغلاق", className: "bg-cyan-50 text-cyan-800 border-cyan-200" },
  closed: { label: "مغلق", className: "bg-slate-100 text-slate-600 border-slate-200" },
  cancelled: { label: "ملغي", className: "bg-slate-100 text-slate-500 border-slate-200" },
};

const communicationStatusMeta: Record<string, { label: string; className: string }> = {
  received: { label: "وارد", className: "border-sky-200 bg-sky-50 text-sky-800" },
  draft: { label: "مسودة تنتظر المراجعة", className: "border-amber-200 bg-amber-50 text-amber-800" },
  approved_for_send: { label: "معتمدة — لم يُسجل إرسالها", className: "border-violet-200 bg-violet-50 text-violet-800" },
  sent: { label: "مرسلة", className: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  cancelled: { label: "ملغاة", className: "border-slate-200 bg-slate-100 text-slate-600" },
  archived: { label: "مؤرشفة", className: "border-slate-200 bg-slate-50 text-slate-600" },
};

const communicationChannelLabel: Record<CommunicationChannel, string> = {
  email: "بريد إلكتروني",
  whatsapp: "واتساب",
  letter: "خطاب",
  phone_note: "ملاحظة اتصال",
  internal: "مراسلة داخلية",
};

const actionStatusMeta: Record<ActionStatus, { label: string; className: string }> = {
  open: { label: "مفتوح", className: "bg-slate-100 text-slate-700 border-slate-200" },
  in_progress: { label: "قيد التنفيذ", className: "bg-blue-50 text-blue-800 border-blue-200" },
  waiting_external: { label: "بانتظار طرف خارجي", className: "bg-amber-50 text-amber-800 border-amber-200" },
  completed_pending_verification: { label: "بانتظار التحقق", className: "bg-violet-50 text-violet-800 border-violet-200" },
  verified: { label: "تم التحقق", className: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  cancelled: { label: "ملغي", className: "bg-slate-100 text-slate-500 border-slate-200" },
};

const ownerMeta: Record<OwnerType, { label: string; icon: typeof UserRound; className: string }> = {
  human: { label: "عبد الرحمن", icon: UserRound, className: "text-slate-700 bg-slate-100" },
  manus: { label: "Manus", icon: Bot, className: "text-violet-800 bg-violet-50" },
  team: { label: "الفريق", icon: UsersRound, className: "text-cyan-800 bg-cyan-50" },
};

const decisionStatusMeta: Record<DecisionStatus, { label: string; className: string }> = {
  required: { label: "مطلوب الحسم", className: "border-rose-200 bg-rose-50 text-rose-700" },
  approved: { label: "معتمد", className: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  rejected: { label: "مرفوض", className: "border-slate-300 bg-slate-100 text-slate-700" },
  deferred: { label: "مؤجل", className: "border-amber-200 bg-amber-50 text-amber-800" },
  superseded: { label: "مستبدل", className: "border-violet-200 bg-violet-50 text-violet-800" },
};

const decisionAuthorityMeta: Record<DecisionAuthority, string> = {
  abdulrahman: "عبد الرحمن",
  wael: "وائل",
  sheikh_issa: "الشيخ عيسى",
  joint: "قرار مشترك",
  other: "جهة أخرى",
};

const queuePhaseMeta: Record<string, { label: string; icon: typeof CheckCheck; card: string; iconClass: string; eyebrow: string }> = {
  owner_review: { label: "يحتاج مراجعتك", icon: BookOpenCheck, card: "border-violet-100 bg-[linear-gradient(135deg,#ffffff_0%,#f5f0ff_100%)]", iconClass: "bg-violet-100 text-violet-800", eyebrow: "text-violet-700" },
  verify: { label: "جاهز للتحقق", icon: ShieldCheck, card: "border-cyan-100 bg-[linear-gradient(135deg,#ffffff_0%,#eaf8fb_100%)]", iconClass: "bg-cyan-100 text-cyan-800", eyebrow: "text-cyan-800" },
  act_now: { label: "للتنفيذ الآن", icon: CheckCheck, card: "border-emerald-100 bg-[linear-gradient(135deg,#ffffff_0%,#edf8f3_100%)]", iconClass: "bg-emerald-100 text-emerald-800", eyebrow: "text-emerald-800" },
  define_next_step: { label: "يحتاج خطوة تالية", icon: Sparkles, card: "border-amber-100 bg-[linear-gradient(135deg,#ffffff_0%,#fff7df_100%)]", iconClass: "bg-amber-100 text-amber-800", eyebrow: "text-amber-800" },
  waiting_external: { label: "بانتظار طرف خارجي", icon: Clock3, card: "border-orange-100 bg-[linear-gradient(135deg,#ffffff_0%,#fff2e7_100%)]", iconClass: "bg-orange-100 text-orange-800", eyebrow: "text-orange-800" },
  scheduled: { label: "موعد قادم", icon: CalendarClock, card: "border-blue-100 bg-[linear-gradient(135deg,#ffffff_0%,#eef4ff_100%)]", iconClass: "bg-blue-100 text-blue-800", eyebrow: "text-blue-800" },
};

const queueKindLabel: Record<string, string> = {
  action: "إجراء",
  decision: "قرار",
  communication: "مسودة",
  meeting: "اجتماع",
  email: "بريد",
  proposal: "مقترح",
  specialist: "مراجعة تخصصية",
  gap: "ملف عمل",
};

function queueResponsibilityMeta(item: any) {
  if (item.phase === "waiting_external") return { label: "الدور الآن: الطرف الخارجي", className: "bg-orange-100 text-orange-800" };
  if (item.phase === "scheduled") return { label: "الدور الآن: موعدك", className: "bg-blue-100 text-blue-800" };
  if (item.ownerType === "manus") return { label: "ينفذه Manus", className: "bg-violet-100 text-violet-800" };
  if (item.ownerType === "team") return { label: "ينفذه الفريق", className: "bg-cyan-100 text-cyan-800" };
  if (item.phase === "owner_review" || ["decision", "proposal", "communication", "email", "specialist"].includes(item.kind)) {
    return { label: "مطلوب منك: مراجعة أو حسم", className: "bg-amber-100 text-amber-900" };
  }
  return { label: "مطلوب منك", className: "bg-emerald-100 text-emerald-800" };
}

const workFileStages: Array<{ key: WorkFileStage; label: string; caption: string; icon: typeof Sparkles }> = [
  { key: "now", label: "الوضع الآن", caption: "الحقيقة والخطوة التالية", icon: Sparkles },
  { key: "evidence", label: "الدليل والمواد", caption: "ما وصل وما ثبت", icon: Paperclip },
  { key: "outputs", label: "التحليل والمخرجات", caption: "ما أنجزه المكتب", icon: FileText },
  { key: "decisions", label: "الحسم", caption: "القرار وسلطته", icon: Scale },
  { key: "execution", label: "التنفيذ والمتابعة", caption: "الإجراء وتحديث الواقع", icon: CheckCheck },
  { key: "history", label: "السجل", caption: "ما انتهى أو استُبدل", icon: GitMerge },
];

function ExecutiveQueueCard({ item, index, onOpen }: { item: any; index: number; onOpen: (item: any) => void }) {
  const meta = queuePhaseMeta[item.phase] || queuePhaseMeta.act_now;
  const responsibility = queueResponsibilityMeta(item);
  const Icon = meta.icon;
  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className={`group relative min-h-[82px] w-full min-w-0 overflow-hidden rounded-[22px] border p-3.5 text-right shadow-[0_8px_22px_rgba(15,23,42,.06)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(15,23,42,.10)] active:scale-[.99] sm:p-4 ${meta.card}`}
    >
      <span className={`absolute inset-y-0 right-0 w-1.5 ${item.priority === "urgent" ? "bg-rose-500" : item.priority === "important" ? "bg-amber-400" : "bg-[#1d6577]"}`} />
      <div className="flex h-full min-w-0 items-center gap-3 pr-1 sm:gap-4">
        <bdi className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white bg-white/80 text-sm font-black text-slate-500 shadow-sm">{String(index + 1).padStart(2, "0")}</bdi>
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${meta.iconClass}`}><Icon className="h-4.5 w-4.5" /></span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className={`text-[10px] font-black tracking-wide ${meta.eyebrow}`}>{meta.label}</span>
            <span className="rounded-full border border-white bg-white/75 px-2 py-0.5 text-[9px] font-bold text-slate-500">{queueKindLabel[item.kind] || "عمل"}</span>
            <span className={`rounded-full px-2 py-0.5 text-[9px] font-black ${responsibility.className}`}>{responsibility.label}</span>
            {Number(item.reviewItemCount || 0) > 1 ? <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[9px] font-black text-violet-800">{item.reviewItemCount} سجلات ضمن الموضوع</span> : null}
          </span>
          <span className="mt-1.5 block break-words text-[15px] font-black leading-6 text-slate-950 sm:text-base">{item.title}</span>
        </span>
        <ChevronLeft className="h-5 w-5 shrink-0 text-slate-300 transition-transform group-hover:-translate-x-1 group-hover:text-[#1d6577]" />
      </div>
    </button>
  );
}

function normalizeUtc(value: string | null | undefined) {
  if (!value) return null;
  return /Z$|[+-]\d{2}:?\d{2}$/.test(value) ? value : `${value.replace(" ", "T")}Z`;
}

function formatDateTime(value: string | null | undefined) {
  const normalized = normalizeUtc(value);
  if (!normalized) return "غير مؤرخ";
  return new Intl.DateTimeFormat("ar-AE", {
    timeZone: "Asia/Dubai",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(normalized));
}

function toIso(localValue: string) {
  return localValue ? new Date(localValue).toISOString() : undefined;
}

function StatusBadge({ status, kind = "action" }: { status: string; kind?: "action" | "work-file" }) {
  const meta = kind === "work-file" ? workFileStatusMeta[status] : actionStatusMeta[status as ActionStatus];
  return <Badge variant="outline" className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${meta?.className || ""}`}>{meta?.label || status}</Badge>;
}

function PriorityBadge({ priority }: { priority: Priority }) {
  const meta = priorityMeta[priority];
  return <Badge variant="outline" className={`rounded-full px-2 py-1 text-[10px] font-bold ${meta.className}`}>{meta.label}</Badge>;
}

function OwnerChip({ ownerType }: { ownerType: OwnerType }) {
  const meta = ownerMeta[ownerType];
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${meta.className}`}>
      <Icon className="h-3.5 w-3.5" />
      {meta.label}
    </span>
  );
}

function PageSkeleton() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <Skeleton className="h-44 rounded-[28px]" />
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map(item => <Skeleton key={item} className="h-28 rounded-2xl" />)}
      </div>
      <div className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
        <Skeleton className="h-96 rounded-3xl" />
        <Skeleton className="h-96 rounded-3xl" />
      </div>
    </div>
  );
}

function EmptyState({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="flex min-h-56 flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white/70 px-6 py-10 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
        <ShieldCheck className="h-6 w-6" />
      </div>
      <h3 className="text-base font-bold text-slate-900">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

function NewWorkFileDialog({ projects, onCreated }: { projects: any[]; onCreated: (id: number) => void }) {
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState("");
  const [title, setTitle] = useState("");
  const [question, setQuestion] = useState("");
  const [outcome, setOutcome] = useState("");
  const [priority, setPriority] = useState<Priority>("important");
  const createMutation = trpc.comoNext.createWorkFile.useMutation();

  const submit = async () => {
    if (!projectId || !title.trim() || !question.trim() || !outcome.trim()) {
      toast.error("أكمل الحقول الأساسية لملف العمل");
      return;
    }
    try {
      const result = await createMutation.mutateAsync({
        projectId: Number(projectId),
        title: title.trim(),
        governingQuestion: question.trim(),
        desiredOutcome: outcome.trim(),
        priority,
        idempotencyKey: crypto.randomUUID(),
      });
      toast.success("تم فتح ملف العمل");
      setOpen(false);
      setProjectId("");
      setTitle("");
      setQuestion("");
      setOutcome("");
      setPriority("important");
      onCreated(result.id);
    } catch (error: any) {
      toast.error(error?.message || "تعذر فتح ملف العمل");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="h-11 w-full min-w-0 rounded-xl bg-[#16243b] px-3 text-xs text-white shadow-lg shadow-slate-900/10 hover:bg-[#203554] active:scale-[0.98] sm:w-auto sm:px-5 sm:text-sm">
          <Plus className="ms-2 h-4 w-4" />
          فتح ملف عمل
        </Button>
      </DialogTrigger>
      <DialogContent dir="rtl" className="max-w-2xl rounded-3xl border-slate-200 bg-[#fdfcf9]">
        <DialogHeader className="text-right">
          <DialogTitle className="text-xl">فتح ملف عمل جديد</DialogTitle>
          <DialogDescription className="leading-6">ملف العمل يجمع السؤال والنتيجة والإجراءات وسجل ما حدث حول موضوع واحد.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-5 py-2">
          <div className="grid gap-2">
            <Label>المشروع</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="h-11 rounded-xl bg-white"><SelectValue placeholder="اختر المشروع" /></SelectTrigger>
              <SelectContent>
                {projects.map(project => <SelectItem key={project.id} value={String(project.id)}>{project.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="work-file-title">عنوان الملف</Label>
            <Input id="work-file-title" value={title} onChange={event => setTitle(event.target.value)} className="h-11 rounded-xl bg-white" placeholder="مثال: اعتماد عرض الاستشاري الرئيسي" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="work-file-question">السؤال الحاكم</Label>
            <Textarea id="work-file-question" value={question} onChange={event => setQuestion(event.target.value)} className="min-h-24 rounded-xl bg-white" placeholder="ما القرار أو المسألة التي يجب أن يحسمها هذا الملف؟" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="work-file-outcome">النتيجة المطلوبة</Label>
            <Textarea id="work-file-outcome" value={outcome} onChange={event => setOutcome(event.target.value)} className="min-h-24 rounded-xl bg-white" placeholder="ما الذي يثبت أن الملف انتهى بصورة صحيحة؟" />
          </div>
          <div className="grid gap-2">
            <Label>الأولوية</Label>
            <Select value={priority} onValueChange={value => setPriority(value as Priority)}>
              <SelectTrigger className="h-11 rounded-xl bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">عادي</SelectItem>
                <SelectItem value="important">مهم</SelectItem>
                <SelectItem value="urgent">عاجل</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:justify-start">
          <Button onClick={submit} disabled={createMutation.isPending} className="rounded-xl bg-[#16243b] hover:bg-[#203554]">
            {createMutation.isPending ? <Loader2 className="ms-2 h-4 w-4 animate-spin" /> : <FolderOpen className="ms-2 h-4 w-4" />}
            فتح الملف
          </Button>
          <Button variant="outline" onClick={() => setOpen(false)} className="rounded-xl bg-white">إلغاء</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewActionDialog({ workFileId, onCreated }: { workFileId: number; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [criteria, setCriteria] = useState("");
  const [ownerType, setOwnerType] = useState<OwnerType>("human");
  const [priority, setPriority] = useState<Priority>("important");
  const [dueAt, setDueAt] = useState("");
  const [followUpAt, setFollowUpAt] = useState("");
  const createMutation = trpc.comoNext.createAction.useMutation();

  const submit = async () => {
    if (!title.trim() || !criteria.trim()) {
      toast.error("أدخل الإجراء ومعيار قبوله");
      return;
    }
    try {
      await createMutation.mutateAsync({
        workFileId,
        title: title.trim(),
        description: description.trim() || undefined,
        acceptanceCriteria: criteria.trim(),
        ownerType,
        priority,
        dueAt: toIso(dueAt),
        followUpAt: toIso(followUpAt),
        idempotencyKey: crypto.randomUUID(),
      });
      toast.success("تمت إضافة الإجراء");
      setOpen(false);
      setTitle("");
      setDescription("");
      setCriteria("");
      setDueAt("");
      setFollowUpAt("");
      onCreated();
    } catch (error: any) {
      toast.error(error?.message || "تعذر إضافة الإجراء");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" className="rounded-xl bg-[#16243b] hover:bg-[#203554]"><Plus className="ms-1.5 h-4 w-4" />إجراء جديد</Button></DialogTrigger>
      <DialogContent dir="rtl" className="max-w-xl rounded-3xl bg-[#fdfcf9]">
        <DialogHeader className="text-right"><DialogTitle>إضافة الإجراء التالي</DialogTitle><DialogDescription>حدّد ما الذي سينفذ، من يملكه، وكيف نعرف أنه اكتمل.</DialogDescription></DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2"><Label>الإجراء</Label><Input value={title} onChange={event => setTitle(event.target.value)} className="h-11 rounded-xl bg-white" /></div>
          <div className="grid gap-2"><Label>التفاصيل</Label><Textarea value={description} onChange={event => setDescription(event.target.value)} className="min-h-20 rounded-xl bg-white" placeholder="السياق أو الخطوات التي يجب أخذها في الاعتبار" /></div>
          <div className="grid gap-2"><Label>معيار القبول</Label><Textarea value={criteria} onChange={event => setCriteria(event.target.value)} className="min-h-24 rounded-xl bg-white" placeholder="الدليل أو الناتج الذي سنقبله عند الإكمال" /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2"><Label>المالك</Label><Select value={ownerType} onValueChange={value => setOwnerType(value as OwnerType)}><SelectTrigger className="h-11 rounded-xl bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="human">عبد الرحمن</SelectItem><SelectItem value="manus">Manus</SelectItem><SelectItem value="team">الفريق</SelectItem></SelectContent></Select></div>
            <div className="grid gap-2"><Label>الأولوية</Label><Select value={priority} onValueChange={value => setPriority(value as Priority)}><SelectTrigger className="h-11 rounded-xl bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="normal">عادي</SelectItem><SelectItem value="important">مهم</SelectItem><SelectItem value="urgent">عاجل</SelectItem></SelectContent></Select></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2"><Label>موعد الاستحقاق</Label><Input type="datetime-local" value={dueAt} onChange={event => setDueAt(event.target.value)} className="h-11 rounded-xl bg-white" /></div>
            <div className="grid gap-2"><Label>موعد المتابعة</Label><Input type="datetime-local" value={followUpAt} onChange={event => setFollowUpAt(event.target.value)} className="h-11 rounded-xl bg-white" /></div>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:justify-start">
          <Button onClick={submit} disabled={createMutation.isPending} className="rounded-xl bg-[#16243b] hover:bg-[#203554]">{createMutation.isPending ? <Loader2 className="ms-2 h-4 w-4 animate-spin" /> : null}حفظ الإجراء</Button>
          <Button variant="outline" onClick={() => setOpen(false)} className="rounded-xl bg-white">إلغاء</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewDecisionDialog({ workFileId, onCreated }: { workFileId: number; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [question, setQuestion] = useState("");
  const [context, setContext] = useState("");
  const [recommendation, setRecommendation] = useState("");
  const [authority, setAuthority] = useState<DecisionAuthority>("abdulrahman");
  const [dueAt, setDueAt] = useState("");
  const mutation = trpc.comoNext.createDecision.useMutation();

  const submit = async () => {
    if (!title.trim() || !question.trim()) {
      toast.error("أدخل عنوان القرار والسؤال المطلوب حسمه");
      return;
    }
    try {
      await mutation.mutateAsync({
        workFileId,
        title: title.trim(),
        question: question.trim(),
        contextSummary: context.trim() || undefined,
        recommendation: recommendation.trim() || undefined,
        decisionAuthority: authority,
        dueAt: toIso(dueAt),
        idempotencyKey: crypto.randomUUID(),
      });
      toast.success("تم تسجيل القرار المطلوب");
      setOpen(false);
      setTitle(""); setQuestion(""); setContext(""); setRecommendation(""); setDueAt("");
      onCreated();
    } catch (error: any) {
      toast.error(error?.message || "تعذر تسجيل القرار");
    }
  };

  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button size="sm" variant="outline" className="rounded-xl border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"><Scale className="ms-1.5 h-4 w-4" />قرار مطلوب</Button></DialogTrigger>
    <DialogContent dir="rtl" className="max-w-2xl rounded-3xl bg-[#fdfcf9]">
      <DialogHeader className="text-right"><DialogTitle>فتح قرار مطلوب</DialogTitle><DialogDescription>افصل القرار عن الإجراء: اكتب ما يجب حسمه، ومن صاحب السلطة، وما توصية المكتب إن وجدت.</DialogDescription></DialogHeader>
      <div className="grid gap-4">
        <div className="grid gap-2"><Label>عنوان القرار</Label><Input value={title} onChange={event => setTitle(event.target.value)} className="h-11 rounded-xl bg-white" /></div>
        <div className="grid gap-2"><Label>السؤال المطلوب حسمه</Label><Textarea value={question} onChange={event => setQuestion(event.target.value)} className="min-h-24 rounded-xl bg-white" /></div>
        <div className="grid gap-2"><Label>الخلاصة والسياق</Label><Textarea value={context} onChange={event => setContext(event.target.value)} className="min-h-20 rounded-xl bg-white" /></div>
        <div className="grid gap-2"><Label>توصية المكتب التنفيذي — إن وجدت</Label><Textarea value={recommendation} onChange={event => setRecommendation(event.target.value)} className="min-h-20 rounded-xl bg-white" /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2"><Label>صاحب سلطة القرار</Label><Select value={authority} onValueChange={value => setAuthority(value as DecisionAuthority)}><SelectTrigger className="h-11 rounded-xl bg-white"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(decisionAuthorityMeta).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
          <div className="grid gap-2"><Label>موعد الحسم</Label><Input type="datetime-local" value={dueAt} onChange={event => setDueAt(event.target.value)} className="h-11 rounded-xl bg-white" /></div>
        </div>
      </div>
      <DialogFooter className="gap-2 sm:justify-start"><Button onClick={submit} disabled={mutation.isPending} className="rounded-xl bg-[#16243b] hover:bg-[#203554]">{mutation.isPending ? <Loader2 className="ms-2 h-4 w-4 animate-spin" /> : null}حفظ القرار المطلوب</Button><Button variant="outline" onClick={() => setOpen(false)} className="rounded-xl bg-white">إلغاء</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}

function ResolveDecisionDialog({ decision, onUpdated }: { decision: any; onUpdated: () => void }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"approved" | "rejected" | "deferred">("approved");
  const [authority, setAuthority] = useState<DecisionAuthority>(decision.decisionAuthority || "abdulrahman");
  const [text, setText] = useState("");
  const [evidence, setEvidence] = useState("");
  const [deferredUntil, setDeferredUntil] = useState("");
  const mutation = trpc.comoNext.resolveDecision.useMutation();
  const submit = async () => {
    if (!text.trim()) { toast.error("اكتب القرار أو سبب التأجيل"); return; }
    if (status === "deferred" && !deferredUntil) { toast.error("حدد موعد العودة للقرار"); return; }
    try {
      await mutation.mutateAsync({ decisionId: decision.id, nextStatus: status, decisionAuthority: authority, decisionText: text.trim(), evidenceReference: evidence.trim() || undefined, deferredUntil: status === "deferred" ? toIso(deferredUntil) : undefined });
      toast.success(status === "approved" ? "تم اعتماد القرار" : status === "rejected" ? "تم تسجيل الرفض" : "تم تأجيل القرار");
      setOpen(false); setText(""); setEvidence(""); setDeferredUntil("");
      onUpdated();
    } catch (error: any) { toast.error(error?.message || "تعذر حفظ القرار"); }
  };
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button size="sm" className="rounded-xl bg-rose-700 hover:bg-rose-800">حسم القرار</Button></DialogTrigger>
    <DialogContent dir="rtl" className="max-w-xl rounded-3xl bg-[#fdfcf9]">
      <DialogHeader className="text-right"><DialogTitle>{decision.title}</DialogTitle><DialogDescription>{decision.question}</DialogDescription></DialogHeader>
      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2"><div className="grid gap-2"><Label>النتيجة</Label><Select value={status} onValueChange={value => setStatus(value as typeof status)}><SelectTrigger className="h-11 rounded-xl bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="approved">اعتماد</SelectItem><SelectItem value="rejected">رفض</SelectItem><SelectItem value="deferred">تأجيل</SelectItem></SelectContent></Select></div><div className="grid gap-2"><Label>صاحب القرار</Label><Select value={authority} onValueChange={value => setAuthority(value as DecisionAuthority)}><SelectTrigger className="h-11 rounded-xl bg-white"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(decisionAuthorityMeta).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div></div>
        <div className="grid gap-2"><Label>نص القرار وأسبابه</Label><Textarea value={text} onChange={event => setText(event.target.value)} className="min-h-28 rounded-xl bg-white" /></div>
        <div className="grid gap-2"><Label>مرجع الدليل — اختياري</Label><Textarea value={evidence} onChange={event => setEvidence(event.target.value)} className="min-h-20 rounded-xl bg-white" placeholder="محضر، موافقة مكتوبة، أو اسم المستند" /></div>
        {status === "deferred" ? <div className="grid gap-2"><Label>موعد العودة للقرار</Label><Input type="datetime-local" value={deferredUntil} onChange={event => setDeferredUntil(event.target.value)} className="h-11 rounded-xl bg-white" /></div> : null}
      </div>
      <DialogFooter className="sm:justify-start"><Button onClick={submit} disabled={mutation.isPending} className="rounded-xl bg-[#16243b] hover:bg-[#203554]">حفظ القرار</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}

function NewCommunicationDraftDialog({ workFileId, onCreated }: { workFileId: number; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<CommunicationChannel>("email");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [toText, setToText] = useState("");
  const [ccText, setCcText] = useState("");
  const mutation = trpc.comoNext.createCommunicationDraft.useMutation();
  const submit = async () => {
    if (!subject.trim() || !body.trim()) { toast.error("أدخل عنوان المسودة ونصها"); return; }
    try {
      await mutation.mutateAsync({ workFileId, channel, subject: subject.trim(), body: body.trim(), toText: toText.trim() || undefined, ccText: ccText.trim() || undefined, idempotencyKey: crypto.randomUUID() });
      toast.success("حُفظت المسودة للمراجعة — لم تُرسل");
      setOpen(false); setSubject(""); setBody(""); setToText(""); setCcText("");
      onCreated();
    } catch (error: any) { toast.error(error?.message || "تعذر حفظ المسودة"); }
  };
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button size="sm" variant="outline" className="rounded-xl border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100"><Mail className="ms-1.5 h-4 w-4" />مسودة جديدة</Button></DialogTrigger>
    <DialogContent dir="rtl" className="max-w-2xl rounded-3xl bg-[#fdfcf9]">
      <DialogHeader className="text-right"><DialogTitle>مسودة مراسلة</DialogTitle><DialogDescription>هذه الخطوة تحفظ المسودة داخل الملف فقط. لا يوجد إرسال أو اتصال خارجي.</DialogDescription></DialogHeader>
      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2"><div className="grid gap-2"><Label>القناة</Label><Select value={channel} onValueChange={value => setChannel(value as CommunicationChannel)}><SelectTrigger className="h-11 rounded-xl bg-white"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(communicationChannelLabel).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div><div className="grid gap-2"><Label>إلى</Label><Input value={toText} onChange={event => setToText(event.target.value)} className="h-11 rounded-xl bg-white" placeholder="الاسم أو البريد" /></div></div>
        <div className="grid gap-2"><Label>نسخة إلى</Label><Input value={ccText} onChange={event => setCcText(event.target.value)} className="h-11 rounded-xl bg-white" /></div>
        <div className="grid gap-2"><Label>العنوان</Label><Input value={subject} onChange={event => setSubject(event.target.value)} className="h-11 rounded-xl bg-white" /></div>
        <div className="grid gap-2"><Label>نص المسودة</Label><Textarea value={body} onChange={event => setBody(event.target.value)} className="min-h-52 rounded-xl bg-white" /></div>
      </div>
      <DialogFooter className="gap-2 sm:justify-start"><Button onClick={submit} disabled={mutation.isPending} className="rounded-xl bg-[#16243b] hover:bg-[#203554]">حفظ للمراجعة</Button><Button variant="outline" onClick={() => setOpen(false)} className="rounded-xl bg-white">إلغاء</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}

function CommunicationControls({ communication, onUpdated }: { communication: any; onUpdated: () => void }) {
  const [reviewOpen, setReviewOpen] = useState(false);
  const [sentOpen, setSentOpen] = useState(false);
  const [note, setNote] = useState("");
  const [evidence, setEvidence] = useState("");
  const [externalRef, setExternalRef] = useState("");
  const review = trpc.comoNext.reviewCommunicationDraft.useMutation();
  const recordSent = trpc.comoNext.recordCommunicationSent.useMutation();
  const decide = async (decision: "approve" | "reject") => {
    try {
      await review.mutateAsync({ communicationId: communication.id, decision, reviewNote: note.trim() || undefined });
      toast.success(decision === "approve" ? "اعتمدت المسودة — لم تُرسل" : "رُفضت المسودة");
      setReviewOpen(false); setNote(""); onUpdated();
    } catch (error: any) { toast.error(error?.message || "تعذر تحديث المسودة"); }
  };
  const markSent = async () => {
    if (!evidence.trim()) { toast.error("أدخل دليل الإرسال"); return; }
    try {
      await recordSent.mutateAsync({ communicationId: communication.id, evidenceReference: evidence.trim(), externalMessageRef: externalRef.trim() || undefined });
      toast.success("تم تسجيل دليل الإرسال");
      setSentOpen(false); setEvidence(""); setExternalRef(""); onUpdated();
    } catch (error: any) { toast.error(error?.message || "تعذر تسجيل الإرسال"); }
  };
  if (communication.communicationStatus === "draft") return <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
    <DialogTrigger asChild><Button size="sm" className="rounded-xl bg-amber-700 hover:bg-amber-800">مراجعة المسودة</Button></DialogTrigger>
    <DialogContent dir="rtl" className="max-w-2xl rounded-3xl bg-[#fdfcf9]"><DialogHeader className="text-right"><DialogTitle>{communication.subject}</DialogTitle><DialogDescription>اعتماد المسودة لا يرسلها. الإرسال الخارجي غير مفعّل في هذه المرحلة.</DialogDescription></DialogHeader><div className="max-h-72 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4"><div className="mb-3 grid gap-1 text-[11px] text-slate-500">{communication.toText ? <p>إلى: <bdi dir="ltr">{communication.toText}</bdi></p> : null}{communication.ccText ? <p>نسخة: <bdi dir="ltr">{communication.ccText}</bdi></p> : null}</div><p className="whitespace-pre-wrap text-xs leading-7 text-slate-700">{communication.body}</p></div><div className="grid gap-2"><Label>ملاحظة المراجعة — اختياري</Label><Textarea value={note} onChange={event => setNote(event.target.value)} className="min-h-24 rounded-xl bg-white" /></div><DialogFooter className="gap-2 sm:justify-start"><Button onClick={() => decide("approve")} className="rounded-xl bg-emerald-700 hover:bg-emerald-800">اعتماد دون إرسال</Button><Button variant="outline" onClick={() => decide("reject")} className="rounded-xl border-rose-200 bg-rose-50 text-rose-700">رفض المسودة</Button></DialogFooter></DialogContent>
  </Dialog>;
  if (communication.communicationStatus === "approved_for_send") return <Dialog open={sentOpen} onOpenChange={setSentOpen}>
    <DialogTrigger asChild><Button size="sm" className="rounded-xl bg-violet-700 hover:bg-violet-800">تسجيل الإرسال</Button></DialogTrigger>
    <DialogContent dir="rtl" className="max-w-lg rounded-3xl bg-[#fdfcf9]"><DialogHeader className="text-right"><DialogTitle>تسجيل إرسال تم خارج COMO</DialogTitle><DialogDescription>هذا الزر لا يرسل الرسالة؛ يسجل فقط دليلًا على إرسالها عبر القناة الخارجية.</DialogDescription></DialogHeader><div className="grid gap-4"><div className="grid gap-2"><Label>دليل الإرسال</Label><Textarea value={evidence} onChange={event => setEvidence(event.target.value)} className="min-h-24 rounded-xl bg-white" placeholder="رقم الرسالة في Sent أو مرجع موثق" /></div><div className="grid gap-2"><Label>مرجع خارجي — اختياري</Label><Input value={externalRef} onChange={event => setExternalRef(event.target.value)} className="h-11 rounded-xl bg-white" /></div></div><DialogFooter className="sm:justify-start"><Button onClick={markSent} className="rounded-xl bg-[#16243b] hover:bg-[#203554]">حفظ دليل الإرسال</Button></DialogFooter></DialogContent>
  </Dialog>;
  return null;
}

function ActionStatusDialog({ action, onUpdated }: { action: any; onUpdated: () => void }) {
  const [open, setOpen] = useState(false);
  const [evidence, setEvidence] = useState("");
  const mutation = trpc.comoNext.changeActionStatus.useMutation();
  const changeStatus = async (nextStatus: ActionStatus, evidenceReference?: string) => {
    if (nextStatus === "verified" && !evidenceReference?.trim()) {
      toast.error("أدخل مرجع الدليل قبل التحقق");
      return;
    }
    try {
      await mutation.mutateAsync({ actionId: action.id, nextStatus, evidenceReference: evidenceReference?.trim() || undefined });
      toast.success("تم تحديث حالة الإجراء");
      setOpen(false);
      setEvidence("");
      onUpdated();
    } catch (error: any) {
      toast.error(error?.message || "تعذر تحديث الحالة");
    }
  };

  return (
    <div className="flex flex-wrap justify-end gap-2">
      {action.actionStatus === "open" ? <Button size="sm" variant="outline" disabled={mutation.isPending} onClick={() => changeStatus("in_progress")} className="rounded-xl bg-white"><Check className="ms-1.5 h-4 w-4" />بدء التنفيذ</Button> : null}
      {["open", "in_progress"].includes(action.actionStatus) ? <Button size="sm" variant="outline" disabled={mutation.isPending} onClick={() => changeStatus("waiting_external")} className="rounded-xl border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"><CirclePause className="ms-1.5 h-4 w-4" />بانتظار رد</Button> : null}
      {action.actionStatus === "waiting_external" ? <Button size="sm" variant="outline" disabled={mutation.isPending} onClick={() => changeStatus("in_progress")} className="rounded-xl bg-white"><RotateCcw className="ms-1.5 h-4 w-4" />استئناف</Button> : null}
      {action.actionStatus === "in_progress" ? <Button size="sm" variant="outline" disabled={mutation.isPending} onClick={() => changeStatus("completed_pending_verification")} className="rounded-xl bg-white">جاهز للتحقق</Button> : null}
      {action.actionStatus === "completed_pending_verification" ? <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><Button size="sm" className="rounded-xl bg-emerald-700 hover:bg-emerald-800"><CheckCheck className="ms-1.5 h-4 w-4" />اعتماد التحقق</Button></DialogTrigger>
        <DialogContent dir="rtl" className="max-w-lg rounded-3xl bg-[#fdfcf9]">
          <DialogHeader className="text-right"><DialogTitle>التحقق من الإجراء</DialogTitle><DialogDescription>لا يُغلق الإجراء لمجرد القول إنه انتهى؛ أدخل الدليل المقبول.</DialogDescription></DialogHeader>
          <div className="grid gap-2"><Label>مرجع الدليل</Label><Textarea value={evidence} onChange={event => setEvidence(event.target.value)} className="min-h-28 rounded-xl bg-white" placeholder="رابط الملف، اسم المستند، أو نتيجة التحقق" /></div>
          <DialogFooter className="sm:justify-start"><Button onClick={() => changeStatus("verified", evidence)} disabled={mutation.isPending} className="rounded-xl bg-emerald-700 hover:bg-emerald-800">اعتماد التحقق</Button></DialogFooter>
        </DialogContent>
      </Dialog> : null}
      {action.actionStatus === "verified" ? <Button size="sm" variant="ghost" disabled={mutation.isPending} onClick={() => changeStatus("in_progress")} className="rounded-xl text-slate-500"><RotateCcw className="ms-1.5 h-4 w-4" />إعادة فتح</Button> : null}
    </div>
  );
}

function CloseWorkFileDialog({ workFileId, disabled, onClosed }: { workFileId: number; disabled: boolean; onClosed: () => void }) {
  const [open, setOpen] = useState(false);
  const [evidence, setEvidence] = useState("");
  const mutation = trpc.comoNext.closeWorkFile.useMutation();

  const submit = async () => {
    if (!evidence.trim()) {
      toast.error("أدخل دليل إغلاق الملف");
      return;
    }
    try {
      await mutation.mutateAsync({ workFileId, closureEvidenceRef: evidence.trim() });
      toast.success("تم إغلاق ملف العمل");
      setOpen(false);
      onClosed();
    } catch (error: any) {
      toast.error(error?.message || "تعذر إغلاق ملف العمل");
    }
  };

  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button variant="outline" disabled={disabled} className="rounded-xl border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"><LockKeyhole className="ms-2 h-4 w-4" />إغلاق الملف</Button></DialogTrigger>
    <DialogContent dir="rtl" className="max-w-lg rounded-3xl bg-[#fdfcf9]">
      <DialogHeader className="text-right"><DialogTitle>إغلاق ملف العمل</DialogTitle><DialogDescription>لا يمكن الإغلاق قبل التحقق من كل الإجراءات. سجّل هنا الدليل النهائي على تحقق النتيجة المطلوبة.</DialogDescription></DialogHeader>
      <div className="grid gap-2"><Label>دليل الإغلاق</Label><Textarea value={evidence} onChange={event => setEvidence(event.target.value)} className="min-h-28 rounded-xl bg-white" placeholder="القرار المعتمد، المستند النهائي، أو مرجع النتيجة" /></div>
      <DialogFooter className="sm:justify-start"><Button onClick={submit} disabled={mutation.isPending} className="rounded-xl bg-emerald-700 hover:bg-emerald-800">تأكيد الإغلاق</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}

function TodayActionCard({ item, onOpen }: { item: any; onOpen: (workFileId: number, actionId: number) => void }) {
  return (
    <button onClick={() => onOpen(item.workFileId, item.id)} className="group flex min-h-14 w-full items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-right shadow-sm transition duration-150 hover:border-[#8fb7c2] hover:shadow-md active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e6478]">
      <h4 className="min-w-0 flex-1 text-sm font-bold leading-6 text-slate-900">{item.title}</h4>
      <ChevronLeft className="h-5 w-5 shrink-0 text-slate-300 transition-transform group-hover:-translate-x-1 group-hover:text-[#1e6478]" />
    </button>
  );
}

function TodayDecisionCard({ item, onOpen }: { item: any; onOpen: (workFileId: number, decisionId: number) => void }) {
  return <button onClick={() => onOpen(item.workFileId, item.id)} className="group flex min-h-14 w-full items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-right shadow-sm transition hover:border-rose-200 hover:shadow-md"><h4 className="min-w-0 flex-1 text-sm font-black leading-6 text-slate-900">{item.title}</h4><ChevronLeft className="h-5 w-5 shrink-0 text-slate-300 group-hover:text-rose-600" /></button>;
}

function TodayCommunicationCard({ item, onOpen }: { item: any; onOpen: (workFileId: number, communicationId: number) => void }) {
  return <button onClick={() => onOpen(item.workFileId, item.id)} className="group flex min-h-14 w-full items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-right shadow-sm transition hover:border-sky-200 hover:shadow-md"><h4 className="min-w-0 flex-1 text-sm font-black leading-6 text-slate-900">{item.subject}</h4><ChevronLeft className="h-5 w-5 shrink-0 text-slate-300 group-hover:text-sky-600" /></button>;
}

function TodayMeetingCard({ item, onOpen }: { item: any; onOpen: (workFileId: number, meetingId: number) => void }) {
  return <button onClick={() => onOpen(item.workFileId, item.id)} className="group flex min-h-14 w-full items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-right shadow-sm transition hover:border-teal-200 hover:shadow-md"><h4 className="min-w-0 flex-1 text-sm font-black leading-6 text-slate-900">{item.title}</h4><ChevronLeft className="h-5 w-5 shrink-0 text-slate-300 group-hover:text-teal-600" /></button>;
}

function WorkFileCard({ file, onOpen }: { file: any; onOpen: (id: number) => void }) {
  return (
    <button onClick={() => onOpen(file.id)} className="group flex min-h-16 w-full items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-right shadow-sm transition duration-150 hover:border-[#8fb7c2] hover:shadow-md active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e6478]">
      <h3 className="min-w-0 flex-1 text-base font-extrabold leading-7 text-slate-900">{file.title}</h3>
      <ChevronLeft className="h-5 w-5 shrink-0 text-slate-300 transition-transform group-hover:-translate-x-1 group-hover:text-[#1e6478]" />
    </button>
  );
}

function WorkFileUpdateComposer({ workFileId, actionId, updates, onChanged }: { workFileId: number; actionId?: number | null; updates: any[]; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [sourceChannel, setSourceChannel] = useState<"phone" | "meeting" | "whatsapp" | "email" | "site_visit" | "internal">("phone");
  const [updateText, setUpdateText] = useState("");
  const recordMutation = trpc.comoNext.recordWorkFileUpdate.useMutation();
  const analyzeMutation = trpc.comoNext.analyzeWorkFileUpdate.useMutation();
  const reviewMutation = trpc.comoNext.reviewWorkFileUpdate.useMutation();
  const busy = recordMutation.isPending || analyzeMutation.isPending || reviewMutation.isPending;

  const submit = async () => {
    if (updateText.trim().length < 3) return toast.error("اكتب ما حدث أولًا");
    try {
      const saved = await recordMutation.mutateAsync({ workFileId, actionId: actionId || null, sourceChannel, updateText: updateText.trim() });
      await analyzeMutation.mutateAsync({ updateId: saved.id });
      setUpdateText("");
      setOpen(false);
      toast.success("حُفظ التحديث وحلّل Manus الخطوة التالية للمراجعة");
      await onChanged();
    } catch (error: any) { toast.error(error?.message || "تعذر حفظ التحديث"); }
  };
  const review = async (updateId: number, decision: "apply" | "dismiss") => {
    try {
      await reviewMutation.mutateAsync({ updateId, decision });
      toast.success(decision === "apply" ? "تحول الاقتراح إلى إجراء حي" : "تم إنهاء الاقتراح دون إنشاء إجراء");
      await onChanged();
    } catch (error: any) { toast.error(error?.message || "تعذرت مراجعة الاقتراح"); }
  };

  return <section className="rounded-2xl border border-[#cfe3df] bg-[#f4faf8] p-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-sm font-black text-slate-950">ماذا حدث؟</h3><p className="mt-1 text-[11px] leading-5 text-slate-500">سجّل مكالمة أو اجتماعًا أو معلومة؛ يحلل Manus الخطوة التالية كاقتراح فقط.</p></div><Button type="button" onClick={() => setOpen(value => !value)} variant="outline" className="rounded-xl bg-white">{open ? "إغلاق" : "إضافة تحديث"}</Button></div>
    {open ? <div className="mt-4 space-y-3 border-t border-[#d9e9e5] pt-4">
      <Select value={sourceChannel} onValueChange={(value: any) => setSourceChannel(value)}><SelectTrigger className="h-11 rounded-xl bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="phone">مكالمة هاتفية</SelectItem><SelectItem value="meeting">اجتماع</SelectItem><SelectItem value="whatsapp">واتساب</SelectItem><SelectItem value="email">بريد</SelectItem><SelectItem value="site_visit">زيارة موقع</SelectItem><SelectItem value="internal">تحديث داخلي</SelectItem></SelectContent></Select>
      <Textarea value={updateText} onChange={event => setUpdateText(event.target.value)} className="min-h-28 rounded-xl bg-white leading-7" placeholder="مثال: أكد الاستشاري الموعد هاتفيًا ليوم الثلاثاء الساعة 10..." />
      <p className="text-[10px] leading-5 text-slate-400">بالضغط أدناه يُستدعى Manus عبر <bdi dir="ltr">gpt-5-mini</bdi> لتحليل هذا التحديث فقط. لا إرسال ولا تنفيذ تلقائي.</p>
      <Button type="button" onClick={submit} disabled={busy} className="w-full rounded-xl bg-[#1e6478] text-white hover:bg-[#18566a]">{busy ? <Loader2 className="ms-2 h-4 w-4 animate-spin" /> : <Sparkles className="ms-2 h-4 w-4" />}حفظ وتحليل الخطوة التالية</Button>
    </div> : null}
    {updates.length ? <div className="mt-4 space-y-2 border-t border-[#d9e9e5] pt-4">{updates.slice(0, 5).map(update => <div key={update.id} className="rounded-xl border border-white bg-white p-3"><div className="flex flex-wrap items-center justify-between gap-2"><Badge variant="outline" className="rounded-full bg-slate-50">{update.sourceChannel === "phone" ? "مكالمة" : update.sourceChannel === "meeting" ? "اجتماع" : update.sourceChannel}</Badge><bdi dir="ltr" className="text-[10px] text-slate-400">{formatDateTime(update.occurredAt)}</bdi></div><p className="mt-2 whitespace-pre-wrap text-xs font-semibold leading-6 text-slate-800">{update.updateText}</p>{update.analysisSummary ? <p className="mt-2 whitespace-pre-wrap border-t border-slate-100 pt-2 text-[11px] leading-6 text-slate-500">{update.analysisSummary}</p> : null}{update.analysisStatus === "draft" && update.suggestedActionTitle ? <div className="mt-3 rounded-xl border border-violet-100 bg-violet-50 p-3"><p className="text-[10px] font-black text-violet-700">الخطوة المقترحة</p><p className="mt-1 text-xs font-black leading-6 text-violet-950">{update.suggestedActionTitle}</p><div className="mt-3 flex flex-wrap gap-2"><Button size="sm" onClick={() => review(update.id, "apply")} disabled={busy} className="rounded-lg bg-violet-700 text-white hover:bg-violet-800">تحويلها إلى إجراء</Button><Button size="sm" variant="ghost" onClick={() => review(update.id, "dismiss")} disabled={busy} className="rounded-lg">لا يلزم إجراء</Button></div></div> : update.analysisStatus === "draft" ? <div className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-[11px] font-bold text-emerald-800">لا تستلزم خطوة جديدة؛ بقي التحديث ضمن سجل الملف.</div> : null}</div>)}</div> : null}
  </section>;
}

function FocusedActionView({ action, updates, isClosed, onBack, onUpdated }: { action: any; updates: any[]; isClosed: boolean; onBack: () => void; onUpdated: () => void }) {
  const linkedDocumentId = Number(String(action.evidenceReference || "").match(/document:(\d+)/)?.[1] || 0);
  return <div className="min-h-[100dvh] min-w-0 max-w-full overflow-x-hidden bg-[#f8f8f5] p-3 pt-14 sm:min-h-[calc(100vh-8rem)] sm:p-7">
    <button type="button" onClick={onBack} className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-sm transition hover:border-[#8fb7c2] sm:px-4 sm:text-sm"><ArrowLeft className="h-4 w-4 shrink-0" /><span className="break-words text-right">العودة إلى عناوين الإجراءات</span></button>
    <article className="mx-auto mt-4 min-w-0 max-w-xl rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm sm:mt-6 sm:rounded-[28px] sm:p-8">
      <div className="flex flex-wrap items-center gap-2"><StatusBadge status={action.actionStatus} /><OwnerChip ownerType={action.ownerType} /><PriorityBadge priority={action.priority} /></div>
      <h2 className="mt-5 break-words text-xl font-black leading-9 text-slate-950 sm:text-2xl sm:leading-10">{action.title}</h2>
      {action.description ? <div className="mt-6 border-t border-slate-100 pt-5"><p className="text-[11px] font-black text-slate-400">التفاصيل</p><p className="mt-2 whitespace-pre-wrap text-sm leading-8 text-slate-700">{action.description}</p></div> : null}
      <div className="mt-6 border-t border-slate-100 pt-5"><p className="text-[11px] font-black text-slate-400">معيار القبول</p><p className="mt-2 whitespace-pre-wrap text-sm leading-8 text-slate-800">{action.acceptanceCriteria}</p></div>
      {action.evidenceReference ? <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50 p-4"><p className="text-[11px] font-black text-emerald-700">المخرج المرتبط</p>{linkedDocumentId ? <a href={`/api/como-next/documents/${linkedDocumentId}`} target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#18596a] px-4 text-xs font-black text-white transition hover:bg-[#12495a]"><FileText className="h-4 w-4" />فتح التقرير المحمي</a> : <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-emerald-950">{action.evidenceReference}</p>}</div> : null}
      {action.attentionAt ? <div className="mt-5 flex items-center gap-2 border-t border-slate-100 pt-5 text-xs text-slate-500"><CalendarClock className="h-4 w-4" /><bdi dir="ltr">{formatDateTime(action.attentionAt)}</bdi></div> : null}
      {!isClosed ? <div className="mt-6 border-t border-slate-100 pt-5"><ActionStatusDialog action={action} onUpdated={onUpdated} /></div> : null}
      {!isClosed ? <div className="mt-5"><WorkFileUpdateComposer workFileId={action.workFileId} actionId={action.id} updates={updates} onChanged={onUpdated} /></div> : null}
    </article>
  </div>;
}

function FocusedRecordView({ kind, item, workFileId, isClosed, onBack, onUpdated }: { kind: Exclude<ExecutiveFocusKind, "action">; item: any; workFileId: number; isClosed: boolean; onBack: () => void; onUpdated: () => void }) {
  return <div className="min-h-[100dvh] min-w-0 max-w-full overflow-x-hidden bg-[#f8f8f5] p-3 pt-14 sm:min-h-[calc(100vh-8rem)] sm:p-7">
    <button type="button" onClick={onBack} className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-sm sm:px-4 sm:text-sm"><ArrowLeft className="h-4 w-4 shrink-0" />العودة إلى القائمة</button>
    <article className="mx-auto mt-4 min-w-0 max-w-2xl rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm sm:mt-6 sm:rounded-[28px] sm:p-8">
      {kind === "decision" ? <>
        <div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className={`rounded-full ${decisionStatusMeta[item.decisionStatus as DecisionStatus]?.className || ""}`}>{decisionStatusMeta[item.decisionStatus as DecisionStatus]?.label || item.decisionStatus}</Badge><Badge variant="outline" className="rounded-full bg-white">{decisionAuthorityMeta[item.decisionAuthority as DecisionAuthority]}</Badge></div>
        <h2 className="mt-5 text-2xl font-black leading-10 text-slate-950">{item.title}</h2>
        <p className="mt-5 whitespace-pre-wrap text-sm font-semibold leading-8 text-slate-800">{item.question}</p>
        {item.contextSummary ? <p className="mt-4 whitespace-pre-wrap border-t border-slate-100 pt-4 text-sm leading-8 text-slate-600">{item.contextSummary}</p> : null}
        {item.recommendation ? <div className="mt-4 rounded-2xl border border-cyan-100 bg-cyan-50 p-4 text-sm leading-7 text-cyan-950">{item.recommendation}</div> : null}
        {!isClosed && ["required", "deferred"].includes(item.decisionStatus) ? <div className="mt-6 border-t border-slate-100 pt-5"><ResolveDecisionDialog decision={item} onUpdated={onUpdated} /></div> : null}
      </> : null}
      {kind === "communication" ? <>
        <div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className={`rounded-full ${(communicationStatusMeta[item.communicationStatus] || communicationStatusMeta.archived).className}`}>{(communicationStatusMeta[item.communicationStatus] || communicationStatusMeta.archived).label}</Badge><Badge variant="outline" className="rounded-full bg-white">{communicationChannelLabel[item.channel as CommunicationChannel]}</Badge></div>
        <h2 className="mt-5 text-2xl font-black leading-10 text-slate-950">{item.subject}</h2>
        {item.toText ? <p className="mt-3 text-xs text-slate-500">إلى: <bdi dir="ltr">{item.toText}</bdi></p> : null}
        {item.fromText ? <p className="mt-1 text-xs text-slate-500">من: <bdi dir="ltr">{item.fromText}</bdi></p> : null}
        <p className="mt-5 whitespace-pre-wrap border-t border-slate-100 pt-5 text-sm leading-8 text-slate-700">{item.body}</p>
        {!isClosed ? <div className="mt-6 border-t border-slate-100 pt-5"><CommunicationControls communication={item} onUpdated={onUpdated} /></div> : null}
      </> : null}
      {kind === "meeting" ? <WorkFileMeetingsSection workFileId={workFileId} meetings={[item]} isClosed={isClosed} onUpdated={onUpdated} /> : null}
    </article>
  </div>;
}

function WorkFileTitleRow({ title, eyebrow, meta, tone = "slate", onClick }: { title: string; eyebrow?: string; meta?: string; tone?: "slate" | "amber" | "violet" | "teal" | "rose"; onClick?: () => void }) {
  const toneClass = tone === "amber"
    ? "border-amber-100 bg-[#fffaf0] text-amber-800"
    : tone === "violet"
      ? "border-violet-100 bg-[#faf7ff] text-violet-800"
      : tone === "teal"
        ? "border-teal-100 bg-[#f3faf8] text-teal-800"
        : tone === "rose"
          ? "border-rose-100 bg-[#fff7f7] text-rose-800"
          : "border-slate-200 bg-white text-slate-700";
  const Wrapper = onClick ? "button" : "div";
  return <Wrapper type={onClick ? "button" : undefined} onClick={onClick} className={`group flex min-h-16 w-full items-center justify-between gap-4 rounded-2xl border px-4 py-3 text-right shadow-sm transition ${toneClass} ${onClick ? "hover:-translate-y-0.5 hover:shadow-md active:scale-[.99]" : ""}`}>
    <span className="min-w-0 flex-1">
      {eyebrow ? <span className="block text-[10px] font-black opacity-70">{eyebrow}</span> : null}
      <span className="mt-1 block break-words text-sm font-black leading-7 text-slate-950">{title}</span>
      {meta ? <span className="mt-1 block text-[10px] font-bold text-slate-400">{meta}</span> : null}
    </span>
    {onClick ? <ChevronLeft className="h-5 w-5 shrink-0 text-slate-300 transition group-hover:-translate-x-1 group-hover:text-current" /> : null}
  </Wrapper>;
}

function memoryLifecycleMeta(entry: any) {
  const text = `${entry.title || ""} ${entry.sourceStatus || ""}`.toLowerCase();
  if (!entry.isCurrent || /(حُذفت|حذفت|قديمة|ملغ|مستبدل|superseded|cancelled|deleted|archived)/.test(text)) return { label: "ملغى أو مستبدل", current: false, className: "bg-white/10 text-white/70" };
  if (entry.sourceStatus === "done") return { label: "مكتمل", current: true, className: "bg-emerald-300/15 text-emerald-100" };
  return { label: "حالي", current: true, className: "bg-amber-300/15 text-amber-100" };
}

function WorkOutputCard({ entry }: { entry: any }) {
  const lifecycle = memoryLifecycleMeta(entry);
  return <Card className="overflow-hidden rounded-[26px] border-violet-100 bg-white shadow-[0_16px_45px_rgba(32,30,67,.08)]">
    <div className="border-b border-violet-100 bg-[linear-gradient(135deg,#172a43_0%,#244b5a_62%,#8f744a_140%)] p-5 text-white sm:p-6">
      <div className="flex flex-wrap items-center gap-2"><Badge className="rounded-full border-white/15 bg-white/10 text-amber-100 hover:bg-white/10">مخرج تنفيذي</Badge><Badge className={`rounded-full border-white/15 hover:bg-white/10 ${lifecycle.className}`}>{lifecycle.label}</Badge></div>
      <h3 className="mt-4 break-words text-xl font-black leading-9">{entry.title}</h3>
    </div>
    <div className="p-5 sm:p-6">
      {entry.body ? <p className="whitespace-pre-wrap text-sm leading-8 text-slate-700">{entry.body}</p> : <p className="text-sm text-slate-500">المخرج محفوظ من دون ملخص نصي.</p>}
      <div className="mt-5 grid gap-3 border-t border-slate-100 pt-5 sm:grid-cols-3">
        <div><p className="text-[10px] font-black text-slate-400">نوع المخرج</p><p className="mt-1 text-xs font-bold text-slate-700">{entry.entryType || "تحليل أو تقرير"}</p></div>
        <div><p className="text-[10px] font-black text-slate-400">حالة المصدر</p><p className="mt-1 text-xs font-bold text-slate-700">{entry.sourceStatus || "محفوظ"}</p></div>
        <div><p className="text-[10px] font-black text-slate-400">آخر توثيق</p><p className="mt-1 text-xs font-bold text-slate-700"><bdi dir="ltr">{formatDateTime(entry.occurredAt)}</bdi></p></div>
      </div>
      {entry.documents?.length ? <div className="mt-5 space-y-2">{entry.documents.map((document: any) => <a key={document.id} href={document.downloadPath} target="_blank" rel="noreferrer" className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-[#cfe3df] bg-[#f1f8f6] px-4 text-xs font-black text-[#18596a] transition hover:bg-[#e5f2ef]"><span className="min-w-0 truncate">{document.fileName}</span><span className="shrink-0">فتح النسخة المحمية</span></a>)}</div> : null}
    </div>
  </Card>;
}

function WorkFileSheet({ workFileId, focusKind, focusId, open, onOpenChange, onActionChange, onProposalChange, onRecordChange, onFocusBack, onChanged }: { workFileId: number | null; focusKind: ExecutiveFocusKind | null; focusId: number | null; open: boolean; onOpenChange: (open: boolean) => void; onActionChange: (actionId: number | null) => void; onProposalChange: (proposalId: number) => void; onRecordChange: (kind: Exclude<ExecutiveFocusKind, "action" | "proposal">, id: number) => void; onFocusBack: () => void; onChanged: () => void }) {
  const detailQuery = trpc.comoNext.getWorkFile.useQuery({ workFileId: workFileId || 1 }, { enabled: open && Boolean(workFileId) });
  const [, navigate] = useLocation();
  const [selectedStage, setSelectedStage] = useState<WorkFileStage>("now");
  const [selectedMemoryId, setSelectedMemoryId] = useState<number | null>(null);
  const data = detailQuery.data;
  const hasOpenActions = data?.actions.some((action: any) => !["verified", "cancelled"].includes(action.actionStatus)) ?? false;
  const hasPendingDecisions = data?.decisions.some((decision: any) => ["required", "deferred"].includes(decision.decisionStatus)) ?? false;
  const hasPendingCommunications = data?.communications.some((communication: any) => ["draft", "approved_for_send"].includes(communication.communicationStatus)) ?? false;
  const hasPendingMeetings = data?.meetings.some((meeting: any) => ["planned", "confirmed"].includes(meeting.meetingStatus) || meeting.pendingProposalCount > 0 || meeting.latestMinutesStatus === "draft") ?? false;
  const hasPendingIntake = (data?.intakeProposals?.length || 0) > 0;
  const isClosed = data?.workFile.workFileStatus === "closed" || data?.workFile.workFileStatus === "cancelled";
  const focusedAction = focusKind === "action" && focusId ? data?.actions.find((action: any) => action.id === focusId) : null;
  const focusedDecision = focusKind === "decision" && focusId ? data?.decisions.find((decision: any) => decision.id === focusId) : null;
  const focusedCommunication = focusKind === "communication" && focusId ? data?.communications.find((communication: any) => communication.id === focusId) : null;
  const focusedMeeting = focusKind === "meeting" && focusId ? data?.meetings.find((meeting: any) => meeting.id === focusId) : null;
  const activeActions = data?.actions.filter((action: any) => !["verified", "cancelled"].includes(action.actionStatus)) || [];
  const historicalActions = data?.actions.filter((action: any) => ["verified", "cancelled"].includes(action.actionStatus)) || [];
  const evidenceEntries = data?.memory.filter((entry: any) => entry.memoryType === "material" || entry.memoryType === "note") || [];
  const outputEntries = data?.memory.filter((entry: any) => entry.memoryType === "work_product") || [];
  const selectedMemory = selectedMemoryId ? data?.memory.find((entry: any) => entry.id === selectedMemoryId) : null;
  const pendingDecisions = data?.decisions.filter((decision: any) => ["required", "deferred"].includes(decision.decisionStatus)) || [];
  const historicalDecisions = data?.decisions.filter((decision: any) => !["required", "deferred"].includes(decision.decisionStatus)) || [];
  const activeCommunications = data?.communications.filter((communication: any) => ["draft", "approved_for_send"].includes(communication.communicationStatus)) || [];
  const historicalCommunications = data?.communications.filter((communication: any) => !["draft", "approved_for_send", "received"].includes(communication.communicationStatus)) || [];
  const historyItems = [
    ...(data?.events || []).map((event: any) => ({ id: `event-${event.id}`, occurredAt: event.occurredAt, label: "سجل النظام", title: event.summary })),
    ...historicalActions.map((action: any) => ({ id: `action-${action.id}`, occurredAt: action.updatedAt || action.verifiedAt || action.completedAt, label: action.actionStatus === "cancelled" ? "إجراء ملغي" : "إجراء متحقق", title: action.title })),
    ...historicalDecisions.map((decision: any) => ({ id: `decision-${decision.id}`, occurredAt: decision.decidedAt || decision.updatedAt, label: decision.decisionStatus === "superseded" ? "قرار مستبدل" : "قرار محسوم", title: decision.title })),
    ...historicalCommunications.map((communication: any) => ({ id: `communication-${communication.id}`, occurredAt: communication.sentAt || communication.occurredAt, label: communication.communicationStatus === "cancelled" ? "مسودة ملغاة" : "مراسلة تاريخية", title: communication.subject })),
    ...(data?.memory || []).filter((entry: any) => entry.memoryType === "work_product" && !memoryLifecycleMeta(entry).current).map((entry: any) => ({ id: `output-${entry.id}`, occurredAt: entry.occurredAt, label: "مخرج ملغى أو مستبدل", title: entry.title })),
  ].sort((a, b) => new Date(normalizeUtc(b.occurredAt) || 0).getTime() - new Date(normalizeUtc(a.occurredAt) || 0).getTime());

  useEffect(() => {
    setSelectedStage("now");
    setSelectedMemoryId(null);
  }, [workFileId]);
  const stageCounts: Record<WorkFileStage, number> = {
    now: activeActions.length || pendingDecisions.length || data?.intakeProposals.length ? 1 : 0,
    evidence: evidenceEntries.length + (data?.communications.filter((communication: any) => communication.communicationStatus === "received").length || 0),
    outputs: outputEntries.length + activeCommunications.length + (data?.intakeProposals.length || 0),
    decisions: data?.decisions.length || 0,
    execution: activeActions.length + (data?.meetings.length || 0),
    history: historyItems.length,
  };
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent dir="rtl" side="left" className="!left-0 !right-0 !h-[100dvh] !w-screen !max-w-none overflow-x-hidden overflow-y-auto border-slate-200 bg-[#f8f8f5] p-0">
        {detailQuery.isLoading ? <div className="space-y-4 p-6"><Skeleton className="h-28 rounded-2xl" /><Skeleton className="h-48 rounded-2xl" /><Skeleton className="h-48 rounded-2xl" /></div> : detailQuery.isError ? <div className="p-8"><EmptyState title="تعذر فتح الملف" description={detailQuery.error.message} action={<Button type="button" variant="outline" onClick={() => detailQuery.refetch()}>إعادة المحاولة</Button>} /></div> : data ? <>
          {focusedAction ? <FocusedActionView action={focusedAction} updates={(data.updates || []).filter((update: any) => update.actionId === focusedAction.id)} isClosed={isClosed} onBack={onFocusBack} onUpdated={onChanged} /> : focusedDecision ? <FocusedRecordView kind="decision" item={focusedDecision} workFileId={data.workFile.id} isClosed={isClosed} onBack={onFocusBack} onUpdated={onChanged} /> : focusedCommunication ? <FocusedRecordView kind="communication" item={focusedCommunication} workFileId={data.workFile.id} isClosed={isClosed} onBack={onFocusBack} onUpdated={onChanged} /> : focusedMeeting ? <FocusedRecordView kind="meeting" item={focusedMeeting} workFileId={data.workFile.id} isClosed={isClosed} onBack={onFocusBack} onUpdated={onChanged} /> : <>
          <div className="border-b border-slate-700 bg-[radial-gradient(circle_at_12%_0%,rgba(198,158,91,.26),transparent_30%),linear-gradient(135deg,#0d2335_0%,#173948_62%,#1f5a54_100%)] px-4 py-7 text-white sm:px-8 sm:py-9">
            <div className="mx-auto max-w-5xl">
              <SheetHeader className="text-right">
                <div className="mb-3 flex flex-wrap items-center gap-2"><Badge className="rounded-full border-white/15 bg-white/10 text-amber-100 hover:bg-white/10">ملف موضوع تنفيذي</Badge><StatusBadge status={data.workFile.workFileStatus} kind="work-file" /><PriorityBadge priority={data.workFile.priority} /></div>
                <SheetDescription className="text-sm font-bold text-emerald-100">{data.workFile.projectName}</SheetDescription>
                <SheetTitle className="mt-2 break-words text-2xl font-black leading-10 text-white sm:text-4xl sm:leading-[1.35]">{data.workFile.title}</SheetTitle>
              </SheetHeader>
              {data.parties.length ? <div className="mt-4 flex flex-wrap gap-2">{data.parties.map((party: any) => <span key={party.id} className="rounded-full border border-white/15 bg-white/8 px-3 py-1.5 text-[11px] font-bold text-white/85">{party.displayName}{party.roleCode ? ` · ${party.roleCode}` : ""}</span>)}</div> : null}
              <div className="mt-6 grid gap-3 lg:grid-cols-2">
                <div className="rounded-[22px] border border-white/10 bg-white/8 p-4"><p className="text-[10px] font-black text-amber-200">السؤال الحاكم</p><p className="mt-2 text-sm font-semibold leading-7 text-white/90">{data.workFile.governingQuestion}</p></div>
                <div className="rounded-[22px] border border-white/10 bg-white/8 p-4"><p className="text-[10px] font-black text-emerald-200">النتيجة المطلوبة</p><p className="mt-2 text-sm leading-7 text-white/80">{data.workFile.desiredOutcome}</p></div>
              </div>
            </div>
          </div>

          <div className="mx-auto min-w-0 max-w-5xl space-y-6 p-4 pb-12 sm:p-7">
            <nav aria-label="مراحل ملف الموضوع" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {workFileStages.map(stage => { const Icon = stage.icon; const active = selectedStage === stage.key; return <button key={stage.key} type="button" onClick={() => { setSelectedStage(stage.key); setSelectedMemoryId(null); }} className={`min-h-[94px] rounded-[22px] border p-3 text-right transition active:scale-[.98] ${active ? "border-[#1d6577] bg-[#163847] text-white shadow-[0_14px_34px_rgba(22,56,71,.2)]" : "border-slate-200 bg-white text-slate-700 shadow-sm hover:border-[#8fb7c2]"}`}><span className="flex items-start justify-between gap-2"><Icon className={`h-4 w-4 ${active ? "text-amber-200" : "text-[#1d6577]"}`} /><bdi className={`text-[10px] font-black ${active ? "text-white/55" : "text-slate-300"}`}>{stageCounts[stage.key]}</bdi></span><span className="mt-3 block text-xs font-black">{stage.label}</span><span className={`mt-1 block text-[9px] font-bold ${active ? "text-white/55" : "text-slate-400"}`}>{stage.caption}</span></button>; })}
            </nav>

            {selectedStage === "now" ? <section className="space-y-5">
              <div className="grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
                <Card className="rounded-[30px] border-amber-100 bg-[linear-gradient(145deg,#fffdf7_0%,#fff6dc_100%)] p-5 shadow-sm sm:p-7"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-800"><Sparkles className="h-5 w-5" /></span><div><p className="text-[10px] font-black text-amber-700">ما الذي يحتاج منك الآن؟</p><h2 className="text-xl font-black text-slate-950">{pendingDecisions[0]?.title || data.intakeProposals[0]?.title || activeActions[0]?.title || (isClosed ? "الملف مكتمل ومحفوظ بالسجل" : "يحتاج تحديد الخطوة التالية")}</h2></div></div>{pendingDecisions[0] ? <p className="mt-5 text-sm leading-8 text-slate-700">{pendingDecisions[0].question}</p> : data.intakeProposals[0] ? <p className="mt-5 text-sm leading-8 text-slate-700">وصل مقترح من Manus يحتاج مراجعتك قبل أن يتحول إلى أي أثر تشغيلي.</p> : activeActions[0]?.description ? <p className="mt-5 text-sm leading-8 text-slate-700">{activeActions[0].description}</p> : null}<div className="mt-5 flex flex-wrap gap-2">{pendingDecisions[0] ? <Button onClick={() => onRecordChange("decision", pendingDecisions[0].id)} className="rounded-xl bg-rose-700 text-white hover:bg-rose-800">فتح القرار المطلوب</Button> : data.intakeProposals[0] ? <Button onClick={() => onProposalChange(data.intakeProposals[0].id)} className="rounded-xl bg-violet-700 text-white hover:bg-violet-800">فتح مقترح Manus</Button> : activeActions[0] ? <Button onClick={() => onActionChange(activeActions[0].id)} className="rounded-xl bg-[#163847] text-white hover:bg-[#22566a]">فتح الإجراء الجاري</Button> : null}</div></Card>
                <Card className="rounded-[30px] border-[#cfe3df] bg-[#f4faf8] p-5 shadow-sm sm:p-7"><p className="text-[10px] font-black text-[#1d6577]">الحقيقة التشغيلية</p><div className="mt-4 grid grid-cols-2 gap-3"><div className="rounded-2xl bg-white p-4"><p className="text-2xl font-black text-slate-950">{activeActions.length}</p><p className="mt-1 text-[10px] font-bold text-slate-400">إجراء نشط</p></div><div className="rounded-2xl bg-white p-4"><p className="text-2xl font-black text-slate-950">{pendingDecisions.length}</p><p className="mt-1 text-[10px] font-bold text-slate-400">قرار مطلوب</p></div><div className="rounded-2xl bg-white p-4"><p className="text-2xl font-black text-slate-950">{data.intakeProposals.length}</p><p className="mt-1 text-[10px] font-bold text-slate-400">مقترح للمراجعة</p></div><div className="rounded-2xl bg-white p-4"><p className="text-2xl font-black text-slate-950">{data.meetings.length}</p><p className="mt-1 text-[10px] font-bold text-slate-400">اجتماع مرتبط</p></div></div></Card>
              </div>
              {!isClosed ? <WorkFileUpdateComposer workFileId={data.workFile.id} updates={(data.updates || []).filter((update: any) => !update.actionId)} onChanged={onChanged} /> : null}
              <div className="grid gap-3 sm:grid-cols-3">{!isClosed ? <CloseWorkFileDialog workFileId={data.workFile.id} disabled={hasOpenActions || hasPendingDecisions || hasPendingCommunications || hasPendingMeetings || hasPendingIntake} onClosed={async () => { await onChanged(); onOpenChange(false); }} /> : <div className="flex min-h-11 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-bold text-emerald-800"><CheckCheck className="ms-2 h-4 w-4" />الملف مغلق بدليل</div>}<Button onClick={() => navigate(`/como-next/projects/${data.workFile.projectId}`)} className="rounded-xl bg-[#1e6478] text-white hover:bg-[#18566a]"><FolderOpen className="ms-2 h-4 w-4" />ملف المشروع</Button><Button variant="outline" onClick={() => navigate(`/project/${data.workFile.projectId}`)} className="rounded-xl bg-white"><Building2 className="ms-2 h-4 w-4" />بطاقة المشروع</Button></div>
            </section> : null}

            {selectedStage === "evidence" ? <section>
              {selectedMemory ? <><button type="button" onClick={() => setSelectedMemoryId(null)} className="mb-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm"><ArrowLeft className="h-4 w-4" />عناوين الدليل</button><Card className="rounded-[28px] border-slate-200 bg-white p-5 shadow-sm sm:p-7"><div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className="rounded-full bg-slate-50">{selectedMemory.memoryType === "material" ? "مادة أصلية" : "واقعة أو ملاحظة"}</Badge>{selectedMemory.isCurrent ? <Badge variant="outline" className="rounded-full border-emerald-100 bg-emerald-50 text-emerald-700">حالي</Badge> : <Badge variant="outline" className="rounded-full bg-slate-100 text-slate-500">تاريخي</Badge>}</div><h2 className="mt-5 text-2xl font-black leading-10 text-slate-950">{selectedMemory.title}</h2>{selectedMemory.body ? <p className="mt-5 whitespace-pre-wrap text-sm leading-8 text-slate-700">{selectedMemory.body}</p> : null}{selectedMemory.documents?.length ? <div className="mt-5 space-y-2 border-t border-slate-100 pt-5">{selectedMemory.documents.map((document: any) => <a key={document.id} href={document.downloadPath} target="_blank" rel="noreferrer" className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-[#cfe3df] bg-[#f1f8f6] px-4 text-xs font-black text-[#18596a]"><span className="min-w-0 truncate">{document.fileName}</span><span className="shrink-0">فتح عبر COMO</span></a>)}</div> : null}</Card></> : <><div className="mb-4"><p className="text-[11px] font-black text-[#1d6577]">مصادر الموضوع</p><h2 className="mt-1 text-2xl font-black text-slate-950">الدليل والمواد</h2><p className="mt-1 text-sm leading-7 text-slate-500">المصدر أولاً؛ تفسير Manus ومخرجاته في المرحلة التالية.</p></div><div className="space-y-2">{evidenceEntries.map((entry: any) => <WorkFileTitleRow key={`memory-${entry.id}`} title={entry.title} eyebrow={entry.memoryType === "material" ? "مادة أصلية" : "واقعة أو ملاحظة"} meta={`${entry.sourceStatus || "محفوظ"} · ${formatDateTime(entry.occurredAt)}`} tone={entry.isCurrent ? "teal" : "slate"} onClick={() => setSelectedMemoryId(entry.id)} />)}{data.communications.filter((communication: any) => communication.communicationStatus === "received").map((communication: any) => <WorkFileTitleRow key={`communication-${communication.id}`} title={communication.subject} eyebrow="مراسلة واردة" meta={formatDateTime(communication.occurredAt)} tone="amber" onClick={() => onRecordChange("communication", communication.id)} />)}{!evidenceEntries.length && !data.communications.some((communication: any) => communication.communicationStatus === "received") ? <EmptyState title="لا توجد مواد مرتبطة" description="عند ربط مستند أو رسالة أو واقعة بالموضوع ستظهر هنا بمصدرها." /> : null}</div></>}
            </section> : null}

            {selectedStage === "outputs" ? <section>
              {selectedMemory ? <><button type="button" onClick={() => setSelectedMemoryId(null)} className="mb-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm"><ArrowLeft className="h-4 w-4" />عناوين المخرجات</button><WorkOutputCard entry={selectedMemory} /></> : <><div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><p className="text-[11px] font-black text-violet-700">قراءة تنفيذية لا حقول خام</p><h2 className="mt-1 text-2xl font-black text-slate-950">التحليل والمخرجات</h2><p className="mt-1 max-w-2xl text-sm leading-7 text-slate-500">افتح مخرجاً واحداً لقراءته كوثيقة. المقترح أو المسودة لا يعنيان قراراً أو إرسالاً.</p></div>{!isClosed ? <NewCommunicationDraftDialog workFileId={data.workFile.id} onCreated={onChanged} /> : null}</div><div className="space-y-2">{outputEntries.map((entry: any) => { const lifecycle = memoryLifecycleMeta(entry); return <WorkFileTitleRow key={`output-${entry.id}`} title={entry.title} eyebrow={lifecycle.label} meta={`${entry.entryType || "تقرير"} · ${formatDateTime(entry.occurredAt)}`} tone={lifecycle.current ? "violet" : "slate"} onClick={() => setSelectedMemoryId(entry.id)} />; })}{activeCommunications.map((communication: any) => <WorkFileTitleRow key={`draft-${communication.id}`} title={communication.subject} eyebrow={communication.communicationStatus === "draft" ? "مسودة تحتاج مراجعة" : "معتمدة — لم تُرسل"} meta={formatDateTime(communication.occurredAt)} tone="amber" onClick={() => onRecordChange("communication", communication.id)} />)}</div>{data.intakeProposals.length ? <div className="mt-6 border-t border-slate-200 pt-6"><p className="mb-3 text-sm font-black text-slate-950">مقترحات Manus المرتبطة بالموضوع</p><ComoNextIntakeProposals proposals={data.intakeProposals || []} onChanged={onChanged} title="مقترحات مرتبطة بهذا الملف" /></div> : null}{!outputEntries.length && !activeCommunications.length && !data.intakeProposals.length ? <EmptyState title="لا يوجد مخرج تحليلي بعد" description="يبقى المصدر في مرحلة الدليل حتى ينتج عنه تحليل أو تقرير أو مسودة مراجعة." /> : null}</>}
            </section> : null}

            {selectedStage === "decisions" ? <section><div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><p className="text-[11px] font-black text-rose-700">التحليل لا يساوي قراراً</p><h2 className="mt-1 text-2xl font-black text-slate-950">الحسم</h2><p className="mt-1 text-sm leading-7 text-slate-500">السؤال، صاحب الصلاحية، الأدلة، والنتيجة المسجلة في مكان واحد.</p></div>{!isClosed ? <NewDecisionDialog workFileId={data.workFile.id} onCreated={onChanged} /> : null}</div><div className="space-y-2">{data.decisions.map((decision: any) => <WorkFileTitleRow key={decision.id} title={decision.title} eyebrow={decisionStatusMeta[decision.decisionStatus as DecisionStatus]?.label || decision.decisionStatus} meta={`${decisionAuthorityMeta[decision.decisionAuthority as DecisionAuthority]}${decision.dueAt ? ` · ${formatDateTime(decision.dueAt)}` : ""}`} tone={["required", "deferred"].includes(decision.decisionStatus) ? "rose" : "slate"} onClick={() => onRecordChange("decision", decision.id)} />)}{!data.decisions.length ? <EmptyState title="لا يوجد قرار في هذا الموضوع" description="يُفتح القرار فقط عندما يحتاج الموضوع حسمًا من صاحب الصلاحية." /> : null}</div></section> : null}

            {selectedStage === "execution" ? <section className="space-y-6"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[11px] font-black text-emerald-700">كل قراءة تنتهي بخطوة</p><h2 className="mt-1 text-2xl font-black text-slate-950">التنفيذ والمتابعة</h2><p className="mt-1 text-sm leading-7 text-slate-500">الإجراء الحالي أولاً؛ سجّل تغير الواقع ثم راجع اقتراح Manus قبل تطبيقه.</p></div>{!isClosed ? <NewActionDialog workFileId={data.workFile.id} onCreated={onChanged} /> : null}</div>{activeActions[0] ? <button type="button" onClick={() => onActionChange(activeActions[0].id)} className="group w-full rounded-[30px] border border-emerald-100 bg-[linear-gradient(145deg,#ffffff_0%,#edf8f3_100%)] p-5 text-right shadow-[0_16px_45px_rgba(19,78,64,.09)] transition hover:-translate-y-0.5 hover:shadow-lg sm:p-7"><div className="flex flex-wrap items-center gap-2"><Badge className="rounded-full bg-emerald-700 text-white hover:bg-emerald-700">الإجراء الجاري</Badge><OwnerChip ownerType={activeActions[0].ownerType} /><PriorityBadge priority={activeActions[0].priority} /></div><h3 className="mt-4 text-xl font-black leading-9 text-slate-950">{activeActions[0].title}</h3><p className="mt-3 text-sm leading-7 text-slate-600">معيار القبول: {activeActions[0].acceptanceCriteria}</p><div className="mt-5 flex items-center justify-between border-t border-emerald-100 pt-4 text-xs font-black text-emerald-800"><span>فتح التنفيذ والتحديث</span><ChevronLeft className="h-5 w-5 transition group-hover:-translate-x-1" /></div></button> : <EmptyState title="لا يوجد إجراء جارٍ" description="حدد الخطوة العملية التالية أو راجع المقترح المرتبط بالموضوع." />}{activeActions.length > 1 ? <div><p className="mb-3 text-sm font-black text-slate-950">إجراءات نشطة أخرى</p><div className="space-y-2">{activeActions.slice(1).map((action: any) => <WorkFileTitleRow key={action.id} title={action.title} eyebrow={actionStatusMeta[action.actionStatus as ActionStatus]?.label || action.actionStatus} meta={action.attentionAt ? formatDateTime(action.attentionAt) : undefined} tone="teal" onClick={() => onActionChange(action.id)} />)}</div></div> : null}{!isClosed ? <WorkFileUpdateComposer workFileId={data.workFile.id} updates={(data.updates || []).filter((update: any) => !update.actionId)} onChanged={onChanged} /> : null}{data.meetings.length ? <div><p className="mb-3 text-sm font-black text-slate-950">الاجتماعات المرتبطة</p><div className="space-y-2">{data.meetings.map((meeting: any) => <WorkFileTitleRow key={meeting.id} title={meeting.title} eyebrow="اجتماع" meta={`${meeting.meetingStatus} · ${formatDateTime(meeting.startsAt)}`} tone="teal" onClick={() => onRecordChange("meeting", meeting.id)} />)}</div></div> : null}</section> : null}

            {selectedStage === "history" ? <section><div className="mb-4"><p className="text-[11px] font-black text-slate-500">لا نمحو ما تغيّر</p><h2 className="mt-1 text-2xl font-black text-slate-950">السجل الزمني</h2><p className="mt-1 text-sm leading-7 text-slate-500">الأحداث والعناصر المنتهية أو الملغاة أو المستبدلة محفوظة كتاريخ، لا كعمل نشط.</p></div><div className="relative space-y-3 before:absolute before:bottom-4 before:right-[17px] before:top-4 before:w-px before:bg-slate-200">{historyItems.map((item: any) => <div key={item.id} className="relative flex gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><span className="relative z-10 mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-4 border-[#f8f8f5] bg-slate-700 text-white"><CircleDot className="h-4 w-4" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-[10px] font-black text-slate-500">{item.label}</p><bdi dir="ltr" className="text-[10px] text-slate-400">{formatDateTime(item.occurredAt)}</bdi></div><p className="mt-2 break-words text-sm font-bold leading-7 text-slate-800">{item.title}</p></div></div>)}{!historyItems.length ? <EmptyState title="لا يوجد سجل زمني بعد" description="تظهر هنا الأحداث والعناصر المنتهية أو الملغاة عندما تتطور حالة الموضوع." /> : null}</div></section> : null}
          </div>
          </>}
        </> : null}
      </SheetContent>
    </Sheet>
  );
}

function ImportReviewPanel({ data, isLoading, error }: { data: any; isLoading: boolean; error?: string }) {
  if (isLoading) return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map(item => <Skeleton key={item} className="h-28 rounded-3xl" />)}</div>;
  if (error) return <EmptyState title="تعذر قراءة منطقة النقل" description={error} />;
  if (!data?.available) return <EmptyState title="لا توجد حزمة منقولة" description="عند اكتمال بروفة نقل معتمدة ستظهر هنا قبل إدخال أي سجل إلى التشغيل." />;

  const projectDecision = (project: any) => project.stageStatus === "skipped"
    ? { label: "مستبعد مؤقتًا", className: "border-slate-200 bg-slate-100 text-slate-700" }
    : { label: `مرتبط بالمشروع ${project.targetId}`, className: "border-emerald-200 bg-emerald-50 text-emerald-800" };
  const dispositionLabels: Record<string, string> = {
    map_existing: "مطابقة مرجعية",
    create_candidate: "جهات مرشحة",
    create_work_file: "ملفات عمل",
    create_event: "أحداث وسجل",
    create_entry: "مدخلات ومخرجات",
    create_meeting: "اجتماعات",
    create_child: "تفاصيل تابعة",
    archive_history: "سجل تاريخي",
    skip_reference: "مستبعد مؤقتًا",
  };
  const transferStatus = data.batch.batchStatus === "promoted"
    ? { label: "النواة التشغيلية رُقّيت", className: "border-emerald-200 bg-emerald-50 text-emerald-800" }
    : data.batch.batchStatus === "reviewed"
      ? { label: "الترقية جارية", className: "border-cyan-200 bg-cyan-50 text-cyan-800" }
      : { label: "للمراجعة فقط", className: "border-amber-200 bg-amber-50 text-amber-800" };

  return <div className="space-y-6">
    <Card className="relative overflow-hidden rounded-[28px] border-slate-200 bg-white p-6 shadow-sm">
      <div className="absolute inset-y-0 right-0 w-1.5 bg-gradient-to-b from-[#1b7182] via-[#55a696] to-[#d5aa68]" />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#eaf4f3] text-[#1e6478]"><Database className="h-6 w-6" /></div><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-black text-slate-900">سجل النقل والترقية</h2><Badge variant="outline" className={`rounded-full ${transferStatus.className}`}>{transferStatus.label}</Badge></div><p className="mt-2 max-w-2xl text-sm leading-7 text-slate-500">بقيت الحزمة الخام محفوظة كما وصلت، وتم تحويل الجزء الواضح منها فقط إلى ملفات عمل وذاكرة واجتماعات تشغيلية. لم يُرسل بريد ولم تُشغّل جدولة أو Manus أثناء النقل.</p></div></div>
        <div className="rounded-2xl border border-slate-200 bg-[#f8f8f5] px-4 py-3 text-left"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Batch</p><p dir="ltr" className="mt-1 font-mono text-xs font-bold text-slate-700">{data.batch.batchId}</p></div>
      </div>
    </Card>

    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {[
        { label: "السجلات في المصدر", value: data.batch.sourceRecordCount, icon: Database, tone: "bg-slate-100 text-slate-700" },
        { label: "جاهزة للمراجعة", value: data.batch.stagedRecordCount, icon: GitMerge, tone: "bg-cyan-50 text-cyan-800" },
        { label: "مستبعدة بقرار", value: data.batch.skippedRecordCount, icon: LockKeyhole, tone: "bg-amber-50 text-amber-800" },
        { label: "مراجع الملفات", value: data.batch.stagedFileCount, icon: FileCheck2, tone: "bg-emerald-50 text-emerald-800" },
      ].map(item => { const Icon = item.icon; return <Card key={item.label} className="rounded-3xl border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div><p className="text-xs font-bold text-slate-400">{item.label}</p><p className="mt-2 text-3xl font-black text-slate-900"><bdi>{item.value}</bdi></p></div><div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${item.tone}`}><Icon className="h-6 w-6" /></div></div></Card>; })}
    </section>

    <section className="grid gap-5 lg:grid-cols-[1.08fr_0.92fr]">
      <Card className="rounded-3xl border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5"><h3 className="text-lg font-black text-slate-900">قرارات المشاريع</h3><p className="mt-1 text-sm text-slate-500">الربط لا يغيّر اسم المشروع أو رقم القطعة في قاعدة COMO الأصلية.</p></div>
        <div className="space-y-3">{data.projects.map((project: any) => { const decision = projectDecision(project); return <div key={project.sourceRecordId} className="rounded-2xl border border-slate-200 bg-[#fbfbf8] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-bold text-slate-900">{project.sourceName}</p><p className="mt-1 text-xs leading-6 text-slate-500">{project.reason}</p></div><Badge variant="outline" className={`rounded-full ${decision.className}`}>{decision.label}</Badge></div></div>; })}</div>
      </Card>
      <Card className="rounded-3xl border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5"><h3 className="text-lg font-black text-slate-900">تكوين الحزمة</h3><p className="mt-1 text-sm text-slate-500">كل فئة محفوظة مع مصدرها وحكمها قبل أي ترقية تشغيلية.</p></div>
        <div className="grid gap-2 sm:grid-cols-2">{data.breakdown.map((item: any) => <div key={`${item.stageStatus}-${item.disposition}`} className="flex items-center justify-between rounded-xl border border-slate-100 bg-[#f8f8f5] px-3 py-2.5"><span className="text-xs font-semibold text-slate-600">{dispositionLabels[item.disposition] || item.disposition}</span><bdi className="text-sm font-black text-slate-900">{item.recordCount}</bdi></div>)}</div>
      </Card>
    </section>

    {data.promotion && data.safeguards.operationalRecordsPromoted > 0 ? <Card className="rounded-3xl border-[#cfe3df] bg-[#f1f8f6] p-6 shadow-sm">
      <div className="mb-5 flex items-start gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-[#1e6478]"><CheckCheck className="h-5 w-5" /></div><div><h3 className="text-lg font-black text-slate-900">ما أصبح حيًا داخل المكتب التنفيذي</h3><p className="mt-1 text-sm leading-6 text-slate-600">هذه الأرقام تمثل سجلات تشغيلية قابلة للاستخدام وليست مجرد نسخة أرشيفية.</p></div></div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[
        { label: "ملفات العمل", value: data.promotion.workFiles },
        { label: "الإجراءات", value: data.promotion.actions },
        { label: "القرارات المطلوبة", value: data.promotion.decisions },
        { label: "المراسلات", value: data.promotion.communications },
        { label: "عناصر الذاكرة", value: data.promotion.memoryEntries },
        { label: "أحداث السجل", value: data.promotion.events },
        { label: "الاجتماعات", value: data.promotion.meetings },
        { label: "محاور الاجتماعات", value: data.promotion.agendaItems },
        { label: "جهات الاتصال", value: data.promotion.contacts },
        { label: "الوثائق المحفوظة", value: data.promotion.documentsStored },
      ].map(item => <div key={item.label} className="rounded-2xl border border-white bg-white/90 px-4 py-3"><p className="text-[11px] font-bold text-slate-500">{item.label}</p><p className="mt-1 text-2xl font-black text-[#18596a]"><bdi>{item.value}</bdi></p></div>)}</div>
    </Card> : null}

    <div className="grid gap-4 md:grid-cols-3">
      {[{ label: "سجلات تشغيلية رُقّيت", value: data.safeguards.operationalRecordsPromoted }, { label: "أسرار تم نقلها", value: data.safeguards.secretsImported }, { label: "إجراءات خارجية نُفذت", value: data.safeguards.externalSideEffects }].map(item => <div key={item.label} className="flex items-center justify-between rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3 text-emerald-900"><span className="text-xs font-bold">{item.label}</span><bdi className="text-lg font-black">{item.value}</bdi></div>)}
    </div>
  </div>;
}

export default function ComoNextTodayPage() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const requestParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const requestedTab = requestParams?.get("tab") ?? null;
  const requestedSection = requestParams?.get("section") as ExecutiveSection | null;
  const requestedWorkFileId = Number(requestParams?.get("workFileId") || 0);
  const requestedActionId = Number(requestParams?.get("actionId") || 0);
  const requestedFocusKind = requestParams?.get("focusKind") as ExecutiveFocusKind | null;
  const requestedFocusId = Number(requestParams?.get("focusId") || 0);
  const initialSection: ExecutiveSection | null = requestedFocusKind === "proposal"
    ? "intake"
    : requestedWorkFileId > 0
    ? "work-files"
    : requestedSection || (requestedTab === "work-files" || requestedTab === "email" || requestedTab === "transfer" ? requestedTab : null);
  const [selectedSection, setSelectedSection] = useState<ExecutiveSection | null>(initialSection);
  const [selectedWorkFileId, setSelectedWorkFileId] = useState<number | null>(requestedWorkFileId > 0 ? requestedWorkFileId : null);
  const [selectedFocusKind, setSelectedFocusKind] = useState<ExecutiveFocusKind | null>(requestedActionId > 0 ? "action" : requestedFocusKind);
  const [selectedFocusId, setSelectedFocusId] = useState<number | null>(requestedActionId > 0 ? requestedActionId : requestedFocusId > 0 ? requestedFocusId : null);
  const [showSections, setShowSections] = useState(false);
  const [queueOwnerFilter, setQueueOwnerFilter] = useState<QueueOwnerFilter>("all");
  const utils = trpc.useUtils();
  const overviewQuery = trpc.comoNext.getOverview.useQuery(undefined, { enabled: isAuthenticated, refetchInterval: 60_000 });
  const projectsQuery = trpc.comoNext.listProjects.useQuery(undefined, { enabled: isAuthenticated, staleTime: 60_000 });
  const importReviewQuery = trpc.comoNext.getImportReview.useQuery(undefined, { enabled: isAuthenticated && user?.role === "admin", staleTime: 60_000 });
  const data = overviewQuery.data;

  const openSection = (next: ExecutiveSection) => {
    setSelectedSection(next);
    const url = new URL(window.location.href);
    url.searchParams.delete("tab");
    url.searchParams.set("section", next);
    window.history.replaceState({}, "", `${url.pathname}${url.search}`);
  };
  const closeSection = () => {
    setSelectedSection(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("tab");
    url.searchParams.delete("section");
    window.history.replaceState({}, "", `${url.pathname}${url.search}`);
  };

  useEffect(() => {
    const onPopState = () => {
      const params = new URLSearchParams(window.location.search);
      const workFileId = Number(params.get("workFileId") || 0);
      const actionId = Number(params.get("actionId") || 0);
      const section = params.get("section") as ExecutiveSection | null;
      const focusKind = params.get("focusKind") as ExecutiveFocusKind | null;
      const focusId = Number(params.get("focusId") || 0);
      setSelectedWorkFileId(workFileId > 0 ? workFileId : null);
      setSelectedFocusKind(actionId > 0 ? "action" : focusKind);
      setSelectedFocusId(actionId > 0 ? actionId : focusId > 0 ? focusId : null);
      setSelectedSection(section);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const refresh = async () => {
    await Promise.all([utils.comoNext.getOverview.invalidate(), selectedWorkFileId ? utils.comoNext.getWorkFile.invalidate({ workFileId: selectedWorkFileId }) : Promise.resolve()]);
  };

  const syncFocusUrl = (workFileId: number | null, focusKind: ExecutiveFocusKind | null, focusId: number | null, mode: "push" | "replace" = "push") => {
    const url = new URL(window.location.href);
    if (workFileId) url.searchParams.set("workFileId", String(workFileId)); else url.searchParams.delete("workFileId");
    url.searchParams.delete("actionId");
    if (focusKind) url.searchParams.set("focusKind", focusKind); else url.searchParams.delete("focusKind");
    if (focusId) url.searchParams.set("focusId", String(focusId)); else url.searchParams.delete("focusId");
    window.history[mode === "push" ? "pushState" : "replaceState"]({}, "", `${url.pathname}${url.search}`);
  };
  const openWorkFile = (id: number, actionId?: number) => {
    setSelectedWorkFileId(id);
    setSelectedFocusKind(actionId ? "action" : null);
    setSelectedFocusId(actionId || null);
    syncFocusUrl(id, actionId ? "action" : null, actionId || null);
  };
  const openFocusedRecord = (workFileId: number, focusKind: ExecutiveFocusKind, focusId: number) => {
    setSelectedWorkFileId(workFileId);
    setSelectedFocusKind(focusKind);
    setSelectedFocusId(focusId);
    syncFocusUrl(workFileId, focusKind, focusId);
  };
  const openProposal = (proposalId: number) => {
    setSelectedSection("intake");
    setSelectedWorkFileId(null);
    setSelectedFocusKind("proposal");
    setSelectedFocusId(proposalId);
    const url = new URL(window.location.href);
    url.searchParams.delete("tab");
    url.searchParams.set("section", "intake");
    url.searchParams.delete("workFileId");
    url.searchParams.delete("actionId");
    url.searchParams.set("focusKind", "proposal");
    url.searchParams.set("focusId", String(proposalId));
    window.history.pushState({}, "", `${url.pathname}${url.search}`);
  };
  const changeFocusedProposal = (proposalId: number | null) => {
    if (proposalId) return openProposal(proposalId);
    setSelectedFocusKind(null);
    setSelectedFocusId(null);
    syncFocusUrl(null, null, null, "replace");
  };
  const openQueueItem = (item: any) => {
    if (item.workFileId && ["action", "decision", "communication", "meeting"].includes(item.kind)) return openWorkFile(item.workFileId);
    if (item.kind === "email") return openSection("email");
    if (item.kind === "proposal") return openProposal(item.recordId);
    if (item.kind === "specialist") return openSection("specialists");
    if (item.workFileId) return openWorkFile(item.workFileId);
  };
  const closeWorkFile = () => {
    setSelectedWorkFileId(null);
    setSelectedFocusKind(null);
    setSelectedFocusId(null);
    syncFocusUrl(null, null, null, "replace");
  };
  const changeFocusedAction = (actionId: number | null) => {
    setSelectedFocusKind(actionId ? "action" : null);
    setSelectedFocusId(actionId);
    syncFocusUrl(selectedWorkFileId, actionId ? "action" : null, actionId, "replace");
  };
  const leaveFocusedRecord = () => selectedSection && selectedSection !== "work-files" ? closeWorkFile() : changeFocusedAction(null);
  const sectionCards = useMemo(() => data ? [
    { key: "actions" as const, title: "الإجراءات والمتابعات", count: data.actions.length, icon: CheckCheck, tone: "bg-slate-100 text-slate-700" },
    { key: "decisions" as const, title: "القرارات المطلوبة", count: data.decisions.length, icon: Scale, tone: "bg-rose-50 text-rose-700" },
    { key: "communications" as const, title: "المراسلات والمسودات", count: data.draftCommunications.length, icon: Mail, tone: "bg-sky-50 text-sky-700" },
    { key: "meetings" as const, title: "الاجتماعات", count: data.meetingAttention.length, icon: CalendarDays, tone: "bg-teal-50 text-teal-700" },
    { key: "email" as const, title: "المراسلات البريدية", count: data.emailAttention.length, icon: Inbox, tone: "bg-amber-50 text-amber-700", adminOnly: true },
    { key: "intake" as const, title: "مقترحات المراجعة", count: data.intakeProposals.length, icon: Sparkles, tone: "bg-violet-50 text-violet-700" },
    { key: "specialists" as const, title: "المراجعات التخصصية", count: data.specialistAttention.length, icon: BriefcaseBusiness, tone: "bg-emerald-50 text-emerald-700" },
    { key: "work-files" as const, title: "ملفات العمل", count: data.workFiles.length, icon: FileStack, tone: "bg-cyan-50 text-cyan-800" },
  ].filter(item => !item.adminOnly || user?.role === "admin") : [], [data, user?.role]);

  if (loading) return <PageSkeleton />;
  if (!isAuthenticated || !user) {
    return <div dir="rtl" className="flex min-h-screen items-center justify-center bg-[#f7f7f3] p-6"><Card className="w-full max-w-md rounded-3xl border-slate-200 bg-white p-8 text-center shadow-xl"><div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#16243b] text-white"><BriefcaseBusiness className="h-7 w-7" /></div><h1 className="text-xl font-black">المكتب التنفيذي</h1><p className="mt-2 text-sm leading-6 text-slate-500">سجّل الدخول للوصول إلى ملفات العمل والمتابعات الخاصة بك.</p><Button onClick={() => { window.location.href = getLoginUrl(); }} className="mt-6 w-full rounded-xl bg-[#16243b] hover:bg-[#203554]"><LogIn className="ms-2 h-4 w-4" />تسجيل الدخول</Button></Card></div>;
  }

  const selectedMeta = sectionCards.find(item => item.key === selectedSection);
  const ownerWorkCount = data?.executionQueue.filter((item: any) =>
    item.phase === "owner_review"
    || (["act_now", "verify", "define_next_step"].includes(item.phase) && item.ownerType !== "manus" && item.ownerType !== "team")
  ).length || 0;
  const manusWorkCount = data?.executionQueue.filter((item: any) =>
    item.ownerType === "manus" && !["waiting_external", "scheduled"].includes(item.phase)
  ).length || 0;
  const visibleExecutionQueue = data?.executionQueue.filter((item: any) => {
    if (queueOwnerFilter === "all") return true;
    if (queueOwnerFilter === "manus") return item.ownerType === "manus" && !["waiting_external", "scheduled"].includes(item.phase);
    if (queueOwnerFilter === "external") return item.phase === "waiting_external";
    if (queueOwnerFilter === "scheduled") return item.phase === "scheduled";
    return item.phase === "owner_review"
      || (["act_now", "verify", "define_next_step"].includes(item.phase) && item.ownerType !== "manus" && item.ownerType !== "team");
  }) || [];
  return (
    <div dir="rtl" className="como-next-workspace min-h-screen min-w-0 max-w-full overflow-x-hidden bg-[radial-gradient(circle_at_top_right,#fff7e8_0,#f7f6ef_36%,#eaf1ee_100%)] pb-24 text-slate-900 sm:pb-0">
      <header className="border-b border-slate-800 bg-[radial-gradient(circle_at_top_right,#284965_0%,#14243a_48%,#091523_100%)] text-white shadow-[0_18px_50px_rgba(2,12,24,.18)]">
        <div className="mx-auto flex min-h-20 max-w-5xl flex-col items-stretch gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4">
          <div className="flex items-center gap-3">
            <button aria-label="فتح بوابة COMO" onClick={() => navigate("/gateway")} className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/5"><ArrowLeft className="h-4 w-4" /></button>
            <div><p className="text-[10px] font-bold tracking-[.16em] text-[#9dd5ca]">COMO NEXT</p><h1 className="text-xl font-black">المطبخ التنفيذي</h1></div>
          </div>
          <div className="grid min-w-0 grid-cols-1 gap-2 sm:flex sm:items-center">
            <div className="sm:w-[390px]"><ComoPrimaryNav active="kitchen" dark /></div>
            <NewWorkFileDialog projects={projectsQuery.data || []} onCreated={async id => { await refresh(); openWorkFile(id); }} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        {overviewQuery.isLoading ? <PageSkeleton /> : overviewQuery.isError ? <EmptyState title="تعذر تحميل المكتب التنفيذي" description={overviewQuery.error.message} action={<Button variant="outline" onClick={() => overviewQuery.refetch()} className="rounded-xl bg-white">إعادة المحاولة</Button>} /> : data ? <>
          {!selectedSection ? <section>
            <div className="mb-5 overflow-hidden rounded-[34px] bg-[linear-gradient(145deg,#0a2b35_0%,#113f45_55%,#1f5d50_100%)] p-6 text-white shadow-[0_26px_70px_rgba(8,47,54,.22)] sm:p-9">
              <div className="flex flex-wrap items-start justify-between gap-5">
                <div><p className="text-xs font-black text-amber-200">{new Intl.DateTimeFormat("ar-AE", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date())}</p><h2 className="mt-3 max-w-2xl text-3xl font-black leading-tight sm:text-5xl">ما الذي يحتاج إنجازًا الآن؟</h2><p className="mt-3 max-w-xl text-sm leading-7 text-white/65">كل موضوع في سطر مستقل، مرتب من الأعلى إلى الأسفل. افتح واحدًا فتختفي البقية حتى تنهيه أو تحدّثه.</p></div>
                <Button type="button" variant="outline" onClick={() => setShowSections(value => !value)} className="rounded-2xl border-white/15 bg-white/10 text-white hover:bg-white/20 hover:text-white">{showSections ? "إخفاء الأقسام" : "عرض حسب النوع"}</Button>
              </div>
              <div className="mt-7 grid grid-cols-2 gap-2 sm:max-w-3xl sm:grid-cols-4 sm:gap-3">
                <button type="button" aria-pressed={queueOwnerFilter === "owner"} onClick={() => setQueueOwnerFilter(value => value === "owner" ? "all" : "owner")} className={`rounded-[22px] border p-3 text-center transition ${queueOwnerFilter === "owner" ? "border-amber-200 bg-white/20 ring-2 ring-amber-200/60" : "border-white/10 bg-white/8 hover:bg-white/15"}`}><p className="text-2xl font-black text-amber-200">{ownerWorkCount}</p><p className="mt-1 text-[10px] font-bold text-white/55">مطلوب منك</p></button>
                <button type="button" aria-pressed={queueOwnerFilter === "manus"} onClick={() => setQueueOwnerFilter(value => value === "manus" ? "all" : "manus")} className={`rounded-[22px] border p-3 text-center transition ${queueOwnerFilter === "manus" ? "border-violet-200 bg-violet-300/20 ring-2 ring-violet-200/60" : "border-violet-300/15 bg-violet-300/10 hover:bg-violet-300/15"}`}><p className="text-2xl font-black text-violet-200">{manusWorkCount}</p><p className="mt-1 text-[10px] font-bold text-white/55">ينفذه Manus</p></button>
                <button type="button" aria-pressed={queueOwnerFilter === "external"} onClick={() => setQueueOwnerFilter(value => value === "external" ? "all" : "external")} className={`rounded-[22px] border p-3 text-center transition ${queueOwnerFilter === "external" ? "border-amber-200 bg-white/20 ring-2 ring-amber-200/60" : "border-white/10 bg-white/8 hover:bg-white/15"}`}><p className="text-2xl font-black text-amber-200">{data.executionQueue.filter((item: any) => item.phase === "waiting_external").length}</p><p className="mt-1 text-[10px] font-bold text-white/55">بانتظار الغير</p></button>
                <button type="button" aria-pressed={queueOwnerFilter === "scheduled"} onClick={() => setQueueOwnerFilter(value => value === "scheduled" ? "all" : "scheduled")} className={`rounded-[22px] border p-3 text-center transition ${queueOwnerFilter === "scheduled" ? "border-blue-200 bg-white/20 ring-2 ring-blue-200/60" : "border-white/10 bg-white/8 hover:bg-white/15"}`}><p className="text-2xl font-black text-amber-200">{data.executionQueue.filter((item: any) => item.phase === "scheduled").length}</p><p className="mt-1 text-[10px] font-bold text-white/55">مواعيد قادمة</p></button>
              </div>
            </div>
            {showSections ? <div className="mb-6 grid gap-3 sm:grid-cols-2">{sectionCards.map(item => { const Icon = item.icon; return <button key={item.key} type="button" onClick={() => openSection(item.key)} className="group relative min-h-[92px] overflow-hidden rounded-[24px] border border-white bg-white p-4 text-right shadow-[0_12px_30px_rgba(15,23,42,.07)] transition hover:-translate-y-0.5 hover:shadow-md"><span className={`absolute inset-y-0 right-0 w-1.5 ${item.tone.split(" ")[0]}`} /><span className="flex h-full min-w-0 items-center gap-3 pr-1"><span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${item.tone}`}><Icon className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-black text-slate-950">{item.title}</span><span className="mt-1 block text-[10px] font-bold text-slate-400">افتح العناوين ثم سجل واحد</span></span><bdi className="text-2xl font-black text-slate-300">{item.count}</bdi></span></button>; })}</div> : null}
            <ol aria-label="قائمة الأعمال مرتبة من الأعلى إلى الأسفل" className="space-y-3">{visibleExecutionQueue.length ? visibleExecutionQueue.map((item: any, index: number) => <li key={item.id}><ExecutiveQueueCard item={item} index={index} onOpen={openQueueItem} /></li>) : <li className="rounded-[26px] border border-dashed border-slate-300 bg-white p-7 text-center text-sm font-bold text-slate-500">لا يوجد عمل في هذا التصنيف الآن</li>}</ol>
          </section> : <section>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <button type="button" onClick={closeSection} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm"><ArrowLeft className="h-4 w-4" />كل الأعمال</button>
              <div className="text-left"><h2 className="text-xl font-black text-slate-950">{selectedMeta?.title || "المكتب التنفيذي"}</h2>{selectedMeta ? <bdi className="text-xs font-bold text-slate-400">{selectedMeta.count}</bdi> : null}</div>
            </div>

            {selectedSection === "actions" ? <div className="space-y-2">{data.actions.length ? data.actions.map((item: any) => <TodayActionCard key={item.id} item={item} onOpen={openWorkFile} />) : <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm font-bold text-slate-500">لا توجد إجراءات مفتوحة</div>}</div> : null}
            {selectedSection === "decisions" ? <div className="space-y-2">{data.decisions.length ? data.decisions.map((item: any) => <TodayDecisionCard key={item.id} item={item} onOpen={(workFileId, decisionId) => openFocusedRecord(workFileId, "decision", decisionId)} />) : <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm font-bold text-slate-500">لا توجد قرارات مطلوبة</div>}</div> : null}
            {selectedSection === "communications" ? <div className="space-y-2">{data.draftCommunications.length ? data.draftCommunications.map((item: any) => <TodayCommunicationCard key={item.id} item={item} onOpen={(workFileId, communicationId) => openFocusedRecord(workFileId, "communication", communicationId)} />) : <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm font-bold text-slate-500">لا توجد مسودات تنتظر المراجعة</div>}</div> : null}
            {selectedSection === "meetings" ? <div className="space-y-2">{data.meetingAttention.length ? data.meetingAttention.map((item: any) => <TodayMeetingCard key={item.id} item={item} onOpen={(workFileId, meetingId) => openFocusedRecord(workFileId, "meeting", meetingId)} />) : <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm font-bold text-slate-500">لا توجد اجتماعات تحتاج انتباهك</div>}</div> : null}
            {selectedSection === "email" && user.role === "admin" ? <ComoNextEmailInbox onOverviewChanged={async () => { await utils.comoNext.getOverview.invalidate(); }} /> : null}
            {selectedSection === "intake" ? <ComoNextIntakeProposals proposals={data.intakeProposals || []} onChanged={refresh} onOpenWorkFile={openWorkFile} selectedProposalId={selectedFocusKind === "proposal" ? selectedFocusId : null} onSelectedProposalChange={changeFocusedProposal} /> : null}
            {selectedSection === "specialists" ? <div><PreservedCapabilityGallery /><div className="mt-5 space-y-2">{data.specialistAttention.length ? data.specialistAttention.map((item: any) => <button key={item.id} type="button" onClick={() => navigate(`/como-next/projects/${item.projectId}`)} className="group flex min-h-14 w-full items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-right shadow-sm hover:border-emerald-200"><span className="min-w-0 flex-1 text-sm font-black text-slate-900">{item.executiveSummary || item.requestText}</span><ChevronLeft className="h-5 w-5 shrink-0 text-slate-300 group-hover:text-emerald-700" /></button>) : <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm font-bold text-slate-500">لا توجد مراجعات تخصصية معلقة الآن</div>}</div></div> : null}
            {selectedSection === "work-files" ? <div className="space-y-2">{data.workFiles.length ? data.workFiles.map((file: any) => <WorkFileCard key={file.id} file={file} onOpen={openWorkFile} />) : <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm font-bold text-slate-500">لا توجد ملفات عمل نشطة</div>}</div> : null}
            {selectedSection === "transfer" && user.role === "admin" ? <ImportReviewPanel data={importReviewQuery.data} isLoading={importReviewQuery.isLoading} error={importReviewQuery.error?.message} /> : null}
          </section>}
        </> : null}
      </main>

      <WorkFileSheet workFileId={selectedWorkFileId} focusKind={selectedFocusKind} focusId={selectedFocusId} open={selectedWorkFileId !== null} onOpenChange={open => { if (!open) closeWorkFile(); }} onActionChange={changeFocusedAction} onProposalChange={openProposal} onRecordChange={(kind, id) => { if (selectedWorkFileId) openFocusedRecord(selectedWorkFileId, kind, id); }} onFocusBack={leaveFocusedRecord} onChanged={refresh} />
    </div>
  );
}
