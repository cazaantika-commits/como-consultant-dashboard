import type { Express, Request, Response } from "express";
import { and, asc, eq, isNull, lte, notInArray, or, sql } from "drizzle-orm";
import { comoNextActions, comoNextEmailSyncSettings, comoNextWorkFiles } from "../drizzle/schema";
import { sdk } from "./_core/sdk";
import { getDb } from "./db";
import { processPendingReadonlyMailboxCommand, reconcileConfirmedMeetingsFromEmailCommand, syncReadonlyInboxCommand } from "./services/comoNextEmailInbox";
import { runExecutiveControlLoopCommand } from "./services/comoNextExecutiveControl";
import { reconcileConditionalSentWatches } from "./services/comoNextConditionalSentWatches";
import { seedConditionalSentWatches } from "./services/comoNextConditionalSentWatchSeeder";

const nowSql = () => new Date().toISOString().slice(0, 19).replace("T", " ");

/** Match only the platform-signed cron identity to the phase's enabled row.
 * A request body can never supply or override this identity. */
async function resolveScheduledCaller(req: Request, mailboxKey: string) {
  let taskUid: string | undefined;
  try {
    const caller = await sdk.authenticateRequest(req);
    if (caller.isCron && caller.taskUid) taskUid = caller.taskUid;
  } catch {
    return { error: "cron_auth_required" as const };
  }
  if (!taskUid) return { error: "cron_auth_required" as const };
  const db = await getDb();
  if (!db) return { error: "database_unavailable" as const };
  const [settings] = await db.select().from(comoNextEmailSyncSettings)
    .where(eq(comoNextEmailSyncSettings.scheduleCronTaskUid, taskUid)).limit(1);
  if (!settings || settings.isEnabled !== 1 || settings.mailboxKey !== mailboxKey) {
    return { error: "disabled_or_unknown_task" as const };
  }
  return { db, settings };
}

