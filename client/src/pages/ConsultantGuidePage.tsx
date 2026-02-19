import { Link } from "wouter";
import { ArrowLeft, BookOpen, ChevronDown } from "lucide-react";
import { useState } from "react";

// Same criteria as in ConsultantEvaluationPage - ordered by weight (highest first)
const CRITERIA_GUIDE = [
  {
    id: 0,
    name: "الخبرة والسابقة",
    weight: 20,
    color: "from-amber-500 to-orange-600",
    bgLight: "bg-amber-50",
    borderColor: "border-amber-200",
    importance: "الخبرة هي الركيزة الأساسية في اختيار الاستشاري. المكتب ذو الخبرة العميقة في مشاريع مشابهة يملك فهماً أعمق للتحديات التقنية والتنظيمية، مما يقلل المخاطر ويضمن سلاسة التنفيذ. في سوق دبي العقاري، الخبرة المحلية مع الجهات الحكومية (بلدية دبي، RERA، DLD) تعتبر ميزة حاسمة.",
    levels: [
      { score: 100, label: "ممتاز", description: "خبرة تتجاوز 15 سنة في مشاريع مماثلة بدبي والإمارات. سجل حافل بمشاريع كبرى ناجحة (أبراج سكنية، مجمعات تجارية). علاقات قوية مع الجهات الحكومية. معرفة عميقة بأنظمة البناء المحلية والدولية." },
      { score: 75, label: "جيد", description: "خبرة 10-15 سنة مع مشاريع متنوعة. نجح في تسليم مشاريع متوسطة إلى كبيرة. معرفة جيدة بالسوق المحلي. بعض المشاريع المرجعية القوية." },
      { score: 50, label: "متوسط", description: "خبرة 5-10 سنوات. عمل على مشاريع متوسطة الحجم. معرفة أساسية بالسوق المحلي. يحتاج إلى دعم في بعض الجوانب التنظيمية." },
      { score: 25, label: "ضعيف", description: "خبرة 2-5 سنوات فقط. مشاريع محدودة وصغيرة. معرفة سطحية بالسوق المحلي. قد يواجه تحديات في التعامل مع الجهات الحكومية." },
      { score: 0, label: "ضعيف جداً", description: "خبرة أقل من سنتين أو بدون خبرة في مشاريع مماثلة. لا يملك سجل أعمال مرجعي. غير مؤهل للمشاريع الكبرى." },
    ],
  },
  {
    id: 4,
    name: "جودة المخططات",
    weight: 20,
    color: "from-violet-500 to-purple-600",
    bgLight: "bg-violet-50",
    borderColor: "border-violet-200",
    importance: "جودة المخططات تنعكس مباشرة على جودة التنفيذ. مخططات دقيقة ومفصلة تقلل الأخطاء في الموقع، تقلل التعديلات أثناء البناء، وتوفر الوقت والمال. المخططات الاحترافية تسهل أيضاً عملية الحصول على التراخيص من الجهات المعنية.",
    levels: [
      { score: 100, label: "ممتاز", description: "مخططات بمعايير دولية (BIM Level 2+). تفاصيل دقيقة لكل عنصر. تنسيق ممتاز بين التخصصات (معماري، إنشائي، ميكانيكي). وثائق شاملة وواضحة. استخدام أحدث البرامج والتقنيات." },
      { score: 75, label: "جيد", description: "مخططات جيدة مع تفاصيل كافية. تنسيق جيد بين التخصصات. بعض النقاط تحتاج توضيح. جودة الطباعة والعرض مقبولة." },
      { score: 50, label: "متوسط", description: "مخططات أساسية تؤدي الغرض. بعض التفاصيل ناقصة. تنسيق متوسط بين التخصصات. قد تحتاج مراجعات متعددة." },
      { score: 25, label: "ضعيف", description: "مخططات تفتقر للتفاصيل الكافية. أخطاء في التنسيق بين التخصصات. تحتاج مراجعات كثيرة. قد تسبب مشاكل في الموقع." },
      { score: 0, label: "ضعيف جداً", description: "مخططات غير مكتملة أو بها أخطاء جوهرية. لا تلبي الحد الأدنى من المعايير. غير صالحة للتنفيذ بدون إعادة عمل شاملة." },
    ],
  },
  {
    id: 1,
    name: "جودة الكادر الفني",
    weight: 20,
    color: "from-emerald-500 to-teal-600",
    bgLight: "bg-emerald-50",
    borderColor: "border-emerald-200",
    importance: "الكادر الفني هو العمود الفقري لأي مكتب استشاري. مهندسون مؤهلون ومتخصصون يضمنون حلولاً تقنية مبتكرة وتصاميم عالية الجودة. تنوع التخصصات (معماري، إنشائي، ميكانيكي، كهربائي) ضروري لتغطية جميع جوانب المشروع.",
    levels: [
      { score: 100, label: "ممتاز", description: "فريق متكامل من مهندسين ذوي خبرة عالية. تخصصات متنوعة تغطي جميع الجوانب. شهادات مهنية معتمدة (PE, CEng). استقرار وظيفي عالٍ. قدرة على التعامل مع مشاريع معقدة." },
      { score: 75, label: "جيد", description: "فريق جيد مع تخصصات رئيسية. خبرة متوسطة إلى عالية. بعض الشهادات المهنية. استقرار وظيفي مقبول." },
      { score: 50, label: "متوسط", description: "فريق أساسي يغطي التخصصات الرئيسية. خبرة متوسطة. قد يحتاج استعانة بمتخصصين خارجيين في بعض الجوانب." },
      { score: 25, label: "ضعيف", description: "فريق صغير بتخصصات محدودة. خبرة قليلة. يعتمد بشكل كبير على الاستعانة الخارجية. معدل دوران وظيفي عالٍ." },
      { score: 0, label: "ضعيف جداً", description: "فريق غير مؤهل أو غير مكتمل. لا يملك التخصصات الأساسية. غير قادر على إدارة المشروع بشكل مستقل." },
    ],
  },
  {
    id: 2,
    name: "سابقة الأعمال",
    weight: 15,
    color: "from-sky-500 to-cyan-600",
    bgLight: "bg-sky-50",
    borderColor: "border-sky-200",
    importance: "سابقة الأعمال هي الدليل العملي على قدرة المكتب. مشاريع سابقة ناجحة ومماثلة تعطي ثقة بأن المكتب قادر على تحقيق النتائج المطلوبة. الأهم هو التشابه في نوع وحجم المشاريع مع المشروع المطروح.",
    levels: [
      { score: 100, label: "ممتاز", description: "محفظة أعمال غنية بمشاريع مماثلة (سكنية/تجارية في دبي). مشاريع مرجعية يمكن زيارتها. شهادات رضا من عملاء سابقين. تنوع في أنواع المشاريع المنفذة." },
      { score: 75, label: "جيد", description: "عدة مشاريع مماثلة منجزة. بعض المشاريع المرجعية المتاحة. ردود فعل إيجابية من عملاء سابقين." },
      { score: 50, label: "متوسط", description: "مشاريع سابقة لكن ليست بنفس الحجم أو النوع. بعض المراجع المتاحة. نتائج مقبولة في المشاريع السابقة." },
      { score: 25, label: "ضعيف", description: "مشاريع سابقة قليلة ومختلفة عن المطلوب. مراجع محدودة. بعض المشاكل في مشاريع سابقة." },
      { score: 0, label: "ضعيف جداً", description: "لا يملك سابقة أعمال مماثلة. لا مراجع متاحة. أو سجل سلبي في مشاريع سابقة." },
    ],
  },
  {
    id: 3,
    name: "الالتزام الزمني",
    weight: 15,
    color: "from-rose-500 to-pink-600",
    bgLight: "bg-rose-50",
    borderColor: "border-rose-200",
    importance: "الالتزام بالجدول الزمني حاسم في المشاريع العقارية. التأخير يعني تكاليف إضافية وخسارة فرص بيع. المكتب الملتزم زمنياً يظهر تنظيماً داخلياً جيداً وقدرة على إدارة الموارد بفعالية.",
    levels: [
      { score: 100, label: "ممتاز", description: "سجل ممتاز في الالتزام بالمواعيد. يسلم قبل أو في الموعد المحدد. نظام إدارة مشاريع متطور. تقارير تقدم دورية. مرونة في التعامل مع التغييرات دون تأخير." },
      { score: 75, label: "جيد", description: "يلتزم بالمواعيد في معظم الحالات. تأخيرات طفيفة ومبررة. تواصل جيد حول الجدول الزمني. قدرة على التعافي من التأخيرات." },
      { score: 50, label: "متوسط", description: "التزام متوسط بالمواعيد. تأخيرات متكررة لكن ليست كبيرة. يحتاج متابعة مستمرة. تواصل مقبول حول التقدم." },
      { score: 25, label: "ضعيف", description: "تأخيرات متكررة وملحوظة. ضعف في إدارة الوقت. يحتاج ضغط مستمر للالتزام. تواصل ضعيف حول الجدول الزمني." },
      { score: 0, label: "ضعيف جداً", description: "تأخيرات كبيرة ومتكررة. لا يلتزم بأي جدول زمني. يسبب خسائر مالية بسبب التأخير. غير موثوق في المواعيد." },
    ],
  },
  {
    id: 5,
    name: "السمعة والاستقرار",
    weight: 10,
    color: "from-slate-500 to-gray-600",
    bgLight: "bg-slate-50",
    borderColor: "border-slate-200",
    importance: "سمعة المكتب واستقراره المالي والإداري يعكسان موثوقيته على المدى الطويل. مكتب مستقر يضمن استمرارية الخدمة طوال فترة المشروع وما بعدها (فترة الضمان). السمعة الجيدة في السوق تعني علاقات أفضل مع المقاولين والموردين.",
    levels: [
      { score: 100, label: "ممتاز", description: "سمعة ممتازة في السوق المحلي والإقليمي. استقرار مالي وإداري قوي. علاقات ممتازة مع الجهات الحكومية والمقاولين. لا نزاعات قانونية. تاريخ طويل ونظيف." },
      { score: 75, label: "جيد", description: "سمعة جيدة في السوق. استقرار مالي مقبول. علاقات جيدة مع الأطراف المعنية. لا مشاكل قانونية كبيرة." },
      { score: 50, label: "متوسط", description: "سمعة مقبولة. استقرار مالي متوسط. بعض التحديات الإدارية. معروف في السوق لكن ليس من الصف الأول." },
      { score: 25, label: "ضعيف", description: "سمعة مختلطة. مشاكل مالية أو إدارية. بعض النزاعات مع عملاء سابقين. غير مستقر إدارياً." },
      { score: 0, label: "ضعيف جداً", description: "سمعة سيئة أو غير معروف. مشاكل مالية خطيرة. نزاعات قانونية متعددة. خطر عدم الاستمرارية." },
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
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${criterion.color} flex items-center justify-center shadow-md shrink-0`}>
          <span className="text-white font-bold text-lg">{criterion.weight}%</span>
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
              <span className="text-lg">💡</span> أهمية هذا المعيار
            </h4>
            <p className="text-sm text-stone-600 leading-relaxed">{criterion.importance}</p>
          </div>

          {/* Score Levels */}
          <div className="space-y-3">
            <h4 className="font-semibold text-stone-700 flex items-center gap-2">
              <span className="text-lg">📊</span> مستويات التقييم
            </h4>
            {criterion.levels.map((level) => (
              <div key={level.score} className="flex gap-3 items-start">
                <div className={`w-16 h-10 rounded-lg flex items-center justify-center shrink-0 font-bold text-sm ${
                  level.score === 100 ? 'bg-emerald-100 text-emerald-700' :
                  level.score === 75 ? 'bg-sky-100 text-sky-700' :
                  level.score === 50 ? 'bg-amber-100 text-amber-700' :
                  level.score === 25 ? 'bg-orange-100 text-orange-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {level.score}
                </div>
                <div className="flex-1">
                  <p className={`font-semibold text-sm ${
                    level.score === 100 ? 'text-emerald-700' :
                    level.score === 75 ? 'text-sky-700' :
                    level.score === 50 ? 'text-amber-700' :
                    level.score === 25 ? 'text-orange-700' :
                    'text-red-700'
                  }`}>{level.label}</p>
                  <p className="text-sm text-stone-500 leading-relaxed">{level.description}</p>
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
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-slate-400 to-gray-500 flex items-center justify-center shadow-lg shrink-0">
              <BookOpen className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">دليل التقييم التفصيلي</h1>
              <p className="text-stone-400 text-sm">شرح مفصل لكل معيار ومستويات النقاط لمساعدة أعضاء اللجنة في التقييم</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Summary Table */}
        <div className="bg-white rounded-2xl border border-stone-200 p-5 mb-8 shadow-sm">
          <h2 className="text-lg font-bold text-stone-800 mb-4">ملخص الأوزان</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {CRITERIA_GUIDE.map((c) => (
              <div key={c.id} className={`${c.bgLight} rounded-xl p-3 border ${c.borderColor}`}>
                <p className="font-bold text-stone-700 text-sm">{c.name}</p>
                <p className={`text-2xl font-bold bg-gradient-to-br ${c.color} bg-clip-text text-transparent`}>{c.weight}%</p>
              </div>
            ))}
          </div>
        </div>

        {/* Criteria Details */}
        <div className="space-y-4">
          {CRITERIA_GUIDE.map((criterion, index) => (
            <CriterionCard key={criterion.id} criterion={criterion} index={index} />
          ))}
        </div>

        {/* Tips */}
        <div className="mt-8 bg-amber-50 rounded-2xl border border-amber-200 p-6">
          <h3 className="font-bold text-amber-800 mb-3 flex items-center gap-2">
            <span className="text-xl">📝</span> نصائح للمقيّمين
          </h3>
          <ul className="space-y-2 text-sm text-amber-700">
            <li className="flex items-start gap-2">
              <span className="mt-1">•</span>
              <span>قيّم كل معيار بشكل مستقل عن المعايير الأخرى — لا تدع انطباعك العام يؤثر على تقييم معيار محدد.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1">•</span>
              <span>استند إلى أدلة ملموسة (مشاريع سابقة، شهادات، تقارير) وليس فقط الانطباعات الشخصية.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1">•</span>
              <span>إذا لم تكن متأكداً، اختر "متوسط" (50 نقطة) كنقطة بداية ثم عدّل حسب المعلومات المتاحة.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1">•</span>
              <span>تذكر أن التقييم النهائي هو متوسط تقييمات الأعضاء الثلاثة، مما يضمن العدالة والموضوعية.</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
