# Majan Source Findings

## Owner-approved rule

- The investor pays land, direct investor costs, the escrow deposit, and final contractor retention.
- Pre-completion off-plan sales follow the saved buyer payment-plan recipient; escrow-funded costs are paid by escrow.
- First escrow close transfers the actual available balance while retaining only 5% of escrow-channel sales receipts.
- Month 13 transfers the full sales retention to the investor. Final contractor retention remains a separate investor debit.
- Unsold units sold after completion credit the investor directly; their broker commission is paid first, capital is recovered, then realised surplus is split 15% COMO / 85% investor.
- No feasibility plug, manual hardcode, or rounding adjustment may be used to force reconciliation.

## Live Majan source records (project id 2, approved Wael plan id 1)

| Source fact | Value |
|---|---:|
| Project units from Project Card | 209 |
| Units in saved off-plan `salesDistribution` | 167 |
| Unsold post-completion units | 42 |
| Saved off-plan percentage | 80% |
| Saved escrow-channel buyer receipts | AED 580,159,238.5167462 |
| Saved investor-channel receipts for sold off-plan units | AED 0 |
| Escrow receipts after construction | AED 347,400.7416267943 |
| Traceable unsold-unit revenue (42 / 209 × project revenue) | AED 145,908,311.4832536 |
| Saved post-completion direct-sales setting | Start month 4; 6 receipts |
| Saved marketing distribution total | AED 14,514,920 |
| Project Card marketing budget (2% of revenue) | AED 14,521,351 |

The AED 347,400.7416267943 received after construction belongs to the saved escrow channel because all four saved payment stages for the 167 sold units have recipient `escrow`. It must not be reclassified merely because its receipt date is after construction.

The direct-sale forecast is traceable from 42 unsold units and the saved direct-sales schedule. It must be calculated from unsold units and average unit price, not as an unexplained `totalRevenue - receipts` balancing plug.

The marketing discrepancy is AED 6,431. The Sales page labels the saved values as distribution of the Project Card marketing budget. The corrective design should make the adapter treat them as timing weights for the current Project Card budget, not normalize totals invisibly inside the investor cash-flow engine.

## Corrected Majan reconciliation

| Verified movement | Amount (AED) |
|---|---:|
| Saved escrow-channel buyer receipts | 580,159,238.5167462 |
| Traceable revenue of 42 unsold units | 145,908,311.4832536 |
| Total source revenue | 726,067,549.9999998 |
| First escrow release | 288,273,113.32507145 |
| Full month-13 sales-retention release | 29,007,961.92583731 |
| Separate final contractor-retention debit | 17,000,000.10 |
| Direct-sale broker commission | 7,295,415.57416268 |
| COMO realised-profit share | 19,866,318.487049885 |
| Final investor profit | 112,575,804.7599498 |

All five live-data acceptance checks passed within AED 0.001: source revenue, investor profit, COMO share, zero escrow closing balance, and preservation of the saved escrow receipt that arrives after construction.

The authenticated owner screenshot supplied before this correction displayed the same rounded investor totals (required AED 350,613,582; received AED 463,189,387; net AED 112,575,805). Anonymous preview sessions do not load protected project/plan queries and therefore show default-model figures; those figures were excluded from financial verification. Desktop and mobile preview checks were used only for render/layout regression, not as financial evidence.
