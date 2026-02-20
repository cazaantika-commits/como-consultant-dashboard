import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getProjectEvaluatorScores, upsertEvaluatorScore } from "../db";

export const evaluatorScoresRouter = router({
  getByProject: publicProcedure
    .input(z.number())
    .query(({ input }) => {
      return getProjectEvaluatorScores(input);
    }),

  upsert: publicProcedure
    .input(
      z.object({
        projectId: z.number(),
        consultantId: z.number(),
        criterionId: z.number().min(0).max(20),
        evaluatorName: z.string(),
        score: z.number().min(0).max(100),
      })
    )
    .mutation(({ input }) => {
      return upsertEvaluatorScore(
        input.projectId,
        input.consultantId,
        input.criterionId,
        input.evaluatorName,
        input.score
      );
    }),
});
