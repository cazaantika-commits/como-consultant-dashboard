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
    await connection.execute(
      'UPDATE oauthTokens SET accessToken = ?, expiresAt = ? WHERE refreshToken = ?',
      [credentials.access_token, credentials.expiry_date ? new Date(credentials.expiry_date) : null, token.refreshToken]
    );
  }
} catch (e) {}

const drive = google.drive({ version: 'v3', auth: oauth2Client });

async function rename(id, newName) {
  try {
    const result = await drive.files.update({
      fileId: id,
      requestBody: { name: newName },
      supportsAllDrives: true,
    });
    console.log(`✅ ${result.data.name}`);
  } catch (error) {
    console.error(`❌ ${newName}: ${error.message}`);
  }
}

console.log('=== JAD_3260885 CONTRACTS ===');
await rename('1T8Hh2QTJiVTCyMpqP2Og-G-v9J0xx2Mk', 'JAD_3260885_NOV-RESALE_240315_JADDAF-WF_V00.pdf');

console.log('\n=== JAD_3260885 PROPOSALS ===');
await rename('1wqVNd-qx2vQBrUulSCOPIPJcTt_Qz23J', 'JAD_3260885_FACT-SHEET_260205_COMO_V00.pdf');
// ARTEC and XYZ already correct
await rename('1AORBEofkHmQco9x60mTXwGOXqJqq8-OG', 'JAD_3260885_PRO-ENG_260209_OSUS_V00.pdf');
await rename('1syUa-0_lfzzaTMA4CjFzEOiEW6B-ZdjY', 'JAD_3260885_PRO-ENG_260209_REALISTIC_V00.pdf');
await rename('1Ca6KsRrdl2qzyZAHaodlfjqpFECfbqMJ', 'JAD_3260885_PRO-ENG_260212_DATUM_V00.pdf');
await rename('1WzZixBGCq_WJEgwGcUh5SJmBz-ToFvjy', 'JAD_3260885_PRO-ENG_250902_SAFEER_V00.pdf');

await connection.end();
console.log('\n=== DONE ===');
