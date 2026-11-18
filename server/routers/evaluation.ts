import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getProjectEvaluationScores, upsertEvaluationScore } from "../db";
import { requireLegacyProjectRead, requireLegacyProjectOwner } from "../services/comoLegacyProjectAccess";
import { assertCommitteeUnlocked, assertLinkedOffice, assertEvaluatorUnlocked } from "../services/consultantAccess";
import { EVALUATORS } from "../../shared/consultantContracts";

export const evaluationRouter = router({
  getByProject: protectedProcedure.input(z.number().int().positive()).query(async ({ ctx, input }) => {
    await requireLegacyProjectRead(ctx.user, input);
    return getProjectEvaluationScores(input);
  }),
  upsert: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), consultantId: z.number().int().positive(), criterionId: z.number().int().min(0).max(20), score: z.number().int().min(0).max(100) })).mutation(async ({ ctx, input }) => {
    // This is the legacy aggregate, not a vote in the independent three-evaluator table.
    await requireLegacyProjectOwner(ctx.user, input.projectId);
    await assertCommitteeUnlocked(input.projectId);
    await assertLinkedOffice(input.projectId, input.consultantId);
    for (const evaluator of EVALUATORS) await assertEvaluatorUnlocked(input.projectId, evaluator);
    return upsertEvaluationScore(input.projectId, input.consultantId, input.criterionId, input.score);
  }),
});
