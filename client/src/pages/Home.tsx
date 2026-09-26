import { useAuth } from "@/_core/hooks/useAuth";
import { useCCAuth } from "@/contexts/CCAuthContext";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { default as ArrowLeft } from "lucide-react/dist/esm/icons/arrow-left.js";
import { default as BookOpen } from "lucide-react/dist/esm/icons/book-open.js";
import { default as BrainCircuit } from "lucide-react/dist/esm/icons/brain-circuit.js";
import { default as BriefcaseBusiness } from "lucide-react/dist/esm/icons/briefcase-business.js";
import { default as Building2 } from "lucide-react/dist/esm/icons/building-2.js";
import { default as CalendarCheck } from "lucide-react/dist/esm/icons/calendar-check.js";
import { default as ChevronLeft } from "lucide-react/dist/esm/icons/chevron-left.js";
import { default as CircleAlert } from "lucide-react/dist/esm/icons/circle-alert.js";
import { default as FileClock } from "lucide-react/dist/esm/icons/file-clock.js";
import { default as FolderOpen } from "lucide-react/dist/esm/icons/folder-open.js";
import { default as Inbox } from "lucide-react/dist/esm/icons/inbox.js";
import { default as Layers } from "lucide-react/dist/esm/icons/layers.js";
import { default as Loader2 } from "lucide-react/dist/esm/icons/loader-circle.js";
import { default as LockKeyhole } from "lucide-react/dist/esm/icons/lock-keyhole.js";
import { default as MessageSquare } from "lucide-react/dist/esm/icons/message-square.js";
import { default as Route } from "lucide-react/dist/esm/icons/route.js";
import { default as ShieldCheck } from "lucide-react/dist/esm/icons/shield-check.js";
import { default as Sparkles } from "lucide-react/dist/esm/icons/sparkles.js";

const SARA_AVATAR_URL = "/sara/sara-approved-5256847d.webp";

type ExecutiveDestination = {
  id: string;
  title: string;
  eyebrow: string;
  description: string;
  path: string;
  icon: typeof BriefcaseBusiness;
  tone: string;
  accent: string;
};

const EXECUTIVE_DESTINATIONS: ExecutiveDestination[] = [
  {
    id: "executive-office",
    title: "المكتب التنفيذي",
    eyebrow: "مصدر الحقيقة التشغيلي",
    description: "ملفات العمل، القرارات، الإجراءات، الاجتماعات والمراسلات في سياق واحد.",
    path: "/como-next",
    icon: BriefcaseBusiness,
    tone: "from-[#173d4b] to-[#256378]",
    accent: "text-[#1f6478]",
  },
  {
    id: "financial-studies",
    title: "الدراسات والتخطيط المالي",
    eyebrow: "محركات محمية",
    description: "دراسات الجدوى والتدفقات والمبيعات والضمان كما تم اعتمادها، بلا تعديل تلقائي.",
    path: "/bateekha",
    icon: Layers,
    tone: "from-[#3f5e4e] to-[#63876f]",
    accent: "text-[#4c705a]",
  },
  {
    id: "consultants",
    title: "مساحة الاستشاريين",
    eyebrow: "نطاق وعروض وتقييم",
    description: "مسار خاص للاستشاريين من نطاق المشروع حتى التحليل والتوصية والتكليف.",
    path: "/consultant-portal",
    icon: Building2,
    tone: "from-[#6b4d38] to-[#9a7150]",
    accent: "text-[#825e44]",
  },
  {
    id: "knowledge",
    title: "المعرفة والتحليل",
    eyebrow: "ذاكرة العمل",
    description: "المراجع والتقارير والدروس التي يحتاجها Manus عندما يُكلّف بالتحليل.",
    path: "/knowledge-analysis",
    icon: BookOpen,
    tone: "from-[#4d456e] to-[#756a9d]",
    accent: "text-[#635b88]",
  },
  {
    id: "development-tour",
    title: "جولة مراحل التطوير",
    eyebrow: "المسار المحمي للمشروع",
    description: "بوابة الانطلاق والامتثال والجدول والعقود؛ أربع زوايا محفوظة حول ملف مشروع واحد.",
    path: "/development-phases",
    icon: Route,
    tone: "from-[#5b3f75] to-[#8a63a7]",
    accent: "text-[#6d4b88]",
  },
];

