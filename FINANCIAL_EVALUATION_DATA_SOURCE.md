# 📊 مصدر بيانات التقييم المالي في مركز القيادة

## 🎯 السؤال
**التقييم المالي لكل مشروع - من أين تأتي بياناته؟**

---

## 📍 الإجابة

### **المسار الكامل:**

```
مركز القيادة (CommandCenterPage.tsx)
    ↓
صفحة التقييم المالي (FinancialEvaluationView)
    ↓
استدعاء API: getProjectFinancialEvaluation
    ↓
Backend: commandCenter.ts (سطر 1431)
    ↓
جمع البيانات من 3 مصادر
```

---

## 🔍 المصادر الثلاثة للبيانات

### **1️⃣ جدول `projects` (بيانات المشروع)**
```sql
SELECT id, name, bua, pricePerSqft FROM projects WHERE id = ?
```

**البيانات:**
- معرف المشروع
- اسم المشروع
- مساحة البناء (BUA)
- سعر القدم المربع

**الحساب:**
```javascript
constructionCost = bua × pricePerSqft
// مثال: 875,300 × 345 = 301,978,500 درهم
```

---

### **2️⃣ جدول `financial_data` (الأتعاب المقتبسة)**
```sql
SELECT * FROM financial_data WHERE projectId = ?
```

**البيانات لكل استشاري:**
- `designType` - نوع أتعاب التصميم (pct = نسبة مئوية، أو مبلغ ثابت)
- `designValue` - قيمة أتعاب التصميم
- `supervisionType` - نوع أتعاب الإشراف
- `supervisionValue` - قيمة أتعاب الإشراف
- `designGapOverride` - تجاوز يدوي لفجوة التصميم (إن وجد)
- `supervisionGapOverride` - تجاوز يدوي لفجوة الإشراف (إن وجد)

**الحسابات:**
```javascript
// إذا كانت نسبة مئوية:
designAmount = constructionCost × (designValue / 100)

// إذا كانت مبلغ ثابت:
designAmount = designValue

// نفس الشيء للإشراف
supervisionAmount = supervisionType === 'pct' 
  ? constructionCost × (supervisionValue / 100)
  : supervisionValue
```

---

### **3️⃣ جدول `cpa_evaluation_results` (فجوات النطاق من CPA)**
```sql
SELECT 
  consultant_id,
  design_scope_gap_cost,
  supervision_gap_cost
FROM cpa_evaluation_results
WHERE project_id = ?
```

**البيانات:**
- `design_scope_gap_cost` - تكلفة فجوات التصميم (محسوبة تلقائياً من CPA)
- `supervision_gap_cost` - تكلفة فجوات الإشراف (محسوبة تلقائياً من CPA)

**الأولوية:**
```javascript
// إذا كان هناك تجاوز يدوي:
designGapCost = fin.designGapOverride

// وإلا استخدم القيمة من CPA:
designGapCost = cpaDesignGap

// نفس الشيء للإشراف
supervisionGapCost = fin.supervisionGapOverride || cpaSupervisionGap
```

---

## 🧮 الحساب النهائي

```javascript
// الخطوة 1: حساب الأتعاب الأساسية
designAmount = (fin.designType === 'pct') 
  ? constructionCost × (fin.designValue / 100)
  : fin.designValue

supervisionAmount = (fin.supervisionType === 'pct')
  ? constructionCost × (fin.supervisionValue / 100)
  : fin.supervisionValue

// الخطوة 2: إضافة الفجوات
designTotal = designAmount + designGapCost
supervisionTotal = supervisionAmount + supervisionGapCost

// الخطوة 3: المجموع الكلي
totalFees = designTotal + supervisionTotal

// الخطوة 4: حساب السكور (نسبة من الأقل سعراً)
lowestFee = أقل totalFees بين جميع الاستشاريين
financialScore = (lowestFee / totalFees) × 100
```

---

## 📋 مثال عملي

**المشروع:**
- BUA: 875,300 قدم²
- سعر القدم: 345 درهم/قدم²
- تكلفة البناء: 301,978,500 درهم

**الاستشاري: ARTEC**
- أتعاب التصميم: 1.8% (نسبة مئوية)
- أتعاب الإشراف: 2% (نسبة مئوية)
- فجوة التصميم: 120,000 درهم (من CPA)
- فجوة الإشراف: 0 درهم

**الحساب:**
```
designAmount = 301,978,500 × (1.8 / 100) = 5,435,613 درهم
supervisionAmount = 301,978,500 × (2 / 100) = 6,039,570 درهم

designTotal = 5,435,613 + 120,000 = 5,555,613 درهم
supervisionTotal = 6,039,570 + 0 = 6,039,570 درهم

totalFees = 5,555,613 + 6,039,570 = 11,595,183 درهم

financialScore = (11,595,183 / 11,595,183) × 100 = 100% (الأفضل سعراً)
```

---

## 🔗 العلاقات بين الجداول

```
projects
    ↓
    ├─→ financial_data (الأتعاب المقتبسة)
    │
    └─→ cpa_projects
        ↓
        └─→ cpa_project_consultants
            ↓
            └─→ cpa_evaluation_results (الفجوات)
```

---

## ⚙️ العمليات التلقائية

### **عند فتح صفحة التقييم المالي:**

1. **استدعاء `runCalculationEngine`** (سطر 1454)
   - يعيد حساب فجوات CPA تلقائياً
   - يضمن أن البيانات محدثة

2. **جمع البيانات من المصادر الثلاثة**
   - بيانات المشروع
   - الأتعاب المقتبسة
   - الفجوات المحسوبة

3. **حساب الأتعاب والسكور**
   - تطبيق الصيغ أعلاه
   - ترتيب الاستشاريين

---

## 📊 البيانات المعروضة

| البيان | المصدر | الحساب |
|--------|--------|--------|
| مساحة البناء | projects.bua | مباشر |
| سعر القدم | projects.pricePerSqft | مباشر |
| تكلفة البناء | محسوب | bua × pricePerSqft |
| أتعاب التصميم | financial_data | نسبة أو مبلغ ثابت |
| فجوة التصميم | cpa_evaluation_results | محسوب من CPA |
| مجموع التصميم | محسوب | أتعاب + فجوة |
| أتعاب الإشراف | financial_data | نسبة أو مبلغ ثابت |
| فجوة الإشراف | cpa_evaluation_results | محسوب من CPA |
| مجموع الإشراف | محسوب | أتعاب + فجوة |
| المجموع الكلي | محسوب | تصميم + إشراف |
| السكور المالي | محسوب | (الأقل / الحالي) × 100 |

---

## 🎯 الخلاصة

**التقييم المالي يجمع بين:**
1. ✅ **البيانات الثابتة** (المشروع)
2. ✅ **البيانات المدخلة يدويًا** (الأتعاب المقتبسة)
3. ✅ **البيانات المحسوبة تلقائياً** (الفجوات من CPA)

**النتيجة:**
- جدول شامل يوضح الأتعاب الحقيقية لكل استشاري
- ترتيب تلقائي حسب التكلفة
- سكور مالي يعكس القيمة النسبية

---

**هل تريد تعديل أي شيء في هذا النظام؟** 🚀
