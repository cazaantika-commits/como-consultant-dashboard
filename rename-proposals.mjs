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
    return true;
  } catch (error) {
    console.error(`❌ ${newName}: ${error.message}`);
    return false;
  }
}

// ===== STEP 1: Rename project folders =====
console.log('\n=== RENAMING PROJECT FOLDERS ===');
const folderRenames = [
  { id: '1P8AlxoabTktrFKmJ6h6qU5sa-w5huG7K', newName: 'JAD_3260885_PCA' },
  { id: '18Bga-rwJqOic1wKaESFqxdmdDTaV5sAW', newName: 'MAJ_6457879_PCA' },
  { id: '1ZR1tT3U1h2QiqMwoAM0nKXXamh4c2IrV', newName: 'MAJ_6457956_PCA' },
  { id: '1q-NynLm0O8yPjr7QV93yhHvi7rytHhuS', newName: 'NAD_6180578_PCA' },
  { id: '1Cq17UsAPAKnSFyOm28SSgFrh25Q_Te0K', newName: 'NAD_6182776_PCA' },
  { id: '1RcDTcqK9XLUpEKkBNMQnGbmCvzMqgJYL', newName: 'NAD_6185392_PCA' },
];

for (const r of folderRenames) {
  await rename(r.id, r.newName);
}

// ===== STEP 2: Rename subfolders (Proposals/Contracts) =====
console.log('\n=== RENAMING SUBFOLDERS ===');
const subfolderRenames = [
  // JAD
  { id: '1OPXsnMTtTce_niOwQwzQIDcp_JBq31GC', newName: 'Proposals' },
  { id: '1ZvONS3acpJ0tbOXin6PXZ2lf36BG-qiN', newName: 'Contracts' },
  // MAJ 6457879
  { id: '12gi-ndWRu_0uhmlnczbkTMMEB0biKYlz', newName: 'Proposals' },
  { id: '1PttLusNH3_g9mKfiOfvsSPHgQAz0e_Tz', newName: 'Contracts' },
  // MAJ 6457956
  { id: '1s2ITQVVYfMwM1v3kTf3S5SHm2i3n4HFH', newName: 'Proposals' },
  { id: '1e-ZeX7MgYCQlnJdWahgmKosz-804buyN', newName: 'Contracts' },
  // NAD 6180578
  { id: '1XRuIUOqJgaKZj5s7Z0tyw6MhlthjJA_E', newName: 'Proposals' },
  { id: '19bWMB2cmc4LoE5Px-4Kni2DJyVfEslo4', newName: 'Contracts' },
  // NAD 6182776
  { id: '1vT59nz5UceUB7fxI3-YFc7o4S-Qb5sMg', newName: 'Proposals' },
  { id: '16T5ccbFHB-d9Z7iVPRa79x_9bdrbPfsh', newName: 'Contracts' },
  // NAD 6185392
  { id: '1EySnGu_28xXXzX7fCfC9qx8RaJzPaLIy', newName: 'Proposals' },
  { id: '1oXVmjjRmLipG67_zTARgKcaq49cl7oVq', newName: 'Contracts' },
];

for (const r of subfolderRenames) {
  await rename(r.id, r.newName);
}

await connection.end();
console.log('\n=== DONE ===');
