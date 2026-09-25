export type ComoNextTodayRow = {
  id: number;
  projectId: number;
  projectName: string;
  workFileId: number;
  workFileTitle: string;
  title: string;
  acceptanceCriteria: string;
  ownerType: "human" | "manus" | "team";
  ownerUserId: number | null;
  actionStatus: "open" | "in_progress" | "waiting_external" | "completed_pending_verification" | "verified" | "cancelled";
  priority: "normal" | "important" | "urgent";
  dueAt: string | null;
  followUpAt: string | null;
  attentionAt: string | null;
  waitingPartyName: string | null;
};

export type ComoNextTodayItem = ComoNextTodayRow & {
  isOverdue: boolean;
  section: "waiting_external" | "mine" | "manus" | "team";
};

const DUBAI_OFFSET_MS = 4 * 60 * 60 * 1000;
const priorityRank = { urgent: 0, important: 1, normal: 2 } as const;

export function getDubaiDayBounds(now: Date) {
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
  return {
    start: new Date(startUtc),
    end: new Date(startUtc + 24 * 60 * 60 * 1000 - 1),
  };
}

function parseUtc(value: string | null) {
  if (!value) return null;
  const normalized = /Z$|[+-]\d{2}:?\d{2}$/.test(value) ? value : `${value.replace(" ", "T")}Z`;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function compareItems(a: ComoNextTodayItem, b: ComoNextTodayItem) {
  if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
  const priorityDifference = priorityRank[a.priority] - priorityRank[b.priority];
  if (priorityDifference !== 0) return priorityDifference;
  const aTime = parseUtc(a.attentionAt)?.getTime() ?? Number.MAX_SAFE_INTEGER;
  const bTime = parseUtc(b.attentionAt)?.getTime() ?? Number.MAX_SAFE_INTEGER;
  return aTime - bTime || a.id - b.id;
}

export function buildComoNextTodayProjection(rows: ComoNextTodayRow[], userId: number, now = new Date()) {
  const { end } = getDubaiDayBounds(now);
  const openRows = rows.filter(row => !["verified", "cancelled"].includes(row.actionStatus));
  const dueRows = openRows.filter(row => {
    const attention = parseUtc(row.attentionAt);
    return Boolean(attention && attention!.getTime() <= end.getTime());
  });

  const items: ComoNextTodayItem[] = dueRows.map(row => {
    const attention = parseUtc(row.attentionAt);
    const section: ComoNextTodayItem["section"] =
      row.actionStatus === "waiting_external"
        ? "waiting_external"
        : row.ownerType === "manus"
          ? "manus"
          : row.ownerType === "human" && row.ownerUserId === userId
            ? "mine"
            : "team";
    return {
      ...row,
      section,
      isOverdue: Boolean(attention && attention.getTime() < now.getTime()),
    };
  });

  const waitingExternal = items.filter(item => item.section === "waiting_external").sort(compareItems);
  const mine = items.filter(item => item.section === "mine").sort(compareItems);
  const manus = items.filter(item => item.section === "manus").sort(compareItems);
  const team = items.filter(item => item.section === "team").sort(compareItems);
  const overdueCount = items.filter(item => item.isOverdue).length;

  return {
    generatedAt: now.toISOString(),
    timezone: "Asia/Dubai" as const,
    summary: {
      dueToday: items.length,
      overdue: overdueCount,
      waitingExternal: waitingExternal.length,
      mine: mine.length,
      manus: manus.length,
      team: team.length,
    },
    sections: { waitingExternal, mine, manus, team },
  };
}
