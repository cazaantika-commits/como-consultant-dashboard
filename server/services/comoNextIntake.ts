import { TRPCError } from "@trpc/server";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  comoAppOwnerIdentity,
  comoNextIntakeProposals,
  comoNextWorkFiles,
  comoNextWorkMemory,
  users,
} from "../../drizzle/schema";
import { getDb } from "../db";
import { matchesAuthenticatedAppOwner, type AppOwnerBinding } from "./comoAppOwner";
import {
  appendEvent,
  createActionCommand,
  createCommunicationDraftCommand,
  createDecisionCommand,
  requireProjectAccess,
  requireOneCommandUpdate,
  toSqlUtcTimestamp,
  type ComoNextDatabase,
  type ComoNextTransaction,
} from "./comoNextCommands";

export type IntakeProposalKind = "action" | "decision" | "communication_draft" | "note";
export type IntakeProposalPriority = "normal" | "important" | "urgent";
export type IntakeProposalOwner = "human" | "manus" | "team";
export type IntakeProposalChannel = "email" | "whatsapp" | "letter" | "phone_note" | "internal";

export type IntakeProposalDraft = {
  kind: IntakeProposalKind;
  title: string;
  content?: string | null;
  acceptanceCriteria?: string | null;
  ownerType?: IntakeProposalOwner | null;
  priority?: IntakeProposalPriority | null;
  dueAt?: string | null;
  channel?: IntakeProposalChannel | null;
  toText?: string | null;
  evidenceExcerpt: string;
};

const rowsOf = <T>(value: unknown): T[] => Array.isArray(value) && Array.isArray(value[0]) ? value[0] as T[] : value as T[];
const nowSql = () => new Date().toISOString().slice(0, 19).replace("T", " ");

function databaseUnavailable(): never {
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "قاعدة البيانات غير متاحة" });
}

function clean(value: unknown, max: number) {
  return String(value || "").trim().slice(0, max);
}
export function normalizeIntakeProposalDraft(proposal: IntakeProposalDraft) {
  return {
    ...proposal,
    kind: ["action", "decision", "communication_draft", "note"].includes(String(proposal.kind)) ? proposal.kind : null,
    ownerType: proposal.kind === "note" ? null : ["human", "manus", "team"].includes(String(proposal.ownerType)) ? proposal.ownerType : null,
    priority: proposal.priority === "important" || proposal.priority === "urgent" ? proposal.priority : "normal" as const,
    dueAt: proposal.dueAt && !Number.isNaN(Date.parse(proposal.dueAt)) ? toSqlUtcTimestamp(proposal.dueAt) : null,
    channel: ["email", "whatsapp", "letter", "phone_note", "internal"].includes(String(proposal.channel)) ? proposal.channel : null,
  };
}

export function assertReviewOnlyIntake(input: { sourceKind: string; reviewStatus: string; targetId?: number | null }) {
  if (!['email', 'sara'].includes(input.sourceKind)) throw new Error("Unsupported intake source");
  if (input.reviewStatus !== "pending" || input.targetId) throw new Error("New intake proposals must remain review-only");
}

async function requireWorkFile(db: ComoNextDatabase | ComoNextTransaction, input: { userId: number; projectId: number; workFileId: number; required?: "read" | "write" }) {
  await requireProjectAccess(db, input.projectId, input.userId, input.required || "write");
  const query = db.select({ id: comoNextWorkFiles.id, projectId: comoNextWorkFiles.projectId, status: comoNextWorkFiles.workFileStatus })
    .from(comoNextWorkFiles)
    .where(and(eq(comoNextWorkFiles.id, input.workFileId), eq(comoNextWorkFiles.projectId, input.projectId)))
    .limit(1);
  const [workFile] = await ("rollback" in db ? query.for("update") : query);
  if (!workFile) throw new TRPCError({ code: "NOT_FOUND", message: "ملف العمل لا يتبع المشروع المختار" });
  if (["closed", "cancelled"].includes(workFile.status)) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "لا يمكن إضافة مقترح إلى ملف عمل مغلق" });
  return workFile;
}

