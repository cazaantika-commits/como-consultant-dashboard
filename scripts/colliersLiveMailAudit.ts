import {fetchReadonlyFolderSince,fetchEmailByUID} from '../server/emailMonitor';
import {writeFile} from 'node:fs/promises';
const results:Record<string,unknown>={capturedAt:new Date().toISOString()};
for(const folder of ['INBOX','Sent','Drafts']){
 console.log('Read-only',folder);
 const batch=await fetchReadonlyFolderSince(folder,24*20,500);
 const matching=batch.messages.filter(e=>/colliers|charitha|7314002290/i.test(`${e.from} ${e.to} ${e.subject} ${e.textBody.slice(0,1500)}`));
 results[folder]={...batch,messages:matching};
 console.log(folder,'scanned',batch.messages.length,'matching',matching.map(e=>({uid:e.uid,subject:e.subject,date:e.date,text:e.textBody.slice(0,450)})));
}
await writeFile('/home/ubuntu/reports/colliers-lifecycle-2026-10-12/live-mail.json',JSON.stringify(results,null,2)+'\n');
console.log('Saved live-mail.json');process.exit(0);
