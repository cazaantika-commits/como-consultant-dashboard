import { createHash, randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { comoNextDocuments, comoNextWorkFiles, comoNextWorkMemory, comoNextWorkMemoryDocuments } from "../../drizzle/schema";
import { getDb } from "../db";
import { storagePut } from "../storage";
import { requireLegacyProjectWrite, type LegacyProjectActor } from "./comoLegacyProjectAccess";

export function positiveUploadId(value: unknown): number {
  if (typeof value !== "number" && (typeof value !== "string" || !/^[1-9]\d*$/.test(value))) throw new TRPCError({ code: "BAD_REQUEST", message: "حدد المشروع وذاكرة ملف العمل" });
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) throw new TRPCError({ code: "BAD_REQUEST", message: "معرّف غير صحيح" });
  return id;
}
export async function storePrivateCommandCenterAttachment(input: {
  actor: LegacyProjectActor; projectId: number; memoryId: number;
  fileName: string; mimeType: string; bytes: Buffer;
}) {
  await requireLegacyProjectWrite(input.actor, input.projectId);
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "قاعدة البيانات غير متاحة" });
  const [target] = await db.select({ memoryId: comoNextWorkMemory.id, workFileId: comoNextWorkMemory.workFileId, status: comoNextWorkFiles.workFileStatus })
    .from(comoNextWorkMemory).innerJoin(comoNextWorkFiles, and(eq(comoNextWorkMemory.workFileId, comoNextWorkFiles.id), eq(comoNextWorkMemory.projectId, comoNextWorkFiles.projectId)))
    .where(and(eq(comoNextWorkMemory.id, input.memoryId), eq(comoNextWorkMemory.projectId, input.projectId))).limit(1);
  if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "ذاكرة ملف العمل غير موجودة في المشروع" });
  if (["closed", "cancelled"].includes(target.status)) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "ملف العمل مغلق أو ملغى" });
  if (!input.bytes.length || input.bytes.length > 20 * 1024 * 1024) throw new TRPCError({ code: "BAD_REQUEST", message: "حجم الملف غير صحيح" });
  const digest = createHash("sha256").update(input.bytes).digest("hex");
  const [existing] = await db.select({ id: comoNextDocuments.id }).from(comoNextDocuments).where(eq(comoNextDocuments.sha256, digest)).limit(1);
  let documentId = existing?.id;
  if (!documentId) {
    const safeName = input.fileName.replace(/[^a-zA-Z0-9._\u0600-\u06FF-]+/g, "_").slice(0, 240) || "attachment";
    const stored = await storagePut(`como-next-private/command-center/${input.projectId}/${randomUUID()}/${safeName}`, input.bytes, input.mimeType);
    // Existing unique SHA contract handles concurrent duplicate uploads. No new entity.
    await db.insert(comoNextDocuments).values({ title: input.fileName, fileName: input.fileName, mimeType: input.mimeType, byteSize: input.bytes.length, sha256: digest, storageKey: stored.key, storageUrl: stored.url, sourceSystem: "command_center" })
      .onDuplicateKeyUpdate({ set: { sha256: digest } });
    const [created] = await db.select({ id: comoNextDocuments.id }).from(comoNextDocuments).where(eq(comoNextDocuments.sha256, digest)).limit(1);
    if (!created) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر تثبيت مرجع المستند" });
    documentId = created.id;
  }
  await db.insert(comoNextWorkMemoryDocuments).values({ projectId: input.projectId, workFileId: target.workFileId, memoryId: input.memoryId, documentId, relationType: "attachment", sourceSystem: "command_center" })
    .onDuplicateKeyUpdate({ set: { documentId } });
  return { documentId, url: `/api/como-next/documents/${documentId}`, name: input.fileName, size: input.bytes.length, type: input.mimeType };
}
