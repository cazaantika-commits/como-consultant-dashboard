# دليل ربط Property Monitor مع محرك جويل

## ما هو Property Monitor؟

Property Monitor هو المزود الرائد لتكنولوجيا العقارات وذكاء السوق في الإمارات. يقدم بيانات شاملة عن سوق العقارات في دبي والإمارات تشمل: بيانات المعاملات (بيع، إيجار، رهن عقاري)، مؤشرات الأسعار، تحليلات السوق، بيانات المشاريع والعرض، ورسوم الخدمات.

---

## المنتجات المتاحة من Property Monitor

| المنتج | الوصف | نوع الوصول | الأهمية لجويل |
|--------|-------|-----------|--------------|
| **PMiQ** (Intelligence Platform) | منصة SaaS كاملة للبيانات والتحليلات | اشتراك مدفوع | عالية جداً |
| **PM API Connect** | واجهات برمجة REST APIs للربط المباشر | اشتراك مدفوع | عالية جداً (للربط التلقائي) |
| **PM Reports** | تقارير مخصصة حسب الطلب | مدفوع | متوسطة |
| **Monthly Market Report** | تقرير شهري مجاني | مجاني (تحميل PDF) | متوسطة |
| **Dynamic Price Index (DPI)** | مؤشر أسعار ديناميكي | مجاني جزئياً | متوسطة |

---

## البيانات المتاحة عبر PM API Connect (الأهم لجويل)

PM API Connect يوفر 7 أنواع من البيانات عبر REST APIs:

| نوع البيانات | الوصف | الاستخدام في جويل |
|-------------|-------|-------------------|
| **Comparable Transaction Data** | بيانات معاملات البيع والإيجار والرهن في الوقت الفعلي | محرك 3 (تحليل السوق)، محرك 7 (التسعير) |
| **Market Statistics** | إحصائيات السوق الشاملة | محرك 3، محرك 4 (التحليل المالي) |
| **Indices and Trends** | مؤشرات الأسعار والاتجاهات | محرك 3، محرك 6 (استراتيجية المنتج) |
| **Points of Interest (POIs)** | نقاط الاهتمام والخدمات القريبة | محرك 2 (تحليل الموقع) |
| **Address Look-Up / Match** | مطابقة العناوين والمواقع | محرك 2 |
| **Location Matrix** | مصفوفة المواقع والمقارنات | محرك 2، محرك 3 |
| **Consumer AVM** | نموذج التقييم الآلي للعقارات | محرك 7 (التسعير)، محرك 4 (المالي) |

---

## الخطوات المطلوبة منك

### الخطوة 1: التسجيل للحصول على PM API (الأولوية القصوى)

هذه هي الخطوة الأهم لأنها تمكّن الربط التلقائي المباشر مع جويل.

**ادخل على هذا الرابط واملأ النموذج:**
> https://propertymonitor.com/products-and-services/pm/pm-api

**البيانات المطلوبة في النموذج:**

| الحقل | ما تكتبه |
|-------|---------|
| **Name** | اسمك الكامل |
| **Company name** | Como Developments (أو اسم شركتك) |
| **Email address** | بريدك الإلكتروني الرسمي |
| **Phone number** | رقم هاتفك |
| **Industry of company** | اختر **Developers** من القائمة |
| **Comment** | اكتب: "We are a real estate developer looking to integrate PM API Connect into our internal feasibility study platform for automated market analysis, pricing intelligence, and comparable transaction data. We need API access for: Comparable Transactions, Market Statistics, Indices, POIs, Location Matrix, and Consumer AVM." |

**ملاحظة مهمة:** بعد التسجيل، سيتواصل معك فريق المبيعات لمناقشة الباقة والأسعار. الأسعار غير معلنة على الموقع وتعتمد على حجم الاستخدام.

---

### الخطوة 2: التسجيل في PMiQ (اختياري لكن مفيد)

PMiQ هي المنصة التفاعلية التي تتيح لك الوصول اليدوي للبيانات. مفيدة حتى لو حصلت على API.

**ادخل على هذا الرابط واملأ النموذج:**
> https://propertymonitor.com/products-and-services/pm/pmiq

**نفس البيانات أعلاه، لكن في Comment اكتب:**
> "Interested in PMiQ platform for our development team to access comparable data, market statistics, project supply data, and service charge information for feasibility studies."

---

### الخطوة 3: تحميل التقارير الشهرية المجانية (فوراً - مجاني)

