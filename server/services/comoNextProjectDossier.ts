import { sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { requireProjectAccess } from "./comoNextCommands";
import { loadProjectFoundation } from "./comoNextProjectFoundation";

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

function asNumber(value: unknown) {
  return Number(value || 0);
}

function parseBusinessDate(value: unknown): number | null {
  const text = String(value || "").trim();
  if (!text) return null;
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(text) ? `${text}T23:59:59Z` : null;
  if (iso) {
    const parsed = Date.parse(iso);
    return Number.isNaN(parsed) ? null : parsed;
  }
  const dmy = text.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dmy) {
    const parsed = Date.UTC(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]), 23, 59, 59);
    return Number.isNaN(parsed) ? null : parsed;
  }
  const monthNames: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
  const short = text.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2}|\d{4})$/);
  if (short) {
    const month = monthNames[short[2].toLowerCase()];
    const rawYear = Number(short[3]);
    if (month !== undefined) return Date.UTC(rawYear < 100 ? 2000 + rawYear : rawYear, month, Number(short[1]), 23, 59, 59);
  }
  const parsed = Date.parse(text);
  return Number.isNaN(parsed) ? null : parsed;
}

export async function getProjectExecutiveFile(input: { userId: number; projectId: number }) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "قاعدة البيانات غير متاحة" });
  const access = await requireProjectAccess(db, input.projectId, input.userId, "read");

  const [
    projectResult,
    dossierResult,
    workFilesResult,
    actionsResult,
    decisionsResult,
    communicationsResult,
    meetingsResult,
    partiesResult,
    memoryResult,
    contractsResult,
    deliverablesResult,
    requirementSetsResult,
    rfpDraftsResult,
    permitsResult,
    lifecycleStagesResult,
    lifecycleServicesResult,
    lifecycleDocumentsResult,
    foundation,
  ] = await Promise.all([
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
    db.execute(sql`
      SELECT contract_row.id, contract_row.title, contract_row.contractNumber,
        type_row.name AS contractTypeName, type_row.nameEn AS contractTypeNameEn,
        contract_row.partyA, contract_row.partyB,
        contract_row.signDate, contract_row.startDate, contract_row.endDate,
        contract_row.contractStatus, contract_row.contractAnalysisStatus,
        contract_row.analysisSummary, contract_row.analysisObligations, contract_row.analysisRisks,
        contract_row.fileKey IS NOT NULL AS hasProtectedFile,
        contract_row.updatedAt
      FROM projectContracts contract_row
      LEFT JOIN contractTypes type_row ON type_row.id = contract_row.contractTypeId
      WHERE contract_row.projectId = ${input.projectId}
      ORDER BY CASE contract_row.contractStatus WHEN 'active' THEN 0 WHEN 'pending' THEN 1 WHEN 'draft' THEN 2 ELSE 3 END,
        contract_row.updatedAt DESC, contract_row.id DESC
    `),
    db.execute(sql`
      SELECT delivery.id, delivery.contract_id AS contractId, contract_row.title AS contractTitle,
        delivery.title, delivery.description, delivery.acceptance_criteria AS acceptanceCriteria,
        delivery.due_date AS dueDate, delivery.status, delivery.reference_url IS NOT NULL AS hasReference,
        delivery.updated_at AS updatedAt
      FROM contract_deliverables delivery
      JOIN projectContracts contract_row ON contract_row.id = delivery.contract_id AND contract_row.projectId = delivery.project_id
      WHERE delivery.project_id = ${input.projectId}
      ORDER BY CASE delivery.status WHEN 'overdue' THEN 0 WHEN 'returned' THEN 1 WHEN 'submitted' THEN 2 WHEN 'not_started' THEN 3 ELSE 4 END,
        delivery.due_date ASC, delivery.id DESC
    `),
    db.execute(sql`
      SELECT requirement_set.id, requirement_set.title, requirement_set.revision_no AS revisionNo,
        requirement_set.status, requirement_set.approved_at AS approvedAt,
        requirement.workstream,
        COUNT(requirement.id) AS itemCount,
        SUM(CASE WHEN requirement.is_required = 1 THEN 1 ELSE 0 END) AS requiredCount
      FROM project_consultant_requirement_sets requirement_set
      LEFT JOIN project_consultant_requirements requirement ON requirement.requirement_set_id = requirement_set.id
      WHERE requirement_set.project_id = ${input.projectId}
      GROUP BY requirement_set.id, requirement_set.title, requirement_set.revision_no,
        requirement_set.status, requirement_set.approved_at, requirement.workstream
      ORDER BY CASE requirement_set.status WHEN 'APPROVED' THEN 0 WHEN 'DRAFT' THEN 1 ELSE 2 END,
        requirement_set.revision_no DESC, requirement_set.id DESC, requirement.workstream
    `),
    db.execute(sql`
      SELECT id, title, status, created_at AS createdAt, updated_at AS updatedAt
      FROM consultant_rfp_drafts
      WHERE project_id = ${input.projectId}
      ORDER BY updated_at DESC, id DESC LIMIT 8
    `),
    db.execute(sql`
      SELECT id, architecturalDesignStatus, architecturalDesignDate,
        architecturalDesignFileKey IS NOT NULL AS hasArchitecturalEvidence,
        engineeringDesignStatus, engineeringDesignDate,
        engineeringDesignFileKey IS NOT NULL AS hasEngineeringEvidence,
        buildingPermitStatus, buildingPermitNumber, buildingPermitDate, buildingPermitExpiryDate,
        buildingPermitFileKey IS NOT NULL AS hasPermitEvidence,
        municipalityDesignApprovalStatus, municipalityDesignApprovalDate,
        designRequirements, buildingConditions, completionStatus, updatedAt
      FROM designsAndPermits
      WHERE projectId = ${input.projectId}
      ORDER BY updatedAt DESC, id DESC LIMIT 1
    `),
    db.execute(sql`
      SELECT instance.stageCode, stage.nameAr AS stageName,
        MIN(stage.sortOrder) AS sortOrder,
        COUNT(*) AS serviceCount,
        SUM(CASE WHEN instance.operationalStatus = 'completed' THEN 1 ELSE 0 END) AS completedCount,
        SUM(CASE WHEN instance.operationalStatus = 'submitted' THEN 1 ELSE 0 END) AS submittedCount,
        SUM(CASE WHEN instance.operationalStatus = 'in_progress' THEN 1 ELSE 0 END) AS inProgressCount,
        SUM(CASE WHEN instance.operationalStatus = 'locked' THEN 1 ELSE 0 END) AS lockedCount
      FROM project_service_instances instance
      LEFT JOIN lifecycle_stages stage ON stage.stageCode = instance.stageCode
      WHERE instance.projectId = ${input.projectId}
      GROUP BY instance.stageCode, stage.nameAr
      ORDER BY sortOrder ASC, instance.stageCode
    `),
    db.execute(sql`
      SELECT instance.id, instance.serviceCode, instance.stageCode,
        service.nameAr AS serviceName, service.externalParty, service.internalOwner,
        service.isMandatory, instance.operationalStatus,
        instance.plannedStartDate, instance.plannedDueDate,
        instance.actualStartDate, instance.actualCloseDate, instance.notes,
        (SELECT COUNT(*) FROM lifecycle_requirements requirement
          WHERE requirement.serviceCode = instance.serviceCode AND requirement.isMandatory = 1) AS mandatoryRequirementCount,
        (SELECT COUNT(*) FROM lifecycle_requirements requirement
          WHERE requirement.serviceCode = instance.serviceCode AND requirement.isMandatory = 1
            AND NOT EXISTS (
              SELECT 1 FROM project_requirement_status status_row
              WHERE status_row.projectId = instance.projectId
                AND status_row.serviceCode = instance.serviceCode
                AND status_row.requirementCode = requirement.requirementCode
                AND status_row.status IN ('completed','not_applicable')
            )) AS mandatoryGapCount,
        (SELECT COUNT(*) FROM project_stage_documents document_row
          WHERE document_row.projectId = instance.projectId
            AND document_row.serviceCode = instance.serviceCode) AS documentCount
      FROM project_service_instances instance
      LEFT JOIN lifecycle_services service ON service.serviceCode = instance.serviceCode
      WHERE instance.projectId = ${input.projectId}
      ORDER BY instance.plannedDueDate ASC, instance.id ASC
    `),
    db.execute(sql`
      SELECT serviceCode, docStatus, COUNT(*) AS documentCount
      FROM project_stage_documents
      WHERE projectId = ${input.projectId}
      GROUP BY serviceCode, docStatus
      ORDER BY serviceCode, docStatus
    `),
    loadProjectFoundation(db, input.projectId),
  ]);

  const project = rows<any>(projectResult)[0];
  if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "لم يُعثر على المشروع" });
  const dossierRaw = rows<any>(dossierResult)[0];
  const workFiles = rows<any>(workFilesResult).map(row => ({
    ...row,
    id: asNumber(row.id),
    openActionCount: asNumber(row.openActionCount),
    pendingDecisionCount: asNumber(row.pendingDecisionCount),
    communicationCount: asNumber(row.communicationCount),
    meetingCount: asNumber(row.meetingCount),
    memoryCount: asNumber(row.memoryCount),
  }));
  const actions = rows<any>(actionsResult).map(row => ({ ...row, id: asNumber(row.id), workFileId: asNumber(row.workFileId) }));
  const decisions = rows<any>(decisionsResult).map(row => ({ ...row, id: asNumber(row.id), workFileId: asNumber(row.workFileId) }));
  const communications = rows<any>(communicationsResult).map(row => ({ ...row, id: asNumber(row.id), workFileId: asNumber(row.workFileId) }));
  const meetings = rows<any>(meetingsResult).map(row => ({
    ...row,
    id: asNumber(row.id),
    workFileId: asNumber(row.workFileId),
    pendingProposalCount: asNumber(row.pendingProposalCount),
  }));
  const memory = rows<any>(memoryResult).map(row => ({
    ...row,
    id: asNumber(row.id),
    workFileId: asNumber(row.workFileId),
    evidenceRefs: parseList(row.evidenceRefsJson),
    reviewed: Boolean(row.confidence),
  }));
  const activeWorkFiles = workFiles.filter(row => !["closed", "cancelled"].includes(row.workFileStatus));
  const reviewedMemory = memory.filter(row => row.reviewed);

  const contracts = rows<any>(contractsResult).map(row => ({
    ...row,
    id: asNumber(row.id),
    hasProtectedFile: Boolean(row.hasProtectedFile),
    sourceType: "projectContracts" as const,
    sourcePath: `/contracts?projectId=${input.projectId}`,
  }));
  const now = Date.now();
  const deliverables = rows<any>(deliverablesResult).map(row => {
    const dueMs = parseBusinessDate(row.dueDate);
    const isOverdue = row.status !== "accepted" && dueMs !== null && dueMs < now;
    return {
      ...row,
      id: asNumber(row.id),
      contractId: asNumber(row.contractId),
      hasReference: Boolean(row.hasReference),
      isOverdue,
      isException: isOverdue || ["returned", "overdue"].includes(row.status),
      sourceType: "contract_deliverables" as const,
      sourcePath: `/contract-deliverables?projectId=${input.projectId}&contractId=${asNumber(row.contractId)}`,
    };
  });

  const requirementSetRows = rows<any>(requirementSetsResult);
  const requirementSets = new Map<number, any>();
  for (const row of requirementSetRows) {
    const id = asNumber(row.id);
    const existing = requirementSets.get(id) || {
      id,
      title: row.title,
      revisionNo: asNumber(row.revisionNo),
      status: row.status,
      approvedAt: row.approvedAt,
      itemCount: 0,
      requiredCount: 0,
      workstreams: [] as Array<{ workstream: string; itemCount: number; requiredCount: number }>,
    };
    const itemCount = asNumber(row.itemCount);
    const requiredCount = asNumber(row.requiredCount);
    existing.itemCount += itemCount;
    existing.requiredCount += requiredCount;
    if (row.workstream) existing.workstreams.push({ workstream: row.workstream, itemCount, requiredCount });
    requirementSets.set(id, existing);
  }
  const consultantRequirementSets = [...requirementSets.values()].sort((a, b) => {
    const rank = (value: string) => value === "APPROVED" ? 0 : value === "DRAFT" ? 1 : 2;
    return rank(a.status) - rank(b.status) || b.revisionNo - a.revisionNo || b.id - a.id;
  });
  const currentRequirementSet = consultantRequirementSets[0] || null;
  const rfpDrafts = rows<any>(rfpDraftsResult).map(row => ({ ...row, id: asNumber(row.id) }));
  const permit = rows<any>(permitsResult)[0] || null;
  if (permit) {
    permit.id = asNumber(permit.id);
    permit.hasArchitecturalEvidence = Boolean(permit.hasArchitecturalEvidence);
    permit.hasEngineeringEvidence = Boolean(permit.hasEngineeringEvidence);
    permit.hasPermitEvidence = Boolean(permit.hasPermitEvidence);
  }

  const lifecycleStages = rows<any>(lifecycleStagesResult).map(row => ({
    ...row,
    sortOrder: asNumber(row.sortOrder),
    serviceCount: asNumber(row.serviceCount),
    completedCount: asNumber(row.completedCount),
    submittedCount: asNumber(row.submittedCount),
    inProgressCount: asNumber(row.inProgressCount),
    lockedCount: asNumber(row.lockedCount),
  }));
  const lifecycleDocuments = rows<any>(lifecycleDocumentsResult).map(row => ({ ...row, documentCount: asNumber(row.documentCount) }));
  const lifecycleServices = rows<any>(lifecycleServicesResult).map(row => {
    const dueMs = parseBusinessDate(row.plannedDueDate);
    const isTerminal = row.operationalStatus === "completed";
    const isOverdue = !isTerminal && dueMs !== null && dueMs < now;
    return {
      ...row,
      id: asNumber(row.id),
      isMandatory: Boolean(row.isMandatory),
      mandatoryRequirementCount: asNumber(row.mandatoryRequirementCount),
      mandatoryGapCount: asNumber(row.mandatoryGapCount),
      documentCount: asNumber(row.documentCount),
      isOverdue,
      isException: isOverdue || ["in_progress", "submitted", "locked"].includes(row.operationalStatus),
      sourceType: "project_service_instances" as const,
      sourcePath: `/work-schedule?projectId=${input.projectId}`,
    };
  });
  const currentStage = lifecycleStages.find(stage => stage.inProgressCount > 0 || stage.submittedCount > 0)
    || lifecycleStages.find(stage => stage.completedCount < stage.serviceCount)
    || lifecycleStages.at(-1)
    || null;
  const scheduleExceptions = lifecycleServices.filter(row => row.isException).slice(0, 12);

  return {
    project,
    accessRole: access.role,
    foundation,
    dossier: dossierRaw ? {
      id: asNumber(dossierRaw.id),
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
      contracts: contracts.length,
      deliverableExceptions: deliverables.filter(row => row.isException).length,
      lifecycleExceptions: scheduleExceptions.length,
    },
    workFiles,
    actions,
    decisions,
    communications,
    meetings,
    parties: rows<any>(partiesResult).map(row => ({ ...row, id: asNumber(row.id) })),
    reviewedMemory,
    memory,
    sourceRegister: {
      readOnly: true,
      contracts,
      deliverables,
      consultantScope: {
        currentRequirementSet,
        historicalRevisions: consultantRequirementSets.slice(1).map(item => ({ id: item.id, revisionNo: item.revisionNo, status: item.status })),
        rfpDrafts,
        sourcePath: `/consultant-appointment-pack?projectId=${input.projectId}`,
      },
      permits: permit,
      lifecycle: {
        currentStage,
        stages: lifecycleStages,
        services: lifecycleServices,
        scheduleExceptions,
        documentSummary: lifecycleDocuments,
        sourcePath: `/work-schedule?projectId=${input.projectId}`,
      },
    },
  };
}
