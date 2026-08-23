import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { default as ArrowLeft } from "lucide-react/dist/esm/icons/arrow-left.js";
import { default as CheckCircle2 } from "lucide-react/dist/esm/icons/circle-check.js";
import { default as AlertTriangle } from "lucide-react/dist/esm/icons/triangle-alert.js";
import { default as FileText } from "lucide-react/dist/esm/icons/file-text.js";
import { default as Sparkles } from "lucide-react/dist/esm/icons/sparkles.js";
import { default as Clock } from "lucide-react/dist/esm/icons/clock.js";

type StageRecord = {
  stageNumber: number;
  stageStatus: string;
  stageDataJson: string | null;
};

const UNIT_LABELS: Record<string, string> = {
  studio: "استديو",
  oneBr: "غرفة وصالة",
  twoBr: "غرفتان وصالة",
  threeBr: "ثلاث غرف",
  small: "مساحة صغيرة",
  medium: "مساحة متوسطة",
  large: "مساحة كبيرة",
};

const SCENARIOS = [
  { key: "base", label: "الأساسي", accent: "border-sky-300", wash: "bg-sky-50/70", text: "text-sky-800" },
  { key: "conservative", label: "المتحفّظ", accent: "border-amber-300", wash: "bg-amber-50/70", text: "text-amber-800" },
  { key: "optimistic", label: "المتفائل", accent: "border-emerald-300", wash: "bg-emerald-50/70", text: "text-emerald-800" },
] as const;

function readJson(value: string | null | undefined): Record<string, any> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function formatNumber(value: unknown, suffix = "") {
  const number = Number(value || 0);
  if (!Number.isFinite(number) || number <= 0) return "—";
  return `${Math.round(number).toLocaleString("en-US")}${suffix}`;
}

