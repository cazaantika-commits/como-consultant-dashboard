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
} from "@/lib/flexiblePaymentPlan";
import {
  buildPaymentCalendar,
  buyerDueCalendar,
  calendarEntriesFromPlan,
  expandPaymentCalendarEntries,
  paymentCalendarTotal,
} from "@/lib/paymentPlanCalendar";
import { getProjectMarketingTiming } from "@/lib/projectTiming";
import { default as ArrowRight } from "lucide-react/dist/esm/icons/arrow-right.js";
import { default as CalendarDays } from "lucide-react/dist/esm/icons/calendar-days.js";
import { default as ChevronDown } from "lucide-react/dist/esm/icons/chevron-down.js";
import { default as ChevronUp } from "lucide-react/dist/esm/icons/chevron-up.js";
import { default as Clock3 } from "lucide-react/dist/esm/icons/clock-3.js";
import { default as CopyPlus } from "lucide-react/dist/esm/icons/copy-plus.js";
import { default as HardHat } from "lucide-react/dist/esm/icons/hard-hat.js";
import { default as Landmark } from "lucide-react/dist/esm/icons/landmark.js";
import { default as Save } from "lucide-react/dist/esm/icons/save.js";
import { default as Trash2 } from "lucide-react/dist/esm/icons/trash-2.js";

const timingLabels: Record<PaymentCalendarTimingRule, string> = {
  booking: "عند الحجز / فتح البيع",
  after_previous: "بعد الدفعة السابقة",
  construction_progress: "عند نسبة إنجاز",
  handover: "عند التسليم",
  post_handover: "بعد التسليم",
  manual_date: "تاريخ يدوي",
};

function toMonthDate(projectStart: string | undefined, month: number) {
  const match = String(projectStart || "").match(/^(\d{4})-(\d{2})/);
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1 + month - 1, 1));
}

function formatProjectMonth(projectStart: string | undefined, month: number) {
  const date = toMonthDate(projectStart, month);
  if (!date) return `الشهر ${month}`;
  return new Intl.DateTimeFormat("ar-AE", { month: "long", year: "numeric", timeZone: "UTC" }).format(date);
}

