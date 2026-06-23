import { Link } from "wouter";
import { ArrowLeft, BookOpen, ChevronDown, Scale, DollarSign, TrendingUp, Gavel, AlertTriangle, CheckCircle2, Info, Shield, Target, Sparkles, SlidersHorizontal, Building, Users } from "lucide-react";
import { useState } from "react";

// ═══ Technical Evaluation Criteria — ordered by weight (highest first) ═══
const CRITERIA_GUIDE = [
  {
    id: 0,
    name: "الهوية المعمارية وجودة التصميم",
    weight: 14.6,
    color: "from-amber-500 to-orange-600",
    bgLight: "bg-amber-50",
    borderColor: "border-amber-200",
    importance: "الهوية المعمارية هي أول ما يراه المشتري والمستثمر. تصميم مميز وأيقوني يرفع قيمة المشروع السوقية ويخلق عامل تمييز قوي في سوق دبي العقاري المزدحم. الاستشاري الذي يملك رؤية تصميمية واضحة يستطيع تحويل المبنى من مجرد هيكل إلى علامة تجارية معمارية تجذب المشترين وتحقق أسعار بيع أعلى.",
    levels: [
      { pct: 95, label: "طرح معماري مرجعي ذو هوية واضحة ومتماسكة بالكامل — فكرة تصميمية عميقة — لغة معمارية قابلة للتسويق والتميّز" },
      { pct: 93, label: "هوية قوية جداً — فكرة واضحة ومترابطة — معالجة الكتل والواجهات مدروسة" },
      { pct: 90, label: "هوية واضحة ومنظمة — تصميم متماسك" },
      { pct: 85, label: "تصميم جيد بفكرة مفهومة مع بعض التحفظات" },
      { pct: 80, label: "تصميم مقبول يفي بالأساسيات دون تميز" },
      { pct: 68, label: "طرح تقليدي أو غير مكتمل" },
      { pct: 50, label: "غياب واضح للهوية أو طرح غير مقنع" },
    ],
  },
  {
    id: 1,
    name: "قدرات الـ BIM والتكامل التقني",
    weight: 14.6,
    color: "from-emerald-500 to-teal-600",
    bgLight: "bg-emerald-50",
    borderColor: "border-emerald-200",
    importance: "تقنية BIM (نمذجة معلومات البناء) أصبحت معياراً أساسياً في المشاريع الحديثة. الاستشاري الذي يتقن BIM يستطيع اكتشاف التضاربات بين التخصصات قبل البناء، مما يوفر ملايين الدراهم في تكاليف التعديلات. مستوى LOD 300-350 يعني تفاصيل دقيقة كافية للتنفيذ المباشر.",
    levels: [
      { pct: 95, label: "BIM متكامل لكافة التخصصات — LOD 350+ — تقارير Clash Detection — BEP موثقة" },
      { pct: 91, label: "BIM متقدم — LOD 300–350 — تنسيق فعال بين التخصصات" },
      { pct: 84, label: "BIM جيد — LOD 300 مع تنسيق أساسي" },
      { pct: 72, label: "استخدام BIM جزئي أو غير مكتمل" },
      { pct: 45, label: "نمذجة شكلية دون تكامل فعلي" },
      { pct: 15, label: "لا يوجد استخدام حقيقي لـ BIM" },
    ],
  },
  {
    id: 2,
    name: "كفاءة التخطيط وتحسين المساحات",
    weight: 13.6,
    color: "from-sky-500 to-cyan-600",
    bgLight: "bg-sky-50",
    borderColor: "border-sky-200",
    importance: "كفاءة التخطيط تؤثر مباشرة على العائد المالي للمشروع. كل متر مربع مهدر هو خسارة مالية مباشرة. الاستشاري الذكي يعظّم المساحات القابلة للبيع ويقلل الممرات والفراغات الميتة. تخطيط الخدمات يجب أن يكون فعالاً دون أن يأكل من المساحات التجارية أو السكنية.",
    levels: [
      { pct: 95, label: "تخطيط استثنائي يعظم العائد والمساحات القابلة للبيع" },
      { pct: 92, label: "تخطيط ممتاز جداً بعائد قوي" },
      { pct: 87, label: "تخطيط قوي ومنطقي" },
      { pct: 82, label: "تخطيط جيد مع بعض التحسينات الممكنة" },
      { pct: 76, label: "تخطيط مقبول وظيفياً" },
      { pct: 58, label: "تخطيط ضعيف أو هدر ملحوظ" },
      { pct: 35, label: "تخطيط غير مناسب يؤثر على الجدوى" },
    ],
  },
  {
    id: 3,
    name: "التحكم في التكاليف والوعي بالميزانية",
    weight: 10.7,
    color: "from-rose-500 to-pink-600",
    bgLight: "bg-rose-50",
    borderColor: "border-rose-200",
    importance: "الاستشاري الواعي بالميزانية يصمم بذكاء — يختار مواد وحلول تحقق الجودة المطلوبة بأقل تكلفة ممكنة. قرارات التصميم تؤثر على 70-80% من تكلفة البناء. الوعي بالميزانية لا يعني التقشف بل الذكاء في توزيع الموارد.",
    levels: [
      { pct: 95, label: "قرارات تصميم تحقق أعلى جودة بأقل تكلفة — تطبيق Value Engineering فعلي" },
      { pct: 91, label: "وعي قوي جداً بالتكلفة مع بدائل واضحة" },
      { pct: 85, label: "التزام جيد بالميزانية" },
      { pct: 74, label: "التزام عام دون تحسينات قوية" },
      { pct: 52, label: "قرارات قد ترفع التكلفة دون دراسة كافية" },
      { pct: 30, label: "تجاهل واضح للميزانية — تضخم مالي خطير" },
    ],
  },
  {
    id: 4,
    name: "الخبرة في مشاريع مشابهة",
    weight: 9.7,
    color: "from-slate-500 to-gray-600",
    bgLight: "bg-slate-50",
    borderColor: "border-slate-200",
    importance: "الخبرة في مشاريع مشابهة من حيث النوع والحجم تعني أن الاستشاري يفهم التحديات المحددة لهذا النوع من المشاريع. استشاري عمل على عدة أبراج سكنية يعرف بالضبط كيف يوزع الشقق وكيف يتعامل مع متطلبات الجهات الحكومية.",
    levels: [
      { pct: 95, label: "تنفيذ عدة مشاريع مماثلة بالحجم والتعقيد مثبتة النتائج" },
      { pct: 89, label: "مشروعان قريبان جداً من حيث الحجم والتعقيد" },
      { pct: 82, label: "مشروع واحد مماثل بالحجم" },
      { pct: 74, label: "خبرة في مشاريع أقل حجماً من نفس الفئة" },
      { pct: 58, label: "خبرة عامة غير مماثلة" },
      { pct: 30, label: "لا يوجد Evidence حقيقي مناسب" },
    ],
  },
  {
    id: 5,
    name: "قوة فريق المشروع",
    weight: 9.7,
    color: "from-indigo-500 to-blue-600",
    bgLight: "bg-indigo-50",
    borderColor: "border-indigo-200",
    importance: "الفريق المخصص للمشروع هو من سيعمل يومياً على التصميم. حتى لو كان المكتب ممتازاً، إذا خصص فريقاً ضعيفاً أو مبتدئاً فالنتيجة ستكون ضعيفة. مشاركة القيادة العليا تعني اهتماماً حقيقياً بالمشروع وقرارات أسرع.",
    levels: [
      { pct: 95, label: "فريق خبير متكامل بقيادة مباشرة من الشركاء" },
      { pct: 92, label: "فريق قوي جداً متعدد التخصصات" },
      { pct: 86, label: "فريق مكتمل وجيد" },
      { pct: 80, label: "فريق متوسط جيد" },
      { pct: 74, label: "فريق مقبول بخبرة محدودة" },
      { pct: 58, label: "نقص واضح في التخصصات أو الخبرة" },
      { pct: 35, label: "فريق غير مؤهل لإدارة مشروع بالحجم المطلوب" },
    ],
  },
  {
    id: 6,
    name: "إدارة الوقت والانضباط بالبرنامج",
    weight: 9.7,
    color: "from-teal-500 to-green-600",
    bgLight: "bg-teal-50",
    borderColor: "border-teal-200",
    importance: "في المشاريع العقارية، الوقت هو مال. كل شهر تأخير في التصميم يعني تأخيراً في البناء وتأخيراً في البيع والتسليم. الاستشاري المنضبط زمنياً يلتزم بالجدول ويسلم الموافقات في وقتها.",
    levels: [
      { pct: 95, label: "سجل ممتاز جداً في الالتزام بالجداول الزمنية" },
      { pct: 91, label: "سجل قوي مع تأخيرات طفيفة" },
      { pct: 85, label: "التزام جيد إجمالاً" },
      { pct: 74, label: "تأخيرات محدودة يمكن السيطرة عليها" },
      { pct: 55, label: "تأخيرات متكررة" },
      { pct: 30, label: "سجل خطير في عدم الالتزام" },
    ],
  },
  {
    id: 7,
    name: "الاهتمام بالمشروع",
    weight: 9.2,
    color: "from-orange-500 to-red-600",
    bgLight: "bg-orange-50",
    borderColor: "border-orange-200",
    importance: "هل المشروع أولوية لدى الاستشاري أم مجرد مشروع عادي ضمن عشرات المشاريع؟ الاستشاري الذي يعتبر مشروعك أولوية سيخصص أفضل كوادره، يستجيب بسرعة، ويبذل جهداً إضافياً.",
    levels: [
      { pct: 95, label: "اعتبار المشروع أولوية قصوى — مشاركة الإدارة العليا" },
      { pct: 90, label: "اهتمام خاص واضح وتفاعل سريع" },
      { pct: 82, label: "اهتمام عادي مقبول" },
      { pct: 70, label: "تفاعل محدود أو بطيء" },
      { pct: 55, label: "ضعف واضح في الاهتمام" },
    ],
  },
  {
    id: 8,
    name: "مرونة التعاقد",
    weight: 8.2,
    color: "from-cyan-500 to-blue-600",
    bgLight: "bg-cyan-50",
    borderColor: "border-cyan-200",
    importance: "المشاريع العقارية تتطلب تعديلات مستمرة أثناء التصميم. الاستشاري المرن يتقبل هذه التعديلات ضمن نطاق العمل المعقول دون مطالبات مالية مبالغ فيها. الاستشاري الجامد يحول كل تعديل صغير إلى أمر تغيير مكلف.",
    levels: [
      { pct: 95, label: "مرونة عالية جداً واستعداد لتعديل الشروط" },
      { pct: 90, label: "مرونة جيدة" },
      { pct: 82, label: "موقف تعاقدي قياسي" },
      { pct: 72, label: "تشدد نسبي في بعض البنود" },
      { pct: 60, label: "جمود واضح وصعوبة تفاوض" },
    ],
  },
];

