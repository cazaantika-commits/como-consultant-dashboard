import { Router } from "express";
import { getDb } from "./db";
import { sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { deriveAuthorizedProjectIds, requireLegacyProjectWrite } from "./services/comoLegacyProjectAccess";
import { authenticateComoRest, comoRestActor, dashboardWriteTargets, isDashboardObject, mergeDashboardPatch, parseDashboardProjectKey, requireProvisionedComoOwner, sendComoRestError, type DashboardObject } from "./services/comoSecurityGuards";

const router = Router();
router.use(authenticateComoRest);
type Database = NonNullable<Awaited<ReturnType<typeof getDb>>>;
type Row = Record<string, unknown>;
function rows(result: unknown): Row[] {
  if (!Array.isArray(result) || !Array.isArray(result[0])) throw new Error("Invalid database response");
  return result[0].filter(isDashboardObject);
}
function scope(ids: number[]) { return sql.join(ids.map(id => sql`${id}`), sql`, `); }
async function legacyData(db: Database): Promise<DashboardObject> {
  try {
    const row = rows(await db.execute(sql`SELECT dataValue FROM dashboardData WHERE dataKey = 'main' LIMIT 1`))[0];
    const value: unknown = typeof row?.dataValue === "string" ? JSON.parse(row.dataValue) : {};
    return isDashboardObject(value) ? value : {};
  } catch { return {}; }
}

// Empty authorized scope is never an unrestricted query. No DDL on import/request.
async function buildDataFromStructuredTables(ids: number[], includeGlobalLinks: boolean): Promise<DashboardObject> {
  if (!ids.length) return {};
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const projectRows = rows(await db.execute(sql`SELECT id, name, bua, pricePerSqft FROM projects WHERE is_test_project = 0 AND id IN (${scope(ids)})`));
  const pcRows = rows(await db.execute(sql`SELECT pc.projectId, pc.consultantId, c.name as consultantName FROM projectConsultants pc JOIN consultants c ON pc.consultantId = c.id WHERE pc.projectId IN (${scope(ids)}) ORDER BY pc.projectId, pc.id`));
  const fdRows = rows(await db.execute(sql`SELECT fd.projectId, fd.consultantId, fd.designType, fd.designValue, fd.supervisionType, fd.supervisionValue, fd.proposalLink, c.name as consultantName FROM financialData fd JOIN consultants c ON fd.consultantId = c.id WHERE fd.projectId IN (${scope(ids)})`));
  const evalRows = rows(await db.execute(sql`SELECT es.projectId, es.consultantId, es.criterionId, es.score, c.name as consultantName FROM evaluationScores es JOIN consultants c ON es.consultantId = c.id WHERE es.projectId IN (${scope(ids)})`));
  const legacy = await legacyData(db);
  const result: DashboardObject = {};
  for (const project of projectRows) {
    const key = `p${Number(project.id)}`;
    const old = isDashboardObject(legacy[key]) ? legacy[key] : {};
    const names = pcRows.filter(pc => Number(pc.projectId) === Number(project.id)).map(pc => String(pc.consultantName));
    const financialMap = new Map(fdRows.filter(fd => Number(fd.projectId) === Number(project.id)).map(fd => [String(fd.consultantName), fd]));
    const financial = names.map(name => {
      const fd = financialMap.get(name);
      return { consultant: name, designType: fd && ["lumpsum", "lump"].includes(String(fd.designType)) ? "lump" : "pct", designVal: Number(fd?.designValue || 0), supervisionType: fd && ["lumpsum", "lump"].includes(String(fd.supervisionType)) ? "lump" : "pct", supervisionVal: Number(fd?.supervisionValue || 0) };
    });
    const proposalLinks: DashboardObject = isDashboardObject(old.proposalLinks) ? { ...old.proposalLinks } : {};
    for (const fd of Array.from(financialMap.values())) if (fd.proposalLink) proposalLinks[String(fd.consultantName)] = fd.proposalLink;
    const evaluation: Record<string, Record<string, string>> = {};
    for (const ev of evalRows) if (Number(ev.projectId) === Number(project.id)) {
      const criterion = String(ev.criterionId);
      (evaluation[criterion] ||= {})[String(ev.consultantName)] = String(ev.score);
    }
    result[key] = { bua: project.bua ?? old.bua ?? 0, price: project.pricePerSqft ?? old.price ?? 0, financial, proposalLinks, evaluation: Object.keys(evaluation).length ? evaluation : old.evaluation || {}, notes: old.notes || "" };
  }
  if (includeGlobalLinks && isDashboardObject(legacy.consultantLinks)) result.consultantLinks = legacy.consultantLinks;
  return result;
}
async function mayReadGlobalLinks(actor: ReturnType<typeof comoRestActor>): Promise<boolean> {
  try { await requireProvisionedComoOwner(actor); return true; } catch { return false; }
}
router.get("/projects", async (_req, res) => {
  try {
    const ids = await deriveAuthorizedProjectIds(comoRestActor(res));
    if (!ids.length) { res.json([]); return; }
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    const projectRows = rows(await db.execute(sql`SELECT id, name FROM projects WHERE is_test_project = 0 AND id IN (${scope(ids)}) ORDER BY id`));
    const pcRows = rows(await db.execute(sql`SELECT pc.projectId, c.name as consultantName FROM projectConsultants pc JOIN consultants c ON pc.consultantId = c.id WHERE pc.projectId IN (${scope(ids)}) ORDER BY pc.projectId, pc.id`));
    res.json(projectRows.map(p => ({ id: `p${Number(p.id)}`, name: p.name, consultants: pcRows.filter(pc => Number(pc.projectId) === Number(p.id)).map(pc => pc.consultantName) })));
  } catch (error) { sendComoRestError(res, error); }
});
router.get("/", async (_req, res) => {
  try {
    const actor = comoRestActor(res);
    const ids = await deriveAuthorizedProjectIds(actor);
    res.json(await buildDataFromStructuredTables(ids, await mayReadGlobalLinks(actor)));
  } catch (error) { sendComoRestError(res, error); }
});

async function authorizeWrite(body: unknown, actor: ReturnType<typeof comoRestActor>) {
  const targets = dashboardWriteTargets(body);
  // Verify ALL targets before any save; mixed authorized/forbidden requests fail atomically at the guard.
  for (const id of targets.projectIds) await requireLegacyProjectWrite(actor, id);
  if (targets.hasConsultantLinks) await requireProvisionedComoOwner(actor);
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  for (const id of targets.projectIds) {
    const locks = rows(await db.execute(sql`SELECT approval.is_approved AS approved FROM cpa_true_cost_report_approval approval JOIN cpa_projects cp ON cp.id = approval.cpa_project_id WHERE cp.project_id = ${id}`));
    if (locks.some(row => Number(row.approved) !== 0)) throw new TRPCError({ code: "FORBIDDEN", message: "التقرير المالي معتمد ومقفل؛ لا يمكن تعديل مصدره" });
  }
  // This compatibility REST has no independent evaluator identity contract.
  // It may round-trip unchanged evaluation for the historic HTML, never author it.
  if (targets.projectIds.some(id => Object.hasOwn(targets.data[`p${id}`] as DashboardObject, "evaluation"))) {
    const current = await buildDataFromStructuredTables(targets.projectIds, false);
    for (const id of targets.projectIds) {
      const incoming = targets.data[`p${id}`] as DashboardObject;
      const currentValue = current[`p${id}`];
      const existing: DashboardObject = isDashboardObject(currentValue) ? currentValue : {};
      if (Object.hasOwn(incoming, "evaluation") && JSON.stringify(incoming.evaluation) !== JSON.stringify(existing.evaluation)) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "التقييم يُعدّل من مسار المقيم المستقل لا payload اللوحة" });
      }
    }
  }
  return targets;
}
async function save(db: Database, data: DashboardObject) {
  const jsonData = JSON.stringify(data);
  await db.execute(sql`INSERT INTO dashboardData (dataKey, dataValue) VALUES ('main', ${jsonData}) ON DUPLICATE KEY UPDATE dataValue = ${jsonData}`);
}
router.post("/", async (req, res) => {
  try {
    const { data } = await authorizeWrite(req.body, comoRestActor(res));
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    // The historic main row is shared. Never replace/delete another project's data.
    await save(db, { ...await legacyData(db), ...data });
    await syncToStructuredTables(db, data);
    res.json({ success: true });
  } catch (error) { sendComoRestError(res, error); }
});
router.patch("/", async (req, res) => {
  try {
    const actor = comoRestActor(res);
    const { data, projectIds, hasConsultantLinks } = await authorizeWrite(req.body, actor);
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    const updated = mergeDashboardPatch(await buildDataFromStructuredTables(projectIds, hasConsultantLinks), data);
    await save(db, { ...await legacyData(db), ...updated });
    // Only requested write scopes; never sync all readable projects (viewers included).
    await syncToStructuredTables(db, updated);
    res.json({ success: true, data: updated });
  } catch (error) { sendComoRestError(res, error); }
});
async function syncToStructuredTables(db: Database, data: DashboardObject) {
  const consultantMap = new Map(rows(await db.execute(sql`SELECT id, name FROM consultants`)).map(c => [String(c.name), Number(c.id)]));
  for (const [key, value] of Object.entries(data)) {
    const projectId = parseDashboardProjectKey(key);
    if (!projectId || !isDashboardObject(value)) continue;
    if (value.bua !== undefined || value.price !== undefined) {
      // Preserve the other column on a partial save, including a legitimate zero.
      if (value.bua !== undefined) await db.execute(sql`UPDATE projects SET bua = ${value.bua} WHERE id = ${projectId}`);
      if (value.price !== undefined) await db.execute(sql`UPDATE projects SET pricePerSqft = ${value.price} WHERE id = ${projectId}`);
    }
    if (Array.isArray(value.financial)) for (const fin of value.financial) {
      if (!isDashboardObject(fin)) continue;
      const consultantId = consultantMap.get(String(fin.consultant));
      if (!consultantId) continue;
      // Do not allow a consultant from another office/project to be attached by payload.
      const attached = rows(await db.execute(sql`SELECT consultantId FROM projectConsultants WHERE projectId = ${projectId} AND consultantId = ${consultantId} LIMIT 1`));
      if (!attached.length) continue;
      const designType = fin.designType === "lump" ? "lumpsum" : "pct";
      const supervisionType = fin.supervisionType === "lump" ? "lumpsum" : "pct";
      await db.execute(sql`INSERT INTO financialData (projectId, consultantId, designType, designValue, supervisionType, supervisionValue) VALUES (${projectId}, ${consultantId}, ${designType}, ${fin.designVal}, ${supervisionType}, ${fin.supervisionVal}) ON DUPLICATE KEY UPDATE designType = ${designType}, designValue = ${fin.designVal}, supervisionType = ${supervisionType}, supervisionValue = ${fin.supervisionVal}`);
    }
    if (isDashboardObject(value.proposalLinks)) for (const [name, link] of Object.entries(value.proposalLinks)) {
      const consultantId = consultantMap.get(name);
      if (consultantId && typeof link === "string" && link) await db.execute(sql`UPDATE financialData SET proposalLink = ${link} WHERE projectId = ${projectId} AND consultantId = ${consultantId}`);
    }
  }
}
export default router;
