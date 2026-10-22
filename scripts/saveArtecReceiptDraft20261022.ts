import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {eq,and,sql} from 'drizzle-orm';
import {getDb} from '../server/db';
import {fetchEmailByUID,fetchReadonlyFolderSince,getConfiguredMailboxAddress} from '../server/emailMonitor';
import {messageIdentitySha,mailboxKeyFor,createReplyDraftFromEmailCommand} from '../server/services/comoNextEmailInbox';
import {appendEvent,createActionCommand,requireProjectAccess} from '../server/services/comoNextCommands';
import {readExecutiveWorkFile} from '../server/services/saraWorkFileReader';
import {storagePut} from '../server/storage';
import {comoNextEmailMessages,comoNextEmailAttachments,comoNextCommunications,comoNextWorkMemory,comoNextDocuments,comoNextWorkMemoryDocuments} from '../drizzle/schema';
const root='/home/ubuntu/reports/artec-incoming-2026-10-22';
const sourceId='<01c4dedddc3946bfa5a9ea5eb6db06a9@artecint.com>';
const uidValidity='1767637251';
const key='artec-receipt-20261022:inbox507';
const body='Dear Tedi,\n\nThank you for sharing the updated dimensioned plans and accompanying files. We confirm receipt.\n\nWe will revert with our consolidated feedback once our internal requirements have been finalised.\n\nKind regards,\nAbdalrahman Zaqout\nDevelopment Director\nCOMO Real Estate Development L.L.C\nM: +971 55 106 2668\nE: a.zaqout@comodevelopments.com';
const norm=(s:string)=>s.replace(/\r\n?/g,'\n').trim();
const sha=(s:string|Buffer)=>createHash('sha256').update(s).digest('hex');
const rows=(r:any):any[]=>r[0];
const env=(s:string)=>Array.from(new Set((s.toLowerCase().match(/[a-z0-9.!#$%&'*+\/?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}/g)||[]))).sort().join(',');
const sameSubject=(a:string,b:string)=>a.replace(/^\s*(?:(?:re|fw|fwd)\s*:\s*)+/i,'').trim().toLowerCase()===b.replace(/^\s*(?:(?:re|fw|fwd)\s*:\s*)+/i,'').trim().toLowerCase();
const save=(name:string,v:any)=>fs.writeFileSync(`${root}/${name}.json`,JSON.stringify(v,null,2)+'\n');
async function main(){
 const db=await getDb();assert(db,'database_unavailable');await requireProjectAccess(db,6,1,'write');
 assert(getConfiguredMailboxAddress()==='a.zaqout@comodevelopments.com','como_only');
 const [file]=rows(await db.execute(sql`SELECT * FROM como_next_work_files WHERE id=390001 AND user_id=1 AND project_id=6`));assert(file&&!['closed','cancelled'].includes(file.work_file_status),'active_file_required');
 const old=JSON.parse(fs.readFileSync(`${root}/protected-before.json`,'utf8'));
 const guard=async()=>{
  const current={file:rows(await db.execute(sql`SELECT * FROM como_next_work_files WHERE id=390001 AND user_id=1`)),actions:rows(await db.execute(sql`SELECT * FROM como_next_actions WHERE work_file_id=390001 AND user_id=1 ORDER BY id`)),lanes:rows(await db.execute(sql`SELECT * FROM como_next_lifecycle_lanes WHERE user_id=1 ORDER BY id`)),pending:rows(await db.execute(sql`SELECT * FROM como_next_staged_directives WHERE user_id=1 AND status='pending' ORDER BY id`))};
  assert.deepEqual(current.file,old.file,'file_state_changed');assert.deepEqual(current.lanes,old.lanes,'payment_or_lifecycle_changed');assert.deepEqual(current.pending,old.pending,'owner_pending_changed');
  assert.deepEqual(current.actions.filter(a=>old.actions.some((v:any)=>v.id===a.id)),old.actions,'existing_villa_actions_changed');return current;
 };
 await guard();
 const [recorded]=rows(await db.execute(sql`SELECT * FROM como_next_work_file_events WHERE user_id=1 AND idempotency_key=${key}`));
 if(recorded){const receipt=JSON.parse(recorded.payload_json);assert(receipt.sent===false&&receipt.draftVerified===true,'receipt_invalid');await guard();save('replay-receipt',{...receipt,replayed:true});console.log(JSON.stringify({replayed:true,...receipt},null,2));return;}
 console.log('استعادة مصدرأرتك507 والتحقق منSentوDraftsقبلحفظرداستلامفقط.');
 const source=await fetchEmailByUID(507,uidValidity,'INBOX');assert(source&&source.messageId===sourceId&&source.from==='tdimitrova@artecint.com'&&source.attachments.length===10,'source_changed');
 const known=JSON.parse(fs.readFileSync(`${root}/live-mail.json`,'utf8')).inbox.messages[0];
 assert(norm(source.textBody)===norm(known.textBody)&&source.subject===known.subject,'source_body_changed');
 const sent=await fetchReadonlyFolderSince('Sent',72,100,undefined,'6180578');
 const drafts=await fetchReadonlyFolderSince('Drafts',168,100,undefined,'6180578');
 assert(!sent.messages.some(m=>sameSubject(m.subject,source.subject)&&m.date.getTime()>=source.date.getTime()),'reply_already_sent');
 const [priorEmail]=await db.select().from(comoNextEmailMessages).where(and(eq(comoNextEmailMessages.userId,1),eq(comoNextEmailMessages.messageId,sourceId))).limit(1);
 assert(!drafts.messages.some(m=>sameSubject(m.subject,source.subject))||Boolean(priorEmail?.replyDraftCommunicationId),'untracked_draft_exists');
 const sourceRecordId=`imap:${mailboxKeyFor(getConfiguredMailboxAddress()).slice(0,24)}:INBOX:${uidValidity}:507`;
 const imported=await db.transaction(async tx=>{
  await tx.execute(sql`SELECT id FROM como_next_work_files WHERE id=390001 AND user_id=1 FOR UPDATE`);
  let [email]=await tx.select().from(comoNextEmailMessages).where(and(eq(comoNextEmailMessages.userId,1),eq(comoNextEmailMessages.messageId,sourceId))).limit(1);
  if(!email){
   const result=await tx.insert(comoNextEmailMessages).values({userId:1,mailboxKey:mailboxKeyFor(getConfiguredMailboxAddress()),folderName:'INBOX',uidValidity,imapUid:507,messageId:source.messageId,messageIdSha256:messageIdentitySha(source,uidValidity),fromEmail:source.from,fromName:source.fromName,toText:source.to,ccText:source.cc,subject:source.subject,bodyText:source.textBody.trim().slice(0,1_000_000),bodySha256:sha(source.textBody.trim().slice(0,1_000_000)),receivedAt:source.date.toISOString().slice(0,19).replace('T',' '),serverSeen:source.isRead?1:0,attachmentCount:10,inboxStatus:'suggested',suggestedProjectId:6,suggestedWorkFileId:390001,suggestionReason:'استيرادManusللمصدر507الذيغابعنالمزامنة؛استلامفقط،لامراجعةتصميمأواستئنافالمسارالمتوقف.'});
   const id=Number(result[0].insertId);await tx.insert(comoNextEmailAttachments).values(source.attachments.map((a,ordinal)=>({emailMessageId:id,ordinal,fileName:a.filename,mimeType:a.contentType,byteSize:a.content!.byteLength,contentId:a.contentId||null,disposition:a.disposition||null})));
   [email]=await tx.select().from(comoNextEmailMessages).where(eq(comoNextEmailMessages.id,id));
  }
  assert(email.bodySha256===sha(source.textBody.trim())&&email.imapUid===507&&(!email.linkedWorkFileId||email.linkedWorkFileId===390001),'existing_source_conflict');
  let [communication]=await tx.select().from(comoNextCommunications).where(and(eq(comoNextCommunications.sourceSystem,'imap'),eq(comoNextCommunications.sourceRecordId,sourceRecordId))).limit(1);
  if(!communication){const r=await tx.insert(comoNextCommunications).values({userId:1,projectId:6,workFileId:390001,channel:'email',direction:'inbound',communicationStatus:'received',approvalStatus:'not_required',subject:source.subject,body:email.bodyText,fromText:`${source.fromName} <${source.from}>`,toText:source.to,ccText:source.cc,externalMessageRef:sourceId,evidenceReference:`IMAP INBOX UID507 UIDVALIDITY=${uidValidity} SHA256=${email.bodySha256}`,occurredAt:email.receivedAt,sourceSystem:'imap',sourceRecordId});[communication]=await tx.select().from(comoNextCommunications).where(eq(comoNextCommunications.id,Number(r[0].insertId)));}
  let [memory]=await tx.select().from(comoNextWorkMemory).where(and(eq(comoNextWorkMemory.sourceSystem,'imap'),eq(comoNextWorkMemory.sourceRecordId,sourceRecordId))).limit(1);
  if(!memory){const r=await tx.insert(comoNextWorkMemory).values({projectId:6,workFileId:390001,memoryType:'material',entryType:'email_message',title:'الفلل الأربع — استلام مخططات أرتك ذات المقاسات22أكتوبر،دوناعتماد',body:`منثيودورا؛وصل11:20دبي.المرفقاتمستلمةولممراجعةهندسية.\n${email.bodyText}`,sourceStatus:'received_readonly',sourceSystem:'imap',sourceRecordId,isCurrent:1,occurredAt:email.receivedAt});[memory]=await tx.select().from(comoNextWorkMemory).where(eq(comoNextWorkMemory.id,Number(r[0].insertId)));}
  await tx.update(comoNextEmailMessages).set({inboxStatus:'linked',linkedProjectId:6,linkedWorkFileId:390001,communicationId:communication.id,linkedAt:new Date().toISOString().slice(0,19).replace('T',' '),importance:'normal'}).where(eq(comoNextEmailMessages.id,email.id));
  await appendEvent(tx,{userId:1,projectId:6,workFileId:390001,actorType:'manus',actorUserId:null,eventType:'email_received_linked',summary:'الفلل الأربع — استردManusواردأرتك507الذيغابعنالمزامنة؛المخططاتوالملفاتمستلمةفقط،لااعتمادأوتفعيللمسارالتصميمالمتوقف.',payload:{emailId:email.id,communicationId:communication.id,attachmentCount:10,serverFlagsChanged:false,externalSideEffect:false},idempotencyKey:`event:${sourceRecordId}`});
  return {emailId:email.id,communicationId:communication.id,memoryId:memory.id,bodySha256:email.bodySha256};
 });
 save('imported-source',imported);fs.mkdirSync(`${root}/attachments`,{recursive:true});
 const attachmentManifest=[];
 for(const [ordinal,a] of source.attachments.entries()){
  assert(a.content&&a.content.length>0,'attachment_content_missing');
  const hash=sha(a.content);const localPath=path.join(root,'attachments',a.filename.replace(/[\\/]/g,'_'));fs.writeFileSync(localPath,a.content);
  let [document]=await db.select().from(comoNextDocuments).where(eq(comoNextDocuments.sha256,hash)).limit(1);
  if(!document){const stored=await storagePut(`como-next-private/email/${randomUUID()}/${a.filename.replace(/[^\p{L}\p{N}._ -]+/gu,'_')}`,a.content,a.contentType);const r=await db.insert(comoNextDocuments).values({title:a.filename,fileName:a.filename,mimeType:a.contentType,byteSize:a.content.length,sha256:hash,storageKey:stored.key,storageUrl:stored.url,sourceSystem:'imap',sourceKey:`email:${imported.emailId}:attachment:${ordinal}`});[document]=await db.select().from(comoNextDocuments).where(eq(comoNextDocuments.id,Number(r[0].insertId)));}
  await db.insert(comoNextWorkMemoryDocuments).values({projectId:6,workFileId:390001,memoryId:imported.memoryId,documentId:document.id,relationType:'attachment',sourceSystem:'imap',sourceRecordId:`${sourceRecordId}:attachment:${ordinal}`}).onDuplicateKeyUpdate({set:{relationType:'attachment'}});
  await db.update(comoNextEmailAttachments).set({storageStatus:'stored',documentId:document.id,sha256:hash,storageError:null}).where(and(eq(comoNextEmailAttachments.emailMessageId,imported.emailId),eq(comoNextEmailAttachments.ordinal,ordinal)));
  attachmentManifest.push({ordinal,fileName:a.filename,byteSize:a.content.length,sha256:hash,documentId:document.id,path:localPath,engineeringReviewCompleted:false});
  console.log(`حفظالمصدر${ordinal+1}/10: ${a.filename}`);
 }
 save('attachment-manifest',attachmentManifest);await guard();
 const draft=await createReplyDraftFromEmailCommand({userId:1,emailId:imported.emailId,body,ccText:'mzakout@artecint.com, wael@zooma.ae'});
 save('draft-save-result',draft);
 const [ledger]=rows(await db.execute(sql`SELECT * FROM como_mailbox_draft_ledger WHERE user_id=1 AND work_file_id=390001 AND communication_id=${draft.id}`));
 const uid=Number(ledger?.draft_uid||0);assert(uid&&ledger.state==='draft_saved','draft_not_proven');
 const live=await fetchEmailByUID(uid,undefined,'Drafts');
 assert(live&&norm(live.textBody)===norm(body)&&live.subject===source.subject&&env(live.to)==='tdimitrova@artecint.com'&&env(live.cc)==='mzakout@artecint.com,wael@zooma.ae','live_draft_mismatch');
 const allDrafts=await fetchReadonlyFolderSince('Drafts',24,100,undefined,'6180578');assert(allDrafts.messages.filter(m=>sameSubject(m.subject,source.subject)).length===1,'draft_not_unique');
 const headers=allDrafts.messages.find(m=>m.uid===uid)?.headers;
 assert(headers?.['in-reply-to']===sourceId&&String(headers?.references||'').includes(sourceId)&&headers?.['x-como-draft-key']===`email-reply-draft:${imported.emailId}`,'reply_thread_mismatch');
 const ref=`Drafts UID ${uid}`;
 const human=await createActionCommand({userId:1,workFileId:390001,title:'الفلل الأربع — عبد الرحمن: مراجعة وإرسال شكر استلام مخططات أرتك22أكتوبر',description:`وصلالمصدرCOMO${imported.emailId}/INBOX50711:20دبي.حفظManusرداستلامفقط${ref}/مراسلة${draft.id}إلىثيودوراCCماجدووائل.لاملاحظاتهندسيةأواعتمادأووعدموعد.انتظارالتوجهوالتعديلاتمنوائل1830001باقٍ؛لااستئنافللمخططاتالمتوقفةأوبدءRawan.`,acceptanceCriteria:'يراجععبدالرحمنردالاستلامويرسلهمنCOMOإذاوافق؛ليساعتمادًالتصميمأوتوجيهًابالبدء،ولايسجلManusأنالبريدأُرسل.',ownerType:'human',ownerUserId:1,priority:'important',idempotencyKey:`artec-receipt-review:${imported.emailId}`,actorType:'manus',actorUserId:null});
 const summary=`الفلل الأربع — استُردواردأرتك507/COMO${imported.emailId}22أكتوبر11:20دبي؛عشرمرفقاتحُفظتكأدلةاستلامغيرمراجعةهندسيًا.رداستلامواحد${ref}إلىثيودوراCCماجدووائلمحفوظولميُرسل.سببالتأخير:غيابالرسالةعناستيرادCOMOبعدتوقفالنبضات؛لامعالجةآليةمثبتةبعد09:42دبي.انتظاروايل1830001والسداد5586وRawanوالمسحوالتربةوالحملالكهربائيلمتتغير.الاستيرادالمحددوالردعولجا؛استمراريةالنبضاتغيرمُصلحةولمأغيرأتمتة.`;
 const receipt={...imported,sourceUid:507,receivedAtDubai:'2026-10-22 11:20:13',communicationDraftId:draft.id,mailboxDraftRef:ref,ownerReviewActionId:human.id,reviewCompleted:true,engineeringReviewCompleted:false,reviewedDocumentIds:[],receivedDocumentIds:attachmentManifest.map(a=>a.documentId),draftVerified:true,draftUnique:true,sent:false,paymentChanged:false,designApproved:false,rawanStarted:false,automationChanged:false,existingVillaActionsUnchanged:true,waitingForWaelPreserved:true,externalSideEffect:false,checkedAt:new Date().toISOString(),executionSummary:summary};
 await db.transaction(async tx=>{
  await tx.execute(sql`SELECT id FROM como_next_work_files WHERE id=390001 AND user_id=1 FOR UPDATE`);
  const r=await tx.insert(comoNextWorkMemory).values({projectId:6,workFileId:390001,memoryType:'work_product',entryType:'mail_receipt_handling',title:'الفلل الأربع — إيصالاستلامأرتك22أكتوبرومسودةالرد',body:summary+`\nمهمةعبدالرحمن${human.id}لردالاستلامفقط.\nنصالرد:\n${body}`,sourceStatus:'reviewed',sourceSystem:'como_manual_mail_review',sourceRecordId:key,isCurrent:1,occurredAt:new Date().toISOString().slice(0,19).replace('T',' ')});const workProductId=Number(r[0].insertId);
  await appendEvent(tx,{userId:1,projectId:6,workFileId:390001,actionId:human.id,actorType:'manus',actorUserId:null,eventType:'manus_mail_receipt_reviewed',summary,payload:JSON.parse(JSON.stringify({...receipt,workProductId})),idempotencyKey:key});
  (receipt as any).workProductId=workProductId;
 });
 const after=await guard();save('protected-after',after);
 const sara:any=await readExecutiveWorkFile({memberId:'abdulrahman',nameAr:'عبد الرحمن',role:'owner'},JSON.stringify({work_file_id:390001,focus:'overview',question:'رداستلامأرتك22أكتوبرومسودةالبريدوالانتظارالقائم'}));assert(sara.found===true&&JSON.stringify(sara).includes(ref),'sara_draft_not_visible');save('sara-state',sara);
 save('draft-live-proof',{uid,live:{...live,attachments:[]},allDrafts:allDrafts.messages.map(m=>({uid:m.uid,messageId:m.messageId,subject:m.subject,headers:m.headers,textBody:m.textBody})),sent:false});save('receipt',receipt);console.log(JSON.stringify(receipt,null,2));
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1)});
