import { useMemo, useState } from "react";
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

type ExecutiveTab = "today" | "work-files" | "email" | "transfer";
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
        <Button className="h-11 rounded-xl bg-[#16243b] px-5 text-white shadow-lg shadow-slate-900/10 hover:bg-[#203554] active:scale-[0.98]">
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

function TodayActionCard({ item, onOpen }: { item: any; onOpen: (workFileId: number) => void }) {
  return (
    <button onClick={() => onOpen(item.workFileId)} className="group w-full rounded-2xl border border-slate-200 bg-white p-4 text-right shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e6478]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2"><PriorityBadge priority={item.priority} /><OwnerChip ownerType={item.ownerType} />{item.isOverdue ? <Badge variant="outline" className="rounded-full border-rose-200 bg-rose-50 text-rose-700">متأخر</Badge> : null}</div>
          <h4 className="line-clamp-2 text-sm font-bold leading-6 text-slate-900">{item.title}</h4>
          <p className="mt-1 line-clamp-1 text-xs text-slate-500">{item.projectName} · {item.workFileTitle}</p>
        </div>
        <ChevronLeft className="mt-1 h-5 w-5 shrink-0 text-slate-300 transition-transform group-hover:-translate-x-1 group-hover:text-slate-600" />
      </div>
      <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500"><Clock3 className="h-3.5 w-3.5" /><bdi dir="ltr">{formatDateTime(item.attentionAt)}</bdi></div>
    </button>
  );
}

