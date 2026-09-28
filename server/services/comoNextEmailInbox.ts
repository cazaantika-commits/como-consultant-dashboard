import { createHash, randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, or, sql } from "drizzle-orm";
import {
  comoNextActions,
  comoNextCommunications,
  comoNextDocuments,
  comoNextEmailAnalyses,
  comoNextEmailAttachments,
  comoNextEmailMessages,
  comoNextIntakeProposals,
  comoNextProjectParties,
  comoNextWorkFiles,
  comoNextWorkMemory,
  comoNextWorkMemoryDocuments,
} from "../../drizzle/schema";
import { invokeLLM } from "../_core/llm";
import { getDb } from "../db";
import {
  fetchEmailByUID,
  fetchReadonlyInboxSince,
  fetchReadonlySentSince,
  getConfiguredMailboxAddress,
  type EmailMessage,
  type ReadonlyMailboxBatch,
} from "../emailMonitor";
import { storagePut } from "../storage";
import { appendEvent, createCommunicationDraftCommand, requireProjectAccess } from "./comoNextCommands";
import { createIntakeProposalsCommand, type IntakeProposalDraft } from "./comoNextIntake";
import { reconcileWorkFileEvidenceCommand } from "./comoNextActionReconciliation";

const EMAIL_ANALYSIS_MODEL = "gpt-5-mini";
const rowsOf = <T>(result: unknown): T[] => Array.isArray(result) && Array.isArray(result[0]) ? result[0] as T[] : result as T[];
const nowSql = () => new Date().toISOString().slice(0, 19).replace("T", " ");
const toSqlTimestamp = (date: Date) => date.toISOString().slice(0, 19).replace("T", " ");
const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const normalizeEmail = (value?: string | null) => String(value || "").trim().toLowerCase();
const extractEmails = (value?: string | null) => (String(value || "").toLowerCase().match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/g) || []).map(normalizeEmail);
const normalizeText = (value?: string | null) => String(value || "").normalize("NFKD").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const parseStoredUtc = (value: string) => new Date(/Z$|[+-]\d{2}:?\d{2}$/.test(value) ? value : `${value.replace(" ", "T")}Z`);
const genericWorkTokens = new Set(["design", "project", "review", "analysis", "offer", "proposal", "consultant", "architectural", "meeting", "scope", "work"]);

export function scoreEmailSuggestionCandidate(row: any, message: Pick<EmailMessage, "from" | "to" | "cc" | "subject" | "textBody">) {
  const haystack = normalizeText(`${message.subject}\n${message.textBody.slice(0, 20_000)}`);
  const participantEmails = new Set([normalizeEmail(message.from), ...extractEmails(message.to), ...extractEmails(message.cc)].filter(Boolean));
  let score = 0;
  const reasons: string[] = [];
  const contactEmail = normalizeEmail(row.contactEmail);
  if (contactEmail && participantEmails.has(contactEmail)) {
    score += 100;
    reasons.push(`عنوان ${row.partyName || "الطرف المسجل"} ظاهر في المرسل أو المستلمين`);
  }
  const projectTokens = meaningfulTokens(`${row.projectName || ""} ${row.plotNumber || ""}`);
  const projectMatches = projectTokens.filter(token => haystack.includes(token)).length;
  if (projectMatches) {
    score += Math.min(40, projectMatches * 12);
    reasons.push("اسم المشروع أو رقم القطعة ظاهر في الرسالة");
  }
  const workTokens = meaningfulTokens(row.workFileTitle);
  const matchedWorkTokens = workTokens.filter(token => haystack.includes(token));
  if (matchedWorkTokens.length) {
    score += Math.min(24, matchedWorkTokens.length * 6);
    reasons.push("موضوع الرسالة يطابق ملف العمل");
  }
  const partyPhrase = normalizeText(row.partyName);
  if (partyPhrase && partyPhrase.length >= 4 && haystack.includes(partyPhrase)) {
    score += Number(row.partyLinkedToFile) === 1 ? 55 : 10;
    reasons.push(`اسم الطرف ${row.partyName} ظاهر في نص الرسالة`);
  }
  const distinctiveFileMatch = matchedWorkTokens.find(token => /^[a-z0-9]+$/.test(token) && token.length >= 5 && !genericWorkTokens.has(token));
  if (distinctiveFileMatch) {
    score += 40;
    reasons.push(`معرّف مميز لملف العمل ظاهر: ${distinctiveFileMatch}`);
  }
  if (Number(row.partyLinkedToFile) === 1 && contactEmail && participantEmails.has(contactEmail)) {
    score += 30;
    reasons.push("الطرف مرتبط بملف العمل نفسه");
  }
  return { score, reasons };
}
const meaningfulTokens = (value?: string | null) => normalizeText(value).split(/\s+/).filter(token => token.length >= 4);

function databaseUnavailable(): never {
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "قاعدة البيانات غير متاحة" });
}

export function mailboxKeyFor(address: string) {
  return sha256(normalizeEmail(address));
}

export function messageIdentitySha(message: Pick<EmailMessage, "messageId" | "uid" | "date" | "from" | "subject">, uidValidity: string) {
  const identity = message.messageId.trim() || `${uidValidity}:${message.uid}:${message.date.toISOString()}:${normalizeEmail(message.from)}:${message.subject}`;
  return sha256(identity);
}

