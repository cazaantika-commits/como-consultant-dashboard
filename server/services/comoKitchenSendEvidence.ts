import { sql } from "drizzle-orm";
import { getDb } from "../db";

/**
 * Read-only send-evidence guard shared by the executive kitchen and Sara.
 *
 * It deliberately has no title/body matching. A send action can change its
 * presentation only through a structured communicationId in a work-file event
 * (the event action_id, payload.actionId, or payload.nextActionId), followed
 * by a matching durable draft-ledger row and sent communication evidence.
 */
export type SendEvidenceAction = {
  id: number;
  userId?: number | null;
  projectId?: number | null;
  workFileId?: number | null;
  title: string;
  description?: string | null;
  ownerType?: "human" | "manus" | "team" | string | null;
  ownerUserId?: number | null;
  actionStatus?: string | null;
  /** Sara's historical reader calls the same database column `status`. */
  status?: string | null;
  attentionAt?: string | Date | null;
  followUpAt?: string | Date | null;
  [key: string]: unknown;
};

export type SendEvidenceEvent = {
  actionId: number;
  communicationId: number;
};

export type SendEvidenceCommunication = {
  id: number;
  userId: number | null;
  projectId: number | null;
  workFileId: number | null;
  channel: string;
  direction: string;
  communicationStatus: string;
  evidenceReference: string | null;
  externalMessageRef: string | null;
};

export type SendEvidenceLedger = {
  id: number;
  userId: number | null;
  projectId: number | null;
  workFileId: number | null;
  communicationId: number | null;
  state: string;
  sentFolder: string | null;
  sentUid: number | null;
  reviewReason?: string | null;
};

export type SendEvidenceSentMessage = {
  id: number;
  communicationId: number | null;
  folderName: string;
  imapUid: number | null;
};

export type SendEvidenceDiagnosticCode = "draft_missing_unconfirmed" | "ambiguous";

export type SendEvidenceDiagnostic = {
  actionId: number;
  communicationId: number | null;
  /** All explicit candidates, so every conflicting Draft can leave owner review. */
  communicationIds: number[];
  code: SendEvidenceDiagnosticCode;
  route: "manus_send_evidence_reconciliation";
  ownerType: "manus";
  requiresOwnerResend: false;
  message: string;
};

export type ComoKitchenSendEvidenceProjection<T extends SendEvidenceAction = SendEvidenceAction> = {
  actions: T[];
  diagnostics: SendEvidenceDiagnostic[];
};

/**
 * The unmatched inbox record remains available to email/health surfaces. This
 * narrow filter only prevents a separately owner-cancelled *suggested next
 * step* from becoming a kitchen-queue card.
 */
export function filterCancelledKitchenEmailSuggestions<T extends { kitchenSuggestionCancelled?: unknown }>(emails: T[]) {
  return emails.filter(email => {
    const cancelled = email.kitchenSuggestionCancelled;
    return cancelled !== true && cancelled !== 1 && cancelled !== "1";
  });
}

type ProjectionSources = {
  actions: SendEvidenceAction[];
  events: SendEvidenceEvent[];
  communications: SendEvidenceCommunication[];
  ledgers: SendEvidenceLedger[];
  sentMessages: SendEvidenceSentMessage[];
  nowMs?: number;
};

function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result) && Array.isArray(result[0])) return result[0] as T[];
  return Array.isArray(result) ? result as T[] : [];
}

