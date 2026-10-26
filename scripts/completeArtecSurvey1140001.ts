import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {sql} from 'drizzle-orm';
import {getDb} from '../server/db';
import {fetchReadonlyFolderSince,getConfiguredMailboxAddress} from '../server/emailMonitor';
import {createReplyDraftFromEmailCommand} from '../server/services/comoNextEmailInbox';
import {createActionCommand,requireProjectAccess,appendEvent} from '../server/services/comoNextCommands';
import {completeDispatchedMailReview,readDispatchForDirective,recordManusDispatchProgress} from '../server/services/comoManusDispatch';
import {readExecutiveWorkFile} from '../server/services/saraWorkFileReader';
const root='/home/ubuntu/reports/como-directive-1140001-2026-10-26';
const directiveId=1140001,sourceId=2310001,actionId=2370001;
const sourceSha='a2a5eeee0bef9f71024c1442f7d427d39e8ae2787d7427a83e828f99b7a763be';
const messageId='<67593479d8f6426f8428583875d3e85f@artecint.com>';
const norm=(s:string)=>s.replace(/\r\n?/g,'\n').trim();
const sha=(s:Buffer|string)=>createHash('sha256').update(s).digest('hex');
const canonicalSubject=(s:string)=>s.replace(/^\s*(?:(?:re|fw|fwd)\s*:\s*)+/i,'').trim().toLowerCase();
const envelope=(s:string)=>Array.from(new Set(s.toLowerCase().match(/[a-z0-9.!#$%&'*+\/?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}/g)||[])).sort().join(',');
const rows=(r:any):any[]=>r[0];
const load=(name:string)=>JSON.parse(fs.readFileSync(`${root}/${name}.json`,'utf8'));
const save=(name:string,v:any)=>fs.writeFileSync(`${root}/${name}.json`,JSON.stringify(v,null,2)+'\n');
async function main(){
 const db=await getDb();assert(db,'database_unavailable');await requireProjectAccess(db,6,1,'write');assert(getConfiguredMailboxAddress()==='a.zaqout@comodevelopments.com','COMO_only');
 const dispatch=await readDispatchForDirective({directiveId});
 if(dispatch?.state==='completed'){save('replay-receipt',{replayed:true,dispatch});console.log(JSON.stringify({replayed:true,workProductId:dispatch.workProductId,mailboxDraftRef:dispatch.mailboxDraftRef}));return;}
 assert(dispatch?.state==='running','dispatch_not_claimed');
 const [authority]=rows(await db.execute(sql`SELECT * FROM como_next_staged_directives WHERE id=1140001 AND user_id=1 AND project_id=6 AND work_file_id=390001 AND action_id=2370001 AND source_member_id='system:manus-action' AND status='submitting'`));assert(authority,'authority_changed');
 const [source]=rows(await db.execute(sql`SELECT * FROM como_next_email_messages WHERE id=2310001 AND user_id=1 AND linked_project_id=6 AND linked_work_file_id=390001 AND inbox_status='linked' AND folder_name='INBOX'`));assert(source?.body_sha256===sourceSha&&source.message_id===messageId,'source_changed');
 const manifest=load('package-manifest');assert(manifest.length===9,'package_missing');
 const attachments=rows(await db.execute(sql`SELECT * FROM como_next_email_attachments WHERE email_message_id=2310001 ORDER BY ordinal`));assert(attachments.length===9,'attachments_changed');
 for(const m of manifest){const a=attachments.find(x=>Number(x.document_id)===m.documentId);assert(a?.storage_status==='stored'&&a.sha256===m.sha256&&sha(fs.readFileSync(m.path))===m.sha256,'attachment_changed');}
 // The reviewed CAD findings file is written only after the local decoder review finishes.
 const cad=JSON.parse(fs.readFileSync(root+'/cad-review-result.json','utf8'));assert(cad.reviewCompleted===true&&cad.documentIds?.includes(1800002)&&cad.documentIds?.includes(1800006),'cad_review_missing');
 const live=load('response-live');assert(live.readOnly===true&&live.Sent&&live.Drafts,'response_proof_missing');
 const target=canonicalSubject(source.subject);
 assert(!live.Sent.messages.some((m:any)=>canonicalSubject(m.subject)===target),'survey_already_replied');
 const persistedDraft=fs.existsSync(root+'/draft-save-result.json')?load('draft-save-result'):null;
 assert(!live.Drafts.messages.some((m:any)=>canonicalSubject(m.subject)===target),'survey_draft_existed_before_application');
 assert(!source.reply_draft_communication_id||(persistedDraft?.id&&Number(source.reply_draft_communication_id)===Number(persistedDraft.id)&&persistedDraft.mailboxDraft?.uid),'unproven_existing_draft');
 const snapshot=async()=>({file:rows(await db.execute(sql`SELECT * FROM como_next_work_files WHERE id=390001 AND user_id=1`)),actions:rows(await db.execute(sql`SELECT * FROM como_next_actions WHERE work_file_id=390001 AND user_id=1 ORDER BY id`)),lanes:rows(await db.execute(sql`SELECT * FROM como_next_lifecycle_lanes WHERE user_id=1 ORDER BY id`)),pending:rows(await db.execute(sql`SELECT * FROM como_next_staged_directives WHERE user_id=1 AND status='pending' ORDER BY id`)),communications:rows(await db.execute(sql`SELECT * FROM como_next_communications WHERE user_id=1 AND work_file_id=390001 ORDER BY id`)),ledger:rows(await db.execute(sql`SELECT * FROM como_mailbox_draft_ledger WHERE user_id=1 AND work_file_id=390001 ORDER BY id`))});
 let before:any;
 if(fs.existsSync(root+'/protected-before.json'))before=load('protected-before');else {before=await snapshot();save('protected-before',before);}
 const now=await snapshot();assert.deepEqual(now.file,before.file,'file_changed_before_application');assert.deepEqual(now.lanes,before.lanes,'lanes_changed_before_application');assert.deepEqual(now.pending,before.pending,'pending_changed_before_application');
 const body=fs.readFileSync(root+'/reply-body.txt','utf8').trim();
 await recordManusDispatchProgress({directiveId,summary:'الفلل الأربع — فُحصت رسالة المسح2310001 وخيطها وتسعة مرفقات ببصمات مطابقة، ولوحاتPDF والفاتورة كاملة ونتيجة الفحص المحلي لملفَيDWG موثقة. فحصSent/Draftsقبلالحفظلم يجدردًا أومسودةمسح؛أي مسودةمحفوظةبالأثرالحالييُصالح توثيقهافقط دونحفظثان. استلام المسح مستقل عن فحص التربة وعن فاتورة1,260درهم غير المثبتة السداد؛ لا تغيير5586 أو انتظار وائل أوRawan.'});
 const draft=persistedDraft||await createReplyDraftFromEmailCommand({userId:1,emailId:sourceId,body,ccText:'wael@zooma.ae, mzakout@artecint.com'});if(!persistedDraft)save('draft-save-result',draft);
 const [ledger]=rows(await db.execute(sql`SELECT * FROM como_mailbox_draft_ledger WHERE user_id=1 AND work_file_id=390001 AND communication_id=${draft.id}`));const uid=Number(ledger?.draft_uid||0);assert(uid&&ledger.state==='draft_saved','draft_not_proven');
 const batch=fs.existsSync(root+'/post-save-drafts.json')?load('post-save-drafts'):await fetchReadonlyFolderSince('Drafts',24*365,100);
 const matches=batch.messages.filter(m=>canonicalSubject(m.subject)===target);assert(matches.length===1&&Number(matches[0].uid)===uid,'draft_not_unique');const observed=matches[0];
 assert(norm(observed.textBody)===norm(body)&&envelope(observed.to)==='tdimitrova@artecint.com'&&envelope(observed.cc)==='mzakout@artecint.com,wael@zooma.ae','draft_content_or_envelope_changed');
 assert(observed.headers?.['in-reply-to']===messageId&&String(observed.headers?.references||'').includes(messageId)&&observed.headers?.['x-como-draft-key']===`email-reply-draft:${sourceId}`,'draft_thread_changed');
 save('draft-live-proof',{communicationId:draft.id,uid,unique:true,headersVerified:true,observed:{...observed,attachments:[]},sent:false,checkedAt:new Date().toISOString()});
 const human=await createActionCommand({userId:1,workFileId:390001,title:'الفلل الأربع — عبد الرحمن: مراجعة رد استلام المسح وفاتورةMiddle East Survey',description:`رد استلام واحد محفوظ فيDrafts UID ${uid} إلىثيودوراCCوائل وماجد، ولم يُرسل. وصلت نتائجالمسح وعدم ممانعةأرتك؛ فاتورةMES-INV-2026-10-224 بقيمة1,260درهم شاملVAT إلىMiddle East Survey مباشرة، مطابقةلعرضوائل الموقع، ولا إثباتسداد. راجعالرد ووجّهكيفيةمعالجةالفاتورة منفصلًا؛ لاطلبصرفأوتحويلتلقائي. Manusيتابععروضالتربةوتوصيةأرتك في570005؛لا بدءتصميم أوRawan.`,acceptanceCriteria:'يراجع عبد الرحمن رد استلام المسح ويرسله منCOMO إنوافق، ويحدد كيفية معالجة فاتورةMiddle East Survey بصورة منفصلة. لا يعتبر استلام النتائج أو عدم ممانعةأرتك أو حفظDraftإثباتسداد أو تكليفًا جديدًا. يبقى فحصالتربة مستقلًا.',ownerType:'human',priority:'important',actorType:'manus',actorUserId:null,idempotencyKey:'survey:2310001:owner-review'});
 const originalOutcome=String(before.file[0].desired_outcome);
 const oldSentence='المسح والتربة والحمل الكهربائي باقيان مستقلين.';
 assert(originalOutcome.includes(oldSentence),'file_summary_changed');
 const nextOutcome=originalOutcome.replace(oldSentence,'وصلت نتائج المسح وتحديد حدود القطعة وعدم ممانعة أرتك26أكتوبر؛ فاتورةMiddle East Survey بقيمة1,260درهم غير مثبتة السداد وتحتاج توجيه معالجة منفصلًا. فحص التربة والحمل الكهربائي باقيان مستقلين.');
 await db.transaction(async tx=>{
  await tx.execute(sql`SELECT id FROM como_next_work_files WHERE id=390001 AND user_id=1 FOR UPDATE`);
  const [waiting]=rows(await tx.execute(sql`SELECT * FROM como_next_actions WHERE id=570005 AND user_id=1 AND work_file_id=390001 FOR UPDATE`));
  const prior=before.actions.find((a:any)=>Number(a.id)===570005);assert(waiting?.action_status==='waiting_external'&&waiting.description===prior.description,'soil_waiting_changed');
  await tx.execute(sql`UPDATE como_next_actions SET title='الفلل الأربع — بانتظار عروض فحص التربة وتوصية أرتك',description=${`وصلت نتائج المسح وتحديد حدود القطعة6180578 فيCOMO2310001 بتاريخ26أكتوبر مع عدم ممانعة أرتك؛ انتهى انتظار تسليم المسح ولا يعاد طلب توقيع العرض أو تحويله. بقيت عروض فحص التربة وتوصية أرتك فقط من نطاق570005. رد استلام المسح ومسار سؤال التربة محفوظ فيDrafts UID ${uid} لعبد الرحمن، لم يُرسل. Manusيتابع البند القائم، دون تكليف أو دفع أو موعد جديد. الفاتورة1,260درهم مستقلة، ولا تعديلpayment5586 أو انتظار1830001 لتوجّه وائل وRawan.`},acceptance_criteria='حفظ عروض فحص التربة وتوصية أرتك ومقارنة داخلية عند وصولها؛ لا تكليف أو دفع تلقائي. مسح26أكتوبر مستلم؛ لا إغلاق فحص التربة بوصول المسح ولا إعادة طلب العرض الموقع.',evidence_reference=${`COMO2310001/INBOX513؛ المستندات1800001–1800007؛ عرض موقع12أكتوبر/3360001 و3390001؛ Drafts UID ${uid}`} WHERE id=570005 AND user_id=1 AND work_file_id=390001 AND action_status='waiting_external'`);
  const [file]=rows(await tx.execute(sql`SELECT desired_outcome FROM como_next_work_files WHERE id=390001 AND user_id=1 FOR UPDATE`));assert(file.desired_outcome===originalOutcome,'file_changed_during_application');
  await tx.execute(sql`UPDATE como_next_work_files SET desired_outcome=${nextOutcome} WHERE id=390001 AND user_id=1`);
  await appendEvent(tx,{userId:1,projectId:6,workFileId:390001,actionId:570005,actorType:'manus',actorUserId:null,eventType:'survey_delivery_soil_followup_reconciled',summary:'الفلل الأربع — نتائج المسح وعدم ممانعة أرتك وصلت؛ أزيل انتظار المسح من570005 وبقيت عروض التربة وتوصية أرتك. فاتورة1,260درهم غير مثبتة السداد،رد واحدمحفوظ لعبدالرحمن.',payload:{directiveId,sourceEmailId:sourceId,bodySha256:sourceSha,communicationDraftId:draft.id,humanActionId:human.id,draftUid:uid,waitingActionId:570005,surveyReceived:true,soilReceived:false,invoiceReference:'MES-INV-2026-10-224',invoiceDocumentId:1800001,invoiceAmountAed:1260,paymentChanged:false,paymentRequestCreated:false,sent:false},idempotencyKey:'survey:2310001:soil-followup-reconciled'});
 });
 const summary=`الفلل الأربع — راجعManusرسالة2310001 وجميع مرفقاتها وخيطها. نتائج المسح وتحديد حدود القطعة وعدم ممانعةأرتك مستلمة،وفاتورةMiddle East Survey MES-INV-2026-10-224 بقيمة1,260درهم مطابقة للعرض الموقع،لا إثباتسداد. رد واحدDrafts UID ${uid}/مراسلة${draft.id}لعبدالرحمن وبطاقة${human.id}،لميرسل. انتظار570005 أصبح للتربةوتوصيةأرتك فقط؛السداد5586 وانتظاروائل1830001 وRawanلميتغيروا. حدود فحصCAD موثقة،ولا اعتماد هندسي مستقل.`;
 const workProductBody=fs.readFileSync(root+'/review-facts.md','utf8')+`\n\n## نتيجة الفحص المحلي لملفَيDWG\n${cad.narrative}\n\n## التطبيق والحالة التالية\n${summary}\n\nنص الرد المحفوظ:\n${body}\n\nعبد الرحمن: مراجعةالرد والإرسالمنCOMO،وتوجيه معالجة الفاتورة منفصلًا. Manus: متابعة عروض فحص التربة وتوصيةأرتك ضمن570005القائم،ثم فحصهاعندوصولها دونتكليف. لا إرسالأوطلبصرفأوإثباتدفعأوعدلتوقيتالنبضاتأوتوقفالمخططات. فُحصالمرفقانinline بصريًا وكلPDFوجميعالمرفقاتالموضوعية موثقون،معحدودCADالمبيّنةأعلاه.\n`;
 const documentIds=manifest.filter((m:any)=>m.documentId>=1800001).map((m:any)=>Number(m.documentId));
 const completed:any=await completeDispatchedMailReview({directiveId,bodySha256:sourceSha,reviewedDocumentIds:documentIds,summary,workProductBody,communicationDraftId:draft.id,responseHandling:{kind:'draft_saved',evidence:`رد استلام واحدDrafts UID ${uid}/مراسلة${draft.id}فُحص حيًا بالنص والخيط والمستلمثيودوراCCوائل وماجد ومفتاحemail-reply-draft:2310001؛Sent/Draftsقبلالحفظ خاليانمنردمماثل؛لميرسل.`,nextStep:`عبد الرحمن يراجعالرد فيبطاقة${human.id} ويحددمعالجةالفاتورة منفصلًا؛Manusيتابععروضالتربة وتوصيةأرتك في570005القائم.لا إغلاق5586 أو انتظار1830001 لوائل،لا بدءRawan أو دفع أو تكليف أو موعد جديد.`}});
 const wp=Number(completed.workProductId);assert(wp,'receipt_missing');
 await db.transaction(async tx=>{
  await tx.execute(sql`UPDATE como_manus_dispatches SET next_action_id=${human.id} WHERE directive_id=1140001 AND state='completed' AND work_product_id=${wp}`);
  for(const m of manifest)await tx.execute(sql`INSERT IGNORE INTO como_next_work_memory_documents(project_id,work_file_id,memory_id,document_id,relation_type,source_system,source_record_id) VALUES(6,390001,${wp},${m.documentId},'source','como_mail_execution',${`1140001:document:${m.documentId}`})`);
 });
 const after=await snapshot();save('protected-after',after);
 assert.deepEqual(after.lanes,before.lanes,'payment_or_lifecycle_lanes_changed');assert.deepEqual(after.pending,before.pending,'pending_changed');
 assert.deepEqual(after.actions.filter((a:any)=>![actionId,570005,human.id].includes(Number(a.id))),before.actions.filter((a:any)=>![actionId,570005].includes(Number(a.id))),'unrelated_actions_changed');
 assert.deepEqual(after.communications.filter((a:any)=>Number(a.id)!==draft.id),before.communications,'unrelated_communications_changed');
 assert.deepEqual(after.ledger.filter((a:any)=>Number(a.communication_id)!==draft.id),before.ledger,'unrelated_ledger_changed');
 const otherFileFields=(v:any)=>{const {desired_outcome,updated_at,...other}=v;return other};assert.deepEqual(otherFileFields(after.file[0]),otherFileFields(before.file[0]),'unrelated_file_fields_changed');assert(after.file[0].desired_outcome===nextOutcome,'file_update_missing');
 const sara:any=await readExecutiveWorkFile({memberId:'abdulrahman',nameAr:'عبد الرحمن',role:'owner'},JSON.stringify({work_file_id:390001,focus:'overview',question:'تسليم المسح2310001 وعدم ممانعةأرتك وفاتورةMiddle East Survey ورد الاستلام والتربة570005'}));assert(sara.found===true&&JSON.stringify(sara).includes(String(wp))&&JSON.stringify(sara).includes(`Drafts UID ${uid}`),'sara_receipt_missing');save('sara-state',sara);
 save('receipt',{completed,workProductId:wp,sourceEmailId:sourceId,sourceSha,communicationDraftId:draft.id,mailboxDraftRef:`Drafts UID ${uid}`,humanActionId:human.id,waitingActionId:570005,reviewedDocumentIds:documentIds,linkedDocumentIds:manifest.map((m:any)=>m.documentId),invoiceAmountAed:1260,invoiceReference:'MES-INV-2026-10-224',surveyReceived:true,soilReceived:false,sent:false,paymentChanged:false,paymentRequestCreated:false,protectedRecordsUnchanged:true,saraFound:sara.found,checkedAt:new Date().toISOString()});
 console.log(JSON.stringify({completed:true,workProductId:wp,mailboxDraftRef:`Drafts UID ${uid}`,humanActionId:human.id,waitingActionId:570005,sent:false,paymentChanged:false,saraFound:sara.found},null,2));
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1)});
