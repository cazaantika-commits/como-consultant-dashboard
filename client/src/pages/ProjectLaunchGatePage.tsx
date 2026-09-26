import { useLocation, useParams } from "wouter";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  CircleDot,
  ClipboardCheck,
  FileSearch,
  Landmark,
  LockKeyhole,
  Route,
  Scale,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";

const gateIcons = [Landmark, FileSearch, Route, Scale];

const statusMeta = {
  complete: { label: "مكتمل بالمصدر", icon: CheckCircle2, badge: "border-emerald-200 bg-emerald-50 text-emerald-700", panel: "border-emerald-100 bg-emerald-50/35" },
  partial: { label: "يحتاج استكمالًا", icon: AlertTriangle, badge: "border-amber-200 bg-amber-50 text-amber-800", panel: "border-amber-100 bg-amber-50/35" },
  missing: { label: "غير مسجل", icon: CircleDot, badge: "border-rose-200 bg-rose-50 text-rose-700", panel: "border-rose-100 bg-rose-50/25" },
} as const;

export default function ProjectLaunchGatePage({ embedded = false, initialProjectId = null }: { embedded?: boolean; initialProjectId?: number | null } = {}) {
  const { projectId: projectIdParam } = useParams<{ projectId: string }>();
  const [, navigate] = useLocation();
  const routeProjectId = Number(projectIdParam);
  const projectId = Number.isInteger(routeProjectId) && routeProjectId > 0 ? routeProjectId : Number(initialProjectId);
  const gateQuery = trpc.projectLaunchGate.get.useQuery(
    { projectId },
    { enabled: Number.isInteger(projectId) && projectId > 0, retry: false },
  );

  if (!Number.isInteger(projectId) || projectId <= 0) {
    return <div dir="rtl" className={`flex items-center justify-center bg-[#f4f6f4] p-5 ${embedded ? "min-h-[420px]" : "min-h-screen"}`}><Card className="w-full max-w-lg rounded-3xl p-8 text-center"><AlertTriangle className="mx-auto h-8 w-8 text-rose-600" /><h1 className="mt-4 text-xl font-black">اختر المشروع أولًا</h1><p className="mt-2 text-sm text-slate-500">بوابة التأسيس تقرأ حالة مشروع محدد ولا تعرض حالة عامة.</p>{!embedded ? <Button className="mt-6 rounded-xl" onClick={() => navigate("/project-management")}>إدارة المشاريع</Button> : null}</Card></div>;
  }
  if (gateQuery.isLoading) return <div dir="rtl" className="min-h-screen bg-[#f4f6f4] p-6"><div className="mx-auto max-w-6xl animate-pulse space-y-5"><div className="h-64 rounded-[36px] bg-slate-200" /><div className="grid gap-5 lg:grid-cols-2">{[1,2,3,4].map(item => <div key={item} className="h-72 rounded-[30px] bg-slate-200" />)}</div></div></div>;
  if (gateQuery.isError || !gateQuery.data) return <div dir="rtl" className="flex min-h-screen items-center justify-center bg-[#f4f6f4] p-5"><Card className="w-full max-w-lg rounded-3xl p-8 text-center"><LockKeyhole className="mx-auto h-8 w-8 text-rose-600" /><h1 className="mt-4 text-xl font-black">تعذر فتح بوابة التأسيس</h1><p className="mt-2 text-sm text-slate-500">{gateQuery.error?.message || "البيانات غير متاحة."}</p><Button variant="outline" className="mt-6 rounded-xl bg-white" onClick={() => navigate(`/como-next/projects/${projectId}`)}>العودة إلى ملف المشروع</Button></Card></div>;

  const gate = gateQuery.data;
  return <div dir="rtl" className="w-full min-w-0 max-w-full overflow-x-hidden min-h-screen bg-[radial-gradient(circle_at_top_right,#fff8e8_0,#f7faf8_36%,#eef4f3_100%)] text-slate-900">
    {!embedded ? <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-7">
        <button type="button" onClick={() => navigate(`/como-next/projects/${projectId}`)} className="inline-flex items-center gap-2 text-sm font-bold text-slate-700"><ArrowLeft className="h-4 w-4" />ملف المشروع</button>
        <div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className="rounded-full border-emerald-200 bg-emerald-50 text-emerald-700"><ShieldCheck className="ml-1 h-3.5 w-3.5" />مصادر المشروع الفعلية</Badge><Badge variant="outline" className="rounded-full bg-white">قراءة فقط</Badge></div>
      </div>
    </header> : null}

    <main className="mx-auto max-w-6xl px-4 py-7 sm:px-7 sm:py-10">
      <section className="relative overflow-hidden rounded-[38px] bg-[#102d36] text-white shadow-[0_30px_90px_rgba(15,36,45,.20)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(211,170,105,.28),transparent_32%),radial-gradient(circle_at_90%_10%,rgba(85,166,150,.22),transparent_38%)]" />
        <div className="relative grid gap-8 px-6 py-8 sm:px-10 lg:grid-cols-[1.18fr_.82fr] lg:px-12 lg:py-11">
          <div><p className="text-xs font-black text-amber-200">محطة ما بعد فتح المشروع</p><h1 className="mt-3 text-3xl font-black leading-tight sm:text-5xl">تثبيت أساس {gate.project.name}</h1><p className="mt-4 max-w-3xl text-sm leading-8 text-slate-300">قراءة واحدة تربط هوية الأرض والوثائق وقرار السوق والبرنامج والتكليف، وتقول لك بوضوح أين يقف المشروع وما القرار التالي.</p></div>
          <div className="self-end rounded-[28px] border border-white/10 bg-white/7 p-5 backdrop-blur"><div className="flex items-center justify-between gap-3"><div><p className="text-xs text-slate-300">البوابات المكتملة</p><p className="mt-1 text-4xl font-black"><bdi>{gate.completeGateCount}</bdi><span className="text-lg text-slate-400"> / {gate.totalGateCount}</span></p></div><ClipboardCheck className="h-10 w-10 text-amber-200" /></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-amber-300" style={{ width: `${Math.round((gate.completeGateCount / gate.totalGateCount) * 100)}%` }} /></div><p className="mt-4 text-xs leading-6 text-slate-300">جاهزية طلب العروض: <strong className={gate.readyForTender ? "text-emerald-300" : "text-amber-200"}>{gate.readyForTender ? "نعم — وفق المصادر الحالية" : "ليست مكتملة بعد"}</strong></p></div>
        </div>
      </section>

      <Card className="mt-6 overflow-hidden rounded-[30px] border-amber-200 bg-[#fffaf0] shadow-sm"><CardContent className="grid gap-5 p-6 lg:grid-cols-[1fr_auto] lg:items-center"><div><p className="text-[11px] font-black text-amber-800">القرار التالي المقترح — لا ينفذ تلقائيًا</p><h2 className="mt-2 text-xl font-black leading-8 text-slate-950">{gate.nextDecision}</h2><p className="mt-2 text-xs leading-6 text-slate-600">Manus يستطيع التحليل والتحضير عند تكليفه، لكن الانتقال والاعتماد يبقيان بقرار عبد الرحمن.</p></div><Button className="rounded-xl bg-slate-900 px-5 text-white" onClick={() => navigate(gate.nextActionHref)}>فتح المحطة المطلوبة <ChevronLeft className="mr-2 h-4 w-4" /></Button></CardContent></Card>

      <section className="mt-7 grid grid-cols-1 gap-5 lg:grid-cols-2">
        {gate.gates.map((item, index) => {
          const meta = statusMeta[item.status as keyof typeof statusMeta];
          const StatusIcon = meta.icon;
          const GateIcon = gateIcons[index] || ClipboardCheck;
          return <Card key={item.id} className={`min-w-0 rounded-[30px] border p-0 shadow-sm ${meta.panel}`}>
            <CardContent className="p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[#1f6478] shadow-sm"><GateIcon className="h-5 w-5" /></div><div><p className="text-[10px] font-black text-slate-500">{index + 1}. {item.sourceLabel}</p><h2 className="mt-1 text-lg font-black text-slate-950">{item.title}</h2></div></div><Badge variant="outline" className={`rounded-full ${meta.badge}`}><StatusIcon className="ml-1 h-3.5 w-3.5" />{meta.label}</Badge></div>
              <p className="mt-4 text-xs leading-6 text-slate-600">{item.description}</p>
              <p className="mt-3 rounded-2xl bg-white/80 p-3 text-xs font-bold leading-6 text-slate-800">{item.detail}</p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">{item.items.map(check => <div key={check.label} className="flex items-center gap-2 rounded-xl bg-white/70 px-3 py-2.5 text-[11px] font-semibold text-slate-700">{check.present ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> : <CircleDot className="h-4 w-4 shrink-0 text-slate-400" />}<span>{check.label}</span></div>)}</div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl border border-white/80 bg-white/75 p-3"><p className="text-[10px] font-black text-slate-400">سبب الحالة</p><p className="mt-1 text-xs leading-6 text-slate-700">{item.reason}</p></div><div className="rounded-2xl border border-white/80 bg-white/75 p-3"><p className="text-[10px] font-black text-slate-400">الإجراء التالي</p><p className="mt-1 text-xs leading-6 text-slate-700">{item.nextAction}</p></div></div>
              <Button variant="outline" className="mt-4 w-full rounded-xl bg-white" onClick={() => navigate(item.href)}>فتح مصدر الحقيقة <ChevronLeft className="mr-2 h-4 w-4" /></Button>
            </CardContent>
          </Card>;
        })}
      </section>

      <div className="mt-7 rounded-[26px] border border-slate-200 bg-white/80 p-5 text-xs leading-7 text-slate-600"><LockKeyhole className="ml-2 inline h-4 w-4 text-[#1f6478]" />هذه الصفحة لا تعدّل بطاقة المشروع أو قرار السوق أو البرنامج أو العقد. كل تعديل يتم من سجل المصدر وبصلاحياته، ثم تنعكس حالته هنا.</div>
    </main>
  </div>;
}
