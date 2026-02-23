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

async function readFileInfo(fileId, label) {
  try {
    const meta = await drive.files.get({ fileId, fields: 'name,size,mimeType,createdTime,modifiedTime', supportsAllDrives: true });
    console.log(`\n=== ${label} ===`);
    console.log(`Name: ${meta.data.name}`);
    console.log(`Size: ${Math.round(meta.data.size/1024)}KB`);
    console.log(`Type: ${meta.data.mimeType}`);
    console.log(`Created: ${meta.data.createdTime}`);
    console.log(`Modified: ${meta.data.modifiedTime}`);
    
    // Try to export/download first few bytes to identify
    if (meta.data.mimeType === 'application/pdf') {
      try {
        const response = await drive.files.get({ fileId, alt: 'media', supportsAllDrives: true }, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(response.data);
        // Extract text from first part of PDF
        const text = buffer.toString('utf-8', 0, Math.min(buffer.length, 5000));
        // Look for consultant names in the text
        const consultants = ['DATUM', 'REALISTIC', 'SAFEER', 'ARTEC', 'XYZ', 'OSUS', 'LACASA', 'CV INVEST', 'Datum', 'Realistic', 'Safeer', 'Artec', 'XYZ Engineering', 'Osus', 'LaCasa', 'La Casa'];
        for (const c of consultants) {
          if (text.includes(c)) {
            console.log(`>>> FOUND CONSULTANT: ${c}`);
          }
        }
        // Also look for common keywords
        const keywords = ['soil', 'Soil', 'SOIL', 'feasibility', 'Feasibility', 'FEASIBILITY', 'engineering', 'Engineering', 'ENGINEERING', 'proposal', 'Proposal', 'PROPOSAL', 'quotation', 'Quotation', 'QUOTATION', 'contract', 'Contract', 'CONTRACT'];
        for (const k of keywords) {
          if (text.includes(k)) {
            console.log(`>>> FOUND KEYWORD: ${k}`);
          }
        }
      } catch (e) {
        console.log(`Could not read content: ${e.message}`);
      }
    }
  } catch (error) {
    console.error(`Error reading ${label}: ${error.message}`);
  }
}

// UNKNOWN files to identify:
// NAD_6185392 - two old files
await readFileInfo('1p2vOKJaY4hab0tB97ZAiBUOHDsgA75_Z', 'NAD_6185392_PRO-SOIL_251225_UNKNOWN-A (264KB)');
await readFileInfo('1OrlS_baaIe6CXmc2UyhfZXvuN6Gwekfz', 'NAD_6185392_PRO-SOIL_251225_UNKNOWN-B (833KB)');

// NAD_6182776 - three old files
await readFileInfo('12R1l835yWqsCFFDMlFaBPsOUQbq_xxal', 'NAD_6182776_PRO-ENG_260212_UNKNOWN (444KB)');
await readFileInfo('1JJUpRyRT3gjTexLEKwP2QTt3L1_oakuH', 'NAD_6182776_PRO-ENG_260209_UNKNOWN (1109KB)');
await readFileInfo('1aOHObcai4LkTfNh-ua89d9uxf6vYKWqb', 'NAD_6182776_PRO-ENG_2026_UNKNOWN (2224KB)');

// NAD_6180578 - one old file
await readFileInfo('1zpTctMahzkwlNX7tDTAEAk9odjqNO_xq', 'NAD_6180578_PRO-ENG_2026_UNKNOWN (2374KB)');

await connection.end();
console.log('\n=== DONE READING ===');