export function assertReadonlyEmailArchitecture(source: string) {
  const forbidden = [/sendMail\s*\(/i, /sendReply\s*\(/i, /markAsSeen\s*\(/i, /addFlags\s*\(/i, /append\s*\(/i, /createTransport\s*\(/i];
  if (forbidden.some(pattern => pattern.test(source))) {
    throw new Error("Read-only inbox implementation contains a prohibited mailbox side effect");
  }
}

async function buildSuggestion(db: any, userId: number, message: EmailMessage) {
  const candidatesResult = await db.execute(sql`
    SELECT p.id AS projectId, p.name AS projectName, p.plotNumber AS plotNumber,
      wf.id AS workFileId, wf.title AS workFileTitle,
      pp.id AS projectPartyId, party.display_name AS partyName,
      contact.email AS contactEmail,
      CASE WHEN wfp.id IS NULL THEN 0 ELSE 1 END AS partyLinkedToFile
    FROM projects p
    LEFT JOIN como_next_project_access access_row ON access_row.project_id = p.id AND access_row.user_id = ${userId}
    LEFT JOIN como_next_work_files wf ON wf.project_id = p.id AND wf.work_file_status NOT IN ('closed','cancelled')
    LEFT JOIN como_next_project_parties pp ON pp.project_id = p.id AND pp.relationship_status = 'active'
    LEFT JOIN como_next_parties party ON party.id = pp.party_id
    LEFT JOIN como_next_party_contacts contact ON contact.party_id = party.id
    LEFT JOIN como_next_work_file_parties wfp ON wfp.work_file_id = wf.id AND wfp.project_party_id = pp.id
    WHERE p.is_test_project = 0 AND (p.userId = ${userId} OR access_row.user_id = ${userId})
  `);
  const scored = rowsOf<any>(candidatesResult).map(row => {
    const { score, reasons } = scoreEmailSuggestionCandidate(row, message);
    return { ...row, score, reasons };
  }).filter(row => row.score > 0).sort((a, b) => b.score - a.score);
  const best = scored[0];
  const tied = best && scored.some((row, index) => index > 0 && row.score === best.score && (row.workFileId !== best.workFileId || row.projectId !== best.projectId));
  if (!best || tied || best.score < 24) return null;
  return {
    projectId: Number(best.projectId),
    workFileId: best.workFileId == null ? null : Number(best.workFileId),
    projectPartyId: best.projectPartyId == null ? null : Number(best.projectPartyId),
    confidenceScore: Number(best.score),
    reason: [...new Set(best.reasons)].join("؛ "),
  };
}

export async function reclassifyUnlinkedEmailSuggestionsCommand(input: { userId: number; emailIds?: number[]; limit?: number }) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const allowedIds = input.emailIds?.length ? new Set(input.emailIds) : null;
  const rows = await db.select().from(comoNextEmailMessages).where(and(
    eq(comoNextEmailMessages.userId, input.userId),
    or(eq(comoNextEmailMessages.inboxStatus, "unmatched"), eq(comoNextEmailMessages.inboxStatus, "suggested")),
  )).orderBy(desc(comoNextEmailMessages.receivedAt), desc(comoNextEmailMessages.id)).limit(Math.max(1, Math.min(input.limit || 250, 250)));
  let updated = 0;
  for (const email of rows) {
    if (allowedIds && !allowedIds.has(Number(email.id))) continue;
    const suggestion = await buildSuggestion(db, input.userId, {
      uid: email.imapUid,
      messageId: email.messageIdRaw || "",
      from: email.fromEmail,
      fromName: email.fromName || "",
      to: email.toText || "",
      cc: email.ccText || "",
      subject: email.subject,
      date: parseStoredUtc(email.receivedAt),
      textBody: email.bodyText,
      htmlBody: "",
      attachments: [],
      isRead: email.wasSeen === 1,
    });
    if (!suggestion) continue;
    await db.update(comoNextEmailMessages).set({
      inboxStatus: "suggested",
      suggestedProjectId: suggestion.projectId,
      suggestedWorkFileId: suggestion.workFileId,
      suggestedProjectPartyId: suggestion.projectPartyId,
      suggestionReason: suggestion.reason,
    }).where(and(eq(comoNextEmailMessages.id, email.id), eq(comoNextEmailMessages.userId, input.userId)));
    updated += 1;
  }
  return { updated, operationalRecordsCreated: 0, externalSideEffect: false as const };
}

export async function importReadonlyBatch(userId: number, batch: ReadonlyMailboxBatch) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const mailboxKey = mailboxKeyFor(batch.mailbox);
  const folderName = batch.folderName || "INBOX";
  let imported = 0;
  let duplicates = 0;
  let suggested = 0;
  let unmatched = 0;
  let autoLinked = 0;
  const importedIds: number[] = [];

  for (const message of batch.messages) {
    const identitySha = messageIdentitySha(message, batch.uidValidity);
    const existing = await db.select({ id: comoNextEmailMessages.id }).from(comoNextEmailMessages).where(or(
      and(eq(comoNextEmailMessages.mailboxKey, mailboxKey), eq(comoNextEmailMessages.folderName, folderName), eq(comoNextEmailMessages.uidValidity, batch.uidValidity), eq(comoNextEmailMessages.imapUid, message.uid)),
      and(eq(comoNextEmailMessages.mailboxKey, mailboxKey), eq(comoNextEmailMessages.messageIdSha256, identitySha)),
    )).limit(1);
    if (existing.length) { duplicates += 1; continue; }

    const suggestion = await buildSuggestion(db, userId, message);
    const body = message.textBody.trim().slice(0, 1_000_000);
    const result = await db.insert(comoNextEmailMessages).values({
      userId,
      mailboxKey,
      folderName,
      uidValidity: batch.uidValidity,
      imapUid: message.uid,
      messageId: message.messageId.trim() || null,
      messageIdSha256: identitySha,
      fromEmail: normalizeEmail(message.from),
      fromName: message.fromName.trim().slice(0, 500) || null,
      toText: message.to.trim() || null,
      ccText: message.cc.trim() || null,
      subject: message.subject.trim().slice(0, 1000) || "(بدون عنوان)",
      bodyText: body,
      bodySha256: sha256(body),
      receivedAt: toSqlTimestamp(message.date),
      serverSeen: message.isRead ? 1 : 0,
      attachmentCount: message.attachments.length,
      inboxStatus: suggestion ? "suggested" : "unmatched",
      suggestedProjectId: suggestion?.projectId ?? null,
      suggestedWorkFileId: suggestion?.workFileId ?? null,
      suggestedProjectPartyId: suggestion?.projectPartyId ?? null,
      suggestionReason: suggestion?.reason ?? null,
    });
    const emailId = Number(result[0].insertId);
    importedIds.push(emailId);
    if (message.attachments.length) {
      await db.insert(comoNextEmailAttachments).values(message.attachments.map((attachment, index) => ({
        emailMessageId: emailId,
        ordinal: index,
        fileName: attachment.filename.slice(0, 1000),
        mimeType: attachment.contentType.slice(0, 255),
        byteSize: attachment.size,
        contentId: attachment.contentId?.slice(0, 500) || null,
        disposition: attachment.disposition?.slice(0, 80) || null,
      })));
    }
    if (suggestion?.workFileId && suggestion.confidenceScore >= 130) {
      try {
        await linkEmailToWorkFileCommand({
          userId,
          emailId,
          projectId: suggestion.projectId,
          workFileId: suggestion.workFileId,
          projectPartyId: suggestion.projectPartyId,
        });
        autoLinked += 1;
      } catch {
        // Keep the message as a reviewable suggestion when protected linking
        // or attachment storage cannot complete safely.
      }
    }
    imported += 1;
    if (suggestion) suggested += 1; else unmatched += 1;
  }
  return { imported, duplicates, suggested, unmatched, autoLinked, importedIds, readOnly: true as const, serverFlagsChanged: false as const, externalSideEffects: false as const };
}

export async function syncReadonlyInboxCommand(input: { userId: number; hours: number; maxMessages: number }) {
  const [inboxBatch, sentBatch] = await Promise.all([
    fetchReadonlyInboxSince(input.hours, input.maxMessages),
    fetchReadonlySentSince(input.hours, input.maxMessages),
  ]);
  const inbox = await importReadonlyBatch(input.userId, inboxBatch);
  const sent = await importReadonlyBatch(input.userId, sentBatch);
  return {
    imported: inbox.imported + sent.imported,
    duplicates: inbox.duplicates + sent.duplicates,
    suggested: inbox.suggested + sent.suggested,
    unmatched: inbox.unmatched + sent.unmatched,
    autoLinked: inbox.autoLinked + sent.autoLinked,
    importedIds: [...inbox.importedIds, ...sent.importedIds],
    scanned: inboxBatch.messages.length + sentBatch.messages.length,
    uidValidity: { inbox: inboxBatch.uidValidity, sent: sentBatch.uidValidity },
    folders: { inbox, sent },
    readOnly: true as const,
    serverFlagsChanged: false as const,
    externalSideEffects: false as const,
  };
}

export async function syncAndAnalyzeReadonlyMailboxCommand(input: { userId: number; hours: number; maxMessages: number; analysisLimit?: number }) {
  const result = await syncReadonlyInboxCommand(input);
  const db = await getDb();
  if (!db) databaseUnavailable();
  const pendingResult = await db.execute(sql`
    SELECT email_row.id
    FROM como_next_email_messages email_row
    WHERE email_row.user_id = ${input.userId}
      AND email_row.inbox_status <> 'dismissed'
      AND NOT EXISTS (
        SELECT 1 FROM como_next_email_analyses analysis_row
        WHERE analysis_row.email_message_id = email_row.id
          AND analysis_row.analysis_status = 'draft'
      )
    ORDER BY email_row.received_at DESC, email_row.id DESC
    LIMIT ${Math.max(1, Math.min(input.analysisLimit || 10, 20))}
  `);
  const candidateIds = [...new Set([
    ...result.importedIds,
    ...rowsOf<any>(pendingResult).map(row => Number(row.id)),
  ])].slice(0, Math.max(1, Math.min(input.analysisLimit || 10, 20)));
  let analyzed = 0;
  let analysisFailures = 0;
  for (let offset = 0; offset < candidateIds.length; offset += 3) {
    const batch = candidateIds.slice(offset, offset + 3);
    const outcomes = await Promise.allSettled(batch.map(emailId => analyzeEmailCommand({ userId: input.userId, emailId, requestKey: `mailbox-context-v1:${emailId}` })));
    for (let index = 0; index < outcomes.length; index += 1) {
      if (outcomes[index].status === "fulfilled") analyzed += 1;
      else {
        analysisFailures += 1;
        console.error(`[COMO email sync] Failed to analyze email ${batch[index]}:`, outcomes[index]);
      }
    }
  }
  return { ...result, analyzed, analysisFailures };
}

export async function listEmailInbox(userId: number, status?: "unmatched" | "suggested" | "linked" | "dismissed") {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const statusFilter = status ? sql`AND email_row.inbox_status = ${status}` : sql``;
  const result = await db.execute(sql`
    SELECT email_row.id, email_row.folder_name AS folderName, email_row.from_email AS fromEmail, email_row.from_name AS fromName,
      email_row.subject, LEFT(email_row.body_text, 500) AS bodyPreview,
      email_row.received_at AS receivedAt, email_row.server_seen AS serverSeen,
      email_row.attachment_count AS attachmentCount, email_row.inbox_status AS inboxStatus,
      email_row.importance, email_row.suggestion_reason AS suggestionReason,
      email_row.suggested_project_id AS suggestedProjectId,
      suggested_project.name AS suggestedProjectName,
      email_row.suggested_work_file_id AS suggestedWorkFileId,
      suggested_file.title AS suggestedWorkFileTitle,
      suggested_party.display_name AS suggestedPartyName,
      email_row.linked_project_id AS linkedProjectId,
      linked_project.name AS linkedProjectName,
      email_row.linked_work_file_id AS linkedWorkFileId,
      linked_file.title AS linkedWorkFileTitle,
      email_row.communication_id AS communicationId,
      email_row.reply_draft_communication_id AS replyDraftCommunicationId
    FROM como_next_email_messages email_row
    LEFT JOIN projects suggested_project ON suggested_project.id = email_row.suggested_project_id
    LEFT JOIN como_next_work_files suggested_file ON suggested_file.id = email_row.suggested_work_file_id
    LEFT JOIN como_next_project_parties suggested_pp ON suggested_pp.id = email_row.suggested_project_party_id
    LEFT JOIN como_next_parties suggested_party ON suggested_party.id = suggested_pp.party_id
    LEFT JOIN projects linked_project ON linked_project.id = email_row.linked_project_id
    LEFT JOIN como_next_work_files linked_file ON linked_file.id = email_row.linked_work_file_id
    WHERE email_row.user_id = ${userId} ${statusFilter}
    ORDER BY CASE email_row.importance WHEN 'urgent' THEN 0 WHEN 'important' THEN 1 WHEN 'unreviewed' THEN 2 ELSE 3 END,
      email_row.received_at DESC, email_row.id DESC
    LIMIT 150
  `);
  return rowsOf<any>(result).map(row => ({
    ...row,
    id: Number(row.id),
    serverSeen: Number(row.serverSeen) === 1,
    attachmentCount: Number(row.attachmentCount || 0),
    suggestedProjectId: row.suggestedProjectId == null ? null : Number(row.suggestedProjectId),
    suggestedWorkFileId: row.suggestedWorkFileId == null ? null : Number(row.suggestedWorkFileId),
    linkedProjectId: row.linkedProjectId == null ? null : Number(row.linkedProjectId),
    linkedWorkFileId: row.linkedWorkFileId == null ? null : Number(row.linkedWorkFileId),
    communicationId: row.communicationId == null ? null : Number(row.communicationId),
    replyDraftCommunicationId: row.replyDraftCommunicationId == null ? null : Number(row.replyDraftCommunicationId),
  }));
}

export async function getEmailMessage(emailId: number, userId: number) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const [message] = await db.select().from(comoNextEmailMessages).where(and(eq(comoNextEmailMessages.id, emailId), eq(comoNextEmailMessages.userId, userId))).limit(1);
  if (!message) throw new TRPCError({ code: "NOT_FOUND", message: "لم يُعثر على الرسالة" });
  if (message.linkedProjectId) await requireProjectAccess(db, message.linkedProjectId, userId, "read");
  const attachments = await db.select().from(comoNextEmailAttachments).where(eq(comoNextEmailAttachments.emailMessageId, emailId)).orderBy(comoNextEmailAttachments.ordinal);
  const analyses = await db.select().from(comoNextEmailAnalyses).where(eq(comoNextEmailAnalyses.emailMessageId, emailId)).orderBy(desc(comoNextEmailAnalyses.id));
  const proposals = await db.select().from(comoNextIntakeProposals).where(eq(comoNextIntakeProposals.sourceEmailId, emailId)).orderBy(desc(comoNextIntakeProposals.id));
  return {
    message,
    attachments: attachments.map(item => ({ ...item, downloadPath: item.documentId ? `/api/como-next/documents/${item.documentId}` : null })),
    analysis: analyses.find(item => item.analysisStatus === "draft") || null,
    proposals,
  };
}

export async function listEmailLinkingOptions(userId: number) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const result = await db.execute(sql`
    SELECT p.id AS projectId, p.name AS projectName, wf.id AS workFileId, wf.title AS workFileTitle,
      pp.id AS projectPartyId, party.display_name AS partyName
    FROM projects p
    LEFT JOIN como_next_project_access access_row ON access_row.project_id = p.id AND access_row.user_id = ${userId}
    JOIN como_next_work_files wf ON wf.project_id = p.id AND wf.work_file_status NOT IN ('closed','cancelled')
    LEFT JOIN como_next_project_parties pp ON pp.project_id = p.id AND pp.relationship_status = 'active'
    LEFT JOIN como_next_parties party ON party.id = pp.party_id
    WHERE p.is_test_project = 0 AND (p.userId = ${userId} OR access_row.user_id = ${userId})
    ORDER BY p.name, wf.title, party.display_name
  `);
  return rowsOf<any>(result).map(row => ({
    projectId: Number(row.projectId), projectName: row.projectName,
    workFileId: Number(row.workFileId), workFileTitle: row.workFileTitle,
    projectPartyId: row.projectPartyId == null ? null : Number(row.projectPartyId), partyName: row.partyName || null,
  }));
}

async function storeEmailAttachments(email: typeof comoNextEmailMessages.$inferSelect) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  if (!email.attachmentCount) return [] as Array<{ ordinal: number; documentId: number; sha256: string }>;
  const full = await fetchEmailByUID(email.imapUid, email.uidValidity, email.folderName);
  if (!full) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "تعذر استعادة الرسالة من صندوق البريد" });
  if (messageIdentitySha(full, email.uidValidity) !== email.messageIdSha256 || sha256(full.textBody.trim().slice(0, 1_000_000)) !== email.bodySha256) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "هوية الرسالة أو محتواها لم تعد مطابقة؛ أعد المزامنة قبل الربط" });
  }
  const stored: Array<{ ordinal: number; documentId: number; sha256: string }> = [];
  for (const [ordinal, attachment] of full.attachments.entries()) {
    if (!attachment.content) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `تعذر قراءة المرفق ${attachment.filename}` });
    const digest = sha256(attachment.content);
    const [existing] = await db.select({ id: comoNextDocuments.id }).from(comoNextDocuments).where(eq(comoNextDocuments.sha256, digest)).limit(1);
    let documentId: number;
    if (existing) documentId = Number(existing.id);
    else {
      const safeName = attachment.filename.replace(/[^\p{L}\p{N}._ -]+/gu, "_").slice(0, 240) || "attachment";
      const storageKey = `como-next-private/email/${randomUUID()}/${safeName}`;
      const storedObject = await storagePut(storageKey, attachment.content, attachment.contentType);
      const result = await db.insert(comoNextDocuments).values({
        title: attachment.filename,
        fileName: attachment.filename,
        mimeType: attachment.contentType,
        byteSize: attachment.content.byteLength,
        sha256: digest,
        storageKey: storedObject.key,
        storageUrl: storedObject.url,
        sourceSystem: "imap",
        sourceKey: `email:${email.id}:attachment:${ordinal}`,
      });
      documentId = Number(result[0].insertId);
    }
    stored.push({ ordinal, documentId, sha256: digest });
  }
  return stored;
}

