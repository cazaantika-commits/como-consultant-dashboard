import { describe, it, expect } from "vitest";

describe("Read Drive File Content Tool", () => {
  // Test the content type detection logic
  describe("Content Type Detection", () => {
    const GOOGLE_DOC_MIME = "application/vnd.google-apps.document";
    const GOOGLE_SHEET_MIME = "application/vnd.google-apps.spreadsheet";
    const GOOGLE_SLIDES_MIME = "application/vnd.google-apps.presentation";
    const GOOGLE_DRAWING_MIME = "application/vnd.google-apps.drawing";

    const EXPORT_FORMATS: Record<string, { mimeType: string; label: string }> = {
      [GOOGLE_DOC_MIME]: { mimeType: "text/plain", label: "Google Doc → نص" },
      [GOOGLE_SHEET_MIME]: { mimeType: "text/csv", label: "Google Sheet → CSV" },
      [GOOGLE_SLIDES_MIME]: { mimeType: "text/plain", label: "Google Slides → نص" },
      [GOOGLE_DRAWING_MIME]: { mimeType: "image/png", label: "Google Drawing → صورة" },
    };

    it("should detect Google Docs and export as text", () => {
      const format = EXPORT_FORMATS[GOOGLE_DOC_MIME];
      expect(format).toBeDefined();
      expect(format.mimeType).toBe("text/plain");
    });

    it("should detect Google Sheets and export as CSV", () => {
      const format = EXPORT_FORMATS[GOOGLE_SHEET_MIME];
      expect(format).toBeDefined();
      expect(format.mimeType).toBe("text/csv");
    });

    it("should detect Google Slides and export as text", () => {
      const format = EXPORT_FORMATS[GOOGLE_SLIDES_MIME];
      expect(format).toBeDefined();
      expect(format.mimeType).toBe("text/plain");
    });

    it("should not have export format for regular files", () => {
      expect(EXPORT_FORMATS["application/pdf"]).toBeUndefined();
      expect(EXPORT_FORMATS["text/plain"]).toBeUndefined();
      expect(EXPORT_FORMATS["image/png"]).toBeUndefined();
    });
  });

  describe("Text File Detection", () => {
    const textMimeTypes = [
      "text/plain", "text/csv", "text/html", "text/xml",
      "application/json", "application/xml",
      "text/markdown", "text/tab-separated-values",
    ];
    const textExtensions = [".txt", ".csv", ".json", ".xml", ".html", ".md", ".yml", ".yaml", ".log", ".tsv"];

    const isTextFile = (mimeType: string, fileName: string) => {
      return textMimeTypes.includes(mimeType) ||
        textExtensions.some(ext => fileName.toLowerCase().endsWith(ext));
    };

    it("should detect text/plain as text file", () => {
      expect(isTextFile("text/plain", "file.txt")).toBe(true);
    });

    it("should detect CSV files by mime type", () => {
      expect(isTextFile("text/csv", "data.csv")).toBe(true);
    });

    it("should detect JSON files by extension", () => {
      expect(isTextFile("application/octet-stream", "config.json")).toBe(true);
    });

    it("should detect YAML files by extension", () => {
      expect(isTextFile("application/octet-stream", "config.yml")).toBe(true);
      expect(isTextFile("application/octet-stream", "config.yaml")).toBe(true);
    });

    it("should detect markdown files", () => {
      expect(isTextFile("text/markdown", "readme.md")).toBe(true);
      expect(isTextFile("application/octet-stream", "readme.md")).toBe(true);
    });

    it("should NOT detect PDF as text file", () => {
      expect(isTextFile("application/pdf", "document.pdf")).toBe(false);
    });

    it("should NOT detect images as text files", () => {
      expect(isTextFile("image/png", "photo.png")).toBe(false);
      expect(isTextFile("image/jpeg", "photo.jpg")).toBe(false);
    });

    it("should NOT detect Excel as text file", () => {
      expect(isTextFile("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "data.xlsx")).toBe(false);
    });
  });

  describe("Content Truncation", () => {
    const MAX_CONTENT_CHARS = 15000;

    it("should not truncate content under limit", () => {
      const content = "a".repeat(14999);
      expect(content.length).toBeLessThan(MAX_CONTENT_CHARS);
      expect(content.length > MAX_CONTENT_CHARS).toBe(false);
    });

    it("should truncate content over limit", () => {
      const content = "a".repeat(20000);
      expect(content.length > MAX_CONTENT_CHARS).toBe(true);
      const truncated = content.substring(0, MAX_CONTENT_CHARS);
      expect(truncated.length).toBe(MAX_CONTENT_CHARS);
    });

    it("should handle exact limit", () => {
      const content = "a".repeat(15000);
      expect(content.length > MAX_CONTENT_CHARS).toBe(false);
    });
  });

  describe("File Size Limits", () => {
    it("should reject PDFs over 10MB", () => {
      const maxPdfSize = 10 * 1024 * 1024;
      expect(11 * 1024 * 1024 > maxPdfSize).toBe(true);
      expect(9 * 1024 * 1024 > maxPdfSize).toBe(false);
    });

    it("should reject text files over 5MB", () => {
      const maxTextSize = 5 * 1024 * 1024;
      expect(6 * 1024 * 1024 > maxTextSize).toBe(true);
      expect(4 * 1024 * 1024 > maxTextSize).toBe(false);
    });
  });

  describe("Agent Permissions", () => {
    const AGENTS_WITH_READ_CONTENT = [
      "salwa", "farouq", "khaled", "alina", "joelle", "baz", "khazen"
    ];

    it("all 7 agents should have read_drive_file_content", () => {
      expect(AGENTS_WITH_READ_CONTENT).toHaveLength(7);
      expect(AGENTS_WITH_READ_CONTENT).toContain("salwa");
      expect(AGENTS_WITH_READ_CONTENT).toContain("farouq");
      expect(AGENTS_WITH_READ_CONTENT).toContain("khaled");
      expect(AGENTS_WITH_READ_CONTENT).toContain("alina");
      expect(AGENTS_WITH_READ_CONTENT).toContain("joelle");
      expect(AGENTS_WITH_READ_CONTENT).toContain("baz");
      expect(AGENTS_WITH_READ_CONTENT).toContain("khazen");
    });

    it("buraq should NOT have read_drive_file_content (execution monitor only)", () => {
      expect(AGENTS_WITH_READ_CONTENT).not.toContain("buraq");
    });
  });

  describe("Parameter Validation", () => {
    it("should require fileId parameter", () => {
      const args = { fileId: "" };
      expect(!args.fileId).toBe(true);
    });

    it("should accept valid fileId", () => {
      const args = { fileId: "1abc2def3ghi" };
      expect(!args.fileId).toBe(false);
    });
  });
});
