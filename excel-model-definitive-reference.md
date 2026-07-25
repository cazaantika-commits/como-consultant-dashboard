# Como Multi-Project Development Model — Definitive Reference

## Overview
- 17 sheets, supports up to 11 projects simultaneously
- 120-month calculation horizon per project
- Calc Engine: ~200 rows per project block × 120 monthly columns

---

## SHEET MAP

| Sheet | Purpose | Web Equivalent |
|-------|---------|---------------|
| Inputs | All parameters (T, S, M, B, W, R, X codes) + curves + cost nodes + payment milestones + unit mix | **Input Pages** |
| Calc Engine | Monthly calculations (2818 rows = ~200 rows × 11 projects + headers) | **Backend Engine (hidden)** |
| Sales Plan | Unit pricing summary + monthly off-plan/post-completion sales | **Wael's page + Sales Report** |
| Buyer Collections | Payment plan milestones + monthly cohort collections | **Wael's page (Payment Plan)** |
| Construction Schedule | Monthly construction progress curve | **Timeline page** |
| Project Costs | Cost node registry + monthly cost schedule | **Feasibility Study** |
| Escrow Cash Flow | Escrow account monthly flows | **Escrow CF Report** |
| Investor Cash Flow | Investor contributions + distributions monthly | **Investor CF Report** |
| Returns & Waterfall | Capital return + profit split + MOIC/XIRR | **Feasibility Study + Returns** |
| Consolidated Cash Flow | Project-level sources & uses after eliminating internal transfers | **General CF Report** |
| Project Dashboard | Key metrics + timeline summary per project | **Project Overview** |
| Project Timeline | Phase markers (design/construction/sales/handover/escrow release) | **Timeline Bubbles page** |
| Portfolio Dashboard | Multi-project comparison table + aggregate metrics | **Portfolio page** |
| Model Checks | 12 validation checks (MC01-MC12) | **Backend alerts** |
| Lists & Mapping | Validation lists + field dictionary | **System config** |
| Instructions | User guide | N/A |
| Changelog | Version history | N/A |

---

## INPUT PARAMETERS (All are per-project variables)

### Project Identity (P01-P12)
- P01: Project Name (text)
- P02: Project ID (text)
- P03: Location/Area (text)
- P04: Project Type (Residential/Commercial/Mixed-Use/Hospitality/Other)
- P05: Currency (AED)
- P06: Project Start Date (date)
- P07: Land Purchase Date (date)
- P08: Investor Opening Cash Balance (AED)
- P09: Escrow Opening Cash Balance (AED)
- P10: Post-Completion Display Period (months)
- P11: Model Valuation Date (date)
- P12: Include in Portfolio (Yes/No)

### Timeline (T01-T12)
- T01: Design Duration (months)
- T02: Construction Duration (months)
- T03: Approvals Start Offset after Schematic Design completion (months after T12)
- T04: Approvals Duration (months)
- T05: Sales Start Offset after Schematic Design (months after T12)
- T06: Marketing Campaign Start Offset after Schematic Design (months after T12)
- T07: Marketing Campaign Duration (months)
- T08: Handover Delay after Construction (months)
- T09: First Escrow Release after Handover (months)
- T10: Final Escrow Release after First Release (months)
- T11: Post-Completion Sales Window (months)
- T12: Schematic Design Completion (months from start) — KEY ANCHOR

### Land (L01-L05)
- L01: Land Area (sqft)
- L02: Land Pricing Method (Fixed Amount / Price per Land sqft / Price per GFA sqft)
- L03: Land Price or Rate
- L04: Registration Fee (% of land cost, default 4%)
- L05: Land Broker Commission (%, default 1%)

### Building (B01-B05)
- B01: GFA (sqft)
- B02: BUA (sqft)
- B03: Construction Cost Basis (BUA x Rate / Fixed Contract)
- B04: Construction Rate (AED/sqft) or Fixed Amount
- B05: Total Units (count)

