import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { costsCashFlow, marketOverview, competitionPricing, feasibilityStudies, projects, joelleAnalysisStages } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";

const costsInput = z.object({
  projectId: z.number(),
  landPrice: z.number().optional().nullable(),
  agentCommissionLandPct: z.number().optional().nullable(),
  landRegistrationPct: z.number().optional().nullable(),
  soilInvestigation: z.number().optional().nullable(),
  topographySurvey: z.number().optional().nullable(),
  designFeePct: z.number().optional().nullable(),
  supervisionFeePct: z.number().optional().nullable(),
  authoritiesFee: z.number().optional().nullable(),
  separationFeePerM2: z.number().optional().nullable(),
  constructionCostPerSqft: z.number().optional().nullable(),
  communityFee: z.number().optional().nullable(),
  contingenciesPct: z.number().optional().nullable(),
  developerFeePct: z.number().optional().nullable(),
  agentCommissionSalePct: z.number().optional().nullable(),
  marketingPct: z.number().optional().nullable(),
  reraOffplanFee: z.number().optional().nullable(),
  reraUnitFee: z.number().optional().nullable(),
  nocFee: z.number().optional().nullable(),
  escrowFee: z.number().optional().nullable(),
  bankCharges: z.number().optional().nullable(),
  surveyorFees: z.number().optional().nullable(),
  reraAuditFees: z.number().optional().nullable(),
  reraInspectionFees: z.number().optional().nullable(),
  comoProfitSharePct: z.number().optional().nullable(),
  projectDurationMonths: z.number().optional().nullable(),
  constructionStartMonth: z.number().optional().nullable(),
  constructionDurationMonths: z.number().optional().nullable(),
  salesStartMonth: z.number().optional().nullable(),
  salesDurationMonths: z.number().optional().nullable(),
  salesPhase1Pct: z.number().optional().nullable(),
  salesPhase2Pct: z.number().optional().nullable(),
  salesPhase3Pct: z.number().optional().nullable(),
});

