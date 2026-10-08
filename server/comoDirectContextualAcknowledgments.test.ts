import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  DIRECT_CONTEXTUAL_ACK_DELIVERY_MODE,
  deterministicDirectAcknowledgementClassification,
  directContextualAcknowledgementIdempotencyKey,
  isDirectContextualAcknowledgementShadowEnabled,
  isNonCommittingAcknowledgementText,
  planDirectContextualAcknowledgement,
  processDirectContextualAcknowledgementShadowWithAdapter,
  type DirectContextualAcknowledgementExecutionInput,
  type DirectContextualAcknowledgementShadowAdapter,
  type DirectReadonlySentReview,
  type DirectShadowLedgerRecord,
  type DirectShadowLedgerStatus,
} from "./services/comoDirectContextualAcknowledgments";

const service = readFileSync("server/services/comoDirectContextualAcknowledgments.ts", "utf8");
const scheduledRoute = readFileSync("server/scheduledEmailSyncRoute.ts", "utf8");
const saraBriefings = readFileSync("server/services/saraBriefings.ts", "utf8");
const ACTIVATION = "2026-10-08T08:00:00.000Z";

function executionInput(overrides: Partial<DirectContextualAcknowledgementExecutionInput> & {
  message?: Partial<DirectContextualAcknowledgementExecutionInput["message"]>;
  project?: Partial<DirectContextualAcknowledgementExecutionInput["project"]>;
  activation?: Partial<DirectContextualAcknowledgementExecutionInput["activation"]>;
} = {}): DirectContextualAcknowledgementExecutionInput {
  const { message: messageOverrides, project: projectOverrides, activation: activationOverrides, ...root } = overrides;
  return {
    message: {
      id: 201,
      userId: 1,
      messageIdentitySha256: "a".repeat(64),
      mailboxKey: "configured-como-mailbox-hash",
      mailboxVerified: true,
      folderName: "INBOX",
      uidValidity: "100",
      imapUid: 99,
      fromEmail: "consultant@example.com",
      fromName: "Consultant",
      toText: "a.zaqout@comodevelopments.com, colleague@consultant.com",
      ccText: "director@consultant.com",
      subject: "Thank you",
      bodyText: "Thank you, noted.",
      messageId: "<inbound-201@example.com>",
      receivedAt: "2026-10-08T08:01:00.000Z",
      systemSignal: "known_non_system",
      fromSignalVerified: true,
      ...messageOverrides,
    },
    project: {
      status: "verified",
      projectId: 11,
      workFileId: 22,
      accessVerified: true,
      ...projectOverrides,
    },
    activation: {
      activationStartedAt: ACTIVATION,
      deliveryMode: DIRECT_CONTEXTUAL_ACK_DELIVERY_MODE,
      localShadowLockEnabled: true,
      ...activationOverrides,
    },
    ...root,
  };
}

function plan(input: DirectContextualAcknowledgementExecutionInput, classification = deterministicDirectAcknowledgementClassification(input.message), sentReview: DirectReadonlySentReview = {
  reviewedAt: "2026-10-08T08:02:00.000Z",
  outcome: "no_relevant_owner_reply",
  isFreshReadonlyReview: true,
}) {
  return planDirectContextualAcknowledgement({
    message: input.message,
    project: input.project,
    activationStartedAt: input.activation.activationStartedAt,
    sentReview,
    classification,
  });
}

function fakeAdapter(options: {
  classification?: ReturnType<typeof deterministicDirectAcknowledgementClassification>;
  sentReview?: DirectReadonlySentReview;
  existingStatus?: DirectShadowLedgerStatus;
} = {}) {
  let record: DirectShadowLedgerRecord | null = options.existingStatus ? {
    id: 901,
    idempotencyKey: "existing-key",
    status: options.existingStatus,
    claimToken: options.existingStatus === "claimed" ? "active-worker" : null,
  } : null;
  const claim = vi.fn<DirectContextualAcknowledgementShadowAdapter["claim"]>(async input => {
    if (!record) {
      record = { id: 901, idempotencyKey: input.idempotencyKey, status: "claimed", claimToken: "claim-token" };
      return { claimed: true, record };
    }
    return { claimed: false, record };
  });
  const reviewSent = vi.fn<DirectContextualAcknowledgementShadowAdapter["reviewSent"]>(async () => options.sentReview || {
    reviewedAt: "2026-10-08T08:02:00.000Z",
    outcome: "no_relevant_owner_reply",
    isFreshReadonlyReview: true,
  });
  const classify = vi.fn<DirectContextualAcknowledgementShadowAdapter["classify"]>(async message =>
    options.classification || deterministicDirectAcknowledgementClassification(message));
  const complete = vi.fn<DirectContextualAcknowledgementShadowAdapter["complete"]>(async completion => {
    if (record) record = { ...record, status: completion.status, claimToken: completion.claimToken };
  });
  return { adapter: { claim, reviewSent, classify, complete }, claim, reviewSent, classify, complete };
}

