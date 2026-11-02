import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {sql} from 'drizzle-orm';
import {getDb} from '../server/db';
import {fetchEmailByUID,fetchReadonlyFolderSince,getConfiguredMailboxAddress} from '../server/emailMonitor';
const root='/home/ubuntu/reports/como-batch159000x-2026-11-02';
const save=(n:string,v:any)=>fs.writeFileSync(root+'/'+n+'.json',JSON.stringify(v,null,2)+'\n');
const hash=(v:string|Buffer)=>createHash('sha256').update(v).digest('hex');
const sha=(v:string)=>hash(String(v||'').replace(/\r\n?/g,'\n').trim());
async function main(){
 fs.mkdirSync(root,{recursive:true});const db=await getDb();assert(db);assert.equal(getConfiguredMailboxAddress(),'a.zaqout@comodevelopments.com');const q=async(s:any)=>(await db.execute(s))[0]as any[];
 if(!fs.existsSync(root+'/protected-before.json'))save('protected-before',{files:await q(sql`SELECT * FROM como_next_work_files WHERE user_id=1 ORDER BY id`),lanes:await q(sql`SELECT * FROM como_next_lifecycle_lanes WHERE user_id=1 ORDER BY id`),pending:await q(sql`SELECT * FROM como_next_staged_directives WHERE user_id=1 AND status='pending' ORDER BY id`),actions:await q(sql`SELECT * FROM como_next_actions WHERE user_id=1 ORDER BY id`),communications:await q(sql`SELECT * FROM como_next_communications WHERE user_id=1 ORDER BY id`),ledgers:await q(sql`SELECT * FROM como_mailbox_draft_ledger WHERE user_id=1 ORDER BY id`),decisions:await q(sql`SELECT * FROM como_next_decisions WHERE user_id=1 ORDER BY id`)});
 for(const [id,digest]of [[2910001,'f70cf1a3489fc258c230f48f169a16d3731648c04c71c81a392e8337ffab47d9'],[2940001,'3b29d0c54e8b36e5e0182da545835abab8118bc0c49a8ebd79c223297fbdd3ee']]as const){
 const [source]=await q(sql`SELECT * FROM como_next_email_messages WHERE id=${id} AND user_id=1 AND linked_work_file_id=390001 AND inbox_status='linked'`);assert(source);assert.equal(sha(source.body_text),digest);const at=await q(sql`SELECT * FROM como_next_email_attachments WHERE email_message_id=${id} ORDER BY ordinal`);save(id+'-source',source);save(id+'-attachments',at);
 const live=await fetchEmailByUID(Number(source.imap_uid),String(source.uid_validity),'INBOX');assert(live);assert.equal(live.messageId,source.message_id);assert.equal(sha(live.textBody),digest);assert.equal(live.attachments.length,at.length);const remaining=[...at],proof:any[]=[];fs.mkdirSync(root+'/'+id,{recursive:true});for(const a of live.attachments){assert(a.content);const d=hash(a.content);const idx=remaining.findIndex(r=>r.file_name===a.filename&&r.sha256===d);assert(idx>=0);const r=remaining.splice(idx,1)[0];assert.equal(a.content.length,Number(r.byte_size));const path=root+'/'+id+'/'+r.ordinal+'-'+r.document_id+'-'+String(r.file_name).replace(/[\/\\]/g,'_');fs.writeFileSync(path,a.content);proof.push({ordinal:r.ordinal,documentId:r.document_id,fileName:r.file_name,path,sha256:d,size:a.content.length});}assert.equal(remaining.length,0);save(id+'-proof',proof);console.log(JSON.stringify({sourceId:id,files:proof.map(p=>p.path)}));
 }
 const mail:any={checkedAt:new Date().toISOString(),readOnly:true};for(const folder of ['Sent','Drafts']){console.log('Reading '+folder);mail[folder]=await fetchReadonlyFolderSince(folder,folder==='Sent'?96:24*365,100);}save('response-live',mail);
 console.log('Inspection complete');await(db as any).$client.end();
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1)});
