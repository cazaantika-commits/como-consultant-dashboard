import { google } from "googleapis";
import { readFileSync } from "fs";

// Load credentials
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
const FOLDER_MIME = "application/vnd.google-apps.folder";

// ===== KEY IDs =====
const FOLDER_01_ID = "1zLYOlwzVJSx7rN7TN1XycEzGv_cdH_J6"; // 01. COMO - Project Management
const FOLDER_02_ID = "1PLhYCKU08CMKJWfPK44IjNAw_V3oOawD"; // 02. REAL_ESTATE_PROJECTS

// Source projects in folder 01
const SOURCE_PROJECTS = {
  "Project - Al Jaddaf": "1g-LYQ80ZJgnDZLyUyyPrVYyEh9iYa8Hh",
  "Project - Majan Building": "1NANdwCiiAFqycutP-1DIsiainp6dDhBp",
  "Project - Mall": "118ZMeT3svs9juwfl6zZSqoSMoRA24AYB",
  "Project - Nad Al Sheba": "1VYN22Mt7c8VW7wc6VctdszghI2IjpGth",
  "Project - Nad Al Sheba المدمجة": "1YeSQ3jVEiNQowp3LeQ7pO6pjIJMo8XfN",
  "Project - Villas": "1QvIk9rTeFmatkGjEhKf9GrmCrXkKDPjb",
};

// Destination projects in folder 02
const DEST_PROJECTS = {
  "PROJECT_P001_AL_JADDAF": "16UED_XcSJb7q_wlI6QHiqeKCtg-qRazk",
  "PROJECT_P002_MAJAN_BUILDING": "1BXACPZnj_CzO5mCSbwoGm07GmjFIdlj1",
};

// Mapping: source project name -> destination project name
const PROJECT_MAPPING = {
  "Project - Al Jaddaf": "PROJECT_P001_AL_JADDAF",
  "Project - Majan Building": "PROJECT_P002_MAJAN_BUILDING",
  "Project - Villas": "PROJECT_P001_NAD_AL_SHIBA_VILLAS", // Villas = Nad Al Shiba Villas
  "Project - Nad Al Sheba": "PROJECT_P003_NAD_AL_SHEBA",
  "Project - Nad Al Sheba المدمجة": "PROJECT_P003_NAD_AL_SHEBA", // merged into same
  "Project - Mall": "PROJECT_P004_MALL",
};

// Subfolder mapping: source subfolder name -> destination subfolder pattern
const SUBFOLDER_MAPPING = {
  "00 - Land Ownership & Plot Info": "00_LAND_OWNERSHIP_&_PLOT_INFO",
  "01 - Studies & Feasibility": "01_STUDIES_&_FEASIBILITY",
  "02 - Design & Drawings": "02_DESIGN_&_DRAWINGS",
  "03 - Authorities & Approvals": "03_AUTHORITIES_&_APPROVALS",
  "04 - Contracts & Agreements": "04_CONTRACTS_&_AGREEMENTS",
  "05 - Costing & Finance": "05_COSTING_&_FINANCE",
  "06 - Sales & Marketing": "06_SALES_&_MARKETING",
  "07 - Operations & Management": "07_OPERATIONS_&_MANAGEMENT",
  "08 - Archive": "08_FINAL_DELIVERY_&_CLOSURE",
  "08 - Archive ​": "08_FINAL_DELIVERY_&_CLOSURE",
};

// Sub-subfolder mapping for design drawings
const DESIGN_SUBFOLDER_MAPPING = {
  "Consultant - Al Sarh - Concept Design": "ARCHITECTURAL_DRAWINGS",
  "Consultant - Al Alamia - Concept Design": "ARCHITECTURAL_DRAWINGS",
  "Consultant - Alaalamia - Concept Design": "ARCHITECTURAL_DRAWINGS",
  "Soil Investigation & Reports": "ENGINEERING_STUDIES",
};

// Sub-subfolder mapping for contracts
const CONTRACT_SUBFOLDER_MAPPING = {
  "Consultants Proposals": "CONSULTANT_EVALUATION",
  "Consultants Proposal": "CONSULTANT_EVALUATION",
  "Master Developer Contract": "LAND_PURCHASE_AGREEMENTS",
};

let copyCount = 0;
let errorCount = 0;
let skipCount = 0;

async function listFolder(folderId) {
  const allFiles = [];
  let pageToken = undefined;
  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: "nextPageToken, files(id, name, mimeType, size)",
      pageSize: 200,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    allFiles.push(...(res.data.files || []));
    pageToken = res.data.nextPageToken;
  } while (pageToken);
  return allFiles;
}

