/**
 * Scan Google Drive to find all project folders and their IDs
 * This helps understand the Drive structure and provide folder IDs to agents
 */
import { google } from "googleapis";

const base64Key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
if (!base64Key) {
  console.error("GOOGLE_SERVICE_ACCOUNT_KEY not set");
  process.exit(1);
}

const credentials = JSON.parse(Buffer.from(base64Key, "base64").toString("utf-8"));
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: credentials.client_email,
    private_key: credentials.private_key,
    project_id: credentials.project_id,
  },
  scopes: ["https://www.googleapis.com/auth/drive"],
});

const drive = google.drive({ version: "v3", auth });

async function listFolderContents(folderId, depth = 0) {
  const indent = "  ".repeat(depth);
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: "files(id, name, mimeType, size)",
    pageSize: 100,
    orderBy: "name",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  const files = res.data.files || [];
  for (const f of files) {
    const isFolder = f.mimeType === "application/vnd.google-apps.folder";
    const icon = isFolder ? "📁" : "📄";
    const size = f.size ? ` (${Math.round(parseInt(f.size) / 1024)} KB)` : "";
    console.log(`${indent}${icon} ${f.name} [ID: ${f.id}]${size}`);
    
    // Only go 2 levels deep for folders
    if (isFolder && depth < 2) {
      await listFolderContents(f.id, depth + 1);
    }
  }
}

async function main() {
  // First find the main COMO folder
  const shared = await drive.files.list({
    q: "sharedWithMe = true and trashed = false",
    fields: "files(id, name, mimeType)",
    pageSize: 100,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  console.log("=== Shared Folders ===");
  for (const f of shared.data.files || []) {
    console.log(`📁 ${f.name} [ID: ${f.id}]`);
  }

  // Find the main COMO folder
  const comoFolder = (shared.data.files || []).find(f => 
    f.name?.includes("COMO") || f.name?.includes("كومو")
  );

  if (comoFolder) {
    console.log(`\n=== Contents of "${comoFolder.name}" ===`);
    await listFolderContents(comoFolder.id, 0);
  } else {
    console.log("\nCOMO folder not found in shared. Listing all shared folders contents...");
    for (const f of shared.data.files || []) {
      if (f.mimeType === "application/vnd.google-apps.folder") {
        console.log(`\n=== Contents of "${f.name}" ===`);
        await listFolderContents(f.id, 1);
      }
    }
  }
}

main().catch(console.error);
