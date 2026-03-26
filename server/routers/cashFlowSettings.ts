/**
 * cashFlowSettings.ts — Server router for user-configurable cash flow settings
 *
 * Provides:
 * 1. CRUD for project_cash_flow_settings (per-project, per-scenario item settings)
 * 2. getDefaultSettings — generates default settings from project data (fact sheet + feasibility)
 * 3. getReflectionData — computes the monthly cash flow reflection table based on settings
 */

/**
 * cashFlowSettings router - see file header above
 */
import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  projectCashFlowSettings,
  projects,
  marketOverview,
  competitionPricing,
} from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import {
  calculateProjectCosts,
  calculatePhases,
  legacyToNewDurations,
  getTotalMonths,
  type FinancingScenario,
} from "../investorCashFlow";

// ─── Types ────────────────────────────────────────────────────────────────────

const SCENARIOS = ["offplan_escrow", "offplan_construction", "no_offplan"] as const;
type Scenario = typeof SCENARIOS[number];

const DISTRIBUTION_METHODS = ["lump_sum", "equal_spread", "custom"] as const;
type DistributionMethod = typeof DISTRIBUTION_METHODS[number];

const FUNDING_SOURCES = ["investor", "escrow"] as const;
type FundingSource = typeof FUNDING_SOURCES[number];

const CATEGORIES = [
  "land", "design", "offplan_reg", "construction",
  "marketing_sales", "admin", "developer_fee", "revenue", "other"
] as const;
type Category = typeof CATEGORIES[number];

// ─── Default item definitions ─────────────────────────────────────────────────
// These define the canonical list of items for each scenario.
// Amounts are computed at runtime from project data.

interface DefaultItemDef {
  itemKey: string;
  nameAr: string;
  category: Category;
  /** Which display section this belongs to in جدول الانعكاس */
  section: "paid" | "design" | "offplan" | "construction" | "escrow";
  sortOrder: number;
  fundingSource: FundingSource;
  distributionMethod: DistributionMethod;
  // Phase-relative timing (will be converted to absolute months)
  phase?: "land" | "design" | "offplan" | "construction" | "handover";
  phaseRelativeMonth?: number;
  phaseRelativeEnd?: number; // for equal_spread: distribute from phaseRelativeMonth to phaseRelativeEnd
  distributeAcrossPhases?: Array<"land" | "design" | "offplan" | "construction" | "handover">;
  // Scenarios where this item is active
  scenarios: Scenario[];
  // How to compute the amount from project costs
  amountKey?: keyof ReturnType<typeof calculateProjectCosts>;
  // Fixed fraction of another value
  amountFraction?: { of: "constructionCost"; ratio: number };
  // Split payments across phases (for developer_fee, marketing, etc.)
  splitRatio?: { phase: "land" | "design" | "offplan" | "construction" | "handover"; ratio: number }[];
}

function getDefaultItemDefs(scenario: Scenario): DefaultItemDef[] {
  const allScenarios: Scenario[] = ["offplan_escrow", "offplan_construction", "no_offplan"];
  const offplanScenarios: Scenario[] = ["offplan_escrow", "offplan_construction"];
  const isOffplan = scenario === "offplan_escrow" || scenario === "offplan_construction";

  return [
    // ═══ الأرض ═══
    {
      itemKey: "land_cost", nameAr: "سعر الأرض", category: "land", section: "paid", sortOrder: 1,
      fundingSource: "investor", distributionMethod: "lump_sum",
      phase: "land", phaseRelativeMonth: 0,
      scenarios: allScenarios, amountKey: "landPrice",
    },
    {
      itemKey: "land_broker", nameAr: "عمولة وسيط الأرض", category: "land", section: "paid", sortOrder: 2,
      fundingSource: "investor", distributionMethod: "lump_sum",
      phase: "land", phaseRelativeMonth: 0,
      scenarios: allScenarios, amountKey: "agentCommissionLand",
    },
    {
      itemKey: "land_registration", nameAr: "رسوم تسجيل الأرض (4%)", category: "land", section: "paid", sortOrder: 3,
      fundingSource: "investor", distributionMethod: "lump_sum",
      phase: "land", phaseRelativeMonth: 0,
      scenarios: allScenarios, amountKey: "landRegistration",
    },

    // ═══ التصاميم والموافقات ═══
    {
      itemKey: "government_fees_investor", nameAr: "رسوم الجهات الحكومية (10%)", category: "design", section: "design", sortOrder: 9,
      fundingSource: "investor", distributionMethod: "lump_sum",
      phase: "design", phaseRelativeMonth: 1,
      scenarios: allScenarios, amountKey: "officialBodiesFees",
      splitRatio: [{ phase: "design", ratio: 0.10 }],
    },
    {
      itemKey: "soil_test", nameAr: "فحص التربة", category: "design", section: "design", sortOrder: 10,
      fundingSource: "investor", distributionMethod: "lump_sum",
      phase: "design", phaseRelativeMonth: 1,
      scenarios: allScenarios, amountKey: "soilTestFee",
    },
    {
      itemKey: "survey", nameAr: "المسح الطبوغرافي", category: "design", section: "design", sortOrder: 11,
      fundingSource: "investor", distributionMethod: "lump_sum",
      phase: "design", phaseRelativeMonth: 1,
      scenarios: allScenarios, amountKey: "topographicSurveyFee",
    },
    {
      itemKey: "design_fee", nameAr: "أتعاب الاستشاري — التصاميم", category: "design", section: "design", sortOrder: 12,
      fundingSource: "investor", distributionMethod: "equal_spread",
      distributeAcrossPhases: ["design"],
      scenarios: allScenarios, amountKey: "designFee",
    },
    // أتعاب المطور — مقسمة إلى 3 بنود منفصلة
    // O1/O2 (أوف بلان): 5% → تصاميم 1% + أوف بلان 1% + إشراف 3% = 5%
    // O3 (بدون أوف بلان): 3% → تصاميم 1% + إشراف 2% = 3% (مهام المطور أقل)
    {
      itemKey: "developer_fee_design", nameAr: "أتعاب المطور — التصاميم (1%)", category: "developer_fee", section: "design", sortOrder: 13,
      fundingSource: "investor", distributionMethod: "equal_spread",
      distributeAcrossPhases: ["design"],
      scenarios: allScenarios, amountKey: "developerFee",
      splitRatio: [{ phase: "design", ratio: 0.2 }],  // O1/O2: 20% of 5% = 1% | O3: 20% of 5% = 1%
    },
    {
      itemKey: "developer_fee_offplan", nameAr: "أتعاب المطور — أوف بلان (1%)", category: "developer_fee", section: "offplan", sortOrder: 14,
      fundingSource: "investor", distributionMethod: "equal_spread",
      distributeAcrossPhases: ["offplan"],
      scenarios: offplanScenarios, amountKey: "developerFee",
      splitRatio: [{ phase: "offplan", ratio: 0.2 }],
    },

    // ═══ تسجيل أوف بلان ═══
    {
      itemKey: "fraz_fee", nameAr: "رسوم الفرز (40 د/قدم²)", category: "offplan_reg", section: "offplan", sortOrder: 20,
      fundingSource: "investor", distributionMethod: "lump_sum",
      phase: scenario === "no_offplan" ? "construction" : (scenario === "offplan_construction" ? "construction" : "offplan"),
      phaseRelativeMonth: scenario === "offplan_escrow" ? 1 : 3,
      scenarios: allScenarios, amountKey: "separationFee",
    },
    {
      itemKey: "rera_registration", nameAr: "تسجيل بيع على الخارطة - ريرا", category: "offplan_reg", section: "offplan", sortOrder: 21,
      fundingSource: "investor", distributionMethod: "lump_sum",
      phase: scenario === "offplan_escrow" ? "offplan" : "construction",
      phaseRelativeMonth: scenario === "offplan_escrow" ? 1 : 3,
      scenarios: offplanScenarios, amountKey: "reraProjectRegFee",
    },
    {
      itemKey: "rera_units", nameAr: "تسجيل الوحدات - ريرا", category: "offplan_reg", section: "offplan", sortOrder: 22,
      fundingSource: "investor", distributionMethod: "lump_sum",
      phase: scenario === "offplan_escrow" ? "offplan" : "construction",
      phaseRelativeMonth: scenario === "offplan_escrow" ? 1 : 3,
      scenarios: offplanScenarios, amountKey: "reraUnitRegFee",
    },
    {
      itemKey: "noc_fee", nameAr: "رسوم NOC للبيع", category: "offplan_reg", section: "offplan", sortOrder: 23,
      fundingSource: "investor", distributionMethod: "lump_sum",
      phase: scenario === "offplan_escrow" ? "offplan" : "construction",
      phaseRelativeMonth: scenario === "offplan_escrow" ? 1 : 3,
      scenarios: offplanScenarios, amountKey: "developerNocFee",
    },
    {
      itemKey: "escrow_fee", nameAr: "رسوم حساب الضمان", category: "offplan_reg", section: "offplan", sortOrder: 24,
      fundingSource: "investor", distributionMethod: "lump_sum",
      phase: scenario === "offplan_escrow" ? "offplan" : "construction",
      phaseRelativeMonth: scenario === "offplan_escrow" ? 1 : 3,
      scenarios: offplanScenarios, amountKey: "escrowAccountFee",
    },
    {
      itemKey: "community_fee", nameAr: "رسوم المجتمع", category: "offplan_reg", section: "offplan", sortOrder: 25,
      fundingSource: "investor", distributionMethod: "lump_sum",
      phase: scenario === "offplan_escrow" ? "offplan" : "construction",
      phaseRelativeMonth: scenario === "offplan_escrow" ? 2 : 4,
      scenarios: allScenarios, amountKey: "communityFees",
    },
    // التسويق والإعلان — 25% في مرحلة أوف بلان (من حساب الضمان)
    {
      itemKey: "marketing_offplan", nameAr: "التسويق والإعلان — أوف بلان (25%)", category: "marketing_sales", section: "offplan", sortOrder: 26,
      fundingSource: "investor", distributionMethod: "equal_spread",
      distributeAcrossPhases: ["offplan"],
      scenarios: offplanScenarios, amountKey: "marketingCost",
      splitRatio: [{ phase: "offplan", ratio: 0.25 }],
    },

    // ═══ إيداع الضمان / دفعات الإنجاز ═══
    {
      itemKey: "escrow_deposit", nameAr: "إيداع حساب الضمان (20%)", category: "offplan_reg", section: "offplan", sortOrder: 27,
      fundingSource: "investor", distributionMethod: "lump_sum",
      phase: "offplan", phaseRelativeMonth: 2,
      scenarios: ["offplan_escrow"],
      amountFraction: { of: "constructionCost", ratio: 0.20 },
    },
    {
      itemKey: "contractor_advance", nameAr: "دفعة مقدمة للمقاول (10%)", category: "construction", section: "construction", sortOrder: 31,
      fundingSource: "investor", distributionMethod: "lump_sum",
      phase: "construction", phaseRelativeMonth: 1,
      scenarios: allScenarios,
      amountFraction: { of: "constructionCost", ratio: 0.10 },
    },

    // ═══ الإنشاء ═══
    {
      itemKey: "contingency", nameAr: "احتياطي وطوارئ (2%)", category: "construction", section: "construction", sortOrder: 40,
      fundingSource: "investor", distributionMethod: "equal_spread",
      distributeAcrossPhases: ["construction"],
      scenarios: allScenarios, amountKey: "contingencies",
    },
    {
      itemKey: "bank_fees", nameAr: "رسوم بنكية", category: "admin", section: "construction", sortOrder: 41,
      fundingSource: "investor", distributionMethod: "equal_spread",
      distributeAcrossPhases: ["construction", "handover"],
      scenarios: allScenarios, amountKey: "bankFees",
    },

    // رسوم الجهات الحكومية (90% من الضمان)
    {
      itemKey: "government_fees_escrow", nameAr: "رسوم الجهات الحكومية (90%)", category: "construction", section: "escrow", sortOrder: 54,
      fundingSource: "escrow", distributionMethod: "equal_spread",
      distributeAcrossPhases: ["construction"],
      scenarios: allScenarios, amountKey: "officialBodiesFees",
      splitRatio: [{ phase: "construction", ratio: 0.90 }],
    },
    // رسوم المجتمع (75% من الضمان)
    {
      itemKey: "community_fee_escrow", nameAr: "رسوم المجتمع (75%)", category: "construction", section: "escrow", sortOrder: 56,
      fundingSource: "investor", distributionMethod: "equal_spread",
      distributeAcrossPhases: ["construction"],
      scenarios: allScenarios, amountKey: "communityFees",
      splitRatio: [{ phase: "construction", ratio: 0.75 }],
    },
    // دفعات المقاول (70% من الضمان) — الثلاث سيناريوهات
    {
      itemKey: "contractor_payments", nameAr: "دفعات المقاول (70% — من الضمان)", category: "construction", section: "escrow", sortOrder: 54.5,
      fundingSource: "escrow", distributionMethod: "equal_spread",
      distributeAcrossPhases: ["construction"],
      scenarios: allScenarios,
      amountFraction: { of: "constructionCost", ratio: 0.70 },
    },
    // دفعات المقاول (20% من الضمان) — O2 + O3 فقط
    {
      itemKey: "contractor_payments_20", nameAr: "دفعات المقاول (20% — من الضمان)", category: "construction", section: "escrow", sortOrder: 55,
      fundingSource: "escrow", distributionMethod: "equal_spread",
      distributeAcrossPhases: ["construction"],
      scenarios: ["offplan_construction", "no_offplan"],
      amountFraction: { of: "constructionCost", ratio: 0.20 },
    },
    // ═══ الإشراف والمساح (من الإسكرو) ═══
    // أتعاب المطور — الإشراف: O1/O2 = 3% | O3 = 2% (من حساب الضمان)
    {
      itemKey: "developer_fee_construction", nameAr: `أتعاب المطور — الإشراف (${isOffplan ? "3" : "2"}%)`, category: "developer_fee", section: "escrow", sortOrder: 58,
      fundingSource: "investor", distributionMethod: "equal_spread",
      distributeAcrossPhases: ["construction"],
      scenarios: allScenarios, amountKey: "developerFee",
      splitRatio: [{ phase: "construction", ratio: isOffplan ? 0.6 : 0.4 }],  // O1/O2: 60% of 5% = 3% | O3: 40% of 5% = 2%
    },
    {
      itemKey: "supervision_fee", nameAr: "أتعاب الاستشاري — الإشراف", category: "construction", section: "escrow", sortOrder: 60,
      fundingSource: "escrow", distributionMethod: "equal_spread",
      distributeAcrossPhases: ["construction"],
      scenarios: allScenarios, amountKey: "supervisionFee",
    },
    {
      itemKey: "surveyor_fee", nameAr: "رسوم المساح", category: "construction", section: "escrow", sortOrder: 61,
      fundingSource: "escrow", distributionMethod: "equal_spread",
      distributeAcrossPhases: ["construction", "handover"],
      scenarios: allScenarios, amountKey: "surveyorFees",
    },
    {
      itemKey: "rera_audit", nameAr: "تقرير مدقق ريرا", category: "admin", section: "escrow", sortOrder: 62,
      fundingSource: "escrow", distributionMethod: "equal_spread",
      distributeAcrossPhases: ["construction"],
      scenarios: offplanScenarios, amountKey: "reraAuditReportFee",
    },
    {
      itemKey: "rera_inspection", nameAr: "تقرير فحص ريرا", category: "admin", section: "escrow", sortOrder: 63,
      fundingSource: "escrow", distributionMethod: "equal_spread",
      distributeAcrossPhases: ["construction"],
      scenarios: offplanScenarios, amountKey: "reraInspectionReportFee",
    },
    // التسويق — 75% من حساب الضمان في مرحلة الإنشاء
    {
      itemKey: "marketing_construction", nameAr: "التسويق والإعلان — الإنشاء (75%)", category: "marketing_sales", section: "escrow", sortOrder: 64,
      fundingSource: "investor", distributionMethod: "equal_spread",
      distributeAcrossPhases: ["construction"],
      scenarios: offplanScenarios, amountKey: "marketingCost",
      splitRatio: [{ phase: "construction", ratio: 0.75 }],
    },
    // عمولة وكيل المبيعات — من حساب الضمان
    {
      itemKey: "sales_commission", nameAr: "عمولة وكيل المبيعات (5%)", category: "marketing_sales", section: "escrow", sortOrder: 65,
      fundingSource: "escrow", distributionMethod: "equal_spread",
      distributeAcrossPhases: ["construction"],
      scenarios: offplanScenarios, amountKey: "salesCommission",
    },

    // الإيرادات أُزيلت — لا علاقة لها بصفحة التكاليف
  ].filter(item => item.scenarios.includes(scenario));
}

