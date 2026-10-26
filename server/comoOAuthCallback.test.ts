import { beforeEach, describe, expect, it, vi } from "vitest";

const deps = vi.hoisted(() => ({
  exchangeCodeForToken: vi.fn(),
  getUserInfo: vi.fn(),
  createSessionToken: vi.fn(),
  getDb: vi.fn(),
  upsertUser: vi.fn(),
  env: {
    appId: "test-app",
    cookieSecret: "test-signing-secret",
    databaseUrl: "mysql://test-only/not-used",
    oAuthServerUrl: "https://test-auth.example",
  },
}));

vi.mock("./_core/sdk", () => ({ sdk: deps }));
vi.mock("./db", () => ({ getDb: deps.getDb, upsertUser: deps.upsertUser }));
vi.mock("./_core/env", () => ({ ENV: deps.env }));

import { registerOAuthRoutes } from "./_core/oauth";

function harness(query: Record<string, unknown> = { code: "private-code", state: "private-state" }) {
  let callback: (req: any, res: any) => Promise<void>;
  const app = { get: vi.fn((_path, handler) => { callback = handler; }) };
  registerOAuthRoutes(app as any);
  const res: any = { statusCode: 200 };
  res.status = vi.fn((code) => { res.statusCode = code; return res; });
  res.json = vi.fn(() => res);
  res.cookie = vi.fn(() => res);
  res.clearCookie = vi.fn(() => res);
  res.redirect = vi.fn(() => res);
  return {
    res,
    run: () => callback!({ query, protocol: "https", headers: {} }, res),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  deps.env.cookieSecret = "test-signing-secret";
  deps.env.databaseUrl = "mysql://test-only/not-used";
  deps.exchangeCodeForToken.mockResolvedValue({ accessToken: "private-access-token" });
  deps.getUserInfo.mockResolvedValue({ openId: "test-user", name: "Test User", email: "private-email@example.test" });
  deps.createSessionToken.mockResolvedValue("private-session-token");
  deps.getDb.mockResolvedValue({});
  deps.upsertUser.mockResolvedValue(undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("COMO OAuth callback diagnostics and fail-closed persistence", () => {
  it("completes persistence before signing, preserves secure cookie and fixed redirect", async () => {
    const { res, run } = harness();
    await run();
    expect(deps.exchangeCodeForToken).toHaveBeenCalledTimes(1);
    expect(deps.upsertUser).toHaveBeenCalledWith(expect.objectContaining({ openId: "test-user" }));
    expect(deps.upsertUser.mock.invocationCallOrder[0]).toBeLessThan(deps.createSessionToken.mock.invocationCallOrder[0]);
    expect(res.cookie).toHaveBeenCalledWith(expect.any(String), "private-session-token", expect.objectContaining({
      httpOnly: true, secure: true, path: "/", sameSite: "none",
    }));
    expect(res.redirect).toHaveBeenCalledWith(302, "/");
    expect(res.json).not.toHaveBeenCalled();
  });

  it("rejects missing callback input without exchanging or creating a session", async () => {
    const { res, run } = harness({ state: "private-state" });
    await run();
    expect(res.statusCode).toBe(400);
    expect(deps.exchangeCodeForToken).not.toHaveBeenCalled();
    expect(res.cookie).not.toHaveBeenCalled();
  });

  it("fails closed when signing configuration is missing, before consuming the code", async () => {
    deps.env.cookieSecret = "";
    const { res, run } = harness();
    await run();
    expect(res.statusCode).toBe(503);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ failure_stage: "configuration", failure_code: "configuration_missing" }));
    expect(deps.exchangeCodeForToken).not.toHaveBeenCalled();
    expect(res.cookie).not.toHaveBeenCalled();
  });

  it("identifies rejected authorization codes without retrying the one-time exchange", async () => {
    deps.exchangeCodeForToken.mockRejectedValue({ response: { status: 401, data: { message: "private-provider-body" } } });
    const { res, run } = harness();
    await run();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ failure_stage: "exchange_token", failure_code: "authorization_code_rejected" }));
    expect(deps.exchangeCodeForToken).toHaveBeenCalledTimes(1);
    expect(deps.getUserInfo).not.toHaveBeenCalled();
    expect(res.cookie).not.toHaveBeenCalled();
  });

  it("distinguishes identity lookup failure from persistence failure", async () => {
    deps.getUserInfo.mockRejectedValue({ response: { status: 403 } });
    const { res, run } = harness();
    await run();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ failure_stage: "user_info", failure_code: "identity_lookup_rejected" }));
    expect(deps.upsertUser).not.toHaveBeenCalled();
    expect(deps.createSessionToken).not.toHaveBeenCalled();
  });

  it("does not issue a session when database availability is unknown", async () => {
    deps.getDb.mockResolvedValue(null);
    const { res, run } = harness();
    await run();
    expect(res.statusCode).toBe(503);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ failure_stage: "user_persistence", failure_code: "database_unavailable" }));
    expect(deps.upsertUser).not.toHaveBeenCalled();
    expect(deps.createSessionToken).not.toHaveBeenCalled();
    expect(res.cookie).not.toHaveBeenCalled();
  });

  it("labels nested transient database errors and never logs SQL, PII or credentials", async () => {
    deps.upsertUser.mockRejectedValue({
      message: "private-code private-state private-access-token private-session-token private-email@example.test",
      query: "private-SQL",
      cause: { code: "PROTOCOL_CONNECTION_LOST", message: "private-SQL" },
    });
    const { res, run } = harness();
    await run();
    expect(res.statusCode).toBe(503);
    const payload = res.json.mock.calls[0][0];
    expect(payload).toMatchObject({ error: "OAuth callback failed", failure_stage: "user_persistence", failure_code: "database_connection_failed" });
    expect(payload.reference).toMatch(/^como-auth-[a-f0-9-]+$/);
    const rendered = JSON.stringify([payload, (console.error as any).mock.calls]);
    for (const secret of ["private-code", "private-state", "private-access-token", "private-session-token", "private-email", "private-SQL"]) {
      expect(rendered).not.toContain(secret);
    }
    expect(deps.createSessionToken).not.toHaveBeenCalled();
    expect(res.cookie).not.toHaveBeenCalled();
    expect(res.redirect).not.toHaveBeenCalled();
  });

  it("does not issue a cookie if signing fails, with an actionable safe stage", async () => {
    deps.createSessionToken.mockRejectedValue(new Error("private-secret"));
    const { res, run } = harness();
    await run();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ failure_stage: "session_signing", failure_code: "session_creation_failed" }));
    expect(res.cookie).not.toHaveBeenCalled();
    expect(res.redirect).not.toHaveBeenCalled();
  });

  it("clears an attached session cookie if the final redirect fails", async () => {
    const { res, run } = harness();
    res.redirect.mockImplementationOnce(() => { throw new Error("private-redirect-error"); });
    await run();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ failure_stage: "session_cookie" }));
    expect(res.clearCookie).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      httpOnly: true, secure: true, sameSite: "none", path: "/",
    }));
  });
});
