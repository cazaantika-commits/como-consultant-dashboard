import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { default as ArrowRight } from "lucide-react/dist/esm/icons/arrow-right.js";
import { default as BadgeCheck } from "lucide-react/dist/esm/icons/badge-check.js";
import { default as CircleAlert } from "lucide-react/dist/esm/icons/circle-alert.js";
import { default as CircleDashed } from "lucide-react/dist/esm/icons/circle-dashed.js";
import { default as ExternalLink } from "lucide-react/dist/esm/icons/external-link.js";
import { default as Loader2 } from "lucide-react/dist/esm/icons/loader-circle.js";
import { default as Rocket } from "lucide-react/dist/esm/icons/rocket.js";
import { default as ShieldCheck } from "lucide-react/dist/esm/icons/shield-check.js";

type GateStatus = "complete" | "partial" | "missing";

const STATUS_STYLE: Record<GateStatus, { label: string; icon: typeof BadgeCheck; className: string }> = {
  complete: { label: "مكتمل", icon: BadgeCheck, className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  partial: { label: "قيد الاستكمال", icon: CircleAlert, className: "bg-amber-50 text-amber-700 border-amber-200" },
  missing: { label: "لم يبدأ", icon: CircleDashed, className: "bg-slate-50 text-slate-600 border-slate-200" },
};

export default function ProjectLaunchGatePage({ embedded = false }: { embedded?: boolean }) {
  const [, navigate] = useLocation();
  const { data: projects = [], isLoading: isLoadingProjects } = trpc.projects.list.useQuery();
  const [projectId, setProjectId] = useState<number | null>(null);
  const gateQuery = trpc.projectLaunchGate.get.useQuery(
    { projectId: projectId ?? 0 },
    { enabled: projectId !== null },
  );
  const gate = gateQuery.data;

  return (
    <div className={embedded ? "w-full min-w-0 max-w-full overflow-x-hidden px-4 py-6 sm:px-6 sm:py-8" : "min-h-screen w-full max-w-full overflow-x-hidden bg-background"} dir="rtl">
      {!embedded && (
        <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/development-phases")} className="gap-1.5">
              <ArrowRight className="w-4 h-4" /> العودة إلى جولة التطوير
            </Button>
            <div className="h-5 w-px bg-border" />
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-600 to-teal-600 flex items-center justify-center"><Rocket className="w-3.5 h-3.5 text-white" /></div>
              <h1 className="text-sm font-bold text-foreground">بوابة انطلاق المشروع</h1>
            </div>
          </div>
        </header>
      )}

      <main className={embedded ? "w-full min-w-0" : "w-full min-w-0 max-w-6xl mx-auto px-4 py-6 sm:px-6 sm:py-9"}>
        <section className="rounded-3xl border border-cyan-200/70 bg-gradient-to-l from-cyan-50/80 via-white to-teal-50/60 p-6 md:p-8 shadow-sm">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white/80 px-3 py-1 text-xs font-bold text-cyan-800"><ShieldCheck className="w-3.5 h-3.5" /> قراءة فقط من المصادر المعتمدة</div>
              <h2 className="mt-3 text-2xl font-extrabold text-foreground">هل المشروع جاهز للانتقال إلى الخطوة التالية؟</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">هذه البوابة لا تحفظ ولا تنقل ولا تغير أي معلومة. إنها تجمع فقط ما هو موجود في بطاقة المشروع، المعرفة، المراحل، العروض والعقود لتوضح لك القرار التالي.</p>
            </div>
            <div className="w-full md:w-80">
              <label className="mb-2 block text-xs font-bold text-foreground">اختر المشروع لمراجعة جاهزيته</label>
              <select
                value={projectId ?? ""}
                onChange={(event) => setProjectId(event.target.value ? Number(event.target.value) : null)}
                disabled={isLoadingProjects}
                className="h-11 w-full rounded-xl border border-cyan-300 bg-white px-3 text-sm font-semibold text-foreground outline-none ring-offset-background focus:ring-2 focus:ring-cyan-500"
              >
                <option value="">— اختر مشروعًا —</option>
                {projects.map((project: any) => <option key={project.id} value={project.id}>{project.name}</option>)}
              </select>
            </div>
          </div>
        </section>

        {!projectId && !isLoadingProjects && (
          <div className="mt-8 rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">اختر مشروعًا أولًا. ستظهر البوابات والمصادر كما هي، من دون إنشاء سجل جديد أو تعديل أي حساب.</div>
        )}

        {gateQuery.isLoading && (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-7 h-7 animate-spin text-cyan-600" /></div>
        )}

        {gate && (
          <section className="mt-6 space-y-5">
            <div className={`rounded-2xl border p-5 ${gate.readyForTender ? "border-emerald-200 bg-emerald-50/50" : "border-amber-200 bg-amber-50/50"}`}>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs font-bold text-muted-foreground">القرار التالي للمشروع: {gate.project.name}</p>
                  <h3 className="mt-1 text-lg font-extrabold text-foreground">{gate.nextDecision}</h3>
                </div>
                <Button onClick={() => navigate(gate.nextActionHref)} className="gap-2 bg-slate-900 text-white hover:bg-slate-800"><ExternalLink className="w-4 h-4" /> افتح المصدر المناسب</Button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {gate.gates.map((item: any, index: number) => {
                const style = STATUS_STYLE[item.status as GateStatus];
                const StatusIcon = style.icon;
                return (
                  <article key={item.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm font-extrabold text-slate-600">{index + 1}</div>
                        <div><h4 className="font-extrabold text-foreground">{item.title}</h4><p className="mt-1 text-xs leading-5 text-muted-foreground">{item.description}</p></div>
                      </div>
                      <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-bold ${style.className}`}><StatusIcon className="w-3.5 h-3.5" />{style.label}</span>
                    </div>
                    <p className="mt-4 rounded-lg bg-muted/45 px-3 py-2 text-xs font-semibold text-foreground">{item.detail}</p>
                    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5">
                      <p className="text-[11px] font-extrabold text-slate-700">سبب الحالة</p>
                      <p className="mt-1 text-xs leading-5 text-slate-600">{item.reason}</p>
                    </div>
                    <div className="mt-2 rounded-xl border border-cyan-100 bg-cyan-50/60 px-3 py-2.5">
                      <p className="text-[11px] font-extrabold text-cyan-800">الإجراء التالي</p>
                      <p className="mt-1 text-xs leading-5 text-cyan-950/80">{item.nextAction}</p>
                    </div>
                    <div className="mt-3 space-y-1.5">
                      {item.items.map((check: any) => <div key={check.label} className="flex items-center gap-2 text-xs text-muted-foreground"><span className={`h-2 w-2 rounded-full ${check.present ? "bg-emerald-500" : "bg-slate-300"}`} />{check.label}</div>)}
                    </div>
                    <button onClick={() => navigate(item.href)} className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-cyan-700 hover:text-cyan-900"><ExternalLink className="w-3.5 h-3.5" /> افتح المصدر: {item.sourceLabel}</button>
                  </article>
                );
              })}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
