import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {sql} from 'drizzle-orm';
import {getDb} from '../server/db';
import {fetchEmailByUID,fetchReadonlyFolderSince,getConfiguredMailboxAddress} from '../server/emailMonitor';
const root='/home/ubuntu/reports/como-directive-1320001-2026-10-28';
const sha=(v:Buffer|string)=>createHash('sha256').update(v).digest('hex');
async function main(){
 assert.equal(getConfiguredMailboxAddress(),'a.zaqout@comodevelopments.com');
 const db=await getDb();assert(db);
 const [e]=(await db.execute(sql`SELECT * FROM como_next_email_messages WHERE id=2550001 AND user_id=1`))[0] as any[];
 assert.equal(e.body_sha256,'efb93817d39b46f03c1e9660f046f767d52b151532b168bbce083901f2132e07');
 console.log('قراءة مصدرالسّطوة2550001 ومرفق التوقيع فقط');
 const source=await fetchEmailByUID(e.imap_uid,e.uid_validity,e.folder_name);assert(source);
 assert.equal(source.messageId,e.message_id);assert.equal(sha(source.textBody.trim().slice(0,1_000_000)),e.body_sha256);
 const attachments=source.attachments.map((a:any,i:number)=>{const file=root+`/attachment-${i}-${a.filename.replace(/[^a-zA-Z0-9_.-]/g,'_')}`;fs.writeFileSync(file,a.content);return{filename:a.filename,sha256:sha(a.content),byteSize:a.content.length,file,mime:a.contentType};});
 console.log('قراءة صادرالسّطوة ومسوداتCOMO الحالية');
 const [sent,drafts]=await Promise.all([fetchReadonlyFolderSince('Sent',24*10,100,undefined,'1641A'),fetchReadonlyFolderSince('Drafts',24*30,100)]);
 const proof={checkedAt:new Date().toISOString(),source:{...source,attachments},sent,drafts};
 fs.writeFileSync(root+'/live-proof.json',JSON.stringify(proof,null,2)+'\n');
 console.log(JSON.stringify({sourceUid:e.imap_uid,attachments,sent:sent.messages.map(m=>({uid:m.uid,date:m.date,messageId:m.messageId,subject:m.subject,body:m.textBody})),drafts:drafts.messages.filter(m=>/1641A|3347343/.test(m.subject)).map(m=>({uid:m.uid,messageId:m.messageId,body:m.textBody,headers:m.headers}))},null,2));
 await(db as any).$client.end();
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1)});
