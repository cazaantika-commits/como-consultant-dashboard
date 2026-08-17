import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Investor Cash Flow readability layout", () => {
  const source = fs.readFileSync(
    path.resolve(process.cwd(), "client/src/pages/V2InvestorCashFlow.tsx"),
    "utf8",
  );

  it("renders direct expense rows rather than non-decision subsection headings", () => {
    expect(source).toContain("{debitRows.map((item, i) => {");
    expect(source).not.toContain("{sections.map((section, si) => (");
    expect(source).not.toContain("الرسوم الحكومية والتنظيمية");
  });

  it("uses investor-relevant labels while retaining the shared net calculation", () => {
    expect(source).toContain("المبالغ المطلوبة من المستثمر");
    expect(source).toContain("المبالغ المستلمة للمستثمر");
    expect(source).toContain("calculateInvestorMonthlyNet(data, salesResult)");
  });
});
