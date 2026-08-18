import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const alertSource = readFileSync("client/src/components/ExecutiveCashFlowAlert.tsx", "utf8");
const commandCenterSource = readFileSync("client/src/pages/CommandCenterPage.tsx", "utf8");

describe("Executive cash-flow alert", () => {
  it("uses the verified portfolio investor-net source rather than creating a parallel calculation", () => {
    expect(alertSource).toContain("getPortfolioInvestorNetCashFlows");
    expect(alertSource).toContain("alignPortfolioMonthlyNetFlows");
    expect(alertSource).toContain("negative = investor funding required");
  });

  it("keeps the executive view read-only and offers the full Financial Studies report", () => {
    expect(alertSource).toContain("التزامات المحفظة القادمة");
    expect(alertSource).toContain("مطلوب من المستثمرين");
    expect(alertSource).toContain("فتح التقرير المجمّع الكامل");
    expect(commandCenterSource).toContain("ExecutiveCashFlowAlert");
    expect(commandCenterSource).toContain('navigate("/bateekha?tab=portfolio")');
  });
});
