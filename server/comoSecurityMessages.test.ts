import { beforeEach, describe, expect, it, vi } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import type { SQL } from "drizzle-orm";
import type { TrpcContext } from "./_core/context";
const mocks = vi.hoisted(() => ({ getDb: vi.fn(), storage: vi.fn() }));
vi.mock("./db", () => ({ getDb: mocks.getDb }));
vi.mock("./storage", () => ({ storagePut: mocks.storage }));
import { internalMessagesRouter } from "./routers/internalMessages";
const dialect = new MySqlDialect();
type Row = Record<string, unknown>;
const original: Row[] = [
  { id: 1, parent_message_id: null, from_member: "abdulrahman", to_member: "wael", is_archived: 0, is_read: 0, priority: "urgent", message_type: "instruction", project_id: 10, created_at: "2026-01-01" },
  { id: 2, parent_message_id: 1, from_member: "wael", to_member: "abdulrahman", is_archived: 0, is_read: 0, priority: "normal", message_type: "info", project_id: 10, created_at: "2026-01-02" },
  { id: 3, parent_message_id: null, from_member: "sheikh_issa", to_member: "wael", is_archived: 0, is_read: 0, priority: "normal", message_type: "info", project_id: null, created_at: "2026-01-03" },
  { id: 4, parent_message_id: 1, from_member: "sheikh_issa", to_member: "wael", is_archived: 1, is_read: 0, priority: "normal", message_type: "info", project_id: null, created_at: "2026-01-04" },
];
let data: Row[];
let mutations: number;
const context = { user: null, req: {}, res: {} } as TrpcContext;
function predicate(text: string, params: unknown[], row: Row): boolean {
  const tokens = text.match(/\(|\)|\?|=|\bAND\b|\bOR\b|[a-z_]+|\d+/gi) || [];
  let i = 0, p = 0;
  function atom(): boolean {
    if (tokens[i] === "(") { i++; const result = or(); if (tokens[i++] !== ")") throw new Error("Unbalanced predicate"); return result; }
    const field = tokens[i++]; if (tokens[i++] !== "=") throw new Error("Unsupported predicate");
    const token = tokens[i++]; const value = token === "?" ? params[p++] : Number(token);
    return row[field] === value;
  }
  function and(): boolean { let result = atom(); while (tokens[i] === "AND") { i++; const other = atom(); result = result && other; } return result; }
  function or(): boolean { let result = and(); while (tokens[i] === "OR") { i++; const other = and(); result = result || other; } return result; }
  const result = or(); if (i !== tokens.length) throw new Error("Unconsumed predicate"); return result;
}
function database() {
  const select = () => {
    const query = { from: () => query, where: async (condition: SQL) => {
      const { params } = dialect.sqlToQuery(condition);
      const token = params[0]; const memberId = token === "owner-token" ? "abdulrahman" : token === "wael-token" ? "wael" : token === "third-token" ? "sheikh_issa" : null;
      return memberId ? [{ memberId }] : [];
    } };
    return query;
  };
  const execute = vi.fn(async (query: SQL) => {
    const compiled = dialect.sqlToQuery(query);
    const where = compiled.sql.split(" WHERE ")[1]?.split(/ ORDER BY | LIMIT /)[0];
    if (!where) throw new Error("Unscoped fixture query");
    const beforeWhere = compiled.sql.split(" WHERE ")[0];
    const skip = (beforeWhere.match(/\?/g) || []).length;
    const selected = data.filter(row => predicate(where, compiled.params.slice(skip), row));
    if (compiled.sql.startsWith("SELECT COUNT")) return [[{ count: selected.length }]];
    if (compiled.sql.startsWith("SELECT")) return [selected.map(row => ({ ...row }))];
    mutations++;
    if (compiled.sql.startsWith("DELETE")) data = data.filter(row => !selected.includes(row));
    if (compiled.sql.startsWith("UPDATE")) for (const row of selected) {
      if (compiled.sql.includes("SET is_read")) row.is_read = 1;
      if (compiled.sql.includes("SET is_archived = 1")) row.is_archived = 1;
      if (compiled.sql.includes("SET is_archived = 0")) row.is_archived = 0;
    }
    return [{ affectedRows: selected.length }];
  });
  return { select, execute };
}
beforeEach(() => { vi.clearAllMocks(); data = original.map(row => ({ ...row })); mutations = 0; mocks.getDb.mockResolvedValue(database()); });
describe("internal messages SQL participant boundary", () => {
  it.each(["inbox", "sent", "all"] as const)("retains %s filter without selecting third party rows", async view => {
    const result = await internalMessagesRouter.createCaller(context).getAll({ ccToken: "owner-token", view });
    expect(result.map(row => row.id)).toEqual(view === "inbox" ? [2] : view === "sent" ? [1] : [1, 2]);
  });
  it("retains project/type/priority/archive filters", async () => {
    const caller = internalMessagesRouter.createCaller(context);
    expect((await caller.getAll({ ccToken: "owner-token", view: "all", priority: "urgent", messageType: "instruction", projectId: 10 })).map(row => row.id)).toEqual([1]);
    expect((await caller.getAll({ ccToken: "wael-token", view: "all", isArchived: true, projectId: 0 })).map(row => row.id)).toEqual([4]);
  });
  it("thread detail limits each row by token member", async () => {
    const caller = internalMessagesRouter.createCaller(context);
    expect((await caller.getById({ ccToken: "owner-token", id: 1 })).map(row => row.id)).toEqual([1, 2]);
    expect((await caller.getById({ ccToken: "third-token", id: 2 }))).toEqual([]);
  });
  it("third member cannot mutate a known message", async () => {
    const caller = internalMessagesRouter.createCaller(context);
    await expect(caller.markRead({ ccToken: "third-token", id: 1 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(caller.archive({ ccToken: "third-token", id: 1, archive: true })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(caller.delete({ ccToken: "third-token", id: 1 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mutations).toBe(0); expect(data).toEqual(original);
  });
  it("only recipient marks read; sender can archive", async () => {
    const caller = internalMessagesRouter.createCaller(context);
    await expect(caller.markRead({ ccToken: "owner-token", id: 1 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await caller.markRead({ ccToken: "wael-token", id: 1 })).toEqual({ success: true });
    expect(data[0].is_read).toBe(1);
    expect(await caller.archive({ ccToken: "owner-token", id: 1, archive: true })).toEqual({ success: true }); expect(data[0].is_archived).toBe(1);
  });
  it("deletes permitted root/reply but not unrelated third-party child", async () => {
    await internalMessagesRouter.createCaller(context).delete({ ccToken: "owner-token", id: 1 });
    expect(data.map(row => row.id)).toEqual([3, 4]);
  });
  it("rejects unknown token before SQL object access", async () => {
    const db = database(); mocks.getDb.mockResolvedValue(db);
    await expect(internalMessagesRouter.createCaller(context).getById({ ccToken: "invalid", id: 1 })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(db.execute).not.toHaveBeenCalled();
  });
  it("rejects fabricated parent thread before INSERT", async () => {
    await expect(internalMessagesRouter.createCaller(context).create({ ccToken: "third-token", toMember: "wael", subject: "x", body: "x", parentMessageId: 2 })).rejects.toMatchObject({ code: "NOT_FOUND" }); expect(mutations).toBe(0);
  });
});
