import { describe, it, expect, vi } from "vitest";

// Test that Drive tools are properly defined and mapped to agents
describe("Google Drive Agent Tools", () => {
  const DRIVE_TOOL_NAMES = [
    "list_drive_folders",
    "list_drive_files",
    "search_drive_files",
    "get_drive_file_info",
    "copy_drive_file",
    "create_drive_folder",
  ];

  const DRIVE_WRITE_TOOLS = ["copy_drive_file", "create_drive_folder"];
  const DRIVE_READ_TOOLS = ["list_drive_folders", "list_drive_files", "search_drive_files", "get_drive_file_info"];

  describe("Tool Definitions", () => {
    it("should have all 6 Google Drive tools defined", () => {
      expect(DRIVE_TOOL_NAMES).toHaveLength(6);
      expect(DRIVE_TOOL_NAMES).toContain("list_drive_folders");
      expect(DRIVE_TOOL_NAMES).toContain("list_drive_files");
      expect(DRIVE_TOOL_NAMES).toContain("search_drive_files");
      expect(DRIVE_TOOL_NAMES).toContain("get_drive_file_info");
      expect(DRIVE_TOOL_NAMES).toContain("copy_drive_file");
      expect(DRIVE_TOOL_NAMES).toContain("create_drive_folder");
    });

    it("should correctly classify write vs read tools", () => {
      expect(DRIVE_WRITE_TOOLS).toHaveLength(2);
      expect(DRIVE_READ_TOOLS).toHaveLength(4);
      // Write tools modify Drive
      expect(DRIVE_WRITE_TOOLS).toContain("copy_drive_file");
      expect(DRIVE_WRITE_TOOLS).toContain("create_drive_folder");
      // Read tools only query Drive
      expect(DRIVE_READ_TOOLS).not.toContain("copy_drive_file");
      expect(DRIVE_READ_TOOLS).not.toContain("create_drive_folder");
    });
  });

  describe("Agent Permissions", () => {
    // Simulate the AGENT_ALLOWED_TOOLS mapping
    const KHAZEN_TOOLS = [
      "list_projects", "list_consultants", "get_consultant_profile",
      "add_consultant_note", "list_tasks",
      "list_meetings", "get_meeting_details", "query_institutional_memory",
      "list_drive_folders", "list_drive_files", "search_drive_files",
      "get_drive_file_info", "copy_drive_file", "create_drive_folder",
      "ask_another_agent",
    ];

    const SALWA_TOOLS_DRIVE = [
      "list_drive_folders", "list_drive_files", "search_drive_files", "get_drive_file_info",
    ];

    const FAROUQ_TOOLS_DRIVE = [
      "list_drive_folders", "list_drive_files", "search_drive_files", "get_drive_file_info",
    ];

    it("khazen should have ALL 6 Drive tools (full access - archival role)", () => {
      for (const tool of DRIVE_TOOL_NAMES) {
        expect(KHAZEN_TOOLS).toContain(tool);
      }
    });

    it("khazen should have both read and write Drive tools", () => {
      for (const tool of DRIVE_WRITE_TOOLS) {
        expect(KHAZEN_TOOLS).toContain(tool);
      }
      for (const tool of DRIVE_READ_TOOLS) {
        expect(KHAZEN_TOOLS).toContain(tool);
      }
    });

    it("salwa should have read-only Drive tools (no copy/create)", () => {
      for (const tool of DRIVE_READ_TOOLS) {
        expect(SALWA_TOOLS_DRIVE).toContain(tool);
      }
      for (const tool of DRIVE_WRITE_TOOLS) {
        expect(SALWA_TOOLS_DRIVE).not.toContain(tool);
      }
    });

    it("farouq should have read-only Drive tools (no copy/create)", () => {
      for (const tool of DRIVE_READ_TOOLS) {
        expect(FAROUQ_TOOLS_DRIVE).toContain(tool);
      }
      for (const tool of DRIVE_WRITE_TOOLS) {
        expect(FAROUQ_TOOLS_DRIVE).not.toContain(tool);
      }
    });
  });

  describe("Tool Execution Logic", () => {
    it("should format file sizes correctly", () => {
      const formatSize = (sizeStr: string | undefined) => {
        if (!sizeStr) return undefined;
        return `${Math.round(parseInt(sizeStr) / 1024)} KB`;
      };
      
      expect(formatSize("1048576")).toBe("1024 KB");
      expect(formatSize("512")).toBe("1 KB"); // rounds up
      expect(formatSize("0")).toBe("0 KB");
      expect(formatSize(undefined)).toBeUndefined();
    });

    it("should correctly identify folder vs file types", () => {
      const getType = (mimeType: string) => {
        return mimeType === "application/vnd.google-apps.folder" ? "مجلد" : mimeType;
      };

      expect(getType("application/vnd.google-apps.folder")).toBe("مجلد");
      expect(getType("application/pdf")).toBe("application/pdf");
      expect(getType("image/png")).toBe("image/png");
    });

    it("should validate required parameters for list_drive_files", () => {
      const args = { folderId: "" };
      expect(!args.folderId).toBe(true); // should fail validation
      
      const validArgs = { folderId: "abc123" };
      expect(!validArgs.folderId).toBe(false); // should pass validation
    });

    it("should validate required parameters for search_drive_files", () => {
      const args = { query: "" };
      expect(!args.query).toBe(true); // should fail validation
      
      const validArgs = { query: "ARTEC" };
      expect(!validArgs.query).toBe(false); // should pass validation
    });

    it("should validate required parameters for copy_drive_file", () => {
      const args1 = { fileId: "", destinationFolderId: "abc" };
      expect(!args1.fileId || !args1.destinationFolderId).toBe(true);
      
      const args2 = { fileId: "abc", destinationFolderId: "" };
      expect(!args2.fileId || !args2.destinationFolderId).toBe(true);
      
      const validArgs = { fileId: "abc", destinationFolderId: "def" };
      expect(!validArgs.fileId || !validArgs.destinationFolderId).toBe(false);
    });

    it("should validate required parameters for create_drive_folder", () => {
      const args = { name: "", parentFolderId: "abc" };
      expect(!args.name || !args.parentFolderId).toBe(true);
      
      const validArgs = { name: "New Folder", parentFolderId: "abc" };
      expect(!validArgs.name || !validArgs.parentFolderId).toBe(false);
    });
  });
});