function scheduledHandler(mailboxKey: "owner-primary" | "owner-primary-processing" | "owner-primary-executive") {
  return async (req: Request, res: Response) => {
    try {
      const resolved = await resolveScheduledCaller(req, mailboxKey);
      if ("error" in resolved) {
        res.status(resolved.error === "cron_auth_required" ? 403 : resolved.error === "database_unavailable" ? 503 : 200)
          .json({ error: resolved.error, skipped: resolved.error === "disabled_or_unknown_task" });
        return;
      }
      const { db, settings } = resolved;
      await db.update(comoNextEmailSyncSettings).set({ lastRunAt: nowSql(), lastStatus: "running", lastError: null }).where(eq(comoNextEmailSyncSettings.id, settings.id));
      try {
        if (mailboxKey === "owner-primary") {
          // Return as soon as the *read-only*, cursor-based import is durable.
          // No LLM, draft creation, or executive action runs before this ACK.
          const result = await syncReadonlyInboxCommand({ userId: settings.userId, hours: settings.lookbackHours, maxMessages: settings.maxMessages });
          await db.update(comoNextEmailSyncSettings).set({
            lastRunAt: nowSql(), lastSuccessAt: nowSql(), lastStatus: "success",
            lastScanned: result.scanned, lastImported: result.imported,
            lastDuplicates: result.duplicates, lastError: null,
          }).where(eq(comoNextEmailSyncSettings.id, settings.id));
          res.status(200).json({ ok: true, phase: "import", scanned: result.scanned, imported: result.imported, duplicates: result.duplicates, readOnly: true, serverFlagsChanged: false, externalSideEffects: false });
          return;
        }
        if (mailboxKey === "owner-primary-executive") {
          // Keep the IMAP import and one-LLM analysis callbacks below their own
          // timeouts. This separate phase owns actual, evidence-bound Manus work.
          // Never auto-apply historical/owner-gated proposals from this heartbeat.
          // Future-only, narrow request/quotation watches are durable internal
          // records, not messages. Resolve inbound replies before considering work.
          const seededWatches = await seedConditionalSentWatches({ userId: settings.userId, limit: 3 });
          const conditionalWatches = await reconcileConditionalSentWatches({ userId: settings.userId, limit: 3 });
          const candidates = await db.select({ id: comoNextActions.id, title: comoNextActions.title,
            description: comoNextActions.description, acceptanceCriteria: comoNextActions.acceptanceCriteria }).from(comoNextActions)
            .innerJoin(comoNextWorkFiles, eq(comoNextActions.workFileId, comoNextWorkFiles.id))
            .where(and(eq(comoNextActions.userId, settings.userId),
              eq(comoNextActions.ownerType, "manus"), eq(comoNextActions.actionStatus, "open"),
              or(isNull(comoNextActions.attentionAt), lte(comoNextActions.attentionAt, nowSql())),
              notInArray(comoNextWorkFiles.workFileStatus, ["closed", "cancelled", "waiting"]),
              sql`NOT EXISTS (SELECT 1 FROM como_next_decisions gate
                  WHERE gate.work_file_id = ${comoNextActions.workFileId}
                    AND (gate.decision_status = 'required' OR
                      (gate.decision_status = 'deferred' AND gate.due_at > UTC_TIMESTAMP())))`))
            .orderBy(sql`CASE ${comoNextActions.priority} WHEN 'urgent' THEN 0 WHEN 'important' THEN 1 ELSE 2 END`,
              asc(comoNextActions.createdAt), asc(comoNextActions.id)).limit(20);
          const eligible = candidates.find(row => !/(?:إرسال|أرسل|ارسل|رسالة|مراسلة|بريد|مسودة|دفع|سداد|توقيع|تعيين|\bsend\b|\breply\b|\bdraft\b|\bemail\b|\bpay\b|\bsign\b|\bappoint\w*)/i
            .test(`${row.title} ${row.description || ""} ${row.acceptanceCriteria || ""}`));
          const result = eligible ? await runExecutiveControlLoopCommand({
            userId: settings.userId, trigger: "email_sync", actionIds: [Number(eligible.id)], maxItems: 1,
          }) : null;
          if (result?.failures.length) throw new Error(`executive_action_failed:${result.failures[0].kind}`);
          await db.update(comoNextEmailSyncSettings).set({
            lastRunAt: nowSql(), lastSuccessAt: nowSql(), lastStatus: "success",
            lastScanned: eligible ? 1 : 0, lastImported: result?.executedActionIds.length || 0,
            lastDuplicates: 0, lastError: null,
          }).where(eq(comoNextEmailSyncSettings.id, settings.id));
          res.status(200).json({ ok: true, phase: "executive", selectedActionId: eligible ? Number(eligible.id) : null,
            executedActionIds: result?.executedActionIds || [], seededWatches, conditionalWatches, externalSideEffects: false });
          return;
        }
        // Separate, retryable callback; analyses are keyed by message ID and
        // unprocessed rows remain in the DB if a worker is interrupted.
        const meetingReconciliation = await reconcileConfirmedMeetingsFromEmailCommand({ userId: settings.userId, limit: 25 });
        const result = await processPendingReadonlyMailboxCommand({ userId: settings.userId, analysisLimit: 1 });
        await db.update(comoNextEmailSyncSettings).set({
          lastRunAt: nowSql(), lastSuccessAt: nowSql(), lastStatus: "success",
          lastScanned: result.pendingCandidates, lastImported: result.analyzed,
          lastDuplicates: 0, lastError: null,
        }).where(eq(comoNextEmailSyncSettings.id, settings.id));
        res.status(200).json({ ok: true, phase: "process", analyzed: result.analyzed, pendingCandidates: result.pendingCandidates,
          trustedLinked: result.trustedLinked, internalActionIds: result.internalActionIds,
          meetingReconciliation, readOnly: true, serverFlagsChanged: false, externalSideEffects: false });
      } catch (error) {
        const errorCode = typeof error === "object" && error !== null && "code" in error && typeof (error as { code?: unknown }).code === "string"
          ? String((error as { code: string }).code).slice(0, 60)
          : error instanceof Error ? error.name.slice(0, 60) : "unknown";
        const message = `scheduled_email_phase_failed:${errorCode}`;
        await db.update(comoNextEmailSyncSettings).set({ lastRunAt: nowSql(), lastStatus: "failed", lastError: message }).where(eq(comoNextEmailSyncSettings.id, settings.id));
        console.error("[COMO email heartbeat] failed", { phase: mailboxKey, message });
        res.status(500).json({ error: "scheduled_email_phase_failed", phase: mailboxKey });
      }
    } catch (error) {
      console.error("[COMO email heartbeat] callback rejected", error instanceof Error ? error.message : String(error));
      res.status(500).json({ error: "scheduled_callback_failed", phase: mailboxKey });
    }
  };
}

export function registerScheduledEmailSyncRoute(app: Express) {
  app.post("/api/scheduled/como-next-email-sync", scheduledHandler("owner-primary"));
  app.post("/api/scheduled/como-next-email-process", scheduledHandler("owner-primary-processing"));
  app.post("/api/scheduled/como-next-executive", scheduledHandler("owner-primary-executive"));
}
