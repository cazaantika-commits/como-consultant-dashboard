import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { 
  getUserConsultants, 
  createConsultant, 
  deleteConsultant,
  addConsultantToProject,
  removeConsultantFromProject,
  getProjectConsultants
} from "../db";

export const consultantsRouter = router({
  list: publicProcedure.query(({ ctx }) => {
    if (!ctx.user) return [];
    return getUserConsultants(ctx.user.id);
  }),

  create: publicProcedure
    .input(
      z.object({
        name: z.string().min(1),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        specialization: z.string().optional(),
      })
    )
    .mutation(({ ctx, input }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      return createConsultant(ctx.user.id, input);
    }),

  delete: publicProcedure
    .input(z.number())
    .mutation(({ ctx, input }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      return deleteConsultant(input, ctx.user.id);
    }),

  addToProject: publicProcedure
    .input(
      z.object({
        projectId: z.number(),
        consultantId: z.number(),
      })
    )
    .mutation(({ input }) => {
      return addConsultantToProject(input.projectId, input.consultantId);
    }),

  removeFromProject: publicProcedure
    .input(
      z.object({
        projectId: z.number(),
        consultantId: z.number(),
      })
    )
    .mutation(({ input }) => {
      return removeConsultantFromProject(input.projectId, input.consultantId);
    }),

  getByProject: publicProcedure
    .input(z.number())
    .query(({ input }) => {
      return getProjectConsultants(input);
    }),
});
