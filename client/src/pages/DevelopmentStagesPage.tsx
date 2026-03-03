import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import {
  Building2, ChevronDown, ChevronRight, CheckCircle2, Circle, Clock,
  Plus, Trash2, Upload, FileText, Loader2, AlertTriangle, X,
  Zap, BarChart3, FolderOpen, Shield, Briefcase, HardHat, Home,
  Paperclip, Download, Eye, Bot, ExternalLink, Users,
  CalendarDays, CalendarClock, Bell, Timer,
} from "lucide-react";
import { useLocation } from "wouter";
import { format, formatDistanceToNow, isPast, isWithinInterval, addDays } from "date-fns";
import { ar } from "date-fns/locale";

// ═══════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════

type StageItem = {
  id: number;
  projectId: number;
  phaseNumber: number;
  sectionKey: string;
  itemIndex: number;
  title: string;
  status: "not_started" | "in_progress" | "completed";
  isCustom: boolean;
  linkedTaskId: number | null;
  dueDate: Date | string | null;
  createdAt: Date;
  updatedAt: Date;
};

type LinkedTaskInfo = {
  id: number;
  title: string;
  status: string;
  owner: string;
  priority: string;
  source: string;
  sourceAgent: string | null;
};

// Agent mapping for UI display (mirrors server-side mapping)
const SECTION_AGENT_MAP: Record<string, { primary: string; secondary?: string }> = {
  "2.1": { primary: "فاروق" }, "2.2": { primary: "فاروق" },
  "2.3": { primary: "فاروق" }, "2.4": { primary: "فاروق", secondary: "خالد" },
  "3.1": { primary: "خالد", secondary: "باز" }, "3.2": { primary: "خالد" },
  "3.3": { primary: "خالد", secondary: "فاروق" }, "3.4": { primary: "خالد", secondary: "ألينا" },
  "4.1": { primary: "ألينا", secondary: "جويل" }, "4.2": { primary: "باز" },
  "4.3": { primary: "ألينا" },
  "5.1": { primary: "براق" }, "5.2": { primary: "براق", secondary: "خالد" },
  "5.3": { primary: "براق", secondary: "خالد" }, "5.4": { primary: "خالد", secondary: "براق" },
  "6.1": { primary: "براق", secondary: "فاروق" }, "6.2": { primary: "خالد" },
  "6.3": { primary: "سلوى", secondary: "خالد" },
};

