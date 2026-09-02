import { Link } from "wouter";
import { default as ArrowLeft } from "lucide-react/dist/esm/icons/arrow-left.js";
import { default as Building2 } from "lucide-react/dist/esm/icons/building-2.js";
import { default as BookOpen } from "lucide-react/dist/esm/icons/book-open.js";
import { default as ChevronLeft } from "lucide-react/dist/esm/icons/chevron-left.js";
import { default as ClipboardCheck } from "lucide-react/dist/esm/icons/clipboard-check.js";
import { default as FileSearch } from "lucide-react/dist/esm/icons/file-search.js";
import { default as FileText } from "lucide-react/dist/esm/icons/file-text.js";
import { default as Gavel } from "lucide-react/dist/esm/icons/gavel.js";
import { default as Layers } from "lucide-react/dist/esm/icons/layers.js";
import { default as Users } from "lucide-react/dist/esm/icons/users.js";

const WORKFLOW = [
  {
    step: "01",
    title: "اختر المشروع واعتمد نطاق التصميم",
    description: "لكل مشروع نطاق تصميم مستقل تختاره وتعدّله من موسوعة التصميم ذات 43 بندًا. لا توجد تصنيفات جاهزة ولا تدخل بنود الإشراف أو الشؤون القانونية هنا.",
    icon: Layers,
    tone: "border-sky-200 bg-sky-50 text-sky-900",
  },
  {
    step: "02",
    title: "حدّد المكاتب وجهّز طلب العرض",
    description: "أضف فقط المكاتب المناسبة من السجل الرئيسي للمشروع، وراجع حزمة التكليف الداخلية إن احتجتها قبل مخاطبة أي مكتب.",
    icon: Users,
    tone: "border-violet-200 bg-violet-50 text-violet-900",
  },
  {
    step: "03",
    title: "ارفع العرض الأصلي وراجعه",
    description: "يرفع عرض PDF الأصلي لكل مكتب ويُحلّل مقابل نطاق المشروع. يظل التحليل مسودة حتى يراجعه المالك ويعتمده.",
    icon: FileSearch,
    tone: "border-emerald-200 bg-emerald-50 text-emerald-900",
  },
  {
    step: "04",
    title: "قارن التكلفة والفجوات ثم قيّم",
    description: "تُقارن الأتعاب المعتمدة والفجوات المسعّرة والتقييم الفني. الترتيب دليل قرار فقط ولا يختار مكتبًا تلقائيًا.",
    icon: ClipboardCheck,
    tone: "border-amber-200 bg-amber-50 text-amber-900",
  },
  {
    step: "05",
    title: "وثّق قرار اللجنة والتفاوض",
    description: "بعد اكتمال الدليل الفني والمالي، تسجل اللجنة قرارها وشروط التفاوض. القرار يبقى بيد اللجنة دائمًا.",
    icon: Gavel,
    tone: "border-cyan-200 bg-cyan-50 text-cyan-900",
  },
  {
    step: "06",
    title: "سجّل العقد وتابع التسليمات",
    description: "بعد القرار المؤكد فقط، يسجل العقد ثم تتابع تسليماته ومعايير قبولها. الإشراف مسار مستقل بعد التعيين.",
    icon: FileText,
    tone: "border-rose-200 bg-rose-50 text-rose-900",
  },
];

const SUPPORT_LINKS = [
  {
    title: "سجل المكاتب الاستشارية",
    description: "إدارة بيانات المكاتب المرجعية؛ ليس خطوة موازية لمسار اختيار المشروع.",
    href: "/consultant-know",
    icon: Users,
    tone: "border-violet-200 bg-violet-50 text-violet-800",
  },
  {
    title: "موسوعة نطاق التصميم",
    description: "المرجع المشترك للبنود، بينما الاختيار والاعتماد يظلان داخل كل مشروع.",
    href: "/consultant-proposals?settings=1",
    icon: Layers,
    tone: "border-sky-200 bg-sky-50 text-sky-800",
  },
  {
    title: "المنهجية ودليل التقييم",
    description: "مرجع للقراءة فقط؛ لا يبدأ منه إدخال أتعاب أو اتخاذ قرار.",
    href: "/consultant-guide",
    icon: BookOpen,
    tone: "border-slate-200 bg-slate-50 text-slate-800",
  },
];

