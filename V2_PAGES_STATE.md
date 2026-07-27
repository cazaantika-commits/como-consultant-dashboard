# V2 Pages Current State

## V2InvestorCashFlow.tsx (288 lines)
- Uses DUMMY random data (dummyRow function)
- Structure: PAID_ITEMS (3), DEBIT_ITEMS (18), CREDIT_ITEMS (3)
- Hardcoded: DESIGN_MONTHS=8, CONSTRUCTION_MONTHS=30, POST_MONTHS=13
- Shows: monthly table with sticky row names, phase-colored headers
- Sections: مدفوع سابقاً, المصروفات (by section), الإيرادات, صافي الشهر, التراكمي
- NEEDS: Replace dummy data with real computed values from project settings + engine

## V2EscrowCashFlow.tsx (255 lines)
- Uses DUMMY random data (dummyRow function)
- Structure: OUTFLOW_ITEMS (7), INFLOW_ITEMS (2), LIQUIDATION_ITEMS (3)
- Hardcoded: same month constants
- Shows: Outflows, Inflows, Net, Cumulative, Liquidation
- NEEDS: Replace with real data from cashInflowData (V2WaelSales engine) + escrow rules

## What needs to happen:
1. Both pages need to read from the same project context (selectedProjectId)
2. V2InvestorCashFlow needs to compute each item's monthly values based on:
   - Design fee: distributed per 7 design phases (% × total fee)
   - Supervision: monthly during construction
   - Community fee: lump sum at project registration month
   - RERA unit reg: during RERA phase
   - RERA auditor: quarterly during construction
   - RERA inspection: quarterly during construction
   - Marketing materials: evenly over prep duration (2 months)
   - Marketing: from Wael's distribution table (MarketingPage)
   - Developer fee (15%): TIMING NOT DEFINED
   - Sorting fee: TIMING NOT DEFINED
   - Sales commission (5%): TIMING NOT DEFINED
   - Surveyor As-Built: TIMING NOT DEFINED
3. V2EscrowCashFlow needs:
   - Inflows = cashInflowData from V2WaelSales (payment plan × sales absorption)
   - Outflows = contractor S-curve, supervision, RERA quarterly fees, sales commission
   - Liquidation = post-completion transfers

## Data Sources:
- Project general inputs: totalCost, constructionMonths, designMonths, etc.
- Settings: design phases (7 with % and weeks), rates, phase durations
- V2WaelSales: cashInflowData (monthly revenue from payment plan engine)
- MarketingPage: marketingDistribution (channel × month amounts)
- All stored in DB via waelSalesPlan.save mutation (JSON blob per project)
