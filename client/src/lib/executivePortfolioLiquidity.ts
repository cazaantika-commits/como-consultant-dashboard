import {
  alignPortfolioMonthlyNetFlows,
  type PortfolioProjectMonthlyNet,
} from "./portfolioAggregation";

export type ExecutivePortfolioDriver = {
  projectId: number;
  name: string;
  value: number;
};

export type ExecutivePortfolioMonth = {
  monthDate: string;
  total: number;
  required: number;
  returned: number;
  netFunding: number;
  drivers: ExecutivePortfolioDriver[];
  requiredDrivers: ExecutivePortfolioDriver[];
  returnedDrivers: ExecutivePortfolioDriver[];
};

export type ExecutivePortfolioLiquidity = {
  months: ExecutivePortfolioMonth[];
  summary: {
    required: number;
    returned: number;
    netFunding: number;
  };
  peakMonth: ExecutivePortfolioMonth | null;
  peakKind: "required" | "returned" | null;
};

function currentMonthDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * A read-only executive view over the signed net monthly rows already used by
 * Project Aggregation. Negative values require investor funding; positive
 * values are investor receipts. No calculation engine is duplicated here.
 */
export function buildExecutivePortfolioLiquidity(
  projects: PortfolioProjectMonthlyNet[],
  options: { horizon?: number; asOfMonth?: string } = {},
): ExecutivePortfolioLiquidity {
  const horizon = options.horizon ?? 4;
  const portfolio = alignPortfolioMonthlyNetFlows(projects);
  const asOfMonth = options.asOfMonth ?? currentMonthDate();
  const firstFutureIndex = portfolio.monthDates.findIndex((monthDate) => monthDate >= asOfMonth);
  const startIndex = firstFutureIndex >= 0 ? firstFutureIndex : Math.max(portfolio.monthDates.length - horizon, 0);

  const months = portfolio.monthDates.slice(startIndex, startIndex + horizon).map((monthDate, offset) => {
    const index = startIndex + offset;
    const total = portfolio.totals[index] || 0;
    const drivers = portfolio.rows
      .map((row) => ({ projectId: row.projectId, name: row.name, value: row.values[index] || 0 }))
      .filter((row) => Math.abs(row.value) > 0.000001)
      .sort((left, right) => Math.abs(right.value) - Math.abs(left.value));
    const requiredDrivers = drivers.filter((driver) => driver.value < -0.000001);
    const returnedDrivers = drivers.filter((driver) => driver.value > 0.000001);
    return {
      monthDate,
      total,
      required: Math.max(-total, 0),
      returned: Math.max(total, 0),
      netFunding: Math.max(-total, 0) - Math.max(total, 0),
      drivers,
      requiredDrivers,
      returnedDrivers,
    };
  });

  const summary = months.reduce(
    (accumulator, month) => ({
      required: accumulator.required + month.required,
      returned: accumulator.returned + month.returned,
      netFunding: accumulator.netFunding + month.netFunding,
    }),
    { required: 0, returned: 0, netFunding: 0 },
  );

  const hasRequired = months.some((month) => month.required > 0.000001);
  const peakMonth = months.reduce<ExecutivePortfolioMonth | null>((peak, month) => {
    if (!peak) return month;
    const currentValue = hasRequired ? month.required : month.returned;
    const peakValue = hasRequired ? peak.required : peak.returned;
    return currentValue > peakValue ? month : peak;
  }, null);

  return {
    months,
    summary,
    peakMonth,
    peakKind: peakMonth ? (hasRequired ? "required" : "returned") : null,
  };
}
