import fs from 'node:fs';
import Imap from 'imap';
import {sql} from 'drizzle-orm';
import {getDb} from '../server/db';
import {appendEvent,createActionCommand,createCommunicationDraftCommand} from '../server/services/comoNextCommands';
import {recordWorkFileUpdateCommand} from '../server/services/comoNextKitchen';
import {fetchEmailByUID,saveComoMailboxDraft} from '../server/emailMonitor';
const out='/home/ubuntu/reports/artec-payment-documents-2026-10-12';
const key='artec-payment-documents:invoice5586:owner-20261012-2136';
const list=['Trade Licence','VAT Registration Certificate','Bank IBAN Letter','Emirates ID of the Authorised Person'];
const body=`Dear Theodora,\n\nTo enable our finance team to process the mobilization payment for the four villas at Nad Al Sheba Gardens, Plot 6180578, kindly share copies of the following documents:\n\n1. ${list[0]}\n2. ${list[1]}\n3. ${list[2]}\n4. ${list[3]}\n\nShahid and Nasrin from our finance team are copied for coordination.\n\nThank you for your assistance.\n\nKind regards,\nAbdalrahman Zaqout\nDevelopment Director\nCOMO Real Estate Development L.L.C\nM: +971 55 106 2668\nE: a.zaqout@comodevelopments.com`;
async function main(){
 fs.mkdirSync(out,{recursive:true});const db=await getDb();if(!db)throw Error('قاعدة البيانات غير متاحة');
 const [done]:any=await db.execute(sql`SELECT id FROM como_next_work_file_events WHERE idempotency_key=${key+':completed'}`);if(done.length){console.log('Already completed; no replay');return;}
 const [before]=await db.execute(sql`SELECT id,title,description,action_status,due_at,follow_up_at,attention_at FROM como_next_actions WHERE id=840001 AND user_id=1 AND work_file_id=390001`);
 const beforePath=out+'/before.json';if(!fs.existsSync(beforePath))fs.writeFileSync(beforePath,JSON.stringify(before,null,2));
 const statement='إفادة المالك12أكتوبر2026 الساعة21:35دبي: شاهد طلب مستندات أرتك لاستكمال صرف دفعة التعبئة لفاتورة5586، مشروع الفلل الأربعة ند الشبا قطعة6180578: الرخصة التجارية، شهادة التسجيل الضريبي، خطاب الآيبان البنكي، وهوية الشخص المخول. توجيه21:36: إلى أرتك ونسخة شاهد ونسرين فقط، دون وائل. ليست وثائق الأراضي، وليست إفادة سداد أو تأكيد وصول المستندات.';
 const update=await recordWorkFileUpdateCommand({userId:1,workFileId:390001,actionId:840001,sourceChannel:'internal',occurredAt:'2026-10-12T17:36:10Z',updateText:statement,actorType:'human',actorUserId:1,idempotencyKey:key+':owner-statement'});
 const [existing]:any=await db.execute(sql`SELECT id,external_message_ref FROM como_next_communications WHERE source_record_id=${key+':draft'} AND user_id=1`);
 const draft:any=existing.length?{id:Number(existing[0].id),mailboxDraft:{folder:'Drafts',uid:Number(existing[0].external_message_ref?.match(/UID (\d+)/)?.[1])}}:await createCommunicationDraftCommand({userId:1,workFileId:390001,channel:'email',sourceEmailId:1020001,subject:'Re: 4 Villas B+G+1+R Nad Al Sheba Gardens - Invoice',toText:'tdimitrova@artecint.com',ccText:'shahid@zooma.ae, account.mrt@zooma.ae',body,idempotencyKey:key+':draft'});
 const old=await fetchEmailByUID(945,undefined,'Drafts');
 const [source]:any=await db.execute(sql`SELECT message_id FROM como_next_email_messages WHERE id=1020001 AND user_id=1`);
 const corrected=await saveComoMailboxDraft({to:'tdimitrova@artecint.com',cc:'shahid@zooma.ae, account.mrt@zooma.ae',subject:'Re: 4 Villas B+G+1+R Nad Al Sheba Gardens - Invoice',body,inReplyTo:source[0]?.message_id,draftKey:key+':no-wael',ownerWaelCcExclusion:{evidenceReference:'تحديث المالك '+update.id+'؛ توجيه21:36دبي دون وائل'},lineage:{userId:1,projectId:6,workFileId:390001,communicationId:draft.id}});
 if(!corrected.uid||corrected.observedInSent)throw Error('المسودة المصححة ليست جاهزة للمراجعة');
 if(old){
  if(old.textBody.trim()!==body.trim()||old.to!=='tdimitrova@artecint.com')throw Error('تغيرت المسودة السابقة؛ لا تحريك');
  fs.writeFileSync(out+'/superseded-945.json',JSON.stringify(old,null,2));
  await new Promise<void>((resolve,reject)=>{const imap=new Imap({user:process.env.EMAIL_USER||'a.zaqout@comodevelopments.com',password:process.env.EMAIL_PASSWORD||'',host:process.env.EMAIL_HOST||'mail.privateemail.com',port:993,tls:true,tlsOptions:{rejectUnauthorized:false},connTimeout:15000,authTimeout:10000});let done=false;const finish=(e?:Error|null)=>{if(done)return;done=true;imap.end();e?reject(e):resolve()};imap.once('error',finish);imap.once('ready',()=>{if(!imap.serverSupports('MOVE')&&!imap.serverSupports('UIDPLUS'))return finish(Error('safe_move_unavailable'));imap.openBox('Drafts',false,e=>e?finish(e):imap.move(945,'Archive',finish))});imap.connect()});
 }
 await db.execute(sql`UPDATE como_next_communications SET external_message_ref=${'Drafts UID '+corrected.uid},evidence_reference=${'Private Email Drafts UID '+corrected.uid+'؛ نسخةشاهدونسرين فقط'},review_note='استثناء صريح لهذه المراسلة: دون وائل. السابقة945 محفوظة فيArchive ولم ترسل.' WHERE id=${draft.id} AND user_id=1`);
 await db.execute(sql`UPDATE como_mailbox_draft_ledger SET state='human_review',review_reason=${'superseded_by_corrected_cc_uid_'+corrected.uid} WHERE communication_id=${draft.id} AND draft_key=${key+':draft'} AND state<>'sent_confirmed'`);
 draft.mailboxDraft={folder:corrected.folder,uid:corrected.uid};
 if(draft.mailboxDraft?.folder!=='Drafts'||!draft.mailboxDraft.uid)throw Error('لم يتحقق حفظ المسودة؛ لا يُنشأ انتظار استلام من مسودة');
 const live=await fetchEmailByUID(draft.mailboxDraft.uid,undefined,'Drafts');
 if(!live)throw Error('المسودة غير ظاهرة في صندوق COMO');
 const text=JSON.stringify(live);
 if(!text.includes('shahid@zooma.ae')||!text.includes('account.mrt@zooma.ae')||text.includes('wael@zooma.ae')||!list.every(x=>text.includes(x)))throw Error('فشل التحقق من المستلمين أو الوثائق');
 const action=await createActionCommand({userId:1,workFileId:390001,title:'مراجعة وإرسال طلب مستندات أرتك لصرف دفعة التعبئة',description:`مسودة COMO ${draft.mailboxDraft.folder} UID ${draft.mailboxDraft.uid} إلىثيودورا، نسخةشاهدونسرين فقط دون وائل. الوثائق الأربع مطلوبة وفق إفادة المالك لتمكين المالية من معالجة فاتورة5586. لم تُرسل ولم تصل المستندات ولم يثبت السداد.`,acceptanceCriteria:'يرسل المالك المسودة من صندوق COMO؛ بعد إثبات الصادر فقط يبدأ انتظار مستندات أرتك. وصول الوثائق لا يعني تنفيذ الدفع.',ownerType:'human',priority:'important',idempotencyKey:key+':review-action',actorType:'manus',actorUserId:null});
 await db.transaction(async tx=>{
  await tx.execute(sql`SELECT id FROM como_next_work_files WHERE id=390001 FOR UPDATE`);
  await tx.execute(sql`UPDATE como_next_actions SET description=CONCAT(COALESCE(description,''),${'\n'+statement}),updated_at=UTC_TIMESTAMP() WHERE id=840001 AND work_file_id=390001 AND action_status NOT IN('verified','cancelled') AND description NOT LIKE '%توجيه21:36%'`);
  await tx.execute(sql`UPDATE como_next_lifecycle_lanes SET source_text=${statement},evidence_reference=${'إفادة المالك21:35/21:36دبي؛ تحديث'+update.id+'، وفاتورة COMO1020001، وطلبوائل1080003'} WHERE user_id=1 AND work_file_id=390001 AND lane_key='payment:5586' AND status NOT LIKE 'paid%'`);
  await tx.execute(sql`INSERT INTO como_next_lifecycle_lanes (user_id,project_id,work_file_id,lane_key,kind,title,status,source_kind,evidence_reference,source_text,recorded_at,action_id,next_action_id,next_action_title,next_owner_type) VALUES (1,6,390001,${key},'deliverable','مستندات أرتك المطلوبة لصرف دفعة التعبئة','awaiting_owner_send','owner_statement',${'تحديث المالك'+update.id+'؛ مراسلة'+draft.id},${statement},UTC_TIMESTAMP(),${action.id},${action.id},'مراجعة وإرسال مسودة طلب الوثائق','human') ON DUPLICATE KEY UPDATE lane_key=VALUES(lane_key)`);
  await appendEvent(tx,{userId:1,projectId:6,workFileId:390001,actionId:action.id,actorType:'manus',actorUserId:null,eventType:'artec_payment_documents_draft_ready',summary:'الفلل الأربعة — طلب مستندات صرف أرتك جاهز في المسودات؛ نسخةشاهدونسرين فقط دون وائل. السداد غير مثبت.',payload:{updateId:update.id,communicationId:draft.id,actionId:action.id,mailboxDraft:draft.mailboxDraft,documents:list,cc:['shahid@zooma.ae','account.mrt@zooma.ae'],excludedCc:['wael@zooma.ae'],sent:false,documentsReceived:false,paid:false},idempotencyKey:key+':completed'});
 });
 const result={update,draft,action,to:'tdimitrova@artecint.com',cc:['shahid@zooma.ae','account.mrt@zooma.ae'],body,liveVerified:true,sent:false,documentsReceived:false,paid:false};
 fs.writeFileSync(out+'/result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1)});
