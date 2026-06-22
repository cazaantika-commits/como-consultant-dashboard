# 📋 تدفق عروض الاستشاريين في المكاتب الاستشارية

## 🎯 نظرة عامة

صفحة **المكاتب الاستشارية (CPAPage)** تحتوي على **6 شاشات** متتالية:

```
1. قائمة المشاريع (Home)
    ↓
2. تفاصيل المشروع + قائمة الاستشاريين (Project Detail)
    ↓
3. استيراد JSON (Import JSON)
    ↓
4. مراجعة النطاق (Scope Review)
    ↓
5. نتائج التقييم والترتيب (Results)
    ↓
6. تقرير التكلفة الحقيقية (True Cost Report)
```

---

## 📍 الشاشة 2: تفاصيل المشروع + عروض الاستشاريين

### **الموقع في الكود:**
- ملف: `CPAPage.tsx`
- دالة: `ProjectDetailScreen` (سطر 491)

### **البيانات المعروضة:**

#### **1. بيانات المشروع (Project Stats)**
```
┌─────────────────────────────────────┐
│ BUA: 875,300 قدم²                  │
│ تكلفة الإنشاء: AED 301,978,500      │
│ مدة الإشراف: 24 شهر                │
│ فئة المبنى: Residential             │
└─────────────────────────────────────┘
```

**المصدر:** جدول `cpa_projects`
```javascript
- bua_sqft: المساحة
- construction_cost_per_sqft: سعر القدم
- duration_months: مدة الإشراف
- category_label: فئة المبنى
```

---

#### **2. قائمة الاستشاريين (Consultants List)**

**كل استشاري يعرض:**
```
┌──────────────────────────────────────────────┐
│ ARTEC Architectural & Engineering Consultants│
│ Status: مؤكد | Rank: المركز 1 🥇            │
│ Code: ARTEC-001                              │
├──────────────────────────────────────────────┤
│ أتعاب التصميم المقتبسة: AED 5,435,613       │
│ فجوة النطاق: AED 120,000                    │
│ التكلفة الحقيقية الإجمالية: AED 11,595,183 │
└──────────────────────────────────────────────┘
```

**الأزرار:**
- 📄 **JSON** - استيراد/تعديل بيانات JSON
- 👁️ **النطاق** - مراجعة نطاق العمل
- 🗑️ **حذف** - إزالة الاستشاري

---

### **العمليات الرئيسية:**

#### **1. إضافة استشاري**
```
Button: "+ إضافة"
    ↓
Dialog: اختر الاستشاري من القائمة الرئيسية
    ↓
API: addConsultant
    ↓
تحديث قائمة الاستشاريين
```

**الكود:**
```typescript
const addMutation = trpc.cpa.consultants.addConsultant.useMutation({
  onSuccess: () => { consultantsQuery.refetch(); setShowAdd(false); },
});
```

---

#### **2. استيراد JSON**
```
Button: "JSON"
    ↓
Screen 3: ImportJsonScreen
    ↓
استيراد بيانات العرض (أتعاب، نطاق، إلخ)
    ↓
حفظ في قاعدة البيانات
```

**البيانات المستوردة:**
```json
{
  "consultant_code": "ARTEC-001",
  "proposal_date": "2026-06-19",
  "design_fee": {
    "method": "PERCENTAGE",
    "percentage": 1.8
  },
  "supervision_fee": {
    "method": "PERCENTAGE",
    "percentage": 2.0
  },
  "scope_coverage": [
    { "item_number": 29, "status": "INCLUDED" },
    { "item_number": 30, "status": "EXCLUDED" }
  ]
}
```

---

#### **3. مراجعة النطاق**
```
Button: "النطاق"
    ↓
Screen 4: ScopeReviewScreen
    ↓
عرض جدول بنود النطاق
    ↓
تحديد الفجوات والتكاليف
```

---

#### **4. حساب التكلفة الحقيقية**
```
Button: "احسب التكلفة الحقيقية"
    ↓
API: evaluation.runEvaluation
    ↓
محرك الحساب:
  - حساب أتعاب التصميم
  - حساب أتعاب الإشراف
  - حساب فجوات النطاق
  - حساب التكلفة الحقيقية الإجمالية
  - ترتيب الاستشاريين
    ↓
تحديث البيانات
    ↓
عرض النتائج
```

