import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("project context persistence", () => {
  it("re-reads the selected project from browser storage after client hydration", () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), "client/src/contexts/ProjectContext.tsx"),
      "utf8",
    );

    expect(source).toContain('const STORAGE_KEY = "como_selected_project_id"');
    expect(source).toContain("useEffect(() => {");
    expect(source).toContain("const savedProjectId = saved ? Number(saved) : null");
    expect(source).toContain("setSelectedProjectIdState(savedProjectId)");
  });
});
