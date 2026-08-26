import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../server/db.ts";
import { projects, waelSalesPlans } from "../drizzle/schema.ts";
import { rebuildOffPlanSalesResultsFromPaymentPlan } from "../client/src/lib/salesPlanCashFlow.ts";

const projectId = Number(process.argv[2]);
if (!Number.isInteger(projectId) || projectId <= 0) throw new Error("A valid project id is required");

const db = await getDb();
if (!db) throw new Error("Database unavailable");
const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
const [plan] = await db.select().from(waelSalesPlans)
  .where(eq(waelSalesPlans.projectId, projectId))
  .orderBy(desc(waelSalesPlans.updatedAt), desc(waelSalesPlans.id))
  .limit(1);
if (!project || !plan) throw new Error(`Project or sales plan not found for ${projectId}`);
if (!["offplan_escrow", "offplan_construction"].includes(String(project.financingScenario || ""))) {
  throw new Error("This rebuild is limited to off-plan projects");
}
if (!plan.paymentPlanJson) throw new Error("Saved payment plan calendar is missing");

const rebuilt = rebuildOffPlanSalesResultsFromPaymentPlan({
  project,
  totalRevenue: Number(plan.totalRevenue),
  offplanPct: Number(plan.offplanPct ?? 80),
  salesAbsorptionJson: plan.salesAbsorptionJson,
  paymentPlanJson: plan.paymentPlanJson,
  existingResultsJson: plan.resultsJson,
});

await db.update(waelSalesPlans).set({
  salesAbsorptionJson: rebuilt.salesAbsorptionJson,
  resultsJson: rebuilt.resultsJson,
  status: "draft",
}).where(and(eq(waelSalesPlans.id, plan.id), eq(waelSalesPlans.projectId, projectId)));

console.log(JSON.stringify({
  projectId,
  planId: plan.id,
  status: "draft",
  salesStartMonth: rebuilt.salesStartMonth,
  projectEndMonth: rebuilt.projectEndMonth,
  salesMonths: rebuilt.salesDistribution.length,
  soldUnits: rebuilt.salesDistribution.reduce((sum, units) => sum + units, 0),
  totalReceipts: rebuilt.actualCashInflow.reduce((sum, amount) => sum + amount, 0),
  postHandoverEscrowReceipts: rebuilt.actualEscrowCashInflow
    .slice(rebuilt.projectEndMonth)
    .reduce((sum, amount) => sum + amount, 0),
}, null, 2));
process.exit(0);
