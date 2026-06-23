import { describe, it, expect } from "vitest";

describe("OpenAI API Key Validation", () => {
  it("should have OPENAI_API_KEY configured", () => {
    const key = process.env.OPENAI_API_KEY;
    expect(key).toBeDefined();
    expect(key!.length).toBeGreaterThan(10);
    expect(key!.startsWith("sk-")).toBe(true);
  });

  it("should successfully call OpenAI API with a simple prompt", async () => {
    const apiKey = process.env.OPENAI_API_KEY;
    expect(apiKey).toBeDefined();

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "You are a test assistant. Reply with exactly: OK" },
          { role: "user", content: "Test" }
        ],
        max_tokens: 10,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI Error:", response.status, errorText);
    }
    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.choices).toBeDefined();
    expect(data.choices.length).toBeGreaterThan(0);
    expect(data.choices[0].message.content).toBeDefined();
  }, 15000);

  it("should handle Arabic conversation for Salwa agent", async () => {
    const apiKey = process.env.OPENAI_API_KEY;
    expect(apiKey).toBeDefined();

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "أنتِ سلوى، المنسقة الرئيسية لفريق كومو. أجيبي بالعربية بشكل ودود." },
          { role: "user", content: "مرحبا سلوى، كيف حالك؟" }
        ],
        max_tokens: 100,
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI Arabic Error:", response.status, errorText);
    }
    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.choices[0].message.content.length).toBeGreaterThan(5);
  }, 15000);
});
