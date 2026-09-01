import { sql } from "drizzle-orm";
import { getDb } from "./db";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

export type IsolatedTestProject = {
  id: number;
  name: string;
  isTestProject: number;
  cpaProjectId: number | null;
  financingScenario: string;
  plotNumber: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type TestProjectFinancingScenario =
  | "joint_venture_land_for_units"
  | "offplan_escrow"
  | "offplan_construction"
  | "build_for_sale"
  | "build_for_rent";

export type CreateIsolatedTestProjectInput = {
  name: string;
  financingScenario: TestProjectFinancingScenario;
  landOwnerSharePct?: number;
};

async function rows<T>(db: Db, query: ReturnType<typeof sql>): Promise<T[]> {
  const result = await db.execute(query);
  return (result[0] as unknown as T[]) ?? [];
}

function mapTestProject(row: any): IsolatedTestProject {
  return {
    id: Number(row.id),
    name: String(row.name),
    isTestProject: Number(row.isTestProject),
    cpaProjectId: row.cpaProjectId == null ? null : Number(row.cpaProjectId),
    financingScenario: String(row.financingScenario || "offplan_escrow"),
    plotNumber: row.plotNumber == null ? null : String(row.plotNumber),
    createdAt: row.createdAt == null ? null : String(row.createdAt),
    updatedAt: row.updatedAt == null ? null : String(row.updatedAt),
  };
}

export async function listIsolatedTestProjects(userId: number): Promise<IsolatedTestProject[]> {
  const db = await getDb();
  if (!db) return [];

  const result = await rows<any>(db, sql`
    SELECT p.id,
           p.name,
           p.is_test_project AS isTestProject,
           p.financingScenario,
           p.plotNumber,
           p.createdAt,
           p.updatedAt,
           (SELECT MIN(cp.id) FROM cpa_projects cp WHERE cp.project_id = p.id) AS cpaProjectId
    FROM projects p
    WHERE p.userId = ${userId}
      AND p.is_test_project = 1
    ORDER BY p.updatedAt DESC, p.id DESC
  `);

  return result.map(mapTestProject);
}

export async function getIsolatedTestProject(userId: number, projectId?: number): Promise<IsolatedTestProject | null> {
  const projects = await listIsolatedTestProjects(userId);
  const selected = projectId == null
    ? projects[projects.length - 1]
    : projects.find((project) => project.id === projectId);

  return selected || null;
}

async function ensureDesignScope(db: Db, projectId: number) {
  const assertCompleteDesignScope = async (setId: number) => {
    const countRows = await rows<any>(db, sql`
      SELECT COUNT(*) AS itemCount
      FROM project_consultant_requirements
      WHERE requirement_set_id = ${setId}
        AND workstream = 'DESIGN'
    `);
    if (Number(countRows[0]?.itemCount) !== 43) {
      throw new Error("نطاق المشروع التجريبي لا يحتوي على موسوعة التصميم الكاملة ذات 43 بندًا");
    }
  };

  const existing = await rows<any>(db, sql`
    SELECT id
    FROM project_consultant_requirement_sets
    WHERE project_id = ${projectId}
      AND status IN ('DRAFT', 'APPROVED')
    ORDER BY revision_no DESC, id DESC
    LIMIT 1
  `);
  if (existing[0]?.id) {
    const setId = Number(existing[0].id);
    await assertCompleteDesignScope(setId);
    return setId;
  }

  await db.execute(sql`
    INSERT INTO project_consultant_requirement_sets
      (project_id, title, revision_no, status, notes)
    VALUES
      (${projectId}, 'نطاق التصميم التجريبي', 1, 'DRAFT',
       'ISOLATED_TEST_PROJECT | نسخة مستقلة قابلة للتعديل من موسوعة التصميم ذات 43 بندًا')
  `);

  const created = await rows<any>(db, sql`
    SELECT id
    FROM project_consultant_requirement_sets
    WHERE project_id = ${projectId}
    ORDER BY revision_no DESC, id DESC
    LIMIT 1
  `);
  const setId = Number(created[0]?.id);
  if (!setId) throw new Error("تعذر إنشاء نطاق التصميم التجريبي");

  await db.execute(sql`
    INSERT INTO project_consultant_requirements
      (requirement_set_id, reference_item_id, source_type, workstream, requirement_group,
       code, label, description, is_required, gap_value_aed, pricing_basis,
       duration_months, allocation_pct, sort_order)
    SELECT ${setId}, id, 'REFERENCE', workstream, requirement_group,
           code, label, description, 0, default_gap_value_aed, pricing_basis,
           default_duration_months, default_allocation_pct, sort_order
    FROM consultant_requirement_reference_items
    WHERE is_active = 1 AND workstream = 'DESIGN'
    ORDER BY sort_order, id
  `);

  await assertCompleteDesignScope(setId);

  return setId;
}

async function ensureJointVentureOffPlanTerms(db: Db, projectId: number) {
  const projectRows = await rows<any>(db, sql`
    SELECT financingScenario, constructionScheduleJson
    FROM projects
    WHERE id = ${projectId} AND is_test_project = 1
    LIMIT 1
  `);
  const project = projectRows[0];
  if (!project || project.financingScenario !== "joint_venture_land_for_units") return;

  let schedule: any = {};
  try { schedule = JSON.parse(project.constructionScheduleJson || "{}") || {}; } catch { schedule = {}; }
  schedule.settings ||= {};
  const previous = schedule.settings.jointVenture || {};
  const rawShare = Number(previous.landOwnerProjectSharePct ?? previous.landOwnerResidentialSharePct ?? 35);
  const projectShare = Number.isFinite(rawShare) ? Math.max(0, Math.min(100, rawShare)) : 35;

  schedule.settings.jointVenture = {
    ...previous,
    landOwnerProjectSharePct: projectShare,
    landOwnerResidentialSharePct: projectShare,
    landOwnerCommercialSharePct: projectShare,
    developmentLicenseCost: Math.max(0, Number(previous.developmentLicenseCost) || 0),
    waelLicenseRegistrationCost: Math.max(0, Number(previous.waelLicenseRegistrationCost) || 0),
    landOwnerLicenseRegistrationCost: Math.max(0, Number(previous.landOwnerLicenseRegistrationCost) || 0),
    landOwnerUnitsRegistrationFeePct: Number.isFinite(Number(previous.landOwnerUnitsRegistrationFeePct))
      ? Math.max(0, Math.min(100, Number(previous.landOwnerUnitsRegistrationFeePct)))
      : 4,
  };

  await db.execute(sql`
    UPDATE projects
    SET constructionScheduleJson = ${JSON.stringify(schedule)}
    WHERE id = ${projectId} AND is_test_project = 1
  `);
}

export async function ensureIsolatedTestProject(userId: number): Promise<IsolatedTestProject> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  let testProject = await getIsolatedTestProject(userId);
  let projectId = testProject?.id ?? null;

  if (!projectId) {
    return createIsolatedTestProject(userId, {
      name: "المشروع التجريبي المعزول",
      financingScenario: "joint_venture_land_for_units",
      landOwnerSharePct: 35,
    });
  }

  await ensureJointVentureOffPlanTerms(db, projectId);

  const cpaRows = await rows<any>(db, sql`
    SELECT id FROM cpa_projects WHERE project_id = ${projectId} ORDER BY id ASC LIMIT 1
  `);
  if (!cpaRows[0]?.id) {
    await db.execute(sql`
      INSERT INTO cpa_projects
        (project_id, plot_number, location, project_type, description,
         bua_sqft, construction_cost_per_sqft, duration_months, status)
      VALUES
        (${projectId}, 'TEST-LAB', 'بيئة تجريبية معزولة', 'OTHER',
         'مشروع تجريبي لا يدخل في تقييمات أو تقارير المشاريع الرسمية',
         0, 0, 24, 'ACTIVE')
    `);
  }

  await ensureDesignScope(db, projectId);
  testProject = await getIsolatedTestProject(userId);
  if (!testProject) throw new Error("تعذر تهيئة المشروع التجريبي");
  return testProject;
}

