# Financial Engine Architecture Notes

## Current Architecture (to preserve, not delete)

### Files:
1. `client/src/lib/cashFlowEngine.ts` — Client-side engine with types, phase calc, expense distribution
2. `client/src/lib/projectCostsCalc.ts` — Shared cost formula (calculates ProjectCosts from raw data)
3. `server/routers/cashFlowProgram.ts` — Server-side program that creates cost items
4. `server/investorCashFlow.ts` — Server-side investor cash flow calculation
5. `server/routers/cashFlowSettings.ts` — Settings and default items

### Key Types (from cashFlowEngine.ts):
- `ExpenseBehavior`: "FIXED_ABSOLUTE" | "FIXED_RELATIVE" | "DISTRIBUTED" | "PERIODIC" | "SALES_LINKED" | "CUSTOM"
- `PhaseType`: "land" | "design" | "offplan" | "construction" | "handover"
- `PhaseDurations`: { design: number, offplan: number, construction: number, handover: number }
- `FinancingScenario`: "offplan_escrow" | "offplan_construction" | "no_offplan"
- `ProjectCosts`: Full interface with all cost fields + totalRevenue + totalCosts

### Phase Calculation:
- `calculatePhases(durations, offplanDelay)` → PhaseConfig[]
- Design starts month 1, offplan starts month 3 (after 2 months design), construction after design, handover after construction
- `getTotalMonths(durations)` = design + construction + handover (offplan overlaps)

### Distribution Logic (distributeExpense):
- FIXED_ABSOLUTE: No monthly distribution (land items, already paid)
- FIXED_RELATIVE: Lump sum at specific month within a phase
- DISTRIBUTED: Equal spread across phase(s), supports splitRatio
- PERIODIC: Every N months within a phase
- SALES_LINKED: Proportional to revenue distribution
- CUSTOM: Weighted blocks across phases

### Investor Expenses (getInvestorExpenses):
- Land items (FIXED_ABSOLUTE)
- Design phase: soil test, survey, developer fee (30/10/60 split), design fee
- Offplan/Construction (varies by scenario): fraz, RERA, NOC, escrow, community, surveyor
- Escrow deposit (O1 only) or contractor 20% in 3 installments (O2)
- Bank fees, contractor advance 10%, contingency, marketing

### Escrow Expenses (getEscrowExpenses):
- Gov fees (custom distribution: 80% at month 3, rest periodic)
- Contractor payments 70% (distributed across construction)
- Supervision fee (distributed across construction)
- Sales agent commission (sales-linked)
- RERA audit/inspection reports (periodic every 3 months)

### Revenue Calculation (projectCostsCalc.ts):
- Uses unit mix from marketOverview + prices from competitionPricing
- Scenario multiplier: optimistic 1.10, base 1.00, conservative 0.90
- Surplus absorption into 2BR unit type
- Total revenue = residential + retail + offices

### Cost Formulas:
- constructionCost = BUA × pricePerSqft
- designFee = constructionCost × designFeePct%
- supervisionFee = constructionCost × supervisionFeePct%
- separationFee = totalGFA × separationFeePerSqft
- contingencies = constructionCost × 2%
- developerFee = totalRevenue × developerFeePct%
- salesCommission = totalRevenue × salesCommissionPct%
- marketingCost = totalRevenue × marketingPct%
- landRegistration = landPrice × 4%
- agentCommissionLand = landPrice × agentCommissionLandPct%

## New Engine Plan (server/financialEngine.ts)

The new engine will be a SINGLE server-side file that:
1. Exports pure functions (no side effects, no DB calls)
2. Takes typed inputs (ProjectInputs) and returns typed outputs (FinancialResult)
3. Implements the same formulas as above but in a cleaner, testable structure
4. Supports all 3 scenarios (O1, O2, O3)
5. Every number is derived from inputs — change an input, output changes automatically
6. Override precedence: costsCashFlow > project card > defaults

The new engine does NOT replace existing files — it runs alongside them.
Reports will use the new engine for calculations, falling back to existing code if needed.
