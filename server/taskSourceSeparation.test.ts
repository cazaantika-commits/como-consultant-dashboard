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

  it("separates work tasks, meeting follow-ups, and approved changes in the home summary", () => {
    expect(home).toContain("مهام عمل");
    expect(home).toContain("متابعات اجتماعات");
    expect(home).toContain("تغييرات معتمدة");
  });

  it("cancels or renews tasks without exposing permanent task deletion", () => {
    expect(taskRouter).toContain("renew: publicProcedure");
    expect(taskRouter).toContain("تجديد يدوي من المهمة الأصلية");
    expect(taskRouter).not.toContain("delete: publicProcedure");
    expect(tasksPage).toContain("إلغاء مع حفظ السجل");
    expect(tasksPage).toContain("تجديد كمهمة جديدة");
    expect(tasksPage).toContain("مراجعة");
    expect(tasksPage).toContain("إلغاء");
    expect(tasksPage).toContain("تجديد");
    expect(tasksPage).not.toContain("title=\"حذف\"");
  });
});
