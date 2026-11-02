import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {sql,eq} from 'drizzle-orm';
import {getDb} from '../server/db';
import {users} from '../drizzle/schema';
import {storagePut} from '../server/storage';
import {requireProjectAccess,createActionCommand,appendEvent} from '../server/services/comoNextCommands';
import {createReplyDraftFromEmailCommand,normalizeOwnerEmailSignature} from '../server/services/comoNextEmailInbox';
import {fetchReadonlyFolderSince,fetchEmailByUID,getConfiguredMailboxAddress} from '../server/emailMonitor';
import {completeDispatchedMailReview,readDispatchForDirective,recordManusDispatchProgress} from '../server/services/comoManusDispatch';
import {readExecutiveWorkFile} from '../server/services/saraWorkFileReader';
import {comoNextRouter} from '../server/routers/comoNext';
const root='/home/ubuntu/reports/como-batch159000x-2026-11-02';
const load=(n:string)=>JSON.parse(fs.readFileSync(root+'/'+n+'.json','utf8'));
const save=(n:string,v:any)=>fs.writeFileSync(root+'/'+n+'.json',JSON.stringify(v,null,2)+'\n');
const norm=(s:any)=>String(s||'').replace(/\r\n?/g,'\n').trim();
const hash=(s:string|Buffer)=>createHash('sha256').update(s).digest('hex');
const sha=(s:any)=>hash(norm(s));
const env=(s:any)=>[...new Set(String(s||'').toLowerCase().match(/[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}/g)||[])].sort().join(',');
const subject=(s:any)=>norm(s).replace(/^(?:(?:re|fw|fwd)\s*:\s*)+/i,'').toLowerCase();
const ids=[1590001,1590002],sourceIds=[2910001,2940001],actionIds=[3270001,3270002];
const digests=['f70cf1a3489fc258c230f48f169a16d3731648c04c71c81a392e8337ffab47d9','3b29d0c54e8b36e5e0182da545835abab8118bc0c49a8ebd79c223297fbdd3ee'];
async function main(){
 const db=await getDb();assert(db);await requireProjectAccess(db,6,1,'write');assert.equal(getConfiguredMailboxAddress(),'a.zaqout@comodevelopments.com');const q=async(s:any)=>(await db.execute(s))[0] as any[];
 const states=await Promise.all(ids.map(directiveId=>readDispatchForDirective({directiveId})));assert(states.every(s=>s&&['running','completed'].includes(s.state)));
 if(states.every(s=>s?.state==='completed')){console.log(JSON.stringify({replayed:true,receipts:states}));await(db as any).$client.end();return;}
 const before=load('protected-before');const sources:any[]=[];
 for(let i=0;i<ids.length;i++){
  const [authority]=await q(sql`SELECT * FROM como_next_staged_directives WHERE id=${ids[i]} AND user_id=1 AND project_id=6 AND work_file_id=390001 AND action_id=${actionIds[i]} AND source_member_id='system:manus-action'`);assert(authority&&['submitting','submitted'].includes(authority.status));
  const [s]=await q(sql`SELECT * FROM como_next_email_messages WHERE id=${sourceIds[i]} AND user_id=1 AND linked_work_file_id=390001 AND inbox_status='linked'`);assert(s);assert.equal(sha(s.body_text),digests[i]);assert.equal(s.body_sha256,digests[i]);sources.push(s);
  const proof=load(sourceIds[i]+'-proof'),at=load(sourceIds[i]+'-attachments');assert.equal(proof.length,i===0?8:3);
  for(const p of proof){const b=fs.readFileSync(p.path);assert.equal(hash(b),p.sha256);assert.equal(b.length,p.size);}
  const live=await fetchEmailByUID(Number(s.imap_uid),s.uid_validity,'INBOX');assert(live);assert.equal(live.messageId,s.message_id);assert.equal(sha(live.textBody),digests[i]);assert.equal(live.attachments.length,at.length);const rem=[...at];
  for(const a of live.attachments){assert(a.content);const idx=rem.findIndex(r=>r.file_name===a.filename&&r.sha256===hash(a.content!));assert(idx>=0);rem.splice(idx,1);}assert.equal(rem.length,0);
 }
 console.log('Both sources and 11 attachments verified');
 const fresh={checkedAt:new Date().toISOString(),Sent:await fetchReadonlyFolderSince('Sent',96,100),Drafts:await fetchReadonlyFolderSince('Drafts',24*365,100)};save('pre-save-response-live',fresh);
 for(const s of sources)assert(!fresh.Sent.messages.some(m=>subject(m.subject)===subject(s.subject)&&Date.parse(m.date)>Date.parse(s.received_at.replace(' ','T')+'Z')),'Response already sent');
 const persisted=fs.existsSync(root+'/draft-save-result.json')?load('draft-save-result'):null;const target=subject(sources[1].subject);assert(!fresh.Drafts.messages.some(m=>subject(m.subject)===target)||persisted?.id,'Existing draft requires reconciliation');
 const pdf=fs.readFileSync(root+'/pdf/main.pdf');assert(pdf.subarray(0,5).equals(Buffer.from('%PDF-')));assert.equal(load('pdf/main-review/review-manifest').page_count,2);const pdfHash=hash(pdf);const docKey='batch-review:159000x:pdf';
 let [doc]=await q(sql`SELECT * FROM como_next_documents WHERE source_system='como_mail_execution' AND source_key=${docKey} LIMIT 1`);
 if(doc)assert.equal(doc.sha256,pdfHash);else{
  let stored:any=fs.existsSync(root+'/pdf-storage-result.json')?load('pdf-storage-result'):null;
  if(stored)assert.equal(stored.sha256,pdfHash);else{const key=`como-next/private/documents/${randomUUID()}/content`;stored={...(await storagePut(key,pdf,'application/pdf')),sha256:pdfHash};save('pdf-storage-result',stored);}
  const inserted:any=await db.execute(sql`INSERT INTO como_next_documents(title,file_name,mime_type,byte_size,sha256,storage_key,storage_url,source_system,source_key) VALUES('الفلل الأربع — مراجعة مخططات الفيلا3 ومحضر الاجتماع2','Artec_Villa3_Review_AR.pdf','application/pdf',${pdf.length},${pdfHash},${stored.key},${stored.url},'como_mail_execution',${docKey})`);
  [doc]=await q(sql`SELECT * FROM como_next_documents WHERE id=${Number(inserted[0].insertId)}`);
 }
 const download=await fetch(doc.storage_url);assert(download.ok);assert.equal(hash(Buffer.from(await download.arrayBuffer())),pdfHash);save('pdf-document',{id:doc.id,sha256:pdfHash,storageKey:doc.storage_key,verifiedDownload:true});console.log('Two-page PDF saved and download verified');
 for(const directiveId of ids)if((await readDispatchForDirective({directiveId}))?.state==='running')await recordManusDispatchProgress({directiveId,summary:'فُحصت مخططات الفيلا3 والمحضر2 فعليًا و11مرفقًا مطابقة. PDFصفحتان محفوظ داخلCOMO. المحضر يسجل حذفالدبلهايت معمهلةتعليق3أيام وخيارمستويين لقرار3نوفمبر؛لااعتمادآلي ولاحسم360001. ردواحدللمحضر يغطيالمخططات؛لاSentردسابق. DCMوتربتها منفصلان.'});
 const body=normalizeOwnerEmailSignature(fs.readFileSync(root+'/Reply_To_Theodora_EN.txt','utf8').trim());const cc=env(sources[1].cc_text);const draft=persisted||await createReplyDraftFromEmailCommand({userId:1,emailId:2940001,body,ccText:cc});if(!persisted)save('draft-save-result',draft);
 const [ledger]=await q(sql`SELECT * FROM como_mailbox_draft_ledger WHERE user_id=1 AND work_file_id=390001 AND communication_id=${draft.id}`);assert.equal(ledger?.state,'draft_saved');const uid=Number(ledger.draft_uid);assert(uid);
 const afterDrafts=await fetchReadonlyFolderSince('Drafts',24*365,100);const matches=afterDrafts.messages.filter(m=>subject(m.subject)===target);assert.equal(matches.length,1);const observed=matches[0];assert.equal(observed.uid,uid);assert.equal(norm(observed.textBody),body);assert.equal(env(observed.to),'tdimitrova@artecint.com');assert.equal(env(observed.cc),cc);assert.equal(observed.attachments.length,0);assert.equal(observed.headers?.['x-como-draft-key'],'email-reply-draft:2940001');assert.equal(observed.headers?.['in-reply-to'],sources[1].message_id);assert(String(observed.headers?.references||'').includes(sources[1].message_id));save('draft-live-proof',{communicationId:draft.id,draftUid:uid,observed,sent:false});fs.writeFileSync(root+'/Reply_To_Theodora_EN.txt',body+'\n');
 const postSent=await fetchReadonlyFolderSince('Sent',96,100);for(const s of sources)assert(!postSent.messages.some(m=>subject(m.subject)===subject(s.subject)&&Date.parse(m.date)>Date.parse(s.received_at.replace(' ','T')+'Z')));save('post-save-sent',postSent);
 const next=await createActionCommand({userId:1,workFileId:390001,title:'الفلل الأربع — مراجعة محضر أرتك والدبلهايت وخيار المستويين',description:`ملخصPDFمستند${doc.id}فيملف390001،وردواحدDrafts${uid}إلىثيودوراCCالمصدروايل وماجد وRawan. المحضر2.6يسجلحذفالدبلهايت،بينماالقرار360001غيرمحسومبإفادةصريحةلاحقة. خيارالدرجتينمنفصل وموعدالقرارالوارد3نوفمبر. مهلةتعليقاتالمحضر3أياممنالاستلام،لااعتمادبالصمت. راجعالملخص وثبّت مااتفقفعليًااليوم وبديلغرفة4قبلإرسالالرد.`,acceptanceCriteria:'يراجععبدالرحمنووائلالمحضر والمخططات ويؤكدانقراراتاجتماع2نوفمبر صراحة،خصوصًاالدبلهايت والمستويين وبديلغرفة4. إرسالالمسودةمنCOMOفقطإنوافقعبدالرحمن. Manusيتابعالصادرثمردأرتك والإصداراتالكاملة. لا تنفيذتصميمأوإغلاققرارآلي أوتوقيعأوصرفأوتكليفRawan.',ownerType:'human',priority:'urgent',actorType:'manus',actorUserId:null,idempotencyKey:'artec-review:159000x:owner'});
 const review=fs.readFileSync(root+'/Review_AR.md','utf8');const summaries=[`الفلل الأربع — فُحص2910001وثمانيةمرفقات:مساقطالفيلا3فقط وثلاثصوراسترشادية. أُنجزPDFصفحتانومستند${doc.id}داخلCOMOللمطابقةوالنواقص،لااعتمادتصميم. يظهرالمطبخمرتبطًا بالسفرة،وتعديلاتالقبو/الروفغيرمستوفاة،وبديلغرفة4والمقاطعوالحزمةالكاملةللقرار. ردواحدللمحضر2940001فيDrafts${uid}يغطيالمصدرين،لاAckمكرر.`,`الفلل الأربع — فُحص2940001ومحضر2070001منصفحتين مع3مرفقات. اجتماع2نوفمبر9:30موثقبحضورعبدالرحمنووائل؛RawanCCوليستضمنالحضور. المحضرينسبحذفالدبلهايتللعميل ومهلةتعليق3أيام؛القرار360001لميُحسمآليًا. خيارالدرجتينللقرار3نوفمبرمنفصل. ردواحدDrafts${uid}/مراسلة${draft.id}لثيودوراCCالمصدريطلباستكمالًاوقرارًاصريحًا،لميُرسل. بطاقة${next.id}لعبدالرحمنوManusيتابع.`];
 for(let i=0;i<ids.length;i++){
  let state=await readDispatchForDirective({directiveId:ids[i]});
  if(state?.state!=='completed'){
   const docs=[...new Set(load(sourceIds[i]+'-proof').map((p:any)=>Number(p.documentId)))];
   const result:any=await completeDispatchedMailReview({directiveId:ids[i],bodySha256:digests[i],reviewedDocumentIds:docs,summary:summaries[i],workProductBody:review+`\n\nPDFمستند${doc.id}،صفحتان،SHA${pdfHash}. روابطالإجراءات1830001/2910001/3240001.\n\n${summaries[i]}\n\nنصالردالمحفوظ:\n${body}`,communicationDraftId:Number(draft.id),responseHandling:{kind:'draft_saved',evidence:`فحصSent96ساعةوDraftsالكاملةيؤكدعدمردعلىالمصدرين. ردواحدUID${uid}ومراسلة${draft.id}فيخيطالمحضر2940001يشملالاستلاموالتوضيحوالطلباتللمخططات2910001أيضًا. المتنومظارفالمصدر ومفتاحDraftوReferencesمطابقة؛لااستلامآليمكررأوردمستقلغيرضروري.`,nextStep:`عبدالرحمنووائليثبتانمااتفقفعليًافيالاجتماع والدبلهايت والمستويينوبديلغرفة4؛بطاقة${next.id}. بعدالصادريتبعManusردأرتك والحزمةالكاملةوالمقاطعوالبرنامج؛DCMوالتربةمنفصلان. لااعتمادمحضرأوتصميمبالصمتأوإغلاق360001.`}});assert(result.workProductId);save('completion-'+ids[i],result);state=await readDispatchForDirective({directiveId:ids[i]});
  }
  assert(state?.workProductId);const memoryId=Number(state.workProductId);
  await db.transaction(async tx=>{
   await tx.execute(sql`UPDATE como_manus_dispatches SET next_action_id=${next.id} WHERE directive_id=${ids[i]} AND state='completed' AND work_product_id=${memoryId}`);
   await tx.execute(sql`UPDATE como_next_work_memory SET source_file_key=${doc.storage_key},source_file_name='Artec_Villa3_Review_AR.pdf',mime_type='application/pdf' WHERE id=${memoryId} AND work_file_id=390001 AND source_system='como_mail_execution'`);
   for(const documentId of [Number(doc.id),...new Set(load(sourceIds[i]+'-proof').map((p:any)=>Number(p.documentId)))])await tx.execute(sql`INSERT IGNORE INTO como_next_work_memory_documents(project_id,work_file_id,memory_id,document_id,relation_type,source_system,source_record_id) VALUES(6,390001,${memoryId},${documentId},${documentId===Number(doc.id)?'attachment':'source'},'como_mail_execution',${'dispatch-review:'+ids[i]})`);
  });
 }
 const wp=Number((await readDispatchForDirective({directiveId:1590001}))?.workProductId);const finalSummary=summaries.join('\n');
 await db.transaction(async tx=>{
  await tx.execute(sql`SELECT id FROM como_next_work_files WHERE id=390001 AND user_id=1 FOR UPDATE`);
  const done=(await tx.execute(sql`SELECT id FROM como_next_work_file_events WHERE user_id=1 AND idempotency_key='batch159000x:linked' LIMIT 1`))[0]as any[];if(done.length)return;
  const [a]=(await tx.execute(sql`SELECT * FROM como_next_actions WHERE id=3240001 AND user_id=1 AND work_file_id=390001 FOR UPDATE`))[0]as any[];assert(a&&a.source_record_id==='evidence-reconcile:2910001:next'&&a.action_status==='open');
  await tx.execute(sql`UPDATE como_next_actions SET action_status='verified',completed_at=UTC_TIMESTAMP(),verified_at=UTC_TIMESTAMP(),evidence_reference=${'PDFمستند'+doc.id+'؛مخرج'+wp+'؛صفحتان؛مراجعةفعلية2910001/2940001؛لااعتمادتصميم'} WHERE id=3240001 AND user_id=1 AND action_status='open'`);
  for(const id of [1830001,2910001])await tx.execute(sql`UPDATE como_next_actions SET evidence_reference=CONCAT(COALESCE(evidence_reference,''),${'\nملخصمراجعةPDFمستند'+doc.id+'ومخرج'+wp+'لمخططاتالفيلا3ومحضر2؛لااعتمادنهائي'}),updated_at=UTC_TIMESTAMP() WHERE id=${id} AND user_id=1`);
  const [dcm]=(await tx.execute(sql`SELECT * FROM como_next_actions WHERE id=3210001 AND user_id=1 AND work_file_id=390001 FOR UPDATE`))[0]as any[];
  const [cancel]=(await tx.execute(sql`SELECT actor_type,payload_json FROM como_next_work_file_events WHERE user_id=1 AND action_id=3210001 ORDER BY id DESC LIMIT 1`))[0]as any[];
  assert(dcm?.action_status==='cancelled'&&cancel?.actor_type==='system'&&JSON.parse(cancel.payload_json).emailId===2910001,'DCM cancellation changed; do not overwrite owner action');
  assert(fresh.Drafts.messages.some(m=>m.uid===991&&String(m.subject).includes('DDA letter')));
  await tx.execute(sql`UPDATE como_next_actions SET action_status='open',completed_at=NULL,verified_at=NULL,evidence_reference=CONCAT(COALESCE(evidence_reference,''),'\nتصحيحإلغاءآليغيرمرتبط:2910001مخططاتفيلا3 وليستتوكيلDCMأورقمطلبأوإيصال525. مسودة991نفسهاقائمة؛لاطلبتوقيعأوصرفأوبريدجديد.'),updated_at=UTC_TIMESTAMP() WHERE id=3210001 AND user_id=1 AND action_status='cancelled'`);
  await appendEvent(tx,{userId:1,projectId:6,workFileId:390001,actionId:3210001,actorType:'manus',actorUserId:null,eventType:'action_restored_from_unrelated_evidence',summary:'أُعيدت3210001لحالتهاالمفتوحةبعدإثباتأنالمنظومةألغتهابمخططات2910001التيلا تتضمننواقصDCM؛991نفسهالمتتغير.',payload:{sourceEmailId:2910001,from:'cancelled',to:'open',paymentChanged:false,externalSideEffect:false},idempotencyKey:'batch159000x:dcm-restore'});
  const [f]=(await tx.execute(sql`SELECT desired_outcome FROM como_next_work_files WHERE id=390001 AND user_id=1`))[0]as any[];await tx.execute(sql`UPDATE como_next_work_files SET desired_outcome=${'2نوفمبر — '+finalSummary+'\nPDFمستند'+doc.id+'مرتبط1830001/2910001؛3240001مكتملبالفحص. DCM3210001أعيدبعدإلغاءآليغيرمرتبط،991نفسهاقائمة. التربةوالسدادوالقرار360001وRawanلمتتغير.\n'+f.desired_outcome},updated_at=UTC_TIMESTAMP() WHERE id=390001 AND user_id=1`);
  await tx.execute(sql`UPDATE como_next_actions SET attention_at=UTC_TIMESTAMP(),evidence_reference=${'ملخصPDFمستند'+doc.id+'؛Drafts'+uid+'؛محضر2070001/ص1–2؛مهلة3أياموخيارالمستويين3نوفمبر؛لاقرارآلي'} WHERE id=${next.id} AND user_id=1 AND action_status='open'`);
  await appendEvent(tx,{userId:1,projectId:6,workFileId:390001,actionId:3240001,actorType:'manus',actorUserId:null,eventType:'attachment_review_pdf_completed',summary:finalSummary,payload:{sourceEmailIds:'2910001,2940001',documentId:Number(doc.id),workProductId:wp,pdfPages:2,linkedActionIds:'1830001,2910001',decisionChanged:false,paymentChanged:false,externalSideEffect:false},idempotencyKey:'batch159000x:linked'});
 });
 const after={files:await q(sql`SELECT * FROM como_next_work_files WHERE user_id=1 ORDER BY id`),lanes:await q(sql`SELECT * FROM como_next_lifecycle_lanes WHERE user_id=1 ORDER BY id`),pending:await q(sql`SELECT * FROM como_next_staged_directives WHERE user_id=1 AND status='pending' ORDER BY id`),actions:await q(sql`SELECT * FROM como_next_actions WHERE user_id=1 ORDER BY id`),communications:await q(sql`SELECT * FROM como_next_communications WHERE user_id=1 ORDER BY id`),ledgers:await q(sql`SELECT * FROM como_mailbox_draft_ledger WHERE user_id=1 ORDER BY id`),decisions:await q(sql`SELECT * FROM como_next_decisions WHERE user_id=1 ORDER BY id`)};save('protected-after',after);
 for(const k of ['lanes','pending','decisions'])assert.deepEqual(after[k as keyof typeof after],before[k]);assert.deepEqual(after.files.filter(f=>f.id!==390001),before.files.filter((f:any)=>f.id!==390001));const allowed=[...actionIds,1830001,2910001,3210001,3240001,next.id];assert.deepEqual(after.actions.filter(a=>!allowed.includes(a.id)),before.actions.filter((a:any)=>!allowed.includes(a.id)));assert.deepEqual(after.communications.filter(c=>c.id!==draft.id),before.communications);assert.deepEqual(after.ledgers.filter(l=>l.communication_id!==draft.id),before.ledgers);
 for(const id of [1830001,2910001]){const a=after.actions.find(a=>a.id===id),b=before.actions.find((a:any)=>a.id===id);for(const k of ['action_status','due_at','follow_up_at','attention_at','owner_type','owner_user_id'])assert.equal(a[k],b[k]);}
 const [user]=await db.select().from(users).where(eq(users.id,1));assert(user);const kitchen:any=await comoNextRouter.createCaller({user,req:{}as any,res:{}as any}).getOverview();save('kitchen-after',kitchen);assert(kitchen.actions.some((a:any)=>a.id===next.id));assert(kitchen.actions.some((a:any)=>a.id===3210001));assert(!kitchen.actions.some((a:any)=>[3240001,...actionIds].includes(a.id)));assert(!kitchen.sendEvidenceDiagnostics?.some((d:any)=>d.actionId===next.id));
 const sara:any=await readExecutiveWorkFile({memberId:'abdulrahman',nameAr:'عبد الرحمن',role:'owner'},JSON.stringify({work_file_id:390001,focus:'overview',question:'المخططاتللفيلا3والمحضر2؛الدبلهايتلميعتمدآليًا وقرارالمستويينغدًا منالمحضر. PDFصفحتانوردمسودةواحدة. DCMمازالتنواقصهقائمة.'}));save('sara-after',sara);assert(sara.found&&JSON.stringify(sara).includes(String(wp)));
 const receipt={directives:await Promise.all(ids.map(directiveId=>readDispatchForDirective({directiveId}))),sourceIds,communicationId:Number(draft.id),draftUid:uid,humanActionId:Number(next.id),reviewedActionId:3240001,pdfDocumentId:Number(doc.id),pdfPages:2,pdfSha256:pdfHash,pdfPath:root+'/Artec_Villa3_Review_AR.pdf',linkedActionIds:[1830001,2910001],dcmActionRestored:3210001,dcmDraftUnchanged:991,decision360001Changed:false,paymentChanged:false,rawanStarted:false,designApproved:false,sent:false,saraFound:true,protectedRecordsUnchanged:true};fs.copyFileSync(root+'/pdf/main.pdf',receipt.pdfPath);save('receipt',receipt);console.log(JSON.stringify(receipt));await(db as any).$client.end();
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1)});
