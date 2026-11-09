import 'dotenv/config';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {sql} from 'drizzle-orm';
import {getDb} from '../server/db';
import {fetchEmailByUID,fetchReadonlyFolderSince} from '../server/emailMonitor';
const root='/home/ubuntu/reports/como-directive-1920001-2026-11-09';
const norm=(v:any)=>String(v||'').replace(/\r\n?/g,'\n').trim();
const sha=(v:string|Buffer)=>createHash('sha256').update(v).digest('hex');
async function main(){
 const db=await getDb();assert(db);const q=async(s:any)=>(await db.execute(s))[0]as any[];const ctx=JSON.parse(fs.readFileSync(root+'/context.json','utf8')),s=ctx.source;
 const live=await fetchEmailByUID(s.imap_uid,s.uid_validity,'INBOX');assert(live&&live.messageId===s.message_id&&sha(norm(live.textBody))===s.body_sha256);assert.equal(live.attachments.length,1);const a=live.attachments[0];assert(a.content&&a.filename===ctx.attachments[0].file_name);const path=root+'/'+a.filename;fs.writeFileSync(path,a.content);fs.writeFileSync(root+'/attachment-proof.json',JSON.stringify({sourceEmailId:s.id,sourceUid:s.imap_uid,path,fileName:a.filename,sha256:sha(a.content),bytes:a.content.length},null,2)+'\n');fs.writeFileSync(root+'/thread.txt',live.textBody+'\n');console.log('Source and receipt live matched');
 const snapshot={projects:await q(sql`SELECT * FROM projects WHERE userId=1 ORDER BY id`),files:await q(sql`SELECT * FROM como_next_work_files WHERE user_id=1 ORDER BY id`),actions:await q(sql`SELECT * FROM como_next_actions WHERE user_id=1 ORDER BY id`),lanes:await q(sql`SELECT * FROM como_next_lifecycle_lanes WHERE user_id=1 ORDER BY id`),decisions:await q(sql`SELECT * FROM como_next_decisions WHERE user_id=1 ORDER BY id`),pending:await q(sql`SELECT * FROM como_next_staged_directives WHERE user_id=1 AND status='pending' ORDER BY id`),communications:await q(sql`SELECT * FROM como_next_communications WHERE user_id=1 ORDER BY id`),ledgers:await q(sql`SELECT * FROM como_mailbox_draft_ledger WHERE user_id=1 ORDER BY id`),emails:await q(sql`SELECT * FROM como_next_email_messages WHERE user_id=1 ORDER BY id`)};fs.writeFileSync(root+'/protected-before.json',JSON.stringify(snapshot,null,2)+'\n');
 const m:any={checkedAt:new Date().toISOString()};for(const f of ['Sent','Drafts']){console.log('Read '+f);m[f]=await fetchReadonlyFolderSince(f,f==='Sent'?24*10:24*365,180);assert(m[f].messages.length<180);fs.writeFileSync(root+'/mail-before.json',JSON.stringify(m,null,2)+'\n');}
 console.log(JSON.stringify({relatedSent:m.Sent.messages.filter((v:any)=>/service charge|service charges|infrastructure|site services/i.test(v.subject)).map((v:any)=>({uid:v.uid,date:v.date,subject:v.subject,to:v.to,body:v.textBody})),relatedDrafts:m.Drafts.messages.filter((v:any)=>/service charge|service charges|infrastructure|site services/i.test(v.subject)).map((v:any)=>({uid:v.uid,subject:v.subject,to:v.to,key:v.headers?.['x-como-draft-key']}))}));await(db as any).$client.end();
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.stack);process.exit(1)});