export async function linkEmailToWorkFileCommand(input: { userId: number; emailId: number; projectId: number; workFileId: number; projectPartyId?: number | null }) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const [email] = await db.select().from(comoNextEmailMessages).where(and(eq(comoNextEmailMessages.id, input.emailId), eq(comoNextEmailMessages.userId, input.userId))).limit(1);
  if (!email) throw new TRPCError({ code: "NOT_FOUND", message: "لم يُعثر على الرسالة" });
  if (email.inboxStatus === "linked" && email.communicationId) {
    const reconciliation = email.folderName === "INBOX"
      ? await reconcileWorkFileEvidenceCommand({ userId: input.userId, workFileId: input.workFileId, triggerEmailId: input.emailId }).catch(error => ({ error: error instanceof Error ? error.message : String(error), changed: 0, nextActionId: null, externalSideEffect: false as const }))
      : null;
    return { communicationId: Number(email.communicationId), replayed: true as const, documents: 0, reconciliation };
  }
  const [workFile] = await db.select().from(comoNextWorkFiles).where(and(eq(comoNextWorkFiles.id, input.workFileId), eq(comoNextWorkFiles.projectId, input.projectId))).limit(1);
  if (!workFile) throw new TRPCError({ code: "NOT_FOUND", message: "ملف العمل لا يتبع المشروع المختار" });
  await requireProjectAccess(db, input.projectId, input.userId, "write");
  if (["closed", "cancelled"].includes(workFile.workFileStatus)) throw new TRPCError({ code: "BAD_REQUEST", message: "لا يمكن ربط بريد بملف عمل مغلق" });
  if (input.projectPartyId) {
    const [party] = await db.select({ id: comoNextProjectParties.id }).from(comoNextProjectParties).where(and(eq(comoNextProjectParties.id, input.projectPartyId), eq(comoNextProjectParties.projectId, input.projectId))).limit(1);
    if (!party) throw new TRPCError({ code: "NOT_FOUND", message: "الطرف لا يتبع المشروع المختار" });
  }
  const storedDocuments = await storeEmailAttachments(email);
  const isSent = email.folderName !== "INBOX";
  const sourceRecordId = `imap:${email.mailboxKey.slice(0, 24)}:${email.folderName}:${email.uidValidity}:${email.imapUid}`;
  const linked = await db.transaction(async tx => {
    const [existingCommunication] = await tx.select({ id: comoNextCommunications.id }).from(comoNextCommunications).where(and(eq(comoNextCommunications.sourceSystem, "imap"), eq(comoNextCommunications.sourceRecordId, sourceRecordId))).limit(1);
    if (existingCommunication) {
      await tx.update(comoNextEmailMessages).set({ inboxStatus: "linked", linkedProjectId: input.projectId, linkedWorkFileId: input.workFileId, linkedProjectPartyId: input.projectPartyId || null, communicationId: existingCommunication.id, linkedAt: nowSql() }).where(eq(comoNextEmailMessages.id, input.emailId));
      return { communicationId: Number(existingCommunication.id), replayed: true as const, documents: storedDocuments.length };
    }
    const communicationResult = await tx.insert(comoNextCommunications).values({
      userId: input.userId,
      projectId: input.projectId,
      workFileId: input.workFileId,
      projectPartyId: input.projectPartyId || null,
      channel: "email",
      direction: isSent ? "outbound" : "inbound",
      communicationStatus: isSent ? "sent" : "received",
      approvalStatus: "not_required",
      subject: email.subject,
      body: email.bodyText || "(لا يوجد نص مستخرج)",
      fromText: email.fromName ? `${email.fromName} <${email.fromEmail}>` : email.fromEmail,
      toText: email.toText,
      ccText: email.ccText,
      externalMessageRef: email.messageId || `IMAP UID ${email.imapUid}`,
      evidenceReference: `IMAP ${email.folderName}; UIDVALIDITY=${email.uidValidity}; UID=${email.imapUid}; SHA-256=${email.bodySha256}`,
      occurredAt: email.receivedAt,
      sentAt: isSent ? email.receivedAt : null,
      sourceSystem: "imap",
      sourceRecordId,
    });
    const communicationId = Number(communicationResult[0].insertId);
    const memoryResult = await tx.insert(comoNextWorkMemory).values({
      projectId: input.projectId,
      workFileId: input.workFileId,
      memoryType: "material",
      entryType: "email_message",
      title: `${isSent ? "بريد صادر" : "بريد وارد"}: ${email.subject}`,
      body: `${isSent ? "إلى" : "من"}: ${isSent ? email.toText || "غير محدد" : email.fromName || email.fromEmail}\n${email.bodyText}`.slice(0, 1_000_000),
      sourceStatus: isSent ? "sent_readonly" : "received_readonly",
      isCurrent: 1,
      sourceSystem: "imap",
      sourceRecordId,
      occurredAt: email.receivedAt,
    });
    const memoryId = Number(memoryResult[0].insertId);
    for (const item of storedDocuments) {
      await tx.insert(comoNextWorkMemoryDocuments).values({
        projectId: input.projectId,
        workFileId: input.workFileId,
        memoryId,
        documentId: item.documentId,
        relationType: "attachment",
        sourceSystem: "imap",
        sourceRecordId: `${sourceRecordId}:attachment:${item.ordinal}`,
      }).onDuplicateKeyUpdate({ set: { relationType: "attachment" } });
      await tx.update(comoNextEmailAttachments).set({ storageStatus: "stored", documentId: item.documentId, sha256: item.sha256, storageError: null }).where(and(eq(comoNextEmailAttachments.emailMessageId, input.emailId), eq(comoNextEmailAttachments.ordinal, item.ordinal)));
    }
    await tx.update(comoNextEmailMessages).set({
      inboxStatus: "linked", linkedProjectId: input.projectId, linkedWorkFileId: input.workFileId,
      linkedProjectPartyId: input.projectPartyId || null, communicationId, linkedAt: nowSql(), importance: email.importance === "unreviewed" ? "normal" : email.importance,
    }).where(eq(comoNextEmailMessages.id, input.emailId));
    await appendEvent(tx, {
      userId: input.userId, projectId: input.projectId, workFileId: input.workFileId,
      eventType: isSent ? "email_sent_linked" : "email_received_linked", summary: `ربط بريد ${isSent ? "صادر" : "وارد"}: ${email.subject}`,
      payload: { emailId: input.emailId, communicationId, attachmentCount: storedDocuments.length, serverFlagsChanged: false, externalSideEffect: false },
      idempotencyKey: `event:${sourceRecordId}`,
    });
    return { communicationId, replayed: false as const, documents: storedDocuments.length };
  });
  const reconciliation = isSent
    ? null
    : await reconcileWorkFileEvidenceCommand({ userId: input.userId, workFileId: input.workFileId, triggerEmailId: input.emailId }).catch(error => ({ error: error instanceof Error ? error.message : String(error), changed: 0, nextActionId: null, externalSideEffect: false as const }));
  return { ...linked, reconciliation };
}

