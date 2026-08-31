# ARTEC Project-Specific Scope Baseline

## Source and governing rule

The owner-provided **Schedule of Design Fees — All Plots** is the source for the initial project-specific design scopes. It is not applied as one identical template. Each plot receives only the disciplines that ARTEC marked **Included** for that plot. Entries marked **Excluded**, **N/A**, blank contingency rows, named staff, and fee percentages are not converted into new library items.

The comprehensive reference library remains unchanged. Each project receives a new independent draft revision. The owner can select or deselect items and edit project-level duration and gap value. Once saved, that project revision becomes the comparison baseline and cannot affect another project.

The supplied file is explicitly a **Schedule of Design Fees**. It does not define a supervision team or supervision deliverables. Therefore, the project's existing independent supervision selections are carried forward unchanged into the ARTEC-based revision; they are not inferred from this file and are not deleted.

## Direct library mapping

| ARTEC schedule discipline | Existing library item(s) |
| --- | --- |
| Architecture | `ARCH_DESIGN` |
| Interior Design | `ID_COMMON_AREAS`, `ID_UNIT_PROTOTYPES` |
| Landscape Design | `LANDSCAPE_WATER` |
| Façade + Interior Lighting | `FACADE_ENGINEERING`, `FACADE_LIGHTING` |
| Structural Design | `STRUCTURAL_DESIGN` |
| MEP | `MEP_ENGINEERING` |
| FLS | `FLS` |
| SIRA | `SECURITY_SIRA` |
| TIS | `TIS` |
| Vertical Transportation | `VERTICAL_TRANSPORT` |
| Signage and Wayfinding | `SIGNAGE_WAYFINDING` |
| Acoustics | `ACOUSTIC` |
| BOQ / Specs | `QS_BOQ` |
| Tender Services | `TENDER_DOCS` |
| Authorities / BP | `AUTHORITY_SUBMISSIONS`, `BUILDING_PERMIT` |
| BIM Management | `BIM_MANAGEMENT` |
| PII Insurance | `PI_INSURANCE` |

## Plot-specific selection

The common baseline for all six plots contains Architecture, Structural Design, MEP, FLS, Signage and Wayfinding, BOQ, Tender Services, Authority Submissions, Building Permit, BIM Management, and PII Insurance.

| Plot | Project | Plot-specific additions from the supplied schedule |
| --- | --- | --- |
| 6457956 | G+4 Shopping Centre, Majan | Interior Design, Landscape, Façade/Lighting, SIRA, TIS, Vertical Transportation, Acoustics |
| 6457879 | G+4P+25 Residential & Commercial, Majan | Interior Design, Landscape, Façade/Lighting, SIRA, TIS, Vertical Transportation, Acoustics |
| 6182776 | G+2P+6 Residential, Nad Al Sheba | SIRA only; Interior, Landscape and Façade/Lighting are Excluded; TIS, Vertical Transportation and Acoustics are N/A |
| 6185392 | G+2P+6 Residential, Nad Al Sheba | Interior Design, Landscape, Façade/Lighting and SIRA; TIS, Vertical Transportation and Acoustics are N/A |
| 3260885 | G+7 Residential, Al Jaddaf | SIRA only; Interior, Landscape and Façade/Lighting are Excluded; TIS, Vertical Transportation and Acoustics are N/A |
| 6180578 | G+24 Unit Villas, Nad Al Sheba | No specialist additions; Interior, Landscape and Façade/Lighting are Excluded, while SIRA, TIS, Vertical Transportation and Acoustics are N/A |

## Gap behavior

At initialization, every ARTEC coverage row selected by the plot-specific baseline is set to **Included**, so ARTEC's initial design-scope gap is zero. Other consultants retain their source-grounded Included, Excluded, or Not Mentioned statuses and are compared against the same project baseline. If the owner later adds a requirement not covered by ARTEC, ARTEC may correctly acquire a gap; it is not permanently forced to zero.

When an existing ARTEC coverage row is changed to Included during initialization, its previous status and note are appended to the coverage note for auditability.

The migration deliberately does **not** alter any consultant design-fee amount, percentage, supervision offer, financial calculation, or shared library row.
