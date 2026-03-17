import { useState, useMemo, useRef, useEffect, Fragment, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronDown,
  ChevronLeft,
  Calendar,
  Loader2,
  Check,
  ZoomIn,
  ZoomOut,
  GripVertical,
  Filter,
  AlertTriangle,
  CalendarX2,
  Clock,
} from "lucide-react";
import { toast } from "sonner";

/* ── helpers ── */
const fmtDate = (d: string | null) => {
  if (!d) return "—";
  const dt = new Date(d);
  const day = dt.getDate().toString().padStart(2, "0");
  const months = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
  return `${day} ${months[dt.getMonth()]} ${dt.getFullYear().toString().slice(2)}`;
};

const fmtDateShort = (d: string | null) => {
  if (!d) return "—";
  const dt = new Date(d);
  const day = dt.getDate();
  const mon = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][dt.getMonth()];
  return `${day}-${mon}-${dt.getFullYear().toString().slice(2)}`;
};

const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 86400000);

const addDays = (d: Date, n: number) => {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
};

/* Add working days (5-day week: Sun-Thu, skip Fri+Sat) */
const addWorkingDays = (start: Date, workDays: number): Date => {
  const d = new Date(start);
  let remaining = workDays;
  while (remaining > 0) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay(); // 0=Sun..6=Sat
    if (dow !== 5 && dow !== 6) remaining--; // skip Fri(5) & Sat(6)
  }
  return d;
};

/* Count working days between two dates (exclusive of end) */
const countWorkingDays = (start: Date, end: Date): number => {
  let count = 0;
  const d = new Date(start);
  while (d < end) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 5 && dow !== 6) count++;
  }
  return count;
};

const STAGE_COLORS: Record<string, { bar: string; barLight: string; text: string }> = {
  "STG-01": { bar: "#0ea5e9", barLight: "#bae6fd", text: "#0c4a6e" },
  "STG-02": { bar: "#10b981", barLight: "#a7f3d0", text: "#064e3b" },
  "STG-03": { bar: "#8b5cf6", barLight: "#ddd6fe", text: "#4c1d95" },
  "STG-04": { bar: "#f59e0b", barLight: "#fde68a", text: "#78350f" },
  "STG-05": { bar: "#ec4899", barLight: "#fbcfe8", text: "#831843" },
  "STG-06": { bar: "#06b6d4", barLight: "#a5f3fc", text: "#164e63" },
  "STG-07": { bar: "#ef4444", barLight: "#fecaca", text: "#7f1d1d" },
  default: { bar: "#64748b", barLight: "#cbd5e1", text: "#1e293b" },
};

const getColor = (stageCode: string) => STAGE_COLORS[stageCode] || STAGE_COLORS.default;

const STATUS_AR: Record<string, string> = {
  completed: "مكتمل",
  in_progress: "جاري",
  not_started: "لم يبدأ",
  submitted: "مُقدّم",
  blocked: "معلّق",
};

const STATUS_BADGE: Record<string, string> = {
  completed: "bg-emerald-100 text-emerald-700",
  in_progress: "bg-sky-100 text-sky-700",
  not_started: "bg-gray-100 text-gray-500",
  submitted: "bg-amber-100 text-amber-700",
  blocked: "bg-red-100 text-red-700",
};

const DOW_AR = ["أحد","اثن","ثلا","أرب","خمي","جمع","سبت"];
const MONTH_AR = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];

/* ── Row type ── */
type RowData = {
  type: "stage" | "service";
  wbs: string;
  name: string;
  stageCode: string;
  serviceCode?: string;
  status: string;
  duration: number;
  suggestedDuration: number;
  startDate: string | null;
  endDate: string | null;
  actualStart: string | null;
  actualEnd: string | null;
  pctComplete: number;
  totalServices?: number;
  completedServices?: number;
  externalParty?: string;
  internalOwner?: string;
  rowIndex?: number;
};

