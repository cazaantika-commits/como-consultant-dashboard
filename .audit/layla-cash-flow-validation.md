# Layla Cash-Flow Answer Validation

**Date:** 2026-08-27

## Source rule

Layla reads only the existing final monthly Investor Cash Flow rows, copied into the already-approved Unified Group Cash Flow calendar. Her read-only tools return paid, received, final net, copied cumulative value, and the source trace items. They do not calculate sales, escrow, profit allocation, rent, operating costs, or any other financial value.

The Commercial Center is labelled as development before operation. The context explicitly states that no rent or operating projections exist in the approved source and must not be asserted.

## Live validation

The Command Center chat was opened with the owner-authorized session. It answered the project-scope question with the six projects present in the Unified Group Cash Flow source. It then answered the following project/month question:

> اشرح لي حركة الأموال في مشروع ند الشبا قطعة 1 من أغسطس 2028 لمدة 6 أشهر، وما الذي صُرف وما الذي استُلم ولماذا؟

The first attempt exposed a calendar-alignment defect: the group-calendar index was mistakenly used to read a shorter project calendar, causing paid/received values to disagree with the reported final net in certain months. The source helper was corrected to locate each requested month in that project's own final calendar.

The repeat answer then reconciled each displayed month: August 2028 showed a payment of 145,611.77 and final net of -145,611.77; November 2028 showed payment 841,102.32, receipt 47,180,090.80, and final net 46,338,988.48. The answer named the trace sources (bank fees and developer fee in August; Como profit share and first escrow settlement in November). Zero-movement months were explicitly described as having no recorded movement.

Layla also answered a group question by returning the copied group net, copied cumulative balance, and non-zero project drivers for the first three report months. A separate Majan capital question returned the final Investor Cash Flow summary values: peak required capital 306,451,847.81, paid before schedule 128,100,000, and remaining funding 178,351,847.81. No values were entered, modified, or recalculated in the chat layer.

## Identity presentation

Stored legacy greetings that contained `سلوى` are now rendered as `ليلى` in the chat panel, including text read aloud. Stored rows and their role enum were not edited, so chat-history data remains intact.
