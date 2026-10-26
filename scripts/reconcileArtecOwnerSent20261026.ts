import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { getDb } from '../server/db';
import { appendEvent } from '../server/services/comoNextCommands';

const root = '/home/ubuntu/reports/como-artec-sent-reconcile-2026-10-26';
const key = 'owner-reported-sent:3060001:20261026';
const statement = 'عبد الرحمن26أكتوبر2026 08:56:33دبي: «حسنا انا ارسلت الدرافت الرد اليهم اذا لماذا لم يتم التحديث؟» — المقصود رد أرتك على استفسار دفعة5586، المسودة965/المراسلة3060001.';
const rows = (r:any):any[] => Array.isArray(r?.[0]) ? r[0] : r;
async function main() {
  const db = await getDb(); if (!db) throw Error('database_unavailable');
  fs.mkdirSync(root, { recursive: true });
  const result = await db.transaction(async tx => {
    const q = async (s:any) => rows(await tx.execute(s));
    await tx.execute(sql`SELECT id FROM como_next_work_files WHERE id=390001 AND user_id=1 AND project_id=6 FOR UPDATE`);
    const previous = await q(sql`SELECT id FROM como_next_work_file_events WHERE user_id=1 AND idempotency_key=${key} FOR UPDATE`);
    if (previous.length) return { replayed:true, eventId:Number(previous[0].id), actionId:2220001, communicationId:3060001, ownerReportedSent:true, sentUidVerified:false, paymentStatusChanged:false, externalSideEffect:false };
    const [action] = await q(sql`SELECT * FROM como_next_actions WHERE id=2220001 AND user_id=1 AND project_id=6 AND work_file_id=390001 FOR UPDATE`);
    const [comm] = await q(sql`SELECT * FROM como_next_communications WHERE id=3060001 AND user_id=1 AND project_id=6 AND work_file_id=390001 FOR UPDATE`);
    const ledger = await q(sql`SELECT * FROM como_mailbox_draft_ledger WHERE communication_id=3060001 AND user_id=1 FOR UPDATE`);
    if (!action || !comm || comm.source_record_id !== 'email-reply-draft:2130001' || ledger.length !== 1 || Number(ledger[0].draft_uid)!==965 || comm.direction !== 'outbound' || comm.channel !== 'email') throw Error('exact_artec_reply_lineage_mismatch');
    if (action.action_status === 'cancelled' || comm.communication_status === 'cancelled') throw Error('cancelled_record_not_reopened');
    const protectedBefore = {
      payments: await q(sql`SELECT * FROM como_next_lifecycle_lanes WHERE work_file_id=390001 AND kind='payment' ORDER BY id FOR UPDATE`),
      waiting: await q(sql`SELECT * FROM como_next_actions WHERE id IN (900001,1830001,570005,570006) ORDER BY id FOR UPDATE`),
    };
    if (!protectedBefore.payments.some(r => r.lane_key === 'payment:5586' && r.status === 'waiting_external')) {
      // The actual schema may expose lane_status instead of status; do not infer
      // payment from a reply. Preserve every lane byte-for-byte below.
      const payment = protectedBefore.payments.find(r => r.lane_key === 'payment:5586');
      if (!payment) throw Error('payment_lane_missing');
    }
    fs.writeFileSync(root+'/owner-statement-before.json',JSON.stringify({ action, communication:comm, ledger, protectedBefore },null,2)+'\n');
    await tx.execute(sql`UPDATE como_next_actions SET action_status='verified',completed_at=UTC_TIMESTAMP(),verified_at=UTC_TIMESTAMP(),evidence_reference=${statement},description=CONCAT(COALESCE(description,''),${'\n26أكتوبر: أُرسل رد أرتك بإفادة عبد الرحمن. انتهت مطالبة المراجعة/الإرسال. المصالحة المصدرية مسؤوليةManus، لا إعادة إرسال. دفعة5586 تنتظر شاهد ونسرين مستقلًا.'}) WHERE id=2220001 AND user_id=1 AND work_file_id=390001`);
    if (comm.communication_status !== 'sent') {
      await tx.execute(sql`UPDATE como_next_communications SET communication_status='sent',evidence_reference=${statement},review_note='إرسال بإفادة عبد الرحمن26أكتوبر08:56:33دبي؛ لا UIDصادر أو وقتإرسال مخترع. ended_owner_send_request=true؛ المصالحة المصدرية مسؤوليةManus. لا سداد.' WHERE id=3060001 AND user_id=1`);
    }
    if (ledger[0].state !== 'sent_confirmed') {
      await tx.execute(sql`UPDATE como_mailbox_draft_ledger SET review_reason='owner_reports_sent_20261026_no_recreation_await_exact_lineage' WHERE id=${ledger[0].id} AND user_id=1`);
    }
    await tx.execute(sql`INSERT INTO como_next_work_memory(project_id,work_file_id,memory_type,entry_type,title,body,source_status,is_current,source_system,source_record_id,occurred_at) VALUES(6,390001,'note','owner_statement','الفلل الأربع — رد أرتك965مرسل بإفادة عبد الرحمن',${statement+'\nانتهت مطالبة2220001؛ لا إعادة بريد أو طلب صرف. انتظار900001علىشاهد ونسرين قائم؛ لا إثباتسداد. لا UIDصادر أو وقتإرسال مخترع.'},'owner_reported',1,'owner_kitchen_review',${key},UTC_TIMESTAMP())`);
    await appendEvent(tx,{userId:1,projectId:6,workFileId:390001,actionId:2220001,actorType:'human',actorUserId:1,eventType:'owner_reported_sent_recorded',summary:'الفلل الأربع — رد أرتك965مرسل بإفادة عبد الرحمن؛ أُغلقت مطالبة2220001. انتظار شاهد ونسرين5586قائم دون سداد.',payload:{communicationId:3060001,actionId:2220001,sourceEmailId:2130001,draftUid:965,ownerReported:true,sentUidVerified:false,ownerPromptRemoved:true,replyBodySha256:createHash('sha256').update(String(comm.body||'')).digest('hex'),paymentStatusChanged:false,externalSideEffect:false},idempotencyKey:key});
    const protectedAfter = {
      payments: await q(sql`SELECT * FROM como_next_lifecycle_lanes WHERE work_file_id=390001 AND kind='payment' ORDER BY id`),
      waiting: await q(sql`SELECT * FROM como_next_actions WHERE id IN (900001,1830001,570005,570006) ORDER BY id`),
    };
    if (JSON.stringify(protectedBefore)!==JSON.stringify(protectedAfter)) throw Error('payment_or_existing_wait_changed');
    const [event] = await q(sql`SELECT id FROM como_next_work_file_events WHERE user_id=1 AND idempotency_key=${key}`);
    return {replayed:false,eventId:Number(event.id),actionId:2220001,communicationId:3060001,ownerReportedSent:true,sentUidVerified:false,paymentStatusChanged:false,existingWaitsUnchanged:true,externalSideEffect:false};
  });
  fs.writeFileSync(root+(result.replayed?'/owner-statement-replay.json':'/owner-statement-receipt.json'),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result,null,2));
  await (db as any).$client.end();
}
main().then(()=>process.exit(0)).catch(e=>{ console.error(e.message);process.exit(1); });
