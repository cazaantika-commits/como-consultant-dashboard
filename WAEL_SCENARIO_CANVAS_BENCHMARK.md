# Wael Scenario Canvas — Professional Interaction Benchmark

## Purpose

This note records external planning-interface patterns used to guide the next redesign of Wael's Sales and Marketing experience. It does not change the financial calculation contract. The design goal is a connected, direct-input scenario canvas rather than a table-derived report.

## Findings to apply

| Pattern | Evidence | Application to Wael's workspace |
|---|---|---|
| **One connected forecast rather than separate extracts** | Anaplan describes a single intelligent forecast connected across sales, revenue, and planning. Farseer warns that separate extracts create conflicting views. [1] [2] | Keep one saved scenario source. Price, sales timing, payment terms, marketing, collections, escrow, investor cash flow, and portfolio outputs continue to read the same data contract. |
| **Actionable scenario comparison** | Anaplan presents worst, likely, and best scenario views, while Farseer promotes direct drill-down from the metric to its driver. [1] [2] | Use large direct controls and an always-present impact panel. The user should never need a separate "effect" room to see revenue, collection, escrow pressure, and profit. |
| **Forecast means amount plus timing of receipt** | Salesforce defines a forecast around expected revenue, deal probability, and when cash will be received. [3] | Each sales month card shows units and percentage, while the impact panel immediately shows the resulting collection month, not only booked sales. |
| **Scenario inputs require a clear time horizon** | IBM describes a forecast as tied to a selected monthly, quarterly, or annual time frame and uses preview before commitment. [4] | The direct-input board presents 12 named months at once, with deliberate paging only after 12 months and an optional precision editor for the full horizon. Unsaved changes remain a draft until explicit scenario approval. |

## Design decision

The next interface should be a single **Scenario Canvas** with three persistent zones:

1. **Control strip:** Total sales target, sales pace, average price, payment plan, and marketing envelope. These are large controls with a clear current value and one obvious action.
2. **12-month interactive calendar:** Each wide month card is a direct input surface for units and percentage. Cards should be compactly spaced but numerically legible. Editing either control immediately updates the other and the scenario draft.
3. **Pinned live impact panel:** Appears adjacent to the active control or opens as a large contextual drawer. It shows revenue, collection timing, lowest escrow balance, cash shortfall/comfort, and expected profit in readable executive-scale figures. It is not a separate navigational page.

Detailed pricing, payment-plan and marketing decomposition remain accessible as progressive disclosure inside the same canvas, not as disconnected tabs that hide the financial effect.

## References

[1]: https://www.anaplan.com/use-case/sales-forecasting-software/ "Anaplan — Sales Forecasting"
[2]: https://www.farseer.com/platform/dashboards/ "Farseer — Interactive Financial Dashboards"
[3]: https://www.salesforce.com/sales/analytics/sales-forecasting-guide/ "Salesforce — Sales Forecasting Guide"
[4]: https://www.ibm.com/think/tutorials/how-to-create-sales-forecast "IBM — How to Create a Sales Forecast"
