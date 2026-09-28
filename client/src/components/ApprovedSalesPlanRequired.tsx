import { default as FileCheck2 } from "lucide-react/dist/esm/icons/file-check-2.js";
import { default as Target } from "lucide-react/dist/esm/icons/target.js";

export function ApprovedSalesPlanRequired({ projectId, compact = false }: { projectId: number; compact?: boolean }) {
  const salesWorkspacePath = `/bateekha?projectId=${projectId}&tab=sales`;

  return (
    <div className={compact ? "p-4" : "min-h-[320px] bg-slate-50 p-6"} dir="rtl">
      <div className="mx-auto max-w-2xl rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-7 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-800">
          <FileCheck2 className="h-6 w-6" />
        </div>
        <h2 className="mt-4 text-lg font-black text-slate-950">بانتظار اعتماد خطة المبيعات</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm font-semibold leading-7 text-slate-700">
          توجد مساحة عمل مستقلة للمسودات، لكن هذه الصفحة لا تولّد تقريرًا ماليًا ولا تعرض أرقامًا من مسودة غير معتمدة.
        </p>
        <a
          href={salesWorkspacePath}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-amber-700 px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-amber-800"
        >
          <Target className="h-4 w-4" />
          فتح مساحة المبيعات والاعتماد
        </a>
      </div>
    </div>
  );
}
