import { createHash, createHmac } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { extname, dirname, join, resolve } from "node:path";
import mysql, { type RowDataPacket } from "mysql2/promise";
import { storagePut } from "../server/storage";

const args = process.argv.slice(2);
const valueAfter = (flag: string) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
};

const batchId = valueAfter("--batch");
const packageRoot = resolve(valueAfter("--package") || "");
const outputPath = resolve(valueAfter("--output") || `migration-results/${batchId || "unknown"}/DOCUMENT_COPY_RESULT.json`);
const apply = args.includes("--apply");

if (!batchId) throw new Error("--batch is required");
if (!packageRoot || !existsSync(packageRoot)) throw new Error("--package must point to the verified transfer package root");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is required to derive non-guessable storage keys");

interface ManifestEntry {
  sourceType: string;
  originalName: string;
  storedName: string;
  mimeType?: string;
  bytes: number;
  sourceUrl?: string;
  sourceKey?: string;
  sha256?: string;
  exported: boolean;
  requiredForMigration: boolean;
}

interface MemoryRow extends RowDataPacket {
  id: number;
  project_id: number;
  work_file_id: number;
  title: string;
  source_url: string | null;
  source_file_key: string | null;
  source_file_name: string | null;
  mime_type: string | null;
}

const sha256 = (buffer: Buffer) => createHash("sha256").update(buffer).digest("hex");
const SINGLE_UPLOAD_LIMIT = 20 * 1024 * 1024;
const CHUNK_SIZE = 8 * 1024 * 1024;
const sleep = (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds));