### Sales (S01-S14)
- S01: Off-Plan Sales % of total (default 80%)
- S02: Post-Completion Sales % (default 20%)
- S03: Off-Plan Sales Curve (monthly % distribution, sums to 100%)
- S04: Post-Completion Sales Curve (monthly % distribution)
- S05-S14: Various sales parameters

### Marketing (M01-M09)
- M01: Marketing Budget (% of Total Sales, default 2%)
- M02: Off-Plan Commission (% of off-plan sales, default 5%)
- M03: Post-Completion Commission (% of post-completion sales, default 5%)
- M04: Marketing Curve (monthly % distribution)
- M09: Marketing Materials Budget (fixed AED amount, separate from M01)

### Escrow (E01-E10)
- E01: Escrow Deposit (% of construction cost, default 20%)
- E02: Regulatory Retention (% of off-plan sales, default 5%)
- E03: Minimum Escrow Balance (AED)
- E04-E10: Various escrow parameters

### Waterfall (W01-W06)
- W01: Distributable Cash Definition = "Investor expenses + refundable escrow deposit"
- W02: Capital Return Priority = 100% of distributable cash
- W03: Investor Profit Share = 85% of remaining profit
- W04: COMO Profit Share = 15% of remaining profit
- W05: Developer Fee During Project (% of total sales)
- W06: Loss Treatment Policy = "No Developer Profit"

### Financing (R01-R11)
- R01: Cash Deficit Funding Method = "Automatic Investor Contributions"
- R02: Minimum Investor Cash Balance (AED)
- R03: Minimum Escrow Cash Balance (AED)
- R04: Annual Discount Rate (default 10%)
- R05: Target IRR (default 15%)
- R06: Bank Financing Active (Yes/No, default No)
- R07-R11: Loan parameters (limit, rate, fees, draw/repay priority)

### Construction (C01-C13)
- C01: Construction Rate (AED/sqft, default 400)
- C02: Fixed Contract Amount (AED, alternative to C01)
- C03: Contractor Advance (% of construction cost, default 10%)
- C04: Advance Timing (Construction Month 1)
- C05: Progress Payments (% of construction cost, default 80%)
- C06: Progress Payment Lag (months, default 1)
- C07: First Retention (% of construction cost, default 5%)
- C08: First Retention Release (months after completion, default 2)
- C09: Final Retention (% of construction cost, default 5%)
- C10: Final Retention Release (months after completion, default 13)
- C11: Variation Allowance (%)
- C12: Preliminaries (% of construction cost)
- C13: Contingency (% of construction cost)

### Design & Consultants (D01-D10)
- D01: Design Consultant Fee (% of construction cost, default 1.8%)
- D02: Design Fee Method (Percentage/Fixed)
- D03: Design Fee Curve (link to curve)
- D04: PMC Fee (% of construction cost, default 2%)
- D05: PMC Fee Method (Percentage/Fixed)
- D06: Quantity Surveyor (AED, default 45,000)
- D07: QS Cost Node Link
- D08: Soil Investigation (AED, default 12,000)
- D09: Soil Investigation Cost Node Link
- D10: Bank Fees (AED, default 35,000)

### Sales (S01-S14)
- S01: Off-Plan Sales % (default 80%)
- S02: Post-Completion Sales % (default 20%)
- S03: Sales Start Offset (months after T12) — calculated from T05
- S04: Sales Distribution Method (Monthly Curve)
- S05: Off-Plan Sales Curve (link)
- S06: Post-Completion Sales Curve (link)
- S07: Premium/Discount % (default 0)
- S08: Additional Sales Adjustment % (default 0)
- S09: Revenue Calculation Method (Total Value)
- S10: Unit Mix Link
- S11: Unit Type Sales Curves (optional)
- S12: Monthly Sales Price Growth Rate (default 0%)
- S13: Post-Completion Collection Method (Full Cash at Sale / Separate Plan)
- S14: Post-Completion Collection Destination (Investor / Escrow)

