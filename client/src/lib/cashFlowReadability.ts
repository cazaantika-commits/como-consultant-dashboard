const ARABIC_MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

/** Presentation-only month header for cash-flow matrices. */
export function formatCashFlowMonthYear(date: string): { month: string; year: string } {
  const [year, month] = date.split("-");
  const monthIndex = Number(month) - 1;
  if (!year || monthIndex < 0 || monthIndex > 11) return { month: "—", year: "" };
  return { month: ARABIC_MONTHS[monthIndex], year };
}

export function sumCashFlowPeriod(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0);
}