export async function createIntakeProposalsCommand(input: {
  userId: number;
  projectId: number;
  workFileId: number;
  sourceKind: "email" | "sara";
  sourcePrefix: string;
  sourceEmailId?: number | null;
  sourceEmailAnalysisId?: number | null;
  requestedByMemberId?: string | null;
  proposals: IntakeProposalDraft[];
}) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  await requireWorkFile(db, input);
  const candidates = input.proposals.slice(0, 8).map((draft, index) => {
    const proposal = normalizeIntakeProposalDraft(draft);
    return {
      ordinal: index + 1,
      kind: proposal.kind,
      title: clean(proposal.title, 1000),
      content: clean(proposal.content, 100_000) || null,
      acceptanceCriteria: clean(proposal.acceptanceCriteria, 5_000) || null,
      ownerType: proposal.ownerType,
      priority: proposal.priority,
      dueAt: proposal.dueAt,
      channel: proposal.channel,
      toText: clean(proposal.toText, 5_000) || null,
      evidenceExcerpt: clean(proposal.evidenceExcerpt, 5_000),
    };
  }).filter((proposal): proposal is typeof proposal & { kind: IntakeProposalKind } => Boolean(proposal.kind && proposal.title && proposal.evidenceExcerpt));
  if (!candidates.length) return { created: 0, duplicates: 0, ids: [] as number[] };

  return db.transaction(async tx => {
    const ids: number[] = [];
    const createdIds: number[] = [];
    let duplicates = 0;
    for (const proposal of candidates) {
      const sourceRecordId = `${input.sourcePrefix}:${proposal.ordinal}`.slice(0, 255);
      const [existing] = await tx.select({ id: comoNextIntakeProposals.id, userId: comoNextIntakeProposals.userId, projectId: comoNextIntakeProposals.projectId, workFileId: comoNextIntakeProposals.workFileId }).from(comoNextIntakeProposals)
        .where(and(eq(comoNextIntakeProposals.sourceKind, input.sourceKind), eq(comoNextIntakeProposals.sourceRecordId, sourceRecordId))).limit(1);
      if (existing) {
        if (existing.userId !== input.userId || existing.projectId !== input.projectId || existing.workFileId !== input.workFileId) {
          throw new TRPCError({ code: "CONFLICT", message: "المصدر مرتبط بمرساة مختلفة؛ لا يعاد استعماله لهذا الملف" });
        }
        ids.push(Number(existing.id)); duplicates += 1; continue;
      }
      assertReviewOnlyIntake({ sourceKind: input.sourceKind, reviewStatus: "pending", targetId: null });
      const result = await tx.insert(comoNextIntakeProposals).values({
        userId: input.userId,
        projectId: input.projectId,
        workFileId: input.workFileId,
        sourceKind: input.sourceKind,
        sourceRecordId,
        sourceEmailId: input.sourceEmailId || null,
        sourceEmailAnalysisId: input.sourceEmailAnalysisId || null,
        requestedByMemberId: input.requestedByMemberId || null,
        proposalKind: proposal.kind,
        title: proposal.title,
        content: proposal.content,
        acceptanceCriteria: proposal.acceptanceCriteria,
        ownerType: proposal.ownerType,
        priority: proposal.priority,
        dueAt: proposal.dueAt,
        channel: proposal.channel,
        toText: proposal.toText,
        evidenceExcerpt: proposal.evidenceExcerpt,
        reviewStatus: "pending",
      });
      const id = Number(result[0].insertId);
      ids.push(id);
      createdIds.push(id);
    }
    if (createdIds.length) {
      await appendEvent(tx, {
        userId: input.userId,
        projectId: input.projectId,
        workFileId: input.workFileId,
        actorType: input.sourceKind === "email" ? "manus" : "human",
        eventType: `${input.sourceKind}_intake_proposals_captured`,
        summary: input.sourceKind === "email" ? `أعد Manus ${createdIds.length} مقترحًا من البريد للمراجعة` : "سجلت سارة طلبًا كمقترح ينتظر المراجعة",
        payload: { proposalCount: ids.length, created: createdIds.length, duplicates, operationalRecordsCreated: 0, externalSideEffect: false },
        idempotencyKey: `event:intake:${input.sourceKind}:${createdIds[0]}`,
      });
    }
    return { created: ids.length - duplicates, duplicates, ids };
  });
}

