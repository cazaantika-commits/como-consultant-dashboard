import { expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = readFileSync("client/src/pages/Home.tsx", "utf8");

it("keeps the authenticated homepage as a route-only gateway without an operational digest", () => {
  expect(source).toContain("إلى أين تريد أن تذهب؟");
  expect(source).toContain("اليوم مع سارة");
  expect(source).not.toContain("trpc.comoNext.getOverview.useQuery");
  expect(source).not.toContain("قرارات تنتظر اعتمادك");
  expect(source).not.toContain("استحقاقات اليوم");
  expect(source).not.toContain("مسودات للمراجعة");
  expect(source).not.toContain("اجتماعات تحتاج متابعة");
  expect(source).not.toContain("trpc.projects.list.useQuery");
  expect(source).not.toContain("trpc.tasks.stats.useQuery");
  expect(source).not.toContain("trpc.meetings.list.useQuery");
  expect(source).not.toContain("projectLaunchGate.getOwnerSummary.useQuery");
  expect(source).not.toContain("NewsTicker");
});

it("keeps the rebuilt homepage focused on five direct destinations and four protected workspaces", () => {
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
  expect(source).toContain('id: "sara-today"');
  expect(source).toContain('path: "/sara"');
  expect(source).toContain('id: "project-opening"');
  expect(source).toContain('path: "/como-next/project-opening"');
  expect(source).not.toContain("SARA_PORTRAIT");
  expect(source).not.toContain("فريق الوكلاء");
});
