# Settings and Rules Timing Audit — Majan G+4P+25

## Saved timing controls present

| Rule | Saved/displayed value | Source |
|---|---:|---|
| Design work stages | 26 weeks, displayed as 7 months | Seven editable design-stage weeks in Settings and Rules |
| Marketing-material preparation | 2 months | Project phase setting |
| RERA registration and sales licence | Starts 1 month after schematic design; duration 2 months | Project phase rule and saved duration |
| Marketing launch | Immediately after marketing-material preparation | Fixed dependency rule |
| Sales start | 1 month after RERA registration and sales licence | Fixed dependency rule |
| Construction start | 1 month after design completion | Saved offset; construction duration comes from General Inputs |
| Direct post-completion sales | Starts month 4; 6 equal payments | Saved per-project setting |

## Audit finding

The Settings page derives design duration from the editable design-stage weeks: 26 weeks, rounded to 7 months. However, the project’s General Inputs / Investor Cash Flow currently use 8 design months. Project start date and construction duration are also maintained in General Inputs rather than Settings and Rules.

The timing rules are present, but the system presently has two different sources for design duration. A project-driven timeline must explicitly select a single source (preferably General Inputs for headline phase duration, with Settings design stages validating or allocating within it) before it can be trusted.
