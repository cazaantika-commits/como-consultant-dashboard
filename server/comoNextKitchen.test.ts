import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { actionNeedsAttentionNow, buildExecutiveKitchenQueue, buildOperationalUpdatePrompt, decisionNeedsAttentionNow } from "./services/comoNextKitchen";

const migration = readFileSync("drizzle/0093_como_next_executive_kitchen.sql", "utf8");
const kitchenService = readFileSync("server/services/comoNextKitchen.ts", "utf8");
const kitchenPage = readFileSync("client/src/pages/ComoNextTodayPage.tsx", "utf8");
const scheduleRoute = readFileSync("server/scheduledEmailSyncRoute.ts", "utf8");
const emailPage = readFileSync("client/src/components/ComoNextEmailInbox.tsx", "utf8");
const mainRouter = readFileSync("server/routers/comoNext.ts", "utf8");

function seed() {
  return {
    actions: [
      { id: 1, title: "بانتظار الرد", actionStatus: "waiting_external", projectId: 1, workFileId: 10, priority: "urgent", attentionAt: "2026-09-27 09:00:00" },
      { id: 2, title: "تحقق من المستند", actionStatus: "completed_pending_verification", ownerType: "manus", projectId: 1, workFileId: 10, priority: "normal", attentionAt: "2026-09-27 08:00:00" },
    ],
    decisions: [{ id: 3, title: "اعتماد القرار", projectId: 1, workFileId: 10, dueAt: null }],
    draftCommunications: [{ id: 4, subject: "مراجعة المسودة", projectId: 1, workFileId: 10, occurredAt: null }],
    meetings: [],
    emails: [{ id: 5, subject: "رسالة تحتاج ربطًا", suggestedProjectId: 1, suggestedWorkFileId: 10, importance: "important" }],
    intakeProposals: [],
    specialistReviews: [],
    filesWithoutNextAction: [{ id: 11, projectId: 1, title: "ملف بلا خطوة", priority: "normal" }],
  };
}

