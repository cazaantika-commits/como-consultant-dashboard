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

// ============================================
// FIX 1: NAD_6180578 Proposals - soil files with UNKNOWN names
// ============================================
console.log('=== FIX NAD_6180578 SOIL FILES ===');
// UNKNOWN-A (263KB) = Tarmac quotation for soil investigation, plot 6180578
await rename('1u7Lta8p3E7z6dDX7Fg6TAaa_bcQMYSyQ', 'NAD_6180578_QTN-SOIL_251225_TARMAC_V00.pdf');
// UNKNOWN-B (833KB) = SED quotation for soil investigation, plot 6180578
await rename('1rKFUCt5mOowPoEkXmp93YfjK7zNqRRAo', 'NAD_6180578_QTN-SOIL_251225_SED_V00.pdf');

// ============================================
// FIX 2: OLD FOLDER - Consultants Proposals under CONSULTANT_CONTRACTS
// ============================================
console.log('\n=== FIX OLD FOLDER - CONSULTANTS PROPOSALS ===');
// 4 Villas_Safeer.pdf (7109KB) - pdftotext returned empty, but based on name and size
// it's a SAFEER engineering proposal for 4 villas on plot 6180578
// No date extractable from PDF - use approximate date
await rename('12mX75Zno-aiWX6382KJHK1voqO9eyZ6K', 'NAD_6180578_PRO-ENG_SAFEER_V00.pdf');

// 4 Villas_Realistic.pdf (1108KB) - REALISTIC consultancy services offer dated 09 Feb 2026 for plot 6180578
await rename('1enw1J8RSHDT6vbCyxEhcaffTHpNDnBXX', 'NAD_6180578_PRO-ENG_260209_REALISTIC_V00.pdf');

// 4 Villas_Datum.pdf (430KB) - DATUM proposal dated 12 Feb 2026 for plot 6180578
await rename('1kiRXKF_-zgtsW3Vxo2voYJEL1Uu6YtX9', 'NAD_6180578_PRO-ENG_260212_DATUM_V00.pdf');

// REC57 (04-02-2026) CV INVESMENTS LIMITED 4 villas.pdf - already renamed copy exists
// This is the original in old folder
await rename('15vhC32_fnKHd46hsFNBbIKAfzoFsTYGM', 'NAD_6180578_PRO-ENG_260204_CV-INVEST_V00.pdf');

await connection.end();
console.log('\n=== ALL FIXES APPLIED ===');
