import 'dotenv/config';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {sql,eq} from 'drizzle-orm';
import {getDb} from '../server/db';
import {users} from '../drizzle/schema';
import {appendEvent,requireProjectAccess} from '../server/services/comoNextCommands';
import {fetchEmailByUID,fetchReadonlyFolderSince} from '../server/emailMonitor';
import {completeDispatchedFinancialDocumentReview,completeDispatchedMailReview,readDispatchForDirective} from '../server/services/comoManusDispatch';
import {readExecutiveWorkFile} from '../server/services/saraWorkFileReader';
import {readMailExecutionHealth} from '../server/services/comoMailExecution';
import {comoNextRouter} from '../server/routers/comoNext';
const root='/home/ubuntu/reports/como-batch231000x-2026-11-10',key='falcon-ntp:3900001';
const norm=(v:any)=>String(v||'').replace(/\r\n?/g,'\n').trim();
const hash=(v:Buffer|string)=>createHash('sha256').update(v).digest('hex');
const save=(n:string,v:any)=>fs.writeFileSync(root+'/'+n+'.json',JSON.stringify(v,null,2)+'\n');
const load=(n:string)=>JSON.parse(fs.readFileSync(root+'/'+n+'.json','utf8'));
const omit=(v:any,ks:string[])=>Object.fromEntries(Object.entries(v).filter(([k])=>!ks.includes(k)));
async function main(){
 const db=await getDb();assert(db);await requireProjectAccess(db,6,1,'write');
 const q=async(s:any)=>(await db.execute(s))[0]as any[];
 if(fs.existsSync(root+'/receipt.json')){
  const r=load('receipt');for(const id of[2310001,2310002]){const d:any=await readDispatchForDirective({directiveId:id});assert.equal(d.state,'completed');assert.equal(Number(d.workProductId),r.workProductIds[String(id)]);}
  console.log(JSON.stringify({replayed:true,mailboxWrite:false,...r}));await(db as any).$client.end();return;
 }
 for(const[id,actionId]of[[2310001,4620001],[2310002,4620002]]){
  const[d]=await q(sql`SELECT * FROM como_next_staged_directives WHERE id=${id} AND user_id=1 AND project_id=6 AND work_file_id=390001 AND action_id=${actionId} AND source_member_id='system:manus-action'`);assert(d&&['submitting','submitted'].includes(d.status));const st:any=await readDispatchForDirective({directiveId:id});assert(['running','completed'].includes(st.state));
 }
 const b=load('protected-before'),context=load('context'),s=context.email,proof=load('attachment-proof'),calc=load('calculation');
 assert.equal(s.id,3900001);assert.equal(s.imap_uid,553);assert.equal(s.body_sha256,'4046d3d3e8193704210bad8a528ad7ed9d6a1ed571bf0ace67c8f6dee512cbc6');
 const source=await fetchEmailByUID(s.imap_uid,s.uid_validity,'INBOX');assert(source&&source.messageId===s.message_id&&hash(norm(source.textBody))===s.body_sha256);assert.equal(source.attachments.length,3);
 for(const[i,a]of source.attachments.entries()){
  const p=proof[i];assert(a.content&&p);assert.equal(p.filename,a.filename);assert.equal(hash(a.content),p.sha256);assert.equal(hash(fs.readFileSync(p.path)),p.sha256);
  const[d]=await q(sql`SELECT sha256 FROM como_next_documents WHERE id=${p.documentId}`);assert.equal(d.sha256,p.sha256);
 }
 assert.equal(calc.baseNet,'8100');assert.equal(calc.withMASWNet,'12000');
 const report=fs.readFileSync(root+'/Falcon_NTP_Review_AR.md','utf8'),independent=fs.readFileSync(root+'/Independent_Review_AR.md','utf8');
 assert(report.includes('3900001')&&report.includes('INBOX553')&&report.includes('تصحيح جزئي')&&report.includes('ONE')&&report.includes('لا فاتورة'));assert(independent.includes('EIGHT THOUSAND ONE HUNDRED'));
 const[l]=await q(sql`SELECT * FROM como_mailbox_draft_ledger WHERE id=1980001 AND user_id=1 AND communication_id=5460002`);assert(l&&l.state==='draft_saved'&&Number(l.draft_uid)===1023&&!l.sent_uid);
 const[c]=await q(sql`SELECT * FROM como_next_communications WHERE id=5460002 AND user_id=1 AND work_file_id=390001`);assert(c&&norm(c.body).includes('REQ-3113149')&&norm(c.body).includes('once the permit is issued'));
 const matches=(v:any)=>v.messageId===l.message_id||v.headers?.['x-como-draft-key']===l.draft_key;
 const sent=await fetchReadonlyFolderSince('Sent',24*7,220),drafts=await fetchReadonlyFolderSince('Drafts',24*365,220);assert(sent.messages.length<220&&drafts.messages.length<220);save('mail-before-completion',{Sent:sent,Drafts:drafts});
 assert(!sent.messages.some(matches),'Existing NOC notification was sent: reconcile source before any write');
 const dm=drafts.messages.filter(matches);assert.equal(dm.length,1);assert.equal(dm[0].uid,1023);assert.equal(hash(norm(dm[0].textBody)),hash(norm(c.body)));assert.equal(dm[0].attachments.length,1);
 const sourceTime=Date.parse(String(s.received_at).replace(' ','T')+'Z');assert(!sent.messages.some(v=>/Recommendation for Award for Soil Works/i.test(v.subject)&&Date.parse(String(v.date))>=sourceTime),'Later reply exists: inspect before completing');
 const approval=b.ledgers.find((v:any)=>v.communication_id===5280001);assert.equal(approval.state,'sent_confirmed');assert.equal(Number(approval.sent_uid),262);assert(sent.messages.some(v=>v.uid===262&&/approval and instruction to commence/.test(v.textBody)));
 const summary='3900001/INBOX553 و2640001: خطابأرتكالموقع وعرضFalconR5،الأساسي8100 وMASW3900 محتمل كماالموافقةالمرسلة262. استبدلتالكلماتالقديمةلكنONEمازالتناقصةفي8100؛تصحيحجزئي. تعهداتMASW/NOCوالتعبئةوشرط6أشهر بخطابأرتك لا قبولمورد مثبت،وتوقيتالدفع مختلف. Falconجاهزةبإفادةثيودورا وتنتظرDCMNOC،لا تصريحأوبدءمؤكد. إخطارالوصل1023القائمغيرمرسل ويغطيالمتابعة،لا ردأوموافقةأوصرفمكرر. التصويبوالتأكيداتبالتوازيلايؤخرانالبدء.';
 await db.transaction(async tx=>{
  const tr=async(s:any)=>(await tx.execute(s))[0]as any[];await tx.execute(sql`SELECT id FROM como_next_work_files WHERE id=390001 AND user_id=1 FOR UPDATE`);
  if((await tr(sql`SELECT id FROM como_next_work_file_events WHERE idempotency_key=${key+':followup'}`)).length)return;
  const[a]=await tr(sql`SELECT * FROM como_next_actions WHERE id=4530002 AND user_id=1 AND work_file_id=390001 FOR UPDATE`);assert.equal(a.action_status,'open');assert.equal(a.owner_type,'human');
  const description='[FalconNTP3900001Latest]\n'+summary+'\nالمتابعةمنManusبعدSent1023: إصدارتصريحREQ3113149 وبدءFalcon ثم التقريرالأولي،واستكمالONE وتأكيدقبولFalconللتعبئة/NOC وتوحيدتوقيتالدفع بالتوازي دونتعطيل. لا طلبدفعجديد؛وصل1050 ليس تصريحًا.\n\nالسجلالسابق:\n'+a.description;
  await tx.execute(sql`UPDATE como_next_actions SET description=${description},evidence_reference=${'3900001/INBOX553;2640001 signed ARTEC NTP/R5;8100 numeric confirmed;ONE missing;Sent262 approval;Drafts1023 unsent;REQ3113149 NOC pending'},updated_at=UTC_TIMESTAMP() WHERE id=4530002 AND user_id=1`);
  await appendEvent(tx,{userId:1,projectId:6,workFileId:390001,actionId:4530002,actorType:'manus',actorUserId:null,eventType:'falcon_ntp_followup_reviewed',summary,payload:{sourceEmailId:3900001,existingDraftCommunicationId:5460002,existingDraftUid:1023,workflowNextActionId:4530002,partialWordsCorrection:true,wordsFullyCorrected:false,supplierAcceptanceNotProven:true,nocIssued:false,fieldCommencementProven:false,mailboxWrite:false,paymentChanged:false,decisionsChanged:false},idempotencyKey:key+':followup'});
 });
 const financial:any=await completeDispatchedFinancialDocumentReview({directiveId:2310002,bodySha256:s.body_sha256,reviewedDocumentIds:[2640001],classification:'quotation',summary:'3900001و2640001 خطابإسنادأرتك وعرضFalconR5لا فاتورةمستحقةأودفع.8100أساسي و3900محتمل كماالموافقة. التصحيحجزئيONEناقصة؛التعهداتمنأرتك لا قبولFalcon مثبت وتوقيتالدفع مختلف. لاطلبصرفأوإعادةقراربدء.',workProductBody:report+'\n\nالمراجعةالمستقلة:\n'+independent+'\n\nالحسابات:\n'+JSON.stringify(calc)});save('financial-completion',financial);
 const fd:any=await readDispatchForDirective({directiveId:2310002});assert.equal(fd.state,'completed');const fwp=Number(fd.workProductId);assert(fwp);
 const mail:any=await completeDispatchedMailReview({directiveId:2310001,bodySha256:s.body_sha256,reviewedDocumentIds:proof.map((v:any)=>v.documentId),summary,workProductBody:report+'\n\nالنتيجةالمحفوظة:\n'+summary,responseHandling:{kind:'no_reply_needed',evidence:'3900001 تحديثجاهزيةبعدأمرالبدءSent262،لا سؤالجديديتطلبموافقة. مسودة1023/5460002القائمة تتضمنوصل1050 وتطلبصدورNOCوبدءFalcon،وطابقالفحصالحيمتنهاوهويتهاومرفقها وتفردها وعدمSent. لاعادةموافقةأوشكرأوتحويلوصلثانٍ،ولا تعطيلالبدءبتصحيحONEالإداري.',nextStep:'عبدالرحمنيراجعويرسل1023القائمة إنوافق،ManusيثبتSentثم يتابعصدورNOCREQ3113149 وتأكيدتاريخبدءFalcon والتقريرالأولي. التصحيحالجزئيONEوتوثيقتعهدFalconبالتعبئةوشمولMASWوتوحيدتوقيتالدفع بالتوازي،لاشرطمعطلللأساسيولاانتظارخارجيجديدعلىمسودة.4530002القائمةحفظتمسؤولهاوحالتهاومواعيدها.'}});save('mail-completion',mail);
 const md:any=await readDispatchForDirective({directiveId:2310001});assert.equal(md.state,'completed');const mwp=Number(md.workProductId);assert(mwp);
 for(const[wp,ids,system,id]of[[fwp,[2640001],'finance_invoice_review',2310002],[mwp,proof.map((v:any)=>v.documentId),'como_mail_execution',2310001]]as const)for(const docId of ids)await db.execute(sql`INSERT IGNORE INTO como_next_work_memory_documents(project_id,work_file_id,memory_id,document_id,relation_type,source_system,source_record_id) VALUES(6,390001,${wp},${docId},'source',${system},${'dispatch-review:'+id+':'+docId})`);
 await db.transaction(async tx=>{
  const tr=async(s:any)=>(await tx.execute(s))[0]as any[];await tx.execute(sql`SELECT id FROM como_next_work_files WHERE id=390001 AND user_id=1 FOR UPDATE`);
  if((await tr(sql`SELECT id FROM como_next_work_file_events WHERE idempotency_key=${key+':status'}`)).length)return;
  const[f]=await tr(sql`SELECT desired_outcome FROM como_next_work_files WHERE id=390001 AND user_id=1`);
  await tx.execute(sql`UPDATE como_next_work_files SET desired_outcome=${'[FalconNTP3900001Latest]\n'+summary+'\nإيصالالمالية'+fwp+' والبريد'+mwp+' مصدرسارة؛4530002ومسودة1023القائمة دونتكرار،وسائرالقراراتوالسدادمحفوظة.\n\nالسجلالسابق:\n'+f.desired_outcome},updated_at=UTC_TIMESTAMP() WHERE id=390001 AND user_id=1`);
  await appendEvent(tx,{userId:1,projectId:6,workFileId:390001,actorType:'manus',actorUserId:null,eventType:'falcon_ntp_reviews_completed',summary,payload:{sourceEmailId:3900001,financialWorkProductId:fwp,mailWorkProductId:mwp,workflowNextActionId:4530002,noNewDraft:true,mailboxWrite:false,wordsFullyCorrected:false,nocIssued:false,paymentChanged:false,decisionsChanged:false,statusForSara:true},idempotencyKey:key+':status'});
 });
 const finalSent=await fetchReadonlyFolderSince('Sent',48,220),finalDrafts=await fetchReadonlyFolderSince('Drafts',24*365,220);save('mail-final',{Sent:finalSent,Drafts:finalDrafts});assert(!finalSent.messages.some(matches));assert.equal(finalDrafts.messages.filter(matches).length,1);
 const health=await readMailExecutionHealth(1);save('mail-health',health);assert.equal(health.items.find((v:any)=>v.emailId===3900001)?.state,'review_completed');
 const sara:any=await readExecutiveWorkFile({memberId:'abdulrahman',nameAr:'عبدالرحمن',role:'owner'},JSON.stringify({work_file_id:390001,focus:'overview',question:'3900001/2640001 تمتالمراجعة؛8100و3900محتمل وONEناقصة؛FalconجاهزةتنتظرNOC.إيصالا'+fwp+'/'+mwp+'،لا ردجديد.1023قائمةغيرمرسلة و4530002نفسها؛ManusيتابعSentثمNOCوالبدء دونصرفأوتغييرقرارات.'}));save('sara-status-source',sara);assert(sara.found&&JSON.stringify(sara).includes(String(fwp))&&JSON.stringify(sara).includes(String(mwp)));
 const[user]=await db.select().from(users).where(eq(users.id,1));assert(user);const kitchen:any=await comoNextRouter.createCaller({user,req:{}as any,res:{}as any}).getOverview();save('kitchen-after',kitchen);assert(kitchen.actions.some((v:any)=>v.id===4530002&&v.ownerType==='human'));assert(!kitchen.sendEvidenceDiagnostics?.some((v:any)=>v.actionId===4530002));
 const a:any={projects:await q(sql`SELECT * FROM projects WHERE userId=1 ORDER BY id`),files:await q(sql`SELECT * FROM como_next_work_files WHERE user_id=1 ORDER BY id`),actions:await q(sql`SELECT * FROM como_next_actions WHERE user_id=1 ORDER BY id`),lanes:await q(sql`SELECT * FROM como_next_lifecycle_lanes WHERE user_id=1 ORDER BY id`),decisions:await q(sql`SELECT * FROM como_next_decisions WHERE user_id=1 ORDER BY id`),pending:await q(sql`SELECT * FROM como_next_staged_directives WHERE user_id=1 AND status='pending' ORDER BY id`),communications:await q(sql`SELECT * FROM como_next_communications WHERE user_id=1 ORDER BY id`),ledgers:await q(sql`SELECT * FROM como_mailbox_draft_ledger WHERE user_id=1 ORDER BY id`),emails:await q(sql`SELECT * FROM como_next_email_messages WHERE user_id=1 ORDER BY id`)};save('protected-after',a);
 for(const k of['projects','lanes','decisions','pending','communications','ledgers','emails'])assert.deepEqual(a[k],b[k],k);
 for(const[k,ids]of Object.entries({files:[390001],actions:[4530002,4620001,4620002]}))assert.deepEqual(a[k].filter((v:any)=>!ids.includes(v.id)),b[k].filter((v:any)=>!ids.includes(v.id)),k);
 assert.deepEqual(omit(a.actions.find((v:any)=>v.id===4530002),['description','evidence_reference','updated_at']),omit(b.actions.find((v:any)=>v.id===4530002),['description','evidence_reference','updated_at']));assert.deepEqual(omit(a.files.find((v:any)=>v.id===390001),['desired_outcome','updated_at']),omit(b.files.find((v:any)=>v.id===390001),['desired_outcome','updated_at']));
 for(const id of[2310001,2310002])for(const query of[sql`SELECT COUNT(*) n FROM como_next_work_memory WHERE source_record_id=${'dispatch-review:'+id}`,sql`SELECT COUNT(*) n FROM como_next_work_file_events WHERE idempotency_key=${'dispatch-started:'+id}`])assert.equal(Number((await q(query))[0].n),1);
 assert.equal(Number((await q(sql`SELECT COUNT(*) n FROM como_mailbox_draft_ledger WHERE user_id=1 AND draft_key=${l.draft_key}`))[0].n),1);
 const receipt={directiveIds:[2310001,2310002],sourceEmailId:3900001,sourceUid:553,bodySha256:s.body_sha256,reviewedDocumentIds:proof.map((v:any)=>v.documentId),workProductIds:{'2310001':mwp,'2310002':fwp},classification:'quotation',signedARTECNTP:true,supplierAcceptanceNotProven:true,baseNet:8100,optionalMASWNet:3900,totalIfRequired:12000,partialWordsCorrection:true,wordsFullyCorrected:false,missingWord:'ONE',paymentTimingConflict:true,nocSixMonthsFromPermitNotAward:true,nocIssued:false,fieldCommencementProven:false,previousApprovalSentUid:262,existingDraftUid:1023,existingCommunicationId:5460002,existingDraftUnsent:true,existingActionId:4530002,existingActionOwnerDatesStatusPreserved:true,responseHandling:'no_reply_needed',noNewDraft:true,mailboxWrite:false,paymentChanged:false,paymentRequestCreated:false,decisionsChanged:false,newExternalWaitCreated:false,protectedRecordsUnchanged:true,saraFound:true,ownerCardVisible:true,unique:true,checkedAt:new Date().toISOString()};save('receipt',receipt);console.log(JSON.stringify(receipt));await(db as any).$client.end();
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.stack);process.exit(1)});
