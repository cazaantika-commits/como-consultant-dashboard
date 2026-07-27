# Engine Changes - Complete Reference

## Current state of investorCashFlowEngine.ts (1086 lines):
- Lines 1-60: Types (CostRow, CashFlowResult, Scenario, Funder)
- Lines 62-155: Helpers (generateSCurve, distributeDesignFee, distributeEqual, distributeCommunityFee)
- Lines 157-194: buildPricingUnits
- Lines 209-245: computeInvestorCashFlow function start, variable setup
- Lines 247-300: Land rows (always investor)
- Lines 302-331: Supervision fee (S3/S4=investor with timing, S1/S2=escrow NO timing)
- Lines 333-395: Soil, Topography, Surveyor DWG (S1/S2=escrow WITH timing at month 0)
- Lines 398-430: Surveyor As-Built (S1/S2=escrow WITH timing at penultimateConstruction)
- Lines 432-505: Community fee, Gov fees, Sorting fee
- Lines 507-651: RERA items (NOC, project reg, unit reg, escrow account fee, bank fees, auditor=escrow NO timing, inspection=escrow NO timing)
- Lines 653-686: Sales commission (S1/S2=escrow NO timing, S3=investor post months)
- Lines 688-807: Marketing, Developer fee 5% (2% design + 3% construction, all investor)
- Lines 809-882: Construction (S3/S4=100% investor S-Curve, S1=20%deposit+10%advance investor, S2=30% investor)
- Lines 884-903: Contingency (investor, distributed over construction)
- Lines 905-992: Revenue section (S3=post months 2-3, S1/S2=20% direct + escrow liquidation 1 + escrow liquidation 2)
- Lines 994-1086: Totals and return

## Changes needed:

### 1. Add TimingRules interface + DEFAULT (after line 60):
```ts
export interface TimingRules {
  developerFeePct: number;        // 15
  developerFeeRetentionPct: number; // 15
  developerFeeDelayMonths: number;  // 1
  developerFeeRetentionMonth: number; // 13
  sortingFeeMonth: number;          // 1
  sortingFeePerSqft: number;        // 40
  salesCommissionPct: number;       // 5
  salesCommissionTriggerPct: number; // 20
  surveyorAsbuiltMonthFromEnd: number; // 1
}
export const DEFAULT_TIMING_RULES: TimingRules = {
  developerFeePct: 15, developerFeeRetentionPct: 15, developerFeeDelayMonths: 1,
  developerFeeRetentionMonth: 13, sortingFeeMonth: 1, sortingFeePerSqft: 40,
  salesCommissionPct: 5, salesCommissionTriggerPct: 20, surveyorAsbuiltMonthFromEnd: 1,
};
```

### 2. Add monthDates + startDate to CashFlowResult interface (line 42-60):
```ts
monthDates: string[];
startDate: string;
```

### 3. Change function signature (line 209):
```ts
export function computeInvestorCashFlow(projectData: any, scenario: Scenario, timingRules?: TimingRules): CashFlowResult {
```
Add: `const tr = timingRules || DEFAULT_TIMING_RULES;`

### 4. Fix escrow supervision (lines 318-330) - ADD timing:
```ts
} else {
  const supervisionConst = emptyConstruction();
  distributeEqual(costs.supervisionFee, constructionDuration, supervisionConst, 0);
  rows.push({ ...same but with constructionMonths: supervisionConst });
}
```

### 5. Fix escrow auditor (lines 622-634) - ADD timing:
```ts
const auditorConst = emptyConstruction();
auditorConst[Math.floor(constructionDuration / 2)] = i.reraAuditorReport;
rows.push({ ...same but with constructionMonths: auditorConst });
```

### 6. Fix escrow inspection (lines 638-650) - ADD timing:
```ts
const inspConst = emptyConstruction();
inspConst[penultimateConstruction] = i.reraInspection;
rows.push({ ...same but with constructionMonths: inspConst });
```

### 7. Fix escrow sales commission (lines 673-685) - ADD timing:
Sales commission paid when 20% collected. In S1, sales start at RERA phase (penultimateDesign).
20% trigger = first 2-3 installments. Put at constructionMonths[2] (month 3 of construction).
```ts
const commConst = emptyConstruction();
commConst[2] = costs.salesCommission; // when 20% collected from buyers
rows.push({ ...same but with constructionMonths: commConst });
```

