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
    console.log(`${indent}⚠️ Error accessing folder: ${error.message?.substring(0, 50)}`);
  }
}

// First, find the COMO Projects Management folder
const searchRes = await drive.files.list({
  q: `name contains 'COMO' and name contains 'Projects' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
  fields: 'files(id, name, parents)',
  pageSize: 20,
  supportsAllDrives: true,
  includeItemsFromAllDrives: true,
});

console.log('=== COMO Projects folders ===');
for (const f of (searchRes.data.files || [])) {
  console.log(`📁 ${f.name} [${f.id}] parents: ${JSON.stringify(f.parents)}`);
}

// Find the "00- All Projects" folder
const allProjRes = await drive.files.list({
  q: `name = '00- All Projects' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
  fields: 'files(id, name, parents)',
  pageSize: 10,
  supportsAllDrives: true,
  includeItemsFromAllDrives: true,
});

console.log('\n=== 00- All Projects folders ===');
for (const f of (allProjRes.data.files || [])) {
  console.log(`📁 ${f.name} [${f.id}] parents: ${JSON.stringify(f.parents)}`);
  
  // List its children
  console.log('  Children:');
  try {
    const childRes = await drive.files.list({
      q: `'${f.id}' in parents and trashed = false and mimeType = 'application/vnd.google-apps.folder'`,
      fields: 'files(id, name)',
      pageSize: 20,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      orderBy: 'name',
    });
    for (const c of (childRes.data.files || [])) {
      console.log(`  📁 ${c.name} [${c.id}]`);
    }
  } catch (e) {
    console.log(`  ⚠️ Error: ${e.message?.substring(0, 50)}`);
  }
}

await connection.end();
