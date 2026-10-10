import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { comoAppOwnerIdentity } from "../../drizzle/schema";
import { getDb } from "../db";
import { ENV } from "../_core/env";

export type AppOwnerUser = { id: number; openId: string; role?: string };
export type AppOwnerBinding = { userId: number; openId: string; isActive: number };

/** A persisted, provisioned identity is authoritative across preview and production.
 * Never infer ownership from an email, a user-supplied member ID, or admin alone.
 * No route can create/update this binding. ENV is only a legacy fallback when
 * no identity has been provisioned; an inactive binding never falls back.
 */
export function matchesAuthenticatedAppOwner(
  user: AppOwnerUser,
  binding: AppOwnerBinding | null,
  configuredOpenId: string,
): boolean {
  if (!Number.isSafeInteger(user.id) || user.id <= 0 || !user.openId) return false;
  if (binding) {
    return binding.isActive === 1 && binding.userId === user.id &&
      binding.openId === user.openId && user.role === "admin";
  }
  return Boolean(configuredOpenId) && user.openId === configuredOpenId;
}

export async function isAuthenticatedAppOwner(user: AppOwnerUser): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر التحقق من حساب المالك؛ النص لم يُسلّم" });
  // Deliberately no cache: a disabled binding must immediately deny access.
  const [binding] = await db.select({
    userId: comoAppOwnerIdentity.userId,
    openId: comoAppOwnerIdentity.openId,
    isActive: comoAppOwnerIdentity.isActive,
  }).from(comoAppOwnerIdentity).where(eq(comoAppOwnerIdentity.id, 1)).limit(1);
  return matchesAuthenticatedAppOwner(user, binding ?? null, ENV.ownerOpenId);
}

export async function assertAuthenticatedAppOwner(user: AppOwnerUser) {
  if (!await isAuthenticatedAppOwner(user)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "تسليم التوجيه إلى Manus متاح لمالك التطبيق المسجل فقط" });
  }
}
