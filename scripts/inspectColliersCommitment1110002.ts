import fs from 'node:fs';
import {fetchReadonlyFolderSince,getConfiguredMailboxAddress} from '../server/emailMonitor';
const root='/home/ubuntu/reports/como-directive-1110002-2026-10-26';
async function main(){
 if(getConfiguredMailboxAddress()!=='a.zaqout@comodevelopments.com')throw Error('COMO_only');
 const out:any={checkedAt:new Date().toISOString(),readOnly:true};
 for(const folder of ['Sent','Drafts']){
  console.log('ماجان — فحص '+folder+' لمنع تكرار الرد على تعهد كولييرز.');
  const b=await fetchReadonlyFolderSince(folder,folder==='Sent'?24*2:24*365,100);
  out[folder]=b;
  console.log(JSON.stringify({folder,uidValidity:b.uidValidity,count:b.messages.length,messages:b.messages.map(m=>({uid:m.uid,date:m.date,subject:m.subject,from:m.from,to:m.to,cc:m.cc,text:m.textBody.slice(0,950)}))},null,2));
 }
 fs.writeFileSync(root+'/response-live.json',JSON.stringify(out,null,2)+'\n');
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1)});
