import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  stage: vi.fn(),
  submit: vi.fn(),
  list: vi.fn(),
  update: vi.fn(),
  cancel: vi.fn(),
}));
vi.mock("./db", () => ({ getDb: mocks.getDb }));
vi.mock("./services/comoNextStagedDirectives", () => ({
  stageExecutiveDirectiveCommand: mocks.stage,
  submitStagedExecutiveDirectiveCommand: mocks.submit,
  listWorkFileStagedDirectives: mocks.list,
  updateStagedExecutiveDirectiveCommand: mocks.update,
  cancelStagedExecutiveDirectiveCommand: mocks.cancel,
}));

import { matchesAuthenticatedAppOwner, isAuthenticatedAppOwner } from "./services/comoAppOwner";
import { comoNextRouter } from "./routers/comoNext";
import type { TrpcContext } from "./_core/context";
import { ENV } from "./_core/env";

const owner = { id: 1, openId: "authenticated-owner", role: "admin" as const };
const binding = { userId: 1, openId: owner.openId, isActive: 1 };
function context(user = owner): TrpcContext {
  return { user: { ...user, name: "Owner", email: null, loginMethod: "google", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: {} as any, res: {} as any };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getDb.mockResolvedValue({ select: () => ({ from: () => ({ where: () => ({ limit: async () => [binding] }) }) }) });
  mocks.stage.mockResolvedValue({ directive: { id: 17, status: "pending" }, replayed: false });
  mocks.list.mockResolvedValue([]);
  mocks.update.mockResolvedValue({ id: 17, status: "pending" });
  mocks.cancel.mockResolvedValue({ id: 17, status: "cancelled" });
  mocks.submit.mockResolvedValue({ directive: { id: 17, status: "submitted" }, replayed: false });
});

describe("provisioned COMO owner identity", () => {
  it("accepts the exact existing owner when production ENV is stale or missing", () => {
    expect(matchesAuthenticatedAppOwner(owner, binding, "stale-platform-owner")).toBe(true);
    expect(matchesAuthenticatedAppOwner(owner, binding, "")).toBe(true);
  });
  it("rejects another admin, a forged openId with another id, and a downgraded owner", () => {
    expect(matchesAuthenticatedAppOwner({ ...owner, id: 2, openId: "other-admin" }, binding, "other-admin")).toBe(false);
    expect(matchesAuthenticatedAppOwner({ ...owner, id: 2 }, binding, owner.openId)).toBe(false);
    expect(matchesAuthenticatedAppOwner({ ...owner, openId: "different" }, binding, "different")).toBe(false);
    expect(matchesAuthenticatedAppOwner({ ...owner, role: "user" }, binding, owner.openId)).toBe(false);
  });
  it("never bypasses an inactive binding with an environment fallback", () => {
    expect(matchesAuthenticatedAppOwner(owner, { ...binding, isActive: 0 }, owner.openId)).toBe(false);
  });
  it("uses only an exact environment match when no binding is provisioned", () => {
    expect(matchesAuthenticatedAppOwner(owner, null, owner.openId)).toBe(true);
    expect(matchesAuthenticatedAppOwner(owner, null, "")).toBe(false);
    expect(matchesAuthenticatedAppOwner(owner, null, "someone-else")).toBe(false);
  });
  it("fails closed when database verification fails", async () => {
    mocks.getDb.mockResolvedValue(null);
    await expect(isAuthenticatedAppOwner(owner)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });
  it("uses the persisted binding rather than treating admin alone as ownership", async () => {
    await expect(isAuthenticatedAppOwner(owner)).resolves.toBe(true);
    await expect(isAuthenticatedAppOwner({ id: 99, openId: "other-admin", role: "admin" })).resolves.toBe(false);
  });
});

describe("owner directive router integration", () => {
  it("permits the bound owner to save the exact draft when ENV disagrees, without submitting", async () => {
    const previous = ENV.ownerOpenId; ENV.ownerOpenId = "stale-production-setting";
    try {
      const caller = comoNextRouter.createCaller(context());
      await caller.stageExecutiveDirective({ workFileId: 60017, directiveText: "اختبار تقني؛ لا تنفيذ", stageKey: "technical-stage-key" });
      expect(mocks.stage).toHaveBeenCalledWith({ userId: 1, workFileId: 60017, directiveText: "اختبار تقني؛ لا تنفيذ", stageKey: "technical-stage-key", source: "manual" });
      expect(mocks.submit).not.toHaveBeenCalled();
    } finally { ENV.ownerOpenId = previous; }
  });
  it("checks and awaits owner identity on listing, editing, cancellation, and submission", async () => {
    const caller = comoNextRouter.createCaller(context({ id: 2, openId: "other-admin", role: "admin" }));
    for (const operation of [
      () => caller.listStagedDirectives({ workFileId: 60017 }),
      () => caller.stageExecutiveDirective({ workFileId: 60017, directiveText: "لا تنفيذ", stageKey: "rejected-stage-key" }),
      () => caller.updateStagedDirective({ directiveId: 17, directiveText: "لا تنفيذ" }),
      () => caller.cancelStagedDirective({ directiveId: 17 }),
      () => caller.submitStagedDirective({ directiveId: 17 }),
      () => caller.executeExecutiveDirective({ workFileId: 60017, directiveText: "لا تنفيذ" }),
    ]) await expect(operation()).rejects.toMatchObject({ code: "FORBIDDEN" });
    for (const fn of [mocks.stage, mocks.submit, mocks.list, mocks.update, mocks.cancel]) expect(fn).not.toHaveBeenCalled();
  });
  it("allows the existing owner's complete review lifecycle with authenticated userId", async () => {
    const caller = comoNextRouter.createCaller(context());
    await caller.listStagedDirectives({ workFileId: 60017 });
    await caller.updateStagedDirective({ directiveId: 17, directiveText: "توجيه للمراجعة فقط" });
    await caller.cancelStagedDirective({ directiveId: 17 });
    await caller.submitStagedDirective({ directiveId: 17 });
    expect(mocks.list).toHaveBeenCalledWith({ userId: 1, workFileId: 60017, includeHistory: true });
    expect(mocks.update).toHaveBeenCalledWith({ userId: 1, directiveId: 17, directiveText: "توجيه للمراجعة فقط" });
    expect(mocks.submit).toHaveBeenCalledWith({ userId: 1, directiveId: 17 });
  });
});
