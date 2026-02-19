import { renameFile, moveFile, listFilesInFolder } from "../server/googleDrive.ts";

// PLOT 0578 - VILLA folder
const PLOT_0578_FOLDER = "1qkxK-LlWf-UIAikg98xZA4Zp-_Rf-BDP"; // 01_PROJECTS

async function main() {
  // First find the PLOT 0578 folder
  const projects = await listFilesInFolder(PLOT_0578_FOLDER);
  console.log("Project folders:");
  for (const p of projects.files) {
    console.log(`  ${p.name} (${p.id})`);
  }
  
  // Find PLOT 0578
  const plot0578 = projects.files.find(f => f.name.includes("0578"));
  if (!plot0578) {
    console.log("PLOT 0578 not found!");
    return;
  }
  
  console.log(`\nPLOT 0578 folder: ${plot0578.name} (${plot0578.id})`);
  
  // List contents
  const contents = await listFilesInFolder(plot0578.id);
  console.log("\nContents:");
  for (const f of contents.files) {
    console.log(`  ${f.name} (${f.id}) ${f.mimeType}`);
    if (f.mimeType === "application/vnd.google-apps.folder") {
      const subContents = await listFilesInFolder(f.id);
      for (const sf of subContents.files) {
        console.log(`    ${sf.name} (${sf.id})`);
      }
    }
  }
  
  // Find DOC folder
  const docFolder = contents.files.find(f => f.name === "DOC" || f.name.includes("DOC"));
  if (docFolder) {
    const docFiles = await listFilesInFolder(docFolder.id);
    console.log("\n=== Fixing DOC files ===");
    
    // Get PLOT_CONTRACTS > 03_ند الشبا (6180578) subfolder ID
    const PLOT_CONTRACTS = "1RJVz0uTBkm6xbLN8R_EFayh8f3TLJl74";
    const plotSubs = await listFilesInFolder(PLOT_CONTRACTS);
    const plot03 = plotSubs.files.find(f => f.name.startsWith("03_"));
    
    for (const f of docFiles.files) {
      let newName;
      if (f.name.includes("Affection")) newName = "NAS-V_6180578_DOC_AFFECTION-PLAN.pdf";
      else if (f.name.includes("Guide")) newName = "NAS-V_6180578_DOC_PLOT-GUIDELINE.pdf";
      else if (f.name.includes("Site")) newName = "NAS-V_6180578_DOC_SITE-PLAN.pdf";
      else newName = `NAS-V_6180578_DOC_${f.name}`;
      
      try {
        await renameFile(f.id, newName);
        if (plot03) await moveFile(f.id, plot03.id);
        console.log(`  ✓ ${f.name} → ${newName}`);
      } catch (err) {
        console.log(`  ✗ ${f.name}: ${err.message}`);
      }
    }
    
    // Rename DOC folder
    try {
      await renameFile(docFolder.id, "NAS-V_6180578_DOC");
      console.log("  ✓ Renamed DOC folder");
    } catch (err) {
      console.log(`  ✗ DOC folder rename: ${err.message}`);
    }
  }
  
  // Find FEASIBILITY folder
  const feasFolder = contents.files.find(f => f.name === "FEASIBILITY" || f.name.includes("FEASIBILITY"));
  if (feasFolder) {
    const feasFiles = await listFilesInFolder(feasFolder.id);
    console.log("\n=== Fixing FEASIBILITY files ===");
    
    for (const f of feasFiles.files) {
      let newName;
      if (f.name.includes("Datum")) newName = "NAS-V_6180578_PRO_DAT_COPY.pdf";
      else if (f.name.includes("Realistic")) newName = "NAS-V_6180578_PRO_REAL_COPY.pdf";
      else if (f.name.includes("Safeer")) newName = "NAS-V_6180578_PRO_SAF_COPY.pdf";
      else newName = `NAS-V_6180578_FEAS_${f.name}`;
      
      try {
        await renameFile(f.id, newName);
        console.log(`  ✓ ${f.name} → ${newName}`);
      } catch (err) {
        console.log(`  ✗ ${f.name}: ${err.message}`);
      }
    }
    
    // Rename FEASIBILITY folder
    try {
      await renameFile(feasFolder.id, "NAS-V_6180578_FEASIBILITY");
      console.log("  ✓ Renamed FEASIBILITY folder");
    } catch (err) {
      console.log(`  ✗ FEASIBILITY folder rename: ${err.message}`);
    }
  }
  
  console.log("\n=== Done ===");
}

main().catch(console.error);
