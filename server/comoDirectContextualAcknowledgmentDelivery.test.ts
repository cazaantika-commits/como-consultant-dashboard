import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  DIRECT_CONTEXTUAL_ACK_DELIVERY_MODE,
  directContextualAcknowledgementOutboundMessageId,
  isDirectContextualAcknowledgementDeliveryEnabled,
  processDirectContextualAcknowledgementDeliveryWithAdapter,
  type DirectContextualAcknowledgementDeliveryAdapter,
  type DirectDeliveryExecutionInput,
  type DirectDeliveryLedgerRecord,
  type DirectDeliveryLedgerStatus,
} from "./services/comoDirectContextualAcknowledgmentDelivery";
import { deterministicDirectAcknowledgementClassification } from "./services/comoDirectContextualAcknowledgments";

const service = readFileSync("server/services/comoDirectContextualAcknowledgmentDelivery.ts", "utf8");
const scheduledRoute = readFileSync("server/scheduledEmailSyncRoute.ts", "utf8");
const migration = readFileSync("drizzle/0099_como_next_direct_contextual_ack_delivery.sql", "utf8");
const ACTIVATION = "2026-10-08T08:00:00.000Z";

function executionInput(overrides: Partial<DirectDeliveryExecutionInput> & {
  message?: Partial<DirectDeliveryExecutionInput["message"]>;
  project?: Partial<DirectDeliveryExecutionInput["project"]>;
  activation?: Partial<DirectDeliveryExecutionInput["activation"]>;
} = {}): DirectDeliveryExecutionInput {
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
      toText: "a.zaqout@comodevelopments.com",
      ccText: "",
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
      localDeliveryLockEnabled: true,
      ...activationOverrides,
    },
    ...root,
  };
}

function fakeAdapter(options: {
  existingStatus?: DirectDeliveryLedgerStatus;
  sendError?: Error;
  sentReview?: { reviewedAt: string | null; outcome: "no_relevant_owner_reply" | "owner_reply_present" | "ambiguous" | "not_reviewed"; isFreshReadonlyReview: boolean };
} = {}) {
  let record: DirectDeliveryLedgerRecord | null = options.existingStatus ? {
    id: 911,
    idempotencyKey: "existing-key",
    status: options.existingStatus,
    claimToken: options.existingStatus === "claimed" ? "active-worker" : null,
    communicationId: options.existingStatus === "sent" ? 711 : null,
    saraProposalId: null,
    outboundMessageId: options.existingStatus === "sent" ? "<existing@example.com>" : null,
  } : null;
  const claim = vi.fn<DirectContextualAcknowledgementDeliveryAdapter["claim"]>(async input => {
    if (!record) {
      record = { id: 911, idempotencyKey: input.idempotencyKey, status: "claimed", claimToken: "claim-token", communicationId: null, saraProposalId: null, outboundMessageId: null };
      return { claimed: true, record };
    }
    return { claimed: false, record };
  });
  const reviewSent = vi.fn<DirectContextualAcknowledgementDeliveryAdapter["reviewSent"]>(async () => options.sentReview || ({
    reviewedAt: "2026-10-08T08:02:00.000Z", outcome: "no_relevant_owner_reply", isFreshReadonlyReview: true,
  }));
  const classify = vi.fn<DirectContextualAcknowledgementDeliveryAdapter["classify"]>(async message => deterministicDirectAcknowledgementClassification(message));
  const saveDraft = vi.fn<DirectContextualAcknowledgementDeliveryAdapter["saveDraft"]>(async () => ({ communicationId: 501, mailboxDraftRef: "Drafts UID 701" }));
  const recordSaraReview = vi.fn<DirectContextualAcknowledgementDeliveryAdapter["recordSaraReview"]>(async () => ({ proposalId: 601 }));
  const complete = vi.fn<DirectContextualAcknowledgementDeliveryAdapter["complete"]>(async completion => {
    if (record) record = { ...record, status: completion.status, communicationId: completion.communicationId ?? null, saraProposalId: completion.saraProposalId ?? null };
  });
  const beginSend = vi.fn<DirectContextualAcknowledgementDeliveryAdapter["beginSend"]>(async input => {
    if (record) record = { ...record, status: "sending", outboundMessageId: input.outboundMessageId };
  });
  const send = vi.fn<DirectContextualAcknowledgementDeliveryAdapter["send"]>(async () => {
    if (options.sendError) throw options.sendError;
    return { providerMessageId: "<provider@example.com>", response: "250 accepted", accepted: ["consultant@example.com"], rejected: [] };
  });
  const recordSent = vi.fn<DirectContextualAcknowledgementDeliveryAdapter["recordSent"]>(async () => {
    if (record) record = { ...record, status: "sent", communicationId: 711 };
    return { communicationId: 711, sentRecordRef: "communication:711" };
  });
  const markSendUncertain = vi.fn<DirectContextualAcknowledgementDeliveryAdapter["markSendUncertain"]>(async input => {
    if (record) record = { ...record, status: "send_uncertain", outboundMessageId: input.outboundMessageId };
  });
  return {
    adapter: { claim, reviewSent, classify, saveDraft, recordSaraReview, complete, beginSend, send, recordSent, markSendUncertain },
    claim, reviewSent, classify, saveDraft, recordSaraReview, complete, beginSend, send, recordSent, markSendUncertain,
  };
}

