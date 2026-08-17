# Financial Studies Verification Notes

## Villa build-for-sale timing verification — 14 August 2026

- Settings & Rules for `ند الشبا — قطعة 3 الفلل (6180578)` visibly shows the saved design source as **17 weeks ≈ 4 months**. General Inputs separately displays the same derived value: `مدة التصاميم: 4 شهر (من الإعدادات والقواعد)`.
- The Settings phase list is now restricted to design and construction for this build-for-sale project. It retains the editable seven design stages and applicable rates, including Dubai Land Department unit registration, build-for-sale marketing controls, and community fees.
- The view no longer shows RERA project registration, RERA auditor/inspection fees, escrow deposit, bank fees, the escrow rules section, or Off-Plan direct post-completion sales controls.
- The visible build-for-sale investor rules now describe the actual shared-engine timing: government fees split 10%/45%/45%, sorting/NOC/Land Department registration in the penultimate construction month, direct-sales commission after full receipt, and developer fees split 1% design / 2% construction.
- The final Timeline browser click was temporarily blocked by a My Browser extension timeout. Shared timing regression tests pass; visual Timeline confirmation remains pending once the browser session reconnects.
- After the independent build-for-sale Timeline presentation update, the focused timing, navigation, pricing, capital-portfolio, and portfolio-aggregation suite passed **21/21**. The remaining browser check is limited to confirming the live Timeline bar view after authentication is restored.


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

## Active browser verification — Nad Al Sheba Plot 3 Villas, Build-for-Sale

On 13 August 2026, authenticated access to the published Financial Studies module was restored. The project selector exposes **ند الشبا — قطعة 3 الفلل (6180578)** as the dedicated build-for-sale project; the database classification is `build_for_sale`. Detailed browser verification of its isolated navigation, sales, Investor Cash Flow, and Feasibility Study is now in progress.

The published interface loaded the project with the independent build-for-sale navigation: General Inputs, Unit Distribution, Construction, Sales, Investor Cash Flow, Feasibility Study, and Project Aggregation only. Marketing, Timeline, Settings, and Escrow Cash Flow were absent. General Inputs displayed the build-for-sale rule notice and showed the approved 3% developer fee split label (`1%` design + `2%` construction), while the off-plan RERA, escrow, bank, and quarterly RERA-report fields were not shown.

Unit Distribution confirmed four Villas at 4,900 square feet and AED 3,800 per square foot, while Townhouses and other categories remain explicitly zero. The Sales page correctly renders only the Villa sales row, AED 74,480,000 total revenue, full cash payment on each sale, direct investor receipts after completion, a 1% marketing control starting one month before completion for three months, and a 5% sales commission.

However, the same Sales page still renders a legacy **حساب الضمان (Escrow)** subsection and says that the payment-plan detail enters escrow. This is incorrect for build-for-sale and must be removed or renamed before this project type can be accepted.

The corrected implementation is available in the authenticated development preview and the focused financial regression suite passes 31/31. The project selector was reopened there to recheck the same Nad Al Sheba build-for-sale project before publishing the correction.

The corrected Sales page was verified in the authenticated development preview for Nad Al Sheba Plot 3. It now contains no Escrow panel or escrow wording. The timeline shows only design, construction, build-for-sale marketing (months 20–22, one month before completion for three months), and direct sales (months 22–24). The cash-inflow table labels months 22–24 as **ما بعد الإنجاز** and records the direct full receipts of AED 18.62M, AED 37.24M, and AED 18.62M, totaling AED 74.48M. The detailed receipt grid includes the same months and explicitly states that each yellow cell is a full, direct investor receipt.

The Investor Cash Flow correctly has no escrow row, no escrow settlement, and no off-plan RERA/bank costs. It includes the 5% commission only after full sale proceeds, 1% build-for-sale marketing split across the configured three-month period, and Como's 15% share after the final sale. However, it currently recognizes the entire AED 74.48M of sales revenue in month 22, whereas the verified Sales page distributes direct investor receipts across months 22–24. This remaining timing mismatch requires correction before accepting build-for-sale data consistency.

The root cause was identified and corrected in development: an empty build-for-sale escrow array caused Investor Cash Flow to discard the saved Sales Plan result. The parser now accepts direct-sale results without escrow data, and the shared engine uses the saved absolute-month direct receipts for both revenue and 5% commission timing. Regression coverage was added and the focused suite passes 32/32. The development-preview authentication session expired during the final browser reload and must be restored before the final visual check.

Authenticated development-preview access was restored. The Nad Al Sheba Sales page presents an explicit **حفظ خطة البيع المباشر** action alongside the verified months 22–24 direct-receipt schedule, allowing that same schedule to be saved as the shared source for Investor Cash Flow.

