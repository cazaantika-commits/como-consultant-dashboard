# System Review Findings

## Consultant Design Fee Milestones (from cashFlowProgram.ts lines 1171-1193)
The existing system already has milestone-based design consultant fees:
- 20% — عند توقيع العقد (month 1)
- 20% — تسليم المفهوم التصميمي (month 2)
- 25% — تسليم التصاميم التفصيلية (month 4)
- 20% — تسليم مستندات المناقصة (month 5)
- 15% — الحصول على رخصة البناء (month 6)

Payment type: 'milestone', category: 'design_engineering'

## Design/Supervision Fee Methods (from cpa.ts)
Three methods supported:
1. LUMP_SUM — fixed amount
2. PERCENTAGE — % of construction cost
3. MONTHLY_RATE — monthly amount

## Existing Reports/Pages (91 pages total)
### Financial Reports:
1. **CapitalPortfolioPage** — Dynamic capital portfolio with O1/O2/O3 switches, delay controls, monthly table + export PDF (USER'S FAVORITE STYLE)
2. **PortfolioSummaryReport** — Summary table + monthly distribution (needs style upgrade)
3. **EscrowCashFlowPage** — Escrow revenues, expenses, running balance, RERA settlement
4. **CashFlowSettingsPage** — All settings including absorption schedule editor
5. **FeasibilityStudyPage** — Full feasibility with tabs (pricing, costs, summary)
6. **ExcelCashFlowPage** — Excel-style cash flow view
7. **ProgramCashFlowPage** — Program-level cash flow
8. **CashFlowComparisonPage** — Compare scenarios
9. **PortfolioAllScenariosPage** — All scenarios view
10. **CapitalScheduleTablePage** — Capital schedule table
11. **CapitalSchedulingHorizontal** — Horizontal scheduling view
12. **CapitalSchedulingPage** — Vertical scheduling view
13. **CapitalPlanningDashboard** — Planning dashboard
14. **FeasibilityStudySimplified** — Simplified feasibility
15. **FinancialFeasibilityTab** — Financial tab
16. **CashFlowHub** — Hub page
17. **CashFlowReflectionPage** — Reflection/analysis

### Feasibility Export (USER'S FAVORITE STYLE):
- Located in: client/src/lib/feasibilityReportExport.ts
- Style: Dark header (#0f172a), Cairo font, colored cards with left-border accent, grid layouts, professional print-ready

### Capital Portfolio Export (USER'S FAVORITE STYLE):
- Located in: CapitalPortfolioPage.tsx (exportToPDF function lines 209-515)
- Style: Same dark header, summary cards grid, phase-colored table cells, legend, footer
- Phase colors: orange (#fb923c) = design, pink (#db2777) = registration/offplan, purple (#7c3aed) = construction

## Current Phase Structure (investorCashFlow.ts)
- 5 phases: land → design → offplan → construction → handover
- User wants to REMOVE handover (only design + construction)
- Offplan = floating 2-month window

## Key Formulas Currently in Code:
- constructionCost = BUA × estimatedConstructionPricePerSqft ✓ (already formula)
- designFee = constructionCost × designFeePct% ✓
- supervisionFee = constructionCost × supervisionFeePct% ✓
- separationFee = totalGFA × separationFeePerSqft ✓
- developerFee = totalRevenue × developerFeePct% ✓
- salesCommission = totalRevenue × salesCommissionPct% ✓
- marketingCost = totalRevenue × marketingPct% ✓
- landRegistration = landPrice × 4% ✓
- agentCommission = landPrice × agentCommissionLandPct% ✓
- contingencies = constructionCost × 2% ✓

## User Corrections NOT Yet Applied:
1. reraUnitRegFee should = numberOfUnits × 800 (currently manual input)
2. communityFees should = GFA × rate (1 or 0.5 AED/sqft, configurable)
3. reraInspectionReportFee should = 15,000 × visits (every 3-4 months, first month 4, last after completion)
4. Design/supervision fees = either % OR lump sum (user's choice per project)
5. Sellable area % = manual input per project (already implemented, defaults 95/97/95)
6. Remove Handover phase — only Design + Construction
7. Progress Payment: 10% advance + 80% S-Curve + 5% after completion + 5% after 1 year
8. Developer fees: O1/O2 = 5% (2% design + 3% supervision); O3 = 3% (1% design + 2% supervision)
9. Consultant design fees = milestone-based (ALREADY EXISTS in cashFlowProgram.ts)

## Report Design Style Reference (from exported HTML):
- Font: Cairo (Google Fonts) weights 400/600/700/800
- Header: #0f172a dark navy, white text, COMO branding
- Summary cards: 4-grid, white bg, colored left-border (3px), small labels, bold values
- Table: dark header, 9px font, phase-colored cells with left-border indicators
- Total row: #1e293b bg, white bold text
- Legend: colored dots + labels
- Footer: "Como Developments · سري · للاستخدام الداخلي فقط"
- Print-ready with @media print
- Action buttons: fixed position, dark bg, rounded
