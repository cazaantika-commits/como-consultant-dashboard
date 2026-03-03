import { useState, useEffect, useMemo, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Sparkles, CheckCircle2, RotateCcw, Save, ShieldCheck } from "lucide-react";
import { Streamdown } from "streamdown";

const JOEL_AVATAR = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663200809965/mCOkEovAXTtxsABs.png";

function fmt(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "0";
  if (n < 100 && n % 1 !== 0) return n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return Math.round(n).toLocaleString("en-US");
}

function EditableNum({ value, onChange, suffix, disabled }: { value: number; onChange: (v: number) => void; suffix?: string; disabled?: boolean }) {
  const [localVal, setLocalVal] = useState("");
  const [focused, setFocused] = useState(false);
  const displayVal = focused ? localVal : (value ? fmt(value) : "");
  return (
    <div className="relative">
      <Input
        type="text"
        value={displayVal}
        onFocus={() => { setFocused(true); setLocalVal(value ? String(value) : ""); }}
        onBlur={() => { setFocused(false); const n = parseFloat(localVal.replace(/,/g, "")); if (!isNaN(n)) onChange(n); }}
        onChange={(e) => setLocalVal(e.target.value)}
        className="h-8 text-sm text-center"
        disabled={disabled}
        dir="ltr"
      />
      {suffix && <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">{suffix}</span>}
    </div>
  );
}

interface MarketOverviewTabProps {
  projectId: number | null;
  studyId: number | null;
  form: Record<string, any>;
  computed: Record<string, any>;
}

export default function MarketOverviewTab({ projectId, studyId, form: feasForm, computed }: MarketOverviewTabProps) {
  // Market overview data
  const moQuery = trpc.marketOverview.getByProject.useQuery(projectId || 0, { enabled: !!projectId });
  const saveMutation = trpc.marketOverview.save.useMutation({
    onSuccess: () => { moQuery.refetch(); toast.success("تم حفظ البيانات"); setIsDirty(false); },
    onError: () => toast.error("خطأ في الحفظ"),
  });
  const smartReportMutation = trpc.marketOverview.generateSmartReport.useMutation({
    onSuccess: (data) => {
      moQuery.refetch();
      setSmartReport(data.smartReport);
      try {
        const recs = JSON.parse(data.recommendations);
        setRecommendations(recs);
        setRecsApplied(false);
      } catch { /* ignore parse errors */ }
      toast.success("تم إنشاء التقرير الذكي بنجاح");
    },
    onError: (err) => toast.error(err.message || "فشل في إنشاء التقرير"),
  });
  const applyRecsMutation = trpc.marketOverview.applyRecommendations.useMutation({
    onSuccess: () => { moQuery.refetch(); setRecsApplied(true); toast.success("تم تطبيق التوصيات على الحقول"); },
    onError: () => toast.error("خطأ في تطبيق التوصيات"),
  });
  const approvalMutation = trpc.marketOverview.toggleApproval.useMutation({
    onSuccess: () => { moQuery.refetch(); toast.success("تم تحديث حالة الاعتماد"); },
    onError: () => toast.error("خطأ في تحديث الاعتماد"),
  });

  // Local state
  const [smartReport, setSmartReport] = useState<string>("");
  const [recommendations, setRecommendations] = useState<any>(null);
  const [recsApplied, setRecsApplied] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Editable fields state
  const [fields, setFields] = useState({
    residentialStudioPct: 0, residentialStudioAvgArea: 0,
    residential1brPct: 0, residential1brAvgArea: 0,
    residential2brPct: 0, residential2brAvgArea: 0,
    residential3brPct: 0, residential3brAvgArea: 0,
    retailSmallPct: 0, retailSmallAvgArea: 0,
    retailMediumPct: 0, retailMediumAvgArea: 0,
    retailLargePct: 0, retailLargeAvgArea: 0,
    officeSmallPct: 0, officeSmallAvgArea: 0,
    officeMediumPct: 0, officeMediumAvgArea: 0,
    officeLargePct: 0, officeLargeAvgArea: 0,
    finishingQuality: "ممتاز",
  });

  // Load data from query
  useEffect(() => {
    if (moQuery.data) {
      const d = moQuery.data;
      setFields({
        residentialStudioPct: parseFloat(d.residentialStudioPct || "0"),
        residentialStudioAvgArea: d.residentialStudioAvgArea || 0,
        residential1brPct: parseFloat(d.residential1brPct || "0"),
        residential1brAvgArea: d.residential1brAvgArea || 0,
        residential2brPct: parseFloat(d.residential2brPct || "0"),
        residential2brAvgArea: d.residential2brAvgArea || 0,
        residential3brPct: parseFloat(d.residential3brPct || "0"),
        residential3brAvgArea: d.residential3brAvgArea || 0,
        retailSmallPct: parseFloat(d.retailSmallPct || "0"),
        retailSmallAvgArea: d.retailSmallAvgArea || 0,
        retailMediumPct: parseFloat(d.retailMediumPct || "0"),
        retailMediumAvgArea: d.retailMediumAvgArea || 0,
        retailLargePct: parseFloat(d.retailLargePct || "0"),
        retailLargeAvgArea: d.retailLargeAvgArea || 0,
        officeSmallPct: parseFloat(d.officeSmallPct || "0"),
        officeSmallAvgArea: d.officeSmallAvgArea || 0,
        officeMediumPct: parseFloat(d.officeMediumPct || "0"),
        officeMediumAvgArea: d.officeMediumAvgArea || 0,
        officeLargePct: parseFloat(d.officeLargePct || "0"),
        officeLargeAvgArea: d.officeLargeAvgArea || 0,
        finishingQuality: d.finishingQuality || "ممتاز",
      });
      if (d.aiSmartReport) setSmartReport(d.aiSmartReport);
      if (d.aiRecommendationsJson) {
        try { setRecommendations(JSON.parse(d.aiRecommendationsJson)); setRecsApplied(true); } catch { /* ignore */ }
      }
      setIsDirty(false);
    }
  }, [moQuery.data]);

  const setField = useCallback((key: string, value: any) => {
    setFields(prev => ({ ...prev, [key]: value }));
    setIsDirty(true);
  }, []);

  // Computed values
  const saleableRes = computed.saleableRes || 0;
  const saleableRet = computed.saleableRet || 0;
  const saleableOff = computed.saleableOff || 0;

  const resTotalPct = fields.residentialStudioPct + fields.residential1brPct + fields.residential2brPct + fields.residential3brPct;
  const retTotalPct = fields.retailSmallPct + fields.retailMediumPct + fields.retailLargePct;
  const offTotalPct = fields.officeSmallPct + fields.officeMediumPct + fields.officeLargePct;

  const resRows = useMemo(() => [
    { key: "studio", label: "استديو", pct: fields.residentialStudioPct, avg: fields.residentialStudioAvgArea, pctKey: "residentialStudioPct", avgKey: "residentialStudioAvgArea" },
    { key: "1br", label: "غرفة وصالة", pct: fields.residential1brPct, avg: fields.residential1brAvgArea, pctKey: "residential1brPct", avgKey: "residential1brAvgArea" },
    { key: "2br", label: "غرفتان وصالة", pct: fields.residential2brPct, avg: fields.residential2brAvgArea, pctKey: "residential2brPct", avgKey: "residential2brAvgArea" },
    { key: "3br", label: "ثلاث غرف وصالة", pct: fields.residential3brPct, avg: fields.residential3brAvgArea, pctKey: "residential3brPct", avgKey: "residential3brAvgArea" },
  ], [fields]);

  const retRows = useMemo(() => [
    { key: "small", label: "صغيرة", pct: fields.retailSmallPct, avg: fields.retailSmallAvgArea, pctKey: "retailSmallPct", avgKey: "retailSmallAvgArea" },
    { key: "medium", label: "متوسطة", pct: fields.retailMediumPct, avg: fields.retailMediumAvgArea, pctKey: "retailMediumPct", avgKey: "retailMediumAvgArea" },
    { key: "large", label: "كبيرة", pct: fields.retailLargePct, avg: fields.retailLargeAvgArea, pctKey: "retailLargePct", avgKey: "retailLargeAvgArea" },
  ], [fields]);

  const offRows = useMemo(() => [
    { key: "small", label: "صغيرة", pct: fields.officeSmallPct, avg: fields.officeSmallAvgArea, pctKey: "officeSmallPct", avgKey: "officeSmallAvgArea" },
    { key: "medium", label: "متوسطة", pct: fields.officeMediumPct, avg: fields.officeMediumAvgArea, pctKey: "officeMediumPct", avgKey: "officeMediumAvgArea" },
    { key: "large", label: "كبيرة", pct: fields.officeLargePct, avg: fields.officeLargeAvgArea, pctKey: "officeLargePct", avgKey: "officeLargeAvgArea" },
  ], [fields]);

  const handleSave = () => {
    if (!projectId) return;
    saveMutation.mutate({ projectId, ...fields });
  };

  const handleApplyRecs = () => {
    if (!projectId || !recommendations) return;
    applyRecsMutation.mutate({ projectId, recommendations: JSON.stringify(recommendations) });
  };

  if (!projectId) {
    return (
      <div className="text-center py-16 bg-muted/20 rounded-xl border border-dashed border-border">
        <p className="text-sm text-muted-foreground">يرجى اختيار مشروع أولاً</p>
      </div>
    );
  }

  const isApproved = moQuery.data?.isApproved === 1;

  return (
    <div className="space-y-4" dir="rtl">
      {/* ═══════════════════════════════════════════ */}
      {/* القسم الأول: جويل + التقرير الذكي */}
      {/* ═══════════════════════════════════════════ */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {/* Joel Header */}
          <div className="bg-gradient-to-l from-cyan-50 to-blue-50 border-b border-cyan-100 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={JOEL_AVATAR} alt="جويل" className="w-12 h-12 rounded-full border-2 border-cyan-200 shadow-sm" />
              <div>
                <h3 className="font-bold text-sm text-cyan-900">جويل — محللة السوق العقاري</h3>
                <p className="text-xs text-cyan-600">تحليل ذكي للنظرة العامة والسوق</p>
              </div>
            </div>
            <Button
              onClick={() => { if (projectId) smartReportMutation.mutate(projectId); }}
              disabled={smartReportMutation.isPending}
              className="gap-2 bg-gradient-to-l from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white shadow-md"
            >
              {smartReportMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {smartReportMutation.isPending ? "جويل تحلل..." : "طلب تقرير ذكي"}
            </Button>
          </div>

          {/* Smart Report Content */}
          <div className="p-4">
            {smartReport ? (
              <div className="prose prose-sm max-w-none bg-muted/20 rounded-xl p-5 border border-border" dir="rtl">
                <Streamdown>{smartReport}</Streamdown>
              </div>
            ) : (
              <div className="text-center py-12 bg-muted/10 rounded-xl border border-dashed border-border">
                <img src={JOEL_AVATAR} alt="جويل" className="w-16 h-16 rounded-full mx-auto mb-3 opacity-40" />
                <p className="text-sm font-medium text-muted-foreground">لم يُنشأ التقرير الذكي بعد</p>
                <p className="text-xs text-muted-foreground/70 mt-1">اضغط "طلب تقرير ذكي" لتحليل السوق والمنطقة</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════ */}
      {/* القسم الثاني: مستطيل التوصيات */}
      {/* ═══════════════════════════════════════════ */}
      {recommendations && (
        <Card className="border-2 border-emerald-200 bg-gradient-to-l from-emerald-50/80 to-teal-50/80 overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">⭐</span>
                <h3 className="font-bold text-sm text-emerald-800">توصيات جويل — {recsApplied ? "تم تعبئة الحقول تلقائياً" : "جاهزة للتطبيق"}</h3>
                {recsApplied && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
              </div>
              <div className="flex gap-2">
                {!recsApplied && (
                  <Button size="sm" variant="outline" onClick={handleApplyRecs} disabled={applyRecsMutation.isPending} className="gap-1.5 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-100">
                    {applyRecsMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                    تطبيق التوصيات
                  </Button>
                )}
                {recsApplied && (
                  <Button size="sm" variant="ghost" onClick={handleApplyRecs} disabled={applyRecsMutation.isPending} className="gap-1.5 text-xs text-emerald-600 hover:bg-emerald-100">
                    <RotateCcw className="w-3 h-3" />
                    إعادة تطبيق
                  </Button>
                )}
              </div>
            </div>

            {/* Recommendations Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* توزيع السكني */}
              <div className="bg-white/80 rounded-lg p-3 border border-emerald-100">
                <h4 className="text-xs font-bold text-emerald-700 mb-2 text-center">توزيع السكني</h4>
                <div className="space-y-1.5 text-xs">
                  {recommendations.residential?.studio?.recommended && (
                    <div className="flex justify-between"><span>استديو</span><span className="font-bold text-emerald-700">{recommendations.residential.studio.pct}%</span></div>
                  )}
                  {recommendations.residential?.oneBr?.recommended && (
                    <div className="flex justify-between"><span>غرفة وصالة</span><span className="font-bold text-emerald-700">{recommendations.residential.oneBr.pct}%</span></div>
                  )}
                  {recommendations.residential?.twoBr?.recommended && (
                    <div className="flex justify-between"><span>غرفتان وصالة</span><span className="font-bold text-emerald-700">{recommendations.residential.twoBr.pct}%</span></div>
                  )}
                  {recommendations.residential?.threeBr?.recommended && (
                    <div className="flex justify-between"><span>ثلاث غرف وصالة</span><span className="font-bold text-emerald-700">{recommendations.residential.threeBr.pct}%</span></div>
                  )}
                  <div className="flex justify-between border-t border-emerald-100 pt-1 font-bold text-emerald-800">
                    <span>الإجمالي</span><span className="text-emerald-600">100%</span>
                  </div>
                </div>
              </div>

              {/* متوسط المساحات */}
              <div className="bg-white/80 rounded-lg p-3 border border-emerald-100">
                <h4 className="text-xs font-bold text-emerald-700 mb-2 text-center">متوسط المساحات (السكني)</h4>
                <div className="space-y-1.5 text-xs">
                  {recommendations.residential?.studio?.recommended && (
                    <div className="flex justify-between"><span>استديو</span><span className="font-bold">{fmt(recommendations.residential.studio.avgArea)} sqft</span></div>
                  )}
                  {recommendations.residential?.oneBr?.recommended && (
                    <div className="flex justify-between"><span>غرفة وصالة</span><span className="font-bold">{fmt(recommendations.residential.oneBr.avgArea)} sqft</span></div>
                  )}
                  {recommendations.residential?.twoBr?.recommended && (
                    <div className="flex justify-between"><span>غرفتان وصالة</span><span className="font-bold">{fmt(recommendations.residential.twoBr.avgArea)} sqft</span></div>
                  )}
                  {recommendations.residential?.threeBr?.recommended && (
                    <div className="flex justify-between"><span>ثلاث غرف وصالة</span><span className="font-bold">{fmt(recommendations.residential.threeBr.avgArea)} sqft</span></div>
                  )}
                </div>
              </div>

              {/* توزيع المحلات */}
              {recommendations.retail?.hasRetail && (
                <div className="bg-white/80 rounded-lg p-3 border border-emerald-100">
                  <h4 className="text-xs font-bold text-emerald-700 mb-2 text-center">توزيع المحلات</h4>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between"><span>صغيرة ({fmt(recommendations.retail.small?.avgArea)} sqft)</span><span className="font-bold text-emerald-700">{recommendations.retail.small?.pct}%</span></div>
                    <div className="flex justify-between"><span>متوسطة ({fmt(recommendations.retail.medium?.avgArea)} sqft)</span><span className="font-bold text-emerald-700">{recommendations.retail.medium?.pct}%</span></div>
                    <div className="flex justify-between"><span>كبيرة ({fmt(recommendations.retail.large?.avgArea)} sqft)</span><span className="font-bold text-emerald-700">{recommendations.retail.large?.pct}%</span></div>
                    <div className="flex justify-between border-t border-emerald-100 pt-1 font-bold text-emerald-800">
                      <span>الإجمالي</span><span className="text-emerald-600">100%</span>
                    </div>
                  </div>
                </div>
              )}

              {/* توزيع المكاتب */}
              {recommendations.offices?.hasOffices && (
                <div className="bg-white/80 rounded-lg p-3 border border-emerald-100">
                  <h4 className="text-xs font-bold text-emerald-700 mb-2 text-center">توزيع المكاتب</h4>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between"><span>صغيرة ({fmt(recommendations.offices.small?.avgArea)} sqft)</span><span className="font-bold text-emerald-700">{recommendations.offices.small?.pct}%</span></div>
                    <div className="flex justify-between"><span>متوسطة ({fmt(recommendations.offices.medium?.avgArea)} sqft)</span><span className="font-bold text-emerald-700">{recommendations.offices.medium?.pct}%</span></div>
                    <div className="flex justify-between"><span>كبيرة ({fmt(recommendations.offices.large?.avgArea)} sqft)</span><span className="font-bold text-emerald-700">{recommendations.offices.large?.pct}%</span></div>
                    <div className="flex justify-between border-t border-emerald-100 pt-1 font-bold text-emerald-800">
                      <span>الإجمالي</span><span className="text-emerald-600">100%</span>
                    </div>
                  </div>
                </div>
              )}

              {/* جودة التشطيب */}
              <div className="bg-white/80 rounded-lg p-3 border border-emerald-100">
                <h4 className="text-xs font-bold text-emerald-700 mb-2 text-center">جودة التشطيب</h4>
                <div className="text-center text-lg font-bold text-emerald-800 mt-2">{recommendations.finishingQuality || "ممتاز"}</div>
              </div>
            </div>

            {/* Summary */}
            {recommendations.summary && (
              <div className="mt-3 p-2.5 bg-white/60 rounded-lg border border-emerald-100 text-xs text-emerald-700">
                {recommendations.summary}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* القسم الثالث: الحقول القابلة للتعديل */}
      {/* ═══════════════════════════════════════════ */}

      {/* توزيع الوحدات السكنية */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm flex items-center gap-2">🏠 توزيع الوحدات السكنية %</h3>
            <span className={`text-xs font-bold px-2 py-0.5 rounded ${resTotalPct === 100 ? "bg-emerald-100 text-emerald-700" : resTotalPct === 0 ? "bg-gray-100 text-gray-500" : "bg-red-100 text-red-700"}`}>
              {resTotalPct}%
            </span>
          </div>

          {/* Distribution inputs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {resRows.map(r => (
              <div key={r.key} className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{r.label}</Label>
                <div className="flex items-center gap-1">
                  <EditableNum value={r.pct} onChange={(v) => setField(r.pctKey, v)} />
                  <span className="text-xs text-muted-foreground">%</span>
                </div>
              </div>
            ))}
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-right py-2 px-2 font-bold text-muted-foreground">نوع الوحدة</th>
                  <th className="text-center py-2 px-2 font-bold text-muted-foreground">النسبة %</th>
                  <th className="text-center py-2 px-2 font-bold text-muted-foreground">متوسط المساحة</th>
                  <th className="text-center py-2 px-2 font-bold text-muted-foreground">المساحة المخصصة (قدم²)</th>
                  <th className="text-center py-2 px-2 font-bold text-muted-foreground">عدد الوحدات</th>
                </tr>
              </thead>
              <tbody>
                {resRows.map(r => {
                  const allocated = saleableRes * (r.pct / 100);
                  const units = r.avg > 0 ? Math.floor(allocated / r.avg) : 0;
                  return (
                    <tr key={r.key} className="border-b border-border/50">
                      <td className="py-1.5 px-2 font-medium">{r.label}</td>
                      <td className="py-1.5 px-2 text-center">{r.pct}%</td>
                      <td className="py-1.5 px-2"><EditableNum value={r.avg} onChange={(v) => setField(r.avgKey, v)} /></td>
                      <td className="py-1.5 px-2 text-center font-mono">{fmt(allocated)}</td>
                      <td className="py-1.5 px-2 text-center font-bold text-primary">{units}</td>
                    </tr>
                  );
                })}
                <tr className="border-t-2 border-primary/30 font-bold">
                  <td className="py-2 px-2">الإجمالي</td>
                  <td className={`py-2 px-2 text-center ${resTotalPct === 100 ? "text-emerald-600" : resTotalPct === 0 ? "text-gray-400" : "text-red-600"}`}>{resTotalPct}%</td>
                  <td className="py-2 px-2 text-center">—</td>
                  <td className="py-2 px-2 text-center font-mono">{fmt(saleableRes)}</td>
                  <td className="py-2 px-2 text-center text-primary">
                    {resRows.reduce((sum, r) => sum + (r.avg > 0 ? Math.floor(saleableRes * (r.pct / 100) / r.avg) : 0), 0)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* توزيع المحلات */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm flex items-center gap-2">🏪 توزيع المحلات %</h3>
            <span className={`text-xs font-bold px-2 py-0.5 rounded ${retTotalPct === 100 ? "bg-emerald-100 text-emerald-700" : retTotalPct === 0 ? "bg-gray-100 text-gray-500" : "bg-red-100 text-red-700"}`}>
              {retTotalPct}%
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-4">
            {retRows.map(r => (
              <div key={r.key} className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{r.label}</Label>
                <div className="flex items-center gap-1">
                  <EditableNum value={r.pct} onChange={(v) => setField(r.pctKey, v)} />
                  <span className="text-xs text-muted-foreground">%</span>
                </div>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-right py-2 px-2 font-bold text-muted-foreground">نوع المحل</th>
                  <th className="text-center py-2 px-2 font-bold text-muted-foreground">النسبة %</th>
                  <th className="text-center py-2 px-2 font-bold text-muted-foreground">متوسط المساحة</th>
                  <th className="text-center py-2 px-2 font-bold text-muted-foreground">المساحة المخصصة (قدم²)</th>
                  <th className="text-center py-2 px-2 font-bold text-muted-foreground">عدد الوحدات</th>
                </tr>
              </thead>
              <tbody>
                {retRows.map(r => {
                  const allocated = saleableRet * (r.pct / 100);
                  const units = r.avg > 0 ? Math.floor(allocated / r.avg) : 0;
                  return (
                    <tr key={r.key} className="border-b border-border/50">
                      <td className="py-1.5 px-2 font-medium">{r.label}</td>
                      <td className="py-1.5 px-2 text-center">{r.pct}%</td>
                      <td className="py-1.5 px-2"><EditableNum value={r.avg} onChange={(v) => setField(r.avgKey, v)} /></td>
                      <td className="py-1.5 px-2 text-center font-mono">{fmt(allocated)}</td>
                      <td className="py-1.5 px-2 text-center font-bold text-primary">{units}</td>
                    </tr>
                  );
                })}
                <tr className="border-t-2 border-primary/30 font-bold">
                  <td className="py-2 px-2">الإجمالي</td>
                  <td className={`py-2 px-2 text-center ${retTotalPct === 100 ? "text-emerald-600" : retTotalPct === 0 ? "text-gray-400" : "text-red-600"}`}>{retTotalPct}%</td>
                  <td className="py-2 px-2 text-center">—</td>
                  <td className="py-2 px-2 text-center font-mono">{fmt(saleableRet)}</td>
                  <td className="py-2 px-2 text-center text-primary">
                    {retRows.reduce((sum, r) => sum + (r.avg > 0 ? Math.floor(saleableRet * (r.pct / 100) / r.avg) : 0), 0)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* توزيع المكاتب */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm flex items-center gap-2">🏢 توزيع المكاتب %</h3>
            <span className={`text-xs font-bold px-2 py-0.5 rounded ${offTotalPct === 100 ? "bg-emerald-100 text-emerald-700" : offTotalPct === 0 ? "bg-gray-100 text-gray-500" : "bg-red-100 text-red-700"}`}>
              {offTotalPct}%
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-4">
            {offRows.map(r => (
              <div key={r.key} className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{r.label}</Label>
                <div className="flex items-center gap-1">
                  <EditableNum value={r.pct} onChange={(v) => setField(r.pctKey, v)} />
                  <span className="text-xs text-muted-foreground">%</span>
                </div>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-right py-2 px-2 font-bold text-muted-foreground">نوع المكتب</th>
                  <th className="text-center py-2 px-2 font-bold text-muted-foreground">النسبة %</th>
                  <th className="text-center py-2 px-2 font-bold text-muted-foreground">متوسط المساحة</th>
                  <th className="text-center py-2 px-2 font-bold text-muted-foreground">المساحة المخصصة (قدم²)</th>
                  <th className="text-center py-2 px-2 font-bold text-muted-foreground">عدد الوحدات</th>
                </tr>
              </thead>
              <tbody>
                {offRows.map(r => {
                  const allocated = saleableOff * (r.pct / 100);
                  const units = r.avg > 0 ? Math.floor(allocated / r.avg) : 0;
                  return (
                    <tr key={r.key} className="border-b border-border/50">
                      <td className="py-1.5 px-2 font-medium">{r.label}</td>
                      <td className="py-1.5 px-2 text-center">{r.pct}%</td>
                      <td className="py-1.5 px-2"><EditableNum value={r.avg} onChange={(v) => setField(r.avgKey, v)} /></td>
                      <td className="py-1.5 px-2 text-center font-mono">{fmt(allocated)}</td>
                      <td className="py-1.5 px-2 text-center font-bold text-primary">{units}</td>
                    </tr>
                  );
                })}
                <tr className="border-t-2 border-primary/30 font-bold">
                  <td className="py-2 px-2">الإجمالي</td>
                  <td className={`py-2 px-2 text-center ${offTotalPct === 100 ? "text-emerald-600" : offTotalPct === 0 ? "text-gray-400" : "text-red-600"}`}>{offTotalPct}%</td>
                  <td className="py-2 px-2 text-center">—</td>
                  <td className="py-2 px-2 text-center font-mono">{fmt(saleableOff)}</td>
                  <td className="py-2 px-2 text-center text-primary">
                    {offRows.reduce((sum, r) => sum + (r.avg > 0 ? Math.floor(saleableOff * (r.pct / 100) / r.avg) : 0), 0)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* جودة التشطيب */}
      <Card>
        <CardContent className="p-4">
          <h3 className="font-bold text-sm mb-3 flex items-center gap-2">✨ جودة التشطيب</h3>
          <Select value={fields.finishingQuality} onValueChange={(v) => setField("finishingQuality", v)}>
            <SelectTrigger className="w-full md:w-64 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ممتاز">تشطيب ممتاز</SelectItem>
              <SelectItem value="جيد">تشطيب جيد</SelectItem>
              <SelectItem value="عادي">تشطيب عادي</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* أزرار الحفظ والاعتماد */}
      <div className="flex items-center justify-between gap-3">
        <Button
          onClick={handleSave}
          disabled={saveMutation.isPending || !isDirty}
          className="gap-2"
          variant={isDirty ? "default" : "outline"}
        >
          {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {isDirty ? "حفظ التغييرات" : "محفوظ"}
        </Button>

        <Button
          onClick={() => { if (projectId) approvalMutation.mutate({ projectId, approved: !isApproved }); }}
          disabled={approvalMutation.isPending}
          variant={isApproved ? "outline" : "default"}
          className={`gap-2 ${isApproved ? "border-emerald-300 text-emerald-700" : "bg-emerald-600 hover:bg-emerald-700 text-white"}`}
        >
          {approvalMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
          {isApproved ? "✓ تم اعتماد المرحلة" : "اعتماد المرحلة"}
        </Button>
      </div>
    </div>
  );
}
