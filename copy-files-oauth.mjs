import { google } from 'googleapis';
import mysql from 'mysql2/promise';

// Get DB connection
const dbUrl = process.env.DATABASE_URL;
const connection = await mysql.createConnection(dbUrl);

// Get OAuth tokens from DB
const [rows] = await connection.execute('SELECT accessToken, refreshToken, expiresAt, scope FROM oauthTokens LIMIT 1');
if (rows.length === 0) {
  console.log('❌ No OAuth token found!');
  process.exit(1);
}

const token = rows[0];
console.log('✅ Found OAuth token');

// Create OAuth client
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_OAUTH_CLIENT_ID,
  process.env.GOOGLE_OAUTH_CLIENT_SECRET
);

oauth2Client.setCredentials({
  access_token: token.accessToken,
  refresh_token: token.refreshToken,
  expiry_date: token.expiresAt ? new Date(token.expiresAt).getTime() : undefined,
});

const drive = google.drive({ version: 'v3', auth: oauth2Client });

// Parent folder: 02_Proposals, Contracts & Agreements
const parentFolderId = '1Q4IwTgJkzJMOKDqOQKCtRvjQVApFPcHv';

// ===== STEP 1: Find the ARTEC file =====
console.log('\n📋 Finding files in 02_Proposals root...');
const filesResponse = await drive.files.list({
  q: `'${parentFolderId}' in parents and mimeType!='application/vnd.google-apps.folder' and trashed=false`,
  fields: 'files(id, name)',
  supportsAllDrives: true,
  includeItemsFromAllDrives: true,
});

console.log('Files found:', filesResponse.data.files.map(f => f.name));

// Find ARTEC file (the remaining one after user deleted the other)
const artecFile = filesResponse.data.files.find(f => f.name.includes('202_2026'));
if (!artecFile) {
  console.log('❌ ARTEC file not found!');
  process.exit(1);
}
console.log(`\n✅ ARTEC file: ${artecFile.name} (${artecFile.id})`);

// ===== STEP 2: Find XYZ file in 00_Inbox/Ready =====
const readyFolderId = '1ZXzOEs-ITzUF6-r-Ii2cd7iRxBM1gGC7';
const readyFiles = await drive.files.list({
  q: `'${readyFolderId}' in parents and trashed=false`,
  fields: 'files(id, name)',
  supportsAllDrives: true,
  includeItemsFromAllDrives: true,
});

console.log('\nFiles in Ready folder:', readyFiles.data.files.map(f => f.name));
const xyzFile = readyFiles.data.files.find(f => f.name.includes('XYZ') || f.name.includes('012-26'));
if (xyzFile) {
  console.log(`✅ XYZ file: ${xyzFile.name} (${xyzFile.id})`);
} else {
  console.log('⚠️ XYZ file not found in Ready folder, checking Inbox root...');
}

// ===== STEP 3: Copy ARTEC file 5 times =====
console.log('\n🔄 Copying ARTEC file (5 copies)...');
const artecNames = [
  'JAD_3260885_PRO-ENG_260213_ARTEC_V00.pdf',
  'NAS_6180578_PRO-ENG_260213_ARTEC_V00.pdf',
  'NAS_6185392_PRO-ENG_260213_ARTEC_V00.pdf',
  'NAS_6182776_PRO-ENG_260213_ARTEC_V00.pdf',
  'MAJ_6457879_PRO-ENG_260213_ARTEC_V00.pdf',
];

for (const newName of artecNames) {
  try {
    const copied = await drive.files.copy({
      fileId: artecFile.id,
      requestBody: {
        name: newName,
        parents: [parentFolderId],
      },
      supportsAllDrives: true,
    });
    console.log(`  ✅ ${newName} (${copied.data.id})`);
  } catch (error) {
    console.error(`  ❌ ${newName} - ${error.message}`);
  }
}

// ===== STEP 4: Copy XYZ file 3 times =====
if (xyzFile) {
  console.log('\n🔄 Copying XYZ file (3 copies)...');
  const xyzNames = [
    'MAJ_6457879_PRO-ENG_260218_XYZ_V00.pdf',
    'NAS_6182776_PRO-ENG_260218_XYZ_V00.pdf',
    'JAD_3260885_PRO-ENG_260218_XYZ_V00.pdf',
  ];

  for (const newName of xyzNames) {
    try {
      const copied = await drive.files.copy({
        fileId: xyzFile.id,
        requestBody: {
          name: newName,
          parents: [parentFolderId],
        },
        supportsAllDrives: true,
      });
      console.log(`  ✅ ${newName} (${copied.data.id})`);
    } catch (error) {
      console.error(`  ❌ ${newName} - ${error.message}`);
    }
  }
}

console.log('\n✅ Done! All copies created in 02_Proposals, Contracts & Agreements folder.');

await connection.end();