describe("COMO Next executive kitchen", () => {
  it("unifies every operational type into one current topic per work file", () => {
    const queue = buildExecutiveKitchenQueue(seed());
    expect(queue).toHaveLength(2);
    expect(queue[0]?.phase).toBe("owner_review");
    expect(queue[0]?.kind).toBe("decision");
    expect(queue[0]?.reviewItemCount).toBe(5);
    expect(queue[0]?.relatedReviewIds).toEqual(["action:1", "action:2", "decision:3", "communication:4", "email:5"]);
    expect(queue.at(-1)?.phase).toBe("define_next_step");
  });

  it("collapses several proposals for the same work file into one review topic", () => {
    const input = seed();
    input.actions = [];
    input.decisions = [];
    input.draftCommunications = [];
    input.emails = [];
    input.filesWithoutNextAction = [];
    input.intakeProposals = [
      { id: 11, title: "سؤال أول", projectId: 1, workFileId: 10, priority: "important" },
      { id: 12, title: "سؤال ثان", projectId: 1, workFileId: 10, priority: "normal" },
    ];
    const review = buildExecutiveKitchenQueue(input).filter(item => item.phase === "owner_review");
    expect(review).toHaveLength(1);
    expect(review[0]?.reviewItemCount).toBe(2);
  });

  it("keeps deferred decisions and scheduled actions out of current priority until their attention time", () => {
    const now = Date.parse("2026-09-30T08:00:00Z");
    expect(decisionNeedsAttentionNow({ decisionStatus: "required", dueAt: null }, now)).toBe(true);
    expect(decisionNeedsAttentionNow({ decisionStatus: "deferred", dueAt: "2026-10-08 18:05:00" }, now)).toBe(false);
    expect(decisionNeedsAttentionNow({ decisionStatus: "deferred", dueAt: "2026-09-29 18:05:00" }, now)).toBe(true);
    expect(actionNeedsAttentionNow({ attentionAt: "2026-10-08 18:05:00" }, now)).toBe(false);
    expect(actionNeedsAttentionNow({ attentionAt: "2026-09-29 18:05:00" }, now)).toBe(true);

    const input = seed();
    input.actions = [{ id: 41, title: "متابعة لاحقة", actionStatus: "waiting_external", projectId: 1, workFileId: 12, priority: "normal", attentionAt: "2099-01-01 00:00:00" }];
    input.decisions = [{ id: 42, title: "قرار مؤجل", decisionStatus: "deferred", projectId: 1, workFileId: 12, dueAt: "2099-01-01 00:00:00" }];
    input.draftCommunications = [];
    input.emails = [];
    input.filesWithoutNextAction = [];
    expect(buildExecutiveKitchenQueue(input)).toEqual([]);
  });

  it("turns a past confirmed meeting into one outcome-capture intervention", () => {
    const input = seed();
    input.actions = [];
    input.decisions = [];
    input.draftCommunications = [];
    input.emails = [];
    input.filesWithoutNextAction = [];
    input.meetings = [{ id: 9, title: "اجتماع Realistic", projectId: 1, workFileId: 10, startsAt: "2000-01-01 08:00:00" }];
    const [item] = buildExecutiveKitchenQueue(input);
    expect(item).toMatchObject({ kind: "meeting", phase: "act_now", ownerType: "human" });
    expect(item.title).toBe("أخبر Manus بما حدث في اجتماع Realistic");
  });

  it("keeps a finished meeting as the primary topic even when an older decision exists in the same work file", () => {
    const input = seed();
    input.actions = [];
    input.draftCommunications = [];
    input.emails = [];
    input.filesWithoutNextAction = [];
    input.decisions = [{ id: 3, title: "قرار قديم في الملف", projectId: 1, workFileId: 10, dueAt: null }];
    input.meetings = [{ id: 9, title: "اجتماع Artec مع المهندس ماجد", projectId: 1, workFileId: 10, startsAt: "2000-01-01 08:00:00" }];
    const [item] = buildExecutiveKitchenQueue(input);
    expect(item).toMatchObject({ kind: "meeting", phase: "act_now", ownerType: "human", reviewItemCount: 2 });
    expect(item.title).toBe("أخبر Manus بما حدث في اجتماع Artec مع المهندس ماجد");
  });

  it("does not query undated planned meetings as upcoming appointments", () => {
    expect(mainRouter).toContain("AND meeting.starts_at IS NOT NULL");
  });

  it("never asks again for a completed meeting outcome", () => {
    const input = { ...seed(), actions: [], decisions: [], draftCommunications: [], emails: [], filesWithoutNextAction: [],
      meetings: [{ id: 9, title: "اجتماع أرتك", meetingStatus: "completed", outcomeSummary: "حُفظت النتيجة", projectId: 6, workFileId: 390001, startsAt: "2026-09-30 08:00:00" }] };
    expect(buildExecutiveKitchenQueue(input)).toEqual([]);
    input.meetings[0] = { ...input.meetings[0], pendingProposalCount: 2 } as any;
    const [item] = buildExecutiveKitchenQueue(input);
    expect(item).toMatchObject({ phase: "owner_review", needsOutcome: false });
    expect(item.title).not.toContain("أخبر Manus بما حدث");
    expect(item.title).toContain("مراجعة المقترحات");
  });

  it("counts only inbox messages in the kitchen attention badge", () => {
    expect(mainRouter).toContain('eq(comoNextEmailMessages.folderName, "INBOX")');
    expect(mainRouter).toContain("analysis.suggested_next_step");
  });

  it("shows Manus's executive next step instead of a raw email subject", () => {
    const input = seed();
    input.actions = [];
    input.decisions = [];
    input.draftCommunications = [];
    input.meetings = [];
    input.intakeProposals = [];
    input.filesWithoutNextAction = [];
    input.emails = [{
      id: 5,
      subject: "RE: long raw subject",
      suggestedNextStep: "حسم موقف الفاتورة ومسار المشروع\nتفصيل إضافي",
      suggestedProjectId: null,
      suggestedWorkFileId: null,
      importance: "urgent",
    }];

    const [item] = buildExecutiveKitchenQueue(input);
    expect(item.title).toBe("حسم موقف الفاتورة ومسار المشروع");
    expect(item.phase).toBe("owner_review");
  });

  it("keeps updates append-only and lets Manus open safe internal work automatically", () => {
    expect(migration).toContain("CREATE TABLE como_next_work_file_updates");
    expect(migration).not.toMatch(/^\s*(DROP|TRUNCATE|DELETE|UPDATE)\s/im);
    expect(kitchenService).toContain('model: UPDATE_ANALYSIS_MODEL');
    expect(kitchenService).toContain('suggestedOwnerType');
    expect(kitchenService).toContain('analysisStatus: "applied"');
    expect(kitchenService).toContain("decisionTransition");
    expect(kitchenService).toContain("لتغيير القرار القديم نفسه");
    expect(kitchenService).toContain("نص التحديث كتبه عبد الرحمن داخل التطبيق");
    expect(kitchenService).toContain("كل مراسلة معروضة تحت قسم المراسلات المرتبطة محفوظة ومرتبطة بالملف بالفعل");
    expect(kitchenService).toContain("لا تقترح إرفاقها أو ربطها مرة أخرى");
    expect(kitchenService).toContain("ضمن الإجراءات النشطة فلا تنشئ اقتراحًا مكررًا");
    expect(kitchenService).toContain('ownerType: suggestedOwnerType');
    expect(kitchenService).toContain('startsWith("أخبر Manus بما حدث")');
    expect(kitchenService).toContain('createActionCommand');
    expect(kitchenService).not.toContain("sendReply(");
  });

  it("gives Manus the latest linked correspondence before judging an operational update", () => {
    const prompt = buildOperationalUpdatePrompt({
      workFile: {
        title: "مراجعة عرض رياليستيك المعدل",
        governingQuestion: "هل وصل تأكيد الموعد؟",
        desiredOutcome: "انتظار تأكيد موعد الاثنين",
      },
      action: {
        title: "انتظار تأكيد رياليستيك",
        actionStatus: "completed_pending_verification",
        acceptanceCriteria: "ربط دليل التأكيد",
      },
      activeActions: [{
        title: "تحضير اجتماع رياليستيك المؤكد",
        actionStatus: "open",
        acceptanceCriteria: "اكتمال محاور الاجتماع",
      }],
      update: {
        sourceChannel: "email",
        occurredAt: "2026-09-27 16:38:23",
        updateText: "تم التأكيد",
      },
      communications: [{
        id: 120013,
        direction: "inbound",
        communicationStatus: "received",
        subject: "RE: Invitation to Submit Consultancy Proposal",
        body: "Yes Confirmed",
        occurredAt: "2026-09-25 13:34:58",
        evidenceReference: "IMAP UID=436",
      }],
    });

    expect(prompt).toContain("أحدث المراسلات المرتبطة والمحفوظة بالفعل داخل الملف");
    expect(prompt).toContain("Yes Confirmed");
    expect(prompt).toContain("IMAP UID=436");
    expect(prompt).toContain("تحضير اجتماع رياليستيك المؤكد");
    expect(prompt.indexOf("انتظار تأكيد موعد الاثنين")).toBeLessThan(prompt.indexOf("Yes Confirmed"));
  });

  it("opens a queue topic on its calm dossier and drills into a record only from its stage", () => {
    expect(kitchenPage).toContain("ما الذي يحتاج إنجازًا الآن؟");
    expect(kitchenPage).toContain("visibleExecutionQueue.map");
    expect(kitchenPage).toContain('aria-label="قائمة الأعمال مرتبة من الأعلى إلى الأسفل"');
    expect(kitchenPage).toContain('<li key={item.id}><ExecutiveQueueCard');
    expect(kitchenPage).not.toContain('className="grid gap-3 sm:grid-cols-2">{data.executionQueue.length');
    expect(kitchenPage).toContain("ينفذه Manus");
    expect(kitchenPage).toContain("مطلوب منك: مراجعة أو حسم");
    expect(kitchenPage).toContain("ownerWorkCount");
    expect(kitchenPage).toContain("manusWorkCount");
    expect(kitchenPage).toContain("queueOwnerFilter");
    expect(kitchenPage).toContain('aria-pressed={queueOwnerFilter === "manus"}');
    expect(kitchenPage).toContain("فتح التقرير المحمي");
    expect(kitchenPage).toContain("/api/como-next/documents/");
    expect(kitchenPage).toContain("سلّم التوجيه إلى Manus");
    expect(kitchenPage).toContain("لن ينفذ Manus ولن تُنشأ مسودة بريد أو أثر خارجي عند الحفظ");
    expect(kitchenPage).toContain('defaultSourceChannel === "meeting"');
    expect(kitchenPage).toContain('meetingMutation.mutateAsync');
    expect(kitchenPage).toContain("سجل تسليم مختصر");
    expect(kitchenPage).toContain('meeting.startsAt && ["planned", "confirmed"].includes(meeting.meetingStatus)');
    expect(kitchenPage).toContain("activeMeetingNeedsOutcome");
    expect(kitchenPage).toContain("أخبر Manus بما حدث");
    expect(kitchenPage).toContain('defaultSourceChannel="meeting"');
    expect(kitchenPage).toContain('alwaysOpen submissionLabel="سلّم نتيجة الاجتماع إلى Manus"');
    expect(kitchenPage).toContain("مسودة محفوظة على هذا الجهاز فقط — لم تصل إلى Manus بعد");
    expect(kitchenPage).toContain("وصلت إلى Manus وحُفظت في الملف — تحديث #");
    expect(kitchenPage).toContain("وصلت النتيجة إلى Manus وحُفظت في ملف الاجتماع");
    expect(kitchenPage).toContain("meetingOutcome.id");
    expect(kitchenPage).toContain("Manus سيحلل النتيجة، يغلق الاجتماع، ويحدّث الخطوات التالية تلقائيًا");
    expect(kitchenPage).toContain('ownerCommunication?.subject');
    expect(kitchenPage).toContain('مراجعة المسودة');
    expect(kitchenPage).toContain("!activeActions.length ? <WorkFileUpdateComposer");
    expect(kitchenPage).toContain("!w-screen !max-w-none");
    expect(kitchenPage).toContain('if (item.workFileId && ["action", "decision", "communication", "meeting"].includes(item.kind)) return openWorkFile(item.workFileId);');
    expect(kitchenPage).toContain('item.kind === "meeting" && item.needsOutcome');
    expect(kitchenPage).toContain('openFocusedRecord(item.workFileId, "meeting", item.recordId)');
    expect(kitchenPage).not.toContain('if (item.kind === "action") return openWorkFile(item.workFileId, item.recordId);');
  });

  it("schedules read-only import and retryable analysis through signed task identities", () => {
    expect(migration).toContain("CREATE TABLE como_next_email_sync_settings");
    expect(scheduleRoute).toContain("caller.isCron");
    expect(scheduleRoute).not.toContain("req.body?.taskUid");
    expect(scheduleRoute).toContain("scheduleCronTaskUid, taskUid");
    expect(scheduleRoute).toContain("settings.isEnabled !== 1");
    expect(scheduleRoute).toContain("syncReadonlyInboxCommand");
    expect(scheduleRoute).toContain("processPendingReadonlyMailboxCommand");
    expect(scheduleRoute).toContain("serverFlagsChanged: false");
    expect(scheduleRoute).toContain('lastStatus: "failed"');
    expect(scheduleRoute).not.toContain("sendReply");
    expect(emailPage).not.toContain("06:00 · 11:00 · 17:00 بتوقيت دبي");
    expect(emailPage).toContain("نصف ساعة");
  });
});
