import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fetchEmailByUID,fetchReadonlyFolderSince,getConfiguredMailboxAddress} from '../server/emailMonitor';
const root='/home/ubuntu/reports/como-directive-1230001-2026-10-27';
const sha=(v:string|Buffer)=>createHash('sha256').update(v).digest('hex');
async function main(){
 assert.equal(getConfiguredMailboxAddress(),'a.zaqout@comodevelopments.com');
 const out:any={checkedAt:new Date().toISOString(),readOnly:true};
 out.Sent=await fetchReadonlyFolderSince('Sent',24,100);
 out.Drafts=await fetchReadonlyFolderSince('Drafts',24*365,100);
 const source=await fetchEmailByUID(516,'1767637251','INBOX');assert(source);
 assert.equal(sha(source.textBody.replace(/\r\n?/g,'\n').trim()),'36259ec159b4462fb2140beb3375b464176bc0b560fe7d7df0ea6f2eda46d84c');
 out.source={...source,attachments:source.attachments.map((a:any)=>({filename:a.filename,contentType:a.contentType,sha256:sha(a.content),size:a.content.length}))};
 fs.writeFileSync(root+'/live-proof.json',JSON.stringify(out,null,2)+'\n');
 console.log(JSON.stringify({sent:out.Sent.messages.map((m:any)=>({uid:m.uid,subject:m.subject,date:m.date})),drafts:out.Drafts.messages.map((m:any)=>({uid:m.uid,subject:m.subject})),sourceSha:sha(source.textBody.replace(/\r\n?/g,'\n').trim()),readOnly:true}));
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1)});
