export const EXECUTIVE_PORTFOLIO_MEMBER_ID = "sheikh_issa";

export const EXECUTIVE_PORTFOLIO_REPORTS = [
  { id: "portfolio", label: "تجميع المشاريع", description: "صافي التدفقات لجميع المشاريع" },
  { id: "portfolio_monthly", label: "العرض الشهري", description: "الحركة المجمعة شهرًا بشهر" },
  { id: "portfolio_escrow_liquidity", label: "سيولة الإسكرو", description: "الأرصدة والتنبيهات المبكرة" },
  { id: "capital_portfolio", label: "محفظة رأس المال", description: "التكلفة والعائد ورأس المال" },
] as const;

export type ExecutivePortfolioReportId = (typeof EXECUTIVE_PORTFOLIO_REPORTS)[number]["id"];

export function canOpenExecutivePortfolioReports(memberId: string | null | undefined): boolean {
  return memberId === EXECUTIVE_PORTFOLIO_MEMBER_ID;
}
