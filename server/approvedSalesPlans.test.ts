import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  buildApprovedSalesPlanMap,
  financialReportsRequireApprovedSalesPlan,
  selectLatestApprovedSalesPlan,
} from "./services/approvedSalesPlans";

const readSource = (relativePath: string) => fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("approved sales plan source", () => {
  it("keeps an older approved plan official when a newer draft exists", () => {
    const approved = { id: 10, projectId: 5, status: "approved", updatedAt: "2026-09-20T10:00:00Z" };
    const newerDraft = { id: 11, projectId: 5, status: "draft", updatedAt: "2026-09-28T10:00:00Z" };

    expect(selectLatestApprovedSalesPlan([newerDraft, approved])).toBe(approved);
    expect(buildApprovedSalesPlanMap([newerDraft, approved]).get(5)).toBe(approved);
  });

  it("returns no official source when a project has drafts only", () => {
    expect(selectLatestApprovedSalesPlan([
      { id: 20, projectId: 6, status: "draft", updatedAt: "2026-09-28T10:00:00Z" },
      { id: 19, projectId: 6, status: "submitted", updatedAt: "2026-09-27T10:00:00Z" },
    ])).toBeNull();
  });

  it("selects the latest plan inside the approved set", () => {
    const newestApproved = { id: 31, projectId: 7, status: "approved", updatedAt: "2026-09-28T10:00:00Z" };
    expect(selectLatestApprovedSalesPlan([
      { id: 30, projectId: 7, status: "approved", updatedAt: "2026-09-27T10:00:00Z" },
      newestApproved,
    ])).toBe(newestApproved);
  });

  it("requires approval for every report scenario except build-for-rent", () => {
    expect(financialReportsRequireApprovedSalesPlan("offplan_escrow")).toBe(true);
    expect(financialReportsRequireApprovedSalesPlan("build_for_sale")).toBe(true);
    expect(financialReportsRequireApprovedSalesPlan("joint_venture_land_for_units")).toBe(true);
    expect(financialReportsRequireApprovedSalesPlan("build_for_rent")).toBe(false);
  });
});

describe("financial report integration", () => {
  it("uses the approved-only endpoint on all project report pages", () => {
    for (const file of [
      "client/src/pages/V2InvestorCashFlow.tsx",
      "client/src/pages/V2EscrowCashFlow.tsx",
      "client/src/pages/V2Feasibility.tsx",
      "client/src/pages/TimelinePage.tsx",
    ]) {
      const source = readSource(file);
      expect(source).toContain("waelSalesPlan.getApprovedByProject.useQuery");
      expect(source).toContain("ApprovedSalesPlanRequired");
      expect(source).not.toContain("plansQuery.data?.[0]");
    }
  });

  it("keeps drafts in the sales editors while reports are approved-only", () => {
    const sales = readSource("client/src/pages/V2WaelSales.tsx");
    const payment = readSource("client/src/pages/V2PaymentPlan.tsx");
    expect(sales).toContain("waelSalesPlan.getByProject.useQuery");
    expect(sales).toContain("waelSalesPlan.getApprovedByProject.useQuery");
    expect(payment).toContain("waelSalesPlan.getByProject.useQuery");
  });

  it("does not run the monthly report fallback without an approved plan", () => {
    const source = readSource("server/routers/cashFlowSettings.ts");
    expect(source).toContain('eq(waelSalesPlans.status, "approved")');
    expect(source).toContain("if (waelPlan && revenuePerMonth.every");
    expect(source).toContain('"waiting_approved_sales_plan"');
    expect(source).not.toContain("newestPlanByProject");
  });
});
