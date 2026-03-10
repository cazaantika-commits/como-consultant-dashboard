import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight, ArrowLeft, Clock, CheckCircle2, Lock, AlertCircle, Circle, FileText, Database, ChevronRight, CalendarDays, Users, Building2 } from "lucide-react";
import { toast } from "sonner";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
type StageStatus = "not_started" | "in_progress" | "completed" | "locked";
type ServiceOpStatus = "not_started" | "in_progress" | "completed" | "locked" | "submitted";

// ─────────────────────────────────────────────────────────────
// Status helpers
// ─────────────────────────────────────────────────────────────
function stageStatusLabel(s: StageStatus) {
  const map: Record<StageStatus, string> = {
    not_started: "لم تبدأ",
    in_progress: "جاري التنفيذ",
    completed: "مكتملة",
    locked: "مقفلة",
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
    not_started: "لم يبدأ",
    in_progress: "جاري",
    completed: "مكتمل",
    locked: "مقفل",
    submitted: "مقدّم",
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
const STAGE_COLORS: Record<string, { gradient: string; shadow: string; border: string }> = {
  "STG-01": { gradient: "linear-gradient(135deg, #6366f1, #4f46e5)", shadow: "rgba(99,102,241,0.3)", border: "#6366f1" },
  "STG-02": { gradient: "linear-gradient(135deg, #0ea5e9, #0284c7)", shadow: "rgba(14,165,233,0.3)", border: "#0ea5e9" },
  "STG-03": { gradient: "linear-gradient(135deg, #10b981, #059669)", shadow: "rgba(16,185,129,0.3)", border: "#10b981" },
  "STG-04": { gradient: "linear-gradient(135deg, #f59e0b, #d97706)", shadow: "rgba(245,158,11,0.3)", border: "#f59e0b" },
  "STG-05": { gradient: "linear-gradient(135deg, #e11d48, #be123c)", shadow: "rgba(225,29,72,0.3)", border: "#e11d48" },
};

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

  const updateMutation = trpc.lifecycle.updateRequirementStatus.useMutation({
    onSuccess: () => {
      onUpdate();
      toast.success(isCompleted ? "تم إلغاء الإكمال" : "تم تحديد المتطلب كمكتمل");
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
          : req.isMandatory
          ? "bg-card border-border hover:border-primary/30"
          : "bg-muted/30 border-border/50"
      }`}
    >
      <Checkbox
        checked={isCompleted}
        onCheckedChange={handleToggle}
        disabled={updateMutation.isPending}
        className="mt-0.5 shrink-0"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-sm font-medium ${isCompleted ? "line-through text-muted-foreground" : "text-foreground"}`}>
            {req.nameAr}
          </span>
          {req.isMandatory === 1 && (
            <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-medium">إلزامي</span>
          )}
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
            req.reqType === "document" ? "bg-blue-100 text-blue-600" : "bg-purple-100 text-purple-600"
          }`}>
            {req.reqType === "document" ? "مستند" : "بيانات"}
          </span>
        </div>
        {req.descriptionAr && (
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{req.descriptionAr}</p>
        )}
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          {req.internalOwner && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
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
          {req.notes && (
            <span className="text-[10px] text-amber-600 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              ملاحظة مسجّلة
            </span>
          )}
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="shrink-0 text-xs h-7 px-2 text-muted-foreground"
        onClick={() => setNotesOpen(true)}
      >
        ملاحظات
      </Button>

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
  const [activeTab, setActiveTab] = useState<"documents" | "data">("documents");

  const reqQuery = trpc.lifecycle.getServiceRequirements.useQuery({
    serviceCode: service.serviceCode,
    projectId,
  });

  const submitMutation = trpc.lifecycle.submitService.useMutation({
    onSuccess: () => {
      utils.lifecycle.getStageServices.invalidate();
      toast.success("تم تقديم الخدمة بنجاح");
      onBack();
    },
    onError: (e) => toast.error(e.message),
  });

  const reqs = reqQuery.data ?? [];
  const docReqs = reqs.filter((r) => r.reqType === "document");
  const dataReqs = reqs.filter((r) => r.reqType === "data");
  const completedDocs = docReqs.filter((r) => r.status === "completed").length;
  const completedData = dataReqs.filter((r) => r.status === "completed").length;

  const handleRefresh = () => {
    reqQuery.refetch();
    utils.lifecycle.getStageServices.invalidate();
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6" dir="rtl">
      {/* Back button */}
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
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              {service.externalParty && (
                <span className="flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5" />
                  {service.externalParty}
                </span>
              )}
              {service.internalOwner && (
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  {service.internalOwner}
                </span>
              )}
              {service.instance?.plannedDueDate && (
                <span className="flex items-center gap-1">
                  <CalendarDays className="w-3.5 h-3.5" />
                  الاستحقاق: {service.instance.plannedDueDate}
                </span>
              )}
              {service.timeStatus && (
                <span className={`flex items-center gap-1 font-medium ${
                  service.timeStatus.includes("متأخرة") ? "text-red-500" : "text-blue-500"
                }`}>
                  <Clock className="w-3.5 h-3.5" />
                  {service.timeStatus}
                </span>
              )}
            </div>
          </div>
          <Badge className={`shrink-0 ${serviceStatusBadge(service.opStatus)}`}>
            {serviceStatusLabel(service.opStatus)}
          </Badge>
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
        {/* Tab header */}
        <div className="flex border-b border-border">
          <button
            onClick={() => setActiveTab("documents")}
            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
              activeTab === "documents"
                ? "bg-blue-50 text-blue-700 border-b-2 border-blue-500"
                : "text-muted-foreground hover:bg-muted/50"
            }`}
          >
            <FileText className="w-4 h-4" />
            المستندات ({completedDocs}/{docReqs.length})
          </button>
          <button
            onClick={() => setActiveTab("data")}
            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
              activeTab === "data"
                ? "bg-purple-50 text-purple-700 border-b-2 border-purple-500"
                : "text-muted-foreground hover:bg-muted/50"
            }`}
          >
            <Database className="w-4 h-4" />
            البيانات ({completedData}/{dataReqs.length})
          </button>
        </div>

        {/* Requirements list */}
        <div className="p-4 space-y-2">
          {reqQuery.isLoading ? (
            <div className="text-center py-8 text-muted-foreground text-sm">جاري التحميل...</div>
          ) : (
            (activeTab === "documents" ? docReqs : dataReqs).map((req) => (
              <RequirementRow
                key={req.requirementCode}
                req={req as any}
                projectId={projectId}
                onUpdate={handleRefresh}
              />
            ))
          )}
          {!reqQuery.isLoading &&
            (activeTab === "documents" ? docReqs : dataReqs).length === 0 && (
              <div className="text-center py-6 text-muted-foreground text-sm">
                لا توجد {activeTab === "documents" ? "مستندات" : "بيانات"} لهذه الخدمة
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

  return (
    <div className="max-w-3xl mx-auto px-4 py-6" dir="rtl">
      <Button variant="ghost" size="sm" onClick={onBack} className="mb-4 gap-1.5">
        <ArrowLeft className="w-4 h-4" />
        العودة للمراحل
      </Button>

      <div className="mb-6">
        <h2 className="text-xl font-bold text-foreground">{stageName}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {completedCount} من {services.length} خدمات مكتملة
        </p>
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
            return (
              <button
                key={svc.serviceCode}
                onClick={() => !isLocked && setSelectedService(svc.serviceCode)}
                disabled={isLocked}
                className={`w-full text-right flex items-center gap-4 p-4 rounded-xl border transition-all duration-200 ${
                  isLocked
                    ? "bg-muted/30 border-border/30 opacity-60 cursor-not-allowed"
                    : "bg-card border-border hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99]"
                }`}
              >
                {/* Step number */}
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    svc.opStatus === "completed" || svc.opStatus === "submitted"
                      ? "bg-emerald-500 text-white"
                      : isLocked
                      ? "bg-slate-200 text-slate-400"
                      : "bg-primary/10 text-primary"
                  }`}
                >
                  {svc.opStatus === "completed" || svc.opStatus === "submitted" ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : isLocked ? (
                    <Lock className="w-3.5 h-3.5" />
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
                  </div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    {svc.timeStatus && (
                      <span className={`text-[11px] flex items-center gap-1 ${
                        svc.timeStatus.includes("متأخرة") ? "text-red-500" : "text-muted-foreground"
                      }`}>
                        <Clock className="w-3 h-3" />
                        {svc.timeStatus}
                      </span>
                    )}
                    <span className="text-[11px] text-muted-foreground">
                      {svc.completedReqs}/{svc.totalReqs} متطلبات
                    </span>
                    {svc.mandatoryIncomplete > 0 && !isLocked && (
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

  const projectsQuery = trpc.projects.getAll.useQuery();
  const stagesQuery = trpc.lifecycle.getProjectStageStatuses.useQuery(
    { projectId: selectedProjectId! },
    { enabled: !!selectedProjectId }
  );

  const projects = projectsQuery.data ?? [];
  const stages = stagesQuery.data ?? [];

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
        <div className="mb-6">
          <h2 className="text-xl font-bold text-foreground">مراحل DLD / RERA</h2>
          <p className="text-sm text-muted-foreground mt-1">
            دورة حياة المشروع العقاري — من التسجيل حتى الإغلاق
          </p>
        </div>

        {/* Project selector */}
        <div className="mb-6">
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
                    {stage.descriptionAr && (
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
