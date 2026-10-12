import mysql from 'mysql2/promise';
import { mkdir, writeFile } from 'node:fs/promises';
const dir='/home/ubuntu/reports/colliers-lifecycle-2026-10-12';
const conn=await mysql.createConnection(process.env.DATABASE_URL!);
try {
 await mkdir(dir,{recursive:true});
 const queries:Record<string,string>={
  file:'SELECT * FROM como_next_work_files WHERE id=60017',
  actions:'SELECT * FROM como_next_actions WHERE work_file_id=60017',
  directives:'SELECT * FROM como_next_staged_directives WHERE work_file_id=60017',
  updates:'SELECT * FROM como_next_work_file_updates WHERE work_file_id=60017',
  events:'SELECT * FROM como_next_work_file_events WHERE work_file_id=60017 ORDER BY sequence_no',
  memory:'SELECT * FROM como_next_work_memory WHERE work_file_id=60017',
  communications:'SELECT * FROM como_next_communications WHERE work_file_id=60017',
  emails:"SELECT * FROM como_next_email_messages WHERE linked_work_file_id=60017 OR from_email LIKE '%colliers%' OR to_text LIKE '%colliers%' ORDER BY received_at DESC",
  ledger:'SELECT * FROM como_mailbox_draft_ledger WHERE work_file_id=60017',
  paymentRequests:'SELECT * FROM payment_requests WHERE projectId=1',
 };
 const out:Record<string,unknown>={capturedAt:new Date().toISOString()};
 for(const [k,q] of Object.entries(queries)) {try {const [r]=await conn.query(q);out[k]=r;console.log(k,Array.isArray(r)?r.length:0)}catch(e){out[k]={error:(e as Error).message};}}
 const path=`${dir}/before.json`;
 await writeFile(path,JSON.stringify(out,null,2)+'\n');
 console.log('Saved',path);
 const [tables]=await conn.query("SHOW TABLES LIKE '%draft%'");console.log(tables);
} finally{await conn.end()}
