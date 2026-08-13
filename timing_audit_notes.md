# Settings-Driven Timing Audit — Majan G+4P+25

Verified in the development browser on 13 August 2026 using **مجان متعدد الاستخدامات (G+4P+25)**, with a seven-month design schedule and thirty-month construction duration.

| Item | Verified result | Source relationship |
| --- | --- | --- |
| Schematic completion | Design month 3 | Derived from the first three saved design-stage durations (10 weeks, rounded to 3 months). |
| Marketing materials | Months 4–5 | Begins immediately after schematic completion; two-month saved preparation duration. |
| RERA approval | Months 5–6 | Begins one month after schematic completion and uses the saved two-month approval duration. |
| Marketing launch | Month 6 | Begins immediately after materials preparation ends. |
| Sales start | Month 8 | Begins one month after the saved RERA approval phase ends. |
| Construction start | Month 8 | Begins one month after the saved design phase ends. |
| RERA registration, unit registration and escrow-account opening | Design month 6 | The Investor Cash Flow displays all three in the final saved RERA approval month. |
| Escrow deposit | Design month 6 | The Investor Cash Flow displays the AED 81.0M deposit in the final saved RERA approval month. |
| Bank fees | Begin in design month 6 and continue through construction | The Investor Cash Flow displays AED 875 per month from the final saved RERA approval month to project completion. |
| Marketing fallback distribution | Begins in design month 6 | The Investor Cash Flow starts the fallback marketing distribution in the Settings-derived marketing launch month. |

The visible Investor Cash Flow table and Timeline therefore use the same Settings-driven timing milestones for this project.

## RERA Expense-Timing Audit — 13 August 2026

Browser inspection of Majan’s **Settings and Rules** confirmed that the RERA phase remains configured with a saved two-month duration. The payment-rule table already describes sorting fees and the developer NOC as due in RERA month 1, and unit registration, escrow deposit, and bank-fee start as due in RERA month 2. However, it still describes **project registration — RERA** as due in month 2. This conflicts with the approved rule that project registration belongs in RERA month 1, so the display text and the matching Investor Cash Flow row require correction before the audit can be closed.

After correction and browser reload, the Settings payment-rule table lists the approved schedule. The Majan Investor Cash Flow confirms it with actual values: design month 5 contains sorting fees (AED 18.7M), developer NOC (AED 10K), and project registration — RERA (AED 150K); design month 6 contains unit registration (AED 133K), escrow-account opening (AED 180K), and the 20% escrow deposit (AED 81.0M). Bank fees begin in month 6 at AED 875 per month.

## Timeline Activity-Window Audit — 13 August 2026

The Majan project was reopened in the browser for verification after replacing the fixed-to-project-end marketing and sales bars with saved Marketing-page and Sales-plan activity windows. The project context confirms the same saved seven-month design duration and thirty-month construction duration used by the timing rules.

Browser verification confirms that the Timeline now shows **Marketing: month 6–22** and labels its source as **Marketing page**. The Marketing page shows the identical saved period, month **6 → 22**, with seventeen months of entered monthly allocations totaling AED 16,091,064. The Timeline no longer extends the marketing bar mechanically to the end of construction.

The Sales page shows the saved sales distribution beginning in month 8 and ending in month 25; months 26–37 have zero units. After correction, both the Sales page’s internal timeline and the main Timeline display **Sales: month 8–25** and identify the source as **Sales Plan**. They also display the same Settings-driven design duration (seven months), materials phase (months 4–5), RERA phase (months 5–6), and construction phase (months 8–37).

## Deferred Escrow Contractor Certificates — 13 August 2026

The Majan project was reopened for the contractor-payment timing audit. General Inputs confirms the saved construction duration is thirty months and the construction value is AED 405,000,000. The next verification compares the saved Construction-page monthly progress with the shifted escrow-funded certificate row.

Browser verification confirms the approved relationship. In the Construction page, month 1 contains the AED 40.5M investor-funded advance; the first work-progress certificate is AED 14.6M in construction month 2. In Escrow Cash Flow, the row **“مستخلصات المقاول (80% — بعد شهر من الإنجاز)”** is blank in construction month 1 and shows AED 14.6M in construction month 2, followed by the same deferred sequence across the remaining construction months. The rule also assigns the final construction-month certificate to post-completion month 1, as covered by the new regression test.

## RERA Auditor and Inspection Fees — 13 August 2026

The audit found a previous source-of-truth conflict: General Inputs displays legacy stored figures for the two RERA reports, while Settings defines a per-quarter payment rate and Escrow Cash Flow computes a quarterly schedule. The calculation was corrected so Feasibility Study and Escrow Cash Flow now use the saved Settings rate multiplied by `ceil(construction months ÷ 3)`. For Majan, the construction duration is thirty months, so there must be ten quarterly payments for each report.

Browser verification of Majan’s Settings shows AED 3,500 per quarterly auditor report and AED 15,020 per quarterly inspection. With ten payments, the expected totals are AED 35,000 and AED 150,200. The active Feasibility Study now displays exactly **AED 35,000** for “تقرير مدقق ريرا” and **AED 150,200** for “تقارير فحص ريرا”.

Escrow Cash Flow displays ten quarterly auditor payments of AED 3,500 (shown compactly as 4K) and ten quarterly inspection payments of AED 15,020 (shown compactly as 15K), starting from construction month 1 and repeating every three months through month 28. General Inputs now also displays the calculated totals AED 35,000 and AED 150,200 as read-only values, rather than the former legacy stored figures.