const emailAnalysisSchema = {
  type: "object",
  properties: {
    summaryAr: { type: "string" },
    importance: { type: "string", enum: ["normal", "important", "urgent"] },
    whyImportant: { anyOf: [{ type: "string" }, { type: "null" }] },
    suggestedNextStep: { anyOf: [{ type: "string" }, { type: "null" }] },
    shouldReply: { type: "boolean" },
    replyDraftText: { anyOf: [{ type: "string" }, { type: "null" }] },
    evidenceExcerpts: { type: "array", items: { type: "string" } },
    proposals: {
      type: "array",
      items: {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["action", "decision", "communication_draft", "note"] },
          title: { type: "string" },
          content: { anyOf: [{ type: "string" }, { type: "null" }] },
          acceptanceCriteria: { anyOf: [{ type: "string" }, { type: "null" }] },
          ownerType: { anyOf: [{ type: "string", enum: ["human", "manus", "team"] }, { type: "null" }] },
          priority: { type: "string", enum: ["normal", "important", "urgent"] },
          dueAt: { anyOf: [{ type: "string" }, { type: "null" }] },
          channel: { anyOf: [{ type: "string", enum: ["email", "whatsapp", "letter", "phone_note", "internal"] }, { type: "null" }] },
          toText: { anyOf: [{ type: "string" }, { type: "null" }] },
          evidenceExcerpt: { type: "string" },
        },
        required: ["kind", "title", "content", "acceptanceCriteria", "ownerType", "priority", "dueAt", "channel", "toText", "evidenceExcerpt"],
        additionalProperties: false,
      },
    },
  },
  required: ["summaryAr", "importance", "whyImportant", "suggestedNextStep", "shouldReply", "replyDraftText", "evidenceExcerpts", "proposals"],
  additionalProperties: false,
} as const;

