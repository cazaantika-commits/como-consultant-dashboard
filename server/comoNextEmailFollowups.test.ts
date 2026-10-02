import { describe, expect, it } from "vitest";
import {
  addDubaiBusinessDays,
  assertConfirmedSentReminder,
  ComoNextEmailFollowupService,
  composeComoNextFollowupDraft,
  computeComoNextEmailFollowupAt,
  hasAuthenticatedSystemDraftCorrelation,
  isQualifyingFollowupResolution,
  type ComoNextEmailFollowup,
  type ComoNextEmailFollowupStore,
  type ConfirmedSentReminder,
  type FollowupResolutionEvidence,
  type FollowupScheduleInput,
} from "./services/comoNextEmailFollowups";

const SENT_AT = "2026-10-01T06:00:00.000Z"; // Thursday 10:00 in Asia/Dubai
const DUE_AT = "2026-10-06T06:00:00.000Z"; // Tuesday 10:00 after Fri, Mon, Tue

function reminder(overrides: Partial<ConfirmedSentReminder> = {}): ConfirmedSentReminder {
  return {
    userId: 41,
    workFileId: 390001,
    sentMessageId: "<sent-123@example.com>",
    sentMessageRef: "imap:owner:Sent:88:123",
    sentAt: SENT_AT,
    toText: "consultant@example.com",
    ccText: "wael@zooma.ae",
    subject: "Request for revised proposal",
    ownerDirectiveRef: "staged-directive:51",
    ownerDirectiveExplicitlyApproved: true,
    sentCorrelation: {
      systemDraftKey: "como-next-communication-51",
      observedSentDraftKey: "como-next-communication-51",
      expectedThreadMessageId: "<draft-51@example.com>",
    },
    authenticatedSentRecord: true,
    sourceFolder: "Sent",
    sourceIsDraft: false,
    expectedResolutionKinds: ["reply", "analysis", "deliverable"],
    ...overrides,
  };
}

function followup(overrides: Partial<ComoNextEmailFollowup> = {}): ComoNextEmailFollowup {
  return {
    id: "f-1",
    idempotencyKey: "followup-key",
    userId: 41,
    workFileId: 390001,
    sentMessageId: "<sent-123@example.com>",
    sentMessageRef: "imap:owner:Sent:88:123",
    sentAt: SENT_AT,
    toText: "consultant@example.com",
    ccText: "wael@zooma.ae",
    subject: "Request for revised proposal",
    ownerDirectiveRef: "staged-directive:51",
    ownerDirectiveExplicitlyApproved: true,
    sentCorrelation: {
      systemDraftKey: "como-next-communication-51",
      observedSentDraftKey: "como-next-communication-51",
      expectedThreadMessageId: "<draft-51@example.com>",
    },
    expectedResolutionKinds: ["reply", "analysis", "deliverable"],
    followUpAt: DUE_AT,
    status: "scheduled",
    mailboxDraftRef: null,
    draftClaimToken: null,
    ...overrides,
  };
}

class InMemoryFollowupStore implements ComoNextEmailFollowupStore {
  rows: ComoNextEmailFollowup[] = [];
  evidence: FollowupResolutionEvidence[] = [];
  scheduleCalls = 0;
  cancelCalls = 0;
  claimCalls = 0;

  async scheduleIfAbsent(input: FollowupScheduleInput) {
    this.scheduleCalls += 1;
    const existing = this.rows.find(row => row.idempotencyKey === input.idempotencyKey);
    if (existing) return { followup: existing, replayed: true };
    const created = { ...input, id: `f-${this.rows.length + 1}`, status: "scheduled" as const, mailboxDraftRef: null };
    this.rows.push(created);
    return { followup: created, replayed: false };
  }

  async rescheduleDueAt(input: { followupId: string; followUpAt: string }) {
    const row = this.rows.find(item => item.id === input.followupId);
    if (!row) throw new Error("not found");
    row.followUpAt = input.followUpAt;
    return row;
  }

  async listActive() {
    return this.rows.filter(row => row.status === "scheduled" || row.status === "drafting");
  }

  async findResolutionEvidence(item: ComoNextEmailFollowup) {
    return this.evidence.filter(evidence => evidence.workFileId === item.workFileId && evidence.sourceSentMessageRef === item.sentMessageRef);
  }

