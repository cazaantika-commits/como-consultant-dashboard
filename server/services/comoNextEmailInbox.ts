import { createHash, randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, isNotNull, like, lt, or, sql } from "drizzle-orm";
import {
  comoNextActions,
  comoNextCommunications,
  comoNextDecisions,
  comoNextDocuments,
  comoNextEmailAnalyses,
  comoNextEmailAttachments,
  comoNextEmailMessages,
  comoNextIntakeProposals,
  comoNextMeetings,
  comoNextProjectParties,
  comoNextWorkFileEvents,
  comoNextWorkFiles,
  comoNextWorkMemory,
  comoNextWorkMemoryDocuments,
  projects,
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
import { appendEvent, createActionCommand, createCommunicationDraftCommand, createWorkFileCommand, requireProjectAccess, toSqlUtcTimestamp } from "./comoNextCommands";
import { createIntakeProposalsCommand, reviewIntakeProposalCommand, type IntakeProposalDraft } from "./comoNextIntake";
import { currentInboundEmailText, reconcileWorkFileEvidenceCommand } from "./comoNextActionReconciliation";
import { runExecutiveControlLoopCommand } from "./comoNextExecutiveControl";
import { createMeetingCommand } from "./comoNextMeetings";

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

export type ConfirmedMeetingEvidence = {
  canonicalSubject: string;
  plotNumber: string | null;
  startsAt: string;
  location: string | null;
  personName: string | null;
  organizationName: string | null;
  topic: string;
};

const monthNumbers: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
  يناير: 0, فبراير: 1, مارس: 2, أبريل: 3, ابريل: 3, مايو: 4, يونيو: 5,
  يوليو: 6, أغسطس: 7, اغسطس: 7, سبتمبر: 8, أكتوبر: 9, اكتوبر: 9, نوفمبر: 10, ديسمبر: 11,
};

function asciiDigits(value: string) {
  return value.replace(/[٠-٩]/g, digit => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
}

/** An incoming contract revision is evidence to review, not authorization to draft a reply. */
export function isContractNegotiationEmail(subject: string, body: string) {
  return /\b(?:agreement|contract|appointment)\b|عقد|اتفاقية/i.test(subject)
    && /\b(?:revis(?:ed|ion)|draft|review|sign[ -]?off|clarif(?:y|ication))\b|مسودة|مراجعة|تعديل/i.test(currentInboundEmailText(body));
}

function canonicalMeetingSubject(subject: string) {
  return normalizeText(subject.replace(/^\s*(?:(?:re|fw|fwd)\s*:\s*)+/i, ""));
}

function sqlUtcFromDubaiParts(year: number, month: number, day: number, hour: number, minute: number) {
  const utc = new Date(Date.UTC(year, month, day, hour - 4, minute, 0));
  const dubaiCheck = new Date(utc.getTime() + 4 * 60 * 60 * 1000);
  if (dubaiCheck.getUTCFullYear() !== year || dubaiCheck.getUTCMonth() !== month || dubaiCheck.getUTCDate() !== day || dubaiCheck.getUTCHours() !== hour || dubaiCheck.getUTCMinutes() !== minute) return null;
  return utc.toISOString();
}

function meetingStartsAtFromText(text: string, receivedAt: string) {
  const explicit = text.match(/\b(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december|يناير|فبراير|مارس|أبريل|ابريل|مايو|يونيو|يوليو|أغسطس|اغسطس|سبتمبر|أكتوبر|اكتوبر|نوفمبر|ديسمبر)(?:\s+(20\d{2}))?\b[\s\S]{0,80}?\b(?:at|الساعة)?\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM|صباح(?:ًا|ا)?|مساء(?:ً|ًا|ا)?)\b/i);
  const relative = text.match(/(?:\b(?:tomorrow)\b|غدًا|غدا)[\s\S]{0,80}?\b(?:at|الساعة)?\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM|صباح(?:ًا|ا)?|مساء(?:ً|ًا|ا)?)\b/i)
    || text.match(/\b(?:at|الساعة)?\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM|صباح(?:ًا|ا)?|مساء(?:ً|ًا|ا)?)[\s\S]{0,80}?(?:\b(?:tomorrow)\b|غدًا|غدا)/i);
  const match = explicit || relative;
  if (!match) return null;
  let hour = Number(explicit ? explicit[4] : relative![1]);
  const minute = Number(explicit ? explicit[5] || 0 : relative![2] || 0);
  const period = String(explicit ? explicit[6] : relative![3]).toLowerCase();
  if (/pm|مساء/.test(period) && hour < 12) hour += 12;
  if (/am|صباح/.test(period) && hour === 12) hour = 0;
  if (hour > 23 || minute > 59) return null;
  if (explicit) {
    const month = monthNumbers[String(explicit[2]).toLowerCase()];
    if (month === undefined) return null;
    return sqlUtcFromDubaiParts(Number(explicit[3] || parseStoredUtc(receivedAt).getUTCFullYear()), month, Number(explicit[1]), hour, minute);
  }
  // Relative dates use the message's stated Dubai timezone, not its UTC day.
  const dubaiNow = new Date(parseStoredUtc(receivedAt).getTime() + 4 * 60 * 60 * 1000);
  const tomorrow = new Date(Date.UTC(dubaiNow.getUTCFullYear(), dubaiNow.getUTCMonth(), dubaiNow.getUTCDate() + 1));
  return sqlUtcFromDubaiParts(tomorrow.getUTCFullYear(), tomorrow.getUTCMonth(), tomorrow.getUTCDate(), hour, minute);
}

/** Quoted history corroborates an old slot only; it must never produce a new one. */
export function currentMeetingEmailText(body: string) {
  const current: string[] = [];
  for (const line of asciiDigits(body || "").split("\n")) {
    if (/^\s*>/.test(line)) continue;
    if (/^\s*(?:on\s+.+\s+wrote:|[-_]{2,}\s*original message\s*[-_]{2,}|(?:from|sent|to|subject|من)\s*:)/i.test(line)) break;
    current.push(line);
  }
  return current.join("\n").trim();
}

