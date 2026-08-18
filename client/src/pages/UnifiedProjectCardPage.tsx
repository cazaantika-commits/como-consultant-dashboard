import { ClipboardList, Database, Calculator } from "lucide-react";
import GeneralInputsPage from "./GeneralInputsPage";
import FactSheetPage from "./FactSheetPage";

export default function UnifiedProjectCardPage() {
  return (
    <div className="bg-slate-50 px-4 py-3" dir="rtl">
      <div className="mx-auto max-w-[1500px] space-y-4">
        <section className="overflow-hidden rounded-xl border border-teal-200 bg-white shadow-sm">
          <div className="flex items-start gap-3 border-b border-teal-100 bg-gradient-to-l from-teal-50 via-white to-white px-4 py-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-600 text-white shadow-sm">
              <ClipboardList className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-slate-900">المطلوب إدخاله واعتماده</h2>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
                الافتراضات المالية والتشغيلية اللازمة للحسابات. لا تدخل هنا حقائق يمكن لخازن سحبها من وثائق المشروع.
              </p>
            </div>
          </div>
          <GeneralInputsPage embedded hideDocumentFields />
        </section>

        <section className="overflow-hidden rounded-xl border border-violet-200 bg-white shadow-sm">
          <div className="flex items-start gap-3 border-b border-violet-100 bg-gradient-to-l from-violet-50 via-white to-white px-4 py-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-white shadow-sm">
              <Database className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-slate-900">بيانات المشروع من الوثائق</h2>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
                يستخرجها خازن من وثائق الأرض والعقود. أي معلومة غير موجودة أو غير مؤكدة تبقى للمراجعة ولا تُستبدل بقيمة افتراضية.
              </p>
            </div>
          </div>
          <FactSheetPage embedded documentOnly />
        </section>

        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-600">
          <Calculator className="h-3.5 w-3.5 text-emerald-600" />
          <span><strong className="text-slate-800">القيم المحسوبة</strong> تظهر في بطاقات الملخص داخل قسم الإدخالات للمراجعة فقط، ولا تعدّل يدويًا.</span>
        </div>
      </div>
    </div>
  );
}
