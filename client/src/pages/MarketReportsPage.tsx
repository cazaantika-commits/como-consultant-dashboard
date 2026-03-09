import { useState, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Streamdown } from "streamdown";
import { toast } from "sonner";
import {
  Upload, FileText, Search, Filter, Trash2, RefreshCw, Eye,
  Building2, BarChart3, Globe, Calendar, Tag, CheckCircle2,
  AlertCircle, Loader2, X, Download, BookOpen
} from "lucide-react";

const SOURCES = [
  { value: "CBRE", label: "CBRE", color: "bg-green-500" },
  { value: "JLL", label: "JLL", color: "bg-red-500" },
  { value: "Knight_Frank", label: "Knight Frank", color: "bg-blue-600" },
  { value: "Savills", label: "Savills", color: "bg-purple-500" },
  { value: "Colliers", label: "Colliers", color: "bg-cyan-500" },
  { value: "Cushman_Wakefield", label: "Cushman & Wakefield", color: "bg-amber-500" },
  { value: "DXBInteract", label: "DXB Interact", color: "bg-teal-500" },
  { value: "Property_Monitor", label: "Property Monitor", color: "bg-indigo-500" },
  { value: "Bayut", label: "Bayut", color: "bg-orange-500" },
  { value: "Property_Finder", label: "Property Finder", color: "bg-pink-500" },
  { value: "DLD", label: "DLD", color: "bg-emerald-600" },
  { value: "Other", label: "أخرى", color: "bg-gray-500" },
];

const REPORT_TYPES = [
  { value: "market_overview", label: "نظرة عامة على السوق" },
  { value: "residential", label: "سكني" },
  { value: "commercial", label: "تجاري" },
  { value: "office", label: "مكتبي" },
  { value: "hospitality", label: "ضيافة" },
  { value: "mixed_use", label: "متعدد الاستخدامات" },
  { value: "land", label: "أراضي" },
  { value: "quarterly", label: "تقرير ربع سنوي" },
  { value: "annual", label: "تقرير سنوي" },
  { value: "special", label: "تقرير خاص" },
];

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  uploaded: { label: "تم الرفع", color: "bg-blue-100 text-blue-700", icon: Upload },
  extracting: { label: "جاري الاستخراج", color: "bg-yellow-100 text-yellow-700", icon: Loader2 },
  summarizing: { label: "جاري التلخيص", color: "bg-purple-100 text-purple-700", icon: Loader2 },
  ready: { label: "جاهز", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
  error: { label: "خطأ", color: "bg-red-100 text-red-700", icon: AlertCircle },
};

