import { describe, expect, it } from "vitest";
import {
  CONDITIONAL_SENT_WATCH_ACTIVATION_AT,
  ConditionalSentWatchSeeder,
  classifyConditionalSentWatchRequest,
  extractSingleToRecipient,
  planConditionalSentWatch,
  type ConditionalSentWatchInbound,
  type ConditionalSentWatchPlan,
  type ConditionalSentWatchSeedStore,
  type ConditionalSentWatchSent,
} from "./services/comoNextConditionalSentWatchSeeder";

const SENT_AT = "2026-10-08T06:00:00.000Z"; // Thursday 10:00 Asia/Dubai
const DUE_AT = "2026-10-13T06:00:00.000Z"; // Tue after Fri, Sat, Sun, Mon, Tue

function sent(overrides: Partial<ConditionalSentWatchSent> = {}): ConditionalSentWatchSent {
  return {
    id: 196,
    folderName: "Sent",
    linkedWorkFileId: 480001,
    workFileStatus: "open",
    projectId: 470001,
    toText: "neb@example.com",
    ccText: "Wael <wael@zooma.ae>",
    subject: "NEB — revised proposal requested",
    bodyText: "Dear NEB,\n\nKindly submit your revised proposal and quotation by return email.\n\nRegards,",
    receivedAt: SENT_AT,
    ...overrides,
  };
}

function reply(overrides: Partial<ConditionalSentWatchInbound> = {}): ConditionalSentWatchInbound {
  return {
    id: 197,
    fromEmail: "neb@example.com",
    subject: "Re: NEB — revised proposal requested",
    bodyText: "Dear team,\n\nPlease find our revised proposal attached.\n\nRegards,\nNEB",
    receivedAt: "2026-10-09T06:00:00.000Z",
    linkedWorkFileId: null,
    ...overrides,
  };
}

class InMemoryConditionalSentWatchStore implements ConditionalSentWatchSeedStore {
  rows: ConditionalSentWatchSent[] = [];
  inbound = new Map<number, { messages: ConditionalSentWatchInbound[]; complete: boolean }>();
  watchIds = new Map<string, number>();
  creates: ConditionalSentWatchPlan[] = [];

  async listUnwatchedSentCandidates() {
    return this.rows.filter(row => !this.watchIds.has(`sent-email-${row.id}`));
  }

  async findInboundCandidates(input: { sentAt: string }) {
    const email = this.rows.find(row => row.receivedAt === input.sentAt);
    return this.inbound.get(email?.id || -1) || { messages: [], complete: true };
  }

  async createWaitingWatchIfAbsent(input: ConditionalSentWatchPlan & { userId: number }) {
    const existing = this.watchIds.get(input.sourceRecordId);
    if (existing) return { actionId: existing, replayed: true };
    const actionId = 510000 + this.watchIds.size + 1;
    this.watchIds.set(input.sourceRecordId, actionId);
    this.creates.push(input);
    return { actionId, replayed: false };
  }
}