type EmailAnalysisContext = {
  workFile: { id: number; title: string; status: string; governingQuestion: string; desiredOutcome: string };
  mailboxMessages: Array<{ direction: string; folderName: string; subject: string; excerpt: string; receivedAt: string; inboxStatus: string }>;
  communications: Array<{ direction: string; status: string; subject: string; excerpt: string; occurredAt: string | null; evidenceReference: string | null }>;
  actions: Array<{ title: string; status: string; description: string | null; evidenceReference: string | null; updatedAt: string | null }>;
};

export function buildEmailAnalysisPrompt(email: {
  folderName: string;
  fromName?: string | null;
  fromEmail: string;
  toText?: string | null;
  ccText?: string | null;
  subject: string;
  receivedAt: string;
  bodyText: string;
}, context: EmailAnalysisContext | null) {
  const isSent = email.folderName !== "INBOX";
  const contextText = context ? `

سياق ملف الموضوع الحالي — قد يتضمن وقائع أحدث من الرسالة، والأحدث زمنيًا ينسخ الحالة الأقدم:
الملف: ${context.workFile.title} (#${context.workFile.id})
حالته: ${context.workFile.status}
السؤال الحاكم: ${context.workFile.governingQuestion}
النتيجة المطلوبة: ${context.workFile.desiredOutcome}

أحدث المراسلات المرتبطة:
${context.communications.map(item => `- [${item.occurredAt || "دون تاريخ"}] ${item.direction}/${item.status}: ${item.subject} — ${item.excerpt}${item.evidenceReference ? ` — الدليل: ${item.evidenceReference}` : ""}`).join("\n") || "- لا توجد"}

أحدث رسائل الصندوق المرتبطة أو المرشحة لهذا الملف — المرشح ليس ربطًا معتمدًا لكنه دليل يجب أخذه في السياق:
${context.mailboxMessages.map(item => `- [${item.receivedAt}] ${item.direction}/${item.folderName}/${item.inboxStatus}: ${item.subject} — ${item.excerpt}`).join("\n") || "- لا توجد"}

أحدث الإجراءات المرتبطة:
${context.actions.map(item => `- ${item.status}: ${item.title}${item.description ? ` — ${item.description}` : ""}${item.evidenceReference ? ` — الدليل: ${item.evidenceReference}` : ""}`).join("\n") || "- لا توجد"}` : "";

  return `حلل الرسالة التالية ضمن تسلسل ملف الموضوع، لا كنص منفصل.
اتجاه الرسالة: ${isSent ? "صادرة من عبد الرحمن" : "واردة إلى عبد الرحمن"}
المجلد: ${email.folderName}
من: ${email.fromName || ""} <${email.fromEmail}>
إلى: ${email.toText || "غير محدد"}
نسخة: ${email.ccText || "لا يوجد"}
الموضوع: ${email.subject}
التاريخ: ${email.receivedAt}

${email.bodyText}${contextText}

قواعد الحسم:
- افصل بين ما طلبته الرسالة وقت وصولها وبين الحقيقة الحالية للملف.
- لا تقترح قرارًا أو إجراءً أثبتت مراسلة أو واقعة لاحقة أنه نُفذ أو استُبدل.
- إذا ثبت إرسال اعتماد صرف، فلا تقل إن الاعتماد ما زال معلقًا؛ ميّز بين «اعتماد الصرف وإرساله» و«تنفيذ الدفع وتأكيده».
- لا تعتبر الدفع منفذًا بلا تأكيد صريح من وائل أو المالية أو دليل دفع.
- لا تكرر إجراءً نشطًا قائمًا ولا تقترح ربط رسالة مرتبطة أصلًا.
- الرسالة الصادرة توثق ما فعله عبد الرحمن؛ لا تكتب مسودة رد عليها.
- كل مقترح يبقى review-only ولا يغير أي حالة تشغيلية.`;
}