async function findOrCreateFolder(name, parentId) {
  // Check if folder already exists
  const res = await drive.files.list({
    q: `'${parentId}' in parents and name = '${name.replace(/'/g, "\\'")}' and mimeType = '${FOLDER_MIME}' and trashed = false`,
    fields: "files(id, name)",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  
  if (res.data.files && res.data.files.length > 0) {
    return res.data.files[0].id;
  }
  
  // Create folder
  const createRes = await drive.files.create({
    requestBody: {
      name,
      mimeType: FOLDER_MIME,
      parents: [parentId],
    },
    fields: "id",
    supportsAllDrives: true,
  });
  console.log(`  📁 Created folder: ${name}`);
  return createRes.data.id;
}

async function findSubfolder(parentId, subfolderName) {
  const res = await drive.files.list({
    q: `'${parentId}' in parents and name = '${subfolderName.replace(/'/g, "\\'")}' and mimeType = '${FOLDER_MIME}' and trashed = false`,
    fields: "files(id, name)",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  return res.data.files?.[0]?.id || null;
}

async function checkFileExists(name, parentId) {
  const res = await drive.files.list({
    q: `'${parentId}' in parents and name = '${name.replace(/'/g, "\\'")}' and trashed = false`,
    fields: "files(id)",
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  return res.data.files && res.data.files.length > 0;
}

async function copyFile(fileId, fileName, destFolderId) {
  // Check if file already exists in destination
  const exists = await checkFileExists(fileName, destFolderId);
  if (exists) {
    console.log(`    ⏭️  Skip (exists): ${fileName}`);
    skipCount++;
    return;
  }
  
  try {
    await drive.files.copy({
      fileId,
      requestBody: {
        name: fileName,
        parents: [destFolderId],
      },
      supportsAllDrives: true,
    });
    console.log(`    ✅ Copied: ${fileName}`);
    copyCount++;
  } catch (err) {
    console.log(`    ❌ Error copying ${fileName}: ${err.message}`);
    errorCount++;
  }
}

async function copyFilesFromFolder(sourceFolderId, destFolderId, depth = 0) {
  const items = await listFolder(sourceFolderId);
  
  for (const item of items) {
    if (item.mimeType === FOLDER_MIME) {
      // It's a subfolder - try to find matching destination
      const destSubName = DESIGN_SUBFOLDER_MAPPING[item.name] || 
                          CONTRACT_SUBFOLDER_MAPPING[item.name] || 
                          item.name;
      
      // Try to find the subfolder in destination, or create it
      let destSubId = await findSubfolder(destFolderId, destSubName);
      if (!destSubId) {
        destSubId = await findOrCreateFolder(destSubName, destFolderId);
      }
      
      console.log(`  ${"  ".repeat(depth)}📁 ${item.name} -> ${destSubName}`);
      await copyFilesFromFolder(item.id, destSubId, depth + 1);
    } else {
      // It's a file - copy it
      await copyFile(item.id, item.name, destFolderId);
    }
  }
}

async function processProject(sourceName, sourceId, destProjectId) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`📂 Processing: ${sourceName}`);
  console.log(`${"=".repeat(60)}`);
  
  const sourceSubfolders = await listFolder(sourceId);
  
  for (const sub of sourceSubfolders) {
    if (sub.mimeType === FOLDER_MIME) {
      // Map source subfolder to destination subfolder
      const destSubName = SUBFOLDER_MAPPING[sub.name] || SUBFOLDER_MAPPING[sub.name.trim()] || sub.name;
      
      // Find the destination subfolder
      let destSubId = await findSubfolder(destProjectId, destSubName);
      if (!destSubId) {
        destSubId = await findOrCreateFolder(destSubName, destProjectId);
      }
      
      console.log(`\n  📁 ${sub.name} -> ${destSubName}`);
      await copyFilesFromFolder(sub.id, destSubId);
    } else {
      // Root-level file in project folder
      await copyFile(sub.id, sub.name, destProjectId);
    }
  }
}

async function main() {
  console.log("🚀 بدء عملية نسخ الملفات من مجلد 01 إلى مجلد 02\n");
  console.log(`المصدر: 01. COMO - Project Management`);
  console.log(`الوجهة: 02. REAL_ESTATE_PROJECTS\n`);
  
  // Step 1: Create missing project folders in folder 02
  for (const [sourceName, destName] of Object.entries(PROJECT_MAPPING)) {
    if (!DEST_PROJECTS[destName]) {
      // Need to create this project folder
      const newId = await findOrCreateFolder(destName, FOLDER_02_ID);
      DEST_PROJECTS[destName] = newId;
      console.log(`📁 Project folder ready: ${destName} (${newId})`);
      
      // Create standard subfolder structure
      const standardSubfolders = [
        "00_LAND_OWNERSHIP_&_PLOT_INFO",
        "01_STUDIES_&_FEASIBILITY",
        "02_DESIGN_&_DRAWINGS",
        "03_AUTHORITIES_&_APPROVALS",
        "04_CONTRACTS_&_AGREEMENTS",
        "05_COSTING_&_FINANCE",
        "06_SALES_&_MARKETING",
        "07_OPERATIONS_&_MANAGEMENT",
        "08_FINAL_DELIVERY_&_CLOSURE",
        "PROJECT_SUMMARY_&_TRACKING",
      ];
      
      for (const sf of standardSubfolders) {
        await findOrCreateFolder(sf, newId);
      }
    } else {
      console.log(`📁 Project folder exists: ${destName}`);
    }
  }
  
  // Step 2: Copy files from each source project to destination
  for (const [sourceName, sourceId] of Object.entries(SOURCE_PROJECTS)) {
    const destName = PROJECT_MAPPING[sourceName];
    if (!destName) {
      console.log(`\n⚠️ No mapping for: ${sourceName}, skipping`);
      continue;
    }
    const destId = DEST_PROJECTS[destName];
    if (!destId) {
      console.log(`\n⚠️ No destination folder for: ${destName}, skipping`);
      continue;
    }
    await processProject(sourceName, sourceId, destId);
  }
  
  // Step 3: Copy files from "01. COMO" folder (contracts, plots, etc.)
  const comoFolderId = "1m5O5-F-7xBy7LutPmXHjQ1VwLeissutc";
  console.log(`\n${"=".repeat(60)}`);
  console.log(`📂 Processing: 01. COMO (general files)`);
  console.log(`${"=".repeat(60)}`);
  
  const comoItems = await listFolder(comoFolderId);
  for (const item of comoItems) {
    if (item.mimeType === FOLDER_MIME) {
      if (item.name === "contracts") {
        // Copy contracts to relevant project folders
        console.log(`\n  📁 Copying contracts...`);
        const contractFiles = await listFolder(item.id);
        for (const cf of contractFiles) {
          if (cf.mimeType !== FOLDER_MIME) {
            // Determine which project this contract belongs to
            const fileName = cf.name.toLowerCase();
            let destProjectId;
            if (fileName.includes("jaddaf") || fileName.includes("jadaf")) {
              destProjectId = DEST_PROJECTS["PROJECT_P001_AL_JADDAF"];
            } else if (fileName.includes("majan")) {
              destProjectId = DEST_PROJECTS["PROJECT_P002_MAJAN_BUILDING"];
            } else if (fileName.includes("nad al shiba") || fileName.includes("nad al sheba") || fileName.includes("1924") || fileName.includes("2153") || fileName.includes("6180578") || fileName.includes("6185392")) {
              destProjectId = DEST_PROJECTS["PROJECT_P003_NAD_AL_SHEBA"] || DEST_PROJECTS["PROJECT_P001_NAD_AL_SHIBA_VILLAS"];
            }
            
            if (destProjectId) {
              const contractsFolderId = await findSubfolder(destProjectId, "04_CONTRACTS_&_AGREEMENTS");
              if (contractsFolderId) {
                const landPurchaseId = await findSubfolder(contractsFolderId, "LAND_PURCHASE_AGREEMENTS");
                if (landPurchaseId) {
                  await copyFile(cf.id, cf.name, landPurchaseId);
                } else {
                  await copyFile(cf.id, cf.name, contractsFolderId);
                }
              }
            }
          }
        }
      } else if (item.name === "PLOTS DETAILS") {
        console.log(`\n  📁 Copying plot details...`);
        const plotFiles = await listFolder(item.id);
        for (const pf of plotFiles) {
          if (pf.mimeType !== FOLDER_MIME) {
            const fileName = pf.name.toLowerCase();
            let destProjectId;
            if (fileName.includes("3260885")) {
              destProjectId = DEST_PROJECTS["PROJECT_P001_AL_JADDAF"];
            } else if (fileName.includes("6180578")) {
              destProjectId = DEST_PROJECTS["PROJECT_P001_NAD_AL_SHIBA_VILLAS"] || DEST_PROJECTS["PROJECT_P003_NAD_AL_SHEBA"];
            } else if (fileName.includes("6185392")) {
              destProjectId = DEST_PROJECTS["PROJECT_P003_NAD_AL_SHEBA"];
            } else if (fileName.includes("6457879") || fileName.includes("6182776")) {
              destProjectId = DEST_PROJECTS["PROJECT_P003_NAD_AL_SHEBA"];
            }
            
            if (destProjectId) {
              const landFolderId = await findSubfolder(destProjectId, "00_LAND_OWNERSHIP_&_PLOT_INFO");
              if (landFolderId) {
                const plotDetailsId = await findSubfolder(landFolderId, "PLOT_DETAILS");
                if (plotDetailsId) {
                  await copyFile(pf.id, pf.name, plotDetailsId);
                } else {
                  await copyFile(pf.id, pf.name, landFolderId);
                }
              }
            }
          }
        }
      }
    }
  }
  
  console.log(`\n${"=".repeat(60)}`);
  console.log(`✅ عملية النسخ اكتملت!`);
  console.log(`${"=".repeat(60)}`);
  console.log(`📊 الملخص:`);
  console.log(`   ✅ ملفات تم نسخها: ${copyCount}`);
  console.log(`   ⏭️  ملفات تم تخطيها (موجودة): ${skipCount}`);
  console.log(`   ❌ أخطاء: ${errorCount}`);
  console.log(`   📁 إجمالي العمليات: ${copyCount + skipCount + errorCount}`);
}

main().catch(console.error);
