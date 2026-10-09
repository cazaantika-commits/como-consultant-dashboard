import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { MAJAN_ORIGINAL_BASELINE } from "../../shared/majanBaselineSnapshot";
import type { MajanInputs } from "../../shared/majanFinanceTypes";
import {
  MAJAN_PROJECT_ID,
  MajanStoreError,
  majanFinanceStore,
} from "../services/majanFinanceStore";
import { protectedProcedure, router } from "../_core/trpc";

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_GFA_SQFT = 493_894.71;
const MAX_FORECAST_MONTHS = 360;
const BASELINE_START_MONTH = "2026-09";

const boundedText = (max: number, min = 1) => z.string().trim().min(min).max(max);
const finiteNumber = (min: number, max: number) => z.number().finite().min(min).max(max);
const nullableAmount = (max = 10_000_000_000) => finiteNumber(0, max).nullable();
const monthSchema = z.string().regex(MONTH_PATTERN, "Use YYYY-MM.");
const dateSchema = z.string().regex(DATE_PATTERN, "Use YYYY-MM-DD.");
const baselineRowIds = new Set(MAJAN_ORIGINAL_BASELINE.rows.map(row => row.id));

const provenanceSchema = z.object({
  source: boundedText(500),
  asOf: dateSchema,
  status: z.enum(["recorded", "assumption", "contractual"]),
  rationale: z.string().trim().max(2_000).optional(),
}).strict();

const feeSpecSchema = z.object({
  mode: z.enum(["amount", "percentage", "percentage_minimum", "none"]),
  amount: nullableAmount(),
  percentage: nullableAmount(100),
  minimum: nullableAmount(),
}).strict();

const developmentSchema = z.object({
  buaSqft: finiteNumber(1, 5_000_000),
  constructionRate: finiteNumber(0, 100_000),
  designFee: feeSpecSchema,
  supervisionFee: feeSpecSchema,
  source: provenanceSchema,
  // Omitted means retain the immutable original programme; it is never silently replaced.
  startMonth: monthSchema.optional(),
  designMonths: z.number().int().min(1).max(60).optional(),
  constructionMonths: z.number().int().min(1).max(120).optional(),
  handoverMonths: z.number().int().min(0).max(36).optional(),
  costOverrides: z.array(z.object({
    rowId: boundedText(100),
    amount: finiteNumber(0, 10_000_000_000),
    source: provenanceSchema,
  }).strict()).max(100).optional(),
}).strict().superRefine((development, ctx) => {
  const seen = new Set<string>();
  (development.costOverrides ?? []).forEach((override, index) => {
    if (!baselineRowIds.has(override.rowId)) {
      ctx.addIssue({
        code: "custom",
        path: ["costOverrides", index, "rowId"],
        message: "A development cost override must reference a row in the immutable Majan baseline.",
      });
    }
    if (seen.has(override.rowId)) {
      ctx.addIssue({
        code: "custom",
        path: ["costOverrides", index, "rowId"],
        message: "Each immutable baseline cost row may be overridden only once.",
      });
    }
    seen.add(override.rowId);
  });
});

const leasingRowSchema = z.object({
  id: boundedText(100),
  floor: z.enum(["G", "L1", "L2", "L3", "L4"]),
  nameEn: boundedText(250),
  nameAr: boundedText(250),
  areaSqft: finiteNumber(0, MAX_GFA_SQFT),
  treatment: z.enum(["leased", "owner_operated"]),
  annualRentPsf: nullableAmount(100_000),
  rentRule: z.enum(["base", "max_base_turnover", "base_plus_turnover"]),
  annualSalesPsf: nullableAmount(10_000_000),
  turnoverPct: nullableAmount(100),
  openingMonth: monthSchema,
  initialOccupancyPct: finiteNumber(0, 100),
  stabilisedOccupancyPct: finiteNumber(0, 100),
  rampMonths: z.number().int().min(0).max(MAX_FORECAST_MONTHS),
  rentFreeMonths: z.number().int().min(0).max(120),
  escalationPct: finiteNumber(0, 100),
  collectionPct: finiteNumber(0, 100),
  collectionLagMonths: z.number().int().min(0).max(120),
  source: provenanceSchema,
}).strict();

