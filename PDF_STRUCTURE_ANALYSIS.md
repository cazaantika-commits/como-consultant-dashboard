# تحليل بنية ملف PDF - تقرير التكلفة الحقيقية

## الهيكل العام للتقرير

### الصفحة 1: الرأس والمعلومات الأساسية
```
COMO REAL ESTATE DEVELOPMENT
Engineering Consultancy Evaluation — True Cost Report
Project 180001 | 19 June 2026 | Confidential

[جدول المعلومات الأساسية]
BUA: 875,300 sqft
CONSTRUCTION COST: AED 301,978,500
DURATION: 24 months
CATEGORY: Large
```

### الصفحات 2-4: SECTION 1 — DESIGN FEE ANALYSIS

**لكل استشاري:**
1. **العنوان والكود**
   - اسم الاستشاري (مثل: ARTEC Architectural & Engineering Consultants)
   - الكود (مثل: AAEC)

2. **معلومات الأتعاب**
   - PRICING METHOD: PERCENTAGE (1.8% of CC) أو LUMP_SUM
   - QUOTED DESIGN FEE: AED 5,435,613

3. **جدول Scope Items**
   - الأعمدة: # | Scope Item | Status | Reference Cost (Large)
   - الحالات: ✓ Included | ✗ Excluded — Gap added
   - مثال: Item 32 "Vertical Transportation" | ✗ Excluded — Gap added | AED 50,000

4. **الملخص**
   - Total Design Gap Cost: AED 120,000
   - TRUE DESIGN FEE: AED 5,555,613 (مظلل بلون رمادي فاتح)

### الصفحات 5+: SECTION 1B — CONTRACTUAL & LEGAL RISK ANALYSIS

جدول يوضح الأخطار العقدية والقانونية

---

## المتطلبات الديناميكية

### الحقول الديناميكية المطلوبة:
1. **BUA** - قابل للتعديل
2. **سعر القدم المربع** - قابل للتعديل (يُحسب من Construction Cost ÷ BUA)
3. **CONSTRUCTION COST** - محسوب تلقائياً (BUA × Price per sqft)
4. **DURATION** - قابل للتعديل
5. **CATEGORY** - محسوب بناءً على BUA

### الحسابات الديناميكية:
- **للأتعاب بالنسبة المئوية:**
  - QUOTED DESIGN FEE = (Percentage / 100) × CONSTRUCTION COST
  - يجب أن تتحدث تلقائياً عند تغيير BUA أو Price per sqft

- **TRUE DESIGN FEE:**
  - TRUE DESIGN FEE = QUOTED DESIGN FEE + Total Design Gap Cost

---

## التصميم المطلوب

### الألوان والتنسيق:
- الرأس: أسود غامق (COMO REAL ESTATE DEVELOPMENT)
- العناوين الرئيسية: أزرق غامق (SECTION 1 — DESIGN FEE ANALYSIS)
- أسماء الاستشاريين: أسود غامق وعريض
- الأكواد: رمادي فاتح بين قوسين
- جداول: حدود رمادية فاتحة
- الملخصات: خلفية رمادية فاتحة جداً

### التخطيط:
- هامش علوي: 40px
- هامش سفلي: 40px
- هامش جانبي: 50px
- خط: Segoe UI أو Arial
- حجم الخط الأساسي: 11px
- حجم العنوان الرئيسي: 24px
- حجم العنوان الفرعي: 14px

---

## الصيغة المطلوبة

**المعادلات المراد عرضها:**
1. Construction Cost = BUA × Price per sqft
2. Quoted Design Fee = (Design % / 100) × Construction Cost
3. True Design Fee = Quoted Design Fee + Total Gap Cost
4. True Supervision Fee = Quoted Supervision Fee + Supervision Gap Cost
5. Total True Cost = True Design Fee + True Supervision Fee

