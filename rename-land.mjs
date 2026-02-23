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

const renames = [
  // 01. Plots Affection Plans
  { id: '1-0Y-G1Mp2NutDN1P-K4ar0FnaOZjCc-L', newName: 'JAD_3260885_AP_V1.0.pdf' },
  { id: '1eA4zVp2jBwppaGOtKEfioHYmiabwpnrf', newName: 'MAJ_6457879_AP_V1.0.pdf' },
  { id: '1SJzXWpCdKsbb265cGjcm28peIzgF8V56', newName: 'MAJ_6457956_AP_V1.0.pdf' },
  { id: '1EvZnRXdLYj-rHnHV-MkCQzV4m8aUuW0s', newName: 'NAD_6180578_AP_V1.0.pdf' },
  { id: '13yylipyq9DA6U_FAVuLhypMFdkISuTcp', newName: 'NAD_6182776_AP_V1.0.pdf' },
  { id: '1o9Wg40JoCP3UrrCoOpU4Zlz0GFAn74Ez', newName: 'NAD_6185392_AP_V1.0.pdf' },
  // 02. Title Deeds
  { id: '1KnQPHHU932jd4h9btJi8HQgy8EhafPG7', newName: 'JAD_3260885_TD_V1.0.pdf' },
  { id: '11i5l7lo_bzW6AfvmGZP3HKWJ7eu28xeN', newName: 'MAJ_6457956_TD_V1.0.pdf' },
  { id: '1fbtNGzNAkV92LLW7_62E4TQMKkOaJNFd', newName: 'NAD_6182776_TD_V1.0.pdf' },
  // 03. Plot Guidelines
  { id: '1k2tJo793ExIDlv7jCIi6mm_At4nKmMRR', newName: 'MAJ_6457879_PDG_V1.0.pdf' },
  { id: '1FSjJd105GGclt94sz89Ch1BRbb9fDmGe', newName: 'NAD_6185392_PDG_V1.0.pdf' },
  // 04. Site Plan
  { id: '1Qmp0t7pJ0p_EqSB86NnlYBgfvyJWHFEP', newName: 'JAD_3260885_STP_V1.0.pdf' },
  { id: '1ynX6NA622pcWOJpHcsL2HUq6llPP1t9D', newName: 'MAJ_6457956_STP_V1.0.pdf' },
  { id: '1ErxJD3nTtfoqjy9FjnpcEJBbwq0ZQhyI', newName: 'NAD_6180578_STP_V1.0.pdf' },
  { id: '1mgFU0V_NQ9jWArUP3hRUrDJ0Njfur-N-', newName: 'NAD_6185392_STP_V1.0.pdf' },
];

for (const r of renames) {
  try {
    const result = await drive.files.update({
      fileId: r.id,
      requestBody: { name: r.newName },
      supportsAllDrives: true,
    });
    console.log(`✅ ${result.data.name}`);
  } catch (error) {
    console.error(`❌ ${r.newName}: ${error.message}`);
  }
}

await connection.end();
