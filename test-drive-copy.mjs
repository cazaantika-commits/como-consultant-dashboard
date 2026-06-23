import { getDriveClient } from "./server/googleDrive.js";

const drive = getDriveClient();

// Search for project folders
const projectNames = ["الجداف", "مجان", "ند الشبا"];

console.log("🔍 Searching for project folders...\n");

for (const projectName of projectNames) {
  try {
    const res = await drive.files.list({
      q: `name contains '${projectName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: "files(id, name, parents, webViewLink)",
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    
    console.log(`📁 "${projectName}":`);
    if (res.data.files && res.data.files.length > 0) {
      res.data.files.forEach(f => {
        console.log(`   ID: ${f.id}`);
        console.log(`   Name: ${f.name}`);
        console.log(`   Link: ${f.webViewLink}`);
        console.log(`   Parents: ${f.parents?.join(", ") || "none"}\n`);
      });
    } else {
      console.log(`   ❌ No folders found\n`);
    }
  } catch (err) {
    console.error(`   ❌ Error searching for ${projectName}:`, err.message, "\n");
  }
}

// Test copy permissions with Ready folder file
console.log("\n🧪 Testing copy permissions...");
const readyFolderId = "1ZXzOEs-ITzUF6-r-Ii2cd7iRxBM1gGC7";

try {
  // List files in Ready
  const filesRes = await drive.files.list({
    q: `'${readyFolderId}' in parents and trashed=false`,
    fields: "files(id, name, mimeType)",
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  
  if (filesRes.data.files && filesRes.data.files.length > 0) {
    const testFile = filesRes.data.files[0];
    console.log(`\n📄 Test file: ${testFile.name} (${testFile.id})`);
    
    // Try to copy to Ready folder itself (should work if we have write permission)
    try {
      const copyRes = await drive.files.copy({
        fileId: testFile.id,
        requestBody: {
          name: `TEST_COPY_${Date.now()}_${testFile.name}`,
          parents: [readyFolderId],
        },
        fields: "id, name, webViewLink",
        supportsAllDrives: true,
      });
      
      console.log(`✅ Copy successful!`);
      console.log(`   New file: ${copyRes.data.name}`);
      console.log(`   ID: ${copyRes.data.id}`);
      
      // Clean up - delete the test copy
      await drive.files.delete({
        fileId: copyRes.data.id,
        supportsAllDrives: true,
      });
      console.log(`   🗑️ Test copy deleted`);
    } catch (copyErr) {
      console.error(`❌ Copy failed:`, copyErr.message);
      if (copyErr.response) {
        console.error(`   Status: ${copyErr.response.status}`);
        console.error(`   Data:`, JSON.stringify(copyErr.response.data, null, 2));
      }
    }
  } else {
    console.log(`❌ No files in Ready folder to test with`);
  }
} catch (err) {
  console.error(`❌ Error testing copy:`, err.message);
}
