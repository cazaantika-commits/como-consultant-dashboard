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
  Building2, Percent, CreditCard, Table2, Info, Download, RefreshCw, Sparkles, ShieldCheck,
  LayoutDashboard, Tags, WalletCards, BarChart3, CheckCircle2,
} from "lucide-react";
import { exportToExcel } from "@/lib/tableExport";
import {
  dbProjectToInputs,
  dbProjectToRates,
  calculateProjectFormulas,
  calculatePricingFormulas,
  calculateCosts,
} from "@/lib/projectData";
import { clampMarketingDistributionToStart, getMarketingTimelineWindow, getProjectMarketingTiming, getSalesTimelineWindow } from "@/lib/projectTiming";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as ReTooltip, ResponsiveContainer, Cell,
} from "recharts";

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════
const UNIT_TYPES = [
  { id: "residential1br", name: "غرفة وصالة", category: "residential", color: "#3b82f6", dbCount: "residential1brCount", dbArea: "residential1brArea", dbPrice: "residential1brPrice" },
  { id: "residential2br", name: "غرفتين وصالة", category: "residential", color: "#8b5cf6", dbCount: "residential2brCount", dbArea: "residential2brArea", dbPrice: "residential2brPrice" },
  { id: "residential3br", name: "ثلاث غرف", category: "residential", color: "#d946ef", dbCount: "residential3brCount", dbArea: "residential3brArea", dbPrice: "residential3brPrice" },
  { id: "villa", name: "فيلا", category: "residential", color: "#0f766e", dbCount: "villaCount", dbArea: "villaArea", dbPrice: "villaPrice" },
  { id: "townhouse", name: "تاون هاوس", category: "residential", color: "#0e7490", dbCount: "townhouseCount", dbArea: "townhouseArea", dbPrice: "townhousePrice" },
  { id: "retailSmall", name: "تجزئة صغير", category: "retail", color: "#f59e0b", dbCount: "retailSmallCount", dbArea: "retailSmallArea", dbPrice: "retailSmallPrice" },
  { id: "retailMedium", name: "تجزئة متوسط", category: "retail", color: "#f97316", dbCount: "retailMediumCount", dbArea: "retailMediumArea", dbPrice: "retailMediumPrice" },
  { id: "retailLarge", name: "تجزئة كبير", category: "retail", color: "#ef4444", dbCount: "retailLargeCount", dbArea: "retailLargeArea", dbPrice: "retailLargePrice" },
  { id: "officeSmall", name: "مكاتب صغير", category: "office", color: "#10b981", dbCount: "officeSmallCount", dbArea: "officeSmallArea", dbPrice: "officeSmallPrice" },
  { id: "officeMedium", name: "مكاتب متوسط", category: "office", color: "#14b8a6", dbCount: "officeMediumCount", dbArea: "officeMediumArea", dbPrice: "officeMediumPrice" },
  { id: "officeLarge", name: "مكاتب كبير", category: "office", color: "#06b6d4", dbCount: "officeLargeCount", dbArea: "officeLargeArea", dbPrice: "officeLargePrice" },
];



const PROJECT_PHASES = [
  { id: "design", name: "التصاميم", color: "#3b82f6", icon: Palette },
  { id: "materials", name: "تحضير مواد التسويق", color: "#f59e0b", icon: Rocket },
  { id: "rera", name: "ريرا + اعتمادات البيع", color: "#8b5cf6", icon: FileCheck },
  { id: "marketing", name: "إطلاق التسويق", color: "#ec4899", icon: Megaphone },
  { id: "sales", name: "بدء المبيعات", color: "#10b981", icon: Target },
  { id: "construction", name: "الإنشاء", color: "#64748b", icon: HardHat },
];

const MARKETING_CHANNELS = [
  { id: "digital", name: "التسويق الرقمي", defaultPct: 35, color: "#3b82f6" },
  { id: "outdoor", name: "الإعلانات الخارجية", defaultPct: 20, color: "#10b981" },
  { id: "events", name: "المعارض والفعاليات", defaultPct: 15, color: "#f59e0b" },
  { id: "broker", name: "شبكة الوسطاء", defaultPct: 15, color: "#8b5cf6" },
  { id: "pr", name: "العلاقات العامة", defaultPct: 10, color: "#ec4899" },
  { id: "content", name: "المحتوى والإنتاج", defaultPct: 5, color: "#06b6d4" },
];

type WaelStudioRoom = "overview" | "pricing" | "sales" | "collection" | "marketing" | "impact";

