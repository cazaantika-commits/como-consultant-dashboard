import { createFolder, renameFile, moveFile, listFilesInFolder, deleteFile } from "../server/googleDrive.ts";

// Main folder IDs (already created)
const COMO_FOUNDATION = "193pE-Pgp1ACeq18bSMzeCaS8wueAhKD2";
const PLOT_CONTRACTS = "1RJVz0uTBkm6xbLN8R_EFayh8f3TLJl74";
const CONSULTANCY_PROPOSALS = "1sAU8DhoTxqJ3aGSFb_YD5mzi3XfUgtRt";
const MAIN_FOLDER_ID = "1PLhYCKU08CMKJWfPK44IjNAw_V3oOawD";

async function createSubfolders() {
  console.log("=== Phase 1: Creating Subfolders ===\n");
  const subfolders = {};

  // COMO_FOUNDATION subfolders
  const foundationSubs = [
    "01_الرخص والعقود العامة",
    "02_محاضر الاجتماعات (MOMs)",
    "03_منهجية العمل (Methodology)",
  ];
  for (const name of foundationSubs) {
    const res = await createFolder(name, COMO_FOUNDATION);
    console.log(`  ✓ COMO_FOUNDATION > ${name} (${res.id})`);
    subfolders[`FOUNDATION_${name.split("_")[0]}`] = res.id;
  }

  // PLOT_CONTRACTS subfolders
  const plotSubs = [
    "01_تحليل الأراضي",
    "02_ماجان (6457956)",
    "03_ند الشبا (6180578)",
    "04_ند الشبا (6185392)",
    "05_الجداف (3260885)",
  ];
  for (const name of plotSubs) {
    const res = await createFolder(name, PLOT_CONTRACTS);
    console.log(`  ✓ PLOT_CONTRACTS > ${name} (${res.id})`);
    subfolders[`PLOT_${name.split("_")[0]}`] = res.id;
  }

  // CONSULTANCY_PROPOSALS subfolders
  const consultSubs = [
    "01_ماجان - مركز تجاري (6457956)",
    "02_ماجان - سكني (6457879)",
    "03_ند الشبا - فلل (6180578)",
    "04_ند الشبا - سكني (6185392)",
    "05_ند الشبا - شقق (6182776)",
    "06_الجداف (3260885)",
    "07_عامة",
  ];
  for (const name of consultSubs) {
    const res = await createFolder(name, CONSULTANCY_PROPOSALS);
    console.log(`  ✓ CONSULTANCY_PROPOSALS > ${name} (${res.id})`);
    subfolders[`CONSULT_${name.split("_")[0]}`] = res.id;
  }

  return subfolders;
}

