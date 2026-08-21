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

  it("builds ticker evaluation headlines from the current member's pending sessions, not legacy duplicate item records", () => {
    expect(routerSource).toContain("pendingEvaluationTickerItems");
    expect(routerSource).toContain("myCompletedEvaluations");
    expect(routerSource).toContain("if (item.bubbleType === 'evaluations') return false;");
    expect(routerSource).toContain("return [...pendingEvaluationTickerItems, ...formattedItems].slice(0, 30);");
  });

  it("keeps historical test evaluation sessions out of executive counts, ticker news, and the visible evaluation queue", () => {
    expect(routerSource).toContain("function isHistoricalTestEvaluationSession");
    expect(routerSource).toContain("if (isHistoricalTestEvaluationSession(s.title)) return false;");
    expect(routerSource).toContain(".filter(session => !isHistoricalTestEvaluationSession(session.title))");
  });

  it("opens the member-specific pending evaluation queue before the project-level overview", () => {
    expect(source).toContain("function PendingEvaluationQueue");
    expect(source).toContain("setShowPendingEvaluationQueue(true)");
    expect(source).toContain("المطلوب منك الآن");
    expect(source).toContain("لا تظهر هنا الجلسات التجريبية أو الجلسات المكتملة");
  });

  it("mounts the executive portfolio section only behind Sheikh Issa's access guard", () => {
    expect(source).toContain("canOpenExecutivePortfolioReports(member?.memberId)");
    expect(source).toContain('activeBubble === "executive_portfolio_reports" && canOpenExecutiveReports');
    expect(source).toContain("<ExecutivePortfolioReports onBack");
  });
});
