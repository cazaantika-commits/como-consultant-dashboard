import { getDriveClient, createFolder, renameFile, moveFile, listFilesInFolder } from "../server/googleDrive.ts";

const MAIN_FOLDER_ID = "1PLhYCKU08CMKJWfPK44IjNAw_V3oOawD";

// All files to rename and move, grouped by target category
const OPERATIONS = {
  COMO_FOUNDATION: [
    // From المنهجية folder
    { id: "1K2MxzAGJkwvBIJeuPzjDN2tD9qWCb5tU", newName: "COMO_METHOD_V6.0_2026.pdf" },
    { id: "1P8QE2VLhE99pSjEpQQ5n2NMHn5RIkRFX", newName: "COMO_METHOD_V6.0_2026.docx" },
    // Note: MOM files, License, Glossary - need to find in subfolders
  ],
  PLOT_CONTRACTS: [
    // From 04-Legal folder
    { id: "1cnk43C4J2fqj0gF-GGfU74xiwNuoFDKy", newName: "COMO_ANALYSIS_LAND_20260206.pdf" },
    // From contracts folder
    { id: "1RyJBwrXANJIA9ncCz0f1HSeQqMRcidsm", newName: "MAJ-M_6457956_PCA_20241216.pdf" },
    { id: "1mwy2_ZZ0AeLSoxd68DLtHEou-ySzN3-K", newName: "JAD_3260885_PCA_20240315_Resale.pdf" },
    { id: "1CObby5HmLvALur-XU-h2Bp_KnUCoXDuZ", newName: "NAS-V_6180578_NOV_20240327_Signed.pdf" },
    { id: "1gVmTuj5V3AxEIbEWmCaT-6KJieeHVD3M", newName: "NAS-V_6180578_SPA_Executed.pdf" },
    { id: "1MdZDe6wpP-n6pd2xzyCFOPJB9SiFltAO", newName: "NAS-R_6185392_NOV_20240627_Signed.pdf" },
    { id: "1EcOhSRbnMJH0i3602x5F9jLZkNwb4qnn", newName: "NAS-R_6185392_SPA_Executed.pdf" },
  ],
  CONSULTANCY_PROPOSALS: [
    // Root level
    { id: "1ferz4Fkjgq--KYV8NDP59BJKLYR8P9bC", newName: "NAS-R_6185392_FEAS_CALC.xlsx" },
    // From عروض folder
    { id: "15QiYMB-9Dfh5O5RctujLzJiVxH1nXsET", newName: "NAS-V_6180578_PRO_20260212_DAT.pdf" },
    { id: "1_E2lBWPQKW2sGqGapxvhyA8Kii9Slwya", newName: "NAS-V_6180578_PRO_20260209_REAL.pdf" },
    { id: "1HvyYEsNfxocwsvy9ceQSsEW6PGyOesgu", newName: "NAS-V_6180578_PRO_2026_SAF.pdf" },
    { id: "1gkijt6WwDdwcvux3LILo1xhCmtWTt3QA", newName: "COMO_PRO-COMP_20260213_ART.pdf" },
    { id: "1cTfA_or_2okJaveZd1qDvMYSOiAPXN48", newName: "COMO_CONSULTANT_COMP_DASH_V10.html" },
    { id: "1nxNpK8u_J0SWa8J_hgQyPzk9JCWpqVJb", newName: "JAD_3260885_PRO_20260212_DAT.pdf" },
    { id: "1ELs93Y02X_hz-K5k-bdrSFlgmUDc6Knz", newName: "JAD_3260885_PRO_20260209_OSU.pdf" },
    { id: "1bW1Gfrf0cOLr5PoopvIkNXLymGE24KlY", newName: "JAD_3260885_PRO_20260209_REAL.pdf" },
    { id: "1JuCLhWmomHk_vbKaX7gfPD-jHt1W_-k2", newName: "JAD_3260885_PRO_2026_SAF.pdf" },
    { id: "1j_bVj4WAKw2fwT2htsMKCntcZL5vEE6n", newName: "MAJ-R_6457879_PRO_20260212_DAT.pdf" },
    { id: "17i88jew61LCwOTTXPPGcQhZdMEWgp2fU", newName: "MAJ-R_6457879_PRO_20260206_LAC.pdf" },
    { id: "1wwMfFRFw9L9jZU-8EXinv2IZb1j0OejJ", newName: "MAJ-M_6457956_PRO_20260209_ABA.pdf" },
    { id: "1oIrNSCRhlPD_bUKDs3a4QYgvHWAPdPjr", newName: "MAJ-M_6457956_PRO_20260206_LAC.pdf" },
    { id: "1ZbdM4FVuwOCRToB4W03ILHrjl41WY6US", newName: "NAS-R_6185392_PRO_20260212_DAT.pdf" },
    { id: "1ucQz5Lp0LIepTKTiAwzWPaOilpMgavhm", newName: "NAS-R_6185392_PRO_20260209_REAL.pdf" },
    { id: "1IHdfvQ4QTBwmVH8VzMxrvmVT4XSQ5qaZ", newName: "NAS-R_6185392_PRO_2026_SAF.pdf" },
    { id: "1Ugo850S1cBwMdlzk7CG-V8nKFri59mVw", newName: "NAS-RA_6182776_PRO_20260212_DAT.pdf" },
    { id: "1bGYP9jx9lP1DPnWeizLopqX8SgIjKlRs", newName: "NAS-RA_6182776_PRO_20260209_REAL.pdf" },
    { id: "1mUybzK3ni1J9CFj57ZShFNbq7PkOCmu9", newName: "NAS-RA_6182776_PRO_2026_SAF.pdf" },
  ],
};

