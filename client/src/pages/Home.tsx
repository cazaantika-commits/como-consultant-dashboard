import { useAuth } from "@/_core/hooks/useAuth";
import { useCCAuth } from "@/contexts/CCAuthContext";
import { PreservedCapabilityGallery } from "@/components/PreservedCapabilityGallery";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import saraPortrait from "@/assets/como/sara.webp";
import {
  ArrowLeft,
  ArrowUpLeft,
  BookOpen,
  BriefcaseBusiness,
  Building2,
  FilePlus2,
  FolderKanban,
  Layers,
  Loader2,
  MessageSquare,
  Route,
  Sparkles,
} from "lucide-react";

const SARA_PORTRAIT = saraPortrait;

type GatewayItem = {
  id: string;
  title: string;
  description: string;
  path: string;
  icon: typeof BriefcaseBusiness;
  theme: string;
  iconTone: string;
  label: string;
};

const PRIMARY_GATEWAYS: GatewayItem[] = [
  {
    id: "sara-today",
    title: "اليوم مع سارة",
    description: "حديث مباشر وموجز صباحي سريع.",
    path: "/sara",
    icon: MessageSquare,
    theme: "border-amber-200/70 bg-[linear-gradient(135deg,#fffaf0_0%,#fff1c7_100%)]",
    iconTone: "bg-amber-400 text-slate-950",
    label: "SARA",
  },
  {
    id: "executive-office",
    title: "المطبخ التنفيذي",
    description: "كل ما عليك تنفيذه ومراجعته الآن.",
    path: "/como-next",
    icon: BriefcaseBusiness,
    theme: "border-slate-800 bg-[radial-gradient(circle_at_top_right,#24415d_0%,#14243a_48%,#0b1728_100%)] text-white",
    iconTone: "bg-white/12 text-amber-300 ring-1 ring-white/15",
    label: "COMO NEXT",
  },
  {
    id: "project-management",
    title: "إدارة المشاريع",
    description: "ادخل من المشروع إلى ملفه ومساراته المعتمدة.",
    path: "/project-management",
    icon: FolderKanban,
    theme: "border-emerald-200/70 bg-[linear-gradient(135deg,#f4fbf7_0%,#def3e8_100%)]",
    iconTone: "bg-emerald-800 text-white",
    label: "PROJECTS",
  },
  {
    id: "project-opening",
    title: "فتح مشروع من وثيقته",
    description: "فرصة جديدة تبدأ من وثيقة أرض واحدة على الأقل.",
    path: "/como-next/project-opening",
    icon: FilePlus2,
    theme: "border-violet-200/70 bg-[linear-gradient(135deg,#faf7ff_0%,#eee5ff_100%)]",
    iconTone: "bg-violet-800 text-white",
    label: "NEW PROJECT",
  },
];

const WORKSPACES: GatewayItem[] = [
  { id: "financial-studies", title: "الدراسات والتخطيط المالي", description: "المحركات المالية المحمية كما هي.", path: "/bateekha", icon: Layers, theme: "border-emerald-100 bg-white", iconTone: "bg-emerald-50 text-emerald-800", label: "STUDIES" },
  { id: "consultants", title: "مساحة الاستشاريين", description: "النطاق والتقييم والتكليف.", path: "/consultant-portal", icon: Building2, theme: "border-orange-100 bg-white", iconTone: "bg-orange-50 text-orange-800", label: "CONSULTANTS" },
  { id: "knowledge", title: "المعرفة والتحليل", description: "السوق والدليل والقرار.", path: "/knowledge-analysis", icon: BookOpen, theme: "border-indigo-100 bg-white", iconTone: "bg-indigo-50 text-indigo-800", label: "KNOWLEDGE" },
  { id: "development-tour", title: "جولة مراحل التطوير", description: "المراحل والبرنامج والمتابعة.", path: "/development-phases", icon: Route, theme: "border-fuchsia-100 bg-white", iconTone: "bg-fuchsia-50 text-fuchsia-800", label: "DEVELOPMENT" },
];

