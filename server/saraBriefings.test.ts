import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  collapseSaraAttentionByTopic,
  chooseSaraAutoMode,
  getSaraDubaiWindow,
  rankSaraBriefingItem,
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

  it("uses only active COMO Next files and avoids exaggerated pet names", () => {
    expect(briefingSource).toContain("wf.work_file_status NOT IN ('closed','cancelled')");
    expect(briefingSource).not.toContain("يا زعيم");
    expect(briefingSource).not.toContain("يا كبير");
  });

  it("flags stale email sync in the spoken briefing rather than claiming full coverage", () => {
    expect(briefingSource).toContain("const staleMail =");
    expect(briefingSource).toContain("لا أؤكد عدم وجود وارد أحدث");
    expect(briefingSource).toContain("text: briefingText");
  });
});
