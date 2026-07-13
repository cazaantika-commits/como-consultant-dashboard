# Wiring Plan — New Financial Engine into Reports

## Status
- ✅ `server/financialEngine.ts` — complete, 46 tests passing
- ✅ `server/financialEngine.test.ts` — comprehensive tests with real Nad Al Sheba data
- ⬜ Wire into reports (this step)

## Key Findings

### Existing API Contract (from portfolioAllScenarios.test.ts)
The `cashFlowSettings.getPortfolioAllScenarios` endpoint returns:
```
Per project:
  projectId, name, startDate, totalMonths, totalRevenue, phaseInfo, durations, scenarios

Per scenario (offplan_escrow, offplan_construction, no_offplan):
  investorTotal, escrowTotal, grandTotal
  monthlyInvestor: number[] (length = totalMonths)
  monthlyEscrow: number[] (length = totalMonths)
  monthlyTotal: number[] (length = totalMonths)
  sectionTotals: Record<string, number>
  monthlyBySection: Record<string, number[]>
  monthlyInvestorBySection?: Record<string, number[]>
```

### Approach: Adapter Function (NOT replacing existing code)
Create an adapter that:
1. Takes `computeFullFinancials()` output
2. Maps it to the existing API shape above
3. Can be used as an ALTERNATIVE data source alongside existing code
4. No existing code is deleted or modified

### Where to Wire
1. Add a new tRPC procedure: `cashFlowSettings.getPortfolioV2` that uses the new engine
2. Add a toggle in PortfolioSummaryReport to switch between old/new engine
3. CapitalPortfolioPage continues using old engine until verified

### Key Mappings
- `investorCashFlow` items → `monthlyInvestor` array (aggregate by month index)
- `escrowCashFlow` items → `monthlyEscrow` array (aggregate by month index)
- Each item has a `table` field ("investor" | "escrow") for routing
- Section mapping: item.id → section (land/design/offplan/construction/escrow)

### Files NOT to Touch
- `server/routers/cashFlowSettings.ts` — existing getPortfolioAllScenarios stays as-is
- `server/investorCashFlow.ts` — existing calculations stay as-is
- `client/src/pages/CapitalPortfolioPage.tsx` — stays as-is
- `server/routers/cashFlowProgram.ts` — stays as-is
