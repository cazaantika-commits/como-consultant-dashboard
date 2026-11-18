import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import type { SQL } from "drizzle-orm";
const mocks = vi.hoisted(() => ({ getDb: vi.fn(), scope: vi.fn(), write: vi.fn(), engine: vi.fn(() => { throw new Error("Engine prohibited"); }), imapOptions: [] as { tlsOptions: { rejectUnauthorized: boolean } }[] }));
vi.mock("./db", () => ({ getDb: mocks.getDb }));
vi.mock("./services/comoLegacyProjectAccess", () => ({ deriveAuthorizedProjectIds: mocks.scope, requireLegacyProjectWrite: mocks.write }));
vi.mock("./telegramBot", () => ({ getBot: vi.fn(), getBotInfo: vi.fn() }));
vi.mock("./storage", () => ({ storagePut: mocks.engine }));
vi.mock("./agentChat", () => ({ handleAgentChat: mocks.engine }));
vi.mock("./_core/voiceTranscription", () => ({ transcribeAudio: mocks.engine }));
vi.mock("./_core/llm", () => ({ invokeLLM: mocks.engine }));
vi.mock("./taskExecutionEngine", () => ({ createTasksFromMeeting: mocks.engine, executeTasksByAgents: mocks.engine, generateExecutionReport: mocks.engine, notifyOwnerViaTelegram: mocks.engine }));
vi.mock("./services/comoMailboxDraftLedger", () => ({ DatabaseMailboxDraftLedger: mocks.engine, deterministicDraftMessageId: mocks.engine, mailboxKeyForDraftLedger: mocks.engine, saveMailboxDraftExactlyOnce: mocks.engine }));
vi.mock("mailparser", () => ({ simpleParser: mocks.engine }));
vi.mock("nodemailer", () => ({ default: { createTransport: mocks.engine } }));
vi.mock("imap", () => ({ default: class {
  listeners = new Map<string, (error: Error) => void>();
  constructor(options: { tlsOptions: { rejectUnauthorized: boolean } }) { mocks.imapOptions.push(options); }
  once(event: string, listener: (error: Error) => void) { this.listeners.set(event, listener); }
  connect() { this.listeners.get("error")?.(new Error("SELF_SIGNED_CERT_IN_CHAIN")); }
} }));
import { meetingsRouter } from "./routers/meetings";
import { tasksRouter } from "./routers/tasks";
import { meetings, projects, tasks } from "../drizzle/schema";
import { testConnection } from "./emailMonitor";
import { COMO_IMAP_TLS_OPTIONS } from "./services/comoSecurityPolicy";
const dialect = new MySqlDialect();
const actor = { id: 1, openId: "bound-owner", role: "admin" };
function context(id: number | null = 1) { return { user: id === null ? null : { ...actor, id }, req: {}, res: {} } as TrpcContext; }
let queries: { sql: string; params: unknown[] }[];
let projectMatches: { id: number }[];
let taskRow: { id: number; project: string; status: string } | null;
function database() {
  let table: unknown;
  let condition: SQL | undefined;
  const query = {
    from(value: unknown) { table = value; return query; },
    where(value: SQL) { condition = value; queries.push(dialect.sqlToQuery(value)); return query; },
    orderBy() { return query; },
    async limit() { return result(); },
    then(resolve: (rows: unknown[]) => unknown) { return Promise.resolve(result()).then(resolve); },
  };
  const result = () => {
    if (table === projects) return projectMatches;
    if (table === tasks) return taskRow ? [taskRow] : [];
    if (table === meetings) {
      const params = condition ? dialect.sqlToQuery(condition).params : [];
      // Known detail object belongs to user 1. User 2 scope is not allowed.
      if (params.includes(2)) return [];
      return [{ id: 5, userId: 1, title: "Archived meeting", meetingStatus: "completed" }];
    }
    return [];
  };
  const writes = vi.fn(() => { throw new Error("No live writes allowed"); });
  return { select: () => query, insert: writes, update: writes, delete: writes, transaction: writes };
}
beforeEach(() => { vi.clearAllMocks(); queries = []; projectMatches = [{ id: 10 }]; taskRow = { id: 5, project: "Office A", status: "new" }; mocks.getDb.mockResolvedValue(database()); mocks.scope.mockResolvedValue([10]); mocks.write.mockResolvedValue({}); mocks.imapOptions.length = 0; });
describe("legacy project and owner-user compatibility", () => {
  it("unauthenticated legacy tasks now reject before DB", async () => {
    await expect(tasksRouter.createCaller(context(null)).list()).rejects.toMatchObject({ code: "UNAUTHORIZED" }); expect(mocks.getDb).not.toHaveBeenCalled();
  });
  it("task list scopes exact unique official names in the SQL subquery", async () => {
    await tasksRouter.createCaller(context()).list();
    expect(queries[0].sql).toContain("IN (SELECT name FROM projects"); expect(queries[0].sql).toContain("HAVING COUNT(*) = 1"); expect(queries[0].params).toEqual([10]);
  });
  it("empty task scope is deny-all not an omitted WHERE", async () => {
    mocks.scope.mockResolvedValue([]); await tasksRouter.createCaller(context()).list(); expect(queries[0].sql).toBe("1 = 0");
  });
  it.each([{ matches: [] }, { matches: [{ id: 10 }, { id: 20 }] }])("unbound or ambiguous task project cannot write: %j", async ({ matches }) => {
    projectMatches = matches; await expect(tasksRouter.createCaller(context()).markDone(5)).rejects.toMatchObject({ code: "FORBIDDEN" }); expect(mocks.write).not.toHaveBeenCalled();
  });
  it("outsider task mutation is denied by canonical project guard", async () => {
    const { TRPCError } = await import("@trpc/server"); mocks.write.mockRejectedValue(new TRPCError({ code: "FORBIDDEN" }));
    await expect(tasksRouter.createCaller(context(2)).markDone(5)).rejects.toMatchObject({ code: "FORBIDDEN" }); expect(mocks.write).toHaveBeenCalledWith(expect.objectContaining({ id: 2 }), 10);
  });
  it("meeting detail uses userId and blocks children on wrong owner", async () => {
    await expect(meetingsRouter.createCaller(context(2)).get(5)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(queries).toHaveLength(1); expect(queries[0].params).toEqual([5, 2]); expect(queries[0].sql).toContain("userId");
  });
  it("meeting list preserves status filter plus owner and safe limits", async () => {
    expect(await meetingsRouter.createCaller(context(2)).list({ status: "completed", limit: 10 })).toEqual([]);
    expect(queries[0].params).toEqual([2, "completed"]); expect(queries[0].sql).toContain("meetingStatus");
    await expect(meetingsRouter.createCaller(context()).list({ limit: -1 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
  it("existing legacy meeting mutation lock remains before DB/engine", async () => {
    await expect(meetingsRouter.createCaller(context()).start(5)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" }); expect(mocks.getDb).not.toHaveBeenCalled(); expect(mocks.engine).not.toHaveBeenCalled();
  });
});
describe("IMAP TLS fail closed", () => {
  it("all consumers receive immutable rejectUnauthorized true policy", () => { expect(COMO_IMAP_TLS_OPTIONS).toEqual({ rejectUnauthorized: true }); expect(Object.isFrozen(COMO_IMAP_TLS_OPTIONS)).toBe(true); });
  it("mock certificate failure returns failure, no real connection or parser", async () => {
    vi.stubEnv("EMAIL_PASSWORD", "fixture-not-a-secret");
    // EMAIL_PASSWORD is captured at import; dynamic import under isolated modules.
    vi.resetModules(); const module = await import("./emailMonitor");
    const result = await module.testConnection(); expect(result.success).toBe(false); expect(result.error).toBe("SELF_SIGNED_CERT_IN_CHAIN");
    expect(mocks.imapOptions[0].tlsOptions.rejectUnauthorized).toBe(true); expect(mocks.engine).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });
});
