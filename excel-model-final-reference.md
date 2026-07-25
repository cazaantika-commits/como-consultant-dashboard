# Como Development Model — Complete Excel Reference for Web App

## Overview
- 17 sheets, supports multiple projects (up to 10 slots)
- Calc Engine: 120 months × ~200 rows per project block
- All timing is relative to T12 (Schematic Completion Date)

---

## 1. INPUT PARAMETERS (Inputs Sheet)

### Project Identity (P01-P12)
| Code | Label | Example | Unit |
|------|-------|---------|------|
| P01 | Project Name | Majan Mixed-Use (G+4P+25) | Text |
| P02 | Project ID | PRJ-001 | Text |
| P03 | Location | Majan, Dubai | Text |
| P04 | Project Type | Mixed-Use | List |
| P05 | Currency | AED | Currency |
| P06 | Project Start Date | 2026-08-01 | Date |
| P07 | Land Purchase Date | 2026-07-01 | Date |
| P08 | Investor Opening Cash | 0 | AED |
| P09 | Escrow Opening Cash | 0 | AED |
| P10 | Post-Completion Display Period | 13 | Months |
| P11 | Model Valuation Date | 2026-07-22 | Date |
| P12 | Include in Portfolio | Yes | Yes/No |

### Timeline (T01-T12)
| Code | Label | Example | Unit |
|------|-------|---------|------|
| T01 | Design Duration | 8 | Months |
| T02 | Construction Duration | 30 | Months |
| T03 | Approval Start Offset after T12 | 3 | Months after T12 |
| T04 | Gap between Design & Construction | 0 | Months |
| T05 | Sales Start Offset after T12 | 5 | Months after T12 |
| T06 | Campaign Start Offset after T12 | 3 | Months after T12 |
| T07 | Handover Delay after Construction | 0 | Months |
| T08 | Unit Registration Delay after Handover | 0 | Months |
| T09 | Post-Completion Sales Duration | 11 | Months |
| T10 | First Escrow Release | 3 | Months after completion |
| T11 | Final Escrow Release | 13 | Months after completion |
| T12 | Schematic Completion Date | 2026-11-01 | Date (computed or input) |

**KEY TIMING LOGIC:**
- T12 = Project Start + some months (user-defined or computed)
- Sales Start = T12 + T05 months
- Marketing Start = T12 + T06 months
- Approvals Start = T12 + T03 months
- Construction Start = Project Start + T01 + T04
- Construction End = Construction Start + T02 + X05 (delay scenario)
- Handover = Construction End + T07
- First Escrow Release = Completion + T10
- Final Escrow Release = Completion + T11

### Land (A01-A04, L01-L05)
| Code | Label | Example | Unit |
|------|-------|---------|------|
| A01 | Land Area | 66,879 | sqft |
| A02 | Land Pricing Method | Price per GFA sqft | Method |
| A03 | Land Price/Rate | 260.60 | AED/sqft |
| A04 | BUA (Built-Up Area) | 900,000 | sqft |
| L01 | Land Registration Rate | 4% | % of land price |
| L02 | Land Broker Commission | 1% | % of land price |
| L03-L05 | Timing | Land Purchase Date | Event |

### Construction (C01-C13)
| Code | Label | Example | Unit |
|------|-------|---------|------|
| C01 | Construction Cost/sqft | 400 | AED/sqft |
| C02 | Fixed Contract Amount | - | AED |
| C03 | Contractor Advance | 10% | % of construction cost |
| C04 | Advance Timing | Construction Month 1 | Event |
| C05 | Progress Payments | 80% | % of construction cost |
| C06 | Payment Certificate Lag | 1 | Months |
| C07 | First Retention | 5% | % of construction cost |
| C08 | First Retention Timing | 2 | Months after completion |
| C09 | Final Retention | 5% | % of construction cost |
| C10 | Final Retention Timing | 13 | Months after completion |
| C11 | Sum of Contract Components | 100% | % (check) |
| C12 | Change Order Rate | 0% | % of construction cost |
| C13 | Construction Contingency | 0% | % of construction cost |

### Design Consultants (D01-D10)
| Code | Label | Example | Unit |
|------|-------|---------|------|
| D01 | Design Consultant Fee | 1.8% | % of construction cost |
| D04 | Supervision Consultant Fee | 2% | % of construction cost |
| D06 | Soil Test | 45,000 | AED |
| D08 | Topographic Survey | 12,000 | AED |
| D10 | Surveyor Fee | 35,000 | AED |

