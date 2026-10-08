import { createHash } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { comoNextEmailSyncSettings, comoNextSaraBriefingDeliveries } from "../../drizzle/schema";
import { getDb } from "../db";
import { resolveOwnerUserIdForSara } from "./comoNextIntake";
import { saraDubaiTimestamp } from "./saraDubaiTimes";
import { COMO_MAIL_STAGE_STALE_MS } from "./saraMailFreshness";

export type SaraBriefingMode = "auto" | "full" | "today" | "changes";
export type SaraBriefingKind = Exclude<SaraBriefingMode, "auto">;
export type SaraBriefingPeriod = "morning" | "day" | "evening";

type BriefingItem = {
  kind: "action" | "decision" | "meeting" | "proposal" | "communication" | "email";
  id: number;
  project: string | null;
  workFile: string | null;
  title: string;
  groupKey?: string | null;
  priority: string | null;
  status: string | null;
  dueAt: string | null;
  updatedAt: string | null;
  createdAt?: string | null;
  sourceRecordId?: string | null;
};

type ChangeItem = {
  kind: string;
  id: number;
  project: string | null;
  workFile: string | null;
  title: string;
  occurredAt: string;
};

type WorkFileSummary = {
  id: number;
  project: string;
  title: string;
  status: string;
  priority: string;
};

type BriefingSnapshot = {
  workFiles: WorkFileSummary[];
  actions: BriefingItem[];
  decisions: BriefingItem[];
  meetings: BriefingItem[];
  proposals: BriefingItem[];
  communications: BriefingItem[];
  emails: BriefingItem[];
  changes: ChangeItem[];
  dayEvents: ChangeItem[];
};

const DUBAI_OFFSET_MS = 4 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function rows<T>(result: unknown): T[] {
  if (Array.isArray(result) && Array.isArray(result[0])) return result[0] as T[];
  return result as T[];
}

function toSqlTimestamp(value: Date) {
  return value.toISOString().slice(0, 19).replace("T", " ");
}

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const normalized = /Z$|[+-]\d{2}:?\d{2}$/.test(value) ? value : `${value.replace(" ", "T")}Z`;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Email confirmations that carry a new date create a separate, evidence-bound
 * meeting row. Until reconciliation can merge those rows safely, Sara uses
 * the latest dated evidence, not the furthest slot: reschedules can move a
 * meeting earlier. Manually created meetings and different titles stay apart.
 */
export function selectSaraLatestMeetingSchedule<T extends {
  id: number;
  project?: string | null;
  workFile?: string | null;
  workFileId?: number | null;
  title?: string | null;
  sourceRecordId?: string | null;
  dueAt?: string | null;
  startsAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}>(meetings: T[]) {
  const emailMeetingKey = (meeting: T) => {
    if (!meeting.sourceRecordId?.startsWith("confirmed-meeting:")) return null;
    const title = String(meeting.title || "").toLocaleLowerCase("en-US").replace(/\s+/g, " ").trim();
    const project = String(meeting.project || "").toLocaleLowerCase("en-US").replace(/\s+/g, " ").trim();
    const file = meeting.workFileId != null ? `id:${meeting.workFileId}`
      : String(meeting.workFile || "").toLocaleLowerCase("en-US").replace(/\s+/g, " ").trim();
    return title && project && file ? `${project}\u0000${file}\u0000${title}` : null;
  };
  const scheduledTime = (meeting: T) => parseDate(meeting.dueAt || meeting.startsAt)?.getTime()
    ?? Number.MIN_SAFE_INTEGER;
  const noticeTime = (meeting: T) => parseDate(meeting.createdAt)?.getTime()
    ?? parseDate(meeting.updatedAt)?.getTime()
    ?? Number.MIN_SAFE_INTEGER;
  const latestByAppointment = new Map<string, T>();
  const unchanged: T[] = [];
  for (const meeting of meetings) {
    const key = emailMeetingKey(meeting);
    if (!key) {
      unchanged.push(meeting);
      continue;
    }
    const current = latestByAppointment.get(key);
    if (!current || noticeTime(meeting) > noticeTime(current)
      || (noticeTime(meeting) === noticeTime(current) && scheduledTime(meeting) > scheduledTime(current))
      || (noticeTime(meeting) === noticeTime(current) && scheduledTime(meeting) === scheduledTime(current) && meeting.id > current.id)) {
      latestByAppointment.set(key, meeting);
    }
  }
  return [...unchanged, ...Array.from(latestByAppointment.values())];
}

export function getSaraDubaiWindow(now = new Date()) {
  const dubaiNow = new Date(now.getTime() + DUBAI_OFFSET_MS);
  const startUtc = Date.UTC(
    dubaiNow.getUTCFullYear(),
    dubaiNow.getUTCMonth(),
    dubaiNow.getUTCDate(),
    0,
    0,
    0,
    0,
  ) - DUBAI_OFFSET_MS;
  const hour = dubaiNow.getUTCHours();
  const period: SaraBriefingPeriod = hour >= 17 ? "evening" : hour >= 11 ? "day" : "morning";
  return {
    period,
    start: new Date(startUtc),
    end: new Date(startUtc + DAY_MS - 1),
    nextThreeDays: new Date(startUtc + 4 * DAY_MS - 1),
  };
}

