# Excel Model Complete Reference — For New Web App Build

## MODEL OVERVIEW
- File: Como_Multi_Project_Development_Model_v4_Arabic_RTL
- 17 sheets, 120-month horizon, supports 15 projects
- All amounts in AED, monthly granularity

## SHEETS LIST
1. Inputs (master input parameters + curves + cost nodes + unit mix + payment plans)
2. Project Dashboard (KPI summary)
3. Project Timeline (monthly phase indicators)
4. Project Costs (cost node register + monthly schedule)
5. Construction Schedule (progress + payments)
6. Sales Plan (unit pricing + monthly sales)
7. Buyer Collections (payment plan milestones + monthly cohort collections)
8. Investor Cash Flow (contributions, collections, releases, distributions)
9. Escrow Cash Flow (inflows, outflows, retention, releases, balance)
10. Consolidated Cash Flow (sources & uses eliminating internal transfers)
11. Returns & Waterfall (MOIC, XIRR, XNPV + monthly waterfall)
12. Portfolio Cash Flow (multi-project aggregation)
13. Portfolio Dashboard (comparison table)
14. Model Checks (validation)
15. Calc Engine (2818 rows × 126 cols — the computation core)
16. Lists & Mapping (dropdowns)
17. Read Me

---

## INPUT PARAMETERS (All from Inputs sheet)

### Project Identity (P codes)
| Code | Description | Example Value |
|------|-------------|---------------|
| P01 | Project name | Majan Mixed-Use (G+4P+25) |
| P02 | Project ID | PRJ-001 |
| P03 | Location | Majan, Dubai |
| P04 | Type | Mixed-Use |
| P05 | Currency | AED |
| P06 | Project start date | 2026-08-01 |
| P07 | Land purchase date | 2026-07-01 |
| P08 | Opening investor cash | 0 |
| P09 | Opening escrow cash | 0 |
| P10 | Post-completion display period | 13 months |
| P12 | Include in portfolio | Yes |

### Timeline (T codes)
| Code | Description | Unit | Value |
|------|-------------|------|-------|
| T01 | Design duration | months | 8 |
| T02 | Construction duration | months | 30 |
| T03 | Approvals offset after T12 | months | 3 |
| T04 | Gap between design and construction | months | 0 |
| T05 | Sales start offset after T12 | months | 5 |
| T06 | Campaign start offset after T12 | months | 3 |
| T07 | Handover delay after construction | months | 0 |
| T08 | Unit registration delay after handover | months | 0 |
| T09 | Post-completion sales duration | months | 11 |
| T10 | First escrow release | months after completion | 3 |
| T11 | Final escrow release | months after completion | 13 |
| T12 | Design completion date | calculated | P06 + T01 |

### Land (A/L codes)
| Code | Description | Value |
|------|-------------|-------|
| A01 | Land area | 66,879 sqft |
| A02 | Land pricing method | Price per GFA sqft |
| A03 | Land rate | 260.60 AED/sqft |
| A04 | BUA | 900,000 sqft |
| A05 | Construction cost basis | BUA x Rate |
| L01 | Land registration rate | 4% of land price |
| L02 | Land broker commission | 1% of land price |
| L03-L05 | Payment timing | Land Purchase Date |

### Design Consultants (D codes)
| Code | Description | Value |
|------|-------------|-------|
| D01 | Design consultant fee | 3% of construction cost |
| D03 | Supervision fee | 1.5% of construction cost |
| D05 | Soil testing | 45,000 AED |
| D08 | Topographic survey | 12,000 AED |
| D10 | Surveyor fees | 35,000 AED |

### Sales (S codes)
| Code | Description | Value |
|------|-------------|-------|
| S01 | Off-plan sales ratio | 80% |
| S02 | Post-completion sales ratio | 20% |
| S03 | Sales start offset | linked to T05 |
| S04 | Distribution method | Monthly Curve |
| S05 | Off-plan curve | See curve table |
| S06 | Post-completion curve | See curve table |
| S07 | Off-plan price premium | 0% |
| S08 | Post-completion premium | 0% |
| S09 | Sales allocation method | Total Value |
| S12 | Sales price growth rate | 0% monthly |
| S13 | Post-completion collection | Full Cash at Sale |
| S14 | Post-completion destination | Investor |

