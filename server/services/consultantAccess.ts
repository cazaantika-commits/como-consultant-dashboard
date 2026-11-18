import { TRPCError } from "@trpc/server";
import { and, eq, sql } from "drizzle-orm";
import { evaluationApprovals, projectConsultants, evaluatorScores } from "../../drizzle/schema";
import { getDb, getCommitteeDecision } from "../db";
import { requireLegacyProjectRead, requireLegacyProjectWrite, requireLegacyProjectOwner, type LegacyProjectActor } from "./comoLegacyProjectAccess";
import { threeEvaluatorMatrixReady, type Evaluator } from "../../shared/consultantContracts";

export async function consultantDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر التحقق من المصدر" });
  return db;
}

export async function requireConsultantProject(actor: LegacyProjectActor, cpaProjectId: number, required: "read" | "write" | "owner" = "read") {
  if (!actor) throw new TRPCError({ code: "UNAUTHORIZED" });
  const db = await consultantDb();
  const result = await db.execute(sql`SELECT project_id FROM cpa_projects WHERE id = ${cpaProjectId} LIMIT 1`);
  const rows = result[0] as unknown as { project_id: number }[];
  const projectId = Number(rows[0]?.project_id);
  if (!Number.isSafeInteger(projectId) || projectId <= 0) throw new TRPCError({ code: "FORBIDDEN", message: "المشروع خارج نطاق الصلاحية" });
  const guard = required === "owner" ? requireLegacyProjectOwner : required === "write" ? requireLegacyProjectWrite : requireLegacyProjectRead;
  await guard(actor, projectId);
  return projectId;
}

export async function requireConsultantLink(actor: LegacyProjectActor, projectConsultantId: number, required: "read" | "write" | "owner" = "read", expectedCpaProjectId?: number) {
  if (!actor) throw new TRPCError({ code: "UNAUTHORIZED" });
  const db = await consultantDb();
  const result = await db.execute(sql`SELECT cpa_project_id FROM cpa_project_consultants WHERE id = ${projectConsultantId} LIMIT 1`);
  const rows = result[0] as unknown as { cpa_project_id: number }[];
  const cpaProjectId = Number(rows[0]?.cpa_project_id);
  if (!Number.isSafeInteger(cpaProjectId) || cpaProjectId <= 0 || (expectedCpaProjectId !== undefined && expectedCpaProjectId !== cpaProjectId)) throw new TRPCError({ code: "FORBIDDEN", message: "المكتب خارج نطاق المشروع" });
  const projectId = await requireConsultantProject(actor, cpaProjectId, required);
  return { cpaProjectId, projectId };
}

export async function assertCostReportUnlocked(cpaProjectId: number) {
  const db = await consultantDb();
  const result = await db.execute(sql`SELECT is_approved FROM cpa_true_cost_report_approval WHERE cpa_project_id = ${cpaProjectId} LIMIT 1`);
  const rows = result[0] as unknown as { is_approved: number }[];
  if (Number(rows[0]?.is_approved) === 1) throw new TRPCError({ code: "FORBIDDEN", message: "التقرير معتمد ولا يمكن تعديل مصدره" });
}

export async function assertCommitteeUnlocked(projectId: number) {
  const decision = await getCommitteeDecision(projectId);
  if (decision?.isConfirmed === 1) throw new TRPCError({ code: "FORBIDDEN", message: "قرار اللجنة معتمد ومقفل" });
}

export async function assertLinkedOffice(projectId: number, consultantId: number) {
  const db = await consultantDb();
  const rows = await db.select({ id: projectConsultants.id }).from(projectConsultants).where(and(eq(projectConsultants.projectId, projectId), eq(projectConsultants.consultantId, consultantId))).limit(1);
  if (!rows.length) throw new TRPCError({ code: "FORBIDDEN", message: "المكتب غير مرتبط بالمشروع" });
}

/** No app-user -> evaluator binding exists in the read schema. Session names,
 * tokens, owner role and payload names cannot manufacture that assignment. */
export async function requireSessionEvaluator(actor: LegacyProjectActor, projectId: number): Promise<Evaluator> {
  await requireLegacyProjectWrite(actor, projectId);
  throw new TRPCError({ code: "FORBIDDEN", message: "حساب الجلسة غير مرتبط بمقيم معيّن؛ يلزم ربط هوية معتمد" });
}

export async function assertEvaluatorUnlocked(projectId: number, evaluator: string) {
  await assertCommitteeUnlocked(projectId);
  const db = await consultantDb();
  const approvals = await db.select().from(evaluationApprovals).where(and(eq(evaluationApprovals.projectId, projectId), eq(evaluationApprovals.evaluatorName, evaluator)));
  if (approvals.some(row => row.isApproved === 1)) throw new TRPCError({ code: "FORBIDDEN", message: "تقييم المقيم معتمد ومقفل" });
}

export async function assertThreeEvaluatorsReady(projectId: number) {
  const db = await consultantDb();
  const offices = await db.select().from(projectConsultants).where(eq(projectConsultants.projectId, projectId));
  const scores = await db.select().from(evaluatorScores).where(eq(evaluatorScores.projectId, projectId));
  const approvals = await db.select().from(evaluationApprovals).where(eq(evaluationApprovals.projectId, projectId));
  if (!threeEvaluatorMatrixReady(scores, offices.map(row => row.consultantId), approvals)) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "يلزم اكتمال الخلايا التسع واعتماد كل من المقيمين الثلاثة بصورة مستقلة وفي نسخة واحدة" });
}
