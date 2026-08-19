import { useState, useEffect, useCallback, useMemo } from "react";
import { useProjectContext } from "@/contexts/ProjectContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/hooks/use-toast";
import { ProjectSelector } from "@/components/ProjectSelector";
import { Button } from "@/components/ui/button";
import { formatFullNumber } from "@/lib/numberFormat";
import {
  Save, Loader2, HardHat, TrendingUp, DollarSign, CalendarDays,
  ChevronRight, ChevronLeft, WalletCards, Gauge, Clock3, ShieldCheck,
} from "lucide-react";

type CurveType = "standard" | "front_loaded" | "back_loaded" | "linear";

function generateSCurve(months: number, type: CurveType): number[] {
  const result: number[] = [];
  if (type === "linear") {
    const pct = 100 / months;
    for (let i = 0; i < months; i++) result.push(Math.round(pct * 10) / 10);
    const sum = result.reduce((a, b) => a + b, 0);
    result[result.length - 1] += Math.round((100 - sum) * 10) / 10;
    return result;
  }
  for (let i = 0; i < months; i++) {
    let cumPrev = 0;
    let cumCurr = 0;
    const k = type === "standard" ? 8 : 6;
    const center = type === "front_loaded" ? 0.35 : type === "back_loaded" ? 0.65 : 0.5;
    cumPrev = i === 0 ? 0 : 100 / (1 + Math.exp(-k * ((i / months) - center)));
    cumCurr = 100 / (1 + Math.exp(-k * (((i + 1) / months) - center)));
    result.push(Math.round((cumCurr - cumPrev) * 10) / 10);
  }
  const sum = result.reduce((a, b) => a + b, 0);
  result[result.length - 1] = Math.round((result[result.length - 1] + 100 - sum) * 10) / 10;
  return result;
}

const curveOptions: Array<{ id: CurveType; label: string; note: string; tone: string }> = [
  { id: "standard", label: "قياسي", note: "تصاعد ثم استقرار", tone: "teal" },
  { id: "front_loaded", label: "مبكر", note: "إنجاز أعلى في البداية", tone: "sky" },
  { id: "back_loaded", label: "متأخر", note: "تركيز قرب الإنهاء", tone: "violet" },
  { id: "linear", label: "خطي", note: "وتيرة شهرية متساوية", tone: "amber" },
];

