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

// === MAJ_6457956 ROOT LEVEL ===
console.log('=== MAJ_6457956 ROOT ===');
// Fact Sheet (in Contracts folder, should be moved later)
await rename('1wjLyxF09Dx129QVtgD9t6ZKrLkHRzA3j', 'MAJ_6457956_FACT-SHEET_260202_COMO_V00.pdf');
// LACASA User Manual (company profile doc)
await rename('1B_a_ux1O6HnZsjURsyhAyAhKxcx3OBIY', 'MAJ_6457956_PROFILE_LACASA_V00.pdf');
// LACASA Procurement Management (duplicate 1)
await rename('1bJJyJAwdIqqrxIsB4o6bSH--HeExJHlc', 'MAJ_6457956_PROC-MGMT_LACASA_V00.pdf');
// LACASA Procurement Management (duplicate 2 - same content, smaller)
await rename('1ZXQ7gICwFj-70aGMlDLBBTP1GFXghhjq', 'MAJ_6457956_PROC-MGMT_LACASA_V00_DUP.pdf');
// LACASA QHSE Manual
await rename('1zKG9WzeDmGwhqXhjw7grRBZA96tRYhR9', 'MAJ_6457956_QHSE_LACASA_V00.pdf');
// LACASA Risk Management
await rename('1wozmVmTCVAdWDubQHoXj0qfl_onDv676', 'MAJ_6457956_RISK-MGMT_LACASA_V00.pdf');

// === MAJ_6457956 ROOT (proposals outside Proposals folder) ===
console.log('\n=== MAJ_6457956 PROPOSALS (root level) ===');
// Arif & Bintoak (ARTOAK), 9 Feb 2026
await rename('1PGCq0DfIF5WOPfmDWmrbVhdnhBg-iNF9', 'MAJ_6457956_PRO-ENG_260209_ARTOAK_V00.pdf');
// LACASA, 6 Feb 2026, Design Only (219 pages)
await rename('151f6rHvL2rhFGMS5eVZAlUE_C2C9pyrn', 'MAJ_6457956_PRO-ENG_260206_LACASA_V00.pdf');
// Colliers, Feb 2026, Retail Advisory Services
await rename('1nTqxUsC5TEVRfi77WWeHbLokDm1BvweZ', 'MAJ_6457956_PRO-FEAS_260200_COLLIERS_V00.pdf');
// Arabic evaluation of Colliers proposal
await rename('1cswUoZQCt33yPTMCIFW_-wOCtqaor0OA', 'MAJ_6457956_REV-FEAS_COLLIERS_V00.pdf');

// === MAJ_6457956 PROPOSALS FOLDER (wrong files - belong to MAJ_6457879) ===
console.log('\n=== MAJ_6457956 PROPOSALS FOLDER (misplaced - actually MAJ_6457879) ===');
// LACASA for MAJ_6457879, 6 Feb 2026 - WRONG FOLDER
await rename('1quopgoXRfYw3XYx8QtGIr6NCGJmeIxlg', 'MAJ_6457879_PRO-ENG_260206_LACASA_V00.pdf');
// DATUM for MAJ_6457879, 12 Feb 2026 - WRONG FOLDER
await rename('1ZaPjfZ6LBIsylPFIX31vhVqkrbtMKjZg', 'MAJ_6457879_PRO-ENG_260212_DATUM_V00.pdf');

await connection.end();
console.log('\n=== DONE ===');
