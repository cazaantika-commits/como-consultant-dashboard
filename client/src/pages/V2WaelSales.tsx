import { useState, useMemo, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useProjectContext } from "@/contexts/ProjectContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/hooks/use-toast";
import { ProjectSelector } from "@/components/ProjectSelector";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowRight, TrendingUp, Target, Megaphone, Calendar, DollarSign,
  Palette, Rocket, FileCheck, HardHat, Save, Loader2,
  Building2, Percent, CreditCard, Table2, Info,
} from "lucide-react";
import {
  dbProjectToInputs,
  dbProjectToRates,
  calculateProjectFormulas,
  calculatePricingFormulas,
  calculateCosts,
} from "@/lib/projectData";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as ReTooltip, ResponsiveContainer, Cell,
} from "recharts";

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════
const UNIT_TYPES = [
  { id: "residential1br", name: "غرفة وصالة", color: "#3b82f6", dbCount: "residential1brCount", dbArea: "residential1brArea", dbPrice: "residential1brPrice" },
  { id: "residential2br", name: "غرفتين وصالة", color: "#8b5cf6", dbCount: "residential2brCount", dbArea: "residential2brArea", dbPrice: "residential2brPrice" },
  { id: "residential3br", name: "ثلاث غرف", color: "#d946ef", dbCount: "residential3brCount", dbArea: "residential3brArea", dbPrice: "residential3brPrice" },
  { id: "retailSmall", name: "تجزئة صغير", color: "#f59e0b", dbCount: "retailSmallCount", dbArea: "retailSmallArea", dbPrice: "retailSmallPrice" },
  { id: "retailMedium", name: "تجزئة متوسط", color: "#f97316", dbCount: "retailMediumCount", dbArea: "retailMediumArea", dbPrice: "retailMediumPrice" },
  { id: "retailLarge", name: "تجزئة كبير", color: "#ef4444", dbCount: "retailLargeCount", dbArea: "retailLargeArea", dbPrice: "retailLargePrice" },
  { id: "officeSmall", name: "مكاتب صغير", color: "#10b981", dbCount: "officeSmallCount", dbArea: "officeSmallArea", dbPrice: "officeSmallPrice" },
  { id: "officeMedium", name: "مكاتب متوسط", color: "#14b8a6", dbCount: "officeMediumCount", dbArea: "officeMediumArea", dbPrice: "officeMediumPrice" },
  { id: "officeLarge", name: "مكاتب كبير", color: "#06b6d4", dbCount: "officeLargeCount", dbArea: "officeLargeArea", dbPrice: "officeLargePrice" },
];



const PROJECT_PHASES = [
  { id: "design", name: "التصاميم", color: "#3b82f6", icon: Palette },
  { id: "materials", name: "تحضير مواد التسويق", color: "#f59e0b", icon: Rocket },
  { id: "rera", name: "ريرا + اعتمادات البيع", color: "#8b5cf6", icon: FileCheck },
  { id: "marketing", name: "إطلاق التسويق", color: "#ec4899", icon: Megaphone },
  { id: "sales", name: "بدء المبيعات", color: "#10b981", icon: Target },
  { id: "construction", name: "الإنشاء", color: "#64748b", icon: HardHat },
];

