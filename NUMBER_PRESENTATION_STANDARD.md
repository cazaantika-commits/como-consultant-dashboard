# Application-Wide Number Presentation Standard

## Approved display rule

All financial amounts and measurable values are displayed in full with English thousands separators. The application must not abbreviate values using `K`, `M`, `ك`, `م`, «ألف»، or «مليون».

| Stored value | Display value |
|---:|---:|
| `122000000.00` | `122,000,000` |
| `28000000` | `28,000,000` |
| `456000` | `456,000` |
| `1.415` | `1.415` |
| `755555.56` | `755,555.56` |

The formatter is presentation-only. Stored input strings retain all meaningful decimal digits, while calculated JavaScript numbers retain up to two meaningful decimal places and suppress trailing zeroes. This avoids exposing floating-point calculation noise such as `112,703,670.20129998`. Edit fields continue to use raw values without grouping characters, and all calculations, saved values, and report sources remain unchanged.

## Live verification note

The first live feasibility pass confirmed that full amounts replaced the prohibited abbreviations, and also revealed raw JavaScript floating-point tails in calculated values. The shared formatter was corrected before acceptance so calculated values display cleanly—for example, `112,703,670.2` rather than `112,703,670.20129998`—while stored input rates such as `1.415` remain exact.

After the correction, the live Majan Feasibility Study displayed `112,703,670.2`, `305,996,317.38`, and `593,153,846.82` without `M`, `K`, «م»، or «ك». The land-price input remained `122,000,000`, and the stored design rate remained `1.4`.

The live Command Center briefing likewise displayed full four-month portfolio amounts, including `30,515,202.98` required from investors and `10,591,274.75` for the December peak. No compact amount label appeared in the executive summary or monthly driver cards.

The Financial Studies entry selector was then used to restore Majan as the selected project before checking a project-level cash-flow report. Selection remains a navigation context only; it does not change any displayed amount or calculation.

The live Majan Investor Cash Flow report then displayed full grouped totals such as `202,153,781.48`, `462,151,848.5`, and `259,998,067.02`, with full monthly figures such as `71,696,416.54` and `288,007,437.21`. No amount appeared as `M`, `K`, «م»، «ك»، «مليون»، or «ألف».

The live Majan Escrow Cash Flow report displayed full grouped liquidity values including `647,902,626.24` in inflows and outflows, `336,375,321.53` as the highest balance, and `27,462,912.46` as the minimum operating balance. Its detailed monthly table also stayed in full numbers; no compact financial label remained.

## Financial display scope

The audit found compact amount helpers in the project-input, construction, capital scheduling, cash-flow comparison/reflection, investor capital plan, feasibility, escrow, capital portfolio, and Sheikh Issa executive alert surfaces. These are the first report surfaces to be migrated to the shared full-number formatter. Non-financial units and ordinary percentages retain their current semantics, but any meaningful decimal digit remains visible.
