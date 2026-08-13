import { describe, expect, it } from "vitest";
import {
  getFallbackFinancialStudiesTab,
  isFinancialStudiesTabVisible,
} from "../client/src/lib/financialStudiesNavigation";

describe("Financial Studies build-for-sale navigation", () => {
  it("hides only the Off-Plan-only tabs for an independent build-for-sale project", () => {
    expect(isFinancialStudiesTabVisible("general", "build_for_sale")).toBe(true);
    expect(isFinancialStudiesTabVisible("units", "build_for_sale")).toBe(true);
    expect(isFinancialStudiesTabVisible("construction", "build_for_sale")).toBe(true);
    expect(isFinancialStudiesTabVisible("sales", "build_for_sale")).toBe(true);
    expect(isFinancialStudiesTabVisible("cashflows", "build_for_sale")).toBe(true);
    expect(isFinancialStudiesTabVisible("feasibility", "build_for_sale")).toBe(true);
    expect(isFinancialStudiesTabVisible("marketing", "build_for_sale")).toBe(false);
    expect(isFinancialStudiesTabVisible("escrow", "build_for_sale")).toBe(false);
    expect(isFinancialStudiesTabVisible("settings", "build_for_sale")).toBe(false);
  });

  it("returns General Inputs if a hidden Off-Plan tab was active during reclassification", () => {
    expect(getFallbackFinancialStudiesTab("escrow", "build_for_sale")).toBe("general");
    expect(getFallbackFinancialStudiesTab("sales", "build_for_sale")).toBe("sales");
    expect(getFallbackFinancialStudiesTab("escrow", "offplan_escrow")).toBe("escrow");
  });
});
