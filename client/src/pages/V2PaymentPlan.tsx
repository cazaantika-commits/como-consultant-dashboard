import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { useProjectContext } from "@/contexts/ProjectContext";
import { ProjectSelector } from "@/components/ProjectSelector";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { trpc } from "@/lib/trpc";
import {
  cloneFlexiblePaymentPlan,
  normalizeFlexiblePaymentPlan,
  type FlexiblePaymentPlan,
  type PaymentCalendarEntry,
  type PaymentCalendarTimingRule,
  type PaymentPlanMilestone,
} from "@/lib/flexiblePaymentPlan";
import {
  buildPaymentCalendar,
  buyerDueCalendar,
  calendarEntriesFromPlan,
  expandPaymentCalendarEntries,
  paymentCalendarTotal,
} from "@/lib/paymentPlanCalendar";
import { getConstructionProgressMilestones, getProjectMarketingTiming } from "@/lib/projectTiming";
import { createConstructionSeries, createPostHandoverSeries, inferPaymentMilestone, validatePaymentCalendarLogic } from "@/lib/paymentPlanRules";
import { default as ArrowRight } from "lucide-react/dist/esm/icons/arrow-right.js";
import { default as CalendarDays } from "lucide-react/dist/esm/icons/calendar-days.js";
import { default as ChevronDown } from "lucide-react/dist/esm/icons/chevron-down.js";
import { default as ChevronUp } from "lucide-react/dist/esm/icons/chevron-up.js";
import { default as CopyPlus } from "lucide-react/dist/esm/icons/copy-plus.js";
import { default as Landmark } from "lucide-react/dist/esm/icons/landmark.js";
import { default as Save } from "lucide-react/dist/esm/icons/save.js";
import { default as SlidersHorizontal } from "lucide-react/dist/esm/icons/sliders-horizontal.js";
import { default as Trash2 } from "lucide-react/dist/esm/icons/trash-2.js";

const timingLabels: Record<PaymentCalendarTimingRule, string> = {
  booking: "عند الحجز",
  after_previous: "بعد الدفعة السابقة",
  construction_progress: "عند نسبة إنجاز",
  handover: "عند التسليم",
  post_handover: "بعد التسليم",
  manual_date: "تاريخ يدوي",
};

function projectDate(projectStart: string | undefined, month: number) {
  const match = String(projectStart || "").match(/^(\d{4})-(\d{2})/);
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1 + month - 1, 1));
}

function formatProjectMonth(projectStart: string | undefined, month: number) {
  const date = projectDate(projectStart, month);
  return date
    ? new Intl.DateTimeFormat("ar-AE", { month: "long", year: "numeric", timeZone: "UTC" }).format(date)
    : `الشهر ${month}`;
}

function monthInputValue(projectStart: string | undefined, month: number) {
  const date = projectDate(projectStart, month);
  return date ? `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}` : "";
}

function newEntry(rule: PaymentCalendarTimingRule, sequence: number, milestone?: PaymentPlanMilestone): PaymentCalendarEntry {
  const id = `payment-${Date.now()}-${sequence}`;
  const base = { id, sequence, percentage: 0, recipient: "escrow" as const, timingRule: rule, milestone };
  if (milestone === "booking" || rule === "booking") return { ...base, milestone: "booking" as const, label: "دفعة الحجز", timingRule: "booking" as const };
  if (milestone === "contract") return { ...base, milestone: "contract" as const, label: "دفعة توقيع العقد", timingRule: "after_previous" as const, offsetMonths: 1 };
  if (rule === "handover") return { ...base, milestone: "handover" as const, label: "دفعة التسليم" };
  if (rule === "post_handover") return { ...base, milestone: "post_handover" as const, label: "دفعة بعد التسليم", recipient: "investor" as const, offsetMonths: 1 };
  if (rule === "construction_progress") return { ...base, milestone: "construction" as const, label: "قسط عند الإنجاز", progressPct: 25 };
  if (rule === "manual_date") return { ...base, label: "دفعة بتاريخ يدوي" };
  return { ...base, milestone: milestone || "construction", label: "قسط الإنشاء", offsetMonths: rule === "after_previous" ? 1 : 0 };
}

