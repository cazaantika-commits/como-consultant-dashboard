import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { 
  getUserProjects, 
  getProjectById, 
  createProject, 
  updateProject, 
  deleteProject,
  getProjectConsultants,
  getProjectFinancialData,
  getProjectEvaluationScores
} from "../db";

export const projectsRouter = router({
  list: publicProcedure.query(({ ctx }) => {
    if (!ctx.user) return [];
    return getUserProjects(ctx.user.id);
  }),

  getById: publicProcedure.input(z.number()).query(({ ctx, input }) => {
    if (!ctx.user) throw new Error("Unauthorized");
    return getProjectById(input, ctx.user.id);
  }),

  getWithDetails: publicProcedure.input(z.number()).query(async ({ ctx, input }) => {
    if (!ctx.user) throw new Error("Unauthorized");
    const project = await getProjectById(input, ctx.user.id);
    if (!project) return null;
    
    const consultants = await getProjectConsultants(input);
    const financialData = await getProjectFinancialData(input);
    const evaluationScores = await getProjectEvaluationScores(input);

    return {
      ...project,
      consultants,
      financialData,
      evaluationScores,
    };
  }),

  create: publicProcedure
    .input(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        bua: z.number().optional(),
        pricePerSqft: z.number().optional(),
      })
    )
    .mutation(({ ctx, input }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      return createProject(ctx.user.id, input);
    }),

  update: publicProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().optional(),
        description: z.string().optional(),
        bua: z.number().optional(),
        pricePerSqft: z.number().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(({ ctx, input }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      const { id, ...data } = input;
      return updateProject(id, ctx.user.id, data);
    }),

  delete: publicProcedure
    .input(z.number())
    .mutation(({ ctx, input }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      return deleteProject(input, ctx.user.id);
    }),
});
