import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { predictionRecords, actualOutcomes, modelAccuracyLog, projects } from "../../drizzle/schema";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

const PREDICTION_TYPES = [
  'price_per_sqft', 'total_revenue', 'absorption_rate', 'sell_out_months',
  'demand_units', 'construction_cost', 'roi', 'irr'
] as const;

const PREDICTION_TYPE_LABELS: Record<string, string> = {
  price_per_sqft: "سعر القدم المربع",
  total_revenue: "إجمالي الإيرادات",
  absorption_rate: "معدل الاستيعاب",
  sell_out_months: "مدة البيع الكامل",
  demand_units: "وحدات الطلب",
  construction_cost: "تكلفة البناء",
  roi: "العائد على الاستثمار",
  irr: "معدل العائد الداخلي",
};

const PREDICTION_UNITS: Record<string, string> = {
  price_per_sqft: "AED/sqft",
  total_revenue: "AED",
  absorption_rate: "units/year",
  sell_out_months: "months",
  demand_units: "units",
  construction_cost: "AED",
  roi: "%",
  irr: "%",
};

export const selfLearningRouter = router({
  // Get prediction types metadata
  getMetadata: protectedProcedure
    .query(() => ({
      types: PREDICTION_TYPES,
      labels: PREDICTION_TYPE_LABELS,
      units: PREDICTION_UNITS,
    })),

  // Get all predictions for a project
  getPredictions: protectedProcedure
    .input(z.object({
      projectId: z.number().optional(),
      predictionType: z.string().optional(),
      limit: z.number().default(50),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const conditions = [eq(predictionRecords.userId, ctx.user.id)];
      if (input.projectId) conditions.push(eq(predictionRecords.projectId, input.projectId));
      if (input.predictionType) conditions.push(eq(predictionRecords.predictionType, input.predictionType as any));

      const predictions = await db.select()
        .from(predictionRecords)
        .where(and(...conditions))
        .orderBy(desc(predictionRecords.createdAt))
        .limit(input.limit);

      return predictions;
    }),

  // Save a prediction (called by Joelle engines after analysis)
  savePrediction: protectedProcedure
    .input(z.object({
      projectId: z.number(),
      predictionType: z.enum(PREDICTION_TYPES),
      predictedValue: z.number(),
      predictedUnit: z.string().optional(),
      targetDate: z.string().optional(),
      engineVersion: z.string().optional(),
      confidenceLevel: z.number().min(0).max(100).optional(),
      inputDataJson: z.string().optional(),
      methodology: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const result = await db.insert(predictionRecords).values({
        userId: ctx.user.id,
        projectId: input.projectId,
        predictionType: input.predictionType,
        predictedValue: String(input.predictedValue),
        predictedUnit: input.predictedUnit || PREDICTION_UNITS[input.predictionType] || null,
        predictionDate: new Date().toISOString().slice(0, 19).replace('T', ' '),
        targetDate: input.targetDate || null,
        engineVersion: input.engineVersion || "v1.0",
        confidenceLevel: input.confidenceLevel ? String(input.confidenceLevel) : null,
        inputDataJson: input.inputDataJson || null,
        methodology: input.methodology || null,
      });

      return { success: true, id: result[0].insertId };
    }),

  // Save multiple predictions at once (batch from engine run)
  savePredictionBatch: protectedProcedure
    .input(z.object({
      projectId: z.number(),
      predictions: z.array(z.object({
        predictionType: z.enum(PREDICTION_TYPES),
        predictedValue: z.number(),
        confidenceLevel: z.number().min(0).max(100).optional(),
        methodology: z.string().optional(),
      })),
      engineVersion: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
      const values = input.predictions.map(p => ({
        userId: ctx.user.id,
        projectId: input.projectId,
        predictionType: p.predictionType,
        predictedValue: String(p.predictedValue),
        predictedUnit: PREDICTION_UNITS[p.predictionType] || null,
        predictionDate: now,
        engineVersion: input.engineVersion || "v1.0",
        confidenceLevel: p.confidenceLevel ? String(p.confidenceLevel) : null,
        methodology: p.methodology || null,
      }));

      await db.insert(predictionRecords).values(values);
      return { success: true, count: values.length };
    }),

  // Get actual outcomes for a project
  getOutcomes: protectedProcedure
    .input(z.object({
      projectId: z.number().optional(),
      outcomeType: z.string().optional(),
      limit: z.number().default(50),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const conditions = [eq(actualOutcomes.userId, ctx.user.id)];
      if (input.projectId) conditions.push(eq(actualOutcomes.projectId, input.projectId));
      if (input.outcomeType) conditions.push(eq(actualOutcomes.outcomeType, input.outcomeType as any));

      const outcomes = await db.select()
        .from(actualOutcomes)
        .where(and(...conditions))
        .orderBy(desc(actualOutcomes.createdAt))
        .limit(input.limit);

      return outcomes;
    }),

  // Record an actual outcome
  recordOutcome: protectedProcedure
    .input(z.object({
      projectId: z.number(),
      predictionId: z.number().optional(),
      outcomeType: z.enum(PREDICTION_TYPES),
      actualValue: z.number(),
      actualUnit: z.string().optional(),
      recordedDate: z.string(),
      source: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const result = await db.insert(actualOutcomes).values({
        userId: ctx.user.id,
        projectId: input.projectId,
        predictionId: input.predictionId || null,
        outcomeType: input.outcomeType,
        actualValue: String(input.actualValue),
        actualUnit: input.actualUnit || PREDICTION_UNITS[input.outcomeType] || null,
        recordedDate: input.recordedDate,
        source: input.source || null,
        notes: input.notes || null,
      });

      // Auto-calculate accuracy after recording
      calculateAccuracy(ctx.user.id, input.projectId, input.outcomeType).catch(err => {
        console.error("[SelfLearning] Accuracy calculation error:", err);
      });

      return { success: true, id: result[0].insertId };
    }),

  // Get comparison: predictions vs actuals for a project
  getComparison: protectedProcedure
    .input(z.object({
      projectId: z.number(),
      predictionType: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const predConditions = [
        eq(predictionRecords.userId, ctx.user.id),
        eq(predictionRecords.projectId, input.projectId),
      ];
      if (input.predictionType) {
        predConditions.push(eq(predictionRecords.predictionType, input.predictionType as any));
      }

      const predictions = await db.select()
        .from(predictionRecords)
        .where(and(...predConditions))
        .orderBy(desc(predictionRecords.createdAt));

      const outConditions = [
        eq(actualOutcomes.userId, ctx.user.id),
        eq(actualOutcomes.projectId, input.projectId),
      ];
      if (input.predictionType) {
        outConditions.push(eq(actualOutcomes.outcomeType, input.predictionType as any));
      }

      const outcomes = await db.select()
        .from(actualOutcomes)
        .where(and(...outConditions))
        .orderBy(desc(actualOutcomes.createdAt));

      // Match predictions with outcomes
      const comparisons = predictions.map(pred => {
        const matchedOutcome = outcomes.find(o =>
          o.outcomeType === pred.predictionType &&
          (o.predictionId === pred.id || !o.predictionId)
        );

        let deviation = null;
        let deviationPct = null;
        if (matchedOutcome) {
          deviation = Number(matchedOutcome.actualValue) - Number(pred.predictedValue);
          deviationPct = Number(pred.predictedValue) !== 0
            ? (deviation / Number(pred.predictedValue)) * 100
            : null;
        }

        return {
          prediction: pred,
          outcome: matchedOutcome || null,
          deviation,
          deviationPct: deviationPct ? Math.round(deviationPct * 100) / 100 : null,
          direction: deviation === null ? null : deviation > 0 ? "under" : deviation < 0 ? "over" : "exact",
        };
      });

      return comparisons;
    }),

  // Get accuracy log
  getAccuracyLog: protectedProcedure
    .input(z.object({
      projectId: z.number().optional(),
      predictionType: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const conditions = [eq(modelAccuracyLog.userId, ctx.user.id)];
      if (input.projectId) conditions.push(eq(modelAccuracyLog.projectId, input.projectId));
      if (input.predictionType) conditions.push(eq(modelAccuracyLog.predictionType, input.predictionType as any));

      const logs = await db.select()
        .from(modelAccuracyLog)
        .where(and(...conditions))
        .orderBy(desc(modelAccuracyLog.createdAt));

      return logs;
    }),

  // Get overall accuracy dashboard
  getAccuracyDashboard: protectedProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Get total predictions and outcomes
      const totalPredictions = await db.select({ count: sql<number>`count(*)` })
        .from(predictionRecords)
        .where(eq(predictionRecords.userId, ctx.user.id));

      const totalOutcomes = await db.select({ count: sql<number>`count(*)` })
        .from(actualOutcomes)
        .where(eq(actualOutcomes.userId, ctx.user.id));

      // Get accuracy by type
      const accuracyByType = await db.select({
        predictionType: modelAccuracyLog.predictionType,
        avgMape: sql<number>`AVG(${modelAccuracyLog.mape})`,
        totalSamples: sql<number>`SUM(${modelAccuracyLog.sampleSize})`,
        latestBias: modelAccuracyLog.biasDirection,
      })
        .from(modelAccuracyLog)
        .where(eq(modelAccuracyLog.userId, ctx.user.id))
        .groupBy(modelAccuracyLog.predictionType);

      // Get predictions by project
      const predictionsByProject = await db.select({
        projectId: predictionRecords.projectId,
        count: sql<number>`count(*)`,
        projectName: projects.name,
      })
        .from(predictionRecords)
        .innerJoin(projects, eq(predictionRecords.projectId, projects.id))
        .where(eq(predictionRecords.userId, ctx.user.id))
        .groupBy(predictionRecords.projectId, projects.name);

      return {
        totalPredictions: totalPredictions[0]?.count ?? 0,
        totalOutcomes: totalOutcomes[0]?.count ?? 0,
        accuracyByType: accuracyByType.map(a => ({
          type: a.predictionType,
          label: PREDICTION_TYPE_LABELS[a.predictionType] || a.predictionType,
          avgMape: a.avgMape ? Math.round(Number(a.avgMape) * 100) / 100 : null,
          totalSamples: a.totalSamples || 0,
          bias: a.latestBias,
        })),
        predictionsByProject,
      };
    }),
});

// Auto-calculate accuracy when new outcomes are recorded
async function calculateAccuracy(userId: number, projectId: number, outcomeType: string) {
  const db = await getDb();
  if (!db) return;

  // Get all matched prediction-outcome pairs for this type
  const predictions = await db.select()
    .from(predictionRecords)
    .where(and(
      eq(predictionRecords.userId, userId),
      eq(predictionRecords.projectId, projectId),
      eq(predictionRecords.predictionType, outcomeType as any)
    ));

  const outcomes = await db.select()
    .from(actualOutcomes)
    .where(and(
      eq(actualOutcomes.userId, userId),
      eq(actualOutcomes.projectId, projectId),
      eq(actualOutcomes.outcomeType, outcomeType as any)
    ));

  if (predictions.length === 0 || outcomes.length === 0) return;

  // Calculate MAPE
  let totalAbsError = 0;
  let matchCount = 0;
  let totalBias = 0;

  for (const pred of predictions) {
    const outcome = outcomes.find(o => o.predictionId === pred.id) || outcomes[0];
    if (outcome) {
      const predicted = Number(pred.predictedValue);
      const actual = Number(outcome.actualValue);
      if (predicted !== 0) {
        const absError = Math.abs((actual - predicted) / predicted);
        totalAbsError += absError;
        totalBias += (actual - predicted);
        matchCount++;
      }
    }
  }

  if (matchCount === 0) return;

  const mape = (totalAbsError / matchCount) * 100;
  const avgBias = totalBias / matchCount;
  const biasDirection = avgBias > 0.01 ? "under" : avgBias < -0.01 ? "over" : "neutral";

  await db.insert(modelAccuracyLog).values({
    userId,
    projectId,
    predictionType: outcomeType as any,
    mape: String(Math.round(mape * 10000) / 10000),
    biasDirection: biasDirection as any,
    biasAmount: String(Math.round(Math.abs(avgBias) * 100) / 100),
    sampleSize: matchCount,
    periodStart: predictions[predictions.length - 1]?.predictionDate || null,
    periodEnd: new Date().toISOString().slice(0, 19).replace('T', ' '),
  });

  console.log(`[SelfLearning] Accuracy calculated for project ${projectId}, type ${outcomeType}: MAPE=${mape.toFixed(2)}%, bias=${biasDirection}`);
}
