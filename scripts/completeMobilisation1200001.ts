import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {sql,eq} from 'drizzle-orm';
import {getDb} from '../server/db';
import {users} from '../drizzle/schema';
import {fetchReadonlyFolderSince,getConfiguredMailboxAddress} from '../server/emailMonitor';
import {createReplyDraftFromEmailCommand} from '../server/services/comoNextEmailInbox';
import {createCommunicationDraftCommand,createActionCommand,appendEvent,requireProjectAccess} from '../server/services/comoNextCommands';
import {readDispatchForDirective,recordManusDispatchProgress,completeDispatchedMailReview} from '../server/services/comoManusDispatch';
import {readExecutiveWorkFile} from '../server/services/saraWorkFileReader';
import {comoNextRouter} from '../server/routers/comoNext';
import {correctFinanceCc} from './correctFinanceCc1200001';
const root='/home/ubuntu/reports/como-directives-1200001-1200002-2026-10-27';
const sourceId=2400001,sourceSha='e18aa4efefc3728a843fb23cbf7a522e525b0f137e75ac592cec6dc348b8c157';
const norm=(v:any)=>String(v||'').replace(/\r\n?/g,'\n').trim();
const hash=(v:any)=>createHash('sha256').update(norm(v)).digest('hex');
const env=(v:any)=>[...new Set(String(v||'').toLowerCase().match(/[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}/g)||[])].sort().join(',');
const subj=(v:any)=>norm(v).replace(/^\s*(?:(?:re|fw|fwd)\s*:\s*)+/i,'').toLowerCase();
const load=(n:string)=>JSON.parse(fs.readFileSync(root+'/'+n+'.json','utf8'));
const save=(n:string,v:any)=>fs.writeFileSync(root+'/'+n+'.json',JSON.stringify(v,null,2)+'\n');
async function main(){
 const db=await getDb();assert(db);await requireProjectAccess(db,6,1,'write');assert.equal(getConfiguredMailboxAddress(),'a.zaqout@comodevelopments.com');
 const q=async(s:any)=>(await db.execute(s))[0] as any[];
 const states=await Promise.all([1200001,1200002].map(directiveId=>readDispatchForDirective({directiveId})));
 if(states.every(s=>s?.state==='completed')){console.log(JSON.stringify({replayed:true,states},null,2));save('replay',{replayed:true,states});await(db as any).$client.end();return;}
 assert(states.every(s=>['running','completed'].includes(String(s?.state))),'dispatch_not_claimed');
 const [email]=await q(sql`SELECT * FROM como_next_email_messages WHERE id=2400001 AND user_id=1 AND linked_work_file_id=390001 AND inbox_status='linked' AND folder_name='INBOX'`);
 assert(email?.body_sha256===sourceSha&&hash(email.body_text)===sourceSha&&email.message_id==='<d37f83c1238a441ab8aee480f34fe493@artecint.com>','source_changed');
 const attachments=await q(sql`SELECT * FROM como_next_email_attachments WHERE email_message_id=2400001 ORDER BY ordinal`);
 const proofs=load('attachment-proof');assert(attachments.length===2&&proofs.length===2);
 for(const a of attachments){const p=proofs.find((p:any)=>Number(p.documentId)===Number(a.document_id));assert(p?.sha256===a.sha256&&a.storage_status==='stored'&&a.disposition==='inline'&&a.mime_type==='image/jpeg'&&createHash('sha256').update(fs.readFileSync(p.path)).digest('hex')===a.sha256,'attachment_changed');}
 assert(!attachments.some(a=>a.disposition!=='inline'||!a.mime_type.startsWith('image/')),'unexpected_financial_document');
 const contract=fs.readFileSync(root+'/contract-review.md','utf8');assert(contract.includes('3.1.2')&&contract.includes('75,600')&&contract.includes('4.2'));
 const live=load('response-live');assert(live.readOnly&&Date.now()-Date.parse(live.checkedAt)<15*60_000,'mail_proof_stale');
 assert(!live.Sent.messages.some((m:any)=>subj(m.subject)===subj(email.subject)&&Date.parse(m.date)>=Date.parse(email.received_at+'Z')),'artec_already_replied_today');
 assert(!live.Drafts.messages.some((m:any)=>subj(m.subject)===subj(email.subject)),'existing_artec_draft');
 assert(!live.Drafts.messages.some((m:any)=>String(m.textBody).includes('5586')&&env(m.to)==='shahid@zooma.ae'),'existing_finance_draft');
 const snapshot=async()=>({files:await q(sql`SELECT * FROM como_next_work_files WHERE id=390001 AND user_id=1`),lanes:await q(sql`SELECT * FROM como_next_lifecycle_lanes WHERE user_id=1 ORDER BY id`),pending:await q(sql`SELECT * FROM como_next_staged_directives WHERE user_id=1 AND status='pending' ORDER BY id`),actions:await q(sql`SELECT * FROM como_next_actions WHERE user_id=1 ORDER BY id`),communications:await q(sql`SELECT * FROM como_next_communications WHERE user_id=1 ORDER BY id`),ledgers:await q(sql`SELECT * FROM como_mailbox_draft_ledger WHERE user_id=1 ORDER BY id`)});
 const before=fs.existsSync(root+'/protected-before.json')?load('protected-before'):await snapshot();if(!fs.existsSync(root+'/protected-before.json'))save('protected-before',before);
 const [oldComm]=await q(sql`SELECT * FROM como_next_communications WHERE id=3060001 AND user_id=1 AND communication_status='sent'`);
 const [oldLedger]=await q(sql`SELECT * FROM como_mailbox_draft_ledger WHERE communication_id=3060001 AND user_id=1 AND state='sent_confirmed'`);assert(oldComm&&Number(oldLedger?.sent_uid)===231,'prior_sent_not_proven');
 const financeContext=load('finance-context');const approval=financeContext.emails.find((e:any)=>e.id===1080003);assert(approval?.body_text.includes('Kindly proceed with payment'),'prior_approval_missing');
 const artecBody=norm(fs.readFileSync(root+'/Artec_Reply_EN.txt','utf8'));const financeBody=norm(fs.readFileSync(root+'/Finance_Followup_EN.txt','utf8'));
 for(const directiveId of [1200001,1200002])if((await readDispatchForDirective({directiveId}))?.state!=='completed')await recordManusDispatchProgress({directiveId,summary:'الفلل الأربع — الرسالة2400001 تطلب موعد تنفيذ5586، والمرفقان شعاران لا فاتورة جديدة. العقد الموقّع وفاتورة5586 فُحصا؛ 20%/75,600شاملVAT و15يومًا واستلام التعبئة قبل بدء رسمي. لا تأكيد سداد؛ المتابعة900001 واحدة معشاهدونسرين. تم فحصSent/Drafts؛ لا رد اليوم أو متابعة مكررة.'});
 const artec=fs.existsSync(root+'/artec-draft-save.json')?load('artec-draft-save'):await createReplyDraftFromEmailCommand({userId:1,emailId:sourceId,body:artecBody,ccText:'mzakout@artecint.com, wael@zooma.ae'});if(!fs.existsSync(root+'/artec-draft-save.json'))save('artec-draft-save',artec);
 // A purpose-specific key preserves the 20 October thank-you already sent;
 // this requests a processing estimate, never a new payment or approval.
 const financeKey='email-reply-draft:1950001:processing-date:20261027';
 const finance=fs.existsSync(root+'/finance-draft-save.json')?load('finance-draft-save'):await createCommunicationDraftCommand({userId:1,workFileId:390001,channel:'email',subject:'Re: Artec Invoice 5586 — Mobilization, Four Villas, Plot 6180578',body:financeBody,toText:'shahid@zooma.ae',ccText:'account.mrt@zooma.ae',sourceEmailId:1950001,idempotencyKey:financeKey});if(!fs.existsSync(root+'/finance-draft-save.json'))save('finance-draft-save',finance);
 // The generic creator adds Wael by default; preserve the owner-approved
 // exception by replacing the existing finance draft, never appending again.
 save('finance-cc-correction',await correctFinanceCc());
 const drafts=await fetchReadonlyFolderSince('Drafts',24*365,100);save('drafts-after',drafts);
 const find=(key:string)=>drafts.messages.filter(m=>m.headers?.['x-como-draft-key']===key);
 const aa=find('email-reply-draft:2400001'),ff=find(financeKey);assert.equal(aa.length,1);assert.equal(ff.length,1);
 assert(hash(aa[0].textBody)===hash(artecBody)&&env(aa[0].to)==='tdimitrova@artecint.com'&&env(aa[0].cc)==='mzakout@artecint.com,wael@zooma.ae','artec_draft_mismatch');
 assert(hash(ff[0].textBody)===hash(financeBody)&&env(ff[0].to)==='shahid@zooma.ae'&&env(ff[0].cc)==='account.mrt@zooma.ae','finance_draft_mismatch');
 assert(aa[0].headers?.['in-reply-to']===email.message_id&&String(aa[0].headers.references).includes(email.message_id),'artec_thread_mismatch');
 const [shahid]=await q(sql`SELECT * FROM como_next_email_messages WHERE id=1950001 AND user_id=1 AND linked_work_file_id=390001`);assert(ff[0].headers?.['in-reply-to']===shahid.message_id&&String(ff[0].headers.references).includes(shahid.message_id),'finance_thread_mismatch');
 for(const c of [artec,finance]){const [l]=await q(sql`SELECT * FROM como_mailbox_draft_ledger WHERE user_id=1 AND work_file_id=390001 AND communication_id=${c.id}`);assert(l?.state==='draft_saved'&&!l.sent_uid,'draft_not_saved');}
 const artecAction=await createActionCommand({userId:1,workFileId:390001,title:'الفلل الأربع — عبد الرحمن: مراجعة رد أرتك عن موعد تنفيذ5586',description:`رد على رسالة27أكتوبر فيDrafts UID ${aa[0].uid}، إلىثيودوراCCماجدووائل. لا يوجد موعد مؤكد أو إثباتدفع؛ يوضح أن المتابعة للحصول على موعدمعالجة موثوق. لا إعادة965 المرسلة أو قبولتصميم أو بدءأعمال.`,acceptanceCriteria:'مراجعة الرد وإرساله منCOMO إنوافق عبد الرحمن، دون وعد بتاريخ دفع غير مثبت أو التزام جديد.',ownerType:'human',priority:'important',actorType:'manus',actorUserId:null,idempotencyKey:'artec:2400001:owner-reply'});
 const financeAction=await createActionCommand({userId:1,workFileId:390001,title:'الفلل الأربع — عبد الرحمن: إرسال طلب موعد معالجة5586 لشاهد',description:`متابعة عملية للطلب القائم فقط فيDrafts UID ${ff[0].uid} إلىشاهدCCنسرين، دونوائل. تطلب موعدالمعالجة أو عائقها أو إثباتالسدادإننُفذ؛ الموافقة12أكتوبر والعقد والفاتورة موجودة، فلا إعادةطلبصرفأوموافقةأومستندات. انتظار900001هوالوحيد،Manusيتابعردشاهد.`,acceptanceCriteria:'مراجعة وإرسال متابعة الموعد القائمة منCOMO فقط؛ لا دفع أو طلبصرف أو تكرار موافقة وائل؛ لا انتظار خارجي ثانٍ.',ownerType:'human',priority:'important',actorType:'manus',actorUserId:null,idempotencyKey:'artec:2400001:finance-processing-date-owner'});
 const [oldWatch]=await q(sql`SELECT * FROM como_next_actions WHERE id=900001 AND user_id=1 AND work_file_id=390001`);assert(oldWatch?.action_status==='waiting_external'&&oldWatch.source_system==='finance_payment_watch');
 await db.transaction(async tx=>{
  await tx.execute(sql`SELECT id FROM como_next_work_files WHERE id=390001 AND user_id=1 FOR UPDATE`);
  const seen=(await tx.execute(sql`SELECT id FROM como_next_work_file_events WHERE user_id=1 AND idempotency_key='artec:2400001:two-purpose-drafts-linked'`))[0] as any[];
  if(!seen.length){
   await tx.execute(sql`UPDATE como_next_actions SET title='الفلل الأربع — انتظار شاهد ونسرين: موعد معالجة5586 أو تأكيد التنفيذ',description=${`رسالةأرتك2400001/27أكتوبر تطلبموعدمعالجةموثوقًا. الموافقة1080003/12أكتوبر موجودة،والفاتورة5586/75,600شاملVAT قائمة. آخرردشاهد1950001مفحوص930001/3990001ولايعاد؛لا تأكيدسدادأوموعدحديث. ردأرتكDrafts${aa[0].uid} ومتابعةشاهدCCنسرينDrafts${ff[0].uid}لمتُرسلا. Manusيتابعالرد علىالموعدأوالعائقوإثباتالسدادضمنهذاالانتظارالوحيد،دونوائل؛لاتغييرpayment:5586.`},acceptance_criteria='موعدمعالجةموثوقأوعائقمنشاهدونسرينأوإثباتسدادفعليفيCOMO. الموعدالمتوقعليسسدادًا؛لايعادالرد1950001أوطلبالصرفأوموافقةوائل.',evidence_reference=${`COMO2400001؛العقد1140005ص5/15/16؛الفاتورة1140004؛Drafts${aa[0].uid}/${ff[0].uid}؛Sent231/228؛3990001`},updated_at=UTC_TIMESTAMP() WHERE id=900001 AND user_id=1 AND action_status='waiting_external'`);
   for(const pair of [{c:artec,a:artecAction,uid:aa[0].uid,purpose:'artec_reply'},{c:finance,a:financeAction,uid:ff[0].uid,purpose:'finance_processing_date'}])await appendEvent(tx,{userId:1,projectId:6,workFileId:390001,actionId:Number(pair.a.id),actorType:'manus',actorUserId:null,eventType:'mobilisation_processing_date_draft_linked',summary:'الفلل الأربع — مسودة '+pair.purpose+' منفصلة الغرض بلا صرف أوإرسال.',payload:{sourceEmailId:sourceId,communicationId:Number(pair.c.id),communicationDraftId:Number(pair.c.id),humanActionId:Number(pair.a.id),draftUid:pair.uid,purpose:pair.purpose,sent:false,waitingActionId:900001},idempotencyKey:'artec:2400001:'+pair.purpose+':draft-linked'});
   await appendEvent(tx,{userId:1,projectId:6,workFileId:390001,actionId:900001,actorType:'manus',actorUserId:null,eventType:'mobilisation_processing_date_followup',summary:'الفلل الأربع — استفسار27أكتوبر محدث ضمنانتظار900001الوحيد؛لاتحويلطلبموعدإلىسدادولاصرف.',payload:{sourceEmailId:sourceId,paymentChanged:false,paymentRequestCreated:false,newWaitingCreated:false},idempotencyKey:'artec:2400001:two-purpose-drafts-linked'});
  }
 });
 const financialSummary='الفلل الأربع — الرسالة2400001 تذكير بطلب موعد معالجة5586 لا عرض سعر أو فاتورة جديدة. المرفقان630001/630002 شعاران inline فقط. العقد والفاتورة الأصلية يثبتان20%/75,600شاملVAT،15يومًا منالفاتورة واستلامالتعبئة قبلبدءرسمي؛موافقةوائل12أكتوبر موجودة. السدادوالموعدغيرمثبتين،لا طلبصرفجديد. أُغلقفحصالتصنيف2550002 معانتظار900001القائم.';
 // The generic financial-document receipt intentionally requires an actual
 // substantive attachment. This source has none: record its reviewed false-
 // positive classification under the exact delivered authority, not a fake
 // reviewed-document list or a relaxation of that global guard.
 if((await readDispatchForDirective({directiveId:1200001}))?.state!=='completed')await db.transaction(async tx=>{
  const tr=async(s:any)=>(await tx.execute(s))[0] as any[];
  const [d]=await tr(sql`SELECT * FROM como_next_staged_directives WHERE id=1200001 AND user_id=1 AND project_id=6 AND work_file_id=390001 AND action_id=2550002 AND source_member_id='system:manus-action' AND status='submitting' FOR UPDATE`);assert(d,'financial_authority_changed');
  const [dispatch]=await tr(sql`SELECT * FROM como_manus_dispatches WHERE directive_id=1200001 FOR UPDATE`);assert(dispatch?.state==='running'&&dispatch.claim_token?.startsWith('worker:'),'financial_claim_changed');
  const [s]=await tr(sql`SELECT * FROM como_next_email_messages WHERE id=2400001 AND user_id=1 FOR UPDATE`);assert(s.body_sha256===sourceSha&&hash(s.body_text)===sourceSha&&Number(s.linked_work_file_id)===390001,'financial_source_changed');
  const [a]=await tr(sql`SELECT * FROM como_next_actions WHERE id=2550002 AND user_id=1 AND source_system='finance_invoice_review' AND source_record_id='source-email-2400001' AND action_status='open' FOR UPDATE`);assert(a,'financial_action_changed');
  const current=await tr(sql`SELECT disposition,mime_type,document_id FROM como_next_email_attachments WHERE email_message_id=2400001`);assert(current.length===2&&current.every(a=>a.disposition==='inline'&&a.mime_type.startsWith('image/')),'substantive_document_added');
  const m:any=await tx.execute(sql`INSERT INTO como_next_work_memory(project_id,work_file_id,memory_type,entry_type,title,body,source_status,source_system,source_record_id,is_current,occurred_at) VALUES(6,390001,'work_product','financial_document_source_review','الفلل الأربع — تصنيف رسالة2400001: تذكير لا وثيقة مالية جديدة',${financialSummary+'\n\n'+contract+'\n\nمصدرالتوجيه1200001/الصندوق960001؛البصمة'+sourceSha+'؛ لا مرفقمالي جديد ولا استحقاقمستحدث. لايُستبدلتصنيفهابتصنيفquotation أوinvoice جديد،ولا يُدّعىاستخداممعالجالمرفقالماليالذيشترطوجودوثيقةموضوعية. الفاتورة5586 مرجعسابق1140004 وليستمنمرفقات2400001.'},'reviewed','finance_invoice_review','dispatch-review:1200001',1,UTC_TIMESTAMP())`);const wp=Number(m[0].insertId);assert(wp);
  const receipt={directiveId:1200001,completedNow:true,workProductId:wp,sourceEmailId:sourceId,bodySha256:sourceSha,classification:'payment_status_reminder_no_new_financial_document',reviewedDocumentIds:[],reviewedInlineDocumentIds:[630001,630002],referenceReviewedDocumentIds:[1140004,1140005],invoiceNumber:5586,invoiceAmountAed:75600,nextActionId:900001,paymentChanged:false,paymentRequestCreated:false,sent:false,executionSummary:financialSummary};
  await tx.execute(sql`UPDATE como_next_actions SET action_status='verified',completed_at=UTC_TIMESTAMP(),verified_at=UTC_TIMESTAMP(),evidence_reference=${`إيصال${wp}:مراجعةتصنيف2400001،شعارانفقط؛5586مرجعقائم،لاصرفأوسداد`} WHERE id=2550002 AND user_id=1 AND action_status='open'`);
  await tx.execute(sql`UPDATE como_manus_dispatches SET state='completed',work_product_id=${wp},next_action_id=900001,execution_summary=${financialSummary},result_json=${JSON.stringify(receipt)},completed_at=UTC_TIMESTAMP(),last_progress_at=UTC_TIMESTAMP(),error=NULL WHERE directive_id=1200001 AND claim_token=${dispatch.claim_token}`);
  await tx.execute(sql`UPDATE como_next_staged_directives SET status='submitted',work_product_id=${wp},execution_summary=${financialSummary},result_json=${JSON.stringify(receipt)},submitted_at=UTC_TIMESTAMP(),failure_message=NULL WHERE id=1200001 AND user_id=1 AND status='submitting'`);
  await appendEvent(tx,{userId:1,projectId:6,workFileId:390001,actionId:2550002,actorType:'manus',actorUserId:null,eventType:'financial_document_review_completed',summary:financialSummary,payload:receipt,idempotencyKey:'financial-document-review:1200001'});save('financial-receipt',receipt);
 });
 const summary=`الفلل الأربع — فُحص ردأرتك2400001 والخيط والعقد5586؛تطلبموعدمعالجةلا فاتورةجديدة،وشعارانفقط. ردأرتكDrafts${aa[0].uid}في${artecAction.id}،ومتابعةشاهدCCنسريندونوائلDrafts${ff[0].uid}في${financeAction.id}،لمتُرسلا. لا وعدبتاريخدفع ولا صرفأوسداد. انتظار900001واحدللموعدأوالعائقأوالتأكيد؛965Sent231لايعاد،المخططاتوRawanكماهي.`;
 const workBody=summary+'\n\n## المصدر2400001 والخيط\n'+fs.readFileSync(root+'/thread.txt','utf8')+'\n\n## المرجعالتعاقديوالفاتورة\n'+contract+'\n\n## الردأرتك\n'+artecBody+'\n\n## متابعةشاهدونسرين\n'+financeBody+'\n\n## المسؤولية\nعبدالرحمنيراجع ويرسل كلرسالةفيبندها؛Manusيتابعموعدمعالجةموثوقأوالعائقوإثباتالتنفيذضمن900001. لاانتظارثانٍقبلالإرسالولاموافقةوائلأومستنداتمعادة. لااعترافبقبولمخططاتأوإذنببدءأرتكأوRawan. موعدمعالجةمستقبليليسدفعًا.\n';
 const mail:any=await completeDispatchedMailReview({directiveId:1200002,bodySha256:sourceSha,reviewedDocumentIds:[],summary,workProductBody:workBody,communicationDraftId:artec.id,responseHandling:{kind:'draft_saved',evidence:`ردأرتكDrafts UID ${aa[0].uid}مراسلة${artec.id}ومتابعةموعدشاهدDrafts UID ${ff[0].uid}مراسلة${finance.id}؛فُحصتا حيًا بالنص والمظارف والمفاتيحورؤوسالخيط؛لا رداليوم فيSentولا مسودةمكررة. الشعارانفُحصابصريًاوببصماتمطابقة،لا فاتورة جديدة.`,nextStep:`عبدالرحمنيُراجعويرسلردأرتكفي${artecAction.id}ومتابعةالموعدلشاهدCCنسريندونوائل في${financeAction.id}. Manusيتابع900001القائم،لاينشئصرفًا ولايعدموعدًامجهولًا ولانعيد965 أوشكر961.`}});
 const mailWp=Number(mail.workProductId);assert(mailWp);
 await db.transaction(async tx=>{await tx.execute(sql`UPDATE como_manus_dispatches SET next_action_id=${artecAction.id} WHERE directive_id=1200002 AND state='completed' AND work_product_id=${mailWp}`);for(const wp of [mailWp,Number((await readDispatchForDirective({directiveId:1200001}))?.workProductId)])for(const documentId of [630001,630002])await tx.execute(sql`INSERT IGNORE INTO como_next_work_memory_documents(project_id,work_file_id,memory_id,document_id,relation_type,source_system,source_record_id) VALUES(6,390001,${wp},${documentId},'source','como_source_review',${wp+':'+documentId})`);});
 const after=await snapshot();save('protected-after',after);
 assert.deepEqual(after.files,before.files);assert.deepEqual(after.lanes,before.lanes);assert.deepEqual(after.pending,before.pending);
 const excluded=[2550001,2550002,900001,Number(artecAction.id),Number(financeAction.id)];assert.deepEqual(after.actions.filter(a=>!excluded.includes(Number(a.id))),before.actions.filter((a:any)=>!excluded.includes(Number(a.id))));
 assert.deepEqual(after.communications.filter(c=>![Number(artec.id),Number(finance.id)].includes(Number(c.id))),before.communications);assert.deepEqual(after.ledgers.filter(l=>![Number(artec.id),Number(finance.id)].includes(Number(l.communication_id))),before.ledgers);
 const [user]=await db.select().from(users).where(eq(users.id,1));const kitchen=await comoNextRouter.createCaller({user,req:{} as any,res:{} as any}).getOverview();save('kitchen-after',kitchen);
 for(const id of [Number(artecAction.id),Number(financeAction.id)])assert(kitchen.actions.some(a=>Number(a.id)===id&&a.ownerType==='human'&&a.actionStatus==='open'),'owner_action_not_visible');
 assert(!kitchen.sendEvidenceDiagnostics?.some(d=>[Number(artecAction.id),Number(financeAction.id)].includes(Number(d.actionId))),'draft_link_ambiguous');assert(!kitchen.actions.some(a=>[2550001,2550002,2220001].includes(Number(a.id))),'completed_action_open');
 const sara:any=await readExecutiveWorkFile({memberId:'abdulrahman',nameAr:'عبد الرحمن',role:'owner'},JSON.stringify({work_file_id:390001,focus:'overview',question:'الفلل الأربع: رد2400001موعد5586 ومتابعةشاهدونسرين وانتظار900001'}));assert(sara.found&&JSON.stringify(sara).includes(String(mailWp)));save('sara-after',sara);
 const receipt={directives:await Promise.all([1200001,1200002].map(directiveId=>readDispatchForDirective({directiveId}))),sourceEmailId:sourceId,sourceSha,artecCommunicationId:artec.id,artecDraftUid:aa[0].uid,artecActionId:artecAction.id,financeCommunicationId:finance.id,financeDraftUid:ff[0].uid,financeActionId:financeAction.id,waitingActionId:900001,classification:'payment_status_reminder_no_new_financial_document',paymentChanged:false,paymentRequestCreated:false,sent:false,protectedRecordsUnchanged:true,saraFound:true,kitchenOwnerCardsVisible:true};save('receipt',receipt);console.log(JSON.stringify(receipt,null,2));await(db as any).$client.end();
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1)});