  async cancelIfActive(input: { followupId: string; resolution: FollowupResolutionEvidence; reason: string }) {
    this.cancelCalls += 1;
    const row = this.rows.find(item => item.id === input.followupId);
    if (!row || !["scheduled", "drafting"].includes(row.status)) return false;
    row.status = "cancelled";
    return true;
  }

  async claimDueForDraft(input: { followupId: string; now: string }) {
    this.claimCalls += 1;
    const row = this.rows.find(item => item.id === input.followupId);
    if (!row || row.status !== "scheduled") return null;
    row.status = "drafting";
    row.draftClaimToken = `claim:${row.id}`;
    return row;
  }

  async markDraftPrepared(input: { followupId: string; draftClaimToken: string; mailboxDraftRef: string }) {
    const row = this.rows.find(item => item.id === input.followupId);
    if (!row || row.status !== "drafting" || row.draftClaimToken !== input.draftClaimToken) return false;
    row.status = "draft_ready";
    row.mailboxDraftRef = input.mailboxDraftRef;
    row.draftClaimToken = null;
    return true;
  }

  async releaseDraftClaim(input: { followupId: string; draftClaimToken: string; error: string }) {
    const row = this.rows.find(item => item.id === input.followupId);
    if (row?.status === "drafting" && row.draftClaimToken === input.draftClaimToken) {
      row.status = "scheduled";
      row.draftClaimToken = null;
    }
  }

  async markOwnerReview(input: { followupId: string; reason: string }) {
    const row = this.rows.find(item => item.id === input.followupId);
    if (!row || row.status !== "scheduled") return false;
    row.status = "owner_review";
    return true;
  }
}