export async function listPendingIntakeProposals(userId: number, workFileId?: number) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const fileFilter = workFileId ? sql`AND proposal.work_file_id = ${workFileId}` : sql``;
  const result = await db.execute(sql`
    SELECT proposal.id, proposal.project_id AS projectId, project.name AS projectName,
      proposal.work_file_id AS workFileId, work_file.title AS workFileTitle,
      proposal.source_kind AS sourceKind, proposal.source_record_id AS sourceRecordId,
      proposal.proposal_kind AS proposalKind, proposal.title, proposal.content,
      proposal.acceptance_criteria AS acceptanceCriteria, proposal.owner_type AS ownerType,
      proposal.priority, proposal.due_at AS dueAt, proposal.channel, proposal.to_text AS toText,
      proposal.evidence_excerpt AS evidenceExcerpt, proposal.review_status AS reviewStatus,
      proposal.created_at AS createdAt, email_row.subject AS sourceEmailSubject,
      email_row.from_email AS sourceEmailFrom
    FROM como_next_intake_proposals proposal
    JOIN como_next_work_files work_file ON work_file.id = proposal.work_file_id AND work_file.project_id = proposal.project_id
    JOIN projects project ON project.id = proposal.project_id AND project.is_test_project = 0
    LEFT JOIN como_next_email_messages email_row ON email_row.id = proposal.source_email_id
    WHERE proposal.user_id = ${userId} AND proposal.review_status = 'pending' ${fileFilter}
    ORDER BY CASE proposal.priority WHEN 'urgent' THEN 0 WHEN 'important' THEN 1 ELSE 2 END,
      proposal.created_at ASC, proposal.id ASC
    LIMIT 200
  `);
  return rowsOf<any>(result).map(row => ({ ...row, id: Number(row.id), projectId: Number(row.projectId), workFileId: Number(row.workFileId) }));
}

export function selectSaraOwnerUserId(input: {
  configuredOpenId?: string | null;
  adminUsers: Array<{ id: number; openId: string }>;
}) {
  const configuredOpenId = String(input.configuredOpenId || "").trim();
  const configuredOwner = configuredOpenId
    ? input.adminUsers.find(user => user.openId === configuredOpenId)
    : undefined;
  if (configuredOwner) return Number(configuredOwner.id);
  if (input.adminUsers.length === 1) return Number(input.adminUsers[0].id);
  if (input.adminUsers.length === 0) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "لا يوجد حساب إدارة يمكن ربطه بمالك COMO" });
  }
  throw new TRPCError({ code: "PRECONDITION_FAILED", message: "يوجد أكثر من حساب إدارة؛ يجب تحديد مالك COMO صراحة" });
}

export async function resolveOwnerUserIdForSara(memberId: string) {
  if (memberId !== "abdulrahman") throw new TRPCError({ code: "FORBIDDEN", message: "سجل المقترحات من سارة متاح لعبد الرحمن فقط" });
  const db = await getDb();
  if (!db) databaseUnavailable();
  const [binding] = await db.select({ userId: comoAppOwnerIdentity.userId, openId: comoAppOwnerIdentity.openId, isActive: comoAppOwnerIdentity.isActive })
    .from(comoAppOwnerIdentity).where(eq(comoAppOwnerIdentity.id, 1)).limit(1);
  if (!binding || binding.isActive !== 1) return requireBoundSaraOwnerUserId(null, null);
  const [user] = await db.select({ id: users.id, openId: users.openId, role: users.role })
    .from(users).where(eq(users.id, binding.userId)).limit(1);
  return requireBoundSaraOwnerUserId(binding, user ?? null);
}

export function requireBoundSaraOwnerUserId(binding: AppOwnerBinding | null, user: { id: number; openId: string; role: string } | null) {
  if (!binding || !user || !matchesAuthenticatedAppOwner(user, binding, "")) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "هوية مالك COMO المثبتة غير متاحة لسارة؛ لا يُستعمل حساب إدارة بديل" });
  }
  return user.id;
}