async function moveFilesToSubfolders(subfolders) {
  console.log("\n=== Phase 2: Moving Files to Subfolders ===\n");

  // First, list all files in each main folder to get their current IDs
  const foundationFiles = await listFilesInFolder(COMO_FOUNDATION);
  const plotFiles = await listFilesInFolder(PLOT_CONTRACTS);
  const consultFiles = await listFilesInFolder(CONSULTANCY_PROPOSALS);

  // Build name->id maps (excluding subfolders)
  const fMap = new Map();
  for (const f of foundationFiles.files) {
    if (f.mimeType !== "application/vnd.google-apps.folder") fMap.set(f.name, f.id);
  }
  const pMap = new Map();
  for (const f of plotFiles.files) {
    if (f.mimeType !== "application/vnd.google-apps.folder") pMap.set(f.name, f.id);
  }
  const cMap = new Map();
  for (const f of consultFiles.files) {
    if (f.mimeType !== "application/vnd.google-apps.folder") cMap.set(f.name, f.id);
  }

  let success = 0;
  let errors = [];

  // COMO_FOUNDATION moves
  const foundationMoves = [
    { name: "COMO_LIC_2024_2025.pdf", target: subfolders["FOUNDATION_01"] },
    { name: "COMO_LIC_2024_2025_Updated.pdf", target: subfolders["FOUNDATION_01"] },
    { name: "COMO_MOM_20251225.pdf", target: subfolders["FOUNDATION_02"] },
    { name: "COMO_MOM-PRES_20251225.pdf", target: subfolders["FOUNDATION_02"] },
    { name: "COMO_METHOD_V6.0_2026.pdf", target: subfolders["FOUNDATION_03"] },
    { name: "COMO_METHOD_V6.0_2026.docx", target: subfolders["FOUNDATION_03"] },
    { name: "COMO_METHOD_V6.0_2026_copy.pdf", target: subfolders["FOUNDATION_03"] },
    { name: "COMO_METHOD_V6.0_2026_copy.docx", target: subfolders["FOUNDATION_03"] },
    { name: "COMO_GLOSSARY_TERMS.pdf", target: subfolders["FOUNDATION_03"] },
  ];

  console.log("--- COMO_FOUNDATION ---");
  for (const op of foundationMoves) {
    const fileId = fMap.get(op.name);
    if (!fileId) { console.log(`  ⚠ Not found: ${op.name}`); continue; }
    try {
      await moveFile(fileId, op.target);
      console.log(`  ✓ ${op.name}`);
      success++;
    } catch (err) {
      console.error(`  ✗ ${op.name}: ${err.message}`);
      errors.push({ name: op.name, error: err.message });
    }
  }

  // PLOT_CONTRACTS moves
  const plotMoves = [
    { name: "COMO_ANALYSIS_LAND_20260206.pdf", target: subfolders["PLOT_01"] },
    { name: "COMO_ANALYSIS_LAND_20260206_copy.pdf", target: subfolders["PLOT_01"] },
    { name: "MAJ-M_6457956_PCA_20241216.pdf", target: subfolders["PLOT_02"] },
    { name: "NAS-V_6180578_NOV_20240327_Signed.pdf", target: subfolders["PLOT_03"] },
    { name: "NAS-V_6180578_SPA_Executed.pdf", target: subfolders["PLOT_03"] },
    { name: "NAS-R_6185392_NOV_20240627_Signed.pdf", target: subfolders["PLOT_04"] },
    { name: "NAS-R_6185392_SPA_Executed.pdf", target: subfolders["PLOT_04"] },
    { name: "JAD_3260885_PCA_20240315_Resale.pdf", target: subfolders["PLOT_05"] },
  ];

  console.log("\n--- PLOT_CONTRACTS ---");
  for (const op of plotMoves) {
    const fileId = pMap.get(op.name);
    if (!fileId) { console.log(`  ⚠ Not found: ${op.name}`); continue; }
    try {
      await moveFile(fileId, op.target);
      console.log(`  ✓ ${op.name}`);
      success++;
    } catch (err) {
      console.error(`  ✗ ${op.name}: ${err.message}`);
      errors.push({ name: op.name, error: err.message });
    }
  }

  // CONSULTANCY_PROPOSALS moves
  const consultMoves = [
    // 01_ماجان - مركز تجاري (6457956)
    { name: "MAJ-M_6457956_PRO_20260209_ABA.pdf", target: subfolders["CONSULT_01"] },
    { name: "MAJ-M_6457956_PRO_20260206_LAC.pdf", target: subfolders["CONSULT_01"] },
    { name: "MAJ-M_6457956_PRO_202602_COL.pdf", target: subfolders["CONSULT_01"] },
    { name: "MAJ-M_6457956_PRO-COL_EVAL.pdf", target: subfolders["CONSULT_01"] },
    { name: "MAJ-M_6457956_FACTSHEET.pdf", target: subfolders["CONSULT_01"] },
    // 02_ماجان - سكني (6457879)
    { name: "MAJ-R_6457879_PRO_20260212_DAT.pdf", target: subfolders["CONSULT_02"] },
    { name: "MAJ-R_6457879_PRO_20260206_LAC.pdf", target: subfolders["CONSULT_02"] },
    // 03_ند الشبا - فلل (6180578)
    { name: "NAS-V_6180578_PRO_20260212_DAT.pdf", target: subfolders["CONSULT_03"] },
    { name: "NAS-V_6180578_PRO_2026_SAF.pdf", target: subfolders["CONSULT_03"] },
    { name: "NAS-V_6180578_PRO_20260209_REAL.pdf", target: subfolders["CONSULT_03"] },
    // 04_ند الشبا - سكني (6185392)
    { name: "NAS-R_6185392_PRO_20260212_DAT.pdf", target: subfolders["CONSULT_04"] },
    { name: "NAS-R_6185392_PRO_2026_SAF.pdf", target: subfolders["CONSULT_04"] },
    { name: "NAS-R_6185392_PRO_20260209_REAL.pdf", target: subfolders["CONSULT_04"] },
    { name: "NAS-R_6185392_FEAS_CALC.xlsx", target: subfolders["CONSULT_04"] },
    // 05_ند الشبا - شقق (6182776)
    { name: "NAS-RA_6182776_PRO_20260212_DAT.pdf", target: subfolders["CONSULT_05"] },
    { name: "NAS-RA_6182776_PRO_2026_SAF.pdf", target: subfolders["CONSULT_05"] },
    { name: "NAS-RA_6182776_PRO_20260209_REAL.pdf", target: subfolders["CONSULT_05"] },
    // 06_الجداف (3260885)
    { name: "JAD_3260885_PRO_20260212_DAT.pdf", target: subfolders["CONSULT_06"] },
    { name: "JAD_3260885_PRO_2026_SAF.pdf", target: subfolders["CONSULT_06"] },
    { name: "JAD_3260885_PRO_20260209_REAL.pdf", target: subfolders["CONSULT_06"] },
    { name: "JAD_3260885_PRO_20260209_OSU.pdf", target: subfolders["CONSULT_06"] },
    // 07_عامة
    { name: "COMO_PRO-COMP_20260213_ART.pdf", target: subfolders["CONSULT_07"] },
    { name: "COMO_CONSULTANT_COMP_DASH_V10.html", target: subfolders["CONSULT_07"] },
  ];

  console.log("\n--- CONSULTANCY_PROPOSALS ---");
  for (const op of consultMoves) {
    const fileId = cMap.get(op.name);
    if (!fileId) { console.log(`  ⚠ Not found: ${op.name}`); continue; }
    try {
      await moveFile(fileId, op.target);
      console.log(`  ✓ ${op.name}`);
      success++;
    } catch (err) {
      console.error(`  ✗ ${op.name}: ${err.message}`);
      errors.push({ name: op.name, error: err.message });
    }
  }

  console.log(`\nMoved: ${success} | Errors: ${errors.length}`);
  return { success, errors };
}

