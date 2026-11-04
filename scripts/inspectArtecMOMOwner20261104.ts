import 'dotenv/config';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {sql} from 'drizzle-orm';
import {getDb} from '../server/db';
import {requireProjectAccess} from '../server/services/comoNextCommands';
import {fetchReadonlyFolderSince,fetchEmailByUID,getConfiguredMailboxAddress} from '../server/emailMonitor';
const root='/home/ubuntu/reports/artec-mom-c-owner-comments-2026-11-04';
const save=(n:string,v:any)=>fs.writeFileSync(root+'/'+n+'.json',JSON.stringify(v,null,2)+'\n');
const sha=(v:any)=>createHash('sha256').update(String(v||'').replace(/\r\n?/g,'\n').trim()).digest('hex');
async function main(){
 fs.mkdirSync(root,{recursive:true});const db=await getDb();assert(db);await requireProjectAccess(db,6,1,'read');assert.equal(getConfiguredMailboxAddress(),'a.zaqout@comodevelopments.com');const q=async(s:any)=>(await db.execute(s))[0] as any[];
 const queries={projects:sql`SELECT * FROM projects WHERE userId=1 ORDER BY id`,files:sql`SELECT * FROM como_next_work_files WHERE user_id=1 ORDER BY id`,lanes:sql`SELECT * FROM como_next_lifecycle_lanes WHERE user_id=1 ORDER BY id`,pending:sql`SELECT * FROM como_next_staged_directives WHERE user_id=1 AND status='pending' ORDER BY id`,actions:sql`SELECT * FROM como_next_actions WHERE user_id=1 ORDER BY id`,communications:sql`SELECT * FROM como_next_communications WHERE user_id=1 ORDER BY id`,ledgers:sql`SELECT * FROM como_mailbox_draft_ledger WHERE user_id=1 ORDER BY id`,decisions:sql`SELECT * FROM como_next_decisions WHERE user_id=1 ORDER BY id`};
 const snap:any={checkedAt:new Date().toISOString()};for(const [k,v] of Object.entries(queries))snap[k]=await q(v);if(!fs.existsSync(root+'/protected-before.json'))save('protected-before',snap);
 const source=await q(sql`SELECT * FROM como_next_email_messages WHERE user_id=1 AND id=2940001`);assert.equal(source.length,1);save('source',source[0]);const live=await fetchEmailByUID(Number(source[0].imap_uid),String(source[0].uid_validity),'INBOX');assert(live);assert.equal(live.messageId,source[0].message_id);assert.equal(sha(live.textBody),source[0].body_sha256);save('source-live',{...live,attachments:live.attachments.map((a:any)=>({filename:a.filename,contentType:a.contentType}))});
 const context={checkedAt:snap.checkedAt,communication:snap.communications.find((v:any)=>v.id===4260001),ledger:snap.ledgers.find((v:any)=>v.communication_id===4260001),actions:snap.actions.filter((v:any)=>v.work_file_id===390001),decisions:snap.decisions.filter((v:any)=>v.work_file_id===390001),sourceEnvelope:{from:source[0].from_email,to:source[0].to_text,cc:source[0].cc_text,subject:source[0].subject}};save('context',context);console.log(JSON.stringify(context,null,2));
 const mail:any={checkedAt:new Date().toISOString(),readOnly:true};for(const folder of ['Drafts','Sent']){console.log('Reading '+folder);mail[folder]=await fetchReadonlyFolderSince(folder,folder==='Sent'?72:24*365,100);}save('mail-live',mail);
 console.log(JSON.stringify({Drafts:mail.Drafts.messages.map((v:any)=>({uid:v.uid,subject:v.subject,to:v.to,cc:v.cc,messageId:v.messageId,key:v.headers?.['x-como-draft-key']})),Sent:mail.Sent.messages.map((v:any)=>({uid:v.uid,subject:v.subject,messageId:v.messageId}))},null,2));await(db as any).$client.end();
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.stack);process.exit(1)});
