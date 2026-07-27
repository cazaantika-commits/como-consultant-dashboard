# Escrow Page Fix Notes

## Bug 1: Supervision Fees - FIXED
- Was: distributeEqual (270K/month)
- Now: follows S-Curve / manual progress (same as contractor)
- Code already updated in investorCashFlowEngine.ts

## Bug 2: Sales Commission - FIXED
- Was: entry.income * commPct (income includes cumulative installments = too large)
- Now: entry.units * avgUnitPrice * commPct (correct: units sold × avg price × rate)
- avgUnitPrice = totalRevenue / totalUnits (both available in engine)
- Code already updated in investorCashFlowEngine.ts

## Bug 3: Revenue Inflows showing zeros - NEEDS FIX
- V2EscrowCashFlow.tsx line 133-145: salesIncomeRow
- Problem: entry.month is 0-indexed in escrowData (from V2WaelSales line 287: `month: i + timeline.salesStart`)
- But the code does `const idx = entry.month - 1` (treating it as 1-indexed)
- timeline.salesStart is already 0-indexed absolute month
- FIX: Change `const idx = entry.month - 1` to `const idx = entry.month`
- Also verify: entry.income = downPaymentIncome + installmentIncome (correct for escrow inflow)

## Bug 4: Direct Revenue in Escrow - NEEDS FIX
- The engine creates an "إيرادات مباشرة (20%)" row with isRevenue=true
- V2EscrowCashFlow line 164: `const liquidationRows = rows.filter((r) => r.isRevenue)`
- This shows ALL revenue rows in liquidation section, including direct revenue
- Direct revenue (20% that goes directly to investor) should NOT appear in escrow page
- FIX: Filter out the direct revenue row from liquidationRows
- The direct revenue row label is "إيرادات مباشرة (20%)" - filter it out
- OR: only show escrow liquidation rows (those that come FROM escrow to investor)

## Key Code Locations:
- Engine: client/src/lib/investorCashFlowEngine.ts
- Escrow page: client/src/pages/V2EscrowCashFlow.tsx
- Sales page: client/src/pages/V2WaelSales.tsx (line 287: escrowData construction)
- V2InvestorCashFlow: client/src/pages/V2InvestorCashFlow.tsx

## escrowData structure (from V2WaelSales line 287):
- month: i + timeline.salesStart (0-indexed absolute project month)
- units: units sold that month
- income: downPaymentIncome + installmentIncome (total cash flowing into escrow)
- downPayment: units × avgUnitPrice × downPaymentPct/100
- installments: cumulativeSold × monthlyInstallmentPerUnit
- withdrawal: monthlySiphon (construction cost / salesMonths)
- balance: running balance
- cumulativeSold: total units sold up to this month
