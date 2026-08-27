import { desc } from "drizzle-orm";
import { getDb } from "../server/db.ts";
import { projects, waelSalesPlans } from "../drizzle/schema.ts";
import { computeInvestorCashFlow } from "../client/src/lib/investorCashFlowEngine.ts";
import { calculateInvestorMonthlyNet } from "../client/src/lib/investorCashFlowNet.ts";
import { buildInvestorMonthlyTrace } from "../client/src/lib/financialTraceBreakdown.ts";
import { buildSalesResultFromSavedPlan } from "../client/src/lib/salesPlanCashFlow.ts";
import { isCapitalPortfolioEligibleScenario } from "../client/src/lib/portfolioReportRules.ts";
import { buildUnifiedGroupCashFlow } from "../client/src/lib/unifiedGroupCashFlow.ts";

const FILS = 0.001;
const db = await getDb();
if (!db) throw new Error("Database unavailable");

const [allProjects, allPlans] = await Promise.all([
  db.select().from(projects),
  db.select().from(waelSalesPlans).orderBy(desc(waelSalesPlans.updatedAt)),
]);
const newestPlanByProject = new Map();
for (const plan of allPlans) if (!newestPlanByProject.has(plan.projectId)) newestPlanByProject.set(plan.projectId, plan);

const sourceRows = allProjects.map((project) => {
  const scenario = project.financingScenario || "offplan_escrow";
  const isCommercialDevelopment = scenario === "build_for_rent" || scenario === "rental";
  const salesResult = isCommercialDevelopment ? undefined : buildSalesResultFromSavedPlan(newestPlanByProject.get(project.id), project, scenario);
  const cashFlow = computeInvestorCashFlow(project, scenario, undefined, salesResult);
  const investorNet = calculateInvestorMonthlyNet(cashFlow, salesResult);
  return {
    projectId: project.id,
    name: project.name,
    financingScenario: scenario,
    startDate: cashFlow.startDate,
    monthDates: cashFlow.monthDates.slice(0, investorNet.netFlow.length),
    monthlyDebit: investorNet.debitTotals,
    monthlyCredit: investorNet.creditTotals,
    monthlyNet: investorNet.netFlow,
    paidBeforeSchedule: investorNet.paidBeforeSchedule,
    monthlyTrace: buildInvestorMonthlyTrace(cashFlow, salesResult),
    sourceKind: isCommercialDevelopment ? "commercial_development" : "investor_cash_flow",
    sourceLabel: isCommercialDevelopment ? "صف تدفقات تطوير المركز التجاري قبل التشغيل" : "صف صافي الشهر النهائي من تدفقات المستثمر",
    scopeNote: isCommercialDevelopment ? "يشمل تكاليف التطوير المعتمدة فقط؛ لا توجد توقعات إيجار أو مصروفات تشغيل في هذا التقرير." : undefined,
    includesOperatingCashFlows: false,
  };
});

const report = buildUnifiedGroupCashFlow(sourceRows);
const projectChecks = sourceRows.map((source) => {
  const aligned = report.rows.find((row) => row.projectId === source.projectId);
  const byDate = new Map(source.monthDates.map((date, index) => [date, source.monthlyNet[index] || 0]));
  const maxDifference = report.monthDates.reduce((max, date, index) => Math.max(max, Math.abs((aligned?.values[index] || 0) - (byDate.get(date) || 0))), 0);
  return { projectId: source.projectId, name: source.name, scenario: source.financingScenario, sourceKind: source.sourceKind, maxDifference, passes: maxDifference < FILS };
});
const totalChecks = report.monthDates.map((date, index) => ({
  date,
  difference: (report.totals[index] || 0) - report.rows.reduce((sum, row) => sum + (row.values[index] || 0), 0),
}));
const cumulativeChecks = report.totals.map((_, index) => ({
  index,
  difference: (report.cumulativeTotals[index] || 0) - (-report.paidBeforeScheduleTotal + report.totals.slice(0, index + 1).reduce((sum, value) => sum + value, 0)),
}));
const commercialCenter = sourceRows.find((project) => project.sourceKind === "commercial_development");
const audit = {
  asOf: new Date().toISOString(),
  report: { projectCount: report.rows.length, monthCount: report.monthDates.length, firstMonth: report.monthDates[0], lastMonth: report.monthDates.at(-1) },
  projects: projectChecks,
  commercialCenter: commercialCenter && {
    projectId: commercialCenter.projectId,
    name: commercialCenter.name,
    includedInUnifiedReport: report.rows.some((row) => row.projectId === commercialCenter.projectId),
    excludedFromCapitalPortfolio: !isCapitalPortfolioEligibleScenario(commercialCenter.financingScenario),
    sourceKind: commercialCenter.sourceKind,
    totalCredits: commercialCenter.monthlyCredit.reduce((sum, value) => sum + value, 0),
    includesOperatingCashFlows: commercialCenter.includesOperatingCashFlows,
  },
  acceptance: {
    everyUnifiedProjectRowCopiesFinalSource: projectChecks.every((check) => check.passes),
    everyGroupMonthEqualsSumOfProjectRows: totalChecks.every((check) => Math.abs(check.difference) < FILS),
    everyCumulativeGroupMonthEqualsRunningNet: cumulativeChecks.every((check) => Math.abs(check.difference) < FILS),
    commercialCenterIncludedOnlyAsDevelopment: Boolean(commercialCenter)
      && commercialCenter.sourceKind === "commercial_development"
      && commercialCenter.monthlyCredit.every((value) => Math.abs(value) < FILS)
      && !commercialCenter.includesOperatingCashFlows,
  },
};

console.log(JSON.stringify(audit, null, 2));
process.exit(Object.values(audit.acceptance).every(Boolean) ? 0 : 1);
