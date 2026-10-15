import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {sql} from 'drizzle-orm';
import {getDb} from '../server/db';
import {fetchEmailByUID,fetchReadonlyFolderSince,getConfiguredMailboxAddress} from '../server/emailMonitor';
import {createReplyDraftFromEmailCommand} from '../server/services/comoNextEmailInbox';
import {appendEvent,createActionCommand,requireProjectAccess} from '../server/services/comoNextCommands';
import {completeDispatchedMailReview,readDispatchForDirective,recordManusDispatchProgress} from '../server/services/comoManusDispatch';
import {readExecutiveWorkFile} from '../server/services/saraWorkFileReader';
const root='/home/ubuntu/reports/como-directive-690001-2026-10-15';
const rows=(v:any)=>v[0] as any[];
const norm=(v:any)=>String(v||'').replace(/\r\n?/g,'\n').trim();
const sha=(v:string|Buffer)=>createHash('sha256').update(v).digest('hex');
const sameSubject=(a:string,b:string)=>a.replace(/^\s*(?:(?:re|fw|fwd)\s*:\s*)+/i,'').trim().toLowerCase()===b.replace(/^\s*(?:(?:re|fw|fwd)\s*:\s*)+/i,'').trim().toLowerCase();
const envelope=(v:any)=>[...new Set(String(v||'').toLowerCase().match(/[a-z0-9.!#$%&'*+\/?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}/g)||[])].sort().join(',');
const body=`Dear Tedi,

Thank you for sending the revised concept plans. We confirm receipt of all eight files for the four villas on Plot 6180578.

We are reviewing the layouts against the points discussed at our kick-off meeting. To support this review, could you please:

1. Identify the proposed dumbwaiter and its serving levels on the drawings, and confirm the gas-cooking provision for the basement kitchen.
2. Provide a consolidated area schedule for all four villas, showing GFA and total built-up area separately, together with the permitted and remaining GFA.

We will revert with our consolidated design comments before the concept is finalised or any submission is made to the authorities.

Thank you for your work on the revisions.

Kind regards,
Abdalrahman Zaqout
Development Director
COMO Real Estate Development L.L.C
M: +971 55 106 2668
E: a.zaqout@comodevelopments.com`;
async function main(){
 const dispatch=await readDispatchForDirective({directiveId:690001});
 if(dispatch?.state==='completed'){console.log(JSON.stringify({alreadyCompleted:true,dispatch},null,2));return;}
 if(dispatch?.state!=='running')throw Error('dispatch_not_claimed');
 const db=await getDb();if(!db)throw Error('database_unavailable');await requireProjectAccess(db,6,1,'write');
 if(getConfiguredMailboxAddress()!=='a.zaqout@comodevelopments.com')throw Error('como_mailbox_only');
 const [directive]=rows(await db.execute(sql`SELECT * FROM como_next_staged_directives WHERE id=690001 AND user_id=1 AND work_file_id=390001 AND action_id=1650001 AND source_member_id='system:manus-action' AND status='submitting'`));
 const [source]=rows(await db.execute(sql`SELECT * FROM como_next_email_messages WHERE id=1710001 AND user_id=1 AND linked_work_file_id=390001 AND inbox_status='linked'`));
 if(!directive||source?.body_sha256!=='6eaf221a45b3d70d851ddf05181610ef5cd76a6c6933ea3958bdef331259db90')throw Error('scope_or_source_changed');
 const proof=JSON.parse(fs.readFileSync(`${root}/live-mail-proof.json`,'utf8'));
 const manifest=JSON.parse(fs.readFileSync(`${root}/attachment-manifest.json`,'utf8'));
 const attachments=rows(await db.execute(sql`SELECT * FROM como_next_email_attachments WHERE email_message_id=1710001 ORDER BY ordinal`));
 if(attachments.length!==8||manifest.length!==8||proof.source.messageId!==source.message_id||sha(norm(proof.source.textBody))!==source.body_sha256)throw Error('proof_incomplete');
 for(const a of attachments){
  const m=manifest.find((v:any)=>Number(v.id)===Number(a.document_id));
  const live=proof.source.attachments.find((v:any)=>v.filename===a.file_name);
  if(!m||a.storage_status!=='stored'||m.sha256!==a.sha256||sha(fs.readFileSync(m.path))!==a.sha256||live?.contentSha256!==a.sha256)throw Error('attachment_proof_changed');
 }
 const report=fs.readFileSync(`${root}/Artec_Concept_Plans_Review_AR.md`,'utf8');
 if(!report.includes('1710001')||!report.includes('870001')||report.length<2000)throw Error('review_report_incomplete');
 const protectedSnapshot=async()=>({payments:rows(await db.execute(sql`SELECT * FROM como_next_lifecycle_lanes WHERE user_id=1 AND kind='payment' ORDER BY id`)),pending:rows(await db.execute(sql`SELECT * FROM como_next_staged_directives WHERE user_id=1 AND status='pending' ORDER BY id`)),cancelled:rows(await db.execute(sql`SELECT * FROM como_next_work_files WHERE user_id=1 AND work_file_status='cancelled' ORDER BY id`))});
 const protectedBefore=await protectedSnapshot();fs.writeFileSync(`${root}/protected-before.json`,JSON.stringify(protectedBefore,null,2)+'\n');
 // Re-check the live thread immediately before the only mailbox write.
 // A phrase spanning an RFC-folded Subject can be missed by server HEADER search.
 // Search the short plot token, then compare decoded subjects locally.
 const [sentBefore,draftsBefore]=await Promise.all([fetchReadonlyFolderSince('Sent',168,100,undefined,'6180578'),fetchReadonlyFolderSince('Drafts',168,100,undefined,'6180578')]);
 fs.writeFileSync(`${root}/pre-save-thread.json`,JSON.stringify({sentBefore,draftsBefore},null,2)+'\n');
 if(sentBefore.messages.some(m=>sameSubject(m.subject,source.subject)))throw Error('owner_reply_observed_no_draft_created');
 if(draftsBefore.messages.some(m=>sameSubject(m.subject,source.subject))&&!source.reply_draft_communication_id)throw Error('untracked_existing_draft_no_duplicate');
 const draft=await createReplyDraftFromEmailCommand({userId:1,emailId:1710001,body,ccText:'mzakout@artecint.com, wael@zooma.ae'});
 const [communication]=rows(await db.execute(sql`SELECT * FROM como_next_communications WHERE id=${draft.id} AND user_id=1 AND work_file_id=390001`));
 const [ledger]=rows(await db.execute(sql`SELECT * FROM como_mailbox_draft_ledger WHERE communication_id=${draft.id} AND user_id=1 AND work_file_id=390001`));
 const uid=Number(String(communication?.external_message_ref||'').match(/UID\s+(\d+)/)?.[1]||draft.mailboxDraft?.uid||0);
 if(!uid||communication?.communication_status!=='archived'||ledger?.state!=='draft_saved'||norm(communication.body)!==norm(body))throw Error('mailbox_draft_not_proven');
 const [live,liveDrafts,sentAfter]=await Promise.all([fetchEmailByUID(uid,undefined,'Drafts'),fetchReadonlyFolderSince('Drafts',168,100,undefined,'6180578'),fetchReadonlyFolderSince('Sent',168,100,undefined,'6180578')]);
 if(!live||norm(live.textBody)!==norm(body)||envelope(live.to)!=='tdimitrova@artecint.com'||envelope(live.cc)!=='mzakout@artecint.com,wael@zooma.ae'||live.subject!==`Re: ${source.subject}`||sentAfter.messages.some(m=>sameSubject(m.subject,source.subject)))throw Error('live_draft_or_sent_changed');
 const matches=liveDrafts.messages.filter(m=>sameSubject(m.subject,source.subject));
 if(matches.length!==1||matches[0].uid!==uid)throw Error('draft_not_unique');
 const h=matches[0].headers||{};
 if(String(h['in-reply-to']||'')!==source.message_id||!String(h.references||'').includes(source.message_id)||String(h['x-como-draft-key']||'')!=='email-reply-draft:1710001')throw Error('draft_thread_headers_not_proven');
 const ref=`Drafts UID ${uid}`;
 fs.writeFileSync(`${root}/saved-draft-proof.json`,JSON.stringify({uid,communicationId:draft.id,live,liveDrafts,sentAfter},null,2)+'\n');
 const action=await createActionCommand({userId:1,workFileId:390001,title:'الفلل الأربع — مراجعة مخططات أرتك المحدثة ومسودة الرد',description:`وصلت 8 مخططات من أرتك 21:06 دبي يوم15أكتوبر / COMO1710001 وفحصها Manus مقابل رد المالك870001. استجابة جلسة السطح وترتيب خلف السرير ظاهرة؛ الغاز وتعريف مصعد الطعام وجدول مساحات الأربع تحتاج تأكيدًا. ${ref} / المراسلة${draft.id} إلى ثيودورا CC ماجد ووائل. المالك يراجع التصميم والملاحظات والرد ثم يرسل إن أراد؛ لا إرسال أو اعتماد أو تقديم للجهات. التقرير التفصيلي محفوظ في مخرج Manus بملف الفلل.`,acceptanceCriteria:'يسجل المالك ملاحظاته على التصميم والرد أو يرسل المسودة من تطبيق البريد؛ حفظ المسودة لا يوافق على المفهوم أو تقديم الجهات، ولا يبدأ انتظار رد جديد. قرار التصميم للمالك، والمراجعة المصدرية لـManus مكتملة.',ownerType:'human',priority:'important',idempotencyKey:'artec-concept-plans:1710001:owner-review',actorType:'manus',actorUserId:null});
 const summary=`الفلل الأربع6180578 — استُلمت مخططات أرتك الثمانية21:06دبي وفُحصت مقابل ملاحظات9أكتوبر. جلسة السطح وترتيب خلف السرير ظاهران؛ الغاز ومصعد الطعام وجدول مساحات الأربع تحتاج تأكيدًا. رد مهني ${ref}/مراسلة${draft.id} جاهز لمراجعة المالك${action.id}، لم يُرسل. لا اعتماد تصميم أو تقديم للجهات أو تغيير سداد.`;
 await db.transaction(async tx=>{
  const [file]=rows(await tx.execute(sql`SELECT id,work_file_status FROM como_next_work_files WHERE id=390001 AND user_id=1 FOR UPDATE`));if(!file||['closed','cancelled'].includes(file.work_file_status))throw Error('work_file_closed');
  await appendEvent(tx,{userId:1,projectId:6,workFileId:390001,actionId:action.id,actorType:'manus',actorUserId:null,eventType:'artec_concept_package_reviewed',summary,payload:{directiveId:690001,sourceEmailId:1710001,documents:[1470001,1470002,1470003,1470004,1470005,1470006,1470007,1470008],ownerReviewActionId:action.id,communicationDraftId:draft.id,mailboxDraftRef:ref,sent:false,designApproved:false,authoritySubmissionApproved:false,paymentUnchanged:true},idempotencyKey:'artec-concept-plans:1710001:reviewed'});
 });
 await recordManusDispatchProgress({directiveId:690001,summary:`الفلل الأربع — الفحص الموضوعي للمخططات اكتمل وحُفظ الرد المهني في ${ref} بمستلمين ورؤوس خيط مطابقين؛ بطاقة واحدة للمالك${action.id}. الآن حفظ إيصال الفحص؛ لا اعتماد أو إرسال أو انتظار خارجي جديد.`});
 const result=await completeDispatchedMailReview({directiveId:690001,bodySha256:source.body_sha256,reviewedDocumentIds:attachments.map(a=>Number(a.document_id)),summary,workProductBody:report+`\n\n## إيصال التنفيذ\nرد مهني واحد${ref}، مراسلة${draft.id}، بطاقة المالك${action.id}، Toثيودورا وCCماجد ووائل. رؤوس الخيط ومفتاحالمسودةفُحصت حيًا؛ لا نظير بالصادر. لم يُرسل ولم يبدأ انتظار جديد.\n`,communicationDraftId:draft.id,responseHandling:{kind:'draft_saved',evidence:`مسودة${ref}/المراسلة${draft.id}نصهاومستلموهاورؤوسهامطابقونحيًا؛ لا ردفيSentللخيطقبلأوبعدالحفظ.`,nextStep:`مراجعةالمالكللمخططاتوتعليقاتManusومسودةالردبالبطاقة${action.id}؛ لااعتمادأوتقديمأوانتظارأرتكقبلإرسالفعليمنالمالك.`}});
 await db.execute(sql`UPDATE como_manus_dispatches SET next_action_id=${action.id} WHERE directive_id=690001 AND state='completed'`);
 const protectedAfter=await protectedSnapshot();fs.writeFileSync(`${root}/protected-after.json`,JSON.stringify(protectedAfter,null,2)+'\n');
 if(JSON.stringify(protectedBefore)!==JSON.stringify(protectedAfter))throw Error('protected_records_changed');
 const sara=await readExecutiveWorkFile({memberId:'abdulrahman',nameAr:'عبد الرحمن',role:'owner'},JSON.stringify({work_file_id:390001,focus:'overview'}));
 if(!JSON.stringify(sara).includes('1710001')||!JSON.stringify(sara).includes(String(draft.id)))throw Error('sara_receipt_not_visible');
 const final={result,mailboxDraftRef:ref,communicationId:draft.id,ownerReviewActionId:action.id,sent:false,designApproved:false,authoritySubmissionApproved:false,protectedRecordsUnchanged:true,checkedAt:new Date().toISOString()};
 fs.writeFileSync(`${root}/receipt.json`,JSON.stringify(final,null,2)+'\n');fs.writeFileSync(`${root}/sara-after.json`,JSON.stringify(sara,null,2)+'\n');
 fs.writeFileSync(`${root}/Artec_Concept_Reply_Draft_EN.md`,`# Four Villas — Revised Concept Plans\n\nTo: tdimitrova@artecint.com  \nCC: mzakout@artecint.com, wael@zooma.ae  \nSubject: Re: ${source.subject}  \nSaved: ${ref}. Not sent.\n\n---\n\n${body}\n`);
 console.log(JSON.stringify(final,null,2));
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1)});
