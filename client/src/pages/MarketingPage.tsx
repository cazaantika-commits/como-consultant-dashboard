import { useState, useEffect, useMemo, useCallback } from "react";
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
  Megaphone, Save, Loader2, Building2, Percent, RefreshCw,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════
const MARKETING_CHANNELS = [
  { id: "digital", name: "التسويق الرقمي", defaultPct: 35, color: "#3b82f6" },
  { id: "outdoor", name: "الإعلانات الخارجية", defaultPct: 20, color: "#10b981" },
  { id: "events", name: "المعارض والفعاليات", defaultPct: 15, color: "#f59e0b" },
  { id: "broker", name: "شبكة الوسطاء", defaultPct: 15, color: "#8b5cf6" },
  { id: "pr", name: "العلاقات العامة", defaultPct: 10, color: "#ec4899" },
  { id: "content", name: "المحتوى والإنتاج", defaultPct: 5, color: "#06b6d4" },
];

function fmtFull(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function MarketingPage({ embedded }: { embedded?: boolean } = {}) {
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
  const savePlan = trpc.waelSalesPlan.save.useMutation({
    onSuccess: () => { plansQuery.refetch(); toast({ title: "تم حفظ بيانات التسويق ✓" }); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });
  const updateProject = trpc.projects.update.useMutation();

  // ─── State ─────────────────────────────────────────────────────────────────
  const [planId, setPlanId] = useState<number | undefined>(undefined);
  const [marketingPct, setMarketingPct] = useState(2);

  const [channelPcts, setChannelPcts] = useState<Record<string, number>>(
    Object.fromEntries(MARKETING_CHANNELS.map((c) => [c.id, c.defaultPct]))
  );
  const [marketingActualStart, setMarketingActualStart] = useState(6);
  const [marketingActualEnd, setMarketingActualEnd] = useState(38);
  const [marketingDistribution, setMarketingDistribution] = useState<Record<string, number[]>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [designMonths, setDesignMonths] = useState(8);
  const [constructionMonths, setConstructionMonths] = useState(30);
  const [marketingPrepLead, setMarketingPrepLead] = useState(2);
  const [reraLead, setReraLead] = useState(2);
  const [projectStartDate, setProjectStartDate] = useState("");

  // ─── Load from DB ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (projectQuery.data) {
      const p = projectQuery.data as any;
      if (p.preConMonths) setDesignMonths(Number(p.preConMonths));
      if (p.constructionMonths) setConstructionMonths(Number(p.constructionMonths));
      if (p.marketingPct) setMarketingPct(Number(p.marketingPct));
      if (p.startDate) setProjectStartDate(String(p.startDate));
      if (p.marketingPrepMonths) setMarketingPrepLead(Number(p.marketingPrepMonths));
      if (p.reraLeadMonths) setReraLead(Number(p.reraLeadMonths));

    }
  }, [projectQuery.data]);

  useEffect(() => {
    if (plansQuery.data && plansQuery.data.length > 0) {
      const plan = plansQuery.data[0] as any;
      setPlanId(plan.id);
      if (plan.channelsJson) {
        try { setChannelPcts(JSON.parse(plan.channelsJson)); } catch {}
      }
      if (plan.salesAbsorptionJson) {
        try {
          const parsed = JSON.parse(plan.salesAbsorptionJson);
          // marketingPrepLead and reraLead now come from project settings (not salesAbsorptionJson)
          if (parsed.marketingActualStart) setMarketingActualStart(parsed.marketingActualStart);
          if (parsed.marketingActualEnd) setMarketingActualEnd(parsed.marketingActualEnd);
          if (parsed.marketingDistribution) setMarketingDistribution(parsed.marketingDistribution);
        } catch {}
      }
      setHasChanges(false);
    }
  }, [plansQuery.data]);

  // ─── Computed ──────────────────────────────────────────────────────────────
  const totalRevenue = useMemo(() => {
    if (!projectQuery.data) return 0;
    const p = projectQuery.data as any;
    const UNIT_TYPES = [
      { dbCount: "residential1brCount", dbArea: "residential1brArea", dbPrice: "residential1brPrice" },
      { dbCount: "residential2brCount", dbArea: "residential2brArea", dbPrice: "residential2brPrice" },
      { dbCount: "residential3brCount", dbArea: "residential3brArea", dbPrice: "residential3brPrice" },
      { dbCount: "retailSmallCount", dbArea: "retailSmallArea", dbPrice: "retailSmallPrice" },
      { dbCount: "retailMediumCount", dbArea: "retailMediumArea", dbPrice: "retailMediumPrice" },
      { dbCount: "retailLargeCount", dbArea: "retailLargeArea", dbPrice: "retailLargePrice" },
      { dbCount: "officeSmallCount", dbArea: "officeSmallArea", dbPrice: "officeSmallPrice" },
      { dbCount: "officeMediumCount", dbArea: "officeMediumArea", dbPrice: "officeMediumPrice" },
      { dbCount: "officeLargeCount", dbArea: "officeLargeArea", dbPrice: "officeLargePrice" },
    ];
    return UNIT_TYPES.reduce((s, u) => s + (Number(p[u.dbCount]) || 0) * (Number(p[u.dbArea]) || 0) * (Number(p[u.dbPrice]) || 0), 0);
  }, [projectQuery.data]);

  const marketingCost = totalRevenue * (marketingPct / 100);


  // Timeline computation (same as V2WaelSales)
  const schematicCompletionMonth = useMemo(() => {
    if (projectQuery.data) {
      const p = projectQuery.data as any;
      if (p.constructionScheduleJson) {
        try {
          const stored = JSON.parse(p.constructionScheduleJson);
          if (stored.settings?.designPayments) {
            const phases = ['mobilization', 'concept', 'schematic'];
            let totalWeeks = 0;
            for (const phId of phases) {
              const ph = stored.settings.designPayments[phId];
              totalWeeks += ph?.durationWeeks || (phId === 'mobilization' ? 2 : 4);
            }
            return Math.ceil(totalWeeks / 4.33);
          }
        } catch {}
      }
    }
    return Math.ceil(designMonths * 0.4);
  }, [projectQuery.data, designMonths]);

  const timeline = useMemo(() => {
    const designEnd = designMonths;
    const materialsStart = schematicCompletionMonth + 1;
    const reraStart = schematicCompletionMonth + 2;
    const marketingStart = materialsStart + marketingPrepLead;
    const salesStart = reraStart + reraLead + 1;
    const constructionStart = designEnd + 1;
    const projectEnd = constructionStart + constructionMonths - 1;
    return { designEnd, materialsStart, reraStart, marketingStart, salesStart, constructionStart, projectEnd };
  }, [designMonths, constructionMonths, marketingPrepLead, reraLead, schematicCompletionMonth]);

  // Sync defaults
  useEffect(() => {
    if (!plansQuery.data || plansQuery.data.length === 0) {
      setMarketingActualStart(timeline.marketingStart);
      setMarketingActualEnd(timeline.projectEnd);
    }
  }, [timeline.marketingStart, timeline.projectEnd, plansQuery.data]);

  // ─── Channel slider handler (FIX #2: cap total at 100%) ────────────────────
  const handleChannelSliderChange = useCallback((channelId: string, newValue: number) => {
    setChannelPcts((prev) => {
      const currentTotal = Object.entries(prev).reduce((sum, [id, pct]) => {
        return id === channelId ? sum : sum + pct;
      }, 0);
      // Cap: the new value cannot push total above 100%
      const maxAllowed = 100 - currentTotal;
      const clampedValue = Math.min(newValue, Math.max(0, maxAllowed));
      return { ...prev, [channelId]: clampedValue };
    });
    setHasChanges(true);
  }, []);

  // ─── Monthly input handler (FIX #3: cap at channel budget) ─────────────────
  const handleMonthlyInput = useCallback((channelId: string, monthIndex: number, rawValue: number, months: number) => {
    setMarketingDistribution(prev => {
      const arr = [...(prev[channelId] || Array(months).fill(0))];
      while (arr.length < months) arr.push(0);
      // Calculate channel budget cap
      const channelPct = channelPcts[channelId] || 0;
      const channelBudgetCap = marketingCost * (channelPct / 100);
      // Sum of all other months (excluding current)
      const otherMonthsTotal = arr.reduce((s, v, idx) => idx === monthIndex ? s : s + (v || 0), 0);
      // Max allowed for this month = channelBudget - sum of other months
      const maxForThisMonth = Math.max(0, channelBudgetCap - otherMonthsTotal);
      // Clamp the value
      const clampedValue = Math.min(Math.max(0, rawValue), maxForThisMonth);
      arr[monthIndex] = clampedValue;
      return { ...prev, [channelId]: arr };
    });
    setHasChanges(true);
  }, [channelPcts, marketingCost]);

  // ─── Save ──────────────────────────────────────────────────────────────────
  const handleSave = useCallback(() => {
    if (!selectedProjectId) return;
    // We need to preserve existing salesAbsorptionJson fields and only update marketing fields
    let existingAbsorption: any = {};
    if (plansQuery.data && plansQuery.data.length > 0) {
      const plan = plansQuery.data[0] as any;
      if (plan.salesAbsorptionJson) {
        try { existingAbsorption = JSON.parse(plan.salesAbsorptionJson); } catch {}
      }
    }
    const updatedAbsorption = {
      ...existingAbsorption,
      marketingPrepLead,
      reraLead,
      marketingActualStart,
      marketingActualEnd,
      marketingDistribution,
    };
    savePlan.mutate({
      id: planId,
      projectId: selectedProjectId,
      marketingBudgetPct: String(marketingPct),
      salesAbsorptionJson: JSON.stringify(updatedAbsorption),
      channelsJson: JSON.stringify(channelPcts),
    });
    // Also sync marketingPct + timeline settings to the project table so other pages read them correctly
    updateProject.mutate({ id: selectedProjectId, marketingPct: String(marketingPct), marketingPrepMonths: marketingPrepLead, reraLeadMonths: reraLead });
    setHasChanges(false);
  }, [selectedProjectId, planId, marketingPct, channelPcts, marketingActualStart, marketingActualEnd, marketingDistribution, marketingPrepLead, reraLead, plansQuery.data, savePlan, updateProject]);

  // ═══════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════════

  // Compute total channel allocation percentage for display
  const totalChannelPct = Object.values(channelPcts).reduce((s, v) => s + v, 0);

  return (
    <div className="bg-gray-50 p-2" dir="rtl">
      <div className="max-w-full mx-auto space-y-2">
        {/* HEADER */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Megaphone className="w-3.5 h-3.5 text-pink-600" />
            <h1 className="text-xs font-bold text-gray-900">التسويق</h1>
          </div>
          <div className="flex items-center gap-2">
            <ProjectSelector selectedId={selectedProjectId} onSelect={(id) => setSelectedProjectId(id)} />
            {hasChanges && (
              <Button size="sm" onClick={handleSave} disabled={savePlan.isPending} className="gap-1.5 bg-pink-600 hover:bg-pink-700">
                {savePlan.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                حفظ
              </Button>
            )}
          </div>
        </div>

        {!selectedProjectId && (
          <Card className="border-dashed"><CardContent className="py-12 text-center">
            <Building2 className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">اختر مشروعاً من القائمة أعلاه</p>
          </CardContent></Card>
        )}

        {selectedProjectId && projectQuery.isLoading && (
          <Card><CardContent className="py-12 text-center"><Loader2 className="w-8 h-8 mx-auto animate-spin text-pink-600" /></CardContent></Card>
        )}

        {selectedProjectId && !projectQuery.isLoading && (
          <>
            {/* SECTION 1: OPERATION COSTS */}
            <section className="grid grid-cols-12 gap-2">
              <div className="col-span-12 md:col-span-4 bg-white rounded-xl border border-gray-100 shadow-sm p-2 space-y-1">
                <h3 className="text-[11px] font-bold text-gray-800 flex items-center gap-1.5">
                  <Percent className="w-3.5 h-3.5 text-amber-600" />
                  تكاليف العملية
                </h3>
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-600">ميزانية التسويق</span>
                    <span className="text-[10px] font-bold text-blue-700">{marketingPct}%</span>
                  </div>
                  <Slider value={[marketingPct]} onValueChange={([v]) => { setMarketingPct(v); setHasChanges(true); }} min={0} max={10} step={0.5} className="w-full" />
                  <p className="text-[9px] text-gray-400">{fmtFull(Math.round(marketingCost))} AED</p>
                </div>

              </div>
              <div className="col-span-12 md:col-span-8 bg-white rounded-xl border border-gray-100 shadow-sm p-2">
                <h3 className="text-[11px] font-bold text-gray-800 flex items-center gap-1.5 mb-2">
                  <Megaphone className="w-3.5 h-3.5 text-pink-600" />
                  توزيع قنوات التسويق
                  <Badge variant="secondary" className="text-[9px]">{fmtFull(Math.round(marketingCost))} AED</Badge>
                  {/* Show total allocation percentage */}
                  <Badge variant={totalChannelPct === 100 ? "secondary" : "destructive"} className="text-[9px] mr-1">
                    المجموع: {totalChannelPct}%{totalChannelPct !== 100 && " ⚠"}
                  </Badge>
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {MARKETING_CHANNELS.map((ch) => {
                    const channelBudget = marketingCost * ((channelPcts[ch.id] || 0) / 100);
                    // FIX #1: Calculate remaining for THIS channel from its own budget
                    const channelMonthlyTotal = (marketingDistribution[ch.id] || []).reduce((s, v) => s + (v || 0), 0);
                    const channelRemaining = channelBudget - channelMonthlyTotal;
                    return (
                      <div key={ch.id} className="rounded-lg border border-gray-100 p-1.5">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-medium text-gray-700">{ch.name}</span>
                          <span className="text-[10px] font-bold" style={{ color: ch.color }}>{channelPcts[ch.id] || 0}%</span>
                        </div>
                        {/* FIX #2: Slider capped so total never exceeds 100% */}
                        <Slider
                          value={[channelPcts[ch.id] || 0]}
                          onValueChange={([v]) => handleChannelSliderChange(ch.id, v)}
                          min={0}
                          max={100}
                          step={5}
                          className="w-full"
                        />
                        <p className="text-[8px] text-gray-400 mt-0.5">{fmtFull(Math.round(channelBudget))} AED</p>
                        {/* FIX #1: Show remaining from THIS channel's budget */}
                        {channelMonthlyTotal > 0 && channelRemaining > 100 && (
                          <p className="text-[8px] text-emerald-600 mt-0.5">متبقي: {fmtFull(Math.round(channelRemaining))} AED</p>
                        )}
                        {channelMonthlyTotal > 0 && channelRemaining < -100 && (
                          <p className="text-[8px] text-red-500 mt-0.5">تجاوز: {fmtFull(Math.abs(Math.round(channelRemaining)))} AED</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* SECTION 2: MARKETING BUDGET DISTRIBUTION TABLE */}
            <section className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Megaphone className="w-3.5 h-3.5 text-pink-600" />
                  <h2 className="text-[11px] font-bold text-gray-800">توزيع ميزانية التسويق</h2>
                  <Badge variant="secondary" className="text-[9px]">يحدده وائل</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[9px]">
                    الميزانية: {fmtFull(Math.round(marketingCost))} AED ({marketingPct}%)
                  </Badge>
                  <Badge variant="outline" className="text-[9px]">
                    الفترة: شهر {marketingActualStart} → {marketingActualEnd}
                  </Badge>
                  <Button variant="outline" size="sm" className="h-5 text-[9px] gap-1" onClick={() => {
                    const months = marketingActualEnd - marketingActualStart + 1;
                    const newDist: Record<string, number[]> = {};
                    MARKETING_CHANNELS.forEach(ch => {
                      const channelBudget = marketingCost * ((channelPcts[ch.id] || 0) / 100);
                      const perMonth = Math.round(channelBudget / months);
                      newDist[ch.id] = Array(months).fill(perMonth);
                    });
                    setMarketingDistribution(newDist);
                    setHasChanges(true);
                  }}>
                    <RefreshCw className="w-3 h-3" /> توزيع متساوي
                  </Button>
                </div>
              </div>
              <div className="p-3">
                {/* Summary row: budget controls */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                  <div className="rounded-lg border border-pink-100 bg-pink-50/30 p-2">
                    <label className="text-[10px] font-medium text-gray-600 block mb-1">نسبة التسويق من الإيرادات</label>
                    <div className="flex items-center gap-1">
                      <input type="number" min={0} max={20} step={0.5} value={marketingPct}
                        onChange={(e) => { setMarketingPct(Number(e.target.value) || 0); setHasChanges(true); }}
                        className="w-14 h-6 text-[11px] text-center font-bold border border-pink-300 rounded bg-white text-pink-700 focus:ring-1 focus:ring-pink-400" />
                      <span className="text-[9px] text-gray-400">% = {fmtFull(Math.round(marketingCost))} AED</span>
                    </div>
                  </div>
                  <div className="rounded-lg border border-pink-100 bg-pink-50/30 p-2">
                    <label className="text-[10px] font-medium text-gray-600 block mb-1">بداية التسويق (شهر)</label>
                    <div className="flex items-center gap-1">
                      <input type="number" min={timeline.marketingStart} max={timeline.projectEnd} value={marketingActualStart}
                        onChange={(e) => { setMarketingActualStart(Number(e.target.value) || timeline.marketingStart); setHasChanges(true); }}
                        className="w-14 h-6 text-[11px] text-center font-bold border border-pink-300 rounded bg-white text-pink-700 focus:ring-1 focus:ring-pink-400" />
                      <span className="text-[9px] text-gray-400">→</span>
                      <input type="number" min={marketingActualStart} max={timeline.projectEnd} value={marketingActualEnd}
                        onChange={(e) => { setMarketingActualEnd(Number(e.target.value) || timeline.projectEnd); setHasChanges(true); }}
                        className="w-14 h-6 text-[11px] text-center font-bold border border-pink-300 rounded bg-white text-pink-700 focus:ring-1 focus:ring-pink-400" />
                      <span className="text-[9px] text-gray-400">({marketingActualEnd - marketingActualStart + 1} شهر)</span>
                    </div>
                  </div>
                  <div className="rounded-lg border border-emerald-100 bg-emerald-50/30 p-2">
                    <label className="text-[10px] font-medium text-gray-600 block mb-1">المجموع المدخل</label>
                    <div className="flex items-center gap-1">
                      {(() => {
                        const totalEntered = Object.values(marketingDistribution).flat().reduce((s, v) => s + (v || 0), 0);
                        const diff = marketingCost - totalEntered;
                        return (
                          <>
                            <span className={`text-[11px] font-bold ${Math.abs(diff) < 100 ? 'text-emerald-700' : 'text-red-600'}`}>
                              {fmtFull(Math.round(totalEntered))}
                            </span>
                            <span className="text-[9px] text-gray-400">/ {fmtFull(Math.round(marketingCost))}</span>
                            {Math.abs(diff) >= 100 && <span className="text-[9px] text-red-500">({diff > 0 ? 'متبقي' : 'زيادة'}: {fmtFull(Math.abs(Math.round(diff)))})</span>}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>
                {/* Distribution Table: rows=channels, columns=months */}
                <div className="overflow-x-auto max-h-[400px] overflow-y-auto border border-gray-200 rounded-lg">
                  <table className="w-full text-[10px]">
                    <thead className="sticky top-0 bg-gray-50 z-10 border-b border-gray-200">
                      <tr>
                        <th className="text-right py-1.5 px-2 text-gray-600 font-bold sticky right-0 bg-gray-50 min-w-[120px]">القناة / الشهر</th>
                        <th className="text-center py-1.5 px-1 text-gray-600 font-bold min-w-[80px]">المتبقي</th>
                        {Array.from({ length: marketingActualEnd - marketingActualStart + 1 }, (_, i) => {
                          const absMonth = marketingActualStart + i;
                          const MN=["\u064a\u0646\u0627","\u0641\u0628\u0631","\u0645\u0627\u0631","\u0623\u0628\u0631","\u0645\u0627\u064a","\u064a\u0648\u0646","\u064a\u0648\u0644","\u0623\u063a\u0633","\u0633\u0628\u062a","\u0623\u0643\u062a","\u0646\u0648\u0641","\u062f\u064a\u0633"];
                          let ml=""; if(projectStartDate){const[y,m]=projectStartDate.split("-").map(Number);if(y&&m)ml=MN[(m-1+absMonth-1)%12];}
                          return (
                            <th key={i} className="text-center py-1.5 px-1 min-w-[70px]">
                              <div className="flex flex-col items-center leading-tight">
                                <span className="text-[7px] text-gray-400">{absMonth}</span>
                                <span className="text-[9px] font-bold text-gray-600">{ml || `\u0634${absMonth}`}</span>
                              </div>
                            </th>
                          );
                        })}
                        <th className="text-center py-1.5 px-2 text-gray-600 font-bold min-w-[80px]">المجموع</th>
                      </tr>
                    </thead>
                    <tbody>
                      {MARKETING_CHANNELS.map((ch) => {
                        const months = marketingActualEnd - marketingActualStart + 1;
                        const channelAmounts = marketingDistribution[ch.id] || Array(months).fill(0);
                        const channelTotal = channelAmounts.reduce((s, v) => s + (v || 0), 0);
                        const channelBudgetCap = marketingCost * ((channelPcts[ch.id] || 0) / 100);
                        const isOverCap = channelTotal > channelBudgetCap + 100;
                        // FIX #1: remaining = channel budget - channel monthly total
                        const remaining = channelBudgetCap - channelTotal;
                        return (
                          <tr key={ch.id} className={`border-b border-gray-50 hover:bg-gray-50/50 ${isOverCap ? 'bg-red-50/50' : ''}`}>
                            <td className={`py-1 px-2 font-medium text-gray-700 sticky right-0 ${isOverCap ? 'bg-red-50' : 'bg-white'}`}>
                              <div className="flex items-center gap-1">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ch.color }} />
                                {ch.name}
                              </div>
                              <div className="text-[8px] text-gray-400 mt-0.5">
                                الحد: {fmtFull(Math.round(channelBudgetCap))} ({channelPcts[ch.id] || 0}%)
                              </div>
                            </td>
                            {/* FIX #1: Show remaining per channel */}
                            <td className="py-1 px-1 text-center">
                              {isOverCap ? (
                                <div>
                                  <span className="text-[10px] font-bold text-red-600">تجاوز!</span>
                                  <div className="text-[8px] text-red-500">+{fmtFull(Math.abs(Math.round(remaining)))}</div>
                                </div>
                              ) : remaining > 100 ? (
                                <div>
                                  <span className="text-[10px] font-bold text-emerald-600">{fmtFull(Math.round(remaining))}</span>
                                  <div className="text-[8px] text-gray-400">متبقي</div>
                                </div>
                              ) : (
                                <div>
                                  <span className="text-[10px] font-bold text-emerald-700">✓</span>
                                  <div className="text-[8px] text-emerald-600">مكتمل</div>
                                </div>
                              )}
                            </td>
                            {Array.from({ length: months }, (_, i) => (
                              <td key={i} className="py-1 px-0.5 text-center">
                                <input
                                  type="number"
                                  min={0}
                                  step={1000}
                                  value={channelAmounts[i] || 0}
                                  onChange={(e) => {
                                    // FIX #3: clamp monthly input at channel budget
                                    const val = Number(e.target.value) || 0;
                                    handleMonthlyInput(ch.id, i, val, months);
                                  }}
                                  className={`w-[60px] h-5 text-[9px] text-center border rounded bg-white focus:ring-1 focus:ring-pink-300 focus:border-pink-300 ${isOverCap ? 'border-red-300' : 'border-gray-200'}`}
                                />
                              </td>
                            ))}
                            <td className={`py-1 px-2 text-center font-bold ${isOverCap ? 'text-red-600' : 'text-gray-700'}`}>
                              {fmtFull(Math.round(channelTotal))}
                            </td>
                          </tr>
                        );
                      })}
                      {/* Totals row */}
                      <tr className="bg-gray-50 border-t-2 border-gray-200 font-bold">
                        <td className="py-1.5 px-2 text-gray-800 sticky right-0 bg-gray-50">المجموع</td>
                        <td className="py-1.5 px-1 text-center text-gray-800">
                          {fmtFull(Math.round(marketingCost - Object.values(marketingDistribution).flat().reduce((s, v) => s + (v || 0), 0)))}
                        </td>
                        {Array.from({ length: marketingActualEnd - marketingActualStart + 1 }, (_, i) => {
                          const monthTotal = MARKETING_CHANNELS.reduce((s, ch) => {
                            const arr = marketingDistribution[ch.id] || [];
                            return s + (arr[i] || 0);
                          }, 0);
                          return (
                            <td key={i} className="py-1.5 px-1 text-center text-[9px] text-gray-700">
                              {fmtFull(Math.round(monthTotal))}
                            </td>
                          );
                        })}
                        <td className="py-1.5 px-2 text-center text-gray-800">
                          {fmtFull(Math.round(Object.values(marketingDistribution).flat().reduce((s, v) => s + (v || 0), 0)))}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="mt-2 pt-2 border-t border-gray-100">
                  <p className="text-[9px] text-gray-500">وائل يحدد المبلغ لكل قناة في كل شهر. المجموع يجب أن يساوي ميزانية التسويق الإجمالية. يبدأ التسويق بعد اكتمال تحضير مواد التسويق وينتهي باكتمال المشروع.</p>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
