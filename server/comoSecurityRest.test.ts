import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response, NextFunction, Router } from "express";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import type { SQL } from "drizzle-orm";
const mocks = vi.hoisted(() => ({ getDb: vi.fn(), authenticate: vi.fn(), scope: vi.fn(), write: vi.fn(), upload: vi.fn(), storage: vi.fn() }));
vi.mock("./db", () => ({ getDb: mocks.getDb }));
vi.mock("./_core/sdk", () => ({ sdk: { authenticateRequest: mocks.authenticate } }));
vi.mock("./services/comoLegacyProjectAccess", () => ({ deriveAuthorizedProjectIds: mocks.scope, requireLegacyProjectWrite: mocks.write }));
vi.mock("./services/comoPrivateUpload", async original => ({ ...await original<typeof import("./services/comoPrivateUpload")>(), storePrivateCommandCenterAttachment: mocks.upload }));
vi.mock("multer", () => ({ default: Object.assign(() => ({ single: () => (_req: Request, _res: Response, next: NextFunction) => next() }), { memoryStorage: () => ({}) }) }));
vi.mock("./storage", () => ({ storagePut: mocks.storage }));
vi.mock("./_core/env", () => ({ ENV: { forgeApiUrl: "https://storage.example.test/", forgeApiKey: "fixture-only" } }));
import dashboard from "./dashboardDataRoute";
import uploadRouter from "./fileUploadRoute";
import { registerStorageProxy } from "./_core/storageProxy";
import express from "express";
import type { Express as ExpressApp } from "express";
import { TRPCError } from "@trpc/server";
import { dashboardWriteTargets, mergeDashboardPatch, parseDashboardProjectKey } from "./services/comoSecurityGuards";
import { isComoPublicStorageAsset } from "./services/comoSecurityPolicy";
const actor = { id: 1, openId: "bound-owner", role: "admin" };
const dialect = new MySqlDialect();
const executed: { sql: string; params: unknown[] }[] = [];
let legacy: Record<string, unknown>;
let locked = false;
function database() {
  const execute = vi.fn(async (query: SQL) => {
    const compiled = dialect.sqlToQuery(query); executed.push(compiled);
    if (compiled.sql.startsWith("SELECT dataValue")) return [[{ dataValue: JSON.stringify(legacy) }]];
    if (compiled.sql.includes("cpa_true_cost_report_approval")) return [[{ approved: locked ? 1 : 0 }]];
    if (compiled.sql.startsWith("SELECT id, name, bua")) return [[{ id: 10, name: "Office A", bua: 0, pricePerSqft: 0 }]];
    if (compiled.sql.startsWith("SELECT id, name FROM projects")) return [[{ id: 10, name: "Office A" }]];
    if (compiled.sql.includes("FROM projectConsultants pc")) return [[{ projectId: 10, consultantName: "Office consultant" }]];
    if (compiled.sql.startsWith("SELECT id, name FROM consultants")) return [[{ id: 7, name: "Office consultant" }]];
    if (compiled.sql.startsWith("SELECT")) return [[]];
    // No SQL is executed: writes are captured only, with no DB or network port.
    return [{ affectedRows: 1 }];
  });
  const query = { from: () => query, where: () => query, limit: async () => [{ userId: 1, openId: actor.openId, isActive: 1 }] };
  return { execute, select: () => query };
}
function request(router: Router, method: string, path: string, body: unknown = {}, file?: Express.Multer.File) {
  return new Promise<{ status: number; body: unknown; location?: string }>((resolve, reject) => {
    const req = { method, url: path, originalUrl: path, path, body, file, headers: {} } as Request;
    let statusCode = 200;
    const response = { locals: {}, status(code: number) { statusCode = code; return response; }, json(value: unknown) { resolve({ status: statusCode, body: value }); return response; }, send(value: unknown) { resolve({ status: statusCode, body: value }); return response; }, set() { return response; }, redirect(code: number, location: string) { resolve({ status: code, body: null, location }); return response; } };
    const res = response as unknown as Response;
    router(req, res, error => error ? reject(error) : resolve({ status: 404, body: null }));
  });
}
beforeEach(() => {
  vi.clearAllMocks(); executed.length = 0; locked = false;
  legacy = { p10: { notes: "keep" }, p20: { notes: "outside stays" }, consultantLinks: { "Office consultant": "https://example.test" } };
  mocks.getDb.mockResolvedValue(database()); mocks.authenticate.mockResolvedValue(actor); mocks.scope.mockResolvedValue([10]); mocks.write.mockResolvedValue({});
  mocks.upload.mockResolvedValue({ documentId: 77, url: "/api/como-next/documents/77", name: "test.pdf", size: 4, type: "application/pdf" });
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ url: "https://storage.example.test/signed" }) })));
});
describe("COMO REST auth and project integration", () => {
  it("import has no database or DDL effect", async () => {
    vi.resetModules();
    await import("./dashboardDataRoute");
    expect(mocks.getDb).not.toHaveBeenCalled();
    expect(executed).toEqual([]);
  });
  it.each(["GET", "POST", "PATCH"])("denies anonymous %s before database access", async method => {
    mocks.authenticate.mockRejectedValue(new Error("no session"));
    expect((await request(dashboard, method, "/", { p10: { notes: "x" } })).status).toBe(401);
    expect(mocks.getDb).not.toHaveBeenCalled(); expect(mocks.scope).not.toHaveBeenCalled();
  });
  it("scopes project list and related offices in SQL", async () => {
    const result = await request(dashboard, "GET", "/projects");
    expect(result.body).toEqual([{ id: "p10", name: "Office A", consultants: ["Office consultant"] }]);
    expect(executed.every(query => query.sql.includes("IN (?)") && query.params.includes(10))).toBe(true);
  });
  it("empty grants never query all projects", async () => {
    mocks.scope.mockResolvedValue([]); expect((await request(dashboard, "GET", "/projects")).body).toEqual([]); expect(executed).toEqual([]);
  });
  it("preserves official zero instead of legacy fallback", async () => {
    legacy.p10 = { bua: 100, price: 900 };
    expect((await request(dashboard, "GET", "/")).body).toMatchObject({ p10: { bua: 0, price: 0 } });
    expect(JSON.stringify((await request(dashboard, "GET", "/")).body)).not.toContain("outside stays");
  });
  it("rejects a mixed forbidden project before save", async () => {
    mocks.write.mockImplementation(async (_actor, id) => { if (id === 20) throw new TRPCError({ code: "FORBIDDEN" }); });
    expect((await request(dashboard, "POST", "/", { p10: { notes: "changed" }, p20: { notes: "hack" } })).status).toBe(403);
    expect(executed).toEqual([]);
  });
  it("approved source is locked before writes", async () => {
    locked = true; expect((await request(dashboard, "POST", "/", { p10: { price: 0 } })).status).toBe(403);
    expect(executed.every(query => query.sql.startsWith("SELECT"))).toBe(true);
  });
  it("preserves another project's legacy data on POST", async () => {
    expect((await request(dashboard, "POST", "/", { p10: { notes: "new" } })).status).toBe(200);
    const saved = executed.find(query => query.sql.startsWith("INSERT INTO dashboardData"));
    expect(JSON.parse(String(saved?.params[0]))).toEqual({ ...legacy, p10: { notes: "new" } });
  });
  it("PATCH sync only requested write scope and returns its original shape", async () => {
    const result = await request(dashboard, "PATCH", "/", { p10: { price: 0, notes: "edited" } });
    expect(result).toMatchObject({ status: 200, body: { success: true, data: { p10: { price: 0, notes: "edited" } } } });
    expect(mocks.write).toHaveBeenCalledWith(actor, 10);
    expect(executed.filter(q => q.sql.startsWith("UPDATE projects")).every(q => q.params.at(-1) === 10)).toBe(true);
  });
  it("rejects forged evaluation instead of authoring another evaluator", async () => {
    expect((await request(dashboard, "POST", "/", { p10: { evaluation: { forged: 10 } } })).status).toBe(409);
    expect(executed.every(query => query.sql.startsWith("SELECT"))).toBe(true);
  });
});
describe("private upload and public presign boundary", () => {
  const file = { originalname: "test.pdf", mimetype: "application/pdf", buffer: Buffer.from("test"), size: 4 } as Express.Multer.File;
  it("anonymous upload cannot reach file storage", async () => {
    mocks.authenticate.mockRejectedValue(new Error("missing")); expect((await request(uploadRouter, "POST", "/command-center", {}, file)).status).toBe(401);
    expect(mocks.upload).not.toHaveBeenCalled(); expect(mocks.storage).not.toHaveBeenCalled();
  });
  it("old payload without a project fails closed", async () => {
    expect((await request(uploadRouter, "POST", "/command-center", { bubbleType: "../../public" }, file)).status).toBe(400); expect(mocks.upload).not.toHaveBeenCalled();
  });
  it("returns guarded document route and actor from session, not payload", async () => {
    const result = await request(uploadRouter, "POST", "/command-center", { projectId: "10", memoryId: "5", userId: 99, bubbleType: "../../public" }, file);
    expect(result.body).toMatchObject({ url: "/api/como-next/documents/77", success: true });
    expect(mocks.upload).toHaveBeenCalledWith(expect.objectContaining({ actor, projectId: 10, memoryId: 5 }));
  });
  it.each(["como-next-private/docs/x.pdf", "command-center/general/x.pdf", "salwa-enhanced_0251b1a8.png/evil", "../salwa-enhanced_0251b1a8.png", "salwa-enhanced_0251b1a8.png%2Fsecret", "public/secret.pdf"])("never presigns private/unknown key %s", async key => {
    const app = express.Router(); registerStorageProxy(app as unknown as ExpressApp);
    expect((await request(app, "GET", `/manus-storage/${key}`)).status).toBe(404); expect(fetch).not.toHaveBeenCalled(); expect(isComoPublicStorageAsset(key)).toBe(false);
  });
  it("keeps the exact existing avatar public", async () => {
    const app = express.Router(); registerStorageProxy(app as unknown as ExpressApp);
    expect((await request(app, "GET", "/manus-storage/salwa-enhanced_0251b1a8.png")).status).toBe(307); expect(fetch).toHaveBeenCalledOnce();
  });
});
describe("pure payload edge cases", () => {
  it.each(["p0", "p-1", "p1junk", "p01", "p1.5", "p9007199254740992"])("strict project key %s", key => { expect(parseDashboardProjectKey(key)).toBeNull(); expect(() => dashboardWriteTargets({ [key]: {} })).toThrow(); });
  it.each([NaN, Infinity, -1, "1"])("rejects unsafe price %s", price => expect(() => dashboardWriteTargets({ p10: { price } })).toThrow());
  it.each([NaN, Infinity, -1, "2", undefined])("rejects invalid office fee before save %s", designVal => expect(() => dashboardWriteTargets({ p10: { financial: [{ consultant: "Office", designType: "pct", supervisionType: "lump", designVal, supervisionVal: 0 }] } })).toThrow());
  it("retains valid zero and lumpsum office format", () => {
    expect(dashboardWriteTargets({ p10: { financial: [{ consultant: "Office", designType: "lump", supervisionType: "pct", designVal: 0, supervisionVal: 0 }] } }).projectIds).toEqual([10]);
  });
  it("rejects prototype pollution while preserving arrays and zero", () => {
    expect(() => mergeDashboardPatch({}, JSON.parse('{"__proto__":{"polluted":true}}'))).toThrow();
    expect(mergeDashboardPatch({ p10: { price: 9, financial: [1] } }, { p10: { price: 0, financial: [2] } })).toEqual({ p10: { price: 0, financial: [2] } });
  });
});
