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
    await connection.execute(
      'UPDATE oauthTokens SET accessToken = ?, expiresAt = ? WHERE refreshToken = ?',
      [credentials.access_token, credentials.expiry_date ? new Date(credentials.expiry_date) : null, token.refreshToken]
    );
  }
} catch (e) {}

const drive = google.drive({ version: 'v3', auth: oauth2Client });

const rootFolderId = process.argv[2] || '1PLhYCKU08CMKJWfPK44IjNAw_V3oOawD';

async function listFolder(folderId, path = '', depth = 0) {
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed=false`,
    fields: 'files(id, name, mimeType)',
    orderBy: 'name',
    pageSize: 200,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  for (const file of res.data.files || []) {
    const indent = '  '.repeat(depth);
    const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
    const icon = isFolder ? '📁' : '📄';
    console.log(`${indent}${icon} ${file.name} (${file.id})`);
    
    if (isFolder && depth < 3) {
      await listFolder(file.id, `${path}/${file.name}`, depth + 1);
    }
  }
}

await listFolder(rootFolderId);
await connection.end();
