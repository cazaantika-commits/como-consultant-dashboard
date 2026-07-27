# Pricing Table Fix Notes

## Current State
- File: `client/src/pages/V2WaelSales.tsx`
- The pricing table (جدول التسعير) currently has 3 editable inputs per row:
  - `count` (العدد) — editable input
  - `area` (المساحة) — editable input  
  - `price` (سعر/قدم) — editable input

## Required Change
- **ONLY `price` (سعر/قدم) should be editable**
- `count` and `area` should be **read-only** (displayed as text, not input)
- These values come from the project data card (DB fields like residential1brCount, residential1brArea, etc.)
- The user enters them once in the project data card, and they appear here as fixed values

## Implementation
1. In the pricing table render (lines ~520-600), replace `<input>` for `count` and `area` with plain `<td>` text display
2. Keep only the `price` input editable
3. The `updateUnit` function should only accept `"price"` field changes
4. `totalArea = count * area` (computed)
5. `total = count * area * price` (computed)
6. `%` = total / grandTotal (computed)

## Data Flow
- UNIT_TYPES array (line 33): defines dbCount, dbArea, dbPrice fields
- unitData state (line 94): `Record<string, { count, area, price }>`
- Loaded from DB in useEffect (line 140): reads p[u.dbCount], p[u.dbArea], p[u.dbPrice]
- updateUnit function (line 439): currently accepts "count" | "area" | "price"
- Auto-save effect (line 411): saves all 3 fields back to DB

## Key: count and area should still be loaded from DB and stored in state
- They just shouldn't be editable FROM THIS PAGE
- They are edited in the project data card page
