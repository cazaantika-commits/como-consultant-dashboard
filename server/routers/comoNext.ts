import { TRPCError } from "@trpc/server";
import { and, desc, eq, or, sql } from "drizzle-orm";
import { z } from "zod";
import {
  comoNextActions,
  comoNextProjectAccess,
  comoNextWorkFileEvents,
  comoNextWorkFiles,
  projects,
} from "../../drizzle/schema";
import { getDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";
import {
  changeActionStatusCommand,
  closeWorkFileCommand,
  createActionCommand,
  createWorkFileCommand,
  getRecentWorkFileEvents,
  requireProjectAccess,
} from "../services/comoNextCommands";
import { buildComoNextTodayProjection, type ComoNextTodayRow } from "../services/comoNextToday";

function assertComoNextEnabled() {
  if (process.env.COMO_NEXT_ENABLED === "false") {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "المكتب التنفيذي متوقف مؤقتًا" });
  }
}

function getRows<T>(result: unknown): T[] {
  if (Array.isArray(result) && Array.isArray(result[0])) return result[0] as T[];
  return result as T[];
}

const prioritySchema = z.enum(["normal", "important", "urgent"]);
const ownerTypeSchema = z.enum(["human", "manus", "team"]);
const actionStatusSchema = z.enum([
  "open",
  "in_progress",
  "waiting_external",
  "completed_pending_verification",
  "verified",
  "cancelled",
]);

