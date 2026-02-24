import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { 
  createProposal, 
  getProposals, 
  getProposalById,
  updateProposalAnalysis,
  createComparison,
  getComparisons,
  getComparisonById
} from "../db";
import { storagePut } from "../storage";
import { invokeLLM } from "../_core/llm";

// Comprehensive proposal analysis prompt - extracts detailed structured data
async function analyzeProposalWithAI(extractedText: string, proposalTitle: string) {
  try {
    const prompt = `أنت محلل خبير في عروض الاستشاريين الهندسيين في قطاع التطوير العقاري. حلل العرض التالي بشكل شامل ومحايد واستخرج كل التفاصيل المهمة.

عنوان العرض: ${proposalTitle}

محتوى العرض:
${extractedText.substring(0, 20000)} 

استخرج المعلومات التالية بدقة وحيادية. إذا لم تجد معلومة معينة في العرض، اكتب "غير مذكور في العرض".

أجب بصيغة JSON فقط:
{
  "summary": "ملخص شامل للعرض في 3-5 جمل",
  "keyPoints": ["النقاط الرئيسية في العرض"],
  "strengths": ["نقاط القوة"],
  "weaknesses": ["نقاط الضعف والثغرات"],
  "recommendation": "التوصية النهائية",
  "score": 85,
  "scope": {
    "items": ["قائمة تفصيلية بكل الأعمال المشمولة في العرض"],
    "phases": ["مراحل العمل إن وجدت"],
    "notes": "ملاحظات إضافية عن نطاق الأعمال"
  },
  "exclusions": {
    "items": ["قائمة بكل الأعمال المستثناة وغير المشمولة"],
    "risks": ["المخاطر المترتبة على هذه الاستثناءات"],
    "notes": "ملاحظات عن الاستثناءات"
  },
  "additionalWorks": {
    "items": [{"work": "وصف العمل الإضافي", "cost": "التكلفة إن ذُكرت", "condition": "شرط تطبيقه"}],
    "notes": "ملاحظات عن الأعمال الإضافية"
  },
  "supervisionTerms": {
    "included": true,
    "type": "نسبة مئوية / مبلغ مقطوع / غير مشمول",
    "value": "القيمة أو النسبة",
    "scope": "نطاق أعمال الإشراف المشمولة",
    "duration": "مدة الإشراف",
    "team": "فريق الإشراف المقترح",
    "notes": "ملاحظات عن الإشراف"
  },
  "timeline": {
    "totalDuration": "المدة الإجمالية",
    "phases": [{"phase": "اسم المرحلة", "duration": "المدة", "deliverables": "المخرجات"}],
    "notes": "ملاحظات عن الجدول الزمني"
  },
  "paymentTerms": {
    "method": "طريقة الدفع (أقساط/مراحل/شهري)",
    "schedule": [{"milestone": "المرحلة", "percentage": "النسبة", "condition": "الشرط"}],
    "retainer": "دفعة مقدمة إن وجدت",
    "notes": "ملاحظات عن شروط الدفع"
  },
  "conditions": {
    "general": ["الشروط العامة"],
    "special": ["الشروط الخاصة أو غير المعتادة"],
    "termination": "شروط الإنهاء",
    "liability": "حدود المسؤولية",
    "insurance": "التأمين المطلوب",
    "notes": "ملاحظات عن الشروط"
  },
  "teamComposition": {
    "members": [{"role": "الدور", "name": "الاسم إن ذُكر", "experience": "الخبرة"}],
    "totalSize": "حجم الفريق",
    "notes": "ملاحظات عن الفريق"
  },
  "deliverables": {
    "items": [{"deliverable": "المخرج", "format": "الصيغة", "copies": "عدد النسخ"}],
    "notes": "ملاحظات عن المخرجات"
  }
}`;

    const response = await invokeLLM({
      messages: [
        { role: "system", content: "أنت محلل خبير ومحايد في عروض الاستشاريين الهندسيين. مهمتك استخراج كل التفاصيل بدقة وحيادية بدون تحيز لأي طرف. أجب دائماً بصيغة JSON صحيحة فقط بدون أي نص إضافي." },
        { role: "user", content: prompt }
      ],
    });

    const content = response.choices[0]?.message?.content || "{}";
    
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in AI response");
    }
    
    const analysis = JSON.parse(jsonMatch[0]);
    
    return {
      aiSummary: analysis.summary || "",
      aiKeyPoints: analysis.keyPoints || [],
      aiStrengths: analysis.strengths || [],
      aiWeaknesses: analysis.weaknesses || [],
      aiRecommendation: analysis.recommendation || "",
      aiScore: analysis.score || 0,
      aiScope: analysis.scope || null,
      aiExclusions: analysis.exclusions || null,
      aiAdditionalWorks: analysis.additionalWorks || null,
      aiSupervisionTerms: analysis.supervisionTerms || null,
      aiTimeline: analysis.timeline || null,
      aiPaymentTerms: analysis.paymentTerms || null,
      aiConditions: analysis.conditions || null,
      aiTeamComposition: analysis.teamComposition || null,
      aiDeliverables: analysis.deliverables || null,
    };
  } catch (error) {
    console.error("Error analyzing proposal with AI:", error);
    throw error;
  }
}

