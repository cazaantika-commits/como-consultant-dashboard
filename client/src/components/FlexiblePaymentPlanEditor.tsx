import { default as Trash2 } from "lucide-react/dist/esm/icons/trash-2.js";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  buildPaymentReceiptEvents,
  createPaymentPlanStage,
  getPaymentPlanMilestone,
  getPaymentPlanPostHandoverMonths,
  PAYMENT_MILESTONE_LABELS,
  paymentPlanTotalPercentage,
  type FlexiblePaymentPlan,
  type PaymentPlanMilestone,
  type PaymentPlanStage,
  type PaymentRecipient,
} from "@/lib/flexiblePaymentPlan";

const milestoneOrder: PaymentPlanMilestone[] = ["booking", "contract", "construction", "handover", "post_handover"];

function milestoneHint(milestone: PaymentPlanMilestone, stage: PaymentPlanStage) {
  if (milestone === "booking") return "يستحق لحظة حجز/بيع الوحدة.";
  if (milestone === "contract") return `يستحق بعد ${stage.offsetMonths ?? 1} شهر من الحجز.`;
  if (milestone === "construction") return `يقسّم كل ${stage.everyMonths ?? 3} أشهر من بداية الإنشاء ولا يتجاوز التسليم.`;
  if (milestone === "handover") return "يستحق عند اكتمال المشروع وتسليم الوحدة.";
  return `${stage.installmentCount ?? 1} دفعات، كل ${stage.everyMonths ?? 1} أشهر، تبدأ بعد ${stage.offsetMonths ?? 1} شهر من التسليم.`;
}