The direct-sale plan was saved in the browser with **تم حفظ خطة المبيعات ✓**. Investor Cash Flow was opened immediately afterward and now matches the Sales page exactly: direct revenue is AED 18.62M in month 22, AED 37.24M in month 23, and AED 18.62M in month 24; the 5% commission is AED 931K, AED 1.862M, and AED 931K in the same months; and Como's 15% share is paid only after the final receipt in month 24. No escrow row, settlement, or off-plan RERA/bank cost is present.

The Feasibility Study was then rechecked in the development preview. Its project-cost funding total now reconciles to the displayed feasibility total of AED 30,200,966 rather than incorrectly including Como's AED 6,641,855 profit share. The rendered details card visually reflects the build-for-sale developer-fee rule (1% design + 2% execution, 3% of revenue) and the financing scenario as **بناء للبيع**. A final lower-card inspection remains to confirm the no-escrow capital wording and omission of any zero-value off-plan labels.

The lower-card inspection is complete. The Feasibility Study hides the off-plan-only RERA registration, escrow, bank, auditor, and inspection rows for build-for-sale. It states that there is no escrow account and that required capital is investor-funded only. The funding card shows AED 30,200,966 as both the project-cost total and investor-funded amount, with no escrow funding source, matching the feasibility total exactly.

The build-for-sale Sales page was reopened for persistence verification. Its project-level marketing controls are present and currently show the approved configuration: 1% of revenue, starting one month before completion, for three months.

For the persistence test, the marketing rate was changed temporarily from 1% to 1.1%. The page immediately recalculated the marketing amount from AED 744,800 to AED 819,280, and the updated setting was submitted using **حفظ إعدادات التسويق**. A reload check and restoration to the approved 1% remain pending.

The Financial Studies module reloaded successfully with Nad Al Sheba Plot 3 still selected and classified as build-for-sale. The Sales page will now be reopened to confirm that the temporary 1.1% rate survived the reload before it is restored to the approved 1%.

The reload check exposed a real defect: the marketing rate reverted from the submitted 1.1% back to 1%, and the displayed marketing amount reverted from AED 819,280 back to AED 744,800. The build-for-sale marketing save path therefore does not persist the project-level settings yet; the approved 1% value remains intact while the persistence defect is corrected.

Diagnosis: the failed save was caused by a browser-side reference error in the save callback, where the payload referenced an undeclared start-month variable. The callback has been corrected and the focused regression suite remains green (32/32). The refreshed preview has loaded Nad Al Sheba Plot 3 as build-for-sale and is ready for the corrected save-and-reload retest.

For the corrected retest, the Sales page loaded with the approved 1% configuration and the rate was changed again to 1.1%. The page recalculated the displayed marketing cost to AED 819,280 and exposed the save button without a browser error. The corrected setting is ready to be submitted.

The corrected save completed successfully in the browser, confirming both **تم حفظ إعدادات تسويق البناء للبيع ✓** and the project-update confirmation. The development page was then reloaded with Nad Al Sheba Plot 3 still selected. The Sales page will be reopened once more to confirm the saved 1.1% value before it is restored to the approved 1%.

The browser session expired immediately after that reload, so the saved project record was checked directly. Its persisted settings contained `buildForSaleMarketingRate: 1.1`, with a one-month pre-completion start and three-month duration, proving the corrected browser save reached the project record. The temporary test value was then restored to the approved 1% while preserving the same saved timing settings. The next grouped browser session will confirm the restored display together with any later Financial Studies checks.

In the restored grouped browser session, Nad Al Sheba Plot 3 loaded again as build-for-sale. Opening Sales after the full reload confirmed the approved project-level configuration has been restored and is displayed as **1% of revenue**, starting **one month before completion** for **three months**. The marketing KPI returned to AED 744,800. The same page retained the direct investor receipts in months 22–24, with no escrow language or escrow panel.

The same browser session rechecked Investor Cash Flow and Feasibility Study. Investor Cash Flow shows direct sales revenue of AED 18.62M, AED 37.24M, and AED 18.62M in months 22–24 respectively; the corresponding 5% commission is AED 931K, AED 1.862M, and AED 931K; and Como's AED 6.642M profit allocation follows the final receipt only. It contains no escrow row, settlement, off-plan RERA cost, or bank cost. Feasibility shows AED 74.48M revenue, AED 30.201M project costs, AED 37.637M net investor profit, AED 24.416M required capital, investor-only project funding, and the explicit no-escrow statement. Its cost total reconciles exactly to the Investor Cash Flow project-cost funding amount.

