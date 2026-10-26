import { describe, expect, it } from "vitest";
import { describeComoOAuthFailure } from "./services/comoOAuthDiagnostics";

describe("COMO safe OAuth diagnostics", () => {
  it.each([
    ["PROTOCOL_CONNECTION_LOST", "database_connection_failed"],
    ["ECONNRESET", "database_connection_failed"],
    ["ER_LOCK_WAIT_TIMEOUT", "database_lock_failed"],
    ["ER_LOCK_DEADLOCK", "database_lock_failed"],
  ])("classifies nested %s without serializing it", (code, expected) => {
    expect(describeComoOAuthFailure("user_persistence", { cause: { code, query: "private-sql" } }))
      .toEqual({ stage: "user_persistence", failureCode: expected, status: 503 });
  });
  it("recognizes TiDB lock timeout errno without logging SQL or provider message", () => {
    expect(describeComoOAuthFailure("user_persistence", { cause: { errno: 9004, sqlMessage: "private-sql" } }).failureCode).toBe("database_lock_failed");
  });
  it("keeps unrelated database failures generic and never returns hostile fields", () => {
    const result = describeComoOAuthFailure("user_persistence", { code: "SECRET-TOKEN", name: "SECRET-EMAIL", message: "SECRET-SQL" });
    expect(result).toEqual({ stage: "user_persistence", failureCode: "database_write_failed", status: 500 });
    expect(JSON.stringify(result)).not.toContain("SECRET");
  });
  it("limits nested inspection even when error causes are cyclic", () => {
    const error: any = { code: "ER_LOCK_DEADLOCK" };
    error.cause = error;
    expect(describeComoOAuthFailure("user_persistence", error).failureCode).toBe("database_lock_failed");
  });
  it("distinguishes provider timeouts from credential rejection", () => {
    expect(describeComoOAuthFailure("exchange_token", { code: "ECONNABORTED" }))
      .toEqual({ stage: "exchange_token", failureCode: "identity_service_unavailable", status: 503 });
  });
});
