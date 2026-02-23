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

async function listAll(parentId, indent = '', maxDepth = 4, currentDepth = 0) {
  if (currentDepth >= maxDepth) return;
  try {
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
  } catch (error) {
    console.log(`${indent}⚠️ Error: ${error.code || error.message?.substring(0, 80)}`);
  }
}

// Check individual project folders (these are the 6 project folders at the top level)
// Search for them
const projectFolders = await drive.files.list({
  q: `'1PLhYCKU08CMKJWfPK44IjNAw_V3oOawD' in parents and trashed = false`,
  fields: 'files(id, name, mimeType)',
  pageSize: 20,
  supportsAllDrives: true,
  includeItemsFromAllDrives: true,
  orderBy: 'name',
});

console.log('=== COMO Projects Management - Top Level ===');
for (const f of (projectFolders.data.files || [])) {
  const isFolder = f.mimeType === 'application/vnd.google-apps.folder';
  console.log(`${isFolder ? '📁' : '📄'} ${f.name} [${f.id}]`);
}

// Check the old 02 folder for any remaining unrenamed files
console.log('\n=== OLD 02_Proposals, Contracts & Agreements ===');
const oldFolderId = '1-RdHPkU7CgqWnvzBz8o8iRd4o76ALnpv';
await listAll(oldFolderId, '  ', 3, 0);

await connection.end();
