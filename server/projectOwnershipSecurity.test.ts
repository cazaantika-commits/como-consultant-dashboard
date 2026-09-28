import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dbSource = readFileSync("server/db.ts", "utf8");
const projectsRouter = readFileSync("server/routers/projects.ts", "utf8");

describe("official project ownership security", () => {
  it("filters list, read, update, and delete by the authenticated owner", () => {
    expect(projectsRouter).toContain("return getUserProjects(ctx.user.id)");
    expect(projectsRouter).toContain("const projects = await getUserProjects(ctx.user.id)");
    expect(dbSource).toContain("and(eq(projects.id, projectId), eq(projects.userId, userId))");
    expect(dbSource).toContain("db.update(projects).set(convertedData).where(and(eq(projects.id, projectId), eq(projects.userId, userId)))");
    expect(dbSource).toContain("db.delete(projects).where(and(eq(projects.id, projectId), eq(projects.userId, userId)))");
  });
});