function GatewayCard({ item, onOpen, primary = false }: { item: GatewayItem; onOpen: (path: string) => void; primary?: boolean }) {
  const Icon = item.icon;
  const dark = item.id === "executive-office";
  return (
    <button
      type="button"
      onClick={() => onOpen(item.path)}
      className={`group relative min-w-0 overflow-hidden border text-right shadow-[0_16px_38px_rgba(15,23,42,.08)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_22px_52px_rgba(15,23,42,.14)] active:scale-[0.985] ${item.theme} ${primary ? "min-h-[184px] rounded-[30px] p-5 sm:p-6" : "min-h-[132px] rounded-[24px] p-4 sm:p-5"}`}
    >
      <div className={`absolute -left-10 -top-12 h-32 w-32 rounded-full blur-2xl ${dark ? "bg-cyan-300/10" : "bg-white/80"}`} />
      {item.id === "sara-today" ? <img src={SARA_PORTRAIT} alt="سارة" className="absolute bottom-0 left-2 h-[92%] w-[43%] object-cover object-top opacity-95 [mask-image:linear-gradient(to_right,black_72%,transparent)]" /> : null}
      <div className="relative z-10 flex h-full flex-col justify-between">
        <div className="flex items-start justify-between gap-4">
          <span className={`flex shrink-0 items-center justify-center rounded-2xl ${item.iconTone} ${primary ? "h-12 w-12" : "h-10 w-10"}`}><Icon className={primary ? "h-6 w-6" : "h-5 w-5"} /></span>
          <span className={`text-[9px] font-black tracking-[.18em] ${dark ? "text-cyan-100/65" : "text-slate-400"}`}>{item.label}</span>
        </div>
        <div className={item.id === "sara-today" ? "max-w-[62%]" : ""}>
          <h2 className={`${primary ? "text-xl sm:text-2xl" : "text-base sm:text-lg"} font-black leading-tight ${dark ? "text-white" : "text-slate-950"}`}>{item.title}</h2>
          <p className={`mt-2 text-xs leading-5 ${dark ? "text-slate-300" : "text-slate-600"}`}>{item.description}</p>
        </div>
        <ArrowUpLeft className={`absolute bottom-5 left-5 h-5 w-5 transition-transform group-hover:-translate-x-1 group-hover:-translate-y-1 ${dark ? "text-amber-300" : "text-slate-400"}`} />
      </div>
    </button>
  );
}

function PublicHome() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_right,#fff5d9_0,#ffffff_42%,#e9f1f0_100%)] p-5" dir="rtl">
      <section className="w-full max-w-lg overflow-hidden rounded-[34px] border border-white bg-white/90 shadow-[0_32px_100px_rgba(15,23,42,.14)]">
        <div className="bg-[#14243a] p-8 text-white sm:p-10"><div className="flex items-center gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-amber-300"><Building2 className="h-6 w-6" /></span><div><p className="font-black">COMO Developments</p><p className="text-xs text-white/55">مكتب عبد الرحمن التنفيذي</p></div></div><h1 className="mt-10 text-4xl font-black">COMO Next</h1></div>
        <div className="p-7 sm:p-9"><Button onClick={() => { window.location.href = getLoginUrl(); }} className="h-12 w-full rounded-2xl bg-slate-950 text-white hover:bg-slate-800">تسجيل الدخول <ArrowLeft className="mr-2 h-4 w-4" /></Button></div>
      </section>
    </div>
  );
}

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();
  const { ccMember, ccLoading, isCCAuth } = useCCAuth();
  const [, navigate] = useLocation();
  const effectivelyAuthenticated = isAuthenticated || isCCAuth;
  const effectiveName = user?.name || ccMember?.nameAr || "عبد الرحمن";

  if (loading || ccLoading) return <div className="flex min-h-screen items-center justify-center bg-[#f6f7f5]"><Loader2 className="h-7 w-7 animate-spin text-[#1d6577]" /></div>;
  if (!effectivelyAuthenticated) return <PublicHome />;

  return (
    <div className="min-h-screen min-w-0 max-w-full overflow-x-hidden bg-[radial-gradient(circle_at_top_right,#fff4d8_0,#f8faf8_34%,#e8f0ef_100%)] text-slate-900" dir="rtl">
      <header className="border-b border-white/70 bg-white/72 backdrop-blur-xl">
        <div className="mx-auto flex min-h-18 max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-7">
          <div className="flex min-w-0 items-center gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#14243a] text-amber-300 shadow-lg shadow-slate-950/10"><Building2 className="h-5 w-5" /></span><div className="min-w-0"><p className="truncate text-sm font-black">COMO Developments</p><p className="truncate text-[10px] tracking-wide text-slate-500">EXECUTIVE DEVELOPMENT OFFICE</p></div></div>
          <p className="max-w-[32%] truncate text-[10px] font-bold text-slate-500 sm:max-w-none sm:text-xs">{effectiveName}</p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-7 sm:px-7 sm:py-10">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div><div className="flex items-center gap-2 text-[#1d6577]"><Sparkles className="h-4 w-4" /><p className="text-[10px] font-black tracking-[.16em]">COMO NEXT</p></div><h1 className="mt-2 text-3xl font-black text-slate-950 sm:text-4xl">إلى أين تريد أن تذهب؟</h1></div>
        </div>
        <section className="grid gap-4 sm:grid-cols-2">
          {PRIMARY_GATEWAYS.map(item => <GatewayCard key={item.id} item={item} onOpen={navigate} primary />)}
        </section>
        <section className="mt-9">
          <div className="mb-4 flex items-center justify-between"><h2 className="text-sm font-black text-slate-600">مساحات العمل المحمية</h2><span className="text-[10px] font-bold text-slate-400">تُفتح عند الحاجة</span></div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {WORKSPACES.map(item => <GatewayCard key={item.id} item={item} onOpen={navigate} />)}
          </div>
        </section>
        <PreservedCapabilityGallery />
      </main>
    </div>
  );
}
