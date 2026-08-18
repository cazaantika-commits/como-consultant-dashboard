import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = readFileSync("client/src/pages/CommandCenterPage.tsx", "utf8");
const routerSource = readFileSync("server/routers/commandCenter.ts", "utf8");

describe("Command Center dashboard card registry", () => {
  it("does not render stale tile indexes beyond the current nine-card BUBBLES registry", () => {
    expect(source).not.toContain("BUBBLES[12]");
    expect(source).not.toContain("BUBBLES[11]");
    expect(source).not.toContain("BUBBLES[10]");
    expect(source).not.toContain("BUBBLES[9]");
  });

  it("keeps all current Command Center card types represented in the dashboard", () => {
    for (const type of ["payment_requests", "evaluations", "milestones_kpis", "requests", "reports", "meeting_minutes", "work_schedule", "announcements", "internal_messages"]) {
      expect(source).toContain(`type: "${type}"`);
    }
  });

  it("normalizes the stored memberRole for the existing Command Center authorization checks", () => {
    expect(routerSource).toContain("role: member.memberRole");
  });
});
