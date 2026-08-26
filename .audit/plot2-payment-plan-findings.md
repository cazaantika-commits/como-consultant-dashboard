# Nad Al Sheba Plot 2 — Payment Plan Audit

**Audit date:** 2026-08-26  
**Project:** ند الشبا — قطعة 2 المدمجة (6182776)  
**Saved plan:** 60003  
**Data changes performed:** None

## Current Saved Payment Calendar

| # | Payment | Percentage | Date | Recipient |
| ---: | --- | ---: | --- | --- |
| 1 | دفعة الحجز | 10% | 2027-05 | Escrow |
| 2 | دفعة توقيع العقد | 10% | 2027-06 | Escrow |
| 3 | قسط الإنشاء 1 | 10% | 2027-09 | Escrow |
| 4 | قسط الإنشاء 2 | 10% | 2028-01 | Escrow |
| 5 | قسط الإنشاء 3 | 10% | 2028-05 | Escrow |
| 6 | قسط الإنشاء 4 | 10% | 2028-09 | Escrow |
| 7 | دفعة التسليم | 40% | 2028-11 | Escrow |

The calendar totals 100%, finishes at handover, and passes the current calendar validation with no issues.

## Proven Mismatch

The project currently starts sales in project month 8 and hands over in month 26, so the valid off-plan sales window contains 19 months. The saved `results_json.salesDistribution` contains 20 months and includes one unit sold in month 27, after handover.

Rebuilding buyer collections from the current `payment_plan_json` produces only one post-handover receipt in month 27 (AED 1,835,868.675) and no receipts after the first escrow closure. The saved `results_json`, however, still contains receipts through month 34, including five AED 734,347.470 instalments after the first closure.

The cause is architectural: `savePaymentCalendar` updates only `payment_plan_json`; it does not rebuild or invalidate `results_json`. Downstream financial reports currently consume the stale saved receipt arrays. The visible Payment Plan and the Investor/Escrow cash flows can therefore represent different payment schedules.

## Conclusion

The seven-row payment calendar itself does not require manual re-entry. The derived sales distribution and cash-inflow arrays require regeneration from the current calendar and current project timing. Because the project is saved as 100% off-plan, its sales distribution must fit within months 8–26; no off-plan unit should remain in month 27. The earlier month-13 escrow sweep is not the correct root-cause fix and must not be relied upon once the receipt arrays are regenerated.

## Resolution Applied

The save contract now rebuilds receipt results from the current payment calendar, invalidates stale arrays, and returns the scenario to draft for Wael review. Nad Al Sheba Plot 2 was regenerated from its saved calendar: 83 units over months 8–26, AED 152,377,100 total receipts, and zero escrow receipts after handover. The balancing month-13 sweep was removed; month 13 transfers only the retained 5% sales amount.

Post-fix reconciliation is within one fils: investor profit AED 24,401,947.379375 versus feasibility AED 24,401,947.379375; COMO share AED 4,306,226.008125; ending escrow balance approximately AED 0.000000001. The targeted payment-plan and financial regression suite passed 102/102 tests.
