import type { Express } from "express";
import { eq } from "drizzle-orm";
import { comoNextEmailSyncSettings } from "../drizzle/schema";
import { sdk } from "./_core/sdk";
import { getDb } from "./db";
import { syncAndAnalyzeReadonlyMailboxCommand } from "./services/comoNextEmailInbox";

function nowSql() {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

export function registerScheduledEmailSyncRoute(app: Express) {
  app.post("/api/scheduled/como-next-email-sync", async (req, res) => {
    let taskUid = "";
    try {
      try {
        const caller = await sdk.authenticateRequest(req);
        if (caller.isCron && caller.taskUid) taskUid = caller.taskUid;
      } catch {
        // Some deployed WebDev edges do not forward the cron cookie to Express.
        // The private Heartbeat payload is accepted only if its high-entropy
        // task UID exactly matches the enabled database configuration below.
      }
      if (!taskUid && typeof req.body?.taskUid === "string") taskUid = req.body.taskUid.trim();
      if (taskUid.length < 16) {
        res.status(403).json({ error: "cron_auth_required" });
        return;
      }
      const db = await getDb();
      if (!db) {
        res.status(503).json({ error: "database_unavailable" });
        return;
      }
      const [settings] = await db.select().from(comoNextEmailSyncSettings).where(eq(comoNextEmailSyncSettings.scheduleCronTaskUid, taskUid)).limit(1);
      if (!settings || settings.isEnabled !== 1) {
        res.status(200).json({ skipped: true, reason: "disabled_or_unknown_task" });
        return;
      }
      await db.update(comoNextEmailSyncSettings).set({ lastRunAt: nowSql(), lastStatus: "running", lastError: null }).where(eq(comoNextEmailSyncSettings.id, settings.id));
      try {
        const result = await syncAndAnalyzeReadonlyMailboxCommand({ userId: settings.userId, hours: settings.lookbackHours, maxMessages: settings.maxMessages, analysisLimit: 3 });
        await db.update(comoNextEmailSyncSettings).set({
          lastRunAt: nowSql(),
          lastSuccessAt: nowSql(),
          lastStatus: "success",
          lastScanned: result.scanned,
          lastImported: result.imported,
          lastDuplicates: result.duplicates,
          lastError: null,
        }).where(eq(comoNextEmailSyncSettings.id, settings.id));
        res.status(200).json({ ok: true, scanned: result.scanned, imported: result.imported, duplicates: result.duplicates, analyzed: result.analyzed, analysisFailures: result.analysisFailures, readOnly: true, serverFlagsChanged: false, externalSideEffects: false });
      } catch (error) {
        const message = error instanceof Error ? error.message.slice(0, 2000) : "scheduled_sync_failed";
        await db.update(comoNextEmailSyncSettings).set({ lastRunAt: nowSql(), lastStatus: "failed", lastError: message }).where(eq(comoNextEmailSyncSettings.id, settings.id));
        console.error("[ComoNextEmailHeartbeat] scheduled sync failed", { taskUid, message });
        res.status(500).json({ error: "scheduled_sync_failed" });
      }
    } catch (error) {
      console.error("[ComoNextEmailHeartbeat] callback rejected", { taskUid, error: error instanceof Error ? error.message : String(error) });
      res.status(403).json({ error: "invalid_scheduled_callback" });
    }
  });
}
