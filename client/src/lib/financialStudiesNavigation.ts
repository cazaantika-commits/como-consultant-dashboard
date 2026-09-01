export type FinancialStudiesTabId =
  | "general"
  | "units"
  | "construction"
  | "sales"
  | "marketing"
  | "timeline"
  | "settings"
  | "cashflows"
  | "escrow"
  | "feasibility"
  | "mall"
  | "capital_portfolio"
  | "unified_group_cashflow";

const BUILD_FOR_SALE_HIDDEN_TABS: FinancialStudiesTabId[] = [
  "marketing",
  "escrow",
  "mall",
];

const BUILD_FOR_RENT_HIDDEN_TABS: FinancialStudiesTabId[] = [
  "sales",
  "marketing",
  "timeline",
  "escrow",
  "mall",
];

export const BUILD_FOR_SALE_HIDDEN_GENERAL_INPUT_KEYS = [
  "reraProjectRegFee",
  "escrowAccountFee",
  "bankFees",
  "reraAuditReportFee",
  "reraInspectionReportFee",
] as const;

const OFFPLAN_ONLY_SETTINGS_ITEM_IDS = [
  "marketingPrep",
  "reraApprovals",
  "marketingLaunch",
  "salesStart",
  "reraAuditorQuarterlyFee",
  "reraInspectionQuarterlyFee",
  "escrowDepositPct",
  "surveyorDwg",
  "reraProjectReg",
  "escrowDeposit",
  "bankFees",
  "marketingPrep",
] as const;

const BUILD_FOR_SALE_ONLY_SETTINGS_ITEM_IDS = [
  "buildForSaleMarketingRate",
  "buildForSaleMarketingStartMonthsBeforeCompletion",
  "buildForSaleMarketingDurationMonths",
] as const;

const BUILD_FOR_RENT_ONLY_SETTINGS_ITEM_IDS = [
  "buildForRentDeveloperFeeDesignRate",
  "buildForRentDeveloperFeeSupervisionRate",
] as const;

export function isFinancialStudiesTabVisible(
  tabId: FinancialStudiesTabId,
  projectType?: string | null,
): boolean {
  if (projectType === "build_for_sale") return !BUILD_FOR_SALE_HIDDEN_TABS.includes(tabId);
  if (projectType === "build_for_rent") return !BUILD_FOR_RENT_HIDDEN_TABS.includes(tabId);
  return true;
}

export function getFallbackFinancialStudiesTab(
  activeTab: FinancialStudiesTabId,
  projectType?: string | null,
): FinancialStudiesTabId {
  return isFinancialStudiesTabVisible(activeTab, projectType) ? activeTab : "general";
}

export function isFinancialStudiesGeneralInputVisible(
  fieldKey: string,
  projectType?: string | null,
): boolean {
  const isNoOffPlanType = projectType === "build_for_sale" || projectType === "build_for_rent";
  return !isNoOffPlanType
    || !BUILD_FOR_SALE_HIDDEN_GENERAL_INPUT_KEYS.includes(fieldKey as typeof BUILD_FOR_SALE_HIDDEN_GENERAL_INPUT_KEYS[number]);
}

/** Keeps Settings & Rules aligned with the same no-Off-Plan scope as General Inputs. */
export function isFinancialStudiesSettingsItemVisible(
  itemId: string,
  projectType?: string | null,
): boolean {
  if (projectType === "build_for_sale") {
    return !OFFPLAN_ONLY_SETTINGS_ITEM_IDS.includes(itemId as typeof OFFPLAN_ONLY_SETTINGS_ITEM_IDS[number])
      && !BUILD_FOR_RENT_ONLY_SETTINGS_ITEM_IDS.includes(itemId as typeof BUILD_FOR_RENT_ONLY_SETTINGS_ITEM_IDS[number]);
  }
  if (projectType === "build_for_rent") {
    return !OFFPLAN_ONLY_SETTINGS_ITEM_IDS.includes(itemId as typeof OFFPLAN_ONLY_SETTINGS_ITEM_IDS[number])
      && !BUILD_FOR_SALE_ONLY_SETTINGS_ITEM_IDS.includes(itemId as typeof BUILD_FOR_SALE_ONLY_SETTINGS_ITEM_IDS[number]);
  }
  return !BUILD_FOR_SALE_ONLY_SETTINGS_ITEM_IDS.includes(itemId as typeof BUILD_FOR_SALE_ONLY_SETTINGS_ITEM_IDS[number])
    && !BUILD_FOR_RENT_ONLY_SETTINGS_ITEM_IDS.includes(itemId as typeof BUILD_FOR_RENT_ONLY_SETTINGS_ITEM_IDS[number]);
}
