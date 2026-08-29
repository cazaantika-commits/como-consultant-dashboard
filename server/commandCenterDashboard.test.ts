import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = readFileSync("client/src/pages/CommandCenterPage.tsx", "utf8");
const routerSource = readFileSync("server/routers/commandCenter.ts", "utf8");
const serverSource = readFileSync("server/_core/index.ts", "utf8");
const storageProxySource = readFileSync("server/_core/storageProxy.ts", "utf8");
const schemaSource = readFileSync("drizzle/schema.ts", "utf8");
const cashFlowRouterSource = readFileSync("server/routers/cashFlowSettings.ts", "utf8");

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

  it("keeps legacy aggregation removed and exposes only the approved portfolio and unified reports", () => {
    expect(source).not.toContain("canOpenExecutivePortfolioReports");
    expect(source).not.toContain('activeBubble === "executive_portfolio_reports"');
    expect(source).not.toContain("ExecutivePortfolioReports");
    expect(source).toContain("<ExecutiveCashFlowAlert");
    expect(source).toContain('data-testid="command-center-financial-report-access"');
    expect(source).toContain('setActiveBubble("financial_portfolio_standard")');
    expect(source).toContain('setActiveBubble("financial_portfolio_transposed")');
    expect(source).toContain('setActiveBubble("financial_unified")');
    expect(source).toContain("بدون المركز التجاري");
    expect(source).toContain("يشمل المركز التجاري");
  });

  it("grants active Command Center members read-only access to approved aggregate report queries", () => {
    expect(cashFlowRouterSource).toContain("commandCenterReportAccessInput");
    expect(cashFlowRouterSource).toContain("assertFinancialReportReadAccess");
    expect(cashFlowRouterSource).toContain("commandCenterMembers.accessToken");
    expect(cashFlowRouterSource).toContain("commandCenterMembers.isActive");
    expect(cashFlowRouterSource).toContain("getPortfolioInvestorNetCashFlows: publicProcedure.input(commandCenterReportAccessInput)");
    expect(cashFlowRouterSource).toContain("getUnifiedGroupCashFlows: publicProcedure.input(commandCenterReportAccessInput)");
    expect(cashFlowRouterSource).toContain("getFinancialStudiesCapitalPortfolio: publicProcedure.input(commandCenterReportAccessInput)");
  });

  it("uses a generic assistant icon on mobile rather than the secretary image", () => {
    expect(source).toContain('<MessageCircle className="h-6 w-6 text-white sm:hidden" />');
    expect(source).toContain('className="relative hidden flex-shrink-0 sm:block"');
  });

  it("keeps the mobile Command Center login light and avoids a clipped bilingual title", () => {
    expect(source).toContain('bg-gradient-to-br from-slate-50 via-amber-50 to-indigo-50');
    expect(source).toContain('COMO Developments</p>');
    expect(source).not.toContain('COMO Developments — Command Center');
  });

  it("places the decision summary ahead of financial alerts and uses the new professional advisor portrait", () => {
    expect(source).toContain('layla-command-center-portrait_2ede5e10.jpg');
    expect(source).toContain('تحدث مع ليلى');
    expect(source).not.toContain('como-hijabi-advisor-portrait_b3437e42.png');
    expect(source.indexOf('ملخص مركز القيادة')).toBeLessThan(source.indexOf('<ExecutiveCashFlowAlert'));
  });

  it("shows only approved baseline-linked change decisions without auto-updating financial values", () => {
    expect(source).toContain("function ApprovedProjectChanges");
    expect(source).toContain("<ApprovedProjectChanges token={token} />");
    expect(routerSource).toContain("getApprovedProjectChanges");
    expect(routerSource).toContain("const member = await verifyToken(input.token);");
    expect(routerSource).toContain("projectChangeRequests.decisionStatus, 'approved'");
    expect(schemaSource).toContain('decisionStatus: mysqlEnum("decision_status", ["draft", "submitted", "approved", "rejected"])');
    expect(schemaSource).not.toContain('mysqlEnum("change_decision_status"');
    expect(routerSource).not.toContain("UPDATE financialData");
  });

  it("serves Layla's permanent portrait through the project storage proxy", () => {
    expect(serverSource).toContain('import { registerStorageProxy } from "./storageProxy";');
    expect(serverSource.indexOf('registerStorageProxy(app);')).toBeLessThan(serverSource.indexOf('registerOAuthRoutes(app);'));
    expect(storageProxySource).toContain('app.get("/manus-storage/*"');
    expect(storageProxySource).toContain('v1/storage/presign/get');
  });

  it("uses compact neutral executive action cards rather than oversized colored priority blocks", () => {
    expect(source).toContain('min-h-[102px]');
    expect(source).toContain('borderRight: `4px solid ${accentColor}`');
    expect(source).toContain('grid grid-cols-2 gap-2 sm:grid-cols-4');
    expect(source).not.toContain('hover:shadow-2xl');
  });
});
