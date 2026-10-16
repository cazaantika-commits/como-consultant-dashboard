import fs from 'node:fs';
import {createHash} from 'node:crypto';
import Imap from 'imap';
import {simpleParser} from 'mailparser';
import {sql} from 'drizzle-orm';
import {getDb} from '../server/db';
import {fetchEmailByUID,getConfiguredMailboxAddress} from '../server/emailMonitor';
const ROOT='/home/ubuntu/reports/como-directive-750001-2026-10-16';
const rows=(r:any):any[]=>Array.isArray(r)&&Array.isArray(r[0])?r[0]:r;
// Same canonical body that the COMO importer stores and hashes.
const sha=(s:string)=>createHash('sha256').update(s.trim().slice(0,1_000_000)).digest('hex');
function readHeaders(folder:string):Promise<any>{
 return new Promise((resolve,reject)=>{
  const imap=new Imap({user:getConfiguredMailboxAddress(),password:process.env.EMAIL_PASSWORD||'',host:process.env.EMAIL_HOST||'mail.privateemail.com',port:993,tls:true,tlsOptions:{rejectUnauthorized:false},connTimeout:15000,authTimeout:10000,keepalive:false});
  let settled=false,validity='';const found:any[]=[];
  const timer=setTimeout(()=>finish(Error('readonly_header_timeout:'+folder)),60000);
  const finish=(e?:Error)=>{if(settled)return;settled=true;clearTimeout(timer);imap.destroy();e?reject(e):resolve({folderName:folder,uidValidity:validity,messages:found});};
  imap.once('error',finish);imap.once('end',()=>finish(Error('readonly_header_connection_ended')));
  imap.once('ready',()=>imap.openBox(folder,true,(e,box)=>{
   if(e)return finish(e);validity=String(box.uidvalidity);
   imap.search([['SINCE','11-Oct-2026']],(e,uids)=>{
    if(e)return finish(e);if(uids.length>250)return finish(Error('readonly_header_scope_overflow'));if(!uids.length)return finish();
    let pending=0,ended=false,count=0;
    const done=()=>{if(ended&&pending===0){if(count!==uids.length||found.length!==uids.length)return finish(Error('readonly_header_scope_incomplete'));finish();}};
    const f=imap.fetch(uids,{bodies:'HEADER.FIELDS (DATE FROM TO CC SUBJECT MESSAGE-ID IN-REPLY-TO REFERENCES)',markSeen:false});
    f.on('message',m=>{pending++;count++;let uid=0;const chunks:Buffer[]=[];m.on('attributes',a=>{uid=a.uid;});m.on('body',s=>s.on('data',(c:Buffer)=>chunks.push(c)));m.once('end',async()=>{try{const p=await simpleParser(Buffer.concat(chunks));found.push({uid,messageId:p.messageId,subject:p.subject,date:p.date,from:p.from?.text,to:p.to,cc:p.cc});}catch(e){finish(e as Error);}finally{pending--;done();}});});
    f.once('error',finish);f.once('end',()=>{ended=true;done();});
   });
  }));imap.connect();
 });
}
async function main(){
 fs.mkdirSync(ROOT,{recursive:true});const db=await getDb();if(!db)throw Error('database_unavailable');
 const q=async(s:any)=>rows(await db.execute(s));
 if(!fs.existsSync(ROOT+'/safety-before.json')){
  const safety={payments:await q(sql`SELECT * FROM como_next_lifecycle_lanes WHERE kind='payment' ORDER BY id`),pending:await q(sql`SELECT * FROM como_next_staged_directives WHERE status='pending' ORDER BY id`),actions:await q(sql`SELECT * FROM como_next_actions WHERE work_file_id=390001 AND id<>840001 ORDER BY id`),communications:await q(sql`SELECT id,communication_status,subject FROM como_next_communications WHERE work_file_id=390001 ORDER BY id`),ledger:await q(sql`SELECT * FROM como_mailbox_draft_ledger WHERE mailbox_key LIKE '%comodevelopments.com%' ORDER BY id`)};
  fs.writeFileSync(ROOT+'/safety-before.json',JSON.stringify(safety,null,2)+'\n');
 }
 const stored=await q(sql`SELECT * FROM como_next_email_messages WHERE user_id=1 ORDER BY received_at DESC LIMIT 150`);
 const evidenceIds=[1020001,1080003,1110002,1290001,1350001,1380001,1380002];
 const batches=[];
 for(const folder of ['INBOX','Sent']){console.log(`الفلل — فحص رؤوس ${folder} كاملة دون تنزيل مرفقات المخططات.`,new Date().toISOString());batches.push(await readHeaders(folder));console.log(`الفلل — اكتمل فحص رؤوس ${folder}.`,new Date().toISOString());}
 fs.writeFileSync(ROOT+'/live-header-proof.json',JSON.stringify(batches,null,2)+'\n');
 const live:any[]=[];const sourceChecks:any[]=[];
 for(const b of batches){
  for(const h of b.messages){
   const e=stored.find((x:any)=>x.folder_name===b.folderName&&Number(x.imap_uid)===h.uid&&String(x.uid_validity)===b.uidValidity&&x.message_id===h.messageId);
   const mustRead=evidenceIds.includes(Number(e?.id))||!e||/5586|Invoice|payment|paid|remittance|receipt|سداد|دفع|صرف/i.test(h.subject||'');
   if(mustRead){
    console.log(`الفلل — قراءة المصدر ${e?.id||'الجديد'} / ${b.folderName}:${h.uid}.`,new Date().toISOString());
    const cacheFile=ROOT+`/live-source-${b.folderName}-${h.uid}.json`;
    let cached:any=null;if(fs.existsSync(cacheFile))cached=JSON.parse(fs.readFileSync(cacheFile,'utf8'));
    const matchedCache=cached&&Date.now()-Date.parse(cached.checkedAt)<15*60_000&&cached.uidValidity===b.uidValidity&&cached.message.messageId===h.messageId;
    const invoiceProof=Number(e?.id)===1020001&&fs.existsSync(ROOT+'/invoice-text-comparison.json')?JSON.parse(fs.readFileSync(ROOT+'/invoice-text-comparison.json','utf8')).live:null;
    const m=matchedCache?cached.message:invoiceProof?.messageId===h.messageId?invoiceProof:await fetchEmailByUID(h.uid,b.uidValidity,b.folderName);if(!m||m.messageId!==h.messageId)throw Error('header_body_identity_changed');
    const hash=sha(m.textBody);if(e&&hash!==e.body_sha256)throw Error('source_body_changed:'+e.id);
    const copy={...m,folder:b.folderName,storedId:e?.id||null,textSha256:hash,attachments:m.attachments.map((a:any)=>({...a,content:undefined,sha256:a.content?createHash('sha256').update(a.content).digest('hex'):a.sha256||null}))};live.push(copy);
    fs.writeFileSync(cacheFile,JSON.stringify({checkedAt:new Date().toISOString(),uidValidity:b.uidValidity,message:copy},null,2)+'\n');
    if(evidenceIds.includes(Number(e?.id)))sourceChecks.push({emailId:Number(e.id),sha256:hash,folder:b.folderName,uid:h.uid,messageId:m.messageId});
   }
  }
 }
 if(sourceChecks.length!==evidenceIds.length)throw Error('expected_source_missing');
 const proof={checkedAt:new Date().toISOString(),mailbox:getConfiguredMailboxAddress(),since:'2026-10-11',completeBoundedBatches:true,method:'all_recent_headers_then_invoice_finance_unknown_message_bodies',headerBatches:batches,batches:live,sourceChecks};
 fs.writeFileSync(ROOT+'/live-mail-proof.json',JSON.stringify(proof,null,2)+'\n');
 const summary=batches.flatMap(b=>b.messages.map((h:any)=>{const e=stored.find((x:any)=>x.folder_name===b.folderName&&Number(x.imap_uid)===h.uid&&String(x.uid_validity)===b.uidValidity&&x.message_id===h.messageId);const m=live.find(m=>m.folder===b.folderName&&m.uid===h.uid);return {...h,folder:b.folderName,storedId:e?.id||null,body:m?.textBody||e?.body_text||'',liveBodyReviewed:Boolean(m)};}));
 fs.writeFileSync(ROOT+'/recent-mail-summary.json',JSON.stringify(summary,null,2)+'\n');
 console.log(JSON.stringify({checkedAt:proof.checkedAt,headerCounts:batches.map(b=>({folder:b.folderName,count:b.messages.length})),fullBodyRead:live.map(m=>({folder:m.folder,uid:m.uid,id:m.storedId,subject:m.subject})),sourceChecks},null,2));
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1);});