const explicitMeetingConfirmation = /\b(?:has been|is|was) confirmed\b|\bconfirmed for\b|تم\s+تأكيد|موعد\s+مؤكد/i;
const explicitMeetingReschedule = /\b(?:rescheduled|re-?scheduled|moved|postponed)\s+(?:for|to)\b|\b(?:meeting|appointment)\s+(?:has been\s+)?(?:moved|postponed)\b|(?:تم\s+)?(?:إعادة\s+جدولة|تغيير|تأجيل)\s+(?:الموعد|الاجتماع)(?:\s+إلى)?/i;

function meetingEvidenceFromText(email: Pick<typeof comoNextEmailMessages.$inferSelect, "folderName" | "subject" | "bodyText" | "receivedAt">, body: string, allowScheduleAcknowledgement: boolean, metadataBody = body): ConfirmedMeetingEvidence | null {
  const subject = asciiDigits(email.subject || "");
  const text = `${subject}\n${metadataBody}`;
  const isMeeting = /\bmeeting\b|اجتماع/i.test(subject);
  const directConfirmation = explicitMeetingConfirmation.test(body) || explicitMeetingReschedule.test(body);
  const scheduleAcknowledgement = allowScheduleAcknowledgement && /take note.{0,40}(?:schedule|calendar)|(?:added|noted).{0,40}(?:schedule|calendar)|سأسجل.{0,40}(?:الجدول|التقويم)|تم.{0,30}(?:تسجيل|إضافة).{0,30}(?:الموعد|التقويم)/i.test(body);
  if (!isMeeting || (!directConfirmation && !scheduleAcknowledgement)) return null;
  const startsAt = meetingStartsAtFromText(body, email.receivedAt) || meetingStartsAtFromText(subject, email.receivedAt);
  if (!startsAt) return null;
  const plotNumber = text.match(/(?:plot(?:\s*(?:no\.?|number))?|قطعة)\s*(?:-|–|:)?\s*(\d{5,})/i)?.[1] || null;
  const personAndOrganization = text.match(/(?:Eng\.?|Engineer|المهندس)\s+([\p{L}][\p{L} .'-]{1,60}?)\s+(?:from|من)\s+([\p{L}][\p{L}0-9 .&'-]{1,60}?)(?=\s+(?:has been|is|was)\s+confirmed|\s+تم\s+تأكيد|\s+for\s+tomorrow|\s+لمناقشة|[,\n.])/iu);
  const personName = personAndOrganization?.[1]?.trim() || null;
  const organizationName = personAndOrganization?.[2]?.trim() || null;
  const location = text.match(/(?:at our office at|location\s*:|المكان\s*:|في مكتب(?:نا)?\s+(?:في|بـ)?)\s*([^\n.]{3,160})/i)?.[1]?.replace(/^>+\s*/, "").trim() || null;
  const topic = text.match(/(?:purpose of the meeting is to discuss|meeting is to discuss|الغرض من الاجتماع(?:\s+هو)?|لمناقشة)\s+([\s\S]{8,280}?)(?=\.\s*(?:\n|$)|\n\s*(?:Please|يرجى))/i)?.[1]?.replace(/\n\s*>?\s*/g, " ").trim()
    || (plotNumber ? `التصور والتوجه التصميمي الأولي لمشروع الفلل الأربع — قطعة ${plotNumber}` : "موضوع الاجتماع المؤكد");
  return { canonicalSubject: canonicalMeetingSubject(subject), plotNumber, startsAt, location, personName, organizationName, topic };
}

export function extractConfirmedMeetingEvidence(email: Pick<typeof comoNextEmailMessages.$inferSelect, "folderName" | "subject" | "bodyText" | "receivedAt">): ConfirmedMeetingEvidence | null {
  const current = currentMeetingEmailText(email.bodyText || "");
  return meetingEvidenceFromText(email, current, true, asciiDigits(email.bodyText || ""));
}

/** Old imports removed quote markers before extracting evidence. Retain that
 * compatibility only to find an already-created legacy slot; never create or
 * reschedule from it, because quoted text is not current confirmation. */
function legacyConfirmedMeetingEvidence(email: Pick<typeof comoNextEmailMessages.$inferSelect, "folderName" | "subject" | "bodyText" | "receivedAt">) {
  const legacyText = asciiDigits(email.bodyText || "").split("\n").map(line => line.replace(/^\s*>+\s?/, "")).join("\n");
  return meetingEvidenceFromText(email, legacyText, true, legacyText);
}

export function isMeetingScheduleAcknowledgement(email: Pick<typeof comoNextEmailMessages.$inferSelect, "folderName" | "subject" | "bodyText" | "receivedAt">) {
  return email.folderName === "INBOX" && Boolean(extractConfirmedMeetingEvidence(email)) && /take note.{0,40}(?:schedule|calendar)|(?:added|noted).{0,40}(?:schedule|calendar)|سأسجل.{0,40}(?:الجدول|التقويم)|تم.{0,30}(?:تسجيل|إضافة).{0,30}(?:الموعد|التقويم)/i.test(currentMeetingEmailText(email.bodyText));
}

function meetingDisplayPerson(value?: string | null) {
  const cleaned = String(value || "").trim();
  if (/^majed$/i.test(cleaned)) return "ماجد";
  return cleaned || "ممثل الطرف";
}

function confirmedMeetingKey(projectId: number, evidence: ConfirmedMeetingEvidence) {
  return createHash("sha256").update([
    projectId,
    evidence.startsAt,
    evidence.plotNumber || "",
  ].join("|")).digest("hex").slice(0, 32);
}

function freshConfirmedMeetingEvidence(email: Pick<typeof comoNextEmailMessages.$inferSelect, "folderName" | "subject" | "bodyText" | "receivedAt">) {
  if (email.folderName !== "INBOX") return null;
  const current = currentMeetingEmailText(email.bodyText || "");
  if (!current) return null;
  return meetingEvidenceFromText(email, current, false, asciiDigits(email.bodyText || ""));
}

function isLaterThreadEvidence(candidate: typeof comoNextEmailMessages.$inferSelect, prior: typeof comoNextEmailMessages.$inferSelect) {
  const candidateTime = parseStoredUtc(candidate.receivedAt).getTime();
  const priorTime = parseStoredUtc(prior.receivedAt).getTime();
  return candidateTime > priorTime || (candidateTime === priorTime && Number(candidate.id) > Number(prior.id));
}

