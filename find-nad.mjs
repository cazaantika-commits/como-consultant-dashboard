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

// Search for the 02_Proposals folder
const searchName = process.argv[2] || '02_Proposals';
const res = await drive.files.list({
  q: `name contains '${searchName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
  fields: 'files(id, name, parents)',
  pageSize: 50,
  supportsAllDrives: true,
  includeItemsFromAllDrives: true,
});

for (const f of (res.data.files || [])) {
  console.log(`📁 ${f.name} [${f.id}] parent: ${f.parents}`);
}

// Now list all subfolders of 02_Proposals
if (res.data.files && res.data.files.length > 0) {
  for (const folder of res.data.files) {
    console.log(`\n=== Inside ${folder.name} ===`);
    const sub = await drive.files.list({
      q: `'${folder.id}' in parents and trashed = false`,
      fields: 'files(id, name, mimeType, size)',
      pageSize: 200,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    for (const f of (sub.data.files || [])) {
      const isFolder = f.mimeType === 'application/vnd.google-apps.folder';
      console.log(`  ${isFolder ? '📁' : '📄'} ${f.name} [${f.id}]`);
      if (isFolder) {
        const inner = await drive.files.list({
          q: `'${f.id}' in parents and trashed = false`,
          fields: 'files(id, name, mimeType, size)',
          pageSize: 200,
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
        });
        for (const fi of (inner.data.files || [])) {
          const isFi = fi.mimeType === 'application/vnd.google-apps.folder';
          console.log(`    ${isFi ? '📁' : '📄'} ${fi.name} [${fi.id}]`);
        }
      }
    }
  }
}

await connection.end();