بينما تنتظر رد فريق PM على طلب API، يمكنك تحميل التقارير المجانية فوراً:

**ادخل على هذا الرابط:**
> https://propertymonitor.com/insights/category/monthly-market-report

**حمّل آخر 6 تقارير شهرية (PDF مجاني):**
1. Monthly Market Report December 2025
2. Monthly Market Report October 2025
3. Monthly Market Report September 2025
4. Monthly Market Report August 2025
5. Monthly Market Report July 2025
6. Monthly Market Report June 2025

**بعد التحميل:** ارفع ملفات PDF على المنصة في قسم "قاعدة المعرفة" حتى تستطيع جويل قراءتها واستخدامها في التحليلات.

---

### الخطوة 4: تحميل تقرير DPI المجاني

**ادخل على هذا الرابط:**
> https://propertymonitor.com/insights/dynamic-price-index

**أو حمّل مباشرة آخر تقرير PDF:**
> https://propertymonitor.ae/pmdpi/PM_Market_Report_073_2025_10.pdf

---

### الخطوة 5: الاشتراك في النشرة البريدية (مجاني)

في أسفل أي صفحة على موقع Property Monitor، ستجد نموذج "Get the latest monthly market report":

| الحقل | ما تكتبه |
|-------|---------|
| **First Name** | اسمك الأول |
| **Last Name** | اسمك الأخير |
| **Email** | بريدك الإلكتروني |

هذا يضمن وصول كل تقرير جديد لبريدك تلقائياً.

---

## معلومات التواصل مع Property Monitor

| الوسيلة | التفاصيل |
|---------|---------|
| **الهاتف** | +971 56 934 0078 |
| **البريد الإلكتروني** | sales@propertymonitor.com |
| **العنوان** | d3 Building 3, 7th Floor, Dubai Design District, Dubai, UAE |
| **LinkedIn** | Property Monitor على LinkedIn |

---

## ما الذي سأفعله بعد حصولك على API Key؟

بمجرد حصولك على API Key من Property Monitor، سأقوم بـ:

1. **ربط PM API مباشرة مع محرك جويل** - كل محرك سيسحب البيانات تلقائياً
2. **محرك تحليل الموقع (2)** - سيستخدم POIs و Location Matrix
3. **محرك تحليل السوق (3)** - سيستخدم Comparable Transactions و Market Statistics
4. **محرك التحليل المالي (4)** - سيستخدم Consumer AVM و Indices
5. **محرك استراتيجية المنتج (6)** - سيستخدم Indices and Trends
6. **محرك ذكاء التسعير (7)** - سيستخدم Comparable Data و Consumer AVM
7. **تحديث واجهة بيانات جويل** - لعرض حالة الاتصال بـ PM في الوقت الفعلي

---

## ملاحظات مهمة

**بخصوص التكلفة:** Property Monitor لا ينشر أسعاره علناً. الحد الأدنى للاشتراك في PMiQ هو 10 مستخدمين (حسب معلومات من مستخدمين آخرين). أسعار API تعتمد على حجم الاستخدام وعدد الطلبات. يُنصح بالتفاوض على باقة "Developer" المخصصة للمطورين العقاريين.

**البديل المؤقت:** حتى تحصل على API، يمكنني ربط جويل بمصادر بيانات مجانية مثل: تقارير PM الشهرية المجانية (بعد رفعها لقاعدة المعرفة)، بيانات DXB Interact المجانية، وبيانات Property Finder و Bayut عبر web scraping.

---

## ملخص الإجراءات المطلوبة

| الرقم | الإجراء | الوقت المطلوب | التكلفة |
|-------|--------|-------------|---------|
| 1 | التسجيل لطلب PM API Connect | 5 دقائق | مجاني (التسجيل) |
| 2 | التسجيل لطلب PMiQ | 5 دقائق | مجاني (التسجيل) |
| 3 | تحميل 6 تقارير شهرية مجانية | 10 دقائق | مجاني |
| 4 | تحميل تقرير DPI | 2 دقيقة | مجاني |
| 5 | الاشتراك في النشرة البريدية | 2 دقيقة | مجاني |
| 6 | التواصل مع فريق المبيعات (بعد ردهم) | 30 دقيقة | يعتمد على الباقة |
| 7 | إرسال API Key لي بعد الحصول عليه | 1 دقيقة | - |

**المجموع:** حوالي 25 دقيقة من العمل الفوري + انتظار رد فريق PM (عادة 1-3 أيام عمل)
