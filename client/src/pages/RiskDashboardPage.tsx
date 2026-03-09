import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Shield, AlertTriangle, TrendingUp, TrendingDown, Activity, Eye,
  BarChart3, Target, Zap, Building2, ChevronLeft, Loader2,
  ShieldAlert, ShieldCheck, ShieldX, Info
} from "lucide-react";
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts";

const RISK_COLORS = {
  low: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", fill: "#10b981", label: "منخفض" },
  medium: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", fill: "#f59e0b", label: "متوسط" },
  high: { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200", fill: "#f97316", label: "مرتفع" },
  critical: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200", fill: "#ef4444", label: "حرج" },
};

const RISK_CATEGORIES = [
  { key: "marketRisk", label: "مخاطر السوق", icon: TrendingDown, color: "#3b82f6" },
  { key: "financialRisk", label: "مخاطر مالية", icon: BarChart3, color: "#8b5cf6" },
  { key: "competitiveRisk", label: "مخاطر تنافسية", icon: Target, color: "#f59e0b" },
  { key: "regulatoryRisk", label: "مخاطر تنظيمية", icon: Shield, color: "#10b981" },
  { key: "executionRisk", label: "مخاطر تنفيذية", icon: Zap, color: "#ef4444" },
];

export default function RiskDashboardPage({ embedded = false }: { embedded?: boolean } = {}) {
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);

  const allRisksQuery = trpc.riskDashboard.getAllProjectRisks.useQuery();
  const alertsQuery = trpc.riskDashboard.getAlerts.useQuery();

  const summary = allRisksQuery.data?.summary;
  const projects = allRisksQuery.data?.projects || [];

  // Pie chart data
  const pieData = useMemo(() => {
    if (!summary) return [];
    return [
      { name: "منخفض", value: summary.riskDistribution.low, fill: RISK_COLORS.low.fill },
      { name: "متوسط", value: summary.riskDistribution.medium, fill: RISK_COLORS.medium.fill },
      { name: "مرتفع", value: summary.riskDistribution.high, fill: RISK_COLORS.high.fill },
      { name: "حرج", value: summary.riskDistribution.critical, fill: RISK_COLORS.critical.fill },
    ].filter(d => d.value > 0);
  }, [summary]);

  // Bar chart data for project comparison
  const barData = useMemo(() => {
    return projects
      .filter((p: any) => p.riskScore)
      .map((p: any) => ({
        name: p.name?.slice(0, 15) || `مشروع ${p.id}`,
        pmri: Number(p.riskScore?.pmriScore || 0),
        fill: RISK_COLORS[p.riskScore?.riskLevel as keyof typeof RISK_COLORS]?.fill || "#94a3b8",
      }))
      .sort((a: any, b: any) => b.pmri - a.pmri);
  }, [projects]);

  if (allRisksQuery.isLoading) {
    return (
      <div className={`${embedded ? '' : 'min-h-screen'} flex items-center justify-center`}>
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={`${embedded ? '' : 'min-h-screen'} bg-background`} dir="rtl">
      {/* Header */}
      {!embedded && <div className="border-b bg-card">
        <div className="container py-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-lg">
              <ShieldAlert className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">لوحة المخاطر التفاعلية</h1>
              <p className="text-sm text-muted-foreground">مؤشر PMRI (مؤشر مخاطر السوق العقاري) لجميع المشاريع</p>
            </div>
          </div>
        </div>
      </div>}

      <div className="container py-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 text-center">
              <Building2 className="w-6 h-6 mx-auto text-blue-500 mb-2" />
              <p className="text-2xl font-bold">{summary?.totalProjects ?? 0}</p>
              <p className="text-xs text-muted-foreground">إجمالي المشاريع</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 text-center">
              <Activity className="w-6 h-6 mx-auto text-purple-500 mb-2" />
              <p className="text-2xl font-bold">{summary?.assessedProjects ?? 0}</p>
              <p className="text-xs text-muted-foreground">تم تقييمها</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 text-center">
              <Target className="w-6 h-6 mx-auto text-amber-500 mb-2" />
              <p className="text-2xl font-bold">{summary?.avgPmri ?? "—"}</p>
              <p className="text-xs text-muted-foreground">متوسط PMRI</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-emerald-50/50">
            <CardContent className="p-4 text-center">
              <ShieldCheck className="w-6 h-6 mx-auto text-emerald-500 mb-2" />
              <p className="text-2xl font-bold text-emerald-700">
                {(summary?.riskDistribution.low ?? 0) + (summary?.riskDistribution.medium ?? 0)}
              </p>
              <p className="text-xs text-muted-foreground">آمنة / متوسطة</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-red-50/50">
            <CardContent className="p-4 text-center">
              <ShieldX className="w-6 h-6 mx-auto text-red-500 mb-2" />
              <p className="text-2xl font-bold text-red-700">
                {(summary?.riskDistribution.high ?? 0) + (summary?.riskDistribution.critical ?? 0)}
              </p>
              <p className="text-xs text-muted-foreground">مرتفعة / حرجة</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Risk Distribution Pie */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">توزيع مستويات المخاطر</CardTitle>
            </CardHeader>
            <CardContent>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={3}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <Shield className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p>لا توجد تقييمات مخاطر بعد</p>
                    <p className="text-xs mt-1">شغّل محرك جويل (المحرك 9) لتقييم المخاطر</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* PMRI Comparison Bar Chart */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">مقارنة PMRI بين المشاريع</CardTitle>
            </CardHeader>
            <CardContent>
              {barData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={barData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} />
                    <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value: any) => [`${value}`, "PMRI"]} />
                    <Bar dataKey="pmri" radius={[0, 4, 4, 0]}>
                      {barData.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <BarChart3 className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p>لا توجد بيانات للمقارنة</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Alerts */}
        {alertsQuery.data && alertsQuery.data.length > 0 && (
          <Card className="border-0 shadow-sm border-r-4 border-r-red-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2 text-red-600">
                <AlertTriangle className="w-4 h-4" />
                تنبيهات المخاطر
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {alertsQuery.data.map((alert: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-red-50/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${alert.riskLevel === 'critical' ? 'bg-red-500 animate-pulse' : 'bg-orange-500'}`} />
                      <div>
                        <p className="font-medium text-sm">{alert.projectName}</p>
                        <div className="flex gap-1 mt-0.5">
                          {alert.highRiskCategories.map((cat: string, j: number) => (
                            <Badge key={j} variant="outline" className="text-xs text-red-600 border-red-200">{cat}</Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="text-left">
                      <p className="text-lg font-bold text-red-600">{alert.pmriScore}</p>
                      <Badge className={`${RISK_COLORS[alert.riskLevel as keyof typeof RISK_COLORS]?.bg} ${RISK_COLORS[alert.riskLevel as keyof typeof RISK_COLORS]?.text} text-xs`}>
                        {RISK_COLORS[alert.riskLevel as keyof typeof RISK_COLORS]?.label}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Projects Grid */}
        <div>
          <h2 className="text-lg font-semibold mb-4">المشاريع</h2>
          {projects.length === 0 ? (
            <Card className="border-0 shadow-sm">
              <CardContent className="py-16 text-center">
                <Building2 className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-semibold mb-2">لا توجد مشاريع</h3>
                <p className="text-muted-foreground">أنشئ مشاريع وشغّل محرك جويل لتقييم المخاطر</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((project: any) => (
                <ProjectRiskCard
                  key={project.id}
                  project={project}
                  onView={() => setSelectedProjectId(project.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Project Detail Dialog */}
      {selectedProjectId && (
        <ProjectRiskDetail
          projectId={selectedProjectId}
          onClose={() => setSelectedProjectId(null)}
        />
      )}
    </div>
  );
}

function ProjectRiskCard({ project, onView }: { project: any; onView: () => void }) {
  const score = project.riskScore;
  const riskLevel = score?.riskLevel as keyof typeof RISK_COLORS;
  const colors = riskLevel ? RISK_COLORS[riskLevel] : null;

  return (
    <Card className={`border-0 shadow-sm hover:shadow-md transition-all cursor-pointer ${colors ? colors.border : ''}`} onClick={onView}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-semibold text-sm line-clamp-1">{project.name}</h3>
            {project.community && (
              <p className="text-xs text-muted-foreground mt-0.5">{project.community}</p>
            )}
          </div>
          {score ? (
            <div className={`px-3 py-1 rounded-full ${colors?.bg} ${colors?.text} text-xs font-bold`}>
              {colors?.label}
            </div>
          ) : (
            <Badge variant="outline" className="text-xs">غير مقيّم</Badge>
          )}
        </div>

        {score ? (
          <>
            {/* PMRI Gauge */}
            <div className="relative mb-3">
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(Number(score.pmriScore), 100)}%`,
                    backgroundColor: colors?.fill,
                  }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-xs text-muted-foreground">0</span>
                <span className={`text-sm font-bold ${colors?.text}`}>{Number(score.pmriScore).toFixed(1)}</span>
                <span className="text-xs text-muted-foreground">100</span>
              </div>
            </div>

            {/* Risk Categories Mini */}
            <div className="grid grid-cols-5 gap-1">
              {RISK_CATEGORIES.map(cat => {
                const val = Number(score[cat.key] || 0);
                return (
                  <div key={cat.key} className="text-center">
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden mb-0.5">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${val}%`, backgroundColor: cat.color }}
                      />
                    </div>
                    <p className="text-[9px] text-muted-foreground leading-tight">{cat.label.split(" ")[1]}</p>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="py-4 text-center text-muted-foreground text-sm">
            <Shield className="w-8 h-8 mx-auto mb-2 opacity-30" />
            شغّل المحرك 9 لتقييم المخاطر
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ProjectRiskDetail({ projectId, onClose }: { projectId: number; onClose: () => void }) {
  const detailQuery = trpc.riskDashboard.getProjectRisk.useQuery({ projectId });
  const data = detailQuery.data;

  if (detailQuery.isLoading) {
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-3xl" dir="rtl">
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const score = data?.latestScore;
  const riskLevel = score?.riskLevel as keyof typeof RISK_COLORS;
  const colors = riskLevel ? RISK_COLORS[riskLevel] : null;

  // Radar chart data
  const radarData = RISK_CATEGORIES.map(cat => ({
    category: cat.label,
    value: Number(score?.[cat.key as keyof typeof score] || 0),
    fullMark: 100,
  }));

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5" />
            تقييم مخاطر: {data?.project?.name}
          </DialogTitle>
        </DialogHeader>

        {!score ? (
          <div className="py-16 text-center text-muted-foreground">
            <Shield className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <h3 className="text-lg font-semibold mb-2">لم يتم تقييم المخاطر بعد</h3>
            <p>شغّل محرك جويل (المحرك 9 - تقييم المخاطر) لهذا المشروع</p>
          </div>
        ) : (
          <div className="space-y-6 mt-4">
            {/* PMRI Score Header */}
            <div className={`p-6 rounded-xl ${colors?.bg} border ${colors?.border}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">مؤشر PMRI</p>
                  <p className={`text-4xl font-bold ${colors?.text}`}>{Number(score.pmriScore).toFixed(1)}</p>
                  <Badge className={`mt-2 ${colors?.bg} ${colors?.text}`}>{colors?.label}</Badge>
                </div>
                <div className="w-32 h-32">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { value: Number(score.pmriScore), fill: colors?.fill },
                          { value: 100 - Number(score.pmriScore), fill: "#e5e7eb" },
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={35}
                        outerRadius={55}
                        startAngle={90}
                        endAngle={-270}
                        dataKey="value"
                      >
                        <Cell fill={colors?.fill || "#94a3b8"} />
                        <Cell fill="#e5e7eb" />
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
              {score.confidenceLevel && (
                <p className="text-xs text-muted-foreground mt-2">مستوى الثقة: {Number(score.confidenceLevel)}%</p>
              )}
            </div>

            {/* Radar Chart */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">تحليل فئات المخاطر</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart data={radarData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="category" tick={{ fontSize: 11 }} />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10 }} />
                    <Radar
                      name="المخاطر"
                      dataKey="value"
                      stroke={colors?.fill || "#94a3b8"}
                      fill={colors?.fill || "#94a3b8"}
                      fillOpacity={0.3}
                      strokeWidth={2}
                    />
                    <Tooltip />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Risk Categories Detail */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {RISK_CATEGORIES.map(cat => {
                const val = Number(score[cat.key as keyof typeof score] || 0);
                const details = score[`${cat.key}Details` as keyof typeof score] as string;
                const CatIcon = cat.icon;
                const level = val < 25 ? "low" : val < 50 ? "medium" : val < 75 ? "high" : "critical";
                const catColors = RISK_COLORS[level];

                return (
                  <Card key={cat.key} className={`border-0 shadow-sm border-r-4`} style={{ borderRightColor: cat.color }}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <CatIcon className="w-4 h-4" style={{ color: cat.color }} />
                          <span className="font-medium text-sm">{cat.label}</span>
                        </div>
                        <Badge className={`${catColors.bg} ${catColors.text} text-xs`}>
                          {val.toFixed(0)}%
                        </Badge>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${val}%`, backgroundColor: cat.color }}
                        />
                      </div>
                      {details && (
                        <p className="text-xs text-muted-foreground line-clamp-3">{details}</p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Mitigation Strategies */}
            {score.mitigationStrategies && (
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    استراتيجيات التخفيف
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{score.mitigationStrategies}</p>
                </CardContent>
              </Card>
            )}

            {/* History */}
            {data.history && data.history.length > 1 && (
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">سجل التقييمات</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {data.history.map((h: any, i: number) => {
                      const hColors = RISK_COLORS[h.riskLevel as keyof typeof RISK_COLORS];
                      return (
                        <div key={h.id} className="flex items-center justify-between p-2 rounded-lg bg-accent/30">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{h.analysisDate || "—"}</span>
                            {i === 0 && <Badge variant="outline" className="text-xs">الأحدث</Badge>}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm">{Number(h.pmriScore).toFixed(1)}</span>
                            <Badge className={`${hColors?.bg} ${hColors?.text} text-xs`}>{hColors?.label}</Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Notes */}
            {score.notes && (
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Info className="w-4 h-4" />
                    ملاحظات
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{score.notes}</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
