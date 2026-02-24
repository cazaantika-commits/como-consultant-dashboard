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
      const saleableRes = (study.gfaResidential || 0) * ((study.saleableResidentialPct || 90) / 100);
      const saleableRet = (study.gfaRetail || 0) * ((study.saleableRetailPct || 99) / 100);
      const saleableOff = (study.gfaOffices || 0) * ((study.saleableOfficesPct || 90) / 100);
      const constructionCost = (study.estimatedBua || 0) * (study.constructionCostPerSqft || 0);
      const revenueRes = saleableRes * (study.residentialSalePrice || 0);
      const revenueRet = saleableRet * (study.retailSalePrice || 0);
      const revenueOff = saleableOff * (study.officesSalePrice || 0);
      const totalRevenue = revenueRes + revenueRet + revenueOff;
      const landReg = (study.landPrice || 0) * 0.04;
      const agentLand = (study.landPrice || 0) * ((study.agentCommissionLandPct || 1) / 100);
      const designFee = constructionCost * ((study.designFeePct || 2) / 100);
      const supervisionFee = constructionCost * ((study.supervisionFeePct || 2) / 100);
      const separationFee = (study.plotAreaM2 || 0) * (study.separationFeePerM2 || 40);
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

      const prompt = `أنتِ جويل، محللة دراسات الجدوى في شركة Como Developments. اكتبي ملخصاً تحليلياً ذكياً باللغة العربية لدراسة الجدوى التالية:

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

اكتبي ملخصاً مهنياً يتضمن:
1. تقييم عام للمشروع (هل هو مجدي أم لا)
2. نقاط القوة والضعف
3. المخاطر الرئيسية
4. توصيات للتحسين
5. مقارنة مع معايير السوق في دبي

اجعلي الملخص مختصراً ومفيداً (500-800 كلمة).`;

      try {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: "أنتِ جويل، محللة دراسات الجدوى والسوق في شركة Como Developments. تحليلاتك دقيقة ومهنية." },
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

      const prompt = `أنتِ جويل، محللة السوق العقاري في Como Developments. قومي بتحليل سوق منطقة "${input.community}" في دبي:

1. **أسعار البيع الحالية**: متوسط أسعار القدم المربع للسكني والتجاري والمكاتب
2. **المشاريع المنافسة**: أبرز المشاريع الجديدة في المنطقة أو القريبة منها
3. **اتجاهات السوق**: هل الأسعار في ارتفاع أم انخفاض؟ ما هو معدل الطلب؟
4. **توصيات سعرية**: ما هو السعر المناسب للبيع بناءً على تحليلك؟
5. **فرص ومخاطر**: ما هي الفرص والمخاطر في هذه المنطقة؟

ملاحظة مهمة: لا تعتمدي على أسعار جاهزة. قدمي تحليلاً مبنياً على معرفتك بسوق دبي العقاري.
اكتبي التحليل باللغة العربية بشكل مهني ومفصل.`;

      try {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: "أنتِ جويل، خبيرة تحليل السوق العقاري في دبي. تحليلاتك مبنية على بحث مستقل ومعمق." },
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
});