export const costsCashFlowRouter = router({
  getByProject: publicProcedure
    .input(z.number())
    .query(async ({ ctx, input }) => {
      if (!ctx.user) return null;
      const db = await getDb();
      if (!db) return null;
      const results = await db.select().from(costsCashFlow)
        .where(and(
          eq(costsCashFlow.projectId, input),
          eq(costsCashFlow.userId, ctx.user.id)
        ));
      return results[0] || null;
    }),

  save: publicProcedure
    .input(costsInput)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const existing = await db.select().from(costsCashFlow)
        .where(and(
          eq(costsCashFlow.projectId, input.projectId),
          eq(costsCashFlow.userId, ctx.user.id)
        ));

      const data: any = {
        landPrice: input.landPrice ?? 0,
        agentCommissionLandPct: (input.agentCommissionLandPct ?? 1).toString(),
        landRegistrationPct: (input.landRegistrationPct ?? 4).toString(),
        soilInvestigation: input.soilInvestigation ?? 0,
        topographySurvey: input.topographySurvey ?? 0,
        designFeePct: (input.designFeePct ?? 2).toString(),
        supervisionFeePct: (input.supervisionFeePct ?? 2).toString(),
        authoritiesFee: input.authoritiesFee ?? 0,
        separationFeePerM2: input.separationFeePerM2 ?? 40,
        constructionCostPerSqft: input.constructionCostPerSqft ?? 0,
        communityFee: input.communityFee ?? 0,
        contingenciesPct: (input.contingenciesPct ?? 2).toString(),
        developerFeePct: (input.developerFeePct ?? 5).toString(),
        agentCommissionSalePct: (input.agentCommissionSalePct ?? 5).toString(),
        marketingPct: (input.marketingPct ?? 2).toString(),
        reraOffplanFee: input.reraOffplanFee ?? 150000,
        reraUnitFee: input.reraUnitFee ?? 850,
        nocFee: input.nocFee ?? 10000,
        escrowFee: input.escrowFee ?? 140000,
        bankCharges: input.bankCharges ?? 20000,
        surveyorFees: input.surveyorFees ?? 12000,
        reraAuditFees: input.reraAuditFees ?? 18000,
        reraInspectionFees: input.reraInspectionFees ?? 70000,
        comoProfitSharePct: (input.comoProfitSharePct ?? 15).toString(),
        projectDurationMonths: input.projectDurationMonths ?? 36,
        constructionStartMonth: input.constructionStartMonth ?? 6,
        constructionDurationMonths: input.constructionDurationMonths ?? 24,
        salesStartMonth: input.salesStartMonth ?? 1,
        salesDurationMonths: input.salesDurationMonths ?? 30,
        salesPhase1Pct: (input.salesPhase1Pct ?? 30).toString(),
        salesPhase2Pct: (input.salesPhase2Pct ?? 40).toString(),
        salesPhase3Pct: (input.salesPhase3Pct ?? 30).toString(),
      };

      if (existing[0]) {
        await db.update(costsCashFlow)
          .set(data)
          .where(eq(costsCashFlow.id, existing[0].id));
        return { id: existing[0].id, updated: true };
      } else {
        const result = await db.insert(costsCashFlow).values({
          userId: ctx.user.id,
          projectId: input.projectId,
          ...data,
        });
        return { id: Number(result[0].insertId), updated: false };
      }
    }),

  toggleApproval: publicProcedure
    .input(z.object({ projectId: z.number(), approved: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const existing = await db.select().from(costsCashFlow)
        .where(and(
          eq(costsCashFlow.projectId, input.projectId),
          eq(costsCashFlow.userId, ctx.user.id)
        ));

      if (existing[0]) {
        await db.update(costsCashFlow)
          .set({
            isApproved: input.approved ? 1 : 0,
            approvedAt: input.approved ? new Date() : null,
          })
          .where(eq(costsCashFlow.id, existing[0].id));
      }
      return { success: true };
    }),

  generateSmartReport: publicProcedure
    .input(z.object({ projectId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const projectResults = await db.select().from(projects)
        .where(and(eq(projects.id, input.projectId), eq(projects.userId, ctx.user.id)));
      if (!projectResults[0]) throw new Error("Project not found");
      const project = projectResults[0];

      const feasResults = await db.select().from(feasibilityStudies)
        .where(and(eq(feasibilityStudies.projectId, input.projectId), eq(feasibilityStudies.userId, ctx.user.id)));
      const feasStudy = feasResults[0] || null;

      const moResults = await db.select().from(marketOverview)
        .where(and(eq(marketOverview.projectId, input.projectId), eq(marketOverview.userId, ctx.user.id)));
      const mo = moResults[0] || null;

      const plotArea = feasStudy?.plotArea || parseFloat(String(project.plotAreaSqft || '0')) || 0;
      const totalGFA = feasStudy 
        ? ((feasStudy.gfaResidential || 0) + (feasStudy.gfaRetail || 0) + (feasStudy.gfaOffices || 0))
        : parseFloat(String(project.gfaSqft || '0')) || 0;
      const bua = feasStudy?.estimatedBua || project.bua || 0;
      const community = feasStudy?.community || project.areaCode || 'غير محدد';
      const permittedUse = project.permittedUse || feasStudy?.landUse || 'غير محدد';
      const finishingQuality = mo?.finishingQuality || 'ممتاز';

      const reportPrompt = `أنتِ جويل، محللة التكاليف العقارية في Como Developments. اكتبي تقريراً ذكياً عن تكاليف المشروع والجدول الزمني:

معلومات المشروع:
- الاسم: ${project.name}
- المنطقة: ${community}
- الاستعمال المسموح: ${permittedUse}
- جودة التشطيب: ${finishingQuality}
- مساحة الأرض: ${plotArea > 0 ? plotArea.toLocaleString() : 'غير محدد'} قدم²
- المساحة الإجمالية GFA: ${totalGFA > 0 ? totalGFA.toLocaleString() : 'غير محدد'} قدم²
- BUA: ${bua > 0 ? bua.toLocaleString() : 'غير محدد'} قدم²

اكتبي تقريراً يتضمن:
1. تحليل تكاليف البناء في المنطقة (سعر القدم المربع)
2. تقدير التكاليف الإجمالية للمشروع
3. الجدول الزمني المقترح (مدة البناء، مراحل المبيعات)
4. تحليل المخاطر المالية
5. توصيات لتحسين الربحية

اجعلي التقرير مهنياً (600-1000 كلمة) باللغة العربية.`;

      const recsPrompt = `أنتِ جويل، محللة التكاليف العقارية. بناءً على تحليلك لمشروع "${project.name}" في "${community}":

BUA: ${bua > 0 ? bua.toLocaleString() : 'غير محدد'} قدم²
جودة التشطيب: ${finishingQuality}
الاستعمال المسموح: ${permittedUse}

أعطيني توصياتك بصيغة JSON فقط (بدون أي نص إضافي):
{
  "constructionCostPerSqft": number,
  "designFeePct": number,
  "supervisionFeePct": number,
  "contingenciesPct": number,
  "projectDurationMonths": number,
  "constructionStartMonth": number,
  "constructionDurationMonths": number,
  "salesStartMonth": number,
  "salesDurationMonths": number,
  "summary": "ملخص قصير بالعربي"
}

ملاحظات:
- تكلفة البناء بالدرهم لكل قدم مربع (عادة 350-600 AED/sqft حسب الجودة)
- نسب التصميم عادة 2-5%
- نسب الإشراف عادة 2-4%
- الاحتياطي عادة 2-5%
- مدة المشروع عادة 30-48 شهر
- بدء البناء عادة شهر 4-8
- مدة البناء عادة 18-30 شهر
- بدء المبيعات عادة شهر 1-3
- مدة المبيعات عادة 24-36 شهر`;

      try {
        const [reportResponse, recsResponse] = await Promise.all([
          invokeLLM({
            messages: [
              { role: "system", content: "أنتِ جويل، محللة التكاليف العقارية في Como Developments. تقاريرك مهنية ومبنية على تحليل معمق." },
              { role: "user", content: reportPrompt },
            ],
          }),
          invokeLLM({
            messages: [
              { role: "system", content: "أنتِ جويل، محللة التكاليف العقارية. أجيبي بصيغة JSON فقط بدون أي نص إضافي أو markdown." },
              { role: "user", content: recsPrompt },
            ],
          }),
        ]);

        const smartReport = reportResponse.choices[0]?.message?.content || "لم يتم إنشاء التقرير";
        const recsRaw = recsResponse.choices[0]?.message?.content || "{}";
        const cleanJson = recsRaw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

        const existing = await db.select().from(costsCashFlow)
          .where(and(
            eq(costsCashFlow.projectId, input.projectId),
            eq(costsCashFlow.userId, ctx.user.id)
          ));

        if (existing[0]) {
          await db.update(costsCashFlow)
            .set({ aiSmartReport: smartReport, aiRecommendationsJson: cleanJson })
            .where(eq(costsCashFlow.id, existing[0].id));
        } else {
          await db.insert(costsCashFlow).values({
            userId: ctx.user.id,
            projectId: input.projectId,
            aiSmartReport: smartReport,
            aiRecommendationsJson: cleanJson,
          });
        }

        return { smartReport, recommendations: cleanJson };
      } catch (error: any) {
        console.error("Error generating costs report:", error);
        throw new Error("فشل في إنشاء التقرير: " + error.message);
      }
    }),

  // --- DATA SYNC STATUS: compare timestamps across sections ---
  getSyncStatus: publicProcedure
    .input(z.number()) // projectId
    .query(async ({ ctx, input: projectId }) => {
      if (!ctx.user) return null;
      const db = await getDb();
      if (!db) return null;

      // Get feasibility study updatedAt
      const feasRows = await db.select({ updatedAt: feasibilityStudies.updatedAt })
        .from(feasibilityStudies)
        .where(and(eq(feasibilityStudies.projectId, projectId), eq(feasibilityStudies.userId, ctx.user.id)));
      const feasUpdatedAt = feasRows[0]?.updatedAt ? new Date(feasRows[0].updatedAt) : null;

      // Get competition pricing updatedAt (Joel's prices applied here)
      const cpRows = await db.select({ updatedAt: competitionPricing.updatedAt })
        .from(competitionPricing)
        .where(and(eq(competitionPricing.projectId, projectId), eq(competitionPricing.userId, ctx.user.id)));
      const cpUpdatedAt = cpRows[0]?.updatedAt ? new Date(cpRows[0].updatedAt) : null;

      // Get market overview updatedAt (Joel's unit mix applied here)
      const moRows = await db.select({ updatedAt: marketOverview.updatedAt })
        .from(marketOverview)
        .where(and(eq(marketOverview.projectId, projectId), eq(marketOverview.userId, ctx.user.id)));
      const moUpdatedAt = moRows[0]?.updatedAt ? new Date(moRows[0].updatedAt) : null;

      // Get costs cash flow updatedAt
      const costsRows = await db.select({ updatedAt: costsCashFlow.updatedAt })
        .from(costsCashFlow)
        .where(and(eq(costsCashFlow.projectId, projectId), eq(costsCashFlow.userId, ctx.user.id)));
      const costsUpdatedAt = costsRows[0]?.updatedAt ? new Date(costsRows[0].updatedAt) : null;

      // Get Joel's last completed Engine 11 run
      const joelRows = await db.select({ updatedAt: joelleAnalysisStages.updatedAt })
        .from(joelleAnalysisStages)
        .where(and(
          eq(joelleAnalysisStages.projectId, projectId),
          eq(joelleAnalysisStages.userId, ctx.user.id),
          eq(joelleAnalysisStages.stageNumber, 11),
          eq(joelleAnalysisStages.stageStatus, 'completed')
        ));
      const joelLastRun = joelRows[0]?.updatedAt ? new Date(joelRows[0].updatedAt) : null;

      // Determine sync issues
      const warnings: string[] = [];

      // If Joel ran but competition pricing is older than Joel's run
      if (joelLastRun && cpUpdatedAt && cpUpdatedAt < joelLastRun) {
        const diffHours = Math.round((joelLastRun.getTime() - cpUpdatedAt.getTime()) / 3600000);
        warnings.push(`جويل أجرت تحليلاً جديداً منذ ${diffHours} ساعة — أسعار التسعير قد تكون غير محدّثة`);
      }

      // If feasibility study is newer than costs cash flow
      if (feasUpdatedAt && costsUpdatedAt && feasUpdatedAt > costsUpdatedAt) {
        const diffHours = Math.round((feasUpdatedAt.getTime() - costsUpdatedAt.getTime()) / 3600000);
        if (diffHours > 0) {
          warnings.push(`دراسة الجدوى تحدّثت منذ ${diffHours} ساعة — اضغط على "مزامنة التدفقات" لتحديث التدفقات النقدية`);
        }
      }

      return {
        feasUpdatedAt: feasUpdatedAt?.toISOString() || null,
        cpUpdatedAt: cpUpdatedAt?.toISOString() || null,
        moUpdatedAt: moUpdatedAt?.toISOString() || null,
        costsUpdatedAt: costsUpdatedAt?.toISOString() || null,
        joelLastRun: joelLastRun?.toISOString() || null,
        warnings,
        isOutOfSync: warnings.length > 0,
      };
    }),
});
