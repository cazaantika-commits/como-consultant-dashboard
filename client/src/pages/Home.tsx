import { useAuth } from "@/_core/hooks/useAuth";
import { useCCAuth } from "@/contexts/CCAuthContext";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  BookOpen,
  BriefcaseBusiness,
  Building2,
  ChevronLeft,
  FilePlus2,
  FolderKanban,
  Layers,
  Loader2,
  MessageSquare,
  Route,
} from "lucide-react";

type GatewayItem = {
  id: string;
  title: string;
  path: string;
  icon: typeof BriefcaseBusiness;
  tone: string;
};

const PRIMARY_GATEWAYS: GatewayItem[] = [
  { id: "sara-today", title: "اليوم مع سارة", path: "/sara", icon: MessageSquare, tone: "bg-amber-50 text-amber-800" },
  { id: "executive-office", title: "المكتب التنفيذي", path: "/como-next", icon: BriefcaseBusiness, tone: "bg-[#e8f3f3] text-[#1d6577]" },
  { id: "project-management", title: "إدارة المشاريع", path: "/project-management", icon: FolderKanban, tone: "bg-emerald-50 text-emerald-800" },
  { id: "project-opening", title: "فتح مشروع من وثيقته", path: "/como-next/project-opening", icon: FilePlus2, tone: "bg-violet-50 text-violet-800" },
];

const WORKSPACES: GatewayItem[] = [
  { id: "financial-studies", title: "الدراسات والتخطيط المالي", path: "/bateekha", icon: Layers, tone: "bg-emerald-50 text-emerald-800" },
  { id: "consultants", title: "مساحة الاستشاريين", path: "/consultant-portal", icon: Building2, tone: "bg-orange-50 text-orange-800" },
  { id: "knowledge", title: "المعرفة والتحليل", path: "/knowledge-analysis", icon: BookOpen, tone: "bg-indigo-50 text-indigo-800" },
  { id: "development-tour", title: "جولة مراحل التطوير", path: "/development-phases", icon: Route, tone: "bg-fuchsia-50 text-fuchsia-800" },
];

function GatewayButton({ item, onOpen, primary = false }: { item: GatewayItem; onOpen: (path: string) => void; primary?: boolean }) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={() => onOpen(item.path)}
      className={`group flex w-full items-center justify-between gap-4 border bg-white text-right shadow-sm transition duration-150 hover:border-[#8fb7c2] hover:shadow-md active:scale-[0.98] ${primary ? "min-h-24 rounded-[24px] px-5 py-4" : "min-h-16 rounded-2xl px-4 py-3"}`}
    >
      <span className="flex min-w-0 items-center gap-4">
        <span className={`flex shrink-0 items-center justify-center rounded-2xl ${item.tone} ${primary ? "h-12 w-12" : "h-10 w-10"}`}><Icon className={primary ? "h-6 w-6" : "h-5 w-5"} /></span>
        <span className={`min-w-0 break-words ${primary ? "text-lg" : "text-sm"} font-black text-slate-950`}>{item.title}</span>
      </span>
      <ChevronLeft className="h-5 w-5 shrink-0 text-slate-300 transition-transform group-hover:-translate-x-1 group-hover:text-[#1d6577]" />
    </button>
  );
}

function PublicHome() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_right,#fff8e9_0,#ffffff_45%,#eef3f3_100%)] p-5" dir="rtl">
      <section className="w-full max-w-lg rounded-[30px] border border-white bg-white/90 p-7 shadow-[0_28px_90px_rgba(15,23,42,.12)] sm:p-10">
        <div className="flex items-center gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white"><Building2 className="h-6 w-6" /></span><div><p className="font-black text-slate-950">COMO Developments</p><p className="text-xs text-slate-500">مكتب عبد الرحمن التنفيذي</p></div></div>
        <h1 className="mt-8 text-3xl font-black text-slate-950">COMO Next</h1>
        <Button onClick={() => { window.location.href = getLoginUrl(); }} className="mt-7 h-12 w-full rounded-2xl bg-slate-900 text-white hover:bg-slate-800">تسجيل الدخول <ArrowLeft className="mr-2 h-4 w-4" /></Button>
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
    <div className="min-h-screen min-w-0 max-w-full overflow-x-hidden bg-[radial-gradient(circle_at_top_right,#fff8e9_0,#fbfcfb_34%,#edf3f2_100%)] text-slate-900" dir="rtl">
      <header className="border-b border-slate-200/70 bg-white/88 backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-7">
          <div className="flex min-w-0 items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white"><Building2 className="h-5 w-5" /></span><div className="min-w-0"><p className="truncate text-sm font-black">COMO Developments</p><p className="truncate text-[10px] text-slate-500">مكتب عبد الرحمن التنفيذي</p></div></div>
          <p className="max-w-[32%] truncate text-[10px] text-slate-500 sm:max-w-none sm:text-xs">{effectiveName}</p>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-7 sm:px-7 sm:py-10">
        <div className="mb-6"><h1 className="text-2xl font-black text-slate-950 sm:text-3xl">إلى أين تريد أن تذهب؟</h1></div>
        <section className="grid gap-3 sm:grid-cols-2">
          {PRIMARY_GATEWAYS.map(item => <GatewayButton key={item.id} item={item} onOpen={navigate} primary />)}
        </section>
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-black text-slate-500">المساحات</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {WORKSPACES.map(item => <GatewayButton key={item.id} item={item} onOpen={navigate} />)}
          </div>
        </section>
      </main>
    </div>
  );
}
