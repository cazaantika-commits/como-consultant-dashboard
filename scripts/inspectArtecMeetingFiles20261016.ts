import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {fetchEmailByUID,fetchReadonlyFolderSince,getConfiguredMailboxAddress} from '../server/emailMonitor';
const root='/home/ubuntu/reports/como-directives-810001-810002-2026-10-16';
const sha=(v:string|Buffer)=>createHash('sha256').update(v).digest('hex');
async function main(){
 if(getConfiguredMailboxAddress()!=='a.zaqout@comodevelopments.com')throw Error('como_only');
 const [source,sent,drafts]=await Promise.all([fetchEmailByUID(503,'1767637251','INBOX'),fetchReadonlyFolderSince('Sent',48,100,undefined,'6180578'),fetchReadonlyFolderSince('Drafts',168,100,undefined,'6180578')]);
 if(!source||sha(source.textBody.replace(/\r\n?/g,'\n').trim())!=='1f65c04b933ff66e9b1425fe4f9778dab4cb44c96fa8a78fc132646af586aaa7')throw Error('live_source_changed');
 const sourceProof={...source,attachments:source.attachments.map(a=>({...a,content:undefined,contentSha256:a.content?sha(a.content):null}))};
 const manifest=JSON.parse(fs.readFileSync(`${root}/attachment-manifest.json`,'utf8'));
 const refs=JSON.parse(fs.readFileSync(`${root}/document-refs.json`,'utf8'));
 if(source.attachments.length!==4)throw Error('attachment_count_changed');
 for(const d of refs){const a=sourceProof.attachments.find(a=>a.filename===d.file_name);if(a?.contentSha256!==d.sha256||sha(fs.readFileSync(manifest.find((m:any)=>m.id===d.id).path))!==d.sha256)throw Error('attachment_sha_changed');}
 const proof={source:sourceProof,sent,drafts,checkedAt:new Date().toISOString()};fs.writeFileSync(`${root}/live-proof.json`,JSON.stringify(proof,null,2)+'\n');
 console.log(JSON.stringify({sourceUid:503,attachments:sourceProof.attachments.map(a=>({name:a.filename,sha:a.contentSha256})),sent:sent.messages.map(m=>({uid:m.uid,id:m.messageId,subject:m.subject,date:m.date,body:m.textBody,headers:m.headers})),drafts:drafts.messages.map(m=>({uid:m.uid,id:m.messageId,subject:m.subject,body:m.textBody,headers:m.headers}))}));
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1)});
