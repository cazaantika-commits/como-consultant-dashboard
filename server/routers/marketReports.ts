import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { marketReports } from "../../drizzle/schema";
import { eq, and, desc, like, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { storagePut } from "../storage";
import { invokeLLM } from "../_core/llm";

export const marketReportsRouter = router({
  // Get all reports with filtering
  getReports: protectedProcedure
    .input(z.object({
      source: z.string().optional(),
      reportType: z.string().optional(),
      community: z.string().optional(),
      year: z.number().optional(),
      status: z.string().optional(),
      search: z.string().optional(),
      limit: z.number().default(50),
      offset: z.number().default(0),
    }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const conditions = [eq(marketReports.userId, ctx.user.id)];

      if (input?.source) {
        conditions.push(eq(marketReports.source, input.source as any));
      }
      if (input?.reportType) {
        conditions.push(eq(marketReports.reportType, input.reportType as any));
      }
      if (input?.community) {
        conditions.push(like(marketReports.community, `%${input.community}%`));
      }
      if (input?.year) {
        conditions.push(eq(marketReports.reportYear, input.year));
      }
      if (input?.status) {
        conditions.push(eq(marketReports.processingStatus, input.status as any));
      }

      const results = await db.select().from(marketReports)
        .where(and(...conditions))
        .orderBy(desc(marketReports.createdAt))
        .limit(input?.limit ?? 50)
        .offset(input?.offset ?? 0);

      // Get total count
      const countResult = await db.select({ count: sql<number>`count(*)` })
        .from(marketReports)
        .where(and(...conditions));

      return {
        reports: results,
        total: countResult[0]?.count ?? 0,
      };
    }),

  // Get single report
  getReport: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const report = await db.select().from(marketReports)
        .where(and(eq(marketReports.id, input.id), eq(marketReports.userId, ctx.user.id)))
        .limit(1);

      if (!report[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Report not found" });
      return report[0];
    }),

  // Upload a new market report
  uploadReport: protectedProcedure
    .input(z.object({
      source: z.enum(['CBRE', 'JLL', 'Knight_Frank', 'Savills', 'Colliers', 'Cushman_Wakefield', 'DXBInteract', 'Property_Monitor', 'Bayut', 'Property_Finder', 'DLD', 'Other']),
      reportTitle: z.string().min(1),
      reportType: z.enum(['market_overview', 'residential', 'commercial', 'office', 'hospitality', 'mixed_use', 'land', 'quarterly', 'annual', 'special']),
      region: z.string().optional(),
      community: z.string().optional(),
      reportDate: z.string().optional(),
      reportYear: z.number().optional(),
      reportQuarter: z.number().min(1).max(4).optional(),
      tags: z.string().optional(),
      fileName: z.string(),
      fileData: z.string(), // Base64
      mimeType: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      try {
        // Upload file to S3
        const buffer = Buffer.from(input.fileData, "base64");
        const fileKey = `market-reports/${ctx.user.id}/${Date.now()}-${input.fileName}`;
        const { url } = await storagePut(fileKey, buffer, input.mimeType || "application/pdf");

        // Insert record
        const result = await db.insert(marketReports).values({
          userId: ctx.user.id,
          source: input.source,
          reportTitle: input.reportTitle,
          reportType: input.reportType,
          region: input.region || null,
          community: input.community || null,
          reportDate: input.reportDate || null,
          reportYear: input.reportYear || null,
          reportQuarter: input.reportQuarter || null,
          fileName: input.fileName,
          fileKey,
          fileUrl: url,
          fileSizeBytes: buffer.length,
          mimeType: input.mimeType || "application/pdf",
          tags: input.tags || null,
          processingStatus: "uploaded",
        });

        const reportId = result[0].insertId;

        // Start async processing (extract text + summarize)
        processReportAsync(reportId, url, ctx.user.id).catch(err => {
          console.error(`[MarketReports] Async processing failed for report ${reportId}:`, err);
        });

        return { success: true, id: reportId, url };
      } catch (error) {
        console.error("[MarketReports] Upload error:", error);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to upload report" });
      }
    }),

  // Manually trigger reprocessing
  reprocessReport: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const report = await db.select().from(marketReports)
        .where(and(eq(marketReports.id, input.id), eq(marketReports.userId, ctx.user.id)))
        .limit(1);

      if (!report[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Report not found" });

      await db.update(marketReports)
        .set({ processingStatus: "uploaded", errorMessage: null })
        .where(eq(marketReports.id, input.id));

      processReportAsync(input.id, report[0].fileUrl, ctx.user.id).catch(err => {
        console.error(`[MarketReports] Reprocessing failed for report ${input.id}:`, err);
      });

      return { success: true };
    }),

  // Delete report
  deleteReport: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      await db.delete(marketReports)
        .where(and(eq(marketReports.id, input.id), eq(marketReports.userId, ctx.user.id)));

      return { success: true };
    }),

  // Get stats/summary
  getStats: protectedProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const total = await db.select({ count: sql<number>`count(*)` })
        .from(marketReports)
        .where(eq(marketReports.userId, ctx.user.id));

      const bySource = await db.select({
        source: marketReports.source,
        count: sql<number>`count(*)`,
      })
        .from(marketReports)
        .where(eq(marketReports.userId, ctx.user.id))
        .groupBy(marketReports.source);

      const byType = await db.select({
        type: marketReports.reportType,
        count: sql<number>`count(*)`,
      })
        .from(marketReports)
        .where(eq(marketReports.userId, ctx.user.id))
        .groupBy(marketReports.reportType);

      const ready = await db.select({ count: sql<number>`count(*)` })
        .from(marketReports)
        .where(and(
          eq(marketReports.userId, ctx.user.id),
          eq(marketReports.processingStatus, "ready")
        ));

      return {
        total: total[0]?.count ?? 0,
        ready: ready[0]?.count ?? 0,
        bySource,
        byType,
      };
    }),

  // Search reports by content (for Joelle engines)
  searchReports: protectedProcedure
    .input(z.object({
      query: z.string(),
      community: z.string().optional(),
      limit: z.number().default(10),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const conditions = [
        eq(marketReports.userId, ctx.user.id),
        eq(marketReports.processingStatus, "ready"),
      ];

      if (input.community) {
        conditions.push(like(marketReports.community, `%${input.community}%`));
      }

      // Search in title, summary, and extracted text
      const results = await db.select({
        id: marketReports.id,
        source: marketReports.source,
        reportTitle: marketReports.reportTitle,
        reportType: marketReports.reportType,
        community: marketReports.community,
        reportDate: marketReports.reportDate,
        aiSummary: marketReports.aiSummary,
        keyMetrics: marketReports.keyMetrics,
      })
        .from(marketReports)
        .where(and(
          ...conditions,
          sql`(${marketReports.reportTitle} LIKE ${`%${input.query}%`} OR ${marketReports.aiSummary} LIKE ${`%${input.query}%`} OR ${marketReports.extractedText} LIKE ${`%${input.query}%`})`
        ))
        .orderBy(desc(marketReports.createdAt))
        .limit(input.limit);

      return results;
    }),
});