function MetricCard({
  label,
  value,
  note,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  note: string;
  icon: typeof CircleAlert;
  tone: string;
}) {
  return (
    <div className="rounded-[22px] border border-slate-200/80 bg-white/90 p-4 shadow-[0_14px_36px_rgba(15,23,42,0.05)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-black tracking-tight text-slate-900">{value}</p>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${tone}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-3 text-[11px] leading-5 text-slate-500">{note}</p>
    </div>
  );
}

function DestinationCard({ item, onOpen }: { item: ExecutiveDestination; onOpen: (path: string) => void }) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={() => onOpen(item.path)}
      className="group relative overflow-hidden rounded-[26px] border border-slate-200/80 bg-white p-5 text-right shadow-[0_16px_40px_rgba(15,23,42,0.05)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_24px_55px_rgba(15,23,42,0.10)] active:scale-[0.98]"
    >
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-l ${item.tone}`} />
      <div className="flex items-start justify-between gap-4">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${item.tone} text-white shadow-lg`}>
          <Icon className="h-6 w-6" />
        </div>
        <ChevronLeft className={`mt-2 h-5 w-5 transition-transform duration-200 group-hover:-translate-x-1 ${item.accent}`} />
      </div>
      <p className={`mt-5 text-[10px] font-black tracking-wide ${item.accent}`}>{item.eyebrow}</p>
      <h3 className="mt-1 text-lg font-black text-slate-900">{item.title}</h3>
      <p className="mt-2 text-xs leading-6 text-slate-500">{item.description}</p>
    </button>
  );
}

