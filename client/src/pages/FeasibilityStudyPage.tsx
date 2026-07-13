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
  BarChart2, Target, Briefcase, Layers,
} from "lucide-react";
import { useLocation } from "wouter";
import CostsCashFlowTab from "@/components/feasibility/CostsCashFlowTab";
import JoelleEngineTab from "@/components/feasibility/JoelleEngineTab";
import JoelleDataManager from "@/components/feasibility/JoelleDataManager";
import CashFlowSettingsPage from "@/pages/CashFlowSettingsPage";
import CapitalScheduleTablePage from "@/pages/CapitalScheduleTablePage";
import { calculateProjectCosts } from "@/lib/projectCostsCalc";

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

function JoellePlaceholder({ message, subMessage }: { message: string; subMessage: string }) {
  return (
    <div className="text-center py-16 bg-muted/20 rounded-xl border border-dashed border-border">
      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-pink-100 to-purple-100 flex items-center justify-center mx-auto mb-4">
        <span className="text-2xl font-bold text-purple-400">ج</span>
      </div>
      <p className="text-sm font-medium text-muted-foreground">{message}</p>
      <p className="text-xs text-muted-foreground/70 mt-1">{subMessage}</p>
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
      if (!costs) return { project: p, totalCosts: 0, totalRevenue: 0, profit: 0, margin: 0, roi: 0, investedCapital: 0, roiOnCapital: 0, hasApproved: false };

      // Use grandTotal from cashFlowSettings (same source as Capital Schedule Table)
      // Fall back to calculateProjectCosts if settings not loaded yet
      let totalCosts = costs.totalCosts || 0;
      let investorTotal = 0;
      if (settingsData?.settings) {
        const items = settingsData.settings.filter((s: any) => s.isActive !== 0 && s.isActive !== false);
        const paidT = items.filter((s: any) => s.section === "paid").reduce((sum: number, s: any) => sum + (s.computedAmount || 0), 0);
        const investorT = items.filter((s: any) => s.fundingSource === "investor" && s.section !== "paid").reduce((sum: number, s: any) => sum + (s.computedAmount || 0), 0);
        const escrowT = items.filter((s: any) => s.fundingSource === "escrow").reduce((sum: number, s: any) => sum + (s.computedAmount || 0), 0);
        totalCosts = paidT + investorT + escrowT;
        investorTotal = paidT + investorT;
      }

      // Use approved revenue if available, otherwise calculated
      const approvedRev = (cp as any)?.approvedRevenue;
      const totalRevenue = (approvedRev && approvedRev > 0) ? approvedRev : (costs.totalRevenue || 0);
      const hasApproved = !!(approvedRev && approvedRev > 0);
      const profit = totalRevenue - totalCosts;
      const margin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;
      const roi = totalCosts > 0 ? (profit / totalCosts) * 100 : 0;
      // Use investorTotal from settings as invested capital (what investor actually pays)
      const investedCapital = investorTotal > 0 ? investorTotal : calcInvestedCapital(costs);
      const roiOnCapital = investedCapital > 0 ? (profit / investedCapital) * 100 : 0;

      return { project: p, totalCosts, totalRevenue, profit, margin, roi, investedCapital, roiOnCapital, hasApproved };
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
                  {d.hasApproved && <span className="text-[9px] text-emerald-600 mr-7 block mt-0.5">✓ إيرادات معتمدة</span>}
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
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(initialProjectId ?? null);
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
                const items = singleSettingsQuery.data.settings.filter((s: any) => s.isActive !== 0 && s.isActive !== false);
                const paidT = items.filter((s: any) => s.section === "paid").reduce((sum: number, s: any) => sum + (s.computedAmount || 0), 0);
                const investorT = items.filter((s: any) => s.fundingSource === "investor" && s.section !== "paid").reduce((sum: number, s: any) => sum + (s.computedAmount || 0), 0);
                const escrowT = items.filter((s: any) => s.fundingSource === "escrow").reduce((sum: number, s: any) => sum + (s.computedAmount || 0), 0);
                totalCostsVal = paidT + investorT + escrowT;
                investedCapital = paidT + investorT;
              }
              // Use approved revenue if available
              const approvedRev = (cpQuery.data as any)?.approvedRevenue;
              const totalRevenueVal = (approvedRev && approvedRev > 0) ? approvedRev : (realCosts.totalRevenue || 0);
              const hasApproved = !!(approvedRev && approvedRev > 0);
              const profitVal = totalRevenueVal - totalCostsVal;
              const marginVal = totalRevenueVal > 0 ? (profitVal / totalRevenueVal) * 100 : 0;

              // Investor's actual capital outlay (from settings = paid + investor items)
              const roiOnCapital = investedCapital > 0 ? (profitVal / investedCapital) * 100 : 0;

              // 3-scenario comparison
              const scenarioCalc = (sc: "optimistic" | "base" | "conservative") => {
                const c = calculateProjectCosts(selectedProject, moQuery.data, cpQuery.data, sc);
                if (!c) return { revenue: 0, profit: 0, margin: 0 };
                const rev = (hasApproved && sc === "base") ? totalRevenueVal : (c.totalRevenue || 0);
                const cost = c.totalCosts || 0;
                const p = rev - cost;
                return { revenue: rev, profit: p, margin: rev > 0 ? (p / rev) * 100 : 0 };
              };
              const opt = scenarioCalc("optimistic");
              const base = scenarioCalc("base");
              const cons = scenarioCalc("conservative");

              return (
                <div className="space-y-4">
                  {/* Project Title Bar */}
                  <div className="flex items-center justify-between bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-md">
                        <Building2 className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h2 className="font-bold text-gray-800 text-base">{form.projectName || selectedProject?.name || "—"}</h2>
                        <p className="text-[11px] text-gray-500">
                          {selectedProject?.community || ""}
                          {hasApproved && <span className="mr-2 bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-[10px]">✓ إيرادات معتمدة</span>}
                        </p>
                      </div>
                    </div>
                    {totalRevenueVal === 0 && (
                      <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                        <span className="text-[10px] text-amber-700 font-medium">لم يتم إدخال التسعير بعد</span>
                      </div>
                    )}
                  </div>

                  {/* KPI Cards — 6 metrics */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    <KpiCard label="إجمالي التكاليف" value={fmt(totalCostsVal)} sub="درهم" color="rose" icon={<DollarSign className="w-4 h-4" />} />
                    <KpiCard label="إجمالي الإيرادات" value={fmt(totalRevenueVal)} sub="درهم" color="emerald" icon={<TrendingUp className="w-4 h-4" />} />
                    <KpiCard label="صافي الربح" value={fmt(profitVal)} sub={`${fmtPct(marginVal)} هامش ربح`} color={profitVal >= 0 ? "blue" : "red"} icon={<BarChart2 className="w-4 h-4" />} />
                    <KpiCard label="رأس المال المستثمر" value={fmt(investedCapital)} sub="أرض + مصاريف + 30% مقاول" color="amber" icon={<Briefcase className="w-4 h-4" />} />
                    <KpiCard label="العائد على رأس المال" value={fmtPct(roiOnCapital)} sub="ربح ÷ رأس المال المستثمر" color={roiOnCapital >= 0 ? "violet" : "red"} icon={<Target className="w-4 h-4" />} />
                    <KpiCard label="هامش الربح" value={fmtPct(marginVal)} sub="ربح ÷ الإيرادات" color={marginVal >= 15 ? "teal" : marginVal >= 0 ? "gray" : "red"} icon={<Percent className="w-4 h-4" />} />
                  </div>

                  {/* Scenario Comparison Strip */}
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50">
                      <h4 className="text-xs font-bold text-gray-600 flex items-center gap-2">
                        <Scale className="w-3.5 h-3.5" />
                        مقارنة السيناريوهات
                      </h4>
                    </div>
                    <div className="grid grid-cols-3 divide-x divide-gray-100" dir="ltr">
                      {[
                        { label: "متحفظ -10%", data: cons, color: "text-amber-600" },
                        { label: "أساسي", data: base, color: "text-blue-600" },
                        { label: "متفائل +10%", data: opt, color: "text-emerald-600" },
                      ].map(sc => (
                        <div key={sc.label} className="p-4 text-center" dir="rtl">
                          <p className={`text-[10px] font-bold ${sc.color} mb-2`}>{sc.label}</p>
                          <div className="space-y-1.5">
                            <div>
                              <span className="text-[9px] text-gray-500 block">الإيرادات</span>
                              <span className="text-sm font-bold font-mono text-gray-800" dir="ltr">{fmt(sc.data.revenue)}</span>
                            </div>
                            <div>
                              <span className="text-[9px] text-gray-500 block">الربح</span>
                              <span className={`text-sm font-bold font-mono ${sc.data.profit >= 0 ? 'text-emerald-700' : 'text-red-700'}`} dir="ltr">{fmt(sc.data.profit)}</span>
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
                <TabsTrigger value="tab10" className="gap-1.5 text-xs data-[state=active]:bg-gradient-to-l data-[state=active]:from-emerald-600 data-[state=active]:to-teal-600 data-[state=active]:text-white">
                  📦 البيانات والمصادر
                </TabsTrigger>
                <TabsTrigger value="tab9" className="gap-1.5 text-xs data-[state=active]:bg-gradient-to-l data-[state=active]:from-purple-600 data-[state=active]:to-pink-600 data-[state=active]:text-white">
                  🧠 الدراسات والأبحاث
                </TabsTrigger>
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
              <TabsContent value="tab10">
                <JoelleDataManager projectId={selectedProjectId} community={form.community || ''} />
              </TabsContent>
              <TabsContent value="tab9">
                <JoelleEngineTab projectId={selectedProjectId} studyId={selectedStudyId} />
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
