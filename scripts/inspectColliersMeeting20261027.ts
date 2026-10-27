import fs from 'node:fs';
import {fetchReadonlyFolderSince,getConfiguredMailboxAddress} from '../server/emailMonitor';
const root='/home/ubuntu/reports/colliers-meeting-2026-10-27';
async function main(){
 if(getConfiguredMailboxAddress()!=='a.zaqout@comodevelopments.com')throw Error('COMO_only');
 const out:any={checkedAt:new Date().toISOString(),readOnly:true};
 for(const folder of ['Sent','Drafts']){
  console.log('ماجان — فحص '+folder+' قبل تعديل رسالتي كولييرز.');
  const batch=await fetchReadonlyFolderSince(folder,folder==='Sent'?48:24*365,100);out[folder]=batch;
  console.log(JSON.stringify({folder,uidValidity:batch.uidValidity,count:batch.messages.length,messages:batch.messages.map(m=>({uid:m.uid,subject:m.subject,to:m.to,cc:m.cc,text:m.textBody.slice(0,1800),messageId:m.messageId,headers:m.headers}))},null,2));
 }
 fs.writeFileSync(root+'/live-before.json',JSON.stringify(out,null,2)+'\n');
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1)});
