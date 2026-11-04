import 'dotenv/config';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {sql} from 'drizzle-orm';
import {getDb} from '../server/db';
import {fetchReadonlyFolderSince} from '../server/emailMonitor';
const root='/home/ubuntu/reports/artec-mom-c-owner-comments-2026-11-04';
const sha=(v:any)=>createHash('sha256').update(String(v||'').replace(/\r\n?/g,'\n').trim()).digest('hex');
async function main(){
 const journal=JSON.parse(fs.readFileSync(root+'/replacement-journal.json','utf8'));assert.equal(journal.phase,'replace_verified');assert.equal(journal.newUid,997);
 const db=await getDb();assert(db);const q=async(s:any)=>(await db.execute(s))[0];
 const state={communication:await q(sql`SELECT id,external_message_ref,sent_at FROM como_next_communications WHERE id=4260001`),ledger:await q(sql`SELECT id,draft_uid,state,sent_uid FROM como_mailbox_draft_ledger WHERE id=1410001`),decision:await q(sql`SELECT id,decision_status FROM como_next_decisions WHERE id=360001`),memory:await q(sql`SELECT id,source_record_id FROM como_next_work_memory WHERE source_record_id='owner-artec-mom-c02:20261104:client-comments'`)};
 const mail={checkedAt:new Date().toISOString(),Drafts:await fetchReadonlyFolderSince('Drafts',24*365,100),Sent:await fetchReadonlyFolderSince('Sent',72,100)};fs.writeFileSync(root+'/mail-exception-live.json',JSON.stringify(mail,null,2)+'\n');
 const matches=(v:any)=>v.messageId===journal.messageId||v.headers?.['x-como-draft-key']==='email-reply-draft:2940001'||v.subject===journal.subject||sha(v.textBody)===journal.newHash;
 const result={checkedAt:new Date().toISOString(),state,Drafts:mail.Drafts.messages.map((v:any)=>({uid:v.uid,subject:v.subject,matches:matches(v),sha:sha(v.textBody),messageId:v.messageId,key:v.headers?.['x-como-draft-key']})),Sent:mail.Sent.messages.map((v:any)=>({uid:v.uid,subject:v.subject,matches:matches(v),to:v.to,cc:v.cc,date:v.date,sha:sha(v.textBody),messageId:v.messageId,key:v.headers?.['x-como-draft-key']})),replaceRepeated:false};fs.writeFileSync(root+'/read-only-exception-observation.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));await(db as any).$client.end();
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.stack);process.exit(1)});