export default function MarketReportsPage() {
  const [activeTab, setActiveTab] = useState("browse");
  const [filterSource, setFilterSource] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("");
  const [filterCommunity, setFilterCommunity] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [showUploadDialog, setShowUploadDialog] = useState(false);

  const reportsQuery = trpc.marketReports.getReports.useQuery({
    source: filterSource || undefined,
    reportType: filterType || undefined,
    community: filterCommunity || undefined,
    search: searchQuery || undefined,
    limit: 50,
  });

  const statsQuery = trpc.marketReports.getStats.useQuery();
  const utils = trpc.useUtils();

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
                <BookOpen className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">قاعدة تقارير السوق</h1>
                <p className="text-sm text-muted-foreground">رفع وإدارة تقارير السوق العقاري من المصادر الرائدة</p>
              </div>
            </div>
            <Button onClick={() => setShowUploadDialog(true)} className="gap-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white">
              <Upload className="w-4 h-4" />
              رفع تقرير جديد
            </Button>
          </div>
        </div>
      </div>

      <div className="container py-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{statsQuery.data?.total ?? 0}</p>
                <p className="text-xs text-muted-foreground">إجمالي التقارير</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{statsQuery.data?.ready ?? 0}</p>
                <p className="text-xs text-muted-foreground">جاهزة للتحليل</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{statsQuery.data?.bySource?.length ?? 0}</p>
                <p className="text-xs text-muted-foreground">مصادر مختلفة</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{statsQuery.data?.byType?.length ?? 0}</p>
                <p className="text-xs text-muted-foreground">أنواع التقارير</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Source Distribution */}
        {statsQuery.data?.bySource && statsQuery.data.bySource.length > 0 && (
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">التوزيع حسب المصدر</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {statsQuery.data.bySource.map((s: any) => {
                  const sourceInfo = SOURCES.find(src => src.value === s.source);
                  return (
                    <Badge key={s.source} variant="outline" className="gap-1.5 py-1 px-3">
                      <span className={`w-2 h-2 rounded-full ${sourceInfo?.color || "bg-gray-400"}`} />
                      {sourceInfo?.label || s.source}
                      <span className="font-bold mr-1">{s.count}</span>
                    </Badge>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="بحث في التقارير..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pr-10"
                  />
                </div>
              </div>
              <Select value={filterSource} onValueChange={setFilterSource}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="المصدر" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  {SOURCES.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="النوع" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  {REPORT_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="المنطقة..."
                value={filterCommunity}
                onChange={e => setFilterCommunity(e.target.value)}
                className="w-[140px]"
              />
              {(filterSource || filterType || filterCommunity || searchQuery) && (
                <Button variant="ghost" size="sm" onClick={() => {
                  setFilterSource("");
                  setFilterType("");
                  setFilterCommunity("");
                  setSearchQuery("");
                }}>
                  <X className="w-4 h-4 ml-1" /> مسح
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Reports List */}
        <div className="space-y-3">
          {reportsQuery.isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : !reportsQuery.data?.reports?.length ? (
            <Card className="border-0 shadow-sm">
              <CardContent className="py-16 text-center">
                <FileText className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-semibold mb-2">لا توجد تقارير</h3>
                <p className="text-muted-foreground mb-4">ابدأ برفع تقارير السوق من CBRE, JLL, Knight Frank وغيرها</p>
                <Button onClick={() => setShowUploadDialog(true)} className="gap-2">
                  <Upload className="w-4 h-4" />
                  رفع أول تقرير
                </Button>
              </CardContent>
            </Card>
          ) : (
            reportsQuery.data.reports.map((report: any) => (
              <ReportCard
                key={report.id}
                report={report}
                onView={() => setSelectedReport(report)}
                onRefresh={() => utils.marketReports.getReports.invalidate()}
              />
            ))
          )}
        </div>
      </div>

      {/* Upload Dialog */}
      <UploadDialog
        open={showUploadDialog}
        onClose={() => setShowUploadDialog(false)}
        onSuccess={() => {
          setShowUploadDialog(false);
          utils.marketReports.getReports.invalidate();
          utils.marketReports.getStats.invalidate();
        }}
      />

      {/* Report Detail Dialog */}
      {selectedReport && (
        <ReportDetailDialog
          report={selectedReport}
          onClose={() => setSelectedReport(null)}
        />
      )}
    </div>
  );
}

function ReportCard({ report, onView, onRefresh }: { report: any; onView: () => void; onRefresh: () => void }) {
  const deleteMutation = trpc.marketReports.deleteReport.useMutation({
    onSuccess: () => { toast.success("تم حذف التقرير"); onRefresh(); },
    onError: () => toast.error("فشل حذف التقرير"),
  });
  const reprocessMutation = trpc.marketReports.reprocessReport.useMutation({
    onSuccess: () => { toast.success("تم إعادة المعالجة"); onRefresh(); },
    onError: () => toast.error("فشل إعادة المعالجة"),
  });

  const sourceInfo = SOURCES.find(s => s.value === report.source);
  const typeInfo = REPORT_TYPES.find(t => t.value === report.reportType);
  const statusInfo = STATUS_MAP[report.processingStatus] || STATUS_MAP.uploaded;
  const StatusIcon = statusInfo.icon;

  return (
    <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Source Badge */}
          <div className={`w-12 h-12 rounded-lg ${sourceInfo?.color || "bg-gray-400"} flex items-center justify-center text-white font-bold text-xs shrink-0`}>
            {(sourceInfo?.label || "?").slice(0, 3)}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold text-foreground line-clamp-1">{report.reportTitle}</h3>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-xs">{sourceInfo?.label || report.source}</Badge>
                  <Badge variant="secondary" className="text-xs">{typeInfo?.label || report.reportType}</Badge>
                  {report.community && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Globe className="w-3 h-3" /> {report.community}
                    </span>
                  )}
                  {report.reportDate && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> {report.reportDate}
                    </span>
                  )}
                </div>
              </div>
              <Badge className={`${statusInfo.color} text-xs shrink-0 gap-1`}>
                <StatusIcon className={`w-3 h-3 ${report.processingStatus === 'extracting' || report.processingStatus === 'summarizing' ? 'animate-spin' : ''}`} />
                {statusInfo.label}
              </Badge>
            </div>

            {/* Summary preview */}
            {report.aiSummary && (
              <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{report.aiSummary}</p>
            )}

            {/* Error message */}
            {report.errorMessage && (
              <p className="text-sm text-red-500 mt-2">{report.errorMessage}</p>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 mt-3">
              <Button variant="outline" size="sm" className="gap-1" onClick={onView}>
                <Eye className="w-3 h-3" /> عرض
              </Button>
              {report.fileUrl && (
                <Button variant="outline" size="sm" className="gap-1" asChild>
                  <a href={report.fileUrl} target="_blank" rel="noopener noreferrer">
                    <Download className="w-3 h-3" /> تحميل
                  </a>
                </Button>
              )}
              {(report.processingStatus === "error" || report.processingStatus === "uploaded") && (
                <Button variant="outline" size="sm" className="gap-1"
                  onClick={() => reprocessMutation.mutate({ id: report.id })}
                  disabled={reprocessMutation.isPending}>
                  <RefreshCw className={`w-3 h-3 ${reprocessMutation.isPending ? 'animate-spin' : ''}`} />
                  إعادة معالجة
                </Button>
              )}
              <Button variant="ghost" size="sm" className="gap-1 text-destructive hover:text-destructive"
                onClick={() => { if (confirm("هل تريد حذف هذا التقرير؟")) deleteMutation.mutate({ id: report.id }); }}
                disabled={deleteMutation.isPending}>
                <Trash2 className="w-3 h-3" />
              </Button>
              <span className="text-xs text-muted-foreground mr-auto">
                {report.fileSizeBytes ? `${(report.fileSizeBytes / 1024 / 1024).toFixed(1)} MB` : ""}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function UploadDialog({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: () => void }) {
  const [source, setSource] = useState("");
  const [reportTitle, setReportTitle] = useState("");
  const [reportType, setReportType] = useState("");
  const [region, setRegion] = useState("Dubai");
  const [community, setCommunity] = useState("");
  const [reportDate, setReportDate] = useState("");
  const [reportYear, setReportYear] = useState<number>(new Date().getFullYear());
  const [reportQuarter, setReportQuarter] = useState<number>(0);
  const [tags, setTags] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = trpc.marketReports.uploadReport.useMutation({
    onSuccess: () => {
      toast.success("تم رفع التقرير بنجاح! جاري المعالجة...");
      onSuccess();
      resetForm();
    },
    onError: (err) => toast.error(`فشل الرفع: ${err.message}`),
  });

  const resetForm = () => {
    setSource("");
    setReportTitle("");
    setReportType("");
    setRegion("Dubai");
    setCommunity("");
    setReportDate("");
    setReportYear(new Date().getFullYear());
    setReportQuarter(0);
    setTags("");
    setFile(null);
  };

  const handleUpload = useCallback(async () => {
    if (!file || !source || !reportTitle || !reportType) {
      toast.error("يرجى ملء جميع الحقول المطلوبة");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      toast.error("حجم الملف يتجاوز 50 ميغابايت");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      uploadMutation.mutate({
        source: source as any,
        reportTitle,
        reportType: reportType as any,
        region: region || undefined,
        community: community || undefined,
        reportDate: reportDate || undefined,
        reportYear: reportYear || undefined,
        reportQuarter: reportQuarter || undefined,
        tags: tags || undefined,
        fileName: file.name,
        fileData: base64,
        mimeType: file.type || "application/pdf",
      });
    };
    reader.readAsDataURL(file);
  }, [file, source, reportTitle, reportType, region, community, reportDate, reportYear, reportQuarter, tags]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            رفع تقرير سوق جديد
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* File Upload */}
          <div
            className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-accent/30 transition-all"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.xlsx,.xls"
              className="hidden"
              onChange={e => setFile(e.target.files?.[0] || null)}
            />
            {file ? (
              <div className="flex items-center justify-center gap-3">
                <FileText className="w-8 h-8 text-primary" />
                <div className="text-right">
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                </div>
                <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); setFile(null); }}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <>
                <Upload className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
                <p className="font-medium">اسحب الملف هنا أو اضغط للاختيار</p>
                <p className="text-sm text-muted-foreground mt-1">PDF, DOC, XLSX - حتى 50 ميغابايت</p>
              </>
            )}
          </div>

          {/* Form Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>عنوان التقرير *</Label>
              <Input value={reportTitle} onChange={e => setReportTitle(e.target.value)} placeholder="مثال: تقرير سوق دبي السكني Q1 2025" />
            </div>

            <div>
              <Label>المصدر *</Label>
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger><SelectValue placeholder="اختر المصدر" /></SelectTrigger>
                <SelectContent>
                  {SOURCES.map(s => (
                    <SelectItem key={s.value} value={s.value}>
                      <span className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${s.color}`} />
                        {s.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>نوع التقرير *</Label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger><SelectValue placeholder="اختر النوع" /></SelectTrigger>
                <SelectContent>
                  {REPORT_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>المنطقة</Label>
              <Input value={region} onChange={e => setRegion(e.target.value)} placeholder="مثال: Dubai" />
            </div>

            <div>
              <Label>المجتمع / الحي</Label>
              <Input value={community} onChange={e => setCommunity(e.target.value)} placeholder="مثال: Business Bay" />
            </div>

            <div>
              <Label>تاريخ التقرير</Label>
              <Input value={reportDate} onChange={e => setReportDate(e.target.value)} placeholder="مثال: Q1 2025" />
            </div>

            <div className="flex gap-2">
              <div className="flex-1">
                <Label>السنة</Label>
                <Input type="number" value={reportYear} onChange={e => setReportYear(Number(e.target.value))} />
              </div>
              <div className="flex-1">
                <Label>الربع</Label>
                <Select value={String(reportQuarter)} onValueChange={v => setReportQuarter(Number(v))}>
                  <SelectTrigger><SelectValue placeholder="Q" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">-</SelectItem>
                    <SelectItem value="1">Q1</SelectItem>
                    <SelectItem value="2">Q2</SelectItem>
                    <SelectItem value="3">Q3</SelectItem>
                    <SelectItem value="4">Q4</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="col-span-2">
              <Label>وسوم (مفصولة بفواصل)</Label>
              <Input value={tags} onChange={e => setTags(e.target.value)} placeholder="مثال: سكني, فلل, أسعار, 2025" />
            </div>
          </div>

          <Button
            className="w-full gap-2"
            onClick={handleUpload}
            disabled={uploadMutation.isPending || !file || !source || !reportTitle || !reportType}
          >
            {uploadMutation.isPending ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> جاري الرفع...</>
            ) : (
              <><Upload className="w-4 h-4" /> رفع التقرير</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ReportDetailDialog({ report, onClose }: { report: any; onClose: () => void }) {
  const sourceInfo = SOURCES.find(s => s.value === report.source);
  const typeInfo = REPORT_TYPES.find(t => t.value === report.reportType);
  let keyMetrics: any = null;
  try {
    keyMetrics = report.keyMetrics ? JSON.parse(report.keyMetrics) : null;
  } catch {}

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-lg ${sourceInfo?.color || "bg-gray-400"} flex items-center justify-center text-white font-bold text-xs`}>
              {(sourceInfo?.label || "?").slice(0, 2)}
            </div>
            {report.reportTitle}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Metadata */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-accent/30 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">المصدر</p>
              <p className="font-semibold">{sourceInfo?.label || report.source}</p>
            </div>
            <div className="bg-accent/30 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">النوع</p>
              <p className="font-semibold">{typeInfo?.label || report.reportType}</p>
            </div>
            {report.community && (
              <div className="bg-accent/30 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">المنطقة</p>
                <p className="font-semibold">{report.community}</p>
              </div>
            )}
            {report.reportDate && (
              <div className="bg-accent/30 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">التاريخ</p>
                <p className="font-semibold">{report.reportDate}</p>
              </div>
            )}
          </div>

          {/* Key Metrics */}
          {keyMetrics && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">المؤشرات الرئيسية</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {keyMetrics.avgPricePerSqft && (
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <p className="text-xs text-muted-foreground">متوسط سعر القدم</p>
                      <p className="text-lg font-bold text-blue-700">{keyMetrics.avgPricePerSqft.toLocaleString()} AED</p>
                    </div>
                  )}
                  {keyMetrics.priceChangeYoY !== null && keyMetrics.priceChangeYoY !== undefined && (
                    <div className={`text-center p-3 rounded-lg ${keyMetrics.priceChangeYoY >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                      <p className="text-xs text-muted-foreground">تغير الأسعار سنوياً</p>
                      <p className={`text-lg font-bold ${keyMetrics.priceChangeYoY >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        {keyMetrics.priceChangeYoY > 0 ? '+' : ''}{keyMetrics.priceChangeYoY}%
                      </p>
                    </div>
                  )}
                  {keyMetrics.transactionVolume && (
                    <div className="text-center p-3 bg-purple-50 rounded-lg">
                      <p className="text-xs text-muted-foreground">حجم المعاملات</p>
                      <p className="text-lg font-bold text-purple-700">{keyMetrics.transactionVolume.toLocaleString()}</p>
                    </div>
                  )}
                  {keyMetrics.occupancyRate && (
                    <div className="text-center p-3 bg-teal-50 rounded-lg">
                      <p className="text-xs text-muted-foreground">نسبة الإشغال</p>
                      <p className="text-lg font-bold text-teal-700">{keyMetrics.occupancyRate}%</p>
                    </div>
                  )}
                  {keyMetrics.rentalYield && (
                    <div className="text-center p-3 bg-amber-50 rounded-lg">
                      <p className="text-xs text-muted-foreground">عائد الإيجار</p>
                      <p className="text-lg font-bold text-amber-700">{keyMetrics.rentalYield}%</p>
                    </div>
                  )}
                  {keyMetrics.marketTrend && (
                    <div className="text-center p-3 bg-indigo-50 rounded-lg">
                      <p className="text-xs text-muted-foreground">اتجاه السوق</p>
                      <p className="text-lg font-bold text-indigo-700">
                        {keyMetrics.marketTrend === 'up' ? '↑ صاعد' : keyMetrics.marketTrend === 'down' ? '↓ هابط' : '→ مستقر'}
                      </p>
                    </div>
                  )}
                </div>

                {keyMetrics.keyInsights?.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm font-medium mb-2">أهم النتائج:</p>
                    <ul className="space-y-1">
                      {keyMetrics.keyInsights.map((insight: string, i: number) => (
                        <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                          <span className="text-primary mt-1">•</span>
                          {insight}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* AI Summary */}
          {report.aiSummary && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">ملخص التقرير (AI)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none text-foreground">
                  <Streamdown>{report.aiSummary}</Streamdown>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex gap-2 justify-end">
            {report.fileUrl && (
              <Button variant="outline" className="gap-2" asChild>
                <a href={report.fileUrl} target="_blank" rel="noopener noreferrer">
                  <Download className="w-4 h-4" /> تحميل الملف الأصلي
                </a>
              </Button>
            )}
            <Button variant="outline" onClick={onClose}>إغلاق</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
