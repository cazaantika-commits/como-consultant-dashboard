# FeasibilityStudyPage Redesign Notes

## User Requirements for ملخص الجدوى المالية (single project view):
1. TOP: الإيرادات (Revenue) - big prominent number
2. BELOW: Two side-by-side: التكلفة الكلية (grandTotal) | رأس المال المطلوب (investedCapital = paidTotal + investorTotal)
3. BELOW: الربح (profit = revenue - totalCosts) | نسبة الربح من التكلفة (profit/totalCosts%) | نسبة الربح من رأس المال (profit/investedCapital%)
4. Capital breakdown: مدفوع (paidTotal) | مطلوب سداده (investorTotal - already paid portion? or just investorTotal)
5. Project details section: مساحة الأرض, مساحة البناء (BUA), المساحة القابلة للبيع, وصف المشروع

## Data Sources (from selectedProject + cashFlowSettings):
- Revenue: `realCosts.totalRevenue` (from calculateProjectCosts using pricing page data)
- Total Costs: from cashFlowSettings → paidT + investorT + escrowT
- Invested Capital: paidT + investorT (what investor pays, not escrow)
- Paid: paidT (items in section "paid" - land etc)
- Unpaid (remaining investor): investorT (investor items not in paid section)
- Profit: revenue - totalCosts
- Profit/Cost ratio: profit / totalCosts * 100
- Profit/Capital ratio: profit / investedCapital * 100

## Area data from selectedProject:
- plotAreaSqft: p.plotAreaSqft
- plotAreaSqm: p.plotAreaSqm
- buaSqft: p.manualBuaSqft
- gfaTotalSqft: p.gfaSqft
- gfaResSqft: p.gfaResidentialSqft
- gfaRetSqft: p.gfaRetailSqft
- gfaOffSqft: p.gfaOfficesSqft
- sellableRes: gfaResSqft * (saleableResidentialPct/100)
- sellableRet: gfaRetSqft * (saleableRetailPct/100)
- sellableOff: gfaOffSqft * (saleableOfficesPct/100)
- totalSellable: sum of above

## Current code structure (lines 601-706):
- Lines 602-614: compute totalCostsVal, investedCapital from cashFlowSettings
- Line 616: totalRevenueVal from realCosts.totalRevenue
- Lines 617-621: profit, margin, roiOnCapital
- Lines 623-634: scenario calculations
- Lines 636-705: render (title bar, 6 KPI cards, scenario strip)

## What to replace: lines 636-705 (the render block inside the IIFE)
Keep the computation (602-634), replace the JSX render with new professional design.
