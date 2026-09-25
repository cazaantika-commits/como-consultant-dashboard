import { describe, expect, it } from "vitest";
import { buildComoNextTodayProjection, getDubaiDayBounds, type ComoNextTodayRow } from "./services/comoNextToday";

const base: Omit<ComoNextTodayRow, "id" | "title" | "ownerType" | "ownerUserId" | "actionStatus" | "attentionAt"> = {
  projectId: 1,
  projectName: "Majan Shopping Center",
  workFileId: 10,
  workFileTitle: "Consultant appointment",
  acceptanceCriteria: "Verified document",
  priority: "important",
  dueAt: null,
  followUpAt: null,
  waitingPartyName: null,
};

function row(overrides: Partial<ComoNextTodayRow> & Pick<ComoNextTodayRow, "id" | "title">): ComoNextTodayRow {
  return {
    ...base,
    ownerType: "human",
    ownerUserId: 7,
    actionStatus: "open",
    attentionAt: "2026-09-25 06:00:00",
    ...overrides,
  };
}

describe("COMO Next Today projection", () => {
  it("uses Dubai day boundaries without relying on the server timezone", () => {
    const bounds = getDubaiDayBounds(new Date("2026-09-25T08:00:00.000Z"));
    expect(bounds.start.toISOString()).toBe("2026-09-24T20:00:00.000Z");
    expect(bounds.end.toISOString()).toBe("2026-09-25T19:59:59.999Z");
  });

  it("groups only real due actions and does not invent executive work", () => {
    const result = buildComoNextTodayProjection([
      row({ id: 1, title: "Owner action", attentionAt: "2026-09-25 06:00:00" }),
      row({ id: 2, title: "Manus analysis", ownerType: "manus", ownerUserId: null, attentionAt: "2026-09-25 09:00:00" }),
      row({ id: 3, title: "External reply", actionStatus: "waiting_external", waitingPartyName: "K&A", attentionAt: "2026-09-24 08:00:00" }),
      row({ id: 4, title: "Future action", attentionAt: "2026-09-26 09:00:00" }),
      row({ id: 5, title: "Verified action", actionStatus: "verified", attentionAt: "2026-09-24 08:00:00" }),
      row({ id: 6, title: "Unscheduled action", attentionAt: null }),
    ], 7, new Date("2026-09-25T08:00:00.000Z"));

    expect(result.summary).toMatchObject({ dueToday: 3, overdue: 2, waitingExternal: 1, mine: 1, manus: 1, team: 0 });
    expect(result.sections.mine.map(item => item.title)).toEqual(["Owner action"]);
    expect(result.sections.manus.map(item => item.title)).toEqual(["Manus analysis"]);
    expect(result.sections.waitingExternal.map(item => item.title)).toEqual(["External reply"]);
    expect(JSON.stringify(result)).not.toContain("Future action");
    expect(JSON.stringify(result)).not.toContain("Verified action");
    expect(JSON.stringify(result)).not.toContain("Unscheduled action");
  });

  it("routes another user's action to the team section", () => {
    const result = buildComoNextTodayProjection([
      row({ id: 8, title: "Team commitment", ownerType: "human", ownerUserId: 99 }),
    ], 7, new Date("2026-09-25T08:00:00.000Z"));
    expect(result.sections.team).toHaveLength(1);
    expect(result.sections.mine).toHaveLength(0);
  });
});