### Buyer/Payment Plan (B codes)
| Code | Description | Value |
|------|-------------|-------|
| B01 | Late installment handling | Accelerate to Pre-Handover |
| B02 | Number of payment plans | 1 |
| B04 | Cancellation rate | 0% |
| B05 | Recovery rate | 0% |

### Marketing (M codes)
| Code | Description | Value |
|------|-------------|-------|
| M01 | Marketing budget | 2% of total sales |
| M02 | Campaign start offset | linked to T06 |
| M03 | Distribution curve | See curve table |
| M04 | Off-plan commission | 5% |
| M05 | Commission threshold | 20% of unit price |
| M06 | Off-plan commission lag | 1 month |
| M07 | Post-completion commission | 5% |
| M08 | Post-commission lag | 0 months |
| M09 | Marketing materials budget | 0 AED |

### Developer Fees (F codes)
| Code | Description | Value |
|------|-------------|-------|
| F01 | Fee during design | 2% of total sales |
| F02 | Fee during supervision | 3% of total sales |
| F03 | Total developer fee | 5% |

### Escrow (E codes)
| Code | Description | Value |
|------|-------------|-------|
| E01 | Refundable deposit | 20% of construction cost |
| E02 | Deposit timing | Sales Approval Month |
| E03 | Buyer collections to escrow | 100% |
| E04 | Minimum escrow balance | 0 |
| E05 | Regulatory retention | 5% of expected off-plan sales |
| E06 | Retention basis | Expected Off-Plan Sales |
| E07 | First release | 3 months after completion |
| E08 | Final release | 13 months after completion |
| E09 | Cost processing policy | Per Cost Node |

### Waterfall (W codes)
| Code | Description | Value |
|------|-------------|-------|
| W01 | Investor capital definition | Investor expenses + refundable escrow deposit |
| W02 | Capital return priority | 100% |
| W03 | Investor profit share | 85% |
| W04 | COMO profit share | 15% |
| W05 | Developer fee | F01+F02 = 5% |
| W06 | Loss handling | No Developer Profit |

### Financing (R codes)
| Code | Description | Value |
|------|-------------|-------|
| R01 | Shortfall funding | Automatic Investor Contributions |
| R04 | Annual discount rate | 10% |
| R05 | Target IRR | 15% |
| R06 | Bank financing | No |

### Scenarios (X codes)
| Code | Description | Value |
|------|-------------|-------|
| X01 | Selected scenario | Base |
| X02 | Sales price factor | 1 (100%) |
| X03 | Sales speed factor | 1 (100%) |
| X04 | Construction cost factor | 1 (100%) |
| X05 | Construction delay | 0 months |
| X06 | Other fees factor | 1 (100%) |

---

## UNIT MIX (Project 1)
| Type ID | Use | Name | Units | Avg Area | Price/sqft | Revenue |
|---------|-----|------|-------|----------|------------|---------|
| RES1 | RES | 1 BR Apartment | 47 | 750 | 1,550 | 54.6M |
| RES2 | RES | 2 BR Apartment | 26 | 1,300 | 1,500 | 50.7M |
| RES3 | RES | 3 BR Apartment | 12 | 1,660 | 1,450 | 28.9M |
| RET1 | RET | Retail Small | 26 | 850 | 3,000 | 66.3M |
| RET2 | RET | Retail Medium | 19 | 1,200 | 2,500 | 57.0M |
| RET3 | RET | Retail Large | 6 | 2,500 | 2,000 | 30.0M |
| OFF1 | OFF | Office Small | 51 | 1,200 | 1,900 | 116.3M |
| OFF2 | OFF | Office Medium | 28 | 3,690 | 1,800 | 186.0M |
| OFF3 | OFF | Office Large | 18 | 7,500 | 1,700 | 229.5M |

**Total Units: 233, Total Revenue: ~819M AED**

---

