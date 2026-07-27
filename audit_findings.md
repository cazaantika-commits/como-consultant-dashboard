# Audit Findings - Field Data Flow

## Summary of Issues Found and Fixed

### Issue 1: MarketingPage saves marketingPct ONLY to plan table, not project table
- **Problem**: V2WaelSales reads marketingPct from project table (line 153: `p.marketingPct`)
- **But**: MarketingPage saves it to plan table (`marketingBudgetPct` in waelSalesPlans)
- **Fix**: Added `updateProject.mutate({ id: selectedProjectId, marketingPct: String(marketingPct) })` in MarketingPage save handler
- **Status**: FIXED

### Issue 2: V2WaelSales saves commissionPct to BOTH project and plan
- Line 353: saves to project via `payload.salesCommissionPct = String(commissionPct)`
- Line 367: saves to plan via `salesCommissionPct: String(commissionPct)`
- **Status**: OK (no conflict)

## Field Ownership (Source of Truth)

| Field | Editable In | Read-Only In | Saves To |
|-------|-------------|--------------|----------|
| marketingPct | MarketingPage (slider) | FactSheetPage, V2WaelSales, ProjectCardOffplan | project + plan |
| commissionPct | V2WaelSales (slider) | FactSheetPage, ProjectCardOffplan | project + plan |
| designMonths | FactSheetPage, GeneralInputs, ProjectCard | V2WaelSales, Timeline, Marketing | project |
| constructionMonths | FactSheetPage, GeneralInputs, ProjectCard | V2WaelSales, Timeline, Construction | project |
| marketingPrepMonths | GeneralInputsPage | V2WaelSales, Timeline, Marketing | project |
| reraLeadMonths | GeneralInputsPage | V2WaelSales, Timeline, Marketing | project |
| startDate | FactSheetPage | V2WaelSales, Timeline, Marketing, CashFlow | project |
| offPlanPct | V2WaelSales (slider) | - | plan |

## Remaining Minor Issues
- WaelSalesPlan (old page, not in V2Hub) has editable designMonths/constructionMonths - saves to plan only, not project
- ProgramCashFlowPage has editable constructionMonths - independent tool, not linked to project
- ConstructionInputsPage saves constructionMonths to project - this is OK (reads from project, saves back)
