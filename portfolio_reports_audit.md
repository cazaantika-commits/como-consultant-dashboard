# Portfolio Reports Audit

## Scope

This audit covers the three Financial Studies portfolio reports: **Project Aggregation**, **Month-First Investor Flows**, and **Capital Portfolio**. The objective is to establish that report values originate from the same saved Financial Studies inputs, preserve real calendar months, and reconcile by project.

## Calendar-flow reports: source contract

| Report | Display orientation | Source procedure | Final project row | Calendar and totals rule |
|---|---|---|---|---|
| Project Aggregation | Projects as rows, periods as columns | `getPortfolioInvestorNetCashFlows` | Signed `صافي الشهر` from Investor Cash Flow | Align by actual `monthDates`, then sum selected project values per named month or group |
| Month-First Investor Flows | Months as rows, projects as columns | `getPortfolioInvestorNetCashFlows` | The same signed `صافي الشهر` row | Uses the same alignment and grouping utility, transposed only for presentation |

The server procedure reads the latest saved Sales Plan for each project, passes it to the current Investor Cash Flow engine, then uses `calculateInvestorMonthlyNet`. A negative final value represents required investor funding; a positive final value represents an investor receipt. Therefore, the two calendar-flow reports do not maintain a second calculation path.

## Calendar-flow audit finding

The shared aggregation utility preserves all real intervening calendar months, aligns different project start dates, and derives each grouped period and final total directly from the displayed project rows. Existing regression coverage verifies adjacent-month grouping, signed values, and selected-project totals.

## Follow-up items

1. Audit each Capital Portfolio project row against Sales Pricing revenue, Feasibility total cost, and Investor Cash Flow capital.
2. Restore the approved Capital Portfolio revenue visibility for every eligible project without removing its existing columns.
3. Complete browser verification and export reconciliation after the corrections.

## Capital Portfolio finding: villa revenue visibility

The live Capital Portfolio summary includes AED 1,039.2M of total revenue and the villa project is included as an eligible build-for-sale project. Its saved Sales Pricing inputs are 4 villas × 4,900 square feet × AED 3,800 per square foot, which equals AED 74.48M. The Capital Portfolio source procedure calculates `totalRevenue` from the shared Financial Studies cost calculator, which uses those same saved Pricing fields.

However, the detailed Capital Portfolio table currently has no **project revenue** column. It displays project, scenario, total cost, capital, paid, remaining capital, monthly funding, and total only. The absence of the revenue column makes the villa revenue invisible at project-row level, even though the report has a total-revenue summary. This is a confirmed display defect, not an alternative Sales Pricing source.

## Capital Portfolio audit: current report checks

| Audit point | Result | Evidence |
|---|---|---|
| Build-for-rent exclusion | Pass | The live report displays five eligible investment projects and excludes the commercial build-for-rent project from revenue and profit metrics. |
| Revenue, cost, and profit summary relation | Pass | The live summary is AED 1,039.2M revenue, AED 891.8M cost, and AED 147.3M profit before developer share; the profit is the displayed difference subject to display rounding. |
| Capital split | Pass | AED 466.7M required capital is displayed as AED 184.4M paid plus AED 282.3M remaining, subject to display rounding. |
| Villa Sales Pricing source | Pass | Saved villa Pricing inputs produce AED 74.48M total revenue. The Capital Portfolio source reads the same project pricing fields through the shared feasibility cost calculator. |
| Villa revenue visibility in detail table | Fail | The project row omits a revenue column entirely. |
| Monthly funding row meaning | Needs clarification in presentation | Monthly columns show gross future investor funding requirements, while the `remaining capital` column is net peak liquidity after future investor credits. The current final column is therefore not guaranteed to equal `remaining capital` and must be explicitly labeled as total future funding rather than an ambiguous total. |

## Nad Al Sheba plot 1 zero-revenue audit

The Capital Portfolio row for **Nad Al Sheba — plot 1 (6185392)** correctly shows zero revenue under the currently saved source data. All residential, villa, townhouse, retail, and office unit counts are zero, even though default areas and saved price-per-square-foot values exist. With no active unit count, the shared Pricing calculation produces zero revenue. This is a data-entry state rather than a disconnected Capital Portfolio calculation.
