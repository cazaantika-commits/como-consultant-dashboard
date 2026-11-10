import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {sql} from 'drizzle-orm';
import {getDb} from '../server/db';
import {fetchEmailByUID,fetchReadonlyFolderSince} from '../server/emailMonitor';
import {requireProjectAccess} from '../server/services/comoNextCommands';
const root='/home/ubuntu/reports/como-batch231000x-2026-11-10';
const hash=(v:Buffer|string)=>createHash('sha256').update(v).digest('hex');
const norm=(v:any)=>String(v||'').replace(/\r\n?/g,'\n').trim();
const save=(n:string,v:any)=>fs.writeFileSync(root+'/'+n+'.json',JSON.stringify(v,null,2)+'\n');
async function main(){
 const db=await getDb();assert(db);await requireProjectAccess(db,6,1,'read');const q=async(s:any)=>(await db.execute(s))[0]as any[];
 const snapshot={projects:await q(sql`SELECT * FROM projects WHERE userId=1 ORDER BY id`),files:await q(sql`SELECT * FROM como_next_work_files WHERE user_id=1 ORDER BY id`),actions:await q(sql`SELECT * FROM como_next_actions WHERE user_id=1 ORDER BY id`),communications:await q(sql`SELECT * FROM como_next_communications WHERE user_id=1 ORDER BY id`),ledgers:await q(sql`SELECT * FROM como_mailbox_draft_ledger WHERE user_id=1 ORDER BY id`),lanes:await q(sql`SELECT * FROM como_next_lifecycle_lanes WHERE user_id=1 ORDER BY id`),decisions:await q(sql`SELECT * FROM como_next_decisions WHERE user_id=1 ORDER BY id`),pending:await q(sql`SELECT * FROM como_next_staged_directives WHERE user_id=1 AND status='pending' ORDER BY id`),emails:await q(sql`SELECT * FROM como_next_email_messages WHERE user_id=1 ORDER BY id`)};if(!fs.existsSync(root+'/protected-before.json'))save('protected-before',snapshot);
 const c=JSON.parse(fs.readFileSync(root+'/context.json','utf8'));const s=c.email;assert(s.id===3900001&&s.linked_work_file_id===390001);const live=await fetchEmailByUID(s.imap_uid,s.uid_validity,s.folder_name);assert(live&&live.messageId===s.message_id&&hash(norm(live.textBody))===s.body_sha256);assert.equal(norm(live.subject),norm(s.subject));assert.equal(live.attachments.length,c.attachments.length);fs.mkdirSync(root+'/attachments',{recursive:true});const aa=[];
 for(let ordinal=0;ordinal<live.attachments.length;ordinal++){const a=live.attachments[ordinal],stored=c.attachments.find((v:any)=>v.ordinal===ordinal);assert(a.content&&stored);assert.equal(stored.file_name,a.filename);assert.equal(stored.sha256,hash(a.content));assert.equal(Number(stored.byte_size),a.content.length);const p=root+'/attachments/'+path.basename(a.filename||'attachment-'+ordinal);fs.writeFileSync(p,a.content);aa.push({ordinal,documentId:stored.document_id,path:p,filename:a.filename,sha256:hash(a.content),bytes:a.content.length,mimeType:a.contentType,disposition:a.disposition});}
 save('attachment-proof',aa);save('source-live',{sourceEmailId:s.id,uid:s.imap_uid,messageId:live.messageId,subject:live.subject,from:live.from,to:live.to,cc:live.cc,bodySha256:s.body_sha256,date:live.date,textBody:live.textBody,attachments:aa});const mail:any={checkedAt:new Date().toISOString()};for(const f of ['Sent','Drafts']){mail[f]=await fetchReadonlyFolderSince(f,f==='Sent'?24*7:24*365,220);assert(mail[f].messages.length<220);save('mail-preflight',mail);}
 console.log(JSON.stringify({source:s.id,uid:s.imap_uid,attachments:aa,sent:mail.Sent.messages.filter((v:any)=>/Soil Works/i.test(v.subject)).map((v:any)=>({uid:v.uid,date:v.date,subject:v.subject,to:v.to,cc:v.cc,body:v.textBody})),drafts:mail.Drafts.messages.filter((v:any)=>/Soil Works/i.test(v.subject)).map((v:any)=>({uid:v.uid,subject:v.subject,key:v.headers?.['x-como-draft-key']}))}));await(db as any).$client.end();
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.stack);process.exit(1)});
