import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  CONTEXTUAL_ACKNOWLEDGMENT_ACTIVATION_BLOCKERS,
  CONTEXTUAL_ACKNOWLEDGMENT_DELIVERY_MODE,
  classifyContextualAcknowledgment,
  contextualAcknowledgmentIdempotencyKey,
  planContextualAcknowledgment,
  processContextualAcknowledgmentWithAdapter,
  type ContextualAcknowledgmentAdapter,
  type ContextualAcknowledgmentExecutionInput,
  type ContextualAcknowledgmentLedgerRecord,
  type ContextualAcknowledgmentLedgerStatus,
  type ContextualAcknowledgmentInput,
} from "./services/comoNextContextualAcknowledgments";

const service = readFileSync("server/services/comoNextContextualAcknowledgments.ts", "utf8");
const scheduledRoute = readFileSync("server/scheduledEmailSyncRoute.ts", "utf8");
const saraBriefings = readFileSync("server/services/saraBriefings.ts", "utf8");
const migration = readFileSync("drizzle/0098_como_next_contextual_acknowledgments.sql", "utf8");

const ACTIVATION = "2026-10-08T08:00:00.000Z";

function input(overrides: Partial<ContextualAcknowledgmentInput> & {
  message?: Partial<ContextualAcknowledgmentInput["message"]>;
  project?: Partial<ContextualAcknowledgmentInput["project"]>;
  sentReview?: Partial<ContextualAcknowledgmentInput["sentReview"]>;
} = {}): ContextualAcknowledgmentInput {
  const { message: messageOverrides, project: projectOverrides, sentReview: sentReviewOverrides, ...rootOverrides } = overrides;
  return {
    activationStartedAt: ACTIVATION,
    message: {
      id: 17,
      userId: 1,
      messageIdentitySha256: "a".repeat(64),
      folderName: "INBOX",
      fromEmail: "consultant@example.com",
      fromName: "Consultant",
      toText: "a.zaqout@comodevelopments.com, colleague@consultant.com",
      ccText: "director@consultant.com",
      subject: "Thank you",
      bodyText: "Thank you, noted.",
      messageId: "<inbound-17@example.com>",
      receivedAt: "2026-10-08T08:01:00.000Z",
      systemSignal: "known_non_system",
      ...messageOverrides,
    },
    project: {
      status: "verified",
      projectId: 11,
      workFileId: 22,
      projectName: "Majan",
      accessVerified: true,
      ...projectOverrides,
    },
    sentReview: {
      reviewedAt: "2026-10-08T08:02:00.000Z",
      outcome: "no_relevant_owner_reply",
      isFreshReadonlyReview: true,
      ...sentReviewOverrides,
    },
    ...rootOverrides,
  };
}

function executionInput(overrides: Partial<ContextualAcknowledgmentExecutionInput> & {
  message?: Partial<ContextualAcknowledgmentExecutionInput["message"]>;
  project?: Partial<ContextualAcknowledgmentExecutionInput["project"]>;
} = {}): ContextualAcknowledgmentExecutionInput {
  const { message: messageOverrides, project: projectOverrides, ...rootOverrides } = overrides;
  const planned = input({ message: messageOverrides, project: projectOverrides });
  return {
    message: planned.message,
    project: planned.project,
    activation: {
      activationStartedAt: planned.activationStartedAt,
      deliveryMode: CONTEXTUAL_ACKNOWLEDGMENT_DELIVERY_MODE,
    },
    ...rootOverrides,
  };
}

