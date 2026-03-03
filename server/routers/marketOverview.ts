import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { marketOverview, feasibilityStudies, projects } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";

const marketOverviewInput = z.object({
  projectId: z.number(),
  // توزيع الوحدات السكنية
  residentialStudioPct: z.number().optional().nullable(),
  residentialStudioAvgArea: z.number().optional().nullable(),
  residential1brPct: z.number().optional().nullable(),
  residential1brAvgArea: z.number().optional().nullable(),
  residential2brPct: z.number().optional().nullable(),
  residential2brAvgArea: z.number().optional().nullable(),
  residential3brPct: z.number().optional().nullable(),
  residential3brAvgArea: z.number().optional().nullable(),
  // توزيع المحلات
  retailSmallPct: z.number().optional().nullable(),
  retailSmallAvgArea: z.number().optional().nullable(),
  retailMediumPct: z.number().optional().nullable(),
  retailMediumAvgArea: z.number().optional().nullable(),
  retailLargePct: z.number().optional().nullable(),
  retailLargeAvgArea: z.number().optional().nullable(),
  // توزيع المكاتب
  officeSmallPct: z.number().optional().nullable(),
  officeSmallAvgArea: z.number().optional().nullable(),
  officeMediumPct: z.number().optional().nullable(),
  officeMediumAvgArea: z.number().optional().nullable(),
  officeLargePct: z.number().optional().nullable(),
  officeLargeAvgArea: z.number().optional().nullable(),
  // جودة التشطيب
  finishingQuality: z.string().optional().nullable(),
});

