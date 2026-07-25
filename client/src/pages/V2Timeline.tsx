import { ArrowRight, Download } from "lucide-react";
import { useLocation } from "wouter";

// ===== DUMMY DATA =====
const PHASES = [
  { id: "design", name: "التصميم", startMonth: 1, endMonth: 8, color: "#3b82f6", items: ["تصميم معماري", "تصميم إنشائي", "تصميم MEP", "تصميم داخلي"] },
  { id: "approvals", name: "الاعتمادات", startMonth: 5, endMonth: 10, color: "#8b5cf6", items: ["اعتماد DM", "اعتماد DEWA", "اعتماد CD", "رخصة بناء"] },
  { id: "construction", name: "الإنشاء", startMonth: 9, endMonth: 32, color: "#f59e0b", items: ["أعمال الحفر", "الأساسات", "الهيكل", "التشطيبات", "MEP", "أعمال خارجية"] },
  { id: "sales", name: "المبيعات", startMonth: 6, endMonth: 30, color: "#10b981", items: ["إطلاق المبيعات", "حملات تسويقية", "معارض", "وسطاء"] },
  { id: "handover", name: "التسليم", startMonth: 33, endMonth: 36, color: "#ec4899", items: ["فحص الوحدات", "تسليم المشترين", "تسجيل DLD"] },
];

const TOTAL_MONTHS = 36;
const MILESTONES = [
  { month: 1, label: "بدء التصميم" },
  { month: 8, label: "انتهاء التصميم" },
  { month: 9, label: "بدء الإنشاء" },
  { month: 20, label: "اكتمال الهيكل" },
  { month: 32, label: "انتهاء الإنشاء" },
  { month: 36, label: "التسليم النهائي" },
];

export default function V2Timeline() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-[1800px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/")} className="p-2 rounded-lg hover:bg-gray-100 transition">
              <ArrowRight className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">الجدول الزمني للمشروع</h1>
              <p className="text-sm text-gray-500">مجان متعدد الاستخدامات — 36 شهر</p>
            </div>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm">
            <Download className="w-4 h-4" />
            تصدير
          </button>
        </div>
      </div>

      <div className="max-w-[1800px] mx-auto px-6 py-6">
        {/* Phase Summary Cards */}
        <div className="flex gap-3 mb-6 overflow-x-auto pb-2">
          {PHASES.map((phase) => (
            <div
              key={phase.id}
              className="flex-shrink-0 bg-white rounded-xl p-4 border shadow-sm min-w-[180px]"
              style={{ borderColor: phase.color + "40" }}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: phase.color }} />
                <span className="font-bold text-gray-800 text-sm">{phase.name}</span>
              </div>
              <p className="text-xs text-gray-500">
                شهر {phase.startMonth} → شهر {phase.endMonth}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {phase.endMonth - phase.startMonth + 1} أشهر
              </p>
            </div>
          ))}
        </div>

        {/* Gantt Chart */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <div style={{ minWidth: TOTAL_MONTHS * 50 + 200 }}>
              {/* Month Headers */}
              <div className="flex border-b border-gray-200">
                <div className="w-[200px] flex-shrink-0 px-4 py-3 bg-gray-50 font-bold text-sm text-gray-700 border-l border-gray-200">
                  المرحلة
                </div>
                <div className="flex-1 flex">
                  {Array.from({ length: TOTAL_MONTHS }, (_, i) => (
                    <div
                      key={i}
                      className="flex-1 text-center py-3 text-xs text-gray-500 border-l border-gray-100"
                      style={{ minWidth: 50 }}
                    >
                      {i + 1}
                    </div>
                  ))}
                </div>
              </div>

              {/* Phase Bars */}
              {PHASES.map((phase) => (
                <div key={phase.id} className="flex border-b border-gray-100 hover:bg-gray-50/30">
                  <div className="w-[200px] flex-shrink-0 px-4 py-4 border-l border-gray-100">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: phase.color }} />
                      <span className="font-medium text-sm text-gray-800">{phase.name}</span>
                    </div>
                    <div className="mt-1 text-xs text-gray-400">
                      {phase.items.slice(0, 3).join(" • ")}
                      {phase.items.length > 3 && " ..."}
                    </div>
                  </div>
                  <div className="flex-1 flex items-center relative" style={{ minHeight: 56 }}>
                    {/* Bar */}
                    <div
                      className="absolute h-8 rounded-lg opacity-90"
                      style={{
                        backgroundColor: phase.color,
                        right: `${((phase.startMonth - 1) / TOTAL_MONTHS) * 100}%`,
                        width: `${((phase.endMonth - phase.startMonth + 1) / TOTAL_MONTHS) * 100}%`,
                      }}
                    >
                      <div className="h-full flex items-center justify-center text-white text-xs font-medium">
                        {phase.endMonth - phase.startMonth + 1} شهر
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Milestones Row */}
              <div className="flex border-t-2 border-gray-200">
                <div className="w-[200px] flex-shrink-0 px-4 py-3 bg-amber-50 font-bold text-sm text-amber-800 border-l border-gray-200">
                  المعالم الرئيسية
                </div>
                <div className="flex-1 relative" style={{ minHeight: 48 }}>
                  {MILESTONES.map((ms) => (
                    <div
                      key={ms.month}
                      className="absolute top-1/2 -translate-y-1/2 flex flex-col items-center"
                      style={{ right: `${((ms.month - 0.5) / TOTAL_MONTHS) * 100}%` }}
                    >
                      <div className="w-3 h-3 rounded-full bg-amber-500 border-2 border-white shadow" />
                      <span className="text-[10px] text-amber-700 mt-1 whitespace-nowrap font-medium">
                        {ms.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