function fakeAdapter(options: {
  sentReview?: ContextualAcknowledgmentInput["sentReview"];
  existingStatus?: ContextualAcknowledgmentLedgerStatus | null;
} = {}) {
  let record: ContextualAcknowledgmentLedgerRecord | null = options.existingStatus ? {
    id: 801,
    idempotencyKey: "existing",
    status: options.existingStatus,
    claimToken: options.existingStatus === "claimed" ? "active-worker-token" : null,
    communicationId: options.existingStatus === "draft_ready" ? 501 : null,
    saraProposalId: options.existingStatus === "draft_and_sara_ready" ? 601 : null,
  } : null;
  const claims = vi.fn<ContextualAcknowledgmentAdapter["claim"]>(async claim => {
    if (!record) {
      record = { id: 801, idempotencyKey: claim.idempotencyKey, status: "claimed", claimToken: "claim-token-1", communicationId: null, saraProposalId: null };
      return { claimed: true, record };
    }
    if (record.status === "failed") {
      record = { ...record, status: "claimed", claimToken: "claim-token-retry" };
      return { claimed: true, record };
    }
    return { claimed: false, record };
  });
  const reviewSent = vi.fn<ContextualAcknowledgmentAdapter["reviewSent"]>(async () => options.sentReview || {
    reviewedAt: "2026-10-08T08:02:00.000Z",
    outcome: "no_relevant_owner_reply",
    isFreshReadonlyReview: true,
  });
  const saveDraft = vi.fn<ContextualAcknowledgmentAdapter["saveDraft"]>(async () => ({
    communicationId: 501,
    mailboxDraftRef: "Drafts UID 700",
  }));
  const recordSaraReview = vi.fn<ContextualAcknowledgmentAdapter["recordSaraReview"]>(async () => ({ proposalId: 601 }));
  const complete = vi.fn<ContextualAcknowledgmentAdapter["complete"]>(async completion => {
    if (record) {
      record = {
        ...record,
        status: completion.status,
        claimToken: completion.claimToken,
        communicationId: completion.communicationId ?? record.communicationId,
        saraProposalId: completion.saraProposalId ?? record.saraProposalId,
      };
    }
  });
  return { adapter: { claim: claims, reviewSent, saveDraft, recordSaraReview, complete }, claims, reviewSent, saveDraft, recordSaraReview, complete };
}

