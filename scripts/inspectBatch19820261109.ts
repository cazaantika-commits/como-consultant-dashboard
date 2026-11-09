import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {sql} from 'drizzle-orm';
import {getDb} from '../server/db';
import {fetchEmailByUID,fetchReadonlyFolderSince} from '../server/emailMonitor';
const root='/home/ubuntu/reports/como-batch198000x-2026-11-09';
const norm=(v:any)=>String(v||'').replace(/\r\n?/g,'\n').trim(),hash=(v:Buffer|string)=>createHash('sha256').update(v).digest('hex');
const save=(n:string,v:any)=>fs.writeFileSync(root+'/'+n+'.json',JSON.stringify(v,null,2)+'\n');
async function main(){
 const db=await getDb();assert(db);const q=async(s:any)=>(await db.execute(s))[0]as any[];
 const before={projects:await q(sql`SELECT * FROM projects WHERE userId=1 ORDER BY id`),files:await q(sql`SELECT * FROM como_next_work_files WHERE user_id=1 ORDER BY id`),actions:await q(sql`SELECT * FROM como_next_actions WHERE user_id=1 ORDER BY id`),communications:await q(sql`SELECT * FROM como_next_communications WHERE user_id=1 ORDER BY id`),ledgers:await q(sql`SELECT * FROM como_mailbox_draft_ledger WHERE user_id=1 ORDER BY id`),lanes:await q(sql`SELECT * FROM como_next_lifecycle_lanes WHERE user_id=1 ORDER BY id`),decisions:await q(sql`SELECT * FROM como_next_decisions WHERE user_id=1 ORDER BY id`),pending:await q(sql`SELECT * FROM como_next_staged_directives WHERE user_id=1 AND status='pending' ORDER BY id`),emails:await q(sql`SELECT * FROM como_next_email_messages WHERE user_id=1 ORDER BY id`)};if(!fs.existsSync(root+'/protected-before.json'))save('protected-before',before);
 const c=JSON.parse(fs.readFileSync(root+'/source-context.json','utf8'));const proof=[];
 for(const s of c.sources){
  const live=await fetchEmailByUID(s.imap_uid,s.uid_validity,s.folder_name);assert(live&&live.messageId===s.message_id&&hash(norm(live.textBody))===s.body_sha256);assert.equal(norm(live.subject),norm(s.subject));assert.equal(live.attachments.length,c.attachments.filter((a:any)=>a.email_message_id===s.id).length);const dir=root+'/attachments-'+s.id;fs.mkdirSync(dir,{recursive:true});const aa=[];
  for(let ordinal=0;ordinal<live.attachments.length;ordinal++){const a=live.attachments[ordinal];assert(a.content);const stored=c.attachments.find((v:any)=>v.email_message_id===s.id&&v.ordinal===ordinal);assert(stored&&stored.file_name===a.filename&&(!stored.sha256||stored.sha256===hash(a.content))&&Number(stored.byte_size)===a.content.length);const filename=path.basename(a.filename||'attachment-'+ordinal).replace(/[\/\\]/g,'_');const p=dir+'/'+filename;fs.writeFileSync(p,a.content);aa.push({sourceEmailId:s.id,ordinal,documentId:stored.document_id,path:p,filename,sha256:hash(a.content),bytes:a.content.length,mimeType:a.contentType,disposition:a.disposition});}
  const record={sourceEmailId:s.id,uid:s.imap_uid,messageId:live.messageId,subject:live.subject,from:live.from,to:live.to,cc:live.cc,bodySha256:s.body_sha256,date:live.date,attachments:aa};save('source-live-'+s.id,{...record,textBody:live.textBody});proof.push(record);
 }
 save('attachment-proof',proof);const mail:any={checkedAt:new Date().toISOString()};for(const f of ['Sent','Drafts']){mail[f]=await fetchReadonlyFolderSince(f,f==='Sent'?24*14:24*365,220);assert(mail[f].messages.length<220);save('mail-preflight',mail);}
 console.log(JSON.stringify({sources:proof.map(p=>({id:p.sourceEmailId,uid:p.uid,attachments:p.attachments.map(a=>({name:a.filename,path:a.path,sha:a.sha256}))})),sent:mail.Sent.messages.filter((m:any)=>/Soil Works|Topographic|Service Charges|Service Charge Payment/i.test(m.subject)).map((m:any)=>({uid:m.uid,subject:m.subject,to:m.to,cc:m.cc,date:m.date})),drafts:mail.Drafts.messages.filter((m:any)=>/Soil Works|Topographic|Service Charges|Service Charge Payment/i.test(m.subject)).map((m:any)=>({uid:m.uid,subject:m.subject,key:m.headers?.['x-como-draft-key']}))}));await(db as any).$client.end();
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.stack);process.exit(1)});