export const marketOverviewRouter = router({
  // Get market overview for a project
  getByProject: publicProcedure
    .input(z.number())
    .query(async ({ ctx, input }) => {
      if (!ctx.user) return null;
      const db = await getDb();
      if (!db) return null;
      const results = await db.select().from(marketOverview)
        .where(and(
          eq(marketOverview.projectId, input),
          eq(marketOverview.userId, ctx.user.id)
        ));
      return results[0] || null;
    }),

  // Save or update market overview
  save: publicProcedure
    .input(marketOverviewInput)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const existing = await db.select().from(marketOverview)
        .where(and(
          eq(marketOverview.projectId, input.projectId),
          eq(marketOverview.userId, ctx.user.id)
        ));

      const data: any = {
        residentialStudioPct: input.residentialStudioPct?.toString() ?? '0',
        residentialStudioAvgArea: input.residentialStudioAvgArea ?? 0,
        residential1brPct: input.residential1brPct?.toString() ?? '0',
        residential1brAvgArea: input.residential1brAvgArea ?? 0,
        residential2brPct: input.residential2brPct?.toString() ?? '0',
        residential2brAvgArea: input.residential2brAvgArea ?? 0,
        residential3brPct: input.residential3brPct?.toString() ?? '0',
        residential3brAvgArea: input.residential3brAvgArea ?? 0,
        retailSmallPct: input.retailSmallPct?.toString() ?? '0',
        retailSmallAvgArea: input.retailSmallAvgArea ?? 0,
        retailMediumPct: input.retailMediumPct?.toString() ?? '0',
        retailMediumAvgArea: input.retailMediumAvgArea ?? 0,
        retailLargePct: input.retailLargePct?.toString() ?? '0',
        retailLargeAvgArea: input.retailLargeAvgArea ?? 0,
        officeSmallPct: input.officeSmallPct?.toString() ?? '0',
        officeSmallAvgArea: input.officeSmallAvgArea ?? 0,
        officeMediumPct: input.officeMediumPct?.toString() ?? '0',
        officeMediumAvgArea: input.officeMediumAvgArea ?? 0,
        officeLargePct: input.officeLargePct?.toString() ?? '0',
        officeLargeAvgArea: input.officeLargeAvgArea ?? 0,
        finishingQuality: input.finishingQuality ?? 'ممتاز',
      };

      if (existing[0]) {
        await db.update(marketOverview)
          .set(data)
          .where(eq(marketOverview.id, existing[0].id));
        return { id: existing[0].id, updated: true };
      } else {
        const result = await db.insert(marketOverview).values({
          userId: ctx.user.id,
          projectId: input.projectId,
          ...data,
        });
        return { id: Number(result[0].insertId), updated: false };
      }
    }),

  // Approve/unapprove the stage
  toggleApproval: publicProcedure
    .input(z.object({ projectId: z.number(), approved: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const existing = await db.select().from(marketOverview)
        .where(and(
          eq(marketOverview.projectId, input.projectId),
          eq(marketOverview.userId, ctx.user.id)
        ));

      if (existing[0]) {
        await db.update(marketOverview)
          .set({
            isApproved: input.approved ? 1 : 0,
            approvedAt: input.approved ? new Date() : null,
          })
          .where(eq(marketOverview.id, existing[0].id));
      }
      return { success: true };
    }),

  // Joel AI Smart Report - Generate market overview report
  generateSmartReport: publicProcedure
    .input(z.number()) // projectId
    .mutation(async ({ ctx, input: projectId }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Get project data
      const projectResults = await db.select().from(projects)
        .where(and(eq(projects.id, projectId), eq(projects.userId, ctx.user.id)));
      if (!projectResults[0]) throw new Error("Project not found");
      const project = projectResults[0];

      // Get feasibility study data if exists
      const feasResults = await db.select().from(feasibilityStudies)
        .where(and(eq(feasibilityStudies.projectId, projectId), eq(feasibilityStudies.userId, ctx.user.id)));
      const feasStudy = feasResults[0] || null;

      // Build context about the project
      const projectType = [];
      if (feasStudy?.gfaResidential && feasStudy.gfaResidential > 0) projectType.push('سكني');
      if (feasStudy?.gfaRetail && feasStudy.gfaRetail > 0) projectType.push('تجاري');
      if (feasStudy?.gfaOffices && feasStudy.gfaOffices > 0) projectType.push('مكاتب');
      const projectTypeStr = projectType.length > 0 ? projectType.join(' + ') : (project.description || 'غير محدد');

      const saleableResArea = feasStudy ? (feasStudy.gfaResidential || 0) * ((feasStudy.saleableResidentialPct || 90) / 100) : 0;
      const saleableRetArea = feasStudy ? (feasStudy.gfaRetail || 0) * ((feasStudy.saleableRetailPct || 99) / 100) : 0;
      const saleableOffArea = feasStudy ? (feasStudy.gfaOffices || 0) * ((feasStudy.saleableOfficesPct || 90) / 100) : 0;

      const reportPrompt = `أنتِ جويل، محللة السوق العقاري في شركة Como Developments. اكتبي تقريراً ذكياً شاملاً عن النظرة العامة والسوق للمشروع التالي:

معلومات المشروع:
- الاسم: ${project.name}
- المنطقة: ${feasStudy?.community || project.areaCode || 'غير محدد'}
- رقم القطعة: ${feasStudy?.plotNumber || project.plotNumber || 'غير محدد'}
- نوع المشروع: ${projectTypeStr}
- الوصف: ${feasStudy?.projectDescription || project.description || 'غير محدد'}
- الاستعمال: ${feasStudy?.landUse || 'غير محدد'}

المساحات:
- مساحة الأرض: ${feasStudy?.plotArea?.toLocaleString() || 0} قدم²
- GFA السكني: ${feasStudy?.gfaResidential?.toLocaleString() || 0} قدم²
- GFA التجاري: ${feasStudy?.gfaRetail?.toLocaleString() || 0} قدم²
- GFA المكاتب: ${feasStudy?.gfaOffices?.toLocaleString() || 0} قدم²
- المساحة القابلة للبيع (سكني): ${Math.round(saleableResArea).toLocaleString()} قدم²
- المساحة القابلة للبيع (تجاري): ${Math.round(saleableRetArea).toLocaleString()} قدم²
- المساحة القابلة للبيع (مكاتب): ${Math.round(saleableOffArea).toLocaleString()} قدم²

اكتبي تقريراً يتضمن:
1. نظرة عامة على المنطقة وموقع المشروع
2. تحليل السوق العقاري في المنطقة (العرض والطلب)
3. الاتجاهات السعرية الحالية والمتوقعة
4. الفرص والتحديات في المنطقة
5. تقييم عام لجاذبية المشروع

اجعلي التقرير مهنياً ومفصلاً (600-1000 كلمة) باللغة العربية.`;

      const recommendationsPrompt = `أنتِ جويل، محللة السوق العقاري في Como Developments. بناءً على تحليلك لمشروع "${project.name}" في منطقة "${feasStudy?.community || project.areaCode || 'غير محدد'}":

نوع المشروع: ${projectTypeStr}
المساحة القابلة للبيع (سكني): ${Math.round(saleableResArea).toLocaleString()} قدم²
المساحة القابلة للبيع (تجاري): ${Math.round(saleableRetArea).toLocaleString()} قدم²
المساحة القابلة للبيع (مكاتب): ${Math.round(saleableOffArea).toLocaleString()} قدم²

أعطيني توصياتك بصيغة JSON فقط (بدون أي نص إضافي) بالشكل التالي:
{
  "residential": {
    "studio": { "recommended": true/false, "pct": number, "avgArea": number },
    "oneBr": { "recommended": true/false, "pct": number, "avgArea": number },
    "twoBr": { "recommended": true/false, "pct": number, "avgArea": number },
    "threeBr": { "recommended": true/false, "pct": number, "avgArea": number }
  },
  "retail": {
    "hasRetail": true/false,
    "small": { "pct": number, "avgArea": number },
    "medium": { "pct": number, "avgArea": number },
    "large": { "pct": number, "avgArea": number }
  },
  "offices": {
    "hasOffices": true/false,
    "small": { "pct": number, "avgArea": number },
    "medium": { "pct": number, "avgArea": number },
    "large": { "pct": number, "avgArea": number }
  },
  "finishingQuality": "ممتاز" أو "جيد" أو "عادي",
  "summary": "ملخص قصير للتوصيات بالعربي (2-3 أسطر)"
}

ملاحظات:
- النسب في كل فئة يجب أن يكون مجموعها 100% (فقط للأنواع الموصى بها)
- إذا لم يكن هناك مساحة تجارية (GFA تجاري = 0)، اجعل hasRetail = false واترك النسب 0
- إذا لم يكن هناك مساحة مكاتب (GFA مكاتب = 0)، اجعل hasOffices = false واترك النسب 0
- المساحات بالقدم المربع
- اقترح فقط أنواع الوحدات المناسبة للمشروع (ليس بالضرورة الأربعة)`;

      try {
        // Generate both in parallel
        const [reportResponse, recsResponse] = await Promise.all([
          invokeLLM({
            messages: [
              { role: "system", content: "أنتِ جويل، محللة السوق العقاري في Como Developments. تقاريرك مهنية ومبنية على تحليل معمق." },
              { role: "user", content: reportPrompt },
            ],
          }),
          invokeLLM({
            messages: [
              { role: "system", content: "أنتِ جويل، محللة السوق العقاري. أجيبي بصيغة JSON فقط بدون أي نص إضافي أو markdown." },
              { role: "user", content: recommendationsPrompt },
            ],
          }),
        ]);

        const smartReport = reportResponse.choices[0]?.message?.content || "لم يتم إنشاء التقرير";
        const recsRaw = recsResponse.choices[0]?.message?.content || "{}";
        
        // Clean JSON response (remove markdown code blocks if any)
        const cleanJson = recsRaw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

        // Ensure existing record or create one
        const existing = await db.select().from(marketOverview)
          .where(and(
            eq(marketOverview.projectId, projectId),
            eq(marketOverview.userId, ctx.user.id)
          ));

        if (existing[0]) {
          await db.update(marketOverview)
            .set({
              aiSmartReport: smartReport,
              aiRecommendationsJson: cleanJson,
              aiReportGeneratedAt: new Date(),
            })
            .where(eq(marketOverview.id, existing[0].id));
        } else {
          await db.insert(marketOverview).values({
            userId: ctx.user.id,
            projectId: projectId,
            aiSmartReport: smartReport,
            aiRecommendationsJson: cleanJson,
            aiReportGeneratedAt: new Date(),
          });
        }

        return { success: true, smartReport, recommendations: cleanJson };
      } catch (error: any) {
        throw new Error(`فشل في إنشاء التقرير الذكي: ${error.message}`);
      }
    }),

  // Apply Joel recommendations to fields
  applyRecommendations: publicProcedure
    .input(z.object({
      projectId: z.number(),
      recommendations: z.string(), // JSON string
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      try {
        const recs = JSON.parse(input.recommendations);
        
        const data: any = {};
        
        // Apply residential recommendations
        if (recs.residential) {
          data.residentialStudioPct = (recs.residential.studio?.recommended ? recs.residential.studio.pct : 0)?.toString() ?? '0';
          data.residentialStudioAvgArea = recs.residential.studio?.recommended ? recs.residential.studio.avgArea : 0;
          data.residential1brPct = (recs.residential.oneBr?.recommended ? recs.residential.oneBr.pct : 0)?.toString() ?? '0';
          data.residential1brAvgArea = recs.residential.oneBr?.recommended ? recs.residential.oneBr.avgArea : 0;
          data.residential2brPct = (recs.residential.twoBr?.recommended ? recs.residential.twoBr.pct : 0)?.toString() ?? '0';
          data.residential2brAvgArea = recs.residential.twoBr?.recommended ? recs.residential.twoBr.avgArea : 0;
          data.residential3brPct = (recs.residential.threeBr?.recommended ? recs.residential.threeBr.pct : 0)?.toString() ?? '0';
          data.residential3brAvgArea = recs.residential.threeBr?.recommended ? recs.residential.threeBr.avgArea : 0;
        }
        
        // Apply retail recommendations
        if (recs.retail) {
          data.retailSmallPct = (recs.retail.hasRetail ? recs.retail.small?.pct : 0)?.toString() ?? '0';
          data.retailSmallAvgArea = recs.retail.hasRetail ? recs.retail.small?.avgArea : 0;
          data.retailMediumPct = (recs.retail.hasRetail ? recs.retail.medium?.pct : 0)?.toString() ?? '0';
          data.retailMediumAvgArea = recs.retail.hasRetail ? recs.retail.medium?.avgArea : 0;
          data.retailLargePct = (recs.retail.hasRetail ? recs.retail.large?.pct : 0)?.toString() ?? '0';
          data.retailLargeAvgArea = recs.retail.hasRetail ? recs.retail.large?.avgArea : 0;
        }
        
        // Apply office recommendations
        if (recs.offices) {
          data.officeSmallPct = (recs.offices.hasOffices ? recs.offices.small?.pct : 0)?.toString() ?? '0';
          data.officeSmallAvgArea = recs.offices.hasOffices ? recs.offices.small?.avgArea : 0;
          data.officeMediumPct = (recs.offices.hasOffices ? recs.offices.medium?.pct : 0)?.toString() ?? '0';
          data.officeMediumAvgArea = recs.offices.hasOffices ? recs.offices.medium?.avgArea : 0;
          data.officeLargePct = (recs.offices.hasOffices ? recs.offices.large?.pct : 0)?.toString() ?? '0';
          data.officeLargeAvgArea = recs.offices.hasOffices ? recs.offices.large?.avgArea : 0;
        }
        
        // Apply finishing quality
        if (recs.finishingQuality) {
          data.finishingQuality = recs.finishingQuality;
        }

        const existing = await db.select().from(marketOverview)
          .where(and(
            eq(marketOverview.projectId, input.projectId),
            eq(marketOverview.userId, ctx.user.id)
          ));

        if (existing[0]) {
          await db.update(marketOverview)
            .set(data)
            .where(eq(marketOverview.id, existing[0].id));
        } else {
          await db.insert(marketOverview).values({
            userId: ctx.user.id,
            projectId: input.projectId,
            ...data,
          });
        }

        return { success: true };
      } catch (error: any) {
        throw new Error(`فشل في تطبيق التوصيات: ${error.message}`);
      }
    }),
});
