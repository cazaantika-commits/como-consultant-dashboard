import { expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = readFileSync("client/src/pages/Home.tsx", "utf8");

it("uses COMO Next as the authenticated homepage's only operational source", () => {
  expect(source).toContain("trpc.comoNext.getOverview.useQuery");
  expect(source).toContain("من COMO Next فقط");
  expect(source).toContain("قرارات تنتظر اعتمادك");
  expect(source).toContain("استحقاقات اليوم");
  expect(source).toContain("مسودات للمراجعة");
  expect(source).toContain("اجتماعات تحتاج متابعة");
  expect(source).not.toContain("trpc.projects.list.useQuery");
  expect(source).not.toContain("trpc.tasks.stats.useQuery");
  expect(source).not.toContain("trpc.meetings.list.useQuery");
  expect(source).not.toContain("projectLaunchGate.getOwnerSummary.useQuery");
  expect(source).not.toContain("NewsTicker");
});

it("keeps the rebuilt homepage focused on Sara and six deliberate workspaces", () => {
  expect(source).toContain('id: "project-management"');
  expect(source).toContain('path: "/project-management"');
  expect(source).toContain('id: "executive-office"');
  expect(source).toContain('path: "/como-next"');
  expect(source).toContain('id: "financial-studies"');
  expect(source).toContain('path: "/bateekha"');
  expect(source).toContain('id: "consultants"');
  expect(source).toContain('path: "/consultant-portal"');
  expect(source).toContain('id: "knowledge"');
  expect(source).toContain('path: "/knowledge-analysis"');
  expect(source).toContain('id: "development-tour"');
  expect(source).toContain('path: "/development-phases"');
  expect(source).toContain("سارة · واجهة التواصل");
  expect(source).toContain("Manus · العقل التنفيذي عند التكليف");
  expect(source).not.toContain("فريق الوكلاء");
});
