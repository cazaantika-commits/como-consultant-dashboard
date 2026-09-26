import { sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { requireProjectAccess } from "./comoNextCommands";

function rows<T>(result: unknown): T[] {
  if (Array.isArray(result) && Array.isArray(result[0])) return result[0] as T[];
  return result as T[];
}

function parseList(value: unknown): string[] {
  try {
    const parsed = JSON.parse(String(value || "[]"));
    return Array.isArray(parsed) ? parsed.map(item => String(item)) : [];
  } catch {
    return [];
  }
}

export async function getProjectExecutiveFile(input: { userId: number; projectId: number }) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "قاعدة البيانات غير متاحة" });
  const access = await requireProjectAccess(db, input.projectId, input.userId, "read");

  const [projectResult, dossierResult, workFilesResult, actionsResult, decisionsResult, communicationsResult, meetingsResult, partiesResult, memoryResult] = await Promise.all([
    db.execute(sql`
      SELECT id, name, description, plotNumber, areaCode, titleDeedNumber, ddaNumber,
        masterDevRef, plotAreaSqm, plotAreaSqft, gfaSqm, gfaSqft, permittedUse,
        ownershipType, masterDevName, registrationAuthority, constructionPeriod,
        constructionStartDate, completionDate, updatedAt
      FROM projects WHERE id = ${input.projectId} AND is_test_project = 0 LIMIT 1
    `),
    db.execute(sql`
      SELECT id, executive_context AS executiveContext, current_position AS currentPosition,
        lifecycle_phases_json AS lifecyclePhasesJson, key_parties_json AS keyPartiesJson,
        dependencies_json AS dependenciesJson, open_threads_json AS openThreadsJson,
        memory_gaps_json AS memoryGapsJson, brief_status AS briefStatus,
        source_sha256 AS sourceSha256, reviewed_at AS reviewedAt
      FROM como_next_project_dossiers
      WHERE project_id = ${input.projectId} AND brief_status = 'reviewed'
      LIMIT 1
    `),
    db.execute(sql`
      SELECT wf.id, wf.title, wf.governing_question AS governingQuestion,
        wf.desired_outcome AS desiredOutcome, wf.work_file_status AS workFileStatus,
        wf.priority, wf.updated_at AS updatedAt,
        (SELECT COUNT(*) FROM como_next_actions a WHERE a.work_file_id = wf.id AND a.action_status NOT IN ('verified','cancelled')) AS openActionCount,
        (SELECT COUNT(*) FROM como_next_decisions d WHERE d.work_file_id = wf.id AND d.decision_status IN ('required','deferred')) AS pendingDecisionCount,
        (SELECT COUNT(*) FROM como_next_communications c WHERE c.work_file_id = wf.id) AS communicationCount,
        (SELECT COUNT(*) FROM como_next_meetings m WHERE m.work_file_id = wf.id) AS meetingCount,
        (SELECT COUNT(*) FROM como_next_work_memory wm WHERE wm.work_file_id = wf.id AND wm.is_current = 1) AS memoryCount,
        (SELECT a.title FROM como_next_actions a WHERE a.work_file_id = wf.id AND a.action_status NOT IN ('verified','cancelled') ORDER BY CASE WHEN a.attention_at IS NULL THEN 1 ELSE 0 END, a.attention_at ASC, a.id ASC LIMIT 1) AS nextActionTitle,
        (SELECT a.attention_at FROM como_next_actions a WHERE a.work_file_id = wf.id AND a.action_status NOT IN ('verified','cancelled') ORDER BY CASE WHEN a.attention_at IS NULL THEN 1 ELSE 0 END, a.attention_at ASC, a.id ASC LIMIT 1) AS nextAttentionAt
      FROM como_next_work_files wf
      LEFT JOIN como_next_import_batches b ON b.batch_id = wf.import_batch_id
      WHERE wf.project_id = ${input.projectId}
        AND (wf.import_batch_id IS NULL OR b.batch_status = 'promoted')
      ORDER BY CASE wf.work_file_status WHEN 'open' THEN 0 WHEN 'waiting' THEN 1 WHEN 'blocked' THEN 2 WHEN 'draft' THEN 3 ELSE 4 END,
        CASE wf.priority WHEN 'urgent' THEN 0 WHEN 'important' THEN 1 ELSE 2 END, wf.updated_at DESC
    `),
    db.execute(sql`
      SELECT a.id, a.work_file_id AS workFileId, wf.title AS workFileTitle, a.title,
        a.action_status AS actionStatus, a.priority, a.owner_type AS ownerType,
        a.due_at AS dueAt, a.follow_up_at AS followUpAt, a.attention_at AS attentionAt,
        party.display_name AS waitingPartyName
      FROM como_next_actions a
      JOIN como_next_work_files wf ON wf.id = a.work_file_id AND wf.project_id = a.project_id
      LEFT JOIN como_next_project_parties pp ON pp.id = a.waiting_project_party_id AND pp.project_id = a.project_id
      LEFT JOIN como_next_parties party ON party.id = pp.party_id
      WHERE a.project_id = ${input.projectId} AND a.action_status NOT IN ('verified','cancelled')
      ORDER BY CASE a.priority WHEN 'urgent' THEN 0 WHEN 'important' THEN 1 ELSE 2 END,
        CASE WHEN a.attention_at IS NULL THEN 1 ELSE 0 END, a.attention_at ASC, a.id ASC
    `),
    db.execute(sql`
      SELECT d.id, d.work_file_id AS workFileId, wf.title AS workFileTitle, d.title,
        d.question, d.context_summary AS contextSummary, d.recommendation,
        d.decision_status AS decisionStatus, d.decision_authority AS decisionAuthority,
        d.due_at AS dueAt, d.decision_text AS decisionText
      FROM como_next_decisions d
      JOIN como_next_work_files wf ON wf.id = d.work_file_id AND wf.project_id = d.project_id
      WHERE d.project_id = ${input.projectId}
      ORDER BY CASE d.decision_status WHEN 'required' THEN 0 WHEN 'deferred' THEN 1 ELSE 2 END,
        d.due_at ASC, d.id DESC
    `),
    db.execute(sql`
      SELECT c.id, c.work_file_id AS workFileId, wf.title AS workFileTitle,
        c.subject, c.direction, c.channel, c.communication_status AS communicationStatus,
        c.from_text AS fromText, c.to_text AS toText, c.occurred_at AS occurredAt
      FROM como_next_communications c
      JOIN como_next_work_files wf ON wf.id = c.work_file_id AND wf.project_id = c.project_id
      WHERE c.project_id = ${input.projectId}
      ORDER BY c.occurred_at DESC, c.id DESC LIMIT 12
    `),
    db.execute(sql`
      SELECT m.id, m.work_file_id AS workFileId, wf.title AS workFileTitle,
        m.title, m.meeting_status AS meetingStatus, m.starts_at AS startsAt,
        m.outcome_summary AS outcomeSummary,
        (SELECT COUNT(*) FROM como_next_meeting_proposals proposal WHERE proposal.meeting_id = m.id AND proposal.review_status = 'pending') AS pendingProposalCount,
        (SELECT minutes.minutes_status FROM como_next_meeting_minutes minutes WHERE minutes.meeting_id = m.id ORDER BY minutes.version DESC LIMIT 1) AS latestMinutesStatus
      FROM como_next_meetings m
      JOIN como_next_work_files wf ON wf.id = m.work_file_id AND wf.project_id = m.project_id
      WHERE m.project_id = ${input.projectId}
      ORDER BY m.starts_at DESC, m.id DESC LIMIT 12
    `),
    db.execute(sql`
      SELECT party.id, party.display_name AS displayName, party.party_type AS partyType,
        party.party_status AS partyStatus, pp.role_code AS roleCode,
        pp.relationship_status AS relationshipStatus,
        (SELECT contact.display_name FROM como_next_party_contacts contact WHERE contact.party_id = party.id ORDER BY contact.is_primary DESC, contact.id ASC LIMIT 1) AS primaryContactName,
        (SELECT contact.email FROM como_next_party_contacts contact WHERE contact.party_id = party.id ORDER BY contact.is_primary DESC, contact.id ASC LIMIT 1) AS primaryContactEmail
      FROM como_next_project_parties pp
      JOIN como_next_parties party ON party.id = pp.party_id
      WHERE pp.project_id = ${input.projectId}
      ORDER BY CASE pp.relationship_status WHEN 'active' THEN 0 ELSE 1 END, party.display_name
    `),
    db.execute(sql`
      SELECT wm.id, wm.work_file_id AS workFileId, wf.title AS workFileTitle,
        wm.memory_type AS memoryType, wm.entry_type AS entryType, wm.title, wm.body,
        wm.source_status AS sourceStatus, wm.occurred_at AS occurredAt,
        annotation.confidence, annotation.sensitivity,
        annotation.evidence_refs_json AS evidenceRefsJson,
        annotation.reviewed_at AS reviewedAt
      FROM como_next_work_memory wm
      JOIN como_next_work_files wf ON wf.id = wm.work_file_id AND wf.project_id = wm.project_id
      LEFT JOIN como_next_memory_annotations annotation ON annotation.memory_id = wm.id
      WHERE wm.project_id = ${input.projectId} AND wm.is_current = 1
      ORDER BY CASE WHEN annotation.id IS NULL THEN 1 ELSE 0 END, annotation.reviewed_at DESC, wm.occurred_at DESC, wm.id DESC
    `),
  ]);

  const project = rows<any>(projectResult)[0];
  if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "لم يُعثر على المشروع" });
  const dossierRaw = rows<any>(dossierResult)[0];
  const workFiles = rows<any>(workFilesResult).map(row => ({
    ...row,
    id: Number(row.id),
    openActionCount: Number(row.openActionCount || 0),
    pendingDecisionCount: Number(row.pendingDecisionCount || 0),
    communicationCount: Number(row.communicationCount || 0),
    meetingCount: Number(row.meetingCount || 0),
    memoryCount: Number(row.memoryCount || 0),
  }));
  const actions = rows<any>(actionsResult).map(row => ({ ...row, id: Number(row.id), workFileId: Number(row.workFileId) }));
  const decisions = rows<any>(decisionsResult).map(row => ({ ...row, id: Number(row.id), workFileId: Number(row.workFileId) }));
  const communications = rows<any>(communicationsResult).map(row => ({ ...row, id: Number(row.id), workFileId: Number(row.workFileId) }));
  const meetings = rows<any>(meetingsResult).map(row => ({
    ...row,
    id: Number(row.id),
    workFileId: Number(row.workFileId),
    pendingProposalCount: Number(row.pendingProposalCount || 0),
  }));
  const memory = rows<any>(memoryResult).map(row => ({
    ...row,
    id: Number(row.id),
    workFileId: Number(row.workFileId),
    evidenceRefs: parseList(row.evidenceRefsJson),
    reviewed: Boolean(row.confidence),
  }));
  const activeWorkFiles = workFiles.filter(row => !["closed", "cancelled"].includes(row.workFileStatus));
  const reviewedMemory = memory.filter(row => row.reviewed);

  return {
    project,
    accessRole: access.role,
    dossier: dossierRaw ? {
      id: Number(dossierRaw.id),
      executiveContext: dossierRaw.executiveContext,
      currentPosition: dossierRaw.currentPosition,
      lifecyclePhases: parseList(dossierRaw.lifecyclePhasesJson),
      keyParties: parseList(dossierRaw.keyPartiesJson),
      dependencies: parseList(dossierRaw.dependenciesJson),
      openThreads: parseList(dossierRaw.openThreadsJson),
      memoryGaps: parseList(dossierRaw.memoryGapsJson),
      briefStatus: dossierRaw.briefStatus,
      sourceSha256: dossierRaw.sourceSha256,
      reviewedAt: dossierRaw.reviewedAt,
    } : null,
    summary: {
      workFiles: workFiles.length,
      activeWorkFiles: activeWorkFiles.length,
      openActions: actions.length,
      pendingDecisions: decisions.filter(row => ["required", "deferred"].includes(row.decisionStatus)).length,
      communications: communications.length,
      meetings: meetings.length,
      reviewedMemory: reviewedMemory.length,
      activeParties: rows<any>(partiesResult).filter(row => row.relationshipStatus === "active").length,
    },
    workFiles,
    actions,
    decisions,
    communications,
    meetings,
    parties: rows<any>(partiesResult).map(row => ({ ...row, id: Number(row.id) })),
    reviewedMemory,
    memory,
  };
}