function confirmedMeetingEvidenceReference(email: typeof comoNextEmailMessages.$inferSelect) {
  return `IMAP ${email.folderName}; UIDVALIDITY=${email.uidValidity}; UID=${email.imapUid}; SHA-256=${email.bodySha256}`;
}

async function ensureConfirmedMeetingPreparation(input: {
  userId: number;
  meetingId: number;
  workFileId: number;
  evidence: ConfirmedMeetingEvidence;
}) {
  if (new Date(input.evidence.startsAt).getTime() <= Date.now()) return null;
  const person = meetingDisplayPerson(input.evidence.personName);
  const organization = input.evidence.organizationName || "الطرف الخارجي";
  const action = await createActionCommand({
    userId: input.userId,
    workFileId: input.workFileId,
    title: `جهّز إحاطة ومحاور اجتماع ${organization} مع المهندس ${person}`,
    description: `اقرأ ملف المشروع والمراسلات المرتبطة، واستخرج ما يجب عرضه أو سؤاله أو حسمه في الاجتماع: ${input.evidence.topic}`,
    acceptanceCriteria: "إحاطة تنفيذية مختصرة ومحاور مرتبة مرتبطة بالدليل، جاهزة داخل ملف الاجتماع قبل الموعد، بلا إرسال أو التزام خارجي.",
    ownerType: "manus",
    priority: "urgent",
    dueAt: input.evidence.startsAt,
    idempotencyKey: `confirmed-meeting-preparation:${input.meetingId}`,
    actorType: "system",
    actorUserId: null,
  });
  return Number(action.id);
}

/** A reschedule changes the due time of the existing preparation only while it
 * remains active. Completed/cancelled preparation is never silently reopened. */
async function rescheduleConfirmedMeetingPreparation(input: {
  userId: number;
  meetingId: number;
  workFileId: number;
  projectId: number;
  emailId: number;
  oldStartsAt: string | null;
  evidence: ConfirmedMeetingEvidence;
}) {
  if (new Date(input.evidence.startsAt).getTime() <= Date.now()) return null;
  const db = await getDb();
  if (!db) databaseUnavailable();
  const preparationKey = `confirmed-meeting-preparation:${input.meetingId}`;
  const [preparationEvent] = await db.select({ actionId: comoNextWorkFileEvents.actionId })
    .from(comoNextWorkFileEvents).where(eq(comoNextWorkFileEvents.idempotencyKey, preparationKey)).limit(1);
  if (!preparationEvent?.actionId) {
    return ensureConfirmedMeetingPreparation({ userId: input.userId, meetingId: input.meetingId, workFileId: input.workFileId, evidence: input.evidence });
  }
  const [action] = await db.select().from(comoNextActions).where(eq(comoNextActions.id, preparationEvent.actionId)).limit(1);
  if (!action || !["open", "in_progress", "waiting_external"].includes(action.actionStatus)) return Number(preparationEvent.actionId);
  const dueAt = toSqlUtcTimestamp(input.evidence.startsAt);
  if (action.dueAt === dueAt) return Number(action.id);
  await db.transaction(async tx => {
    await tx.update(comoNextActions).set({
      dueAt,
      attentionAt: action.followUpAt || dueAt,
    }).where(eq(comoNextActions.id, action.id));
    await appendEvent(tx, {
      userId: input.userId,
      projectId: input.projectId,
      workFileId: input.workFileId,
      actionId: Number(action.id),
      actorType: "system",
      actorUserId: null,
      eventType: "meeting_preparation_rescheduled",
      summary: `تحديث موعد تحضير الاجتماع إلى ${dueAt}`,
      payload: { meetingId: input.meetingId, emailId: input.emailId, fromStartsAt: input.oldStartsAt, toStartsAt: dueAt, externalSideEffect: false },
      idempotencyKey: `meeting-preparation-rescheduled:${input.meetingId}:${input.emailId}`,
    });
  });
  return Number(action.id);
}