export function chooseSaraAutoMode(input: {
  period: SaraBriefingPeriod;
  hasFullToday: boolean;
  hasEveningFull: boolean;
  changesCount: number;
}): SaraBriefingKind {
  if (!input.hasFullToday) return "full";
  if (input.period === "evening" && !input.hasEveningFull) return "full";
  return "changes";
}

function priorityRank(priority: string | null) {
  return priority === "urgent" ? 0 : priority === "important" ? 1 : 2;
}

export function rankSaraBriefingItem(item: BriefingItem, now: Date, dayEnd: Date) {
  const due = parseDate(item.dueAt);
  const temporalRank = due && due.getTime() < now.getTime()
    ? 0
    : due && due.getTime() <= dayEnd.getTime()
      ? 1
      : due && due.getTime() <= dayEnd.getTime() + (2 * DAY_MS)
        ? 2
        : item.kind === "decision" || item.kind === "proposal" || item.kind === "email"
          ? 3
          : item.priority === "urgent" || item.priority === "important"
            ? 4
            : 5;
  const consequenceRank = item.kind === "decision"
    ? 0
    : item.status === "completed_pending_verification"
      ? 1
      : item.kind === "meeting"
        ? 2
        : item.kind === "action"
          ? 3
          : 4;
  return [temporalRank, consequenceRank, priorityRank(item.priority), due?.getTime() ?? Number.MAX_SAFE_INTEGER, item.id] as const;
}

function compareRank(a: BriefingItem, b: BriefingItem, now: Date, dayEnd: Date) {
  const left = rankSaraBriefingItem(a, now, dayEnd);
  const right = rankSaraBriefingItem(b, now, dayEnd);
  for (let index = 0; index < left.length; index += 1) {
    const delta = Number(left[index]) - Number(right[index]);
    if (delta) return delta;
  }
  return 0;
}

function formatDue(value: string | null, now: Date, dayEnd: Date) {
  const due = parseDate(value);
  if (!due) return "";
  if (due.getTime() < now.getTime()) return "، ومتأخر";
  if (due.getTime() <= dayEnd.getTime()) {
    return `، اليوم الساعة ${due.toLocaleTimeString("ar-AE", { timeZone: "Asia/Dubai", hour: "numeric", minute: "2-digit" })}`;
  }
  return `، ${due.toLocaleDateString("ar-AE", { timeZone: "Asia/Dubai", weekday: "short", day: "numeric", month: "short" })}`;
}

function spokenItem(item: BriefingItem, now: Date, dayEnd: Date) {
  const project = item.project ? `بـ${item.project}` : "";
  if (item.status === "needs_meeting_outcome" || item.status === "needs_meeting_confirmation") {
    return `${item.title}${project ? ` ${project}` : ""}`;
  }
  return `${item.title}${project ? ` ${project}` : ""}${formatDue(item.dueAt, now, dayEnd)}`;
}

function isTodayAttention(item: BriefingItem, now: Date, dayEnd: Date) {
  const due = parseDate(item.dueAt);
  if (item.status === "needs_meeting_outcome" || item.status === "needs_meeting_confirmation") return true;
  if (item.status === "completed_pending_verification") return true;
  if (due) return due.getTime() <= dayEnd.getTime();
  return item.priority === "urgent";
}

