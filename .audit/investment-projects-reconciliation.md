# Investor Cash Flow vs Feasibility Reconciliation

**Audit date:** 2026-08-26  
**Tolerance:** AED 0.001 (one fils)  
**Excluded project:** مركز مجان التجاري (G+4), because its financing scenario is `build_for_rent`.

The audit compares the final signed Investor Cash Flow result with the investor-profit result used by the Feasibility Study. Required capital is the maximum cumulative investor deficit, not the sum of all investor debits over the project life.

| Project | Scenario | Required Capital | Paid Before | Remaining Funding | Lifetime Debits | Investor Receipts | Investor Profit | Feasibility Investor Profit | Difference |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| مجان متعدد الاستخدامات (G+4P+25) | Off-plan escrow | 306,451,847.813 | 128,100,000.000 | 178,351,847.813 | 350,613,581.974 | 463,189,386.734 | 112,575,804.760 | 112,575,804.760 | -0.000000179 |
| مبنى الجداف السكني (G+7) | Off-plan escrow | 38,857,206.150 | 16,275,000.000 | 22,582,206.150 | 42,680,315.228 | 51,849,600.000 | 9,169,284.772 | 9,169,284.772 | -0.000000002 |
| ند الشبا — قطعة 1 (6185392) | Off-plan escrow | 41,572,741.990 | 18,900,000.000 | 22,672,741.990 | 44,958,665.111 | 51,517,180.800 | 6,558,515.689 | 6,558,515.689 | 0.000000034 |
| ند الشبا — قطعة 2 المدمجة (6182776) | Off-plan escrow | 55,415,431.613 | 14,542,500.000 | 40,872,931.613 | 63,821,657.621 | 88,223,605.000 | 24,401,947.379 | 24,401,947.379 | 0.000000022 |
| ند الشبا — قطعة 3 الفلل (6180578) | Build for sale | 24,153,325.807 | 6,533,100.000 | 17,620,225.807 | 30,486,403.360 | 42,558,600.000 | 12,072,196.640 | 12,072,196.640 | -0.000000004 |

## Verified Controls

| Control | Result |
| --- | --- |
| Source revenue reconciles to project revenue | Passed for all five projects |
| Investor profit reconciles to Feasibility Study | Passed for all five projects |
| COMO share reconciles to 15% of realised project profit | Passed for all five projects |
| Escrow closes to zero | Passed for all four off-plan projects |
| Buyer instalments received after first escrow closure remain in escrow and transfer at month 13 | Passed |
| Build-for-sale project is tested without escrow | Passed |

## Correction Applied

Nad Al Sheba Plot 2 received buyer instalments in escrow after the first closure. The previous month-13 transfer released only the fixed 5% retained-sales amount and left AED 3,671,737.349 in escrow. The shared settlement now transfers the greater of the protected 5% retention or the complete actual balance remaining at month 13. Contractor final retention remains a separate investor debit and is not deducted from the escrow transfer.

For the build-for-sale villas, the audit comparison now uses the same cost basis as the Feasibility Study: Investor Cash Flow cost rows for `build_for_sale`, rather than the off-plan project-cost basis. No production financial formula was changed for the villas.
