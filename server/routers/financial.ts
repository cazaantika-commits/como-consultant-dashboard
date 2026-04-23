import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { 
  getProjectFinancialData,
  upsertFinancialData
} from "../db";

export const financialRouter = router({
  getByProject: publicProcedure
    .input(z.number())
    .query(({ input }) => {
      return getProjectFinancialData(input);
    }),

  upsert: publicProcedure
    .input(
      z.object({
        projectId: z.number(),
        consultantId: z.number(),
        designType: z.enum(["pct", "lump", "lumpsum"]).optional(),
        designValue: z.number().optional(),
        supervisionType: z.enum(["pct", "lump", "lumpsum"]).optional(),
        supervisionValue: z.number().optional(),
        proposalLink: z.string().optional(),
        designGapOverride: z.number().nullable().optional(),
        supervisionGapOverride: z.number().nullable().optional(),
      })
    )
    .mutation(({ input }) => {
      const { projectId, consultantId, ...data } = input;
      return upsertFinancialData(projectId, consultantId, data as any);
    }),
});
