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

// NEW 02_Proposals Contracts & Agreements folder
const newFolderId = '1Q4IwTgJkzJMOKDqOQKCtRvjQVApFPcHv';
// OLD 02_Proposals, Contracts & Agreements folder
const oldFolderId = '1-RdHPkU7CgqWnvzBz8o8iRd4o76ALnpv';

async function listAll(parentId, indent = '') {
  const res = await drive.files.list({
    q: `'${parentId}' in parents and trashed = false`,
    fields: 'files(id, name, mimeType, size)',
    pageSize: 200,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  for (const f of (res.data.files || [])) {
    const isFolder = f.mimeType === 'application/vnd.google-apps.folder';
    console.log(`${indent}${isFolder ? '📁' : '📄'} ${f.name} [${f.id}] ${f.size ? `(${Math.round(f.size/1024)}KB)` : ''}`);
    if (isFolder) await listAll(f.id, indent + '  ');
  }
}

console.log('========================================');
console.log('NEW 02_Proposals Contracts & Agreements');
console.log('========================================');
await listAll(newFolderId);

console.log('\n========================================');
console.log('OLD 02_Proposals, Contracts & Agreements');
console.log('========================================');
await listAll(oldFolderId);

await connection.end();
