import { describe, expect, it } from "vitest";

describe("OpenAI Realtime project credential", () => {
  it("can read the configured Realtime model without exposing the key", async () => {
    const apiKey = process.env.OPENAI_API_KEY;
    expect(apiKey, "OPENAI_API_KEY must be configured in the WebDev runtime").toBeTruthy();

    const response = await fetch("https://api.openai.com/v1/models/gpt-realtime-2.1", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    const payload = await response.json().catch(() => null) as {
      id?: string;
      error?: { message?: string; code?: string };
    } | null;

    expect(
      response.status,
      payload?.error?.code || payload?.error?.message || "OpenAI credential validation failed",
    ).toBe(200);
    expect(payload?.id).toBe("gpt-realtime-2.1");
  }, 20_000);
});
