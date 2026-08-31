import { z } from "zod";
import { sql } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";

type RequirementRow = Record<string, unknown>;

async function qRows<T = RequirementRow>(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, query: ReturnType<typeof sql>): Promise<T[]> {
  const result = await db.execute(query);
  return (result[0] as unknown as T[]) ?? [];
}

const editableRequirementFields = z.object({
  workstream: z.enum(["DESIGN", "ENGINEERING", "SUPERVISION", "GENERAL"]).optional(),
  requirementGroup: z.string().trim().min(1).max(200).optional(),
  code: z.string().trim().max(80).nullable().optional(),
  label: z.string().trim().min(1).max(300).optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  defaultEnabled: z.boolean().optional(),
  defaultGapValueAed: z.number().min(0).nullable().optional(),
  pricingBasis: z.enum(["FIXED", "MONTHLY", "PERCENT_OF_FEE", "MANUAL"]).optional(),
  defaultDurationMonths: z.number().int().min(0).max(240).nullable().optional(),
  defaultAllocationPct: z.number().min(0).max(500).nullable().optional(),
  sortOrder: z.number().int().min(0).max(100000).optional(),
  isActive: z.boolean().optional(),
});

function buildUpdateSql(id: number, fields: z.infer<typeof editableRequirementFields>) {
  const sets: ReturnType<typeof sql>[] = [];
  if (fields.workstream !== undefined) sets.push(sql`workstream = ${fields.workstream}`);
  if (fields.requirementGroup !== undefined) sets.push(sql`requirement_group = ${fields.requirementGroup}`);
  if (fields.code !== undefined) sets.push(sql`code = ${fields.code}`);
  if (fields.label !== undefined) sets.push(sql`label = ${fields.label}`);
  if (fields.description !== undefined) sets.push(sql`description = ${fields.description}`);
  if (fields.defaultEnabled !== undefined) sets.push(sql`default_enabled = ${fields.defaultEnabled ? 1 : 0}`);
  if (fields.defaultGapValueAed !== undefined) sets.push(sql`default_gap_value_aed = ${fields.defaultGapValueAed}`);
  if (fields.pricingBasis !== undefined) sets.push(sql`pricing_basis = ${fields.pricingBasis}`);
  if (fields.defaultDurationMonths !== undefined) sets.push(sql`default_duration_months = ${fields.defaultDurationMonths}`);
  if (fields.defaultAllocationPct !== undefined) sets.push(sql`default_allocation_pct = ${fields.defaultAllocationPct}`);
  if (fields.sortOrder !== undefined) sets.push(sql`sort_order = ${fields.sortOrder}`);
  if (fields.isActive !== undefined) sets.push(sql`is_active = ${fields.isActive ? 1 : 0}`);
  if (!sets.length) return null;
  return sql`UPDATE consultant_requirement_reference_items SET ${sql.join(sets, sql`, `)} WHERE id = ${id}`;
}

