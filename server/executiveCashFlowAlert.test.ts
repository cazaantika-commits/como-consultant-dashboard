import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const alertSource = readFileSync("client/src/components/ExecutiveCashFlowAlert.tsx", "utf8");
const commandCenterSource = readFileSync("client/src/pages/CommandCenterPage.tsx", "utf8");

describe("Executive cash-flow alert", () => {
  it("uses only the Unified Group Cash Flow source rather than a legacy portfolio or parallel calculation", () => {
    expect(alertSource).toContain("getUnifiedGroupCashFlows");
    expect(alertSource).toContain("buildUnifiedGroupLiquidity");
    expect(alertSource).toContain("negative = funding required");
    expect(alertSource).not.toContain("getPortfolioInvestorNetCashFlows");
    expect(alertSource).not.toContain("getPortfolioEscrowLiquidity");
    expect(alertSource).not.toContain("buildExecutivePortfolioLiquidity");
  });

  it("keeps the executive view read-only and offers the full Financial Studies report", () => {
    expect(alertSource).toContain("التزامات المجموعة القادمة");
    expect(alertSource).toContain("مطلوب من المستثمرين");
    expect(alertSource).toContain("صافي التمويل بعد العوائد");
    expect(alertSource).toContain("أشهر قادمة");
    expect(alertSource).toContain("فتح تقرير التدفقات الموحد");
    expect(alertSource).not.toContain("إنذار مبكر: عجز سيولة في حسابات الضمان");
    expect(commandCenterSource).toContain("ExecutiveCashFlowAlert");
    expect(commandCenterSource).toContain('navigate("/bateekha?tab=unified_group_cashflow")');
    expect(commandCenterSource).not.toContain('navigate("/bateekha?tab=portfolio_escrow_liquidity")');
  });
});
