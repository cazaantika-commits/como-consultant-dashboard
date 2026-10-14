import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {sql} from 'drizzle-orm';
import {getDb} from '../server/db';
import {createCommunicationDraftCommand, createActionCommand, appendEvent, requireProjectAccess} from '../server/services/comoNextCommands';
import {fetchReadonlyFolderSince, fetchEmailByUID} from '../server/emailMonitor';
import {readExecutiveWorkFile} from '../server/services/saraWorkFileReader';

const root='/home/ubuntu/reports/colliers-owner-note-audit-2026-10-14';
const key='owner-colliers-feasibility-comments:20261014-approved';
const sourceId=1470001,workFileId=60017,userId=1,projectId=1;
const expectedSourceId='<AU1P273MB1742ED6C44622997243928DECC9E2@AU1P273MB1742.AREP273.PROD.OUTLOOK.COM>';
const expectedSourceHash='72dce978429af5e52b3aec463c1ff0bf26d52a6a70c4f6404a15fc73921f1236';
const to='abeyratne.charitha@mena.colliers.com';
const cc='grant.nash@mena.colliers.com, nicholas.brown@mena.colliers.com, wael@zooma.ae';
const subject='Re: Draft Report Submission V0.3 - Updated Concept & Next Steps';
const row=(v:any)=>(v[0] as any[]);
const norm=(v:string)=>String(v||'').replace(/\r\n?/g,'\n').trim();
const env=(v:string)=>(String(v||'').toLowerCase().match(/[a-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}/g)||[]).sort().join(',');
const digest=(s:string)=>createHash('sha256').update(norm(s)).digest('hex');
const evidence='توجيه المالك في هذه المهمة 14 أكتوبر 2026،16:25 دبي: تجهيز الرسالة المتفق عليها بما فيها التمويل ووضعها على المسودات فقط';

