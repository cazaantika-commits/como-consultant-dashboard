import { default as Plus } from "lucide-react/dist/esm/icons/plus.js";
import { default as Trash2 } from "lucide-react/dist/esm/icons/trash-2.js";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getPaymentPlanPostHandoverMonths,
  paymentPlanTotalPercentage,
  type FlexiblePaymentPlan,
  type PaymentPlanStage,
  type PaymentRecipient,
  type PaymentStageTrigger,
} from "@/lib/flexiblePaymentPlan";

const triggerLabels: Record<PaymentStageTrigger, string> = {
  sale: "عند البيع / الحجز",
  months_after_sale: "بعد البيع بعدد أشهر",
  construction_progress: "عند نسبة إنجاز",
  handover: "عند التسليم",
  post_handover: "بعد التسليم",
};

export function FlexiblePaymentPlanEditor({
  plan,
  onStageChange,
  onAddStage,
  onRemoveStage,
}: {
  plan: FlexiblePaymentPlan;
  onStageChange: (id: string, patch: Partial<PaymentPlanStage>) => void;
  onAddStage: () => void;
  onRemoveStage: (id: string) => void;
}) {
  const total = paymentPlanTotalPercentage(plan);
  const postMonths = getPaymentPlanPostHandoverMonths(plan);
  return (
    <section data-testid="flexible-payment-plan" className="overflow-hidden rounded-[22px] border border-indigo-200 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.07)]">
      <header className="flex flex-col gap-3 border-b border-indigo-100 bg-[linear-gradient(115deg,#eef2ff,#ffffff_60%,#ecfeff)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-bold text-indigo-700">خطة التحصيل المرنة</p>
          <h2 className="mt-0.5 text-lg font-black text-slate-900">ابنِ أي تسلسل دفعات، ثم اقرأ أثره فوراً</h2>
          <p className="mt-1 text-xs leading-5 text-slate-600">يمكنك ربط الدفعة بالبيع أو بعدد أشهر أو نسبة إنجاز أو التسليم أو ما بعد التسليم. دفعات ما بعد التسليم يمكن توجيهها للمستثمر.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={Math.abs(total - 100) < 0.001 ? "border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-emerald-800 hover:bg-emerald-50" : "border border-rose-200 bg-rose-50 px-3 py-1.5 text-rose-800 hover:bg-rose-50"}>
            الإجمالي {total}%
          </Badge>
          <Button type="button" size="sm" onClick={onAddStage} className="gap-1.5 bg-indigo-600 text-white hover:bg-indigo-500"><Plus className="h-4 w-4" />إضافة دفعة</Button>
        </div>
      </header>
      <div className="space-y-2 p-3 sm:p-4">
        {plan.stages.map((stage, index) => {
          const recurring = stage.trigger === "months_after_sale" || stage.trigger === "post_handover";
          return (
            <article key={stage.id} className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-3 md:grid-cols-[minmax(130px,1.3fr)_minmax(150px,1.25fr)_90px_130px_1fr_auto] md:items-end">
              <label className="text-[10px] font-bold text-slate-600">اسم الدفعة
                <input value={stage.label} onChange={(event) => onStageChange(stage.id, { label: event.target.value })} className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm font-bold text-slate-900 outline-none focus:border-indigo-500" />
              </label>
              <label className="text-[10px] font-bold text-slate-600">موعد الاستحقاق
                <Select value={stage.trigger} onValueChange={(value) => onStageChange(stage.id, { trigger: value as PaymentStageTrigger })}>
                  <SelectTrigger className="mt-1 h-9 border-slate-300 bg-white text-xs font-bold"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(triggerLabels).map(([value, label]) => <SelectItem key={value} value={value} className="text-xs">{label}</SelectItem>)}</SelectContent>
                </Select>
              </label>
              <label className="text-[10px] font-bold text-slate-600">النسبة %
                <input type="number" min={0} max={100} value={stage.percentage} onChange={(event) => onStageChange(stage.id, { percentage: Math.max(0, Number(event.target.value) || 0) })} className="mt-1 h-9 w-full rounded-lg border border-indigo-300 bg-white px-2 text-center text-sm font-black text-indigo-800 outline-none focus:border-indigo-500" />
              </label>
              <label className="text-[10px] font-bold text-slate-600">جهة الاستلام
                <Select value={stage.recipient} onValueChange={(value) => onStageChange(stage.id, { recipient: value as PaymentRecipient })}>
                  <SelectTrigger className="mt-1 h-9 border-slate-300 bg-white text-xs font-bold"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="escrow" className="text-xs">حساب الضمان</SelectItem><SelectItem value="investor" className="text-xs">المستثمر مباشرة</SelectItem></SelectContent>
                </Select>
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {stage.trigger === "construction_progress" ? <label className="text-[10px] font-bold text-slate-600">نسبة الإنجاز %<input type="number" min={0} max={100} value={stage.progressPct ?? 0} onChange={(event) => onStageChange(stage.id, { progressPct: Number(event.target.value) || 0 })} className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-center text-sm font-bold" /></label> : <label className="text-[10px] font-bold text-slate-600">بعد كم شهر<input type="number" min={0} value={stage.offsetMonths ?? 0} onChange={(event) => onStageChange(stage.id, { offsetMonths: Math.max(0, Number(event.target.value) || 0) })} className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-center text-sm font-bold" /></label>}
                {recurring && <label className="text-[10px] font-bold text-slate-600">كل كم شهر<input type="number" min={1} value={stage.everyMonths ?? 1} onChange={(event) => onStageChange(stage.id, { everyMonths: Math.max(1, Number(event.target.value) || 1) })} className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-center text-sm font-bold" /></label>}
                {recurring && !stage.untilHandover && <label className="text-[10px] font-bold text-slate-600">عدد الدفعات<input type="number" min={1} max={60} value={stage.installmentCount ?? 1} onChange={(event) => onStageChange(stage.id, { installmentCount: Math.max(1, Number(event.target.value) || 1) })} className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-center text-sm font-bold" /></label>}
              </div>
              <div className="flex items-center gap-1.5 md:pb-1"><Button type="button" variant="outline" size="icon" aria-label={`حذف ${stage.label}`} onClick={() => onRemoveStage(stage.id)} disabled={plan.stages.length <= 1} className="h-9 w-9 border-rose-200 bg-white text-rose-700 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></Button><span className="text-[10px] font-bold text-slate-500">{index + 1}</span></div>
              {recurring && stage.trigger !== "post_handover" && <label className="col-span-full flex items-center gap-2 text-[11px] font-bold text-slate-600"><input type="checkbox" checked={Boolean(stage.untilHandover)} onChange={(event) => onStageChange(stage.id, { untilHandover: event.target.checked })} className="h-4 w-4 accent-indigo-600" />قسّم هذه النسبة تلقائياً على كل الاستحقاقات حتى التسليم {stage.untilHandover ? "(بدلاً من عدد دفعات ثابت)" : ""}</label>}
            </article>
          );
        })}
      </div>
      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3 text-xs font-semibold text-slate-600">
        <span>{plan.stages.map((stage) => `${stage.label}: ${stage.percentage}%`).join(" · ")}</span>
        <span>{postMonths > 0 ? `آخر تحصيل بعد التسليم يصل إلى الشهر ${postMonths} بعد الإنجاز.` : "لا توجد دفعات مجدولة بعد التسليم."}</span>
        <span className={Math.abs(total - 100) < 0.001 ? "text-emerald-700" : "text-rose-700"}>{Math.abs(total - 100) < 0.001 ? "الخطة متوازنة 100%" : "أكمل أو خفّض النسب حتى يصبح الإجمالي 100%"}</span>
      </footer>
    </section>
  );
}
