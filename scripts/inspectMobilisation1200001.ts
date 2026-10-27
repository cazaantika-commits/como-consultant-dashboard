import fs from 'node:fs';
import assert from 'node:assert/strict';
import {fetchReadonlyFolderSince,getConfiguredMailboxAddress} from '../server/emailMonitor';
const root='/home/ubuntu/reports/como-directives-1200001-1200002-2026-10-27';
async function main(){
 assert.equal(getConfiguredMailboxAddress(),'a.zaqout@comodevelopments.com');
 const out:any={checkedAt:new Date().toISOString(),readOnly:true};
 for(const folder of ['Sent','Drafts']){
  console.log('الفلل الأربع — فحص '+folder+' قبل الرد على موعد تنفيذ5586.');
  out[folder]=await fetchReadonlyFolderSince(folder,folder==='Sent'?24*14:24*365,100);
  console.log(JSON.stringify({folder,count:out[folder].messages.length}));
 }
 fs.writeFileSync(root+'/response-live.json',JSON.stringify(out,null,2)+'\n');
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1)});
