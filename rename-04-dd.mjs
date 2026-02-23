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
// RENAME PROJECT SUBFOLDERS
// ============================================
console.log('=== RENAME PROJECT FOLDERS ===');
await rename('1HlMjusjMAUF3dj-qSxzxFSWHMmWjvAvG', 'JAD_3260885_DD');
await rename('1vQrZUSKFF6hMtq-4V9yDql8fAMWAISx-', 'NAD_6180578_DD');
await rename('1rur7w57yKKsIrCXf7jY2UFeY31Hb7S5v', 'NAD_6185392_DD');

// ============================================
// JAD_3260885_DD / Consultant - Al Sarh - Concept Design
// ============================================
console.log('\n=== JAD_3260885 DRAWINGS ===');
await rename('1RSicoLUKl1a_R3ADgMShf2KLRXccHNoA', 'JAD_3260885_DWG-CONCEPT_ALSARH_V01.pdf');
await rename('1NQhkKpHup7iztSvYvos2alFN432zwJsY', 'JAD_3260885_DWG-CONCEPT_ALSARH_V02.pdf');
await rename('19EPqHlbXU2uCuQzBTtCRDaXKykzKo3MX', 'JAD_3260885_DWG-CONCEPT_ALSARH_V03.pdf');
await rename('1Vrdn3PXMLDWM2Cxp8p-xOBrgFvCrQ3s7', 'JAD_3260885_DWG-CONCEPT_ALSARH_V04.pdf');
await rename('1hjS051HPlTYmsEEiDsDG-943I-ul-fRm', 'JAD_3260885_DWG-ARCH_ALSARH_V01.pdf');
await rename('12teSPiUNewBnJcNbFhDOY0n_CHQA5aNU', 'JAD_3260885_DWG-ARCH_250512_ALSARH_V03.pdf');
// This file is already renamed correctly but is in wrong folder (should be in Contracts)
// Just note it, don't rename again
// await rename('1vqrkHDyQXR2X_Al--ZGUw-LM5ldzPAMp', 'JAD_3260885_NOV-RESALE_240315_JADDAF-WF_V00.pdf');

// ============================================
// NAD_6180578_DD / Consultant - Al Sarh - Concept Design
// ============================================
console.log('\n=== NAD_6180578 DRAWINGS - Al Sarh ===');
await rename('12JX4iUsjBkieG4_VwsWMH8ATDCDwgekX', 'NAD_6180578_DWG-CONCEPT_ALSARH_V01.pdf');
await rename('1xHJF9ZWHzZES9S6hqreRlT1mJsdtkyrP', 'NAD_6180578_DWG-CONCEPT_ALSARH_V01-R3.pdf');
await rename('1dW0N_n6O1Vfkz2itOpyqZlgYW7uEiqxQ', 'NAD_6180578_DWG-CONCEPT_ALSARH_V03-R1.pdf');
await rename('1VE2eWwBxeiCsAeHV5d2SBKKs8PICD4Ue', 'NAD_6180578_DWG-CONCEPT_ALSARH_V03-R2.pdf');
await rename('1x9md2fXDXS5y_yMGzucjAkc2xLiXzahZ', 'NAD_6180578_DWG-CONCEPT_250224_ALSARH_V04.pdf');
await rename('1W1bJko0IhwsYDEtq8NoiydTdZgWbSKHC', 'NAD_6180578_DWG-CONCEPT_250302_ALSARH_V05.pdf');

// NAD_6180578_DD / Consultant - Alaalamia - Concept Design
console.log('\n=== NAD_6180578 DRAWINGS - Alaalamia ===');
await rename('1C9A6iiIURnzkYFnjIrLZfnkogX_ymmIt', 'NAD_6180578_DWG-CONCEPT_260111_ALAALAMIA_V00.pdf');

// ============================================
// NAD_6185392_DD / al sarah ARCHITECTURAL_DRAWINGS
// ============================================
console.log('\n=== NAD_6185392 DRAWINGS ===');
await rename('12SAXeXU6N0vKVxX6aVDddWTGmj_xITWu', 'NAD_6185392_DWG-ARCH_250512_ALSARH_V01.pdf');
await rename('1xkbkRJhsWV9rdengFSQ2qq9kL-Hei-YN', 'NAD_6185392_DWG-ARCH_250520_ALSARH_V02.pdf');
await rename('1u_TB3lvH1UE7fMu3HeMj81B0JHxGmGgt', 'NAD_6185392_DWG-ARCH_250520_ALSARH_V03.pdf');
await rename('1-kgATFvPO-uREBtF9-1xrDtl-vW_qX_N', 'NAD_6185392_DWG-ARCH_250520_ALSARH_V04.pdf');
await rename('1CDfq4bdGt-CNIbveqyitWdsDJmLKfHRa', 'NAD_6185392_DWG-ARCH_250520_ALSARH_V05.pdf');
await rename('1MatdSwTO8JGU0nAOUgwL7xzFzUEJkFHN', 'NAD_6185392_RPT-DESIGN-REVIEW_ALSARH_V00.pdf');

// ============================================
// RENAME CONSULTANT SUBFOLDERS
// ============================================
console.log('\n=== RENAME CONSULTANT SUBFOLDERS ===');
await rename('1bXq03fYbODBAKGn2xX_MABSjZ6wAr7WN', 'ALSARH_Concept-Design');
await rename('1IqJ6yY6W2L7OtCI3L4tEnrwjAFrR0YdK', 'ALSARH_Concept-Design');
await rename('1ydaJI-JtefslTJQTylaRcA5Tq_G-N_zO', 'ALAALAMIA_Concept-Design');
await rename('1L2TIyMFAA5lfN--StTLc1EOvVLtMIvaU', 'ALSARH_Architectural-Drawings');

await connection.end();
console.log('\n=== ALL 04_DD RENAMES DONE ===');
