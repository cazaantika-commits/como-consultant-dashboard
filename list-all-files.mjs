import { google } from 'googleapis';

const serviceAccountKey = JSON.parse(
  Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_KEY, 'base64').toString('utf-8')
);
const auth = new google.auth.GoogleAuth({
  credentials: serviceAccountKey,
  scopes: ['https://www.googleapis.com/auth/drive'],
});

const drive = google.drive({ version: 'v3', auth });

async function listAllFiles(folderId, path = '', depth = 0) {
  const response = await drive.files.list({
    q: `'${folderId}' in parents and trashed=false`,
    fields: 'files(id, name, mimeType)',
    pageSize: 1000,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    orderBy: 'name',
  });
  
  const files = [];
  for (const item of response.data.files || []) {
    const currentPath = path ? `${path}/${item.name}` : item.name;
    
    if (item.mimeType === 'application/vnd.google-apps.folder') {
      // Recursively list folder contents
      const subFiles = await listAllFiles(item.id, currentPath, depth + 1);
      files.push(...subFiles);
    } else {
      files.push({
        id: item.id,
        name: item.name,
        path: currentPath,
        parentPath: path,
      });
    }
  }
  
  return files;
}

async function main() {
  // Find main folder
  const searchResponse = await drive.files.list({
    q: `name='01. COMO _Projects Management' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id, name)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  
  const mainFolder = searchResponse.data.files[0];
  if (!mainFolder) {
    console.log('Main folder not found');
    return;
  }
  
  console.log('📋 Listing all files in Drive...\n');
  const allFiles = await listAllFiles(mainFolder.id, '01. COMO _Projects Management');
  
  console.log(`Total files: ${allFiles.length}\n`);
  console.log('='.repeat(100));
  
  for (let i = 0; i < allFiles.length; i++) {
    const file = allFiles[i];
    console.log(`\n[${i + 1}/${allFiles.length}]`);
    console.log(`Path: ${file.parentPath}`);
    console.log(`File: ${file.name}`);
    console.log(`ID: ${file.id}`);
  }
}

main().catch(console.error);
