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
      itemKey: "design_fee", nameAr: "أتعاب التصميم (2%)", category: "design", section: "design", sortOrder: 12,
      fundingSource: "investor", distributionMethod: "equal_spread",
      distributeAcrossPhases: ["design"],
      scenarios: allScenarios, amountKey: "designFee",
    },
    // أتعاب المطور — مقسمة إلى 3 بنود منفصلة
    // في سيناريو أوف بلان: تصاميم 20% + أوف بلان 20% + إنشاء 60% = 100%
    // في سيناريو بدون أوف بلان: تصاميم 40% + إنشاء 60% = 100%
    {
      itemKey: "developer_fee_design", nameAr: `أتعاب المطور — التصاميم (${isOffplan ? "1" : "2"}%)`, category: "developer_fee", section: "design", sortOrder: 13,
      fundingSource: "investor", distributionMethod: "equal_spread",
      distributeAcrossPhases: ["design"],
      scenarios: allScenarios, amountKey: "developerFee",
      splitRatio: [{ phase: "design", ratio: isOffplan ? 0.2 : 0.4 }],
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
    // التسويق والإعلان — 25% في مرحلة أوف بلان (من المستثمر)
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

    // ═══ الإشراف والمساح (من الإسكرو) ═══
    // أتعاب المطور — الإنشاء (3%) من حساب الضمان
    {
      itemKey: "developer_fee_construction", nameAr: "أتعاب المطور — الإشراف (3%)", category: "developer_fee", section: "escrow", sortOrder: 58,
      fundingSource: "escrow", distributionMethod: "equal_spread",
      distributeAcrossPhases: ["construction"],
      scenarios: allScenarios, amountKey: "developerFee",
      splitRatio: [{ phase: "construction", ratio: 0.6 }],
    },
    {
      itemKey: "supervision_fee", nameAr: "أتعاب الإشراف (2%)", category: "construction", section: "escrow", sortOrder: 60,
      fundingSource: "escrow", distributionMethod: "equal_spread",
      distributeAcrossPhases: ["construction"],
      scenarios: allScenarios, amountKey: "supervisionFee",
    },
    {
      itemKey: "surveyor_fee", nameAr: "رسوم المساح", category: "construction", section: "escrow", sortOrder: 61,
      fundingSource: "investor", distributionMethod: "equal_spread",
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
      fundingSource: "escrow", distributionMethod: "equal_spread",
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

    // ═══ الإيرادات ═══
    {
      itemKey: "revenue_booking", nameAr: "إيرادات الحجز (20%)", category: "revenue", section: "escrow", sortOrder: 70,
      fundingSource: "escrow", distributionMethod: "equal_spread",
      distributeAcrossPhases: ["offplan"],
      scenarios: offplanScenarios, amountFraction: { of: "constructionCost", ratio: 0 }, // computed from totalRevenue
    },
    {
      itemKey: "revenue_construction", nameAr: "إيرادات مرحلة الإنشاء (30%)", category: "revenue", section: "escrow", sortOrder: 71,
      fundingSource: "escrow", distributionMethod: "equal_spread",
      distributeAcrossPhases: ["construction"],
      scenarios: offplanScenarios, amountFraction: { of: "constructionCost", ratio: 0 },
    },
    {
      itemKey: "revenue_handover", nameAr: "إيرادات التسليم (50%)", category: "revenue", section: "escrow", sortOrder: 72,
      fundingSource: "escrow", distributionMethod: "lump_sum",
      phase: "handover", phaseRelativeMonth: 1,
      scenarios: offplanScenarios, amountFraction: { of: "constructionCost", ratio: 0 },
    },
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
        // Build a lookup of default sections by itemKey for fallback
        const defaultDefs = getDefaultItemDefs(input.scenario);
        const defaultSectionByKey: Record<string, string> = {};
        for (const def of defaultDefs) {
          defaultSectionByKey[def.itemKey] = def.section;
        }
        // Return existing settings with computed amounts
        return {
          settings: existing.map(s => ({
            ...s,
            // Fill section from default defs if not saved in DB yet
            section: s.section || defaultSectionByKey[s.itemKey] || "construction",
            computedAmount: costs ? computeItemAmountByKey(s.itemKey, costs, input.scenario) : 0,
          })),
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
            nameAr: s.nameAr,
            category: s.category as Category,
            section: itemSection,
            isActive: !!s.isActive,
            sortOrder: s.sortOrder,
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
        for (let m = 0; m < totalMonths; m++) {
          const val = item.monthlyAmounts[m] || 0;
          grandMonthlyTotals[m] += val;
          if (item.fundingSource === "investor") {
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

      await db.update(projects)
        .set({
          preConMonths: input.designMonths,
          constructionMonths: input.constructionMonths,
          handoverMonths: input.handoverMonths,
        })
        .where(eq(projects.id, input.projectId));

      return { success: true };
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
});

// ─── Helper: compute amount by item key ──────────────────────────────────────

function computeItemAmountByKey(
  itemKey: string,
  costs: NonNullable<ReturnType<typeof calculateProjectCosts>>,
  scenario: Scenario,
): number {
  // Items with split ratios — each sub-item gets its own fraction of the total
  // For offplan scenarios: design=20%, offplan=20%, construction=60%
  // For no_offplan scenario: developer_fee_offplan doesn’t exist, so design=40%, construction=60%
  const isOffplan = scenario === "offplan_escrow" || scenario === "offplan_construction";
  const splitMap: Record<string, number> = {
    // Developer fee split
    developer_fee_design: costs.developerFee * (isOffplan ? 0.20 : 0.40),
    developer_fee_offplan: costs.developerFee * 0.20,   // only in offplan scenarios
    developer_fee_construction: costs.developerFee * 0.60,
    // Marketing split: 25% offplan + 75% construction = 100%
    // For no_offplan: marketing_offplan doesn’t exist, so construction = 100%
    marketing_offplan: costs.marketingCost * 0.25,       // only in offplan scenarios
    marketing_construction: costs.marketingCost * (isOffplan ? 0.75 : 1.0),
    // Sales commission (full amount, from escrow)
    sales_commission: costs.salesCommission,
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
          const entries: Array<{ month: number; amount?: number; pct?: number }> = JSON.parse(customJson);
          for (const entry of entries) {
            const m = entry.month - 1;
            if (m >= 0 && m < totalMonths) {
              const val = entry.amount !== undefined
                ? entry.amount
                : (entry.pct !== undefined ? amount * entry.pct / 100 : 0);
              monthly[m] += val;
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
