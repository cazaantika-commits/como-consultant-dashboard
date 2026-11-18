import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { competitionPricing, marketOverview, feasibilityStudies, projects } from "../../drizzle/schema";
import { eq, and, inArray } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";
import { TRPCError } from "@trpc/server";
import { requireLegacyProjectRead, requireLegacyProjectOwner, deriveAuthorizedProjectIds } from "../services/comoLegacyProjectAccess";
import { joulePriceInput, assertJouleUnlocked, assertJouleSourceNotGenerated, joulePricePatch } from "../services/jouleInputPolicy";

const pricingInput = joulePriceInput;

export const competitionPricingRouter = router({
  // Get pricing data for a project
  getByProject: protectedProcedure
    .input(z.number())
    .query(async ({ ctx, input }) => {
      await requireLegacyProjectRead(ctx.user, input);
      const db = await getDb();
      if (!db) return null;
      const results = await db.select().from(competitionPricing)
        .where(eq(competitionPricing.projectId, input));
      return results[0] || null;
    }),

  // Get all competition pricing (shared across all users in the portal)
  getAllByUser: protectedProcedure
    .query(async ({ ctx }) => {
      const ids = await deriveAuthorizedProjectIds(ctx.user);
      if (!ids.length) return [];
      const db = await getDb();
      if (!db) return [];
      const results = await db.select().from(competitionPricing).where(inArray(competitionPricing.projectId, ids));
      return results;
    }),

  // Save or update pricing data
  save: protectedProcedure
    .input(pricingInput)
    .mutation(async ({ ctx, input }) => {
      await requireLegacyProjectOwner(ctx.user, input.projectId);
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const existing = await db.select().from(competitionPricing)
        .where(eq(competitionPricing.projectId, input.projectId));

      assertJouleUnlocked(existing[0]);
      const [basis] = await db.select().from(projects).where(eq(projects.id, input.projectId)).limit(1);
      if (!basis) throw new TRPCError({code:"FORBIDDEN",message:"مصدر المشروع غير متاح"});
      const data = joulePricePatch(input, basis);

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
  toggleApproval: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive(), approved: z.boolean() }).strict())
    .mutation(async ({ ctx, input }) => {
      await requireLegacyProjectOwner(ctx.user, input.projectId);
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const existing = await db.select().from(competitionPricing)
        .where(eq(competitionPricing.projectId, input.projectId));

      assertJouleUnlocked(existing[0]);
      if (existing[0]) {
        await db.update(competitionPricing)
          .set({
            isApproved: input.approved ? 1 : 0,
            approvedAt: input.approved ? new Date().toISOString().slice(0,19).replace("T"," ") : null,
          })
          .where(eq(competitionPricing.id, existing[0].id));
      }
      return { success: true };
    }),

  // Joel AI Smart Report - Generate pricing & competition report
  generateSmartReport: protectedProcedure
    .input(z.number().int().positive()) // projectId
    .mutation(async ({ ctx, input: projectId }) => {
      await requireLegacyProjectOwner(ctx.user, projectId);
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [source] = await db.select().from(competitionPricing).where(eq(competitionPricing.projectId, projectId)).limit(1);
      assertJouleUnlocked(source);
      assertJouleSourceNotGenerated(source);

      // Get project data (shared portal - no userId filter)
      const projectResults = await db.select().from(projects)
        .where(eq(projects.id, projectId));
      if (!projectResults[0]) throw new Error("Project not found");
      const project = projectResults[0];

      // Get feasibility study data
      const feasResults = await db.select().from(feasibilityStudies)
        .where(and(eq(feasibilityStudies.projectId, projectId), eq(feasibilityStudies.userId, ctx.user.id)));
      const feasStudy = feasResults[0] || null;

      // Get market overview data (Tab 1)
      const moResults = await db.select().from(marketOverview)
        .where(eq(marketOverview.projectId, projectId));
      const mo = moResults[0] || null;

      // Get existing competition pricing data (this tab)
      const cpResults = await db.select().from(competitionPricing)
        .where(eq(competitionPricing.projectId, projectId));
      const cp = cpResults[0] || null;

      // ═══════════════════════════════════════════════════════════
      // Merge data: Fact Sheet (projects table) + Feasibility Study
      // ═══════════════════════════════════════════════════════════
      const plotArea = feasStudy?.plotArea || parseFloat(String(project.plotAreaSqft || '0')) || 0;
      const totalGFA = feasStudy 
        ? ((feasStudy.gfaResidential || 0) + (feasStudy.gfaRetail || 0) + (feasStudy.gfaOffices || 0))
        : parseFloat(String(project.gfaSqft || '0')) || 0;
      const gfaRes = Number(project.gfaResidentialSqft ?? 0);
      const gfaRet = Number(project.gfaRetailSqft ?? 0);
      const gfaOff = Number(project.gfaOfficesSqft ?? 0);
      const buaFromFactSheet = Number(project.manualBuaSqft ?? 0);
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

        const smartReport = reportResponse.choices[0]?.message?.content;
        if (typeof smartReport !== "string" || !smartReport.trim()) throw new Error("استجابة التقرير غير صالحة");
        const recsRaw = recsResponse.choices[0]?.message?.content;
        if (typeof recsRaw !== "string") throw new Error("استجابة التوصيات غير صالحة");
        const cleanJson = recsRaw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

        // Save to DB
        const existing = await db.select().from(competitionPricing)
          .where(eq(competitionPricing.projectId, projectId));

        if (existing[0]) {
          await db.update(competitionPricing)
            .set({
              aiSmartReport: smartReport,
              aiRecommendationsJson: cleanJson,
              aiReportGeneratedAt: new Date().toISOString().slice(0,19).replace("T"," "),
            })
            .where(eq(competitionPricing.id, existing[0].id));
        } else {
          await db.insert(competitionPricing).values({
            userId: ctx.user.id,
            projectId: projectId,
            aiSmartReport: smartReport,
            aiRecommendationsJson: cleanJson,
            aiReportGeneratedAt: new Date().toISOString().slice(0,19).replace("T"," "),
          });
        }

        return { smartReport, recommendations: cleanJson };
      } catch (error: any) {
        console.error("Error generating pricing report:", error);
        throw new Error("فشل في إنشاء التقرير: " + error.message);
      }
    }),
});
