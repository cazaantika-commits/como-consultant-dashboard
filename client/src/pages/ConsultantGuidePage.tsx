import { Link } from "wouter";
import { ArrowLeft, BookOpen, ChevronDown } from "lucide-react";
import { useState } from "react";

// Updated criteria from وثيقة التقييم الفني للاستشاريين — ordered by weight (highest first)
// Uses professional descriptions with converted percentages instead of point scores
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

function CriterionCard({ criterion, index }: { criterion: typeof CRITERIA_GUIDE[0]; index: number }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={`bg-white rounded-2xl border ${criterion.borderColor} overflow-hidden transition-all duration-300 shadow-sm hover:shadow-md`}>
      {/* Header */}
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
          <p className="text-sm text-stone-500">الوزن: {criterion.weight}% من إجمالي التقييم</p>
        </div>
        <ChevronDown className={`w-5 h-5 text-stone-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Content */}
      {isOpen && (
        <div className="px-5 pb-5 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
          {/* Importance */}
          <div className={`${criterion.bgLight} rounded-xl p-4 border ${criterion.borderColor}`}>
            <h4 className="font-semibold text-stone-700 mb-2 flex items-center gap-2">
              لماذا هذا المعيار مهم؟
            </h4>
            <p className="text-sm text-stone-600 leading-relaxed">{criterion.importance}</p>
          </div>

          {/* Score Levels */}
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
                  <p className={`font-semibold text-sm ${
                    level.pct >= 90 ? 'text-emerald-700' :
                    level.pct >= 80 ? 'text-sky-700' :
                    level.pct >= 70 ? 'text-amber-700' :
                    level.pct >= 50 ? 'text-orange-700' :
                    'text-red-700'
                  }`}>{level.pct}%</p>
                  <p className="text-sm text-stone-500 leading-relaxed mt-1">{level.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ConsultantGuidePage() {
  const [allOpen, setAllOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 via-white to-stone-100" dir="rtl">
      {/* Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-stone-700 via-stone-800 to-neutral-900" />
        <div className="relative max-w-4xl mx-auto px-6 py-10">
          <Link href="/consultant-portal" className="inline-flex items-center gap-2 text-stone-400 hover:text-white transition-colors mb-4 text-sm">
            <ArrowLeft className="w-4 h-4" />
            العودة لمكاتب الاستشارات
          </Link>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shrink-0">
              <BookOpen className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">دليل التقييم التفصيلي</h1>
              <p className="text-stone-400 text-sm">شرح مفصل لكل معيار ومستويات النسب — مرجع أساسي لأعضاء اللجنة قبل التقييم</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Summary Table */}
        <div className="bg-white rounded-2xl border border-stone-200 p-5 mb-8 shadow-sm">
          <h2 className="text-lg font-bold text-stone-800 mb-4">ملخص الأوزان (مرتبة من الأعلى للأقل)</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200">
                  <th className="text-right py-2 px-3 text-stone-500 font-medium">#</th>
                  <th className="text-right py-2 px-3 text-stone-500 font-medium">المعيار</th>
                  <th className="text-center py-2 px-3 text-stone-500 font-medium">الوزن</th>
                  <th className="text-center py-2 px-3 text-stone-500 font-medium">نطاق النسبة</th>
                </tr>
              </thead>
              <tbody>
                {CRITERIA_GUIDE.map((c, i) => (
                  <tr key={c.id} className="border-b border-stone-100 last:border-0">
                    <td className="py-2.5 px-3 text-stone-400 font-medium">{i + 1}</td>
                    <td className="py-2.5 px-3 font-medium text-stone-700">{c.name}</td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold bg-gradient-to-br ${c.color} text-white`}>
                        {c.weight}%
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center text-stone-500">
                      {c.levels[c.levels.length - 1].pct}% — {c.levels[0].pct}%
                    </td>
                  </tr>
                ))}
                <tr className="bg-stone-50 font-bold">
                  <td className="py-2.5 px-3"></td>
                  <td className="py-2.5 px-3 text-stone-800">المجموع</td>
                  <td className="py-2.5 px-3 text-center text-stone-800">100%</td>
                  <td className="py-2.5 px-3 text-center text-stone-500"></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* How scoring works */}
        <div className="bg-white rounded-2xl border border-stone-200 p-5 mb-8 shadow-sm">
          <h2 className="text-lg font-bold text-stone-800 mb-3">كيف يعمل نظام التقييم؟</h2>
          <div className="space-y-3 text-sm text-stone-600 leading-relaxed">
            <p>كل معيار يُقيّم عبر اختيار <strong className="text-stone-800">وصف مهني تفصيلي</strong> يعكس أداء الاستشاري. لكل وصف <strong className="text-stone-800">نسبة محولة (%)</strong> تُحتسب تلقائياً.</p>
            <p>النتيجة لكل معيار = <strong className="text-stone-800">النسبة المحولة × وزن المعيار</strong>. مثال: إذا حصل الاستشاري على 90% في الهوية المعمارية (وزنها 14.6%)، فالنتيجة = 90% × 14.6% = <strong className="text-blue-700">13.14%</strong></p>
            <p>النتيجة الإجمالية = مجموع نتائج كل المعايير. مثلاً: 13.14% + 13.29% + ... = <strong className="text-blue-700">88.92%</strong></p>
            <p>التقييم يتم من <strong className="text-stone-800">3 أعضاء</strong> (الشيخ عيسى، وائل، عبدالرحمن) والنتيجة النهائية هي <strong className="text-stone-800">متوسط التقييمات الثلاثة</strong>.</p>
          </div>
        </div>

        {/* Criteria Details */}
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-bold text-stone-800">تفصيل المعايير</h2>
            <button
              onClick={() => setAllOpen(!allOpen)}
              className="text-sm text-stone-500 hover:text-stone-700 transition-colors"
            >
              {allOpen ? 'إغلاق الكل' : 'فتح الكل'}
            </button>
          </div>
          {CRITERIA_GUIDE.map((criterion, index) => (
            <CriterionCard key={criterion.id} criterion={criterion} index={index} />
          ))}
        </div>

        {/* Tips */}
        <div className="mt-8 bg-amber-50 rounded-2xl border border-amber-200 p-6">
          <h3 className="font-bold text-amber-800 mb-3">نصائح للمقيّمين</h3>
          <ul className="space-y-2 text-sm text-amber-700">
            <li className="flex items-start gap-2">
              <span className="mt-1">•</span>
              <span>اقرأ كل وصف بعناية قبل الاختيار — الفرق بين الأوصاف دقيق لكنه مهم في النتيجة النهائية.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1">•</span>
              <span>قيّم كل معيار بشكل مستقل — لا تدع انطباعك العام عن الاستشاري يؤثر على تقييم معيار محدد.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1">•</span>
              <span>استند إلى أدلة ملموسة (عروض الأسعار، المشاريع السابقة، العروض التقديمية) وليس فقط الانطباعات.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1">•</span>
              <span>النسبة المحولة تُحتسب تلقائياً عند اختيار الوصف — ركّز على اختيار الوصف الأنسب.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1">•</span>
              <span>التقييم النهائي هو متوسط تقييمات الأعضاء الثلاثة، مما يضمن العدالة والموضوعية.</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
