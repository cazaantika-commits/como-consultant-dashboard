import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {sql} from 'drizzle-orm';
import {getDb} from '../server/db';
import {fetchEmailByUID,fetchReadonlyFolderSince} from '../server/emailMonitor';
import {requireProjectAccess} from '../server/services/comoNextCommands';
const root='/home/ubuntu/reports/como-directive-2490001-2026-11-13';
const sha=(v:string|Buffer)=>createHash('sha256').update(v).digest('hex'),norm=(v:any)=>String(v||'').replace(/\r\n?/g,'\n').trim(),save=(n:string,v:any)=>fs.writeFileSync(root+'/'+n+'.json',JSON.stringify(v,null,2)+'\n');
async function main(){
 fs.mkdirSync(root,{recursive:true});const db=await getDb();assert(db);await requireProjectAccess(db,6,1,'read');const q=async(s:any)=>(await db.execute(s))[0]as any[];
 const[source]=await q(sql`SELECT * FROM como_next_email_messages WHERE id=4140001 AND user_id=1`);assert(source&&source.linked_work_file_id===390001&&source.folder_name==='INBOX'&&source.body_sha256==='1ff3c4faa356d0797dfbfe080ec1ae0229564766a721c273e595ce6eba37285b');
 const attachments=await q(sql`SELECT * FROM como_next_email_attachments WHERE email_message_id=4140001 ORDER BY ordinal`),thread=await q(sql`SELECT * FROM como_next_email_messages WHERE user_id=1 AND (linked_work_file_id=390001 AND (subject LIKE '%Kitchen%' OR subject LIKE '%Sketch%' OR subject LIKE '%Architectural%' OR body_text LIKE '%DWG%')) ORDER BY received_at,id`),documents=attachments.length?await q(sql`SELECT * FROM como_next_documents WHERE id IN (${sql.join(attachments.map(v=>sql`${v.document_id}`),sql`,`)})`):[],actions=await q(sql`SELECT * FROM como_next_actions WHERE user_id=1 AND work_file_id=390001 ORDER BY id`);
 save('context',{source,attachments,documents,thread,actions});console.log(JSON.stringify({source,attachments,documents,thread:thread.map(v=>({id:v.id,folder:v.folder_name,uid:v.imap_uid,subject:v.subject,date:v.received_at,from:v.from_email,body:v.body_text}))},null,2));
 const live=await fetchEmailByUID(source.imap_uid,source.uid_validity,'INBOX');assert(live&&live.messageId===source.message_id&&sha(norm(live.textBody))===source.body_sha256);assert.equal(live.attachments.length,attachments.length);
 const proof:any[]=[];for(const a of attachments){const la=live.attachments[a.ordinal];assert(la.content&&la.filename===a.file_name&&la.content.length===a.byte_size&&sha(la.content)===a.sha256);fs.mkdirSync(root+'/attachments',{recursive:true});const p=root+'/attachments/'+a.ordinal+'-'+path.basename(a.file_name);fs.writeFileSync(p,la.content);proof.push({ordinal:a.ordinal,documentId:a.document_id,fileName:a.file_name,sha256:a.sha256,bytes:a.byte_size,path:p});}save('attachment-proof',proof);save('source-live',{...live,attachments:live.attachments.map(v=>({filename:v.filename,bytes:v.content?.length,sha256:v.content?sha(v.content):null}))});
 const b:any={};for(const[k,s]of Object.entries({projects:'SELECT * FROM projects WHERE userId=1 ORDER BY id',files:'SELECT * FROM como_next_work_files WHERE user_id=1 ORDER BY id',actions:'SELECT * FROM como_next_actions WHERE user_id=1 ORDER BY id',communications:'SELECT * FROM como_next_communications WHERE user_id=1 ORDER BY id',ledgers:'SELECT * FROM como_mailbox_draft_ledger WHERE user_id=1 ORDER BY id',lanes:'SELECT * FROM como_next_lifecycle_lanes WHERE user_id=1 ORDER BY id',decisions:'SELECT * FROM como_next_decisions WHERE user_id=1 ORDER BY id',pending:"SELECT * FROM como_next_staged_directives WHERE user_id=1 AND status='pending' ORDER BY id",emails:'SELECT * FROM como_next_email_messages WHERE user_id=1 ORDER BY id'}))b[k]=await q(sql.raw(s));assert(!fs.existsSync(root+'/protected-before.json'));save('protected-before',b);
 const mail:any={checkedAt:new Date().toISOString()};for(const f of ['Sent','Drafts']){console.log('Reading '+f);mail[f]=await fetchReadonlyFolderSince(f,f==='Sent'?24*5:24*365,250);assert(mail[f].messages.length<250);save('mail-before',mail);}
 const related=(v:any)=>/Kitchen|Sketch|Drawings/i.test(v.subject+' '+v.textBody);console.log(JSON.stringify({liveSourceVerified:true,attachmentProof:proof,relatedSent:mail.Sent.messages.filter(related),relatedDrafts:mail.Drafts.messages.filter(related)},null,2));await(db as any).$client.end();
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.stack);process.exit(1)});
