import { useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  BarChart3,
  BookOpenCheck,
  BriefcaseBusiness,
  Building2,
  ChevronLeft,
  CircleAlert,
  FilePlus2,
  Landmark,
  LayoutDashboard,
  LockKeyhole,
  MapPinned,
  Route,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { ProjectSelector } from "@/components/ProjectSelector";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useProjectContext } from "@/contexts/ProjectContext";
import { trpc } from "@/lib/trpc";

const MANAGEMENT_CARDS = [
  {
    id: "executive-file",
    title: "ملف المشروع التنفيذي",
    description: "هوية المشروع ووثائقه وذاكرته وملفات العمل والقرارات والمراسلات والاجتماعات في سياق واحد.",
    icon: BriefcaseBusiness,
    tone: "from-[#153b48] to-[#266679]",
    accent: "text-[#1f6478]",
    href: (projectId: number) => `/como-next/projects/${projectId}`,
  },
  {
    id: "feasibility",
    title: "دراسة الجدوى",
    description: "الدراسة المالية المحمية للمشروع المختار، من دون إعادة كتابة المعادلات أو نسخ بياناتها.",
    icon: BarChart3,
    tone: "from-[#365c4a] to-[#648773]",
    accent: "text-[#4b7059]",
    href: (projectId: number) => `/bateekha?projectId=${projectId}&tab=feasibility&returnTo=${encodeURIComponent(`/project-management?projectId=${projectId}`)}`,
  },
  {
    id: "cash-flow",
    title: "التدفقات النقدية وحساب الضمان",
    description: "كل بطاقات التدفق المعتمدة للمشروع نفسه، ومنها تدفق المستثمر والإسكرو، داخل المحرك القائم.",
    icon: WalletCards,
    tone: "from-[#5c4938] to-[#9a724f]",
    accent: "text-[#815f45]",
    href: (projectId: number) => `/bateekha?projectId=${projectId}&returnTo=${encodeURIComponent(`/project-management?projectId=${projectId}`)}`,
  },
  {
    id: "development-tour",
    title: "جولة مراحل التطوير",
    description: "بوابة التأسيس والامتثال والجدول والعقود، مرتبطة بالمشروع المختار بدل التنقل بين صفحات بلا سياق.",
    icon: Route,
    tone: "from-[#56406f] to-[#8963a8]",
    accent: "text-[#6d4c88]",
    href: (projectId: number) => `/development-phases?projectId=${projectId}`,
  },
] as const;

