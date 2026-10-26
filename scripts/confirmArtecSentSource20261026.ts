import fs from 'node:fs';
import { eq, sql } from 'drizzle-orm';
import { getDb } from '../server/db';
import { comoNextEmailMessages } from '../drizzle/schema';
import { getConfiguredMailboxAddress } from '../server/emailMonitor';
import { findValidatedSentLineage } from '../server/services/comoMailboxDraftLedger';
import { confirmValidatedSentLineageCommand } from '../server/services/comoNextEmailInbox';
import { readExecutiveWorkFile } from '../server/services/saraWorkFileReader';
const root='/home/ubuntu/reports/como-artec-sent-reconcile-2026-10-26';
async function main(){
 const db=await getDb();if(!db)throw Error('database_unavailable');
 const q=async(s:any)=>(await db.execute(s))[0];
 const protection=async()=>({payments:await q(sql`SELECT * FROM como_next_lifecycle_lanes WHERE kind='payment' ORDER BY id`),waits:await q(sql`SELECT * FROM como_next_actions WHERE id IN(900001,1830001,570005,570006) ORDER BY id`)});
 const before=await protection();
 const ownerMailbox=getConfiguredMailboxAddress();
 const apply=async()=>{
  const [email]=await db.select().from(comoNextEmailMessages).where(eq(comoNextEmailMessages.id,2160001)).limit(1);
  if(!email||email.userId!==1||email.folderName!=='Sent'||Number(email.imapUid)!==231)throw Error('exact_source_missing');
  const lineage=await findValidatedSentLineage({userId:1,mailboxKey:email.mailboxKey,ownerMailbox,message:{uid:Number(email.imapUid),messageId:email.messageId||'',from:email.fromEmail,to:email.toText||'',cc:email.ccText||'',subject:email.subject,textBody:email.bodyText,date:new Date(email.receivedAt.replace(' ','T')+'Z')}});
  if(lineage.kind!=='validated'||lineage.communicationId!==3060001||lineage.ledgerId!==870001||lineage.projectId!==6||lineage.workFileId!==390001)throw Error('exact_draft_sent_lineage_not_proven');
  return confirmValidatedSentLineageCommand({userId:1,mailboxKey:email.mailboxKey,ownerMailbox,email,lineage});
 };
 const first=await apply();if(first.kind!=='confirmed')throw Error('source_confirmation_needs_review:'+JSON.stringify(first));
 const replay=await apply();if(replay.kind!=='confirmed'||!replay.replayed)throw Error('source_confirmation_not_idempotent');
 const after=await protection();if(JSON.stringify(before)!==JSON.stringify(after))throw Error('protected_payment_or_wait_changed');
 const sara:any=await readExecutiveWorkFile({memberId:'abdulrahman',nameAr:'عبد الرحمن',role:'owner'},JSON.stringify({work_file_id:390001,focus:'overview',question:'حالةإرسالردأرتك965وصادر231وانتظارشاهدونسرين5586'}));
 const state={source:await q(sql`SELECT id,folder_name,imap_uid,communication_id,inbox_status,received_at FROM como_next_email_messages WHERE id=2160001`),communication:await q(sql`SELECT id,communication_status,evidence_reference,sent_at FROM como_next_communications WHERE id=3060001`),ledger:await q(sql`SELECT id,state,sent_folder,sent_uid FROM como_mailbox_draft_ledger WHERE id=870001`),action:await q(sql`SELECT id,action_status FROM como_next_actions WHERE id=2220001`),eventCount:await q(sql`SELECT COUNT(*) AS n FROM como_next_work_file_events WHERE user_id=1 AND idempotency_key='sent-lineage-confirmed:3060001:2160001'`)};
 const receipt={first,replay,state,paymentAndWaitsUnchanged:true,saraFound:sara.found,mailboxWrite:false,messageSentByManus:false};
 fs.writeFileSync(root+'/source-confirmation-receipt.json',JSON.stringify(receipt,null,2)+'\n');
 fs.writeFileSync(root+'/sara-after-source-confirmation.json',JSON.stringify(sara,null,2)+'\n');
 console.log(JSON.stringify(receipt,null,2));await (db as any).$client.end();
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1)});
