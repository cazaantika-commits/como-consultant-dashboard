/**
 * Tests for Drive file management tools (rename, move, delete with approval)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("./db", () => ({
  getDb: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue([]),
  })),
}));

vi.mock("./googleDrive", () => ({
  listSharedDrives: vi.fn(),
  listFilesInFolder: vi.fn(),
  searchFiles: vi.fn(),
  copyFile: vi.fn(),
  createFolder: vi.fn(),
  getFileMetadata: vi.fn().mockResolvedValue({
    id: "file123",
    name: "test-file.pdf",
    mimeType: "application/pdf",
    webViewLink: "https://drive.google.com/file/d/file123",
  }),
  readFileContent: vi.fn(),
  uploadTextFile: vi.fn(),
  createGoogleDoc: vi.fn(),
  createGoogleSheet: vi.fn(),
  updateFileContent: vi.fn(),
  renameFile: vi.fn().mockResolvedValue({
    id: "file123",
    name: "new-name.pdf",
    webViewLink: "https://drive.google.com/file/d/file123",
  }),
  moveFile: vi.fn().mockResolvedValue({
    id: "file123",
    name: "test-file.pdf",
    parents: ["folder456"],
    webViewLink: "https://drive.google.com/file/d/file123",
  }),
  deleteFile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./telegramBot", () => ({
  sendNotificationToOwner: vi.fn().mockResolvedValue(true),
  requestDeleteApproval: vi.fn().mockResolvedValue(true),
}));

vi.mock("./agentChat", () => ({
  agentChat: vi.fn().mockResolvedValue({ response: "OK" }),
  handleAgentChat: vi.fn(),
  AgentType: {},
}));

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

import { executeAgentTool, setAgentContext, getToolsForAgent, AGENT_TOOLS } from "./agentTools";

describe("Drive File Management Tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAgentContext("khazen", "test");
  });

  describe("Tool Definitions", () => {
    it("khazen should have rename_drive_file tool", () => {
      const tools = getToolsForAgent("khazen" as any);
      const toolNames = tools.map(t => t.function.name);
      expect(toolNames).toContain("rename_drive_file");
    });

    it("khazen should have move_drive_file tool", () => {
      const tools = getToolsForAgent("khazen" as any);
      const toolNames = tools.map(t => t.function.name);
      expect(toolNames).toContain("move_drive_file");
    });

    it("khazen should NOT have delete_drive_file tool (simplified access)", () => {
      const tools = getToolsForAgent("khazen" as any);
      const toolNames = tools.map(t => t.function.name);
      expect(toolNames).not.toContain("delete_drive_file");
    });

    it("salwa should NOT have rename/move/delete tools", () => {
      const tools = getToolsForAgent("salwa" as any);
      const toolNames = tools.map(t => t.function.name);
      expect(toolNames).not.toContain("rename_drive_file");
      expect(toolNames).not.toContain("move_drive_file");
      expect(toolNames).not.toContain("delete_drive_file");
    });

    it("rename_drive_file tool should have correct parameters", () => {
      const tools = getToolsForAgent("khazen" as any);
      const renameTool = tools.find(t => t.function.name === "rename_drive_file");
      expect(renameTool).toBeDefined();
      expect(renameTool!.function.parameters.required).toContain("fileId");
      expect(renameTool!.function.parameters.required).toContain("newName");
    });

    it("move_drive_file tool should have correct parameters", () => {
      const tools = getToolsForAgent("khazen" as any);
      const moveTool = tools.find(t => t.function.name === "move_drive_file");
      expect(moveTool).toBeDefined();
      expect(moveTool!.function.parameters.required).toContain("fileId");
      expect(moveTool!.function.parameters.required).toContain("newParentFolderId");
    });

    it("delete_drive_file tool should exist in AGENT_TOOLS and require reason", () => {
      const deleteTool = AGENT_TOOLS.find(t => t.function.name === "delete_drive_file");
      expect(deleteTool).toBeDefined();
      expect(deleteTool!.function.parameters.required).toContain("fileId");
      expect(deleteTool!.function.parameters.required).toContain("reason");
      expect(deleteTool!.function.description).toContain("موافقة");
    });
  });

  describe("rename_drive_file execution", () => {
    it("should rename a file successfully", async () => {
      const result = await executeAgentTool("rename_drive_file", {
        fileId: "file123",
        newName: "new-name.pdf",
      }, 1);
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.message).toContain("تم تغيير الاسم");
    });

    it("should fail without fileId", async () => {
      const result = await executeAgentTool("rename_drive_file", {
        newName: "new-name.pdf",
      }, 1);
      const parsed = JSON.parse(result);
      expect(parsed.error).toBeDefined();
    });

    it("should fail without newName", async () => {
      const result = await executeAgentTool("rename_drive_file", {
        fileId: "file123",
      }, 1);
      const parsed = JSON.parse(result);
      expect(parsed.error).toBeDefined();
    });
  });

  describe("move_drive_file execution", () => {
    it("should move a file successfully", async () => {
      const result = await executeAgentTool("move_drive_file", {
        fileId: "file123",
        newParentFolderId: "folder456",
      }, 1);
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.message).toContain("تم نقل");
    });

    it("should fail without required params", async () => {
      const result = await executeAgentTool("move_drive_file", {
        fileId: "file123",
      }, 1);
      const parsed = JSON.parse(result);
      expect(parsed.error).toBeDefined();
    });
  });

  describe("delete_drive_file execution", () => {
    it("should request approval and delete when approved", async () => {
      const { requestDeleteApproval } = await import("./telegramBot");
      (requestDeleteApproval as any).mockResolvedValue(true);

      const result = await executeAgentTool("delete_drive_file", {
        fileId: "file123",
        reason: "ملف مكرر",
      }, 1);
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.message).toContain("تم حذف");
      expect(parsed.message).toContain("موافقة المالك");
    });

    it("should reject deletion when owner rejects", async () => {
      const { requestDeleteApproval } = await import("./telegramBot");
      (requestDeleteApproval as any).mockResolvedValue(false);

      const result = await executeAgentTool("delete_drive_file", {
        fileId: "file123",
        reason: "ملف قديم",
      }, 1);
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.message).toContain("رفض");
    });

    it("should fail without reason", async () => {
      const result = await executeAgentTool("delete_drive_file", {
        fileId: "file123",
      }, 1);
      const parsed = JSON.parse(result);
      expect(parsed.error).toBeDefined();
    });
  });
});
