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

const drive = google.drive({ version: 'v3', auth: oauth2Client });

// Get file info for the Majan SPA file
const fileId = '1Vrdn3PXMLDWM2Cxp8p-xOBrgFvCrQ3s7';
const file = await drive.files.get({
  fileId,
  fields: 'id, name, parents, mimeType, size',
  supportsAllDrives: true,
});
console.log('File info:', JSON.stringify(file.data, null, 2));

// Also list what's in the Majan PCA folder
const folderId = file.data.parents?.[0];
if (folderId) {
  const folderInfo = await drive.files.get({ fileId: folderId, fields: 'id, name', supportsAllDrives: true });
  console.log('\nParent folder:', folderInfo.data.name, `(${folderInfo.data.id})`);
  
  const files = await drive.files.list({
    q: `'${folderId}' in parents and trashed=false`,
    fields: 'files(id, name, mimeType)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  console.log('\nFiles in folder:');
  for (const f of files.data.files) {
    console.log(`  - ${f.name} (${f.id})`);
  }
}

await connection.end();
