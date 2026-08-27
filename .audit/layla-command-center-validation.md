# Layla Command Center Read-Only Validation

## Scope

Layla reads the Command Center snapshot created at the time of the question. The snapshot is limited to decisions, approvals, pending payment requests, pending general requests, open tasks, non-cancelled meetings, pending evaluation sessions, milestone/KPI-based project follow-up, and member-visible active updates. Each answer is read-only; the chat has no mutation tool or write path to any of these records.

## Live check — 2026-08-27

The authenticated Command Center chat received the Arabic request: `أعطني ملخصًا للقرارات والمهام والاجتماعات وحالة المشاريع الحالية.` The response returned a source-backed summary rather than the previous blank-message fallback. It identified three approval records, eight open tasks, six meetings, five pending evaluation sessions, and one project with recorded follow-up. It also correctly stated that no pending payment requests, general requests, or submitted/approved change decisions were visible in the current snapshot.

The response exposed no ability to approve, create, edit, send, or delete anything. It is intentionally a read-and-explain assistant. No database record, financial figure, project status, decision, or request was modified during the implementation or live check.

## Multi-topic summary verification

The multi-topic request now has a deterministic source-backed path instead of depending on a language-model tool-selection response. In the authenticated Command Center on 2026-08-27, Layla returned a non-empty summary listing the current visible records: no submitted or approved change decisions; three approval records; no pending payment or general requests; eight open tasks; six non-cancelled meetings; five pending evaluation sessions; and one project with milestone/KPI follow-up. The chat interface recorded no browser console errors during this check.

Individual questions remain answered through read-only source tools. The direct multi-topic summary simply prevents a blank answer when a question spans more than one Command Center category. It does not calculate, infer, mutate, or submit anything.
