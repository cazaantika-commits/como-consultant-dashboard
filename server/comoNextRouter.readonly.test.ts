import { describe, expect, it } from "vitest";
import type { TrpcContext } from "./_core/context";
import { comoNextRouter } from "./routers/comoNext";

function context(userId: number): TrpcContext {
  return {
    user: {
      id: userId,
      openId: `como-next-test-${userId}`,
      email: `como-next-${userId}@example.com`,
      name: "COMO Next Test",
      loginMethod: "test",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("COMO Next read-only router", () => {
  it("returns only the authenticated user's official projects", async () => {
    const caller = comoNextRouter.createCaller(context(1));
    const projects = await caller.listProjects();
    expect(projects.length).toBeGreaterThan(0);
    expect(projects.some(project => project.name.includes("المشروع التجريبي"))).toBe(false);
  });

  it("does not expose another user's projects or work files", async () => {
    const caller = comoNextRouter.createCaller(context(999_999_999));
    expect(await caller.listProjects()).toEqual([]);
    const overview = await caller.getOverview();
    expect(overview.workFiles).toEqual([]);
    expect(overview.today.summary.dueToday).toBe(0);
  });
});
