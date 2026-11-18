import { beforeEach, describe, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import type { SQL } from "drizzle-orm";
const mocks = vi.hoisted(() => ({ getDb: vi.fn(), write: vi.fn(), storage: vi.fn() }));
vi.mock("./db", () => ({ getDb: mocks.getDb }));
vi.mock("./services/comoLegacyProjectAccess", () => ({ requireLegacyProjectWrite: mocks.write }));
vi.mock("./storage", () => ({ storagePut: mocks.storage }));
import { comoNextDocuments } from "../drizzle/schema";
import { positiveUploadId, storePrivateCommandCenterAttachment } from "./services/comoPrivateUpload";
const dialect = new MySqlDialect();
const actor = { id: 1, openId: "owner", role: "admin" as const };
const input = { actor, projectId: 10, memoryId: 5, fileName: "../../مرفق.pdf", mimeType: "application/pdf", bytes: Buffer.from("duplicate source") };
let exists: boolean;
let targetStatus: string | null;
let writes: { table: unknown; values: Record<string, unknown> }[];
let scopes: { sql: string; params: unknown[] }[];
function database() {
  const select = () => {
    let table: unknown;
    const query = { from(value: unknown) { table = value; return query; }, innerJoin() { return query; }, where(condition: SQL) { scopes.push(dialect.sqlToQuery(condition)); return query; }, async limit() { return table === comoNextDocuments ? exists ? [{ id: 77 }] : [] : targetStatus ? [{ memoryId: 5, workFileId: 12, status: targetStatus }] : []; } };
    return query;
  };
  const insert = (table: unknown) => ({ values(values: Record<string, unknown>) { writes.push({ table, values }); return { async onDuplicateKeyUpdate() { if (table === comoNextDocuments) exists = true; return [{ insertId: 77 }]; } }; } });
  return { select, insert };
}
beforeEach(() => { vi.clearAllMocks(); exists = false; targetStatus = "open"; writes = []; scopes = []; mocks.getDb.mockResolvedValue(database()); mocks.write.mockResolvedValue({}); mocks.storage.mockResolvedValue({ key: "private-key", url: "https://provider.example.test/private" }); });
describe("private upload existing document and memory contract", () => {
  it("forbidden project is denied before any DB or storage write", async () => {
    mocks.write.mockRejectedValue(new TRPCError({ code: "FORBIDDEN" }));
    await expect(storePrivateCommandCenterAttachment(input)).rejects.toMatchObject({ code: "FORBIDDEN" }); expect(mocks.getDb).not.toHaveBeenCalled(); expect(mocks.storage).not.toHaveBeenCalled();
  });
  it("unknown or foreign memory is unavailable before upload", async () => {
    targetStatus = null; await expect(storePrivateCommandCenterAttachment(input)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(scopes[0].params).toEqual([5, 10]); expect(mocks.storage).not.toHaveBeenCalled();
  });
  it.each(["closed", "cancelled"])("locked %s work file cannot gain an attachment", async status => {
    targetStatus = status; await expect(storePrivateCommandCenterAttachment(input)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" }); expect(writes).toEqual([]); expect(mocks.storage).not.toHaveBeenCalled();
  });
  it("stores privately with safe server key and returns document route only", async () => {
    expect(await storePrivateCommandCenterAttachment(input)).toMatchObject({ documentId: 77, url: "/api/como-next/documents/77" });
    const key = mocks.storage.mock.calls[0][0]; expect(key).toMatch(/^como-next-private\/command-center\/10\/[a-f0-9-]+\//); expect(key).not.toContain("../");
    expect(writes).toHaveLength(2); expect(writes[1].values).toMatchObject({ projectId: 10, memoryId: 5, workFileId: 12, documentId: 77 });
  });
  it("duplicate SHA reuses source and deduplicates existing memory-document contract", async () => {
    exists = true; const first = await storePrivateCommandCenterAttachment(input); const second = await storePrivateCommandCenterAttachment(input);
    expect(first.url).toBe(second.url); expect(mocks.storage).not.toHaveBeenCalled(); expect(writes.every(write => write.table !== comoNextDocuments)).toBe(true);
    expect(writes.every(write => write.values.documentId === 77)).toBe(true);
  });
  it.each([0, -1, NaN, Infinity, "10junk", "01", "", undefined])( "invalid upload ID rejected: %s", value => expect(() => positiveUploadId(value)).toThrow());
  it("rejects empty file before writing", async () => {
    await expect(storePrivateCommandCenterAttachment({ ...input, bytes: Buffer.alloc(0) })).rejects.toMatchObject({ code: "BAD_REQUEST" }); expect(writes).toEqual([]);
  });
});