function dedupeAttention(items: BriefingItem[]) {
  const seen = new Set<string>();
  return items.filter(item => {
    const normalizedTitle = (item.groupKey || item.title)
      .toLowerCase()
      .replace(/^\s*((re|fw|fwd)\s*:\s*)+/i, "")
      .replace(/\s+/g, " ")
      .trim();
    const key = item.kind === "email" ? `email:${normalizedTitle}` : `${item.kind}:${item.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function collapseSaraAttentionByTopic(items: BriefingItem[], now: Date, dayEnd: Date) {
  const sorted = [...items].sort((a, b) => compareRank(a, b, now, dayEnd));
  const grouped = new Map<string, BriefingItem[]>();
  for (const item of sorted) {
    const key = item.workFile ? `work:${item.workFile}` : item.project ? `project:${item.project}:${item.kind}` : `${item.kind}:${item.id}`;
    const current = grouped.get(key) || [];
    current.push(item);
    grouped.set(key, current);
  }
  return [...grouped.values()].map(group => {
    const first = group[0];
    if (group.length === 1) return first;
    return {
      ...first,
      title: `${first.workFile || first.project || "موضوع"}: ${group.length} نقاط تحتاج حركة؛ أولها ${first.title}`,
    };
  });
}

function dedupeChanges(items: ChangeItem[]) {
  const seen = new Set<string>();
  return items
    .sort((a, b) => (parseDate(b.occurredAt)?.getTime() ?? 0) - (parseDate(a.occurredAt)?.getTime() ?? 0))
    .filter(item => {
      const key = `${item.kind}:${item.id}:${item.title}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function section(label: string, items: string[]) {
  if (!items.length) return "";
  return `${label}\n${items.map((item, index) => `${index + 1}. ${item}`).join("\n")}`;
}

function projectPicture(workFiles: WorkFileSummary[]) {
  const grouped = new Map<string, { count: number; urgent: number; waiting: number }>();
  for (const file of workFiles) {
    const current = grouped.get(file.project) || { count: 0, urgent: 0, waiting: 0 };
    current.count += 1;
    if (file.priority === "urgent") current.urgent += 1;
    if (file.status === "waiting" || file.status === "blocked") current.waiting += 1;
    grouped.set(file.project, current);
  }
  return [...grouped.entries()].map(([project, value]) => {
    const details = [
      `${value.count} ملفات مفتوحة`,
      value.urgent ? `${value.urgent} عاجلة` : "",
      value.waiting ? `${value.waiting} بانتظار أو عالقة` : "",
    ].filter(Boolean).join("، ");
    return `${project}: ${details}`;
  });
}

export function buildNarration(kind: SaraBriefingKind, period: SaraBriefingPeriod, snapshot: BriefingSnapshot, now: Date) {
  const { end, nextThreeDays } = getSaraDubaiWindow(now);
  const currentMeetings = selectSaraLatestMeetingSchedule(snapshot.meetings);
  const pastMeetings: BriefingItem[] = currentMeetings
    .filter(item => {
      const starts = parseDate(item.dueAt);
      return Boolean(starts && starts.getTime() < now.getTime());
    })
    .map(item => ({
      ...item,
      kind: "action",
      status: item.status === "confirmed" ? "needs_meeting_outcome" : "needs_meeting_confirmation",
      title: item.status === "confirmed"
        ? `نتيجة ${item.title}: تحقق هل انعقد الاجتماع أو تغير موعده، وسجل ما حدث`
        : `تأكد من ${item.title}: الموعد السابق مضى؛ تحقق هل تأكد أو تغير`,
    }));
  const futureMeetings = currentMeetings.filter(item => {
    const starts = parseDate(item.dueAt);
    return Boolean(starts && starts.getTime() >= now.getTime());
  });
  const allAttention = dedupeAttention([
    ...snapshot.actions,
    ...snapshot.decisions,
    ...pastMeetings,
    ...futureMeetings,
    ...snapshot.proposals,
    ...snapshot.communications,
    ...snapshot.emails,
  ]).sort((a, b) => compareRank(a, b, now, end));
  const today = collapseSaraAttentionByTopic(allAttention.filter(item => isTodayAttention(item, now, end)), now, end);
  const todayOperational = today.filter(item => item.kind !== "meeting");
  const upcomingMeetings = futureMeetings
    .filter(item => {
      const due = parseDate(item.dueAt);
      return Boolean(due && due.getTime() <= nextThreeDays.getTime());
    })
    .sort((a, b) => compareRank(a, b, now, end));

  if (kind === "changes") {
    const changes = snapshot.changes.slice(0, 8);
    const remainingChanges = Math.max(0, snapshot.changes.length - changes.length);
    if (!snapshot.changes.length) {
      return {
        title: "ما الجديد؟",
        itemCount: 0,
        text: "أهلين. ما في أي تغيير جوهري من آخر مرة حكينا فيها، والوضع ماشي على نفس الخطة. إذا بتحب، منمرق سوا على شغل اليوم.",
      };
    }
    return {
      title: "ما الجديد؟",
      itemCount: changes.length,
      text: [
        `صار عندك ${snapshot.changes.length} تحديث${snapshot.changes.length === 1 ? "" : "ات"} من آخر مرة. خلّيني أبلّش بالأهم:`,
        "---",
        ...changes.map((item, index) => `${index + 1}. ${item.title}${item.project ? ` بـ${item.project}` : ""}.`),
        "---",
        remainingChanges ? `وفي ${remainingChanges} تحديثات أقل إلحاحًا؛ إذا قلتلي كمّلي، منكفّيهم سوا.` : "هيك منكون لحقنا الجديد من دون ما أعيد عليك النشرة كلها. بدك نفوت بتفصيل وحدة منهم؟",
      ].join("\n"),
    };
  }

  if (kind === "today") {
    const items = today.slice(0, 10);
    const remainingToday = Math.max(0, today.length - items.length);
    if (!today.length) {
      return {
        title: "أعمال اليوم",
        itemCount: 0,
        text: "شغل اليوم هادئ وما عندك شي مستحق فورًا. منضل عيننا على الانتظارات والمواعيد الجاية، وإذا استجد شي بخبرك دغري.",
      };
    }
    return {
      title: "أعمال اليوم",
      itemCount: items.length,
      text: [
        `عندك اليوم ${today.length} موضوع${today.length === 1 ? "" : "ات"}. رتبتلك ياهم حسب الوقت والأثر، مش حسب مين صوته أعلى:`,
        "---",
        ...items.map((item, index) => `${index + 1}. ${spokenItem(item, now, end)}.`),
        "---",
        remainingToday ? `هيدي أول عشرة، وبقي ${remainingToday} أقل إلحاحًا. منمسك الأول أو بتقلي كمّلي؟` : `الأول اللي لازم نمسكه هو: ${items[0]?.title}. منبلّش فيه؟`,
      ].join("\n"),
    };
  }

  const intro = period === "evening"
    ? "مساء الخير. خلّيني سكّرلك اليوم على رواقة: شو صار، شو بعده مفتوح، وشو لازم يسبقنا بكرا."
    : period === "morning"
      ? "صباح الخير. جهّزتلك الصورة كاملة ومرتبتها، وهيك منبلّش النهار وإنت ماسك الخيط من أوله."
      : "أهلين. هاي الصورة الكاملة هلق، مرتبتلك ياها من الأقرب والأثقل أثرًا.";
  const completedToday = period === "evening" ? snapshot.dayEvents.slice(0, 12).map(item => `${item.title}${item.project ? ` بـ${item.project}` : ""}`) : [];
  const decisions = snapshot.decisions.slice(0, 5).map(item => spokenItem(item, now, end));
  const reviews = [...snapshot.proposals, ...snapshot.emails, ...snapshot.communications]
    .sort((a, b) => compareRank(a, b, now, end))
    .slice(0, 5)
    .map(item => spokenItem(item, now, end));
  const sections = [
    completedToday.length ? section("أول شي، حصيلة اليوم:", completedToday) : "",
    section(`اللي بدّه حركة منك، ${todayOperational.length} بالمجموع:`, todayOperational.slice(0, 8).map(item => spokenItem(item, now, end))),
    section(`قراراتك المفتوحة، ${snapshot.decisions.length} بالمجموع:`, decisions),
    section(`مراجعات جاهزة عندك، ${snapshot.proposals.length + snapshot.emails.length + snapshot.communications.length} بالمجموع:`, reviews),
    section(`المواعيد القريبة، ${upcomingMeetings.length} بالمجموع:`, upcomingMeetings.slice(0, 5).map(item => spokenItem(item, now, end))),
    section("صورة المشاريع:", projectPicture(snapshot.workFiles)),
  ].filter(Boolean);
  const itemCount = today.length + decisions.length + reviews.length + upcomingMeetings.length + snapshot.workFiles.length;
  const ending = period === "evening"
    ? "هيدي الخلاصة. اللي ما خلص اليوم حطيته بترتيبه لبكرا، وما في شي رح نخبّيه تحت السجادة."
    : today[0]
      ? `ومن دون لف ودوران، أول ضربة اليوم هي: ${today[0].title}.`
      : "والوضع اليوم مرتاح، بس عيني على أي مستجد بيفوت.";
  return { title: period === "evening" ? "الخلاصة المسائية" : "الموجز الشامل", itemCount, text: [intro, ...sections.flatMap(value => ["---", value]), "---", ending].join("\n") };
}

async function loadLastCompletedDelivery(db: Awaited<ReturnType<typeof getDb>>, userId: number, memberId: string) {
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "قاعدة البيانات غير متاحة" });
  const [delivery] = await db.select().from(comoNextSaraBriefingDeliveries)
    .where(and(
      eq(comoNextSaraBriefingDeliveries.userId, userId),
      eq(comoNextSaraBriefingDeliveries.memberId, memberId),
      eq(comoNextSaraBriefingDeliveries.deliveryStatus, "completed"),
    ))
    .orderBy(desc(comoNextSaraBriefingDeliveries.completedAt), desc(comoNextSaraBriefingDeliveries.id))
    .limit(1);
  return delivery || null;
}

async function loadSnapshot(userId: number, since: Date, dayStart: Date): Promise<BriefingSnapshot> {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "قاعدة البيانات غير متاحة" });
  const sinceSql = toSqlTimestamp(since);
  const dayStartSql = toSqlTimestamp(dayStart);
  const [workFilesResult, actionsResult, decisionsResult, meetingsResult, proposalsResult, communicationsResult, emailsResult, eventsResult, updatesResult, changedActionsResult, changedDecisionsResult, changedMeetingsResult, changedEmailsResult, dayEventsResult] = await Promise.all([
    db.execute(sql`
      SELECT wf.id, p.name AS project, wf.title, wf.work_file_status AS status, wf.priority
      FROM como_next_work_files wf
      JOIN projects p ON p.id=wf.project_id AND p.is_test_project=0
      LEFT JOIN como_next_import_batches batch ON batch.batch_id=wf.import_batch_id
      WHERE wf.user_id=${userId} AND wf.work_file_status NOT IN ('closed','cancelled')
        AND (wf.import_batch_id IS NULL OR batch.batch_status='promoted')
      ORDER BY CASE wf.priority WHEN 'urgent' THEN 0 WHEN 'important' THEN 1 ELSE 2 END, wf.updated_at DESC
      LIMIT 50
    `),
    db.execute(sql`
      SELECT a.id, p.name AS project, wf.title AS workFile, a.title, a.priority,
        a.action_status AS status, COALESCE(a.attention_at,a.due_at,a.follow_up_at) AS dueAt, a.updated_at AS updatedAt
      FROM como_next_actions a
      JOIN como_next_work_files wf ON wf.id=a.work_file_id AND wf.project_id=a.project_id
      JOIN projects p ON p.id=a.project_id AND p.is_test_project=0
      WHERE a.user_id=${userId} AND wf.work_file_status NOT IN ('closed','cancelled')
        AND a.action_status NOT IN ('verified','cancelled')
        AND (a.attention_at IS NULL OR a.attention_at <= UTC_TIMESTAMP())
      LIMIT 80
    `),
    db.execute(sql`
      SELECT d.id, p.name AS project, wf.title AS workFile, d.title, 'important' AS priority,
        d.decision_status AS status, d.due_at AS dueAt, d.updated_at AS updatedAt
      FROM como_next_decisions d
      JOIN como_next_work_files wf ON wf.id=d.work_file_id AND wf.project_id=d.project_id
      JOIN projects p ON p.id=d.project_id AND p.is_test_project=0
      WHERE d.user_id=${userId} AND wf.work_file_status NOT IN ('closed','cancelled')
        AND (d.decision_status='required'
          OR (d.decision_status='deferred' AND d.due_at IS NOT NULL AND d.due_at <= UTC_TIMESTAMP()))
      LIMIT 40
    `),
    db.execute(sql`
      SELECT m.id, p.name AS project, wf.id AS workFileId, wf.title AS workFile, m.title, 'important' AS priority,
        m.meeting_status AS status, m.starts_at AS dueAt, m.created_at AS createdAt,
        m.updated_at AS updatedAt, m.source_record_id AS sourceRecordId
      FROM como_next_meetings m
      JOIN como_next_work_files wf ON wf.id=m.work_file_id AND wf.project_id=m.project_id
      JOIN projects p ON p.id=m.project_id AND p.is_test_project=0
      WHERE wf.user_id=${userId} AND wf.work_file_status NOT IN ('closed','cancelled')
        AND m.meeting_status IN ('planned','confirmed')
      LIMIT 40
    `),
    db.execute(sql`
      SELECT proposal.id, p.name AS project, wf.title AS workFile, proposal.title, proposal.priority,
        'pending' AS status, proposal.due_at AS dueAt, proposal.updated_at AS updatedAt
      FROM como_next_intake_proposals proposal
      JOIN como_next_work_files wf ON wf.id=proposal.work_file_id AND wf.project_id=proposal.project_id
      JOIN projects p ON p.id=proposal.project_id AND p.is_test_project=0
      WHERE proposal.user_id=${userId} AND wf.work_file_status NOT IN ('closed','cancelled')
        AND proposal.review_status='pending'
      LIMIT 40
    `),
    db.execute(sql`
      SELECT c.id, p.name AS project, wf.title AS workFile, c.subject AS title, 'important' AS priority,
        c.communication_status AS status, NULL AS dueAt, c.updated_at AS updatedAt
      FROM como_next_communications c
      JOIN como_next_work_files wf ON wf.id=c.work_file_id AND wf.project_id=c.project_id
      JOIN projects p ON p.id=c.project_id AND p.is_test_project=0
      WHERE c.user_id=${userId} AND wf.work_file_status NOT IN ('closed','cancelled')
        AND c.communication_status IN ('draft','approved_for_send')
      LIMIT 40
    `),
    db.execute(sql`
      SELECT email.id, p.name AS project, wf.title AS workFile, email.subject AS groupKey,
        COALESCE((SELECT LEFT(analysis.summary_ar,500) FROM como_next_email_analyses analysis
          WHERE analysis.email_message_id=email.id AND analysis.analysis_status='draft'
          ORDER BY analysis.id DESC LIMIT 1), email.subject) AS title,
        email.importance AS priority,
        email.inbox_status AS status, email.received_at AS dueAt, email.updated_at AS updatedAt
      FROM como_next_email_messages email
      LEFT JOIN projects p ON p.id=COALESCE(email.linked_project_id,email.suggested_project_id) AND p.is_test_project=0
      LEFT JOIN como_next_work_files wf ON wf.id=COALESCE(email.linked_work_file_id,email.suggested_work_file_id)
      WHERE email.user_id=${userId} AND email.folder_name='INBOX' AND email.inbox_status IN ('unmatched','suggested')
      LIMIT 40
    `),
    db.execute(sql`
      SELECT event.id, 'event' AS kind, p.name AS project, wf.title AS workFile, event.summary AS title, event.occurred_at AS occurredAt
      FROM como_next_work_file_events event
      JOIN como_next_work_files wf ON wf.id=event.work_file_id AND wf.project_id=event.project_id
      JOIN projects p ON p.id=event.project_id AND p.is_test_project=0
      WHERE event.user_id=${userId} AND wf.work_file_status NOT IN ('closed','cancelled')
        AND event.occurred_at >= ${sinceSql}
        AND event.event_type NOT IN ('email_intake_proposals_captured','email_received_linked','work_file_context_reconciled','intake_proposal_context_reconciled','linked_email_state_reconciled','operational_update_recorded')
      ORDER BY event.occurred_at DESC LIMIT 40
    `),
    db.execute(sql`
      SELECT updateRow.id, 'update' AS kind, p.name AS project, wf.title AS workFile,
        CONCAT('تحديث على ', wf.title, ': ', LEFT(COALESCE(NULLIF(updateRow.analysis_summary,''),'سُجلت معلومة تشغيلية جديدة وتنتظر المراجعة'),240)) AS title,
        updateRow.occurred_at AS occurredAt
      FROM como_next_work_file_updates updateRow
      JOIN como_next_work_files wf ON wf.id=updateRow.work_file_id AND wf.project_id=updateRow.project_id
      JOIN projects p ON p.id=updateRow.project_id AND p.is_test_project=0
      WHERE updateRow.user_id=${userId} AND wf.work_file_status NOT IN ('closed','cancelled')
        AND updateRow.updated_at >= ${sinceSql}
      ORDER BY updateRow.updated_at DESC LIMIT 30
    `),
    db.execute(sql`
      SELECT a.id, 'action' AS kind, p.name AS project, wf.title AS workFile,
        CONCAT('تغيّر الإجراء: ', a.title, ' — حالته ', a.action_status) AS title, a.updated_at AS occurredAt
      FROM como_next_actions a
      JOIN como_next_work_files wf ON wf.id=a.work_file_id AND wf.project_id=a.project_id
      JOIN projects p ON p.id=a.project_id AND p.is_test_project=0
      WHERE a.user_id=${userId} AND wf.work_file_status NOT IN ('closed','cancelled')
        AND a.updated_at >= ${sinceSql}
      ORDER BY a.updated_at DESC LIMIT 30
    `),
    db.execute(sql`
      SELECT d.id, 'decision' AS kind, p.name AS project, wf.title AS workFile,
        CONCAT('تغيّر القرار: ', d.title, ' — حالته ', d.decision_status) AS title, d.updated_at AS occurredAt
      FROM como_next_decisions d
      JOIN como_next_work_files wf ON wf.id=d.work_file_id AND wf.project_id=d.project_id
      JOIN projects p ON p.id=d.project_id AND p.is_test_project=0
      WHERE d.user_id=${userId} AND wf.work_file_status NOT IN ('closed','cancelled')
        AND d.updated_at >= ${sinceSql}
      ORDER BY d.updated_at DESC LIMIT 20
    `),
    db.execute(sql`
      SELECT m.id, 'meeting' AS kind, p.name AS project, wf.title AS workFile,
        CONCAT('تغيّر الاجتماع: ', m.title, ' — حالته ', m.meeting_status) AS title, m.updated_at AS occurredAt
      FROM como_next_meetings m
      JOIN como_next_work_files wf ON wf.id=m.work_file_id AND wf.project_id=m.project_id
      JOIN projects p ON p.id=m.project_id AND p.is_test_project=0
      WHERE wf.user_id=${userId} AND wf.work_file_status NOT IN ('closed','cancelled')
        AND m.updated_at >= ${sinceSql}
      ORDER BY m.updated_at DESC LIMIT 20
    `),
    db.execute(sql`
      SELECT email.id, 'email' AS kind, p.name AS project, wf.title AS workFile,
        CONCAT(CASE WHEN email.folder_name='INBOX' THEN 'وصل بريد: ' ELSE 'تسجل بريد صادر: ' END,
          COALESCE((SELECT LEFT(analysis.summary_ar,500) FROM como_next_email_analyses analysis
            WHERE analysis.email_message_id=email.id AND analysis.analysis_status='draft'
            ORDER BY analysis.id DESC LIMIT 1), email.subject)) AS title,
        email.imported_at AS occurredAt
      FROM como_next_email_messages email
      LEFT JOIN projects p ON p.id=COALESCE(email.linked_project_id,email.suggested_project_id) AND p.is_test_project=0
      LEFT JOIN como_next_work_files wf ON wf.id=COALESCE(email.linked_work_file_id,email.suggested_work_file_id)
      WHERE email.user_id=${userId} AND email.inbox_status <> 'dismissed' AND email.imported_at >= ${sinceSql}
      ORDER BY email.imported_at DESC LIMIT 30
    `),
    db.execute(sql`
      SELECT a.id, 'action' AS kind, p.name AS project, wf.title AS workFile,
        CONCAT(CASE a.action_status WHEN 'verified' THEN 'اكتمل وتحقق: ' ELSE 'اكتمل وينتظر التحقق: ' END, a.title) AS title,
        a.updated_at AS occurredAt
      FROM como_next_actions a
      JOIN como_next_work_files wf ON wf.id=a.work_file_id AND wf.project_id=a.project_id
      JOIN projects p ON p.id=a.project_id AND p.is_test_project=0
      WHERE a.user_id=${userId} AND wf.work_file_status NOT IN ('closed','cancelled')
        AND a.updated_at >= ${dayStartSql}
        AND a.action_status IN ('verified','completed_pending_verification')
      UNION ALL
      SELECT d.id, 'decision' AS kind, p.name AS project, wf.title AS workFile,
        CONCAT('حُسم القرار: ', d.title, ' — ', d.decision_status) AS title, d.updated_at AS occurredAt
      FROM como_next_decisions d
      JOIN como_next_work_files wf ON wf.id=d.work_file_id AND wf.project_id=d.project_id
      JOIN projects p ON p.id=d.project_id AND p.is_test_project=0
      WHERE d.user_id=${userId} AND wf.work_file_status NOT IN ('closed','cancelled')
        AND d.updated_at >= ${dayStartSql}
        AND d.decision_status IN ('approved','rejected','superseded')
      UNION ALL
      SELECT m.id, 'meeting' AS kind, p.name AS project, wf.title AS workFile,
        CONCAT('تحدّث الاجتماع: ', m.title, ' — ', m.meeting_status) AS title, m.updated_at AS occurredAt
      FROM como_next_meetings m
      JOIN como_next_work_files wf ON wf.id=m.work_file_id AND wf.project_id=m.project_id
      JOIN projects p ON p.id=m.project_id AND p.is_test_project=0
      WHERE wf.user_id=${userId} AND wf.work_file_status NOT IN ('closed','cancelled')
        AND m.updated_at >= ${dayStartSql}
      UNION ALL
      SELECT c.id, 'communication' AS kind, p.name AS project, wf.title AS workFile,
        CONCAT('تسجل إرسال: ', c.subject) AS title, c.sent_at AS occurredAt
      FROM como_next_communications c
      JOIN como_next_work_files wf ON wf.id=c.work_file_id AND wf.project_id=c.project_id
      JOIN projects p ON p.id=c.project_id AND p.is_test_project=0
      WHERE c.user_id=${userId} AND wf.work_file_status NOT IN ('closed','cancelled')
        AND c.communication_status='sent' AND c.sent_at >= ${dayStartSql}
      ORDER BY occurredAt DESC LIMIT 30
    `),
  ]);

  const decorate = (kind: BriefingItem["kind"], result: unknown) => rows<any>(result).map(item => ({ ...item, id: Number(item.id), kind })) as BriefingItem[];
  const changes = dedupeChanges([
    ...rows<ChangeItem>(eventsResult),
    ...rows<ChangeItem>(updatesResult),
    ...rows<ChangeItem>(changedActionsResult),
    ...rows<ChangeItem>(changedDecisionsResult),
    ...rows<ChangeItem>(changedMeetingsResult),
    ...rows<ChangeItem>(changedEmailsResult),
  ].map(item => ({ ...item, id: Number(item.id) })));
  return {
    workFiles: rows<any>(workFilesResult).map(item => ({ ...item, id: Number(item.id) })) as WorkFileSummary[],
    actions: decorate("action", actionsResult),
    decisions: decorate("decision", decisionsResult),
    meetings: decorate("meeting", meetingsResult),
    proposals: decorate("proposal", proposalsResult),
    communications: decorate("communication", communicationsResult),
    emails: decorate("email", emailsResult),
    changes,
    dayEvents: dedupeChanges(rows<ChangeItem>(dayEventsResult).map(item => ({ ...item, id: Number(item.id) }))),
  };
}