**الكود:**
```typescript
const evalMutation = trpc.cpa.evaluation.runEvaluation.useMutation({
  onSuccess: (data) => {
    consultantsQuery.refetch();
    toast({ title: `تم حساب التكلفة لـ ${data.length} استشاري` });
  },
});
```

---

### **تعديل بيانات المشروع**

**الحقول القابلة للتعديل:**
```
┌─────────────────────────────────────┐
│ BUA (قدم مربع)                     │
│ تكلفة الإنشاء / قدم² (AED)         │
│ مدة الإشراف (شهر)                  │
│ فئة المبنى                          │
└─────────────────────────────────────┘
```

**التأثير:**
- تغيير BUA أو السعر → إعادة حساب التكاليف
- تغيير المدة → إعادة حساب أتعاب الإشراف
- تغيير الفئة → تحديث المرجع

---

## 🔄 تدفق البيانات الكامل

```
┌─────────────────────────────────────────────────────────┐
│ جدول cpa_projects (بيانات المشروع)                    │
│ - bua_sqft, construction_cost_per_sqft, duration_months │
└──────────────────┬──────────────────────────────────────┘
                   │
        ┌──────────┴──────────┐
        ↓                     ↓
┌──────────────────┐  ┌──────────────────────────┐
│ cpa_project_     │  │ cpa_consultants          │
│ consultants      │  │ (قائمة الاستشاريين)     │
│ (الربط)          │  │ - name, code, status     │
└──────────────────┘  └──────────────────────────┘
        │                     │
        └──────────┬──────────┘
                   ↓
        ┌──────────────────────────┐
        │ cpa_project_consultants  │
        │ (بيانات العرض)          │
        │ - design_fee_method      │
        │ - supervision_fee_method │
        │ - quoted_design_fee      │
        │ - quoted_supervision_fee │
        └──────────────────────────┘
                   │
        ┌──────────┴──────────┐
        ↓                     ↓
┌──────────────────┐  ┌──────────────────────────┐
│ cpa_consultant_  │  │ cpa_scope_coverage       │
│ scope_coverage   │  │ (نطاق العمل)            │
│ (النطاق)         │  │ - item_number, status    │
└──────────────────┘  └──────────────────────────┘
        │
        ↓
┌──────────────────────────────────────┐
│ محرك الحساب (Calculation Engine)     │
│ - حساب الأتعاب                       │
│ - حساب الفجوات                       │
│ - حساب التكلفة الحقيقية             │
│ - الترتيب                            │
└──────────────────────────────────────┘
        │
        ↓
┌──────────────────────────────────────┐
│ cpa_evaluation_results               │
│ (النتائج والترتيب)                  │
│ - total_true_cost                    │
│ - result_rank                        │
│ - design_scope_gap_cost              │
└──────────────────────────────────────┘
```

---

## 📊 الحسابات الرئيسية

### **أتعاب التصميم:**
```javascript
if (designType === 'PERCENTAGE') {
  designAmount = constructionCost × (designValue / 100)
} else {
  designAmount = designValue  // Lump Sum
}
```

### **أتعاب الإشراف:**
```javascript
if (supervisionType === 'PERCENTAGE') {
  supervisionAmount = constructionCost × (supervisionValue / 100)
} else if (supervisionType === 'MONTHLY_RATE') {
  supervisionAmount = monthlyRate × durationMonths
} else {
  supervisionAmount = supervisionValue  // Lump Sum
}
```

### **فجوات النطاق:**
```javascript
designGapCost = sum of excluded items costs
supervisionGapCost = sum of excluded supervision items
```

### **التكلفة الحقيقية:**
```javascript
totalTrueCost = designAmount + designGapCost + supervisionAmount + supervisionGapCost
```

### **الترتيب:**
```javascript
lowestCost = min(totalTrueCost for all consultants)
rank = sorted by totalTrueCost ascending
```

---

## 🎯 الخلاصة

**عروض الاستشاريين في CPAPage:**
1. ✅ عرض بيانات المشروع والاستشاريين
2. ✅ إضافة/حذف الاستشاريين
3. ✅ استيراد بيانات JSON
4. ✅ مراجعة النطاق
5. ✅ حساب التكلفة الحقيقية
6. ✅ ترتيب الاستشاريين
7. ✅ عرض النتائج والتقارير

**هذا هو الأصل الذي يجب أن ينعكس في مركز القيادة!** 🚀