// Files we need to find in subfolders (01. COMO, 02_Company Documents, etc.)
async function findMissingFiles() {
  const drive = getDriveClient();
  const missing = [];
  
  // Search for MOM files
  console.log("Searching for foundation documents in subfolders...");
  
  // Search in 01. COMO folder and its subfolders
  const comoFolder = "1m5O5-F-7xBy7LutPmXHjQ1VwLeissutc";
  const comoContents = await listFilesInFolder(comoFolder);
  for (const item of comoContents.files) {
    console.log(`  01. COMO > ${item.name} (${item.id}) [${item.mimeType}]`);
    if (item.mimeType === "application/vnd.google-apps.folder") {
      const subContents = await listFilesInFolder(item.id);
      for (const sub of subContents.files) {
        console.log(`    > ${sub.name} (${sub.id})`);
      }
    }
  }
  
  // Search in 02_Company Documents > MEETINGS_MOM
  const momFolder = "1jzithbgB8-Der6J3IvRs9jP8FQuVfyTZ";
  const momContents = await listFilesInFolder(momFolder);
  console.log("\n  02_Company Documents > MEETINGS_MOM:");
  for (const item of momContents.files) {
    console.log(`    ${item.name} (${item.id})`);
  }
  
  // Search in 02_Company Documents > METHODOLOGY
  const methFolder = "171dzXnUTstfTlLAD439NvUTqrtUytxfR";
  const methContents = await listFilesInFolder(methFolder);
  console.log("\n  02_Company Documents > METHODOLOGY:");
  for (const item of methContents.files) {
    console.log(`    ${item.name} (${item.id})`);
  }
  
  // Search in 02_Company Documents > LEGAL_&_LICENSES
  const legalFolder = "1nKt6mv6XmNvmTMBAb9tZHkoRcHc1nG5z";
  const legalContents = await listFilesInFolder(legalFolder);
  console.log("\n  02_Company Documents > LEGAL_&_LICENSES:");
  for (const item of legalContents.files) {
    console.log(`    ${item.name} (${item.id})`);
  }

  // Search in كولييرز مول folder
  const colliersFolder = "19yV13qO13kveL_pAYS31T6OJcVckmXZ3";
  const colliersContents = await listFilesInFolder(colliersFolder);
  console.log("\n  01. COMO > كولييرز مول:");
  for (const item of colliersContents.files) {
    console.log(`    ${item.name} (${item.id})`);
  }
  
  return missing;
}

async function main() {
  console.log("=== Phase 1: Discovering all files ===\n");
  await findMissingFiles();
  
  console.log("\n=== Phase 2: Creating category folders ===\n");
  const categoryFolders = {};
  
  // Check existing folders first
  const existing = await listFilesInFolder(MAIN_FOLDER_ID);
  for (const cat of ["COMO_FOUNDATION", "PLOT_CONTRACTS", "CONSULTANCY_PROPOSALS"]) {
    const found = existing.files.find(f => f.name === cat && f.mimeType === "application/vnd.google-apps.folder");
    if (found) {
      console.log(`  "${cat}" already exists (${found.id})`);
      categoryFolders[cat] = found.id;
    } else {
      const created = await createFolder(cat, MAIN_FOLDER_ID);
      console.log(`  Created "${cat}" (${created.id})`);
      categoryFolders[cat] = created.id;
    }
  }
  
  console.log("\n=== Phase 3: Renaming and moving files ===\n");
  let success = 0;
  let errors = [];
  
  for (const [category, files] of Object.entries(OPERATIONS)) {
    const targetFolderId = categoryFolders[category];
    console.log(`\n--- ${category} ---`);
    
    for (const file of files) {
      try {
        // Rename first
        await renameFile(file.id, file.newName);
        // Then move
        await moveFile(file.id, targetFolderId);
        console.log(`  ✓ ${file.newName}`);
        success++;
      } catch (err) {
        console.error(`  ✗ ${file.newName}: ${err.message}`);
        errors.push({ name: file.newName, error: err.message });
      }
    }
  }
  
  console.log(`\n=== Summary ===`);
  console.log(`Success: ${success}`);
  console.log(`Errors: ${errors.length}`);
  if (errors.length > 0) {
    for (const e of errors) {
      console.log(`  - ${e.name}: ${e.error}`);
    }
  }
}

main().catch(console.error);
