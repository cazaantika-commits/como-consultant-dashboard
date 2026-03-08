import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { competitionPricing, marketOverview, feasibilityStudies, projects } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";

const pricingInput = z.object({
  projectId: z.number(),
  // السيناريو المتفائل
  optStudioPrice: z.number().optional().nullable(),
  opt1brPrice: z.number().optional().nullable(),
  opt2brPrice: z.number().optional().nullable(),
  opt3brPrice: z.number().optional().nullable(),
  optRetailSmallPrice: z.number().optional().nullable(),
  optRetailMediumPrice: z.number().optional().nullable(),
  optRetailLargePrice: z.number().optional().nullable(),
  optOfficeSmallPrice: z.number().optional().nullable(),
  optOfficeMediumPrice: z.number().optional().nullable(),
  optOfficeLargePrice: z.number().optional().nullable(),
  // السيناريو الأساسي
  baseStudioPrice: z.number().optional().nullable(),
  base1brPrice: z.number().optional().nullable(),
  base2brPrice: z.number().optional().nullable(),
  base3brPrice: z.number().optional().nullable(),
  baseRetailSmallPrice: z.number().optional().nullable(),
  baseRetailMediumPrice: z.number().optional().nullable(),
  baseRetailLargePrice: z.number().optional().nullable(),
  baseOfficeSmallPrice: z.number().optional().nullable(),
  baseOfficeMediumPrice: z.number().optional().nullable(),
  baseOfficeLargePrice: z.number().optional().nullable(),
  // السيناريو المتحفظ
  consStudioPrice: z.number().optional().nullable(),
  cons1brPrice: z.number().optional().nullable(),
  cons2brPrice: z.number().optional().nullable(),
  cons3brPrice: z.number().optional().nullable(),
  consRetailSmallPrice: z.number().optional().nullable(),
  consRetailMediumPrice: z.number().optional().nullable(),
  consRetailLargePrice: z.number().optional().nullable(),
  consOfficeSmallPrice: z.number().optional().nullable(),
  consOfficeMediumPrice: z.number().optional().nullable(),
  consOfficeLargePrice: z.number().optional().nullable(),
  // خطة السداد
  paymentBookingPct: z.number().optional().nullable(),
  paymentBookingTiming: z.string().optional().nullable(),
  paymentConstructionPct: z.number().optional().nullable(),
  paymentConstructionTiming: z.string().optional().nullable(),
  paymentHandoverPct: z.number().optional().nullable(),
  paymentHandoverTiming: z.string().optional().nullable(),
  paymentDeferredPct: z.number().optional().nullable(),
  paymentDeferredTiming: z.string().optional().nullable(),
  // السيناريو النشط
  activeScenario: z.string().optional().nullable(),
});

