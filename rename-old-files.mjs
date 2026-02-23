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
// NAD_6185392 (old structure) - Files to rename
// ============================================
console.log('=== NAD_6185392 OLD STRUCTURE FILES ===');

// CONSULTANT_EVALUATION
await rename('1Q-GPEHK04QsSQlg9jBld9wQhem4w7-Rk', 'NAD_6185392_PRO-ENG_260212_DATUM_V00.pdf');
await rename('146LlG-pNAG6oYdXVOelXm-zJ4Zn7DcdD', 'NAD_6185392_PRO-ENG_260209_REALISTIC_V00.pdf');
await rename('18ds_mAH9ybG3Ttaie9zDTdRxWXQHfJE9', 'NAD_6185392_PRO-ENG_250902_SAFEER_V00.pdf');

// LAND_PURCHASE_AGREEMENTS
await rename('1Zx6t6pL2YTT12wKeTk97sRsNmrHsLU37', 'NAD_6185392_NOV-NOVATION_V00.pdf');
await rename('1NYOy3brMSD1xly2wPcEWpud85madTvlt', 'NAD_6185392_SPA-EXECUTED_V00.pdf');
await rename('1Zn5sdiI26tetRFt78c-LpgkY4F4FHBfB', 'NAD_6185392_NOV-NOVATION_DUP_V00.pdf');
await rename('1GvTXZkkDWrpNzNuzg4rU30FIQfxQ0hBI', 'NAD_6185392_SPA-EXECUTED_DUP_V00.pdf');
await rename('1qROO7Xd7zRlDA9Ywlj5uPGPLigt8qDwb', 'NAD_6185392_TITLE-DEED_V00.pdf');
await rename('1nzpl0HLAtwsiYyDRFe7vabY8MJPU6iQL', 'NAD_6185392_FACT-SHEET-AR_2153_V00.pdf');

// SOIL_INVESTIGATION
await rename('1_19qiIPoQSwp-T2OneTkTkzXvdBSffnO', 'NAD_6185392_PRO-SOIL_REALISTIC_V00.pdf');
await rename('1hgy4wRaIXMMFOzTRyqlJNPA9zoA3mi1b', 'NAD_6185392_QTN-SOIL_251225_TARMAC_V00.pdf');

// ============================================
// NAD_6182776 (old structure) - Files to rename
// ============================================
console.log('\n=== NAD_6182776 OLD STRUCTURE FILES ===');

// CONSULTANT_EVALUATION
await rename('1QE1zZ9RSIjmCmOuwvbO_gpA08rHbzPVA', 'NAD_6182776_PRO-ENG_260212_DATUM_V00.pdf');
await rename('1lizn3-vU8O5RGHTiGjwqdw9yncdaimvf', 'NAD_6182776_PRO-ENG_260209_REALISTIC_V00.pdf');
await rename('1bKDsGiZJ91vDRh5xI-F8u1QgmWCYKe5s', 'NAD_6182776_PRO-ENG_SAFEER_V00.pdf');
await rename('1KhO_6JmGqbNZdp_v_YQchQ1_TY9Qgik_', 'NAD_6182776_PRO-ENG_260204_CV-INVEST_V00.pdf');

// ============================================
// MAJ_6457956 (old structure) - Files to rename
// ============================================
console.log('\n=== MAJ_6457956 OLD STRUCTURE FILES ===');

// 04_CONTRACTS_&_AGREEMENTS root
await rename('1DYWbanjGNKcGory4a6dViWJBVcVT6klp', 'MAJ_6457956_PRO-FEAS_COLLIERS_V00.pdf');

// LAND_PURCHASE_AGREEMENTS
await rename('1_IIVNsu8iqK91oQLWFbrHlAZ7obp8QZG', 'MAJ_6457956_SPA-EXECUTED_V00.pdf');
await rename('1HNnj8scYrMZrOyzxIrtKXgmYWgCo3uvF', 'MAJ_6457956_FACT-SHEET-AR_666_V00.pdf');

// ============================================
// MAJ_6457879 (old structure) - Files to rename
// ============================================
console.log('\n=== MAJ_6457879 OLD STRUCTURE FILES ===');

// ZONING_REGULATIONS
await rename('11FQhRF6N3WIa90J9OC6_VzceRKqydWZU', 'MAJ_6457879_PLOT-GUIDELINE_V00.pdf');

// STUDIES_&_FEASIBILITY
await rename('1NYfYnsn_b30SxVjI7Nk59iuUAt5gk5wxq22C8-x0G-o', 'MAJ_6457879_RPT-FEAS_V00');
await rename('1FutXEpYWqaQtaL1xQKjj5EA7e6LFJp4d', 'MAJ_6457879_RPT-FEAS_V00.pdf');

// LAND_PURCHASE_AGREEMENTS
await rename('1nF9_oCfoeGgUG5qZLv7auW_S78iUtUkI', 'MAJ_6457879_SPA-EXECUTED_V00.pdf');
await rename('1WjQpHp0pfNfgQT3NAJ0LakPSblNKBHwr', 'MAJ_6457879_FACT-SHEET-AR_666_V00.pdf');

// RFQ_RESPONSES
await rename('15ixK6mfnQuvVY6NWh8ni7lcAtYZCxwBa', 'MAJ_6457879_PRO-ENG_260206_LACASA_V00.pdf');
await rename('1eceiNUgEGdUwBC70ROT6c9ZxKaVifWFp', 'MAJ_6457879_PRO-ENG_DATUM_V00.pdf');
await rename('1mRSctF9KBkBuwMA0H5juOxR11EsnqKHp', 'MAJ_6457879_PRO-ENG_260212_DATUM_V00.pdf');
await rename('13MZThfY7gQBLYPsyx6pDJH2eGYDuqNrm', 'MAJ_6457879_PRO-ENG_260206_LACASA_V00_DUP.pdf');

await connection.end();
console.log('\n=== ALL OLD STRUCTURE FILES RENAMED ===');
