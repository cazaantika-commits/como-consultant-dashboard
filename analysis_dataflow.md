# Data Flow Analysis

## Current Flow (BROKEN):
- `cashFlowEngine.ts` has HARDCODED constants:
  - `CONSTRUCTION_COST = 39,427,980`
  - `SALES_VALUE = 93,765,000`
- `getInvestorExpenses()` returns hardcoded totals (e.g., land=18M, developer_fee=4,688,250)
- `getEscrowExpenses()` returns hardcoded totals (e.g., contractor=33,513,783)
- `getDefaultRevenue()` uses hardcoded SALES_VALUE
- ExcelCashFlowPage calls `getInvestorExpenses()` → hardcoded
- EscrowCashFlowPage calls `getEscrowExpenses()` → hardcoded

## Required Flow:
- بطاقة المشروع (projects table) → has landPrice, soilTestFee, constructionPricePerSqft, etc.
- دراسة الجدوى (CostsCashFlowTab) → reads from project + marketOverview + competitionPricing → calculates dynamic costs
- أيقونة التدفقات (ExcelCashFlowPage + EscrowCashFlowPage) → should read from SAME source

## Solution:
1. Modify `getInvestorExpenses()` and `getEscrowExpenses()` to accept a `costs` parameter (the same object CostsCashFlowTab calculates)
2. ExcelCashFlowPage and EscrowCashFlowPage need to:
   a. Fetch project data (already have selectedProject from projects.list)
   b. Fetch marketOverview data
   c. Fetch competitionPricing data
   d. Calculate costs using same logic as CostsCashFlowTab
   e. Pass dynamic costs to getInvestorExpenses()/getEscrowExpenses()

## Mapping: CostsCashFlowTab item → cashFlowEngine item

### Investor items:
| cashFlowEngine id | cashFlowEngine name | Source from CostsCashFlowTab |
|---|---|---|
| land_cost | سعر الأرض | costs.landPrice |
| land_broker | عمولة وسيط الأرض (1%) | costs.agentCommissionLand |
| land_registration | رسوم تسجيل الأرض (4%) | costs.landRegistration |
| soil_test | فحص التربة | costs.soilTestFee |
| survey | المسح الطبوغرافي | costs.topographicSurveyFee |
| developer_fee | أتعاب المطور (5%) | costs.developerFee |
| design_fee | أتعاب التصميم (2%) | costs.designFee |
| fraz_fee | رسوم الفرز (40 د/قدم) | costs.separationFee |
| rera_registration | تسجيل بيع على الخارطة - ريرا | costs.reraProjectRegFee |
| rera_units | تسجيل الوحدات - ريرا | costs.reraUnitRegFee |
| surveyor_fee | رسوم المساح | costs.surveyorFees |
| noc_fee | رسوم NOC للبيع | costs.developerNocFee |
| escrow_fee | رسوم حساب الضمان | costs.escrowAccountFee |
| escrow_deposit | إيداع حساب الضمان (20%) | costs.constructionCost * 0.20 |
| contractor_advance | دفعة مقدمة للمقاول (10%) | costs.constructionCost * 0.10 |
| community_fee | رسوم المجتمع | costs.communityFees |
| contingency | احتياطي وطوارئ (2%) | costs.contingencies |
| marketing | التسويق والإعلان (2%) | costs.marketingCost |
| bank_fees | رسوم بنكية | costs.bankFees |

### Escrow items:
| cashFlowEngine id | cashFlowEngine name | Source from CostsCashFlowTab |
|---|---|---|
| gov_fees | رسوم الجهات الحكومية | costs.officialBodiesFees |
| contractor_payments | دفعات المقاول (85%) | costs.constructionCost * 0.85 |
| supervision_fee | أتعاب الإشراف (2%) | costs.supervisionFee |
| sales_agent | عمولة وكيل المبيعات (5%) | costs.salesCommission |
| rera_audit | تقارير تدقيق ريرا | costs.reraAuditReportFee |
| rera_inspection | تقارير تفتيش ريرا | costs.reraInspectionReportFee |
