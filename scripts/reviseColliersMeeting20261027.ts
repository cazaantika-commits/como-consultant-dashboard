import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import Imap from 'imap';
import nodemailer from 'nodemailer';
import {simpleParser} from 'mailparser';
import {sql} from 'drizzle-orm';
import {getDb} from '../server/db';
import {fetchReadonlyFolderSince,getConfiguredMailboxAddress} from '../server/emailMonitor';
import {appendEvent,createActionCommand,createCommunicationDraftCommand,requireProjectAccess} from '../server/services/comoNextCommands';
import {readExecutiveWorkFile} from '../server/services/saraWorkFileReader';
const root='/home/ubuntu/reports/colliers-meeting-2026-10-27';
const revision='colliers-meeting:owner20261027T044107Z';
const detailsId=3240001,detailsKey='email-reply-draft:2250002',oldUid=968;
const confirmationKey='email-reply-draft:2250002:attendance-confirmation:20261027';
const norm=(v:any)=>String(v||'').replace(/\r\n?/g,'\n').trim();
const sha=(v:any)=>createHash('sha256').update(norm(v)).digest('hex');
const env=(v:any)=>[...new Set(String(v||'').toLowerCase().match(/[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}/g)||[])].sort().join(',');
const save=(n:string,v:any)=>fs.writeFileSync(root+'/'+n+'.json',JSON.stringify(v,null,2)+'\n');
const open=(i:any,f:string,r=true)=>new Promise<any>((a,b)=>i.openBox(f,r,(e:any,x:any)=>e?b(e):a(x)));
const search=(i:any,c:any[])=>new Promise<number[]>((a,b)=>i.search(c,(e:any,x:any)=>e?b(e):a(x||[])));
const raw=(i:any,u:number)=>new Promise<Buffer>((a,b)=>{const chunks:Buffer[]=[];let count=0;const f=i.fetch([u],{bodies:'',markSeen:false});f.on('message',(m:any)=>{count++;m.on('body',(s:any)=>s.on('data',(c:Buffer)=>chunks.push(c)))});f.once('error',b);f.once('end',()=>count===1?a(Buffer.concat(chunks)):b(Error('draft_missing')))});
const connect=()=>new Promise<any>((a,b)=>{const i=new Imap({user:process.env.EMAIL_USER||'a.zaqout@comodevelopments.com',password:process.env.EMAIL_PASSWORD||'',host:process.env.EMAIL_HOST||'mail.privateemail.com',port:993,tls:true,tlsOptions:{rejectUnauthorized:false},connTimeout:15000,authTimeout:10000,socketTimeout:45000});i.once('ready',()=>a(i));i.once('error',b);i.connect()});
async function main(){
 assert.equal(getConfiguredMailboxAddress(),'a.zaqout@comodevelopments.com');
 const db=await getDb();assert(db);await requireProjectAccess(db,1,1,'write');const q=async(s:any)=>(await db.execute(s))[0] as any[];
 const existing=await q(sql`SELECT id FROM como_next_work_file_events WHERE user_id=1 AND idempotency_key=${revision+':completed'}`);
 if(existing.length){console.log(JSON.stringify({replayed:true,...JSON.parse(fs.readFileSync(root+'/receipt.json','utf8'))},null,2));await(db as any).$client.end();return;}
 const [c]=await q(sql`SELECT * FROM como_next_communications WHERE user_id=1 AND id=${detailsId} AND work_file_id=60017`);
 const [l]=await q(sql`SELECT * FROM como_mailbox_draft_ledger WHERE user_id=1 AND communication_id=${detailsId} AND work_file_id=60017`);
 const [source]=await q(sql`SELECT * FROM como_next_email_messages WHERE id=2250002 AND user_id=1 AND linked_work_file_id=60017`);
 assert(c&&l&&source);assert.equal(c.source_record_id,detailsKey);assert.equal(l.draft_key,detailsKey);assert.equal(l.state,'draft_saved');assert(!c.sent_at&&!l.sent_uid);assert.equal(c.communication_status,'archived');
 const detailsBody=norm(fs.readFileSync(root+'/Documents_Before_Thursday_EN.txt','utf8'));
 const confirmationBody=norm(fs.readFileSync(root+'/Meeting_Confirmation_EN.txt','utf8'));
 const proof=JSON.parse(fs.readFileSync(root+'/live-before.json','utf8'));assert(Date.now()-Date.parse(proof.checkedAt)<20*60_000);assert.equal(proof.Drafts.uidValidity,'1767637252');
 const identity=[['OR',['HEADER','X-COMO-Draft-Key',detailsKey],['HEADER','Message-ID',l.message_id]]];
 assert(!proof.Sent.messages.some((m:any)=>m.messageId===l.message_id||m.headers?.['x-como-draft-key']===detailsKey));
 assert(!proof.Sent.messages.some((m:any)=>env(m.to).includes('colliers')&&/Zooma office/i.test(m.textBody)&&/confirm my attendance/i.test(m.textBody)));
 const protectedSnapshot=async()=>({payments:await q(sql`SELECT * FROM como_next_lifecycle_lanes WHERE user_id=1 AND (kind='payment' OR lane_key='invoice:7314002290') ORDER BY id`),pending:await q(sql`SELECT * FROM como_next_staged_directives WHERE user_id=1 AND status='pending' ORDER BY id`),otherActions:await q(sql`SELECT * FROM como_next_actions WHERE user_id=1 AND work_file_id<>60017 ORDER BY id`),oldSent:await q(sql`SELECT * FROM como_next_communications WHERE user_id=1 AND id IN(3150001,3180001,2640001) ORDER BY id`)});
 const before=await protectedSnapshot();save('protected-before',before);
 let uid:number;
 const journalFile=root+'/replacement-journal.json';
 const journal=fs.existsSync(journalFile)?JSON.parse(fs.readFileSync(journalFile,'utf8')):null;
 if(journal){
  assert.equal(journal.phase,'replace_verified');assert.equal(journal.newHash,sha(detailsBody));uid=journal.newUid;
  assert([968,uid].includes(Number(l.draft_uid)));
  const drafts=await fetchReadonlyFolderSince('Drafts',24*365,100);const found=drafts.messages.filter(m=>m.headers?.['x-como-draft-key']===detailsKey||m.messageId===l.message_id);assert.equal(found.length,1);assert.equal(found[0].uid,uid);assert.equal(sha(found[0].textBody),sha(detailsBody));
 }else{
  assert.equal(l.draft_uid,oldUid);assert.equal(sha(c.body),l.body_sha256);
  const draft=proof.Drafts.messages.filter((m:any)=>m.headers?.['x-como-draft-key']===detailsKey||m.messageId===l.message_id);assert.equal(draft.length,1);assert.equal(draft[0].uid,oldUid);assert.equal(sha(draft[0].textBody),l.body_sha256);
  const imap=await connect();const timer=setTimeout(()=>imap.destroy(),150000);
  try{
   assert(imap.serverSupports('REPLACE')&&imap.serverSupports('LITERAL+'));
   await open(imap,'Sent');assert.equal((await search(imap,identity)).length,0);
   const box=await open(imap,'Drafts');assert.equal(String(box.uidvalidity),'1767637252');assert.deepEqual(await search(imap,identity),[oldUid]);
   const priorRaw=await raw(imap,oldUid);const prior=await simpleParser(priorRaw);
   assert.equal(sha(prior.text),l.body_sha256);assert.equal(prior.messageId,l.message_id);assert.equal(prior.subject,c.subject);assert.equal(env(prior.to?.text),env(c.to_text));assert.equal(env(prior.cc?.text),env(c.cc_text));assert.equal(norm(prior.inReplyTo),norm(source.message_id));assert.equal(prior.attachments.length,0);
   fs.writeFileSync(root+'/Draft-968-before.eml',priorRaw);
   const mime=nodemailer.createTransport({streamTransport:true,buffer:true,newline:'unix'});
   const built=await mime.sendMail({from:prior.from?.text,to:c.to_text,cc:c.cc_text,subject:c.subject,date:prior.date,messageId:l.message_id,inReplyTo:prior.inReplyTo,references:prior.references,headers:{'X-COMO-Draft-Key':detailsKey},text:detailsBody});
   const replacement=built.message as Buffer;const parsed=await simpleParser(replacement);assert.equal(sha(parsed.text),sha(detailsBody));assert.equal(parsed.messageId,prior.messageId);assert.deepEqual(parsed.references,prior.references);
   await open(imap,'Sent');assert.equal((await search(imap,identity)).length,0);
   await open(imap,'Drafts',false);assert.deepEqual(await search(imap,identity),[oldUid]);assert.equal(sha((await simpleParser(await raw(imap,oldUid))).text),l.body_sha256);
   save('replacement-journal',{phase:'replace_started',oldUid,oldHash:l.body_sha256,newHash:sha(detailsBody),sent:false});
   await new Promise<void>((a,b)=>{imap._enqueue(`UID REPLACE ${oldUid} "Drafts" (\\Draft) {${replacement.length}+}`,(e:any)=>e?b(e):a());imap._queue[imap._queue.length-1].literalAppendData=replacement});
   const found=await search(imap,identity);assert.equal(found.length,1);uid=found[0];assert.notEqual(uid,oldUid);
   const afterRaw=await raw(imap,uid);const after=await simpleParser(afterRaw);assert.equal(sha(after.text),sha(detailsBody));assert.equal(after.messageId,l.message_id);assert.equal(env(after.to?.text),env(c.to_text));assert.equal(env(after.cc?.text),env(c.cc_text));assert.equal(after.subject,c.subject);assert.equal(norm(after.inReplyTo),norm(prior.inReplyTo));assert.deepEqual(after.references,prior.references);
   fs.writeFileSync(root+'/Draft-'+uid+'-after.eml',afterRaw);save('replacement-journal',{phase:'replace_verified',oldUid,newUid:uid,oldHash:l.body_sha256,newHash:sha(detailsBody),sent:false});
  }finally{clearTimeout(timer);imap.destroy();}
 }
 await db.transaction(async tx=>{
  await tx.execute(sql`SELECT id FROM como_next_work_files WHERE id=60017 AND user_id=1 FOR UPDATE`);
  const [lc]=(await tx.execute(sql`SELECT * FROM como_mailbox_draft_ledger WHERE id=${l.id} AND user_id=1 FOR UPDATE`))[0] as any[];
  const [cc]=(await tx.execute(sql`SELECT * FROM como_next_communications WHERE id=${detailsId} AND user_id=1 FOR UPDATE`))[0] as any[];
  assert(lc.state==='draft_saved'&&!lc.sent_uid&&!cc.sent_at);assert([968,uid].includes(Number(lc.draft_uid)));assert([sha(c.body),sha(detailsBody)].includes(sha(cc.body)));
  await tx.execute(sql`UPDATE como_next_communications SET body=${detailsBody},external_message_ref=${'Drafts UID '+uid},evidence_reference=${'COMO Drafts UID '+uid+'; atomic replacement of968'},review_note='مسودة طلب التفاصيل مستقلة عن تأكيد الحضور؛ بتوجيه عبد الرحمن27أكتوبر تطلب الملفات قبل اجتماع الخميس29أكتوبر11:45 في مكتبزوما حضوريًا. لم تُرسل.',updated_at=UTC_TIMESTAMP() WHERE id=${detailsId} AND user_id=1`);
  await tx.execute(sql`UPDATE como_mailbox_draft_ledger SET body_sha256=${sha(detailsBody)},draft_uid=${uid},confirmed_at=UTC_TIMESTAMP(),updated_at=UTC_TIMESTAMP() WHERE id=${l.id} AND user_id=1`);
  await tx.execute(sql`UPDATE como_next_actions SET title='ماجان — عبد الرحمن: مراجعة وإرسال طلب ملفات كولييرز قبل اجتماع الخميس',description=${'المسودة القائمة968 استُبدلت ذريًا إلىDrafts UID '+uid+' في المراسلة3240001 نفسها؛ تطلب الرد النقطي وExcel والتقرير قبل اجتماع الخميس29أكتوبر11:45دبي في مكتبزوما حضوريًا. تأكيد الحضور برسالة منفصلة. لا إعادة المتابعة967 المرسلة.'},acceptance_criteria='يراجع عبد الرحمن نص طلب الملفات ويرسله منCOMO. لا قبول دراسة أو سداد؛ Manus يتابع وفحص الملفات ضمن1740002.',updated_at=UTC_TIMESTAMP() WHERE id=2340001 AND user_id=1 AND work_file_id=60017 AND owner_type='human' AND action_status='open'`);
  await appendEvent(tx,{userId:1,projectId:1,workFileId:60017,actionId:2340001,actorType:'manus',actorUserId:null,eventType:'communication_draft_revised',summary:'ماجان — تعديل مسودة طلب التفاصيل968 في المراسلة نفسها، قبل اجتماع الخميس الحضوري بمكتبزوما؛ دون إرسال.',payload:{communicationId:detailsId,communicationDraftId:detailsId,humanActionId:2340001,oldDraftUid:968,draftUid:uid,method:'UID_REPLACE',sent:false},idempotencyKey:revision+':details-revised'});
 });
 const confirmation=await createCommunicationDraftCommand({userId:1,workFileId:60017,channel:'email',subject:c.subject,body:confirmationBody,toText:c.to_text,ccText:c.cc_text,sourceEmailId:2250002,idempotencyKey:confirmationKey});save('confirmation-save',confirmation);
 const [confirmationLedger]=await q(sql`SELECT * FROM como_mailbox_draft_ledger WHERE user_id=1 AND communication_id=${confirmation.id}`);assert.equal(confirmationLedger.state,'draft_saved');
 const confirmationAction=await createActionCommand({userId:1,workFileId:60017,title:'ماجان — عبد الرحمن: إرسال تأكيد الاجتماع الحضوري لكولييرز',description:'عبد الرحمن أكد الحضور بتوجيه27أكتوبر: الخميس29أكتوبر11:45صباحًا بتوقيتدبي في مكتبزوما، حضوريًا لاTeams. رد منفصل محفوظ Drafts UID '+confirmationLedger.draft_uid+' يؤكد الحضور ويطلب تعديل موقع ونوع الدعوة. لم يُرسل؛ لا إعادة طلب التفاصيل.',acceptanceCriteria:'يراجع عبد الرحمن ويرسل تأكيد الحضور المحفوظ منCOMO. لا تغيير تقويم خارجي أوRSVP آلي ولا قبول دراسة أو سداد.',ownerType:'human',priority:'important',dueAt:'2026-10-29T07:45:00Z',idempotencyKey:revision+':confirmation-owner',actorType:'manus',actorUserId:null});
 // Reviewing these drafts is due now, not at the future meeting start.
 await db.execute(sql`UPDATE como_next_actions SET attention_at=UTC_TIMESTAMP(),updated_at=UTC_TIMESTAMP() WHERE id IN(2340001,${confirmationAction.id}) AND user_id=1 AND work_file_id=60017 AND action_status='open' AND owner_type='human'`);
 const finalDrafts=await fetchReadonlyFolderSince('Drafts',24*365,100);const finalSent=await fetchReadonlyFolderSince('Sent',48,100);
 const findKey=(key:string)=>finalDrafts.messages.filter(m=>m.headers?.['x-como-draft-key']===key);
 const details=findKey(detailsKey),confirm=findKey(confirmationKey);assert.equal(details.length,1);assert.equal(confirm.length,1);assert.equal(details[0].uid,uid);assert.equal(sha(details[0].textBody),sha(detailsBody));assert.equal(sha(confirm[0].textBody),sha(confirmationBody));
 for(const m of [details[0],confirm[0]]){assert.equal(env(m.to),env(c.to_text));assert.equal(env(m.cc),env(c.cc_text));assert.equal(m.subject,c.subject);assert.equal(norm(m.headers?.['in-reply-to']),norm(source.message_id));assert(norm(m.headers?.references).includes(norm(source.message_id)));assert(!finalSent.messages.some(s=>s.messageId===m.messageId||s.headers?.['x-como-draft-key']===m.headers?.['x-como-draft-key']));}
 const summary='ماجان — عبد الرحمن أكد حضوره بتوجيه27أكتوبر لا بإرسال: اجتماع حضوري في مكتبزوما الخميس29أكتوبر2026 الساعة11:45صباحًا بتوقيتدبي؛ ليس اجتماعTeams. تأكيد الحضور محفوظ فيDrafts UID '+confirm[0].uid+' / المراسلة'+confirmation.id+' / بند'+confirmationAction.id+' ولم يُرسل. مسودة طلب التفاصيل968 استُبدلت ذريًا إلىDrafts UID '+uid+' في المراسلة3240001 وبند2340001 نفسيهما؛ تطلب الرد النقطي والنموذج والتقرير قبل الخميس، مع بيان موعد التقرير إن كان منفصلًا. انتظار1740002 على كولييرز مستمر، وManus مسؤول عن وصول وفحص الملفات قبل الاجتماع. لا قبول دراسة أو سداد أو إرسال أوRSVP خارجي.';
 await db.transaction(async tx=>{
  await tx.execute(sql`UPDATE como_next_work_files SET desired_outcome=${summary},updated_at=UTC_TIMESTAMP() WHERE id=60017 AND user_id=1`);
  await tx.execute(sql`UPDATE como_next_actions SET description=${'ماجان — انتظار رد كولييرز النقطي وExcel والتقرير المصححين. عبد الرحمن أكد داخليًا حضوره الخميس29أكتوبر11:45دبي في مكتبزوما حضوريًا؛ طلب الملفات قبل الموعد فيDrafts UID '+uid+'، وتأكيد الحضور منفصل فيDrafts UID '+confirm[0].uid+'، لم تُرسلا. تعهد26أكتوبر خلال يومَي عمل والمتابعة28أكتوبر قائمان؛ لا إغلاق بمجرد الموعد. Manus يفحص المخرجات قبل النقاش.'},updated_at=UTC_TIMESTAMP() WHERE id=1740002 AND user_id=1 AND action_status='waiting_external'`);
  await appendEvent(tx,{userId:1,projectId:1,workFileId:60017,actionId:confirmationAction.id,actorType:'manus',actorUserId:null,eventType:'colliers_in_person_confirmation_draft',summary,payload:{communicationId:confirmation.id,communicationDraftId:confirmation.id,humanActionId:confirmationAction.id,draftUid:confirm[0].uid,attendanceConfirmedByOwner:true,confirmationSent:false,meetingStartDubai:'2026-10-29T11:45:00+04:00',venue:'Zooma office',meetingFormat:'in_person',calendarUpdated:false},idempotencyKey:revision+':confirmation-linked'});
  await tx.execute(sql`INSERT INTO como_next_work_memory(project_id,work_file_id,memory_type,entry_type,title,body,source_status,source_system,source_record_id,is_current,occurred_at) VALUES(1,60017,'note','mailbox_draft_result','ماجان — تأكيد حضور الخميس في مكتبزوما وطلب الملفات قبله',${summary+'\n\nتوجيه عبد الرحمن27أكتوبر08:41:07دبي: تأكيد الخميس11:45بمكتبزوما حضوريًا وليسأونلاين،وتعديلالمسودةالمستقلةلطلبالتفاصيلقبلالخميس. لم تُعدّلأصولتقويم1770001 أوإيصالات1110001/1110002 التاريخية.'},'reviewed','abdulrahman_instruction',${revision},1,UTC_TIMESTAMP())`);
 });
 const after=await protectedSnapshot();save('protected-after',after);assert.deepEqual(after,before);
 const sara:any=await readExecutiveWorkFile({memberId:'abdulrahman',nameAr:'عبد الرحمن',role:'owner'},JSON.stringify({work_file_id:60017,focus:'overview',question:'ماجان: اجتماع الخميس11:45مكتبزوما حضوريًا ومسودتا تأكيدالحضور وطلبالتفاصيل قبلالموعد'}));save('sara-after',sara);assert(sara.found);
 save('live-after',{drafts:[details[0],confirm[0]],sentMatches:[]});
 const receipt={detailsCommunicationId:detailsId,previousDraftUid:968,detailsDraftUid:uid,confirmationCommunicationId:confirmation.id,confirmationDraftUid:confirm[0].uid,detailsActionId:2340001,confirmationActionId:confirmationAction.id,waitingActionId:1740002,meetingStartDubai:'2026-10-29T11:45:00+04:00',venue:'Zooma office',inPerson:true,ownerConfirmedAttendance:true,confirmationSent:false,detailsSent:false,calendarUpdated:false,protectedRecordsUnchanged:true,saraFound:true,singleDraftPerPurpose:true,checkedAt:new Date().toISOString()};save('receipt',receipt);
 await appendEvent(db,{userId:1,projectId:1,workFileId:60017,actorType:'manus',actorUserId:null,eventType:'colliers_meeting_revision_completed',summary,payload:{oldDraftUid:968,detailsDraftUid:uid,confirmationDraftUid:confirm[0].uid,sent:false,paymentChanged:false},idempotencyKey:revision+':completed'});
 console.log(JSON.stringify(receipt,null,2));await(db as any).$client.end();
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1)});
