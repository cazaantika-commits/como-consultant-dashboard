import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import Imap from 'imap';
import nodemailer from 'nodemailer';
import {simpleParser} from 'mailparser';
import {sql} from 'drizzle-orm';
import {getDb} from '../server/db';
import {fetchReadonlyFolderSince,getConfiguredMailboxAddress} from '../server/emailMonitor';
import {appendEvent,requireProjectAccess} from '../server/services/comoNextCommands';
import {readExecutiveWorkFile} from '../server/services/saraWorkFileReader';
const root='/home/ubuntu/reports/como-directive-1320001-2026-10-28';
const key='email-reply-draft:2190001',cid=3120001,oldUid=966;
const sourceSha='efb93817d39b46f03c1e9660f046f767d52b151532b168bbce083901f2132e07';
const norm=(s:any)=>String(s||'').replace(/\r\n?/g,'\n').trim();
const sha=(s:any)=>createHash('sha256').update(norm(s)).digest('hex');
const env=(s:any)=>[...new Set(String(s||'').toLowerCase().match(/[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}/g)||[])].sort().join(',');
const save=(n:string,v:any)=>fs.writeFileSync(root+'/'+n+'.json',JSON.stringify(v,null,2)+'\n');
const open=(i:any,f:string,r=true)=>new Promise<any>((a,b)=>i.openBox(f,r,(e:any,x:any)=>e?b(e):a(x)));
const search=(i:any,c:any[])=>new Promise<number[]>((a,b)=>i.search(c,(e:any,x:any)=>e?b(e):a(x||[])));
const raw=(i:any,u:number)=>new Promise<Buffer>((a,b)=>{const chunks:Buffer[]=[];let count=0;const f=i.fetch([u],{bodies:'',markSeen:false});f.on('message',(m:any)=>{count++;m.on('body',(s:any)=>s.on('data',(c:Buffer)=>chunks.push(c)))});f.once('error',b);f.once('end',()=>count===1?a(Buffer.concat(chunks)):b(Error('draft_missing')))});
const connect=()=>new Promise<any>((a,b)=>{const i=new Imap({user:process.env.EMAIL_USER,password:process.env.EMAIL_PASSWORD,host:process.env.EMAIL_HOST||'mail.privateemail.com',port:993,tls:true,tlsOptions:{rejectUnauthorized:false},connTimeout:15000,authTimeout:10000,socketTimeout:45000});i.once('ready',()=>a(i));i.once('error',b);i.connect()});
async function main(){
 assert.equal(getConfiguredMailboxAddress(),'a.zaqout@comodevelopments.com');
 const db=await getDb();assert(db);await requireProjectAccess(db,1,1,'write');
 const q=async(s:any)=>(await db.execute(s))[0] as any[];
 const [authority]=await q(sql`SELECT sd.*,d.state,d.claim_token FROM como_next_staged_directives sd JOIN como_manus_dispatches d ON d.directive_id=sd.id WHERE sd.id=1320001 AND sd.user_id=1`);
 assert.equal(authority.source_member_id,'system:manus-action');assert.equal(authority.work_file_id,630001);assert.equal(authority.action_id,2820001);assert.equal(authority.stage_key,'system-manus-action:2820001');assert(authority.directive_text.includes(sourceSha));
 if(authority.result_json){const r=JSON.parse(authority.result_json);if(r.kind==='satwa_deadline_review_mapping_blocked'){console.log(JSON.stringify({replayed:true,receipt:r}));await(db as any).$client.end();return;}}
 assert.equal(authority.status,'submitting');assert.equal(authority.state,'running');assert(authority.claim_token?.startsWith('worker:'));
 const [source]=await q(sql`SELECT * FROM como_next_email_messages WHERE id=2550001 AND user_id=1`);assert.equal(source.body_sha256,sourceSha);assert.equal(source.linked_work_file_id,null);assert.equal(sha(source.body_text),sourceSha);
 const [c]=await q(sql`SELECT * FROM como_next_communications WHERE id=${cid} AND user_id=1 AND work_file_id=630001`);
 const [l]=await q(sql`SELECT * FROM como_mailbox_draft_ledger WHERE communication_id=${cid} AND user_id=1 AND work_file_id=630001`);
 assert(c&&l);assert.equal(c.source_record_id,key);assert.equal(l.draft_key,key);assert.equal(l.state,'draft_saved');assert(!l.sent_uid&&!c.sent_at);assert.equal(c.communication_status,'archived');
 const body=norm(fs.readFileSync(root+'/Satwa_Reply_EN.txt','utf8'));
 const proof=JSON.parse(fs.readFileSync(root+'/live-proof.json','utf8'));assert(Date.now()-Date.parse(proof.checkedAt)<20*60_000);assert.equal(sha(proof.source.textBody),sourceSha);assert.equal(proof.source.messageId,source.message_id);assert.equal(proof.source.attachments.length,1);
 assert(!proof.sent.messages.some((m:any)=>m.messageId===l.message_id||m.headers?.['x-como-draft-key']===key));
 const matching=(messages:any[])=>messages.filter(m=>m.headers?.['x-como-draft-key']===key||m.messageId===l.message_id);
 const protection=async()=>({payments:await q(sql`SELECT * FROM como_next_lifecycle_lanes WHERE kind='payment' ORDER BY id`),pending:await q(sql`SELECT * FROM como_next_staged_directives WHERE status='pending' ORDER BY id`),projects:await q(sql`SELECT * FROM projects ORDER BY id`),files:await q(sql`SELECT * FROM como_next_work_files ORDER BY id`),otherActions:await q(sql`SELECT * FROM como_next_actions WHERE id NOT IN(2040001,2070001,2820001) ORDER BY id`),otherCommunications:await q(sql`SELECT * FROM como_next_communications WHERE id<>${cid} ORDER BY id`)});
 const before=await protection();assert(!before.projects.some(p=>String(p.plotNumber)==='3347343'||/satwa|السطوة/i.test(p.name)));save('protected-before',before);
 let uid:number;let journal=fs.existsSync(root+'/replacement-journal.json')?JSON.parse(fs.readFileSync(root+'/replacement-journal.json','utf8')):null;
 if(journal){
  assert.equal(journal.newHash,sha(body));const current=matching((await fetchReadonlyFolderSince('Drafts',24*365,100)).messages);assert.equal(current.length,1);assert.equal(sha(current[0].textBody),sha(body));uid=current[0].uid;assert.notEqual(uid,oldUid);save('replacement-journal',{...journal,phase:'replace_verified',newUid:uid,recoveredReadOnly:true});
 }else{
  assert.equal(l.draft_uid,oldUid);assert.equal(sha(c.body),l.body_sha256);const current=matching(proof.drafts.messages);assert.equal(current.length,1);assert.equal(current[0].uid,oldUid);assert.equal(sha(current[0].textBody),l.body_sha256);
  const i=await connect();const timer=setTimeout(()=>i.destroy(),150000);const identity=[['OR',['HEADER','X-COMO-Draft-Key',key],['HEADER','Message-ID',l.message_id]]];
  try{
   assert(i.serverSupports('REPLACE')&&i.serverSupports('LITERAL+'));await open(i,'Sent');assert.equal((await search(i,identity)).length,0);const box=await open(i,'Drafts');assert.equal(String(box.uidvalidity),String(proof.drafts.uidValidity));assert.deepEqual(await search(i,identity),[oldUid]);
   const original=await raw(i,oldUid);const p=await simpleParser(original);assert.equal(sha(p.text),l.body_sha256);assert.equal(p.messageId,l.message_id);assert.equal(p.subject,c.subject);assert.equal(env(p.to?.text),env(c.to_text));assert.equal(env(p.cc?.text),env(c.cc_text));assert.equal(p.attachments.length,0);fs.writeFileSync(root+'/Draft-966-before.eml',original);
   const mime=nodemailer.createTransport({streamTransport:true,buffer:true,newline:'unix'});
   const built=await mime.sendMail({from:p.from?.text,to:c.to_text,cc:c.cc_text,subject:c.subject,date:p.date,messageId:l.message_id,inReplyTo:p.inReplyTo,references:p.references,headers:{'X-COMO-Draft-Key':key},text:body});const replacement=built.message as Buffer;const parsed=await simpleParser(replacement);assert.equal(sha(parsed.text),sha(body));assert.deepEqual(parsed.references,p.references);
   await open(i,'Sent');assert.equal((await search(i,identity)).length,0);await open(i,'Drafts',false);assert.deepEqual(await search(i,identity),[oldUid]);assert.equal(sha((await simpleParser(await raw(i,oldUid))).text),l.body_sha256);
   save('replacement-journal',{phase:'replace_started',oldUid,oldHash:l.body_sha256,newHash:sha(body),sent:false});
   await new Promise<void>((a,b)=>{i._enqueue(`UID REPLACE ${oldUid} "Drafts" (\\Draft) {${replacement.length}+}`,(e:any)=>e?b(e):a());i._queue[i._queue.length-1].literalAppendData=replacement});
   const ids=await search(i,identity);assert.equal(ids.length,1);uid=ids[0];assert.notEqual(uid,oldUid);const after=await simpleParser(await raw(i,uid));assert.equal(sha(after.text),sha(body));assert.equal(after.messageId,p.messageId);assert.equal(env(after.to?.text),env(c.to_text));assert.equal(env(after.cc?.text),env(c.cc_text));assert.deepEqual(after.references,p.references);assert.equal(norm(after.inReplyTo),norm(p.inReplyTo));
   save('replacement-journal',{phase:'replace_verified',oldUid,newUid:uid,oldHash:l.body_sha256,newHash:sha(body),sent:false});
  }finally{clearTimeout(timer);i.destroy();}
 }
 const [drafts,sent]=await Promise.all([fetchReadonlyFolderSince('Drafts',24*365,100),fetchReadonlyFolderSince('Sent',24*10,100,undefined,'1641A')]);const found=matching(drafts.messages);assert.equal(found.length,1);const m=found[0];assert.equal(m.uid,uid!);assert.equal(sha(m.textBody),sha(body));assert.equal(env(m.to),env(c.to_text));assert.equal(env(m.cc),env(c.cc_text));assert(!sent.messages.some(s=>s.messageId===l.message_id||s.headers?.['x-como-draft-key']===key));save('draft-verified',m);
 const ref='Drafts UID '+uid!;
 const blocker='السطوة 3347343 غير مسجلة ضمن مشاريع COMO، وصفة COMO التعاقدية لم تثبت؛ الفاتورة20497 السابقة باسم Hazar Akay. لا ربط تخميني بماجان أو الفلل ولا قبول المطالبة.';
 const summary=`السطوة — فُحص بريد أحمد2550001/28أكتوبر08:47دبي والخيط والمرفق (شعار). الجديد طلب تحديث الدفعات قبل نهاية اليوم لتجنب النزاع؛ لا فاتورة أو إثبات دفع جديد. عُدلت966 نفسها ذريًا إلى ${ref} /3120001 بدل رسالة ثانية؛ رد محدد عن مراجعة20497 وأتعاب العقد والتغييرات والمخرجات، بلا وعد دفع أو إقرار مبلغ. لم يُرسل. بند عبد الرحمن2070001 القائم عاجل للمراجعة والقرار اليوم؛ انتظار Manus2040001 لحسم التبعية والربط قائم. ${blocker}`;
 const report=summary+'\n\nالمطالبة السابقة420,000درهم=280,000+120,000تغيير+20,000VAT، ليست استحقاقًا مقبولًا. مراجعتا29سبتمبر و20أكتوبر موجودتان؛ لم يُطلب إعادة مستندات ولا إعادة تحليلها.\n\nنص الرد المعدل المحفوظ، لم يرسل:\n'+body;
 const receipt=await db.transaction(async tx=>{
  await tx.execute(sql`SELECT id FROM como_next_work_files WHERE id=630001 AND user_id=1 FOR UPDATE`);
  const [live]=(await tx.execute(sql`SELECT sd.status,d.state,d.claim_token FROM como_next_staged_directives sd JOIN como_manus_dispatches d ON d.directive_id=sd.id WHERE sd.id=1320001 AND sd.user_id=1 FOR UPDATE`))[0] as any[];assert.equal(live.status,'submitting');assert.equal(live.state,'running');assert.equal(live.claim_token,authority.claim_token);
  const [fresh]=(await tx.execute(sql`SELECT body_sha256,linked_work_file_id FROM como_next_email_messages WHERE id=2550001 AND user_id=1 FOR UPDATE`))[0] as any[];assert.equal(fresh.body_sha256,sourceSha);assert.equal(fresh.linked_work_file_id,null);
  const [lc]=(await tx.execute(sql`SELECT * FROM como_mailbox_draft_ledger WHERE id=${l.id} AND user_id=1 FOR UPDATE`))[0] as any[];const [cc]=(await tx.execute(sql`SELECT * FROM como_next_communications WHERE id=${cid} AND user_id=1 FOR UPDATE`))[0] as any[];assert.equal(lc.state,'draft_saved');assert(!lc.sent_uid&&!cc.sent_at);assert.equal(lc.draft_uid,oldUid);assert.equal(sha(cc.body),l.body_sha256);
  await tx.execute(sql`UPDATE como_next_communications SET body=${body},external_message_ref=${ref},evidence_reference=${'استبدال ذري966; '+ref},review_note='السطوة: رد مهلة28أكتوبر قبلنهايةاليوم، قيدمراجعةعبدالرحمن، لاوعدسداد.',updated_at=UTC_TIMESTAMP() WHERE id=${cid} AND user_id=1`);
  await tx.execute(sql`UPDATE como_mailbox_draft_ledger SET body_sha256=${sha(body)},draft_uid=${uid!},confirmed_at=UTC_TIMESTAMP(),updated_at=UTC_TIMESTAMP() WHERE id=${l.id} AND user_id=1`);
  const inserted:any=await tx.execute(sql`INSERT INTO como_next_work_memory(project_id,work_file_id,memory_type,entry_type,title,body,source_status,is_current,source_system,source_record_id,occurred_at) VALUES(1,630001,'work_product','mail_linkage_blocker','السطوة — مهلة28أكتوبر ورد قائم محدث دون قبول مطالبة',${report},'source_reviewed_mapping_blocked',1,'como_mail_execution','satwa-deadline-review:1320001',UTC_TIMESTAMP())`);const workProductId=Number(inserted[0].insertId);
  const r={kind:'satwa_deadline_review_mapping_blocked',directiveId:1320001,completed:false,reviewCompleted:true,matchingCompleted:false,sourceEmailId:2550001,sourceBodySha256:sourceSha,workProductId,targetProjectId:null,targetWorkFileId:null,neutralIntakeWorkFileId:630001,previousDraftUid:966,mailboxDraftUid:uid!,mailboxDraftRef:ref,communicationDraftId:cid,ownerActionId:2070001,waitingActionId:2040001,senderRequestedDateDubai:'2026-10-28',senderRequestedTime:'close_of_business_unspecified_hour',newInvoice:false,paymentStatusChanged:false,acceptedDebt:false,sent:false,blocker,summary,checkedAt:new Date().toISOString()};
  await tx.execute(sql`UPDATE como_next_actions SET title='السطوة — عبد الرحمن: قرار ورد على طلب تحديث الدفعات قبل نهاية اليوم',description=${summary},acceptance_criteria='مراجعة الرد القائم وتحديد موقف المطالبة وصفة COMO اليوم؛ لا إقرار دين أو تاريخ دفع غير مثبت. يتولى Manus الربط والفحص بعد حسم التبعية.',priority='urgent',attention_at=UTC_TIMESTAMP(),evidence_reference=${'مخرج'+workProductId+'; المصدر2550001; '+ref} WHERE id=2070001 AND user_id=1 AND owner_type='human' AND action_status='open'`);
  await tx.execute(sql`UPDATE como_next_actions SET description=${'السطوة — انتظار قرار عبد الرحمن في2070001 بشأن صفةCOMO والمطالبة ورد مهلة28أكتوبر؛ فحص المصدر2550001 وتحديث المسودة اكتمل، لكن تسجيل المشروع وربطه غير مكتمل. لا انتظار دفع مثبت.'},evidence_reference=${'المخرج'+workProductId+'; الربط غير مكتمل'} WHERE id=2040001 AND user_id=1 AND action_status='waiting_external'`);
  await tx.execute(sql`UPDATE como_next_actions SET title='السطوة — فحص مهلة28أكتوبر مكتمل؛ عائق الربط مجمع في2040001',description=${summary},action_status='verified',completed_at=UTC_TIMESTAMP(),verified_at=UTC_TIMESTAMP(),evidence_reference=${'مخرج'+workProductId+'; '+ref} WHERE id=2820001 AND user_id=1 AND action_status='open' AND source_system='como_mail_linkage'`);
  await tx.execute(sql`UPDATE como_next_email_messages SET reply_draft_communication_id=${cid} WHERE id=2550001 AND user_id=1 AND body_sha256=${sourceSha}`);
  await tx.execute(sql`UPDATE como_next_staged_directives SET status='failed',work_product_id=${workProductId},communication_draft_id=${cid},mailbox_draft_ref=${ref},execution_summary=${summary},result_json=${JSON.stringify(r)},failure_message=${blocker} WHERE id=1320001 AND user_id=1 AND status='submitting'`);
  await tx.execute(sql`UPDATE como_manus_dispatches SET state='failed',last_progress_at=UTC_TIMESTAMP(),error=${blocker},execution_summary=${summary},result_json=${JSON.stringify(r)},work_product_id=${workProductId},communication_draft_id=${cid},mailbox_draft_ref=${ref},next_action_id=2070001 WHERE directive_id=1320001 AND state='running' AND claim_token=${authority.claim_token}`);
  await appendEvent(tx,{userId:1,projectId:1,workFileId:630001,actionId:2070001,actorType:'manus',actorUserId:null,eventType:'satwa_deadline_review_blocked',summary,payload:{...r,humanActionId:2070001,oldDraftUid:966,draftUid:uid!,externalSideEffect:false},idempotencyKey:'satwa-deadline-review:1320001'});
  return r;
 });save('receipt',receipt);
 const after=await protection();save('protected-after',after);assert.deepEqual(after,before);
 const sara:any=await readExecutiveWorkFile({memberId:'abdulrahman',nameAr:'عبد الرحمن',role:'owner'},JSON.stringify({work_file_id:630001,focus:'full',question:'السّطوة: مهلة28أكتوبر وردها القائم وماعلىعبدالرحمن وManus؟'}));save('sara',sara);assert(sara.found);assert(JSON.stringify(sara).includes(String(receipt.workProductId)));
 console.log(JSON.stringify({receipt,protectedStateUnchanged:true,saraFound:true},null,2));await(db as any).$client.end();
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1)});