// Comprehensive comparison - compares proposals item by item
async function compareProposalsWithAI(proposals: any[]) {
  try {
    const proposalsText = proposals.map((p, idx) => {
      const scope = p.aiScope ? JSON.stringify(p.aiScope) : "غير متوفر";
      const exclusions = p.aiExclusions ? JSON.stringify(p.aiExclusions) : "غير متوفر";
      const supervision = p.aiSupervisionTerms ? JSON.stringify(p.aiSupervisionTerms) : "غير متوفر";
      const additional = p.aiAdditionalWorks ? JSON.stringify(p.aiAdditionalWorks) : "غير متوفر";
      const conditions = p.aiConditions ? JSON.stringify(p.aiConditions) : "غير متوفر";
      const timeline = p.aiTimeline ? JSON.stringify(p.aiTimeline) : "غير متوفر";
      const payment = p.aiPaymentTerms ? JSON.stringify(p.aiPaymentTerms) : "غير متوفر";
      const deliverables = p.aiDeliverables ? JSON.stringify(p.aiDeliverables) : "غير متوفر";
      
      return `=== العرض ${idx + 1}: ${p.title} (استشاري ${idx+1}) ===
الملخص: ${p.aiSummary || 'غير متوفر'}
التقييم: ${p.aiScore || 0}/100
نطاق الأعمال: ${scope}
الاستثناءات: ${exclusions}
الإشراف: ${supervision}
الأعمال الإضافية: ${additional}
الشروط: ${conditions}
الجدول الزمني: ${timeline}
شروط الدفع: ${payment}
المخرجات: ${deliverables}`;
    }).join('\n\n---\n\n');

    const prompt = `أنت محلل محايد. قارن بين العروض التالية بند ببند بشكل حيادي وشامل:

${proposalsText}

قدم مقارنة تفصيلية تشمل:
1. مقارنة نطاق الأعمال — ما يشمله كل عرض وما لا يشمله
2. مقارنة الاستثناءات — أي استشاري استثنى أعمالاً يشملها الآخرون
3. مقارنة الإشراف — هل الإشراف مشمول؟ بأي شروط؟
4. مقارنة الأعمال الإضافية — ما يعتبره كل استشاري إضافياً
5. مقارنة الشروط — أي شروط غير معتادة أو مختلفة
6. مقارنة الجدول الزمني — المدد والمراحل
7. مقارنة شروط الدفع
8. ملاحظات مهمة وتحذيرات

أجب بصيغة JSON:
{
  "scopeComparison": {"summary": "ملخص مقارنة النطاق", "details": [{"aspect": "الجانب", "findings": [{"consultant": "اسم", "status": "مشمول/غير مشمول/جزئي", "detail": "التفصيل"}]}]},
  "exclusionsComparison": {"summary": "ملخص", "highlights": ["نقاط مهمة عن الاستثناءات"]},
  "supervisionComparison": {"summary": "ملخص", "details": [{"consultant": "اسم", "included": true, "terms": "الشروط"}]},
  "additionalWorksComparison": {"summary": "ملخص", "highlights": ["نقاط مهمة"]},
  "conditionsComparison": {"summary": "ملخص", "unusualTerms": [{"consultant": "اسم", "term": "الشرط غير المعتاد"}]},
  "timelineComparison": {"summary": "ملخص"},
  "paymentComparison": {"summary": "ملخص"},
  "warnings": ["تحذيرات مهمة يجب الانتباه لها"],
  "overallSummary": "ملخص شامل للمقارنة",
  "recommendation": "التوصية النهائية مع التبرير",
  "bestProposalIndex": 0
}`;

    const response = await invokeLLM({
      messages: [
        { role: "system", content: "أنت محلل محايد وخبير في مقارنة عروض الاستشاريين الهندسيين. مهمتك المقارنة الحيادية بند ببند بدون تحيز. أجب بصيغة JSON فقط." },
        { role: "user", content: prompt }
      ],
    });

    const content = response.choices[0]?.message?.content || "{}";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in AI response");
    }
    
    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error("Error comparing proposals with AI:", error);
    throw error;
  }
}

