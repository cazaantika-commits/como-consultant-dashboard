import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {sql} from 'drizzle-orm';
import {getDb} from '../server/db';
import {fetchEmailByUID,fetchReadonlyFolderSince,getConfiguredMailboxAddress} from '../server/emailMonitor';
const root='/home/ubuntu/reports/como-directive-1080001-2026-10-26';
const hash=(v:string|Buffer)=>createHash('sha256').update(v).digest('hex');
const norm=(v:string)=>v.trim().slice(0,1_000_000);
const rows=(v:any)=>v[0] as any[];
async function main(){
 assert.equal(getConfiguredMailboxAddress(),'a.zaqout@comodevelopments.com');
 const db=await getDb();assert(db);
 const [e]=rows(await db.execute(sql`SELECT * FROM como_next_email_messages WHERE id=2190001 AND user_id=1`));
 assert.equal(e.body_sha256,'1fd0a6857cfba2575e6b725735bfb4b6bcc3b0606a77ba7018898cef279de2e0');
 console.log('السطوة — قراءة المصدر2190001 ومرفق التوقيع فقط');
 const source=await fetchEmailByUID(e.imap_uid,e.uid_validity,e.folder_name);assert(source);
 assert.equal(source.messageId,e.message_id);assert.equal(hash(norm(source.textBody)),e.body_sha256);
 const attachments=source.attachments.map((a:any,i:number)=>{const file=root+`/attachment-${i}-${a.filename.replace(/[^a-zA-Z0-9_.-]/g,'_')}`;fs.writeFileSync(file,a.content);return{...a,content:undefined,sha256:hash(a.content),file};});
 console.log('السطوة — قراءةSentوDraftsبالمرجع1641Aلمنعردمكرر');
 const [sent,drafts]=await Promise.all([fetchReadonlyFolderSince('Sent',24*14,100,undefined,'1641A'),fetchReadonlyFolderSince('Drafts',24*30,100,undefined,'1641A')]);
 const proof={checkedAt:new Date().toISOString(),source:{...source,attachments},sent,drafts};
 fs.writeFileSync(root+'/live-proof.json',JSON.stringify(proof,null,2)+'\n');
 console.log(JSON.stringify({checkedAt:proof.checkedAt,sourceUid:e.imap_uid,sourceDate:source.date,attachments:attachments.map(a=>({file:a.file,sha256:a.sha256,size:a.contentSize,mime:a.contentType,disposition:a.contentDisposition})),sent:sent.messages.map(m=>({uid:m.uid,date:m.date,messageId:m.messageId,subject:m.subject,text:m.textBody,headers:m.headers})),drafts:drafts.messages.map(m=>({uid:m.uid,date:m.date,messageId:m.messageId,subject:m.subject,text:m.textBody,to:m.to,cc:m.cc,headers:m.headers}))},null,2));
 await (db as any).$client.end();
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1)});
