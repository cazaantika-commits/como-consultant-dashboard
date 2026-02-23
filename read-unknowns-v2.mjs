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

async function readAndExtract(fileId, label) {
  try {
    console.log(`\n========== ${label} ==========`);
    const response = await drive.files.get({ fileId, alt: 'media', supportsAllDrives: true }, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data);
    const tmpFile = `/tmp/unknown_${fileId}.pdf`;
    writeFileSync(tmpFile, buffer);
    
    // Use pdftotext to extract text
    try {
      execSync(`pdftotext -l 3 "${tmpFile}" /tmp/unknown_${fileId}.txt`, { timeout: 15000 });
      const text = readFileSync(`/tmp/unknown_${fileId}.txt`, 'utf-8');
      // Print first 2000 chars
      console.log(text.substring(0, 2000));
      unlinkSync(`/tmp/unknown_${fileId}.txt`);
    } catch (e) {
      console.log(`pdftotext failed: ${e.message}`);
    }
    unlinkSync(tmpFile);
  } catch (error) {
    console.error(`Error: ${error.message}`);
  }
}

// Files to identify:
await readAndExtract('1p2vOKJaY4hab0tB97ZAiBUOHDsgA75_Z', 'NAD_6185392 UNKNOWN-A (264KB) - currently PRO-SOIL');
await readAndExtract('1OrlS_baaIe6CXmc2UyhfZXvuN6Gwekfz', 'NAD_6185392 UNKNOWN-B (833KB) - currently PRO-SOIL');
await readAndExtract('12R1l835yWqsCFFDMlFaBPsOUQbq_xxal', 'NAD_6182776 260212 UNKNOWN (444KB)');
await readAndExtract('1JJUpRyRT3gjTexLEKwP2QTt3L1_oakuH', 'NAD_6182776 260209 UNKNOWN (1109KB)');
await readAndExtract('1aOHObcai4LkTfNh-ua89d9uxf6vYKWqb', 'NAD_6182776 2026 UNKNOWN (2224KB)');
await readAndExtract('1zpTctMahzkwlNX7tDTAEAk9odjqNO_xq', 'NAD_6180578 2026 UNKNOWN (2374KB)');

await connection.end();
console.log('\n=== DONE ===');