export async function createIsolatedTestProject(
  userId: number,
  input: CreateIsolatedTestProjectInput,
): Promise<IsolatedTestProject> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const name = input.name.trim();
  if (!name) throw new Error("اسم المشروع التجريبي مطلوب");
  const scenario = input.financingScenario;
  const rawShare = Number(input.landOwnerSharePct ?? 35);
  const landOwnerSharePct = Number.isFinite(rawShare) ? Math.max(0, Math.min(100, rawShare)) : 35;
  const schedule = scenario === "joint_venture_land_for_units"
    ? {
        settings: {
          jointVenture: {
            landOwnerProjectSharePct: landOwnerSharePct,
            landOwnerResidentialSharePct: landOwnerSharePct,
            landOwnerCommercialSharePct: landOwnerSharePct,
            developmentLicenseCost: 0,
            waelLicenseRegistrationCost: 0,
            landOwnerLicenseRegistrationCost: 0,
            landOwnerUnitsRegistrationFeePct: 4,
          },
        },
      }
    : { settings: {} };

  const inserted = await db.execute(sql`
    INSERT INTO projects
      (userId, name, is_test_project, description, plotNumber, permittedUse,
       notes, financingScenario, preConMonths, constructionMonths, handoverMonths,
       marketingPrepMonths, reraLeadMonths, startDate, constructionScheduleJson)
    VALUES
      (${userId}, ${name}, 1,
       'بيئة مستقلة لتجربة جميع بطاقات المشروع دون الدخول في القوائم أو التقارير الرسمية',
       NULL, NULL,
       'هذا السجل للتجربة فقط ولا يمثل مشروعًا رسميًا',
       ${scenario}, NULL, NULL, NULL, NULL, NULL, NULL,
       ${JSON.stringify(schedule)})
  `);
  const projectId = Number((inserted[0] as any).insertId);
  if (!projectId) throw new Error("تعذر إنشاء المشروع التجريبي");

  await db.execute(sql`
    UPDATE projects
    SET developerFeePct = NULL,
        saleableResidentialPct = NULL,
        saleableRetailPct = NULL,
        saleableOfficesPct = NULL,
        studioArea = NULL,
        residential1brArea = NULL,
        residential2brArea = NULL,
        residential2brMaidArea = NULL,
        residential3brArea = NULL,
        residential3brMaidArea = NULL,
        villaArea = NULL,
        townhouseArea = NULL,
        retailSmallArea = NULL,
        retailMediumArea = NULL,
        retailLargeArea = NULL,
        officeSmallArea = NULL,
        officeMediumArea = NULL,
        officeLargeArea = NULL,
        studioPrice = NULL,
        residential1brPrice = NULL,
        residential2brPrice = NULL,
        residential2brMaidPrice = NULL,
        residential3brPrice = NULL,
        residential3brMaidPrice = NULL,
        villaPrice = NULL,
        townhousePrice = NULL,
        retailSmallPrice = NULL,
        retailMediumPrice = NULL,
        retailLargePrice = NULL,
        officeSmallPrice = NULL,
        officeMediumPrice = NULL,
        officeLargePrice = NULL
    WHERE id = ${projectId} AND userId = ${userId} AND is_test_project = 1
  `);

  await db.execute(sql`
    INSERT INTO cpa_projects
      (project_id, plot_number, location, project_type, description,
       bua_sqft, construction_cost_per_sqft, duration_months, status)
    VALUES
      (${projectId}, ${`TEST-${projectId}`}, 'بيئة تجريبية معزولة', 'OTHER',
       'مشروع تجريبي لا يدخل في تقييمات أو تقارير المشاريع الرسمية',
       0, 0, 0, 'ACTIVE')
  `);

  await ensureDesignScope(db, projectId);
  await ensureJointVentureOffPlanTerms(db, projectId);
  const created = await getIsolatedTestProject(userId, projectId);
  if (!created) throw new Error("تعذر قراءة المشروع التجريبي بعد إنشائه");
  return created;
}