export default function ConstructionInputsPage({ embedded }: { embedded?: boolean } = {}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { selectedProjectId, setSelectedProjectId } = useProjectContext();
  const projectQuery = trpc.projects.getById.useQuery(selectedProjectId!, { enabled: !!selectedProjectId && !!user });
  const updateProject = trpc.projects.update.useMutation({
    onSuccess: () => { projectQuery.refetch(); toast({ title: "تم الحفظ", description: "تم حفظ خطة الإنشاء بنجاح" }); },
    onError: (err: any) => toast({ title: "خطأ", description: "فشل الحفظ: " + err.message, variant: "destructive" }),
  });
  const project = projectQuery.data;
  const [constructionMonths, setConstructionMonths] = useState(18);
  const [mobilizationPct, setMobilizationPct] = useState(10);
  const [retentionPct] = useState(10);
  const [monthlyProgress, setMonthlyProgress] = useState<number[]>([]);
  const [curveType, setCurveType] = useState<CurveType>("standard");
  const [calendarPage, setCalendarPage] = useState(0);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (!project) return;
    const months = project.constructionMonths || 18;
    let schedule: { mobilizationPct?: number; monthlyProgress?: number[]; curveType?: CurveType } | null = null;
    try { if (project.constructionScheduleJson) schedule = JSON.parse(project.constructionScheduleJson); } catch { /* preserved default */ }
    setConstructionMonths(months);
    setMonthlyProgress(schedule?.monthlyProgress?.length === months ? schedule.monthlyProgress : generateSCurve(months, "standard"));
    setMobilizationPct(schedule?.mobilizationPct ?? 10);
    setCurveType(schedule?.curveType ?? "standard");
    setCalendarPage(0);
    setIsDirty(false);
  }, [project]);

  const handleCurve = useCallback((type: CurveType) => {
    setCurveType(type);
    setMonthlyProgress(generateSCurve(constructionMonths, type));
    setCalendarPage(0);
    setIsDirty(true);
  }, [constructionMonths]);

  const handleMonthsChange = useCallback((months: number) => {
    const safeMonths = Math.max(1, Math.min(60, Math.round(months || 1)));
    setConstructionMonths(safeMonths);
    setMonthlyProgress(generateSCurve(safeMonths, curveType));
    setCalendarPage(0);
    setIsDirty(true);
  }, [curveType]);

  const handleMonthEdit = useCallback((index: number, value: number) => {
    setMonthlyProgress(prev => {
      const updated = [...prev];
      updated[index] = Math.max(0, Math.min(30, Number.isFinite(value) ? value : 0));
      return updated;
    });
    setIsDirty(true);
  }, []);

  const totalPct = useMemo(() => Math.round(monthlyProgress.reduce((a, b) => a + b, 0) * 10) / 10, [monthlyProgress]);
  const constructionCost = useMemo(() => {
    if (!project) return 0;
    return (Number(project.manualBuaSqft) || 0) * (Number(project.estimatedConstructionPricePerSqft) || 400);
  }, [project]);
  const totalColumns = constructionMonths + 13;
  const paymentData = useMemo(() => {
    if (!constructionCost || !monthlyProgress.length) return [] as Array<{ month: number; isConstruction: boolean; progressPct: number; fullAmount: number; actualPaid: number; cumulativePaid: number; retention1Release: number; retention2Release: number }>;
    const mobilizationAmount = constructionCost * (mobilizationPct / 100);
    const retentionOne = constructionCost * 0.05;
    const retentionTwo = constructionCost * 0.05;
    let cumulativePaid = 0;
    return Array.from({ length: totalColumns }, (_, col) => {
      const isConstruction = col < constructionMonths;
      let progressPct = 0;
      let fullAmount = 0;
      let actualPaid = 0;
      let retention1Release = 0;
      let retention2Release = 0;
      if (isConstruction && col === 0) { fullAmount = mobilizationAmount; actualPaid = mobilizationAmount; }
      else if (isConstruction) { progressPct = monthlyProgress[col - 1] ?? 0; fullAmount = constructionCost * progressPct / 100; actualPaid = fullAmount * 0.8; }
      else {
        const postMonth = col - constructionMonths + 1;
        if (postMonth === 1) { progressPct = monthlyProgress[constructionMonths - 1] ?? 0; fullAmount = constructionCost * progressPct / 100; actualPaid = fullAmount * 0.8; }
        if (postMonth === 2) retention1Release = retentionOne;
        if (postMonth === 13) retention2Release = retentionTwo;
      }
      cumulativePaid += actualPaid + retention1Release + retention2Release;
      return { month: col + 1, isConstruction, progressPct, fullAmount, actualPaid, cumulativePaid, retention1Release, retention2Release };
    });
  }, [constructionCost, monthlyProgress, mobilizationPct, constructionMonths, totalColumns]);

  const pageCount = Math.max(1, Math.ceil(constructionMonths / 12));
  const pageStart = calendarPage * 12;
  const visibleMonths = monthlyProgress.slice(pageStart, pageStart + 12);
  const paidToContractor = paymentData.reduce((sum, item) => sum + item.actualPaid + item.retention1Release + item.retention2Release, 0);
  const nextRetention = paymentData.find(item => item.retention1Release > 0 || item.retention2Release > 0);
  const handleSave = () => {
    if (!selectedProjectId) return;
    updateProject.mutate({ id: selectedProjectId, constructionMonths, constructionScheduleJson: JSON.stringify({ mobilizationPct, monthlyProgress, curveType }) });
    setIsDirty(false);
  };

  if (!user) return <div className="p-4 text-center text-slate-600">يرجى تسجيل الدخول</div>;

  return <div className="construction-example-canvas bg-slate-50/80 px-4 py-4" dir="rtl">
    <div className="mx-auto max-w-[1440px]">
      <header className="fs-card fs-card-teal mb-4 flex flex-wrap items-center justify-between gap-3 px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-teal-100 text-teal-700"><HardHat className="h-5 w-5" /></span>
          <div><h1 className="text-base font-extrabold text-slate-900">خطة الإنشاء</h1><p className="text-xs text-slate-600">توزيع تقدم التنفيذ ودفعات المقاول</p></div>
        </div>
        <div className="flex items-center gap-2">
          {!embedded && <ProjectSelector selectedId={selectedProjectId} onSelect={setSelectedProjectId} />}
          <Button onClick={handleSave} disabled={!isDirty || updateProject.isPending || !selectedProjectId} className="h-10 bg-teal-600 px-4 text-sm hover:bg-teal-700">
            {updateProject.isPending ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Save className="ml-2 h-4 w-4" />} حفظ الخطة
          </Button>
        </div>
      </header>

      {!selectedProjectId && <div className="rounded-2xl border border-slate-300 bg-white p-8 text-center font-semibold text-slate-700">اختر المشروع من دليل الدراسات أولًا</div>}
      {selectedProjectId && projectQuery.isLoading && <div className="flex justify-center py-12"><Loader2 className="h-7 w-7 animate-spin text-teal-600" /></div>}

      {selectedProjectId && project && <div className="space-y-4">
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="fs-card fs-card-teal p-4">
            <div className="mb-2 flex items-center justify-between text-sm font-bold text-slate-800"><span>مدة الإنشاء</span><span className="example-icon-tile example-icon-teal"><Clock3 className="h-4 w-4" /></span></div>
            <div className="flex items-center gap-2"><input aria-label="مدة الإنشاء بالأشهر" type="number" min={1} max={60} value={constructionMonths} onChange={e => handleMonthsChange(Number(e.target.value))} className="h-12 w-24 rounded-xl border border-teal-300 bg-white text-center text-xl font-extrabold text-slate-900 outline-none ring-teal-200 focus:ring-2" /><span className="font-semibold text-slate-700">شهرًا</span></div>
          </div>
          <div className="fs-card fs-card-blue p-4">
            <div className="mb-2 flex items-center justify-between text-sm font-bold text-slate-800"><span>الدفعة المقدمة</span><span className="example-icon-tile example-icon-blue"><WalletCards className="h-4 w-4" /></span></div>
            <div className="flex items-center gap-2"><input aria-label="نسبة الدفعة المقدمة" type="number" min={0} max={50} step={0.5} value={mobilizationPct} onChange={e => { setMobilizationPct(Math.max(0, Math.min(50, Number(e.target.value) || 0))); setIsDirty(true); }} className="h-12 w-24 rounded-xl border border-sky-300 bg-white text-center text-xl font-extrabold text-slate-900 outline-none ring-sky-200 focus:ring-2" /><span className="font-semibold text-slate-700">%</span></div>
          </div>
          <div className="fs-card fs-card-rose p-4">
            <div className="mb-1 flex items-center justify-between text-sm font-bold text-slate-800"><span>تكلفة عقد الإنشاء</span><span className="example-icon-tile example-icon-rose"><DollarSign className="h-4 w-4" /></span></div>
            <div className="text-xl font-extrabold tracking-tight text-slate-950">{constructionCost ? formatFullNumber(constructionCost, "—") : "—"}</div>
            <div className="mt-1 text-xs text-slate-600">مساحة البناء × تكلفة القدم</div>
          </div>
          <div className="fs-card fs-card-amber p-4">
            <div className="mb-1 flex items-center justify-between text-sm font-bold text-slate-800"><span>الاحتجاز</span><span className="example-icon-tile example-icon-amber"><ShieldCheck className="h-4 w-4" /></span></div>
            <div className="text-xl font-extrabold text-slate-950">{retentionPct}%</div>
            <div className="mt-1 text-xs text-slate-600">5% بعد شهرين و5% بعد 13 شهرًا</div>
          </div>
        </section>

        <section className="fs-card fs-card-teal p-4">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2"><div><h2 className="flex items-center gap-2 text-base font-extrabold text-slate-900"><Gauge className="h-5 w-5 text-teal-700" />وتيرة التنفيذ</h2><p className="mt-1 text-xs text-slate-600">اختيار المنحنى يعيد توزيع الإنجاز في الخطة الحالية. لا يحفظ التغيير إلا عبر زر الحفظ.</p></div><div className={`rounded-lg px-3 py-1.5 text-sm font-bold ${totalPct === 100 ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>إجمالي الإنجاز: {totalPct}%</div></div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{curveOptions.map(option => <button key={option.id} onClick={() => handleCurve(option.id)} className={`rounded-xl border-2 p-3 text-right transition ${curveType === option.id ? "border-teal-500 bg-teal-50 shadow-sm" : "border-slate-200 bg-white hover:border-teal-200 hover:bg-slate-50"}`}><div className="flex items-center justify-between"><span className="font-extrabold text-slate-900">{option.label}</span><span className={`h-2.5 w-2.5 rounded-full bg-${option.tone}-500`} /></div><span className="mt-1 block text-xs text-slate-600">{option.note}</span></button>)}</div>
        </section>

        {constructionCost > 0 ? <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_290px]">
          <div className="fs-card fs-card-blue p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="flex items-center gap-2 text-base font-extrabold text-slate-900"><CalendarDays className="h-5 w-5 text-teal-700" />تقويم التنفيذ الشهري</h2><p className="mt-1 text-xs text-slate-600">أدخل نسبة إنجاز كل شهر مباشرة. تتحرك قيمة العقد ومؤشر التقدم فورًا.</p></div><div className="flex items-center gap-2"><Button variant="outline" size="icon" className="h-9 w-9 border-slate-300" disabled={calendarPage === 0} onClick={() => setCalendarPage(p => p - 1)}><ChevronRight className="h-4 w-4" /></Button><span className="min-w-24 text-center text-sm font-bold text-slate-800">الأشهر {pageStart + 1}–{Math.min(pageStart + 12, constructionMonths)}</span><Button variant="outline" size="icon" className="h-9 w-9 border-slate-300" disabled={calendarPage >= pageCount - 1} onClick={() => setCalendarPage(p => p + 1)}><ChevronLeft className="h-4 w-4" /></Button></div></div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{visibleMonths.map((pct, localIndex) => { const index = pageStart + localIndex; const allocation = constructionCost * pct / 100; return <article key={index} className="fs-card fs-card-cyan p-3"><div className="mb-2 flex items-center justify-between"><span className="text-sm font-extrabold text-slate-900">شهر الإنشاء {index + 1}</span><span className="fs-pill fs-pill-teal">{pct}%</span></div><input aria-label={`إنجاز شهر الإنشاء ${index + 1}`} type="number" min={0} max={30} step={0.5} value={pct} onChange={e => handleMonthEdit(index, Number(e.target.value))} className="h-12 w-full rounded-lg border border-slate-400 bg-white text-center text-xl font-extrabold text-slate-950 outline-none ring-teal-200 focus:ring-2" /><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-gradient-to-l from-teal-600 to-cyan-300 transition-all" style={{ width: `${Math.min(100, pct / 30 * 100)}%` }} /></div><div className="mt-2 text-xs font-semibold text-slate-700">قيمة الأعمال: {formatFullNumber(allocation, "—")}</div></article>; })}</div>
          </div>
          <aside className="fs-card fs-card-teal p-4"><h2 className="mb-4 text-base font-extrabold text-slate-900">أثر خطة التنفيذ</h2><div className="space-y-3"><div className="fs-card fs-card-blue rounded-xl p-3"><div className="text-xs text-slate-600">تكلفة عقد الإنشاء</div><div className="mt-1 text-lg font-extrabold text-slate-950">{formatFullNumber(constructionCost, "—")}</div></div><div className="fs-card fs-card-violet rounded-xl p-3"><div className="text-xs text-slate-600">إجمالي مدفوعات المقاول</div><div className="mt-1 text-lg font-extrabold text-slate-950">{formatFullNumber(paidToContractor, "—")}</div></div><div className="fs-card fs-card-amber rounded-xl p-3"><div className="text-xs text-slate-600">دفعة الشهر الحالي</div><div className="mt-1 text-lg font-extrabold text-slate-950">{formatFullNumber(paymentData[pageStart]?.actualPaid ?? 0, "—")}</div></div><div className="fs-card fs-card-rose rounded-xl p-3"><div className="text-xs text-slate-600">إطلاق احتجاز قادم</div><div className="mt-1 text-sm font-extrabold text-slate-900">{nextRetention ? `شهر ${nextRetention.month}: ${formatFullNumber(nextRetention.retention1Release + nextRetention.retention2Release, "—")}` : "لا يوجد"}</div></div></div></aside>
        </section> : <div className="rounded-2xl border border-amber-300 bg-amber-50 p-6 text-center text-sm font-semibold text-slate-800">أدخل مساحة البناء وتكلفة القدم من بطاقة المشروع لعرض خطة الإنشاء.</div>}

        {constructionCost > 0 && <section className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm"><div className="mb-3 flex items-center gap-2"><TrendingUp className="h-5 w-5 text-teal-700" /><div><h2 className="font-extrabold text-slate-900">مؤشر الإنجاز</h2><p className="text-xs text-slate-600">صورة سريعة للأشهر الظاهرة في التقويم</p></div></div><div className="flex h-36 items-end gap-1.5 border-b border-slate-300 pb-5">{visibleMonths.map((pct, i) => <div key={i} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"><span className="text-xs font-bold text-slate-700">{pct}%</span><div className="w-full rounded-t-md bg-gradient-to-t from-teal-600 to-cyan-300" style={{ height: `${Math.max(3, pct / Math.max(...monthlyProgress, 1) * 100)}%` }} /><span className="text-xs font-bold text-slate-700">{pageStart + i + 1}</span></div>)}</div></section>}

        {constructionCost > 0 && <details className="rounded-2xl border border-slate-300 bg-white p-4"><summary className="cursor-pointer font-extrabold text-slate-900">تفاصيل دفعات المقاول للتدقيق</summary><div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{paymentData.slice(pageStart, pageStart + 12).map(item => <div key={item.month} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm"><div className="font-extrabold text-slate-900">{item.isConstruction ? `شهر الإنشاء ${item.month}` : `بعد الإنجاز +${item.month - constructionMonths}`}</div><div className="mt-2 text-slate-700">دفعة المقاول: <b>{formatFullNumber(item.actualPaid + item.retention1Release + item.retention2Release, "—")}</b></div><div className="mt-1 text-slate-700">التراكمي: <b>{formatFullNumber(item.cumulativePaid, "—")}</b></div></div>)}</div></details>}
      </div>}
    </div>
  </div>;
}
