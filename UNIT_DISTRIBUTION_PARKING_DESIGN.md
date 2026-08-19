# Unit Distribution and Parking Design

## Audit finding

The current Unit Distribution screen spreads its table across the full available width, even though the editable information is limited to unit type, count, and area. It also calculates parking from hard-coded assumptions in `PricingPage.tsx`. Those assumptions are not linked to a project document and therefore must not be shown as the project’s confirmed parking requirement.

## Approved presentation rule

The revised page will use a compact working width. The unit table remains the sole location for unit counts and areas, while concise read-only summaries show total units, total distributed saleable area, total available saleable area, and the area variance. No pricing field or second unit-entry point will be introduced.

## Parking source rule

Parking will be represented as a document-derived project fact. Khazen’s document request will ask for the exact clause and reference, available on-site spaces, and the calculation rules for residential, retail, office, visitor, and accessibility spaces when present. The Project Card will display these facts under a separate document section.

The Unit Distribution page will use only the structured document-derived rules to calculate the requirement. It will explain each active rule and show required spaces, documented available spaces, and surplus or deficit. If the documents do not contain a required rule or capacity, the page will explicitly show that the item is pending document extraction rather than substituting an assumption.

## Rule structure

The project record will store a serialised parking-rules object with an exact source reference and optional supported values. The current page will support a residential area threshold with spaces below/above it, an area-per-space rule for retail and offices, visitor and accessible percentages, and an available-space total. Empty values remain empty and do not trigger a fallback calculation.

## Live browser finding

The compact Majan distribution page correctly displayed the document-pending state and did not calculate required parking. The missing available-capacity field, however, was temporarily displayed as zero because the parser converted a database `null` to `0`. This is not acceptable: zero is a valid documented capacity, while a missing document fact must remain **غير مذكور**. The parser will be corrected to preserve this distinction before acceptance.

## Final browser verification

Majan’s live Unit Distribution now renders as a compact two-panel work area rather than a full-width spread. It shows 209 units, 380,943 distributed square feet, 381,077.54 available saleable square feet, and a 134.54-square-foot variance without creating any new unit input. The four project parking columns were also confirmed present in the live database.

## Official rule now extracted

After exact official-document indexing and the repaired Khazen workflow, Majan now carries the parking text and reference from `MAJ_6457879_AP_V1.0.pdf — GENERAL NOTES / PARKING`. The detail table calculates required spaces for every unit type. Browser validation exposed one remaining presentation gap: the top summary still shows «غير مكتمل» for required spaces when capacity is unavailable. The requirement is already calculable and must be shown separately from capacity and variance.
