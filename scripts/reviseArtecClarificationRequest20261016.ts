import fs from 'node:fs';
import {createHash} from 'node:crypto';
import Imap from 'imap';
import nodemailer from 'nodemailer';
import {simpleParser} from 'mailparser';
import {sql} from 'drizzle-orm';
import {getDb} from '../server/db';
import {getConfiguredMailboxAddress,fetchReadonlyFolderSince} from '../server/emailMonitor';
import {appendEvent,requireProjectAccess} from '../server/services/comoNextCommands';
import {readExecutiveWorkFile} from '../server/services/saraWorkFileReader';

const root='/home/ubuntu/reports/artec-dimensions-2026-10-16';
const history=`${root}/history`;
const revision='artec-clarification-request:chat20261016T074713Z';
const key='email-reply-draft:1710001';
const communicationId=2550001,workFileId=390001,actionId=1680001,oldUid=955;
const journalPath=`${root}/revision-journal.json`;
const expectedHash='e32fb1a69d1cb14dedb843c5ee12b8a76fb34215cc5e829e54581d1590525bef';
const norm=(v:any)=>String(v||'').replace(/\r\n?/g,'\n').trim();
const sha=(v:any)=>createHash('sha256').update(norm(v)).digest('hex');
const rows=(v:any)=>v[0] as any[];
const envelope=(v:any)=>[...new Set(String(v||'').toLowerCase().match(/[a-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}/g)||[])].sort().join(',');
const body=`Dear Tedi,

Thank you for sharing the updated concept plans for the four villas on Plot 6180578.

To help us understand the proposed design more clearly before providing our comments, could you please share the following:

1. The full set of current plans with clear dimensions for all rooms and spaces, including circulation areas, terraces, gardens and swimming pools, covering all floors and both the middle and side villa types.

2. The version of the plans presented during our meeting at your office, before the latest revisions, so that we can compare the two versions.

3. Simple sections and explanatory sketches showing the double-height space above the dining area and its relationship to the upper floor and garden-facing glazing; the steps leading to the lower-level area; access to the garden; and the kitchen corner configuration in the side villas.

These materials will help us review and understand the design as a whole. We will provide our comments after reviewing them.

Thank you for your assistance.

Kind regards,
Abdalrahman Zaqout
Development Director
COMO Real Estate Development L.L.C
M: +971 55 106 2668
E: a.zaqout@comodevelopments.com`;