export default function V2PaymentPlan() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const { selectedProjectId, setSelectedProjectId } = useProjectContext();
  const projectQuery = trpc.projects.getById.useQuery(selectedProjectId!, { enabled: !!selectedProjectId && !!user });
  const plansQuery = trpc.waelSalesPlan.getByProject.useQuery({ projectId: selectedProjectId! }, { enabled: !!selectedProjectId && !!user });
  const saveCalendar = trpc.waelSalesPlan.savePaymentCalendar.useMutation();
  const [planId, setPlanId] = useState<number | undefined>();
  const [plan, setPlan] = useState<FlexiblePaymentPlan>(() => cloneFlexiblePaymentPlan());
  const [entries, setEntries] = useState<PaymentCalendarEntry[]>([]);
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);
  const [purchaseMonth, setPurchaseMonth] = useState(1);
  const [seriesFirstAfter, setSeriesFirstAfter] = useState(3);
  const [seriesEvery, setSeriesEvery] = useState(4);
  const [seriesCount, setSeriesCount] = useState(2);
  const [seriesInstallmentPct, setSeriesInstallmentPct] = useState(10);
  const [nextPaymentKind, setNextPaymentKind] = useState<"booking" | "contract" | "construction_fixed" | "construction_progress" | "construction_series" | "handover" | "post_handover_series">("construction_series");
  const [fixedConstructionDate, setFixedConstructionDate] = useState("");
  const [constructionProgressPct, setConstructionProgressPct] = useState(25);
  const [postHandoverTotal, setPostHandoverTotal] = useState(20);
  const [postHandoverTerm, setPostHandoverTerm] = useState(24);
  const [postHandoverEvery, setPostHandoverEvery] = useState(6);
  const hydratedPlanId = useRef<number | null>(null);

  const project = projectQuery.data as any;
  const timing = useMemo(() => getProjectMarketingTiming(project), [project]);
  const salesStartMonth = timing.salesStartMonth;
  const constructionEndMonth = timing.projectEndMonth;
  const projectStartDate = project?.startDate as string | undefined;
  const calendarContext = useMemo(() => ({
    projectSalesStartMonth: salesStartMonth,
    constructionStartMonth: timing.constructionStartMonth,
    constructionEndMonth,
    projectStartDate,
  }), [salesStartMonth, timing.constructionStartMonth, constructionEndMonth, projectStartDate]);
  const constructionMilestones = useMemo(() => getConstructionProgressMilestones(project), [project]);

  const loadEntries = (savedPlan: FlexiblePaymentPlan) => {
    const next = expandPaymentCalendarEntries(calendarEntriesFromPlan(savedPlan), calendarContext);
    setEntries(next);
    setActiveEntryId(next[0]?.id ?? null);
    setPurchaseMonth(Math.max(1, salesStartMonth));
  };

  useEffect(() => {
    const saved = plansQuery.data?.[0] as any;
    if (!saved || hydratedPlanId.current === saved.id) return;
    hydratedPlanId.current = saved.id;
    let parsed: FlexiblePaymentPlan;
    try { parsed = normalizeFlexiblePaymentPlan(JSON.parse(saved.paymentPlanJson || "{}")); }
    catch { parsed = cloneFlexiblePaymentPlan(); }
    setPlanId(saved.id);
    setPlan(parsed);
    loadEntries(parsed);
  }, [plansQuery.data, calendarContext, salesStartMonth]);

  useEffect(() => {
    if (plansQuery.data?.length || !project) return;
    const draft = cloneFlexiblePaymentPlan();
    setPlanId(undefined);
    setPlan(draft);
    loadEntries(draft);
  }, [plansQuery.data, project, calendarContext, salesStartMonth]);

  const calendar = useMemo(() => buildPaymentCalendar(entries, calendarContext), [entries, calendarContext]);
  const total = paymentCalendarTotal(entries);
  const dueNow = calendar.filter((row) => row.month <= purchaseMonth).reduce((sum, row) => sum + row.percentage, 0);
  const activeEntry = entries.find((entry) => entry.id === activeEntryId) ?? entries[0];
  const activeRow = calendar.find((row) => row.id === activeEntry?.id);

  const updateEntry = (id: string, patch: Partial<PaymentCalendarEntry>) => {
    setEntries((current) => current.map((entry) => entry.id === id ? { ...entry, ...patch } : entry));
  };
  const addEntry = (rule: PaymentCalendarTimingRule, milestone?: PaymentPlanMilestone) => {
    const item = newEntry(rule, entries.length + 1, milestone);
    setEntries((current) => [...current, item]);
    setActiveEntryId(item.id);
  };
  const removeEntry = (id: string) => {
    setEntries((current) => {
      const next = current.filter((entry) => entry.id !== id).map((entry, index) => ({ ...entry, sequence: index + 1 }));
      setActiveEntryId(next[0]?.id ?? null);
      return next;
    });
  };
  const moveEntry = (id: string, direction: -1 | 1) => setEntries((current) => {
    const ordered = current.slice().sort((a, b) => a.sequence - b.sequence);
    const index = ordered.findIndex((entry) => entry.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ordered.length) return current;
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    return ordered.map((entry, order) => ({ ...entry, sequence: order + 1 }));
  });
  const addNextPayment = () => {
    const milestones = entries.map((entry, index) => inferPaymentMilestone(entry, index));
    const hasBooking = milestones.includes("booking");
    const hasContract = milestones.includes("contract");
    const hasHandover = milestones.includes("handover");
    const lastMonth = calendar.at(-1)?.month ?? salesStartMonth;
    const append = (additions: PaymentCalendarEntry[]) => {
      setEntries((current) => [...current, ...additions.map((entry, index) => ({ ...entry, sequence: current.length + index + 1 }))]);
      setActiveEntryId(additions[0]?.id ?? null);
    };
    if (nextPaymentKind === "booking") {
      if (entries.length) return toast({ title: "دفعة الحجز موجودة", description: "الحجز هو أول دفعة فقط.", variant: "destructive" });
      return append([newEntry("booking", 1, "booking")]);
    }
    if (nextPaymentKind === "contract") {
      if (!hasBooking) return toast({ title: "ابدأ بالحجز", description: "يجب إنشاء دفعة الحجز قبل دفعة توقيع العقد.", variant: "destructive" });
      if (hasContract) return toast({ title: "دفعة العقد موجودة", description: "عدّلها من الجدول بدل إنشاء نسخة ثانية.", variant: "destructive" });
      return append([newEntry("after_previous", entries.length + 1, "contract")]);
    }
    if (nextPaymentKind.startsWith("construction") && !hasContract) return toast({ title: "يلزم توقيع العقد", description: "تبدأ دفعات الإنشاء بعد إضافة دفعة توقيع العقد.", variant: "destructive" });
    if (nextPaymentKind.startsWith("construction") && hasHandover) return toast({ title: "تم تجاوز مرحلة الإنشاء", description: "بعد دفعة التسليم يمكن إنشاء دفعات ما بعد التسليم فقط.", variant: "destructive" });
    if (nextPaymentKind === "construction_fixed") {
      const item = newEntry("manual_date", entries.length + 1, "construction");
      item.label = "قسط إنشاء بتاريخ ثابت";
      item.manualDate = fixedConstructionDate || monthInputValue(projectStartDate, lastMonth + Math.max(1, seriesFirstAfter));
      return append([item]);
    }
    if (nextPaymentKind === "construction_progress") {
      if (!constructionMilestones.length) return toast({ title: "لا توجد نسب إنجاز محفوظة", description: "أكمل خطة الإنشاء أولًا كي يقرأ النظام نسب الإنجاز المعتمدة.", variant: "destructive" });
      const item = newEntry("construction_progress", entries.length + 1, "construction");
      item.progressPct = constructionProgressPct;
      return append([item]);
    }
    if (nextPaymentKind === "construction_series") {
      const result = createConstructionSeries({ totalPercentage: seriesCount * seriesInstallmentPct, installmentPercentage: seriesInstallmentPct, firstAfterMonths: seriesFirstAfter, everyMonths: seriesEvery, previousMonth: lastMonth, nextSequence: entries.length + 1 }, calendarContext);
      if (result.error) return toast({ title: "لا يمكن إنشاء هذا التوزيع", description: result.error, variant: "destructive" });
      return append(result.entries || []);
    }
    if (nextPaymentKind === "handover") {
      if (!hasContract) return toast({ title: "يلزم الحجز والعقد أولًا", description: "أضف دفعة الحجز ثم توقيع العقد قبل التسليم.", variant: "destructive" });
      if (hasHandover) return toast({ title: "دفعة التسليم موجودة", description: "عدّل الدفعة الحالية من الجدول.", variant: "destructive" });
      return append([newEntry("handover", entries.length + 1, "handover")]);
    }
    if (!hasHandover) return toast({ title: "يلزم دفعة التسليم أولًا", description: "دفعات ما بعد التسليم تبدأ بعد إنشاء دفعة التسليم.", variant: "destructive" });
    const result = createPostHandoverSeries({ totalPercentage: postHandoverTotal, termMonths: postHandoverTerm, everyMonths: postHandoverEvery, nextSequence: entries.length + 1 });
    if (result.error) return toast({ title: "لا يمكن إنشاء دفعات ما بعد التسليم", description: result.error, variant: "destructive" });
    return append(result.entries || []);
  };
  const save = async () => {
    if (!selectedProjectId) return;
    const issues = validatePaymentCalendarLogic(entries, calendarContext);
    if (issues.length) {
      toast({ title: "راجع منطق الدفعات أولًا", description: issues[0].message, variant: "destructive" });
      return;
    }
    if (Math.abs(total - 100) > 0.01) {
      toast({ title: "مجموع الخطة غير مكتمل", description: "يجب أن يساوي مجموع نسب الدفعات 100% قبل الحفظ.", variant: "destructive" });
      return;
    }
    try {
      const updated: FlexiblePaymentPlan = { ...plan, calendarEntries: entries };
      const result = await saveCalendar.mutateAsync({ planId, projectId: selectedProjectId, paymentPlanJson: JSON.stringify(updated) });
      setPlan(updated);
      setPlanId(result.id);
      await plansQuery.refetch();
      toast({ title: "تم حفظ الدفعات", description: "تظهر هذه الصفوف نفسها في تحصيلات المبيعات والضمان عند اعتماد السيناريو." });
    } catch (error: any) {
      toast({ title: "تعذر الحفظ", description: error?.message || "أعد المحاولة.", variant: "destructive" });
    }
  };

  if (!selectedProjectId || !project) {
    return <main dir="rtl" className="min-h-screen w-full max-w-full overflow-x-hidden bg-slate-50 p-4 sm:p-5"><div className="mx-auto w-full max-w-3xl rounded-3xl border-2 border-slate-200 bg-white p-6 text-center shadow-sm sm:p-8"><Landmark className="mx-auto h-9 w-9 text-indigo-600" /><h1 className="mt-3 text-2xl font-black text-slate-950">خطة سداد المشترين</h1><p className="mt-2 text-sm text-slate-600">اختر مشروعًا أولًا؛ بعدها ستظهر لك الدفعات وتواريخها مباشرة.</p><div className="mx-auto mt-5 w-full max-w-sm"><ProjectSelector selectedId={selectedProjectId} onSelect={(id) => { hydratedPlanId.current = null; setSelectedProjectId(id); }} /></div></div></main>;
  }

  return (
    <main dir="rtl" className="min-h-screen w-full max-w-full overflow-x-hidden bg-slate-50 px-3 py-4 text-slate-950 sm:px-5 lg:px-8">
      <div className="mx-auto w-full max-w-[1280px] space-y-4">
        <header className="overflow-hidden rounded-[26px] border-2 border-indigo-300 bg-[linear-gradient(120deg,#eef2ff,#ffffff_52%,#ecfeff)] shadow-[0_14px_34px_rgba(15,23,42,0.08)]">
          <div className="flex flex-col gap-4 px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
            <div><div className="flex items-center gap-2 text-xs font-black text-indigo-700"><CalendarDays className="h-4 w-4" />خطة سداد المشترين</div><h1 className="mt-1 text-2xl font-black text-slate-950 sm:text-3xl">الدفعات كما يراها المشتري</h1><p className="mt-2 text-sm font-medium text-slate-700">راجع كل دفعة: كم نسبتها ومتى تستحق. اضغط أي دفعة فقط إذا أردت تعديلها.</p></div>
            <div className="flex flex-wrap items-center gap-2"><div className="min-w-[210px]"><ProjectSelector selectedId={selectedProjectId} onSelect={(id) => { hydratedPlanId.current = null; setSelectedProjectId(id); }} /></div><Button variant="outline" onClick={() => navigate("/v2/wael-sales")} className="border-indigo-300 bg-white text-indigo-900"><ArrowRight className="ml-1 h-4 w-4" />مساحة وائل</Button><Button onClick={save} disabled={saveCalendar.isPending} className="bg-indigo-700 text-white hover:bg-indigo-600"><Save className="ml-1 h-4 w-4" />حفظ الخطة</Button></div>
          </div>
          <div className="grid border-t border-indigo-200 bg-white/70 sm:grid-cols-4"><div className="border-b border-indigo-100 px-5 py-3 sm:border-b-0 sm:border-l"><p className="text-[10px] font-black text-slate-500">بدء البيع</p><p className="mt-1 font-black text-indigo-950">{formatProjectMonth(projectStartDate, salesStartMonth)}</p></div><div className="border-b border-indigo-100 px-5 py-3 sm:border-b-0 sm:border-l"><p className="text-[10px] font-black text-slate-500">بدء الإنشاء</p><p className="mt-1 font-black text-slate-950">{formatProjectMonth(projectStartDate, timing.constructionStartMonth)}</p></div><div className="border-b border-indigo-100 px-5 py-3 sm:border-b-0 sm:border-l"><p className="text-[10px] font-black text-slate-500">التسليم</p><p className="mt-1 font-black text-emerald-800">{formatProjectMonth(projectStartDate, constructionEndMonth)}</p></div><div className="px-5 py-3"><p className="text-[10px] font-black text-slate-500">مجموع الخطة</p><p className="mt-1 font-black text-slate-950">{total}%</p></div></div>
        </header>

        <section className="overflow-hidden rounded-2xl border-2 border-slate-300 bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b-2 border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-xl font-black text-slate-950">الدفعات</h2><p className="mt-1 text-xs font-medium text-slate-600">هذه هي القائمة التي يعتمدها وائل. كل بطاقة تمثل دفعة واحدة فقط.</p></div><Badge className={Math.abs(total - 100) < 0.01 ? "border border-emerald-300 bg-emerald-50 text-emerald-900" : "border border-rose-300 bg-rose-50 text-rose-900"}>إجمالي النسب {total}%</Badge></div>
          <div className="divide-y-2 divide-slate-200">{entries.map((entry, index) => { const row = calendar.find((item) => item.id === entry.id); return <button key={entry.id} type="button" onClick={() => setActiveEntryId(entry.id)} className={`grid w-full grid-cols-[44px_1fr_auto] items-center gap-3 px-4 py-4 text-right transition hover:bg-indigo-50 sm:grid-cols-[54px_1.4fr_1fr_auto] sm:px-6 ${activeEntry?.id === entry.id ? "bg-indigo-50/70" : "bg-white"}`}><span className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-700 text-sm font-black text-white">{index + 1}</span><span><span className="block text-base font-black text-slate-950">{entry.label}</span><span className="mt-1 block text-xs font-semibold text-slate-500">{entry.recipient === "escrow" ? "حساب الضمان" : "المستثمر"}</span></span><span className="hidden text-sm font-black text-slate-800 sm:block">{formatProjectMonth(projectStartDate, row?.month ?? salesStartMonth)}</span><span className="rounded-xl border-2 border-indigo-300 bg-white px-3 py-2 text-center text-lg font-black text-indigo-950">{entry.percentage}%</span></button>; })}</div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.25fr_.75fr]">
          <div className="rounded-2xl border-2 border-amber-300 bg-white p-5 shadow-sm"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black text-amber-800">المشتري الذي يشتري متأخرًا</p><h2 className="mt-1 text-lg font-black text-slate-950">ماذا يدفع فورًا؟</h2></div><Landmark className="h-7 w-7 text-amber-600" /></div><div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]"><label className="text-xs font-bold text-slate-700">يشتري في<select value={purchaseMonth} onChange={(event) => setPurchaseMonth(Number(event.target.value))} className="mt-1 h-10 w-full rounded-lg border-2 border-amber-300 bg-amber-50 px-3 font-black text-slate-950">{Array.from({ length: Math.max(1, constructionEndMonth - salesStartMonth + 1) }, (_, index) => { const month = salesStartMonth + index; return <option key={month} value={month}>{formatProjectMonth(projectStartDate, month)}</option>; })}</select></label><div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-2 text-center"><p className="text-[10px] font-black text-amber-800">يدفع فورًا</p><p className="mt-1 text-3xl font-black text-amber-950">{dueNow}%</p></div></div><p className="mt-3 text-xs leading-6 text-slate-700">تجمع الدفعات التي استحقت قبل شهر الشراء في دفعة ذلك الشهر، وتبقى بقية الدفعات في مواعيدها.</p></div>
          <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-5 shadow-sm"><p className="text-xs font-black text-emerald-800">ملخص</p><div className="mt-3 space-y-2 text-sm"><div className="flex justify-between border-b border-emerald-200 pb-2"><span className="font-bold text-slate-700">عدد الدفعات</span><span className="font-black text-emerald-950">{entries.length}</span></div><div className="flex justify-between border-b border-emerald-200 pb-2"><span className="font-bold text-slate-700">آخر دفعة</span><span className="font-black text-emerald-950">{formatProjectMonth(projectStartDate, calendar.at(-1)?.month ?? constructionEndMonth)}</span></div><div className="flex justify-between"><span className="font-bold text-slate-700">بعد التسليم</span><span className="font-black text-emerald-950">{calendar.filter((row) => row.month > constructionEndMonth).length} دفعة</span></div></div></div>
        </section>

        <section className="rounded-2xl border-2 border-indigo-300 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-black text-indigo-700">الخطوة التالية</p><h2 className="mt-1 text-xl font-black text-slate-950">إنشاء الدفعة التالية</h2><p className="mt-1 text-xs font-medium text-slate-600">اختر نوع الدفعة فقط؛ النظام يحسب تاريخها ويرفض التوزيع الذي لا يتسع قبل التسليم.</p></div><Badge className="border border-indigo-200 bg-indigo-50 text-indigo-900">آخر قسط إنشاء: قبل التسليم بشهرين</Badge></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-xs font-bold text-slate-700">نوع الدفعة<select value={nextPaymentKind} onChange={(event) => setNextPaymentKind(event.target.value as typeof nextPaymentKind)} className="mt-1 h-11 w-full rounded-lg border-2 border-indigo-300 bg-white px-3 font-black text-slate-950"><option value="booking">دفعة الحجز</option><option value="contract">دفعة توقيع العقد</option><option value="construction_fixed">قسط إنشاء بتاريخ ثابت</option><option value="construction_progress">قسط إنشاء عند نسبة إنجاز</option><option value="construction_series">عدة دفعات أثناء الإنشاء</option><option value="handover">دفعة عند التسليم</option><option value="post_handover_series">دفعات ما بعد التسليم</option></select></label>
            {nextPaymentKind === "construction_fixed" && <label className="text-xs font-bold text-slate-700">تاريخ القسط<input type="month" value={fixedConstructionDate} onChange={(event) => setFixedConstructionDate(event.target.value)} className="mt-1 h-11 w-full rounded-lg border-2 border-indigo-300 bg-white px-3 font-black text-slate-950" /></label>}
            {nextPaymentKind === "construction_progress" && <label className="text-xs font-bold text-slate-700">نسبة الإنجاز من خطة الإنشاء<select value={constructionProgressPct} onChange={(event) => setConstructionProgressPct(Number(event.target.value))} className="mt-1 h-11 w-full rounded-lg border-2 border-indigo-300 bg-white px-3 font-black text-slate-950">{constructionMilestones.length ? constructionMilestones.map((item) => <option key={`${item.month}-${item.progressPct}`} value={item.progressPct}>{item.progressPct}% — {formatProjectMonth(projectStartDate, item.month)}</option>) : <option value={constructionProgressPct}>لا توجد نسب محفوظة بعد</option>}</select></label>}
            {nextPaymentKind === "construction_series" && <><label className="text-xs font-bold text-slate-700">عدد الدفعات<input type="number" min={1} value={seriesCount} onChange={(event) => setSeriesCount(Math.max(1, Number(event.target.value) || 1))} className="mt-1 h-11 w-full rounded-lg border-2 border-indigo-300 bg-white px-3 text-center font-black text-slate-950" /></label><label className="text-xs font-bold text-slate-700">نسبة كل دفعة<input type="number" min={0.01} max={100} value={seriesInstallmentPct} onChange={(event) => setSeriesInstallmentPct(Math.max(0.01, Number(event.target.value) || 0.01))} className="mt-1 h-11 w-full rounded-lg border-2 border-indigo-300 bg-white px-3 text-center font-black text-slate-950" /></label><label className="text-xs font-bold text-slate-700">أول قسط بعد السابقة بـ<input type="number" min={1} value={seriesFirstAfter} onChange={(event) => setSeriesFirstAfter(Math.max(1, Number(event.target.value) || 1))} className="mt-1 h-11 w-full rounded-lg border-2 border-indigo-300 bg-white px-3 text-center font-black text-slate-950" /></label><label className="text-xs font-bold text-slate-700">ثم كل كم شهر<input type="number" min={1} value={seriesEvery} onChange={(event) => setSeriesEvery(Math.max(1, Number(event.target.value) || 1))} className="mt-1 h-11 w-full rounded-lg border-2 border-indigo-300 bg-white px-3 text-center font-black text-slate-950" /></label></>}
            {nextPaymentKind === "post_handover_series" && <><label className="text-xs font-bold text-slate-700">إجمالي النسبة<input type="number" min={0.01} max={100} value={postHandoverTotal} onChange={(event) => setPostHandoverTotal(Math.max(0.01, Number(event.target.value) || 0.01))} className="mt-1 h-11 w-full rounded-lg border-2 border-violet-300 bg-white px-3 text-center font-black text-slate-950" /></label><label className="text-xs font-bold text-slate-700">المدة<select value={postHandoverTerm} onChange={(event) => setPostHandoverTerm(Number(event.target.value))} className="mt-1 h-11 w-full rounded-lg border-2 border-violet-300 bg-white px-3 font-black text-slate-950"><option value={24}>24 شهرًا</option><option value={48}>48 شهرًا</option></select></label><label className="text-xs font-bold text-slate-700">كل<select value={postHandoverEvery} onChange={(event) => setPostHandoverEvery(Number(event.target.value))} className="mt-1 h-11 w-full rounded-lg border-2 border-violet-300 bg-white px-3 font-black text-slate-950"><option value={4}>4 أشهر</option><option value={6}>6 أشهر</option></select></label></>}
          </div>
          <Button onClick={addNextPayment} className="mt-4 bg-indigo-700 text-white hover:bg-indigo-600"><CopyPlus className="ml-1 h-4 w-4" />إنشاء الدفعة التالية</Button>
        </section>

        <details className="rounded-2xl border-2 border-slate-300 bg-white shadow-sm"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4"><span><span className="flex items-center gap-2 font-black text-slate-950"><SlidersHorizontal className="h-4 w-4 text-indigo-700" />تعديل يدوي لدفعة موجودة</span><span className="mt-1 block text-xs text-slate-600">اختياري؛ استخدمه فقط عند الحاجة لتعديل دفعة أُنشئت بالفعل.</span></span><ChevronDown className="h-5 w-5 text-slate-500" /></summary><div className="border-t-2 border-slate-200 p-5">
          {activeEntry && <div className="mt-5 rounded-xl border-2 border-indigo-200 bg-indigo-50/50 p-4"><div className="flex items-center justify-between gap-3"><h3 className="font-black text-indigo-950">تعديل الدفعة {entries.findIndex((entry) => entry.id === activeEntry.id) + 1}</h3><span className="text-xs font-bold text-slate-600">موعدها الحالي: {formatProjectMonth(projectStartDate, activeRow?.month ?? salesStartMonth)}</span></div><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><label className="text-xs font-bold text-slate-700">الوصف<input value={activeEntry.label} onChange={(event) => updateEntry(activeEntry.id, { label: event.target.value })} className="mt-1 h-10 w-full rounded-lg border border-slate-400 bg-white px-3 font-bold text-slate-950" /></label><label className="text-xs font-bold text-slate-700">النسبة<input type="number" min={0} max={100} value={activeEntry.percentage} onChange={(event) => updateEntry(activeEntry.id, { percentage: Math.max(0, Number(event.target.value) || 0) })} className="mt-1 h-10 w-full rounded-lg border-2 border-indigo-300 bg-white px-3 text-center font-black text-indigo-950" /></label><label className="text-xs font-bold text-slate-700">الموعد<select value={activeEntry.timingRule} onChange={(event) => updateEntry(activeEntry.id, { timingRule: event.target.value as PaymentCalendarTimingRule })} className="mt-1 h-10 w-full rounded-lg border border-slate-400 bg-white px-3 font-bold text-slate-950">{Object.entries(timingLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="text-xs font-bold text-slate-700">جهة التحصيل<select value={activeEntry.recipient} onChange={(event) => updateEntry(activeEntry.id, { recipient: event.target.value === "investor" ? "investor" : "escrow" })} className="mt-1 h-10 w-full rounded-lg border border-slate-400 bg-white px-3 font-bold text-slate-950"><option value="escrow">حساب الضمان</option><option value="investor">المستثمر</option></select></label></div>
            <div className="mt-3 flex flex-wrap items-end gap-3">{activeEntry.timingRule === "after_previous" && <label className="text-xs font-bold text-slate-700">بعد السابقة بكم شهر؟<input type="number" min={0} value={activeEntry.offsetMonths ?? 1} onChange={(event) => updateEntry(activeEntry.id, { offsetMonths: Math.max(0, Number(event.target.value) || 0) })} className="mr-2 h-9 w-20 rounded border border-slate-400 bg-white px-2 text-center font-black" /></label>}{activeEntry.timingRule === "construction_progress" && <label className="text-xs font-bold text-slate-700">نسبة الإنجاز<input type="number" min={0} max={100} value={activeEntry.progressPct ?? 0} onChange={(event) => updateEntry(activeEntry.id, { progressPct: Math.min(100, Math.max(0, Number(event.target.value) || 0)) })} className="mr-2 h-9 w-20 rounded border border-slate-400 bg-white px-2 text-center font-black" /></label>}{activeEntry.timingRule === "post_handover" && <label className="text-xs font-bold text-slate-700">بعد التسليم بكم شهر؟<input type="number" min={1} value={activeEntry.offsetMonths ?? 1} onChange={(event) => updateEntry(activeEntry.id, { offsetMonths: Math.max(1, Number(event.target.value) || 1) })} className="mr-2 h-9 w-20 rounded border border-slate-400 bg-white px-2 text-center font-black" /></label>}{activeEntry.timingRule === "manual_date" && <label className="text-xs font-bold text-slate-700">التاريخ<input type="month" value={activeEntry.manualDate ?? monthInputValue(projectStartDate, activeRow?.month ?? salesStartMonth)} onChange={(event) => updateEntry(activeEntry.id, { manualDate: event.target.value })} className="mr-2 h-9 rounded border border-indigo-400 bg-white px-2 font-black" /></label>}<div className="mr-auto flex gap-2"><Button size="sm" variant="outline" onClick={() => moveEntry(activeEntry.id, -1)} disabled={entries.findIndex((entry) => entry.id === activeEntry.id) === 0}><ChevronUp className="ml-1 h-3.5 w-3.5" />أعلى</Button><Button size="sm" variant="outline" onClick={() => moveEntry(activeEntry.id, 1)} disabled={entries.findIndex((entry) => entry.id === activeEntry.id) === entries.length - 1}><ChevronDown className="ml-1 h-3.5 w-3.5" />أسفل</Button><Button size="sm" variant="outline" onClick={() => removeEntry(activeEntry.id)} disabled={entries.length <= 1} className="border-rose-300 bg-rose-50 text-rose-800"><Trash2 className="ml-1 h-3.5 w-3.5" />حذف</Button></div></div></div>}
        </div></details>
      </div>
    </main>
  );
}
