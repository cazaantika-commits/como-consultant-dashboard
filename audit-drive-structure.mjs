import { google } from 'googleapis';
import { readFileSync } from 'fs';

const serviceAccountKey = JSON.parse(
  Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_KEY, 'base64').toString('utf-8')
);
const auth = new google.auth.GoogleAuth({
  credentials: serviceAccountKey,
  scopes: ['https://www.googleapis.com/auth/drive'],
});

const drive = google.drive({ version: 'v3', auth });

async function listFolderContents(folderId, folderName = '', indent = 0) {
  try {
    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields: 'files(id, name, mimeType, parents)',
      pageSize: 1000,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    const files = response.data.files || [];
    const prefix = '  '.repeat(indent);
    
    console.log(`${prefix}📁 ${folderName} (${files.length} items)`);
    
    for (const file of files) {
      const icon = file.mimeType === 'application/vnd.google-apps.folder' ? '📁' : '📄';
      console.log(`${prefix}  ${icon} ${file.name}`);
      
      if (file.mimeType === 'application/vnd.google-apps.folder') {
        await listFolderContents(file.id, file.name, indent + 2);
      }
    }
    
    return files;
  } catch (error) {
    console.error(`Error listing ${folderName}:`, error.message);
    return [];
  }
}

async function main() {
  console.log('🔍 Auditing Google Drive Structure...\n');
  
  // Start from root: 01. COMO _Projects Management
  const rootFolderId = '1ZXzOEs-ITzUF6-r-Ii2cd7iRxBM1gGC7'; // Ready folder ID as reference
  
  // Search for main project folder
  const searchResponse = await drive.files.list({
    q: `name contains 'COMO' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id, name, mimeType)',
    pageSize: 20,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  
  console.log('Found folders:');
  for (const folder of searchResponse.data.files) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📂 ${folder.name} (${folder.id})`);
    console.log(`${'='.repeat(60)}\n`);
    await listFolderContents(folder.id, folder.name);
  }
}

main().catch(console.error);
