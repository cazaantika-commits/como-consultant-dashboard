import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolveReturnPath, withReturnPath } from "../client/src/lib/returnNavigation";

const source = (relativePath: string) => readFileSync(relativePath, "utf8");

describe("return navigation", () => {
  it("accepts only in-application return targets and always has a fallback", () => {
    expect(resolveReturnPath("?returnTo=%2Fcommand-center", "/bateekha")).toBe("/command-center");
    expect(resolveReturnPath("?returnTo=https%3A%2F%2Fexample.com", "/bateekha")).toBe("/bateekha");
    expect(resolveReturnPath("?returnTo=%2F%2Fevil.example", "/bateekha")).toBe("/bateekha");
    expect(resolveReturnPath("", "/v2")).toBe("/v2");
  });

  it("carries the immediate source page through report links without losing an existing query", () => {
    expect(withReturnPath("/bateekha?tab=unified_group_cashflow", "/command-center"))
      .toBe("/bateekha?tab=unified_group_cashflow&returnTo=%2Fcommand-center");
    expect(withReturnPath("/v2/payment-plan", "/bateekha?tab=sales&returnTo=%2Fbateekha"))
      .toBe("/v2/payment-plan?returnTo=%2Fbateekha%3Ftab%3Dsales%26returnTo%3D%252Fbateekha");
  });

  it("routes Command Center financial drill-downs back to Command Center", () => {
    const commandCenter = source("client/src/pages/CommandCenterPage.tsx");
    expect(commandCenter).toContain('setActiveBubble("financial_portfolio_standard")');
    expect(commandCenter).toContain('setActiveBubble("financial_portfolio_transposed")');
    expect(commandCenter).toContain('setActiveBubble("financial_unified")');
    expect(commandCenter).toContain('onClick={() => setActiveBubble(null)}');
  });

  it("keeps Financial Studies card navigation one step deep and returns to its actual opener", () => {
    const studies = source("client/src/pages/BateekhaPage.tsx");
    expect(studies).toContain('navigate(withReturnPath(`/bateekha?tab=${tab.id}`, "/bateekha"))');
    expect(studies).toContain("setActiveTab(tab.id)");
    expect(studies).toContain("syncActiveTabFromUrl");
    expect(studies).toContain('window.addEventListener("popstate", syncActiveTabFromUrl)');
    expect(studies).toContain("setActiveTab(null);");
    expect(studies).toContain("resolveReturnPath(");
    expect(studies).toContain("العودة إلى الصفحة السابقة");
    expect(studies).toContain("<V2EscrowCashFlow embedded />");
  });

  it("uses the same safe return contract in financial reports and payment-plan drill-downs", () => {
    [
      "client/src/pages/V2InvestorCashFlow.tsx",
      "client/src/pages/V2EscrowCashFlow.tsx",
      "client/src/pages/V2CapitalPortfolio.tsx",
      "client/src/pages/V2Feasibility.tsx",
      "client/src/pages/V2PaymentPlan.tsx",
      "client/src/pages/V2WaelSales.tsx",
    ].forEach((path) => expect(source(path)).toContain("returnNavigation"));
    expect(source("client/src/pages/V2WaelSales.tsx")).toContain('withReturnPath("/v2/payment-plan", location)');
    expect(source("client/src/pages/V2PaymentPlan.tsx").match(/العودة إلى المبيعات/g)).toHaveLength(2);
    expect(source("client/src/pages/V2EscrowCashFlow.tsx")).toContain("embedded = false");
  });

  it("preserves the immediate source across approvals and consultant workflow pages", () => {
    expect(source("client/src/pages/PaymentRequests.tsx")).toContain('withReturnPath("/approval-settings", location)');
    expect(source("client/src/pages/ApprovalSettings.tsx")).toContain("resolveReturnPath(");
    expect(source("client/src/pages/ConsultantPortalPage.tsx")).toContain('withReturnPath(item.href, "/consultant-portal")');
    [
      "client/src/pages/ConsultantCommitteePage.tsx",
      "client/src/pages/ConsultantGuidePage.tsx",
      "client/src/pages/ConsultantKnowPage.tsx",
      "client/src/pages/ConsultantRecommendPage.tsx",
      "client/src/pages/ContractDeliverablesPage.tsx",
      "client/src/pages/GoogleConnectPage.tsx",
      "client/src/pages/CommitteeDecisionPage.tsx",
      "client/src/pages/ProjectDetailPage.tsx",
      "client/src/pages/ProjectReferencePage.tsx",
    ].forEach((path) => expect(source(path)).toContain("resolveReturnPath("));
  });

  it("returns from the true-cost report to the immediately preceding results screen", () => {
    expect(source("client/src/pages/CPAPage.tsx")).toContain('onBack={() => setScreen("results")}');
  });
});
