import { inArray } from "drizzle-orm";
import { getDb } from "../server/db";
import { projects, waelSalesPlans } from "../drizzle/schema";
import { buildSalesResultFromSavedPlan } from "../client/src/lib/salesPlanCashFlow";
import { computeInvestorCashFlow } from "../client/src/lib/investorCashFlowEngine";
import { calculateProjectCosts } from "../client/src/lib/projectCostsCalc";

const ids = [2, 3, 4, 5, 6];
const db = await getDb();
if (!db) throw new Error("Database unavailable");
const projectRows = await db.select().from(projects).where(inArray(projects.id, ids));
const planRows = await db.select().from(waelSalesPlans).where(inArray(waelSalesPlans.projectId, ids));
const plans = new Map(planRows.map((plan) => [plan.projectId, plan]));

const output = projectRows.map((project) => {
  const scenario = project.financingScenario || "offplan_escrow";
  const plan = plans.get(project.id);
  if (!plan) return { projectId: project.id, projectName: project.name, status: "missing_plan" };
  const sales = buildSalesResultFromSavedPlan(plan, project, scenario as any);
  const cashFlow = computeInvestorCashFlow(project, scenario as any, undefined, sales);
  const feasibility = calculateProjectCosts(project)!;
  const cashProjectCost = cashFlow.rows
    .filter((row) => !row.isRevenue && !row.isTransfer && !row.isProfitAllocation)
    .reduce((sum, row) => sum + row.totalCost, 0);
  return {
    projectId: project.id,
    projectName: project.name,
    feasibilityTotalCosts: feasibility.totalCosts,
    cashProjectCost,
    costDifference: cashProjectCost - feasibility.totalCosts,
    feasibilityRevenue: feasibility.totalRevenue,
    cashFlowRevenue: cashFlow.totalRevenue,
    revenueDifference: cashFlow.totalRevenue - feasibility.totalRevenue,
    nonProjectCashRows: cashFlow.rows
      .filter((row) => !row.isRevenue && (row.isTransfer || row.isProfitAllocation))
      .map((row) => ({ label: row.label, total: row.totalCost, isTransfer: Boolean(row.isTransfer), isProfitAllocation: Boolean(row.isProfitAllocation) })),
  };
});

console.log(JSON.stringify(output, null, 2));
