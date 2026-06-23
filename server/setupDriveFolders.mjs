/**
 * Setup Google Drive folder structure according to Archiving Constitution
 * 
 * This script:
 * 1. Creates 00_Inbox (with Emails, Agents, Ready subfolders)
 * 2. Creates 00_Company-Profiles (with consultant subfolders)
 * 3. Lists existing files for renaming
 */

import { google } from "googleapis";
import { readFileSync } from "fs";

// Get credentials from env
function getCredentials() {
  const base64Key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!base64Key) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY not set");
  }
  const jsonStr = Buffer.from(base64Key, "base64").toString("utf-8");
  return JSON.parse(jsonStr);
}

function getDriveClient() {
  const credentials = getCredentials();
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: credentials.client_email,
      private_key: credentials.private_key,
      project_id: credentials.project_id,
    },
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
  return google.drive({ version: "v3", auth });
}

const drive = getDriveClient();
const FOLDER_MIME = "application/vnd.google-apps.folder";

// Helper: List folders shared with service account
async function listSharedFolders() {
  const res = await drive.files.list({
    q: "sharedWithMe = true and trashed = false",
    fields: "files(id, name, mimeType)",
    pageSize: 100,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  return res.data.files || [];
}

// Helper: List items in a folder
async function listInFolder(folderId) {
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: "files(id, name, mimeType, parents)",
    pageSize: 200,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  return res.data.files || [];
}

// Helper: Create folder
async function createFolder(name, parentId) {
  const res = await drive.files.create({
    requestBody: {
      name,
      mimeType: FOLDER_MIME,
      parents: [parentId],
    },
    fields: "id, name, mimeType",
    supportsAllDrives: true,
  });
  console.log(`  ✅ Created folder: ${name} (${res.data.id})`);
  return res.data;
}

// Helper: Rename file
async function renameFile(fileId, newName) {
  const res = await drive.files.update({
    fileId,
    requestBody: { name: newName },
    fields: "id, name",
    supportsAllDrives: true,
  });
  console.log(`  ✅ Renamed to: ${newName}`);
  return res.data;
}

// Helper: Move file
async function moveFile(fileId, newParentId, currentParentId) {
  const res = await drive.files.update({
    fileId,
    addParents: newParentId,
    removeParents: currentParentId,
    fields: "id, name, parents",
    supportsAllDrives: true,
  });
  console.log(`  ✅ Moved: ${res.data.name}`);
  return res.data;
}

// Check if folder exists in parent
async function findFolder(name, parentId) {
  const items = await listInFolder(parentId);
  return items.find(f => f.name === name && f.mimeType === FOLDER_MIME);
}

// ═══════════════════════════════════════════
// MAIN EXECUTION
// ═══════════════════════════════════════════

async function main() {
  console.log("🏗️  Setting up Google Drive folder structure...\n");
  
  // 1. Find the main COMO folder
  const sharedFolders = await listSharedFolders();
  console.log("📂 Shared folders:");
  for (const f of sharedFolders) {
    console.log(`  - ${f.name} (${f.id})`);
  }
  
  const comoFolder = sharedFolders.find(f => f.name.includes("COMO") || f.name.includes("Projects Management"));
  if (!comoFolder) {
    console.error("❌ Could not find COMO Projects Management folder!");
    console.log("Available folders:", sharedFolders.map(f => f.name));
    return;
  }
  
  console.log(`\n📁 Main folder: ${comoFolder.name} (${comoFolder.id})`);
  
  // List contents of main folder
  const mainContents = await listInFolder(comoFolder.id);
  console.log("\n📂 Main folder contents:");
  for (const item of mainContents) {
    console.log(`  ${item.mimeType === FOLDER_MIME ? "📁" : "📄"} ${item.name} (${item.id})`);
  }
  
  // 2. Create 00_Inbox if not exists
  console.log("\n═══ Creating 00_Inbox structure ═══");
  let inboxFolder = mainContents.find(f => f.name === "00_Inbox" && f.mimeType === FOLDER_MIME);
  if (!inboxFolder) {
    inboxFolder = await createFolder("00_Inbox", comoFolder.id);
  } else {
    console.log(`  ℹ️  00_Inbox already exists (${inboxFolder.id})`);
  }
  
  // Create Inbox subfolders
  const inboxContents = await listInFolder(inboxFolder.id);
  for (const subName of ["Emails", "Agents", "Ready"]) {
    const existing = inboxContents.find(f => f.name === subName && f.mimeType === FOLDER_MIME);
    if (!existing) {
      await createFolder(subName, inboxFolder.id);
    } else {
      console.log(`  ℹ️  ${subName} already exists (${existing.id})`);
    }
  }
  
  // 3. Create 00_Company-Profiles if not exists
  console.log("\n═══ Creating 00_Company-Profiles structure ═══");
  let profilesFolder = mainContents.find(f => f.name === "00_Company-Profiles" && f.mimeType === FOLDER_MIME);
  if (!profilesFolder) {
    profilesFolder = await createFolder("00_Company-Profiles", comoFolder.id);
  } else {
    console.log(`  ℹ️  00_Company-Profiles already exists (${profilesFolder.id})`);
  }
  
  // Create consultant subfolders
  const consultantCodes = ["Lac", "A-B", "Osu", "Real", "Dat", "Saf", "Col", "Tarmak", "Trans"];
  const profileContents = await listInFolder(profilesFolder.id);
  for (const code of consultantCodes) {
    const existing = profileContents.find(f => f.name === code && f.mimeType === FOLDER_MIME);
    if (!existing) {
      await createFolder(code, profilesFolder.id);
    } else {
      console.log(`  ℹ️  ${code} already exists (${existing.id})`);
    }
  }
  
  // 4. List project folders and their contents for renaming
  console.log("\n═══ Scanning project folders for files to rename ═══");
  
  const projectFolders = mainContents.filter(f => 
    f.mimeType === FOLDER_MIME && 
    !f.name.startsWith("00_") && 
    f.name !== "00_Inbox" && 
    f.name !== "00_Company-Profiles"
  );
  
  for (const projFolder of projectFolders) {
    console.log(`\n📁 Project: ${projFolder.name} (${projFolder.id})`);
    const projContents = await listInFolder(projFolder.id);
    
    for (const item of projContents) {
      if (item.mimeType === FOLDER_MIME) {
        console.log(`  📁 ${item.name} (${item.id})`);
        const subContents = await listInFolder(item.id);
        for (const subItem of subContents) {
          if (subItem.mimeType === FOLDER_MIME) {
            console.log(`    📁 ${subItem.name} (${subItem.id})`);
            const subSubContents = await listInFolder(subItem.id);
            for (const ssi of subSubContents) {
              console.log(`      ${ssi.mimeType === FOLDER_MIME ? "📁" : "📄"} ${ssi.name} (${ssi.id})`);
            }
          } else {
            console.log(`    📄 ${subItem.name} (${subItem.id})`);
          }
        }
      } else {
        console.log(`  📄 ${item.name} (${item.id})`);
      }
    }
  }
  
  console.log("\n✅ Folder structure scan complete!");
  console.log("\nFolder IDs for reference:");
  console.log(`  COMO Main: ${comoFolder.id}`);
  console.log(`  00_Inbox: ${inboxFolder.id}`);
  console.log(`  00_Company-Profiles: ${profilesFolder.id}`);
}

main().catch(err => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
