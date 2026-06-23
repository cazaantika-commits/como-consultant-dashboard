# Capital Scheduling Page Analysis

## User Requests:
1. When shifting columns (delay), no paid amounts should appear - only required amounts
2. Curved corners at row-column intersections instead of sharp rectangles
3. Beautiful column headers

## Current Structure:
- Header shows: grandTotal, paidTotal, upcomingTotal per project (lines 383-395)
- When delay is applied, amounts shift but still show the same values
- Cells are sharp rectangles with no border-radius
- Phase colors: blue for pre-construction, pink for construction

## Key Changes Needed:
1. **Paid amounts in headers**: The header shows المدفوع (paidTotal) - user wants this REMOVED when columns are shifted. Actually user says "لا تظهر اية مبالغ مدفوعة" - no paid amounts should show at all since these columns are only for "المطلوب" (required).
   - Remove paidTotal line from header summary
   
2. **Curved corners**: Add border-radius to cells at phase transitions (where blue meets white, where pink meets white). Use CSS to create smooth curves at the start/end of each phase band.

3. **Beautiful headers**: Already look decent, but can improve with gradients, shadows, better typography.
