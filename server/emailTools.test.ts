import { describe, it, expect } from "vitest";

describe("Email Agent Tools - Salwa Platform Email Access", () => {
  // ─── Tool Definitions ───
  it("should have check_email tool defined in AGENT_TOOLS", async () => {
    const { AGENT_TOOLS } = await import("./agentTools");
    const tool = AGENT_TOOLS.find((t: any) => t.function.name === "check_email");
    expect(tool).toBeDefined();
    expect(tool!.function.description).toContain("فحص الإيميل");
  });

  it("should have read_email tool defined in AGENT_TOOLS", async () => {
    const { AGENT_TOOLS } = await import("./agentTools");
    const tool = AGENT_TOOLS.find((t: any) => t.function.name === "read_email");
    expect(tool).toBeDefined();
    expect(tool!.function.parameters.required).toContain("uid");
  });

  it("should have reply_email tool defined in AGENT_TOOLS", async () => {
    const { AGENT_TOOLS } = await import("./agentTools");
    const tool = AGENT_TOOLS.find((t: any) => t.function.name === "reply_email");
    expect(tool).toBeDefined();
    expect(tool!.function.parameters.required).toContain("to");
    expect(tool!.function.parameters.required).toContain("subject");
    expect(tool!.function.parameters.required).toContain("body");
  });

  it("should have compose_email tool defined in AGENT_TOOLS", async () => {
    const { AGENT_TOOLS } = await import("./agentTools");
    const tool = AGENT_TOOLS.find((t: any) => t.function.name === "compose_email");
    expect(tool).toBeDefined();
    expect(tool!.function.parameters.required).toContain("to");
    expect(tool!.function.parameters.required).toContain("subject");
    expect(tool!.function.parameters.required).toContain("body");
  });

  // ─── Tool Access ───
  it("should allow Salwa to access all email tools", async () => {
    const { getToolsForAgent } = await import("./agentTools");
    const salwaTools = getToolsForAgent("salwa");
    const toolNames = salwaTools.map((t: any) => t.function.name);
    expect(toolNames).toContain("check_email");
    expect(toolNames).toContain("read_email");
    expect(toolNames).toContain("reply_email");
    expect(toolNames).toContain("compose_email");
  });

  it("should NOT allow other agents to access email tools", async () => {
    const { getToolsForAgent } = await import("./agentTools");
    const farouqTools = getToolsForAgent("farouq");
    const toolNames = farouqTools.map((t: any) => t.function.name);
    expect(toolNames).not.toContain("check_email");
    expect(toolNames).not.toContain("read_email");
    expect(toolNames).not.toContain("reply_email");
    expect(toolNames).not.toContain("compose_email");
  });

  // ─── Tool Execution: check_email ───
  it("should execute check_email and return email list", async () => {
    const { executeAgentTool } = await import("./agentTools");
    const result = await executeAgentTool("check_email", { hours: 48 }, 1);
    const parsed = JSON.parse(result);
    // Should either have data or a message about no emails
    expect(parsed).toHaveProperty("message");
    if (parsed.data && parsed.data.length > 0) {
      const email = parsed.data[0];
      expect(email).toHaveProperty("uid");
      expect(email).toHaveProperty("from");
      expect(email).toHaveProperty("fromName");
      expect(email).toHaveProperty("subject");
      expect(email).toHaveProperty("date");
      expect(email).toHaveProperty("isRead");
      expect(email).toHaveProperty("hasAttachments");
    }
  }, 30000);

  // ─── Tool Execution: read_email ───
  it("should execute read_email and return email details or not-found error", async () => {
    const { executeAgentTool } = await import("./agentTools");
    // First get a valid UID from check_email
    const checkResult = await executeAgentTool("check_email", { hours: 48 }, 1);
    const checkParsed = JSON.parse(checkResult);
    
    if (checkParsed.data && checkParsed.data.length > 0) {
      const uid = checkParsed.data[0].uid;
      const result = await executeAgentTool("read_email", { uid }, 1);
      const parsed = JSON.parse(result);
      expect(parsed).toHaveProperty("message");
      expect(parsed.data).toHaveProperty("uid");
      expect(parsed.data).toHaveProperty("from");
      expect(parsed.data).toHaveProperty("subject");
      expect(parsed.data).toHaveProperty("body");
      expect(parsed.data).toHaveProperty("messageId");
    } else {
      // No emails to read, test with invalid UID
      const result = await executeAgentTool("read_email", { uid: 999999 }, 1);
      const parsed = JSON.parse(result);
      expect(parsed).toHaveProperty("error");
    }
  }, 30000);

  // ─── Salwa System Prompt ───
  it("should include email tool instructions in Salwa's system prompt", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const source = fs.readFileSync(path.join(process.cwd(), "server/agentChat.ts"), "utf-8");
    
    expect(source).toContain("check_email");
    expect(source).toContain("read_email");
    expect(source).toContain("reply_email");
    expect(source).toContain("compose_email");
    expect(source).toContain("اعرضي المسودة على المستخدم");
  });

  // ─── Write tools logged as assignments ───
  it("should log reply_email and compose_email as assignments", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const source = fs.readFileSync(path.join(process.cwd(), "server/agentTools.ts"), "utf-8");
    
    expect(source).toContain('"reply_email"');
    expect(source).toContain('"compose_email"');
    // These should be in WRITE_TOOL_NAMES
    const writeToolSection = source.substring(
      source.indexOf("WRITE_TOOL_NAMES"),
      source.indexOf("WRITE_TOOL_NAMES") + 700
    );
    expect(writeToolSection).toContain("reply_email");
    expect(writeToolSection).toContain("compose_email");
  });
});