### Buyer Payment Plan (B01-B05)
- B01: Late Installment Treatment (Accelerate to Pre-Handover)
- B02: Number of Payment Plans (default 1, max 3)
- B03: Plan Assignment per Unit Type (link)
- B04: Cancellation/Default Rate (%, default 0)
- B05: Recovery Rate on Cancellation (%, default 0)

### Marketing (M01-M09)
- M01: Marketing Budget (% of Total Sales, default 2%)
- M02: Campaign Start Offset (months after T12) — calculated from T06
- M03: Marketing Distribution Curve (link)
- M04: Off-Plan Sales Commission (% of sales, default 5%)
- M05: Commission Collection Threshold (% of unit price, default 20%)
- M06: Off-Plan Commission Lag (months, default 1)
- M07: Post-Completion Commission (% of sales, default 5%)
- M08: Post-Completion Commission Lag (months, default 0)
- M09: Marketing Materials Budget (AED, separate fixed budget)

### Developer Fees (F01-F03)
- F01: Developer Fee During Design (% of Total Sales, default 2%)
- F02: Developer Fee During Supervision (% of Total Sales, default 3%)
- F03: Total Developer Fee (calculated = F01 + F02 = 5%)

### Escrow (E01-E09)
- E01: Escrow Deposit Rate (% of construction cost, default 20%)
- E02: Escrow Deposit Timing (Sales Approval Month)
- E03: Off-Plan Collections to Escrow (% of collections, default 100%)
- E04: Minimum Escrow Balance (AED, default 0)
- E05: Regulatory Retention Rate (% of expected off-plan sales, default 5%)
- E06: Retention Basis (Expected Off-Plan Sales)
- E07: First Escrow Release (months after completion, default 3)
- E08: Final Escrow Release (months after completion, default 13)
- E09: Escrow Expense Delay Policy (Per Cost Node)

### Waterfall (W01-W06)
- W01: Investor Capital Definition (Investor expenses + refundable escrow deposit)
- W02: Capital Return Priority (100% of distributable cash)
- W03: Investor Profit Share (85% of remaining profit)
- W04: COMO Profit Share (15% of remaining profit)
- W05: Developer Fee During Project (calculated from F03)
- W06: Loss Treatment (No Developer Profit — COMO gets 0% when no profit)

### Financing (R01-R11)
- R01: Cash Deficit Funding Method (Automatic Investor Contributions)
- R02: Minimum Investor Cash Balance (AED, default 0)
- R03: Minimum Escrow Cash Balance (AED, default 0)
- R04: Annual Discount Rate (default 10%)
- R05: Target IRR (default 15%)
- R06: Bank Financing Active (No — disabled in base version)
- R07: Loan Limit (AED)
- R08: Annual Interest Rate (%)
- R09: Arrangement Fee (%)
- R10: Draw Priority (Investor First)
- R11: Repayment Priority (Project Surplus)

### Scenarios (X01-X06)
- X01: Selected Scenario (Base/Optimistic/Pessimistic)
- X02: Sales Price Factor (multiplier, default 1.0)
- X03: Sales Speed Factor (multiplier, default 1.0)
- X04: Construction Cost Factor (multiplier, default 1.0)
- X05: Construction Delay (months, default 0)
- X06: Other Fees Factor (multiplier, default 1.0)

---

## UNIT MIX (up to 20 types per project)
Each unit type has:
- Unit Type ID (e.g., RES1, RET1, OFF1)
- Use ID (RES/RET/OFF)
- Unit Type Name
- Unit Count
- Avg Unit Area (sqft)
- Pricing Method (Price per sqft / Fixed Unit Price)
- Price per sqft OR Fixed Unit Price

