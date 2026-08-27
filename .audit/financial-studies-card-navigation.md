# Financial Studies Card Navigation Validation

## Defect reproduced

The Financial Studies cards changed the browser URL from `/bateekha` to a `?tab=` URL, but the page state stayed on the card grid. The cards therefore appeared not to open, despite the URL changing.

## Cause and correction

All cards share the same pathname and differ only by query string. The route hook did not reliably react to the query-string-only transition. Card selection now sets the selected tab immediately, and the page also synchronizes the tab on browser history navigation. The return control clears the local tab state before applying the validated return route.

## Live validation

In an authenticated browser session, the Capital Portfolio card changed the URL and immediately rendered its report shell. With the saved project `ند الشبا — قطعة 3 الفلل (6180578)`, the Investor Cash Flow card immediately rendered the full Investor Cash Flow report and its financial table. The report used the selected project source; the test did not modify project, financial, or browser data.

The Unified Group Cash Flow card also opened immediately after returning to the card grid. A 390×844 mobile preview kept the cards in single-column layout with full-width touch targets and no overlap or clipped card edge. The unauthenticated mobile preview naturally did not show project data, but the same card handler is used after selection.