### Sales (S01-S14)
| Code | Label | Example | Unit |
|------|-------|---------|------|
| S01 | Off-Plan Sales % | 80% | % of total sales |
| S02 | Post-Completion Sales % | 20% | % of total sales |
| S05 | Off-Plan Sales Curve | [0.08, 0.12, 0.14, 0.16, 0.14, 0.10, 0.08, 0.06, 0.05, 0.07] | Monthly % (sum=1) |
| S06 | Post-Completion Curve | Equal distribution over T09 months | Monthly % |
| S07 | Off-Plan Price Premium | 0% | % |
| S08 | Post-Completion Premium | 0% | % |
| S12 | Sales Price Growth Rate | 0% | % monthly |
| S13 | Post-Completion Collection | Full Cash at Sale | Method |
| S14 | Post-Completion Destination | Investor | Destination |

### Payment Plan (B01-B05 + Milestones)
| Code | Label | Example | Unit |
|------|-------|---------|------|
| B01 | Late Installment Policy | Accelerate to Pre-Handover | Policy |
| B02 | Number of Payment Plans | 1 | Count |
| B04 | Cancellation Rate | 0% | % |
| B05 | Recovery Rate on Cancel | 0% | % |

**Payment Plan Milestones (PLAN-A example):**
| # | Name | Trigger | Value | % | Lag |
|---|------|---------|-------|---|-----|
| 1 | At Signing | Months After Signing | 0 | 10% | 0 |
| 2 | 1 Month After Signing | Months After Signing | 1 | 10% | 0 |
| 3 | 6 Months After Signing | Months After Signing | 6 | 10% | 0 |
| 4 | 12 Months After Signing | Months After Signing | 12 | 10% | 0 |
| 5 | 18 Months After Signing | Months After Signing | 18 | 10% | 0 |
| 6 | 24 Months After Signing | Months After Signing | 24 | 10% | 0 |
| 7 | At Handover | Handover | 0 | 40% | 0 |

**Trigger Types:** "Months After Signing", "Handover", "Construction Progress"

### Marketing (M01-M09)
| Code | Label | Example | Unit |
|------|-------|---------|------|
| M01 | Marketing Budget % | 2% | % of total sales |
| M04 | Off-Plan Commission | 5% | % of category sales |
| M05 | Commission Threshold | 20% | % of unit price |
| M06 | Off-Plan Commission Lag | 1 | Months |
| M07 | Post-Completion Commission | 5% | % of sales |
| M08 | Post-Completion Commission Lag | 0 | Months |
| M09 | Marketing Materials Budget | 0 | AED |

**Marketing Curve:** [0.06, 0.06, 0.06, 0.06, 0.07, 0.07, 0.08, 0.09, 0.06, 0.06, 0.07, 0.08, 0.09, 0.09] (sum=1)

### Developer Fees (F01-F03)
| Code | Label | Example | Unit |
|------|-------|---------|------|
| F01 | Developer Fee during Design | 2% | % of total sales |
| F02 | Developer Fee during Supervision | 3% | % of total sales |
| F03 | Total Developer Fee | 5% | % (computed) |

### Escrow (E01-E09)
| Code | Label | Example | Unit |
|------|-------|---------|------|
| E01 | Refundable Escrow Deposit Rate | 20% | % of construction cost |
| E02 | Escrow Deposit Timing | Sales Approval Month | Event |
| E03 | Off-Plan Collections to Escrow | 100% | % of collections |
| E04 | Min Escrow Balance | 0 | AED |
| E05 | Regulatory Retention Rate | 5% | % of expected off-plan sales |
| E07 | First Release Timing | 3 | Months after completion |
| E08 | Final Release Timing | 13 | Months after completion |

### Waterfall (W01-W06)
| Code | Label | Example | Unit |
|------|-------|---------|------|
| W01 | Investor Capital Definition | Investor expenses + refundable escrow deposit | Policy |
| W02 | Capital Return Priority | 100% | % of distributable cash |
| W03 | Investor Profit Share | 85% | % of remaining profit |
| W04 | COMO Profit Share | 15% | % of remaining profit |
| W05 | Developer Fee during Project | 5% | % (computed) |
| W06 | Loss Treatment | No Developer Profit | Policy |

### Financing (R01-R11)
| Code | Label | Example | Unit |
|------|-------|---------|------|
| R01 | Cash Deficit Funding | Automatic Investor Contributions | Method |
| R04 | Annual Discount Rate | 10% | % annually |
| R05 | Target IRR | 15% | % annually |
| R06 | Bank Financing Active | No | Yes/No |

