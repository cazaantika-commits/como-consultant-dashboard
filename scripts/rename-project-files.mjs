import { renameFile, moveFile, createFolder, listFilesInFolder } from "../server/googleDrive.ts";

// Existing subfolder IDs (created in phase 2)
// We need to discover them first
const COMO_FOUNDATION = "193pE-Pgp1ACeq18bSMzeCaS8wueAhKD2";
const PLOT_CONTRACTS = "1RJVz0uTBkm6xbLN8R_EFayh8f3TLJl74";
const CONSULTANCY_PROPOSALS = "1sAU8DhoTxqJ3aGSFb_YD5mzi3XfUgtRt";

async function getSubfolderIds(parentId) {
  const contents = await listFilesInFolder(parentId);
  const map = {};
  for (const f of contents.files) {
    if (f.mimeType === "application/vnd.google-apps.folder") {
      map[f.name] = f.id;
    }
  }
  return map;
}

async function main() {
  console.log("=== Discovering subfolder IDs ===\n");
  
  const foundationSubs = await getSubfolderIds(COMO_FOUNDATION);
  const plotSubs = await getSubfolderIds(PLOT_CONTRACTS);
  const consultSubs = await getSubfolderIds(CONSULTANCY_PROPOSALS);
  
  console.log("COMO_FOUNDATION subfolders:", Object.keys(foundationSubs));
  console.log("PLOT_CONTRACTS subfolders:", Object.keys(plotSubs));
  console.log("CONSULTANCY_PROPOSALS subfolders:", Object.keys(consultSubs));

  // Get subfolder IDs by prefix
  const getSub = (map, prefix) => {
    const key = Object.keys(map).find(k => k.startsWith(prefix));
    return key ? map[key] : null;
  };

  const FOUND_01 = getSub(foundationSubs, "01_");  // الرخص والعقود العامة
  const FOUND_02 = getSub(foundationSubs, "02_");  // محاضر الاجتماعات
  const FOUND_03 = getSub(foundationSubs, "03_");  // منهجية العمل
  const PLOT_01 = getSub(plotSubs, "01_");  // تحليل الأراضي
  const PLOT_02 = getSub(plotSubs, "02_");  // ماجان 6457956
  const PLOT_03 = getSub(plotSubs, "03_");  // ند الشبا 6180578
  const PLOT_04 = getSub(plotSubs, "04_");  // ند الشبا 6185392
  const PLOT_05 = getSub(plotSubs, "05_");  // الجداف 3260885
  const CONS_01 = getSub(consultSubs, "01_");  // ماجان مركز تجاري
  const CONS_02 = getSub(consultSubs, "02_");  // ماجان سكني
  const CONS_03 = getSub(consultSubs, "03_");  // ند الشبا فلل
  const CONS_04 = getSub(consultSubs, "04_");  // ند الشبا سكني
  const CONS_05 = getSub(consultSubs, "05_");  // ند الشبا شقق
  const CONS_06 = getSub(consultSubs, "06_");  // الجداف
  const CONS_07 = getSub(consultSubs, "07_");  // عامة

  let success = 0;
  let errors = [];

  async function renameAndMove(fileId, newName, targetFolderId, oldName) {
    try {
      await renameFile(fileId, newName);
      if (targetFolderId) {
        await moveFile(fileId, targetFolderId);
      }
      console.log(`  ✓ ${oldName} → ${newName}`);
      success++;
    } catch (err) {
      console.error(`  ✗ ${oldName}: ${err.message}`);
      errors.push({ old: oldName, new: newName, error: err.message });
    }
  }

  // Also create project-specific subfolders inside each project for organization
  // We'll create: DOC, DESIGN, FEASIBILITY, REPORTS subfolders where needed

  // ===== 1. Majan Offices (MAJ-R_6457879) =====
  console.log("\n=== Majan Offices (MAJ-R_6457879) ===");
  
  // LA folder > proposals
  await renameAndMove("1ZqDG3fkEi3rPET5hdOMLhDiFsdyywicz", "MAJ-R_6457879_PRO-FEE_LA.pdf", CONS_02, "Fees Proposal (Technical and Financial) (1).pdf");
  await renameAndMove("1K0SvO8jo9MrtGfy8Vu0ujYy5hpwhElXg", "MAJ-R_6457879_PRO-FEE_LA_LETTER.pdf", CONS_02, "Letter 00836 - Fee Proposal.pdf");
  
  // LAB folder > feasibility/research docs
  await renameAndMove("1n0EaYgrH2G5BxI57fMuCfCWYtJE8h5UX", "MAJ-R_6457879_FEAS_BRIX_V3.docx", null, "بريكس 3.docx");
  await renameAndMove("1M9857hTOSgcNjg3_8GbYid8xVjsDnc9o", "MAJ-R_6457879_FEAS_BRIX_V1.docx", null, "بريكس.docx");
  await renameAndMove("1wKMgciPYcYkFHdPWuauTQmEktiLb8H6L", "MAJ-R_6457879_FEAS_BRIX_V2.docx", null, "بريكس2.docx");
  await renameAndMove("1VxAVnHm7VBG0Zqnh0SgwLIHN-bcdQB-O", "MAJ-R_6457879_REPORT_03.pdf", null, "تقرير 03.pdf");
  await renameAndMove("1iCxZro6sdyIob_NCvSATc9-Meysy9ulf", "MAJ-R_6457879_FEAS_GOOGLE-AI_V2.docx", null, "جوجل ا اي 2.docx");
  await renameAndMove("1_amp5fhIhtjNLigEyr5rXQdDabQLiKwh", "MAJ-R_6457879_FEAS_GOOGLE-AI_V1.docx", null, "جوجل ا اي.docx");
  await renameAndMove("1RtnhN_hwP_WXSQOJnhUt_V_4q_Ym_tYm", "MAJ-R_6457879_FEAS_OFFICE-MIX.docx", null, "دراسة جدوى مجان مكاتب ميكس.docx");
  await renameAndMove("1QDbd9qStwwWhd8D80625OuLvVTXuVk_v", "MAJ-R_6457879_FEAS_OFFICE-MIX.pdf", null, "دراسة جدوى مجان مكاتب ميكس.pdf");
  await renameAndMove("1ZsdA2-PEFrAwkPH78lTKU2yds1nj_tfJ", "MAJ-R_6457879_FEAS_OFFICE-BRIX.docx", null, "مبنى مكاتب في ماجان يريكس.docx");
  await renameAndMove("16gNGUcxw0okYbm5dbTnkqTLnxqvh75tA", "MAJ-R_6457879_NOTES_CHAT.docx", null, "نوت بوك تشات.docx");
  
  // Root file
  await renameAndMove("16eBOd6pE8BUn_iGZ94Q-Jm06qFbVjRCq", "MAJ-R_6457879_REPORT_BUILDING.pdf", null, "تقرير مبنى ماجان_.pdf");

  // ===== 2. Mall (MAJ-M_6457956) =====
  console.log("\n=== Mall (MAJ-M_6457956) ===");
  
  // lACAZA MAL > OneDrive folder (LACASA manuals)
  await renameAndMove("144qTP1QofK4mQbjGan3thgw3-6IGnpjs", "MAJ-M_6457956_LAC_DESIGN-MANUAL.pdf", CONS_01, "Design Manual.pdf");
  await renameAndMove("1vIRYEnV7Gl_dAWTfmMMdwlFJgSUfZxgv", "MAJ-M_6457956_LAC_MANUALS.pdf", CONS_01, "LACASA Manuals.pdf");
  await renameAndMove("1jnFGKf8cbSpJQx-wa5-l3L6EAexcgoZN", "MAJ-M_6457956_LAC_PROCUREMENT-PROC.pdf", CONS_01, "Procurement Management procedure.pdf");
  await renameAndMove("1s90BbEkwhnIu3nHdIxElYQfWOETfGiEO", "MAJ-M_6457956_LAC_QHSE-MANUAL_R07.pdf", CONS_01, "QHSE Manual Rev 07.pdf");
  await renameAndMove("1dqrGdDUChj4kepohtqJaWykpt4XOK6iW", "MAJ-M_6457956_LAC_RISK-MGMT-PROC.pdf", CONS_01, "RISK MANAGEMENT PROCEDURE.pdf");
  
  // Root files in Mall
  await renameAndMove("1wB4QTinOBRoYKejavt9zQdaaZX6RFshW", "COMO_LIC_2024_2025_COPY.pdf", FOUND_01, "COMO LICENSE 2024 - 2025 Updated. on 09-sep-2024.pdf");
  await renameAndMove("1VJXTc_ubqbJlMJV3MLS5ulze5ATSXZyq", "MAJ-M_6457956_DOC_AFFECTION-PLAN.pdf", PLOT_02, "DDA AFFECTION PLAN - MAJAN PLOT 666.2.pdf");
  await renameAndMove("1ATwX5y3ZmG7FNq3U6gHm2WsK2XSmQbkq", "MAJ-M_6457956_DOC_SITE-PLAN.pdf", PLOT_02, "DDA SITE PLAN - MAJAN PLOT 666.1.pdf");
  await renameAndMove("1DBp5CSA-W3I-aNLKsTE-pdEOPdmcH_mM", "MAJ-M_6457956_DOC_TITLE-DEED.pdf", PLOT_02, "NEW TITLE DEED - MAJAN PLOT 666.pdf");

  // ===== 3. PLOT 0578 - VILLA (NAS-V_6180578) =====
  console.log("\n=== PLOT 0578 - VILLA (NAS-V_6180578) ===");
  
  // DOC subfolder
  await renameAndMove("1Gg7ygwYwMCLTBwKqQxRwJuMWW2rCCqb3", "NAS-V_6180578_DOC_AFFECTION-PLAN.pdf", PLOT_03, "Affection Plan_6180578.pdf");
  await renameAndMove("1Ov8bBuBCqbwmJdSqKBDSXnqWEGHfxcJb", "NAS-V_6180578_DOC_PLOT-GUIDELINE.pdf", PLOT_03, "Plot Guide Line_6180578.pdf");
  await renameAndMove("1oYLyBuBXIWqQJQxVuDJOOq3Rq5Ynwk6v", "NAS-V_6180578_DOC_SITE-PLAN.pdf", PLOT_03, "Site Plan_6180578.pdf");
  
  // FEASIBILITY subfolder (these are duplicate proposals already in CONSULTANCY_PROPOSALS - just rename)
  await renameAndMove("1_Nh9tUJfGXOEcQFxL_Kh9qxRjvJHlGNR", "NAS-V_6180578_PRO_DAT_COPY.pdf", null, "4 Villas _Datum.pdf (FEASIBILITY)");
  await renameAndMove("1DwUHGHOUoAqD2Hq6qxgQvVIzMzYGCUhF", "NAS-V_6180578_PRO_REAL_COPY.pdf", null, "4 Villas _Realistic.pdf (FEASIBILITY)");
  await renameAndMove("1ycKd9qNXLkVVvXVWwMGvGIJBCBvCMqe1", "NAS-V_6180578_PRO_SAF_COPY.pdf", null, "4 Villas _Safeer.pdf (FEASIBILITY)");
  
  // Root design files
  await renameAndMove("1Vn1zDwH9ZjdyxqWHwrx9_fqYPfIYUEnv", "NAS-V_6180578_DESIGN_V001-R3.pdf", null, "132 - Al Meydan Villas - V001-R3.pdf");
  await renameAndMove("15Cd3z-dW-YKV6oLhVct5d4-_RDq2EYgE", "NAS-V_6180578_DESIGN_V001.pdf", null, "132 - Al Meydan Villas - V001.pdf");
  await renameAndMove("1PC_66ZzaHYOVdTmlxxwDS1cJoeF7xa8k", "NAS-V_6180578_DESIGN_V003-R1.pdf", null, "132 - Al Meydan Villas - V003-R1.pdf");
  await renameAndMove("1NAb_sqiNlrHcqkJOQBLd9FkjM3NGKxBo", "NAS-V_6180578_DESIGN_V003-R2.pdf", null, "132 - Al Meydan Villas - V003-R2.pdf");
  await renameAndMove("1VSVNPJHbugJkMh_AOh2r2YqPZpC9ZUVA", "NAS-V_6180578_DESIGN_V004_20250224.pdf", null, "132 - Al Meydan Villas - V004 - 24-02-2025.pdf");
  await renameAndMove("1DXNeKE8ArVPD5i_p96uz0E2UVXNsGiMj", "NAS-V_6180578_DESIGN_V005_20250302.pdf", null, "132 - Al Meydan Villas - V005 - 02-03-2025.pdf");
  await renameAndMove("1zrCy4teq7w6m12MGroUKnSDoqMTWRFwl", "NAS-V_6180578_DOC_PLOT-DETAILS.pdf", PLOT_03, "6180578 - Plot Details.pdf");

  // ===== 4. PLOT 0885 G+2P+7 (JAD_3260885) =====
  console.log("\n=== PLOT 0885 G+2P+7 (JAD_3260885) ===");
  
  // DOC subfolder
  await renameAndMove("126SovDIvrp-20PtKlYApnNJ5iNhSz1WV", "JAD_3260885_DOC_PLOT-DETAILS.pdf", PLOT_05, "3260885.pdf");
  await renameAndMove("14kBKENAi7QQ-GduHBsV93SBMGXQaW2pa", "JAD_3260885_DOC_AFFECTION-PLAN.pdf", PLOT_05, "AFFECTION PLAN 3260885.pdf");
  await renameAndMove("1cQjjyxBxpR91BUIAHwPGtAA5uZ-y3NCb", "JAD_3260885_DOC_GIS.pdf", PLOT_05, "GIS.pdf");
  
  // الدراسة subfolder
  await renameAndMove("1Rn3pKo-whGcYMeb6k3Df3ks_ej6az5gL", "JAD_3260885_FEAS_STUDY.pdf", null, "دراسة_جدوى_مشروع_الجداف.pdf");
  
  // Root files - proposals
  await renameAndMove("1rnKmjrnOj65Pyp_8St9F03APY7EyGy12", "JAD_3260885_PRO_01.pdf", CONS_06, "885 PRO 01.pdf");
  await renameAndMove("149_4UOGDhGHD0QIEDwNcUpWUT0snBNmV", "JAD_3260885_PRO_02.pdf", CONS_06, "885 PRO 02.pdf");
  await renameAndMove("1uoHbfF2BGGMMb0w227qFNp22eZUsfFHy", "JAD_3260885_PRO_03.pdf", CONS_06, "885 PRO 03.pdf");
  await renameAndMove("1pLepbgKJ7nm0O3G5xD1dYvFBJ5ts5iqN", "JAD_3260885_PRO_04.pdf", CONS_06, "PRO 04.pdf");
  
  // Design files
  await renameAndMove("1zjnxPR0f9hWtkkE1ftgeyCy-uo-UGWRv", "JAD_3260885_DESIGN_INITIAL_20251225.pdf", null, "A15- AL JADDAF __INITIAL DESIGN _PROPOSED B+G+7-BUILDING-25-12-2025.pdf");
  await renameAndMove("1gXFIxrzjcV7VMlqOCGzkmLtYTXIlGALr", "JAD_3260885_DATA.xlsx", null, "AL JADDAF  3260885.xlsx");
  await renameAndMove("1MptzbDRHjfWyAdLmNsPafzN6WSLhZnhK", "JAD_3260885_DESIGN_V003_20250512.pdf", null, "BLDG G+7 PLOT-0885 - 12-05-2025 - V003.pdf");
  await renameAndMove("1jnfZPVZolQD1klK5azgX6zK3f7fwcsKM", "JAD_3260885_DESIGN_V001.pdf", null, "BLDG G+7 PLOT-0885-V001.pdf");
  await renameAndMove("1gs14LIKJ_HoTeKHzuJH3XHjgRft5DbE1", "JAD_3260885_DESIGN_V002.pdf", null, "BLDG G+7 PLOT-0885-V002.pdf");

  // ===== 5. PLOT 5392 - G+2P+6 (NAS-R_6185392) =====
  console.log("\n=== PLOT 5392 - G+2P+6 (NAS-R_6185392) ===");
  
  // DOC subfolder
  await renameAndMove("15hcvWUVwDNakkQPrYZ5Av7r6dEfb9RB9", "NAS-R_6185392_DOC_AFFECTION-PLAN.pdf", PLOT_04, "Affection Plan_6185392.pdf");
  await renameAndMove("1N_4ogXQgAlmH3I7cEG1o-3Y6aJl7LxC7", "NAS-R_6185392_DOC_PLOT-GUIDELINE.pdf", PLOT_04, "Plot Guide Line_6185392.pdf");
  await renameAndMove("1waWJDsgBvo6Y6pV_-4ueMto4CrdaQo7-", "NAS-R_6185392_DOC_SITE-PLAN.pdf", PLOT_04, "Site Plan_6185392.pdf");
  
  // FEASIBILITY subfolder - screenshots (rename in place)
  const screenshotIds = [
    ["1jLlRso-3_QCb91EMimtec2CqSSRNOnWP", "NAS-R_6185392_FEAS_SCREEN_01.png"],
    ["1LEa909-HDbC7pS9vJr6r8eBto6NAnesk", "NAS-R_6185392_FEAS_SCREEN_02.png"],
    ["1ooEf2n6kZol3s5GPOe3hkEImOBfDVCa5", "NAS-R_6185392_FEAS_SCREEN_03.png"],
    ["15AAI9pkjJ7CgJlE0wGF7rxviydFg2MmK", "NAS-R_6185392_FEAS_SCREEN_04.png"],
    ["1rcY-LV6uayzcXqnU1sWRLZJPolKVGil5", "NAS-R_6185392_FEAS_SCREEN_05.png"],
    ["1YYdWyGcLpE9hG1AK2cogP_D88oFiI6pL", "NAS-R_6185392_FEAS_SCREEN_06.png"],
    ["1fFquTIOJe5-blxqPz12lQAj2pAfEXQf1", "NAS-R_6185392_FEAS_SCREEN_07.png"],
    ["1NDqwLQ5C4dmzlTrm6NS-67oMEIEcXSp-", "NAS-R_6185392_FEAS_SCREEN_08.png"],
    ["1b13hgy-Irg5tmN12hjegKvTw_FDjMTCA", "NAS-R_6185392_FEAS_SCREEN_09.png"],
    ["1IlPmG_MUz2gTAWokY8U0Jmao2EaLSFUO", "NAS-R_6185392_FEAS_SCREEN_10.png"],
    ["1iED7qZbi-gnkP_xsBFL1gcEYgpDzEswJ", "NAS-R_6185392_FEAS_SCREEN_11.png"],
    ["1kawPkmUNlZ1V8ZKI5thltftqTbGj56pQ", "NAS-R_6185392_FEAS_SCREEN_12.png"],
    ["1zxgNDmI1U1bClRBfBVxXJ4UYv7DPmGy7", "NAS-R_6185392_FEAS_SCREEN_13.png"],
    ["1qG7GQ0r7jN41fBB4fDs3BNkLkTWPgO4r", "NAS-R_6185392_FEAS_SCREEN_14.png"],
  ];
  
  for (const [id, name] of screenshotIds) {
    await renameAndMove(id, name, null, `Screenshot → ${name}`);
  }
  
  // تقارير subfolder - reports
  await renameAndMove("1dbzQ7XFIROOUGXzi4S6nynUIP2vclEOQ", "NAS-R_6185392_RFP.docx", null, "Request_for_Proposal_(RFP).docx");
  await renameAndMove("1E-sPu4W4eNea2lxAcLx7t07NXwlSB4Wd", "NAS-R_6185392_RFP.pdf", null, "Request_for_Proposal_(RFP).pdf");
  await renameAndMove("1xDl9PTiGr9v-pG2AFZbSL_VKl8d1QUKH", "NAS-R_6185392_REPORT_LAND-ANALYSIS.docx", null, "تحليل_وثائق_الأرض.docx");
  await renameAndMove("1U3bNOtXr3wrQsw372zmoJ9oziHQz8wJd", "NAS-R_6185392_REPORT_LAND-ANALYSIS.pdf", null, "تحليل_وثائق_الأرض.pdf");
  await renameAndMove("1FBNfmNWGoRP9eV5Z-np8LNf6xNjSBxTw", "NAS-R_6185392_REPORT_MARKET-STUDY-FEAS.pdf", null, "تقرير دراسة السوق وعمل دراسة جدوى اولية.pdf");
  await renameAndMove("1iij8DLdWXgngZJgRB6TDDsqQdDxtvdxQ", "NAS-R_6185392_REPORT_RISK-ASSESSMENT.docx", null, "تقييم_المخاطر.docx");
  await renameAndMove("1v4cJfumbknlaCXoRT7ifX7qx6BLQIOV0", "NAS-R_6185392_REPORT_RISK-ASSESSMENT.pdf", null, "تقييم_المخاطر.pdf");
  await renameAndMove("1HErX-etEP1zpNd9wOC7h7G7_Bnz2Ivsp", "NAS-R_6185392_REPORT_AREA-CALC-ABCD.docx", null, "حسابات_المساحات.docx");
  await renameAndMove("1hQGW2y9pZQw4ty8HHv9ej4M_Xx9zoYsu", "NAS-R_6185392_REPORT_AREA-CALC-ABCD.pdf", null, "حسابات_المساحات.pdf");
  await renameAndMove("1XRYwRNa2Voq7gS_NncWyJfLFTwiDJdAe", "NAS-R_6185392_REPORT_FINANCIAL-FEAS.docx", null, "دراسة_الجدوى_المالية.docx");
  await renameAndMove("1EVJp0lQXraXmwxT2bkvuYMc1MK_FeVGO", "NAS-R_6185392_REPORT_FINANCIAL-FEAS.pdf", null, "دراسة_الجدوى_المالية.pdf");
  await renameAndMove("1wN66xcira58VLTWLfknm_sigGsfGNC_y", "NAS-R_6185392_REPORT_MARKET-STUDY.docx", null, "دراسة_السوق.docx");
  await renameAndMove("1dtmYa9NHePnOvQVW9jEuoD9fNsz_h-w_", "NAS-R_6185392_REPORT_MARKET-STUDY.pdf", null, "دراسة_السوق.pdf");

  // ===== Rename project folders themselves =====
  console.log("\n=== Renaming Project Folders ===");
  
  // Rename the 5 project folders
  await renameAndMove("1rSaBtCmSsMYAJldJgKHmYQQyI8D1XYYT", "01_PROJECTS", null, "01. Projects (parent)");
  
  // Rename individual project folders
  const projFolders = [
    ["1_J_rFL0qbohIQ06DrxWervxyqfBX5G6O", "LA", "MAJ-R_6457879_LA"],
    ["1LuksjhDm4zjTniQbYBzMv3cysKIITmCN", "LAB", "MAJ-R_6457879_LAB"],
  ];
  
  // Don't rename the main 5 project folders - just rename subfolders
  // Rename DOC folders
  const docFolders = [
    // PLOT 0578 DOC - need to find its ID
    ["1tYj5_yFV51tTxikScsRNOXgR0viGKPAa", "DOC (0885)", "JAD_3260885_DOC"],
    ["1XXzXr2-wEB3i3OC1foI90yPyNC-PGvKe", "DOC (5392)", "NAS-R_6185392_DOC"],
    ["18DycSg7RhQ9vQaFx_n9BqqCnumKD2d9c", "FEASIBILITY (5392)", "NAS-R_6185392_FEASIBILITY"],
    ["1Vm_L-9gsh_XQF1p6YnmNsDltzauWZu3z", "تقارير (5392)", "NAS-R_6185392_REPORTS"],
    ["1qhVMv2rw-XcEZ55NeqKCq0yXUzbu1-iF", "الدراسة (0885)", "JAD_3260885_FEASIBILITY"],
  ];
  
  for (const [id, oldName, newName] of docFolders) {
    try {
      await renameFile(id, newName);
      console.log(`  ✓ Folder: ${oldName} → ${newName}`);
    } catch (err) {
      console.error(`  ✗ Folder ${oldName}: ${err.message}`);
    }
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`Renamed/Moved: ${success} files`);
  console.log(`Errors: ${errors.length}`);
  if (errors.length > 0) {
    console.log("\nErrors:");
    for (const e of errors) {
      console.log(`  ${e.old}: ${e.error}`);
    }
  }
}

main().catch(console.error);
