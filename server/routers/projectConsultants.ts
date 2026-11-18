import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { addConsultantToProject, removeConsultantFromProject, getProjectConsultants } from "../db";
import { requireLegacyProjectRead, requireLegacyProjectWrite } from "../services/comoLegacyProjectAccess";
import { assertCommitteeUnlocked, assertEvaluatorUnlocked } from "../services/consultantAccess";
import { EVALUATORS } from "../../shared/consultantContracts";

const linkInput = z.object({ projectId: z.number().int().positive(), consultantId: z.number().int().positive() });
async function assertRosterUnlocked(projectId: number) {
  await assertCommitteeUnlocked(projectId);
  for (const evaluator of EVALUATORS) await assertEvaluatorUnlocked(projectId, evaluator);
}
export const projectConsultantsRouter = router({
  getByProject: protectedProcedure.input(z.number().int().positive()).query(async ({ ctx, input }) => {
    await requireLegacyProjectRead(ctx.user, input);
    return getProjectConsultants(input);
  }),
  add: protectedProcedure.input(linkInput).mutation(async ({ ctx, input }) => {
    await requireLegacyProjectWrite(ctx.user, input.projectId);
    await assertRosterUnlocked(input.projectId);
    return addConsultantToProject(input.projectId, input.consultantId);
  }),
  remove: protectedProcedure.input(linkInput).mutation(async ({ ctx, input }) => {
    await requireLegacyProjectWrite(ctx.user, input.projectId);
    await assertRosterUnlocked(input.projectId);
    return removeConsultantFromProject(input.projectId, input.consultantId);
  }),
});
