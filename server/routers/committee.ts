import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getCommitteeDecision, upsertCommitteeDecision, getAiAdvisoryScores, upsertAiAdvisoryScore } from "../db";
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
        decisionBasis: z.string().optional(),
        justification: z.string().optional(),
        negotiationTarget: z.string().optional(),
        negotiationConditions: z.string().optional(),
        committeeNotes: z.string().optional(),
        aiAnalysis: z.string().optional(),
        aiRecommendation: z.string().optional(),
        aiPostDecisionAnalysis: z.string().optional(),
        isConfirmed: z.number().optional(),
        confirmedBy: z.string().optional(),
      })
    )
    .mutation(({ input }) => {
      const { projectId, ...data } = input;
      return upsertCommitteeDecision(projectId, data);
    }),

  // Confirm committee decision (locks it)
  confirmDecision: publicProcedure
    .input(z.object({
      projectId: z.number(),
      confirmedBy: z.string(),
    }))
    .mutation(async ({ input }) => {
      return upsertCommitteeDecision(input.projectId, {
        isConfirmed: 1,
        confirmedBy: input.confirmedBy,
      });
    }),

  // Get AI advisory scores for a project
  getAiAdvisory: publicProcedure
    .input(z.number())
    .query(({ input }) => {
      return getAiAdvisoryScores(input);
    }),

  // Generate AI advisory scores for all consultants on a criterion
  generateAiAdvisory: publicProcedure
    .input(z.object({
      projectId: z.number(),
      projectName: z.string(),
      criterionName: z.string(),
      criterionId: z.number(),
      criterionWeight: z.number(),
      criterionDescription: z.string(),
      scoreGuide: z.string(),
      consultants: z.array(z.object({
        id: z.number(),
        name: z.string(),
        profile: z.string().optional(),
      })),
    }))
    .mutation(async ({ input }) => {
      const consultantsInfo = input.consultants
        .map(c => `- ${c.name}: ${c.profile || 'لا تتوفر معلومات إضافية'}`)
        .join('\n');

      const prompt = `أنت خبير في تقييم المكاتب الهندسية الاستشارية في الإمارات.

المشروع: "${input.projectName}"
المعيار: "${input.criterionName}" (الوزن: ${input.criterionWeight}%)
وصف المعيار: ${input.criterionDescription}

دليل التقييم:
${input.scoreGuide}

الاستشاريون المتقدمون:
${consultantsInfo}

لكل استشاري، اقترح درجة (0، 25، 50، 75، أو 100) مع مبرر مختصر.
هذا رأي استشاري فقط - القرار النهائي للجنة.

أجب بصيغة JSON:
[{"consultantId": number, "suggestedScore": number, "reasoning": "مبرر مختصر"}]`;

      try {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: "أنت خبير تقييم استشارات هندسية. أجب بصيغة JSON فقط. الدرجات المسموحة: 0, 25, 50, 75, 100." },
            { role: "user", content: prompt },
          ],
        });

        const content = response.choices[0]?.message?.content || "[]";
        // Extract JSON from response
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (!jsonMatch) return { scores: [] };

        const scores = JSON.parse(jsonMatch[0]) as Array<{ consultantId: number; suggestedScore: number; reasoning: string }>;

        // Save to database
        for (const score of scores) {
          await upsertAiAdvisoryScore({
            projectId: input.projectId,
            consultantId: score.consultantId,
            criterionId: input.criterionId,
            suggestedScore: score.suggestedScore,
            reasoning: score.reasoning,
          });
        }

        return { scores };
      } catch (error) {
        return { scores: [] };
      }
    }),

  // Fee deviation analysis
  analyzeFeeDeviation: publicProcedure
    .input(z.object({
      consultants: z.array(z.object({
        id: z.number(),
        name: z.string(),
        totalFee: z.number(),
      })),
    }))
    .query(({ input }) => {
      const fees = input.consultants.map(c => c.totalFee).filter(f => f > 0);
      if (fees.length === 0) return { average: 0, consultants: [] };

      const average = fees.reduce((sum, f) => sum + f, 0) / fees.length;

      const analyzed = input.consultants.map(c => {
        const deviation = average > 0 ? ((c.totalFee - average) / average) * 100 : 0;
        let zone: 'normal' | 'moderate_high' | 'extreme_high' | 'extreme_low' = 'normal';
        let zoneLabel = 'النطاق الطبيعي';
        let penalty = 0;
        let flag: string | null = null;

        if (deviation > 30) {
          zone = 'extreme_high';
          zoneLabel = 'انحراف مرتفع جداً';
          penalty = 0.15; // 15% financial penalty in value analysis
          flag = 'مخاطر تكلفة عالية';
        } else if (deviation > 15) {
          zone = 'moderate_high';
          zoneLabel = 'انحراف مرتفع معتدل';
          penalty = 0.07; // 7% mild financial penalty
          flag = null;
        } else if (deviation < -30) {
          zone = 'extreme_low';
          zoneLabel = 'انحراف منخفض جداً';
          penalty = 0; // No penalty for low fees
          flag = 'مخاطر سعر منخفض';
        }

        return {
          ...c,
          deviation: Math.round(deviation * 10) / 10,
          zone,
          zoneLabel,
          penalty,
          flag,
          adjustedScore: 0, // Will be calculated on frontend with technical score
        };
      });

      return { average: Math.round(average), consultants: analyzed };
    }),

  // AI analysis for committee decision (pre-decision)
  analyzeDecision: publicProcedure
    .input(
      z.object({
        projectName: z.string(),
        projectType: z.string().optional(),
        selectedConsultantName: z.string(),
        decisionType: z.string(),
        decisionBasis: z.string().optional(),
        rankings: z.array(z.object({
          name: z.string(),
          rank: z.number(),
          technicalScore: z.number(),
          totalFee: z.number(),
          feeDeviation: z.number().optional(),
          feeZone: z.string().optional(),
        })),
        negotiationTarget: z.string().optional(),
        negotiationConditions: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const rankingsText = input.rankings
        .map(r => `المركز ${r.rank}: ${r.name} (التقييم الفني: ${r.technicalScore.toFixed(1)}/100، الأتعاب: ${r.totalFee.toLocaleString()} AED${r.feeDeviation ? `، انحراف: ${r.feeDeviation > 0 ? '+' : ''}${r.feeDeviation.toFixed(1)}%` : ''}${r.feeZone ? ` [${r.feeZone}]` : ''})`)
        .join('\n');

      const basisMap: Record<string, string> = {
        'highest_technical': 'الأعلى فنياً',
        'best_value': 'أفضل قيمة',
        'lowest_fee': 'الأقل تكلفة',
        'highest_fee_with_negotiation': 'الأعلى تكلفة مع تفاوض',
        'other': 'أسباب أخرى',
      };

      const prompt = `أنت محلل استشارات هندسية خبير. قرار اللجنة لمشروع "${input.projectName}":

ترتيب الاستشاريين (فني فقط - الأتعاب منفصلة):
${rankingsText}

قرار اللجنة: ${input.decisionType === 'selected' ? `اختيار ${input.selectedConsultantName}` : input.decisionType === 'negotiate' ? `التفاوض مع ${input.selectedConsultantName}` : 'قيد الدراسة'}
أساس القرار: ${basisMap[input.decisionBasis || ''] || input.decisionBasis || 'غير محدد'}
${input.negotiationTarget ? `التارجت: ${input.negotiationTarget}` : ''}
${input.negotiationConditions ? `شروط التفاوض: ${input.negotiationConditions}` : ''}

ملاحظات مهمة:
- التقييم الفني مستقل 100% عن الأتعاب
- الترتيب مرجعي وليس ملزماً
- قرار اللجنة سيادي
- لا يتم استبعاد أي استشاري تلقائياً

حلل هذا القرار:
1. تقييم مدى اتساق القرار مع البيانات
2. نقاط القوة في هذا الاختيار
3. المخاطر المحتملة
4. توصيات للخطوات القادمة
5. إذا كان هناك تفاوض، اقترح استراتيجية التفاوض

اكتب بالعربية بشكل مهني ومختصر.`;

      try {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: "أنت محلل استشارات هندسية متخصص في تقييم المكاتب الهندسية في الإمارات. أجب بالعربية بشكل مهني ومختصر. تذكر: التقييم الفني منفصل عن المالي، وقرار اللجنة سيادي." },
            { role: "user", content: prompt },
          ],
        });
        return { analysis: response.choices[0]?.message?.content || "لم يتم التحليل" };
      } catch (error) {
        return { analysis: "حدث خطأ في التحليل. يرجى المحاولة لاحقاً." };
      }
    }),

  // AI post-decision analysis (after confirmation)
  postDecisionAnalysis: publicProcedure
    .input(z.object({
      projectId: z.number(),
      projectName: z.string(),
      selectedConsultantName: z.string(),
      decisionType: z.string(),
      decisionBasis: z.string().optional(),
      justification: z.string().optional(),
      rankings: z.array(z.object({
        name: z.string(),
        rank: z.number(),
        technicalScore: z.number(),
        totalFee: z.number(),
      })),
      negotiationTarget: z.string().optional(),
      negotiationConditions: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const rankingsText = input.rankings
        .map(r => `${r.name}: فني ${r.technicalScore.toFixed(1)}/100، أتعاب ${r.totalFee.toLocaleString()} AED`)
        .join('\n');

      const prompt = `أنت محلل استشارات هندسية. تم تأكيد قرار اللجنة لمشروع "${input.projectName}":

القرار: ${input.decisionType === 'selected' ? `اختيار ${input.selectedConsultantName}` : `التفاوض مع ${input.selectedConsultantName}`}
أساس القرار: ${input.decisionBasis || 'غير محدد'}
مبررات اللجنة: ${input.justification || 'لم تُذكر'}
${input.negotiationTarget ? `التارجت: ${input.negotiationTarget}` : ''}
${input.negotiationConditions ? `شروط التفاوض: ${input.negotiationConditions}` : ''}

الاستشاريون:
${rankingsText}

قدم تحليلاً شاملاً بعد القرار:
1. **ملخص القرار**: وصف مختصر للقرار وأسبابه
2. **تقييم الاختيار**: هل القرار منطقي بناءً على البيانات؟
3. **خطة العمل المقترحة**: الخطوات التالية (تفاوض، عقد، بدء العمل)
4. **نقاط يجب مراقبتها**: مخاطر أو أمور تحتاج متابعة
5. **دروس مستفادة**: ملاحظات لتحسين عملية التقييم مستقبلاً

اكتب بالعربية بشكل مهني وشامل.`;

      try {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: "أنت محلل استشارات هندسية خبير. قدم تحليلاً شاملاً ومهنياً بعد تأكيد قرار اللجنة. اكتب بالعربية." },
            { role: "user", content: prompt },
          ],
        });

        const analysis = response.choices[0]?.message?.content || "لم يتم التحليل";

        // Save the post-decision analysis
        await upsertCommitteeDecision(input.projectId, {
          aiPostDecisionAnalysis: analysis,
        });

        return { analysis };
      } catch (error) {
        return { analysis: "حدث خطأ في التحليل. يرجى المحاولة لاحقاً." };
      }
    }),

  // AI recommendation for project (enhanced with fee deviation awareness)
  getRecommendation: publicProcedure
    .input(
      z.object({
        projectName: z.string(),
        projectBua: z.number().optional(),
        projectPricePerSqft: z.number().optional(),
        consultants: z.array(z.object({
          name: z.string(),
          technicalScore: z.number(),
          totalFee: z.number(),
          feeDeviation: z.number().optional(),
          feeZone: z.string().optional(),
          designType: z.string().optional(),
          supervisionType: z.string().optional(),
        })),
      })
    )
    .mutation(async ({ input }) => {
      const consultantsText = input.consultants
        .map(c => `- ${c.name}: التقييم الفني ${c.technicalScore.toFixed(1)}/100، الأتعاب ${c.totalFee.toLocaleString()} AED${c.feeDeviation ? ` (انحراف ${c.feeDeviation > 0 ? '+' : ''}${c.feeDeviation.toFixed(1)}% - ${c.feeZone || ''})` : ''}`)
        .join('\n');

      const buildingCost = (input.projectBua || 0) * (input.projectPricePerSqft || 0);

      const prompt = `أنت مستشار خبير في اختيار المكاتب الهندسية للمشاريع العقارية في دبي.

مشروع: "${input.projectName}"
مساحة البناء: ${(input.projectBua || 0).toLocaleString()} قدم²
تكلفة البناء التقديرية: ${buildingCost.toLocaleString()} AED

الاستشاريون (التقييم الفني منفصل عن المالي):
${consultantsText}

مبادئ مهمة:
- التقييم الفني مستقل 100% عن الأتعاب
- لا يتم استبعاد أي استشاري تلقائياً
- الترتيب مرجعي وليس ملزماً
- القرار النهائي للجنة

قدم تحليلاً ذكياً:
1. **الأعلى فنياً**: من حصل على أعلى تقييم فني؟
2. **أفضل قيمة**: من يقدم أفضل توازن بين الجودة والسعر؟
3. **الأقل تكلفة**: من الأرخص وما مستواه الفني؟
4. **تحليل الانحرافات**: هل هناك أسعار مبالغ فيها أو منخفضة بشكل مقلق؟
5. **التوصية**: اعرض 3 سيناريوهات ممكنة مع مبررات كل منها

اكتب بالعربية بشكل مهني ومختصر. لا تكرر البيانات، ركز على التحليل.`;

      try {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: "أنت مستشار خبير في اختيار المكاتب الهندسية للمشاريع العقارية في الإمارات. أجب بالعربية بشكل مهني ومختصر. تذكر: التقييم الفني منفصل عن المالي، وقرار اللجنة سيادي." },
            { role: "user", content: prompt },
          ],
        });
        return { recommendation: response.choices[0]?.message?.content || "لم يتم التوصية" };
      } catch (error) {
        return { recommendation: "حدث خطأ في التوصية. يرجى المحاولة لاحقاً." };
      }
    }),
});