// ─── Helper: compute amount for an item ──────────────────────────────────────

function computeItemAmount(
  def: DefaultItemDef,
  costs: NonNullable<ReturnType<typeof calculateProjectCosts>>,
): number {
  if (def.amountKey) {
    const val = costs[def.amountKey];
    const base = typeof val === "number" ? val : 0;
    // If splitRatio is defined, apply the total ratio for this item
    if (def.splitRatio && def.splitRatio.length > 0) {
      const totalRatio = def.splitRatio.reduce((s, r) => s + r.ratio, 0);
      return base * totalRatio;
    }
    return base;
  }
  if (def.amountFraction) {
    if (def.amountFraction.of === "constructionCost") {
      // Special case for revenue items
      if (def.itemKey === "revenue_booking") return costs.totalRevenue * 0.20;
      if (def.itemKey === "revenue_construction") return costs.totalRevenue * 0.30;
      if (def.itemKey === "revenue_handover") return costs.totalRevenue * 0.50;
      return costs.constructionCost * def.amountFraction.ratio;
    }
  }
  return 0;
}

// ─── Helper: convert phase-relative months to absolute months ────────────────

function phaseRelativeToAbsolute(
  phase: "land" | "design" | "offplan" | "construction" | "handover",
  relativeMonth: number,
  phases: ReturnType<typeof calculatePhases>,
): number {
  if (phase === "land") return 0;
  const p = phases.find(ph => ph.type === phase);
  if (!p || p.duration === 0) return 1;
  return p.startMonth + relativeMonth - 1;
}

// ─── Helper: get absolute month range for a phase ────────────────────────────

function getPhaseRange(
  phase: "land" | "design" | "offplan" | "construction" | "handover",
  phases: ReturnType<typeof calculatePhases>,
): { start: number; end: number } {
  if (phase === "land") return { start: 0, end: 0 };
  const p = phases.find(ph => ph.type === phase);
  if (!p || p.duration === 0) return { start: 1, end: 1 };
  return { start: p.startMonth, end: p.startMonth + p.duration - 1 };
}

// ─── Helper: generate month labels ───────────────────────────────────────────

function generateMonthLabels(startDate: string, totalMonths: number): string[] {
  const [yearStr, monthStr] = startDate.split("-");
  const startYear = parseInt(yearStr) || 2026;
  const startMonth = parseInt(monthStr) || 1;
  const monthNamesAr = [
    "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
    "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
  ];
  const labels: string[] = [];
  for (let m = 0; m < totalMonths; m++) {
    const monthIdx = (startMonth - 1 + m) % 12;
    const year = startYear + Math.floor((startMonth - 1 + m) / 12);
    labels.push(`${monthNamesAr[monthIdx]} ${year}`);
  }
  return labels;
}

// ─── Zod schemas ─────────────────────────────────────────────────────────────

const settingItemSchema = z.object({
  id: z.number().optional(),
  itemKey: z.string(),
  nameAr: z.string(),
  category: z.enum(CATEGORIES),
  section: z.enum(["paid", "design", "offplan", "construction", "escrow"]).optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().default(0),
  amountOverride: z.number().nullable().optional(),
  distributionMethod: z.enum(DISTRIBUTION_METHODS),
  lumpSumMonth: z.number().nullable().optional(),
  startMonth: z.number().nullable().optional(),
  endMonth: z.number().nullable().optional(),
  customJson: z.string().nullable().optional(),
  fundingSource: z.enum(FUNDING_SOURCES),
  notes: z.string().nullable().optional(),
});

// ─── Router ───────────────────────────────────────────────────────────────────

