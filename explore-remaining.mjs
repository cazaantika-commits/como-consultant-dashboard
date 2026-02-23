import { google } from 'googleapis';
import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const [rows] = await connection.execute('SELECT accessToken, refreshToken, expiresAt FROM oauthTokens LIMIT 1');
const token = rows[0];

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_OAUTH_CLIENT_ID,
  process.env.GOOGLE_OAUTH_CLIENT_SECRET
);
oauth2Client.setCredentials({
  access_token: token.accessToken,
  refresh_token: token.refreshToken,
  expiry_date: token.expiresAt ? new Date(token.expiresAt).getTime() : undefined,
});
try {
  const { credentials } = await oauth2Client.refreshAccessToken();
  oauth2Client.setCredentials(credentials);
  if (credentials.access_token) {
    await connection.execute('UPDATE oauthTokens SET accessToken = ?, expiresAt = ? WHERE refreshToken = ?',
      [credentials.access_token, credentials.expiry_date ? new Date(credentials.expiry_date) : null, token.refreshToken]);
  }
} catch (e) {}

const drive = google.drive({ version: 'v3', auth: oauth2Client });

async function listAll(parentId, indent = '', maxDepth = 3, currentDepth = 0) {
  if (currentDepth >= maxDepth) return;
  const res = await drive.files.list({
    q: `'${parentId}' in parents and trashed = false`,
    fields: 'files(id, name, mimeType, size)',
    pageSize: 200,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    orderBy: 'name',
  });
  for (const f of (res.data.files || [])) {
    const isFolder = f.mimeType === 'application/vnd.google-apps.folder';
    console.log(`${indent}${isFolder ? '📁' : '📄'} ${f.name} [${f.id}] ${f.size ? `(${Math.round(f.size/1024)}KB)` : ''}`);
    if (isFolder) await listAll(f.id, indent + '  ', maxDepth, currentDepth + 1);
  }
}

// These are the folders in "00- All Projects" (parent: 1sBIsn77si1NJMKiC307DkNRrYpn7Naq6)
// that we haven't processed yet

const folders = [
  { id: '1rqHJPVUWFJTyxKVkFUvqRxLnFjcBwYqH', name: '03_Authority Approvals & Permits' },
  { id: '1UI4f0mBuoq4Jk3CBfkk58mncnlKef4pG', name: '05_Costing & Finance' },
  { id: '1pLq6pQco9t72pRWOihvUmfIqRdwZq42-', name: '06_Construction Progress' },
  { id: '1ed0YhtxTwyR-wmmGmHHzzu_lvZ2Qw2hZ', name: '07_Communications & Meetings' },
  { id: '1Vmm4Rq-oH1mv9CeXIybf9Av74yx2-dC0', name: '08_Final Delivery & Closure' },
  { id: '1w_82xqTGNxMGSjLx-hhBN83YctrY3D43', name: '09_Project Summary & Tracking' },
];

for (const folder of folders) {
  console.log(`\n========================================`);
  console.log(`📁 ${folder.name} [${folder.id}]`);
  console.log(`========================================`);
  await listAll(folder.id, '  ', 3, 0);
}

// Also check if there's a 04_ folder in the same parent
const res04 = await drive.files.list({
  q: `'1sBIsn77si1NJMKiC307DkNRrYpn7Naq6' in parents and trashed = false and mimeType = 'application/vnd.google-apps.folder'`,
  fields: 'files(id, name)',
  pageSize: 20,
  supportsAllDrives: true,
  includeItemsFromAllDrives: true,
  orderBy: 'name',
});

console.log('\n========================================');
console.log('ALL FOLDERS in 00- All Projects');
console.log('========================================');
for (const f of (res04.data.files || [])) {
  console.log(`📁 ${f.name} [${f.id}]`);
}

await connection.end();
