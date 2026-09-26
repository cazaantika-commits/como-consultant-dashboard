import { useMemo, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ComoNextSpecialistDesks } from "@/components/ComoNextSpecialistDesks";
import {
  ArrowLeft,
  BookOpenCheck,
  BrainCircuit,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  CircleAlert,
  ClipboardList,
  Clock3,
  DraftingCompass,
  ExternalLink,
  FileCheck2,
  FileSignature,
  FileStack,
  Landmark,
  Link2,
  ListChecks,
  LockKeyhole,
  Mail,
  MapPinned,
  Route,
  Scale,
  ShieldCheck,
  Sparkles,
  TimerReset,
  UsersRound,
} from "lucide-react";

const workFileStatus: Record<string, { label: string; className: string }> = {
  draft: { label: "مسودة", className: "border-slate-200 bg-slate-100 text-slate-700" },
  open: { label: "نشط", className: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  waiting: { label: "بانتظار دليل أو رد", className: "border-amber-200 bg-amber-50 text-amber-800" },
  blocked: { label: "متعطل", className: "border-rose-200 bg-rose-50 text-rose-800" },
  ready_to_close: { label: "جاهز للإغلاق", className: "border-cyan-200 bg-cyan-50 text-cyan-800" },
  closed: { label: "مغلق", className: "border-slate-200 bg-slate-100 text-slate-600" },
  cancelled: { label: "ملغي", className: "border-slate-200 bg-slate-50 text-slate-500" },
};

const contractStatusLabels: Record<string, string> = {
  draft: "مسودة",
  active: "نشط",
  expired: "منتهي",
  terminated: "منهى",
  renewed: "مجدد",
  pending: "بانتظار الاعتماد",
};

const lifecycleStatusLabels: Record<string, string> = {
  not_started: "لم يبدأ",
  in_progress: "قيد التنفيذ",
  completed: "مكتمل في المصدر",
  submitted: "مقدم في المصدر",
  locked: "مقفل",
};

function ReadOnlySourceBadge() {
  return <Badge variant="outline" className="rounded-full border-[#b7d5d2] bg-[#f2faf8] text-[#216b66]">سجل المصدر — قراءة فقط</Badge>;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value.endsWith?.("Z") ? value : `${value.replace(" ", "T")}Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ar-AE", { timeZone: "Asia/Dubai", day: "numeric", month: "short", year: "numeric" }).format(date);
}

function formatArea(value: unknown, unit: string) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return null;
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(number)} ${unit}`;
}

function Metric({ label, value, note, icon: Icon, tone }: { label: string; value: number; note: string; icon: typeof FileStack; tone: string }) {
  return <Card className="rounded-[24px] border-slate-200 bg-white p-4 shadow-[0_14px_34px_rgba(15,23,42,.045)]">
    <div className="flex items-start justify-between gap-3"><div><p className="text-[11px] font-bold text-slate-500">{label}</p><p className="mt-2 text-3xl font-black text-slate-950"><bdi>{value}</bdi></p></div><div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${tone}`}><Icon className="h-5 w-5" /></div></div>
    <p className="mt-3 text-[11px] leading-5 text-slate-500">{note}</p>
  </Card>;
}

function NumberedList({ items, tone = "slate" }: { items: string[]; tone?: "slate" | "amber" | "teal" }) {
  const color = tone === "amber" ? "bg-amber-100 text-amber-800" : tone === "teal" ? "bg-teal-100 text-teal-800" : "bg-slate-100 text-slate-700";
  return <div className="space-y-3">{items.map((item, index) => <div key={`${index}-${item}`} className="flex gap-3 rounded-2xl border border-slate-100 bg-white/80 p-3.5"><span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${color}`}><bdi>{index + 1}</bdi></span><p className="pt-0.5 text-sm leading-7 text-slate-700">{item}</p></div>)}</div>;
}

function PageLoading() {
  return <div dir="rtl" className="min-h-screen bg-[#f4f6f4] p-6"><div className="mx-auto max-w-7xl space-y-5"><Skeleton className="h-64 rounded-[34px]" /><div className="grid gap-4 md:grid-cols-3">{[1,2,3].map(item => <Skeleton key={item} className="h-32 rounded-3xl" />)}</div><Skeleton className="h-96 rounded-3xl" /></div></div>;
}

