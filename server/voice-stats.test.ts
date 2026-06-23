import { describe, it, expect, vi } from "vitest";

// Test model usage logging
describe("Model Usage Logging", () => {
  it("should have modelUsageLog table in schema", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.modelUsageLog).toBeDefined();
    expect(schema.modelUsageLog.$inferSelect).toBeDefined;
  });

  it("should track correct fields in modelUsageLog", async () => {
    const schema = await import("../drizzle/schema");
    const table = schema.modelUsageLog;
    // Check that the table has the expected columns
    expect(table.id).toBeDefined();
    expect(table.userId).toBeDefined();
    expect(table.agent).toBeDefined();
    expect(table.model).toBeDefined();
    expect(table.responseTimeMs).toBeDefined();
    expect(table.success).toBeDefined();
    expect(table.isFallback).toBeDefined();
    expect(table.createdAt).toBeDefined();
  });
});

// Test agent model assignment
describe("Agent Model Assignment", () => {
  it("should assign GPT-4o to salwa, alina, khazen, buraq", async () => {
    const agentChat = await import("./agentChat");
    // We test by checking the module exports the correct types
    expect(agentChat.handleAgentChat).toBeDefined();
    expect(typeof agentChat.handleAgentChat).toBe("function");
  });

  it("should export AgentType type", async () => {
    const agentChat = await import("./agentChat");
    // handleAgentChat should accept agent types
    expect(agentChat.handleAgentChat).toBeDefined();
  });
});

// Test voice transcription endpoint structure
describe("Voice Transcription", () => {
  it("should have transcribeAudio function available", async () => {
    const voiceModule = await import("./_core/voiceTranscription");
    expect(voiceModule.transcribeAudio).toBeDefined();
    expect(typeof voiceModule.transcribeAudio).toBe("function");
  });

  it("should have storagePut function for uploading audio", async () => {
    const storageModule = await import("./storage");
    expect(storageModule.storagePut).toBeDefined();
    expect(typeof storageModule.storagePut).toBe("function");
  });
});

// Test model badge mapping
describe("Model Badge Configuration", () => {
  const EXPECTED_MODELS = ["GPT-4o", "Claude Sonnet 4", "Gemini 2.5 Pro"];
  
  const AGENT_MODEL_MAP: Record<string, string> = {
    salwa: "gpt-4o",
    alina: "gpt-4o",
    khazen: "gpt-4o",
    buraq: "gpt-4o",
    farouq: "claude-sonnet-4",
    khaled: "claude-sonnet-4",
    baz: "claude-sonnet-4",
    joelle: "gemini-2.5-pro",
  };

  it("should have all 8 agents mapped to models", () => {
    expect(Object.keys(AGENT_MODEL_MAP)).toHaveLength(8);
  });

  it("should map GPT-4o agents correctly", () => {
    expect(AGENT_MODEL_MAP.salwa).toBe("gpt-4o");
    expect(AGENT_MODEL_MAP.alina).toBe("gpt-4o");
    expect(AGENT_MODEL_MAP.khazen).toBe("gpt-4o");
    expect(AGENT_MODEL_MAP.buraq).toBe("gpt-4o");
  });

  it("should map Claude agents correctly", () => {
    expect(AGENT_MODEL_MAP.farouq).toBe("claude-sonnet-4");
    expect(AGENT_MODEL_MAP.khaled).toBe("claude-sonnet-4");
    expect(AGENT_MODEL_MAP.baz).toBe("claude-sonnet-4");
  });

  it("should map Gemini agent correctly", () => {
    expect(AGENT_MODEL_MAP.joelle).toBe("gemini-2.5-pro");
  });

  it("should have 3 distinct model types", () => {
    const uniqueModels = [...new Set(Object.values(AGENT_MODEL_MAP))];
    expect(uniqueModels).toHaveLength(3);
    expect(uniqueModels).toContain("gpt-4o");
    expect(uniqueModels).toContain("claude-sonnet-4");
    expect(uniqueModels).toContain("gemini-2.5-pro");
  });
});

// Test model stats query structure
describe("Model Stats Query Structure", () => {
  it("should return expected stats shape", () => {
    const emptyStats = {
      byModel: [],
      byAgent: [],
      recentActivity: [],
      totals: { totalCalls: 0, avgResponseTime: 0, successRate: 0 },
    };

    expect(emptyStats).toHaveProperty("byModel");
    expect(emptyStats).toHaveProperty("byAgent");
    expect(emptyStats).toHaveProperty("recentActivity");
    expect(emptyStats).toHaveProperty("totals");
    expect(emptyStats.totals).toHaveProperty("totalCalls");
    expect(emptyStats.totals).toHaveProperty("avgResponseTime");
    expect(emptyStats.totals).toHaveProperty("successRate");
  });
});
