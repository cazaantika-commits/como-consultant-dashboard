import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { projectsRouter } from "./routers/projects";
import { consultantsRouter } from "./routers/consultants";
import { financialRouter } from "./routers/financial";
import { evaluationRouter } from "./routers/evaluation";
import { projectConsultantsRouter } from "./routers/projectConsultants";
import { profilesRouter } from "./routers/profiles";
import { driveRouter } from "./routers/drive";
import { tasksRouter } from "./routers/tasks";
import { agentsRouter } from "./routers/agents";
import { feasibilityRouter } from "./routers/feasibility";
import { evaluatorScoresRouter } from "./routers/evaluatorScores";
import { committeeRouter } from "./routers/committee";
import { consultantDetailsRouter } from "./routers/consultantDetails";
import { capitalPlanningRouter } from "./routers/capitalPlanning";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  projects: projectsRouter,
  consultants: consultantsRouter,
  projectConsultants: projectConsultantsRouter,
  financial: financialRouter,
  evaluation: evaluationRouter,
  profiles: profilesRouter,
  drive: driveRouter,
  tasks: tasksRouter,
  agents: agentsRouter,
  feasibility2: feasibilityRouter,
  evaluatorScores: evaluatorScoresRouter,
  committee: committeeRouter,
  consultantDetails: consultantDetailsRouter,
  capitalPlanning: capitalPlanningRouter,
});

export type AppRouter = typeof appRouter;
