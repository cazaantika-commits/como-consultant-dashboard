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

const NAD_AL_SHEBA_PLOT_2_SOURCE_ID = 5;
const NAD_AL_SHEBA_PLOT_2_TEST_NAME = "المشروع التجريبي — ند الشبا 2 (6182776)";
const NAD_AL_SHEBA_PLOT_2_SOURCE_MARKER = "SOURCE_PROJECT_ID=5 | SOURCE_PLOT=6182776";

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

/**
 * Keeps optional financial and unit-input defaults blank in a test workspace.
 * Four legacy unit categories remain schema-level zero values because their
 * database columns are non-nullable; without unit quantities they create no
 * project income, cost, or feasibility result.
 */
async function clearAssumedFinancialDefaults(db: Db, projectId: number, userId: number) {
  await db.execute(sql`
    UPDATE projects
    SET developerFeePct = NULL,
        saleableResidentialPct = NULL,
        saleableRetailPct = NULL,
        saleableOfficesPct = NULL,
        residential1brArea = NULL,
        residential2brArea = NULL,
        residential3brArea = NULL,
        retailSmallArea = NULL,
        retailMediumArea = NULL,
        retailLargeArea = NULL,
        officeSmallArea = NULL,
        officeMediumArea = NULL,
        officeLargeArea = NULL,
        residential1brPrice = NULL,
        residential2brPrice = NULL,
        residential3brPrice = NULL,
        retailSmallPrice = NULL,
        retailMediumPrice = NULL,
        retailLargePrice = NULL,
        officeSmallPrice = NULL,
        officeMediumPrice = NULL,
        officeLargePrice = NULL
    WHERE id = ${projectId} AND userId = ${userId} AND is_test_project = 1
  `);
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

  await clearAssumedFinancialDefaults(db, projectId, userId);

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

/**
 * Creates one isolated feasibility workspace for Nad Al Sheba Plot 2. Only
 * documented land and planning facts are copied from the official record; no
 * original project financial input, price, sales plan, or consultant record is
 * altered or used as an assumed feasibility result.
 */
export async function createNadAlShebaPlot2TestProject(userId: number): Promise<IsolatedTestProject> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await rows<any>(db, sql`
    SELECT id
    FROM projects
    WHERE userId = ${userId}
      AND is_test_project = 1
      AND notes LIKE ${`%${NAD_AL_SHEBA_PLOT_2_SOURCE_MARKER}%`}
    ORDER BY id DESC
    LIMIT 1
  `);

  const sourceRows = await rows<any>(db, sql`
    SELECT id, plotNumber, areaCode, titleDeedNumber, ddaNumber, masterDevRef,
           plotAreaSqm, plotAreaSqft, gfaSqm, gfaSqft, bua, permittedUse,
           ownershipType, subdivisionRestrictions, masterDevName, masterDevAddress,
           preConMonths, constructionMonths, handoverMonths,
           marketingPrepMonths, reraLeadMonths, startDate
    FROM projects
    WHERE id = ${NAD_AL_SHEBA_PLOT_2_SOURCE_ID}
      AND userId = ${userId}
      AND is_test_project = 0
    LIMIT 1
  `);
  const source = sourceRows[0];
  if (!source || String(source.plotNumber) !== "6182776") {
    throw new Error("تعذر قراءة بيانات قطعة ند الشبا 2 الرسمية لإنشاء النسخة التجريبية");
  }

  if (existing[0]?.id) {
    const projectId = Number(existing[0].id);
    await clearAssumedFinancialDefaults(db, projectId, userId);
    const cpaRows = await rows<any>(db, sql`
      SELECT id FROM cpa_projects WHERE project_id = ${projectId} ORDER BY id ASC LIMIT 1
    `);
    if (!cpaRows[0]?.id) {
      await db.execute(sql`
        INSERT INTO cpa_projects
          (project_id, plot_number, location, project_type, description,
           bua_sqft, construction_cost_per_sqft, duration_months, status)
        VALUES
          (${projectId}, ${source.plotNumber}, ${source.areaCode ?? 'ند الشبا'}, 'RESIDENTIAL',
           'نسخة تجريبية مستقلة لدراسة عرض الأرض مقابل وحدات لمالك قطعة ند الشبا 2؛ لا تدخل في المشاريع أو التقارير الرسمية.',
           ${source.bua ?? 0}, 0, ${source.constructionMonths ?? 0}, 'ACTIVE')
      `);
    }
    await ensureDesignScope(db, projectId);
    await ensureJointVentureOffPlanTerms(db, projectId);
    const project = await getIsolatedTestProject(userId, projectId);
    if (project) return project;
  }

  const schedule = {
    settings: {
      jointVenture: {
        landOwnerProjectSharePct: 35,
        landOwnerResidentialSharePct: 35,
        landOwnerCommercialSharePct: 35,
        developmentLicenseCost: 0,
        waelLicenseRegistrationCost: 0,
        landOwnerLicenseRegistrationCost: 0,
        landOwnerUnitsRegistrationFeePct: 4,
      },
    },
  };
  const description = "نسخة تجريبية مستقلة لدراسة عرض الأرض مقابل وحدات لمالك قطعة ند الشبا 2؛ لا تدخل في المشاريع أو التقارير الرسمية.";
  const notes = `ISOLATED_TEST_PROJECT | ${NAD_AL_SHEBA_PLOT_2_SOURCE_MARKER} | تم نسخ حقائق الأرض والتخطيط فقط من البطاقة الرسمية؛ المدخلات المالية مستقلة وغير مفترضة`;

  const inserted = await db.execute(sql`
    INSERT INTO projects
      (userId, name, is_test_project, description, plotNumber, areaCode,
       titleDeedNumber, ddaNumber, masterDevRef, plotAreaSqm, plotAreaSqft,
       gfaSqm, gfaSqft, bua, permittedUse, ownershipType, subdivisionRestrictions,
       masterDevName, masterDevAddress, notes, financingScenario, preConMonths,
       constructionMonths, handoverMonths, marketingPrepMonths, reraLeadMonths,
       startDate, constructionScheduleJson)
    VALUES
      (${userId}, ${NAD_AL_SHEBA_PLOT_2_TEST_NAME}, 1, ${description},
       ${source.plotNumber ?? null}, ${source.areaCode ?? null},
       ${source.titleDeedNumber ?? null}, ${source.ddaNumber ?? null}, ${source.masterDevRef ?? null},
       ${source.plotAreaSqm ?? null}, ${source.plotAreaSqft ?? null},
       ${source.gfaSqm ?? null}, ${source.gfaSqft ?? null}, ${source.bua ?? null},
       ${source.permittedUse ?? null}, ${source.ownershipType ?? null}, ${source.subdivisionRestrictions ?? null},
       ${source.masterDevName ?? null}, ${source.masterDevAddress ?? null}, ${notes},
       'joint_venture_land_for_units', ${source.preConMonths ?? null},
       ${source.constructionMonths ?? null}, ${source.handoverMonths ?? null},
       ${source.marketingPrepMonths ?? null}, ${source.reraLeadMonths ?? null},
       ${source.startDate ?? null}, ${JSON.stringify(schedule)})
  `);
  const projectId = Number((inserted[0] as any).insertId);
  if (!projectId) throw new Error("تعذر إنشاء النسخة التجريبية لند الشبا 2");

  await clearAssumedFinancialDefaults(db, projectId, userId);

  await db.execute(sql`
    INSERT INTO cpa_projects
      (project_id, plot_number, location, project_type, description,
       bua_sqft, construction_cost_per_sqft, duration_months, status)
    VALUES
      (${projectId}, ${source.plotNumber}, ${source.areaCode ?? 'ند الشبا'}, 'RESIDENTIAL',
       ${description}, ${source.bua ?? 0}, 0, ${source.constructionMonths ?? 0}, 'ACTIVE')
  `);

  await ensureDesignScope(db, projectId);
  await ensureJointVentureOffPlanTerms(db, projectId);
  const created = await getIsolatedTestProject(userId, projectId);
  if (!created) throw new Error("تعذر قراءة النسخة التجريبية لند الشبا 2 بعد الإنشاء");
  return created;
}
