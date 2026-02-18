import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { 
  addConsultantToProject,
  removeConsultantFromProject,
  getProjectConsultants
} from "../db";

export const projectConsultantsRouter = router({
  getByProject: publicProcedure
    .input(z.number())
    .query(({ input }) => {
      return getProjectConsultants(input);
    }),

  add: publicProcedure
    .input(
      z.object({
        projectId: z.number(),
        consultantId: z.number(),
      })
    )
    .mutation(({ input }) => {
      return addConsultantToProject(input.projectId, input.consultantId);
    }),

  remove: publicProcedure
    .input(
      z.object({
        projectId: z.number(),
        consultantId: z.number(),
      })
    )
    .mutation(({ input }) => {
      return removeConsultantFromProject(input.projectId, input.consultantId);
    }),
});
