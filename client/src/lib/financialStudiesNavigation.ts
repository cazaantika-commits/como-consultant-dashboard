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
  | "portfolio";

const BUILD_FOR_SALE_HIDDEN_TABS: FinancialStudiesTabId[] = [
  "marketing",
  "timeline",
  "settings",
  "escrow",
  "mall",
];

export function isFinancialStudiesTabVisible(
  tabId: FinancialStudiesTabId,
  projectType?: string | null,
): boolean {
  return projectType !== "build_for_sale" || !BUILD_FOR_SALE_HIDDEN_TABS.includes(tabId);
}

export function getFallbackFinancialStudiesTab(
  activeTab: FinancialStudiesTabId,
  projectType?: string | null,
): FinancialStudiesTabId {
  return isFinancialStudiesTabVisible(activeTab, projectType) ? activeTab : "general";
}
