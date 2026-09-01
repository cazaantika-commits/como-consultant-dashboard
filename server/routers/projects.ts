import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { 
  getUserProjects, 
  getAllProjects,
  getProjectById, 
  createProject, 
  updateProject, 
  deleteProject,
  getProjectConsultants,
  getProjectFinancialData,
  getProjectEvaluationScores,
} from "../db";
import { ensureIsolatedTestProject, getIsolatedTestProject } from "../isolatedTestProject";

// Shared Zod schema for all Fact Sheet fields
const factSheetFields = {
  description: z.string().optional(),
  plotNumber: z.string().optional(),
  areaCode: z.string().optional(),
  driveFolderId: z.string().optional(),
  bua: z.coerce.number().optional(),
  pricePerSqft: z.coerce.number().optional(),
  titleDeedNumber: z.string().optional(),
  ddaNumber: z.string().optional(),
  masterDevRef: z.string().optional(),
  plotAreaSqm: z.string().optional(),
  plotAreaSqft: z.string().optional(),
  gfaSqm: z.string().optional(),
  gfaSqft: z.string().optional(),
  // GFA حسب النوع (قدم²)
  gfaResidentialSqft: z.string().optional(),
  gfaRetailSqft: z.string().optional(),
  gfaOfficesSqft: z.string().optional(),
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
  adminFee: z.coerce.number().optional(),
  clearanceFee: z.coerce.number().optional(),
  compensationAmount: z.coerce.number().optional(),
  governingLaw: z.string().optional(),
  disputeResolution: z.string().optional(),
  // متطلبات المواقف المستخرجة من الوثائق
  parkingRequirementsText: z.string().optional(),
  parkingRulesJson: z.string().optional(),
  parkingSourceReference: z.string().optional(),
  parkingAvailableSpaces: z.coerce.number().int().optional(),
  notes: z.string().optional(),
  // بيانات الشراء
  landPrice: z.string().optional(),
  agentCommissionLandPct: z.union([z.string(), z.number()]).optional(),
  // الإدخالات اليدوية
  manualBuaSqft: z.string().optional(),
  estimatedConstructionPricePerSqft: z.string().optional(),
  soilTestFee: z.string().optional(),
  topographicSurveyFee: z.string().optional(),
  reraUnitRegFee: z.string().optional(),
  developerNocFee: z.string().optional(),
  escrowAccountFee: z.string().optional(),
  bankFees: z.string().optional(),
  communityFees: z.string().optional(),
  surveyorFees: z.string().optional(),
  reraAuditReportFee: z.string().optional(),
  reraInspectionReportFee: z.string().optional(),
  reraProjectRegFee: z.string().optional(),
  officialBodiesFees: z.string().optional(),
  // نسب التكاليف المتغيرة
  designFeePct: z.union([z.string(), z.number()]).optional(),
  designFeeFixed: z.union([z.string(), z.number()]).optional(),
  supervisionFeePct: z.union([z.string(), z.number()]).optional(),
  supervisionFeeFixed: z.union([z.string(), z.number()]).optional(),
  separationFeePerSqft: z.union([z.string(), z.number()]).optional(),
  salesCommissionPct: z.union([z.string(), z.number()]).optional(),
  marketingPct: z.union([z.string(), z.number()]).optional(),
  developerFeePhase1Pct: z.union([z.string(), z.number()]).optional(),
  developerFeePhase2Pct: z.union([z.string(), z.number()]).optional(),
  developerFeePct: z.union([z.string(), z.number()]).optional(),
  // نسب المساحة القابلة للبيع
  saleableResidentialPct: z.union([z.string(), z.number()]).optional(),
  saleableRetailPct: z.union([z.string(), z.number()]).optional(),
  saleableOfficesPct: z.union([z.string(), z.number()]).optional(),
  // مدد المراحل
  preConMonths: z.coerce.number().int().optional(),
  constructionMonths: z.coerce.number().int().optional(),
  handoverMonths: z.coerce.number().int().optional(),
  marketingPrepMonths: z.coerce.number().int().optional(),
  reraLeadMonths: z.coerce.number().int().optional(),
  startDate: z.string().optional(),
  // سيناريو التمويل
  financingScenario: z.enum(["offplan_escrow", "offplan_construction", "no_offplan", "build_for_sale", "build_for_rent", "rental", "joint_venture_land_for_units"]).optional(),
	// Unit distribution - counts
	studioCount: z.coerce.number().int().optional(),
	residential1brCount: z.coerce.number().int().optional(),
	residential2brCount: z.coerce.number().int().optional(),
	residential2brMaidCount: z.coerce.number().int().optional(),
	residential3brCount: z.coerce.number().int().optional(),
	residential3brMaidCount: z.coerce.number().int().optional(),
  villaCount: z.coerce.number().int().optional(),
  townhouseCount: z.coerce.number().int().optional(),
  retailSmallCount: z.coerce.number().int().optional(),
  retailMediumCount: z.coerce.number().int().optional(),
  retailLargeCount: z.coerce.number().int().optional(),
  officeSmallCount: z.coerce.number().int().optional(),
  officeMediumCount: z.coerce.number().int().optional(),
  officeLargeCount: z.coerce.number().int().optional(),
	// Unit distribution - areas
	studioArea: z.coerce.number().int().optional(),
	residential1brArea: z.coerce.number().int().optional(),
	residential2brArea: z.coerce.number().int().optional(),
	residential2brMaidArea: z.coerce.number().int().optional(),
	residential3brArea: z.coerce.number().int().optional(),
	residential3brMaidArea: z.coerce.number().int().optional(),
  villaArea: z.coerce.number().int().optional(),
  townhouseArea: z.coerce.number().int().optional(),
  retailSmallArea: z.coerce.number().int().optional(),
  retailMediumArea: z.coerce.number().int().optional(),
  retailLargeArea: z.coerce.number().int().optional(),
  officeSmallArea: z.coerce.number().int().optional(),
  officeMediumArea: z.coerce.number().int().optional(),
  officeLargeArea: z.coerce.number().int().optional(),
	// Unit distribution - prices per sqft
	studioPrice: z.coerce.number().int().optional(),
	residential1brPrice: z.coerce.number().int().optional(),
	residential2brPrice: z.coerce.number().int().optional(),
	residential2brMaidPrice: z.coerce.number().int().optional(),
	residential3brPrice: z.coerce.number().int().optional(),
	residential3brMaidPrice: z.coerce.number().int().optional(),
  villaPrice: z.coerce.number().int().optional(),
  townhousePrice: z.coerce.number().int().optional(),
  retailSmallPrice: z.coerce.number().int().optional(),
  retailMediumPrice: z.coerce.number().int().optional(),
  retailLargePrice: z.coerce.number().int().optional(),
  officeSmallPrice: z.coerce.number().int().optional(),
  officeMediumPrice: z.coerce.number().int().optional(),
  officeLargePrice: z.coerce.number().int().optional(),
  // Construction S-Curve JSON
  constructionScheduleJson: z.string().optional(),
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
  "parkingRequirementsText", "parkingSourceReference", "parkingAvailableSpaces",
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
    return getAllProjects();
  }),

  // One directly accessible sandbox project. It never appears in the official list.
  getTestProject: publicProcedure.query(({ ctx }) => {
    if (!ctx.user) throw new Error("Unauthorized");
    return getIsolatedTestProject(ctx.user.id);
  }),

  ensureTestProject: publicProcedure.mutation(({ ctx }) => {
    if (!ctx.user) throw new Error("Unauthorized");
    return ensureIsolatedTestProject(ctx.user.id);
  }),

  // List with summary stats (consultant count, financial summary, fact sheet completeness)
  listWithStats: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.user) return [];
    const projects = await getAllProjects();
    
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