export const comoNextRouter = router({
  listProjects: protectedProcedure.query(async ({ ctx }) => {
    assertComoNextEnabled();
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "قاعدة البيانات غير متاحة" });
    return db
      .selectDistinct({ id: projects.id, name: projects.name, plotNumber: projects.plotNumber })
      .from(projects)
      .leftJoin(
        comoNextProjectAccess,
        and(eq(comoNextProjectAccess.projectId, projects.id), eq(comoNextProjectAccess.userId, ctx.user.id)),
      )
      .where(
        and(
          eq(projects.isTestProject, 0),
          or(eq(projects.userId, ctx.user.id), eq(comoNextProjectAccess.userId, ctx.user.id)),
        ),
      )
      .orderBy(projects.name);
  }),

  getOverview: protectedProcedure.query(async ({ ctx }) => {
    assertComoNextEnabled();
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "قاعدة البيانات غير متاحة" });

    const workFilesResult = await db.execute(sql`
      SELECT
        wf.id,
        wf.project_id AS projectId,
        p.name AS projectName,
        p.plotNumber AS plotNumber,
        wf.title,
        wf.governing_question AS governingQuestion,
        wf.desired_outcome AS desiredOutcome,
        wf.work_file_status AS workFileStatus,
        wf.priority,
        wf.updated_at AS updatedAt,
        (
          SELECT a.id FROM como_next_actions a
          WHERE a.work_file_id = wf.id AND a.action_status NOT IN ('verified','cancelled')
          ORDER BY CASE WHEN a.attention_at IS NULL THEN 1 ELSE 0 END, a.attention_at ASC, a.id ASC
          LIMIT 1
        ) AS nextActionId,
        (
          SELECT a.title FROM como_next_actions a
          WHERE a.work_file_id = wf.id AND a.action_status NOT IN ('verified','cancelled')
          ORDER BY CASE WHEN a.attention_at IS NULL THEN 1 ELSE 0 END, a.attention_at ASC, a.id ASC
          LIMIT 1
        ) AS nextActionTitle,
        (
          SELECT a.attention_at FROM como_next_actions a
          WHERE a.work_file_id = wf.id AND a.action_status NOT IN ('verified','cancelled')
          ORDER BY CASE WHEN a.attention_at IS NULL THEN 1 ELSE 0 END, a.attention_at ASC, a.id ASC
          LIMIT 1
        ) AS nextAttentionAt,
        (
          SELECT a.owner_type FROM como_next_actions a
          WHERE a.work_file_id = wf.id AND a.action_status NOT IN ('verified','cancelled')
          ORDER BY CASE WHEN a.attention_at IS NULL THEN 1 ELSE 0 END, a.attention_at ASC, a.id ASC
          LIMIT 1
        ) AS nextOwnerType,
        (
          SELECT COUNT(*) FROM como_next_actions a
          WHERE a.work_file_id = wf.id AND a.action_status NOT IN ('verified','cancelled')
        ) AS openActionCount
      FROM como_next_work_files wf
      JOIN projects p ON p.id = wf.project_id AND p.is_test_project = 0
      LEFT JOIN como_next_project_access access_row
        ON access_row.project_id = p.id AND access_row.user_id = ${ctx.user.id}
      WHERE (p.userId = ${ctx.user.id} OR access_row.user_id = ${ctx.user.id})
        AND wf.work_file_status NOT IN ('closed','cancelled')
      ORDER BY
        CASE wf.priority WHEN 'urgent' THEN 0 WHEN 'important' THEN 1 ELSE 2 END,
        wf.updated_at DESC
    `);

    const todayResult = await db.execute(sql`
      SELECT
        a.id,
        a.project_id AS projectId,
        p.name AS projectName,
        a.work_file_id AS workFileId,
        wf.title AS workFileTitle,
        a.title,
        a.acceptance_criteria AS acceptanceCriteria,
        a.owner_type AS ownerType,
        a.owner_user_id AS ownerUserId,
        a.action_status AS actionStatus,
        a.priority,
        a.due_at AS dueAt,
        a.follow_up_at AS followUpAt,
        a.attention_at AS attentionAt,
        waiting_party.display_name AS waitingPartyName
      FROM como_next_actions a
      JOIN como_next_work_files wf ON wf.id = a.work_file_id AND wf.project_id = a.project_id
      JOIN projects p ON p.id = a.project_id AND p.is_test_project = 0
      LEFT JOIN como_next_project_access access_row
        ON access_row.project_id = p.id AND access_row.user_id = ${ctx.user.id}
      LEFT JOIN como_next_project_parties waiting_link
        ON waiting_link.id = a.waiting_project_party_id AND waiting_link.project_id = a.project_id
      LEFT JOIN como_next_parties waiting_party ON waiting_party.id = waiting_link.party_id
      WHERE (p.userId = ${ctx.user.id} OR access_row.user_id = ${ctx.user.id})
        AND a.action_status NOT IN ('verified','cancelled')
    `);

    const workFiles = getRows<any>(workFilesResult).map(row => ({
      ...row,
      id: Number(row.id),
      projectId: Number(row.projectId),
      nextActionId: row.nextActionId == null ? null : Number(row.nextActionId),
      openActionCount: Number(row.openActionCount ?? 0),
    }));
    const todayRows = getRows<ComoNextTodayRow>(todayResult).map(row => ({
      ...row,
      id: Number(row.id),
      projectId: Number(row.projectId),
      workFileId: Number(row.workFileId),
      ownerUserId: row.ownerUserId == null ? null : Number(row.ownerUserId),
    }));

    return {
      today: buildComoNextTodayProjection(todayRows, ctx.user.id),
      workFiles,
      filesWithoutNextAction: workFiles.filter(file => !file.nextActionId),
    };
  }),

  getImportReview: protectedProcedure.query(async ({ ctx }) => {
    assertComoNextEnabled();
    if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "منطقة النقل متاحة لمالك النظام فقط" });
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "قاعدة البيانات غير متاحة" });

    const batchResult = await db.execute(sql`
      SELECT id, batch_id AS batchId, source_system AS sourceSystem,
        source_fingerprint AS sourceFingerprint, batch_status AS batchStatus,
        source_record_count AS sourceRecordCount, staged_record_count AS stagedRecordCount,
        skipped_record_count AS skippedRecordCount, staged_file_count AS stagedFileCount,
        created_at AS createdAt
      FROM como_next_import_batches
      ORDER BY id DESC LIMIT 1
    `);
    const batch = getRows<any>(batchResult)[0];
    if (!batch) return { available: false as const };

    const breakdownResult = await db.execute(sql`
      SELECT disposition, stage_status AS stageStatus, COUNT(*) AS recordCount
      FROM como_next_import_rows
      WHERE import_batch_id = ${Number(batch.id)}
      GROUP BY disposition, stage_status
      ORDER BY stage_status, disposition
    `);
    const projectResult = await db.execute(sql`
      SELECT source_record_id AS sourceRecordId, target_id AS targetId,
        stage_status AS stageStatus, disposition, disposition_reason AS reason, payload_json AS payloadJson
      FROM como_next_import_rows
      WHERE import_batch_id = ${Number(batch.id)} AND source_table = 'projects'
      ORDER BY source_record_id
    `);
    const filesResult = await db.execute(sql`
      SELECT file_status AS fileStatus, COUNT(*) AS fileCount,
        COALESCE(SUM(byte_size), 0) AS totalBytes
      FROM como_next_import_files
      WHERE import_batch_id = ${Number(batch.id)}
      GROUP BY file_status
      ORDER BY file_status
    `);

    return {
      available: true as const,
      batch: {
        ...batch,
        id: Number(batch.id),
        sourceRecordCount: Number(batch.sourceRecordCount),
        stagedRecordCount: Number(batch.stagedRecordCount),
        skippedRecordCount: Number(batch.skippedRecordCount),
        stagedFileCount: Number(batch.stagedFileCount),
      },
      breakdown: getRows<any>(breakdownResult).map(row => ({ ...row, recordCount: Number(row.recordCount) })),
      projects: getRows<any>(projectResult).map(row => {
        let payload: Record<string, unknown> = {};
        try { payload = JSON.parse(String(row.payloadJson || "{}")); } catch { payload = {}; }
        return {
          sourceRecordId: String(row.sourceRecordId),
          sourceName: String(payload.name || payload.shortName || `مشروع ${row.sourceRecordId}`),
          targetId: row.targetId == null ? null : Number(row.targetId),
          stageStatus: row.stageStatus,
          disposition: row.disposition,
          reason: row.stageStatus === "skipped"
            ? "مستبعد مؤقتًا بقرار المالك؛ محفوظ فقط داخل الحزمة المصدرية."
            : row.targetId != null
              ? `مطابق لمشروع COMO الرسمي رقم ${Number(row.targetId)} دون تغيير اسمه أو رقم قطعته.`
              : row.reason,
        };
      }),
      files: getRows<any>(filesResult).map(row => ({ ...row, fileCount: Number(row.fileCount), totalBytes: Number(row.totalBytes) })),
      safeguards: {
        operationalRecordsPromoted: 0,
        externalSideEffects: 0,
        secretsImported: 0,
      },
    };
  }),

  getWorkFile: protectedProcedure
    .input(z.object({ workFileId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      assertComoNextEnabled();
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "قاعدة البيانات غير متاحة" });
      const [workFile] = await db
        .select({
          id: comoNextWorkFiles.id,
          projectId: comoNextWorkFiles.projectId,
          title: comoNextWorkFiles.title,
          governingQuestion: comoNextWorkFiles.governingQuestion,
          desiredOutcome: comoNextWorkFiles.desiredOutcome,
          workFileStatus: comoNextWorkFiles.workFileStatus,
          priority: comoNextWorkFiles.priority,
          closureEvidenceRef: comoNextWorkFiles.closureEvidenceRef,
          openedAt: comoNextWorkFiles.openedAt,
          closedAt: comoNextWorkFiles.closedAt,
          updatedAt: comoNextWorkFiles.updatedAt,
        })
        .from(comoNextWorkFiles)
        .where(eq(comoNextWorkFiles.id, input.workFileId))
        .limit(1);
      if (!workFile) throw new TRPCError({ code: "NOT_FOUND", message: "لم يُعثر على ملف العمل" });
      const access = await requireProjectAccess(db, workFile.projectId, ctx.user.id, "read");
      const actions = await db
        .select()
        .from(comoNextActions)
        .where(eq(comoNextActions.workFileId, input.workFileId))
        .orderBy(desc(comoNextActions.updatedAt));
      const events = await getRecentWorkFileEvents(input.workFileId);
      return { workFile: { ...workFile, projectName: access.project.name }, actions, events, accessRole: access.role };
    }),

  createWorkFile: protectedProcedure
    .input(z.object({
      projectId: z.number().int().positive(),
      title: z.string().trim().min(3).max(500),
      governingQuestion: z.string().trim().min(5).max(5000),
      desiredOutcome: z.string().trim().min(5).max(5000),
      priority: prioritySchema.default("normal"),
      idempotencyKey: z.string().trim().min(8).max(128).optional(),
    }))
    .mutation(({ ctx, input }) => {
      assertComoNextEnabled();
      return createWorkFileCommand({ userId: ctx.user.id, ...input });
    }),

  createAction: protectedProcedure
    .input(z.object({
      workFileId: z.number().int().positive(),
      title: z.string().trim().min(3).max(500),
      description: z.string().trim().max(5000).optional(),
      acceptanceCriteria: z.string().trim().min(3).max(5000),
      ownerType: ownerTypeSchema.default("human"),
      priority: prioritySchema.default("normal"),
      dueAt: z.string().optional().nullable(),
      followUpAt: z.string().optional().nullable(),
      idempotencyKey: z.string().trim().min(8).max(128).optional(),
    }))
    .mutation(({ ctx, input }) => {
      assertComoNextEnabled();
      return createActionCommand({ userId: ctx.user.id, ...input });
    }),

  changeActionStatus: protectedProcedure
    .input(z.object({
      actionId: z.number().int().positive(),
      nextStatus: actionStatusSchema,
      evidenceReference: z.string().trim().min(3).max(5000).optional().nullable(),
    }))
    .mutation(({ ctx, input }) => {
      assertComoNextEnabled();
      return changeActionStatusCommand({ userId: ctx.user.id, ...input });
    }),

  closeWorkFile: protectedProcedure
    .input(z.object({
      workFileId: z.number().int().positive(),
      closureEvidenceRef: z.string().trim().min(3).max(5000),
    }))
    .mutation(({ ctx, input }) => {
      assertComoNextEnabled();
      return closeWorkFileCommand({ userId: ctx.user.id, ...input });
    }),
});
