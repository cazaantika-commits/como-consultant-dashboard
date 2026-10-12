import {sql} from 'drizzle-orm';
import {getDb} from '../server/db';
import {appendEvent,requireProjectAccess} from '../server/services/comoNextCommands';
import {reconcileCurrentMailLinkage} from '../server/services/comoNextEmailInbox';
import {ensureCurrentMailReviewWork} from '../server/services/comoMailExecution';
const rows=(v:any):any[]=>Array.isArray(v)&&Array.isArray(v[0])?v[0]:v;
async function main(){
 const db=await getDb();if(!db)throw Error('database_unavailable');await requireProjectAccess(db,6,1,'write');
 const [f]=rows(await db.execute(sql`SELECT title,work_file_status FROM como_next_work_files WHERE id=390001 AND project_id=6 AND user_id=1`));if(!f||f.work_file_status!=='open'||!f.title.includes('أرتك'))throw Error('artec_file_changed');
 const established=rows(await db.execute(sql`SELECT id,from_email FROM como_next_email_messages WHERE user_id=1 AND linked_work_file_id=390001 AND from_email='tdimitrova@artecint.com' LIMIT 1`));
 const fresh=rows(await db.execute(sql`SELECT id,from_email,subject,body_text FROM como_next_email_messages WHERE id IN (1020001,1020002) AND user_id=1 AND folder_name='INBOX'`));
 if(!established.length||fresh.length!==2||fresh.some(e=>!['tdimitrova@artecint.com','dkv@artecint.com'].includes(e.from_email)||!/^4 Villas/i.test(e.subject)))throw Error('artec_source_not_proven');
 await db.transaction(async tx=>{
  await tx.execute(sql`SELECT id FROM como_next_work_files WHERE id=390001 FOR UPDATE`);
  const key='artec-established-file:390001';let [party]=rows(await tx.execute(sql`SELECT id FROM como_next_parties WHERE user_id=1 AND source_system='como_mail_control' AND source_record_id=${key}`));
  if(!party){const x:any=await tx.execute(sql`INSERT INTO como_next_parties (user_id,party_type,display_name,party_status,source_system,source_record_id) VALUES (1,'organization','ARTEC','active','como_mail_control',${key})`);party={id:Number(x[0].insertId)}}
  let [projectParty]=rows(await tx.execute(sql`SELECT id FROM como_next_project_parties WHERE project_id=6 AND party_id=${Number(party.id)}`));
  if(!projectParty){const x:any=await tx.execute(sql`INSERT INTO como_next_project_parties (project_id,party_id,role_code,relationship_status,source_system,source_record_id) VALUES (6,${Number(party.id)},'consultant','active','como_mail_control',${key})`);projectParty={id:Number(x[0].insertId)}}
  const [relationship]=rows(await tx.execute(sql`SELECT id FROM como_next_work_file_parties WHERE work_file_id=390001 AND project_party_id=${Number(projectParty.id)}`));
  if(!relationship)await tx.execute(sql`INSERT INTO como_next_work_file_parties (project_id,work_file_id,project_party_id,relationship_role) VALUES (6,390001,${Number(projectParty.id)},'counterparty')`);
  for(const [email,name] of [['tdimitrova@artecint.com','Theodora Dimitrova'],['dkv@artecint.com','Dinesh']]){
   const [old]=rows(await tx.execute(sql`SELECT id FROM como_next_party_contacts WHERE party_id=${Number(party.id)} AND email=${email}`));
   if(!old)await tx.execute(sql`INSERT INTO como_next_party_contacts (party_id,display_name,email,notes,source_system,source_record_id) VALUES (${Number(party.id)},${name},${email},'هوية وارد ومراسلات COMO المحفوظة؛ تصحيح سجل ربط فقط، لا تعيين أو إثبات توقيع أو دفع.','como_mail_control',${`artec-contact:${email}`})`);
  }
  await appendEvent(tx,{userId:1,projectId:6,workFileId:390001,actorType:'manus',actorUserId:null,eventType:'mail_party_reference_reconciled',summary:'أضيفت مرجعية عناوين أرتك المفقودة من سجل الأطراف بناءً على مراسلات COMO؛ لا تعيين جديد أو إثبات دفع',payload:{evidenceEmailIds:[...established.map(x=>Number(x.id)),1020001,1020002],source:'existing_mail_and_owner_agreements',externalSideEffect:false},idempotencyKey:'artec-mail-reference-reconciled:2026-10-12'});
 });
 console.log('مرجعية أرتك محفوظة؛ تبدأ إعادة الربط الآمنة دون إنشاء مسودة.');
 console.log(JSON.stringify(await reconcileCurrentMailLinkage({userId:1,limit:5})));
 console.log(JSON.stringify(await ensureCurrentMailReviewWork(1)));
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1)});
