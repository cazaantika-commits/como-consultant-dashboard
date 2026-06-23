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
  { id: '1oRQdrJyhn5vWTzUW9vs7dssfpHviOopx', newName: '00_Land Ownership & Plot Info' },
  { id: '1I9ViwPBWvt6ErFdpWqrDDt65Sk5wwVY_', newName: '01_Studies & Feasibility' },
  { id: '1Q4IwTgJkzJMOKDqOQKCtRvjQVApFPcHv', newName: '02_Proposals Contracts & Agreements' },
  { id: '18pI1E9mJ6XnM6BNxToXbricSB2efGlWR', newName: '03_Authorities & Approvals' },
  { id: '1GMjUUc7VuYREsUIuu5EC6Rr3aVjxBn5t', newName: '04_Design & Drawings' },
  { id: '1UI4f0mBuoq4Jk3CBfkk58mncnlKef4pG', newName: '05_Costing & Finance' },
  { id: '1pLq6pQco9t72pRWOihvUmfIqRdwZq42-', newName: '06_Construction Progress' },
  { id: '1ed0YhtxTwyR-wmmGmHHzzu_lvZ2Qw2hZ', newName: '07_Communications & Meetings' },
  { id: '1Vmm4Rq-oH1mv9CeXIybf9Av74yx2-dC0', newName: '08_Final Delivery & Closure' },
  { id: '1w_82xqTGNxMGSjLx-hhBN83YctrY3D43', newName: '09_Project Summary & Tracking' },
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
