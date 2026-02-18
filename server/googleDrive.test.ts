import { describe, it, expect, beforeEach } from "vitest";
import { verifyConnection, resetDriveClient } from "./googleDrive";

describe("Google Drive Integration", () => {
  beforeEach(() => {
    resetDriveClient();
  });

  it("should verify connection to Google Drive with service account", async () => {
    const result = await verifyConnection();
    expect(result.connected).toBe(true);
    expect(result.email).toBe(
      "como-agent@como-tasks-drive.iam.gserviceaccount.com"
    );
    expect(result.sharedFilesCount).toBeGreaterThanOrEqual(0);
  }, 15000);
});