function journal(v:any){fs.writeFileSync(journalPath,JSON.stringify(v,null,2)+'\n')}
function open(imap:any,folder:string,readonly=true){return new Promise<any>((resolve,reject)=>imap.openBox(folder,readonly,(e:any,b:any)=>e?reject(e):resolve(b)))}
function search(imap:any,criteria:any[]){return new Promise<number[]>((resolve,reject)=>imap.search(criteria,(e:any,uids:any)=>e?reject(e):resolve(uids||[])))}
function rawByUid(imap:any,uid:number){return new Promise<{raw:Buffer;flags:string[]}>((resolve,reject)=>{
 const chunks:Buffer[]=[];let flags:string[]=[];let count=0;
 const f=imap.fetch([uid],{bodies:'',markSeen:false});
 f.on('message',(msg:any)=>{count++;msg.on('body',(s:any)=>s.on('data',(c:Buffer)=>chunks.push(c)));msg.on('attributes',(a:any)=>{if(a.uid!==uid)reject(Error('wrong_uid'));flags=a.flags||[]})});
 f.once('error',reject);f.once('end',()=>count===1?resolve({raw:Buffer.concat(chunks),flags}):reject(Error('draft_missing')));
})}
function connect(){return new Promise<any>((resolve,reject)=>{
 const imap=new Imap({user:process.env.EMAIL_USER||'a.zaqout@comodevelopments.com',password:process.env.EMAIL_PASSWORD||'',host:process.env.EMAIL_HOST||'mail.privateemail.com',port:993,tls:true,tlsOptions:{rejectUnauthorized:false},connTimeout:15000,authTimeout:10000,socketTimeout:45000});
 imap.once('ready',()=>resolve(imap));imap.once('error',reject);imap.connect();
})}
async function protectedState(db:any){return {
 payments:rows(await db.execute(sql`SELECT * FROM como_next_lifecycle_lanes WHERE user_id=1 AND kind='payment' ORDER BY id`)),
 lanes:rows(await db.execute(sql`SELECT * FROM como_next_lifecycle_lanes WHERE user_id=1 AND work_file_id=${workFileId} ORDER BY id`)),
 pending:rows(await db.execute(sql`SELECT * FROM como_next_staged_directives WHERE user_id=1 AND status='pending' ORDER BY id`)),
 cancelled:rows(await db.execute(sql`SELECT * FROM como_next_work_files WHERE user_id=1 AND work_file_status='cancelled' ORDER BY id`)),
 otherActions:rows(await db.execute(sql`SELECT * FROM como_next_actions WHERE user_id=1 AND work_file_id=${workFileId} AND id<>${actionId} ORDER BY id`))
}}
async function main(){
 if(getConfiguredMailboxAddress()!=='a.zaqout@comodevelopments.com')throw Error('COMO_mailbox_only');
 const reconcileOnly=process.argv.includes('--reconcile-only');
 const priorJournal=fs.existsSync(journalPath)?JSON.parse(fs.readFileSync(journalPath,'utf8')):null;
 if(priorJournal&&(!reconcileOnly||priorJournal.phase!=='replace_verified'||priorJournal.communicationId!==communicationId||priorJournal.oldUid!==oldUid||priorJournal.bodySha256!==sha(body)))throw Error('revision_journal_exists_inspect_no_replay');
 if(reconcileOnly&&!priorJournal)throw Error('no_verified_replacement_to_reconcile');
 const db=await getDb();if(!db)throw Error('database_unavailable');await requireProjectAccess(db,6,1,'write');
 const [communication]=rows(await db.execute(sql`SELECT * FROM como_next_communications WHERE id=${communicationId} AND user_id=1 AND work_file_id=${workFileId}`));
 const [ledger]=rows(await db.execute(sql`SELECT * FROM como_mailbox_draft_ledger WHERE communication_id=${communicationId} AND draft_key=${key}`));
 const [action]=rows(await db.execute(sql`SELECT * FROM como_next_actions WHERE id=${actionId} AND user_id=1 AND work_file_id=${workFileId}`));
 const [file]=rows(await db.execute(sql`SELECT * FROM como_next_work_files WHERE id=${workFileId} AND user_id=1`));
 const [existingEvent]=rows(await db.execute(sql`SELECT id FROM como_next_work_file_events WHERE user_id=1 AND idempotency_key=${revision+':completed'}`));
 if(existingEvent||!communication||communication.source_record_id!==key||communication.sent_at||!['draft','archived'].includes(communication.communication_status)||ledger?.state!=='draft_saved'||ledger.draft_uid!==oldUid||ledger.sent_uid||!action||action.owner_type!=='human'||!['open','in_progress'].includes(action.action_status)||!file||['closed','cancelled','archived'].includes(file.work_file_status))throw Error('authorized_unsent_revision_not_verified');
 if(communication.communication_status==='archived'&&!communication.review_note?.startsWith('المسودة محفوظة في بريد عبدالرحمن'))throw Error('unexplained_archive');
 if(sha(communication.body)!==expectedHash||ledger.body_sha256!==expectedHash||envelope(communication.to_text)!=='tdimitrova@artecint.com'||envelope(communication.cc_text)!=='mzakout@artecint.com,wael@zooma.ae')throw Error('draft_content_or_envelope_changed');
 const protectedBefore=await protectedState(db);
 fs.writeFileSync(`${history}/database-before.json`,JSON.stringify({communication,ledger,action,file,protectedBefore},null,2)+'\n');
 const oldCopy='/home/ubuntu/reports/como-directive-690001-2026-10-15/Artec_Concept_Reply_Draft_EN.md';
 if(fs.existsSync(oldCopy))fs.copyFileSync(oldCopy,`${history}/Artec_Concept_Reply_Draft_EN-before.md`);
 const sameSubject=(s:string)=>norm(s).replace(/^(?:(?:re|fw|fwd)\s*:\s*)+/i,'').toLowerCase()===norm(communication.subject).replace(/^(?:(?:re|fw|fwd)\s*:\s*)+/i,'').toLowerCase();
 const sentBefore=await fetchReadonlyFolderSince('Sent',72,100);
 if(sentBefore.messages.some(m=>sameSubject(m.subject)))throw Error('sent_reply_exists_do_not_replace');
 let newUid:number;let priorHeaders:any;
 if(reconcileOnly){
  newUid=Number(priorJournal.newUid);
  const oldParsed=await simpleParser(fs.readFileSync(`${history}/Draft-${oldUid}-before.eml`));
  const afterParsed=await simpleParser(fs.readFileSync(`${history}/Draft-${newUid}-after.eml`));
  if(sha(oldParsed.text)!==expectedHash||norm(afterParsed.text)!==body||oldParsed.messageId!==ledger.message_id||afterParsed.messageId!==ledger.message_id||norm(afterParsed.inReplyTo)!==norm(oldParsed.inReplyTo)||JSON.stringify(afterParsed.references)!==JSON.stringify(oldParsed.references))throw Error('replacement_archive_mismatch');
  priorHeaders={inReplyTo:norm(oldParsed.headers.get('in-reply-to')),references:norm(oldParsed.headers.get('references')),messageId:oldParsed.messageId,draftKey:key};
  const liveDrafts=await fetchReadonlyFolderSince('Drafts',72,100);
  const matches=liveDrafts.messages.filter(m=>m.messageId===ledger.message_id||m.headers?.['x-como-draft-key']===key);
  if(matches.length!==1||matches[0].uid!==newUid||norm(matches[0].textBody)!==body||envelope(matches[0].to)!==envelope(communication.to_text)||envelope(matches[0].cc)!==envelope(communication.cc_text)||matches[0].subject!==communication.subject)throw Error('existing_replacement_not_proven');
  console.log(`Verified existing replacement Drafts UID ${newUid}; reconciliation only, no mailbox write.`);
 }else{
 const imap=await connect();
 const identity=[['OR',['HEADER','X-COMO-Draft-Key',key],['HEADER','Message-ID',ledger.message_id]]];
 const timer=setTimeout(()=>{journal({phase:fs.existsSync(journalPath)?JSON.parse(fs.readFileSync(journalPath,'utf8')).phase:'prewrite_timeout',error:'total_imap_deadline',communicationId,oldUid,sent:false});imap.destroy();},150000);
 try{
  if(!imap.serverSupports('REPLACE')||!imap.serverSupports('LITERAL+'))throw Error('atomic_replace_not_supported');
  await open(imap,'Sent');if((await search(imap,identity)).length)throw Error('abdulrahman_already_sent');
  const box=await open(imap,'Drafts');
  if(String(box.uidvalidity)!=='1767637252'||JSON.stringify(await search(imap,identity))!==JSON.stringify([oldUid]))throw Error('draft_identity_changed');
  const priorRaw=await rawByUid(imap,oldUid);const prior=await simpleParser(priorRaw.raw);
  if(sha(prior.text)!==expectedHash||prior.messageId!==ledger.message_id||prior.subject!==communication.subject||envelope(prior.to?.text)!==envelope(communication.to_text)||envelope(prior.cc?.text)!==envelope(communication.cc_text)||prior.attachments.length||prior.headers.get('x-como-draft-key')!==key)throw Error('live_draft_changed');
  const h=(n:string)=>norm(prior.headers.get(n));priorHeaders={inReplyTo:h('in-reply-to'),references:h('references'),messageId:prior.messageId,draftKey:key};
  if(priorHeaders.inReplyTo!=='<537EDE24-B129-4ACD-AA3B-E5C453FF9ADE@artecint.com>')throw Error('wrong_source_thread');
  fs.writeFileSync(`${history}/Draft-${oldUid}-before.eml`,priorRaw.raw);
  // This transport only creates a local MIME buffer; it has no SMTP connection.
  const stream=nodemailer.createTransport({streamTransport:true,buffer:true,newline:'unix'});
  const safeHtml=body.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
  const generated=await stream.sendMail({from:prior.from?.text,to:communication.to_text,cc:communication.cc_text,subject:communication.subject,date:prior.date,messageId:ledger.message_id,inReplyTo:priorHeaders.inReplyTo,references:priorHeaders.references,headers:{'X-COMO-Draft-Key':key},text:body,html:`<div style="line-height:1.7">${safeHtml}</div>`});
  const raw=generated.message as Buffer;const rebuilt=await simpleParser(raw);
  if(norm(rebuilt.text)!==body||rebuilt.messageId!==prior.messageId||norm(rebuilt.inReplyTo)!==norm(prior.inReplyTo)||JSON.stringify(rebuilt.references)!==JSON.stringify(prior.references))throw Error('mime_or_thread_mismatch');
  fs.writeFileSync(`${history}/clarification-replacement.eml`,raw);
  await open(imap,'Sent');if((await search(imap,identity)).length)throw Error('abdulrahman_sent_before_replace');
  await open(imap,'Drafts',false);
  if(JSON.stringify(await search(imap,identity))!==JSON.stringify([oldUid])||sha((await simpleParser((await rawByUid(imap,oldUid)).raw)).text)!==expectedHash)throw Error('draft_changed_before_replace');
  // One atomic REPLACE, never APPEND followed by deletion or a second draft.
  journal({phase:'replace_started',communicationId,oldUid,oldHash:expectedHash,newHash:sha(body),draftKey:key,messageId:ledger.message_id,sent:false,checkedAt:new Date().toISOString()});
  const flags=[...new Set([...priorRaw.flags.filter((v:string)=>['\\Seen','\\Flagged','\\Answered'].includes(v)),'\\Draft'])];
  await new Promise<void>((resolve,reject)=>{
   imap._enqueue(`UID REPLACE ${oldUid} "Drafts" (${flags.join(' ')}) {${raw.length}+}`,(e:any)=>e?reject(e):resolve());
   imap._queue[imap._queue.length-1].literalAppendData=raw;
  });
  const uids=await search(imap,identity);
  if(uids.length!==1||uids[0]===oldUid)throw Error('replacement_identity_unresolved');
  newUid=uids[0];const afterRaw=await rawByUid(imap,newUid);const after=await simpleParser(afterRaw.raw);
  if(norm(after.text)!==body||after.messageId!==ledger.message_id||after.subject!==communication.subject||envelope(after.to?.text)!==envelope(communication.to_text)||envelope(after.cc?.text)!==envelope(communication.cc_text)||norm(after.inReplyTo)!==norm(prior.inReplyTo)||JSON.stringify(after.references)!==JSON.stringify(prior.references)||after.headers.get('x-como-draft-key')!==key||!afterRaw.flags.includes('\\Draft'))throw Error('replacement_verification_failed');
  fs.writeFileSync(`${history}/Draft-${newUid}-after.eml`,afterRaw.raw);
  await open(imap,'Sent');if((await search(imap,identity)).length)throw Error('sent_during_replace_reconcile');
  journal({phase:'replace_verified',communicationId,oldUid,newUid,bodySha256:sha(body),sent:false,checkedAt:new Date().toISOString()});
 }finally{clearTimeout(timer);imap.end()}
 }
 const ref=`Drafts UID ${newUid!}`;
 const summary=`الفلل الأربع6180578 — جهز Manus طلب المخططات والمقاسات والسكيتشات اللازمة لفهم التصميم قبل المراجعة وتقديم الملاحظات. يشمل جميع الفراغات والمسابح والطوابق والنموذجين، ونسخة الاجتماع السابقة للمقارنة، وتوضيح الدبل هايت والزجاج والدرجات والوصول للحديقة وتشكيل زوايا المطابخ الجانبية. ليست ملاحظات تصميمية ولا طلب تغيير. ${ref} / المراسلة القائمة2550001 إلى ثيودورا CC ماجد ووائل. بانتظار مراجعة وإرسال عبد الرحمن؛ لم تُرسل، ولا انتظار خارجي جديد أو تغيير سداد.`;
 await db.transaction(async tx=>{
  const [currentLedger]=rows(await tx.execute(sql`SELECT * FROM como_mailbox_draft_ledger WHERE id=${ledger.id} FOR UPDATE`));
  const [currentCommunication]=rows(await tx.execute(sql`SELECT * FROM como_next_communications WHERE id=${communicationId} FOR UPDATE`));
  const [currentFile]=rows(await tx.execute(sql`SELECT work_file_status FROM como_next_work_files WHERE id=${workFileId} AND user_id=1 FOR UPDATE`));
  const [currentAction]=rows(await tx.execute(sql`SELECT action_status,owner_type FROM como_next_actions WHERE id=${actionId} AND work_file_id=${workFileId} FOR UPDATE`));
  if(currentLedger?.state!=='draft_saved'||currentLedger.draft_uid!==oldUid||currentLedger.body_sha256!==expectedHash||currentCommunication?.body!==communication.body||currentCommunication.communication_status!==communication.communication_status||currentCommunication.sent_at||!currentFile||['closed','cancelled','archived'].includes(currentFile.work_file_status)||currentAction?.owner_type!=='human'||!['open','in_progress'].includes(currentAction.action_status))throw Error('database_changed_during_revision');
  await tx.execute(sql`UPDATE como_next_communications SET body=${body},external_message_ref=${ref},evidence_reference=${`COMO ${ref}; atomic replacement of UID955; body ${sha(body)}`},review_note='المسودة محفوظة في بريد عبدالرحمن؛ طلب مخططات توضيحية فقط بتوجيه16أكتوبر11:47دبي، لا تعليقات تصميمية. لم تُرسل؛ بانتظار مراجعة وإرسال عبد الرحمن.',updated_at=UTC_TIMESTAMP() WHERE id=${communicationId} AND user_id=1`);
  await tx.execute(sql`UPDATE como_mailbox_draft_ledger SET body_sha256=${sha(body)},draft_uid=${newUid!},confirmed_at=UTC_TIMESTAMP(),updated_at=UTC_TIMESTAMP() WHERE id=${ledger.id} AND state='draft_saved'`);
  await tx.execute(sql`UPDATE como_next_actions SET title='الفلل الأربع — عبد الرحمن: مراجعة وإرسال طلب المخططات التوضيحية لأرتك',description=${summary},acceptance_criteria='يراجع عبد الرحمن طلب الرسومات ويرسله من بريد COMO؛ الرسالة لا تتضمن ملاحظات أو اعتمادًا أو طلب تغيير تصميم. يبدأ انتظار المستندات عند ثبوت الإرسال فقط.',updated_at=UTC_TIMESTAMP() WHERE id=${actionId} AND user_id=1 AND owner_type='human'`);
  await tx.execute(sql`UPDATE como_next_work_files SET desired_outcome=${summary},updated_at=UTC_TIMESTAMP() WHERE id=${workFileId} AND user_id=1`);
  await tx.execute(sql`INSERT INTO como_next_work_memory (project_id,work_file_id,memory_type,entry_type,title,body,source_status,source_system,source_record_id,is_current,occurred_at) VALUES (6,${workFileId},'note','mailbox_draft_result','الفلل الأربع — طلب مخططات توضيحية قبل المراجعة، لم يُرسل',${summary+'\n\nتوجيه عبد الرحمن16أكتوبر11:47:13دبي: تجهيز طلب الحصول على المخططات التي تساعدنا في رؤية أفضل لتقديم ملاحظات بعد المراجعة، وليس ردًا أو تعليقًا على التصميم. أزيلت طلبات الغاز والمصعد وجدولGFA والتعليقات من المسودة السابقة؛ المراجعة الفنية التاريخية وإيصال690001 محفوظان دون تغيير.\n\n'+body},'reviewed','abdulrahman_instruction',${revision},1,UTC_TIMESTAMP())`);
  await appendEvent(tx,{userId:1,projectId:6,workFileId,actionId,actorType:'manus',actorUserId:null,eventType:'communication_draft_revised',summary,payload:{communicationId,previousDraftUid:oldUid,currentDraftUid:newUid!,method:'RFC8508_UID_REPLACE',sameMessageId:ledger.message_id,sameDraftKey:key,bodySha256:sha(body),clarificationDrawingsOnly:true,designCommentsProvided:false,designChangeRequested:false,sent:false,externalFollowupStarted:false,paymentChanged:false},idempotencyKey:revision+':completed'});
 });
 const protectedAfter=await protectedState(db);fs.writeFileSync(`${root}/protected-after.json`,JSON.stringify(protectedAfter,null,2)+'\n');
 if(JSON.stringify(protectedBefore)!==JSON.stringify(protectedAfter))throw Error('protected_state_changed_inspect');
 const [drafts,sent]=await Promise.all([fetchReadonlyFolderSince('Drafts',72,100),fetchReadonlyFolderSince('Sent',72,100)]);
 const match=(m:any)=>m.messageId===ledger.message_id||m.headers?.['x-como-draft-key']===key;
 const matches=drafts.messages.filter(match);
 if(matches.length!==1||matches[0].uid!==newUid!||norm(matches[0].textBody)!==body||sent.messages.some(m=>match(m)||sameSubject(m.subject)))throw Error('final_live_check_failed');
 for(const [name,value] of Object.entries({'in-reply-to':priorHeaders.inReplyTo,'references':priorHeaders.references,'x-como-draft-key':key}))if(norm(matches[0].headers?.[name])!==value)throw Error('final_thread_mismatch');
 const sara=await readExecutiveWorkFile({memberId:'abdulrahman',nameAr:'عبد الرحمن',role:'owner'},JSON.stringify({work_file_id:workFileId,focus:'communications'}));
 if(!(sara as any)?.found||!JSON.stringify(sara).includes(ref))throw Error('sara_revision_not_visible');
 const copy=`# Four Villas — Request for Drawings to Support Review\n\nTo: ${communication.to_text}  \nCC: ${communication.cc_text}  \nSubject: ${communication.subject}  \nStatus: Updated existing communication2550001; ${ref}; not sent.\n\n---\n\n${body}\n`;
 fs.writeFileSync(`${root}/Artec_Clarification_Drawings_Request_EN.md`,copy);
 fs.writeFileSync(oldCopy,copy);
 fs.writeFileSync(`${root}/live-after.json`,JSON.stringify({draft:matches[0],sentMatches:sent.messages.filter(match)},null,2)+'\n');
 fs.writeFileSync(`${root}/sara-after.json`,JSON.stringify(sara,null,2)+'\n');
 const result={communicationId,workFileId,reviewActionId:actionId,previousUid:oldUid,uid:newUid!,mailboxDraftRef:ref,to:communication.to_text,cc:communication.cc_text,subject:communication.subject,bodySha256:sha(body),sameThread:true,sameMessageId:true,sameDraftKey:true,singleActiveDraft:true,method:'atomic UID REPLACE',sent:false,clarificationDrawingsOnly:true,protectedRecordsUnchanged:true,checkedAt:new Date().toISOString()};
 fs.writeFileSync(`${root}/saved.json`,JSON.stringify(result,null,2)+'\n');journal({phase:'completed',...result});console.log(JSON.stringify(result,null,2));
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1)});