// ─── Utilities ───────────────────────────────────────────────────────────────
function fmt(n: number): string {
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(0) + "K";
  return n.toFixed(0);
}
function fmtFull(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function V2WaelSales({ embedded }: { embedded?: boolean } = {}) {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const { selectedProjectId, setSelectedProjectId } = useProjectContext();

  // ─── DB Queries ─────────────────────────────────────────────────────────────
  const projectQuery = trpc.projects.getById.useQuery(selectedProjectId!, {
    enabled: !!selectedProjectId && !!user,
  });
  const plansQuery = trpc.waelSalesPlan.getByProject.useQuery(
    { projectId: selectedProjectId! },
    { enabled: !!selectedProjectId && !!user }
  );
  const updateProject = trpc.projects.update.useMutation({
    onSuccess: () => { projectQuery.refetch(); toast({ title: "تم حفظ التسعير ✓" }); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });
  const savePlan = trpc.waelSalesPlan.save.useMutation({
    onSuccess: () => { plansQuery.refetch(); toast({ title: "تم حفظ خطة المبيعات ✓" }); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  // ─── State: Unit Pricing (from DB) ──────────────────────────────────────────
  const [unitData, setUnitData] = useState<Record<string, { count: number; area: number; price: number }>>({});
  const [hasUnitChanges, setHasUnitChanges] = useState(false);

  // ─── State: Sales Plan ──────────────────────────────────────────────────────
  const [planId, setPlanId] = useState<number | undefined>(undefined);
  const [designMonths, setDesignMonths] = useState(8);
  const [constructionMonths, setConstructionMonths] = useState(30);
  const [projectStartDate, setProjectStartDate] = useState<string>(""); // e.g. "2026-08"
  const [marketingPrepLead, setMarketingPrepLead] = useState(3);
  const [reraLead, setReraLead] = useState(2);
  const [marketingPct, setMarketingPct] = useState(2);
  const [commissionPct, setCommissionPct] = useState(5);
  const [offPlan, setOffPlan] = useState(80);
  const [speed, setSpeed] = useState(50);
  const [curveTemplate, setCurveTemplate] = useState<"bell" | "fast" | "gradual" | "late">("bell");
  const [salesMode, setSalesMode] = useState<"auto" | "manual">("auto");
  const [manualUnits, setManualUnits] = useState<number[]>([]);

  const [hasPlanChanges, setHasPlanChanges] = useState(false);

  // ─── State: Payment Plan (installment-based) ──────────────────────────────
  const [ppDownPct, setPpDownPct] = useState(10); // دفعة أولى
  const [ppSecondPct, setPpSecondPct] = useState(10); // بعد شهر
  const [ppSecondAfterMonths, setPpSecondAfterMonths] = useState(1); // بعد كم شهر
  const [ppInstallmentPct, setPpInstallmentPct] = useState(10); // كل فترة
  const [ppInstallmentEvery, setPpInstallmentEvery] = useState(6); // كل كم شهر
  const [ppHandoverPct, setPpHandoverPct] = useState(40); // عند التسليم
  // Computed: installments during construction = 100 - down - second - handover
  const ppDuringTotal = 100 - ppDownPct - ppSecondPct - ppHandoverPct;
  const ppInstallmentCount = ppInstallmentPct > 0 ? Math.floor(ppDuringTotal / ppInstallmentPct) : 0;
  const ppTotal = ppDownPct + ppSecondPct + (ppInstallmentCount * ppInstallmentPct) + ppHandoverPct;
  // Legacy compat for escrow calc
  const downPaymentPct = ppDownPct;
  const duringConstructionPct = 100 - ppDownPct - ppHandoverPct;
  const onHandoverPct = ppHandoverPct;

  // ─── Load data from DB ──────────────────────────────────────────────────────
  useEffect(() => {
    if (projectQuery.data) {
      const p = projectQuery.data as any;
      const newData: Record<string, { count: number; area: number; price: number }> = {};
      UNIT_TYPES.forEach((u) => {
        newData[u.id] = {
          count: Number(p[u.dbCount]) || 0,
          area: Number(p[u.dbArea]) || 0,
          price: Number(p[u.dbPrice]) || 0,
        };
      });
      setUnitData(newData);
      setHasUnitChanges(false);
      if (p.preConMonths) setDesignMonths(Number(p.preConMonths));
      if (p.constructionMonths) setConstructionMonths(Number(p.constructionMonths));
      if (p.startDate) setProjectStartDate(String(p.startDate));
      if (p.marketingPct) setMarketingPct(Number(p.marketingPct));
      if (p.salesCommissionPct) setCommissionPct(Number(p.salesCommissionPct));
    }
  }, [projectQuery.data]);

  useEffect(() => {
    if (plansQuery.data && plansQuery.data.length > 0) {
      const plan = plansQuery.data[0] as any;
      setPlanId(plan.id);
      if (plan.offplanPct) setOffPlan(plan.offplanPct);

      if (plan.salesAbsorptionJson) {
        try {
          const parsed = JSON.parse(plan.salesAbsorptionJson);
          if (parsed.mode) setSalesMode(parsed.mode);
          if (parsed.speed) setSpeed(parsed.speed);
          if (parsed.template) setCurveTemplate(parsed.template);
          if (parsed.manual) setManualUnits(parsed.manual);
          if (parsed.marketingPrepLead) setMarketingPrepLead(parsed.marketingPrepLead);
          if (parsed.reraLead) setReraLead(parsed.reraLead);
          if (parsed.ppDownPct) setPpDownPct(parsed.ppDownPct);
          if (parsed.ppSecondPct) setPpSecondPct(parsed.ppSecondPct);
          if (parsed.ppSecondAfterMonths) setPpSecondAfterMonths(parsed.ppSecondAfterMonths);
          if (parsed.ppInstallmentPct) setPpInstallmentPct(parsed.ppInstallmentPct);
          if (parsed.ppInstallmentEvery) setPpInstallmentEvery(parsed.ppInstallmentEvery);
          if (parsed.ppHandoverPct) setPpHandoverPct(parsed.ppHandoverPct);
        } catch {}
      }
      setHasPlanChanges(false);
    }
  }, [plansQuery.data]);

  // ─── Computed: Revenue ────────────────────────────────────────────────────
  const unitRevenues = useMemo(
    () => UNIT_TYPES.map((u) => {
      const d = unitData[u.id] || { count: 0, area: 0, price: 0 };
      return { ...u, count: d.count, area: d.area, price: d.price, total: d.count * d.area * d.price, totalArea: d.count * d.area };
    }),
    [unitData]
  );
  const totalRevenue = unitRevenues.reduce((s, u) => s + u.total, 0);
  const totalUnits = unitRevenues.reduce((s, u) => s + u.count, 0);
  const totalArea = unitRevenues.reduce((s, u) => s + u.totalArea, 0);

  // ─── Computed: Full Costs from Feasibility ─────────────────────────────────
  const constructionCostPerSqft = projectQuery.data ? Number((projectQuery.data as any).estimatedConstructionPricePerSqft) || 400 : 400;
  const constructionCost = totalArea * constructionCostPerSqft;
  const marketingCost = totalRevenue * (marketingPct / 100);
  const commissionCost = totalRevenue * (commissionPct / 100);

  // Full project costs using the same model as ProjectCard/Feasibility
  const fullCosts = useMemo(() => {
    if (!projectQuery.data) return null;
    const p = projectQuery.data as any;
    const inputs = dbProjectToInputs(p);
    const rates = dbProjectToRates(p);
    const projectFormulas = calculateProjectFormulas(inputs, rates);
    // Build pricing units from current unitRevenues
    const pricingUnits = unitRevenues.map(u => ({
      name: u.name,
      category: u.id.startsWith('residential') ? 'residential' as const : u.id.startsWith('retail') ? 'retail' as const : 'office' as const,
      area: u.area,
      price: u.price,
      count: u.count,
    }));
    const pricingFormulas = calculatePricingFormulas(pricingUnits);
    const costs = calculateCosts(projectFormulas, pricingFormulas, inputs, rates);
    return costs;
  }, [projectQuery.data, unitRevenues]);

  const totalCosts = fullCosts ? fullCosts.totalCosts : (constructionCost + marketingCost + commissionCost);
  const profit = totalRevenue - totalCosts;
  const roiCosts = totalCosts > 0 ? ((profit / totalCosts) * 100).toFixed(0) : "0";

  // ─── Computed: Timeline ───────────────────────────────────────────────────
  const timeline = useMemo(() => {
    const designEnd = designMonths;
    const materialsStart = Math.max(1, designEnd - marketingPrepLead);
    const salesStart = designEnd - 1;
    const reraStart = Math.max(1, salesStart - reraLead);
    const marketingStart = Math.max(1, materialsStart + 1);
    const constructionStart = designEnd + 1;
    const projectEnd = constructionStart + constructionMonths - 1;
    return { designEnd, materialsStart, reraStart, marketingStart, salesStart, constructionStart, projectEnd };
  }, [designMonths, constructionMonths, marketingPrepLead, reraLead]);
  const salesMonths = timeline.projectEnd - timeline.salesStart + 1;

  // ─── Computed: Sales Distribution ─────────────────────────────────────────
  const offPlanUnits = Math.round((totalUnits * offPlan) / 100);
  const salesDistribution = useMemo(() => {
    if (salesMode === "manual" && manualUnits.length === salesMonths) return manualUnits;
    const n = salesMonths;
    if (n <= 0) return [];
    let raw: number[];
    if (curveTemplate === "fast") {
      raw = Array.from({ length: n }, (_, i) => Math.exp(-i / (n * 0.3)));
    } else if (curveTemplate === "gradual") {
      raw = Array.from({ length: n }, (_, i) => 1 + i * 0.5);
    } else if (curveTemplate === "late") {
      raw = Array.from({ length: n }, (_, i) => Math.exp(-(n - 1 - i) / (n * 0.3)));
    } else {
      const mid = n * (1 - speed / 100) + (n / 2) * (speed / 100);
      const sigma = n / (3 + (speed / 100) * 3);
      raw = Array.from({ length: n }, (_, i) => Math.exp(-0.5 * Math.pow((i - mid + n / 2) / sigma, 2)));
    }
    const sum = raw.reduce((a, b) => a + b, 0);
    const scaled = raw.map((v) => Math.max(1, Math.round((v / sum) * offPlanUnits)));
    const diff = offPlanUnits - scaled.reduce((a, b) => a + b, 0);
    if (diff !== 0 && scaled.length > 0) scaled[Math.floor(n / 2)] += diff;
    return scaled;
  }, [salesMonths, offPlanUnits, speed, salesMode, manualUnits, curveTemplate]);
  const totalSold = salesDistribution.reduce((a, b) => a + b, 0);
  const avgUnitPrice = totalUnits > 0 ? totalRevenue / totalUnits : 0;

  // ─── Computed: Escrow with Payment Plan ────────────────────────────────────
  const escrowInitial = constructionCost * 0.2;
  const monthlySiphon = salesMonths > 0 ? constructionCost / salesMonths : 0;
  const escrowData = useMemo(() => {
    let balance = escrowInitial;
    // Each unit sold: buyer pays downPaymentPct immediately, duringConstructionPct spread over construction months
    const monthlyInstallmentPerUnit = avgUnitPrice * (duringConstructionPct / 100) / (constructionMonths || 1);
    // Track cumulative sold units for ongoing installments
    let cumulativeSold = 0;
    return salesDistribution.map((units, i) => {
      // New sales this month: down payment goes to escrow
      const downPaymentIncome = units * avgUnitPrice * (downPaymentPct / 100);
      // Ongoing installments from all previously sold units
      cumulativeSold += units;
      const installmentIncome = cumulativeSold * monthlyInstallmentPerUnit;
      const totalIncome = downPaymentIncome + installmentIncome;
      const withdrawal = monthlySiphon;
      balance = balance + totalIncome - withdrawal;
      return { month: i + timeline.salesStart, units, income: totalIncome, downPayment: downPaymentIncome, installments: installmentIncome, withdrawal, balance, cumulativeSold };
    });
  }, [salesDistribution, escrowInitial, avgUnitPrice, monthlySiphon, timeline.salesStart, constructionCost, downPaymentPct, duringConstructionPct, constructionMonths]);
  const maxDeficit = escrowData.length > 0 ? Math.min(...escrowData.map((d) => d.balance)) : 0;
  const hasDeficit = maxDeficit < 0;
  const criticalMonth = useMemo(() => {
    if (escrowData.length === 0) return null;
    let minBalance = Infinity;
    let minIdx = 0;
    escrowData.forEach((d, i) => { if (d.balance < minBalance) { minBalance = d.balance; minIdx = i; } });
    return escrowData[minIdx];
  }, [escrowData]);

  // ─── Computed: Cash Inflow (Payment Plan × Sales) + Detailed Grid ────────
  const { cashInflowData, perSaleGrid, activeSaleMonths } = useMemo(() => {
    const totalMonths = timeline.projectEnd;
    const monthlySales: number[] = Array(totalMonths + 1).fill(0);
    salesDistribution.forEach((units, i) => {
      const m = timeline.salesStart + i;
      if (m <= totalMonths) monthlySales[m] = units * avgUnitPrice;
    });
    const cashPerMonth: number[] = Array(totalMonths + 24).fill(0);
    const grid: Record<number, number[]> = {};
    const saleMonthsList: number[] = [];
    for (let saleMonth = 1; saleMonth <= totalMonths; saleMonth++) {
      const saleAmount = monthlySales[saleMonth];
      if (saleAmount <= 0) continue;
      saleMonthsList.push(saleMonth);
      grid[saleMonth] = Array(totalMonths + 1).fill(0);
      const downAmount = saleAmount * (ppDownPct / 100);
      if (saleMonth < cashPerMonth.length) { cashPerMonth[saleMonth] += downAmount; grid[saleMonth][saleMonth] += downAmount; }
      const secondAmount = saleAmount * (ppSecondPct / 100);
      const secondMonth = saleMonth + ppSecondAfterMonths;
      if (secondMonth < cashPerMonth.length) { cashPerMonth[secondMonth] += secondAmount; if (secondMonth <= totalMonths) grid[saleMonth][secondMonth] += secondAmount; }
      const installmentTotal = saleAmount * (ppDuringTotal / 100);
      const constructionEnd = timeline.constructionStart + constructionMonths - 1;
      const installmentMonthsList: number[] = [];
      for (let im = saleMonth + ppInstallmentEvery + ppSecondAfterMonths; im <= constructionEnd; im += ppInstallmentEvery) installmentMonthsList.push(im);
      if (installmentMonthsList.length > 0) {
        const perInstallment = installmentTotal / installmentMonthsList.length;
        installmentMonthsList.forEach(im => { if (im < cashPerMonth.length) { cashPerMonth[im] += perInstallment; if (im <= totalMonths) grid[saleMonth][im] += perInstallment; } });
      } else {
        const ce = Math.min(constructionEnd, totalMonths);
        cashPerMonth[ce] += installmentTotal;
        grid[saleMonth][ce] += installmentTotal;
      }
      const handoverAmount = saleAmount * (ppHandoverPct / 100);
      const handoverMonth = Math.min(timeline.constructionStart + constructionMonths - 1, totalMonths);
      if (handoverMonth < cashPerMonth.length) { cashPerMonth[handoverMonth] += handoverAmount; if (handoverMonth <= totalMonths) grid[saleMonth][handoverMonth] += handoverAmount; }
    }
    const data: { month: number; salesThisMonth: number; cashInflow: number; cumSales: number; cumCash: number }[] = [];
    let cumSales = 0, cumCash = 0;
    for (let m = 1; m <= totalMonths; m++) {
      cumSales += monthlySales[m]; cumCash += cashPerMonth[m];
      data.push({ month: m, salesThisMonth: monthlySales[m], cashInflow: cashPerMonth[m], cumSales, cumCash });
    }
    return { cashInflowData: data, perSaleGrid: grid, activeSaleMonths: saleMonthsList };
  }, [salesDistribution, avgUnitPrice, timeline, constructionMonths, ppDownPct, ppSecondPct, ppSecondAfterMonths, ppDuringTotal, ppInstallmentEvery, ppHandoverPct]);

  // ─── Save Handlers ────────────────────────────────────────────────────────
  const handleSaveUnits = useCallback(() => {
    if (!selectedProjectId) return;
    const payload: Record<string, any> = { id: selectedProjectId };
    UNIT_TYPES.forEach((u) => {
      const d = unitData[u.id];
      if (d) { payload[u.dbCount] = d.count; payload[u.dbArea] = d.area; payload[u.dbPrice] = d.price; }
    });
    payload.salesCommissionPct = String(commissionPct);
    updateProject.mutate(payload as any);
    setHasUnitChanges(false);
  }, [selectedProjectId, unitData, commissionPct, updateProject]);

  const handleSavePlan = useCallback(() => {
    if (!selectedProjectId) return;
    savePlan.mutate({
      id: planId,
      projectId: selectedProjectId,
      totalRevenue,
      designMonths,
      constructionMonths,
      offplanPct: offPlan,
      salesCommissionPct: String(commissionPct),
      salesAbsorptionJson: JSON.stringify({ mode: salesMode, speed, template: curveTemplate, manual: manualUnits, marketingPrepLead, reraLead, ppDownPct, ppSecondPct, ppSecondAfterMonths, ppInstallmentPct, ppInstallmentEvery, ppHandoverPct }),
      resultsJson: JSON.stringify({ escrowData, salesDistribution }),
    });
    setHasPlanChanges(false);
  }, [selectedProjectId, planId, totalRevenue, designMonths, constructionMonths, offPlan, commissionPct, salesMode, speed, curveTemplate, manualUnits, escrowData, salesDistribution, marketingPrepLead, reraLead, savePlan]);

  const updateUnit = (id: string, field: "count" | "area" | "price", value: number) => {
    setUnitData((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
    setHasUnitChanges(true);
  };

  // ═══════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════════
  return (
    <div className="bg-gray-50 p-2" dir="rtl">
      <div className="max-w-full mx-auto space-y-2">
        {/* ═══ HEADER ═══ */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div>
              <h1 className="text-xs font-bold text-gray-900 flex items-center gap-1">
                <Target className="w-3 h-3 text-emerald-600" />
                المبيعات والتسويق
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ProjectSelector selectedId={selectedProjectId} onSelect={(id) => setSelectedProjectId(id)} />
            {hasUnitChanges && (
              <Button size="sm" onClick={handleSaveUnits} disabled={updateProject.isPending} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
                {updateProject.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                حفظ التسعير
              </Button>
            )}
            {hasPlanChanges && (
              <Button size="sm" onClick={handleSavePlan} disabled={savePlan.isPending} className="gap-1.5 bg-blue-600 hover:bg-blue-700">
                {savePlan.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                حفظ الخطة
              </Button>
            )}
          </div>
        </div>

        {/* No project selected */}
        {!selectedProjectId && (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <Building2 className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">اختر مشروعاً من القائمة أعلاه لبدء العمل</p>
            </CardContent>
          </Card>
        )}

        {/* Loading */}
        {selectedProjectId && projectQuery.isLoading && (
          <Card><CardContent className="py-12 text-center"><Loader2 className="w-8 h-8 mx-auto animate-spin text-blue-600" /><p className="text-gray-500 mt-2">جاري تحميل البيانات...</p></CardContent></Card>
        )}

        {/* Main Content */}
        {selectedProjectId && !projectQuery.isLoading && projectQuery.data && (
          <>
            {/* SECTION 1: PRICING + PAYMENT PLAN SIDE BY SIDE */}
            <div className="grid grid-cols-3 gap-2">
            {/* Pricing Table - 2/3 */}
            <section className="col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                  <h2 className="text-[11px] font-bold text-gray-800">جدول التسعير</h2>
                  <Badge variant="secondary" className="text-[9px]">{totalUnits} وحدة</Badge>
                </div>
                <p className="text-[10px] text-gray-500">الإيرادات: <span className="font-bold text-emerald-700">{fmt(totalRevenue)} AED</span></p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-2 py-1 text-right font-medium text-gray-600">النوع</th>
                      <th className="px-2 py-1 text-center font-medium text-gray-600">العدد</th>
                      <th className="px-2 py-1 text-center font-medium text-gray-600">المساحة (قدم²)</th>
                      <th className="px-2 py-1 text-center font-medium text-gray-600">سعر/قدم (AED)</th>
                      <th className="px-2 py-1 text-center font-medium text-gray-600">إجمالي المساحة</th>
                      <th className="px-2 py-1 text-center font-medium text-gray-600">إجمالي الإيراد</th>
                      <th className="px-2 py-1 text-center font-medium text-gray-600">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* سكني */}
                    <tr><td colSpan={7} className="px-2 py-0.5 text-[10px] font-bold text-blue-700 bg-blue-50/60 border-b border-blue-100">سكني</td></tr>
                    {unitRevenues.filter(u => u.id.startsWith('residential')).map((u) => (
                      <tr key={u.id} className="border-t border-gray-50 hover:bg-gray-50/50">
                        <td className="px-2 py-0.5">
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: u.color }} />
                            <span className="font-medium text-gray-800">{u.name}</span>
                          </div>
                        </td>
                        <td className="px-2 py-0.5 text-center font-mono text-gray-700">{u.count}</td>
                        <td className="px-2 py-0.5 text-center font-mono text-gray-700">{fmtFull(u.area)}</td>
                        <td className="px-2 py-0.5 text-center">
                          <input type="number" min={0} value={u.price} onChange={(e) => updateUnit(u.id, "price", parseInt(e.target.value) || 0)}
                            className="w-14 h-5 text-center text-[11px] border border-gray-200 rounded bg-white focus:border-blue-400 focus:ring-1 focus:ring-blue-200" />
                        </td>
                        <td className="px-2 py-0.5 text-center font-mono text-gray-700">{fmtFull(u.totalArea)}</td>
                        <td className="px-2 py-0.5 text-center font-mono font-medium text-emerald-700">{fmt(u.total)}</td>
                        <td className="px-2 py-0.5 text-center text-gray-500">{totalRevenue > 0 ? ((u.total / totalRevenue) * 100).toFixed(1) : 0}%</td>
                      </tr>
                    ))}
                    {/* تجزئة */}
                    <tr><td colSpan={7} className="px-2 py-0.5 text-[10px] font-bold text-orange-700 bg-orange-50/60 border-b border-orange-100">تجزئة</td></tr>
                    {unitRevenues.filter(u => u.id.startsWith('retail')).map((u) => (
                      <tr key={u.id} className="border-t border-gray-50 hover:bg-gray-50/50">
                        <td className="px-2 py-0.5">
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: u.color }} />
                            <span className="font-medium text-gray-800">{u.name}</span>
                          </div>
                        </td>
                        <td className="px-2 py-0.5 text-center font-mono text-gray-700">{u.count}</td>
                        <td className="px-2 py-0.5 text-center font-mono text-gray-700">{fmtFull(u.area)}</td>
                        <td className="px-2 py-0.5 text-center">
                          <input type="number" min={0} value={u.price} onChange={(e) => updateUnit(u.id, "price", parseInt(e.target.value) || 0)}
                            className="w-14 h-5 text-center text-[11px] border border-gray-200 rounded bg-white focus:border-blue-400 focus:ring-1 focus:ring-blue-200" />
                        </td>
                        <td className="px-2 py-0.5 text-center font-mono text-gray-700">{fmtFull(u.totalArea)}</td>
                        <td className="px-2 py-0.5 text-center font-mono font-medium text-emerald-700">{fmt(u.total)}</td>
                        <td className="px-2 py-0.5 text-center text-gray-500">{totalRevenue > 0 ? ((u.total / totalRevenue) * 100).toFixed(1) : 0}%</td>
                      </tr>
                    ))}
                    {/* مكاتب */}
                    <tr><td colSpan={7} className="px-2 py-0.5 text-[10px] font-bold text-teal-700 bg-teal-50/60 border-b border-teal-100">مكاتب</td></tr>
                    {unitRevenues.filter(u => u.id.startsWith('office')).map((u) => (
                      <tr key={u.id} className="border-t border-gray-50 hover:bg-gray-50/50">
                        <td className="px-2 py-0.5">
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: u.color }} />
                            <span className="font-medium text-gray-800">{u.name}</span>
                          </div>
                        </td>
                        <td className="px-2 py-0.5 text-center font-mono text-gray-700">{u.count}</td>
                        <td className="px-2 py-0.5 text-center font-mono text-gray-700">{fmtFull(u.area)}</td>
                        <td className="px-2 py-0.5 text-center">
                          <input type="number" min={0} value={u.price} onChange={(e) => updateUnit(u.id, "price", parseInt(e.target.value) || 0)}
                            className="w-14 h-5 text-center text-[11px] border border-gray-200 rounded bg-white focus:border-blue-400 focus:ring-1 focus:ring-blue-200" />
                        </td>
                        <td className="px-2 py-0.5 text-center font-mono text-gray-700">{fmtFull(u.totalArea)}</td>
                        <td className="px-2 py-0.5 text-center font-mono font-medium text-emerald-700">{fmt(u.total)}</td>
                        <td className="px-2 py-0.5 text-center text-gray-500">{totalRevenue > 0 ? ((u.total / totalRevenue) * 100).toFixed(1) : 0}%</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-teal-50 border-t-2 border-teal-200">
                    <tr>
                      <td className="px-2 py-1 font-bold text-teal-800">المجموع</td>
                      <td className="px-2 py-1 text-center font-bold text-teal-800">{totalUnits}</td>
                      <td className="px-2 py-1" />
                      <td className="px-2 py-1" />
                      <td className="px-2 py-1 text-center font-mono font-bold text-teal-800">{fmtFull(totalArea)}</td>
                      <td className="px-2 py-1 text-center font-mono font-bold text-teal-800">{fmt(totalRevenue)}</td>
                      <td className="px-2 py-1 text-center font-bold text-teal-800">100%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>

            {/* Payment Plan - 1/3 */}
            <section className="col-span-1 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-indigo-600" />
                <h2 className="text-[11px] font-bold text-gray-800">خطة الدفع</h2>
                <Badge variant={ppTotal === 100 ? "secondary" : "destructive"} className="text-[9px]">{ppTotal}%</Badge>
              </div>
              <div className="p-2">
                <table className="w-full text-[9px]">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-1 py-0.5 text-right font-bold">البند</th>
                      <th className="px-1 py-0.5 text-center font-bold">%</th>
                      <th className="px-1 py-0.5 text-center font-bold">التوقيت</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-gray-100">
                      <td className="px-1 py-0.5 text-right">دفعة أولى</td>
                      <td className="px-1 py-0.5 text-center"><input type="number" min={5} max={30} value={ppDownPct} onChange={(e) => { setPpDownPct(+e.target.value); setHasPlanChanges(true); }} className="w-8 h-4 text-center text-[9px] font-bold border border-gray-200 rounded bg-white" />%</td>
                      <td className="px-1 py-0.5 text-center text-gray-500">عند التوقيع</td>
                    </tr>
                    <tr className="border-t border-gray-100">
                      <td className="px-1 py-0.5 text-right">دفعة ثانية</td>
                      <td className="px-1 py-0.5 text-center"><input type="number" min={5} max={20} value={ppSecondPct} onChange={(e) => { setPpSecondPct(+e.target.value); setHasPlanChanges(true); }} className="w-8 h-4 text-center text-[9px] font-bold border border-gray-200 rounded bg-white" />%</td>
                      <td className="px-1 py-0.5 text-center">بعد <input type="number" min={1} max={6} value={ppSecondAfterMonths} onChange={(e) => { setPpSecondAfterMonths(+e.target.value); setHasPlanChanges(true); }} className="w-6 h-4 text-center text-[9px] font-bold border border-gray-200 rounded bg-white mx-0.5" />شهر</td>
                    </tr>
                    <tr className="border-t border-gray-100 bg-blue-50">
                      <td className="px-1 py-0.5 text-right">أقساط ({ppInstallmentCount})</td>
                      <td className="px-1 py-0.5 text-center"><input type="number" min={5} max={20} value={ppInstallmentPct} onChange={(e) => { setPpInstallmentPct(+e.target.value); setHasPlanChanges(true); }} className="w-8 h-4 text-center text-[9px] font-bold border border-gray-200 rounded bg-white" />%</td>
                      <td className="px-1 py-0.5 text-center">كل <input type="number" min={2} max={12} value={ppInstallmentEvery} onChange={(e) => { setPpInstallmentEvery(+e.target.value); setHasPlanChanges(true); }} className="w-6 h-4 text-center text-[9px] font-bold border border-gray-200 rounded bg-white mx-0.5" />شهر</td>
                    </tr>
                    <tr className="border-t border-gray-100 bg-emerald-50">
                      <td className="px-1 py-0.5 text-right font-bold">عند التسليم</td>
                      <td className="px-1 py-0.5 text-center"><input type="number" min={10} max={60} value={ppHandoverPct} onChange={(e) => { setPpHandoverPct(+e.target.value); setHasPlanChanges(true); }} className="w-8 h-4 text-center text-[9px] font-bold border border-gray-200 rounded bg-white" />%</td>
                      <td className="px-1 py-0.5 text-center text-gray-500">عند الاكتمال</td>
                    </tr>
                    <tr className="border-t-2 border-gray-300 bg-gray-100">
                      <td className="px-1 py-0.5 text-right font-bold">الإجمالي</td>
                      <td className={`px-1 py-0.5 text-center font-bold ${ppTotal === 100 ? 'text-emerald-700' : 'text-red-700'}`}>{ppTotal}%</td>
                      <td className="px-1 py-0.5 text-center text-[8px] text-gray-500">{fmtFull(Math.round(avgUnitPrice))} / وحدة</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
            </div>

            {/* SECTION 2: FINANCIAL SUMMARY */}
            <section className="grid grid-cols-2 md:grid-cols-6 gap-3">
              <KPICard label="الإيرادات" value={fmt(totalRevenue)} sub="AED" color="emerald" />
              <KPICard label="تكلفة المشروع" value={fmt(totalCosts)} sub="كل التكاليف" color="slate" />
              <KPICard label="التسويق" value={fmt(marketingCost)} sub={`${marketingPct}%`} color="amber" />
              <KPICard label="العمولة" value={fmt(commissionCost)} sub={`${commissionPct}%`} color="amber" />
              <KPICard label="الربح" value={fmt(profit)} sub="AED" color={profit >= 0 ? "blue" : "red"} />
              <KPICard label="ROI" value={roiCosts + "%"} sub="على التكاليف" color="violet" />
            </section>

            {/* SECTION 3: COMMISSION + OFF-PLAN CONTROLS */}
            <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-3">
              <h3 className="text-[11px] font-bold text-gray-800 flex items-center gap-1.5 mb-2">
                <Percent className="w-3.5 h-3.5 text-amber-600" />
                إعدادات المبيعات
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-600">عمولة المبيعات</span>
                    <span className="text-[10px] font-bold text-purple-700">{commissionPct}%</span>
                  </div>
                  <Slider value={[commissionPct]} onValueChange={([v]) => { setCommissionPct(v); setHasUnitChanges(true); setHasPlanChanges(true); }} min={0} max={10} step={0.5} className="w-full" />
                  <p className="text-[9px] text-gray-400">{fmtFull(Math.round(commissionCost))} AED</p>
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-600">نسبة البيع على الخارطة</span>
                    <span className="text-[10px] font-bold text-emerald-700">{offPlan}%</span>
                  </div>
                  <Slider value={[offPlan]} onValueChange={([v]) => { setOffPlan(v); setHasPlanChanges(true); }} min={30} max={100} step={5} className="w-full" />
                  <p className="text-[9px] text-gray-400">{offPlanUnits} وحدة من {totalUnits}</p>
                </div>
              </div>
            </section>

            {/* SECTION 4: PROJECT PHASES TIMELINE */}
            <section className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-3 py-2 border-b border-gray-100">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-blue-600" />
                    <h2 className="text-[11px] font-bold text-gray-800">الجدول الزمني</h2>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-gray-500">تصاميم:</span>
                      <span className="text-[10px] font-bold text-blue-700">{designMonths} شهر</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-gray-500">إنشاء:</span>
                      <span className="text-[10px] font-bold text-emerald-700">{constructionMonths} شهر</span>
                    </div>
                  </div>
                </div>
                {/* Month headers: actual month name (bold) + small phase-relative number */}
                <div className="flex items-center gap-2">
                  <div className="w-32 flex-shrink-0" />
                  <div className="flex-1 flex">
                    {Array.from({ length: timeline.projectEnd }, (_, i) => {
                      const isDesign = i < designMonths;
                      const displayNum = isDesign ? i + 1 : i - designMonths + 1;
                      // Calculate actual month name from startDate
                      const MONTH_NAMES_AR = ["ينا", "فبر", "مار", "أبر", "ماي", "يون", "يول", "أغس", "سبت", "أكت", "نوف", "ديس"];
                      let monthLabel = "";
                      if (projectStartDate) {
                        const [y, m] = projectStartDate.split("-").map(Number);
                        if (y && m) {
                          const idx = (m - 1 + i) % 12;
                          monthLabel = MONTH_NAMES_AR[idx];
                        }
                      }
                      return (
                        <div key={i} className="flex-1 text-center flex flex-col items-center leading-none" style={{ borderLeft: i > 0 ? '1px solid rgba(0,0,0,0.06)' : 'none' }}>
                          <span className={`text-[7px] ${isDesign ? 'text-blue-400' : 'text-emerald-400'}`}>{displayNum}</span>
                          <span className={`text-[7px] font-bold ${isDesign ? 'text-blue-700' : 'text-emerald-700'}`}>{monthLabel || displayNum}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="p-2">
                <div className="space-y-1.5">
                  {PROJECT_PHASES.map((phase) => {
                    let start = 0, end = 0;
                    if (phase.id === "design") { start = 1; end = timeline.designEnd; }
                    else if (phase.id === "materials") { start = timeline.materialsStart; end = timeline.materialsStart + 2; }
                    else if (phase.id === "rera") { start = timeline.reraStart; end = timeline.reraStart + 1; }
                    else if (phase.id === "marketing") { start = timeline.marketingStart; end = timeline.projectEnd; }
                    else if (phase.id === "sales") { start = timeline.salesStart; end = timeline.projectEnd; }
                    else if (phase.id === "construction") { start = timeline.constructionStart; end = timeline.projectEnd; }
                    const total = timeline.projectEnd;
                    const rightPct = ((start - 1) / total) * 100;
                    const widthPct = ((end - start + 1) / total) * 100;
                    const Icon = phase.icon;
                    return (
                      <div key={phase.id} className="flex items-center gap-2">
                        <div className="w-32 flex items-center gap-1.5 flex-shrink-0">
                          <Icon className="w-3 h-3" style={{ color: phase.color }} />
                          <span className="text-[10px] font-medium text-gray-700 truncate">{phase.name}</span>
                        </div>
                        <div className="flex-1 h-5 bg-gray-100 rounded-full relative overflow-hidden" style={{ backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent calc(100% / ' + timeline.projectEnd + ' - 1px), rgba(0,0,0,0.04) calc(100% / ' + timeline.projectEnd + ' - 1px), rgba(0,0,0,0.04) calc(100% / ' + timeline.projectEnd + '))' }}>
                          <div className="absolute h-full rounded-full transition-all" style={{ right: `${rightPct}%`, width: `${widthPct}%`, backgroundColor: phase.color, opacity: 0.8 }} />
                          <span className="absolute inset-0 flex items-center justify-center text-[8px] font-medium text-gray-700">شهر {start} - {end}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2 flex-wrap text-[10px] text-gray-500">
                  <span>نقطة الانطلاق (اكتمال المخططات التخطيطية): <strong className="text-gray-800">شهر {designMonths - marketingPrepLead}</strong></span>
                  <span>مدة تحضير المواد: <strong className="text-gray-800">{marketingPrepLead} شهر</strong></span>
                  <span>مدة ريرا: <strong className="text-gray-800">{reraLead} شهر</strong></span>
                </div>
              </div>
            </section>

            {/* SECTION 5: SALES INPUT (Manual - aligned to escrow range) */}
            <section className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
                  <h2 className="text-[11px] font-bold text-gray-800">توزيع البيع</h2>
                  <Badge variant="secondary" className="text-[10px]">{totalSold} / {offPlanUnits} وحدة</Badge>
                  {totalSold > offPlanUnits && <Badge variant="destructive" className="text-[9px]">تجاوز!</Badge>}
                </div>
              </div>
              <div className="p-2 overflow-x-auto">
                {(() => {
                  const escrowStartMonth = timeline.reraStart + 1;
                  const escrowEndMonth = timeline.projectEnd;
                  const escrowMonthCount = escrowEndMonth - escrowStartMonth + 1;
                  const colWidth = `minmax(42px, 1fr)`;
                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: `60px repeat(${escrowMonthCount}, ${colWidth})`, direction: 'rtl' }}>
                      {/* Row 1: Month labels */}
                      <div className="text-[8px] font-bold text-gray-500 flex items-center justify-center border-b border-gray-200 py-0.5">الشهر</div>
                      {Array.from({ length: escrowMonthCount }, (_, i) => {
                        const absMonth = escrowStartMonth + i;
                        const isDesign = absMonth <= timeline.designEnd;
                        const displayNum = isDesign ? absMonth : absMonth - timeline.designEnd;
                        return (
                          <div key={i} className={`text-center text-[8px] font-bold py-0.5 border-b border-l border-gray-200 ${isDesign ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'}`}>
                            {displayNum}
                          </div>
                        );
                      })}
                      {/* Row 2: Unit inputs */}
                      <div className="text-[8px] font-bold text-gray-500 flex items-center justify-center border-b border-gray-200 py-0.5">وحدات</div>
                      {Array.from({ length: escrowMonthCount }, (_, i) => {
                        const absMonth = escrowStartMonth + i;
                        const salesIdx = absMonth - timeline.salesStart;
                        const inSalesRange = salesIdx >= 0 && salesIdx < salesMonths;
                        const val = inSalesRange ? (manualUnits[salesIdx] ?? salesDistribution[salesIdx] ?? 0) : 0;
                        return (
                          <div key={i} className="flex items-center justify-center border-b border-l border-gray-200 py-0.5">
                            {inSalesRange ? (
                              <input
                                type="number" min={0} max={50} value={val}
                                onChange={(e) => {
                                  const arr = [...(manualUnits.length === salesMonths ? manualUnits : salesDistribution)];
                                  arr[salesIdx] = Math.max(0, +e.target.value);
                                  setManualUnits(arr);
                                  setSalesMode("manual");
                                  setHasPlanChanges(true);
                                }}
                                className="w-8 h-5 text-center text-[10px] font-bold border border-gray-200 rounded bg-white focus:ring-1 focus:ring-emerald-200 outline-none"
                              />
                            ) : (
                              <span className="text-[8px] text-gray-300">-</span>
                            )}
                          </div>
                        );
                      })}
                      {/* Row 3: Percentages (bold) */}
                      <div className="text-[8px] font-bold text-gray-500 flex items-center justify-center py-0.5">%</div>
                      {Array.from({ length: escrowMonthCount }, (_, i) => {
                        const absMonth = escrowStartMonth + i;
                        const salesIdx = absMonth - timeline.salesStart;
                        const inSalesRange = salesIdx >= 0 && salesIdx < salesMonths;
                        const val = inSalesRange ? (manualUnits[salesIdx] ?? salesDistribution[salesIdx] ?? 0) : 0;
                        const pct = offPlanUnits > 0 ? ((val / offPlanUnits) * 100).toFixed(0) : '0';
                        return (
                          <div key={i} className="text-center text-[9px] font-black text-gray-800 py-0.5 border-l border-gray-200">
                            {inSalesRange ? `${pct}%` : '-'}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </section>

            {/* SECTION 7: ESCROW (GUARANTEE ACCOUNT) */}
            <section className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-violet-600" />
                  <h2 className="text-[11px] font-bold text-gray-800">حساب الضمان (Escrow)</h2>
                  {hasDeficit && <Badge variant="destructive" className="text-[10px]">عجز: {fmt(Math.abs(maxDeficit))} AED</Badge>}
                  {!hasDeficit && <Badge className="text-[10px] bg-emerald-100 text-emerald-700">متوازن</Badge>}
                </div>
                <div className="flex items-center gap-3">
                  {criticalMonth && (
                    <span className={`text-[10px] font-bold ${criticalMonth.balance < 0 ? 'text-red-600' : 'text-amber-600'}`}>
                      ⚠️ الشهر الحرج: {criticalMonth.month} | رصيد: {fmt(criticalMonth.balance)}
                    </span>
                  )}
                  <span className="text-[10px] text-gray-500">رصيد افتتاحي: {fmt(escrowInitial)}</span>
                </div>
              </div>
              <div className="p-2 overflow-x-auto">
                {/* Escrow start = reraStart + 1 (second month of rera), end = projectEnd */}
                {(() => {
                  const escrowStartMonth = timeline.reraStart + 1;
                  const escrowEndMonth = timeline.projectEnd;
                  const escrowMonthCount = escrowEndMonth - escrowStartMonth + 1;
                  const colWidth = `minmax(42px, 1fr)`;
                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: `60px repeat(${escrowMonthCount}, ${colWidth})`, direction: 'rtl' }}>
                      {/* Row 1: Month number boxes */}
                      <div className="text-[8px] font-bold text-gray-500 flex items-center justify-center border-b border-gray-200 py-0.5">الشهر</div>
                      {Array.from({ length: escrowMonthCount }, (_, i) => {
                        const absMonth = escrowStartMonth + i;
                        const isDesign = absMonth <= timeline.designEnd;
                        const displayNum = isDesign ? absMonth : absMonth - timeline.designEnd;
                        const isCritical = criticalMonth && absMonth === criticalMonth.month;
                        return (
                          <div key={i} className={`text-center text-[8px] font-bold py-0.5 border-b border-l border-gray-200 ${isCritical ? 'bg-red-100 text-red-700' : isDesign ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'}`}>
                            {displayNum}
                          </div>
                        );
                      })}

                      {/* Row 2: Chart (bar chart inline) */}
                      <div className="text-[8px] font-bold text-gray-500 flex items-center justify-center border-b border-gray-200 py-0.5">الرصيد</div>
                      {Array.from({ length: escrowMonthCount }, (_, i) => {
                        const absMonth = escrowStartMonth + i;
                        const ed = escrowData.find(d => d.month === absMonth);
                        const balance = ed ? ed.balance : (i === 0 ? escrowInitial : 0);
                        const maxBal = Math.max(...escrowData.map(d => Math.abs(d.balance)), escrowInitial);
                        const pct = maxBal > 0 ? Math.abs(balance) / maxBal * 100 : 0;
                        const isCritical = criticalMonth && absMonth === criticalMonth.month;
                        return (
                          <div key={i} className="flex flex-col items-center justify-end h-24 border-b border-l border-gray-200 px-0.5 pb-0.5 relative">
                            {/* Vertical grid line */}
                            <div className="absolute inset-0 border-l border-gray-100" />
                            <div
                              className={`w-full rounded-t-sm ${balance < 0 ? 'bg-red-400' : isCritical ? 'bg-amber-400' : 'bg-violet-400'}`}
                              style={{ height: `${Math.max(pct, 3)}%`, opacity: 0.7 }}
                            />
                          </div>
                        );
                      })}

                      {/* Row 3: Revenue (income) */}
                      <div className="text-[7px] font-bold text-emerald-700 flex items-center justify-center border-b border-gray-200 py-0.5">الإيرادات</div>
                      {Array.from({ length: escrowMonthCount }, (_, i) => {
                        const absMonth = escrowStartMonth + i;
                        const ed = escrowData.find(d => d.month === absMonth);
                        const isCritical = criticalMonth && absMonth === criticalMonth.month;
                        return (
                          <div key={i} className={`text-center text-[7px] py-0.5 border-b border-l border-gray-200 ${isCritical ? 'bg-red-50' : ''}`}>
                            <span className="text-emerald-700">{ed ? fmt(ed.income) : '-'}</span>
                          </div>
                        );
                      })}

                      {/* Row 4: Expenses (withdrawal) */}
                      <div className="text-[7px] font-bold text-red-600 flex items-center justify-center border-b border-gray-200 py-0.5">المصاريف</div>
                      {Array.from({ length: escrowMonthCount }, (_, i) => {
                        const absMonth = escrowStartMonth + i;
                        const ed = escrowData.find(d => d.month === absMonth);
                        const isCritical = criticalMonth && absMonth === criticalMonth.month;
                        return (
                          <div key={i} className={`text-center text-[7px] py-0.5 border-b border-l border-gray-200 ${isCritical ? 'bg-red-50' : ''}`}>
                            <span className="text-red-600">{ed ? fmt(ed.withdrawal) : '-'}</span>
                          </div>
                        );
                      })}

                      {/* Row 5: Difference */}
                      <div className="text-[7px] font-bold text-gray-700 flex items-center justify-center border-b border-gray-200 py-0.5">الفرق</div>
                      {Array.from({ length: escrowMonthCount }, (_, i) => {
                        const absMonth = escrowStartMonth + i;
                        const ed = escrowData.find(d => d.month === absMonth);
                        const diff = ed ? ed.income - ed.withdrawal : 0;
                        const isCritical = criticalMonth && absMonth === criticalMonth.month;
                        return (
                          <div key={i} className={`text-center text-[7px] py-0.5 border-b border-l border-gray-200 ${isCritical ? 'bg-red-50' : ''}`}>
                            <span className={diff >= 0 ? 'text-emerald-700' : 'text-red-600'}>{fmt(diff)}</span>
                          </div>
                        );
                      })}

                      {/* Row 6: Cumulative (balance) */}
                      <div className="text-[7px] font-bold text-violet-700 flex items-center justify-center py-0.5">التراكمي</div>
                      {Array.from({ length: escrowMonthCount }, (_, i) => {
                        const absMonth = escrowStartMonth + i;
                        const ed = escrowData.find(d => d.month === absMonth);
                        const balance = ed ? ed.balance : escrowInitial;
                        const isCritical = criticalMonth && absMonth === criticalMonth.month;
                        return (
                          <div key={i} className={`text-center text-[7px] font-bold py-0.5 border-l border-gray-200 ${isCritical ? 'bg-red-100 text-red-700' : balance < 0 ? 'text-red-600' : 'text-violet-700'}`}>
                            {fmt(balance)}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </section>

            {/* SECTION 8: CASH INFLOW RESULTS TABLE (Payment Plan × Sales) */}
            <section className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Table2 className="w-3.5 h-3.5 text-indigo-600" />
                  <h2 className="text-[11px] font-bold text-gray-800">جدول التدفق النقدي — التحصيل الفعلي من المبيعات</h2>
                </div>
                <div className="flex items-center gap-2 text-[9px] text-gray-500">
                  <Info className="w-3 h-3" />
                  يحسب متى تدخل الأموال فعلياً بناءً على خطة الدفع
                </div>
              </div>
              <div className="p-2 overflow-x-auto max-h-[400px] overflow-y-auto">
                <table className="w-full text-[9px]">
                  <thead className="sticky top-0 bg-white z-10 border-b-2 border-gray-200">
                    <tr>
                      <th className="text-right py-1 px-1.5 text-gray-500 font-bold w-8">#</th>
                      <th className="text-right py-1 px-1.5 text-gray-500 font-bold">الشهر</th>
                      <th className="text-center py-1 px-1.5 text-gray-500 font-bold w-12">المرحلة</th>
                      <th className="text-left py-1 px-1.5 text-gray-500 font-bold">مبيعات الشهر</th>
                      <th className="text-left py-1 px-1.5 text-gray-500 font-bold">تحصيل فعلي</th>
                      <th className="text-left py-1 px-1.5 text-gray-500 font-bold">مبيعات تراكمية</th>
                      <th className="text-left py-1 px-1.5 text-gray-500 font-bold">تحصيل تراكمي</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cashInflowData.map((row, i) => {
                      const isActive = row.salesThisMonth > 0 || row.cashInflow > 0;
                      const isDesign = row.month <= timeline.designEnd;
                      const isSalesStart = row.month === timeline.salesStart;
                      return (
                        <tr key={i} className={`border-b border-gray-50 ${!isActive ? 'opacity-30' : 'hover:bg-blue-50/30'} ${isSalesStart ? 'border-t-2 border-t-amber-300' : ''}`}>
                          <td className="py-0.5 px-1.5 text-gray-400 font-mono">{row.month}</td>
                          <td className="py-0.5 px-1.5 font-medium text-gray-700">شهر {row.month}</td>
                          <td className="py-0.5 px-1.5 text-center">
                            <span className={`inline-block px-1 py-0.5 rounded text-[8px] font-bold ${isDesign ? 'bg-purple-50 text-purple-600' : 'bg-emerald-50 text-emerald-600'}`}>
                              {isDesign ? 'تصاميم' : 'بناء'}
                            </span>
                          </td>
                          <td className="py-0.5 px-1.5 text-left font-mono">
                            {row.salesThisMonth > 0 ? <span className="text-emerald-700 font-medium">{fmtFull(Math.round(row.salesThisMonth))}</span> : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="py-0.5 px-1.5 text-left font-mono">
                            {row.cashInflow > 0 ? <span className="text-blue-700 font-bold">{fmtFull(Math.round(row.cashInflow))}</span> : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="py-0.5 px-1.5 text-left font-mono text-indigo-600">{row.cumSales > 0 ? fmtFull(Math.round(row.cumSales)) : '—'}</td>
                          <td className="py-0.5 px-1.5 text-left font-mono text-blue-600 font-medium">{row.cumCash > 0 ? fmtFull(Math.round(row.cumCash)) : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="border-t-2 border-gray-300 bg-gray-50 font-bold">
                    <tr>
                      <td colSpan={3} className="py-1 px-1.5 text-right text-gray-700">الإجمالي</td>
                      <td className="py-1 px-1.5 text-left font-mono text-emerald-700">{fmtFull(Math.round(cashInflowData.reduce((s, r) => s + r.salesThisMonth, 0)))}</td>
                      <td className="py-1 px-1.5 text-left font-mono text-blue-700">{fmtFull(Math.round(cashInflowData.reduce((s, r) => s + r.cashInflow, 0)))}</td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <div className="px-3 py-2 border-t border-gray-100 bg-gray-50/50">
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center">
                    <p className="text-[8px] text-gray-500">إجمالي المبيعات</p>
                    <p className="text-[10px] font-bold text-emerald-700">{fmtFull(Math.round(cashInflowData.reduce((s, r) => s + r.salesThisMonth, 0)))} AED</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[8px] text-gray-500">تحصيل خلال المشروع</p>
                    <p className="text-[10px] font-bold text-blue-700">{fmtFull(Math.round(cashInflowData.reduce((s, r) => s + r.cashInflow, 0)))} AED</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[8px] text-gray-500">نسبة التحصيل</p>
                    <p className="text-[10px] font-bold text-indigo-700">
                      {cashInflowData.reduce((s, r) => s + r.salesThisMonth, 0) > 0
                        ? Math.round((cashInflowData.reduce((s, r) => s + r.cashInflow, 0) / cashInflowData.reduce((s, r) => s + r.salesThisMonth, 0)) * 100)
                        : 0}%
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* SECTION 9: DETAILED PAYMENT PLAN BREAKDOWN GRID */}
            {activeSaleMonths.length > 0 && (
            <section className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Table2 className="w-3.5 h-3.5 text-purple-600" />
                  <h2 className="text-[11px] font-bold text-gray-800">تفصيل توزيع الأقساط — من أين جاء كل مبلغ</h2>
                </div>
                <div className="flex items-center gap-2 text-[9px] text-gray-500">
                  <Info className="w-3 h-3" />
                  الصفوف = أشهر البيع | الأعمدة = أشهر التحصيل
                </div>
              </div>
              <div className="p-2 overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="w-full text-[8px] border-collapse">
                  <thead className="sticky top-0 bg-white z-10">
                    <tr className="border-b-2 border-gray-300">
                      <th className="py-1 px-1 text-right text-gray-600 font-bold sticky left-0 bg-white z-20 min-w-[80px]">شهر البيع \ شهر التحصيل</th>
                      <th className="py-1 px-1 text-right text-gray-600 font-bold sticky left-[80px] bg-white z-20 min-w-[60px]">مبلغ البيع</th>
                      {Array.from({ length: timeline.projectEnd }, (_, i) => i + 1).map(m => (
                        <th key={m} className={`py-1 px-0.5 text-center font-medium min-w-[45px] ${m === timeline.salesStart ? 'border-l-2 border-amber-300' : ''} ${m >= timeline.salesStart ? 'text-gray-700' : 'text-gray-400'}`}>
                          ش{m}
                        </th>
                      ))}
                      <th className="py-1 px-1 text-center text-gray-700 font-bold min-w-[60px]">المجموع</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeSaleMonths.map((saleMonth, idx) => {
                      const rowData = perSaleGrid[saleMonth];
                      const saleAmount = cashInflowData.find(d => d.month === saleMonth)?.salesThisMonth || 0;
                      const rowTotal = rowData ? rowData.reduce((s, v) => s + v, 0) : 0;
                      return (
                        <tr key={saleMonth} className={`border-b border-gray-50 ${idx % 2 === 0 ? 'bg-gray-50/30' : ''} hover:bg-purple-50/30`}>
                          <td className="py-0.5 px-1 font-bold text-purple-700 sticky left-0 bg-inherit z-10">شهر {saleMonth} ({salesDistribution[saleMonth - timeline.salesStart] || 0} وحدة)</td>
                          <td className="py-0.5 px-1 font-mono text-emerald-700 sticky left-[80px] bg-inherit z-10">{fmtFull(Math.round(saleAmount))}</td>
                          {Array.from({ length: timeline.projectEnd }, (_, i) => i + 1).map(m => {
                            const val = rowData ? rowData[m] || 0 : 0;
                            return (
                              <td key={m} className={`py-0.5 px-0.5 text-center font-mono ${m === saleMonth ? 'bg-amber-50 font-bold text-amber-700' : val > 0 ? 'text-blue-700' : 'text-gray-200'}`}>
                                {val > 0 ? (val >= 1000000 ? `${(val / 1000000).toFixed(1)}M` : val >= 1000 ? `${Math.round(val / 1000)}K` : Math.round(val)) : '—'}
                              </td>
                            );
                          })}
                          <td className="py-0.5 px-1 text-center font-mono font-bold text-indigo-700">{fmtFull(Math.round(rowTotal))}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="border-t-2 border-gray-400 bg-gray-100 font-bold sticky bottom-0">
                    <tr>
                      <td className="py-1 px-1 text-right text-gray-800 sticky left-0 bg-gray-100 z-10">مجموع التحصيل الشهري</td>
                      <td className="py-1 px-1 font-mono text-emerald-800 sticky left-[80px] bg-gray-100 z-10">{fmtFull(Math.round(activeSaleMonths.reduce((s, sm) => s + (cashInflowData.find(d => d.month === sm)?.salesThisMonth || 0), 0)))}</td>
                      {Array.from({ length: timeline.projectEnd }, (_, i) => i + 1).map(m => {
                        const colTotal = activeSaleMonths.reduce((s, sm) => s + (perSaleGrid[sm]?.[m] || 0), 0);
                        return (
                          <td key={m} className={`py-1 px-0.5 text-center font-mono ${colTotal > 0 ? 'text-blue-800 font-bold' : 'text-gray-300'}`}>
                            {colTotal > 0 ? (colTotal >= 1000000 ? `${(colTotal / 1000000).toFixed(1)}M` : `${Math.round(colTotal / 1000)}K`) : '—'}
                          </td>
                        );
                      })}
                      <td className="py-1 px-1 text-center font-mono text-blue-800">{fmtFull(Math.round(cashInflowData.reduce((s, r) => s + r.cashInflow, 0)))}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <div className="px-3 py-1.5 border-t border-gray-100 bg-purple-50/30 text-[9px] text-gray-600">
                <strong>ملاحظة:</strong> الخلية الصفراء = دفعة الحجز (في شهر البيع) | الخلايا الزرقاء = أقساط لاحقة حسب البيمنت بلان | الصف الأخير = إجمالي ما يدخل الإسكرو كل شهر
              </div>
            </section>
            )}

          </>
        )}
      </div>
    </div>
  );
}
// ═══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════
function KPICard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  const colorMap: Record<string, string> = {
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    slate: "bg-slate-50 text-slate-700 border-slate-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    red: "bg-red-50 text-red-700 border-red-200",
    violet: "bg-violet-50 text-violet-700 border-violet-200",
  };
  return (
    <div className={`rounded-lg border p-2 ${colorMap[color] || colorMap.slate}`}>
      <p className="text-[9px] opacity-70">{label}</p>
      <p className="text-sm font-bold">{value}</p>
      <p className="text-[8px] opacity-60">{sub}</p>
    </div>
  );
}
