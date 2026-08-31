import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import mysql from "mysql2/promise";

const root = "/home/ubuntu/como-consultant-dashboard";
const cpaRouter = readFileSync(`${root}/server/routers/cpa.ts`, "utf8");
const requirementsRouter = readFileSync(`${root}/server/routers/consultantRequirements.ts`, "utf8");
const cpaPage = readFileSync(`${root}/client/src/pages/CPAPage.tsx`, "utf8");
const projectScopeComponent = readFileSync(`${root}/client/src/components/consultant/ProjectConsultantRequirements.tsx`, "utf8");
const migration = readFileSync(`${root}/drizzle/0073_design_only_project_scope_snapshots.sql`, "utf8");

let connection: mysql.Connection;

beforeAll(async () => {
  connection = await mysql.createConnection(process.env.DATABASE_URL!);
});

afterAll(async () => {
  await connection.end();
});

describe("independent design-only project scope contracts", () => {
  it("creates every new project without category-driven scope and copies design rows only", () => {
    const projectsRouter = cpaRouter.slice(cpaRouter.indexOf("projects: router({"), cpaRouter.indexOf("// ---- Project Consultants ----"));
    expect(projectsRouter).toContain("createBlankProjectRequirementSet");
    expect(projectsRouter).not.toContain("buildingCategoryId");
    expect(projectsRouter).not.toContain("projectType");
    expect(cpaRouter.slice(cpaRouter.indexOf("async function createBlankProjectRequirementSet"), cpaRouter.indexOf("// ---- Calculation Engine"))).toContain("workstream = 'DESIGN'");
    expect(cpaPage.slice(cpaPage.indexOf("function ProjectListScreen"), cpaPage.indexOf("function ProjectDetailScreen"))).not.toContain("فئة المبنى");
  });

  it("allows independent selection and approval from the final 42-item design encyclopedia only", () => {
    expect(requirementsRouter).toContain("saveSelection");
    expect(requirementsRouter).toContain("AND workstream = 'DESIGN'");
    expect(requirementsRouter).toContain("موسوعة التصميم النهائية ذات 42 بندًا فقط");
    expect(projectScopeComponent).toContain("نسخة مستقلة خاصة بمشروع");
    expect(projectScopeComponent).toContain("مختار من {requirements.length}");
    expect(projectScopeComponent).toContain("اعتماد نطاق التصميم");
    expect(projectScopeComponent).not.toContain("نطاق الإشراف");
    expect(projectScopeComponent).not.toContain("قيمة الفجوة / المعدل");
  });

  it("keeps the calculation engine and downstream results in place while replacing only their scope input", () => {
    const calculationEngine = cpaRouter.slice(cpaRouter.indexOf("export async function runCalculationEngine"), cpaRouter.indexOf("export const cpaRouter"));
    expect(calculationEngine).toContain("project_consultant_requirements");
    expect(calculationEngine).toContain("cpa_consultant_scope_coverage");
    expect(calculationEngine).not.toContain("cpa_scope_category_matrix");
    expect(cpaRouter).toContain("getResults");
    expect(cpaRouter).toContain("getFullReport");
  });

  it("uses a non-destructive revision migration and never updates offers, supervision teams, or evaluation results", () => {
    expect(migration).toContain("DESIGN_SCOPE_ENCYCLOPEDIA_V1");
    expect(migration).toContain("INSERT INTO project_consultant_requirement_sets");
    expect(migration).toContain("INSERT INTO project_consultant_requirements");
    expect(migration).not.toMatch(/DELETE\s+FROM/i);
    expect(migration).not.toMatch(/UPDATE\s+cpa_project_consultants/i);
    expect(migration).not.toMatch(/UPDATE\s+cpa_consultant_supervision_team/i);
    expect(migration).not.toMatch(/UPDATE\s+cpa_evaluation_results/i);
  });
});

