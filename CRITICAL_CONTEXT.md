# Critical Context for Engine Replacement

## USER'S REQUEST (CLEAR):
- Build a NEW system that gives SAME outputs as old system
- When user changes numbers/prices/areas → no problems, auto-propagates
- Apply corrections: RERA unit fees = units × 800, community fees = GFA × rate, inspection = 15000 × visits, developer fee O3=3% O1/O2=5%, contractor S-Curve
- DO NOT delete old code until verified
- DO NOT ask questions, just execute

## CURRENT STATE:
- Server is running fine on port 3000
- New engine built: `server/financialEngine.ts` (pure functions, 67 tests passing)
- Adapter built: `server/financialEngineAdapter.ts` (maps to existing API shape)
- Old engine still active in `server/routers/cashFlowSettings.ts`

## THE CORRECT APPROACH:
The old system has TWO layers:
1. **computeItemAmount / computeItemAmountByKey** — calculates DEFAULT amounts for each cost item
2. **project_cash_flow_settings DB table** — stores USER OVERRIDES (amountOverride, custom months, is_active)

The system ALREADY respects user overrides. The problem is only in layer 1 (default calculations).

### What to do:
Replace `computeItemAmount` / `computeItemAmountByKey` with the new engine's `calculateCosts()` function.
This way:
- Default amounts use the NEW correct formulas
- User overrides still work exactly as before
- All pages/reports continue working unchanged

### Specifically:
1. Find `computeItemAmountByKey` function (around line 300-400 in cashFlowSettings.ts)
2. Replace its logic with calls to the new engine's `calculateCosts()`
3. The rest of the system (distribution, overrides, reports) stays EXACTLY the same

## KEY FUNCTIONS TO FIND:
- `computeItemAmount(def, costs)` — takes a DefaultItemDef and costs object, returns amount
- `computeItemAmountByKey(itemKey, costs, scenario)` — same but by key string
- `calculateProjectCosts(project, mo, cp)` — the OLD cost calculation (in server/investorCashFlow.ts)

## WHAT calculateProjectCosts RETURNS (old):
```
{ totalCosts, totalRevenue, constructionCost, designFee, supervisionFee, 
  separationFee, contingencies, developerFee, salesCommission, marketingCost,
  communityFees, reraUnitRegFee, ... }
```

## WHAT calculateCosts RETURNS (new engine):
Same fields! The new engine's `calculateCosts()` returns a `CostBreakdown` with identical field names.

## PLAN:
1. In `getPortfolioAllScenarios` and `getProjectMonthlyReport`: replace `calculateProjectCosts(project, mo, cp)` with new engine's calculation
2. Make sure the returned object has same field names so `computeItemAmount` still works
3. That's it — everything else stays the same

## FILES:
- Old cost calc: `server/investorCashFlow.ts` → `calculateProjectCosts()`
- New cost calc: `server/financialEngine.ts` → `calculateCosts()` + `projectToInputs()`
- Router using it: `server/routers/cashFlowSettings.ts` lines 1868, 2074
