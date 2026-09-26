import mysql from "mysql2/promise";
import { createIntakeProposalsCommand, reviewIntakeProposalCommand } from "../server/services/comoNextIntake";

async function main() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL!);
  const marker = `smoke-intake-${Date.now()}`;
  let proposalId: number | null = null;
  let actionId: number | null = null;
  try {
    const [targets] = await connection.query<any[]>(`
      SELECT u.id AS userId, wf.project_id AS projectId, wf.id AS workFileId
      FROM users u
      JOIN projects p ON p.userId = u.id AND p.is_test_project = 0
      JOIN como_next_work_files wf ON wf.project_id = p.id AND wf.work_file_status NOT IN ('closed','cancelled')
      WHERE u.role = 'admin'
      ORDER BY wf.id LIMIT 1
    `);
    if (!targets[0]) throw new Error("No safe work file available for smoke test");
    const target = { userId: Number(targets[0].userId), projectId: Number(targets[0].projectId), workFileId: Number(targets[0].workFileId) };
    const [beforeRows] = await connection.query<any[]>("SELECT (SELECT COUNT(*) FROM como_next_actions) AS actions, (SELECT COUNT(*) FROM como_next_intake_proposals) AS proposals");
    const before = { actions: Number(beforeRows[0].actions), proposals: Number(beforeRows[0].proposals) };

    const created = await createIntakeProposalsCommand({
      ...target,
      sourceKind: "sara",
      sourcePrefix: marker,
      requestedByMemberId: "abdulrahman",
      proposals: [{
        kind: "action",
        title: `${marker} متابعة اختبارية`,
        content: "مقترح smoke لاختبار دورة المراجعة فقط.",
        acceptanceCriteria: "إزالة جميع سجلات الاختبار والتحقق من عودة الأعداد إلى خط الأساس.",
        ownerType: "human",
        priority: "normal",
        evidenceExcerpt: `عبد الرحمن: ${marker} سجلي هذه المتابعة للاختبار`,
      }],
    });
    proposalId = created.ids[0];
    const replay = await createIntakeProposalsCommand({
      ...target,
      sourceKind: "sara",
      sourcePrefix: marker,
      requestedByMemberId: "abdulrahman",
      proposals: [{ kind: "action", title: `${marker} متابعة اختبارية`, acceptanceCriteria: "اختبار", evidenceExcerpt: marker }],
    });
    if (created.created !== 1 || replay.created !== 0 || replay.duplicates !== 1) throw new Error("Proposal idempotency failed");

    const [pendingRows] = await connection.query<any[]>("SELECT review_status AS status, target_id AS targetId FROM como_next_intake_proposals WHERE id = ?", [proposalId]);
    if (pendingRows[0]?.status !== "pending" || pendingRows[0]?.targetId) throw new Error("Proposal created an operational effect before review");
    const [midRows] = await connection.query<any[]>("SELECT COUNT(*) AS actions FROM como_next_actions");
    if (Number(midRows[0].actions) !== before.actions) throw new Error("Action count changed before review");

    const applied = await reviewIntakeProposalCommand({ userId: target.userId, proposalId, decision: "apply", reviewNote: "اعتماد smoke قابل للعكس" });
    actionId = applied.targetId;
    if (!actionId || applied.externalSideEffect !== false) throw new Error("Proposal apply failed");
    const replayedReview = await reviewIntakeProposalCommand({ userId: target.userId, proposalId, decision: "apply" });
    if (!replayedReview.replayed || replayedReview.targetId !== actionId) throw new Error("Review idempotency failed");

    const [appliedRows] = await connection.query<any[]>("SELECT review_status AS status, target_id AS targetId FROM como_next_intake_proposals WHERE id = ?", [proposalId]);
    if (appliedRows[0]?.status !== "applied" || Number(appliedRows[0]?.targetId) !== actionId) throw new Error("Proposal was not linked to its reviewed target");

    console.log(JSON.stringify({ created, replay, applied, replayedReview, operationalBeforeReview: 0, externalSideEffects: 0 }, null, 2));
  } finally {
    if (proposalId) {
      await connection.query("DELETE FROM como_next_work_file_events WHERE idempotency_key IN (?, ?, ?)", [`event:intake:sara:${proposalId}`, `intake-proposal:${proposalId}`, `event:intake-review:${proposalId}`]);
      if (actionId) await connection.query("DELETE FROM como_next_actions WHERE id = ? AND title LIKE ?", [actionId, `${marker}%`]);
      await connection.query("DELETE FROM como_next_intake_proposals WHERE id = ? AND source_record_id LIKE ?", [proposalId, `${marker}%`]);
    }
    const [residue] = await connection.query<any[]>("SELECT (SELECT COUNT(*) FROM como_next_actions WHERE title LIKE ?) AS actions, (SELECT COUNT(*) FROM como_next_intake_proposals WHERE source_record_id LIKE ?) AS proposals, (SELECT COUNT(*) FROM como_next_work_file_events WHERE idempotency_key LIKE ?) AS events", [`${marker}%`, `${marker}%`, `%${marker}%`]);
    console.log("cleanup", residue[0]);
    await connection.end();
  }
}

main().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
