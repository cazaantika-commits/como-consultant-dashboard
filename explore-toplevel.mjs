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

// Check the individual project folders that exist outside "00- All Projects"
// These are in the COMO Projects Management root

// 01_Inbox
console.log('=== 01_Inbox ===');
await listAll('1_FQBmmWqaTlfpNI_lsskSffBSGWTdaon', '  ', 3, 0);

// 03-COMO_Foundation
console.log('\n=== 03-COMO_Foundation ===');
await listAll('1FqPA2ZhjOFW7-J0fc1oni5kS3A0jHGCI', '  ', 3, 0);

// 04_Service Providers -Profiles
console.log('\n=== 04_Service Providers -Profiles ===');
await listAll('1QLdipboMCnFxrW9Qnpw8i9JU9RqAhIsd', '  ', 3, 0);

// Also check if there are individual project folders (like the old structure)
const searchRes = await drive.files.list({
  q: `name contains 'Al-Jadaf' or name contains 'Nad-Al-Sheba' or name contains 'Majan' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
  fields: 'files(id, name, parents)',
  pageSize: 30,
  supportsAllDrives: true,
  includeItemsFromAllDrives: true,
});

console.log('\n=== Individual Project Folders ===');
for (const f of (searchRes.data.files || [])) {
  console.log(`📁 ${f.name} [${f.id}] parents: ${JSON.stringify(f.parents)}`);
}

await connection.end();
