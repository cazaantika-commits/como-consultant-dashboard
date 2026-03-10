/**
 * stageData router — unified logic for stage data fields + documents
 *
 * Procedures:
 *  - getFieldDefinitions(serviceCode)          → field defs for a service
 *  - getFieldValues(projectId, serviceCode)    → saved values + source status
 *  - syncFromProjectCard(projectId, serviceCode) → pull project card values into field values
 *  - upsertFieldValue(projectId, serviceCode, fieldKey, value) → manual override
 *  - getStageRecord(projectId, serviceCode)    → full record: fields + docs + blocking
 *  - getBlockingRequirements(projectId, serviceCode) → list of incomplete mandatory items
 *  - uploadDocument(projectId, serviceCode, requirementCode, fileUrl, fileName, ...) → save doc ref
 *  - updateDocStatus(docId, status, rejectionReason) → approve/reject doc
 *  - getDocuments(projectId, serviceCode)      → all docs for a project/service
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { TRPCError } from "@trpc/server";

export const stageDataRouter = router({
  // ─── Field Definitions ─────────────────────────────────────────────────────
  getFieldDefinitions: protectedProcedure
    .input(z.object({ serviceCode: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      const [rows] = await db.execute<any[]>(
        `SELECT * FROM stage_field_definitions WHERE serviceCode = ? ORDER BY sortOrder ASC`,
        [input.serviceCode]
      );
      return rows;
    }),

  // ─── Field Values ───────────────────────────────────────────────────────────
  getFieldValues: protectedProcedure
    .input(z.object({ projectId: z.number(), serviceCode: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      const [rows] = await db.execute<any[]>(
        `SELECT * FROM project_stage_field_values WHERE projectId = ? AND serviceCode = ?`,
        [input.projectId, input.serviceCode]
      );
      return rows;
    }),

  // ─── Sync from Project Card ─────────────────────────────────────────────────
  syncFromProjectCard: protectedProcedure
    .input(z.object({ projectId: z.number(), serviceCode: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();

      // Get field definitions with project card mappings
      const [fieldDefs] = await db.execute<any[]>(
        `SELECT fieldKey, projectCardField FROM stage_field_definitions 
         WHERE serviceCode = ? AND projectCardField IS NOT NULL`,
        [input.serviceCode]
      );

      if (fieldDefs.length === 0) {
        return { synced: 0, fields: [] };
      }

      // Get project data
      const [projects] = await db.execute<any[]>(
        `SELECT * FROM projects WHERE id = ?`,
        [input.projectId]
      );

      if (!projects.length) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      }

      const project = projects[0];
      const now = new Date();
      const synced: string[] = [];

      for (const field of fieldDefs) {
        const projectValue = project[field.projectCardField];
        if (projectValue !== undefined && projectValue !== null) {
          await db.execute(
            `INSERT INTO project_stage_field_values (projectId, serviceCode, fieldKey, value, valueSource, syncedAt, updatedByUserId)
             VALUES (?, ?, ?, ?, 'project_card', ?, ?)
             ON DUPLICATE KEY UPDATE value = VALUES(value), valueSource = 'project_card', syncedAt = VALUES(syncedAt), updatedByUserId = VALUES(updatedByUserId)`,
            [input.projectId, input.serviceCode, field.fieldKey, String(projectValue), now, ctx.user.id]
          );
          synced.push(field.fieldKey);
        }
      }

      return { synced: synced.length, fields: synced };
    }),

  // ─── Upsert Field Value (manual) ───────────────────────────────────────────
  upsertFieldValue: protectedProcedure
    .input(z.object({
      projectId: z.number(),
      serviceCode: z.string(),
      fieldKey: z.string(),
      value: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      await db.execute(
        `INSERT INTO project_stage_field_values (projectId, serviceCode, fieldKey, value, valueSource, updatedByUserId)
         VALUES (?, ?, ?, ?, 'manual', ?)
         ON DUPLICATE KEY UPDATE value = VALUES(value), valueSource = 'manual', updatedByUserId = VALUES(updatedByUserId)`,
        [input.projectId, input.serviceCode, input.fieldKey, input.value, ctx.user.id]
      );
      return { success: true };
    }),

  // ─── Get Stage Record (full snapshot for AI / reports) ─────────────────────
  getStageRecord: protectedProcedure
    .input(z.object({ projectId: z.number(), serviceCode: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();

      // Field definitions
      const [fieldDefs] = await db.execute<any[]>(
        `SELECT * FROM stage_field_definitions WHERE serviceCode = ? ORDER BY sortOrder`,
        [input.serviceCode]
      );

      // Saved field values
      const [fieldValues] = await db.execute<any[]>(
        `SELECT * FROM project_stage_field_values WHERE projectId = ? AND serviceCode = ?`,
        [input.projectId, input.serviceCode]
      );

      // Requirements for this service
      const [requirements] = await db.execute<any[]>(
        `SELECT lr.*, prs.status, prs.notes, prs.completedAt
         FROM lifecycle_requirements lr
         LEFT JOIN project_requirement_status prs
           ON prs.requirementCode = lr.requirementCode AND prs.projectId = ?
         WHERE lr.serviceCode = ?
         ORDER BY lr.sortOrder`,
        [input.projectId, input.serviceCode]
      );

      // Documents
      const [documents] = await db.execute<any[]>(
        `SELECT * FROM project_stage_documents WHERE projectId = ? AND serviceCode = ?`,
        [input.projectId, input.serviceCode]
      );

      // Build merged field map
      const valueMap = Object.fromEntries(fieldValues.map((v: any) => [v.fieldKey, v]));
      const mergedFields = fieldDefs.map((def: any) => ({
        ...def,
        savedValue: valueMap[def.fieldKey]?.value ?? null,
        valueSource: valueMap[def.fieldKey]?.valueSource ?? null,
        syncedAt: valueMap[def.fieldKey]?.syncedAt ?? null,
        status: valueMap[def.fieldKey]
          ? (valueMap[def.fieldKey].valueSource === 'project_card' ? 'synced' : 'manual')
          : 'empty',
      }));

      // Blocking items (mandatory fields empty + mandatory docs missing)
      const blockingFields = mergedFields.filter((f: any) => f.isMandatory && !f.savedValue);
      const docMap = Object.fromEntries(documents.map((d: any) => [d.requirementCode, d]));
      const blockingDocs = requirements.filter((r: any) =>
        r.reqType === 'document' && r.isMandatory &&
        (!docMap[r.requirementCode] || docMap[r.requirementCode].docStatus === 'not_uploaded')
      );

      return {
        serviceCode: input.serviceCode,
        projectId: input.projectId,
        fields: mergedFields,
        requirements,
        documents,
        blocking: {
          fields: blockingFields.map((f: any) => ({ fieldKey: f.fieldKey, labelAr: f.labelAr })),
          documents: blockingDocs.map((r: any) => ({ requirementCode: r.requirementCode, nameAr: r.nameAr })),
          total: blockingFields.length + blockingDocs.length,
          canSubmit: blockingFields.length === 0 && blockingDocs.length === 0,
        },
      };
    }),

  // ─── Get Blocking Requirements ──────────────────────────────────────────────
  getBlockingRequirements: protectedProcedure
    .input(z.object({ projectId: z.number(), serviceCode: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();

      const [fieldDefs] = await db.execute<any[]>(
        `SELECT fd.fieldKey, fd.labelAr, fd.isMandatory, psfv.value
         FROM stage_field_definitions fd
         LEFT JOIN project_stage_field_values psfv
           ON psfv.fieldKey = fd.fieldKey AND psfv.serviceCode = fd.serviceCode AND psfv.projectId = ?
         WHERE fd.serviceCode = ? AND fd.isMandatory = 1 AND (psfv.value IS NULL OR psfv.value = '')`,
        [input.projectId, input.serviceCode]
      );

      const [docReqs] = await db.execute<any[]>(
        `SELECT lr.requirementCode, lr.nameAr, psd.docStatus
         FROM lifecycle_requirements lr
         LEFT JOIN project_stage_documents psd
           ON psd.requirementCode = lr.requirementCode AND psd.projectId = ? AND psd.serviceCode = ?
         WHERE lr.serviceCode = ? AND lr.reqType = 'document' AND lr.isMandatory = 1
           AND (psd.id IS NULL OR psd.docStatus = 'not_uploaded')`,
        [input.projectId, input.serviceCode, input.serviceCode]
      );

      return {
        missingFields: fieldDefs,
        missingDocuments: docReqs,
        canSubmit: fieldDefs.length === 0 && docReqs.length === 0,
      };
    }),  // ─── Upload Document (accepts base64, uploads to S3) ───────────────────────────
  uploadDocument: protectedProcedure
    .input(z.object({
      projectId: z.number(),
      serviceCode: z.string(),
      requirementCode: z.string(),
      fileName: z.string(),
      mimeType: z.string().optional(),
      fileBase64: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      // Upload to S3
      const { storagePut } = await import('../storage');
      const fileBuffer = Buffer.from(input.fileBase64, 'base64');
      const ext = input.fileName.split('.').pop() ?? 'bin';
      const fileKey = `stage-docs/${input.projectId}/${input.serviceCode}/${input.requirementCode}-${Date.now()}.${ext}`;
      const { url } = await storagePut(fileKey, fileBuffer, input.mimeType ?? 'application/octet-stream');
      await db.execute(
        `INSERT INTO project_stage_documents 
           (projectId, serviceCode, requirementCode, fileName, fileUrl, fileKey, mimeType, fileSizeBytes, docStatus, uploadedByUserId)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'uploaded_pending_review', ?)`,
        [
          input.projectId, input.serviceCode, input.requirementCode,
          input.fileName, url, fileKey,
          input.mimeType ?? null, fileBuffer.length, ctx.user.id
        ]
      );
      return { success: true, url };
    }),

  // ─── Update Document Status ─────────────────────────────────────────────────
  updateDocStatus: protectedProcedure
    .input(z.object({
      docId: z.number(),
      status: z.enum(['uploaded_pending_review', 'approved', 'rejected', 'not_uploaded']),
      rejectionReason: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      await db.execute(
        `UPDATE project_stage_documents 
         SET docStatus = ?, rejectionReason = ?, reviewedByUserId = ?, reviewedAt = NOW()
         WHERE id = ?`,
        [input.status, input.rejectionReason ?? null, ctx.user.id, input.docId]
      );
      return { success: true };
    }),

  // ─── Delete Document ─────────────────────────────────────────────────────────
  deleteDocument: protectedProcedure
    .input(z.object({ docId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      await db.execute(`DELETE FROM project_stage_documents WHERE id = ?`, [input.docId]);
      return { success: true };
    }),

  // ─── Get Documents (returns requirements + their docs + stats) ───────────────────
  getDocuments: protectedProcedure
    .input(z.object({ projectId: z.number(), serviceCode: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      // Get all document requirements for this service
      const [reqRows] = await db.execute<any[]>(
        `SELECT requirementCode, nameAr, isMandatory, descriptionAr
         FROM lifecycle_requirements
         WHERE serviceCode = ? AND reqType = 'document'
         ORDER BY sortOrder`,
        [input.serviceCode]
      );
      // Get all uploaded docs for this project+service
      const [docRows] = await db.execute<any[]>(
        `SELECT * FROM project_stage_documents
         WHERE projectId = ? AND serviceCode = ?
         ORDER BY uploadedAt DESC`,
        [input.projectId, input.serviceCode]
      );
      // Group docs by requirementCode
      const docsByReq: Record<string, any[]> = {};
      for (const doc of docRows) {
        if (!docsByReq[doc.requirementCode]) docsByReq[doc.requirementCode] = [];
        docsByReq[doc.requirementCode].push(doc);
      }
      // Merge requirements with their docs
      const requirements = reqRows.map((req: any) => ({
        ...req,
        documents: docsByReq[req.requirementCode] ?? [],
      }));
      const uploaded = requirements.filter((r: any) => r.documents.length > 0).length;
      const missingMandatory = requirements.filter((r: any) => r.isMandatory && r.documents.length === 0).length;
      return {
        requirements,
        stats: { total: requirements.length, uploaded, missingMandatory },
      };
    }),
});