## Current Project Aggregation page — management audit

On 13 August 2026, a read-only review of the Project Aggregation tab was started at the user's request. No data, calculations, or layout were changed. The tab was opened from the authenticated Financial Studies session and was loading; the next observation will record only what the existing page presents to management and the visible scope of its figures.

## Project Aggregation — calendar-aligned investor cash-flow rows

Browser verification on 13 August 2026 confirms that the preserved Project Aggregation layout now shows the new title “صافي التدفقات النقدية المجمّعة”, six selected project rows, and a final aggregated total row. The former fixed January-only headers have been replaced by named real calendar months beginning in August 2026 and extending through the last actual project movement (October 2030 in the active six-project selection). The page exposes the agreed monthly, 3-month, 4-month, and 6-month grouping controls plus a dedicated HTML export button. The summary cards now identify the largest required investor amount (AED 87.5M) and total returned to investors (AED 169.9M), rather than presenting a cumulative expenditure as a return.

The three-month option was then selected in the same browser session. The report condensed the same calendar timeline into adjacent real periods, beginning “أغسطس 2026 – أكتوبر 2026” and continuing without a fabricated January reset. All six project rows and the final total row remained visible. The monthly maximum requirement of AED 87.5M correctly became an AED 193.5M maximum for a three-month reporting period, confirming that the control aggregates adjacent source months rather than altering underlying project cash flows.

The six-month option was also verified. It displayed nine adjacent real periods beginning “أغسطس 2026 – يناير 2027” and ending with the shorter active final period “أغسطس 2030 – أكتوبر 2030”, while retaining all six rows and the aggregate total. The HTML export command opened a separate report window from this exact six-month view; its generated content is inspected next to ensure it mirrors the on-screen selection and grouped values.

During the amount audit, the portfolio source was corrected to reuse the exact signed “صافي الشهر” calculation from Investor Cash Flow, including the same dynamic escrow-settlement credits. Browser verification after the correction confirmed a visible legend: red is the amount required from the investor and green is the amount received by the investor. The monthly cells continue to preserve the same actual calendar months and individual project rows, while the summary metrics now follow the same signed values instead of the earlier inverted interpretation.

The corrected monthly view was refreshed once more and confirmed the signed convention in the visible page text: “الأحمر: مبلغ مطلوب من المستثمر | الأخضر: مبلغ مستلم للمستثمر.” The summary is now AED 87.5M for the largest required investor amount and AED 487.0M for total investor receipts. This is the current browser-verified interpretation of the exact Investor Cash Flow “صافي الشهر” row; the prior inverse aggregation is no longer used.

The same corrected data was verified in grouped modes. The three-month view shows adjacent periods from “أغسطس 2026 – أكتوبر 2026” onward, with a highest required total of AED 193.5M and investor receipts of AED 461.7M. The four-month view similarly uses adjacent periods from “أغسطس 2026 – نوفمبر 2026” onward, with AED 222.3M as the largest required period and AED 458.0M as total investor receipts. Both views retain all six selected projects and the final aggregate row, using the signed Investor Cash Flow convention.

The six-month signed view was then verified: it starts “أغسطس 2026 – يناير 2027”, retains all six rows, and reports AED 217.7M as the largest required period with AED 421.4M as total investor receipts. Selecting “تصدير HTML” from this exact view opened a standalone window titled “التدفقات النقدية المجمّعة”, confirming that the export action uses the active six-month selection and report state.

## New month-first investor-flow report

Authenticated browser verification on 13 August 2026 loaded the new **المحفظة الاستثمارية — العرض الشهري للتدفقات** report. It preserves six selected projects with stable colored dots, uses months as rows and projects as columns, exposes HTML and Excel controls, and includes a visible final total row. Its first live month is August 2026 and its monthly values match the Project Aggregation calendar source.

The three-month control was then verified in the same session. It grouped adjacent real periods beginning “أغسطس 2026 – أكتوبر 2026” while keeping every selected project column, the color markers, and the final aggregate column. The report reported AED 193.5M as the largest required three-month period and AED 461.7M as the grouped received amount.

The month-first report was reopened in monthly mode with all six project columns and its final total row still present. Its Excel export action was clicked from this live report state without changing the active selection or calendar view.

## New detailed Capital Portfolio report

Authenticated browser verification loaded **تقرير محفظة رأس المال** with five investment projects. The commercial-center build-for-rent project is not a selectable row, while the four Off-Plan projects and the verified build-for-sale project remain visible with stable colored dots.

