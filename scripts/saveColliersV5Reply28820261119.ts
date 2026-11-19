import 'dotenv/config';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {sql} from 'drizzle-orm';
import {getDb} from '../server/db';
import {requireProjectAccess,createActionCommand} from '../server/services/comoNextCommands';
import {createReplyDraftFromEmailCommand,buildReplyAllCc} from '../server/services/comoNextEmailInbox';
import {applyComoCcPolicy,fetchReadonlyFolderSince} from '../server/emailMonitor';
const root='/home/ubuntu/reports/como-directive-2880001-2026-11-19',key='email-reply-draft:4530001';
const load=(n:string)=>JSON.parse(fs.readFileSync(root+'/'+n+'.json','utf8'));
const save=(n:string,v:any)=>fs.writeFileSync(root+'/'+n+'.json',JSON.stringify(v,null,2)+'\n');
const norm=(v:any)=>String(v||'').replace(/\r\n?/g,'\n').trim();
const sha=(v:any)=>createHash('sha256').update(norm(v)).digest('hex');
const canon=(v:any)=>norm(v).replace(/^(?:(?:re|fw|fwd)\s*:\s*)+/i,'').toLowerCase();
const env=(v:any)=>[...new Set(String(v||'').toLowerCase().match(/[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}/g)||[])].sort().join(',');
async function main(){
 const db=await getDb();assert(db);await requireProjectAccess(db,1,1,'write');
 if(fs.existsSync(root+'/draft-result.json')){console.log(JSON.stringify({...load('draft-result'),replayed:true,mailboxWrite:false}));await(db as any).$client.end();return;}
 const q=async(s:any)=>(await db.execute(s))[0]as any[];
 const s=load('context').source,body=norm(fs.readFileSync(root+'/Reply_To_Colliers_EN.txt','utf8'));
 assert(s.id===4530001&&s.body_sha256==='0c39dc1c7a49caaf80800392035afe24f5d385d976e20e4ea0c1fbe7d680c8e9'&&body.endsWith('Abdalrahman Zaqout'));
 const sm=await fetchReadonlyFolderSince('Sent',24*15,100,undefined,'Majan'),dm=await fetchReadonlyFolderSince('Drafts',24*365,100,undefined,'Majan');
 assert(sm.messages.length<100&&dm.messages.length<100);
 assert(!sm.messages.some(v=>canon(v.subject)===canon(s.subject)&&Date.parse(v.date)>=Date.parse(s.received_at.replace(' ','T')+'Z')),'Already answered: do not append');
 const[old]=await q(sql`SELECT * FROM como_next_communications WHERE user_id=1 AND source_record_id=${key}`);
 const competing=dm.messages.filter(v=>canon(v.subject)===canon(s.subject));
 assert(competing.length<=1&&(!competing.length||old),'Untracked competing draft');
 if(old){assert(old.communication_status!=='cancelled'&&old.communication_status!=='sent');assert(norm(old.body)===body);}
 const made:any=await createReplyDraftFromEmailCommand({userId:1,emailId:4530001,body});save('draft-save-result',made);
 const cid=Number(made.id),[c]=await q(sql`SELECT * FROM como_next_communications WHERE id=${cid} AND user_id=1`),[l]=await q(sql`SELECT * FROM como_mailbox_draft_ledger WHERE communication_id=${cid} AND user_id=1`);
 assert(c&&l&&l.state==='draft_saved'&&l.draft_key===key&&!l.sent_uid&&norm(c.body)===body);
 const cc=applyComoCcPolicy({to:s.from_email,cc:buildReplyAllCc({fromEmail:s.from_email,toText:s.to_text,ccText:s.cc_text})||undefined});
 assert(env(c.to_text)==='abeyratne.charitha@mena.colliers.com'&&env(c.cc_text)===env(cc));
 const after=await fetchReadonlyFolderSince('Drafts',24*365,100,undefined,'Majan');assert(after.messages.length<100);
 const matches=after.messages.filter(v=>v.messageId===l.message_id||v.headers?.['x-como-draft-key']===key);assert(matches.length===1);
 const d=matches[0];assert(d.uid===l.draft_uid&&norm(d.textBody)===body&&sha(d.textBody)===l.body_sha256&&d.subject===c.subject&&canon(d.subject)===canon(s.subject)&&env(d.to)===env(c.to_text)&&env(d.cc)===env(cc)&&d.attachments.length===0&&d.headers?.['in-reply-to']===s.message_id&&String(d.headers?.references||'').includes(s.message_id));save('draft-live-proof',d);
 const card:any=await createActionCommand({userId:1,workFileId:60017,title:'ماجان — مراجعة استيضاحات تقرير كولييرزV5 والنموذج19نوفمبر',description:'المصدر4530001 سلّم تقريرV5/2880001 ونموذجxlsm/2880002؛ تمت مراجعة المرفقين. الرد المحفوظ Drafts'+l.draft_uid+'/'+cid+' إلىCharitha CCGrant/Vishrut/وائل/Nicholas بلا مرفقات، يطلب استكمال الفجوات المثبتة ومصالحة التقرير والنموذج فقط؛ لا يعيد طلب الحزمة المستلمة ولا يعتمد إيجارات أو جدوى.1032/6060001 مرسلةSent270 ولا تعاد.',acceptanceCriteria:'المالك يراجع المسودة ويرسلها إن وافق. Manus يثبتSent ثم يتابع استكمال الفجوات ومصالحة النسخة على1740002 القائمة. استلامV5 وExcel لا يعني قبول الدراسة أو إقفال جميع التعليقات. لا انتظار خارجي جديد على مسودة ولا اعتماد أو دفع أو موعد مفترض؛ لا تذكير تلقائي.',ownerType:'human',priority:'important',actorType:'manus',actorUserId:null,idempotencyKey:'colliers288:4530001:owner-review'});
 const result={sourceEmailId:4530001,communicationDraftId:cid,ledgerId:l.id,draftUid:l.draft_uid,bodySha256:l.body_sha256,messageId:l.message_id,draftKey:key,subject:c.subject,to:c.to_text,cc:c.cc_text,ownerReviewActionId:card.id,attachments:0,sent:false,unique:true,newDraftCount:1,newActionCount:1};save('draft-result',result);console.log(JSON.stringify(result));await(db as any).$client.end();
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.stack);process.exit(1)});