async function loadEmailAnalysisContext(db: any, email: typeof comoNextEmailMessages.$inferSelect): Promise<EmailAnalysisContext | null> {
  const workFileId = Number(email.linkedWorkFileId || email.suggestedWorkFileId || 0);
  if (!workFileId) return null;
  const [workFile] = await db.select().from(comoNextWorkFiles).where(eq(comoNextWorkFiles.id, workFileId)).limit(1);
  if (!workFile) return null;
  const communications = await db.select({
    direction: comoNextCommunications.direction,
    status: comoNextCommunications.communicationStatus,
    subject: comoNextCommunications.subject,
    body: comoNextCommunications.body,
    occurredAt: comoNextCommunications.occurredAt,
    evidenceReference: comoNextCommunications.evidenceReference,
  }).from(comoNextCommunications).where(eq(comoNextCommunications.workFileId, workFileId)).orderBy(desc(comoNextCommunications.occurredAt), desc(comoNextCommunications.id)).limit(12);
  const actions = await db.select({
    title: comoNextActions.title,
    status: comoNextActions.actionStatus,
    description: comoNextActions.description,
    evidenceReference: comoNextActions.evidenceReference,
    updatedAt: comoNextActions.updatedAt,
  }).from(comoNextActions).where(eq(comoNextActions.workFileId, workFileId)).orderBy(desc(comoNextActions.updatedAt), desc(comoNextActions.id)).limit(12);
  const mailboxMessages = await db.select({
    folderName: comoNextEmailMessages.folderName,
    subject: comoNextEmailMessages.subject,
    bodyText: comoNextEmailMessages.bodyText,
    receivedAt: comoNextEmailMessages.receivedAt,
    inboxStatus: comoNextEmailMessages.inboxStatus,
  }).from(comoNextEmailMessages).where(or(
    eq(comoNextEmailMessages.linkedWorkFileId, workFileId),
    eq(comoNextEmailMessages.suggestedWorkFileId, workFileId),
  )).orderBy(desc(comoNextEmailMessages.receivedAt), desc(comoNextEmailMessages.id)).limit(12);
  return {
    workFile: {
      id: Number(workFile.id),
      title: workFile.title,
      status: workFile.workFileStatus,
      governingQuestion: workFile.governingQuestion,
      desiredOutcome: workFile.desiredOutcome,
    },
    mailboxMessages: mailboxMessages.map(item => ({
      direction: item.folderName === "INBOX" ? "inbound" : "outbound",
      folderName: item.folderName,
      subject: item.subject,
      excerpt: String(item.bodyText || "").replace(/\s+/g, " ").slice(0, 700),
      receivedAt: item.receivedAt,
      inboxStatus: item.inboxStatus,
    })),
    communications: communications.map(item => ({
      direction: item.direction,
      status: item.status,
      subject: item.subject,
      excerpt: String(item.body || "").replace(/\s+/g, " ").slice(0, 700),
      occurredAt: item.occurredAt || null,
      evidenceReference: item.evidenceReference || null,
    })),
    actions: actions.map(item => ({ ...item, updatedAt: item.updatedAt || null })),
  };
}

