import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import Imap from 'imap';
import nodemailer from 'nodemailer';
import {simpleParser} from 'mailparser';
import {sql,eq} from 'drizzle-orm';
import {getDb} from '../server/db';
import {users} from '../drizzle/schema';
import {fetchReadonlyFolderSince,fetchEmailByUID,getConfiguredMailboxAddress} from '../server/emailMonitor';
import {appendEvent,requireProjectAccess} from '../server/services/comoNextCommands';
import {readExecutiveWorkFile} from '../server/services/saraWorkFileReader';
import {comoNextRouter} from '../server/routers/comoNext';
const root='/home/ubuntu/reports/yousef-soil-revision-2026-10-27';
const revision='yousef-lowest-only-ar:owner20261027T101302Z';
const priorUid=978;
const priorRawHash='30d5d7302350833ba1233f196f6a295cefc40ae87dd199cb433d3ab6ad1b5e77';
const subject='لإبداء الرأي — عرض فحص التربة للفلل الأربع، قطعة 6180578';
const key='email-reply-draft:2370001:yousef-opinion:owner20261027T095118Z';
const norm=(v:any)=>String(v||'').replace(/\r\n?/g,'\n').trim();
const hash=(v:Buffer|string)=>createHash('sha256').update(v).digest('hex');
const sha=(v:any)=>hash(norm(v));
const env=(v:any)=>[...new Set(String(v||'').toLowerCase().match(/[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}/g)||[])].sort().join(',');
const save=(n:string,v:any)=>fs.writeFileSync(root+'/'+n+'.json',JSON.stringify(v,null,2)+'\n');
const open=(i:any,f:string,r=true)=>new Promise<any>((a,b)=>i.openBox(f,r,(e:any,x:any)=>e?b(e):a(x)));
const search=(i:any,c:any[])=>new Promise<number[]>((a,b)=>i.search(c,(e:any,x:any)=>e?b(e):a(x||[])));
const raw=(i:any,u:number)=>new Promise<Buffer>((a,b)=>{const chunks:Buffer[]=[];let count=0;const f=i.fetch([u],{bodies:'',markSeen:false});f.on('message',(m:any)=>{count++;m.on('body',(s:any)=>s.on('data',(c:Buffer)=>chunks.push(c)))});f.once('error',b);f.once('end',()=>count===1?a(Buffer.concat(chunks)):b(Error('draft_missing')))});
const connect=()=>new Promise<any>((a,b)=>{const i=new Imap({user:process.env.EMAIL_USER||'a.zaqout@comodevelopments.com',password:process.env.EMAIL_PASSWORD||'',host:process.env.EMAIL_HOST||'mail.privateemail.com',port:993,tls:true,tlsOptions:{rejectUnauthorized:false},connTimeout:15000,authTimeout:10000,socketTimeout:45000});i.once('ready',()=>a(i));i.once('error',b);i.connect()});
async function main(){
 const db=await getDb();assert(db);await requireProjectAccess(db,6,1,'write');assert.equal(getConfiguredMailboxAddress(),'a.zaqout@comodevelopments.com');const q=async(s:any)=>(await db.execute(s))[0] as any[];
 const completed=await q(sql`SELECT id FROM como_next_work_file_events WHERE user_id=1 AND idempotency_key=${revision+':completed'}`);if(completed.length){console.log(JSON.stringify({replayed:true,...JSON.parse(fs.readFileSync(root+'/receipt.json','utf8'))}));await(db as any).$client.end();return;}
 const before=JSON.parse(fs.readFileSync(root+'/before.json','utf8'));assert(Date.now()-Date.parse(before.checkedAt)<20*60_000);
 const [c]=await q(sql`SELECT * FROM como_next_communications WHERE id=3540001 AND user_id=1 AND work_file_id=390001`);const [l]=await q(sql`SELECT * FROM como_mailbox_draft_ledger WHERE user_id=1 AND communication_id=3540001 AND work_file_id=390001`);assert(c&&l);assert.equal(l.draft_key,key);assert.equal(c.source_record_id,key);assert.equal(l.state,'draft_saved');assert(!l.sent_uid&&!c.sent_at);assert.equal(env(c.to_text),'gm@midlinebc.ae');assert.equal(env(c.cc_text),'wael@zooma.ae');
 const body=norm(fs.readFileSync(root+'/Yousef_Opinion_Request_AR.txt','utf8'));assert(!/17,550|61,600|Mawaazen|Mukaddam|National|comparison|الموازين|مقارنة/i.test(body));
 const pdf=fs.readFileSync('/home/ubuntu/reports/como-directive-1170001-2026-10-26/attachments/FALQ-D-G-26-1924-.pdf');assert.equal(hash(pdf),'b804db5fa553b34bf882b024036d010334ce4406601ceb12c9b2b91a1dcb8dc0');
 const identity=[['OR',['HEADER','X-COMO-Draft-Key',key],['HEADER','Message-ID',l.message_id]]];assert(!before.Sent.messages.some((m:any)=>m.messageId===l.message_id||m.headers?.['x-como-draft-key']===key||(env(m.to)==='gm@midlinebc.ae'&&sha(m.textBody)===before.ledger[0].body_sha256)),'already_sent');
 let uid:number;const journal=fs.existsSync(root+'/replacement-journal-ar.json')?JSON.parse(fs.readFileSync(root+'/replacement-journal-ar.json','utf8')):null;
 if(journal){
  assert.equal(journal.phase,'replace_verified');assert.equal(journal.newHash,sha(body));
  const drafts=await fetchReadonlyFolderSince('Drafts',24*365,100);const found=drafts.messages.filter(m=>m.headers?.['x-como-draft-key']===key||m.messageId===l.message_id);assert.equal(found.length,1);uid=found[0].uid;assert.equal(uid,journal.newUid);assert.equal(sha(found[0].textBody),sha(body));assert.equal(found[0].subject,subject);assert.equal(env(found[0].to),env(c.to_text));assert.equal(env(found[0].cc),env(c.cc_text));
  const full=await fetchEmailByUID(uid,drafts.uidValidity,'Drafts');assert(full);assert.equal(full.attachments.length,1);assert.equal(hash(full.attachments[0].content),hash(pdf));save('recovery-native-proof',{uid,subject:found[0].subject,bodyHash:sha(found[0].textBody),attachmentSha256:hash(full.attachments[0].content),readOnly:true});
 }
 const imap=journal?null:await connect();const timer=imap?setTimeout(()=>imap.destroy(),150000):null;
 try{
  if(!journal){
  assert(imap.serverSupports('REPLACE')&&imap.serverSupports('LITERAL+'));await open(imap,'Sent');assert.equal((await search(imap,identity)).length,0);const box=await open(imap,'Drafts');assert.equal(String(box.uidvalidity),String(before.Drafts.uidValidity));const matches=await search(imap,identity);assert.equal(matches.length,1);
  if(journal){
   // An uncertain REPLACE is recovered from the existing message; never resubmitted.
   assert.equal(journal.newHash,sha(body));uid=matches[0];const p=await simpleParser(await raw(imap,uid));assert.equal(sha(p.text),sha(body),'uncertain_replace_not_confirmed');assert.equal(p.subject,subject);assert.equal(p.attachments.length,1);assert.equal(hash(p.attachments[0].content),hash(pdf));assert.equal(p.messageId,l.message_id);
   save('replacement-journal-ar',{...journal,phase:'replace_verified',newUid:uid});
  }else{
   assert.equal(l.draft_uid,977);assert.deepEqual(matches,[priorUid]);const oldRaw=await raw(imap,priorUid);const prior=await simpleParser(oldRaw);assert.equal(sha(prior.text),priorRawHash);assert.equal(prior.messageId,l.message_id);assert.equal(prior.subject,c.subject);assert.equal(env(prior.to?.text),env(c.to_text));assert.equal(env(prior.cc?.text),env(c.cc_text));assert.equal(prior.attachments.length,1);assert.equal(hash(prior.attachments[0].content),hash(pdf));fs.writeFileSync(root+'/Draft-978-before-ar.eml',oldRaw);
   const mime=nodemailer.createTransport({streamTransport:true,buffer:true,newline:'unix'});const built=await mime.sendMail({from:prior.from?.text,to:c.to_text,cc:c.cc_text,subject,date:prior.date,messageId:l.message_id,inReplyTo:prior.inReplyTo,references:prior.references,headers:{'X-COMO-Draft-Key':key},text:body,attachments:[{filename:'Falcon Laboratory Soil Investigation Quotation FALQ-D-G-26-1924.pdf',content:pdf,contentType:'application/pdf'}]});const replacement=built.message as Buffer;const parsed=await simpleParser(replacement);assert.equal(parsed.attachments.length,1);assert.equal(hash(parsed.attachments[0].content),hash(pdf));assert.equal(sha(parsed.text),sha(body));assert.equal(parsed.messageId,l.message_id);assert.deepEqual(parsed.references,prior.references);
   await open(imap,'Sent');assert.equal((await search(imap,identity)).length,0);await open(imap,'Drafts',false);assert.deepEqual(await search(imap,identity),[priorUid]);assert.equal(sha((await simpleParser(await raw(imap,priorUid))).text),priorRawHash);
   save('replacement-journal-ar',{phase:'replace_started',oldUid:priorUid,oldHash:priorRawHash,newHash:sha(body),sent:false});
   await new Promise<void>((a,b)=>{imap._enqueue(`UID REPLACE ${priorUid} "Drafts" (\\Draft) {${replacement.length}+}`,(e:any)=>e?b(e):a());imap._queue[imap._queue.length-1].literalAppendData=replacement});
   const found=await search(imap,identity);assert.equal(found.length,1);uid=found[0];assert.notEqual(uid,priorUid);const newRaw=await raw(imap,uid);const p=await simpleParser(newRaw);assert.equal(sha(p.text),sha(body));assert.equal(p.messageId,prior.messageId);assert.equal(p.subject,subject);assert.equal(env(p.to?.text),env(c.to_text));assert.equal(env(p.cc?.text),env(c.cc_text));assert.equal(norm(p.inReplyTo),norm(prior.inReplyTo));assert.deepEqual(p.references,prior.references);assert.equal(p.attachments.length,1);assert.equal(hash(p.attachments[0].content),hash(pdf));fs.writeFileSync(root+'/Draft-'+uid+'-after-ar.eml',newRaw);
   save('replacement-journal-ar',{phase:'replace_verified',oldUid:priorUid,newUid:uid,oldHash:priorRawHash,newHash:sha(body),sent:false});
  }
  }
 }finally{if(timer)clearTimeout(timer);if(imap)imap.destroy();}
 const summary=`الفلل الأربع — بتوجيه عبد الرحمن27أكتوبر14:09 وإفادته عن وائل،ثم طلبه14:13 التعريب،عُدلت رسالةالمهندسيوسف والعنوان بالعربية فيالمراسلة3540001نفسها وDrafts${uid} بدل977. النص يعرضFalcon13,500درهم قبلVAT/14,175شامل ويطلب الرأي بالسعر والنطاق فقط. المرفق الوحيدعرضFalcon1830004؛حُذف جدولالمقارنة وخطابأرتك وأسعار وأسماءالمنافسين منرسالةيوسف. المصادر الأصليةوالمقارنة محفوظةداخليًا للتدقيق وليست مرسلةليوسف. نفسGM@midlinebc.ae وCCوائل والخيط وMessage-ID والمفتاح وبند2610001. لم تُرسل؛لا ترسيةأوتكليفأوسداد،وطلبالحسابات976 مستقل دونتغيير.`;
 let memoryId:number;await db.transaction(async tx=>{
  await tx.execute(sql`SELECT id FROM como_next_work_files WHERE id=390001 AND user_id=1 FOR UPDATE`);const [lc]=(await tx.execute(sql`SELECT * FROM como_mailbox_draft_ledger WHERE id=${l.id} AND user_id=1 FOR UPDATE`))[0] as any[];const [cc]=(await tx.execute(sql`SELECT * FROM como_next_communications WHERE id=3540001 AND user_id=1 FOR UPDATE`))[0] as any[];
  assert(lc.state==='draft_saved'&&!lc.sent_uid&&!cc.sent_at);assert([977,uid].includes(Number(lc.draft_uid)));assert([before.ledger[0].body_sha256,sha(body)].includes(sha(cc.body)));
  await tx.execute(sql`UPDATE como_next_communications SET subject=${subject},body=${body},external_message_ref=${'Drafts UID '+uid},evidence_reference=${'COMO Drafts UID '+uid+'; original977, interim978, Arabic revision verified'},review_note='بتوجيه عبد الرحمن27أكتوبر: الرسالة والعنوان بالعربية،عرضFalcon فقط ليوسف ومرفقPDFوحيد،لا أسعارمنافسين أوجدولمقارنة أوخطابأرتك. لم تُرسل.',updated_at=UTC_TIMESTAMP() WHERE id=3540001 AND user_id=1`);
  await tx.execute(sql`UPDATE como_mailbox_draft_ledger SET subject_sha256=${sha(subject)},body_sha256=${sha(body)},draft_uid=${uid},confirmed_at=UTC_TIMESTAMP(),updated_at=UTC_TIMESTAMP() WHERE id=${l.id} AND user_id=1`);
  await tx.execute(sql`UPDATE como_next_actions SET description=${'الفلل الأربع — مراجعة وإرسال طلب رأي يوسف GM@midlinebc.ae،CCوائل،فيDrafts'+uid+'. عرضFalcon فقط بمبلغ13,500قبلVAT/14,175شامل،ومرفقPDFواحد. لا أسعارالمنافسين أوخطابأرتك أوجدولالمقارنة. نفسمراسلة3540001 وبند2610001،لا ترسيةأوتكليف.'},updated_at=UTC_TIMESTAMP() WHERE id=2610001 AND user_id=1 AND work_file_id=390001 AND owner_type='human' AND action_status='open'`);
  await tx.execute(sql`UPDATE como_next_work_memory SET is_current=0 WHERE id=4830001 AND project_id=6 AND work_file_id=390001`);
  const seen=(await tx.execute(sql`SELECT id FROM como_next_work_memory WHERE source_system='abdulrahman_instruction' AND source_record_id=${revision}`))[0] as any[];
  if(seen.length)memoryId=Number(seen[0].id);else{const r=await tx.execute(sql`INSERT INTO como_next_work_memory(project_id,work_file_id,memory_type,entry_type,title,body,source_status,source_system,source_record_id,is_current,occurred_at) VALUES(6,390001,'note','mailbox_draft_result','الفلل الأربع — عرضFalcon فقط ليوسف دون المقارنة',${summary},'draft_saved','abdulrahman_instruction',${revision},1,UTC_TIMESTAMP())`);memoryId=Number((r as any)[0].insertId);await tx.execute(sql`INSERT IGNORE INTO como_next_work_memory_documents(project_id,work_file_id,memory_id,document_id,relation_type,source_system,source_record_id) VALUES(6,390001,${memoryId},1830004,'attachment','abdulrahman_instruction',${revision+':1830004'})`);}
  await appendEvent(tx,{userId:1,projectId:6,workFileId:390001,actionId:2610001,actorType:'manus',actorUserId:null,eventType:'communication_draft_revised',summary,payload:{communicationId:3540001,communicationDraftId:3540001,humanActionId:2610001,oldDraftUid:977,draftUid:uid,attachmentDocumentIds:[1830004],removedAttachmentDocumentIds:[1830001,1830005],competitorPricesRemoved:true,sent:false,method:'UID_REPLACE'},idempotencyKey:revision+':revised'});
 });
 const current=await fetchReadonlyFolderSince('Drafts',24*365,100);const found=current.messages.filter(m=>m.headers?.['x-como-draft-key']===key||m.messageId===l.message_id);assert.equal(found.length,1);assert.equal(found[0].uid,uid);assert.equal(sha(found[0].textBody),sha(body));assert.equal(found[0].attachments.length,1);save('live-after',{uidValidity:current.uidValidity,message:found[0]});
 const protection={lanes:await q(sql`SELECT * FROM como_next_lifecycle_lanes WHERE user_id=1 ORDER BY id`),pending:await q(sql`SELECT * FROM como_next_staged_directives WHERE user_id=1 AND status='pending' ORDER BY id`),otherActions:await q(sql`SELECT * FROM como_next_actions WHERE user_id=1 AND id<>2610001 ORDER BY id`),otherCommunications:await q(sql`SELECT * FROM como_next_communications WHERE user_id=1 AND id<>3540001 ORDER BY id`),otherLedgers:await q(sql`SELECT * FROM como_mailbox_draft_ledger WHERE user_id=1 AND communication_id<>3540001 ORDER BY id`)};assert.deepEqual(protection,before.protection);save('protected-after',protection);
 const [user]=await db.select().from(users).where(eq(users.id,1));const overview=await comoNextRouter.createCaller({user,req:{} as any,res:{} as any}).getOverview();assert(overview.actions.some(a=>a.id===2610001&&a.ownerType==='human'));assert(!overview.sendEvidenceDiagnostics.some((d:any)=>d.actionId===2610001));
 const sara:any=await readExecutiveWorkFile({memberId:'abdulrahman',nameAr:'عبد الرحمن',role:'owner'},JSON.stringify({work_file_id:390001,focus:'overview',question:'الفلل الأربع — تعديل رسالةيوسف لعرضFalcon فقط وحذف أسعارالمنافسين والمقارنة،وفق توجيه عبدالرحمن'}));assert(sara.found);save('sara-after',sara);
 const receipt={communicationId:3540001,previousDraftUid:977,draftUid:uid,ownerActionId:2610001,memoryId:memoryId!,attachmentDocumentIds:[1830004],competitorPricesRemoved:true,otherAttachmentsRemoved:true,to:'GM@midlinebc.ae',cc:'wael@zooma.ae',sent:false,protectedRecordsUnchanged:true,saraFound:true,checkedAt:new Date().toISOString()};save('receipt',receipt);
 await appendEvent(db,{userId:1,projectId:6,workFileId:390001,actionId:2610001,actorType:'manus',actorUserId:null,eventType:'yousef_lowest_offer_revision_completed',summary,payload:receipt,idempotencyKey:revision+':completed'});console.log(JSON.stringify(receipt,null,2));await(db as any).$client.end();
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1)});
