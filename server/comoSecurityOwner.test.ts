import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import type { AppOwnerBinding } from "./services/comoAppOwner";
const mocks = vi.hoisted(() => ({ getDb: vi.fn(), authenticate: vi.fn(), service: vi.fn(async () => ({ saved: true, sent: false })), health: vi.fn(), executive: vi.fn() }));
vi.mock("./db", () => ({ getDb: mocks.getDb }));
vi.mock("./_core/sdk", () => ({ sdk: { authenticateRequest: mocks.authenticate } }));
vi.mock("./services/comoNextEmailInbox", () => Object.fromEntries(["analyzeEmailCommand", "createReplyDraftFromEmailCommand", "dismissEmailCommand", "getEmailMessage", "linkEmailToWorkFileCommand", "listEmailInbox", "listEmailLinkingOptions", "syncAndAnalyzeReadonlyMailboxCommand"].map(name => [name, mocks.service])));
vi.mock("./services/comoNextEmailOutbox", () => ({ updateReplyDraftFromEmailCommand: mocks.service }));
vi.mock("./services/comoMailExecution", () => ({ readMailExecutionHealth: mocks.health }));
vi.mock("./services/comoNextExecutiveControl", () => ({ runExecutiveControlLoopCommand: mocks.executive }));
import { comoNextEmailRouter } from "./routers/comoNextEmail";
import { requireProvisionedComoOwner } from "./services/comoSecurityGuards";
let binding: AppOwnerBinding | null;
const owner = { id: 1, openId: "bound-owner", role: "admin" as const };
function context(user: typeof owner | null): TrpcContext { return { user, req: {}, res: {} } as TrpcContext; }
function database() {
  const query = { from: () => query, where: () => query, limit: async () => binding ? [binding] : [], then(resolve: (rows: unknown[]) => unknown) { return Promise.resolve([]).then(resolve); } };
  const forbidden = vi.fn(() => { throw new Error("No DB writes in owner tests"); });
  return { select: () => query, insert: forbidden, update: forbidden, delete: forbidden, transaction: forbidden };
}
beforeEach(() => { vi.clearAllMocks(); binding = { userId: 1, openId: owner.openId, isActive: 1 }; mocks.getDb.mockResolvedValue(database()); });
function endpoints(caller: ReturnType<typeof comoNextEmailRouter.createCaller>) {
  return [() => caller.scheduledStatus(), () => caller.list(), () => caller.get({ emailId: 1 }), () => caller.linkingOptions(),
    () => caller.syncReadonly({ hours: 1, maxMessages: 1 }), () => caller.linkToWorkFile({ emailId: 1, projectId: 10, workFileId: 12 }),
    () => caller.analyze({ emailId: 1, requestKey: "safe-test-key" }), () => caller.createReplyDraft({ emailId: 1, body: "draft only" }),
    () => caller.updateReplyDraft({ emailId: 1, subject: "subject", body: "draft only", toText: "recipient@example.test" }), () => caller.dismiss({ emailId: 1 })];
}
describe("COMO mailbox provisioned owner", () => {
  it("anonymous requests fail before database or mailbox service", async () => {
    for (const call of endpoints(comoNextEmailRouter.createCaller(context(null)))) await expect(call()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(mocks.getDb).not.toHaveBeenCalled(); expect(mocks.service).not.toHaveBeenCalled();
  });
  it("arbitrary admin cannot access any of the ten mailbox endpoints", async () => {
    for (const call of endpoints(comoNextEmailRouter.createCaller(context({ ...owner, id: 2, openId: "other-admin" })))) await expect(call()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.service).not.toHaveBeenCalled(); expect(mocks.health).not.toHaveBeenCalled(); expect(mocks.executive).not.toHaveBeenCalled();
  });
  it.each([null, { userId: 1, openId: owner.openId, isActive: 0 }, { userId: 1, openId: "wrong", isActive: 1 }, { userId: 2, openId: owner.openId, isActive: 1 }])("absent/inactive/mismatched binding fails closed without ENV: %j", async value => {
    binding = value; await expect(requireProvisionedComoOwner(owner)).rejects.toMatchObject({ code: "FORBIDDEN" }); expect(mocks.service).not.toHaveBeenCalled();
  });
  it("binding deactivation takes effect without cache", async () => {
    await expect(requireProvisionedComoOwner(owner)).resolves.toBeUndefined(); binding = { userId: 1, openId: owner.openId, isActive: 0 };
    await expect(requireProvisionedComoOwner(owner)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("bound owner keeps existing list/saved-not-sent response and user identity", async () => {
    const caller = comoNextEmailRouter.createCaller(context(owner));
    expect(await caller.list()).toEqual({ saved: true, sent: false }); expect(mocks.service).toHaveBeenCalledWith(1, undefined);
    expect(await caller.createReplyDraft({ emailId: 1, body: "draft only" })).toEqual({ saved: true, sent: false });
    expect(mocks.service).toHaveBeenLastCalledWith({ userId: 1, emailId: 1, body: "draft only" });
  });
  it("unavailable DB denies access instead of calling mailbox", async () => {
    mocks.getDb.mockResolvedValue(null); await expect(comoNextEmailRouter.createCaller(context(owner)).list()).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" }); expect(mocks.service).not.toHaveBeenCalled();
  });
});