export default function WorkSchedulePage() {
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set());
  const [dayWidth, setDayWidth] = useState(28);
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [editStart, setEditStart] = useState("");
  const [editDuration, setEditDuration] = useState<number>(0);
  const [editEnd, setEditEnd] = useState("");
  const [editStatus, setEditStatus] = useState<string>("not_started");
  const [editPct, setEditPct] = useState<number>(0);
  const timelineRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  /* ── Drag state ── */
  const [dragInfo, setDragInfo] = useState<{
    serviceCode: string;
    stageCode: string;
    mode: "move" | "resize-end";
    startX: number;
    origStartDate: Date;
    origEndDate: Date;
    origDuration: number;
  } | null>(null);
  const [dragPreview, setDragPreview] = useState<{
    serviceCode: string;
    newStart: Date;
    newEnd: Date;
  } | null>(null);

  /* ── Filter state ── */
  type FilterMode = "all" | "overdue" | "no_dates" | "in_progress" | "not_started";
  const [filterMode, setFilterMode] = useState<FilterMode>("all");

  const projectsQuery = trpc.projects.list.useQuery();
  const scheduleQuery = trpc.lifecycle.getWorkSchedule.useQuery(
    { projectId: selectedProjectId! },
    { enabled: !!selectedProjectId }
  );
  const upsertMutation = trpc.lifecycle.upsertServiceInstance.useMutation({
    onSuccess: () => {
      toast.success("تم حفظ التواريخ بنجاح");
      scheduleQuery.refetch();
      setEditingRow(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const startEditing = (row: RowData) => {
    if (row.type !== "service") return;
    setEditingRow(row.serviceCode!);
    const sDate = row.startDate ? new Date(row.startDate).toISOString().split("T")[0] : "";
    const eDate = row.endDate ? new Date(row.endDate).toISOString().split("T")[0] : "";
    setEditStart(sDate);
    setEditEnd(eDate);
    setEditStatus(row.status || "not_started");
    setEditPct(row.pctComplete);
    if (sDate && eDate) {
      setEditDuration(countWorkingDays(new Date(sDate), new Date(eDate)));
    } else {
      setEditDuration(row.suggestedDuration > 0 ? row.suggestedDuration : (row.duration > 0 ? row.duration : 0));
    }
  };

  const recalcEnd = (start: string, dur: number) => {
    if (start && dur > 0) {
      const endDate = addWorkingDays(new Date(start), dur);
      setEditEnd(endDate.toISOString().split("T")[0]);
    }
  };

  const handleStartChange = (val: string) => {
    setEditStart(val);
    recalcEnd(val, editDuration);
  };

  const handleDurationChange = (val: number) => {
    setEditDuration(val);
    recalcEnd(editStart, val);
  };

  const saveEditing = (row: RowData) => {
    let finalEnd = editEnd;
    if (editStart && editDuration > 0 && !finalEnd) {
      finalEnd = addWorkingDays(new Date(editStart), editDuration).toISOString().split("T")[0];
    }
    upsertMutation.mutate({
      projectId: selectedProjectId!,
      serviceCode: row.serviceCode!,
      stageCode: row.stageCode,
      plannedStartDate: editStart || undefined,
      plannedDueDate: finalEnd || undefined,
      operationalStatus: editStatus as any,
    });
  };

  /* Quick status toggle (click to cycle) */
  const cycleStatus = (row: RowData) => {
    if (row.type !== "service") return;
    const cycle = ["not_started", "in_progress", "completed"];
    const currentIdx = cycle.indexOf(row.status);
    const nextStatus = cycle[(currentIdx + 1) % cycle.length];
    upsertMutation.mutate({
      projectId: selectedProjectId!,
      serviceCode: row.serviceCode!,
      stageCode: row.stageCode,
      operationalStatus: nextStatus as any,
    });
  };

  /* ── Drag handlers ── */
  const handleDragStart = useCallback((
    e: React.MouseEvent,
    row: RowData,
    mode: "move" | "resize-end",
    timelineStartDate: Date
  ) => {
    if (row.type !== "service" || !row.startDate || !row.endDate) return;
    e.preventDefault();
    e.stopPropagation();
    setDragInfo({
      serviceCode: row.serviceCode!,
      stageCode: row.stageCode,
      mode,
      startX: e.clientX,
      origStartDate: new Date(row.startDate),
      origEndDate: new Date(row.endDate),
      origDuration: row.duration,
    });
  }, []);

  useEffect(() => {
    if (!dragInfo) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragInfo.startX;
      const deltaDays = Math.round(deltaX / dayWidth);

      if (dragInfo.mode === "move") {
        const newStart = addDays(dragInfo.origStartDate, deltaDays);
        const newEnd = addDays(dragInfo.origEndDate, deltaDays);
        setDragPreview({ serviceCode: dragInfo.serviceCode, newStart, newEnd });
      } else {
        // resize-end: keep start, extend/shrink end
        const newEnd = addDays(dragInfo.origEndDate, deltaDays);
        if (newEnd > dragInfo.origStartDate) {
          setDragPreview({ serviceCode: dragInfo.serviceCode, newStart: dragInfo.origStartDate, newEnd });
        }
      }
    };

    const handleMouseUp = () => {
      if (dragPreview) {
        const startStr = dragPreview.newStart.toISOString().split("T")[0];
        const endStr = dragPreview.newEnd.toISOString().split("T")[0];
        upsertMutation.mutate({
          projectId: selectedProjectId!,
          serviceCode: dragInfo.serviceCode,
          stageCode: dragInfo.stageCode,
          plannedStartDate: startStr,
          plannedDueDate: endStr,
        });
      }
      setDragInfo(null);
      setDragPreview(null);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragInfo, dragPreview, dayWidth, selectedProjectId, upsertMutation]);

  const projects = projectsQuery.data ?? [];
  const stages = scheduleQuery.data ?? [];

  useEffect(() => {
    if (stages.length > 0 && expandedStages.size === 0) {
      setExpandedStages(new Set(stages.map((s: any) => s.stageCode)));
    }
  }, [stages.length]);

  const toggleStage = (code: string) => {
    setExpandedStages((prev) => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });
  };

  /* ── Build flat row list ── */
  const rows = useMemo(() => {
    const result: RowData[] = [];
    let stageIdx = 0;
    let globalIdx = 0;

    for (const stage of stages) {
      stageIdx++;
      const svcDates = (stage as any).services
        .filter((s: any) => s.plannedStartDate && s.plannedDueDate)
        .map((s: any) => ({
          start: new Date(s.plannedStartDate),
          end: new Date(s.plannedDueDate),
        }));
      const stageStart = svcDates.length > 0 ? new Date(Math.min(...svcDates.map((d: any) => d.start.getTime()))) : null;
      const stageEnd = svcDates.length > 0 ? new Date(Math.max(...svcDates.map((d: any) => d.end.getTime()))) : null;
      const stageDuration = stageStart && stageEnd ? daysBetween(stageStart, stageEnd) : 0;

      const totalSvcs = (stage as any).services.length;
      const completedSvcs = (stage as any).services.filter(
        (s: any) => s.operationalStatus === "completed" || s.operationalStatus === "submitted"
      ).length;
      const stagePct = totalSvcs > 0 ? Math.round((completedSvcs / totalSvcs) * 100) : 0;

      result.push({
        type: "stage",
        wbs: `${stageIdx}`,
        name: (stage as any).nameAr,
        stageCode: (stage as any).stageCode,
        status: (stage as any).status,
        duration: stageDuration,
        suggestedDuration: 0,
        startDate: stageStart ? stageStart.toISOString() : null,
        endDate: stageEnd ? stageEnd.toISOString() : null,
        actualStart: null,
        actualEnd: null,
        pctComplete: stagePct,
        totalServices: totalSvcs,
        completedServices: completedSvcs,
        rowIndex: globalIdx++,
      });

      if (expandedStages.has((stage as any).stageCode)) {
        let svcIdx = 0;
        for (const svc of (stage as any).services) {
          svcIdx++;
          const pct = svc.totalReqs > 0 ? Math.round((svc.completedReqs / svc.totalReqs) * 100) : 0;
          result.push({
            type: "service",
            wbs: `${stageIdx}.${svcIdx}`,
            name: svc.nameAr,
            stageCode: (stage as any).stageCode,
            serviceCode: svc.serviceCode,
            status: svc.operationalStatus,
            duration: svc.expectedDurationDays ?? 0,
            suggestedDuration: svc.expectedDurationDays ?? 0,
            startDate: svc.plannedStartDate,
            endDate: svc.plannedDueDate,
            actualStart: svc.actualStartDate,
            actualEnd: svc.actualCloseDate,
            pctComplete: pct,
            externalParty: svc.externalParty,
            internalOwner: svc.internalOwner,
            rowIndex: globalIdx++,
          });
        }
      }
    }
    return result;
  }, [stages, expandedStages]);

  /* ── Filter rows ── */
  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);

  const filterStats = useMemo(() => {
    const services = rows.filter(r => r.type === "service");
    const overdue = services.filter(r => {
      if (!r.endDate || r.status === "completed") return false;
      return new Date(r.endDate) < today;
    }).length;
    const noDates = services.filter(r => !r.startDate).length;
    const inProgress = services.filter(r => r.status === "in_progress").length;
    const notStarted = services.filter(r => r.status === "not_started").length;
    return { overdue, noDates, inProgress, notStarted, total: services.length };
  }, [rows, today]);

  const filteredRows = useMemo(() => {
    if (filterMode === "all") return rows;

    // Find which stages have matching services
    const matchingStages = new Set<string>();
    for (const row of rows) {
      if (row.type !== "service") continue;
      let matches = false;
      switch (filterMode) {
        case "overdue":
          matches = !!row.endDate && row.status !== "completed" && new Date(row.endDate) < today;
          break;
        case "no_dates":
          matches = !row.startDate;
          break;
        case "in_progress":
          matches = row.status === "in_progress";
          break;
        case "not_started":
          matches = row.status === "not_started";
          break;
      }
      if (matches) matchingStages.add(row.stageCode);
    }

    // Return stage headers for matching stages + matching services
    return rows.filter(row => {
      if (row.type === "stage") return matchingStages.has(row.stageCode);
      switch (filterMode) {
        case "overdue":
          return !!row.endDate && row.status !== "completed" && new Date(row.endDate) < today;
        case "no_dates":
          return !row.startDate;
        case "in_progress":
          return row.status === "in_progress";
        case "not_started":
          return row.status === "not_started";
      }
      return true;
    });
  }, [rows, filterMode, today]);

  /* ── Compute timeline range ── */
  const { timelineStart, timelineEnd, totalDays, days } = useMemo(() => {
    const allDates: Date[] = [];
    for (const row of rows) {
      if (row.startDate) allDates.push(new Date(row.startDate));
      if (row.endDate) allDates.push(new Date(row.endDate));
      if (row.actualStart) allDates.push(new Date(row.actualStart));
      if (row.actualEnd) allDates.push(new Date(row.actualEnd));
    }
    allDates.push(new Date());

    if (allDates.length <= 1) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return {
        timelineStart: today,
        timelineEnd: addDays(today, 90),
        totalDays: 90,
        days: Array.from({ length: 90 }, (_, i) => addDays(today, i)),
      };
    }

    const minDate = new Date(Math.min(...allDates.map((d) => d.getTime())));
    const maxDate = new Date(Math.max(...allDates.map((d) => d.getTime())));
    const start = addDays(minDate, -7);
    const end = addDays(maxDate, 14);
    const total = daysBetween(start, end);
    const daysArr = Array.from({ length: Math.max(total, 30) }, (_, i) => addDays(start, i));
    return { timelineStart: start, timelineEnd: end, totalDays: Math.max(total, 30), days: daysArr };
  }, [rows]);

  /* ── Build month headers ── */
  const monthHeaders = useMemo(() => {
    const headers: Array<{ label: string; startIdx: number; span: number }> = [];
    let currentMonth = -1;
    let currentYear = -1;
    let startIdx = 0;

    for (let i = 0; i < days.length; i++) {
      const d = days[i];
      const m = d.getMonth();
      const y = d.getFullYear();
      if (m !== currentMonth || y !== currentYear) {
        if (currentMonth >= 0) {
          headers.push({ label: `${MONTH_AR[currentMonth]} ${currentYear}`, startIdx, span: i - startIdx });
        }
        currentMonth = m;
        currentYear = y;
        startIdx = i;
      }
    }
    if (currentMonth >= 0) {
      headers.push({ label: `${MONTH_AR[currentMonth]} ${currentYear}`, startIdx, span: days.length - startIdx });
    }
    return headers;
  }, [days]);

  /* ── Today position ── */
  const todayIdx = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return daysBetween(timelineStart, today);
  }, [timelineStart]);

  /* ── Sync scroll ── */
  const syncScroll = (source: "table" | "timeline") => {
    if (source === "table" && tableRef.current && timelineRef.current) {
      timelineRef.current.scrollTop = tableRef.current.scrollTop;
    } else if (source === "timeline" && timelineRef.current && tableRef.current) {
      tableRef.current.scrollTop = timelineRef.current.scrollTop;
    }
  };

  /* ── Scroll to today on load ── */
  useEffect(() => {
    if (timelineRef.current && todayIdx > 0) {
      const scrollTo = todayIdx * dayWidth - 200;
      timelineRef.current.scrollLeft = Math.max(0, scrollTo);
    }
  }, [todayIdx, dayWidth, rows.length]);

  const ROW_H = 24;

  /* ── Bar position calculator ── */
  const getBarStyle = (startDate: string | null, endDate: string | null, duration: number, serviceCode?: string) => {
    // Check if there's a drag preview for this service
    if (serviceCode && dragPreview && dragPreview.serviceCode === serviceCode) {
      const startOffset = daysBetween(timelineStart, dragPreview.newStart);
      const barDays = Math.max(daysBetween(dragPreview.newStart, dragPreview.newEnd), 1);
      return { left: startOffset * dayWidth, width: barDays * dayWidth };
    }
    if (!startDate) return null;
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : addDays(start, duration);
    const startOffset = daysBetween(timelineStart, start);
    const barDays = Math.max(daysBetween(start, end), 1);
    return { left: startOffset * dayWidth, width: barDays * dayWidth };
  };

  /* ── Build dependency lines data ── */
  const dependencyLines = useMemo(() => {
    const lines: Array<{
      fromRow: number;
      toRow: number;
      fromEndX: number;
      fromY: number;
      toStartX: number;
      toY: number;
      color: string;
    }> = [];

    // For each stage, connect sequential services that have dates
    for (const stage of stages) {
      const stageCode = (stage as any).stageCode;
      const color = getColor(stageCode).bar;
      
      // Get services with dates in this stage, in order
      const servicesWithDates = (stage as any).services
        .map((svc: any, svcIdx: number) => {
          // Find the row index for this service
          const rowIdx = rows.findIndex(
            (r) => r.type === "service" && r.serviceCode === svc.serviceCode
          );
          return {
            serviceCode: svc.serviceCode,
            startDate: svc.plannedStartDate,
            endDate: svc.plannedDueDate,
            rowIdx,
          };
        })
        .filter((s: any) => s.startDate && s.endDate && s.rowIdx >= 0);

      // Connect consecutive services
      for (let i = 0; i < servicesWithDates.length - 1; i++) {
        const from = servicesWithDates[i];
        const to = servicesWithDates[i + 1];
        
        const fromEnd = new Date(from.endDate);
        const toStart = new Date(to.startDate);
        
        const fromEndX = daysBetween(timelineStart, fromEnd) * dayWidth;
        const toStartX = daysBetween(timelineStart, toStart) * dayWidth;
        const fromY = from.rowIdx * ROW_H + ROW_H / 2;
        const toY = to.rowIdx * ROW_H + ROW_H / 2;

        lines.push({ fromRow: from.rowIdx, toRow: to.rowIdx, fromEndX, fromY, toStartX, toY, color });
      }
    }
    return lines;
  }, [rows, stages, timelineStart, dayWidth]);

  if (!selectedProjectId) {
    return (
      <div className="min-h-screen bg-white" dir="rtl">
        <div className="bg-gradient-to-l from-slate-700 to-slate-800 text-white px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Calendar className="w-6 h-6 text-slate-300" />
              <div>
                <h1 className="text-xl font-bold">جدول العمل التنظيمي</h1>
                <p className="text-sm text-slate-300">مخطط جانت — جدولة مراحل DLD / RERA</p>
              </div>
            </div>
            <div className="w-64">
              <Select onValueChange={(v) => setSelectedProjectId(Number(v))}>
                <SelectTrigger className="bg-white/10 border-white/20 text-white">
                  <SelectValue placeholder="اختر المشروع..." />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p: any) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center h-[60vh] text-gray-400">
          <Calendar className="w-16 h-16 mb-4 opacity-30" />
          <p className="text-lg">اختر مشروعاً لعرض مخطط جانت</p>
        </div>
      </div>
    );
  }

  if (scheduleQuery.isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center" dir="rtl">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white" dir="rtl" style={{ cursor: dragInfo ? (dragInfo.mode === "move" ? "grabbing" : "ew-resize") : undefined }}>
      {/* Header */}
      <div className="bg-gradient-to-l from-slate-700 to-slate-800 text-white px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-slate-300" />
            <div>
              <h1 className="text-lg font-bold">جدول العمل التنظيمي</h1>
              <p className="text-xs text-slate-300">مخطط جانت — جدولة مراحل DLD / RERA</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Filter buttons */}
            <div className="flex items-center gap-1 bg-white/10 rounded-md px-2 py-1">
              <Filter className="w-3 h-3 text-slate-300 ml-1" />
              <button
                onClick={() => setFilterMode("all")}
                className={`px-2 py-0.5 rounded text-[10px] transition-colors ${
                  filterMode === "all" ? "bg-white text-slate-800 font-bold" : "text-slate-300 hover:bg-white/10"
                }`}
              >
                الكل ({filterStats.total})
              </button>
              <button
                onClick={() => setFilterMode("overdue")}
                className={`px-2 py-0.5 rounded text-[10px] transition-colors flex items-center gap-0.5 ${
                  filterMode === "overdue" ? "bg-red-500 text-white font-bold" : filterStats.overdue > 0 ? "text-red-300 hover:bg-red-500/20" : "text-slate-400 hover:bg-white/10"
                }`}
              >
                <AlertTriangle className="w-3 h-3" />
                متأخرة ({filterStats.overdue})
              </button>
              <button
                onClick={() => setFilterMode("no_dates")}
                className={`px-2 py-0.5 rounded text-[10px] transition-colors flex items-center gap-0.5 ${
                  filterMode === "no_dates" ? "bg-amber-500 text-white font-bold" : filterStats.noDates > 0 ? "text-amber-300 hover:bg-amber-500/20" : "text-slate-400 hover:bg-white/10"
                }`}
              >
                <CalendarX2 className="w-3 h-3" />
                بدون تواريخ ({filterStats.noDates})
              </button>
              <button
                onClick={() => setFilterMode("in_progress")}
                className={`px-2 py-0.5 rounded text-[10px] transition-colors flex items-center gap-0.5 ${
                  filterMode === "in_progress" ? "bg-sky-500 text-white font-bold" : "text-slate-300 hover:bg-white/10"
                }`}
              >
                <Clock className="w-3 h-3" />
                جاري ({filterStats.inProgress})
              </button>
              <button
                onClick={() => setFilterMode("not_started")}
                className={`px-2 py-0.5 rounded text-[10px] transition-colors flex items-center gap-0.5 ${
                  filterMode === "not_started" ? "bg-gray-500 text-white font-bold" : "text-slate-300 hover:bg-white/10"
                }`}
              >
                لم يبدأ ({filterStats.notStarted})
              </button>
            </div>
            {/* Drag hint */}
            <div className="text-[10px] text-slate-400 flex items-center gap-1">
              <GripVertical className="w-3 h-3" />
              <span>اسحب الأشرطة لتحريكها</span>
            </div>
            {/* Zoom controls */}
            <div className="flex items-center gap-1 bg-white/10 rounded-md px-2 py-1">
              <button onClick={() => setDayWidth((w) => Math.max(12, w - 4))} className="p-1 hover:bg-white/10 rounded">
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-xs px-2">{dayWidth}px</span>
              <button onClick={() => setDayWidth((w) => Math.min(60, w + 4))} className="p-1 hover:bg-white/10 rounded">
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>
            <div className="w-56">
              <Select value={String(selectedProjectId)} onValueChange={(v) => setSelectedProjectId(Number(v))}>
                <SelectTrigger className="bg-white/10 border-white/20 text-white h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p: any) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Main content: table + timeline side by side */}
      <div className="flex h-[calc(100vh-64px)] overflow-hidden">
        {/* LEFT: Task table */}
        <div className="flex-shrink-0 border-l border-gray-200" style={{ width: 620 }}>
          {/* Table header */}
          <div className="bg-gradient-to-l from-cyan-600 to-cyan-700 text-white text-xs font-semibold" style={{ height: 52 }}>
            <div className="flex items-center h-full">
             <div className="w-8 text-center border-l border-cyan-500/40 h-full flex items-center justify-center text-[10px]">WBS</div>
              <div className="flex-1 pr-2 border-l border-cyan-500/40 h-full flex items-center text-[10px]">المهمة</div>
              <div className="w-14 text-center border-l border-cyan-500/40 h-full flex items-center justify-center cursor-pointer text-[10px]" title="انقر لتغيير الحالة">الحالة</div>
              <div className="w-16 text-center border-l border-cyan-500/40 h-full flex items-center justify-center text-[10px]">البدء</div>
              <div className="w-16 text-center border-l border-cyan-500/40 h-full flex items-center justify-center text-[10px]">الانتهاء</div>
              <div className="w-10 text-center border-l border-cyan-500/40 h-full flex items-center justify-center text-cyan-200 text-[10px]" title="المدة المقترحة من النظام">مقترح</div>
              <div className="w-10 text-center border-l border-cyan-500/40 h-full flex items-center justify-center text-[10px]" title="أيام عمل فعلية (أحد-خميس)">المدة</div>
              <div className="w-6 text-center border-l border-cyan-500/40 h-full flex items-center justify-center text-[10px]">✓</div>
              <div className="w-12 text-center h-full flex items-center justify-center text-[10px]">%</div>
            </div>
          </div>

          {/* Table body */}
          <div
            ref={tableRef}
            className="overflow-y-auto overflow-x-hidden"
            style={{ height: "calc(100vh - 116px)" }}
            onScroll={() => syncScroll("table")}
          >
            {filteredRows.map((row, idx) => {
              const isStage = row.type === "stage";
              const isExpanded = expandedStages.has(row.stageCode);
              const color = getColor(row.stageCode);
              // Highlight overdue rows
              const isOverdue = row.type === "service" && row.endDate && row.status !== "completed" && new Date(row.endDate) < today;
              const bgClass = isStage ? "bg-gray-50 font-bold" : isOverdue ? "bg-red-50" : idx % 2 === 0 ? "bg-white" : "bg-gray-50/50";
              const isDragging = dragInfo?.serviceCode === row.serviceCode;

              return (
                <div
                  key={`${row.wbs}-${row.serviceCode || row.stageCode}`}
                  className={`flex items-center text-xs border-b border-gray-100 ${bgClass} ${isDragging ? "bg-blue-50" : "hover:bg-blue-50/30"} transition-colors`}
                  style={{ height: ROW_H }}
                >
                  {/* WBS */}
                  <div className="w-8 text-center text-gray-500 font-mono border-l border-gray-100 text-[9px]">
                    {row.wbs}
                  </div>

                  {/* Task name */}
                  <div
                    className={`flex-1 pr-1 truncate border-l border-gray-100 flex items-center gap-0.5 text-[10px] ${isStage ? "cursor-pointer" : "pr-3"}`}
                    onClick={isStage ? () => toggleStage(row.stageCode) : undefined}
                    style={{ color: isStage ? color.text : "#374151" }}
                  >
                    {isStage && (
                      <ChevronDown
                        className={`w-3 h-3 flex-shrink-0 transition-transform ${isExpanded ? "" : "-rotate-90"}`}
                        style={{ color: color.bar }}
                      />
                    )}
                    <span className="truncate">{row.name}</span>
                    {isStage && (
                      <span className="text-[8px] text-gray-400 mr-0.5">
                        ({row.completedServices}/{row.totalServices})
                      </span>
                    )}
                  </div>

                  {/* Status - clickable to cycle */}
                  <div
                    className={`w-14 text-center border-l border-gray-100 ${!isStage ? "cursor-pointer" : ""}`}
                    onClick={() => !isStage && cycleStatus(row)}
                    title={!isStage ? "انقر لتغيير الحالة" : undefined}
                  >
                    {editingRow === row.serviceCode ? (
                      <select
                        value={editStatus}
                        onChange={(e) => setEditStatus(e.target.value)}
                        className="w-full text-[8px] border border-blue-300 rounded bg-white px-0 py-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <option value="not_started">لم يبدأ</option>
                        <option value="in_progress">جاري</option>
                        <option value="completed">مكتمل</option>
                      </select>
                    ) : (
                      <span className={`inline-block px-1 py-0 rounded text-[9px] font-medium ${STATUS_BADGE[row.status] || STATUS_BADGE.not_started}`}>
                        {STATUS_AR[row.status] || row.status}
                      </span>
                    )}
                  </div>

                  {/* Start date */}
                  <div
                    className={`w-16 text-center text-[9px] border-l border-gray-100 ${!isStage && !editingRow ? "cursor-pointer hover:bg-blue-50" : ""} ${editingRow === row.serviceCode ? "p-0" : "text-gray-600"}`}
                    onClick={() => !isStage && editingRow !== row.serviceCode && startEditing(row)}
                  >
                    {editingRow === row.serviceCode ? (
                      <input
                        type="date"
                        value={editStart}
                        onChange={(e) => handleStartChange(e.target.value)}
                        className="w-full h-full text-[8px] border border-blue-300 rounded px-0 bg-white"
                      />
                    ) : (
                      fmtDateShort(row.startDate)
                    )}
                  </div>

                  {/* End date (read-only, auto-computed) */}
                  <div
                    className={`w-16 text-center text-[9px] border-l border-gray-100 ${editingRow === row.serviceCode ? "p-0 bg-gray-50" : "text-gray-600"}`}
                  >
                    {editingRow === row.serviceCode ? (
                      <div className="flex items-center gap-0.5">
                        <span className="flex-1 text-[8px] text-gray-500 bg-gray-100 rounded px-0.5 py-0">
                          {editEnd ? fmtDateShort(editEnd) : "\u2014"}
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); saveEditing(row); }}
                          className="p-0.5 bg-emerald-500 text-white rounded hover:bg-emerald-600 flex-shrink-0"
                          title="\u062d\u0641\u0638"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      fmtDateShort(row.endDate)
                    )}
                  </div>

                  {/* Suggested Duration (read-only, from system) */}
                  <div className="w-10 text-center border-l border-gray-100 text-[9px] text-cyan-600 font-medium">
                    {!isStage && row.suggestedDuration > 0 ? (
                      <span className="bg-cyan-50 px-0.5 py-0 rounded text-[8px]">{row.suggestedDuration}d</span>
                    ) : isStage ? "" : "\u2014"}
                  </div>

                  {/* Actual Duration (editable) */}
                  <div
                    className={`w-10 text-center border-l border-gray-100 text-[9px] ${editingRow === row.serviceCode ? "p-0" : "text-gray-600"}`}
                    onClick={() => !isStage && editingRow !== row.serviceCode && startEditing(row)}
                  >
                    {editingRow === row.serviceCode ? (
                      <input
                        type="number"
                        min={1}
                        value={editDuration || ""}
                        onChange={(e) => handleDurationChange(Number(e.target.value))}
                        className="w-full h-full text-[8px] border border-blue-300 rounded px-0 bg-white text-center"
                      />
                    ) : (
                      row.duration > 0 ? `${row.duration}d` : "\u2014"
                    )}
                  </div>

                  {/* Done check */}
                  <div className="w-6 text-center border-l border-gray-100">
                    {(row.status === "completed" || row.pctComplete === 100) && (
                      <Check className="w-3 h-3 text-emerald-500 mx-auto" />
                    )}
                  </div>

                  {/* % Complete - editable for services */}
                  <div className="w-12 text-center">
                    <div className="flex items-center justify-center gap-0.5">
                      <div className="w-6 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${row.pctComplete}%`,
                            backgroundColor: row.pctComplete === 100 ? "#10b981" : row.pctComplete >= 50 ? "#0ea5e9" : "#f59e0b",
                          }}
                        />
                      </div>
                      <span className="text-[8px] text-gray-500">{row.pctComplete}%</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT: Timeline / Gantt bars */}
        <div className="flex-1 overflow-hidden">
          {/* Timeline header */}
          <div className="bg-gradient-to-l from-cyan-600 to-cyan-700 text-white" style={{ height: 52 }}>
            {/* Month row */}
            <div className="flex text-[10px] font-semibold" style={{ height: 22, width: totalDays * dayWidth }}>
              {monthHeaders.map((mh, i) => (
                <div
                  key={i}
                  className="border-l border-cyan-500/40 flex items-center justify-center"
                  style={{ width: mh.span * dayWidth, marginRight: i === 0 ? mh.startIdx * dayWidth : 0 }}
                >
                  {mh.label}
                </div>
              ))}
            </div>
            {/* Day numbers + day-of-week row */}
            <div className="flex" style={{ height: 30, width: totalDays * dayWidth }}>
              {days.map((d, i) => {
                const isWeekend = d.getDay() === 5 || d.getDay() === 6;
                const isToday = daysBetween(d, new Date()) === 0;
                return (
                  <div
                    key={i}
                    className={`flex flex-col items-center justify-center border-l text-[8px] ${
                      isWeekend ? "bg-cyan-800/30 border-cyan-500/30" : "border-cyan-500/20"
                    } ${isToday ? "bg-yellow-500/40" : ""}`}
                    style={{ width: dayWidth, minWidth: dayWidth }}
                  >
                    <span className="font-medium">{d.getDate()}</span>
                    {dayWidth >= 20 && (
                      <span className="text-[8px] opacity-70">{DOW_AR[d.getDay()]}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Timeline body with bars */}
          <div
            ref={timelineRef}
            className="overflow-auto"
            style={{ height: "calc(100vh - 116px)" }}
            onScroll={(e) => {
              syncScroll("timeline");
              const target = e.currentTarget;
              const headerEl = target.previousElementSibling;
              if (headerEl) {
                const monthRow = headerEl.children[0] as HTMLElement;
                const dayRow = headerEl.children[1] as HTMLElement;
                if (monthRow) monthRow.style.transform = `translateX(-${target.scrollLeft}px)`;
                if (dayRow) dayRow.style.transform = `translateX(-${target.scrollLeft}px)`;
              }
            }}
          >
            <div style={{ width: totalDays * dayWidth, position: "relative" }}>
              {/* Background grid */}
              <div className="absolute inset-0" style={{ height: filteredRows.length * ROW_H }}>
                {days.map((d, i) => {
                  const isWeekend = d.getDay() === 5 || d.getDay() === 6;
                  return (
                    <div
                      key={i}
                      className={`absolute top-0 bottom-0 border-l ${
                        isWeekend ? "bg-gray-50 border-gray-200/50" : "border-gray-100/50"
                      }`}
                      style={{ left: i * dayWidth, width: dayWidth }}
                    />
                  );
                })}
              </div>

              {/* Today line */}
              {todayIdx >= 0 && todayIdx < totalDays && (
                <div
                  className="absolute top-0 z-20"
                  style={{
                    left: todayIdx * dayWidth + dayWidth / 2,
                    height: filteredRows.length * ROW_H,
                    width: 2,
                    backgroundColor: "#eab308",
                  }}
                >
                  <div className="absolute -top-1 -right-2 w-5 h-3 bg-yellow-500 rounded-sm text-[8px] text-white flex items-center justify-center font-bold">
                    اليوم
                  </div>
                </div>
              )}

              {/* Dependency arrows (SVG overlay) */}
              {dependencyLines.length > 0 && (
                <svg
                  className="absolute top-0 left-0 pointer-events-none z-10"
                  style={{ width: totalDays * dayWidth, height: filteredRows.length * ROW_H }}
                >
                  <defs>
                    {/* Arrow markers for each color */}
                    {Object.entries(STAGE_COLORS).map(([key, val]) => (
                      <marker
                        key={key}
                        id={`arrow-${key}`}
                        markerWidth="8"
                        markerHeight="6"
                        refX="8"
                        refY="3"
                        orient="auto"
                      >
                        <polygon points="0 0, 8 3, 0 6" fill={val.bar} opacity="0.6" />
                      </marker>
                    ))}
                    <marker
                      id="arrow-default"
                      markerWidth="8"
                      markerHeight="6"
                      refX="8"
                      refY="3"
                      orient="auto"
                    >
                      <polygon points="0 0, 8 3, 0 6" fill="#64748b" opacity="0.6" />
                    </marker>
                  </defs>
                  {dependencyLines.map((line, i) => {
                    // Find the stage code for the marker
                    const fromRow = rows[line.fromRow];
                    const markerKey = fromRow ? (STAGE_COLORS[fromRow.stageCode] ? fromRow.stageCode : "default") : "default";
                    
                    // Draw an L-shaped or S-shaped connector
                    const midX = line.fromEndX + (line.toStartX - line.fromEndX) / 2;
                    const path = `M ${line.fromEndX} ${line.fromY} L ${midX} ${line.fromY} L ${midX} ${line.toY} L ${line.toStartX} ${line.toY}`;
                    
                    return (
                      <path
                        key={i}
                        d={path}
                        fill="none"
                        stroke={line.color}
                        strokeWidth="1.5"
                        strokeOpacity="0.5"
                        strokeDasharray="4 2"
                        markerEnd={`url(#arrow-${markerKey})`}
                      />
                    );
                  })}
                </svg>
              )}

              {/* Row bars */}
              {filteredRows.map((row, idx) => {
                const isStage = row.type === "stage";
                const color = getColor(row.stageCode);
                const barStyle = getBarStyle(row.startDate, row.endDate, row.duration, row.serviceCode);
                const isDragging = dragInfo?.serviceCode === row.serviceCode;

                if (!barStyle) {
                  return (
                    <div
                      key={`bar-${row.wbs}`}
                      className={`border-b border-gray-100 ${isStage ? "bg-gray-50/50" : ""}`}
                      style={{ height: ROW_H }}
                    />
                  );
                }

                return (
                  <div
                    key={`bar-${row.wbs}`}
                    className={`relative border-b border-gray-100 ${isStage ? "bg-gray-50/50" : ""}`}
                    style={{ height: ROW_H }}
                  >
                    {isStage ? (
                      /* Stage bar: thinner summary bar with diamond ends */
                      <div
                        className="absolute flex items-center"
                        style={{
                          top: ROW_H / 2 - 3,
                          left: barStyle.left,
                          width: barStyle.width,
                          height: 6,
                        }}
                      >
                        <div
                          className="w-full h-full rounded-sm relative overflow-hidden"
                          style={{ backgroundColor: color.bar }}
                        >
                          <div
                            className="absolute inset-0 rounded-sm"
                            style={{ width: `${row.pctComplete}%`, backgroundColor: color.bar, opacity: 1 }}
                          />
                          <div
                            className="absolute inset-0 rounded-sm"
                            style={{ left: `${row.pctComplete}%`, backgroundColor: color.barLight }}
                          />
                        </div>
                        {/* Diamond start */}
                        <div
                          className="absolute -right-1 w-2 h-2 rotate-45"
                          style={{ backgroundColor: color.bar, top: -1 }}
                        />
                        {/* Diamond end */}
                        <div
                          className="absolute -left-1 w-2 h-2 rotate-45"
                          style={{ backgroundColor: color.bar, top: -1 }}
                        />
                      </div>
                    ) : (
                      /* Service bar: draggable colored bar */
                      <div
                        className={`absolute rounded-sm flex items-center overflow-visible shadow-sm group ${isDragging ? "opacity-70 ring-2 ring-blue-400" : ""}`}
                        style={{
                          top: ROW_H / 2 - 7,
                          left: barStyle.left,
                          width: barStyle.width,
                          height: 14,
                          backgroundColor: color.barLight,
                          border: `1px solid ${color.bar}40`,
                          cursor: row.startDate && row.endDate ? "grab" : "default",
                          userSelect: "none",
                        }}
                        onMouseDown={(e) => handleDragStart(e, row, "move", timelineStart)}
                      >
                        {/* Progress fill */}
                        <div
                          className="absolute inset-0 rounded-sm pointer-events-none"
                          style={{
                            width: `${row.pctComplete}%`,
                            backgroundColor: color.bar,
                            opacity: 0.7,
                          }}
                        />
                        {/* Label inside bar */}
                        {barStyle.width > 60 && (
                          <span
                            className="relative z-10 text-[9px] font-medium px-1.5 truncate pointer-events-none"
                            style={{ color: row.pctComplete > 50 ? "#fff" : color.text }}
                          >
                            {row.name}
                          </span>
                        )}
                        {/* Resize handle on the LEFT end (since RTL, left = end of bar) */}
                        {row.startDate && row.endDate && (
                          <div
                            className="absolute top-0 left-0 w-2 h-full cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity z-20"
                            style={{ backgroundColor: color.bar + "80" }}
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              handleDragStart(e, row, "resize-end", timelineStart);
                            }}
                          >
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-3 bg-white rounded-full" />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Drag tooltip */}
      {dragPreview && (
        <div
          className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs px-4 py-2 rounded-lg shadow-lg z-50 flex items-center gap-3"
        >
          <span>البدء: {fmtDateShort(dragPreview.newStart.toISOString())}</span>
          <span className="text-slate-400">|</span>
          <span>الانتهاء: {fmtDateShort(dragPreview.newEnd.toISOString())}</span>
          <span className="text-slate-400">|</span>
          <span>المدة: {daysBetween(dragPreview.newStart, dragPreview.newEnd)}d</span>
        </div>
      )}
    </div>
  );
}