describe("COMO contextual acknowledgments — conservative planning only", () => {
  it("permits only a newly imported, non-system INBOX courtesy as a non-delivery candidate", () => {
    const plan = planContextualAcknowledgment(input());

    expect(plan).toMatchObject({
      disposition: "auto_ack_candidate",
      reason: "eligible_contextual_courtesy",
      externalDeliveryAuthorized: false,
      projectId: 11,
      workFileId: 22,
      draft: {
        to: "consultant@example.com",
        cc: "colleague@consultant.com, director@consultant.com, wael@zooma.ae",
        subject: "Re: Thank you",
        inReplyTo: "<inbound-17@example.com>",
      },
      saraAlert: null,
    });
    expect(plan.draft?.body).toContain("has been noted");
    expect(plan.draft?.body).toContain("Abdalrahman Zaqout");
  });

  it("uses a message-identity idempotency key rather than mutable subject or UID", () => {
    const first = input();
    const renamed = input({ message: { subject: "Completely different subject", id: 999 } });
    const otherMessage = input({ message: { messageIdentitySha256: "b".repeat(64) } });

    expect(contextualAcknowledgmentIdempotencyKey(first.message)).toBe(contextualAcknowledgmentIdempotencyKey(renamed.message));
    expect(contextualAcknowledgmentIdempotencyKey(first.message)).not.toBe(contextualAcknowledgmentIdempotencyKey(otherMessage.message));
    expect(planContextualAcknowledgment(first).idempotencyKey).toMatch(/^como-contextual-ack:v1:[a-f0-9]{64}$/);
  });

  it("never treats Sent, Drafts, or a pre-activation message as an auto-ack candidate", () => {
    expect(planContextualAcknowledgment(input({ message: { folderName: "Sent" } })).reason).toBe("not_new_inbox_message");
    expect(planContextualAcknowledgment(input({ message: { folderName: "Drafts" } })).reason).toBe("not_new_inbox_message");
    const historical = planContextualAcknowledgment(input({ message: { receivedAt: "2026-10-08T07:59:59.000Z" } }));
    expect(historical).toMatchObject({ disposition: "skip", reason: "historical_message", draft: null, saraAlert: null });
  });

  it("rejects system and unverified sender signals rather than guessing", () => {
    expect(planContextualAcknowledgment(input({ message: { systemSignal: "known_system", fromEmail: "no-reply@example.com" } })).reason)
      .toBe("system_or_unverified_sender");
    expect(planContextualAcknowledgment(input({ message: { systemSignal: "unknown" } })).reason)
      .toBe("system_or_unverified_sender");
  });

  it.each([
    ["appointment", "Meeting confirmation", "The meeting is confirmed for tomorrow at 10:00 AM."],
    ["financial", "Invoice 104", "Please confirm payment of AED 45,000."],
    ["contract", "Agreement revision", "Please review the revised contract and sign off."],
    ["question", "Technical query", "Could you confirm which drawing should be issued?"],
    ["change", "Updated proposal", "Please note the revision changes the scope."],
  ])("routes %s matters to a draft and Sara, never auto-acknowledgment", (_kind, subject, bodyText) => {
    const plan = planContextualAcknowledgment(input({ message: { subject, bodyText } }));

    expect(plan).toMatchObject({
      disposition: "draft_and_notify_sara",
      reason: "high_stakes_requires_draft",
      externalDeliveryAuthorized: false,
      draft: { draftKey: plan.idempotencyKey },
      saraAlert: { emailId: 17, projectId: 11, workFileId: 22, idempotencyKey: `${plan.idempotencyKey}:sara` },
    });
    expect(plan.draft?.body).toContain("before confirming any next step");
  });

  it("places a request or promise in Draft plus Sara even when it is not a high-stakes category", () => {
    const request = planContextualAcknowledgment(input({
      message: { subject: "Document", bodyText: "We need the company profile." },
    }));
    const commitment = planContextualAcknowledgment(input({
      message: { subject: "Update", bodyText: "We will proceed after your confirmation." },
    }));

    expect(request).toMatchObject({ disposition: "draft_and_notify_sara", reason: "request_or_commitment_requires_draft" });
    expect(commitment).toMatchObject({ disposition: "draft_and_notify_sara", externalDeliveryAuthorized: false });
  });

  it("refuses ambiguous content, an unverified project, or missing/failing Sent review", () => {
    const unknown = planContextualAcknowledgment(input({ message: { subject: "Hello", bodyText: "Please see below." } }));
    const ambiguousProject = planContextualAcknowledgment(input({ project: { status: "suggested" } }));
    const oldOwnerReply = planContextualAcknowledgment(input({ sentReview: { outcome: "owner_reply_present" } }));
    const staleReview = planContextualAcknowledgment(input({ sentReview: { isFreshReadonlyReview: false } }));

    expect(unknown).toMatchObject({ disposition: "draft_and_notify_sara", reason: "high_stakes_requires_draft" });
    expect(ambiguousProject).toMatchObject({ disposition: "manual_review", reason: "project_not_verified" });
    expect(oldOwnerReply).toMatchObject({ disposition: "manual_review", reason: "sent_history_not_safe" });
    expect(staleReview).toMatchObject({ disposition: "manual_review", reason: "sent_history_not_safe" });
  });

  it("applies the existing Wael policy exactly: Wael on correspondence, Mia only for a verified Wael appointment", () => {
    const ordinary = planContextualAcknowledgment(input());
    const appointment = planContextualAcknowledgment(input({ project: { verifiedWaelAppointment: true } }));
    const waelPrimary = planContextualAcknowledgment(input({ message: { fromEmail: "wael@zooma.ae", toText: "a.zaqout@comodevelopments.com", ccText: "" } }));

    expect(ordinary.draft?.cc).toContain("wael@zooma.ae");
    expect(ordinary.draft?.cc).not.toContain("pa@zooma.ae");
    expect(appointment.draft?.cc).toContain("wael@zooma.ae");
    expect(appointment.draft?.cc).toContain("pa@zooma.ae");
    expect(waelPrimary.draft?.cc).toBe("");
  });

  it("keeps SMTP locked: the production path is Draft-only and is not mounted by the existing scheduled route", () => {
    expect(service).not.toMatch(/sendReply\s*\(|sendMail\s*\(|createTransport\s*\(|imap\.append\s*\(/i);
    expect(service).not.toMatch(/node-cron|setInterval|app\.post\(/i);
    expect(service).toContain('CONTEXTUAL_ACKNOWLEDGMENT_DELIVERY_MODE = "draft_only"');
    expect(service).toContain("processContextualAcknowledgmentWithAdapter");
    expect(service).toContain("reviewContextualAcknowledgmentSentHistory");
    expect(CONTEXTUAL_ACKNOWLEDGMENT_ACTIVATION_BLOCKERS).toEqual(expect.arrayContaining([
      "additive_database_ledger_with_unique_idempotency_key_required",
      "persisted_activation_watermark_required_to_exclude_history",
      "fresh_readonly_sent_thread_review_required",
      "no_live_smtp_or_general_outbound_unlock",
    ]));
    expect(scheduledRoute).not.toContain("comoNextContextualAcknowledgments");
    expect(saraBriefings).not.toContain("comoNextContextualAcknowledgments");
  });

  it("labels an automated sender as uncertain even if a caller incorrectly calls it non-system", () => {
    const classification = classifyContextualAcknowledgment({
      fromEmail: "no-reply@vendor.example",
      subject: "Automatic reply",
      bodyText: "Thank you, noted.",
    });
    expect(classification).toMatchObject({ uncertain: true });
    expect(classification.labels).toContain("automation_signal");
  });

  it("claims durably, performs a fresh Sent review, and saves a benign courtesy only as a Draft", async () => {
    const fake = fakeAdapter();
    const result = await processContextualAcknowledgmentWithAdapter(executionInput(), fake.adapter);

    expect(result).toMatchObject({
      status: "draft_ready",
      ledgerId: 801,
      communicationId: 501,
      saraProposalId: null,
      externalDeliveryAuthorized: false,
      plan: { disposition: "auto_ack_candidate", reason: "eligible_contextual_courtesy" },
    });
    expect(fake.claims).toHaveBeenCalledTimes(1);
    expect(fake.reviewSent).toHaveBeenCalledTimes(1);
    expect(fake.saveDraft).toHaveBeenCalledTimes(1);
    expect(fake.recordSaraReview).not.toHaveBeenCalled();
    expect(fake.complete).toHaveBeenLastCalledWith(expect.objectContaining({
      status: "draft_ready",
      communicationId: 501,
      mailboxDraftRef: "Drafts UID 700",
    }));
  });

  it("does not repeat Sent review, Draft creation, or a Sara record after a final durable ledger outcome", async () => {
    const fake = fakeAdapter({ existingStatus: "draft_and_sara_ready" });
    const result = await processContextualAcknowledgmentWithAdapter(executionInput(), fake.adapter);

    expect(result).toEqual(expect.objectContaining({
      status: "replayed",
      communicationId: null,
      saraProposalId: 601,
      externalDeliveryAuthorized: false,
    }));
    expect(fake.reviewSent).not.toHaveBeenCalled();
    expect(fake.saveDraft).not.toHaveBeenCalled();
    expect(fake.recordSaraReview).not.toHaveBeenCalled();
    expect(fake.complete).not.toHaveBeenCalled();
  });

  it("records a Draft failure and safely resumes the same durable claim on retry", async () => {
    const fake = fakeAdapter();
    fake.saveDraft.mockRejectedValueOnce(new Error("draft_mailbox_temporarily_unavailable"));

    await expect(processContextualAcknowledgmentWithAdapter(executionInput(), fake.adapter))
      .rejects.toThrow("draft_mailbox_temporarily_unavailable");
    expect(fake.complete).toHaveBeenLastCalledWith(expect.objectContaining({
      status: "failed",
      lastError: "draft_mailbox_temporarily_unavailable",
    }));

    const retried = await processContextualAcknowledgmentWithAdapter(executionInput(), fake.adapter);
    expect(retried).toMatchObject({ status: "draft_ready", communicationId: 501, externalDeliveryAuthorized: false });
    expect(fake.saveDraft).toHaveBeenCalledTimes(2);
    expect(fake.recordSaraReview).not.toHaveBeenCalled();
  });

  it("creates a Draft and a review-only Sara record for a high-stakes inbound email", async () => {
    const fake = fakeAdapter();
    const result = await processContextualAcknowledgmentWithAdapter(executionInput({
      message: { subject: "Invoice 104", bodyText: "Please confirm payment of AED 45,000." },
    }), fake.adapter);

    expect(result).toMatchObject({
      status: "draft_and_sara_ready",
      communicationId: 501,
      saraProposalId: 601,
      externalDeliveryAuthorized: false,
      plan: { disposition: "draft_and_notify_sara", reason: "high_stakes_requires_draft" },
    });
    expect(fake.saveDraft).toHaveBeenCalledWith(expect.objectContaining({
      plan: expect.objectContaining({ externalDeliveryAuthorized: false }),
    }));
    expect(fake.recordSaraReview).toHaveBeenCalledTimes(1);
    expect(fake.complete).toHaveBeenLastCalledWith(expect.objectContaining({
      status: "draft_and_sara_ready",
      saraProposalId: 601,
    }));
  });

  it("stops at manual review when the fresh Sent check sees an owner reply", async () => {
    const fake = fakeAdapter({ sentReview: {
      reviewedAt: "2026-10-08T08:02:00.000Z",
      outcome: "owner_reply_present",
      isFreshReadonlyReview: true,
    } });
    const result = await processContextualAcknowledgmentWithAdapter(executionInput(), fake.adapter);

    expect(result).toMatchObject({ status: "manual_review", externalDeliveryAuthorized: false, plan: { reason: "sent_history_not_safe" } });
    expect(fake.saveDraft).not.toHaveBeenCalled();
    expect(fake.recordSaraReview).not.toHaveBeenCalled();
    expect(fake.complete).toHaveBeenLastCalledWith(expect.objectContaining({ status: "manual_review" }));
  });

  it("does not inspect Sent or touch a Draft for a pre-activation historical message", async () => {
    const fake = fakeAdapter();
    const result = await processContextualAcknowledgmentWithAdapter(executionInput({
      message: { receivedAt: "2026-10-08T07:59:59.000Z" },
    }), fake.adapter);

    expect(result).toMatchObject({ status: "skipped", externalDeliveryAuthorized: false, plan: { reason: "historical_message" } });
    expect(fake.reviewSent).not.toHaveBeenCalled();
    expect(fake.saveDraft).not.toHaveBeenCalled();
    expect(fake.recordSaraReview).not.toHaveBeenCalled();
  });

  it("refuses all work when the only supported mode is not explicitly selected", async () => {
    const fake = fakeAdapter();
    const result = await processContextualAcknowledgmentWithAdapter(executionInput({
      activation: { activationStartedAt: ACTIVATION, deliveryMode: "not_enabled" as never },
    }), fake.adapter);

    expect(result).toEqual({ status: "disabled", plan: null, ledgerId: null, communicationId: null, saraProposalId: null, externalDeliveryAuthorized: false });
    expect(fake.claims).not.toHaveBeenCalled();
    expect(fake.saveDraft).not.toHaveBeenCalled();
  });

  it("ships an additive dormant migration with unique durable claims and no data or mail mutation", () => {
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS `como_next_contextual_acknowledgment_settings`");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS `como_next_contextual_acknowledgment_ledger`");
    expect(migration).toContain("UNIQUE (`idempotency_key`)");
    expect(migration).toContain("UNIQUE (`email_message_id`)");
    expect(migration).toContain("`is_enabled` tinyint NOT NULL DEFAULT 0");
    expect(migration).toContain("enum('draft_only')");
    const executableStatements = migration.match(/CREATE TABLE IF NOT EXISTS[\s\S]*?\);/gi) || [];
    expect(executableStatements).toHaveLength(2);
    expect(executableStatements.every(statement => /^CREATE TABLE IF NOT EXISTS/i.test(statement))).toBe(true);
  });
});
