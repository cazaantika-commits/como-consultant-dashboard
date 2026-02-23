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

async function rename(id, newName) {
  try {
    const result = await drive.files.update({ fileId: id, requestBody: { name: newName }, supportsAllDrives: true });
    console.log(`✅ ${result.data.name}`);
  } catch (error) {
    console.error(`❌ ${newName}: ${error.message}`);
  }
}

// Based on content analysis:
// ============================================
// NAD_6185392 PROPOSALS FOLDER
// ============================================
// UNKNOWN-A (264KB): Quotation from TARMAC Soil Testing Lab, via REALISTIC consultant, dated 25.12.2025
// → This is a soil investigation quotation. Tarmac is the lab, Realistic is the consultant.
await rename('1p2vOKJaY4hab0tB97ZAiBUOHDsgA75_Z', 'NAD_6185392_QTN-SOIL_251225_TARMAC_V00.pdf');

// UNKNOWN-B (833KB): Quotation from SED (another lab), via REALISTIC consultant, dated 25/12/2025
// → This is a soil investigation quotation from SED lab
await rename('1OrlS_baaIe6CXmc2UyhfZXvuN6Gwekfz', 'NAD_6185392_QTN-SOIL_251225_SED_V00.pdf');

// ============================================
// NAD_6182776 PROPOSALS FOLDER
// ============================================
// 260212 UNKNOWN (444KB): DATUM Engineering Consultants proposal dated 12 Feb 2026
await rename('12R1l835yWqsCFFDMlFaBPsOUQbq_xxal', 'NAD_6182776_PRO-ENG_260212_DATUM_V00.pdf');

// 260209 UNKNOWN (1109KB): REALISTIC consultancy services offer dated 09 Feb 2026
await rename('1JJUpRyRT3gjTexLEKwP2QTt3L1_oakuH', 'NAD_6182776_PRO-ENG_260209_REALISTIC_V00.pdf');

// 2026 UNKNOWN (2224KB): SAFEER Engineering Consultants quotation for plot 6182776
await rename('1aOHObcai4LkTfNh-ua89d9uxf6vYKWqb', 'NAD_6182776_PRO-ENG_260000_SAFEER_V00.pdf');

// ============================================
// NAD_6180578 PROPOSALS FOLDER
// ============================================
// 2026 UNKNOWN (2374KB): SAFEER Engineering Consultants quotation for plot 6180578
await rename('1zpTctMahzkwlNX7tDTAEAk9odjqNO_xq', 'NAD_6180578_PRO-ENG_260000_SAFEER_V00.pdf');

await connection.end();
console.log('\n=== ALL UNKNOWNS RENAMED ===');
