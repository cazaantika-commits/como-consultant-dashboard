import 'dotenv/config';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {sql} from 'drizzle-orm';
import {getDb} from '../server/db';
import {requireProjectAccess} from '../server/services/comoNextCommands';
const root='/home/ubuntu/reports/como-directive-2550001-2026-11-13';
async function main(){
 fs.mkdirSync(root,{recursive:true});const db=await getDb();assert(db);const q=async(s:any)=>(await db.execute(s))[0]as any[];
 for(const id of [2550001]){
  const[d]=await q(sql`SELECT * FROM como_next_staged_directives WHERE id=${id}`);assert(d);await requireProjectAccess(db,Number(d.project_id),Number(d.user_id),'read');
  const r={checkedAt:new Date().toISOString(),directive:d,dispatch:await q(sql`SELECT * FROM como_manus_dispatches WHERE directive_id=${d.id}`),action:await q(sql`SELECT * FROM como_next_actions WHERE id=${d.action_id} AND user_id=${d.user_id}`),file:await q(sql`SELECT * FROM como_next_work_files WHERE id=${d.work_file_id} AND user_id=${d.user_id}`)};
  const path=root+'/authority-'+id+'.json';fs.writeFileSync(path,JSON.stringify(r,null,2)+'\n');console.log(JSON.stringify({...r,file:r.file.map(v=>({id:v.id,title:v.title,work_file_status:v.work_file_status})),savedTo:path},null,2));
 }
 await(db as any).$client.end();
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.stack);process.exit(1)});
