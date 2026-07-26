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
  Building2, Percent, CreditCard,
} from "lucide-react";
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

const MARKETING_CHANNELS = [
  { id: "digital", name: "التسويق الرقمي", defaultPct: 35, color: "#3b82f6" },
  { id: "outdoor", name: "الإعلانات الخارجية", defaultPct: 20, color: "#10b981" },
  { id: "events", name: "المعارض والفعاليات", defaultPct: 15, color: "#f59e0b" },
  { id: "broker", name: "شبكة الوسطاء", defaultPct: 15, color: "#8b5cf6" },
  { id: "pr", name: "العلاقات العامة", defaultPct: 10, color: "#ec4899" },
  { id: "content", name: "المحتوى والعلامة", defaultPct: 5, color: "#06b6d4" },
];

const PROJECT_PHASES = [
  { id: "design", name: "التصميم المعماري", color: "#3b82f6", icon: Palette },
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
  const [marketingPrepLead, setMarketingPrepLead] = useState(3);
  const [reraLead, setReraLead] = useState(2);
  const [marketingPct, setMarketingPct] = useState(2);
  const [commissionPct, setCommissionPct] = useState(5);
  const [offPlan, setOffPlan] = useState(80);
  const [speed, setSpeed] = useState(50);
  const [curveTemplate, setCurveTemplate] = useState<"bell" | "fast" | "gradual" | "late">("bell");
  const [salesMode, setSalesMode] = useState<"auto" | "manual">("auto");
  const [manualUnits, setManualUnits] = useState<number[]>([]);
  const [channelPcts, setChannelPcts] = useState<Record<string, number>>(
    Object.fromEntries(MARKETING_CHANNELS.map((c) => [c.id, c.defaultPct]))
  );
  const [hasPlanChanges, setHasPlanChanges] = useState(false);

  // ─── State: Payment Plan ───────────────────────────────────────────────────
  const [downPaymentPct, setDownPaymentPct] = useState(20); // دفعة أولى
  const [duringConstructionPct, setDuringConstructionPct] = useState(50); // أثناء الإنشاء
  const [onHandoverPct, setOnHandoverPct] = useState(30); // عند التسليم

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
      if (p.marketingPct) setMarketingPct(Number(p.marketingPct));
      if (p.salesCommissionPct) setCommissionPct(Number(p.salesCommissionPct));
    }
  }, [projectQuery.data]);

  useEffect(() => {
    if (plansQuery.data && plansQuery.data.length > 0) {
      const plan = plansQuery.data[0] as any;
      setPlanId(plan.id);
      if (plan.offplanPct) setOffPlan(plan.offplanPct);
      if (plan.channelsJson) {
        try { setChannelPcts(JSON.parse(plan.channelsJson)); } catch {}
      }
      if (plan.salesAbsorptionJson) {
        try {
          const parsed = JSON.parse(plan.salesAbsorptionJson);
          if (parsed.mode) setSalesMode(parsed.mode);
          if (parsed.speed) setSpeed(parsed.speed);
          if (parsed.template) setCurveTemplate(parsed.template);
          if (parsed.manual) setManualUnits(parsed.manual);
          if (parsed.marketingPrepLead) setMarketingPrepLead(parsed.marketingPrepLead);
          if (parsed.reraLead) setReraLead(parsed.reraLead);
          if (parsed.downPaymentPct) setDownPaymentPct(parsed.downPaymentPct);
          if (parsed.duringConstructionPct) setDuringConstructionPct(parsed.duringConstructionPct);
          if (parsed.onHandoverPct) setOnHandoverPct(parsed.onHandoverPct);
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

  // ─── Computed: Costs ──────────────────────────────────────────────────────
  const constructionCostPerSqft = projectQuery.data ? Number((projectQuery.data as any).estimatedConstructionPricePerSqft) || 400 : 400;
  const constructionCost = totalArea * constructionCostPerSqft;
  const marketingCost = totalRevenue * (marketingPct / 100);
  const commissionCost = totalRevenue * (commissionPct / 100);
  const totalCosts = constructionCost + marketingCost + commissionCost;
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

  // ─── Save Handlers ────────────────────────────────────────────────────────
  const handleSaveUnits = useCallback(() => {
    if (!selectedProjectId) return;
    const payload: Record<string, any> = { id: selectedProjectId };
    UNIT_TYPES.forEach((u) => {
      const d = unitData[u.id];
      if (d) { payload[u.dbCount] = d.count; payload[u.dbArea] = d.area; payload[u.dbPrice] = d.price; }
    });
    payload.marketingPct = String(marketingPct);
    payload.salesCommissionPct = String(commissionPct);
    updateProject.mutate(payload as any);
    setHasUnitChanges(false);
  }, [selectedProjectId, unitData, marketingPct, commissionPct, updateProject]);

  const handleSavePlan = useCallback(() => {
    if (!selectedProjectId) return;
    savePlan.mutate({
      id: planId,
      projectId: selectedProjectId,
      totalRevenue,
      designMonths,
      constructionMonths,
      offplanPct: offPlan,
      marketingBudgetPct: String(marketingPct),
      salesCommissionPct: String(commissionPct),
      salesAbsorptionJson: JSON.stringify({ mode: salesMode, speed, template: curveTemplate, manual: manualUnits, marketingPrepLead, reraLead, downPaymentPct, duringConstructionPct, onHandoverPct }),
      channelsJson: JSON.stringify(channelPcts),
      resultsJson: JSON.stringify({ escrowData, salesDistribution }),
    });
    setHasPlanChanges(false);
  }, [selectedProjectId, planId, totalRevenue, designMonths, constructionMonths, offPlan, marketingPct, commissionPct, salesMode, speed, curveTemplate, manualUnits, channelPcts, escrowData, salesDistribution, marketingPrepLead, reraLead, savePlan]);

  const updateUnit = (id: string, field: "count" | "area" | "price", value: number) => {
    setUnitData((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
    setHasUnitChanges(true);
  };

  // ═══════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════════
  return (
    <div className="bg-white p-2" dir="rtl">
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
            {/* SECTION 1: UNIT PRICING TABLE */}
            <section className="bg-white rounded-xl border border-gray-100 shadow-md overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                  <h2 className="text-sm font-bold text-gray-800">جدول التسعير</h2>
                  <Badge variant="secondary" className="text-[10px]">{totalUnits} وحدة</Badge>
                </div>
                <p className="text-xs text-gray-500">الإيرادات: <span className="font-bold text-emerald-700">{fmt(totalRevenue)} AED</span></p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-right font-medium text-gray-600">النوع</th>
                      <th className="px-3 py-2 text-center font-medium text-gray-600">العدد</th>
                      <th className="px-3 py-2 text-center font-medium text-gray-600">المساحة (قدم²)</th>
                      <th className="px-3 py-2 text-center font-medium text-gray-600">سعر/قدم (AED)</th>
                      <th className="px-3 py-2 text-center font-medium text-gray-600">إجمالي المساحة</th>
                      <th className="px-3 py-2 text-center font-medium text-gray-600">إجمالي الإيراد</th>
                      <th className="px-3 py-2 text-center font-medium text-gray-600">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unitRevenues.map((u) => (
                      <tr key={u.id} className="border-t border-gray-50 hover:bg-gray-50/50">
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: u.color }} />
                            <span className="font-medium text-gray-800">{u.name}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <input type="number" min={0} value={u.count} onChange={(e) => updateUnit(u.id, "count", parseInt(e.target.value) || 0)}
                            className="w-14 h-7 text-center text-xs border border-gray-200 rounded bg-white focus:border-blue-400 focus:ring-1 focus:ring-blue-200" />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <input type="number" min={0} value={u.area} onChange={(e) => updateUnit(u.id, "area", parseInt(e.target.value) || 0)}
                            className="w-16 h-7 text-center text-xs border border-gray-200 rounded bg-white focus:border-blue-400 focus:ring-1 focus:ring-blue-200" />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <input type="number" min={0} value={u.price} onChange={(e) => updateUnit(u.id, "price", parseInt(e.target.value) || 0)}
                            className="w-16 h-7 text-center text-xs border border-gray-200 rounded bg-white focus:border-blue-400 focus:ring-1 focus:ring-blue-200" />
                        </td>
                        <td className="px-3 py-2 text-center font-mono text-gray-700">{fmtFull(u.totalArea)}</td>
                        <td className="px-3 py-2 text-center font-mono font-medium text-emerald-700">{fmt(u.total)}</td>
                        <td className="px-3 py-2 text-center text-gray-500">{totalRevenue > 0 ? ((u.total / totalRevenue) * 100).toFixed(1) : 0}%</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                    <tr>
                      <td className="px-3 py-2 font-bold text-gray-800">المجموع</td>
                      <td className="px-3 py-2 text-center font-bold">{totalUnits}</td>
                      <td className="px-3 py-2" />
                      <td className="px-3 py-2" />
                      <td className="px-3 py-2 text-center font-mono font-bold">{fmtFull(totalArea)}</td>
                      <td className="px-3 py-2 text-center font-mono font-bold text-emerald-700">{fmt(totalRevenue)}</td>
                      <td className="px-3 py-2 text-center font-bold">100%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>

            {/* SECTION 2: FINANCIAL SUMMARY */}
            <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <KPICard label="الإيرادات" value={fmt(totalRevenue)} sub="AED" color="emerald" />
              <KPICard label="تكلفة الإنشاء" value={fmt(constructionCost)} sub="AED" color="slate" />
              <KPICard label="التسويق + العمولة" value={fmt(marketingCost + commissionCost)} sub="AED" color="amber" />
              <KPICard label="الربح" value={fmt(profit)} sub="AED" color={profit >= 0 ? "blue" : "red"} />
              <KPICard label="ROI" value={roiCosts + "%"} sub="على التكاليف" color="violet" />
            </section>

            {/* SECTION 3: OPERATION COSTS + MARKETING DISTRIBUTION */}
            <section className="grid grid-cols-12 gap-3">
              <div className="col-span-12 md:col-span-4 bg-white rounded-xl border border-gray-100 shadow-md p-2 space-y-1">
                <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                  <Percent className="w-4 h-4 text-amber-600" />
                  تكاليف العملية
                </h3>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-600">ميزانية التسويق</span>
                    <span className="text-xs font-bold text-blue-700">{marketingPct}%</span>
                  </div>
                  <Slider value={[marketingPct]} onValueChange={([v]) => { setMarketingPct(v); setHasUnitChanges(true); setHasPlanChanges(true); }} min={0} max={10} step={0.5} className="w-full" />
                  <p className="text-[10px] text-gray-400 mt-0.5">{fmtFull(Math.round(marketingCost))} AED</p>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-600">عمولة المبيعات</span>
                    <span className="text-xs font-bold text-purple-700">{commissionPct}%</span>
                  </div>
                  <Slider value={[commissionPct]} onValueChange={([v]) => { setCommissionPct(v); setHasUnitChanges(true); setHasPlanChanges(true); }} min={0} max={10} step={0.5} className="w-full" />
                  <p className="text-[10px] text-gray-400 mt-0.5">{fmtFull(Math.round(commissionCost))} AED</p>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-600">نسبة البيع على الخارطة</span>
                    <span className="text-xs font-bold text-emerald-700">{offPlan}%</span>
                  </div>
                  <Slider value={[offPlan]} onValueChange={([v]) => { setOffPlan(v); setHasPlanChanges(true); }} min={30} max={100} step={5} className="w-full" />
                  <p className="text-[10px] text-gray-400 mt-0.5">{offPlanUnits} وحدة من {totalUnits}</p>
                </div>
              </div>
              <div className="col-span-12 md:col-span-8 bg-white rounded-xl border border-gray-100 shadow-md p-2">
                <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2 mb-3">
                  <Megaphone className="w-4 h-4 text-pink-600" />
                  توزيع قنوات التسويق
                  <Badge variant="secondary" className="text-[10px]">{fmtFull(Math.round(marketingCost))} AED</Badge>
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {MARKETING_CHANNELS.map((ch) => (
                    <div key={ch.id} className="rounded-lg border border-gray-100 p-2.5">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-medium text-gray-700">{ch.name}</span>
                        <span className="text-[11px] font-bold" style={{ color: ch.color }}>{channelPcts[ch.id] || 0}%</span>
                      </div>
                      <Slider value={[channelPcts[ch.id] || 0]} onValueChange={([v]) => { setChannelPcts((prev) => ({ ...prev, [ch.id]: v })); setHasPlanChanges(true); }} min={0} max={60} step={5} className="w-full" />
                      <p className="text-[9px] text-gray-400 mt-1">{fmtFull(Math.round(marketingCost * (channelPcts[ch.id] || 0) / 100))} AED</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* SECTION 4: PROJECT PHASES TIMELINE */}
            <section className="bg-white rounded-xl border border-gray-100 shadow-md overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  <h2 className="text-sm font-bold text-gray-800">الجدول الزمني</h2>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-gray-500">تصاميم:</span>
                    <input type="number" min={1} max={24} value={designMonths} onChange={(e) => { setDesignMonths(parseInt(e.target.value) || 8); setHasPlanChanges(true); }}
                      className="w-10 h-6 text-center text-[10px] border border-gray-200 rounded" />
                    <span className="text-[10px] text-gray-400">شهر</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-gray-500">إنشاء:</span>
                    <input type="number" min={6} max={60} value={constructionMonths} onChange={(e) => { setConstructionMonths(parseInt(e.target.value) || 30); setHasPlanChanges(true); }}
                      className="w-10 h-6 text-center text-[10px] border border-gray-200 rounded" />
                    <span className="text-[10px] text-gray-400">شهر</span>
                  </div>
                </div>
              </div>
              <div className="p-2">
                <div className="space-y-2">
                  {PROJECT_PHASES.map((phase) => {
                    let start = 0, end = 0;
                    if (phase.id === "design") { start = 1; end = timeline.designEnd; }
                    else if (phase.id === "materials") { start = timeline.materialsStart; end = timeline.materialsStart + 2; }
                    else if (phase.id === "rera") { start = timeline.reraStart; end = timeline.reraStart + 1; }
                    else if (phase.id === "marketing") { start = timeline.marketingStart; end = timeline.projectEnd; }
                    else if (phase.id === "sales") { start = timeline.salesStart; end = timeline.projectEnd; }
                    else if (phase.id === "construction") { start = timeline.constructionStart; end = timeline.projectEnd; }
                    const total = timeline.projectEnd;
                    const leftPct = ((start - 1) / total) * 100;
                    const widthPct = ((end - start + 1) / total) * 100;
                    const Icon = phase.icon;
                    return (
                      <div key={phase.id} className="flex items-center gap-2">
                        <div className="w-28 flex items-center gap-1.5 flex-shrink-0">
                          <Icon className="w-3 h-3" style={{ color: phase.color }} />
                          <span className="text-[10px] font-medium text-gray-700 truncate">{phase.name}</span>
                        </div>
                        <div className="flex-1 h-5 bg-gray-100 rounded-full relative overflow-hidden">
                          <div className="absolute h-full rounded-full transition-all" style={{ left: `${leftPct}%`, width: `${widthPct}%`, backgroundColor: phase.color, opacity: 0.8 }} />
                          <span className="absolute inset-0 flex items-center justify-center text-[9px] font-medium text-gray-700">شهر {start} – {end}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-1 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-gray-500">تحضير المواد قبل:</span>
                    <input type="number" min={1} max={6} value={marketingPrepLead} onChange={(e) => { setMarketingPrepLead(parseInt(e.target.value) || 3); setHasPlanChanges(true); }}
                      className="w-8 h-5 text-center text-[10px] border border-gray-200 rounded" />
                    <span className="text-[10px] text-gray-400">شهر من نهاية التصاميم</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-gray-500">ريرا قبل:</span>
                    <input type="number" min={1} max={6} value={reraLead} onChange={(e) => { setReraLead(parseInt(e.target.value) || 2); setHasPlanChanges(true); }}
                      className="w-8 h-5 text-center text-[10px] border border-gray-200 rounded" />
                    <span className="text-[10px] text-gray-400">شهر من بدء المبيعات</span>
                  </div>
                </div>
              </div>
            </section>

            {/* SECTION 5: SALES CURVE */}
            <section className="bg-white rounded-xl border border-gray-100 shadow-md overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-600" />
                  <h2 className="text-sm font-bold text-gray-800">منحنى المبيعات</h2>
                  <Badge variant="secondary" className="text-[10px]">{totalSold} / {offPlanUnits} وحدة</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={curveTemplate} onValueChange={(v: any) => { setCurveTemplate(v); setHasPlanChanges(true); }}>
                    <SelectTrigger className="h-7 text-[10px] w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bell">جرس</SelectItem>
                      <SelectItem value="fast">سريع</SelectItem>
                      <SelectItem value="gradual">تدريجي</SelectItem>
                      <SelectItem value="late">متأخر</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="p-2">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-[10px] text-gray-500">سرعة البيع:</span>
                  <Slider value={[speed]} onValueChange={([v]) => { setSpeed(v); setHasPlanChanges(true); }} min={10} max={90} step={5} className="flex-1 max-w-xs" />
                  <span className="text-[10px] font-bold text-blue-700">{speed}%</span>
                </div>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={salesDistribution.map((units, i) => ({ month: i + timeline.salesStart, units }))} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="month" tick={{ fontSize: 9 }} />
                      <YAxis tick={{ fontSize: 9 }} />
                      <ReTooltip formatter={(v: any) => [v + " وحدة", "المبيعات"]} labelFormatter={(l) => `شهر ${l}`} />
                      <Bar dataKey="units" radius={[2, 2, 0, 0]}>
                        {salesDistribution.map((_, i) => (
                          <Cell key={i} fill={escrowData[i]?.balance < 0 ? "#f87171" : "#34d399"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </section>

            {/* SECTION 6: PAYMENT PLAN */}
            <section className="bg-white rounded-xl border border-gray-100 shadow-md overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-indigo-600" />
                <h2 className="text-sm font-bold text-gray-800">خطة الدفع (Payment Plan)</h2>
                <Badge variant="secondary" className="text-[10px]">المجموع: {downPaymentPct + duringConstructionPct + onHandoverPct}%</Badge>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600">دفعة أولى (Down Payment)</span>
                      <span className="text-xs font-bold text-indigo-700">{downPaymentPct}%</span>
                    </div>
                    <Slider value={[downPaymentPct]} onValueChange={([v]) => { setDownPaymentPct(v); setDuringConstructionPct(100 - v - onHandoverPct); setHasPlanChanges(true); }} min={5} max={50} step={5} />
                    <p className="text-[10px] text-gray-400">{fmtFull(Math.round(avgUnitPrice * downPaymentPct / 100))} AED / وحدة</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600">أثناء الإنشاء</span>
                      <span className="text-xs font-bold text-blue-700">{duringConstructionPct}%</span>
                    </div>
                    <Slider value={[duringConstructionPct]} onValueChange={([v]) => { setDuringConstructionPct(v); setOnHandoverPct(100 - downPaymentPct - v); setHasPlanChanges(true); }} min={10} max={80} step={5} />
                    <p className="text-[10px] text-gray-400">{fmtFull(Math.round(avgUnitPrice * duringConstructionPct / 100))} AED / وحدة ({constructionMonths} شهر)</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600">عند التسليم (Handover)</span>
                      <span className="text-xs font-bold text-emerald-700">{onHandoverPct}%</span>
                    </div>
                    <Slider value={[onHandoverPct]} onValueChange={([v]) => { setOnHandoverPct(v); setDuringConstructionPct(100 - downPaymentPct - v); setHasPlanChanges(true); }} min={0} max={50} step={5} />
                    <p className="text-[10px] text-gray-400">{fmtFull(Math.round(avgUnitPrice * onHandoverPct / 100))} AED / وحدة</p>
                  </div>
                </div>
              </div>
            </section>

            {/* SECTION 7: ESCROW + CRITICAL MONTH */}
            <section className="bg-white rounded-xl border border-gray-100 shadow-md overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-violet-600" />
                  <h2 className="text-sm font-bold text-gray-800">تأثير الإسكرو (الضمان)</h2>
                  {hasDeficit && <Badge variant="destructive" className="text-[10px]">عجز: {fmt(Math.abs(maxDeficit))} AED</Badge>}
                  {!hasDeficit && <Badge className="text-[10px] bg-emerald-100 text-emerald-700">متوازن</Badge>}
                </div>
                <p className="text-[10px] text-gray-500">رصيد أولي: {fmt(escrowInitial)} (20% من الإنشاء)</p>
              </div>
              <div className="p-3">
                {/* Critical Month Alert */}
                {criticalMonth && (
                  <div className={`mb-3 p-3 rounded-lg border ${criticalMonth.balance < 0 ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className={`text-xs font-bold ${criticalMonth.balance < 0 ? 'text-red-700' : 'text-amber-700'}`}>
                          ⚠️ الشهر الحرج: شهر {criticalMonth.month}
                        </span>
                        <p className="text-[10px] text-gray-600 mt-0.5">أقل رصيد في حساب الضمان خلال فترة المشروع</p>
                      </div>
                      <div className="text-left">
                        <p className={`text-base font-bold ${criticalMonth.balance < 0 ? 'text-red-700' : 'text-amber-700'}`}>{fmt(criticalMonth.balance)} AED</p>
                        <p className="text-[9px] text-gray-500">وحدات مباعة تراكمياً: {criticalMonth.cumulativeSold}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="h-44 mb-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={escrowData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="month" tick={{ fontSize: 9 }} />
                      <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => fmt(v)} />
                      <ReTooltip formatter={(v: any) => [fmtFull(Math.round(v)) + " AED", ""]} labelFormatter={(l) => `شهر ${l}`} />
                      <Area type="monotone" dataKey="balance" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.15} strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Detailed Escrow Table */}
                {escrowData.length > 0 && (
                  <div className="overflow-x-auto max-h-56">
                    <table className="w-full text-[10px]">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-2 py-1.5 text-right font-bold">الشهر</th>
                          <th className="px-2 py-1.5 text-center font-bold">وحدات مباعة</th>
                          <th className="px-2 py-1.5 text-center font-bold">تراكمي</th>
                          <th className="px-2 py-1.5 text-center font-bold">دفعات أولى</th>
                          <th className="px-2 py-1.5 text-center font-bold">أقساط</th>
                          <th className="px-2 py-1.5 text-center font-bold">إجمالي الدخل</th>
                          <th className="px-2 py-1.5 text-center font-bold">سحب للمقاول</th>
                          <th className="px-2 py-1.5 text-center font-bold">رصيد الضمان</th>
                        </tr>
                      </thead>
                      <tbody>
                        {escrowData.map((d) => (
                          <tr key={d.month} className={`border-t border-gray-50 ${d.month === criticalMonth?.month ? 'bg-red-100 font-bold' : d.balance < 0 ? 'bg-red-50' : ''}`}>
                            <td className="px-2 py-1">{d.month === criticalMonth?.month ? '⚠️ ' : ''}شهر {d.month}</td>
                            <td className="px-2 py-1 text-center">{d.units}</td>
                            <td className="px-2 py-1 text-center text-gray-600">{d.cumulativeSold}</td>
                            <td className="px-2 py-1 text-center text-indigo-600">{fmt(d.downPayment)}</td>
                            <td className="px-2 py-1 text-center text-blue-600">{fmt(d.installments)}</td>
                            <td className="px-2 py-1 text-center text-emerald-700">{fmt(d.income)}</td>
                            <td className="px-2 py-1 text-center text-red-600">{fmt(d.withdrawal)}</td>
                            <td className={`px-2 py-1 text-center font-bold ${d.balance < 0 ? 'text-red-700' : 'text-violet-700'}`}>{fmt(d.balance)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
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
    <div className={`rounded-xl border p-3 ${colorMap[color] || colorMap.slate}`}>
      <p className="text-[10px] opacity-70 mb-0.5">{label}</p>
      <p className="text-base font-bold">{value}</p>
      <p className="text-[9px] opacity-60">{sub}</p>
    </div>
  );
}
