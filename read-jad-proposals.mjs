import { google } from 'googleapis';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
let serviceAccountKey;
try {
  serviceAccountKey = JSON.parse(raw);
} catch {
  // It might be base64 encoded
  serviceAccountKey = JSON.parse(Buffer.from(raw, 'base64').toString('utf-8'));
}
const auth = new google.auth.GoogleAuth({
  credentials: serviceAccountKey,
  scopes: ['https://www.googleapis.com/auth/drive.readonly'],
});
const drive = google.drive({ version: 'v3', auth });

// Known folder IDs from our previous work
// We need to find JAD_3731853 > 02_PCA folder
// The main "00- All Projects" folder contains project folders

async function findFolder(parentId, nameContains) {
  const res = await drive.files.list({
    q: `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and name contains '${nameContains}' and trashed=false`,
    fields: 'files(id, name)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  return res.data.files || [];
}

async function listFiles(folderId) {
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed=false`,
    fields: 'files(id, name, mimeType, size)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    pageSize: 100,
  });
  return res.data.files || [];
}

async function main() {
  // Step 1: Find the shared drive / root
  const drives = await drive.drives.list({ pageSize: 10 });
  console.log('Shared Drives:', drives.data.drives?.map(d => `${d.name} (${d.id})`));

  // Search for JAD folder across all drives
  const jadSearch = await drive.files.list({
    q: "name contains 'JAD_3731853' and mimeType='application/vnd.google-apps.folder' and trashed=false",
    fields: 'files(id, name, parents)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    corpora: 'allDrives',
  });
  console.log('\nJAD folders found:', jadSearch.data.files);

  // Search for 02_PCA under JAD
  for (const jadFolder of jadSearch.data.files || []) {
    console.log(`\n--- Checking ${jadFolder.name} (${jadFolder.id}) ---`);
    const subfolders = await listFiles(jadFolder.id);
    console.log('Contents:', subfolders.map(f => f.name));

    // Look for 02_PCA or similar
    for (const sub of subfolders) {
      if (sub.name.includes('02') || sub.name.includes('PCA') || sub.name.includes('Proposal')) {
        console.log(`\n  >> Found: ${sub.name} (${sub.id})`);
        const files = await listFiles(sub.id);
        console.log('  Files:');
        for (const f of files) {
          console.log(`    - ${f.name} (${f.mimeType}) [${f.id}]`);
        }
        
        // Check subfolders inside 02_PCA
        for (const f of files) {
          if (f.mimeType === 'application/vnd.google-apps.folder') {
            const innerFiles = await listFiles(f.id);
            console.log(`\n    >> Subfolder: ${f.name}`);
            for (const inner of innerFiles) {
              console.log(`      - ${inner.name} (${inner.mimeType}) [${inner.id}]`);
            }
          }
        }
      }
    }
  }
}

main().catch(console.error);
