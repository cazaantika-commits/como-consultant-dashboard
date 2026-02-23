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
  getProjectEvaluationScores,
} from "../db";

// Shared Zod schema for all Fact Sheet fields
const factSheetFields = {
  description: z.string().optional(),
  plotNumber: z.string().optional(),
  areaCode: z.string().optional(),
  driveFolderId: z.string().optional(),
  bua: z.number().optional(),
  pricePerSqft: z.number().optional(),
  titleDeedNumber: z.string().optional(),
  ddaNumber: z.string().optional(),
  masterDevRef: z.string().optional(),
  plotAreaSqm: z.string().optional(),
  plotAreaSqft: z.string().optional(),
  gfaSqm: z.string().optional(),
  gfaSqft: z.string().optional(),
  permittedUse: z.string().optional(),
  ownershipType: z.string().optional(),
  subdivisionRestrictions: z.string().optional(),
  masterDevName: z.string().optional(),
  masterDevAddress: z.string().optional(),
  sellerName: z.string().optional(),
  sellerAddress: z.string().optional(),
  buyerName: z.string().optional(),
  buyerNationality: z.string().optional(),
  buyerPassport: z.string().optional(),
  buyerAddress: z.string().optional(),
  buyerPhone: z.string().optional(),
  buyerEmail: z.string().optional(),
  electricityAllocation: z.string().optional(),
  waterAllocation: z.string().optional(),
  sewageAllocation: z.string().optional(),
  tripAM: z.string().optional(),
  tripLT: z.string().optional(),
  tripPM: z.string().optional(),
  effectiveDate: z.string().optional(),
  constructionPeriod: z.string().optional(),
  constructionStartDate: z.string().optional(),
  completionDate: z.string().optional(),
  constructionConditions: z.string().optional(),
  saleRestrictions: z.string().optional(),
  resaleConditions: z.string().optional(),
  communityCharges: z.string().optional(),
  registrationAuthority: z.string().optional(),
  adminFee: z.number().optional(),
  clearanceFee: z.number().optional(),
  compensationAmount: z.number().optional(),
  governingLaw: z.string().optional(),
  disputeResolution: z.string().optional(),
  notes: z.string().optional(),
};

// All Fact Sheet field keys for completeness calculation
const FACT_SHEET_KEYS = [
  "titleDeedNumber", "ddaNumber", "masterDevRef",
  "plotAreaSqm", "plotAreaSqft", "gfaSqm", "gfaSqft",
  "permittedUse", "ownershipType", "subdivisionRestrictions",
  "masterDevName", "masterDevAddress",
  "sellerName", "sellerAddress",
  "buyerName", "buyerNationality", "buyerPassport", "buyerAddress", "buyerPhone", "buyerEmail",
  "electricityAllocation", "waterAllocation", "sewageAllocation",
  "tripAM", "tripLT", "tripPM",
  "effectiveDate", "constructionPeriod", "constructionStartDate", "completionDate", "constructionConditions",
  "saleRestrictions", "resaleConditions", "communityCharges",
  "registrationAuthority", "adminFee", "clearanceFee", "compensationAmount",
  "governingLaw", "disputeResolution",
];

function calcFactSheetCompleteness(project: any): { filled: number; total: number; percentage: number } {
  const total = FACT_SHEET_KEYS.length;
  const filled = FACT_SHEET_KEYS.filter(k => project[k] !== null && project[k] !== undefined && project[k] !== "").length;
  return { filled, total, percentage: Math.round((filled / total) * 100) };
}

export const projectsRouter = router({
  // Basic list
  list: publicProcedure.query(({ ctx }) => {
    if (!ctx.user) return [];
    return getUserProjects(ctx.user.id);
  }),

  // List with summary stats (consultant count, financial summary, fact sheet completeness)
  listWithStats: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.user) return [];
    const projects = await getUserProjects(ctx.user.id);
    
    const enriched = await Promise.all(projects.map(async (project) => {
      const consultants = await getProjectConsultants(project.id);
      const financialData = await getProjectFinancialData(project.id);
      const completeness = calcFactSheetCompleteness(project);
      
      return {
        ...project,
        consultantCount: consultants.length,
        consultantNames: consultants.map((c: any) => c.name),
        financialCount: financialData.filter((f: any) => 
          (f.designValue && parseFloat(f.designValue) > 0) || 
          (f.supervisionValue && parseFloat(f.supervisionValue) > 0)
        ).length,
        factSheetCompleteness: completeness,
      };
    }));
    
    return enriched;
  }),

  // Single project by ID
  getById: publicProcedure.input(z.number()).query(({ ctx, input }) => {
    if (!ctx.user) throw new Error("Unauthorized");
    return getProjectById(input, ctx.user.id);
  }),

  // Full project details with consultants, financial data, and evaluation scores
  getWithDetails: publicProcedure.input(z.number()).query(async ({ ctx, input }) => {
    if (!ctx.user) throw new Error("Unauthorized");
    const project = await getProjectById(input, ctx.user.id);
    if (!project) return null;
    
    const consultants = await getProjectConsultants(input);
    const financialData = await getProjectFinancialData(input);
    const evaluationScores = await getProjectEvaluationScores(input);
    const completeness = calcFactSheetCompleteness(project);

    // Enrich financial data with consultant names
    const enrichedFinancial = financialData.map((fd: any) => {
      const consultant = consultants.find((c: any) => c.id === fd.consultantId);
      return {
        ...fd,
        consultantName: consultant?.name || `Consultant #${fd.consultantId}`,
      };
    });

    return {
      ...project,
      consultants,
      financialData: enrichedFinancial,
      evaluationScores,
      factSheetCompleteness: completeness,
    };
  }),

  // Create project
  create: publicProcedure
    .input(z.object({ name: z.string().min(1), ...factSheetFields }))
    .mutation(({ ctx, input }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      return createProject(ctx.user.id, input);
    }),

  // Update project
  update: publicProcedure
    .input(z.object({ id: z.number(), name: z.string().optional(), ...factSheetFields }))
    .mutation(({ ctx, input }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      const { id, ...data } = input;
      return updateProject(id, ctx.user.id, data);
    }),

  // Delete project
  delete: publicProcedure
    .input(z.number())
    .mutation(({ ctx, input }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      return deleteProject(input, ctx.user.id);
    }),
});