function approvedBody(){
 const text=fs.readFileSync(`${root}/Colliers_Feasibility_Comments_Draft_EN.md`,'utf8');
 const start=text.indexOf('Dear Charitha and Grant,');
 if(start<0)throw Error('approved_body_missing');
 const body=norm(text.slice(start)
  .replace(/\| Component \| Area — sq ft \| Indicative rate — AED\/sq ft \|\n\|---\|---:\|---:\|\n\| Leasable area, retained from your report \| 325,070\.09 \| 540–600 \|\n\| Other above-ground construction, including roof \| 256,313\.58 \| 810–900 \|\n\| Basements \| 324,632\.00 \| 315–350 \|/, '- Leasable area, retained from your report: 325,070.09 sq ft at AED 540–600 per sq ft.\n- Other above-ground construction, including roof: 256,313.58 sq ft at AED 810–900 per sq ft.\n- Basements: 324,632.00 sq ft at AED 315–350 per sq ft.')
  .replace(/^## /gm,'').replace(/\*\*/g,'').replace(/  \n/g,'\n'));
 if(body.includes('| Component')||body.includes('## ')||!body.includes('6. Financing assumptions and debt-servicing capacity')||!body.includes('7. Required revisions and deliverables')||!body.endsWith('E: a.zaqout@comodevelopments.com'))throw Error('approved_body_incomplete');
 return body;
}

async function main(){
 const db=await getDb();if(!db)throw Error('database_unavailable');
 await requireProjectAccess(db,projectId,userId,'write');
 const [source]=row(await db.execute(sql`SELECT * FROM como_next_email_messages WHERE id=${sourceId} AND user_id=${userId} AND linked_work_file_id=${workFileId}`));
 if(!source||source.folder_name!=='INBOX'||source.from_email.toLowerCase()!==to||source.message_id!==expectedSourceId||source.body_sha256!==expectedSourceHash)throw Error('source_thread_changed');
 const body=approvedBody();
 const [existing]=row(await db.execute(sql`SELECT * FROM como_next_communications WHERE user_id=${userId} AND work_file_id=${workFileId} AND source_system='como_next' AND source_record_id=${key} LIMIT 1`));
 if(existing&&['cancelled','archived','sent'].includes(existing.communication_status))throw Error('prior_delivery_terminal_do_not_restore');
 if(existing&&norm(existing.body)!==body)throw Error('approved_body_changed_after_draft_claim');
 console.log('Checking COMO Drafts and Sent read-only...');
 const [draftBatch,sentBatch]=await Promise.all([fetchReadonlyFolderSince('Drafts',48,250),fetchReadonlyFolderSince('Sent',48,250)]);
 const similar=(m:any)=>/colliers\.com/i.test(`${m.to},${m.cc}`)&&(/not a sufficient basis for a development decision/i.test(m.textBody)||(/I did not give that instruction/i.test(m.textBody)&&/feasibility/i.test(m.textBody)));
 const liveDrafts=draftBatch.messages.filter(similar),liveSent=sentBatch.messages.filter(similar);
 const audit={checkedAt:new Date().toISOString(),sourceEmailId:sourceId,sourceMessageId:expectedSourceId,draftsScanned:draftBatch.messages.length,sentScanned:sentBatch.messages.length,matchingDrafts:liveDrafts.map((m:any)=>({uid:m.uid,messageId:m.messageId,subject:m.subject,date:m.date})),matchingSent:liveSent.map((m:any)=>({uid:m.uid,messageId:m.messageId,subject:m.subject,date:m.date})),source,existing,bodySha256:digest(body)};
 fs.writeFileSync(`${root}/feasibility-comments-save-before.json`,JSON.stringify(audit,null,2));
 if(liveSent.length)throw Error('owner_comments_already_sent_do_not_duplicate');
 if(liveDrafts.length&&!existing)throw Error('unlinked_existing_comments_draft_requires_reconciliation');
 if(existing&&liveDrafts.length>1)throw Error('multiple_comment_drafts_require_reconciliation');
 console.log('Source verified; saving approved comments as one draft, no SMTP.');
 const created=await createCommunicationDraftCommand({userId,workFileId,channel:'email',subject,body,toText:to,ccText:cc,sourceEmailId:sourceId,idempotencyKey:key});
 const [communication]=row(await db.execute(sql`SELECT * FROM como_next_communications WHERE id=${created.id} AND user_id=${userId} AND work_file_id=${workFileId}`));
 const [ledger]=row(await db.execute(sql`SELECT * FROM como_mailbox_draft_ledger WHERE communication_id=${created.id} AND draft_key=${key}`));
 if(!communication?.external_message_ref||ledger?.state!=='draft_saved'||!ledger.draft_uid||ledger.draft_folder!=='Drafts')throw Error('saved_draft_not_proven');
 const live=await fetchEmailByUID(Number(ledger.draft_uid),undefined,'Drafts');
 if(!live||env(live.to)!==env(to)||env(live.cc)!==env(cc)||norm(live.subject)!==subject||norm(live.textBody)!==body||live.messageId!==ledger.message_id)throw Error('live_draft_content_mismatch');
 const verifyBatch=await fetchReadonlyFolderSince('Drafts',24,250);
 const observed=verifyBatch.messages.find((m:any)=>Number(m.uid)===Number(ledger.draft_uid));
 const h=(name:string)=>{const value=observed?.headers?.[name];return (Array.isArray(value)?value.join(' '):String(value||'')).trim();};
 if(!observed||h('in-reply-to')!==expectedSourceId||!h('references').includes(expectedSourceId)||h('x-como-draft-key')!==key)throw Error('live_thread_headers_mismatch');
 const beforePayment=row(await db.execute(sql`SELECT * FROM como_next_lifecycle_lanes WHERE user_id=${userId} AND work_file_id=${workFileId} AND kind='payment'`));
 const [priorAction]=row(await db.execute(sql`SELECT * FROM como_next_actions WHERE id=1320001 AND user_id=${userId} AND work_file_id=${workFileId}`));
 const description=`الملاحظات الرسمية على جدوى ماجان جاهزة في ${communication.external_message_ref}، المراسلة#${created.id}، رد على رسالة كولييرز#${sourceId}. تتضمن أساس البناء485.41–539.35مليون، قيمة الأرض، فروق الإيجارات، صافي التشغيل، الجدوى المستقلة، وافتراضات التمويل الإسلامي. المطلوب من المالك مراجعة النص وإرساله من بريده إن أراد. لا انتظار لرد قبل الإرسال الفعلي، ولا سداد أو اعتماد للاستثمار.`;
 let nextActionId:number;
 if(priorAction&&priorAction.owner_type==='human'&&['open','in_progress'].includes(priorAction.action_status))nextActionId=Number(priorAction.id);
 else {const action=await createActionCommand({userId,workFileId,title:'ماجان — مراجعة وإرسال مسودة ملاحظات الجدوى إلى كولييرز',description,acceptanceCriteria:'إرسال المالك الفعلي من COMO أو قراره بتعديل أو إلغاء المسودة؛ لا يعد حفظها إرسالًا أو اعتمادًا للتقرير.',ownerType:'human',priority:'important',actorType:'manus',actorUserId:null,idempotencyKey:`${key}:owner-review`});nextActionId=Number(action.id);}
 await db.transaction(async tx=>{
  await tx.execute(sql`SELECT id FROM como_next_work_files WHERE id=${workFileId} AND user_id=${userId} FOR UPDATE`);
  const [receipt]=row(await tx.execute(sql`SELECT id FROM como_next_work_memory WHERE work_file_id=${workFileId} AND source_system='owner_instruction' AND source_record_id=${key} LIMIT 1`));
  if(!receipt){
   await tx.execute(sql`INSERT INTO como_next_work_memory (project_id,work_file_id,memory_type,entry_type,title,body,source_status,source_system,source_record_id,is_current,occurred_at) VALUES (${projectId},${workFileId},'note','mailbox_draft_result','ماجان — ملاحظات جدوى المشروع جاهزة في المسودات',${`${description}\nمصدر الإذن: ${evidence}\nالمستلم:${to}؛ نسخة:${cc}. رابط الخيط:${expectedSourceId}. حفظت فقط ولم ترسل. فاتورة كولييرز المسددة والتقرير المستلم مستقلان ولم يتغيرا.\n\nالنص المحفوظ:\n${body}`},'reviewed','owner_instruction',${key},1,UTC_TIMESTAMP())`);
   if(nextActionId===Number(priorAction?.id))await tx.execute(sql`UPDATE como_next_actions SET title='ماجان — مراجعة وإرسال مسودة ملاحظات الجدوى إلى كولييرز',description=${description},acceptance_criteria='إرسال المالك الفعلي من COMO أو قراره بتعديل أو إلغاء المسودة؛ حفظها ليس إرسالًا أو قبولًا للتقرير.' WHERE id=${nextActionId} AND work_file_id=${workFileId} AND owner_type='human' AND action_status IN ('open','in_progress')`);
   await tx.execute(sql`UPDATE como_next_work_files SET title='ماجان — كولييرز: ملاحظات الجدوى جاهزة للمراجعة',governing_question='هل تستند دراسة جدوى ماجان إلى أسس مساحة وتكلفة وتأجير ودخل قابلة للتبرير، وما التصحيحات المطلوبة؟',desired_outcome=${description},updated_at=UTC_TIMESTAMP() WHERE id=${workFileId} AND user_id=${userId}`);
   await appendEvent(tx,{userId,projectId,workFileId,actionId:nextActionId,actorType:'manus',actorUserId:null,eventType:'feasibility_comments_draft_saved',summary:`ماجان — حفظت ملاحظات الجدوى في ${communication.external_message_ref} بخيط كولييرز الأصلي؛ مراجعة واحدة للمالك، لا إرسال أو تغيير للسداد.`,payload:{communicationId:created.id,sourceEmailId:sourceId,sourceMessageId:expectedSourceId,mailboxDraftRef:communication.external_message_ref,nextActionId,evidenceReference:evidence,bodySha256:digest(body),previousOwnerReview:priorAction||null,sent:false,paymentChanged:false,financialScenariosChanged:false,externalFollowupStarted:false},idempotencyKey:`${key}:result`});
  }
 });
 const afterPayment=row(await db.execute(sql`SELECT * FROM como_next_lifecycle_lanes WHERE user_id=${userId} AND work_file_id=${workFileId} AND kind='payment'`));
 if(JSON.stringify(beforePayment)!==JSON.stringify(afterPayment))throw Error('payment_lane_changed');
 const sara=await readExecutiveWorkFile({memberId:'abdulrahman',nameAr:'عبد الرحمن',role:'owner'},JSON.stringify({work_file_id:workFileId,focus:'communications'}));
 fs.writeFileSync(`${root}/feasibility-comments-sara-state.json`,JSON.stringify(sara,null,2));
 fs.writeFileSync(`${root}/Colliers_Feasibility_Comments_Mailbox_Copy_EN.md`,`# Majan — Colliers Feasibility Comments\n\n**To:** ${to}\n\n**CC:** ${cc}\n\n**Subject:** ${subject}\n\n**Status:** Saved to ${communication.external_message_ref}; not sent.\n\n---\n\n${body}\n`);
 fs.writeFileSync(`${root}/feasibility-comments-live-draft.json`,JSON.stringify({...live,headers:observed.headers},null,2));
 const result={communicationId:Number(created.id),mailboxDraftRef:communication.external_message_ref,uid:Number(ledger.draft_uid),folder:ledger.draft_folder,nextActionId,sourceEmailId:sourceId,to,cc,subject,bodySha256:digest(body),threadHeadersVerified:true,paymentLaneUnchanged:true,externalFollowupStarted:false,sent:false,checkedAt:new Date().toISOString()};
 fs.writeFileSync(`${root}/feasibility-comments-saved.json`,JSON.stringify(result,null,2));
 console.log(JSON.stringify(result,null,2));
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1)});