export default function ConsultantPortalPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 via-white to-stone-100" dir="rtl">
      <header className="relative overflow-hidden bg-stone-900">
        <div className="absolute inset-0 opacity-15" style={{ backgroundImage: "radial-gradient(circle at 2px 2px, rgba(255,255,255,.65) 1px, transparent 0)", backgroundSize: "32px 32px" }} />
        <div className="relative mx-auto max-w-6xl px-6 py-11">
          <Link href="/" className="mb-6 inline-flex items-center gap-2 text-sm text-stone-300 transition-colors hover:text-white"><ArrowLeft className="h-4 w-4" />العودة للرئيسية</Link>
          <div className="flex items-start gap-5">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-amber-500/20"><Building2 className="h-8 w-8 text-white" /></div>
            <div>
              <p className="text-sm font-bold text-amber-300">شركاء المستقبل</p>
              <h1 className="mt-1 text-3xl font-extrabold text-white md:text-4xl">مسار اختيار وتعيين الاستشاري</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-stone-300">مسار واحد لكل مشروع، من نطاق التصميم المستقل إلى العرض الأصلي والمراجعة والمقارنة وقرار اللجنة ثم العقد. لا ينشئ النظام عرضًا أو قرارًا أو عقدًا تلقائيًا.</p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm md:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-bold tracking-wide text-stone-500">المسار التشغيلي المعتمد</p>
              <h2 className="mt-1 text-2xl font-extrabold text-stone-900">ابدأ أو استكمل مشروعًا واحدًا</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-600">يُحفظ نطاق كل مشروع وعروضه ونتائجه وقراره مستقلًا. الإشراف لا يختلط بنطاق التصميم، والمكتبة والسجل مراجع مساندة وليسا مسارات منافسة.</p>
            </div>
            <Link href="/consultant-proposals" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-stone-900 px-5 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-stone-700"><span>فتح مسار المشروع</span><ChevronLeft className="h-4 w-4" /></Link>
          </div>

          <div className="mt-7 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {WORKFLOW.map((item) => {
              const Icon = item.icon;
              return <article key={item.step} className={`rounded-2xl border p-4 ${item.tone}`}>
                <div className="flex items-start gap-3"><span className="inline-flex h-8 min-w-8 items-center justify-center rounded-lg bg-white/90 px-2 text-xs font-extrabold shadow-sm">{item.step}</span><div className="min-w-0"><div className="flex items-center gap-2"><Icon className="h-4 w-4 shrink-0" /><h3 className="font-bold">{item.title}</h3></div><p className="mt-2 text-sm leading-6 opacity-85">{item.description}</p></div></div>
              </article>;
            })}
          </div>
        </section>

        <section className="mt-6">
          <div className="mb-3"><h2 className="text-lg font-extrabold text-stone-900">مراجع مساندة</h2><p className="mt-1 text-sm text-stone-600">تفتح عند الحاجة فقط، ولا تعيدك إلى إدخال أو تقييم منفصل عن المشروع المختار.</p></div>
          <div className="grid gap-4 md:grid-cols-3">
            {SUPPORT_LINKS.map((item) => {
              const Icon = item.icon;
              return <Link key={item.href} href={item.href} className="group block"><article className={`h-full rounded-2xl border bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${item.tone.split(" ")[0]}`}><div className={`flex h-11 w-11 items-center justify-center rounded-xl ${item.tone.split(" ").slice(1).join(" ")}`}><Icon className="h-5 w-5" /></div><h3 className="mt-4 font-extrabold text-stone-900">{item.title}</h3><p className="mt-2 text-sm leading-6 text-stone-600">{item.description}</p><span className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-stone-700">فتح المرجع <ChevronLeft className="h-3.5 w-3.5" /></span></article></Link>;
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
