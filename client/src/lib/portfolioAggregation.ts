import type { FinancialTraceBreakdown } from "@/lib/financialTraceBreakdown";

export type PortfolioProjectMonthlyNet = {
  projectId: number;
  name: string | null;
  financingScenario: string;
  startDate: string;
  monthDates: string[];
  /** Monthly amounts paid out by the investor, always non-negative. */
  monthlyDebit?: number[];
  /** Monthly amounts returned to the investor, always non-negative. */
  monthlyCredit?: number[];
  monthlyNet: number[];
  monthlyTrace?: FinancialTraceBreakdown[];
};

export type CalendarAlignedRow = {
  projectId: number;
  name: string;
  financingScenario: string;
  values: number[];
  debitValues: number[];
  creditValues: number[];
  monthlyTrace?: FinancialTraceBreakdown[];
};

export type CalendarAlignedPortfolio = {
  monthDates: string[];
  rows: CalendarAlignedRow[];
  debitTotals: number[];
  creditTotals: number[];
  totals: number[];
  cumulativeTotals: number[];
};

export type PortfolioPeriod = {
  startDate: string;
  endDate: string;
  values: number[];
};

export type GroupedCalendarPortfolio = {
  periods: PortfolioPeriod[];
  rows: CalendarAlignedRow[];
  debitTotals: number[];
  creditTotals: number[];
  totals: number[];
  cumulativeTotals: number[];
};

/**
 * Aligns each project's final monthly net investor-cash-flow row onto a shared
 * calendar. The visible range starts at the earliest actual non-zero project
 * cash flow and ends at the latest one; a project contributes zero outside its
 * own real timeline.
 */
export function alignPortfolioMonthlyNetFlows(
  projects: PortfolioProjectMonthlyNet[],
): CalendarAlignedPortfolio {
  const activeMonthDates = projects.flatMap((project) =>
    project.monthDates.filter((date, index) =>
      Math.abs(Number(project.monthlyNet[index]) || 0) > 0.000001
      || Math.abs(Number(project.monthlyDebit?.[index]) || 0) > 0.000001
      || Math.abs(Number(project.monthlyCredit?.[index]) || 0) > 0.000001,
    ),
  );
  const firstActiveMonth = [...activeMonthDates].sort()[0];
  const lastActiveMonth = [...activeMonthDates].sort().at(-1);
  const monthDates: string[] = [];
  if (firstActiveMonth && lastActiveMonth) {
    const [firstYear, firstMonth] = firstActiveMonth.split("-").map(Number);
    const [lastYear, lastMonth] = lastActiveMonth.split("-").map(Number);
    for (let value = firstYear * 12 + firstMonth - 1; value <= lastYear * 12 + lastMonth - 1; value++) {
      monthDates.push(`${Math.floor(value / 12)}-${String((value % 12) + 1).padStart(2, "0")}`);
    }
  }

  const rows = projects.map((project) => {
    const monthlyByDate = new Map<string, number>();
    const debitByDate = new Map<string, number>();
    const creditByDate = new Map<string, number>();
    const traceByDate = new Map<string, FinancialTraceBreakdown>();
    project.monthDates.forEach((date, index) => {
      monthlyByDate.set(date, Number(project.monthlyNet[index]) || 0);
      const trace = project.monthlyTrace?.[index];
      if (trace) traceByDate.set(date, trace);
      debitByDate.set(date, Number(project.monthlyDebit?.[index] ?? trace?.expenseTotal ?? Math.max(-(Number(project.monthlyNet[index]) || 0), 0)) || 0);
      creditByDate.set(date, Number(project.monthlyCredit?.[index] ?? trace?.receiptTotal ?? Math.max(Number(project.monthlyNet[index]) || 0, 0)) || 0);
    });
    return {
      projectId: project.projectId,
      name: project.name || `مشروع ${project.projectId}`,
      financingScenario: project.financingScenario,
      values: monthDates.map((date) => monthlyByDate.get(date) || 0),
      debitValues: monthDates.map((date) => debitByDate.get(date) || 0),
      creditValues: monthDates.map((date) => creditByDate.get(date) || 0),
      monthlyTrace: project.monthlyTrace ? monthDates.map((date) => traceByDate.get(date) || {
        expenses: [], receipts: [], expenseTotal: 0, receiptTotal: 0, net: 0,
      }) : undefined,
    };
  });
  const totals = monthDates.map((_, monthIndex) => rows.reduce((sum, row) => sum + (row.values[monthIndex] || 0), 0));

  return {
    monthDates,
    rows,
    debitTotals: monthDates.map((_, monthIndex) => rows.reduce((sum, row) => sum + (row.debitValues[monthIndex] || 0), 0)),
    creditTotals: monthDates.map((_, monthIndex) => rows.reduce((sum, row) => sum + (row.creditValues[monthIndex] || 0), 0)),
    totals,
    cumulativeTotals: totals.reduce<number[]>((all, value) => {
      all.push((all[all.length - 1] || 0) + value);
      return all;
    }, []),
  };
}

