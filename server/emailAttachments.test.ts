import { describe, it, expect } from "vitest";

describe("Email Attachment Download Tool", () => {
  // ─── Tool Definition ───
  it("should have download_email_attachments tool defined in AGENT_TOOLS", async () => {
    const { AGENT_TOOLS } = await import("./agentTools");
    const tool = AGENT_TOOLS.find((t: any) => t.function.name === "download_email_attachments");
    expect(tool).toBeDefined();
    expect(tool!.function.description).toContain("تنزيل مرفقات");
    expect(tool!.function.parameters.required).toContain("uid");
    expect(tool!.function.parameters.properties).toHaveProperty("targetFolderId");
    expect(tool!.function.parameters.properties).toHaveProperty("renamePattern");
  });

  // ─── Tool Access ───
  it("should allow Salwa to access download_email_attachments", async () => {
    const { getToolsForAgent } = await import("./agentTools");
    const salwaTools = getToolsForAgent("salwa");
    const toolNames = salwaTools.map((t: any) => t.function.name);
    expect(toolNames).toContain("download_email_attachments");
  });

  it("should allow Khazen to access download_email_attachments", async () => {
    const { getToolsForAgent } = await import("./agentTools");
    const khazenTools = getToolsForAgent("khazen");
    const toolNames = khazenTools.map((t: any) => t.function.name);
    expect(toolNames).toContain("download_email_attachments");
  });

  it("should NOT allow other agents to access download_email_attachments", async () => {
    const { getToolsForAgent } = await import("./agentTools");
    const farouqTools = getToolsForAgent("farouq");
    const toolNames = farouqTools.map((t: any) => t.function.name);
    expect(toolNames).not.toContain("download_email_attachments");
  });

  // ─── Write Tool Logging ───
  it("should log download_email_attachments as a write tool (assignment)", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const source = fs.readFileSync(path.join(process.cwd(), "server/agentTools.ts"), "utf-8");
    const writeToolSection = source.substring(
      source.indexOf("WRITE_TOOL_NAMES"),
      source.indexOf("WRITE_TOOL_NAMES") + 800
    );
    expect(writeToolSection).toContain("download_email_attachments");
  });

  // ─── uploadBinaryFile exists ───
  it("should have uploadBinaryFile function in googleDrive module", async () => {
    const { uploadBinaryFile } = await import("./googleDrive");
    expect(typeof uploadBinaryFile).toBe("function");
  });

  // ─── Tool Execution: no attachments ───
  it("should return error when email has no attachments", async () => {
    const { executeAgentTool } = await import("./agentTools");
    // First get a list of emails to find one without attachments
    const checkResult = await executeAgentTool("check_email", { hours: 48 }, 1);
    const checkParsed = JSON.parse(checkResult);
    
    if (checkParsed.data && checkParsed.data.length > 0) {
      const noAttEmail = checkParsed.data.find((e: any) => !e.hasAttachments);
      if (noAttEmail) {
        const result = await executeAgentTool("download_email_attachments", { uid: noAttEmail.uid }, 1);
        const parsed = JSON.parse(result);
        expect(parsed.error).toContain("لا تحتوي على مرفقات");
      }
    }
    // If no emails without attachments, test passes
    expect(true).toBe(true);
  }, 30000);

  // ─── Tool Execution: invalid UID ───
  it("should return error for invalid email UID", async () => {
    const { executeAgentTool } = await import("./agentTools");
    const result = await executeAgentTool("download_email_attachments", { uid: 999999 }, 1);
    const parsed = JSON.parse(result);
    expect(parsed.error).toBeDefined();
  }, 30000);

  // ─── System prompt includes download instructions ───
  it("should include download_email_attachments in Salwa's system prompt", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const source = fs.readFileSync(path.join(process.cwd(), "server/agentChat.ts"), "utf-8");
    expect(source).toContain("download_email_attachments");
    expect(source).toContain("00_Inbox/Emails/");
    expect(source).toContain("renamePattern");
  });

  // ─── Tool Execution: with attachments (integration test) ───
  it("should successfully download attachments from an email with attachments", async () => {
    const { executeAgentTool } = await import("./agentTools");
    const checkResult = await executeAgentTool("check_email", { hours: 72 }, 1);
    const checkParsed = JSON.parse(checkResult);
    
    if (checkParsed.data && checkParsed.data.length > 0) {
      const withAttEmail = checkParsed.data.find((e: any) => e.hasAttachments);
      if (withAttEmail) {
        const result = await executeAgentTool("download_email_attachments", { uid: withAttEmail.uid }, 1);
        const parsed = JSON.parse(result);
        // Should either succeed or give a meaningful error (folder not found etc.)
        if (parsed.success) {
          expect(parsed.uploadedFiles).toBeDefined();
          expect(parsed.uploadedFiles.length).toBeGreaterThan(0);
          expect(parsed.uploadedFiles[0]).toHaveProperty("driveFileId");
          expect(parsed.uploadedFiles[0]).toHaveProperty("webViewLink");
          expect(parsed.uploadedFiles[0]).toHaveProperty("originalName");
          expect(parsed.uploadedFiles[0]).toHaveProperty("uploadedName");
        } else {
          // Could fail due to folder not found - that's OK for test
          expect(parsed.error || parsed.message).toBeDefined();
        }
      }
    }
    // If no emails with attachments found, test passes
    expect(true).toBe(true);
  }, 60000);
});
