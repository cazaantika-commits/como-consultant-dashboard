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
import {
  AlertCircle,
  ArrowLeft,
  Bot,
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  Check,
  CheckCheck,
  ChevronLeft,
  CirclePause,
  CircleDot,
  Clock3,
  FileStack,
  FolderOpen,
  LockKeyhole,
  Loader2,
  LogIn,
  Plus,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  UserRound,
  UsersRound,
} from "lucide-react";

type ExecutiveTab = "today" | "work-files";
type Priority = "normal" | "important" | "urgent";
type OwnerType = "human" | "manus" | "team";
type ActionStatus = "open" | "in_progress" | "waiting_external" | "completed_pending_verification" | "verified" | "cancelled";

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
  const data = detailQuery.data;
  const hasOpenActions = data?.actions.some((action: any) => !["verified", "cancelled"].includes(action.actionStatus)) ?? false;
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
            <section>
              <div className="mb-3 flex items-center justify-between"><div><h3 className="text-base font-black text-slate-900">الإجراءات</h3><p className="text-xs text-slate-500">لا يعتبر الإجراء منتهيًا قبل التحقق من دليله.</p></div>{!isClosed ? <NewActionDialog workFileId={data.workFile.id} onCreated={onChanged} /> : null}</div>
              <div className="space-y-3">{data.actions.length === 0 ? <EmptyState title="لا توجد إجراءات بعد" description="أضف الإجراء الحقيقي التالي حتى يظهر في قائمة اليوم." /> : data.actions.map((action: any) => <Card key={action.id} className="rounded-2xl border-slate-200 bg-white p-4 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><div className="mb-2 flex flex-wrap items-center gap-2"><StatusBadge status={action.actionStatus} /><OwnerChip ownerType={action.ownerType} /><PriorityBadge priority={action.priority} /></div><h4 className="font-bold leading-6 text-slate-900">{action.title}</h4>{action.description ? <p className="mt-2 text-xs leading-6 text-slate-600">{action.description}</p> : null}<p className="mt-2 text-xs leading-6 text-slate-500"><span className="font-bold">معيار القبول:</span> {action.acceptanceCriteria}</p>{action.evidenceReference ? <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs leading-6 text-emerald-900"><span className="font-bold">دليل التحقق:</span> {action.evidenceReference}</div> : null}</div>{!isClosed ? <ActionStatusDialog action={action} onUpdated={onChanged} /> : null}</div>{action.attentionAt ? <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500"><CalendarClock className="h-3.5 w-3.5" /><bdi dir="ltr">{formatDateTime(action.attentionAt)}</bdi></div> : null}</Card>)}</div>
            </section>
            <section><h3 className="mb-3 text-base font-black text-slate-900">سجل الملف</h3><div className="space-y-3">{data.events.map((event: any) => <div key={event.id} className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-4"><div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500"><CircleDot className="h-4 w-4" /></div><div><p className="text-sm font-semibold leading-6 text-slate-800">{event.summary}</p><p className="mt-1 text-[11px] text-slate-400"><bdi dir="ltr">{formatDateTime(event.occurredAt)}</bdi></p></div></div>)}</div></section>
            <div className="grid gap-3 sm:grid-cols-2">
              {!isClosed ? <CloseWorkFileDialog workFileId={data.workFile.id} disabled={hasOpenActions} onClosed={async () => { await onChanged(); onOpenChange(false); }} /> : <div className="flex min-h-11 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-bold text-emerald-800"><CheckCheck className="ms-2 h-4 w-4" />الملف مغلق بدليل</div>}
              <Button variant="outline" onClick={() => navigate(`/project/${data.workFile.projectId}`)} className="rounded-xl bg-white"><Building2 className="ms-2 h-4 w-4" />فتح بطاقة المشروع الأصلية</Button>
            </div>
          </div>
        </> : null}
      </SheetContent>
    </Sheet>
  );
}

