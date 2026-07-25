# Excel Model Analysis - Como Multi Project Development Model v4

## Overview
- 17 sheets, 120-month horizon per project, supports up to 15 projects
- Calc Engine: 2818 rows × 126 cols — one 187-row block per project (rows 20-206 for project 1)

## Sheet Structure

### 1. Inputs (2001 rows × 67 cols)
Master input sheet with coded parameters:

**Timeline (T codes) — ACTUAL VALUES from Excel:**
- T01: Design duration = 8 months
- T02: Construction duration = 30 months
- T03: Approvals offset after design completion (T12) = 3 months
- T04: Gap between design and construction = 0 months
- T05: Sales start offset after T12 = 5 months
- T06: Campaign start offset after T12 = 3 months
- T07: Handover delay after construction = 0 months
- T08: Unit registration delay after handover = 0 months
- T09: Post-completion sales duration = 11 months
- T10: First escrow release = 3 months after completion
- T11: Final escrow release = 13 months after completion
- T12: Design completion date = calculated (P06 + T01 months)

**Project Identity (P codes):**
- P01: Project name = "Majan Mixed-Use (G+4P+25)"
- P02: Project ID = "PRJ-001"
- P03: Location = "Majan, Dubai"
- P04: Type = "Mixed-Use"
- P05: Currency = AED
- P06: Project start date = 2026-08-01
- P07: Land purchase date = 2026-07-01
- P10: Post-completion display period = 13 months
- P12: Include in portfolio = Yes

**Land (L codes):**
- L01: Land registration rate = 4% of land price
- L02: Land broker commission = 1% of land price
- A01: Land area = 66,879 sqft
- A02: Land pricing method = "Price per GFA sqft"
- A03: Land rate = 260.60 AED/sqft
- A04: BUA = 900,000 sqft
- A05: Construction cost basis = "BUA x Rate"

**Construction (C codes):**
- C01: Construction cost (AED)
- C02: Construction method (Monthly Curve)
- C03: Advance payment % — 0.1
- C04: Progress payment % — 0.8
- C05: Progress payment lag — 0.8
- C06: Certificate lag — 1 month
- C07: First retention — 5%
- C08: First retention timing — 2 months after completion
- C09: Final retention — 5%
- C10: Final retention timing — 13 months after completion

**Sales (S codes):**
- S01: Off-plan sales ratio — 80%
- S02: Post-completion sales ratio — 20%
- S03: Sales start offset (months after T12) — linked to T05
- S04: Sales distribution method — "Monthly Curve"
- S05: Off-plan sales curve — reference to curve table
- S06: Post-completion sales curve — reference to curve table
- S07: Off-plan price premium/discount — 0%
- S08: Post-completion price premium — 0%
- S09: Sales allocation method — "Total Value"
- S12: Sales price growth rate — 0% monthly
- S13: Post-completion collection method — "Full Cash at Sale"
- S14: Post-completion collection destination — "Investor"

**Buyer/Payment (B codes):**
- B01: Late installment handling — "Accelerate to Pre-Handover"
- B02: Number of payment plans — 1 (can be up to 3)
- B03: Payment plan assignment per unit type
- B04: Cancellation/default rate — 0%
- B05: Recovery rate on cancellation — 0%

**Marketing (M codes):**
- M01: Marketing budget — 2% of total sales
- M02: Campaign start offset — linked to T06 (months after T12)
- M03: Marketing distribution curve — reference to curve table
- M04: Off-plan sales commission — 5%
- M05: Commission collection threshold — 20% of unit price
- M06: Off-plan commission lag — 1 month
- M07: Post-completion commission — 5%
- M08: Post-completion commission lag — 0 months
- M09: Marketing materials budget (AED) — 0

**Developer Fees (F codes):**
- F01: Developer fee during design — 2% of total sales
- F02: Developer fee during supervision — 3% of total sales
- F03: Total developer fee — F01+F02 = 5%

