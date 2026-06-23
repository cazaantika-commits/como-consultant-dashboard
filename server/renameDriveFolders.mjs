/**
 * Rename Drive folders and files according to the Archiving Constitution
 * 
 * Phase 1: Rename top-level folders
 * Phase 2: Rename files in Land Info
 * Phase 3: Move La Casa attachments to Company-Profiles
 */

import { google } from "googleapis";

function getCredentials() {
  const base64Key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!base64Key) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY not set");
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

async function renameFile(fileId, newName) {
  await drive.files.update({
    fileId,
    requestBody: { name: newName },
    supportsAllDrives: true,
  });
  console.log(`  ✅ Renamed → ${newName}`);
}

async function moveFile(fileId, newParentId, currentParentId) {
  await drive.files.update({
    fileId,
    addParents: newParentId,
    removeParents: currentParentId,
    supportsAllDrives: true,
  });
  console.log(`  ✅ Moved to new parent`);
}

async function createFolder(name, parentId) {
  const res = await drive.files.create({
    requestBody: {
      name,
      mimeType: FOLDER_MIME,
      parents: [parentId],
    },
    fields: "id, name",
    supportsAllDrives: true,
  });
  console.log(`  ✅ Created folder: ${name} (${res.data.id})`);
  return res.data;
}

// ═══════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════

const COMO_MAIN_ID = "1PLhYCKU08CMKJWfPK44IjNAw_V3oOawD";
const COMPANY_PROFILES_ID = "1QLdipboMCnFxrW9Qnpw8i9JU9RqAhIsd";