Example Project 1:
- RES1: 1BR Apartment, 47 units, 750 sqft, 1550/sqft
- RES2: 2BR Apartment, 26 units, 1300 sqft, 1500/sqft
- RES3: 3BR Apartment, 12 units, 1660 sqft, 1450/sqft
- RET1: Retail Small, 26 units, 850 sqft, 3000/sqft
- RET2: Retail Medium, 19 units, 1200 sqft, 2500/sqft
- RET3: Retail Large, 6 units, 2500 sqft, 2000/sqft
- OFF1: Office Small, 51 units, 1200 sqft, 1900/sqft
- OFF2: Office Medium, 28 units, 3690 sqft, 1800/sqft
- OFF3: Office Large, 18 units, 7500 sqft, 1700/sqft

---

## COST NODES (up to 40 per project)
Each cost node has:
- Code (e.g., BANK_FEES, RERA_AUDIT, OFFPLAN_COMM...)
- Name
- Active (Yes/No)
- Category (Government/Sales/Construction)
- Calculation Method (Fixed Amount / Percentage / Per sqft / Per unit / Contract Component / Formula-linked)
- Basis (Land Cost / GFA / BUA / Construction Cost / Total Sales / Off-Plan Sales / Post-Completion Sales / Total Units / Marketing Materials Budget / Other)
- Rate/Amount
- Funding Source (Investor / Escrow)
- Timing Type (Construction Month / Buyer Collection Threshold / Sale Month / Marketing Curve / Design Phase Equal / Construction Phase Equal / Construction Progress Lagged / Post-Completion Month)

Key Cost Nodes from Project 1:
1. BANK_FEES: 35,000 AED fixed, Investor, Construction Month
2. RERA_AUDIT: 24,000 AED fixed, Escrow, Construction Month
3. RERA_INSPECT: 150,000 AED fixed, Escrow, Construction Month
4. OFFPLAN_COMM: 5% of Off-Plan Sales, Escrow, Buyer Collection Threshold
5. POST_COMM: 5% of Post-Completion Sales, Investor, Sale Month
6. MARKETING: 2% of Total Sales, Investor, Marketing Curve
7. DEV_DESIGN: 2% of Total Sales, Investor, Design Phase Equal
8. DEV_SUPERV: 3% of Total Sales, Investor, Construction Phase Equal
9. CONTRACT_ADV: 10% of Construction Cost, Investor, Construction Month
10. CONTRACT_PROGRESS: 80% of Construction Cost, Escrow, Construction Progress Lagged
11. RETENTION_ESC: 5% of Construction Cost, Escrow, Post-Completion Month
12. RETENTION_INV: 5% of Construction Cost, Investor, Post-Completion Month

---

## PAYMENT PLAN (up to 3 plans × 15 milestones per project)
Each milestone has:
- Plan ID (PLAN-A, PLAN-B, PLAN-C)
- Milestone ID (PM01-PM15)
- Active (Yes/No)
- Milestone Name
- Trigger Type (Months After Signing / Handover / Construction Progress)
- Trigger Value (months or %)
- Payment % (of unit price)
- Collection Lag (months)

Example PLAN-A (Project 1):
- PM01: At Signing, 10%, lag 0
- PM02: 1 Month After Signing, 10%, lag 0
- PM03: 6 Months After Signing, 10%, lag 0
- PM04: 12 Months After Signing, 10%, lag 0
- PM05: 18 Months After Signing, 10%, lag 0
- PM06: 24 Months After Signing, 10%, lag 0
- PM07: At Handover, 40%, lag 0
Total = 100%

---

## CURVES (Monthly % distributions)

### Construction Progress Curve (30 months):
1.2%, 1.3%, 2%, 2.5%, 3%, 3.5%, 3%, 3.5%, 3.5%, 4%, 4%, 5%, 5%, 5.5%, 5.5%, 5.5%, 5.5%, 5%, 4%, 4.5%, 4%, 3%, 3.2%, 2.5%, 2.5%, 2%, 2%, 1.8%, 1%, 1%