export const cashFlowSettingsRouter = router({
  /**
   * Get settings for a project + scenario.
   * If no settings exist, returns default settings computed from project data.
   */
  getSettings: publicProcedure
    .input(z.object({
      projectId: z.number(),
      scenario: z.enum(SCENARIOS),
    }))
    .query(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Get existing settings
      const existing = await db.select().from(projectCashFlowSettings).where(
        and(
          eq(projectCashFlowSettings.projectId, input.projectId),
          eq(projectCashFlowSettings.scenario, input.scenario),
        )
      );

      // Get project data to compute amounts
      const projectRows = await db.select().from(projects).where(eq(projects.id, input.projectId));
      const project = projectRows[0];
      if (!project) throw new Error("Project not found");

      const moRows = await db.select().from(marketOverview).where(eq(marketOverview.projectId, input.projectId));
      const mo = moRows[0] || null;

      const cpRows = await db.select().from(competitionPricing).where(eq(competitionPricing.projectId, input.projectId));
      const cp = cpRows[0] || null;

      const costs = calculateProjectCosts(project, mo, cp);

      // Build phase timeline
      const legacyDurations = {
        preCon: project.preConMonths || 6,
        construction: project.constructionMonths || 16,
        handover: project.handoverMonths || 2,
      };
      const durations = legacyToNewDurations(legacyDurations);
      const phases = calculatePhases(durations);
      const totalMonths = getTotalMonths(durations);

      if (existing.length > 0) {
        // Build a lookup of default defs by itemKey
        const defaultDefs = getDefaultItemDefs(input.scenario);
        const defaultSectionByKey: Record<string, string> = {};
        const defaultDefByKey: Record<string, typeof defaultDefs[0]> = {};
        for (const def of defaultDefs) {
          defaultSectionByKey[def.itemKey] = def.section;
          defaultDefByKey[def.itemKey] = def;
        }
        // Find default items not yet saved in DB (new items added to defaults after initial save)
        const existingKeys = new Set(existing.map(s => s.itemKey));
        const missingDefaults = defaultDefs
          .filter(def => !existingKeys.has(def.itemKey) && def.category !== "revenue")
          .map(def => {
            const amount = costs ? computeItemAmount(def, costs) : 0;
            let defaultStartMonth: number | null = null;
            let defaultEndMonth: number | null = null;
            let defaultLumpSumMonth: number | null = null;
            if (def.distributionMethod === "lump_sum") {
              if (def.phase) defaultLumpSumMonth = phaseRelativeToAbsolute(def.phase, def.phaseRelativeMonth || 1, phases);
            } else if (def.distributionMethod === "equal_spread") {
              if (def.distributeAcrossPhases && def.distributeAcrossPhases.length > 0) {
                const firstRange = getPhaseRange(def.distributeAcrossPhases[0], phases);
                const lastRange = getPhaseRange(def.distributeAcrossPhases[def.distributeAcrossPhases.length - 1], phases);
                defaultStartMonth = firstRange.start;
                defaultEndMonth = lastRange.end;
              } else if (def.phase) {
                const range = getPhaseRange(def.phase, phases);
                defaultStartMonth = range.start;
                defaultEndMonth = range.end;
              }
            }
            return {
              id: undefined as number | undefined,
              projectId: input.projectId,
              scenario: input.scenario,
              itemKey: def.itemKey,
              nameAr: def.nameAr,
              category: def.category,
              section: def.section,
              isActive: true,
              sortOrder: def.sortOrder,
              amountOverride: null,
              distributionMethod: def.distributionMethod,
              lumpSumMonth: defaultLumpSumMonth,
              startMonth: defaultStartMonth,
              endMonth: defaultEndMonth,
              customJson: null,
              fundingSource: def.fundingSource,
              notes: null,
              computedAmount: amount,
            };
          });
        // Build a lookup of default fundingSource by itemKey to auto-correct stale DB values
        const defaultFundingSourceByKey: Record<string, string> = {};
        const defaultSortOrderByKey: Record<string, number> = {};
        const defaultNameArByKey: Record<string, string> = {};
        for (const def of defaultDefs) {
          defaultFundingSourceByKey[def.itemKey] = def.fundingSource;
          defaultSortOrderByKey[def.itemKey] = def.sortOrder;
          defaultNameArByKey[def.itemKey] = def.nameAr;
        }
        // Return existing settings merged with missing defaults, filtered to remove revenue items
        const mergedSettings = [
          ...existing
            .filter(s => s.category !== "revenue")
            .map(s => ({
              ...s,
              nameAr: defaultNameArByKey[s.itemKey] ?? s.nameAr,
              section: s.section || defaultSectionByKey[s.itemKey] || "construction",
              // Use DB fundingSource (respects user changes from UI).
              // Fall back to default only if DB has no value.
              fundingSource: (s.fundingSource ?? defaultFundingSourceByKey[s.itemKey]) as "investor" | "escrow",
              sortOrder: defaultSortOrderByKey[s.itemKey] ?? s.sortOrder,
              computedAmount: costs ? computeItemAmountByKey(s.itemKey, costs, input.scenario) : 0,
            })),
          ...missingDefaults,
        ].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
        return {
          settings: mergedSettings,
          totalMonths,
          phases: {
            design: { start: phases.find(p => p.type === "design")?.startMonth || 1, duration: durations.design },
            offplan: { start: phases.find(p => p.type === "offplan")?.startMonth || 3, duration: durations.offplan },
            construction: { start: phases.find(p => p.type === "construction")?.startMonth || 7, duration: durations.construction },
            handover: { start: phases.find(p => p.type === "handover")?.startMonth || 23, duration: durations.handover },
          },
          startDate: project.startDate || "2026-01",
          projectName: project.name,
          scenario: input.scenario,
          hasSavedSettings: true,
        };
      }

      // Generate default settings
      const defs = getDefaultItemDefs(input.scenario);
      const defaultSettings = defs.map(def => {
        const amount = costs ? computeItemAmount(def, costs) : 0;

        // Compute default start/end months based on phase
        let defaultStartMonth: number | null = null;
        let defaultEndMonth: number | null = null;
        let defaultLumpSumMonth: number | null = null;

        if (def.distributionMethod === "lump_sum") {
          if (def.phase) {
            defaultLumpSumMonth = phaseRelativeToAbsolute(def.phase, def.phaseRelativeMonth || 1, phases);
          }
        } else if (def.distributionMethod === "equal_spread") {
          if (def.distributeAcrossPhases && def.distributeAcrossPhases.length > 0) {
            const firstPhase = def.distributeAcrossPhases[0];
            const lastPhase = def.distributeAcrossPhases[def.distributeAcrossPhases.length - 1];
            const firstRange = getPhaseRange(firstPhase, phases);
            const lastRange = getPhaseRange(lastPhase, phases);
            defaultStartMonth = firstRange.start;
            defaultEndMonth = lastRange.end;
          } else if (def.phase) {
            const range = getPhaseRange(def.phase, phases);
            defaultStartMonth = range.start;
            defaultEndMonth = range.end;
          }
        }

        return {
          id: undefined as number | undefined,
          projectId: input.projectId,
          scenario: input.scenario,
          itemKey: def.itemKey,
          nameAr: def.nameAr,
          category: def.category,
          section: def.section,
          isActive: true,
          sortOrder: def.sortOrder,
          amountOverride: null,
          distributionMethod: def.distributionMethod,
          lumpSumMonth: defaultLumpSumMonth,
          startMonth: defaultStartMonth,
          endMonth: defaultEndMonth,
          customJson: null,
          fundingSource: def.fundingSource,
          notes: null,
          computedAmount: amount,
        };
      });

      return {
        settings: defaultSettings,
        totalMonths,
        phases: {
          design: { start: phases.find(p => p.type === "design")?.startMonth || 1, duration: durations.design },
          offplan: { start: phases.find(p => p.type === "offplan")?.startMonth || 3, duration: durations.offplan },
          construction: { start: phases.find(p => p.type === "construction")?.startMonth || 7, duration: durations.construction },
          handover: { start: phases.find(p => p.type === "handover")?.startMonth || 23, duration: durations.handover },
        },
        startDate: project.startDate || "2026-01",
        projectName: project.name,
        scenario: input.scenario,
        hasSavedSettings: false,
      };
    }),

  /**
   * Save settings for a project + scenario (upsert all items).
   */
  saveSettings: publicProcedure
    .input(z.object({
      projectId: z.number(),
      scenario: z.enum(SCENARIOS),
      items: z.array(settingItemSchema),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Delete existing settings for this project + scenario
      await db.delete(projectCashFlowSettings).where(
        and(
          eq(projectCashFlowSettings.projectId, input.projectId),
          eq(projectCashFlowSettings.scenario, input.scenario),
        )
      );

      // Insert new settings
      if (input.items.length > 0) {
        await db.insert(projectCashFlowSettings).values(
          input.items.map(item => ({
            projectId: input.projectId,
            scenario: input.scenario,
            itemKey: item.itemKey,
            nameAr: item.nameAr,
            category: item.category,
            section: item.section || null,
            isActive: item.isActive ? 1 : 0,
            sortOrder: item.sortOrder,
            amountOverride: item.amountOverride?.toString() || null,
            distributionMethod: item.distributionMethod,
            lumpSumMonth: item.lumpSumMonth || null,
            startMonth: item.startMonth || null,
            endMonth: item.endMonth || null,
            customJson: item.customJson || null,
            fundingSource: item.fundingSource,
            notes: item.notes || null,
          }))
        );
      }

      return { success: true };
    }),

  /**
   * Get the reflection table data: monthly cash flow distribution for all items.
   * Returns a matrix of [itemKey][month] = amount
   */
  getReflectionData: publicProcedure
    .input(z.object({
      projectId: z.number(),
      scenario: z.enum(SCENARIOS),
    }))
    .query(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Get project data
      const projectRows = await db.select().from(projects).where(eq(projects.id, input.projectId));
      const project = projectRows[0];
      if (!project) throw new Error("Project not found");

      const moRows = await db.select().from(marketOverview).where(eq(marketOverview.projectId, input.projectId));
      const mo = moRows[0] || null;

      const cpRows = await db.select().from(competitionPricing).where(eq(competitionPricing.projectId, input.projectId));
      const cp = cpRows[0] || null;

      const costs = calculateProjectCosts(project, mo, cp);

      // Build phase timeline
      const legacyDurations = {
        preCon: project.preConMonths || 6,
        construction: project.constructionMonths || 16,
        handover: project.handoverMonths || 2,
      };
      const durations = legacyToNewDurations(legacyDurations);
      const phases = calculatePhases(durations);
      const totalMonths = getTotalMonths(durations);
      const monthLabels = generateMonthLabels(project.startDate || "2026-01", totalMonths);

      // Get saved settings or use defaults
      const savedSettings = await db.select().from(projectCashFlowSettings).where(
        and(
          eq(projectCashFlowSettings.projectId, input.projectId),
          eq(projectCashFlowSettings.scenario, input.scenario),
        )
      );

      // Build items list
      interface ReflectionItem {
        itemKey: string;
        nameAr: string;
        category: Category;
        section: "paid" | "design" | "offplan" | "construction" | "escrow";
        isActive: boolean;
        sortOrder: number;
        fundingSource: FundingSource;
        distributionMethod: DistributionMethod;
        lumpSumMonth: number | null;
        startMonth: number | null;
        endMonth: number | null;
        customJson: string | null;
        totalAmount: number;
        monthlyAmounts: number[]; // index 0 = month 1
      }

      const items: ReflectionItem[] = [];

      if (savedSettings.length > 0) {
        // Use saved settings
        for (const s of savedSettings) {
          if (!s.isActive) continue;
          const amount = s.amountOverride
            ? parseFloat(s.amountOverride)
            : (costs ? computeItemAmountByKey(s.itemKey, costs, input.scenario) : 0);

          const monthly = distributeAmount(
            amount,
            s.distributionMethod as DistributionMethod,
            s.lumpSumMonth,
            s.startMonth,
            s.endMonth,
            s.customJson,
            totalMonths,
          );

          // Determine section: use saved section if available, fallback to def
          const defForKey = getDefaultItemDefs(input.scenario).find(d => d.itemKey === s.itemKey);
          const itemSection = (s.section || defForKey?.section || "construction") as ReflectionItem["section"];

          items.push({
            itemKey: s.itemKey,
            nameAr: defForKey?.nameAr ?? s.nameAr,
            category: s.category as Category,
            section: itemSection,
            isActive: !!s.isActive,
            sortOrder: defForKey?.sortOrder ?? s.sortOrder,
            fundingSource: s.fundingSource as FundingSource,
            distributionMethod: s.distributionMethod as DistributionMethod,
            lumpSumMonth: s.lumpSumMonth,
            startMonth: s.startMonth,
            endMonth: s.endMonth,
            customJson: s.customJson,
            totalAmount: amount,
            monthlyAmounts: monthly,
          });
        }
      } else {
        // Use defaults
        const defs = getDefaultItemDefs(input.scenario);
        for (const def of defs) {
          const amount = costs ? computeItemAmount(def, costs) : 0;

          let lumpSumMonth: number | null = null;
          let startMonth: number | null = null;
          let endMonth: number | null = null;

          if (def.distributionMethod === "lump_sum" && def.phase) {
            lumpSumMonth = phaseRelativeToAbsolute(def.phase, def.phaseRelativeMonth || 1, phases);
          } else if (def.distributionMethod === "equal_spread") {
            if (def.distributeAcrossPhases && def.distributeAcrossPhases.length > 0) {
              const firstPhase = def.distributeAcrossPhases[0];
              const lastPhase = def.distributeAcrossPhases[def.distributeAcrossPhases.length - 1];
              startMonth = getPhaseRange(firstPhase, phases).start;
              endMonth = getPhaseRange(lastPhase, phases).end;
            } else if (def.phase) {
              const range = getPhaseRange(def.phase, phases);
              startMonth = range.start;
              endMonth = range.end;
            }
          }

          const monthly = distributeAmount(
            amount,
            def.distributionMethod,
            lumpSumMonth,
            startMonth,
            endMonth,
            null,
            totalMonths,
          );

          items.push({
            itemKey: def.itemKey,
            nameAr: def.nameAr,
            category: def.category,
            section: (def.section || "construction") as ReflectionItem["section"],
            isActive: true,
            sortOrder: def.sortOrder,
            fundingSource: def.fundingSource,
            distributionMethod: def.distributionMethod,
            lumpSumMonth,
            startMonth,
            endMonth,
            customJson: null,
            totalAmount: amount,
            monthlyAmounts: monthly,
          });
        }
      }

      // Sort items
      items.sort((a, b) => a.sortOrder - b.sortOrder);

      // Compute monthly totals
      const investorMonthlyTotals = new Array(totalMonths).fill(0);
      const escrowMonthlyTotals = new Array(totalMonths).fill(0);
      const grandMonthlyTotals = new Array(totalMonths).fill(0);

      for (const item of items) {
        // O3 (no_offplan) = no sales, no escrow — ALL costs are investor-funded
        const effectiveSource = input.scenario === "no_offplan" ? "investor" : item.fundingSource;
        for (let m = 0; m < totalMonths; m++) {
          const val = item.monthlyAmounts[m] || 0;
          grandMonthlyTotals[m] += val;
          if (effectiveSource === "investor") {
            investorMonthlyTotals[m] += val;
          } else {
            escrowMonthlyTotals[m] += val;
          }
        }
      }

      // Phase info for display
      const phaseInfo = {
        design: {
          start: phases.find(p => p.type === "design")?.startMonth || 1,
          end: (phases.find(p => p.type === "design")?.startMonth || 1) + durations.design - 1,
          duration: durations.design,
        },
        offplan: {
          start: phases.find(p => p.type === "offplan")?.startMonth || 3,
          end: (phases.find(p => p.type === "offplan")?.startMonth || 3) + durations.offplan - 1,
          duration: durations.offplan,
        },
        construction: {
          start: phases.find(p => p.type === "construction")?.startMonth || 7,
          end: (phases.find(p => p.type === "construction")?.startMonth || 7) + durations.construction - 1,
          duration: durations.construction,
        },
        handover: {
          start: phases.find(p => p.type === "handover")?.startMonth || 23,
          end: (phases.find(p => p.type === "handover")?.startMonth || 23) + durations.handover - 1,
          duration: durations.handover,
        },
      };

      return {
        items,
        totalMonths,
        monthLabels,
        investorMonthlyTotals,
        escrowMonthlyTotals,
        grandMonthlyTotals,
        phaseInfo,
        projectName: project.name,
        startDate: project.startDate || "2026-01",
        scenario: input.scenario,
        totalCosts: costs?.totalCosts || 0,
        totalRevenue: costs?.totalRevenue || 0,
        revenueSource: costs?.revenueSource || "calculated",
        activeScenario: costs?.activeScenario || "base",
        scenarioLabel: costs?.scenarioLabel || "أساسي",
        calculatedRevenue: costs?.calculatedRevenue || 0,
        approvedRevenue: costs?.approvedRevenue || 0,
      };
    }),

  /**
   * Save phase durations for a project (design, construction, handover months).
   * These replace the legacy preConMonths / constructionMonths / handoverMonths on the project.
   */
  saveDurations: publicProcedure
    .input(z.object({
      projectId: z.number(),
      designMonths: z.number().min(1).max(36),
      constructionMonths: z.number().min(1).max(60),
      handoverMonths: z.number().min(0).max(24),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // 1. Get old durations before update
      const oldProjectRows = await db.select().from(projects).where(eq(projects.id, input.projectId));
      const oldProject = oldProjectRows[0];
      if (!oldProject) throw new Error("Project not found");
      const oldDesign = oldProject.preConMonths || 6;
      const oldConstruction = oldProject.constructionMonths || 16;
      const oldHandover = oldProject.handoverMonths || 2;

      // 2. Update durations in projects table
      await db.update(projects)
        .set({
          preConMonths: input.designMonths,
          constructionMonths: input.constructionMonths,
          handoverMonths: input.handoverMonths,
        })
        .where(eq(projects.id, input.projectId));

      // 3. Calculate old and new phase boundaries
      const oldDurations = legacyToNewDurations({ preCon: oldDesign, construction: oldConstruction, handover: oldHandover });
      const newDurations = legacyToNewDurations({ preCon: input.designMonths, construction: input.constructionMonths, handover: input.handoverMonths });
      const oldPhases = calculatePhases(oldDurations);
      const newPhases = calculatePhases(newDurations);

      // 4. Recalculate startMonth/endMonth for all saved items across all scenarios
      for (const scenario of SCENARIOS) {
        const savedItems = await db.select().from(projectCashFlowSettings).where(
          and(
            eq(projectCashFlowSettings.projectId, input.projectId),
            eq(projectCashFlowSettings.scenario, scenario),
          )
        );
        if (savedItems.length === 0) continue;

        for (const item of savedItems) {
          const updates: Record<string, any> = {};
          // Determine which phase this item belongs to based on section
          const itemSection = item.section || "construction";
          let itemPhase: "design" | "offplan" | "construction" | "handover" | null = null;
          if (itemSection === "design") itemPhase = "design";
          else if (itemSection === "offplan") itemPhase = "offplan";
          else if (itemSection === "construction" || itemSection === "escrow") itemPhase = "construction";
          // Skip paid/land items (they don't have phase-based distribution)
          if (!itemPhase || itemSection === "paid") continue;

          const newRange = getPhaseRange(itemPhase, newPhases);
          const oldRange = getPhaseRange(itemPhase, oldPhases);

          if (item.distributionMethod === "equal_spread") {
            // Always snap equal_spread items to the full new phase range
            // This is the safest approach: if the phase duration changes,
            // equal_spread items should always cover the entire phase
            if (item.startMonth !== null && item.endMonth !== null) {
              updates.startMonth = newRange.start;
              updates.endMonth = newRange.end;
            }
          } else if (item.distributionMethod === "lump_sum" && item.lumpSumMonth !== null) {
            if (item.lumpSumMonth >= oldRange.start && item.lumpSumMonth <= oldRange.end) {
              const oldPhaseDuration = oldRange.end - oldRange.start + 1;
              const newPhaseDuration = newRange.end - newRange.start + 1;
              const relativePos = oldPhaseDuration > 1 ? (item.lumpSumMonth - oldRange.start) / (oldPhaseDuration - 1) : 0;
              updates.lumpSumMonth = Math.round(newRange.start + relativePos * Math.max(0, newPhaseDuration - 1));
              updates.lumpSumMonth = Math.max(newRange.start, Math.min(newRange.end, updates.lumpSumMonth));
            }
          } else if (item.distributionMethod === "custom" && item.customJson) {
            try {
              const entries: Array<{ month: number; amount?: number; pct?: number }> = JSON.parse(item.customJson);
              const newPhaseDuration = newRange.end - newRange.start + 1;
              if (newPhaseDuration > 0) {
                const totalPct = entries.reduce((sum, e) => sum + (e.pct || 0), 0);
                if (totalPct > 0) {
                  const pctPerMonth = totalPct / newPhaseDuration;
                  const newEntries = [];
                  for (let m = 0; m < newPhaseDuration; m++) {
                    newEntries.push({ month: newRange.start + m, pct: Math.round(pctPerMonth * 100) / 100 });
                  }
                  updates.customJson = JSON.stringify(newEntries);
                } else {
                  const totalAmount = entries.reduce((sum, e) => sum + (e.amount || 0), 0);
                  const amtPerMonth = totalAmount / newPhaseDuration;
                  const newEntries = [];
                  for (let m = 0; m < newPhaseDuration; m++) {
                    newEntries.push({ month: newRange.start + m, amount: Math.round(amtPerMonth) });
                  }
                  updates.customJson = JSON.stringify(newEntries);
                }
              }
            } catch {
              // Invalid JSON, skip
            }
          }

          if (Object.keys(updates).length > 0) {
            await db.update(projectCashFlowSettings)
              .set(updates)
              .where(eq(projectCashFlowSettings.id, item.id));
          }
        }
      }

      return { success: true };
    }),

  /**
   * Get comparison data for all three scenarios side by side.
   * Returns monthly investor totals, escrow totals, and grand totals for each scenario.
   */
  getComparisonData: publicProcedure
    .input(z.object({
      projectId: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const projectRows = await db.select().from(projects).where(eq(projects.id, input.projectId));
      const project = projectRows[0];
      if (!project) throw new Error("Project not found");

      const moRows = await db.select().from(marketOverview).where(eq(marketOverview.projectId, input.projectId));
      const mo = moRows[0] || null;
      const cpRows = await db.select().from(competitionPricing).where(eq(competitionPricing.projectId, input.projectId));
      const cp = cpRows[0] || null;
      const costs = calculateProjectCosts(project, mo, cp);

      const legacyDurations = {
        preCon: project.preConMonths || 6,
        construction: project.constructionMonths || 16,
        handover: project.handoverMonths || 2,
      };
      const durations = legacyToNewDurations(legacyDurations);
      const phases = calculatePhases(durations);
      const totalMonths = getTotalMonths(durations);
      const monthLabels = generateMonthLabels(project.startDate || "2026-01", totalMonths);

      // Helper: build monthly totals for one scenario
      async function buildScenarioTotals(scenario: Scenario) {
        const savedSettings = await db!.select().from(projectCashFlowSettings).where(
          and(
            eq(projectCashFlowSettings.projectId, input.projectId),
            eq(projectCashFlowSettings.scenario, scenario),
          )
        );

        const investorMonthly = new Array(totalMonths).fill(0);
        const escrowMonthly = new Array(totalMonths).fill(0);
        const grandMonthly = new Array(totalMonths).fill(0);
        let totalCosts = 0;
        let totalRevenue = 0;

        const processItem = (amount: number, fundingSource: string, distMethod: string, lumpSumMonth: number | null, startMonth: number | null, endMonth: number | null, customJson: string | null) => {
          const monthly = distributeAmount(amount, distMethod as DistributionMethod, lumpSumMonth, startMonth, endMonth, customJson, totalMonths);
          // O3 (no_offplan) = no sales, no escrow — ALL costs are investor-funded
          const effectiveSource = scenario === "no_offplan" ? "investor" : fundingSource;
          for (let m = 0; m < totalMonths; m++) {
            const val = monthly[m] || 0;
            grandMonthly[m] += val;
            if (effectiveSource === "investor") investorMonthly[m] += val;
            else escrowMonthly[m] += val;
          }
          return amount;
        };

        if (savedSettings.length > 0) {
          for (const s of savedSettings) {
            if (!s.isActive) continue;
            const amount = s.amountOverride
              ? parseFloat(s.amountOverride)
              : (costs ? computeItemAmountByKey(s.itemKey, costs, scenario) : 0);
            const cat = s.category as Category;
            if (cat === "revenue") totalRevenue += amount;
            else totalCosts += amount;
            processItem(amount, s.fundingSource, s.distributionMethod, s.lumpSumMonth, s.startMonth, s.endMonth, s.customJson);
          }
        } else {
          const defs = getDefaultItemDefs(scenario);
          for (const def of defs) {
            const amount = costs ? computeItemAmount(def, costs) : 0;
            if (def.category === "revenue") totalRevenue += amount;
            else totalCosts += amount;
            let lumpSumMonth: number | null = null;
            let startMonth: number | null = null;
            let endMonth: number | null = null;
            if (def.distributionMethod === "lump_sum" && def.phase) {
              lumpSumMonth = phaseRelativeToAbsolute(def.phase, def.phaseRelativeMonth || 1, phases);
            } else if (def.distributionMethod === "equal_spread") {
              if (def.distributeAcrossPhases && def.distributeAcrossPhases.length > 0) {
                startMonth = getPhaseRange(def.distributeAcrossPhases[0], phases).start;
                endMonth = getPhaseRange(def.distributeAcrossPhases[def.distributeAcrossPhases.length - 1], phases).end;
              } else if (def.phase) {
                const range = getPhaseRange(def.phase, phases);
                startMonth = range.start;
                endMonth = range.end;
              }
            }
            processItem(amount, def.fundingSource, def.distributionMethod, lumpSumMonth, startMonth, endMonth, null);
          }
        }

        return { investorMonthly, escrowMonthly, grandMonthly, totalCosts, totalRevenue };
      }

      const [s1, s2, s3] = await Promise.all([
        buildScenarioTotals("offplan_escrow"),
        buildScenarioTotals("offplan_construction"),
        buildScenarioTotals("no_offplan"),
      ]);

      // Phase info
      const phaseInfo = {
        design: { start: phases.find(p => p.type === "design")?.startMonth || 1, end: (phases.find(p => p.type === "design")?.startMonth || 1) + durations.design - 1, duration: durations.design },
        offplan: { start: phases.find(p => p.type === "offplan")?.startMonth || 3, end: (phases.find(p => p.type === "offplan")?.startMonth || 3) + durations.offplan - 1, duration: durations.offplan },
        construction: { start: phases.find(p => p.type === "construction")?.startMonth || 7, end: (phases.find(p => p.type === "construction")?.startMonth || 7) + durations.construction - 1, duration: durations.construction },
        handover: { start: phases.find(p => p.type === "handover")?.startMonth || 23, end: (phases.find(p => p.type === "handover")?.startMonth || 23) + durations.handover - 1, duration: durations.handover },
      };

      return {
        projectName: project.name,
        totalMonths,
        monthLabels,
        phaseInfo,
        scenarios: {
          offplan_escrow: { ...s1, label: "أوف بلان مع إيداع الضمان", labelShort: "أوف بلان (ضمان)" },
          offplan_construction: { ...s2, label: "أوف بلان بعد 20% إنجاز", labelShort: "أوف بلان (إنجاز)" },
          no_offplan: { ...s3, label: "بدون أوف بلان", labelShort: "بدون أوف بلان" },
        },
      };
    }),

  /**
   * Reset settings for a project + scenario (delete saved, revert to defaults).
   */
  resetSettings: publicProcedure
    .input(z.object({
      projectId: z.number(),
      scenario: z.enum(SCENARIOS),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db.delete(projectCashFlowSettings).where(
        and(
          eq(projectCashFlowSettings.projectId, input.projectId),
          eq(projectCashFlowSettings.scenario, input.scenario),
        )
      );

      return { success: true };
    }),

  /**
   * getPortfolioCapitalData — builds the capital portfolio view for ALL projects.
   * This is the single source of truth for CapitalSchedulingPage.
   * It reuses the same reflection logic (settings + defaults) so that any change
   * made in the settings page is immediately reflected in the portfolio.
   *
   * For each project it returns the shape expected by CapitalSchedulingPage:
   *   - monthlyAmounts[]  (investor-only totals per project-relative month)
   *   - phaseMonthlyAmounts  { land|design|offplan|construction|handover → { monthIdx → amount } }
   *   - phaseTotals  { phase → total }
   *   - itemBreakdown  { monthIdx → [{ name, amount }] }
   *   - grandTotal / paidTotal / upcomingTotal
   *   - phase durations & startDate
   */
  getPortfolioCapitalData: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.user) return [];
    const db = await getDb();
    if (!db) return [];

    // Fetch all user projects
    const allProjects = await db.select().from(projects)
      .where(eq(projects.userId, ctx.user.id));
    if (allProjects.length === 0) return [];

    const today = new Date();

    const results: Array<{
      cfProjectId: number | null;
      projectId: number;
      name: string;
      startDate: string;
      preDevMonths: number;
      designMonths: number;
      offplanMonths: number;
      constructionMonths: number;
      handoverMonths: number;
      monthlyAmounts: number[];
      phaseMonthlyAmounts: Record<string, Record<string, number>>;
      phaseTotals: Record<string, number>;
      grandTotal: number;
      paidTotal: number;
      upcomingTotal: number;
      itemBreakdown: Record<string, { name: string; amount: number }[]>;
      financingScenario: string;
    }> = [];

    for (const project of allProjects) {
      const scenario = (project.financingScenario || "offplan_escrow") as Scenario;

      // Fetch supporting data
      const moRows = await db.select().from(marketOverview)
        .where(eq(marketOverview.projectId, project.id));
      const cpRows = await db.select().from(competitionPricing)
        .where(eq(competitionPricing.projectId, project.id));
      const mo = moRows[0] || null;
      const cp = cpRows[0] || null;

      const costs = calculateProjectCosts(project, mo, cp);
      if (!costs) continue;

      // Build phase timeline (same logic as getReflectionData)
      const legacyDurations = {
        preCon: project.preConMonths || 6,
        construction: project.constructionMonths || 16,
        handover: project.handoverMonths || 2,
      };
      const durations = legacyToNewDurations(legacyDurations);
      const phases = calculatePhases(durations);
      const totalMonths = getTotalMonths(durations);

      // Get saved settings or use defaults
      const savedSettings = await db.select().from(projectCashFlowSettings).where(
        and(
          eq(projectCashFlowSettings.projectId, project.id),
          eq(projectCashFlowSettings.scenario, scenario),
        )
      );

      // Build items (same logic as getReflectionData)
      interface PortfolioItem {
        itemKey: string;
        nameAr: string;
        section: "paid" | "design" | "offplan" | "construction" | "escrow";
        fundingSource: FundingSource;
        totalAmount: number;
        monthlyAmounts: number[];
      }

      const items: PortfolioItem[] = [];

      // Helper: map section to phase type for range lookup
      const sectionToPhaseType = (section: string): "land" | "design" | "offplan" | "construction" | "handover" => {
        switch (section) {
          case "paid": return "land";
          case "design": return "design";
          case "offplan": return "offplan";
          case "construction": return "construction";
          case "escrow": return "construction";
          default: return "construction";
        }
      };

      if (savedSettings.length > 0) {
        for (const s of savedSettings) {
          if (!s.isActive) continue;
          const amount = s.amountOverride
            ? parseFloat(s.amountOverride)
            : computeItemAmountByKey(s.itemKey, costs, scenario);

          const defForKey = getDefaultItemDefs(scenario).find(d => d.itemKey === s.itemKey);
          const itemSection = (s.section || defForKey?.section || "construction") as PortfolioItem["section"];

          // CRITICAL FIX: Remap start/end months to actual phase ranges.
          // The DB may have stale month values from an older phase calculation.
          // We recalculate based on the item's section → phase mapping.
          const phaseType = sectionToPhaseType(itemSection);
          const phaseRange = getPhaseRange(phaseType, phases);

          let effectiveStartMonth = s.startMonth;
          let effectiveEndMonth = s.endMonth;
          let effectiveLumpSumMonth = s.lumpSumMonth;

          if (phaseType !== "land") {
            // For non-land items, remap months relative to the actual phase
            if (s.distributionMethod === "lump_sum" && s.lumpSumMonth != null) {
              // Lump sum: place at the relative position within the phase
              // If saved lumpSumMonth was at the start of the old phase, put it at start of new phase
              const savedPhaseStart = s.startMonth || s.lumpSumMonth;
              const relativeOffset = s.lumpSumMonth - savedPhaseStart;
              effectiveLumpSumMonth = phaseRange.start + relativeOffset;
            } else if (s.distributionMethod === "equal_spread") {
              // Equal spread: use the full phase range
              effectiveStartMonth = phaseRange.start;
              effectiveEndMonth = phaseRange.end;
            } else if (s.distributionMethod === "custom" && s.customJson) {
              // Custom: remap the base start month to the phase start
              effectiveStartMonth = phaseRange.start;
              effectiveEndMonth = phaseRange.end;
            }
          }

          const monthly = distributeAmount(
            amount,
            s.distributionMethod as DistributionMethod,
            effectiveLumpSumMonth,
            effectiveStartMonth,
            effectiveEndMonth,
            s.customJson,
            totalMonths,
          );

          items.push({
            itemKey: s.itemKey,
            nameAr: defForKey?.nameAr ?? s.nameAr,
            section: itemSection,
            fundingSource: s.fundingSource as FundingSource,
            totalAmount: amount,
            monthlyAmounts: monthly,
          });
        }
      } else {
        const defs = getDefaultItemDefs(scenario);
        for (const def of defs) {
          const amount = computeItemAmount(def, costs);

          let lumpSumMonth: number | null = null;
          let startMonth: number | null = null;
          let endMonth: number | null = null;

          if (def.distributionMethod === "lump_sum" && def.phase) {
            lumpSumMonth = phaseRelativeToAbsolute(def.phase, def.phaseRelativeMonth || 1, phases);
          } else if (def.distributionMethod === "equal_spread") {
            if (def.distributeAcrossPhases && def.distributeAcrossPhases.length > 0) {
              const firstPhase = def.distributeAcrossPhases[0];
              const lastPhase = def.distributeAcrossPhases[def.distributeAcrossPhases.length - 1];
              startMonth = getPhaseRange(firstPhase, phases).start;
              endMonth = getPhaseRange(lastPhase, phases).end;
            } else if (def.phase) {
              const range = getPhaseRange(def.phase, phases);
              startMonth = range.start;
              endMonth = range.end;
            }
          }

          const monthly = distributeAmount(
            amount,
            def.distributionMethod,
            lumpSumMonth,
            startMonth,
            endMonth,
            null,
            totalMonths,
          );

          items.push({
            itemKey: def.itemKey,
            nameAr: def.nameAr,
            section: (def.section || "construction") as PortfolioItem["section"],
            fundingSource: def.fundingSource,
            totalAmount: amount,
            monthlyAmounts: monthly,
          });
        }
      }

      // ─── Map section → portfolio phase ───
      // paid → land, design → design, offplan → offplan,
      // construction → construction, escrow → construction (escrow items are construction-phase)
      const sectionToPhase = (section: string): string => {
        switch (section) {
          case "paid": return "land";
          case "design": return "design";
          case "offplan": return "offplan";
          case "construction": return "construction";
          case "escrow": return "construction"; // escrow items happen during construction
          default: return "construction";
        }
      };

      // Build phaseMonthlyAmounts: { phase → { monthIdx(1-based) → amount } }
      // and itemBreakdown: { monthIdx(1-based) → [{ name, amount }] }
      // Only investor items go into the capital schedule
      const phaseMonthlyAmounts: Record<string, Record<string, number>> = {
        land: {}, design: {}, offplan: {}, construction: {}, handover: {},
      };
      const phaseTotals: Record<string, number> = {
        land: 0, design: 0, offplan: 0, construction: 0, handover: 0,
      };
      const monthlyAmounts = new Array(totalMonths).fill(0);
      const itemBreakdown: Record<string, { name: string; amount: number }[]> = {};
      let grandTotal = 0;

      for (const item of items) {
        // Only investor-funded items count toward capital schedule
        // O3 (no_offplan) = no sales, no escrow — ALL costs are investor-funded
        if (scenario !== "no_offplan" && item.fundingSource !== "investor") continue;

        const phase = sectionToPhase(item.section);

        for (let m = 0; m < totalMonths; m++) {
          const val = item.monthlyAmounts[m] || 0;
          if (val <= 0) continue;

          const monthKey = String(m); // 0-based index as string key
          grandTotal += val;
          monthlyAmounts[m] += val;
          phaseTotals[phase] = (phaseTotals[phase] || 0) + val;

          if (!phaseMonthlyAmounts[phase]) phaseMonthlyAmounts[phase] = {};
          phaseMonthlyAmounts[phase][monthKey] = (phaseMonthlyAmounts[phase][monthKey] || 0) + val;

          // Item breakdown
          if (!itemBreakdown[monthKey]) itemBreakdown[monthKey] = [];
          const existing = itemBreakdown[monthKey].find(e => e.name === item.nameAr);
          if (existing) {
            existing.amount += val;
          } else {
            itemBreakdown[monthKey].push({ name: item.nameAr, amount: val });
          }
        }
      }

      // Calculate paid vs upcoming based on today's date
      const startDateStr = project.startDate || "2026-04";
      const [startYearStr, startMonthStr] = startDateStr.split("-");
      const startYear = parseInt(startYearStr) || 2026;
      const startMonthNum = parseInt(startMonthStr) || 4;

      let paidTotal = 0;
      let upcomingTotal = 0;
      for (let m = 0; m < totalMonths; m++) {
        const val = monthlyAmounts[m] || 0;
        if (val <= 0) continue;
        // Month m=0 is the start month
        const absYear = startYear + Math.floor((startMonthNum - 1 + m) / 12);
        const absMonth = ((startMonthNum - 1 + m) % 12) + 1;
        const monthDate = new Date(absYear, absMonth - 1, 28);
        if (monthDate < today) {
          paidTotal += val;
        } else {
          upcomingTotal += val;
        }
      }

      results.push({
        cfProjectId: null,
        projectId: project.id,
        name: project.name,
        startDate: startDateStr,
        preDevMonths: durations.design,
        designMonths: durations.design,
        offplanMonths: durations.offplan,
        constructionMonths: durations.construction,
        handoverMonths: durations.handover,
        monthlyAmounts,
        phaseMonthlyAmounts,
        phaseTotals,
        grandTotal,
        paidTotal,
        upcomingTotal,
        itemBreakdown,
        financingScenario: scenario,
      });
    }

    return results;
  }),
  /**
   * getCostSettingsComparison — builds the cost-settings comparison table
   * for all 3 scenarios using getReflectionData as the single source of truth.
   * Phase durations come from the project card (البطاقة التعريفية).
   * Distribution methods respect actual phase month counts.
   */
  getCostSettingsComparison: publicProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Get project data (durations come from البطاقة)
      const projectRows = await db.select().from(projects).where(eq(projects.id, input.projectId));
      const project = projectRows[0];
      if (!project) throw new Error("Project not found");

      const moRows = await db.select().from(marketOverview).where(eq(marketOverview.projectId, input.projectId));
      const mo = moRows[0] || null;
      const cpRows = await db.select().from(competitionPricing).where(eq(competitionPricing.projectId, input.projectId));
      const cp = cpRows[0] || null;
      const costs = calculateProjectCosts(project, mo, cp);

      // Phase durations from البطاقة
      const legacyDurations = {
        preCon: project.preConMonths || 6,
        construction: project.constructionMonths || 16,
        handover: project.handoverMonths || 2,
      };
      const durations = legacyToNewDurations(legacyDurations);
      const phases = calculatePhases(durations);
      const totalMonths = getTotalMonths(durations);

      // Phase info for display
      const phaseInfo = {
        design: { duration: durations.design, start: phases.find(p => p.type === "design")?.startMonth || 1 },
        offplan: { duration: durations.offplan, start: phases.find(p => p.type === "offplan")?.startMonth || 3 },
        construction: { duration: durations.construction, start: phases.find(p => p.type === "construction")?.startMonth || 7 },
        handover: { duration: durations.handover, start: phases.find(p => p.type === "handover")?.startMonth || 23 },
      };

      // Build items for each scenario using the same logic as getReflectionData
      const scenarioList: Scenario[] = ["offplan_escrow", "offplan_construction", "no_offplan"];

      interface ScenarioItemData {
        nameAr: string;
        amount: number;
        fundingSource: string;
        section: string;
        sortOrder: number;
        distributionMethod: string;
        lumpSumMonth: number | null;
        startMonth: number | null;
        endMonth: number | null;
        customJson: string | null;
        monthlyAmounts: number[];
      }

      const scenarioItems: Record<Scenario, Map<string, ScenarioItemData>> = {
        offplan_escrow: new Map(),
        offplan_construction: new Map(),
        no_offplan: new Map(),
      };

      const allItemKeys: string[] = [];

      for (const sc of scenarioList) {
        // Check for saved settings first
        const savedSettings = await db.select().from(projectCashFlowSettings).where(
          and(
            eq(projectCashFlowSettings.projectId, input.projectId),
            eq(projectCashFlowSettings.scenario, sc),
          )
        );

        if (savedSettings.length > 0) {
          // Use saved settings (same as getReflectionData)
          // Build a set of valid item keys for this scenario from default definitions
          const validKeysForScenario = new Set(getDefaultItemDefs(sc).map(d => d.itemKey));
          const savedKeys = new Set<string>();
          for (const s of savedSettings) {
            if (!s.isActive) continue;
            // Skip items that don't belong to this scenario per current definitions
            if (!validKeysForScenario.has(s.itemKey)) continue;
            savedKeys.add(s.itemKey);
            const amount = s.amountOverride
              ? parseFloat(s.amountOverride)
              : (costs ? computeItemAmountByKey(s.itemKey, costs, sc) : 0);

            const monthly = distributeAmount(
              amount,
              s.distributionMethod as DistributionMethod,
              s.lumpSumMonth,
              s.startMonth,
              s.endMonth,
              s.customJson,
              totalMonths,
            );

            const defForKey = getDefaultItemDefs(sc).find(d => d.itemKey === s.itemKey);
            const itemSection = (s.section || defForKey?.section || "construction") as string;

            scenarioItems[sc].set(s.itemKey, {
              nameAr: defForKey?.nameAr ?? s.nameAr,
              amount,
              fundingSource: s.fundingSource as string,
              section: itemSection,
              sortOrder: defForKey?.sortOrder ?? s.sortOrder,
              distributionMethod: s.distributionMethod,
              lumpSumMonth: s.lumpSumMonth,
              startMonth: s.startMonth,
              endMonth: s.endMonth,
              customJson: s.customJson,
              monthlyAmounts: monthly,
            });

            if (!allItemKeys.includes(s.itemKey)) {
              allItemKeys.push(s.itemKey);
            }
          }
          // Add missing default items that are not in DB yet (e.g. contractor_payments_20)
          const defs = getDefaultItemDefs(sc);
          for (const def of defs) {
            if (savedKeys.has(def.itemKey)) continue;
            const amount = costs ? computeItemAmount(def, costs) : 0;
            let lumpSumMonth: number | null = null;
            let startMonth: number | null = null;
            let endMonth: number | null = null;
            if (def.distributionMethod === "lump_sum" && def.phase) {
              lumpSumMonth = phaseRelativeToAbsolute(def.phase, def.phaseRelativeMonth || 1, phases);
            } else if (def.distributionMethod === "equal_spread") {
              if (def.distributeAcrossPhases && def.distributeAcrossPhases.length > 0) {
                startMonth = getPhaseRange(def.distributeAcrossPhases[0], phases).start;
                endMonth = getPhaseRange(def.distributeAcrossPhases[def.distributeAcrossPhases.length - 1], phases).end;
              } else if (def.phase) {
                const range = getPhaseRange(def.phase, phases);
                startMonth = range.start;
                endMonth = range.end;
              }
            }
            const monthly = distributeAmount(amount, def.distributionMethod, lumpSumMonth, startMonth, endMonth, null, totalMonths);
            scenarioItems[sc].set(def.itemKey, {
              nameAr: def.nameAr,
              amount,
              fundingSource: def.fundingSource,
              section: def.section,
              sortOrder: def.sortOrder,
              distributionMethod: def.distributionMethod,
              lumpSumMonth,
              startMonth,
              endMonth,
              customJson: null,
              monthlyAmounts: monthly,
            });
            if (!allItemKeys.includes(def.itemKey)) {
              allItemKeys.push(def.itemKey);
            }
          }
        } else {
          // Use defaults (same as getReflectionData)
          const defs = getDefaultItemDefs(sc);
          for (const def of defs) {
            const amount = costs ? computeItemAmount(def, costs) : 0;

            let lumpSumMonth: number | null = null;
            let startMonth: number | null = null;
            let endMonth: number | null = null;

            if (def.distributionMethod === "lump_sum" && def.phase) {
              lumpSumMonth = phaseRelativeToAbsolute(def.phase, def.phaseRelativeMonth || 1, phases);
            } else if (def.distributionMethod === "equal_spread") {
              if (def.distributeAcrossPhases && def.distributeAcrossPhases.length > 0) {
                const firstPhase = def.distributeAcrossPhases[0];
                const lastPhase = def.distributeAcrossPhases[def.distributeAcrossPhases.length - 1];
                startMonth = getPhaseRange(firstPhase, phases).start;
                endMonth = getPhaseRange(lastPhase, phases).end;
              } else if (def.phase) {
                const range = getPhaseRange(def.phase, phases);
                startMonth = range.start;
                endMonth = range.end;
              }
            }

            const monthly = distributeAmount(
              amount,
              def.distributionMethod,
              lumpSumMonth,
              startMonth,
              endMonth,
              null,
              totalMonths,
            );

            scenarioItems[sc].set(def.itemKey, {
              nameAr: def.nameAr,
              amount,
              fundingSource: def.fundingSource,
              section: (def.section || "construction") as string,
              sortOrder: def.sortOrder,
              distributionMethod: def.distributionMethod,
              lumpSumMonth,
              startMonth,
              endMonth,
              customJson: null,
              monthlyAmounts: monthly,
            });

            if (!allItemKeys.includes(def.itemKey)) {
              allItemKeys.push(def.itemKey);
            }
          }
        }
      }

      // Build comparison rows
      const sections = [
        { id: "paid", label: "القسم الأول — المبالغ المدفوعة (الأرض)" },
        { id: "design", label: "القسم الثاني — التصاميم ورخصة البناء" },
        { id: "offplan", label: "القسم الثالث — ريرا والبيع أوف بلان" },
        { id: "construction", label: "القسم الرابع — الإنشاء (حصة المستثمر)" },
        { id: "escrow", label: "من حساب الضمان (تُدفع من إيرادات المشترين)" },
      ];

      interface ComparisonItem {
        itemKey: string;
        nameAr: string;
        section: string;
        sortOrder: number;
        fundingSource: string;
        distributionMethod: string;
        o1: { active: boolean; amount: number; monthlyAmounts: number[] };
        o2: { active: boolean; amount: number; monthlyAmounts: number[] };
        o3: { active: boolean; amount: number; monthlyAmounts: number[] };
      }

      const comparisonItems: ComparisonItem[] = [];
      const emptyMonthly = new Array(totalMonths).fill(0);

      for (const key of allItemKeys) {
        const o1 = scenarioItems.offplan_escrow.get(key);
        const o2 = scenarioItems.offplan_construction.get(key);
        const o3 = scenarioItems.no_offplan.get(key);
        const ref = o1 || o2 || o3;
        if (!ref) continue;

        comparisonItems.push({
          itemKey: key,
          nameAr: ref.nameAr,
          section: ref.section,
          sortOrder: ref.sortOrder,
          fundingSource: ref.fundingSource,
          distributionMethod: ref.distributionMethod,
          o1: { active: !!o1, amount: o1?.amount || 0, monthlyAmounts: o1?.monthlyAmounts || emptyMonthly },
          o2: { active: !!o2, amount: o2?.amount || 0, monthlyAmounts: o2?.monthlyAmounts || emptyMonthly },
          o3: { active: !!o3, amount: o3?.amount || 0, monthlyAmounts: o3?.monthlyAmounts || emptyMonthly },
        });
      }

      comparisonItems.sort((a, b) => a.sortOrder - b.sortOrder);

      // Compute totals
      // O3 (no_offplan) = no sales, no escrow — ALL costs are investor-funded
      let investorTotalO1 = 0, investorTotalO2 = 0, investorTotalO3 = 0;
      let escrowTotalO1 = 0, escrowTotalO2 = 0, escrowTotalO3 = 0;

      for (const item of comparisonItems) {
        if (item.fundingSource === "investor") {
          if (item.o1.active) investorTotalO1 += item.o1.amount;
          if (item.o2.active) investorTotalO2 += item.o2.amount;
        } else {
          if (item.o1.active) escrowTotalO1 += item.o1.amount;
          if (item.o2.active) escrowTotalO2 += item.o2.amount;
        }
        // O3: ALL items go to investor (no escrow in no_offplan scenario)
        if (item.o3.active) investorTotalO3 += item.o3.amount;
      }

      return {
        projectName: project.name,
        projectId: project.id,
        sections,
        items: comparisonItems,
        totalMonths,
        phaseInfo,
        totalRevenue: costs?.totalRevenue || 0,
        revenueSource: costs?.revenueSource || "calculated",
        activeScenario: costs?.activeScenario || "base",
        scenarioLabel: costs?.scenarioLabel || "أساسي",
        calculatedRevenue: costs?.calculatedRevenue || 0,
        approvedRevenue: costs?.approvedRevenue || 0,
        totals: {
          investorCapital: { o1: investorTotalO1, o2: investorTotalO2, o3: investorTotalO3 },
          escrowTotal: { o1: escrowTotalO1, o2: escrowTotalO2, o3: escrowTotalO3 },
          grandTotal: {
            o1: investorTotalO1 + escrowTotalO1,
            o2: investorTotalO2 + escrowTotalO2,
            o3: investorTotalO3 + escrowTotalO3,
          },
        },
      };
    }),

  /**
   * getPortfolioAllScenarios — aggregates getCostSettingsComparison data
   * for ALL projects across ALL 3 scenarios.
   */
  getPortfolioAllScenarios: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.user) return [];
    const db = await getDb();
    if (!db) return [];

    const allProjects = await db.select().from(projects)
      .where(eq(projects.userId, ctx.user.id));
    if (allProjects.length === 0) return [];

    const scenarioList: Scenario[] = ["offplan_escrow", "offplan_construction", "no_offplan"];

    interface ScenarioSummary {
      investorTotal: number;
      escrowTotal: number;
      grandTotal: number;
      monthlyInvestor: number[];
      monthlyEscrow: number[];
      monthlyTotal: number[];
      sectionTotals: Record<string, number>;
      /** Monthly amounts broken down by section (paid/design/offplan/construction/escrow) */
      monthlyBySection: Record<string, number[]>;
    }

    interface PortfolioProject {
      projectId: number;
      name: string;
      startDate: string;
      totalMonths: number;
      totalRevenue: number;
      phaseInfo: {
        design: { duration: number; start: number };
        offplan: { duration: number; start: number };
        construction: { duration: number; start: number };
        handover: { duration: number; start: number };
      };
      durations: {
        design: number;
        offplan: number;
        construction: number;
        handover: number;
      };
      scenarios: Record<string, ScenarioSummary>;
    }

    const results: PortfolioProject[] = [];

    for (const project of allProjects) {
      const moRows = await db.select().from(marketOverview)
        .where(eq(marketOverview.projectId, project.id));
      const cpRows = await db.select().from(competitionPricing)
        .where(eq(competitionPricing.projectId, project.id));
      const mo = moRows[0] || null;
      const cp = cpRows[0] || null;
      const costs = calculateProjectCosts(project, mo, cp);
      if (!costs) continue;

      const legacyDurations = {
        preCon: project.preConMonths || 6,
        construction: project.constructionMonths || 16,
        handover: project.handoverMonths || 2,
      };
      const durations = legacyToNewDurations(legacyDurations);
      const phasesArr = calculatePhases(durations);
      const totalMonths = getTotalMonths(durations);

      const phaseInfo = {
        design: { duration: durations.design, start: phasesArr.find(p => p.type === "design")?.startMonth || 1 },
        offplan: { duration: durations.offplan, start: phasesArr.find(p => p.type === "offplan")?.startMonth || 3 },
        construction: { duration: durations.construction, start: phasesArr.find(p => p.type === "construction")?.startMonth || 7 },
        handover: { duration: durations.handover, start: phasesArr.find(p => p.type === "handover")?.startMonth || 23 },
      };

      const scenariosData: Record<string, ScenarioSummary> = {};

      for (const sc of scenarioList) {
        const savedSettings = await db.select().from(projectCashFlowSettings).where(
          and(
            eq(projectCashFlowSettings.projectId, project.id),
            eq(projectCashFlowSettings.scenario, sc),
          )
        );

        let investorTotal = 0;
        let escrowTotal = 0;
        const monthlyInvestor = new Array(totalMonths).fill(0);
        const monthlyEscrow = new Array(totalMonths).fill(0);
        const monthlyAll = new Array(totalMonths).fill(0);
        const sectionTotals: Record<string, number> = {};
        const monthlyBySection: Record<string, number[]> = {
          paid: new Array(totalMonths).fill(0),
          design: new Array(totalMonths).fill(0),
          offplan: new Array(totalMonths).fill(0),
          construction: new Array(totalMonths).fill(0),
          escrow: new Array(totalMonths).fill(0),
        };

        const processItem = (
          _itemKey: string,
          _nameAr: string,
          amount: number,
          fundingSource: string,
          section: string,
          monthly: number[],
        ) => {
          sectionTotals[section] = (sectionTotals[section] || 0) + amount;
          // Ensure section array exists
          if (!monthlyBySection[section]) {
            monthlyBySection[section] = new Array(totalMonths).fill(0);
          }
          // O3 (no_offplan) = no sales, no escrow — ALL costs are investor-funded
          const effectiveSource = sc === "no_offplan" ? "investor" : fundingSource;
          for (let m = 0; m < totalMonths; m++) {
            const val = monthly[m] || 0;
            if (val <= 0) continue;
            monthlyAll[m] += val;
            monthlyBySection[section][m] += val;
            if (effectiveSource === "investor") {
              monthlyInvestor[m] += val;
              investorTotal += val;
            } else {
              monthlyEscrow[m] += val;
              escrowTotal += val;
            }
          }
        };

        if (savedSettings.length > 0) {
          for (const s of savedSettings) {
            if (!s.isActive) continue;
            const amount = s.amountOverride
              ? parseFloat(s.amountOverride)
              : computeItemAmountByKey(s.itemKey, costs, sc);
            const defForKey = getDefaultItemDefs(sc).find(d => d.itemKey === s.itemKey);
            const itemSection = s.section || defForKey?.section || "construction";

            // Recalculate start/end months from the project's actual phases
            // instead of using saved values (which may be from a different project)
            let effectiveStartMonth = s.startMonth;
            let effectiveEndMonth = s.endMonth;
            let effectiveLumpSumMonth = s.lumpSumMonth;

            if (defForKey) {
              if (s.distributionMethod === "lump_sum" && defForKey.phase) {
                effectiveLumpSumMonth = phaseRelativeToAbsolute(defForKey.phase, defForKey.phaseRelativeMonth || 1, phasesArr);
              } else if (s.distributionMethod === "equal_spread") {
                if (defForKey.distributeAcrossPhases && defForKey.distributeAcrossPhases.length > 0) {
                  const firstPhase = defForKey.distributeAcrossPhases[0];
                  const lastPhase = defForKey.distributeAcrossPhases[defForKey.distributeAcrossPhases.length - 1];
                  effectiveStartMonth = getPhaseRange(firstPhase, phasesArr).start;
                  effectiveEndMonth = getPhaseRange(lastPhase, phasesArr).end;
                } else if (defForKey.phase) {
                  const range = getPhaseRange(defForKey.phase, phasesArr);
                  effectiveStartMonth = range.start;
                  effectiveEndMonth = range.end;
                }
              }
            }

            const monthly = distributeAmount(
              amount,
              s.distributionMethod as DistributionMethod,
              effectiveLumpSumMonth, effectiveStartMonth, effectiveEndMonth, s.customJson,
              totalMonths,
            );
            processItem(s.itemKey, s.nameAr, amount, s.fundingSource, itemSection, monthly);
          }
        } else {
          const defs = getDefaultItemDefs(sc);
          for (const def of defs) {
            const amount = computeItemAmount(def, costs);
            let lumpSumMonth: number | null = null;
            let startMonth: number | null = null;
            let endMonth: number | null = null;

            if (def.distributionMethod === "lump_sum" && def.phase) {
              lumpSumMonth = phaseRelativeToAbsolute(def.phase, def.phaseRelativeMonth || 1, phasesArr);
            } else if (def.distributionMethod === "equal_spread") {
              if (def.distributeAcrossPhases && def.distributeAcrossPhases.length > 0) {
                const firstPhase = def.distributeAcrossPhases[0];
                const lastPhase = def.distributeAcrossPhases[def.distributeAcrossPhases.length - 1];
                startMonth = getPhaseRange(firstPhase, phasesArr).start;
                endMonth = getPhaseRange(lastPhase, phasesArr).end;
              } else if (def.phase) {
                const range = getPhaseRange(def.phase, phasesArr);
                startMonth = range.start;
                endMonth = range.end;
              }
            }

            const monthly = distributeAmount(
              amount, def.distributionMethod,
              lumpSumMonth, startMonth, endMonth, null,
              totalMonths,
            );
            processItem(def.itemKey, def.nameAr, amount, def.fundingSource, def.section || "construction", monthly);
          }
        }

        scenariosData[sc] = {
          investorTotal,
          escrowTotal,
          grandTotal: investorTotal + escrowTotal,
          monthlyInvestor,
          monthlyEscrow,
          monthlyTotal: monthlyAll,
          sectionTotals,
          monthlyBySection,
        };
      }

      results.push({
        projectId: project.id,
        name: project.name,
        startDate: project.startDate || "2026-04",
        totalMonths,
        totalRevenue: costs.totalRevenue || 0,
        revenueSource: costs.revenueSource || "calculated",
        activeScenario: costs.activeScenario || "base",
        scenarioLabel: costs.scenarioLabel || "أساسي",
        phaseInfo,
        durations: {
          design: durations.design,
          offplan: durations.offplan,
          construction: durations.construction,
          handover: durations.handover,
        },
        scenarios: scenariosData,
      });
    }

    return results;
  }),
});

