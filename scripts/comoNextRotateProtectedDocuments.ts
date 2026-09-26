import { createHash, randomUUID } from "node:crypto";
import mysql, { type RowDataPacket } from "mysql2/promise";
import { storageGet, storagePut } from "../server/storage";

const MARKER = "protected-proxy-only";
const TOMBSTONE = Buffer.from("This legacy object key has been revoked. Use the authenticated COMO document proxy.\n", "utf8");

function digest(bytes: Buffer) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function verifiedRead(key: string, byteSize: number, sha256: string) {
  const { url } = await storageGet(key);
  const response = await fetch(url, { headers: { "Cache-Control": "no-cache" } });
  if (!response.ok) throw new Error(`Storage object unavailable: ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength !== byteSize) throw new Error(`Size mismatch for ${key}`);
  if (digest(bytes) !== sha256) throw new Error(`Checksum mismatch for ${key}`);
  return bytes;
}

async function verifiedWrite(key: string, bytes: Buffer, mimeType: string, sha256: string) {
  await storagePut(key, bytes, mimeType);
  const verified = await verifiedRead(key, bytes.byteLength, sha256);
  if (verified.byteLength !== bytes.byteLength) throw new Error(`Post-upload verification failed for ${key}`);
}

async function main() {
  const db = await mysql.createConnection(process.env.DATABASE_URL!);
  let rotatedDocuments = 0;
  let rotatedChunks = 0;
  let tombstonedKeys = 0;
  try {
    const [documents] = await db.query<RowDataPacket[]>(
      `SELECT id, mime_type AS mimeType, byte_size AS byteSize, sha256, storage_key AS storageKey, storage_url AS storageUrl
         FROM como_next_documents
        WHERE storage_url <> ?
        ORDER BY id`,
      [MARKER],
    );
    for (let index = 0; index < documents.length; index += 1) {
      const document = documents[index];
      const [chunks] = await db.query<RowDataPacket[]>(
        `SELECT id, chunk_index AS chunkIndex, byte_size AS byteSize, sha256, storage_key AS storageKey, storage_url AS storageUrl
           FROM como_next_document_chunks
          WHERE document_id = ?
          ORDER BY chunk_index`,
        [Number(document.id)],
      );
      console.log(`[rotate] document ${index + 1}/${documents.length} id=${document.id} chunks=${chunks.length}`);
      if (chunks.length) {
        for (const chunk of chunks) {
          if (chunk.storageUrl === MARKER) continue;
          const bytes = await verifiedRead(String(chunk.storageKey), Number(chunk.byteSize), String(chunk.sha256));
          const newKey = `como-next/private/documents/${randomUUID()}/chunks/${String(chunk.chunkIndex).padStart(4, "0")}.bin`;
          await verifiedWrite(newKey, bytes, "application/octet-stream", String(chunk.sha256));
          await db.execute(
            `UPDATE como_next_document_chunks SET storage_key = ?, storage_url = ? WHERE id = ? AND storage_key = ?`,
            [newKey, MARKER, Number(chunk.id), String(chunk.storageKey)],
          );
          await storagePut(String(chunk.storageKey), TOMBSTONE, "text/plain; charset=utf-8");
          rotatedChunks += 1;
          tombstonedKeys += 1;
        }
        await storagePut(String(document.storageKey), TOMBSTONE, "text/plain; charset=utf-8");
        tombstonedKeys += 1;
        await db.execute(
          `UPDATE como_next_documents SET storage_key = ?, storage_url = ?, source_url = NULL WHERE id = ?`,
          [`chunked-proxy-only:${randomUUID()}`, MARKER, Number(document.id)],
        );
      } else {
        const bytes = await verifiedRead(String(document.storageKey), Number(document.byteSize), String(document.sha256));
        const newKey = `como-next/private/documents/${randomUUID()}/content`;
        await verifiedWrite(newKey, bytes, String(document.mimeType), String(document.sha256));
        await db.execute(
          `UPDATE como_next_documents SET storage_key = ?, storage_url = ?, source_url = NULL WHERE id = ? AND storage_key = ?`,
          [newKey, MARKER, Number(document.id), String(document.storageKey)],
        );
        await storagePut(String(document.storageKey), TOMBSTONE, "text/plain; charset=utf-8");
        tombstonedKeys += 1;
      }
      rotatedDocuments += 1;
    }

    const [remainingDocuments] = await db.query<RowDataPacket[]>(`SELECT COUNT(*) AS count FROM como_next_documents WHERE storage_url <> ? OR source_url IS NOT NULL`, [MARKER]);
    const [remainingChunks] = await db.query<RowDataPacket[]>(`SELECT COUNT(*) AS count FROM como_next_document_chunks WHERE storage_url <> ?`, [MARKER]);
    const result = {
      success: Number(remainingDocuments[0]?.count || 0) === 0 && Number(remainingChunks[0]?.count || 0) === 0,
      rotatedDocuments,
      rotatedChunks,
      tombstonedKeys,
      remainingRawDocumentReferences: Number(remainingDocuments[0]?.count || 0),
      remainingRawChunkReferences: Number(remainingChunks[0]?.count || 0),
    };
    console.log(JSON.stringify(result, null, 2));
    if (!result.success) process.exitCode = 1;
  } finally {
    await db.end();
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