export default function ComoNextTodayPage() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const initialTab = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("tab") === "work-files" ? "work-files" : "today";
  const [activeTab, setActiveTab] = useState<ExecutiveTab>(initialTab);
  const [selectedWorkFileId, setSelectedWorkFileId] = useState<number | null>(null);
  const utils = trpc.useUtils();
  const overviewQuery = trpc.comoNext.getOverview.useQuery(undefined, { enabled: isAuthenticated, refetchInterval: 60_000 });
  const projectsQuery = trpc.comoNext.listProjects.useQuery(undefined, { enabled: isAuthenticated, staleTime: 60_000 });
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
            <TabsList className="grid h-12 w-full grid-cols-2 rounded-2xl bg-white p-1 shadow-sm ring-1 ring-slate-200 sm:w-[360px]"><TabsTrigger value="today" className="rounded-xl font-bold data-[state=active]:bg-[#16243b] data-[state=active]:text-white"><CalendarClock className="ms-2 h-4 w-4" />اليوم</TabsTrigger><TabsTrigger value="work-files" className="rounded-xl font-bold data-[state=active]:bg-[#16243b] data-[state=active]:text-white"><FileStack className="ms-2 h-4 w-4" />ملفات العمل</TabsTrigger></TabsList>
            <p className="text-xs text-slate-500">آخر قراءة <bdi dir="ltr">{formatDateTime(data.today.generatedAt)}</bdi> · توقيت دبي</p>
          </div>

          <TabsContent value="today" className="mt-0 space-y-6">
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Card className="rounded-3xl border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div><p className="text-xs font-bold text-slate-400">مستحق اليوم</p><p className="mt-2 text-3xl font-black text-slate-900"><bdi>{data.today.summary.dueToday}</bdi></p></div><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700"><CalendarClock className="h-6 w-6" /></div></div></Card>
              <Card className="rounded-3xl border-rose-100 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div><p className="text-xs font-bold text-slate-400">متأخر</p><p className="mt-2 text-3xl font-black text-rose-700"><bdi>{data.today.summary.overdue}</bdi></p></div><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-700"><AlertCircle className="h-6 w-6" /></div></div></Card>
              <Card className="rounded-3xl border-amber-100 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div><p className="text-xs font-bold text-slate-400">بانتظار الخارج</p><p className="mt-2 text-3xl font-black text-amber-700"><bdi>{data.today.summary.waitingExternal}</bdi></p></div><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700"><Clock3 className="h-6 w-6" /></div></div></Card>
              <Card className="rounded-3xl border-violet-100 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div><p className="text-xs font-bold text-slate-400">لدى Manus</p><p className="mt-2 text-3xl font-black text-violet-700"><bdi>{data.today.summary.manus}</bdi></p></div><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-700"><Sparkles className="h-6 w-6" /></div></div></Card>
            </section>

            {data.today.summary.dueToday === 0 ? <EmptyState title="لا توجد متابعة مستحقة اليوم" description="اليوم هادئ. الملفات النشطة ظاهرة أدناه، ويمكنك فتح أي ملف وإضافة الإجراء التالي بموعد واضح." action={<Button variant="outline" onClick={() => updateTab("work-files")} className="rounded-xl bg-white">عرض ملفات العمل</Button>} /> : <section className="grid gap-5 lg:grid-cols-2">{todaySections.filter(section => section.items.length > 0).map(section => { const Icon = section.icon; return <Card key={section.key} className="rounded-3xl border-slate-200 bg-[#fbfbf8] p-5 shadow-sm"><div className="mb-4 flex items-center justify-between"><div className="flex items-center gap-3"><div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${section.accent}`}><Icon className="h-5 w-5" /></div><div><h2 className="text-base font-black text-slate-900">{section.title}</h2><p className="text-xs text-slate-500">{section.description}</p></div></div><Badge variant="outline" className="rounded-full bg-white"><bdi>{section.items.length}</bdi></Badge></div><div className="space-y-3">{section.items.map((item: any) => <TodayActionCard key={item.id} item={item} onOpen={openWorkFile} />)}</div></Card>; })}</section>}

            <section><div className="mb-4 flex items-end justify-between"><div><h2 className="text-lg font-black">نبض ملفات العمل</h2><p className="mt-1 text-sm text-slate-500">أهم الملفات النشطة وما الذي ينتظرها.</p></div><Button variant="ghost" onClick={() => updateTab("work-files")} className="rounded-xl text-[#1e6478]">عرض الكل<ChevronLeft className="me-1 h-4 w-4" /></Button></div>{data.workFiles.length === 0 ? <EmptyState title="لم تفتح ملفات عمل بعد" description="ابدأ بموضوع حقيقي له سؤال حاكم ونتيجة مطلوبة، ثم أضف إجراءه التالي." action={<NewWorkFileDialog projects={projectsQuery.data || []} onCreated={async id => { await refresh(); openWorkFile(id); }} />} /> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{data.workFiles.slice(0, 3).map((file: any) => <WorkFileCard key={file.id} file={file} onOpen={openWorkFile} />)}</div>}</section>
          </TabsContent>

          <TabsContent value="work-files" className="mt-0">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-xl font-black">ملفات العمل النشطة</h2><p className="mt-1 text-sm leading-6 text-slate-500">كل ملف يبدأ بسؤال، وينتهي بدليل، وبينهما إجراءات ومسؤوليات واضحة.</p></div><div className="flex items-center gap-2 text-xs text-slate-500"><BriefcaseBusiness className="h-4 w-4" /><bdi>{data.workFiles.length}</bdi> ملف نشط</div></div>
            {data.workFiles.length === 0 ? <EmptyState title="لا توجد ملفات عمل" description="افتح أول ملف من زر «فتح ملف عمل» في أعلى الصفحة." /> : <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{data.workFiles.map((file: any) => <WorkFileCard key={file.id} file={file} onOpen={openWorkFile} />)}</div>}
          </TabsContent>
        </Tabs> : null}
      </main>

      <WorkFileSheet workFileId={selectedWorkFileId} open={selectedWorkFileId !== null} onOpenChange={open => { if (!open) setSelectedWorkFileId(null); }} onChanged={refresh} />
    </div>
  );
}
