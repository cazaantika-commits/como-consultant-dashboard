import { TRPCError } from "@trpc/server";
import { and, desc, eq, or, sql } from "drizzle-orm";
import { z } from "zod";
import {
  comoNextActions,
  comoNextCommunications,
  comoNextDecisions,
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
  createCommunicationDraftCommand,
  createDecisionCommand,
  createWorkFileCommand,
  getRecentWorkFileEvents,
  recordCommunicationSentCommand,
  requireProjectAccess,
  resolveDecisionCommand,
  reviewCommunicationDraftCommand,
} from "../services/comoNextCommands";
import { buildComoNextTodayProjection, type ComoNextTodayRow } from "../services/comoNextToday";
import {
  addMeetingAgendaItemCommand,
  addMeetingSourceCommand,
  analyzeMeetingSourceCommand,
  createMeetingCommand,
  getMeetingWorkspace,
  prepareMeetingMinutesCommand,
  recordMeetingConsentCommand,
  reviewMeetingMinutesCommand,
  reviewMeetingProposalCommand,
  updateMeetingAgendaItemCommand,
} from "../services/comoNextMeetings";

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
const decisionAuthoritySchema = z.enum(["abdulrahman", "wael", "sheikh_issa", "joint", "other"]);
const communicationChannelSchema = z.enum(["email", "whatsapp", "letter", "phone_note", "internal"]);
const meetingProposalTargetSchema = z.enum(["agenda_item", "decision", "action", "external_commitment", "risk", "note", "communication_draft"]);
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
      LEFT JOIN como_next_import_batches import_batch ON import_batch.batch_id = wf.import_batch_id
      LEFT JOIN como_next_project_access access_row
        ON access_row.project_id = p.id AND access_row.user_id = ${ctx.user.id}
      WHERE (p.userId = ${ctx.user.id} OR access_row.user_id = ${ctx.user.id})
        AND wf.work_file_status NOT IN ('closed','cancelled')
        AND (wf.import_batch_id IS NULL OR import_batch.batch_status = 'promoted')
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
      LEFT JOIN como_next_import_batches import_batch ON import_batch.batch_id = wf.import_batch_id
      LEFT JOIN como_next_project_access access_row
        ON access_row.project_id = p.id AND access_row.user_id = ${ctx.user.id}
      LEFT JOIN como_next_project_parties waiting_link
        ON waiting_link.id = a.waiting_project_party_id AND waiting_link.project_id = a.project_id
      LEFT JOIN como_next_parties waiting_party ON waiting_party.id = waiting_link.party_id
      WHERE (p.userId = ${ctx.user.id} OR access_row.user_id = ${ctx.user.id})
        AND a.action_status NOT IN ('verified','cancelled')
        AND (wf.import_batch_id IS NULL OR import_batch.batch_status = 'promoted')
    `);

    const decisionsResult = await db.execute(sql`
      SELECT
        decision_row.id,
        decision_row.project_id AS projectId,
        p.name AS projectName,
        decision_row.work_file_id AS workFileId,
        wf.title AS workFileTitle,
        decision_row.title,
        decision_row.question,
        decision_row.context_summary AS contextSummary,
        decision_row.recommendation,
        decision_row.decision_status AS decisionStatus,
        decision_row.decision_authority AS decisionAuthority,
        decision_row.due_at AS dueAt,
        wf.priority
      FROM como_next_decisions decision_row
      JOIN como_next_work_files wf ON wf.id = decision_row.work_file_id AND wf.project_id = decision_row.project_id
      JOIN projects p ON p.id = decision_row.project_id AND p.is_test_project = 0
      LEFT JOIN como_next_import_batches import_batch ON import_batch.batch_id = wf.import_batch_id
      LEFT JOIN como_next_project_access access_row
        ON access_row.project_id = p.id AND access_row.user_id = ${ctx.user.id}
      WHERE (p.userId = ${ctx.user.id} OR access_row.user_id = ${ctx.user.id})
        AND decision_row.decision_status IN ('required','deferred')
        AND (wf.import_batch_id IS NULL OR import_batch.batch_status = 'promoted')
      ORDER BY
        CASE wf.priority WHEN 'urgent' THEN 0 WHEN 'important' THEN 1 ELSE 2 END,
        CASE WHEN decision_row.due_at IS NULL THEN 1 ELSE 0 END,
        decision_row.due_at ASC,
        decision_row.id ASC
    `);

    const draftCommunicationsResult = await db.execute(sql`
      SELECT communication.id, communication.project_id AS projectId,
        communication.work_file_id AS workFileId, p.name AS projectName,
        wf.title AS workFileTitle, communication.channel,
        communication.subject, communication.to_text AS toText,
        communication.communication_status AS communicationStatus,
        communication.approval_status AS approvalStatus,
        communication.created_at AS createdAt
      FROM como_next_communications communication
      JOIN como_next_work_files wf ON wf.id = communication.work_file_id AND wf.project_id = communication.project_id
      JOIN projects p ON p.id = communication.project_id AND p.is_test_project = 0
      LEFT JOIN como_next_project_access access_row
        ON access_row.project_id = p.id AND access_row.user_id = ${ctx.user.id}
      WHERE (p.userId = ${ctx.user.id} OR access_row.user_id = ${ctx.user.id})
        AND communication.communication_status IN ('draft','approved_for_send')
      ORDER BY communication.created_at ASC, communication.id ASC
    `);

    const meetingAttentionResult = await db.execute(sql`
      SELECT meeting.id, meeting.project_id AS projectId, meeting.work_file_id AS workFileId,
        p.name AS projectName, wf.title AS workFileTitle, meeting.title,
        meeting.meeting_status AS meetingStatus, meeting.starts_at AS startsAt,
        (SELECT COUNT(*) FROM como_next_meeting_proposals proposal WHERE proposal.meeting_id = meeting.id AND proposal.review_status = 'pending') AS pendingProposalCount,
        (SELECT COUNT(*) FROM como_next_meeting_minutes minutes WHERE minutes.meeting_id = meeting.id AND minutes.minutes_status = 'draft') AS draftMinutesCount
      FROM como_next_meetings meeting
      JOIN como_next_work_files wf ON wf.id = meeting.work_file_id AND wf.project_id = meeting.project_id
      JOIN projects p ON p.id = meeting.project_id AND p.is_test_project = 0
      LEFT JOIN como_next_project_access access_row
        ON access_row.project_id = p.id AND access_row.user_id = ${ctx.user.id}
      WHERE (p.userId = ${ctx.user.id} OR access_row.user_id = ${ctx.user.id})
        AND (
          meeting.meeting_status IN ('planned','confirmed')
          OR EXISTS (SELECT 1 FROM como_next_meeting_proposals proposal WHERE proposal.meeting_id = meeting.id AND proposal.review_status = 'pending')
          OR EXISTS (SELECT 1 FROM como_next_meeting_minutes minutes WHERE minutes.meeting_id = meeting.id AND minutes.minutes_status = 'draft')
        )
      ORDER BY CASE WHEN meeting.starts_at IS NULL THEN 1 ELSE 0 END, meeting.starts_at ASC, meeting.id ASC
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
    const decisions = getRows<any>(decisionsResult).map(row => ({
      ...row,
      id: Number(row.id),
      projectId: Number(row.projectId),
      workFileId: Number(row.workFileId),
    }));
    const draftCommunications = getRows<any>(draftCommunicationsResult).map(row => ({
      ...row,
      id: Number(row.id),
      projectId: Number(row.projectId),
      workFileId: Number(row.workFileId),
    }));
    const meetingAttention = getRows<any>(meetingAttentionResult).map(row => ({
      ...row,
      id: Number(row.id),
      projectId: Number(row.projectId),
      workFileId: Number(row.workFileId),
      pendingProposalCount: Number(row.pendingProposalCount || 0),
      draftMinutesCount: Number(row.draftMinutesCount || 0),
    }));

    return {
      today: buildComoNextTodayProjection(todayRows, ctx.user.id),
      decisions,
      draftCommunications,
      meetingAttention,
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
    const promotedResult = await db.execute(sql`
      SELECT
        (SELECT COUNT(*) FROM como_next_parties WHERE import_batch_id = ${String(batch.batchId)}) AS parties,
        (SELECT COUNT(*) FROM como_next_party_contacts WHERE import_batch_id = ${String(batch.batchId)}) AS contacts,
        (SELECT COUNT(*) FROM como_next_project_parties pp JOIN como_next_parties party ON party.id = pp.party_id WHERE party.import_batch_id = ${String(batch.batchId)}) AS projectParties,
        (SELECT COUNT(*) FROM como_next_work_files WHERE import_batch_id = ${String(batch.batchId)}) AS workFiles,
        (SELECT COUNT(*) FROM como_next_actions WHERE import_batch_id = ${String(batch.batchId)}) AS actions,
        (SELECT COUNT(*) FROM como_next_decisions WHERE import_batch_id = ${String(batch.batchId)}) AS decisions,
        (SELECT COUNT(*) FROM como_next_communications WHERE import_batch_id = ${String(batch.batchId)}) AS communications,
        (SELECT COUNT(*) FROM como_next_work_memory WHERE import_batch_id = ${String(batch.batchId)}) AS memoryEntries,
        (SELECT COUNT(*) FROM como_next_work_file_events event_row JOIN como_next_work_files wf ON wf.id = event_row.work_file_id WHERE wf.import_batch_id = ${String(batch.batchId)} AND event_row.idempotency_key LIKE 'followup:%') AS events,
        (SELECT COUNT(*) FROM como_next_meetings WHERE import_batch_id = ${String(batch.batchId)}) AS meetings,
        (SELECT COUNT(*) FROM como_next_meeting_participants WHERE import_batch_id = ${String(batch.batchId)}) AS meetingParticipants,
        (SELECT COUNT(*) FROM como_next_meeting_agenda_items WHERE import_batch_id = ${String(batch.batchId)}) AS agendaItems,
        (SELECT COUNT(DISTINCT COALESCE(NULLIF(source_file_key, ''), NULLIF(source_url, ''))) FROM como_next_work_memory WHERE import_batch_id = ${String(batch.batchId)} AND (source_file_key IS NOT NULL OR source_url IS NOT NULL)) AS documentReferences,
        (SELECT COUNT(*) FROM como_next_documents WHERE import_batch_id = ${String(batch.batchId)}) AS documentsStored,
        (SELECT COALESCE(SUM(byte_size), 0) FROM como_next_documents WHERE import_batch_id = ${String(batch.batchId)}) AS documentBytes,
        (SELECT COUNT(*) FROM como_next_work_memory_documents WHERE import_batch_id = ${String(batch.batchId)}) AS documentLinks,
        (SELECT COUNT(*) FROM como_next_document_chunks chunk_row JOIN como_next_documents document_row ON document_row.id = chunk_row.document_id WHERE document_row.import_batch_id = ${String(batch.batchId)}) AS documentChunks
    `);
    const promoted = getRows<any>(promotedResult)[0] || {};
    const promotion = {
      parties: Number(promoted.parties || 0),
      contacts: Number(promoted.contacts || 0),
      projectParties: Number(promoted.projectParties || 0),
      workFiles: Number(promoted.workFiles || 0),
      actions: Number(promoted.actions || 0),
      decisions: Number(promoted.decisions || 0),
      communications: Number(promoted.communications || 0),
      memoryEntries: Number(promoted.memoryEntries || 0),
      events: Number(promoted.events || 0),
      meetings: Number(promoted.meetings || 0),
      meetingParticipants: Number(promoted.meetingParticipants || 0),
      agendaItems: Number(promoted.agendaItems || 0),
      documentReferences: Number(promoted.documentReferences || 0),
      documentsStored: Number(promoted.documentsStored || 0),
      documentBytes: Number(promoted.documentBytes || 0),
      documentLinks: Number(promoted.documentLinks || 0),
      documentChunks: Number(promoted.documentChunks || 0),
    };
    const operationalRecordsPromoted = batch.batchStatus === "promoted"
      ? Object.entries(promotion)
          .filter(([key]) => !["documentReferences", "documentBytes", "documentChunks"].includes(key))
          .reduce((sum, [, value]) => sum + Number(value), 0)
      : 0;

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
      promotion,
      safeguards: {
        operationalRecordsPromoted,
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
          importBatchId: comoNextWorkFiles.importBatchId,
          closureEvidenceRef: comoNextWorkFiles.closureEvidenceRef,
          openedAt: comoNextWorkFiles.openedAt,
          closedAt: comoNextWorkFiles.closedAt,
          updatedAt: comoNextWorkFiles.updatedAt,
        })
        .from(comoNextWorkFiles)
        .where(eq(comoNextWorkFiles.id, input.workFileId))
        .limit(1);
      if (!workFile) throw new TRPCError({ code: "NOT_FOUND", message: "لم يُعثر على ملف العمل" });
      if (workFile.importBatchId) {
        const visibilityResult = await db.execute(sql`
          SELECT batch_status AS batchStatus
          FROM como_next_import_batches
          WHERE batch_id = ${workFile.importBatchId}
          LIMIT 1
        `);
        const visibility = getRows<any>(visibilityResult)[0];
        if (visibility?.batchStatus !== "promoted") throw new TRPCError({ code: "NOT_FOUND", message: "لم يُعثر على ملف العمل" });
      }
      const access = await requireProjectAccess(db, workFile.projectId, ctx.user.id, "read");
      const actions = await db
        .select()
        .from(comoNextActions)
        .where(eq(comoNextActions.workFileId, input.workFileId))
        .orderBy(desc(comoNextActions.updatedAt));
      const decisions = await db
        .select()
        .from(comoNextDecisions)
        .where(eq(comoNextDecisions.workFileId, input.workFileId))
        .orderBy(desc(comoNextDecisions.updatedAt));
      const events = await getRecentWorkFileEvents(input.workFileId);
      const memoryResult = await db.execute(sql`
        SELECT id, memory_type AS memoryType, entry_type AS entryType, title, body,
          source_status AS sourceStatus, source_url AS sourceUrl,
          source_file_key AS sourceFileKey, source_file_name AS sourceFileName,
          mime_type AS mimeType, is_current AS isCurrent, occurred_at AS occurredAt
        FROM como_next_work_memory
        WHERE work_file_id = ${input.workFileId}
        ORDER BY is_current DESC, occurred_at DESC, id DESC
      `);
      const documentsResult = await db.execute(sql`
        SELECT link.memory_id AS memoryId, document_row.id, document_row.title,
          document_row.file_name AS fileName, document_row.mime_type AS mimeType,
          document_row.byte_size AS byteSize, document_row.sha256
        FROM como_next_work_memory_documents link
        JOIN como_next_documents document_row ON document_row.id = link.document_id
        WHERE link.work_file_id = ${input.workFileId}
        ORDER BY link.memory_id, document_row.id
      `);
      const meetingsResult = await db.execute(sql`
        SELECT m.id, m.title, m.objective, m.meeting_type AS meetingType,
          m.meeting_format AS meetingFormat, m.meeting_status AS meetingStatus,
          m.starts_at AS startsAt, m.ends_at AS endsAt, m.location,
          m.outcome_summary AS outcomeSummary, party.display_name AS partyName,
          (SELECT COUNT(*) FROM como_next_meeting_participants mp WHERE mp.meeting_id = m.id) AS participantCount,
          (SELECT COUNT(*) FROM como_next_meeting_agenda_items ai WHERE ai.meeting_id = m.id) AS agendaItemCount,
          (SELECT COUNT(*) FROM como_next_meeting_agenda_items ai WHERE ai.meeting_id = m.id AND ai.is_required = 1 AND ai.is_checked = 0) AS unresolvedRequiredCount,
          (SELECT COUNT(*) FROM como_next_meeting_sources source_row WHERE source_row.meeting_id = m.id) AS sourceCount,
          (SELECT COUNT(*) FROM como_next_meeting_proposals proposal WHERE proposal.meeting_id = m.id AND proposal.review_status = 'pending') AS pendingProposalCount,
          (SELECT minutes.minutes_status FROM como_next_meeting_minutes minutes WHERE minutes.meeting_id = m.id ORDER BY minutes.version DESC LIMIT 1) AS latestMinutesStatus
        FROM como_next_meetings m
        LEFT JOIN como_next_project_parties pp ON pp.id = m.project_party_id AND pp.project_id = m.project_id
        LEFT JOIN como_next_parties party ON party.id = pp.party_id
        WHERE m.work_file_id = ${input.workFileId}
        ORDER BY m.starts_at DESC, m.id DESC
      `);
      const partiesResult = await db.execute(sql`
        SELECT party.id, party.display_name AS displayName, party.party_status AS partyStatus,
          pp.role_code AS roleCode, pp.relationship_status AS relationshipStatus,
          wfp.relationship_role AS relationshipRole
        FROM como_next_work_file_parties wfp
        JOIN como_next_project_parties pp ON pp.id = wfp.project_party_id AND pp.project_id = wfp.project_id
        JOIN como_next_parties party ON party.id = pp.party_id
        WHERE wfp.work_file_id = ${input.workFileId}
        ORDER BY party.display_name
      `);
      const communications = await db
        .select()
        .from(comoNextCommunications)
        .where(eq(comoNextCommunications.workFileId, input.workFileId))
        .orderBy(desc(comoNextCommunications.occurredAt), desc(comoNextCommunications.id));
      const documentsByMemory = new Map<number, any[]>();
      for (const row of getRows<any>(documentsResult)) {
        const memoryId = Number(row.memoryId);
        const current = documentsByMemory.get(memoryId) || [];
        current.push({
          ...row,
          id: Number(row.id),
          byteSize: Number(row.byteSize),
          downloadPath: `/api/como-next/documents/${Number(row.id)}`,
        });
        documentsByMemory.set(memoryId, current);
      }
      return {
        workFile: { ...workFile, projectName: access.project.name },
        actions,
        decisions,
        events,
        memory: getRows<any>(memoryResult).map(row => {
          const id = Number(row.id);
          return { ...row, id, isCurrent: Number(row.isCurrent) === 1, documents: documentsByMemory.get(id) || [] };
        }),
        meetings: getRows<any>(meetingsResult).map(row => ({
          ...row,
          id: Number(row.id),
          participantCount: Number(row.participantCount || 0),
          agendaItemCount: Number(row.agendaItemCount || 0),
          unresolvedRequiredCount: Number(row.unresolvedRequiredCount || 0),
          sourceCount: Number(row.sourceCount || 0),
          pendingProposalCount: Number(row.pendingProposalCount || 0),
        })),
        communications,
        parties: getRows<any>(partiesResult).map(row => ({ ...row, id: Number(row.id) })),
        accessRole: access.role,
      };
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

  createCommunicationDraft: protectedProcedure
    .input(z.object({
      workFileId: z.number().int().positive(),
      channel: communicationChannelSchema.default("email"),
      subject: z.string().trim().min(3).max(1000),
      body: z.string().trim().min(3).max(100_000),
      toText: z.string().trim().max(5000).optional().nullable(),
      ccText: z.string().trim().max(5000).optional().nullable(),
      idempotencyKey: z.string().trim().min(8).max(128).optional(),
    }))
    .mutation(({ ctx, input }) => {
      assertComoNextEnabled();
      return createCommunicationDraftCommand({ userId: ctx.user.id, ...input });
    }),

  reviewCommunicationDraft: protectedProcedure
    .input(z.object({
      communicationId: z.number().int().positive(),
      decision: z.enum(["approve", "reject"]),
      reviewNote: z.string().trim().max(5000).optional().nullable(),
    }))
    .mutation(({ ctx, input }) => {
      assertComoNextEnabled();
      return reviewCommunicationDraftCommand({ userId: ctx.user.id, ...input });
    }),

  recordCommunicationSent: protectedProcedure
    .input(z.object({
      communicationId: z.number().int().positive(),
      evidenceReference: z.string().trim().min(3).max(5000),
      externalMessageRef: z.string().trim().max(500).optional().nullable(),
      sentAt: z.string().optional().nullable(),
    }))
    .mutation(({ ctx, input }) => {
      assertComoNextEnabled();
      return recordCommunicationSentCommand({ userId: ctx.user.id, ...input });
    }),

  createDecision: protectedProcedure
    .input(z.object({
      workFileId: z.number().int().positive(),
      title: z.string().trim().min(3).max(500),
      question: z.string().trim().min(5).max(5000),
      contextSummary: z.string().trim().max(20_000).optional().nullable(),
      recommendation: z.string().trim().max(20_000).optional().nullable(),
      decisionAuthority: decisionAuthoritySchema.default("abdulrahman"),
      dueAt: z.string().optional().nullable(),
      idempotencyKey: z.string().trim().min(8).max(128).optional(),
    }))
    .mutation(({ ctx, input }) => {
      assertComoNextEnabled();
      return createDecisionCommand({ userId: ctx.user.id, ...input });
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

  resolveDecision: protectedProcedure
    .input(z.object({
      decisionId: z.number().int().positive(),
      nextStatus: z.enum(["approved", "rejected", "deferred"]),
      decisionAuthority: decisionAuthoritySchema,
      decisionText: z.string().trim().min(3).max(20_000),
      evidenceReference: z.string().trim().max(5000).optional().nullable(),
      deferredUntil: z.string().optional().nullable(),
    }))
    .mutation(({ ctx, input }) => {
      assertComoNextEnabled();
      return resolveDecisionCommand({ userId: ctx.user.id, ...input });
    }),

  getMeetingWorkspace: protectedProcedure
    .input(z.object({ meetingId: z.number().int().positive() }))
    .query(({ ctx, input }) => {
      assertComoNextEnabled();
      return getMeetingWorkspace(input.meetingId, ctx.user.id);
    }),

  createMeeting: protectedProcedure
    .input(z.object({
      workFileId: z.number().int().positive(),
      title: z.string().trim().min(3).max(1000),
      objective: z.string().trim().max(10_000).optional().nullable(),
      meetingType: z.string().trim().max(80).optional().nullable(),
      meetingFormat: z.string().trim().max(80).optional().nullable(),
      startsAt: z.string().optional().nullable(),
      endsAt: z.string().optional().nullable(),
      location: z.string().trim().max(1000).optional().nullable(),
      participantNames: z.array(z.string().trim().min(2).max(255)).max(50).optional(),
      idempotencyKey: z.string().trim().min(8).max(128).optional(),
    }))
    .mutation(({ ctx, input }) => {
      assertComoNextEnabled();
      return createMeetingCommand({ userId: ctx.user.id, ...input });
    }),

  addMeetingAgendaItem: protectedProcedure
    .input(z.object({
      meetingId: z.number().int().positive(),
      itemKind: z.enum(["question", "check", "decision", "commitment", "risk", "note"]),
      category: z.string().trim().max(255).optional().nullable(),
      promptAr: z.string().trim().min(3).max(10_000),
      briefingNote: z.string().trim().max(10_000).optional().nullable(),
      desiredOutcome: z.string().trim().max(10_000).optional().nullable(),
      audience: z.enum(["discuss", "internal_only", "reference"]).default("discuss"),
      priority: z.enum(["critical", "high", "normal"]).default("normal"),
      isRequired: z.boolean().default(false),
      sourceEvidence: z.string().trim().max(10_000).optional().nullable(),
    }))
    .mutation(({ ctx, input }) => {
      assertComoNextEnabled();
      return addMeetingAgendaItemCommand({ userId: ctx.user.id, ...input });
    }),

  updateMeetingAgendaItem: protectedProcedure
    .input(z.object({ agendaItemId: z.number().int().positive(), response: z.string().trim().max(20_000).optional().nullable(), isChecked: z.boolean() }))
    .mutation(({ ctx, input }) => {
      assertComoNextEnabled();
      return updateMeetingAgendaItemCommand({ userId: ctx.user.id, ...input });
    }),

  recordMeetingConsent: protectedProcedure
    .input(z.object({
      meetingId: z.number().int().positive(),
      consentScope: z.enum(["recording", "transcription"]),
      consentStatus: z.enum(["granted", "declined", "not_required"]),
      consentBasis: z.string().trim().max(5000).optional().nullable(),
      evidenceReference: z.string().trim().max(5000).optional().nullable(),
    }))
    .mutation(({ ctx, input }) => {
      assertComoNextEnabled();
      return recordMeetingConsentCommand({ userId: ctx.user.id, ...input });
    }),

  addMeetingSource: protectedProcedure
    .input(z.object({
      meetingId: z.number().int().positive(),
      sourceKind: z.enum(["preparation", "notes", "transcript"]),
      visibility: z.enum(["meeting_record", "internal_only"]).default("meeting_record"),
      title: z.string().trim().min(3).max(1000),
      rawText: z.string().trim().min(10).max(500_000),
      idempotencyKey: z.string().trim().min(8).max(128).optional(),
    }))
    .mutation(({ ctx, input }) => {
      assertComoNextEnabled();
      return addMeetingSourceCommand({ userId: ctx.user.id, ...input });
    }),

  analyzeMeetingSource: protectedProcedure
    .input(z.object({ sourceId: z.number().int().positive(), requestKey: z.string().trim().min(8).max(128) }))
    .mutation(({ ctx, input }) => {
      assertComoNextEnabled();
      return analyzeMeetingSourceCommand({ userId: ctx.user.id, ...input });
    }),

  reviewMeetingProposal: protectedProcedure
    .input(z.object({
      proposalId: z.number().int().positive(),
      decision: z.enum(["apply", "dismiss"]),
      applyAs: meetingProposalTargetSchema.optional(),
      reviewNote: z.string().trim().max(5000).optional().nullable(),
    }))
    .mutation(({ ctx, input }) => {
      assertComoNextEnabled();
      return reviewMeetingProposalCommand({ userId: ctx.user.id, ...input });
    }),

  prepareMeetingMinutes: protectedProcedure
    .input(z.object({ meetingId: z.number().int().positive(), summary: z.string().trim().min(10).max(50_000) }))
    .mutation(({ ctx, input }) => {
      assertComoNextEnabled();
      return prepareMeetingMinutesCommand({ userId: ctx.user.id, ...input });
    }),

  reviewMeetingMinutes: protectedProcedure
    .input(z.object({ minutesId: z.number().int().positive(), decision: z.enum(["approve", "reject"]), reviewNote: z.string().trim().max(5000).optional().nullable() }))
    .mutation(({ ctx, input }) => {
      assertComoNextEnabled();
      return reviewMeetingMinutesCommand({ userId: ctx.user.id, ...input });
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
