export type ComoOAuthStage =
  | "configuration"
  | "exchange_token"
  | "user_info"
  | "user_persistence"
  | "session_signing"
  | "session_cookie";

// Deliberately return only predefined categories. Never serialize errors, SQL,
// provider bodies, OAuth codes, tokens, state, cookies or user identity.
export function describeComoOAuthFailure(stage: ComoOAuthStage, error: unknown) {
  let cursor: any = error;
  let providerStatus: number | undefined;
  const codes: string[] = [];
  for (let depth = 0; cursor && depth < 4; depth++) {
    if (typeof cursor.code === "string") codes.push(cursor.code);
    if (typeof cursor.errno === "number") codes.push(String(cursor.errno));
    if (typeof cursor.response?.status === "number") providerStatus = cursor.response.status;
    cursor = cursor.cause;
  }

  let failureCode: string;
  let status = 500;
  if (stage === "configuration") {
    failureCode = "configuration_missing";
    status = 503;
  } else if (stage === "user_persistence" && codes.includes("COMO_DATABASE_UNAVAILABLE")) {
    failureCode = "database_unavailable";
    status = 503;
  } else if (stage === "user_persistence" && codes.some(code => ["PROTOCOL_CONNECTION_LOST", "ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "POOL_CLOSED"].includes(code))) {
    failureCode = "database_connection_failed";
    status = 503;
  } else if (stage === "user_persistence" && codes.some(code => ["ER_LOCK_WAIT_TIMEOUT", "ER_LOCK_DEADLOCK", "9004", "1205", "1213"].includes(code))) {
    failureCode = "database_lock_failed";
    status = 503;
  } else if (stage === "user_persistence") {
    failureCode = "database_write_failed";
  } else if (codes.some(code => ["ETIMEDOUT", "ECONNABORTED", "ECONNRESET", "ENOTFOUND", "EAI_AGAIN"].includes(code))) {
    failureCode = "identity_service_unavailable";
    status = 503;
  } else if (stage === "exchange_token" && [400, 401, 403].includes(providerStatus ?? 0)) {
    failureCode = "authorization_code_rejected";
  } else if (stage === "user_info" && [400, 401, 403].includes(providerStatus ?? 0)) {
    failureCode = "identity_lookup_rejected";
  } else if (stage === "exchange_token") {
    failureCode = "token_exchange_failed";
  } else if (stage === "user_info") {
    failureCode = "identity_lookup_failed";
  } else {
    failureCode = "session_creation_failed";
  }
  return { stage, failureCode, status };
}