export async function reconcileConfirmedMeetingEmailCommand(input: { userId: number; emailId: number }) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const [email] = await db.select().from(comoNextEmailMessages).where(and(
    eq(comoNextEmailMessages.id, input.emailId),
    eq(comoNextEmailMessages.userId, input.userId),
  )).limit(1);
  if (!email) throw new TRPCError({ code: "NOT_FOUND", message: "لم يُعثر على الرسالة" });
  const currentEvidence = extractConfirmedMeetingEvidence(email);
  const evidence = currentEvidence || legacyConfirmedMeetingEvidence(email);
  if (!evidence?.plotNumber) return { skipped: "not_explicit_confirmed_meeting", meetingId: null, workFileId: null, externalSideEffect: false as const };

  const relatedEmails = await db.select().from(comoNextEmailMessages).where(eq(comoNextEmailMessages.userId, input.userId))
    .orderBy(desc(comoNextEmailMessages.receivedAt), desc(comoNextEmailMessages.id)).limit(150);
  const sameThread = relatedEmails.filter(item => canonicalMeetingSubject(item.subject) === evidence.canonicalSubject);
  const corroborated = sameThread.some(item => isMeetingScheduleAcknowledgement(item) || (
    item.folderName === "INBOX" && /\b(?:yes,?\s*)?confirmed\b|تم\s+تأكيد|الموعد\s+مؤكد/i.test(item.bodyText.slice(0, 2_500))
  ));
  if (!corroborated) return { skipped: "confirmation_not_corroborated", meetingId: null, workFileId: null, externalSideEffect: false as const };

  const candidates = await db.select({ id: projects.id, name: projects.name }).from(projects).where(and(
    eq(projects.plotNumber, evidence.plotNumber),
    eq(projects.isTestProject, 0),
  ));
  const accessible = [] as typeof candidates;
  for (const candidate of candidates) {
    try { await requireProjectAccess(db, candidate.id, input.userId, "read"); accessible.push(candidate); } catch { /* inaccessible project */ }
  }
  if (accessible.length !== 1) return { skipped: "project_not_unique", meetingId: null, workFileId: null, externalSideEffect: false as const };
  const project = accessible[0];
  // This is deliberately the historical key: records created before the
  // reschedule fix keep replaying exactly as they did. It is not a series key.
  const key = confirmedMeetingKey(project.id, evidence);
  const [existingMeeting] = await db.select().from(comoNextMeetings).where(and(
    eq(comoNextMeetings.sourceSystem, "como_next"),
    eq(comoNextMeetings.sourceRecordId, `confirmed-meeting:${key}`),
  )).limit(1);
  if (existingMeeting) {
    if (["completed", "cancelled"].includes(existingMeeting.meetingStatus) || !existingMeeting.workFileId) {
      return { skipped: "legacy_meeting_closed", meetingId: Number(existingMeeting.id), workFileId: existingMeeting.workFileId ? Number(existingMeeting.workFileId) : null, externalSideEffect: false as const };
    }
    if (email.inboxStatus === "linked" && Number(email.linkedWorkFileId || 0) !== Number(existingMeeting.workFileId)) {
      return { skipped: "email_already_linked_elsewhere", meetingId: null, workFileId: null, externalSideEffect: false as const };
    }
    if (email.inboxStatus !== "linked") {
      await linkEmailToWorkFileCommand({ userId: input.userId, emailId: Number(email.id), projectId: project.id, workFileId: Number(existingMeeting.workFileId), suppressReplyDraft: true });
    }
    const preparationActionId = await ensureConfirmedMeetingPreparation({ userId: input.userId, meetingId: Number(existingMeeting.id), workFileId: Number(existingMeeting.workFileId), evidence });
    return { replayed: true as const, meetingId: Number(existingMeeting.id), workFileId: Number(existingMeeting.workFileId), preparationActionId, externalSideEffect: false as const };
  }

  // A changed time cannot use the legacy slot key. Treat it as a reschedule
  // only when the current (not quoted) text explicitly confirms/moves a time,
  // and exactly one open COMO meeting has earlier linked evidence in this same
  // normalized subject thread. A changed subject or multiple plausible files
  // intentionally leaves the message for review rather than merging records.
  const freshEvidence = currentEvidence && freshConfirmedMeetingEvidence(email);
  if (freshEvidence?.plotNumber) {
    const incompleteMeetings = await db.select().from(comoNextMeetings).where(and(
      eq(comoNextMeetings.projectId, project.id),
      eq(comoNextMeetings.sourceSystem, "como_next"),
      like(comoNextMeetings.sourceRecordId, "confirmed-meeting:%"),
      inArray(comoNextMeetings.meetingStatus, ["planned", "confirmed"]),
      isNotNull(comoNextMeetings.workFileId),
    ));
    const matched = [] as typeof incompleteMeetings;
    for (const meeting of incompleteMeetings) {
      const linkedThreadEvidence = sameThread.some(item =>
        Number(item.linkedWorkFileId || 0) === Number(meeting.workFileId)
        && isLaterThreadEvidence(email, item)
        && Boolean(extractConfirmedMeetingEvidence(item)),
      );
      if (linkedThreadEvidence) matched.push(meeting);
    }
    if (matched.length === 1) {
      const meeting = matched[0];
      if (email.inboxStatus === "linked" && Number(email.linkedWorkFileId || 0) !== Number(meeting.workFileId)) {
        return { skipped: "email_already_linked_elsewhere", meetingId: null, workFileId: null, externalSideEffect: false as const };
      }
      if (email.inboxStatus !== "linked") {
        await linkEmailToWorkFileCommand({ userId: input.userId, emailId: Number(email.id), projectId: project.id, workFileId: Number(meeting.workFileId), suppressReplyDraft: true });
      }
      const oldStartsAt = meeting.startsAt;
      const startsAt = toSqlUtcTimestamp(freshEvidence.startsAt);
      const changed = oldStartsAt !== startsAt;
      if (changed) {
        await db.transaction(async tx => {
          await tx.update(comoNextMeetings).set({
            startsAt,
            location: freshEvidence.location || meeting.location,
            meetingStatus: "confirmed",
          }).where(eq(comoNextMeetings.id, meeting.id));
          await appendEvent(tx, {
            userId: input.userId,
            projectId: project.id,
            workFileId: Number(meeting.workFileId),
            actorType: "system",
            actorUserId: null,
            eventType: "meeting_rescheduled_from_email",
            summary: `تحديث موعد الاجتماع المؤكد من ${oldStartsAt || "غير محدد"} إلى ${startsAt}`,
            payload: {
              meetingId: Number(meeting.id), emailId: Number(email.id), fromStartsAt: oldStartsAt,
              toStartsAt: startsAt, evidenceReference: confirmedMeetingEvidenceReference(email), externalSideEffect: false,
            },
            idempotencyKey: `meeting-rescheduled:${meeting.id}:${email.id}`,
          });
        });
      }
      const preparationActionId = await rescheduleConfirmedMeetingPreparation({
        userId: input.userId, meetingId: Number(meeting.id), workFileId: Number(meeting.workFileId), projectId: project.id,
        emailId: Number(email.id), oldStartsAt, evidence: freshEvidence,
      });
      return {
        replayed: !changed,
        rescheduled: changed,
        meetingId: Number(meeting.id),
        workFileId: Number(meeting.workFileId),
        preparationActionId,
        externalSideEffect: false as const,
      };
    }
    if (matched.length > 1) {
      return { skipped: "reschedule_match_ambiguous", meetingId: null, workFileId: null, externalSideEffect: false as const };
    }
    if (explicitMeetingReschedule.test(currentMeetingEmailText(email.bodyText))) {
      return { skipped: "reschedule_match_not_proven", meetingId: null, workFileId: null, externalSideEffect: false as const };
    }
  }

  if (!currentEvidence) {
    return { skipped: "legacy_confirmation_not_found", meetingId: null, workFileId: null, externalSideEffect: false as const };
  }

  const person = meetingDisplayPerson(evidence.personName);
  const organization = evidence.organizationName || "الطرف الخارجي";
  const workFile = await createWorkFileCommand({
    userId: input.userId,
    projectId: project.id,
    title: `اجتماع ${organization} — المهندس ${person} — تصور الفلل الأربع`,
    governingQuestion: `ما الذي يجب تحضيره لاجتماع ${organization}، وما النتيجة التي ستحدد الخطوة التنفيذية التالية؟`,
    desiredOutcome: "يظهر الموعد المؤكد في COMO وسارة؛ بعد الاجتماع يذكر عبد الرحمن ما حدث مرة واحدة، ثم يحلل Manus النتيجة وينشئ العمل الداخلي التالي.",
    priority: "urgent",
    idempotencyKey: `confirmed-meeting-file:${key}`,
  });
  const meeting = await createMeetingCommand({
    userId: input.userId,
    workFileId: Number(workFile.id),
    title: `اجتماع مع المهندس ${person} من ${organization} — تصور الفلل الأربع`,
    objective: evidence.topic,
    meetingType: "consultant_discussion",
    meetingFormat: "in_person",
    meetingStatus: "confirmed",
    startsAt: evidence.startsAt,
    location: evidence.location,
    participantNames: [`المهندس ${person} — ${organization}`, "Abdalrahman Zaqout", "Wael Zooma"],
    idempotencyKey: `confirmed-meeting:${key}`,
  });
  if (email.inboxStatus !== "linked") {
    await linkEmailToWorkFileCommand({ userId: input.userId, emailId: Number(email.id), projectId: project.id, workFileId: Number(workFile.id), suppressReplyDraft: true });
  }
  const preparationActionId = await ensureConfirmedMeetingPreparation({ userId: input.userId, meetingId: Number(meeting.id), workFileId: Number(workFile.id), evidence });
  return { replayed: false as const, meetingId: Number(meeting.id), workFileId: Number(workFile.id), preparationActionId, externalSideEffect: false as const };
}