async function loadBriefingState(memberId: string, now: Date) {
  const userId = await resolveOwnerUserIdForSara(memberId);
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "قاعدة البيانات غير متاحة" });
  const window = getSaraDubaiWindow(now);
  const last = await loadLastCompletedDelivery(db, userId, memberId);
  const since = last?.sourceCursorAt ? parseDate(last.sourceCursorAt) || window.start : window.start;
  const snapshot = await loadSnapshot(userId, since, window.start);
  const completedToday = await db.select({ periodKind: comoNextSaraBriefingDeliveries.periodKind })
    .from(comoNextSaraBriefingDeliveries)
    .where(and(
      eq(comoNextSaraBriefingDeliveries.userId, userId),
      eq(comoNextSaraBriefingDeliveries.memberId, memberId),
      eq(comoNextSaraBriefingDeliveries.briefingKind, "full"),
      eq(comoNextSaraBriefingDeliveries.deliveryStatus, "completed"),
      sql`${comoNextSaraBriefingDeliveries.startedAt} >= ${toSqlTimestamp(window.start)}`,
    ));
  const hasFullToday = completedToday.length > 0;
  const hasEveningFull = completedToday.some(item => item.periodKind === "evening");
  const recommendedMode = chooseSaraAutoMode({
    period: window.period,
    hasFullToday,
    hasEveningFull,
    changesCount: snapshot.changes.length,
  });
  const allAttention = dedupeAttention([
    ...snapshot.actions,
    ...snapshot.decisions,
    ...selectSaraLatestMeetingSchedule(snapshot.meetings),
    ...snapshot.proposals,
    ...snapshot.communications,
    ...snapshot.emails,
  ]);
  const todayCount = collapseSaraAttentionByTopic(allAttention.filter(item => isTodayAttention(item, now, window.end)), now, window.end).length;
  return { userId, db, window, snapshot, recommendedMode, todayCount, lastCompletedAt: last?.completedAt || null };
}

