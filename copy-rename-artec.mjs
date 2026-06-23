import { google } from 'googleapis';

const serviceAccountKey = JSON.parse(
  Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_KEY, 'base64').toString('utf-8')
);
const auth = new google.auth.GoogleAuth({
  credentials: serviceAccountKey,
  scopes: ['https://www.googleapis.com/auth/drive'],
});

const drive = google.drive({ version: 'v3', auth });

async function main() {
  // First find the ARTEC file - it's one of the two files in root of 02_Proposals
  // We need to find the parent folder first
  const searchResponse = await drive.files.list({
    q: `name='02_Proposals, Contracts & Agreements' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id, name, parents)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  
  console.log('Found folders:', searchResponse.data.files.map(f => `${f.name} (${f.id})`));
  
  const parentFolderId = searchResponse.data.files[0].id;
  
  // List files in root of this folder (not subfolders)
  const filesResponse = await drive.files.list({
    q: `'${parentFolderId}' in parents and mimeType!='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id, name)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  
  console.log('\nFiles in root:', filesResponse.data.files.map(f => `${f.name} (${f.id})`));
  
  // Find the remaining ARTEC file (one was deleted by user)
  const artecFile = filesResponse.data.files[0]; // Should be the remaining one
  
  if (!artecFile) {
    console.log('No file found!');
    return;
  }
  
  console.log(`\nSource file: ${artecFile.name} (${artecFile.id})`);
  
  const newNames = [
    'JAD_3260885_PRO-ENG_260213_ARTEC_V00.pdf',
    'NAS_6180578_PRO-ENG_260213_ARTEC_V00.pdf',
    'NAS_6185392_PRO-ENG_260213_ARTEC_V00.pdf',
    'NAS_6182776_PRO-ENG_260213_ARTEC_V00.pdf',
    'MAJ_6457879_PRO-ENG_260213_ARTEC_V00.pdf',
  ];
  
  for (const newName of newNames) {
    try {
      const copied = await drive.files.copy({
        fileId: artecFile.id,
        requestBody: {
          name: newName,
          parents: [parentFolderId], // Same folder
        },
        supportsAllDrives: true,
      });
      console.log(`✅ Created: ${newName} (${copied.data.id})`);
    } catch (error) {
      console.error(`❌ Failed: ${newName} - ${error.message}`);
    }
  }
  
  console.log('\nDone! All 5 copies created in same folder.');
}

main().catch(console.error);