function PublicHome() {
  const [, navigate] = useLocation();
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,#fff8e9_0,#ffffff_42%,#f5f7f8_100%)]" dir="rtl">
      <header className="border-b border-slate-200/70 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg"><Building2 className="h-5 w-5" /></div>
            <div><p className="text-sm font-black text-slate-900">COMO Developments</p><p className="text-[10px] text-slate-500">المكتب التنفيذي الذكي</p></div>
          </div>
          <Button onClick={() => (window.location.href = getLoginUrl())} className="rounded-xl bg-slate-900 px-5 text-white hover:bg-slate-800">تسجيل الدخول</Button>
        </div>
      </header>
      <main className="mx-auto grid min-h-[calc(100vh-65px)] max-w-6xl items-center gap-10 px-5 py-12 sm:px-8 lg:grid-cols-[1.05fr_.95fr]">
        <section>
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800"><Sparkles className="h-4 w-4" /> COMO Next</div>
          <h1 className="mt-6 text-4xl font-black leading-[1.25] text-slate-950 sm:text-6xl">عقلٌ مساعد لإدارة العمل،<br /><span className="text-[#b7791f]">لا لوحة أرقام أخرى.</span></h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-slate-600">سارة هي واجهة التواصل، وManus هو العقل التنفيذي عند التكليف. المعرفة والقرارات والاجتماعات والوثائق تبقى مرتبطة بالمشروع وملف العمل.</p>
          <Button size="lg" onClick={() => (window.location.href = getLoginUrl())} className="mt-8 h-12 rounded-2xl bg-slate-900 px-7 text-white hover:bg-slate-800">الدخول إلى COMO <ArrowLeft className="mr-2 h-4 w-4" /></Button>
        </section>
        <section className="relative mx-auto w-full max-w-md">
          <div className="absolute -inset-8 rounded-[44px] bg-gradient-to-br from-amber-200/50 via-white to-slate-200/60 blur-2xl" />
          <div className="relative overflow-hidden rounded-[36px] border border-white bg-white p-3 shadow-[0_35px_100px_rgba(15,23,42,.18)]">
            <img src={SARA_AVATAR_URL} alt="سارة" className="aspect-[4/5] w-full rounded-[29px] object-cover object-top" />
            <div className="absolute inset-x-7 bottom-7 rounded-2xl border border-white/30 bg-slate-950/75 p-4 text-white backdrop-blur-xl">
              <p className="text-sm font-black">سارة · واجهة COMO</p>
              <p className="mt-1 text-xs text-slate-300">تستمع، تتحدث، وتضع المعرفة في سياقها الصحيح.</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();
  const { ccMember, ccLoading, isCCAuth } = useCCAuth();
  const [, navigate] = useLocation();
  const effectivelyAuthenticated = isAuthenticated || isCCAuth;
  const effectiveName = user?.name || ccMember?.nameAr || "عبد الرحمن";

  const overviewQuery = trpc.comoNext.getOverview.useQuery(undefined, {
    enabled: isAuthenticated,
    staleTime: 30_000,
    retry: false,
  });
  const overview = overviewQuery.data;
  const todaySummary = overview?.today.summary;
  const decisions = overview?.decisions ?? [];
  const communications = overview?.draftCommunications ?? [];
  const meetings = overview?.meetingAttention ?? [];
  const emailAttention = overview?.emailAttention ?? [];
  const intakeProposals = overview?.intakeProposals ?? [];
  const workFiles = overview?.workFiles ?? [];
  const firstDecision = decisions[0];
  const firstAction = overview?.today.sections.mine[0]
    ?? overview?.today.sections.manus[0]
    ?? overview?.today.sections.team[0]
    ?? overview?.today.sections.waitingExternal[0];

  if (loading || ccLoading) {
    return <div className="flex min-h-screen items-center justify-center bg-[#f7f8f6]"><Loader2 className="h-7 w-7 animate-spin text-amber-600" /></div>;
  }

  if (!effectivelyAuthenticated) return <PublicHome />;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,#fff8e9_0,#fbfcfb_36%,#f2f5f5_100%)] text-slate-900" dir="rtl">
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-7">
          <button type="button" onClick={() => navigate("/")} className="flex items-center gap-3 text-right">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-md"><Building2 className="h-5 w-5" /></div>
            <div><p className="text-sm font-black">COMO Developments</p><p className="text-[10px] text-slate-500">مكتب عبد الرحمن التنفيذي</p></div>
          </button>
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-slate-500 sm:block">مرحبًا، <strong className="text-slate-800">{effectiveName}</strong></span>
            <Button variant="outline" onClick={() => navigate("/como-next")} className="rounded-xl border-slate-200 bg-white text-xs"><BriefcaseBusiness className="ml-2 h-4 w-4" /> COMO Next</Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-7 sm:py-9">
        <section className="relative overflow-hidden rounded-[34px] border border-[#eadbb9] bg-[#102832] shadow-[0_30px_90px_rgba(15,36,45,.18)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(222,178,92,.22),transparent_34%),linear-gradient(120deg,transparent_15%,rgba(255,255,255,.03)_70%,rgba(222,178,92,.10))]" />
          <div className="relative grid min-h-[390px] lg:grid-cols-[1.15fr_.85fr]">
            <div className="flex flex-col justify-center px-6 py-9 sm:px-10 lg:px-14 lg:py-12">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-[11px] font-black text-amber-200">سارة · واجهة التواصل</span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-bold text-slate-300">Manus · العقل التنفيذي عند التكليف</span>
              </div>
              <h1 className="mt-6 max-w-3xl text-3xl font-black leading-[1.25] text-white sm:text-5xl">ابدأ من السؤال،<br /><span className="text-amber-300">ودع سارة ترتّب طريق العمل.</span></h1>
              <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">سارة تستمع وتتحدث وتقرأ ما هو معتمد في COMO. وعندما يحتاج الأمر تحليلًا عميقًا أو إعداد تقرير أو تنفيذ خطوة، يُكلّف Manus بوضوح وتحت إشرافك.</p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Button onClick={() => navigate("/sara")} className="h-12 rounded-2xl bg-amber-400 px-6 font-black text-slate-950 shadow-lg shadow-amber-400/20 hover:bg-amber-300"><MessageSquare className="ml-2 h-5 w-5" /> تحدث مع سارة</Button>
                <Button variant="outline" onClick={() => navigate("/como-next")} className="h-12 rounded-2xl border-white/20 bg-white/5 px-6 font-bold text-white hover:bg-white/10"><BriefcaseBusiness className="ml-2 h-5 w-5" /> افتح المكتب التنفيذي</Button>
              </div>
              <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-slate-400">
                <span><ShieldCheck className="ml-1.5 inline h-4 w-4 text-emerald-400" /> لا إرسال خارجي تلقائي</span>
                <span><LockKeyhole className="ml-1.5 inline h-4 w-4 text-amber-300" /> القرارات لا تتحول إلى تنفيذ دون اعتماد</span>
              </div>
            </div>

            <div className="relative min-h-[330px] overflow-hidden lg:min-h-full">
              <div className="absolute inset-0 bg-gradient-to-t from-[#102832] via-transparent to-transparent lg:bg-gradient-to-r" />
              <img src={SARA_AVATAR_URL} alt="سارة، واجهة COMO" className="h-full w-full object-cover object-top" />
              <div className="absolute bottom-6 right-6 left-6 rounded-2xl border border-white/15 bg-slate-950/65 p-4 text-white backdrop-blur-xl">
                <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-black">سارة جاهزة</p><p className="mt-1 text-[11px] text-slate-300">الصوت والصورة الحية يعملان فقط عندما تبدأ الجلسة.</p></div><span className="relative flex h-3 w-3"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" /><span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" /></span></div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-7" aria-label="موجز COMO Next">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div><p className="text-[11px] font-black text-[#1f6478]">من COMO Next فقط</p><h2 className="mt-1 text-xl font-black text-slate-900">ما يحتاج انتباهك الآن</h2></div>
            <button type="button" onClick={() => navigate("/como-next")} className="inline-flex items-center gap-1 text-xs font-bold text-[#1f6478] hover:underline">عرض المكتب التنفيذي <ArrowLeft className="h-4 w-4" /></button>
          </div>

          {!isAuthenticated ? (
            <div className="rounded-[24px] border border-dashed border-slate-300 bg-white/70 p-6 text-center">
              <LockKeyhole className="mx-auto h-6 w-6 text-slate-400" />
              <p className="mt-3 text-sm font-black text-slate-800">الملخص التنفيذي مخصص لدخول المالك المعتمد</p>
              <p className="mt-1 text-xs text-slate-500">لن نعرض بديلًا من بيانات النظام القديم.</p>
            </div>
          ) : overviewQuery.isLoading ? (
            <div className="flex min-h-40 items-center justify-center rounded-[24px] border border-slate-200 bg-white"><Loader2 className="h-6 w-6 animate-spin text-[#1f6478]" /></div>
          ) : overviewQuery.isError ? (
            <div className="rounded-[24px] border border-red-200 bg-red-50 p-6 text-center"><CircleAlert className="mx-auto h-6 w-6 text-red-600" /><p className="mt-3 text-sm font-black text-red-900">تعذر قراءة COMO Next الآن</p><p className="mt-1 text-xs text-red-700">لم تُستخدم أي بيانات قديمة كبديل.</p></div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                <MetricCard label="قرارات تنتظر اعتمادك" value={decisions.length} note="قرارات مسجلة داخل ملفات العمل فقط." icon={CircleAlert} tone="bg-rose-50 text-rose-700" />
                <MetricCard label="استحقاقات اليوم" value={todaySummary?.dueToday ?? 0} note={`${todaySummary?.overdue ?? 0} متأخر ضمن إجراءات COMO Next.`} icon={FileClock} tone="bg-amber-50 text-amber-700" />
                <MetricCard label="مسودات للمراجعة" value={communications.length} note="المسودة لا تعني إرسالًا أو التزامًا خارجيًا." icon={MessageSquare} tone="bg-sky-50 text-sky-700" />
                <MetricCard label="اجتماعات تحتاج متابعة" value={meetings.length} note="تحضير أو مخرجات أو محضر ينتظر المراجعة." icon={CalendarCheck} tone="bg-emerald-50 text-emerald-700" />
                <MetricCard label="بريد يحتاج مراجعتك" value={emailAttention.length} note="قراءة فقط؛ الربط أو التحليل أو المسودة يحتاج اختيارك." icon={Inbox} tone="bg-violet-50 text-violet-700" />
                <MetricCard label="مقترحات تنتظر قرارك" value={intakeProposals.length} note="من البريد أو سارة؛ لا تتحول إلى عمل قبل اعتمادك." icon={Sparkles} tone="bg-fuchsia-50 text-fuchsia-700" />
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-[1.05fr_.95fr]">
                <button type="button" onClick={() => navigate("/como-next")} className="rounded-[24px] border border-slate-200 bg-white p-5 text-right shadow-[0_14px_36px_rgba(15,23,42,.04)] transition hover:border-[#8fb7c2] hover:shadow-md">
                  <p className="text-[10px] font-black text-rose-700">أولوية القرار</p>
                  {firstDecision ? <><h3 className="mt-2 text-base font-black text-slate-900">{firstDecision.title}</h3><p className="mt-2 text-xs leading-6 text-slate-500">{firstDecision.projectName} · {firstDecision.workFileTitle}</p></> : <><h3 className="mt-2 text-base font-black text-slate-900">لا يوجد قرار معلق</h3><p className="mt-2 text-xs text-slate-500">لن نصنع قرارًا تقديريًا لملء الصفحة.</p></>}
                </button>
                <button type="button" onClick={() => navigate("/como-next")} className="rounded-[24px] border border-slate-200 bg-white p-5 text-right shadow-[0_14px_36px_rgba(15,23,42,.04)] transition hover:border-[#8fb7c2] hover:shadow-md">
                  <p className="text-[10px] font-black text-[#1f6478]">الإجراء الأقرب</p>
                  {firstAction ? <><h3 className="mt-2 text-base font-black text-slate-900">{firstAction.title}</h3><p className="mt-2 text-xs leading-6 text-slate-500">{firstAction.projectName} · {firstAction.workFileTitle}</p></> : <><h3 className="mt-2 text-base font-black text-slate-900">لا يوجد إجراء مستحق اليوم</h3><p className="mt-2 text-xs text-slate-500">ملفات العمل المفتوحة حاليًا: {workFiles.length}</p></>}
                </button>
              </div>
            </>
          )}
        </section>

        <section className="mt-10 pb-10">
          <div className="mb-4"><p className="text-[11px] font-black text-[#825e44]">مساحات واضحة بلا تكرار</p><h2 className="mt-1 text-xl font-black text-slate-900">أين تريد أن تعمل؟</h2></div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {EXECUTIVE_DESTINATIONS.map(item => <DestinationCard key={item.id} item={item} onOpen={navigate} />)}
          </div>
          {user?.role === "admin" && (
            <button type="button" onClick={() => navigate("/test-project")} className="mt-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-[11px] font-bold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"><FolderOpen className="h-4 w-4" /> مختبر المشاريع المعزول</button>
          )}
        </section>
      </main>

      <footer className="border-t border-slate-200/70 bg-white/70 py-5">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 text-[10px] text-slate-500 sm:px-7"><span>COMO Developments © 2026</span><span><BrainCircuit className="ml-1 inline h-3.5 w-3.5" /> سارة للتواصل · Manus للتنفيذ عند التكليف</span></div>
      </footer>
    </div>
  );
}
