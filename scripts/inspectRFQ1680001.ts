import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {sql} from 'drizzle-orm';
import {getDb} from '../server/db';
import {fetchEmailByUID,fetchReadonlyFolderSince,getConfiguredMailboxAddress} from '../server/emailMonitor';
const root='/home/ubuntu/reports/como-directive-1680001-2026-11-03';
const hash=(v:string|Buffer)=>createHash('sha256').update(v).digest('hex');
const norm=(v:any)=>String(v||'').replace(/\r\n?/g,'\n').trim();
const save=(n:string,v:any)=>fs.writeFileSync(root+'/'+n+'.json',JSON.stringify(v,null,2)+'\n');
async function main(){
 fs.mkdirSync(root,{recursive:true});
 const db=await getDb();assert(db);assert.equal(getConfiguredMailboxAddress(),'a.zaqout@comodevelopments.com');
 const q=async(s:any)=>(await db.execute(s))[0] as any[];
 const [source]=await q(sql`SELECT * FROM como_next_email_messages WHERE id=3030001 AND user_id=1`);
 assert(source&&source.folder_name==='INBOX'&&source.inbox_status==='unmatched'&&!source.linked_work_file_id);
 assert.equal(source.body_sha256,'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
 const attachments=await q(sql`SELECT * FROM como_next_email_attachments WHERE email_message_id=3030001 ORDER BY ordinal`);
 assert.equal(attachments.length,2);
 const before={
  projects:await q(sql`SELECT * FROM projects ORDER BY id`),
  files:await q(sql`SELECT * FROM como_next_work_files WHERE user_id=1 ORDER BY id`),
  lanes:await q(sql`SELECT * FROM como_next_lifecycle_lanes WHERE user_id=1 ORDER BY id`),
  pending:await q(sql`SELECT * FROM como_next_staged_directives WHERE user_id=1 AND status='pending' ORDER BY id`),
  actions:await q(sql`SELECT * FROM como_next_actions WHERE user_id=1 ORDER BY id`),
  communications:await q(sql`SELECT * FROM como_next_communications WHERE user_id=1 ORDER BY id`),
  ledgers:await q(sql`SELECT * FROM como_mailbox_draft_ledger WHERE user_id=1 ORDER BY id`),
  decisions:await q(sql`SELECT * FROM como_next_decisions WHERE user_id=1 ORDER BY id`)
 };
 if(!fs.existsSync(root+'/protected-before.json'))save('protected-before',before);
 const related=await q(sql`SELECT id,subject,from_email,received_at,linked_project_id,linked_work_file_id,message_id FROM como_next_email_messages WHERE user_id=1 AND (subject LIKE '%JANU%' OR subject LIKE '%MARJAN%' OR from_email LIKE '%taknomachine%' OR subject LIKE '%BMU%' OR subject LIKE '%ASCC%') ORDER BY id`);
 save('mapping-context',{projects:before.projects,files:before.files,related});
 const live=await fetchEmailByUID(Number(source.imap_uid),String(source.uid_validity),'INBOX');
 assert(live&&live.messageId===source.message_id);assert.equal(hash(norm(live.textBody)),source.body_sha256);
 assert.equal(live.attachments.length,2);
 fs.writeFileSync(root+'/email-body-html.txt',live.htmlBody+'\n');
 fs.writeFileSync(root+'/email-body-text.txt',live.textBody+'\n');
 const remaining=[...attachments];const proof:any[]=[];
 for(const a of live.attachments){
  assert(a.content);const idx=remaining.findIndex(r=>r.file_name===a.filename&&Number(r.byte_size)===a.content!.length);
  assert(idx>=0);const row=remaining.splice(idx,1)[0];const sha=hash(a.content);
  if(row.sha256)assert.equal(sha,row.sha256);
  const p=root+'/'+row.ordinal+'-'+String(row.file_name).replace(/[\/\\]/g,'_')+(row.mime_type==='image/png'?'.png':'');
  fs.writeFileSync(p,a.content);proof.push({attachmentId:row.id,ordinal:row.ordinal,fileName:row.file_name,mimeType:row.mime_type,path:p,sha256:sha,size:a.content.length,storedSha:row.sha256,metadataSizeMatches:true});
 }
 assert.equal(remaining.length,0);
 save('live-source-proof',{checkedAt:new Date().toISOString(),sourceEmailId:3030001,sourceSha:source.body_sha256,messageId:live.messageId,headers:live.headers,from:live.from,to:live.to,cc:live.cc,textBody:live.textBody,htmlBodySha:hash(live.htmlBody),readOnly:true,attachments:proof});
 const responses:any={checkedAt:new Date().toISOString(),readOnly:true};
 for(const f of ['Sent','Drafts']){console.log('Reading '+f);responses[f]=await fetchReadonlyFolderSince(f,f==='Sent'?24*4:24*365,100);}
 save('response-live',responses);
 console.log(JSON.stringify({sourceEmailId:3030001,files:proof.map(p=>p.path),registeredProjects:before.projects.map((p:any)=>({id:p.id,name:p.name,plotNumber:p.plotNumber})),related,matchingFiles:before.files.filter((f:any)=>/janu|marjan|bmu|ascc|takno/i.test(f.title)),sentCount:responses.Sent.messages.length,draftCount:responses.Drafts.messages.length}));
 await(db as any).$client.end();
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1)});
