# Financial Engine Rules - Key Context

## Investor Account Payment Rules (16 items)
1. ثمن الأرض — مدفوع (قبل المشروع)
2. عمولة وسيط الأرض — مدفوع (قبل المشروع)
3. رسوم تسجيل الأرض (4%) — مدفوع (قبل المشروع)
4. رسوم المساح DWG — مدفوع (قبل المشروع)
5. أتعاب الاستشاري (تصميم) — حسب مراحل التصميم السبع (7 phases with % and weeks)
6. أتعاب الاستشاري (إشراف) — شهرياً خلال الإنشاء
7. رسوم المجتمع (DLD) — دفعة واحدة عند تسجيل المشروع
8. تسجيل وحدات ريرا — خلال مرحلة ريرا
9. تقرير مدقق ريرا — ربع سنوي خلال الإنشاء
10. فحص ريرا — ربع سنوي خلال الإنشاء
11. تحضير مواد التسويق — بالتساوي على مدة تحضير المواد (2 شهر default)
12. التسويق — حسب جدول وائل (قنوات × أشهر) from MarketingPage
13. أتعاب المطور (15%) — تُدفع بعد شهر من استلام المستثمر لأموال حساب الضمان (تصفية الإسكرو)، يُحتجز 15% من المبلغ ويُصرف في الشهر 13 بعد الإنجاز
14. رسوم الفرز (40 AED/sqft) — تُدفع في الشهر الأول من مرحلة ريرا + اعتمادات البيع
15. عمولة المبيعات (5%) — تُصرف عند تحصيل 20% من قيمة الوحدة من المشتري
16. رسوم المساح As-Built — تُدفع في الشهر قبل الأخير من الإنشاء

## Escrow Account Payment Rules (9 items)
1. أقساط المقاول (S-Curve) — شهرياً حسب منحنى الإنشاء
2. رسوم الاستشاري (إشراف) — شهرياً خلال الإنشاء
3. عمولة المبيعات (5%) — عند كل عملية بيع
4. رسوم الفرز — عند اكتمال البناء
5. رسوم NOC — عند التسليم
6. إيداع الضمان (5%) — محتجز حتى نهاية فترة الضمان
7. رسوم DLD Transfer — عند نقل الملكية
8. رسوم OQOOD — عند التسجيل
9. رسوم خدمات (Service Charge) — سنوياً

## Project Phases (anchor = schematic design completion)
- التصاميم: month 1, duration = sum of 7 design phases (from settings)
- Schematic Design Completion = sum of weeks for phases 1+2+3 (mobilization+concept+schematic)
- تحضير مواد التسويق: starts at schematic completion, duration 2 months (editable)
- ريرا + اعتمادات البيع: starts 1 month after schematic completion, duration 2 months (editable)
- إطلاق التسويق: starts after marketing materials prep completion, duration = Wael decides
- بدء المبيعات: starts 1 month after RERA completion, duration = Wael decides via sales absorption
- الإنشاء: from general inputs (constructionMonths)

## Payment Plan (from V2WaelSales)
- ppDownPct: booking payment % (e.g., 10%)
- ppSecondPct: second payment % (e.g., 10%)
- ppSecondAfter: months after sale for second payment (e.g., 1)
- ppInstallmentPct: construction installments % (e.g., 50%)
- ppInstallmentEvery: interval in months between installments
- ppHandoverPct: handover payment % (e.g., 30%)
- Handover = at construction completion

## Cash Inflow Engine (in V2WaelSales)
- For each month of sales: takes units sold × unit price × payment plan
- Distributes installments across future months
- Produces monthly cash inflow array
- This feeds into Escrow revenues

## Marketing Distribution (MarketingPage)
- Sliders set channel % caps (digital, outdoor, events, broker, PR, content)
- Table: channels × months, Wael inputs amounts
- Total per channel must not exceed cap from slider
- Even distribution button respects channel percentages

## Key Files
- V2WaelSales.tsx: Sales absorption, payment plan, cash inflow engine, escrow computation
- MarketingPage.tsx: Marketing budget distribution by channel × month
- TimelinePage.tsx: Project phases timeline bar + consultant schedule
- SettingsRulesPage.tsx: Project phases, design phases, rates, payment rules display
- InvestorCashFlowSchedulePage.tsx: TODO - needs to show monthly investor expenses
- EscrowCashFlowSchedulePage.tsx: TODO - needs to show monthly escrow flows (revenues - expenses)

## Remaining TODO Items
- Build Investor Cash Flow Schedule page (monthly distribution of all investor expenses)
- Build Escrow Cash Flow Schedule page (revenues from payment plan - escrow expenses)
- Fix revenue inconsistency (use unit counts × area × price from project record)
- Fix 5% retention (must equal exactly 5% of totalRevenue)
- Rebuild revenue logic with proper Payment Plan distribution
- Connect V2 output pages to read from input sources (not hardcoded)
- Add Scenario 4 (rental/no sale)
- Distribute units in PricingPage for each project