export function FlexiblePaymentPlanEditor({
  plan,
  onStageChange,
  onAddStage,
  onRemoveStage,
  salesStartMonth,
  constructionStartMonth,
  constructionEndMonth,
}: {
  plan: FlexiblePaymentPlan;
  onStageChange: (id: string, patch: Partial<PaymentPlanStage>) => void;
  onAddStage: (milestone: PaymentPlanMilestone) => void;
  onRemoveStage: (id: string) => void;
  salesStartMonth: number;
  constructionStartMonth: number;
  constructionEndMonth: number;
}) {
  const total = paymentPlanTotalPercentage(plan);
  const postMonths = getPaymentPlanPostHandoverMonths(plan);
  const constructionMonths = Math.max(1, constructionEndMonth - constructionStartMonth + 1);
  const previewEvents = buildPaymentReceiptEvents({ plan, saleMonth: salesStartMonth, constructionStartMonth, constructionEndMonth });

  const changeMilestone = (stage: PaymentPlanStage, milestone: PaymentPlanMilestone) => {
    const replacement = createPaymentPlanStage(milestone, stage.id);
    onStageChange(stage.id, { ...replacement, percentage: stage.percentage });
  };

  return (
    <section data-testid="flexible-payment-plan" className="overflow-hidden rounded-[22px] border-2 border-indigo-300 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.08)]">
      <header className="flex flex-col gap-4 border-b-2 border-indigo-200 bg-[linear-gradient(115deg,#eef2ff,#ffffff_55%,#ecfeff)] px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-[11px] font-black text-indigo-800">خطة سداد المشروع</p>
          <h2 className="mt-0.5 text-xl font-black text-slate-950">الحجز → العقد → الإنشاء → التسليم → ما بعد التسليم</h2>
          <p className="mt-1.5 max-w-3xl text-xs font-semibold leading-5 text-slate-700">كل دفعة مرتبطة بمعلم واضح. أقساط الإنشاء تُوزّع تلقائيًا داخل مدة الإنشاء ولا يمكن أن تعبر إلى ما بعد التسليم.</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center text-xs font-bold tabular-nums">
          <div className="rounded-xl border border-indigo-200 bg-white px-3 py-2 text-indigo-900"><span className="block text-[9px] text-slate-600">بدء البيع</span>شهر {salesStartMonth}</div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900"><span className="block text-[9px] text-slate-600">مدة الإنشاء</span>{constructionMonths} شهر</div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-900"><span className="block text-[9px] text-slate-600">التسليم</span>شهر {constructionEndMonth}</div>
        </div>
      </header>

      <div className="grid gap-2 border-b border-indigo-100 bg-slate-50/70 p-3 sm:grid-cols-5">
        {milestoneOrder.map((milestone) => {
          const pct = plan.stages.filter((stage) => getPaymentPlanMilestone(stage) === milestone).reduce((sum, stage) => sum + stage.percentage, 0);
          const active = pct > 0;
          return <div key={milestone} className={`rounded-xl border px-3 py-2 ${active ? "border-indigo-300 bg-white shadow-sm" : "border-slate-200 bg-slate-50 text-slate-500"}`}><p className="text-[10px] font-black">{PAYMENT_MILESTONE_LABELS[milestone]}</p><p className="mt-1 text-lg font-black tabular-nums">{pct}%</p></div>;
        })}
      </div>

      <div className="space-y-2 p-3 sm:p-4">
        {plan.stages.map((stage, index) => {
          const milestone = getPaymentPlanMilestone(stage);
          const stageEvents = previewEvents.filter((event) => event.stageId === stage.id);
          const firstMonth = stageEvents[0]?.month;
          const lastMonth = stageEvents.at(-1)?.month;
          return (
            <article key={stage.id} className="rounded-2xl border-2 border-slate-200 bg-slate-50/80 p-3">
              <div className="grid gap-2 lg:grid-cols-[150px_minmax(170px,1fr)_100px_145px_auto] lg:items-end">
                <label className="text-[10px] font-black text-slate-700">نوع الدفعة
                  <Select value={milestone} onValueChange={(value) => changeMilestone(stage, value as PaymentPlanMilestone)}>
                    <SelectTrigger className="mt-1 h-10 border-slate-400 bg-white text-xs font-black text-slate-900"><SelectValue /></SelectTrigger>
                    <SelectContent>{milestoneOrder.map((item) => <SelectItem key={item} value={item} className="text-xs font-bold">{PAYMENT_MILESTONE_LABELS[item]}</SelectItem>)}</SelectContent>
                  </Select>
                </label>
                <label className="text-[10px] font-black text-slate-700">اسم يظهر للمشتري
                  <input value={stage.label} onChange={(event) => onStageChange(stage.id, { label: event.target.value })} className="mt-1 h-10 w-full rounded-lg border border-slate-400 bg-white px-2 text-sm font-bold text-slate-950 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100" />
                </label>
                <label className="text-[10px] font-black text-slate-700">النسبة %
                  <input type="number" min={0} max={100} value={stage.percentage} onChange={(event) => onStageChange(stage.id, { percentage: Math.max(0, Number(event.target.value) || 0) })} className="mt-1 h-10 w-full rounded-lg border-2 border-indigo-300 bg-white px-2 text-center text-base font-black text-indigo-900 outline-none focus:border-indigo-600" />
                </label>
                <label className="text-[10px] font-black text-slate-700">جهة الاستلام
                  <Select value={stage.recipient} onValueChange={(value) => onStageChange(stage.id, { recipient: value as PaymentRecipient })}>
                    <SelectTrigger className="mt-1 h-10 border-slate-400 bg-white text-xs font-bold text-slate-900"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="escrow" className="text-xs">حساب الضمان</SelectItem><SelectItem value="investor" className="text-xs">المستثمر مباشرة</SelectItem></SelectContent>
                  </Select>
                </label>
                <div className="flex items-center gap-1.5 lg:pb-0.5"><Button type="button" variant="outline" size="icon" aria-label={`حذف ${stage.label}`} onClick={() => onRemoveStage(stage.id)} disabled={plan.stages.length <= 1} className="h-10 w-10 border-rose-300 bg-white text-rose-800 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></Button><span className="text-[10px] font-black text-slate-500">{index + 1}</span></div>
              </div>
              <div className="mt-2 grid gap-2 border-t border-slate-200 pt-2 sm:grid-cols-3">
                {milestone === "contract" && <label className="text-[10px] font-bold text-slate-700">بعد الحجز (أشهر)<input type="number" min={0} value={stage.offsetMonths ?? 1} onChange={(event) => onStageChange(stage.id, { offsetMonths: Math.max(0, Number(event.target.value) || 0) })} className="mt-1 h-9 w-full rounded-lg border border-slate-400 bg-white px-2 text-center text-sm font-black" /></label>}
                {milestone === "construction" && <><label className="text-[10px] font-bold text-slate-700">يبدأ عند إنجاز %<input type="number" min={0} max={100} value={stage.progressPct ?? 0} onChange={(event) => onStageChange(stage.id, { progressPct: Math.min(100, Math.max(0, Number(event.target.value) || 0)) })} className="mt-1 h-9 w-full rounded-lg border border-slate-400 bg-white px-2 text-center text-sm font-black" /></label><label className="text-[10px] font-bold text-slate-700">كل كم شهر<input type="number" min={1} value={stage.everyMonths ?? 3} onChange={(event) => onStageChange(stage.id, { everyMonths: Math.max(1, Number(event.target.value) || 1), untilHandover: true })} className="mt-1 h-9 w-full rounded-lg border border-slate-400 bg-white px-2 text-center text-sm font-black" /></label></>}
                {milestone === "post_handover" && <><label className="text-[10px] font-bold text-slate-700">أول دفعة بعد التسليم (أشهر)<input type="number" min={1} value={stage.offsetMonths ?? 1} onChange={(event) => onStageChange(stage.id, { offsetMonths: Math.max(1, Number(event.target.value) || 1) })} className="mt-1 h-9 w-full rounded-lg border border-slate-400 bg-white px-2 text-center text-sm font-black" /></label><label className="text-[10px] font-bold text-slate-700">كل كم شهر<input type="number" min={1} value={stage.everyMonths ?? 3} onChange={(event) => onStageChange(stage.id, { everyMonths: Math.max(1, Number(event.target.value) || 1) })} className="mt-1 h-9 w-full rounded-lg border border-slate-400 bg-white px-2 text-center text-sm font-black" /></label><label className="text-[10px] font-bold text-slate-700">عدد الدفعات<input type="number" min={1} max={60} value={stage.installmentCount ?? 1} onChange={(event) => onStageChange(stage.id, { installmentCount: Math.max(1, Number(event.target.value) || 1) })} className="mt-1 h-9 w-full rounded-lg border border-slate-400 bg-white px-2 text-center text-sm font-black" /></label></>}
                <div className="rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-[10px] font-bold leading-5 text-indigo-950 sm:col-span-1">{milestoneHint(milestone, stage)}{firstMonth ? ` وفق الخطة الحالية: شهر ${firstMonth}${lastMonth && lastMonth !== firstMonth ? ` إلى شهر ${lastMonth}` : ""}.` : ""}</div>
              </div>
            </article>
          );
        })}
      </div>

      <footer className="flex flex-col gap-3 border-t-2 border-indigo-100 bg-slate-50 px-5 py-3 text-xs font-semibold text-slate-700 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2"><Button type="button" size="sm" variant="outline" onClick={() => onAddStage("construction")} className="gap-1 border-indigo-300 bg-white text-indigo-900 hover:bg-indigo-50"><Plus className="h-3.5 w-3.5" />دفعة أثناء الإنشاء</Button><Button type="button" size="sm" variant="outline" onClick={() => onAddStage("post_handover")} className="gap-1 border-emerald-300 bg-white text-emerald-900 hover:bg-emerald-50"><Plus className="h-3.5 w-3.5" />دفعة بعد التسليم</Button></div>
        <div className="text-left"><Badge className={Math.abs(total - 100) < 0.001 ? "border border-emerald-300 bg-emerald-50 text-emerald-900" : "border border-rose-300 bg-rose-50 text-rose-900"}>الإجمالي {total}%</Badge><p className="mt-1 text-[10px]">{postMonths > 0 ? `آخر تحصيل بعد التسليم: الشهر ${postMonths}.` : "لا توجد دفعات بعد التسليم."}</p></div>
      </footer>
    </section>
  );
}
