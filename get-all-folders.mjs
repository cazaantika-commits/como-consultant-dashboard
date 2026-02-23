import { google } from 'googleapis';

const creds = JSON.parse(Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_KEY, 'base64').toString());
const auth = new google.auth.GoogleAuth({
  credentials: creds,
  scopes: ['https://www.googleapis.com/auth/drive.readonly']
});
const drive = google.drive({ version: 'v3', auth });

async function listAllFolders(folderId, path = '', depth = 0) {
  if (depth > 5) return;
  
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false and mimeType = 'application/vnd.google-apps.folder'`,
    fields: 'files(id, name)',
    pageSize: 100
  });
  
  const results = [];
  for (const f of (res.data.files || [])) {
    const fullPath = path ? `${path}/${f.name}` : f.name;
    results.push({ path: fullPath, id: f.id, name: f.name });
    console.log(`${'  '.repeat(depth)}📁 ${f.name} → ${f.id}`);
    const children = await listAllFolders(f.id, fullPath, depth + 1);
    results.push(...children);
  }
  return results;
}

// The shared drive root
const SHARED_ROOT = '1P8AlxoabTktrFKmJ6h6qU5sa-w5huG7K';

console.log('=== Searching from shared root ===');
const allFolders = await listAllFolders(SHARED_ROOT);

// Also search the parent folder that contains "00- All Projects"
console.log('\n=== Searching parent level ===');
// Let's find the parent of our shared root
const parentRes = await drive.files.get({
  fileId: SHARED_ROOT,
  fields: 'parents'
});
console.log('Parent of shared root:', parentRes.data.parents);

if (parentRes.data.parents) {
  for (const pid of parentRes.data.parents) {
    console.log(`\nParent folder: ${pid}`);
    const parentFolders = await listAllFolders(pid);
  }
}

// Also search specifically for JAD folders
console.log('\n=== Searching for JAD folders ===');
const jadSearch = await drive.files.list({
  q: `name contains 'JAD' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
  fields: 'files(id, name, parents)',
  pageSize: 50
});
for (const f of (jadSearch.data.files || [])) {
  console.log(`📁 ${f.name} → ${f.id} (parents: ${f.parents})`);
}

// Search for 02_PCA folders
console.log('\n=== Searching for PCA folders ===');
const pcaSearch = await drive.files.list({
  q: `name contains 'PCA' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
  fields: 'files(id, name, parents)',
  pageSize: 50
});
for (const f of (pcaSearch.data.files || [])) {
  console.log(`📁 ${f.name} → ${f.id} (parents: ${f.parents})`);
}

// Search for Proposals folders
console.log('\n=== Searching for Proposals folders ===');
const propSearch = await drive.files.list({
  q: `name contains 'Proposals' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
  fields: 'files(id, name, parents)',
  pageSize: 50
});
for (const f of (propSearch.data.files || [])) {
  console.log(`📁 ${f.name} → ${f.id} (parents: ${f.parents})`);
}
