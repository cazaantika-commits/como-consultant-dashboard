# Financial Studies Timeline Audit

The active Financial Studies timeline component is `V2Timeline.tsx`. It currently defines a fixed `PHASES` array, fixed `TOTAL_MONTHS = 36`, and fixed milestone months in the component itself.

It does not read the selected project, project start date, saved design duration, saved construction duration, sales duration, or project settings. Therefore its visual phases cannot currently be relied upon as the selected project’s actual timeline.
