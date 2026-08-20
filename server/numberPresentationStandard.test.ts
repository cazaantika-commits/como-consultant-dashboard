import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { formatFullNumber, formatRateOrPercent, unformatNumberInput } from "../client/src/lib/numberFormat";

describe("application-wide full-number presentation", () => {
  it("rounds monetary values to full grouped amounts", () => {
    expect(formatFullNumber(122000000)).toBe("122,000,000");
    expect(formatFullNumber("755555.56")).toBe("755,556");
    expect(formatFullNumber("1.415")).toBe("1");
    expect(formatFullNumber("1.400")).toBe("1");
    expect(formatFullNumber(112703670.20129998)).toBe("112,703,670");
    expect(formatFullNumber(-456000)).toBe("-456,000");
  });

  it("retains decimals only in the dedicated rate and percentage formatter", () => {
    expect(formatRateOrPercent("1.415")).toBe("1.42");
    expect(formatRateOrPercent("1.400")).toBe("1.4");
  });

  it("keeps raw numeric input values free of display grouping", () => {
    expect(unformatNumberInput("122,000,000.00")).toBe("122000000.00");
  });

  it("uses the shared standard in current Financial Studies and executive financial surfaces", () => {
    const files = [
      "client/src/pages/GeneralInputsPage.tsx",
      "client/src/pages/V2InvestorCashFlow.tsx",
      "client/src/pages/V2EscrowCashFlow.tsx",
      "client/src/pages/V2Feasibility.tsx",
      "client/src/pages/V2CapitalPortfolio.tsx",
      "client/src/pages/ConstructionInputsPage.tsx",
      "client/src/pages/CashFlowComparisonPage.tsx",
      "client/src/pages/CashFlowReflectionPage.tsx",
      "client/src/components/ExecutiveCashFlowAlert.tsx",
    ];

    for (const file of files) {
      const source = fs.readFileSync(path.resolve(process.cwd(), file), "utf8");
      expect(source, file).toContain("formatFullNumber");
      expect(source, file).not.toMatch(/1_000_000\).*toFixed.*[Mmك]|1_000\).*toFixed.*[Kkك]|\+\s*["'][مكMK]["']/);
    }
  });
});
