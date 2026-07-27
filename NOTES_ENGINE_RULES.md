# Engine Rules & Requirements (Saved Context)

## Payment Plan × Sales Distribution Table (CRITICAL)

### What it does:
- Wael sets sales absorption per month (e.g., month 1: 10%, month 2: 7%, etc.)
- Each sale generates installments according to the Payment Plan:
  - ppDownPct (e.g., 10%) → paid in the month of sale
  - ppSecondPct (e.g., 10%) → paid ppSecondAfterMonths later (e.g., 1 month)
  - ppInstallmentPct (e.g., 10%) → paid every ppInstallmentEvery months during construction
  - ppHandoverPct (e.g., remaining) → paid at project completion
- The table shows: rows = months of sale, columns = months of the project
- Each cell = the installment amount received in that column-month from the row-month sale
- Bottom row = TOTAL monthly cash inflow (sum of all installments due that month from all sales)

### Example:
- Total off-plan revenue = 80% × 500M = 400M
- Month 1 sale: 10% of 400M = 40M
  - Down payment (10%): 4M in month 1
  - Second payment (10%): 4M in month 2
  - Installment (10% every 6 months): 4M in months 7, 13, 19...
  - Handover: remaining at project end
- Month 2 sale: 7% of 400M = 28M
  - Down payment (10%): 2.8M in month 2
  - Second payment (10%): 2.8M in month 3
  - etc.

### This table's output = Escrow account revenue (monthly inflow)

## Project Phases (from Settings)
- Designs: month 1, duration = sum of 7 design phases (weeks→months)
- Schematic Design completion = anchor point (after phases 1+2+3)
- Marketing Prep: starts at schematic completion, duration 2 months (editable)
- RERA + Sales Approvals: starts 1 month after schematic completion, duration 2 months (editable)
- Marketing Launch: starts after marketing prep completion, duration = Wael decides
- Sales Start: starts 1 month after RERA completion, duration = Wael decides
- Construction: from general inputs

## Marketing Distribution Table
- Rows = channels (digital, outdoor, events, broker, PR, content)
- Columns = months (from marketingActualStart to marketingActualEnd)
- Cells = amount per channel per month (Wael inputs)
- Total must equal marketing budget

## Investor Account Payment Rules (16 items)
## Escrow Account Payment Rules (9 items)

## Key State Variables in V2WaelSales:
- marketingActualStart, marketingActualEnd (Wael decides)
- marketingDistribution: Record<channelId, number[]> (amounts per month per channel)
- channelPcts: Record<channelId, number> (percentage per channel)
- ppDownPct, ppSecondPct, ppSecondAfterMonths, ppInstallmentPct, ppInstallmentEvery, ppHandoverPct
- salesDistribution: number[] (% of units sold each month)
- cashInflowData: computed from salesDistribution × payment plan

## Files:
- V2WaelSales.tsx: main sales page (current)
- WaelSalesPlan.tsx: old page with detailed engine (reference)
- SettingsRulesPage.tsx: project phases + rates + payment rules
