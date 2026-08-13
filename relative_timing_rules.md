# Approved Relative Timing Rules

These rules apply to every project and are calculated from its own saved design-stage durations; no calendar month is fixed across projects.

| Rule | Formula |
|---|---|
| Design duration | `ceil(sum(all design-stage weeks) / 4.33)` months |
| Schematic completion | `ceil(sum(first 3 design-stage weeks) / 4.33)` months |
| Marketing-material preparation | Starts immediately after schematic completion; duration 2 months |
| Marketing launch | Starts immediately after marketing-material preparation completes |
| RERA registration and sales licence | Starts one month after schematic completion; duration 2 months |
| Sales start | Starts one month after RERA registration and sales licence complete |
| Construction start | Starts one month after all design stages complete |
| Construction duration | Comes from the selected project’s General Inputs |
| Post-completion | Starts after construction completes; duration 13 months |

The formula is intentionally project-relative: a project with 5 design months and a project with 7 design months receive different calculated phase months while following the same dependencies.