### Design Fee Curve (8 months):
17.5%, 7.5%, 20%, 17.5%, 17.5%, 10%, 5%, 5%

### Off-Plan Sales Curve (10 months):
8%, 12%, 14%, 16%, 14%, 10%, 8%, 6%, 5%, 7%

### Post-Completion Sales Curve (11 months):
~9.09% each month (uniform distribution over 11 months)

### Marketing Curve (14 months):
6%, 6%, 6%, 6%, 7%, 7%, 8%, 9%, 6%, 6%, 7%, 8%, 9%, 9%

---

## CALC ENGINE LOGIC (per project block, ~200 rows)

### Phase Counters (rows 30-38):
- Design Month: counts 1,2,3... during design period, 0 otherwise
- Construction Month: counts 1,2,3... during construction period
- Post-Completion Month: counts after construction+handover delay
- Sales Month: counts from sales start (T12+T05)
- Marketing Month: counts from marketing start (T12+T06) for T07 months
- Approval Phase: marks approval milestones
- Handover Flag: marks handover month
- First Escrow Release Flag: marks first release month
- Final Escrow Release Flag: marks final release month

### Sales (rows 44-76):
- Total Sales (adjusted) = sum(units × area × price) × scenario factor X02
- Off-Plan Sales = Total × S01 × off-plan curve[sales_month] × speed factor X03
- Post-Completion Sales = Total × S02 × post-completion curve[post_month] × speed factor
- Total Monthly Sales = Off-Plan + Post-Completion
- Cumulative Sales = running sum

### Collections (rows 73-76):
- Off-Plan Collections to Escrow = sum of all milestone cohort payments (rows 134-178)
- Post-Completion Collections to Escrow = based on post-completion payment terms
- Direct Buyer Collections to Investor = post-completion payments not routed through escrow
- Total Buyer Collections = sum of above

### Cohort Collection Logic (rows 134-178, one per milestone):
For each active milestone PM:
- IF trigger = "Months After Signing": payment due = PM.payment% × sales[month - PM.trigger_value - PM.lag]
- IF trigger = "Handover": payment due = PM.payment% × total_off_plan_sales × handover_flag
- IF trigger = "Construction Progress": payment due when cumulative progress >= threshold

### Costs (rows 78-117, one per cost node):
Each cost node calculates monthly amount based on its timing type:
- Construction Month: spread equally over construction months
- Design Phase Equal: spread equally over design months
- Construction Phase Equal: spread equally over construction months
- Construction Progress Lagged: follows construction curve with lag
- Marketing Curve: follows marketing distribution curve
- Buyer Collection Threshold: triggered when collections reach threshold
- Sale Month: triggered in the month of sale
- Post-Completion Month: triggered in post-completion period

### Escrow Account (rows 118-130):
- Investor-funded costs = sum of costs where funding="Investor"
- Escrow-funded costs = sum of costs where funding="Escrow"
- Escrow deposit = deposit% × construction cost (at construction month 2)
- Escrow inflows = off-plan collections + post-completion to escrow + deposit
- Escrow outflows = escrow-funded costs
- Balance before release = opening + inflows - outflows + deficit funding
- Regulatory retention = retention% × off-plan sales
- First release = MAX(0, balance - retention) at first release month
- Final release = MAX(0, balance - first_release) at final release month
- Ending balance = balance - total releases

### Investor & Waterfall (rows 131-200):
- Investor requirements = investor-funded costs + escrow deposit + deficit funding
- Direct collections = post-completion buyer payments to investor
- Investor reserve contribution (if configured)
- Total investor contribution = requirements + reserve
- Distributable cash = direct collections + escrow releases + reserve release
- Unrecovered capital (opening) = previous period's unrecovered capital + new contributions
- Capital return = MIN(distributable × W02, unrecovered capital)
- Remaining profit = MAX(0, distributable - capital return)
- Investor profit share = remaining × W03 (85%)
- COMO profit share = remaining × W04 (15%)
- Total investor distribution = capital return + investor profit
- Net investor cash flow = distribution - contribution
- Developer fee cash = DEV_DESIGN costs + DEV_SUPERV costs
- Total COMO compensation = developer fees + COMO profit share
- Unrecovered capital (ending) = MAX(0, opening - capital return)

