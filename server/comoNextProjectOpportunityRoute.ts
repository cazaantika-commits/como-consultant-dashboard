import { createHash, randomUUID } from "node:crypto";
import type { Express } from "express";
import multer from "multer";
import { eq } from "drizzle-orm";
import { comoNextDocuments } from "../drizzle/schema";
import { sdk } from "./_core/sdk";
import { getDb } from "./db";
import {
  assertProjectOpeningOwner,
  attachOpportunityDocument,
  createOpportunityWithDocument,
  type OpportunityDocumentRole,
} from "./services/comoNextProjectOpening";
import { storagePut } from "./storage";

const allowedMimeTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "application/json",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const documentRoles = new Set<OpportunityDocumentRole>([
  "land_document",
  "developer_contract",
  "fact_sheet",
  "other_land_evidence",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (allowedMimeTypes.has(file.mimetype)) callback(null, true);
    else callback(new Error("نوع الملف غير مدعوم في بوابة المشروع"));
  },
});

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._\u0600-\u06FF-]/g, "_").slice(0, 240) || "land-document";
}

async function authenticate(req: any) {
  const user = await sdk.authenticateRequest(req);
  if (!user) throw new Error("AUTH_REQUIRED");
  assertProjectOpeningOwner(user);
  return user;
}

export function registerComoNextProjectOpportunityRoute(app: Express) {
  app.post("/api/como-next/project-opportunities/documents", upload.single("file"), async (req, res) => {
    let uploadedKey: string | null = null;
    try {
      const user = await authenticate(req);
      if (!req.file || req.file.size <= 0) {
        res.status(400).json({ error: "لا يمكن فتح فرصة مشروع دون وثيقة واحدة على الأقل" });
        return;
      }
      const role = String(req.body.documentRole || "land_document") as OpportunityDocumentRole;
      if (!documentRoles.has(role)) {
        res.status(400).json({ error: "تصنيف الوثيقة غير صالح" });
        return;
      }
      const opportunityIdRaw = String(req.body.opportunityId || "").trim();
      const opportunityId = opportunityIdRaw ? Number(opportunityIdRaw) : null;
      if (opportunityIdRaw && (!Number.isInteger(opportunityId) || Number(opportunityId) <= 0)) {
        res.status(400).json({ error: "معرف الفرصة غير صالح" });
        return;
      }

      const db = await getDb();
      if (!db) {
        res.status(503).json({ error: "قاعدة البيانات غير متاحة" });
        return;
      }
      const digest = createHash("sha256").update(req.file.buffer).digest("hex");
      const [existing] = await db.select().from(comoNextDocuments).where(eq(comoNextDocuments.sha256, digest)).limit(1);
      let documentId: number;
      let documentTitle: string;
      if (existing) {
        documentId = Number(existing.id);
        documentTitle = existing.title;
      } else {
        const fileName = safeFileName(req.file.originalname);
        uploadedKey = `como-next/private/project-opportunities/${randomUUID()}/${fileName}`;
        await storagePut(uploadedKey, req.file.buffer, req.file.mimetype || "application/octet-stream");
        const result = await db.insert(comoNextDocuments).values({
          title: req.file.originalname.slice(0, 1000),
          fileName: req.file.originalname.slice(0, 1000),
          mimeType: (req.file.mimetype || "application/octet-stream").slice(0, 255),
          byteSize: req.file.size,
          sha256: digest,
          storageKey: uploadedKey,
          storageUrl: "protected-proxy-only",
          sourceSystem: "como_next_project_opportunity",
          sourceKey: null,
          sourceUrl: null,
          importBatchId: null,
        });
        documentId = Number(result[0].insertId);
        documentTitle = req.file.originalname;
      }

      if (opportunityId) {
        const linked = await attachOpportunityDocument({ user, opportunityId, documentId, documentRole: role, sha256: digest });
        res.status(201).json({ success: true, opportunityId, documentId, opportunityDocumentId: linked.opportunityDocumentId, replayed: linked.replayed });
        return;
      }
      const created = await createOpportunityWithDocument({
        user,
        provisionalName: String(req.body.provisionalName || "").trim() || null,
        objective: String(req.body.objective || "").trim() || null,
        document: { id: documentId, title: documentTitle, sha256: digest },
        documentRole: role,
      });
      res.status(201).json({ success: true, ...created, documentId, replayedDocument: Boolean(existing) });
    } catch (error: any) {
      if (uploadedKey) {
        try { await storagePut(uploadedKey, "revoked-project-opportunity-upload", "text/plain"); } catch { /* best-effort tombstone */ }
      }
      const message = error?.message || "تعذر حفظ وثيقة المشروع";
      const status = message === "AUTH_REQUIRED" ? 401 : message.includes("متاحة لعبد الرحمن") ? 403 : 400;
      console.error("[ProjectOpportunityUpload] failed", { message });
      res.status(status).json({ error: message === "AUTH_REQUIRED" ? "يلزم تسجيل الدخول" : message });
    }
  });
}
