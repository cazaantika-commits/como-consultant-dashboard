import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const root = "/home/ubuntu/como-consultant-dashboard";
const summaryRouter = readFileSync(`${root}/server/routers/projectLaunchGate.ts`, "utf8");
const taskRouter = readFileSync(`${root}/server/routers/tasks.ts`, "utf8");
const home = readFileSync(`${root}/client/src/pages/Home.tsx`, "utf8");
const sara = readFileSync(`${root}/client/src/pages/SaraPage.tsx`, "utf8");
const tasksPage = readFileSync(`${root}/client/src/pages/TasksPage.tsx`, "utf8");

describe("task source separation and preservation", () => {
  it("keeps the retired legacy owner summary absent from the project launch router", () => {
    expect(summaryRouter).not.toContain("getOwnerSummary");
    expect(summaryRouter).not.toContain("from(tasks)");
    expect(summaryRouter).not.toContain("from(meetings)");
  });

  it("keeps legacy task and meeting sources out of the rebuilt homepage", () => {
    expect(home).not.toContain("trpc.tasks.stats.useQuery");
    expect(home).not.toContain("trpc.meetings.list.useQuery");
    expect(home).not.toContain("projectLaunchGate.getOwnerSummary.useQuery");
    expect(home).not.toContain("trpc.comoNext.getOverview.useQuery");
    expect(sara).toContain("trpc.comoNext.getOverview.useQuery");
    expect(sara).not.toContain("trpc.tasks.stats.useQuery");
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
