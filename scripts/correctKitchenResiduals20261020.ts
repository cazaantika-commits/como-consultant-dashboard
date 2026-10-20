import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { sql } from "drizzle-orm";
import { getDb } from "../server/db";
import { appendEvent, requireProjectAccess } from "../server/services/comoNextCommands";

const ROOT = "/home/ubuntu/reports/como-kitchen-apply-2026-10-20";
const KEY = "kitchen-review:20261020:residuals-v1";
const db = await getDb();
if (!db) throw Error("database_unavailable");
const rows = async (query: any) => (await db.execute(query))[0] as any[];
const protectedState = async () => ({
  lanes: await rows(sql`SELECT * FROM como_next_lifecycle_lanes ORDER BY id`),
  scenarios: await rows(sql`SELECT * FROM cf_scenarios ORDER BY id`),
  directives: await rows(sql`SELECT * FROM como_next_staged_directives ORDER BY id`),
  actions: await rows(sql`SELECT * FROM como_next_actions ORDER BY id`),
  communications: await rows(sql`SELECT * FROM como_next_communications ORDER BY id`),
});
const existing = await rows(sql`SELECT id FROM como_next_work_file_events WHERE idempotency_key=${KEY}`);
if (existing.length) {
  console.log("تصحيح البطاقتين مكتمل بالفعل؛ لا إعادة كتابة.");
  process.exit(0);
}
await requireProjectAccess(db, 6, 1, "write");
await requireProjectAccess(db, 1, 1, "write");
const before = {
  proposal: await rows(sql`SELECT * FROM como_next_intake_proposals WHERE id=1860002`),
  file: await rows(sql`SELECT * FROM como_next_work_files WHERE id=480001`),
  protected: await protectedState(),
};
assert.equal(before.proposal[0]?.user_id, 1);
assert.equal(before.proposal[0]?.work_file_id, 390001);
assert.equal(before.proposal[0]?.project_id, 6);
assert.equal(before.proposal[0]?.review_status, "pending");
assert.equal(before.proposal[0]?.title, "متابعة استلام مستندات أرتك وتأكيد المالية");
assert.equal(before.file[0]?.user_id, 1);
assert.equal(before.file[0]?.project_id, 1);
assert.equal(before.file[0]?.work_file_status, "open");
assert.match(before.file[0]?.desired_outcome || "", /استكمل Manus/);
assert.match(before.file[0]?.desired_outcome || "", /ينتظر نتائج كولييرز/);
fs.writeFileSync(path.join(ROOT, "residuals-before.json"), JSON.stringify(before, null, 2) + "\n");
await db.transaction(async tx => {
  await tx.execute(sql`UPDATE como_next_intake_proposals SET
    review_status='dismissed', reviewed_by_user_id=1, reviewed_at=UTC_TIMESTAMP(),
    review_note=${"مكرر: المستندات سبق استلامها وفحصها، ومتابعة التنفيذ المالي موحدة في الإجراء900001 مع شاهد ونسرين، وفق قرارات عبد الرحمن20أكتوبر. لا إعادة طلب مستندات أو إثبات سداد."}
    WHERE id=1860002 AND user_id=1 AND work_file_id=390001 AND review_status='pending'`);
  await tx.execute(sql`UPDATE como_next_work_files SET work_file_status='waiting',
    title=${"ماجان — NEB: التحليل مكتمل والقرار مرتبط بجدوى المشروع"}
    WHERE id=480001 AND user_id=1 AND project_id=1 AND work_file_status='open'`);
  await appendEvent(tx, {
    userId: 1, projectId: 6, workFileId: 390001, actorType: "manus", actorUserId: null,
    eventType: "review_dismissed",
    summary: "الفلل الأربع — إلغاء مقترح متابعة مستندات مكرر؛ متابعة دفعة أرتك تبقى واحدة مع شاهد ونسرين.",
    payload: { proposalId: 1860002, survivingPaymentActionId: 900001, paid: false, externalSideEffect: false },
    idempotencyKey: `${KEY}:proposal`,
  });
  await appendEvent(tx, {
    userId: 1, projectId: 1, workFileId: 480001, actorType: "manus", actorUserId: null,
    eventType: "work_file_state_updated",
    summary: "ماجان — NEB: التحليل مكتمل والقرار ينتظر نتائج كولييرز وتحديد التوجه؛ لا مهمة Manus وهمية أو اعتماد أو تعيين.",
    payload: { workFileStatus: "waiting", proposalId: 1860002, externalSideEffect: false },
    idempotencyKey: KEY,
  });
});
const after = {
  proposal: await rows(sql`SELECT * FROM como_next_intake_proposals WHERE id=1860002`),
  file: await rows(sql`SELECT * FROM como_next_work_files WHERE id=480001`),
  protected: await protectedState(),
};
assert.equal(after.proposal[0].review_status, "dismissed");
assert.equal(after.file[0].work_file_status, "waiting");
assert.deepEqual(after.protected, before.protected);
fs.writeFileSync(path.join(ROOT, "residuals-receipt.json"), JSON.stringify({
  observedAt: new Date().toISOString(), after,
  protectedStatesUnchanged: true, sent: false, newDraftCreated: false,
}, null, 2) + "\n");
console.log("أُزيلت البطاقتان المتبقيتان؛ المالية والتوجيهات والإجراءات والمراسلات لم تتغير.");
process.exit(0);
