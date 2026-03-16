# CPA System TODO

- [x] Fix team gap analysis to apply to ALL fee methods (LUMP_SUM, PERCENTAGE, MONTHLY_RATE)
- [x] Verify calculation matches worked example in Final Spec
- [x] Fix importJson bug: added textarea for direct JSON paste, import now works correctly
- [x] Fix unrankable consultants display: show scope gap + true design fee (LACASA, XYZ)
- [x] Build True Cost Report generation endpoint (HTML/PDF matching TrueCost_6457879 format)
- [x] Add Export Report button to CPA results page
- [x] Capital scheduling: page wired to /capital-scheduling route in App.tsx
- [ ] Import corrected KIEFERLE JSON and recalculate
- [x] Fix report: scope gap table now shows only items 29-43 (add-on items), not 1-28 (base scope)
- [x] Add contractual risk warnings section (items 1-28) to report with notes from JSON
- [x] Capital scheduling: no paid amounts when shifting columns (only required amounts)
- [x] Capital scheduling: curved corners at row-column intersections instead of rectangles
- [x] Capital scheduling: beautiful column headers matching current design
- [x] Capital scheduling: lighter/clearer header colors (not dark) - comfortable and readable
- [x] Capital scheduling: pick 2 colors from reference image for phases (teal + amber)
- [x] Capital scheduling: all columns equal width
- [x] Capital scheduling: phase rectangles with rounded corners at all 4 corners (not just top/bottom)
