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

// "00- All Projects" folder ID
const allProjectsId = '1BxGzOPz-FPy5WCMhFkjQNwLlnxJZv7LJ';

async function listAll(parentId, indent = '', maxDepth = 4, currentDepth = 0) {
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

// First list the main category folders
console.log('=== 00- All Projects ===');
const mainRes = await drive.files.list({
  q: `'${allProjectsId}' in parents and trashed = false and mimeType = 'application/vnd.google-apps.folder'`,
  fields: 'files(id, name)',
  pageSize: 20,
  supportsAllDrives: true,
  includeItemsFromAllDrives: true,
  orderBy: 'name',
});

for (const folder of (mainRes.data.files || [])) {
  // Skip 00, 01, 02 (already done or postponed)
  if (folder.name.startsWith('00_') || folder.name.startsWith('01_') || folder.name.startsWith('02_')) {
    console.log(`\n📁 ${folder.name} [${folder.id}] → ALREADY DONE/SKIPPED`);
    continue;
  }
  console.log(`\n📁 ${folder.name} [${folder.id}]`);
  await listAll(folder.id, '  ', 4, 0);
}

await connection.end();