### Scenarios (X01-X06)
| Code | Label | Example | Unit |
|------|-------|---------|------|
| X01 | Selected Scenario | Base | Scenario |
| X02 | Sales Price Factor | 100% | % |
| X03 | Sales Speed Factor | 100% | % |
| X04 | Construction Cost Factor | 100% | % |
| X05 | Construction Delay | 0 | Months |
| X06 | Other Fees Factor | 100% | % |

---

## 2. UNIT MIX (9 types in example)

| Type ID | Use | Name | Count | Avg Area | Method | Price/sqft |
|---------|-----|------|-------|----------|--------|-----------|
| RES1 | RES | 1 BR Apartment | 47 | 750 | Price per sqft | 1,550 |
| RES2 | RES | 2 BR Apartment | 26 | 1,300 | Price per sqft | 1,500 |
| RES3 | RES | 3 BR Apartment | 12 | 1,660 | Price per sqft | 1,450 |
| RET1 | RET | Retail — Small | 26 | 850 | Price per sqft | 3,000 |
| RET2 | RET | Retail — Medium | 19 | 1,200 | Price per sqft | 2,500 |
| RET3 | RET | Retail — Large | 6 | 2,500 | Price per sqft | 2,000 |
| OFF1 | OFF | Office — Small | 51 | 1,200 | Price per sqft | 1,900 |
| OFF2 | OFF | Office — Medium | 28 | 3,690 | Price per sqft | 1,800 |
| OFF3 | OFF | Office — Large | 18 | 7,500 | Price per sqft | 1,700 |

---

## 3. COST NODES (27 items in example)

Each cost node has: Name, Code, Category, Calc Method, Basis, Rate, Funding Source, Timing Type

**Timing Types for Costs:**
- Land Purchase Date (one-time)
- Design Curve (follows design fee curve)
- Construction Progress Lagged (follows construction S-curve with lag)
- Design Month (specific month in design)
- Approval Month 1/2 (specific approval months)
- Schematic Completion Month (one-time at T12)
- Every 6 Months (recurring)
- Completion Threshold (at specific % completion)
- Multiple Completion Thresholds
- Sales Approval Month (one-time)
- Construction Month (specific month in construction)
- Buyer Collection Threshold (when collections reach %)
- Sale Month (at time of each sale)
- Marketing Curve (follows marketing distribution curve)
- Design Phase Equal (equal monthly during design)
- Construction Phase Equal (equal monthly during construction)
- Post-Completion Month (specific month after completion)

**Funding Sources:** "Investor" or "Escrow"

---

## 4. CURVES (Distribution Profiles)

| Curve | Duration | Values (sum=1.0) |
|-------|----------|-----------------|
| Construction Progress | 30 months | S-curve peaking mid-construction |
| Design Fee | 8 months | [0.175, 0.075, 0.2, 0.175, 0.175, 0.1, 0.05, 0.05] |
| Off-Plan Sales | 10 months | [0.08, 0.12, 0.14, 0.16, 0.14, 0.10, 0.08, 0.06, 0.05, 0.07] |
| Post-Completion Sales | 11 months | Equal (1/11 each) |
| Marketing | 14 months | [0.06, 0.06, 0.06, 0.06, 0.07, 0.07, 0.08, 0.09, 0.06, 0.06, 0.07, 0.08, 0.09, 0.09] |

---

## 5. CALC ENGINE LOGIC (per month, per project)

### Phase Counters (rows 30-38):
- **Design Month** = counter 1..T01 during design phase
- **Construction Month** = counter 1..T02 during construction
- **Post-Completion Month** = counter after construction ends
- **Sales Month** = counter from T12+T05 onwards (never ends)
- **Marketing Month** = counter from T12+T06, ends 12 months after completion or 60 months max
- **Approval Month** = 1 or 2 at T12+T03 and T12+T03+1
- **Handover Indicator** = 1 on handover month only
- **First Release Indicator** = 1 on completion+T10 month
- **Final Release Indicator** = 1 on completion+T11 month

### Sales Calculations (rows 55-76):
- **Off-Plan Sales Signed** = Total Revenue × S01 × (1+S07) × X02 × curve[sales_month] × (1+S12)^(sales_month-1)
- **Post-Completion Sales** = Total Revenue × S02 × (1+S08) × X02 × curve[post_month]
- **Total Sales Signed** = Off-Plan + Post-Completion
- **Payment Plan Collections** = Cohort-based: each month's sales generate future collections per milestone schedule

### Collection Cohort Logic:
For each milestone in the payment plan:
- If trigger = "Months After Signing": collect milestone% × sales[month - trigger_value - lag]
- If trigger = "Handover": collect milestone% × cumulative_unsold_at_handover on handover month
- If trigger = "Construction Progress": collect when progress reaches threshold

