import { useProjectContext } from "@/contexts/ProjectContext";
import { useState, useMemo, useCallback, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Building2, Save, Plus, Trash2, Calculator, DollarSign, BarChart3,
  FileText, MapPin, Ruler, TrendingUp, PieChart, Loader2,
  Sparkles, Copy, Brain, Globe, FolderOpen, ShieldCheck, Users,
  Landmark, Percent, ChevronDown, BookOpen, Scale, AlertTriangle,
  BarChart2, Target, Briefcase, Layers, CheckCircle2, ArrowDownCircle,
  SquareStack, LandPlot, Warehouse, ShoppingBag, Clock, Calendar, Hammer, Info, Printer, Download,
} from "lucide-react";
import { useLocation } from "wouter";
import CostsCashFlowTab from "@/components/feasibility/CostsCashFlowTab";
import CashFlowSettingsPage from "@/pages/CashFlowSettingsPage";
import CapitalScheduleTablePage from "@/pages/CapitalScheduleTablePage";
import { calculateProjectCosts } from "@/lib/projectCostsCalc";
import { exportFeasibilityReport, type FeasibilityReportData } from "@/lib/feasibilityReportExport";

// ═══════════════════════════════════════════
// FORMATTING HELPERS
// ═══════════════════════════════════════════

function fmt(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "0";
  if (Math.abs(n) >= 1_000_000) {
    return (n / 1_000_000).toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "M";
  }
  if (Math.abs(n) >= 1_000) {
    return (n / 1_000).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + "K";
  }
  return Math.round(n).toLocaleString("en-US");
}

function fmtFull(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "0";
  return Math.round(n).toLocaleString("en-US");
}

function fmtPct(n: number): string {
  if (isNaN(n)) return "0%";
  return `${n.toFixed(1)}%`;
}

function parseNum(val: string): number | null {
  const n = parseFloat(val.replace(/,/g, ""));
  return isNaN(n) ? null : n;
}

// ═══════════════════════════════════════════
// KPI CARD COMPONENT
// ═══════════════════════════════════════════

function KpiCard({ label, value, sub, color, icon }: {
  label: string; value: string; sub?: string; color: string; icon?: React.ReactNode;
}) {
  const colorMap: Record<string, string> = {
    rose: "bg-rose-50 border-rose-200 text-rose-700",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-700",
    blue: "bg-blue-50 border-blue-200 text-blue-700",
    red: "bg-red-50 border-red-200 text-red-700",
    amber: "bg-amber-50 border-amber-200 text-amber-700",
    violet: "bg-violet-50 border-violet-200 text-violet-700",
    gray: "bg-gray-50 border-gray-200 text-gray-700",
    indigo: "bg-indigo-50 border-indigo-200 text-indigo-700",
    teal: "bg-teal-50 border-teal-200 text-teal-700",
  };
  return (
    <div className={`rounded-2xl border p-4 ${colorMap[color] || colorMap.gray}`}>
      <div className="flex items-center gap-2 mb-2 opacity-70">{icon}<span className="text-xs font-medium">{label}</span></div>
      <div className="text-xl font-bold font-mono" dir="ltr">{value}</div>
      {sub && <div className="text-[11px] mt-1 opacity-60">{sub}</div>}
    </div>
  );
}

// ═══════════════════════════════════════════
// HELPER COMPONENTS
// ═══════════════════════════════════════════

function NumInput({
  label, value, onChange, suffix, hint, disabled,
}: {
  label: string; value: number | null | undefined;
  onChange: (v: number | null) => void; suffix?: string;
  hint?: string; disabled?: boolean;
}) {
  const [localVal, setLocalVal] = useState<string>("");
  const [focused, setFocused] = useState(false);
  const displayVal = focused ? localVal : (value != null ? fmtFull(value) : "");
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="relative">
        <Input
          type="text" value={displayVal}
          onFocus={() => { setFocused(true); setLocalVal(value != null ? String(value) : ""); }}
          onBlur={() => { setFocused(false); onChange(parseNum(localVal)); }}
          onChange={(e) => setLocalVal(e.target.value)}
          className={`text-sm h-9 text-right ${suffix ? "pl-12" : ""} ${disabled ? "bg-muted/50" : ""}`}
          placeholder="0" disabled={disabled} dir="ltr"
        />
        {suffix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{suffix}</span>}
      </div>
      {hint && <p className="text-[10px] text-muted-foreground/70">{hint}</p>}
    </div>
  );
}

