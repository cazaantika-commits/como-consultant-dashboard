import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { 
  getProjectEvaluationScores,
  upsertEvaluationScore
} from "../db";

export const evaluationRouter = router({
  getByProject: publicProcedure
    .input(z.number())
    .query(({ input }) => {
      return getProjectEvaluationScores(input);
    }),

  upsert: publicProcedure
    .input(
      z.object({
        projectId: z.number(),
        consultantId: z.number(),
        criterionId: z.number().min(0).max(20),
        score: z.number().min(0).max(100),
      })
    )
    .mutation(({ input }) => {
      return upsertEvaluationScore(
        input.projectId,
        input.consultantId,
        input.criterionId,
        input.score
      );
    }),
});
