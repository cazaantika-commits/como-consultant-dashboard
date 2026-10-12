import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildNarration,
  collapseSaraAttentionByTopic,
  chooseSaraAutoMode,
  getSaraDubaiWindow,
  rankSaraBriefingItem,
  selectSaraLatestMeetingSchedule,
} from "./services/saraBriefings";

const baseItem = {
  kind: "action" as const,
  id: 1,
  project: "Majan",
  workFile: "موضوع",
  title: "إجراء",
  priority: "normal",
  status: "open",
  dueAt: null,
  updatedAt: "2026-09-27 08:00:00",
};
const briefingSource = readFileSync("server/services/saraBriefings.ts", "utf8");

describe("Sara executive briefings", () => {
  it("uses Dubai time to select morning, day, and evening periods", () => {
    expect(getSaraDubaiWindow(new Date("2026-09-27T01:30:00Z")).period).toBe("morning");
    expect(getSaraDubaiWindow(new Date("2026-09-27T07:30:00Z")).period).toBe("day");
    expect(getSaraDubaiWindow(new Date("2026-09-27T13:30:00Z")).period).toBe("evening");
  });

  it("gives the full briefing once, then only changes, with one evening closeout", () => {
    expect(chooseSaraAutoMode({ period: "morning", hasFullToday: false, hasEveningFull: false, changesCount: 0 })).toBe("full");
    expect(chooseSaraAutoMode({ period: "morning", hasFullToday: true, hasEveningFull: false, changesCount: 3 })).toBe("changes");
    expect(chooseSaraAutoMode({ period: "day", hasFullToday: true, hasEveningFull: false, changesCount: 0 })).toBe("changes");
    expect(chooseSaraAutoMode({ period: "evening", hasFullToday: true, hasEveningFull: false, changesCount: 1 })).toBe("full");
    expect(chooseSaraAutoMode({ period: "evening", hasFullToday: true, hasEveningFull: true, changesCount: 1 })).toBe("changes");
  });

  it("ranks timing before static importance while preserving consequence as a tie-breaker", () => {
    const now = new Date("2026-09-27T08:00:00Z");
    const dayEnd = new Date("2026-09-27T19:59:59Z");
    const overdue = rankSaraBriefingItem({ ...baseItem, dueAt: "2026-09-27 07:00:00" }, now, dayEnd);
    const importantLater = rankSaraBriefingItem({ ...baseItem, id: 2, priority: "important", dueAt: "2026-10-15 08:00:00" }, now, dayEnd);
    const today = rankSaraBriefingItem({ ...baseItem, id: 3, dueAt: "2026-09-27 12:00:00" }, now, dayEnd);
    expect(overdue[0]).toBe(0);
    expect(today[0]).toBe(1);
    expect(importantLater[0]).toBe(4);
  });

  it("collapses several due actions under one work-file topic", () => {
    const now = new Date("2026-09-27T08:00:00Z");
    const dayEnd = new Date("2026-09-27T19:59:59Z");
    const grouped = collapseSaraAttentionByTopic([
      { ...baseItem, id: 1, workFile: "كولييرز", title: "متابعة التحليل المالي", dueAt: "2026-09-27 07:00:00" },
      { ...baseItem, id: 2, workFile: "كولييرز", title: "متابعة تنفيذ الدفع", dueAt: "2026-09-27 09:00:00" },
      { ...baseItem, id: 3, workFile: "رياليستيك", title: "تحضير الاجتماع", dueAt: "2026-09-27 10:00:00" },
    ], now, dayEnd);
    expect(grouped).toHaveLength(2);
    expect(grouped[0].title).toContain("كولييرز: 2 نقاط تحتاج حركة");
    expect(grouped[1].title).toBe("تحضير الاجتماع");
  });

  it("moves a past confirmed meeting out of upcoming appointments without pretending it happened", () => {
    const now = new Date("2026-10-07T12:00:00Z"); // 16:00 Dubai
    const empty = { workFiles: [], actions: [], decisions: [], proposals: [], communications: [], emails: [], changes: [], dayEvents: [] };
    const morning = { ...baseItem, kind: "meeting" as const, id: 9, title: "اجتماع الساعة التاسعة", status: "confirmed", dueAt: "2026-10-07 05:00:00" };
    const evening = { ...baseItem, kind: "meeting" as const, id: 10, title: "اجتماع الساعة السابعة", status: "confirmed", dueAt: "2026-10-07 15:00:00" };
    const briefing = buildNarration("full", "day", { ...empty, meetings: [morning, evening] }, now);
    expect(briefing.text).toContain("نتيجة اجتماع الساعة التاسعة: تحقق هل انعقد الاجتماع أو تغير موعده");
    expect(briefing.text).toContain("المواعيد القريبة، 1 بالمجموع:");
    expect(briefing.text).toContain("اجتماع الساعة السابعة");
    const appointments = briefing.text.split("المواعيد القريبة، 1 بالمجموع:")[1]?.split("\n---\n")[0] || "";
    expect(appointments).not.toContain("اجتماع الساعة التاسعة");
  });

  it("does not present yesterday's unconfirmed meeting as an upcoming meeting", () => {
    const now = new Date("2026-10-07T12:00:00Z");
    const snapshot = { workFiles: [], actions: [], decisions: [], proposals: [], communications: [], emails: [], changes: [], dayEvents: [], meetings: [
      { ...baseItem, kind: "meeting" as const, id: 11, title: "اجتماع أمس", status: "planned", dueAt: "2026-10-06 06:00:00" },
    ] };
    const briefing = buildNarration("full", "day", snapshot, now);
    expect(briefing.text).toContain("تأكد من اجتماع أمس: الموعد السابق مضى؛ تحقق هل تأكد أو تغير");
    expect(briefing.text).not.toContain("المواعيد القريبة، 1 بالمجموع:");
  });

  it("uses the latest email reschedule in Dubai and never asks for an outcome from its superseded past slot", () => {
    const now = new Date("2026-09-30T08:00:00Z"); // 12:00 Dubai
    const snapshot = { workFiles: [], actions: [], decisions: [], proposals: [], communications: [], emails: [], changes: [], dayEvents: [], meetings: [
      {
        ...baseItem,
        kind: "meeting" as const,
        id: 31,
        title: "اجتماع أرتك — تصور الفلل الأربع",
        status: "confirmed",
        dueAt: "2026-09-30 06:00:00", // 10:00 Dubai, already passed
        createdAt: "2026-09-29 08:19:00",
        sourceRecordId: "confirmed-meeting:old-slot",
      },
      {
        ...baseItem,
        kind: "meeting" as const,
        id: 32,
        title: "اجتماع أرتك — تصور الفلل الأربع",
        status: "confirmed",
        dueAt: "2026-10-01 06:00:00", // 10:00 Dubai, later email reschedule
        createdAt: "2026-09-30 08:30:00",
        sourceRecordId: "confirmed-meeting:rescheduled-slot",
      },
    ] };
    const latest = selectSaraLatestMeetingSchedule(snapshot.meetings);
    const briefing = buildNarration("full", "day", snapshot, now);
    const afterReschedule = buildNarration("full", "day", snapshot, new Date("2026-10-01T08:00:00Z")); // 12:00 Dubai

    expect(latest.map(item => item.id)).toEqual([32]);
    expect(briefing.text).toContain("المواعيد القريبة، 1 بالمجموع:");
    expect(briefing.text).toContain("اجتماع أرتك — تصور الفلل الأربع");
    expect(briefing.text).not.toContain("نتيجة اجتماع أرتك");
    expect(briefing.text).not.toContain("تحقق هل انعقد الاجتماع أو تغير موعده");
    expect(afterReschedule.text).toContain("نتيجة اجتماع أرتك — تصور الفلل الأربع: تحقق هل انعقد الاجتماع أو تغير موعده");
    expect(afterReschedule.text).not.toContain("المواعيد القريبة، 1 بالمجموع:");
  });

  it("uses the newest email confirmation even when the meeting is moved to an earlier hour", () => {
    const reference = { ...baseItem, kind: "meeting" as const, title: "موعد المراجعة", status: "confirmed",
      sourceRecordId: "confirmed-meeting:old" };
    const selected = selectSaraLatestMeetingSchedule([
      { ...reference, id: 41, dueAt: "2026-10-09 15:00:00", createdAt: "2026-10-07 10:00:00" }, // 19:00 Dubai
      { ...reference, id: 42, dueAt: "2026-10-09 13:00:00", createdAt: "2026-10-08 10:00:00",
        sourceRecordId: "confirmed-meeting:new" }, // 17:00 Dubai
    ]);
    expect(selected.map(item => item.id)).toEqual([42]);
  });

  it("does not collapse email meetings with the same title in distinct work files", () => {
    const reference = { ...baseItem, kind: "meeting" as const, title: "جلسة مراجعة", status: "confirmed",
      sourceRecordId: "confirmed-meeting:thread", dueAt: "2026-10-09 13:00:00" };
    expect(selectSaraLatestMeetingSchedule([
      { ...reference, id: 51, workFileId: 101 },
      { ...reference, id: 52, workFileId: 102 },
    ])).toHaveLength(2);
  });

  it("uses only active COMO Next files and avoids exaggerated pet names", () => {
    expect(briefingSource).toContain("wf.work_file_status NOT IN ('closed','cancelled')");
    expect(briefingSource).not.toContain("يا زعيم");
    expect(briefingSource).not.toContain("يا كبير");
  });

  it("keeps a future deadline distinct from an elapsed attention time", () => {
    const now = new Date("2026-10-12T03:52:00Z");
    const snapshot = { workFiles: [], decisions: [], meetings: [], proposals: [], communications: [], emails: [], changes: [], dayEvents: [], actions: [
      { ...baseItem, ownerType: "human", title: "حسم إدخال الانتيريور واللاندسكيب خلال أسبوع",
        attentionAt: "2026-10-10 05:00:00", dueAt: "2026-10-17 05:00:00" },
    ] };
    const briefing = buildNarration("full", "morning", snapshot, now);
    expect(briefing.text).toContain("أعمال بموعد لاحق، 1 بالمجموع:");
    expect(briefing.text).toContain("حسم إدخال الانتيريور واللاندسكيب خلال أسبوع");
    expect(briefing.text).not.toContain("ومتأخر");
    expect(briefing.text).not.toContain("اللي بدّه حركة منك، 1");
    expect(buildNarration("today", "morning", snapshot, now).itemCount).toBe(0);
    expect(briefingSource).toContain("a.due_at AS dueAt");
    expect(briefingSource).not.toContain("COALESCE(a.attention_at,a.due_at,a.follow_up_at) AS dueAt");
  });

  it("separates owner action, Manus work and external waiting even within one topic", () => {
    const now = new Date("2026-10-12T03:52:00Z");
    const snapshot = { workFiles: [], decisions: [], meetings: [], proposals: [], communications: [], emails: [], changes: [], dayEvents: [], actions: [
      { ...baseItem, id: 1, ownerType: "human", title: "مراجعة مسودة وائل" },
      { ...baseItem, id: 2, ownerType: "manus", title: "إعداد المقارنة الداخلية" },
      { ...baseItem, id: 3, ownerType: "team", status: "waiting_external", title: "بانتظار تحليل كولييرز", dueAt: "2026-09-24 07:00:00" },
      { ...baseItem, id: 4, ownerType: "manus", status: "waiting_external", title: "انتظار المسح الموقع" },
    ] };
    const briefing = buildNarration("full", "morning", snapshot, now);
    const ownerSection = briefing.text.split("اللي بدّه حركة منك، 1 بالمجموع:")[1]?.split("\n---\n")[0];
    expect(ownerSection).toContain("مراجعة مسودة وائل");
    expect(ownerSection).not.toContain("كولييرز");
    expect(ownerSection).not.toContain("المقارنة");
    expect(briefing.text).toContain("على Manus، 1 بالمجموع:");
    expect(briefing.text).toContain("بانتظار الغير أو متطلب سابق، 1 بالمجموع:");
    expect(briefing.text).toContain("2 متطلبات قيد الانتظار");
    expect(briefing.text).not.toContain("ومتأخر");
    const today = buildNarration("today", "morning", snapshot, now);
    expect(today.itemCount).toBe(2);
    expect(today.text).toContain("مطلوب منك: مراجعة مسودة وائل");
    expect(today.text).toContain("على Manus: إعداد المقارنة الداخلية");
    expect(today.text).not.toContain("كولييرز");
  });

  it("does not assign an unknown or team owner to the application owner", () => {
    const now = new Date("2026-10-12T03:52:00Z");
    const snapshot = { workFiles: [], decisions: [], meetings: [], proposals: [], communications: [], emails: [], changes: [], dayEvents: [], actions: [
      { ...baseItem, ownerType: "team", title: "مراجعة الفريق", dueAt: "2026-10-12 02:00:00" },
    ] };
    const briefing = buildNarration("full", "morning", snapshot, now);
    expect(briefing.text).toContain("على الفريق أو يحتاج تحديد مسؤول، 1 بالمجموع:");
    expect(briefing.text).not.toContain("اللي بدّه حركة منك، 1");
    expect(briefing.text).toContain("ومتأخر");
  });

  it("does not use a received email timestamp as an owner deadline", () => {
    expect(briefingSource).toContain("email.inbox_status AS status, NULL AS dueAt");
    expect(briefingSource).not.toContain("email.received_at AS dueAt");
  });

  it("flags stale email sync in the spoken briefing rather than claiming full coverage", () => {
    expect(briefingSource).toContain("const staleImport =");
    expect(briefingSource).toContain("const staleProcessing =");
    expect(briefingSource).toContain('eq(comoNextEmailSyncSettings.mailboxKey, "owner-primary-processing")');
    expect(briefingSource).toContain("لا أؤكد عدم وجود وارد أحدث");
    expect(briefingSource).toContain("قد تنقص المتابعات والأولويات");
    expect(briefingSource).toContain("text: briefingText");
  });
});
