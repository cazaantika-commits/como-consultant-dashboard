# Wael Sales & Marketing Studio — Professional Redesign Blueprint

## Purpose

Replace the existing dense, table-first Sales and Marketing view with a decision-focused planning studio for Wael. The studio must preserve the current project fields, `saveWorkspace` contract, sales-absorption format, payment-plan format, marketing allocation format, collection calculations, escrow calculations, Investor Cash Flow output, and portfolio aggregation.

## Single data contract

The redesign changes only interaction and presentation. It continues to use the existing project pricing fields, saved Sales Plan record, marketing allocation JSON, marketing channel JSON, payment-plan JSON, and saved results JSON. No second scenario table, duplicate price field, or parallel cash-flow engine will be created.

## Information architecture

The existing single Financial Studies entry remains **المبيعات والتسويق — مساحة وائل**. Inside it, Wael uses five focused decision rooms and a persistent scenario summary:

| Room | Wael’s decision | Interaction | Immediate outcome |
|---|---|---|---|
| **لوحة السيناريو** | Choose where to work next | Clear scenario health, progress rail, one primary action | Revenue, expected profit, first collection, escrow safety |
| **المنتج والسعر** | Set price per square foot for each active unit type | Focused price cards, not a dense mixed table; unit counts and areas are reference-only | Revenue and price sensitivity |
| **خطة البيع** | Choose quantity or percentage of available inventory by month | Pace presets, visual monthly plan, synchronized units and percentages, inventory cap | Sale timing and contracted sales |
| **تحصيل المشتري** | Choose payment behavior | Clear collection presets plus editable payment plan only when needed | Monthly cash collection |
| **حملة التسويق** | Choose campaign budget, timing, and allocation | Channel tiles, budget balance, and campaign window | Monthly marketing cash outflow |
| **أثر القرار** | Review whether to approve the scenario | Cash safety chart, critical month, project profit, and collection profile | Investor and escrow impact preview |

## Visual behavior

The default entry is the scenario board, not an exposed grid. A persistent vertical/right-side decision rail shows the six rooms and completion state. Each room occupies a clean main canvas with one business question, one visual planning method, and a compact live result panel. Raw detailed tables appear only through a clearly labelled precision-edit mode inside the relevant room, never as one long page.

## Guardrails

1. A unit count or percentage edit must recalculate its paired value immediately and cannot exceed available off-plan inventory.
2. Price edits are allowed only for price-per-square-foot fields; quantities and areas remain read-only project facts.
3. Marketing channel distribution cannot exceed 100%, and monthly channel allocation cannot exceed that channel’s budget.
4. Payment-plan total must remain 100% before the scenario can be approved.
5. The only persistent action is **اعتماد سيناريو وائل**. Draft manipulations remain local until that action is used.
6. Every approved scenario preserves marketing allocation as the dedicated stored value and updates the existing downstream calculation source.

## Acceptance standard

Wael can answer these questions without opening raw grids: “How much will I sell?”, “At what price?”, “When will I collect?”, “How much will I spend on marketing?”, and “Will escrow be safe?”. Detailed controls remain available, but not required for ordinary decision-making.
