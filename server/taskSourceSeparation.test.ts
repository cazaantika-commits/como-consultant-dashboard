import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const root = "/home/ubuntu/como-consultant-dashboard";
const summaryRouter = readFileSync(`${root}/server/routers/projectLaunchGate.ts`, "utf8");
const taskRouter = readFileSync(`${root}/server/routers/tasks.ts`, "utf8");
const home = readFileSync(`${root}/client/src/pages/Home.tsx`, "utf8");
const tasksPage = readFileSync(`${root}/client/src/pages/TasksPage.tsx`, "utf8");

describe("task source separation and preservation", () => {
  it("does not promote held tasks or stale meetings into the current owner summary", () => {
    expect(summaryRouter).toContain('["new", "progress"].includes(task.status)');
    expect(summaryRouter).toContain("recentMeetingCutoff");
  });

  it("keeps legacy task and meeting sources out of the rebuilt homepage", () => {
    expect(home).not.toContain("trpc.tasks.stats.useQuery");
    expect(home).not.toContain("trpc.meetings.list.useQuery");
    expect(home).not.toContain("projectLaunchGate.getOwnerSummary.useQuery");
    expect(home).toContain("trpc.comoNext.getOverview.useQuery");
    expect(home).toContain("من COMO Next فقط");
  });

  it("cancels or renews tasks without exposing permanent task deletion", () => {
    expect(taskRouter).toContain("renew: publicProcedure");
    expect(taskRouter).toContain("تجديد يدوي من المهمة الأصلية");
    expect(taskRouter).not.toContain("delete: publicProcedure");
    expect(tasksPage).toContain("إلغاء مع حفظ السجل");
    expect(tasksPage).toContain("تجديد كمهمة جديدة");
    expect(tasksPage).toContain("مراجعة");
    expect(tasksPage).toContain("إلغاء");
    expect(tasksPage).toContain("إلغاء");
    expect(tasksPage).toContain("مراجعة البنود القديمة");
    expect(tasksPage).toContain("legacyReviewOnly");
    expect(tasksPage).not.toContain("title=\"حذف\"");
  });
});
