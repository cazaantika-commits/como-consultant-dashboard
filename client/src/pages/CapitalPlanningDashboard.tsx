import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Building2, TrendingUp, DollarSign, Wallet, BarChart3,
  ChevronLeft, AlertTriangle, Landmark, Calendar, ArrowUpDown,
  Download, Loader2, RefreshCw, Minus, Plus, Eye, EyeOff,
  Target, Shield, Banknote
} from "lucide-react";
import { useLocation } from "wouter";

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

function formatAED(amount: number): string {
  if (Math.abs(amount) >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(amount) >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
  if (Math.abs(amount) >= 1_000) return `${(amount / 1_000).toFixed(0)}K`;
  return amount.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

const PROJECT_COLORS = ['#ef4444', '#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

const PHASE_COLORS: Record<string, { bg: string; label: string }> = {
  preDev: { bg: '#f59e0b', label: 'ما قبل البناء' },
  construction: { bg: '#3b82f6', label: 'البناء' },
  handover: { bg: '#10b981', label: 'التسليم' },
};

// ═══════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════

export default function CapitalPlanningDashboard({ embedded = false }: { embedded?: boolean } = {}) {
  const [, navigate] = useLocation();
  const [availableCapital, setAvailableCapital] = useState(100_000_000);
  const [capitalInput, setCapitalInput] = useState("100,000,000");
  const [excludeIds, setExcludeIds] = useState<number[]>([]);
  const [delayMonths, setDelayMonths] = useState<Record<string, number>>({});

  const utils = trpc.useUtils();

  const simulationQuery = trpc.cashFlowProgram.getPortfolioSimulation.useQuery({
    availableCapital,
    excludeProjectIds: excludeIds,
    delayMonths,
  });

  const importMutation = trpc.cashFlowProgram.importAllProjects.useMutation({
    onSuccess: (data) => {
      if (data && data.imported > 0) {
        toast.success(`تم استيراد ${data.imported} مشروع جديد`);
        utils.cashFlowProgram.getPortfolioSimulation.invalidate();
      } else {
        toast.info("جميع المشاريع مستوردة مسبقاً");
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const data = simulationQuery.data;

  const handleCapitalChange = (val: string) => {
    setCapitalInput(val);
    const num = Number(val.replace(/,/g, ''));
    if (!isNaN(num) && num >= 0) setAvailableCapital(num);
  };

  const toggleProject = (id: number) => {
    setExcludeIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const adjustDelay = (id: number, delta: number) => {
    setDelayMonths(prev => {
      const current = prev[String(id)] || 0;
      const next = Math.max(-12, Math.min(24, current + delta));
      return { ...prev, [String(id)]: next };
    });
  };

  // ─── Loading State ───
  if (simulationQuery.isLoading) {
    return (
      <div className={`${embedded ? '' : 'min-h-screen'} bg-gradient-to-br from-slate-50 via-white to-amber-50/30 flex items-center justify-center`} dir="rtl">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center shadow-lg shadow-amber-500/30 animate-pulse">
            <Landmark className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-lg font-bold text-foreground">جاري تحميل المحاكي...</h2>
          <Loader2 className="w-5 h-5 animate-spin mx-auto text-amber-500" />
        </div>
      </div>
    );
  }

  // ─── Empty State ───
  if (!data || data.projects.length === 0) {
    return (
      <div className={`${embedded ? '' : 'min-h-screen'} bg-gradient-to-br from-slate-50 via-white to-amber-50/30`} dir="rtl">
        <div className="max-w-4xl mx-auto px-6 py-12">
          {!embedded && <Button variant="ghost" onClick={() => navigate("/")} className="mb-8 gap-2">
            <ChevronLeft className="w-4 h-4" />
            العودة
          </Button>}
          <div className="text-center space-y-6 py-20">
            <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center shadow-xl shadow-amber-500/30">
              <Landmark className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-2xl font-bold">محاكي تخطيط رأس المال</h1>
            <p className="text-muted-foreground max-w-md mx-auto">
              لا توجد مشاريع في برنامج التدفقات النقدية. اضغط الزر أدناه لاستيراد المشاريع من دراسات الجدوى.
            </p>
            <Button
              onClick={() => importMutation.mutate()}
              disabled={importMutation.isPending}
              className="bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white shadow-lg shadow-amber-500/25"
            >
              {importMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <Download className="w-4 h-4 ml-2" />}
              استيراد المشاريع من دراسات الجدوى
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const activeProjects = data.projects.filter((p: any) => !p.excluded);
  const totalProfit = data.totalPortfolioSales - data.totalPortfolioCost;
  const portfolioROI = data.totalDeveloperExposure > 0 ? (totalProfit / data.totalDeveloperExposure) * 100 : 0;
  const hasFundingGap = data.fundingGap > 0;

  return (
    <div className={`${embedded ? '' : 'min-h-screen'} bg-gradient-to-br from-slate-50 via-white to-amber-50/30`} dir="rtl">
      {/* ── Header ── */}
      {!embedded && <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-amber-200/40 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center shadow-lg shadow-amber-500/25">
                <Landmark className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-foreground">محاكي تخطيط رأس المال</h1>
                <p className="text-xs text-muted-foreground">{activeProjects.length} مشروع نشط من {data.projects.length}</p>
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => importMutation.mutate()}
            disabled={importMutation.isPending}
            className="gap-2 text-xs"
          >
            {importMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            تحديث المشاريع
          </Button>
        </div>
      </header>}
      {embedded && <div className="max-w-7xl mx-auto px-6 pt-4 flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => importMutation.mutate()}
          disabled={importMutation.isPending}
          className="gap-2 text-xs"
        >
          {importMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          تحديث المشاريع
        </Button>
      </div>}

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <KPICard icon={Building2} label="إجمالي التكاليف" value={formatAED(data.totalPortfolioCost)} sub="AED" gradient="from-red-500 to-rose-600" shadow="shadow-red-500/20" />
          <KPICard icon={TrendingUp} label="إجمالي الإيرادات" value={formatAED(data.totalPortfolioSales)} sub="AED" gradient="from-green-500 to-emerald-600" shadow="shadow-green-500/20" />
          <KPICard icon={Wallet} label="أقصى تعرض للمستثمر" value={formatAED(data.totalDeveloperExposure)} sub={data.portfolioPeakMonthLabel} gradient="from-amber-500 to-yellow-600" shadow="shadow-amber-500/20" />
          <KPICard icon={Target} label="صافي الربح" value={formatAED(totalProfit)} sub={`ROI ${portfolioROI.toFixed(1)}%`} gradient={totalProfit >= 0 ? "from-emerald-500 to-teal-600" : "from-red-500 to-rose-600"} shadow={totalProfit >= 0 ? "shadow-emerald-500/20" : "shadow-red-500/20"} />
          <KPICard icon={Banknote} label="رأس المال المتاح" value={formatAED(availableCapital)} sub="AED" gradient="from-blue-500 to-indigo-600" shadow="shadow-blue-500/20" />
          <KPICard icon={hasFundingGap ? AlertTriangle : Shield} label="فجوة التمويل" value={hasFundingGap ? formatAED(data.fundingGap) : "لا توجد"} sub={hasFundingGap ? `${data.fundingGapMonths.length} شهر عجز` : "✓ مغطى"} gradient={hasFundingGap ? "from-red-600 to-rose-700" : "from-green-500 to-emerald-600"} shadow={hasFundingGap ? "shadow-red-600/20" : "shadow-green-500/20"} />
        </div>

        {/* ── Capital Input + Project Controls ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="border-amber-200/60 shadow-lg shadow-amber-500/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-amber-500" />
                رأس المال المتاح
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Input value={capitalInput} onChange={(e) => handleCapitalChange(e.target.value)} className="text-left font-mono text-lg" dir="ltr" placeholder="100,000,000" />
                <div className="flex gap-2 flex-wrap">
                  {[50, 100, 150, 200, 300].map(m => (
                    <Button key={m} variant="outline" size="sm"
                      className={`text-xs ${availableCapital === m * 1_000_000 ? 'bg-amber-100 border-amber-300 text-amber-800' : ''}`}
                      onClick={() => { setAvailableCapital(m * 1_000_000); setCapitalInput(`${m},000,000`); }}
                    >
                      {m}M
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2 border-slate-200/60 shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-500" />
                التحكم بالمشاريع
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.projects.map((p: any, idx: number) => (
                  <div key={p.id} className={`flex items-center gap-4 p-3 rounded-xl border transition-all ${p.excluded ? 'bg-muted/50 border-muted opacity-60' : 'bg-white border-slate-200 hover:border-amber-200 hover:shadow-sm'}`}>
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: PROJECT_COLORS[idx % PROJECT_COLORS.length] }} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{p.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {p.startDate} · {p.totalMonths} شهر
                        {!p.excluded && p.totalCost > 0 && <> · <span className="text-red-500">{formatAED(p.totalCost)}</span></>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => adjustDelay(p.id, -3)} disabled={p.excluded}>
                        <Minus className="w-3 h-3" />
                      </Button>
                      <Badge variant={(delayMonths[String(p.id)] || 0) !== 0 ? "default" : "outline"}
                        className={`text-xs min-w-[60px] justify-center ${(delayMonths[String(p.id)] || 0) > 0 ? 'bg-amber-100 text-amber-800 border-amber-300' : (delayMonths[String(p.id)] || 0) < 0 ? 'bg-blue-100 text-blue-800 border-blue-300' : ''}`}
                      >
                        {(delayMonths[String(p.id)] || 0) > 0 ? `+${delayMonths[String(p.id)]} شهر` : (delayMonths[String(p.id)] || 0) < 0 ? `${delayMonths[String(p.id)]} شهر` : 'بدون تأخير'}
                      </Badge>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => adjustDelay(p.id, 3)} disabled={p.excluded}>
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleProject(p.id)}>
                      {p.excluded ? <EyeOff className="w-4 h-4 text-muted-foreground" /> : <Eye className="w-4 h-4 text-green-600" />}
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Gantt Chart ── */}
        <GanttChart data={data} delayMonths={delayMonths} />

        {/* ── Cumulative Capital Demand Chart ── */}
        <CumulativeChart data={data} availableCapital={availableCapital} />

        {/* ── Stacked Monthly Outflow ── */}
        <StackedOutflowChart data={data} />

        {/* ── Comparison Table ── */}
        <ComparisonTable data={data} />
      </main>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// KPI Card
// ═══════════════════════════════════════════════════════════════

function KPICard({ icon: Icon, label, value, sub, gradient, shadow }: {
  icon: any; label: string; value: string; sub: string; gradient: string; shadow: string;
}) {
  return (
    <Card className={`relative overflow-hidden border-0 ${shadow} shadow-lg`}>
      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${gradient}`} />
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center flex-shrink-0`}>
            <Icon className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-muted-foreground leading-tight mb-1">{label}</p>
            <p className="text-lg font-bold text-foreground leading-tight">{value}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════
// Gantt Chart
// ═══════════════════════════════════════════════════════════════

function GanttChart({ data, delayMonths }: { data: any; delayMonths: Record<string, number> }) {
  const activeProjects = data.projects.filter((p: any) => !p.excluded);
  if (activeProjects.length === 0 || data.monthLabels.length === 0) return null;

  const totalMonths = data.monthLabels.length;

  return (
    <Card className="shadow-lg">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Calendar className="w-4 h-4 text-blue-500" />
          الجدول الزمني التفاعلي للمحفظة
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div style={{ minWidth: Math.max(800, totalMonths * 40) }}>
            {/* Month headers */}
            <div className="flex border-b pb-2 mb-4">
              <div className="w-52 flex-shrink-0 font-medium text-sm text-muted-foreground">المشروع</div>
              <div className="flex-1 flex">
                {data.monthLabels.map((label: string, i: number) => (
                  <div key={i} className="text-center text-[9px] text-muted-foreground" style={{ width: `${100 / totalMonths}%`, minWidth: 30 }}>
                    {i % 3 === 0 ? label.replace(/\d{4}/, (y: string) => `'${y.slice(2)}`) : ''}
                  </div>
                ))}
              </div>
            </div>

            {/* Project rows */}
            {activeProjects.map((project: any, pIdx: number) => {
              const delay = delayMonths[String(project.id)] || 0;
              const adjustedStart = project.adjustedStartDate || project.startDate;
              const [projYear, projMonth] = adjustedStart.split('-').map(Number);

              // Parse global start from first month label
              const firstLabel = data.monthLabels[0];
              const yearMatch = firstLabel.match(/\d{4}/);
              const globalYear = yearMatch ? parseInt(yearMatch[0]) : projYear;
              const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
              const monthIdx = monthNames.findIndex(m => firstLabel.includes(m));
              const globalMonth = monthIdx >= 0 ? monthIdx + 1 : 1;

              const offset = (projYear - globalYear) * 12 + (projMonth - globalMonth);
              const preDev = project.phases?.preDev || 6;
              const construction = project.phases?.construction || 16;
              const handover = project.phases?.handover || 2;

              return (
                <div key={project.id} className="flex items-center mb-3 group">
                  <div className="w-52 flex-shrink-0 pr-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: PROJECT_COLORS[pIdx % PROJECT_COLORS.length] }} />
                      <div className="min-w-0">
                        <div className="text-xs font-medium truncate">{project.name}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {project.totalMonths} شهر
                          {delay !== 0 && <span className={delay > 0 ? 'text-amber-600' : 'text-blue-600'}> ({delay > 0 ? '+' : ''}{delay} شهر)</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 relative h-9">
                    <div className="absolute inset-0 flex">
                      {data.monthLabels.map((_: any, i: number) => (
                        <div key={i} className="border-l border-border/20 h-full" style={{ width: `${100 / totalMonths}%` }} />
                      ))}
                    </div>
                    {/* Pre-dev */}
                    <div className="absolute top-1 h-7 rounded-l-md transition-all" style={{
                      left: `${(Math.max(0, offset) / totalMonths) * 100}%`,
                      width: `${(preDev / totalMonths) * 100}%`,
                      backgroundColor: PHASE_COLORS.preDev.bg, opacity: 0.85,
                    }}>
                      <span className="text-[8px] text-white font-medium px-1 truncate block leading-7">{preDev >= 4 ? 'ما قبل البناء' : ''}</span>
                    </div>
                    {/* Construction */}
                    <div className="absolute top-1 h-7 transition-all" style={{
                      left: `${((Math.max(0, offset) + preDev) / totalMonths) * 100}%`,
                      width: `${(construction / totalMonths) * 100}%`,
                      backgroundColor: PHASE_COLORS.construction.bg, opacity: 0.85,
                    }}>
                      <span className="text-[8px] text-white font-medium px-1 truncate block leading-7">البناء ({construction} شهر)</span>
                    </div>
                    {/* Handover */}
                    <div className="absolute top-1 h-7 rounded-r-md transition-all" style={{
                      left: `${((Math.max(0, offset) + preDev + construction) / totalMonths) * 100}%`,
                      width: `${(handover / totalMonths) * 100}%`,
                      backgroundColor: PHASE_COLORS.handover.bg, opacity: 0.85,
                    }}>
                      <span className="text-[8px] text-white font-medium px-1 truncate block leading-7">{handover >= 3 ? 'تسليم' : ''}</span>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Legend */}
            <div className="flex items-center gap-5 mt-4 pt-4 border-t justify-center text-xs">
              {Object.entries(PHASE_COLORS).map(([key, { bg, label }]) => (
                <div key={key} className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: bg }} />
                  <span className="text-muted-foreground">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════
// Cumulative Capital Demand Chart
// ═══════════════════════════════════════════════════════════════

function CumulativeChart({ data, availableCapital }: { data: any; availableCapital: number }) {
  if (!data.monthLabels.length) return null;

  const maxDev = Math.max(...data.portfolioDeveloperCumulative, availableCapital, 1);
  const chartHeight = 320;
  const totalMonths = data.monthLabels.length;
  const chartWidth = totalMonths * 30;
  const capitalLineY = chartHeight - (availableCapital / maxDev) * chartHeight;

  return (
    <Card className="shadow-lg">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-red-500" />
          الطلب التراكمي على رأس المال مقابل رأس المال المتاح
          {data.fundingGap > 0 && (
            <Badge variant="destructive" className="text-xs mr-2">
              <AlertTriangle className="w-3 h-3 ml-1" />
              فجوة {formatAED(data.fundingGap)}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative" style={{ height: chartHeight + 40 }}>
          <div className="absolute left-0 top-0 bottom-10 w-16 flex flex-col justify-between text-xs text-muted-foreground">
            <span>{formatAED(maxDev)}</span>
            <span>{formatAED(maxDev * 0.75)}</span>
            <span>{formatAED(maxDev * 0.5)}</span>
            <span>{formatAED(maxDev * 0.25)}</span>
            <span>0</span>
          </div>
          <div className="mr-0 ml-16 h-full relative overflow-x-auto">
            <svg width={chartWidth} height={chartHeight + 40} viewBox={`0 0 ${chartWidth} ${chartHeight + 40}`}>
              {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
                <line key={pct} x1="0" y1={chartHeight * (1 - pct)} x2={chartWidth} y2={chartHeight * (1 - pct)} stroke="currentColor" strokeOpacity="0.08" strokeDasharray="4" />
              ))}

              {/* Funding gap area */}
              {data.fundingGap > 0 && (
                <path
                  d={`M0,${capitalLineY} ${data.portfolioDeveloperCumulative.map((v: number, i: number) => {
                    const y = chartHeight - (v / maxDev) * chartHeight;
                    return `L${i * 30 + 15},${Math.min(capitalLineY, y)}`;
                  }).join(' ')} L${(totalMonths - 1) * 30 + 15},${capitalLineY} Z`}
                  fill="rgba(239,68,68,0.12)"
                />
              )}

              {/* Developer cumulative */}
              <path
                d={`M0,${chartHeight} ${data.portfolioDeveloperCumulative.map((v: number, i: number) =>
                  `L${i * 30 + 15},${chartHeight - (v / maxDev) * chartHeight}`
                ).join(' ')} L${(totalMonths - 1) * 30 + 15},${chartHeight} Z`}
                fill="rgba(239,68,68,0.1)"
              />
              <polyline
                points={data.portfolioDeveloperCumulative.map((v: number, i: number) =>
                  `${i * 30 + 15},${chartHeight - (v / maxDev) * chartHeight}`
                ).join(' ')}
                fill="none" stroke="#ef4444" strokeWidth="2.5"
              />

              {/* Escrow balance */}
              <path
                d={`M0,${chartHeight} ${data.portfolioEscrowBalance.map((v: number, i: number) =>
                  `L${i * 30 + 15},${chartHeight - (Math.max(0, v) / maxDev) * chartHeight}`
                ).join(' ')} L${(totalMonths - 1) * 30 + 15},${chartHeight} Z`}
                fill="rgba(34,197,94,0.1)"
              />
              <polyline
                points={data.portfolioEscrowBalance.map((v: number, i: number) =>
                  `${i * 30 + 15},${chartHeight - (Math.max(0, v) / maxDev) * chartHeight}`
                ).join(' ')}
                fill="none" stroke="#22c55e" strokeWidth="2"
              />

              {/* Available capital line */}
              <line x1="0" y1={capitalLineY} x2={chartWidth} y2={capitalLineY} stroke="#3b82f6" strokeWidth="2" strokeDasharray="8,4" />
              <text x={chartWidth - 10} y={capitalLineY - 8} fill="#3b82f6" fontSize="11" fontWeight="bold" textAnchor="end">
                رأس المال المتاح: {formatAED(availableCapital)}
              </text>

              {/* Peak exposure marker */}
              {data.portfolioPeakMonth > 0 && (
                <>
                  <line x1={(data.portfolioPeakMonth - 1) * 30 + 15} y1="0" x2={(data.portfolioPeakMonth - 1) * 30 + 15} y2={chartHeight} stroke="#f59e0b" strokeWidth="1" strokeDasharray="4" />
                  <circle cx={(data.portfolioPeakMonth - 1) * 30 + 15} cy={chartHeight - (data.portfolioPeakExposure / maxDev) * chartHeight} r="5" fill="#f59e0b" />
                  <text x={(data.portfolioPeakMonth - 1) * 30 + 20} y={chartHeight - (data.portfolioPeakExposure / maxDev) * chartHeight - 10} fill="#f59e0b" fontSize="10" fontWeight="bold">
                    أقصى تعرض: {formatAED(data.portfolioPeakExposure)}
                  </text>
                </>
              )}

              {/* X-axis labels */}
              {data.monthLabels.map((label: string, i: number) => (
                i % 3 === 0 && (
                  <text key={i} x={i * 30 + 15} y={chartHeight + 20} fill="currentColor" fillOpacity="0.5" fontSize="9" textAnchor="middle">
                    {label.replace(/\d{4}/, (y: string) => `'${y.slice(2)}`)}
                  </text>
                )
              ))}
            </svg>
          </div>
        </div>
        <div className="flex items-center gap-6 mt-4 justify-center text-xs">
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-500" /><span>تمويل المستثمر التراكمي</span></div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-green-500" /><span>رصيد الإسكرو</span></div>
          <div className="flex items-center gap-2"><div className="w-8 h-0.5 border-t-2 border-dashed border-blue-500" /><span>رأس المال المتاح</span></div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-amber-500" /><span>أقصى تعرض</span></div>
        </div>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════
// Stacked Monthly Outflow Chart
// ═══════════════════════════════════════════════════════════════

function StackedOutflowChart({ data }: { data: any }) {
  const activeProjects = data.projects.filter((p: any) => !p.excluded);
  if (activeProjects.length === 0 || !data.monthLabels.length) return null;

  const totalMonths = data.monthLabels.length;
  const chartWidth = totalMonths * 35;
  const chartHeight = 200;

  const maxMonthly = Math.max(
    ...data.monthLabels.map((_: any, i: number) =>
      activeProjects.reduce((sum: number, p: any) => sum + (p.monthlyDeveloperOutflow?.[i] || 0), 0)
    ), 1
  );

  return (
    <Card className="shadow-lg">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Wallet className="w-4 h-4 text-purple-500" />
          التدفق الشهري للمستثمر حسب المشروع (مكدس)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div style={{ minWidth: Math.max(600, chartWidth) }}>
            <div className="relative" style={{ height: chartHeight }}>
              <svg width={chartWidth} height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
                {[0.25, 0.5, 0.75, 1].map((pct) => (
                  <line key={pct} x1="0" y1={chartHeight * (1 - pct)} x2={chartWidth} y2={chartHeight * (1 - pct)} stroke="currentColor" strokeOpacity="0.06" strokeDasharray="4" />
                ))}
                {data.monthLabels.map((_: any, monthIdx: number) => {
                  let yOffset = chartHeight;
                  return activeProjects.map((p: any, pIdx: number) => {
                    const val = p.monthlyDeveloperOutflow?.[monthIdx] || 0;
                    const barH = (val / maxMonthly) * (chartHeight - 10);
                    yOffset -= barH;
                    return (
                      <rect key={`${p.id}-${monthIdx}`} x={monthIdx * 35 + 5} y={yOffset} width={25} height={barH}
                        fill={PROJECT_COLORS[pIdx % PROJECT_COLORS.length]} opacity={0.8} rx="1" />
                    );
                  });
                })}
              </svg>
            </div>
            <div className="flex items-center gap-4 mt-3 justify-center text-xs flex-wrap">
              {activeProjects.map((p: any, i: number) => (
                <div key={p.id} className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: PROJECT_COLORS[i % PROJECT_COLORS.length] }} />
                  <span className="text-muted-foreground">{p.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════
// Comparison Table
// ═══════════════════════════════════════════════════════════════

function ComparisonTable({ data }: { data: any }) {
  const activeProjects = data.projects.filter((p: any) => !p.excluded);
  if (activeProjects.length === 0) return null;

  return (
    <Card className="shadow-lg">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <ArrowUpDown className="w-4 h-4 text-indigo-500" />
          مقارنة المشاريع
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-right py-3 px-3 font-semibold text-xs">المشروع</th>
                <th className="text-right py-3 px-3 font-semibold text-xs">البداية</th>
                <th className="text-right py-3 px-3 font-semibold text-xs">المدة</th>
                <th className="text-right py-3 px-3 font-semibold text-xs">التكاليف</th>
                <th className="text-right py-3 px-3 font-semibold text-xs">الإيرادات</th>
                <th className="text-right py-3 px-3 font-semibold text-xs">تعرض المستثمر</th>
                <th className="text-right py-3 px-3 font-semibold text-xs">ذروة التعرض</th>
                <th className="text-right py-3 px-3 font-semibold text-xs">الربح</th>
                <th className="text-right py-3 px-3 font-semibold text-xs">ROI</th>
              </tr>
            </thead>
            <tbody>
              {activeProjects.map((p: any, i: number) => {
                const profit = p.totalSales - p.totalCost;
                const roi = p.developerExposure > 0 ? (profit / p.developerExposure) * 100 : 0;
                return (
                  <tr key={p.id} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: PROJECT_COLORS[i % PROJECT_COLORS.length] }} />
                        <span className="font-medium text-xs">{p.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-muted-foreground text-xs">{p.adjustedStartDate || p.startDate}</td>
                    <td className="py-3 px-3"><Badge variant="outline" className="text-[10px]">{p.totalMonths} شهر</Badge></td>
                    <td className="py-3 px-3 text-red-600 font-semibold text-xs">{formatAED(p.totalCost)}</td>
                    <td className="py-3 px-3 text-green-600 font-semibold text-xs">{formatAED(p.totalSales)}</td>
                    <td className="py-3 px-3 text-amber-600 font-semibold text-xs">{formatAED(p.developerExposure)}</td>
                    <td className="py-3 px-3 text-muted-foreground text-[10px]">{p.peakMonthLabel}</td>
                    <td className={`py-3 px-3 font-bold text-xs ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatAED(profit)}</td>
                    <td className={`py-3 px-3 font-bold text-xs ${roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>{roi.toFixed(1)}%</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-gradient-to-r from-amber-50 to-yellow-50 font-bold">
                <td className="py-3 px-3 text-sm">المجموع</td>
                <td className="py-3 px-3" colSpan={2}></td>
                <td className="py-3 px-3 text-red-600 text-sm">{formatAED(data.totalPortfolioCost)}</td>
                <td className="py-3 px-3 text-green-600 text-sm">{formatAED(data.totalPortfolioSales)}</td>
                <td className="py-3 px-3 text-amber-600 text-sm">{formatAED(data.totalDeveloperExposure)}</td>
                <td className="py-3 px-3"></td>
                <td className="py-3 px-3 text-green-600 text-sm">{formatAED(data.totalPortfolioSales - data.totalPortfolioCost)}</td>
                <td className="py-3 px-3 text-green-600 text-sm">
                  {data.totalDeveloperExposure > 0 ? (((data.totalPortfolioSales - data.totalPortfolioCost) / data.totalDeveloperExposure) * 100).toFixed(1) : 0}%
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
