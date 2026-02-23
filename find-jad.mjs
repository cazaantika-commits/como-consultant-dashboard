import { google } from 'googleapis';
import dotenv from 'dotenv';
dotenv.config();

const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
let serviceAccountKey;
try {
  serviceAccountKey = JSON.parse(raw);
} catch {
  serviceAccountKey = JSON.parse(Buffer.from(raw, 'base64').toString('utf-8'));
}
const auth = new google.auth.GoogleAuth({
  credentials: serviceAccountKey,
  scopes: ['https://www.googleapis.com/auth/drive'],
});
const drive = google.drive({ version: 'v3', auth });

async function listFiles(folderId, indent = '') {
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed=false`,
    fields: 'files(id, name, mimeType)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    pageSize: 100,
  });
  return res.data.files || [];
}

async function main() {
  // Search for any file/folder containing "JAD" 
  console.log('=== Searching for JAD files/folders ===');
  const jadSearch = await drive.files.list({
    q: "name contains 'JAD' and trashed=false",
    fields: 'files(id, name, mimeType, parents)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    corpora: 'allDrives',
    pageSize: 50,
  });
  
  for (const f of jadSearch.data.files || []) {
    console.log(`${f.name} | ${f.mimeType} | id:${f.id} | parents:${f.parents}`);
  }

  // Also search for "الجداف"
  console.log('\n=== Searching for الجداف ===');
  const jadAr = await drive.files.list({
    q: "name contains 'الجداف' and trashed=false",
    fields: 'files(id, name, mimeType, parents)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    corpora: 'allDrives',
    pageSize: 50,
  });
  
  for (const f of jadAr.data.files || []) {
    console.log(`${f.name} | ${f.mimeType} | id:${f.id} | parents:${f.parents}`);
  }

  // Search for "3731853"
  console.log('\n=== Searching for 3731853 ===');
  const plotSearch = await drive.files.list({
    q: "name contains '3731853' and trashed=false",
    fields: 'files(id, name, mimeType, parents)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    corpora: 'allDrives',
    pageSize: 50,
  });
  
  for (const f of plotSearch.data.files || []) {
    console.log(`${f.name} | ${f.mimeType} | id:${f.id} | parents:${f.parents}`);
  }

  // If we found JAD folders, explore 02_PCA inside them
  const jadFolders = (jadSearch.data.files || []).filter(f => f.mimeType === 'application/vnd.google-apps.folder');
  
  for (const folder of jadFolders) {
    console.log(`\n=== Contents of "${folder.name}" ===`);
    const contents = await listFiles(folder.id);
    for (const c of contents) {
      console.log(`  ${c.name} | ${c.mimeType} | ${c.id}`);
      
      // If it's a folder containing "02" or "PCA" or "Proposal", go deeper
      if (c.mimeType === 'application/vnd.google-apps.folder' && (c.name.includes('02') || c.name.includes('PCA') || c.name.includes('Proposal'))) {
        const inner = await listFiles(c.id);
        for (const i of inner) {
          console.log(`    ${i.name} | ${i.mimeType} | ${i.id}`);
          // Go one more level for subfolders
          if (i.mimeType === 'application/vnd.google-apps.folder') {
            const deep = await listFiles(i.id);
            for (const d of deep) {
              console.log(`      ${d.name} | ${d.mimeType} | ${d.id}`);
            }
          }
        }
      }
    }
  }
}

main().catch(console.error);
