import fs from 'node:fs';
import {fetchReadonlyFolderSince,getConfiguredMailboxAddress} from '../server/emailMonitor';
const root='/home/ubuntu/reports/como-directive-1290001-2026-10-27';
async function main(){
 if(getConfiguredMailboxAddress()!=='a.zaqout@comodevelopments.com')throw Error('COMO_only');
 const proof:any={checkedAt:new Date().toISOString(),readOnly:true};
 for(const folder of ['Sent','Drafts']){
  console.log('ماجان — فحص '+folder+' قبل معالجة تسليمV4.');
  proof[folder]=await fetchReadonlyFolderSince(folder,folder==='Sent'?48:24*365,100);
  console.log(folder,proof[folder].messages.length);
 }
 fs.writeFileSync(root+'/response-live.json',JSON.stringify(proof,null,2)+'\n');
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1)});
