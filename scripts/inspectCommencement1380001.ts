import fs from 'node:fs';
import assert from 'node:assert/strict';
import {sql} from 'drizzle-orm';
import {getDb} from '../server/db';
import {getConfiguredMailboxAddress,fetchReadonlyFolderSince,fetchEmailByUID} from '../server/emailMonitor';
import {createHash} from 'node:crypto';
const root='/home/ubuntu/reports/como-directive-1380001-2026-10-29';
const save=(n:string,v:any)=>fs.writeFileSync(root+'/'+n+'.json',JSON.stringify(v,null,2)+'\n');
const hash=(v:string|Buffer)=>createHash('sha256').update(v).digest('hex');
const bodyHash=(v:string)=>hash(String(v||'').replace(/\r\n?/g,'\n').trim());
async function main(){
 fs.mkdirSync(root,{recursive:true});assert.equal(getConfiguredMailboxAddress(),'a.zaqout@comodevelopments.com');const db=await getDb();assert(db);const q=async(s:any)=>(await db.execute(s))[0] as any[];
 save('authority',{directive:await q(sql`SELECT * FROM como_next_staged_directives WHERE id=1380001 AND user_id=1`),dispatch:await q(sql`SELECT id,directive_id,state,started_at,last_progress_at,completed_at,execution_summary,result_json FROM como_manus_dispatches WHERE directive_id=1380001`)});
 const [e]=await q(sql`SELECT * FROM como_next_email_messages WHERE id=2640001 AND user_id=1 AND linked_work_file_id=390001 AND inbox_status='linked'`);assert(e);assert.equal(e.body_sha256,'2c3c03a559e78a1bbe5f85ce0082730fba28620613f630c4d734ba17d5e7b286');save('source',e);fs.writeFileSync(root+'/thread.txt',e.body_text+'\n');
 const a=await q(sql`SELECT * FROM como_next_email_attachments WHERE email_message_id=2640001 ORDER BY ordinal`);save('attachments',a);
 const before={files:await q(sql`SELECT * FROM como_next_work_files WHERE user_id=1 ORDER BY id`),lanes:await q(sql`SELECT * FROM como_next_lifecycle_lanes WHERE user_id=1 ORDER BY id`),pending:await q(sql`SELECT * FROM como_next_staged_directives WHERE user_id=1 AND status='pending' ORDER BY id`),actions:await q(sql`SELECT * FROM como_next_actions WHERE user_id=1 ORDER BY id`),communications:await q(sql`SELECT * FROM como_next_communications WHERE user_id=1 ORDER BY id`),ledgers:await q(sql`SELECT * FROM como_mailbox_draft_ledger WHERE user_id=1 ORDER BY id`)};if(!fs.existsSync(root+'/protected-before.json'))save('protected-before',before);
 console.log('Source UID',e.imap_uid,'attachments',a.length,'date',e.received_at);console.log(e.body_text);
 const l=await fetchEmailByUID(Number(e.imap_uid),String(e.uid_validity),'INBOX');assert(l);assert.equal(l.messageId,e.message_id);assert.equal(bodyHash(l.textBody),e.body_sha256);const proof=[];for(const x of l.attachments){assert(x.content);const rec=a.find(z=>z.file_name===x.filename);assert(rec);assert.equal(hash(x.content),rec.sha256);assert.equal(x.content.length,Number(rec.byte_size));const name=String(x.filename).replace(/[\/\\]/g,'_');fs.writeFileSync(root+'/'+name,x.content);proof.push({documentId:Number(rec.document_id),fileName:name,path:root+'/'+name,sha256:hash(x.content),size:x.content.length});}assert.equal(proof.length,a.length);save('attachment-proof',proof);save('live-source-proof',{checkedAt:new Date().toISOString(),sourceEmailId:e.id,messageId:l.messageId,bodySha256:e.body_sha256,readOnly:true,attachments:proof});
 const live:any={checkedAt:new Date().toISOString(),readOnly:true};for(const folder of ['Sent','Drafts']){console.log('Reading',folder);live[folder]=await fetchReadonlyFolderSince(folder,folder==='Sent'?96:24*365,100);console.log(folder,live[folder].messages.length);}save('response-live',live);await(db as any).$client.end();
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1)});