export default function ComoNextProjectPage() {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);
  const { user, loading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [showAllMemory, setShowAllMemory] = useState(false);
  const query = trpc.comoNext.getProjectExecutiveFile.useQuery({ projectId }, { enabled: isAuthenticated && Number.isInteger(projectId) && projectId > 0, retry: false });
  const data = query.data;
  const activeWorkFiles = useMemo(() => data?.workFiles.filter((file: any) => !["closed", "cancelled"].includes(file.workFileStatus)) ?? [], [data]);
  const archivedWorkFiles = useMemo(() => data?.workFiles.filter((file: any) => ["closed", "cancelled"].includes(file.workFileStatus)) ?? [], [data]);

  if (loading || query.isLoading) return <PageLoading />;
  if (!isAuthenticated || !user) return <div dir="rtl" className="flex min-h-screen items-center justify-center bg-[#f4f6f4] p-5"><Card className="w-full max-w-md rounded-3xl p-8 text-center"><LockKeyhole className="mx-auto h-8 w-8 text-slate-500" /><h1 className="mt-4 text-xl font-black">الملف التنفيذي للمشروع</h1><p className="mt-2 text-sm text-slate-500">سجل الدخول لقراءة ذاكرة المشروع وملفات عمله.</p><Button className="mt-6 w-full rounded-xl bg-slate-900 text-white" onClick={() => { window.location.href = getLoginUrl(); }}>تسجيل الدخول</Button></Card></div>;
  if (!Number.isInteger(projectId) || projectId <= 0 || query.isError || !data) return <div dir="rtl" className="flex min-h-screen items-center justify-center bg-[#f4f6f4] p-5"><Card className="w-full max-w-lg rounded-3xl p-8 text-center"><CircleAlert className="mx-auto h-8 w-8 text-rose-600" /><h1 className="mt-4 text-xl font-black">تعذر فتح ملف المشروع</h1><p className="mt-2 text-sm text-slate-500">{query.error?.message || "رقم المشروع غير صالح."}</p><Button variant="outline" className="mt-6 rounded-xl bg-white" onClick={() => navigate("/como-next?tab=work-files")}>العودة إلى المكتب التنفيذي</Button></Card></div>;

  const projectFacts = [
    { label: "رقم القطعة", value: data.project.plotNumber, icon: MapPinned },
    { label: "رقم سند الملكية", value: data.project.titleDeedNumber, icon: FileCheck2 },
    { label: "مرجع DDA", value: data.project.ddaNumber || data.project.masterDevRef, icon: Landmark },
    { label: "الاستخدام", value: data.project.permittedUse, icon: Building2 },
    { label: "مساحة الأرض", value: formatArea(data.project.plotAreaSqm, "م²") || formatArea(data.project.plotAreaSqft, "قدم²"), icon: MapPinned },
    { label: "المساحة الطابقية", value: formatArea(data.project.gfaSqm, "م²") || formatArea(data.project.gfaSqft, "قدم²"), icon: Building2 },
  ].filter(item => item.value);
  const visibleMemory = showAllMemory ? data.reviewedMemory : data.reviewedMemory.slice(0, 8);
  const sourceRegister = data.sourceRegister;

  const openWorkFile = (workFileId: number) => navigate(`/como-next?tab=work-files&workFileId=${workFileId}`);

  return <div dir="rtl" className="min-h-screen bg-[radial-gradient(circle_at_top_right,#fff8e9_0,#f8faf9_34%,#eef3f2_100%)] text-slate-900">
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/88 backdrop-blur-xl">
      <div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-7">
        <button type="button" onClick={() => navigate("/como-next?tab=work-files")} className="inline-flex items-center gap-2 text-sm font-bold text-slate-700"><ArrowLeft className="h-4 w-4" />المكتب التنفيذي</button>
        <div className="flex flex-wrap items-center gap-2"><Button variant="outline" onClick={() => navigate(`/project/${projectId}`)} className="rounded-xl bg-white text-xs">بطاقة المشروع الأصلية</Button><Button variant="outline" onClick={() => navigate(`/development-phases?projectId=${projectId}`)} className="rounded-xl bg-white text-xs"><Route className="ml-1 h-3.5 w-3.5" />جولة مراحل التطوير</Button><Button variant="outline" onClick={() => navigate("/bateekha")} className="rounded-xl bg-white text-xs">الدراسات المحمية</Button></div>
      </div>
    </header>

    <main className="mx-auto max-w-7xl px-4 py-7 sm:px-7 sm:py-10">
      <section className="relative overflow-hidden rounded-[36px] bg-[#122b35] text-white shadow-[0_30px_90px_rgba(15,36,45,.18)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(211,170,105,.26),transparent_32%),radial-gradient(circle_at_90%_10%,rgba(85,166,150,.20),transparent_36%)]" />
        <div className="relative grid gap-7 px-6 py-8 sm:px-10 lg:grid-cols-[1.15fr_.85fr] lg:px-12 lg:py-11">
          <div><div className="flex flex-wrap items-center gap-2"><Badge className="rounded-full border border-amber-300/25 bg-amber-300/10 text-amber-200 hover:bg-amber-300/10">الملف التنفيذي الموحد</Badge>{data.dossier ? <Badge className="rounded-full border border-emerald-300/25 bg-emerald-300/10 text-emerald-200 hover:bg-emerald-300/10"><ShieldCheck className="ml-1 h-3.5 w-3.5" />ذاكرة مراجعة بالدليل</Badge> : null}</div><h1 className="mt-5 text-3xl font-black leading-tight sm:text-5xl">{data.project.name}</h1><p className="mt-4 max-w-3xl text-sm leading-8 text-slate-300">{data.dossier?.executiveContext || data.project.description || "هذا هو السجل الموحد للمشروع. ستظهر ذاكرته التنفيذية بعد مراجعة مصادره وربطها بالدليل."}</p></div>
          <div className="self-end rounded-[28px] border border-white/10 bg-white/7 p-5 backdrop-blur"><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-300/15 text-amber-200"><BrainCircuit className="h-5 w-5" /></div><div><p className="text-sm font-black">سارة تقرأ هذا الملف</p><p className="mt-1 text-xs text-slate-300">وManus يرجع إلى الأدلة عند تكليفه.</p></div></div><div className="mt-4 border-t border-white/10 pt-4 text-xs leading-6 text-slate-300"><LockKeyhole className="ml-1.5 inline h-4 w-4 text-amber-200" />لا يحول العرض إلى تعيين، ولا المسودة إلى إرسال، ولا الفاتورة إلى سداد.</div></div>
        </div>
      </section>

      {projectFacts.length ? <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">{projectFacts.map(item => { const Icon = item.icon; return <Card key={item.label} className="rounded-2xl border-slate-200 bg-white/90 p-4 shadow-sm"><Icon className="h-4 w-4 text-[#1f6478]" /><p className="mt-3 text-[10px] font-bold text-slate-400">{item.label}</p><p className="mt-1 text-sm font-black text-slate-800">{item.value}</p></Card>; })}</section> : null}

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <Metric label="ملفات العمل" value={data.summary.workFiles} note={`${data.summary.activeWorkFiles} نشط`} icon={FileStack} tone="bg-slate-100 text-slate-700" />
        <Metric label="إجراءات مفتوحة" value={data.summary.openActions} note="تحتاج تنفيذًا أو دليلًا" icon={Clock3} tone="bg-amber-50 text-amber-700" />
        <Metric label="قرارات معلقة" value={data.summary.pendingDecisions} note="لا تنفذ قبل الحسم" icon={Scale} tone="bg-rose-50 text-rose-700" />
        <Metric label="مراسلات حديثة" value={data.summary.communications} note="آخر 12 في الملف" icon={Mail} tone="bg-sky-50 text-sky-700" />
        <Metric label="اجتماعات" value={data.summary.meetings} note="مرتبطة بملفات العمل" icon={CalendarDays} tone="bg-teal-50 text-teal-700" />
        <Metric label="ذاكرة مراجعة" value={data.summary.reviewedMemory} note="مرتبطة بمراجع الدليل" icon={BookOpenCheck} tone="bg-violet-50 text-violet-700" />
        <Metric label="أطراف نشطة" value={data.summary.activeParties} note="ضمن المشروع الحالي" icon={UsersRound} tone="bg-emerald-50 text-emerald-700" />
      </section>

      {data.dossier ? <section className="mt-7 grid gap-5 lg:grid-cols-[1.08fr_.92fr]">
        <Card className="rounded-[30px] border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eaf4f3] text-[#1f6478]"><BriefcaseBusiness className="h-5 w-5" /></div><div><p className="text-[10px] font-black text-[#1f6478]">الموضع التنفيذي الموثق</p><h2 className="mt-1 text-xl font-black">أين وصل المشروع فعليًا؟</h2></div></div><p className="mt-5 whitespace-pre-wrap text-sm leading-8 text-slate-700">{data.dossier.currentPosition}</p><p className="mt-5 border-t border-slate-100 pt-4 text-[10px] text-slate-400">آخر مراجعة: {formatDate(data.dossier.reviewedAt)}</p></Card>
        <Card className="rounded-[30px] border-amber-100 bg-[#fffdf7] p-6 shadow-sm"><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-800"><CircleAlert className="h-5 w-5" /></div><div><p className="text-[10px] font-black text-amber-800">لا نقفز فوق الدليل</p><h2 className="mt-1 text-xl font-black">ما يمنع الانتقال الآن؟</h2></div></div><div className="mt-5"><NumberedList items={data.dossier.dependencies} tone="amber" /></div></Card>
      </section> : null}

      {data.dossier ? <section className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card className="rounded-[30px] border-slate-200 bg-white p-6 shadow-sm"><div className="mb-5 flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700"><Link2 className="h-5 w-5" /></div><div><p className="text-[10px] font-black text-slate-500">المسار الذي قطعه المشروع</p><h2 className="text-lg font-black">دورة الحياة الموثقة</h2></div></div><NumberedList items={data.dossier.lifecyclePhases} /></Card>
        <Card className="rounded-[30px] border-teal-100 bg-[#f6fbfa] p-6 shadow-sm"><div className="mb-5 flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-100 text-teal-800"><Sparkles className="h-5 w-5" /></div><div><p className="text-[10px] font-black text-teal-700">موضوعات لا تزال مفتوحة</p><h2 className="text-lg font-black">ما الذي يستحق الانتباه لاحقًا؟</h2></div></div>{data.dossier.openThreads.length ? <NumberedList items={data.dossier.openThreads} tone="teal" /> : <p className="rounded-2xl bg-white p-4 text-sm text-slate-500">لا توجد موضوعات مفتوحة مثبتة في الذاكرة المراجعة.</p>}</Card>
      </section> : null}

      <ComoNextSpecialistDesks projectId={projectId} workFiles={data.workFiles} />

      <section className="mt-8">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-black text-[#216b66]">مصدر حقيقة واحد من دون نسخ السجلات</p>
            <h2 className="mt-1 text-2xl font-black">العقد والتسليم والتصميم ودورة المشروع</h2>
            <p className="mt-1 max-w-3xl text-sm leading-7 text-slate-500">هذه مرآة قراءة فقط لما هو مسجل في مصادر المشروع الحالية. لا تغيّر عقدًا أو موعدًا، ولا تنشئ إجراءً، ولا تعتبر «مقدم» مساويًا لـ«متحقق».</p>
          </div>
          <ReadOnlySourceBadge />
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          <Card className="rounded-[30px] border-sky-100 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-700"><FileSignature className="h-5 w-5" /></div><div><p className="text-[10px] font-black text-sky-700">السجل التعاقدي</p><h3 className="text-lg font-black">العقود وتسليماتها</h3></div></div>
              <Button variant="outline" size="sm" className="rounded-xl bg-white text-xs" onClick={() => navigate(`/contracts?projectId=${projectId}`)}>فتح المصدر <ExternalLink className="mr-1 h-3.5 w-3.5" /></Button>
            </div>
            <div className="mt-5 space-y-3">
              {sourceRegister.contracts.length ? sourceRegister.contracts.map((contract: any) => <div key={contract.id} className="rounded-2xl border border-slate-100 bg-[#fbfbf9] p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-black text-slate-900">{contract.title}</p><p className="mt-1 text-[10px] text-slate-500">{contract.contractTypeName || "نوع غير محدد"}{contract.contractNumber ? ` · ${contract.contractNumber}` : ""}</p></div><Badge variant="outline" className="rounded-full bg-white">{contractStatusLabels[contract.contractStatus] || contract.contractStatus}</Badge></div>{contract.partyA || contract.partyB ? <p className="mt-3 text-xs leading-6 text-slate-600">{[contract.partyA, contract.partyB].filter(Boolean).join(" ↔ ")}</p> : null}<div className="mt-3 flex flex-wrap gap-2 text-[10px] text-slate-500">{contract.startDate ? <span>البداية: {contract.startDate}</span> : null}{contract.endDate ? <span>النهاية: {contract.endDate}</span> : null}{contract.hasProtectedFile ? <span className="font-bold text-emerald-700">ملف مرفق</span> : <span>لا ملف مرفق</span>}</div></div>) : <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm text-slate-500">لا يوجد عقد مسجل لهذا المشروع في مصدر العقود.</div>}
            </div>
            <div className="mt-4 border-t border-slate-100 pt-4"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><ClipboardList className="h-4 w-4 text-emerald-700" /><p className="text-sm font-black">التسليمات والاستثناءات</p></div><Button variant="ghost" size="sm" className="h-8 text-xs text-[#216b66]" onClick={() => navigate(`/contract-deliverables?projectId=${projectId}`)}>فتح السجل</Button></div>{sourceRegister.deliverables.length ? <div className="mt-3 space-y-2">{sourceRegister.deliverables.slice(0, 5).map((item: any) => <div key={item.id} className="flex items-start justify-between gap-3 rounded-xl bg-slate-50 p-3"><div><p className="text-xs font-bold text-slate-800">{item.title}</p><p className="mt-1 text-[10px] text-slate-500">{item.contractTitle}{item.dueDate ? ` · ${item.dueDate}` : ""}</p></div><Badge variant="outline" className={item.isException ? "rounded-full border-rose-200 bg-rose-50 text-rose-700" : "rounded-full bg-white"}>{item.isOverdue ? "متأخر بحسب التاريخ" : item.status}</Badge></div>)}</div> : <p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-500">لا توجد تسليمات مسجلة؛ لا يفترض النظام وجودها.</p>}</div>
          </Card>

          <Card className="rounded-[30px] border-violet-100 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-50 text-violet-700"><DraftingCompass className="h-5 w-5" /></div><div><p className="text-[10px] font-black text-violet-700">التعيين والتصميم</p><h3 className="text-lg font-black">نطاق الاستشاري والتصاريح</h3></div></div><Button variant="outline" size="sm" className="rounded-xl bg-white text-xs" onClick={() => navigate(`/consultant-appointment-pack?projectId=${projectId}`)}>فتح المصدر <ExternalLink className="mr-1 h-3.5 w-3.5" /></Button></div>
            {sourceRegister.consultantScope.currentRequirementSet ? <div className="mt-5 rounded-2xl border border-violet-100 bg-[#fbfaff] p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-black text-slate-900">{sourceRegister.consultantScope.currentRequirementSet.title}</p><p className="mt-1 text-[10px] text-slate-500">المراجعة {sourceRegister.consultantScope.currentRequirementSet.revisionNo} · {sourceRegister.consultantScope.currentRequirementSet.itemCount} بندًا · {sourceRegister.consultantScope.currentRequirementSet.requiredCount} مطلوبًا</p></div><Badge variant="outline" className={sourceRegister.consultantScope.currentRequirementSet.status === "APPROVED" ? "rounded-full border-emerald-200 bg-emerald-50 text-emerald-700" : "rounded-full border-amber-200 bg-amber-50 text-amber-800"}>{sourceRegister.consultantScope.currentRequirementSet.status === "APPROVED" ? "معتمد" : "مسودة في المصدر"}</Badge></div><div className="mt-3 flex flex-wrap gap-2">{sourceRegister.consultantScope.currentRequirementSet.workstreams.map((stream: any) => <span key={stream.workstream} className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-slate-600">{stream.workstream}: {stream.itemCount}</span>)}</div><p className="mt-3 text-[10px] text-slate-500">مسودات طلب العروض الداخلية: {sourceRegister.consultantScope.rfpDrafts.length} · لا إرسال تلقائي.</p></div> : <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm text-slate-500">لا توجد قائمة نطاق مسجلة لهذا المشروع.</div>}
            <div className="mt-4 border-t border-slate-100 pt-4"><div className="flex items-center gap-2"><FileCheck2 className="h-4 w-4 text-violet-700" /><p className="text-sm font-black">التصميم والتصاريح</p></div>{sourceRegister.permits ? <div className="mt-3 grid gap-2 sm:grid-cols-2">{[["المعماري", sourceRegister.permits.architecturalDesignStatus], ["الهندسي", sourceRegister.permits.engineeringDesignStatus], ["رخصة البناء", sourceRegister.permits.buildingPermitStatus], ["اعتماد البلدية", sourceRegister.permits.municipalityDesignApprovalStatus]].map(([label, value]) => <div key={label as string} className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-bold text-slate-400">{label}</p><p className="mt-1 text-xs font-black text-slate-700">{value || "غير مسجل"}</p></div>)}</div> : <p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-500">لا يوجد سجل تصميم وتصاريح لهذا المشروع؛ لم تُختلق حالة بديلة.</p>}</div>
          </Card>

          <Card className="rounded-[30px] border-emerald-100 bg-white p-6 shadow-sm xl:col-span-2">
            <div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700"><Route className="h-5 w-5" /></div><div><p className="text-[10px] font-black text-emerald-700">الدورة والامتثال والبرنامج</p><h3 className="text-lg font-black">موضع المشروع في السجل التشغيلي</h3></div></div><Button variant="outline" size="sm" className="rounded-xl bg-white text-xs" onClick={() => navigate(sourceRegister.lifecycle.sourcePath)}>فتح الجدول <ExternalLink className="mr-1 h-3.5 w-3.5" /></Button></div>
            {sourceRegister.lifecycle.services.length ? <div className="mt-5 grid gap-4 lg:grid-cols-[.9fr_1.1fr]"><div className="space-y-3"><div className="rounded-2xl border border-emerald-100 bg-[#f6fbfa] p-4"><p className="text-[10px] font-black text-emerald-700">المرحلة الحالية بحسب المصدر</p><p className="mt-2 text-lg font-black text-slate-900">{sourceRegister.lifecycle.currentStage?.stageName || sourceRegister.lifecycle.currentStage?.stageCode || "غير محددة"}</p><p className="mt-2 text-xs text-slate-500">{sourceRegister.lifecycle.services.length} خدمة مسجلة · {sourceRegister.lifecycle.documentSummary.reduce((sum: number, item: any) => sum + item.documentCount, 0)} مستندات مرحلة</p></div><div className="grid gap-2 sm:grid-cols-2">{sourceRegister.lifecycle.stages.map((stage: any) => <div key={stage.stageCode} className="rounded-xl border border-slate-100 bg-slate-50 p-3"><div className="flex items-center justify-between gap-2"><p className="text-xs font-bold text-slate-800">{stage.stageName || stage.stageCode}</p><span className="text-[10px] text-slate-500">{stage.completedCount}/{stage.serviceCount}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${stage.serviceCount ? Math.round((stage.completedCount / stage.serviceCount) * 100) : 0}%` }} /></div></div>)}</div></div><div><div className="mb-3 flex items-center justify-between gap-2"><div className="flex items-center gap-2"><TimerReset className="h-4 w-4 text-amber-700" /><p className="text-sm font-black">استثناءات تحتاج انتباهًا</p></div><Badge variant="outline" className="rounded-full bg-white">{sourceRegister.lifecycle.scheduleExceptions.length}</Badge></div><div className="space-y-2">{sourceRegister.lifecycle.scheduleExceptions.length ? sourceRegister.lifecycle.scheduleExceptions.slice(0, 8).map((service: any) => <div key={service.id} className="rounded-xl border border-slate-100 bg-[#fbfbf9] p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-xs font-bold text-slate-800">{service.serviceName || service.serviceCode}</p><p className="mt-1 text-[10px] text-slate-500">{service.plannedDueDate ? `الاستحقاق المسجل: ${service.plannedDueDate}` : "لا تاريخ استحقاق"}{service.externalParty ? ` · ${service.externalParty}` : ""}</p></div><Badge variant="outline" className={service.isOverdue ? "rounded-full border-rose-200 bg-rose-50 text-rose-700" : "rounded-full border-amber-200 bg-amber-50 text-amber-800"}>{service.isOverdue ? "متأخر بحسب التاريخ" : lifecycleStatusLabels[service.operationalStatus] || service.operationalStatus}</Badge></div>{service.mandatoryGapCount ? <p className="mt-2 text-[10px] font-bold text-rose-700">{service.mandatoryGapCount} متطلب إلزامي غير مكتمل في المصدر</p> : null}</div>) : <div className="rounded-xl bg-slate-50 p-4 text-center text-xs text-slate-500">لا توجد استثناءات مسجلة.</div>}</div></div></div> : <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm text-slate-500">لا توجد خدمات دورة حياة مسجلة لهذا المشروع؛ الملف لا يفترض مرحلة من تلقاء نفسه.</div>}
          </Card>
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><p className="text-[11px] font-black text-[#1f6478]">غرف العمل داخل المشروع</p><h2 className="mt-1 text-2xl font-black">ملفات العمل النشطة</h2><p className="mt-1 text-sm text-slate-500">كل موضوع يحتفظ بسؤاله وقراراته وإجراءاته ومراسلاته واجتماعاته، لكنه يبقى جزءًا من هذا المشروع.</p></div><Badge variant="outline" className="rounded-full bg-white"><bdi>{activeWorkFiles.length}</bdi> نشط</Badge></div>
        {activeWorkFiles.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{activeWorkFiles.map((file: any) => { const status = workFileStatus[file.workFileStatus] || workFileStatus.draft; return <button key={file.id} type="button" onClick={() => openWorkFile(file.id)} className="group rounded-[26px] border border-slate-200 bg-white p-5 text-right shadow-sm transition hover:-translate-y-1 hover:border-[#8fb7c2] hover:shadow-xl"><div className="flex items-start justify-between gap-3"><div><Badge variant="outline" className={`rounded-full ${status.className}`}>{status.label}</Badge><h3 className="mt-3 text-base font-black leading-7 text-slate-900">{file.title}</h3></div><ChevronLeft className="mt-2 h-5 w-5 text-[#1f6478] transition group-hover:-translate-x-1" /></div><p className="mt-3 line-clamp-2 text-xs leading-6 text-slate-500">{file.governingQuestion}</p><div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-4 text-center text-[10px] text-slate-500"><span><b className="block text-sm text-slate-900">{file.openActionCount}</b>إجراء</span><span><b className="block text-sm text-slate-900">{file.pendingDecisionCount}</b>قرار</span><span><b className="block text-sm text-slate-900">{file.memoryCount}</b>ذاكرة</span></div>{file.nextActionTitle ? <p className="mt-4 rounded-xl bg-[#f6f8f7] px-3 py-2 text-[11px] font-bold leading-5 text-slate-700">التالي: {file.nextActionTitle}</p> : null}</button>; })}</div> : <Card className="rounded-3xl border-dashed border-slate-300 bg-white/70 p-7 text-center text-sm text-slate-500">لا توجد ملفات عمل نشطة في هذا المشروع.</Card>}
      </section>

      {data.decisions.length ? <section className="mt-8"><div className="mb-4"><p className="text-[11px] font-black text-rose-700">سلطة القرار</p><h2 className="mt-1 text-2xl font-black">سجل القرارات</h2></div><div className="grid gap-4 lg:grid-cols-2">{data.decisions.map((decision: any) => <button key={decision.id} type="button" onClick={() => openWorkFile(decision.workFileId)} className="rounded-[26px] border border-rose-100 bg-white p-5 text-right shadow-sm transition hover:border-rose-200"><div className="flex flex-wrap items-center justify-between gap-2"><Badge variant="outline" className={decision.decisionStatus === "required" ? "rounded-full border-rose-200 bg-rose-50 text-rose-700" : "rounded-full border-slate-200 bg-slate-50 text-slate-600"}>{decision.decisionStatus === "required" ? "مطلوب الحسم" : decision.decisionStatus === "deferred" ? "مؤجل" : "مسجل"}</Badge><span className="text-[10px] text-slate-400">{decision.workFileTitle}</span></div><h3 className="mt-3 font-black leading-7 text-slate-900">{decision.title}</h3><p className="mt-2 text-xs leading-6 text-slate-600">{decision.question}</p></button>)}</div></section> : null}

      <section className="mt-8 grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
        <Card className="rounded-[30px] border-violet-100 bg-white p-6 shadow-sm"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-50 text-violet-700"><BookOpenCheck className="h-5 w-5" /></div><div><p className="text-[10px] font-black text-violet-700">مستخرجة من الملفات القديمة ومراجعة بالدليل</p><h2 className="text-xl font-black">ذاكرة المشروع</h2></div></div><Badge variant="outline" className="rounded-full bg-white">{data.reviewedMemory.length}</Badge></div>
          <div className="mt-5 space-y-3">{visibleMemory.length ? visibleMemory.map((entry: any) => <Card key={entry.id} className="rounded-2xl border-slate-200 bg-[#fbfbf9] p-4 shadow-none"><div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className="rounded-full border-violet-100 bg-white text-violet-700">{entry.entryType === "fact" ? "حقيقة وثائقية" : entry.entryType === "constraint" ? "قيد" : entry.entryType === "relationship" ? "علاقة" : "سياق"}</Badge><Badge variant="outline" className="rounded-full border-emerald-100 bg-white text-emerald-700">ثقة {entry.confidence === "high" ? "عالية" : "متوسطة"}</Badge><span className="text-[10px] text-slate-400">{entry.workFileTitle}</span></div><h3 className="mt-3 font-black leading-7 text-slate-900">{entry.title}</h3><p className="mt-2 whitespace-pre-wrap text-xs leading-7 text-slate-600">{entry.body}</p>{entry.evidenceRefs.length ? <details className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2"><summary className="cursor-pointer text-[11px] font-bold text-[#1f6478]">مراجع الإثبات ({entry.evidenceRefs.length})</summary><ul className="mt-2 space-y-1.5 text-[10px] leading-5 text-slate-500">{entry.evidenceRefs.map((ref: string) => <li key={ref} className="break-words">• {ref}</li>)}</ul></details> : null}</Card>) : <p className="rounded-2xl bg-slate-50 p-5 text-center text-sm text-slate-500">لم تُضف ذاكرة مراجعة لهذا المشروع بعد.</p>}</div>
          {data.reviewedMemory.length > 8 ? <Button variant="outline" onClick={() => setShowAllMemory(value => !value)} className="mt-4 w-full rounded-xl bg-white">{showAllMemory ? "عرض المختصر" : `عرض كل الذاكرة المراجعة (${data.reviewedMemory.length})`}</Button> : null}
        </Card>

        <div className="space-y-5"><Card className="rounded-[30px] border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700"><UsersRound className="h-5 w-5" /></div><div><p className="text-[10px] font-black text-emerald-700">شبكة المشروع</p><h2 className="text-lg font-black">الأطراف</h2></div></div><div className="mt-4 space-y-2">{data.parties.map((party: any) => <div key={party.id} className="rounded-2xl border border-slate-100 bg-[#fbfbf9] p-3"><div className="flex items-center justify-between gap-2"><p className="text-sm font-bold text-slate-800">{party.displayName}</p><Badge variant="outline" className={party.relationshipStatus === "active" ? "rounded-full border-emerald-100 bg-emerald-50 text-emerald-700" : "rounded-full border-slate-200 bg-slate-100 text-slate-500"}>{party.relationshipStatus === "active" ? "نشط" : "غير نشط"}</Badge></div><p className="mt-1 text-[10px] text-slate-500">{party.roleCode}{party.primaryContactName ? ` · ${party.primaryContactName}` : ""}</p></div>)}</div></Card>
          {archivedWorkFiles.length ? <Card className="rounded-[30px] border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-slate-500" /><div><p className="text-[10px] font-black text-slate-500">لا تعاد كمتابعة</p><h2 className="text-lg font-black">ملفات مؤرشفة أو مغلقة</h2></div></div><div className="mt-4 space-y-2">{archivedWorkFiles.map((file: any) => <button key={file.id} type="button" onClick={() => openWorkFile(file.id)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-right"><span className="text-xs font-semibold text-slate-600">{file.title}</span><ChevronLeft className="h-4 w-4 text-slate-400" /></button>)}</div></Card> : null}
        </div>
      </section>

      <section className="mt-8 grid gap-5 pb-10 lg:grid-cols-2">
        <Card className="rounded-[30px] border-sky-100 bg-white p-6 shadow-sm"><div className="flex items-center gap-3"><Mail className="h-5 w-5 text-sky-700" /><div><p className="text-[10px] font-black text-sky-700">التواصل في سياقه</p><h2 className="text-lg font-black">أحدث المراسلات</h2></div></div><div className="mt-4 space-y-2">{data.communications.length ? data.communications.slice(0, 6).map((item: any) => <button key={item.id} type="button" onClick={() => openWorkFile(item.workFileId)} className="w-full rounded-2xl border border-slate-100 bg-[#fbfbf9] p-3 text-right"><div className="flex items-center justify-between gap-2"><p className="line-clamp-1 text-sm font-bold text-slate-800">{item.subject}</p><span className="text-[10px] text-slate-400">{formatDate(item.occurredAt)}</span></div><p className="mt-1 text-[10px] text-slate-500">{item.direction === "inbound" ? "وارد" : "صادر/مسودة"} · {item.workFileTitle}</p></button>) : <p className="rounded-2xl bg-slate-50 p-4 text-center text-sm text-slate-500">لا توجد مراسلات مرتبطة.</p>}</div></Card>
        <Card className="rounded-[30px] border-teal-100 bg-white p-6 shadow-sm"><div className="flex items-center gap-3"><CalendarDays className="h-5 w-5 text-teal-700" /><div><p className="text-[10px] font-black text-teal-700">اجتماعات مرتبطة بالملف</p><h2 className="text-lg font-black">سجل الاجتماعات</h2></div></div><div className="mt-4 space-y-2">{data.meetings.length ? data.meetings.map((item: any) => <button key={item.id} type="button" onClick={() => openWorkFile(item.workFileId)} className="w-full rounded-2xl border border-slate-100 bg-[#fbfbf9] p-3 text-right"><div className="flex items-center justify-between gap-2"><p className="line-clamp-1 text-sm font-bold text-slate-800">{item.title}</p><span className="text-[10px] text-slate-400">{formatDate(item.startsAt)}</span></div><p className="mt-1 text-[10px] text-slate-500">{item.workFileTitle}</p></button>) : <p className="rounded-2xl bg-slate-50 p-4 text-center text-sm text-slate-500">لا توجد اجتماعات مرتبطة.</p>}</div></Card>
      </section>
    </main>
  </div>;
}
