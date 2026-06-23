import { fetchEmailsSince } from "./server/emailMonitor.ts";

try {
  const emails = await fetchEmailsSince(72);
  console.log('Total emails in last 72 hours:', emails.length);
  emails.slice(0, 10).forEach((e, i) => {
    console.log(`\n#${i+1}: UID=${e.uid}`);
    console.log(`  From: ${e.fromName} (${e.from})`);
    console.log(`  Subject: ${e.subject}`);
    console.log(`  Date: ${e.date.toISOString()}`);
    console.log(`  IsRead: ${e.isRead}`);
    console.log(`  Attachments: ${e.attachments.length}`);
  });
  process.exit(0);
} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
}