const opexRowSchema = z.object({
  id: boundedText(100),
  nameEn: boundedText(250),
  nameAr: boundedText(250),
  mode: z.enum(["annual_amount", "per_gla", "percent_collected_rent"]),
  value: nullableAmount(),
  escalationPct: finiteNumber(0, 100),
  recoverablePct: finiteNumber(0, 100),
  recoveryCollectionPct: finiteNumber(0, 100),
  source: provenanceSchema,
}).strict();

const operationsSchema = z.object({
  openingMonth: monthSchema,
  maintenanceCapexAnnual: nullableAmount(),
  capexEscalationPct: finiteNumber(0, 100),
  reserveAnnual: nullableAmount(),
  reserveReleaseAnnual: finiteNumber(0, 10_000_000_000),
  cashTaxAnnual: nullableAmount(),
  taxRationale: boundedText(2_000, 0),
  otherIncomeAnnual: finiteNumber(0, 10_000_000_000),
  vatMode: z.literal("excluded_net_model"),
  source: provenanceSchema,
}).strict();

const financeSchema = z.object({
  enabled: z.boolean(),
  status: z.enum(["indicative", "terms_pending"]),
  structure: z.enum(["istisna_forward_ijara", "ijara", "diminishing_musharaka"]),
  lender: boundedText(250, 0),
  commitment: nullableAmount(),
  financeSharePct: nullableAmount(100),
  profitRatePct: nullableAmount(100),
  drawStartMonth: monthSchema,
  drawEndMonth: monthSchema,
  repaymentStartMonth: monthSchema,
  repaymentMonths: z.number().int().min(1).max(MAX_FORECAST_MONTHS).nullable(),
  repaymentMode: z.enum(["equal_principal", "level_payment", "bullet"]),
  constructionProfit: z.enum(["capitalise", "pay"]),
  arrangementFeePct: finiteNumber(0, 100),
  dsraMonths: z.number().int().min(0).max(60),
  targetDscr: nullableAmount(100),
  balloonPct: finiteNumber(0, 100),
  eligibleCategories: z.array(boundedText(100)).max(25),
  source: provenanceSchema,
}).strict();

function monthIndex(month: string): number {
  const [year, value] = month.split("-").map(Number);
  return year * 12 + value - 1;
}

export function monthDistance(from: string, to: string): number {
  return monthIndex(to) - monthIndex(from);
}

/**
 * Validates finite bounded draft fields, while intentionally retaining null for incomplete
 * scenarios. The model then marks only dependent forecasts as not calculable; null is never zero.
 */
export const majanInputsSchema = z.object({
  schemaVersion: z.literal(1),
  projectId: z.literal(MAJAN_PROJECT_ID),
  plot: z.literal("6457956"),
  caseName: boundedText(200),
  asOf: dateSchema,
  horizonMonth: monthSchema,
  development: developmentSchema,
  leasing: z.array(leasingRowSchema).max(100),
  opex: z.array(opexRowSchema).max(100),
  operations: operationsSchema,
  finance: financeSchema,
  notes: z.string().trim().max(10_000),
}).strict().superRefine((inputs, ctx) => {
  const horizonMonths = monthDistance(BASELINE_START_MONTH, inputs.horizonMonth);
  if (horizonMonths < 0 || horizonMonths >= MAX_FORECAST_MONTHS) {
    ctx.addIssue({
      code: "custom",
      path: ["horizonMonth"],
      message: `Horizon must be from ${BASELINE_START_MONTH} and within ${MAX_FORECAST_MONTHS} months of the immutable baseline.`,
    });
  }

  const totalGla = inputs.leasing.reduce((sum, row) => sum + row.areaSqft, 0);
  if (totalGla > MAX_GFA_SQFT + 0.000_001) {
    ctx.addIssue({
      code: "custom",
      path: ["leasing"],
      message: `Grouped leasing area cannot exceed the DDA GFA allowance of ${MAX_GFA_SQFT.toLocaleString("en-US")} sqft.`,
    });
  }

  if (inputs.finance.enabled) {
    if (monthIndex(inputs.finance.drawStartMonth) > monthIndex(inputs.finance.drawEndMonth)) {
      ctx.addIssue({ code: "custom", path: ["finance", "drawEndMonth"], message: "Draw end must not precede draw start." });
    }
    if (monthIndex(inputs.finance.drawEndMonth) >= monthIndex(inputs.finance.repaymentStartMonth)) {
      ctx.addIssue({
        code: "custom",
        path: ["finance", "repaymentStartMonth"],
        message: "Repayment must start after the draw period; overlapping draws and repayment are not supported.",
      });
    }
  }
});

