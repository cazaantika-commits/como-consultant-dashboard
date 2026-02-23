import { google } from 'googleapis';

const serviceAccountKey = JSON.parse(
  Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_KEY, 'base64').toString('utf-8')
);
const auth = new google.auth.GoogleAuth({
  credentials: serviceAccountKey,
  scopes: ['https://www.googleapis.com/auth/drive'],
});

const drive = google.drive({ version: 'v3', auth });

// Project mapping
const projects = {
  'Al-Jadaf_3260885_G+7_RES_PCA': { code: 'JAD', plot: '3260885' },
  'Majan_6457879_G+4P+25_Comm-Res_PCA': { code: 'MAJ-R', plot: '6457879' },
  'Majan_6457956_G+4_Mall_PCA': { code: 'MAJ-M', plot: '6457956' },
  'Nad-Al-Sheba_6180578_G+1_VILLA_AP_PCA': { code: 'NAS-V', plot: '6180578' },
  'Nad-Al-Sheba_6182776_G+2P+6_APARTMENT_PCA': { code: 'NAS-RA', plot: '6182776' },
  'Nad-Al-Sheba_6185392_G+2P+6_Res-Ret_PCA': { code: 'NAS-R', plot: '6185392' },
};

// Consultant mapping
const consultants = {
  'OSU': 'Osu',
  'REAL': 'Realistic',
  'DAT': 'Datum',
  'SAF': 'Safeer',
  'LAC': 'Lac',
  'Tarmak': 'Tarmak',
  'Trans': 'Trans',
  'A-B': 'A-B',
  'COL': 'Col',
};

async function findFolder(name) {
  const response = await drive.files.list({
    q: `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id, name)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  return response.data.files[0];
}

async function createFolder(name, parentId) {
  const response = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    },
    fields: 'id, name',
    supportsAllDrives: true,
  });
  return response.data;
}

async function listFolderContents(folderId) {
  const response = await drive.files.list({
    q: `'${folderId}' in parents and trashed=false`,
    fields: 'files(id, name, mimeType)',
    pageSize: 1000,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  return response.data.files || [];
}

async function moveFile(fileId, newParentId, oldParentId) {
  await drive.files.update({
    fileId,
    addParents: newParentId,
    removeParents: oldParentId,
    supportsAllDrives: true,
  });
}

async function renameFile(fileId, newName) {
  await drive.files.update({
    fileId,
    requestBody: { name: newName },
    supportsAllDrives: true,
  });
}

function parseFileName(name) {
  // Extract info from filename like: JAD_3260885_PRO_20260209_OSU.pdf
  const parts = name.split('_');
  if (parts.length < 3) return null;
  
  const code = parts[0];
  const plot = parts[1];
  let type = parts[2];
  let date = '';
  let consultant = '';
  
  // Find date (8 digits)
  for (let i = 3; i < parts.length; i++) {
    if (/^\d{8}$/.test(parts[i])) {
      date = parts[i];
    } else if (parts[i].length > 0 && !parts[i].includes('.')) {
      consultant = parts[i];
    }
  }
  
  return { code, plot, type, date, consultant };
}

function buildNewName(info, consultant) {
  // Format: ProjectCode_PlotNumber_Type_Date_Consultant_Version.ext
  const cons = consultants[consultant] || consultant;
  return `${info.code}_${info.plot}_${info.type}_${info.date}_${cons}_V1.pdf`;
}

async function main() {
  console.log('🚀 Starting full Drive reorganization...\n');
  
  // Find main folder
  const mainFolder = await findFolder('01. COMO _Projects Management');
  if (!mainFolder) {
    console.log('❌ Main folder not found');
    return;
  }
  console.log(`✅ Found main folder: ${mainFolder.id}\n`);
  
  // Find old proposals folder
  const oldFolder = await findFolder('02_Proposals, Contracts & Agreements');
  if (!oldFolder) {
    console.log('❌ Old folder not found');
    return;
  }
  console.log(`📁 Found old folder: ${oldFolder.id}\n`);
  
  const contents = await listFolderContents(oldFolder.id);
  console.log(`📊 Found ${contents.length} items\n`);
  
  let stats = { moved: 0, renamed: 0, created: 0 };
  
  for (const item of contents) {
    if (item.mimeType !== 'application/vnd.google-apps.folder') {
      console.log(`⏭️  Skipping file: ${item.name}`);
      continue;
    }
    
    const projectInfo = projects[item.name];
    if (!projectInfo) {
      console.log(`⚠️  Unknown project: ${item.name}`);
      continue;
    }
    
    console.log(`\n📂 Processing: ${item.name}`);
    console.log(`   Code: ${projectInfo.code}, Plot: ${projectInfo.plot}`);
    
    // Create or find project folder
    let projectFolder = await findFolder(item.name.replace('_PCA', ''));
    if (!projectFolder) {
      projectFolder = await createFolder(item.name.replace('_PCA', ''), mainFolder.id);
      console.log(`   ✅ Created project folder: ${projectFolder.id}`);
      stats.created++;
    }
    
    // Create 02_Proposals and 05_Contracts subfolders
    let proposalsFolder = await findFolder('02_Proposals');
    if (!proposalsFolder) {
      proposalsFolder = await createFolder('02_Proposals', projectFolder.id);
      console.log(`   ✅ Created 02_Proposals`);
      stats.created++;
    }
    
    let contractsFolder = await findFolder('05_Contracts');
    if (!contractsFolder) {
      contractsFolder = await createFolder('05_Contracts', projectFolder.id);
      console.log(`   ✅ Created 05_Contracts`);
      stats.created++;
    }
    
    // Process files in project folder
    const projectFiles = await listFolderContents(item.id);
    console.log(`   📄 Found ${projectFiles.length} files`);
    
    for (const file of projectFiles) {
      if (file.mimeType === 'application/vnd.google-apps.folder') continue;
      
      const info = parseFileName(file.name);
      if (!info) {
        console.log(`      ⚠️  Cannot parse: ${file.name}`);
        continue;
      }
      
      // Determine if proposal or contract
      const isContract = file.name.includes('NOV') || file.name.includes('Contract') || file.name.includes('Agreement');
      const targetFolder = isContract ? contractsFolder : proposalsFolder;
      const targetType = isContract ? 'Contracts' : 'Proposals';
      
      // Build new name
      const newName = buildNewName(info, info.consultant);
      
      console.log(`      📝 ${file.name}`);
      console.log(`         → ${newName}`);
      console.log(`         → Moving to ${targetType}`);
      
      // Rename and move
      await renameFile(file.id, newName);
      await moveFile(file.id, targetFolder.id, item.id);
      
      stats.renamed++;
      stats.moved++;
    }
  }
  
  console.log(`\n✅ Reorganization complete!`);
  console.log(`   Created folders: ${stats.created}`);
  console.log(`   Renamed files: ${stats.renamed}`);
  console.log(`   Moved files: ${stats.moved}`);
}

main().catch(console.error);