describe("independent design-only project scope data", () => {
  it("keeps one current independent 42-row design snapshot for every CPA project", async () => {
    const [rows] = await connection.execute(`
      SELECT cp.id, cp.project_id, active_set.id AS set_id,
             COUNT(requirement.id) AS item_count,
             SUM(CASE WHEN requirement.workstream = 'DESIGN' THEN 1 ELSE 0 END) AS design_count,
             SUM(CASE WHEN requirement.workstream <> 'DESIGN' THEN 1 ELSE 0 END) AS non_design_count,
             COUNT(DISTINCT requirement.requirement_group) AS group_count
      FROM cpa_projects cp
      JOIN project_consultant_requirement_sets active_set
        ON active_set.project_id = cp.project_id AND active_set.status = 'DRAFT'
       AND active_set.notes LIKE 'DESIGN_SCOPE_ENCYCLOPEDIA_V1%'
      LEFT JOIN project_consultant_requirements requirement ON requirement.requirement_set_id = active_set.id
      GROUP BY cp.id, cp.project_id, active_set.id
      ORDER BY cp.id
    `) as any;
    expect(rows).toHaveLength(6);
    expect(new Set(rows.map((row: any) => Number(row.set_id))).size).toBe(rows.length);
    for (const row of rows) {
      expect(Number(row.item_count)).toBe(42);
      expect(Number(row.design_count)).toBe(42);
      expect(Number(row.non_design_count)).toBe(0);
      expect(Number(row.group_count)).toBe(5);
    }
  });

  it("keeps legal and supervision rows out of every current design snapshot", async () => {
    const [rows] = await connection.execute(`
      SELECT requirement.code, requirement.workstream, requirement.requirement_group
      FROM project_consultant_requirement_sets active_set
      JOIN project_consultant_requirements requirement ON requirement.requirement_set_id = active_set.id
      WHERE active_set.status = 'DRAFT'
        AND active_set.notes LIKE 'DESIGN_SCOPE_ENCYCLOPEDIA_V1%'
        AND (
          requirement.workstream <> 'DESIGN'
          OR requirement.code IN ('FIDIC_CONTRACT','DIAC','PI_INSURANCE','PL_INSURANCE','GOVERNING_LAW','RETENTION','FEE_CAP','CONFIDENTIALITY','IP','TERMINATION')
        )
    `) as any;
    expect(rows).toHaveLength(0);
  });

  it("preserves the previous ARTEC revisions and their supervision selections as history", async () => {
    const [rows] = await connection.execute(`
      SELECT old_set.project_id, old_set.status,
             SUM(CASE WHEN requirement.workstream = 'SUPERVISION' AND requirement.is_required = 1 THEN 1 ELSE 0 END) AS supervision_count
      FROM project_consultant_requirement_sets old_set
      JOIN project_consultant_requirements requirement ON requirement.requirement_set_id = old_set.id
      WHERE old_set.notes LIKE 'ARTEC_SCOPE_BASELINE_V1%'
      GROUP BY old_set.project_id, old_set.status
      ORDER BY old_set.project_id
    `) as any;
    expect(rows).toHaveLength(6);
    for (const row of rows) {
      expect(row.status).toBe("REPLACED");
      expect(Number(row.supervision_count)).toBeGreaterThan(0);
    }
  });

  it("carries forward only documented design selections as an editable starting point", async () => {
    const [rows] = await connection.execute(`
      SELECT cp.plot_number,
             SUM(CASE WHEN requirement.is_required = 1 THEN 1 ELSE 0 END) AS selected_count
      FROM cpa_projects cp
      JOIN project_consultant_requirement_sets active_set
        ON active_set.project_id = cp.project_id AND active_set.status = 'DRAFT'
       AND active_set.notes LIKE 'DESIGN_SCOPE_ENCYCLOPEDIA_V1%'
      JOIN project_consultant_requirements requirement ON requirement.requirement_set_id = active_set.id
      GROUP BY cp.plot_number
      ORDER BY cp.plot_number
    `) as any;
    const expected: Record<string, number> = {
      "6457956": 21,
      "6457879": 21,
      "3260885": 11,
      "6185392": 18,
      "6182776": 11,
      "6180578": 10,
    };
    expect(rows).toHaveLength(6);
    for (const row of rows) expect(Number(row.selected_count)).toBe(expected[String(row.plot_number)]);
  });
});
