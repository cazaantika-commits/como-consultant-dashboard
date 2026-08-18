import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const readPage = (filename: string) => fs.readFileSync(
  path.resolve(process.cwd(), "client/src/pages", filename),
  "utf8",
);

describe("Cash-flow decision-first presentation", () => {
  const investorSource = readPage("V2InvestorCashFlow.tsx");
  const escrowSource = readPage("V2EscrowCashFlow.tsx");

  it("adds a decision layer to investor cash flow without replacing its monthly audit table or net calculation", () => {
    expect(investorSource).toContain("موقف المستثمر — مباشر");
    expect(investorSource).toContain("أعلى ضغط تمويلي");
    expect(investorSource).toContain("نبض الضغط والعودة الشهري");
    expect(investorSource).toContain("calculateInvestorMonthlyNet(data, salesResult)");
    expect(investorSource).toContain("{debitRows.map((item, i) => {");
    expect(investorSource).toContain("{creditRows.map((item, i) => {");
  });

  it("adds escrow liquidity and settlement signals without changing the established settlement calculation", () => {
    expect(escrowSource).toContain("حساب الضمان — موقف السيولة");
    expect(escrowSource).toContain("مسار الرصيد ومحطات التصفية");
    expect(escrowSource).toContain("تحويل الاحتجاز:");
    expect(escrowSource).toContain("calculateEscrowSettlement({");
    expect(escrowSource).toContain("{escrowOutflows.map((item, i) => {");
    expect(escrowSource).toContain("{inflowRows.map((item, i) => (");
  });
});
