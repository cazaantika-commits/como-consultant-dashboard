import { describe, expect, it } from "vitest";
import {
  getFallbackFinancialStudiesTab,
  isFinancialStudiesGeneralInputVisible,
  isFinancialStudiesSettingsItemVisible,
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
    expect(isFinancialStudiesTabVisible("settings", "build_for_sale")).toBe(true);
    expect(isFinancialStudiesTabVisible("timeline", "build_for_sale")).toBe(true);
    expect(isFinancialStudiesTabVisible("marketing", "build_for_sale")).toBe(false);
    expect(isFinancialStudiesTabVisible("escrow", "build_for_sale")).toBe(false);
  });

  it("returns General Inputs if a hidden Off-Plan tab was active during reclassification", () => {
    expect(getFallbackFinancialStudiesTab("escrow", "build_for_sale")).toBe("general");
    expect(getFallbackFinancialStudiesTab("sales", "build_for_sale")).toBe("sales");
    expect(getFallbackFinancialStudiesTab("escrow", "offplan_escrow")).toBe("escrow");
  });

  it("removes only Off-Plan-specific General Inputs for build-for-sale projects", () => {
    expect(isFinancialStudiesGeneralInputVisible("reraProjectRegFee", "build_for_sale")).toBe(false);
    expect(isFinancialStudiesGeneralInputVisible("escrowAccountFee", "build_for_sale")).toBe(false);
    expect(isFinancialStudiesGeneralInputVisible("bankFees", "build_for_sale")).toBe(false);
    expect(isFinancialStudiesGeneralInputVisible("reraAuditReportFee", "build_for_sale")).toBe(false);
    expect(isFinancialStudiesGeneralInputVisible("reraInspectionReportFee", "build_for_sale")).toBe(false);
    expect(isFinancialStudiesGeneralInputVisible("developerNocFee", "build_for_sale")).toBe(true);
    expect(isFinancialStudiesGeneralInputVisible("bankFees", "offplan_escrow")).toBe(true);
  });

  it("hides Off-Plan settings rules while retaining build-for-sale design and construction controls", () => {
    expect(isFinancialStudiesSettingsItemVisible("designs", "build_for_sale")).toBe(true);
    expect(isFinancialStudiesSettingsItemVisible("construction", "build_for_sale")).toBe(true);
    expect(isFinancialStudiesSettingsItemVisible("reraApprovals", "build_for_sale")).toBe(false);
    expect(isFinancialStudiesSettingsItemVisible("reraProjectReg", "build_for_sale")).toBe(false);
    expect(isFinancialStudiesSettingsItemVisible("escrowDeposit", "build_for_sale")).toBe(false);
    expect(isFinancialStudiesSettingsItemVisible("bankFees", "build_for_sale")).toBe(false);
    expect(isFinancialStudiesSettingsItemVisible("reraAuditorQuarterlyFee", "build_for_sale")).toBe(false);
    expect(isFinancialStudiesSettingsItemVisible("surveyorDwg", "build_for_sale")).toBe(false);
    expect(isFinancialStudiesSettingsItemVisible("reraUnitReg", "build_for_sale")).toBe(true);
    expect(isFinancialStudiesSettingsItemVisible("reraUnitRegistrationFee", "build_for_sale")).toBe(true);
    expect(isFinancialStudiesSettingsItemVisible("reraProjectReg", "offplan_escrow")).toBe(true);
  });

  it("hides sales, marketing, and escrow for build-for-rent projects", () => {
    expect(isFinancialStudiesTabVisible("sales", "build_for_rent")).toBe(false);
    expect(isFinancialStudiesTabVisible("marketing", "build_for_rent")).toBe(false);
    expect(isFinancialStudiesTabVisible("escrow", "build_for_rent")).toBe(false);
    expect(isFinancialStudiesTabVisible("construction", "build_for_rent")).toBe(true);
    expect(isFinancialStudiesTabVisible("settings", "build_for_rent")).toBe(true);
    expect(isFinancialStudiesTabVisible("cashflows", "build_for_rent")).toBe(true);
    expect(isFinancialStudiesTabVisible("feasibility", "build_for_rent")).toBe(true);
    expect(isFinancialStudiesGeneralInputVisible("bankFees", "build_for_rent")).toBe(false);
  });
});