**Escrow (E codes):**
- E01: Refundable escrow deposit — 20% of construction cost
- E02: Escrow deposit timing — "Sales Approval Month"
- E03: Buyer collections to escrow — 100%
- E04: Minimum escrow balance — 0
- E05: Regulatory retention — 5% of expected off-plan sales
- E06: Retention basis — "Expected Off-Plan Sales"
- E07: First escrow release — 3 months after completion
- E08: Final escrow release — 13 months after completion

**Waterfall (W codes):**
- W01: Investor capital definition — "Investor expenses + refundable escrow deposit"
- W02: Capital return priority — 100%
- W03: Investor profit share — 85%
- W04: COMO profit share — 15%
- W05: Developer fee during project — F01+F02
- W06: Loss handling — "No Developer Profit"

**Financing (R codes):**
- R01: Shortfall funding — "Automatic Investor Contributions"
- R04: Annual discount rate — 10%
- R05: Target IRR — 15%
- R06: Bank financing — No
- R07-R11: Loan parameters (all 0 when disabled)

**Scenarios (X codes):**
- X01: Selected scenario — "Base"
- X02-X06: Stress factors (price, speed, cost, delay, fees)

### 2. Calc Engine (2818 rows × 126 cols)
Monthly calculation grid per project. Key rows per project block:

**Timeline rows (28-38):**
- Row 28: Month number (0-120)
- Row 29: Calendar month (date)
- Row 30: Design month counter
- Row 31: Construction month counter
- Row 32: Post-completion month counter
- Row 33: Sales month counter
- Row 34: Campaign month counter
- Row 35: Approvals phase
- Row 36: Handover flag
- Row 37: First release flag
- Row 38: Final release flag

**Static summary (40-51):**
- Row 40-46: Total units, GFA, sellable area, base/adjusted sales, off-plan/post sales
- Row 47-51: Land cost, construction cost (base/adjusted), completion/handover dates

**Monthly calculations (53-76):**
- Row 53: Construction progress %
- Row 54: Cumulative progress %
- Row 55: Off-plan sales signed (AED)
- Row 56: Post-completion sales signed (AED)
- Row 57: Total sales signed
- Rows 58-72: Payment plan collections (3 plans × {ID, share, sales, commission lag, collections})
- Row 73: Buyer collections to escrow
- Row 74: Post-sales to investor
- Row 75: Post-sales to escrow
- Row 76: Total buyer collections

**Costs (rows 78-117 — implied from gap):**
- Cost nodes distributed monthly based on triggers

**Escrow (118-130):**
- Row 118: Investor-funded project costs
- Row 119: Escrow-funded project costs
- Row 120: Refundable escrow deposit
- Row 121: Escrow shortfall funding
- Row 122: Operating inflows to escrow
- Row 123: Eligible outflows from escrow
- Row 124: Escrow balance before disbursement
- Row 125: Regulatory retention requirement
- Row 126: First escrow release
- Row 127: Final escrow release
- Row 128: Total escrow release
- Row 129: Escrow closing balance
- Row 130: Escrow liquidity alert

**Investor (131-200):**
- Row 131: Investor cash requirements
- Row 132: Direct buyer collections to investor
- Rows 179-200: Investor capital account, waterfall distribution

### 3. Key Formulas Logic

**Timeline:**
- Design months: count from T01 for T02 months
- Construction starts after design ends
- Sales start: T12 + T05 (offset after design completion)
- Campaign start: T12 + T06 (offset after design completion)
- Handover: construction end + T07

**Sales:**
- Off-plan sales = Total adjusted sales × S01 × monthly curve %
- Post-completion sales = Total adjusted sales × S02 × post-curve %
- Sales curve: S1-S60 monthly percentages (must sum to 100%)

