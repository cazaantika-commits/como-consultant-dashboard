import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Link } from "wouter";
import {
  Star,
  FileText,
  UserCircle,
  Lightbulb,
  ClipboardCheck,
  BookOpen,
  ArrowLeft,
  Building2,
  ChevronLeft,
} from "lucide-react";

const PORTAL_ICONS = [
  {
    id: "evaluation",
    title: "تقييم الاستشاريين",
    description: "نظام التقييم الفني من لجنة مكونة من ثلاثة أعضاء مع حساب المتوسط والترتيب",
    icon: Star,
    color: "from-amber-500 to-orange-600",
    bgLight: "bg-amber-50",
    textColor: "text-amber-700",
    borderColor: "border-amber-200",
    href: "/consultant-evaluation",
  },
  {
    id: "proposals",
    title: "عروض الاستشاريين",
    description: "تحليل مقارن للأتعاب المالية وعروض الأسعار لكل استشاري",
    icon: FileText,
    color: "from-emerald-500 to-teal-600",
    bgLight: "bg-emerald-50",
    textColor: "text-emerald-700",
    borderColor: "border-emerald-200",
    href: "/consultant-proposals",
  },
  {
    id: "know",
    title: "تعرف على الاستشاري",
    description: "معلومات شاملة عن كل مكتب استشاري: الموقع، التصنيف، الخبرة، وبيانات التواصل",
    icon: UserCircle,
    color: "from-violet-500 to-purple-600",
    bgLight: "bg-violet-50",
    textColor: "text-violet-700",
    borderColor: "border-violet-200",
    href: "/consultant-know",
  },
  {
    id: "recommend",
    title: "ماذا تقترح؟",
    description: "توصيات ذكية مبنية على بيانات التقييم والأتعاب حسب طبيعة كل مشروع",
    icon: Lightbulb,
    color: "from-sky-500 to-cyan-600",
    bgLight: "bg-sky-50",
    textColor: "text-sky-700",
    borderColor: "border-sky-200",
    href: "/consultant-recommend",
  },
  {
    id: "committee",
    title: "قرارات اللجنة",
    description: "القرارات النهائية للجنة مع تحليل ذكي لأسباب الاختيار والتفاوض",
    icon: ClipboardCheck,
    color: "from-rose-500 to-pink-600",
    bgLight: "bg-rose-50",
    textColor: "text-rose-700",
    borderColor: "border-rose-200",
    href: "/consultant-committee",
  },
  {
    id: "guide",
    title: "دليل التقييم التفصيلي",
    description: "شرح مفصل لكل معيار تقييم ومستويات النقاط لمساعدة أعضاء اللجنة",
    icon: BookOpen,
    color: "from-slate-500 to-gray-600",
    bgLight: "bg-slate-50",
    textColor: "text-slate-700",
    borderColor: "border-slate-200",
    href: "/consultant-guide",
  },
];

export default function ConsultantPortalPage() {
  const { isAuthenticated } = useAuth();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 via-white to-stone-100" dir="rtl">
      {/* Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-stone-800 via-stone-900 to-neutral-900" />
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)',
            backgroundSize: '32px 32px'
          }} />
        </div>
        <div className="relative max-w-6xl mx-auto px-6 py-12">
          <Link href="/" className="inline-flex items-center gap-2 text-stone-400 hover:text-white transition-colors mb-6 text-sm">
            <ArrowLeft className="w-4 h-4" />
            العودة للرئيسية
          </Link>
          <div className="flex items-start gap-5">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20 shrink-0">
              <Building2 className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
                مكاتب الاستشارات الهندسية
              </h1>
              <p className="text-lg text-amber-300 font-medium mb-1">شركاء المستقبل</p>
              <p className="text-stone-400 text-sm max-w-2xl">
                منصة شاملة لتقييم ومقارنة المكاتب الاستشارية الهندسية — من التقييم الفني إلى القرار النهائي
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Icons Grid */}
      <div className="max-w-6xl mx-auto px-6 -mt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {PORTAL_ICONS.map((item, index) => {
            const Icon = item.icon;
            const isHovered = hoveredId === item.id;
            return (
              <Link
                key={item.id}
                href={item.href}
                className="group block"
                onMouseEnter={() => setHoveredId(item.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <div
                  className={`relative bg-white rounded-2xl border ${item.borderColor} p-6 transition-all duration-300 ease-out ${
                    isHovered ? 'shadow-xl -translate-y-1 border-opacity-100' : 'shadow-sm hover:shadow-md border-opacity-60'
                  }`}
                  style={{ animationDelay: `${index * 80}ms` }}
                >
                  {/* Icon */}
                  <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center mb-4 shadow-md transition-transform duration-300 ${isHovered ? 'scale-110' : ''}`}>
                    <Icon className="w-7 h-7 text-white" />
                  </div>

                  {/* Content */}
                  <h3 className="text-lg font-bold text-stone-800 mb-2 group-hover:text-stone-900 transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-sm text-stone-500 leading-relaxed mb-4">
                    {item.description}
                  </p>

                  {/* Arrow */}
                  <div className={`flex items-center gap-1 text-sm font-medium ${item.textColor} transition-all duration-300 ${isHovered ? 'translate-x-[-4px]' : ''}`}>
                    <span>الدخول</span>
                    <ChevronLeft className={`w-4 h-4 transition-transform duration-300 ${isHovered ? 'translate-x-[-4px]' : ''}`} />
                  </div>

                  {/* Subtle gradient overlay on hover */}
                  <div className={`absolute inset-0 rounded-2xl ${item.bgLight} opacity-0 transition-opacity duration-300 pointer-events-none ${isHovered ? 'opacity-30' : ''}`} />
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Footer info */}
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="bg-stone-50 rounded-xl border border-stone-200 p-6">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-stone-200 flex items-center justify-center shrink-0 mt-0.5">
              <Building2 className="w-4 h-4 text-stone-600" />
            </div>
            <div>
              <h4 className="font-semibold text-stone-700 mb-1">كومو للتطوير العقاري</h4>
              <p className="text-sm text-stone-500 leading-relaxed">
                نظام متكامل لإدارة وتقييم المكاتب الاستشارية الهندسية. يتيح للجنة التقييم المكونة من ثلاثة أعضاء
                (الشيخ عيسى، وائل، عبدالرحمن) تقييم الاستشاريين بشكل مستقل مع عرض النتائج الفورية والتوصيات الذكية.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