### 8. Add escrow construction row (after line 881, for S1/S2):
```ts
// Escrow construction portion (70% S-Curve for S1, 70% for S2)
if (!isScenario3 && !isScenario4) {
  const escrowShare = r.constructionEscrowShare; // 0.70
  const escrowConstructionAmount = constructionCost * escrowShare;
  const escrowConst = emptyConstruction();
  const sCurve = generateSCurve(constructionDuration);
  for (let idx = 0; idx < constructionDuration; idx++) {
    escrowConst[idx] = escrowConstructionAmount * sCurve[idx];
  }
  const escrowPost = emptyPost();
  escrowPost[1] = constructionCost * 0.05; // completion
  escrowPost[12] = constructionCost * 0.05; // retention
  rows.push({
    label: "تكلفة الإنشاء (حصة الضمان)",
    totalCost: escrowConstructionAmount + constructionCost * 0.10,
    investorAmount: 0, paid: 0, unpaid: 0,
    funder: "escrow", section: "الإنشاء",
    designMonths: emptyDesign(),
    constructionMonths: escrowConst,
    postConstructionMonths: escrowPost,
  });
}
```

### 9. Add developer profit share 15% (after revenue section, before TOTALS):
Only for S1/S2:
```ts
if (!isScenario3 && !isScenario4) {
  const investorCapital = costs.totalInvestor; // includes 20% deposit + 10% advance
  // Add back the escrow deposit since investor paid it from pocket
  const totalCapital = investorCapital; // already includes constructionInvestor (30%)
  
  // Month 3 post: escrowLiquidation already computed above
  // Also consider direct revenue received by month 3
  const directRevenueByMonth3 = (totalRevenue * 0.20 / 12) * 3;
  const totalReceivedByMonth3 = escrowLiquidation + directRevenueByMonth3;
  const surplus1 = Math.max(0, totalReceivedByMonth3 - totalCapital);
  const devProfitShare1 = surplus1 * (tr.developerFeePct / 100);
  const devProfitRetention1 = devProfitShare1 * (tr.developerFeeRetentionPct / 100);
  const devProfitPaid1 = devProfitShare1 - devProfitRetention1;
  
  // Month 13: month13ToInvestor already computed
  const surplus2 = month13ToInvestor; // all of this is profit since capital already recovered
  const devProfitShare2 = surplus2 * (tr.developerFeePct / 100);
  // Plus the retained amount from first payment
  const devProfitMonth13 = devProfitShare2 + devProfitRetention1;
  
  const devProfitPost = emptyPost();
  const delayMonth3 = 2 + tr.developerFeeDelayMonths; // month 3 + delay
  if (delayMonth3 < postDuration) devProfitPost[delayMonth3] = devProfitPaid1;
  const delayMonth13 = 12 + tr.developerFeeDelayMonths; // month 13 + delay
  if (delayMonth13 < postDuration) devProfitPost[Math.min(delayMonth13, postDuration - 1)] = devProfitMonth13;
  
  const totalDevProfit = devProfitPaid1 + devProfitMonth13;
  rows.push({
    label: "حصة المطور من الأرباح (15%)",
    totalCost: totalDevProfit,
    investorAmount: totalDevProfit,
    paid: 0, unpaid: totalDevProfit,
    funder: "investor", section: "المبيعات والتسويق",
    designMonths: emptyDesign(),
    constructionMonths: emptyConstruction(),
    postConstructionMonths: devProfitPost,
  });
}
```
NOTE: escrowLiquidation and month13ToInvestor are computed in the revenue section (lines 955, 976).
They need to be accessible. Currently they're inside the `else if (!isScenario4)` block.
Move them to outer scope or compute before the profit share row.

### 10. Add monthDates computation (before return):
```ts
const startDateStr = i.startDate || "2026-08";
const [startY, startM] = startDateStr.split("-").map(Number);
const monthDates: string[] = [];
const totalMonthCount = designDuration + constructionDuration + postDuration;
for (let idx = 0; idx < totalMonthCount; idx++) {
  const absMonth = (startY * 12 + startM - 1) + idx;
  const y = Math.floor(absMonth / 12);
  const m = (absMonth % 12) + 1;
  monthDates.push(`${y}-${String(m).padStart(2, "0")}`);
}
```
Add to return: `monthDates, startDate: startDateStr`

## V2InvestorCashFlow.tsx changes:
- Line 53-57: Pass timingRules from project.constructionScheduleJson
- Lines 93-97: Use result.monthDates for column headers
- Parse: `const schedJson = projectQuery.data?.constructionScheduleJson; const tr = schedJson?.settings?.paymentTimingRules ? parseTimingRules(schedJson.settings.paymentTimingRules) : undefined;`

## V2EscrowCashFlow.tsx changes:
- Same as above for timingRules and monthDates
- Opening balance logic at lines 86-89 stays the same (20% of construction cost)
