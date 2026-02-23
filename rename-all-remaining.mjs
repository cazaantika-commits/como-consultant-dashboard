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
// NAD_6185392 PROPOSALS (NAS→NAD)
// ============================================
console.log('=== NAD_6185392 PROPOSALS ===');
await rename('14OSqC_B7GA-wQA11alczeZTlmLalQmYQ', 'NAD_6185392_PRO-ENG_250902_SAFEER_V00.pdf');
await rename('1Dwukb25a774-WeWBkdTMnQ4qOdpFVuz4', 'NAD_6185392_PRO-ENG_260209_REALISTIC_V00.pdf');
await rename('1yZZg1vtbZwEVM_R1vS888xqHLJQbYvCd', 'NAD_6185392_PRO-ENG_260212_DATUM_V00.pdf');
await rename('1IWNrEAzoUouz0hOfm4rPdOQ1VGafDle4', 'NAD_6185392_PRO-ENG_260213_ARTEC_V00.pdf');
// Two old files with same name NAS-R_6185392_PRO_20251225 - need to read them
// 1p2vOKJaY4hab0tB97ZAiBUOHDsgA75_Z (264KB) - smaller, likely quotation
// 1OrlS_baaIe6CXmc2UyhfZXvuN6Gwekfz (833KB) - larger, likely soil report
// Will mark as UNKNOWN for now - read later
await rename('1p2vOKJaY4hab0tB97ZAiBUOHDsgA75_Z', 'NAD_6185392_PRO-SOIL_251225_UNKNOWN-A_V00.pdf');
await rename('1OrlS_baaIe6CXmc2UyhfZXvuN6Gwekfz', 'NAD_6185392_PRO-SOIL_251225_UNKNOWN-B_V00.pdf');

// NAD_6185392 CONTRACTS
console.log('\n=== NAD_6185392 CONTRACTS ===');
await rename('1sK9PeaKsiKCr8p5FLktfhyeEl6Hsghge', 'NAD_6185392_NOV_240627_V00.pdf');
await rename('1onOGQFDgM89v90GFeVhsv3v1o-9S-q2t', 'NAD_6185392_SPA_V00.pdf');
await rename('1t2KYVQVDxP_8euMfXybCZF9NAF6ymTzX', 'NAD_6185392_FACT-SHEET_COMO_V00.pdf');

// ============================================
// NAD_6182776 PROPOSALS (NAS→NAD)
// ============================================
console.log('\n=== NAD_6182776 PROPOSALS ===');
await rename('1IBJB0rwBdInABNX41p7nNWUhSev-Ox8L', 'NAD_6182776_PRO-ENG_260218_XYZ_V00.pdf');
await rename('1plLlD5NjCZRns9VqOjjXbGj4VJnA9bF6', 'NAD_6182776_PRO-ENG_260213_ARTEC_V00.pdf');
// Old naming files - need to read to identify consultant
await rename('12R1l835yWqsCFFDMlFaBPsOUQbq_xxal', 'NAD_6182776_PRO-ENG_260212_UNKNOWN_V00.pdf');
await rename('1JJUpRyRT3gjTexLEKwP2QTt3L1_oakuH', 'NAD_6182776_PRO-ENG_260209_UNKNOWN_V00.pdf');
await rename('1aOHObcai4LkTfNh-ua89d9uxf6vYKWqb', 'NAD_6182776_PRO-ENG_2026_UNKNOWN_V00.pdf');

// ============================================
// NAD_6180578 PROPOSALS (NAS→NAD)
// ============================================
console.log('\n=== NAD_6180578 PROPOSALS ===');
await rename('1rxyr3FBQxUnxU9-SnF2Btc2KFUtJOQaZ', 'NAD_6180578_PRO-ENG_260209_REALISTIC_V00.pdf');
await rename('1wYPSOvGFWUWprVHxCisMUwaXjI2q3EAN', 'NAD_6180578_PRO-ENG_260212_DATUM_V00.pdf');
await rename('1QqNuWOWpD2YjbOHHhyja7fiV4K0wd_Yk', 'NAD_6180578_PRO-ENG_260213_ARTEC_V00.pdf');
await rename('1zpTctMahzkwlNX7tDTAEAk9odjqNO_xq', 'NAD_6180578_PRO-ENG_2026_UNKNOWN_V00.pdf');
await rename('1u7Lta8p3E7z6dDX7Fg6TAaa_bcQMYSyQ', 'NAD_6180578_PRO-SOIL_251225_UNKNOWN-A_V00.pdf');
await rename('1rKFUCt5mOowPoEkXmp93YfjK7zNqRRAo', 'NAD_6180578_PRO-SOIL_251225_UNKNOWN-B_V00.pdf');
await rename('1PRQW1Jt5JPuB4UsrfkSnVFLf-bfPGBVB', 'NAD_6180578_FACT-SHEET_COMO_V00.pdf');

// NAD_6180578 CONTRACTS
console.log('\n=== NAD_6180578 CONTRACTS ===');
await rename('1xlz3z20tBbTCd3EFjz4gfixsobQ2tzUL', 'NAD_6180578_NOV_240327_V00.pdf');
await rename('1aimJU_mNDtlkZK0kzPy3BKQExJ3vPF8P', 'NAD_6180578_SPA_V00.pdf');

// ============================================
// OLD FOLDER FILES (02_Proposals, Contracts & Agreements)
// ============================================
console.log('\n=== OLD FOLDER - SOIL INVESTIGATION ===');
await rename('1KgJpxnQo1p2RuOZbW74tSqj7oeCx3Lc0', 'NAD_6180578_QTN-SOIL_251225_REALISTIC_V00.pdf');
await rename('1LnEE5104oLOqSFjqJekH0FsBJYeySJc3', 'NAD_6180578_PRO-SOIL_REALISTIC_V00.pdf');

console.log('\n=== OLD FOLDER - LAND PURCHASE ===');
await rename('1-UOMlxCad_a_XYKXtAnPXT-7y8smaWHD', 'NAD_6180578_SPA-EXECUTED_V00.pdf');
await rename('1TWSS7mcrzcU-FzWDx8pCzko10dv6zJpj', 'NAD_6180578_NOV-NOVATION_V00.pdf');
await rename('1_ekq1ttKMPc3BpkFcLFp82-SNFprQN6o', 'NAD_6180578_FACT-SHEET-AR_1924_V00.pdf');

console.log('\n=== OLD FOLDER - SOIL REPORTS (duplicates?) ===');
await rename('13mpMRXXtjm53g9DyQ81V5MU2t86Us22s', 'NAD_6180578_QTN-SOIL_251225_REALISTIC_V00_DUP.pdf');
await rename('1JT15l-P9AXKadrHyb6vniUAI28iBhhyV', 'NAD_6180578_PRO-SOIL_REALISTIC_V00_DUP.pdf');

console.log('\n=== OLD FOLDER - CONSULTANT PROPOSALS ===');
await rename('1Ar-fkb3OITd_4SCNivLb6SV59sB0u-wq', 'NAD_6180578_PRO-ENG_260204_CV-INVEST_V00.pdf');

await connection.end();
console.log('\n=== ALL DONE ===');
