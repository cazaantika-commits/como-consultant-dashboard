import mysql from "mysql2/promise";
import {
  addMeetingAgendaItemCommand,
  addMeetingSourceCommand,
  createMeetingCommand,
  prepareMeetingMinutesCommand,
  recordMeetingConsentCommand,
  reviewMeetingMinutesCommand,
  reviewMeetingProposalCommand,
  updateMeetingAgendaItemCommand,
} from "../server/services/comoNextMeetings";

const userId = 1;
const workFileId = 60017;
const token = `smoke-meeting-${Date.now()}`;
let meetingId = 0;
let proposalId = 0;
let analysisId = 0;
let sourceId = 0;
let agendaItemId = 0;
let minutesId = 0;
let targetMemoryId = 0;

async function main() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL!);
  try {
    const created = await createMeetingCommand({
      userId,
      workFileId,
      title: `اختبار دورة اجتماع ${token}`,
      objective: "التحقق من الحواجز ودورة المراجعة دون أي إرسال أو تسجيل.",
      meetingType: "internal_review",
      meetingFormat: "internal",
      participantNames: ["عبد الرحمن"],
      idempotencyKey: token,
    });
    meetingId = created.id;
    const replay = await createMeetingCommand({
      userId,
      workFileId,
      title: `اختبار دورة اجتماع ${token}`,
      meetingType: "internal_review",
      meetingFormat: "internal",
      idempotencyKey: token,
    });
    if (!replay.replayed || replay.id !== meetingId) throw new Error("meeting idempotency failed");

    const agenda = await addMeetingAgendaItemCommand({
      userId,
      meetingId,
      itemKind: "question",
      category: "الهدف",
      promptAr: "هل أثبت الاختبار حواجز الاجتماع؟",
      audience: "discuss",
      priority: "critical",
      isRequired: true,
      sourceEvidence: "Smoke fixture",
    });
    agendaItemId = agenda.id;
    await updateMeetingAgendaItemCommand({ userId, agendaItemId, response: "نعم، بعد المراجعة.", isChecked: true });

    await recordMeetingConsentCommand({
      userId,
      meetingId,
      consentScope: "transcription",
      consentStatus: "granted",
      consentBasis: "اختبار داخلي فقط",
      evidenceReference: token,
    });
    const source = await addMeetingSourceCommand({
      userId,
      meetingId,
      sourceKind: "transcript",
      visibility: "meeting_record",
      title: `مادة ${token}`,
      rawText: "قال عبد الرحمن: يجب مراجعة كل نتيجة قبل تحويلها إلى إجراء أو قرار.",
      idempotencyKey: `${token}-source`,
    });
    sourceId = source.id;
    const sourceReplay = await addMeetingSourceCommand({
      userId,
      meetingId,
      sourceKind: "transcript",
      visibility: "meeting_record",
      title: `مادة ${token}`,
      rawText: "قال عبد الرحمن: يجب مراجعة كل نتيجة قبل تحويلها إلى إجراء أو قرار.",
      idempotencyKey: `${token}-source`,
    });
    if (!sourceReplay.replayed || sourceReplay.id !== sourceId) throw new Error("source idempotency failed");

    const [analysisResult] = await connection.execute<any>(
      `INSERT INTO como_next_meeting_analyses (meeting_id, source_id, analysis_type, analysis_status, summary, open_questions_json, model_id, evidence_bound, request_key, requested_by_user_id) VALUES (?, ?, 'evidence_extraction', 'draft', ?, '[]', 'smoke-fixture', 1, ?, ?)`,
      [meetingId, sourceId, "مسودة اختبار بلا استدعاء نموذج.", `${token}-analysis`, userId],
    );
    analysisId = Number(analysisResult.insertId);
    const [proposalResult] = await connection.execute<any>(
      `INSERT INTO como_next_meeting_proposals (analysis_id, meeting_id, ordinal, proposal_kind, title, content, evidence_excerpt, audience, priority, is_required, review_status) VALUES (?, ?, 1, 'note', ?, ?, ?, 'meeting_record', 'normal', 0, 'pending')`,
      [analysisId, meetingId, `مقترح ${token}`, "يجب بقاء التطبيق انتقائيًا.", "يجب مراجعة كل نتيجة"],
    );
    proposalId = Number(proposalResult.insertId);
    const reviewed = await reviewMeetingProposalCommand({ userId, proposalId, decision: "apply", applyAs: "note", reviewNote: "اعتماد اختباري" });
    targetMemoryId = reviewed.targetId || 0;
    const reviewReplay = await reviewMeetingProposalCommand({ userId, proposalId, decision: "apply", applyAs: "note" });
    if (!reviewReplay.replayed || reviewReplay.targetId !== targetMemoryId) throw new Error("proposal review idempotency failed");

    const minutes = await prepareMeetingMinutesCommand({ userId, meetingId, summary: "اكتملت دورة الاختبار دون أي إرسال أو تسجيل خارجي." });
    minutesId = minutes.id;
    await reviewMeetingMinutesCommand({ userId, minutesId, decision: "approve", reviewNote: "اعتماد اختباري" });

    const [[state]] = await connection.query<any[]>(`SELECT meeting_status meetingStatus, closed_at closedAt FROM como_next_meetings WHERE id = ?`, [meetingId]);
    if (state?.meetingStatus !== "completed" || !state?.closedAt) throw new Error("meeting closure failed");
    console.log(JSON.stringify({ ok: true, meetingId, sourceId, analysisId, proposalId, minutesId, targetMemoryId, externalSideEffects: 0 }, null, 2));
  } finally {
    if (meetingId) {
      await connection.query(`DELETE FROM como_next_work_file_events WHERE (payload_json LIKE ? OR summary LIKE ?)`, [`%\"meetingId\":${meetingId}%`, `%${token}%`]);
      if (targetMemoryId) await connection.query(`DELETE FROM como_next_work_memory WHERE id = ?`, [targetMemoryId]);
      await connection.query(`DELETE FROM como_next_meeting_minutes WHERE meeting_id = ?`, [meetingId]);
      await connection.query(`DELETE FROM como_next_meeting_proposals WHERE meeting_id = ?`, [meetingId]);
      await connection.query(`DELETE FROM como_next_meeting_analyses WHERE meeting_id = ?`, [meetingId]);
      await connection.query(`DELETE FROM como_next_meeting_sources WHERE meeting_id = ?`, [meetingId]);
      await connection.query(`DELETE FROM como_next_meeting_consents WHERE meeting_id = ?`, [meetingId]);
      await connection.query(`DELETE FROM como_next_meeting_agenda_items WHERE meeting_id = ?`, [meetingId]);
      await connection.query(`DELETE FROM como_next_meeting_participants WHERE meeting_id = ?`, [meetingId]);
      await connection.query(`DELETE FROM como_next_meetings WHERE id = ?`, [meetingId]);
    }
    await connection.end();
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => { console.error(error); process.exit(1); });
