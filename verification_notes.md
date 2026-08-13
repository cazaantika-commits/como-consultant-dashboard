# Financial Studies Verification Notes

## Active browser verification — Majan Mixed-Use (G+4P+25)

On 12 August 2026, the development build accepted and stored a controlled Sales Plan save for project ID `2`. The saved plan used a valid 100% payment plan: first payment `11%`, second payment `10%`, four installments of `10%`, and handover `39%`. The first two saved monthly sales allocations were `6` and `9` units, preserving the total off-plan sales allocation.

The `wael_sales_plans` record was confirmed in the database immediately after the browser save with the same monthly allocations and payment percentages. After page reload, the Sales Plan displayed those same values. The Escrow Cash Flow page showed the corresponding off-plan buyer-payment row beginning with approximately `2.1M` and `3.1M`, matching the Sales Plan cash-inflow values rounded for display.

This note records observed verification data only; final acceptance still requires the full month-by-month comparison and escrow-closing-balance check.

## Active browser verification — Commercial Center, Build-for-Rent

On 13 August 2026, the authenticated preview was opened at `/bateekha` with **مركز مجان التجاري (G+4)** selected. The General Inputs page displayed the build-for-rent notice and the two developer-fee controls before editing: **1.5%** for design and **2.5%** for supervision, both explicitly defined as percentages of construction cost.

The project-type-aware navigation displayed only General Inputs, Unit Distribution, Construction, Investor Cash Flow, and Feasibility Study. Sales, Marketing, Timeline, Settings, and Escrow Cash Flow were not displayed for this project type.

For the required persistence check, edit mode was opened and the design developer-fee rate was changed from `1.5%` to `1.6%`. The page confirmed **تم الحفظ ✓**, and a full browser reload showed the persisted `1.6%` value. The approved `1.5%` design rate was then restored in edit mode and saved with a second **تم الحفظ ✓** confirmation. A final browser reload confirmed the approved settings now persist as **1.5% design** and **2.5% supervision**.

The Investor Cash Flow report was then opened. It showed no sales, marketing, commission, revenue, or escrow rows, and showed zero revenue in the summary. Its developer-fee row is consistent with construction cost of AED 360,000,000: AED 771,429 in each of seven design months (AED 5,400,000 total = 1.5%) and AED 300,000 in each of 30 construction months (AED 9,000,000 total = 2.5%).

The Feasibility Study was opened as a build-for-rent cost study. It showed AED 486,606,904 total cost and required capital, no revenue/rent, AED 14,400,000 developer fee, investor-funded costs only, and no escrow funding. It also revealed one remaining display inconsistency: the project-details card still labels developer fees as `3.00%`, although the verified cost is 4.00% of construction cost. This display field requires correction before final acceptance.

The feasibility display was corrected and rechecked in the authenticated browser. It now identifies the developer-fee rule as **4.00% of construction cost (1.5% + 2.5%)**, states that build-for-rent has no escrow account, displays investor-only funding, and replaces sale-based per-square-foot metrics with build-for-rent cost indicators. The feasibility developer fee (AED 14,400,000) and total costs (AED 486,606,904) match the Investor Cash Flow report.
