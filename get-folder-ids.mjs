import { google } from 'googleapis';

const creds = JSON.parse(Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_KEY, 'base64').toString());
const auth = new google.auth.GoogleAuth({
  credentials: creds,
  scopes: ['https://www.googleapis.com/auth/drive.readonly']
});
const drive = google.drive({ version: 'v3', auth });

async function listFolder(folderId, indent = '') {
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: 'files(id, name, mimeType)',
    pageSize: 100
  });
  
  for (const f of (res.data.files || [])) {
    const isFolder = f.mimeType === 'application/vnd.google-apps.folder';
    console.log(`${indent}${isFolder ? '📁' : '📄'} ${f.name} → ID: ${f.id}`);
    if (isFolder) {
      await listFolder(f.id, indent + '  ');
    }
  }
}

// Start from "00- All Projects" folder
const ROOT = '1P8AlxoabTktrFKmJ6h6qU5sa-w5huG7K';

// First find the main numbered folders
const res = await drive.files.list({
  q: `'${ROOT}' in parents and trashed = false and mimeType = 'application/vnd.google-apps.folder'`,
  fields: 'files(id, name)',
  pageSize: 50
});

console.log('=== Main folders in "00- All Projects" ===');
for (const f of (res.data.files || [])) {
  console.log(`📁 ${f.name} → ID: ${f.id}`);
}

// Now find 02_PCA specifically
console.log('\n=== Looking for 02_PCA folder ===');
const pca = res.data.files.find(f => f.name.includes('02_PCA') || f.name.includes('02_Proposals'));
if (pca) {
  console.log(`Found: ${pca.name} → ID: ${pca.id}`);
  await listFolder(pca.id, '  ');
}

// Also check for 04_DD
console.log('\n=== Looking for 04_DD folder ===');
const dd = res.data.files.find(f => f.name.includes('04_D'));
if (dd) {
  console.log(`Found: ${dd.name} → ID: ${dd.id}`);
  await listFolder(dd.id, '  ');
}
