import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { projectsRouter } from "./routers/projects";
import { consultantsRouter } from "./routers/consultants";
import { consultantsRegistryRouter } from "./routers/consultantsRegistry";
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
import { emailRouter } from "./routers/email";
import { taskSettingsRouter } from "./routers/taskSettings";
import { knowledgeRouter } from "./routers/knowledge";
import { proposalsRouter } from "./routers/proposals";
import { meetingsRouter } from "./routers/meetings";
import { executionDashboardRouter } from "./routers/executionDashboard";
import { googleOAuthRouter } from "./routers/googleOAuth";
import { contractsRouter } from "./routers/contracts";
import { activityMonitorRouter } from "./routers/activityMonitor";
import { specialistKnowledgeRouter } from "./routers/specialistKnowledge";
import { sentEmailsRouter } from "./routers/sentEmails";
import { notificationsRouter } from "./routers/notifications";
import { commandCenterRouter } from "./routers/commandCenter";
import { stagesRouter } from "./routers/stages";
import { legalSetupRouter, designsAndPermitsRouter } from "./routers/legalAndDesigns";
import { marketOverviewRouter } from "./routers/marketOverview";
import { competitionPricingRouter } from "./routers/competitionPricing";
import { costsCashFlowRouter } from "./routers/costsCashFlow";
import { cashFlowProgramRouter } from "./routers/cashFlowProgram";
import { phaseManagementRouter } from "./routers/phaseManagement";
import { joelleEngineRouter } from "./routers/joelleEngine";
import { marketReportsRouter } from "./routers/marketReports";
import { riskDashboardRouter } from "./routers/riskDashboard";
import { selfLearningRouter } from "./routers/selfLearning";
import { sectionStatusRouter } from "./routers/sectionStatus";
import { lifecycleRouter } from "./routers/lifecycle";
import { stageDataRouter } from "./routers/stageData";
import { cpaRouter } from "./routers/cpa";
import { newsTickerRouter } from "./routers/newsTicker";
import { costDistributionRulesRouter } from "./routers/costDistributionRules";
import { cashFlowSettingsRouter } from "./routers/cashFlowSettings";
import { portfolioScenariosRouter } from "./routers/portfolioScenarios";
import { businessPartnersRouter, paymentRequestsRouter } from "./routers/businessPartners";
import { adminProcedure } from "./_core/trpc";
import { users } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "./db";

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
  feasibility: feasibilityRouter,
  evaluatorScores: evaluatorScoresRouter,
  committee: committeeRouter,
  consultantDetails: consultantDetailsRouter,
  email: emailRouter,
  taskSettings: taskSettingsRouter,
  knowledge: knowledgeRouter,
  proposals: proposalsRouter,
  meetings: meetingsRouter,
  executionDashboard: executionDashboardRouter,
  googleOAuth: googleOAuthRouter,
  contracts: contractsRouter,
  activityMonitor: activityMonitorRouter,
  specialistKnowledge: specialistKnowledgeRouter,
  sentEmails: sentEmailsRouter,
  notifications: notificationsRouter,
  commandCenter: commandCenterRouter,
  stages: stagesRouter,
  legalSetup: legalSetupRouter,
  designsAndPermits: designsAndPermitsRouter,
  marketOverview: marketOverviewRouter,
  competitionPricing: competitionPricingRouter,
  costsCashFlow: costsCashFlowRouter,
  cashFlowProgram: cashFlowProgramRouter,
  phaseManagement: phaseManagementRouter,
  consultantsRegistry: consultantsRegistryRouter,
  joelleEngine: joelleEngineRouter,
  marketReports: marketReportsRouter,
  riskDashboard: riskDashboardRouter,
  selfLearning: selfLearningRouter,
  sectionStatus: sectionStatusRouter,
  lifecycle: lifecycleRouter,
  stageData: stageDataRouter,
  cpa: cpaRouter,
  newsTicker: newsTickerRouter,
  costDistributionRules: costDistributionRulesRouter,
  cashFlowSettings: cashFlowSettingsRouter,
  portfolioScenarios: portfolioScenariosRouter,
  businessPartners: businessPartnersRouter,
  paymentRequests: paymentRequestsRouter,

  // User Management (admin only)
  userManagement: router({
    listUsers: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      const allUsers = await db.select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt,
        lastSignedIn: users.lastSignedIn,
      }).from(users).orderBy(users.createdAt);
      return allUsers;
    }),
    setRole: adminProcedure
      .input(z.object({ userId: z.number(), role: z.enum(['user', 'admin']) }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error('DB not available');
        await db.update(users).set({ role: input.role }).where(eq(users.id, input.userId));
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
