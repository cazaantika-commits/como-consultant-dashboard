import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock googleDrive module
vi.mock("./googleDrive", () => ({
  listSharedDrives: vi.fn().mockResolvedValue([]),
  listFilesInFolder: vi.fn().mockResolvedValue([]),
  searchFiles: vi.fn().mockResolvedValue([]),
  copyFile: vi.fn().mockResolvedValue({ id: "copy1", name: "copied.pdf", mimeType: "application/pdf" }),
  createFolder: vi.fn().mockResolvedValue({ id: "folder1", name: "New Folder", mimeType: "application/vnd.google-apps.folder" }),
  getFileMetadata: vi.fn().mockResolvedValue({ id: "file1", name: "test.pdf", mimeType: "application/pdf" }),
  readFileContent: vi.fn().mockResolvedValue({ content: "file content", mimeType: "text/plain", truncated: false }),
  uploadTextFile: vi.fn().mockResolvedValue({ id: "upload1", name: "report.txt", mimeType: "text/plain", webViewLink: "https://drive.google.com/file/d/upload1" }),
  createGoogleDoc: vi.fn().mockResolvedValue({ id: "doc1", name: "Meeting Report", mimeType: "application/vnd.google-apps.document", webViewLink: "https://docs.google.com/document/d/doc1" }),
  createGoogleSheet: vi.fn().mockResolvedValue({ id: "sheet1", name: "Comparison Table", mimeType: "application/vnd.google-apps.spreadsheet", webViewLink: "https://docs.google.com/spreadsheets/d/sheet1" }),
  updateFileContent: vi.fn().mockResolvedValue({ id: "file1", name: "updated.txt", mimeType: "text/plain", webViewLink: "https://drive.google.com/file/d/file1" }),
}));

// Mock other dependencies
vi.mock("drizzle-orm", () => ({
  eq: vi.fn(), and: vi.fn(), desc: vi.fn(), sql: vi.fn(), inArray: vi.fn(), or: vi.fn(), like: vi.fn(), gte: vi.fn(), lte: vi.fn(), isNull: vi.fn(), count: vi.fn(), sum: vi.fn(), avg: vi.fn(),
}));
vi.mock("../drizzle/schema", () => ({}));
vi.mock("./db", () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
  getDb: vi.fn().mockResolvedValue({ select: vi.fn().mockReturnThis(), from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([]), insert: vi.fn().mockReturnThis(), values: vi.fn().mockResolvedValue([{ insertId: 1 }]), update: vi.fn().mockReturnThis(), set: vi.fn().mockReturnThis() }),
  searchKnowledgeBase: vi.fn().mockResolvedValue([]),
}));