export const consultantRequirementsRouter = router({
  reference: router({
    list: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return qRows(db, sql`
        SELECT id, source_type, legacy_scope_item_id, legacy_supervision_role_id,
               workstream, requirement_group, code, label, description,
               default_enabled, default_gap_value_aed, pricing_basis,
               default_duration_months, default_allocation_pct, sort_order, is_active,
               created_at, updated_at
        FROM consultant_requirement_reference_items
        WHERE is_active = 1 AND workstream = 'DESIGN'
        ORDER BY sort_order, id
      `);
    }),

    create: protectedProcedure
      .input(editableRequirementFields.extend({
        requirementGroup: z.string().trim().min(1).max(200),
        label: z.string().trim().min(1).max(300),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB unavailable");
        await db.execute(sql`
          INSERT INTO consultant_requirement_reference_items
            (source_type, workstream, requirement_group, code, label, description,
             default_enabled, default_gap_value_aed, pricing_basis,
             default_duration_months, default_allocation_pct, sort_order, is_active)
          VALUES (
            'CUSTOM', ${input.workstream ?? 'GENERAL'}, ${input.requirementGroup}, ${input.code ?? null},
            ${input.label}, ${input.description ?? null}, ${input.defaultEnabled === false ? 0 : 1},
            ${input.defaultGapValueAed ?? null}, ${input.pricingBasis ?? 'FIXED'},
            ${input.defaultDurationMonths ?? null}, ${input.defaultAllocationPct ?? null},
            ${input.sortOrder ?? 9999}, ${input.isActive === false ? 0 : 1}
          )
        `);
        return { success: true };
      }),

    update: protectedProcedure
      .input(z.object({ id: z.number(), fields: editableRequirementFields }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB unavailable");
        const query = buildUpdateSql(input.id, input.fields);
        if (!query) return { success: true };
        await db.execute(query);
        return { success: true };
      }),
  }),

  project: router({
    getCurrent: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return { set: null, requirements: [] };
        const sets = await qRows<any>(db, sql`
          SELECT * FROM project_consultant_requirement_sets
          WHERE project_id = ${input.projectId} AND status IN ('DRAFT', 'APPROVED')
          ORDER BY revision_no DESC LIMIT 1
        `);
        const set = sets[0] ?? null;
        if (!set) return { set: null, requirements: [] };
        const requirements = await qRows(db, sql`
          SELECT pcr.*, ref.source_type AS reference_source_type,
                 ref.legacy_scope_item_id, ref.legacy_supervision_role_id
          FROM project_consultant_requirements pcr
          LEFT JOIN consultant_requirement_reference_items ref ON ref.id = pcr.reference_item_id
          WHERE pcr.requirement_set_id = ${set.id} AND pcr.workstream = 'DESIGN'
          ORDER BY pcr.sort_order, pcr.id
        `);
        return { set, requirements };
      }),

    createFromReference: protectedProcedure
      .input(z.object({ projectId: z.number(), title: z.string().trim().min(1).max(300).optional() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB unavailable");
        const current = await qRows<any>(db, sql`
          SELECT id FROM project_consultant_requirement_sets
          WHERE project_id = ${input.projectId} AND status IN ('DRAFT', 'APPROVED') LIMIT 1
        `);
        if (current[0]) throw new Error("توجد مواصفة قائمة لهذا المشروع؛ أنشئ مراجعة جديدة بدلًا من ذلك");
        await db.execute(sql`
          INSERT INTO project_consultant_requirement_sets (project_id, title, revision_no, status)
          VALUES (${input.projectId}, ${input.title ?? 'نطاق التصميم الخاص بالمشروع'}, 1, 'DRAFT')
        `);
        const created = await qRows<any>(db, sql`
          SELECT id FROM project_consultant_requirement_sets
          WHERE project_id = ${input.projectId} AND revision_no = 1 ORDER BY id DESC LIMIT 1
        `);
        const setId = Number(created[0]?.id);
        if (!setId) throw new Error("تعذر إنشاء مواصفة المشروع");
        await db.execute(sql`
          INSERT INTO project_consultant_requirements
            (requirement_set_id, reference_item_id, source_type, workstream, requirement_group, code, label, description,
             is_required, gap_value_aed, pricing_basis, duration_months, allocation_pct, sort_order)
          SELECT ${setId}, id, 'REFERENCE', workstream, requirement_group, code, label, description,
                 0, default_gap_value_aed, pricing_basis, default_duration_months, default_allocation_pct, sort_order
          FROM consultant_requirement_reference_items
          WHERE is_active = 1 AND workstream = 'DESIGN'
        `);
        return { success: true, setId };
      }),

    saveSelection: protectedProcedure
      .input(z.object({ setId: z.number(), requirementIds: z.array(z.number().int().positive()) }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB unavailable");
        const sets = await qRows<any>(db, sql`
          SELECT status FROM project_consultant_requirement_sets WHERE id = ${input.setId} LIMIT 1
        `);
        if (!sets[0] || sets[0].status !== 'DRAFT') throw new Error("لا يمكن تعديل معيار معتمد؛ أنشئ مراجعة جديدة");
        await db.execute(sql`
          UPDATE project_consultant_requirements
          SET is_required = 0
          WHERE requirement_set_id = ${input.setId} AND workstream = 'DESIGN'
        `);
        if (input.requirementIds.length > 0) {
          await db.execute(sql`
            UPDATE project_consultant_requirements
            SET is_required = 1
            WHERE requirement_set_id = ${input.setId}
              AND workstream = 'DESIGN'
              AND id IN (${sql.join(input.requirementIds.map((id) => sql`${id}`), sql`, `)})
          `);
        }
        return { success: true, selectedCount: input.requirementIds.length };
      }),

    createRevision: protectedProcedure
      .input(z.object({ setId: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB unavailable");
        const oldSets = await qRows<any>(db, sql`SELECT * FROM project_consultant_requirement_sets WHERE id = ${input.setId} LIMIT 1`);
        const oldSet = oldSets[0];
        if (!oldSet || oldSet.status !== 'APPROVED') throw new Error("لا يمكن إنشاء مراجعة إلا من معيار معتمد");
        const nextRows = await qRows<any>(db, sql`SELECT COALESCE(MAX(revision_no), 0) + 1 AS next_revision FROM project_consultant_requirement_sets WHERE project_id = ${oldSet.project_id}`);
        const nextRevision = Number(nextRows[0]?.next_revision ?? 1);
        await db.execute(sql`UPDATE project_consultant_requirement_sets SET status = 'REPLACED' WHERE id = ${input.setId}`);
        await db.execute(sql`
          INSERT INTO project_consultant_requirement_sets (project_id, title, revision_no, status, notes)
          VALUES (${oldSet.project_id}, ${oldSet.title}, ${nextRevision}, 'DRAFT', ${oldSet.notes ?? null})
        `);
        const created = await qRows<any>(db, sql`SELECT id FROM project_consultant_requirement_sets WHERE project_id = ${oldSet.project_id} AND revision_no = ${nextRevision} ORDER BY id DESC LIMIT 1`);
        const setId = Number(created[0]?.id);
        await db.execute(sql`
          INSERT INTO project_consultant_requirements
            (requirement_set_id, reference_item_id, source_type, workstream, requirement_group, code, label, description,
             is_required, gap_value_aed, pricing_basis, duration_months, allocation_pct, sort_order)
          SELECT ${setId}, reference_item_id, source_type, workstream, requirement_group, code, label, description,
                 is_required, gap_value_aed, pricing_basis, duration_months, allocation_pct, sort_order
          FROM project_consultant_requirements
          WHERE requirement_set_id = ${input.setId} AND workstream = 'DESIGN'
        `);
        return { success: true, setId };
      }),

    updateRequirement: protectedProcedure
      .input(z.object({ id: z.number(), fields: editableRequirementFields.extend({ isRequired: z.boolean().optional(), gapValueAed: z.number().min(0).nullable().optional(), durationMonths: z.number().int().min(0).max(240).nullable().optional(), allocationPct: z.number().min(0).max(500).nullable().optional() }) }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB unavailable");
        const rows = await qRows<any>(db, sql`
          SELECT pcr.requirement_set_id, pcrs.status FROM project_consultant_requirements pcr
          JOIN project_consultant_requirement_sets pcrs ON pcrs.id = pcr.requirement_set_id
          WHERE pcr.id = ${input.id} LIMIT 1
        `);
        if (!rows[0] || rows[0].status !== 'DRAFT') throw new Error("لا يمكن تعديل معيار معتمد؛ أنشئ مراجعة جديدة");
        const fields = input.fields;
        const sets: ReturnType<typeof sql>[] = [];
        if (fields.workstream !== undefined) sets.push(sql`workstream = ${fields.workstream}`);
        if (fields.requirementGroup !== undefined) sets.push(sql`requirement_group = ${fields.requirementGroup}`);
        if (fields.code !== undefined) sets.push(sql`code = ${fields.code}`);
        if (fields.label !== undefined) sets.push(sql`label = ${fields.label}`);
        if (fields.description !== undefined) sets.push(sql`description = ${fields.description}`);
        if (fields.pricingBasis !== undefined) sets.push(sql`pricing_basis = ${fields.pricingBasis}`);
        if (fields.isRequired !== undefined) sets.push(sql`is_required = ${fields.isRequired ? 1 : 0}`);
        if (fields.gapValueAed !== undefined) sets.push(sql`gap_value_aed = ${fields.gapValueAed}`);
        if (fields.durationMonths !== undefined) sets.push(sql`duration_months = ${fields.durationMonths}`);
        if (fields.allocationPct !== undefined) sets.push(sql`allocation_pct = ${fields.allocationPct}`);
        if (!sets.length) return { success: true };
        await db.execute(sql`UPDATE project_consultant_requirements SET ${sql.join(sets, sql`, `)} WHERE id = ${input.id}`);
        return { success: true };
      }),

    approve: protectedProcedure
      .input(z.object({ setId: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB unavailable");
        const counts = await qRows<any>(db, sql`
          SELECT s.status,
                 COUNT(r.id) AS design_count,
                 SUM(CASE WHEN r.is_required = 1 THEN 1 ELSE 0 END) AS required_count,
                 SUM(CASE WHEN r.workstream <> 'DESIGN' THEN 1 ELSE 0 END) AS non_design_count
          FROM project_consultant_requirement_sets s
          LEFT JOIN project_consultant_requirements r ON r.requirement_set_id = s.id
          WHERE s.id = ${input.setId}
          GROUP BY s.id, s.status
        `);
        if (!counts[0] || counts[0].status !== 'DRAFT') throw new Error("لا توجد مسودة نطاق قابلة للاعتماد");
        if (Number(counts[0].design_count) !== 42 || Number(counts[0].non_design_count) !== 0) throw new Error("يجب أن يعتمد المشروع على موسوعة التصميم النهائية ذات 42 بندًا فقط");
        if (Number(counts[0].required_count) < 1) throw new Error("يلزم اختيار بند تصميم واحد على الأقل قبل الاعتماد");
        await db.execute(sql`UPDATE project_consultant_requirement_sets SET status = 'APPROVED', approved_at = CURRENT_TIMESTAMP WHERE id = ${input.setId}`);
        return { success: true };
      }),
  }),
});