function ReadOnlyValue({ label, value, suffix, highlight, large }: {
  label: string; value: number | null | undefined; suffix?: string; highlight?: boolean; large?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between py-2 ${large ? "py-3" : ""}`}>
      <span className={`text-sm ${highlight ? "font-bold text-foreground" : "text-muted-foreground"}`}>{label}</span>
      <span className={`font-mono ${large ? "text-lg font-bold" : "text-sm font-semibold"} ${highlight ? ((value ?? 0) >= 0 ? "text-emerald-600" : "text-red-600") : "text-foreground"}`} dir="ltr">
        {fmtFull(value)} {suffix || "AED"}
      </span>
    </div>
  );
}

function SectionHeader({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3 mb-4 pb-3 border-b border-border">
      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center"><Icon className="w-4.5 h-4.5 text-primary" /></div>
      <div>
        <h3 className="font-bold text-foreground">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}



// ═══════════════════════════════════════════
// INVESTED CAPITAL CALCULATION HELPER
// ═══════════════════════════════════════════

function calcInvestedCapital(costs: any): number {
  if (!costs) return 0;
  // What the investor actually pays out of pocket before off-plan sales cover construction:
  // Land + all pre-construction fees + 30% construction advance (10% advance + 20% deposit)
  return costs.landPrice + costs.agentCommissionLand + costs.landRegistration +
    costs.soilTestFee + costs.topographicSurveyFee + costs.officialBodiesFees +
    costs.designFee + costs.separationFee + costs.reraProjectRegFee + costs.reraUnitRegFee +
    costs.developerNocFee + costs.escrowAccountFee + costs.bankFees + costs.surveyorFees +
    costs.communityFees + (costs.constructionCost * 0.30);
}

// ═══════════════════════════════════════════
// ALL-PROJECTS COMPARISON TABLE
// ═══════════════════════════════════════════

function AllProjectsComparison({ projects, onSelectProject }: {
  projects: any[];
  onSelectProject: (id: number) => void;
}) {
  // Load market overview and competition pricing for all projects
  const allMoQueries = projects.map(p =>
    trpc.marketOverview.getByProject.useQuery(p.id, { enabled: true })
  );
  const allCpQueries = projects.map(p =>
    trpc.competitionPricing.getByProject.useQuery(p.id, { enabled: true })
  );
  // Load scenarios to get each project's active scenario
  const scenariosQuery = trpc.cashFlowProgram.getProjectScenarios.useQuery(undefined, { staleTime: 5000 });
  // Load cashFlowSettings for each project (source of truth for costs)
  const allSettingsQueries = projects.map(p => {
    const dbScenario = (scenariosQuery.data as any)?.[p.id] || "offplan_escrow";
    return trpc.cashFlowSettings.getSettings.useQuery(
      { projectId: p.id, scenario: dbScenario },
      { enabled: !!scenariosQuery.data, staleTime: 5000 }
    );
  });

  const projectData = useMemo(() => {
    return projects.map((p, i) => {
      const mo = allMoQueries[i]?.data;
      const cp = allCpQueries[i]?.data;
      const settingsData = allSettingsQueries[i]?.data;
      const costs = calculateProjectCosts(p, mo, cp);
      if (!costs) return { project: p, totalCosts: 0, totalRevenue: 0, profit: 0, margin: 0, roi: 0, investedCapital: 0, roiOnCapital: 0 };

      // Use grandTotal from cashFlowSettings (same source as Capital Schedule Table)
      // Fall back to calculateProjectCosts if settings not loaded yet
      let totalCosts = costs.totalCosts || 0;
      let investorTotal = 0;
      if (settingsData?.settings) {
        // Exclude revenue items — they are income, not costs
        const items = settingsData.settings.filter((s: any) => s.isActive !== 0 && s.isActive !== false && s.section !== "revenue" && s.category !== "revenue");
        const paidT = items.filter((s: any) => s.section === "paid").reduce((sum: number, s: any) => sum + (s.computedAmount || 0), 0);
        const investorT = items.filter((s: any) => s.fundingSource === "investor" && s.section !== "paid").reduce((sum: number, s: any) => sum + (s.computedAmount || 0), 0);
        const escrowT = items.filter((s: any) => s.fundingSource === "escrow").reduce((sum: number, s: any) => sum + (s.computedAmount || 0), 0);
        totalCosts = paidT + investorT + escrowT;
        investorTotal = paidT + investorT;
      }

      // Revenue always from pricing page calculation (dynamic, based on current prices × areas)
      const totalRevenue = costs.totalRevenue || 0;
      const profit = totalRevenue - totalCosts;
      const margin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;
      const roi = totalCosts > 0 ? (profit / totalCosts) * 100 : 0;
      // Use investorTotal from settings as invested capital (what investor actually pays)
      const investedCapital = investorTotal > 0 ? investorTotal : calcInvestedCapital(costs);
      const roiOnCapital = investedCapital > 0 ? (profit / investedCapital) * 100 : 0;

      return { project: p, totalCosts, totalRevenue, profit, margin, roi, investedCapital, roiOnCapital };
    });
  }, [projects, allMoQueries.map(q => q.data), allCpQueries.map(q => q.data), allSettingsQueries.map(q => q.data), scenariosQuery.data]);

  const totals = useMemo(() => {
    return projectData.reduce((acc, d) => ({
      totalCosts: acc.totalCosts + d.totalCosts,
      totalRevenue: acc.totalRevenue + d.totalRevenue,
      profit: acc.profit + d.profit,
      investedCapital: acc.investedCapital + d.investedCapital,
    }), { totalCosts: 0, totalRevenue: 0, profit: 0, investedCapital: 0 });
  }, [projectData]);

  const portfolioMargin = totals.totalRevenue > 0 ? (totals.profit / totals.totalRevenue) * 100 : 0;
  const portfolioRoiOnCapital = totals.investedCapital > 0 ? (totals.profit / totals.investedCapital) * 100 : 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-l from-gray-50 to-white">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center">
            <Layers className="w-4.5 h-4.5 text-indigo-600" />
          </div>
          <div>
            <h3 className="font-bold text-gray-800 text-sm">ملخص المحفظة — جميع المشاريع</h3>
            <p className="text-[11px] text-gray-500 mt-0.5">نظرة شاملة على الأداء المالي — الربح مقابل رأس المال المستثمر</p>
          </div>
        </div>
      </div>

      {/* Portfolio KPI Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 border-b border-gray-100 bg-gray-50/50">
        <div className="text-center">
          <p className="text-[10px] text-gray-500 mb-0.5">إجمالي التكاليف</p>
          <p className="text-sm font-bold font-mono text-rose-700" dir="ltr">{fmt(totals.totalCosts)}</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-gray-500 mb-0.5">إجمالي الإيرادات</p>
          <p className="text-sm font-bold font-mono text-emerald-700" dir="ltr">{fmt(totals.totalRevenue)}</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-gray-500 mb-0.5">صافي الربح الكلي</p>
          <p className={`text-sm font-bold font-mono ${totals.profit >= 0 ? 'text-blue-700' : 'text-red-700'}`} dir="ltr">{fmt(totals.profit)}</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-gray-500 mb-0.5">العائد على رأس المال المستثمر</p>
          <p className={`text-sm font-bold font-mono ${portfolioRoiOnCapital >= 0 ? 'text-violet-700' : 'text-red-700'}`}>{fmtPct(portfolioRoiOnCapital)}</p>
        </div>
      </div>

      {/* Comparison Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-right py-3 px-3 font-bold text-gray-600">المشروع</th>
              <th className="text-right py-3 px-2 font-bold text-gray-600">التكاليف</th>
              <th className="text-right py-3 px-2 font-bold text-gray-600">الإيرادات</th>
              <th className="text-right py-3 px-2 font-bold text-gray-600">الربح</th>
              <th className="text-right py-3 px-2 font-bold text-gray-600">الهامش</th>
              <th className="text-right py-3 px-2 font-bold text-gray-600">رأس المال المستثمر</th>
              <th className="text-right py-3 px-2 font-bold text-gray-600">ROI على رأس المال</th>
            </tr>
          </thead>
          <tbody>
            {projectData.map((d, i) => (
              <tr
                key={d.project.id}
                className={`border-b border-gray-100 hover:bg-blue-50/50 cursor-pointer transition-colors ${d.profit < 0 ? 'bg-red-50/30' : ''}`}
                onClick={() => onSelectProject(d.project.id)}
              >
                <td className="py-3 px-3 font-bold text-gray-800">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-bold shrink-0">{i + 1}</span>
                    <span className="truncate max-w-[160px]">{d.project.name}</span>
                  </div>

                  {d.profit < 0 && <span className="text-[9px] text-red-600 mr-7 block mt-0.5">⚠️ خسارة</span>}
                </td>
                <td className="py-3 px-2 font-mono text-rose-700 font-semibold" dir="ltr">{fmt(d.totalCosts)}</td>
                <td className="py-3 px-2 font-mono text-emerald-700 font-semibold" dir="ltr">{fmt(d.totalRevenue)}</td>
                <td className={`py-3 px-2 font-mono font-bold ${d.profit >= 0 ? 'text-blue-700' : 'text-red-700'}`} dir="ltr">{fmt(d.profit)}</td>
                <td className={`py-3 px-2 font-mono font-semibold ${d.margin >= 0 ? 'text-gray-700' : 'text-red-700'}`}>{fmtPct(d.margin)}</td>
                <td className="py-3 px-2 font-mono text-amber-700 font-semibold" dir="ltr">{fmt(d.investedCapital)}</td>
                <td className={`py-3 px-2 font-mono font-bold ${d.roiOnCapital >= 0 ? 'text-violet-700' : 'text-red-700'}`}>{fmtPct(d.roiOnCapital)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-100 font-bold">
              <td className="py-3 px-3 text-gray-800">المجموع / المتوسط</td>
              <td className="py-3 px-2 font-mono text-rose-700" dir="ltr">{fmt(totals.totalCosts)}</td>
              <td className="py-3 px-2 font-mono text-emerald-700" dir="ltr">{fmt(totals.totalRevenue)}</td>
              <td className={`py-3 px-2 font-mono ${totals.profit >= 0 ? 'text-blue-700' : 'text-red-700'}`} dir="ltr">{fmt(totals.profit)}</td>
              <td className={`py-3 px-2 font-mono ${portfolioMargin >= 0 ? 'text-gray-700' : 'text-red-700'}`}>{fmtPct(portfolioMargin)}</td>
              <td className="py-3 px-2 font-mono text-amber-700" dir="ltr">{fmt(totals.investedCapital)}</td>
              <td className={`py-3 px-2 font-mono ${portfolioRoiOnCapital >= 0 ? 'text-violet-700' : 'text-red-700'}`}>{fmtPct(portfolioRoiOnCapital)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Footnote */}
      <div className="px-5 py-2 border-t border-gray-100 bg-gray-50/30">
        <p className="text-[10px] text-gray-400">* رأس المال المستثمر = الأرض + جميع المصاريف ما قبل الإنشاء + 30% دفعة مقدمة للمقاول | العائد = صافي الربح ÷ رأس المال المستثمر</p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════

export default function FeasibilityStudyPage({ embedded, initialProjectId }: { embedded?: boolean; initialProjectId?: number | null } = {}) {
  const { user, loading, isAuthenticated, isReadOnly } = useAuth();
  const [, navigate] = useLocation();
  const { selectedProjectId: ctxProjectId, setSelectedProjectId } = useProjectContext();
  const selectedProjectId = initialProjectId ?? ctxProjectId;
  const [selectedStudyId, setSelectedStudyId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState("tab5");
  const [form, setForm] = useState<Record<string, any>>({});
  const [isDirty, setIsDirty] = useState(false);
  const [autoCreating, setAutoCreating] = useState(false);

  // Projects query
  const projectsQuery = trpc.projects.list.useQuery(undefined, { enabled: isAuthenticated });

  // Studies query - get studies for selected project
  const studiesByProjectQuery = trpc.feasibility.listByProject.useQuery(selectedProjectId || 0, { enabled: !!selectedProjectId });
  const studyQuery = trpc.feasibility.getById.useQuery(selectedStudyId || 0, { enabled: !!selectedStudyId });
  const syncStatusQuery = trpc.costsCashFlow.getSyncStatus.useQuery(selectedProjectId || 0, {
    enabled: !!selectedProjectId,
    refetchInterval: 60000,
  });

  // Queries for real revenue/costs calculation (same source as FinancialFeasibilityTab)
  const selectedProject = (projectsQuery.data || []).find((p: any) => p.id === selectedProjectId);
  const moQuery = trpc.marketOverview.getByProject.useQuery(selectedProjectId || 0, { enabled: !!selectedProjectId });
  const cpQuery = trpc.competitionPricing.getByProject.useQuery(selectedProjectId || 0, { enabled: !!selectedProjectId });

  // Load scenario + cashFlowSettings for the selected project (source of truth for costs)
  const singleScenarioQuery = trpc.cashFlowProgram.getProjectScenarios.useQuery(undefined, { enabled: isAuthenticated, staleTime: 5000 });
  const activeScenario = useMemo(() => {
    if (!selectedProjectId || !singleScenarioQuery.data) return "offplan_escrow";
    return (singleScenarioQuery.data as any)[selectedProjectId] || "offplan_escrow";
  }, [selectedProjectId, singleScenarioQuery.data]);
  const singleSettingsQuery = trpc.cashFlowSettings.getSettings.useQuery(
    { projectId: selectedProjectId || 0, scenario: activeScenario as any },
    { enabled: !!selectedProjectId && !!singleScenarioQuery.data, staleTime: 5000 }
  );

  // Real costs/revenue from dynamic data (Market Overview + Competition Pricing)
  const realCosts = useMemo(() => {
    if (!selectedProject) return null;
    return calculateProjectCosts(selectedProject, moQuery.data, cpQuery.data);
  }, [selectedProject, moQuery.data, cpQuery.data]);

  // Auto-load or auto-create study when project is selected
  useEffect(() => {
    if (!selectedProjectId || studiesByProjectQuery.isLoading) return;
    const studies = studiesByProjectQuery.data || [];
    if (studies.length > 0) {
      setSelectedStudyId(studies[0].id);
      setAutoCreating(false);
    } else if (!autoCreating) {
      const project = (projectsQuery.data || []).find((p: any) => p.id === selectedProjectId);
      if (project) {
        setAutoCreating(true);
        createMutation.mutate({
          projectName: project.name,
          projectId: selectedProjectId,
          separationFeePerM2: project.separationFeePerSqft ? parseFloat(project.separationFeePerSqft) : 40,
          landPrice: project.landPrice ? parseFloat(project.landPrice) : null,
          agentCommissionLandPct: project.agentCommissionLandPct ? parseFloat(project.agentCommissionLandPct) : null,
          estimatedBua: project.manualBuaSqft ? parseFloat(project.manualBuaSqft) : null,
          constructionCostPerSqft: project.estimatedConstructionPricePerSqft ? parseFloat(project.estimatedConstructionPricePerSqft) : null,
        });
      }
    }
  }, [selectedProjectId, studiesByProjectQuery.data, studiesByProjectQuery.isLoading]);

  // Mutations
  const createMutation = trpc.feasibility.create.useMutation({
    onSuccess: (data) => { studiesByProjectQuery.refetch(); setSelectedStudyId(data.id); setAutoCreating(false); toast.success("تم إنشاء الدراسة بنجاح"); },
    onError: () => { setAutoCreating(false); toast.error("خطأ في إنشاء الدراسة"); },
  });
  const updateMutation = trpc.feasibility.update.useMutation({
    onSuccess: () => { studiesByProjectQuery.refetch(); studyQuery.refetch(); setIsDirty(false); toast.success("تم حفظ التغييرات"); },
    onError: () => toast.error("خطأ في الحفظ"),
  });
  const deleteMutation = trpc.feasibility.delete.useMutation({
    onSuccess: () => { studiesByProjectQuery.refetch(); setSelectedStudyId(null); setForm({}); toast.success("تم حذف الدراسة"); },
  });

  // Load study data into form
  const loadedStudyId = studyQuery.data?.id;
  useMemo(() => {
    if (studyQuery.data && studyQuery.data.id === selectedStudyId) {
      setForm({ ...studyQuery.data });
      setIsDirty(false);
    }
  }, [loadedStudyId, selectedStudyId]);

  // Update form field
  const setField = useCallback((key: string, value: any) => {
    setForm((prev: Record<string, any>) => ({ ...prev, [key]: value }));
    setIsDirty(true);
  }, []);

  // ═══════════════════════════════════════════
  // COMPUTED VALUES
  // ═══════════════════════════════════════════
  const computed = useMemo(() => {
    const f = form;
    const gfaRes = f.gfaResidential || 0;
    const gfaRet = f.gfaRetail || 0;
    const gfaOff = f.gfaOffices || 0;
    const totalGfa = gfaRes + gfaRet + gfaOff;

    const saleableRes = gfaRes * ((f.saleableResidentialPct || 95) / 100);
    const saleableRet = gfaRet * ((f.saleableRetailPct || 97) / 100);
    const saleableOff = gfaOff * ((f.saleableOfficesPct || 95) / 100);
    const totalSaleable = saleableRes + saleableRet + saleableOff;

    const bua = f.estimatedBua || 0;
    const constructionCost = bua * (f.constructionCostPerSqft || 0);
    const landRegistration = (f.landPrice || 0) * 0.04;
    const agentCommissionLand = (f.landPrice || 0) * ((f.agentCommissionLandPct || 1) / 100);
    const designFee = constructionCost * ((f.designFeePct || 2) / 100);
    const supervisionFee = constructionCost * ((f.supervisionFeePct || 2) / 100);
    const separationFee = totalGfa * (f.separationFeePerM2 || 40);
    const contingencies = constructionCost * ((f.contingenciesPct || 2) / 100);
    const reraUnitTotal = (f.numberOfUnits || 0) * (f.reraUnitFee || 850);

    const revenueRes = saleableRes * (f.residentialSalePrice || 0);
    const revenueRet = saleableRet * (f.retailSalePrice || 0);
    const revenueOff = saleableOff * (f.officesSalePrice || 0);
    const totalRevenue = revenueRes + revenueRet + revenueOff;

    const developerFee = totalRevenue * ((f.developerFeePct || 5) / 100);
    const agentCommissionSale = totalRevenue * ((f.agentCommissionSalePct || 5) / 100);
    const marketing = totalRevenue * ((f.marketingPct || 2) / 100);

    const totalCosts =
      (f.landPrice || 0) + agentCommissionLand + landRegistration +
      (f.soilInvestigation || 0) + (f.topographySurvey || 0) +
      designFee + supervisionFee + (f.authoritiesFee || 0) + separationFee +
      constructionCost + (f.communityFee || 0) + contingencies +
      developerFee + agentCommissionSale + marketing +
      (f.reraOffplanFee || 150000) + reraUnitTotal +
      (f.nocFee || 10000) + (f.escrowFee || 140000) +
      (f.bankCharges || 20000) + (f.surveyorFees || 12000) +
      (f.reraAuditFees || 18000) + (f.reraInspectionFees || 70000);

    const profit = totalRevenue - totalCosts;
    const offplanCoverage = constructionCost * 0.65;
    const fundingRequired = totalCosts - offplanCoverage;
    const comoProfit = profit * ((f.comoProfitSharePct || 15) / 100);
    const investorProfit = profit - comoProfit;
    const roi = fundingRequired > 0 ? (investorProfit / fundingRequired) * 100 : 0;
    const profitMargin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

    return {
      totalGfa, saleableRes, saleableRet, saleableOff, totalSaleable,
      constructionCost, landRegistration, agentCommissionLand,
      designFee, supervisionFee, separationFee, contingencies, reraUnitTotal,
      revenueRes, revenueRet, revenueOff, totalRevenue,
      developerFee, agentCommissionSale, marketing,
      totalCosts, profit, offplanCoverage, fundingRequired,
      comoProfit, investorProfit, roi, profitMargin,
    };
  }, [form]);

  // Save handler
  const handleSave = () => {
    if (!selectedStudyId) return;
    const { id, createdAt, updatedAt, userId, ...data } = form;
    updateMutation.mutate({ id: selectedStudyId, ...data });
  };

  // Auth check
  if (loading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!isAuthenticated) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <p className="text-muted-foreground">يرجى تسجيل الدخول</p>
      <Button onClick={() => window.location.href = getLoginUrl()}>تسجيل الدخول</Button>
    </div>
  );

  return (
    <div className={embedded ? "bg-background" : "min-h-screen bg-gradient-to-b from-muted/30 to-background"} dir="rtl">
      <div className="container max-w-7xl py-6 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            {!embedded && <h1 className="text-2xl font-bold text-foreground">📊 دراسة الجدوى</h1>}
            {!embedded && <p className="text-sm text-muted-foreground">تحليل شامل لجدوى المشاريع العقارية</p>}
          </div>
          <div className="flex items-center gap-2">
            {isDirty && selectedStudyId && (
              <Button onClick={handleSave} disabled={updateMutation.isPending} className="gap-2">
                {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                حفظ التغييرات
              </Button>
            )}
            {selectedStudyId && !isReadOnly && (
              <Button variant="outline" size="icon" className="h-9 w-9 text-destructive hover:bg-destructive/10"
                onClick={() => { if (confirm("هل أنت متأكد من حذف هذه الدراسة؟")) deleteMutation.mutate(selectedStudyId); }}>
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Project Selector - only show when NOT embedded from hub */}
        {!initialProjectId && (
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
                      setSelectedStudyId(null);
                      setForm({});
                      setActiveTab("tab5");
                    }}
                  >
                    <option value="">— اختر مشروع —</option>
                    {(projectsQuery.data || []).map((p: any) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                {autoCreating && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    جاري إنشاء الدراسة...
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ═══ ALL PROJECTS COMPARISON — shown when no project is selected ═══ */}
        {!selectedProjectId && projectsQuery.data && projectsQuery.data.length > 0 && (
          <AllProjectsComparison
            projects={projectsQuery.data}
            onSelectProject={(id) => {
              setSelectedProjectId(id);
              setSelectedStudyId(null);
              setForm({});
              setActiveTab("tab5");
            }}
          />
        )}

        {/* Main Content */}
        {!selectedProjectId ? (
          <div className="text-center py-10">
            <Building2 className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
            <h2 className="text-lg font-bold text-muted-foreground mb-1">اختر مشروع لبدء دراسة الجدوى</h2>
            <p className="text-xs text-muted-foreground/70">أو اطّلع على ملخص المحفظة أعلاه</p>
          </div>
        ) : !selectedStudyId ? (
          <div className="text-center py-20"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /><p className="mt-3 text-sm text-muted-foreground">جاري تحميل الدراسة...</p></div>
        ) : studyQuery.isLoading ? (
          <div className="text-center py-20"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></div>
        ) : (
          <>
            {/* ═══ INVESTOR-GRADE FINANCIAL SUMMARY ═══ */}
            {(() => {
              if (!realCosts) return null;
              // Use cashFlowSettings as source of truth for costs (same as Capital Schedule Table)
              let totalCostsVal = realCosts.totalCosts || 0;
              let investedCapital = calcInvestedCapital(realCosts);
              if (singleSettingsQuery.data?.settings) {
                // Exclude revenue items — they are income, not costs
                const items = singleSettingsQuery.data.settings.filter((s: any) => s.isActive !== 0 && s.isActive !== false && s.section !== "revenue" && s.category !== "revenue");
                const paidT = items.filter((s: any) => s.section === "paid").reduce((sum: number, s: any) => sum + (s.computedAmount || 0), 0);
                const investorT = items.filter((s: any) => s.fundingSource === "investor" && s.section !== "paid").reduce((sum: number, s: any) => sum + (s.computedAmount || 0), 0);
                const escrowT = items.filter((s: any) => s.fundingSource === "escrow").reduce((sum: number, s: any) => sum + (s.computedAmount || 0), 0);
                totalCostsVal = paidT + investorT + escrowT;
                investedCapital = paidT + investorT;
              }
              // Revenue always from pricing page calculation (dynamic, based on current prices × areas)
              const totalRevenueVal = realCosts.totalRevenue || 0;
              const profitVal = totalRevenueVal - totalCostsVal;
              const marginVal = totalRevenueVal > 0 ? (profitVal / totalRevenueVal) * 100 : 0;

              // Investor's actual capital outlay (from settings = paid + investor items)
              const roiOnCapital = investedCapital > 0 ? (profitVal / investedCapital) * 100 : 0;

              // 3-scenario comparison — uses same totalCostsVal from cashFlowSettings
              // Only revenue changes per scenario (±10%), costs stay the same
              const scenarioCalc = (sc: "optimistic" | "base" | "conservative") => {
                const factor = sc === "optimistic" ? 1.1 : sc === "conservative" ? 0.9 : 1.0;
                const rev = totalRevenueVal * factor;
                const p = rev - totalCostsVal;
                return { revenue: rev, profit: p, margin: rev > 0 ? (p / rev) * 100 : 0 };
              };
              const opt = scenarioCalc("optimistic");
              const base = scenarioCalc("base");
              const cons = scenarioCalc("conservative");

              // Additional computed values for the redesign
              const profitOnCost = totalCostsVal > 0 ? (profitVal / totalCostsVal) * 100 : 0;
              const paidT = singleSettingsQuery.data?.settings
                ? singleSettingsQuery.data.settings.filter((s: any) => s.isActive !== 0 && s.isActive !== false && s.section === "paid").reduce((sum: number, s: any) => sum + (s.computedAmount || 0), 0)
                : 0;
              const unpaidInvestor = investedCapital - paidT;

              // Area data from project
              const plotAreaSqft = parseFloat(selectedProject?.plotAreaSqft || "0");
              const plotAreaSqm = parseFloat(selectedProject?.plotAreaSqm || "0");
              const buaSqft = parseFloat(selectedProject?.manualBuaSqft || "0");
              const gfaTotalSqft = parseFloat(selectedProject?.gfaSqft || "0");
              const gfaResSqft = parseFloat(selectedProject?.gfaResidentialSqft || "0");
              const gfaRetSqft = parseFloat(selectedProject?.gfaRetailSqft || "0");
              const gfaOffSqft = parseFloat(selectedProject?.gfaOfficesSqft || "0");
              const resPct = parseFloat(selectedProject?.saleableResidentialPct ?? "95") / 100;
              const retPct = parseFloat(selectedProject?.saleableRetailPct ?? "97") / 100;
              const offPct = parseFloat(selectedProject?.saleableOfficesPct ?? "95") / 100;
              const sellableRes = gfaResSqft * resPct;
              const sellableRet = gfaRetSqft * retPct;
              const sellableOff = gfaOffSqft * offPct;
              const totalSellable = sellableRes + sellableRet + sellableOff;

              // COMO fee and investor profit
              const comoFeePct = 0.15;
              const comoFee = profitVal > 0 ? profitVal * comoFeePct : 0;
              const investorProfit = profitVal - comoFee;
              const investorROI = investedCapital > 0 ? (investorProfit / investedCapital) * 100 : 0;

              // Revenue breakdown
              const revRes = realCosts.revenueRes || 0;
              const revRet = realCosts.revenueRet || 0;
              const revOff = realCosts.revenueOff || 0;

              const hasNoGFA = gfaResSqft === 0 && gfaRetSqft === 0 && gfaOffSqft === 0;
              const hasNoRevenue = totalRevenueVal === 0;
              return (
                <div className="space-y-3">

                  {/* ══════ WARNING BANNERS ══════ */}
                  {hasNoGFA && (
                    <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                      <div className="text-right">
                        <p className="text-xs font-bold text-amber-800">بيانات المساحات غير مكتملة — يرجى إدخال GFA في بطاقة المشروع</p>
                      </div>
                    </div>
                  )}
                  {!hasNoGFA && hasNoRevenue && (
                    <div className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-blue-600 flex-shrink-0" />
                      <div className="text-right">
                        <p className="text-xs font-bold text-blue-800">الإيرادات = صفر — يرجى إدخال التسعير في تبويب التسعير</p>
                      </div>
                    </div>
                  )}

                  {/* ══════ SECTION 1: PROJECT INFO HEADER ══════ */}
                  <div className="rounded-xl bg-gradient-to-l from-gray-900 via-slate-800 to-slate-900 px-5 py-3 shadow-lg relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,_rgba(255,255,255,0.04)_0%,transparent_60%)]" />
                    <div className="relative flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md">
                          <Building2 className="w-4.5 h-4.5 text-white" />
                        </div>
                        <div>
                          <h2 className="text-base font-black text-white">{selectedProject?.name || 'المشروع'}</h2>
                          <p className="text-[10px] text-slate-400">{selectedProject?.community || selectedProject?.description || ''}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {selectedProject?.plotNumber && (
                          <span className="bg-slate-700/60 border border-slate-600/50 text-slate-300 text-[9px] font-bold px-2 py-1 rounded-md">قطعة {selectedProject.plotNumber}</span>
                        )}
                        <button
                          onClick={() => {
                            const reportData: FeasibilityReportData = {
                              projectName: selectedProject?.name || 'المشروع',
                              community: selectedProject?.community || '',
                              plotNumber: selectedProject?.plotNumber || '',
                              permittedUse: selectedProject?.permittedUse || '',
                              masterDevName: selectedProject?.masterDevName || '',
                              ownershipType: selectedProject?.ownershipType || '',
                              titleDeedNumber: selectedProject?.titleDeedNumber || '',
                              areaCode: selectedProject?.areaCode || '',
                              landPrice: parseFloat(selectedProject?.landPrice || '0'),
                              constructionPricePerSqft: parseFloat(selectedProject?.constructionPricePerSqft || '0'),
                              preConMonths: parseInt(selectedProject?.preConstructionMonths || '0'),
                              constructionMonths: parseInt(selectedProject?.constructionMonths || '0'),
                              handoverMonths: parseInt(selectedProject?.postConstructionMonths || '0'),
                              developerFeePct: parseFloat(selectedProject?.developerFeePct || '5'),
                              salesCommissionPct: parseFloat(selectedProject?.salesCommissionPct || '5'),
                              marketingPct: parseFloat(selectedProject?.marketingPct || '2'),
                              designFeePct: parseFloat(selectedProject?.designFeePct || '0'),
                              financingScenario: selectedProject?.financingScenario || '',
                              plotAreaSqft, plotAreaSqm, buaSqft, gfaTotalSqft,
                              gfaResSqft, gfaRetSqft, gfaOffSqft,
                              sellableRes, sellableRet, sellableOff, totalSellable,
                              resPct, retPct, offPct,
                              totalRevenue: totalRevenueVal,
                              revenueRes: revRes, revenueRet: revRet, revenueOff: revOff,
                              totalCosts: totalCostsVal,
                              investedCapital,
                              profit: profitVal,
                              margin: marginVal,
                              profitOnCost,
                              roiOnCapital,
                              comoFee,
                              investorProfit,
                              investorROI,
                              paidCapital: paidT,
                              unpaidInvestor,
                              scenarios: { optimistic: opt, base, conservative: cons },
                            };
                            exportFeasibilityReport(reportData);
                          }}
                          className="flex items-center gap-1 bg-emerald-600/80 hover:bg-emerald-500 text-white text-[9px] font-bold px-2 py-1 rounded-md transition-colors"
                        >
                          <Printer className="w-3 h-3" />
                          تصدير التقرير
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* ══════ SECTION 1B: PROJECT INFO CARD ══════ */}
                  <div className="rounded-xl bg-white border border-gray-200 shadow-sm overflow-hidden">
                    <div className="px-4 py-1.5 bg-gradient-to-l from-gray-50 to-slate-50/40 border-b border-gray-100 flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-gray-600 to-slate-700 flex items-center justify-center">
                        <Info className="w-3 h-3 text-white" />
                      </div>
                      <h3 className="text-xs font-bold text-gray-800">بطاقة المشروع</h3>
                    </div>
                    <div className="px-3 py-2">
                      <div className="grid grid-cols-3 gap-x-4 gap-y-1.5 text-[11px]" dir="rtl">
                        {selectedProject?.permittedUse && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-gray-400 font-medium">الاستخدام:</span>
                            <span className="font-bold text-gray-800">{selectedProject.permittedUse}</span>
                          </div>
                        )}
                        {selectedProject?.masterDevName && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-gray-400 font-medium">المطور الرئيسي:</span>
                            <span className="font-bold text-gray-800">{selectedProject.masterDevName}</span>
                          </div>
                        )}
                        {selectedProject?.ownershipType && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-gray-400 font-medium">الملكية:</span>
                            <span className="font-bold text-gray-800">{selectedProject.ownershipType}</span>
                          </div>
                        )}
                        {selectedProject?.titleDeedNumber && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-gray-400 font-medium">سند الملكية:</span>
                            <span className="font-bold text-gray-800">{selectedProject.titleDeedNumber}</span>
                          </div>
                        )}
                        {selectedProject?.areaCode && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-gray-400 font-medium">المنطقة:</span>
                            <span className="font-bold text-gray-800">{selectedProject.areaCode}</span>
                          </div>
                        )}
                        {selectedProject?.landPrice && parseFloat(selectedProject.landPrice) > 0 && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-gray-400 font-medium">سعر الأرض:</span>
                            <span className="font-bold text-gray-800" dir="ltr">{fmtFull(parseFloat(selectedProject.landPrice))} AED</span>
                          </div>
                        )}
                        {selectedProject?.manualBuaSqft && parseFloat(selectedProject.manualBuaSqft) > 0 && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-gray-400 font-medium">BUA:</span>
                            <span className="font-bold text-gray-800" dir="ltr">{fmtFull(parseFloat(selectedProject.manualBuaSqft))} sqft</span>
                          </div>
                        )}
                        {selectedProject?.estimatedConstructionPricePerSqft && parseFloat(selectedProject.estimatedConstructionPricePerSqft) > 0 && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-gray-400 font-medium">سعر القدم:</span>
                            <span className="font-bold text-gray-800" dir="ltr">{parseFloat(selectedProject.estimatedConstructionPricePerSqft).toFixed(0)} AED/sqft</span>
                          </div>
                        )}
                        {realCosts && realCosts.constructionCost > 0 && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-gray-400 font-medium">تكلفة الإنشاء:</span>
                            <span className="font-bold text-orange-700" dir="ltr">{fmtFull(realCosts.constructionCost)} AED</span>
                          </div>
                        )}
                        {(selectedProject?.preConMonths || selectedProject?.constructionMonths) && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-gray-400 font-medium">المدة:</span>
                            <span className="font-bold text-gray-800">
                              {selectedProject.preConMonths || 0} + {selectedProject.constructionMonths || 0} + {selectedProject.handoverMonths || 0} شهر
                            </span>
                          </div>
                        )}
                        {selectedProject?.developerFeePct && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-gray-400 font-medium">أتعاب المطور:</span>
                            <span className="font-bold text-gray-800">{selectedProject.developerFeePct}%</span>
                          </div>
                        )}
                        {selectedProject?.salesCommissionPct && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-gray-400 font-medium">عمولة المبيعات:</span>
                            <span className="font-bold text-gray-800">{selectedProject.salesCommissionPct}%</span>
                          </div>
                        )}
                        {selectedProject?.marketingPct && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-gray-400 font-medium">التسويق:</span>
                            <span className="font-bold text-gray-800">{selectedProject.marketingPct}%</span>
                          </div>
                        )}
                        {selectedProject?.designFeePct && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-gray-400 font-medium">رسوم التصميم:</span>
                            <span className="font-bold text-gray-800">{selectedProject.designFeePct}%</span>
                          </div>
                        )}
                        {selectedProject?.financingScenario && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-gray-400 font-medium">سيناريو التمويل:</span>
                            <span className="font-bold text-gray-800">{selectedProject.financingScenario === 'offplan_escrow' ? 'أوف بلان + ضمان' : selectedProject.financingScenario === 'construction_loan' ? 'قرض بناء' : selectedProject.financingScenario}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* ══════ SECTION 2: REVENUE ══════ */}
                  <div className="rounded-xl bg-white border border-emerald-200/60 shadow-sm overflow-hidden">
                    <div className="px-4 py-2 bg-gradient-to-l from-emerald-50 to-teal-50/40 border-b border-emerald-100 flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                        <TrendingUp className="w-3.5 h-3.5 text-white" />
                      </div>
                      <h3 className="text-xs font-bold text-emerald-900">إجمالي الإيرادات المتوقعة</h3>
                    </div>
                    <div className="px-4 py-3">
                      <div className="text-3xl font-black text-emerald-800 tabular-nums mb-2" dir="ltr">
                        {fmtFull(totalRevenueVal)} <span className="text-sm font-normal text-emerald-500">AED</span>
                      </div>
                      {totalRevenueVal === 0 && (
                        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 mb-2">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                          <span className="text-[10px] text-amber-700 font-medium">لم يتم إدخال التسعير بعد</span>
                        </div>
                      )}
                      {totalRevenueVal > 0 && (
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { label: "سكني", val: revRes, color: "bg-sky-50 border-sky-200 text-sky-700", icon: <Building2 className="w-3 h-3" /> },
                            { label: "تجاري", val: revRet, color: "bg-orange-50 border-orange-200 text-orange-700", icon: <ShoppingBag className="w-3 h-3" /> },
                            { label: "مكاتب", val: revOff, color: "bg-violet-50 border-violet-200 text-violet-700", icon: <Briefcase className="w-3 h-3" /> },
                          ].filter(r => r.val > 0).map(r => (
                            <div key={r.label} className={`rounded-lg border px-2 py-1.5 ${r.color}`}>
                              <div className="flex items-center gap-1 mb-0.5">{r.icon}<span className="text-[9px] font-bold">{r.label}</span></div>
                              <div className="text-sm font-black tabular-nums" dir="ltr">{fmtFull(r.val)}</div>
                              <div className="text-[8px] opacity-70">{totalRevenueVal > 0 ? ((r.val / totalRevenueVal) * 100).toFixed(1) : 0}%</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ══════ SECTION 3: COSTS & CAPITAL ══════ */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-white border border-red-200/60 shadow-sm overflow-hidden">
                      <div className="px-3 py-2 bg-gradient-to-l from-red-50 to-rose-50/40 border-b border-red-100 flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center">
                          <DollarSign className="w-3.5 h-3.5 text-white" />
                        </div>
                        <div>
                          <h3 className="text-[10px] font-bold text-red-900">التكلفة الكلية</h3>
                          <p className="text-[8px] text-red-500">مستثمر + ضمان</p>
                        </div>
                      </div>
                      <div className="px-3 py-2">
                        <div className="text-2xl font-black text-red-800 tabular-nums" dir="ltr">
                          {fmtFull(totalCostsVal)} <span className="text-[10px] font-normal text-red-400">AED</span>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-xl bg-white border border-indigo-200/60 shadow-sm overflow-hidden">
                      <div className="px-3 py-2 bg-gradient-to-l from-indigo-50 to-blue-50/40 border-b border-indigo-100 flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center">
                          <Briefcase className="w-3.5 h-3.5 text-white" />
                        </div>
                        <div>
                          <h3 className="text-[10px] font-bold text-indigo-900">رأس المال المطلوب</h3>
                          <p className="text-[8px] text-indigo-500">بدون الضمان</p>
                        </div>
                      </div>
                      <div className="px-3 py-2">
                        <div className="text-2xl font-black text-indigo-800 tabular-nums" dir="ltr">
                          {fmtFull(investedCapital)} <span className="text-[10px] font-normal text-indigo-400">AED</span>
                        </div>
                      </div>
                    </div>
                                    </div>
                  {/* Construction Cost line */}
                  <div className="rounded-lg bg-orange-50/60 border border-orange-200/60 px-3 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Hammer className="w-4 h-4 text-orange-600" />
                      <span className="text-xs font-bold text-orange-900">تكلفة الإنشاء</span>
                      <span className="text-[9px] text-orange-500">(BUA × سعر القدم)</span>
                    </div>
                    <div className="text-lg font-black text-orange-800 tabular-nums" dir="ltr">
                      {fmtFull(realCosts?.constructionCost || 0)} <span className="text-[9px] font-normal text-orange-400">AED</span>
                    </div>
                  </div>
                  {/* ══════ SECTION 4: PROFIT & RATIOS ══════ */}
                  <div className="rounded-xl bg-white border border-gray-200 shadow-sm overflow-hidden">
                    <div className="px-4 py-2 bg-gradient-to-l from-emerald-50/60 to-white border-b border-gray-100 flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center">
                        <BarChart3 className="w-3.5 h-3.5 text-white" />
                      </div>
                      <h3 className="text-xs font-bold text-gray-800">الربح والعوائد</h3>
                    </div>
                    <div className="px-4 py-3">
                      {/* Main profit */}
                      <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100">
                        <div>
                          <span className="text-[10px] text-gray-500 block">صافي الربح</span>
                          <div className={`text-2xl font-black tabular-nums ${profitVal >= 0 ? 'text-emerald-700' : 'text-red-700'}`} dir="ltr">{fmtFull(profitVal)} <span className="text-[10px] font-normal text-gray-400">AED</span></div>
                        </div>
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${profitVal >= 0 ? 'bg-emerald-100' : 'bg-red-100'}`}>
                          <BarChart2 className={`w-5 h-5 ${profitVal >= 0 ? 'text-emerald-600' : 'text-red-600'}`} />
                        </div>
                      </div>

                      {/* Ratios grid */}
                      <div className="grid grid-cols-3 gap-2 mb-3">
                        <div className="bg-violet-50/80 border border-violet-200/60 rounded-lg p-2 text-center">
                          <div className="text-[9px] text-violet-600 font-medium mb-0.5">ربح/تكلفة</div>
                          <div className={`text-lg font-black tabular-nums ${profitOnCost >= 0 ? 'text-violet-700' : 'text-red-700'}`}>{fmtPct(profitOnCost)}</div>
                        </div>
                        <div className="bg-blue-50/80 border border-blue-200/60 rounded-lg p-2 text-center">
                          <div className="text-[9px] text-blue-600 font-medium mb-0.5">ربح/رأس المال</div>
                          <div className={`text-lg font-black tabular-nums ${roiOnCapital >= 0 ? 'text-blue-700' : 'text-red-700'}`}>{fmtPct(roiOnCapital)}</div>
                        </div>
                        <div className="bg-amber-50/80 border border-amber-200/60 rounded-lg p-2 text-center">
                          <div className="text-[9px] text-amber-600 font-medium mb-0.5">ROI المستثمر</div>
                          <div className={`text-lg font-black tabular-nums ${investorROI >= 0 ? 'text-amber-700' : 'text-red-700'}`}>{fmtPct(investorROI)}</div>
                        </div>
                      </div>

                      {/* COMO fee & Investor profit */}
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100">
                        <div className="bg-orange-50/60 border border-orange-200/50 rounded-lg px-3 py-2">
                          <div className="flex items-center gap-1.5 mb-1">
                            <Sparkles className="w-3 h-3 text-orange-500" />
                            <span className="text-[10px] font-bold text-orange-800">كومو (15%)</span>
                          </div>
                          <div className="text-base font-black text-orange-800 tabular-nums" dir="ltr">{fmtFull(comoFee)} <span className="text-[9px] font-normal text-orange-500">AED</span></div>
                        </div>
                        <div className="bg-emerald-50/60 border border-emerald-200/50 rounded-lg px-3 py-2">
                          <div className="flex items-center gap-1.5 mb-1">
                            <Users className="w-3 h-3 text-emerald-500" />
                            <span className="text-[10px] font-bold text-emerald-800">ربح المستثمر</span>
                          </div>
                          <div className="text-base font-black text-emerald-800 tabular-nums" dir="ltr">{fmtFull(investorProfit)} <span className="text-[9px] font-normal text-emerald-500">AED</span></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ══════ SECTION 5: CAPITAL BREAKDOWN ══════ */}
                  <div className="rounded-xl bg-white border border-amber-200/60 shadow-sm overflow-hidden">
                    <div className="px-4 py-2 bg-gradient-to-l from-amber-50 to-orange-50/40 border-b border-amber-100 flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                        <Landmark className="w-3.5 h-3.5 text-white" />
                      </div>
                      <h3 className="text-xs font-bold text-amber-900">تفاصيل رأس المال</h3>
                    </div>
                    <div className="px-4 py-3">
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <div className="bg-emerald-50 border border-emerald-200/70 rounded-lg px-3 py-2">
                          <div className="flex items-center gap-1.5 mb-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-[10px] font-bold text-emerald-800">مدفوع</span>
                          </div>
                          <div className="text-sm font-black text-emerald-800 tabular-nums" dir="ltr">{fmtFull(paidT)} <span className="text-[8px] text-emerald-500">AED</span></div>
                          <div className="text-[9px] text-emerald-600 font-medium">{investedCapital > 0 ? ((paidT / investedCapital) * 100).toFixed(1) : 0}%</div>
                        </div>
                        <div className="bg-amber-50 border border-amber-200/70 rounded-lg px-3 py-2">
                          <div className="flex items-center gap-1.5 mb-1">
                            <ArrowDownCircle className="w-3.5 h-3.5 text-amber-600" />
                            <span className="text-[10px] font-bold text-amber-800">مطلوب سداده</span>
                          </div>
                          <div className="text-sm font-black text-amber-800 tabular-nums" dir="ltr">{fmtFull(unpaidInvestor)} <span className="text-[8px] text-amber-500">AED</span></div>
                          <div className="text-[9px] text-amber-600 font-medium">{investedCapital > 0 ? ((unpaidInvestor / investedCapital) * 100).toFixed(1) : 0}%</div>
                        </div>
                      </div>
                      <div className="relative">
                        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-l from-emerald-400 to-teal-600 rounded-full transition-all duration-700 ease-out"
                            style={{ width: `${investedCapital > 0 ? Math.min(100, (paidT / investedCapital) * 100) : 0}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between mt-1 text-[9px]">
                          <span className="text-emerald-700 font-semibold">المدفوع: {fmtFull(paidT)}</span>
                          <span className="text-amber-700 font-semibold">المتبقي: {fmtFull(unpaidInvestor)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ══════ SECTION 6: AREAS & PROJECT DETAILS ══════ */}
                  <div className="rounded-xl bg-white border border-sky-200/60 shadow-sm overflow-hidden">
                    <div className="px-4 py-2 bg-gradient-to-l from-sky-50 to-blue-50/40 border-b border-sky-100 flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center">
                        <LandPlot className="w-3.5 h-3.5 text-white" />
                      </div>
                      <h3 className="text-xs font-bold text-sky-900">بيانات المساحات</h3>
                    </div>
                    <div className="grid grid-cols-4 gap-0 divide-x divide-gray-100" dir="rtl">
                      {[
                        { label: "الأرض", val: `${fmtFull(plotAreaSqft)}`, sub: `${fmtFull(plotAreaSqm)} م²`, icon: <LandPlot className="w-3 h-3 text-sky-600" />, color: "bg-sky-50/60" },
                        { label: "BUA", val: `${fmtFull(buaSqft)}`, sub: "sqft", icon: <Warehouse className="w-3 h-3 text-amber-600" />, color: "bg-amber-50/60" },
                        { label: "GFA", val: `${fmtFull(gfaTotalSqft)}`, sub: "sqft", icon: <SquareStack className="w-3 h-3 text-emerald-600" />, color: "bg-emerald-50/60" },
                        { label: "قابل للبيع", val: `${fmtFull(totalSellable)}`, sub: "sqft", icon: <ShoppingBag className="w-3 h-3 text-violet-600" />, color: "bg-violet-50/60" },
                      ].map(item => (
                        <div key={item.label} className={`px-3 py-2 ${item.color}`}>
                          <div className="flex items-center gap-1 mb-0.5">{item.icon}<span className="text-[9px] font-bold text-gray-600">{item.label}</span></div>
                          <div className="text-sm font-black font-mono text-gray-800" dir="ltr">{item.val}</div>
                          <div className="text-[9px] text-gray-400 font-mono" dir="ltr">{item.sub}</div>
                        </div>
                      ))}
                    </div>
                    {(gfaResSqft > 0 || gfaRetSqft > 0 || gfaOffSqft > 0) && (
                      <div className="border-t border-gray-100">
                        <table className="w-full text-[10px]">
                          <thead>
                            <tr className="bg-gray-50/80 border-b border-gray-100">
                              <th className="text-right py-1.5 pr-3 font-bold text-gray-500">الفئة</th>
                              <th className="text-center py-1.5 font-bold text-gray-500">GFA</th>
                              <th className="text-center py-1.5 font-bold text-gray-500">كفاءة</th>
                              <th className="text-center py-1.5 font-bold text-gray-500">قابل للبيع</th>
                            </tr>
                          </thead>
                          <tbody>
                            {[
                              { label: "سكني", gfa: gfaResSqft, eff: Math.round(resPct * 100), sell: sellableRes, dot: "bg-sky-500" },
                              { label: "تجزئة", gfa: gfaRetSqft, eff: Math.round(retPct * 100), sell: sellableRet, dot: "bg-orange-500" },
                              { label: "مكاتب", gfa: gfaOffSqft, eff: Math.round(offPct * 100), sell: sellableOff, dot: "bg-violet-500" },
                            ].filter(r => r.gfa > 0).map(r => (
                              <tr key={r.label} className="border-b border-gray-50">
                                <td className="py-1 pr-3 flex items-center gap-1.5"><span className={`w-2 h-2 rounded-full ${r.dot}`} /><span className="font-medium">{r.label}</span></td>
                                <td className="py-1 text-center font-mono text-gray-700" dir="ltr">{fmtFull(r.gfa)}</td>
                                <td className="py-1 text-center"><span className="bg-emerald-100 text-emerald-700 text-[9px] font-bold px-1.5 py-0.5 rounded-full">{r.eff}%</span></td>
                                <td className="py-1 text-center font-mono font-semibold text-gray-800" dir="ltr">{fmtFull(r.sell)}</td>
                              </tr>
                            ))}
                            <tr className="bg-gray-50/80 font-bold">
                              <td className="py-1 pr-3 text-gray-700">الإجمالي</td>
                              <td className="py-1 text-center font-mono text-gray-800" dir="ltr">{fmtFull(gfaTotalSqft)}</td>
                              <td className="py-1 text-center">—</td>
                              <td className="py-1 text-center font-mono text-gray-900" dir="ltr">{fmtFull(totalSellable)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* ══════ SECTION 7: SCENARIO COMPARISON ══════ */}
                  <div className="rounded-xl bg-white border border-purple-200/60 shadow-sm overflow-hidden">
                    <div className="px-4 py-2 bg-gradient-to-l from-purple-50 to-fuchsia-50/40 border-b border-purple-100 flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-fuchsia-600 flex items-center justify-center">
                        <Scale className="w-3.5 h-3.5 text-white" />
                      </div>
                      <h3 className="text-xs font-bold text-purple-900">مقارنة السيناريوهات</h3>
                    </div>
                    <div className="grid grid-cols-3 divide-x divide-gray-100" dir="ltr">
                      {[
                        { label: "متحفظ -10%", data: cons, color: "text-amber-600", bg: "bg-amber-50/40" },
                        { label: "أساسي", data: base, color: "text-blue-600", bg: "bg-blue-50/40" },
                        { label: "متفائل +10%", data: opt, color: "text-emerald-600", bg: "bg-emerald-50/40" },
                      ].map(sc => (
                        <div key={sc.label} className={`px-3 py-2 text-center ${sc.bg}`} dir="rtl">
                          <p className={`text-[10px] font-bold ${sc.color} mb-1.5`}>{sc.label}</p>
                          <div className="space-y-1">
                            <div>
                              <span className="text-[9px] text-gray-500 block">الإيرادات</span>
                              <span className="text-xs font-bold font-mono text-gray-800" dir="ltr">{fmt(sc.data.revenue)}</span>
                            </div>
                            <div>
                              <span className="text-[9px] text-gray-500 block">الربح</span>
                              <span className={`text-xs font-bold font-mono ${sc.data.profit >= 0 ? 'text-emerald-700' : 'text-red-700'}`} dir="ltr">{fmt(sc.data.profit)}</span>
                            </div>
                            <div>
                              <span className="text-[9px] text-gray-500 block">الهامش</span>
                              <span className="text-xs font-bold font-mono text-gray-700">{fmtPct(sc.data.margin)}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* ═══════════════════════════════════════════ */}
            {/* TABS */}
            {/* ═══════════════════════════════════════════ */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full justify-start mb-4 bg-card border border-border h-auto flex-wrap gap-1 p-1">

                <TabsTrigger value="tab5" className="gap-1.5 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground relative">
                  💰 التسعير والإيرادات
                  {syncStatusQuery.data?.isOutOfSync && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-orange-500 rounded-full border border-white" title="بيانات غير متزامنة" />
                  )}
                </TabsTrigger>
                <TabsTrigger value="tab_cf_settings" className="gap-1.5 text-xs data-[state=active]:bg-gradient-to-l data-[state=active]:from-blue-600 data-[state=active]:to-cyan-600 data-[state=active]:text-white">
                  ⚙️ إعدادات التدفق
                </TabsTrigger>
                <TabsTrigger value="tab_cf_reflection" className="gap-1.5 text-xs data-[state=active]:bg-gradient-to-l data-[state=active]:from-emerald-700 data-[state=active]:to-teal-700 data-[state=active]:text-white">
                  📊 التكاليف الكلية للمشروع والجدول الزمني
                </TabsTrigger>
              </TabsList>

              <TabsContent value="tab5">
                <CostsCashFlowTab projectId={selectedProjectId} studyId={selectedStudyId} form={form} computed={computed} />
              </TabsContent>

              <TabsContent value="tab_cf_settings">
                <CashFlowSettingsPage embedded initialProjectId={selectedProjectId} onNavigateToReflection={() => setActiveTab("tab_cf_reflection")} />
              </TabsContent>
              <TabsContent value="tab_cf_reflection">
                <CapitalScheduleTablePage embedded initialProjectId={selectedProjectId} />
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </div>
  );
}