export const competitionPricingRouter = router({
  // Get pricing data for a project
  getByProject: publicProcedure
    .input(z.number())
    .query(async ({ ctx, input }) => {
      if (!ctx.user) return null;
      const db = await getDb();
      if (!db) return null;
      const results = await db.select().from(competitionPricing)
        .where(and(
          eq(competitionPricing.projectId, input),
          eq(competitionPricing.userId, ctx.user.id)
        ));
      return results[0] || null;
    }),

  // Get all competition pricing for the current user (all projects)
  getAllByUser: publicProcedure
    .query(async ({ ctx }) => {
      if (!ctx.user) return [];
      const db = await getDb();
      if (!db) return [];
      const results = await db.select().from(competitionPricing)
        .where(eq(competitionPricing.userId, ctx.user.id));
      return results;
    }),

  // Save or update pricing data
  save: publicProcedure
    .input(pricingInput)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const existing = await db.select().from(competitionPricing)
        .where(and(
          eq(competitionPricing.projectId, input.projectId),
          eq(competitionPricing.userId, ctx.user.id)
        ));

      const data: any = {
        // السيناريو المتفائل
        optStudioPrice: input.optStudioPrice ?? 0,
        opt1brPrice: input.opt1brPrice ?? 0,
        opt2brPrice: input.opt2brPrice ?? 0,
        opt3brPrice: input.opt3brPrice ?? 0,
        optRetailSmallPrice: input.optRetailSmallPrice ?? 0,
        optRetailMediumPrice: input.optRetailMediumPrice ?? 0,
        optRetailLargePrice: input.optRetailLargePrice ?? 0,
        optOfficeSmallPrice: input.optOfficeSmallPrice ?? 0,
        optOfficeMediumPrice: input.optOfficeMediumPrice ?? 0,
        optOfficeLargePrice: input.optOfficeLargePrice ?? 0,
        // السيناريو الأساسي
        baseStudioPrice: input.baseStudioPrice ?? 0,
        base1brPrice: input.base1brPrice ?? 0,
        base2brPrice: input.base2brPrice ?? 0,
        base3brPrice: input.base3brPrice ?? 0,
        baseRetailSmallPrice: input.baseRetailSmallPrice ?? 0,
        baseRetailMediumPrice: input.baseRetailMediumPrice ?? 0,
        baseRetailLargePrice: input.baseRetailLargePrice ?? 0,
        baseOfficeSmallPrice: input.baseOfficeSmallPrice ?? 0,
        baseOfficeMediumPrice: input.baseOfficeMediumPrice ?? 0,
        baseOfficeLargePrice: input.baseOfficeLargePrice ?? 0,
        // السيناريو المتحفظ
        consStudioPrice: input.consStudioPrice ?? 0,
        cons1brPrice: input.cons1brPrice ?? 0,
        cons2brPrice: input.cons2brPrice ?? 0,
        cons3brPrice: input.cons3brPrice ?? 0,
        consRetailSmallPrice: input.consRetailSmallPrice ?? 0,
        consRetailMediumPrice: input.consRetailMediumPrice ?? 0,
        consRetailLargePrice: input.consRetailLargePrice ?? 0,
        consOfficeSmallPrice: input.consOfficeSmallPrice ?? 0,
        consOfficeMediumPrice: input.consOfficeMediumPrice ?? 0,
        consOfficeLargePrice: input.consOfficeLargePrice ?? 0,
        // خطة السداد
        paymentBookingPct: input.paymentBookingPct?.toString() ?? '10',
        paymentBookingTiming: input.paymentBookingTiming ?? 'عند التوقيع',
        paymentConstructionPct: input.paymentConstructionPct?.toString() ?? '60',
        paymentConstructionTiming: input.paymentConstructionTiming ?? 'أثناء الإنشاء',
        paymentHandoverPct: input.paymentHandoverPct?.toString() ?? '30',
        paymentHandoverTiming: input.paymentHandoverTiming ?? 'عند التسليم',
        paymentDeferredPct: input.paymentDeferredPct?.toString() ?? '0',
        paymentDeferredTiming: input.paymentDeferredTiming ?? null,
        // السيناريو النشط
        activeScenario: input.activeScenario ?? 'base',
      };

      if (existing[0]) {
        await db.update(competitionPricing)
          .set(data)
          .where(eq(competitionPricing.id, existing[0].id));
        return { id: existing[0].id, updated: true };
      } else {
        const result = await db.insert(competitionPricing).values({
          userId: ctx.user.id,
          projectId: input.projectId,
          ...data,
        });
        return { id: Number(result[0].insertId), updated: false };
      }
    }),

  // Toggle approval
  toggleApproval: publicProcedure
    .input(z.object({ projectId: z.number(), approved: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const existing = await db.select().from(competitionPricing)
        .where(and(
          eq(competitionPricing.projectId, input.projectId),
          eq(competitionPricing.userId, ctx.user.id)
        ));

      if (existing[0]) {
        await db.update(competitionPricing)
          .set({
            isApproved: input.approved ? 1 : 0,
            approvedAt: input.approved ? new Date() : null,
          })
          .where(eq(competitionPricing.id, existing[0].id));
      }
      return { success: true };
    }),

  // Joel AI Smart Report - Generate pricing & competition report
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

      // Get feasibility study data
      const feasResults = await db.select().from(feasibilityStudies)
        .where(and(eq(feasibilityStudies.projectId, projectId), eq(feasibilityStudies.userId, ctx.user.id)));
      const feasStudy = feasResults[0] || null;

      // Get market overview data (Tab 1)
      const moResults = await db.select().from(marketOverview)
        .where(and(eq(marketOverview.projectId, projectId), eq(marketOverview.userId, ctx.user.id)));
      const mo = moResults[0] || null;

      // Get existing competition pricing data (this tab)
      const cpResults = await db.select().from(competitionPricing)
        .where(and(eq(competitionPricing.projectId, projectId), eq(competitionPricing.userId, ctx.user.id)));
      const cp = cpResults[0] || null;

      // ═══════════════════════════════════════════════════════════
      // Merge data: Fact Sheet (projects table) + Feasibility Study
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
      const projectTypeStr = projectType.length > 0 ? projectType.join(' + ') : 'غير محدد';

      // Build unit types info from Tab 1
      const unitTypes = [];
      if (mo) {
        if (Number(mo.residentialStudioPct) > 0) unitTypes.push(`استديو (${mo.residentialStudioPct}% - ${mo.residentialStudioAvgArea} قدم²)`);
        if (Number(mo.residential1brPct) > 0) unitTypes.push(`غرفة وصالة (${mo.residential1brPct}% - ${mo.residential1brAvgArea} قدم²)`);
        if (Number(mo.residential2brPct) > 0) unitTypes.push(`غرفتان وصالة (${mo.residential2brPct}% - ${mo.residential2brAvgArea} قدم²)`);
        if (Number(mo.residential3brPct) > 0) unitTypes.push(`ثلاث غرف وصالة (${mo.residential3brPct}% - ${mo.residential3brAvgArea} قدم²)`);
      }

      const currentDate = new Date();
      const reportDate = `${currentDate.getDate()}/${currentDate.getMonth() + 1}/${currentDate.getFullYear()}`;
      const currentYear = currentDate.getFullYear();
      // Format saved pricing data if exists
      const savedPricingSection = cp ? `

بيانات التسعير المحفوظة (من دراسة السوق السابقة):
السيناريو الأساسي:
- استديو: ${cp.baseStudioPrice || 'غير محدد'} درهم/قدم²
- غرفة وصالة: ${cp.base1brPrice || 'غير محدد'} درهم/قدم²
- غرفتان وصالة: ${cp.base2brPrice || 'غير محدد'} درهم/قدم²
- ثلاث غرف: ${cp.base3brPrice || 'غير محدد'} درهم/قدم²
- محلات صغيرة: ${cp.baseRetailSmallPrice || 'غير محدد'} درهم/قدم²
- محلات متوسطة: ${cp.baseRetailMediumPrice || 'غير محدد'} درهم/قدم²
- محلات كبيرة: ${cp.baseRetailLargePrice || 'غير محدد'} درهم/قدم²` : '';

      const reportPrompt = `أنتِ جويل، محللة السوق العقاري في Como Developments. اكتبي تقريراً ذكياً عن المنافسة والتسعير للمشروع:

🚨 تاريخ التقرير: ${reportDate} - نحن في عام ${currentYear}. كل الأسعار والمقارنات يجب أن تكون من ${currentYear - 1}-${currentYear}. لا تستخدمي أسعار 2024 أو أقدم كأسعار حالية.

معلومات المشروع:
- الاسم: ${project.name}
- المنطقة: ${community}
- نوع المشروع: ${projectTypeStr}
- الاستعمال المسموح: ${permittedUse}
- جودة التشطيب: ${mo?.finishingQuality || 'ممتاز'}
${unitTypes.length > 0 ? `- أنواع الوحدات: ${unitTypes.join(', ')}` : ''}

بيانات بطاقة المشروع:
- مساحة الأرض: ${plotArea > 0 ? plotArea.toLocaleString() : 'غير محدد'} قدم²
- المساحة الإجمالية GFA: ${totalGFA > 0 ? totalGFA.toLocaleString() : 'غير محدد'} قدم²
- BUA: ${buaFromFactSheet > 0 ? buaFromFactSheet.toLocaleString() : 'غير محدد'} قدم²

تفصيل المساحات:
- GFA السكني: ${gfaRes > 0 ? gfaRes.toLocaleString() : 'غير محدد'} قدم²
- GFA التجاري: ${gfaRet > 0 ? gfaRet.toLocaleString() : 'غير محدد'} قدم²
- GFA المكاتب: ${gfaOff > 0 ? gfaOff.toLocaleString() : 'غير محدد'} قدم²${savedPricingSection}

اكتبي تقريراً احترافياً بمستوى JLL / Colliers يتضمن الأقسام التالية بالترتيب:

## 1. الملخص التنفيذي (Executive Summary)
فقرة مكثفة بأهم الأرقام: متوسط سعر القدم الموصى به، هامش الربح المتوقع، والتوصية.

## 2. تحليل المنافسين (Competitor Analysis)
🚨🚨🚨 هذا القسم هو الأهم - يجب أن يحتوي على أسماء مشاريع ومباني حقيقية وفعلية:

**قواعد إلزامية لتحليل المنافسين:**
- يجب ذكر أسماء مشاريع ومباني حقيقية وفعلية في منطقة "${community}" تحديداً وفي المناطق المجاورة المباشرة لها (نطاق 3-5 كم)
- يجب أن تشمل القائمة: مباني سكنية قائمة ومشاريع قيد الإنشاء ومشاريع على الخارطة في نفس المنطقة
- اذكري اسم كل مبنى/مشروع بالتحديد (مثال: "برج الوصل"، "ريزيدنس 1"، إلخ) وليس فقط اسم المطور أو المجمع
- اذكري أسعار البيع الفعلية لكل مبنى/مشروع من مصادر موثوقة (DXBInteract, Bayut, Property Finder, Dubai REST)
- لا تذكري مشاريع في مناطق بعيدة (مثل جبل علي أو طريق العين) إلا للمقارنة العامة
- على الأقل 3-4 مشاريع يجب أن تكون في نفس المنطقة "${community}" أو على بعد أقل من 3 كم منها

- جدول مقارنة للمشاريع المنافسة (8-12 مشروع على الأقل):
  | اسم المبنى/المشروع | المطور | الموقع (المسافة من مشروعنا) | سعر/قدم² (سكني) | سعر/قدم² (تجاري) | خطة السداد | الحالة | عدد الطوابق | أنواع الوحدات | المصدر |
- تحليل نقاط القوة والضعف لكل منافس
- ملخص: ما هي المباني الأقرب جغرافياً والأكثر تشابهاً مع مشروعنا

## 3. تحليل الأسعار (Pricing Analysis)
- متوسط سعر القدم المربع لكل نوع وحدة في المنطقة مع ذكر أسماء المباني التي استُخرجت منها الأسعار
- مقارنة الأسعار بين السوق الأولي والثانوي في "${community}" تحديداً
- نطاق الأسعار (أدنى - متوسط - أعلى) لكل فئة مع ذكر اسم المبنى لكل سعر

## 4. تحليل خطط السداد (Payment Plan Analysis)
- خطط السداد السائدة في السوق
- مقارنة بين خطط المنافسين
- الخطة الموصى بها لمشروعنا مع التبرير

## 5. تحليل الحساسية (Sensitivity Analysis)
- جدول يوضح تأثير تغير الأسعار بنسب مختلفة (-20%, -10%, 0%, +10%, +20%)
- تأثيرها على الربح وROI

## 6. التوصيات (Recommendations)
- السيناريو الموصى به (متفائل/أساسي/متحفظ) مع التبرير
- استراتيجية التسعير (تسعير اختراقي، تنافسي، أو مميز)
- توقيت الإطلاق الموصى به
- يجب أن تكون الأسعار الموصى بها متسقة مع أسعار المنافسين المذكورة في القسم 2 (لا تناقض بين الأسعار)

قواعد إلزامية:
- التقرير باللغة العربية (2000-3500 كلمة)
- كل سعر يجب أن يكون مرفقاً بمصدره: (المصدر: DXBInteract) أو (المصدر: Bayut) أو (المصدر: Property Finder)
- استخدمي جداول Markdown للمقارنات
- التقديرات تُعلّم بوضوح: "تقدير مهني - يحتاج تحقق"
- الأسلوب مهني وموضوعي كتقارير JLL و Colliers
- يجب التأكد من عدم وجود تناقض بين الأسعار المذكورة في التقرير والأسعار المقترحة في التوصيات`;

      const recsPrompt = `أنتِ جويل، محللة السوق العقاري في Como Developments. تاريخ اليوم: ${reportDate} (عام ${currentYear}). بناءً على تحليلك لمشروع "${project.name}" في "${community}":

نوع المشروع: ${projectTypeStr}
الاستعمال المسموح: ${permittedUse}
جودة التشطيب: ${mo?.finishingQuality || 'ممتاز'}
مساحة الأرض: ${plotArea > 0 ? plotArea.toLocaleString() : 'غير محدد'} قدم²
المساحة الإجمالية GFA: ${totalGFA > 0 ? totalGFA.toLocaleString() : 'غير محدد'} قدم²
BUA: ${buaFromFactSheet > 0 ? buaFromFactSheet.toLocaleString() : 'غير محدد'} قدم²
${unitTypes.length > 0 ? `أنواع الوحدات المعتمدة: ${unitTypes.join(', ')}` : ''}

أعطيني توصياتك بصيغة JSON فقط (بدون أي نص إضافي):
{
  "scenarios": {
    "optimistic": {
      "residential": {
        "studio": number_or_0,
        "oneBr": number_or_0,
        "twoBr": number_or_0,
        "threeBr": number_or_0
      },
      "retail": {
        "small": number_or_0,
        "medium": number_or_0,
        "large": number_or_0
      },
      "offices": {
        "small": number_or_0,
        "medium": number_or_0,
        "large": number_or_0
      }
    },
    "base": {
      "residential": { "studio": number, "oneBr": number, "twoBr": number, "threeBr": number },
      "retail": { "small": number, "medium": number, "large": number },
      "offices": { "small": number, "medium": number, "large": number }
    },
    "conservative": {
      "residential": { "studio": number, "oneBr": number, "twoBr": number, "threeBr": number },
      "retail": { "small": number, "medium": number, "large": number },
      "offices": { "small": number, "medium": number, "large": number }
    }
  },
  "paymentPlan": {
    "booking": { "pct": number, "timing": "string" },
    "construction": { "pct": number, "timing": "string" },
    "handover": { "pct": number, "timing": "string" },
    "deferred": { "pct": number, "timing": "string_or_empty" }
  },
  "summary": "ملخص قصير بالعربي"
}

ملاحظات:
- الأسعار بالدرهم لكل قدم مربع (AED/sqft)
- ضع 0 لأنواع الوحدات غير الموجودة في المشروع
- إذا لم يكن هناك GFA تجاري، ضع أسعار المحلات 0
- إذا لم يكن هناك GFA مكاتب، ضع أسعار المكاتب 0
- مجموع نسب خطة السداد = 100%
- السيناريو المتفائل أعلى من الأساسي بـ 5-10%
- السيناريو المتحفظ أقل من الأساسي بـ 5-10%`;

      try {
        const [reportResponse, recsResponse] = await Promise.all([
          invokeLLM({
            messages: [
              { role: "system", content: `أنتِ جويل، محللة السوق العقاري في Como Developments. تقاريرك مهنية. التاريخ: ${reportDate} (عام ${currentYear}). لا تستخدمي بيانات 2024 كبيانات حالية.` },
              { role: "user", content: reportPrompt },
            ],
          }),
          invokeLLM({
            messages: [
              { role: "system", content: `أنتِ جويل، محللة السوق العقاري. التاريخ: ${reportDate} (عام ${currentYear}). أجيبي بصيغة JSON فقط بدون أي نص إضافي.` },
              { role: "user", content: recsPrompt },
            ],
          }),
        ]);

        const smartReport = reportResponse.choices[0]?.message?.content || "لم يتم إنشاء التقرير";
        const recsRaw = recsResponse.choices[0]?.message?.content || "{}";
        const cleanJson = recsRaw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

        // Save to DB
        const existing = await db.select().from(competitionPricing)
          .where(and(
            eq(competitionPricing.projectId, projectId),
            eq(competitionPricing.userId, ctx.user.id)
          ));

        if (existing[0]) {
          await db.update(competitionPricing)
            .set({
              aiSmartReport: smartReport,
              aiRecommendationsJson: cleanJson,
              aiReportGeneratedAt: new Date(),
            })
            .where(eq(competitionPricing.id, existing[0].id));
        } else {
          await db.insert(competitionPricing).values({
            userId: ctx.user.id,
            projectId: projectId,
            aiSmartReport: smartReport,
            aiRecommendationsJson: cleanJson,
            aiReportGeneratedAt: new Date(),
          });
        }

        return { smartReport, recommendations: cleanJson };
      } catch (error: any) {
        console.error("Error generating pricing report:", error);
        throw new Error("فشل في إنشاء التقرير: " + error.message);
      }
    }),
});
