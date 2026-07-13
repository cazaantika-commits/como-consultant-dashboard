# Comparison Fix Notes

## Problem
The comparison page shows huge differences (48-75%) because it's comparing different things:

### Old Engine (what it shows as grandTotal):
- Sum of ALL items from getDefaultItemDefs (investor + escrow funded)
- This includes: land, design fee, supervision, construction, developer fee, sales commission, marketing, regulatory fees, community fees, escrow deposit, contractor advance, etc.
- It's essentially `totalCosts` from calculateProjectCosts PLUS some double-counting (escrow deposit = 20% of construction, contractor advance = 10% of construction are ALSO counted)

### New Engine (what it shows as grandTotal):
- `capitalRequired` (investor total) + escrow items total
- `capitalRequired` = result from the new engine which is the net investor cash needed
- escrowTotal = sum of escrow cash flow items

## Root Cause
The old engine's grandTotal = sum of ALL default item amounts (which includes items that overlap/double-count like escrow deposit being part of construction cost)
The new engine's grandTotal = capitalRequired + escrowTotal (which is the actual cash flow needed)

## Fix Approach
Instead of comparing grandTotal (which means different things), compare:
1. **totalCosts** — the total project cost (apples-to-apples)
   - Old: `oldCosts.totalCosts` from calculateProjectCosts
   - New: `newResult.costs.totalCosts` from computeFullFinancials
2. **Individual cost items** — compare each cost component
   - designFee, supervisionFee, constructionCost, developerFee, salesCommission, etc.
3. **Revenue** — compare total revenue
   - Old: `oldCosts.totalRevenue`
   - New: `newResult.costs.totalRevenue`

This is the fair comparison that will show if the new engine calculates the same base costs.
