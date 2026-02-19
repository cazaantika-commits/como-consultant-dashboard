/**
 * Script to reorganize Google Drive files according to Gemini's naming convention
 * Folder: 01. COMO _Projects Management
 * 
 * Naming convention: [PROJECT_CODE]_[PLOT_NUMBER]_[DOC_TYPE]_[DATE]_[COMPANY_CODE]
 * 
 * Project codes:
 * COMO: General company docs
 * NAS-V: Nad Al Sheba - Villa (6180578)
 * NAS-R: Nad Al Sheba - Residential (6185392)
 * NAS-RA: Nad Al Sheba - Apartments (6182776)
 * JAD: Jaddaf (3260885)
 * MAJ-M: Majan - Mall (6457956)
 * MAJ-R: Majan - Residential (6457879)
 */

import { getDriveClient, listFilesInFolder, createFolder, renameFile, moveFile, getFileMetadata } from "../server/googleDrive.ts";

// Naming map from Gemini's recommendations
const RENAME_MAP = {
  // I. Foundation Documents (COMO_FOUNDATION)
  "01 محضر اجتماع تأسيسي لشركةكومو للتطوير العقاري.pdf": "COMO_MOM_20251225.pdf",
  "02 عرض محضر اجتماع تأسيسي شركة_كومو.pdf": "COMO_MOM-PRES_20251225.pdf",
  "COMO LICENSE 2024 - 2025 Updated. on 09-sep-2024.pdf": "COMO_LIC_2024_2025_Updated.pdf",
  "تقرير_المنهجية_الشامل_-_الإصدار_6.0.pdf": "COMO_METHOD_V6.0_2026.pdf",
  "تقرير_المنهجية_الشامل_-_الإصدار_6.0.docx": "COMO_METHOD_V6.0_2026.docx",
  "المصطلحات.pdf": "COMO_GLOSSARY_TERMS.pdf",

  // II. Plot Contracts (PLOT_CONTRACTS)
  "تحليل عقود الاراضي والالتزامات.pdf": "COMO_ANALYSIS_LAND_20260206.pdf",
  "FULL SPA - MAJAN PLOT 666_compressed (2).pdf": "MAJ-M_6457956_PCA_20241216.pdf",
  "FULL SPA - MAJAN PLOT 666_compressed.pdf": "MAJ-M_6457956_PCA_20241216.pdf",
  "JADDAF WATERFRONT CV-P1-A-15 - RESALE PLOT COMPLIANCE AGREEMENT.pdf": "JAD_3260885_PCA_20240315_Resale.pdf",
  "NAD AL SHIBA - PLOT 1924 - 6180578 - Signed Novation Agreement.pdf": "NAS-V_6180578_NOV_20240327_Signed.pdf",
  "NAD AL SHIBA - PLOT 1924 - 6180578-Executed SPA.pdf": "NAS-V_6180578_SPA_Executed.pdf",
  "NAD AL SHIBA - PLOT 2153 - 6185392 - Signed Novation Agreement.pdf": "NAS-R_6185392_NOV_20240627_Signed.pdf",
  "NAD AL SHIBA - PLOT 2153 - 6185392 -Fully Executed SPA.pdf": "NAS-R_6185392_SPA_Executed.pdf",

  // III. Consultancy Proposals (CONSULTANCY_PROPOSALS)
  "CALCULATOR.xlsx": "NAS-R_6185392_FEAS_CALC.xlsx",
  "تقييم كولييرز.pdf": "MAJ-M_6457956_PRO-COL_EVAL.pdf",
  "Como Real Estate Development L.L.C _Shopping Centre Development_Retail Advisory_Revised Proposal (1).pdf": "MAJ-M_6457956_PRO_202602_COL.pdf",
  "Fact Sheet_Mall.pdf": "MAJ-M_6457956_FACTSHEET.pdf",
  "Mall _ Arif & Bintoak.pdf": "MAJ-M_6457956_PRO_20260209_ABA.pdf",
  "Mall _ Lacasa.pdf": "MAJ-M_6457956_PRO_20260206_LAC.pdf",
  "Majan Building _Datum.pdf": "MAJ-R_6457879_PRO_20260212_DAT.pdf",
  "Majan Building _Lacasa.pdf": "MAJ-R_6457879_PRO_20260206_LAC.pdf",
  "4 Villas _Datum.pdf": "NAS-V_6180578_PRO_20260212_DAT.pdf",
  "4 Villas _Safeer.pdf": "NAS-V_6180578_PRO_2026_SAF.pdf",
  "4 Villas _Realistic.pdf": "NAS-V_6180578_PRO_20260209_REAL.pdf",
  "Nad AL Shiba 6185392_Datum.pdf": "NAS-R_6185392_PRO_20260212_DAT.pdf",
  "Nad AL Shiba 6185392_Safeer.pdf": "NAS-R_6185392_PRO_2026_SAF.pdf",
  "Nad AL Shiba 6185392_Realistic.pdf": "NAS-R_6185392_PRO_20260209_REAL.pdf",
  "Nad AL Shiba المدمجة_Datum.pdf": "NAS-RA_6182776_PRO_20260212_DAT.pdf",
  "Nad AL Shiba المدمجة_Safeer.pdf": "NAS-RA_6182776_PRO_2026_SAF.pdf",
  "Nad AL Shiba المدمجة_Realistic.pdf": "NAS-RA_6182776_PRO_20260209_REAL.pdf",
  "Jaddaf _Datum.pdf": "JAD_3260885_PRO_20260212_DAT.pdf",
  "Jaddaf _Safeer.pdf": "JAD_3260885_PRO_2026_SAF.pdf",
  "Jaddaf _Realistic.pdf": "JAD_3260885_PRO_20260209_REAL.pdf",
  "Jaddaf _OSUS.pdf": "JAD_3260885_PRO_20260209_OSU.pdf",
  "Artec.pdf": "COMO_PRO-COMP_20260213_ART.pdf",
  "consultant_comparison_dashboard_v10_final (1).html": "COMO_CONSULTANT_COMP_DASH_V10.html",
  "COMO LICENSE 2024 - 2025 Updated.pdf": "COMO_LIC_2024_2025.pdf",
};

