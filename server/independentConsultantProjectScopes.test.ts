import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import mysql from "mysql2/promise";

const root = "/home/ubuntu/como-consultant-dashboard";
const cpaRouter = readFileSync(`${root}/server/routers/cpa.ts`, "utf8");
const requirementsRouter = readFileSync(`${root}/server/routers/consultantRequirements.ts`, "utf8");
const cpaPage = readFileSync(`${root}/client/src/pages/CPAPage.tsx`, "utf8");
const projectScopeComponent = readFileSync(`${root}/client/src/components/consultant/ProjectConsultantRequirements.tsx`, "utf8");
const appointmentPackRouter = readFileSync(`${root}/server/routers/consultantAppointmentPack.ts`, "utf8");
const procurementRouter = readFileSync(`${root}/server/routers/consultantProcurement.ts`, "utf8");
const commandCenterRouter = readFileSync(`${root}/server/routers/commandCenter.ts`, "utf8");
const migration = readFileSync(`${root}/drizzle/0070_independent_consultant_project_scopes.sql`, "utf8");

let connection: mysql.Connection;

beforeAll(async () => {
  connection = await mysql.createConnection(process.env.DATABASE_URL!);
});

afterAll(async () => {
  await connection.end();
});

describe("independent consultant project scope contracts", () => {
  it("creates a blank independent scope for every new project without a category input", () => {
    const projectsRouter = cpaRouter.slice(cpaRouter.indexOf("projects: router({"), cpaRouter.indexOf("// ---- Project Consultants ----"));
    expect(projectsRouter).toContain("createBlankProjectRequirementSet");
    expect(projectsRouter).toContain("requirementSetId");
    expect(projectsRouter).not.toContain("buildingCategoryId");
    expect(projectsRouter).not.toContain("projectType");
    expect(cpaPage.slice(cpaPage.indexOf("function ProjectListScreen"), cpaPage.indexOf("function ProjectDetailScreen"))).not.toContain("فئة المبنى");
    expect(cpaPage.slice(cpaPage.indexOf("function ProjectListScreen"), cpaPage.indexOf("function ProjectDetailScreen"))).not.toContain("نوع المشروع");
  });

  it("saves only project selection ids and exposes no custom-item addition", () => {
    expect(requirementsRouter).toContain("saveSelection");
    expect(requirementsRouter).toContain("WHERE requirement_set_id = ${input.setId}");
    expect(requirementsRouter).not.toContain("addCustomRequirement");
    expect(projectScopeComponent).toContain("حفظ الاختيارات");
    expect(projectScopeComponent).toContain("نسخة مستقلة خاصة بهذا المشروع");
    expect(projectScopeComponent).not.toContain("بند خاص بالمشروع");
  });

  it("uses project requirements in calculations, procurement and Command Center reports", () => {
    const calculationEngine = cpaRouter.slice(cpaRouter.indexOf("export async function runCalculationEngine"), cpaRouter.indexOf("export const cpaRouter"));
    expect(calculationEngine).toContain("project_consultant_requirements");
    expect(calculationEngine).not.toContain("cpa_scope_category_matrix");
    expect(calculationEngine).not.toContain("cpa_supervision_baseline");
    expect(procurementRouter).toContain("نطاق المشروع المستقل");
    expect(appointmentPackRouter).toContain("projectConsultantRequirements");
    expect(commandCenterRouter.slice(commandCenterRouter.indexOf("getDesignScopeReport"), commandCenterRouter.indexOf("saveTrueCostOverride"))).toContain("project_consultant_requirements");
  });

  it("backfill migration is idempotent and never mutates the library or legacy tables", () => {
    expect(migration).toContain("NOT EXISTS");
    expect(migration).toContain("INSERT INTO project_consultant_requirement_sets");
    expect(migration).toContain("INSERT INTO project_consultant_requirements");
    expect(migration).not.toMatch(/UPDATE\s+consultant_requirement_reference_items/i);
    expect(migration).not.toMatch(/DELETE\s+FROM/i);
    expect(migration).not.toMatch(/UPDATE\s+cpa_/i);
  });
});

describe("independent consultant project scope data", () => {
  it("gives every current CPA project one independent full-library snapshot", async () => {
    const [rows] = await connection.execute(`
      SELECT cp.id, cp.project_id, active_set.id AS set_id,
             COUNT(requirement.id) AS snapshot_count,
             (SELECT COUNT(*) FROM consultant_requirement_reference_items WHERE is_active = 1) AS library_count
      FROM cpa_projects cp
      LEFT JOIN project_consultant_requirement_sets active_set
        ON active_set.project_id = cp.project_id AND active_set.status IN ('DRAFT', 'APPROVED')
      LEFT JOIN project_consultant_requirements requirement ON requirement.requirement_set_id = active_set.id
      GROUP BY cp.id, cp.project_id, active_set.id
      ORDER BY cp.id
    `) as any;
    expect(rows.length).toBeGreaterThan(0);
    expect(new Set(rows.map((row: any) => Number(row.set_id))).size).toBe(rows.length);
    for (const row of rows) {
      expect(Number(row.set_id)).toBeGreaterThan(0);
      expect(Number(row.snapshot_count)).toBe(Number(row.library_count));
    }
  });

  it("seeds each design selection from that project's previous effective scope", async () => {
    const [rows] = await connection.execute(`
      SELECT cp.id,
             COUNT(DISTINCT CASE WHEN matrix.status <> 'NOT_REQUIRED' THEN matrix.scope_item_id END) AS legacy_count,
             COUNT(DISTINCT CASE WHEN requirement.is_required = 1 AND reference_item.source_type = 'LEGACY_SCOPE' THEN reference_item.legacy_scope_item_id END) AS independent_count
      FROM cpa_projects cp
      JOIN project_consultant_requirement_sets active_set
        ON active_set.project_id = cp.project_id AND active_set.status IN ('DRAFT', 'APPROVED')
      JOIN project_consultant_requirements requirement ON requirement.requirement_set_id = active_set.id
      JOIN consultant_requirement_reference_items reference_item ON reference_item.id = requirement.reference_item_id
      LEFT JOIN cpa_scope_category_matrix matrix ON matrix.building_category_id = cp.building_category_id
      GROUP BY cp.id
      ORDER BY cp.id
    `) as any;
    for (const row of rows) expect(Number(row.independent_count)).toBe(Number(row.legacy_count));
  });

  it("keeps projects that shared one old category in separate requirement sets", async () => {
    const [rows] = await connection.execute(`
      SELECT cp.building_category_id, COUNT(*) AS project_count,
             COUNT(DISTINCT active_set.id) AS independent_set_count
      FROM cpa_projects cp
      JOIN project_consultant_requirement_sets active_set
        ON active_set.project_id = cp.project_id AND active_set.status IN ('DRAFT', 'APPROVED')
      GROUP BY cp.building_category_id
      HAVING COUNT(*) > 1
    `) as any;
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(Number(row.independent_set_count)).toBe(Number(row.project_count));
  });
});
