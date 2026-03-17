import { useState, useMemo, Fragment } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Clock,
  FileText,
  Database,
  Shield,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Building2,
  Users,
  Save,
  RotateCcw,
  Printer,
  Filter,
  Search,
  Eye,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";

/* ───── status helpers ───── */
const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  not_started: { label: "لم يبدأ", bg: "bg-gray-100", text: "text-gray-600" },
  in_progress: { label: "جاري", bg: "bg-blue-50", text: "text-blue-700" },
  completed: { label: "مكتمل", bg: "bg-emerald-50", text: "text-emerald-700" },
  submitted: { label: "مقدّم", bg: "bg-indigo-50", text: "text-indigo-700" },
  locked: { label: "مقفل", bg: "bg-amber-50", text: "text-amber-700" },
};

const REQ_TYPE_ICON: Record<string, { icon: typeof FileText; color: string }> = {
  document: { icon: FileText, color: "text-blue-500" },
  data: { icon: Database, color: "text-emerald-500" },
  approval: { icon: Shield, color: "text-purple-500" },
  action: { icon: CheckCircle2, color: "text-amber-500" },
};

/* ───── date helpers ───── */
function computeDaysLeft(dueDate: string | null): { days: number | null; severity: "none" | "overdue" | "urgent" | "soon" | "ok" } {
  if (!dueDate) return { days: null, severity: "none" };
  // Try parsing DD-MM-YYYY or YYYY-MM-DD
  let d: Date;
  if (dueDate.includes("-") && dueDate.split("-")[0].length === 4) {
    d = new Date(dueDate);
  } else {
    const [day, month, year] = dueDate.split("-").map(Number);
    d = new Date(year, month - 1, day);
  }
  const diff = Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const severity = diff < 0 ? "overdue" : diff <= 3 ? "urgent" : diff <= 7 ? "soon" : "ok";
  return { days: diff, severity };
}

function formatDateInput(val: string): string {
  // Accept DD-MM-YYYY format
  return val;
}

