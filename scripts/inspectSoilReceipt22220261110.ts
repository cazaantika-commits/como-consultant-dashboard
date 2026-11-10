import 'dotenv/config';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {sql} from 'drizzle-orm';
import {getDb} from '../server/db';
import {fetchEmailByUID,fetchReadonlyFolderSince} from '../server/emailMonitor';
const root='/home/ubuntu/reports/como-directive-2220001-2026-11-10';
const norm=(v:any)=>String(v||'').replace(/\r\n?/g,'\n').trim();
const sha=(v:string|Buffer)=>createHash('sha256').update(v).digest('hex');
const save=(n:string,v:any)=>fs.writeFileSync(root+'/'+n+'.json',JSON.stringify(v,null,2)+'\n');
async function main(){
 const db=await getDb();assert(db);const q=async(s:any)=>(await db.execute(s))[0]as any[];
 const c=JSON.parse(fs.readFileSync(root+'/context.json','utf8')),s=c.source;
 const live=await fetchEmailByUID(s.imap_uid,s.uid_validity,'INBOX');assert(live&&live.messageId===s.message_id&&sha(norm(live.textBody))===s.body_sha256);assert.equal(live.attachments.length,1);
 const a=live.attachments[0];assert(a.content&&a.filename===c.attachments[0].file_name&&a.content.length===c.attachments[0].byte_size);
 const path=root+'/Soil_NOC_Payment_Receipt.jpeg';fs.writeFileSync(path,a.content);save('attachment-proof',{sourceEmailId:s.id,sourceUid:s.imap_uid,path,fileName:a.filename,sha256:sha(a.content),bytes:a.content.length});save('source-live',{messageId:live.messageId,date:live.date,subject:live.subject,to:live.to,cc:live.cc,body:live.textBody});
 console.log('Source3840001 and receipt matched live');
 const snapshots:any={};for(const [k,query]of Object.entries({projects:sql`SELECT * FROM projects WHERE userId=1 ORDER BY id`,files:sql`SELECT * FROM como_next_work_files WHERE user_id=1 ORDER BY id`,actions:sql`SELECT * FROM como_next_actions WHERE user_id=1 ORDER BY id`,lanes:sql`SELECT * FROM como_next_lifecycle_lanes WHERE user_id=1 ORDER BY id`,decisions:sql`SELECT * FROM como_next_decisions WHERE user_id=1 ORDER BY id`,pending:sql`SELECT * FROM como_next_staged_directives WHERE user_id=1 AND status='pending' ORDER BY id`,communications:sql`SELECT * FROM como_next_communications WHERE user_id=1 ORDER BY id`,ledgers:sql`SELECT * FROM como_mailbox_draft_ledger WHERE user_id=1 ORDER BY id`,emails:sql`SELECT * FROM como_next_email_messages WHERE user_id=1 ORDER BY id`}))snapshots[k]=await q(query);save('protected-before',snapshots);
 const m:any={checkedAt:new Date().toISOString()};for(const f of ['Sent','Drafts']){console.log('Reading '+f);m[f]=await fetchReadonlyFolderSince(f,f==='Sent'?48:24*365,180);assert(m[f].messages.length<180);save('mail-before',m);}
 console.log(JSON.stringify({relatedSent:m.Sent.messages.filter((v:any)=>/3113149|soil investigation|soil.*noc/i.test(v.subject+' '+v.textBody)).map((v:any)=>({uid:v.uid,date:v.date,subject:v.subject,to:v.to,cc:v.cc,body:v.textBody,attachments:v.attachments})),relatedDrafts:m.Drafts.messages.filter((v:any)=>/3113149|soil.*noc/i.test(v.subject+' '+v.textBody)).map((v:any)=>({uid:v.uid,subject:v.subject,to:v.to,cc:v.cc,key:v.headers?.['x-como-draft-key']})),actions:snapshots.actions.filter((v:any)=>v.work_file_id===390001&&!['verified','cancelled'].includes(v.action_status))},null,2));await(db as any).$client.end();
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.stack);process.exit(1)});
