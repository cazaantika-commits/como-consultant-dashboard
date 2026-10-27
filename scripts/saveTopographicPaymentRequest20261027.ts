import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {sql,eq} from 'drizzle-orm';
import {getDb} from '../server/db';
import {users} from '../drizzle/schema';
import {getConfiguredMailboxAddress,fetchReadonlyFolderSince,fetchEmailByUID} from '../server/emailMonitor';
import {createCommunicationDraftCommand,appendEvent,requireProjectAccess} from '../server/services/comoNextCommands';
import {readExecutiveWorkFile} from '../server/services/saraWorkFileReader';
import {comoNextRouter} from '../server/routers/comoNext';
const root='/home/ubuntu/reports/topographic-payment-request-2026-10-27';
const key='email-reply-draft:2310001:accounts-payment:owner20261027T094810Z';
const norm=(s:any)=>String(s||'').replace(/\r\n?/g,'\n').trim();
const hash=(v:Buffer|string)=>createHash('sha256').update(v).digest('hex');
const env=(v:any)=>[...new Set(String(v||'').toLowerCase().match(/[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}/g)||[])].sort().join(',');
const save=(n:string,v:any)=>fs.writeFileSync(root+'/'+n+'.json',JSON.stringify(v,null,2)+'\n');
async function main(){
 const db=await getDb();assert(db);await requireProjectAccess(db,6,1,'write');assert.equal(getConfiguredMailboxAddress(),'a.zaqout@comodevelopments.com');
 const q=async(s:any)=>(await db.execute(s))[0] as any[];
 const [done]=await q(sql`SELECT id,body FROM como_next_work_memory WHERE source_system='owner_instruction' AND source_record_id=${key} AND work_file_id=390001`);
 if(done&&fs.existsSync(root+'/receipt.json')){console.log(JSON.stringify({replayed:true,memoryId:done.id,receipt:JSON.parse(fs.readFileSync(root+'/receipt.json','utf8'))}));await(db as any).$client.end();return;}
 const before=JSON.parse(fs.readFileSync(root+'/before.json','utf8'));const live=JSON.parse(fs.readFileSync(root+'/live-before.json','utf8'));assert(Date.now()-Date.parse(live.checkedAt)<15*60_000);
 const [source]=await q(sql`SELECT * FROM como_next_email_messages WHERE id=2310001 AND user_id=1 AND linked_work_file_id=390001`);assert.equal(source.body_sha256,'a2a5eeee0bef9f71024c1442f7d427d39e8ae2787d7427a83e828f99b7a763be');
 assert(before.action[0]?.id===2460001&&before.action[0].action_status==='open');
 assert(!live.Drafts.messages.some((m:any)=>/MES-INV-2026-10-224|Middle East Survey/i.test(m.textBody+' '+m.subject)),'existing_request_draft');
 assert(!live.Sent.messages.some((m:any)=>/MES-INV-2026-10-224|Middle East Survey/i.test(m.textBody+' '+m.subject)&&env(m.to).includes('shahid@zooma.ae')),'accounts_request_already_sent');
 const files=[
  {documentId:1800001,path:'/home/ubuntu/reports/como-directive-1140001-2026-10-26/attachments/DB-P-0752-82-02-L01-26.pdf',filename:'Artec NOC and Middle East Survey Invoice MES-INV-2026-10-224.pdf',sha:'f3d4fa5beb19fc40cf57b613aeaa7b5f38995017d747e1e16f41fc356822ada6'},
  {documentId:1230006,path:'/home/ubuntu/reports/como-linkage-repair-2026-10-14/1200001/attachments/05_Q2026-3849_1.pdf',filename:'Middle East Survey Signed Quotation MES-2026-3849_1.pdf',sha:'cd6117826ed444ad2eafa1d1af80f8007320638af7450961b2d2d36e2de27446'}
 ];
 for(const f of files){assert.equal(hash(fs.readFileSync(f.path)),f.sha);const [d]=await q(sql`SELECT sha256 FROM como_next_documents WHERE id=${f.documentId}`);assert.equal(d.sha256,f.sha);}
 const body=norm(fs.readFileSync(root+'/Payment_Request_EN.txt','utf8'));
 const resultFile=root+'/draft-save.json';
 const draft=fs.existsSync(resultFile)?JSON.parse(fs.readFileSync(resultFile,'utf8')):await createCommunicationDraftCommand({userId:1,workFileId:390001,channel:'email',subject:'Payment Request — Middle East Survey, Four Villas, Plot 6180578 — AED 1,260',body,toText:'shahid@zooma.ae',ccText:'account.mrt@zooma.ae, wael@zooma.ae',sourceEmailId:2310001,idempotencyKey:key,attachments:files.map(f=>({filename:f.filename,content:fs.readFileSync(f.path),contentType:'application/pdf'}))});
 if(!fs.existsSync(resultFile))save('draft-save',draft);
 const current=await fetchReadonlyFolderSince('Drafts',24*365,100);save('live-after',current);
 const found=current.messages.filter(m=>m.headers?.['x-como-draft-key']===key);assert.equal(found.length,1);const mail=found[0];
 assert.equal(hash(norm(mail.textBody)),hash(body));assert.equal(env(mail.to),'shahid@zooma.ae');assert.equal(env(mail.cc),'account.mrt@zooma.ae,wael@zooma.ae');assert.equal(mail.headers?.['in-reply-to'],source.message_id);
 assert.equal(mail.attachments?.length,2);
 const full=await fetchEmailByUID(mail.uid,current.uidValidity,'Drafts');assert(full&&hash(norm(full.textBody))===hash(body));assert.equal(full.attachments.length,2);
 const attachmentProof=files.map(f=>{const a=full.attachments.find(a=>a.filename===f.filename);assert(a);assert.equal(hash(a.content),f.sha);return {documentId:f.documentId,filename:f.filename,sha256:hash(a.content),byteSize:a.content.length};});save('attachment-proof',attachmentProof);
 const [ledger]=await q(sql`SELECT * FROM como_mailbox_draft_ledger WHERE communication_id=${draft.id} AND user_id=1 AND work_file_id=390001`);assert(ledger.state==='draft_saved'&&!ledger.sent_uid&&Number(ledger.draft_uid)===mail.uid);
 const summary=`الفلل الأربع — عدم ممانعة عبد الرحمن27أكتوبر13:48 لصرف فاتورةالمسحMES-INV-2026-10-224/1,260درهم شاملVAT،بشرطالحصولعلىموافقةوائلثمصرفها. مسودةCOMO${mail.uid}إلىشاهدCCنسرينووايل،مرفقانأصليان:عدمممانعةأرتكوالفاتورة،والعرضالموقع. لمتُرسل،لا موافقةوائلمفترضةولاإثباتسداد؛5586منفصلة. عبد الرحمنيراجعويسلّممنCOMO،Manusيتابعالموافقةوإثباتالتنفيذبعدالإرسال.`;
 let memoryId:number=0;
 await db.transaction(async tx=>{
  await tx.execute(sql`SELECT id FROM como_next_work_files WHERE id=390001 AND user_id=1 FOR UPDATE`);
  const [a]=(await tx.execute(sql`SELECT id,owner_type,action_status FROM como_next_actions WHERE id=2460001 AND user_id=1 AND work_file_id=390001 FOR UPDATE`))[0] as any[];assert(a.owner_type==='human'&&a.action_status==='open');
  const existing=(await tx.execute(sql`SELECT id FROM como_next_work_memory WHERE source_system='owner_instruction' AND source_record_id=${key}`))[0] as any[];
  if(existing.length){memoryId=Number(existing[0].id);return;}
  const result=await tx.execute(sql`INSERT INTO como_next_work_memory(project_id,work_file_id,memory_type,entry_type,title,body,source_status,source_system,source_record_id,occurred_at) VALUES(6,390001,'decision','owner_payment_nonobjection','الفلل الأربع — عدم الممانعة لصرف فاتورةالمسح بعد موافقةوائل',${summary},'draft_saved','owner_instruction',${key},UTC_TIMESTAMP())`);memoryId=Number((result as any)[0].insertId);
  for(const f of files)await tx.execute(sql`INSERT IGNORE INTO como_next_work_memory_documents(project_id,work_file_id,memory_id,document_id,relation_type,source_system,source_record_id) VALUES(6,390001,${memoryId},${f.documentId},'attachment','owner_instruction',${key+':'+f.documentId})`);
  await tx.execute(sql`UPDATE como_next_actions SET title='الفلل الأربع — عبد الرحمن: مراجعة طلب صرفالمسح بعد موافقةوائل',description=${`عدم الممانعة مسجلة. رسالةالحسابات محفوظة فيDrafts UID ${mail.uid} إلىشاهدCCنسرينووايل؛تطلبموافقةوائلأولًاثمالسدادالمباشرلـMiddleEastSurveyبمبلغ1,260درهم،معالفاتورةوعدمممانعةأرتكوالعرضالموقع. مراجعةالرسالةوإرسالها فقط؛لاموافقةوائلأودفعمسجل،ولاتكرار969المرسلةأو5586.`},acceptance_criteria='مراجعة وإرسال مسودةالحسابات منCOMO؛الحساباتتحصلعلىموافقةوائل قبل الصرف،Manusيتابعثبوتالموافقةوالتنفيذبعدالإرسال. عدمالممانعةأوموافقةالعرض ليستإثباتسداد.',evidence_reference=${'توجيهعبدالرحمن27أكتوبر13:48؛COMO2310001/1800001؛العرض1230006؛DraftsUID'+mail.uid},attention_at=UTC_TIMESTAMP(),updated_at=UTC_TIMESTAMP() WHERE id=2460001 AND user_id=1`);
  await appendEvent(tx,{userId:1,projectId:6,workFileId:390001,actionId:2460001,actorType:'human',actorUserId:1,eventType:'owner_payment_nonobjection_recorded',summary,payload:{communicationId:Number(draft.id),communicationDraftId:Number(draft.id),humanActionId:2460001,draftUid:mail.uid,amountAed:1260,invoiceReference:'MES-INV-2026-10-224',nonObjection:true,waelApprovalRequired:true,waelApprovalReceived:false,paymentChanged:false,sent:false},idempotencyKey:key+':recorded'});
 });
 const after={lanes:await q(sql`SELECT * FROM como_next_lifecycle_lanes WHERE user_id=1 ORDER BY id`),pending:await q(sql`SELECT * FROM como_next_staged_directives WHERE user_id=1 AND status='pending' ORDER BY id`),actions:await q(sql`SELECT * FROM como_next_actions WHERE user_id=1 ORDER BY id`)};
 assert.deepEqual(after.lanes,before.protection.lanes);assert.deepEqual(after.pending,before.protection.pending);assert.deepEqual(after.actions.filter(a=>a.id!==2460001),before.protection.actions.filter((a:any)=>a.id!==2460001));save('protected-after',after);
 const [user]=await db.select().from(users).where(eq(users.id,1)).limit(1);assert(user);const caller=comoNextRouter.createCaller({user,req:{} as any,res:{} as any});const overview=await caller.getOverview();const owner=(overview as any).actions.find((a:any)=>Number(a.id)===2460001);assert(owner?.ownerType==='human'&&owner.actionStatus==='open');assert(!(overview as any).sendEvidenceDiagnostics?.some((d:any)=>Number(d.actionId)===2460001));
 const sara:any=await readExecutiveWorkFile({memberId:'abdulrahman',nameAr:'عبد الرحمن',role:'owner'},JSON.stringify({work_file_id:390001,focus:'overview',question:'الفلل الأربع — عدم الممانعة لصرف فاتورةالمسح1,260درهم بعد موافقةوائل،مسودةالحسابات976 ومرفقاتها. لا سداد5586.'}));assert(sara.found);save('sara-after',sara);
 const receipt={communicationId:Number(draft.id),draftUid:mail.uid,humanActionId:2460001,memoryId,attachmentIds:files.map(f=>f.documentId),attachments:files,nonObjectionRecorded:true,waelApprovalRequired:true,paymentChanged:false,sent:false,ownerCardVisible:true,saraFound:sara.found,checkedAt:new Date().toISOString()};save('receipt',receipt);console.log(JSON.stringify(receipt,null,2));await(db as any).$client.end();
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1)});
