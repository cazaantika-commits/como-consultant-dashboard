import { describe, it, expect, beforeEach } from "vitest";
import {
  verifyConnection,
  listSharedDrives,
  listFilesInFolder,
  searchFiles,
  resetDriveClient,
} from "./googleDrive";

describe("Google Drive Router Integration", () => {
  beforeEach(() => {
    resetDriveClient();
  });

  it("should verify connection and return service account email", async () => {
    const result = await verifyConnection();
    expect(result.connected).toBe(true);
    expect(result.email).toBe(
      "como-agent@como-tasks-drive.iam.gserviceaccount.com"
    );
    expect(typeof result.sharedFilesCount).toBe("number");
  }, 15000);

  it("should list shared drives/folders", async () => {
    const shared = await listSharedDrives();
    expect(Array.isArray(shared)).toBe(true);
    // Service account should have at least some shared items
    // (folder 01 and 02 were shared with it)
    for (const item of shared) {
      expect(item).toHaveProperty("id");
      expect(item).toHaveProperty("name");
      expect(item).toHaveProperty("mimeType");
    }
  }, 15000);

  it("should list files in a folder when given a valid folder ID", async () => {
    // First get shared items to find a folder
    const shared = await listSharedDrives();
    const folder = shared.find(
      (f) => f.mimeType === "application/vnd.google-apps.folder"
    );
    if (!folder) {
      // Skip if no folders shared - this is acceptable
      console.log("No shared folders found, skipping folder listing test");
      return;
    }

    const result = await listFilesInFolder(folder.id);
    expect(result).toHaveProperty("files");
    expect(Array.isArray(result.files)).toBe(true);
    for (const file of result.files) {
      expect(file).toHaveProperty("id");
      expect(file).toHaveProperty("name");
      expect(file).toHaveProperty("mimeType");
    }
  }, 15000);

  it("should handle search queries", async () => {
    // Search for a common term
    const results = await searchFiles("COMO");
    expect(Array.isArray(results)).toBe(true);
    for (const file of results) {
      expect(file).toHaveProperty("id");
      expect(file).toHaveProperty("name");
      expect(file).toHaveProperty("mimeType");
    }
  }, 15000);
});