describe("COMO direct contextual acknowledgement shadow path", () => {
  it("keeps the independent path dormant, unmounted, and incapable of live delivery", () => {
    expect(DIRECT_CONTEXTUAL_ACK_DELIVERY_MODE).toBe("shadow_only");
    expect(service).not.toMatch(/sendReply\s*\(|sendMail\s*\(|createTransport\s*\(|saveComoMailboxDraft\s*\(|imap\.append\s*\(/i);
    expect(service).not.toContain("process.env.COMO_OUTBOUND_EMAIL_ENABLED");
    expect(scheduledRoute).not.toContain("comoDirectContextualAcknowledgments");
    expect(saraBriefings).not.toContain("comoDirectContextualAcknowledgments");
    expect(isDirectContextualAcknowledgementShadowEnabled({})).toBe(false);
    expect(isDirectContextualAcknowledgementShadowEnabled({ COMO_DIRECT_CONTEXTUAL_ACK_SHADOW_ENABLED: "true" })).toBe(true);
  });

  it("permits only a post-watermark, verified COMO INBOX courtesy as a shadow candidate", () => {
    const input = executionInput();
    const result = plan(input);

    expect(result).toMatchObject({
      disposition: "shadow_courtesy_candidate",
      reason: "eligible_contextual_courtesy",
      deliveryMode: "shadow_only",
      externalDeliveryAuthorized: false,
      projectId: 11,
      workFileId: 22,
      shadowReply: {
        to: "consultant@example.com",
        cc: "wael@zooma.ae",
        subject: "Re: Thank you",
        inReplyTo: "<inbound-201@example.com>",
      },
      saraShadowIntent: null,
    });
    expect(isNonCommittingAcknowledgementText(result.shadowReply?.body || "")).toBe(true);
    expect(result.shadowReply?.body).toContain("I appreciate you taking the time to write");
  });

  it("does not copy Mia on an ordinary reply addressed to Wael", () => {
    const input = executionInput({ message: { fromEmail: "wael@zooma.ae", toText: "a.zaqout@comodevelopments.com", ccText: "" } });
    const result = plan(input);
    expect(result.shadowReply?.to).toBe("wael@zooma.ae");
    expect(result.shadowReply?.cc).toBe("");
  });

  it("uses immutable message identity for a durable idempotency key", () => {
    const first = executionInput();
    const renamed = executionInput({ message: { id: 999, subject: "Different subject" } });
    const different = executionInput({ message: { messageIdentitySha256: "b".repeat(64) } });

    expect(directContextualAcknowledgementIdempotencyKey(first.message))
      .toBe(directContextualAcknowledgementIdempotencyKey(renamed.message));
    expect(directContextualAcknowledgementIdempotencyKey(first.message))
      .not.toBe(directContextualAcknowledgementIdempotencyKey(different.message));
  });

  it.each([
    ["financial", "Invoice 104", "Please confirm payment of AED 45,000."],
    ["legal", "Agreement revision", "Please review the revised contract and sign off."],
    ["schedule", "Meeting confirmation", "The meeting is confirmed for tomorrow at 10:00 AM."],
    ["decision", "Approval", "Please approve the selected proposal."],
  ])("routes %s matters to a shadow draft-plus-Sara intent and never a delivery", (_kind, subject, bodyText) => {
    const result = plan(executionInput({ message: { subject, bodyText } }));

    expect(result).toMatchObject({
      disposition: "shadow_draft_and_notify_sara",
      reason: "high_stakes_requires_draft",
      externalDeliveryAuthorized: false,
      shadowReply: { idempotencyKey: result.idempotencyKey },
      saraShadowIntent: { idempotencyKey: `${result.idempotencyKey}:sara-shadow`, emailId: 201, projectId: 11, workFileId: 22 },
    });
    expect(isNonCommittingAcknowledgementText(result.shadowReply?.body || "")).toBe(true);
  });

  it("never upgrades questions, requests, commitments, long ambiguity, or automated wording to direct courtesy", () => {
    for (const bodyText of [
      "Could you send the drawing?",
      "We need the company profile.",
      "We will proceed after your confirmation.",
      "Thank you. Please see the detailed technical comments attached for review and action.",
      "Automatic reply: thank you, noted.",
    ]) {
      const classification = deterministicDirectAcknowledgementClassification({
        fromEmail: bodyText.startsWith("Automatic") ? "no-reply@example.com" : "consultant@example.com",
        subject: "Update",
        bodyText,
      });
      expect(classification.isClearCourtesyOnly).toBe(false);
    }
  });

  it("rejects the wrong mailbox, pre-watermark history, non-INBOX folders, missing raw header proof, and unverified project/file", () => {
    expect(plan(executionInput({ message: { mailboxVerified: false } }))).toMatchObject({ disposition: "skip", reason: "not_como_mailbox" });
    expect(plan(executionInput({ message: { receivedAt: "2026-10-08T07:59:59.000Z" } }))).toMatchObject({ disposition: "skip", reason: "historical_message" });
    expect(plan(executionInput({ message: { folderName: "Sent" } }))).toMatchObject({ disposition: "skip", reason: "not_new_inbox_message" });
    expect(plan(executionInput({ message: { systemSignal: "unknown" } }))).toMatchObject({ disposition: "skip", reason: "system_or_unverified_sender" });
    expect(plan(executionInput({ message: { fromSignalVerified: false } }))).toMatchObject({ disposition: "skip", reason: "system_or_unverified_sender" });
    expect(plan(executionInput({ project: { status: "suggested", accessVerified: false } }))).toMatchObject({ disposition: "manual_review", reason: "project_or_work_file_not_verified" });
  });

  it("requires a fresh, safe read-only Sent review before proposing any reply", () => {
    const input = executionInput();
    expect(plan(input, undefined, { reviewedAt: "2026-10-08T08:02:00.000Z", isFreshReadonlyReview: true, outcome: "owner_reply_present" }))
      .toMatchObject({ disposition: "manual_review", reason: "sent_history_not_safe", shadowReply: null });
    expect(plan(input, undefined, { reviewedAt: null, isFreshReadonlyReview: false, outcome: "not_reviewed" }))
      .toMatchObject({ disposition: "manual_review", reason: "sent_history_not_safe", shadowReply: null });
  });

  it("durably claims once, performs Sent review and classification once, and replays without proposing a duplicate", async () => {
    const fake = fakeAdapter();
    const input = executionInput();
    const first = await processDirectContextualAcknowledgementShadowWithAdapter(input, fake.adapter);
    const replay = await processDirectContextualAcknowledgementShadowWithAdapter(input, fake.adapter);

    expect(first).toMatchObject({ status: "shadow_courtesy_candidate", ledgerId: 901, externalDeliveryAuthorized: false });
    expect(replay).toEqual({ status: "replayed", plan: null, ledgerId: 901, externalDeliveryAuthorized: false });
    expect(fake.reviewSent).toHaveBeenCalledTimes(1);
    expect(fake.classify).toHaveBeenCalledTimes(1);
    expect(fake.complete).toHaveBeenCalledTimes(1);
  });

  it("does no claim, Sent review, classifier call, or shadow write without the separate local lock", async () => {
    const fake = fakeAdapter();
    const result = await processDirectContextualAcknowledgementShadowWithAdapter(executionInput({
      activation: { localShadowLockEnabled: false },
    }), fake.adapter);

    expect(result).toEqual({ status: "disabled", plan: null, ledgerId: null, externalDeliveryAuthorized: false });
    expect(fake.claim).not.toHaveBeenCalled();
    expect(fake.reviewSent).not.toHaveBeenCalled();
    expect(fake.classify).not.toHaveBeenCalled();
    expect(fake.complete).not.toHaveBeenCalled();
  });

  it("does not claim, inspect Sent, call the LLM, or write a shadow record for structural rejection", async () => {
    const fake = fakeAdapter();
    const result = await processDirectContextualAcknowledgementShadowWithAdapter(executionInput({
      message: { mailboxVerified: false },
    }), fake.adapter);

    expect(result).toMatchObject({ status: "skipped", plan: { reason: "not_como_mailbox" } });
    expect(fake.claim).not.toHaveBeenCalled();
    expect(fake.reviewSent).not.toHaveBeenCalled();
    expect(fake.classify).not.toHaveBeenCalled();
    expect(fake.complete).not.toHaveBeenCalled();
  });

  it("does not claim, inspect Sent, or classify pre-watermark history", async () => {
    const fake = fakeAdapter();
    const result = await processDirectContextualAcknowledgementShadowWithAdapter(executionInput({
      message: { receivedAt: "2026-10-08T07:59:59.000Z" },
    }), fake.adapter);

    expect(result).toMatchObject({ status: "skipped", ledgerId: null, plan: { reason: "historical_message" } });
    expect(fake.claim).not.toHaveBeenCalled();
    expect(fake.reviewSent).not.toHaveBeenCalled();
    expect(fake.classify).not.toHaveBeenCalled();
    expect(fake.complete).not.toHaveBeenCalled();
  });
});