function monthInputValue(projectStart: string | undefined, month: number) {
  const date = toMonthDate(projectStart, month);
  if (!date) return "";
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function defaultEntry(rule: PaymentCalendarTimingRule, sequence: number): PaymentCalendarEntry {
  const id = `payment-${Date.now()}-${sequence}`;
  if (rule === "booking") return { id, sequence, label: "دفعة الحجز", percentage: 0, recipient: "escrow", timingRule: rule };
  if (rule === "handover") return { id, sequence, label: "دفعة التسليم", percentage: 0, recipient: "escrow", timingRule: rule };
  if (rule === "construction_progress") return { id, sequence, label: "دفعة عند إنجاز", percentage: 0, recipient: "escrow", timingRule: rule, progressPct: 25 };
  if (rule === "post_handover") return { id, sequence, label: "دفعة بعد التسليم", percentage: 0, recipient: "investor", timingRule: rule, offsetMonths: 1 };
  if (rule === "manual_date") return { id, sequence, label: "دفعة بتاريخ يدوي", percentage: 0, recipient: "escrow", timingRule: rule };
  return { id, sequence, label: "دفعة لاحقة", percentage: 0, recipient: "escrow", timingRule: rule, offsetMonths: 1 };
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
  const [purchaseMonth, setPurchaseMonth] = useState(1);
  const [seriesTotal, setSeriesTotal] = useState(20);
  const [seriesFirstAfter, setSeriesFirstAfter] = useState(3);
  const [seriesEvery, setSeriesEvery] = useState(4);
  const hydratedPlanId = useRef<number | null>(null);

  const project = projectQuery.data as any;
  const timing = useMemo(() => getProjectMarketingTiming(project), [project]);
  const salesStartMonth = timing.salesStartMonth;
  const constructionEndMonth = timing.projectEndMonth;
  const projectStartDate = project?.startDate as string | undefined;

  useEffect(() => {
    const saved = plansQuery.data?.[0] as any;
    if (!saved || hydratedPlanId.current === saved.id) return;
    hydratedPlanId.current = saved.id;
    let parsed: FlexiblePaymentPlan;
    try { parsed = normalizeFlexiblePaymentPlan(JSON.parse(saved.paymentPlanJson || "{}")); }
    catch { parsed = cloneFlexiblePaymentPlan(); }
    setPlanId(saved.id);
    setPlan(parsed);
    setEntries(expandPaymentCalendarEntries(calendarEntriesFromPlan(parsed), {
      projectSalesStartMonth: salesStartMonth,
      constructionStartMonth: timing.constructionStartMonth,
      constructionEndMonth,
      projectStartDate,
    }));
    setPurchaseMonth(Math.max(1, salesStartMonth));
  }, [plansQuery.data, salesStartMonth]);

  useEffect(() => {
    if (!plansQuery.data?.length) {
      const draft = cloneFlexiblePaymentPlan();
      setPlanId(undefined);
      setPlan(draft);
      setEntries(expandPaymentCalendarEntries(calendarEntriesFromPlan(draft), {
        projectSalesStartMonth: salesStartMonth,
        constructionStartMonth: timing.constructionStartMonth,
        constructionEndMonth,
        projectStartDate,
      }));
      setPurchaseMonth(Math.max(1, salesStartMonth));
    }
  }, [plansQuery.data, salesStartMonth]);

  const calendar = useMemo(() => buildPaymentCalendar(entries, {
    projectSalesStartMonth: salesStartMonth,
    constructionStartMonth: timing.constructionStartMonth,
    constructionEndMonth,
    projectStartDate,
  }), [entries, salesStartMonth, timing.constructionStartMonth, constructionEndMonth, projectStartDate]);
  const dueAtPurchase = useMemo(() => buyerDueCalendar(calendar, purchaseMonth), [calendar, purchaseMonth]);
  const total = paymentCalendarTotal(entries);
  const dueNow = calendar.filter((row) => row.month <= purchaseMonth).reduce((sum, row) => sum + row.percentage, 0);
  const totalFuture = Math.max(0, total - dueNow);
  const constructionOverrun = calendar.some((row) => row.timingRule !== "post_handover" && row.month > constructionEndMonth);

  const updateEntry = (id: string, patch: Partial<PaymentCalendarEntry>) => {
    setEntries((current) => current.map((entry) => entry.id === id ? { ...entry, ...patch } : entry));
  };
  const addEntry = (rule: PaymentCalendarTimingRule) => setEntries((current) => [...current, defaultEntry(rule, current.length + 1)]);
  const removeEntry = (id: string) => setEntries((current) => current.filter((entry) => entry.id !== id).map((entry, index) => ({ ...entry, sequence: index + 1 })));
  const moveEntry = (id: string, direction: -1 | 1) => setEntries((current) => {
    const ordered = current.slice().sort((a, b) => a.sequence - b.sequence);
    const index = ordered.findIndex((entry) => entry.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ordered.length) return current;
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    return ordered.map((entry, order) => ({ ...entry, sequence: order + 1 }));
  });
  const addPeriodicSeries = () => {
    const lastMonth = calendar.at(-1)?.month ?? salesStartMonth;
    const firstMonth = lastMonth + Math.max(1, seriesFirstAfter);
    if (firstMonth > constructionEndMonth) {
      toast({ title: "لا توجد فترة إنشاء متبقية", description: "ضع السلسلة قبل التسليم أو استخدم دفعات ما بعد التسليم.", variant: "destructive" });
      return;
    }
    const count = Math.floor((constructionEndMonth - firstMonth) / Math.max(1, seriesEvery)) + 1;
    const portion = Math.round((seriesTotal / count) * 100) / 100;
    setEntries((current) => [
      ...current,
      ...Array.from({ length: count }, (_, index) => ({
        id: `periodic-${Date.now()}-${index}`,
        sequence: current.length + index + 1,
        label: `قسط الإنشاء ${index + 1}`,
        percentage: index === count - 1 ? Math.round((seriesTotal - (portion * (count - 1))) * 100) / 100 : portion,
        recipient: "escrow" as const,
        timingRule: "after_previous" as const,
        offsetMonths: index === 0 ? Math.max(1, seriesFirstAfter) : Math.max(1, seriesEvery),
      })),
    ]);
  };
  const save = async () => {
    if (!selectedProjectId) return;
    try {
      const updatedPlan: FlexiblePaymentPlan = { ...plan, calendarEntries: entries };
      const result = await saveCalendar.mutateAsync({
        planId,
        projectId: selectedProjectId,
        paymentPlanJson: JSON.stringify(updatedPlan),
      });
      setPlanId(result.id);
      setPlan(updatedPlan);
      await plansQuery.refetch();
      toast({ title: "تم حفظ تقويم الدفعات", description: "يمكنك اعتماد سيناريو المبيعات لإعادة قراءة التدفقات من الخطة." });
    } catch (error: any) {
      toast({ title: "تعذر حفظ خطة السداد", description: error?.message || "تحقق من الاتصال ثم أعد المحاولة.", variant: "destructive" });
    }
  };

  if (!selectedProjectId || !project) {
    return <main dir="rtl" className="min-h-screen bg-slate-50 p-5"><div className="mx-auto max-w-3xl rounded-3xl border-2 border-slate-200 bg-white p-8 text-center shadow-sm"><Landmark className="mx-auto h-9 w-9 text-indigo-600" /><h1 className="mt-3 text-2xl font-black text-slate-950">خطة سداد المشترين</h1><p className="mt-2 text-sm text-slate-600">اختر مشروعًا وانتظر تحميل بياناته أولًا، ثم تظهر تواريخ الدفعات من برنامج المشروع الحقيقي.</p><div className="mx-auto mt-5 max-w-sm"><ProjectSelector selectedId={selectedProjectId} onSelect={(id) => { hydratedPlanId.current = null; setSelectedProjectId(id); }} /></div></div></main>;
  }

  return (
    <main dir="rtl" className="min-h-screen bg-slate-50 px-3 py-4 text-slate-950 sm:px-5 lg:px-8">
      <div className="mx-auto max-w-[1500px] space-y-4">
        <header className="overflow-hidden rounded-[26px] border-2 border-indigo-300 bg-[linear-gradient(120deg,#eef2ff,#ffffff_52%,#ecfeff)] shadow-[0_14px_34px_rgba(15,23,42,0.08)]">
          <div className="flex flex-col gap-4 px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
            <div><div className="flex items-center gap-2 text-xs font-black text-indigo-700"><CalendarDays className="h-4 w-4" />تقويم التزام المشتري</div><h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">خطة سداد المشترين</h1><p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-slate-700">رتّب الدفعات كما يستحقها المشروع؛ يظهر تاريخ كل دفعة الحقيقي فورًا، ويظل كل صف قابلاً للتعديل اليدوي من وائل.</p></div>
            <div className="flex flex-wrap items-center gap-2"><div className="min-w-[210px]"><ProjectSelector selectedId={selectedProjectId} onSelect={(id) => { hydratedPlanId.current = null; setSelectedProjectId(id); }} /></div><Button onClick={() => navigate("/v2/wael-sales")} variant="outline" className="border-indigo-300 bg-white text-indigo-900"><ArrowRight className="ml-1 h-4 w-4" />مساحة وائل</Button><Button onClick={save} disabled={saveCalendar.isPending} className="bg-indigo-700 text-white hover:bg-indigo-600"><Save className="ml-1 h-4 w-4" />حفظ الخطة</Button></div>
          </div>
          <div className="grid border-t border-indigo-200 bg-white/70 sm:grid-cols-4"><div className="border-b border-indigo-100 px-5 py-3 sm:border-b-0 sm:border-l"><p className="text-[10px] font-black text-slate-500">بدء البيع</p><p className="mt-1 font-black text-indigo-950">{formatProjectMonth(projectStartDate, salesStartMonth)}</p></div><div className="border-b border-indigo-100 px-5 py-3 sm:border-b-0 sm:border-l"><p className="text-[10px] font-black text-slate-500">بدء الإنشاء</p><p className="mt-1 font-black text-slate-950">{formatProjectMonth(projectStartDate, timing.constructionStartMonth)}</p></div><div className="border-b border-indigo-100 px-5 py-3 sm:border-b-0 sm:border-l"><p className="text-[10px] font-black text-slate-500">التسليم</p><p className="mt-1 font-black text-emerald-800">{formatProjectMonth(projectStartDate, constructionEndMonth)}</p></div><div className="px-5 py-3"><p className="text-[10px] font-black text-slate-500">إجمالي الخطة</p><p className="mt-1 font-black text-slate-950">{total}%</p></div></div>
        </header>

        <section className="rounded-2xl border-2 border-sky-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-xs font-black text-sky-800">أضف دفعة بقاعدة واضحة</p><p className="mt-1 text-xs text-slate-600">تُولد تلقائيًا ثم تستطيع تعديل كل سطر مستقلًا.</p></div><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => addEntry("after_previous")} className="border-sky-300 bg-sky-50 text-sky-900"><CopyPlus className="ml-1 h-3.5 w-3.5" />بعد السابقة</Button><Button size="sm" variant="outline" onClick={() => addEntry("construction_progress")} className="border-amber-300 bg-amber-50 text-amber-900"><HardHat className="ml-1 h-3.5 w-3.5" />عند إنجاز</Button><Button size="sm" variant="outline" onClick={() => addEntry("handover")} className="border-emerald-300 bg-emerald-50 text-emerald-900">عند التسليم</Button><Button size="sm" variant="outline" onClick={() => addEntry("post_handover")} className="border-violet-300 bg-violet-50 text-violet-900">بعد التسليم</Button></div></div>
          <div className="mt-3 grid gap-2 border-t border-sky-100 pt-3 sm:grid-cols-4"><label className="text-[10px] font-black text-slate-700">إجمالي السلسلة %<input type="number" min={0} max={100} value={seriesTotal} onChange={(event) => setSeriesTotal(Math.max(0, Number(event.target.value) || 0))} className="mt-1 h-9 w-full rounded-lg border border-slate-400 bg-white px-2 text-center font-black" /></label><label className="text-[10px] font-black text-slate-700">تبدأ بعد آخر دفعة (شهر)<input type="number" min={1} value={seriesFirstAfter} onChange={(event) => setSeriesFirstAfter(Math.max(1, Number(event.target.value) || 1))} className="mt-1 h-9 w-full rounded-lg border border-slate-400 bg-white px-2 text-center font-black" /></label><label className="text-[10px] font-black text-slate-700">كل كم شهر<input type="number" min={1} value={seriesEvery} onChange={(event) => setSeriesEvery(Math.max(1, Number(event.target.value) || 1))} className="mt-1 h-9 w-full rounded-lg border border-slate-400 bg-white px-2 text-center font-black" /></label><Button onClick={addPeriodicSeries} className="self-end bg-sky-700 text-white hover:bg-sky-600"><Clock3 className="ml-1 h-4 w-4" />ولّد دفعات الإنشاء</Button></div>
        </section>

        <section className="overflow-hidden rounded-2xl border-2 border-slate-300 bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b-2 border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-black text-slate-950">الدفعات مرتبة زمنيًا</h2><p className="mt-0.5 text-xs text-slate-600">يتغير ترتيب الجدول تلقائيًا عند تعديل التاريخ. الأسهم تعيد ترتيب القاعدة قبل الحساب.</p></div><div className="flex flex-wrap gap-2"><Badge className={Math.abs(total - 100) < 0.01 ? "border border-emerald-300 bg-emerald-50 text-emerald-900" : "border border-rose-300 bg-rose-50 text-rose-900"}>مجموع النسب {total}%</Badge>{constructionOverrun && <Badge className="border border-amber-300 bg-amber-50 text-amber-900">تنبيه: دفعة قبل التسليم تجاوزت موعده</Badge>}</div></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[1120px] border-collapse text-right"><thead className="bg-slate-900 text-white"><tr className="text-xs"><th className="w-16 border-l border-slate-700 px-3 py-3 text-center">#</th><th className="border-l border-slate-700 px-3 py-3">وصف الدفعة</th><th className="w-44 border-l border-slate-700 px-3 py-3">قاعدة الموعد</th><th className="w-40 border-l border-slate-700 px-3 py-3">تفصيل القاعدة</th><th className="w-28 border-l border-slate-700 px-3 py-3">النسبة</th><th className="w-36 border-l border-slate-700 px-3 py-3">جهة التحصيل</th><th className="w-44 border-l border-slate-700 px-3 py-3">تاريخ الاستحقاق</th><th className="w-20 px-3 py-3 text-center">إجراء</th></tr></thead><tbody>{entries.map((entry, index) => { const row = calendar.find((item) => item.id === entry.id); return <tr key={entry.id} className="border-b border-slate-200 align-top hover:bg-indigo-50/30"><td className="border-l border-slate-200 px-2 py-2 text-center"><div className="flex flex-col items-center gap-1"><span className="rounded-full bg-indigo-700 px-2 py-1 text-xs font-black text-white">{index + 1}</span><button type="button" onClick={() => moveEntry(entry.id, -1)} disabled={index === 0} className="text-slate-500 disabled:opacity-30"><ChevronUp className="h-3.5 w-3.5" /></button><button type="button" onClick={() => moveEntry(entry.id, 1)} disabled={index === entries.length - 1} className="text-slate-500 disabled:opacity-30"><ChevronDown className="h-3.5 w-3.5" /></button></div></td><td className="border-l border-slate-200 px-2 py-2"><input value={entry.label} onChange={(event) => updateEntry(entry.id, { label: event.target.value })} className="h-9 w-full rounded-lg border border-slate-400 bg-white px-2 text-sm font-bold text-slate-950" /></td><td className="border-l border-slate-200 px-2 py-2"><select value={entry.timingRule} onChange={(event) => updateEntry(entry.id, { timingRule: event.target.value as PaymentCalendarTimingRule })} className="h-9 w-full rounded-lg border border-slate-400 bg-white px-2 text-xs font-bold text-slate-950">{Object.entries(timingLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></td><td className="border-l border-slate-200 px-2 py-2">{entry.timingRule === "after_previous" && <label className="text-[10px] font-bold text-slate-600">بعد السابقة<input type="number" min={0} value={entry.offsetMonths ?? 1} onChange={(event) => updateEntry(entry.id, { offsetMonths: Math.max(0, Number(event.target.value) || 0) })} className="mt-1 h-8 w-full rounded border border-slate-400 px-2 text-center font-black text-slate-950" /></label>}{entry.timingRule === "construction_progress" && <label className="text-[10px] font-bold text-slate-600">نسبة الإنجاز<input type="number" min={0} max={100} value={entry.progressPct ?? 0} onChange={(event) => updateEntry(entry.id, { progressPct: Math.min(100, Math.max(0, Number(event.target.value) || 0)) })} className="mt-1 h-8 w-full rounded border border-slate-400 px-2 text-center font-black text-slate-950" /></label>}{entry.timingRule === "post_handover" && <label className="text-[10px] font-bold text-slate-600">بعد التسليم (شهر)<input type="number" min={1} value={entry.offsetMonths ?? 1} onChange={(event) => updateEntry(entry.id, { offsetMonths: Math.max(1, Number(event.target.value) || 1) })} className="mt-1 h-8 w-full rounded border border-slate-400 px-2 text-center font-black text-slate-950" /></label>}{entry.timingRule === "manual_date" && <input type="month" value={entry.manualDate ?? monthInputValue(projectStartDate, row?.month ?? salesStartMonth)} onChange={(event) => updateEntry(entry.id, { manualDate: event.target.value })} className="h-9 w-full rounded border border-indigo-400 bg-indigo-50 px-2 text-xs font-black text-slate-950" />}{["booking", "handover"].includes(entry.timingRule) && <span className="text-xs font-bold text-slate-500">يحسب من البرنامج</span>}</td><td className="border-l border-slate-200 px-2 py-2"><div className="flex items-center gap-1"><input type="number" min={0} max={100} value={entry.percentage} onChange={(event) => updateEntry(entry.id, { percentage: Math.max(0, Number(event.target.value) || 0) })} className="h-9 w-20 rounded-lg border-2 border-indigo-300 bg-white px-1 text-center font-black text-indigo-950" /><span className="font-black text-slate-600">%</span></div></td><td className="border-l border-slate-200 px-2 py-2"><select value={entry.recipient} onChange={(event) => updateEntry(entry.id, { recipient: event.target.value === "investor" ? "investor" : "escrow" })} className="h-9 w-full rounded-lg border border-slate-400 bg-white px-2 text-xs font-bold text-slate-950"><option value="escrow">حساب الضمان</option><option value="investor">المستثمر</option></select></td><td className="border-l border-slate-200 px-2 py-2"><p className="font-black text-slate-950">{formatProjectMonth(projectStartDate, row?.month ?? salesStartMonth)}</p><p className="mt-1 text-[10px] font-bold text-slate-500">الشهر {row?.month ?? salesStartMonth} · {row?.automatic ? "محسوب" : "يدوي"}</p></td><td className="px-2 py-2 text-center"><button type="button" onClick={() => removeEntry(entry.id)} disabled={entries.length <= 1} className="rounded-lg border border-rose-300 bg-rose-50 p-2 text-rose-800 disabled:opacity-30"><Trash2 className="h-4 w-4" /></button></td></tr>; })}</tbody></table></div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.25fr_.75fr]"><div className="rounded-2xl border-2 border-amber-300 bg-white p-4 shadow-sm"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black text-amber-800">التزام المشتري عند تاريخ البيع</p><h2 className="mt-1 text-lg font-black text-slate-950">ماذا يدفع من يشتري متأخرًا؟</h2></div><Landmark className="h-7 w-7 text-amber-600" /></div><div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]"><label className="text-xs font-bold text-slate-700">تاريخ شراء افتراضي للمراجعة<select value={purchaseMonth} onChange={(event) => setPurchaseMonth(Number(event.target.value))} className="mt-1 h-10 w-full rounded-lg border-2 border-amber-300 bg-amber-50 px-3 font-black text-slate-950">{Array.from({ length: Math.max(1, constructionEndMonth - salesStartMonth + 1) }, (_, index) => { const month = salesStartMonth + index; return <option key={month} value={month}>{formatProjectMonth(projectStartDate, month)}</option>; })}</select></label><div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-center"><p className="text-[10px] font-black text-amber-800">يُحصّل فورًا</p><p className="mt-1 text-2xl font-black text-amber-950">{dueNow}%</p><p className="text-[10px] font-bold text-amber-800">ثم يبقى {totalFuture}%</p></div></div><p className="mt-3 text-xs leading-6 text-slate-700">تُجمع كل الدفعات التي استحقت قبل هذا التاريخ في تحصيل شهر البيع للمشتري المتأخر. أما الدفعات المستقبلية فتظل في تواريخها الأصلية.</p></div><div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-4 shadow-sm"><p className="text-xs font-black text-emerald-800">قراءة سريعة</p><div className="mt-3 space-y-2 text-sm"><div className="flex justify-between border-b border-emerald-200 pb-2"><span className="font-bold text-slate-700">عدد الدفعات</span><span className="font-black text-emerald-950">{entries.length}</span></div><div className="flex justify-between border-b border-emerald-200 pb-2"><span className="font-bold text-slate-700">آخر تاريخ قبل التسليم</span><span className="font-black text-emerald-950">{formatProjectMonth(projectStartDate, Math.min(constructionEndMonth, calendar.filter((row) => row.month <= constructionEndMonth).at(-1)?.month ?? constructionEndMonth))}</span></div><div className="flex justify-between"><span className="font-bold text-slate-700">بعد التسليم</span><span className="font-black text-emerald-950">{calendar.filter((row) => row.month > constructionEndMonth).length} دفعة</span></div></div></div></section>
      </div>
    </main>
  );
}
