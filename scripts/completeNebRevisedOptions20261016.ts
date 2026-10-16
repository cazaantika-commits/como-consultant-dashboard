import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {sql} from 'drizzle-orm';
import {getDb} from '../server/db';
import {fetchEmailByUID,fetchReadonlyFolderSince,getConfiguredMailboxAddress} from '../server/emailMonitor';
import {appendEvent,createActionCommand,changeActionStatusCommand,requireProjectAccess} from '../server/services/comoNextCommands';
import {createReplyDraftFromEmailCommand} from '../server/services/comoNextEmailInbox';
import {completeDispatchedMailReview,readDispatchForDirective,recordManusDispatchProgress} from '../server/services/comoManusDispatch';
import {readExecutiveWorkFile} from '../server/services/saraWorkFileReader';
const root='/home/ubuntu/reports/como-directive-780001-2026-10-16';
const rows=(r:any):any[]=>Array.isArray(r)&&Array.isArray(r[0])?r[0]:r;
const norm=(s:any)=>String(s||'').replace(/\r\n?/g,'\n').trim();
const sha=(s:any)=>createHash('sha256').update(norm(s)).digest('hex');
const bytesSha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
const envelope=(s:any)=>[...new Set(String(s||'').toLowerCase().match(/[a-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}/g)||[])].sort().join(',');
const thread=(m:any)=>m.subject.replace(/^(?:\s*(?:re|fw|fwd)\s*:\s*)+/ig,'').trim().toLowerCase()==='majan shopping centre — request for lead consultant proposal';
const header=(m:any,k:string)=>{const v=m.headers?.[k];return Array.isArray(v)?v.join(' '):String(v||'');};
async function main(){
 const dispatch=await readDispatchForDirective({directiveId:780001});
 if(dispatch?.state==='completed'){console.log(JSON.stringify({replayed:true,dispatch}));return;}
 if(dispatch?.state!=='running')throw Error('dispatch_not_claimed');
 const db=await getDb();if(!db)throw Error('database_unavailable');await requireProjectAccess(db,1,1,'write');
 if(getConfiguredMailboxAddress()!=='a.zaqout@comodevelopments.com')throw Error('COMO_only');
 const [d]=rows(await db.execute(sql`SELECT * FROM como_next_staged_directives WHERE id=780001 AND user_id=1 AND work_file_id=480001 AND status='submitting' AND source_member_id='system:manus-action'`));
 if(!d||Number(d.action_id)!==1770001)throw Error('directive_scope_changed');
 const [source]=rows(await db.execute(sql`SELECT * FROM como_next_email_messages WHERE id=1800001 AND user_id=1 AND linked_work_file_id=480001 AND inbox_status='linked'`));
 const live=JSON.parse(fs.readFileSync(`${root}/live-source.json`,'utf8'));
 if(!source||source.body_sha256!=='4010b560dc0ff454edafc23ce2d5dbb2fd445c288bc139aa81dbea1c097ff7f0'||sha(live.textBody)!==source.body_sha256||live.messageId!==source.message_id||live.from.toLowerCase()!=='rex@neb.ae'||envelope(live.to)!==envelope(source.to_text)||envelope(live.cc)!==envelope(source.cc_text))throw Error('source_identity_changed');
 const attachments=rows(await db.execute(sql`SELECT * FROM como_next_email_attachments WHERE email_message_id=1800001 ORDER BY ordinal`));
 const localNames:Record<number,string>={1410001:'image001.jpg',1410002:'image002.png',1410003:'NEB_Alternative_Rev1.pdf',1410004:'NEB_Compliant_Rev1.pdf'};
 if(attachments.length!==4||live.attachments.length!==4)throw Error('attachment_count_changed');
 for(const a of attachments){
  const local=localNames[Number(a.id)],remote=live.attachments.find((x:any)=>x.filename===a.file_name);
  if(!local||!remote||bytesSha(Buffer.from(remote.content.data))!==a.sha256||bytesSha(fs.readFileSync(`${root}/attachments/${local}`))!==a.sha256||Number(a.byte_size)!==remote.content.data.length||a.storage_status!=='stored')throw Error('attachment_proof_changed');
 }
 if(attachments.find(a=>a.id===1410003)?.document_id!==1620001||attachments.find(a=>a.id===1410004)?.document_id!==1620002)throw Error('document_refs_changed');
 const report=fs.readFileSync(`${root}/NEB_Revised_Options_Review_AR.md`,'utf8').trim();
 const body=fs.readFileSync(`${root}/NEB_Revised_Options_Acknowledgement_EN.md`,'utf8').trim();
 const arithmetic=JSON.parse(fs.readFileSync(`${root}/fee-arithmetic.json`,'utf8'));
 if(arithmetic.compliantDesign!=='7910000'||arithmetic.alternativeDesign!=='8892000'||arithmetic.designDifference!=='982000'||!report.includes('1800001'))throw Error('report_or_arithmetic_incomplete');
 for(const [name,count] of [['NEB_Compliant_Rev1',13],['NEB_Alternative_Rev1',12]] as const){const t=fs.readFileSync(`${root}/${name}.txt`,'utf8');if((t.match(/=== PDF PAGE /g)||[]).length!==count||t.length<10000)throw Error('all_pages_not_reviewed');}
 const originalOtherActionIds=new Set(rows(await db.execute(sql`SELECT id FROM como_next_actions WHERE user_id=1 AND work_file_id=480001 AND id NOT IN (1500001,1770001,1770002)`)).map(a=>Number(a.id)));
 const protectedSnapshot=async()=>({payments:rows(await db.execute(sql`SELECT * FROM como_next_lifecycle_lanes WHERE user_id=1 AND kind='payment' ORDER BY id`)),pending:rows(await db.execute(sql`SELECT * FROM como_next_staged_directives WHERE user_id=1 AND status='pending' ORDER BY id`)),cancelledFiles:rows(await db.execute(sql`SELECT * FROM como_next_work_files WHERE user_id=1 AND work_file_status IN ('closed','cancelled') ORDER BY id`)),scenarios:rows(await db.execute(sql`SELECT * FROM cf_scenarios ORDER BY id`)),otherActions:rows(await db.execute(sql`SELECT * FROM como_next_actions WHERE user_id=1 AND work_file_id=480001 AND id NOT IN (1500001,1770001,1770002) ORDER BY id`)).filter(a=>originalOtherActionIds.has(Number(a.id)))});
 const before=await protectedSnapshot();if(!fs.existsSync(`${root}/protected-before.json`))fs.writeFileSync(`${root}/protected-before.json`,JSON.stringify(before,null,2)+'\n');
 await recordManusDispatchProgress({directiveId:780001,summary:'ماجان — فُحص عرضاNEB المعدلان كاملًا:13و12صفحة مع تطابق البصمات. أتعابالتصميم7.910و8.892مليون قبلVAT،فرق982ألف؛ أُدرجالنقلالرأسي والكمياتلكن قيودDDوCFDوفريقالمفهومباقية. الآن إغلاقانتظارالوصول وحفظمسودةشكر،دونgreenlight.'});
 const [sent,drafts]=await Promise.all([fetchReadonlyFolderSince('Sent',24,80),fetchReadonlyFolderSince('Drafts',120,80)]);
 if(sent.messages.some(m=>thread(m)&&new Date(m.date).getTime()>new Date(live.date).getTime()))throw Error('already_replied_after_source_requires_review');
 if(drafts.messages.some(m=>thread(m)&&sha(m.textBody)!==sha(body)))throw Error('existing_different_thread_draft');
 const draft=await createReplyDraftFromEmailCommand({userId:1,emailId:1800001,body,ccText:source.cc_text});
 const [communication]=rows(await db.execute(sql`SELECT * FROM como_next_communications WHERE id=${draft.id} AND user_id=1 AND work_file_id=480001`));
 const [ledger]=rows(await db.execute(sql`SELECT * FROM como_mailbox_draft_ledger WHERE communication_id=${draft.id} AND user_id=1 AND work_file_id=480001`));
 if(!communication||!ledger||communication.communication_status!=='archived'||ledger.state!=='draft_saved')throw Error('draft_not_saved');
 const liveDraft=await fetchEmailByUID(Number(ledger.draft_uid),undefined,'Drafts');
 const post=await fetchReadonlyFolderSince('Drafts',24,80);const full=post.messages.find(m=>m.uid===Number(ledger.draft_uid));
 if(!liveDraft||!full||sha(liveDraft.textBody)!==sha(body)||sha(liveDraft.textBody)!==ledger.body_sha256||liveDraft.messageId!==ledger.message_id||liveDraft.subject!==source.subject||envelope(liveDraft.to)!==envelope(source.from_email)||envelope(liveDraft.cc)!==envelope(source.cc_text)||header(full,'in-reply-to')!==source.message_id||!header(full,'references').includes(source.message_id)||header(full,'x-como-draft-key')!=='email-reply-draft:1800001'||post.messages.filter(m=>thread(m)&&sha(m.textBody)===sha(body)).length!==1)throw Error('draft_live_verification_failed');
 fs.writeFileSync(`${root}/reply-live-draft.json`,JSON.stringify(full,null,2)+'\n');
 const review=await createActionCommand({userId:1,workFileId:480001,title:'ماجان — مراجعة عرضي NEB المعدّلين ومسودة تأكيد الاستلام',description:`وصل خيار الكونسبت المنفصل7,910,000درهم والتصميم الكامل8,892,000درهم قبلVAT؛فرق982,000. المراجعة المصدرية محفوظة: تحسن التنسيق وإدراجالنقلالرأسي، مع تحفظCFDوقيودالكمياتوفريقالمفهوم. مسودةشكرRex فيDrafts UID${ledger.draft_uid}،لمتُرسل. عبد الرحمن يراجعالمقارنةوالرد؛لاطلبقراربدءأوتوقيعالآن.`,acceptanceCriteria:'مراجعة عبد الرحمن لملخص النطاق والأتعاب والمسودة، وإرسالها أو تعديلها/إلغائها من COMO. لا يُعتبر الاستلام أو الشكر قبولًا للعرض أو إذن بدء، وأي استفسارات جديدة أو قرار اختيار يحدد بعد المراجعة.',ownerType:'human',priority:'important',dueAt:null,followUpAt:null,idempotencyKey:'neb-revised-options-review:1800001',actorType:'manus',actorUserId:null});
 for(const id of [1500001,1770002]){
  const [a]=rows(await db.execute(sql`SELECT * FROM como_next_actions WHERE id=${id} AND user_id=1 AND work_file_id=480001`));
  if(id===1770002&&(a?.source_system!=='finance_invoice_review'||a?.source_record_id!=='source-email-1800001'))throw Error('financial_review_scope_changed');
  if(['open','waiting_external','in_progress'].includes(a?.action_status))await changeActionStatusCommand({userId:1,actionId:id,nextStatus:'completed_pending_verification',actorType:'manus',actorUserId:null});
  const [current]=rows(await db.execute(sql`SELECT action_status FROM como_next_actions WHERE id=${id}`));
  if(current?.action_status==='completed_pending_verification')await changeActionStatusCommand({userId:1,actionId:id,nextStatus:'verified',evidenceReference:id===1500001?'COMO1800001/INBOX502؛وصلوفُحصخياراNEBالمعدلان15أكتوبر،مستندا1620001و1620002. إغلاقانتظارالوصول فقط،لا قبول':'COMO1800001ومستندا1620001و1620002؛عرضااستشاراتبأتعابتصميم،لا فاتورةأوإيصالسدادأوطلبصرف.',actorType:'manus',actorUserId:null});
 }
 const summary=`ماجان — وصل عرضاNEB المعدلان وفُحصا كاملًا؛التصميم7,910,000درهم مع كونسبتمنفصل و8,892,000للتصميمالكامل،قبلVAT،فرق982,000. أُغلقانتظارالوصول1500001. مسودةشكر${ledger.draft_uid}لعبدالرحمن عبر${review.id}،لمتُرسل ولاgreenlight. قيودCFDوالكمياتوفريقالمفهومموثقة؛السدادوالحزمةالملغاةلميتغيرا.`;
 await db.transaction(async tx=>{
  const [file]=rows(await tx.execute(sql`SELECT work_file_status FROM como_next_work_files WHERE id=480001 AND user_id=1 FOR UPDATE`));if(!file||['closed','cancelled'].includes(file.work_file_status))throw Error('file_closed_during_review');
  await tx.execute(sql`UPDATE como_next_work_files SET title='ماجان — NEB: العرضان المعدّلان قيد مراجعة عبد الرحمن',desired_outcome=${summary},work_file_status='open',updated_at=UTC_TIMESTAMP() WHERE id=480001 AND user_id=1`);
  await tx.execute(sql`UPDATE como_next_lifecycle_lanes SET next_action_id=${review.id},next_action_title='عبد الرحمن يراجع الخيارين ومسودة تأكيد الاستلام',next_owner_type='human',attention_at=NULL WHERE id=90001 AND work_file_id=480001 AND status='received'`);
  await tx.execute(sql`UPDATE como_next_lifecycle_lanes SET status='received',source_kind='reviewed_email',evidence_reference='COMO1800001/INBOX502؛مستندا1620001و1620002؛بصماتوطبعات15أكتوبرمتطابقة',source_text='وصلخيارانمعدلان13و12صفحةمعالردودالمكتوبة. فحصالنطاقوالأتعابمكتمل؛ليسا موافقةتعيينأوأمربدء. القيودباقيةفيالمراجعة.',recorded_at=UTC_TIMESTAMP(),next_action_id=${review.id},next_action_title='عبد الرحمن يراجع العرضين والرد المختصر',next_owner_type='human',attention_at=NULL WHERE id=120001 AND user_id=1 AND work_file_id=480001 AND kind='deliverable'`);
  await tx.execute(sql`UPDATE como_next_lifecycle_lanes SET evidence_reference='COMO1800001/INBOX502بعدالصادر1530001/Sent220',source_text='وصلتإجاباتوخيارانمعدلان،لا تأكيداستلامفقط. قيودCFDوالكمياتوفريقالمفهومموثقةللمراجعة،دونطلباستفساراتجديدمرسل.',recorded_at=UTC_TIMESTAMP(),next_action_id=${review.id},next_action_title='مراجعة عبد الرحمن للخيارين ومسودة الشكر',next_owner_type='human',attention_at=NULL WHERE id=120002 AND user_id=1 AND work_file_id=480001 AND kind='external_response' AND status='response_received'`);
  await appendEvent(tx,{userId:1,projectId:1,workFileId:480001,actionId:review.id,actorType:'manus',actorUserId:null,eventType:'neb_revised_options_reviewed',summary,payload:{directiveId:780001,sourceEmailId:1800001,reviewedDocumentIds:'1620001,1620002',compliantDesignFee:7910000,alternativeDesignFee:8892000,designDifference:982000,feesExcludeVat:true,waitingActionClosed:1500001,reviewActionId:review.id,communicationDraftId:draft.id,draftUid:Number(ledger.draft_uid),sent:false,greenLight:false,externalSideEffect:false},idempotencyKey:'neb-revised-options-reviewed:780001'});
 });
 const work=report+`\n\n## إيصال التنفيذ داخل COMO\nالتوجيه780001/صندوق570001،المراسلة${draft.id}وDrafts UID${ledger.draft_uid}. تحقق حي كامل للنص والمستلمين والرؤوس وتفرد المسودة؛ToRex وCCحسام،وائل،محمدناجي،جميل،كوثر،آن حسبالخيط. الانتظار1500001ومراجعةتصنيفالعرض1770002انتهيافقط،ومراجعةعبدالرحمن${review.id}قائمة. لاانتظارخارجيجديدلأنالردمسودةغيرمرسلة.\n`;
 const result=await completeDispatchedMailReview({directiveId:780001,bodySha256:source.body_sha256,reviewedDocumentIds:[1020001,1260001,1620001,1620002],summary,workProductBody:work,communicationDraftId:draft.id,responseHandling:{kind:'draft_saved',evidence:`مسودةاستلاممهنية${draft.id}/Drafts UID${ledger.draft_uid}موثقةحيًا بالنص والمستلمينورؤوسالرد على1800001،بعدفحصالصادروالمسودات. لا إذنبدءأوطلبصرف.`,nextStep:`عبد الرحمن يراجع المقارنة ومسودةالشكر عبر${review.id}،ثميحددمايريدتوضيحه. وصلالعرضالمعدل وانتهىانتظار1500001؛لاانتظارخارجيجديدأوموعدمخترع.`}});
 const after=await protectedSnapshot();if(JSON.stringify(before)!==JSON.stringify(after))throw Error('protected_records_changed');
 const sara=await readExecutiveWorkFile({memberId:'abdulrahman',nameAr:'عبد الرحمن',role:'owner'},JSON.stringify({work_file_id:480001,focus:'overview'}));
 const actions=rows(await db.execute(sql`SELECT id,title,action_status FROM como_next_actions WHERE user_id=1 AND work_file_id=480001 ORDER BY id`));
 if(![1500001,1770001,1770002].every(id=>actions.find(a=>Number(a.id)===id)?.action_status==='verified')||!(sara as any)?.found)throw Error('completion_or_sara_verification_failed');
 fs.writeFileSync(`${root}/review-receipt.json`,JSON.stringify({result,communicationDraftId:draft.id,draftUid:Number(ledger.draft_uid),reviewActionId:review.id,waitingClosed:1500001,protectedRecordsUnchanged:true,saraFound:true,sent:false,smtpUsed:false,greenLight:false,checkedAt:new Date().toISOString()},null,2)+'\n');
 fs.writeFileSync(`${root}/sara-after.json`,JSON.stringify(sara,null,2)+'\n');fs.writeFileSync(`${root}/actions-after.json`,JSON.stringify(actions,null,2)+'\n');
 console.log(JSON.stringify({result,draftUid:Number(ledger.draft_uid),communicationDraftId:draft.id,reviewActionId:review.id,protectedRecordsUnchanged:true,saraFound:true,sent:false}));
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1)});
