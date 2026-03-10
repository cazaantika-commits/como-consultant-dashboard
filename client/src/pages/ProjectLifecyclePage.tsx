import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { StageDataTab } from "@/components/lifecycle/StageDataTab";
import { StageDocumentsTab } from "@/components/lifecycle/StageDocumentsTab";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft, Clock, CheckCircle2, Lock, AlertCircle, Circle, FileText, Database,
  ChevronRight, CalendarDays, Users, Building2, AlertTriangle, Timer, TrendingUp,
  Edit3, Save, X, Bell, BellRing, RefreshCw
} from "lucide-react";
import { toast } from "sonner";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
type StageStatus = "not_started" | "in_progress" | "completed" | "locked";
type ServiceOpStatus = "not_started" | "in_progress" | "completed" | "locked" | "submitted";

// ─────────────────────────────────────────────────────────────
// Delay / time status helpers
// ─────────────────────────────────────────────────────────────
function computeTimeAlert(plannedDueDate: string | null | undefined): {
  label: string;
  severity: "overdue" | "urgent" | "soon" | "ok" | "none";
} {
  if (!plannedDueDate) return { label: "", severity: "none" };
  const parts = plannedDueDate.split("-").map(Number);
  // Support both DD-MM-YYYY and YYYY-MM-DD
  let dueDate: Date;
  if (parts[0] > 31) {
    dueDate = new Date(parts[0], parts[1] - 1, parts[2]);
  } else {
    dueDate = new Date(parts[2], parts[1] - 1, parts[0]);
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { label: `متأخرة ${Math.abs(diffDays)} يوم`, severity: "overdue" };
  if (diffDays === 0) return { label: "تستحق اليوم", severity: "urgent" };
  if (diffDays <= 7) return { label: `متبقي ${diffDays} أيام`, severity: "urgent" };
  if (diffDays <= 30) return { label: `متبقي ${diffDays} يوم`, severity: "soon" };
  return { label: `متبقي ${diffDays} يوم`, severity: "ok" };
}

function timeAlertStyle(severity: string) {
  if (severity === "overdue") return "text-red-600 bg-red-50 border-red-200";
  if (severity === "urgent") return "text-orange-600 bg-orange-50 border-orange-200";
  if (severity === "soon") return "text-amber-600 bg-amber-50 border-amber-200";
  return "text-muted-foreground";
}

function timeAlertIcon(severity: string) {
  if (severity === "overdue") return <AlertTriangle className="w-3 h-3" />;
  if (severity === "urgent") return <Timer className="w-3 h-3" />;
  return <Clock className="w-3 h-3" />;
}

// ─────────────────────────────────────────────────────────────
// Status helpers
// ─────────────────────────────────────────────────────────────
function stageStatusLabel(s: StageStatus) {
  const map: Record<StageStatus, string> = {
    not_started: "لم تبدأ", in_progress: "جاري التنفيذ",
    completed: "مكتملة", locked: "مقفلة",
  };
  return map[s] ?? s;
}

function stageStatusBadge(s: StageStatus) {
  const map: Record<StageStatus, string> = {
    not_started: "bg-gray-100 text-gray-600 border-gray-200",
    in_progress: "bg-blue-100 text-blue-700 border-blue-200",
    completed: "bg-emerald-100 text-emerald-700 border-emerald-200",
    locked: "bg-slate-100 text-slate-500 border-slate-200",
  };
  return map[s] ?? "bg-gray-100 text-gray-600";
}

function serviceStatusIcon(s: ServiceOpStatus) {
  if (s === "completed") return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
  if (s === "submitted") return <CheckCircle2 className="w-5 h-5 text-blue-500" />;
  if (s === "locked") return <Lock className="w-5 h-5 text-slate-400" />;
  if (s === "in_progress") return <AlertCircle className="w-5 h-5 text-amber-500" />;
  return <Circle className="w-5 h-5 text-gray-300" />;
}

function serviceStatusLabel(s: ServiceOpStatus) {
  const map: Record<ServiceOpStatus, string> = {
    not_started: "لم يبدأ", in_progress: "جاري",
    completed: "مكتمل", locked: "مقفل", submitted: "مقدّم",
  };
  return map[s] ?? s;
}

function serviceStatusBadge(s: ServiceOpStatus) {
  const map: Record<ServiceOpStatus, string> = {
    not_started: "bg-gray-100 text-gray-600",
    in_progress: "bg-amber-100 text-amber-700",
    completed: "bg-emerald-100 text-emerald-700",
    locked: "bg-slate-100 text-slate-500",
    submitted: "bg-blue-100 text-blue-700",
  };
  return map[s] ?? "bg-gray-100 text-gray-600";
}

// ─────────────────────────────────────────────────────────────
// Stage color palette
// ─────────────────────────────────────────────────────────────
const STAGE_COLORS: Record<string, { gradient: string; shadow: string }> = {
  "STG-01": { gradient: "linear-gradient(135deg, #6366f1, #4f46e5)", shadow: "rgba(99,102,241,0.3)" },
  "STG-02": { gradient: "linear-gradient(135deg, #0ea5e9, #0284c7)", shadow: "rgba(14,165,233,0.3)" },
  "STG-03": { gradient: "linear-gradient(135deg, #10b981, #059669)", shadow: "rgba(16,185,129,0.3)" },
  "STG-04": { gradient: "linear-gradient(135deg, #f59e0b, #d97706)", shadow: "rgba(245,158,11,0.3)" },
  "STG-05": { gradient: "linear-gradient(135deg, #e11d48, #be123c)", shadow: "rgba(225,29,72,0.3)" },
  "STG-10": { gradient: "linear-gradient(135deg, #8b5cf6, #7c3aed)", shadow: "rgba(139,92,246,0.3)" },
  "STG-20": { gradient: "linear-gradient(135deg, #ec4899, #db2777)", shadow: "rgba(236,72,153,0.3)" },
};

// ─────────────────────────────────────────────────────────────
// DateEditor — inline editable date fields for a service
// ─────────────────────────────────────────────────────────────
function DateEditor({
  projectId,
  service,
  onSaved,
}: {
  projectId: number;
  service: {
    serviceCode: string;
    stageCode: string;
    instance: {
      plannedStartDate?: string | null;
      plannedDueDate?: string | null;
      actualStartDate?: string | null;
      actualCloseDate?: string | null;
      notes?: string | null;
    } | null;
  };
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [plannedStart, setPlannedStart] = useState(service.instance?.plannedStartDate ?? "");
  const [plannedDue, setPlannedDue] = useState(service.instance?.plannedDueDate ?? "");
  const [actualStart, setActualStart] = useState(service.instance?.actualStartDate ?? "");
  const [actualClose, setActualClose] = useState(service.instance?.actualCloseDate ?? "");
  const [notes, setNotes] = useState(service.instance?.notes ?? "");

  const upsertMutation = trpc.lifecycle.upsertServiceInstance.useMutation({
    onSuccess: () => {
      toast.success("تم حفظ التواريخ");
      setOpen(false);
      onSaved();
    },
    onError: () => toast.error("حدث خطأ في الحفظ"),
  });

  const handleSave = () => {
    upsertMutation.mutate({
      projectId,
      serviceCode: service.serviceCode,
      stageCode: service.stageCode,
      plannedStartDate: plannedStart || undefined,
      plannedDueDate: plannedDue || undefined,
      actualStartDate: actualStart || undefined,
      actualCloseDate: actualClose || undefined,
      notes: notes || undefined,
    });
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-7 px-2 text-xs gap-1 text-muted-foreground"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
      >
        <Edit3 className="w-3 h-3" />
        تواريخ
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">تواريخ الخدمة</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">تاريخ البدء المخطط</Label>
                <Input
                  type="date"
                  value={plannedStart ? toInputDate(plannedStart) : ""}
                  onChange={(e) => setPlannedStart(fromInputDate(e.target.value))}
                  className="text-sm h-8"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">تاريخ الاستحقاق المخطط</Label>
                <Input
                  type="date"
                  value={plannedDue ? toInputDate(plannedDue) : ""}
                  onChange={(e) => setPlannedDue(fromInputDate(e.target.value))}
                  className="text-sm h-8"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">تاريخ البدء الفعلي</Label>
                <Input
                  type="date"
                  value={actualStart ? toInputDate(actualStart) : ""}
                  onChange={(e) => setActualStart(fromInputDate(e.target.value))}
                  className="text-sm h-8"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">تاريخ الإغلاق الفعلي</Label>
                <Input
                  type="date"
                  value={actualClose ? toInputDate(actualClose) : ""}
                  onChange={(e) => setActualClose(fromInputDate(e.target.value))}
                  className="text-sm h-8"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">ملاحظات</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="ملاحظات إضافية..."
                rows={3}
                className="text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              <X className="w-3 h-3 mr-1" />إلغاء
            </Button>
            <Button size="sm" onClick={handleSave} disabled={upsertMutation.isPending}>
              <Save className="w-3 h-3 mr-1" />
              {upsertMutation.isPending ? "جاري الحفظ..." : "حفظ"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Date format helpers: convert between DD-MM-YYYY (stored) and YYYY-MM-DD (input[type=date])
function toInputDate(ddmmyyyy: string): string {
  if (!ddmmyyyy) return "";
  // If already YYYY-MM-DD
  if (ddmmyyyy.length === 10 && ddmmyyyy[4] === "-") return ddmmyyyy;
  const [d, m, y] = ddmmyyyy.split("-");
  if (!y) return ddmmyyyy;
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function fromInputDate(yyyymmdd: string): string {
  if (!yyyymmdd) return "";
  const [y, m, d] = yyyymmdd.split("-");
  return `${d}-${m}-${y}`;
}

// ─────────────────────────────────────────────────────────────
// RequirementRow component
// ─────────────────────────────────────────────────────────────
function RequirementRow({
  req,
  projectId,
  onUpdate,
}: {
  req: {
    id: number;
    requirementCode: string;
    serviceCode: string;
    reqType: string;
    nameAr: string;
    descriptionAr: string | null;
    sourceNote: string | null;
    isMandatory: number;
    internalOwner: string | null;
    status: string;
    notes: string | null;
    completedAt: string | null;
  };
  projectId: number;
  onUpdate: () => void;
}) {
  const [notesOpen, setNotesOpen] = useState(false);
  const [noteText, setNoteText] = useState(req.notes ?? "");
  const isCompleted = req.status === "completed";
  const isNA = req.status === "not_applicable";

  const updateMutation = trpc.lifecycle.updateRequirementStatus.useMutation({
    onSuccess: () => {
      onUpdate();
      toast.success(isCompleted ? "تم إلغاء الإكمال" : "تم تحديد المتطلب كمكتمل ✓");
    },
    onError: () => toast.error("حدث خطأ"),
  });

  const handleToggle = () => {
    updateMutation.mutate({
      projectId,
      serviceCode: req.serviceCode,
      requirementCode: req.requirementCode,
      status: isCompleted ? "pending" : "completed",
      notes: noteText || undefined,
    });
  };

  const handleMarkNA = () => {
    updateMutation.mutate({
      projectId,
      serviceCode: req.serviceCode,
      requirementCode: req.requirementCode,
      status: isNA ? "pending" : "not_applicable",
    });
  };

  const handleSaveNotes = () => {
    updateMutation.mutate({
      projectId,
      serviceCode: req.serviceCode,
      requirementCode: req.requirementCode,
      status: req.status as "pending" | "completed" | "not_applicable",
      notes: noteText || undefined,
    });
    setNotesOpen(false);
    toast.success("تم حفظ الملاحظات");
  };

  return (
    <div
      className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
        isCompleted
          ? "bg-emerald-50/50 border-emerald-200/60"
          : isNA
          ? "bg-slate-50 border-slate-200/60 opacity-60"
          : req.isMandatory
          ? "bg-card border-border hover:border-primary/30"
          : "bg-muted/30 border-border/50"
      }`}
    >
      <Checkbox
        checked={isCompleted}
        onCheckedChange={handleToggle}
        disabled={updateMutation.isPending || isNA}
        className="mt-0.5 shrink-0"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-sm font-medium ${isCompleted ? "line-through text-muted-foreground" : isNA ? "line-through text-muted-foreground" : "text-foreground"}`}>
            {req.nameAr}
          </span>
          {req.isMandatory === 1 && !isNA && (
            <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-medium">إلزامي</span>
          )}
          {isNA && (
            <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-medium">غير منطبق</span>
          )}
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
            req.reqType === "document" ? "bg-blue-100 text-blue-600" :
            req.reqType === "approval" ? "bg-purple-100 text-purple-600" :
            req.reqType === "action" ? "bg-orange-100 text-orange-600" :
            "bg-gray-100 text-gray-600"
          }`}>
            {req.reqType === "document" ? "مستند" : req.reqType === "approval" ? "موافقة" : req.reqType === "action" ? "إجراء" : "بيانات"}
          </span>
        </div>
        {req.descriptionAr && (
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{req.descriptionAr}</p>
        )}
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          {req.internalOwner && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-1 bg-muted/50 px-1.5 py-0.5 rounded">
              <Users className="w-3 h-3" />
              {req.internalOwner}
            </span>
          )}
          {req.sourceNote && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <FileText className="w-3 h-3" />
              {req.sourceNote}
            </span>
          )}
          {req.completedAt && isCompleted && (
            <span className="text-[10px] text-emerald-600 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              {new Date(req.completedAt).toLocaleDateString("ar-AE")}
            </span>
          )}
          {req.notes && (
            <span className="text-[10px] text-amber-600 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              ملاحظة مسجّلة
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="text-xs h-7 px-2 text-muted-foreground"
          onClick={() => setNotesOpen(true)}
        >
          ملاحظات
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={`text-xs h-7 px-2 ${isNA ? "text-slate-500" : "text-muted-foreground"}`}
          onClick={handleMarkNA}
          disabled={updateMutation.isPending || isCompleted}
          title="تحديد كغير منطبق"
        >
          N/A
        </Button>
      </div>

      <Dialog open={notesOpen} onOpenChange={setNotesOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-sm">{req.nameAr}</DialogTitle>
          </DialogHeader>
          <Textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="أضف ملاحظة..."
            rows={4}
            className="text-sm"
          />
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setNotesOpen(false)}>إلغاء</Button>
            <Button size="sm" onClick={handleSaveNotes}>حفظ</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ServiceDetailPanel component
// ─────────────────────────────────────────────────────────────
function ServiceDetailPanel({
  service,
  projectId,
  onBack,
}: {
  service: {
    serviceCode: string;
    stageCode: string;
    nameAr: string;
    descriptionAr: string | null;
    externalParty: string | null;
    internalOwner: string | null;
    expectedDurationDays: number;
    opStatus: ServiceOpStatus;
    timeStatus: string;
    totalReqs: number;
    completedReqs: number;
    mandatoryIncomplete: number;
    canSubmit: boolean;
    instance: {
      plannedStartDate?: string | null;
      plannedDueDate?: string | null;
      actualStartDate?: string | null;
      actualCloseDate?: string | null;
      notes?: string | null;
    } | null;
  };
  projectId: number;
  onBack: () => void;
}) {
  const utils = trpc.useUtils();
  const [activeTab, setActiveTab] = useState<"documents" | "data" | "approval" | "action">("documents");

  const reqQuery = trpc.lifecycle.getServiceRequirements.useQuery({
    serviceCode: service.serviceCode,
    projectId,
  });

  const submitMutation = trpc.lifecycle.submitService.useMutation({
    onSuccess: () => {
      utils.lifecycle.getStageServices.invalidate();
      toast.success("تم تقديم الخدمة بنجاح ✓");
      onBack();
    },
    onError: (e) => toast.error(e.message),
  });

  const reqs = reqQuery.data ?? [];
  const docReqs = reqs.filter((r) => r.reqType === "document");
  const dataReqs = reqs.filter((r) => r.reqType === "data");
  const approvalReqs = reqs.filter((r) => r.reqType === "approval");
  const actionReqs = reqs.filter((r) => r.reqType === "action");

  const completedDocs = docReqs.filter((r) => r.status === "completed").length;
  const completedData = dataReqs.filter((r) => r.status === "completed").length;
  const completedApproval = approvalReqs.filter((r) => r.status === "completed").length;
  const completedAction = actionReqs.filter((r) => r.status === "completed").length;

  const timeAlert = computeTimeAlert(service.instance?.plannedDueDate);

  const handleRefresh = () => {
    reqQuery.refetch();
    utils.lifecycle.getStageServices.invalidate();
  };

  const tabs = [
    { key: "documents" as const, label: "المستندات", count: completedDocs, total: docReqs.length, icon: <FileText className="w-4 h-4" />, color: "blue" },
    { key: "data" as const, label: "البيانات", count: completedData, total: dataReqs.length, icon: <Database className="w-4 h-4" />, color: "purple" },
    { key: "approval" as const, label: "الموافقات", count: completedApproval, total: approvalReqs.length, icon: <CheckCircle2 className="w-4 h-4" />, color: "green" },
    { key: "action" as const, label: "الإجراءات", count: completedAction, total: actionReqs.length, icon: <AlertCircle className="w-4 h-4" />, color: "orange" },
  ].filter((t) => t.total > 0);

  const activeReqs = activeTab === "documents" ? docReqs : activeTab === "data" ? dataReqs : activeTab === "approval" ? approvalReqs : actionReqs;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6" dir="rtl">
      <Button variant="ghost" size="sm" onClick={onBack} className="mb-4 gap-1.5">
        <ArrowLeft className="w-4 h-4" />
        العودة للخدمات
      </Button>

      {/* Service header */}
      <div className="bg-card border border-border rounded-2xl p-5 mb-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              {serviceStatusIcon(service.opStatus)}
              <h2 className="text-lg font-bold text-foreground">{service.nameAr}</h2>
            </div>
            {service.descriptionAr && (
              <p className="text-sm text-muted-foreground mb-3">{service.descriptionAr}</p>
            )}
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              {service.externalParty && (
                <span className="flex items-center gap-1 bg-muted/50 px-2 py-1 rounded-lg">
                  <Building2 className="w-3.5 h-3.5" />
                  {service.externalParty}
                </span>
              )}
              {service.internalOwner && (
                <span className="flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded-lg">
                  <Users className="w-3.5 h-3.5" />
                  {service.internalOwner}
                </span>
              )}
            </div>
          </div>
          <Badge className={`shrink-0 ${serviceStatusBadge(service.opStatus)}`}>
            {serviceStatusLabel(service.opStatus)}
          </Badge>
        </div>

        {/* Dates row */}
        <div className="mt-4 pt-4 border-t border-border/50">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex flex-wrap gap-3 text-xs">
              {service.instance?.plannedStartDate && (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <CalendarDays className="w-3.5 h-3.5" />
                  البدء: {service.instance.plannedStartDate}
                </span>
              )}
              {service.instance?.plannedDueDate && (
                <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-medium ${timeAlertStyle(timeAlert.severity)}`}>
                  {timeAlertIcon(timeAlert.severity)}
                  الاستحقاق: {service.instance.plannedDueDate}
                  {timeAlert.label && ` — ${timeAlert.label}`}
                </span>
              )}
              {service.instance?.actualStartDate && (
                <span className="flex items-center gap-1 text-emerald-600">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  بدأ فعلياً: {service.instance.actualStartDate}
                </span>
              )}
              {service.instance?.actualCloseDate && (
                <span className="flex items-center gap-1 text-emerald-700 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  أُغلق: {service.instance.actualCloseDate}
                </span>
              )}
              {!service.instance?.plannedDueDate && !service.instance?.plannedStartDate && (
                <span className="text-muted-foreground/60 text-[11px]">لم تُحدد تواريخ بعد</span>
              )}
            </div>
            <DateEditor
              projectId={projectId}
              service={service}
              onSaved={handleRefresh}
            />
          </div>
        </div>

        {/* Progress */}
        <div className="mt-4 pt-4 border-t border-border/50">
          <div className="flex justify-between text-xs text-muted-foreground mb-2">
            <span>المتطلبات المكتملة</span>
            <span className="font-medium">{service.completedReqs} / {service.totalReqs}</span>
          </div>
          <Progress
            value={service.totalReqs > 0 ? (service.completedReqs / service.totalReqs) * 100 : 0}
            className="h-2"
          />
        </div>

        {/* Submit button */}
        {service.opStatus !== "completed" && service.opStatus !== "submitted" && service.opStatus !== "locked" && (
          <div className="mt-4 pt-4 border-t border-border/50">
            {service.mandatoryIncomplete > 0 ? (
              <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>يوجد {service.mandatoryIncomplete} متطلبات إلزامية غير مكتملة — زر التقديم معطّل</span>
              </div>
            ) : (
              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() =>
                  submitMutation.mutate({
                    projectId,
                    serviceCode: service.serviceCode,
                    stageCode: service.stageCode,
                  })
                }
                disabled={submitMutation.isPending}
              >
                {submitMutation.isPending ? "جاري التقديم..." : "تقديم الخدمة ✓"}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Requirements tabs */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {tabs.length > 0 && (
          <div className="flex border-b border-border overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 min-w-0 py-3 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap px-2 ${
                  activeTab === tab.key
                    ? `bg-${tab.color}-50 text-${tab.color}-700 border-b-2 border-${tab.color}-500`
                    : "text-muted-foreground hover:bg-muted/50"
                }`}
              >
                {tab.icon}
                {tab.label} ({tab.count}/{tab.total})
              </button>
            ))}
          </div>
        )}

        <div className="p-4 space-y-2">
          {/* Use rich StageDataTab for البيانات tab, StageDocumentsTab for المستندات tab */}
          {activeTab === "data" ? (
            <StageDataTab projectId={projectId} serviceCode={service.serviceCode} />
          ) : activeTab === "documents" ? (
            <StageDocumentsTab projectId={projectId} serviceCode={service.serviceCode} />
          ) : reqQuery.isLoading ? (
            <div className="text-center py-8 text-muted-foreground text-sm">جاري التحميل...</div>
          ) : (
            activeReqs.map((req) => (
              <RequirementRow
                key={req.requirementCode}
                req={req as any}
                projectId={projectId}
                onUpdate={handleRefresh}
              />
            ))
          )}
          {!reqQuery.isLoading && activeTab !== "data" && activeTab !== "documents" && activeReqs.length === 0 && (
            <div className="text-center py-6 text-muted-foreground text-sm">
              لا توجد بنود في هذا التصنيف
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ServicesListPanel component
// ─────────────────────────────────────────────────────────────
function ServicesListPanel({
  stageCode,
  stageName,
  projectId,
  onBack,
}: {
  stageCode: string;
  stageName: string;
  projectId: number;
  onBack: () => void;
}) {
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const utils = trpc.useUtils();

  const servicesQuery = trpc.lifecycle.getStageServices.useQuery({
    stageCode,
    projectId,
  });

  const services = servicesQuery.data ?? [];
  const selectedSvc = services.find((s) => s.serviceCode === selectedService);

  if (selectedSvc) {
    return (
      <ServiceDetailPanel
        service={selectedSvc as any}
        projectId={projectId}
        onBack={() => setSelectedService(null)}
      />
    );
  }

  const completedCount = services.filter(
    (s) => s.opStatus === "completed" || s.opStatus === "submitted"
  ).length;

  // Count delay alerts
  const overdueCount = services.filter((s) => {
    const alert = computeTimeAlert(s.instance?.plannedDueDate);
    return alert.severity === "overdue" && s.opStatus !== "completed" && s.opStatus !== "submitted";
  }).length;

  const urgentCount = services.filter((s) => {
    const alert = computeTimeAlert(s.instance?.plannedDueDate);
    return alert.severity === "urgent" && s.opStatus !== "completed" && s.opStatus !== "submitted";
  }).length;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6" dir="rtl">
      <Button variant="ghost" size="sm" onClick={onBack} className="mb-4 gap-1.5">
        <ArrowLeft className="w-4 h-4" />
        العودة للمراحل
      </Button>

      <div className="mb-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-foreground">{stageName}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {completedCount} من {services.length} خدمات مكتملة
            </p>
          </div>
          <div className="flex gap-2">
            {overdueCount > 0 && (
              <span className="flex items-center gap-1 text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-medium">
                <AlertTriangle className="w-3.5 h-3.5" />
                {overdueCount} متأخرة
              </span>
            )}
            {urgentCount > 0 && (
              <span className="flex items-center gap-1 text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full font-medium">
                <Timer className="w-3.5 h-3.5" />
                {urgentCount} عاجلة
              </span>
            )}
          </div>
        </div>
        {services.length > 0 && (
          <Progress
            value={(completedCount / services.length) * 100}
            className="h-2 mt-3"
          />
        )}
      </div>

      {servicesQuery.isLoading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">جاري تحميل الخدمات...</div>
      ) : services.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          لا توجد خدمات لهذه المرحلة بعد
        </div>
      ) : (
        <div className="space-y-3">
          {services.map((svc, idx) => {
            const isLocked = svc.opStatus === "locked";
            const timeAlert = computeTimeAlert(svc.instance?.plannedDueDate);
            const isDone = svc.opStatus === "completed" || svc.opStatus === "submitted";

            return (
              <div
                key={svc.serviceCode}
                className={`rounded-xl border transition-all duration-200 ${
                  isLocked
                    ? "bg-muted/30 border-border/30 opacity-60"
                    : isDone
                    ? "bg-emerald-50/30 border-emerald-200/60"
                    : timeAlert.severity === "overdue"
                    ? "bg-red-50/30 border-red-200/60"
                    : "bg-card border-border hover:shadow-md"
                }`}
              >
                <button
                  onClick={() => !isLocked && setSelectedService(svc.serviceCode)}
                  disabled={isLocked}
                  className="w-full text-right flex items-center gap-4 p-4"
                >
                  {/* Step number */}
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      isDone
                        ? "bg-emerald-500 text-white"
                        : isLocked
                        ? "bg-slate-200 text-slate-400"
                        : timeAlert.severity === "overdue"
                        ? "bg-red-500 text-white"
                        : "bg-primary/10 text-primary"
                    }`}
                  >
                    {isDone ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : isLocked ? (
                      <Lock className="w-3.5 h-3.5" />
                    ) : timeAlert.severity === "overdue" ? (
                      <AlertTriangle className="w-3.5 h-3.5" />
                    ) : (
                      idx + 1
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-foreground">{svc.nameAr}</span>
                      <Badge className={`text-[10px] px-1.5 py-0 ${serviceStatusBadge(svc.opStatus as ServiceOpStatus)}`}>
                        {serviceStatusLabel(svc.opStatus as ServiceOpStatus)}
                      </Badge>
                      {timeAlert.severity !== "none" && !isDone && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium flex items-center gap-1 ${timeAlertStyle(timeAlert.severity)}`}>
                          {timeAlertIcon(timeAlert.severity)}
                          {timeAlert.label}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      {svc.internalOwner && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {svc.internalOwner}
                        </span>
                      )}
                      <span className="text-[11px] text-muted-foreground">
                        {svc.completedReqs}/{svc.totalReqs} متطلبات
                      </span>
                      {svc.mandatoryIncomplete > 0 && !isLocked && !isDone && (
                        <span className="text-[11px] text-amber-600 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {svc.mandatoryIncomplete} إلزامية ناقصة
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Arrow */}
                  {!isLocked && <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
                </button>

                {/* Inline date editor button */}
                {!isLocked && (
                  <div className="px-4 pb-3 flex justify-end">
                    <DateEditor
                      projectId={projectId}
                      service={svc as any}
                      onSaved={() => servicesQuery.refetch()}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main ProjectLifecyclePage
// ─────────────────────────────────────────────────────────────
export default function ProjectLifecyclePage({ embedded }: { embedded?: boolean } = {}) {
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [selectedStage, setSelectedStage] = useState<{ code: string; name: string } | null>(null);
  const [showAlerts, setShowAlerts] = useState(false);

  const projectsQuery = trpc.projects.list.useQuery();
  const stagesQuery = trpc.lifecycle.getProjectStageStatuses.useQuery(
    { projectId: selectedProjectId! },
    { enabled: !!selectedProjectId }
  );
  const summaryQuery = trpc.lifecycle.getProjectLifecycleSummary.useQuery(
    { projectId: selectedProjectId! },
    { enabled: !!selectedProjectId }
  );
  const alertsQuery = trpc.lifecycle.getDeadlineAlerts.useQuery(
    { projectId: selectedProjectId ?? undefined },
    { enabled: !!selectedProjectId }
  );
  const checkDeadlinesMutation = trpc.lifecycle.checkDeadlines.useMutation({
    onSuccess: (data) => {
      if (data.sent) {
        toast.success(`تم إرسال تنبيه: ${data.overdue} متأخرة، ${data.upcoming} قريبة`);
      } else {
        toast.info('لا توجد مواعيد استحقاق قريبة أو متأخرة');
      }
    },
    onError: (e) => toast.error(e.message),
  });

  const projects = projectsQuery.data ?? [];
  const stages = stagesQuery.data ?? [];
  const summary = summaryQuery.data ?? [];

  // Compute overall progress
  const totalServices = summary.reduce((s, st) => s + st.totalServices, 0);
  const completedServices = summary.reduce((s, st) => s + st.completedServices, 0);
  const overallPct = totalServices > 0 ? Math.round((completedServices / totalServices) * 100) : 0;
  const completedStages = summary.filter((s) => s.status === "completed").length;

  if (selectedStage && selectedProjectId) {
    return (
      <div className={embedded ? "" : "min-h-screen bg-background"}>
        <ServicesListPanel
          stageCode={selectedStage.code}
          stageName={selectedStage.name}
          projectId={selectedProjectId}
          onBack={() => setSelectedStage(null)}
        />
      </div>
    );
  }

  return (
    <div className={`${embedded ? "" : "min-h-screen bg-background"}`} dir="rtl">
      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-foreground">مراحل DLD / RERA</h2>
            <p className="text-sm text-muted-foreground mt-1">
              دورة حياة المشروع العقاري — من التسجيل حتى الإغلاق
            </p>
          </div>
          {selectedProjectId && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 border-emerald-200 text-emerald-700 hover:bg-emerald-50 shrink-0"
              onClick={() => window.open(`/api/lifecycle/compliance-report?projectId=${selectedProjectId}`, '_blank')}
            >
              <FileText className="w-4 h-4" />
              تقرير الامتثال
            </Button>
          )}
        </div>

        {/* Project selector */}
        <div className="mb-5">
          <label className="text-sm font-medium text-foreground mb-2 block">اختر المشروع</label>
          <Select
            value={selectedProjectId?.toString() ?? ""}
            onValueChange={(v) => {
              setSelectedProjectId(Number(v));
              setSelectedStage(null);
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="اختر مشروعاً..." />
            </SelectTrigger>
            <SelectContent>
              {projects.map((p: any) => (
                <SelectItem key={p.id} value={p.id.toString()}>
                  {p.nameAr ?? p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Deadline Alerts Panel */}
        {selectedProjectId && (alertsQuery.data?.length ?? 0) > 0 && (
          <div className="mb-5">
            <button
              onClick={() => setShowAlerts(!showAlerts)}
              className="w-full flex items-center justify-between bg-red-50 border border-red-200 rounded-2xl p-3.5 text-right hover:bg-red-100 transition-colors"
            >
              <div className="flex items-center gap-2">
                <BellRing className="w-4 h-4 text-red-600" />
                <span className="text-sm font-semibold text-red-700">
                  {alertsQuery.data!.filter(a => a.severity === 'overdue').length > 0 && (
                    <span className="ml-1">{alertsQuery.data!.filter(a => a.severity === 'overdue').length} متأخرة</span>
                  )}
                  {alertsQuery.data!.filter(a => a.severity === 'urgent').length > 0 && (
                    <span className="ml-1">{alertsQuery.data!.filter(a => a.severity === 'urgent').length} عاجلة</span>
                  )}
                  {alertsQuery.data!.filter(a => a.severity === 'soon').length > 0 && (
                    <span className="ml-1">{alertsQuery.data!.filter(a => a.severity === 'soon').length} قريبة</span>
                  )}
                </span>
                <span className="text-xs text-red-500">— اضغط للتفاصيل</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7 px-2 text-red-600 hover:bg-red-200"
                  onClick={(e) => { e.stopPropagation(); checkDeadlinesMutation.mutate(); }}
                  disabled={checkDeadlinesMutation.isPending}
                >
                  <RefreshCw className={`w-3 h-3 ml-1 ${checkDeadlinesMutation.isPending ? 'animate-spin' : ''}`} />
                  إرسال تنبيه
                </Button>
              </div>
            </button>
            {showAlerts && (
              <div className="mt-2 bg-card border border-red-100 rounded-2xl overflow-hidden">
                {alertsQuery.data!.map((alert, i) => (
                  <div key={i} className={`flex items-center gap-3 px-4 py-3 border-b border-border/50 last:border-0 ${
                    alert.severity === 'overdue' ? 'bg-red-50/50' :
                    alert.severity === 'urgent' ? 'bg-orange-50/50' : 'bg-amber-50/30'
                  }`}>
                    <div className={`w-2 h-2 rounded-full shrink-0 ${
                      alert.severity === 'overdue' ? 'bg-red-500' :
                      alert.severity === 'urgent' ? 'bg-orange-500' : 'bg-amber-400'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{alert.serviceNameAr}</p>
                      <p className="text-[10px] text-muted-foreground">{alert.stageNameAr} — {alert.projectName}</p>
                    </div>
                    <div className="text-left shrink-0">
                      <span className={`text-[10px] font-medium ${
                        alert.severity === 'overdue' ? 'text-red-600' :
                        alert.severity === 'urgent' ? 'text-orange-600' : 'text-amber-600'
                      }`}>
                        {alert.daysLeft < 0 ? `متأخرة ${Math.abs(alert.daysLeft)} يوم` :
                         alert.daysLeft === 0 ? 'تستحق اليوم' :
                         `متبقي ${alert.daysLeft} أيام`}
                      </span>
                      <p className="text-[10px] text-muted-foreground">
                        {alert.plannedDueDate ? new Date(alert.plannedDueDate).toLocaleDateString('ar-AE') : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Progress summary card */}
        {selectedProjectId && !stagesQuery.isLoading && summary.length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-4 mb-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">التقدم الكلي للمشروع</span>
              </div>
              <span className="text-2xl font-bold text-primary">{overallPct}%</span>
            </div>
            <Progress value={overallPct} className="h-3 mb-3" />
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-muted/40 rounded-xl p-2">
                <div className="text-lg font-bold text-foreground">{completedStages}</div>
                <div className="text-[10px] text-muted-foreground">مراحل مكتملة</div>
              </div>
              <div className="bg-muted/40 rounded-xl p-2">
                <div className="text-lg font-bold text-foreground">{completedServices}</div>
                <div className="text-[10px] text-muted-foreground">خدمات مكتملة</div>
              </div>
              <div className="bg-muted/40 rounded-xl p-2">
                <div className="text-lg font-bold text-foreground">{totalServices - completedServices}</div>
                <div className="text-[10px] text-muted-foreground">خدمات متبقية</div>
              </div>
            </div>
          </div>
        )}

        {/* Stages list */}
        {!selectedProjectId ? (
          <div className="text-center py-16 text-muted-foreground">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-8 h-8 text-muted-foreground/50" />
            </div>
            <p className="text-sm">اختر مشروعاً لعرض مراحل DLD/RERA</p>
          </div>
        ) : stagesQuery.isLoading ? (
          <div className="text-center py-12 text-muted-foreground text-sm">جاري تحميل المراحل...</div>
        ) : (
          <div className="space-y-3">
            {stages.map((stage: any) => {
              const colors = STAGE_COLORS[stage.stageCode] ?? STAGE_COLORS["STG-01"];
              const isLocked = stage.status === "locked";
              const isNotStarted = stage.status === "not_started";
              const stageSummary = summary.find((s) => s.stageCode === stage.stageCode);
              const stageProgress = stageSummary
                ? stageSummary.totalServices > 0
                  ? Math.round((stageSummary.completedServices / stageSummary.totalServices) * 100)
                  : 0
                : 0;

              return (
                <button
                  key={stage.stageCode}
                  onClick={() =>
                    !isLocked &&
                    setSelectedStage({ code: stage.stageCode, name: stage.nameAr })
                  }
                  disabled={isLocked}
                  className={`w-full text-right flex items-center gap-4 p-4 rounded-xl border transition-all duration-200 group ${
                    isLocked
                      ? "bg-muted/30 border-border/30 opacity-50 cursor-not-allowed"
                      : "bg-card border-border hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.99]"
                  }`}
                >
                  {/* Stage icon */}
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-md group-hover:scale-105 transition-transform"
                    style={{
                      background: isLocked || isNotStarted ? "#e2e8f0" : colors.gradient,
                      boxShadow: isLocked || isNotStarted ? "none" : `0 4px 16px ${colors.shadow}`,
                    }}
                  >
                    <span className={`text-sm font-bold ${isLocked || isNotStarted ? "text-slate-400" : "text-white"}`}>
                      {stage.stageCode.replace("STG-", "")}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-foreground">{stage.nameAr}</span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${stageStatusBadge(stage.status as StageStatus)}`}
                      >
                        {stageStatusLabel(stage.status as StageStatus)}
                      </span>
                    </div>
                    {stageSummary && stageSummary.totalServices > 0 && (
                      <div className="mt-2">
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                          <span>{stageSummary.completedServices} / {stageSummary.totalServices} خدمات</span>
                          <span className="font-medium">{stageProgress}%</span>
                        </div>
                        <div className="w-full bg-muted/50 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full transition-all ${
                              stageProgress === 100 ? "bg-emerald-500" :
                              stageProgress > 50 ? "bg-blue-500" :
                              stageProgress > 0 ? "bg-amber-500" : "bg-gray-300"
                            }`}
                            style={{ width: `${stageProgress}%` }}
                          />
                        </div>
                      </div>
                    )}
                    {stage.descriptionAr && !stageSummary && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                        {stage.descriptionAr}
                      </p>
                    )}
                  </div>

                  {/* Arrow */}
                  {!isLocked && (
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
