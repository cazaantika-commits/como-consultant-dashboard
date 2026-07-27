# Audit Findings — Data Sources & Architecture

## Current DB Tables

### `projects` table (MAIN SOURCE)
Fields:
- Basic: name, plotAreaSqft, manualBuaSqft, estimatedConstructionPricePerSqft
- Durations: preConMonths (default 6), constructionMonths (default 16), handoverMonths (default 2), startDate
- GFA: gfaResidentialSqft, gfaRetailSqft, gfaOfficesSqft
- Saleable %: saleableResidentialPct (95), saleableRetailPct (97), saleableOfficesPct (95)
- Percentages: agentCommissionLandPct, designFeePct, supervisionFeePct, salesCommissionPct, marketingPct, developerFeePct (5)
- Fixed fees: soilTestFee, topographicSurveyFee, reraUnitRegFee, developerNocFee, escrowAccountFee, bankFees, communityFees, surveyorFees, reraAuditReportFee, reraInspectionReportFee, reraProjectRegFee, officialBodiesFees, landPrice, separationFeePerSqft
- Unit counts: residential1brCount, residential2brCount, residential3brCount, retailSmallCount, retailMediumCount, retailLargeCount, officeSmallCount, officeMediumCount, officeLargeCount
- Unit areas: residential1brArea (750), residential2brArea (1300), residential3brArea (1650), retailSmallArea (500), retailMediumArea (1000), retailLargeArea (2000), officeSmallArea (600), officeMediumArea (1200), officeLargeArea (2000)
- Unit prices/sqft: residential1brPrice (1550), residential2brPrice (1500), residential3brPrice (1450), retailSmallPrice (2500), retailMediumPrice (2300), retailLargePrice (2100), officeSmallPrice (1800), officeMediumPrice (1700), officeLargePrice (1600)
- Financing: financingScenario

### `wael_sales_plans` table (WAEL'S DATA)
Fields:
- Timing: t12Date, t03 (3), t04 (0), t05 (5), t06 (3), designMonths (8), constructionMonths (30), postCompletionMonths (12)
- Revenue: totalRevenue, offplanPct (80)
- Percentages: marketingBudgetPct (2.00), salesCommissionPct (5.00)
- JSON data: salesAbsorptionJson, marketingDistJson, channelsJson, paymentPlanJson, resultsJson

### `cf_projects` table (CASH FLOW - partially duplicates projects)
Fields:
- Durations: designApprovalMonths (6), reraSetupMonths (3), constructionMonths (16), handoverMonths (2), preDevMonths (6)
- Sales: salesEnabled, salesStartMonth, salesVelocityUnits, salesVelocityAed, totalSalesRevenue
- Buyer plan: buyerPlanBookingPct (20), buyerPlanConstructionPct (30), buyerPlanHandoverPct (50)
- Escrow: escrowDepositPct (20), contractorAdvancePct (10), liquidityBufferPct (5)
- Construction: constructionCostTotal, buaSqft, constructionCostPerSqft

### `cf_project_costs` table (COST LINE ITEMS)
Fields: name, category (enum), totalAmount, paymentType (enum), paymentParams, phaseTag, fundingSource, escrowEligible

## Current Pages & Their Data Sources

### InvestorStudyHub (inside ProjectManagementPage)
5 tabs:
1. "البطاقة التعريفية" → ProjectCardOffplanPage (reads/writes to `projects` table)
2. "التسعير" → PricingPage (reads/writes unit counts/areas/prices to `projects` table)
3. "تدفقات المستثمر" → InvestorCashFlowSchedulePage (reads from `cf_projects` + `cf_project_costs`)
4. "تدفقات الضمان" → EscrowCashFlowSchedulePage2 (reads from `cf_projects` + `cf_project_costs`)
5. "التقرير المجمّع" → ConsolidatedInvestorCashFlowPage

### V2 Pages (ALL HARDCODED - do NOT read from DB)
- V2WaelSales — hardcoded UNIT_TYPES, MARKETING_CHANNELS, PROJECT_PHASES
- V2Feasibility — hardcoded REVENUE_ITEMS, COST_CATEGORIES
- V2InvestorCashFlow — hardcoded DESIGN_MONTHS=8, CONSTRUCTION_MONTHS=30, DEBIT_ITEMS
- V2EscrowCashFlow — hardcoded DESIGN_MONTHS=8, CONSTRUCTION_MONTHS=30, OUTFLOW_ITEMS

### Old WaelSalesPlan page (reads/writes to `wael_sales_plans` table)
- Uses trpc.waelSalesPlan.save/getByProject
- Manages: totalRevenue, designMonths, constructionMonths, offplanPct, marketingBudgetPct, salesCommissionPct, salesAbsorption[], marketingDist[], channels[], paymentPlan[]

## Target Architecture (4 Input Pages)

