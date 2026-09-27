import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");
const app = read("client/src/App.tsx");
const projectContext = read("client/src/contexts/ProjectContext.tsx");
const programCashFlow = read("client/src/pages/ProgramCashFlowPage.tsx");
const office = read("client/src/pages/ComoNextTodayPage.tsx");
const queryClient = read("client/src/main.tsx");
const schedule = read("client/src/pages/WorkSchedulePage.tsx");
const payments = read("client/src/pages/PaymentRequests.tsx");
const requests = read("client/src/pages/GeneralRequests.tsx");
const evaluation = read("client/src/pages/ConsultantEvaluationPage.tsx");
const registry = read("server/routers/consultantsRegistry.ts");

describe("inside-app acceptance safeguards", () => {
  it("uses projectId from direct links as the official project context", () => {
    expect(projectContext).toContain("readProjectIdFromLocation");
    expect(projectContext).toContain('new URLSearchParams(window.location.search).get("projectId")');
    expect(projectContext).toContain("localStorage.setItem(STORAGE_KEY, String(linkedProjectId))");
  });

  it("maps an official project to the linked cash-flow project and never leaves a missing record spinning", () => {
    expect(programCashFlow).toContain("project.projectId === sourceProjectId");
    expect(programCashFlow).toContain("selectedCfProjectId");
    expect(programCashFlow).toContain("تعذر فتح برنامج التدفقات");
    expect(programCashFlow).toContain("projectQuery.isError || !project");
  });

  it("retries only transient query failures and gives a focused work file an explicit retry", () => {
    expect(queryClient).toContain("isTransientQueryError");
    expect(queryClient).toContain("SERVICE_UNAVAILABLE");
    expect(queryClient).toContain("failed to fetch");
    expect(office).toContain("detailQuery.refetch()");
    expect(office).toContain("إعادة المحاولة");
  });

  it("contains every repaired operational page inside the phone viewport", () => {
    [schedule, payments, requests, evaluation].forEach((source) => {
      expect(source).toContain("max-w-full");
      expect(source).toContain("overflow-x-hidden");
    });
    expect(schedule).toContain("window.innerWidth < 768");
    expect(evaluation).toContain('min-w-[980px]');
  });

  it("routes obsolete blank pages to current canonical workspaces", () => {
    expect(app).toContain('<Route path="/proposals" component={() => <Redirect to="/consultant-proposals" />} />');
    expect(app).toContain('<Route path="/project/:id" component={LegacyProjectRedirect} />');
    expect(app).toContain('<Route path="/market-reports" component={() => <Redirect to="/knowledge-analysis" />} />');
    expect(app).toContain('<Route path="/risk-dashboard" component={() => <Redirect to="/project-management" />} />');
    expect(app).toContain('<Route path="/project-card-post-completion" component={() => <FinancialWorkspaceRedirect tab="general" />} />');
    expect(app).toContain('<Route path="/v2/payment-plan" component={() => <FinancialWorkspaceRedirect tab="sales" />} />');
    expect(app).toContain('<Route path="/tasks" component={() => <Redirect to="/como-next?section=actions" />} />');
    expect(app).toContain('<Route path="/meetings" component={() => <Redirect to="/como-next?section=meetings" />} />');
  });

  it("does not use unavailable Drizzle relation helpers in the retired consultant registry router", () => {
    expect(registry).not.toContain("db.query.consultantsRegistry");
    expect(registry).not.toContain("db.query.consultantsCategories");
    expect(registry).toContain("consultantsRegistry.userId, ctx.user.id");
  });
});
