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
