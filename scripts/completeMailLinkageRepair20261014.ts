import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {sql} from 'drizzle-orm';
import {getDb} from '../server/db';
import {linkEmailToWorkFileCommand} from '../server/services/comoNextEmailInbox';
import {appendEvent,createCommunicationDraftCommand,createActionCommand} from '../server/services/comoNextCommands';
import {completeDispatchedMailLinkageReview,executeDispatchedDirectiveCommand,completeDispatchedMailReview,type MailReviewResponseHandling} from '../server/services/comoManusDispatch';
import {readMailExecutionHealth} from '../server/services/comoMailExecution';
import {fetchReadonlyFolderSince} from '../server/emailMonitor';
import {readExecutiveWorkFile} from '../server/services/saraWorkFileReader';
const root='/home/ubuntu/reports/como-linkage-repair-2026-10-14';
const rows=(v:any):any[]=>Array.isArray(v)&&Array.isArray(v[0])?v[0]:v;
const sha=(s:string|Buffer)=>createHash('sha256').update(s).digest('hex');
const norm=(s:string)=>String(s||'').replace(/\r/g,'').trim();
const canonical=(s:string)=>s.replace(/^\s*(?:(?:re|fw|fwd)\s*:\s*)+/i,'').trim().toLowerCase();
const initial=JSON.parse(fs.readFileSync(root+'/application-state-before.json','utf8'));
const reviewedHashes=new Map<number,Set<string>>();
// These are the actual attachment-review outputs of the five item reviewers;
// the DB document identifiers are assigned only by the existing linker later.
for(const id of [1200001,1260001,1440001,1650001]){
 const r=JSON.parse(fs.readFileSync(`${root}/${id}/report.json`,'utf8'));
 reviewedHashes.set(id,new Set<string>((JSON.stringify(r.attachmentEvidence||r['مراجعة_المرفقات']||[]).match(/[a-f0-9]{64}/g)||[])));
}
const nasrin141=fs.readdirSync(`${root}/1410001`).filter(f=>f.toLowerCase().endsWith('.pdf'));
if(nasrin141.length!==5)throw Error('nasrin_initial_review_files_missing');
reviewedHashes.set(1410001,new Set(nasrin141.map(f=>sha(fs.readFileSync(`${root}/1410001/${f}`)))));
const proof141=JSON.parse(fs.readFileSync(`${root}/1410001/live-imap-email.json`,'utf8'));
const source141=initial.emails.find((e:any)=>e.id===1410001);
if(sha(norm(proof141.textBody))!==source141.body_sha256)throw Error('nasrin_initial_live_body_not_matched');
// Cross-project replies have an already established cross-project request file.
// K&P's linked outgoing and earlier incoming share the actual distinct thread
// in file 510001, not the model's Design International suggestion 60019.
const items=[
 {id:1200001,file:390001,project:6,directive:600001},
 {id:1260001,file:510001,project:1,directive:600002},
 {id:1410001,file:540001,project:1,directive:600003},
 {id:1440001,file:540001,project:1,directive:600004},
 {id:1650001,file:600001,project:1,directive:600005},
];
const key='mail-linkage-repair:2026-10-14';
async function main(){
 const db=await getDb();if(!db)throw Error('database_unavailable');
 const protectedSnapshot=async()=>({payments:rows(await db.execute(sql`SELECT * FROM como_next_lifecycle_lanes WHERE user_id=1 AND kind='payment' ORDER BY id`)),oldBundle:rows(await db.execute(sql`SELECT * FROM como_next_work_files WHERE id=60014 AND user_id=1`)),pendingOwner:rows(await db.execute(sql`SELECT * FROM como_next_staged_directives WHERE user_id=1 AND status='pending' AND source_member_id<>'system:manus-action' ORDER BY id`))});
 const protectedBefore=await protectedSnapshot();
 const matches:any[]=[];
 for(const item of items){
  const source=initial.emails.find((e:any)=>e.id===item.id);
  const [live]=rows(await db.execute(sql`SELECT body_sha256,inbox_status,linked_work_file_id FROM como_next_email_messages WHERE id=${item.id} AND user_id=1`));
  if(!live||live.body_sha256!==source.body_sha256||(live.linked_work_file_id&&Number(live.linked_work_file_id)!==item.file))throw Error('source_or_target_changed:'+item.id);
  let reviewedReadonlySource:any;
  if(item.id===1440001){
   const cached=JSON.parse(fs.readFileSync(`${root}/1440001/source-live-email-1440001.json`,'utf8'));
   reviewedReadonlySource={...cached,date:new Date(cached.date),attachments:cached.attachments.map((a:any)=>{
    const file=path.resolve(a.absolutePath);if(!file.startsWith(`${root}/1440001/attachments/`))throw Error('attachment_cache_path_changed');
    const content=fs.readFileSync(file);if(sha(content)!==a.sha256||content.length!==a.byteSize)throw Error('attachment_cache_hash_changed');
    return {filename:a.originalFilename,contentType:a.mimeType,size:a.byteSize,content};
   })};
  }
  const linked=await linkEmailToWorkFileCommand({userId:1,emailId:item.id,workFileId:item.file,projectId:item.project,suppressReplyDraft:true,reviewedReadonlySource});
  const attachments=rows(await db.execute(sql`SELECT id,ordinal,document_id,sha256,mime_type,disposition,file_name,storage_status FROM como_next_email_attachments WHERE email_message_id=${item.id} ORDER BY ordinal`));
  const substantive=attachments.filter(a=>!(a.disposition==='inline'&&String(a.mime_type).startsWith('image/')));
  if(substantive.some(a=>a.storage_status!=='stored'||!a.document_id||!reviewedHashes.get(item.id)?.has(a.sha256)))throw Error('reviewed_attachment_hash_not_matched:'+item.id);
  const context=item.id===1260001?'الصادر والمراسلة1470001 والوارد1650003 يثبتان خيطKP105في510001؛ 60019خاصبDesignInternational ولا يُستخدم،60014ملغى ولا يُحيى.':item.id===1410001||item.id===1440001?'الصادرCOMO1200002/Sent214/مراسلة1890001/ذاكرة2340001 يثبت طلبالوثائقمتعددالمشاريعفي540001؛ الموضوعوالستقطعوالمرسلوالنسخ متطابقة،وليس ربطكلالحزمةبقطعةواحدة.':item.id===1200001?'القطعة6180578وMES/2026-3849_1 وPDFالموقع وبصمته cd6117826ed444ad2eafa1d1af80f8007320638af7450961b2d2d36e2de27446 تثبت ملفالفلل390001، والتوقيعليسإثباتسداد.':'رؤوسIn-Reply-To/ReferencesترتبطCOMO1620001/Sent222/مراسلة2370001 وردالمالكالموثق540001فيملف600001،لا60014الملغى.';
  const evidence=`مطابقة مصدر COMO #${item.id} إلى ملف #${item.file}؛ projectId=${item.project}. SHA-256=${source.body_sha256}. ${context} رُوجعت نسخةالمصدرالحيةوالخيطوالوثائقالموضوعية؛ لا تعليماتمنالبريد ولا SMTP أوتغييرمالية. مرفقاتالمصدرالمفحوصةالمخزنة: ${JSON.stringify(substantive.map(a=>({id:a.document_id,sha256:a.sha256,file:a.file_name})))}.`;
  const completed=await completeDispatchedMailLinkageReview({directiveId:item.directive,bodySha256:source.body_sha256,targetWorkFileId:item.file,evidence,continueInCurrentTask:true});
  matches.push({item,linked,matching:completed,reviewedDocumentIds:substantive.map(a=>Number(a.document_id))});
  fs.writeFileSync(root+'/matched-source-receipts.json',JSON.stringify(matches,null,2)+'\n');
  console.log(`COMO #${item.id}: source matched; ${substantive.length} reviewed substantive documents; substantive review still pending.`);
 }
 // Verify the live outgoing folder before creating any contextual follow-up.
 const threadSubject='Land Plot Documents and Service Charge Status';
 const sent=await fetchReadonlyFolderSince('Sent',72,250,undefined,threadSubject);
 const drafts=await fetchReadonlyFolderSince('Drafts',72,250,undefined,threadSubject);
 const lastDate=new Date('2026-10-13T08:41:06Z');
 const sentFollowup=sent.messages.find(m=>m.date>=lastDate&&canonical(m.subject)===canonical(source141.subject)&&/6182776/.test(m.textBody)&&/service.?charge/i.test(m.textBody));
 fs.writeFileSync(root+'/reply-preflight.json',JSON.stringify({sentFollowup:sentFollowup?{uid:sentFollowup.uid,messageId:sentFollowup.messageId,subject:sentFollowup.subject}:null,checkedAt:new Date().toISOString(),liveDraftCount:drafts.messages.length},null,2)+'\n');
 let nasrinDraftId:number|undefined,ownerActionId:number|undefined,ref:string|undefined;
 if(sentFollowup)throw Error('owner_already_followed_up_requires_sent_reconciliation');
 const body=`Dear Nasrin,\n\nI have reviewed the land-plot documents received. To complete the records, could you please confirm whether documents for the merged Nad Al Sheba plot (6182776) are available?\n\nWe also still need the service-charge status for the plots covered by our original request: whether paid, the date or period paid up to, and any outstanding balance. Please prioritise the Four Villas plot (6180578), as outstanding charges may delay approvals.\n\nKind regards,\nAbdalrahman Zaqout\nDevelopment Director\nCOMO Real Estate Development L.L.C\nM: +971 55 106 2668\nE: a.zaqout@comodevelopments.com`;
 const sameDraft=drafts.messages.find(m=>canonical(m.subject)===canonical(source141.subject)&&norm(m.textBody)===body);
 const [oldDraft]=rows(await db.execute(sql`SELECT id FROM como_next_communications WHERE user_id=1 AND source_record_id=${key+':nasrin-followup'} AND work_file_id=540001`));
 if(sameDraft&&!oldDraft)throw Error('unregistered_same_draft_do_not_duplicate');
 const created=await createCommunicationDraftCommand({userId:1,workFileId:540001,channel:'email',subject:initial.emails.find((e:any)=>e.id===1440001).subject,body,toText:'account.mrt@zooma.ae',ccText:'shahid@zooma.ae, wael@zooma.ae',sourceEmailId:1440001,idempotencyKey:key+':nasrin-followup'});
 nasrinDraftId=Number(created.id);
 const [ledger]=rows(await db.execute(sql`SELECT * FROM como_mailbox_draft_ledger WHERE user_id=1 AND communication_id=${nasrinDraftId}`));
 if(!ledger||ledger.state!=='draft_saved'||!ledger.draft_uid||ledger.draft_folder!=='Drafts')throw Error('nasrin_draft_not_proven');
 const verify=await fetchReadonlyFolderSince('Drafts',24,250,undefined,threadSubject);
 const current=verify.messages.find(m=>m.uid===Number(ledger.draft_uid));
 const header=(name:string)=>{const h:any=(current as any)?.headers;return String(h instanceof Map?h.get(name):h?.[name]||'');};
 const [sourceDb]=rows(await db.execute(sql`SELECT message_id FROM como_next_email_messages WHERE id=1440001 AND user_id=1`));
 if(!current||norm(current.textBody)!==body||!String(current.to).toLowerCase().includes('account.mrt@zooma.ae')||header('in-reply-to')!==sourceDb.message_id||!header('references').includes(sourceDb.message_id))throw Error('nasrin_live_draft_or_thread_mismatch');
 ref=`Drafts UID ${ledger.draft_uid}`;
 const ownerAction=await createActionCommand({userId:1,workFileId:540001,title:'المشاريع — مراجعة وإرسال استكمال وثائق الأراضي وبيان رسوم الخدمات',description:`رد عملي لنسرين محفوظ في ${ref}، إلىنسرين ونسخةشاهد ووائل. يطلبالقطعةالمدمجة6182776إنكانت متاحة وبيانرسومالخدماتوالفترةوالرصيد معأولويةالفلل6180578. ليسشكرًا متأخرًا ولاطلبدفع. لم يُرسل؛ بانتظارمراجعة/إرسالالمالك.`,acceptanceCriteria:'إرسال المالك الفعلي من COMO أو قراره بتعديل/إلغاء المسودة؛ حفظها ليس إرسالًا ولا بدء انتظار رد جديد.',ownerType:'human',priority:'important',actorType:'manus',actorUserId:null,idempotencyKey:key+':nasrin-owner-send'});
 ownerActionId=Number(ownerAction.id);
 await db.transaction(async tx=>{
  await tx.execute(sql`SELECT id FROM como_next_work_files WHERE id=540001 FOR UPDATE`);
  await tx.execute(sql`UPDATE como_next_email_messages SET reply_draft_communication_id=${nasrinDraftId} WHERE id=1440001 AND user_id=1 AND linked_work_file_id=540001`);
  await tx.execute(sql`UPDATE como_next_actions SET title='المشاريع — بانتظار بيان رسوم الخدمات ووثائق القطعة المدمجة إن توفرت',description=${`وردت حزمةنسرين COM01410001و1440001، وحُفظتوفُحصت وثائقخمسمجموعات:6457956و6457879و437و6185392و6180578. لمتظهر وثائق6182776ولا بيانرسومالخدماتللفترةوالرصيد. انتظار990001هوالطلبالأصليالمرسل12أكتوبر/Sent214، لا انتظاررسالةجديدةلمتُرسل. الأولويةللفلل6180578. استكمالعمليجاهزفي${ref} بانتظارالمالك، دونطلبدفعأوإثباتسداد.`},evidence_reference=${`COMO1410001/1440001؛ ${ref}غيرمرسل؛ original Sent214`} WHERE id=990001 AND user_id=1 AND work_file_id=540001 AND action_status='waiting_external'`);
  await tx.execute(sql`UPDATE como_next_work_files SET desired_outcome=${`المشاريع — استلمنا وفحصناوثائقخمسمجموعاتمننسرين. المطلوبمنالمالك:مسودةالاستكمال${ref}. علىManusمتابعة بيانرسومالخدماتوالقطعةالمدمجة6182776؛ طلب12أكتوبرالأصليمازالمفتوحًا للمعلوماتالناقصةفقط،لا إعادةطلبكلالوثائق ولاشكرمتأخر ولاسدادمفترض.`} WHERE id=540001 AND user_id=1`);
  await appendEvent(tx,{userId:1,projectId:1,workFileId:540001,actionId:ownerActionId,actorType:'manus',actorUserId:null,eventType:'land_documents_review_and_next_step',summary:`المشاريع — وثائقنسرينفُحصت؛ قُصرالانتظارعلىالبيانوالقطعةالمدمجة. استكمالعملي${ref}لم يُرسل`,payload:{sourceEmailIds:[1410001,1440001],draftCommunicationId:nasrinDraftId,ownerActionId,originalWaitingActionId:990001,newExternalWaitStarted:false,paid:false},idempotencyKey:key+':nasrin-review-nextstep'});
 });
 const summaryById:Record<number,string>={
  1200001:'الفلل الأربعة — فُحص عرض المسح الموقع المستلم من ميا، وثبت توقيع/ختم وائل؛ لا سداد أو إنجاز مسح مثبت، ولا إعادة إرسال العرض.',
  1260001:'ماجان — كيفلير رفض الترتيب الذي يستبعد فريقه المعماري؛ حُفظ الرد في ملفه الصحيح وانتهى انتظار القبول، دون تفاوض أو إحياء الحزمة الملغاة.',
  1410001:'المشاريع — فُحصت حزمة نسرين الأولى وحُفظت مع طلب الوثائق الأصلي متعدد المشاريع؛ اكتملت قراءة الوثائق لا إثبات رسوم الخدمات.',
  1440001:`المشاريع — فُحصت حزمة نسرين الثانية، والانتظار للمعلوماتالناقصةفقط. رد استكمال عملي ${ref}جاهز وغيرمرسل، لاشكرمتأخر أو طلبدفع.`,
  1650001:'ماجان — رد خطيب وعلمي إقرار لتحديث المالك المرسل؛ لا حاجة لرد شكر آخر أو انتظار رد إلزامي، ومراجعة موجز التصميم مع كولييرز تبقى مستقلة.',
 };
 const responseById:Record<number,MailReviewResponseHandling>={
  1200001:{kind:'no_reply_needed',evidence:'عرض التوقيع وصل ونُقل مسبقًا في الصادرUID215وفق أدلةالمراجعة؛ لا إعادةعرضأوشكرمتأخر، ولا إثباتسدادمن ذلك.',nextStep:'Manus يتابع تنفيذ المسح وفحص التربة في570005؛ السدادمسارمستقللاينتهيبوصولالعرضالموقع.'},
  1260001:{kind:'no_reply_needed',evidence:'ردكيفلير رفضصريح،والحزمةالسابقة60014ملغاةبتوجيهالمالك؛ لا تفاوضأوتذكيرأوشكرمتأخر يعيد إحياءها.',nextStep:'تسجيل انتهاء احتمالالترتيبفي510001،لاعملعلىالمالكولاانتظارردكيفلير؛ البدائل ضمنملفاتماجانالمستقلة.'},
  1410001:{kind:'no_reply_needed',evidence:`الحزمةالأولىاستُكملتبالثانية1440001،وتجهيزالاستكمالالموضوعيجُمعفيDraftواحد${ref}علىأحدثخيط؛ لاتكرارردأوشكرمتأخر.`,nextStep:`مراجعةالمالك${ref}ثممتابعةManusللمعلوماتالناقصةوفق990001،أولويةالفلل6180578وليسطلبدفع.`},
  1440001:{kind:'draft_saved',evidence:`تحقّقحيمن${ref}ونصهومستلميهورؤوسIn-Reply-ToوReferencesعلىمصدر1440001؛ لاSMTPولاانتظارردجديدقبلاعتبارإرسالالمالك.`,nextStep:`علىالمالكمراجعةوإرسالالمسودة#${ownerActionId}؛علىManusمتابعةبيانالرسوموالوثيقةالمدمجةفي990001منالطلبالأصلي.`},
  1650001:{kind:'no_reply_needed',evidence:'أمجد يشكر تحديثالمالكالمثبتSent222/COMO1620001،والرؤوسمتطابقة؛ ردعلىإقرارالمجاملةهنايزيدبريدًالاحاجةله.',nextStep:'Manus يُبقيتحديثDesignBriefمعلقًاعلىمراجعةالجدوىمعكولييرزفيملفها،ولايفتحانتظارردإلزاميمنخطيبوعلمي.'},
 };
 const receipts:any[]=[];
 for(const m of matches){
  const [action]=rows(await db.execute(sql`SELECT id FROM como_next_actions WHERE user_id=1 AND work_file_id=${m.item.file} AND source_system='como_mail_execution' AND source_record_id=${`mail-review:${m.item.id}`}`));
  const [stage]=rows(await db.execute(sql`SELECT id FROM como_next_staged_directives WHERE user_id=1 AND stage_key=${`system-manus-action:${action.id}`}`));
  const claimed=await executeDispatchedDirectiveCommand({directiveId:Number(stage.id)});
  if(claimed.fulfillment!=='requires_agent_mail_review'&&claimed.reason!=='dispatch_already_claimed')throw Error('review_not_claimed');
  const source=initial.emails.find((e:any)=>e.id===m.item.id);
  const report=m.item.id===1410001?{attachmentEvidence:['قرئتوحُفظتالملفاتالخمسةالفعليّةضمنمجلدالمراجعةوبصماتهامتطابقة؛لااستنتاجسدادمنعقدأوسندملكّية.']}:JSON.parse(fs.readFileSync(`${root}/${m.item.id}/report.json`,'utf8'));
  const work=`مراجعة مصدر COMO #${m.item.id}؛ الملف #${m.item.file}.\n${summaryById[m.item.id]}\nبصمةالنص=${source.body_sha256}.\nالمرفقاتالموضوعيةالمفحوصة=${JSON.stringify(m.reviewedDocumentIds)}.\nأدلةفحصالمرفقات: ${JSON.stringify(report.attachmentEvidence||report['مراجعة_المرفقات']||[])}\nمعالجةالردوالخطوةالتالية: ${JSON.stringify(responseById[m.item.id])}\nهذافحصهويةالمصدرونوعالوثائقوتغطيةالطلب،لاتدقيققانونيلعقودالشراءولاإثباتسداد. صندوقCOMOفقط،لاSMTPولاإعادةإحياء60014.`;
  const receipt=await completeDispatchedMailReview({directiveId:Number(stage.id),bodySha256:source.body_sha256,reviewedDocumentIds:m.reviewedDocumentIds,summary:summaryById[m.item.id],workProductBody:work,communicationDraftId:m.item.id===1440001?nasrinDraftId:undefined,responseHandling:responseById[m.item.id]});
  receipts.push({emailId:m.item.id,receipt});fs.writeFileSync(root+'/completed-review-receipts.json',JSON.stringify(receipts,null,2)+'\n');
  console.log(`COMO #${m.item.id}: actual review receipt persisted, response and next step recorded.`);
 }
 await db.transaction(async tx=>{
  await tx.execute(sql`SELECT id FROM como_next_work_files WHERE id=510001 FOR UPDATE`);
  await tx.execute(sql`UPDATE como_next_work_files SET work_file_status='closed',closed_at=COALESCE(closed_at,UTC_TIMESTAMP()),closure_evidence_ref='COMO1260001/INBOX490؛ رفضصريحللتقسيم،لاقبولأوترسية',desired_outcome=${summaryById[1260001]} WHERE id=510001 AND user_id=1 AND work_file_status NOT IN ('closed','cancelled')`);
  await appendEvent(tx,{userId:1,projectId:1,workFileId:510001,actorType:'manus',actorUserId:null,eventType:'kieferle_arrangement_declined',summary:summaryById[1260001],payload:{emailId:1260001,noNewReply:true,oldBundleUnchanged:true},idempotencyKey:key+':kp-declined'});
 });
 await db.transaction(async tx=>{
  await tx.execute(sql`SELECT id FROM como_next_work_files WHERE id=390001 FOR UPDATE`);
  await tx.execute(sql`UPDATE como_next_work_files SET desired_outcome=CONCAT(desired_outcome,${'\nتحديث14أكتوبر: النسخةالموقعةلوائل/MES2026-3849_1 وصلتمنمياCOMO1200001وفُحصتوسُجلت؛ لا انتظارنسخةموقعةولا إعادةرسالةالتوقيع. متابعةتنفيذالمسحوفحصالتربةوالماليةمستقلة؛لا دليلدفع.'}) WHERE id=390001 AND user_id=1 AND desired_outcome NOT LIKE '%تحديث14أكتوبر: النسخةالموقعةلوائل%'`);
  await appendEvent(tx,{userId:1,projectId:6,workFileId:390001,actorType:'manus',actorUserId:null,eventType:'signed_survey_source_reviewed',summary:summaryById[1200001],payload:{emailId:1200001,signedQuoteVerified:true,paid:false,surveyCompleted:false,noNewReply:true},idempotencyKey:key+':signed-survey'});
 });
 const protectedAfter=await protectedSnapshot();
 if(JSON.stringify(protectedBefore)!==JSON.stringify(protectedAfter))throw Error('protected_payment_bundle_or_owner_pending_changed');
 const health=await readMailExecutionHealth(1);
 for(const item of items)if(health.items.find(r=>r.emailId===item.id)?.state!=='review_completed')throw Error('source_review_still_pending:'+item.id);
 const sara={};for(const id of [390001,510001,540001,600001])Object.assign(sara,{[id]:await readExecutiveWorkFile({memberId:'abdulrahman',nameAr:'عبدالرحمن',role:'owner'},JSON.stringify({work_file_id:id,focus:'actions'}))});
 fs.writeFileSync(root+'/sara-after.json',JSON.stringify(sara,null,2)+'\n');
 const result={health,receipts,nasrinDraftId,ownerActionId,mailboxDraftRef:ref,sent:false,protectedRecordsUnchanged:true,newExternalWaitStarted:false,checkedAt:new Date().toISOString()};
 fs.writeFileSync(root+'/completed-repair.json',JSON.stringify(result,null,2)+'\n');
 fs.writeFileSync(root+'/Nasrin_Land_Documents_Followup_EN.md',`# Projects — Land documents and service-charge status\n\n**To:** account.mrt@zooma.ae\n\n**CC:** shahid@zooma.ae, wael@zooma.ae\n\n**Status:** COMO ${ref}; not sent.\n\n---\n\n${body}\n`);
 console.log(JSON.stringify({counts:health.counts,mailboxDraftRef:ref,nasrinDraftId,ownerActionId,protectedRecordsUnchanged:true,sent:false},null,2));
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1)});