export async function createSaraIntakeProposalCommand(input: {
  memberId: string;
  sessionId?: string | null;
  callId: string;
  sourceText: string;
  projectId: number;
  workFileId: number;
  kind: IntakeProposalKind;
  title: string;
  content?: string | null;
  acceptanceCriteria?: string | null;
  ownerType?: IntakeProposalOwner | null;
  priority?: IntakeProposalPriority | null;
  dueAt?: string | null;
  channel?: IntakeProposalChannel | null;
  toText?: string | null;
}) {
  const userId = await resolveOwnerUserIdForSara(input.memberId);
  const evidence = clean(input.sourceText, 5_000);
  if (!evidence) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "لا يوجد قول موثق لعبد الرحمن يمكن ربط المقترح به" });
  const sourcePrefix = `${clean(input.sessionId || "session", 120)}:${clean(input.callId, 120)}`;
  const result = await createIntakeProposalsCommand({
    userId,
    projectId: input.projectId,
    workFileId: input.workFileId,
    sourceKind: "sara",
    sourcePrefix,
    requestedByMemberId: input.memberId,
    proposals: [{
      kind: input.kind,
      title: input.title,
      content: input.content,
      acceptanceCriteria: input.acceptanceCriteria,
      ownerType: input.ownerType,
      priority: input.priority,
      dueAt: input.dueAt,
      channel: input.channel,
      toText: input.toText,
      evidenceExcerpt: evidence,
    }],
  });
  return { ...result, proposalOnly: true as const, operationalRecordsCreated: 0 as const, externalSideEffect: false as const };
}

