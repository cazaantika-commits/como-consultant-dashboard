import { beforeEach, describe, expect, it, vi } from "vitest";

const fixtures = vi.hoisted(() => ({
  drizzle: vi.fn(),
  insert: vi.fn(),
  values: vi.fn(),
  write: vi.fn(),
}));
vi.mock("drizzle-orm/mysql2", () => ({ drizzle: fixtures.drizzle }));
vi.mock("./_core/env", () => ({ ENV: { ownerOpenId: "existing-owner", appId: "test-app" } }));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv("DATABASE_URL", "mysql://not-used/test");
  fixtures.drizzle.mockReturnValue({ insert: fixtures.insert });
  fixtures.insert.mockReturnValue({ values: fixtures.values });
  fixtures.values.mockReturnValue({ onDuplicateKeyUpdate: fixtures.write });
  fixtures.write.mockResolvedValue(undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("COMO authentication user persistence", () => {
  it("normalizes Date to the string-mode UTC SQL contract without changing profile/role/creation", async () => {
    const { upsertUser } = await import("./db");
    await upsertUser({ openId: "existing-user", lastSignedIn: new Date("2026-10-26T04:00:00.123Z") });
    expect(fixtures.values).toHaveBeenCalledWith({ openId: "existing-user", lastSignedIn: "2026-10-26 04:00:00" });
    expect(fixtures.write).toHaveBeenCalledWith({ set: { lastSignedIn: "2026-10-26 04:00:00" } });
  });

  it("preserves existing UTC SQL strings and existing explicit owner-role convention", async () => {
    const { upsertUser } = await import("./db");
    await upsertUser({ openId: "existing-owner", lastSignedIn: "2026-10-26 04:00:00" });
    expect(fixtures.values).toHaveBeenCalledWith({ openId: "existing-owner", role: "admin", lastSignedIn: "2026-10-26 04:00:00" });
    expect(fixtures.write).toHaveBeenCalledWith({ set: { role: "admin", lastSignedIn: "2026-10-26 04:00:00" } });
  });

  it("uses the same normalized time for insert and duplicate-update defaults", async () => {
    const { upsertUser } = await import("./db");
    await upsertUser({ openId: "existing-user" });
    const value = fixtures.values.mock.calls[0][0].lastSignedIn;
    expect(value).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    expect(fixtures.write).toHaveBeenCalledWith({ set: { lastSignedIn: value } });
  });

  it("never reports successful persistence without a database", async () => {
    vi.stubEnv("DATABASE_URL", "");
    const { upsertUser } = await import("./db");
    await expect(upsertUser({ openId: "existing-user" })).rejects.toMatchObject({ code: "COMO_DATABASE_UNAVAILABLE" });
    expect(fixtures.write).not.toHaveBeenCalled();
  });

  it("propagates a database failure once without retrying and redacts sensitive logging", async () => {
    const failure = { message: "private-email private-SQL private-token", cause: { code: "ER_LOCK_WAIT_TIMEOUT" } };
    fixtures.write.mockRejectedValue(failure);
    const { upsertUser } = await import("./db");
    await expect(upsertUser({ openId: "existing-user" })).rejects.toBe(failure);
    expect(fixtures.write).toHaveBeenCalledTimes(1);
    const logging = JSON.stringify((console.error as any).mock.calls);
    expect(logging).toContain("database_lock_failed");
    expect(logging).not.toContain("private-email");
    expect(logging).not.toContain("private-SQL");
    expect(logging).not.toContain("private-token");
  });
});
