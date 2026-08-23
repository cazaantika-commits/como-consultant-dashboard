import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Link } from "wouter";
import { default as Star } from "lucide-react/dist/esm/icons/star.js";
import { default as FileText } from "lucide-react/dist/esm/icons/file-text.js";
import { default as UserCircle } from "lucide-react/dist/esm/icons/circle-user.js";
import { default as BookOpen } from "lucide-react/dist/esm/icons/book-open.js";
import { default as ArrowLeft } from "lucide-react/dist/esm/icons/arrow-left.js";
import { default as Building2 } from "lucide-react/dist/esm/icons/building-2.js";
import { default as ChevronLeft } from "lucide-react/dist/esm/icons/chevron-left.js";

const CONSULTANT_WORKFLOW = [
  { step: "01", title: "جهّز طلب العروض", description: "راجِع موجز المشروع والنطاق والبرنامج قبل مخاطبة أي مكتب.", href: "/consultant-appointment-pack", icon: FileText, tone: "border-sky-200 bg-sky-50 text-sky-800" },
  { step: "02", title: "حدّد المكاتب المناسبة", description: "أضف المكاتب إلى المشروع من القائمة الأساسية من دون تكرار بيانات التواصل.", href: "/consultant-know", icon: UserCircle, tone: "border-violet-200 bg-violet-50 text-violet-800" },
  { step: "03", title: "حلّل العرض والنطاق", description: "قارن العرض بالنطاق المطلوب وحدد فجوات التصاميم والإشراف لكل مكتب.", href: "/consultant-proposals", icon: FileText, tone: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  { step: "04", title: "وثّق التكلفة الحقيقية", description: "أدخل الأتعاب من العرض وراجع الفجوات؛ لا يُتخذ قرار تلقائي من هذا الجدول.", href: "/consultant-evaluation", icon: Star, tone: "border-amber-200 bg-amber-50 text-amber-800" },
  { step: "05", title: "قيّم وخذ قرار اللجنة", description: "التقييم الفني والقرار النهائي في مركز القيادة؛ الترتيب مرجع واللجنة صاحبة القرار.", href: "/command-center", icon: Building2, tone: "border-cyan-200 bg-cyan-50 text-cyan-800" },
  { step: "06", title: "وثّق العقد والتسليمات", description: "بعد القرار المؤكد فقط، سجّل العقد ثم تابع تسليماته من دون إعادة إدخال نطاقه.", href: "/contract-deliverables", icon: BookOpen, tone: "border-rose-200 bg-rose-50 text-rose-800" },
];

const PORTAL_ICONS = [
  {
    id: "evaluation",
    title: "الأتعاب المالية",
    description: "إدخال وإدارة أتعاب التصميم والإشراف لكل استشاري مع إضافة/إزالة الاستشاريين لكل مشروع",
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

      <section className="max-w-6xl mx-auto px-6 pt-8">
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold tracking-wide text-stone-500">مسار عمل واحد</p>
              <h2 className="mt-1 text-xl font-bold text-stone-900">من طلب العروض إلى التسليمات</h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-stone-600">هذه الخريطة ترتب الصفحات الحالية فقط. لا تنشئ عرضًا أو قرارًا أو عقدًا تلقائيًا، ولا تلغي أي صفحة موجودة.</p>
            </div>
            <span className="inline-flex w-fit rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">القرار النهائي يبقى للجنة</span>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {CONSULTANT_WORKFLOW.map((item) => {
              const StepIcon = item.icon;
              return (
                <Link key={item.step} href={item.href} className="group block">
                  <article className={`h-full rounded-xl border p-4 transition-all hover:-translate-y-0.5 hover:shadow-md ${item.tone}`}>
                    <div className="flex items-start gap-3">
                      <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-lg bg-white/85 px-2 text-xs font-bold shadow-sm">{item.step}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <StepIcon className="h-4 w-4 shrink-0" />
                          <h3 className="font-bold">{item.title}</h3>
                        </div>
                        <p className="mt-2 text-sm leading-6 opacity-85">{item.description}</p>
                        <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold opacity-90">فتح الخطوة <ChevronLeft className="h-3.5 w-3.5" /></span>
                      </div>
                    </div>
                  </article>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Icons Grid */}
      <div className="max-w-6xl mx-auto px-6 pt-6">
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