// ─── Helper: compute amount by item key ──────────────────────────────────────

function computeItemAmountByKey(
  itemKey: string,
  costs: NonNullable<ReturnType<typeof calculateProjectCosts>>,
  scenario: Scenario,
): number {
  // Items with split ratios — each sub-item gets its own fraction of the total
  // For offplan scenarios (O1, O2): developer fee = 5% → design 20% + offplan 20% + construction 60%
  // For no_offplan scenario (O3): developer fee = 3% → design 1% + construction (supervision) 2%
  const isOffplan = scenario === "offplan_escrow" || scenario === "offplan_construction";
  // In O3, developer tasks are fewer → total fee is 3% instead of 5%
  const devFeeO3 = costs.totalRevenue * 0.03;
  const splitMap: Record<string, number> = {
    // Developer fee split
    developer_fee_design: isOffplan ? costs.developerFee * 0.20 : devFeeO3 * (1/3),     // O1/O2: 1% | O3: 1%
    developer_fee_offplan: costs.developerFee * 0.20,   // only in offplan scenarios
    developer_fee_construction: isOffplan ? costs.developerFee * 0.60 : devFeeO3 * (2/3), // O1/O2: 3% | O3: 2%
    // Marketing split: 25% offplan + 75% construction = 100%
    // For no_offplan: marketing_offplan doesn’t exist, so construction = 100%
    marketing_offplan: costs.marketingCost * 0.25,       // only in offplan scenarios
    marketing_construction: costs.marketingCost * (isOffplan ? 0.75 : 1.0),
    // Sales commission (full amount, from escrow)
    sales_commission: costs.salesCommission,
    // Escrow split items — percentage of parent amounts paid from escrow
    government_fees_escrow: costs.officialBodiesFees * 0.90,
    government_fees_investor: costs.officialBodiesFees * 0.10,
    community_fee_escrow: costs.communityFees * 0.75,
    contractor_payments: costs.constructionCost * 0.70,
    contractor_payments_20: costs.constructionCost * 0.20,
  };
  if (itemKey in splitMap) return splitMap[itemKey];

  const keyMap: Record<string, number> = {
    land_cost: costs.landPrice,
    land_broker: costs.agentCommissionLand,
    land_registration: costs.landRegistration,
    soil_test: costs.soilTestFee,
    survey: costs.topographicSurveyFee,
    design_fee: costs.designFee,
    developer_fee: costs.developerFee,
    fraz_fee: costs.separationFee,
    rera_registration: costs.reraProjectRegFee,
    rera_units: costs.reraUnitRegFee,
    noc_fee: costs.developerNocFee,
    escrow_fee: costs.escrowAccountFee,
    community_fee: costs.communityFees,
    escrow_deposit: costs.constructionCost * 0.20,
    contractor_advance: costs.constructionCost * 0.10,
    contingency: costs.contingencies,
    bank_fees: costs.bankFees,
    marketing: costs.marketingCost,
    supervision_fee: costs.supervisionFee,
    surveyor_fee: costs.surveyorFees,
    rera_audit: costs.reraAuditReportFee,
    rera_inspection: costs.reraInspectionReportFee,
    revenue_booking: costs.totalRevenue * 0.20,
    revenue_construction: costs.totalRevenue * 0.30,
    revenue_handover: costs.totalRevenue * 0.50,
  };
  return keyMap[itemKey] || 0;
}

