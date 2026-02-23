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

const fileId = process.argv[2];
if (!fileId) { console.error('Usage: npx tsx read-files.mjs <fileId>'); process.exit(1); }

const dest = `/tmp/drive-file-${fileId.slice(0,8)}.pdf`;
const response = await drive.files.get({ fileId, alt: 'media', supportsAllDrives: true }, { responseType: 'stream' });
const writer = fs.createWriteStream(dest);
await new Promise((resolve, reject) => {
  response.data.pipe(writer);
  writer.on('finish', resolve);
  writer.on('error', reject);
});
console.log(`Downloaded to ${dest}`);
await connection.end();