describe("COMO Next confirmed-Sent email follow-ups", () => {
  it("calculates three Dubai business days at the same wall-clock time, skipping Saturday and Sunday", () => {
    expect(addDubaiBusinessDays(SENT_AT, 3)).toBe(DUE_AT);
    expect(addDubaiBusinessDays("2026-10-02T06:00:00.000Z", 3)).toBe("2026-10-07T06:00:00.000Z");
    expect(computeComoNextEmailFollowupAt(reminder())).toBe(DUE_AT);
    expect(computeComoNextEmailFollowupAt(reminder({ followUpAtOverride: "2026-10-08T09:30:00.000Z" }))).toBe("2026-10-08T09:30:00.000Z");
  });

  it("fails closed for a Draft, a non-Sent folder, or missing authenticated Sent evidence", () => {
    expect(() => assertConfirmedSentReminder(reminder({ sourceIsDraft: true }))).toThrow(/Draft/);
    expect(() => assertConfirmedSentReminder(reminder({ sourceFolder: "Drafts" }))).toThrow(/Sent folder/);
    expect(() => assertConfirmedSentReminder(reminder({ authenticatedSentRecord: false }))).toThrow(/authenticated Sent/);
  });

  it("requires X-COMO-Draft-Key or an immutable thread anchor, never recipient or subject similarity", () => {
    expect(hasAuthenticatedSystemDraftCorrelation({
      systemDraftKey: "como-next-communication-51",
      observedSentDraftKey: "como-next-communication-51",
    })).toBe(true);
    expect(hasAuthenticatedSystemDraftCorrelation({
      systemDraftKey: "como-next-communication-51",
      expectedThreadMessageId: "<draft-51@example.com>",
      observedThreadMessageIds: ["<DRAFT-51@EXAMPLE.COM>"],
    })).toBe(true);
    expect(() => assertConfirmedSentReminder(reminder({ sentCorrelation: {
      systemDraftKey: "como-next-communication-51",
      observedSentDraftKey: "other-draft",
      expectedThreadMessageId: "<draft-51@example.com>",
      observedThreadMessageIds: ["<other@example.com>"],
    } }))).toThrow(/X-COMO-Draft-Key/);
  });

  it("schedules exactly one editable follow-up for an authenticated Sent reminder and replays safely", async () => {
    const store = new InMemoryFollowupStore();
    const service = new ComoNextEmailFollowupService(store, { saveReviewDraft: async () => ({ folder: "Drafts", uid: 1, created: true }) });

    const first = await service.scheduleAfterConfirmedSentReminder(reminder());
    const replay = await service.scheduleAfterConfirmedSentReminder(reminder());
    expect(first.followup.followUpAt).toBe(DUE_AT);
    const rescheduled = await service.reschedule({ followup: first.followup, followUpAt: "2026-10-09T06:00:00.000Z" });

    expect(first.replayed).toBe(false);
    expect(replay.replayed).toBe(true);
    expect(store.rows).toHaveLength(1);
    expect(rescheduled.followUpAt).toBe("2026-10-09T06:00:00.000Z");
  });

  it("cancels before due only for explicit, scoped, appropriate reply/analysis/deliverable evidence", async () => {
    const store = new InMemoryFollowupStore();
    store.rows.push(followup());
    store.evidence.push({
      workFileId: 390001,
      sourceSentMessageRef: "imap:owner:Sent:88:123",
      kind: "analysis",
      occurredAt: "2026-10-05T06:00:00.000Z",
      explicitlyAdequate: true,
      evidenceReference: "work-product:77",
    });
    const drafted: string[] = [];
    const service = new ComoNextEmailFollowupService(store, {
      saveReviewDraft: async draft => { drafted.push(draft.draftKey); return { folder: "Drafts", uid: 42, created: true }; },
    });

    const result = await service.reconcile({ now: "2026-10-06T07:00:00.000Z" });

    expect(result).toMatchObject({ cancelled: 1, draftPrepared: 0, failures: [] });
    expect(store.rows[0]?.status).toBe("cancelled");
    expect(drafted).toEqual([]);
  });

  it("never treats invoice approval as payment or as a qualifying resolution", async () => {
    const item = followup({ expectedResolutionKinds: ["invoice_paid"] });
    const approved: FollowupResolutionEvidence = {
      workFileId: item.workFileId,
      sourceSentMessageRef: item.sentMessageRef,
      kind: "invoice_approved",
      occurredAt: "2026-10-05T06:00:00.000Z",
      explicitlyAdequate: true,
      evidenceReference: "invoice:approved:10",
    };
    expect(isQualifyingFollowupResolution(item, approved)).toBe(false);

    const store = new InMemoryFollowupStore();
    store.rows.push(item);
    store.evidence.push(approved);
    const service = new ComoNextEmailFollowupService(store, { saveReviewDraft: async () => ({ folder: "Drafts", uid: 91, created: true }) });
    const result = await service.reconcile({ now: "2026-10-06T07:00:00.000Z" });

    expect(result.cancelled).toBe(0);
    expect(result.draftPrepared).toBe(1);
    expect(store.rows[0]?.status).toBe("draft_ready");
  });

  it("leaves a due item for the owner when its original directive lacks explicit approval", async () => {
    const store = new InMemoryFollowupStore();
    store.rows.push(followup({ ownerDirectiveExplicitlyApproved: false }));
    const drafts: string[] = [];
    const service = new ComoNextEmailFollowupService(store, {
      saveReviewDraft: async draft => { drafts.push(draft.draftKey); return { folder: "Drafts", uid: 1, created: true }; },
    });

    const result = await service.reconcile({ now: "2026-10-06T07:00:00.000Z" });

    expect(result).toMatchObject({ draftPrepared: 0, cancelled: 0, failures: [] });
    expect(store.rows[0]?.status).toBe("owner_review");
    expect(drafts).toEqual([]);
  });

  it("prepares one genuine review-only Draft at due time, threads it, and never sends", async () => {
    const store = new InMemoryFollowupStore();
    store.rows.push(followup());
    const drafts: ReturnType<typeof composeComoNextFollowupDraft>[] = [];
    const service = new ComoNextEmailFollowupService(store, {
      saveReviewDraft: async draft => {
        drafts.push(draft);
        return { folder: "Drafts", uid: 66, created: true };
      },
    });

    const first = await service.reconcile({ now: "2026-10-06T06:00:00.000Z" });
    const replay = await service.reconcile({ now: "2026-10-06T07:00:00.000Z" });

    expect(first).toMatchObject({ draftPrepared: 1, cancelled: 0, failures: [] });
    expect(replay.draftPrepared).toBe(0);
    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toMatchObject({
      inReplyTo: "<sent-123@example.com>",
      draftKey: "como-next-followup:followup-key",
      subject: "Re: Request for revised proposal",
    });
    expect(store.rows[0]).toMatchObject({ status: "draft_ready", mailboxDraftRef: "Drafts UID 66" });
  });
});