## PAYMENT PLAN (PLAN-A for Project 1, Slot 2)
| Milestone | Trigger | Months | Payment % |
|-----------|---------|--------|-----------|
| PM01 | At Signing | 0 | 10% |
| PM02 | 1 Month After Signing | 1 | 10% |
| PM03 | 6 Months After Signing | 6 | 10% |
| PM04 | 12 Months After Signing | 12 | 10% |
| PM05 | 18 Months After Signing | 18 | 10% |
| PM06 | 24 Months After Signing | 24 | 10% |
| PM07 | At Handover | handover | 40% |
| **Total** | | | **100%** |

---

## CURVES (Monthly Distribution)

### Off-Plan Sales Curve (S1-S60)
First 8 months: 8%, 12%, 14%, 16%, 14%, 10%, 8%, 6%, 4%, 4%, 2%, 2% = 100%
(bell-shaped, peaks at month 4)

### Post-Completion Sales Curve (P1-P36)
Distributed over T09 months (11 months)

### Construction Curve (C1-C60)
30 months: 1.2%, 1.3%, 2%, 2.5%, 3%, 3.5%, 3%, 3.5%, 4%, 4%, 4.5%, 4.5%, 4.5%, 4%, 4%, 3.5%, 3.5%, 3.5%, 3.5%, 3.5%, 3.5%, 3.5%, 3.5%, 3.5%, 3.5%, 3%, 3%, 3%, 2%, 2% = 100%
(ramp-up, plateau, ramp-down)

### Design Fee Curve (D1-D24)
8 months: 17.5%, 7.5%, 20%, 17.5%, 17.5%, 10%, 5%, 5% = 100%

### Marketing Curve (M1-M60)
Uniform ~6-7% per month over campaign window

---

## COST NODES (Project 1 — Active Nodes)
| Node ID | Name | Category | Basis | Rate/Amount | Funding | Timing |
|---------|------|----------|-------|-------------|---------|--------|
| LAND | Land Purchase | Land | Land Area × Rate | 260.60/sqft | Investor | Land Purchase Date |
| LAND_REG | Land Registration | Government | % of Land | 4% | Investor | Land Purchase Date |
| LAND_BROKER | Land Broker | Sales | % of Land | 1% | Investor | Land Purchase Date |
| DESIGN_MAIN | Design Consultant | Design | % of Construction | 3% | Investor | Design Curve |
| SUPERVISION | Supervision | Design | % of Construction | 1.5% | Investor | Construction Progress |
| SOIL_TEST | Soil Testing | Design | Fixed | 45,000 | Investor | Design Month 1 |
| TOPO | Topographic Survey | Design | Fixed | 12,000 | Investor | Design Month 1 |
| SURVEYOR | Surveyor Fees | Design | Fixed | 35,000 | Investor | Design Month 1 |
| NOC | NOC Certificate | Government | Fixed | 15,000 | Investor | Approval Month 1 |
| RERA_REG | RERA Registration | Government | Fixed | 50,000 | Investor | Approval Month 1 |
| ESCROW_SETUP | Escrow Account Setup | Government | Fixed | 10,000 | Investor | Sales Approval Month |
| BANK_FEES | Bank Fees | Government | Fixed | 35,000 | Investor | Construction Month 1 |
| RERA_AUDIT | RERA Auditor Report | Government | Fixed | 24,000 | Escrow | Construction Month 12 |
| RERA_INSPECT | RERA Inspection | Government | Fixed | 150,000 | Escrow | Construction Month 18 |
| OFFPLAN_COMM | Off-Plan Commission | Sales | % of Off-Plan Sales | 5% | Escrow | Buyer Collection Threshold 20% |
| POST_COMM | Post-Completion Commission | Sales | % of Post Sales | 5% | Investor | Sale Month |
| MARKETING | Marketing | Sales | % of Total Sales | 2% | Investor | Marketing Curve |
| DEV_DESIGN | Developer Fee Design | Sales | % of Total Sales | 2% | Investor | Design Phase Equal |
| DEV_SUPERV | Developer Fee Supervision | Sales | % of Total Sales | 3% | Investor | Construction Phase Equal |
| CONTRACT_ADV | Contractor Advance | Construction | 10% of Construction | 10% | Investor | Construction Month 1 |
| CONTRACT_PROGRESS | Contractor Progress | Construction | 80% of Construction | 80% | Escrow | Construction Progress Lagged |
| RETENTION_ESC | First Retention | Construction | 5% of Construction | 5% | Escrow | Post-Completion Month 2 |
| RETENTION_INV | Final Retention | Construction | 5% of Construction | 5% | Investor | Post-Completion Month 13 |

