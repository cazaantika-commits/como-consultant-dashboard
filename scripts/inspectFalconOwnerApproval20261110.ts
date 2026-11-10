import 'dotenv/config';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {sql} from 'drizzle-orm';
import {getDb} from '../server/db';
import {requireProjectAccess} from '../server/services/comoNextCommands';
import {fetchReadonlyFolderSince} from '../server/emailMonitor';
const root='/home/ubuntu/reports/falcon-owner-approval-2026-11-10';
const save=(n:string,v:any)=>fs.writeFileSync(root+'/'+n+'.json',JSON.stringify(v,null,2)+'\n');
const norm=(v:any)=>String(v||'').replace(/\r\n?/g,'\n').trim(),sha=(v:any)=>createHash('sha256').update(norm(v)).digest('hex');
async function main(){const db=await getDb();assert(db);await requireProjectAccess(db,6,1,'read');const q=async(s:any)=>(await db.execute(s))[0]as any[];
 const b={projects:await q(sql`SELECT * FROM projects WHERE userId=1 ORDER BY id`),files:await q(sql`SELECT * FROM como_next_work_files WHERE user_id=1 ORDER BY id`),actions:await q(sql`SELECT * FROM como_next_actions WHERE user_id=1 ORDER BY id`),communications:await q(sql`SELECT * FROM como_next_communications WHERE user_id=1 ORDER BY id`),ledgers:await q(sql`SELECT * FROM como_mailbox_draft_ledger WHERE user_id=1 ORDER BY id`),decisions:await q(sql`SELECT * FROM como_next_decisions WHERE user_id=1 ORDER BY id`),lanes:await q(sql`SELECT * FROM como_next_lifecycle_lanes WHERE user_id=1 ORDER BY id`),pending:await q(sql`SELECT * FROM como_next_staged_directives WHERE user_id=1 AND status='pending' ORDER BY id`),emails:await q(sql`SELECT * FROM como_next_email_messages WHERE user_id=1 ORDER BY id`)};
 if(!fs.existsSync(root+'/protected-before.json'))save('protected-before',b);const c=b.communications.find(v=>v.id===5280001),l=b.ledgers.find(v=>v.communication_id===5280001),s=b.emails.find(v=>v.id===3660001);assert(c&&l&&s);assert.equal(l.state,'draft_saved');assert.equal(Number(l.draft_uid),1018);assert.equal(l.draft_key,'email-reply-draft:3660001');assert.equal(sha(c.body),l.body_sha256);assert(!c.sent_at&&!l.sent_uid);save('context',{communication:c,ledger:l,source:s,actions:b.actions.filter(v=>[3960002,4320001].includes(v.id)),file:b.files.find(v=>v.id===390001)});
 const mail:any={checkedAt:new Date().toISOString()};for(const f of['Sent','Drafts']){mail[f]=await fetchReadonlyFolderSince(f,f==='Sent'?48:24*365,220);assert(mail[f].messages.length<220);save('mail-before',mail);}const match=(v:any)=>v.messageId===l.message_id||v.headers?.['x-como-draft-key']===l.draft_key;assert(!mail.Sent.messages.some(match),'Draft already sent');const dm=mail.Drafts.messages.filter(match);assert.equal(dm.length,1);assert.equal(dm[0].uid,1018);assert.equal(sha(dm[0].textBody),l.body_sha256);const full=fs.readFileSync(root+'/Reply_To_Tedi_EN.txt','utf8');assert(full.startsWith('Subject: '+c.subject));save('draft-before',dm[0]);console.log(JSON.stringify({communicationId:c.id,ledgerId:l.id,draftUid:l.draft_uid,messageId:l.message_id,subject:c.subject,to:c.to_text,cc:c.cc_text,sent:false,unique:true,checkedAt:mail.checkedAt}));await(db as any).$client.end();}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.stack);process.exit(1)});