async function cleanupOldFolders() {
  console.log("\n=== Phase 3: Cleanup Old Empty Folders ===\n");

  // List contents of main folder to find old folders to delete
  const mainContents = await listFilesInFolder(MAIN_FOLDER_ID);
  
  // Old folders to clean up (skip the 3 new ones and 01. Projects)
  const keepFolderIds = new Set([
    COMO_FOUNDATION,
    PLOT_CONTRACTS,
    CONSULTANCY_PROPOSALS,
  ]);

  // Known old folder names to delete
  const oldFolderNames = [
    "عروض",
    "contracts",
    "المنهجية",
    "04- Legal",
    "01. COMO",
    "02_Company Documents",
    "كولييرز مول",
  ];

  for (const item of mainContents.files) {
    if (item.mimeType === "application/vnd.google-apps.folder" && !keepFolderIds.has(item.id)) {
      // Check if it's an old folder we should delete
      const isOld = oldFolderNames.some(name => item.name.includes(name) || name.includes(item.name));
      if (isOld) {
        // Check if folder is empty
        const contents = await listFilesInFolder(item.id);
        if (contents.files.length === 0) {
          try {
            await deleteFile(item.id);
            console.log(`  ✓ Deleted empty folder: ${item.name}`);
          } catch (err) {
            console.log(`  ✗ Failed to delete ${item.name}: ${err.message}`);
          }
        } else {
          console.log(`  ⚠ Folder not empty (${contents.files.length} items): ${item.name}`);
          for (const sub of contents.files) {
            console.log(`    - ${sub.name} (${sub.mimeType === "application/vnd.google-apps.folder" ? "folder" : "file"})`);
          }
        }
      } else {
        console.log(`  ℹ Keeping folder: ${item.name}`);
      }
    }
  }
}

async function main() {
  const subfolders = await createSubfolders();
  await moveFilesToSubfolders(subfolders);
  await cleanupOldFolders();
  
  console.log("\n=== DONE ===");
}

main().catch(console.error);
