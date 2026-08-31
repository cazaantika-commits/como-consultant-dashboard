import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const alertSource = readFileSync("client/src/components/ExecutiveCashFlowAlert.tsx", "utf8");
const commandCenterSource = readFileSync("client/src/pages/CommandCenterPage.tsx", "utf8");

describe("Executive cash-flow alert", () => {
  it("uses only the Unified Group Cash Flow source rather than a legacy portfolio or parallel calculation", () => {
    expect(alertSource).toContain("getUnifiedGroupCashFlows");
    expect(alertSource).toContain("commandCenterToken: memberToken");
    expect(alertSource).toContain("buildUnifiedGroupLiquidity");
    expect(alertSource).toContain("Negative = funding required");
    expect(alertSource).not.toContain("getPortfolioInvestorNetCashFlows");
    expect(alertSource).not.toContain("getPortfolioEscrowLiquidity");
    expect(alertSource).not.toContain("buildExecutivePortfolioLiquidity");
  });

  it("keeps the executive view compact and reconciles group need between projects and Commercial Center", () => {
    expect(alertSource).toContain("احتياج المجموعة خلال الأشهر القادمة");
    expect(alertSource).toContain("إجمالي المطلوب خلال");
    expect(alertSource).toContain("مشاريع البيع والاستثمار");
    expect(alertSource).toContain("تطوير المركز التجاري");
    expect(alertSource).toContain("saleInvestmentNet");
    expect(alertSource).toContain("commercialDevelopmentNet");
    expect(alertSource).toContain("الأشهر القادمة");
    expect(alertSource).not.toContain("صافي المستلم للمستثمرين");
    expect(alertSource).not.toContain("فتح تقرير التدفقات الموحد");
    expect(alertSource).not.toContain("المصدر هو التقرير الموحد نفسه");
    expect(alertSource).not.toContain("إنذار مبكر: عجز سيولة في حسابات الضمان");
    expect(commandCenterSource).toContain("<ExecutiveCashFlowAlert memberToken={token} />");
    expect(commandCenterSource).toContain('setActiveBubble("financial_unified")');
    expect(commandCenterSource).not.toContain('navigate("/bateekha?tab=portfolio_escrow_liquidity")');
  });
});
