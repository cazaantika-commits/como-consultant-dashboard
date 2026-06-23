import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Building2, TrendingDown, TrendingUp, DollarSign, Wallet,
  BarChart3, Download, ChevronLeft, AlertTriangle, Landmark,
  ArrowUpDown, Eye, Layers, Calendar
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

function formatAED(amount: number): string {
  if (Math.abs(amount) >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(2)}M`;
  }
  if (Math.abs(amount) >= 1_000) {
    return `${(amount / 1_000).toFixed(0)}K`;
  }
  return amount.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function formatFullAED(amount: number): string {
  return amount.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

// Phase colors
const PHASE_COLORS: Record<string, string> = {
  preDev: '#f59e0b',
  construction: '#3b82f6',
  handover: '#10b981',
};

// ═══════════════════════════════════════════════════════════════
// Portfolio View Component
// ═══════════════════════════════════════════════════════════════

export default function PortfolioView({ onBack }: { onBack: () => void }) {
  const [activeTab, setActiveTab] = useState('overview');
  const portfolioQuery = trpc.cashFlowProgram.getPortfolioCashFlow.useQuery();

  const data = portfolioQuery.data;

  if (portfolioQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={onBack} className="mb-2">
          <ChevronLeft className="h-4 w-4 ml-1" /> العودة
        </Button>
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </div>
    );
  }

  if (!data || !data.projects || data.projects.length === 0) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={onBack} className="mb-2">
          <ChevronLeft className="h-4 w-4 ml-1" /> العودة
        </Button>
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Layers className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <p className="text-lg font-medium text-muted-foreground">لا توجد مشاريع كافية</p>
            <p className="text-sm text-muted-foreground">أنشئ مشروعاً واحداً على الأقل لعرض المحفظة</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Layers className="h-7 w-7 text-primary" />
              محفظة المشاريع
            </h1>
            <p className="text-muted-foreground text-sm">
              {data.projects.length} مشاريع — رؤية شاملة للتدفقات النقدية
            </p>
          </div>
        </div>
      </div>

      {/* Key Numbers */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-200/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="h-4 w-4 text-red-500" />
              <span className="text-xs text-muted-foreground">إجمالي التكاليف</span>
            </div>
            <div className="text-xl font-bold text-red-600">{formatAED(data.totalPortfolioCost)} AED</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-200/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span className="text-xs text-muted-foreground">إجمالي الإيرادات</span>
            </div>
            <div className="text-xl font-bold text-green-600">{formatAED(data.totalPortfolioSales)} AED</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-200/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span className="text-xs text-muted-foreground">أقصى تعرض للمستثمر</span>
            </div>
            <div className="text-xl font-bold text-amber-600">{formatAED(data.portfolioPeakExposure)} AED</div>
            <div className="text-xs text-muted-foreground">{data.portfolioPeakMonthLabel}</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-200/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="h-4 w-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">عدد المشاريع</span>
            </div>
            <div className="text-xl font-bold text-blue-600">{data.projects.length}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-3 w-full max-w-lg">
          <TabsTrigger value="overview" className="flex items-center gap-1">
            <Eye className="h-3.5 w-3.5" /> نظرة عامة
          </TabsTrigger>
          <TabsTrigger value="timeline" className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" /> الجدول الزمني
          </TabsTrigger>
          <TabsTrigger value="comparison" className="flex items-center gap-1">
            <ArrowUpDown className="h-3.5 w-3.5" /> مقارنة
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <PortfolioChart data={data} />
        </TabsContent>

        {/* Timeline Tab */}
        <TabsContent value="timeline" className="space-y-4">
          <PortfolioTimeline data={data} />
        </TabsContent>

        {/* Comparison Tab */}
        <TabsContent value="comparison" className="space-y-4">
          <ProjectComparison data={data} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Portfolio Chart - Developer Exposure + Escrow Balance
// ═══════════════════════════════════════════════════════════════

function PortfolioChart({ data }: { data: any }) {
  const maxDev = Math.max(...data.portfolioDeveloperCumulative, 1);
  const maxEsc = Math.max(...data.portfolioEscrowBalance.map(Math.abs), 1);
  const maxVal = Math.max(maxDev, maxEsc);
  const chartHeight = 300;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          التدفق النقدي التراكمي للمحفظة
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative" style={{ height: chartHeight }}>
          {/* Y-axis labels */}
          <div className="absolute left-0 top-0 bottom-0 w-16 flex flex-col justify-between text-xs text-muted-foreground">
            <span>{formatAED(maxVal)}</span>
            <span>{formatAED(maxVal * 0.5)}</span>
            <span>0</span>
          </div>
          {/* Chart area */}
          <div className="mr-0 ml-16 h-full relative overflow-x-auto">
            <svg width="100%" height="100%" viewBox={`0 0 ${data.monthLabels.length * 30} ${chartHeight}`} preserveAspectRatio="none">
              {/* Grid lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
                <line
                  key={pct}
                  x1="0" y1={chartHeight * (1 - pct)} x2={data.monthLabels.length * 30} y2={chartHeight * (1 - pct)}
                  stroke="currentColor" strokeOpacity="0.1" strokeDasharray="4"
                />
              ))}
              {/* Developer cumulative (red area) */}
              <path
                d={`M0,${chartHeight} ${data.portfolioDeveloperCumulative.map((v: number, i: number) =>
                  `L${i * 30 + 15},${chartHeight - (v / maxVal) * chartHeight}`
                ).join(' ')} L${(data.portfolioDeveloperCumulative.length - 1) * 30 + 15},${chartHeight} Z`}
                fill="rgba(239,68,68,0.15)"
              />
              <polyline
                points={data.portfolioDeveloperCumulative.map((v: number, i: number) =>
                  `${i * 30 + 15},${chartHeight - (v / maxVal) * chartHeight}`
                ).join(' ')}
                fill="none" stroke="#ef4444" strokeWidth="2"
              />
              {/* Escrow balance (green area) */}
              <path
                d={`M0,${chartHeight} ${data.portfolioEscrowBalance.map((v: number, i: number) =>
                  `L${i * 30 + 15},${chartHeight - (Math.max(0, v) / maxVal) * chartHeight}`
                ).join(' ')} L${(data.portfolioEscrowBalance.length - 1) * 30 + 15},${chartHeight} Z`}
                fill="rgba(34,197,94,0.15)"
              />
              <polyline
                points={data.portfolioEscrowBalance.map((v: number, i: number) =>
                  `${i * 30 + 15},${chartHeight - (Math.max(0, v) / maxVal) * chartHeight}`
                ).join(' ')}
                fill="none" stroke="#22c55e" strokeWidth="2"
              />
              {/* Peak exposure marker */}
              {data.portfolioPeakMonth > 0 && (
                <>
                  <line
                    x1={(data.portfolioPeakMonth - 1) * 30 + 15}
                    y1="0"
                    x2={(data.portfolioPeakMonth - 1) * 30 + 15}
                    y2={chartHeight}
                    stroke="#f59e0b" strokeWidth="1" strokeDasharray="4"
                  />
                  <circle
                    cx={(data.portfolioPeakMonth - 1) * 30 + 15}
                    cy={chartHeight - (data.portfolioPeakExposure / maxVal) * chartHeight}
                    r="5" fill="#f59e0b"
                  />
                </>
              )}
            </svg>
          </div>
        </div>
        {/* Legend */}
        <div className="flex items-center gap-6 mt-4 justify-center text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span>تمويل المستثمر التراكمي</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span>رصيد الإسكرو</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-500" />
            <span>أقصى تعرض</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════
// Portfolio Timeline - Gantt Chart for all projects
// ═══════════════════════════════════════════════════════════════

function PortfolioTimeline({ data }: { data: any }) {
  const totalMonths = data.monthLabels.length;
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          الجدول الزمني الموحد
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div style={{ minWidth: Math.max(800, totalMonths * 40) }}>
            {/* Month headers */}
            <div className="flex border-b pb-2 mb-4">
              <div className="w-48 flex-shrink-0 font-medium text-sm">المشروع</div>
              <div className="flex-1 flex">
                {data.monthLabels.map((label: string, i: number) => (
                  <div
                    key={i}
                    className="text-center text-[10px] text-muted-foreground"
                    style={{ width: `${100 / totalMonths}%`, minWidth: 35 }}
                  >
                    {i % 3 === 0 ? label : ''}
                  </div>
                ))}
              </div>
            </div>

            {/* Project rows */}
            {data.projects.map((project: any) => {
              // Calculate offset from global start
              const [projYear, projMonth] = project.startDate.split('-').map(Number);
              const [globalYear, globalMonth] = data.monthLabels[0]?.match(/(\d+)/)
                ? (() => {
                    // Parse first month label to get global start
                    const firstLabel = data.monthLabels[0];
                    const yearMatch = firstLabel.match(/\d{4}/);
                    const year = yearMatch ? parseInt(yearMatch[0]) : projYear;
                    const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
                    const monthIdx = monthNames.findIndex(m => firstLabel.includes(m));
                    return [year, monthIdx >= 0 ? monthIdx + 1 : 1];
                  })()
                : [projYear, projMonth];

              const offset = (projYear - globalYear) * 12 + (projMonth - globalMonth);
              const preDevEnd = offset + (project.phases?.preDev || 6);
              const constEnd = preDevEnd + (project.phases?.construction || 16);
              const handoverEnd = constEnd + (project.phases?.handover || 2);

              return (
                <div key={project.id} className="flex items-center mb-3">
                  <div className="w-48 flex-shrink-0">
                    <div className="text-sm font-medium truncate">{project.name}</div>
                    <div className="text-xs text-muted-foreground">{project.totalMonths} شهر</div>
                  </div>
                  <div className="flex-1 relative h-8">
                    {/* Background grid */}
                    <div className="absolute inset-0 flex">
                      {data.monthLabels.map((_: any, i: number) => (
                        <div
                          key={i}
                          className="border-l border-border/30 h-full"
                          style={{ width: `${100 / totalMonths}%` }}
                        />
                      ))}
                    </div>
                    {/* Pre-dev phase */}
                    <div
                      className="absolute top-1 h-6 rounded-l-md"
                      style={{
                        left: `${(offset / totalMonths) * 100}%`,
                        width: `${((project.phases?.preDev || 6) / totalMonths) * 100}%`,
                        backgroundColor: PHASE_COLORS.preDev,
                        opacity: 0.8,
                      }}
                    >
                      <span className="text-[9px] text-white font-medium px-1 truncate block leading-6">
                        ما قبل البناء
                      </span>
                    </div>
                    {/* Construction phase */}
                    <div
                      className="absolute top-1 h-6"
                      style={{
                        left: `${(preDevEnd / totalMonths) * 100}%`,
                        width: `${((project.phases?.construction || 16) / totalMonths) * 100}%`,
                        backgroundColor: PHASE_COLORS.construction,
                        opacity: 0.8,
                      }}
                    >
                      <span className="text-[9px] text-white font-medium px-1 truncate block leading-6">
                        البناء
                      </span>
                    </div>
                    {/* Handover phase */}
                    <div
                      className="absolute top-1 h-6 rounded-r-md"
                      style={{
                        left: `${(constEnd / totalMonths) * 100}%`,
                        width: `${((project.phases?.handover || 2) / totalMonths) * 100}%`,
                        backgroundColor: PHASE_COLORS.handover,
                        opacity: 0.8,
                      }}
                    >
                      <span className="text-[9px] text-white font-medium px-1 truncate block leading-6">
                        تسليم
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Legend */}
            <div className="flex items-center gap-4 mt-4 pt-4 border-t justify-center text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: PHASE_COLORS.preDev }} />
                <span>ما قبل البناء</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: PHASE_COLORS.construction }} />
                <span>البناء</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: PHASE_COLORS.handover }} />
                <span>التسليم</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════
// Project Comparison Table
// ═══════════════════════════════════════════════════════════════

function ProjectComparison({ data }: { data: any }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ArrowUpDown className="h-4 w-4" />
          مقارنة المشاريع
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-right py-3 px-2 font-medium">المشروع</th>
                <th className="text-right py-3 px-2 font-medium">البداية</th>
                <th className="text-right py-3 px-2 font-medium">المدة</th>
                <th className="text-right py-3 px-2 font-medium">التكاليف</th>
                <th className="text-right py-3 px-2 font-medium">الإيرادات</th>
                <th className="text-right py-3 px-2 font-medium">تعرض المستثمر</th>
                <th className="text-right py-3 px-2 font-medium">ذروة التعرض</th>
                <th className="text-right py-3 px-2 font-medium">الربح</th>
                <th className="text-right py-3 px-2 font-medium">ROI</th>
              </tr>
            </thead>
            <tbody>
              {data.projects.map((p: any) => {
                const profit = p.totalSales - p.totalCost;
                const roi = p.developerExposure > 0 ? (profit / p.developerExposure) * 100 : 0;
                return (
                  <tr key={p.id} className="border-b hover:bg-muted/50">
                    <td className="py-3 px-2 font-medium">{p.name}</td>
                    <td className="py-3 px-2 text-muted-foreground">{p.startDate}</td>
                    <td className="py-3 px-2">
                      <Badge variant="outline" className="text-xs">
                        {p.totalMonths} شهر
                      </Badge>
                    </td>
                    <td className="py-3 px-2 text-red-600 font-medium">{formatAED(p.totalCost)}</td>
                    <td className="py-3 px-2 text-green-600 font-medium">{formatAED(p.totalSales)}</td>
                    <td className="py-3 px-2 text-amber-600 font-medium">{formatAED(p.developerExposure)}</td>
                    <td className="py-3 px-2 text-muted-foreground text-xs">{p.peakMonthLabel}</td>
                    <td className={`py-3 px-2 font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatAED(profit)}
                    </td>
                    <td className={`py-3 px-2 font-bold ${roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {roi.toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-muted/50 font-bold">
                <td className="py-3 px-2">المجموع</td>
                <td className="py-3 px-2" colSpan={2}></td>
                <td className="py-3 px-2 text-red-600">{formatAED(data.totalPortfolioCost)}</td>
                <td className="py-3 px-2 text-green-600">{formatAED(data.totalPortfolioSales)}</td>
                <td className="py-3 px-2 text-amber-600">{formatAED(data.totalDeveloperExposure)}</td>
                <td className="py-3 px-2"></td>
                <td className="py-3 px-2 text-green-600">{formatAED(data.totalPortfolioSales - data.totalPortfolioCost)}</td>
                <td className="py-3 px-2 text-green-600">
                  {data.totalDeveloperExposure > 0
                    ? (((data.totalPortfolioSales - data.totalPortfolioCost) / data.totalDeveloperExposure) * 100).toFixed(1)
                    : 0}%
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Monthly Developer Outflow per project - stacked view */}
        <Separator className="my-6" />
        <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
          <Wallet className="h-4 w-4" />
          التدفق الشهري للمستثمر حسب المشروع
        </h3>
        <div className="overflow-x-auto">
          <div style={{ minWidth: Math.max(600, data.monthLabels.length * 35) }}>
            {/* Stacked bar chart */}
            <div className="relative h-48">
              {(() => {
                const maxMonthly = Math.max(
                  ...data.monthLabels.map((_: any, i: number) =>
                    data.projects.reduce((sum: number, p: any) => sum + (p.monthlyDeveloperOutflow[i] || 0), 0)
                  ),
                  1
                );
                const barWidth = 100 / data.monthLabels.length;
                const projectColors = ['#ef4444', '#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899'];

                return (
                  <svg width="100%" height="100%" viewBox={`0 0 ${data.monthLabels.length * 35} 200`}>
                    {data.monthLabels.map((_: any, monthIdx: number) => {
                      let yOffset = 200;
                      return data.projects.map((p: any, pIdx: number) => {
                        const val = p.monthlyDeveloperOutflow[monthIdx] || 0;
                        const barH = (val / maxMonthly) * 180;
                        yOffset -= barH;
                        return (
                          <rect
                            key={`${p.id}-${monthIdx}`}
                            x={monthIdx * 35 + 5}
                            y={yOffset}
                            width={25}
                            height={barH}
                            fill={projectColors[pIdx % projectColors.length]}
                            opacity={0.8}
                          />
                        );
                      });
                    })}
                  </svg>
                );
              })()}
            </div>
            {/* Project legend */}
            <div className="flex items-center gap-4 mt-2 justify-center text-xs flex-wrap">
              {data.projects.map((p: any, i: number) => {
                const colors = ['#ef4444', '#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899'];
                return (
                  <div key={p.id} className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded" style={{ backgroundColor: colors[i % colors.length] }} />
                    <span>{p.name}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
