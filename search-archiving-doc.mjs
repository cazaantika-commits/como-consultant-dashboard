import { google } from 'googleapis';

const serviceAccountKey = JSON.parse(
  Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_KEY, 'base64').toString('utf-8')
);
const auth = new google.auth.GoogleAuth({
  credentials: serviceAccountKey,
  scopes: ['https://www.googleapis.com/auth/drive'],
});

const drive = google.drive({ version: 'v3', auth });

async function main() {
  const searchResponse = await drive.files.list({
    q: `(name contains 'دستور' or name contains 'فهرس' or name contains 'Archiving' or name contains 'Naming' or name contains 'Standards') and trashed=false`,
    fields: 'files(id, name, mimeType, modifiedTime)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    orderBy: 'modifiedTime desc',
  });
  
  console.log('Found documents:');
  for (const file of searchResponse.data.files) {
    console.log(`\n📄 ${file.name}`);
    console.log(`   ID: ${file.id}`);
    console.log(`   Type: ${file.mimeType}`);
    console.log(`   Modified: ${new Date(file.modifiedTime).toLocaleString('ar-AE')}`);
  }
}

main().catch(console.error);
