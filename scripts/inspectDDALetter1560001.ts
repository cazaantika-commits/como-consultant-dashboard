import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {sql} from 'drizzle-orm';
import {getDb} from '../server/db';
import {fetchEmailByUID,fetchReadonlyFolderSince,getConfiguredMailboxAddress} from '../server/emailMonitor';
const root='/home/ubuntu/reports/como-directive-1560001-2026-11-02';
const save=(n:string,v:any)=>fs.writeFileSync(root+'/'+n+'.json',JSON.stringify(v,null,2)+'\n');
const hash=(v:string|Buffer)=>createHash('sha256').update(v).digest('hex');
const sha=(v:string)=>hash(String(v||'').replace(/\r\n?/g,'\n').trim());
async function main(){
 fs.mkdirSync(root,{recursive:true});const db=await getDb();assert(db);assert.equal(getConfiguredMailboxAddress(),'a.zaqout@comodevelopments.com');const q=async(s:any)=>(await db.execute(s))[0]as any[];
 const [source]=await q(sql`SELECT * FROM como_next_email_messages WHERE id=2880001 AND user_id=1 AND linked_work_file_id=390001 AND inbox_status='linked'`);assert(source);assert.equal(source.body_sha256,'a598f894f038679fc2d483bc3eff448417392454f150a8b284e97937b3bbc75c');assert.equal(sha(source.body_text),source.body_sha256);save('source',source);fs.writeFileSync(root+'/thread.txt',source.body_text+'\n');
 const attachments=await q(sql`SELECT * FROM como_next_email_attachments WHERE email_message_id=2880001 ORDER BY ordinal`);save('attachments',attachments);
 if(!fs.existsSync(root+'/protected-before.json'))save('protected-before',{files:await q(sql`SELECT * FROM como_next_work_files WHERE user_id=1 ORDER BY id`),lanes:await q(sql`SELECT * FROM como_next_lifecycle_lanes WHERE user_id=1 ORDER BY id`),pending:await q(sql`SELECT * FROM como_next_staged_directives WHERE user_id=1 AND status='pending' ORDER BY id`),actions:await q(sql`SELECT * FROM como_next_actions WHERE user_id=1 ORDER BY id`),communications:await q(sql`SELECT * FROM como_next_communications WHERE user_id=1 ORDER BY id`),ledgers:await q(sql`SELECT * FROM como_mailbox_draft_ledger WHERE user_id=1 ORDER BY id`),decisions:await q(sql`SELECT * FROM como_next_decisions WHERE user_id=1 ORDER BY id`)});
 const live=await fetchEmailByUID(Number(source.imap_uid),String(source.uid_validity),'INBOX');assert(live);assert.equal(live.messageId,source.message_id);assert.equal(sha(live.textBody),source.body_sha256);assert.equal(live.attachments.length,attachments.length);
 const remaining=[...attachments],proof:any[]=[];for(const a of live.attachments){assert(a.content);const digest=hash(a.content);const idx=remaining.findIndex(r=>r.file_name===a.filename&&r.sha256===digest);assert(idx>=0);const r=remaining.splice(idx,1)[0];assert.equal(a.content.length,Number(r.byte_size));const path=root+'/'+r.ordinal+'-'+r.document_id+'-'+String(r.file_name).replace(/[\/\\]/g,'_');fs.writeFileSync(path,a.content);proof.push({ordinal:r.ordinal,documentId:r.document_id,fileName:r.file_name,path,sha256:digest,size:a.content.length});}assert.equal(remaining.length,0);save('attachment-proof',proof);save('live-source-proof',{checkedAt:new Date().toISOString(),sourceId:2880001,sourceSha:source.body_sha256,readOnly:true,attachments:proof});
 const liveMail:any={checkedAt:new Date().toISOString(),readOnly:true};for(const f of ['Sent','Drafts']){console.log('Reading '+f);liveMail[f]=await fetchReadonlyFolderSince(f,f==='Sent'?24*4:24*365,100);}save('response-live',liveMail);
 save('current-context',{actions:await q(sql`SELECT * FROM como_next_actions WHERE user_id=1 AND work_file_id=390001 ORDER BY id`),relatedEmails:await q(sql`SELECT id,subject,received_at,folder_name,imap_uid,communication_id,reply_draft_communication_id FROM como_next_email_messages WHERE user_id=1 AND linked_work_file_id=390001 AND received_at>'2026-10-30 00:00:00' ORDER BY id`),existingDocWork:await q(sql`SELECT id,title,source_status,source_system,source_record_id FROM como_next_work_memory WHERE work_file_id=390001 AND (title LIKE '%DDA%' OR title LIKE '%تفويض%' OR title LIKE '%authority%' OR body LIKE '%525%') ORDER BY id DESC LIMIT 20`)});
 console.log(JSON.stringify({sourceId:2880001,files:proof.map(p=>p.path),sent:liveMail.Sent.messages.length,drafts:liveMail.Drafts.messages.length}));await(db as any).$client.end();
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1)});
