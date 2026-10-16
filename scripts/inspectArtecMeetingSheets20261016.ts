import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {fetchEmailByUID,fetchReadonlyFolderSince,getConfiguredMailboxAddress} from '../server/emailMonitor';
const root='/home/ubuntu/reports/como-directive-870001-2026-10-16';
const sha=(v:string|Buffer)=>createHash('sha256').update(v).digest('hex');
const norm=(v:string)=>v.replace(/\r\n?/g,'\n').trim();
async function main(){
 if(getConfiguredMailboxAddress()!=='a.zaqout@comodevelopments.com')throw Error('como_only');
 const context=JSON.parse(fs.readFileSync(`${root}/source-context.json`,'utf8'));
 console.log('READING_COMO_INBOX504_SENT_AND_DRAFTS');
 const [source,sent,drafts]=await Promise.all([fetchEmailByUID(504,'1767637251','INBOX'),fetchReadonlyFolderSince('Sent',48,100,undefined,'6180578'),fetchReadonlyFolderSince('Drafts',72,100,undefined,'6180578')]);
 if(!source||source.messageId!==context.source[0].message_id||sha(norm(source.textBody))!==context.source[0].body_sha256)throw Error('source_changed');
 if(source.attachments.length!==8||context.attachments.length!==8)throw Error('attachment_count_changed');
 const attachmentProof=source.attachments.map((a,i)=>{
  const stored=context.attachments.find((v:any)=>v.ordinal===i);
  const manifest=JSON.parse(fs.readFileSync(`${root}/attachment-manifest.json`,'utf8')).find((v:any)=>v.documentId===stored?.document_id);
  if(!stored||!manifest||!a.content||sha(a.content)!==stored.sha256||sha(fs.readFileSync(manifest.path))!==stored.sha256||a.filename!==stored.file_name)throw Error('attachment_identity_changed');
  return {ordinal:i,name:a.filename,bytes:a.content.length,sha256:stored.sha256,documentId:stored.document_id};
 });
 const proof={source:{...source,attachments:attachmentProof},sent,drafts,checkedAt:new Date().toISOString(),mailboxWrite:false};
 fs.writeFileSync(`${root}/live-proof.json`,JSON.stringify(proof,null,2)+'\n');
 console.log(JSON.stringify({sourceUid:source.uid,attachmentProof,sent:sent.messages.map(m=>({uid:m.uid,messageId:m.messageId,date:m.date,subject:m.subject,textBody:m.textBody,headers:m.headers})),drafts:drafts.messages.map(m=>({uid:m.uid,messageId:m.messageId,subject:m.subject,textBody:m.textBody,headers:m.headers}))},null,2));
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1)});
