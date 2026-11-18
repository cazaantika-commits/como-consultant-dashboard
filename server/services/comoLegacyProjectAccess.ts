import { TRPCError } from "@trpc/server";
import { and, eq, inArray, or } from "drizzle-orm";
import { comoAppOwnerIdentity, comoNextProjectAccess, projects } from "../../drizzle/schema";
import type { TrpcContext } from "../_core/context";
import { getDb } from "../db";
import { matchesAuthenticatedAppOwner } from "./comoAppOwner";
import { requireProjectAccess } from "./comoNextCommands";

/** Pass ctx.user (or the authenticated REST session user), never payload identity. */
export type LegacyProjectActor = Pick<NonNullable<TrpcContext["user"]>, "id" | "openId" | "role"> | null | undefined;
type AuthenticatedActor = NonNullable<LegacyProjectActor>;
type AccessRequirement = "read" | "write";

function requireActor(actor: LegacyProjectActor): AuthenticatedActor {
  if (!actor || !Number.isSafeInteger(actor.id) || actor.id <= 0 ||
      typeof actor.openId !== "string" || !actor.openId.trim() ||
      (actor.role !== "admin" && actor.role !== "user")) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "تسجيل الدخول مطلوب" });
  }
  return actor;
}

function requireProjectId(projectId: number): void {
  if (!Number.isSafeInteger(projectId) || projectId <= 0) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "معرّف المشروع غير صحيح" });
  }
}

async function requireDatabase() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر التحقق من صلاحية المشروع" });
  return db;
}

async function checkProjectAccess(
  db: Awaited<ReturnType<typeof requireDatabase>>,
  actor: AuthenticatedActor,
  projectId: number,
  required: AccessRequirement,
) {
  try {
    const access = await requireProjectAccess(db, projectId, actor.id, required);
    // The current database enum guarantees these roles. Fail closed on corrupt
    // or future roles rather than accidentally granting write access.
    if (!["manager", "contributor", "viewer"].includes(access.role) ||
        (required === "write" && access.role === "viewer")) {
      throw new TRPCError({ code: "FORBIDDEN", message: "المشروع خارج نطاق الصلاحية" });
    }
    return access;
  } catch (error) {
    // Legacy/REST callers require 403, without disclosing existence or test data.
    if (error instanceof TRPCError && error.code === "NOT_FOUND") {
      throw new TRPCError({ code: "FORBIDDEN", message: "المشروع خارج نطاق الصلاحية" });
    }
    throw error;
  }
}

/** projects.id only; a consultant ID or cf_projects.id is not a project scope. */
export async function requireLegacyProjectRead(actor: LegacyProjectActor, projectId: number) {
  const user = requireActor(actor);
  requireProjectId(projectId);
  return checkProjectAccess(await requireDatabase(), user, projectId, "read");
}

/** Project write scope is not evaluator identity, approval authority or an agent capability. */
export async function requireLegacyProjectWrite(actor: LegacyProjectActor, projectId: number) {
  const user = requireActor(actor);
  requireProjectId(projectId);
  return checkProjectAccess(await requireDatabase(), user, projectId, "write");
}

/** Sensitive owner actions need BOTH a provisioned active app owner and project write scope.
 * Unlike the legacy owner resolver, an absent binding never falls back to ENV.
 * This check does not execute, approve, assign or send anything.
 */
export async function requireLegacyProjectOwner(actor: LegacyProjectActor, projectId: number) {
  const user = requireActor(actor);
  requireProjectId(projectId);
  const db = await requireDatabase();
  const [binding] = await db.select({
    userId: comoAppOwnerIdentity.userId,
    openId: comoAppOwnerIdentity.openId,
    isActive: comoAppOwnerIdentity.isActive,
  }).from(comoAppOwnerIdentity).where(eq(comoAppOwnerIdentity.id, 1)).limit(1);
  if (!binding || !matchesAuthenticatedAppOwner(user, binding, "")) {
    throw new TRPCError({ code: "FORBIDDEN", message: "الإجراء متاح لمالك التطبيق المثبت والفعّال فقط" });
  }
  return checkProjectAccess(db, user, projectId, "write");
}

/** Scope aggregate REST reads with the returned projects.id values.
 * An empty array means NO access, never an unrestricted query. These IDs do not
 * authorize an eventual mutation: recheck its target with the appropriate guard.
 */
export async function deriveAuthorizedProjectIds(
  actor: LegacyProjectActor,
  required: AccessRequirement = "read",
): Promise<number[]> {
  const user = requireActor(actor);
  if (required !== "read" && required !== "write") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "نوع الصلاحية غير صحيح" });
  }
  const db = await requireDatabase();
  const roles = required === "write"
    ? ["manager", "contributor"] as const
    : ["manager", "contributor", "viewer"] as const;
  const rows = await db.selectDistinct({ id: projects.id }).from(projects)
    .leftJoin(comoNextProjectAccess, and(
      eq(comoNextProjectAccess.projectId, projects.id),
      eq(comoNextProjectAccess.userId, user.id),
    ))
    .where(and(
      eq(projects.isTestProject, 0),
      or(eq(projects.userId, user.id), inArray(comoNextProjectAccess.accessRole, [...roles])),
    ));
  return Array.from(new Set(rows.map(row => row.id).filter(id => Number.isSafeInteger(id) && id > 0)));
}
