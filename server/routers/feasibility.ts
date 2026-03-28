import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { feasibilityStudies, projects } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";

const feasibilityInput = z.object({
  projectId: z.number().optional().nullable(),
  scenarioName: z.string().optional().nullable(),
  projectName: z.string().min(1),
  community: z.string().optional().nullable(),
  plotNumber: z.string().optional().nullable(),
  projectDescription: z.string().optional().nullable(),
  landUse: z.string().optional().nullable(),
  plotArea: z.number().optional().nullable(),
  plotAreaM2: z.number().optional().nullable(),
  gfaResidential: z.number().optional().nullable(),
  gfaRetail: z.number().optional().nullable(),
  gfaOffices: z.number().optional().nullable(),
  totalGfa: z.number().optional().nullable(),
  saleableResidentialPct: z.number().optional().nullable(),
  saleableRetailPct: z.number().optional().nullable(),
  saleableOfficesPct: z.number().optional().nullable(),
  estimatedBua: z.number().optional().nullable(),
  numberOfUnits: z.number().optional().nullable(),
  landPrice: z.number().optional().nullable(),
  agentCommissionLandPct: z.number().optional().nullable(),
  soilInvestigation: z.number().optional().nullable(),
  topographySurvey: z.number().optional().nullable(),
  authoritiesFee: z.number().optional().nullable(),
  constructionCostPerSqft: z.number().optional().nullable(),
  communityFee: z.number().optional().nullable(),
  designFeePct: z.number().optional().nullable(),
  supervisionFeePct: z.number().optional().nullable(),
  separationFeePerM2: z.number().optional().nullable(),
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
  residentialSalePrice: z.number().optional().nullable(),
  retailSalePrice: z.number().optional().nullable(),
  officesSalePrice: z.number().optional().nullable(),
  comoProfitSharePct: z.number().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const feasibilityRouter = router({
  list: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.user) return [];
    const db = await getDb();
    if (!db) return [];
    return db.select().from(feasibilityStudies)
      .where(eq(feasibilityStudies.userId, ctx.user.id))
      .orderBy(desc(feasibilityStudies.updatedAt));
  }),

  listByProject: publicProcedure
    .input(z.number())
    .query(async ({ ctx, input }) => {
      if (!ctx.user) return [];
      const db = await getDb();
      if (!db) return [];
      return db.select().from(feasibilityStudies)
        .where(and(
          eq(feasibilityStudies.userId, ctx.user.id),
          eq(feasibilityStudies.projectId, input)
        ))
        .orderBy(desc(feasibilityStudies.updatedAt));
    }),

  getById: publicProcedure.input(z.number()).query(async ({ ctx, input }) => {
    if (!ctx.user) throw new Error("Unauthorized");
    const db = await getDb();
    if (!db) return null;
    const results = await db.select().from(feasibilityStudies).where(
      and(eq(feasibilityStudies.id, input), eq(feasibilityStudies.userId, ctx.user.id))
    );
    return results[0] || null;
  }),

  create: publicProcedure
    .input(feasibilityInput)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const result = await db.insert(feasibilityStudies).values({
        userId: ctx.user.id,
        ...input,
      });
      return { id: Number(result[0].insertId) };
    }),

  update: publicProcedure
    .input(z.object({ id: z.number() }).merge(feasibilityInput.partial()))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const { id, ...data } = input;
      await db.update(feasibilityStudies)
        .set(data)
        .where(and(eq(feasibilityStudies.id, id), eq(feasibilityStudies.userId, ctx.user.id)));
      return { success: true };
    }),

  delete: publicProcedure
    .input(z.number())
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.delete(feasibilityStudies)
        .where(and(eq(feasibilityStudies.id, input), eq(feasibilityStudies.userId, ctx.user.id)));
      return { success: true };
    }),

  // Joelle AI Analysis - Generate smart summary for a study
  generateAiSummary: publicProcedure
    .input(z.number())
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const results = await db.select().from(feasibilityStudies).where(
        and(eq(feasibilityStudies.id, input), eq(feasibilityStudies.userId, ctx.user.id))
      );
      if (!results[0]) throw new Error("Study not found");
      const study = results[0];

      // Calculate key metrics
      const totalGfa = (study.gfaResidential || 0) + (study.gfaRetail || 0) + (study.gfaOffices || 0);
      const saleableRes = (study.gfaResidential || 0) * ((study.saleableResidentialPct || 95) / 100);
      const saleableRet = (study.gfaRetail || 0) * ((study.saleableRetailPct || 97) / 100);
      const saleableOff = (study.gfaOffices || 0) * ((study.saleableOfficesPct || 95) / 100);
      const constructionCost = (study.estimatedBua || 0) * (study.constructionCostPerSqft || 0);
      const revenueRes = saleableRes * (study.residentialSalePrice || 0);
      const revenueRet = saleableRet * (study.retailSalePrice || 0);
      const revenueOff = saleableOff * (study.officesSalePrice || 0);
      const totalRevenue = revenueRes + revenueRet + revenueOff;
      const landReg = (study.landPrice || 0) * 0.04;
      const agentLand = (study.landPrice || 0) * ((study.agentCommissionLandPct || 1) / 100);
      const designFee = constructionCost * ((study.designFeePct || 2) / 100);
      const supervisionFee = constructionCost * ((study.supervisionFeePct || 2) / 100);
      const totalGfaSqft = (study.gfaResidential || 0) + (study.gfaRetail || 0) + (study.gfaOffices || 0);
      const separationFee = totalGfaSqft * (study.separationFeePerM2 || 40);
      const contingencies = constructionCost * ((study.contingenciesPct || 2) / 100);
      const reraUnits = (study.numberOfUnits || 0) * (study.reraUnitFee || 850);
      const fixedFees = (study.reraOffplanFee || 0) + (study.nocFee || 0) + (study.escrowFee || 0) + (study.bankCharges || 0) + (study.surveyorFees || 0) + (study.reraAuditFees || 0) + (study.reraInspectionFees || 0);
      const devFee = totalRevenue * ((study.developerFeePct || 5) / 100);
      const agentSale = totalRevenue * ((study.agentCommissionSalePct || 5) / 100);
      const marketing = totalRevenue * ((study.marketingPct || 2) / 100);
      const totalCosts = (study.landPrice || 0) + landReg + agentLand + constructionCost + designFee + supervisionFee + separationFee + contingencies + reraUnits + fixedFees + (study.soilInvestigation || 0) + (study.topographySurvey || 0) + (study.authoritiesFee || 0) + (study.communityFee || 0) + devFee + agentSale + marketing;
      const profit = totalRevenue - totalCosts;
      const offplanCoverage = constructionCost * 0.65;
      const fundingRequired = totalCosts - offplanCoverage;
      const comoProfit = profit * ((study.comoProfitSharePct || 15) / 100);
      const investorProfit = profit - comoProfit;
      const roi = fundingRequired > 0 ? (investorProfit / fundingRequired) * 100 : 0;
      const profitMargin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

      const currentDate = new Date();
      const reportDate = `${currentDate.getDate()}/${currentDate.getMonth() + 1}/${currentDate.getFullYear()}`;
      const currentYear = currentDate.getFullYear();
      const prompt = `أنتِ جويل، محللة دراسات الجدوى في شركة Como Developments. اكتبي ملخصاً تحليلياً ذكياً باللغة العربية لدراسة الجدوى التالية:

🚨 تاريخ التقرير: ${reportDate} - نحن في عام ${currentYear}. كل الإحصائيات والمقارنات يجب أن تكون من ${currentYear - 1}-${currentYear}. لا تستخدمي بيانات 2024 أو أقدم كبيانات حالية.

المشروع: ${study.projectName}
المنطقة: ${study.community || 'غير محدد'}
رقم القطعة: ${study.plotNumber || 'غير محدد'}
الوصف: ${study.projectDescription || 'غير محدد'}

المساحات:
- مساحة الأرض: ${study.plotArea?.toLocaleString() || 0} قدم² (${study.plotAreaM2?.toLocaleString() || 0} م²)
- GFA السكني: ${study.gfaResidential?.toLocaleString() || 0} قدم²
- GFA التجاري: ${study.gfaRetail?.toLocaleString() || 0} قدم²
- GFA المكاتب: ${study.gfaOffices?.toLocaleString() || 0} قدم²
- إجمالي GFA: ${totalGfa.toLocaleString()} قدم²
- BUA: ${study.estimatedBua?.toLocaleString() || 0} قدم²
- عدد الوحدات: ${study.numberOfUnits || 0}

التكاليف:
- سعر الأرض: ${study.landPrice?.toLocaleString() || 0} درهم
- تكلفة البناء: ${constructionCost.toLocaleString()} درهم
- إجمالي التكاليف: ${totalCosts.toLocaleString()} درهم

الإيرادات:
- إجمالي الإيرادات: ${totalRevenue.toLocaleString()} درهم

النتائج:
- الربح: ${profit.toLocaleString()} درهم
- هامش الربح: ${profitMargin.toFixed(1)}%
- التمويل المطلوب: ${fundingRequired.toLocaleString()} درهم
- ربح المستثمر: ${investorProfit.toLocaleString()} درهم
- ROI: ${roi.toFixed(1)}%

اكتبي ملخصاً تحليلياً احترافياً بمستوى JLL / Colliers يتضمن:

## التقييم العام
- هل المشروع مجدي؟ تقييم من 1-10 مع تبرير
- مقارنة ROI مع معايير السوق في دبي (ROI المعياري: 15-25%)
- مقارنة هامش الربح مع مشاريع مماثلة

## نقاط القوة والضعف
- 3-5 نقاط قوة محددة مع تبرير رقمي
- 3-5 نقاط ضعف مع اقتراحات للمعالجة

## المخاطر
| المخاطرة | الاحتمالية | التأثير | التخفيف |
اذكري 3-5 مخاطر محددة لهذا المشروع

## تحليل الحساسية
ماذا يحدث إذا:
- انخفضت الأسعار 10%؟ 20%؟
- ارتفعت تكاليف البناء 15%؟
- تأخر البيع 6 أشهر؟

## التوصيات
- توصية واضحة (موافقة / موافقة بشروط / رفض)
- الخطوات التالية المقترحة

قواعد إلزامية:
- الملخص باللغة العربية (800-1200 كلمة)
- كل رقم مرفق بمصدره
- استخدمي جداول Markdown
- الأسلوب مهني كتقارير JLL و Colliers`;

      try {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: `أنتِ جويل، محللة دراسات الجدوى في Como Developments. التاريخ: ${reportDate} (عام ${currentYear}). لا تستخدمي بيانات 2024 كبيانات حالية.` },
            { role: "user", content: prompt },
          ],
        });
        const summary = response.choices[0]?.message?.content || "لم يتم إنشاء الملخص";
        
        await db.update(feasibilityStudies)
          .set({ aiSummary: summary })
          .where(eq(feasibilityStudies.id, input));
        
        return { success: true, summary };
      } catch (error: any) {
        throw new Error(`فشل في إنشاء الملخص: ${error.message}`);
      }
    }),

  // Joelle Market Analysis
  generateMarketAnalysis: publicProcedure
    .input(z.object({
      studyId: z.number(),
      community: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const currentDate = new Date();
      const reportDate = `${currentDate.getDate()}/${currentDate.getMonth() + 1}/${currentDate.getFullYear()}`;
      const currentYear = currentDate.getFullYear();
      const prompt = `أنتِ جويل، محللة استخبارات السوق العقاري في Como Developments. اكتبي تحليلاً احترافياً بمستوى JLL / Colliers لسوق منطقة "${input.community}" في دبي:

🚨 تاريخ التقرير: ${reportDate} - نحن في عام ${currentYear}. كل البيانات والأسعار يجب أن تكون من ${currentYear - 1}-${currentYear}. لا تستخدمي بيانات 2024 أو أقدم كبيانات حالية.

## 1. الملخص التنفيذي
فقرة واحدة بأهم الأرقام والاتجاهات.

## 2. السياق الاقتصادي الكلي
- GDP دبي، النمو السكاني، السياحة
- السياسات الحكومية المؤثرة (تأشيرات، قوانين التملك)

## 3. تحليل الموقع
- وصف المنطقة وطبيعتها الديموغرافية
- البنية التحتية (طرق، مترو، مدارس، مستشفيات)
- المسافات من المعالم الرئيسية

## 4. أسعار البيع الحالية
| النوع | متوسط سعر/قدم² | النطاق | التغير السنوي | المصدر |
سكني، تجاري، مكاتب

## 5. المشاريع المنافسة
| المشروع | المطور | سعر/قدم² | الحالة | المصدر |
5-8 مشاريع منافسة في المنطقة

## 6. العرض والطلب
- المشاريع قيد الإنشاء، معدلات الإشغال، الطلب المتوقع

## 7. الفرص والمخاطر
- 3-5 فرص محددة مع تبرير
- 3-5 مخاطر مع احتمالية وتأثير

## 8. التوصيات السعرية
- السعر الموصى به لكل نوع وحدة مع التبرير

قواعد إلزامية:
- التحليل باللغة العربية (1500-2500 كلمة)
- كل رقم مرفق بمصدره
- استخدمي جداول Markdown للمقارنات
- التقديرات تُعلّم: "تقدير مهني - يحتاج تحقق"
- الأسلوب مهني كتقارير JLL و Colliers`;

      try {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: `أنتِ جويل، خبيرة تحليل السوق العقاري في دبي. التاريخ: ${reportDate} (عام ${currentYear}). لا تستخدمي بيانات 2024 كبيانات حالية.` },
            { role: "user", content: prompt },
          ],
        });
        const analysis = response.choices[0]?.message?.content || "لم يتم إنشاء التحليل";
        
        await db.update(feasibilityStudies)
          .set({ marketAnalysis: analysis })
          .where(eq(feasibilityStudies.id, input.studyId));
        
        return { success: true, analysis };
      } catch (error: any) {
        throw new Error(`فشل في تحليل السوق: ${error.message}`);
      }
    }),

  // Duplicate study as new scenario
  duplicateAsScenario: publicProcedure
    .input(z.object({
      studyId: z.number(),
      scenarioName: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const results = await db.select().from(feasibilityStudies).where(
        and(eq(feasibilityStudies.id, input.studyId), eq(feasibilityStudies.userId, ctx.user.id))
      );
      if (!results[0]) throw new Error("Study not found");
      
      const original = results[0];
      const { id, createdAt, updatedAt, aiSummary, marketAnalysis, competitorAnalysis, priceRecommendation, ...studyData } = original;
      
      const result = await db.insert(feasibilityStudies).values({
        ...studyData,
        scenarioName: input.scenarioName,
        projectName: `${original.projectName} - ${input.scenarioName}`,
      });
      
      return { id: Number(result[0].insertId) };
    }),

  // Generate comprehensive report
  generateComprehensiveReport: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
            const results = await db.select().from(feasibilityStudies).where(
        and(eq(feasibilityStudies.id, input.id), eq(feasibilityStudies.userId, ctx.user.id))
      );
      if (!results[0]) throw new Error("Study not found");
      const study = results[0];

      // Get project details
      const projectResults = await db.select().from(projects)
        .where(eq(projects.id, study.projectId));
      const project = projectResults[0];

      // Get market overview data
      const moResults = await db.select().from(marketOverview)
        .where(and(eq(marketOverview.projectId, study.projectId), eq(marketOverview.userId, ctx.user.id)));
      const mo = moResults[0] || null;

      // Get competition pricing data
      const cpResults = await db.select().from(competitionPricing)
        .where(and(eq(competitionPricing.projectId, study.projectId), eq(competitionPricing.userId, ctx.user.id)));
      const cp = cpResults[0] || null;

      const currentDate2 = new Date();
      const reportDate2 = `${currentDate2.getDate()}/${currentDate2.getMonth() + 1}/${currentDate2.getFullYear()}`;
      const currentYear2 = currentDate2.getFullYear();
      const prompt = `أنتِ جويل، محللة استخبارات السوق ودراسات الجدوى في Como Developments. اكتبي تقريراً شاملاً بمستوى JLL / Colliers للمشروع: ${study.projectName}.

🚨 تاريخ التقرير: ${reportDate2} - نحن في عام ${currentYear2}. كل البيانات يجب أن تكون من ${currentYear2 - 1}-${currentYear2}. لا تستخدمي بيانات 2024 أو أقدم.

البيانات المالية:
- إجمالي التكاليف: ${study.totalCosts ? Number(study.totalCosts).toLocaleString() : 'غير محدد'} درهم
- إجمالي الإيرادات: ${study.totalRevenue ? Number(study.totalRevenue).toLocaleString() : 'غير محدد'} درهم
- الربح: ${study.profit ? Number(study.profit).toLocaleString() : 'غير محدد'} درهم
- ROI: ${study.roi || 'غير محدد'}%
- هامش الربح: ${study.profitMargin || 'غير محدد'}%

${cp ? `
بيانات التسعير المحفوظة (من دراسة السوق):
- استديو: ${cp.baseStudioPrice || 'غير محدد'} درهم/قدم²
- غرفة وصالة: ${cp.base1brPrice || 'غير محدد'} درهم/قدم²
- غرفتان وصالة: ${cp.base2brPrice || 'غير محدد'} درهم/قدم²
- ثلاث غرف: ${cp.base3brPrice || 'غير محدد'} درهم/قدم²` : ''}

${mo ? `
بيانات النظرة العامة للسوق:
- جودة التشطيب: ${mo.finishingQuality || 'غير محدد'}
- نسبة الاستديو: ${mo.residentialStudioPct || 0}%
- نسبة الغرفة الواحدة: ${mo.residential1brPct || 0}%
- نسبة الغرفتين: ${mo.residential2brPct || 0}%` : ''}

اكتبي التقرير بالأقسام التالية:

## 1. الملخص التنفيذي (Executive Summary)
فقرة واحدة مكثفة بأهم 5 أرقام والتوصية الرئيسية.

## 2. السياق الاقتصادي وتحليل الموقع
- السياق الاقتصادي الكلي لدبي
- تحليل الموقع والبنية التحتية

## 3. تحليل السوق والمنافسة
- العرض والطلب في المنطقة
- جدول المنافسين (5-8 مشاريع)
| المشروع | المطور | سعر/قدم² | الحالة | المصدر |

## 4. الإسقاطات المالية المفصلة
- جدول التكاليف المفصل
- جدول الإيرادات المتوقعة
- تحليل الربحية والعوائد

## 5. تحليل الحساسية
| السيناريو | الربح | هامش الربح | ROI | التقييم |
- أسعار -20%، -10%، أساسي، +10%، +20%
- تكاليف بناء +15%

## 6. المخاطر والفرص
| المخاطرة | الاحتمالية | التأثير | التخفيف |
- 3-5 مخاطر محددة
- 3-5 فرص محددة

## 7. التوصيات الاستراتيجية
- توصية واضحة (موافقة / موافقة بشروط / رفض)
- استراتيجية التسعير الموصى بها
- الخطوات التالية

قواعد إلزامية:
- التقرير باللغة العربية (2500-4000 كلمة)
- كل رقم مرفق بمصدره
- استخدمي جداول Markdown للمقارنات
- الأسلوب مهني كتقارير JLL و Colliers`;

      try {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: `أنتِ جويل، محللة دراسات الجدوى المتقدمة. التاريخ: ${reportDate2} (عام ${currentYear2}). لا تستخدمي بيانات 2024 كبيانات حالية.` },
            { role: "user", content: prompt },
          ],
        });
        const report = response.choices[0]?.message?.content || "لم يتم إنشاء التقرير";
        
        await db.update(feasibilityStudies)
          .set({ competitorAnalysis: report })
          .where(eq(feasibilityStudies.id, input.id));
        
        return { success: true, report };
      } catch (error: any) {
        throw new Error(`فشل في إنشاء التقرير: ${error.message}`);
      }
    }),

  // Generate executive report for board
  generateExecutiveReport: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const results = await db.select().from(feasibilityStudies).where(
        and(eq(feasibilityStudies.id, input.id), eq(feasibilityStudies.userId, ctx.user.id))
      );
      if (!results[0]) throw new Error("Study not found");
      const study = results[0];

      const currentDate3 = new Date();
      const reportDate3 = `${currentDate3.getDate()}/${currentDate3.getMonth() + 1}/${currentDate3.getFullYear()}`;
      const currentYear3 = currentDate3.getFullYear();
      const prompt = `أنتِ جويل، محللة استخبارات السوق في Como Developments. اكتبي تقريراً تنفيذياً موجزاً لمجلس الإدارة بمستوى JLL / Colliers عن المشروع: ${study.projectName}.

🚨 تاريخ التقرير: ${reportDate3} - نحن في عام ${currentYear3}. كل البيانات يجب أن تكون من ${currentYear3 - 1}-${currentYear3}.

البيانات المالية:
- إجمالي التكاليف: ${study.totalCosts ? Number(study.totalCosts).toLocaleString() : 'غير محدد'} درهم
- إجمالي الإيرادات: ${study.totalRevenue ? Number(study.totalRevenue).toLocaleString() : 'غير محدد'} درهم
- الربح: ${study.profit ? Number(study.profit).toLocaleString() : 'غير محدد'} درهم
- ROI: ${study.roi || 'غير محدد'}%
- هامش الربح: ${study.profitMargin || 'غير محدد'}%

التقرير يجب أن يكون موجزاً (1-2 صفحة) بالهيكل التالي:

## التوصية (أولاً)
✅ موافقة / ✅ موافقة بشروط / ❌ رفض
سطر واحد يلخص التوصية.

## المؤشرات الرئيسية
| المؤشر | القيمة | المعيار | التقييم |
الربح، ROI، هامش الربح، التمويل المطلوب، فترة الاسترداد

## الموقف التنافسي
فقرة واحدة تلخص موقع المشروع مقارنة بالمنافسين.

## أهم 3 مخاطر
| المخاطرة | الاحتمالية | التأثير | التخفيف |

## الخطوات التالية
قائمة مرقمة بأهم 3-5 خطوات مطلوبة.

قواعد إلزامية:
- موجز ومباشر (600-900 كلمة فقط)
- التوصية في البداية (لا في النهاية)
- جداول Markdown للأرقام
- باللغة العربية
- الأسلوب مهني كتقارير JLL و Colliers`;

      try {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: `أنتِ جويل، محللة دراسات الجدوى. التاريخ: ${reportDate3} (عام ${currentYear3}). لا تستخدمي بيانات 2024 كبيانات حالية.` },
            { role: "user", content: prompt },
          ],
        });
        const report = response.choices[0]?.message?.content || "لم يتم إنشاء التقرير";
        
        await db.update(feasibilityStudies)
          .set({ priceRecommendation: report })
          .where(eq(feasibilityStudies.id, input.id));
        
        return { success: true, report };
      } catch (error: any) {
        throw new Error(`فشل في إنشاء التقرير: ${error.message}`);
      }
    }),

  // Get cash flow data for charts
  getCashFlowData: publicProcedure
    .input(z.number())
    .query(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const results = await db.select().from(feasibilityStudies).where(
        and(eq(feasibilityStudies.id, input), eq(feasibilityStudies.userId, ctx.user.id))
      );
      if (!results[0]) throw new Error("Study not found");
      const study = results[0];

      const saleableRes = (study.gfaResidential || 0) * ((study.saleableResidentialPct || 95) / 100);
      const saleableRet = (study.gfaRetail || 0) * ((study.saleableRetailPct || 97) / 100);
      const saleableOff = (study.gfaOffices || 0) * ((study.saleableOfficesPct || 95) / 100);
      const constructionCost = (study.estimatedBua || 0) * (study.constructionCostPerSqft || 0);
      const revenueRes = saleableRes * (study.residentialSalePrice || 0);
      const revenueRet = saleableRet * (study.retailSalePrice || 0);
      const revenueOff = saleableOff * (study.officesSalePrice || 0);
      const totalRevenue = revenueRes + revenueRet + revenueOff;
      const landReg = (study.landPrice || 0) * 0.04;
      const agentLand = (study.landPrice || 0) * ((study.agentCommissionLandPct || 1) / 100);
      const designFee = constructionCost * ((study.designFeePct || 2) / 100);
      const supervisionFee = constructionCost * ((study.supervisionFeePct || 2) / 100);
      const totalGfaSqft2 = (study.gfaResidential || 0) + (study.gfaRetail || 0) + (study.gfaOffices || 0);
      const separationFee = totalGfaSqft2 * (study.separationFeePerM2 || 40);
      const contingencies = constructionCost * ((study.contingenciesPct || 2) / 100);
      const reraUnits = (study.numberOfUnits || 0) * (study.reraUnitFee || 850);
      const fixedFees = (study.reraOffplanFee || 0) + (study.nocFee || 0) + (study.escrowFee || 0) + (study.bankCharges || 0) + (study.surveyorFees || 0) + (study.reraAuditFees || 0) + (study.reraInspectionFees || 0);
      const devFee = totalRevenue * ((study.developerFeePct || 5) / 100);
      const agentSale = totalRevenue * ((study.agentCommissionSalePct || 5) / 100);
      const marketing = totalRevenue * ((study.marketingPct || 2) / 100);
      const totalCosts = (study.landPrice || 0) + landReg + agentLand + constructionCost + designFee + supervisionFee + separationFee + contingencies + reraUnits + fixedFees + (study.soilInvestigation || 0) + (study.topographySurvey || 0) + (study.authoritiesFee || 0) + (study.communityFee || 0) + devFee + agentSale + marketing;
      const profit = totalRevenue - totalCosts;
      const fundingRequired = totalCosts - (constructionCost * 0.65);
      const comoProfit = profit * ((study.comoProfitSharePct || 15) / 100);
      const investorProfit = profit - comoProfit;

      return {
        projectName: study.projectName,
        totalRevenue: Math.round(totalRevenue),
        totalCosts: Math.round(totalCosts),
        profit: Math.round(profit),
        fundingRequired: Math.round(fundingRequired),
        comoProfit: Math.round(comoProfit),
        investorProfit: Math.round(investorProfit),
        profitMargin: totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0,
        roi: fundingRequired > 0 ? (investorProfit / fundingRequired) * 100 : 0,
      };
    }),
});
