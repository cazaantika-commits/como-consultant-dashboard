import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {sql} from 'drizzle-orm';
import {getDb} from '../server/db';
import {fetchEmailByUID,fetchReadonlyFolderSince} from '../server/emailMonitor';
import {requireProjectAccess} from '../server/services/comoNextCommands';
const root='/home/ubuntu/reports/como-batch234000x-2026-11-11';
const sha=(v:string|Buffer)=>createHash('sha256').update(v).digest('hex');
const norm=(v:any)=>String(v||'').replace(/\r\n?/g,'\n').trim();
const save=(n:string,v:any)=>fs.writeFileSync(root+'/'+n+'.json',JSON.stringify(v,null,2)+'\n');
async function main(){
 const db=await getDb();assert(db);await requireProjectAccess(db,6,1,'read');
 const q=async(s:any)=>(await db.execute(s))[0]as any[];
 const c=JSON.parse(fs.readFileSync(root+'/context.json','utf8')),proof:any[]=[];
 for(const s of c.emails){
  const live=await fetchEmailByUID(s.imap_uid,s.uid_validity,'INBOX');assert(live&&live.messageId===s.message_id&&sha(norm(live.textBody))===s.body_sha256);
  const aa=c.attachments.filter((v:any)=>v.email_message_id===s.id);assert.equal(live.attachments.length,aa.length);
  for(const a of aa){const la=live.attachments[a.ordinal];assert(la.content&&la.filename===a.file_name&&la.content.length===a.byte_size&&sha(la.content)===a.sha256);
   const dir=root+'/attachments-'+s.id;fs.mkdirSync(dir,{recursive:true});const p=dir+'/'+path.basename(a.file_name);fs.writeFileSync(p,la.content);
   proof.push({sourceEmailId:s.id,ordinal:a.ordinal,documentId:a.document_id,fileName:a.file_name,sha256:a.sha256,bytes:a.byte_size,path:p});}
  save('source-live-'+s.id,{...live,attachments:live.attachments.map((v:any)=>({filename:v.filename,bytes:v.content?.length,sha256:v.content?sha(v.content):null}))});console.log('Matched source '+s.id+' UID '+s.imap_uid);
 }
 save('attachment-proof',proof);
 const b:any={};for(const[k,s]of Object.entries({projects:'SELECT * FROM projects WHERE userId=1 ORDER BY id',files:'SELECT * FROM como_next_work_files WHERE user_id=1 ORDER BY id',actions:'SELECT * FROM como_next_actions WHERE user_id=1 ORDER BY id',communications:'SELECT * FROM como_next_communications WHERE user_id=1 ORDER BY id',ledgers:'SELECT * FROM como_mailbox_draft_ledger WHERE user_id=1 ORDER BY id',lanes:'SELECT * FROM como_next_lifecycle_lanes WHERE user_id=1 ORDER BY id',decisions:'SELECT * FROM como_next_decisions WHERE user_id=1 ORDER BY id',pending:"SELECT * FROM como_next_staged_directives WHERE user_id=1 AND status='pending' ORDER BY id",emails:'SELECT * FROM como_next_email_messages WHERE user_id=1 ORDER BY id'}))b[k]=await q(sql.raw(s));save('protected-before',b);
 const m:any={checkedAt:new Date().toISOString()};for(const f of ['Sent','Drafts']){console.log('Reading '+f);m[f]=await fetchReadonlyFolderSince(f,f==='Sent'?24*3:24*365,250);assert(m[f].messages.length<250);save('mail-before',m);}
 const related=(v:any)=>/3113149|soil investigation|soil.*noc/i.test(v.subject+' '+v.textBody);
 console.log(JSON.stringify({sources:c.emails.map((v:any)=>({id:v.id,uid:v.imap_uid,to:v.to_text,cc:v.cc_text})),relatedSent:m.Sent.messages.filter(related).map((v:any)=>({uid:v.uid,date:v.date,subject:v.subject,to:v.to,cc:v.cc,body:v.textBody,attachments:v.attachments})),relatedDrafts:m.Drafts.messages.filter(related).map((v:any)=>({uid:v.uid,messageId:v.messageId,key:v.headers?.['x-como-draft-key'],subject:v.subject,body:v.textBody,to:v.to,cc:v.cc,attachments:v.attachments}))},null,2));
 await(db as any).$client.end();
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.stack);process.exit(1)});
