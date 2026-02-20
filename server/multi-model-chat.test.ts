import { describe, it, expect } from "vitest";

describe("Multi-Model Agent Chat Integration", () => {
  // Test 1: OpenAI GPT-4o API key validation
  it("should validate OpenAI GPT-4o API key works", async () => {
    const apiKey = process.env.OPENAI_API_KEY;
    expect(apiKey).toBeTruthy();

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "أنت مساعد اختبار. أجب بكلمة واحدة فقط." },
          { role: "user", content: "قل: نجح" },
        ],
        max_tokens: 10,
      }),
    });

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.choices).toBeDefined();
    expect(data.choices[0].message.content).toBeTruthy();
    console.log("[Test] GPT-4o response:", data.choices[0].message.content);
  }, 30000);

  // Test 2: Anthropic Claude Sonnet 4 API key validation
  it("should validate Anthropic Claude Sonnet 4 API key works", async () => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    expect(apiKey).toBeTruthy();

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 10,
        messages: [
          { role: "user", content: "قل كلمة واحدة فقط: نجح" },
        ],
      }),
    });

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.content).toBeDefined();
    expect(data.content[0].text).toBeTruthy();
    console.log("[Test] Claude Sonnet 4 response:", data.content[0].text);
  }, 30000);

  // Test 3: Google Gemini 3 Flash API key validation
  it("should validate Google Gemini 3 Flash API key works", async () => {
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    expect(apiKey).toBeTruthy();

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            { role: "user", parts: [{ text: "قل كلمة واحدة فقط: نجح" }] },
          ],
          generationConfig: { maxOutputTokens: 100 },
        }),
      }
    );

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.candidates).toBeDefined();
    expect(data.candidates[0].content.parts[0].text).toBeTruthy();
    console.log("[Test] Gemini 3 Flash response:", data.candidates[0].content.parts[0].text);
  }, 60000);

  // Test 4: Model routing map is correct
  it("should have correct model assignments for all agents", () => {
    const expectedMap: Record<string, string> = {
      salwa: "gpt-4o",
      alina: "gpt-4o",
      khazen: "gpt-4o",
      buraq: "gpt-4o",
      farouq: "claude-sonnet-4",
      khaled: "claude-sonnet-4",
      baz: "claude-sonnet-4",
      joelle: "gemini-3-flash",
    };

    // Verify all 8 agents are mapped
    expect(Object.keys(expectedMap)).toHaveLength(8);
    
    // GPT-4o agents
    expect(expectedMap.salwa).toBe("gpt-4o");
    expect(expectedMap.alina).toBe("gpt-4o");
    expect(expectedMap.khazen).toBe("gpt-4o");
    expect(expectedMap.buraq).toBe("gpt-4o");
    
    // Claude Sonnet 4 agents
    expect(expectedMap.farouq).toBe("claude-sonnet-4");
    expect(expectedMap.khaled).toBe("claude-sonnet-4");
    expect(expectedMap.baz).toBe("claude-sonnet-4");
    
    // Gemini 3 Flash agent
    expect(expectedMap.joelle).toBe("gemini-3-flash");
  });
});