export async function getSaraBriefingStatus(memberId: string, now = new Date()) {
  const state = await loadBriefingState(memberId, now);
  return {
    timezone: "Asia/Dubai" as const,
    period: state.window.period,
    recommendedMode: state.recommendedMode,
    todayCount: state.todayCount,
    changesCount: state.snapshot.changes.length,
    hasHeardBriefing: Boolean(state.lastCompletedAt),
    lastCompletedAt: state.lastCompletedAt,
  };
}

export async function prepareSaraBriefing(input: { memberId: string; mode: SaraBriefingMode; sessionId?: string | null; now?: Date }) {
  const now = input.now || new Date();
  const state = await loadBriefingState(input.memberId, now);
  const kind: SaraBriefingKind = input.mode === "auto" ? state.recommendedMode : input.mode;
  const narration = buildNarration(kind, state.window.period, state.snapshot, now);
  const [sync] = await state.db.select({
    isEnabled: comoNextEmailSyncSettings.isEnabled,
    lastSuccessAt: comoNextEmailSyncSettings.lastSuccessAt,
    lastRunAt: comoNextEmailSyncSettings.lastRunAt,
    lastStatus: comoNextEmailSyncSettings.lastStatus,
  }).from(comoNextEmailSyncSettings).where(and(eq(comoNextEmailSyncSettings.userId, state.userId), eq(comoNextEmailSyncSettings.mailboxKey, "owner-primary"))).limit(1);
  const [processing] = await state.db.select({
    isEnabled: comoNextEmailSyncSettings.isEnabled,
    lastSuccessAt: comoNextEmailSyncSettings.lastSuccessAt,
    lastRunAt: comoNextEmailSyncSettings.lastRunAt,
    lastStatus: comoNextEmailSyncSettings.lastStatus,
  }).from(comoNextEmailSyncSettings).where(and(eq(comoNextEmailSyncSettings.userId, state.userId), eq(comoNextEmailSyncSettings.mailboxKey, "owner-primary-processing"))).limit(1);
  const [executive] = await state.db.select({
    isEnabled: comoNextEmailSyncSettings.isEnabled,
    lastSuccessAt: comoNextEmailSyncSettings.lastSuccessAt,
    lastRunAt: comoNextEmailSyncSettings.lastRunAt,
    lastStatus: comoNextEmailSyncSettings.lastStatus,
  }).from(comoNextEmailSyncSettings).where(and(eq(comoNextEmailSyncSettings.userId, state.userId), eq(comoNextEmailSyncSettings.mailboxKey, "owner-primary-executive"))).limit(1);
  const lastSuccess = saraDubaiTimestamp(sync?.lastSuccessAt);
  const lastRun = saraDubaiTimestamp(sync?.lastRunAt);
  const staleImport = !sync?.isEnabled || !lastSuccess || now.getTime() - Date.parse(lastSuccess.utc) > COMO_MAIL_STAGE_STALE_MS
    || sync.lastStatus === "failed"
    || (sync.lastStatus === "running" && (!lastRun || now.getTime() - Date.parse(lastRun.utc) > 2 * 60_000));
  const lastProcessed = saraDubaiTimestamp(processing?.lastSuccessAt);
  const processRun = saraDubaiTimestamp(processing?.lastRunAt);
  const staleProcessing = !processing?.isEnabled || !lastProcessed || now.getTime() - Date.parse(lastProcessed.utc) > COMO_MAIL_STAGE_STALE_MS
    || processing?.lastStatus === "failed"
    || (processing?.lastStatus === "running" && (!processRun || now.getTime() - Date.parse(processRun.utc) > 2 * 60_000));
  const lastExecutive = saraDubaiTimestamp(executive?.lastSuccessAt);
  const executiveRun = saraDubaiTimestamp(executive?.lastRunAt);
  const staleExecutive = !executive?.isEnabled || !lastExecutive || now.getTime() - Date.parse(lastExecutive.utc) > COMO_MAIL_STAGE_STALE_MS
    || executive?.lastStatus === "failed"
    || (executive?.lastStatus === "running" && (!executiveRun || now.getTime() - Date.parse(executiveRun.utc) > 2 * 60_000));
  const briefingText = staleImport
    ? `تنبيه موجز: البريد الذي يظهر لي هو ما وصل إلى COMO، لكن المزامنة المجدولة لم تؤكد تحديث كل الرسائل${lastSuccess ? ` منذ ${lastSuccess.dubai}` : ""}. لا أؤكد عدم وجود وارد أحدث.\n---\n${narration.text}`
    : staleProcessing ? `تنبيه موجز: استُورد البريد، لكن معالجة الرسائل الجديدة لم يثبت اكتمالها؛ قد تنقص المتابعات والأولويات.\n---\n${narration.text}`
    : staleExecutive ? `تنبيه موجز: استُورد البريد وحُلّل، لكن تنفيذ متابعة Manus الداخلية لم يثبت اكتماله؛ لا أعرض التحليل كأنه تنفيذ منجز.\n---\n${narration.text}` : narration.text;
  const contentSha256 = createHash("sha256").update(`${kind}\n${briefingText}`).digest("hex");
  await state.db.update(comoNextSaraBriefingDeliveries)
    .set({ deliveryStatus: "interrupted", completedAt: toSqlTimestamp(now) })
    .where(and(
      eq(comoNextSaraBriefingDeliveries.userId, state.userId),
      eq(comoNextSaraBriefingDeliveries.memberId, input.memberId),
      eq(comoNextSaraBriefingDeliveries.deliveryStatus, "started"),
    ));
  const result = await state.db.insert(comoNextSaraBriefingDeliveries).values({
    userId: state.userId,
    memberId: input.memberId,
    briefingKind: kind,
    periodKind: state.window.period,
    deliveryStatus: "started",
    contentSha256,
    sourceCursorAt: toSqlTimestamp(now),
    sourceCursorId: null,
    itemCount: narration.itemCount,
    sessionId: input.sessionId || null,
    startedAt: toSqlTimestamp(now),
  });
  return {
    deliveryId: Number(result[0].insertId),
    mode: kind,
    period: state.window.period,
    title: narration.title,
    text: briefingText,
    todayCount: state.todayCount,
    changesCount: state.snapshot.changes.length,
    generatedAt: now.toISOString(),
    source: "Manus / COMO Next" as const,
  };
}

export async function completeSaraBriefing(input: { memberId: string; deliveryId: number; completed: boolean; now?: Date }) {
  const userId = await resolveOwnerUserIdForSara(input.memberId);
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "قاعدة البيانات غير متاحة" });
  const result = await db.update(comoNextSaraBriefingDeliveries)
    .set({
      deliveryStatus: input.completed ? "completed" : "interrupted",
      completedAt: toSqlTimestamp(input.now || new Date()),
    })
    .where(and(
      eq(comoNextSaraBriefingDeliveries.id, input.deliveryId),
      eq(comoNextSaraBriefingDeliveries.userId, userId),
      eq(comoNextSaraBriefingDeliveries.memberId, input.memberId),
      eq(comoNextSaraBriefingDeliveries.deliveryStatus, "started"),
    ));
  return { success: true as const, changedRows: Number((result as any)[0]?.affectedRows || 0) };
}
