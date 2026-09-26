import type { Express } from "express";
import { eq } from "drizzle-orm";
import { projectStageDocuments, stageDocuments } from "../drizzle/schema";
import { sdk } from "./_core/sdk";
import { getDb } from "./db";
import { requireProjectAccess } from "./services/comoNextCommands";
import { storageGet } from "./storage";

function safeDisposition(fileName: string) {
  return `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

async function deliverLifecycleDocument(req: any, res: any, legacy: boolean) {
  let user;
  try {
    user = await sdk.authenticateRequest(req);
  } catch {
    res.status(401).send("Authentication required");
    return;
  }
  if (!user) {
    res.status(401).send("Authentication required");
    return;
  }

  const documentId = Number(req.params.documentId);
  if (!Number.isInteger(documentId) || documentId <= 0) {
    res.status(400).send("Invalid document id");
    return;
  }

  try {
    const db = await getDb();
    if (!db) {
      res.status(503).send("Database unavailable");
      return;
    }
    const [document] = legacy
      ? await db.select({
          projectId: stageDocuments.projectId,
          fileName: stageDocuments.fileName,
          fileKey: stageDocuments.fileKey,
          mimeType: stageDocuments.mimeType,
          byteSize: stageDocuments.fileSize,
        }).from(stageDocuments).where(eq(stageDocuments.id, documentId)).limit(1)
      : await db.select({
          projectId: projectStageDocuments.projectId,
          fileName: projectStageDocuments.fileName,
          fileKey: projectStageDocuments.fileKey,
          mimeType: projectStageDocuments.mimeType,
          byteSize: projectStageDocuments.fileSizeBytes,
        }).from(projectStageDocuments).where(eq(projectStageDocuments.id, documentId)).limit(1);

    if (!document) {
      res.status(404).send("Document not found");
      return;
    }
    await requireProjectAccess(db, document.projectId, user.id, "read");
    const { url } = await storageGet(document.fileKey);
    const response = await fetch(url, { headers: { "Cache-Control": "no-cache" } });
    if (!response.ok) throw new Error(`Lifecycle document unavailable (${response.status})`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (document.byteSize && bytes.byteLength !== document.byteSize) throw new Error("Lifecycle document size mismatch");

    res.status(200);
    res.set("Cache-Control", "private, no-store");
    res.set("Content-Type", document.mimeType || "application/octet-stream");
    res.set("Content-Length", String(bytes.byteLength));
    res.set("Content-Disposition", safeDisposition(document.fileName));
    res.send(bytes);
  } catch (error) {
    console.error("[LifecycleDocument] delivery failed", error);
    if (res.headersSent) res.destroy();
    else res.status(404).send("Document not found");
  }
}

export function registerLifecycleDocumentRoute(app: Express) {
  app.get("/api/lifecycle/documents/:documentId", (req, res) => deliverLifecycleDocument(req, res, false));
  app.get("/api/lifecycle/legacy-documents/:documentId", (req, res) => deliverLifecycleDocument(req, res, true));
}
