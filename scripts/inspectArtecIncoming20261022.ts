import fs from 'node:fs';
import {fetchReadonlyFolderSince,getConfiguredMailboxAddress} from '../server/emailMonitor';
const root='/home/ubuntu/reports/artec-incoming-2026-10-22';
async function main(){
 if(getConfiguredMailboxAddress()!=='a.zaqout@comodevelopments.com')throw Error('como_only');
 console.log('قراءة صندوقCOMO: وارد أرتك والصادر والمسودات للفلل الأربع.');
 const inbox=await fetchReadonlyFolderSince('INBOX',48,50,undefined,'6180578');
 const sent=await fetchReadonlyFolderSince('Sent',48,50,undefined,'6180578');
 const drafts=await fetchReadonlyFolderSince('Drafts',168,50,undefined,'6180578');
 const clean=(b:any)=>({...b,messages:b.messages.map((m:any)=>({...m,attachments:m.attachments.map((a:any)=>({filename:a.filename,contentType:a.contentType,size:a.content?.length||a.size,contentId:a.contentId}))}))});
 const result={inbox:clean(inbox),sent:clean(sent),drafts:clean(drafts),checkedAt:new Date().toISOString(),readOnly:true};
 fs.writeFileSync(`${root}/live-mail.json`,JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify(result,null,2));
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1)});
