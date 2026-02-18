import { google } from "googleapis";
import { readFileSync } from "fs";

// Load credentials from env or file
const base64Key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
let credentials;
if (base64Key) {
  credentials = JSON.parse(Buffer.from(base64Key, "base64").toString("utf-8"));
} else {
  credentials = JSON.parse(readFileSync("/home/ubuntu/upload/como-tasks-drive-29f09ca29c2d.json", "utf-8"));
}

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: credentials.client_email,
    private_key: credentials.private_key,
    project_id: credentials.project_id,
  },
  scopes: ["https://www.googleapis.com/auth/drive"],
});

const drive = google.drive({ version: "v3", auth });

async function listShared() {
  console.log("=== المجلدات والملفات المشتركة ===\n");
  const res = await drive.files.list({
    q: "sharedWithMe and trashed = false",
    fields: "files(id, name, mimeType, parents)",
    pageSize: 200,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  
  const files = res.data.files || [];
  console.log(`عدد العناصر المشتركة: ${files.length}\n`);
  
  for (const f of files) {
    const type = f.mimeType === "application/vnd.google-apps.folder" ? "📁 مجلد" : "📄 ملف";
    console.log(`${type}: ${f.name}`);
    console.log(`   ID: ${f.id}`);
    console.log(`   MIME: ${f.mimeType}`);
    console.log("");
  }
  
  return files;
}

async function listFolderContents(folderId, folderName, depth = 0) {
  const indent = "  ".repeat(depth);
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: "files(id, name, mimeType, size, modifiedTime)",
    pageSize: 200,
    orderBy: "folder,name",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  
  const files = res.data.files || [];
  
  for (const f of files) {
    const isFolder = f.mimeType === "application/vnd.google-apps.folder";
    const icon = isFolder ? "📁" : "📄";
    const size = f.size ? ` (${(parseInt(f.size) / 1024).toFixed(1)} KB)` : "";
    console.log(`${indent}${icon} ${f.name}${size}`);
    console.log(`${indent}   ID: ${f.id} | MIME: ${f.mimeType}`);
    
    if (isFolder) {
      await listFolderContents(f.id, f.name, depth + 1);
    }
  }
  
  return files;
}

async function main() {
  const shared = await listShared();
  
  // Find folder 01 and 02
  const folder01 = shared.find(f => f.name.includes("01") || f.name.includes("COMO") && f.name.includes("Project Management"));
  const folder02 = shared.find(f => f.name.includes("02") || f.name.includes("REAL_ESTATE"));
  
  if (folder01) {
    console.log("\n=== محتويات مجلد 01 ===\n");
    console.log(`📁 ${folder01.name} (${folder01.id})\n`);
    await listFolderContents(folder01.id, folder01.name, 1);
  } else {
    console.log("\n⚠️ لم يتم العثور على مجلد 01");
    // Try listing all folders
    for (const f of shared) {
      if (f.mimeType === "application/vnd.google-apps.folder") {
        console.log(`\n=== محتويات: ${f.name} ===\n`);
        await listFolderContents(f.id, f.name, 1);
      }
    }
  }
  
  if (folder02) {
    console.log("\n=== محتويات مجلد 02 ===\n");
    console.log(`📁 ${folder02.name} (${folder02.id})\n`);
    await listFolderContents(folder02.id, folder02.name, 1);
  } else {
    console.log("\n⚠️ لم يتم العثور على مجلد 02");
  }
}

main().catch(console.error);
