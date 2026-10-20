import fs from 'node:fs';
import {createHash} from 'node:crypto';
import Imap from 'imap';
import {simpleParser} from 'mailparser';
import {sql} from 'drizzle-orm';
import {getDb} from '../server/db';
import {fetchEmailByUID,getConfiguredMailboxAddress} from '../server/emailMonitor';
const root='/home/ubuntu/reports/como-directive-960001-2026-10-20';
const rows=(v:any):any[]=>Array.isArray(v)&&Array.isArray(v[0])?v[0]:v;
const sha=(v:string|Buffer)=>createHash('sha256').update(v).digest('hex');
const norm=(v:string)=>String(v||'').trim().slice(0,1_000_000);
function headers(folder:string):Promise<any>{return new Promise((resolve,reject)=>{
 const imap=new Imap({user:getConfiguredMailboxAddress(),password:process.env.EMAIL_PASSWORD||'',host:process.env.EMAIL_HOST||'mail.privateemail.com',port:993,tls:true,tlsOptions:{rejectUnauthorized:false},connTimeout:15000,authTimeout:10000,keepalive:false});
 let settled=false,validity='';const found:any[]=[];
 const finish=(err?:Error)=>{if(settled)return;settled=true;clearTimeout(timer);imap.destroy();err?reject(err):resolve({folder,uidValidity:validity,messages:found});};
 const timer=setTimeout(()=>finish(Error('readonly_headers_timeout:'+folder)),60000);
 imap.once('error',finish);imap.once('end',()=>finish(Error('readonly_headers_ended')));
 imap.once('ready',()=>imap.openBox(folder,true,(err,box)=>{
  if(err)return finish(err);validity=String(box.uidvalidity);
  imap.search(folder==='Drafts'?['ALL']:[['SINCE','20-Oct-2026']],(err,uids)=>{
   if(err)return finish(err);if(uids.length>250)return finish(Error('scope_overflow'));if(!uids.length)return finish();
   let pending=0,count=0,ended=false;const done=()=>{if(ended&&!pending){if(count!==uids.length||found.length!==uids.length)return finish(Error('incomplete_header_batch'));finish();}};
   const f=imap.fetch(uids,{bodies:'HEADER.FIELDS (DATE FROM TO CC SUBJECT MESSAGE-ID IN-REPLY-TO REFERENCES X-COMO-DRAFT-KEY)',markSeen:false});
   f.on('message',m=>{pending++;count++;let uid=0;const chunks:Buffer[]=[];m.on('attributes',a=>uid=a.uid);m.on('body',s=>s.on('data',(c:Buffer)=>chunks.push(c)));m.once('end',async()=>{try{const p=await simpleParser(Buffer.concat(chunks));found.push({uid,subject:p.subject,messageId:p.messageId,date:p.date,from:p.from?.text,to:p.to,cc:p.cc,inReplyTo:p.inReplyTo,references:p.references});}catch(e){finish(e as Error);}finally{pending--;done();}});});
   f.once('error',finish);f.once('end',()=>{ended=true;done();});
  });
 }));imap.connect();
});}
async function main(){
 const db=await getDb();if(!db)throw Error('database_unavailable');fs.mkdirSync(root+'/attachments',{recursive:true});
 const [e]=rows(await db.execute(sql`SELECT * FROM como_next_email_messages WHERE id=2010001 AND user_id=1`));if(!e)throw Error('source_missing');
 let source:any;
 if(fs.existsSync(root+'/source-live.json')){source=JSON.parse(fs.readFileSync(root+'/source-live.json','utf8'));if(Date.now()-Date.parse(source.checkedAt)>15*60_000)source=null;}
 if(!source){
  console.log('السطوة — قراءة مصدر COMO2010001 ومرفقاته الستة');const m=await fetchEmailByUID(Number(e.imap_uid),String(e.uid_validity),e.folder_name);
  if(!m||m.messageId!==e.message_id||sha(norm(m.textBody))!==e.body_sha256)throw Error('source_identity_changed');
  const attachments=m.attachments.map((a:any,i:number)=>{const file=root+'/attachments/'+a.filename.replace(/[^a-zA-Z0-9_ .#-]/g,'_');fs.writeFileSync(file,a.content);return {...a,content:undefined,sha256:sha(a.content),file};});
  source={...m,storedId:e.id,folder:e.folder_name,uidValidity:e.uid_validity,attachments,checkedAt:new Date().toISOString()};
  fs.writeFileSync(root+'/source-live.json',JSON.stringify(source,null,2)+'\n');
 }
 const batches:any[]=[];const thread:any[]=[];
 for(const folder of ['INBOX','Sent','Drafts']){
  console.log('السطوة — قراءة رؤوس',folder);const b=await headers(folder);batches.push(b);
  for(const h of b.messages.filter((h:any)=>/1641a|3347343/i.test(h.subject||'')||h.inReplyTo===source.messageId)){
   if(folder==='INBOX'&&h.uid===Number(e.imap_uid))continue;
   const m=await fetchEmailByUID(h.uid,b.uidValidity,folder);if(!m||m.messageId!==h.messageId)throw Error('thread_identity_changed');thread.push({...m,folder,uidValidity:b.uidValidity,headers:h,attachments:m.attachments.map((a:any)=>({...a,content:undefined,sha256:sha(a.content)}))});
  }
 }
 const proof={checkedAt:new Date().toISOString(),source,batches,thread};fs.writeFileSync(root+'/live-proof.json',JSON.stringify(proof,null,2)+'\n');
 console.log(JSON.stringify({checkedAt:proof.checkedAt,sourceId:e.id,sourceDate:source.date,attachments:source.attachments.map((a:any)=>({name:a.filename,file:a.file,sha256:a.sha256})),thread:thread.map(m=>({folder:m.folder,uid:m.uid,subject:m.subject,messageId:m.messageId,date:m.date,text:m.textBody})),headerCounts:batches.map(b=>({folder:b.folder,count:b.messages.length}))},null,2));
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1)});
