import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Feasibility Study investor decision layer", () => {
  const source = fs.readFileSync(
    path.resolve(process.cwd(), "client/src/pages/V2Feasibility.tsx"),
    "utf8",
  );

  it("keeps project margin and investor capital return as distinct ratios", () => {
    expect(source).toContain("const projectMarginOnCost = totalCosts > 0 ? (profit / totalCosts) * 100 : 0;");
    expect(source).toContain("const investorReturnOnCapital = capital.requiredCapital > 0 ? (investorProfit / capital.requiredCapital) * 100 : 0;");
    expect(source).toContain("هامش ربح المشروع على التكلفة الكلية");
    expect(source).toContain("عائد المستثمر على رأس المال المستخدم");
    expect(source).not.toContain("const profitOnCost =");
  });

  it("places revenue, cost, project profit, and capital timing in a decision canvas above the retained detail cards", () => {
    expect(source).toContain("قرار المستثمر");
    expect(source).toContain("إيرادات البيع المعتمدة");
    expect(source).toContain("إجمالي تكلفة المشروع");
    expect(source).toContain("ربح المشروع قبل حصة كومو");
    expect(source).toContain("التزام رأس المال للمستثمر");
    expect(source).toContain("ذروة السيولة المطلوبة");
    expect(source).toContain("title=\"التكاليف\"");
    expect(source).toContain("title=\"تفاصيل المشروع\"");
  });

  it("preserves the existing pricing, investor cash-flow, and capital-summary sources", () => {
    expect(source).toContain("calculateProjectCosts(project)");
    expect(source).toContain("computeInvestorCashFlow(project || null, scenario, undefined, salesResult)");
    expect(source).toContain("calculateInvestorCapitalSummary(cashFlow)");
    expect(source).toContain("trpc.waelSalesPlan.getByProject.useQuery");
  });
});
