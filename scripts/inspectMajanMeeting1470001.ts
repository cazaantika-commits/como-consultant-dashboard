import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {sql} from 'drizzle-orm';
import {getDb} from '../server/db';
import {fetchReadonlyFolderSince,fetchEmailByUID,getConfiguredMailboxAddress} from '../server/emailMonitor';
const root='/home/ubuntu/reports/como-directive-1470001-2026-10-30';
const save=(n:string,v:any)=>fs.writeFileSync(root+'/'+n+'.json',JSON.stringify(v,null,2)+'\n');
const hash=(b:Buffer|string)=>createHash('sha256').update(b).digest('hex');
const bodyHash=(s:string)=>hash(String(s||'').replace(/\r\n?/g,'\n').trim());
async function main(){
 assert.equal(getConfiguredMailboxAddress(),'a.zaqout@comodevelopments.com');const db=await getDb();assert(db);const q=async(s:any)=>(await db.execute(s))[0]as any[];const ctx=JSON.parse(fs.readFileSync(root+'/proof-context.json','utf8'));const source=ctx.source[0];assert.equal(source.id,2520001);assert.equal(source.linked_work_file_id,60017);assert.equal(bodyHash(source.body_text),source.body_sha256);const manifest=JSON.parse(fs.readFileSync('/home/ubuntu/reports/como-directive-1290001-2026-10-27/package-manifest.json','utf8'));assert.equal(manifest.length,3);assert.equal(ctx.attachments.length,3);
 for(const m of manifest){const a=ctx.attachments.find((v:any)=>Number(v.document_id)===m.documentId);assert(a&&a.storage_status==='stored');const b=fs.readFileSync(m.path);assert.equal(hash(b),a.sha256);assert.equal(b.length,Number(a.byte_size));assert.equal(hash(b),m.sha256);}
 const live=await fetchEmailByUID(Number(source.imap_uid),source.uid_validity,'INBOX');assert(live);assert.equal(live.messageId,source.message_id);assert.equal(bodyHash(live.textBody),source.body_sha256);assert.equal(live.attachments.length,3);for(const a of live.attachments){assert(a.content);const saved=ctx.attachments.find((v:any)=>v.file_name===a.filename);assert(saved);assert.equal(hash(a.content),saved.sha256);assert.equal(a.content.length,Number(saved.byte_size));}
 const [current]=await q(sql`SELECT * FROM como_next_email_messages WHERE id=2520001 AND user_id=1 AND linked_work_file_id=60017`);assert.equal(current.body_sha256,source.body_sha256);save('current-source-proof',{checkedAt:new Date().toISOString(),emailId:2520001,bodySha256:source.body_sha256,documents:manifest,liveAttachmentsMatched:true,originalFilesUnchanged:true,readOnly:true});
 const mail:any={checkedAt:new Date().toISOString()};for(const f of ['INBOX','Sent','Drafts']){console.log('Reading',f);mail[f]=await fetchReadonlyFolderSince(f,f==='INBOX'?72:f==='Sent'?96:24*365,50);console.log(f,mail[f].messages.length);}save('live-mail',mail);const relevant=(f:string)=>mail[f].messages.filter((m:any)=>/colliers|majan|draft report submission/i.test(m.subject+' '+m.from+' '+m.to));save('relevant-current-mail',{INBOX:relevant('INBOX'),Sent:relevant('Sent'),Drafts:relevant('Drafts')});console.log(JSON.stringify({currentSources:relevant('INBOX').map((m:any)=>({uid:m.uid,date:m.date,subject:m.subject})),sent:relevant('Sent').map((m:any)=>({uid:m.uid,date:m.date,subject:m.subject})),drafts:relevant('Drafts').map((m:any)=>({uid:m.uid,subject:m.subject})),filesMatched:3}));await(db as any).$client.end();
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1)});
