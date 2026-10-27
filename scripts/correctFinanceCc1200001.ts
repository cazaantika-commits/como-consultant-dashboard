import fs from 'node:fs';
import assert from 'node:assert/strict';
import Imap from 'imap';
import nodemailer from 'nodemailer';
import {simpleParser} from 'mailparser';
import {createHash} from 'node:crypto';
import {sql} from 'drizzle-orm';
import {getDb} from '../server/db';
import {getConfiguredMailboxAddress,fetchReadonlyFolderSince,applyComoCcPolicy} from '../server/emailMonitor';
import {appendEvent,requireProjectAccess} from '../server/services/comoNextCommands';
const root='/home/ubuntu/reports/como-directives-1200001-1200002-2026-10-27';
const key='email-reply-draft:1950001:processing-date:20261027',cid=3480002;
const norm=(v:any)=>String(v||'').replace(/\r\n?/g,'\n').trim();
const sha=(v:any)=>createHash('sha256').update(norm(v)).digest('hex');
const env=(v:any)=>[...new Set(String(v||'').toLowerCase().match(/[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}/g)||[])].sort().join(',');
const save=(n:string,v:any)=>fs.writeFileSync(root+'/'+n+'.json',JSON.stringify(v,null,2)+'\n');
const open=(i:any,f:string,ro=true)=>new Promise<any>((a,b)=>i.openBox(f,ro,(e:any,x:any)=>e?b(e):a(x)));
const search=(i:any,c:any[])=>new Promise<number[]>((a,b)=>i.search(c,(e:any,x:any)=>e?b(e):a(x||[])));
const raw=(i:any,u:number)=>new Promise<Buffer>((a,b)=>{const chunks:Buffer[]=[];let count=0;const f=i.fetch([u],{bodies:'',markSeen:false});f.on('message',(m:any)=>{count++;m.on('body',(s:any)=>s.on('data',(c:Buffer)=>chunks.push(c)))});f.once('error',b);f.once('end',()=>count===1?a(Buffer.concat(chunks)):b(Error('draft_missing')))});
const connect=()=>new Promise<any>((a,b)=>{const i=new Imap({user:process.env.EMAIL_USER||'a.zaqout@comodevelopments.com',password:process.env.EMAIL_PASSWORD||'',host:process.env.EMAIL_HOST||'mail.privateemail.com',port:993,tls:true,connTimeout:15000,authTimeout:10000,socketTimeout:45000});i.once('ready',()=>a(i));i.once('error',b);i.connect()});
export async function correctFinanceCc(){
 assert.equal(getConfiguredMailboxAddress(),'a.zaqout@comodevelopments.com');const db=await getDb();assert(db);await requireProjectAccess(db,6,1,'write');
 const q=async(s:any)=>(await db.execute(s))[0] as any[];
 const [c]=await q(sql`SELECT * FROM como_next_communications WHERE id=${cid} AND user_id=1 AND work_file_id=390001`);
 const [l]=await q(sql`SELECT * FROM como_mailbox_draft_ledger WHERE communication_id=${cid} AND user_id=1 AND work_file_id=390001`);
 assert(c&&l&&c.source_record_id===key&&l.draft_key===key&&l.state==='draft_saved'&&c.communication_status==='archived'&&!l.sent_uid&&!c.sent_at,'draft_boundary_changed');
 assert.equal(env(c.to_text),'shahid@zooma.ae');assert.equal(env(c.cc_text),'account.mrt@zooma.ae');assert.equal(sha(c.body),l.body_sha256);
 // Preserve the source-only owner exception: the saved kitchen decision and
 // actual Sent228 both explicitly exclude Wael for payment5586 follow-ups.
 const context=JSON.parse(fs.readFileSync(root+'/finance-context.json','utf8'));const sent=context.emails.find((e:any)=>e.id===1980001);assert(sent&&env(sent.cc_text)==='account.mrt@zooma.ae'&&env(sent.to_text)==='shahid@zooma.ae','owner_cc_exception_not_proven');
 const correctCc=applyComoCcPolicy({to:c.to_text,cc:c.cc_text,ownerWaelCcExclusion:{evidenceReference:'توجيه عبد الرحمن20أكتوبر: متابعة5586معشاهدCCنسريندونوائل؛COMOSent1980001/UID228ومراجعةالمطبخالمحفوظة'}});assert.equal(env(correctCc),'account.mrt@zooma.ae');
 const identity=[['OR',['HEADER','X-COMO-Draft-Key',key],['HEADER','Message-ID',l.message_id]]];const jfile=root+'/cc-replacement-journal.json';let journal=fs.existsSync(jfile)?JSON.parse(fs.readFileSync(jfile,'utf8')):null;
 let uid:number;
 if(journal?.phase==='replace_verified'){
  // The replacement may succeed before an IMAP close/parser error. Recover
  // its exact saved identity and hashes; never submit another replacement.
  const drafts=await fetchReadonlyFolderSince('Drafts',24*365,100);
  const sentNow=await fetchReadonlyFolderSince('Sent',24,100);
  assert(!sentNow.messages.some(m=>m.headers?.['x-como-draft-key']===key||m.messageId===l.message_id));
  const found=drafts.messages.filter(m=>m.headers?.['x-como-draft-key']===key||m.messageId===l.message_id);
  assert.equal(found.length,1);uid=Number(journal.newUid);assert.equal(found[0].uid,uid);assert.equal(sha(found[0].textBody),l.body_sha256);assert.equal(found[0].messageId,l.message_id);assert.equal(env(found[0].cc),env(correctCc));assert.equal(env(found[0].to),env(c.to_text));
 }else{
 const imap=await connect();const timer=setTimeout(()=>imap.destroy(),150000);
 try{
  assert(imap.serverSupports('REPLACE')&&imap.serverSupports('LITERAL+'));
  await open(imap,'Sent');assert.equal((await search(imap,identity)).length,0,'already_sent_do_not_replace');
  const box=await open(imap,'Drafts');assert.equal(String(box.uidvalidity),'1767637252');const ids=await search(imap,identity);assert.equal(ids.length,1);
  const data=await raw(imap,ids[0]);const prior=await simpleParser(data);assert.equal(sha(prior.text),l.body_sha256);assert.equal(prior.messageId,l.message_id);assert.equal(env(prior.to?.text),env(c.to_text));assert.equal(prior.attachments.length,0);assert.equal(prior.subject,c.subject);
  if(env(prior.cc?.text)===env(correctCc)){
   assert(journal&&ids[0]!==974,'unexplained_already_correct_draft');uid=ids[0];journal={...journal,phase:'replace_verified',newUid:uid,sent:false};save('cc-replacement-journal',journal);
  }else{
   assert(!journal&&ids[0]===974&&env(prior.cc?.text)==='account.mrt@zooma.ae,wael@zooma.ae','unexpected_old_draft_or_uncertain_replace');
   fs.writeFileSync(root+'/Finance-Draft974-before.eml',data);
   const mime=nodemailer.createTransport({streamTransport:true,buffer:true,newline:'unix'});const built=await mime.sendMail({from:prior.from?.text,to:c.to_text,cc:correctCc,subject:c.subject,date:prior.date,messageId:l.message_id,inReplyTo:prior.inReplyTo,references:prior.references,headers:{'X-COMO-Draft-Key':key},text:c.body});
   const replacement=built.message as Buffer;assert.equal(sha((await simpleParser(replacement)).text),l.body_sha256);
   await open(imap,'Sent');assert.equal((await search(imap,identity)).length,0);await open(imap,'Drafts',false);assert.deepEqual(await search(imap,identity),[974]);
   save('cc-replacement-journal',{phase:'replace_started',oldUid:974,bodySha256:l.body_sha256,oldCc:env(prior.cc?.text),newCc:env(correctCc),sent:false});
   await new Promise<void>((a,b)=>{imap._enqueue(`UID REPLACE 974 "Drafts" (\\Draft) {${replacement.length}+}`,(e:any)=>e?b(e):a());imap._queue[imap._queue.length-1].literalAppendData=replacement});
   const found=await search(imap,identity);assert.equal(found.length,1);uid=found[0];assert.notEqual(uid,974);const replaced=await raw(imap,uid);const after=await simpleParser(replaced);
   assert.equal(env(after.cc?.text),env(correctCc));assert.equal(sha(after.text),l.body_sha256);assert.equal(after.messageId,l.message_id);assert.equal(after.subject,prior.subject);assert.deepEqual(after.references,prior.references);assert.equal(after.inReplyTo,prior.inReplyTo);fs.writeFileSync(root+'/Finance-Draft'+uid+'-after.eml',replaced);
   journal={phase:'replace_verified',oldUid:974,newUid:uid,bodySha256:l.body_sha256,newCc:env(correctCc),sent:false};save('cc-replacement-journal',journal);
  }
 }finally{clearTimeout(timer);imap.destroy();}
 }
 await db.transaction(async tx=>{
  await tx.execute(sql`SELECT id FROM como_next_work_files WHERE id=390001 AND user_id=1 FOR UPDATE`);
  const [lc]=(await tx.execute(sql`SELECT * FROM como_mailbox_draft_ledger WHERE id=${l.id} AND user_id=1 FOR UPDATE`))[0] as any[];assert(lc.state==='draft_saved'&&!lc.sent_uid&&[974,uid].includes(Number(lc.draft_uid)));
  await tx.execute(sql`UPDATE como_mailbox_draft_ledger SET draft_uid=${uid},cc_envelope_sha256=${sha(env(correctCc))},updated_at=UTC_TIMESTAMP() WHERE id=${l.id} AND user_id=1`);
  await tx.execute(sql`UPDATE como_next_communications SET cc_text=${correctCc},external_message_ref=${'Drafts UID '+uid},evidence_reference=${'COMO Drafts UID '+uid+'؛UIDREPLACE974لإزالةCCوائلبالاستثناءالمعتمد'},review_note='متابعة5586إلىشاهدCCنسريندونوائل،وفقإفادةعبدالرحمنوالصادر228. النص والخيط وهويةالمراسلةثابتة؛لمتُرسل.',updated_at=UTC_TIMESTAMP() WHERE id=${cid} AND user_id=1 AND communication_status='archived'`);
  await appendEvent(tx,{userId:1,projectId:6,workFileId:390001,actorType:'manus',actorUserId:null,eventType:'communication_draft_revised',summary:'الفلل الأربع — تصحيحCC974ذريًا وفق استثناءمتابعة5586:شاهدونسريندونوائل،دونإرسالأومراسلةمكررة.',payload:{communicationId:cid,oldDraftUid:974,draftUid:uid,ownerWaelCcExcluded:true,method:'UID_REPLACE',sent:false},idempotencyKey:'artec:2400001:finance-cc-owner-exclusion'});
 });
 const proof=await fetchReadonlyFolderSince('Drafts',24*365,100);save('drafts-after-cc-correction',proof);const found=proof.messages.filter(m=>m.headers?.['x-como-draft-key']===key);assert.equal(found.length,1);assert.equal(found[0].uid,uid);assert.equal(env(found[0].cc),'account.mrt@zooma.ae');return {communicationId:cid,oldDraftUid:974,draftUid:uid,cc:'account.mrt@zooma.ae',sent:false};
}
if(process.argv[1]?.endsWith('correctFinanceCc1200001.ts'))correctFinanceCc().then(r=>{console.log(JSON.stringify(r));process.exit(0)}).catch(e=>{console.error(e.message);process.exit(1)});