// ─── Helper: distribute amount across months ──────────────────────────────────

function distributeAmount(
  amount: number,
  method: DistributionMethod,
  lumpSumMonth: number | null,
  startMonth: number | null,
  endMonth: number | null,
  customJson: string | null,
  totalMonths: number,
): number[] {
  const monthly = new Array(totalMonths).fill(0);

  if (amount <= 0) return monthly;

  switch (method) {
    case "lump_sum": {
      const m = (lumpSumMonth || 1) - 1; // convert to 0-based
      if (m === -1) {
        // Month 0 = land payment (before project start), store in index 0
        monthly[0] = amount;
      } else if (m >= 0 && m < totalMonths) {
        monthly[m] = amount;
      }
      break;
    }
    case "equal_spread": {
      const start = Math.max(0, (startMonth || 1) - 1);
      const end = Math.min(totalMonths - 1, (endMonth || totalMonths) - 1);
      const months = end - start + 1;
      if (months > 0) {
        const perMonth = amount / months;
        for (let m = start; m <= end; m++) {
          monthly[m] = perMonth;
        }
      }
      break;
    }
    case "custom": {
      if (customJson) {
        try {
          const parsed = JSON.parse(customJson);
          // Handle two formats:
          // 1) Simple array of percentages from frontend: [50, 30, 20, 0, ...]
          //    Each index maps to a month within the phase (startMonth-based)
          // 2) Object array: [{month: 1, pct: 50}, ...]
          if (Array.isArray(parsed) && parsed.length > 0) {
            if (typeof parsed[0] === "number" || (typeof parsed[0] === "string" && !isNaN(Number(parsed[0])))) {
              // Format 1: simple percentage array — distribute relative to startMonth
              const baseMonth = (startMonth || 1) - 1; // 0-based
              for (let i = 0; i < parsed.length; i++) {
                const pct = parseFloat(parsed[i]) || 0;
                const m = baseMonth + i;
                if (m >= 0 && m < totalMonths && pct > 0) {
                  monthly[m] = amount * pct / 100;
                }
              }
            } else {
              // Format 2: object array [{month, pct/amount}]
              for (const entry of parsed as Array<{ month: number; amount?: number; pct?: number }>) {
                const m = entry.month - 1;
                if (m >= 0 && m < totalMonths) {
                  const val = entry.amount !== undefined
                    ? entry.amount
                    : (entry.pct !== undefined ? amount * entry.pct / 100 : 0);
                  monthly[m] += val;
                }
              }
            }
          }
        } catch {
          // Invalid JSON, fall back to equal spread
          const perMonth = amount / totalMonths;
          for (let m = 0; m < totalMonths; m++) monthly[m] = perMonth;
        }
      }
      break;
    }
  }

  return monthly;
}
