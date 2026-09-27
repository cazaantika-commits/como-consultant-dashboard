import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildExecutiveKitchenQueue } from "./services/comoNextKitchen";

const migration = readFileSync("drizzle/0093_como_next_executive_kitchen.sql", "utf8");
const kitchenService = readFileSync("server/services/comoNextKitchen.ts", "utf8");
const kitchenPage = readFileSync("client/src/pages/ComoNextTodayPage.tsx", "utf8");
const scheduleRoute = readFileSync("server/scheduledEmailSyncRoute.ts", "utf8");
const emailPage = readFileSync("client/src/components/ComoNextEmailInbox.tsx", "utf8");

function seed() {
  return {
    actions: [
      { id: 1, title: "بانتظار الرد", actionStatus: "waiting_external", projectId: 1, workFileId: 10, priority: "urgent", attentionAt: "2026-09-27 09:00:00" },
      { id: 2, title: "تحقق من المستند", actionStatus: "completed_pending_verification", projectId: 1, workFileId: 10, priority: "normal", attentionAt: "2026-09-27 08:00:00" },
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
  it("unifies every operational type and prioritizes owner review before passive waiting", () => {
    const queue = buildExecutiveKitchenQueue(seed());
    expect(queue).toHaveLength(6);
    expect(queue[0]?.phase).toBe("owner_review");
    expect(queue.find(item => item.kind === "email")?.title).toBe("رسالة تحتاج ربطًا");
    expect(queue.at(-1)?.phase).toBe("waiting_external");
  });

  it("keeps operational updates append-only and Manus suggestions review-only", () => {
    expect(migration).toContain("CREATE TABLE como_next_work_file_updates");
    expect(migration).not.toMatch(/^\s*(DROP|TRUNCATE|DELETE|UPDATE)\s/im);
    expect(kitchenService).toContain('model: UPDATE_ANALYSIS_MODEL');
    expect(kitchenService).toContain('analysisStatus: "draft"');
    expect(kitchenService).toContain('input.decision === "dismiss"');
    expect(kitchenService).toContain('createActionCommand');
    expect(kitchenService).not.toContain("sendReply(");
  });

  it("opens on one title-only Now queue and preserves full focus for one record", () => {
    expect(kitchenPage).toContain("العمل الآن");
    expect(kitchenPage).toContain("data.executionQueue.map");
    expect(kitchenPage).toContain("حفظ وتحليل الخطوة التالية");
    expect(kitchenPage).toContain("تحويلها إلى إجراء");
    expect(kitchenPage).toContain("!w-screen !max-w-none");
  });

  it("schedules read-only inbox sync only through authenticated configured task UID", () => {
    expect(migration).toContain("CREATE TABLE como_next_email_sync_settings");
    expect(scheduleRoute).toContain("caller.isCron");
    expect(scheduleRoute).toContain("scheduleCronTaskUid, taskUid");
    expect(scheduleRoute).toContain("settings.isEnabled !== 1");
    expect(scheduleRoute).toContain("syncReadonlyInboxCommand");
    expect(scheduleRoute).toContain("serverFlagsChanged: false");
    expect(scheduleRoute).not.toContain("analyzeEmailCommand");
    expect(scheduleRoute).not.toContain("sendReply");
    expect(emailPage).toContain("تحديث مقروء فقط كل ساعة");
  });
});
