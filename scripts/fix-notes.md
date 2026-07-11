# Fix Notes

## Issue 1: Large Surplus (24% in residential)

**Root Cause**: In CostsCashFlowTab, the surplus is absorbed into 2BR (line 241):
- `if (r.is2br && surplus > 0 && r.count > 0) { effectiveAvg = r.avg + (surplus / r.count); }`
- This means the 2BR units get a bigger effective area, but the RAW surplus bar still shows the original surplus.
- The "surplus" shown is `sellable - rawTotalArea` (line 275) which is the difference BEFORE absorption.
- The absorption only affects revenue calculation (effectiveAvg * price * count) but the visual bar still shows the raw surplus.

**Fix**: Change the surplus calculation to show EFFECTIVE surplus (after absorption) = 0 or near-zero.
Actually the issue is that `rawTotalArea = count * avg` but the effective total = count * effectiveAvg.
The surplus bar shows rawTotalArea vs sellable. After absorption, effectiveTotalArea should equal sellable.
So the fix is to show effectiveTotalArea surplus instead of rawTotalArea surplus.

Wait - looking more carefully: the surplus IS being absorbed into 2BR already. The bar shows the RAW surplus before absorption. The user sees "فائض: 21,329 (24.0%)" which is the raw surplus.
The actual revenue uses effectiveAvg which absorbs it. So the DISPLAY is misleading.

Better fix: Show the effective surplus (which should be ~0 after absorption) instead of raw surplus.
OR: Don't show the surplus bar at all since it's absorbed.
OR: Change the label to show "يُمتص في غرفتين وصالة" more prominently.

Actually re-reading the user's complaint: "لا اريد ان يظهر فائض كبير تصرف" = "I don't want a large surplus to appear, handle it"
So the fix is to either:
1. Not show the surplus (since it's already absorbed in revenue)
2. Show effective surplus (near zero)
3. Better: distribute units more intelligently so raw surplus is minimal

The REAL fix: Instead of computing units as `Math.floor(allocated / avgArea)`, use a smarter distribution that minimizes surplus. After floor-dividing all types, give remaining area to the largest type (add extra units).

## Issue 2: Revenue Mismatch (730M in cards vs 788M in table)

**Root Cause**: Two different calculation methods:
- Cards (projectCostsCalc.ts): Uses `pct` from marketOverview to compute units = `Math.floor(saleable * pct/100 / avgArea)`, then revenue = `avgArea * price * units`
- Table (CostsCashFlowTab): Uses SAVED `count` from marketOverview (residentialStudioCount, etc.), then revenue = `count * effectiveAvg * price`

The saved counts may differ from the pct-computed counts because:
1. User manually edited counts in the table
2. The table absorbs surplus into 2BR effectiveAvg

**Fix**: Make the cards use the SAME data source as the table. The table uses `grandTotalRevenue` from CostsCashFlowTab. The cards should query the same data and use the same logic.

Best approach: Make projectCostsCalc.ts also use saved counts (countKey) when available, same as CostsCashFlowTab does.
