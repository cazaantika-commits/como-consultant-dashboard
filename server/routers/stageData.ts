/**
 * stageData router — unified logic for stage data fields + documents
 * Uses Drizzle ORM (eq/and) — NOT raw db.execute(string, params[])
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { TRPCError } from "@trpc/server";
import { eq, and } from "drizzle-orm";
import {
  stageFieldDefinitions,
  projectStageFieldValues,
  projectStageDocuments,
  lifecycleRequirements,
  projects,
} from "../../drizzle/schema";

export const stageDataRouter = router({
  // ─── Field Definitions ─────────────────────────────────────────────────────
  getFieldDefinitions: protectedProcedure
    .input(z.object({ serviceCode: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      return db
        .select()
        .from(stageFieldDefinitions)
        .where(eq(stageFieldDefinitions.serviceCode, input.serviceCode))
        .orderBy(stageFieldDefinitions.sortOrder);
    }),

  // ─── Field Values ───────────────────────────────────────────────────────────
  getFieldValues: protectedProcedure
    .input(z.object({ projectId: z.number(), serviceCode: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      return db
        .select()
        .from(projectStageFieldValues)
        .where(
          and(
            eq(projectStageFieldValues.projectId, input.projectId),
            eq(projectStageFieldValues.serviceCode, input.serviceCode)
          )
        );
    }),

  // ─── Sync from Project Card ─────────────────────────────────────────────────
  syncFromProjectCard: protectedProcedure
    .input(z.object({ projectId: z.number(), serviceCode: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const fieldDefs = await db
        .select()
        .from(stageFieldDefinitions)
        .where(eq(stageFieldDefinitions.serviceCode, input.serviceCode));

      const mappedFields = fieldDefs.filter((f) => f.projectCardField);
      if (mappedFields.length === 0) return { synced: 0 };

      const projectRows = await db
        .select()
        .from(projects)
        .where(eq(projects.id, input.projectId))
        .limit(1);

      if (!projectRows.length) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      const project = projectRows[0] as Record<string, unknown>;

      let synced = 0;
      const now = new Date().toISOString().slice(0, 19).replace("T", " ");

      for (const field of mappedFields) {
        const cardField = field.projectCardField as string;
        const rawValue = project[cardField];
        const value = rawValue != null ? String(rawValue) : null;
        if (value === null) continue;

        const existing = await db
          .select({ id: projectStageFieldValues.id })
          .from(projectStageFieldValues)
          .where(
            and(
              eq(projectStageFieldValues.projectId, input.projectId),
              eq(projectStageFieldValues.serviceCode, input.serviceCode),
              eq(projectStageFieldValues.fieldKey, field.fieldKey)
            )
          )
          .limit(1);

        if (existing.length > 0) {
          await db
            .update(projectStageFieldValues)
            .set({ value, valueSource: "project_card", syncedAt: now, updatedAt: now })
            .where(eq(projectStageFieldValues.id, existing[0].id));
        } else {
          await db.insert(projectStageFieldValues).values({
            projectId: input.projectId,
            serviceCode: input.serviceCode,
            fieldKey: field.fieldKey,
            value,
            valueSource: "project_card",
            syncedAt: now,
            updatedByUserId: ctx.user.id,
            updatedAt: now,
          });
        }
        synced++;
      }

      return { synced };
    }),

  // ─── Upsert Field Value (manual override) ──────────────────────────────────
  upsertFieldValue: protectedProcedure
    .input(
      z.object({
        projectId: z.number(),
        serviceCode: z.string(),
        fieldKey: z.string(),
        value: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const now = new Date().toISOString().slice(0, 19).replace("T", " ");

      const existing = await db
        .select({ id: projectStageFieldValues.id })
        .from(projectStageFieldValues)
        .where(
          and(
            eq(projectStageFieldValues.projectId, input.projectId),
            eq(projectStageFieldValues.serviceCode, input.serviceCode),
            eq(projectStageFieldValues.fieldKey, input.fieldKey)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(projectStageFieldValues)
          .set({ value: input.value, valueSource: "manual", updatedByUserId: ctx.user.id, updatedAt: now })
          .where(eq(projectStageFieldValues.id, existing[0].id));
      } else {
        await db.insert(projectStageFieldValues).values({
          projectId: input.projectId,
          serviceCode: input.serviceCode,
          fieldKey: input.fieldKey,
          value: input.value,
          valueSource: "manual",
          updatedByUserId: ctx.user.id,
          updatedAt: now,
        });
      }
      return { success: true };
    }),

  // ─── Get Stage Record (fields + values combined) ────────────────────────────
  getStageRecord: protectedProcedure
    .input(z.object({ projectId: z.number(), serviceCode: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const fieldDefs = await db
        .select()
        .from(stageFieldDefinitions)
        .where(eq(stageFieldDefinitions.serviceCode, input.serviceCode))
        .orderBy(stageFieldDefinitions.sortOrder);

      const savedValues = await db
        .select()
        .from(projectStageFieldValues)
        .where(
          and(
            eq(projectStageFieldValues.projectId, input.projectId),
            eq(projectStageFieldValues.serviceCode, input.serviceCode)
          )
        );

      const valueMap: Record<string, { value: string | null; valueSource: string | null }> = {};
      for (const v of savedValues) {
        valueMap[v.fieldKey] = { value: v.value ?? null, valueSource: v.valueSource ?? null };
      }

      const fields = fieldDefs.map((f) => ({
        ...f,
        currentValue: valueMap[f.fieldKey]?.value ?? null,
        valueSource: valueMap[f.fieldKey]?.valueSource ?? null,
      }));

      const filledCount = fields.filter((f) => f.currentValue !== null && f.currentValue !== "").length;

      return {
        fields,
        stats: {
          total: fields.length,
          filled: filledCount,
          missing: fields.length - filledCount,
        },
      };
    }),

  // ─── Get Blocking Requirements ──────────────────────────────────────────────
  getBlockingRequirements: protectedProcedure
    .input(z.object({ projectId: z.number(), serviceCode: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const fieldDefs = await db
        .select()
        .from(stageFieldDefinitions)
        .where(
          and(
            eq(stageFieldDefinitions.serviceCode, input.serviceCode),
            eq(stageFieldDefinitions.isMandatory, 1)
          )
        );

      const savedValues = await db
        .select()
        .from(projectStageFieldValues)
        .where(
          and(
            eq(projectStageFieldValues.projectId, input.projectId),
            eq(projectStageFieldValues.serviceCode, input.serviceCode)
          )
        );

      const filledKeys = new Set(savedValues.filter((v) => v.value).map((v) => v.fieldKey));
      const missingFields = fieldDefs.filter((f) => !filledKeys.has(f.fieldKey));

      const docReqs = await db
        .select()
        .from(lifecycleRequirements)
        .where(
          and(
            eq(lifecycleRequirements.serviceCode, input.serviceCode),
            eq(lifecycleRequirements.reqType, "document"),
            eq(lifecycleRequirements.isMandatory, 1)
          )
        );

      const uploadedDocs = await db
        .select()
        .from(projectStageDocuments)
        .where(
          and(
            eq(projectStageDocuments.projectId, input.projectId),
            eq(projectStageDocuments.serviceCode, input.serviceCode)
          )
        );

      const uploadedReqCodes = new Set(uploadedDocs.map((d) => d.requirementCode));
      const missingDocuments = docReqs.filter((r) => !uploadedReqCodes.has(r.requirementCode));

      return {
        missingFields,
        missingDocuments,
        canSubmit: missingFields.length === 0 && missingDocuments.length === 0,
      };
    }),

  // ─── Upload Document (accepts base64, uploads to S3) ───────────────────────
  uploadDocument: protectedProcedure
    .input(
      z.object({
        projectId: z.number(),
        serviceCode: z.string(),
        requirementCode: z.string(),
        fileName: z.string(),
        mimeType: z.string().optional(),
        fileBase64: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const { storagePut } = await import("../storage");
      const fileBuffer = Buffer.from(input.fileBase64, "base64");
      const ext = input.fileName.split(".").pop() ?? "bin";
      const fileKey = `stage-docs/${input.projectId}/${input.serviceCode}/${input.requirementCode}-${Date.now()}.${ext}`;
      const { url } = await storagePut(fileKey, fileBuffer, input.mimeType ?? "application/octet-stream");

      const now = new Date().toISOString().slice(0, 19).replace("T", " ");
      await db.insert(projectStageDocuments).values({
        projectId: input.projectId,
        serviceCode: input.serviceCode,
        requirementCode: input.requirementCode,
        fileName: input.fileName,
        fileUrl: url,
        fileKey,
        mimeType: input.mimeType ?? null,
        fileSizeBytes: fileBuffer.length,
        docStatus: "uploaded_pending_review",
        uploadedByUserId: ctx.user.id,
        uploadedAt: now,
      });

      return { success: true, url };
    }),

  // ─── Update Document Status ─────────────────────────────────────────────────
  updateDocStatus: protectedProcedure
    .input(
      z.object({
        docId: z.number(),
        status: z.enum(["uploaded_pending_review", "approved", "rejected", "not_uploaded"]),
        rejectionReason: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const now = new Date().toISOString().slice(0, 19).replace("T", " ");
      await db
        .update(projectStageDocuments)
        .set({
          docStatus: input.status,
          rejectionReason: input.rejectionReason ?? null,
          reviewedByUserId: ctx.user.id,
          reviewedAt: now,
        })
        .where(eq(projectStageDocuments.id, input.docId));
      return { success: true };
    }),

  // ─── Delete Document ─────────────────────────────────────────────────────────
  deleteDocument: protectedProcedure
    .input(z.object({ docId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      await db.delete(projectStageDocuments).where(eq(projectStageDocuments.id, input.docId));
      return { success: true };
    }),

  // ─── Get Documents (returns requirements + their docs + stats) ───────────────
  getDocuments: protectedProcedure
    .input(z.object({ projectId: z.number(), serviceCode: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const reqRows = await db
        .select()
        .from(lifecycleRequirements)
        .where(
          and(
            eq(lifecycleRequirements.serviceCode, input.serviceCode),
            eq(lifecycleRequirements.reqType, "document")
          )
        )
        .orderBy(lifecycleRequirements.sortOrder);

      const docRows = await db
        .select()
        .from(projectStageDocuments)
        .where(
          and(
            eq(projectStageDocuments.projectId, input.projectId),
            eq(projectStageDocuments.serviceCode, input.serviceCode)
          )
        )
        .orderBy(projectStageDocuments.uploadedAt);

      const docsByReq: Record<string, typeof docRows> = {};
      for (const doc of docRows) {
        if (!docsByReq[doc.requirementCode]) docsByReq[doc.requirementCode] = [];
        docsByReq[doc.requirementCode].push(doc);
      }

      const requirements = reqRows.map((req) => ({
        ...req,
        documents: docsByReq[req.requirementCode] ?? [],
      }));

      const uploaded = requirements.filter((r) => r.documents.length > 0).length;
      const missingMandatory = requirements.filter((r) => r.isMandatory && r.documents.length === 0).length;

      return {
        requirements,
        stats: { total: requirements.length, uploaded, missingMandatory },
      };
    }),
});
