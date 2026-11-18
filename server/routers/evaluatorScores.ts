import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getProjectEvaluatorScores, upsertEvaluatorScore } from "../db";
import { requireLegacyProjectRead } from "../services/comoLegacyProjectAccess";
import { requireSessionEvaluator, assertEvaluatorUnlocked, assertLinkedOffice } from "../services/consultantAccess";
import { TECHNICAL_CRITERIA } from "../../shared/consultantContracts";

export const evaluatorScoresRouter = router({
  getByProject: protectedProcedure.input(z.number().int().positive()).query(async ({ ctx, input }) => {
    await requireLegacyProjectRead(ctx.user, input);
    return getProjectEvaluatorScores(input);
  }),
  upsert: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), consultantId: z.number().int().positive(), criterionId: z.number().int(), evaluatorName: z.string().optional(), score: z.number().int().min(0).max(100) })).mutation(async ({ ctx, input }) => {
    const evaluator = await requireSessionEvaluator(ctx.user, input.projectId);
    if (input.evaluatorName !== undefined && input.evaluatorName !== evaluator) throw new TRPCError({ code: "FORBIDDEN", message: "لا يمكن انتحال هوية مقيم آخر" });
    if (!TECHNICAL_CRITERIA.some(id => id === input.criterionId)) throw new TRPCError({ code: "BAD_REQUEST", message: "المعيار الفني غير معروف" });
    await assertLinkedOffice(input.projectId, input.consultantId);
    await assertEvaluatorUnlocked(input.projectId, evaluator);
    return upsertEvaluatorScore(input.projectId, input.consultantId, input.criterionId, evaluator, input.score);
  }),
});
