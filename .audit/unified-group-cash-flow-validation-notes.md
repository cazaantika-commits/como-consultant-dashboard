# Unified Group Cash Flow Validation Notes

## Browser check — 2026-08-27

The sandbox browser opened `/bateekha?tab=unified_group_cashflow` twice. Both attempts rendered a blank viewport with no interactive elements, despite the document title loading. This check did not validate the report UI or data. The next validation must use the managed preview capture and inspect client/server logs before delivery.

## Managed preview checks — 2026-08-27

The managed preview loaded the authenticated Financial Studies report successfully at both desktop (1440×900) and mobile (390×844) sizes. The report displayed six project columns, the distinct `مدفوع مسبقًا` opening row, the Commercial Center labelled `تطوير قبل التشغيل`, full non-abbreviated values, and the 3/4-month decision panel. The compact mobile table retained its horizontal scrolling treatment instead of compressing financial columns.

The Command Center route remains guarded by its separate access-token screen in the sandbox preview. Its authenticated visual state could not be rendered without that token. The component was compiled in the targeted test suite and its source contract asserts that it queries `getUnifiedGroupCashFlows` and derives the 3/4-month panel with `buildUnifiedGroupLiquidity`; a final on-screen check should occur in the owner's normal authenticated Command Center session.