function numberOrNull(value: unknown) {
  const number = value == null || String(value).trim() === "" ? NaN : Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function textPresent(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function actionStatus(action: SendEvidenceAction) {
  return String(action.actionStatus ?? action.status ?? "");
}

function isTerminal(action: SendEvidenceAction) {
  return ["verified", "cancelled"].includes(actionStatus(action));
}

function isDelayed(action: SendEvidenceAction, nowMs: number) {
  if (!action.attentionAt) return false;
  const raw = action.attentionAt instanceof Date ? action.attentionAt.toISOString() : String(action.attentionAt);
  const parsed = new Date(raw.includes("T") ? raw : `${raw.replace(" ", "T")}Z`).getTime();
  return Number.isFinite(parsed) && parsed <= nowMs;
}

/** Presentation only: retain the subject but never repeat a completed owner-send ask. */
function sentFollowupSubject(title: string) {
  const subject = title
    .replace(/^\s*مراجعة\s*(?:و\s*)?إرسال\s*/, "")
    .replace(/^\s*إرسال\s*/, "")
    .trim();
  return subject || "المراسلة";
}

function projectedAction<T extends SendEvidenceAction>(action: T, input: {
  actionStatus: "waiting_external" | "in_progress";
  title?: string;
  description?: string;
  evidence: Record<string, unknown>;
}): T {
  const next: SendEvidenceAction = {
    ...action,
    ownerType: "manus",
    ownerUserId: null,
    ...(Object.prototype.hasOwnProperty.call(action, "actionStatus") ? { actionStatus: input.actionStatus } : {}),
    ...(Object.prototype.hasOwnProperty.call(action, "status") ? { status: input.actionStatus } : {}),
    ...(input.title ? { title: input.title } : {}),
    ...(input.description ? { description: input.description } : {}),
    sendEvidenceProjection: input.evidence,
  };
  return next as T;
}

function conflictMessage(code: SendEvidenceDiagnosticCode, communicationId: number | null) {
  const communication = communicationId ? ` للمراسلة #${communicationId}` : "";
  if (code === "ambiguous") {
    return `تعارض في ربط دليل الإرسال${communication}: توجد أكثر من هوية صريحة محتملة. يحسم Manus الربط من السجل والأحداث؛ لا تطلب إعادة الإرسال من المالك.`;
  }
  return `تمت الإشارة إلى إرسال${communication} لكن لا يكتمل دليل المسودة/الصادر المؤكد. يحل Manus التعارض من السجل والأحداث؛ لا تطلب إعادة الإرسال من المالك.`;
}

function evidenceConflict<T extends SendEvidenceAction>(action: T, input: {
  code: SendEvidenceDiagnosticCode;
  communicationId: number | null;
}) {
  const message = conflictMessage(input.code, input.communicationId);
  const diagnostic: SendEvidenceDiagnostic = {
    actionId: Number(action.id),
    communicationId: input.communicationId,
    communicationIds: input.communicationId ? [input.communicationId] : [],
    code: input.code,
    route: "manus_send_evidence_reconciliation",
    ownerType: "manus",
    requiresOwnerResend: false,
    message,
  };
  return {
    action: projectedAction(action, {
      actionStatus: "in_progress",
      title: `تعارض دليل الإرسال — ${action.title}`,
      description: message,
      evidence: {
        state: input.code,
        communicationId: input.communicationId,
        route: diagnostic.route,
        requiresOwnerResend: false,
      },
    }),
    diagnostic,
  };
}

/**
 * Pure, conservative projection used by focused tests and the DB reader below.
 * Absence of an explicit action-to-communication event is intentionally a no-op:
 * a similar title, a Draft, or a Sent message can never be used as a guess.
 */
export function buildComoKitchenSendEvidenceProjection<T extends SendEvidenceAction>(input: ProjectionSources & { actions: T[] }): ComoKitchenSendEvidenceProjection<T> {
  const nowMs = input.nowMs ?? Date.now();
  const communicationIdsByAction = new Map<number, Set<number>>();
  for (const event of input.events) {
    const actionId = numberOrNull(event.actionId);
    const communicationId = numberOrNull(event.communicationId);
    if (!actionId || !communicationId) continue;
    const current = communicationIdsByAction.get(actionId) || new Set<number>();
    current.add(communicationId);
    communicationIdsByAction.set(actionId, current);
  }

  const communications = new Map(input.communications.map(item => [Number(item.id), item]));
  const ledgersByCommunication = new Map<number, SendEvidenceLedger[]>();
  for (const ledger of input.ledgers) {
    const communicationId = numberOrNull(ledger.communicationId);
    if (!communicationId) continue;
    const current = ledgersByCommunication.get(communicationId) || [];
    current.push(ledger);
    ledgersByCommunication.set(communicationId, current);
  }
  const sentMessagesByCommunication = new Map<number, SendEvidenceSentMessage[]>();
  for (const message of input.sentMessages) {
    const communicationId = numberOrNull(message.communicationId);
    if (!communicationId || message.folderName !== "Sent") continue;
    const current = sentMessagesByCommunication.get(communicationId) || [];
    current.push(message);
    sentMessagesByCommunication.set(communicationId, current);
  }

  const diagnostics: SendEvidenceDiagnostic[] = [];
  const actions = (input.actions as T[]).map(action => {
    if (isTerminal(action)) return action;
    const communicationIds = Array.from(communicationIdsByAction.get(Number(action.id)) || new Set<number>());
    // No explicit relation means no claim about Draft/Sent state and no change.
    if (!communicationIds.length) return action;
    if (communicationIds.length !== 1) {
      const conflict = evidenceConflict(action, { code: "ambiguous", communicationId: null });
      conflict.diagnostic.communicationIds = communicationIds;
      (conflict.action as SendEvidenceAction).sendEvidenceProjection = {
        state: "ambiguous",
        communicationIds,
        route: conflict.diagnostic.route,
        requiresOwnerResend: false,
      };
      diagnostics.push(conflict.diagnostic);
      return conflict.action;
    }

    const communicationId = communicationIds[0]!;
    const communication = communications.get(communicationId);
    if (!communication
      || communication.channel !== "email"
      || communication.direction !== "outbound"
      || Number(communication.userId) !== Number(action.userId)
      || Number(communication.projectId) !== Number(action.projectId)
      || Number(communication.workFileId) !== Number(action.workFileId)) {
      const conflict = evidenceConflict(action, { code: "ambiguous", communicationId });
      diagnostics.push(conflict.diagnostic);
      return conflict.action;
    }

    const ledgers = ledgersByCommunication.get(communicationId) || [];
    const sentMessages = sentMessagesByCommunication.get(communicationId) || [];
    // Two durable records or two direct Sent projections for one explicit link
    // require reconciliation; choosing the newest one would be a guess.
    if (ledgers.length > 1 || sentMessages.length > 1) {
      const conflict = evidenceConflict(action, { code: "ambiguous", communicationId });
      diagnostics.push(conflict.diagnostic);
      return conflict.action;
    }

    const ledger = ledgers[0] || null;
    const ledgerLineageMatches = Boolean(ledger
      && Number(ledger.userId) === Number(action.userId)
      && Number(ledger.projectId) === Number(action.projectId)
      && Number(ledger.workFileId) === Number(action.workFileId));
    if (ledger && !ledgerLineageMatches) {
      const conflict = evidenceConflict(action, { code: "ambiguous", communicationId });
      diagnostics.push(conflict.diagnostic);
      return conflict.action;
    }

    const sentCommunicationEvidence = communication.communicationStatus === "sent"
      && (textPresent(communication.evidenceReference)
        || textPresent(communication.externalMessageRef)
        || sentMessages.length === 1);
    const ledgerSentConfirmed = Boolean(ledger
      && ledger.state === "sent_confirmed"
      && textPresent(ledger.sentFolder)
      && numberOrNull(ledger.sentUid));

    if (ledgerSentConfirmed && sentCommunicationEvidence) {
      const delayed = isDelayed(action, nowMs);
      const subject = sentFollowupSubject(action.title);
      return projectedAction(action, {
        actionStatus: delayed ? "in_progress" : "waiting_external",
        title: delayed
          ? `متابعة Manus لتأخر الرد بعد الإرسال: ${subject}`
          : `تم الإرسال — بانتظار الرد الخارجي: ${subject}`,
        description: delayed
          ? "الإرسال مثبت بسجل المسودة والصادر المرتبطين صراحة؛ تأخر الرد متابعة Manus، وليس إعادة إرسال من المالك."
          : "الإرسال مثبت بسجل المسودة والصادر المرتبطين صراحة؛ المتبقي انتظار الرد الخارجي ومتابعته من Manus.",
        evidence: {
          state: "sent_confirmed",
          communicationId,
          ledgerId: ledger!.id,
          sentFolder: ledger!.sentFolder,
          sentUid: ledger!.sentUid,
          delayed,
          ownerPromptRemoved: true,
        },
      });
    }

    // A normal Draft (or no Draft record) is not a failed send claim. It remains
    // exactly as the source action says. Only a positive sent signal without the
    // complete two-source proof becomes a Manus-owned diagnostic.
    const positiveSentSignal = communication.communicationStatus === "sent"
      || Boolean(ledger && ledger.state === "sent_confirmed")
      || sentMessages.length === 1;
    if (!positiveSentSignal) return action;

    const conflict = evidenceConflict(action, { code: "draft_missing_unconfirmed", communicationId });
    diagnostics.push(conflict.diagnostic);
    return conflict.action;
  });

  return { actions, diagnostics };
}

/**
 * Read-only database adapter. It reads only explicit identifiers from events;
 * it neither invokes mailbox APIs nor runs reconciliation/mutation commands.
 */
export async function projectComoKitchenSendEvidence<T extends SendEvidenceAction>(input: {
  userId: number;
  actions: T[];
  nowMs?: number;
}): Promise<ComoKitchenSendEvidenceProjection<T>> {
  const actionIds = Array.from(new Set(input.actions.map(action => numberOrNull(action.id)).filter((id): id is number => id !== null)));
  if (!actionIds.length) return { actions: input.actions, diagnostics: [] };
  const db = await getDb();
  if (!db) throw new Error("database_unavailable_for_send_evidence_projection");
  const ids = sql.join(actionIds.map(id => sql`${id}`), sql`, `);

  const eventResult = await db.execute(sql`
    SELECT
      event_row.action_id AS eventActionId,
      JSON_UNQUOTE(JSON_EXTRACT(event_row.payload_json, '$.actionId')) AS payloadActionId,
      JSON_UNQUOTE(JSON_EXTRACT(event_row.payload_json, '$.nextActionId')) AS nextActionId,
      JSON_UNQUOTE(JSON_EXTRACT(event_row.payload_json, '$.communicationId')) AS communicationId
    FROM como_next_work_file_events event_row
    WHERE event_row.user_id = ${input.userId}
      AND JSON_VALID(COALESCE(event_row.payload_json, '{}'))
      AND JSON_UNQUOTE(JSON_EXTRACT(event_row.payload_json, '$.communicationId')) REGEXP '^[1-9][0-9]*$'
      AND (
        event_row.action_id IN (${ids})
        OR JSON_UNQUOTE(JSON_EXTRACT(event_row.payload_json, '$.actionId')) REGEXP '^[1-9][0-9]*$'
        OR JSON_UNQUOTE(JSON_EXTRACT(event_row.payload_json, '$.nextActionId')) REGEXP '^[1-9][0-9]*$'
      )
  `);
  const events: SendEvidenceEvent[] = [];
  for (const row of rowsOf<Record<string, unknown>>(eventResult)) {
    const communicationId = numberOrNull(row.communicationId);
    if (!communicationId) continue;
    for (const candidate of [row.eventActionId, row.payloadActionId, row.nextActionId]) {
      const actionId = numberOrNull(candidate);
      if (actionId && actionIds.includes(actionId)) events.push({ actionId, communicationId });
    }
  }
  const communicationIds = Array.from(new Set(events.map(item => item.communicationId)));
  if (!communicationIds.length) return buildComoKitchenSendEvidenceProjection({ ...input, events, communications: [], ledgers: [], sentMessages: [] });
  const communicationSqlIds = sql.join(communicationIds.map(id => sql`${id}`), sql`, `);

  const [communicationsResult, ledgersResult, sentMessagesResult] = await Promise.all([
    db.execute(sql`
      SELECT id, user_id AS userId, project_id AS projectId, work_file_id AS workFileId,
        channel, direction, communication_status AS communicationStatus,
        evidence_reference AS evidenceReference, external_message_ref AS externalMessageRef
      FROM como_next_communications
      WHERE user_id = ${input.userId} AND id IN (${communicationSqlIds})
    `),
    db.execute(sql`
      SELECT id, user_id AS userId, project_id AS projectId, work_file_id AS workFileId,
        communication_id AS communicationId, state, sent_folder AS sentFolder,
        sent_uid AS sentUid, review_reason AS reviewReason
      FROM como_mailbox_draft_ledger
      WHERE user_id = ${input.userId} AND communication_id IN (${communicationSqlIds})
    `),
    db.execute(sql`
      SELECT id, communication_id AS communicationId, folder_name AS folderName, imap_uid AS imapUid
      FROM como_next_email_messages
      WHERE user_id = ${input.userId} AND folder_name = ${"Sent"}
        AND communication_id IN (${communicationSqlIds})
    `),
  ]);

  return buildComoKitchenSendEvidenceProjection({
    ...input,
    events,
    communications: rowsOf<SendEvidenceCommunication>(communicationsResult).map(item => ({
      ...item,
      id: Number(item.id),
      userId: numberOrNull(item.userId),
      projectId: numberOrNull(item.projectId),
      workFileId: numberOrNull(item.workFileId),
    })),
    ledgers: rowsOf<SendEvidenceLedger>(ledgersResult).map(item => ({
      ...item,
      id: Number(item.id),
      userId: numberOrNull(item.userId),
      projectId: numberOrNull(item.projectId),
      workFileId: numberOrNull(item.workFileId),
      communicationId: numberOrNull(item.communicationId),
      sentUid: numberOrNull(item.sentUid),
    })),
    sentMessages: rowsOf<SendEvidenceSentMessage>(sentMessagesResult).map(item => ({
      ...item,
      id: Number(item.id),
      communicationId: numberOrNull(item.communicationId),
      imapUid: numberOrNull(item.imapUid),
    })),
  });
}
