import fs from 'node:fs';
import {sql} from 'drizzle-orm';
import {getDb} from '../server/db';
import {appendEvent,requireProjectAccess,createCommunicationDraftCommand,createActionCommand,changeActionStatusCommand} from '../server/services/comoNextCommands';
import {saveComoMailboxDraft,fetchEmailByUID} from '../server/emailMonitor';
import {completeDispatchedMailReview,readDispatchForDirective} from '../server/services/comoManusDispatch';
import {confirmSentLineageObservation} from '../server/services/comoMailboxDraftLedger';
import {readExecutiveWorkFile} from '../server/services/saraWorkFileReader';
const root='/home/ubuntu/reports/artec-documents-review-2026-10-13';
const key='artec-documents-received:1350001';
const rows=(v:any)=>v[0] as any[];
const body=`Dear Theodora,

Thank you for sending the documents. We confirm receipt of all four attachments, with Shahid and Nasrin copied for the finance team's review.

Kind regards,
Abdalrahman Zaqout
Development Director
COMO Real Estate Development L.L.C
M: +971 55 106 2668
E: a.zaqout@comodevelopments.com`;
async function main(){
 const db=await getDb();if(!db)throw Error('database_unavailable');await requireProjectAccess(db,6,1,'write');
 const dispatch=await readDispatchForDirective({directiveId:360001});if(dispatch?.state==='completed'){console.log(JSON.stringify({replayed:false,alreadyCompleted:true,dispatch}));return;}
 if(dispatch?.state!=='running')throw Error('not_claimed');
 const [email]=rows(await db.execute(sql`SELECT * FROM como_next_email_messages WHERE id=1350001 AND user_id=1 AND linked_work_file_id=390001`));
 if(email?.body_sha256!=='337ad7ed79a62fef0866c24556fb009f5aff185ffeadcd95d0cad7a6683d9392')throw Error('source_changed');
 const [sent]=rows(await db.execute(sql`SELECT * FROM como_next_email_messages WHERE id=1290001 AND user_id=1 AND folder_name='Sent' AND imap_uid=216`));
 const [old]=rows(await db.execute(sql`SELECT * FROM como_next_communications WHERE id=1920001 AND work_file_id=390001 AND user_id=1`));
 const norm=(s:string)=>String(s||'').replace(/\r\n?/g,'\n').trim();
 if(!sent||norm(old.body)!==norm(sent.body_text)||old.to_text!==sent.to_text||old.cc_text!==sent.cc_text)throw Error('sent_draft_match_failed');
 const [ledger]=rows(await db.execute(sql`SELECT * FROM como_mailbox_draft_ledger WHERE id=240001 AND communication_id=1920001 AND body_sha256=${sent.body_sha256}`));if(!ledger)throw Error('old_draft_lineage_mismatch');
 // Record observed owner send only; no email network side effect.
 await confirmSentLineageObservation({ledgerId:240001,folder:'Sent',uid:216});
 await db.transaction(async tx=>{
  await tx.execute(sql`SELECT id FROM como_next_work_files WHERE id=390001 FOR UPDATE`);
  await tx.execute(sql`UPDATE como_next_communications SET communication_status='sent',sent_at=${new Date(sent.received_at).toISOString().slice(0,19).replace('T',' ')},external_message_ref='Sent UID 216',evidence_reference='COMO Sent1290001/UID216؛ نص ومستلمو المسودة946 مطابقون',review_note='رُصد إرسال المالك، ثم استلام وثائق أرتك1350001؛ لا إعادة طلب.' WHERE id=1920001 AND communication_status='archived'`);
  await tx.execute(sql`UPDATE como_next_lifecycle_lanes SET status='received',source_kind='reviewed_email_attachments',evidence_reference='COMO1350001/INBOX492؛ مستندات1290001/1290002/1290003/1290004 فُحصت؛ الماليةCC',source_text='وصلت الوثائق الأربع وفُحصت محتوياتها. الرخصة والهوية ساريتان بتاريخ13أكتوبر، الضريبة والبيانات البنكية تطابق الفاتورة5586. شاهد ونسرين يستلمان المرفقات أصلًا، فلا تحويل مكرر. استلام الوثائق ليس سدادًا.',next_action_id=NULL,next_action_title=NULL,next_owner_type=NULL,due_at=NULL,attention_at=NULL,recorded_at=UTC_TIMESTAMP() WHERE id=60001 AND user_id=1 AND work_file_id=390001 AND kind='deliverable'`);
  await tx.execute(sql`UPDATE como_next_actions SET description=CONCAT(COALESCE(description,''),'\n13أكتوبر: وثائق أرتك الأربع وصلت10:23دبي لشاهد ونسرين وفُحصت؛ لا مستند ناقص من القائمة. متابعة التنفيذ المالي16أكتوبر باقية؛ لا تحويل وثائق أو طلب صرف مكرر، ولا دليل سداد.') WHERE id=840001 AND work_file_id=390001 AND action_status NOT IN('verified','cancelled') AND description NOT LIKE '%13أكتوبر: وثائق أرتك الأربع%'`);
  await tx.execute(sql`UPDATE como_next_lifecycle_lanes SET source_text=CONCAT(COALESCE(source_text,''),'\n13أكتوبر: وثائق الصرف الأربع مستلمة ومراجعة في COMO1350001 وبنسخة المالية. لا دليل سداد؛ انتظار تنفيذ المالية مستقل.'),evidence_reference=CONCAT(COALESCE(evidence_reference,''),'؛ مراجعة360001/COMO1350001') WHERE id=30001 AND kind='payment' AND status='waiting_external' AND source_text NOT LIKE '%13أكتوبر: وثائق الصرف الأربع%'`);
  await tx.execute(sql`UPDATE como_next_intake_proposals SET review_status='dismissed',review_note='شاهد ونسرين ضمن مستلمي1350001 والمرفقات بالفعل؛ لا تحويل وثائق مكرر. الاستلام والمراجعة موثقان بالتوجيه360001.',reviewed_at=UTC_TIMESTAMP() WHERE id IN(1920001,1920002) AND source_email_id=1350001 AND review_status='pending'`);
  await appendEvent(tx,{userId:1,projectId:6,workFileId:390001,actorType:'manus',actorUserId:null,eventType:'artec_payment_documents_received_reviewed',summary:'الفلل الأربعة — وثائق أرتك الأربع مستلمة ومراجعة وبنسخة شاهد ونسرين؛ انتهى انتظارها، والسداد غير مثبت.',payload:{directiveId:360001,sourceEmailId:1350001,documents:[1290001,1290002,1290003,1290004],observedSentEmailId:1290001,completeDocumentSet:true,financeAlreadyCopied:true,paymentStatusUnchanged:true},idempotencyKey:key+':reviewed'});
 });
 const [reviewAction]=rows(await db.execute(sql`SELECT action_status FROM como_next_actions WHERE id=1110001 AND work_file_id=390001`));
 if(reviewAction&& !['verified','cancelled'].includes(reviewAction.action_status)){
  if(reviewAction.action_status!=='completed_pending_verification')await changeActionStatusCommand({userId:1,actionId:1110001,nextStatus:'completed_pending_verification',actorType:'manus',actorUserId:null});
  await changeActionStatusCommand({userId:1,actionId:1110001,nextStatus:'verified',evidenceReference:'فُحصت مستندات COMO1290001/1290002/1290003/1290004 من رسالة1350001، ومطابقتها بالفاتورة5586؛ قائمة كاملة، لا سداد.',actorType:'manus',actorUserId:null});
 }
 // Create the record without saving a mailbox message through the default CC policy.
 const comm=await createCommunicationDraftCommand({userId:1,workFileId:390001,channel:'internal',subject:email.subject,body,toText:'tdimitrova@artecint.com',ccText:'shahid@zooma.ae, account.mrt@zooma.ae',idempotencyKey:key+':ack-draft'});
 const mailbox=await saveComoMailboxDraft({to:'tdimitrova@artecint.com',cc:'shahid@zooma.ae, account.mrt@zooma.ae',subject:email.subject,body,inReplyTo:email.message_id,draftKey:key+':ack-draft',ownerWaelCcExclusion:{evidenceReference:'توجيه المالك12أكتوبر21:36دبي/تحديث1350001: دون وائل لخيط وثائق صرف أرتك'},lineage:{userId:1,projectId:6,workFileId:390001,communicationId:comm.id}});
 if(!mailbox.uid||mailbox.observedInSent)throw Error('ack_draft_not_ready');
 const live=await fetchEmailByUID(mailbox.uid,undefined,'Drafts');if(!live||live.cc.includes('wael@zooma.ae')||!live.cc.includes('shahid@zooma.ae')||!live.cc.includes('account.mrt@zooma.ae')||norm(live.textBody)!==norm(body))throw Error('ack_draft_verification_failed');
 const ref=`${mailbox.folder} UID ${mailbox.uid}`;
 await db.execute(sql`UPDATE como_next_communications SET channel='email',direction='outbound',communication_status='archived',approval_status='not_required',external_message_ref=${ref},evidence_reference=${ref},review_note='شكر استلام فقط، شاهد ونسرينCC، دون وائل بالاستثناء الصريح. لا دفع أو طلب صرف أو إعادة مرفقات.' WHERE id=${comm.id} AND communication_status IN('draft','archived')`);
 const action=await createActionCommand({userId:1,workFileId:390001,title:'الفلل الأربعة — مراجعة مسودة شكر أرتك على الوثائق',description:`وثائق الصرف الأربع وصلت للمالية وفُحصت. مسودة شكر فقط ${ref}، إلى ثيودورا ونسخة شاهد ونسرين دون وائل. ليست طلب صرف أو إعادة إرسال الوثائق؛ حالة الدفع مستقلة.`,acceptanceCriteria:'يراجع المالك مسودة الشكر ويرسلها إن أراد؛ حفظها ليس إرسالًا ولا يبدأ انتظارًا جديدًا.',ownerType:'human',priority:'normal',actorType:'manus',actorUserId:null,idempotencyKey:key+':ack-review'});
 const report=fs.readFileSync(`${root}/Artec_Documents_Review_AR.md`,'utf8');
 const summary=`الفلل الأربعة/6180578 — وثائق أرتك الأربع وصلت10:23دبي وفُحصت: الرخصة والهوية ساريتان، الضريبة وخطاب البنك يطابقان الفاتورة5586. شاهد ونسرين ضمن مستلمي المرفقات، فلا تحويل مكرر. انتهى انتظار الوثائق ومراجعتها؛ السداد غير مثبت ومتابعة المالية16أكتوبر باقية. مسودة شكر ${ref} فقط، دون وائل.`;
 const result=await completeDispatchedMailReview({directiveId:360001,bodySha256:email.body_sha256,reviewedDocumentIds:[1290001,1290002,1290003,1290004],summary,workProductBody:report+`\n\nإيصال التنفيذ: مسودة الشكر ${ref} / المراسلة${comm.id}، مراجعة المالك${action.id}. أُغلقت مراجعة1110001؛ الإجراء1020001المتجاوز كان ملغى ولم يُعد فتحه.`,communicationDraftId:comm.id});
 await db.execute(sql`UPDATE como_manus_dispatches SET next_action_id=${action.id} WHERE directive_id=360001 AND state='completed'`);
 const sara=await readExecutiveWorkFile({memberId:'abdulrahman',nameAr:'عبد الرحمن',role:'owner'},JSON.stringify({work_file_id:390001,focus:'overview'}));
 const final={result,mailboxDraftRef:ref,communicationId:comm.id,nextActionId:action.id,documentsReceived:true,financeAlreadyCopied:true,paymentNotConfirmed:true,sent:false};fs.writeFileSync(`${root}/completed.json`,JSON.stringify(final,null,2));fs.writeFileSync(`${root}/sara-state.json`,JSON.stringify(sara,null,2));fs.writeFileSync(`${root}/Acknowledgement_Draft_EN.md`,`# Four Villas — Artec Documents Acknowledgement\n\n${body}\n\n---\nTo: tdimitrova@artecint.com\nCC: shahid@zooma.ae, account.mrt@zooma.ae\nSaved: ${ref}. Not sent.\n`);console.log(JSON.stringify(final,null,2));
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1)});
