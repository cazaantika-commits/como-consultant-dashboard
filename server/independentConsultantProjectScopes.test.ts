import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import mysql from "mysql2/promise";
import { runCalculationEngine } from "./routers/cpa";

const root = "/home/ubuntu/como-consultant-dashboard";
const cpaRouter = readFileSync(`${root}/server/routers/cpa.ts`, "utf8");
const requirementsRouter = readFileSync(`${root}/server/routers/consultantRequirements.ts`, "utf8");
const cpaPage = readFileSync(`${root}/client/src/pages/CPAPage.tsx`, "utf8");
const projectScopeComponent = readFileSync(`${root}/client/src/components/consultant/ProjectConsultantRequirements.tsx`, "utf8");
const appointmentPackRouter = readFileSync(`${root}/server/routers/consultantAppointmentPack.ts`, "utf8");
const procurementRouter = readFileSync(`${root}/server/routers/consultantProcurement.ts`, "utf8");
const commandCenterRouter = readFileSync(`${root}/server/routers/commandCenter.ts`, "utf8");
const migration = readFileSync(`${root}/drizzle/0070_independent_consultant_project_scopes.sql`, "utf8");
const articMigration = readFileSync(`${root}/drizzle/0071_artic_project_scope_baselines.sql`, "utf8");
const articMapping = readFileSync(`${root}/docs/artic-project-scope-baseline.md`, "utf8");

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
    expect(projectScopeComponent).toContain("نسخة مستقلة خاصة بمشروع");
    expect(projectScopeComponent).not.toContain("بند خاص بالمشروع");
    expect(projectScopeComponent).toContain("المدة (شهر)");
    expect(projectScopeComponent).toContain("المصدر: عرض ARTEC");
    expect(cpaPage).toContain("فتح وتعديل نطاق المشروع");
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

  it("maps the owner-provided ARTEC schedule by plot without changing fees or the reference library", () => {
    expect(articMigration).toContain("ARTEC_SCOPE_BASELINE_V1");
    expect(articMigration).toContain("ref.code = 'SECURITY_SIRA' AND cp.plot_number <> '6180578'");
    expect(articMigration).toContain("cp.plot_number IN ('6457956', '6457879')");
    expect(articMigration).toContain("cp.plot_number IN ('6457956', '6457879', '6185392')");
    expect(articMigration).toContain("ref.source_type = 'LEGACY_SUPERVISION'");
    expect(articMigration).toContain("project_consultant.consultant_id = 4");
    expect(articMigration).not.toMatch(/UPDATE\s+consultant_requirement_reference_items/i);
    expect(articMigration).not.toMatch(/design_fee_(amount|percentage)/i);
    expect(articMapping).toContain("Schedule of Design Fees");
    expect(articMapping).toContain("does **not** alter any consultant design-fee amount");
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

  it("uses the plot-specific ARTEC design selection and preserves the previous supervision selection", async () => {
    const [rows] = await connection.execute(`
      SELECT cp.plot_number,
             COUNT(DISTINCT CASE WHEN current_req.is_required = 1 AND ref.source_type = 'LEGACY_SCOPE' THEN current_req.reference_item_id END) AS design_count,
             COUNT(DISTINCT CASE WHEN current_req.is_required = 1 AND ref.source_type = 'LEGACY_SUPERVISION' THEN current_req.reference_item_id END) AS current_supervision_count,
             COUNT(DISTINCT CASE WHEN previous_req.is_required = 1 AND ref.source_type = 'LEGACY_SUPERVISION' THEN previous_req.reference_item_id END) AS previous_supervision_count
      FROM project_consultant_requirement_sets current_set
      JOIN cpa_projects cp ON cp.project_id = current_set.project_id
      JOIN project_consultant_requirements current_req ON current_req.requirement_set_id = current_set.id
      JOIN consultant_requirement_reference_items ref ON ref.id = current_req.reference_item_id
      JOIN project_consultant_requirement_sets previous_set
        ON previous_set.project_id = current_set.project_id AND previous_set.revision_no = current_set.revision_no - 1
      LEFT JOIN project_consultant_requirements previous_req
        ON previous_req.requirement_set_id = previous_set.id AND previous_req.reference_item_id = current_req.reference_item_id
      WHERE current_set.notes LIKE 'ARTEC_SCOPE_BASELINE_V1%'
      GROUP BY cp.plot_number
      ORDER BY cp.plot_number
    `) as any;
    const expectedDesignCounts: Record<string, number> = {
      "6457956": 20,
      "6457879": 20,
      "6182776": 12,
      "6185392": 17,
      "3260885": 12,
      "6180578": 11,
    };
    expect(rows).toHaveLength(6);
    for (const row of rows) {
      expect(Number(row.design_count)).toBe(expectedDesignCounts[String(row.plot_number)]);
      expect(Number(row.current_supervision_count)).toBe(Number(row.previous_supervision_count));
    }
  });

  it("starts ARTEC with zero scope gaps against every plot-specific baseline", async () => {
    const [rows] = await connection.execute(`
      SELECT cp.plot_number,
             COUNT(*) AS required_design_count,
             SUM(CASE WHEN COALESCE(coverage.coverage_status, 'NOT_MENTIONED') = 'INCLUDED' THEN 1 ELSE 0 END) AS included_count,
             SUM(CASE WHEN COALESCE(coverage.coverage_status, 'NOT_MENTIONED') <> 'INCLUDED' THEN 1 ELSE 0 END) AS gap_count
      FROM project_consultant_requirement_sets scope_set
      JOIN cpa_projects cp ON cp.project_id = scope_set.project_id
      JOIN cpa_project_consultants project_consultant
        ON project_consultant.cpa_project_id = cp.id AND project_consultant.consultant_id = 4
      JOIN project_consultant_requirements requirement
        ON requirement.requirement_set_id = scope_set.id AND requirement.is_required = 1
      JOIN consultant_requirement_reference_items ref
        ON ref.id = requirement.reference_item_id AND ref.source_type = 'LEGACY_SCOPE'
      LEFT JOIN cpa_consultant_scope_coverage coverage
        ON coverage.project_consultant_id = project_consultant.id
       AND coverage.scope_item_id = ref.legacy_scope_item_id
      WHERE scope_set.notes LIKE 'ARTEC_SCOPE_BASELINE_V1%'
      GROUP BY cp.plot_number
      ORDER BY cp.plot_number
    `) as any;
    expect(rows).toHaveLength(6);
    for (const row of rows) {
      expect(Number(row.included_count)).toBe(Number(row.required_design_count));
      expect(Number(row.gap_count)).toBe(0);
    }
  });

  it("recalculates every project with zero ARTEC design gap cost", async () => {
    const [projects] = await connection.execute(`
      SELECT cp.id
      FROM cpa_projects cp
      JOIN project_consultant_requirement_sets scope_set
        ON scope_set.project_id = cp.project_id
       AND scope_set.notes LIKE 'ARTEC_SCOPE_BASELINE_V1%'
      ORDER BY cp.id
    `) as any;
    expect(projects).toHaveLength(6);
    await Promise.all(projects.map((project: any) => runCalculationEngine(Number(project.id))));

    const [rows] = await connection.execute(`
      SELECT cp.plot_number, result.design_scope_gap_cost
      FROM cpa_evaluation_results result
      JOIN cpa_project_consultants project_consultant
        ON project_consultant.id = result.project_consultant_id
      JOIN cpa_consultants_master consultant
        ON consultant.id = project_consultant.consultant_id
      JOIN cpa_projects cp ON cp.id = project_consultant.cpa_project_id
      WHERE consultant.id = 4
      ORDER BY cp.plot_number
    `) as any;
    expect(rows).toHaveLength(6);
    for (const row of rows) expect(Number(row.design_scope_gap_cost)).toBe(0);
  }, 60_000);

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
