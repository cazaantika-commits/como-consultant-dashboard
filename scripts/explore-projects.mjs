import { listFilesInFolder } from "../server/googleDrive.ts";

// Projects folder ID
const PROJECTS_FOLDER = "1rSaBtCmSsMYAJldJgKHmYQQyI8D1XYYT";

async function exploreRecursive(folderId, folderName, depth = 0) {
  const indent = "  ".repeat(depth);
  const contents = await listFilesInFolder(folderId);
  
  for (const item of contents.files) {
    const isFolder = item.mimeType === "application/vnd.google-apps.folder";
    console.log(`${indent}${isFolder ? "📁" : "📄"} ${item.name} | id:${item.id} | ${item.mimeType}`);
    
    if (isFolder) {
      await exploreRecursive(item.id, item.name, depth + 1);
    }
  }
}

async function main() {
  console.log("=== Exploring 01. Projects ===\n");
  
  // First list the 5 project folders
  const projects = await listFilesInFolder(PROJECTS_FOLDER);
  console.log(`Found ${projects.files.length} project folders:\n`);
  
  for (const proj of projects.files) {
    console.log(`\n========== ${proj.name} ==========`);
    await exploreRecursive(proj.id, proj.name, 1);
  }

  // Also explore the main folder for any remaining loose files
  console.log("\n\n=== Exploring Main Folder (loose items) ===\n");
  const MAIN_FOLDER_ID = "1PLhYCKU08CMKJWfPK44IjNAw_V3oOawD";
  const mainContents = await listFilesInFolder(MAIN_FOLDER_ID);
  for (const item of mainContents.files) {
    const isFolder = item.mimeType === "application/vnd.google-apps.folder";
    console.log(`${isFolder ? "📁" : "📄"} ${item.name} | id:${item.id}`);
  }
}

main().catch(console.error);
