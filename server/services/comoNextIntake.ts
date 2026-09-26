import { TRPCError } from "@trpc/server";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  comoNextIntakeProposals,
  comoNextWorkFiles,
  comoNextWorkMemory,
  users,
} from "../../drizzle/schema";
import { ENV } from "../_core/env";
import { getDb } from "../db";
import {
  appendEvent,
  createActionCommand,
  createCommunicationDraftCommand,
  createDecisionCommand,
  requireProjectAccess,
  toSqlUtcTimestamp,
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

export function assertReviewOnlyIntake(input: { sourceKind: string; reviewStatus: string; targetId?: number | null }) {
  if (!['email', 'sara'].includes(input.sourceKind)) throw new Error("Unsupported intake source");
  if (input.reviewStatus !== "pending" || input.targetId) throw new Error("New intake proposals must remain review-only");
}

async function requireWorkFile(db: any, input: { userId: number; projectId: number; workFileId: number; required?: "read" | "write" }) {
  await requireProjectAccess(db, input.projectId, input.userId, input.required || "write");
  const [workFile] = await db.select({ id: comoNextWorkFiles.id, projectId: comoNextWorkFiles.projectId, status: comoNextWorkFiles.workFileStatus })
    .from(comoNextWorkFiles)
    .where(and(eq(comoNextWorkFiles.id, input.workFileId), eq(comoNextWorkFiles.projectId, input.projectId)))
    .limit(1);
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
  const candidates = input.proposals.slice(0, 8).map((proposal, index) => ({
    ordinal: index + 1,
    kind: proposal.kind,
    title: clean(proposal.title, 1000),
    content: clean(proposal.content, 100_000) || null,
    acceptanceCriteria: clean(proposal.acceptanceCriteria, 5_000) || null,
    ownerType: proposal.ownerType || null,
    priority: proposal.priority || "normal",
    dueAt: proposal.dueAt ? toSqlUtcTimestamp(proposal.dueAt) : null,
    channel: proposal.channel || null,
    toText: clean(proposal.toText, 5_000) || null,
    evidenceExcerpt: clean(proposal.evidenceExcerpt, 5_000),
  })).filter(proposal => proposal.title && proposal.evidenceExcerpt);
  if (!candidates.length) return { created: 0, duplicates: 0, ids: [] as number[] };

  return db.transaction(async tx => {
    const ids: number[] = [];
    const createdIds: number[] = [];
    let duplicates = 0;
    for (const proposal of candidates) {
      const sourceRecordId = `${input.sourcePrefix}:${proposal.ordinal}`.slice(0, 255);
      const [existing] = await tx.select({ id: comoNextIntakeProposals.id }).from(comoNextIntakeProposals)
        .where(and(eq(comoNextIntakeProposals.sourceKind, input.sourceKind), eq(comoNextIntakeProposals.sourceRecordId, sourceRecordId))).limit(1);
      if (existing) { ids.push(Number(existing.id)); duplicates += 1; continue; }
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

export async function resolveOwnerUserIdForSara(memberId: string) {
  if (memberId !== "abdulrahman") throw new TRPCError({ code: "FORBIDDEN", message: "سجل المقترحات من سارة متاح لعبد الرحمن فقط" });
  const db = await getDb();
  if (!db) databaseUnavailable();
  const ownerOpenId = ENV.ownerOpenId.trim();
  if (!ownerOpenId) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "هوية مالك COMO غير مهيأة" });
  const [owner] = await db.select({ id: users.id }).from(users).where(and(eq(users.openId, ownerOpenId), eq(users.role, "admin"))).limit(1);
  if (!owner) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "تعذر ربط هوية عبد الرحمن بحساب مالك COMO" });
  return Number(owner.id);
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
  const [proposal] = await db.select().from(comoNextIntakeProposals).where(eq(comoNextIntakeProposals.id, input.proposalId)).limit(1);
  if (!proposal || proposal.userId !== input.userId) throw new TRPCError({ code: "NOT_FOUND", message: "لم يُعثر على المقترح" });
  await requireWorkFile(db, { userId: input.userId, projectId: proposal.projectId, workFileId: proposal.workFileId });
  if (proposal.reviewStatus !== "pending") return { targetId: proposal.targetId ? Number(proposal.targetId) : null, replayed: true as const, externalSideEffect: false as const };

  const title = clean(input.title || proposal.title, 1000);
  const content = clean(input.content ?? proposal.content, 100_000);
  const acceptanceCriteria = clean(input.acceptanceCriteria ?? proposal.acceptanceCriteria, 5_000);
  const ownerType = input.ownerType || proposal.ownerType || "human";
  const priority = input.priority || proposal.priority;
  const dueAt = input.dueAt ?? proposal.dueAt;
  const channel = input.channel || proposal.channel || "internal";
  const toText = clean(input.toText ?? proposal.toText, 5_000) || null;
  const idempotencyKey = `intake-proposal:${proposal.id}`;
  let targetId: number | null = null;

  if (input.decision === "apply") {
    if (proposal.proposalKind === "action") {
      if (!acceptanceCriteria) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "اعتماد الإجراء يحتاج معيار قبول واضح" });
      const result = await createActionCommand({ userId: input.userId, workFileId: proposal.workFileId, title, description: content || undefined, acceptanceCriteria, ownerType, priority, dueAt, idempotencyKey });
      targetId = Number(result.id);
    } else if (proposal.proposalKind === "decision") {
      const result = await createDecisionCommand({ userId: input.userId, workFileId: proposal.workFileId, title, question: content || title, contextSummary: `مقترح من ${proposal.sourceKind === "email" ? "تحليل بريد" : "محادثة سارة"}. الدليل: ${proposal.evidenceExcerpt}`, decisionAuthority: "abdulrahman", dueAt, idempotencyKey });
      targetId = Number(result.id);
    } else if (proposal.proposalKind === "communication_draft") {
      if (!content) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "اعتماد مسودة المراسلة يحتاج نصًا" });
      const result = await createCommunicationDraftCommand({ userId: input.userId, workFileId: proposal.workFileId, channel, subject: title, body: content, toText, idempotencyKey });
      targetId = Number(result.id);
    } else {
      const [existing] = await db.select({ id: comoNextWorkMemory.id }).from(comoNextWorkMemory)
        .where(and(eq(comoNextWorkMemory.sourceSystem, "como_next_intake"), eq(comoNextWorkMemory.sourceRecordId, idempotencyKey))).limit(1);
      if (existing) targetId = Number(existing.id);
      else {
        const result = await db.insert(comoNextWorkMemory).values({
          projectId: proposal.projectId,
          workFileId: proposal.workFileId,
          memoryType: "note",
          entryType: "reviewed_intake_note",
          title,
          body: `${content || ""}\n\nالدليل: ${proposal.evidenceExcerpt}`.trim(),
          sourceStatus: "reviewed",
          sourceSystem: "como_next_intake",
          sourceRecordId: idempotencyKey,
          occurredAt: nowSql(),
        });
        targetId = Number(result[0].insertId);
      }
    }
  }

  return db.transaction(async tx => {
    await tx.update(comoNextIntakeProposals).set({
      reviewStatus: input.decision === "apply" ? "applied" : "dismissed",
      targetId,
      reviewNote: clean(input.reviewNote, 5_000) || null,
      reviewedByUserId: input.userId,
      reviewedAt: nowSql(),
      title,
      content: content || null,
      acceptanceCriteria: acceptanceCriteria || null,
      ownerType,
      priority,
      dueAt: dueAt ? toSqlUtcTimestamp(String(dueAt)) : null,
      channel,
      toText,
    }).where(eq(comoNextIntakeProposals.id, proposal.id));
    await appendEvent(tx, {
      userId: input.userId,
      projectId: proposal.projectId,
      workFileId: proposal.workFileId,
      eventType: input.decision === "apply" ? "intake_proposal_applied" : "intake_proposal_dismissed",
      summary: `${input.decision === "apply" ? "اعتماد وتحويل" : "استبعاد"} المقترح: ${title}`,
      payload: { proposalId: Number(proposal.id), proposalKind: proposal.proposalKind, targetId, externalSideEffect: false },
      idempotencyKey: `event:intake-review:${proposal.id}`,
    });
    return { targetId, replayed: false as const, externalSideEffect: false as const };
  });
}
