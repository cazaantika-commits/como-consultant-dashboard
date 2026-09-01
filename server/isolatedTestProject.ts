import { sql } from "drizzle-orm";
import { getDb } from "./db";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

export type IsolatedTestProject = {
  id: number;
  name: string;
  isTestProject: number;
  cpaProjectId: number | null;
};

async function rows<T>(db: Db, query: ReturnType<typeof sql>): Promise<T[]> {
  const result = await db.execute(query);
  return (result[0] as unknown as T[]) ?? [];
}

export async function getIsolatedTestProject(userId: number): Promise<IsolatedTestProject | null> {
  const db = await getDb();
  if (!db) return null;

  const result = await rows<any>(db, sql`
    SELECT p.id,
           p.name,
           p.is_test_project AS isTestProject,
           cp.id AS cpaProjectId
    FROM projects p
    LEFT JOIN cpa_projects cp ON cp.project_id = p.id
    WHERE p.userId = ${userId}
      AND p.is_test_project = 1
    ORDER BY p.id ASC
    LIMIT 1
  `);

  if (!result[0]) return null;
  return {
    id: Number(result[0].id),
    name: String(result[0].name),
    isTestProject: Number(result[0].isTestProject),
    cpaProjectId: result[0].cpaProjectId == null ? null : Number(result[0].cpaProjectId),
  };
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

export async function ensureIsolatedTestProject(userId: number): Promise<IsolatedTestProject> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  let testProject = await getIsolatedTestProject(userId);
  let projectId = testProject?.id ?? null;

  if (!projectId) {
    const inserted = await db.execute(sql`
      INSERT INTO projects
        (userId, name, is_test_project, description, plotNumber, permittedUse,
         notes, financingScenario, preConMonths, constructionMonths, handoverMonths, constructionScheduleJson)
      VALUES
        (${userId}, 'المشروع التجريبي المعزول', 1,
         'بيئة مستقلة لتجربة جميع بطاقات المشروع دون الدخول في القوائم أو التقارير الرسمية',
         'TEST-LAB', 'يُحدد أثناء التجربة',
         'هذا السجل للتجربة فقط ولا يمثل مشروعًا رسميًا',
         'joint_venture_land_for_units', NULL, NULL, NULL,
         '{"settings":{"jointVenture":{"landOwnerResidentialSharePct":35,"landOwnerCommercialSharePct":0}}}')
    `);
    projectId = Number((inserted[0] as any).insertId);
  }

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
