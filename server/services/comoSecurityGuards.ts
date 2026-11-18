import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import type { Request, Response, NextFunction } from "express";
import { comoAppOwnerIdentity } from "../../drizzle/schema";
import { getDb } from "../db";
import { sdk } from "../_core/sdk";
import { matchesAuthenticatedAppOwner } from "./comoAppOwner";
import type { LegacyProjectActor } from "./comoLegacyProjectAccess";

export async function requireProvisionedComoOwner(actor: LegacyProjectActor): Promise<void> {
  if (!actor || !Number.isSafeInteger(actor.id) || actor.id <= 0 || !actor.openId) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "تسجيل الدخول مطلوب" });
  }
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر التحقق من المالك" });
  const [binding] = await db.select({ userId: comoAppOwnerIdentity.userId, openId: comoAppOwnerIdentity.openId, isActive: comoAppOwnerIdentity.isActive })
    .from(comoAppOwnerIdentity).where(eq(comoAppOwnerIdentity.id, 1)).limit(1);
  if (!binding || !matchesAuthenticatedAppOwner(actor, binding, "")) {
    throw new TRPCError({ code: "FORBIDDEN", message: "هذا الإجراء متاح للمالك المثبت والفعّال فقط" });
  }
}

export async function authenticateComoRest(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = await sdk.authenticateRequest(req);
    if (!actor || !Number.isSafeInteger(actor.id) || actor.id <= 0 || !actor.openId) throw new Error("Invalid actor");
    res.locals.comoActor = actor;
    next();
  } catch {
    res.status(401).json({ error: "تسجيل الدخول مطلوب" });
  }
}

export function comoRestActor(res: Response): NonNullable<LegacyProjectActor> {
  const actor: LegacyProjectActor = res.locals.comoActor;
  if (!actor) throw new TRPCError({ code: "UNAUTHORIZED", message: "تسجيل الدخول مطلوب" });
  return actor;
}

export function sendComoRestError(res: Response, error: unknown): void {
  const code = error instanceof TRPCError ? error.code : "INTERNAL_SERVER_ERROR";
  const status = code === "UNAUTHORIZED" ? 401 : code === "FORBIDDEN" ? 403 : code === "BAD_REQUEST" ? 400 : code === "NOT_FOUND" ? 404 : code === "PRECONDITION_FAILED" ? 409 : 500;
  res.status(status).json({ error: status === 500 ? "تعذر إتمام الطلب" : error instanceof Error ? error.message : "الطلب غير مسموح" });
}

export type DashboardObject = Record<string, unknown>;
export function isDashboardObject(value: unknown): value is DashboardObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
export function parseDashboardProjectKey(key: string): number | null {
  if (!/^p[1-9]\d*$/.test(key)) return null;
  const id = Number(key.slice(1));
  return Number.isSafeInteger(id) ? id : null;
}
function validateSafeTree(value: unknown): void {
  if (Array.isArray(value)) { value.forEach(validateSafeTree); return; }
  if (!isDashboardObject(value)) return;
  for (const [key, child] of Object.entries(value)) {
    if (["__proto__", "prototype", "constructor"].includes(key)) throw new TRPCError({ code: "BAD_REQUEST", message: "مفتاح غير آمن" });
    validateSafeTree(child);
  }
}
export function dashboardWriteTargets(body: unknown): { data: DashboardObject; projectIds: number[]; hasConsultantLinks: boolean } {
  if (!isDashboardObject(body)) throw new TRPCError({ code: "BAD_REQUEST", message: "بيانات اللوحة غير صحيحة" });
  validateSafeTree(body);
  const projectIds: number[] = [];
  for (const [key, value] of Object.entries(body)) {
    if (key === "consultantLinks") {
      if (!isDashboardObject(value)) throw new TRPCError({ code: "BAD_REQUEST", message: "روابط المكاتب غير صحيحة" });
      continue;
    }
    const id = parseDashboardProjectKey(key);
    if (!id || !isDashboardObject(value)) throw new TRPCError({ code: "BAD_REQUEST", message: "معرّف المشروع غير صحيح" });
    for (const field of ["bua", "price"]) {
      const number = value[field];
      if (number !== undefined && (typeof number !== "number" || !Number.isFinite(number) || number < 0)) throw new TRPCError({ code: "BAD_REQUEST", message: "قيمة المساحة أو السعر غير صحيحة" });
    }
    if (value.financial !== undefined) {
      if (!Array.isArray(value.financial)) throw new TRPCError({ code: "BAD_REQUEST", message: "بيانات المكاتب المالية غير صحيحة" });
      for (const financial of value.financial) {
        if (!isDashboardObject(financial) || typeof financial.consultant !== "string" || !financial.consultant.trim()) throw new TRPCError({ code: "BAD_REQUEST", message: "المكتب غير صحيح" });
        for (const field of ["designVal", "supervisionVal"]) {
          const number = financial[field];
          if (typeof number !== "number" || !Number.isFinite(number) || number < 0) throw new TRPCError({ code: "BAD_REQUEST", message: "قيمة العرض المالي غير صحيحة" });
        }
        for (const field of ["designType", "supervisionType"]) if (!["pct", "lump"].includes(String(financial[field]))) throw new TRPCError({ code: "BAD_REQUEST", message: "نوع العرض المالي غير صحيح" });
      }
    }
    projectIds.push(id);
  }
  if (!projectIds.length && !Object.hasOwn(body, "consultantLinks")) throw new TRPCError({ code: "BAD_REQUEST", message: "لا توجد بيانات للحفظ" });
  return { data: body, projectIds, hasConsultantLinks: Object.hasOwn(body, "consultantLinks") };
}
export function mergeDashboardPatch(target: DashboardObject, source: DashboardObject): DashboardObject {
  validateSafeTree(source);
  const output = { ...target };
  for (const [key, value] of Object.entries(source)) output[key] = isDashboardObject(value)
    ? mergeDashboardPatch(isDashboardObject(target[key]) ? target[key] : {}, value) : value;
  return output;
}