/** Groups adjacent real calendar months without altering the underlying monthly source values. */
export function groupCalendarAlignedPortfolio(
  portfolio: CalendarAlignedPortfolio,
  groupSize: 1 | 3 | 4 | 6,
): GroupedCalendarPortfolio {
  const periods: PortfolioPeriod[] = [];
  for (let start = 0; start < portfolio.monthDates.length; start += groupSize) {
    const end = Math.min(start + groupSize, portfolio.monthDates.length);
    periods.push({
      startDate: portfolio.monthDates[start],
      endDate: portfolio.monthDates[end - 1],
      values: portfolio.rows.map((row) => row.values.slice(start, end).reduce((sum, value) => sum + value, 0)),
    });
  }

  return {
    periods,
    rows: portfolio.rows.map((row, rowIndex) => ({
      ...row,
      values: periods.map((period) => period.values[rowIndex] || 0),
      debitValues: periods.map((_, periodIndex) => row.debitValues.slice(periodIndex * groupSize, (periodIndex + 1) * groupSize).reduce((sum, value) => sum + value, 0)),
      creditValues: periods.map((_, periodIndex) => row.creditValues.slice(periodIndex * groupSize, (periodIndex + 1) * groupSize).reduce((sum, value) => sum + value, 0)),
      monthlyTrace: row.monthlyTrace ? periods.map((_, periodIndex) => {
        const details = row.monthlyTrace?.slice(periodIndex * groupSize, (periodIndex + 1) * groupSize) || [];
        const merge = (kind: "expenses" | "receipts") => {
          const valuesByName = new Map<string, number>();
          for (const detail of details) for (const item of detail[kind]) valuesByName.set(item.name, (valuesByName.get(item.name) || 0) + item.value);
          return [...valuesByName.entries()].map(([name, value]) => ({ name, value })).filter((item) => Math.abs(item.value) > 0.000001);
        };
        const expenses = merge("expenses");
        const receipts = merge("receipts");
        const expenseTotal = expenses.reduce((sum, item) => sum + item.value, 0);
        const receiptTotal = receipts.reduce((sum, item) => sum + item.value, 0);
        return { expenses, receipts, expenseTotal, receiptTotal, net: receiptTotal - expenseTotal };
      }) : undefined,
    })),
    debitTotals: periods.map((_, periodIndex) => portfolio.debitTotals.slice(periodIndex * groupSize, (periodIndex + 1) * groupSize).reduce((sum, value) => sum + value, 0)),
    creditTotals: periods.map((_, periodIndex) => portfolio.creditTotals.slice(periodIndex * groupSize, (periodIndex + 1) * groupSize).reduce((sum, value) => sum + value, 0)),
    totals: periods.map((period) => period.values.reduce((sum, value) => sum + value, 0)),
    cumulativeTotals: periods.map((period) => portfolio.cumulativeTotals[Math.min(portfolio.cumulativeTotals.length - 1, portfolio.monthDates.indexOf(period.endDate))] || 0),
  };
}