### 1. General Inputs Page
Source: `projects` table
Fields: plotAreaSqft, manualBuaSqft, estimatedConstructionPricePerSqft, preConMonths, constructionMonths, handoverMonths, startDate, gfaResidentialSqft, gfaRetailSqft, gfaOfficesSqft, saleableResidentialPct, saleableRetailPct, saleableOfficesPct, landPrice, agentCommissionLandPct, designFeePct, supervisionFeePct, separationFeePerSqft, developerFeePct, ALL fixed fees (soil, topo, surveyor, community, gov, noc, rera*, escrow, bank)

### 2. Construction Page
Source: NEW table or JSON field in `cf_projects`
Fields: monthly progress percentages (S-curve), contractor payment schedule, mobilization advance

### 3. Wael Page
Source: `projects` table (pricing) + `wael_sales_plans` table (sales plan)
Fields:
- FROM projects: unit counts, areas, prices (residential1br*, retail*, office*)
- FROM wael_sales_plans: salesAbsorption, marketingDist, channels, paymentPlan, offplanPct, marketingBudgetPct, salesCommissionPct

### 4. Settings/Rules Page
Source: NEW table or JSON field
Fields: timing rules (marketing start offset, sales start offset, gov fees month, design payment schedule, investor/escrow split rules)

## Key Routers
- `server/routers/projects.ts` → CRUD for projects table (update accepts any field)
- `server/routers/waelSalesPlan.ts` → CRUD for wael_sales_plans table
- `server/db.ts` → updateProject() syncs schedule fields to cf_projects

## Key Client Libraries
- `client/src/lib/projectData.ts` → PROJECT_INPUTS defaults, RATES, calculation functions
- `client/src/lib/investorCashFlowEngine.ts` → buildPricingUnits, cash flow calculations
- `client/src/contexts/ProjectContext.tsx` → selectedProjectId state shared across pages

## Implementation Plan for General Inputs Page

The General Inputs page should:
1. Use `useProjectContext()` to get selectedProjectId
2. Use `trpc.projects.getById.useQuery(selectedProjectId)` to load data
3. Use `trpc.projects.update.useMutation()` to save changes
4. Use `ProjectSelector` component for project selection
5. Use `dbProjectToInputs()` and `dbProjectToRates()` to convert DB data to typed inputs
6. Organize into sections: البيانات الأساسية, المساحات, الرسوم الثابتة, النسب
7. Show formulas as read-only computed fields
8. Theme: dark (oklch based), font: Tajawal, RTL
9. Available UI: Card, Badge, Button, Tabs, Slider, Select, Input, Tooltip, Table
10. Available charts: recharts 2.15
11. Icons: lucide-react

## InvestorStudyHub Modification

Current location: ProjectManagementPage.tsx lines 249-303
Current tabs: card, pricing, investor-cf, escrow-cf, consolidated
New tabs: general-inputs, construction, wael, settings, (then output tabs)

The hub imports pages and renders them inside tabs. We need to:
1. Create GeneralInputsPage.tsx
2. Create ConstructionInputsPage.tsx  
3. Rebuild V2WaelSales.tsx to read from DB (currently hardcoded)
4. Create SettingsRulesPage.tsx
5. Update InvestorStudyHub tabs to use new pages


## Cost Items Audit (Latest)

### Architecture Confirmed:
- **calculateCosts** (projectData.ts): Single source of truth for TOTALS
- **investorCashFlowEngine.ts**: Uses `calculateCosts()` for totals, distributes monthly
- **dbProjectToInputs** / **dbProjectToRates**: Read ALL settings from project DB record
- All pages use either `calculateCosts` directly or `computeInvestorCashFlow` which calls it

### ALL cost items from calculateCosts ARE present in the investor engine ✓
- Land items: landPrice, landRegistration, landBroker ✓
- Design: designFee, supervisionFee ✓
- Fixed fees: soilTest, topography, surveyorDwg, surveyorAsBuilt, communityFee, govFees, sortingFee, nocSale, reraProjectReg, reraUnits, escrowAccountFee, bankFees ✓
- Revenue-based: marketing, developerFee, salesCommission ✓
- Construction: contractorMobilization(10%), progress(80%), retention1(5%), retentionFinal(5%) ✓

### What's Working Correctly:
1. Change any rate in settings → saves to project → all engines read it ✓
2. Change unit counts/prices → saves to project → all engines recalculate ✓
3. Change designDuration/constructionDuration → saves to project → engines use it ✓
4. Change marketingPct → saves to project → engines use it ✓
5. Change marketingPrepMonths → NOW saves to project (after fix) → TimelinePage uses it ✓

### Remaining Issues:
- Marketing timing in engine uses hardcoded 12-month distribution, doesn't use marketingPrepMonths for prep phase timing
- This affects WHEN costs appear monthly but NOT the total amounts
