import { google } from 'googleapis';
import mysql from 'mysql2/promise';
import { writeFileSync, readFileSync, unlinkSync } from 'fs';
import { execSync } from 'child_process';

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

async function rename(id, newName) {
  try {
    const result = await drive.files.update({ fileId: id, requestBody: { name: newName }, supportsAllDrives: true });
    console.log(`✅ ${result.data.name}`);
  } catch (error) {
    console.error(`❌ ${newName}: ${error.message}`);
  }
}

async function readAndIdentify(fileId, label) {
  try {
    const response = await drive.files.get({ fileId, alt: 'media', supportsAllDrives: true }, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data);
    const tmpFile = `/tmp/fix_${fileId}.pdf`;
    writeFileSync(tmpFile, buffer);
    try {
      execSync(`pdftotext -l 2 "${tmpFile}" /tmp/fix_${fileId}.txt`, { timeout: 15000 });
      const text = readFileSync(`/tmp/fix_${fileId}.txt`, 'utf-8');
      console.log(`\n=== ${label} ===`);
      console.log(text.substring(0, 1500));
      unlinkSync(`/tmp/fix_${fileId}.txt`);
    } catch (e) {
      console.log(`pdftotext failed for ${label}`);
    }
    unlinkSync(tmpFile);
  } catch (error) {
    console.error(`Error reading ${label}: ${error.message}`);
  }
}

// Step 1: Read the NAD_6180578 UNKNOWN soil files to identify them
console.log('=== READING NAD_6180578 SOIL FILES ===');
await readAndIdentify('1u7Lta8p3E7z6dDX7Fg6TAaa_bcQMYSyQ', 'NAD_6180578 UNKNOWN-A (263KB)');
await readAndIdentify('1rKFUCt5mOowPoEkXmp93YfjK7zNqRRAo', 'NAD_6180578 UNKNOWN-B (833KB)');

// Step 2: Read old folder files that need renaming
console.log('\n=== READING OLD FOLDER FILES ===');
await readAndIdentify('12mX75Zno-aiWX6382KJHK1voqO9eyZ6K', '4 Villas_Safeer.pdf (7109KB)');
await readAndIdentify('1enw1J8RSHDT6vbCyxEhcaffTHpNDnBXX', '4 Villas_Realistic.pdf (1108KB)');
await readAndIdentify('1kiRXKF_-zgtsW3Vxo2voYJEL1Uu6YtX9', '4 Villas_Datum.pdf (430KB)');

await connection.end();
console.log('\n=== DONE READING ===');
