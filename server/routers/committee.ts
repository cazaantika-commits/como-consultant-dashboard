import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getCommitteeDecision, upsertCommitteeDecision } from "../db";
import { invokeLLM } from "../_core/llm";

export const committeeRouter = router({
  getByProject: publicProcedure
    .input(z.number())
    .query(({ input }) => {
      return getCommitteeDecision(input);
    }),

  upsert: publicProcedure
    .input(
      z.object({
        projectId: z.number(),
        selectedConsultantId: z.number().optional(),
        decisionType: z.string().optional(),
        negotiationTarget: z.string().optional(),
        committeeNotes: z.string().optional(),
        aiAnalysis: z.string().optional(),
        aiRecommendation: z.string().optional(),
      })
    )
    .mutation(({ input }) => {
      const { projectId, ...data } = input;
      return upsertCommitteeDecision(projectId, data);
    }),

  // AI analysis for committee decision
  analyzeDecision: publicProcedure
    .input(
      z.object({
        projectName: z.string(),
        projectType: z.string().optional(),
        selectedConsultantName: z.string(),
        decisionType: z.string(),
        rankings: z.array(z.object({
          name: z.string(),
          rank: z.number(),
          score: z.number(),
          cost: z.number(),
        })),
        negotiationTarget: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const rankingsText = input.rankings
        .map(r => `المركز ${r.rank}: ${r.name} (التقييم: ${r.score.toFixed(1)}/100، الأتعاب: ${r.cost.toLocaleString()} AED)`)
        .join('\n');

      const prompt = `أنت محلل استشارات هندسية خبير. قرار اللجنة لمشروع "${input.projectName}":

ترتيب الاستشاريين حسب التقييم:
${rankingsText}

قرار اللجنة: ${input.decisionType === 'selected' ? `اختيار ${input.selectedConsultantName}` : input.decisionType === 'negotiate' ? `التفاوض مع ${input.selectedConsultantName}` : 'قيد الدراسة'}
${input.negotiationTarget ? `التارجت: ${input.negotiationTarget}` : ''}

حلل هذا القرار بشكل مختصر ومهني:
1. لماذا اختارت اللجنة هذا الاستشاري؟
2. ما هي نقاط القوة في هذا الاختيار؟
3. ما هي المخاطر المحتملة؟
4. توصيات للخطوات القادمة

اكتب بالعربية بشكل مختصر ومهني.`;

      try {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: "أنت محلل استشارات هندسية متخصص في تقييم المكاتب الهندسية في الإمارات. أجب بالعربية بشكل مهني ومختصر." },
            { role: "user", content: prompt },
          ],
        });
        return { analysis: response.choices[0]?.message?.content || "لم يتم التحليل" };
      } catch (error) {
        return { analysis: "حدث خطأ في التحليل. يرجى المحاولة لاحقاً." };
      }
    }),

  // AI recommendation for project
  getRecommendation: publicProcedure
    .input(
      z.object({
        projectName: z.string(),
        projectBua: z.number().optional(),
        projectPricePerSqft: z.number().optional(),
        consultants: z.array(z.object({
          name: z.string(),
          score: z.number(),
          cost: z.number(),
          designType: z.string().optional(),
          supervisionType: z.string().optional(),
        })),
      })
    )
    .mutation(async ({ input }) => {
      const consultantsText = input.consultants
        .map(c => `- ${c.name}: التقييم ${c.score.toFixed(1)}/100، الأتعاب ${c.cost.toLocaleString()} AED`)
        .join('\n');

      const buildingCost = (input.projectBua || 0) * (input.projectPricePerSqft || 0);

      const prompt = `أنت مستشار خبير في اختيار المكاتب الهندسية للمشاريع العقارية في دبي.

مشروع: "${input.projectName}"
مساحة البناء: ${(input.projectBua || 0).toLocaleString()} قدم²
تكلفة البناء التقديرية: ${buildingCost.toLocaleString()} AED

الاستشاريون المتقدمون:
${consultantsText}

قدم توصية ذكية ومختصرة:
1. من هو الأفضل من حيث القيمة مقابل السعر (Value for Money)؟
2. من هو الأفضل من حيث الجودة فقط؟
3. من هو الأرخص؟
4. توصيتك النهائية مع السبب

اكتب بالعربية بشكل مهني ومختصر. لا تكرر البيانات، ركز على التحليل والتوصية.`;

      try {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: "أنت مستشار خبير في اختيار المكاتب الهندسية للمشاريع العقارية في الإمارات. أجب بالعربية بشكل مهني ومختصر وعملي." },
            { role: "user", content: prompt },
          ],
        });
        return { recommendation: response.choices[0]?.message?.content || "لم يتم التوصية" };
      } catch (error) {
        return { recommendation: "حدث خطأ في التوصية. يرجى المحاولة لاحقاً." };
      }
    }),
});
