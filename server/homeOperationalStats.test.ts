import { expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = readFileSync("client/src/pages/Home.tsx", "utf8");

it("uses source-backed operational metrics instead of placeholder homepage counts", () => {
  expect(source).toContain("trpc.projects.list.useQuery");
  expect(source).toContain("trpc.tasks.stats.useQuery");
  expect(source).toContain("trpc.meetings.list.useQuery");
  expect(source).toContain("{homepageProjects.length}");
  expect(source).toContain("{openTaskCount}");
  expect(source).toContain("{preparingMeetingCount}");
  expect(source).toContain("{overdueCount}");
  expect(source).not.toContain("badge: 5");
  expect(source).not.toContain("badge: 2");
});

it("organizes tools into owner operations, project intelligence, and system services without changing routes", () => {
  expect(source).toContain('title: "تشغيل المالك"');
  expect(source).toContain('title: "استخبارات المشروع"');
  expect(source).toContain('title: "خدمات النظام"');
  expect(source).toContain('source: "مصادر حية: المهام، الاجتماعات، وعروض الاستشاريين."');
  expect(source).toContain('source: "مصادر مرجعية: تقارير السوق، المعرفة، وسجل الدقة."');
  expect(source).toContain('source: "مصادر خلفية: Google Drive، الوكلاء، والتكليفات والإدارة."');
  expect(source).toContain('layer: "owner"');
  expect(source).toContain('layer: "intelligence"');
  expect(source).toContain('layer: "services"');
  expect(source).toContain('path: "/tasks"');
  expect(source).toContain('path: "/market-reports"');
  expect(source).toContain('path: "/drive"');
});
