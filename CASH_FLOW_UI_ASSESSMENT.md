# Cash-Flow Presentation Assessment

## Current structure observed

The Financial Planning section presents two distinct live reports: **Investor Cash Flow** and **Escrow Cash Flow**. Both derive their figures from the existing financial engine and saved sales-plan data; this assessment will preserve those calculations and sources.

| Screen | Current decision information | Current presentation constraint |
|---|---|---|
| Investor Cash Flow | Investor-required amounts, investor-received amounts, monthly net movement, and cumulative position | The key financial conclusions are confined to a compact header and then dispersed across a very wide detail table. |
| Escrow Cash Flow | Escrow-funded outflows, investor deposit, buyer receipts, monthly net movement, cumulative balance, and post-completion settlement | The account’s liquidity, lowest balance, settlement milestones, and closure status are not surfaced as a prominent decision layer. |

## Initial design opportunity

Both reports already contain the correct business content. The presentation can become more executive and readable by placing a concise decision strip and visual monthly balance or funding pulse **above** the retained detailed monthly table. The table remains the audit surface; the new upper layer should make the question “what is required, received, at risk, and when?” visible at a glance.

## Live browser observation — Majan mixed-use

The Investor Cash Flow browser view presents **AED 202.2M** required from the investor, **AED 462.2M** received by the investor, and **AED 260.0M** net in a thin header above a 50-month detail table. Its key decision pattern is visible only after reading a dense running balance: the cumulative position reaches about **AED -177.9M** before turning positive from the escrow settlement and direct post-completion sales.

The Escrow Cash Flow browser view presents **AED 647.9M** inflows, **AED 647.9M** outflows, and a final balance of zero. The table accurately shows the account rising from the investor deposit and buyer instalments, peaking around **AED 336.4M**, then being released through the first liquidation payment and final retention settlement. The visual hierarchy, however, does not elevate the peak balance, lowest working balance, first buyer receipt, or the two closure milestones above the dense table.

## Professional benchmark findings

| Pattern | Application to Como’s investor and escrow screens | Source |
|---|---|---|
| Show liquidity, inflows, outflows, and net position as a concise executive layer before detailed transactions | Add four high-visibility decision metrics above each existing audit table; retain the table as the traceable detail layer | [ThoughtSpot — Cash flow dashboards](https://www.thoughtspot.com/data-trends/dashboard/cash-flow-dashboard) |
| Use simple time-based visual signals to reveal movement, risk, and anomalies rather than forcing users to interpret every cell | Add an immediate monthly funding or balance pulse and visibly flag the deepest investor funding point or any escrow deficit | [ThoughtSpot — Cash flow dashboards](https://www.thoughtspot.com/data-trends/dashboard/cash-flow-dashboard) |
| Answer “how much liquidity is available, when, and what critical future flows are coming?” at the screen’s first level | Treat first buyer receipt, lowest escrow balance, investor peak-funding point, and two liquidation dates as first-level milestones | [Kyriba — Liquidity planning](https://www.kyriba.com/blog/3-ways-liquidity-planning-technology-improves-cash-flow-forecasting-results/) |
| Separate opening balance, collections, payments, and ending balance before granular transaction detail | Build a legible position path for the escrow screen: opening deposit → buyer collections → escrow payments → first release → retained balance → final release | [J.P. Morgan — Cash positioning and forecasting](https://www.jpmorgan.com/insights/treasury/treasury-management/how-to-create-cash-flow-forecasts-and-projections) |
| Keep scenario and source-traceability available alongside decisions, not instead of them | Do not touch Como’s engines or detailed rows; allow each visual metric to be reconciled to the existing monthly totals and rows | [Workday — Scenario planning](https://www.workday.com/en-us/products/adaptive-planning/financial-planning/scenario-planning.html) |

> The common professional pattern is not to remove financial detail. It is to place **decision-grade liquidity signals above the accounting-grade table**, so the user first sees funding timing, cash stress, and release milestones and then drills into the precise rows that explain them.

## Approved presentation direction

The redesign will leave every row, month, calculation, and financial rule intact. It will place a **decision canvas** above the retained detail table and establish the same narrative on both screens: “What is the financial position, when is pressure highest, and what event changes it?”

| Layer | Investor Cash Flow | Escrow Cash Flow |
|---|---|---|
| Executive position | Total required, total received, net expected return, and **peak investor funding requirement** | Total account inflow, total account outflow, **lowest operating balance**, and account-closure position |
| Timing signal | A compact monthly cash-pressure pulse and a clear label for the month of peak funding | A compact balance-path pulse that makes the deposit, buyer collections, peak balance, first settlement, retention period, and final closure identifiable |
| Decisive milestones | First investor receipt, largest investor receipt, and the month after which the investor position turns positive | First buyer collection, highest account balance, first transfer to the investor, and final retention release |
| Audit layer | The present phase-coloured monthly table, unchanged in content and sequence | The present phase-coloured monthly table, unchanged in content and sequence |

The visual treatment will use a dark executive rail for the fixed decision layer, large readable figures, phase-aware timeline marks, and a quiet light audit table beneath. Red remains reserved for a real funding deficit or required investor funding; green remains reserved for collections and healthy account balances. The design will not create a second source of truth or new inputs.

## Browser validation sequence

The verified Financial Studies route reaches the Financial Planning guide and presents the two independent live reports as before. The next checks inspect the new investor position and escrow liquidity layers using the saved Majan scenario, while retaining the underlying month-by-month audit tables.

The live Investor Cash Flow report now renders the executive position panel above its unchanged table. Browser DOM confirmation for Majan shows **AED 202.2M** total required, **AED 462.2M** total received, **AED 260.0M** expected net result, **AED 177.9M** highest cumulative funding pressure in construction month 30, first receipt in post-completion month 3, and an **AED 288.0M** largest return flow. The monthly funding/return pulse and original detailed table both remain visible.

The live Escrow Cash Flow report now renders its liquidity and settlement panel above the unchanged table. Browser verification for Majan shows **AED 647.9M** inbound and **AED 647.9M** outbound, an operating low point of **AED 27.5M** in construction month 19, a peak account balance of **AED 336.4M** in construction month 30, a healthy non-deficit status, first buyer collection in construction month 1, and the existing release amounts of **AED 288.0M** in post-completion month 3 plus **AED 29.0M** at final retention release in post-completion month 13. The report correctly states that the account is closed after settlement.