function StageReadiness({ ready, title, detail }: { ready: boolean; title: string; detail: string }) {
  const Icon = ready ? CheckCircle2 : Clock;
  return (
    <div className={`flex items-start gap-3 rounded-xl border p-3 ${ready ? "border-emerald-200 bg-emerald-50/45" : "border-slate-200 bg-slate-50"}`}>
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${ready ? "text-emerald-600" : "text-slate-400"}`} />
      <div className="min-w-0">
        <p className="text-sm font-bold text-slate-800">{title}</p>
        <p className="mt-0.5 text-xs leading-5 text-slate-600">{detail}</p>
      </div>
    </div>
  );
}

export default function MarketDecisionTab({ projectId, onOpenResearch }: { projectId: number | null; onOpenResearch: () => void }) {
  const projectQuery = trpc.projects.getById.useQuery(projectId || 0, { enabled: !!projectId });
  const stagesQuery = trpc.joelleEngine.getStages.useQuery(projectId || 0, { enabled: !!projectId });

  const decision = useMemo(() => {
    const stages = (stagesQuery.data || []) as StageRecord[];
    const getStage = (number: number) => stages.find((stage) => stage.stageNumber === number);
    const stage6 = getStage(6);
    const stage7 = getStage(7);
    const stage3 = getStage(3);
    const stage4 = getStage(4);
    const product = readJson(stage6?.stageDataJson);
    const pricing = readJson(stage7?.stageDataJson);

    return {
      product,
      pricing,
      marketResearchReady: stage3?.stageStatus === "completed" && stage4?.stageStatus === "completed",
      productReady: stage6?.stageStatus === "completed",
      pricingReady: stage7?.stageStatus === "completed",
    };
  }, [stagesQuery.data]);

  if (!projectId) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-16 text-center">
        <Sparkles className="mx-auto mb-3 h-9 w-9 text-slate-300" />
        <p className="text-sm font-bold text-slate-700">اختر مشروعًا لفتح قرار السوق</p>
        <p className="mt-1 text-xs text-slate-500">تظهر هنا الحقائق والتحليل والتوصية في مسار واحد قبل أي اعتماد.</p>
      </div>
    );
  }

  const project = projectQuery.data as any;
  const factsReady = Boolean(project && (Number(project.gfaSqft) > 0 || Number(project.manualBuaSqft) > 0 || Number(project.plotAreaSqft) > 0));
  const unitMix = decision.product.unitMix || {};
  const retailMix = decision.product.retailMix || {};
  const unitRows = [
    ...Object.entries(unitMix),
    ...Object.entries(retailMix),
  ].filter(([, value]: [string, any]) => Number(value?.pct || 0) > 0 || Number(value?.avgSize || 0) > 0);
  const paymentPlan = decision.pricing.paymentPlan || {};
  const hasPaymentPlan = [paymentPlan.booking, paymentPlan.construction, paymentPlan.handover, paymentPlan.deferred]
    .some((item) => Number(item?.pct || 0) > 0);

  return (
    <div className="mx-auto max-w-7xl space-y-4" dir="rtl">
      <section className="rounded-2xl border border-teal-200 bg-gradient-to-l from-teal-50/85 via-white to-amber-50/65 p-5 shadow-[0_8px_24px_rgba(15,118,110,0.07)]">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-700 text-white shadow-sm">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-teal-700">المعرفة والتحليل · مسودة قرار</p>
              <h2 className="mt-1 text-xl font-bold text-slate-900">قرار السوق للمشروع</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
                اجمع الحقائق والدليل والتوصية في مكان واحد، ثم راجعها قبل اعتماد أي قيمة تشغيلية أو مالية.
              </p>
            </div>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900 lg:max-w-xs">
            <span className="font-bold">حماية المرحلة الأولى:</span> هذه الشاشة للقراءة والمراجعة فقط؛ لا تكتب تلقائيًا في التسعير أو التدفقات النقدية.
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-5">
            <div className="mb-4 flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900">جاهزية القرار</h3>
                <p className="mt-1 text-xs text-slate-500">لا يعني اكتمال المحرك أن التوصية معتمدة؛ بل أنها جاهزة للمراجعة.</p>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{project?.name || "المشروع المحدد"}</span>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <StageReadiness ready={factsReady} title="حقائق المشروع" detail={factsReady ? "المساحات أو الأرض متاحة للقراءة." : "أكمل بطاقة المشروع أولًا."} />
              <StageReadiness ready={decision.marketResearchReady} title="دليل السوق" detail={decision.marketResearchReady ? "اكتمل تحليل السوق والمنافسين المساند." : "لا يزال الدليل التحليلي غير مكتمل."} />
              <StageReadiness ready={decision.productReady && decision.pricingReady} title="مسودة التوصية" detail={decision.productReady && decision.pricingReady ? "توجد توصية للمنتج والتسعير." : "لا توجد توصية مكتملة بعد."} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-rose-600" />
              <h3 className="font-bold text-slate-900">هوية المشروع</h3>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
              <div><dt className="text-slate-500">المنطقة</dt><dd className="mt-1 font-bold text-slate-800">{project?.community || "غير محدد"}</dd></div>
              <div><dt className="text-slate-500">نوع المشروع</dt><dd className="mt-1 font-bold text-slate-800">{project?.projectType || "غير محدد"}</dd></div>
              <div><dt className="text-slate-500">GFA</dt><dd className="mt-1 font-bold text-slate-800">{formatNumber(project?.gfaSqft, " قدم²")}</dd></div>
              <div><dt className="text-slate-500">رقم القطعة</dt><dd className="mt-1 font-bold text-slate-800">{project?.plotNumber || "غير محدد"}</dd></div>
            </dl>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_1.35fr]">
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-5">
            <div className="mb-4 flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900">توصية المنتج</h3>
                <p className="mt-1 text-xs text-slate-500">من مسودة استراتيجية المنتج؛ لا تُطبّق على التوزيع تلقائيًا.</p>
              </div>
              {decision.productReady ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <AlertTriangle className="h-5 w-5 text-amber-500" />}
            </div>
            {unitRows.length > 0 ? (
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-500"><tr><th className="px-3 py-2 font-medium">النوع المقترح</th><th className="px-3 py-2 font-medium">النسبة</th><th className="px-3 py-2 font-medium">المساحة</th></tr></thead>
                  <tbody>{unitRows.map(([key, value]: [string, any]) => <tr key={key} className="border-t border-slate-100 text-slate-800"><td className="px-3 py-2.5 font-bold">{UNIT_LABELS[key] || key}</td><td className="px-3 py-2.5">{formatNumber(value?.pct, "%")}</td><td className="px-3 py-2.5">{formatNumber(value?.avgSize, " قدم²")}</td></tr>)}</tbody>
                </table>
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-xs leading-5 text-slate-500">لا توجد مسودة منتج منظمة بعد. شغّل التحليل المساند أو أضف دليل السوق في المرحلة التالية.</p>
            )}
            {decision.product.finishingQuality && <p className="mt-3 text-xs text-slate-600">جودة التشطيب المقترحة: <span className="font-bold text-slate-800">{decision.product.finishingQuality}</span></p>}
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-5">
            <div className="mb-4 flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900">مسودة نطاق السعر</h3>
                <p className="mt-1 text-xs text-slate-500">تظهر الأرقام البحثية فقط؛ يبقى مصدر سعر القدم المربع المعتمد في صفحة التسعير.</p>
              </div>
              {decision.pricingReady ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <AlertTriangle className="h-5 w-5 text-amber-500" />}
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {SCENARIOS.map((scenario) => {
                const residential = decision.pricing.scenarios?.[scenario.key]?.residential || {};
                const values = Object.entries(residential).filter(([, value]) => Number(value || 0) > 0);
                return <div key={scenario.key} className={`rounded-xl border-t-4 ${scenario.accent} ${scenario.wash} p-3`}><p className={`text-xs font-bold ${scenario.text}`}>{scenario.label}</p>{values.length > 0 ? <div className="mt-2 space-y-1.5">{values.map(([key, value]) => <div key={key} className="flex items-center justify-between text-xs text-slate-700"><span>{UNIT_LABELS[key] || key}</span><span className="font-bold">{formatNumber(value, " د.إ/قدم²")}</span></div>)}</div> : <p className="mt-2 text-xs leading-5 text-slate-500">لا توجد أرقام لهذا السيناريو بعد.</p>}</div>;
              })}
            </div>
            {hasPaymentPlan && <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3"><p className="text-xs font-bold text-slate-700">خطة السداد البحثية المقترحة</p><div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600 md:grid-cols-4">{[["الحجز", paymentPlan.booking], ["أثناء الإنشاء", paymentPlan.construction], ["التسليم", paymentPlan.handover], ["ما بعد التسليم", paymentPlan.deferred]].map(([label, item]: any) => <div key={label} className="rounded-lg bg-slate-50 p-2"><p>{label}</p><p className="mt-1 font-bold text-slate-800">{formatNumber(item?.pct, "%")}</p></div>)}</div></div>}
          </CardContent>
        </Card>
      </section>

      <Card className="border-teal-200 bg-teal-50/35 shadow-sm">
        <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="font-bold text-slate-900">ما الذي يحدث بعد اعتمادك مستقبلًا؟</h3>
            <p className="mt-1 text-xs leading-5 text-slate-600">اعتماد المنتج والسعر سيكون خطوة صريحة وموثقة؛ عندها فقط تنتقل القيم المعتمدة إلى مصدرها الصحيح، ثم يقرأ التخطيط المالي الأثر دون إعادة إدخال.</p>
          </div>
          <Button variant="outline" onClick={onOpenResearch} className="shrink-0 gap-2 border-teal-300 bg-white text-teal-800 hover:bg-teal-50">
            مراجعة التحليل المساند
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