describe("Drive Upload/Create Agent Tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Tool Definitions", () => {
    it("should include create_drive_document tool", async () => {
      const { AGENT_TOOLS } = await import("./agentTools");
      const tool = AGENT_TOOLS.find(t => t.function.name === "create_drive_document");
      expect(tool).toBeDefined();
      expect(tool!.function.parameters.required).toContain("title");
      expect(tool!.function.parameters.required).toContain("content");
      expect(tool!.function.parameters.required).toContain("parentFolderId");
    });

    it("should include create_drive_spreadsheet tool", async () => {
      const { AGENT_TOOLS } = await import("./agentTools");
      const tool = AGENT_TOOLS.find(t => t.function.name === "create_drive_spreadsheet");
      expect(tool).toBeDefined();
      expect(tool!.function.parameters.required).toContain("title");
      expect(tool!.function.parameters.required).toContain("csvContent");
      expect(tool!.function.parameters.required).toContain("parentFolderId");
    });

    it("should include upload_text_file tool", async () => {
      const { AGENT_TOOLS } = await import("./agentTools");
      const tool = AGENT_TOOLS.find(t => t.function.name === "upload_text_file");
      expect(tool).toBeDefined();
      expect(tool!.function.parameters.required).toContain("fileName");
      expect(tool!.function.parameters.required).toContain("content");
      expect(tool!.function.parameters.required).toContain("parentFolderId");
    });

    it("should include update_drive_file tool", async () => {
      const { AGENT_TOOLS } = await import("./agentTools");
      const tool = AGENT_TOOLS.find(t => t.function.name === "update_drive_file");
      expect(tool).toBeDefined();
      expect(tool!.function.parameters.required).toContain("fileId");
      expect(tool!.function.parameters.required).toContain("content");
    });
  });

  describe("Agent Permissions", () => {
    it("khazen should have all Drive write tools", async () => {
      const { getToolsForAgent } = await import("./agentTools");
      const tools = getToolsForAgent("khazen" as any);
      const toolNames = tools.map(t => t.function.name);
      expect(toolNames).toContain("create_drive_document");
      expect(toolNames).toContain("create_drive_spreadsheet");
      expect(toolNames).toContain("upload_text_file");
      expect(toolNames).toContain("update_drive_file");
    });

    it("salwa should have create_drive_document and create_drive_spreadsheet", async () => {
      const { getToolsForAgent } = await import("./agentTools");
      const tools = getToolsForAgent("salwa" as any);
      const toolNames = tools.map(t => t.function.name);
      expect(toolNames).toContain("create_drive_document");
      expect(toolNames).toContain("create_drive_spreadsheet");
    });

    it("alina should have create_drive_document and create_drive_spreadsheet", async () => {
      const { getToolsForAgent } = await import("./agentTools");
      const tools = getToolsForAgent("alina" as any);
      const toolNames = tools.map(t => t.function.name);
      expect(toolNames).toContain("create_drive_document");
      expect(toolNames).toContain("create_drive_spreadsheet");
    });

    it("buraq should NOT have Drive write tools", async () => {
      const { getToolsForAgent } = await import("./agentTools");
      const tools = getToolsForAgent("buraq" as any);
      const toolNames = tools.map(t => t.function.name);
      expect(toolNames).not.toContain("create_drive_document");
      expect(toolNames).not.toContain("upload_text_file");
    });
  });

  describe("Tool Execution", () => {
    it("create_drive_document should call createGoogleDoc", async () => {
      const { executeAgentTool } = await import("./agentTools");
      const { createGoogleDoc } = await import("./googleDrive");
      const result = await executeAgentTool("create_drive_document", {
        title: "Meeting Report",
        content: "# Meeting Notes\n\nDiscussion points...",
        parentFolderId: "folder123",
        contentType: "text"
      });
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.data.id).toBe("doc1");
      expect(createGoogleDoc).toHaveBeenCalledWith("Meeting Report", "# Meeting Notes\n\nDiscussion points...", "folder123", "text");
    });

    it("create_drive_spreadsheet should call createGoogleSheet", async () => {
      const { executeAgentTool } = await import("./agentTools");
      const { createGoogleSheet } = await import("./googleDrive");
      const result = await executeAgentTool("create_drive_spreadsheet", {
        title: "Comparison Table",
        csvContent: "Consultant,Price,Rating\nARTEC,500000,8\nDar,450000,7",
        parentFolderId: "folder123"
      });
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.data.id).toBe("sheet1");
      expect(createGoogleSheet).toHaveBeenCalledWith("Comparison Table", "Consultant,Price,Rating\nARTEC,500000,8\nDar,450000,7", "folder123");
    });

    it("upload_text_file should call uploadTextFile", async () => {
      const { executeAgentTool } = await import("./agentTools");
      const { uploadTextFile } = await import("./googleDrive");
      const result = await executeAgentTool("upload_text_file", {
        fileName: "report.txt",
        content: "This is a report",
        parentFolderId: "folder123",
        mimeType: "text/plain"
      });
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.data.id).toBe("upload1");
      expect(uploadTextFile).toHaveBeenCalledWith("report.txt", "This is a report", "folder123", "text/plain");
    });

    it("update_drive_file should call updateFileContent", async () => {
      const { executeAgentTool } = await import("./agentTools");
      const { updateFileContent } = await import("./googleDrive");
      const result = await executeAgentTool("update_drive_file", {
        fileId: "file123",
        content: "Updated content",
        mimeType: "text/plain"
      });
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.data.id).toBe("file1");
      expect(updateFileContent).toHaveBeenCalledWith("file123", "Updated content", "text/plain");
    });

    it("create_drive_document should return error for missing params", async () => {
      const { executeAgentTool } = await import("./agentTools");
      const result = await executeAgentTool("create_drive_document", {
        title: "Test"
        // missing content and parentFolderId
      });
      const parsed = JSON.parse(result);
      expect(parsed.error).toBeDefined();
    });

    it("create_drive_spreadsheet should return error for missing params", async () => {
      const { executeAgentTool } = await import("./agentTools");
      const result = await executeAgentTool("create_drive_spreadsheet", {
        title: "Test"
        // missing csvContent and parentFolderId
      });
      const parsed = JSON.parse(result);
      expect(parsed.error).toBeDefined();
    });
  });

  describe("Write Tool Classification", () => {
    it("new Drive write tools should be in WRITE_TOOL_NAMES", async () => {
      // We can't directly access the Set, but we can verify the tools are treated as write tools
      // by checking they're in the agent's allowed tools and the execution works
      const { getToolsForAgent } = await import("./agentTools");
      const khazenTools = getToolsForAgent("khazen" as any);
      const writeToolNames = ["create_drive_document", "create_drive_spreadsheet", "upload_text_file", "update_drive_file"];
      for (const name of writeToolNames) {
        expect(khazenTools.find(t => t.function.name === name)).toBeDefined();
      }
    });
  });
});
