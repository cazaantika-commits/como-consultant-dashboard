import fs from 'node:fs';
import assert from 'node:assert/strict';
import {sql} from 'drizzle-orm';
import {getDb} from '../server/db';
import {getConfiguredMailboxAddress,fetchReadonlyFolderSince} from '../server/emailMonitor';
const root='/home/ubuntu/reports/como-directive-1350001-2026-10-28';
const save=(n:string,v:any)=>fs.writeFileSync(root+'/'+n+'.json',JSON.stringify(v,null,2)+'\n');
async function main(){
 fs.mkdirSync(root,{recursive:true});assert.equal(getConfiguredMailboxAddress(),'a.zaqout@comodevelopments.com');const db=await getDb();assert(db);const q=async(s:any)=>(await db.execute(s))[0] as any[];
 const authority={directive:await q(sql`SELECT * FROM como_next_staged_directives WHERE id=1350001 AND user_id=1`),dispatch:await q(sql`SELECT id,directive_id,state,started_at,last_progress_at,completed_at,delivery_attempts,execution_summary,result_json FROM como_manus_dispatches WHERE directive_id=1350001`)};save('authority',authority);
 const [e]=await q(sql`SELECT * FROM como_next_email_messages WHERE id=2610001 AND user_id=1 AND linked_work_file_id=390001 AND inbox_status='linked'`);assert(e);save('source',e);fs.writeFileSync(root+'/thread.txt',e.body_text+'\n');
 const a=await q(sql`SELECT * FROM como_next_email_attachments WHERE email_message_id=2610001 ORDER BY ordinal`);save('attachments',a);
 const before={files:await q(sql`SELECT * FROM como_next_work_files WHERE user_id=1 ORDER BY id`),lanes:await q(sql`SELECT * FROM como_next_lifecycle_lanes WHERE user_id=1 ORDER BY id`),pending:await q(sql`SELECT * FROM como_next_staged_directives WHERE user_id=1 AND status='pending' ORDER BY id`),actions:await q(sql`SELECT * FROM como_next_actions WHERE user_id=1 ORDER BY id`),communications:await q(sql`SELECT * FROM como_next_communications WHERE user_id=1 ORDER BY id`),ledgers:await q(sql`SELECT * FROM como_mailbox_draft_ledger WHERE user_id=1 ORDER BY id`)};if(!fs.existsSync(root+'/protected-before.json'))save('protected-before',before);
 console.log('SOURCE META',JSON.stringify(Object.fromEntries(Object.entries(e).filter(([k])=>!['body_text','body_html'].includes(k))),null,2));console.log('SOURCE THREAD\n'+e.body_text);console.log('ATTACHMENTS',JSON.stringify(a,null,2));
 if(process.argv.includes('--live')){const live:any={checkedAt:new Date().toISOString(),readOnly:true};for(const folder of ['Sent','Drafts']){console.log('COMO — read only '+folder);live[folder]=await fetchReadonlyFolderSince(folder,folder==='Sent'?72:24*365,100);console.log(folder,live[folder].messages.length)}save('response-live',live)}
 await(db as any).$client.end();
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1)});