describe("COMO direct contextual acknowledgement delivery", () => {
  it("keeps the legacy general outbound lock untouched and independently gates the new path", () => {
    expect(DIRECT_CONTEXTUAL_ACK_DELIVERY_MODE).toBe("direct_courtesy_only");
    expect(service).not.toContain("assertOutboundEmailEnabled");
    expect(service).not.toContain("sendReply(");
    expect(service).not.toContain("saveComoMailboxDraft(");
    expect(service).not.toContain("COMO_OUTBOUND_EMAIL_ENABLED");
    expect(isDirectContextualAcknowledgementDeliveryEnabled({})).toBe(false);
    expect(isDirectContextualAcknowledgementDeliveryEnabled({ COMO_DIRECT_CONTEXTUAL_ACK_DELIVERY_ENABLED: "true" })).toBe(true);
    expect(scheduledRoute).toContain("processPendingDirectContextualAcknowledgementDeliveries");
    expect(scheduledRoute).toContain('scheduledHandler("owner-primary-processing")');
  });

  it("sends exactly one verified courtesy through the injected SMTP adapter with deterministic threading Message-ID and a sent record", async () => {
    const fake = fakeAdapter();
    const input = executionInput();
    const result = await processDirectContextualAcknowledgementDeliveryWithAdapter(input, fake.adapter);

    expect(result).toMatchObject({ status: "sent", ledgerId: 911, communicationId: 711, externalDeliveryAuthorized: true });
    expect(fake.reviewSent).toHaveBeenCalledTimes(1);
    expect(fake.classify).toHaveBeenCalledTimes(1);
    expect(fake.beginSend).toHaveBeenCalledTimes(1);
    expect(fake.send).toHaveBeenCalledTimes(1);
    expect(fake.recordSent).toHaveBeenCalledTimes(1);
    expect(fake.saveDraft).not.toHaveBeenCalled();
    expect(fake.send).toHaveBeenCalledWith(expect.objectContaining({
      inReplyTo: "<inbound-201@example.com>",
      to: "consultant@example.com",
      cc: "wael@zooma.ae",
      messageId: directContextualAcknowledgementOutboundMessageId(input.message),
      text: expect.stringContaining("I appreciate you taking the time to write"),
    }));
  });

  it("does not retry automatically after SMTP begins or claim delivery when SMTP fails ambiguously", async () => {
    const fake = fakeAdapter({ sendError: new Error("socket closed after DATA") });
    const input = executionInput();
    const first = await processDirectContextualAcknowledgementDeliveryWithAdapter(input, fake.adapter);
    const replay = await processDirectContextualAcknowledgementDeliveryWithAdapter(input, fake.adapter);

    expect(first).toMatchObject({ status: "send_uncertain", externalDeliveryAuthorized: false });
    expect(first.outboundMessageId).toBe(directContextualAcknowledgementOutboundMessageId(input.message));
    expect(fake.beginSend).toHaveBeenCalledTimes(1);
    expect(fake.send).toHaveBeenCalledTimes(1);
    expect(fake.recordSent).not.toHaveBeenCalled();
    expect(fake.markSendUncertain).toHaveBeenCalledWith(expect.objectContaining({ error: "socket closed after DATA" }));
    expect(replay).toMatchObject({ status: "replayed", externalDeliveryAuthorized: false, outboundMessageId: first.outboundMessageId });
    expect(fake.send).toHaveBeenCalledTimes(1);
  });

  it("routes a request to a Draft and a Sara review record without SMTP", async () => {
    const fake = fakeAdapter();
    const result = await processDirectContextualAcknowledgementDeliveryWithAdapter(executionInput({
      message: { subject: "Drawing", bodyText: "Could you send the updated drawing?" },
    }), fake.adapter);

    expect(result).toMatchObject({ status: "draft_and_sara_ready", communicationId: 501, saraProposalId: 601, externalDeliveryAuthorized: false });
    expect(fake.saveDraft).toHaveBeenCalledTimes(1);
    expect(fake.recordSaraReview).toHaveBeenCalledTimes(1);
    expect(fake.beginSend).not.toHaveBeenCalled();
    expect(fake.send).not.toHaveBeenCalled();
  });

  it("routes an unknown raw-header signal to Draft+Sara and never SMTP, while a missing inbound Message-ID also fails closed to Draft+Sara", async () => {
    const unknownHeaders = fakeAdapter();
    const unknownResult = await processDirectContextualAcknowledgementDeliveryWithAdapter(executionInput({
      message: { systemSignal: "unknown" },
    }), unknownHeaders.adapter);
    expect(unknownResult).toMatchObject({ status: "draft_and_sara_ready", externalDeliveryAuthorized: false });
    expect(unknownHeaders.send).not.toHaveBeenCalled();

    const missingMessageId = fakeAdapter();
    const noThreadResult = await processDirectContextualAcknowledgementDeliveryWithAdapter(executionInput({
      message: { messageId: null },
    }), missingMessageId.adapter);
    expect(noThreadResult).toMatchObject({ status: "draft_and_sara_ready", externalDeliveryAuthorized: false });
    expect(missingMessageId.send).not.toHaveBeenCalled();
  });

  it("does not claim or contact SMTP when the independent delivery lock is off", async () => {
    const fake = fakeAdapter();
    const result = await processDirectContextualAcknowledgementDeliveryWithAdapter(executionInput({
      activation: { localDeliveryLockEnabled: false },
    }), fake.adapter);
    expect(result).toMatchObject({ status: "disabled", externalDeliveryAuthorized: false });
    expect(fake.claim).not.toHaveBeenCalled();
    expect(fake.send).not.toHaveBeenCalled();
  });

  it("ships an unapplied additive migration with disabled settings, unique claims, pre-send Message-ID storage, and no data mutation", () => {
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS `como_next_direct_contextual_ack_delivery_settings`");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS `como_next_direct_contextual_ack_delivery_ledger`");
    expect(migration).toContain("`is_enabled` tinyint NOT NULL DEFAULT 0");
    expect(migration).toContain("`outbound_message_id` varchar(320) NULL");
    expect(migration).toContain("UNIQUE (`idempotency_key`)");
    expect(migration).toContain("UNIQUE (`email_message_id`)");
    expect(migration).toContain("UNIQUE (`outbound_message_id`)");
    const executable = migration.split("\n").filter(line => !line.trim().startsWith("--")).join("\n");
    expect(executable).not.toMatch(/^\s*(?:INSERT|UPDATE|DELETE|ALTER|DROP)\b/im);
  });
});