/* ───── component ───── */
export default function WorkSchedulePage() {
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set());
  const [expandedServices, setExpandedServices] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [editingDates, setEditingDates] = useState<Record<string, {
    plannedStart: string;
    plannedDue: string;
    actualStart: string;
    actualClose: string;
  }>>({});
  const [showRequirements, setShowRequirements] = useState(true);

  const projectsQuery = trpc.projects.list.useQuery();
  const scheduleQuery = trpc.lifecycle.getWorkSchedule.useQuery(
    { projectId: selectedProjectId! },
    { enabled: !!selectedProjectId }
  );
  const upsertMutation = trpc.lifecycle.upsertServiceInstance.useMutation({
    onSuccess: () => {
      toast.success("تم حفظ التواريخ بنجاح");
      scheduleQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const projects = projectsQuery.data ?? [];
  const stages = scheduleQuery.data ?? [];

  // Expand all stages by default when data loads
  useMemo(() => {
    if (stages.length > 0 && expandedStages.size === 0) {
      setExpandedStages(new Set(stages.map((s) => s.stageCode)));
    }
  }, [stages.length]);

  const toggleStage = (code: string) => {
    setExpandedStages((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const toggleService = (code: string) => {
    setExpandedServices((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const startEditing = (svc: any) => {
    setEditingDates((prev) => ({
      ...prev,
      [svc.serviceCode]: {
        plannedStart: svc.plannedStartDate ?? "",
        plannedDue: svc.plannedDueDate ?? "",
        actualStart: svc.actualStartDate ?? "",
        actualClose: svc.actualCloseDate ?? "",
      },
    }));
  };

  const cancelEditing = (serviceCode: string) => {
    setEditingDates((prev) => {
      const next = { ...prev };
      delete next[serviceCode];
      return next;
    });
  };

  const saveDates = (svc: any, stageCode: string) => {
    const dates = editingDates[svc.serviceCode];
    if (!dates) return;
    upsertMutation.mutate({
      projectId: selectedProjectId!,
      serviceCode: svc.serviceCode,
      stageCode,
      plannedStartDate: dates.plannedStart || undefined,
      plannedDueDate: dates.plannedDue || undefined,
      actualStartDate: dates.actualStart || undefined,
      actualCloseDate: dates.actualClose || undefined,
    });
    cancelEditing(svc.serviceCode);
  };

  const updateDateField = (serviceCode: string, field: string, value: string) => {
    setEditingDates((prev) => ({
      ...prev,
      [serviceCode]: {
        ...prev[serviceCode],
        [field]: value,
      },
    }));
  };

  // Filter stages/services
  const filteredStages = useMemo(() => {
    return stages.map((stage) => {
      const filteredServices = stage.services.filter((svc) => {
        const matchesSearch = !searchTerm ||
          svc.nameAr.includes(searchTerm) ||
          svc.serviceCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (svc.externalParty && svc.externalParty.includes(searchTerm)) ||
          (svc.internalOwner && svc.internalOwner.includes(searchTerm));
        const matchesStatus = statusFilter === "all" || svc.operationalStatus === statusFilter;
        return matchesSearch && matchesStatus;
      });
      return { ...stage, services: filteredServices };
    }).filter((stage) => stage.services.length > 0);
  }, [stages, searchTerm, statusFilter]);

  // Summary stats
  const totalServices = stages.reduce((s, st) => s + st.totalServices, 0);
  const completedServices = stages.reduce((s, st) => s + st.completedServices, 0);
  const totalReqs = stages.reduce((s, st) => s + st.services.reduce((ss, svc) => ss + svc.totalReqs, 0), 0);
  const completedReqs = stages.reduce((s, st) => s + st.services.reduce((ss, svc) => ss + svc.completedReqs, 0), 0);
  const overallPct = totalServices > 0 ? Math.round((completedServices / totalServices) * 100) : 0;

  // Count services with overdue dates
  const overdueCount = stages.reduce((s, st) => s + st.services.filter((svc) => {
    const { severity } = computeDaysLeft(svc.plannedDueDate);
    return severity === "overdue" && svc.operationalStatus !== "completed" && svc.operationalStatus !== "submitted";
  }).length, 0);

  let serviceCounter = 0;

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* ═══ Header ═══ */}
      <div className="bg-gradient-to-l from-gray-800 via-gray-700 to-gray-900 text-white">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-lg font-bold">جدول العمل التنظيمي</h1>
                <p className="text-gray-300 text-xs">جدولة مراحل DLD / RERA — المهام والتواريخ والمتطلبات</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Select
                value={selectedProjectId?.toString() ?? ""}
                onValueChange={(v) => {
                  setSelectedProjectId(Number(v));
                  setExpandedStages(new Set());
                }}
              >
                <SelectTrigger className="w-[240px] bg-white/10 border-white/20 text-white text-sm">
                  <SelectValue placeholder="اختر المشروع..." />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p: any) => (
                    <SelectItem key={p.id} value={p.id.toString()}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedProjectId && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white/70 hover:text-white hover:bg-white/10"
                  onClick={() => window.print()}
                >
                  <Printer className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {!selectedProjectId ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
          <Calendar className="w-16 h-16 mb-4 opacity-30" />
          <p className="text-lg font-medium">اختر مشروعاً لعرض جدول العمل</p>
          <p className="text-sm mt-1">سيتم عرض كافة المراحل والخدمات والمتطلبات مع إمكانية تحديد التواريخ</p>
        </div>
      ) : scheduleQuery.isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4">
          {/* ═══ Summary Bar ═══ */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div className="bg-card rounded-lg border p-3">
              <p className="text-[11px] text-muted-foreground mb-1">المراحل</p>
              <p className="text-xl font-bold text-foreground">{stages.length}</p>
              <Progress value={overallPct} className="h-1.5 mt-2" />
            </div>
            <div className="bg-card rounded-lg border p-3">
              <p className="text-[11px] text-muted-foreground mb-1">الخدمات</p>
              <p className="text-xl font-bold text-foreground">
                <span className="text-emerald-600">{completedServices}</span>
                <span className="text-muted-foreground text-sm"> / {totalServices}</span>
              </p>
            </div>
            <div className="bg-card rounded-lg border p-3">
              <p className="text-[11px] text-muted-foreground mb-1">المتطلبات</p>
              <p className="text-xl font-bold text-foreground">
                <span className="text-blue-600">{completedReqs}</span>
                <span className="text-muted-foreground text-sm"> / {totalReqs}</span>
              </p>
            </div>
            <div className="bg-card rounded-lg border p-3">
              <p className="text-[11px] text-muted-foreground mb-1">متأخرة</p>
              <p className={`text-xl font-bold ${overdueCount > 0 ? "text-red-600" : "text-emerald-600"}`}>
                {overdueCount}
              </p>
            </div>
          </div>

          {/* ═══ Filters ═══ */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-[320px]">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="بحث في الخدمات..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-9 text-sm"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px] text-sm">
                <Filter className="w-3.5 h-3.5 ml-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الحالات</SelectItem>
                <SelectItem value="not_started">لم يبدأ</SelectItem>
                <SelectItem value="in_progress">جاري</SelectItem>
                <SelectItem value="completed">مكتمل</SelectItem>
                <SelectItem value="submitted">مقدّم</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              className="text-xs gap-1"
              onClick={() => setShowRequirements(!showRequirements)}
            >
              {showRequirements ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {showRequirements ? "إخفاء المتطلبات" : "إظهار المتطلبات"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs gap-1"
              onClick={() => {
                if (expandedStages.size === stages.length) {
                  setExpandedStages(new Set());
                } else {
                  setExpandedStages(new Set(stages.map((s) => s.stageCode)));
                }
              }}
            >
              {expandedStages.size === stages.length ? "طي الكل" : "توسيع الكل"}
            </Button>
          </div>

          {/* ═══ Main Table ═══ */}
          <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b text-[11px] text-muted-foreground font-medium">
                    <th className="text-right py-2.5 px-3 w-[40px]">#</th>
                    <th className="text-right py-2.5 px-3 min-w-[280px]">الخدمة / المهمة</th>
                    <th className="text-center py-2.5 px-2 w-[80px]">الحالة</th>
                    <th className="text-center py-2.5 px-2 w-[70px]">المدة</th>
                    <th className="text-center py-2.5 px-2 w-[120px]">بدء مخطط</th>
                    <th className="text-center py-2.5 px-2 w-[120px]">استحقاق مخطط</th>
                    <th className="text-center py-2.5 px-2 w-[120px]">بدء فعلي</th>
                    <th className="text-center py-2.5 px-2 w-[120px]">إغلاق فعلي</th>
                    <th className="text-center py-2.5 px-2 w-[90px]">المتبقي</th>
                    <th className="text-center py-2.5 px-2 w-[100px]">المتطلبات</th>
                    <th className="text-center py-2.5 px-2 w-[140px]">الجهة الخارجية</th>
                    <th className="text-center py-2.5 px-2 w-[140px]">المسؤول الداخلي</th>
                    <th className="text-center py-2.5 px-2 w-[80px]">إجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStages.map((stage, stageIdx) => {
                    const isExpanded = expandedStages.has(stage.stageCode);
                    const stageStatusCfg = STATUS_CONFIG[stage.status] ?? STATUS_CONFIG.not_started;
                    const stagePct = stage.totalServices > 0
                      ? Math.round((stage.completedServices / stage.totalServices) * 100)
                      : 0;

                    return (
                      <Fragment key={stage.stageCode}>
                        {/* Stage Header Row */}
                        <tr
                          className="bg-gray-100/80 hover:bg-gray-100 cursor-pointer border-b border-gray-200"
                          onClick={() => toggleStage(stage.stageCode)}
                        >
                          <td colSpan={13} className="py-2.5 px-3">
                            <div className="flex items-center gap-3">
                              <div className={`transition-transform duration-200 ${isExpanded ? "rotate-0" : "-rotate-90"}`}>
                                <ChevronDown className="w-4 h-4 text-gray-500" />
                              </div>
                              <span className="text-xs font-mono text-gray-400 bg-gray-200 px-1.5 py-0.5 rounded">
                                {String(stageIdx + 1).padStart(2, "0")}
                              </span>
                              <span className="font-bold text-foreground text-sm">{stage.nameAr}</span>
                              <Badge className={`text-[10px] px-1.5 py-0 ${stageStatusCfg.bg} ${stageStatusCfg.text} border-0`}>
                                {stageStatusCfg.label}
                              </Badge>
                              <span className="text-[10px] text-muted-foreground">
                                {stage.completedServices}/{stage.totalServices} خدمات
                              </span>
                              <div className="flex-1 max-w-[120px]">
                                <Progress value={stagePct} className="h-1" />
                              </div>
                            </div>
                          </td>
                        </tr>

                        {/* Service Rows */}
                        {isExpanded && stage.services.map((svc) => {
                          serviceCounter++;
                          const statusCfg = STATUS_CONFIG[svc.operationalStatus] ?? STATUS_CONFIG.not_started;
                          const { days, severity } = computeDaysLeft(svc.plannedDueDate);
                          const isEditing = !!editingDates[svc.serviceCode];
                          const dates = editingDates[svc.serviceCode];
                          const isServiceExpanded = expandedServices.has(svc.serviceCode);
                          const isDone = svc.operationalStatus === "completed" || svc.operationalStatus === "submitted";

                          return (
                            <Fragment key={svc.serviceCode}>
                              <tr className={`border-b border-gray-100 hover:bg-gray-50/50 transition-colors ${isDone ? "opacity-60" : ""}`}>
                                {/* # */}
                                <td className="py-2 px-3 text-center text-xs text-muted-foreground font-mono">
                                  {serviceCounter}
                                </td>

                                {/* Service Name */}
                                <td className="py-2 px-3">
                                  <div className="flex items-center gap-2">
                                    {showRequirements && svc.totalReqs > 0 && (
                                      <button
                                        onClick={(e) => { e.stopPropagation(); toggleService(svc.serviceCode); }}
                                        className="text-muted-foreground hover:text-foreground transition-colors"
                                      >
                                        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isServiceExpanded ? "" : "-rotate-90"}`} />
                                      </button>
                                    )}
                                    <span className={`text-sm ${isDone ? "line-through" : ""}`}>
                                      {svc.nameAr}
                                    </span>
                                  </div>
                                </td>

                                {/* Status */}
                                <td className="py-2 px-2 text-center">
                                  <Badge className={`text-[10px] px-1.5 py-0 ${statusCfg.bg} ${statusCfg.text} border-0`}>
                                    {statusCfg.label}
                                  </Badge>
                                </td>

                                {/* Duration */}
                                <td className="py-2 px-2 text-center text-xs text-muted-foreground">
                                  {svc.expectedDurationDays ? (
                                    <span className="flex items-center justify-center gap-1">
                                      <Clock className="w-3 h-3" />
                                      {svc.expectedDurationDays}d
                                    </span>
                                  ) : (
                                    <span className="text-gray-300">—</span>
                                  )}
                                </td>

                                {/* Planned Start */}
                                <td className="py-2 px-2 text-center">
                                  {isEditing ? (
                                    <Input
                                      value={dates.plannedStart}
                                      onChange={(e) => updateDateField(svc.serviceCode, "plannedStart", e.target.value)}
                                      placeholder="DD-MM-YYYY"
                                      className="h-7 text-[11px] text-center w-[110px] mx-auto"
                                    />
                                  ) : (
                                    <span className="text-xs text-muted-foreground">
                                      {svc.plannedStartDate || <span className="text-gray-300">—</span>}
                                    </span>
                                  )}
                                </td>

                                {/* Planned Due */}
                                <td className="py-2 px-2 text-center">
                                  {isEditing ? (
                                    <Input
                                      value={dates.plannedDue}
                                      onChange={(e) => updateDateField(svc.serviceCode, "plannedDue", e.target.value)}
                                      placeholder="DD-MM-YYYY"
                                      className="h-7 text-[11px] text-center w-[110px] mx-auto"
                                    />
                                  ) : (
                                    <span className="text-xs text-muted-foreground">
                                      {svc.plannedDueDate || <span className="text-gray-300">—</span>}
                                    </span>
                                  )}
                                </td>

                                {/* Actual Start */}
                                <td className="py-2 px-2 text-center">
                                  {isEditing ? (
                                    <Input
                                      value={dates.actualStart}
                                      onChange={(e) => updateDateField(svc.serviceCode, "actualStart", e.target.value)}
                                      placeholder="DD-MM-YYYY"
                                      className="h-7 text-[11px] text-center w-[110px] mx-auto"
                                    />
                                  ) : (
                                    <span className="text-xs">
                                      {svc.actualStartDate ? (
                                        <span className="text-emerald-600">{svc.actualStartDate}</span>
                                      ) : (
                                        <span className="text-gray-300">—</span>
                                      )}
                                    </span>
                                  )}
                                </td>

                                {/* Actual Close */}
                                <td className="py-2 px-2 text-center">
                                  {isEditing ? (
                                    <Input
                                      value={dates.actualClose}
                                      onChange={(e) => updateDateField(svc.serviceCode, "actualClose", e.target.value)}
                                      placeholder="DD-MM-YYYY"
                                      className="h-7 text-[11px] text-center w-[110px] mx-auto"
                                    />
                                  ) : (
                                    <span className="text-xs">
                                      {svc.actualCloseDate ? (
                                        <span className="text-emerald-700 font-medium">{svc.actualCloseDate}</span>
                                      ) : (
                                        <span className="text-gray-300">—</span>
                                      )}
                                    </span>
                                  )}
                                </td>

                                {/* Days Left */}
                                <td className="py-2 px-2 text-center">
                                  {days !== null && !isDone ? (
                                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                      severity === "overdue" ? "bg-red-50 text-red-700" :
                                      severity === "urgent" ? "bg-amber-50 text-amber-700" :
                                      severity === "soon" ? "bg-yellow-50 text-yellow-700" :
                                      "bg-gray-50 text-gray-600"
                                    }`}>
                                      {days < 0 ? `متأخر ${Math.abs(days)}d` : `${days}d`}
                                    </span>
                                  ) : isDone ? (
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" />
                                  ) : (
                                    <span className="text-gray-300 text-xs">—</span>
                                  )}
                                </td>

                                {/* Requirements */}
                                <td className="py-2 px-2 text-center">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="text-xs cursor-help">
                                        <span className={svc.completedReqs === svc.totalReqs && svc.totalReqs > 0 ? "text-emerald-600 font-medium" : ""}>
                                          {svc.completedReqs}
                                        </span>
                                        <span className="text-muted-foreground">/{svc.totalReqs}</span>
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>إلزامي: {svc.mandatoryComplete}/{svc.mandatoryTotal}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </td>

                                {/* External Party */}
                                <td className="py-2 px-2 text-center">
                                  {svc.externalParty ? (
                                    <span className="text-[11px] text-muted-foreground flex items-center justify-center gap-1">
                                      <Building2 className="w-3 h-3 shrink-0" />
                                      <span className="truncate max-w-[120px]">{svc.externalParty}</span>
                                    </span>
                                  ) : (
                                    <span className="text-gray-300 text-xs">—</span>
                                  )}
                                </td>

                                {/* Internal Owner */}
                                <td className="py-2 px-2 text-center">
                                  {svc.internalOwner ? (
                                    <span className="text-[11px] text-muted-foreground flex items-center justify-center gap-1">
                                      <Users className="w-3 h-3 shrink-0" />
                                      <span className="truncate max-w-[120px]">{svc.internalOwner}</span>
                                    </span>
                                  ) : (
                                    <span className="text-gray-300 text-xs">—</span>
                                  )}
                                </td>

                                {/* Action */}
                                <td className="py-2 px-2 text-center">
                                  {isEditing ? (
                                    <div className="flex items-center justify-center gap-1">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                        onClick={() => saveDates(svc, stage.stageCode)}
                                        disabled={upsertMutation.isPending}
                                      >
                                        <Save className="w-3.5 h-3.5" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
                                        onClick={() => cancelEditing(svc.serviceCode)}
                                      >
                                        <RotateCcw className="w-3.5 h-3.5" />
                                      </Button>
                                    </div>
                                  ) : (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 text-[10px] px-2 text-muted-foreground hover:text-foreground"
                                      onClick={() => startEditing(svc)}
                                    >
                                      <Calendar className="w-3 h-3 ml-1" />
                                      تحرير
                                    </Button>
                                  )}
                                </td>
                              </tr>

                              {/* Requirements sub-rows */}
                              {showRequirements && isServiceExpanded && svc.requirements.map((req, reqIdx) => {
                                const reqTypeInfo = REQ_TYPE_ICON[req.reqType] ?? REQ_TYPE_ICON.document;
                                const ReqIcon = reqTypeInfo.icon;
                                const isCompleted = req.status === "completed";
                                const isNA = req.status === "not_applicable";

                                return (
                                  <tr
                                    key={req.requirementCode}
                                    className={`border-b border-gray-50 text-[11px] ${isCompleted ? "bg-emerald-50/30" : isNA ? "bg-gray-50/50 opacity-50" : "bg-blue-50/20"}`}
                                  >
                                    <td className="py-1.5 px-3 text-center text-gray-300 font-mono text-[10px]">
                                      {serviceCounter}.{reqIdx + 1}
                                    </td>
                                    <td className="py-1.5 px-3 pr-10" colSpan={2}>
                                      <div className="flex items-center gap-2">
                                        <ReqIcon className={`w-3 h-3 shrink-0 ${reqTypeInfo.color}`} />
                                        <span className={isCompleted ? "line-through text-muted-foreground" : ""}>
                                          {req.nameAr}
                                        </span>
                                        {req.isMandatory === 1 && (
                                          <span className="text-[9px] text-red-500 font-medium">إلزامي</span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="py-1.5 px-2 text-center" colSpan={5}>
                                      <span className="text-[10px] text-muted-foreground">{req.timing}</span>
                                    </td>
                                    <td className="py-1.5 px-2 text-center" colSpan={2}>
                                      {isCompleted ? (
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mx-auto" />
                                      ) : isNA ? (
                                        <span className="text-[10px] text-gray-400">غير مطبق</span>
                                      ) : (
                                        <span className="text-[10px] text-amber-600">معلّق</span>
                                      )}
                                    </td>
                                    <td colSpan={3}></td>
                                  </tr>
                                );
                              })}
                            </Fragment>
                          );
                        })}
                      </Fragment>
                    );
                  })}

                  {filteredStages.length === 0 && (
                    <tr>
                      <td colSpan={13} className="py-12 text-center text-muted-foreground text-sm">
                        لا توجد نتائج مطابقة للبحث أو الفلتر
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ═══ Footer Summary ═══ */}
          <div className="mt-4 text-center text-xs text-muted-foreground">
            إجمالي: {stages.length} مراحل — {totalServices} خدمة — {totalReqs} متطلب
          </div>
        </div>
      )}
    </div>
  );
}

