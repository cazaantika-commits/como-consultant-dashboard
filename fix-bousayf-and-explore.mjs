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

async function listAll(parentId, indent = '', maxDepth = 3, currentDepth = 0) {
  if (currentDepth >= maxDepth) return;
  try {
    const res = await drive.files.list({
      q: `'${parentId}' in parents and trashed = false`,
      fields: 'files(id, name, mimeType, size)',
      pageSize: 200,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      orderBy: 'name',
    });
    for (const f of (res.data.files || [])) {
      const isFolder = f.mimeType === 'application/vnd.google-apps.folder';
      console.log(`${indent}${isFolder ? '📁' : '📄'} ${f.name} [${f.id}] ${f.size ? `(${Math.round(f.size/1024)}KB)` : ''}`);
      if (isFolder) await listAll(f.id, indent + '  ', maxDepth, currentDepth + 1);
    }
  } catch (error) {
    console.log(`${indent}⚠️ Error: ${error.code}`);
  }
}

// Fix Bousayf files - they're actually from OSUS consultant, dated 260108
console.log('=== FIX BOUSAYF → OSUS ===');
await rename('1YrtrbT4y-NxFD0T9Fy3JS4GABWl81aRh', 'JAD_3260885_PRO-ENG_260108_OSUS_V00.pdf');
await rename('11p_hVqgUGMAfHq2KT2ma2Z6hCoC_mfBi', 'JAD_3260885_PRO-ENG_260108_OSUS_V00_DUP2.pdf');
await rename('1MWsmdCDvu-74s4DoXRKUhAUgjXfmS-8M', 'JAD_3260885_PRO-ENG_260108_OSUS_V00_DUP3.pdf');
await rename('15B8EQnwGLjm_e8KrS08Sa8W-NqNVFlva', 'JAD_3260885_PRO-ENG_260108_OSUS_V00_DUP4.pdf');

// Now explore the old project folders to see if they have files inside that need renaming
console.log('\n=== EXPLORING OLD PROJECT FOLDERS ===');

// NAD_6185392 (was: G+2P+6 Nad Al Sheba Gardens_6185392)
console.log('\n--- NAD_6185392 (old structure) ---');
await listAll('1GFqD-QUbtDR0sba0IG76ipSmXHj0arey', '  ', 3, 0);

// NAD_6182776 (was: G+2P+6 Nad Al Sheba Gardens_6182776 المدمجة)
console.log('\n--- NAD_6182776 (old structure) ---');
await listAll('1aF5RHzbyRARMbenzhj0q6DuW8r9ggksO', '  ', 3, 0);

// NAD_6180578 (was: PROJECT_P003_NAD_AL_SHEBA hgllllllll)
console.log('\n--- NAD_6180578 (old structure) ---');
await listAll('14tSk8DiknhHAzo8_NMUkLLOJ-Tyzu31D', '  ', 3, 0);

// MAJ_6457956 (was: G+4 Shopping Centre_Majan_6457956)
console.log('\n--- MAJ_6457956 (old structure) ---');
await listAll('1VG3AGA1Lj73grRRU771PfBcBAf-Gh87_', '  ', 3, 0);

// MAJ_6457879 (was: G+4P+25_Majan_6457879)
console.log('\n--- MAJ_6457879 (old structure) ---');
await listAll('1BXACPZnj_CzO5mCSbwoGm07GmjFIdlj1', '  ', 3, 0);

// Also check if there's a JAD project folder in the old structure
const jadSearch = await drive.files.list({
  q: `name contains 'Jadaf' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
  fields: 'files(id, name, parents)',
  pageSize: 10,
  supportsAllDrives: true,
  includeItemsFromAllDrives: true,
});
console.log('\n--- JAD folders found ---');
for (const f of (jadSearch.data.files || [])) {
  console.log(`📁 ${f.name} [${f.id}] parents: ${JSON.stringify(f.parents)}`);
}

await connection.end();
