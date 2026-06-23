import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Tests for the large file reading system and batch copy tool.
 * These tests verify:
 * 1. PDF size limit increased to 50MB
 * 2. Smart truncation with beginning + end content
 * 3. Metadata header in PDF output
 * 4. batch_copy_drive_file tool definition and handler
 */

// Mock the googleapis module
vi.mock("googleapis", () => {
  const mockDrive = {
    files: {
      get: vi.fn(),
      list: vi.fn(),
      copy: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      export: vi.fn(),
    },
  };
  return {
    google: {
      auth: {
        GoogleAuth: vi.fn().mockImplementation(() => ({})),
      },
      drive: vi.fn(() => mockDrive),
    },
    drive_v3: {},
  };
});

// Mock pdf-parse v2 (class-based API with getText method)
const mockGetText = vi.fn();
vi.mock("pdf-parse", () => ({
  PDFParse: vi.fn().mockImplementation(() => ({
    getText: mockGetText,
  })),
}));

// Set env before importing modules
process.env.GOOGLE_SERVICE_ACCOUNT_KEY = Buffer.from(
  JSON.stringify({
    client_email: "test@test.iam.gserviceaccount.com",
    private_key: "fake-key",
    project_id: "test-project",
  })
).toString("base64");

describe("Large File Reading System", () => {
  describe("PDF Size Limits", () => {
    it("should accept PDF files up to 50MB", async () => {
      const { readFileContent, resetDriveClient } = await import("./googleDrive");
      const { google } = await import("googleapis");

      resetDriveClient();
      const drive = google.drive({ version: "v3" }) as any;

      // Mock file metadata - 25MB PDF (under new 50MB limit)
      drive.files.get.mockImplementation((params: any) => {
        if (params.alt === "media") {
          return Promise.resolve({ data: new ArrayBuffer(100) });
        }
        return Promise.resolve({
          data: {
            id: "test-file-id",
            name: "large-proposal.pdf",
            mimeType: "application/pdf",
            size: String(25 * 1024 * 1024), // 25MB
          },
        });
      });

      // Mock pdf-parse v2 getText response
      mockGetText.mockResolvedValue({
        text: "This is a test PDF content for a large engineering proposal.",
        pages: Array.from({ length: 50 }, (_, i) => ({ text: `Page ${i + 1}`, num: i + 1 })),
      });

      const result = await readFileContent("test-file-id");

      expect(result.error).toBeUndefined();
      expect(result.content).toContain("large-proposal.pdf");
      expect(result.content).toContain("50"); // pages
    });

    it("should reject PDF files over 50MB", async () => {
      const { readFileContent, resetDriveClient } = await import("./googleDrive");
      const { google } = await import("googleapis");

      resetDriveClient();
      const drive = google.drive({ version: "v3" }) as any;

      // Mock file metadata - 60MB PDF (over 50MB limit)
      drive.files.get.mockResolvedValue({
        data: {
          id: "huge-file-id",
          name: "huge-file.pdf",
          mimeType: "application/pdf",
          size: String(60 * 1024 * 1024), // 60MB
        },
      });

      const result = await readFileContent("huge-file-id");

      expect(result.error).toBeDefined();
      expect(result.error).toContain("50 MB");
    });
  });

  describe("Smart Truncation", () => {
    it("should include both beginning and end of large PDFs", async () => {
      const { readFileContent, resetDriveClient } = await import("./googleDrive");
      const { google } = await import("googleapis");

      resetDriveClient();
      const drive = google.drive({ version: "v3" }) as any;

      drive.files.get.mockImplementation((params: any) => {
        if (params.alt === "media") {
          return Promise.resolve({ data: new ArrayBuffer(100) });
        }
        return Promise.resolve({
          data: {
            id: "test-file-id",
            name: "long-proposal.pdf",
            mimeType: "application/pdf",
            size: String(5 * 1024 * 1024), // 5MB
          },
        });
      });

      // Create content that exceeds MAX_CONTENT_CHARS (50000)
      const beginText = "BEGIN_MARKER " + "A".repeat(40000);
      const middleText = "M".repeat(30000);
      const endText = "Z".repeat(20000) + " END_MARKER";
      const fullText = beginText + middleText + endText;

      mockGetText.mockResolvedValue({
        text: fullText,
        pages: Array.from({ length: 100 }, (_, i) => ({ text: `Page ${i + 1}`, num: i + 1 })),
      });

      const result = await readFileContent("test-file-id");

      expect(result.truncated).toBe(true);
      // Should contain beginning
      expect(result.content).toContain("BEGIN_MARKER");
      // Should contain end
      expect(result.content).toContain("END_MARKER");
      // Should have truncation notice
      expect(result.content).toContain("تم اقتطاع الجزء الأوسط");
    });

    it("should add metadata header to PDF content", async () => {
      const { readFileContent, resetDriveClient } = await import("./googleDrive");
      const { google } = await import("googleapis");

      resetDriveClient();
      const drive = google.drive({ version: "v3" }) as any;

      drive.files.get.mockImplementation((params: any) => {
        if (params.alt === "media") {
          return Promise.resolve({ data: new ArrayBuffer(100) });
        }
        return Promise.resolve({
          data: {
            id: "test-file-id",
            name: "proposal.pdf",
            mimeType: "application/pdf",
            size: String(2 * 1024 * 1024), // 2MB
          },
        });
      });

      mockGetText.mockResolvedValue({
        text: "Short content",
        pages: Array.from({ length: 5 }, (_, i) => ({ text: `Page ${i + 1}`, num: i + 1 })),
      });

      const result = await readFileContent("test-file-id");

      expect(result.content).toContain("proposal.pdf");
      expect(result.content).toContain("الصفحات: 5");
      expect(result.content).toContain("الحجم: 2 MB");
    });
  });

  describe("Batch Copy Tool Definition", () => {
    it("should have batch_copy_drive_file in AGENT_TOOLS", async () => {
      const { getToolsForAgent } = await import("./agentTools");

      // Khazen should have the batch copy tool
      const khazenTools = getToolsForAgent("khazen");
      const batchCopyTool = khazenTools.find(
        (t) => t.function.name === "batch_copy_drive_file"
      );

      expect(batchCopyTool).toBeDefined();
      expect(batchCopyTool!.function.parameters.required).toContain("fileId");
      expect(batchCopyTool!.function.parameters.required).toContain("destinations");
    });

    it("should have batch_copy_drive_file only for khazen", async () => {
      const { getToolsForAgent } = await import("./agentTools");

      // Other agents should NOT have batch copy
      const farouqTools = getToolsForAgent("farouq");
      const batchInFarouq = farouqTools.find(
        (t) => t.function.name === "batch_copy_drive_file"
      );
      expect(batchInFarouq).toBeUndefined();

      // Khazen should have it
      const khazenTools = getToolsForAgent("khazen");
      const batchInKhazen = khazenTools.find(
        (t) => t.function.name === "batch_copy_drive_file"
      );
      expect(batchInKhazen).toBeDefined();
    });
  });

  describe("Read Drive File Content - Enhanced", () => {
    it("should have read_drive_file_content available for all relevant agents", async () => {
      const { getToolsForAgent } = await import("./agentTools");

      const agents = ["khazen", "farouq", "khaled", "alina", "joelle", "salwa"] as const;
      for (const agent of agents) {
        const tools = getToolsForAgent(agent);
        const readTool = tools.find(
          (t) => t.function.name === "read_drive_file_content"
        );
        expect(readTool).toBeDefined();
      }
    });

    it("should describe PDF support up to 50MB in tool description", async () => {
      const { getToolsForAgent } = await import("./agentTools");

      const khazenTools = getToolsForAgent("khazen");
      const readTool = khazenTools.find(
        (t) => t.function.name === "read_drive_file_content"
      );

      expect(readTool!.function.description).toContain("50 MB");
    });
  });

  describe("Salwa Agent Conversations Tool", () => {
    it("should have view_agent_conversations available for Salwa", async () => {
      const { getToolsForAgent } = await import("./agentTools");
      const salwaTools = getToolsForAgent("salwa");
      const viewTool = salwaTools.find(
        (t) => t.function.name === "view_agent_conversations"
      );
      expect(viewTool).toBeDefined();
      expect(viewTool!.function.parameters.required).toContain("targetAgent");
    });

    it("should NOT have view_agent_conversations for other agents", async () => {
      const { getToolsForAgent } = await import("./agentTools");
      const otherAgents = ["farouq", "khazen", "buraq", "khaled", "alina", "baz", "joelle"] as const;
      for (const agent of otherAgents) {
        const tools = getToolsForAgent(agent);
        const viewTool = tools.find(
          (t) => t.function.name === "view_agent_conversations"
        );
        expect(viewTool).toBeUndefined();
      }
    });
  });
});
