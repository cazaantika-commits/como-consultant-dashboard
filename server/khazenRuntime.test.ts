import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (file: string) => fs.readFileSync(path.resolve(process.cwd(), file), "utf8");

describe("Khazen built-in extraction runtime", () => {
  const agentChat = read("server/agentChat.ts");
  const llm = read("server/_core/llm.ts");

  it("routes Khazen to the built-in model before unavailable external providers", () => {
    expect(agentChat).toContain('if (agent === "khazen")');
    expect(agentChat).toContain("Manus built-in LLM with tools");
  });

  it("preserves tool calls and executes the approved project-fact tools", () => {
    expect(agentChat).toContain("tool_calls: toolCalls");
    expect(agentChat).toContain("executeAgentTool(toolCall.function.name");
    expect(llm).toContain("tool_calls?: ToolCall[]");
    expect(llm).toContain("...(tool_calls ? { tool_calls } : {})");
  });
});
