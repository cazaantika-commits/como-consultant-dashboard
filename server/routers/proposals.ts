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

// Helper function to analyze proposal using Gemini
async function analyzeProposalWithAI(extractedText: string, proposalTitle: string) {
  try {
    const prompt = `أنت محلل خبير في عروض الاستشاريين. قم بتحليل العرض التالي بشكل شامل:

عنوان العرض: ${proposalTitle}

محتوى العرض:
${extractedText.substring(0, 15000)} 

قدم تحليلاً مفصلاً يتضمن:
1. ملخص العرض (2-3 جمل)
2. النقاط الرئيسية (قائمة)
3. نقاط القوة (قائمة)
4. نقاط الضعف (قائمة)
5. التوصية النهائية
6. تقييم من 100

أجب بصيغة JSON فقط بهذا الشكل:
{
  "summary": "...",
  "keyPoints": ["نقطة 1", "نقطة 2", ...],
  "strengths": ["قوة 1", "قوة 2", ...],
  "weaknesses": ["ضعف 1", "ضعف 2", ...],
  "recommendation": "...",
  "score": 85
}`;

    const response = await invokeLLM({
      messages: [
        { role: "system", content: "أنت محلل خبير في عروض الاستشاريين. أجب دائماً بصيغة JSON صحيحة." },
        { role: "user", content: prompt }
      ],
    });

    const content = response.choices[0]?.message?.content || "{}";
    
    // Try to extract JSON from the response
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
    };
  } catch (error) {
    console.error("Error analyzing proposal with AI:", error);
    throw error;
  }
}

// Helper function to compare multiple proposals
async function compareProposalsWithAI(proposals: any[]) {
  try {
    const proposalsText = proposals.map((p, idx) => 
      `العرض ${idx + 1}: ${p.title}\nالملخص: ${p.aiSummary}\nالنقاط الرئيسية: ${(p.aiKeyPoints || []).join(', ')}\nنقاط القوة: ${(p.aiStrengths || []).join(', ')}\nنقاط الضعف: ${(p.aiWeaknesses || []).join(', ')}\nالتقييم: ${p.aiScore}/100`
    ).join('\n\n---\n\n');

    const prompt = `قارن بين العروض التالية وقدم تحليلاً شاملاً:

${proposalsText}

قدم:
1. مقارنة تفصيلية بين العروض
2. أفضل عرض مع التبرير
3. توصية نهائية

أجب بصيغة JSON:
{
  "comparison": "...",
  "bestProposalIndex": 0,
  "recommendation": "..."
}`;

    const response = await invokeLLM({
      messages: [
        { role: "system", content: "أنت محلل خبير في مقارنة عروض الاستشاريين." },
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
      // Decode base64 and upload to S3
      const fileBuffer = Buffer.from(input.fileData, 'base64');
      const fileKey = `proposals/${ctx.user.id}/${Date.now()}-${input.fileName}`;
      
      const { url } = await storagePut(fileKey, fileBuffer, input.mimeType);
      
      // Create proposal record
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
        proposalId: result.insertId,
        fileUrl: url 
      };
    }),

  // Analyze a proposal (extract text and run AI analysis)
  analyze: protectedProcedure
    .input(z.object({
      proposalId: z.number(),
      extractedText: z.string(), // Frontend will extract text from PDF
    }))
    .mutation(async ({ ctx, input }) => {
      // Get proposal
      const proposal = await getProposalById(input.proposalId, ctx.user.id);
      if (!proposal) {
        throw new Error("Proposal not found");
      }
      
      // Update status to processing
      await updateProposalAnalysis(input.proposalId, ctx.user.id, {
        analysisStatus: 'processing',
        extractedText: input.extractedText,
      });
      
      try {
        // Analyze with AI
        const analysis = await analyzeProposalWithAI(input.extractedText, proposal.title);
        
        // Update with results
        await updateProposalAnalysis(input.proposalId, ctx.user.id, {
          ...analysis,
          extractedText: input.extractedText,
          analysisStatus: 'completed',
        });
        
        return { success: true, analysis };
      } catch (error: any) {
        // Update with error
        await updateProposalAnalysis(input.proposalId, ctx.user.id, {
          analysisStatus: 'failed',
          analysisError: error.message,
        });
        
        throw error;
      }
    }),

  // Get all proposals
  list: protectedProcedure
    .input(z.object({
      consultantId: z.number().optional(),
      projectId: z.number().optional(),
      analysisStatus: z.string().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const proposals = await getProposals(ctx.user.id, input);
      
      // Parse JSON fields
      return proposals.map(p => ({
        ...p,
        aiKeyPoints: p.aiKeyPoints ? JSON.parse(p.aiKeyPoints) : [],
        aiStrengths: p.aiStrengths ? JSON.parse(p.aiStrengths) : [],
        aiWeaknesses: p.aiWeaknesses ? JSON.parse(p.aiWeaknesses) : [],
      }));
    }),

  // Get single proposal
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const proposal = await getProposalById(input.id, ctx.user.id);
      if (!proposal) return null;
      
      return {
        ...proposal,
        aiKeyPoints: proposal.aiKeyPoints ? JSON.parse(proposal.aiKeyPoints) : [],
        aiStrengths: proposal.aiStrengths ? JSON.parse(proposal.aiStrengths) : [],
        aiWeaknesses: proposal.aiWeaknesses ? JSON.parse(proposal.aiWeaknesses) : [],
      };
    }),

  // Create a comparison
  compare: protectedProcedure
    .input(z.object({
      projectId: z.number().optional(),
      title: z.string(),
      proposalIds: z.array(z.number()),
    }))
    .mutation(async ({ ctx, input }) => {
      // Get all proposals
      const proposals = await Promise.all(
        input.proposalIds.map(id => getProposalById(id, ctx.user.id))
      );
      
      // Filter out nulls and parse JSON fields
      const validProposals = proposals.filter(p => p !== null).map(p => ({
        ...p!,
        aiKeyPoints: p!.aiKeyPoints ? JSON.parse(p!.aiKeyPoints) : [],
        aiStrengths: p!.aiStrengths ? JSON.parse(p!.aiStrengths) : [],
        aiWeaknesses: p!.aiWeaknesses ? JSON.parse(p!.aiWeaknesses) : [],
      }));
      
      if (validProposals.length < 2) {
        throw new Error("Need at least 2 proposals to compare");
      }
      
      // Compare with AI
      const comparisonResult = await compareProposalsWithAI(validProposals);
      
      // Determine winner
      const winnerProposalId = validProposals[comparisonResult.bestProposalIndex]?.id;
      
      // Save comparison
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
        comparisonId: result.insertId,
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
