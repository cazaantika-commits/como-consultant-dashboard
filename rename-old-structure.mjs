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
    const tmpFile = `/tmp/read_${fileId}.pdf`;
    writeFileSync(tmpFile, buffer);
    try {
      execSync(`pdftotext -l 2 "${tmpFile}" /tmp/read_${fileId}.txt`, { timeout: 15000 });
      const text = readFileSync(`/tmp/read_${fileId}.txt`, 'utf-8');
      console.log(`\n=== ${label} ===`);
      console.log(text.substring(0, 1000));
      unlinkSync(`/tmp/read_${fileId}.txt`);
    } catch (e) {
      console.log(`pdftotext failed for ${label}`);
    }
    unlinkSync(tmpFile);
  } catch (error) {
    console.error(`Error reading ${label}: ${error.message}`);
  }
}

// ============================================
// 1. RENAME OLD PROJECT STRUCTURE FOLDERS
// ============================================
console.log('=== RENAME OLD PROJECT STRUCTURE FOLDERS ===');
await rename('1GFqD-QUbtDR0sba0IG76ipSmXHj0arey', 'NAD_6185392');
await rename('1aF5RHzbyRARMbenzhj0q6DuW8r9ggksO', 'NAD_6182776');
await rename('14tSk8DiknhHAzo8_NMUkLLOJ-Tyzu31D', 'NAD_6180578');
await rename('1VG3AGA1Lj73grRRU771PfBcBAf-Gh87_', 'MAJ_6457956');
await rename('1BXACPZnj_CzO5mCSbwoGm07GmjFIdlj1', 'MAJ_6457879');

// ============================================
// 2. READ AND RENAME CONSULTANCY QUOTATION FILES
// ============================================
console.log('\n=== READ CONSULTANCY QUOTATION FILES ===');
// Read the first one to identify
await readAndIdentify('1YrtrbT4y-NxFD0T9Fy3JS4GABWl81aRh', 'Consultancy Quotation Bousayf (in JAD proposals)');

// These are consultancy quotations for Al-Jadaf project
// "Consultancy Quotation - Mr. Eissay Bousayf - 3260885 - Al Jadaf.pdf"
await rename('1YrtrbT4y-NxFD0T9Fy3JS4GABWl81aRh', 'JAD_3260885_PRO-ENG_BOUSAYF_V00.pdf');
await rename('11p_hVqgUGMAfHq2KT2ma2Z6hCoC_mfBi', 'JAD_3260885_PRO-ENG_BOUSAYF_V00_DUP2.pdf');
await rename('1MWsmdCDvu-74s4DoXRKUhAUgjXfmS-8M', 'JAD_3260885_PRO-ENG_BOUSAYF_V00_DUP3.pdf');
await rename('15B8EQnwGLjm_e8KrS08Sa8W-NqNVFlva', 'JAD_3260885_PRO-ENG_BOUSAYF_V00_DUP4.pdf');

// ============================================
// 3. RENAME SERVICE PROVIDER PROFILE FOLDERS
// ============================================
console.log('\n=== RENAME SERVICE PROVIDER FOLDERS ===');
await rename('1MbRWuSa6eKlKkGwlUuIF_xB6F8svSgrm', 'ARTEC');
await rename('1K4kbZ3J0rUSGkU_P4Zc9bsIyFH4wt7h7', 'COLLIERS');
await rename('14BK1Q-Px_GCR1YJUL9E0BRZEEKeXfwxf', 'DATUM');
await rename('1_ZPgCDeNVFwK3bhYA9zZdMgYfhiQ3_ps', 'LACASA');
await rename('1riV1Is363cFKyYm0T_YByfOcYxokEa48', 'OSUS');
await rename('1XYqWJkVgGAA0q7C8_XsoOVuYF00WCI_X', 'REALISTIC');
await rename('1xF-hNcAFFHMwHHa1WZu_jaY9RxWcjsHR', 'SAFEER');
await rename('1By1TdAImiaBBcc5EGwEF0_MGziaQImmD', 'TARMAC');
await rename('1DZiEufVnI-HdX4pHzkiGh7c7ySEG7hVm', 'TRANS-SOIL');

// ============================================
// 4. RENAME SPREADSHEET FILES THAT ARE SHOWING AS FOLDERS
// ============================================
console.log('\n=== RENAME SPREADSHEET FILES ===');
await rename('1iNXsDP27CPupkzHPBc8rDsh2uyDno11z', 'NAD_6185392_NUMBERS.xlsx');
await rename('1pHCdRD0kh9iZvloMFoLOyAudsN8h2b-v', 'NAD_6185392_NUMBERS_DUP.xlsx');

// ============================================
// 5. RENAME AP (Authority Permits) PDF FILES
// ============================================
console.log('\n=== RENAME AP FILES ===');
await rename('1YWsdpC6IDl8n97ASd-Li3Gbxt7Rpyyg6', 'NAD_6180578_AP_V01.pdf');
await rename('1Q7P3IvlKK8lYXq3alFbmVf021v8vfTIT', 'JAD_3260885_AP_V01.pdf');
await rename('1avP482aoLsTBmqE7j8aFLyFUl3H-iCak', 'NAD_6182776_AP_V01.pdf');
await rename('1J7p2CQ9TcZ_C0TizHr2k4W66Ucm8Pc3g', 'NAD_6185392_AP_V01.pdf');
await rename('1F2MQzMlcp5hjHB0jxQqTkE8YQ5UuVX7Y', 'NAD_6185392_PDG_V01.pdf');

// ============================================
// 6. RENAME TITLE DEED FILES
// ============================================
console.log('\n=== RENAME TITLE DEED FILES ===');
await rename('1vPjsHVtKXouOplHvWGhP8eRFGuyRh9MQ', 'JAD_3260885_TITLE-DEED.pdf');
await rename('18Q3oCeDXh13Cgt-5P7uLDK9w-bw8U-oY', 'JAD_3260885_TITLE-DEED_DUP.pdf');

await connection.end();
console.log('\n=== ALL OLD STRUCTURE RENAMES DONE ===');