export type ValidatedMajanInputs = z.infer<typeof majanInputsSchema>;

export function parseMajanInputs(input: unknown): MajanInputs {
  return majanInputsSchema.parse(input) as MajanInputs;
}

const projectScopeSchema = z.object({
  projectId: z.literal(MAJAN_PROJECT_ID),
});

const caseIdSchema = z.number().int().positive();

const saveSchema = projectScopeSchema.extend({
  caseId: caseIdSchema.optional(),
  expectedRevision: z.number().int().positive().optional(),
  inputs: majanInputsSchema,
}).strict().superRefine((input, ctx) => {
  if (input.caseId != null && input.expectedRevision == null) {
    ctx.addIssue({ code: "custom", path: ["expectedRevision"], message: "expectedRevision is required when saving an existing scenario." });
  }
  if (input.caseId == null && input.expectedRevision != null) {
    ctx.addIssue({ code: "custom", path: ["expectedRevision"], message: "expectedRevision is only valid when saving an existing scenario." });
  }
});

function actorFromContext(user: { id: number; role: string }) {
  return { id: user.id, role: user.role === "admin" ? "admin" as const : "user" as const };
}

function toTrpcError(error: unknown): never {
  if (!(error instanceof MajanStoreError)) throw error;
  const code = error.code === "FORBIDDEN" || error.code === "INVALID_SCOPE"
    ? "FORBIDDEN"
    : error.code === "NOT_FOUND"
      ? "NOT_FOUND"
      : error.code === "CONFLICT"
        ? "CONFLICT"
        : "INTERNAL_SERVER_ERROR";
  throw new TRPCError({ code, message: error.message, cause: error });
}

/** Parent registers this router under appRouter.majanFinance; no legacy router is changed here. */
export const majanFinanceRouter = router({
  get: protectedProcedure
    .input(projectScopeSchema.extend({ caseId: caseIdSchema.optional() }).strict())
    .query(async ({ ctx, input }) => {
      try {
        return await majanFinanceStore.loadMajanCase(actorFromContext(ctx.user), input.caseId);
      } catch (error) {
        return toTrpcError(error);
      }
    }),

  save: protectedProcedure
    .input(saveSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const actor = actorFromContext(ctx.user);
        return input.caseId == null
          ? await majanFinanceStore.createMajanCase(actor, input.inputs)
          : await majanFinanceStore.updateMajanCase(actor, input.caseId, input.expectedRevision!, input.inputs);
      } catch (error) {
        return toTrpcError(error);
      }
    }),

  list: protectedProcedure
    .input(projectScopeSchema.strict())
    .query(async ({ ctx, input }) => {
      try {
        return await majanFinanceStore.listMajanCases(actorFromContext(ctx.user), input.projectId);
      } catch (error) {
        return toTrpcError(error);
      }
    }),

  history: protectedProcedure
    .input(projectScopeSchema.extend({ caseId: caseIdSchema }).strict())
    .query(async ({ ctx, input }) => {
      try {
        return await majanFinanceStore.getMajanCaseHistory(actorFromContext(ctx.user), input.caseId);
      } catch (error) {
        return toTrpcError(error);
      }
    }),
});
