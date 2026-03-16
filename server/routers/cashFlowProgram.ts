import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { cfProjects, cfCostItems, cfScenarios, cfFiles, projects, costsCashFlow, projectPhases, phaseActivities, phaseCostLinks, competitionPricing, marketOverview, projectCapitalSettings } from "../../drizzle/schema";
import { DEFAULT_AVG_AREAS } from "../../shared/feasibilityUtils";
import { calculateDualCashFlow, type CostItemInput, type ProjectInput } from './cashFlowEngine';
import { computeProjectCapital } from '../investorCashFlow';
import { eq, and, desc } from "drizzle-orm";
import { storagePut } from "../storage";

// ═══════════════════════════════════════════════════════════════
// Cash Flow Calculation Engine - محرك حسابات التدفق النقدي
// ═══════════════════════════════════════════════════════════════

interface TimelinePhase {
  name: string;
  startMonth: number;
  endMonth: number;
  durationMonths: number;
}

interface PaymentParams {
  // Lump Sum
  paymentMonth?: number;
  // Milestone
  milestones?: Array<{ percent: number; description: string; monthOffset: number }>;
  // Monthly Fixed
  startMonth?: number;
  endMonth?: number;
  // Progress Based
  mobilizationPct?: number;
  progressDistribution?: 'linear' | 'scurve';
  retentionPct?: number;
  retentionReleaseMonth?: number; // month offset from project start
  // Sales Linked
  salesPct?: number;
  salesTiming?: 'booking' | 'construction' | 'handover';
}

interface CostItemWithPayment {
  id: number;
  name: string;
  category: string;
  totalAmount: number;
  paymentType: string;
  paymentParams: PaymentParams;
  phaseAllocation?: Record<string, number>;
}

interface ScenarioAdjustments {
  salesStartMonthDelta?: number;
  constructionDurationDelta?: number;
  mobilizationPctOverride?: number;
  buyerPlanBookingPct?: number;
  buyerPlanConstructionPct?: number;
  buyerPlanHandoverPct?: number;
}

function buildTimeline(
  designMonths: number,
  reraMonths: number,
  constructionMonths: number,
  handoverMonths: number,
  constructionDelta: number = 0
): TimelinePhase[] {
  const adjConstruction = Math.max(1, constructionMonths + constructionDelta);
  const phases: TimelinePhase[] = [];
  let month = 1;

  phases.push({
    name: 'design',
    startMonth: month,
    endMonth: month + designMonths - 1,
    durationMonths: designMonths,
  });
  month += designMonths;

  phases.push({
    name: 'rera',
    startMonth: month,
    endMonth: month + reraMonths - 1,
    durationMonths: reraMonths,
  });
  month += reraMonths;

  phases.push({
    name: 'construction',
    startMonth: month,
    endMonth: month + adjConstruction - 1,
    durationMonths: adjConstruction,
  });
  month += adjConstruction;

  phases.push({
    name: 'handover',
    startMonth: month,
    endMonth: month + handoverMonths - 1,
    durationMonths: handoverMonths,
  });

  return phases;
}

function getTotalProjectMonths(phases: TimelinePhase[]): number {
  return phases[phases.length - 1].endMonth;
}

function getPhaseByName(phases: TimelinePhase[], name: string): TimelinePhase | undefined {
  return phases.find(p => p.name === name);
}

// S-curve distribution (approximation using sigmoid)
function sCurveDistribution(months: number): number[] {
  if (months <= 0) return [];
  const result: number[] = [];
  let total = 0;
  for (let i = 0; i < months; i++) {
    const x = (i / (months - 1 || 1)) * 6 - 3; // map to [-3, 3]
    const val = 1 / (1 + Math.exp(-x));
    result.push(val);
    total += val;
  }
  // Normalize to sum to 1
  return result.map(v => v / total);
}

function linearDistribution(months: number): number[] {
  if (months <= 0) return [];
  return new Array(months).fill(1 / months);
}

function calculateMonthlyOutflow(
  costItems: CostItemWithPayment[],
  phases: TimelinePhase[],
  totalMonths: number,
  scenario?: ScenarioAdjustments
): Record<string, number[]> {
  const outflowByCategory: Record<string, number[]> = {};
  const totalOutflow = new Array(totalMonths).fill(0);

  for (const item of costItems) {
    const categoryKey = item.category;
    if (!outflowByCategory[categoryKey]) {
      outflowByCategory[categoryKey] = new Array(totalMonths).fill(0);
    }

    const monthlyPayments = calculateItemPayments(item, phases, totalMonths, scenario);
    for (let m = 0; m < totalMonths; m++) {
      outflowByCategory[categoryKey][m] += monthlyPayments[m];
      totalOutflow[m] += monthlyPayments[m];
    }
  }

  outflowByCategory['total'] = totalOutflow;
  return outflowByCategory;
}

function calculateItemPayments(
  item: CostItemWithPayment,
  phases: TimelinePhase[],
  totalMonths: number,
  scenario?: ScenarioAdjustments
): number[] {
  const payments = new Array(totalMonths).fill(0);
  const params = item.paymentParams || {};
  const amount = item.totalAmount;

  switch (item.paymentType) {
    case 'lump_sum': {
      const month = (params.paymentMonth || 1) - 1;
      if (month >= 0 && month < totalMonths) {
        payments[month] = amount;
      }
      break;
    }

    case 'milestone': {
      const milestones = params.milestones || [];
      for (const ms of milestones) {
        const month = (ms.monthOffset || 1) - 1;
        if (month >= 0 && month < totalMonths) {
          payments[month] += amount * (ms.percent / 100);
        }
      }
      break;
    }

    case 'monthly_fixed': {
      const start = (params.startMonth || 1) - 1;
      const end = Math.min((params.endMonth || totalMonths) - 1, totalMonths - 1);
      const duration = end - start + 1;
      if (duration > 0) {
        const monthly = amount / duration;
        for (let m = start; m <= end && m < totalMonths; m++) {
          if (m >= 0) payments[m] = monthly;
        }
      }
      break;
    }

    case 'progress_based': {
      const constructionPhase = getPhaseByName(phases, 'construction');
      if (!constructionPhase) break;

      const mobPct = (scenario?.mobilizationPctOverride ?? params.mobilizationPct ?? 10) / 100;
      const retPct = (params.retentionPct ?? 5) / 100;
      const dist = params.progressDistribution === 'scurve'
        ? sCurveDistribution(constructionPhase.durationMonths)
        : linearDistribution(constructionPhase.durationMonths);

      // Mobilization at construction start
      const mobMonth = constructionPhase.startMonth - 1;
      if (mobMonth >= 0 && mobMonth < totalMonths) {
        payments[mobMonth] += amount * mobPct;
      }

      // Progress payments (minus mobilization and retention)
      const progressAmount = amount * (1 - mobPct - retPct);
      for (let i = 0; i < constructionPhase.durationMonths; i++) {
        const m = constructionPhase.startMonth - 1 + i;
        if (m >= 0 && m < totalMonths) {
          payments[m] += progressAmount * dist[i];
        }
      }

      // Retention release
      const retMonth = (params.retentionReleaseMonth || (constructionPhase.endMonth + 12)) - 1;
      if (retMonth >= 0 && retMonth < totalMonths) {
        payments[retMonth] += amount * retPct;
      }
      break;
    }

    case 'sales_linked': {
      // Distribute based on sales timing
      const timing = params.salesTiming || 'construction';
      const pct = (params.salesPct || 100) / 100;
      const linkedAmount = amount * pct;

      if (timing === 'booking') {
        // Spread during RERA phase
        const reraPhase = getPhaseByName(phases, 'rera');
        if (reraPhase) {
          const monthly = linkedAmount / reraPhase.durationMonths;
          for (let m = reraPhase.startMonth - 1; m < reraPhase.endMonth && m < totalMonths; m++) {
            if (m >= 0) payments[m] = monthly;
          }
        }
      } else if (timing === 'construction') {
        const constructionPhase = getPhaseByName(phases, 'construction');
        if (constructionPhase) {
          const monthly = linkedAmount / constructionPhase.durationMonths;
          for (let m = constructionPhase.startMonth - 1; m < constructionPhase.endMonth && m < totalMonths; m++) {
            if (m >= 0) payments[m] = monthly;
          }
        }
      } else if (timing === 'handover') {
        const handoverPhase = getPhaseByName(phases, 'handover');
        if (handoverPhase) {
          const monthly = linkedAmount / handoverPhase.durationMonths;
          for (let m = handoverPhase.startMonth - 1; m < handoverPhase.endMonth && m < totalMonths; m++) {
            if (m >= 0) payments[m] = monthly;
          }
        }
      }
      break;
    }
  }

  return payments;
}

function calculateSalesInflow(
  project: any,
  phases: TimelinePhase[],
  totalMonths: number,
  scenario?: ScenarioAdjustments
): number[] {
  const inflow = new Array(totalMonths).fill(0);
  if (!project.salesEnabled || !project.totalSalesRevenue) return inflow;

  const totalRevenue = project.totalSalesRevenue;
  const salesStartDelta = scenario?.salesStartMonthDelta || 0;
  const salesStart = (project.salesStartMonth || 1) + salesStartDelta - 1;

  const bookingPct = (scenario?.buyerPlanBookingPct ?? parseFloat(project.buyerPlanBookingPct) ?? 20) / 100;
  const constructionPct = (scenario?.buyerPlanConstructionPct ?? parseFloat(project.buyerPlanConstructionPct) ?? 30) / 100;
  const handoverPct = (scenario?.buyerPlanHandoverPct ?? parseFloat(project.buyerPlanHandoverPct) ?? 50) / 100;

  const reraPhase = getPhaseByName(phases, 'rera');
  const constructionPhase = getPhaseByName(phases, 'construction');
  const handoverPhase = getPhaseByName(phases, 'handover');

  // Booking payments during RERA/early phase
  if (reraPhase) {
    const bookingAmount = totalRevenue * bookingPct;
    const start = Math.max(salesStart, reraPhase.startMonth - 1);
    const end = reraPhase.endMonth - 1;
    const dur = Math.max(1, end - start + 1);
    const monthly = bookingAmount / dur;
    for (let m = start; m <= end && m < totalMonths; m++) {
      if (m >= 0) inflow[m] += monthly;
    }
  }

  // Construction payments
  if (constructionPhase) {
    const constAmount = totalRevenue * constructionPct;
    const monthly = constAmount / constructionPhase.durationMonths;
    for (let m = constructionPhase.startMonth - 1; m < constructionPhase.endMonth && m < totalMonths; m++) {
      if (m >= 0) inflow[m] += monthly;
    }
  }

  // Handover payments
  if (handoverPhase) {
    const handoverAmount = totalRevenue * handoverPct;
    const monthly = handoverAmount / handoverPhase.durationMonths;
    for (let m = handoverPhase.startMonth - 1; m < handoverPhase.endMonth && m < totalMonths; m++) {
      if (m >= 0) inflow[m] += monthly;
    }
  }

  return inflow;
}

// ═══════════════════════════════════════════════════════════════
// Zod Schemas
// ═══════════════════════════════════════════════════════════════

const cfProjectInput = z.object({
  projectId: z.number().nullable().optional(),
  name: z.string().min(1),
  startDate: z.string(),
  designApprovalMonths: z.number().min(1).default(6),
  reraSetupMonths: z.number().min(1).default(3),
  constructionMonths: z.number().min(1).default(24),
  handoverMonths: z.number().min(1).default(3),
  salesEnabled: z.boolean().default(false),
  salesStartMonth: z.number().nullable().optional(),
  salesVelocityUnits: z.number().nullable().optional(),
  salesVelocityAed: z.number().nullable().optional(),
  salesVelocityType: z.enum(['units', 'aed']).default('aed'),
  totalSalesRevenue: z.number().nullable().optional(),
  buyerPlanBookingPct: z.number().default(20),
  buyerPlanConstructionPct: z.number().default(30),
  buyerPlanHandoverPct: z.number().default(50),
  notes: z.string().nullable().optional(),
});

const cfCostItemInput = z.object({
  cfProjectId: z.number(),
  name: z.string().min(1),
  category: z.enum(['land', 'land_registration', 'development_setup', 'design_engineering', 'consultants', 'authority_fees', 'contractor', 'marketing_sales', 'administration', 'developer_fee', 'contingency', 'other']),
  totalAmount: z.number(),
  paymentType: z.enum(['lump_sum', 'milestone', 'monthly_fixed', 'progress_based', 'sales_linked']),
  paymentParams: z.any().optional(),
  phaseAllocation: z.any().optional(),
  sortOrder: z.number().default(0),
});

const cfScenarioInput = z.object({
  cfProjectId: z.number(),
  name: z.string().min(1),
  isDefault: z.boolean().default(false),
  salesStartMonthDelta: z.number().default(0),
  constructionDurationDelta: z.number().default(0),
  mobilizationPctOverride: z.number().nullable().optional(),
  buyerPlanBookingPct: z.number().nullable().optional(),
  buyerPlanConstructionPct: z.number().nullable().optional(),
  buyerPlanHandoverPct: z.number().nullable().optional(),
});

// ═══════════════════════════════════════════════════════════════
// tRPC Router
// ═══════════════════════════════════════════════════════════════

