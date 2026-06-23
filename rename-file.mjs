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

// Force refresh the token
try {
  const { credentials } = await oauth2Client.refreshAccessToken();
  oauth2Client.setCredentials(credentials);
  // Update token in DB
  if (credentials.access_token) {
    await connection.execute(
      'UPDATE oauthTokens SET accessToken = ?, expiresAt = ? WHERE refreshToken = ?',
      [credentials.access_token, credentials.expiry_date ? new Date(credentials.expiry_date) : null, token.refreshToken]
    );
    console.log('✅ Token refreshed');
  }
} catch (e) {
  console.error('⚠️ Token refresh failed:', e.message);
}

const drive = google.drive({ version: 'v3', auth: oauth2Client });

const fileId = process.argv[2];
const newName = process.argv[3];

if (!fileId || !newName) {
  console.log('Usage: npx tsx rename-file.mjs <fileId> <newName>');
  process.exit(1);
}

try {
  const result = await drive.files.update({
    fileId: fileId,
    requestBody: { name: newName },
    supportsAllDrives: true,
  });
  console.log(`✅ Renamed to: ${result.data.name}`);
} catch (error) {
  console.error(`❌ Error: ${error.message}`);
}

await connection.end();
