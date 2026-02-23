import { google } from 'googleapis';
import mysql from 'mysql2/promise';
import fs from 'fs';

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

const fileId = process.argv[2];
if (!fileId) {
  console.log('Usage: npx tsx read-drive-file.mjs <fileId>');
  process.exit(1);
}

// Download file
const response = await drive.files.get({
  fileId: fileId,
  alt: 'media',
  supportsAllDrives: true,
}, { responseType: 'arraybuffer' });

const buffer = Buffer.from(response.data);
const tmpPath = '/tmp/drive-file.pdf';
fs.writeFileSync(tmpPath, buffer);
console.log(`Downloaded ${buffer.length} bytes to ${tmpPath}`);

await connection.end();