### Checks (rows 195-200):
- Waterfall distribution check: distributable = capital_return + investor_profit + como_profit
- Capital rollover check: ending_unrecovered = opening - capital_return
- Consolidated cash check: net project CF = contributions + collections - costs - distributions - como_profit

---

## REPORT OUTPUTS (What the web should show)

### 1. Project Dashboard (per project):
- Timeline: Design completion, marketing materials, approvals, campaign start, sales start, construction completion, campaign end
- Key Metrics: Total adjusted sales, construction cost, marketing materials budget, investor contributions, investor distributions, unrecovered capital at end

### 2. Investor Cash Flow (monthly):
- Contributions: investor-funded costs, escrow deposit, deficit funding, reserve
- Distributions: direct collections, escrow releases, reserve release
- Waterfall: capital return, investor profit, total distribution
- Net CF, unrecovered capital tracking

### 3. Escrow Cash Flow (monthly):
- Inflows: off-plan collections, post-completion to escrow, deposit, deficit funding
- Outflows: escrow-funded costs
- Balance, retention, first release, final release, ending balance

### 4. Returns & Waterfall:
- Total investor contributions
- Total capital return
- Total investor profit
- Total distributions
- MOIC (distributions / contributions)
- XIRR (internal rate of return)
- XNPV (net present value)
- Target IRR comparison
- Capital recovery date
- Max unrecovered capital
- Monthly waterfall detail

### 5. Consolidated Cash Flow (monthly):
- Sources: investor contributions, all buyer collections
- Uses: investor-funded costs, escrow-funded costs, investor distributions, COMO profit
- Net project CF, controlled cash change
- Escrow balance, investor reserve, distributable cash

### 6. Portfolio Dashboard (multi-project):
- Comparison table: project ID, name, scenario, horizon, total sales, completion %, contributions, distributions, MOIC
- Aggregate metrics: total sales, total distributions, portfolio MOIC

### 7. Sales Plan:
- Unit pricing summary table
- Monthly off-plan sales
- Monthly post-completion sales
- Cumulative sales

### 8. Buyer Collections:
- Payment plan milestones table
- Monthly cohort collections detail
- Total collections

### 9. Project Costs:
- Cost node registry (code, name, category, method, basis, rate, funding, timing)
- Monthly cost schedule

### 10. Construction Schedule:
- Monthly construction progress (%)
- Cumulative progress

### 11. Project Timeline:
- Design month counter
- Construction month counter
- Sales month counter
- Marketing month counter
- Approval milestones
- Handover, first release, final release flags

---

## KEY RELATIONSHIPS & DEPENDENCIES

1. Timeline drives everything:
   - T12 (schematic design completion) is the anchor
   - Sales start = T12 + T05
   - Marketing start = T12 + T06
   - Construction start = after design (T01 months)
   - Handover = construction end + T08
   - First escrow release = handover + T09
   - Final escrow release = first release + T10

2. Sales drive collections:
   - Monthly sales × payment plan milestones = monthly collections (cohort logic)
   - Collections split between escrow (off-plan) and investor (post-completion)

3. Collections + Costs drive Escrow:
   - Escrow receives off-plan collections
   - Escrow pays escrow-funded costs
   - Escrow releases to investor after retention

4. Everything drives Investor CF:
   - Investor pays investor-funded costs + escrow deposit
   - Investor receives direct collections + escrow releases
   - Waterfall distributes: capital return first, then profit split

5. Scenario factors multiply base values:
   - X02 × sales prices
   - X03 × sales speed
   - X04 × construction cost
   - X05 adds delay months
   - X06 × other fees