export async function reconcileConfirmedMeetingsFromEmailCommand(input: { userId: number; limit?: number }) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const rows = await db.select({ id: comoNextEmailMessages.id }).from(comoNextEmailMessages).where(and(
    eq(comoNextEmailMessages.userId, input.userId),
    or(eq(comoNextEmailMessages.inboxStatus, "unmatched"), eq(comoNextEmailMessages.inboxStatus, "suggested")),
  )).orderBy(desc(comoNextEmailMessages.receivedAt), desc(comoNextEmailMessages.id)).limit(Math.max(1, Math.min(input.limit || 100, 200)));
  const results = [];
  for (const row of rows) {
    const result = await reconcileConfirmedMeetingEmailCommand({ userId: input.userId, emailId: Number(row.id) });
    if (!("skipped" in result)) results.push(result);
  }
  return { reconciled: results.length, results, externalSideEffect: false as const };
}

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
  const candidateUids = [...new Set(batch.messages.map(message => message.uid))];
  const candidateHashes = [...new Set(batch.messages.map(message => messageIdentitySha(message, batch.uidValidity)))];
  const existingRows = candidateUids.length ? await db.select({
    folderName: comoNextEmailMessages.folderName,
    uidValidity: comoNextEmailMessages.uidValidity,
    imapUid: comoNextEmailMessages.imapUid,
    messageIdSha256: comoNextEmailMessages.messageIdSha256,
  }).from(comoNextEmailMessages).where(and(
    eq(comoNextEmailMessages.mailboxKey, mailboxKey),
    or(
      and(eq(comoNextEmailMessages.folderName, folderName), eq(comoNextEmailMessages.uidValidity, batch.uidValidity), inArray(comoNextEmailMessages.imapUid, candidateUids)),
      inArray(comoNextEmailMessages.messageIdSha256, candidateHashes),
    ),
  )) : [];
  const knownUids = new Set(existingRows.filter(row => row.folderName === folderName && row.uidValidity === batch.uidValidity).map(row => Number(row.imapUid)));
  const knownHashes = new Set(existingRows.map(row => row.messageIdSha256));
  let imported = 0;
  let duplicates = 0;
  let suggested = 0;
  let unmatched = 0;
  let autoLinked = 0;
  const importedIds: number[] = [];

  // Persist older UIDs first: if an import fails, the next cursor must not
  // advance past an unimported message from the same mailbox batch.
  for (const message of [...batch.messages].sort((a, b) => a.uid - b.uid)) {
    const identitySha = messageIdentitySha(message, batch.uidValidity);
    if (knownUids.has(message.uid) || knownHashes.has(identitySha)) { duplicates += 1; continue; }

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
    knownUids.add(message.uid);
    knownHashes.add(identitySha);
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
  const db = await getDb();
  if (!db) databaseUnavailable();
  const mailboxKey = mailboxKeyFor(getConfiguredMailboxAddress());
  const cursorFor = async (folderName: string) => {
    const [latest] = await db.select({ lastUid: comoNextEmailMessages.imapUid, uidValidity: comoNextEmailMessages.uidValidity })
      .from(comoNextEmailMessages)
      .where(and(eq(comoNextEmailMessages.userId, input.userId), eq(comoNextEmailMessages.mailboxKey, mailboxKey), eq(comoNextEmailMessages.folderName, folderName)))
      .orderBy(desc(comoNextEmailMessages.imapUid)).limit(1);
    return latest ? { lastUid: Number(latest.lastUid), uidValidity: latest.uidValidity } : undefined;
  };
  const [inboxCursor, sentCursor] = await Promise.all([cursorFor("INBOX"), cursorFor("Sent")]);
  const [inboxBatch, sentBatch] = await Promise.all([
    fetchReadonlyInboxSince(input.hours, input.maxMessages, inboxCursor),
    fetchReadonlySentSince(input.hours, input.maxMessages, sentCursor),
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

/** A suggestion alone is not authority to link private attachments. A uniquely
 * established inbound sender AND a distinctive match to that same file are. */
export function trustedSenderFileMatch(input: {
  folderName: string;
  inboxStatus: string;
  suggestedProjectId: number | null;
  suggestedWorkFileId: number | null;
  suggestionReason: string | null;
  previousLinkedFiles: Array<{ projectId: number | null; workFileId: number | null }>;
}) {
  if (input.folderName !== "INBOX" || input.inboxStatus !== "suggested"
    || !input.suggestedProjectId || !input.suggestedWorkFileId
    || !input.suggestionReason?.includes("معرّف مميز لملف العمل ظاهر")) return false;
  return input.previousLinkedFiles.length > 0 && input.previousLinkedFiles.every(row =>
    row.projectId === input.suggestedProjectId && row.workFileId === input.suggestedWorkFileId);
}

async function linkFromTrustedSenderBeforeAnalysis(userId: number, emailId: number) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const [email] = await db.select().from(comoNextEmailMessages).where(and(
    eq(comoNextEmailMessages.id, emailId), eq(comoNextEmailMessages.userId, userId),
  )).limit(1);
  if (!email || email.folderName !== "INBOX" || email.inboxStatus !== "suggested"
    || !email.suggestedProjectId || !email.suggestedWorkFileId) return false;
  const previousLinkedFiles = await db.select({
    projectId: comoNextEmailMessages.linkedProjectId,
    workFileId: comoNextEmailMessages.linkedWorkFileId,
  }).from(comoNextEmailMessages).where(and(
    eq(comoNextEmailMessages.userId, userId), eq(comoNextEmailMessages.folderName, "INBOX"),
    eq(comoNextEmailMessages.fromEmail, email.fromEmail),
    isNotNull(comoNextEmailMessages.linkedWorkFileId),
    lt(comoNextEmailMessages.receivedAt, email.receivedAt),
  )).limit(50);
  if (!trustedSenderFileMatch({
    folderName: email.folderName, inboxStatus: email.inboxStatus,
    suggestedProjectId: email.suggestedProjectId,
    suggestedWorkFileId: email.suggestedWorkFileId,
    suggestionReason: email.suggestionReason,
    previousLinkedFiles,
  })) return false;
  await linkEmailToWorkFileCommand({ userId, emailId, projectId: email.suggestedProjectId,
    workFileId: email.suggestedWorkFileId, projectPartyId: email.suggestedProjectPartyId,
    suppressReplyDraft: true });
  return true;
}

/** Progress only a fresh, file-linked *internal Manus* action. Owner decisions,
 * deferred files, replies, drafts, payments and appointments never pass here. */
async function applyCurrentInternalProposal(userId: number, emailId: number) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const [email] = await db.select().from(comoNextEmailMessages).where(and(
    eq(comoNextEmailMessages.id, emailId), eq(comoNextEmailMessages.userId, userId),
  )).limit(1);
  if (!email || email.folderName !== "INBOX" || !email.linkedWorkFileId
    || Date.now() - parseStoredUtc(email.receivedAt).getTime() > 48 * 60 * 60_000) return null;
  const [file] = await db.select({ status: comoNextWorkFiles.workFileStatus }).from(comoNextWorkFiles)
    .where(and(eq(comoNextWorkFiles.id, email.linkedWorkFileId), eq(comoNextWorkFiles.userId, userId))).limit(1);
  if (!file || file.status !== "open") return null;
  const [ownerGate] = await db.select({ id: comoNextDecisions.id }).from(comoNextDecisions).where(and(
    eq(comoNextDecisions.workFileId, email.linkedWorkFileId),
    or(eq(comoNextDecisions.decisionStatus, "required"),
      and(eq(comoNextDecisions.decisionStatus, "deferred"), sql`${comoNextDecisions.dueAt} > UTC_TIMESTAMP()`)),
  )).limit(1);
  if (ownerGate) return null;
  const [alreadyOwned] = await db.select({ id: comoNextActions.id }).from(comoNextActions).where(and(
    eq(comoNextActions.workFileId, email.linkedWorkFileId), eq(comoNextActions.ownerType, "manus"),
    inArray(comoNextActions.actionStatus, ["open", "in_progress", "waiting_external", "completed_pending_verification"]),
  )).limit(1);
  if (alreadyOwned) return null;
  const proposals = await db.select().from(comoNextIntakeProposals).where(and(
    eq(comoNextIntakeProposals.userId, userId), eq(comoNextIntakeProposals.sourceEmailId, emailId),
    eq(comoNextIntakeProposals.reviewStatus, "pending"), eq(comoNextIntakeProposals.proposalKind, "action"),
    eq(comoNextIntakeProposals.ownerType, "manus"),
  )).orderBy(desc(comoNextIntakeProposals.id)).limit(2);
  // A single unambiguous next step only; multi-proposal analyses remain reviewable.
  if (proposals.length !== 1) return null;
  const proposal = proposals[0];
  if (proposal.channel && proposal.channel !== "internal") return null;
  if (/(?:إرسال|أرسل|ارسل|رسالة|مراسلة|بريد|مسودة|دفع|سداد|توقيع|تعيين|send|reply|draft|email|pay|sign|appoint)/i
    .test(`${proposal.title} ${proposal.content || ""} ${proposal.acceptanceCriteria || ""}`)) return null;
  const result = await reviewIntakeProposalCommand({ userId, proposalId: Number(proposal.id),
    decision: "apply", reviewNote: `AUTO_MANUS: عمل تحليلي داخلي فقط من البريد المربوط #${emailId}؛ لا التزام خارجي.` });
  return result.targetId ? Number(result.targetId) : null;
}

/** Run on a separate heartbeat, never inside the IMAP callback. A failed
 * analysis remains pending and its stable requestKey makes retries safe. */
export async function processPendingReadonlyMailboxCommand(input: { userId: number; analysisLimit?: number }) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const pending = await db.execute(sql`
    SELECT email_row.id
    FROM como_next_email_messages email_row
    WHERE email_row.user_id = ${input.userId}
      AND email_row.inbox_status <> 'dismissed'
      AND NOT EXISTS (
        SELECT 1 FROM como_next_email_analyses analysis_row
        WHERE analysis_row.email_message_id = email_row.id AND analysis_row.analysis_status = 'draft'
      )
    ORDER BY email_row.received_at DESC, email_row.id DESC
    LIMIT ${Math.max(1, Math.min(input.analysisLimit || 1, 2))}
  `);
  const ids = rowsOf<{ id: number }>(pending).map(row => Number(row.id));
  let analyzed = 0;
  let analysisFailures = 0;
  let trustedLinked = 0;
  for (const emailId of ids) {
    try {
      if (await linkFromTrustedSenderBeforeAnalysis(input.userId, emailId)) trustedLinked += 1;
      await analyzeEmailCommand({ userId: input.userId, emailId, requestKey: `mailbox-context-v1:${emailId}`, suppressReplyDraft: true, model: "gemini-3-flash-preview" });
      analyzed += 1;
    } catch (error) {
      analysisFailures += 1;
      const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code: unknown }).code) : error instanceof Error ? error.name : "unknown";
      console.error(`[COMO email processing] email ${emailId} remains pending (${code})`);
    }
  }
  // Do not mark the batch successful when any candidate remains unprocessed.
  if (analysisFailures) throw new Error(`email_analysis_failed:${analysisFailures}`);
  // Retryable independently of the LLM analysis: a transient proposal-write
  // failure must not disappear because the draft analysis is already durable.
  const recentLinked = await db.select({ id: comoNextEmailMessages.id }).from(comoNextEmailMessages)
    .innerJoin(comoNextIntakeProposals, eq(comoNextIntakeProposals.sourceEmailId, comoNextEmailMessages.id)).where(and(
    eq(comoNextEmailMessages.userId, input.userId), eq(comoNextEmailMessages.folderName, "INBOX"),
    isNotNull(comoNextEmailMessages.linkedWorkFileId),
    eq(comoNextIntakeProposals.reviewStatus, "pending"),
    eq(comoNextIntakeProposals.proposalKind, "action"),
    eq(comoNextIntakeProposals.ownerType, "manus"),
    sql`${comoNextEmailMessages.receivedAt} >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 48 HOUR)`,
  )).orderBy(desc(comoNextEmailMessages.receivedAt), desc(comoNextEmailMessages.id)).limit(3);
  const internalActionIds: number[] = [];
  for (const emailId of new Set(recentLinked.map(row => Number(row.id)))) {
    const nextActionId = await applyCurrentInternalProposal(input.userId, emailId);
    if (nextActionId) internalActionIds.push(nextActionId);
  }
  return { analyzed, pendingCandidates: ids.length, analysisFailures, trustedLinked, internalActionIds, externalSideEffects: false as const };
}