The browser showed the approved top metrics from current Financial Studies sources: AED 1,118.0M revenue, AED 965.6M total cost, AED 152.4M profit before developer share, and AED 490.8M required capital split into AED 184.4M paid and AED 306.4M remaining. The detailed table retained the approved fixed column order — project, option, total cost, capital, paid, remaining, real calendar periods, final total — and includes a final aggregate row. The Excel export action was clicked from this active report state without leaving the page.

The same Capital Portfolio report was verified in its six-month grouping. It condensed the live calendar into adjacent real periods from August 2026–January 2027 through the shorter final August–October 2030 period, without removing any fixed column, project row, or final total. Selecting HTML from the active report state opened a standalone “تقرير محفظة رأس المال” report window.

## Villa build-for-sale — Settings & Rules visibility

Authenticated browser verification on 13 August 2026 confirmed that **ند الشبا — قطعة 3 الفلل (6180578)** now shows the `الإعدادات والقواعد` tab in Financial Studies. The screen loaded the seven editable design-stage week inputs and displayed the saved total **26 أسبوع ≈ 7 شهر** as the project design duration source.

## Villa build-for-sale — single-source unit pricing

Authenticated browser verification on 13 August 2026 opened **توزيع الوحدات** for the villa project. Its table now contains only unit type, count, area, total area, and parking. It has no price-per-square-foot column or input, and it explicitly states that unit price is determined exclusively from the Sales & Marketing page.

## Capital Portfolio — project revenue reconciliation

Authenticated browser verification on 13 August 2026 confirmed that the detailed Capital Portfolio table now includes **إجمالي الإيرادات** as an added project-level column while retaining all previously approved columns in their existing order. The villa build-for-sale row displays **AED 74.5M**, which is the rounded display of the Sales Pricing source: 4 villas × 4,900 square feet × AED 3,800 per square foot = AED 74.48M. The report has five eligible investment projects and correctly excludes the commercial build-for-rent project.

The browser also confirmed the current report total of AED 1,039.2M revenue, AED 891.8M cost, AED 147.3M profit before developer share, and AED 466.7M capital split into AED 184.4M paid and AED 282.3M remaining. The final monthly column is now explicitly labeled **إجمالي التمويل المطلوب**, which describes the gross future investor funding schedule rather than confusing it with net remaining capital. The updated Excel export action was triggered from this verified report state.

The updated HTML export action was also triggered from the same verified report state and opened the standalone **تقرير محفظة رأس المال** window.

## Villa build-for-sale timing source audit — 13 August 2026

The villa build-for-sale project (**ند الشبا — قطعة 3 الفلل**, ID 6) now exposes both **Settings & Rules** and **Timeline** in Financial Studies. Its currently saved `constructionScheduleJson` contains only the approved build-for-sale marketing settings and does **not** yet contain saved `designPayments` stage durations. Therefore, no user-specific design duration has been configured for this project yet; the project must be configured from Settings & Rules before any duration should be treated as final.

Code-path review confirms that Timeline uses `getProjectMarketingTiming(projectQuery.data)`, Investor Cash Flow uses the same helper through the shared engine, Feasibility uses `getProjectDesignTiming`, and Sales uses the shared timing helper when mapping saved Sales Plan data. The added build-for-sale regression proves legacy `preConMonths` is ignored once stage weeks are saved.

## Investor Cash Flow compact-row review — 17 August 2026

The Investor Cash Flow table was corrected from `py-2` vertical cell padding to compact `py-1` padding across previous-payment, investor-required, investor-received, total, net-month, and cumulative rows. Its enlarged readable type scale and the removal of non-decision subheadings remain unchanged; no engine, row, timing, or calculation code was altered. The focused Financial Studies regression suite passed **23/23** after the presentation-only change.

Direct browser access to the unauthenticated development preview reached the Financial Studies entry page, but the project selector showed **تسجيل الدخول لعرض المشاريع** and therefore did not expose project data or the Investor Cash Flow table. The sign-in redirect then returned a blank browser page. Consequently, visual browser acceptance of the compact rows remains pending authenticated access; it is not claimed as completed here.

Authenticated preview access was restored on 17 August 2026. The Financial Studies module loaded successfully, and **مجان متعدد الاستخدامات (G+4P+25)** was selected as the off-plan project for the live Investor Cash Flow layout review.

The live Investor Cash Flow page was opened for Majan. The browser visibly shows compact, closely spaced data rows while retaining the readable enlarged figures and labels. The report keeps the direct headings **المبالغ المطلوبة من المستثمر** and **المبالغ المستلمة للمستثمر**, shows item-level rows without the removed Government and Regulatory Fees grouping, and preserves totals, **صافي الشهر**, and **التراكمي**. The page displays AED 202.2M required from the investor, AED 526.5M received by the investor, and AED 324.4M net, confirming the presentation review used loaded project data rather than an empty state.