export async function analyzeEmailCommand(input: { userId: number; emailId: number; requestKey: string }) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const [email] = await db.select().from(comoNextEmailMessages).where(and(eq(comoNextEmailMessages.id, input.emailId), eq(comoNextEmailMessages.userId, input.userId))).limit(1);
  if (!email) throw new TRPCError({ code: "NOT_FOUND", message: "لم يُعثر على الرسالة" });
  const [existing] = await db.select({ id: comoNextEmailAnalyses.id }).from(comoNextEmailAnalyses).where(eq(comoNextEmailAnalyses.requestKey, input.requestKey)).limit(1);
  if (existing) return { id: Number(existing.id), replayed: true as const };
  const context = await loadEmailAnalysisContext(db, email);
  const response = await invokeLLM({
    model: EMAIL_ANALYSIS_MODEL,
    messages: [
      { role: "system", content: "أنت Manus داخل مكتب عبد الرحمن التنفيذي. حلل الرسالة داخل تسلسل ملف الموضوع كاملًا، واعتبر الدليل الأحدث هو الحقيقة التشغيلية. لا تنشئ إجراءً أو قرارًا أو التزامًا تشغيليًا، ولا ترسل أو تعتمد أي رد. أخرج JSON مطابقًا للمخطط. المقترحات review-only ولا تُنشأ إذا كانت الخطوة قائمة أو منتهية أو نسختها واقعة أحدث." },
      { role: "user", content: buildEmailAnalysisPrompt(email, context) },
    ],
    response_format: { type: "json_schema", json_schema: { name: "como_email_analysis", strict: true, schema: emailAnalysisSchema as unknown as Record<string, unknown> } },
  });
  const content = response.choices[0]?.message.content;
  if (typeof content !== "string") throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "لم يُرجع Manus تحليلاً قابلاً للمراجعة" });
  let parsed: any;
  try { parsed = JSON.parse(content); } catch { throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر قراءة مسودة تحليل Manus" }); }
  const analysisResult = await db.transaction(async tx => {
    const [replay] = await tx.select({ id: comoNextEmailAnalyses.id }).from(comoNextEmailAnalyses).where(eq(comoNextEmailAnalyses.requestKey, input.requestKey)).limit(1);
    if (replay) return { id: Number(replay.id), replayed: true as const };
    await tx.update(comoNextEmailAnalyses).set({ analysisStatus: "superseded" }).where(and(eq(comoNextEmailAnalyses.emailMessageId, input.emailId), eq(comoNextEmailAnalyses.analysisStatus, "draft")));
    const result = await tx.insert(comoNextEmailAnalyses).values({
      emailMessageId: input.emailId,
      requestKey: input.requestKey,
      analysisStatus: "draft",
      summaryAr: String(parsed.summaryAr || "").trim() || "لا توجد خلاصة مدعومة بالنص.",
      importance: parsed.importance,
      whyImportant: parsed.whyImportant ? String(parsed.whyImportant).trim() : null,
      suggestedNextStep: parsed.suggestedNextStep ? String(parsed.suggestedNextStep).trim() : null,
      replyDraftText: parsed.shouldReply && parsed.replyDraftText ? String(parsed.replyDraftText).trim() : null,
      evidenceJson: JSON.stringify(Array.isArray(parsed.evidenceExcerpts) ? parsed.evidenceExcerpts : []),
      modelId: response.model || EMAIL_ANALYSIS_MODEL,
      requestedByUserId: input.userId,
    });
    const id = Number(result[0].insertId);
    await tx.update(comoNextEmailMessages).set({ importance: parsed.importance }).where(eq(comoNextEmailMessages.id, input.emailId));
    return { id, replayed: false as const, externalSideEffect: false as const, operationalRecordsCreated: 0 as const };
  });
  let proposalResult = { created: 0, duplicates: 0, ids: [] as number[] };
  if (email.linkedProjectId && email.linkedWorkFileId) {
    proposalResult = await createIntakeProposalsCommand({
      userId: input.userId,
      projectId: Number(email.linkedProjectId),
      workFileId: Number(email.linkedWorkFileId),
      sourceKind: "email",
      sourcePrefix: `email-analysis:${analysisResult.id}`,
      sourceEmailId: Number(email.id),
      sourceEmailAnalysisId: Number(analysisResult.id),
      proposals: (Array.isArray(parsed.proposals) ? parsed.proposals : []) as IntakeProposalDraft[],
    });
  }
  const reconciliation = email.folderName === "INBOX" && email.linkedWorkFileId
    ? await reconcileWorkFileEvidenceCommand({ userId: input.userId, workFileId: Number(email.linkedWorkFileId), triggerEmailId: Number(email.id) }).catch(error => ({ error: error instanceof Error ? error.message : String(error), changed: 0, nextActionId: null, externalSideEffect: false as const }))
    : null;
  return { ...analysisResult, proposalCount: proposalResult.ids.length, proposalsCreated: proposalResult.created, reconciliation };
}