function formatArea(value: unknown, unit: string) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return "—";
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(number)} ${unit}`;
}

function ProjectFact({ label, value, icon: Icon }: { label: string; value: string | null | undefined; icon: typeof Building2 }) {
  return <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm">
    <Icon className="h-4 w-4 text-[#1f6478]" />
    <p className="mt-3 text-[10px] font-bold text-slate-400">{label}</p>
    <p className="mt-1 min-h-5 text-sm font-black text-slate-800">{value || "—"}</p>
  </div>;
}

export default function ProjectManagementPage() {
  const { user, loading, isAuthenticated } = useAuth();
  const { selectedProjectId, setSelectedProjectId } = useProjectContext();
  const [, navigate] = useLocation();

  const requestedProjectId = useMemo(() => {
    const value = Number(new URLSearchParams(window.location.search).get("projectId"));
    return Number.isInteger(value) && value > 0 ? value : null;
  }, []);

  useEffect(() => {
    if (requestedProjectId && requestedProjectId !== selectedProjectId) {
      setSelectedProjectId(requestedProjectId);
    }
  }, [requestedProjectId, selectedProjectId, setSelectedProjectId]);

  const projectQuery = trpc.projects.getById.useQuery(selectedProjectId!, {
    enabled: isAuthenticated && !!selectedProjectId,
    retry: false,
  });
  const foundationQuery = trpc.projectLaunchGate.get.useQuery(
    { projectId: selectedProjectId! },
    { enabled: isAuthenticated && !!selectedProjectId, retry: false },
  );

  const selectProject = (projectId: number) => {
    setSelectedProjectId(projectId);
    navigate(`/project-management?projectId=${projectId}`);
  };

  if (loading) return <div className="min-h-screen bg-[#f4f6f4] p-6" dir="rtl"><div className="mx-auto max-w-7xl space-y-5"><Skeleton className="h-16 rounded-2xl" /><Skeleton className="h-72 rounded-[36px]" /></div></div>;

  if (!isAuthenticated || !user) {
    return <div className="flex min-h-screen items-center justify-center bg-[#f4f6f4] p-5" dir="rtl"><Card className="w-full max-w-md rounded-[30px] p-8 text-center"><LockKeyhole className="mx-auto h-8 w-8 text-slate-500" /><h1 className="mt-4 text-xl font-black">إدارة المشاريع</h1><p className="mt-2 text-sm leading-7 text-slate-500">سجل الدخول للوصول إلى المشاريع الرسمية ومساراتها المحمية.</p><Button className="mt-6 w-full rounded-xl bg-slate-900 text-white" onClick={() => { window.location.href = getLoginUrl(); }}>تسجيل الدخول</Button></Card></div>;
  }

  const project = projectQuery.data as any;
  const foundation = foundationQuery.data as any;

  return <div className="min-h-screen min-w-0 max-w-full overflow-x-hidden bg-[radial-gradient(circle_at_top_right,#fff8e9_0,#f8faf9_34%,#edf3f2_100%)] text-slate-900" dir="rtl">
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/88 backdrop-blur-xl">
      <div className="mx-auto flex min-h-16 max-w-7xl flex-col items-stretch gap-2 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3 sm:px-7">
        <button type="button" onClick={() => navigate("/")} className="inline-flex items-center gap-2 text-sm font-bold text-slate-700"><ArrowLeft className="h-4 w-4" />الرئيسية</button>
        <div className="grid min-w-0 grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center"><Badge variant="outline" className="min-w-0 justify-center rounded-full border-emerald-200 bg-emerald-50 px-2 text-[10px] text-emerald-700 sm:text-xs"><ShieldCheck className="ml-1 h-3.5 w-3.5 shrink-0" />مصدر واحد للمشروع</Badge><Button variant="outline" onClick={() => navigate("/como-next/project-opening")} className="min-w-0 rounded-xl bg-white px-2 text-[10px] sm:px-3 sm:text-xs"><FilePlus2 className="ml-1 h-3.5 w-3.5 shrink-0" />فتح مشروع جديد</Button></div>
      </div>
    </header>

    <main className="mx-auto max-w-7xl px-4 py-7 sm:px-7 sm:py-10">
      <section className="rounded-[28px] bg-[#102b35] p-5 text-white shadow-[0_20px_60px_rgba(15,36,45,.16)] sm:p-7"><p className="mb-3 text-xs font-black text-amber-200">المشروع النشط</p><div className="rounded-2xl bg-white p-2 text-slate-900"><ProjectSelector selectedId={selectedProjectId} onSelect={selectProject} className="w-full justify-between" /></div></section>

      {!selectedProjectId ? <Card className="mt-6 rounded-[30px] border-dashed border-slate-300 bg-white/75 p-9 text-center"><LayoutDashboard className="mx-auto h-9 w-9 text-slate-400" /><h2 className="mt-4 text-xl font-black text-slate-900">اختر مشروعًا للبدء</h2><p className="mt-2 text-sm leading-7 text-slate-500">بعد الاختيار ستظهر بيانات الأرض والمساحات، ثم البطاقات الأربع الخاصة بالمشروع نفسه.</p></Card> : projectQuery.isLoading ? <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[1,2,3,4].map(item => <Skeleton key={item} className="h-48 rounded-[28px]" />)}</div> : projectQuery.isError || !project ? <Card className="mt-6 rounded-[30px] border-rose-200 bg-rose-50 p-8 text-center"><CircleAlert className="mx-auto h-8 w-8 text-rose-600" /><h2 className="mt-4 text-xl font-black text-rose-950">تعذر فتح المشروع المختار</h2><p className="mt-2 text-sm text-rose-700">{projectQuery.error?.message || "لا تتوفر صلاحية المشروع."}</p></Card> : <>
        <section className="mt-6 overflow-hidden rounded-[30px] border border-slate-200 bg-white/90 shadow-sm">
						<div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <p className="text-[11px] font-black text-[#1f6478]">بطاقة التعريف الحالية</p>
                <h2 className="mt-2 text-2xl font-black text-slate-950">{project.name}</h2>
                <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-500">{project.description || "المشروع الرسمي المختار. البيانات أدناه تُقرأ من بطاقة المشروع الحالية."}</p>
                {foundation?.marketDecision ? <button type="button" onClick={() => navigate(`/knowledge-analysis?projectId=${selectedProjectId}`)} className={`mt-4 flex w-full max-w-2xl flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-right ${foundation.marketDecision.isValid ? "border-emerald-200 bg-emerald-50" : foundation.marketDecision.status === "needs_reapproval" || foundation.marketDecision.status === "incompatible_verified_evidence" ? "border-rose-200 bg-rose-50" : "border-amber-200 bg-amber-50"}`}><span><span className="block text-[10px] font-black text-slate-500">قرار السوق والاستثمار · قراءة فقط</span><span className="mt-1 block text-sm font-black text-slate-900">{foundation.marketDecision.isValid ? `قرار ساري #${foundation.marketDecision.decisionId}` : foundation.marketDecision.status === "needs_reapproval" ? "يتطلب إعادة اعتماد" : "غير جاهز"}</span><span className="mt-1 block text-[11px] leading-5 text-slate-600">{foundation.marketDecision.reason}</span></span><ChevronLeft className="h-4 w-4 shrink-0 text-slate-500" /></button> : null}
                {foundation?.program ? <button type="button" onClick={() => navigate(`/development-phases?projectId=${selectedProjectId}`)} className={`mt-3 flex w-full max-w-2xl flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-right ${foundation.program.isValid ? "border-emerald-200 bg-emerald-50" : foundation.program.status === "needs_reapproval" || foundation.program.status === "invalid_program" ? "border-rose-200 bg-rose-50" : "border-amber-200 bg-amber-50"}`}><span><span className="block text-[10px] font-black text-slate-500">البرنامج الأولي للمشروع · قراءة فقط</span><span className="mt-1 block text-sm font-black text-slate-900">{foundation.program.isValid ? `برنامج ساري #${foundation.program.decisionId}` : foundation.program.status === "needs_reapproval" ? "يتطلب إعادة اعتماد" : foundation.program.status === "no_approved_program" ? "بانتظار الاعتماد" : "غير مكتمل"}</span><span className="mt-1 block text-[11px] leading-5 text-slate-600">{foundation.program.reason}</span></span><ChevronLeft className="h-4 w-4 shrink-0 text-slate-500" /></button> : null}
              </div>
              {foundation ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-left"><p className="text-[10px] font-black text-amber-800">محطة التأسيس</p><p className="mt-1 text-sm font-black text-slate-900"><bdi>{foundation.completeGateCount}</bdi> / <bdi>{foundation.totalGateCount}</bdi> مكتملة</p></div> : null}
            </div>
          <div className="grid gap-3 border-t border-slate-100 bg-[#fbfcfb] p-5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6"><ProjectFact label="رقم القطعة" value={project.plotNumber} icon={MapPinned} /><ProjectFact label="سند الملكية" value={project.titleDeedNumber} icon={BookOpenCheck} /><ProjectFact label="مرجع DDA" value={project.ddaNumber || project.masterDevRef} icon={Landmark} /><ProjectFact label="الاستخدام" value={project.permittedUse} icon={Building2} /><ProjectFact label="مساحة الأرض" value={formatArea(project.plotAreaSqm, "م²")} icon={MapPinned} /><ProjectFact label="المساحة الطابقية" value={formatArea(project.gfaSqm, "م²")} icon={Building2} /></div>
        </section>

        <section className="mt-7"><h2 className="mb-4 text-xl font-black text-slate-950">مسارات المشروع</h2><div className="space-y-2">{MANAGEMENT_CARDS.map(item => { const Icon = item.icon; return <button key={item.id} type="button" onClick={() => navigate(item.href(selectedProjectId))} className="group flex min-h-16 w-full items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-right shadow-sm transition hover:border-[#8fb7c2] hover:shadow-md"><span className="flex min-w-0 items-center gap-3"><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${item.tone} text-white`}><Icon className="h-5 w-5" /></span><span className="font-black text-slate-950">{item.title}</span></span><ChevronLeft className={`h-5 w-5 shrink-0 ${item.accent}`} /></button>; })}</div></section>

        {foundation ? <section className="mt-6 rounded-[28px] border border-amber-200 bg-[#fffaf0] p-5 sm:p-6"><p className="text-[10px] font-black text-amber-800">القرار التالي بحسب مصادر المشروع</p><div className="mt-2 flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-lg font-black leading-8 text-slate-950">{foundation.nextDecision}</h2><p className="mt-1 text-xs text-slate-600">اقتراح مسار فقط؛ لا يتحول إلى تنفيذ أو التزام تلقائي.</p></div><Button variant="outline" className="rounded-xl bg-white" onClick={() => navigate(`/project-launch/${selectedProjectId}`)}>عرض أساس المشروع <ChevronLeft className="mr-2 h-4 w-4" /></Button></div></section> : null}
      </>}
    </main>
  </div>;
}
