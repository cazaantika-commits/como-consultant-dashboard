import { describe, expect, it } from "vitest";
import { formatFullNumber, formatRateOrPercent } from "../client/src/lib/numberFormat";

describe("Financial Studies numeric display policy", () => {
  it("rounds monetary amounts to grouped whole values", () => {
    expect(formatFullNumber(23_998_224.58)).toBe("23,998,225");
    expect(formatFullNumber("7,295,415.57")).toBe("7,295,416");
    expect(formatFullNumber(-12.5)).toBe("-13");
  });

  it("preserves meaningful decimals only for rates and percentages", () => {
    expect(formatRateOrPercent(3.5)).toBe("3.5");
    expect(formatRateOrPercent("1.25")).toBe("1.25");
  });
});