export async function createReplyDraftFromEmailCommand(input: { userId: number; emailId: number; body: string; ccText?: string | null }) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const [email] = await db.select().from(comoNextEmailMessages).where(and(eq(comoNextEmailMessages.id, input.emailId), eq(comoNextEmailMessages.userId, input.userId))).limit(1);
  if (!email) throw new TRPCError({ code: "NOT_FOUND", message: "لم يُعثر على الرسالة" });
  if (!email.linkedWorkFileId || !email.linkedProjectId) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "اربط الرسالة بملف العمل قبل إنشاء مسودة الرد" });
  if (email.folderName !== "INBOX") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "الرسالة صادرة ولا تحتاج مسودة رد" });
  if (email.replyDraftCommunicationId) return { id: Number(email.replyDraftCommunicationId), replayed: true as const, sent: false as const };
  const draft = await createCommunicationDraftCommand({
    userId: input.userId,
    workFileId: email.linkedWorkFileId,
    channel: "email",
    subject: /^\s*re:/i.test(email.subject) ? email.subject : `Re: ${email.subject}`,
    body: input.body,
    toText: email.fromEmail,
    ccText: input.ccText,
    idempotencyKey: `email-reply-draft:${email.id}`,
  });
  await db.update(comoNextEmailMessages).set({ replyDraftCommunicationId: draft.id }).where(eq(comoNextEmailMessages.id, email.id));
  return { id: Number(draft.id), replayed: draft.replayed, sent: false as const };
}

export async function dismissEmailCommand(input: { userId: number; emailId: number }) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const [email] = await db.select().from(comoNextEmailMessages).where(and(eq(comoNextEmailMessages.id, input.emailId), eq(comoNextEmailMessages.userId, input.userId))).limit(1);
  if (!email) throw new TRPCError({ code: "NOT_FOUND", message: "لم يُعثر على الرسالة" });
  if (email.inboxStatus === "linked") throw new TRPCError({ code: "BAD_REQUEST", message: "الرسالة مرتبطة بملف عمل ولا يمكن استبعادها من صندوق المطابقة" });
  await db.update(comoNextEmailMessages).set({ inboxStatus: "dismissed", dismissedAt: nowSql() }).where(eq(comoNextEmailMessages.id, input.emailId));
  return { success: true, externalSideEffect: false as const, serverFlagsChanged: false as const };
}