function TodayDecisionCard({ item, onOpen }: { item: any; onOpen: (workFileId: number) => void }) {
  const status = decisionStatusMeta[item.decisionStatus as DecisionStatus];
  return <button onClick={() => onOpen(item.workFileId)} className="group w-full rounded-2xl border border-rose-100 bg-white p-4 text-right shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-rose-200 hover:shadow-md active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400">
    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="mb-2 flex flex-wrap items-center gap-2"><Badge variant="outline" className={`rounded-full ${status.className}`}>{status.label}</Badge><Badge variant="outline" className="rounded-full bg-white">{decisionAuthorityMeta[item.decisionAuthority as DecisionAuthority]}</Badge></div><h4 className="text-sm font-black leading-6 text-slate-900">{item.title}</h4><p className="mt-1 line-clamp-2 text-xs leading-6 text-slate-600">{item.question}</p><p className="mt-2 text-[11px] font-semibold text-[#1e6478]">{item.projectName} · {item.workFileTitle}</p></div><ChevronLeft className="mt-1 h-5 w-5 shrink-0 text-slate-300 transition-transform group-hover:-translate-x-1 group-hover:text-rose-600" /></div>
    {item.dueAt ? <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500"><CalendarClock className="h-3.5 w-3.5" /><bdi dir="ltr">{formatDateTime(item.dueAt)}</bdi></div> : null}
  </button>;
}

function TodayCommunicationCard({ item, onOpen }: { item: any; onOpen: (workFileId: number) => void }) {
  const meta = communicationStatusMeta[item.communicationStatus] || communicationStatusMeta.archived;
  return <button onClick={() => onOpen(item.workFileId)} className="group w-full rounded-2xl border border-sky-100 bg-white p-4 text-right shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-md active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400">
    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="mb-2 flex flex-wrap items-center gap-2"><Badge variant="outline" className={`rounded-full ${meta.className}`}>{meta.label}</Badge><Badge variant="outline" className="rounded-full bg-white">{communicationChannelLabel[item.channel as CommunicationChannel]}</Badge></div><h4 className="text-sm font-black leading-6 text-slate-900">{item.subject}</h4>{item.toText ? <p className="mt-1 truncate text-xs text-slate-500">إلى: <bdi dir="ltr">{item.toText}</bdi></p> : null}<p className="mt-2 text-[11px] font-semibold text-[#1e6478]">{item.projectName} · {item.workFileTitle}</p></div><ChevronLeft className="mt-1 h-5 w-5 shrink-0 text-slate-300 transition-transform group-hover:-translate-x-1 group-hover:text-sky-600" /></div>
  </button>;
}

function TodayMeetingCard({ item, onOpen }: { item: any; onOpen: (workFileId: number) => void }) {
  return <button onClick={() => onOpen(item.workFileId)} className="group w-full rounded-2xl border border-teal-100 bg-white p-4 text-right shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-md active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400">
    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="mb-2 flex flex-wrap items-center gap-2"><Badge variant="outline" className="rounded-full border-teal-200 bg-teal-50 text-teal-800">{item.meetingStatus === "planned" ? "قيد التحضير" : item.meetingStatus === "confirmed" ? "موعد مؤكد" : "تحتاج مراجعة"}</Badge>{item.pendingProposalCount ? <Badge variant="outline" className="rounded-full border-violet-200 bg-violet-50 text-violet-800">{item.pendingProposalCount} مقترح</Badge> : null}{item.draftMinutesCount ? <Badge variant="outline" className="rounded-full border-amber-200 bg-amber-50 text-amber-800">مسودة محضر</Badge> : null}</div><h4 className="text-sm font-black leading-6 text-slate-900">{item.title}</h4><p className="mt-2 text-[11px] font-semibold text-[#1e6478]">{item.projectName} · {item.workFileTitle}</p>{item.startsAt ? <p className="mt-2 text-xs text-slate-500"><bdi dir="ltr">{formatDateTime(item.startsAt)}</bdi></p> : null}</div><ChevronLeft className="mt-1 h-5 w-5 shrink-0 text-slate-300 transition-transform group-hover:-translate-x-1 group-hover:text-teal-600" /></div>
  </button>;
}

function WorkFileCard({ file, onOpen }: { file: any; onOpen: (id: number) => void }) {
  return (
    <button onClick={() => onOpen(file.id)} className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 text-right shadow-sm transition duration-200 hover:-translate-y-1 hover:border-slate-300 hover:shadow-xl active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e6478]">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-l from-[#1b7182] via-[#55a696] to-[#d5aa68]" />
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0"><div className="mb-3 flex flex-wrap items-center gap-2"><StatusBadge status={file.workFileStatus} kind="work-file" /><PriorityBadge priority={file.priority} /></div><h3 className="line-clamp-2 text-base font-extrabold leading-7 text-slate-900">{file.title}</h3><p className="mt-1 text-xs font-semibold text-[#1e6478]">{file.projectName}{file.plotNumber ? ` · قطعة ${file.plotNumber}` : ""}</p></div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#eaf4f3] text-[#1e6478]"><BriefcaseBusiness className="h-5 w-5" /></div>
      </div>
      <div className="mt-5 rounded-2xl bg-[#f7f8f6] p-4">
        <p className="text-[11px] font-bold text-slate-400">الإجراء التالي</p>
        <p className="mt-1 line-clamp-2 text-sm font-semibold leading-6 text-slate-800">{file.nextActionTitle || "لم يحدد بعد"}</p>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500"><span>{file.openActionCount} إجراء مفتوح</span><bdi dir="ltr">{file.nextAttentionAt ? formatDateTime(file.nextAttentionAt) : "بحاجة إلى تنظيم"}</bdi></div>
      </div>
    </button>
  );
}

function WorkFileSheet({ workFileId, open, onOpenChange, onChanged }: { workFileId: number | null; open: boolean; onOpenChange: (open: boolean) => void; onChanged: () => void }) {
  const detailQuery = trpc.comoNext.getWorkFile.useQuery({ workFileId: workFileId || 1 }, { enabled: open && Boolean(workFileId) });
  const [, navigate] = useLocation();
  const [showAllMemory, setShowAllMemory] = useState(false);
  const data = detailQuery.data;
  const hasOpenActions = data?.actions.some((action: any) => !["verified", "cancelled"].includes(action.actionStatus)) ?? false;
  const hasPendingDecisions = data?.decisions.some((decision: any) => ["required", "deferred"].includes(decision.decisionStatus)) ?? false;
  const hasPendingCommunications = data?.communications.some((communication: any) => ["draft", "approved_for_send"].includes(communication.communicationStatus)) ?? false;
  const hasPendingMeetings = data?.meetings.some((meeting: any) => ["planned", "confirmed"].includes(meeting.meetingStatus) || meeting.pendingProposalCount > 0 || meeting.latestMinutesStatus === "draft") ?? false;
  const isClosed = data?.workFile.workFileStatus === "closed" || data?.workFile.workFileStatus === "cancelled";
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent dir="rtl" side="left" className="w-full overflow-y-auto border-slate-200 bg-[#f8f8f5] p-0 sm:max-w-2xl">
        {detailQuery.isLoading ? <div className="space-y-4 p-6"><Skeleton className="h-28 rounded-2xl" /><Skeleton className="h-48 rounded-2xl" /><Skeleton className="h-48 rounded-2xl" /></div> : detailQuery.isError ? <div className="p-8"><EmptyState title="تعذر فتح الملف" description={detailQuery.error.message} /></div> : data ? <>
          <div className="border-b border-slate-200 bg-[#16243b] px-6 py-7 text-white">
            <SheetHeader className="text-right"><div className="mb-3 flex flex-wrap items-center gap-2"><StatusBadge status={data.workFile.workFileStatus} kind="work-file" /><PriorityBadge priority={data.workFile.priority} /></div><SheetTitle className="text-2xl font-black leading-9 text-white">{data.workFile.title}</SheetTitle><SheetDescription className="text-sm text-slate-300">{data.workFile.projectName}</SheetDescription></SheetHeader>
          </div>
          <div className="space-y-6 p-6">
            <Card className="rounded-3xl border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-bold text-slate-400">السؤال الحاكم</p><p className="mt-2 text-sm font-semibold leading-7 text-slate-900">{data.workFile.governingQuestion}</p><div className="my-4 h-px bg-slate-100" /><p className="text-xs font-bold text-slate-400">النتيجة المطلوبة</p><p className="mt-2 text-sm leading-7 text-slate-700">{data.workFile.desiredOutcome}</p></Card>
            {data.parties.length ? <Card className="rounded-3xl border-[#cfe3df] bg-[#f1f8f6] p-5 shadow-sm"><div className="flex items-center gap-2 text-[#1e6478]"><UsersRound className="h-4 w-4" /><h3 className="text-sm font-black">الأطراف المرتبطة بهذا الملف</h3></div><div className="mt-3 flex flex-wrap gap-2">{data.parties.map((party: any) => <Badge key={party.id} variant="outline" className="rounded-full border-[#bdd8d2] bg-white px-3 py-1.5 text-[#18596a]">{party.displayName}</Badge>)}</div></Card> : null}
            <section>
              <div className="mb-3 flex items-center justify-between gap-3"><div className="flex items-center gap-2"><Scale className="h-5 w-5 text-rose-700" /><div><h3 className="text-base font-black text-slate-900">سجل القرارات</h3><p className="text-xs text-slate-500">السؤال، صاحب السلطة، والنتيجة المعتمدة في مكان واحد.</p></div></div>{!isClosed ? <NewDecisionDialog workFileId={data.workFile.id} onCreated={onChanged} /> : null}</div>
              <div className="space-y-3">{data.decisions.length === 0 ? <EmptyState title="لا يوجد قرار مطلوب" description="أضف قرارًا فقط عندما يحتاج الملف حسمًا، لا لمجرد وجود إجراء." /> : data.decisions.map((decision: any) => { const meta = decisionStatusMeta[decision.decisionStatus as DecisionStatus]; return <Card key={decision.id} className="rounded-2xl border-rose-100 bg-white p-4 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><div className="mb-2 flex flex-wrap items-center gap-2"><Badge variant="outline" className={`rounded-full ${meta.className}`}>{meta.label}</Badge><Badge variant="outline" className="rounded-full bg-white">{decisionAuthorityMeta[decision.decisionAuthority as DecisionAuthority]}</Badge></div><h4 className="font-black leading-6 text-slate-900">{decision.title}</h4><p className="mt-2 text-xs font-semibold leading-6 text-slate-700">{decision.question}</p>{decision.contextSummary ? <p className="mt-2 text-xs leading-6 text-slate-500">{decision.contextSummary}</p> : null}{decision.recommendation ? <div className="mt-3 rounded-xl border border-cyan-100 bg-cyan-50 px-3 py-2 text-xs leading-6 text-cyan-900"><span className="font-bold">توصية المكتب:</span> {decision.recommendation}</div> : null}{decision.decisionText ? <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs leading-6 text-emerald-900"><span className="font-bold">القرار المسجل:</span> {decision.decisionText}</div> : null}</div>{!isClosed && ["required", "deferred"].includes(decision.decisionStatus) ? <ResolveDecisionDialog decision={decision} onUpdated={onChanged} /> : null}</div>{decision.dueAt ? <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500"><CalendarClock className="h-3.5 w-3.5" /><bdi dir="ltr">{formatDateTime(decision.dueAt)}</bdi></div> : null}</Card>; })}</div>
            </section>
            <section>
              <div className="mb-3 flex items-center justify-between gap-3"><div className="flex items-center gap-2"><Mail className="h-5 w-5 text-sky-700" /><div><h3 className="text-base font-black text-slate-900">المراسلات</h3><p className="text-xs text-slate-500">الوارد، المرسل، والمسودات في سياق الملف. لا إرسال دون اعتماد صريح.</p></div></div>{!isClosed ? <NewCommunicationDraftDialog workFileId={data.workFile.id} onCreated={onChanged} /> : null}</div>
              <div className="space-y-3">{data.communications.length === 0 ? <EmptyState title="لا توجد مراسلات" description="أنشئ مسودة عندما يحتاج الملف تواصلًا خارجيًا؛ الحفظ لا يرسل شيئًا." /> : data.communications.map((communication: any) => { const meta = communicationStatusMeta[communication.communicationStatus] || communicationStatusMeta.archived; return <Card key={communication.id} className="rounded-2xl border-sky-100 bg-white p-4 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><div className="mb-2 flex flex-wrap items-center gap-2"><Badge variant="outline" className={`rounded-full ${meta.className}`}>{meta.label}</Badge><Badge variant="outline" className="rounded-full bg-white">{communicationChannelLabel[communication.channel as CommunicationChannel]}</Badge>{communication.direction === "inbound" ? <Badge variant="outline" className="rounded-full border-sky-100 bg-white text-sky-700">وارد</Badge> : null}</div><h4 className="font-black leading-6 text-slate-900">{communication.subject}</h4>{communication.toText ? <p className="mt-1 text-[11px] text-slate-500">إلى: <bdi dir="ltr">{communication.toText}</bdi></p> : null}{communication.fromText ? <p className="mt-1 text-[11px] text-slate-500">من: <bdi dir="ltr">{communication.fromText}</bdi></p> : null}<p className="mt-2 max-h-28 overflow-hidden whitespace-pre-wrap text-xs leading-6 text-slate-600">{communication.body}</p>{communication.reviewNote ? <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs leading-6 text-amber-900"><span className="font-bold">ملاحظة المراجعة:</span> {communication.reviewNote}</div> : null}{communication.evidenceReference ? <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs leading-6 text-emerald-900"><span className="font-bold">دليل الإرسال:</span> {communication.evidenceReference}</div> : null}</div>{!isClosed ? <CommunicationControls communication={communication} onUpdated={onChanged} /> : null}</div><div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-[10px] text-slate-400"><bdi dir="ltr">{formatDateTime(communication.occurredAt)}</bdi>{communication.externalMessageRef ? <bdi dir="ltr">{communication.externalMessageRef}</bdi> : null}</div></Card>; })}</div>
            </section>
            <section>
              <div className="mb-3 flex items-center justify-between"><div><h3 className="text-base font-black text-slate-900">الإجراءات</h3><p className="text-xs text-slate-500">لا يعتبر الإجراء منتهيًا قبل التحقق من دليله.</p></div>{!isClosed ? <NewActionDialog workFileId={data.workFile.id} onCreated={onChanged} /> : null}</div>
              <div className="space-y-3">{data.actions.length === 0 ? <EmptyState title="لا توجد إجراءات بعد" description="أضف الإجراء الحقيقي التالي حتى يظهر في قائمة اليوم." /> : data.actions.map((action: any) => <Card key={action.id} className="rounded-2xl border-slate-200 bg-white p-4 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><div className="mb-2 flex flex-wrap items-center gap-2"><StatusBadge status={action.actionStatus} /><OwnerChip ownerType={action.ownerType} /><PriorityBadge priority={action.priority} /></div><h4 className="font-bold leading-6 text-slate-900">{action.title}</h4>{action.description ? <p className="mt-2 text-xs leading-6 text-slate-600">{action.description}</p> : null}<p className="mt-2 text-xs leading-6 text-slate-500"><span className="font-bold">معيار القبول:</span> {action.acceptanceCriteria}</p>{action.evidenceReference ? <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs leading-6 text-emerald-900"><span className="font-bold">دليل التحقق:</span> {action.evidenceReference}</div> : null}</div>{!isClosed ? <ActionStatusDialog action={action} onUpdated={onChanged} /> : null}</div>{action.attentionAt ? <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500"><CalendarClock className="h-3.5 w-3.5" /><bdi dir="ltr">{formatDateTime(action.attentionAt)}</bdi></div> : null}</Card>)}</div>
            </section>
            <WorkFileMeetingsSection workFileId={data.workFile.id} meetings={data.meetings} isClosed={isClosed} onUpdated={onChanged} />
            {data.memory.length ? <section><div className="mb-3 flex items-center justify-between gap-3"><div className="flex items-center gap-2"><BookOpenCheck className="h-5 w-5 text-[#1e6478]" /><div><h3 className="text-base font-black text-slate-900">ذاكرة الملف</h3><p className="text-xs text-slate-500">المواد والتحليلات والقرارات السابقة بعد ربطها بسياقها الصحيح.</p></div></div><Badge variant="outline" className="rounded-full bg-white">{data.memory.length}</Badge></div><div className="space-y-3">{(showAllMemory ? data.memory : data.memory.slice(0, 8)).map((entry: any) => <Card key={entry.id} className="rounded-2xl border-slate-200 bg-white p-4 shadow-sm"><div className="flex gap-3"><div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${entry.memoryType === "decision" ? "bg-amber-50 text-amber-700" : entry.memoryType === "work_product" ? "bg-violet-50 text-violet-700" : "bg-slate-100 text-slate-600"}`}>{entry.memoryType === "decision" ? <CheckCheck className="h-4 w-4" /> : entry.memoryType === "work_product" ? <FileText className="h-4 w-4" /> : <MessagesSquare className="h-4 w-4" />}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h4 className="font-bold leading-6 text-slate-900">{entry.title}</h4>{entry.sourceFileName ? <Paperclip className="h-3.5 w-3.5 text-slate-400" /> : null}</div>{entry.body ? <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-xs leading-6 text-slate-600">{entry.body}</p> : null}{entry.documents?.length ? <div className="mt-3 space-y-2">{entry.documents.map((document: any) => <a key={document.id} href={document.downloadPath} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 rounded-xl border border-[#cfe3df] bg-[#f1f8f6] px-3 py-2 text-[11px] font-bold text-[#18596a] transition hover:bg-[#e5f2ef]"><span className="min-w-0 truncate">{document.fileName}</span><span className="shrink-0">فتح الملف</span></a>)}</div> : entry.sourceFileName ? <p className="mt-2 truncate text-[11px] font-semibold text-slate-500">مرجع محفوظ: {entry.sourceFileName}</p> : null}<p className="mt-2 text-[10px] text-slate-400"><bdi dir="ltr">{formatDateTime(entry.occurredAt)}</bdi></p></div></div></Card>)}</div>{data.memory.length > 8 ? <Button variant="outline" onClick={() => setShowAllMemory(value => !value)} className="mt-3 w-full rounded-xl bg-white">{showAllMemory ? "عرض المختصر" : `عرض جميع عناصر الذاكرة (${data.memory.length})`}</Button> : null}</section> : null}
            <section><h3 className="mb-3 text-base font-black text-slate-900">سجل الملف</h3><div className="space-y-3">{data.events.map((event: any) => <div key={event.id} className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-4"><div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500"><CircleDot className="h-4 w-4" /></div><div><p className="text-sm font-semibold leading-6 text-slate-800">{event.summary}</p><p className="mt-1 text-[11px] text-slate-400"><bdi dir="ltr">{formatDateTime(event.occurredAt)}</bdi></p></div></div>)}</div></section>
            <div className="grid gap-3 sm:grid-cols-3">
              {!isClosed ? <CloseWorkFileDialog workFileId={data.workFile.id} disabled={hasOpenActions || hasPendingDecisions || hasPendingCommunications || hasPendingMeetings} onClosed={async () => { await onChanged(); onOpenChange(false); }} /> : <div className="flex min-h-11 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-bold text-emerald-800"><CheckCheck className="ms-2 h-4 w-4" />الملف مغلق بدليل</div>}
              <Button onClick={() => navigate(`/como-next/projects/${data.workFile.projectId}`)} className="rounded-xl bg-[#1e6478] text-white hover:bg-[#18566a]"><FolderOpen className="ms-2 h-4 w-4" />ملف المشروع الموحد</Button>
              <Button variant="outline" onClick={() => navigate(`/project/${data.workFile.projectId}`)} className="rounded-xl bg-white"><Building2 className="ms-2 h-4 w-4" />فتح بطاقة المشروع الأصلية</Button>
            </div>
          </div>
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
  const requestedWorkFileId = Number(requestParams?.get("workFileId") || 0);
  const initialTab: ExecutiveTab = requestedWorkFileId > 0 ? "work-files" : requestedTab === "work-files" || requestedTab === "email" || requestedTab === "transfer" ? requestedTab : "today";
  const [activeTab, setActiveTab] = useState<ExecutiveTab>(initialTab);
  const [selectedWorkFileId, setSelectedWorkFileId] = useState<number | null>(requestedWorkFileId > 0 ? requestedWorkFileId : null);
  const utils = trpc.useUtils();
  const overviewQuery = trpc.comoNext.getOverview.useQuery(undefined, { enabled: isAuthenticated, refetchInterval: 60_000 });
  const projectsQuery = trpc.comoNext.listProjects.useQuery(undefined, { enabled: isAuthenticated, staleTime: 60_000 });
  const importReviewQuery = trpc.comoNext.getImportReview.useQuery(undefined, { enabled: isAuthenticated && user?.role === "admin", staleTime: 60_000 });
  const data = overviewQuery.data;

  const updateTab = (value: string) => {
    const next = value as ExecutiveTab;
    setActiveTab(next);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", next);
    window.history.replaceState({}, "", `${url.pathname}${url.search}`);
  };

  const refresh = async () => {
    await Promise.all([utils.comoNext.getOverview.invalidate(), selectedWorkFileId ? utils.comoNext.getWorkFile.invalidate({ workFileId: selectedWorkFileId }) : Promise.resolve()]);
  };

  const openWorkFile = (id: number) => setSelectedWorkFileId(id);
  const todaySections = useMemo(() => data ? [
    { key: "waitingExternal", title: "بانتظار أطراف خارجية", description: "ردود أو مستندات يجب متابعتها", icon: Clock3, items: data.today.sections.waitingExternal, accent: "text-amber-700 bg-amber-50" },
    { key: "mine", title: "عليّ اليوم", description: "الإجراءات التي تتطلب تدخلك", icon: UserRound, items: data.today.sections.mine, accent: "text-slate-800 bg-slate-100" },
    { key: "manus", title: "لدى Manus", description: "أعمال تحليل أو إعداد مسجلة باسمه", icon: Bot, items: data.today.sections.manus, accent: "text-violet-800 bg-violet-50" },
    { key: "team", title: "لدى الفريق", description: "التزامات داخلية مستحقة", icon: UsersRound, items: data.today.sections.team, accent: "text-cyan-800 bg-cyan-50" },
  ] : [], [data]);

  if (loading) return <PageSkeleton />;
  if (!isAuthenticated || !user) {
    return <div dir="rtl" className="flex min-h-screen items-center justify-center bg-[#f7f7f3] p-6"><Card className="w-full max-w-md rounded-3xl border-slate-200 bg-white p-8 text-center shadow-xl"><div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#16243b] text-white"><BriefcaseBusiness className="h-7 w-7" /></div><h1 className="text-xl font-black">المكتب التنفيذي</h1><p className="mt-2 text-sm leading-6 text-slate-500">سجّل الدخول للوصول إلى ملفات العمل والمتابعات الخاصة بك.</p><Button onClick={() => { window.location.href = getLoginUrl(); }} className="mt-6 w-full rounded-xl bg-[#16243b] hover:bg-[#203554]"><LogIn className="ms-2 h-4 w-4" />تسجيل الدخول</Button></Card></div>;
  }

  return (
    <div dir="rtl" className="como-next-workspace min-h-screen bg-[#f6f6f2] text-slate-900">
      <header className="relative overflow-hidden bg-[#14243a] text-white">
        <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "radial-gradient(circle at 15% 20%, #4da9a0 0, transparent 25%), radial-gradient(circle at 85% 0%, #d3aa69 0, transparent 24%)" }} />
        <div className="relative mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div><button onClick={() => navigate("/")} className="mb-6 inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 text-sm text-slate-200 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"><ArrowLeft className="h-4 w-4" />الصفحة الرئيسية</button><div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20"><BriefcaseBusiness className="h-6 w-6 text-[#9dd5ca]" /></div><div><p className="text-xs font-bold tracking-[0.18em] text-[#9dd5ca]">COMO NEXT</p><h1 className="mt-1 text-2xl font-black sm:text-3xl">المكتب التنفيذي</h1></div></div><p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">ما يحتاج انتباهك اليوم، وملفات العمل التي تقود القرار والتنفيذ. Manus هو العقل التنفيذي عند تكليفه؛ ولا توجد نتائج مصطنعة أو إجراءات تلقائية.</p></div>
            <NewWorkFileDialog projects={projectsQuery.data || []} onCreated={async id => { await refresh(); setSelectedWorkFileId(id); }} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
        {overviewQuery.isLoading ? <PageSkeleton /> : overviewQuery.isError ? <EmptyState title="تعذر تحميل المكتب التنفيذي" description={overviewQuery.error.message} action={<Button variant="outline" onClick={() => overviewQuery.refetch()} className="rounded-xl bg-white">إعادة المحاولة</Button>} /> : data ? <Tabs value={activeTab} onValueChange={updateTab}>
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <TabsList className={`grid h-12 w-full ${user.role === "admin" ? "grid-cols-4 sm:w-[720px]" : "grid-cols-2 sm:w-[360px]"} rounded-2xl bg-white p-1 shadow-sm ring-1 ring-slate-200`}><TabsTrigger value="today" className="rounded-xl font-bold data-[state=active]:bg-[#16243b] data-[state=active]:text-white"><CalendarClock className="ms-2 h-4 w-4" />اليوم</TabsTrigger><TabsTrigger value="work-files" className="rounded-xl font-bold data-[state=active]:bg-[#16243b] data-[state=active]:text-white"><FileStack className="ms-2 h-4 w-4" />ملفات العمل</TabsTrigger>{user.role === "admin" ? <TabsTrigger value="email" className="rounded-xl font-bold data-[state=active]:bg-[#16243b] data-[state=active]:text-white"><Inbox className="ms-2 h-4 w-4" />البريد</TabsTrigger> : null}{user.role === "admin" ? <TabsTrigger value="transfer" className="rounded-xl font-bold data-[state=active]:bg-[#16243b] data-[state=active]:text-white"><Database className="ms-2 h-4 w-4" />منطقة النقل</TabsTrigger> : null}</TabsList>
            <p className="text-xs text-slate-500">آخر قراءة <bdi dir="ltr">{formatDateTime(data.today.generatedAt)}</bdi> · توقيت دبي</p>
          </div>

          <TabsContent value="today" className="mt-0 space-y-6">
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Card className="rounded-3xl border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div><p className="text-xs font-bold text-slate-400">مستحق اليوم</p><p className="mt-2 text-3xl font-black text-slate-900"><bdi>{data.today.summary.dueToday}</bdi></p></div><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700"><CalendarClock className="h-6 w-6" /></div></div></Card>
              <Card className="rounded-3xl border-rose-100 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div><p className="text-xs font-bold text-slate-400">متأخر</p><p className="mt-2 text-3xl font-black text-rose-700"><bdi>{data.today.summary.overdue}</bdi></p></div><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-700"><AlertCircle className="h-6 w-6" /></div></div></Card>
              <Card className="rounded-3xl border-rose-100 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div><p className="text-xs font-bold text-slate-400">قرارات مطلوبة</p><p className="mt-2 text-3xl font-black text-rose-700"><bdi>{data.decisions.length}</bdi></p></div><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-700"><Scale className="h-6 w-6" /></div></div></Card>
              <Card className="rounded-3xl border-sky-100 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div><p className="text-xs font-bold text-slate-400">مسودات للمراجعة</p><p className="mt-2 text-3xl font-black text-sky-700"><bdi>{data.draftCommunications.length}</bdi></p></div><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-sky-700"><Mail className="h-6 w-6" /></div></div></Card>
              <Card className="rounded-3xl border-teal-100 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div><p className="text-xs font-bold text-slate-400">اجتماعات تحتاج انتباهًا</p><p className="mt-2 text-3xl font-black text-teal-700"><bdi>{data.meetingAttention.length}</bdi></p></div><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-700"><CalendarDays className="h-6 w-6" /></div></div></Card>
              <Card className="rounded-3xl border-amber-100 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div><p className="text-xs font-bold text-slate-400">بانتظار الخارج</p><p className="mt-2 text-3xl font-black text-amber-700"><bdi>{data.today.summary.waitingExternal}</bdi></p></div><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700"><Clock3 className="h-6 w-6" /></div></div></Card>
              <Card className="rounded-3xl border-violet-100 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div><p className="text-xs font-bold text-slate-400">لدى Manus</p><p className="mt-2 text-3xl font-black text-violet-700"><bdi>{data.today.summary.manus}</bdi></p></div><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-700"><Sparkles className="h-6 w-6" /></div></div></Card>
              <Card className="rounded-3xl border-amber-100 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div><p className="text-xs font-bold text-slate-400">بريد يحتاج مراجعة</p><p className="mt-2 text-3xl font-black text-amber-700"><bdi>{data.emailAttention.length}</bdi></p></div><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700"><Inbox className="h-6 w-6" /></div></div></Card>
            </section>

            {data.emailAttention.length ? <Card className="rounded-3xl border-amber-100 bg-[#fffdf7] p-5 shadow-sm"><div className="mb-4 flex items-center justify-between"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-50 text-amber-700"><Inbox className="h-5 w-5" /></div><div><h2 className="text-base font-black text-slate-900">بريد وارد يحتاج مراجعتك</h2><p className="text-xs text-slate-500">سارة تعرض التنبيه؛ الربط أو تكليف Manus أو إنشاء مسودة يحتاج اختيارك.</p></div></div><Button variant="ghost" onClick={() => updateTab("email")} className="rounded-xl text-amber-800">فتح الصندوق<ChevronLeft className="me-1 h-4 w-4" /></Button></div><div className="grid gap-3 lg:grid-cols-2">{data.emailAttention.slice(0, 4).map((item: any) => <button key={item.id} type="button" onClick={() => updateTab("email")} className="rounded-2xl border border-amber-100 bg-white p-4 text-right transition hover:border-amber-300"><p className="line-clamp-1 text-sm font-black text-slate-900">{item.subject}</p><p className="mt-2 text-xs text-slate-500">{item.fromName || item.fromEmail} · {formatDateTime(item.receivedAt)}</p></button>)}</div></Card> : null}

            {data.decisions.length ? <Card className="rounded-3xl border-rose-100 bg-[#fffafa] p-5 shadow-sm"><div className="mb-4 flex items-center justify-between"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-50 text-rose-700"><Scale className="h-5 w-5" /></div><div><h2 className="text-base font-black text-slate-900">قرارات تنتظر الحسم</h2><p className="text-xs text-slate-500">لا تتحول إلى إجراء خارجي قبل تسجيل القرار وسلطته.</p></div></div><Badge variant="outline" className="rounded-full border-rose-200 bg-white text-rose-700"><bdi>{data.decisions.length}</bdi></Badge></div><div className="grid gap-3 lg:grid-cols-2">{data.decisions.map((item: any) => <TodayDecisionCard key={item.id} item={item} onOpen={openWorkFile} />)}</div></Card> : null}

            {data.draftCommunications.length ? <Card className="rounded-3xl border-sky-100 bg-[#f8fcfd] p-5 shadow-sm"><div className="mb-4 flex items-center justify-between"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-50 text-sky-700"><SendHorizontal className="h-5 w-5" /></div><div><h2 className="text-base font-black text-slate-900">مراسلات تنتظر المراجعة</h2><p className="text-xs text-slate-500">المسودة لا تُرسل. بعد اعتمادها يبقى تسجيل دليل الإرسال خطوة منفصلة.</p></div></div><Badge variant="outline" className="rounded-full border-sky-200 bg-white text-sky-700"><bdi>{data.draftCommunications.length}</bdi></Badge></div><div className="grid gap-3 lg:grid-cols-2">{data.draftCommunications.map((item: any) => <TodayCommunicationCard key={item.id} item={item} onOpen={openWorkFile} />)}</div></Card> : null}

            {data.meetingAttention.length ? <Card className="rounded-3xl border-teal-100 bg-[#f6fbfa] p-5 shadow-sm"><div className="mb-4 flex items-center justify-between"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-50 text-teal-700"><CalendarDays className="h-5 w-5" /></div><div><h2 className="text-base font-black text-slate-900">غرف اجتماعات تحتاج انتباهك</h2><p className="text-xs text-slate-500">تحضير أو مقترحات Manus أو مسودة محضر تنتظر مراجعة واضحة.</p></div></div><Badge variant="outline" className="rounded-full border-teal-200 bg-white text-teal-700"><bdi>{data.meetingAttention.length}</bdi></Badge></div><div className="grid gap-3 lg:grid-cols-2">{data.meetingAttention.map((item: any) => <TodayMeetingCard key={item.id} item={item} onOpen={openWorkFile} />)}</div></Card> : null}

            {data.today.summary.dueToday === 0 && data.decisions.length === 0 && data.draftCommunications.length === 0 && data.meetingAttention.length === 0 && data.emailAttention.length === 0 ? <EmptyState title="لا توجد متابعة أو قرارات أو مسودات أو اجتماعات أو رسائل مستحقة اليوم" description="اليوم هادئ. الملفات النشطة ظاهرة أدناه، ويمكنك فتح أي ملف وإضافة الإجراء أو القرار التالي." action={<Button variant="outline" onClick={() => updateTab("work-files")} className="rounded-xl bg-white">عرض ملفات العمل</Button>} /> : <section className="grid gap-5 lg:grid-cols-2">{todaySections.filter(section => section.items.length > 0).map(section => { const Icon = section.icon; return <Card key={section.key} className="rounded-3xl border-slate-200 bg-[#fbfbf8] p-5 shadow-sm"><div className="mb-4 flex items-center justify-between"><div className="flex items-center gap-3"><div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${section.accent}`}><Icon className="h-5 w-5" /></div><div><h2 className="text-base font-black text-slate-900">{section.title}</h2><p className="text-xs text-slate-500">{section.description}</p></div></div><Badge variant="outline" className="rounded-full bg-white"><bdi>{section.items.length}</bdi></Badge></div><div className="space-y-3">{section.items.map((item: any) => <TodayActionCard key={item.id} item={item} onOpen={openWorkFile} />)}</div></Card>; })}</section>}

            <section><div className="mb-4 flex items-end justify-between"><div><h2 className="text-lg font-black">نبض ملفات العمل</h2><p className="mt-1 text-sm text-slate-500">أهم الملفات النشطة وما الذي ينتظرها.</p></div><Button variant="ghost" onClick={() => updateTab("work-files")} className="rounded-xl text-[#1e6478]">عرض الكل<ChevronLeft className="me-1 h-4 w-4" /></Button></div>{data.workFiles.length === 0 ? <EmptyState title="لم تفتح ملفات عمل بعد" description="ابدأ بموضوع حقيقي له سؤال حاكم ونتيجة مطلوبة، ثم أضف إجراءه التالي." action={<NewWorkFileDialog projects={projectsQuery.data || []} onCreated={async id => { await refresh(); openWorkFile(id); }} />} /> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{data.workFiles.slice(0, 3).map((file: any) => <WorkFileCard key={file.id} file={file} onOpen={openWorkFile} />)}</div>}</section>
          </TabsContent>

          <TabsContent value="work-files" className="mt-0 space-y-8">
            <section><div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[11px] font-black text-[#1e6478]">الإدارة من مستوى المشروع</p><h2 className="text-xl font-black">الملفات التنفيذية للمشاريع</h2><p className="mt-1 text-sm leading-6 text-slate-500">كل مشروع يجمع ذاكرته وملفات عمله وقراراته ومراسلاته واجتماعاته في مكان واحد.</p></div><div className="flex items-center gap-2 text-xs text-slate-500"><FolderOpen className="h-4 w-4" /><bdi>{projectsQuery.data?.length || 0}</bdi> مشروع</div></div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{(projectsQuery.data || []).map(project => { const activeCount = data.workFiles.filter((file: any) => file.projectId === project.id).length; return <button key={project.id} type="button" onClick={() => navigate(`/como-next/projects/${project.id}`)} className="group relative overflow-hidden rounded-[26px] border border-slate-200 bg-white p-5 text-right shadow-sm transition hover:-translate-y-1 hover:border-[#8fb7c2] hover:shadow-xl"><div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-l from-[#173d4b] via-[#55a696] to-[#d5aa68]" /><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-black text-[#1e6478]">ملف المشروع الموحد</p><h3 className="mt-2 text-base font-black leading-7 text-slate-900">{project.name}</h3><p className="mt-1 text-xs text-slate-500">{project.plotNumber ? `قطعة ${project.plotNumber}` : "مرجع المشروع الرسمي"}</p></div><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#eaf4f3] text-[#1e6478]"><FolderOpen className="h-5 w-5" /></div></div><div className="mt-5 flex items-center justify-between rounded-2xl bg-[#f7f8f6] px-4 py-3"><span className="text-xs font-semibold text-slate-600">{activeCount ? `${activeCount} ملفات عمل نشطة` : "لا توجد ملفات نشطة"}</span><ChevronLeft className="h-4 w-4 text-[#1e6478] transition group-hover:-translate-x-1" /></div></button>; })}</div>
            </section>
            <section><div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-xl font-black">ملفات العمل النشطة</h2><p className="mt-1 text-sm leading-6 text-slate-500">كل ملف يبدأ بسؤال، وينتهي بدليل، وبينهما إجراءات ومسؤوليات واضحة.</p></div><div className="flex items-center gap-2 text-xs text-slate-500"><BriefcaseBusiness className="h-4 w-4" /><bdi>{data.workFiles.length}</bdi> ملف نشط</div></div>
              {data.workFiles.length === 0 ? <EmptyState title="لا توجد ملفات عمل" description="افتح أول ملف من زر «فتح ملف عمل» في أعلى الصفحة." /> : <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{data.workFiles.map((file: any) => <WorkFileCard key={file.id} file={file} onOpen={openWorkFile} />)}</div>}
            </section>
          </TabsContent>

          {user.role === "admin" ? <TabsContent value="email" className="mt-0">
            <ComoNextEmailInbox onOverviewChanged={async () => { await utils.comoNext.getOverview.invalidate(); }} />
          </TabsContent> : null}

          {user.role === "admin" ? <TabsContent value="transfer" className="mt-0">
            <ImportReviewPanel data={importReviewQuery.data} isLoading={importReviewQuery.isLoading} error={importReviewQuery.error?.message} />
          </TabsContent> : null}
        </Tabs> : null}
      </main>

      <WorkFileSheet workFileId={selectedWorkFileId} open={selectedWorkFileId !== null} onOpenChange={open => { if (!open) setSelectedWorkFileId(null); }} onChanged={refresh} />
    </div>
  );
}