### Cost Calculations (rows 78-117):
Each cost node applies its rate × basis × timing_indicator:
- **Timing indicator** depends on timing type (see section 3)
- Costs split by funding source (Investor vs Escrow)

### Escrow Account (rows 118-130):
- **Inflows** = Off-plan collections to escrow + post-completion to escrow + refundable deposit
- **Outflows** = Escrow-funded costs
- **Balance before release** = Opening + Inflows - Outflows + deficit funding
- **Regulatory retention** = E05 × Expected Off-Plan Sales (after construction)
- **First Release** = MAX(0, Balance - Retention) on first release month
- **Final Release** = MAX(0, Balance - First Release) on final release month

### Investor & Waterfall (rows 131-200):
- **Investor Cash Requirements** = Investor-funded costs + escrow deposit + deficit funding
- **Investor Direct Collections** = Post-completion collections (if S14=Investor)
- **Total Investor Contribution** = Cash requirements + reserve contributions
- **Distributable Cash** = Direct collections + Escrow releases + reserve releases
- **Capital Return** = MIN(Distributable × W02, Unreturned Capital)
- **Remaining Profit** = MAX(0, Distributable - Capital Return)
- **Investor Profit Share** = Remaining × W03
- **COMO Profit Share** = Remaining × W04
- **Total Investor Distribution** = Capital Return + Investor Profit Share
- **Net Investor Cash Flow** = Distribution - Contribution
- **COMO Total Compensation** = Developer Fees + COMO Profit Share

---

## 6. OUTPUT REPORTS (Sheets)

### Sales Plan
- Unit pricing summary table
- Monthly off-plan and post-completion sales

### Buyer Collections
- Payment plan milestones table
- Monthly cohort collections by plan

### Project Costs
- Cost node registry with categories and timing
- Monthly cost schedule

### Investor Cash Flow
- Monthly: Contributions, Direct Collections, Escrow Releases, Capital Return, Profit Share, Net CF
- Summary: Total Contributions, Total Distributions, MOIC, XIRR, Payback Date

### Escrow Cash Flow
- Monthly: Opening, Inflows, Outflows, Balance, Retention, Releases, Closing

### Consolidated Cash Flow
- Monthly: All sources and uses, net project cash flow, controlled cash change

### Returns & Waterfall
- Monthly waterfall: Capital tracking, distributions, COMO compensation
- Summary metrics: MOIC, XIRR, XNPV, Payback

### Project Dashboard
- Key dates (Schematic → Sales → Completion)
- Key economics (Sales, Costs, Contributions, Distributions)

### Project Timeline
- Monthly phase indicators (Design, Construction, Sales, Marketing, Approvals, Handover, Releases)

### Portfolio Dashboard
- Multi-project comparison: Sales, Completion %, Contributions, Distributions, MOIC, XIRR

---

## 7. WEB APP ARCHITECTURE PLAN

### Pages:

**1. Owner Input Page (Admin only)**
Sections:
- Project Identity (P01-P12)
- Timeline (T01-T12)
- Land & Area (A01-A04, L01-L05)
- Construction (C01-C13)
- Design Consultants (D01-D10)
- Unit Mix (9 types, editable table)
- Cost Nodes (editable table)
- Escrow Rules (E01-E09)
- Waterfall (W01-W06)
- Financing (R01-R11)
- Scenarios (X01-X06)
- Curves (editable: construction, design, sales, marketing)

**2. Wael's Page (Sales & Marketing)**
- Pricing: Unit types, areas, prices → total revenue
- Payment Plan: Milestones table (add/remove/edit)
- Sales: Off-plan %, post-completion %, curves
- Marketing: Budget %, commissions, curve
- Results: Monthly collections table, total collections

**3. Feasibility Study Report**
- Total Revenue breakdown
- Total Costs breakdown (by category)
- Net Profit
- Profit as % of Capital
- Profit as % of Total Cost
- IRR, MOIC
- COMO earnings (fees + profit share)
- Investor earnings

**4. Investor Cash Flow Report**
- Monthly table: Contributions, Collections, Releases, Distributions, Net CF
- Summary KPIs: Total invested, Total returned, MOIC, IRR, Payback date

**5. Escrow Cash Flow Report**
- Monthly table: Opening, Inflows, Outflows, Retention, Releases, Closing
- Alerts when balance is low

**6. Project Timeline (Visual)**
- Bubble/phase diagram showing all stages
- Dynamic: changes when dates/durations change

**7. Portfolio (Multi-Project)**
- Select projects to compare
- Side-by-side: Sales, Costs, Returns, MOIC, IRR
