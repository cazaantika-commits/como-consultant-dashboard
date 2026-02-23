import { copyFile } from "./server/googleDrive.js";

console.log("🧪 Testing copyFile fix with download+upload approach\n");

const readyFolderId = "1ZXzOEs-ITzUF6-r-Ii2cd7iRxBM1gGC7";
const testFileId = "1ezoHSklA0Br6J1uWXLBossZYLSPzh1zk"; // XYZ file in Ready
const testFileName = `TEST_COPY_${Date.now()}.pdf`;

try {
  console.log(`📄 Copying file ${testFileId}`);
  console.log(`📁 To folder: ${readyFolderId}`);
  console.log(`📝 New name: ${testFileName}\n`);
  
  const result = await copyFile(testFileId, readyFolderId, testFileName);
  
  console.log("✅ Copy successful!");
  console.log(`   ID: ${result.id}`);
  console.log(`   Name: ${result.name}`);
  console.log(`   Size: ${result.size} bytes`);
  console.log(`   Link: ${result.webViewLink}`);
  
  console.log("\n✅ Fix verified! The download+upload approach works for Shared Drives.");
} catch (err) {
  console.error("❌ Copy failed:", err.message);
  if (err.response) {
    console.error(`   Status: ${err.response.status}`);
    console.error(`   Data:`, JSON.stringify(err.response.data, null, 2));
  }
}
