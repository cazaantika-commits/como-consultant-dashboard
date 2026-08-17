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

  it("keeps readable table text with compact one-unit vertical data-row padding", () => {
    expect(source).toContain('className="w-full text-xs border-collapse min-w-max"');
    expect(source).toContain('px-3 py-1 text-gray-800 font-semibold');
    expect(source).toContain('px-1.5 py-1 text-center tabular-nums');
    expect(source).not.toContain('px-3 py-2 text-gray-800 font-semibold');
    expect(source).not.toContain('px-1.5 py-2 text-center tabular-nums');
  });
});
