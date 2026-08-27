# Return Navigation Audit

## Scope completed — 2026-08-27

The Command Center and financial-report return paths were audited as the first segment of the wider application review.

| Route / flow | Finding before change | Current rule | Validation |
|---|---|---|---|
| Command Center → Unified Group Cash Flow | The report link had no declared return source. | The link carries `returnTo=/command-center`; the report return control resolves that in-app path. | Source-contract test and responsive report header check. |
| Financial Studies guide → a study card | The active-tab control only cleared local state, so external entry points could land on the guide rather than the actual opener. | Each card carries `returnTo=/bateekha`; a direct report link can instead carry its own immediate source. | Unit contract test and desktop/mobile report-header check. |
| Investor Cash Flow / Escrow / Feasibility / Capital Portfolio | Standalone controls used fixed destinations or, for feasibility, no visible return control. | Each standalone screen now resolves a safe `returnTo` with a local fallback; the guide embeds Escrow, so it cannot bypass the guide’s return. | Unit contract test and mobile screenshots. |
| Wael Sales → Payment Plan | Opening payment-plan lost the sales-screen context. The payment-plan empty state had no return control. | The plan receives the sales page as `returnTo` and shows a return control with or without a selected project. | Unit contract test and mobile screenshot. |

## Live Command Center confirmation

The authenticated sandbox session successfully opened the Command Center reports panel and pressed its visible return arrow. It returned directly to the Command Center landing screen.

The later attempt to open the Payment Requests card redirected to the external Manus sign-in route for that separate protected feature. No data was changed, and its nested return button could not be exercised in this session. This is an authentication boundary, not a redirect produced by the new financial navigation code.

## Guardrails

`resolveReturnPath` accepts only an in-application relative path and rejects external or protocol-relative values. Direct URL entry therefore uses the page’s local fallback rather than navigating to an untrusted address.
