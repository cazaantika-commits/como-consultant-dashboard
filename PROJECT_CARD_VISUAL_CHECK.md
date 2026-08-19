# Project Card Visual Check

## Scope

This refinement changes presentation only. It does not alter project fields, values, calculation sources, save contracts, or financial rules.

## Browser Verification

The live Majan Project Card now uses light teal and violet section washes with bright white content surfaces. The section boundaries are more distinct through coloured top rails, two-pixel header dividers, stronger neutral grid lines, and coloured summary-card borders. No dark section background was introduced.

The existing edit action was opened without changing any value. All manual input controls remained available, and the document-derived Khazen section remained intact below the manual input section.

The edit-mode check was then cancelled. The standard «تعديل» action returned, with no save mutation triggered and no project value changed.

## Number Presentation Verification

The live Majan card displays the saved land price as `122,000,000`, while the design fee remains `1.4` rather than being rounded to a whole number. The construction price also remains `450`, and a fractional land area remains `755,555.56`; therefore grouping is applied without hiding a meaningful decimal part.

## Document Facts Header Verification

The embedded document-facts section now presents four distinct layers in order: its violet section heading, the amber project strip, a separate violet action row containing completeness and Khazen/save controls, then the extracted-data cards. The previous sticky action cluster is not rendered inside this embedded header, so no text, badge, or button sits over the project strip or the data-card headings.
