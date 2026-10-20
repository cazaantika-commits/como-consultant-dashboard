import { describe, expect, it } from "vitest";
import { buildComoKitchenSendEvidenceProjection, filterCancelledKitchenEmailSuggestions } from "./services/comoKitchenSendEvidence";

const sentCommunication = {
  id: 601,
  userId: 7,
  projectId: 11,
  workFileId: 13,
  channel: "email",
  direction: "outbound",
  communicationStatus: "sent",
  evidenceReference: "COMO Sent UID 224",
  externalMessageRef: "<como-601@example.test>",
};

const sentLedger = {
  id: 701,
  userId: 7,
  projectId: 11,
  workFileId: 13,
  communicationId: 601,
  state: "sent_confirmed",
  sentFolder: "Sent",
  sentUid: 224,
};

function sendAction(overrides: Record<string, unknown> = {}) {
  return {
    id: 501,
    userId: 7,
    projectId: 11,
    workFileId: 13,
    title: "مراجعة وإرسال طلب موعد التصحيح لكولييرز",
    description: "راجع المسودة ثم أرسلها من بريد COMO.",
    ownerType: "human",
    ownerUserId: 7,
    actionStatus: "open",
    attentionAt: "2099-01-01 00:00:00",
    ...overrides,
  };
}

function project(overrides: Record<string, unknown> = {}) {
  return buildComoKitchenSendEvidenceProjection({
    actions: [sendAction()],
    events: [{ actionId: 501, communicationId: 601 }],
    communications: [sentCommunication],
    ledgers: [sentLedger],
    sentMessages: [],
    nowMs: Date.parse("2026-10-20T12:00:00Z"),
    ...overrides,
  });
}

describe("COMO kitchen/Sara send-evidence projection", () => {
  it("removes a proven send request from the owner and keeps the external wait with Manus", () => {
    const result = project();
    const [action] = result.actions;

    expect(result.diagnostics).toEqual([]);
    expect(action).toMatchObject({
      id: 501,
      ownerType: "manus",
      ownerUserId: null,
      actionStatus: "waiting_external",
      sendEvidenceProjection: {
        state: "sent_confirmed",
        communicationId: 601,
        ledgerId: 701,
        sentFolder: "Sent",
        sentUid: 224,
        ownerPromptRemoved: true,
      },
    });
    expect(action?.title).toContain("تم الإرسال");
    expect(action?.title).not.toContain("مراجعة وإرسال");
  });

  it("keeps a delayed response as a Manus follow-up, never a request to resend", () => {
    const result = project({
      actions: [sendAction({ attentionAt: "2026-10-19 00:00:00" })],
    });
    const [action] = result.actions;

    expect(action).toMatchObject({ ownerType: "manus", actionStatus: "in_progress" });
    expect(action?.title).toContain("متابعة Manus لتأخر الرد");
    expect(action?.title).not.toContain("إرسال طلب موعد");
  });

  it("does not infer a relationship from an equal title or a Sent message alone", () => {
    const original = sendAction();
    const result = buildComoKitchenSendEvidenceProjection({
      actions: [original],
      events: [],
      communications: [sentCommunication],
      ledgers: [sentLedger],
      sentMessages: [{ id: 801, communicationId: 601, folderName: "Sent", imapUid: 224 }],
    });

    expect(result.actions[0]).toEqual(original);
    expect(result.diagnostics).toEqual([]);
  });

  it("does not label an ordinary explicitly linked Draft as missing or sent", () => {
    const draft = { ...sentCommunication, communicationStatus: "draft", evidenceReference: null, externalMessageRef: null };
    const result = project({
      communications: [draft],
      ledgers: [{ ...sentLedger, state: "draft_saved", sentFolder: null, sentUid: null }],
    });

    expect(result.actions[0]).toMatchObject({ ownerType: "human", actionStatus: "open", title: sendAction().title });
    expect(result.diagnostics).toEqual([]);
  });

  it("keeps unrelated payment, external waiting, and review work untouched after a linked send", () => {
    const payment = sendAction({
      id: 502,
      title: "متابعة تأكيد تنفيذ دفعة أرتك 5586",
      ownerType: "manus",
      ownerUserId: null,
      actionStatus: "waiting_external",
    });
    const review = sendAction({
      id: 503,
      title: "مراجعة التحليل الفني",
      ownerType: "manus",
      ownerUserId: null,
      actionStatus: "in_progress",
    });
    const result = project({ actions: [sendAction(), payment, review] });

    expect(result.actions[0]).toMatchObject({ ownerType: "manus", actionStatus: "waiting_external" });
    expect(result.actions[1]).toEqual(payment);
    expect(result.actions[2]).toEqual(review);
  });

  it("routes incomplete positive send evidence to Manus with draft_missing_unconfirmed and no owner resend", () => {
    const result = project({
      ledgers: [{ ...sentLedger, state: "draft_saved", sentFolder: null, sentUid: null }],
    });
    const [action] = result.actions;
    const [diagnostic] = result.diagnostics;

    expect(action).toMatchObject({ ownerType: "manus", ownerUserId: null, actionStatus: "in_progress" });
    expect(action?.title).toContain("تعارض دليل الإرسال");
    expect(diagnostic).toMatchObject({
      actionId: 501,
      communicationId: 601,
      communicationIds: [601],
      code: "draft_missing_unconfirmed",
      route: "manus_send_evidence_reconciliation",
      ownerType: "manus",
      requiresOwnerResend: false,
    });
    expect(diagnostic?.message).toContain("لا تطلب إعادة الإرسال");
  });

  it("does not choose between two explicit communication links and exposes an ambiguous Manus conflict", () => {
    const result = project({
      events: [{ actionId: 501, communicationId: 601 }, { actionId: 501, communicationId: 602 }],
      communications: [sentCommunication, { ...sentCommunication, id: 602 }],
      ledgers: [sentLedger, { ...sentLedger, id: 702, communicationId: 602 }],
    });
    const [action] = result.actions;
    const [diagnostic] = result.diagnostics;

    expect(action).toMatchObject({ ownerType: "manus", actionStatus: "in_progress" });
    expect(diagnostic).toMatchObject({
      communicationId: null,
      communicationIds: [601, 602],
      code: "ambiguous",
      route: "manus_send_evidence_reconciliation",
      requiresOwnerResend: false,
    });
  });

  it("removes only an owner-cancelled unmatched email suggestion, not the email record or a separate payment action", () => {
    const emails = [
      { id: 2010001, subject: "كشف الحساب", kitchenSuggestionCancelled: 1 },
      { id: 2070001, subject: "مطالبة السطوة", kitchenSuggestionCancelled: 0 },
    ];
    const payment = sendAction({
      id: 2040001,
      title: "متابعة تأكيد تنفيذ دفعة أرتك 5586",
      ownerType: "manus",
      ownerUserId: null,
      actionStatus: "waiting_external",
    });

    expect(filterCancelledKitchenEmailSuggestions(emails)).toEqual([emails[1]]);
    // The caller retains `emails` itself for the inbox/health surface.
    expect(emails).toHaveLength(2);
    expect(project({ actions: [payment] }).actions).toEqual([payment]);
  });
});
