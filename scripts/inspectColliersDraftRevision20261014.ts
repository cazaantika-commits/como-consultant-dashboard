import fs from 'node:fs';
import Imap from 'imap';
import {sql} from 'drizzle-orm';
import {getDb} from '../server/db';
import {fetchReadonlyFolderSince, getConfiguredMailboxAddress} from '../server/emailMonitor';
const root='/home/ubuntu/reports/colliers-owner-note-audit-2026-10-14';
const key='owner-colliers-feasibility-comments:20261014-approved';
const rows=(v:any)=>v[0] as any[];
async function main(){
 if(getConfiguredMailboxAddress()!=='a.zaqout@comodevelopments.com')throw Error('COMO_mailbox_only');
 const db=await getDb();if(!db)throw Error('database_unavailable');
 const [communication]=rows(await db.execute(sql`SELECT * FROM como_next_communications WHERE id=2280001 AND user_id=1 AND work_file_id=60017`));
 const [ledger]=rows(await db.execute(sql`SELECT * FROM como_mailbox_draft_ledger WHERE communication_id=2280001 AND draft_key=${key}`));
 const [drafts,sent]=await Promise.all([fetchReadonlyFolderSince('Drafts',48,250),fetchReadonlyFolderSince('Sent',48,250)]);
 const similar=(m:any)=>m.messageId===ledger?.message_id||m.headers?.['x-como-draft-key']===key||(/colliers\.com/i.test(`${m.to},${m.cc}`)&&/not a sufficient basis for a development decision/.test(m.textBody));
 const matches=drafts.messages.filter(similar),sentMatches=sent.messages.filter(similar);
 const capabilities=await new Promise((resolve,reject)=>{
  const imap=new Imap({user:process.env.EMAIL_USER||'a.zaqout@comodevelopments.com',password:process.env.EMAIL_PASSWORD||'',host:process.env.EMAIL_HOST||'mail.privateemail.com',port:993,tls:true,tlsOptions:{rejectUnauthorized:false},connTimeout:15000,authTimeout:10000});
  imap.once('error',reject);imap.once('ready',()=>{const result={replace:imap.serverSupports('REPLACE'),move:imap.serverSupports('MOVE'),uidplus:imap.serverSupports('UIDPLUS'),condstore:imap.serverSupports('CONDSTORE')};imap.end();resolve(result)});imap.connect();
 });
 const audit={checkedAt:new Date().toISOString(),communication,ledger,capabilities,uidValidity:drafts.uidValidity,matchingDrafts:matches,matchingSent:sentMatches};
 fs.mkdirSync(`${root}/letter-history`,{recursive:true});
 fs.writeFileSync(`${root}/letter-history/revision-20261014T124157Z-before.json`,JSON.stringify(audit,null,2)+'\n');
 console.log(JSON.stringify({communicationStatus:communication?.communication_status,ledgerState:ledger?.state,capabilities,draftUids:matches.map(m=>m.uid),sentUids:sentMatches.map(m=>m.uid),uidValidity:drafts.uidValidity},null,2));
 if(matches.length!==1||matches[0].uid!==951||sentMatches.length||ledger?.state!=='draft_saved'||communication?.communication_status!=='draft')throw Error('live_unsent_draft_not_verified');
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1)});