export const cashFlowProgramRouter = router({
  // --- Projects CRUD ---
  listProjects: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.user) return [];
    const db = await getDb();
    if (!db) return [];
    const projects = await db.select().from(cfProjects)
      .where(eq(cfProjects.userId, ctx.user.id))
      .orderBy(desc(cfProjects.updatedAt));
    
    // Enrich with cost item count and total cost
    const enriched = await Promise.all(projects.map(async (p) => {
      const items = await db.select().from(cfCostItems)
        .where(eq(cfCostItems.cfProjectId, p.id));
      const costItemCount = items.length;
      const totalCost = items.reduce((sum, i) => sum + (i.totalAmount || 0), 0);
      return { ...p, costItemCount, totalCost };
    }));
    return enriched;
  }),

  getProject: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.user) return null;
      const db = await getDb();
      if (!db) return null;
      const results = await db.select().from(cfProjects)
        .where(and(eq(cfProjects.id, input.id), eq(cfProjects.userId, ctx.user.id)));
      return results[0] || null;
    }),

  createProject: publicProcedure
    .input(cfProjectInput)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const result = await db.insert(cfProjects).values({
        userId: ctx.user.id,
        projectId: input.projectId ?? null,
        name: input.name,
        startDate: input.startDate,
        designApprovalMonths: input.designApprovalMonths,
        reraSetupMonths: input.reraSetupMonths,
        constructionMonths: input.constructionMonths,
        handoverMonths: input.handoverMonths,
        salesEnabled: input.salesEnabled,
        salesStartMonth: input.salesStartMonth ?? null,
        salesVelocityUnits: input.salesVelocityUnits ?? null,
        salesVelocityAed: input.salesVelocityAed ?? null,
        salesVelocityType: input.salesVelocityType,
        totalSalesRevenue: input.totalSalesRevenue ?? null,
        buyerPlanBookingPct: input.buyerPlanBookingPct.toString(),
        buyerPlanConstructionPct: input.buyerPlanConstructionPct.toString(),
        buyerPlanHandoverPct: input.buyerPlanHandoverPct.toString(),
        notes: input.notes ?? null,
      });
      return { id: Number(result[0].insertId) };
    }),

  updateProject: publicProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      startDate: z.string().optional(),
      designApprovalMonths: z.number().min(1).optional(),
      reraSetupMonths: z.number().min(0).optional(),
      preDevMonths: z.number().min(1).optional(),
      constructionMonths: z.number().min(1).optional(),
      handoverMonths: z.number().min(1).optional(),
      salesEnabled: z.boolean().optional(),
      salesStartMonth: z.number().nullable().optional(),
      salesVelocityUnits: z.number().nullable().optional(),
      salesVelocityAed: z.number().nullable().optional(),
      salesVelocityType: z.enum(['units', 'aed']).optional(),
      totalSalesRevenue: z.number().nullable().optional(),
      buyerPlanBookingPct: z.number().optional(),
      buyerPlanConstructionPct: z.number().optional(),
      buyerPlanHandoverPct: z.number().optional(),
      escrowDepositPct: z.number().optional(),
      contractorAdvancePct: z.number().optional(),
      liquidityBufferPct: z.number().optional(),
      constructionCostTotal: z.number().nullable().optional(),
      buaSqft: z.number().nullable().optional(),
      constructionCostPerSqft: z.number().nullable().optional(),
      notes: z.string().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const updateData: Record<string, any> = {};
      if (input.name !== undefined) updateData.name = input.name;
      if (input.startDate !== undefined) updateData.startDate = input.startDate;
      if (input.designApprovalMonths !== undefined) updateData.designApprovalMonths = input.designApprovalMonths;
      if (input.reraSetupMonths !== undefined) updateData.reraSetupMonths = input.reraSetupMonths;
      if (input.preDevMonths !== undefined) updateData.preDevMonths = input.preDevMonths;
      if (input.constructionMonths !== undefined) updateData.constructionMonths = input.constructionMonths;
      if (input.handoverMonths !== undefined) updateData.handoverMonths = input.handoverMonths;
      if (input.salesEnabled !== undefined) updateData.salesEnabled = input.salesEnabled;
      if (input.salesStartMonth !== undefined) updateData.salesStartMonth = input.salesStartMonth;
      if (input.salesVelocityUnits !== undefined) updateData.salesVelocityUnits = input.salesVelocityUnits;
      if (input.salesVelocityAed !== undefined) updateData.salesVelocityAed = input.salesVelocityAed;
      if (input.salesVelocityType !== undefined) updateData.salesVelocityType = input.salesVelocityType;
      if (input.totalSalesRevenue !== undefined) updateData.totalSalesRevenue = input.totalSalesRevenue;
      if (input.buyerPlanBookingPct !== undefined) updateData.buyerPlanBookingPct = input.buyerPlanBookingPct.toString();
      if (input.buyerPlanConstructionPct !== undefined) updateData.buyerPlanConstructionPct = input.buyerPlanConstructionPct.toString();
      if (input.buyerPlanHandoverPct !== undefined) updateData.buyerPlanHandoverPct = input.buyerPlanHandoverPct.toString();
      if (input.escrowDepositPct !== undefined) updateData.escrowDepositPct = input.escrowDepositPct.toString();
      if (input.contractorAdvancePct !== undefined) updateData.contractorAdvancePct = input.contractorAdvancePct.toString();
      if (input.liquidityBufferPct !== undefined) updateData.liquidityBufferPct = input.liquidityBufferPct.toString();
      if (input.constructionCostTotal !== undefined) updateData.constructionCostTotal = input.constructionCostTotal;
      if (input.buaSqft !== undefined) updateData.buaSqft = input.buaSqft;
      if (input.constructionCostPerSqft !== undefined) updateData.constructionCostPerSqft = input.constructionCostPerSqft;
      if (input.notes !== undefined) updateData.notes = input.notes;

      if (Object.keys(updateData).length > 0) {
        await db.update(cfProjects)
          .set(updateData)
          .where(and(eq(cfProjects.id, input.id), eq(cfProjects.userId, ctx.user.id)));
      }
      return { success: true };
    }),

  deleteProject: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.delete(cfProjects)
        .where(and(eq(cfProjects.id, input.id), eq(cfProjects.userId, ctx.user.id)));
      return { success: true };
    }),

  // --- Cost Items CRUD ---
  getCostItems: publicProcedure
    .input(z.object({ cfProjectId: z.number() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.user) return [];
      const db = await getDb();
      if (!db) return [];
      return db.select().from(cfCostItems)
        .where(eq(cfCostItems.cfProjectId, input.cfProjectId))
        .orderBy(cfCostItems.sortOrder);
    }),

  saveCostItem: publicProcedure
    .input(z.object({ id: z.number().optional() }).merge(cfCostItemInput))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const data = {
        cfProjectId: input.cfProjectId,
        name: input.name,
        category: input.category,
        totalAmount: input.totalAmount,
        paymentType: input.paymentType,
        paymentParams: input.paymentParams ? JSON.stringify(input.paymentParams) : null,
        phaseAllocation: input.phaseAllocation ? JSON.stringify(input.phaseAllocation) : null,
        sortOrder: input.sortOrder,
      };

      if (input.id) {
        await db.update(cfCostItems).set(data).where(eq(cfCostItems.id, input.id));
        return { id: input.id, updated: true };
      } else {
        const result = await db.insert(cfCostItems).values(data);
        return { id: Number(result[0].insertId), updated: false };
      }
    }),

  deleteCostItem: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.delete(cfCostItems).where(eq(cfCostItems.id, input.id));
      return { success: true };
    }),

  // --- Scenarios CRUD ---
  getScenarios: publicProcedure
    .input(z.number()) // cfProjectId
    .query(async ({ ctx, input }) => {
      if (!ctx.user) return [];
      const db = await getDb();
      if (!db) return [];
      return db.select().from(cfScenarios)
        .where(eq(cfScenarios.cfProjectId, input));
    }),

  saveScenario: publicProcedure
    .input(z.object({ id: z.number().optional() }).merge(cfScenarioInput))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const data = {
        cfProjectId: input.cfProjectId,
        name: input.name,
        isDefault: input.isDefault,
        salesStartMonthDelta: input.salesStartMonthDelta,
        constructionDurationDelta: input.constructionDurationDelta,
        mobilizationPctOverride: input.mobilizationPctOverride?.toString() ?? null,
        buyerPlanBookingPct: input.buyerPlanBookingPct?.toString() ?? null,
        buyerPlanConstructionPct: input.buyerPlanConstructionPct?.toString() ?? null,
        buyerPlanHandoverPct: input.buyerPlanHandoverPct?.toString() ?? null,
      };

      if (input.id) {
        await db.update(cfScenarios).set(data).where(eq(cfScenarios.id, input.id));
        return { id: input.id };
      } else {
        const result = await db.insert(cfScenarios).values(data);
        return { id: Number(result[0].insertId) };
      }
    }),

  deleteScenario: publicProcedure
    .input(z.number())
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.delete(cfScenarios).where(eq(cfScenarios.id, input));
      return { success: true };
    }),

  // --- Files CRUD ---
  getFiles: publicProcedure
    .input(z.number()) // cfProjectId
    .query(async ({ ctx, input }) => {
      if (!ctx.user) return [];
      const db = await getDb();
      if (!db) return [];
      return db.select().from(cfFiles)
        .where(eq(cfFiles.cfProjectId, input))
        .orderBy(desc(cfFiles.createdAt));
    }),

  deleteFile: publicProcedure
    .input(z.number())
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.delete(cfFiles).where(eq(cfFiles.id, input));
      return { success: true };
    }),

  // --- Cash Flow Calculation ---
  calculateCashFlow: publicProcedure
    .input(z.object({
      cfProjectId: z.number(),
      scenarioId: z.number().nullable().optional(),
    }))
    .query(async ({ ctx, input }) => {
      if (!ctx.user) return null;
      const db = await getDb();
      if (!db) return null;

      // Get project
      const projectResults = await db.select().from(cfProjects)
        .where(and(eq(cfProjects.id, input.cfProjectId), eq(cfProjects.userId, ctx.user.id)));
      const project = projectResults[0];
      if (!project) return null;

      // Get cost items
      const costItemsRaw = await db.select().from(cfCostItems)
        .where(eq(cfCostItems.cfProjectId, input.cfProjectId))
        .orderBy(cfCostItems.sortOrder);

      // Get scenario if specified
      let scenario: ScenarioAdjustments = {};
      if (input.scenarioId) {
        const scenarioResults = await db.select().from(cfScenarios)
          .where(eq(cfScenarios.id, input.scenarioId));
        const s = scenarioResults[0];
        if (s) {
          scenario = {
            salesStartMonthDelta: s.salesStartMonthDelta ?? 0,
            constructionDurationDelta: s.constructionDurationDelta ?? 0,
            mobilizationPctOverride: s.mobilizationPctOverride ? parseFloat(s.mobilizationPctOverride) : undefined,
            buyerPlanBookingPct: s.buyerPlanBookingPct ? parseFloat(s.buyerPlanBookingPct) : undefined,
            buyerPlanConstructionPct: s.buyerPlanConstructionPct ? parseFloat(s.buyerPlanConstructionPct) : undefined,
            buyerPlanHandoverPct: s.buyerPlanHandoverPct ? parseFloat(s.buyerPlanHandoverPct) : undefined,
          };
        }
      }

      // Use the new dual cash flow engine
      const projectInput: import('./cashFlowEngine').ProjectInput = {
        startDate: project.startDate,
        preDevMonths: project.preDevMonths || project.designApprovalMonths + project.reraSetupMonths,
        constructionMonths: project.constructionMonths + (scenario.constructionDurationDelta || 0),
        handoverMonths: project.handoverMonths,
        salesEnabled: !!project.salesEnabled,
        salesStartMonth: (project.salesStartMonth || 0) + (scenario.salesStartMonthDelta || 0),
        totalSalesRevenue: project.totalSalesRevenue || 0,
        buyerPlanBookingPct: scenario.buyerPlanBookingPct ?? parseFloat(project.buyerPlanBookingPct || '20'),
        buyerPlanConstructionPct: scenario.buyerPlanConstructionPct ?? parseFloat(project.buyerPlanConstructionPct || '30'),
        buyerPlanHandoverPct: scenario.buyerPlanHandoverPct ?? parseFloat(project.buyerPlanHandoverPct || '50'),
        escrowDepositPct: parseFloat(project.escrowDepositPct || '20'),
        contractorAdvancePct: parseFloat(project.contractorAdvancePct || '10'),
        liquidityBufferPct: parseFloat(project.liquidityBufferPct || '5'),
        constructionCostTotal: project.constructionCostTotal || null,
        buaSqft: project.buaSqft || null,
        constructionCostPerSqft: project.constructionCostPerSqft || null,
      };

      const costItemInputs: import('./cashFlowEngine').CostItemInput[] = costItemsRaw.map(item => ({
        id: item.id,
        name: item.name,
        category: item.category,
        totalAmount: item.totalAmount,
        paymentType: item.paymentType,
        paymentParams: item.paymentParams ? JSON.parse(item.paymentParams) : {},
        fundingSource: (item.fundingSource as 'developer' | 'escrow' | 'mixed') || 'developer',
        escrowEligible: !!item.escrowEligible,
        phaseTag: (item.phaseTag as 'pre_dev' | 'construction' | 'handover' | 'all') || 'pre_dev',
        phaseAllocation: item.phaseAllocation ? JSON.parse(item.phaseAllocation) : undefined,
      }));

      const result = calculateDualCashFlow(projectInput, costItemInputs);

      // Also build legacy-compatible arrays for backward compatibility
      const totalOutflow = result.monthlyTable.map(r => r.totalOutflow);
      const salesInflow = result.monthlyTable.map(r => r.escrowInflow);
      const cumulativeOutflow = result.monthlyTable.map(r => r.developerCumulative + r.escrowOutflow);
      const cumulativeInflow: number[] = [];
      let cumIn = 0;
      for (const row of result.monthlyTable) {
        cumIn += row.escrowInflow;
        cumulativeInflow.push(cumIn);
      }

      return {
        // New dual model
        dualCashFlow: result,
        // Legacy compatible
        phases: [
          { name: 'pre_dev', startMonth: result.phases.preDev.start, endMonth: result.phases.preDev.end, durationMonths: result.phases.preDev.months },
          { name: 'construction', startMonth: result.phases.construction.start, endMonth: result.phases.construction.end, durationMonths: result.phases.construction.months },
          { name: 'handover', startMonth: result.phases.handover.start, endMonth: result.phases.handover.end, durationMonths: result.phases.handover.months },
        ],
        totalMonths: result.totalMonths,
        monthLabels: result.monthLabels,
        totalOutflow,
        salesInflow,
        cumulativeOutflow,
        cumulativeInflow,
        netCashFlow: result.monthlyTable.map(r => r.netCashFlow),
        cumulativeNet: result.monthlyTable.map(r => r.cumulativeNet),
        keyNumbers: {
          totalCost: result.totalProjectCost,
          totalSales: result.totalSalesRevenue,
          peakExposure: result.developerMaxExposure,
          peakMonth: result.developerMaxExposureMonth,
          peakMonthLabel: result.developerMaxExposureLabel,
          netProfit: result.netProfit,
          roi: result.roi,
          // New fields
          developerCosts: result.developerCosts,
          escrowCosts: result.escrowCosts,
          constructionCost: result.constructionCost,
          fundingStructure: result.fundingStructure,
        },
      };
    }),

  // --- Portfolio View (Dual Engine) ---
  getPortfolioCashFlow: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.user) return null;
    const db = await getDb();
    if (!db) return null;

    const allProjects = await db.select().from(cfProjects)
      .where(eq(cfProjects.userId, ctx.user.id));

    if (allProjects.length === 0) return null;

    // Calculate cash flow for each project using dual engine
    const projectResults: Array<{
      id: number;
      name: string;
      startDate: string;
      totalCost: number;
      totalSales: number;
      developerExposure: number;
      escrowBalance: number;
      peakExposure: number;
      peakMonth: number;
      peakMonthLabel: string;
      totalMonths: number;
      phases: { preDev: number; construction: number; handover: number };
      monthlyDeveloperOutflow: number[];
      monthlyEscrowInflow: number[];
      monthlyEscrowOutflow: number[];
    }> = [];

    // Find the earliest start and latest end across all projects
    let globalStartYear = 9999, globalStartMonth = 12;
    let globalEndYear = 0, globalEndMonth = 0;

    for (const project of allProjects) {
      const [y, m] = project.startDate.split('-').map(Number);
      if (y < globalStartYear || (y === globalStartYear && m < globalStartMonth)) {
        globalStartYear = y;
        globalStartMonth = m;
      }

      const totalMonths = (project.preDevMonths || 6) + (project.constructionMonths || 16) + (project.handoverMonths || 2);
      const endMonth = m + totalMonths - 1;
      const endYear = y + Math.floor((endMonth - 1) / 12);
      const endMonthInYear = ((endMonth - 1) % 12) + 1;

      if (endYear > globalEndYear || (endYear === globalEndYear && endMonthInYear > globalEndMonth)) {
        globalEndYear = endYear;
        globalEndMonth = endMonthInYear;
      }
    }

    const totalGlobalMonths = (globalEndYear - globalStartYear) * 12 + (globalEndMonth - globalStartMonth + 1);
    const portfolioDeveloperOutflow = new Array(totalGlobalMonths).fill(0);
    const portfolioEscrowInflow = new Array(totalGlobalMonths).fill(0);
    const portfolioEscrowOutflow = new Array(totalGlobalMonths).fill(0);

    for (const project of allProjects) {
      const [projYear, projMonth] = project.startDate.split('-').map(Number);
      const offset = (projYear - globalStartYear) * 12 + (projMonth - globalStartMonth);

      const costItemsRaw = await db.select().from(cfCostItems)
        .where(eq(cfCostItems.cfProjectId, project.id));

      const costItems: CostItemInput[] = costItemsRaw.map(item => ({
        id: item.id,
        name: item.name,
        category: item.category,
        totalAmount: item.totalAmount,
        paymentType: item.paymentType,
        paymentParams: item.paymentParams ? JSON.parse(item.paymentParams) : {},
        fundingSource: (item.fundingSource as any) || 'developer',
        escrowEligible: item.escrowEligible ?? false,
        phaseTag: (item.phaseTag as any) || 'pre_dev',
      }));

      const projectInput: ProjectInput = {
        startDate: project.startDate,
        preDevMonths: project.preDevMonths || 6,
        constructionMonths: project.constructionMonths || 16,
        handoverMonths: project.handoverMonths || 2,
        salesEnabled: project.salesEnabled ?? true,
        salesStartMonth: project.salesStartMonth,
        totalSalesRevenue: project.totalSalesRevenue,
        buyerPlanBookingPct: project.buyerPlanBookingPct ?? 20,
        buyerPlanConstructionPct: project.buyerPlanConstructionPct ?? 50,
        buyerPlanHandoverPct: project.buyerPlanHandoverPct ?? 30,
        escrowDepositPct: project.escrowDepositPct ?? 20,
        contractorAdvancePct: project.contractorAdvancePct ?? 10,
        liquidityBufferPct: project.liquidityBufferPct ?? 5,
        constructionCostTotal: project.constructionCostTotal,
        buaSqft: project.buaSqft,
        constructionCostPerSqft: project.constructionCostPerSqft,
      };

      const result = calculateDualCashFlow(projectInput, costItems);

      // Map to portfolio timeline
      for (let m = 0; m < result.totalMonths; m++) {
        if (offset + m < totalGlobalMonths) {
          const row = result.monthlyTable[m];
          portfolioDeveloperOutflow[offset + m] += row.developerOutflow;
          portfolioEscrowInflow[offset + m] += row.escrowInflow;
          portfolioEscrowOutflow[offset + m] += row.escrowOutflow;
        }
      }

      projectResults.push({
        id: project.id,
        name: project.name,
        startDate: project.startDate,
        totalCost: result.totalProjectCost,
        totalSales: result.totalSalesRevenue,
        developerExposure: result.developerMaxExposure,
        escrowBalance: result.monthlyTable[result.totalMonths - 1]?.escrowBalance || 0,
        peakExposure: result.developerMaxExposure,
        peakMonth: result.developerMaxExposureMonth,
        peakMonthLabel: result.developerMaxExposureLabel,
        totalMonths: result.totalMonths,
        phases: {
          preDev: projectInput.preDevMonths,
          construction: projectInput.constructionMonths,
          handover: projectInput.handoverMonths,
        },
        monthlyDeveloperOutflow: result.monthlyTable.map(r => r.developerOutflow),
        monthlyEscrowInflow: result.monthlyTable.map(r => r.escrowInflow),
        monthlyEscrowOutflow: result.monthlyTable.map(r => r.escrowOutflow),
      });
    }

    // Calculate portfolio cumulative developer exposure
    const portfolioDeveloperCumulative: number[] = [];
    const portfolioEscrowBalance: number[] = [];
    let cumDev = 0, cumEscIn = 0, cumEscOut = 0;
    let portfolioPeakExposure = 0, portfolioPeakMonth = 0;
    for (let m = 0; m < totalGlobalMonths; m++) {
      cumDev += portfolioDeveloperOutflow[m];
      cumEscIn += portfolioEscrowInflow[m];
      cumEscOut += portfolioEscrowOutflow[m];
      portfolioDeveloperCumulative.push(cumDev);
      portfolioEscrowBalance.push(cumEscIn - cumEscOut);
      if (cumDev > portfolioPeakExposure) {
        portfolioPeakExposure = cumDev;
        portfolioPeakMonth = m + 1;
      }
    }

    // Generate month labels
    const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
    const monthLabels: string[] = [];
    for (let m = 0; m < totalGlobalMonths; m++) {
      const monthIdx = (globalStartMonth - 1 + m) % 12;
      const year = globalStartYear + Math.floor((globalStartMonth - 1 + m) / 12);
      monthLabels.push(`${monthNames[monthIdx]} ${year}`);
    }

    return {
      projects: projectResults,
      monthLabels,
      portfolioDeveloperOutflow,
      portfolioDeveloperCumulative,
      portfolioEscrowInflow,
      portfolioEscrowOutflow,
      portfolioEscrowBalance,
      portfolioPeakExposure,
      portfolioPeakMonth,
      portfolioPeakMonthLabel: monthLabels[portfolioPeakMonth - 1] || '',
      totalPortfolioCost: projectResults.reduce((s, p) => s + p.totalCost, 0),
      totalPortfolioSales: projectResults.reduce((s, p) => s + p.totalSales, 0),
      totalDeveloperExposure: portfolioPeakExposure,
    };
  }),

  // --- Create Project from Project Data (auto-import costs) ---
  createFromFeasibility: publicProcedure
    .input(z.object({
      projectId: z.number(),
      startDate: z.string(),
      designApprovalMonths: z.number().min(1).default(6),
      reraSetupMonths: z.number().min(1).default(3),
      constructionMonths: z.number().min(1).default(24),
      handoverMonths: z.number().min(1).default(3),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Get the project data (البطاقة التعريفية - المصدر الأساسي)
      const projResults = await db.select().from(projects).where(eq(projects.id, input.projectId));
      const proj = projResults[0];
      if (!proj) throw new Error("المشروع غير موجود");

      // Get costsCashFlow overrides (if user edited costs in the feasibility tab)
      const ccfResults = await db.select().from(costsCashFlow)
        .where(and(eq(costsCashFlow.projectId, input.projectId), eq(costsCashFlow.userId, ctx.user.id)));
      const ccf = ccfResults[0] || null;

      // Get competition pricing & market overview
      const cpResults = await db.select().from(competitionPricing).where(eq(competitionPricing.projectId, input.projectId));
      const cpData = cpResults[0] || null;
      const moResults = await db.select().from(marketOverview).where(eq(marketOverview.projectId, input.projectId));
      const moData = moResults[0] || null;

      // Helper: parse decimal string or number to float
      const pf = (v: any) => parseFloat(v || '0') || 0;

      // Calculate key values from project data
      const bua = pf(proj.manualBuaSqft) || pf(proj.bua);
      const plotAreaSqft = pf(proj.plotAreaSqft);
      const plotAreaM2 = plotAreaSqft * 0.0929;
      const constructionPricePerSqft = ccf ? (ccf.constructionCostPerSqft || 0) : pf(proj.estimatedConstructionPricePerSqft);
      const constructionCost = bua * constructionPricePerSqft;

      // GFA from project
      const gfaResSqft = pf(proj.gfaResidentialSqft);
      const gfaRetSqft = pf(proj.gfaRetailSqft);
      const gfaOffSqft = pf(proj.gfaOfficesSqft);
      const saleableRes = gfaResSqft * 0.95;
      const saleableRet = gfaRetSqft * 0.97;
      const saleableOff = gfaOffSqft * 0.95;

      // Helper: get avg area with DEFAULT_AVG_AREAS fallback
      const getAvg = (pctKey: string, avgVal: number | null | undefined): number => {
        const v = avgVal || 0;
        if (v > 0) return v;
        const mapping = DEFAULT_AVG_AREAS[pctKey];
        return mapping ? mapping.defaultArea : 0;
      };

      // Calculate total revenue using competition pricing + market overview data
      let totalRevenue = 0;
      let totalUnits = 0;
      if (cpData && moData) {
        const activeScenario = cpData.activeScenario || 'base';
        const getPrices = () => {
          if (activeScenario === 'optimistic') return {
            studio: cpData.optStudioPrice || 0, oneBr: cpData.opt1brPrice || 0, twoBr: cpData.opt2brPrice || 0, threeBr: cpData.opt3brPrice || 0,
            retailSmall: cpData.optRetailSmallPrice || 0, retailMedium: cpData.optRetailMediumPrice || 0, retailLarge: cpData.optRetailLargePrice || 0,
            officeSmall: cpData.optOfficeSmallPrice || 0, officeMedium: cpData.optOfficeMediumPrice || 0, officeLarge: cpData.optOfficeLargePrice || 0,
          };
          if (activeScenario === 'conservative') return {
            studio: cpData.consStudioPrice || 0, oneBr: cpData.cons1brPrice || 0, twoBr: cpData.cons2brPrice || 0, threeBr: cpData.cons3brPrice || 0,
            retailSmall: cpData.consRetailSmallPrice || 0, retailMedium: cpData.consRetailMediumPrice || 0, retailLarge: cpData.consRetailLargePrice || 0,
            officeSmall: cpData.consOfficeSmallPrice || 0, officeMedium: cpData.consOfficeMediumPrice || 0, officeLarge: cpData.consOfficeLargePrice || 0,
          };
          return {
            studio: cpData.baseStudioPrice || 0, oneBr: cpData.base1brPrice || 0, twoBr: cpData.base2brPrice || 0, threeBr: cpData.base3brPrice || 0,
            retailSmall: cpData.baseRetailSmallPrice || 0, retailMedium: cpData.baseRetailMediumPrice || 0, retailLarge: cpData.baseRetailLargePrice || 0,
            officeSmall: cpData.baseOfficeSmallPrice || 0, officeMedium: cpData.baseOfficeMediumPrice || 0, officeLarge: cpData.baseOfficeLargePrice || 0,
          };
        };
        const prices = getPrices();

        const calcTypeRevenue = (pct: number, avgArea: number, pricePerSqft: number, saleable: number) => {
          const allocated = saleable * (pct / 100);
          const units = avgArea > 0 ? Math.floor(allocated / avgArea) : 0;
          totalUnits += units;
          return avgArea * pricePerSqft * units;
        };

        totalRevenue += calcTypeRevenue(pf(moData.residentialStudioPct), getAvg('residentialStudioPct', moData.residentialStudioAvgArea), prices.studio, saleableRes);
        totalRevenue += calcTypeRevenue(pf(moData.residential1brPct), getAvg('residential1brPct', moData.residential1brAvgArea), prices.oneBr, saleableRes);
        totalRevenue += calcTypeRevenue(pf(moData.residential2brPct), getAvg('residential2brPct', moData.residential2brAvgArea), prices.twoBr, saleableRes);
        totalRevenue += calcTypeRevenue(pf(moData.residential3brPct), getAvg('residential3brPct', moData.residential3brAvgArea), prices.threeBr, saleableRes);
        totalRevenue += calcTypeRevenue(pf(moData.retailSmallPct), getAvg('retailSmallPct', moData.retailSmallAvgArea), prices.retailSmall, saleableRet);
        totalRevenue += calcTypeRevenue(pf(moData.retailMediumPct), getAvg('retailMediumPct', moData.retailMediumAvgArea), prices.retailMedium, saleableRet);
        totalRevenue += calcTypeRevenue(pf(moData.retailLargePct), getAvg('retailLargePct', moData.retailLargeAvgArea), prices.retailLarge, saleableRet);
        totalRevenue += calcTypeRevenue(pf(moData.officeSmallPct), getAvg('officeSmallPct', moData.officeSmallAvgArea), prices.officeSmall, saleableOff);
        totalRevenue += calcTypeRevenue(pf(moData.officeMediumPct), getAvg('officeMediumPct', moData.officeMediumAvgArea), prices.officeMedium, saleableOff);
        totalRevenue += calcTypeRevenue(pf(moData.officeLargePct), getAvg('officeLargePct', moData.officeLargeAvgArea), prices.officeLarge, saleableOff);
      }

      // Cost source values - prefer costsCashFlow overrides, then project data
      const landPrice = ccf ? (ccf.landPrice || 0) : pf(proj.landPrice);
      const agentCommissionLandPct = ccf ? pf(ccf.agentCommissionLandPct) || 1 : pf(proj.agentCommissionLandPct) || 1;
      const soilTestFee = ccf ? (ccf.soilInvestigation || 0) : pf(proj.soilTestFee);
      const topographicSurveyFee = ccf ? (ccf.topographySurvey || 0) : pf(proj.topographicSurveyFee);
      const officialBodiesFees = ccf ? (ccf.authoritiesFee || 0) : pf(proj.officialBodiesFees);
      const designFeePct = ccf ? pf(ccf.designFeePct) || 2 : pf(proj.designFeePct) || 2;
      const supervisionFeePct = ccf ? pf(ccf.supervisionFeePct) || 2 : pf(proj.supervisionFeePct) || 2;
      const separationFeePerSqft = ccf ? (ccf.separationFeePerM2 || 40) : pf(proj.separationFeePerM2) || 40;
      const totalGfaSqft = gfaResSqft + gfaRetSqft + gfaOffSqft;
      const salesCommissionPct = ccf ? pf(ccf.agentCommissionSalePct) || 5 : pf(proj.salesCommissionPct) || 5;
      const marketingPct = ccf ? pf(ccf.marketingPct) || 2 : pf(proj.marketingPct) || 2;
      const developerFeePct = ccf ? pf(ccf.developerFeePct) || 5 : pf(proj.developerFeePct) || 5;
      const contingenciesPct = ccf ? pf(ccf.contingenciesPct) || 2 : 2;

      // Regulatory fees - prefer costsCashFlow overrides, then project data
      const reraUnitRegFee = ccf ? (ccf.reraUnitFee || 0) * totalUnits : pf(proj.reraUnitRegFee);
      const reraProjectRegFee = ccf ? (ccf.reraOffplanFee || 0) : pf(proj.reraProjectRegFee);
      const developerNocFee = ccf ? (ccf.nocFee || 0) : pf(proj.developerNocFee);
      const escrowAccountFee = ccf ? (ccf.escrowFee || 0) : pf(proj.escrowAccountFee);
      const bankFees = ccf ? (ccf.bankCharges || 0) : pf(proj.bankFees);
      const surveyorFees = ccf ? (ccf.surveyorFees || 0) : pf(proj.surveyorFees);
      const reraAuditReportFee = ccf ? (ccf.reraAuditFees || 0) : pf(proj.reraAuditReportFee);
      const reraInspectionReportFee = ccf ? (ccf.reraInspectionFees || 0) : pf(proj.reraInspectionReportFee);
      const communityFees = ccf ? (ccf.communityFee || 0) : pf(proj.communityFees);

      // Create the CF project
      const projectResult = await db.insert(cfProjects).values({
        userId: ctx.user.id,
        projectId: input.projectId,
        name: proj.name,
        startDate: input.startDate,
        designApprovalMonths: input.designApprovalMonths,
        reraSetupMonths: input.reraSetupMonths,
        constructionMonths: input.constructionMonths,
        handoverMonths: input.handoverMonths,
        salesEnabled: totalRevenue > 0,
        salesStartMonth: input.designApprovalMonths + input.reraSetupMonths + 1,
        totalSalesRevenue: Math.round(totalRevenue) || null,
        buyerPlanBookingPct: "20",
        buyerPlanConstructionPct: "30",
        buyerPlanHandoverPct: "50",
        notes: `مستورد من بطاقة المشروع: ${proj.name}`,
      });
      const cfProjectId = Number(projectResult[0].insertId);

      // Build cost items
      const costItemsToInsert: Array<{
        cfProjectId: number;
        name: string;
        category: 'land' | 'land_registration' | 'development_setup' | 'design_engineering' | 'consultants' | 'authority_fees' | 'contractor' | 'marketing_sales' | 'administration' | 'developer_fee' | 'contingency' | 'other';
        totalAmount: number;
        paymentType: 'lump_sum' | 'milestone' | 'monthly_fixed' | 'progress_based' | 'sales_linked';
        paymentParams: string;
        sortOrder: number;
        fundingSource: 'developer' | 'escrow' | 'mixed';
        escrowEligible: number;
        phaseTag: 'pre_dev' | 'construction' | 'handover' | 'all';
      }> = [];
      let sortOrder = 0;

      // 1. Land — Developer funds, pre-dev phase
      if (landPrice > 0) {
        costItemsToInsert.push({
          cfProjectId,
          name: 'سعر الأرض',
          category: 'land',
          totalAmount: Math.round(landPrice),
          paymentType: 'lump_sum',
          paymentParams: JSON.stringify({ paymentMonth: 1 }),
          sortOrder: sortOrder++,
          fundingSource: 'developer',
          escrowEligible: 0,
          phaseTag: 'pre_dev',
        });
        const agentComm = landPrice * (agentCommissionLandPct / 100);
        if (agentComm > 0) {
          costItemsToInsert.push({
            cfProjectId,
            name: 'عمولة وسيط الأرض',
            category: 'land',
            totalAmount: Math.round(agentComm),
            paymentType: 'lump_sum',
            paymentParams: JSON.stringify({ paymentMonth: 1 }),
            sortOrder: sortOrder++,
            fundingSource: 'developer',
            escrowEligible: 0,
            phaseTag: 'pre_dev',
          });
        }

        // Land registration fee (4%)
        const landRegFee = landPrice * 0.04;
        if (landRegFee > 0) {
          costItemsToInsert.push({
            cfProjectId,
            name: 'رسوم تسجيل الأرض (4%)',
            category: 'authority_fees',
            totalAmount: Math.round(landRegFee),
            paymentType: 'lump_sum',
            paymentParams: JSON.stringify({ paymentMonth: 1 }),
            sortOrder: sortOrder++,
            fundingSource: 'developer',
            escrowEligible: 0,
            phaseTag: 'pre_dev',
          });
        }
      }

      // 2. Design Fee — Developer funds, pre-dev phase
      const designFee = constructionCost * (designFeePct / 100);
      if (designFee > 0) {
        costItemsToInsert.push({
          cfProjectId,
          name: 'أتعاب التصميم',
          category: 'design_engineering',
          totalAmount: Math.round(designFee),
          paymentType: 'milestone',
          paymentParams: JSON.stringify({
            milestones: [
              { percent: 20, description: 'توقيع العقد', monthOffset: 1 },
              { percent: 20, description: 'إنهاء المفهوم', monthOffset: 2 },
              { percent: 25, description: 'التصميم التفصيلي', monthOffset: 4 },
              { percent: 20, description: 'حزمة المناقصة', monthOffset: 5 },
              { percent: 15, description: 'رخصة البناء', monthOffset: 6 },
            ],
          }),
          sortOrder: sortOrder++,
          fundingSource: 'developer',
          escrowEligible: 0,
          phaseTag: 'pre_dev',
        });
      }

      // 3. Official bodies fees — Developer funds, pre-dev phase
      if (officialBodiesFees > 0) {
        costItemsToInsert.push({
          cfProjectId,
          name: 'رسوم الجهات الرسمية',
          category: 'authority_fees',
          totalAmount: Math.round(officialBodiesFees),
          paymentType: 'lump_sum',
          paymentParams: JSON.stringify({ paymentMonth: input.designApprovalMonths }),
          sortOrder: sortOrder++,
          fundingSource: 'developer',
          escrowEligible: 0,
          phaseTag: 'pre_dev',
        });
      }

      // 4. Soil test — Developer funds, pre-dev phase
      if (soilTestFee > 0) {
        costItemsToInsert.push({
          cfProjectId,
          name: 'فحص التربة',
          category: 'authority_fees',
          totalAmount: Math.round(soilTestFee),
          paymentType: 'lump_sum',
          paymentParams: JSON.stringify({ paymentMonth: 1 }),
          sortOrder: sortOrder++,
          fundingSource: 'developer',
          escrowEligible: 0,
          phaseTag: 'pre_dev',
        });
      }

      // 5. Topography survey — Developer funds, pre-dev phase
      if (topographicSurveyFee > 0) {
        costItemsToInsert.push({
          cfProjectId,
          name: 'المسح الطبوغرافي',
          category: 'authority_fees',
          totalAmount: Math.round(topographicSurveyFee),
          paymentType: 'lump_sum',
          paymentParams: JSON.stringify({ paymentMonth: 1 }),
          sortOrder: sortOrder++,
          fundingSource: 'developer',
          escrowEligible: 0,
          phaseTag: 'pre_dev',
        });
      }

      // 6. Construction (Main Contractor) — Mixed: 35% developer + 65% escrow
      if (constructionCost > 0) {
        costItemsToInsert.push({
          cfProjectId,
          name: 'تكلفة البناء',
          category: 'contractor',
          totalAmount: Math.round(constructionCost),
          paymentType: 'progress_based',
          paymentParams: JSON.stringify({
            mobilizationPct: 10,
            progressDistribution: 'scurve',
            retentionPct: 5,
          }),
          sortOrder: sortOrder++,
          fundingSource: 'mixed',
          escrowEligible: 1,
          phaseTag: 'construction',
        });
      }

      // 7. Supervision — Escrow eligible, construction phase
      const supervisionFee = constructionCost * (supervisionFeePct / 100);
      if (supervisionFee > 0) {
        costItemsToInsert.push({
          cfProjectId,
          name: 'أتعاب الإشراف',
          category: 'consultants',
          totalAmount: Math.round(supervisionFee),
          paymentType: 'monthly_fixed',
          paymentParams: JSON.stringify({}),
          sortOrder: sortOrder++,
          fundingSource: 'escrow',
          escrowEligible: 1,
          phaseTag: 'construction',
        });
      }

      // 8. Marketing — Escrow eligible, construction phase
      const marketing = totalRevenue * (marketingPct / 100);
      if (marketing > 0) {
        costItemsToInsert.push({
          cfProjectId,
          name: 'التسويق',
          category: 'marketing_sales',
          totalAmount: Math.round(marketing),
          paymentType: 'sales_linked',
          paymentParams: JSON.stringify({ salesPct: 100, salesTiming: 'construction' }),
          sortOrder: sortOrder++,
          fundingSource: 'escrow',
          escrowEligible: 1,
          phaseTag: 'construction',
        });
      }

      // 9. Agent commission on sales — Escrow eligible, construction phase
      const agentSales = totalRevenue * (salesCommissionPct / 100);
      if (agentSales > 0) {
        costItemsToInsert.push({
          cfProjectId,
          name: 'عمولة البيع',
          category: 'marketing_sales',
          totalAmount: Math.round(agentSales),
          paymentType: 'sales_linked',
          paymentParams: JSON.stringify({ salesPct: 100, salesTiming: 'booking' }),
          sortOrder: sortOrder++,
          fundingSource: 'escrow',
          escrowEligible: 1,
          phaseTag: 'construction',
        });
      }

      // 10. Developer fee — Developer funds (not escrow eligible), spans all phases
      const developerFee = totalRevenue * (developerFeePct / 100);
      if (developerFee > 0) {
        costItemsToInsert.push({
          cfProjectId,
          name: 'أتعاب المطور',
          category: 'developer_fee',
          totalAmount: Math.round(developerFee),
          paymentType: 'monthly_fixed',
          paymentParams: JSON.stringify({}),
          sortOrder: sortOrder++,
          fundingSource: 'developer',
          escrowEligible: 0,
          phaseTag: 'all',
        });
      }

      // 11. Contingency — Developer funds, construction phase
      const contingency = constructionCost * (contingenciesPct / 100);
      if (contingency > 0) {
        costItemsToInsert.push({
          cfProjectId,
          name: 'احتياطي',
          category: 'contingency',
          totalAmount: Math.round(contingency),
          paymentType: 'monthly_fixed',
          paymentParams: JSON.stringify({}),
          sortOrder: sortOrder++,
          fundingSource: 'developer',
          escrowEligible: 0,
          phaseTag: 'construction',
        });
      }

      // 12. RERA & regulatory fees — Developer funds, pre-dev phase (separate items)
      const regPayMonth = input.designApprovalMonths + 1;
      const regItems: Array<{ name: string; amount: number }> = [
        { name: 'رسوم تسجيل الوحدات — ريرا', amount: reraUnitRegFee },
        { name: 'رسوم تسجيل المشروع — ريرا', amount: reraProjectRegFee },
        { name: 'رسوم عدم ممانعة — المطور', amount: developerNocFee },
        { name: 'حساب الضمان (Escrow)', amount: escrowAccountFee },
        { name: 'الرسوم البنكية', amount: bankFees },
        { name: 'أتعاب المسّاح', amount: surveyorFees },
        { name: 'تدقيق ريرا', amount: reraAuditReportFee },
        { name: 'تفتيش ريرا', amount: reraInspectionReportFee },
      ];
      for (const ri of regItems) {
        if (ri.amount > 0) {
          costItemsToInsert.push({
            cfProjectId,
            name: ri.name,
            category: 'authority_fees',
            totalAmount: Math.round(ri.amount),
            paymentType: 'lump_sum',
            paymentParams: JSON.stringify({ paymentMonth: regPayMonth }),
            sortOrder: sortOrder++,
            fundingSource: 'developer',
            escrowEligible: 0,
            phaseTag: 'pre_dev',
          });
        }
      }

      // 13. Separation fee — Developer funds, pre-dev phase
      const separationFee = totalGfaSqft * separationFeePerSqft;
      if (separationFee > 0) {
        costItemsToInsert.push({
          cfProjectId,
          name: 'رسوم الفرز',
          category: 'authority_fees',
          totalAmount: Math.round(separationFee),
          paymentType: 'lump_sum',
          paymentParams: JSON.stringify({ paymentMonth: 2 }),
          sortOrder: sortOrder++,
          fundingSource: 'developer',
          escrowEligible: 0,
          phaseTag: 'pre_dev',
        });
      }

      // 14. Community fee — Developer funds, pre-dev phase
      const commFee = communityFees;
      if (commFee > 0) {
        costItemsToInsert.push({
          cfProjectId,
          name: 'رسوم المجتمع',
          category: 'other',
          totalAmount: Math.round(commFee),
          paymentType: 'lump_sum',
          paymentParams: JSON.stringify({ paymentMonth: input.designApprovalMonths }),
          sortOrder: sortOrder++,
          fundingSource: 'developer',
          escrowEligible: 0,
          phaseTag: 'pre_dev',
        });
      }

      // Insert all cost items in batch
      if (costItemsToInsert.length > 0) {
        for (const item of costItemsToInsert) {
          await db.insert(cfCostItems).values(item);
        }
      }

      return {
        cfProjectId,
        projectName: proj.name,
        costItemsCount: costItemsToInsert.length,
        totalCost: costItemsToInsert.reduce((s, i) => s + i.totalAmount, 0),
        totalRevenue: Math.round(totalRevenue),
      };
    }),

    // --- Import from Project (preview only) ---
  importFromFeasibility: publicProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.user) return null;
      const db = await getDb();
      if (!db) return null;
      // Get project data (البطاقة التعريفية)
      const projResults = await db.select().from(projects)
        .where(eq(projects.id, input.projectId));
      const proj = projResults[0];
      if (!proj) return null;
      // Get costsCashFlow overrides
      const ccfResults = await db.select().from(costsCashFlow)
        .where(and(eq(costsCashFlow.projectId, input.projectId), eq(costsCashFlow.userId, ctx.user.id)));
      const ccf = ccfResults[0] || null;
      // Get MO+CP data
      const moResults = await db.select().from(marketOverview).where(eq(marketOverview.projectId, input.projectId));
      const moData = moResults[0] || null;
      const cpResults = await db.select().from(competitionPricing).where(eq(competitionPricing.projectId, input.projectId));
      const cpData = cpResults[0] || null;
      const pf = (v: any) => parseFloat(v || '0') || 0;
      const bua = pf(proj.manualBuaSqft) || pf(proj.bua);
      const plotAreaSqft = pf(proj.plotAreaSqft);
      const plotAreaM2 = plotAreaSqft * 0.0929;
      const constructionPricePerSqft = ccf ? (ccf.constructionCostPerSqft || 0) : pf(proj.estimatedConstructionPricePerSqft);
      const constructionCost = bua * constructionPricePerSqft;
      const totalUnits = moData ? Math.round(pf(moData.totalUnitsEstimate)) : 0;
      // Build cost items from project dataty
      const costItems: Array<{
        name: string;
        category: string;
        totalAmount: number;
        paymentType: string;
        paymentParams: any;
      }> = [];
      // Land
      const landPrice = ccf ? (ccf.landPrice || 0) : pf(proj.landPrice);
      const agentCommLandPct = ccf ? pf(ccf.agentCommissionLandPct) || 1 : pf(proj.agentCommissionLandPct) || 1;
      if (landPrice) {
        costItems.push({
          name: 'ثمن الأرض',
          category: 'land',
          totalAmount: landPrice,
          paymentType: 'lump_sum',
          paymentParams: { paymentMonth: 1 },
        });
        const agentComm = landPrice * (agentCommLandPct / 100);
        if (agentComm > 0) {
          costItems.push({
            name: 'عمولة وسيط الأرض',
            category: 'land',
            totalAmount: Math.round(agentComm),
            paymentType: 'lump_sum',
            paymentParams: { paymentMonth: 1 },
          });
        }
      }
      // Design fee
      const designFeePct = ccf ? pf(ccf.designFeePct) || 2 : pf(proj.designFeePct) || 2;
      const designFee = constructionCost * (designFeePct / 100);
      if (designFee > 0) {
        costItems.push({
          name: 'رسوم التصميم',
          category: 'consultants',
          totalAmount: Math.round(designFee),
          paymentType: 'lump_sum',
          paymentParams: { paymentMonth: 3 },
        });
      }
      // Authorities fee
      const authFee = ccf ? (ccf.authoritiesFee || 0) : pf(proj.officialBodiesFees);
      if (authFee) {
        costItems.push({
          name: 'رسوم الجهات الرسمية',
          category: 'authority_fees',
          totalAmount: authFee,
          paymentType: 'lump_sum',
          paymentParams: { paymentMonth: 5 },
        });
      }
      // Soil investigation
      const soilFee = ccf ? (ccf.soilInvestigation || 0) : pf(proj.soilTestFee);
      if (soilFee) {
        costItems.push({
          name: 'فحص التربة',
          category: 'authority_fees',
          totalAmount: soilFee,
          paymentType: 'lump_sum',
          paymentParams: { paymentMonth: 1 },
        });
      }
      // Topography survey
      const topoFee = ccf ? (ccf.topographySurvey || 0) : pf(proj.topographicSurveyFee);
      if (topoFee) {
        costItems.push({
          name: 'المسح الطبوغرافي',
          category: 'authority_fees',
          totalAmount: topoFee,
          paymentType: 'lump_sum',
          paymentParams: { paymentMonth: 1 },
        });
      }
      // Construction (Main Contractor)
      if (constructionCost > 0) {
        costItems.push({
          name: 'تكلفة البناء',
          category: 'contractor',
          totalAmount: Math.round(constructionCost),
          paymentType: 'progress_based',
          paymentParams: {
            mobilizationPct: 10,
            progressDistribution: 'scurve',
            retentionPct: 5,
          },
        });
      }
      // Supervision
      const supervisionPct = ccf ? pf(ccf.supervisionFeePct) || 2 : pf(proj.supervisionFeePct) || 2;
      const supervisionFee = constructionCost * (supervisionPct / 100);
      if (supervisionFee > 0) {
        costItems.push({
          name: 'أتعاب الإشراف',
          category: 'consultants',
          totalAmount: Math.round(supervisionFee),
          paymentType: 'monthly_fixed',
          paymentParams: {},
        });
      }
      // Marketing - calculate revenue from MO+CP data
      let totalRevenue = 0;
      if (cpData && moData) {
        const gfaRes = pf(proj.gfaResidentialSqft), gfaRet = pf(proj.gfaRetailSqft), gfaOff = pf(proj.gfaOfficesSqft);
        const sRes = gfaRes * 0.95, sRet = gfaRet * 0.97, sOff = gfaOff * 0.95;
        const pr = { s: cpData.baseStudioPrice||0, o: cpData.base1brPrice||0, t: cpData.base2brPrice||0, th: cpData.base3brPrice||0, rs: cpData.baseRetailSmallPrice||0, rm: cpData.baseRetailMediumPrice||0, rl: cpData.baseRetailLargePrice||0, os: cpData.baseOfficeSmallPrice||0, om: cpData.baseOfficeMediumPrice||0, ol: cpData.baseOfficeLargePrice||0 };
        const ga = (k: string, v: any) => { const n = v||0; if(n>0) return n; const m = DEFAULT_AVG_AREAS[k]; return m ? m.defaultArea : 0; };
        const c = (p: number, a: number, pr2: number, s: number) => { const al = s*(p/100); const u = a>0 ? Math.floor(al/a) : 0; return a*pr2*u; };
        totalRevenue += c(pf(moData.residentialStudioPct), ga('residentialStudioPct', moData.residentialStudioAvgArea), pr.s, sRes);
        totalRevenue += c(pf(moData.residential1brPct), ga('residential1brPct', moData.residential1brAvgArea), pr.o, sRes);
        totalRevenue += c(pf(moData.residential2brPct), ga('residential2brPct', moData.residential2brAvgArea), pr.t, sRes);
        totalRevenue += c(pf(moData.residential3brPct), ga('residential3brPct', moData.residential3brAvgArea), pr.th, sRes);
        totalRevenue += c(pf(moData.retailSmallPct), ga('retailSmallPct', moData.retailSmallAvgArea), pr.rs, sRet);
        totalRevenue += c(pf(moData.retailMediumPct), ga('retailMediumPct', moData.retailMediumAvgArea), pr.rm, sRet);
        totalRevenue += c(pf(moData.retailLargePct), ga('retailLargePct', moData.retailLargeAvgArea), pr.rl, sRet);
        totalRevenue += c(pf(moData.officeSmallPct), ga('officeSmallPct', moData.officeSmallAvgArea), pr.os, sOff);
        totalRevenue += c(pf(moData.officeMediumPct), ga('officeMediumPct', moData.officeMediumAvgArea), pr.om, sOff);
        totalRevenue += c(pf(moData.officeLargePct), ga('officeLargePct', moData.officeLargeAvgArea), pr.ol, sOff);
      }
      const mktPct = ccf ? pf(ccf.marketingPct) || 2 : pf(proj.marketingPct) || 2;
      const marketing = totalRevenue * (mktPct / 100);
      if (marketing > 0) {
        costItems.push({
          name: 'التسويق',
          category: 'marketing_sales',
          totalAmount: Math.round(marketing),
          paymentType: 'sales_linked',
          paymentParams: { salesPct: 100, salesTiming: 'construction' },
        });
      }
      // Agent commission on sales
      const salesCommPct = ccf ? pf(ccf.agentCommissionSalePct) || 5 : pf(proj.salesCommissionPct) || 5;
      const agentSales = totalRevenue * (salesCommPct / 100);
      if (agentSales > 0) {
        costItems.push({
          name: 'عمولة البيع',
          category: 'marketing_sales',
          totalAmount: Math.round(agentSales),
          paymentType: 'sales_linked',
          paymentParams: { salesPct: 100, salesTiming: 'booking' },
        });
      }
      // Developer fee
      const devFeePct = ccf ? pf(ccf.developerFeePct) || 5 : pf(proj.developerFeePct) || 5;
      const developerFee = totalRevenue * (devFeePct / 100);
      if (developerFee > 0) {
        costItems.push({
          name: 'أتعاب المطور',
          category: 'developer_fee',
          totalAmount: Math.round(developerFee),
          paymentType: 'monthly_fixed',
          paymentParams: {},
        });
      }
      // Contingency
      const contPct = ccf ? pf(ccf.contingenciesPct) || 2 : 2;
      const contingency = constructionCost * (contPct / 100);
      if (contingency > 0) {
        costItems.push({
          name: 'احتياطي',
          category: 'contingency',
          totalAmount: Math.round(contingency),
          paymentType: 'monthly_fixed',
          paymentParams: {},
        });
      }
      // RERA & regulatory fees
      const reraFees = (ccf ? (ccf.reraOffplanFee||0) : pf(proj.reraProjectRegFee)) +
        (totalUnits * (ccf ? (ccf.reraUnitFee||0) : 850)) +
        (ccf ? (ccf.nocFee||0) : pf(proj.developerNocFee)) + (ccf ? (ccf.escrowFee||0) : pf(proj.escrowAccountFee)) +
        (ccf ? (ccf.bankCharges||0) : pf(proj.bankFees)) + (ccf ? (ccf.surveyorFees||0) : pf(proj.surveyorFees)) +
        (ccf ? (ccf.reraAuditFees||0) : pf(proj.reraAuditReportFee)) + (ccf ? (ccf.reraInspectionFees||0) : pf(proj.reraInspectionReportFee));
      if (reraFees > 0) {
        costItems.push({
          name: 'رسوم تنظيمية (ريرا وأخرى)',
          category: 'authority_fees',
          totalAmount: Math.round(reraFees),
          paymentType: 'lump_sum',
          paymentParams: { paymentMonth: 7 },
        });
      }
      // Separation fee
      const sepFeePerSqft = ccf ? (ccf.separationFeePerM2 || 40) : pf(proj.separationFeePerM2) || 40;
      const totalGfaSqftB = pf(proj.gfaResidentialSqft) + pf(proj.gfaRetailSqft) + pf(proj.gfaOfficesSqft);
      const separationFee = totalGfaSqftB * sepFeePerSqft;
      if (separationFee > 0) {
        costItems.push({
          name: 'رسوم الفرز',
          category: 'authority_fees',
          totalAmount: Math.round(separationFee),
          paymentType: 'lump_sum',
          paymentParams: { paymentMonth: 8 },
        });
      }
      // Community fee
      const commFee = ccf ? (ccf.communityFee || 0) : pf(proj.communityFees);
      if (commFee) {
        costItems.push({
          name: 'رسوم المجتمع',
          category: 'other',
          totalAmount: commFee,
          paymentType: 'lump_sum',
          paymentParams: { paymentMonth: 6 },
        });
      }
      return {
        projectName: proj.name,
        totalRevenue: Math.round(totalRevenue),
        costItems,
      };
    }),
  // --- Flexible Phases Management ----
  listPhases: publicProcedure
    .input(z.number())
    .query(async ({ ctx, input: cfProjectId }) => {
      if (!ctx.user) return [];
      const db = await getDb();
      if (!db) return [];
      
      const projectResults = await db.select().from(cfProjects)
        .where(and(eq(cfProjects.id, cfProjectId), eq(cfProjects.userId, ctx.user.id)));
      if (!projectResults[0]) return [];
      
      const phases = await db.select().from(projectPhases)
        .where(eq(projectPhases.projectId, cfProjectId))
        .orderBy(projectPhases.phaseNumber);
      return phases;
    }),

  createPhase: publicProcedure
    .input(z.object({
      cfProjectId: z.number(),
      phaseName: z.string(),
      startDate: z.string(),
      durationMonths: z.number().min(1),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      // Verify project ownership
      const projectResults = await db.select().from(cfProjects)
        .where(and(eq(cfProjects.id, input.cfProjectId), eq(cfProjects.userId, ctx.user.id)));
      if (!projectResults[0]) throw new Error("Project not found");
      
      // Get max phase number
      const maxPhaseResult = await db.select({ maxNum: projectPhases.phaseNumber })
        .from(projectPhases)
        .where(eq(projectPhases.projectId, input.cfProjectId))
        .orderBy(desc(projectPhases.phaseNumber))
        .limit(1);
      const phaseNumber = (maxPhaseResult[0]?.maxNum || 0) + 1;
      
      // Calculate end date
      const [startYear, startMonth] = input.startDate.split('-').map(Number);
      let endMonth = startMonth + input.durationMonths - 1;
      let endYear = startYear;
      while (endMonth > 12) {
        endMonth -= 12;
        endYear++;
      }
      const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}`;
      
      const result = await db.insert(projectPhases).values({
        projectId: input.cfProjectId,
        phaseNumber,
        phaseName: input.phaseName,
        startDate: input.startDate,
        durationMonths: input.durationMonths,
        endDate,
        notes: input.notes || null,
      });
      
      return { id: Number(result[0].insertId), phaseNumber, endDate };
    }),

  updatePhase: publicProcedure
    .input(z.object({
      phaseId: z.number(),
      phaseName: z.string().optional(),
      startDate: z.string().optional(),
      durationMonths: z.number().min(1).optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const phaseResults = await db.select().from(projectPhases)
        .where(eq(projectPhases.id, input.phaseId));
      const phase = phaseResults[0];
      if (!phase) throw new Error("Phase not found");
      
      // Verify project ownership
      const projectResults = await db.select().from(cfProjects)
        .where(and(eq(cfProjects.id, phase.projectId), eq(cfProjects.userId, ctx.user.id)));
      if (!projectResults[0]) throw new Error("Unauthorized");
      
      const startDate = input.startDate || phase.startDate;
      const durationMonths = input.durationMonths || phase.durationMonths;
      
      // Calculate end date
      const [startYear, startMonth] = startDate.split('-').map(Number);
      let endMonth = startMonth + durationMonths - 1;
      let endYear = startYear;
      while (endMonth > 12) {
        endMonth -= 12;
        endYear++;
      }
      const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}`;
      
      await db.update(projectPhases)
        .set({
          phaseName: input.phaseName || phase.phaseName,
          startDate,
          durationMonths,
          endDate,
          notes: input.notes !== undefined ? input.notes : phase.notes,
        })
        .where(eq(projectPhases.id, input.phaseId));
      
      return { success: true, endDate };
    }),

  deletePhase: publicProcedure
    .input(z.number())
    .mutation(async ({ ctx, input: phaseId }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const phaseResults = await db.select().from(projectPhases)
        .where(eq(projectPhases.id, phaseId));
      const phase = phaseResults[0];
      if (!phase) throw new Error("Phase not found");
      
      // Verify project ownership
      const projectResults = await db.select().from(cfProjects)
        .where(and(eq(cfProjects.id, phase.projectId), eq(cfProjects.userId, ctx.user.id)));
      if (!projectResults[0]) throw new Error("Unauthorized");
      
      await db.delete(projectPhases).where(eq(projectPhases.id, phaseId));
      return { success: true };
    }),

  // --- Export Cash Flow as Excel ---
  exportCashFlowExcel: publicProcedure
    .input(z.object({ cfProjectId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const projectResults = await db.select().from(cfProjects)
        .where(and(eq(cfProjects.id, input.cfProjectId), eq(cfProjects.userId, ctx.user.id)));
      const project = projectResults[0];
      if (!project) throw new Error("Project not found");

      const costItemsRaw = await db.select().from(cfCostItems)
        .where(eq(cfCostItems.cfProjectId, input.cfProjectId));

      const costItems: CostItemInput[] = costItemsRaw.map(item => ({
        id: item.id,
        name: item.name,
        category: item.category,
        totalAmount: item.totalAmount,
        paymentType: item.paymentType,
        paymentParams: item.paymentParams ? JSON.parse(item.paymentParams) : {},
        fundingSource: (item.fundingSource as any) || 'developer',
        escrowEligible: item.escrowEligible ?? false,
        phaseTag: (item.phaseTag as any) || 'pre_dev',
      }));

      const projectInput: ProjectInput = {
        startDate: project.startDate,
        preDevMonths: project.preDevMonths || 6,
        constructionMonths: project.constructionMonths || 16,
        handoverMonths: project.handoverMonths || 2,
        salesEnabled: project.salesEnabled ?? true,
        salesStartMonth: project.salesStartMonth,
        totalSalesRevenue: project.totalSalesRevenue,
        buyerPlanBookingPct: project.buyerPlanBookingPct ?? 20,
        buyerPlanConstructionPct: project.buyerPlanConstructionPct ?? 50,
        buyerPlanHandoverPct: project.buyerPlanHandoverPct ?? 30,
        escrowDepositPct: project.escrowDepositPct ?? 20,
        contractorAdvancePct: project.contractorAdvancePct ?? 10,
        liquidityBufferPct: project.liquidityBufferPct ?? 5,
        constructionCostTotal: project.constructionCostTotal,
        buaSqft: project.buaSqft,
        constructionCostPerSqft: project.constructionCostPerSqft,
      };

      const result = calculateDualCashFlow(projectInput, costItems);

      // Build Excel using xlsx
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();

      // Sheet 1: Monthly Cash Flow
      const monthlyData = result.monthlyTable.map((row: any) => ({
        'الشهر': row.monthLabel,
        'المرحلة': row.phase,
        'تمويل المستثمر': row.developerOutflow,
        'تمويل المستثمر التراكمي': row.developerCumulative,
        'إيرادات الإسكرو': row.escrowInflow,
        'مصروفات الإسكرو': row.escrowOutflow,
        'رصيد الإسكرو': row.escrowBalance,
        'إجمالي المصروفات': row.totalOutflow,
      }));
      const ws1 = XLSX.utils.json_to_sheet(monthlyData);
      XLSX.utils.book_append_sheet(wb, ws1, 'التدفق الشهري');

      // Sheet 2: Cost Items
      const costData = costItemsRaw.map(item => ({
        'البند': item.name,
        'الفئة': item.category,
        'المبلغ': item.totalAmount,
        'نوع الدفع': item.paymentType,
        'مصدر التمويل': item.fundingSource || 'developer',
        'مؤهل للإسكرو': item.escrowEligible ? 'نعم' : 'لا',
        'المرحلة': item.phaseTag || 'pre_dev',
      }));
      const ws2 = XLSX.utils.json_to_sheet(costData);
      XLSX.utils.book_append_sheet(wb, ws2, 'بنود التكاليف');

      // Sheet 3: Summary
      const summaryData = [
        { 'البند': 'إجمالي تكاليف المشروع', 'القيمة': result.totalProjectCost },
        { 'البند': 'إجمالي الإيرادات', 'القيمة': result.totalSalesRevenue },
        { 'البند': 'الربح', 'القيمة': result.totalSalesRevenue - result.totalProjectCost },
        { 'البند': 'تكاليف المستثمر', 'القيمة': result.developerCosts },
        { 'البند': 'تكاليف الإسكرو', 'القيمة': result.escrowCosts },
        { 'البند': 'أقصى تعرض للمستثمر', 'القيمة': result.developerMaxExposure },
        { 'البند': 'شهر الذروة', 'القيمة': result.developerMaxExposureLabel },
        { 'البند': 'تكلفة البناء', 'القيمة': result.constructionCost },
        { 'البند': 'مدة المشروع (شهر)', 'القيمة': result.totalMonths },
      ];
      const ws3 = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, ws3, 'ملخص');

      // Convert to base64
      const buf = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
      return {
        filename: `${project.name}_cashflow.xlsx`,
        data: buf,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      };
    }),

  // --- Sync existing CF project cost items from Feasibility ---
  syncFromFeasibility: publicProcedure
    .input(z.object({ projectId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Find the CF project linked to this project
      const cfProjResults = await db.select().from(cfProjects)
        .where(and(eq(cfProjects.projectId, input.projectId), eq(cfProjects.userId, ctx.user.id)))
        .orderBy(desc(cfProjects.id));
      const cfProj = cfProjResults[0];
      if (!cfProj) throw new Error("لا يوجد مشروع تدفقات نقدية مرتبط. أنشئ واحداً أولاً من صفحة التدفقات النقدية.");

      // Get project data
      const projResults = await db.select().from(projects).where(eq(projects.id, input.projectId));
      const proj = projResults[0];
      if (!proj) throw new Error("المشروع غير موجود");

      // Get costsCashFlow overrides
      const ccfResults = await db.select().from(costsCashFlow)
        .where(and(eq(costsCashFlow.projectId, input.projectId), eq(costsCashFlow.userId, ctx.user.id)));
      const ccf = ccfResults[0] || null;

      // Get competition pricing & market overview
      const cpResults = await db.select().from(competitionPricing).where(eq(competitionPricing.projectId, input.projectId));
      const cpData = cpResults[0] || null;
      const moResults = await db.select().from(marketOverview).where(eq(marketOverview.projectId, input.projectId));
      const moData = moResults[0] || null;

      const pf = (v: any) => parseFloat(v || '0') || 0;

      // Calculate values
      const bua = pf(proj.manualBuaSqft);
      const plotAreaSqft = pf(proj.plotAreaSqft);
      const plotAreaM2 = plotAreaSqft * 0.0929;
      const constructionPricePerSqft = pf(proj.estimatedConstructionPricePerSqft);
      const constructionCost = bua * constructionPricePerSqft;

      const gfaResSqft = pf(proj.gfaResidentialSqft);
      const gfaRetSqft = pf(proj.gfaRetailSqft);
      const gfaOffSqft = pf(proj.gfaOfficesSqft);
      const saleableRes = gfaResSqft * 0.95;
      const saleableRet = gfaRetSqft * 0.97;
      const saleableOff = gfaOffSqft * 0.95;

      // Revenue calculation - use DEFAULT_AVG_AREAS for fallback like frontend does
      const getAvg = (pctKey: string, avgVal: number | null | undefined) => {
        const v = avgVal || 0;
        if (v > 0) return v;
        const mapping = DEFAULT_AVG_AREAS[pctKey];
        return mapping ? mapping.defaultArea : 0;
      };

      let totalRevenue = 0;
      let totalUnits = 0;
      if (cpData && moData) {
        const activeScenario = cpData.activeScenario || 'base';
        const getPrices = () => {
          if (activeScenario === 'optimistic') return { studio: cpData.optStudioPrice || 0, oneBr: cpData.opt1brPrice || 0, twoBr: cpData.opt2brPrice || 0, threeBr: cpData.opt3brPrice || 0, retSmall: cpData.optRetailSmallPrice || 0, retMed: cpData.optRetailMediumPrice || 0, retLrg: cpData.optRetailLargePrice || 0, offSmall: cpData.optOfficeSmallPrice || 0, offMed: cpData.optOfficeMediumPrice || 0, offLrg: cpData.optOfficeLargePrice || 0 };
          if (activeScenario === 'conservative') return { studio: cpData.consStudioPrice || 0, oneBr: cpData.cons1brPrice || 0, twoBr: cpData.cons2brPrice || 0, threeBr: cpData.cons3brPrice || 0, retSmall: cpData.consRetailSmallPrice || 0, retMed: cpData.consRetailMediumPrice || 0, retLrg: cpData.consRetailLargePrice || 0, offSmall: cpData.consOfficeSmallPrice || 0, offMed: cpData.consOfficeMediumPrice || 0, offLrg: cpData.consOfficeLargePrice || 0 };
          return { studio: cpData.baseStudioPrice || 0, oneBr: cpData.base1brPrice || 0, twoBr: cpData.base2brPrice || 0, threeBr: cpData.base3brPrice || 0, retSmall: cpData.baseRetailSmallPrice || 0, retMed: cpData.baseRetailMediumPrice || 0, retLrg: cpData.baseRetailLargePrice || 0, offSmall: cpData.baseOfficeSmallPrice || 0, offMed: cpData.baseOfficeMediumPrice || 0, offLrg: cpData.baseOfficeLargePrice || 0 };
        };
        const prices = getPrices();
        const calcTypeRevenue = (pct: number, avgArea: number, pricePerSqft: number, saleable: number) => {
          const allocated = saleable * (pct / 100);
          const units = avgArea > 0 ? Math.floor(allocated / avgArea) : 0;
          totalUnits += units;
          return avgArea * pricePerSqft * units;
        };
        totalRevenue += calcTypeRevenue(pf(moData.residentialStudioPct), getAvg('residentialStudioPct', moData.residentialStudioAvgArea), prices.studio, saleableRes);
        totalRevenue += calcTypeRevenue(pf(moData.residential1brPct), getAvg('residential1brPct', moData.residential1brAvgArea), prices.oneBr, saleableRes);
        totalRevenue += calcTypeRevenue(pf(moData.residential2brPct), getAvg('residential2brPct', moData.residential2brAvgArea), prices.twoBr, saleableRes);
        totalRevenue += calcTypeRevenue(pf(moData.residential3brPct), getAvg('residential3brPct', moData.residential3brAvgArea), prices.threeBr, saleableRes);
        totalRevenue += calcTypeRevenue(pf(moData.retailSmallPct), getAvg('retailSmallPct', moData.retailSmallAvgArea), prices.retSmall, saleableRet);
        totalRevenue += calcTypeRevenue(pf(moData.retailMediumPct), getAvg('retailMediumPct', moData.retailMediumAvgArea), prices.retMed, saleableRet);
        totalRevenue += calcTypeRevenue(pf(moData.retailLargePct), getAvg('retailLargePct', moData.retailLargeAvgArea), prices.retLrg, saleableRet);
        totalRevenue += calcTypeRevenue(pf(moData.officeSmallPct), getAvg('officeSmallPct', moData.officeSmallAvgArea), prices.offSmall, saleableOff);
        totalRevenue += calcTypeRevenue(pf(moData.officeMediumPct), getAvg('officeMediumPct', moData.officeMediumAvgArea), prices.offMed, saleableOff);
        totalRevenue += calcTypeRevenue(pf(moData.officeLargePct), getAvg('officeLargePct', moData.officeLargeAvgArea), prices.offLrg, saleableOff);
      }

      // Cost values from project
      const landPrice = pf(proj.landPrice);
      const agentCommissionLandPct = pf(proj.agentCommissionLandPct);
      const designFeePct = pf(proj.designFeePct) || 2;
      const supervisionFeePct = pf(proj.supervisionFeePct) || 2;
      const separationFeePerSqft2 = pf(proj.separationFeePerM2) || 40;
      const totalGfaSqftC = gfaResSqft + gfaRetSqft + gfaOffSqft;
      const salesCommissionPct = pf(proj.salesCommissionPct) || 5;
      const marketingPct = pf(proj.marketingPct) || 2;
      const developerFeePct = pf(proj.developerFeePct) || 5;

      // Build name→amount mapping for updates
      // Include aliases for old names that may exist in the database
      const updatedAmounts: Record<string, number> = {
        'سعر الأرض': Math.round(landPrice),
        'عمولة وسيط الأرض': Math.round(landPrice * (agentCommissionLandPct / 100)),
        'عمولة وسيط الأرض (1%)': Math.round(landPrice * (agentCommissionLandPct / 100)),
        'رسوم تسجيل الأرض (4%)': Math.round(landPrice * 0.04),
        'رسوم تسجيل الأرض': Math.round(landPrice * 0.04),
        'فحص التربة': Math.round(pf(proj.soilTestFee)),
        'المسح الطبوغرافي': Math.round(pf(proj.topographicSurveyFee)),
        'رسوم الجهات الرسمية': Math.round(pf(proj.officialBodiesFees)),
        'رسوم الجهات الحكومية': Math.round(pf(proj.officialBodiesFees)),
        'أتعاب التصميم': Math.round(constructionCost * (designFeePct / 100)),
        'أتعاب التصميم (2%)': Math.round(constructionCost * (designFeePct / 100)),
        'أتعاب الإشراف': Math.round(constructionCost * (supervisionFeePct / 100)),
        'أتعاب الإشراف (2%)': Math.round(constructionCost * (supervisionFeePct / 100)),
        'رسوم الفرز': Math.round(totalGfaSqftC * separationFeePerSqft2),
        'رسوم الفرز (40 د/قدم)': Math.round(totalGfaSqftC * separationFeePerSqft2),
        'تكلفة البناء': Math.round(constructionCost),
        'المقاول الرئيسي': Math.round(constructionCost),
        'رسوم المجتمع': Math.round(pf(proj.communityFees)),
        'احتياطي': Math.round(constructionCost * 0.02),
        'احتياطي وطوارئ': Math.round(constructionCost * 0.02),
        'احتياطي وطوارئ (2%)': Math.round(constructionCost * 0.02),
        'أتعاب المطور': Math.round(totalRevenue * (developerFeePct / 100)),
        'أتعاب المطور (5%)': Math.round(totalRevenue * (developerFeePct / 100)),
        'عمولة البيع': Math.round(totalRevenue * (salesCommissionPct / 100)),
        'عمولة وكيل المبيعات (5%)': Math.round(totalRevenue * (salesCommissionPct / 100)),
        'التسويق': Math.round(totalRevenue * (marketingPct / 100)),
        'التسويق والإعلان (2%)': Math.round(totalRevenue * (marketingPct / 100)),
        'رسوم تسجيل الوحدات — ريرا': Math.round(pf(proj.reraUnitRegFee)),
        'تسجيل الوحدات - ريرا': Math.round(pf(proj.reraUnitRegFee)),
        'رسوم تسجيل المشروع — ريرا': Math.round(pf(proj.reraProjectRegFee)),
        'تسجيل بيع على الخارطة - ريرا': Math.round(pf(proj.reraProjectRegFee)),
        'رسوم عدم ممانعة — المطور': Math.round(pf(proj.developerNocFee)),
        'رسوم NOC للبيع': Math.round(pf(proj.developerNocFee)),
        'حساب الضمان (Escrow)': Math.round(pf(proj.escrowAccountFee)),
        'رسوم حساب الضمان': Math.round(pf(proj.escrowAccountFee)),
        'الرسوم البنكية': Math.round(pf(proj.bankFees)),
        'رسوم بنكية': Math.round(pf(proj.bankFees)),
        'أتعاب المسّاح': Math.round(pf(proj.surveyorFees)),
        'رسوم المساح': Math.round(pf(proj.surveyorFees)),
        'تدقيق ريرا': Math.round(pf(proj.reraAuditReportFee)),
        'تقارير تدقيق ريرا': Math.round(pf(proj.reraAuditReportFee)),
        'تفتيش ريرا': Math.round(pf(proj.reraInspectionReportFee)),
        'تقارير تفتيش ريرا': Math.round(pf(proj.reraInspectionReportFee)),
        // Also match items from cashFlowEngine.ts
        'رسوم الجهات الحكومية': Math.round(pf(proj.officialBodiesFees)),
        'رسوم تنظيمية (ريرا وأخرى)': Math.round(pf(proj.reraUnitRegFee) + pf(proj.reraProjectRegFee) + pf(proj.developerNocFee) + pf(proj.escrowAccountFee) + pf(proj.bankFees) + pf(proj.surveyorFees) + pf(proj.reraAuditReportFee) + pf(proj.reraInspectionReportFee)),
      };

      // Get existing cost items
      const existingItems = await db.select().from(cfCostItems)
        .where(eq(cfCostItems.cfProjectId, cfProj.id));

      let updatedCount = 0;
      for (const item of existingItems) {
        const newAmount = updatedAmounts[item.name];
        if (newAmount !== undefined && newAmount !== item.totalAmount) {
          await db.update(cfCostItems)
            .set({ totalAmount: newAmount })
            .where(eq(cfCostItems.id, item.id));
          updatedCount++;
        }
      }

      // Also update the total sales revenue on the CF project
      await db.update(cfProjects)
        .set({ totalSalesRevenue: Math.round(totalRevenue) || null })
        .where(eq(cfProjects.id, cfProj.id));

      return {
        updatedCount,
        totalRevenue: Math.round(totalRevenue),
        message: `تم تحديث ${updatedCount} بند من بنود التكاليف`,
      };
    }),

  // ═══════════════════════════════════════════════════════════════
  // Portfolio Capital Planning Simulator
  // ═══════════════════════════════════════════════════════════════

  getPortfolioSimulation: publicProcedure
    .input(z.object({
      availableCapital: z.number().min(0).default(100_000_000),
      excludeProjectIds: z.array(z.number()).default([]),
      delayMonths: z.record(z.string(), z.number()).default({}),
    }))
    .query(async ({ ctx, input }) => {
      if (!ctx.user) return null;
      const db = await getDb();
      if (!db) return null;

      const allProjects = await db.select().from(cfProjects)
        .where(eq(cfProjects.userId, ctx.user.id));

      if (allProjects.length === 0) return null;

      // Filter out excluded projects
      const activeProjects = allProjects.filter(p => !input.excludeProjectIds.includes(p.id));

      if (activeProjects.length === 0) {
        return {
          projects: allProjects.map(p => ({
            id: p.id,
            name: p.name,
            startDate: p.startDate,
            totalCost: 0,
            totalSales: 0,
            developerExposure: 0,
            peakExposure: 0,
            peakMonthLabel: '',
            totalMonths: 0,
            phases: { preDev: p.preDevMonths || 6, construction: p.constructionMonths || 16, handover: p.handoverMonths || 2 },
            excluded: input.excludeProjectIds.includes(p.id),
            delayMonths: 0,
            profit: 0,
            roi: 0,
          })),
          monthLabels: [],
          portfolioDeveloperOutflow: [],
          portfolioDeveloperCumulative: [],
          portfolioEscrowInflow: [],
          portfolioEscrowOutflow: [],
          portfolioEscrowBalance: [],
          portfolioPeakExposure: 0,
          portfolioPeakMonth: 0,
          portfolioPeakMonthLabel: '',
          totalPortfolioCost: 0,
          totalPortfolioSales: 0,
          totalDeveloperExposure: 0,
          availableCapital: input.availableCapital,
          fundingGap: 0,
          fundingGapMonths: [],
        };
      }

      // Apply delays to start dates
      function applyDelay(startDate: string, delayMonths: number): string {
        const [y, m] = startDate.split('-').map(Number);
        const totalM = (y * 12 + m - 1) + delayMonths;
        const newY = Math.floor(totalM / 12);
        const newM = (totalM % 12) + 1;
        return `${newY}-${String(newM).padStart(2, '0')}`;
      }

      // Calculate cash flow for each active project
      const projectResults: Array<any> = [];

      // Find global timeline bounds
      let globalStartYear = 9999, globalStartMonth = 12;
      let globalEndYear = 0, globalEndMonth = 0;

      for (const project of activeProjects) {
        const delay = input.delayMonths[String(project.id)] || 0;
        const adjustedStart = applyDelay(project.startDate, delay);
        const [y, m] = adjustedStart.split('-').map(Number);
        if (y < globalStartYear || (y === globalStartYear && m < globalStartMonth)) {
          globalStartYear = y;
          globalStartMonth = m;
        }
        const totalMonths = (project.preDevMonths || 6) + (project.constructionMonths || 16) + (project.handoverMonths || 2);
        const endMonth = m + totalMonths - 1;
        const endYear = y + Math.floor((endMonth - 1) / 12);
        const endMonthInYear = ((endMonth - 1) % 12) + 1;
        if (endYear > globalEndYear || (endYear === globalEndYear && endMonthInYear > globalEndMonth)) {
          globalEndYear = endYear;
          globalEndMonth = endMonthInYear;
        }
      }

      const totalGlobalMonths = (globalEndYear - globalStartYear) * 12 + (globalEndMonth - globalStartMonth + 1);
      const portfolioDeveloperOutflow = new Array(totalGlobalMonths).fill(0);
      const portfolioEscrowInflow = new Array(totalGlobalMonths).fill(0);
      const portfolioEscrowOutflow = new Array(totalGlobalMonths).fill(0);

      for (const project of activeProjects) {
        const delay = input.delayMonths[String(project.id)] || 0;
        const adjustedStart = applyDelay(project.startDate, delay);
        const [projYear, projMonth] = adjustedStart.split('-').map(Number);
        const offset = (projYear - globalStartYear) * 12 + (projMonth - globalStartMonth);

        const costItemsRaw = await db.select().from(cfCostItems)
          .where(eq(cfCostItems.cfProjectId, project.id));

        const costItems: CostItemInput[] = costItemsRaw.map(item => ({
          id: item.id,
          name: item.name,
          category: item.category,
          totalAmount: item.totalAmount,
          paymentType: item.paymentType,
          paymentParams: item.paymentParams ? JSON.parse(item.paymentParams) : {},
          fundingSource: (item.fundingSource as any) || 'developer',
          escrowEligible: item.escrowEligible ?? false,
          phaseTag: (item.phaseTag as any) || 'pre_dev',
        }));

        const projectInput: ProjectInput = {
          startDate: adjustedStart,
          preDevMonths: project.preDevMonths || 6,
          constructionMonths: project.constructionMonths || 16,
          handoverMonths: project.handoverMonths || 2,
          salesEnabled: project.salesEnabled ?? true,
          salesStartMonth: project.salesStartMonth,
          totalSalesRevenue: project.totalSalesRevenue,
          buyerPlanBookingPct: project.buyerPlanBookingPct ?? 20,
          buyerPlanConstructionPct: project.buyerPlanConstructionPct ?? 50,
          buyerPlanHandoverPct: project.buyerPlanHandoverPct ?? 30,
          escrowDepositPct: project.escrowDepositPct ?? 20,
          contractorAdvancePct: project.contractorAdvancePct ?? 10,
          liquidityBufferPct: project.liquidityBufferPct ?? 5,
          constructionCostTotal: project.constructionCostTotal,
          buaSqft: project.buaSqft,
          constructionCostPerSqft: project.constructionCostPerSqft,
        };

        const result = calculateDualCashFlow(projectInput, costItems);

        for (let m = 0; m < result.totalMonths; m++) {
          if (offset + m < totalGlobalMonths) {
            const row = result.monthlyTable[m];
            portfolioDeveloperOutflow[offset + m] += row.developerOutflow;
            portfolioEscrowInflow[offset + m] += row.escrowInflow;
            portfolioEscrowOutflow[offset + m] += row.escrowOutflow;
          }
        }

        const profit = result.totalSalesRevenue - result.totalProjectCost;
        const roi = result.developerMaxExposure > 0 ? (profit / result.developerMaxExposure) * 100 : 0;

        projectResults.push({
          id: project.id,
          name: project.name,
          startDate: project.startDate,
          adjustedStartDate: adjustedStart,
          totalCost: result.totalProjectCost,
          totalSales: result.totalSalesRevenue,
          developerExposure: result.developerMaxExposure,
          peakExposure: result.developerMaxExposure,
          peakMonthLabel: result.developerMaxExposureLabel,
          totalMonths: result.totalMonths,
          phases: {
            preDev: projectInput.preDevMonths,
            construction: projectInput.constructionMonths,
            handover: projectInput.handoverMonths,
          },
          excluded: false,
          delayMonths: delay,
          profit,
          roi,
          monthlyDeveloperOutflow: result.monthlyTable.map(r => r.developerOutflow),
        });
      }

      // Add excluded projects with zero values
      for (const project of allProjects) {
        if (input.excludeProjectIds.includes(project.id)) {
          projectResults.push({
            id: project.id,
            name: project.name,
            startDate: project.startDate,
            adjustedStartDate: project.startDate,
            totalCost: 0,
            totalSales: 0,
            developerExposure: 0,
            peakExposure: 0,
            peakMonthLabel: '',
            totalMonths: (project.preDevMonths || 6) + (project.constructionMonths || 16) + (project.handoverMonths || 2),
            phases: { preDev: project.preDevMonths || 6, construction: project.constructionMonths || 16, handover: project.handoverMonths || 2 },
            excluded: true,
            delayMonths: 0,
            profit: 0,
            roi: 0,
            monthlyDeveloperOutflow: [],
          });
        }
      }

      // Calculate cumulative and funding gap
      const portfolioDeveloperCumulative: number[] = [];
      const portfolioEscrowBalance: number[] = [];
      const fundingGapMonths: Array<{ month: number; label: string; gap: number }> = [];
      let cumDev = 0, cumEscIn = 0, cumEscOut = 0;
      let portfolioPeakExposure = 0, portfolioPeakMonth = 0;

      for (let m = 0; m < totalGlobalMonths; m++) {
        cumDev += portfolioDeveloperOutflow[m];
        cumEscIn += portfolioEscrowInflow[m];
        cumEscOut += portfolioEscrowOutflow[m];
        portfolioDeveloperCumulative.push(cumDev);
        portfolioEscrowBalance.push(cumEscIn - cumEscOut);
        if (cumDev > portfolioPeakExposure) {
          portfolioPeakExposure = cumDev;
          portfolioPeakMonth = m + 1;
        }
      }

      // Generate month labels
      const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
      const monthLabels: string[] = [];
      for (let m = 0; m < totalGlobalMonths; m++) {
        const monthIdx = (globalStartMonth - 1 + m) % 12;
        const year = globalStartYear + Math.floor((globalStartMonth - 1 + m) / 12);
        monthLabels.push(`${monthNames[monthIdx]} ${year}`);
      }

      // Calculate funding gap
      const fundingGap = Math.max(0, portfolioPeakExposure - input.availableCapital);
      for (let m = 0; m < totalGlobalMonths; m++) {
        if (portfolioDeveloperCumulative[m] > input.availableCapital) {
          fundingGapMonths.push({
            month: m + 1,
            label: monthLabels[m],
            gap: portfolioDeveloperCumulative[m] - input.availableCapital,
          });
        }
      }

      return {
        projects: projectResults,
        monthLabels,
        portfolioDeveloperOutflow,
        portfolioDeveloperCumulative,
        portfolioEscrowInflow,
        portfolioEscrowOutflow,
        portfolioEscrowBalance,
        portfolioPeakExposure,
        portfolioPeakMonth,
        portfolioPeakMonthLabel: monthLabels[portfolioPeakMonth - 1] || '',
        totalPortfolioCost: projectResults.filter(p => !p.excluded).reduce((s: number, p: any) => s + p.totalCost, 0),
        totalPortfolioSales: projectResults.filter(p => !p.excluded).reduce((s: number, p: any) => s + p.totalSales, 0),
        totalDeveloperExposure: portfolioPeakExposure,
        availableCapital: input.availableCapital,
        fundingGap,
        fundingGapMonths,
      };
    }),

  importAllProjects: publicProcedure
    .mutation(async ({ ctx }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      // Get all projects for this user
      const allProjects = await db.select().from(projects)
        .where(eq(projects.userId, ctx.user.id));
      // Get existing CF projects for this user
      const existingCf = await db.select().from(cfProjects)
        .where(eq(cfProjects.userId, ctx.user.id));
      const existingProjectIds = new Set(existingCf.map(p => p.projectId));
      let imported = 0;
      const results: Array<{ projectName: string; status: string }> = [];
      for (const proj of allProjects) {
        if (existingProjectIds.has(proj.id)) {
          results.push({ projectName: proj.name, status: 'موجود مسبقاً' });
          continue;
        }
        // Get capital settings for start date
        const settings = await db.select().from(projectCapitalSettings)
          .where(eq(projectCapitalSettings.projectId, proj.id));
        const startDate = settings[0]?.startDate || '2025-06';
        // Get costsCashFlow overrides
        const ccfResults = await db.select().from(costsCashFlow)
          .where(and(eq(costsCashFlow.projectId, proj.id), eq(costsCashFlow.userId, ctx.user.id)));
        const ccf = ccfResults[0] || null;
        // Get competition pricing
        const cpResults = await db.select().from(competitionPricing)
          .where(eq(competitionPricing.projectId, proj.id));
        const cpData = cpResults[0] || null;
        // Get market overview
        const moResults = await db.select().from(marketOverview)
          .where(eq(marketOverview.projectId, proj.id));
        const moData = moResults[0] || null;
        const pf = (v: any) => Number(v) || 0;
        const bua = pf(proj.manualBuaSqft) || pf(proj.bua);
        const plotAreaSqft = pf(proj.plotAreaSqft);
        const plotAreaM2 = plotAreaSqft * 0.0929;
        const constructionPricePerSqft = ccf ? (ccf.constructionCostPerSqft || 0) : pf(proj.estimatedConstructionPricePerSqft);
        const constructionCost = bua * constructionPricePerSqft;
        const totalUnits = moData ? Math.round(pf(moData.totalUnitsEstimate)) : 0;
        // Calculate revenue from MO+CP
        let totalRevenue = 0;
        if (cpData && moData) {
          const gfaRes = pf(proj.gfaResidentialSqft), gfaRet = pf(proj.gfaRetailSqft), gfaOff = pf(proj.gfaOfficesSqft);
          const sRes = gfaRes * 0.95, sRet = gfaRet * 0.97, sOff = gfaOff * 0.95;
          const getAvg = (k: string, v: any) => { const n = v||0; if(n>0) return n; const m = DEFAULT_AVG_AREAS[k]; return m ? m.defaultArea : 0; };
          const prices = { studio: cpData.baseStudioPrice||0, oneBr: cpData.base1brPrice||0, twoBr: cpData.base2brPrice||0, threeBr: cpData.base3brPrice||0, retSmall: cpData.baseRetailSmallPrice||0, retMed: cpData.baseRetailMediumPrice||0, retLrg: cpData.baseRetailLargePrice||0, offSmall: cpData.baseOfficeSmallPrice||0, offMed: cpData.baseOfficeMediumPrice||0, offLrg: cpData.baseOfficeLargePrice||0 };
          const calc = (pct: number, avg: number, pr: number, sal: number) => { const al = sal*(pct/100); const u = avg>0 ? Math.floor(al/avg) : 0; return avg*pr*u; };
          totalRevenue += calc(pf(moData.residentialStudioPct), getAvg('residentialStudioPct', moData.residentialStudioAvgArea), prices.studio, sRes);
          totalRevenue += calc(pf(moData.residential1brPct), getAvg('residential1brPct', moData.residential1brAvgArea), prices.oneBr, sRes);
          totalRevenue += calc(pf(moData.residential2brPct), getAvg('residential2brPct', moData.residential2brAvgArea), prices.twoBr, sRes);
          totalRevenue += calc(pf(moData.residential3brPct), getAvg('residential3brPct', moData.residential3brAvgArea), prices.threeBr, sRes);
          totalRevenue += calc(pf(moData.retailSmallPct), getAvg('retailSmallPct', moData.retailSmallAvgArea), prices.retSmall, sRet);
          totalRevenue += calc(pf(moData.retailMediumPct), getAvg('retailMediumPct', moData.retailMediumAvgArea), prices.retMed, sRet);
          totalRevenue += calc(pf(moData.retailLargePct), getAvg('retailLargePct', moData.retailLargeAvgArea), prices.retLrg, sRet);
          totalRevenue += calc(pf(moData.officeSmallPct), getAvg('officeSmallPct', moData.officeSmallAvgArea), prices.offSmall, sOff);
          totalRevenue += calc(pf(moData.officeMediumPct), getAvg('officeMediumPct', moData.officeMediumAvgArea), prices.offMed, sOff);
          totalRevenue += calc(pf(moData.officeLargePct), getAvg('officeLargePct', moData.officeLargeAvgArea), prices.offLrg, sOff);
        }
        // Create CF project
        const insertResult = await db.insert(cfProjects).values({
          userId: ctx.user.id,
          projectId: proj.id,
          name: proj.name,
          startDate,
          designApprovalMonths: 6,
          reraSetupMonths: 3,
          constructionMonths: 24,
          handoverMonths: 3,
          preDevMonths: 9,
          salesEnabled: 1,
          salesStartMonth: 4,
          totalSalesRevenue: Math.round(totalRevenue) || null,
          constructionCostTotal: Math.round(constructionCost) || null,
          buaSqft: bua || null,
          constructionCostPerSqft: constructionPricePerSqft || null,
        });
        const cfProjectId = Number(insertResult[0].insertId);
        // Build cost items
        const costItemsToInsert: any[] = [];
        let sortOrder = 1;
        // Land
        const landPrice = ccf ? (ccf.landPrice || 0) : pf(proj.landPrice);
        const agentCommLandPct = ccf ? pf(ccf.agentCommissionLandPct) || 1 : pf(proj.agentCommissionLandPct) || 1;
        if (landPrice > 0) {
          costItemsToInsert.push({
            cfProjectId, name: 'سعر الأرض', category: 'land',
            totalAmount: Math.round(landPrice), paymentType: 'lump_sum',
            paymentParams: JSON.stringify({ paymentMonth: 1 }),
            sortOrder: sortOrder++, fundingSource: 'developer', escrowEligible: 0, phaseTag: 'pre_dev',
          });
          const agentComm = landPrice * (agentCommLandPct / 100);
          if (agentComm > 0) {
            costItemsToInsert.push({
              cfProjectId, name: 'عمولة وسيط الأرض', category: 'land',
              totalAmount: Math.round(agentComm), paymentType: 'lump_sum',
              paymentParams: JSON.stringify({ paymentMonth: 1 }),
              sortOrder: sortOrder++, fundingSource: 'developer', escrowEligible: 0, phaseTag: 'pre_dev',
            });
          }
        }
        // Design fee
        const designFeePct = ccf ? pf(ccf.designFeePct) || 2 : pf(proj.designFeePct) || 2;
        const designFee = constructionCost * (designFeePct / 100);
        if (designFee > 0) {
          costItemsToInsert.push({
            cfProjectId, name: 'رسوم التصميم', category: 'consultants',
            totalAmount: Math.round(designFee), paymentType: 'lump_sum',
            paymentParams: JSON.stringify({ paymentMonth: 3 }),
            sortOrder: sortOrder++, fundingSource: 'developer', escrowEligible: 0, phaseTag: 'pre_dev',
          });
        }
        // Supervision
        const supervisionPct = ccf ? pf(ccf.supervisionFeePct) || 2 : pf(proj.supervisionFeePct) || 2;
        const supervisionFee = constructionCost * (supervisionPct / 100);
        if (supervisionFee > 0) {
          costItemsToInsert.push({
            cfProjectId, name: 'أتعاب الإشراف', category: 'consultants',
            totalAmount: Math.round(supervisionFee), paymentType: 'monthly_fixed',
            paymentParams: JSON.stringify({}),
            sortOrder: sortOrder++, fundingSource: 'developer', escrowEligible: 0, phaseTag: 'construction',
          });
        }
        // Authority fees
        const authFee = ccf ? (ccf.authoritiesFee || 0) : pf(proj.officialBodiesFees);
        if (authFee > 0) {
          costItemsToInsert.push({
            cfProjectId, name: 'رسوم الجهات الرسمية', category: 'authority_fees',
            totalAmount: authFee, paymentType: 'lump_sum',
            paymentParams: JSON.stringify({ paymentMonth: 3 }),
            sortOrder: sortOrder++, fundingSource: 'developer', escrowEligible: 0, phaseTag: 'pre_dev',
          });
        }
        // Construction
        if (constructionCost > 0) {
          costItemsToInsert.push({
            cfProjectId, name: 'تكلفة البناء', category: 'construction',
            totalAmount: Math.round(constructionCost), paymentType: 'progress_based',
            paymentParams: JSON.stringify({ mobilizationPct: 10, progressDistribution: 'scurve', retentionPct: 10, retentionReleaseMonth: 3 }),
            sortOrder: sortOrder++, fundingSource: 'mixed', escrowEligible: 1, phaseTag: 'construction',
          });
        }
        // Marketing & Sales Commission
        const mktPct = ccf ? pf(ccf.marketingPct) || 2 : pf(proj.marketingPct) || 2;
        const marketing = totalRevenue * (mktPct / 100);
        const salesCommPct = ccf ? pf(ccf.agentCommissionSalePct) || 5 : pf(proj.salesCommissionPct) || 5;
        const salesComm = totalRevenue * (salesCommPct / 100);
        if (marketing > 0) {
          costItemsToInsert.push({
            cfProjectId, name: 'تسويق', category: 'marketing',
            totalAmount: Math.round(marketing), paymentType: 'monthly_fixed',
            paymentParams: JSON.stringify({}),
            sortOrder: sortOrder++, fundingSource: 'developer', escrowEligible: 0, phaseTag: 'all',
          });
        }
        if (salesComm > 0) {
          costItemsToInsert.push({
            cfProjectId, name: 'عمولة البيع', category: 'marketing',
            totalAmount: Math.round(salesComm), paymentType: 'sales_linked',
            paymentParams: JSON.stringify({ salesPct: salesCommPct, salesTiming: 'booking' }),
            sortOrder: sortOrder++, fundingSource: 'developer', escrowEligible: 0, phaseTag: 'all',
          });
        }
        // Developer fee
        const devFeePct = ccf ? pf(ccf.developerFeePct) || 5 : pf(proj.developerFeePct) || 5;
        const developerFee = totalRevenue * (devFeePct / 100);
        if (developerFee > 0) {
          costItemsToInsert.push({
            cfProjectId, name: 'أتعاب المطور', category: 'developer_fee',
            totalAmount: Math.round(developerFee), paymentType: 'monthly_fixed',
            paymentParams: JSON.stringify({}),
            sortOrder: sortOrder++, fundingSource: 'developer', escrowEligible: 0, phaseTag: 'all',
          });
        }
        // Contingency
        const contPct = ccf ? pf(ccf.contingenciesPct) || 2 : 2;
        const contingency = constructionCost * (contPct / 100);
        if (contingency > 0) {
          costItemsToInsert.push({
            cfProjectId, name: 'احتياطي', category: 'contingency',
            totalAmount: Math.round(contingency), paymentType: 'monthly_fixed',
            paymentParams: JSON.stringify({}),
            sortOrder: sortOrder++, fundingSource: 'developer', escrowEligible: 0, phaseTag: 'construction',
          });
        }
        // Separation fee
        const sepFeePerM2D = ccf ? (ccf.separationFeePerM2 || 40) : pf(proj.separationFeePerM2) || 40;
        const totalGfaSqftD = pf(proj.gfaResidentialSqft) + pf(proj.gfaRetailSqft) + pf(proj.gfaOfficesSqft);
        const separationFee = totalGfaSqftD * sepFeePerM2D;
        if (separationFee > 0) {
          costItemsToInsert.push({
            cfProjectId, name: 'رسوم الفرز', category: 'authority_fees',
            totalAmount: Math.round(separationFee), paymentType: 'lump_sum',
            paymentParams: JSON.stringify({ paymentMonth: 2 }),
            sortOrder: sortOrder++, fundingSource: 'developer', escrowEligible: 0, phaseTag: 'pre_dev',
          });
        }
        // Soil & Survey
        const soilFee = ccf ? (ccf.soilInvestigation || 0) : pf(proj.soilTestFee);
        if (soilFee > 0) {
          costItemsToInsert.push({
            cfProjectId, name: 'فحص التربة', category: 'pre_dev',
            totalAmount: soilFee, paymentType: 'lump_sum',
            paymentParams: JSON.stringify({ paymentMonth: 2 }),
            sortOrder: sortOrder++, fundingSource: 'developer', escrowEligible: 0, phaseTag: 'pre_dev',
          });
        }
        const topoFee = ccf ? (ccf.topographySurvey || 0) : pf(proj.topographicSurveyFee);
        if (topoFee > 0) {
          costItemsToInsert.push({
            cfProjectId, name: 'مسح طبوغرافي', category: 'pre_dev',
            totalAmount: topoFee, paymentType: 'lump_sum',
            paymentParams: JSON.stringify({ paymentMonth: 1 }),
            sortOrder: sortOrder++, fundingSource: 'developer', escrowEligible: 0, phaseTag: 'pre_dev',
          });
        }
        // Insert cost items
        for (const item of costItemsToInsert) {
          await db.insert(cfCostItems).values(item);
        }
        imported++;
        results.push({ projectName: proj.name, status: `تم الاستيراد (${costItemsToInsert.length} بند)` });
      }
      return { imported, total: allProjects.length, results };
    }),

  // --- Capital Schedule Data for All Projects (used by CapitalSchedulingPage) ---
  // Returns monthly developer outflow per project from cf_cost_items via calculateDualCashFlow
  getCapitalScheduleData: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.user) return [];
    const db = await getDb();
    if (!db) return [];
    // Source projects from the projects table (البطاقة) directly
    const allProjects = await db.select().from(projects)
      .where(eq(projects.userId, ctx.user.id));
    if (allProjects.length === 0) return [];
    // Also get cfProjects for startDate / durations lookup
    const allCfProjs = await db.select().from(cfProjects)
      .where(eq(cfProjects.userId, ctx.user.id));
    // Build a map: projectId -> cfProject (for startDate/durations)
    const cfByProjectId = new Map<number, typeof allCfProjs[0]>();
    for (const cf of allCfProjs) {
      if (cf.projectId) cfByProjectId.set(cf.projectId, cf);
    }
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
      phaseMonthlyAmounts: Record<string, Record<number, number>>;
      phaseTotals: Record<string, number>;
      grandTotal: number;
      paidTotal: number;
      upcomingTotal: number;
    }> = [];
    for (const proj of allProjects) {
      const [moRows] = await db.select().from(marketOverview)
        .where(eq(marketOverview.projectId, proj.id));
      const [cpRows] = await db.select().from(competitionPricing)
        .where(eq(competitionPricing.projectId, proj.id));
      // Use cfProject durations/startDate if available, otherwise use project defaults
      const cfProj = cfByProjectId.get(proj.id);
      const startDateStr = cfProj?.startDate || '2026-04';
      const preDevMonths = cfProj?.preDevMonths || proj.preConMonths || 6;
      const constructionMonths = cfProj?.constructionMonths || proj.constructionMonths || 16;
      const handoverMonths = cfProj?.handoverMonths || 2;
      const data = computeProjectCapital(
        proj,
        moRows || null,
        cpRows || null,
        {
          startDate: startDateStr,
          preDevMonths,
          constructionMonths,
          handoverMonths,
        },
        today,
      );
      if (!data) continue;
      results.push({
        cfProjectId: cfProj?.id ?? null,
        projectId: proj.id,
        name: proj.name,
        startDate: startDateStr,
        preDevMonths: data.preDevMonths,
        designMonths: data.designMonths,
        offplanMonths: data.offplanMonths,
        constructionMonths: data.constructionMonths,
        handoverMonths: data.handoverMonths,
        monthlyAmounts: data.monthlyAmounts,
        phaseMonthlyAmounts: data.phaseMonthlyAmounts,
        phaseTotals: data.phaseTotals,
        grandTotal: data.grandTotal,
        paidTotal: data.paidTotal,
        upcomingTotal: data.upcomingTotal,
      });
    }
    return results;
  }),
    // --- Capital Summary for All Projects (used by CapitalSchedulingPage) ---
  getCapitalSummaryAllProjects: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.user) return [];
    const db = await getDb();
    if (!db) return [];

    const allProjs = await db.select().from(cfProjects)
      .where(eq(cfProjects.userId, ctx.user.id));
    if (allProjs.length === 0) return [];

    const today = new Date();
    const results: Array<{
      cfProjectId: number;
      projectId: number | null;
      name: string;
      totalCapital: number;
      paidCapital: number;
      remainingCapital: number;
    }> = [];

    for (const proj of allProjs) {
      const items = await db.select().from(cfCostItems)
        .where(eq(cfCostItems.cfProjectId, proj.id));

      // totalCapital will be computed from developerOutflow (same as ExcelCashFlowPage)
      let totalCapital = 0;

      const projectInput: ProjectInput = {
        preDevMonths: proj.preDevMonths || 6,
        constructionMonths: proj.constructionMonths || 16,
        handoverMonths: proj.handoverMonths || 2,
        startDate: proj.startDate || '2026-04-01',
        salesEnabled: proj.salesEnabled === 1,
        salesStartMonth: proj.salesStartMonth ?? undefined,
        salesVelocityAed: proj.salesVelocityAed ?? undefined,
        salesVelocityType: (proj.salesVelocityType as 'units' | 'aed') ?? 'aed',
        totalSalesRevenue: proj.totalSalesRevenue ?? 0,
        buyerPlanBookingPct: Number(proj.buyerPlanBookingPct) || 20,
        buyerPlanConstructionPct: Number(proj.buyerPlanConstructionPct) || 30,
        buyerPlanHandoverPct: Number(proj.buyerPlanHandoverPct) || 50,
        escrowDepositPct: Number(proj.escrowDepositPct) || 20,
        contractorAdvancePct: Number(proj.contractorAdvancePct) || 10,
        liquidityBufferPct: Number(proj.liquidityBufferPct) || 5,
        constructionCostTotal: proj.constructionCostTotal ?? 0,
        buaSqft: proj.buaSqft ?? undefined,
        constructionCostPerSqft: proj.constructionCostPerSqft ?? undefined,
      };

      const costItemInputs: CostItemInput[] = items.map(i => ({
        id: String(i.id),
        name: i.name,
        category: i.category,
        totalAmount: i.totalAmount || 0,
        paymentType: i.paymentType,
        paymentParams: i.paymentParams ? JSON.parse(i.paymentParams) : {},
        phaseAllocation: i.phaseAllocation ? JSON.parse(i.phaseAllocation) : undefined,
        fundingSource: i.fundingSource,
        escrowEligible: i.escrowEligible === 1,
        phaseTag: i.phaseTag,
      }));

      let paidCapital = 0;
      try {
        const result = calculateDualCashFlow(projectInput, costItemInputs);
        const [startYear, startMonth] = (proj.startDate || '2026-04-01').split('-').map(Number);
        result.monthlyTable.forEach((row) => {
          // Accumulate total investor capital (developerOutflow = what investor pays)
          totalCapital += row.developerOutflow;
          const rowYear = startYear + Math.floor((startMonth - 1 + row.month - 1) / 12);
          const rowMonth = ((startMonth - 1 + row.month - 1) % 12) + 1;
          const rowDate = new Date(rowYear, rowMonth - 1, 28); // end of month
          if (rowDate < today) {
            paidCapital += row.developerOutflow;
          }
        });
      } catch (_e) {
        // calculation failed — fall back to cfCostItems sum
        totalCapital = items.reduce((s, i) => s + (i.totalAmount || 0), 0);
      }

      results.push({
        cfProjectId: proj.id,
        projectId: proj.projectId ?? null,
        name: proj.name,
        totalCapital,
        paidCapital,
        remainingCapital: totalCapital - paidCapital,
      });
    }

    return results;
  }),
});