const AGENT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  "فاروق": { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  "خالد": { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  "باز": { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
  "ألينا": { bg: "bg-pink-50", text: "text-pink-700", border: "border-pink-200" },
  "جويل": { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  "براق": { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" },
  "سلوى": { bg: "bg-yellow-50", text: "text-yellow-700", border: "border-yellow-200" },
  "خازن": { bg: "bg-teal-50", text: "text-teal-700", border: "border-teal-200" },
};

type StageDocument = {
  id: number;
  stageItemId: number;
  projectId: number;
  fileName: string;
  fileUrl: string;
  fileKey: string;
  mimeType: string | null;
  fileSize: number | null;
  uploadedAt: Date;
};

// ═══════════════════════════════════════════
// CONSTANTS - Stage metadata (titles, icons, colors)
// ═══════════════════════════════════════════

const PHASE_META: Record<number, {
  title: string;
  titleEn: string;
  icon: typeof Building2;
  color: string;
  bgColor: string;
  borderColor: string;
  sections: Record<string, { title: string; titleEn: string }>;
}> = {
  2: {
    title: "الإعداد القانوني والتسجيل",
    titleEn: "Legal Setup & Registration",
    icon: Shield,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    sections: {
      "2.1": { title: "تأسيس الشركة", titleEn: "Company Formation" },
      "2.2": { title: "تسجيل المشروع", titleEn: "Project Registration" },
      "2.3": { title: "الاتفاقيات القانونية", titleEn: "Legal Agreements" },
      "2.4": { title: "التأمين والامتثال", titleEn: "Insurance & Compliance" },
    },
  },
  3: {
    title: "التصميم والتصاريح",
    titleEn: "Design & Permits",
    icon: Briefcase,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200",
    sections: {
      "3.1": { title: "التصميم المعماري", titleEn: "Architectural Design" },
      "3.2": { title: "التصميم الهندسي", titleEn: "Engineering Design" },
      "3.3": { title: "التصاريح والموافقات", titleEn: "Permits & Approvals" },
      "3.4": { title: "المواصفات والمقايسات", titleEn: "Specifications & BOQ" },
    },
  },
  4: {
    title: "التمويل والتسويق",
    titleEn: "Financing & Marketing",
    icon: BarChart3,
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-200",
    sections: {
      "4.1": { title: "التمويل", titleEn: "Financing" },
      "4.2": { title: "التسويق والمبيعات", titleEn: "Marketing & Sales" },
      "4.3": { title: "إدارة المبيعات", titleEn: "Sales Management" },
    },
  },
  5: {
    title: "البناء والتنفيذ",
    titleEn: "Construction",
    icon: HardHat,
    color: "text-orange-600",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-200",
    sections: {
      "5.1": { title: "التحضير للبناء", titleEn: "Pre-Construction" },
      "5.2": { title: "الأعمال الإنشائية", titleEn: "Structural Works" },
      "5.3": { title: "أعمال التشطيبات", titleEn: "Finishing Works" },
      "5.4": { title: "مراقبة الجودة والتسليم", titleEn: "Quality Control & Handover" },
    },
  },
  6: {
    title: "التسليم وخدمات ما بعد البيع",
    titleEn: "Handover & After-sales",
    icon: Home,
    color: "text-teal-600",
    bgColor: "bg-teal-50",
    borderColor: "border-teal-200",
    sections: {
      "6.1": { title: "تسليم الوحدات", titleEn: "Unit Handover" },
      "6.2": { title: "إدارة المرافق", titleEn: "Facility Management" },
      "6.3": { title: "خدمات ما بعد البيع", titleEn: "After-sales Services" },
    },
  },
};

const STATUS_CONFIG = {
  not_started: { label: "لم يبدأ", icon: Circle, color: "text-gray-400", bg: "bg-gray-100", badge: "bg-gray-100 text-gray-600" },
  in_progress: { label: "جارٍ", icon: Clock, color: "text-amber-500", bg: "bg-amber-50", badge: "bg-amber-100 text-amber-700" },
  completed: { label: "مكتمل", icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-50", badge: "bg-emerald-100 text-emerald-700" },
};

const NEXT_STATUS: Record<string, "not_started" | "in_progress" | "completed"> = {
  not_started: "in_progress",
  in_progress: "completed",
  completed: "not_started",
};

// ═══════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function parseDueDate(d: Date | string | null): Date | null {
  if (!d) return null;
  const date = typeof d === "string" ? new Date(d) : d;
  return isNaN(date.getTime()) ? null : date;
}

function getDueDateStatus(dueDate: Date | null, status: string): "overdue" | "due_soon" | "on_track" | "none" {
  if (!dueDate || status === "completed") return "none";
  const now = new Date();
  if (isPast(dueDate)) return "overdue";
  if (isWithinInterval(now, { start: now, end: addDays(now, 3) }) && dueDate <= addDays(now, 3)) return "due_soon";
  return "on_track";
}

// ═══════════════════════════════════════════
// DUE DATE PICKER COMPONENT
// ═══════════════════════════════════════════

function DueDatePicker({
  dueDate,
  onSetDate,
  status,
  compact,
}: {
  dueDate: Date | null;
  onSetDate: (date: string | null) => void;
  status: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const dueDateStatus = getDueDateStatus(dueDate, status);

  const handleSelect = (day: Date | undefined) => {
    if (day) {
      onSetDate(day.toISOString());
    }
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSetDate(null);
  };

  if (status === "completed" && !dueDate) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all ${
            dueDateStatus === "overdue"
              ? "bg-red-50 text-red-700 border-red-300 animate-pulse"
              : dueDateStatus === "due_soon"
              ? "bg-orange-50 text-orange-700 border-orange-300"
              : dueDate
              ? "bg-sky-50 text-sky-700 border-sky-200"
              : "bg-gray-50 text-gray-500 border-gray-200 opacity-0 group-hover:opacity-100"
          }`}
          title={dueDate ? `التاريخ المستهدف: ${format(dueDate, "dd/MM/yyyy")}` : "تعيين تاريخ مستهدف"}
        >
          {dueDateStatus === "overdue" ? (
            <AlertTriangle className="w-3 h-3" />
          ) : dueDateStatus === "due_soon" ? (
            <Timer className="w-3 h-3" />
          ) : (
            <CalendarDays className="w-3 h-3" />
          )}
          {dueDate ? (
            <>
              {compact ? format(dueDate, "dd/MM") : format(dueDate, "dd MMM yyyy", { locale: ar })}
              {dueDateStatus === "overdue" && (
                <span className="text-[9px] opacity-80 mr-0.5">
                  (متأخر {formatDistanceToNow(dueDate, { locale: ar })})
                </span>
              )}
              {dueDateStatus === "due_soon" && (
                <span className="text-[9px] opacity-80 mr-0.5">
                  (قريب)
                </span>
              )}
            </>
          ) : (
            <span>تاريخ</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="p-2 border-b flex items-center justify-between">
          <span className="text-xs font-bold text-muted-foreground">التاريخ المستهدف</span>
          {dueDate && (
            <Button variant="ghost" size="sm" className="h-6 text-xs text-red-600 hover:text-red-700" onClick={handleClear}>
              <X className="w-3 h-3 ml-1" />
              إزالة
            </Button>
          )}
        </div>
        <Calendar
          mode="single"
          selected={dueDate || undefined}
          onSelect={handleSelect}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}

// ═══════════════════════════════════════════
// OVERDUE ALERT BANNER
// ═══════════════════════════════════════════

function OverdueAlertBanner({
  overdueCount,
  dueSoonCount,
  onViewOverdue,
}: {
  overdueCount: number;
  dueSoonCount: number;
  onViewOverdue: () => void;
}) {
  if (overdueCount === 0 && dueSoonCount === 0) return null;

  return (
    <div className={`rounded-xl border-2 px-5 py-4 flex items-center gap-4 ${
      overdueCount > 0
        ? "bg-red-50 border-red-200"
        : "bg-orange-50 border-orange-200"
    }`}>
      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
        overdueCount > 0 ? "bg-red-100" : "bg-orange-100"
      }`}>
        {overdueCount > 0 ? (
          <AlertTriangle className="w-5 h-5 text-red-600" />
        ) : (
          <Bell className="w-5 h-5 text-orange-600" />
        )}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-3">
          {overdueCount > 0 && (
            <span className="text-sm font-bold text-red-700">
              {overdueCount} مهمة متأخرة
            </span>
          )}
          {dueSoonCount > 0 && (
            <span className="text-sm font-bold text-orange-700">
              {dueSoonCount} مهمة تستحق قريباً
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {overdueCount > 0
            ? "يوجد مهام تجاوزت التاريخ المستهدف ولم تكتمل بعد"
            : "يوجد مهام ستستحق خلال 3 أيام"}
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={onViewOverdue}
        className={overdueCount > 0 ? "border-red-300 text-red-700 hover:bg-red-100" : "border-orange-300 text-orange-700 hover:bg-orange-100"}
      >
        <Eye className="w-3.5 h-3.5 ml-1" />
        عرض التفاصيل
      </Button>
    </div>
  );
}

// ═══════════════════════════════════════════
// OVERDUE ITEMS VIEW
// ═══════════════════════════════════════════

function OverdueItemsView({ items }: { items: StageItem[] }) {
  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-emerald-400/50" />
        <p className="text-sm text-muted-foreground">لا توجد مهام متأخرة — عمل ممتاز!</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const phaseMeta = PHASE_META[item.phaseNumber];
        const sectionMeta = phaseMeta?.sections[item.sectionKey];
        const dueDate = parseDueDate(item.dueDate);
        const agentMapping = SECTION_AGENT_MAP[item.sectionKey];
        const agentColor = agentMapping ? AGENT_COLORS[agentMapping.primary] : null;

        return (
          <div key={item.id} className="flex items-center gap-3 bg-red-50/80 border border-red-200/70 rounded-lg px-4 py-3">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium">{item.title}</p>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-xs text-muted-foreground">
                  المرحلة {item.phaseNumber} — {sectionMeta?.title || item.sectionKey}
                </p>
                {agentMapping && (
                  <span className={`flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${
                    agentColor ? `${agentColor.bg} ${agentColor.text} ${agentColor.border}` : "bg-gray-50 text-gray-600 border-gray-200"
                  }`}>
                    <Bot className="w-2.5 h-2.5" />
                    {agentMapping.primary}
                  </span>
                )}
              </div>
            </div>
            <div className="text-left flex-shrink-0">
              {dueDate && (
                <div className="text-xs">
                  <p className="font-bold text-red-700">{format(dueDate, "dd MMM yyyy", { locale: ar })}</p>
                  <p className="text-red-500 text-[10px]">
                    متأخر {formatDistanceToNow(dueDate, { locale: ar })}
                  </p>
                </div>
              )}
            </div>
            <Badge variant="outline" className={`text-[10px] ${
              item.status === "in_progress"
                ? "bg-amber-100 text-amber-700 border-amber-200"
                : "bg-gray-100 text-gray-600 border-gray-200"
            }`}>
              {STATUS_CONFIG[item.status]?.label || item.status}
            </Badge>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════
// TASK ITEM COMPONENT
// ═══════════════════════════════════════════

function TaskItem({
  item,
  documents,
  onStatusChange,
  onDelete,
  onUpload,
  onDeleteDoc,
  isUpdating,
  linkedTaskInfo,
  onSetDueDate,
}: {
  item: StageItem;
  documents: StageDocument[];
  onStatusChange: (id: number, status: "not_started" | "in_progress" | "completed") => void;
  onDelete: (id: number) => void;
  onUpload: (itemId: number, file: File) => void;
  onDeleteDoc: (docId: number) => void;
  isUpdating: boolean;
  linkedTaskInfo?: { taskId: number; owner: string; status: string } | null;
  onSetDueDate: (id: number, date: string | null) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showDocs, setShowDocs] = useState(false);
  const statusConf = STATUS_CONFIG[item.status];
  const StatusIcon = statusConf.icon;

  // Get agent info for this section
  const agentMapping = SECTION_AGENT_MAP[item.sectionKey];
  const agentColor = agentMapping ? AGENT_COLORS[agentMapping.primary] : null;

  // Due date info
  const dueDate = parseDueDate(item.dueDate);
  const dueDateStatus = getDueDateStatus(dueDate, item.status);

  return (
    <div className={`group rounded-lg border transition-all hover:shadow-sm ${
      dueDateStatus === "overdue"
        ? "bg-red-50/40 border-red-200/70 ring-1 ring-red-200/50"
        : dueDateStatus === "due_soon"
        ? "bg-orange-50/30 border-orange-200/50"
        : item.status === "completed" ? "bg-emerald-50/50 border-emerald-200/50" :
        item.status === "in_progress" ? "bg-amber-50/50 border-amber-200/50" :
        "bg-white border-gray-200/70"
    }`}>
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Status toggle button */}
        <button
          onClick={() => onStatusChange(item.id, NEXT_STATUS[item.status])}
          disabled={isUpdating}
          className={`flex-shrink-0 transition-all hover:scale-110 ${statusConf.color} ${isUpdating ? "opacity-50" : ""}`}
          title={`الحالة: ${statusConf.label} — اضغط للتغيير`}
        >
          {isUpdating ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <StatusIcon className="w-5 h-5" />
          )}
        </button>

        {/* Task title */}
        <span className={`flex-1 text-sm font-medium ${
          item.status === "completed" ? "line-through text-muted-foreground/60" : "text-foreground"
        }`}>
          {item.title}
        </span>

        {/* Due date picker */}
        <DueDatePicker
          dueDate={dueDate}
          onSetDate={(date) => onSetDueDate(item.id, date)}
          status={item.status}
          compact
        />

        {/* Agent badge - shows which agent is responsible */}
        {agentMapping && item.status !== "not_started" && (
          <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
            agentColor ? `${agentColor.bg} ${agentColor.text} ${agentColor.border}` : "bg-gray-50 text-gray-600 border-gray-200"
          }`} title={`الوكيل المسؤول: ${agentMapping.primary}${agentMapping.secondary ? ` + ${agentMapping.secondary}` : ""}`}>
            <Bot className="w-3 h-3" />
            {agentMapping.primary}
          </span>
        )}

        {/* Linked task indicator */}
        {linkedTaskInfo && (
          <span
            className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 cursor-pointer hover:bg-indigo-100 transition-colors"
            title={`مهمة مرتبطة #${linkedTaskInfo.taskId} - ${linkedTaskInfo.owner}`}
          >
            <ExternalLink className="w-3 h-3" />
            مهمة #{linkedTaskInfo.taskId}
          </span>
        )}

        {/* Status badge */}
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusConf.badge}`}>
          {statusConf.label}
        </span>

        {/* Document count */}
        {documents.length > 0 && (
          <button
            onClick={() => setShowDocs(!showDocs)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Paperclip className="w-3.5 h-3.5" />
            <span>{documents.length}</span>
          </button>
        )}

        {/* Upload button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
          title="رفع ملف"
        >
          <Upload className="w-4 h-4" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              if (file.size > 10 * 1024 * 1024) {
                toast.error("حجم الملف يجب أن يكون أقل من 10 ميجابايت");
                return;
              }
              onUpload(item.id, file);
              e.target.value = "";
            }
          }}
        />

        {/* Delete custom task */}
        {item.isCustom && (
          <button
            onClick={() => {
              if (confirm("هل تريد حذف هذه المهمة؟")) onDelete(item.id);
            }}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive/60 hover:text-destructive"
            title="حذف المهمة"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Documents section */}
      {(showDocs || documents.length > 0) && documents.length > 0 && showDocs && (
        <div className="px-4 pb-3 pt-0 border-t border-dashed border-gray-200/70">
          <div className="flex flex-wrap gap-2 mt-2">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center gap-1.5 bg-gray-50 rounded-md px-2.5 py-1.5 text-xs group/doc"
              >
                <FileText className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                <a
                  href={doc.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline max-w-[150px] truncate"
                  title={doc.fileName}
                >
                  {doc.fileName}
                </a>
                {doc.fileSize && (
                  <span className="text-muted-foreground/50">{formatFileSize(doc.fileSize)}</span>
                )}
                <button
                  onClick={() => {
                    if (confirm("حذف هذا الملف؟")) onDeleteDoc(doc.id);
                  }}
                  className="opacity-0 group-hover/doc:opacity-100 text-destructive/60 hover:text-destructive transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
// SECTION COMPONENT
// ═══════════════════════════════════════════

function SectionBlock({
  sectionKey,
  sectionMeta,
  items,
  documents,
  onStatusChange,
  onDelete,
  onUpload,
  onDeleteDoc,
  onAddTask,
  onSetDueDate,
  updatingIds,
  phaseColor,
  linkedTasks,
  taskDetails,
}: {
  sectionKey: string;
  sectionMeta: { title: string; titleEn: string };
  items: StageItem[];
  documents: Record<number, StageDocument[]>;
  onStatusChange: (id: number, status: "not_started" | "in_progress" | "completed") => void;
  onDelete: (id: number) => void;
  onUpload: (itemId: number, file: File) => void;
  onDeleteDoc: (docId: number) => void;
  onAddTask: (sectionKey: string, title: string) => void;
  onSetDueDate: (id: number, date: string | null) => void;
  updatingIds: Set<number>;
  phaseColor: string;
  linkedTasks: Record<number, number>;
  taskDetails: Record<number, any>;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [showAddTask, setShowAddTask] = useState(false);

  const completed = items.filter((i) => i.status === "completed").length;
  const total = items.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Count overdue items in this section
  const overdueInSection = items.filter((i) => {
    const d = parseDueDate(i.dueDate);
    return d && isPast(d) && i.status !== "completed";
  }).length;

  return (
    <div className={`border rounded-xl overflow-hidden bg-white shadow-sm ${
      overdueInSection > 0 ? "ring-1 ring-red-200" : ""
    }`}>
      {/* Section header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-gray-50/50 transition-colors"
      >
        {isOpen ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        )}
        <div className="flex-1 text-right">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-muted-foreground/60">{sectionKey}</span>
            <h3 className="font-bold text-sm text-foreground">{sectionMeta.title}</h3>
            <span className="text-[10px] text-muted-foreground/50">{sectionMeta.titleEn}</span>
            {overdueInSection > 0 && (
              <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
                <AlertTriangle className="w-3 h-3" />
                {overdueInSection} متأخرة
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Agent responsible for this section */}
          {SECTION_AGENT_MAP[sectionKey] && (
            <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
              AGENT_COLORS[SECTION_AGENT_MAP[sectionKey].primary]
                ? `${AGENT_COLORS[SECTION_AGENT_MAP[sectionKey].primary].bg} ${AGENT_COLORS[SECTION_AGENT_MAP[sectionKey].primary].text} ${AGENT_COLORS[SECTION_AGENT_MAP[sectionKey].primary].border}`
                : "bg-gray-50 text-gray-600 border-gray-200"
            }`}>
              <Bot className="w-3 h-3" />
              {SECTION_AGENT_MAP[sectionKey].primary}
              {SECTION_AGENT_MAP[sectionKey].secondary && (
                <span className="opacity-60">+ {SECTION_AGENT_MAP[sectionKey].secondary}</span>
              )}
            </span>
          )}
          <span className="text-xs font-bold text-muted-foreground">
            {completed}/{total}
          </span>
          <div className="w-24">
            <Progress value={pct} className="h-2" />
          </div>
          <span className={`text-xs font-bold ${pct === 100 ? "text-emerald-600" : pct > 0 ? "text-amber-600" : "text-gray-400"}`}>
            {pct}%
          </span>
        </div>
      </button>

      {/* Section content */}
      {isOpen && (
        <div className="px-5 pb-4 space-y-2">
          {items.map((item) => {
            const taskId = linkedTasks[item.id];
            const taskDetail = taskId ? taskDetails[taskId] : null;
            const linkedInfo = taskDetail ? { taskId, owner: taskDetail.owner, status: taskDetail.status } : null;
            return (
              <TaskItem
                key={item.id}
                item={item}
                documents={documents[item.id] || []}
                onStatusChange={onStatusChange}
                onDelete={onDelete}
                onUpload={onUpload}
                onDeleteDoc={onDeleteDoc}
                isUpdating={updatingIds.has(item.id)}
                linkedTaskInfo={linkedInfo}
                onSetDueDate={onSetDueDate}
              />
            );
          })}

          {/* Add custom task */}
          {showAddTask ? (
            <div className="flex items-center gap-2 mt-2">
              <Input
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="عنوان المهمة الجديدة..."
                className="flex-1 text-sm h-9"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newTaskTitle.trim()) {
                    onAddTask(sectionKey, newTaskTitle.trim());
                    setNewTaskTitle("");
                    setShowAddTask(false);
                  }
                  if (e.key === "Escape") {
                    setShowAddTask(false);
                    setNewTaskTitle("");
                  }
                }}
                autoFocus
              />
              <Button
                size="sm"
                variant="outline"
                className="h-9"
                onClick={() => {
                  if (newTaskTitle.trim()) {
                    onAddTask(sectionKey, newTaskTitle.trim());
                    setNewTaskTitle("");
                    setShowAddTask(false);
                  }
                }}
              >
                إضافة
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-9"
                onClick={() => { setShowAddTask(false); setNewTaskTitle(""); }}
              >
                إلغاء
              </Button>
            </div>
          ) : (
            <button
              onClick={() => setShowAddTask(true)}
              className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors mt-2 px-2 py-1.5 rounded-md hover:bg-gray-50"
            >
              <Plus className="w-3.5 h-3.5" />
              إضافة مهمة مخصصة
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
// PHASE COMPONENT
// ═══════════════════════════════════════════

function PhaseBlock({
  phaseNumber,
  items,
  documents,
  onStatusChange,
  onDelete,
  onUpload,
  onDeleteDoc,
  onAddTask,
  onSetDueDate,
  updatingIds,
  linkedTasks,
  taskDetails,
}: {
  phaseNumber: number;
  items: StageItem[];
  documents: Record<number, StageDocument[]>;
  onStatusChange: (id: number, status: "not_started" | "in_progress" | "completed") => void;
  onDelete: (id: number) => void;
  onUpload: (itemId: number, file: File) => void;
  onDeleteDoc: (docId: number) => void;
  onAddTask: (sectionKey: string, title: string) => void;
  onSetDueDate: (id: number, date: string | null) => void;
  updatingIds: Set<number>;
  linkedTasks: Record<number, number>;
  taskDetails: Record<number, any>;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const meta = PHASE_META[phaseNumber];
  if (!meta) return null;

  const PhaseIcon = meta.icon;
  const completed = items.filter((i) => i.status === "completed").length;
  const inProgress = items.filter((i) => i.status === "in_progress").length;
  const total = items.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Count overdue items in this phase
  const overdueInPhase = items.filter((i) => {
    const d = parseDueDate(i.dueDate);
    return d && isPast(d) && i.status !== "completed";
  }).length;

  // Group items by section
  const sectionItems: Record<string, StageItem[]> = {};
  for (const item of items) {
    if (!sectionItems[item.sectionKey]) sectionItems[item.sectionKey] = [];
    sectionItems[item.sectionKey].push(item);
  }

  // Determine phase status
  const phaseStatus = pct === 100 ? "completed" : inProgress > 0 || completed > 0 ? "in_progress" : "not_started";

  return (
    <div className={`rounded-2xl border-2 overflow-hidden transition-all ${
      overdueInPhase > 0
        ? "border-red-300 shadow-red-100/50 shadow-sm"
        : phaseStatus === "completed" ? "border-emerald-300 shadow-emerald-100" :
        phaseStatus === "in_progress" ? `${meta.borderColor} shadow-sm` :
        "border-gray-200"
    }`}>
      {/* Phase header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center gap-4 px-6 py-5 transition-colors ${meta.bgColor} hover:opacity-90`}
      >
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
          phaseStatus === "completed" ? "bg-emerald-500" :
          phaseStatus === "in_progress" ? "bg-white shadow-sm" :
          "bg-white/80"
        }`}>
          <PhaseIcon className={`w-6 h-6 ${
            phaseStatus === "completed" ? "text-white" : meta.color
          }`} />
        </div>

        <div className="flex-1 text-right">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-muted-foreground/60">المرحلة {phaseNumber}</span>
            <h2 className="text-lg font-bold text-foreground">{meta.title}</h2>
            {overdueInPhase > 0 && (
              <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200 animate-pulse">
                <AlertTriangle className="w-3 h-3" />
                {overdueInPhase} متأخرة
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground/70 mt-0.5">{meta.titleEn}</p>
        </div>

        <div className="flex items-center gap-4 flex-shrink-0">
          {/* Stats */}
          <div className="flex items-center gap-3 text-xs">
            {completed > 0 && (
              <span className="flex items-center gap-1 text-emerald-600">
                <CheckCircle2 className="w-3.5 h-3.5" /> {completed}
              </span>
            )}
            {inProgress > 0 && (
              <span className="flex items-center gap-1 text-amber-600">
                <Clock className="w-3.5 h-3.5" /> {inProgress}
              </span>
            )}
            <span className="text-muted-foreground">{total} مهمة</span>
          </div>

          {/* Progress */}
          <div className="w-32">
            <Progress value={pct} className={`h-2.5 ${
              phaseStatus === "completed" ? "[&>[data-slot=progress-indicator]]:bg-emerald-500" :
              phaseStatus === "in_progress" ? "[&>[data-slot=progress-indicator]]:bg-amber-500" :
              ""
            }`} />
          </div>
          <span className={`text-sm font-bold min-w-[40px] text-left ${
            pct === 100 ? "text-emerald-600" : pct > 0 ? "text-amber-600" : "text-gray-400"
          }`}>
            {pct}%
          </span>

          {isOpen ? (
            <ChevronDown className="w-5 h-5 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Phase sections */}
      {isOpen && (
        <div className="p-5 space-y-4 bg-gray-50/30">
          {Object.entries(meta.sections).map(([sKey, sMeta]) => (
            <SectionBlock
              key={sKey}
              sectionKey={sKey}
              sectionMeta={sMeta}
              items={sectionItems[sKey] || []}
              documents={documents}
              onStatusChange={onStatusChange}
              onDelete={onDelete}
              onUpload={onUpload}
              onDeleteDoc={onDeleteDoc}
              onAddTask={onAddTask}
              onSetDueDate={onSetDueDate}
              updatingIds={updatingIds}
              phaseColor={meta.color}
              linkedTasks={linkedTasks}
              taskDetails={taskDetails}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
// CRITICAL PATH VIEW
// ═══════════════════════════════════════════

function CriticalPathView({ items }: { items: StageItem[] }) {
  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-emerald-400/50" />
        <p className="text-sm text-muted-foreground">لا توجد مهام قيد التنفيذ حالياً</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const phaseMeta = PHASE_META[item.phaseNumber];
        const sectionMeta = phaseMeta?.sections[item.sectionKey];
        const dueDate = parseDueDate(item.dueDate);
        const dueDateStatus = getDueDateStatus(dueDate, item.status);

        return (
          <div key={item.id} className={`flex items-center gap-3 rounded-lg px-4 py-3 ${
            dueDateStatus === "overdue"
              ? "bg-red-50/80 border border-red-200/70"
              : "bg-amber-50/50 border border-amber-200/50"
          }`}>
            {dueDateStatus === "overdue" ? (
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
            ) : (
              <Clock className="w-5 h-5 text-amber-500 flex-shrink-0" />
            )}
            <div className="flex-1">
              <p className="text-sm font-medium">{item.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                المرحلة {item.phaseNumber} — {sectionMeta?.title || item.sectionKey}
              </p>
            </div>
            {dueDate && (
              <div className="text-left flex-shrink-0 ml-2">
                <p className={`text-xs font-bold ${dueDateStatus === "overdue" ? "text-red-700" : "text-sky-700"}`}>
                  {format(dueDate, "dd MMM", { locale: ar })}
                </p>
                {dueDateStatus === "overdue" && (
                  <p className="text-[10px] text-red-500">متأخر</p>
                )}
              </div>
            )}
            <Badge variant="outline" className={`text-[10px] ${
              dueDateStatus === "overdue"
                ? "bg-red-100 text-red-700 border-red-200"
                : "bg-amber-100 text-amber-700 border-amber-200"
            }`}>
              {dueDateStatus === "overdue" ? "متأخر" : "جارٍ"}
            </Badge>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════
// MAIN PAGE COMPONENT
// ═══════════════════════════════════════════

export default function DevelopmentStagesPage({ embedded }: { embedded?: boolean } = {}) {
  const { user, loading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [activeView, setActiveView] = useState<"stages" | "critical" | "overdue">("stages");
  const [updatingIds, setUpdatingIds] = useState<Set<number>>(new Set());

  // Queries
  const projectsQuery = trpc.projects.list.useQuery(undefined, { enabled: isAuthenticated });

  const stagesQuery = trpc.stages.getByProject.useQuery(selectedProjectId || 0, {
    enabled: !!selectedProjectId,
  });

  const criticalPathQuery = trpc.stages.getCriticalPath.useQuery(selectedProjectId || 0, {
    enabled: !!selectedProjectId && activeView === "critical",
  });

  const overdueQuery = trpc.stages.getOverdueItems.useQuery(selectedProjectId || 0, {
    enabled: !!selectedProjectId,
  });

  const overdueStatsQuery = trpc.stages.getOverdueStats.useQuery(selectedProjectId || 0, {
    enabled: !!selectedProjectId,
  });

  // Linked tasks query
  const linkedTasksQuery = trpc.stages.getLinkedTasks.useQuery(selectedProjectId || 0, {
    enabled: !!selectedProjectId,
  });

  // Initialize mutation
  const initMutation = trpc.stages.initializeProject.useMutation({
    onSuccess: (data) => {
      if (data.initialized) {
        toast.success(`تم تهيئة ${data.count} مهمة بنجاح`);
      }
      stagesQuery.refetch();
    },
    onError: () => toast.error("خطأ في تهيئة المراحل"),
  });

  // Auto-initialize when project is selected and has no items
  useEffect(() => {
    if (selectedProjectId && stagesQuery.data && stagesQuery.data.items.length === 0 && !initMutation.isPending) {
      initMutation.mutate(selectedProjectId);
    }
  }, [selectedProjectId, stagesQuery.data]);

  // Status update mutation
  const statusMutation = trpc.stages.updateStatus.useMutation({
    onMutate: ({ id }) => {
      setUpdatingIds((prev) => new Set(prev).add(id));
    },
    onSuccess: (data) => {
      stagesQuery.refetch();
      linkedTasksQuery.refetch();
      overdueQuery.refetch();
      overdueStatsQuery.refetch();
      if (activeView === "critical") criticalPathQuery.refetch();
      // Show toast about agent assignment
      if (data.linkedTaskId && data.agentName) {
        toast.success(
          `تم إنشاء مهمة #${data.linkedTaskId} وتعيينها للوكيل ${data.agentName}${data.agentSecondary ? ` (مساعد: ${data.agentSecondary})` : ""}`,
          { duration: 4000 }
        );
      }
    },
    onSettled: (_, __, { id }) => {
      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    },
    onError: () => toast.error("خطأ في تحديث الحالة"),
  });

  // Set due date mutation
  const setDueDateMutation = trpc.stages.setDueDate.useMutation({
    onSuccess: () => {
      stagesQuery.refetch();
      overdueQuery.refetch();
      overdueStatsQuery.refetch();
      toast.success("تم تحديث التاريخ المستهدف");
    },
    onError: () => toast.error("خطأ في تحديث التاريخ"),
  });

  // Add custom task mutation
  const addTaskMutation = trpc.stages.addCustomTask.useMutation({
    onSuccess: () => {
      toast.success("تمت إضافة المهمة");
      stagesQuery.refetch();
    },
    onError: () => toast.error("خطأ في إضافة المهمة"),
  });

  // Delete task mutation
  const deleteTaskMutation = trpc.stages.deleteTask.useMutation({
    onSuccess: () => {
      toast.success("تم حذف المهمة");
      stagesQuery.refetch();
    },
    onError: (err) => toast.error(err.message || "خطأ في حذف المهمة"),
  });

  // Upload document mutation
  const uploadDocMutation = trpc.stages.uploadDocument.useMutation({
    onSuccess: (data) => {
      toast.success(`تم رفع ${data.fileName}`);
      stagesQuery.refetch();
    },
    onError: () => toast.error("خطأ في رفع الملف"),
  });

  // Delete document mutation
  const deleteDocMutation = trpc.stages.deleteDocument.useMutation({
    onSuccess: () => {
      toast.success("تم حذف الملف");
      stagesQuery.refetch();
    },
    onError: () => toast.error("خطأ في حذف الملف"),
  });

  // Handlers
  const handleStatusChange = useCallback((id: number, status: "not_started" | "in_progress" | "completed") => {
    statusMutation.mutate({ id, status });
  }, [statusMutation]);

  const handleDelete = useCallback((id: number) => {
    deleteTaskMutation.mutate(id);
  }, [deleteTaskMutation]);

  const handleUpload = useCallback((itemId: number, file: File) => {
    if (!selectedProjectId) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      uploadDocMutation.mutate({
        stageItemId: itemId,
        projectId: selectedProjectId,
        fileName: file.name,
        fileBase64: base64,
        mimeType: file.type,
        fileSize: file.size,
      });
    };
    reader.readAsDataURL(file);
  }, [selectedProjectId, uploadDocMutation]);

  const handleDeleteDoc = useCallback((docId: number) => {
    deleteDocMutation.mutate(docId);
  }, [deleteDocMutation]);

  const handleAddTask = useCallback((sectionKey: string, title: string) => {
    if (!selectedProjectId) return;
    const phaseNumber = parseInt(sectionKey.split(".")[0]);
    addTaskMutation.mutate({
      projectId: selectedProjectId,
      phaseNumber,
      sectionKey,
      title,
    });
  }, [selectedProjectId, addTaskMutation]);

  const handleSetDueDate = useCallback((id: number, date: string | null) => {
    setDueDateMutation.mutate({ id, dueDate: date });
  }, [setDueDateMutation]);

  // Compute grouped items by phase
  const phaseItems = useMemo(() => {
    const grouped: Record<number, StageItem[]> = {};
    for (const item of stagesQuery.data?.items || []) {
      if (!grouped[item.phaseNumber]) grouped[item.phaseNumber] = [];
      grouped[item.phaseNumber].push(item);
    }
    return grouped;
  }, [stagesQuery.data?.items]);

  // Overall stats
  const overallStats = useMemo(() => {
    const items = stagesQuery.data?.items || [];
    const total = items.length;
    const completed = items.filter((i) => i.status === "completed").length;
    const inProgress = items.filter((i) => i.status === "in_progress").length;
    const notStarted = items.filter((i) => i.status === "not_started").length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Count overdue from local data
    const now = new Date();
    const overdue = items.filter((i) => {
      const d = parseDueDate(i.dueDate);
      return d && isPast(d) && i.status !== "completed";
    }).length;
    const dueSoon = items.filter((i) => {
      const d = parseDueDate(i.dueDate);
      return d && !isPast(d) && d <= addDays(now, 3) && i.status !== "completed";
    }).length;

    return { total, completed, inProgress, notStarted, pct, overdue, dueSoon };
  }, [stagesQuery.data?.items]);

  // Auth check
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <Building2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-bold mb-2">يرجى تسجيل الدخول</h2>
            <p className="text-sm text-muted-foreground mb-4">تحتاج لتسجيل الدخول للوصول لمراحل التطوير</p>
            <Button onClick={() => window.location.href = getLoginUrl()}>تسجيل الدخول</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gradient-to-br from-gray-50 to-white ${embedded ? "" : "p-6"}`}>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        {!embedded && (
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">مراحل التطوير</h1>
              <p className="text-sm text-muted-foreground mt-1">تتبع تقدم المشروع عبر 5 مراحل رئيسية</p>
            </div>
            <Button variant="outline" onClick={() => navigate("/")}>
              العودة للرئيسية
            </Button>
          </div>
        )}

        {/* Project Selector */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-4">
              <div className="flex-1 space-y-1">
                <Label className="text-xs font-bold text-muted-foreground">اختر المشروع</Label>
                <select
                  className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm font-medium"
                  value={selectedProjectId || ""}
                  onChange={(e) => {
                    const val = e.target.value ? Number(e.target.value) : null;
                    setSelectedProjectId(val);
                  }}
                >
                  <option value="">— اختر مشروع —</option>
                  {(projectsQuery.data || []).map((p: any) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              {initMutation.isPending && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  جاري تهيئة المراحل...
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* No project selected */}
        {!selectedProjectId && (
          <div className="text-center py-20">
            <Building2 className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
            <h2 className="text-xl font-bold text-muted-foreground mb-2">اختر مشروع لعرض مراحل التطوير</h2>
            <p className="text-sm text-muted-foreground/70">اختر مشروع من القائمة أعلاه لبدء تتبع المراحل</p>
          </div>
        )}

        {/* Loading */}
        {selectedProjectId && stagesQuery.isLoading && (
          <div className="text-center py-20">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">جاري تحميل المراحل...</p>
          </div>
        )}

        {/* Main content */}
        {selectedProjectId && stagesQuery.data && stagesQuery.data.items.length > 0 && (
          <>
            {/* Overdue Alert Banner */}
            <OverdueAlertBanner
              overdueCount={overallStats.overdue}
              dueSoonCount={overallStats.dueSoon}
              onViewOverdue={() => setActiveView("overdue")}
            />

            {/* Overall Progress Card */}
            <Card className="overflow-hidden">
              <CardContent className="pt-5 pb-5">
                <div className="flex items-center gap-6">
                  {/* Overall progress circle */}
                  <div className="relative w-20 h-20 flex-shrink-0">
                    <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                      <circle cx="40" cy="40" r="35" fill="none" stroke="currentColor" strokeWidth="6" className="text-gray-200" />
                      <circle
                        cx="40" cy="40" r="35" fill="none" stroke="currentColor" strokeWidth="6"
                        strokeDasharray={`${2 * Math.PI * 35}`}
                        strokeDashoffset={`${2 * Math.PI * 35 * (1 - overallStats.pct / 100)}`}
                        strokeLinecap="round"
                        className={overallStats.pct === 100 ? "text-emerald-500" : overallStats.pct > 0 ? "text-amber-500" : "text-gray-300"}
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className={`text-lg font-bold ${
                        overallStats.pct === 100 ? "text-emerald-600" : overallStats.pct > 0 ? "text-amber-600" : "text-gray-400"
                      }`}>
                        {overallStats.pct}%
                      </span>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className={`flex-1 grid ${overallStats.overdue > 0 || overallStats.dueSoon > 0 ? "grid-cols-6" : "grid-cols-4"} gap-4`}>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-foreground">{overallStats.total}</p>
                      <p className="text-[10px] text-muted-foreground font-medium">إجمالي المهام</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-emerald-600">{overallStats.completed}</p>
                      <p className="text-[10px] text-muted-foreground font-medium">مكتملة</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-amber-600">{overallStats.inProgress}</p>
                      <p className="text-[10px] text-muted-foreground font-medium">قيد التنفيذ</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-gray-400">{overallStats.notStarted}</p>
                      <p className="text-[10px] text-muted-foreground font-medium">لم تبدأ</p>
                    </div>
                    {overallStats.overdue > 0 && (
                      <div className="text-center">
                        <p className="text-2xl font-bold text-red-600">{overallStats.overdue}</p>
                        <p className="text-[10px] text-red-600 font-medium">متأخرة</p>
                      </div>
                    )}
                    {overallStats.dueSoon > 0 && (
                      <div className="text-center">
                        <p className="text-2xl font-bold text-orange-600">{overallStats.dueSoon}</p>
                        <p className="text-[10px] text-orange-600 font-medium">تستحق قريباً</p>
                      </div>
                    )}
                  </div>

                  {/* View toggle */}
                  <div className="flex gap-1 bg-gray-100 rounded-lg p-1 flex-shrink-0">
                    <button
                      onClick={() => setActiveView("stages")}
                      className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                        activeView === "stages" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      المراحل
                    </button>
                    <button
                      onClick={() => setActiveView("critical")}
                      className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                        activeView === "critical" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <span className="flex items-center gap-1">
                        <Zap className="w-3 h-3" />
                        المسار الحرج
                      </span>
                    </button>
                    <button
                      onClick={() => setActiveView("overdue")}
                      className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                        activeView === "overdue" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                      } ${overallStats.overdue > 0 ? "text-red-600" : ""}`}
                    >
                      <span className="flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        المتأخرة
                        {overallStats.overdue > 0 && (
                          <span className="bg-red-500 text-white text-[9px] rounded-full w-4 h-4 flex items-center justify-center">
                            {overallStats.overdue}
                          </span>
                        )}
                      </span>
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Stages View */}
            {activeView === "stages" && (
              <div className="space-y-5">
                {[2, 3, 4, 5, 6].map((phaseNum) => (
                  <PhaseBlock
                    key={phaseNum}
                    phaseNumber={phaseNum}
                    items={phaseItems[phaseNum] || []}
                    documents={stagesQuery.data?.documents || {}}
                    onStatusChange={handleStatusChange}
                    onDelete={handleDelete}
                    onUpload={handleUpload}
                    onDeleteDoc={handleDeleteDoc}
                    onAddTask={handleAddTask}
                    onSetDueDate={handleSetDueDate}
                    updatingIds={updatingIds}
                    linkedTasks={linkedTasksQuery.data?.linkedTasks || {}}
                    taskDetails={linkedTasksQuery.data?.taskDetails || {}}
                  />
                ))}
              </div>
            )}

            {/* Critical Path View */}
            {activeView === "critical" && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-amber-500" />
                    المسار الحرج — المهام قيد التنفيذ
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {criticalPathQuery.isLoading ? (
                    <div className="text-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                    </div>
                  ) : (
                    <CriticalPathView items={criticalPathQuery.data || []} />
                  )}
                </CardContent>
              </Card>
            )}

            {/* Overdue View */}
            {activeView === "overdue" && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-500" />
                    المهام المتأخرة — تجاوزت التاريخ المستهدف
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {overdueQuery.isLoading ? (
                    <div className="text-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                    </div>
                  ) : (
                    <OverdueItemsView items={overdueQuery.data || []} />
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
