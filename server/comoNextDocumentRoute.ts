import { createHash } from "node:crypto";
import type { Express } from "express";
import { asc, eq } from "drizzle-orm";
import { comoNextDocumentChunks, comoNextDocuments, comoNextMeetingSources, comoNextMeetings, comoNextProjectOpportunities, comoNextProjectOpportunityDocuments, comoNextWorkMemoryDocuments } from "../drizzle/schema";
import { getDb } from "./db";
import { requireProjectAccess } from "./services/comoNextCommands";
import { storageGet } from "./storage";
import { sdk } from "./_core/sdk";

export function registerComoNextDocumentRoute(app: Express) {
  app.get("/api/como-next/documents/:documentId", async (req, res) => {
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
    try {
      const documentId = Number(req.params.documentId);
      if (!Number.isInteger(documentId) || documentId <= 0) {
        res.status(400).send("Invalid document id");
        return;
      }
      const db = await getDb();
      if (!db) {
        res.status(503).send("Database unavailable");
        return;
      }
      const memoryLinks = await db
        .select({
          projectId: comoNextWorkMemoryDocuments.projectId,
          storageKey: comoNextDocuments.storageKey,
          fileName: comoNextDocuments.fileName,
          mimeType: comoNextDocuments.mimeType,
          byteSize: comoNextDocuments.byteSize,
          sha256: comoNextDocuments.sha256,
        })
        .from(comoNextWorkMemoryDocuments)
        .innerJoin(comoNextDocuments, eq(comoNextDocuments.id, comoNextWorkMemoryDocuments.documentId))
        .where(eq(comoNextWorkMemoryDocuments.documentId, documentId));
      const meetingLinks = await db
        .select({
          projectId: comoNextMeetings.projectId,
          storageKey: comoNextDocuments.storageKey,
          fileName: comoNextDocuments.fileName,
          mimeType: comoNextDocuments.mimeType,
          byteSize: comoNextDocuments.byteSize,
          sha256: comoNextDocuments.sha256,
        })
        .from(comoNextMeetingSources)
        .innerJoin(comoNextMeetings, eq(comoNextMeetings.id, comoNextMeetingSources.meetingId))
        .innerJoin(comoNextDocuments, eq(comoNextDocuments.id, comoNextMeetingSources.sourceDocumentId))
        .where(eq(comoNextMeetingSources.sourceDocumentId, documentId));
      const opportunityLinks = await db
        .select({
          userId: comoNextProjectOpportunities.userId,
          storageKey: comoNextDocuments.storageKey,
          fileName: comoNextDocuments.fileName,
          mimeType: comoNextDocuments.mimeType,
          byteSize: comoNextDocuments.byteSize,
          sha256: comoNextDocuments.sha256,
        })
        .from(comoNextProjectOpportunityDocuments)
        .innerJoin(comoNextProjectOpportunities, eq(comoNextProjectOpportunities.id, comoNextProjectOpportunityDocuments.opportunityId))
        .innerJoin(comoNextDocuments, eq(comoNextDocuments.id, comoNextProjectOpportunityDocuments.documentId))
        .where(eq(comoNextProjectOpportunityDocuments.documentId, documentId));
      const links = [
        ...memoryLinks,
        ...meetingLinks,
        ...opportunityLinks.map(({ userId: _userId, ...document }) => document),
      ];
      if (!links.length) {
        res.status(404).send("Document not found");
        return;
      }
      let allowed = false;
      for (const link of links) {
        if (!("projectId" in link)) continue;
        try {
          await requireProjectAccess(db, link.projectId, user.id, "read");
          allowed = true;
          break;
        } catch {
          // Continue in case the same document is linked to another accessible project.
        }
      }
      if (!allowed && opportunityLinks.some(link => Number(link.userId) === Number(user.id))) allowed = true;
      if (!allowed) {
        res.status(404).send("Document not found");
        return;
      }
      const chunks = await db
        .select({
          chunkIndex: comoNextDocumentChunks.chunkIndex,
          byteSize: comoNextDocumentChunks.byteSize,
          storageKey: comoNextDocumentChunks.storageKey,
          sha256: comoNextDocumentChunks.sha256,
        })
        .from(comoNextDocumentChunks)
        .where(eq(comoNextDocumentChunks.documentId, documentId))
        .orderBy(asc(comoNextDocumentChunks.chunkIndex));
      if (chunks.length) {
        res.status(200);
        res.set("Cache-Control", "private, no-store");
        res.set("Content-Type", links[0].mimeType);
        res.set("Content-Length", String(links[0].byteSize));
        res.set("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(links[0].fileName)}`);
        for (const chunk of chunks) {
          const { url } = await storageGet(chunk.storageKey);
          const response = await fetch(url, { headers: { "Cache-Control": "no-cache" } });
          if (!response.ok) throw new Error(`Chunk ${chunk.chunkIndex} unavailable (${response.status})`);
          const bytes = Buffer.from(await response.arrayBuffer());
          if (bytes.byteLength !== chunk.byteSize) throw new Error(`Chunk ${chunk.chunkIndex} size mismatch`);
          if (createHash("sha256").update(bytes).digest("hex") !== chunk.sha256) throw new Error(`Chunk ${chunk.chunkIndex} checksum mismatch`);
          res.write(bytes);
        }
        res.end();
        return;
      }
      const { url } = await storageGet(links[0].storageKey);
      const response = await fetch(url, { headers: { "Cache-Control": "no-cache" } });
      if (!response.ok) throw new Error(`Document unavailable (${response.status})`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.byteLength !== links[0].byteSize) throw new Error("Document size mismatch");
      if (createHash("sha256").update(bytes).digest("hex") !== links[0].sha256) throw new Error("Document checksum mismatch");
      res.status(200);
      res.set("Cache-Control", "private, no-store");
      res.set("Content-Type", links[0].mimeType);
      res.set("Content-Length", String(links[0].byteSize));
      res.set("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(links[0].fileName)}`);
      res.send(bytes);
    } catch (error) {
      console.error("[ComoNextDocument] download failed", error);
      if (res.headersSent) res.destroy();
      else res.status(502).send("Document delivery failed");
    }
  });
}