/** A historical email can be summarized, but must not reopen a closed file through proposals. */
export function canProposeForWorkFile(status: string | null | undefined) {
  return !!status && !["closed", "cancelled"].includes(status);
}

export async function syncAndAnalyzeReadonlyMailboxCommand(input: { userId: number; hours: number; maxMessages: number; analysisLimit?: number }) {
  const result = await syncReadonlyInboxCommand(input);
  const meetingReconciliation = await reconcileConfirmedMeetingsFromEmailCommand({ userId: input.userId, limit: 100 });
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
  const executiveControl = await runExecutiveControlLoopCommand({ userId: input.userId, trigger: "email_sync", scanPending: true, maxItems: 2 });
  return { ...result, analyzed, analysisFailures, meetingReconciliation, executiveControl };
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

export async function linkEmailToWorkFileCommand(input: { userId: number; emailId: number; projectId: number; workFileId: number; projectPartyId?: number | null; suppressReplyDraft?: boolean }) {
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
  const [latestAnalysis] = isSent ? [] : await db.select({ replyDraftText: comoNextEmailAnalyses.replyDraftText })
    .from(comoNextEmailAnalyses)
    .where(and(eq(comoNextEmailAnalyses.emailMessageId, input.emailId), eq(comoNextEmailAnalyses.analysisStatus, "draft")))
    .orderBy(desc(comoNextEmailAnalyses.id))
    .limit(1);
  const replyDraft = !input.suppressReplyDraft && latestAnalysis?.replyDraftText
    ? await createReplyDraftFromEmailCommand({ userId: input.userId, emailId: input.emailId, body: latestAnalysis.replyDraftText })
    : null;
  return { ...linked, reconciliation, replyDraftId: replyDraft ? Number(replyDraft.id) : null };
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
- كل رسالة واردة بشرية/مهنية من طرف مشروع تحتاج ردًا مهنيًا: اجعل shouldReply=true واكتب replyDraftText كاملًا بلغة الرسالة، حتى لو كان الرد مجرد تأكيد استلام وخطوة تالية منضبطة. الاستثناء فقط رسالة نظام/no-reply أو رسالة يثبت السياق أن عبد الرحمن أجاب عنها لاحقًا.
- لا تعد في المسودة بقبول أو تعيين أو دفع أو موعد غير مثبت. ثبّت الاستلام، أجب عما يمكن، واذكر بوضوح ما هو قيد المراجعة أو ما المطلوب من الطرف.
- عند توقيع أي مسودة إنجليزية، اكتب الاسم حصراً هكذا: Abdalrahman Zaqout. لا تستخدم Abdulrahman أو Abdul Rahman.
- كل مقترح يبقى review-only ولا يغير أي حالة تشغيلية.`;
}

export function normalizeOwnerEmailSignature(body: string) {
  const lines = String(body || "").trim().split("\n");
  const signatureWindow = Math.max(0, lines.length - 12);
  for (let index = signatureWindow; index < lines.length; index += 1) {
    if (/^\s*(?:abdul\s*rahman|abdulrahman|abdalrahman)(?:\s+zaqout)?\s*$/i.test(lines[index] || "")) {
      lines[index] = "Abdalrahman Zaqout";
    }
  }
  return lines.join("\n").trim();
}

function recipientAddress(value: string) {
  return value.match(/<([^>]+@[^>]+)>/)?.[1]?.trim().toLowerCase()
    || value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]?.toLowerCase()
    || value.trim().toLowerCase();
}

export function buildReplyAllCc(input: {
  fromEmail: string;
  toText?: string | null;
  ccText?: string | null;
  explicitCcText?: string | null;
  ownerEmail?: string;
}) {
  const primary = input.fromEmail.trim().toLowerCase();
  const owner = (input.ownerEmail || process.env.EMAIL_USER || "a.zaqout@comodevelopments.com").trim().toLowerCase();
  const recipients = [input.toText, input.ccText, input.explicitCcText]
    .flatMap(value => String(value || "").split(/[;,]/))
    .map(value => value.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  return recipients.filter(recipient => {
    const address = recipientAddress(recipient);
    if (!address || address === primary || address === owner || seen.has(address)) return false;
    seen.add(address);
    return true;
  }).join(", ") || null;
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

export async function analyzeEmailCommand(input: { userId: number; emailId: number; requestKey: string; suppressReplyDraft?: boolean; model?: string }) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const [email] = await db.select().from(comoNextEmailMessages).where(and(eq(comoNextEmailMessages.id, input.emailId), eq(comoNextEmailMessages.userId, input.userId))).limit(1);
  if (!email) throw new TRPCError({ code: "NOT_FOUND", message: "لم يُعثر على الرسالة" });
  const negotiationNeedsOwnerAgreement = isContractNegotiationEmail(email.subject, email.bodyText);
  const [existing] = await db.select({ id: comoNextEmailAnalyses.id, replyDraftText: comoNextEmailAnalyses.replyDraftText }).from(comoNextEmailAnalyses).where(eq(comoNextEmailAnalyses.requestKey, input.requestKey)).limit(1);
  if (existing) {
    const replyDraft = !input.suppressReplyDraft && !negotiationNeedsOwnerAgreement && email.folderName === "INBOX" && email.linkedWorkFileId && !email.replyDraftCommunicationId && existing.replyDraftText
      ? await createReplyDraftFromEmailCommand({ userId: input.userId, emailId: Number(email.id), body: existing.replyDraftText })
      : null;
    return { id: Number(existing.id), replayed: true as const, replyDraftId: replyDraft ? Number(replyDraft.id) : email.replyDraftCommunicationId ? Number(email.replyDraftCommunicationId) : null };
  }
  const context = await loadEmailAnalysisContext(db, email);
  const response = await invokeLLM({
    model: input.model || EMAIL_ANALYSIS_MODEL,
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
  const scheduleAcknowledgement = isMeetingScheduleAcknowledgement(email);
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
      replyDraftText: !scheduleAcknowledgement && parsed.shouldReply && parsed.replyDraftText ? normalizeOwnerEmailSignature(String(parsed.replyDraftText)) : null,
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
    const [linkedFile] = await db.select({ status: comoNextWorkFiles.workFileStatus }).from(comoNextWorkFiles)
      .where(and(eq(comoNextWorkFiles.id, Number(email.linkedWorkFileId)),
        eq(comoNextWorkFiles.projectId, Number(email.linkedProjectId)),
        eq(comoNextWorkFiles.userId, input.userId))).limit(1);
    if (!linkedFile) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "ملف الرسالة المرتبط لم يعد متاحًا" });
    if (canProposeForWorkFile(linkedFile.status)) {
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
  }
  const reconciliation = email.folderName === "INBOX" && email.linkedWorkFileId
    ? await reconcileWorkFileEvidenceCommand({ userId: input.userId, workFileId: Number(email.linkedWorkFileId), triggerEmailId: Number(email.id) }).catch(error => ({ error: error instanceof Error ? error.message : String(error), changed: 0, nextActionId: null, externalSideEffect: false as const }))
    : null;
  const replyDraft = !input.suppressReplyDraft && !negotiationNeedsOwnerAgreement && !scheduleAcknowledgement && email.folderName === "INBOX" && email.linkedWorkFileId && parsed.shouldReply && String(parsed.replyDraftText || "").trim()
    ? await createReplyDraftFromEmailCommand({ userId: input.userId, emailId: Number(email.id), body: normalizeOwnerEmailSignature(String(parsed.replyDraftText)) })
    : null;
  return { ...analysisResult, proposalCount: proposalResult.ids.length, proposalsCreated: proposalResult.created, reconciliation, replyDraftId: replyDraft ? Number(replyDraft.id) : null };
}

export async function createReplyDraftFromEmailCommand(input: { userId: number; emailId: number; body: string; ccText?: string | null }) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const [email] = await db.select().from(comoNextEmailMessages).where(and(eq(comoNextEmailMessages.id, input.emailId), eq(comoNextEmailMessages.userId, input.userId))).limit(1);
  if (!email) throw new TRPCError({ code: "NOT_FOUND", message: "لم يُعثر على الرسالة" });
  if (!email.linkedWorkFileId || !email.linkedProjectId) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "اربط الرسالة بملف العمل قبل إنشاء مسودة الرد" });
  if (email.folderName !== "INBOX") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "الرسالة صادرة ولا تحتاج مسودة رد" });
  const normalizedBody = normalizeOwnerEmailSignature(input.body);
  const [latestAnalysis] = await db.select({ id: comoNextEmailAnalyses.id }).from(comoNextEmailAnalyses)
    .where(and(eq(comoNextEmailAnalyses.emailMessageId, input.emailId), eq(comoNextEmailAnalyses.analysisStatus, "draft")))
    .orderBy(desc(comoNextEmailAnalyses.id)).limit(1);
  if (latestAnalysis) {
    await db.update(comoNextEmailAnalyses).set({ replyDraftText: normalizedBody }).where(eq(comoNextEmailAnalyses.id, latestAnalysis.id));
  }
  if (email.replyDraftCommunicationId) return { id: Number(email.replyDraftCommunicationId), replayed: true as const, sent: false as const };
  const draft = await createCommunicationDraftCommand({
    userId: input.userId,
    workFileId: email.linkedWorkFileId,
    channel: "email",
    subject: /^\s*re:/i.test(email.subject) ? email.subject : `Re: ${email.subject}`,
    body: normalizedBody,
    toText: email.fromEmail,
    ccText: buildReplyAllCc({
      fromEmail: email.fromEmail,
      toText: email.toText,
      ccText: email.ccText,
      explicitCcText: input.ccText,
    }),
    idempotencyKey: `email-reply-draft:${email.id}`,
  });
  const mailboxRef = "mailboxDraft" in draft && draft.mailboxDraft?.uid
    ? `${draft.mailboxDraft.folder} UID ${draft.mailboxDraft.uid}`
    : "Private Email Drafts";
  await db.update(comoNextEmailMessages).set({
    replyDraftCommunicationId: draft.id,
    suggestionReason: `مسودة الرد محفوظة في ${mailboxRef}؛ المراجعة والإرسال من تطبيق البريد.`.slice(0, 4000),
  }).where(eq(comoNextEmailMessages.id, email.id));
  return { id: Number(draft.id), replayed: draft.replayed, sent: false as const, mailboxDraft: "mailboxDraft" in draft ? draft.mailboxDraft : null };
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