// Helper to parse JSON fields safely
function parseJsonField(field: string | null): any {
  if (!field) return null;
  try { return JSON.parse(field); } catch { return null; }
}

export const proposalsRouter = router({
  // Upload a new proposal
  upload: protectedProcedure
    .input(z.object({
      consultantId: z.number().optional(),
      projectId: z.number().optional(),
      title: z.string(),
      fileData: z.string(), // base64 encoded file
      fileName: z.string(),
      mimeType: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const fileBuffer = Buffer.from(input.fileData, 'base64');
      const fileKey = `proposals/${ctx.user.id}/${Date.now()}-${input.fileName}`;
      
      const { url } = await storagePut(fileKey, fileBuffer, input.mimeType);
      
      const result = await createProposal({
        userId: ctx.user.id,
        consultantId: input.consultantId,
        projectId: input.projectId,
        title: input.title,
        fileUrl: url,
        fileKey: fileKey,
        fileName: input.fileName,
        fileSize: fileBuffer.length,
        mimeType: input.mimeType,
      });
      
      return { 
        success: true, 
        proposalId: Number(result[0].insertId),
        fileUrl: url 
      };
    }),

  // Analyze a proposal with comprehensive detailed extraction
  analyze: protectedProcedure
    .input(z.object({
      proposalId: z.number(),
      extractedText: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const proposal = await getProposalById(input.proposalId, ctx.user.id);
      if (!proposal) {
        throw new Error("Proposal not found");
      }
      
      await updateProposalAnalysis(input.proposalId, ctx.user.id, {
        analysisStatus: 'processing',
        extractedText: input.extractedText,
      });
      
      try {
        const analysis = await analyzeProposalWithAI(input.extractedText, proposal.title);
        
        // Serialize JSON fields for storage
        const dbUpdate: any = {
          aiSummary: analysis.aiSummary,
          aiKeyPoints: JSON.stringify(analysis.aiKeyPoints),
          aiStrengths: JSON.stringify(analysis.aiStrengths),
          aiWeaknesses: JSON.stringify(analysis.aiWeaknesses),
          aiRecommendation: analysis.aiRecommendation,
          aiScore: analysis.aiScore,
          aiScope: analysis.aiScope ? JSON.stringify(analysis.aiScope) : null,
          aiExclusions: analysis.aiExclusions ? JSON.stringify(analysis.aiExclusions) : null,
          aiAdditionalWorks: analysis.aiAdditionalWorks ? JSON.stringify(analysis.aiAdditionalWorks) : null,
          aiSupervisionTerms: analysis.aiSupervisionTerms ? JSON.stringify(analysis.aiSupervisionTerms) : null,
          aiTimeline: analysis.aiTimeline ? JSON.stringify(analysis.aiTimeline) : null,
          aiPaymentTerms: analysis.aiPaymentTerms ? JSON.stringify(analysis.aiPaymentTerms) : null,
          aiConditions: analysis.aiConditions ? JSON.stringify(analysis.aiConditions) : null,
          aiTeamComposition: analysis.aiTeamComposition ? JSON.stringify(analysis.aiTeamComposition) : null,
          aiDeliverables: analysis.aiDeliverables ? JSON.stringify(analysis.aiDeliverables) : null,
          extractedText: input.extractedText,
          analysisStatus: 'completed',
        };
        
        await updateProposalAnalysis(input.proposalId, ctx.user.id, dbUpdate);
        
        return { success: true, analysis };
      } catch (error: any) {
        await updateProposalAnalysis(input.proposalId, ctx.user.id, {
          analysisStatus: 'failed',
          analysisError: error.message,
        });
        
        throw error;
      }
    }),

  // Get all proposals with parsed JSON fields
  list: protectedProcedure
    .input(z.object({
      consultantId: z.number().optional(),
      projectId: z.number().optional(),
      analysisStatus: z.string().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const proposals = await getProposals(ctx.user.id, input);
      
      return proposals.map(p => ({
        ...p,
        aiKeyPoints: parseJsonField(p.aiKeyPoints) || [],
        aiStrengths: parseJsonField(p.aiStrengths) || [],
        aiWeaknesses: parseJsonField(p.aiWeaknesses) || [],
        aiScope: parseJsonField(p.aiScope),
        aiExclusions: parseJsonField(p.aiExclusions),
        aiAdditionalWorks: parseJsonField(p.aiAdditionalWorks),
        aiSupervisionTerms: parseJsonField(p.aiSupervisionTerms),
        aiTimeline: parseJsonField(p.aiTimeline),
        aiPaymentTerms: parseJsonField(p.aiPaymentTerms),
        aiConditions: parseJsonField(p.aiConditions),
        aiTeamComposition: parseJsonField(p.aiTeamComposition),
        aiDeliverables: parseJsonField(p.aiDeliverables),
      }));
    }),

  // Get single proposal with all details
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const proposal = await getProposalById(input.id, ctx.user.id);
      if (!proposal) return null;
      
      return {
        ...proposal,
        aiKeyPoints: parseJsonField(proposal.aiKeyPoints) || [],
        aiStrengths: parseJsonField(proposal.aiStrengths) || [],
        aiWeaknesses: parseJsonField(proposal.aiWeaknesses) || [],
        aiScope: parseJsonField(proposal.aiScope),
        aiExclusions: parseJsonField(proposal.aiExclusions),
        aiAdditionalWorks: parseJsonField(proposal.aiAdditionalWorks),
        aiSupervisionTerms: parseJsonField(proposal.aiSupervisionTerms),
        aiTimeline: parseJsonField(proposal.aiTimeline),
        aiPaymentTerms: parseJsonField(proposal.aiPaymentTerms),
        aiConditions: parseJsonField(proposal.aiConditions),
        aiTeamComposition: parseJsonField(proposal.aiTeamComposition),
        aiDeliverables: parseJsonField(proposal.aiDeliverables),
      };
    }),

  // Comprehensive comparison between proposals
  compare: protectedProcedure
    .input(z.object({
      projectId: z.number().optional(),
      title: z.string(),
      proposalIds: z.array(z.number()),
    }))
    .mutation(async ({ ctx, input }) => {
      const proposals = await Promise.all(
        input.proposalIds.map(id => getProposalById(id, ctx.user.id))
      );
      
      const validProposals = proposals.filter(p => p !== null).map(p => ({
        ...p!,
        aiKeyPoints: parseJsonField(p!.aiKeyPoints) || [],
        aiStrengths: parseJsonField(p!.aiStrengths) || [],
        aiWeaknesses: parseJsonField(p!.aiWeaknesses) || [],
        aiScope: parseJsonField(p!.aiScope),
        aiExclusions: parseJsonField(p!.aiExclusions),
        aiAdditionalWorks: parseJsonField(p!.aiAdditionalWorks),
        aiSupervisionTerms: parseJsonField(p!.aiSupervisionTerms),
        aiTimeline: parseJsonField(p!.aiTimeline),
        aiPaymentTerms: parseJsonField(p!.aiPaymentTerms),
        aiConditions: parseJsonField(p!.aiConditions),
        aiTeamComposition: parseJsonField(p!.aiTeamComposition),
        aiDeliverables: parseJsonField(p!.aiDeliverables),
      }));
      
      if (validProposals.length < 2) {
        throw new Error("يجب اختيار عرضين على الأقل للمقارنة");
      }
      
      const comparisonResult = await compareProposalsWithAI(validProposals);
      
      const winnerProposalId = validProposals[comparisonResult.bestProposalIndex]?.id;
      
      const result = await createComparison({
        userId: ctx.user.id,
        projectId: input.projectId,
        title: input.title,
        proposalIds: input.proposalIds,
        comparisonResult: comparisonResult,
        aiRecommendation: comparisonResult.recommendation,
        winnerProposalId: winnerProposalId,
      });
      
      return { 
        success: true, 
        comparisonId: Number(result[0]?.insertId || 0),
        comparisonResult 
      };
    }),

  // Get all comparisons
  listComparisons: protectedProcedure
    .input(z.object({
      projectId: z.number().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      return await getComparisons(ctx.user.id, input?.projectId);
    }),

  // Get single comparison
  getComparisonById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      return await getComparisonById(input.id, ctx.user.id);
    }),
});
