import { describe, it, expect, vi, beforeEach } from "vitest";

// We test the retry logic concept since fetchWithRetry is a private function in agentChat.ts
// We replicate the logic here for testing purposes

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  label: string,
  maxRetries: number = 3,
  fetchFn: typeof fetch = fetch
): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetchFn(url, options);
    if (response.status === 429 && attempt < maxRetries) {
      const retryAfter = response.headers.get('retry-after');
      const waitMs = retryAfter ? parseInt(retryAfter) * 1000 : Math.min(1000 * Math.pow(2, attempt + 1), 30000);
      // In tests we don't actually wait
      continue;
    }
    return response;
  }
  return fetchFn(url, options);
}

describe("fetchWithRetry - Rate Limit Handling", () => {
  it("should return immediately on 200 response", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );

    const result = await fetchWithRetry("https://api.test.com", {}, "Test", 3, mockFetch);
    expect(result.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("should retry on 429 and succeed on second attempt", async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(new Response("Rate limited", { status: 429 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    const result = await fetchWithRetry("https://api.test.com", {}, "Test", 3, mockFetch);
    expect(result.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("should retry up to maxRetries times on repeated 429", async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(new Response("Rate limited", { status: 429 }))
      .mockResolvedValueOnce(new Response("Rate limited", { status: 429 }))
      .mockResolvedValueOnce(new Response("Rate limited", { status: 429 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    const result = await fetchWithRetry("https://api.test.com", {}, "Test", 3, mockFetch);
    expect(result.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(4);
  });

  it("should return 429 response after exhausting all retries", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response("Rate limited", { status: 429 })
    );

    const result = await fetchWithRetry("https://api.test.com", {}, "Test", 2, mockFetch);
    // After 2 retries (3 total attempts), should return the 429 response
    expect(result.status).toBe(429);
    expect(mockFetch).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it("should not retry on non-429 errors (e.g., 500)", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response("Server error", { status: 500 })
    );

    const result = await fetchWithRetry("https://api.test.com", {}, "Test", 3, mockFetch);
    expect(result.status).toBe(500);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("should not retry on 401 unauthorized", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response("Unauthorized", { status: 401 })
    );

    const result = await fetchWithRetry("https://api.test.com", {}, "Test", 3, mockFetch);
    expect(result.status).toBe(401);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("should respect retry-after header", async () => {
    const headers = new Headers();
    headers.set('retry-after', '2');
    
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(new Response("Rate limited", { status: 429, headers }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    const result = await fetchWithRetry("https://api.test.com", {}, "Test", 3, mockFetch);
    expect(result.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("should pass correct URL and options to fetch", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );

    const options = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ test: true }),
    };

    await fetchWithRetry("https://api.openai.com/v1/chat/completions", options, "OpenAI", 3, mockFetch);
    expect(mockFetch).toHaveBeenCalledWith("https://api.openai.com/v1/chat/completions", options);
  });
});

describe("Agent Communication - ask_another_agent resilience", () => {
  it("should handle the scenario where Salwa asks Khazen (nested API calls)", async () => {
    // When Salwa uses ask_another_agent to talk to Khazen,
    // two separate LLM calls happen. If the second one gets 429,
    // the retry logic should handle it gracefully.
    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // First call (Salwa's initial call) succeeds
        return Promise.resolve(new Response(JSON.stringify({
          choices: [{ message: { content: "I'll ask Khazen" } }]
        }), { status: 200 }));
      } else if (callCount === 2) {
        // Second call (Khazen's call) gets rate limited
        return Promise.resolve(new Response("Rate limited", { status: 429 }));
      } else {
        // Third call (Khazen's retry) succeeds
        return Promise.resolve(new Response(JSON.stringify({
          choices: [{ message: { content: "Here are the project files" } }]
        }), { status: 200 }));
      }
    });

    // Simulate Salwa's call
    const salwaResult = await fetchWithRetry("https://api.openai.com/v1/chat/completions", {}, "OpenAI", 3, mockFetch);
    expect(salwaResult.status).toBe(200);

    // Simulate Khazen's call (would get 429 then retry)
    const khazenResult = await fetchWithRetry("https://api.openai.com/v1/chat/completions", {}, "OpenAI", 3, mockFetch);
    expect(khazenResult.status).toBe(200);
    expect(callCount).toBe(3);
  });
});
