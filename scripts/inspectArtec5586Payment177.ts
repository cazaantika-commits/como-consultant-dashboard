import 'dotenv/config';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {sql} from 'drizzle-orm';
import {getDb} from '../server/db';
import {fetchEmailByUID,fetchReadonlyFolderSince} from '../server/emailMonitor';
const root='/home/ubuntu/reports/como-directive-1770001-2026-11-04';
const sha=(v:string|Buffer)=>createHash('sha256').update(v).digest('hex');
const norm=(v:any)=>String(v||'').replace(/\r\n?/g,'\n').trim();
const save=(n:string,v:any)=>fs.writeFileSync(root+'/'+n+'.json',JSON.stringify(v,null,2)+'\n');
async function main(){
 const db=await getDb();assert(db);const q=async(s:any)=>(await db.execute(s))[0] as any[];
 const[source]=await q(sql`SELECT * FROM como_next_email_messages WHERE id=3150001 AND user_id=1`);assert(source&&source.body_sha256==='2c1adc852937f0e4bcebb6941b455a991d7e9bd61ccea85e3672d90084358ec0');
 const prior=await q(sql`SELECT * FROM como_next_email_messages WHERE user_id=1 AND (subject LIKE '%5586%' OR body_text LIKE '%invoice 5586%') ORDER BY id`);
 const context={source,priorEmails:prior,actions:await q(sql`SELECT * FROM como_next_actions WHERE user_id=1 AND work_file_id=390001 ORDER BY id`),paymentLane:await q(sql`SELECT * FROM como_next_lifecycle_lanes WHERE user_id=1 AND work_file_id=390001 AND lane_key='payment:5586'`),communications:await q(sql`SELECT * FROM como_next_communications WHERE user_id=1 AND work_file_id=390001 AND (subject LIKE '%5586%' OR body LIKE '%5586%') ORDER BY id`),ledgers:await q(sql`SELECT * FROM como_mailbox_draft_ledger WHERE user_id=1 AND work_file_id=390001 ORDER BY id`)};save('payment-context',context);
 const live=await fetchEmailByUID(Number(source.imap_uid),String(source.uid_validity),'INBOX');assert(live&&live.messageId===source.message_id);assert.equal(sha(norm(live.textBody)),source.body_sha256);assert.equal(live.attachments.length,1);assert.equal(live.attachments[0].filename,'03-11-26,AED 75600 , ARTEC.pdf');assert(live.attachments[0].content);const p=root+'/Artec_AED75600_Debit_Advice.pdf';fs.writeFileSync(p,live.attachments[0].content);save('live-source',{...live,attachments:live.attachments.map(a=>({...a,content:undefined,localPath:p,sha256:sha(a.content)}))});save('attachment-proof',{path:p,sha256:sha(live.attachments[0].content),sourceEmailId:3150001,size:live.attachments[0].content.length});
 const subject='Artec Invoice 5586';const drafts=await fetchReadonlyFolderSince('Drafts',24*365,100);const sent=await fetchReadonlyFolderSince('Sent',24*35,100,undefined,subject);save('mail-preflight',{checkedAt:new Date().toISOString(),drafts,sent});
 console.log(JSON.stringify({sourceId:3150001,attachment:p,sha256:sha(live.attachments[0].content),liveHeaders:live.headers,priorEmails:prior.map(v=>({id:v.id,folder:v.folder_name,subject:v.subject,linkedFile:v.linked_work_file_id,receivedAt:v.received_at})),paymentLane:context.paymentLane,relatedActions:context.actions.filter(v=>JSON.stringify(v).includes('5586')),sent:sent.messages.map(v=>({uid:v.uid,subject:v.subject,date:v.date})),drafts:drafts.messages.filter(v=>v.subject.includes('5586')).map(v=>({uid:v.uid,subject:v.subject}))},null,2));await(db as any).$client.end();
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.stack);process.exit(1)});
