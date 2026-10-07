import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const control = readFileSync("server/services/comoNextExecutiveControl.ts", "utf8");
const email = readFileSync("server/services/comoNextEmailInbox.ts", "utf8");
const emailRouter = readFileSync("server/routers/comoNextEmail.ts", "utf8");
const comoRouter = readFileSync("server/routers/comoNext.ts", "utf8");
const saraRouter = readFileSync("server/routers/saraRealtime.ts", "utf8");
const sara = readFileSync("server/services/saraRealtime.ts", "utf8");
const meetings = readFileSync("server/services/comoNextMeetings.ts", "utf8");
const kitchen = readFileSync("server/services/comoNextKitchen.ts", "utf8");
const schedule = readFileSync("server/scheduledEmailSyncRoute.ts", "utf8");

 describe("COMO executive control loop", () => {
  it("claims and executes open Manus work instead of leaving it in the kitchen", () => {
    expect(control).toContain('eq(comoNextActions.ownerType, "manus")');
    expect(control).toContain('eq(comoNextActions.actionStatus, "open")');
    expect(control).toContain('actionStatus: "in_progress"');
    expect(control).toContain('executionSource: "executive_control"');
    expect(control).toContain("executeExecutiveDirectiveCommand");
    expect(control).toContain('nextStatus: "completed_pending_verification"');
    expect(control).toContain('nextStatus: "verified"');
    expect(control).toContain("externalSideEffect: false");
    expect(control).not.toMatch(/sendMail|sendReply|smtp|payment|calendar/i);
  });

  it("uses one bounded loop for owner-approved Sara directives, email, and meeting evidence", () => {
    expect(comoRouter).toContain('trigger: "owner_update"');
    expect(comoRouter).toContain('trigger: "meeting_source"');
    expect(comoRouter).toContain('trigger: "proposal_review"');
    expect(saraRouter).toContain('stageExecutiveDirectiveCommand');
    expect(saraRouter).toContain('executionStarted: false');
    expect(email).toContain('trigger: "email_sync"');
    expect(emailRouter).toContain('trigger: "email_sync"');
    expect(control).toContain("operationCount >= maxItems");
    expect(control).toContain("activeRuns");
  });

  it("automatically analyzes meeting evidence and returns resulting Manus actions to the loop", () => {
    expect(meetings).toContain("autoAppliedActionIds");
    expect(control).toContain("result.autoAppliedActionIds.map(Number)");
    expect(comoRouter).toContain("meetingSourceIds: [Number(result.id)]");
    expect(comoRouter).toContain("meetingSourceIds: [Number(result.transcriptSourceId)]");
  });

  it("creates and executes a bounded preparation task when a future meeting is confirmed", () => {
    expect(email).toContain("ensureConfirmedMeetingPreparation");
    expect(email).toContain("confirmed-meeting-preparation:");
    expect(email).toContain('ownerType: "manus"');
    expect(email).toContain('actorType: "system"');
    expect(email).toContain("preparationActionId");
  });

  it("keeps only true decisions and external commitments for the owner", () => {
    expect(control).toContain('eq(comoNextIntakeProposals.proposalKind, "note")');
    expect(control).toContain('eq(comoNextIntakeProposals.proposalKind, "action")');
    expect(control).toContain('eq(comoNextIntakeProposals.ownerType, "manus")');
    expect(control).not.toContain('eq(comoNextIntakeProposals.proposalKind, "decision")');
    expect(control).not.toContain('eq(comoNextIntakeProposals.proposalKind, "communication_draft")');
  });

  it("forces Sara to read live meetings when asked about today", () => {
    expect(sara).toContain("يجب أن تستدعي lookup_executive_workspace");
    expect(sara).toContain("وتشمل فئة meetings صراحة");
    expect(sara).toContain("ممنوع الإجابة من ذاكرة الجلسة");
  });

  it("keeps Sara aligned with the kitchen by hiding future deferred attention until it is due", () => {
    const briefings = readFileSync("server/services/saraBriefings.ts", "utf8");
    expect(sara).toContain("d.due_at <= UTC_TIMESTAMP()");
    expect(sara).toContain("a.attention_at <= UTC_TIMESTAMP()");
    expect(briefings).toContain("d.due_at <= UTC_TIMESTAMP()");
    expect(briefings).toContain("a.attention_at <= UTC_TIMESTAMP()");
    expect(comoRouter).toContain("decisionNeedsAttentionNow");
    expect(control).toContain("lte(comoNextActions.attentionAt");
  });

  it("closes a past meeting when its outcome is recorded", () => {
    expect(kitchen).toContain('input.sourceChannel === "meeting"');
    expect(kitchen).toContain('meetingStatus: "completed"');
    expect(kitchen).toContain('eventType: "meeting_outcome_recorded"');
  });

  it("exposes the executive-control audit in scheduled sync without external side effects", () => {
    expect(schedule).toContain('app.post("/api/scheduled/como-next-executive"');
    expect(schedule).toContain('executedActionIds: result?.executedActionIds || []');
    expect(schedule).toContain("externalSideEffects: false");
    expect(schedule).not.toContain("sendReply");
  });
});