## Financial Studies two-tier navigation — 17 August 2026

The authenticated development-preview page was refreshed to the Financial Studies entry point after the navigation redesign. It now opens as an independent tile guide rather than preloading General Inputs or showing the prior horizontal strip. The browser visibly shows larger two-column tiles for **بيانات المشروع**, **التدفقات النقدية**, and **التقارير**, alongside smaller direct tiles for the individual pages.

Clicking the large **التدفقات النقدية** tile expanded a separate panel immediately beneath it containing two smaller independent tiles: **تدفقات المستثمر** and **تدفقات الإسكرو**. The original project-type visibility filtering remains in place in the code and is covered by the focused regression suite, which passed **27/27** after the redesign.

Selecting the smaller **تدفقات المستثمر** tile opened the live Majan Investor Cash Flow page directly, with the new **العودة إلى دليل الدراسات** control visible above the report. The previously verified live figures and compact row layout remained available after this new navigation path, confirming that the redesign changed presentation and access only, not the underlying Financial Studies source or report data.

## Financial Studies reference-style card interface — 17 August 2026

The Financial Studies entry page was visually rebuilt against the user-supplied Strategic Studies reference. The browser now shows a centred, spacious three-column card composition with five large softly tinted cards, coloured square icon blocks, bold titles, explanatory descriptions, and a clear **فتح القسم** action. The cards are: **بطاقة المشروع**; **الإعداد والتخطيط**; **التخطيط المالي**; **دراسة جدوى المستثمر**; and **محفظة رأس المال الديناميكية**.

The browser check opened **الإعداد والتخطيط** and showed its five child pages as full, readable section cards: construction, sales, marketing, timeline, and Settings & Rules. This confirms the presentation has the requested visual level while retaining all existing page access.

## Exact Strategic Studies card-system alignment — 17 August 2026

The Financial Studies entry interface was aligned to the actual in-app Strategic Studies card system rather than only approximating its look. Browser verification now shows the same compact sticky header, centred five-card grid, neutral card surfaces with low-opacity gradient overlays, three-pixel accent lines, 16×16 coloured icon blocks, and the **فتح القسم** treatment. The card order matches the reference composition: project card, preparation and planning, Financial Planning, Dynamic Capital Portfolio, then Investor Feasibility.

Clicking **التخطيط المالي** revealed its two child cards—**تدفقات المستثمر** and **تدفقات الإسكرو**—within the same established visual language. The visual change does not alter the Financial Studies data source, report routes, calculations, or project-type visibility rules.

## Dedicated Financial Studies child-page guides — 17 August 2026

The production-flow inspection identified that the earlier child pages were displayed below the primary-card grid, which could make them appear absent after entering the Financial Studies module. Each multi-page card now opens a dedicated guide page instead. The browser verified that opening **التخطيط المالي** replaces the main card grid with a clearly labelled page containing the visible **تدفقات المستثمر** and **تدفقات الإسكرو** cards, as well as a prominent **العودة إلى جميع الأقسام** control. This keeps the reference-style card treatment while making every available child page explicit and reachable.

The **تدفقات المستثمر** child card opened the live Investor Cash Flow report for Majan, including its current project data and export control. Its report-level back action returned successfully to the main Financial Studies card guide. This confirms the complete path: main guide → dedicated Financial Planning guide → Investor Cash Flow → main guide.

The browser also opened the dedicated **الإعداد والتخطيط** guide. It visibly presents all five expected operational pages as independent cards: **الإنشاء**; **المبيعات**; **التسويق**; **الجدول الزمني**; and **الإعدادات والقواعد**. The guide’s back action returned to the main Financial Studies guide successfully.

The dedicated **محفظة رأس المال الديناميكية** guide was also verified. It makes all four available report entries visible: **تجميع المشاريع**; **العرض الشهري**; **محفظة رأس المال**; and **المركز التجاري**.

The dedicated **بطاقة المشروع** guide was verified as well. It clearly displays both expected project-data pages—**المدخلات العامة** and **توزيع الوحدات**—as separate visible cards rather than hiding them beneath the main Financial Studies interface.

Finally, the direct **دراسة جدوى المستثمر** card was opened from the main guide. It reached the live Feasibility Study page for Majan and displayed the saved project’s revenue, costs, net investor profit, capital requirement, and project details. All five main Financial Studies sections are therefore visible and reachable from the corrected card system.
