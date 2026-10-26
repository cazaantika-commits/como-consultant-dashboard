import fs from 'node:fs';
import {fetchReadonlyFolderSince,getConfiguredMailboxAddress} from '../server/emailMonitor';
const root='/home/ubuntu/reports/como-directive-1170001-2026-10-26';
async function main(){
 if(getConfiguredMailboxAddress()!=='a.zaqout@comodevelopments.com')throw Error('COMO_only');
 const out:any={checkedAt:new Date().toISOString(),readOnly:true};
 for(const folder of ['Sent','Drafts']){
  console.log('الفلل الأربع — قراءة '+folder+' قبل الرد على توصية فحص التربة.');
  out[folder]=await fetchReadonlyFolderSince(folder,folder==='Sent'?24*3:24*365,100);
  console.log(JSON.stringify({folder,count:out[folder].messages.length,messages:out[folder].messages.map(m=>({uid:m.uid,subject:m.subject,to:m.to,date:m.date}))}));
 }
 fs.writeFileSync(root+'/response-live.json',JSON.stringify(out,null,2)+'\n');
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1)});
