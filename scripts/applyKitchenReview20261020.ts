import fs from 'node:fs';
import { createHash } from 'node:crypto';
import Imap from 'imap';
import { sql } from 'drizzle-orm';
import { getDb } from '../server/db';
import { appendEvent, createActionCommand, createCommunicationDraftCommand } from '../server/services/comoNextCommands';
import { confirmSentLineageObservation } from '../server/services/comoMailboxDraftLedger';
import { fetchEmailByUID } from '../server/emailMonitor';
import { storagePut } from '../server/storage';
import { readExecutiveWorkFile } from '../server/services/saraWorkFileReader';
const root='/home/ubuntu/reports/como-kitchen-apply-2026-10-20';
const key='owner-kitchen-review:20261020';
const rows=(r:any):any[]=>Array.isArray(r?.[0])?r[0]:r;
const sha=(v:string|Buffer)=>createHash('sha256').update(v).digest('hex');
const read=(p:string)=>fs.readFileSync(root+'/'+p,'utf8');
const norm=(s:any)=>String(s||'').replace(/\r\n?/g,'\n').trim();
const addresses=(s:any)=>Array.from(new Set((String(s||'').toLowerCase().match(/[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+/g)||[]) as string[])).sort().join(',');
const approvedIds=[570002,630001,900001,1230001,1560003,1740001,1740002,1800001,1830001,1890001,2010001,2040001];
const files=[390001,540001,570001,480001,60017,630001];
async function archive960(db:any){
 const ledger=rows(await db.execute(sql`SELECT * FROM como_mailbox_draft_ledger WHERE communication_id=2790001`))[0];
 if(!ledger||Number(ledger.draft_uid)!==960)throw Error('unexpected_cancelled_draft_identity');
 if(ledger.state==='sent_confirmed')return {state:'already_sent_not_recalled',mailboxChanged:false};
 const cachePath=root+'/cancelled-draft-960-before.json';
 const live=await fetchEmailByUID(960,undefined,'Drafts');
 if(!live){return {state:'not_present_no_recreation',mailboxChanged:false};}
 const communication=rows(await db.execute(sql`SELECT body,to_text,cc_text FROM como_next_communications WHERE id=2790001`))[0];
 if(norm(live.textBody)!==norm(communication.body)||addresses(live.to)!==addresses(communication.to_text)||addresses(live.cc)!==addresses(communication.cc_text))throw Error('cancelled_draft_changed_no_move');
 fs.writeFileSync(cachePath,JSON.stringify(live,null,2)+'\n');
 await new Promise<void>((resolve,reject)=>{
  const imap=new Imap({user:process.env.EMAIL_USER||'a.zaqout@comodevelopments.com',password:process.env.EMAIL_PASSWORD||'',host:process.env.EMAIL_HOST||'mail.privateemail.com',port:993,tls:true,tlsOptions:{rejectUnauthorized:false},connTimeout:15000,authTimeout:10000});
  let ended=false;const timer=setTimeout(()=>finish(Error('archive_draft_deadline')),30000);
  const finish=(e?:Error|null)=>{if(ended)return;ended=true;clearTimeout(timer);try{imap.destroy();}catch{} e?reject(e):resolve();};
  imap.once('error',finish);imap.once('ready',()=>{if(!imap.serverSupports('MOVE'))return finish(Error('atomic_move_not_supported'));imap.openBox('Drafts',false,e=>e?finish(e):imap.move(960,'Archive',finish));});imap.connect();
 });
 return {state:'moved_to_archive',mailboxChanged:true};
}
async function main(){
 const db=await getDb();if(!db)throw Error('قاعدة COMO غير متاحة');fs.mkdirSync(root,{recursive:true});
 const q=async(s:any)=>rows(await db.execute(s));
 const done=await q(sql`SELECT id FROM como_next_work_file_events WHERE idempotency_key=${key+':completed'}`);
 if(done.length){console.log('مكتمل بالفعل؛ لا إعادة لأي تعديل أو مسودة.');return;}
 const pre={actions:await q(sql`SELECT * FROM como_next_actions WHERE user_id=1 ORDER BY id`),payments:await q(sql`SELECT * FROM como_next_lifecycle_lanes WHERE kind='payment' ORDER BY id`),pending:await q(sql`SELECT * FROM como_next_staged_directives WHERE status='pending' AND source_member_id<>'system:manus-action' ORDER BY id`),closed:await q(sql`SELECT * FROM como_next_work_files WHERE work_file_status IN('closed','cancelled') ORDER BY id`),scenarios:await q(sql`SELECT * FROM cf_scenarios ORDER BY id`),excludedCommunications:await q(sql`SELECT * FROM como_next_communications WHERE id IN(2490001,2910001) ORDER BY id`)};
 const prePath=root+'/application-before.json';if(!fs.existsSync(prePath))fs.writeFileSync(prePath,JSON.stringify(pre,null,2)+'\n');
 // This task deliberately uses cached COMO evidence for Colliers/NEB, not another mailbox search.
 for(const [draftId,sentId,uid] of [[2610001,2640001,224],[2730001,2850001,226]]){
  const comms=await q(sql`SELECT * FROM como_next_communications WHERE id IN(${draftId},${sentId}) ORDER BY id`);
  const d=comms.find(c=>Number(c.id)===draftId),s=comms.find(c=>Number(c.id)===sentId);
  if(!d||!s||s.communication_status!=='sent'||Number(d.work_file_id)!==Number(s.work_file_id)||norm(d.body)!==norm(s.body)||addresses(d.to_text)!==addresses(s.to_text)||addresses(d.cc_text)!==addresses(s.cc_text)||!String(s.evidence_reference).includes('UID='+uid+';'))throw Error('cached_sent_identity_mismatch:'+draftId);
 }
 console.log('الأدلة المحفوظة مطابقة؛ تجهيز نتائج NEB والمنزل الذكي.');
 const productFiles=[{file:480001,path:'NEB_Final_Recommendation_AR.md',title:'ماجان — تقييم متخصصي NEB والتوصية المكتملة'},{file:390001,path:'smart-home/01-arabic-smart-home-review.md',title:'الفلل الأربع — تصور احتياجات المنزل الذكي'},{file:390001,path:'smart-home/02-message-to-wael-EN.md',title:'الفلل الأربع — رسالة تصور المنزل الذكي لوائل'}];
 const stored:any[]=[];
 for(const product of productFiles){
  const bytes=Buffer.from(read(product.path));const hash=sha(bytes);
  const existing=await q(sql`SELECT * FROM como_next_documents WHERE source_system='owner_kitchen_review' AND source_key=${key+':'+product.path}`);
  const asset=existing[0]?{key:existing[0].storage_key,url:existing[0].storage_url}:await storagePut(`como/kitchen-review-20261020/${hash.slice(0,16)}-${product.path.split('/').pop()}`,bytes,'text/markdown');
  stored.push({...product,bytes:bytes.length,hash,storageKey:asset.key,storageUrl:asset.url});
 }
 const archive=await archive960(db);fs.writeFileSync(root+'/cancelled-draft-960-result.json',JSON.stringify(archive,null,2)+'\n');console.log('حالة المسودة الملغاة:',archive.state);
 const smartSource=read('smart-home/02-message-to-wael-EN.md');
 const body=smartSource.slice(smartSource.indexOf('Dear Wael,')).trim()+`\nAbdalrahman Zaqout\nDevelopment Director\nCOMO Real Estate Development L.L.C\nM: +971 55 106 2668\nE: a.zaqout@comodevelopments.com`;
 const smart:any=await createCommunicationDraftCommand({userId:1,workFileId:390001,channel:'email',subject:'Four Nad Al Sheba Villas — Proposed Smart-Home Requirements',body,toText:'wael@zooma.ae',ccText:'',idempotencyKey:key+':smart-home-draft'});
 const smartLedger=(await q(sql`SELECT * FROM como_mailbox_draft_ledger WHERE communication_id=${smart.id}`))[0];
 if(!smartLedger||smartLedger.state!=='draft_saved'||smartLedger.draft_folder!=='Drafts')throw Error('smart_home_draft_not_confirmed');
 const smartLive=await fetchEmailByUID(Number(smartLedger.draft_uid),undefined,'Drafts');
 if(!smartLive||norm(smartLive.textBody)!==norm(body)||addresses(smartLive.to)!=='wael@zooma.ae'||addresses(smartLive.cc)!=='')throw Error('smart_home_draft_live_mismatch');
 fs.writeFileSync(root+'/smart-home/live-draft.json',JSON.stringify(smartLive,null,2)+'\n');
 const smartAction=await createActionCommand({userId:1,workFileId:390001,title:'الفلل الأربع — عبد الرحمن: مراجعة وإرسال تصور المنزل الذكي لوائل',description:`COMO Drafts UID ${smartLedger.draft_uid} إلى وائل فقط. التصور ثلاثة مستويات؛ العرض لفيلا أخرى مرجع خدمات فقط، لا أسعار أو كميات معتمدة. لم تُرسل الرسالة؛ لا يبدأ انتظار اختيار وائل من المسودة.`,acceptanceCriteria:'يراجع عبد الرحمن التصور ويرسله من COMO؛ بعدها فقط ينتظر اختيار وائل دون تواصل مع الشركات الآن.',ownerType:'human',priority:'normal',idempotencyKey:key+':smart-home-review',actorType:'manus'});
 const ownerStatement=read('../como-kitchen-review-2026-10-20/deferred-changes.md');
 const statements:Record<number,string>={
  390001:`الفلل الأربع — بحسب إفادة عبد الرحمن20أكتوبر: وائل اجتمع بالشيخ عيسى ويجمع التوجه الجديد. أُوقفت مطالبات ومراجعات المخططات الحالية وجُمعت في انتظار واحد لوائل. أرتك لم تُبلّغ بالمستجدات، ولا تعليمات جديدة لها. Rawan مكلّفة رسميًا بإفادة عبد الرحمن، ولن تبدأ قبل تثبيت الطلبات وتصحيحها مع أرتك؛ شمول اللاندسكيب غير محسوم.\nمتابعة دفعة أرتك5586 واحدة مع شاهد ونسرين دون إعادة موافقة وائل أو طلب مستندات/صرف. شكر شاهد أُرسل بإفادة عبد الرحمن؛ لا إثبات سداد. المسح والتربة والحمل الكهربائي باقيان مستقلين.\nتصور المنزل الذكي أُنجز؛ مسودة COMO UID ${smartLedger.draft_uid} إلى وائل جاهزة لمراجعة عبد الرحمن، لم تُرسل. لا عروض شركات أو تسعير/أجهزة على المخططات القديمة.`,
  60017:'ماجان — طلب موعد التصحيح أُرسل16أكتوبر، COMO Sent224؛ انتهت مطالبة الإرسال. يبقى انتظار نتائج كولييرز والرد النقطي والتقرير وExcel المصححين، ويتولى Manus متابعة التأخر. اجتماع الفهم قبل نقاش الشيخ عيسى لاحقًا دون موعد أو حجز جديد. فاتورة7314002290 تظل paid_owner_reported بإفادة سابقة فقط؛ لا سداد جديد.',
  570001:'ماجان — تقرير البدائل أُنجز وراجعه عبد الرحمن وأرسله إلى وائل؛ وائل قال «تمام هذا هو المطلوب» وأرسله للشيخ عيسى وفق الإفادة والتسجيل المرفقين. انتهت مراجعة التقرير، لا إعادة إعداد أو مطالبة أخرى. لم يُحسم المول أو البديل السكني. الخطوة التالية فهم نتائج كولييرز ثم تحديد التوجه مع الشيخ عيسى دون اجتماع محجوز أو دراسة جديدة.',
  480001:'ماجان — أُرسل شكر NEB في الصادر226 بإفادة عبد الرحمن ودليل COMO المحفوظ. استكمل Manus تقييم مرشحي التخصصات ومراجع NEB والتوصية: أفضلية مبدئية مشروطة للخيارA عند الرغبة ببصمة تصميم مستقلة؛ الخيارB بديل موحد يحتاج إثبات الفريق والنطاق. أتعابA ليست كلفة المسار كاملة دون مصمم الكونسبت المنفصل. القرار ينتظر نتائج كولييرز وتحديد التوجه. لا تعيين أو تفاوض أو مراسلة أو بدء؛ الحزمة60014 وسقف11مليون يظلان ملغيين.',
  540001:'المشاريع — وثائق الأراضي الموجودة فُحصت وحُفظت. المتبقي بيان نسرين لرسوم الخدمات: هل سُددت، إلى أي تاريخ، وما المتبقي؟ وصول وثائق الأرض لا يثبت السداد. يتولى Manus فحص البيان عند وصوله. بند عبد الرحمن ومسودة954 لاستكمال وثائق الأراضي والرسوم يبقيان كما هما دون تعديل أو إرسال.'
 };
 await db.transaction(async tx=>{
  const tq=async(s:any)=>rows(await tx.execute(s));
  for(const id of files)await tx.execute(sql`SELECT id FROM como_next_work_files WHERE id=${id} FOR UPDATE`);
  if((await tq(sql`SELECT id FROM como_next_work_file_events WHERE idempotency_key=${key+':completed'} FOR UPDATE`)).length)throw Error('already_applied_concurrently');
  const fresh=await tq(sql`SELECT * FROM como_next_actions WHERE user_id=1 ORDER BY id`);
  for(const old of pre.actions.filter(a=>approvedIds.includes(Number(a.id)))){
   const current=fresh.find(a=>Number(a.id)===Number(old.id));if(JSON.stringify(current)!==JSON.stringify(old))throw Error('action_changed_during_preflight:'+old.id);
  }
  async function event(file:number,action:number|null,eventType:string,summary:string,payload:Record<string,string|number|boolean|null>={}){
   const f=(await tq(sql`SELECT project_id FROM como_next_work_files WHERE id=${file}`))[0];
   await appendEvent(tx,{userId:1,projectId:Number(f.project_id),workFileId:file,actionId:action,actorType:'manus',actorUserId:null,eventType,summary,payload:{...payload,source:'عبد الرحمن: مراجعة20أكتوبر2026',externalSideEffect:false},idempotencyKey:`${key}:${eventType}:${action??file}`});
  }
  async function memory(file:number,type:string,title:string,bodyText:string,source:string,status='completed'){
   const f=(await tq(sql`SELECT project_id FROM como_next_work_files WHERE id=${file}`))[0];
   await tx.execute(sql`INSERT INTO como_next_work_memory(project_id,work_file_id,memory_type,entry_type,title,body,source_status,is_current,source_system,source_record_id,occurred_at) VALUES(${f.project_id},${file},${type==='work_product'?'work_product':'note'},${type},${title},${bodyText},${status},1,'owner_kitchen_review',${key+':'+source},UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE source_record_id=VALUES(source_record_id)`);
   return (await tq(sql`SELECT id FROM como_next_work_memory WHERE source_system='owner_kitchen_review' AND source_record_id=${key+':'+source}`))[0].id;
  }
  async function closeAction(id:number,status:'verified'|'cancelled',why:string){
   const a=fresh.find(x=>Number(x.id)===id);if(!a)throw Error('missing_action:'+id);
   await tx.execute(sql`UPDATE como_next_actions SET action_status=${status},description=CONCAT(COALESCE(description,''),${'\n20أكتوبر: '+why}),evidence_reference=${'توجيه عبد الرحمن20أكتوبر؛ '+why},completed_at=UTC_TIMESTAMP(),verified_at=${status==='verified'?new Date().toISOString().slice(0,19).replace('T',' '):null} WHERE id=${id}`);
   await event(Number(a.work_file_id),id,'owner_kitchen_action_resolved',why);
  }
  await closeAction(1740001,'verified','طلب كولييرز أُرسل16أكتوبر، الصادر224؛ لا إعادة إرسال.');
  await closeAction(1230001,'verified','التقرير وصل لوائل ولبّى الطلب ثم أرسله للشيخ عيسى وفق إفادة عبد الرحمن وتسجيل وائل؛ لا اعتماد استثمار.');
  await closeAction(570002,'verified','تكليف Rawan حُسم بإفادة عبد الرحمن فقط؛ بدء العمل ينتظر تثبيت الطلبات وتصحيحها مع أرتك.');
  await closeAction(1890001,'cancelled','إلغاء مطالبة إرسال رد استكمال مخططات المسار القديم؛ لا إخطار لأرتك.');
  await closeAction(2010001,'verified','عبد الرحمن أفاد بإرسال شكر شاهد؛ لا إعادة رسالة ولا إثبات سداد.');
  await closeAction(1800001,'verified','شكر NEB أُرسل؛ Manus استكمل تقييم المتخصصين والمراجع والتوصية، والحسم ينتظر توجه ماجان.');
  await closeAction(630001,'verified',`استُبدل اختيار الشركات/لقاءاتها أولًا بتصور احتياجات مكتمل ومسودة${smartLedger.draft_uid} لوائل؛ لا تواصل مع شركات.`);
  await tx.execute(sql`UPDATE como_next_actions SET title='الفلل الأربع — بانتظار وائل لتحديد التعديلات والتوجّه الجديد',description=${statements[390001]},acceptance_criteria='يصل توضيح وائل للتوجه والتعليمات المطلوبة؛ عندئذ يحدد عبد الرحمن الطلبات لأرتك. Rawan لا تبدأ قبل التصحيح؛ لا مطالبات على المسار القديم.',owner_type='manus',owner_user_id=NULL,waiting_project_party_id=NULL,action_status='waiting_external',due_at=NULL,follow_up_at=NULL,attention_at=NULL,evidence_reference='إفادة عبد الرحمن20أكتوبر؛ لا قرار تصميم نهائي' WHERE id=1830001`);
  await event(390001,1830001,'villa_direction_wait_consolidated','انتظار واحد لوائل بدل مطالبات المخططات القديمة؛ بدء Rawan مشروط.');
  await tx.execute(sql`UPDATE como_next_actions SET title='الفلل الأربع — متابعة تأكيد تنفيذ دفعة أرتك5586 مع شاهد ونسرين',description='طلب الدفعة أُرسل لشاهد مع نسرين نسخة بإفادة عبد الرحمن؛ موافقة وائل تمت ولا حاجة لإقحامه مجددًا. الوثائق وصلت وفُحصت. لا طلب صرف أو مستندات جديد؛ شكر شاهد مرسل بإفادة عبد الرحمن. ننتظر تأكيد تنفيذ الدفع، ولم يثبت السداد.',acceptance_criteria='ورود تأكيد تنفيذ الدفعة أو دليلها من المالية وفحصه. إرسال الطلب والموافقة لا يثبتان السداد.',owner_type='manus',owner_user_id=NULL,action_status='waiting_external',evidence_reference='إفادة عبد الرحمن20أكتوبر19:17؛ شاهد إلى، نسرين نسخة، دون وائل لهذه المتابعة فقط' WHERE id=900001`);
  await tx.execute(sql`UPDATE como_next_lifecycle_lanes SET next_action_id=900001,next_action_title='متابعة تأكيد تنفيذ دفعة أرتك5586 مع شاهد ونسرين',next_owner_type='manus' WHERE work_file_id=390001 AND lane_key='payment:5586'`);
  await event(390001,900001,'artec_payment_followup_consolidated','متابعة مالية واحدة مع شاهد ونسرين؛ لا إعادة موافقة وائل ولا تغيير سداد.');
  await tx.execute(sql`UPDATE como_next_actions SET title='المشاريع — انتظار بيان نسرين لرسوم الخدمات والفترة المغطاة',description=${statements[540001]},acceptance_criteria='ورود بيان رسوم الخدمات ثم فحص السداد والفترة المغطاة والمتبقي؛ الوثائق الحالية ليست إثبات سداد.',owner_type='manus',owner_user_id=NULL,action_status='waiting_external',due_at=NULL,follow_up_at=NULL,attention_at=NULL WHERE id=1560003`);
  await event(540001,1560003,'land_documents_review_separated','المراجعة السابقة منجزة؛ المتبقي بيان الرسوم، وبند عبد الرحمن ومسودة954 كما هما.');
  await tx.execute(sql`UPDATE como_next_actions SET title='السطوة — بانتظار عبد الرحمن لتحديد تبعية المشروع قبل الربط',description='الربط مسؤولية Manus لكنه متوقف على توضيح دور COMO وتبعية السطوة. بند عبد الرحمن2070001 والمطالبة ومسودة962 كما هي. لا ربط بماجان أو الفلل ولا قبول مطالبة.',owner_type='manus',owner_user_id=NULL,action_status='waiting_external',due_at=NULL,follow_up_at=NULL,attention_at=NULL WHERE id=2040001`);
  await event(630001,2040001,'satwa_linkage_dependency_recorded','ربط السطوة ينتظر التبعية؛ لا تغيير المطالبة أو مسودتها.');
  await tx.execute(sql`UPDATE como_next_actions SET description=CONCAT(COALESCE(description,''),'\n20أكتوبر: طلب الموعد مرسل منذ16أكتوبر، وليس على عبد الرحمن إرساله. Manus يتابع الرد النقطي وExcel والتقرير المصححين؛ ثم فهم الأرقام مع كولييرز قبل نقاش الشيخ عيسى، دون حجز أو مهلة مخترعة.') WHERE id=1740002`);
  const cancelled=[2160001,2160002,2250001,2250002,2310001,2310002,2340001,2340002];
  const merged=[1980001,2040001,2070001,2100001,2100002,2130001,2190001,2220001,2280001,2370001];
  for(const id of [...cancelled,...merged])await tx.execute(sql`UPDATE como_next_intake_proposals SET review_status='dismissed',review_note=${cancelled.includes(id)?'قرار عبد الرحمن20أكتوبر: وقف مسار المخططات الحالي؛ جُمعت الحالة في انتظار واحد لوائل. المصدر محفوظ.':'مصالحة عبد الرحمن20أكتوبر: المخرج منجز أو الحالة محفوظة في الإجراء القائم؛ لا مهمة/بطاقة مكررة.'},reviewed_by_user_id=1,reviewed_at=UTC_TIMESTAMP() WHERE id=${id} AND user_id=1 AND review_status='pending'`);
  await memory(630001,'cancelled_kitchen_suggestion','المشاريع — إلغاء الخطوة العامة لكشف الحساب وجدول السداد','إلغاء الخطوة المقترحة في البريد2010001 فقط بقرار عبد الرحمن18:58. لا رفض للمطالبة ولا إلغاء للفاتورة أو المصدر، ولا تنسيق مالي أو وعد أو جدول سداد.','cancelled-general-step','cancelled');
  await tx.execute(sql`UPDATE como_next_work_memory SET source_record_id='cancelled-kitchen-email:2010001' WHERE source_system='owner_kitchen_review' AND source_record_id=${key+':cancelled-general-step'}`);
  for(const [id,sentId,actionId] of [[2610001,2640001,1740001],[2730001,2850001,1800001]]){
   const sent=(await tq(sql`SELECT * FROM como_next_communications WHERE id=${sentId}`))[0];
   await tx.execute(sql`UPDATE como_next_communications SET communication_status='sent',evidence_reference=${sent.evidence_reference},external_message_ref=${sent.external_message_ref},sent_at=${sent.sent_at},occurred_at=${sent.occurred_at},review_note='إرسال عبد الرحمن مثبت بالصادر المحفوظ؛ لا إعادة إرسال أو إنشاء مسودة.' WHERE id=${id}`);
   await event(Number(sent.work_file_id),actionId,'cached_sent_reconciled','مصدر COMO المحفوظ يؤكد الإرسال؛ تمت إزالة المطالبة المنتهية.',{communicationId:id,sentCommunicationId:sentId});
  }
  await tx.execute(sql`UPDATE como_next_communications SET communication_status='sent',review_note='إرسال شكر شاهد بإفادة عبد الرحمن20أكتوبر؛ لا ادعاء UID صادر أو توقيت إرسال متحقق منه.',evidence_reference='إفادة عبد الرحمن20أكتوبر18:56: الشكر أُرسل بالفعل' WHERE id=2880003`);
  await tx.execute(sql`UPDATE como_mailbox_draft_ledger SET state='human_review',review_reason='owner_reports_sent_20261020_no_recreation_await_exact_lineage' WHERE communication_id=2880003 AND state<>'sent_confirmed'`);
  await event(390001,2010001,'owner_reported_sent_recorded','شكر شاهد مرسل بإفادة عبد الرحمن؛ لا إعادة ولا سداد.',{communicationId:2880003,ownerReported:true,sentUidVerified:false});
  await tx.execute(sql`UPDATE como_next_communications SET communication_status='cancelled',review_note='قرار عبد الرحمن20أكتوبر: المسار القديم متوقف؛ المسودة960 ملغاة ولا يعاد إنشاؤها.',evidence_reference=${'إلغاء مخططات المسار القديم؛ حالة البريد:'+archive.state} WHERE id=2790001 AND communication_status<>'sent'`);
  await tx.execute(sql`UPDATE como_mailbox_draft_ledger SET state='human_review',review_reason='owner_cancelled_20261020_old_villa_direction_no_replay' WHERE communication_id=2790001 AND state<>'sent_confirmed'`);
  for(const [file,statement] of Object.entries(statements)){
   await memory(Number(file),'owner_review_current_state','حالة '+(Number(file)===390001?'الفلل الأربع':Number(file)===540001?'المشاريع':'ماجان')+' بعد مراجعة20أكتوبر',statement,'state:'+file);
   await tx.execute(sql`UPDATE como_next_work_files SET desired_outcome=${statement} WHERE id=${Number(file)} AND work_file_status NOT IN('closed','cancelled')`);
  }
  await memory(390001,'owner_statement','قرارات عبد الرحمن لمراجعة المطبخ — كاملة',ownerStatement,'approved-statements','owner_reported');
  for(const item of stored){
   const memId=await memory(item.file,'work_product',item.title,read(item.path),'product:'+item.path);
   await tx.execute(sql`INSERT INTO como_next_documents(title,file_name,mime_type,byte_size,sha256,storage_key,storage_url,source_system,source_key) VALUES(${item.title},${item.path.split('/').pop()},'text/markdown',${item.bytes},${item.hash},${item.storageKey},${item.storageUrl},'owner_kitchen_review',${key+':'+item.path}) ON DUPLICATE KEY UPDATE source_key=VALUES(source_key)`);
   const doc=(await tq(sql`SELECT id FROM como_next_documents WHERE source_system='owner_kitchen_review' AND source_key=${key+':'+item.path}`))[0];
   const f=(await tq(sql`SELECT project_id FROM como_next_work_files WHERE id=${item.file}`))[0];
   await tx.execute(sql`INSERT INTO como_next_work_memory_documents(project_id,work_file_id,memory_id,document_id,relation_type,source_system,source_record_id) VALUES(${f.project_id},${item.file},${memId},${doc.id},'evidence','owner_kitchen_review',${key+':doc-link:'+item.path}) ON DUPLICATE KEY UPDATE source_record_id=VALUES(source_record_id)`);
   item.documentId=Number(doc.id);item.memoryId=Number(memId);
  }
  let rawan=(await tq(sql`SELECT id FROM como_next_parties WHERE user_id=1 AND source_system='owner_kitchen_review' AND source_record_id=${key+':rawan'}`))[0];
  if(!rawan){await tx.execute(sql`INSERT INTO como_next_parties(user_id,party_type,display_name,party_status,source_system,source_record_id) VALUES(1,'person','Rawan','active','owner_kitchen_review',${key+':rawan'})`);rawan=(await tq(sql`SELECT id FROM como_next_parties WHERE source_system='owner_kitchen_review' AND source_record_id=${key+':rawan'}`))[0];}
  await tx.execute(sql`INSERT INTO como_next_project_parties(project_id,party_id,role_code,relationship_status,source_system,source_record_id) VALUES(6,${rawan.id},'appointed_designer_scope_pending','active','owner_kitchen_review',${key+':rawan-project'}) ON DUPLICATE KEY UPDATE source_record_id=VALUES(source_record_id)`);
  await event(390001,570002,'rawan_assignment_owner_reported','سُجل التكليف الرسمي بإفادة عبد الرحمن فقط؛ بدء العمل ونطاق اللاندسكيب غير محسومين.',{partyId:Number(rawan.id),ownerReported:true,workStarted:false});
  await event(480001,1800001,'neb_analysis_completed','تقييم متخصصي NEB والمراجع والتوصية اكتملت وحُفظت؛ قرار التوجه مؤجل دون بدء أو تفاوض.',{documentId:stored[0].documentId,greenlight:false});
  await event(390001,Number(smartAction.id),'smart_home_brief_draft_ready',`تصور المنزل الذكي مكتمل، المسودة${smartLedger.draft_uid} إلى وائل جاهزة ولم تُرسل.`,{communicationId:Number(smart.id),draftUid:Number(smartLedger.draft_uid),actionId:Number(smartAction.id),sent:false});
  await appendEvent(tx,{userId:1,projectId:6,workFileId:390001,actorType:'manus',actorUserId:null,eventType:'owner_kitchen_review_applied',summary:'تطبيق قرارات المطبخ المعتمدة20أكتوبر كاملة؛ فصل السداد والمخططات وحفظ البنود المستثناة.',payload:{smartDraftUid:Number(smartLedger.draft_uid),allDecisionsApplied:true,sent:false,paymentStatusChanged:false},idempotencyKey:key+':completed'});
 });
 for(const [communicationId,uid] of [[2610001,224],[2730001,226]]){const l=(await q(sql`SELECT id FROM como_mailbox_draft_ledger WHERE communication_id=${communicationId}`))[0];await confirmSentLineageObservation({ledgerId:Number(l.id),folder:'Sent',uid});}
 const after={actions:await q(sql`SELECT * FROM como_next_actions WHERE user_id=1 ORDER BY id`),payments:await q(sql`SELECT * FROM como_next_lifecycle_lanes WHERE kind='payment' ORDER BY id`),pending:await q(sql`SELECT * FROM como_next_staged_directives WHERE status='pending' AND source_member_id<>'system:manus-action' ORDER BY id`),closed:await q(sql`SELECT * FROM como_next_work_files WHERE work_file_status IN('closed','cancelled') ORDER BY id`),scenarios:await q(sql`SELECT * FROM cf_scenarios ORDER BY id`),excludedCommunications:await q(sql`SELECT * FROM como_next_communications WHERE id IN(2490001,2910001) ORDER BY id`)};
 const safePay=(v:any)=>{const {next_action_title,next_action_id,next_owner_type,...rest}=v;return rest;};
 const checks={paymentBusinessStateUnchanged:JSON.stringify(pre.payments.map(safePay))===JSON.stringify(after.payments.map(safePay)),ownerPendingUnchanged:JSON.stringify(pre.pending)===JSON.stringify(after.pending),closedFilesUnchanged:JSON.stringify(pre.closed)===JSON.stringify(after.closed),financialScenariosUnchanged:JSON.stringify(pre.scenarios)===JSON.stringify(after.scenarios),excludedDraftsUnchanged:JSON.stringify(pre.excludedCommunications)===JSON.stringify(after.excludedCommunications),otherActionsUnchanged:pre.actions.filter(a=>!approvedIds.includes(Number(a.id))).every(a=>JSON.stringify(a)===JSON.stringify(after.actions.find(v=>Number(v.id)===Number(a.id))))};
 fs.writeFileSync(root+'/application-after.json',JSON.stringify(after,null,2)+'\n');
 fs.writeFileSync(root+'/application-receipt.json',JSON.stringify({observedAt:new Date().toISOString(),checks,archive,smartDraft:{communicationId:Number(smart.id),uid:Number(smartLedger.draft_uid),actionId:Number(smartAction.id),sent:false},products:stored.map(({storageUrl,...x})=>x),automaticPublish:false},null,2)+'\n');
 if(Object.values(checks).some(v=>!v))throw Error('protection_check_failed:'+JSON.stringify(checks));
 for(const file of files){const state=await readExecutiveWorkFile({memberId:'abdulrahman',nameAr:'عبد الرحمن',role:'owner'},JSON.stringify({work_file_id:file,focus:'actions'}));fs.writeFileSync(root+`/sara-${file}-after.json`,JSON.stringify(state,null,2)+'\n');}
 console.log(JSON.stringify({checks,smartDraftUid:smartLedger.draft_uid,allDecisionsApplied:true,published:false},null,2));
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});
