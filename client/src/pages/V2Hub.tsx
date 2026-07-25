import { useLocation } from "wouter";
import { ArrowRight, TrendingDown, Briefcase, Landmark, FileText, Users, Calendar } from "lucide-react";

const V2_PAGES = [
  {
    title: "تدفقات المستثمر النقدية",
    description: "Debit و Credit الشهري مع التراكمي",
    path: "/v2/investor-cashflow",
    icon: TrendingDown,
    color: "bg-red-50 border-red-200 text-red-700",
    iconBg: "bg-red-100",
  },
  {
    title: "المحفظة الاستثمارية",
    description: "تجميع المشاريع — التدفقات المجمّعة",
    path: "/v2/portfolio",
    icon: Briefcase,
    color: "bg-teal-50 border-teal-200 text-teal-700",
    iconBg: "bg-teal-100",
  },
  {
    title: "تدفقات الإسكرو",
    description: "حساب الضمان — الداخل والخارج",
    path: "/v2/escrow-cashflow",
    icon: Landmark,
    color: "bg-indigo-50 border-indigo-200 text-indigo-700",
    iconBg: "bg-indigo-100",
  },
  {
    title: "دراسة الجدوى",
    description: "الإيرادات والتكاليف والأرباح",
    path: "/v2/feasibility",
    icon: FileText,
    color: "bg-emerald-50 border-emerald-200 text-emerald-700",
    iconBg: "bg-emerald-100",
  },
  {
    title: "خطة المبيعات والتسويق",
    description: "إدارة وائل — مزيج الوحدات والمنحنى",
    path: "/v2/wael-sales",
    icon: Users,
    color: "bg-orange-50 border-orange-200 text-orange-700",
    iconBg: "bg-orange-100",
  },
  {
    title: "الجدول الزمني",
    description: "المراحل والمعالم الرئيسية",
    path: "/v2/timeline",
    icon: Calendar,
    color: "bg-blue-50 border-blue-200 text-blue-700",
    iconBg: "bg-blue-100",
  },
];

export default function V2Hub() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-[1200px] mx-auto px-6 py-4 flex items-center gap-3">
          <button onClick={() => navigate("/")} className="p-2 rounded-lg hover:bg-gray-100 transition">
            <ArrowRight className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">التقارير المالية (V2)</h1>
            <p className="text-sm text-gray-500">النظام الجديد — هياكل الصفحات</p>
          </div>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {V2_PAGES.map((page) => {
            const Icon = page.icon;
            return (
              <button
                key={page.path}
                onClick={() => navigate(page.path)}
                className={`p-6 rounded-xl border-2 ${page.color} text-right transition-all hover:scale-[1.02] hover:shadow-md`}
              >
                <div className={`w-12 h-12 rounded-lg ${page.iconBg} flex items-center justify-center mb-4`}>
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-lg mb-1">{page.title}</h3>
                <p className="text-sm opacity-75">{page.description}</p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
