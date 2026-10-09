import { buildRentalDevelopmentSummary } from "@/lib/rentalDevelopmentSummary";
import type { CashFlowResult } from "@/lib/investorCashFlowEngine";
import { formatFullNumber } from "@/lib/numberFormat";

export function RentalDevelopmentOverview({ data }: { data: CashFlowResult }) {
  const summary = buildRentalDevelopmentSummary(data);
  const show = (amount: number) => summary.canShowDevelopmentSpend ? formatFullNumber(amount, "0") : "—";
  return (
    <section className="rounded-2xl border border-teal-200 bg-white p-5 shadow-sm" dir="rtl" aria-label="ملخص إنفاق تطوير المشروع للتأجير">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-teal-700">تطوير للتأجير · نموذج إنفاق تقديري</p>
          <h2 className="mt-1 text-xl font-extrabold text-slate-950">كم يتطلب التطوير، ومتى تُحتاج السيولة؟</h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">الجدول يوزع تكلفة التطوير وفق مدخلات البطاقة وبرنامجها؛ لا يمثل تدفق التشغيل بعد الافتتاح أو قرضًا موافقًا عليه.</p>
        </div>
        <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-teal-800">المبالغ بالدرهم الإماراتي</span>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-700">إجمالي تكلفة التطوير المسجلة</p>
          <p className="mt-2 text-2xl font-extrabold tabular-nums text-slate-950" dir="ltr">{show(summary.totalDevelopmentCost)}</p>
          <p className="mt-2 text-xs leading-5 text-slate-600">يشمل الأرض وتكاليف اقتنائها في النموذج؛ لا يشمل بنودًا لم تُقدّر بعد.</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">مساهمة سابقة مفترضة في النموذج</p>
          <p className="mt-2 text-2xl font-extrabold tabular-nums text-amber-950" dir="ltr">{show(summary.assumedPriorContribution)}</p>
          <p className="mt-2 text-xs leading-5 text-amber-900">الأرض والتسجيل والوساطة موسومة سابقًا آليًا؛ ليست شهادة دفع أو تقييم مساهمة معتمدًا من البنك.</p>
        </div>
        <div className="rounded-xl border border-teal-200 bg-teal-50 p-4">
          <p className="text-sm font-semibold text-teal-900">احتياج إنفاق التطوير المستقبلي</p>
          <p className="mt-2 text-2xl font-extrabold tabular-nums text-teal-950" dir="ltr">{show(summary.futureDevelopmentSpend)}</p>
          <p className="mt-2 text-xs leading-5 text-teal-900">قبل تحديد مساهمة المالك الجديدة والتمويل. ليس مبلغ قرض؛ يشمل الدفعات والاحتجاز حتى {summary.peakMonthDate || "نهاية البرنامج"}.</p>
        </div>
      </div>
      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
        <strong>قدرة السداد من الإيجارات: لم تُحتسب بعد.</strong> يلزم ربط مساحات التأجير والإيجارات والإشغال والتحصيل بمصاريف التشغيل والصيانة والضرائب والاحتياطيات، ثم شروط التمويل الإسلامي. غياب الدخل هنا لا يعني خسارة المشروع، وغياب المصروف لا يعني أنه صفر.
      </div>
    </section>
  );
}
