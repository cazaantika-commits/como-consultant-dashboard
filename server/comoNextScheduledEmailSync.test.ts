import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { readonlyCursorAfterUid } from "./emailMonitor";
import { normalizeIntakeProposalDraft } from "./services/comoNextIntake";

const route = readFileSync("server/scheduledEmailSyncRoute.ts", "utf8");
const inbox = readFileSync("server/services/comoNextEmailInbox.ts", "utf8");
const imap = readFileSync("server/emailMonitor.ts", "utf8");

describe("COMO read-only scheduled mail phases", () => {
  it("advances UID only within one UIDVALIDITY and recovers after mailbox reset", () => {
    expect(readonlyCursorAfterUid({ lastUid: 459, uidValidity: "123" }, "123")).toBe(459);
    expect(readonlyCursorAfterUid({ lastUid: 459, uidValidity: "123" }, "124")).toBe(0);
    expect(readonlyCursorAfterUid(undefined, "123")).toBe(0);
    expect(readonlyCursorAfterUid({ lastUid: -1, uidValidity: "123" }, "123")).toBe(0);
    expect(imap).toContain('uid > afterUid');
    expect(imap).toContain('.sort((a, b) => a - b).slice(0, limit)');
    expect(imap).toContain('afterUid > 0 ? [["UID", `${afterUid + 1}:*`]] : [["SINCE", sinceValue]]');
    expect(imap).toContain('imap.openBox(folderName, true');
    expect(imap).toContain('markSeen: false');
    expect(imap).toContain('fail(parseError instanceof Error');
    expect(imap).toContain('if (fetchEnded && pendingParses === 0) imap.end()');
    expect(imap).toContain('fetch.once("end", () => { fetchEnded = true; closeWhenParsed(); })');
  });

  it("acknowledges the persisted IMAP import before any analysis or LLM work", () => {
    const importBlock = route.slice(route.indexOf('if (mailboxKey === "owner-primary")'), route.indexOf('if (mailboxKey === "owner-primary-executive")'));
    expect(route).toContain('app.post("/api/scheduled/como-next-email-sync"');
    expect(route).toContain('app.post("/api/scheduled/como-next-email-process"');
    expect(route).toContain('app.post("/api/scheduled/como-next-executive"');
    expect(importBlock).toContain('await syncReadonlyInboxCommand');
    expect(importBlock).toContain('res.status(200).json');
    expect(importBlock).not.toMatch(/await (analyzeEmailCommand|syncAndAnalyzeReadonlyMailboxCommand|runExecutiveControlLoopCommand|processPendingReadonlyMailboxCommand)/);
    expect(inbox).toContain('knownUids.has(message.uid) || knownHashes.has(identitySha)');
  });

  it("keeps a failed analysis retryable without creating automatic mailbox drafts", () => {
    const processor = inbox.slice(inbox.indexOf('export async function processPendingReadonlyMailboxCommand'), inbox.indexOf('export async function syncAndAnalyzeReadonlyMailboxCommand'));
    expect(processor).toContain('analysis_row.analysis_status = \'draft\'');
    expect(processor).toContain('mailbox-context-v1:${emailId}');
    expect(processor).toContain('suppressReplyDraft: true');
    expect(processor).toContain('model: "gemini-3-flash-preview"');
    expect(processor).toContain('if (analysisFailures) throw');
    expect(route).toContain('settings.mailboxKey !== mailboxKey');
    expect(route).toContain('lastStatus: "failed"');
  });

  it("executes eligible Manus work on a separate signed heartbeat, without applying stale owner-gated proposals", () => {
    const executive = route.slice(route.indexOf('if (mailboxKey === "owner-primary-executive")'), route.indexOf('// Separate, retryable callback'));
    expect(executive).toContain('await seedConditionalSentWatches');
    expect(executive).toContain('await reconcileConditionalSentWatches');
    expect(executive.indexOf('await seedConditionalSentWatches')).toBeLessThan(executive.indexOf('await reconcileConditionalSentWatches'));
    expect(executive.indexOf('await reconcileConditionalSentWatches')).toBeLessThan(executive.indexOf('runExecutiveControlLoopCommand'));
    expect(executive).toContain('runExecutiveControlLoopCommand');
    expect(executive).toContain('maxItems: 1');
    expect(executive).not.toContain('scanPending: true');
    expect(executive).toContain('notInArray(comoNextWorkFiles.workFileStatus, ["closed", "cancelled", "waiting"])');
    expect(executive).toContain('if (result?.failures.length) throw');
    expect(route).toContain('settings.mailboxKey !== mailboxKey');
  });

  it("normalizes untrusted model proposal fields without granting a new owner or due date", () => {
    const proposal = normalizeIntakeProposalDraft({
      kind: "note", title: "Meeting link", evidenceExcerpt: "Link received",
      ownerType: "assistant" as any, priority: "critical" as any,
      channel: "calendar" as any, dueAt: "not a date",
    });
    expect(proposal).toMatchObject({ kind: "note", ownerType: null, priority: "normal", channel: null, dueAt: null });
    expect(normalizeIntakeProposalDraft({ kind: "action", title: "x", evidenceExcerpt: "e", ownerType: "assistant" as any }).ownerType).toBeNull();
  });
});