export async function reviewIntakeProposalCommand(input: {
  userId: number;
  proposalId: number;
  decision: "apply" | "dismiss";
  reviewNote?: string | null;
  title?: string | null;
  content?: string | null;
  acceptanceCriteria?: string | null;
  ownerType?: IntakeProposalOwner | null;
  priority?: IntakeProposalPriority | null;
  dueAt?: string | null;
  channel?: IntakeProposalChannel | null;
  toText?: string | null;
}) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const reviewed = await db.transaction(async tx => {
    const [proposal] = await tx.select().from(comoNextIntakeProposals)
      .where(eq(comoNextIntakeProposals.id, input.proposalId)).limit(1).for("update");
    if (!proposal || proposal.userId !== input.userId) throw new TRPCError({ code: "NOT_FOUND", message: "لم يُعثر على المقترح" });
    await requireWorkFile(tx, { userId: input.userId, projectId: proposal.projectId, workFileId: proposal.workFileId });
    if (proposal.reviewStatus !== "pending") {
      return { proposal, replayed: true };
    }

    const title = clean(input.title || proposal.title, 1000);
    const content = clean(input.content ?? proposal.content, 100_000);
    const acceptanceCriteria = clean(input.acceptanceCriteria ?? proposal.acceptanceCriteria, 5_000);
    const ownerType = input.ownerType || proposal.ownerType || "human";
    const priority = input.priority || proposal.priority;
    const dueAt = input.dueAt ?? proposal.dueAt;
    const channel = input.channel || proposal.channel || "internal";
    const toText = clean(input.toText ?? proposal.toText, 5_000) || null;
    const idempotencyKey = `intake-proposal:${proposal.id}`;
    const appliedByManus = String(input.reviewNote || "").startsWith("AUTO_MANUS:");
    let targetId: number | null = null;

    if (input.decision === "apply") {
      if (proposal.proposalKind === "action") {
        if (!acceptanceCriteria) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "اعتماد الإجراء يحتاج معيار قبول واضح" });
        const result = await createActionCommand({ userId: input.userId, workFileId: proposal.workFileId, title, description: content || undefined, acceptanceCriteria, ownerType, priority, dueAt, idempotencyKey, actorType: appliedByManus ? "manus" : "human", actorUserId: appliedByManus ? null : input.userId }, tx);
        targetId = Number(result.id);
      } else if (proposal.proposalKind === "decision") {
        const result = await createDecisionCommand({ userId: input.userId, workFileId: proposal.workFileId, title, question: content || title, contextSummary: `مقترح من ${proposal.sourceKind === "email" ? "تحليل بريد" : "محادثة سارة"}. الدليل: ${proposal.evidenceExcerpt}`, decisionAuthority: "abdulrahman", dueAt, idempotencyKey }, tx);
        targetId = Number(result.id);
      } else if (proposal.proposalKind === "communication_draft") {
        if (!content) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "اعتماد مسودة المراسلة يحتاج نصًا" });
        const result = await createCommunicationDraftCommand({ userId: input.userId, workFileId: proposal.workFileId, channel, subject: title, body: content, toText, idempotencyKey }, tx);
        targetId = Number(result.id);
      } else if (proposal.proposalKind === "note") {
        const [existing] = await tx.select({ id: comoNextWorkMemory.id }).from(comoNextWorkMemory)
          .where(and(eq(comoNextWorkMemory.sourceSystem, "como_next_intake"), eq(comoNextWorkMemory.sourceRecordId, idempotencyKey))).limit(1);
        if (existing) targetId = Number(existing.id);
        else {
          const result = await tx.insert(comoNextWorkMemory).values({
            projectId: proposal.projectId, workFileId: proposal.workFileId,
            memoryType: "note", entryType: "reviewed_intake_note", title,
            body: `${content || ""}\n\nالدليل: ${proposal.evidenceExcerpt}`.trim(),
            sourceStatus: "reviewed", sourceSystem: "como_next_intake",
            sourceRecordId: idempotencyKey, occurredAt: nowSql(),
          });
          targetId = Number(result[0].insertId);
        }
      } else {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "نوع المقترح غير معروف" });
      }
    }

    const changes = {
      reviewStatus: input.decision === "apply" ? "applied" as const : "dismissed" as const,
      targetId, reviewNote: clean(input.reviewNote, 5_000) || null,
      reviewedByUserId: input.userId, reviewedAt: nowSql(), title,
      content: content || null, acceptanceCriteria: acceptanceCriteria || null,
      ownerType, priority, dueAt: dueAt ? toSqlUtcTimestamp(String(dueAt)) : null,
      channel, toText,
    };
    const updated = await tx.update(comoNextIntakeProposals).set(changes)
      .where(and(eq(comoNextIntakeProposals.id, proposal.id), eq(comoNextIntakeProposals.reviewStatus, "pending")));
    requireOneCommandUpdate(updated);
    await appendEvent(tx, {
      userId: input.userId, projectId: proposal.projectId, workFileId: proposal.workFileId,
      actorType: appliedByManus ? "manus" : "human", actorUserId: appliedByManus ? null : input.userId,
      eventType: input.decision === "apply" ? "intake_proposal_applied" : "intake_proposal_dismissed",
      summary: `${input.decision === "apply" ? "اعتماد وتحويل" : "استبعاد"} المقترح: ${title}`,
      payload: { proposalId: Number(proposal.id), proposalKind: proposal.proposalKind, targetId, externalSideEffect: false, mailboxWrite: false, sent: false },
      idempotencyKey: `event:intake-review:${proposal.id}`,
    });
    return { proposal: { ...proposal, ...changes }, replayed: false };
  });
  const proposal = reviewed.proposal;
  const target = proposal.reviewStatus === "applied" && proposal.targetId
    ? { kind: proposal.proposalKind, id: Number(proposal.targetId), projectId: proposal.projectId, workFileId: proposal.workFileId }
    : null;
  const result = {
    target,
    targetKind: target?.kind ?? null,
    // Legacy consumers treated this as actionIds. Fail closed for other kinds;
    // the actual persisted target remains available in the typed target above.
    targetId: target?.kind === "action" && !reviewed.replayed ? target.id : null,
    actionIds: target?.kind === "action" && !reviewed.replayed ? [target.id] : [],
    replayed: reviewed.replayed, externalSideEffect: false,
    mailboxWrite: false, sent: false,
  };
  if (input.decision !== "apply" || target?.kind !== "communication_draft" || proposal.channel !== "email") return result;
  // Existing exactly-once mailbox service resumes after the atomic DB commit.
  // A retry uses the persisted judgement/text, never overwrites it from payload.
  const draft = await createCommunicationDraftCommand({
    userId: input.userId, workFileId: proposal.workFileId, channel: "email",
    subject: proposal.title, body: proposal.content || "", toText: proposal.toText,
    idempotencyKey: `intake-proposal:${proposal.id}`,
  });
  return { ...result, mailboxWrite: draft.mailboxWrite, mailboxDraft: draft.mailboxDraft };
}