describe("COMO future-only conditional Sent watch seeder", () => {
  it("uses only one To recipient; copying Wael is not a second recipient and does not become the awaited sender", () => {
    expect(extractSingleToRecipient("NEB <neb@example.com>")).toBe("neb@example.com");
    expect(extractSingleToRecipient("NEB <neb@example.com>, Wael <wael@zooma.ae>")).toBeNull();
    const planned = planConditionalSentWatch(sent());
    expect("plan" in planned && planned.plan.recipientEmail).toBe("neb@example.com");
  });

  it("uses exactly three Dubai business days and permits only fact-backed exceptional weekend calendars", () => {
    const planned = planConditionalSentWatch(sent());
    expect("plan" in planned && planned.plan.followUpAt).toBe(DUE_AT);
    const exceptional = planConditionalSentWatch(sent(), { weekendDays: ["friday"] });
    expect("plan" in exceptional && exceptional.plan.followUpAt).toBe("2026-10-12T06:00:00.000Z");
  });

  it("never seeds a historical Sent row at or before activation, including the existing NEB UID 196-era import", () => {
    const before = planConditionalSentWatch(sent({ receivedAt: "2026-10-08T00:59:59.000Z" }));
    const atBoundary = planConditionalSentWatch(sent({ receivedAt: CONDITIONAL_SENT_WATCH_ACTIVATION_AT }));
    expect(before).toEqual({ skip: "before_activation" });
    expect(atBoundary).toEqual({ skip: "before_activation" });
  });

  it("fails closed for closed/waiting files, multiple recipients, malformed timestamps, and a non-Sent source", () => {
    expect(planConditionalSentWatch(sent({ workFileStatus: "closed" }))).toEqual({ skip: "work_file_not_open" });
    expect(planConditionalSentWatch(sent({ workFileStatus: "waiting" }))).toEqual({ skip: "work_file_not_open" });
    expect(planConditionalSentWatch(sent({ toText: "neb@example.com, other@example.com" }))).toEqual({ skip: "not_single_to_recipient" });
    expect(planConditionalSentWatch(sent({ receivedAt: "not-a-timestamp" }))).toEqual({ skip: "invalid_sent_timestamp" });
    expect(planConditionalSentWatch(sent({ folderName: "Drafts" }))).toEqual({ skip: "not_sent" });
  });

  it("only accepts a narrow explicit request/quotation/clear-offer allow-list and excludes courtesy, rejection, and final-offer emails", () => {
    expect(classifyConditionalSentWatchRequest({ subject: "Thanks", bodyText: "Thank you for your time and support." })).toBeNull();
    expect(classifyConditionalSentWatchRequest({ subject: "شكر", bodyText: "شكرًا لتعاونكم ودعمكم." })).toBeNull();
    expect(classifyConditionalSentWatchRequest({ subject: "Re: proposal", bodyText: "Unfortunately we are unable to proceed." })).toBeNull();
    expect(classifyConditionalSentWatchRequest({ subject: "Final offer", bodyText: "This is our best and final offer." })).toBeNull();
    expect(classifyConditionalSentWatchRequest({ subject: "عرض نهائي", bodyText: "هذا هو عرضنا النهائي." })).toBeNull();
    expect(classifyConditionalSentWatchRequest({ subject: "Offer", bodyText: "We discussed an offer yesterday." })).toBeNull();
    expect(classifyConditionalSentWatchRequest({ subject: "Proposal", bodyText: "Kindly submit your quotation by return email." })).toMatchObject({ kind: "quotation_request" });
    expect(classifyConditionalSentWatchRequest({ subject: "طلب رد", bodyText: "نرجو موافاتنا بردكم وتأكيدكم." })).toMatchObject({ kind: "reply_request" });
    expect(classifyConditionalSentWatchRequest({ subject: "Our proposal", bodyText: "Please find attached our proposal for your comments and approval." })).toMatchObject({ kind: "clear_offer" });
  });

  it("checks a suitable imported inbound reply before creating a watch, so no late reminder/watch exists", async () => {
    const store = new InMemoryConditionalSentWatchStore();
    store.rows = [sent()];
    store.inbound.set(196, { messages: [reply()], complete: true });

    const result = await new ConditionalSentWatchSeeder(store).seed({ userId: 41 });

    expect(result).toMatchObject({ examined: 1, created: 0, replyAlreadyPresent: 1, externalSideEffects: false });
    expect(result.skipped).toEqual([{ emailId: 196, reason: "reply_already_present" }]);
    expect(store.creates).toEqual([]);
  });

  it("does not accept an auto-reply, a different sender, a subject mismatch, or a reply linked to another file", async () => {
    const variants = [
      reply({ subject: "Automatic reply: Re: NEB — revised proposal requested" }),
      reply({ fromEmail: "other@example.com" }),
      reply({ subject: "Re: unrelated topic" }),
      reply({ linkedWorkFileId: 999999 }),
    ];
    for (const inbound of variants) {
      const store = new InMemoryConditionalSentWatchStore();
      store.rows = [sent()];
      store.inbound.set(196, { messages: [inbound], complete: true });
      const result = await new ConditionalSentWatchSeeder(store).seed({ userId: 41 });
      expect(result.created).toBe(1);
      expect(result.replyAlreadyPresent).toBe(0);
    }
  });

  it("skips rather than creates a watch if bounded reply discovery is incomplete", async () => {
    const store = new InMemoryConditionalSentWatchStore();
    store.rows = [sent()];
    store.inbound.set(196, { messages: [], complete: false });

    const result = await new ConditionalSentWatchSeeder(store).seed({ userId: 41 });

    expect(result).toMatchObject({ created: 0, replyAlreadyPresent: 0 });
    expect(result.skipped).toEqual([{ emailId: 196, reason: "reply_scan_incomplete" }]);
  });

  it("is idempotent across an import replay and stores a waiting watch only, never an outbound reminder", async () => {
    const store = new InMemoryConditionalSentWatchStore();
    store.rows = [sent()];
    const service = new ConditionalSentWatchSeeder(store);

    const first = await service.seed({ userId: 41 });
    // Simulate a crash/retry path where the candidate projection is replayed.
    store.listUnwatchedSentCandidates = async () => store.rows;
    const replay = await service.seed({ userId: 41 });

    expect(first).toMatchObject({ created: 1, replayed: 0, externalSideEffects: false });
    expect(replay).toMatchObject({ created: 0, replayed: 1, externalSideEffects: false });
    expect(store.creates).toHaveLength(1);
    expect(store.creates[0]).toMatchObject({ sourceRecordId: "sent-email-196", followUpAt: DUE_AT, recipientEmail: "neb@example.com" });
  });
});
