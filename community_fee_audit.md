# Community Fee Settings Audit

For the Majan project, Settings and Rules saves `communityFeePerSqft` and `communityFeeFrequency` under `constructionScheduleJson.settings.configurableRates`. The shared Investor Cash Flow engine currently calculates community fees using its internal defaults: AED 0.25 per square foot and a six-month frequency.

The Investor Cash Flow browser report shows AED 117K in months 1, 7, 13, 19, 25, 31, and 37, which matches the default formula for the project GFA. The report does not currently receive the per-project saved configurable rates. Community fees are classified as investor-funded and are intentionally not shown as an Escrow Cash Flow outflow.
