import fs from 'node:fs';
import {createHash} from 'node:crypto';
import Imap from 'imap';
import nodemailer from 'nodemailer';
import {simpleParser} from 'mailparser';
import {sql} from 'drizzle-orm';
import {getDb} from '../server/db';
import {getConfiguredMailboxAddress, fetchReadonlyFolderSince} from '../server/emailMonitor';
import {appendEvent, requireProjectAccess} from '../server/services/comoNextCommands';
import {readExecutiveWorkFile} from '../server/services/saraWorkFileReader';

const root='/home/ubuntu/reports/colliers-owner-note-audit-2026-10-14';
const history=`${root}/letter-history`;
const revision='owner-colliers-construction-summary:20261014T124157Z';
const key='owner-colliers-feasibility-comments:20261014-approved';
const journalPath=`${history}/construction-summary-revision-journal.json`;
const rows=(v:any)=>v[0] as any[];
const norm=(s:any)=>String(s||'').replace(/\r\n?/g,'\n').trim();
const sha=(s:any)=>createHash('sha256').update(norm(s)).digest('hex');
const header=(m:any,n:string)=>{const v=m.headers?.[n];return norm(Array.isArray(v)?v.join(' '):v)};
const envelope=(s:any)=>[...new Set(String(s||'').toLowerCase().match(/[a-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}/g)||[])].sort().join(',');
const newBasis='Our current preliminary construction basis is 878,526.71 sq ft of total construction area × an indicative blended rate of AED 526.04–584.49 per sq ft, giving a construction-only cost of AED 462.14–513.49 million, before land, professional fees, statutory charges and other development allowances.';
const comparison='It is materially different from the AED 299.7 million shown for above-ground construction and basement parking in your model.';
const basisStart='Our current preliminary budgeting basis is:';
const basisEnd='Please reconcile the construction quantities and specifications';
function revised(s:string){
 const start=s.indexOf(basisStart),end=s.indexOf(basisEnd,start);
 if(start<0||end<start||s.indexOf(basisStart,start+1)>=0)throw Error('construction_anchor_missing_or_ambiguous');
 return s.slice(0,start)+newBasis+'\n\n'+comparison+'\n\n'+s.slice(end);
}
function checkBody(before:string,after:string){
 if(after!==revised(before)||sha(after.slice(after.indexOf('2. Land value')))!==sha(before.slice(before.indexOf('2. Land value'))))throw Error('outside_section_one_changed');
 if(after.includes('485.41')||after.includes('256,313.58')||after.includes('These are preliminary estimates for testing')||!after.includes('6. Financing assumptions and debt-servicing capacity')||!after.endsWith('E: a.zaqout@comodevelopments.com'))throw Error('new_body_invalid');
 const area=878526.71,low=462139086.60,high=513487874.00;
 if((low/area).toFixed(2)!=='526.04'||(high/area).toFixed(2)!=='584.49'||(area*526.04/1e6).toFixed(2)!=='462.14'||(area*584.49/1e6).toFixed(2)!=='513.49')throw Error('cost_arithmetic_invalid');
}
function journal(value:any){fs.writeFileSync(journalPath,JSON.stringify(value,null,2)+'\n')}
function open(imap:any,folder:string,readonly=true){return new Promise<any>((resolve,reject)=>imap.openBox(folder,readonly,(e:any,b:any)=>e?reject(e):resolve(b)))}
function search(imap:any,criteria:any[]){return new Promise<number[]>((resolve,reject)=>imap.search(criteria,(e:any,uids:any)=>e?reject(e):resolve(uids||[])))}
function rawByUid(imap:any,uid:number){return new Promise<{raw:Buffer;flags:string[]}>((resolve,reject)=>{
 const chunks:Buffer[]=[];let flags:string[]=[];let count=0;
 const fetch=imap.fetch([uid],{bodies:'',markSeen:false});
 fetch.on('message',(msg:any)=>{count++;msg.on('body',(stream:any)=>stream.on('data',(c:Buffer)=>chunks.push(c)));msg.on('attributes',(a:any)=>{if(a.uid!==uid)reject(Error('wrong_uid'));flags=a.flags||[]})});
 fetch.once('error',reject);fetch.once('end',()=>count===1?resolve({raw:Buffer.concat(chunks),flags}):reject(Error('draft_missing')));
})}
async function connect(){return new Promise<any>((resolve,reject)=>{
 const imap=new Imap({user:process.env.EMAIL_USER||'a.zaqout@comodevelopments.com',password:process.env.EMAIL_PASSWORD||'',host:process.env.EMAIL_HOST||'mail.privateemail.com',port:993,tls:true,tlsOptions:{rejectUnauthorized:false},connTimeout:15000,authTimeout:10000,socketTimeout:45000});
 imap.once('ready',()=>resolve(imap));imap.once('error',reject);imap.connect();
})}
async function protectedState(db:any){
 return {
  lanes:rows(await db.execute(sql`SELECT * FROM como_next_lifecycle_lanes WHERE user_id=1 AND work_file_id=60017 ORDER BY id`)),
  actions:rows(await db.execute(sql`SELECT * FROM como_next_actions WHERE user_id=1 AND work_file_id=60017 AND id<>1320001 ORDER BY id`))
 };
}
async function main(){
 if(getConfiguredMailboxAddress()!=='a.zaqout@comodevelopments.com')throw Error('COMO_mailbox_only');
 if(fs.existsSync(journalPath))throw Error('revision_journal_exists_inspect_no_replay');
 const db=await getDb();if(!db)throw Error('database_unavailable');
 await requireProjectAccess(db,1,1,'write');
 const [communication]=rows(await db.execute(sql`SELECT * FROM como_next_communications WHERE id=2280001 AND user_id=1 AND work_file_id=60017`));
 const [ledger]=rows(await db.execute(sql`SELECT * FROM como_mailbox_draft_ledger WHERE communication_id=2280001 AND draft_key=${key}`));
 const [action]=rows(await db.execute(sql`SELECT * FROM como_next_actions WHERE id=1320001 AND user_id=1 AND work_file_id=60017`));
 const [priorEvent]=rows(await db.execute(sql`SELECT id FROM como_next_work_file_events WHERE user_id=1 AND idempotency_key=${revision+':completed'}`));
 if(priorEvent||!communication||communication.source_record_id!==key||communication.sent_at||!['draft','archived'].includes(communication.communication_status)||ledger?.state!=='draft_saved'||ledger.draft_uid!==951||ledger.sent_uid||!action||action.owner_type!=='human'||!['open','in_progress'].includes(action.action_status))throw Error('authorized_unsent_revision_not_verified');
 // Archived is the established mailbox-handoff state, set by createCommunicationDraftCommand; never restore its status.
 if(communication.communication_status==='archived'&&!communication.review_note?.startsWith('المسودة محفوظة في بريد عبدالرحمن'))throw Error('unexplained_archive_do_not_restore');
 const oldBody=norm(communication.body),newBody=revised(oldBody);checkBody(oldBody,newBody);
 if(sha(oldBody)!==ledger.body_sha256||sha(oldBody)!=='50b2cab0292da1c5dc6b14b9364b2afd833dd76e61498f1aa33b1243d0f4065c')throw Error('owner_changed_body');
 const beforeState=await protectedState(db);
 const draftPath=`${root}/Colliers_Feasibility_Comments_Draft_EN.md`;
 const copyPath=`${root}/Colliers_Feasibility_Comments_Mailbox_Copy_EN.md`;
 for(const path of [draftPath,copyPath,`${root}/feasibility-comments-saved.json`,`${root}/feasibility-comments-live-draft.json`,`${root}/feasibility-comments-sara-state.json`])fs.copyFileSync(path,`${history}/before-summary-${path.split('/').pop()}`);
 const markdown=fs.readFileSync(draftPath,'utf8');
 let newMarkdown=revised(markdown).replace('AED 485.41–539.35 million','AED 462.14–513.49 million');
 const generatedBody=norm(newMarkdown.slice(newMarkdown.indexOf('Dear Charitha and Grant,')).replace(/^## /gm,'').replace(/\*\*/g,'').replace(/  \n/g,'\n'));
 if(generatedBody!==newBody)throw Error('markdown_and_mail_body_mismatch');
 const imap=await connect();let liveRaw:any;let newUid:number;
 try {
  if(!imap.serverSupports('REPLACE')||!imap.serverSupports('LITERAL+'))throw Error('atomic_replace_not_supported');
  const identity=[['OR',['HEADER','X-COMO-Draft-Key',key],['HEADER','Message-ID',ledger.message_id]]];
  await open(imap,'Sent');if((await search(imap,identity)).length)throw Error('owner_already_sent');
  const box=await open(imap,'Drafts');
  if(String(box.uidvalidity)!=='1767637252'||JSON.stringify(await search(imap,identity))!=='[951]')throw Error('draft_identity_changed');
  liveRaw=await rawByUid(imap,951);const parsed=await simpleParser(liveRaw.raw);
  if(sha(parsed.text)!==sha(oldBody)||parsed.messageId!==ledger.message_id||parsed.subject!==communication.subject||envelope(parsed.to?.text)!==envelope(communication.to_text)||envelope(parsed.cc?.text)!==envelope(communication.cc_text)||parsed.attachments.length||parsed.headers.get('x-como-draft-key')!==key)throw Error('live_draft_changed');
  fs.writeFileSync(`${history}/Draft-951-before-summary.eml`,liveRaw.raw);
  const stream=nodemailer.createTransport({streamTransport:true,buffer:true,newline:'unix'});
  const h=(n:string)=>norm(parsed.headers.get(n));
  const safeHtml=newBody.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
  const generated=await stream.sendMail({from:parsed.from?.text,to:communication.to_text,cc:communication.cc_text,subject:communication.subject,date:parsed.date,messageId:ledger.message_id,inReplyTo:h('in-reply-to'),references:h('references'),headers:{'X-COMO-Draft-Key':key},text:newBody,html:`<div dir="auto" style="white-space:normal;line-height:1.7">${safeHtml}</div>`});
  const raw=generated.message as Buffer;const rebuilt=await simpleParser(raw);
  if(norm(rebuilt.text)!==newBody||rebuilt.messageId!==parsed.messageId||norm(rebuilt.inReplyTo)!==norm(parsed.inReplyTo)||JSON.stringify(rebuilt.references)!==JSON.stringify(parsed.references))throw Error('thread_regeneration_mismatch');
  fs.writeFileSync(`${history}/construction-summary-replacement.eml`,raw);
  // Re-check source and Sent immediately before the single atomic REPLACE command.
  await open(imap,'Sent');if((await search(imap,identity)).length)throw Error('owner_sent_before_replace');
  await open(imap,'Drafts',false);
  if(JSON.stringify(await search(imap,identity))!=='[951]'||sha((await simpleParser((await rawByUid(imap,951)).raw)).text)!==sha(oldBody))throw Error('owner_changed_before_replace');
  journal({phase:'replace_started',communicationId:2280001,oldUid:951,oldHash:sha(oldBody),newHash:sha(newBody),draftKey:key,messageId:ledger.message_id,checkedAt:new Date().toISOString()});
  const flags=liveRaw.flags.filter((v:string)=>['\\Seen','\\Flagged','\\Answered'].includes(v));flags.push('\\Draft');
  // RFC 8508 REPLACE is atomic: no second active Draft, and no append/delete fallback.
  await new Promise<void>((resolve,reject)=>{
   imap._enqueue(`UID REPLACE 951 "Drafts" (${flags.join(' ')}) {${raw.length}+}`,(e:any)=>e?reject(e):resolve());
   imap._queue[imap._queue.length-1].literalAppendData=raw;
  });
  const uids=await search(imap,identity);
  if(uids.length!==1||uids[0]===951)throw Error('atomic_replacement_identity_unresolved');
  newUid=uids[0];const newRaw=await rawByUid(imap,newUid);const observed=await simpleParser(newRaw.raw);
  if(norm(observed.text)!==newBody||envelope(observed.to?.text)!==envelope(communication.to_text)||envelope(observed.cc?.text)!==envelope(communication.cc_text)||observed.subject!==communication.subject||observed.messageId!==ledger.message_id||norm(observed.inReplyTo)!==norm(parsed.inReplyTo)||JSON.stringify(observed.references)!==JSON.stringify(parsed.references)||observed.headers.get('x-como-draft-key')!==key||!newRaw.flags.includes('\\Draft'))throw Error('replacement_verification_failed');
  fs.writeFileSync(`${history}/Draft-${newUid}-after-summary.eml`,newRaw.raw);
  await open(imap,'Sent');if((await search(imap,identity)).length)throw Error('owner_sent_during_replace_requires_reconciliation');
  journal({phase:'replace_verified',communicationId:2280001,oldUid:951,newUid,oldHash:sha(oldBody),newHash:sha(newBody),checkedAt:new Date().toISOString(),sent:false});
 } finally {imap.end()}
 const ref=`Drafts UID ${newUid!}`;
 const description=`ماجان — المسودة عُدلت، لم تُرسل، بانتظار مراجعة/إرسال المالك. ${ref}؛ المراسلة القائمة#2280001. اختصر بند البناء إلى إجمالي878,526.71قدم² بسعر مرجح526.04–584.49درهم/قدم²، تكلفة بناء فقط462.14–513.49مليون درهم. باقي الرسالة والمستلمين والخيط وفق النسخة السابقة. لا انتظار خارجي قبل الإرسال ولا تغيير للسداد أو سيناريوهات المالية.`;
 await db.transaction(async tx=>{
  const [current]=rows(await tx.execute(sql`SELECT * FROM como_mailbox_draft_ledger WHERE id=${ledger.id} FOR UPDATE`));
  const [currentComm]=rows(await tx.execute(sql`SELECT * FROM como_next_communications WHERE id=2280001 FOR UPDATE`));
  if(current?.state!=='draft_saved'||current.draft_uid!==951||current.body_sha256!==sha(oldBody)||currentComm?.body!==communication.body||currentComm.communication_status!==communication.communication_status||currentComm.sent_at)throw Error('database_changed_during_mail_revision');
  await tx.execute(sql`UPDATE como_next_communications SET body=${newBody},external_message_ref=${ref},evidence_reference=${`COMO ${ref}; atomic REPLACE of UID 951; verified body ${sha(newBody)}`},review_note=${'المسودة محفوظة في بريد عبدالرحمن؛ عُدل بند تكلفة البناء فقط بتوجيه14أكتوبر16:41دبي. لم تُرسل؛ بانتظار مراجعة/إرسال المالك.'},updated_at=UTC_TIMESTAMP() WHERE id=2280001 AND user_id=1`);
  await tx.execute(sql`UPDATE como_mailbox_draft_ledger SET body_sha256=${sha(newBody)},draft_uid=${newUid!},confirmed_at=UTC_TIMESTAMP(),updated_at=UTC_TIMESTAMP() WHERE id=${ledger.id} AND state='draft_saved'`);
  await tx.execute(sql`UPDATE como_next_actions SET description=${description} WHERE id=1320001 AND user_id=1 AND owner_type='human' AND action_status IN ('open','in_progress')`);
  await tx.execute(sql`UPDATE como_next_work_files SET desired_outcome=${description},updated_at=UTC_TIMESTAMP() WHERE id=60017 AND user_id=1`);
  await tx.execute(sql`UPDATE como_next_work_memory SET is_current=0 WHERE work_file_id=60017 AND source_system='owner_instruction' AND source_record_id=${key} AND is_current=1`);
  await tx.execute(sql`INSERT INTO como_next_work_memory (project_id,work_file_id,memory_type,entry_type,title,body,source_status,source_system,source_record_id,is_current,occurred_at) VALUES (1,60017,'note','mailbox_draft_result','ماجان — مسودة كولييرز معدلة ولم تُرسل',${description+'\nتوجيه المالك14أكتوبر2026،16:41:57دبي: ذكر الإجمالي مضروبًا بالحدين فقط بلا تفاصيل. النسخة القديمة محفوظة محليًا، REPLACE ذري بنفس المراسلة والمفتاح وMessage-ID؛ UID تغيّر تقنيًا بلا مسودة ثانية.\n\n'+newBody},'reviewed','owner_instruction',${revision},1,UTC_TIMESTAMP())`);
  await appendEvent(tx,{userId:1,projectId:1,workFileId:60017,actionId:1320001,actorType:'manus',actorUserId:null,eventType:'communication_draft_revised',summary:description,payload:{communicationId:2280001,oldDraftUid:951,currentDraftUid:newUid!,method:'RFC8508_UID_REPLACE',sameMessageId:ledger.message_id,sameDraftKey:key,bodySha256:sha(newBody),onlySectionOneChanged:true,sent:false,paymentChanged:false,financialScenariosChanged:false,externalFollowupStarted:false},idempotencyKey:revision+':completed'});
 });
 if(JSON.stringify(beforeState)!==JSON.stringify(await protectedState(db)))throw Error('protected_payment_or_external_state_changed');
 const [drafts,sent]=await Promise.all([fetchReadonlyFolderSince('Drafts',48,250),fetchReadonlyFolderSince('Sent',48,250)]);
 const same=(m:any)=>m.messageId===ledger.message_id||header(m,'x-como-draft-key')===key;
 const matches=drafts.messages.filter(same);if(matches.length!==1||matches[0].uid!==newUid!||norm(matches[0].textBody)!==newBody||sent.messages.some(same))throw Error('final_live_verification_failed');
 const oldAudit=JSON.parse(fs.readFileSync(`${history}/revision-20261014T124157Z-before.json`,'utf8'));
 for(const name of ['in-reply-to','references','x-como-draft-key'])if(header(matches[0],name)!==header(oldAudit.matchingDrafts[0],name))throw Error('final_thread_header_changed');
 const sara=await readExecutiveWorkFile({memberId:'abdulrahman',nameAr:'عبد الرحمن',role:'owner'},JSON.stringify({work_file_id:60017,focus:'communications'}));
 if(!JSON.stringify(sara).includes(ref))throw Error('sara_current_draft_not_visible');
 fs.writeFileSync(draftPath,newMarkdown.endsWith('\n')?newMarkdown:newMarkdown+'\n');
 fs.writeFileSync(copyPath,`# Majan — Colliers Feasibility Comments\n\n**To:** ${communication.to_text}\n\n**CC:** ${communication.cc_text}\n\n**Subject:** ${communication.subject}\n\n**Status:** Updated existing communication #2280001 in ${ref}; not sent.\n\n---\n\n${newBody}\n`);
 fs.writeFileSync(`${root}/feasibility-comments-live-draft.json`,JSON.stringify(matches[0],null,2)+'\n');
 fs.writeFileSync(`${root}/feasibility-comments-sara-state.json`,JSON.stringify(sara,null,2)+'\n');
 const result={communicationId:2280001,mailboxDraftRef:ref,uid:newUid!,previousUid:951,folder:'Drafts',nextActionId:1320001,sourceEmailId:1470001,to:communication.to_text,cc:communication.cc_text,subject:communication.subject,bodySha256:sha(newBody),method:'atomic UID REPLACE',sameMessageId:true,sameDraftKey:true,onlySectionOneChanged:true,threadHeadersVerified:true,paymentLaneUnchanged:true,externalFollowupStarted:false,sent:false,checkedAt:new Date().toISOString()};
 fs.writeFileSync(`${root}/feasibility-comments-saved.json`,JSON.stringify(result,null,2)+'\n');
 journal({phase:'completed',...result});console.log(JSON.stringify(result,null,2));
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1)});
