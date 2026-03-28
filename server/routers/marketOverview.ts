import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { marketOverview, feasibilityStudies, projects, competitionPricing } from "../../drizzle/schema";
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

  // Get all market overviews for the current user (all projects)
  getAllByUser: publicProcedure
    .query(async ({ ctx }) => {
      if (!ctx.user) return [];
      const db = await getDb();
      if (!db) return [];
      const results = await db.select().from(marketOverview)
        .where(eq(marketOverview.userId, ctx.user.id));
      return results;
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

      // Get competition pricing data if exists
      const compResults = await db.select().from(competitionPricing)
        .where(and(eq(competitionPricing.projectId, projectId), eq(competitionPricing.userId, ctx.user.id)));
      const compPricing = compResults[0] || null;

      // ═══════════════════════════════════════════════════════════
      // Merge data: Fact Sheet (projects table) + Feasibility Study
      // Fact sheet is the primary source, feasibility study overrides if available
      // ═══════════════════════════════════════════════════════════
      const plotArea = feasStudy?.plotArea || parseFloat(String(project.plotAreaSqft || '0')) || 0;
      const totalGFA = feasStudy 
        ? ((feasStudy.gfaResidential || 0) + (feasStudy.gfaRetail || 0) + (feasStudy.gfaOffices || 0))
        : parseFloat(String(project.gfaSqft || '0')) || 0;
      const gfaRes = feasStudy?.gfaResidential || 0;
      const gfaRet = feasStudy?.gfaRetail || 0;
      const gfaOff = feasStudy?.gfaOffices || 0;
      const buaFromFactSheet = project.bua || 0;
      const permittedUse = project.permittedUse || feasStudy?.landUse || 'غير محدد';
      const community = feasStudy?.community || project.areaCode || 'غير محدد';
      const plotNumber = feasStudy?.plotNumber || project.plotNumber || 'غير محدد';
      const projectDesc = feasStudy?.projectDescription || project.description || 'غير محدد';

      // Build context about the project
      const projectType = [];
      if (gfaRes > 0) projectType.push('سكني');
      if (gfaRet > 0) projectType.push('تجاري');
      if (gfaOff > 0) projectType.push('مكاتب');
      // If no feasibility breakdown, try to infer from permittedUse
      if (projectType.length === 0 && permittedUse !== 'غير محدد') {
        if (permittedUse.includes('سكني') || permittedUse.toLowerCase().includes('residential')) projectType.push('سكني');
        if (permittedUse.includes('تجاري') || permittedUse.toLowerCase().includes('commercial') || permittedUse.toLowerCase().includes('retail')) projectType.push('تجاري');
        if (permittedUse.includes('مكاتب') || permittedUse.toLowerCase().includes('office')) projectType.push('مكاتب');
      }
      const projectTypeStr = projectType.length > 0 ? projectType.join(' + ') : (project.description || 'غير محدد');

      const saleableResArea = feasStudy ? gfaRes * ((feasStudy.saleableResidentialPct || 95) / 100) : 0;
      const saleableRetArea = feasStudy ? gfaRet * ((feasStudy.saleableRetailPct || 97) / 100) : 0;
      const saleableOffArea = feasStudy ? gfaOff * ((feasStudy.saleableOfficesPct || 95) / 100) : 0;

      // Format competition pricing data for the report
      const competitionPricingSection = compPricing ? `

بيانات التسعير التنافسي (من دراسة السوق):
- سعر الاستوديو: ${compPricing.baseStudioPrice || 'غير محدد'} درهم/قدم²
- سعر الشقة 1 غرفة: ${compPricing.base1brPrice || 'غير محدد'} درهم/قدم²
- سعر الشقة 2 غرفة: ${compPricing.base2brPrice || 'غير محدد'} درهم/قدم²
- سعر الشقة 3 غرف: ${compPricing.base3brPrice || 'غير محدد'} درهم/قدم²
- سعر المحلات الصغيرة: ${compPricing.retailSmallPrice || 'غير محدد'} درهم/قدم²
- سعر المحلات المتوسطة: ${compPricing.retailMediumPrice || 'غير محدد'} درهم/قدم²
- سعر المحلات الكبيرة: ${compPricing.retailLargePrice || 'غير محدد'} درهم/قدم²` : '';

      const currentDate = new Date();
      const reportDate = `${currentDate.getDate()}/${currentDate.getMonth() + 1}/${currentDate.getFullYear()}`;
      const currentYear = currentDate.getFullYear();
      const reportPrompt = `أنتِ جويل، محللة السوق العقاري في شركة Como Developments. اكتبي تقريراً ذكياً شاملاً عن النظرة العامة والسوق للمشروع التالي:

🚨 تاريخ التقرير: ${reportDate} - نحن في عام ${currentYear}. كل البيانات والإحصائيات يجب أن تكون من ${currentYear - 1}-${currentYear}. لا تستخدمي 2024 أو أقدم كبيانات حالية. إذا لم تجدي بيانات حديثة، صرّحي بذلك.

معلومات المشروع:
- الاسم: ${project.name}
- المنطقة: ${community}
- رقم القطعة: ${plotNumber}
- نوع المشروع: ${projectTypeStr}
- الوصف: ${projectDesc}
- الاستعمال المسموح: ${permittedUse}

بيانات بطاقة المشروع:
- مساحة الأرض (بطاقة): ${plotArea > 0 ? plotArea.toLocaleString() : 'غير محدد'} قدم²
- المساحة الإجمالية GFA (بطاقة): ${totalGFA > 0 ? totalGFA.toLocaleString() : (parseFloat(String(project.gfaSqft || '0')) > 0 ? parseFloat(String(project.gfaSqft)).toLocaleString() : 'غير محدد')} قدم²
- BUA (بطاقة): ${buaFromFactSheet > 0 ? buaFromFactSheet.toLocaleString() : 'غير محدد'} قدم²

تفصيل المساحات (دراسة الجدوى):
- GFA السكني: ${gfaRes > 0 ? gfaRes.toLocaleString() : 'غير محدد'} قدم²
- GFA التجاري: ${gfaRet > 0 ? gfaRet.toLocaleString() : 'غير محدد'} قدم²
- GFA المكاتب: ${gfaOff > 0 ? gfaOff.toLocaleString() : 'غير محدد'} قدم²
- المساحة القابلة للبيع (سكني): ${saleableResArea > 0 ? Math.round(saleableResArea).toLocaleString() : 'غير محدد'} قدم²
- المساحة القابلة للبيع (تجاري): ${saleableRetArea > 0 ? Math.round(saleableRetArea).toLocaleString() : 'غير محدد'} قدم²
- المساحة القابلة للبيع (مكاتب): ${saleableOffArea > 0 ? Math.round(saleableOffArea).toLocaleString() : 'غير محدد'} قدم²${competitionPricingSection}

اكتبي تقريراً احترافياً بمستوى JLL / Colliers يتضمن الأقسام التالية بالترتيب:

## 1. الملخص التنفيذي (Executive Summary)
فقرة واحدة مكثفة تتضمن أهم 3-5 أرقام والتوصية الرئيسية.

## 2. السياق الاقتصادي الكلي (Macroeconomic Context)
- نمو الناتج المحلي لدبي، النمو السكاني، السياحة
- القوانين والسياسات الجديدة المؤثرة على القطاع العقاري

## 3. تحليل الموقع (Location Analysis)
- وصف المنطقة/المجتمع وطبيعته
- البنية التحتية المحيطة (طرق، مترو، مدارس، مستشفيات)
- المسافات من المعالم الرئيسية (المطار، وسط المدينة، الشاطئ)

## 4. تحليل العرض والطلب (Supply & Demand Analysis)
- المشاريع القائمة وقيد الإنشاء في المنطقة
- معدلات الإشغال والامتصاص
- الطلب المتوقع ومحركاته

## 5. الاتجاهات السعرية (Price Trends)
- متوسط سعر القدم المربع في المنطقة (سكني/تجاري/مكاتب)
- نسبة التغير السنوية والربعية
- التوقعات للفترة القادمة (12-24 شهر)

## 6. الفرص والتحديات (Opportunities & Challenges)
- 3-5 فرص محددة مع تبرير
- 3-5 تحديات/مخاطر مع احتمالية وتأثير

## 7. التوصية (Recommendation)
- تقييم جاذبية المشروع (1-10) مع تبرير
- توصية واضحة للإدارة

قواعد إلزامية:
- التقرير باللغة العربية (1500-2500 كلمة)
- كل رقم يجب أن يكون مرفقاً بمصدره بين أقواس
- استخدمي جداول Markdown للمقارنات
- التقديرات الشخصية تُعلّم بوضوح: "تقدير مهني"
- الأسلوب مهني وموضوعي كتقارير JLL و Colliers`;

      const recommendationsPrompt = `أنتِ جويل، محللة السوق العقاري في Como Developments. تاريخ اليوم: ${reportDate} (عام ${currentYear}). بناءً على تحليلك لمشروع "${project.name}" في منطقة "${community}":

نوع المشروع: ${projectTypeStr}
الاستعمال المسموح: ${permittedUse}
مساحة الأرض: ${plotArea > 0 ? plotArea.toLocaleString() : 'غير محدد'} قدم²
المساحة الإجمالية GFA: ${totalGFA > 0 ? totalGFA.toLocaleString() : 'غير محدد'} قدم²
BUA: ${buaFromFactSheet > 0 ? buaFromFactSheet.toLocaleString() : 'غير محدد'} قدم²
المساحة القابلة للبيع (سكني): ${saleableResArea > 0 ? Math.round(saleableResArea).toLocaleString() : 'غير محدد'} قدم²
المساحة القابلة للبيع (تجاري): ${saleableRetArea > 0 ? Math.round(saleableRetArea).toLocaleString() : 'غير محدد'} قدم²
المساحة القابلة للبيع (مكاتب): ${saleableOffArea > 0 ? Math.round(saleableOffArea).toLocaleString() : 'غير محدد'} قدم²

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
              { role: "system", content: `أنتِ جويل، محللة السوق العقاري في Como Developments. تقاريرك مهنية ومبنية على تحليل معمق. التاريخ الحالي: ${reportDate} - عام ${currentYear}. لا تستخدمي بيانات 2024 كبيانات حالية.` },
              { role: "user", content: reportPrompt },
            ],
          }),
          invokeLLM({
            messages: [
              { role: "system", content: `أنتِ جويل، محللة السوق العقاري. التاريخ: ${reportDate} (عام ${currentYear}). أجيبي بصيغة JSON فقط بدون أي نص إضافي أو markdown.` },
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
