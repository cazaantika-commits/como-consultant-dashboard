import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const root = "/home/ubuntu/como-consultant-dashboard";
const schema = readFileSync(`${root}/drizzle/schema.ts`, "utf8");
const migration = readFileSync(`${root}/drizzle/0076_isolated_test_project.sql`, "utf8");
const service = readFileSync(`${root}/server/isolatedTestProject.ts`, "utf8");
const projectsRouter = readFileSync(`${root}/server/routers/projects.ts`, "utf8");
const db = readFileSync(`${root}/server/db.ts`, "utf8");
const cashFlowSettings = readFileSync(`${root}/server/routers/cashFlowSettings.ts`, "utf8");
const cashFlowProgram = readFileSync(`${root}/server/routers/cashFlowProgram.ts`, "utf8");
const commandCenter = readFileSync(`${root}/server/routers/commandCenter.ts`, "utf8");
const laylaContext = readFileSync(`${root}/server/laylaCommandCenterContext.ts`, "utf8");
const cpaRouter = readFileSync(`${root}/server/routers/cpa.ts`, "utf8");
const agentChat = readFileSync(`${root}/server/agentChat.ts`, "utf8");
const agentTools = readFileSync(`${root}/server/agentTools.ts`, "utf8");
const emailIntegration = readFileSync(`${root}/server/emailIntegration.ts`, "utf8");
const contractsRouter = readFileSync(`${root}/server/routers/contracts.ts`, "utf8");
const testPage = readFileSync(`${root}/client/src/pages/TestProjectPage.tsx`, "utf8");
const bateekhaPage = readFileSync(`${root}/client/src/pages/BateekhaPage.tsx`, "utf8");
const app = readFileSync(`${root}/client/src/App.tsx`, "utf8");
const home = readFileSync(`${root}/client/src/pages/Home.tsx`, "utf8");

describe("isolated test project contract", () => {
  it("marks the record explicitly and adds the database column non-destructively", () => {
    expect(schema).toContain("isTestProject: tinyint('is_test_project').notNull().default(0)");
    expect(migration).toContain("ADD COLUMN is_test_project TINYINT NOT NULL DEFAULT 0");
    expect(migration).not.toMatch(/DROP\s+(TABLE|COLUMN)/i);
    expect(migration).not.toMatch(/DELETE\s+FROM/i);
  });

  it("creates one reusable empty project with the same CPA project and 43-item design scope", () => {
    expect(service).toContain("ISOLATED_TEST_PROJECT");
    expect(service).toContain("is_test_project = 1");
    expect(service).toContain("INSERT INTO projects");
    expect(service).toContain("INSERT INTO cpa_projects");
    expect(service).toContain("INSERT INTO project_consultant_requirement_sets");
    expect(service).toContain("INSERT INTO project_consultant_requirements");
    expect(service).toContain("Number(countRows[0]?.itemCount) !== 43");
    expect(service).not.toContain("pricePerSqft:");
    expect(service).not.toContain("landPrice:");
    expect(service).not.toContain("constructionCost:");
  });

  it("exposes a dedicated authenticated entry and reuses the real project cards", () => {
    expect(projectsRouter).toContain("getTestProject");
    expect(projectsRouter).toContain("ensureTestProject");
    expect(testPage).toContain('<BateekhaPage');
    expect(testPage).toContain('mode="test"');
    expect(app).toContain('<Route path="/test-project" component={TestProjectPage} />');
    expect(home).toContain('path: "/test-project"');
    expect(home).toContain("المشروع التجريبي");
  });

  it("keeps every existing study card available in test mode plus the consultant-scope card", () => {
    for (const section of [
      "general",
      "units",
      "construction",
      "sales",
      "timeline",
      "settings",
      "cashflows",
      "escrow",
      "feasibility",
      "mall",
    ]) {
      expect(bateekhaPage).toContain(`id: "${section}"`);
    }
    expect(bateekhaPage).toContain("نطاق التصميم والعروض");
    expect(bateekhaPage).toContain("testCpaProjectId");
    expect(bateekhaPage).toContain("min-h-screen w-full min-w-0 overflow-x-hidden");
  });

  it("excludes test projects from official project lists and financial aggregation sources", () => {
    expect(db).toContain("eq(projects.isTestProject, 0)");
    expect(cpaRouter).toContain("WHERE is_test_project = 0");
    expect(cashFlowSettings.match(/eq\(projects\.isTestProject, 0\)/g)?.length).toBeGreaterThanOrEqual(7);
    expect(cashFlowProgram.match(/eq\(projects\.isTestProject, 0\)/g)?.length).toBeGreaterThanOrEqual(5);
  });

  it("excludes the test project from Command Center and Layla executive context", () => {
    expect(commandCenter.match(/eq\(projects\.isTestProject, 0\)/g)?.length).toBeGreaterThanOrEqual(4);
    expect(laylaContext).toContain("eq(schema.projects.isTestProject, 0)");
  });

  it("keeps the isolated record out of agent discovery, email matching, and official contract listings", () => {
    expect(agentChat).toContain("where(eq(projects.isTestProject, 0)).limit(10)");
    expect(agentTools.match(/eq\(projects\.isTestProject, 0\)/g)?.length).toBeGreaterThanOrEqual(2);
    expect(emailIntegration).toContain("eq(projects.isTestProject, 0)");
    expect(contractsRouter).toContain("where(eq(projects.isTestProject, 0))");
    expect(contractsRouter).toContain("contracts.filter(c => projectsList.some");
  });
});
