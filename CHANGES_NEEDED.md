# Changes Needed - Engine & Settings Rules

## 1. SettingsRulesPage - Add New Rules

### New section: PRE-PAID ITEMS (no cash flow)
Add to INVESTOR_RULES:
- { id: "landPrice", label: "سعر الأرض", timing: "مدفوع مسبقاً — لا يدخل في التدفقات النقدية الشهرية (جزء من تكلفة المشروع فقط)", type: "مدفوع" }
- { id: "landBroker", label: "عمولة وسيط الأرض", timing: "مدفوع مسبقاً — لا يدخل في التدفقات النقدية الشهرية (جزء من تكلفة المشروع فقط)", type: "مدفوع" }
- { id: "landRegistration", label: "رسوم تسجيل الأرض", timing: "مدفوع مسبقاً — لا يدخل في التدفقات النقدية الشهرية (جزء من تكلفة المشروع فقط)", type: "مدفوع" }

### Add developer fees rule:
- { id: "developerFees", label: "أتعاب المطور", timing: "40% من النسبة المحددة موزعة بالتساوي على مرحلة التصميم + 60% موزعة بالتساوي على مرحلة الإنشاء — تُدفع من المستثمر", type: "موزعة" }

### Add developer profit share rule:
- { id: "developerProfitShare", label: "حصة المطور من الأرباح (15%)", timing: "الدفعة 1: الشهر 3 بعد الإنجاز (15% × الفائض مع احتجاز نسبة) — الدفعة 2: الشهر 13 بعد الإنجاز (15% × ربح الدفعة الثانية + المحتجز من الأولى)", type: "مرتبطة بالأرباح" }

### Update marketing rule (already exists, just confirm wording):
- { id: "marketing", label: "التسويق", timing: "المبلغ والتوزيع الشهري يُنسخ مباشرة من صفحة التسويق كما أدخله وائل", type: "من صفحة التسويق" }

### Update sales commission rule in ESCROW_RULES:
- { id: "salesCommission", label: "عمولة المبيعات", timing: "نسبة العمولة × مبيعات كل شهر — تُصرف فقط عندما يسدد المشتري 20% من سعر الوحدة (حسب خطة الدفع)", type: "مرتبطة بالمبيعات" }

## 2. Fix Configurable Rates

### Change reraAuditorQuarterlyFee:
- Old: value: 15000
- New: value: 3500, description: "مبلغ كل دفعة ربع سنوية — يُدفع كل 3 أشهر من بداية الإنشاء حتى نهايته"

### Change reraInspectionQuarterlyFee:
- Old: value: 15000
- New: value: 15020, description: "مبلغ كل دفعة ربع سنوية — يُدفع كل 3 أشهر من بداية الإنشاء حتى نهايته"

## 3. Engine Changes (investorCashFlowEngine.ts)

### A. Land/broker/registration: Remove from monthly rows
- Currently these have rows with amounts in design month 0
- Change: mark as pre-paid, do NOT create monthly distribution rows for them
- They still count in totalCosts but NOT in the monthly cash flow grid

### B. Developer fees: Change from current distribution to 40/60
- Current: varies by scenario (S4: 1% design + 2% construction, others: different)
- New: ALL scenarios: 40% of total developer fee → equally distributed over design months, 60% → equally distributed over construction months
- Funder: investor

### C. RERA auditor: per-payment amount (not total)
- Current: i.reraAuditorReport is TOTAL, divided by number of payments
- New: amount per payment = 3500 (from settings), total = 3500 × number of quarterly payments
- Number of payments = floor(constructionDuration / 3) + 1 (every 3 months from construction start)

### D. RERA inspection: per-payment amount (not total)
- Current: i.reraInspection is TOTAL, divided by number of payments
- New: amount per payment = 15020 (from settings), total = 15020 × number of quarterly payments
- Number of payments = floor(constructionDuration / 3) + 1 (every 3 months from construction start)

### E. Community fee: compute from rate
- Current: i.communityFee is a manual total input
- New: compute = GFA × communityFeePerSqft (0.25) per payment × number of payments
- Number of payments = every 6 months from design start to construction end

### F. Marketing: read from marketing page data
- Current: auto-distributes 2% over 12 months
- New: read marketingScheduleJson from projectData, use the monthly amounts directly
- If no data, fallback to current behavior

### G. Sales commission: rate × monthly sales with 20% trigger
- Current: fixed amount at a single month
- New: for each month's sales, compute commission = salesCommissionRate × sales amount
- Payment timing: commission for a batch is paid only when buyer has paid 20% of unit price (from payment plan)

## 4. GeneralInputsPage Changes

### Disable manual input for these computed fields:
- reraAuditReportFee (now computed: 3500 × number of payments)
- reraInspectionReportFee (now computed: 15020 × number of payments)
- communityFees (now computed: GFA × 0.25 × number of payments)
- separationFeePerSqft → already a rate, but the total (sorting fee) should show as computed
- reraUnitRegistration → already computed (units × 520)

### Show these as read-only computed values with formula explanation
