import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {sql} from 'drizzle-orm';
import {getDb} from '../server/db';
import {getConfiguredMailboxAddress,fetchEmailByUID,fetchReadonlyFolderSince} from '../server/emailMonitor';
const root='/home/ubuntu/reports/como-batch150000x-2026-10-30';
const hash=(v:Buffer|string)=>createHash('sha256').update(v).digest('hex');
const sha=(v:any)=>hash(String(v||'').replace(/\r\n?/g,'\n').trim());
const save=(n:string,v:any)=>fs.writeFileSync(root+'/'+n+'.json',JSON.stringify(v,null,2)+'\n');
async function main(){
 assert.equal(getConfiguredMailboxAddress(),'a.zaqout@comodevelopments.com');const db=await getDb();assert(db);const q=async(s:any)=>(await db.execute(s))[0]as any[];
 const context=JSON.parse(fs.readFileSync(root+'/context.json','utf8'));const proof=[];
 for(const source of context.sources){
  const live=await fetchEmailByUID(Number(source.imap_uid),source.uid_validity,'INBOX');assert(live);assert.equal(live.messageId,source.message_id);assert.equal(sha(live.textBody),source.body_sha256);const dir=root+'/'+source.id;fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(dir+'/thread.txt',live.textBody+'\n');fs.writeFileSync(dir+'/source.json',JSON.stringify(source,null,2)+'\n');const records=context.attachments.filter((a:any)=>a.email_message_id===source.id);assert.equal(live.attachments.length,records.length);const attachments=[];
  for(const a of live.attachments){assert(a.content);const rec=records.find((r:any)=>r.file_name===a.filename);assert(rec);assert.equal(a.content.length,Number(rec.byte_size));if(rec.sha256)assert.equal(hash(a.content),rec.sha256);const name=String(a.filename).replace(/[\/\\]/g,'_');fs.writeFileSync(dir+'/'+name,a.content);attachments.push({...rec,path:dir+'/'+name,observedSha256:hash(a.content),verifiedSize:a.content.length});}
  proof.push({sourceEmailId:source.id,checkedAt:new Date().toISOString(),messageId:live.messageId,bodySha256:source.body_sha256,attachments,readOnly:true});save('source-proof',proof);console.log('Verified source',source.id,'attachments',attachments.length);
 }
 const live={checkedAt:new Date().toISOString(),Sent:await fetchReadonlyFolderSince('Sent',48,80),Drafts:await fetchReadonlyFolderSince('Drafts',24*365,100)};save('live-mail',live);
 const snapshot={files:await q(sql`SELECT * FROM como_next_work_files WHERE user_id=1 ORDER BY id`),lanes:await q(sql`SELECT * FROM como_next_lifecycle_lanes WHERE user_id=1 ORDER BY id`),pending:await q(sql`SELECT * FROM como_next_staged_directives WHERE user_id=1 AND status='pending' ORDER BY id`),actions:await q(sql`SELECT * FROM como_next_actions WHERE user_id=1 ORDER BY id`),communications:await q(sql`SELECT * FROM como_next_communications WHERE user_id=1 ORDER BY id`),ledgers:await q(sql`SELECT * FROM como_mailbox_draft_ledger WHERE user_id=1 ORDER BY id`),decisions:await q(sql`SELECT * FROM como_next_decisions WHERE user_id=1 ORDER BY id`),projects:await q(sql`SELECT * FROM projects ORDER BY id`),sources:await q(sql`SELECT * FROM como_next_email_messages WHERE user_id=1 AND (id IN(2820001,2820002,2820003) OR (folder_name='Sent' AND received_at>'2026-10-29 08:00:00')) ORDER BY id`)};save('protected-before',snapshot);console.log(JSON.stringify({sent:live.Sent.messages.map(m=>({uid:m.uid,subject:m.subject,to:m.to,messageId:m.messageId})),drafts:live.Drafts.messages.map(m=>({uid:m.uid,subject:m.subject,to:m.to}))}));await(db as any).$client.end();
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1)});