// Async processing function
async function processReportAsync(reportId: number, fileUrl: string, userId: number) {
  const db = await getDb();
  if (!db) return;

  try {
    // Step 1: Update status to extracting
    await db.update(marketReports)
      .set({ processingStatus: "extracting" })
      .where(eq(marketReports.id, reportId));

    // Step 2: Use LLM with file_url to extract and summarize
    await db.update(marketReports)
      .set({ processingStatus: "summarizing" })
      .where(eq(marketReports.id, reportId));

    const summaryResponse = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are a real estate market analyst. Analyze the uploaded market report and provide:
1. A comprehensive summary in Arabic (500-800 words)
2. Key metrics extracted as JSON

Respond in this exact JSON format:
{
  "summary": "الملخص باللغة العربية...",
  "keyMetrics": {
    "avgPricePerSqft": null,
    "priceChangeYoY": null,
    "supplyUnits": null,
    "demandIndex": null,
    "occupancyRate": null,
    "rentalYield": null,
    "transactionVolume": null,
    "transactionValue": null,
    "topAreas": [],
    "marketTrend": "up/down/stable",
    "keyInsights": []
  }
}`
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Please analyze this market report and extract key information:" },
            { type: "file_url", file_url: { url: fileUrl, mime_type: "application/pdf" } }
          ]
        }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "market_report_analysis",
          strict: true,
          schema: {
            type: "object",
            properties: {
              summary: { type: "string" },
              keyMetrics: {
                type: "object",
                properties: {
                  avgPricePerSqft: { type: ["number", "null"] },
                  priceChangeYoY: { type: ["number", "null"] },
                  supplyUnits: { type: ["number", "null"] },
                  demandIndex: { type: ["number", "null"] },
                  occupancyRate: { type: ["number", "null"] },
                  rentalYield: { type: ["number", "null"] },
                  transactionVolume: { type: ["number", "null"] },
                  transactionValue: { type: ["number", "null"] },
                  topAreas: { type: "array", items: { type: "string" } },
                  marketTrend: { type: "string" },
                  keyInsights: { type: "array", items: { type: "string" } },
                },
                required: ["avgPricePerSqft", "priceChangeYoY", "supplyUnits", "demandIndex", "occupancyRate", "rentalYield", "transactionVolume", "transactionValue", "topAreas", "marketTrend", "keyInsights"],
                additionalProperties: false,
              },
            },
            required: ["summary", "keyMetrics"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = summaryResponse.choices?.[0]?.message?.content;
    if (content) {
      const parsed = JSON.parse(content);
      await db.update(marketReports)
        .set({
          aiSummary: parsed.summary,
          keyMetrics: JSON.stringify(parsed.keyMetrics),
          processingStatus: "ready",
        })
        .where(eq(marketReports.id, reportId));
    } else {
      throw new Error("No content in LLM response");
    }

    console.log(`[MarketReports] Successfully processed report ${reportId}`);
  } catch (error: any) {
    console.error(`[MarketReports] Processing error for report ${reportId}:`, error);
    await db.update(marketReports)
      .set({
        processingStatus: "error",
        errorMessage: error?.message || "Unknown processing error",
      })
      .where(eq(marketReports.id, reportId));
  }
}
