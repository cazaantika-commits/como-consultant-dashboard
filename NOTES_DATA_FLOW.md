# Data Flow Notes (for implementation reference)

## How Settings Are Stored
- All settings live in `projects.constructionScheduleJson` as a JSON blob
- Structure: `{ settings: { projectPhases: {...}, designPayments: {...}, configurableRates: {...} } }`
- SettingsRulesPage reads/writes this JSON blob via `trpc.projects.update`
- No schema change needed — just add new keys inside `settings`

## New Payment Timing Rules (4 items to add as editable)
1. **أتعاب المطور (developerFeePct)**: 15% of revenue, paid 1 month after investor receives escrow liquidation. 15% of the amount is retained until month 13 post-completion.
2. **رسوم الفرز (sortingFees)**: Paid in month 1 of RERA + sales approvals phase
3. **عمولة المبيعات (salesCommission)**: 5% paid when 20% of unit value is collected from buyer
4. **رسوم المساح As-Built (surveyorAsbuilt)**: Paid in penultimate month of construction

## Editable Parameters for Each Rule
- developerFeePct: percentage (default 15%)
- developerFeeRetentionPct: retention percentage (default 15%)
- developerFeeDelayMonths: months after escrow liquidation (default 1)
- developerFeeRetentionMonth: month post-completion for retention release (default 13)
- sortingFeeMonth: which month of RERA phase (default 1)
- salesCommissionTriggerPct: buyer payment threshold to trigger commission (default 20%)
- surveyorAsbuiltMonth: month relative to construction end (default -1 = penultimate)

## Where to Add in SettingsRulesPage
- Add a new section (Section 3.5 or extend Section 3) with these 4 rules as editable inputs
- Store in `constructionScheduleJson.settings.paymentTimingRules`
- Save format: `{ developerFeePct: 15, developerFeeRetentionPct: 15, developerFeeDelayMonths: 1, ... }`

## V2InvestorCashFlow Current State
- PURE PLACEHOLDER with dummy random data
- Needs to be rewritten to call `computeInvestorCashFlow()` from `investorCashFlowEngine.ts`
- OR rewritten to read project data + settings and compute inline (like V2WaelSales does)
- The existing `investorCashFlowEngine.ts` already has the full engine but uses old hardcoded timings
- Best approach: update investorCashFlowEngine to read the new timing rules from project settings

## Key Architecture
- `trpc.projects.getById` returns project with `constructionScheduleJson`
- `trpc.waelSalesPlan.getByProject` returns sales plan with `resultsJson` (contains cashInflowData, escrowData, salesDistribution)
- V2InvestorCashFlow should read BOTH to compute real numbers
