import { Info } from "lucide-react";
import { useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatFullNumber } from "@/lib/numberFormat";

export type FinancialSourceTrace = {
  report: string;
  project: string;
  row: string;
  period?: string;
  rule: string;
  value: number;
  contributors?: Array<{ name: string; value: number }>;
};

type FinancialSourceValueProps = {
  trace: FinancialSourceTrace;
  children: ReactNode;
  className?: string;
  testId?: string;
};

/**
 * A read-only trace surface. It never calculates a new value: it explains the
 * exact report row and calendar period that produced the number already shown.
 */
export function FinancialSourceValue({ trace, children, className = "", testId }: FinancialSourceValueProps) {
  const [open, setOpen] = useState(false);
  const absoluteValue = formatFullNumber(Math.abs(trace.value), "0");
  const direction = trace.value < 0 ? "مطلوب من المستثمر" : trace.value > 0 ? "مستلم للمستثمر" : "لا حركة مالية";

  return <>
    <button
      type="button"
      data-testid={testId}
      onClick={() => setOpen(true)}
      className={`inline-flex max-w-full items-center justify-center gap-1 rounded px-0.5 underline decoration-dotted underline-offset-4 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500/50 ${className}`}
      title="انقر لمعرفة مصدر الرقم"
      aria-label={`مصدر الرقم ${absoluteValue}`}
    >
      <span>{children}</span>
      <Info className="h-3 w-3 shrink-0 opacity-55" aria-hidden="true" />
    </button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg border-slate-200 bg-white p-0" dir="rtl">
        <DialogHeader className="border-b border-slate-200 bg-teal-50 px-5 py-4 text-right">
          <DialogTitle className="text-base font-black text-slate-900">مصدر الرقم</DialogTitle>
          <DialogDescription className="text-xs text-slate-600">تفسير مباشر للرقم المعروض، من دون إعادة حساب أو تعديل.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 px-5 py-4 text-right">
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
            <TraceField label="التقرير" value={trace.report} />
            <TraceField label="المشروع" value={trace.project} />
            <TraceField label="صف المصدر" value={trace.row} />
            <TraceField label="الفترة" value={trace.period || "إجمالي المشروع"} />
          </div>
          <div className="rounded-xl border border-teal-200 bg-teal-50 px-3 py-2.5">
            <p className="text-[10px] font-bold text-teal-700">القاعدة المستخدمة</p>
            <p className="mt-1 text-xs font-semibold leading-5 text-slate-700">{trace.rule}</p>
          </div>
          <div className="flex items-end justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
            <div><p className="text-[10px] font-bold text-slate-500">طبيعة الحركة</p><p className="mt-1 text-xs font-bold text-slate-700">{direction}</p></div>
            <div className="text-left"><p className="text-[10px] font-bold text-slate-500">المبلغ من المصدر</p><p className="mt-1 text-base font-black text-slate-950">{absoluteValue} <span className="text-[10px] font-semibold">AED</span></p></div>
          </div>
          {trace.contributors && trace.contributors.length > 0 && <div className="rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-3 py-2 text-[10px] font-bold text-slate-600">تفصيل التجميع</div>
            <div className="max-h-40 divide-y divide-slate-100 overflow-y-auto">
              {trace.contributors.map((item) => <div key={item.name} className="flex items-center justify-between gap-3 px-3 py-2 text-xs"><span className="min-w-0 truncate text-slate-600">{item.name}</span><span className={item.value < 0 ? "font-black text-rose-700" : "font-black text-emerald-700"}>{formatFullNumber(Math.abs(item.value), "0")}</span></div>)}
            </div>
          </div>}
        </div>
      </DialogContent>
    </Dialog>
  </>;
}

function TraceField({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[10px] font-bold text-slate-500">{label}</p><p className="mt-0.5 break-words text-xs font-bold text-slate-800">{value}</p></div>;
}
