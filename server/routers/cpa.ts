/**
 * CPA -- Consultant Proposal Analysis Router
 * تحليل عروض الاستشاريين
 *
 * Uses getDb() + Drizzle sql`` template for all raw queries.
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { sql } from "drizzle-orm";

// ---- Helpers ---------------------------------------------------------------

function toNum(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

type DbRow = Record<string, unknown>;

async function qRows<T = DbRow>(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  query: ReturnType<typeof sql>
): Promise<T[]> {
  const result = await db.execute(query);
  return (result[0] as unknown as T[]) ?? [];
}

// ---- Calculation Engine ----------------------------------------------------

async function runCalculationEngine(cpaProjectId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Step 1: Get cpa_project
  const projects = await qRows<any>(
    db,
    sql`SELECT p.*, bc.id as cat_id, bc.code as cat_code, bc.label as cat_label,
               bc.supervision_duration_months as cat_supervision_months
        FROM cpa_projects p
        LEFT JOIN cpa_building_categories bc ON bc.id = p.building_category_id
        WHERE p.id = ${cpaProjectId}`
  );
  if (!projects[0]) throw new Error("CPA project not found");
  const proj = projects[0];

  // Resolve category if not set
  let catId = proj.building_category_id ?? proj.cat_id;
  if (!catId) {
    const cats = await qRows<any>(
      db,
      sql`SELECT id FROM cpa_building_categories
          WHERE is_active = 1
            AND (bua_min_sqft IS NULL OR bua_min_sqft <= ${proj.bua_sqft})
            AND (bua_max_sqft IS NULL OR bua_max_sqft >= ${proj.bua_sqft})
          ORDER BY sort_order LIMIT 1`
    );
    catId = cats[0]?.id ?? null;
  }

  const totalConstructionCost =
    toNum(proj.bua_sqft) * toNum(proj.construction_cost_per_sqft);
  // Use project's actual duration_months for fee adjustment calculations
  const durationMonths = toNum(proj.duration_months);

  // Step 2: Mandatory scope items for this category
  const mandatoryItems = catId
    ? await qRows<any>(
        db,
        sql`SELECT si.id, si.code, si.label, scm.status,
                   COALESCE(src.cost_aed, 0) as ref_cost
            FROM cpa_scope_category_matrix scm
            JOIN cpa_scope_items si ON si.id = scm.scope_item_id
            LEFT JOIN cpa_scope_reference_costs src
              ON src.scope_item_id = scm.scope_item_id
              AND src.building_category_id = scm.building_category_id
            WHERE scm.building_category_id = ${catId}
              AND scm.status IN ('INCLUDED', 'GREEN')
              AND si.item_number NOT IN (10, 11, 12, 13, 44, 45, 46, 47)`
      )
    : [];

  // Step 3: Supervision baseline
  const supervisionBaseline = catId
    ? await qRows<any>(
        db,
        sql`SELECT sb.supervision_role_id, sb.required_allocation_pct,
                   sr.code, sr.label, sr.monthly_rate_aed
            FROM cpa_supervision_baseline sb
            JOIN cpa_supervision_roles sr ON sr.id = sb.supervision_role_id
            WHERE sb.building_category_id = ${catId}
              AND sb.required_allocation_pct > 0`
      )
    : [];

  // Step 4: All consultants (including DRAFT)
  const consultants = await qRows<any>(
    db,
    sql`SELECT pc.*, cm.legal_name, cm.trade_name, cm.code as consultant_code
        FROM cpa_project_consultants pc
        JOIN cpa_consultants_master cm ON cm.id = pc.consultant_id
        WHERE pc.cpa_project_id = ${cpaProjectId}
          AND pc.status IN ('DRAFT', 'CONFIRMED', 'EVALUATED')`
  );

  const results: any[] = [];

  for (const consultant of consultants) {
    const pcId = consultant.id;
    const notes: any = { scopeGaps: [], supervisionGaps: [] };

    // Design fee
    let quotedDesignFee = 0;
    if (consultant.design_fee_method === "LUMP_SUM") {
      quotedDesignFee = toNum(consultant.design_fee_amount);
    } else if (consultant.design_fee_method === "PERCENTAGE") {
      quotedDesignFee =
        (totalConstructionCost * toNum(consultant.design_fee_percentage)) / 100;
    } else if (consultant.design_fee_method === "MONTHLY_RATE") {
      quotedDesignFee = toNum(consultant.design_fee_amount);
    }

    // Design scope gap
    const scopeCoverage = await qRows<any>(
      db,
      sql`SELECT csc.scope_item_id, csc.coverage_status
          FROM cpa_consultant_scope_coverage csc
          WHERE csc.project_consultant_id = ${pcId}`
    );
    const coverageMap: Record<number, string> = {};
    for (const row of scopeCoverage) {
      coverageMap[Number(row.scope_item_id)] = String(row.coverage_status);
    }

    let designScopeGapCost = 0;
    for (const item of mandatoryItems) {
      const status = coverageMap[item.id] ?? "NOT_MENTIONED";
      if (status === "INCLUDED") continue;
      const gap = toNum(item.ref_cost);
      designScopeGapCost += gap;
      if (gap > 0) {
        notes.scopeGaps.push({
          itemCode: item.code,
          itemLabel: item.label,
          status,
          gapCost: gap,
        });
      }
    }

     // Supervision
    let quotedSupervisionFee = 0;
    let originalSupervisionFeeBeforeAdj = 0;
    let canRank = 1;

    // Duration warning + adjustment (ملاحظة 3)
    const statedDuration = consultant.supervision_stated_duration_months
      ? toNum(consultant.supervision_stated_duration_months)
      : null;
    const durationAdjustmentFactor =
      statedDuration !== null && statedDuration > 0 && statedDuration < durationMonths
        ? durationMonths / statedDuration
        : 1;
    if (durationAdjustmentFactor > 1) {
      notes.durationWarning = {
        statedMonths: statedDuration,
        projectMonths: durationMonths,
        adjustmentFactor: durationAdjustmentFactor,
        originalFee: originalSupervisionFeeBeforeAdj,
        message: `مدة الإشراف المقدمة ${statedDuration} شهر — مدة المشروع ${durationMonths} شهر — السعر سيُعدَّل بمعامل ${durationAdjustmentFactor.toFixed(2)}`,
      };
    }

    if (!consultant.supervision_submitted) {
      canRank = 0;
    } else {
      const supTeam = await qRows<any>(
        db,
        sql`SELECT cst.supervision_role_id, cst.proposed_allocation_pct, cst.proposed_monthly_rate
            FROM cpa_consultant_supervision_team cst
            WHERE cst.project_consultant_id = ${pcId}`
      );
      const teamMap: Record<number, any> = {};
      for (const row of supTeam) {
        teamMap[Number(row.supervision_role_id)] = row;
      }

      if (consultant.supervision_fee_method === "LUMP_SUM") {
        // Apply duration adjustment if stated duration < project duration
        originalSupervisionFeeBeforeAdj = toNum(consultant.supervision_fee_amount);
        quotedSupervisionFee = originalSupervisionFeeBeforeAdj * durationAdjustmentFactor;
      } else if (consultant.supervision_fee_method === "PERCENTAGE") {
        // Apply duration adjustment if stated duration < project duration
        quotedSupervisionFee =
          ((totalConstructionCost * toNum(consultant.supervision_fee_percentage)) / 100);
        originalSupervisionFeeBeforeAdj = quotedSupervisionFee;
        quotedSupervisionFee = quotedSupervisionFee * durationAdjustmentFactor;
      } else if (consultant.supervision_fee_method === "MONTHLY_RATE") {
        for (const row of supTeam) {
          if (row.proposed_monthly_rate) {
            quotedSupervisionFee +=
              toNum(row.proposed_monthly_rate) *
              durationMonths *
              (toNum(row.proposed_allocation_pct) / 100);
          }
        }
      }

      // Supervision gap — ONLY for MONTHLY_RATE (per spec Section 3A/3B: no team gap for LUMP_SUM or PERCENTAGE)
      let supervisionGapCost = 0;
      if (consultant.supervision_fee_method === "MONTHLY_RATE") {
        for (const baseline of supervisionBaseline) {
          const roleId = Number(baseline.supervision_role_id);
          const required = toNum(baseline.required_allocation_pct);
          const proposed = toNum(teamMap[roleId]?.proposed_allocation_pct ?? 0);
          if (proposed < required) {
            const gapPct = required - proposed;
            const gapCost = toNum(baseline.monthly_rate_aed) * durationMonths * (gapPct / 100);
            supervisionGapCost += gapCost;
            notes.supervisionGaps.push({
              roleCode: baseline.code,
              roleLabel: baseline.label,
              required,
              proposed,
              gapPct,
              gapCost,
            });
          }
        }
      }

      const adjustedSupervisionFee = quotedSupervisionFee + supervisionGapCost;
      const trueDesignFee = quotedDesignFee + designScopeGapCost;
      const totalTrueCost = trueDesignFee + adjustedSupervisionFee;

      results.push({
        pcId,
        consultantId: consultant.consultant_id,
        consultantName: consultant.trade_name || consultant.legal_name,
        consultantCode: consultant.consultant_code,
        quotedDesignFee,
        designScopeGapCost,
        trueDesignFee,
        quotedSupervisionFee,
        supervisionGapCost,
        adjustedSupervisionFee,
        totalTrueCost,
        canRank,
        notes,
      });
      continue;
    }

    // No supervision submitted
    const trueDesignFee = quotedDesignFee + designScopeGapCost;
    results.push({
      pcId,
      consultantId: consultant.consultant_id,
      consultantName: consultant.trade_name || consultant.legal_name,
      consultantCode: consultant.consultant_code,
      quotedDesignFee,
      designScopeGapCost,
      trueDesignFee,
      quotedSupervisionFee: null,
      supervisionGapCost: null,
      adjustedSupervisionFee: null,
      totalTrueCost: null,
      canRank: 0,
      notes,
    });
  }

  // Rank by total_true_cost
  const rankable = results
    .filter((r) => r.canRank === 1)
    .sort((a, b) => a.totalTrueCost - b.totalTrueCost);
  rankable.forEach((r, i) => {
    r.resultRank = i + 1;
  });
  const unrankable = results.filter((r) => r.canRank === 0);
  unrankable.forEach((r) => {
    r.resultRank = null;
  });

  // Persist results
  for (const r of results) {
    const notesJson = JSON.stringify(r.notes);
    await db.execute(
      sql`INSERT INTO cpa_evaluation_results
            (project_consultant_id, quoted_design_fee, design_scope_gap_cost, true_design_fee,
             quoted_supervision_fee, supervision_gap_cost, adjusted_supervision_fee,
             total_true_cost, eval_rank, can_rank, calculation_notes, calculated_at)
          VALUES (${r.pcId}, ${r.quotedDesignFee}, ${r.designScopeGapCost}, ${r.trueDesignFee},
                  ${r.quotedSupervisionFee}, ${r.supervisionGapCost}, ${r.adjustedSupervisionFee},
                  ${r.totalTrueCost}, ${r.resultRank}, ${r.canRank}, ${notesJson}, NOW())
          ON DUPLICATE KEY UPDATE
            quoted_design_fee = VALUES(quoted_design_fee),
            design_scope_gap_cost = VALUES(design_scope_gap_cost),
            true_design_fee = VALUES(true_design_fee),
            quoted_supervision_fee = VALUES(quoted_supervision_fee),
            supervision_gap_cost = VALUES(supervision_gap_cost),
            adjusted_supervision_fee = VALUES(adjusted_supervision_fee),
            total_true_cost = VALUES(total_true_cost),
            eval_rank = VALUES(eval_rank),
            can_rank = VALUES(can_rank),
            calculation_notes = VALUES(calculation_notes),
            calculated_at = NOW()`
    );
    await db.execute(
      sql`UPDATE cpa_project_consultants SET status = 'EVALUATED' WHERE id = ${r.pcId}`
    );
  }

  return [...rankable, ...unrankable];
}

// ---- Router ----------------------------------------------------------------

export const cpaRouter = router({
  // ---- Settings ----
  settings: router({
    getBuildingCategories: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return qRows(db, sql`SELECT * FROM cpa_building_categories ORDER BY sort_order, id`);
    }),

    upsertBuildingCategory: protectedProcedure
      .input(
        z.object({
          id: z.number().optional(),
          code: z.string(),
          label: z.string(),
          buaMinSqft: z.number().nullable().optional(),
          buaMaxSqft: z.number().nullable().optional(),
          description: z.string().optional(),
          sortOrder: z.number().optional(),
          isActive: z.number().optional(),
          supervisionDurationMonths: z.number().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB unavailable");
        if (input.id) {
          await db.execute(
            sql`UPDATE cpa_building_categories
                SET code=${input.code}, label=${input.label},
                    bua_min_sqft=${input.buaMinSqft ?? null},
                    bua_max_sqft=${input.buaMaxSqft ?? null},
                    description=${input.description ?? null},
                    sort_order=${input.sortOrder ?? 0},
                    is_active=${input.isActive ?? 1},
                    supervision_duration_months=${input.supervisionDurationMonths ?? null}
                WHERE id=${input.id}`
          );
          return { id: input.id };
        } else {
          const r = await db.execute(
            sql`INSERT INTO cpa_building_categories
                  (code, label, bua_min_sqft, bua_max_sqft, description, sort_order, supervision_duration_months)
                VALUES (${input.code}, ${input.label},
                        ${input.buaMinSqft ?? null}, ${input.buaMaxSqft ?? null},
                        ${input.description ?? null}, ${input.sortOrder ?? 0},
                        ${input.supervisionDurationMonths ?? null})`
          );
          return { id: (r[0] as any).insertId };
        }
      }),

    getScopeSections: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return qRows(db, sql`SELECT * FROM cpa_scope_sections ORDER BY sort_order, id`);
    }),

    getScopeItems: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return qRows(
        db,
        sql`SELECT si.*, ss.label as section_label
            FROM cpa_scope_items si
            LEFT JOIN cpa_scope_sections ss ON ss.id = si.section_id
            WHERE si.is_active = 1
            ORDER BY si.sort_order, si.item_number`
      );
    }),

    upsertScopeItem: protectedProcedure
      .input(
        z.object({
          id: z.number().optional(),
          itemNumber: z.number(),
          code: z.string(),
          label: z.string(),
          sectionId: z.number().nullable().optional(),
          defaultType: z.enum(["CORE", "GREEN", "RED", "CONTRACTOR"]),
          description: z.string().optional(),
          sortOrder: z.number().optional(),
          isActive: z.number().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB unavailable");
        if (input.id) {
          await db.execute(
            sql`UPDATE cpa_scope_items
                SET item_number=${input.itemNumber}, code=${input.code}, label=${input.label},
                    section_id=${input.sectionId ?? null}, default_type=${input.defaultType},
                    description=${input.description ?? null},
                    sort_order=${input.sortOrder ?? 0}, is_active=${input.isActive ?? 1}
                WHERE id=${input.id}`
          );
          return { id: input.id };
        } else {
          const r = await db.execute(
            sql`INSERT INTO cpa_scope_items
                  (item_number, code, label, section_id, default_type, description, sort_order)
                VALUES (${input.itemNumber}, ${input.code}, ${input.label},
                        ${input.sectionId ?? null}, ${input.defaultType},
                        ${input.description ?? null}, ${input.sortOrder ?? 0})`
          );
          return { id: (r[0] as any).insertId };
        }
      }),

    getScopeCategoryMatrix: protectedProcedure
      .input(z.object({ buildingCategoryId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        return qRows(
          db,
          sql`SELECT scm.*, si.code as item_code, si.label as item_label, si.item_number,
                     COALESCE(src.cost_aed, 0) as ref_cost
              FROM cpa_scope_category_matrix scm
              JOIN cpa_scope_items si ON si.id = scm.scope_item_id
              LEFT JOIN cpa_scope_reference_costs src
                ON src.scope_item_id = scm.scope_item_id
                AND src.building_category_id = scm.building_category_id
              WHERE scm.building_category_id = ${input.buildingCategoryId}
              ORDER BY si.sort_order, si.item_number`
        );
      }),

    upsertMatrixEntry: protectedProcedure
      .input(
        z.object({
          scopeItemId: z.number(),
          buildingCategoryId: z.number(),
          status: z.enum(["INCLUDED", "GREEN", "RED", "CONTRACTOR", "NOT_REQUIRED"]),
          refCostAed: z.number().nullable().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB unavailable");
        await db.execute(
          sql`INSERT INTO cpa_scope_category_matrix (scope_item_id, building_category_id, status)
              VALUES (${input.scopeItemId}, ${input.buildingCategoryId}, ${input.status})
              ON DUPLICATE KEY UPDATE status = VALUES(status)`
        );
        if (input.refCostAed !== undefined) {
          await db.execute(
            sql`INSERT INTO cpa_scope_reference_costs (scope_item_id, building_category_id, cost_aed)
                VALUES (${input.scopeItemId}, ${input.buildingCategoryId}, ${input.refCostAed})
                ON DUPLICATE KEY UPDATE cost_aed = VALUES(cost_aed)`
          );
        }
        return { ok: true };
      }),

    getSupervisionRoles: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return qRows(
        db,
        sql`SELECT * FROM cpa_supervision_roles WHERE is_active = 1 ORDER BY sort_order, id`
      );
    }),

    upsertSupervisionRole: protectedProcedure
      .input(
        z.object({
          id: z.number().optional(),
          code: z.string(),
          label: z.string(),
          grade: z.string().optional(),
          teamType: z.enum(["SITE", "HEAD_OFFICE"]),
          monthlyRateAed: z.number(),
          sortOrder: z.number().optional(),
          isActive: z.number().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB unavailable");
        if (input.id) {
          await db.execute(
            sql`UPDATE cpa_supervision_roles
                SET code=${input.code}, label=${input.label}, grade=${input.grade ?? null},
                    team_type=${input.teamType}, monthly_rate_aed=${input.monthlyRateAed},
                    sort_order=${input.sortOrder ?? 0}, is_active=${input.isActive ?? 1}
                WHERE id=${input.id}`
          );
          return { id: input.id };
        } else {
          const r = await db.execute(
            sql`INSERT INTO cpa_supervision_roles
                  (code, label, grade, team_type, monthly_rate_aed, sort_order)
                VALUES (${input.code}, ${input.label}, ${input.grade ?? null},
                        ${input.teamType}, ${input.monthlyRateAed}, ${input.sortOrder ?? 0})`
          );
          return { id: (r[0] as any).insertId };
        }
      }),

    deleteSupervisionRole: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB unavailable");
        await db.execute(sql`DELETE FROM cpa_supervision_baseline WHERE supervision_role_id=${input.id}`);
        await db.execute(sql`DELETE FROM cpa_consultant_supervision_team WHERE supervision_role_id=${input.id}`);
        await db.execute(sql`DELETE FROM cpa_supervision_roles WHERE id=${input.id}`);
        return { success: true };
      }),

    getSupervisionBaseline: protectedProcedure
      .input(z.object({ buildingCategoryId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        return qRows(
          db,
          sql`SELECT sb.*, sr.code as role_code, sr.label as role_label, sr.monthly_rate_aed
              FROM cpa_supervision_baseline sb
              JOIN cpa_supervision_roles sr ON sr.id = sb.supervision_role_id
              WHERE sb.building_category_id = ${input.buildingCategoryId}
              ORDER BY sr.sort_order`
        );
      }),

    upsertBaselineEntry: protectedProcedure
      .input(
        z.object({
          supervisionRoleId: z.number(),
          buildingCategoryId: z.number(),
          requiredAllocationPct: z.number(),
        })
      )
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB unavailable");
        await db.execute(
          sql`INSERT INTO cpa_supervision_baseline
                (supervision_role_id, building_category_id, required_allocation_pct)
              VALUES (${input.supervisionRoleId}, ${input.buildingCategoryId}, ${input.requiredAllocationPct})
              ON DUPLICATE KEY UPDATE required_allocation_pct = VALUES(required_allocation_pct)`
        );
        return { ok: true };
      }),

    getConsultantsMaster: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return qRows(
        db,
        sql`SELECT * FROM cpa_consultants_master WHERE is_active = 1 ORDER BY legal_name`
      );
    }),

    upsertConsultantMaster: protectedProcedure
      .input(
        z.object({
          id: z.number().optional(),
          code: z.string(),
          legalName: z.string(),
          tradeName: z.string().optional(),
          registrationNo: z.string().optional(),
          specialties: z.string().optional(),
          contactEmail: z.string().optional(),
          contactPhone: z.string().optional(),
          isActive: z.number().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB unavailable");
        if (input.id) {
          await db.execute(
            sql`UPDATE cpa_consultants_master
                SET code=${input.code}, legal_name=${input.legalName},
                    trade_name=${input.tradeName ?? null},
                    registration_no=${input.registrationNo ?? null},
                    specialties=${input.specialties ?? null},
                    contact_email=${input.contactEmail ?? null},
                    contact_phone=${input.contactPhone ?? null},
                    is_active=${input.isActive ?? 1}
                WHERE id=${input.id}`
          );
          return { id: input.id };
        } else {
          const r = await db.execute(
            sql`INSERT INTO cpa_consultants_master
                  (code, legal_name, trade_name, registration_no, specialties, contact_email, contact_phone)
                VALUES (${input.code}, ${input.legalName}, ${input.tradeName ?? null},
                        ${input.registrationNo ?? null}, ${input.specialties ?? null},
                        ${input.contactEmail ?? null}, ${input.contactPhone ?? null})`
          );
          return { id: (r[0] as any).insertId };
        }
      }),

    deleteConsultantMaster: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB unavailable");
        await db.execute(
          sql`UPDATE cpa_consultants_master SET is_active = 0 WHERE id = ${input.id}`
        );
        return { ok: true };
      }),

    // Returns the full 47×5 matrix in one query for the settings table view
    getFullScopeMatrix: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return { items: [], categories: [], matrix: {} };

      const items = await qRows<any>(
        db,
        sql`SELECT si.id, si.item_number, si.code, si.label, si.default_type,
                   ss.label as section_label, ss.code as section_code
            FROM cpa_scope_items si
            LEFT JOIN cpa_scope_sections ss ON ss.id = si.section_id
            WHERE si.is_active = 1
            ORDER BY si.item_number`
      );

      const categories = await qRows<any>(
        db,
        sql`SELECT id, code, label FROM cpa_building_categories WHERE is_active = 1 ORDER BY sort_order`
      );

      const matrixRows = await qRows<any>(
        db,
        sql`SELECT scm.scope_item_id, scm.building_category_id, scm.status
            FROM cpa_scope_category_matrix scm
            JOIN cpa_scope_items si ON si.id = scm.scope_item_id
            WHERE si.is_active = 1`
      );

      // Build matrix map: { itemId_catId: status }
      const matrix: Record<string, string> = {};
      for (const row of matrixRows) {
        matrix[`${row.scope_item_id}_${row.building_category_id}`] = row.status;
      }

      return { items, categories, matrix };
    }),

    // Returns the full 47×5 reference costs in one query
    getFullReferenceCosts: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return { items: [], categories: [], costs: {} };

      const items = await qRows<any>(
        db,
        sql`SELECT si.id, si.item_number, si.code, si.label, si.default_type
            FROM cpa_scope_items si
            WHERE si.is_active = 1 AND si.default_type IN ('GREEN', 'RED')
            ORDER BY si.item_number`
      );

      const categories = await qRows<any>(
        db,
        sql`SELECT id, code, label FROM cpa_building_categories WHERE is_active = 1 ORDER BY sort_order`
      );

      const costRows = await qRows<any>(
        db,
        sql`SELECT src.scope_item_id, src.building_category_id, src.cost_aed
            FROM cpa_scope_reference_costs src
            JOIN cpa_scope_items si ON si.id = src.scope_item_id
            WHERE si.is_active = 1`
      );

      const costs: Record<string, number | null> = {};
      for (const row of costRows) {
        costs[`${row.scope_item_id}_${row.building_category_id}`] = row.cost_aed !== null ? Number(row.cost_aed) : null;
      }

      return { items, categories, costs };
    }),

    upsertReferenceCost: protectedProcedure
      .input(z.object({
        scopeItemId: z.number(),
        buildingCategoryId: z.number(),
        costAed: z.number().nullable(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB unavailable");
        if (input.costAed === null) {
          await db.execute(
            sql`DELETE FROM cpa_scope_reference_costs
                WHERE scope_item_id = ${input.scopeItemId}
                  AND building_category_id = ${input.buildingCategoryId}`
          );
        } else {
          await db.execute(
            sql`INSERT INTO cpa_scope_reference_costs (scope_item_id, building_category_id, cost_aed)
                VALUES (${input.scopeItemId}, ${input.buildingCategoryId}, ${input.costAed})
                ON DUPLICATE KEY UPDATE cost_aed = VALUES(cost_aed)`
          );
        }
        return { ok: true };
      }),

    // Returns the full 11×5 supervision baseline in one query
    getFullSupervisionBaseline: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return { roles: [], categories: [], baseline: {} };

      const roles = await qRows<any>(
        db,
        sql`SELECT id, code, label, grade, team_type, monthly_rate_aed
            FROM cpa_supervision_roles WHERE is_active = 1 ORDER BY sort_order`
      );

      const categories = await qRows<any>(
        db,
        sql`SELECT id, code, label FROM cpa_building_categories WHERE is_active = 1 ORDER BY sort_order`
      );

      const baselineRows = await qRows<any>(
        db,
        sql`SELECT sb.supervision_role_id, sb.building_category_id, sb.required_allocation_pct
            FROM cpa_supervision_baseline sb
            JOIN cpa_supervision_roles sr ON sr.id = sb.supervision_role_id
            WHERE sr.is_active = 1`
      );

      const baseline: Record<string, number> = {};
      for (const row of baselineRows) {
        baseline[`${row.supervision_role_id}_${row.building_category_id}`] = Number(row.required_allocation_pct);
      }

      return { roles, categories, baseline };
    }),
  }),

  // ---- CPA Projects ----
  projects: router({
    list: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return qRows(
        db,
        sql`SELECT cp.*, p.name as project_name, p.plotNumber as sys_plot_number,
                   bc.label as category_label, bc.code as category_code,
                   (SELECT COUNT(*) FROM cpa_project_consultants pc WHERE pc.cpa_project_id = cp.id) as consultant_count
            FROM cpa_projects cp
            JOIN projects p ON p.id = cp.project_id
            LEFT JOIN cpa_building_categories bc ON bc.id = cp.building_category_id
            ORDER BY cp.created_at DESC`
      );
    }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return null;
        const rows = await qRows<any>(
          db,
          sql`SELECT cp.*, p.name as project_name, p.bua as sys_bua,
                     p.pricePerSqft as sys_price_per_sqft,
                     bc.label as category_label, bc.code as category_code
              FROM cpa_projects cp
              JOIN projects p ON p.id = cp.project_id
              LEFT JOIN cpa_building_categories bc ON bc.id = cp.building_category_id
              WHERE cp.id = ${input.id}`
        );
        return rows[0] ?? null;
      }),

    create: protectedProcedure
      .input(
        z.object({
          projectId: z.number(),
          plotNumber: z.string(),
          location: z.string().optional(),
          projectType: z
            .enum(["RESIDENTIAL", "COMMERCIAL", "MIXED_USE", "OTHER"])
            .optional(),
          description: z.string().optional(),
          buaSqft: z.number(),
          buildingCategoryId: z.number().nullable().optional(),
          constructionCostPerSqft: z.number(),
          durationMonths: z.number(),
        })
      )
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB unavailable");
        let catId = input.buildingCategoryId ?? null;
        if (!catId) {
          const cats = await qRows<any>(
            db,
            sql`SELECT id FROM cpa_building_categories
                WHERE is_active = 1
                  AND (bua_min_sqft IS NULL OR bua_min_sqft <= ${input.buaSqft})
                  AND (bua_max_sqft IS NULL OR bua_max_sqft >= ${input.buaSqft})
                ORDER BY sort_order LIMIT 1`
          );
          catId = cats[0]?.id ?? null;
        }
        const r = await db.execute(
          sql`INSERT INTO cpa_projects
                (project_id, plot_number, location, project_type, description,
                 bua_sqft, building_category_id, construction_cost_per_sqft, duration_months)
              VALUES (${input.projectId}, ${input.plotNumber}, ${input.location ?? null},
                      ${input.projectType ?? "RESIDENTIAL"}, ${input.description ?? null},
                      ${input.buaSqft}, ${catId}, ${input.constructionCostPerSqft},
                      ${input.durationMonths})`
        );
        return { id: (r[0] as any).insertId };
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          plotNumber: z.string().optional(),
          location: z.string().optional(),
          projectType: z
            .enum(["RESIDENTIAL", "COMMERCIAL", "MIXED_USE", "OTHER"])
            .optional(),
          description: z.string().optional(),
          buaSqft: z.number().optional(),
          buildingCategoryId: z.number().nullable().optional(),
          constructionCostPerSqft: z.number().optional(),
          durationMonths: z.number().optional(),
          status: z.enum(["ACTIVE", "COMPLETED", "CANCELLED"]).optional(),
        })
      )
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB unavailable");
        const { id, ...fields } = input;
        // Build dynamic update using individual field checks
        if (fields.plotNumber !== undefined)
          await db.execute(sql`UPDATE cpa_projects SET plot_number=${fields.plotNumber} WHERE id=${id}`);
        if (fields.location !== undefined)
          await db.execute(sql`UPDATE cpa_projects SET location=${fields.location} WHERE id=${id}`);
        if (fields.projectType !== undefined)
          await db.execute(sql`UPDATE cpa_projects SET project_type=${fields.projectType} WHERE id=${id}`);
        if (fields.description !== undefined)
          await db.execute(sql`UPDATE cpa_projects SET description=${fields.description} WHERE id=${id}`);
        if (fields.buaSqft !== undefined)
          await db.execute(sql`UPDATE cpa_projects SET bua_sqft=${fields.buaSqft} WHERE id=${id}`);
        if (fields.buildingCategoryId !== undefined)
          await db.execute(sql`UPDATE cpa_projects SET building_category_id=${fields.buildingCategoryId} WHERE id=${id}`);
        if (fields.constructionCostPerSqft !== undefined)
          await db.execute(sql`UPDATE cpa_projects SET construction_cost_per_sqft=${fields.constructionCostPerSqft} WHERE id=${id}`);
        if (fields.durationMonths !== undefined)
          await db.execute(sql`UPDATE cpa_projects SET duration_months=${fields.durationMonths} WHERE id=${id}`);
        if (fields.status !== undefined)
           await db.execute(sql`UPDATE cpa_projects SET status=${fields.status} WHERE id=${id}`);
        return { ok: true };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB unavailable");
        // Cascade delete: evaluation results → supervision team → scope coverage → project consultants → project
        // cpa_evaluation_results uses project_consultant_id, not cpa_project_id
        await db.execute(sql`DELETE FROM cpa_evaluation_results WHERE project_consultant_id IN (SELECT id FROM cpa_project_consultants WHERE cpa_project_id = ${input.id})`);
        const pcs = await qRows<any>(db, sql`SELECT id FROM cpa_project_consultants WHERE cpa_project_id = ${input.id}`);
        for (const pc of pcs) {
          await db.execute(sql`DELETE FROM cpa_consultant_supervision_team WHERE project_consultant_id = ${pc.id}`);
          await db.execute(sql`DELETE FROM cpa_consultant_scope_coverage WHERE project_consultant_id = ${pc.id}`);
        }
        await db.execute(sql`DELETE FROM cpa_project_consultants WHERE cpa_project_id = ${input.id}`);
        await db.execute(sql`DELETE FROM cpa_projects WHERE id = ${input.id}`);
        return { ok: true };
      }),
  }),
  // ---- Project Consultants ----
  consultants: router({
    listByProject: protectedProcedure
      .input(z.object({ cpaProjectId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        return qRows(
          db,
          sql`WITH latest_er AS (
                SELECT er2.id, er2.project_consultant_id, er2.total_true_cost, er2.eval_rank,
                       er2.can_rank, er2.quoted_design_fee, er2.design_scope_gap_cost, er2.true_design_fee,
                       er2.quoted_supervision_fee, er2.supervision_gap_cost, er2.adjusted_supervision_fee
                FROM cpa_evaluation_results er2
                INNER JOIN (
                  SELECT project_consultant_id, MAX(id) as max_id
                  FROM cpa_evaluation_results
                  GROUP BY project_consultant_id
                ) mx ON er2.id = mx.max_id
              )
              SELECT pc.*, cm.legal_name, cm.trade_name, cm.code as consultant_code,
                     ler.total_true_cost, ler.eval_rank as result_rank, ler.can_rank, ler.quoted_design_fee,
                     ler.design_scope_gap_cost, ler.true_design_fee,
                     ler.quoted_supervision_fee, ler.supervision_gap_cost, ler.adjusted_supervision_fee
              FROM cpa_project_consultants pc
              JOIN cpa_consultants_master cm ON cm.id = pc.consultant_id
              LEFT JOIN latest_er ler ON ler.project_consultant_id = pc.id
              WHERE pc.cpa_project_id = ${input.cpaProjectId}
              ORDER BY COALESCE(ler.eval_rank, 999), pc.created_at`
        );
      }),

    addConsultant: protectedProcedure
      .input(
        z.object({
          cpaProjectId: z.number(),
          consultantId: z.number(),
        })
      )
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB unavailable");
        const r = await db.execute(
          sql`INSERT INTO cpa_project_consultants (cpa_project_id, consultant_id)
              VALUES (${input.cpaProjectId}, ${input.consultantId})`
        );
        return { id: (r[0] as any).insertId };
      }),

    removeConsultant: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB unavailable");
        await db.execute(
          sql`DELETE FROM cpa_project_consultants WHERE id = ${input.id}`
        );
        return { ok: true };
      }),

    updateFees: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          proposalDate: z.string().optional(),
          proposalReference: z.string().optional(),
          designFeeAmount: z.number().nullable().optional(),
          designFeeMethod: z.enum(["LUMP_SUM", "PERCENTAGE", "MONTHLY_RATE"]).optional(),
          designFeePercentage: z.number().nullable().optional(),
          supervisionFeeAmount: z.number().nullable().optional(),
          supervisionFeeMethod: z.enum(["LUMP_SUM", "PERCENTAGE", "MONTHLY_RATE"]).nullable().optional(),
          supervisionFeePercentage: z.number().nullable().optional(),
          supervisionStatedDurationMonths: z.number().nullable().optional(),
          supervisionSubmitted: z.number().optional(),
          status: z.enum(["DRAFT", "CONFIRMED", "EVALUATED"]).optional(),
        })
      )
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB unavailable");
        const { id, ...f } = input;
        if (f.proposalDate !== undefined)
          await db.execute(sql`UPDATE cpa_project_consultants SET proposal_date=${f.proposalDate} WHERE id=${id}`);
        if (f.proposalReference !== undefined)
          await db.execute(sql`UPDATE cpa_project_consultants SET proposal_reference=${f.proposalReference} WHERE id=${id}`);
        if (f.designFeeAmount !== undefined)
          await db.execute(sql`UPDATE cpa_project_consultants SET design_fee_amount=${f.designFeeAmount} WHERE id=${id}`);
        if (f.designFeeMethod !== undefined)
          await db.execute(sql`UPDATE cpa_project_consultants SET design_fee_method=${f.designFeeMethod} WHERE id=${id}`);
        if (f.designFeePercentage !== undefined)
          await db.execute(sql`UPDATE cpa_project_consultants SET design_fee_percentage=${f.designFeePercentage} WHERE id=${id}`);
        if (f.supervisionFeeAmount !== undefined)
          await db.execute(sql`UPDATE cpa_project_consultants SET supervision_fee_amount=${f.supervisionFeeAmount} WHERE id=${id}`);
        if (f.supervisionFeeMethod !== undefined)
          await db.execute(sql`UPDATE cpa_project_consultants SET supervision_fee_method=${f.supervisionFeeMethod} WHERE id=${id}`);
        if (f.supervisionFeePercentage !== undefined)
          await db.execute(sql`UPDATE cpa_project_consultants SET supervision_fee_percentage=${f.supervisionFeePercentage} WHERE id=${id}`);
        if (f.supervisionStatedDurationMonths !== undefined)
          await db.execute(sql`UPDATE cpa_project_consultants SET supervision_stated_duration_months=${f.supervisionStatedDurationMonths} WHERE id=${id}`);
        if (f.supervisionSubmitted !== undefined)
          await db.execute(sql`UPDATE cpa_project_consultants SET supervision_submitted=${f.supervisionSubmitted} WHERE id=${id}`);
        if (f.status !== undefined)
          await db.execute(sql`UPDATE cpa_project_consultants SET status=${f.status} WHERE id=${id}`);
        return { ok: true };
      }),

    importJson: protectedProcedure
      .input(
        z.object({
          cpaProjectId: z.number(),
          jsonText: z.string(),
        })
      )
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB unavailable");
        let parsed: any;
        try {
          parsed = JSON.parse(input.jsonText);
        } catch {
          throw new Error("JSON غير صالح -- تأكد من صحة التنسيق");
        }
        if (!parsed.consultant_code) throw new Error("consultant_code مفقود");
        if (!parsed.design_fee?.method) throw new Error("design_fee.method مفقود");

        const consultants = await qRows<any>(
          db,
          sql`SELECT id FROM cpa_consultants_master WHERE code = ${parsed.consultant_code} AND is_active = 1`
        );
        if (!consultants[0])
          throw new Error(`الاستشاري "${parsed.consultant_code}" غير موجود`);
        const consultantId = consultants[0].id;

        const existing = await qRows<any>(
          db,
          sql`SELECT id FROM cpa_project_consultants
              WHERE cpa_project_id = ${input.cpaProjectId} AND consultant_id = ${consultantId}`
        );

        let pcId: number;
        const designMethod = String(parsed.design_fee.method).toUpperCase();
        const supMethod = parsed.supervision_fee?.method
          ? String(parsed.supervision_fee.method).toUpperCase()
          : null;
        const supSubmitted = parsed.supervision_fee?.submitted ? 1 : 0;
        // ملاحظة 2: عند PERCENTAGE يتجاهل النظام amount ويعيد الحساب من النسبة
        const designFeeAmount = designMethod === "PERCENTAGE" ? null : (parsed.design_fee.amount ?? null);
        const supFeeAmount = supMethod === "PERCENTAGE" ? null : (parsed.supervision_fee?.amount ?? null);

        if (existing[0]) {
          pcId = existing[0].id;
          await db.execute(
            sql`UPDATE cpa_project_consultants SET
                  proposal_date=${parsed.proposal_date ?? null},
                  proposal_reference=${parsed.proposal_reference ?? null},
                  design_fee_amount=${designFeeAmount},
                  design_fee_method=${designMethod},
                  design_fee_percentage=${parsed.design_fee.percentage ?? null},
                  supervision_fee_amount=${supFeeAmount},
                  supervision_fee_method=${supMethod},
                  supervision_fee_percentage=${parsed.supervision_fee?.percentage ?? null},
                  supervision_stated_duration_months=${parsed.supervision_fee?.stated_duration_months ?? null},
                  supervision_submitted=${supSubmitted},
                  import_json=${input.jsonText},
                  status='CONFIRMED'
                WHERE id=${pcId}`
          );
        } else {
          const r = await db.execute(
            sql`INSERT INTO cpa_project_consultants
                  (cpa_project_id, consultant_id, proposal_date, proposal_reference,
                   design_fee_amount, design_fee_method, design_fee_percentage,
                   supervision_fee_amount, supervision_fee_method, supervision_fee_percentage,
                   supervision_stated_duration_months, supervision_submitted, import_json, status)
                VALUES (${input.cpaProjectId}, ${consultantId},
                        ${parsed.proposal_date ?? null}, ${parsed.proposal_reference ?? null},
                        ${designFeeAmount}, ${designMethod},
                        ${parsed.design_fee.percentage ?? null},
                        ${supFeeAmount}, ${supMethod},
                        ${parsed.supervision_fee?.percentage ?? null},
                        ${parsed.supervision_fee?.stated_duration_months ?? null},
                        ${supSubmitted}, ${input.jsonText}, 'CONFIRMED')`
          );
          pcId = (r[0] as any).insertId;
        }

        // Import scope coverage
        let scopeIncluded = 0, scopeExcluded = 0, scopeNotMentioned = 0;
        if (parsed.scope_coverage?.length) {
          for (const item of parsed.scope_coverage) {
            const scopeRows = await qRows<any>(
              db,
              sql`SELECT id FROM cpa_scope_items WHERE code = ${item.item_code}`
            );
            if (!scopeRows[0]) continue;
            const status = String(item.status).toUpperCase();
            if (status === "INCLUDED") scopeIncluded++;
            else if (status === "EXCLUDED") scopeExcluded++;
            else scopeNotMentioned++;
            await db.execute(
              sql`INSERT INTO cpa_consultant_scope_coverage
                    (project_consultant_id, scope_item_id, coverage_status)
                  VALUES (${pcId}, ${scopeRows[0].id}, ${status})
                  ON DUPLICATE KEY UPDATE coverage_status = VALUES(coverage_status)`
            );
          }
        }

        // Import supervision team
        let supervisionRolesImported = 0;
        if (parsed.supervision_team?.length) {
          for (const member of parsed.supervision_team) {
            const roleRows = await qRows<any>(
              db,
              sql`SELECT id FROM cpa_supervision_roles WHERE code = ${member.role_code}`
            );
            if (!roleRows[0]) continue;
            supervisionRolesImported++;
            await db.execute(
              sql`INSERT INTO cpa_consultant_supervision_team
                    (project_consultant_id, supervision_role_id, proposed_allocation_pct, proposed_monthly_rate)
                  VALUES (${pcId}, ${roleRows[0].id}, ${member.allocation_pct ?? 0}, ${member.monthly_rate ?? null})
                  ON DUPLICATE KEY UPDATE
                    proposed_allocation_pct = VALUES(proposed_allocation_pct),
                    proposed_monthly_rate = VALUES(proposed_monthly_rate)`
            );
          }
        }

        return {
          pcId,
          consultantId,
          status: "CONFIRMED",
          summary: {
            scopeIncluded,
            scopeExcluded,
            scopeNotMentioned,
            scopeTotal: scopeIncluded + scopeExcluded + scopeNotMentioned,
            supervisionRolesImported,
          },
        };
      }),

    getScopeCoverage: protectedProcedure
      .input(z.object({ projectConsultantId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        return qRows(
          db,
          sql`SELECT csc.*, si.code as item_code, si.label as item_label, si.item_number,
                     si.default_type, ss.label as section_label
              FROM cpa_consultant_scope_coverage csc
              JOIN cpa_scope_items si ON si.id = csc.scope_item_id
              LEFT JOIN cpa_scope_sections ss ON ss.id = si.section_id
              WHERE csc.project_consultant_id = ${input.projectConsultantId}
              ORDER BY si.sort_order, si.item_number`
        );
      }),

    updateScopeCoverage: protectedProcedure
      .input(
        z.object({
          projectConsultantId: z.number(),
          scopeItemId: z.number(),
          coverageStatus: z.enum(["INCLUDED", "EXCLUDED", "NOT_MENTIONED"]),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB unavailable");
        await db.execute(
          sql`INSERT INTO cpa_consultant_scope_coverage
                (project_consultant_id, scope_item_id, coverage_status, notes)
              VALUES (${input.projectConsultantId}, ${input.scopeItemId},
                      ${input.coverageStatus}, ${input.notes ?? null})
              ON DUPLICATE KEY UPDATE
                coverage_status = VALUES(coverage_status),
                notes = VALUES(notes)`
        );
        return { ok: true };
      }),

    getSupervisionTeam: protectedProcedure
      .input(z.object({ projectConsultantId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        return qRows(
          db,
          sql`SELECT cst.*, sr.code as role_code, sr.label as role_label,
                     sr.team_type, sr.monthly_rate_aed as reference_rate
              FROM cpa_consultant_supervision_team cst
              JOIN cpa_supervision_roles sr ON sr.id = cst.supervision_role_id
              WHERE cst.project_consultant_id = ${input.projectConsultantId}
              ORDER BY sr.sort_order`
        );
      }),

    updateSupervisionTeam: protectedProcedure
      .input(
        z.object({
          projectConsultantId: z.number(),
          supervisionRoleId: z.number(),
          proposedAllocationPct: z.number(),
          proposedMonthlyRate: z.number().nullable().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB unavailable");
        await db.execute(
          sql`INSERT INTO cpa_consultant_supervision_team
                (project_consultant_id, supervision_role_id, proposed_allocation_pct, proposed_monthly_rate)
              VALUES (${input.projectConsultantId}, ${input.supervisionRoleId},
                      ${input.proposedAllocationPct}, ${input.proposedMonthlyRate ?? null})
              ON DUPLICATE KEY UPDATE
                proposed_allocation_pct = VALUES(proposed_allocation_pct),
                proposed_monthly_rate = VALUES(proposed_monthly_rate)`
        );
        return { ok: true };
      }),
  }),

  // ---- Evaluation ----
  evaluation: router({
    runEvaluation: protectedProcedure
      .input(z.object({ cpaProjectId: z.number() }))
      .mutation(async ({ input }) => {
        return runCalculationEngine(input.cpaProjectId);
      }),

    getResults: protectedProcedure
      .input(z.object({ cpaProjectId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const rows = await qRows<any>(
          db,
          sql`SELECT er.*, pc.consultant_id, cm.legal_name, cm.trade_name, cm.code as consultant_code,
                     pc.design_fee_method, pc.supervision_fee_method,
                     pc.supervision_stated_duration_months, pc.proposal_reference, pc.proposal_date
              FROM cpa_evaluation_results er
              JOIN cpa_project_consultants pc ON pc.id = er.project_consultant_id
              JOIN cpa_consultants_master cm ON cm.id = pc.consultant_id
              WHERE pc.cpa_project_id = ${input.cpaProjectId}
              ORDER BY COALESCE(er.eval_rank, 999), er.total_true_cost`
        );
        return rows.map((r: any) => ({
          ...r,
          calculationNotes: r.calculation_notes
            ? (() => { try { return JSON.parse(r.calculation_notes); } catch { return null; } })()
            : null,
        }));
      }),
  }),

  // ---- Delete Project ----
  deleteProject: protectedProcedure
    .input(z.object({ cpaProjectId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('DB unavailable');
      // Delete in order: evaluation results → scope coverage → consultant teams → project consultants → project
      await db.run(sql`DELETE FROM cpa_evaluation_results WHERE cpa_project_id = ${input.cpaProjectId}`);
      await db.run(sql`DELETE FROM cpa_consultant_scope_coverage WHERE project_consultant_id IN (SELECT id FROM cpa_project_consultants WHERE cpa_project_id = ${input.cpaProjectId})`);
      await db.run(sql`DELETE FROM cpa_consultant_supervision_team WHERE project_consultant_id IN (SELECT id FROM cpa_project_consultants WHERE cpa_project_id = ${input.cpaProjectId})`);
      await db.run(sql`DELETE FROM cpa_project_consultants WHERE cpa_project_id = ${input.cpaProjectId}`);
      await db.run(sql`DELETE FROM cpa_projects WHERE id = ${input.cpaProjectId}`);
      return { success: true };
    }),

  // ---- Utility ----
  getSystemProjects: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return qRows(
      db,
      sql`SELECT
        id,
        name,
        plotNumber          AS plot_number,
        bua,
        pricePerSqft        AS price_per_sqft,
        manualBuaSqft       AS manual_bua_sqft,
        gfaSqft             AS gfa_sqft,
        estimatedConstructionPricePerSqft AS construction_cost_per_sqft,
        permittedUse        AS permitted_use,
        areaCode            AS area_code
      FROM projects
      ORDER BY name`
    );
  }),
});
