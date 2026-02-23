import { google } from 'googleapis';

const serviceAccountKey = JSON.parse(
  Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_KEY, 'base64').toString('utf-8')
);
const auth = new google.auth.GoogleAuth({
  credentials: serviceAccountKey,
  scopes: ['https://www.googleapis.com/auth/drive'],
});

const drive = google.drive({ version: 'v3', auth });

async function listFolderContents(folderId, depth = 0) {
  const response = await drive.files.list({
    q: `'${folderId}' in parents and trashed=false`,
    fields: 'files(id, name, mimeType, size, modifiedTime)',
    pageSize: 1000,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    orderBy: 'name',
  });

  return response.data.files || [];
}

async function main() {
  console.log('🔍 Searching for العقود والعروض folder...\n');
  
  // Search for the folder
  const searchResponse = await drive.files.list({
    q: `(name contains 'عقود' or name contains 'عروض' or name contains 'Contracts' or name contains 'Proposals') and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id, name, parents)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  
  console.log('📁 Found folders:');
  for (const folder of searchResponse.data.files) {
    console.log(`   - ${folder.name} (${folder.id})`);
  }
  
  // Look for the specific one
  const targetFolder = searchResponse.data.files.find(f => 
    f.name.includes('عقود') && f.name.includes('عروض')
  ) || searchResponse.data.files.find(f =>
    f.name.includes('Contracts') && f.name.includes('Proposals')
  );
  
  if (!targetFolder) {
    console.log('\n❌ Could not find العقود والعروض folder');
    return;
  }
  
  console.log(`\n✅ Examining: ${targetFolder.name}\n`);
  console.log('='.repeat(80));
  
  const contents = await listFolderContents(targetFolder.id);
  
  console.log(`\n📊 Total items: ${contents.length}\n`);
  
  for (const item of contents) {
    const icon = item.mimeType === 'application/vnd.google-apps.folder' ? '📁' : '📄';
    const size = item.size ? `(${(item.size / 1024).toFixed(1)} KB)` : '';
    const date = new Date(item.modifiedTime).toLocaleDateString('ar-AE');
    
    console.log(`${icon} ${item.name}`);
    console.log(`   Type: ${item.mimeType.split('.').pop()}`);
    console.log(`   Modified: ${date} ${size}`);
    
    // If it's a folder, list its contents too
    if (item.mimeType === 'application/vnd.google-apps.folder') {
      const subContents = await listFolderContents(item.id);
      console.log(`   Contents: ${subContents.length} items`);
      for (const subItem of subContents.slice(0, 5)) {
        const subIcon = subItem.mimeType === 'application/vnd.google-apps.folder' ? '📁' : '📄';
        console.log(`      ${subIcon} ${subItem.name}`);
      }
      if (subContents.length > 5) {
        console.log(`      ... and ${subContents.length - 5} more`);
      }
    }
    console.log('');
  }
}

main().catch(console.error);
