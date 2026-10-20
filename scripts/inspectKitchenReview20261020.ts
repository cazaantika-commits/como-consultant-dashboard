import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { getDb } from '../server/db';
const root='/home/ubuntu/reports/como-kitchen-apply-2026-10-20';
const rows=(r:any)=>Array.isArray(r?.[0])?r[0]:r;
async function main(){
 const db=await getDb(); if(!db) throw Error('قاعدة COMO غير متاحة'); fs.mkdirSync(root,{recursive:true});
 const data:any={observedAt:new Date().toISOString()};
 const queries:Record<string,string>={
  actions:'SELECT a.*,w.title AS file_title,p.name AS project_name FROM como_next_actions a JOIN como_next_work_files w ON w.id=a.work_file_id JOIN projects p ON p.id=a.project_id WHERE a.user_id=1 ORDER BY a.id',
  files:'SELECT * FROM como_next_work_files WHERE user_id=1 ORDER BY id',
  lanes:'SELECT * FROM como_next_lifecycle_lanes WHERE user_id=1 ORDER BY id',
  communications:'SELECT * FROM como_next_communications WHERE user_id=1 ORDER BY id',
  ledger:'SELECT * FROM como_mailbox_draft_ledger WHERE user_id=1 ORDER BY id',
  memory:'SELECT * FROM como_next_work_memory WHERE is_current=1 ORDER BY id',
  parties:'SELECT pp.*,p.display_name FROM como_next_project_parties pp JOIN como_next_parties p ON p.id=pp.party_id ORDER BY pp.id',
  directives:'SELECT * FROM como_next_staged_directives WHERE user_id=1 ORDER BY id',
  dispatches:'SELECT * FROM como_manus_dispatches ORDER BY id',
  proposals:'SELECT * FROM como_next_intake_proposals WHERE user_id=1 ORDER BY id',
  scenarios:'SELECT * FROM cf_scenarios ORDER BY id',
  events:'SELECT * FROM como_next_work_file_events WHERE user_id=1 ORDER BY id DESC LIMIT 1500',
 };
 for(const [key,q] of Object.entries(queries)){
  try{data[key]=rows(await db.execute(sql.raw(q)));console.log(key,data[key].length);}
  catch(e:any){throw Error(`${key}: ${String(e.message).split('\n')[0]}`);}
 }
 const mode=process.argv.includes('--after')?'after':'before'; const target=path.join(root,`state-${mode}.json`);
 if(mode==='before'&&fs.existsSync(target))throw Error('لقطة ما قبل التطبيق موجودة؛ لا تُستبدل');
 fs.writeFileSync(target,JSON.stringify(data,null,2)+'\n');
 const concise={observedAt:data.observedAt,actions:data.actions.filter((r:any)=>!['verified','cancelled'].includes(r.action_status)).map((r:any)=>({id:r.id,file:r.work_file_id,project:r.project_name,title:r.title,status:r.action_status,owner:r.owner_type,source:r.source_record_id,acceptance:r.acceptance_criteria,description:r.description,evidence:r.evidence_reference,waiting:r.waiting_project_party_id})),files:data.files.filter((r:any)=>!['closed','cancelled'].includes(r.work_file_status)).map((r:any)=>({id:r.id,project:r.project_id,title:r.title,status:r.work_file_status,next:r.next_action_title})),lanes:data.lanes,ledger:data.ledger};
 fs.writeFileSync(path.join(root,`concise-${mode}.json`),JSON.stringify(concise,null,2)+'\n');
 console.log('محفوظ',target,'SHA256',createHash('sha256').update(fs.readFileSync(target)).digest('hex'));
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1)});
