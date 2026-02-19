import { listFilesInFolder, deleteFile } from "../server/googleDrive.ts";

// Recursively delete empty folders
async function deleteEmptyFolder(folderId, folderName, depth = 0) {
  const indent = "  ".repeat(depth);
  const contents = await listFilesInFolder(folderId);
  
  // First, recurse into subfolders
  for (const item of contents.files) {
    if (item.mimeType === "application/vnd.google-apps.folder") {
      await deleteEmptyFolder(item.id, item.name, depth + 1);
    }
  }
  
  // Re-check after deleting subfolders
  const recheck = await listFilesInFolder(folderId);
  if (recheck.files.length === 0) {
    try {
      await deleteFile(folderId);
      console.log(`${indent}✓ Deleted empty: ${folderName}`);
    } catch (err) {
      console.log(`${indent}✗ Failed to delete ${folderName}: ${err.message}`);
    }
  } else {
    const remaining = recheck.files.filter(f => f.mimeType !== "application/vnd.google-apps.folder");
    if (remaining.length > 0) {
      console.log(`${indent}⚠ Still has ${remaining.length} files: ${folderName}`);
      for (const f of remaining) {
        console.log(`${indent}  - ${f.name}`);
      }
    }
  }
}

async function main() {
  console.log("=== Cleaning up old folders ===\n");
  
  // Old folders that need recursive cleanup
  // 01. COMO (contains Projects and كولييرز مول)
  // 01. COMO > كولييرز مول should be empty now (files moved)
  const comoFolderId = "1m5O5-F-7xBy7LutPmXHjQ1VwLeissutc";
  const comoContents = await listFilesInFolder(comoFolderId);
  console.log("01. COMO contents:");
  for (const item of comoContents.files) {
    console.log(`  ${item.name} (${item.mimeType === "application/vnd.google-apps.folder" ? "folder" : "file"})`);
    if (item.mimeType === "application/vnd.google-apps.folder") {
      const subContents = await listFilesInFolder(item.id);
      if (subContents.files.length === 0) {
        await deleteFile(item.id);
        console.log(`    ✓ Deleted empty subfolder: ${item.name}`);
      } else {
        console.log(`    Has ${subContents.files.length} items`);
        for (const sub of subContents.files) {
          console.log(`      - ${sub.name}`);
        }
      }
    }
  }
  
  // 02_Company Documents (contains CONTRACTS, LEGAL_&_LICENSES, MEETINGS_MOM, METHODOLOGY)
  const compDocsFolderId = "1Gu2Uy8ys4Zs3Ck8kGwJCBWqxVB7Yxjkf";
  await deleteEmptyFolder(compDocsFolderId, "02_Company Documents");
  
  // عروض folder
  const offersId = "1xPxGjCjYBxVLIqYHjSYDk2Vy4-PZRxvW";
  await deleteEmptyFolder(offersId, "عروض");
  
  // contracts folder
  const contractsId = "1Wg2sFhpWMgKbcAhJqNNwDsUwjKUDgqq4";
  await deleteEmptyFolder(contractsId, "contracts");
  
  // المنهجية folder
  const methodId = "1Rl1Xt2aTMiNGTUCXqPKGJOXaHZxjmFn_";
  await deleteEmptyFolder(methodId, "المنهجية");
  
  // 04- Legal folder
  const legalId = "1WFqG2TP_3gQBdLUBIoJy-Bz3bTQqiXCi";
  await deleteEmptyFolder(legalId, "04- Legal");
  
  // Re-check 01. COMO after cleanup
  const recheck = await listFilesInFolder(comoFolderId);
  const remainingFolders = recheck.files.filter(f => f.mimeType === "application/vnd.google-apps.folder");
  const remainingFiles = recheck.files.filter(f => f.mimeType !== "application/vnd.google-apps.folder");
  
  if (remainingFolders.length === 1 && remainingFolders[0].name === "Projects") {
    console.log("\n⚠ 01. COMO still has 'Projects' folder - this should be kept (contains project subfolders)");
  }
  if (remainingFiles.length === 0 && remainingFolders.length <= 1) {
    console.log("✓ 01. COMO is clean (only Projects folder remains if any)");
  }
  
  console.log("\n=== Cleanup Complete ===");
}

main().catch(console.error);
