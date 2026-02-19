import { getDriveClient } from "../server/googleDrive.ts";

async function main() {
  const drive = getDriveClient();
  const folderId = "1PLhYCKU08CMKJWfPK44IjNAw_V3oOawD";
  
  console.log("Listing top-level contents of main folder...\n");
  
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: "files(id, name, mimeType, parents)",
    pageSize: 100,
    orderBy: "folder,name",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  
  const files = res.data.files || [];
  console.log(`Found ${files.length} items:\n`);
  
  const folders = files.filter(f => f.mimeType === "application/vnd.google-apps.folder");
  const docs = files.filter(f => f.mimeType !== "application/vnd.google-apps.folder");
  
  console.log("=== FOLDERS ===");
  for (const f of folders) {
    console.log(`  [FOLDER] ${f.name} (${f.id})`);
    // List contents of each subfolder
    const subRes = await drive.files.list({
      q: `'${f.id}' in parents and trashed = false`,
      fields: "files(id, name, mimeType)",
      pageSize: 100,
      orderBy: "name",
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    const subFiles = subRes.data.files || [];
    for (const sf of subFiles) {
      const type = sf.mimeType === "application/vnd.google-apps.folder" ? "[FOLDER]" : "[FILE]";
      console.log(`    ${type} ${sf.name} (${sf.id})`);
    }
  }
  
  console.log("\n=== FILES (root level) ===");
  for (const f of docs) {
    console.log(`  ${f.name} (${f.id})`);
  }
}

main().catch(console.error);
