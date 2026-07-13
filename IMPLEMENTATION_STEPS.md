# Implementation Steps: Replace calculateProjectCosts with New Engine

## GOAL:
Replace `calculateProjectCosts()` (from server/investorCashFlow.ts) with the new engine's `calculateCosts()` 
(from server/financialEngine.ts) everywhere it's called in cashFlowSettings.ts.

## WHY THIS WORKS:
- Both return the SAME field names (landPrice, designFee, constructionCost, etc.)
- The new engine adds: grossProfit, grossProfitMargin (extra fields, won't break anything)
- The new engine applies CORRECTIONS: RERA units = totalUnits × 800, communityFees = GFA × rate, inspection = visits × 15000, O3 developer fee = 3%
- The rest of the system (overrides, distribution, reports) stays EXACTLY the same

## WHAT TO DO:

### Step 1: Create a wrapper function in cashFlowSettings.ts that:
- Takes same args as old calculateProjectCosts(project, mo, cp)
- Computes totalUnits from market overview count fields
- Computes calculatedRevenue using old revenue logic (or passes approvedRevenue)
- Calls projectToInputs() + calculateCosts() from new engine
- Returns object matching ProjectCosts interface (adds revenueSource, activeScenario, scenarioLabel, calculatedRevenue, approvedRevenue)

### Step 2: Replace all calls to calculateProjectCosts with the new wrapper

### Lines to replace (in server/routers/cashFlowSettings.ts):
- Line 451: `const costs = calculateProjectCosts(project, mo, cp);`
- Line 733: `const costs = calculateProjectCosts(project, mo, cp);`
- Line 1074: `const costs = calculateProjectCosts(project, mo, cp);`
- Line 1261: `const costs = calculateProjectCosts(project, mo, cp);`
- Line 1507: `const costs = calculateProjectCosts(project, mo, cp);`
- Line 1868: `const costs = calculateProjectCosts(project, mo, cp);`
- Line 2074: `const costs = calculateProjectCosts(project, mo, cp);`

### totalUnits computation (from line 2442-2449):
```ts
let totalUnits = 0;
if (moData) {
  const countFields = [
    "residentialStudioCount", "residential1brCount", "residential2brCount", "residential3brCount",
    "retailSmallCount", "retailMediumCount", "retailLargeCount",
    "officeSmallCount", "officeMediumCount", "officeLargeCount",
  ];
  for (const f of countFields) totalUnits += Number(moData[f]) || 0;
}
```

### ProjectCosts interface (old, from server/investorCashFlow.ts line 43-74):
```ts
interface ProjectCosts {
  landPrice, agentCommissionLand, landRegistration, soilTestFee, topographicSurveyFee,
  officialBodiesFees, designFee, supervisionFee, separationFee, constructionCost,
  communityFees, contingencies, developerFee, salesCommission, marketingCost,
  reraUnitRegFee, reraProjectRegFee, developerNocFee, escrowAccountFee, bankFees,
  surveyorFees, reraAuditReportFee, reraInspectionReportFee, totalRevenue, totalCosts,
  revenueSource: "approved" | "calculated",
  activeScenario: string,
  scenarioLabel: string,
  calculatedRevenue: number,
  approvedRevenue: number,
}
```

### New engine CostBreakdown has same numeric fields PLUS grossProfit, grossProfitMargin
### Missing from CostBreakdown: revenueSource, activeScenario, scenarioLabel, calculatedRevenue, approvedRevenue
### → Wrapper adds these from the competition_pricing data

## IMPORTS NEEDED:
```ts
import { projectToInputs, calculateCosts } from "../financialEngine";
```

## THE WRAPPER FUNCTION:
```ts
function calculateProjectCostsV2(project: any, mo: any, cp: any): ProjectCosts | null {
  if (!project) return null;
  const activeScenario = (cp?.activeScenario || "base") as "optimistic" | "base" | "conservative";
  
  // Compute totalUnits from market overview
  let totalUnits = 0;
  if (mo) {
    const countFields = [
      "residentialStudioCount", "residential1brCount", "residential2brCount", "residential3brCount",
      "retailSmallCount", "retailMediumCount", "retailLargeCount",
      "officeSmallCount", "officeMediumCount", "officeLargeCount",
    ];
    for (const f of countFields) totalUnits += Number((mo as any)[f]) || 0;
  }
  
  // Compute revenue using old logic (to pass as calculatedRevenue)
  // ... (copy revenue calc from old calculateProjectCosts or use the old function just for revenue)
  // Actually: the new engine handles revenue via approvedRevenue or calculatedRevenue input
  // We need to compute calculatedRevenue externally (unit prices × counts × areas)
  // SIMPLEST: call old calculateProjectCosts JUST for revenue, then use new engine for costs
  
  // Better approach: compute revenue same way as old code, pass to new engine
  const oldResult = calculateProjectCosts(project, mo, cp);
  if (!oldResult) return null;
  
  // Now use new engine for COSTS (with corrections)
  const inputs = projectToInputs(
    project,
    { approvedRevenue: cp?.approvedRevenue ? String(cp.approvedRevenue) : undefined },
    totalUnits,
    oldResult.calculatedRevenue // pass old revenue calc as fallback
  );
  const newCosts = calculateCosts(inputs);
  
  // Return merged: new costs + old metadata
  return {
    ...newCosts,
    revenueSource: oldResult.revenueSource,
    activeScenario: oldResult.activeScenario,
    scenarioLabel: oldResult.scenarioLabel,
    calculatedRevenue: oldResult.calculatedRevenue,
    approvedRevenue: oldResult.approvedRevenue,
  };
}
```

## PROBLEM WITH ABOVE:
- Still calls old calculateProjectCosts for revenue — defeats the purpose
- Revenue calculation is complex (unit prices × scenario multiplier × counts × areas with surplus absorption)
- The revenue logic is the SAME in both old and new — no correction needed there
- So actually: keep old revenue calc, replace COST calc only

## BETTER APPROACH:
Just replace the OLD calculateProjectCosts function itself in server/investorCashFlow.ts!
- Keep the revenue calculation logic (lines 121-196) 
- Replace the cost calculation (lines 198-210) with new engine's calculateCosts()
- This way ALL callers automatically get the new formulas

## SIMPLEST APPROACH (chosen):
1. Edit server/investorCashFlow.ts → calculateProjectCosts function
2. Keep revenue logic as-is (lines 76-196)
3. After computing totalRevenue, call new engine's calculateCosts with proper inputs
4. Return the result merged with revenue metadata

This is ONE file edit, affects ALL callers, preserves all overrides/distribution logic.