async function main() {
  console.log("🔄 Starting folder and file renaming...\n");
  
  const mainContents = await listInFolder(COMO_MAIN_ID);
  
  // ═══ PHASE 1: Rename top-level folders ═══
  console.log("═══ Phase 1: Rename top-level folders ═══\n");
  
  const folderRenames = {
    "00_Land & Plots Info": "00_Land-Info",
    "01_Studies & Feasibility": "01_Feasibility",
    // 02_Proposals already correct
    "03_AUTHORITIES_&_APPROVALS": "03_Authorities",
    "04_Design & Drawings": "04_Design",
    "05_COSTING_&_FINANCE": "05_Contracts",
    "06_CONSTRUCTION_PROGRESS": "06_Construction",
    "07_COMMUNICATIONS_&_MEETINGS": "07_Communications",
    "08_FINAL_DELIVERY_&_CLOSURE": "08_Delivery",
    "PROJECT_SUMMARY_&_TRACKING": "09_Summary",
  };
  
  for (const item of mainContents) {
    if (item.mimeType === FOLDER_MIME && folderRenames[item.name]) {
      console.log(`📁 ${item.name} → ${folderRenames[item.name]}`);
      await renameFile(item.id, folderRenames[item.name]);
    }
  }
  
  // ═══ PHASE 2: Rename Land Info subfolders and files ═══
  console.log("\n═══ Phase 2: Rename Land Info subfolders and files ═══\n");
  
  const landInfoFolder = mainContents.find(f => f.name === "00_Land & Plots Info" || f.name === "00_Land-Info");
  if (landInfoFolder) {
    const landContents = await listInFolder(landInfoFolder.id);
    
    // Rename subfolders
    const landSubRenames = {
      "01. Affection Plans": "01_Affection-Plans",
      "02. Lands Tittle Deed & Documents": "02_Title-Deeds",
      "03. Plots Guidelines": "03_Plot-Guidelines",
    };
    
    for (const sub of landContents) {
      if (sub.mimeType === FOLDER_MIME && landSubRenames[sub.name]) {
        console.log(`📁 ${sub.name} → ${landSubRenames[sub.name]}`);
        await renameFile(sub.id, landSubRenames[sub.name]);
      }
    }
    
    // Rename files inside each subfolder
    for (const sub of landContents) {
      if (sub.mimeType !== FOLDER_MIME) continue;
      
      const subFiles = await listInFolder(sub.id);
      for (const file of subFiles) {
        if (file.mimeType === FOLDER_MIME) continue;
        
        const oldName = file.name;
        let newName = null;
        
        // Affection Plans
        if (sub.name.includes("Affection") || sub.name.includes("01")) {
          if (oldName.includes("6185392")) {
            newName = "Nas-R_6185392_Ap_V1.pdf";
          } else if (oldName.includes("6457956")) {
            newName = "Maj-M_6457956_Ap_V1.pdf";
          } else if (oldName.includes("6180578")) {
            newName = "Nas-V_6180578_Ap_V1.pdf";
          } else if (oldName.includes("3260885")) {
            newName = "Jad_3260885_Ap_V1.pdf";
          } else if (oldName.includes("6457879")) {
            newName = "Maj-R_6457879_Ap_V1.pdf";
          }
        }
        
        // Title Deeds
        if (sub.name.includes("Tittle") || sub.name.includes("Title") || sub.name.includes("02")) {
          if (oldName.includes("6182776")) {
            newName = "Nas-A_6182776_Td_V1.pdf";
          } else if (oldName.includes("3260885")) {
            newName = "Jad_3260885_Td_V1.pdf";
          } else if (oldName.includes("6457956")) {
            newName = "Maj-M_6457956_Td_V1.pdf";
          }
        }
        
        // Plot Guidelines
        if (sub.name.includes("Guidelines") || sub.name.includes("03")) {
          if (oldName.includes("6457879")) {
            newName = "Maj-R_6457879_Pdg_V1.pdf";
          } else if (oldName.includes("6185392")) {
            newName = "Nas-R_6185392_Pdg_V1.pdf";
          }
        }
        
        if (newName && newName !== oldName) {
          console.log(`📄 ${oldName}`);
          console.log(`   → ${newName}`);
          await renameFile(file.id, newName);
        }
      }
    }
  }
  
  // ═══ PHASE 3: Find and move La Casa attachments to Company-Profiles ═══
  console.log("\n═══ Phase 3: Move consultant profile files ═══\n");
  
  // Find the Lac folder in Company-Profiles
  const profileContents = await listInFolder(COMPANY_PROFILES_ID);
  const lacFolder = profileContents.find(f => f.name === "Lac");
  
  if (lacFolder) {
    console.log(`📁 Lac folder found: ${lacFolder.id}`);
    
    // Search for La Casa attachment files in proposals
    const proposalsFolder = mainContents.find(f => f.name === "02_Proposals");
    if (proposalsFolder) {
      const proposalContents = await listInFolder(proposalsFolder.id);
      
      for (const projFolder of proposalContents) {
        if (projFolder.mimeType !== FOLDER_MIME) continue;
        const projFiles = await listInFolder(projFolder.id);
        
        // Look for consultant-specific folders (like La Casa attachments)
        for (const item of projFiles) {
          if (item.mimeType === FOLDER_MIME && (item.name.includes("Lac") || item.name.includes("La Casa") || item.name.includes("lac"))) {
            console.log(`📁 Found La Casa folder in ${projFolder.name}: ${item.name}`);
            const lacFiles = await listInFolder(item.id);
            for (const lacFile of lacFiles) {
              if (lacFile.mimeType !== FOLDER_MIME) {
                console.log(`  📄 ${lacFile.name} - moving to Company-Profiles/Lac`);
                await moveFile(lacFile.id, lacFolder.id, item.id);
              }
            }
          }
        }
      }
    }
  }
  
  // ═══ PHASE 4: Rename Feasibility subfolders ═══
  console.log("\n═══ Phase 4: Rename Feasibility subfolders ═══\n");
  
  const feasFolder = mainContents.find(f => f.name === "01_Studies & Feasibility" || f.name === "01_Feasibility");
  if (feasFolder) {
    const feasContents = await listInFolder(feasFolder.id);
    
    const feasRenames = {
      "Nad-Al-Sheba_6180578_G+1_VILLA_FS": "Nas-V_6180578_Feasibility",
      "Majan_6457879_G+4P+25_Comm-Res_FS": "Maj-R_6457879_Feasibility",
      "Al-Jadaf_3260885_G+7_RES_FS": "Jad_3260885_Feasibility",
      "Nad-Al-Sheba_6185392_G+2P+6_Res-Ret_FS": "Nas-R_6185392_Feasibility",
      "Majan_6457956_G+4_Mall_FS": "Maj-M_6457956_Feasibility",
    };
    
    for (const sub of feasContents) {
      if (sub.mimeType === FOLDER_MIME && feasRenames[sub.name]) {
        console.log(`📁 ${sub.name} → ${feasRenames[sub.name]}`);
        await renameFile(sub.id, feasRenames[sub.name]);
      }
    }
  }
  
  // ═══ PHASE 5: Rename Design subfolders ═══
  console.log("\n═══ Phase 5: Rename Design subfolders ═══\n");
  
  const designFolder = mainContents.find(f => f.name === "04_Design & Drawings" || f.name === "04_Design");
  if (designFolder) {
    const designContents = await listInFolder(designFolder.id);
    
    const designRenames = {
      "Nad-Al-Sheba_6185392_G+2P+6_Res-Ret_DD": "Nas-R_6185392_Design",
      "Nad-Al-Sheba_6180578_G+1_VILLA_DD": "Nas-V_6180578_Design",
      "Al-Jadaf_3260885_G+7_RES_DD": "Jad_3260885_Design",
    };
    
    for (const sub of designContents) {
      if (sub.mimeType === FOLDER_MIME && designRenames[sub.name]) {
        console.log(`📁 ${sub.name} → ${designRenames[sub.name]}`);
        await renameFile(sub.id, designRenames[sub.name]);
      }
    }
  }
  
  console.log("\n✅ All renaming complete!");
}

main().catch(err => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