---

## CALC ENGINE LOGIC (Key Formulas)

### Timeline Counters
- Design month: counts 1..T01 during design phase
- Construction month: counts 1..T02 during construction
- Post-completion month: counts from completion forward
- Sales month: counts from T12+T05 forward
- Campaign month: counts from T12+T06 forward (window ends at completion+12)
- Approvals: flag=1 at T12+T03, flag=2 at T12+T03+1
- Handover: flag at construction end + T07
- First release: flag at completion + T10
- Final release: flag at completion + T11

### Sales Calculation
```
Off-plan sales[month] = Base Sales × S01 × (1+S07) × X02 × 
    IF(salesMonth > 0, curve[salesMonth], 0)
Post-completion sales[month] = Base Sales × S02 × (1+S08) × X02 × 
    IF(postCompMonth > 0, postCurve[postCompMonth], 0)
```

### Payment Plan Collections (Cohort Logic)
For each milestone in PLAN-A (15 milestones per plan):
```
Collection[month] = milestone.payment% × 
  IF trigger="Months After Signing":
    SUM of sales from month where (currentMonth - saleMonth) = triggerValue
    + IF "Accelerate to Pre-Handover" AND handover month: 
      all remaining uncollected from that cohort
  IF trigger="Handover":
    SUM of all sales up to handover month (paid at handover)
  IF trigger="Completion Threshold":
    IF cumProgress >= threshold: all sales to date
```

### Escrow Account
```
Inflows = buyer off-plan collections × E03 + refundable deposit + shortfall funding
Outflows = eligible project costs (nodes with Funding="Escrow")
Balance = previous balance + inflows - outflows
Regulatory retention = E05 × expected off-plan sales
First release = balance - retention (at completion + E07)
Final release = remaining balance (at completion + E08)
```

### Investor Cash Flow
```
Contributions = investor-funded costs + escrow deposit + shortfall funding
Direct collections = post-completion sales (if S14="Investor")
Distributable cash = escrow releases + direct collections
Capital return = MIN(distributable, unreturned capital) × W02
Remaining profit = distributable - capital return
Investor profit = remaining × W03 (85%)
COMO profit = remaining × W04 (15%)
```

### Waterfall
```
1. Return 100% of investor capital first (W02=100%)
2. Remaining profit split: 85% investor (W03) / 15% COMO (W04)
3. Developer fees (F01+F02=5%) paid as project expense, not from waterfall
```

---

## WEB APP REPORTS NEEDED (User's Request)

1. **Feasibility Study**: Total revenue, total costs, net profit, ROI on capital, ROI on total cost, IRR
2. **Cash Flow - Escrow**: Monthly escrow account (inflows, outflows, retention, releases, balance)
3. **Cash Flow - Investor**: Monthly investor account (contributions, distributions, net flow)
4. **Project Schedule**: Timeline with phase markers (design, approvals, marketing, sales, construction, handover, releases)
5. **General Cash Flows**: Consolidated sources & uses

---

## WEB APP INPUT PAGES

### Owner's Input Page (all parameters):
- Project identity (P codes)
- Timeline (T codes)
- Land & area (A/L codes)
- Construction (C codes, cost rate)
- Design consultants (D codes)
- Escrow rules (E codes)
- Waterfall (W codes)
- Financing (R codes)
- Scenarios (X codes)
- Unit mix (types, areas, pricing)
- Cost nodes (40 per project)
- Construction curve
- Design fee curve

### Wael's Input Page (sales & marketing only):
- S01-S14: Sales parameters
- M01-M09: Marketing parameters
- B01-B05: Payment plan parameters
- Off-plan sales curve (S1-S60)
- Post-completion sales curve (P1-P36)
- Marketing distribution curve (M1-M60)
- Payment plan milestones (up to 3 plans × 15 milestones)
- Sees results: monthly sales, collections, marketing spend