const WAEL_STUDIO_ROOMS: Array<{
  id: WaelStudioRoom;
  title: string;
  eyebrow: string;
  description: string;
  icon: typeof LayoutDashboard;
  tone: string;
}> = [
  { id: "overview", title: "لوحة السيناريو", eyebrow: "ابدأ هنا", description: "ملخص القرار قبل الدخول في التفاصيل", icon: LayoutDashboard, tone: "bg-slate-900 text-white" },
  { id: "pricing", title: "المنتج والسعر", eyebrow: "قيمة البيع", description: "سعر القدم لكل نوع وحدة والإيراد الناتج", icon: Tags, tone: "bg-emerald-600 text-white" },
  { id: "sales", title: "خطة البيع", eyebrow: "متى وكم", description: "سرعة البيع وعدد الوحدات أو نسبتها شهرياً", icon: Target, tone: "bg-blue-600 text-white" },
  { id: "collection", title: "تحصيل المشتري", eyebrow: "متى يدخل النقد", description: "خطة الدفعات والتحصيل الفعلي", icon: WalletCards, tone: "bg-indigo-600 text-white" },
  { id: "marketing", title: "حملة التسويق", eyebrow: "دفع الطلب", description: "الميزانية والقنوات وتوقيت الإنفاق", icon: Megaphone, tone: "bg-pink-600 text-white" },
  { id: "impact", title: "أثر القرار", eyebrow: "اختبر قبل الاعتماد", description: "الإسكرو والتحصيل والربح والمخاطر", icon: BarChart3, tone: "bg-violet-600 text-white" },
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
  const [activeStudioRoom, setActiveStudioRoom] = useState<WaelStudioRoom>("overview");
  const [showSalesPrecision, setShowSalesPrecision] = useState(false);
  const [salesCalendarPage, setSalesCalendarPage] = useState(0);

  // ─── DB Queries ─────────────────────────────────────────────────────────────
  const projectQuery = trpc.projects.getById.useQuery(selectedProjectId!, {
    enabled: !!selectedProjectId && !!user,
  });
  const plansQuery = trpc.waelSalesPlan.getByProject.useQuery(
    { projectId: selectedProjectId! },
    { enabled: !!selectedProjectId && !!user }
  );
  const isBuildForSale = (projectQuery.data as any)?.financingScenario === "build_for_sale";
  const updateProject = trpc.projects.update.useMutation({
    onSuccess: () => { projectQuery.refetch(); toast({ title: "تم حفظ التسعير ✓" }); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });
  const saveWorkspace = trpc.waelSalesPlan.saveWorkspace.useMutation({
    onSuccess: () => { plansQuery.refetch(); projectQuery.refetch(); toast({ title: "تم اعتماد سيناريو وائل ✓" }); },
    onError: (e: any) => {
      const errorMsg = e?.data?.zodError?.[0]?.message || e?.data?.code || e.message || "خطأ غير معروف";
      toast({ title: "خطأ في الحفظ", description: errorMsg, variant: "destructive" });
      console.error("Workspace save error:", e);
    },
  });

  // ─── State: Unit Pricing (from DB) ──────────────────────────────────────────
  const [unitData, setUnitData] = useState<Record<string, { count: number; area: number; price: number }>>({});
  const [hasUnitChanges, setHasUnitChanges] = useState(false);

  // ─── State: Sales Plan ──────────────────────────────────────────────────────
  const [planId, setPlanId] = useState<number | undefined>(undefined);
  const [designMonths, setDesignMonths] = useState(8);
  const [constructionMonths, setConstructionMonths] = useState(30);
  const [projectStartDate, setProjectStartDate] = useState<string>(""); // e.g. "2026-08"
  const [marketingPrepLead, setMarketingPrepLead] = useState(2);
  const [reraLead, setReraLead] = useState(2);
  const [marketingPct, setMarketingPct] = useState(2);
  const [channelPcts, setChannelPcts] = useState<Record<string, number>>(
    Object.fromEntries(MARKETING_CHANNELS.map((channel) => [channel.id, channel.defaultPct]))
  );
  const [marketingActualStart, setMarketingActualStart] = useState(6);
  const [marketingActualEnd, setMarketingActualEnd] = useState(38);
  const [marketingDistribution, setMarketingDistribution] = useState<Record<string, number[]>>({});
  const [hasMarketingChanges, setHasMarketingChanges] = useState(false);
  const [commissionPct, setCommissionPct] = useState(5);
  const [offPlan, setOffPlan] = useState(80);
  const [speed, setSpeed] = useState(50);
  const [curveTemplate, setCurveTemplate] = useState<"bell" | "fast" | "gradual" | "late">("bell");
  const [salesMode, setSalesMode] = useState<"auto" | "manual">("auto");
  const [manualUnits, setManualUnits] = useState<number[]>([]);
  const [buildForSaleMarketingRate, setBuildForSaleMarketingRate] = useState(1);
  const [buildForSaleMarketingStartBeforeCompletion, setBuildForSaleMarketingStartBeforeCompletion] = useState(1);
  const [buildForSaleMarketingDuration, setBuildForSaleMarketingDuration] = useState(3);
  const [hasBuildForSaleMarketingChanges, setHasBuildForSaleMarketingChanges] = useState(false);

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
      if (p.marketingPrepMonths) setMarketingPrepLead(Number(p.marketingPrepMonths));
      if (p.reraLeadMonths) setReraLead(Number(p.reraLeadMonths));
      if (p.financingScenario === "build_for_sale") {
        try {
          const savedRates = JSON.parse(p.constructionScheduleJson || "{}")?.settings?.configurableRates || {};
          const savedRate = Number(savedRates.buildForSaleMarketingRate ?? 1);
          setBuildForSaleMarketingRate(savedRate);
          setMarketingPct(savedRate);
          setBuildForSaleMarketingStartBeforeCompletion(Math.max(0, Number(savedRates.buildForSaleMarketingStartMonthsBeforeCompletion ?? 1)));
          setBuildForSaleMarketingDuration(Math.max(1, Number(savedRates.buildForSaleMarketingDurationMonths ?? 3)));
        } catch {
          setBuildForSaleMarketingRate(1);
          setBuildForSaleMarketingStartBeforeCompletion(1);
          setBuildForSaleMarketingDuration(3);
        }
      }
      setHasBuildForSaleMarketingChanges(false);
    }
  }, [projectQuery.data]);

  useEffect(() => {
    if (plansQuery.data && plansQuery.data.length > 0) {
      const plan = plansQuery.data[0] as any;
      const marketingTiming = getProjectMarketingTiming(projectQuery.data);
      setPlanId(plan.id);
      if (plan.offplanPct) setOffPlan(plan.offplanPct);

      if (plan.salesAbsorptionJson) {
        try {
          const parsed = JSON.parse(plan.salesAbsorptionJson);
          if (parsed.mode) setSalesMode(parsed.mode);
          if (parsed.speed) setSpeed(parsed.speed);
          if (parsed.template) setCurveTemplate(parsed.template);
          if (parsed.manual) setManualUnits(parsed.manual);
          // marketingPrepLead and reraLead now come from project settings (not salesAbsorptionJson)
          if (parsed.ppDownPct) setPpDownPct(parsed.ppDownPct);
          if (parsed.ppSecondPct) setPpSecondPct(parsed.ppSecondPct);
          if (parsed.ppSecondAfterMonths) setPpSecondAfterMonths(parsed.ppSecondAfterMonths);
          if (parsed.ppInstallmentPct) setPpInstallmentPct(parsed.ppInstallmentPct);
          if (parsed.ppInstallmentEvery) setPpInstallmentEvery(parsed.ppInstallmentEvery);
          if (parsed.ppHandoverPct) setPpHandoverPct(parsed.ppHandoverPct);
          const savedMarketingStart = Number(parsed.marketingActualStart ?? marketingTiming.marketingStartMonth);
          const validMarketingStart = Math.max(savedMarketingStart, marketingTiming.marketingStartMonth);
          const savedMarketingEnd = Number(parsed.marketingActualEnd ?? marketingTiming.projectEndMonth);
          setMarketingActualStart(validMarketingStart);
          setMarketingActualEnd(Math.max(validMarketingStart, Math.min(savedMarketingEnd, marketingTiming.projectEndMonth)));
          const savedDistribution = (() => {
            try { return plan.marketingDistJson ? JSON.parse(plan.marketingDistJson) : parsed.marketingDistribution; } catch { return parsed.marketingDistribution; }
          })();
          if (savedDistribution) {
            setMarketingDistribution(clampMarketingDistributionToStart(savedDistribution, savedMarketingStart, marketingTiming.marketingStartMonth));
          }
        } catch {}
      }
      if (plan.channelsJson) {
        try { setChannelPcts(JSON.parse(plan.channelsJson)); } catch {}
      }
      setHasPlanChanges(false);
      setHasMarketingChanges(false);
    }
  }, [plansQuery.data, projectQuery.data]);

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
  const activeUnitRevenues = unitRevenues.filter((unit) => unit.count > 0);
  const activeResidentialUnits = activeUnitRevenues.filter((unit) => unit.category === "residential");
  const activeRetailUnits = activeUnitRevenues.filter((unit) => unit.category === "retail");
  const activeOfficeUnits = activeUnitRevenues.filter((unit) => unit.category === "office");

  // ─── Computed: Full Costs from Feasibility ─────────────────────────────────
  const constructionCostPerSqft = projectQuery.data ? Number((projectQuery.data as any).estimatedConstructionPricePerSqft) || 400 : 400;
  const constructionCost = totalArea * constructionCostPerSqft;
  const marketingCost = totalRevenue * (marketingPct / 100);
  const totalChannelPct = Object.values(channelPcts).reduce((sum, value) => sum + value, 0);
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
      category: u.category as 'residential' | 'retail' | 'office',
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
  const sharedTiming = useMemo(() => getProjectMarketingTiming(projectQuery.data), [projectQuery.data]);
  const timeline = useMemo(() => {
    const designEnd = sharedTiming.designMonths;
    const materialsStart = sharedTiming.materialsStartMonth;
    const reraStart = sharedTiming.reraStartMonth;
    const marketingStart = sharedTiming.marketingStartMonth;
    const salesStart = sharedTiming.salesStartMonth;
    const constructionStart = sharedTiming.constructionStartMonth;
    const projectEnd = sharedTiming.projectEndMonth;
    return { designEnd, materialsStart, reraStart, marketingStart, salesStart, constructionStart, projectEnd };
  }, [sharedTiming]);
  const buildForSaleStartMonth = timeline.projectEnd + 1;
  const salesMonths = isBuildForSale
    ? Math.max(3, manualUnits.length || 0)
    : timeline.projectEnd - timeline.salesStart + 1;
  const salesStartMonth = isBuildForSale ? buildForSaleStartMonth : timeline.salesStart;
  const salesEndMonth = salesStartMonth + salesMonths - 1;
  const buildForSaleMarketingStartMonth = Math.max(
    1,
    timeline.projectEnd - buildForSaleMarketingStartBeforeCompletion,
  );
  const buildForSaleMarketingEndMonth = buildForSaleMarketingStartMonth + buildForSaleMarketingDuration - 1;
  const timelineDisplayEndMonth = isBuildForSale
    ? Math.max(timeline.projectEnd, buildForSaleMarketingEndMonth, salesEndMonth)
    : timeline.projectEnd;

  // ─── Computed: Sales Distribution ─────────────────────────────────────────
  const offPlanUnits = isBuildForSale ? totalUnits : Math.round((totalUnits * offPlan) / 100);
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
  const activityWindows = useMemo(() => {
    const plan = (plansQuery.data?.[0] ?? {}) as any;
    let absorption: any = {};
    let results: any = {};
    try { absorption = JSON.parse(plan.salesAbsorptionJson || "{}"); } catch {}
    try { results = JSON.parse(plan.resultsJson || "{}"); } catch {}
    return {
      marketing: isBuildForSale
        ? {
            startMonth: buildForSaleMarketingStartMonth,
            endMonth: buildForSaleMarketingEndMonth,
            hasSavedActivity: true,
          }
        : getMarketingTimelineWindow({
            settingsStartMonth: timeline.marketingStart,
            projectEndMonth: timeline.projectEnd,
            savedStartMonth: absorption.marketingActualStart,
            savedEndMonth: absorption.marketingActualEnd,
          }),
      sales: getSalesTimelineWindow({
        settingsStartMonth: salesStartMonth,
        projectEndMonth: salesEndMonth,
        salesDistribution: results.salesDistribution ?? salesDistribution,
      }),
    };
  }, [plansQuery.data, salesDistribution, timeline.marketingStart, timeline.projectEnd, isBuildForSale, buildForSaleMarketingStartMonth, buildForSaleMarketingEndMonth, salesStartMonth, salesEndMonth]);

  // ─── Computed: Escrow with Payment Plan ────────────────────────────────────
  const escrowInitial = constructionCost * 0.2;
  const monthlySiphon = salesMonths > 0 ? constructionCost / salesMonths : 0;
  const escrowData = useMemo(() => {
    if (isBuildForSale) return [];
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
  }, [isBuildForSale, salesDistribution, escrowInitial, avgUnitPrice, monthlySiphon, timeline.salesStart, constructionCost, downPaymentPct, duringConstructionPct, constructionMonths]);
  const maxDeficit = escrowData.length > 0 ? Math.min(...escrowData.map((d) => d.balance)) : 0;
  const hasDeficit = maxDeficit < 0;
  const criticalMonth = useMemo(() => {
    if (escrowData.length === 0) return null;
    let minBalance = Infinity;
    let minIdx = 0;
    escrowData.forEach((d, i) => { if (d.balance < minBalance) { minBalance = d.balance; minIdx = i; } });
    return escrowData[minIdx];
  }, [escrowData]);
  const visibleTimelinePhases = isBuildForSale
    ? PROJECT_PHASES.filter((phase) => ["design", "marketing", "sales", "construction"].includes(phase.id))
    : PROJECT_PHASES;

  // ─── Computed: Cash Inflow (Payment Plan × Sales) + Detailed Grid ────────
  const { cashInflowData, perSaleGrid, activeSaleMonths, actualCashInflow } = useMemo(() => {
    const totalMonths = isBuildForSale ? salesEndMonth : timeline.projectEnd;
    const cashFlowHorizon = totalMonths + 13;
    const monthlySales: number[] = Array(totalMonths + 1).fill(0);
    salesDistribution.forEach((units, i) => {
      const m = salesStartMonth + i;
      if (m <= totalMonths) monthlySales[m] = units * avgUnitPrice;
    });
    const cashPerMonth: number[] = Array(cashFlowHorizon + 1).fill(0);
    const grid: Record<number, number[]> = {};
    const saleMonthsList: number[] = [];
    for (let saleMonth = 1; saleMonth <= totalMonths; saleMonth++) {
      const saleAmount = monthlySales[saleMonth];
      if (saleAmount <= 0) continue;
      saleMonthsList.push(saleMonth);
      grid[saleMonth] = Array(totalMonths + 1).fill(0);
      if (isBuildForSale) {
        if (saleMonth < cashPerMonth.length) {
          cashPerMonth[saleMonth] += saleAmount;
          grid[saleMonth][saleMonth] += saleAmount;
        }
      } else {
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
    }
    const data: { month: number; salesThisMonth: number; cashInflow: number; cumSales: number; cumCash: number }[] = [];
    let cumSales = 0, cumCash = 0;
    for (let m = 1; m <= totalMonths; m++) {
      cumSales += monthlySales[m]; cumCash += cashPerMonth[m];
      data.push({ month: m, salesThisMonth: monthlySales[m], cashInflow: cashPerMonth[m], cumSales, cumCash });
    }
    // Persisted convention: array index 0 represents project month 1. This is
    // the same convention consumed by the Escrow Cash Flow page and engine.
    const persistedCashInflow = Array.from({ length: cashFlowHorizon }, (_, i) => cashPerMonth[i + 1] || 0);
    return { cashInflowData: data, perSaleGrid: grid, activeSaleMonths: saleMonthsList, actualCashInflow: persistedCashInflow };
  }, [salesDistribution, avgUnitPrice, timeline, constructionMonths, ppDownPct, ppSecondPct, ppSecondAfterMonths, ppDuringTotal, ppInstallmentEvery, ppHandoverPct, isBuildForSale, salesStartMonth, salesEndMonth]);

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

  const handleSaveBuildForSaleMarketing = useCallback(() => {
    if (!selectedProjectId || !projectQuery.data) return;
    let schedule: any = {};
    try { schedule = JSON.parse((projectQuery.data as any).constructionScheduleJson || "{}"); } catch {}
    const settings = schedule.settings || {};
    const configurableRates = settings.configurableRates || {};
    updateProject.mutate({
      id: selectedProjectId,
      constructionScheduleJson: JSON.stringify({
        ...schedule,
        settings: {
          ...settings,
          configurableRates: {
            ...configurableRates,
            buildForSaleMarketingRate,
            buildForSaleMarketingStartMonthsBeforeCompletion: buildForSaleMarketingStartBeforeCompletion,
            buildForSaleMarketingDurationMonths: buildForSaleMarketingDuration,
          },
        },
      }),
    } as any, {
      onSuccess: () => {
        setMarketingPct(buildForSaleMarketingRate);
        setHasBuildForSaleMarketingChanges(false);
        toast({ title: "تم حفظ إعدادات تسويق البناء للبيع ✓" });
      },
    });
  }, [selectedProjectId, projectQuery.data, updateProject, buildForSaleMarketingRate, buildForSaleMarketingStartBeforeCompletion, buildForSaleMarketingDuration, toast]);

  const handleSaveWorkspace = useCallback(async () => {
    if (!selectedProjectId) return;
    try {
      let existingAbsorption: any = {};
      const existingPlan = plansQuery.data?.[0] as any;
      if (existingPlan?.salesAbsorptionJson) {
        try { existingAbsorption = JSON.parse(existingPlan.salesAbsorptionJson); } catch {}
      }
      const validMarketingStart = timeline.marketingStart;
      const normalizedMarketingDistribution = clampMarketingDistributionToStart(
        marketingDistribution,
        marketingActualStart,
        validMarketingStart,
      );
      const savedPlan = await saveWorkspace.mutateAsync({
        planId,
        projectId: selectedProjectId,
        pricing: Object.fromEntries(UNIT_TYPES.map((unit) => [unit.dbPrice, unitData[unit.id]?.price || 0])),
        marketingPct,
        salesCommissionPct: commissionPct,
        totalRevenue,
        designMonths: timeline.designEnd,
        constructionMonths,
        offplanPct: offPlan,
        salesAbsorptionJson: JSON.stringify({
          ...existingAbsorption,
          mode: salesMode,
          speed,
          template: curveTemplate,
          manual: manualUnits,
          ppDownPct,
          ppSecondPct,
          ppSecondAfterMonths,
          ppInstallmentPct,
          ppInstallmentEvery,
          ppHandoverPct,
          marketingActualStart: validMarketingStart,
          marketingActualEnd: Math.max(validMarketingStart, marketingActualEnd),
          marketingDistribution: normalizedMarketingDistribution,
          ...(isBuildForSale ? { buildForSaleMonthlyUnits: salesDistribution } : {}),
        }),
        marketingDistJson: JSON.stringify(normalizedMarketingDistribution),
        channelsJson: JSON.stringify(channelPcts),
        paymentPlanJson: JSON.stringify(isBuildForSale
          ? { downPct: 100, secondPct: 0, secondAfterMonths: 0, duringTotalPct: 0, installmentEveryMonths: 1, handoverPct: 0 }
          : { downPct: ppDownPct, secondPct: ppSecondPct, secondAfterMonths: ppSecondAfterMonths, duringTotalPct: ppDuringTotal, installmentEveryMonths: ppInstallmentEvery, handoverPct: ppHandoverPct }),
        resultsJson: JSON.stringify({
          escrowData: isBuildForSale ? [] : escrowData,
          salesDistribution,
          actualCashInflow,
          actualCashInflowVersion: 2,
          ...(isBuildForSale ? { buildForSaleMonthlyUnits: salesDistribution } : {}),
        }),
      });
      setPlanId(savedPlan.id);
      setHasUnitChanges(false);
      setHasPlanChanges(false);
      setHasMarketingChanges(false);
      await Promise.all([plansQuery.refetch(), projectQuery.refetch()]);
    } catch {
      setHasPlanChanges(true);
    }
  }, [selectedProjectId, planId, unitData, marketingPct, commissionPct, totalRevenue, timeline.designEnd, timeline.marketingStart, constructionMonths, offPlan, salesMode, speed, curveTemplate, manualUnits, ppDownPct, ppSecondPct, ppSecondAfterMonths, ppInstallmentPct, ppInstallmentEvery, ppHandoverPct, ppDuringTotal, marketingActualStart, marketingActualEnd, marketingDistribution, channelPcts, escrowData, salesDistribution, actualCashInflow, saveWorkspace, plansQuery, projectQuery, isBuildForSale]);

  const updateUnit = (id: string, field: "count" | "area" | "price", value: number) => {
    setUnitData((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
    setHasUnitChanges(true);
    setHasPlanChanges(true);
  };

  const updateSalesMonth = (monthIndex: number, requestedUnits: number) => {
    const current = [...(manualUnits.length === salesMonths ? manualUnits : salesDistribution)];
    const otherMonths = current.reduce((sum, value, index) => index === monthIndex ? sum : sum + (value || 0), 0);
    current[monthIndex] = Math.min(Math.max(0, Math.round(requestedUnits)), Math.max(0, offPlanUnits - otherMonths));
    setManualUnits(current);
    setSalesMode("manual");
    setHasPlanChanges(true);
  };

  const handleChannelSliderChange = (channelId: string, value: number) => {
    setChannelPcts((previous) => {
      const totalExcludingChannel = Object.entries(previous).reduce((sum, [id, percentage]) => id === channelId ? sum : sum + percentage, 0);
      return { ...previous, [channelId]: Math.min(value, Math.max(0, 100 - totalExcludingChannel)) };
    });
    setHasMarketingChanges(true);
  };

  const handleMarketingMonthInput = (channelId: string, monthIndex: number, requestedAmount: number, months: number) => {
    setMarketingDistribution((previous) => {
      const amounts = [...(previous[channelId] || Array(months).fill(0))];
      while (amounts.length < months) amounts.push(0);
      const channelBudget = marketingCost * ((channelPcts[channelId] || 0) / 100);
      const otherMonths = amounts.reduce((sum, value, index) => index === monthIndex ? sum : sum + (value || 0), 0);
      amounts[monthIndex] = Math.min(Math.max(0, requestedAmount), Math.max(0, channelBudget - otherMonths));
      return { ...previous, [channelId]: amounts };
    });
    setHasMarketingChanges(true);
  };

  const applySalesPace = (template: "fast" | "bell" | "gradual" | "late", nextSpeed: number) => {
    setCurveTemplate(template);
    setSpeed(nextSpeed);
    setSalesMode("auto");
    setManualUnits([]);
    setHasPlanChanges(true);
  };

  const adjustAllPrices = (multiplier: number) => {
    setUnitData((previous) => Object.fromEntries(Object.entries(previous).map(([id, unit]) => [id, { ...unit, price: Math.max(0, Math.round(unit.price * multiplier)) }] )));
    setHasUnitChanges(true);
    setHasPlanChanges(true);
  };

  const applyPaymentPreset = (preset: "early" | "balanced" | "handover") => {
    if (preset === "early") { setPpDownPct(20); setPpSecondPct(15); setPpSecondAfterMonths(1); setPpInstallmentPct(10); setPpInstallmentEvery(4); setPpHandoverPct(25); }
    else if (preset === "handover") { setPpDownPct(10); setPpSecondPct(5); setPpSecondAfterMonths(2); setPpInstallmentPct(10); setPpInstallmentEvery(6); setPpHandoverPct(45); }
    else { setPpDownPct(10); setPpSecondPct(10); setPpSecondAfterMonths(1); setPpInstallmentPct(10); setPpInstallmentEvery(6); setPpHandoverPct(40); }
    setHasPlanChanges(true);
  };

  const activeRoom = WAEL_STUDIO_ROOMS.find((room) => room.id === activeStudioRoom) ?? WAEL_STUDIO_ROOMS[0];
  const hasScenarioChanges = hasUnitChanges || hasPlanChanges || hasMarketingChanges || hasBuildForSaleMarketingChanges;

  // ═══════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-full bg-[#f5f7fb] p-3 sm:p-5" dir="rtl">
      <div className="mx-auto max-w-[1500px] space-y-4">
        {/* ═══ SCENARIO STUDIO HEADER ═══ */}
        <section className="overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.08)]">
          <div className="flex flex-col gap-3 bg-[linear-gradient(110deg,#0f172a,#172554_58%,#0f766e)] p-4 text-white lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 text-[10px] font-bold tracking-wide text-emerald-300"><Sparkles className="h-3.5 w-3.5" />استوديو قرار وائل</div>
              <h1 className="mt-1 text-xl font-black tracking-tight sm:text-2xl">خطّط المبيعات. شاهد النقد. اعتمد القرار.</h1>
              <p className="mt-1 text-xs leading-5 text-slate-300">حرّك هدف البيع والسعر والدفعات، ثم شاهد الأثر المالي فورًا قبل الحفظ.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ProjectSelector selectedId={selectedProjectId} onSelect={(id) => { setSelectedProjectId(id); setActiveStudioRoom("overview"); }} />
              <Badge className={hasScenarioChanges ? "border border-amber-300/30 bg-amber-400/15 px-3 py-1 text-amber-200 hover:bg-amber-400/15" : "border border-emerald-300/30 bg-emerald-400/15 px-3 py-1 text-emerald-200 hover:bg-emerald-400/15"}>{hasScenarioChanges ? "مسودة غير معتمدة" : "السيناريو المعتمد"}</Badge>
              <Button size="sm" onClick={handleSaveWorkspace} disabled={saveWorkspace.isPending || totalChannelPct !== 100 || totalSold > offPlanUnits} className="gap-1.5 bg-emerald-500 text-white hover:bg-emerald-400">
                {saveWorkspace.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                اعتماد السيناريو
              </Button>
              <Button size="sm" variant="outline" onClick={() => {
                const headers = [["الشهر", "مبيعات الشهر", "التدفق النقدي", "إجمالي المبيعات التراكمي", "إجمالي النقد التراكمي"]];
                const rows = cashInflowData.map(d => [d.month, Math.round(d.salesThisMonth), Math.round(d.cashInflow), Math.round(d.cumSales), Math.round(d.cumCash)]);
                const projectName = (projectQuery.data as any)?.name || "مشروع";
                exportToExcel({ title: "خطة المبيعات والتدفقات", projectName, scenario: "offplan_escrow", headers, rows }, `خطة_المبيعات_${projectName}`);
              }} className="gap-1.5 border-white/25 bg-white/5 text-white hover:bg-white/10 hover:text-white">
                <Download className="h-3.5 w-3.5" />تصدير
              </Button>
            </div>
          </div>
          {selectedProjectId && !projectQuery.isLoading && projectQuery.data && (
            <div className="flex gap-1 overflow-x-auto border-t border-slate-100 bg-slate-50 p-2">
              {WAEL_STUDIO_ROOMS.map((room) => {
                const Icon = room.icon;
                const isActive = room.id === activeStudioRoom;
                return <button key={room.id} type="button" onClick={() => setActiveStudioRoom(room.id)} className={`flex min-w-[118px] items-center gap-2 rounded-xl px-3 py-2 text-right transition ${isActive ? "bg-slate-900 text-white shadow-sm" : "bg-white text-slate-600 hover:bg-slate-100"}`}>
                  <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${isActive ? "bg-white/15" : room.tone}`}><Icon className="h-3.5 w-3.5" /></div>
                  <span><span className={`block text-[8px] font-bold ${isActive ? "text-slate-300" : "text-slate-400"}`}>{room.eyebrow}</span><span className="block text-[11px] font-black">{room.title}</span></span>
                </button>;
              })}
            </div>
          )}
        </section>

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
            {activeStudioRoom === "overview" && <section className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div><p className="text-[10px] font-bold text-emerald-600">{activeRoom.eyebrow}</p><h2 className="mt-1 flex items-center gap-1.5 text-xl font-black text-slate-900"><Sparkles className="h-5 w-5 text-emerald-600" />مركز قرار وائل</h2><p className="mt-1 text-sm text-slate-500">ابدأ بالصورة الكاملة، ثم انتقل إلى غرفة القرار التي تريد تعديلها.</p></div>
                <Badge className={hasDeficit ? "bg-red-100 text-red-700 hover:bg-red-100" : "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"}>{hasDeficit ? `تنبيه إسكرو: عجز ${fmt(Math.abs(maxDeficit))}` : "الإسكرو متوازن"}</Badge>
              </div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
                <div className="rounded-lg border border-white bg-white/80 p-2.5"><p className="text-[10px] font-bold text-slate-700">هدف البيع على الخارطة</p><div className="mt-2 flex items-center gap-2"><Slider value={[offPlan]} onValueChange={([value]) => { setOffPlan(value); setSalesMode("auto"); setManualUnits([]); setHasPlanChanges(true); }} min={0} max={100} step={5} /><b className="w-9 text-left text-sm text-emerald-700">{offPlan}%</b></div><p className="mt-1 text-[9px] text-slate-500">{offPlanUnits} وحدة من {totalUnits}</p></div>
                <div className="rounded-lg border border-white bg-white/80 p-2.5"><p className="text-[10px] font-bold text-slate-700">سرعة الامتصاص</p><div className="mt-2 grid grid-cols-2 gap-1">{([{ id: "fast", label: "سريع", speed: 85 }, { id: "bell", label: "متوازن", speed: 50 }, { id: "gradual", label: "تدريجي", speed: 30 }, { id: "late", label: "متأخر", speed: 15 }] as const).map((option) => <button key={option.id} type="button" onClick={() => applySalesPace(option.id, option.speed)} className={`rounded px-1.5 py-1 text-[9px] font-medium ${curveTemplate === option.id && salesMode === "auto" ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{option.label}</button>)}</div><p className="mt-1 text-[9px] text-slate-500">{totalSold} وحدة موزعة حاليًا</p></div>
                <div className="rounded-lg border border-white bg-white/80 p-2.5"><p className="text-[10px] font-bold text-slate-700">قرار السعر</p><p className="mt-1 text-sm font-bold text-emerald-700">{fmt(totalRevenue)} AED</p><div className="mt-2 flex gap-1"><Button type="button" size="sm" variant="outline" className="h-6 flex-1 text-[9px]" onClick={() => adjustAllPrices(0.95)}>خفض 5%</Button><Button type="button" size="sm" variant="outline" className="h-6 flex-1 text-[9px]" onClick={() => adjustAllPrices(1.05)}>رفع 5%</Button></div></div>
                <div className="rounded-lg border border-white bg-white/80 p-2.5"><p className="text-[10px] font-bold text-slate-700">سيولة المشترين</p><div className="mt-2 grid grid-cols-3 gap-1">{([{ id: "early", label: "مبكرة" }, { id: "balanced", label: "متوازنة" }, { id: "handover", label: "تسليم" }] as const).map((option) => <button key={option.id} type="button" onClick={() => applyPaymentPreset(option.id)} className="rounded bg-indigo-50 px-1 py-1 text-[8px] font-medium text-indigo-700 hover:bg-indigo-100">{option.label}</button>)}</div><p className="mt-1 text-[9px] text-slate-500">دفعة أولى {ppDownPct}% · تسليم {ppHandoverPct}%</p></div>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-center md:grid-cols-4"><div className="rounded-md bg-white/70 p-1.5"><p className="text-[8px] text-slate-500">إيراد السيناريو</p><p className="text-[11px] font-bold text-emerald-700">{fmt(totalRevenue)}</p></div><div className="rounded-md bg-white/70 p-1.5"><p className="text-[8px] text-slate-500">أول تحصيل فعلي</p><p className="text-[11px] font-bold text-blue-700">{cashInflowData.find((row) => row.cashInflow > 0)?.month ? `شهر ${cashInflowData.find((row) => row.cashInflow > 0)?.month}` : "—"}</p></div><div className="rounded-md bg-white/70 p-1.5"><p className="text-[8px] text-slate-500">الشهر الحرج</p><p className={`text-[11px] font-bold ${hasDeficit ? "text-red-700" : "text-amber-700"}`}>{criticalMonth ? `شهر ${criticalMonth.month}` : "—"}</p></div><div className="rounded-md bg-white/70 p-1.5"><p className="text-[8px] text-slate-500">الربح المتوقع</p><p className="text-[11px] font-bold text-violet-700">{fmt(profit)}</p></div></div>
            </section>}

            {activeStudioRoom !== "overview" && <section className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3"><div className={`flex h-10 w-10 items-center justify-center rounded-xl ${activeRoom.tone}`}><activeRoom.icon className="h-5 w-5" /></div><div><p className="text-[10px] font-bold text-slate-500">{activeRoom.eyebrow}</p><h2 className="text-lg font-black text-slate-900">{activeRoom.title}</h2><p className="mt-0.5 text-xs text-slate-500">{activeRoom.description}</p></div></div>
                <Button variant="outline" size="sm" onClick={() => setActiveStudioRoom("overview")} className="gap-1.5"><LayoutDashboard className="h-3.5 w-3.5" />العودة للوحة السيناريو</Button>
              </div>
              <div className="space-y-4">
            {/* SECTION 1: PRODUCT PRICE AND BUYER COLLECTION */}
            <div className="space-y-4">
            {/* Pricing Table - 2/3 */}
            <section className={`${activeStudioRoom === "pricing" ? "" : "hidden"} bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden`}>
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
                    {activeResidentialUnits.length > 0 && <><tr><td colSpan={7} className="px-2 py-0.5 text-[10px] font-bold text-blue-700 bg-blue-50/60 border-b border-blue-100">سكني</td></tr>
                    {activeResidentialUnits.map((u) => (
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
                    ))}</>}
                    {activeRetailUnits.length > 0 && <><tr><td colSpan={7} className="px-2 py-0.5 text-[10px] font-bold text-orange-700 bg-orange-50/60 border-b border-orange-100">تجزئة</td></tr>
                    {activeRetailUnits.map((u) => (
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
                    ))}</>}
                    {activeOfficeUnits.length > 0 && <><tr><td colSpan={7} className="px-2 py-0.5 text-[10px] font-bold text-teal-700 bg-teal-50/60 border-b border-teal-100">مكاتب</td></tr>
                    {activeOfficeUnits.map((u) => (
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
                    ))}</>}
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

            {/* Payment Plan */}
            <section className={`${activeStudioRoom === "collection" ? "" : "hidden"} bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden`}>
              <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-indigo-600" />
                <h2 className="text-[11px] font-bold text-gray-800">{isBuildForSale ? "تحصيل البيع" : "خطة الدفع"}</h2>
                <Badge variant={isBuildForSale || ppTotal === 100 ? "secondary" : "destructive"} className="text-[9px]">{isBuildForSale ? "100%" : `${ppTotal}%`}</Badge>
              </div>
              {isBuildForSale && (
                <div className="border-b border-emerald-100 bg-emerald-50 px-3 py-3 space-y-3">
                  <div className="text-center">
                    <p className="text-[11px] font-bold text-emerald-800">دفعة كاملة عند بيع الوحدة</p>
                    <p className="mt-1 text-[9px] leading-4 text-emerald-700">تبدأ المبيعات بعد الإنجاز، وتدخل الحصيلة كاملة مباشرة إلى حساب المستثمر.</p>
                  </div>
                  <div className="rounded-lg border border-emerald-200 bg-white/80 p-2 text-right">
                    <p className="mb-2 text-[10px] font-bold text-emerald-900">تسويق البناء للبيع</p>
                    <div className="grid grid-cols-3 gap-1.5 text-[9px]">
                      <label className="space-y-0.5">
                        <span className="block text-emerald-800">النسبة من الإيراد</span>
                        <input type="number" min={0} max={10} step={0.1} value={buildForSaleMarketingRate} onChange={(e) => { const value = Number(e.target.value) || 0; setBuildForSaleMarketingRate(value); setMarketingPct(value); setHasBuildForSaleMarketingChanges(true); }} className="w-full h-6 rounded border border-emerald-200 bg-white px-1 text-center font-bold" />
                      </label>
                      <label className="space-y-0.5">
                        <span className="block text-emerald-800">قبل الإنجاز (شهر)</span>
                        <input type="number" min={0} max={12} step={1} value={buildForSaleMarketingStartBeforeCompletion} onChange={(e) => { setBuildForSaleMarketingStartBeforeCompletion(Math.max(0, Number(e.target.value) || 0)); setHasBuildForSaleMarketingChanges(true); }} className="w-full h-6 rounded border border-emerald-200 bg-white px-1 text-center font-bold" />
                      </label>
                      <label className="space-y-0.5">
                        <span className="block text-emerald-800">المدة (شهر)</span>
                        <input type="number" min={1} max={24} step={1} value={buildForSaleMarketingDuration} onChange={(e) => { setBuildForSaleMarketingDuration(Math.max(1, Number(e.target.value) || 1)); setHasBuildForSaleMarketingChanges(true); }} className="w-full h-6 rounded border border-emerald-200 bg-white px-1 text-center font-bold" />
                      </label>
                    </div>
                    <p className="mt-1 text-[8px] leading-3 text-emerald-700">القيمة الافتراضية المعتمدة: 1%، تبدأ قبل الإنجاز بشهر وتستمر 3 أشهر.</p>
                    {hasBuildForSaleMarketingChanges && <Button type="button" size="sm" onClick={handleSaveBuildForSaleMarketing} disabled={updateProject.isPending} className="mt-2 h-6 w-full bg-emerald-700 text-[9px] hover:bg-emerald-800">حفظ إعدادات التسويق</Button>}
                  </div>
                </div>
              )}
              <div className={isBuildForSale ? "hidden" : "p-2"}>
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
            <section className={`${activeStudioRoom === "impact" ? "" : "hidden"} grid grid-cols-2 md:grid-cols-6 gap-3`}>
              <KPICard label="الإيرادات" value={fmt(totalRevenue)} sub="AED" color="emerald" />
              <KPICard label="تكلفة المشروع" value={fmt(totalCosts)} sub="كل التكاليف" color="slate" />
              <KPICard label="التسويق" value={fmt(marketingCost)} sub={`${marketingPct}%`} color="amber" />
              <KPICard label="العمولة" value={fmt(commissionCost)} sub={`${commissionPct}%`} color="amber" />
              <KPICard label="الربح" value={fmt(profit)} sub="AED" color={profit >= 0 ? "blue" : "red"} />
              <KPICard label="ROI" value={roiCosts + "%"} sub="على التكاليف" color="violet" />
            </section>

            {/* SECTION 3: SALES SETTINGS */}
            <section className={`${activeStudioRoom === "sales" ? "" : "hidden"} bg-white rounded-xl border border-gray-100 shadow-sm p-3`}>
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
            <section className={`${activeStudioRoom === "marketing" ? "" : "hidden"} bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden`}>
              <div className="px-3 py-2 border-b border-gray-100">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-blue-600" />
                    <h2 className="text-[11px] font-bold text-gray-800">الجدول الزمني</h2>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-gray-500">تصاميم:</span>
                      <span className="text-[10px] font-bold text-blue-700">{timeline.designEnd} شهر</span>
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
                    {Array.from({ length: timelineDisplayEndMonth }, (_, i) => {
                      const isDesign = i < timeline.designEnd;
                      const displayNum = isDesign ? i + 1 : i - timeline.designEnd + 1;
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
                  {visibleTimelinePhases.map((phase) => {
                    let start = 0, end = 0;
                    if (phase.id === "design") { start = 1; end = timeline.designEnd; }
                    else if (phase.id === "materials") { start = timeline.materialsStart; end = sharedTiming.materialsEndMonth; }
                    else if (phase.id === "rera") { start = timeline.reraStart; end = sharedTiming.reraEndMonth; }
                    else if (phase.id === "marketing") { start = activityWindows.marketing.startMonth; end = activityWindows.marketing.endMonth; }
                    else if (phase.id === "sales") { start = activityWindows.sales.startMonth; end = activityWindows.sales.endMonth; }
                    else if (phase.id === "construction") { start = timeline.constructionStart; end = timeline.projectEnd; }
                    const total = timelineDisplayEndMonth;
                    const rightPct = ((start - 1) / total) * 100;
                    const widthPct = ((end - start + 1) / total) * 100;
                    const Icon = phase.icon;
                    return (
                      <div key={phase.id} className="flex items-center gap-2">
                        <div className="w-32 flex items-center gap-1.5 flex-shrink-0">
                          <Icon className="w-3 h-3" style={{ color: phase.color }} />
                          <span className="text-[10px] font-medium text-gray-700 truncate">{phase.name}</span>
                        </div>
                        <div className="flex-1 h-5 bg-gray-100 rounded-full relative overflow-hidden" style={{ backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent calc(100% / ' + timelineDisplayEndMonth + ' - 1px), rgba(0,0,0,0.04) calc(100% / ' + timelineDisplayEndMonth + ' - 1px), rgba(0,0,0,0.04) calc(100% / ' + timelineDisplayEndMonth + '))' }}>
                          <div className="absolute h-full rounded-full transition-all" style={{ right: `${rightPct}%`, width: `${widthPct}%`, backgroundColor: phase.color, opacity: 0.8 }} />
                          <span className="absolute inset-0 flex items-center justify-center text-[8px] font-medium text-gray-700">شهر {start} - {end}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2 flex-wrap text-[10px] text-gray-500">
                  <span>نقطة الانطلاق (اكتمال المخططات التخطيطية): <strong className="text-gray-800">شهر {sharedTiming.schematicCompletionMonth}</strong></span>
                  {!isBuildForSale && <span>مدة تحضير المواد: <strong className="text-gray-800">{sharedTiming.marketingPrepMonths} شهر</strong></span>}
                  {!isBuildForSale && <span>مدة ريرا: <strong className="text-gray-800">{sharedTiming.reraApprovalMonths} شهر</strong></span>}
                  <Badge className="text-[8px] bg-pink-100 text-pink-700">التسويق: {isBuildForSale ? `قبل الإنجاز بـ ${buildForSaleMarketingStartBeforeCompletion} شهر لمدة ${buildForSaleMarketingDuration} أشهر` : activityWindows.marketing.hasSavedActivity ? "سيناريو وائل" : "توقع افتراضي"}</Badge>
                  <Badge className="text-[8px] bg-emerald-100 text-emerald-700">المبيعات: {activityWindows.sales.hasSavedActivity ? "خطة المبيعات" : "توقع افتراضي"}</Badge>
                </div>
              </div>
            </section>

            {/* SECTION 5: SALES INPUT (Manual - aligned to escrow range) */}
            <section className={`${activeStudioRoom === "sales" ? "" : "hidden"} bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden`}>
              <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
                  <h2 className="text-[11px] font-bold text-gray-800">توزيع البيع</h2>
                  <Badge variant="secondary" className="text-[10px]">{totalSold} / {offPlanUnits} وحدة</Badge>
                  {totalSold > offPlanUnits && <Badge variant="destructive" className="text-[9px]">تجاوز!</Badge>}
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => setShowSalesPrecision((value) => !value)} className="h-7 text-[10px] gap-1 border-blue-200 text-blue-700 hover:bg-blue-50">
                  <Table2 className="w-3 h-3" />
                  {showSalesPrecision ? "إخفاء محرر الأشهر" : "تخصيص الأشهر بدقة"}
                </Button>
              </div>
              <div className="p-3">
                {(() => {
                  const monthsPerPage = 6;
                  const maxPage = Math.max(0, Math.ceil(salesMonths / monthsPerPage) - 1);
                  const page = Math.min(salesCalendarPage, maxPage);
                  const pageStartIndex = page * monthsPerPage;
                  const visibleMonths = salesDistribution.slice(pageStartIndex, pageStartIndex + monthsPerPage);
                  const monthNames = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
                  return <div className="mb-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2"><div><p className="text-[11px] font-black text-slate-800">خريطة البيع القريبة</p><p className="text-[9px] text-slate-500">ستة أشهر واضحة بدل شريط طويل غير مقروء</p></div><div className="flex items-center gap-1"><Button type="button" size="sm" variant="outline" disabled={page === 0} onClick={() => setSalesCalendarPage(Math.max(0, page - 1))} className="h-7 px-2 text-[10px]">التالي</Button><span className="min-w-16 text-center text-[9px] font-bold text-slate-500">{page + 1} / {maxPage + 1}</span><Button type="button" size="sm" variant="outline" disabled={page === maxPage} onClick={() => setSalesCalendarPage(Math.min(maxPage, page + 1))} className="h-7 px-2 text-[10px]">السابق</Button></div></div>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">{visibleMonths.map((units, index) => { const absoluteMonth = salesStartMonth + pageStartIndex + index; const monthIndex = projectStartDate ? ((Number(projectStartDate.split("-")[1]) - 1 + absoluteMonth - 1) % 12 + 12) % 12 : -1; const percentage = offPlanUnits ? Math.round((units / offPlanUnits) * 100) : 0; return <div key={absoluteMonth} className={`rounded-xl border p-2 text-center ${units > 0 ? "border-emerald-200 bg-white" : "border-slate-200 bg-white/60"}`}><p className="text-[9px] font-bold text-slate-500">{monthIndex >= 0 ? monthNames[monthIndex] : `شهر ${absoluteMonth}`}</p><p className="mt-1 text-lg font-black text-emerald-700">{units}</p><p className="text-[8px] text-slate-500">وحدة · {percentage}%</p><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, Math.max(0, (units / Math.max(...salesDistribution, 1)) * 100))}%` }} /></div></div>; })}</div>
                  </div>;
                })()}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 rounded-xl border border-blue-100 bg-gradient-to-l from-blue-50/80 via-white to-emerald-50/50 p-3">
                  <div>
                    <p className="text-[10px] font-bold text-slate-700">1. هدف البيع</p>
                    <p className="mt-1 text-[9px] text-slate-500">حدد حصة المشروع المخصصة للبيع على الخارطة.</p>
                    <div className="mt-2 flex items-center gap-2"><Slider value={[offPlan]} onValueChange={([value]) => setOffPlan(value)} min={0} max={100} step={5} /><span className="w-11 text-left text-sm font-black text-blue-700">{offPlan}%</span></div>
                    <p className="mt-1 text-[9px] text-slate-600">الهدف الحالي: <strong>{offPlanUnits} وحدة</strong></p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-700">2. إيقاع البيع</p>
                    <p className="mt-1 text-[9px] text-slate-500">اختر شكل الامتصاص، والنظام يوزع الوحدات تلقائيًا.</p>
                    <div className="mt-2 grid grid-cols-4 gap-1">
                      {(["fast", "bell", "gradual", "late"] as const).map((template) => {
                        const labels = { fast: "سريع", bell: "متوازن", gradual: "تدريجي", late: "متأخر" };
                        return <button key={template} type="button" onClick={() => applySalesPace(template)} className={`rounded-lg px-1.5 py-1.5 text-[9px] font-bold transition ${curveTemplate === template ? "bg-blue-600 text-white shadow-sm" : "bg-white text-slate-600 border border-slate-200 hover:bg-blue-50"}`}>{labels[template]}</button>;
                      })}
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-700">3. النتيجة المقترحة</p>
                    <p className="mt-1 text-[9px] text-slate-500">توزيع تلقائي قابل للمراجعة، لا إدخال شهر بشهر.</p>
                    <div className="mt-2 flex items-end gap-1 h-9" aria-label="شكل توزيع البيع المقترح">
                      {salesDistribution.slice(0, 12).map((units, index) => <span key={index} className="flex-1 rounded-t bg-emerald-400/80" style={{ height: `${Math.max(8, (units / Math.max(...salesDistribution, 1)) * 100)}%` }} title={`شهر ${salesStartMonth + index}: ${units} وحدة`} />)}
                    </div>
                    <p className="mt-1 text-[9px] text-emerald-700 font-bold">{totalSold} وحدة موزعة تلقائيًا عبر {salesMonths} شهر</p>
                  </div>
                </div>

                {!showSalesPrecision && <div className="mt-3 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-[10px] text-slate-600"><strong className="text-slate-800">لا تحتاج لملء 30 خانة.</strong> عدّل الهدف أو إيقاع البيع أعلاه؛ وافتح محرر الأشهر فقط عندما تحتاج تعديل شهر محدد يدويًا.</div>}

                {showSalesPrecision && <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white p-2">
                {(() => {
                  const salesScheduleStartMonth = salesStartMonth;
                  const salesScheduleEndMonth = salesEndMonth;
                  const salesScheduleMonthCount = salesScheduleEndMonth - salesScheduleStartMonth + 1;
                  const colWidth = `minmax(42px, 1fr)`;
                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: `60px repeat(${salesScheduleMonthCount}, ${colWidth})`, direction: 'rtl' }}>
                      {/* Row 1: Month labels */}
                      <div className="text-[8px] font-bold text-gray-500 flex items-center justify-center border-b border-gray-200 py-0.5">الشهر</div>
                      {Array.from({ length: salesScheduleMonthCount }, (_, i) => {
                        const absMonth = salesScheduleStartMonth + i;
                        const isDesign = absMonth <= timeline.designEnd;
                        const displayNum = isDesign ? absMonth : absMonth - timeline.designEnd;
                        const MN = ["ينا","فبر","مار","أبر","ماي","يون","يول","أغس","سبت","أكت","نوف","ديس"];
                        let mLabel = "";
                        if (projectStartDate) { const [y,m] = projectStartDate.split("-").map(Number); if (y&&m) mLabel = MN[(m-1+absMonth-1)%12]; }
                        return (
                          <div key={i} className={`text-center py-0.5 border-b border-l border-gray-200 flex flex-col items-center leading-tight ${isDesign ? 'bg-blue-50' : 'bg-emerald-50'}`}>
                            <span className={`text-[6px] ${isDesign ? 'text-blue-400' : 'text-emerald-400'}`}>{displayNum}</span>
                            <span className={`text-[7px] font-bold ${isDesign ? 'text-blue-700' : 'text-emerald-700'}`}>{mLabel || displayNum}</span>
                          </div>
                        );
                      })}
                      {/* Row 2: Unit inputs */}
                      <div className="text-[8px] font-bold text-gray-500 flex items-center justify-center border-b border-gray-200 py-0.5">وحدات</div>
                      {Array.from({ length: salesScheduleMonthCount }, (_, i) => {
                        const absMonth = salesScheduleStartMonth + i;
                        const salesIdx = absMonth - salesStartMonth;
                        const inSalesRange = salesIdx >= 0 && salesIdx < salesMonths;
                        const val = inSalesRange ? (manualUnits[salesIdx] ?? salesDistribution[salesIdx] ?? 0) : 0;
                        return (
                          <div key={i} className="flex items-center justify-center border-b border-l border-gray-200 py-0.5">
                            {inSalesRange ? (
                              <input
                                type="number" min={0} max={50} value={val}
                                onChange={(e) => updateSalesMonth(salesIdx, +e.target.value)}
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
                      {Array.from({ length: salesScheduleMonthCount }, (_, i) => {
                        const absMonth = salesScheduleStartMonth + i;
                        const salesIdx = absMonth - salesStartMonth;
                        const inSalesRange = salesIdx >= 0 && salesIdx < salesMonths;
                        const val = inSalesRange ? (manualUnits[salesIdx] ?? salesDistribution[salesIdx] ?? 0) : 0;
                        const pct = offPlanUnits > 0 ? ((val / offPlanUnits) * 100).toFixed(0) : '0';
                        return (
                          <div key={i} className="flex items-center justify-center border-l border-gray-200 py-0.5">
                            {inSalesRange ? (
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={pct}
                                onChange={(e) => updateSalesMonth(salesIdx, Math.round((Math.max(0, Number(e.target.value) || 0) / 100) * offPlanUnits))}
                                className="h-5 w-8 rounded border border-emerald-200 bg-emerald-50 text-center text-[9px] font-black text-emerald-800 focus:ring-1 focus:ring-emerald-300"
                              />
                            ) : '-'}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
                </div>}
              </div>
            </section>

            {!isBuildForSale && <section className={`${activeStudioRoom === "marketing" ? "" : "hidden"} bg-white rounded-xl border border-pink-100 shadow-sm overflow-hidden`}>
              <div className="px-3 py-2 border-b border-pink-100 bg-pink-50/40 flex items-center justify-between">
                <div className="flex items-center gap-1.5"><Megaphone className="w-3.5 h-3.5 text-pink-600" /><h2 className="text-[11px] font-bold text-gray-800">قرار التسويق</h2><Badge variant={totalChannelPct === 100 ? "secondary" : "destructive"} className="text-[9px]">القنوات: {totalChannelPct}%</Badge></div>
                <span className="text-[9px] text-pink-700">الإنفاق هنا ينعكس مباشرة في الربح والتدفقات</span>
              </div>
              <div className="p-3 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="rounded-lg border border-pink-100 bg-pink-50/30 p-2"><div className="flex justify-between text-[10px] font-medium"><span>ميزانية التسويق</span><span className="text-pink-700 font-bold">{marketingPct}%</span></div><Slider value={[marketingPct]} onValueChange={([value]) => { setMarketingPct(value); setHasMarketingChanges(true); }} min={0} max={10} step={0.5} className="mt-2" /><p className="mt-1 text-[9px] text-gray-500">{fmtFull(Math.round(marketingCost))} AED</p></div>
                  <div className="rounded-lg border border-pink-100 bg-pink-50/30 p-2"><p className="text-[10px] font-medium">نهاية الحملة</p><div className="mt-1 flex items-center gap-1"><span className="text-[9px] text-gray-500">شهر {timeline.marketingStart} ←</span><input type="number" min={timeline.marketingStart} max={timeline.projectEnd} value={marketingActualEnd} onChange={(event) => { setMarketingActualStart(timeline.marketingStart); setMarketingActualEnd(Math.max(timeline.marketingStart, Math.min(timeline.projectEnd, Number(event.target.value) || timeline.projectEnd))); setHasMarketingChanges(true); }} className="h-6 w-14 border border-pink-300 rounded text-center text-[10px] font-bold text-pink-700" /></div><p className="mt-1 text-[8px] text-gray-500">البداية من قواعد المشروع؛ وائل يحدد الاستمرار.</p></div>
                  <div className="rounded-lg border border-emerald-100 bg-emerald-50/30 p-2">{(() => { const entered = Object.values(marketingDistribution).flat().reduce((sum, value) => sum + (value || 0), 0); const remaining = marketingCost - entered; return <><p className="text-[10px] font-medium">توزيع الميزانية</p><p className={`mt-1 text-[11px] font-bold ${Math.abs(remaining) < 100 ? "text-emerald-700" : "text-amber-700"}`}>{fmtFull(Math.round(entered))} / {fmtFull(Math.round(marketingCost))}</p><p className="text-[8px] text-gray-500">{Math.abs(remaining) < 100 ? "موزعة بالكامل" : `${remaining > 0 ? "متبقي" : "تجاوز"}: ${fmtFull(Math.abs(Math.round(remaining)))}`}</p></>; })()}</div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">{MARKETING_CHANNELS.map((channel) => { const allocation = channelPcts[channel.id] || 0; return <div key={channel.id} className="rounded-lg border border-gray-100 p-2"><div className="flex justify-between text-[10px]"><span><span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: channel.color }} /> {channel.name}</span><b style={{ color: channel.color }}>{allocation}%</b></div><Slider value={[allocation]} onValueChange={([value]) => handleChannelSliderChange(channel.id, value)} min={0} max={100} step={5} className="mt-2" /><p className="mt-1 text-[8px] text-gray-500">{fmtFull(Math.round(marketingCost * allocation / 100))} AED</p></div>; })}</div>
                <div className="flex items-center justify-between border-t pt-2"><p className="text-[9px] text-gray-500">القنوات لا تتجاوز 100%؛ التوزيع الشهري يُحفظ مع السيناريو نفسه.</p><Button type="button" variant="outline" size="sm" className="h-6 text-[9px] gap-1" onClick={() => { const months = Math.max(1, marketingActualEnd - timeline.marketingStart + 1); const distribution: Record<string, number[]> = {}; MARKETING_CHANNELS.forEach((channel) => { distribution[channel.id] = Array(months).fill(Math.round((marketingCost * ((channelPcts[channel.id] || 0) / 100)) / months)); }); setMarketingDistribution(distribution); setMarketingActualStart(timeline.marketingStart); setHasMarketingChanges(true); }}><RefreshCw className="w-3 h-3" />توزيع متوازن</Button></div>
              </div>
            </section>}

            {/* SECTION 7: ESCROW (GUARANTEE ACCOUNT) */}
            {!isBuildForSale && <section className={`${activeStudioRoom === "impact" ? "" : "hidden"} bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden`}>
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
                        const MN = ["ينا","فبر","مار","أبر","ماي","يون","يول","أغس","سبت","أكت","نوف","ديس"];
                        let mLabel = "";
                        if (projectStartDate) { const [y,m] = projectStartDate.split("-").map(Number); if (y&&m) mLabel = MN[(m-1+absMonth-1)%12]; }
                        return (
                          <div key={i} className={`text-center py-0.5 border-b border-l border-gray-200 flex flex-col items-center leading-tight ${isCritical ? 'bg-red-100' : isDesign ? 'bg-blue-50' : 'bg-emerald-50'}`}>
                            <span className={`text-[6px] ${isCritical ? 'text-red-400' : isDesign ? 'text-blue-400' : 'text-emerald-400'}`}>{displayNum}</span>
                            <span className={`text-[7px] font-bold ${isCritical ? 'text-red-700' : isDesign ? 'text-blue-700' : 'text-emerald-700'}`}>{mLabel || displayNum}</span>
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
            </section>}

            {/* SECTION 8: CASH INFLOW RESULTS TABLE (Payment Plan × Sales) */}
            <section className={`${activeStudioRoom === "collection" ? "" : "hidden"} bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden`}>
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
                      const isPostCompletion = row.month > timeline.projectEnd;
                      const isSalesStart = row.month === salesStartMonth;
                      return (
                        <tr key={i} className={`border-b border-gray-50 ${!isActive ? 'opacity-30' : 'hover:bg-blue-50/30'} ${isSalesStart ? 'border-t-2 border-t-amber-300' : ''}`}>
                          <td className="py-0.5 px-1.5 text-gray-400 font-mono">{row.month}</td>
                          <td className="py-0.5 px-1.5 font-medium text-gray-700">
                            {(() => { const MN=["ينا","فبر","مار","أبر","ماي","يون","يول","أغس","سبت","أكت","نوف","ديس"]; let ml=""; if(projectStartDate){const[y,m]=projectStartDate.split("-").map(Number);if(y&&m)ml=MN[(m-1+row.month-1)%12];} return ml ? <><span className="font-bold">{ml}</span> <span className="text-[7px] text-gray-400">{row.month}</span></> : `شهر ${row.month}`; })()}
                          </td>
                          <td className="py-0.5 px-1.5 text-center">
                            <span className={`inline-block px-1 py-0.5 rounded text-[8px] font-bold ${isDesign ? 'bg-purple-50 text-purple-600' : isPostCompletion ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-600'}`}>
                              {isDesign ? 'تصاميم' : isPostCompletion ? 'ما بعد الإنجاز' : 'بناء'}
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
            <section className={`${activeStudioRoom === "collection" ? "" : "hidden"} bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden`}>
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
                      {cashInflowData.map(({ month: m }) => {
                        const MN=["\u064a\u0646\u0627","\u0641\u0628\u0631","\u0645\u0627\u0631","\u0623\u0628\u0631","\u0645\u0627\u064a","\u064a\u0648\u0646","\u064a\u0648\u0644","\u0623\u063a\u0633","\u0633\u0628\u062a","\u0623\u0643\u062a","\u0646\u0648\u0641","\u062f\u064a\u0633"];
                        let ml=""; if(projectStartDate){const[y,mo]=projectStartDate.split("-").map(Number);if(y&&mo)ml=MN[(mo-1+m-1)%12];}
                        return (
                          <th key={m} className={`py-1 px-0.5 text-center min-w-[45px] ${m === salesStartMonth ? 'border-l-2 border-amber-300' : ''} ${m >= salesStartMonth ? 'text-gray-700' : 'text-gray-400'}`}>
                            <div className="flex flex-col items-center leading-tight">
                              <span className="text-[6px] text-gray-400">{m}</span>
                              <span className="text-[7px] font-bold">{ml || `\u0634${m}`}</span>
                            </div>
                          </th>
                        );
                      })}
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
                          <td className="py-0.5 px-1 font-bold text-purple-700 sticky left-0 bg-inherit z-10">
                            {(() => { const MN=["\u064a\u0646\u0627","\u0641\u0628\u0631","\u0645\u0627\u0631","\u0623\u0628\u0631","\u0645\u0627\u064a","\u064a\u0648\u0646","\u064a\u0648\u0644","\u0623\u063a\u0633","\u0633\u0628\u062a","\u0623\u0643\u062a","\u0646\u0641","\u062f\u064a\u0633"]; let ml=""; if(projectStartDate){const[y,m]=projectStartDate.split("-").map(Number);if(y&&m)ml=MN[(m-1+saleMonth-1)%12];} return ml ? <>{ml} <span className="text-[7px] text-purple-400">{saleMonth}</span></> : `\u0634\u0647\u0631 ${saleMonth}`; })()}
                            ({salesDistribution[saleMonth - salesStartMonth] || 0} \u0648\u062d\u062f\u0629)
                          </td>
                          <td className="py-0.5 px-1 font-mono text-emerald-700 sticky left-[80px] bg-inherit z-10">{fmtFull(Math.round(saleAmount))}</td>
                          {cashInflowData.map(({ month: m }) => {
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
                      {cashInflowData.map(({ month: m }) => {
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
                <strong>ملاحظة:</strong> {isBuildForSale
                  ? "كل خلية صفراء تمثل تحصيلاً كاملاً ومباشراً للمستثمر في شهر بيع الوحدة."
                  : "الخلية الصفراء = دفعة الحجز (في شهر البيع) | الخلايا الزرقاء = أقساط لاحقة حسب البيمنت بلان | الصف الأخير = إجمالي ما يدخل الإسكرو كل شهر"}
              </div>
            </section>
            )}

              </div>
            </section>}
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
