import type { Express, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { comoNextEmailSyncSettings } from "../drizzle/schema";
import { sdk } from "./_core/sdk";
import { getDb } from "./db";
import { processPendingReadonlyMailboxCommand, reconcileConfirmedMeetingsFromEmailCommand, syncReadonlyInboxCommand } from "./services/comoNextEmailInbox";

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

function scheduledHandler(mailboxKey: "owner-primary" | "owner-primary-processing") {
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
        // Separate, retryable callback; analyses are keyed by message ID and
        // unprocessed rows remain in the DB if a worker is interrupted.
        const meetingReconciliation = await reconcileConfirmedMeetingsFromEmailCommand({ userId: settings.userId, limit: 25 });
        const result = await processPendingReadonlyMailboxCommand({ userId: settings.userId, analysisLimit: 1 });
        await db.update(comoNextEmailSyncSettings).set({
          lastRunAt: nowSql(), lastSuccessAt: nowSql(), lastStatus: "success",
          lastScanned: result.pendingCandidates, lastImported: result.analyzed,
          lastDuplicates: 0, lastError: null,
        }).where(eq(comoNextEmailSyncSettings.id, settings.id));
        res.status(200).json({ ok: true, phase: "process", analyzed: result.analyzed, pendingCandidates: result.pendingCandidates, meetingReconciliation, readOnly: true, serverFlagsChanged: false, externalSideEffects: false });
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
}
