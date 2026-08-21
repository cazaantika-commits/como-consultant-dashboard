import { default as ClipboardList } from "lucide-react/dist/esm/icons/clipboard-list.js";
import { default as Database } from "lucide-react/dist/esm/icons/database.js";
import { default as Calculator } from "lucide-react/dist/esm/icons/calculator.js";
import GeneralInputsPage from "./GeneralInputsPage";
import FactSheetPage from "./FactSheetPage";

export default function UnifiedProjectCardPage() {
  return (
    <div className="bg-[#f7fafb] px-4 py-3" dir="rtl">
      <div className="mx-auto max-w-[1500px] space-y-5">
        <section className="fs-card fs-card-teal overflow-hidden border-t-4 border-t-teal-500">
          <div className="flex items-start gap-3 border-b-2 border-teal-300 bg-gradient-to-l from-teal-100 via-teal-50 to-white px-4 py-3">
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
          <GeneralInputsPage embedded hideDocumentFields hideProjectSelector />
        </section>

        <section className="fs-card fs-card-violet overflow-hidden border-t-4 border-t-violet-500">
          <div className="flex items-start gap-3 border-b-2 border-violet-300 bg-gradient-to-l from-violet-100 via-violet-50 to-white px-4 py-3">
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

        <div className="fs-card fs-card-amber flex items-center gap-2 rounded-xl px-3 py-2 text-[11px] text-slate-600">
          <Calculator className="h-3.5 w-3.5 text-emerald-600" />
          <span><strong className="text-slate-800">القيم المحسوبة</strong> تظهر في بطاقات الملخص داخل قسم الإدخالات للمراجعة فقط، ولا تعدّل يدويًا.</span>
        </div>
      </div>
    </div>
  );
}
