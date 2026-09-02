import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { default as ArrowRight } from "lucide-react/dist/esm/icons/arrow-right.js";
import { default as BookOpenCheck } from "lucide-react/dist/esm/icons/book-open-check.js";
import { default as ClipboardList } from "lucide-react/dist/esm/icons/clipboard-list.js";
import { default as FileCheck2 } from "lucide-react/dist/esm/icons/file-check-2.js";
import { default as Loader2 } from "lucide-react/dist/esm/icons/loader-circle.js";
import { default as LockKeyhole } from "lucide-react/dist/esm/icons/lock-keyhole.js";
import { default as MapPinned } from "lucide-react/dist/esm/icons/map-pinned.js";
import { default as Route } from "lucide-react/dist/esm/icons/route.js";
import { default as ListChecks } from "lucide-react/dist/esm/icons/list-checks.js";
import { default as Send } from "lucide-react/dist/esm/icons/send.js";

function SourceTag({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600">المصدر: {children}</span>;
}

export default function ConsultantAppointmentPackPage() {
  const [, navigate] = useLocation();
  const [projectId, setProjectId] = useState<number | null>(null);
  const { data: projects = [], isLoading: isLoadingProjects } = trpc.projects.list.useQuery();
  const packQuery = trpc.consultantAppointmentPack.get.useQuery({ projectId: projectId ?? 0 }, { enabled: projectId !== null });
  const reviewQuery = trpc.consultantProcurement.getPackReview.useQuery({ projectId: projectId ?? 0 }, { enabled: projectId !== null });
  const draftsQuery = trpc.consultantProcurement.listRfpDrafts.useQuery({ projectId: projectId ?? 0 }, { enabled: projectId !== null });
  const utils = trpc.useUtils();
  const createDraft = trpc.consultantProcurement.createRfpDraft.useMutation({ onSuccess: () => { if (projectId) { utils.consultantProcurement.listRfpDrafts.invalidate({ projectId }); } } });
  const pack = packQuery.data;

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-background" dir="rtl">
      <header className="sticky top-0 z-50 border-b border-border bg-card/90 backdrop-blur-sm">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4 sm:px-6">
          <Button variant="ghost" size="sm" onClick={() => navigate("/consultant-portal")} className="gap-1.5"><ArrowRight className="h-4 w-4" /> العودة إلى مسار الاستشاريين</Button>
          <div className="h-5 w-px bg-border" />
          <div className="flex items-center gap-2"><div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-600"><ClipboardList className="h-3.5 w-3.5 text-white" /></div><h1 className="text-sm font-bold text-foreground">حزمة تكليف الاستشاري</h1></div>
        </div>
      </header>

      <main className="mx-auto w-full min-w-0 max-w-6xl px-4 py-6 sm:px-6 sm:py-9">
        <section className="rounded-3xl border border-violet-200/80 bg-gradient-to-l from-violet-50 via-white to-fuchsia-50/50 p-6 shadow-sm md:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl"><div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white/90 px-3 py-1 text-xs font-bold text-violet-800"><LockKeyhole className="h-3.5 w-3.5" /> معاينة داخلية من مصادر معتمدة</div><h2 className="mt-3 text-2xl font-extrabold text-foreground">موجز موحد قبل طلب عروض الاستشاريين</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">تجمع هذه الحزمة حقائق المشروع، مرجع السوق، البرنامج الأولي، ونطاق الخدمات الموجود في المصفوفة. لا ترسل بريدًا، ولا تنشئ عرضًا أو عقدًا، ولا تعدل أي مصدر.</p></div>
            <div className="w-full md:w-80"><label className="mb-2 block text-xs font-bold text-foreground">اختر المشروع لإعداد المعاينة</label><select value={projectId ?? ""} onChange={(event) => setProjectId(event.target.value ? Number(event.target.value) : null)} disabled={isLoadingProjects} className="h-11 w-full rounded-xl border border-violet-300 bg-white px-3 text-sm font-semibold text-foreground outline-none focus:ring-2 focus:ring-violet-500"><option value="">— اختر مشروعًا —</option>{projects.map((project: any) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></div>
          </div>
        </section>

        {!projectId && !isLoadingProjects && <div className="mt-8 rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">اختر مشروعًا أولًا. ستظهر حزمة قراءة فقط، ولا ينشأ أي ملف أو سجل جديد من هذه الصفحة.</div>}
        {packQuery.isLoading && <div className="flex justify-center py-20"><Loader2 className="h-7 w-7 animate-spin text-violet-600" /></div>}
        {pack && <section className="mt-6 space-y-5">
          <div className="rounded-2xl border border-violet-200 bg-violet-50/50 p-5"><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><p className="text-xs font-bold text-violet-700">معاينة حزمة التكليف</p><h3 className="mt-1 text-xl font-extrabold text-foreground">{String(pack.project.name)}</h3></div><div className="flex flex-wrap gap-2"><span className={`rounded-full px-3 py-1 text-xs font-bold ${pack.readiness.marketReady ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>مرجع السوق {pack.readiness.marketReady ? "جاهز" : "يحتاج استكمال"}</span><span className={`rounded-full px-3 py-1 text-xs font-bold ${pack.readiness.programReady ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>البرنامج {pack.readiness.programReady ? "جاهز" : "يحتاج استكمال"}</span><span className={`rounded-full px-3 py-1 text-xs font-bold ${pack.readiness.scopeReady ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>النطاق {pack.readiness.scopeReady ? "جاهز" : "يحتاج استكمال"}</span></div></div></div>

          <div className="grid gap-5 lg:grid-cols-2">
            <article className="rounded-2xl border border-border bg-card p-5 shadow-sm"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><MapPinned className="h-4 w-4 text-fuchsia-700" /><h4 className="font-extrabold text-foreground">1. تعريف المشروع</h4></div><SourceTag>بطاقة المشروع وخازن</SourceTag></div><dl className="mt-4 grid gap-3 sm:grid-cols-2">{pack.sections.projectBrief.map((item: any) => <div key={item.label} className="rounded-xl bg-slate-50 px-3 py-2.5"><dt className="text-[11px] font-bold text-muted-foreground">{item.label}</dt><dd className="mt-1 text-sm font-bold text-foreground">{String(item.value)}</dd></div>)}</dl></article>
            <article className="rounded-2xl border border-border bg-card p-5 shadow-sm"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><BookOpenCheck className="h-4 w-4 text-cyan-700" /><h4 className="font-extrabold text-foreground">2. مرجع قرار السوق</h4></div><SourceTag>المعرفة والتحليل</SourceTag></div><p className="mt-4 rounded-xl bg-cyan-50 px-3 py-3 text-sm font-bold text-cyan-950">{pack.sections.market.search ?? "لم تحفظ فلترة سوق للمشروع بعد."}</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-slate-50 px-3 py-2.5 text-xs"><span className="font-bold text-muted-foreground">الدليل الموثق</span><p className="mt-1 font-extrabold text-foreground">{pack.sections.market.verifiedEvidenceCount} سجل</p></div><div className="rounded-xl bg-slate-50 px-3 py-2.5 text-xs"><span className="font-bold text-muted-foreground">قرار السوق</span><p className="mt-1 font-extrabold text-foreground">{pack.sections.market.approved ? "معتمد" : "غير معتمد"}</p></div></div>{pack.sections.market.note && <p className="mt-3 text-xs leading-5 text-muted-foreground">ملاحظة الاعتماد: {pack.sections.market.note}</p>}</article>
            <article className="rounded-2xl border border-border bg-card p-5 shadow-sm"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><Route className="h-4 w-4 text-amber-700" /><h4 className="font-extrabold text-foreground">3. البرنامج الأولي</h4></div><SourceTag>جولة مراحل التطوير</SourceTag></div><p className="mt-4 text-sm leading-6 text-muted-foreground">الحزمة تشير إلى وجود برنامج أولي، ولا تضع تواريخ جديدة أو تعدل تواريخ المسار.</p><div className="mt-3 flex flex-wrap gap-2"><span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-900">{pack.sections.program.activeLifecycleStages} مراحل نشطة</span><span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-900">{pack.sections.program.plannedServices} خدمة بمواعيد مخططة</span></div></article>
            <article className="rounded-2xl border border-border bg-card p-5 shadow-sm"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><FileCheck2 className="h-4 w-4 text-emerald-700" /><h4 className="font-extrabold text-foreground">4. نطاق التصميم المطلوب</h4></div><SourceTag>نطاق المشروع المستقل</SourceTag></div>{pack.sections.scope.itemCount > 0 ? <><p className="mt-3 text-sm font-bold text-foreground">{pack.sections.scope.itemCount} بند تصميم مختار لهذا المشروع</p><p className="mt-1 text-xs leading-5 text-muted-foreground">هذه معاينة لاختيارات المشروع من المكتبة الشاملة، ولا تعدل البنود أو نطاق أي مشروع آخر.</p><div className="mt-3 space-y-2">{pack.sections.scope.sections.slice(0, 3).map((section: any) => <div key={section.label} className="rounded-xl bg-emerald-50/60 px-3 py-2"><p className="text-xs font-extrabold text-emerald-900">{section.label}</p><p className="mt-1 text-xs leading-5 text-emerald-950/75">{section.items.slice(0, 4).map((item: any) => item.label).join(" · ")}{section.items.length > 4 ? " …" : ""}</p></div>)}</div></> : <p className="mt-4 rounded-xl bg-amber-50 px-3 py-3 text-sm font-bold text-amber-900">لم تُحدد بنود نطاق التصميم لهذا المشروع بعد. ارجع إلى مسار المشروع واختر بنود التصميم المطلوبة من المكتبة الشاملة.</p>}</article>
          </div>

          <section className="rounded-2xl border border-dashed border-violet-300 bg-violet-50/40 p-5"><p className="text-sm font-extrabold text-violet-950">ما الذي لا تفعله هذه المعاينة؟</p><p className="mt-2 text-sm leading-6 text-violet-950/75">لا ترسل الحزمة إلى أي مكتب، ولا تنشئ طلب عروض أو عقدًا، ولا تختار استشاريًا. وظيفتها فقط أن تكشف أن نطاق التكليف القادم قائم على مصادر معتمدة، ويمكن مراجعته قبل أي إصدار خارجي.</p></section>
          {reviewQuery.data && <section className="rounded-2xl border border-border bg-card p-5 shadow-sm"><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div className="flex items-center gap-2"><ListChecks className="h-5 w-5 text-violet-700" /><div><h4 className="font-extrabold text-foreground">قائمة مراجعة الحزمة قبل طلب العروض</h4><p className="mt-1 text-xs text-muted-foreground">تقرأ هذه القائمة مصادرها ولا تحفظ أي تعديل فيها.</p></div></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${reviewQuery.data.complete ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>{reviewQuery.data.complete ? "الحزمة جاهزة لمسودة طلب عروض" : "تحتاج استكمال"}</span></div><div className="mt-4 grid gap-3 md:grid-cols-2">{reviewQuery.data.items.map((item: any) => <div key={item.key} className={`rounded-xl border p-3 ${item.complete ? "border-emerald-200 bg-emerald-50/50" : "border-amber-200 bg-amber-50/50"}`}><p className="text-sm font-bold text-foreground">{item.complete ? "✓" : "○"} {item.label}</p><p className="mt-1 text-[11px] font-bold text-muted-foreground">المصدر: {item.source}</p>{!item.complete && <p className="mt-2 text-xs leading-5 text-amber-900">الإجراء: {item.action}</p>}</div>)}</div><div className="mt-5 flex flex-wrap items-center gap-3 border-t border-border pt-4"><Button disabled={!reviewQuery.data.complete || createDraft.isPending} onClick={() => createDraft.mutate({ projectId })} className="gap-1.5 bg-violet-700 hover:bg-violet-800"><Send className="h-4 w-4" /> إنشاء مسودة طلب عروض داخلية</Button><Button variant="outline" onClick={() => navigate("/consultant-proposals")}>العودة إلى قائمة نطاقات المشاريع والعروض</Button><p className="text-xs text-muted-foreground">{draftsQuery.data?.length ? `يوجد ${draftsQuery.data.length} مسودة داخلية. لم يُرسل أي طلب.` : "لن يُرسل أي طلب أو دعوة تلقائيًا."}</p></div>{createDraft.data && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-muted-foreground">{createDraft.data.message}</p>}</section>}
        </section>}
      </main>
    </div>
  );
}