// ═══ Section Navigation ═══
const SECTIONS = [
  { id: 'overview', label: 'نظرة عامة', icon: BookOpen },
  { id: 'workflow', label: 'سير العمل', icon: Target },
  { id: 'technical', label: 'التقييم الفني', icon: Scale },
  { id: 'financial', label: 'التقييم المالي', icon: DollarSign },
  { id: 'penalty', label: 'نظام العقوبات', icon: Shield },
  { id: 'value', label: 'تحليل القيمة', icon: SlidersHorizontal },
  { id: 'committee', label: 'قرار اللجنة', icon: Gavel },
  { id: 'criteria', label: 'تفصيل المعايير', icon: Info },
];

// ═══ Criterion Card Component ═══
function CriterionCard({ criterion, index }: { criterion: typeof CRITERIA_GUIDE[0]; index: number }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={`bg-white rounded-2xl border ${criterion.borderColor} overflow-hidden transition-all duration-300 shadow-sm hover:shadow-md`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-4 p-5 text-right hover:bg-stone-50/50 transition-colors"
      >
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-stone-400 font-bold text-lg w-8 text-center">{index + 1}</span>
          <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${criterion.color} flex items-center justify-center shadow-md`}>
            <span className="text-white font-bold text-sm">{criterion.weight}%</span>
          </div>
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-bold text-stone-800">{criterion.name}</h3>
          <p className="text-sm text-stone-500">الوزن: {criterion.weight}% من إجمالي التقييم الفني</p>
        </div>
        <ChevronDown className={`w-5 h-5 text-stone-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="px-5 pb-5 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className={`${criterion.bgLight} rounded-xl p-4 border ${criterion.borderColor}`}>
            <h4 className="font-semibold text-stone-700 mb-2 flex items-center gap-2">
              لماذا هذا المعيار مهم؟
            </h4>
            <p className="text-sm text-stone-600 leading-relaxed">{criterion.importance}</p>
          </div>

          <div className="space-y-3">
            <h4 className="font-semibold text-stone-700 flex items-center gap-2">
              مستويات التقييم — ماذا تعني كل نسبة؟
            </h4>
            {criterion.levels.map((level) => (
              <div key={level.pct} className="flex gap-3 items-start">
                <div className={`w-16 h-12 rounded-lg flex items-center justify-center shrink-0 font-bold text-sm ${
                  level.pct >= 90 ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                  level.pct >= 80 ? 'bg-sky-100 text-sky-700 border border-sky-200' :
                  level.pct >= 70 ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                  level.pct >= 50 ? 'bg-orange-100 text-orange-700 border border-orange-200' :
                  'bg-red-100 text-red-700 border border-red-200'
                }`}>
                  {level.pct}%
                </div>
                <div className="flex-1">
                  <p className="text-sm text-stone-600 leading-relaxed">{level.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══ Main Guide Page ═══
export default function ConsultantGuidePage() {
  const [activeSection, setActiveSection] = useState('overview');

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 via-white to-stone-100" dir="rtl">
      {/* Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-stone-700 via-stone-800 to-neutral-900" />
        <div className="relative max-w-5xl mx-auto px-6 py-10">
          <Link href="/consultant-portal" className="inline-flex items-center gap-2 text-stone-400 hover:text-white transition-colors mb-4 text-sm">
            <ArrowLeft className="w-4 h-4" />
            العودة لبوابة المكاتب الاستشارية
          </Link>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shrink-0">
              <BookOpen className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">دليل التقييم الشامل</h1>
              <p className="text-stone-400 text-sm mt-1">المرجع الكامل لمنهجية تقييم واختيار الاستشاريين — من التقييم الفني إلى قرار اللجنة النهائي</p>
            </div>
          </div>
        </div>
      </div>

      {/* Section Navigation */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-stone-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex gap-1 overflow-x-auto py-2 scrollbar-hide">
            {SECTIONS.map((section) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  onClick={() => {
                    setActiveSection(section.id);
                    document.getElementById(`section-${section.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                    activeSection === section.id
                      ? 'bg-amber-100 text-amber-800 shadow-sm'
                      : 'text-stone-500 hover:text-stone-700 hover:bg-stone-100'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {section.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-10">

        {/* ═══ Section 1: Overview ═══ */}
        <section id="section-overview">
          <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-sm">
            <h2 className="text-xl font-bold text-stone-800 mb-4 flex items-center gap-3">
              <BookOpen className="w-6 h-6 text-amber-600" />
              نظرة عامة على منهجية التقييم
            </h2>
            <div className="space-y-4 text-sm text-stone-600 leading-relaxed">
              <p>
                يعتمد نظام تقييم الاستشاريين في كومو على <strong className="text-stone-800">أربع مراحل متتالية</strong> مصممة لضمان اختيار الاستشاري الأنسب لكل مشروع. يجمع النظام بين التقييم الفني للكفاءات والتقييم المالي للأتعاب، ثم يدمجهما في تحليل قيمة مركّب، وصولاً إلى قرار اللجنة السيادي النهائي.
              </p>

              {/* 4 Stages Overview */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-4 text-center">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mx-auto mb-3 shadow-md">
                    <Scale className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-xs font-bold text-blue-500 mb-1">المرحلة الأولى</div>
                  <h3 className="font-bold text-stone-800 text-sm">التقييم الفني</h3>
                  <p className="text-xs text-stone-500 mt-1">9 معايير بأوزان محددة</p>
                  <p className="text-xs text-stone-500">3 مقيّمين مستقلين</p>
                </div>
                <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl border border-emerald-200 p-4 text-center">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center mx-auto mb-3 shadow-md">
                    <DollarSign className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-xs font-bold text-emerald-500 mb-1">المرحلة الثانية</div>
                  <h3 className="font-bold text-stone-800 text-sm">التقييم المالي</h3>
                  <p className="text-xs text-stone-500 mt-1">أتعاب التصميم والإشراف</p>
                  <p className="text-xs text-stone-500">تحليل الانحرافات</p>
                </div>
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-amber-200 p-4 text-center">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center mx-auto mb-3 shadow-md">
                    <SlidersHorizontal className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-xs font-bold text-amber-500 mb-1">المرحلة الثالثة</div>
                  <h3 className="font-bold text-stone-800 text-sm">تحليل القيمة</h3>
                  <p className="text-xs text-stone-500 mt-1">دمج الفني × المالي</p>
                  <p className="text-xs text-stone-500">أوزان قابلة للتعديل</p>
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-xl border border-purple-200 p-4 text-center">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center mx-auto mb-3 shadow-md">
                    <Gavel className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-xs font-bold text-purple-500 mb-1">المرحلة الرابعة</div>
                  <h3 className="font-bold text-stone-800 text-sm">قرار اللجنة</h3>
                  <p className="text-xs text-stone-500 mt-1">القرار السيادي النهائي</p>
                  <p className="text-xs text-stone-500">مدعوم بتحليل ذكي</p>
                </div>
              </div>

              <div className="bg-amber-50 rounded-xl border border-amber-200 p-4 mt-4">
                <p className="text-sm text-amber-800">
                  <strong>مبدأ أساسي:</strong> الترتيب في أي مرحلة هو <strong>مرجع استرشادي فقط</strong> ولا يُلزم اللجنة. القرار النهائي سيادي بالكامل — يحق للجنة اختيار أي استشاري بناءً على أي معيار تراه مناسباً، مع توثيق المبررات.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ Section 2: Workflow ═══ */}
        <section id="section-workflow">
          <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-sm">
            <h2 className="text-xl font-bold text-stone-800 mb-4 flex items-center gap-3">
              <Target className="w-6 h-6 text-amber-600" />
              سير العمل — أين يتم ماذا؟
            </h2>
            <div className="space-y-4 text-sm text-stone-600 leading-relaxed">
              <p>
                النظام مصمم بفصل واضح بين <strong className="text-stone-800">إدخال البيانات</strong> و<strong className="text-stone-800">اتخاذ القرارات</strong> لضمان الشفافية والدقة:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                {/* Portal */}
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border border-emerald-200 p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-emerald-600 flex items-center justify-center">
                      <Building className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-emerald-800">بوابة المكاتب الاستشارية</h3>
                      <p className="text-xs text-emerald-600">مكان إدخال البيانات</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-medium text-stone-700">تقييم الاستشاريين (المالي)</p>
                        <p className="text-xs text-stone-500">إدخال أتعاب التصميم والإشراف لكل استشاري — يقوم به الوكيل من قراءة العروض</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-medium text-stone-700">عروض الاستشاريين</p>
                        <p className="text-xs text-stone-500">ملخص مقارن للعروض المقدمة</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-medium text-stone-700">تعرف على الاستشاري</p>
                        <p className="text-xs text-stone-500">معلومات تفصيلية عن كل مكتب استشاري</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-medium text-stone-700">دليل التقييم التفصيلي</p>
                        <p className="text-xs text-stone-500">هذه الصفحة — المرجع الشامل للمنهجية</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Command Center */}
                <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-xl border border-purple-200 p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-purple-600 flex items-center justify-center">
                      <Gavel className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-purple-800">مركز القيادة</h3>
                      <p className="text-xs text-purple-600">مكان التقييم واتخاذ القرارات</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-start gap-2">
                      <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center mt-0.5 shrink-0">
                        <span className="text-[8px] text-white font-bold">1</span>
                      </div>
                      <div>
                        <p className="font-medium text-stone-700">التقييم المالي (عرض فقط)</p>
                        <p className="text-xs text-stone-500">عرض البيانات المالية المُدخلة من البوابة — للمراجعة والمقارنة</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center mt-0.5 shrink-0">
                        <span className="text-[8px] text-white font-bold">2</span>
                      </div>
                      <div>
                        <p className="font-medium text-stone-700">التقييم الفني (تقييم تفاعلي)</p>
                        <p className="text-xs text-stone-500">3 أعضاء يقيّمون كل استشاري على 9 معايير — مع نظام اعتماد</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center mt-0.5 shrink-0">
                        <span className="text-[8px] text-white font-bold">3</span>
                      </div>
                      <div>
                        <p className="font-medium text-stone-700">تحليل القيمة</p>
                        <p className="text-xs text-stone-500">دمج الفني والمالي بأوزان قابلة للتعديل</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-4 h-4 rounded-full bg-purple-500 flex items-center justify-center mt-0.5 shrink-0">
                        <span className="text-[8px] text-white font-bold">4</span>
                      </div>
                      <div>
                        <p className="font-medium text-stone-700">قرار اللجنة</p>
                        <p className="text-xs text-stone-500">اختيار الاستشاري مع تحليل ذكي وتوثيق المبررات</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 rounded-xl border border-blue-200 p-4 mt-2">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                  <p className="text-sm text-blue-800">
                    <strong>ملاحظة:</strong> البيانات المالية تُدخل مرة واحدة في البوابة (عادةً بواسطة الوكيل الذكي من قراءة عروض الاستشاريين)، ثم تنعكس تلقائياً في مركز القيادة. أما التقييم الفني فيتم حصرياً في مركز القيادة بواسطة أعضاء اللجنة الثلاثة.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ Section 3: Technical Evaluation ═══ */}
        <section id="section-technical">
          <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-sm">
            <h2 className="text-xl font-bold text-stone-800 mb-4 flex items-center gap-3">
              <Scale className="w-6 h-6 text-blue-600" />
              المرحلة الأولى: التقييم الفني
            </h2>
            <div className="space-y-4 text-sm text-stone-600 leading-relaxed">
              <p>
                التقييم الفني هو الركيزة الأساسية في عملية اختيار الاستشاري. يتم تقييم كل استشاري على <strong className="text-stone-800">9 معايير فنية</strong> بأوزان محددة مجموعها 100%. يقوم بالتقييم <strong className="text-stone-800">3 أعضاء مستقلين</strong> (الشيخ عيسى، وائل، عبدالرحمن) والنتيجة النهائية هي متوسط التقييمات الثلاثة.
              </p>

              {/* Evaluators */}
              <div className="bg-indigo-50 rounded-xl border border-indigo-200 p-4">
                <h3 className="font-bold text-indigo-800 mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  أعضاء لجنة التقييم الفني
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center bg-white rounded-lg p-3 border border-indigo-100">
                    <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center mx-auto mb-2">
                      <span className="text-white font-bold text-sm">ش.ع</span>
                    </div>
                    <p className="font-bold text-stone-800 text-sm">الشيخ عيسى</p>
                  </div>
                  <div className="text-center bg-white rounded-lg p-3 border border-indigo-100">
                    <div className="w-10 h-10 rounded-full bg-teal-600 flex items-center justify-center mx-auto mb-2">
                      <span className="text-white font-bold text-sm">و</span>
                    </div>
                    <p className="font-bold text-stone-800 text-sm">وائل</p>
                  </div>
                  <div className="text-center bg-white rounded-lg p-3 border border-indigo-100">
                    <div className="w-10 h-10 rounded-full bg-amber-600 flex items-center justify-center mx-auto mb-2">
                      <span className="text-white font-bold text-sm">ع</span>
                    </div>
                    <p className="font-bold text-stone-800 text-sm">عبدالرحمن</p>
                  </div>
                </div>
              </div>

              {/* How it works */}
              <div className="space-y-3">
                <h3 className="font-bold text-stone-700">آلية الحساب:</h3>
                <div className="bg-stone-50 rounded-xl border border-stone-200 p-4 space-y-2">
                  <p>1. كل معيار يُقيّم باختيار <strong className="text-stone-800">نسبة مئوية</strong> تعكس مستوى أداء الاستشاري (من أعلى مستوى إلى أدنى مستوى).</p>
                  <p>2. <strong className="text-stone-800">النتيجة لكل معيار</strong> = النسبة المختارة × وزن المعيار.</p>
                  <p>3. <strong className="text-stone-800">النتيجة الإجمالية</strong> = مجموع نتائج كل المعايير التسعة.</p>
                  <p>4. <strong className="text-stone-800">النتيجة النهائية</strong> = متوسط تقييمات الأعضاء الثلاثة.</p>
                </div>
              </div>

              {/* Example */}
              <div className="bg-blue-50 rounded-xl border border-blue-200 p-4">
                <h3 className="font-bold text-blue-800 mb-2">مثال عملي:</h3>
                <p className="text-blue-700">
                  إذا حصل استشاري على <strong>90%</strong> في معيار "الهوية المعمارية" (وزنه 14.6%)، فالنتيجة = 90% × 14.6% = <strong>13.14 نقطة</strong>.
                  بتكرار ذلك على كل المعايير التسعة ثم جمع النتائج، نحصل على الدرجة الفنية الإجمالية (مثلاً: <strong>85.7 من 100</strong>).
                </p>
              </div>

              {/* Weights Summary Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-stone-300">
                      <th className="text-right py-2 px-3 text-stone-600 font-bold">#</th>
                      <th className="text-right py-2 px-3 text-stone-600 font-bold">المعيار</th>
                      <th className="text-center py-2 px-3 text-stone-600 font-bold">الوزن</th>
                      <th className="text-center py-2 px-3 text-stone-600 font-bold">نطاق النسبة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {CRITERIA_GUIDE.map((c, i) => (
                      <tr key={c.id} className="border-b border-stone-100 last:border-0">
                        <td className="py-2.5 px-3 text-stone-400 font-medium">{i + 1}</td>
                        <td className="py-2.5 px-3 font-medium text-stone-700">{c.name}</td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-gradient-to-br ${c.color} text-white`}>
                            {c.weight}%
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center text-stone-500">
                          {c.levels[c.levels.length - 1].pct}% — {c.levels[0].pct}%
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-stone-100 font-bold border-t-2 border-stone-300">
                      <td className="py-2.5 px-3"></td>
                      <td className="py-2.5 px-3 text-stone-800">المجموع</td>
                      <td className="py-2.5 px-3 text-center text-stone-800">100%</td>
                      <td className="py-2.5 px-3"></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Approval System */}
              <div className="bg-rose-50 rounded-xl border border-rose-200 p-4">
                <h3 className="font-bold text-rose-800 mb-2 flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  نظام اعتماد التقييم
                </h3>
                <p className="text-rose-700 text-sm">
                  يبقى التقييم كـ<strong>"مسودة"</strong> قابلة للتعديل حتى يضغط المقيّم على زر <strong>"اعتماد التقييم"</strong>. يظهر تحذير تأكيدي قبل الاعتماد. بعد الاعتماد، <strong>لا يمكن تعديل التقييم</strong> — وهذا يضمن نزاهة العملية ويمنع التلاعب بالنتائج بعد الاطلاع على تقييمات الآخرين.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ Section 4: Financial Evaluation ═══ */}
        <section id="section-financial">
          <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-sm">
            <h2 className="text-xl font-bold text-stone-800 mb-4 flex items-center gap-3">
              <DollarSign className="w-6 h-6 text-emerald-600" />
              المرحلة الثانية: التقييم المالي
            </h2>
            <div className="space-y-4 text-sm text-stone-600 leading-relaxed">
              <p>
                التقييم المالي يحلل أتعاب الاستشاريين المقدمة في عروضهم. يتم إدخال البيانات في <strong className="text-stone-800">بوابة المكاتب الاستشارية</strong> (عادةً بواسطة الوكيل الذكي الذي يقرأ عروض الأسعار)، ثم تنعكس تلقائياً في مركز القيادة.
              </p>

              {/* Fee Structure */}
              <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-4">
                <h3 className="font-bold text-emerald-800 mb-3">هيكل الأتعاب:</h3>
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                    <p><strong className="text-stone-700">أتعاب التصميم:</strong> إما نسبة مئوية (%) من تكلفة البناء، أو مبلغ مقطوع (Lump Sum).</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                    <p><strong className="text-stone-700">أتعاب الإشراف:</strong> إما نسبة مئوية (%) من تكلفة البناء، أو مبلغ مقطوع (Lump Sum).</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                    <p><strong className="text-stone-700">إجمالي الأتعاب:</strong> مجموع أتعاب التصميم + أتعاب الإشراف (محسوبة بالدرهم الإماراتي).</p>
                  </div>
                </div>
              </div>

              {/* Scoring Method */}
              <div className="bg-stone-50 rounded-xl border border-stone-200 p-4">
                <h3 className="font-bold text-stone-700 mb-3">آلية احتساب الدرجة المالية:</h3>
                <div className="space-y-3">
                  <p>
                    الاستشاري صاحب <strong className="text-stone-800">أقل أتعاب إجمالية</strong> يحصل على <strong className="text-blue-700">100%</strong> كدرجة مالية. بقية الاستشاريين يحصلون على درجة نسبية محسوبة كالتالي:
                  </p>
                  <div className="bg-white rounded-lg border border-stone-300 p-4 text-center">
                    <p className="text-lg font-bold text-stone-800" dir="ltr">
                      Financial Score = (Lowest Fee ÷ Consultant Fee) × 100
                    </p>
                  </div>
                  <div className="bg-blue-50 rounded-lg border border-blue-200 p-3">
                    <p className="text-blue-800">
                      <strong>مثال:</strong> إذا كان أقل أتعاب = 2,000,000 د.إ واستشاري آخر أتعابه = 2,500,000 د.إ، فدرجته المالية = (2,000,000 ÷ 2,500,000) × 100 = <strong>80%</strong>
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-amber-800">
                    <strong>تنبيه مهم:</strong> يجب التمييز بين نوع الأتعاب — إذا كان العرض بنسبة مئوية يُسجل كنسبة، وإذا كان بمبلغ مقطوع يُسجل كمبلغ. لا يجوز تحويل النسبة إلى مبلغ يدوياً لأن ذلك قد يُنتج أرقاماً غير دقيقة. النظام يحسب المبلغ تلقائياً بناءً على تكلفة البناء المُدخلة.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ Section 5: Penalty System ═══ */}
        <section id="section-penalty">
          <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-sm">
            <h2 className="text-xl font-bold text-stone-800 mb-4 flex items-center gap-3">
              <Shield className="w-6 h-6 text-red-600" />
              نظام العقوبات والانحرافات — Safety First
            </h2>
            <div className="space-y-4 text-sm text-stone-600 leading-relaxed">
              <p>
                لحماية المشروع من المخاطر المالية، يطبق النظام تحليل انحراف تلقائي يقارن أتعاب كل استشاري بمتوسط أتعاب جميع الاستشاريين. هذا النظام <strong className="text-stone-800">لا يُقصي أي استشاري تلقائياً</strong>، بل يؤثر فقط على الدرجة المالية في تحليل القيمة ويُظهر تحذيرات مرئية للجنة.
              </p>

              {/* Deviation Zones */}
              <div className="space-y-3">
                <h3 className="font-bold text-stone-700">مناطق الانحراف:</h3>

                {/* Normal */}
                <div className="bg-green-50 rounded-xl border border-green-200 p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-green-600 flex items-center justify-center">
                      <CheckCircle2 className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h4 className="font-bold text-green-800">النطاق الطبيعي</h4>
                      <p className="text-xs text-green-600">الانحراف ≤ ±15% عن المتوسط</p>
                    </div>
                  </div>
                  <p className="text-green-700 mr-11">
                    لا توجد عقوبة. الأتعاب ضمن النطاق المعقول والمقبول. المقارنة تتم بشكل طبيعي.
                  </p>
                </div>

                {/* Moderate High */}
                <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-amber-600 flex items-center justify-center">
                      <AlertTriangle className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h4 className="font-bold text-amber-800">انحراف مرتفع معتدل</h4>
                      <p className="text-xs text-amber-600">الانحراف بين +15% و +30% فوق المتوسط</p>
                    </div>
                  </div>
                  <p className="text-amber-700 mr-11">
                    عقوبة <strong>7 نقاط</strong> تُخصم من الدرجة المالية في تحليل القيمة. الأتعاب أعلى من المتوسط بشكل ملحوظ — يجب التحقق من المبررات.
                  </p>
                </div>

                {/* Extreme High */}
                <div className="bg-red-50 rounded-xl border border-red-200 p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center">
                      <AlertTriangle className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h4 className="font-bold text-red-800">انحراف مرتفع جداً</h4>
                      <p className="text-xs text-red-600">الانحراف أكثر من +30% فوق المتوسط</p>
                    </div>
                  </div>
                  <p className="text-red-700 mr-11">
                    عقوبة <strong>15 نقطة</strong> تُخصم من الدرجة المالية + علامة تحذير <strong>"خطر تكلفة مرتفعة"</strong>. هذا لا يعني رفض الاستشاري، لكنه يشير إلى مخاطر مالية كبيرة تستوجب مبررات قوية.
                  </p>
                </div>

                {/* Extreme Low */}
                <div className="bg-blue-50 rounded-xl border border-blue-200 p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                      <Info className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h4 className="font-bold text-blue-800">انحراف منخفض جداً</h4>
                      <p className="text-xs text-blue-600">الانحراف أكثر من -30% تحت المتوسط</p>
                    </div>
                  </div>
                  <p className="text-blue-700 mr-11">
                    <strong>لا توجد عقوبة</strong>، لكن تظهر علامة <strong>"خطر أتعاب منخفضة"</strong>. الأتعاب المنخفضة جداً قد تشير إلى نقص في نطاق العمل أو جودة الخدمة — يجب التحقق.
                  </p>
                </div>
              </div>

              {/* Summary Table */}
              <div className="overflow-x-auto mt-2">
                <table className="w-full text-sm border border-stone-200 rounded-lg overflow-hidden">
                  <thead>
                    <tr className="bg-stone-100">
                      <th className="text-right py-2.5 px-3 font-bold text-stone-700 border-b border-stone-200">المنطقة</th>
                      <th className="text-center py-2.5 px-3 font-bold text-stone-700 border-b border-stone-200">نطاق الانحراف</th>
                      <th className="text-center py-2.5 px-3 font-bold text-stone-700 border-b border-stone-200">العقوبة</th>
                      <th className="text-center py-2.5 px-3 font-bold text-stone-700 border-b border-stone-200">التحذير</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-stone-100">
                      <td className="py-2.5 px-3 font-medium text-green-700">النطاق الطبيعي</td>
                      <td className="text-center py-2.5 px-3 text-stone-600">±15%</td>
                      <td className="text-center py-2.5 px-3 text-green-600 font-bold">0 نقاط</td>
                      <td className="text-center py-2.5 px-3 text-stone-400">—</td>
                    </tr>
                    <tr className="border-b border-stone-100">
                      <td className="py-2.5 px-3 font-medium text-amber-700">انحراف مرتفع معتدل</td>
                      <td className="text-center py-2.5 px-3 text-stone-600">+15% إلى +30%</td>
                      <td className="text-center py-2.5 px-3 text-amber-600 font-bold">-7 نقاط</td>
                      <td className="text-center py-2.5 px-3 text-stone-400">—</td>
                    </tr>
                    <tr className="border-b border-stone-100">
                      <td className="py-2.5 px-3 font-medium text-red-700">انحراف مرتفع جداً</td>
                      <td className="text-center py-2.5 px-3 text-stone-600">أكثر من +30%</td>
                      <td className="text-center py-2.5 px-3 text-red-600 font-bold">-15 نقطة</td>
                      <td className="text-center py-2.5 px-3 text-red-600">خطر تكلفة مرتفعة</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-medium text-blue-700">انحراف منخفض جداً</td>
                      <td className="text-center py-2.5 px-3 text-stone-600">أكثر من -30%</td>
                      <td className="text-center py-2.5 px-3 text-green-600 font-bold">0 نقاط</td>
                      <td className="text-center py-2.5 px-3 text-blue-600">خطر أتعاب منخفضة</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="bg-stone-50 rounded-xl border border-stone-200 p-4">
                <p className="text-stone-700">
                  <strong>الهدف من النظام:</strong> منع مكافأة التسعير المبالغ فيه مع الحفاظ على مرونة اللجنة في اتخاذ القرار. العقوبات تؤثر فقط على <strong>تحليل القيمة المركّب</strong> ولا تُقصي أي استشاري من المنافسة.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ Section 6: Value Analysis ═══ */}
        <section id="section-value">
          <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-sm">
            <h2 className="text-xl font-bold text-stone-800 mb-4 flex items-center gap-3">
              <SlidersHorizontal className="w-6 h-6 text-amber-600" />
              المرحلة الثالثة: تحليل القيمة المركّب
            </h2>
            <div className="space-y-4 text-sm text-stone-600 leading-relaxed">
              <p>
                تحليل القيمة يدمج نتائج التقييم الفني والمالي في <strong className="text-stone-800">درجة مركّبة واحدة</strong> تعكس القيمة الإجمالية لكل استشاري. الأوزان الافتراضية هي <strong className="text-blue-700">60% فني</strong> و<strong className="text-emerald-700">40% مالي</strong>، لكنها <strong className="text-stone-800">قابلة للتعديل</strong> عبر شريط تمرير تفاعلي في مركز القيادة.
              </p>

              {/* Formula */}
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200 p-5">
                <h3 className="font-bold text-amber-800 mb-3 text-center">معادلة تحليل القيمة</h3>
                <div className="bg-white rounded-lg border border-amber-300 p-4 text-center">
                  <p className="text-lg font-bold text-stone-800" dir="ltr">
                    Value Score = (Technical Score × Technical Weight) + (Adjusted Financial Score × Financial Weight)
                  </p>
                </div>
                <div className="mt-3 text-center text-sm text-amber-700">
                  <p>حيث: <strong>Adjusted Financial Score</strong> = الدرجة المالية − العقوبة (إن وجدت)</p>
                </div>
              </div>

              {/* Weight Explanation */}
              <div className="bg-stone-50 rounded-xl border border-stone-200 p-4">
                <h3 className="font-bold text-stone-700 mb-3">الأوزان وتأثيرها:</h3>
                <div className="space-y-2">
                  <p>يمكن تعديل الأوزان حسب أولويات المشروع:</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
                    <div className="bg-blue-50 rounded-lg border border-blue-200 p-3 text-center">
                      <p className="text-xs text-blue-500 font-bold mb-1">تركيز على الجودة</p>
                      <p className="text-lg font-bold text-blue-700">80% فني</p>
                      <p className="text-lg font-bold text-emerald-600">20% مالي</p>
                      <p className="text-[10px] text-stone-500 mt-1">للمشاريع الفاخرة والمعقدة</p>
                    </div>
                    <div className="bg-amber-50 rounded-lg border border-amber-200 p-3 text-center">
                      <p className="text-xs text-amber-500 font-bold mb-1">توازن (الافتراضي)</p>
                      <p className="text-lg font-bold text-blue-700">60% فني</p>
                      <p className="text-lg font-bold text-emerald-600">40% مالي</p>
                      <p className="text-[10px] text-stone-500 mt-1">للمشاريع المتوسطة</p>
                    </div>
                    <div className="bg-emerald-50 rounded-lg border border-emerald-200 p-3 text-center">
                      <p className="text-xs text-emerald-500 font-bold mb-1">تركيز على التكلفة</p>
                      <p className="text-lg font-bold text-blue-700">40% فني</p>
                      <p className="text-lg font-bold text-emerald-600">60% مالي</p>
                      <p className="text-[10px] text-stone-500 mt-1">للمشاريع ذات الميزانية المحدودة</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Full Example */}
              <div className="bg-blue-50 rounded-xl border border-blue-200 p-4">
                <h3 className="font-bold text-blue-800 mb-2">مثال شامل:</h3>
                <div className="space-y-2 text-blue-700">
                  <p>استشاري حصل على: درجة فنية = <strong>85</strong>، درجة مالية = <strong>90%</strong>، عقوبة انحراف = <strong>0</strong></p>
                  <p>بأوزان 60% فني / 40% مالي:</p>
                  <p className="bg-white rounded-lg border border-blue-200 p-2 text-center font-bold" dir="ltr">
                    Value = (85 × 60%) + (90 × 40%) = 51 + 36 = <span className="text-lg text-amber-700">87.0</span>
                  </p>
                  <p className="mt-2">استشاري آخر: درجة فنية = <strong>78</strong>، درجة مالية = <strong>95%</strong>، عقوبة = <strong>0</strong></p>
                  <p className="bg-white rounded-lg border border-blue-200 p-2 text-center font-bold" dir="ltr">
                    Value = (78 × 60%) + (95 × 40%) = 46.8 + 38 = <span className="text-lg text-amber-700">84.8</span>
                  </p>
                  <p className="text-sm mt-2">في هذا المثال، الاستشاري الأول أفضل قيمة رغم أن الثاني أرخص — لأن الفارق الفني (7 نقاط) أكبر من الميزة المالية.</p>
                </div>
              </div>

              <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
                <p className="text-amber-800">
                  <strong>تذكير:</strong> تحليل القيمة هو <strong>أداة استرشادية</strong> تساعد اللجنة في فهم العلاقة بين الجودة والتكلفة. النتيجة لا تُلزم اللجنة باتخاذ أي قرار محدد.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ Section 7: Committee Decision ═══ */}
        <section id="section-committee">
          <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-sm">
            <h2 className="text-xl font-bold text-stone-800 mb-4 flex items-center gap-3">
              <Gavel className="w-6 h-6 text-purple-600" />
              المرحلة الرابعة: قرار اللجنة السيادي
            </h2>
            <div className="space-y-4 text-sm text-stone-600 leading-relaxed">
              <p>
                المرحلة النهائية والأهم في عملية اختيار الاستشاري. <strong className="text-stone-800">القرار سيادي بالكامل</strong> — يحق للجنة اختيار أي استشاري بناءً على أي معيار تراه مناسباً، سواء كان الأعلى فنياً، أو الأفضل قيمة، أو الأقل تكلفة، أو حتى الأعلى تكلفة إذا كانت هناك مبررات.
              </p>

              {/* Decision Bases */}
              <div className="bg-purple-50 rounded-xl border border-purple-200 p-4">
                <h3 className="font-bold text-purple-800 mb-3">أسس القرار المتاحة:</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-white rounded-lg border border-purple-100 p-3">
                    <p className="font-bold text-stone-700 text-sm">أفضل قيمة (Best Value)</p>
                    <p className="text-xs text-stone-500">اختيار الاستشاري الحاصل على أعلى درجة في تحليل القيمة المركّب</p>
                  </div>
                  <div className="bg-white rounded-lg border border-purple-100 p-3">
                    <p className="font-bold text-stone-700 text-sm">الأعلى فنياً (Best Technical)</p>
                    <p className="text-xs text-stone-500">اختيار الاستشاري الحاصل على أعلى درجة فنية بغض النظر عن التكلفة</p>
                  </div>
                  <div className="bg-white rounded-lg border border-purple-100 p-3">
                    <p className="font-bold text-stone-700 text-sm">الأقل تكلفة (Lowest Fee)</p>
                    <p className="text-xs text-stone-500">اختيار الاستشاري الأرخص مع ضمان حد أدنى من الجودة الفنية</p>
                  </div>
                  <div className="bg-white rounded-lg border border-purple-100 p-3">
                    <p className="font-bold text-stone-700 text-sm">قرار خاص (Custom)</p>
                    <p className="text-xs text-stone-500">اختيار أي استشاري لأسباب استراتيجية أو تفاوضية مع توثيق المبررات</p>
                  </div>
                </div>
              </div>

              {/* AI Support */}
              <div className="bg-gradient-to-r from-violet-50 to-purple-50 rounded-xl border border-violet-200 p-4">
                <h3 className="font-bold text-violet-800 mb-3 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  الدعم الذكي (AI)
                </h3>
                <div className="space-y-2">
                  <p className="text-violet-700">يوفر النظام 3 أنواع من التحليل الذكي لدعم اللجنة:</p>
                  <div className="space-y-2 mr-4">
                    <div className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-violet-600 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-[9px] text-white font-bold">1</span>
                      </span>
                      <div>
                        <p className="font-medium text-stone-700">توصية ذكية (قبل القرار)</p>
                        <p className="text-xs text-stone-500">تحليل شامل للبيانات مع توصية مبنية على المعطيات — يساعد اللجنة في فهم الصورة الكاملة</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-violet-600 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-[9px] text-white font-bold">2</span>
                      </span>
                      <div>
                        <p className="font-medium text-stone-700">تحليل القرار (أثناء القرار)</p>
                        <p className="text-xs text-stone-500">تحليل فوري لقرار اللجنة — يوضح نقاط القوة والمخاطر في الاختيار</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-violet-600 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-[9px] text-white font-bold">3</span>
                      </span>
                      <div>
                        <p className="font-medium text-stone-700">تحليل ما بعد القرار</p>
                        <p className="text-xs text-stone-500">تحليل معمق بعد تأكيد القرار — يشمل استراتيجية التفاوض والخطوات التالية</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Negotiation */}
              <div className="bg-stone-50 rounded-xl border border-stone-200 p-4">
                <h3 className="font-bold text-stone-700 mb-2">التفاوض وشروط التعاقد:</h3>
                <p className="text-stone-600">
                  بعد اختيار الاستشاري، يمكن للجنة تحديد <strong className="text-stone-800">هدف تفاوضي</strong> (مثلاً: تخفيض الأتعاب بنسبة 10%) و<strong className="text-stone-800">شروط التعاقد</strong> (مثلاً: ربط الدفعات بالإنجازات). النظام يسجل هذه المعلومات ويوفر تحليلاً ذكياً لاستراتيجية التفاوض المثلى.
                </p>
              </div>

              {/* Confirmation */}
              <div className="bg-rose-50 rounded-xl border border-rose-200 p-4">
                <h3 className="font-bold text-rose-800 mb-2 flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  تأكيد القرار النهائي
                </h3>
                <p className="text-rose-700">
                  بعد اكتمال المداولات، يتم <strong>تأكيد القرار</strong> بشكل نهائي. القرار المؤكد يُسجل مع التاريخ والمبررات ولا يمكن تعديله — وهذا يضمن توثيق العملية بالكامل للمرجعية المستقبلية.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ Section 8: Criteria Details ═══ */}
        <section id="section-criteria">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-stone-800 flex items-center gap-3">
                <Info className="w-6 h-6 text-amber-600" />
                تفصيل المعايير الفنية التسعة
              </h2>
            </div>
            <p className="text-sm text-stone-500">
              اضغط على أي معيار لعرض شرح تفصيلي لأهميته ومستويات التقييم المتاحة. المعايير مرتبة من الأعلى وزناً إلى الأقل.
            </p>
            {CRITERIA_GUIDE.map((criterion, index) => (
              <CriterionCard key={criterion.id} criterion={criterion} index={index} />
            ))}
          </div>
        </section>

        {/* ═══ Tips for Evaluators ═══ */}
        <div className="bg-amber-50 rounded-2xl border border-amber-200 p-6">
          <h3 className="font-bold text-amber-800 mb-3 flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            نصائح لأعضاء اللجنة
          </h3>
          <div className="space-y-2 text-sm text-amber-700">
            <div className="flex items-start gap-2">
              <span className="mt-1 text-amber-500">•</span>
              <span>اقرأ كل وصف بعناية قبل الاختيار — الفرق بين الأوصاف دقيق لكنه مهم في النتيجة النهائية.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="mt-1 text-amber-500">•</span>
              <span>قيّم كل معيار بشكل مستقل — لا تدع انطباعك العام عن الاستشاري يؤثر على تقييم معيار محدد.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="mt-1 text-amber-500">•</span>
              <span>استند إلى أدلة ملموسة (عروض الأسعار، المشاريع السابقة، العروض التقديمية) وليس فقط الانطباعات.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="mt-1 text-amber-500">•</span>
              <span>يمكنك حفظ التقييم كمسودة والعودة لإكماله لاحقاً — لا تتسرع في الاعتماد النهائي.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="mt-1 text-amber-500">•</span>
              <span>التقييم النهائي هو متوسط تقييمات الأعضاء الثلاثة، مما يضمن العدالة والموضوعية.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="mt-1 text-amber-500">•</span>
              <span>تحليل القيمة وتوصيات الذكاء الاصطناعي هي أدوات مساعدة — القرار النهائي دائماً بيد اللجنة.</span>
            </div>
          </div>
        </div>

        {/* Footer spacing */}
        <div className="h-8" />
      </div>
    </div>
  );
}
