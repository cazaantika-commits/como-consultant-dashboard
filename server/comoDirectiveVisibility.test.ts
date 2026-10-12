import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { describeDirectiveDispatch, describeLifecycleLane } from "../client/src/pages/ComoNextTodayPage";
import { isSaraExecutionAuthorized } from "./services/saraRealtime";

describe("directive and lifecycle visibility", () => {
  it("keeps human ownership, external waiting, and attention time independent", () => {
    const lane = describeLifecycleLane({
      key: "deliverable:1",
      kind: "deliverable",
      title: "تسليم التقرير",
      status: "waiting_external",
      sourceKind: "linked_correspondence",
      nextOwnerType: "human",
      attentionAt: "2026-10-12T03:00:00Z",
    }, Date.parse("2026-10-12T04:00:00Z"));

    expect(lane.owner).toBe("human");
    expect(lane.waiting).toBe(true);
    expect(lane.due).toBe(false);
    expect(lane.needsAttention).toBe(true);
  });

  it("does not treat a pending directive, a next action, or a summary as completed", () => {
    const view = describeDirectiveDispatch({
      status: "pending",
      executionSummary: "سيُنشأ إجراء متابعة",
      dispatch: { nextActionId: 99, executionSummary: "سيُنشأ إجراء متابعة" },
    });

    expect(view.completed).toBe(false);
    expect(view.delivered).toBe(false);
    expect(view.active).toBe(false);
  });

  it("requires a literal explicit boolean true for Sara execution authorization", () => {
    expect(isSaraExecutionAuthorized(true)).toBe(true);
    expect(isSaraExecutionAuthorized(false)).toBe(false);
    expect(isSaraExecutionAuthorized(undefined)).toBe(false);
    expect(isSaraExecutionAuthorized("true")).toBe(false);
  });

  it("keeps Sara tool JSON strict and stages-only when execution is not explicitly authorized", () => {
    const router = readFileSync("server/routers/saraRealtime.ts", "utf8");
    const realtime = readFileSync("server/services/saraRealtime.ts", "utf8");

    expect(realtime).toContain("execution_authorized");
    expect(realtime).toContain('required: ["work_file_id", "directive_text", "action_id", "current_decision_id", "execution_authorized"]');
    expect(router).toContain("if (!isSaraExecutionAuthorized(parsed.execution_authorized))");
    expect(router).toContain("submitStagedExecutiveDirectiveCommand({ userId, directiveId: result.directive.id })");
  });
});