// Category classification based on new name prefix
function getCategory(newName) {
  // Foundation docs
  if (newName.startsWith("COMO_MOM") || newName.startsWith("COMO_LIC_2024_2025_Updated") || 
      newName.startsWith("COMO_METHOD") || newName.startsWith("COMO_GLOSSARY")) {
    return "COMO_FOUNDATION";
  }
  // Plot contracts
  if (newName.includes("_PCA_") || newName.includes("_NOV_") || newName.includes("_SPA_") || 
      newName.startsWith("COMO_ANALYSIS_LAND")) {
    return "PLOT_CONTRACTS";
  }
  // Everything else is consultancy proposals
  return "CONSULTANCY_PROPOSALS";
}

async function getAllFilesRecursive(folderId, path = "") {
  const result = [];
  let pageToken;
  do {
    const page = await listFilesInFolder(folderId, pageToken);
    for (const file of page.files) {
      const filePath = path ? `${path}/${file.name}` : file.name;
      if (file.mimeType === "application/vnd.google-apps.folder") {
        const subFiles = await getAllFilesRecursive(file.id, filePath);
        result.push(...subFiles);
      } else {
        result.push({ ...file, path: filePath });
      }
    }
    pageToken = page.nextPageToken;
  } while (pageToken);
  return result;
}

async function main() {
  console.log("=== Google Drive File Reorganization Script ===\n");
  
  // Step 1: Find the main folder
  console.log("Step 1: Finding main folder '01. COMO _Projects Management'...");
  const drive = getDriveClient();
  const searchRes = await drive.files.list({
    q: "name contains 'COMO' and name contains 'Projects Management' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
    fields: "files(id, name, mimeType, parents)",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  
  const mainFolder = searchRes.data.files?.[0];
  if (!mainFolder) {
    console.error("ERROR: Could not find the main folder. Searching for all shared folders...");
    const shared = await drive.files.list({
      q: "sharedWithMe = true and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
      fields: "files(id, name)",
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    console.log("Shared folders:", shared.data.files?.map(f => `${f.name} (${f.id})`));
    return;
  }
  
  console.log(`Found: ${mainFolder.name} (ID: ${mainFolder.id})\n`);
  
  // Step 2: List all current files
  console.log("Step 2: Listing all current files...");
  const allFiles = await getAllFilesRecursive(mainFolder.id);
  console.log(`Found ${allFiles.length} files total\n`);
  
  for (const f of allFiles) {
    console.log(`  - ${f.path} (${f.id})`);
  }
  console.log();
  
  // Step 3: Create category subfolders
  console.log("Step 3: Creating category subfolders...");
  const categories = ["COMO_FOUNDATION", "PLOT_CONTRACTS", "CONSULTANCY_PROPOSALS"];
  const categoryFolders = {};
  
  // Check if folders already exist
  const existingFolders = await listFilesInFolder(mainFolder.id);
  for (const cat of categories) {
    const existing = existingFolders.files.find(f => f.name === cat && f.mimeType === "application/vnd.google-apps.folder");
    if (existing) {
      console.log(`  Folder "${cat}" already exists (${existing.id})`);
      categoryFolders[cat] = existing.id;
    } else {
      const created = await createFolder(cat, mainFolder.id);
      console.log(`  Created folder "${cat}" (${created.id})`);
      categoryFolders[cat] = created.id;
    }
  }
  console.log();
  
  // Step 4: Rename and move files
  console.log("Step 4: Renaming and moving files...");
  let renamed = 0;
  let moved = 0;
  let skipped = 0;
  const errors = [];
  
  for (const file of allFiles) {
    const originalName = file.name;
    const newName = RENAME_MAP[originalName];
    
    if (!newName) {
      // Check partial matches (for files with slight name differences)
      let matchedNewName = null;
      for (const [key, val] of Object.entries(RENAME_MAP)) {
        if (originalName.includes(key.substring(0, 20)) || key.includes(originalName.substring(0, 20))) {
          matchedNewName = val;
          break;
        }
      }
      
      if (!matchedNewName) {
        console.log(`  SKIP: "${originalName}" - no mapping found`);
        skipped++;
        continue;
      }
    }
    
    const targetName = newName || originalName;
    const category = getCategory(targetName);
    const targetFolderId = categoryFolders[category];
    
    try {
      // Rename
      if (targetName !== originalName) {
        await renameFile(file.id, targetName);
        console.log(`  RENAMED: "${originalName}" → "${targetName}"`);
        renamed++;
      }
      
      // Move to category folder if not already there
      if (file.parents && !file.parents.includes(targetFolderId)) {
        await moveFile(file.id, targetFolderId);
        console.log(`  MOVED: "${targetName}" → ${category}/`);
        moved++;
      }
    } catch (err) {
      console.error(`  ERROR on "${originalName}": ${err.message}`);
      errors.push({ file: originalName, error: err.message });
    }
  }
  
  console.log(`\n=== Summary ===`);
  console.log(`Total files: ${allFiles.length}`);
  console.log(`Renamed: ${renamed}`);
  console.log(`Moved: ${moved}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Errors: ${errors.length}`);
  if (errors.length > 0) {
    console.log("Error details:", errors);
  }
}

main().catch(console.error);
