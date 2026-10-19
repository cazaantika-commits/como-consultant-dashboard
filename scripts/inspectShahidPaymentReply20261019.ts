import fs from 'node:fs';
import {createHash} from 'node:crypto';
import Imap from 'imap';
import {simpleParser} from 'mailparser';
import {sql} from 'drizzle-orm';
import {getDb} from '../server/db';
import {fetchEmailByUID,getConfiguredMailboxAddress} from '../server/emailMonitor';
const root='/home/ubuntu/reports/como-directive-900001-2026-10-19';
const rows=(r:any):any[]=>Array.isArray(r)&&Array.isArray(r[0])?r[0]:r;
const sha=(v:string|Buffer)=>createHash('sha256').update(v).digest('hex');
const norm=(v:string)=>String(v||'').trim().slice(0,1_000_000);
const canon=(v:string)=>String(v||'').replace(/^(\s*(re|fw|fwd):\s*)+/i,'').trim().toLowerCase();
function headers(folder:string):Promise<any>{return new Promise((resolve,reject)=>{
 const imap=new Imap({user:getConfiguredMailboxAddress(),password:process.env.EMAIL_PASSWORD||'',host:process.env.EMAIL_HOST||'mail.privateemail.com',port:993,tls:true,tlsOptions:{rejectUnauthorized:false},connTimeout:15000,authTimeout:10000,keepalive:false});
 let settled=false,validity='';const found:any[]=[];
 const finish=(error?:Error)=>{if(settled)return;settled=true;clearTimeout(timer);imap.destroy();error?reject(error):resolve({folder,uidValidity:validity,messages:found});};
 const timer=setTimeout(()=>finish(Error('readonly_header_timeout:'+folder)),60000);
 imap.once('error',finish);imap.once('end',()=>finish(Error('readonly_header_connection_ended')));
 imap.once('ready',()=>imap.openBox(folder,true,(error,box)=>{
  if(error)return finish(error);validity=String(box.uidvalidity);
  imap.search([['SINCE','14-Oct-2026']],(error,uids)=>{
   if(error)return finish(error);if(uids.length>200)return finish(Error('header_scope_overflow'));if(!uids.length)return finish();
   let pending=0,count=0,ended=false;const done=()=>{if(ended&&!pending){if(count!==uids.length||found.length!==uids.length)return finish(Error('incomplete_header_batch'));finish();}};
   const f=imap.fetch(uids,{bodies:'HEADER.FIELDS (DATE FROM TO CC SUBJECT MESSAGE-ID IN-REPLY-TO REFERENCES)',markSeen:false});
   f.on('message',m=>{pending++;count++;let uid=0;const chunks:Buffer[]=[];m.on('attributes',a=>uid=a.uid);m.on('body',s=>s.on('data',(c:Buffer)=>chunks.push(c)));m.once('end',async()=>{try{const p=await simpleParser(Buffer.concat(chunks));found.push({uid,subject:p.subject,messageId:p.messageId,date:p.date,from:p.from?.text,to:p.to,cc:p.cc,inReplyTo:p.inReplyTo,references:p.references});}catch(e){finish(e as Error);}finally{pending--;done();}});});
   f.once('error',finish);f.once('end',()=>{ended=true;done();});
  });
 }));imap.connect();
});}
async function main(){
 fs.mkdirSync(root+'/attachments',{recursive:true});const db=await getDb();if(!db)throw Error('database_unavailable');
 const stored=rows(await db.execute(sql`SELECT * FROM como_next_email_messages WHERE id IN (1950001,1920001) AND user_id=1 ORDER BY id`));
 const sourceCopies:any[]=[];
 for(const e of stored){
  console.log('الفلل — قراءة مصدر COMO',e.id,e.folder_name,e.imap_uid);
  const m=await fetchEmailByUID(Number(e.imap_uid),String(e.uid_validity),e.folder_name);if(!m||m.messageId!==e.message_id||sha(norm(m.textBody))!==e.body_sha256)throw Error('source_identity_changed:'+e.id);
  const attachments=m.attachments.map((a:any,i:number)=>{const file=root+`/attachments/${e.id}-${i+1}.${a.contentType==='image/jpeg'?'jpg':'png'}`;fs.writeFileSync(file,a.content);return {...a,content:undefined,sha256:sha(a.content),file};});
  sourceCopies.push({...m,storedId:e.id,folder:e.folder_name,uidValidity:e.uid_validity,attachments});
 }
 const source=sourceCopies.find(x=>x.storedId===1950001),sentRequest=sourceCopies.find(x=>x.storedId===1920001);
 if(!source||!sentRequest||!String(source.textBody).includes('following up with them daily')||!String(source.textBody).includes('Could you please provide an update'))throw Error('expected_thread_missing');
 const batches:any[]=[];const thread:any[]=[];
 for(const folder of ['Sent','Drafts']){
  console.log('الفلل — فحص رؤوس',folder);const b=await headers(folder);batches.push(b);
  for(const h of b.messages.filter((h:any)=>canon(h.subject)===canon(source.subject))){
   const m=await fetchEmailByUID(h.uid,b.uidValidity,folder);if(!m||m.messageId!==h.messageId)throw Error('header_identity_changed');
   thread.push({...m,folder,uidValidity:b.uidValidity,attachments:m.attachments.map((a:any)=>({...a,content:undefined,sha256:sha(a.content)}))});
  }
 }
 const proof={checkedAt:new Date().toISOString(),sourceCopies,batches,thread};
 fs.writeFileSync(root+'/live-proof.json',JSON.stringify(proof,null,2)+'\n');
 console.log(JSON.stringify({checkedAt:proof.checkedAt,sources:sourceCopies.map(m=>({id:m.storedId,folder:m.folder,uid:m.uid,subject:m.subject,text:m.textBody,attachments:m.attachments.map((a:any)=>({file:a.file,sha256:a.sha256}))})),thread:thread.map(m=>({folder:m.folder,uid:m.uid,messageId:m.messageId,date:m.date,to:m.to,cc:m.cc,text:m.textBody})),headerCounts:batches.map(b=>({folder:b.folder,count:b.messages.length}))},null,2));
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1)});