**Buyer Collections (Payment Plan):**
- Up to 3 payment plans (PLAN-A, PLAN-B, PLAN-C)
- Each plan has up to 15 milestones
- Each milestone: {Active, Trigger Type, Trigger Value (months), Payment %}
- Example PLAN-A: 10% at signing, 10% at month 1, 10% at month 6, 10% at month 12, 10% at month 18, 10% at month 24, 40% at handover
- Collections = for each sale month, apply payment plan milestones forward in time
- Commission triggered when cumulative collection reaches threshold (M05=20%)

**Marketing:**
- Budget = M01 × Total Sales (2%)
- Distributed monthly using marketing curve (M1-M60)
- Campaign window: from T12+T06 until completion+12 months

**Escrow:**
- Inflows: buyer off-plan collections + refundable deposit + shortfall funding
- Outflows: eligible project costs (construction, some fees)
- Regulatory retention: 5% of expected off-plan sales held until release
- First release: 3 months after completion
- Final release: 13 months after completion

**Waterfall:**
- First: return 100% of investor capital
- Then: 85% investor / 15% COMO from remaining profit
- Developer fees paid as project expense (not from waterfall)

### 4. Unit Mix (rows 144-155 per project)
- Up to 10 use types per project
- Fields: Use ID, Use Name, GFA (sqft), Efficiency %, Sellable Area Override, Parking Basis
- Example: RES (93,631 sqft, 95% eff), RET (74,905 sqft, 80% eff), OFF (299,618 sqft, 90% eff)

### 5. Cost Nodes (rows 604+ per project, 40 nodes each)
- Each node: Cost Node ID, Active, Cost Name, Category, Basis Type, Basis Link, Rate/Amount
- Categories: Land, Design, Construction, Government, Sales, Other
- Funding source: Investor or Escrow (per node)
- Timing: linked to project phases

### 6. Output Sheets (what user wants on web)

**Project Dashboard:** Key metrics summary
- Schedule: Design→Marketing Materials→Approvals→Campaign→Sales→Construction→Handover→Releases
- Economics: Total sales, construction cost, marketing materials, investor contributions/distributions
- Returns: MOIC, XIRR, XNPV, capital recovery date, total COMO cash

**Project Timeline:** Monthly phase indicators (design/construction/sales/marketing/approvals/handover/releases)

**Sales Plan:** Unit pricing summary + monthly sales schedule (off-plan + post-completion + cumulative)

**Buyer Collections:** Payment plan milestones + monthly cohort collections

**Project Costs:** Cost node register + monthly cost schedule (investor-funded vs escrow-funded)

**Investor Cash Flow:** Monthly investor capital account (contributions, collections, releases, distributions)

**Escrow Cash Flow:** Monthly escrow account (inflows, outflows, retention, releases, balance)

**Consolidated Cash Flow:** Combined sources & uses eliminating internal transfers

**Returns & Waterfall:** Investor returns (MOIC, XIRR, XNPV) + monthly waterfall distribution

## Key Relationships for Web App

1. **Inputs → Calc Engine → All Reports**
2. **Timeline drives everything**: when sales/marketing/construction start
3. **Sales × Payment Plan → Collections**: actual cash inflow timing
4. **Collections → Escrow**: regulatory compliance
5. **Costs + Collections → Investor Cash Flow**: funding requirements
6. **Waterfall**: profit distribution after capital return

## What Wael Controls (Sales & Marketing):
- S01-S14: Sales parameters
- M01-M09: Marketing parameters
- B01-B05: Payment plan parameters
- Off-plan sales curve (S1-S60)
- Marketing distribution curve (M1-M60)
- Payment plan milestones (up to 3 plans × 15 milestones)

## What Owner Controls (Everything else):
- T01-T12: Timeline
- C01-C13: Construction
- D01-D09: Design consultants
- E01-E09: Escrow
- W01-W06: Waterfall
- R01-R11: Financing
- X01-X06: Scenarios
- Unit mix and pricing
- Cost nodes
