import { google } from 'googleapis';

const serviceAccountKey = JSON.parse(
  Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_KEY, 'base64').toString('utf-8')
);
const auth = new google.auth.GoogleAuth({
  credentials: serviceAccountKey,
  scopes: ['https://www.googleapis.com/auth/drive'],
});

const drive = google.drive({ version: 'v3', auth });

// Naming convention: ProjectCode_PlotNumber_Category_Date_Consultant_Version
const CATEGORY_MAP = {
  'FEAS': 'Feasibility Study',
  'PRO-ENG': 'Engineering Proposal',
  'PRO-ARCH': 'Architecture Proposal',
  'CONTRACT': 'Contract',
  'REPORT': 'Report',
  'CALC': 'Calculation',
  'SCREEN': 'Screenshot',
  'RFP': 'Request for Proposal',
};

async function listAllFiles(folderId) {
  const files = [];
  let pageToken = null;
  
  do {
    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields: 'nextPageToken, files(id, name, mimeType, parents)',
      pageSize: 1000,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    
    files.push(...(response.data.files || []));
    pageToken = response.data.nextPageToken;
  } while (pageToken);
  
  return files;
}

async function renameFile(fileId, newName) {
  try {
    await drive.files.update({
      fileId,
      requestBody: { name: newName },
      supportsAllDrives: true,
    });
    console.log(`✅ Renamed: ${newName}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to rename ${fileId}:`, error.message);
    return false;
  }
}

async function moveFile(fileId, newParentId, oldParentId) {
  try {
    await drive.files.update({
      fileId,
      addParents: newParentId,
      removeParents: oldParentId,
      supportsAllDrives: true,
    });
    console.log(`✅ Moved file ${fileId} to ${newParentId}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to move ${fileId}:`, error.message);
    return false;
  }
}

async function main() {
  console.log('🔄 Starting Drive reorganization...\n');
  
  // Search for 05_Proposals_&_Contracts folder
  const searchResponse = await drive.files.list({
    q: `name contains 'Proposals' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id, name, parents)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  
  console.log('Found folders:', searchResponse.data.files.map(f => f.name));
  
  if (searchResponse.data.files.length === 0) {
    console.log('❌ Proposals folder not found');
    return;
  }
  
  const proposalsFolder = searchResponse.data.files[0];
  console.log(`📁 Found Proposals folder: ${proposalsFolder.id}\n`);
  
  // List all files in Proposals folder
  const files = await listAllFiles(proposalsFolder.id);
  console.log(`📊 Found ${files.length} items in Proposals folder\n`);
  
  let renamedCount = 0;
  let movedCount = 0;
  
  for (const file of files) {
    if (file.mimeType === 'application/vnd.google-apps.folder') {
      console.log(`📁 Skipping folder: ${file.name}`);
      continue;
    }
    
    // Check if file is already properly named
    const parts = file.name.split('_');
    if (parts.length >= 4 && /^\d{6,7}$/.test(parts[1])) {
      console.log(`✓ Already properly named: ${file.name}`);
      continue;
    }
    
    // Try to extract project info from filename
    const plotMatch = file.name.match(/(\d{6,7})/);
    if (!plotMatch) {
      console.log(`⚠️  Cannot extract plot number from: ${file.name}`);
      continue;
    }
    
    const plotNumber = plotMatch[1];
    
    // Determine category
    let category = 'DOC';
    for (const [key, value] of Object.entries(CATEGORY_MAP)) {
      if (file.name.toUpperCase().includes(key)) {
        category = key;
        break;
      }
    }
    
    // Extract consultant name if possible
    let consultant = 'Unknown';
    if (file.name.includes('XYZ')) consultant = 'XYZ';
    else if (file.name.includes('Al Sarh') || file.name.includes('al sarah')) consultant = 'AlSarh';
    else if (file.name.includes('Alaalamia')) consultant = 'Alaalamia';
    
    // Get file extension
    const ext = file.name.split('.').pop();
    
    // Generate new name
    const projectCode = plotNumber.substring(0, 3);
    const newName = `${projectCode}_${plotNumber}_${category}_${consultant}_V1.${ext}`;
    
    console.log(`\n📝 Renaming:`);
    console.log(`   Old: ${file.name}`);
    console.log(`   New: ${newName}`);
    
    const success = await renameFile(file.id, newName);
    if (success) renamedCount++;
  }
  
  console.log(`\n✅ Reorganization complete!`);
  console.log(`   Renamed: ${renamedCount} files`);
  console.log(`   Moved: ${movedCount} files`);
}

main().catch(console.error);
