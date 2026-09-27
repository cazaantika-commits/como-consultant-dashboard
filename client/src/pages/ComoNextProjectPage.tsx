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
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ChevronLeft,
  CircleAlert,
  ClipboardList,
  DraftingCompass,
  ExternalLink,
  FileCheck2,
  FileSignature,
  FileStack,
  Landmark,
  Link2,
  LockKeyhole,
  Mail,
  MapPinned,
  Route,
  Sparkles,
  TimerReset,
  UsersRound,
} from "lucide-react";


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

type ProjectSectionKey = "foundation" | "position" | "specialists" | "sources" | "work-files" | "memory" | "parties" | "communications" | "meetings";

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
  const [selectedProjectSection, setSelectedProjectSection] = useState<ProjectSectionKey | null>(null);
  const [selectedProjectItem, setSelectedProjectItem] = useState<string | null>(null);
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
  const sourceRegister = data.sourceRegister;
  const projectSections = [
    { key: "foundation" as const, title: "تأسيس المشروع", count: `${data.foundation.completeGateCount}/${data.foundation.totalGateCount}`, icon: Landmark },
    { key: "position" as const, title: "الموضع التنفيذي", count: data.dossier?.dependencies.length || 0, icon: CircleAlert },
    { key: "specialists" as const, title: "مراجعات Manus", count: 2, icon: Sparkles },
    { key: "sources" as const, title: "العقود والدورة والنطاق", count: sourceRegister.contracts.length + sourceRegister.deliverables.length + sourceRegister.lifecycle.services.length, icon: Route },
    { key: "work-files" as const, title: "ملفات العمل والقرارات", count: activeWorkFiles.length + data.decisions.length, icon: FileStack },
    { key: "memory" as const, title: "ذاكرة المشروع", count: data.reviewedMemory.length, icon: BookOpenCheck },
    { key: "parties" as const, title: "الأطراف", count: data.summary.activeParties, icon: UsersRound },
    { key: "communications" as const, title: "المراسلات", count: data.communications.length, icon: Mail },
    { key: "meetings" as const, title: "الاجتماعات", count: data.meetings.length, icon: CalendarDays },
  ];
  const selectedMemory = selectedProjectItem?.startsWith("memory:") ? data.reviewedMemory.find((item: any) => item.id === Number(selectedProjectItem.split(":")[1])) : null;
  const selectedParty = selectedProjectItem?.startsWith("party:") ? data.parties.find((item: any) => item.id === Number(selectedProjectItem.split(":")[1])) : null;

  const openWorkFile = (workFileId: number) => navigate(`/como-next?tab=work-files&workFileId=${workFileId}`);
  const openFocusedOfficeRecord = (section: "decisions" | "communications" | "meetings", kind: "decision" | "communication" | "meeting", workFileId: number, recordId: number) => navigate(`/como-next?section=${section}&workFileId=${workFileId}&focusKind=${kind}&focusId=${recordId}`);

  return <div dir="rtl" className="min-h-screen min-w-0 max-w-full overflow-x-hidden bg-[radial-gradient(circle_at_top_right,#fff8e9_0,#f8faf9_34%,#eef3f2_100%)] text-slate-900">
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/88 backdrop-blur-xl">
      <div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-7">
        <button type="button" onClick={() => navigate("/como-next?tab=work-files")} className="inline-flex items-center gap-2 text-sm font-bold text-slate-700"><ArrowLeft className="h-4 w-4" />المكتب التنفيذي</button>
        <Button variant="outline" onClick={() => navigate(`/project-management?projectId=${projectId}`)} className="rounded-xl bg-white text-xs"><BriefcaseBusiness className="ml-1 h-3.5 w-3.5" />إدارة المشروع</Button>
      </div>
    </header>

    <main className="mx-auto max-w-7xl px-4 py-7 sm:px-7 sm:py-10">
      <section className="relative overflow-hidden rounded-[36px] bg-[#122b35] text-white shadow-[0_30px_90px_rgba(15,36,45,.18)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(211,170,105,.26),transparent_32%),radial-gradient(circle_at_90%_10%,rgba(85,166,150,.20),transparent_36%)]" />
        <div className="relative min-w-0 px-5 py-7 sm:px-10"><Badge className="rounded-full border border-amber-300/25 bg-amber-300/10 text-amber-200 hover:bg-amber-300/10">الملف التنفيذي الموحد</Badge><h1 className="mt-4 break-words text-2xl font-black leading-tight sm:text-4xl">{data.project.name}</h1></div>
      </section>

      {projectFacts.length ? <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">{projectFacts.map(item => { const Icon = item.icon; return <Card key={item.label} className="rounded-2xl border-slate-200 bg-white/90 p-4 shadow-sm"><Icon className="h-4 w-4 text-[#1f6478]" /><p className="mt-3 text-[10px] font-bold text-slate-400">{item.label}</p><p className="mt-1 text-sm font-black text-slate-800">{item.value}</p></Card>; })}</section> : null}

      {!selectedProjectSection ? <section className="mt-7"><h2 className="mb-4 text-xl font-black">محتوى المشروع</h2><div className="grid gap-2 sm:grid-cols-2">{projectSections.map(item => { const Icon = item.icon; return <button key={item.key} type="button" onClick={() => { setSelectedProjectSection(item.key); setSelectedProjectItem(null); }} className="group flex min-h-15 w-full items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-right shadow-sm transition hover:border-[#8fb7c2] hover:shadow-md"><span className="flex min-w-0 items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-[#1f6478]"><Icon className="h-4 w-4" /></span><span className="font-black text-slate-900">{item.title}</span></span><bdi className="text-sm font-black text-slate-400">{item.count}</bdi></button>; })}</div></section> : <button type="button" onClick={() => { setSelectedProjectSection(null); setSelectedProjectItem(null); }} className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm"><ArrowLeft className="h-4 w-4" />كل محتوى المشروع</button>}

      {selectedProjectSection === "foundation" ? <section className="mt-6 overflow-hidden rounded-[30px] border border-amber-200 bg-[#fffaf0] shadow-sm">
        <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div><div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className="rounded-full border-amber-200 bg-white text-amber-800">محطة تأسيس المشروع</Badge><span className="text-[10px] font-bold text-slate-500"><bdi>{data.foundation.completeGateCount}</bdi> من <bdi>{data.foundation.totalGateCount}</bdi> مكتملة بالمصدر</span></div><h2 className="mt-3 text-xl font-black leading-8 text-slate-950">{data.foundation.nextDecision}</h2><div className="mt-3 flex flex-wrap gap-2">{data.foundation.gates.map((gate: any) => <span key={gate.id} className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${gate.status === "complete" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : gate.status === "partial" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-slate-200 bg-white text-slate-500"}`}>{gate.title}</span>)}</div></div>
          <Button className="rounded-xl bg-slate-900 text-white" onClick={() => navigate(`/project-launch/${projectId}`)}>فتح البوابة كاملة <ChevronLeft className="mr-2 h-4 w-4" /></Button>
        </div>
      </section> : null}

      {selectedProjectSection === "position" && data.dossier ? <section className="mt-7 grid gap-5 lg:grid-cols-[1.08fr_.92fr]">
        <Card className="rounded-[30px] border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eaf4f3] text-[#1f6478]"><BriefcaseBusiness className="h-5 w-5" /></div><div><p className="text-[10px] font-black text-[#1f6478]">الموضع التنفيذي الموثق</p><h2 className="mt-1 text-xl font-black">أين وصل المشروع فعليًا؟</h2></div></div><p className="mt-5 whitespace-pre-wrap text-sm leading-8 text-slate-700">{data.dossier.currentPosition}</p><p className="mt-5 border-t border-slate-100 pt-4 text-[10px] text-slate-400">آخر مراجعة: {formatDate(data.dossier.reviewedAt)}</p></Card>
        <Card className="rounded-[30px] border-amber-100 bg-[#fffdf7] p-6 shadow-sm"><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-800"><CircleAlert className="h-5 w-5" /></div><div><p className="text-[10px] font-black text-amber-800">لا نقفز فوق الدليل</p><h2 className="mt-1 text-xl font-black">ما يمنع الانتقال الآن؟</h2></div></div><div className="mt-5"><NumberedList items={data.dossier.dependencies} tone="amber" /></div></Card>
      </section> : null}

      {selectedProjectSection === "position" && data.dossier ? <section className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card className="rounded-[30px] border-slate-200 bg-white p-6 shadow-sm"><div className="mb-5 flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700"><Link2 className="h-5 w-5" /></div><div><p className="text-[10px] font-black text-slate-500">المسار الذي قطعه المشروع</p><h2 className="text-lg font-black">دورة الحياة الموثقة</h2></div></div><NumberedList items={data.dossier.lifecyclePhases} /></Card>
        <Card className="rounded-[30px] border-teal-100 bg-[#f6fbfa] p-6 shadow-sm"><div className="mb-5 flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-100 text-teal-800"><Sparkles className="h-5 w-5" /></div><div><p className="text-[10px] font-black text-teal-700">موضوعات لا تزال مفتوحة</p><h2 className="text-lg font-black">ما الذي يستحق الانتباه لاحقًا؟</h2></div></div>{data.dossier.openThreads.length ? <NumberedList items={data.dossier.openThreads} tone="teal" /> : <p className="rounded-2xl bg-white p-4 text-sm text-slate-500">لا توجد موضوعات مفتوحة مثبتة في الذاكرة المراجعة.</p>}</Card>
      </section> : null}

      {selectedProjectSection === "specialists" ? <ComoNextSpecialistDesks projectId={projectId} workFiles={data.workFiles} /> : null}

      {selectedProjectSection === "sources" ? <section className="mt-8">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-black text-[#216b66]">مصدر حقيقة واحد من دون نسخ السجلات</p>
            <h2 className="mt-1 text-2xl font-black">العقد والتسليم والتصميم ودورة المشروع</h2>
            <p className="mt-1 max-w-3xl text-sm leading-7 text-slate-500">هذه مرآة قراءة فقط لما هو مسجل في مصادر المشروع الحالية. لا تغيّر عقدًا أو موعدًا، ولا تنشئ إجراءً، ولا تعتبر «مقدم» مساويًا لـ«متحقق».</p>
          </div>
          <ReadOnlySourceBadge />
        </div>

        {!selectedProjectItem ? <div className="space-y-2">{[
          ["source:contracts", "العقود وتسليماتها", sourceRegister.contracts.length + sourceRegister.deliverables.length],
          ["source:scope", "نطاق الاستشاري والتصاريح", sourceRegister.consultantScope.currentRequirementSet ? 1 : 0],
          ["source:lifecycle", "دورة المشروع والامتثال", sourceRegister.lifecycle.services.length],
        ].map(([key, title, count]) => <button key={String(key)} type="button" onClick={() => setSelectedProjectItem(String(key))} className="group flex min-h-14 w-full items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-right shadow-sm transition hover:border-[#8fb7c2] hover:shadow-md"><span className="font-black text-slate-900">{title}</span><bdi className="text-sm font-black text-slate-400">{count}</bdi></button>)}</div> : <button type="button" onClick={() => setSelectedProjectItem(null)} className="mb-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm"><ArrowLeft className="h-4 w-4" />عناوين المصادر</button>}

        {selectedProjectItem?.startsWith("source:") ? <div className="grid gap-5 xl:grid-cols-2">
          {selectedProjectItem === "source:contracts" ? <Card className="rounded-[30px] border-sky-100 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-700"><FileSignature className="h-5 w-5" /></div><div><p className="text-[10px] font-black text-sky-700">السجل التعاقدي</p><h3 className="text-lg font-black">العقود وتسليماتها</h3></div></div>
              <Button variant="outline" size="sm" className="rounded-xl bg-white text-xs" onClick={() => navigate(`/contracts?projectId=${projectId}`)}>فتح المصدر <ExternalLink className="mr-1 h-3.5 w-3.5" /></Button>
            </div>
            <div className="mt-5 space-y-3">
              {sourceRegister.contracts.length ? sourceRegister.contracts.map((contract: any) => <div key={contract.id} className="rounded-2xl border border-slate-100 bg-[#fbfbf9] p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-black text-slate-900">{contract.title}</p><p className="mt-1 text-[10px] text-slate-500">{contract.contractTypeName || "نوع غير محدد"}{contract.contractNumber ? ` · ${contract.contractNumber}` : ""}</p></div><Badge variant="outline" className="rounded-full bg-white">{contractStatusLabels[contract.contractStatus] || contract.contractStatus}</Badge></div>{contract.partyA || contract.partyB ? <p className="mt-3 text-xs leading-6 text-slate-600">{[contract.partyA, contract.partyB].filter(Boolean).join(" ↔ ")}</p> : null}<div className="mt-3 flex flex-wrap gap-2 text-[10px] text-slate-500">{contract.startDate ? <span>البداية: {contract.startDate}</span> : null}{contract.endDate ? <span>النهاية: {contract.endDate}</span> : null}{contract.hasProtectedFile ? <span className="font-bold text-emerald-700">ملف مرفق</span> : <span>لا ملف مرفق</span>}</div></div>) : <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm text-slate-500">لا يوجد عقد مسجل لهذا المشروع في مصدر العقود.</div>}
            </div>
            <div className="mt-4 border-t border-slate-100 pt-4"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><ClipboardList className="h-4 w-4 text-emerald-700" /><p className="text-sm font-black">التسليمات والاستثناءات</p></div><Button variant="ghost" size="sm" className="h-8 text-xs text-[#216b66]" onClick={() => navigate(`/contract-deliverables?projectId=${projectId}`)}>فتح السجل</Button></div>{sourceRegister.deliverables.length ? <div className="mt-3 space-y-2">{sourceRegister.deliverables.slice(0, 5).map((item: any) => <div key={item.id} className="flex items-start justify-between gap-3 rounded-xl bg-slate-50 p-3"><div><p className="text-xs font-bold text-slate-800">{item.title}</p><p className="mt-1 text-[10px] text-slate-500">{item.contractTitle}{item.dueDate ? ` · ${item.dueDate}` : ""}</p></div><Badge variant="outline" className={item.isException ? "rounded-full border-rose-200 bg-rose-50 text-rose-700" : "rounded-full bg-white"}>{item.isOverdue ? "متأخر بحسب التاريخ" : item.status}</Badge></div>)}</div> : <p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-500">لا توجد تسليمات مسجلة؛ لا يفترض النظام وجودها.</p>}</div>
          </Card> : null}

          {selectedProjectItem === "source:scope" ? <Card className="rounded-[30px] border-violet-100 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-50 text-violet-700"><DraftingCompass className="h-5 w-5" /></div><div><p className="text-[10px] font-black text-violet-700">التعيين والتصميم</p><h3 className="text-lg font-black">نطاق الاستشاري والتصاريح</h3></div></div><Button variant="outline" size="sm" className="rounded-xl bg-white text-xs" onClick={() => navigate(`/consultant-appointment-pack?projectId=${projectId}`)}>فتح المصدر <ExternalLink className="mr-1 h-3.5 w-3.5" /></Button></div>
            {sourceRegister.consultantScope.currentRequirementSet ? <div className="mt-5 rounded-2xl border border-violet-100 bg-[#fbfaff] p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-black text-slate-900">{sourceRegister.consultantScope.currentRequirementSet.title}</p><p className="mt-1 text-[10px] text-slate-500">المراجعة {sourceRegister.consultantScope.currentRequirementSet.revisionNo} · {sourceRegister.consultantScope.currentRequirementSet.itemCount} بندًا · {sourceRegister.consultantScope.currentRequirementSet.requiredCount} مطلوبًا</p></div><Badge variant="outline" className={sourceRegister.consultantScope.currentRequirementSet.status === "APPROVED" ? "rounded-full border-emerald-200 bg-emerald-50 text-emerald-700" : "rounded-full border-amber-200 bg-amber-50 text-amber-800"}>{sourceRegister.consultantScope.currentRequirementSet.status === "APPROVED" ? "معتمد" : "مسودة في المصدر"}</Badge></div><div className="mt-3 flex flex-wrap gap-2">{sourceRegister.consultantScope.currentRequirementSet.workstreams.map((stream: any) => <span key={stream.workstream} className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-slate-600">{stream.workstream}: {stream.itemCount}</span>)}</div><p className="mt-3 text-[10px] text-slate-500">مسودات طلب العروض الداخلية: {sourceRegister.consultantScope.rfpDrafts.length} · لا إرسال تلقائي.</p></div> : <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm text-slate-500">لا توجد قائمة نطاق مسجلة لهذا المشروع.</div>}
            <div className="mt-4 border-t border-slate-100 pt-4"><div className="flex items-center gap-2"><FileCheck2 className="h-4 w-4 text-violet-700" /><p className="text-sm font-black">التصميم والتصاريح</p></div>{sourceRegister.permits ? <div className="mt-3 grid gap-2 sm:grid-cols-2">{[["المعماري", sourceRegister.permits.architecturalDesignStatus], ["الهندسي", sourceRegister.permits.engineeringDesignStatus], ["رخصة البناء", sourceRegister.permits.buildingPermitStatus], ["اعتماد البلدية", sourceRegister.permits.municipalityDesignApprovalStatus]].map(([label, value]) => <div key={label as string} className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-bold text-slate-400">{label}</p><p className="mt-1 text-xs font-black text-slate-700">{value || "غير مسجل"}</p></div>)}</div> : <p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-500">لا يوجد سجل تصميم وتصاريح لهذا المشروع؛ لم تُختلق حالة بديلة.</p>}</div>
          </Card> : null}

          {selectedProjectItem === "source:lifecycle" ? <Card className="rounded-[30px] border-emerald-100 bg-white p-6 shadow-sm xl:col-span-2">
            <div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700"><Route className="h-5 w-5" /></div><div><p className="text-[10px] font-black text-emerald-700">الدورة والامتثال والبرنامج</p><h3 className="text-lg font-black">موضع المشروع في السجل التشغيلي</h3></div></div><Button variant="outline" size="sm" className="rounded-xl bg-white text-xs" onClick={() => navigate(sourceRegister.lifecycle.sourcePath)}>فتح الجدول <ExternalLink className="mr-1 h-3.5 w-3.5" /></Button></div>
            {sourceRegister.lifecycle.services.length ? <div className="mt-5 grid gap-4 lg:grid-cols-[.9fr_1.1fr]"><div className="space-y-3"><div className="rounded-2xl border border-emerald-100 bg-[#f6fbfa] p-4"><p className="text-[10px] font-black text-emerald-700">المرحلة الحالية بحسب المصدر</p><p className="mt-2 text-lg font-black text-slate-900">{sourceRegister.lifecycle.currentStage?.stageName || sourceRegister.lifecycle.currentStage?.stageCode || "غير محددة"}</p><p className="mt-2 text-xs text-slate-500">{sourceRegister.lifecycle.services.length} خدمة مسجلة · {sourceRegister.lifecycle.documentSummary.reduce((sum: number, item: any) => sum + item.documentCount, 0)} مستندات مرحلة</p></div><div className="grid gap-2 sm:grid-cols-2">{sourceRegister.lifecycle.stages.map((stage: any) => <div key={stage.stageCode} className="rounded-xl border border-slate-100 bg-slate-50 p-3"><div className="flex items-center justify-between gap-2"><p className="text-xs font-bold text-slate-800">{stage.stageName || stage.stageCode}</p><span className="text-[10px] text-slate-500">{stage.completedCount}/{stage.serviceCount}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${stage.serviceCount ? Math.round((stage.completedCount / stage.serviceCount) * 100) : 0}%` }} /></div></div>)}</div></div><div><div className="mb-3 flex items-center justify-between gap-2"><div className="flex items-center gap-2"><TimerReset className="h-4 w-4 text-amber-700" /><p className="text-sm font-black">استثناءات تحتاج انتباهًا</p></div><Badge variant="outline" className="rounded-full bg-white">{sourceRegister.lifecycle.scheduleExceptions.length}</Badge></div><div className="space-y-2">{sourceRegister.lifecycle.scheduleExceptions.length ? sourceRegister.lifecycle.scheduleExceptions.slice(0, 8).map((service: any) => <div key={service.id} className="rounded-xl border border-slate-100 bg-[#fbfbf9] p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-xs font-bold text-slate-800">{service.serviceName || service.serviceCode}</p><p className="mt-1 text-[10px] text-slate-500">{service.plannedDueDate ? `الاستحقاق المسجل: ${service.plannedDueDate}` : "لا تاريخ استحقاق"}{service.externalParty ? ` · ${service.externalParty}` : ""}</p></div><Badge variant="outline" className={service.isOverdue ? "rounded-full border-rose-200 bg-rose-50 text-rose-700" : "rounded-full border-amber-200 bg-amber-50 text-amber-800"}>{service.isOverdue ? "متأخر بحسب التاريخ" : lifecycleStatusLabels[service.operationalStatus] || service.operationalStatus}</Badge></div>{service.mandatoryGapCount ? <p className="mt-2 text-[10px] font-bold text-rose-700">{service.mandatoryGapCount} متطلب إلزامي غير مكتمل في المصدر</p> : null}</div>) : <div className="rounded-xl bg-slate-50 p-4 text-center text-xs text-slate-500">لا توجد استثناءات مسجلة.</div>}</div></div></div> : <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm text-slate-500">لا توجد خدمات دورة حياة مسجلة لهذا المشروع؛ الملف لا يفترض مرحلة من تلقاء نفسه.</div>}
          </Card> : null}
        </div> : null}
      </section> : null}

      {selectedProjectSection === "work-files" ? <section className="mt-8">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><p className="text-[11px] font-black text-[#1f6478]">غرف العمل داخل المشروع</p><h2 className="mt-1 text-2xl font-black">ملفات العمل النشطة</h2><p className="mt-1 text-sm text-slate-500">كل موضوع يحتفظ بسؤاله وقراراته وإجراءاته ومراسلاته واجتماعاته، لكنه يبقى جزءًا من هذا المشروع.</p></div><Badge variant="outline" className="rounded-full bg-white"><bdi>{activeWorkFiles.length}</bdi> نشط</Badge></div>
        {activeWorkFiles.length ? <div className="space-y-2">{activeWorkFiles.map((file: any) => <button key={file.id} type="button" onClick={() => openWorkFile(file.id)} className="group flex min-h-14 w-full items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-right shadow-sm transition hover:border-[#8fb7c2] hover:shadow-md"><span className="min-w-0 flex-1 text-sm font-black text-slate-900">{file.title}</span><ChevronLeft className="h-5 w-5 shrink-0 text-slate-300 group-hover:text-[#1f6478]" /></button>)}</div> : <Card className="rounded-2xl border-dashed border-slate-300 bg-white/70 p-6 text-center text-sm text-slate-500">لا توجد ملفات عمل نشطة في هذا المشروع.</Card>}
      </section> : null}

      {selectedProjectSection === "work-files" && data.decisions.length ? <section className="mt-8"><h2 className="mb-4 text-xl font-black">سجل القرارات</h2><div className="space-y-2">{data.decisions.map((decision: any) => <button key={decision.id} type="button" onClick={() => openFocusedOfficeRecord("decisions", "decision", decision.workFileId, decision.id)} className="group flex min-h-14 w-full items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-right shadow-sm transition hover:border-rose-200"><span className="min-w-0 flex-1 text-sm font-black text-slate-900">{decision.title}</span><ChevronLeft className="h-5 w-5 shrink-0 text-slate-300 group-hover:text-rose-600" /></button>)}</div></section> : null}
      {selectedProjectSection === "work-files" && archivedWorkFiles.length ? <section className="mt-8"><h2 className="mb-4 text-xl font-black">ملفات مؤرشفة أو مغلقة</h2><div className="space-y-2">{archivedWorkFiles.map((file: any) => <button key={file.id} type="button" onClick={() => openWorkFile(file.id)} className="group flex min-h-14 w-full items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-right shadow-sm transition hover:border-slate-300"><span className="min-w-0 flex-1 text-sm font-black text-slate-700">{file.title}</span><ChevronLeft className="h-5 w-5 shrink-0 text-slate-300" /></button>)}</div></section> : null}

      {selectedProjectSection === "memory" ? <section className="mt-8 max-w-4xl">
        {!selectedMemory ? <>
          <h2 className="mb-4 text-xl font-black">ذاكرة المشروع</h2>
          <div className="space-y-2">{data.reviewedMemory.length ? data.reviewedMemory.map((entry: any) => <button key={entry.id} type="button" onClick={() => setSelectedProjectItem(`memory:${entry.id}`)} className="group flex min-h-14 w-full items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-right shadow-sm transition hover:border-violet-200 hover:shadow-md"><span className="min-w-0 flex-1 text-sm font-black leading-6 text-slate-900">{entry.title}</span><ChevronLeft className="h-5 w-5 shrink-0 text-slate-300 group-hover:text-violet-700" /></button>) : <p className="rounded-2xl bg-white p-5 text-center text-sm text-slate-500">لم تُضف ذاكرة مراجعة لهذا المشروع بعد.</p>}</div>
        </> : <>
          <button type="button" onClick={() => setSelectedProjectItem(null)} className="mb-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm"><ArrowLeft className="h-4 w-4" />عناوين الذاكرة</button>
          <Card className="rounded-[30px] border-violet-100 bg-white p-6 shadow-sm"><div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className="rounded-full border-violet-100 bg-white text-violet-700">{selectedMemory.entryType === "fact" ? "حقيقة وثائقية" : selectedMemory.entryType === "constraint" ? "قيد" : selectedMemory.entryType === "relationship" ? "علاقة" : "سياق"}</Badge><Badge variant="outline" className="rounded-full border-emerald-100 bg-white text-emerald-700">ثقة {selectedMemory.confidence === "high" ? "عالية" : "متوسطة"}</Badge></div><h2 className="mt-5 text-2xl font-black leading-9 text-slate-950">{selectedMemory.title}</h2><p className="mt-4 whitespace-pre-wrap text-sm leading-8 text-slate-700">{selectedMemory.body}</p>{selectedMemory.evidenceRefs.length ? <div className="mt-5 border-t border-slate-100 pt-4"><h3 className="text-sm font-black text-[#1f6478]">مراجع الإثبات</h3><ul className="mt-3 space-y-2 text-xs leading-6 text-slate-500">{selectedMemory.evidenceRefs.map((ref: string) => <li key={ref} className="break-words rounded-xl bg-slate-50 px-3 py-2">{ref}</li>)}</ul></div> : null}</Card>
        </>}
      </section> : null}

      {selectedProjectSection === "parties" ? <section className="mt-8 max-w-4xl">
        {!selectedParty ? <><h2 className="mb-4 text-xl font-black">الأطراف</h2><div className="space-y-2">{data.parties.length ? data.parties.map((party: any) => <button key={party.id} type="button" onClick={() => setSelectedProjectItem(`party:${party.id}`)} className="group flex min-h-14 w-full items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-right shadow-sm transition hover:border-emerald-200 hover:shadow-md"><span className="min-w-0 flex-1 text-sm font-black text-slate-900">{party.displayName}</span><ChevronLeft className="h-5 w-5 shrink-0 text-slate-300 group-hover:text-emerald-700" /></button>) : <p className="rounded-2xl bg-white p-5 text-center text-sm text-slate-500">لا توجد أطراف مرتبطة.</p>}</div></> : <><button type="button" onClick={() => setSelectedProjectItem(null)} className="mb-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm"><ArrowLeft className="h-4 w-4" />عناوين الأطراف</button><Card className="rounded-[30px] border-emerald-100 bg-white p-6 shadow-sm"><div className="flex items-center justify-between gap-3"><h2 className="text-2xl font-black text-slate-950">{selectedParty.displayName}</h2><Badge variant="outline" className={selectedParty.relationshipStatus === "active" ? "rounded-full border-emerald-100 bg-emerald-50 text-emerald-700" : "rounded-full border-slate-200 bg-slate-100 text-slate-500"}>{selectedParty.relationshipStatus === "active" ? "نشط" : "غير نشط"}</Badge></div><p className="mt-4 text-sm font-bold text-slate-600">{selectedParty.roleCode}</p>{selectedParty.primaryContactName ? <p className="mt-2 text-sm text-slate-500">{selectedParty.primaryContactName}</p> : null}</Card></>}
      </section> : null}

      {selectedProjectSection === "communications" ? <section className="mt-8 max-w-4xl pb-10">
        <div className="space-y-2">{data.communications.length ? data.communications.map((item: any) => <button key={item.id} type="button" onClick={() => openFocusedOfficeRecord("communications", "communication", item.workFileId, item.id)} className="group flex min-h-14 w-full items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-right shadow-sm transition hover:border-sky-200 hover:shadow-md"><span className="min-w-0 flex-1 text-sm font-black text-slate-900">{item.subject}</span><ChevronLeft className="h-5 w-5 shrink-0 text-slate-300 group-hover:text-sky-700" /></button>) : <p className="rounded-2xl bg-white p-5 text-center text-sm text-slate-500">لا توجد مراسلات مرتبطة.</p>}</div>
      </section> : null}
      {selectedProjectSection === "meetings" ? <section className="mt-8 max-w-4xl pb-10"><div className="space-y-2">{data.meetings.length ? data.meetings.map((item: any) => <button key={item.id} type="button" onClick={() => openFocusedOfficeRecord("meetings", "meeting", item.workFileId, item.id)} className="group flex min-h-14 w-full items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-right shadow-sm transition hover:border-teal-200 hover:shadow-md"><span className="min-w-0 flex-1 text-sm font-black text-slate-900">{item.title}</span><ChevronLeft className="h-5 w-5 shrink-0 text-slate-300 group-hover:text-teal-700" /></button>) : <p className="rounded-2xl bg-white p-5 text-center text-sm text-slate-500">لا توجد اجتماعات مرتبطة.</p>}</div></section> : null}
    </main>
  </div>;
}