async function storagePutWithRetry(key: string, content: Buffer, mimeType: string) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      return await storagePut(key, content, mimeType);
    } catch (error) {
      lastError = error;
      if (attempt < 4) await sleep(1000 * 2 ** (attempt - 1));
    }
  }
  throw lastError;
}
const normalizeReference = (value: unknown) => {
  if (!value) return "";
  let text = String(value).trim();
  try {
    if (/^https?:\/\//i.test(text)) text = new URL(text).pathname;
  } catch {
    // Preserve the original string if a legacy URL is malformed.
  }
  try { text = decodeURIComponent(text); } catch { /* keep original encoding */ }
  return text.replace(/^\/+/, "").replace(/^manus-storage\//, "").replace(/\\/g, "/");
};

const mimeFromName = (name: string) => {
  const ext = extname(name).toLowerCase();
  return ({
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".zip": "application/zip",
    ".md": "text/markdown; charset=utf-8",
    ".txt": "text/plain; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
  } as Record<string, string>)[ext] || "application/octet-stream";
};

const manifest = JSON.parse(readFileSync(join(packageRoot, "storage/manifest.json"), "utf8")) as ManifestEntry[];
const exported = manifest.filter(item => item.exported && item.requiredForMigration && item.storedName && item.sha256);
const byReference = new Map<string, ManifestEntry>();
const byName = new Map<string, ManifestEntry | null>();
for (const item of exported) {
  for (const value of [item.sourceKey, item.sourceUrl]) {
    const key = normalizeReference(value);
    if (key) byReference.set(key, item);
  }
  const name = String(item.originalName || "").trim();
  if (name) byName.set(name, byName.has(name) ? null : item);
}

async function main() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL!);
  let lockAcquired = false;
  try {
    const [lockRows] = await connection.query<RowDataPacket[]>(`SELECT GET_LOCK(?, 10) AS acquired`, [`como-followup-documents:${batchId}`]);
    lockAcquired = Number(lockRows[0]?.acquired) === 1;
    if (!lockAcquired) throw new Error("Could not acquire the document promotion lock");

    const [batchRows] = await connection.query<RowDataPacket[]>(
      `SELECT id,batch_status,source_fingerprint FROM como_next_import_batches WHERE batch_id=? LIMIT 1`,
      [batchId],
    );
    const batch = batchRows[0];
    if (!batch) throw new Error(`Import batch not found: ${batchId}`);
    if (batch.batch_status !== "promoted") throw new Error(`Batch must be promoted before documents are copied; current=${batch.batch_status}`);

    const [memoryRows] = await connection.query<MemoryRow[]>(
      `SELECT id,project_id,work_file_id,title,source_url,source_file_key,source_file_name,mime_type
       FROM como_next_work_memory
       WHERE import_batch_id=? AND (source_url IS NOT NULL OR source_file_key IS NOT NULL OR source_file_name IS NOT NULL)
       ORDER BY id`,
      [batchId],
    );

    const matches: Array<{ memory: MemoryRow; manifest: ManifestEntry; localPath: string }> = [];
    const unresolved: Array<{ memoryId: number; title: string; reference: string }> = [];
    for (const memory of memoryRows) {
      const candidates = [memory.source_file_key, memory.source_url].map(normalizeReference).filter(Boolean);
      let item = candidates.map(key => byReference.get(key)).find(Boolean);
      if (!item && memory.source_file_name) item = byName.get(memory.source_file_name) || undefined;
      if (!item) {
        unresolved.push({ memoryId: Number(memory.id), title: memory.title, reference: candidates[0] || memory.source_file_name || "" });
        continue;
      }
      const localPath = join(packageRoot, "storage", item.storedName);
      if (!existsSync(localPath)) throw new Error(`Bundled file missing: ${item.storedName}`);
      matches.push({ memory, manifest: item, localPath });
    }

    const uniqueBySha = new Map<string, { manifest: ManifestEntry; localPath: string }>();
    for (const match of matches) uniqueBySha.set(String(match.manifest.sha256), { manifest: match.manifest, localPath: match.localPath });

    const verifiedFiles = [...uniqueBySha.entries()].map(([digest, item]) => {
      const bytes = readFileSync(item.localPath);
      const actualSha256 = sha256(bytes);
      if (actualSha256 !== digest) throw new Error(`Checksum mismatch for ${item.manifest.storedName}`);
      if (Number(item.manifest.bytes) !== bytes.byteLength) throw new Error(`Byte-size mismatch for ${item.manifest.storedName}`);
      return { sha256: digest, bytes: bytes.byteLength, manifest: item.manifest, localPath: item.localPath };
    });

    const plan = {
      mode: apply ? "apply" : "plan",
      batchId,
      sourceFingerprint: String(batch.source_fingerprint),
      eligibleMemoryReferences: memoryRows.length,
      matchedMemoryReferences: matches.length,
      unresolvedMemoryReferences: unresolved.length,
      uniqueFiles: verifiedFiles.length,
      totalBytes: verifiedFiles.reduce((sum, item) => sum + item.bytes, 0),
      externalSideEffects: apply ? verifiedFiles.length : 0,
      unresolved,
    };

    if (!apply) {
      mkdirSync(dirname(outputPath), { recursive: true });
      writeFileSync(outputPath, JSON.stringify({ ...plan, writesExecuted: 0 }, null, 2) + "\n");
      console.log(JSON.stringify({ ...plan, writesExecuted: 0 }, null, 2));
      return;
    }

    const documentIdBySha = new Map<string, number>();
    let createdDocuments = 0;
    let linkedMemoryRows = 0;
    let uploadedStorageObjects = 0;
    let chunkedDocuments = 0;
    for (const [fileIndex, file] of verifiedFiles.entries()) {
      const extension = extname(file.manifest.originalName || file.manifest.storedName).toLowerCase();
      const privateToken = createHmac("sha256", process.env.JWT_SECRET!)
        .update(`${batchId}:${file.sha256}`)
        .digest("hex");
      const storageKey = `como-next/private/${batchId}/${privateToken}${extension}`;
      const mimeType = file.manifest.mimeType || mimeFromName(file.manifest.originalName || file.manifest.storedName);
      const [existingRows] = await connection.query<RowDataPacket[]>(`SELECT id FROM como_next_documents WHERE sha256=? LIMIT 1`, [file.sha256]);
      let documentId = Number(existingRows[0]?.id || 0);
      if (!documentId) {
        const content = readFileSync(file.localPath);
        console.log(`[documents] ${fileIndex + 1}/${verifiedFiles.length} ${file.manifest.originalName} (${file.bytes} bytes)`);
        if (content.byteLength <= SINGLE_UPLOAD_LIMIT) {
          const stored = await storagePutWithRetry(storageKey, content, mimeType);
          uploadedStorageObjects += 1;
          await connection.execute(
            `INSERT INTO como_next_documents
             (title,file_name,mime_type,byte_size,sha256,storage_key,storage_url,source_system,source_key,source_url,import_batch_id)
             VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
            [file.manifest.originalName, file.manifest.originalName, mimeType, file.bytes, file.sha256, stored.key, stored.url, "como_followup_desk", file.manifest.sourceKey || null, file.manifest.sourceUrl || null, batchId],
          );
          const [insertedRows] = await connection.query<RowDataPacket[]>(`SELECT id FROM como_next_documents WHERE sha256=? LIMIT 1`, [file.sha256]);
          documentId = Number(insertedRows[0].id);
        } else {
          const chunks: Array<{ chunkIndex: number; byteSize: number; sha256: string; storageKey: string; storageUrl: string }> = [];
          const chunkCount = Math.ceil(content.byteLength / CHUNK_SIZE);
          for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex += 1) {
            const chunk = content.subarray(chunkIndex * CHUNK_SIZE, Math.min(content.byteLength, (chunkIndex + 1) * CHUNK_SIZE));
            const chunkKey = `como-next/private/${batchId}/${privateToken}/part-${String(chunkIndex).padStart(4, "0")}.bin`;
            console.log(`[documents]   chunk ${chunkIndex + 1}/${chunkCount}`);
            const stored = await storagePutWithRetry(chunkKey, chunk, "application/octet-stream");
            uploadedStorageObjects += 1;
            chunks.push({ chunkIndex, byteSize: chunk.byteLength, sha256: sha256(chunk), storageKey: stored.key, storageUrl: stored.url });
          }
          await connection.beginTransaction();
          try {
            await connection.execute(
              `INSERT INTO como_next_documents
               (title,file_name,mime_type,byte_size,sha256,storage_key,storage_url,source_system,source_key,source_url,import_batch_id)
               VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
              [file.manifest.originalName, file.manifest.originalName, mimeType, file.bytes, file.sha256, `como-next/chunked/${batchId}/${privateToken}`, "", "como_followup_desk", file.manifest.sourceKey || null, file.manifest.sourceUrl || null, batchId],
            );
            const [insertedRows] = await connection.query<RowDataPacket[]>(`SELECT id FROM como_next_documents WHERE sha256=? LIMIT 1`, [file.sha256]);
            documentId = Number(insertedRows[0].id);
            for (const chunk of chunks) {
              await connection.execute(
                `INSERT INTO como_next_document_chunks (document_id,chunk_index,byte_size,sha256,storage_key,storage_url)
                 VALUES (?,?,?,?,?,?)`,
                [documentId, chunk.chunkIndex, chunk.byteSize, chunk.sha256, chunk.storageKey, chunk.storageUrl],
              );
            }
            await connection.commit();
          } catch (error) {
            await connection.rollback();
            throw error;
          }
          chunkedDocuments += 1;
        }
        createdDocuments += 1;
      }
      documentIdBySha.set(file.sha256, documentId);
    }

    for (const match of matches) {
      const documentId = documentIdBySha.get(String(match.manifest.sha256));
      if (!documentId) throw new Error(`Document id missing for ${match.manifest.sha256}`);
      const [result] = await connection.execute<any>(
        `INSERT IGNORE INTO como_next_work_memory_documents
         (project_id,work_file_id,memory_id,document_id,relation_type,source_system,source_record_id,import_batch_id)
         VALUES (?,?,?,?,?,?,?,?)`,
        [Number(match.memory.project_id), Number(match.memory.work_file_id), Number(match.memory.id), documentId, "attachment", "como_followup_desk", String(match.memory.id), batchId],
      );
      linkedMemoryRows += Number(result.affectedRows || 0);
    }

    const result = {
      ...plan,
      documentsResolved: verifiedFiles.length,
      documentsCreated: createdDocuments,
      chunkedDocuments,
      uploadedStorageObjects,
      memoryLinksResolved: matches.length,
      memoryLinksCreated: linkedMemoryRows,
      completedAt: new Date().toISOString(),
    };
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, JSON.stringify(result, null, 2) + "\n");
    console.log(JSON.stringify(result, null, 2));
  } finally {
    if (lockAcquired) await connection.query(`SELECT RELEASE_LOCK(?)`, [`como-followup-documents:${batchId}`]).catch(() => undefined);
    await connection.end();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
