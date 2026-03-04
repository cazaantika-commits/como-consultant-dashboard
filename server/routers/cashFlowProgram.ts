import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { cfProjects, cfCostItems, cfScenarios, cfFiles, projects, feasibilityStudies } from "../../drizzle/schema";
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
  category: z.enum(['land', 'consultant_design', 'authority_fees', 'contractor', 'supervision', 'marketing_sales', 'developer_fee', 'contingency', 'other']),
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
  // ─── Projects CRUD ───
  listProjects: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.user) return [];
    const db = await getDb();
    if (!db) return [];
    return db.select().from(cfProjects)
      .where(eq(cfProjects.userId, ctx.user.id))
      .orderBy(desc(cfProjects.updatedAt));
  }),

  getProject: publicProcedure
    .input(z.number())
    .query(async ({ ctx, input }) => {
      if (!ctx.user) return null;
      const db = await getDb();
      if (!db) return null;
      const results = await db.select().from(cfProjects)
        .where(and(eq(cfProjects.id, input), eq(cfProjects.userId, ctx.user.id)));
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
    .input(z.object({ id: z.number() }).merge(cfProjectInput))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db.update(cfProjects)
        .set({
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
        })
        .where(and(eq(cfProjects.id, input.id), eq(cfProjects.userId, ctx.user.id)));
      return { success: true };
    }),

  deleteProject: publicProcedure
    .input(z.number())
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.delete(cfProjects)
        .where(and(eq(cfProjects.id, input), eq(cfProjects.userId, ctx.user.id)));
      return { success: true };
    }),

  // ─── Cost Items CRUD ───
  getCostItems: publicProcedure
    .input(z.number()) // cfProjectId
    .query(async ({ ctx, input }) => {
      if (!ctx.user) return [];
      const db = await getDb();
      if (!db) return [];
      return db.select().from(cfCostItems)
        .where(eq(cfCostItems.cfProjectId, input))
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
    .input(z.number())
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.delete(cfCostItems).where(eq(cfCostItems.id, input));
      return { success: true };
    }),

  // ─── Scenarios CRUD ───
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

  // ─── Files CRUD ───
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

  // ─── Cash Flow Calculation ───
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

      // Build timeline
      const phases = buildTimeline(
        project.designApprovalMonths,
        project.reraSetupMonths,
        project.constructionMonths,
        project.handoverMonths,
        scenario.constructionDurationDelta
      );
      const totalMonths = getTotalProjectMonths(phases);

      // Parse cost items
      const costItems: CostItemWithPayment[] = costItemsRaw.map(item => ({
        id: item.id,
        name: item.name,
        category: item.category,
        totalAmount: item.totalAmount,
        paymentType: item.paymentType,
        paymentParams: item.paymentParams ? JSON.parse(item.paymentParams) : {},
        phaseAllocation: item.phaseAllocation ? JSON.parse(item.phaseAllocation) : undefined,
      }));

      // Calculate outflows
      const outflowByCategory = calculateMonthlyOutflow(costItems, phases, totalMonths, scenario);

      // Calculate inflows
      const salesInflow = calculateSalesInflow(project, phases, totalMonths, scenario);

      // Calculate cumulative and key numbers
      const totalOutflow = outflowByCategory['total'] || new Array(totalMonths).fill(0);
      const cumulativeOutflow: number[] = [];
      const cumulativeInflow: number[] = [];
      const netCashFlow: number[] = [];
      const cumulativeNet: number[] = [];

      let cumOut = 0, cumIn = 0, cumNet = 0;
      let peakExposure = 0, peakMonth = 0;

      for (let m = 0; m < totalMonths; m++) {
        cumOut += totalOutflow[m];
        cumIn += salesInflow[m];
        const net = salesInflow[m] - totalOutflow[m];
        cumNet += net;

        cumulativeOutflow.push(cumOut);
        cumulativeInflow.push(cumIn);
        netCashFlow.push(net);
        cumulativeNet.push(cumNet);

        if (cumNet < peakExposure) {
          peakExposure = cumNet;
          peakMonth = m + 1;
        }
      }

      // Generate month labels based on start date
      const [startYear, startMonthStr] = project.startDate.split('-');
      const startMonthNum = parseInt(startMonthStr) || 1;
      const startYearNum = parseInt(startYear) || 2026;
      const monthLabels: string[] = [];
      const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
      for (let m = 0; m < totalMonths; m++) {
        const monthIdx = (startMonthNum - 1 + m) % 12;
        const year = startYearNum + Math.floor((startMonthNum - 1 + m) / 12);
        monthLabels.push(`${monthNames[monthIdx]} ${year}`);
      }

      const totalCost = cumOut;
      const totalSales = cumIn;

      return {
        phases,
        totalMonths,
        monthLabels,
        outflowByCategory,
        salesInflow,
        totalOutflow,
        cumulativeOutflow,
        cumulativeInflow,
        netCashFlow,
        cumulativeNet,
        keyNumbers: {
          totalCost,
          totalSales,
          peakExposure: Math.abs(peakExposure),
          peakMonth,
          peakMonthLabel: monthLabels[peakMonth - 1] || '',
          netProfit: totalSales - totalCost,
          roi: totalCost > 0 ? ((totalSales - totalCost) / totalCost) * 100 : 0,
        },
      };
    }),

  // ─── Portfolio View ───
  getPortfolioCashFlow: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.user) return null;
    const db = await getDb();
    if (!db) return null;

    const allProjects = await db.select().from(cfProjects)
      .where(eq(cfProjects.userId, ctx.user.id));

    if (allProjects.length === 0) return null;

    // Calculate cash flow for each project and aggregate
    const projectResults: Array<{
      id: number;
      name: string;
      totalCost: number;
      totalSales: number;
      peakExposure: number;
      peakMonth: number;
      monthlyOutflow: number[];
      monthlyInflow: number[];
      startDate: string;
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

      const phases = buildTimeline(
        project.designApprovalMonths,
        project.reraSetupMonths,
        project.constructionMonths,
        project.handoverMonths
      );
      const totalMonths = getTotalProjectMonths(phases);
      const endMonth = m + totalMonths - 1;
      const endYear = y + Math.floor((endMonth - 1) / 12);
      const endMonthInYear = ((endMonth - 1) % 12) + 1;

      if (endYear > globalEndYear || (endYear === globalEndYear && endMonthInYear > globalEndMonth)) {
        globalEndYear = endYear;
        globalEndMonth = endMonthInYear;
      }
    }

    const totalGlobalMonths = (globalEndYear - globalStartYear) * 12 + (globalEndMonth - globalStartMonth + 1);
    const portfolioOutflow = new Array(totalGlobalMonths).fill(0);
    const portfolioInflow = new Array(totalGlobalMonths).fill(0);

    for (const project of allProjects) {
      const [projYear, projMonth] = project.startDate.split('-').map(Number);
      const offset = (projYear - globalStartYear) * 12 + (projMonth - globalStartMonth);

      const phases = buildTimeline(
        project.designApprovalMonths,
        project.reraSetupMonths,
        project.constructionMonths,
        project.handoverMonths
      );
      const totalMonths = getTotalProjectMonths(phases);

      const costItemsRaw = await db.select().from(cfCostItems)
        .where(eq(cfCostItems.cfProjectId, project.id));

      const costItems: CostItemWithPayment[] = costItemsRaw.map(item => ({
        id: item.id,
        name: item.name,
        category: item.category,
        totalAmount: item.totalAmount,
        paymentType: item.paymentType,
        paymentParams: item.paymentParams ? JSON.parse(item.paymentParams) : {},
      }));

      const outflowByCategory = calculateMonthlyOutflow(costItems, phases, totalMonths);
      const salesInflow = calculateSalesInflow(project, phases, totalMonths);
      const totalOutflow = outflowByCategory['total'] || new Array(totalMonths).fill(0);

      let cumOut = 0, cumIn = 0, cumNet = 0, peakExp = 0, peakM = 0;
      for (let m = 0; m < totalMonths; m++) {
        cumOut += totalOutflow[m];
        cumIn += salesInflow[m];
        cumNet += salesInflow[m] - totalOutflow[m];
        if (cumNet < peakExp) { peakExp = cumNet; peakM = m + 1; }

        if (offset + m < totalGlobalMonths) {
          portfolioOutflow[offset + m] += totalOutflow[m];
          portfolioInflow[offset + m] += salesInflow[m];
        }
      }

      projectResults.push({
        id: project.id,
        name: project.name,
        totalCost: cumOut,
        totalSales: cumIn,
        peakExposure: Math.abs(peakExp),
        peakMonth: peakM,
        monthlyOutflow: totalOutflow,
        monthlyInflow: salesInflow,
        startDate: project.startDate,
      });
    }

    // Calculate portfolio cumulative
    const portfolioCumulativeNet: number[] = [];
    let cumNet = 0, portfolioPeakExposure = 0, portfolioPeakMonth = 0;
    for (let m = 0; m < totalGlobalMonths; m++) {
      cumNet += portfolioInflow[m] - portfolioOutflow[m];
      portfolioCumulativeNet.push(cumNet);
      if (cumNet < portfolioPeakExposure) {
        portfolioPeakExposure = cumNet;
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
      portfolioOutflow,
      portfolioInflow,
      portfolioCumulativeNet,
      portfolioPeakExposure: Math.abs(portfolioPeakExposure),
      portfolioPeakMonth,
      portfolioPeakMonthLabel: monthLabels[portfolioPeakMonth - 1] || '',
      totalPortfolioCost: projectResults.reduce((s, p) => s + p.totalCost, 0),
      totalPortfolioSales: projectResults.reduce((s, p) => s + p.totalSales, 0),
    };
  }),

  // ─── Import from Feasibility ───
  importFromFeasibility: publicProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.user) return null;
      const db = await getDb();
      if (!db) return null;

      // Get feasibility study for this project
      const feasResults = await db.select().from(feasibilityStudies)
        .where(and(
          eq(feasibilityStudies.projectId, input.projectId),
          eq(feasibilityStudies.userId, ctx.user.id)
        ));
      const feas = feasResults[0];
      if (!feas) return null;

      // Get project info
      const projResults = await db.select().from(projects)
        .where(eq(projects.id, input.projectId));
      const proj = projResults[0];

      const bua = feas.estimatedBua || 0;
      const plotAreaM2 = (feas.plotArea || 0) * 0.0929;
      const constructionCost = bua * (feas.constructionCostPerSqft || 0);
      const totalUnits = feas.numberOfUnits || 0;

      // Build cost items from feasibility
      const costItems: Array<{
        name: string;
        category: string;
        totalAmount: number;
        paymentType: string;
        paymentParams: any;
      }> = [];

      // Land
      if (feas.landPrice) {
        costItems.push({
          name: 'سعر الأرض',
          category: 'land',
          totalAmount: feas.landPrice,
          paymentType: 'lump_sum',
          paymentParams: { paymentMonth: 1 },
        });
        // Agent commission on land
        const agentComm = feas.landPrice * ((feas.agentCommissionLandPct || 1) / 100);
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

      // Design Fee
      const designFee = constructionCost * ((feas.designFeePct || 2) / 100);
      if (designFee > 0) {
        costItems.push({
          name: 'أتعاب التصميم',
          category: 'consultant_design',
          totalAmount: Math.round(designFee),
          paymentType: 'milestone',
          paymentParams: {
            milestones: [
              { percent: 20, description: 'توقيع العقد', monthOffset: 1 },
              { percent: 20, description: 'إنهاء المفهوم', monthOffset: 2 },
              { percent: 25, description: 'التصميم التفصيلي', monthOffset: 4 },
              { percent: 20, description: 'حزمة المناقصة', monthOffset: 5 },
              { percent: 15, description: 'رخصة البناء', monthOffset: 6 },
            ],
          },
        });
      }

      // Authority fees
      if (feas.authoritiesFee) {
        costItems.push({
          name: 'رسوم الجهات الحكومية',
          category: 'authority_fees',
          totalAmount: feas.authoritiesFee,
          paymentType: 'lump_sum',
          paymentParams: { paymentMonth: 5 },
        });
      }

      // Soil investigation
      if (feas.soilInvestigation) {
        costItems.push({
          name: 'فحص التربة',
          category: 'authority_fees',
          totalAmount: feas.soilInvestigation,
          paymentType: 'lump_sum',
          paymentParams: { paymentMonth: 1 },
        });
      }

      // Topography survey
      if (feas.topographySurvey) {
        costItems.push({
          name: 'المسح الطبوغرافي',
          category: 'authority_fees',
          totalAmount: feas.topographySurvey,
          paymentType: 'lump_sum',
          paymentParams: { paymentMonth: 1 },
        });
      }

      // Construction (Main Contractor)
      if (constructionCost > 0) {
        costItems.push({
          name: 'المقاول الرئيسي',
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
      const supervisionFee = constructionCost * ((feas.supervisionFeePct || 2) / 100);
      if (supervisionFee > 0) {
        costItems.push({
          name: 'أتعاب الإشراف',
          category: 'supervision',
          totalAmount: Math.round(supervisionFee),
          paymentType: 'monthly_fixed',
          paymentParams: {}, // Will be set based on construction phase
        });
      }

      // Marketing
      const totalRevenue = (
        ((feas.gfaResidential || 0) * (feas.saleableResidentialPct || 90) / 100 * (feas.residentialSalePrice || 0)) +
        ((feas.gfaRetail || 0) * (feas.saleableRetailPct || 99) / 100 * (feas.retailSalePrice || 0)) +
        ((feas.gfaOffices || 0) * (feas.saleableOfficesPct || 90) / 100 * (feas.officesSalePrice || 0))
      );

      const marketing = totalRevenue * ((feas.marketingPct || 2) / 100);
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
      const agentSales = totalRevenue * ((feas.agentCommissionSalePct || 5) / 100);
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
      const developerFee = totalRevenue * ((feas.developerFeePct || 5) / 100);
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
      const contingency = constructionCost * ((feas.contingenciesPct || 2) / 100);
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
      const reraFees = (feas.reraOffplanFee || 0) + (totalUnits * (feas.reraUnitFee || 0)) +
        (feas.nocFee || 0) + (feas.escrowFee || 0) + (feas.bankCharges || 0) +
        (feas.surveyorFees || 0) + (feas.reraAuditFees || 0) + (feas.reraInspectionFees || 0);
      if (reraFees > 0) {
        costItems.push({
          name: 'رسوم تنظيمية (ريرا وأخرى)',
          category: 'authority_fees',
          totalAmount: Math.round(reraFees),
          paymentType: 'lump_sum',
          paymentParams: { paymentMonth: 7 }, // During RERA setup
        });
      }

      // Separation fee
      const separationFee = plotAreaM2 * (feas.separationFeePerM2 || 40);
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
      if (feas.communityFee) {
        costItems.push({
          name: 'رسوم المجتمع',
          category: 'other',
          totalAmount: feas.communityFee,
          paymentType: 'lump_sum',
          paymentParams: { paymentMonth: 6 },
        });
      }

      return {
        projectName: proj?.name || feas.projectName,
        totalRevenue: Math.round(totalRevenue),
        costItems,
      };
    }),
});
