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

// Search for "All Projects" folder
const res = await drive.files.list({
  q: `name contains 'All Projects' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
  fields: 'files(id, name, parents)',
  pageSize: 20,
  supportsAllDrives: true,
  includeItemsFromAllDrives: true,
});

console.log('=== All Projects folders found ===');
for (const f of (res.data.files || [])) {
  console.log(`📁 ${f.name} [${f.id}] parents: ${JSON.stringify(f.parents)}`);
}

// Also search for the main numbered folders
const res2 = await drive.files.list({
  q: `name contains '03_' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
  fields: 'files(id, name, parents)',
  pageSize: 20,
  supportsAllDrives: true,
  includeItemsFromAllDrives: true,
});

console.log('\n=== 03_ folders found ===');
for (const f of (res2.data.files || [])) {
  console.log(`📁 ${f.name} [${f.id}] parents: ${JSON.stringify(f.parents)}`);
}

const res3 = await drive.files.list({
  q: `name contains '04_' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
  fields: 'files(id, name, parents)',
  pageSize: 20,
  supportsAllDrives: true,
  includeItemsFromAllDrives: true,
});

console.log('\n=== 04_ folders found ===');
for (const f of (res3.data.files || [])) {
  console.log(`📁 ${f.name} [${f.id}] parents: ${JSON.stringify(f.parents)}`);
}

// Search for folders starting with 05_, 06_, 07_, 08_, 09_
for (const prefix of ['05_', '06_', '07_', '08_', '09_']) {
  const r = await drive.files.list({
    q: `name contains '${prefix}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name, parents)',
    pageSize: 20,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  if (r.data.files?.length) {
    console.log(`\n=== ${prefix} folders found ===`);
    for (const f of (r.data.files || [])) {
      console.log(`📁 ${f.name} [${f.id}] parents: ${JSON.stringify(f.parents)}`);
    }
  }
}

await connection.end();
