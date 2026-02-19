import { Link } from "wouter";
import { ArrowLeft, BookOpen, ChevronDown } from "lucide-react";
import { useState } from "react";

// Exact criteria from consultant-dashboard.html - ordered by weight (highest first)
const CRITERIA_GUIDE = [
  {
    id: 0,
    name: "الهوية المعمارية وجودة التصميم",
    weight: 12.75,
    color: "from-amber-500 to-orange-600",
    bgLight: "bg-amber-50",
    borderColor: "border-amber-200",
    importance: "الهوية المعمارية هي أول ما يراه المشتري والمستثمر. تصميم مميز وأيقوني يرفع قيمة المشروع السوقية ويخلق عامل تمييز قوي في سوق دبي العقاري المزدحم. الاستشاري الذي يملك رؤية تصميمية واضحة يستطيع تحويل المبنى من مجرد هيكل إلى علامة تجارية معمارية تجذب المشترين وتحقق أسعار بيع أعلى.",
    levels: [
      { score: 10, label: "10 نقاط — مستوى معلم بارز", description: "هوية أيقونية قوية، عامل تمييز في السوق، عمارة لا تُنسى. التصميم يخلق انطباعاً فورياً ويصبح مرجعاً في المنطقة. يمتلك سرداً تصميمياً متكاملاً من الواجهات إلى التفاصيل الداخلية. المبنى يُعرف من شكله دون الحاجة لقراءة اسمه." },
      { score: 8, label: "8 نقاط — جودة عالية", description: "هوية مميزة، سرد تصميمي واضح، حضور سوقي فوق المتوسط. التصميم جذاب ومتماسك لكن قد لا يكون أيقونياً بالكامل. يتفوق على معظم المشاريع المنافسة في المنطقة." },
      { score: 6, label: "6 نقاط — جودة متوسطة", description: "كفء لكن عام، لا يوجد تمييز قوي. التصميم مقبول ولا يوجد فيه عيوب واضحة، لكنه لا يبرز في السوق ولا يخلق انطباعاً خاصاً عند المشتري." },
      { score: 4, label: "4 نقاط — هوية ضعيفة", description: "يفتقر للوضوح، جاذبية سوقية محدودة. التصميم تقليدي ومكرر، لا يملك شخصية واضحة. قد يؤثر سلباً على القيمة السوقية للمشروع." },
      { score: 2, label: "2 نقاط — تصميم ضعيف", description: "لا توجد هوية متماسكة، ضعيف بصرياً. التصميم غير جذاب وقد ينفّر المشترين المحتملين. يحتاج إعادة تصميم جذرية." },
    ],
  },
  {
    id: 1,
    name: "القدرات التقنية والتكامل مع BIM",
    weight: 12.75,
    color: "from-emerald-500 to-teal-600",
    bgLight: "bg-emerald-50",
    borderColor: "border-emerald-200",
    importance: "تقنية BIM (نمذجة معلومات البناء) أصبحت معياراً أساسياً في المشاريع الحديثة. الاستشاري الذي يتقن BIM يستطيع اكتشاف التضاربات بين التخصصات قبل البناء، مما يوفر ملايين الدراهم في تكاليف التعديلات. مستوى LOD 300-350 يعني تفاصيل دقيقة كافية للتنفيذ المباشر. إدارة التضارب القوية تمنع المشاكل في الموقع.",
    levels: [
      { score: 10, label: "10 نقاط — ممارسة BIM متقدمة", description: "سير عمل BIM كامل، تنسيق تصميم LOD 300-350، إدارة تضارب قوية، مخرجات رقمية منظمة. الاستشاري يعمل بنظام BIM متكامل من التصميم الأولي حتى التسليم. يستخدم أدوات Clash Detection بشكل دوري. المخرجات الرقمية منظمة ويمكن تسليمها للمقاول مباشرة." },
      { score: 8, label: "8 نقاط — ممارسة BIM جيدة", description: "استخدام BIM بشكل متسق، تنسيق جيد. يستخدم BIM في معظم مراحل التصميم لكن قد لا يصل لمستوى LOD 350 في كل التفاصيل. التنسيق بين التخصصات جيد مع بعض الفجوات الطفيفة." },
      { score: 6, label: "6 نقاط — استخدام BIM أساسي", description: "BIM محدود في النمذجة فقط. يستخدم BIM للنمذجة ثلاثية الأبعاد لكن لا يستفيد من إمكانياته الكاملة في إدارة التضارب أو التنسيق بين التخصصات. المخرجات تحتاج مراجعة إضافية." },
      { score: 4, label: "4 نقاط — تكامل BIM ضئيل", description: "تنسيق معتمد على 2D في الغالب. يستخدم BIM بشكل محدود جداً أو للعرض فقط. التنسيق الفعلي بين التخصصات يتم بالطرق التقليدية (2D). مخاطر تضارب عالية في الموقع." },
      { score: 2, label: "2 نقاط — لا توجد قدرة BIM", description: "لا يملك أي قدرة على العمل بنظام BIM. يعتمد كلياً على الرسومات ثنائية الأبعاد. احتمال عالٍ لمشاكل تنسيق وتضارب في الموقع." },
    ],
  },
  {
    id: 2,
    name: "الأتعاب المهنية",
    weight: 12.75,
    color: "from-violet-500 to-purple-600",
    bgLight: "bg-violet-50",
    borderColor: "border-violet-200",
    importance: "الأتعاب المهنية تمثل جزءاً مهماً من تكلفة المشروع الإجمالية. المطلوب ليس الأرخص بل الأفضل قيمة — أتعاب معقولة مقابل جودة عالية. أتعاب منخفضة جداً قد تعني جودة أقل أو نقص في الكوادر. أتعاب مرتفعة جداً تأكل من هامش ربح المشروع. المقارنة يجب أن تكون بالنسبة لمتوسط السوق لنفس نوع وحجم المشروع.",
    levels: [
      { score: 10, label: "10 نقاط — قيمة ممتازة", description: "أتعاب تنافسية للغاية ومبررة. السعر أقل من متوسط السوق مع جودة عالية. نطاق العمل شامل ومفصل. لا رسوم مخفية أو إضافية غير متوقعة. أفضل قيمة مقابل المال." },
      { score: 8, label: "8 نقاط — تنافسية", description: "أتعاب قريبة من متوسط السوق أو أقل قليلاً. نطاق عمل واضح ومعقول. قيمة جيدة مقابل الخدمة المقدمة." },
      { score: 6, label: "6 نقاط — متوسط السوق", description: "أتعاب في حدود متوسط السوق. لا ميزة سعرية واضحة لكن السعر عادل ومقبول." },
      { score: 4, label: "4 نقاط — أتعاب مرتفعة", description: "أتعاب أعلى من متوسط السوق بشكل ملحوظ. قد تكون مبررة جزئياً بالجودة لكن تؤثر على ميزانية المشروع." },
      { score: 2, label: "2 نقاط — أتعاب مفرطة", description: "أتعاب أعلى بكثير من متوسط السوق. غير مبررة بالنسبة لنطاق العمل. تشكل عبئاً مالياً كبيراً على المشروع." },
    ],
  },
  {
    id: 3,
    name: "كفاءة التخطيط وتحسين المساحات",
    weight: 11.9,
    color: "from-sky-500 to-cyan-600",
    bgLight: "bg-sky-50",
    borderColor: "border-sky-200",
    importance: "كفاءة التخطيط تؤثر مباشرة على العائد المالي للمشروع. كل متر مربع مهدر هو خسارة مالية مباشرة. الاستشاري الذكي يعظّم المساحات القابلة للبيع ويقلل الممرات والفراغات الميتة. تخطيط الخدمات (مواقف، مصاعد، سلالم) يجب أن يكون فعالاً دون أن يأكل من المساحات التجارية أو السكنية.",
    levels: [
      { score: 10, label: "10 نقاط — كفاءة استثنائية", description: "منطق تخطيط ممتاز، استخدام أمثل للمساحة، الحد الأدنى من الفراغات الميتة، تخطيط خدمات قوي، وعي مالي واضح. نسبة المساحات القابلة للبيع إلى إجمالي المساحة عالية جداً. كل متر مربع له غرض واضح." },
      { score: 8, label: "8 نقاط — كفاءة قوية", description: "تخطيط مساحات جيد جداً، عدم كفاءة طفيف لكن فهم تجاري قوي بشكل عام. بعض الفراغات يمكن تحسينها لكن النتيجة الإجمالية ممتازة." },
      { score: 6, label: "6 نقاط — كفاءة مقبولة", description: "تخطيط وظيفي لكن تقليدي، بعض المساحات المفقودة، حساسية مالية محدودة. التخطيط يعمل لكن لا يعظّم العائد المالي." },
      { score: 4, label: "4 نقاط — كفاءة ضعيفة", description: "منطق حركة ضعيف، مساحات مهدرة ملحوظة، تخطيط خدمات ضعيف. فراغات ميتة واضحة تقلل من المساحات القابلة للبيع." },
      { score: 2, label: "2 نقاط — كفاءة ضعيفة جداً", description: "تخطيط غير فعال، فقدان كبير في المساحة القابلة للاستخدام، تخطيط مضر مالياً. يحتاج إعادة تخطيط كاملة." },
    ],
  },
  {
    id: 4,
    name: "التحكم في التكاليف والوعي بالميزانية",
    weight: 9.35,
    color: "from-rose-500 to-pink-600",
    bgLight: "bg-rose-50",
    borderColor: "border-rose-200",
    importance: "الاستشاري الواعي بالميزانية يصمم بذكاء — يختار مواد وحلول تحقق الجودة المطلوبة بأقل تكلفة ممكنة. قرارات التصميم تؤثر على 70-80% من تكلفة البناء. استشاري يصمم واجهات زجاجية معقدة دون مبرر قد يضيف ملايين للتكلفة. الوعي بالميزانية لا يعني التقشف بل الذكاء في توزيع الموارد.",
    levels: [
      { score: 10, label: "10 نقاط — ذكاء تكلفة قوي", description: "قرارات التصميم تعكس الوعي بالميزانية. يقترح حلولاً بديلة أقل تكلفة دون التضحية بالجودة. يفهم تأثير كل قرار تصميمي على التكلفة الإجمالية. يعمل ضمن الميزانية المحددة ويحترمها." },
      { score: 8, label: "8 نقاط — حساسية تكلفة جيدة", description: "يراعي الميزانية في معظم قراراته التصميمية. يقدم بدائل عند الحاجة. وعي جيد بتكاليف المواد والأنظمة." },
      { score: 6, label: "6 نقاط — محايد", description: "لا يتجاوز الميزانية بشكل كبير لكن لا يسعى لتوفير التكاليف بشكل استباقي. يحتاج توجيه من المالك للبقاء ضمن الميزانية." },
      { score: 4, label: "4 نقاط — وعي تكلفة ضعيف", description: "يميل لاختيار حلول مكلفة دون مبرر كافٍ. لا يقدم بدائل اقتصادية. قد يتجاوز الميزانية بشكل متكرر." },
      { score: 2, label: "2 نقاط — مخاطر تصميم مكلفة", description: "قرارات تصميمية تضخم التكاليف بشكل كبير. لا يراعي الميزانية إطلاقاً. يشكل خطراً مالياً على المشروع." },
    ],
  },
  {
    id: 5,
    name: "الخبرة في مشاريع مشابهة",
    weight: 8.5,
    color: "from-slate-500 to-gray-600",
    bgLight: "bg-slate-50",
    borderColor: "border-slate-200",
    importance: "الخبرة في مشاريع مشابهة من حيث النوع (سكني، تجاري، مختلط) والحجم تعني أن الاستشاري يفهم التحديات المحددة لهذا النوع من المشاريع. استشاري عمل على 10 أبراج سكنية يعرف بالضبط كيف يوزع الشقق، أين يضع الخدمات، وكيف يتعامل مع متطلبات الدفاع المدني والبلدية.",
    levels: [
      { score: 10, label: "10 نقاط — خبرة واسعة ذات صلة", description: "مشاريع متعددة مكتملة بنفس الحجم والنوع. محفظة أعمال غنية بمشاريع مماثلة في دبي والإمارات. يمكن زيارة مشاريعه المرجعية. سجل نجاح مثبت." },
      { score: 8, label: "8 نقاط — خبرة قوية", description: "محفظة جيدة ذات صلة مع تسليم مثبت. عدة مشاريع مماثلة منجزة بنجاح. ردود فعل إيجابية من عملاء سابقين." },
      { score: 6, label: "6 نقاط — خبرة متوسطة", description: "بعض المشاريع ذات الصلة لكن ليست قابلة للمقارنة بالكامل. قد تكون المشاريع السابقة أصغر حجماً أو مختلفة قليلاً في النوع." },
      { score: 4, label: "4 نقاط — خبرة محدودة", description: "مراجع مشابهة قليلة. معظم الخبرة في أنواع مختلفة من المشاريع. يحتاج وقتاً للتأقلم مع متطلبات هذا النوع." },
      { score: 2, label: "2 نقاط — لا توجد خبرة ذات صلة", description: "لم يعمل على مشاريع مشابهة من قبل. خبرته في مجالات مختلفة تماماً. مخاطرة عالية في تكليفه بهذا المشروع." },
    ],
  },
  {
    id: 6,
    name: "قوة فريق المشروع",
    weight: 8.5,
    color: "from-indigo-500 to-blue-600",
    bgLight: "bg-indigo-50",
    borderColor: "border-indigo-200",
    importance: "الفريق المخصص للمشروع هو من سيعمل يومياً على التصميم. حتى لو كان المكتب ممتازاً، إذا خصص فريقاً ضعيفاً أو مبتدئاً فالنتيجة ستكون ضعيفة. مشاركة القيادة العليا (الشركاء أو المديرين) تعني اهتماماً حقيقياً بالمشروع وقرارات أسرع وأفضل.",
    levels: [
      { score: 10, label: "10 نقاط — فريق مخصص ذو خبرة عالية", description: "قيادة عليا مشاركة مباشرة. فريق متكامل من مهندسين ذوي خبرة عالية في كل التخصصات. الشريك أو المدير العام يشرف شخصياً. استقرار الفريق مضمون طوال المشروع." },
      { score: 8, label: "8 نقاط — فريق قوي", description: "خبرة جيدة مع دعم قادر. فريق متمرس مع إشراف من الإدارة العليا. تخصصات رئيسية مغطاة بكفاءة." },
      { score: 6, label: "6 نقاط — فريق متوسط", description: "فريق يؤدي المطلوب لكن بدون تميز. خبرة متوسطة. قد يحتاج دعماً خارجياً في بعض التخصصات." },
      { score: 4, label: "4 نقاط — تكليف ضعيف", description: "فريق مبتدئ أو غير مكتمل. القيادة العليا غير مشاركة. قد يتم نقل أعضاء الفريق لمشاريع أخرى." },
      { score: 2, label: "2 نقاط — فريق غير واضح أو عديم الخبرة", description: "لم يتم تحديد فريق واضح. أو الفريق المقترح بدون خبرة كافية. مخاطرة عالية في جودة المخرجات." },
    ],
  },
  {
    id: 7,
    name: "إدارة الوقت والتحكم في البرنامج",
    weight: 8.5,
    color: "from-teal-500 to-green-600",
    bgLight: "bg-teal-50",
    borderColor: "border-teal-200",
    importance: "في المشاريع العقارية، الوقت هو مال. كل شهر تأخير في التصميم يعني تأخيراً في البناء وتأخيراً في البيع والتسليم. الاستشاري المنضبط زمنياً يلتزم بالجدول ويسلم الموافقات في وقتها. سرعة الاستجابة للملاحظات وسرعة الحصول على موافقات الجهات الحكومية مؤشرات مهمة.",
    levels: [
      { score: 10, label: "10 نقاط — سجل ممتاز", description: "انضباط جدولة قوي، موافقات سريعة مثبتة. يسلم قبل الموعد أو في الموعد المحدد. نظام إدارة مشاريع متطور. تقارير تقدم دورية. سجل مثبت في الحصول على موافقات الجهات بسرعة." },
      { score: 8, label: "8 نقاط — تحكم جيد", description: "يلتزم بالمواعيد في معظم الحالات. تأخيرات طفيفة ومبررة. تواصل جيد حول الجدول الزمني." },
      { score: 6, label: "6 نقاط — مقبول", description: "التزام متوسط بالمواعيد. يحتاج متابعة مستمرة. تأخيرات متكررة لكن ليست كبيرة." },
      { score: 4, label: "4 نقاط — تأخيرات محتملة", description: "سجل تأخيرات في مشاريع سابقة. ضعف في إدارة الوقت. يحتاج ضغط مستمر للالتزام." },
      { score: 2, label: "2 نقاط — تحكم ضعيف", description: "تأخيرات كبيرة ومتكررة. لا يلتزم بأي جدول زمني. يسبب خسائر مالية بسبب التأخير." },
    ],
  },
  {
    id: 8,
    name: "الاهتمام الخاص بالمشروع ومرونة التعامل",
    weight: 8,
    color: "from-orange-500 to-red-600",
    bgLight: "bg-orange-50",
    borderColor: "border-orange-200",
    importance: "هل المشروع أولوية لدى الاستشاري أم مجرد مشروع عادي ضمن عشرات المشاريع؟ الاستشاري الذي يعتبر مشروعك أولوية سيخصص أفضل كوادره، يستجيب بسرعة، ويبذل جهداً إضافياً. المرونة في التعامل تعني القدرة على التكيف مع التغييرات والملاحظات دون تعقيد.",
    levels: [
      { score: 10, label: "10 نقاط — أولوية قصوى", description: "المشروع أولوية قصوى لدى الاستشاري، اهتمام خاص جداً، متابعة مستمرة، ومرونة عالية في التعامل. يشعرك بأن مشروعك هو الأهم لديه. استجابة فورية للملاحظات." },
      { score: 8, label: "8 نقاط — أهمية خاصة", description: "المشروع ذو أهمية خاصة، اهتمام واضح، وتواصل جيد ومرن. يخصص وقتاً كافياً ويستجيب بسرعة معقولة." },
      { score: 6, label: "6 نقاط — اهتمام جيد", description: "المشروع يلقى اهتمام جيد، استجابة مقبولة وتعاون معقول. يؤدي المطلوب لكن بدون جهد إضافي." },
      { score: 4, label: "4 نقاط — اهتمام محدود", description: "المشروع أحد مشاريع الشركة العادية، اهتمام محدود دون تميّز. استجابة بطيئة أحياناً." },
      { score: 2, label: "2 نقاط — اهتمام منخفض", description: "المشروع ليس ذو أهمية لديهم، استجابة ضعيفة واهتمام منخفض. قد يتأخر في الرد أو يهمل الملاحظات." },
    ],
  },
  {
    id: 9,
    name: "مرونة التعاقد",
    weight: 7,
    color: "from-cyan-500 to-blue-600",
    bgLight: "bg-cyan-50",
    borderColor: "border-cyan-200",
    importance: "المشاريع العقارية تتطلب تعديلات مستمرة أثناء التصميم — تغيير في عدد الوحدات، تعديل الواجهات، إضافة طابق. الاستشاري المرن يتقبل هذه التعديلات ضمن نطاق العمل المعقول دون مطالبات مالية مبالغ فيها. الاستشاري الجامد يحول كل تعديل صغير إلى أمر تغيير مكلف.",
    levels: [
      { score: 10, label: "10 نقاط — مرونة ممتازة", description: "لا أعمال إضافية غير مبررة، ومرونة ممتازة جداً في التعديلات ضمن نطاق العمل، مع شروط عادلة وواضحة. يتفهم طبيعة المشاريع العقارية وحاجتها للتعديلات المستمرة." },
      { score: 8, label: "8 نقاط — مرونة جيدة", description: "مرونة ممتازة في التعديلات، مع بعض القيود المنطقية على الأعمال الإضافية. شروط واضحة ومعقولة." },
      { score: 6, label: "6 نقاط — مرونة متوسطة", description: "يقبل التعديلات لكن بإجراءات رسمية وشروط عديدة. يحتاج تفاوض على كل تعديل." },
      { score: 4, label: "4 نقاط — مرونة محدودة", description: "رسمي في التعاقد، يميل لتقييد التعديلات ولا يبدي مرونة إلا في نطاق ضيق. يطالب بأوامر تغيير لمعظم التعديلات." },
      { score: 2, label: "2 نقاط — جمود تعاقدي", description: "مبالغ في تكاليف التعديلات والأعمال الإضافية، ويربط معظم التغييرات بمطالبات مالية مرهقة للمشروع. يحول العلاقة إلى صراع مالي مستمر." },
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
              مستويات التقييم — ماذا تعني كل نقطة؟
            </h4>
            {criterion.levels.map((level) => (
              <div key={level.score} className="flex gap-3 items-start">
                <div className={`w-16 h-12 rounded-lg flex items-center justify-center shrink-0 font-bold text-sm ${
                  level.score === 10 ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                  level.score === 8 ? 'bg-sky-100 text-sky-700 border border-sky-200' :
                  level.score === 6 ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                  level.score === 4 ? 'bg-orange-100 text-orange-700 border border-orange-200' :
                  'bg-red-100 text-red-700 border border-red-200'
                }`}>
                  {level.score}
                </div>
                <div className="flex-1">
                  <p className={`font-semibold text-sm ${
                    level.score === 10 ? 'text-emerald-700' :
                    level.score === 8 ? 'text-sky-700' :
                    level.score === 6 ? 'text-amber-700' :
                    level.score === 4 ? 'text-orange-700' :
                    'text-red-700'
                  }`}>{level.label}</p>
                  <p className="text-sm text-stone-500 leading-relaxed mt-1">{level.description}</p>
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
              <p className="text-stone-400 text-sm">شرح مفصل لكل معيار ومستويات النقاط — مرجع أساسي لأعضاء اللجنة قبل التقييم</p>
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
                  <th className="text-center py-2 px-3 text-stone-500 font-medium">النقاط</th>
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
                    <td className="py-2.5 px-3 text-center text-stone-500">2 — 10</td>
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
            <p>كل معيار يُقيّم من <strong className="text-stone-800">2 إلى 10 نقاط</strong> (5 مستويات: 2، 4، 6، 8، 10). كل مستوى له وصف دقيق يساعد المقيّم في اختيار النقاط المناسبة.</p>
            <p>النتيجة النهائية لكل استشاري = مجموع (نقاط كل معيار × وزن المعيار). الاستشاري الحاصل على أعلى مجموع هو الأفضل وفق التقييم.</p>
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
              <span>اقرأ وصف كل مستوى بعناية قبل اختيار النقاط — الفرق بين 6 و 8 قد يكون دقيقاً لكنه مهم.</span>
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
              <span>إذا لم تكن متأكداً، اختر 6 نقاط (متوسط) كنقطة بداية ثم عدّل حسب المعلومات المتاحة.</span>
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
