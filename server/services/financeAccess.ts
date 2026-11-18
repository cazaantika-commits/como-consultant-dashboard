import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { cfProjects, feasibilityStudies, phaseActivities, projectPhases } from "../../drizzle/schema";
import { getDb } from "../db";
import {
  requireLegacyProjectRead,
  requireLegacyProjectWrite,
  type LegacyProjectActor,
} from "./comoLegacyProjectAccess";

type AccessMode = "read" | "write";

function authenticated(actor: LegacyProjectActor) {
  if (!actor || !Number.isSafeInteger(actor.id) || actor.id <= 0 || typeof actor.openId !== "string" || !actor.openId.trim() ||
      (actor.role !== "admin" && actor.role !== "user")) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "تسجيل الدخول مطلوب" });
  }
  return actor;
}

function validId(id: number) {
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "معرّف غير صحيح" });
  }
}

export async function requireFinanceDatabase() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر التحقق من المصدر المالي" });
  return db;
}

export async function requireFinanceProject(actor: LegacyProjectActor, projectId: number, mode: AccessMode) {
  return mode === "write"
    ? requireLegacyProjectWrite(actor, projectId)
    : requireLegacyProjectRead(actor, projectId);
}

/** Studies remain owned by their stored userId. Project grants do not transfer ownership.
 * Unlinked legacy studies are accessible only to that owner; no synthetic project is used.
 */
export async function requireFinanceStudy(actor: LegacyProjectActor, studyId: number, mode: AccessMode) {
  const user = authenticated(actor);
  validId(studyId);
  const db = await requireFinanceDatabase();
  const [study] = await db.select().from(feasibilityStudies)
    .where(and(eq(feasibilityStudies.id, studyId), eq(feasibilityStudies.userId, user.id))).limit(1);
  if (!study) throw new TRPCError({ code: "FORBIDDEN", message: "الدراسة خارج نطاق الصلاحية" });
  if (study.projectId !== null) await requireFinanceProject(user, study.projectId, mode);
  return study;
}

/** cf_projects.id is never projects.id. A missing link needs explicit data reconciliation. */
export async function requireFinanceCfProject(actor: LegacyProjectActor, cfProjectId: number, mode: AccessMode) {
  authenticated(actor);
  validId(cfProjectId);
  const db = await requireFinanceDatabase();
  const [cfProject] = await db.select().from(cfProjects).where(eq(cfProjects.id, cfProjectId)).limit(1);
  if (!cfProject || cfProject.projectId === null) {
    throw new TRPCError({ code: "FORBIDDEN", message: "سجل التدفق يحتاج ربطًا مثبتًا بمشروع مأذون" });
  }
  await requireFinanceProject(actor, cfProject.projectId, mode);
  return { cfProject, projectId: cfProject.projectId };
}

export async function requireFinancePhase(actor: LegacyProjectActor, phaseId: number, mode: AccessMode) {
  authenticated(actor);
  validId(phaseId);
  const db = await requireFinanceDatabase();
  const [phase] = await db.select().from(projectPhases).where(eq(projectPhases.id, phaseId)).limit(1);
  if (!phase) throw new TRPCError({ code: "FORBIDDEN", message: "المرحلة خارج نطاق الصلاحية" });
  await requireFinanceProject(actor, phase.projectId, mode);
  return phase;
}

export async function requireFinanceActivity(actor: LegacyProjectActor, activityId: number, mode: AccessMode) {
  authenticated(actor);
  validId(activityId);
  const db = await requireFinanceDatabase();
  const [activity] = await db.select().from(phaseActivities).where(eq(phaseActivities.id, activityId)).limit(1);
  if (!activity) throw new TRPCError({ code: "FORBIDDEN", message: "النشاط خارج نطاق الصلاحية" });
  const phase = await requireFinancePhase(actor, activity.phaseId, mode);
  return { activity, phase };
}
