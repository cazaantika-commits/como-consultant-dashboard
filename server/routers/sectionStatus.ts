import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  projects,
  feasibilityStudies,
  costsCashFlow,
  marketOverview,
  competitionPricing,
  cfProjects,
  cfCostItems,
  stageItems,
  projectRiskScores,
  joelleAnalysisStages,
} from "../../drizzle/schema";
import { eq, count, and, sql } from "drizzle-orm";

// Status types for each section
type SectionStatus = "complete" | "partial" | "empty";

export const sectionStatusRouter = router({
  // Get status for all 9 sections for all projects
  getAll: publicProcedure.query(async () => {
    const db = await getDb();

    // Get all projects
    const allProjects = await db.select({
      id: projects.id,
      name: projects.name,
    }).from(projects);

    if (allProjects.length === 0) {
      return { projects: [], totalProjects: 0 };
    }

    const projectStatuses = await Promise.all(
      allProjects.map(async (proj) => {
        // 1. بطاقة بيانات المشروع - check if key fields are filled
        const [projectData] = await db.select().from(projects).where(eq(projects.id, proj.id));
        const factSheetStatus: SectionStatus = projectData
          ? (projectData.name && projectData.community && projectData.plotNumber)
            ? "complete"
            : "partial"
          : "empty";

        // 2. دراسة الجدوى - check if feasibility study exists
        const [feasStudy] = await db.select({ id: feasibilityStudies.id })
          .from(feasibilityStudies)
          .where(eq(feasibilityStudies.projectId, proj.id))
          .limit(1);
        
        // Check if joelle data exists for this project
        const [joelleData] = await db.select({ cnt: count() })
          .from(joelleAnalysisStages)
          .where(and(
            eq(joelleAnalysisStages.projectId, proj.id),
            eq(joelleAnalysisStages.stageStatus, "completed")
          ));
        
        const feasibilityStatus: SectionStatus = feasStudy
          ? ((joelleData?.cnt || 0) >= 5 ? "complete" : "partial")
          : "empty";

        // 3. مصاريف المستثمر - check costsCashFlow
        const [costData] = await db.select({ id: costsCashFlow.id })
          .from(costsCashFlow)
          .where(eq(costsCashFlow.projectId, proj.id))
          .limit(1);
        const investorCostStatus: SectionStatus = costData ? "partial" : "empty";

        // 4. حساب الضمان - same source as investor costs (different view)
        const escrowStatus: SectionStatus = costData ? "partial" : "empty";

        // 5. مراحل التطوير - check stage items
        const [stageData] = await db.select({ cnt: count() })
          .from(stageItems)
          .where(eq(stageItems.projectId, proj.id));
        const stagesStatus: SectionStatus = (stageData?.cnt || 0) > 0
          ? ((stageData?.cnt || 0) >= 3 ? "complete" : "partial")
          : "empty";

        // 6. برنامج العمل والتدفقات - check cfProjects
        const [cfProject] = await db.select({ id: cfProjects.id })
          .from(cfProjects)
          .where(eq(cfProjects.projectId, proj.id))
          .limit(1);
        let programStatus: SectionStatus = "empty";
        if (cfProject) {
          const [costItemCount] = await db.select({ cnt: count() })
            .from(cfCostItems)
            .where(eq(cfCostItems.cfProjectId, cfProject.id));
          programStatus = (costItemCount?.cnt || 0) > 0 ? "complete" : "partial";
        }

        // 7. محاكي تخطيط رأس المال - same as program (uses cfProjects)
        const capitalStatus: SectionStatus = cfProject ? (programStatus === "complete" ? "complete" : "partial") : "empty";

        // 8. مركز القيادة المالي - check if project has been imported to command center
        const financialCommandStatus: SectionStatus = cfProject ? "partial" : "empty";

        // 9. لوحة المخاطر - check risk scores
        const [riskData] = await db.select({ id: projectRiskScores.id })
          .from(projectRiskScores)
          .where(eq(projectRiskScores.projectId, proj.id))
          .limit(1);
        const riskStatus: SectionStatus = riskData ? "complete" : "empty";

        return {
          projectId: proj.id,
          projectName: proj.name,
          sections: {
            "fact-sheet": factSheetStatus,
            "feasibility": feasibilityStatus,
            "cashflow": investorCostStatus,
            "escrow": escrowStatus,
            "development-stages": stagesStatus,
            "program-cashflow": programStatus,
            "capital-planning": capitalStatus,
            "financial-command": financialCommandStatus,
            "risk-dashboard": riskStatus,
          },
        };
      })
    );

    // Aggregate: for each section, count how many projects are complete/partial/empty
    const sectionSummary: Record<string, { complete: number; partial: number; empty: number; total: number }> = {};
    const sectionIds = [
      "fact-sheet", "feasibility", "cashflow", "escrow",
      "development-stages", "program-cashflow", "capital-planning",
      "financial-command", "risk-dashboard"
    ];

    for (const sectionId of sectionIds) {
      sectionSummary[sectionId] = { complete: 0, partial: 0, empty: 0, total: allProjects.length };
      for (const ps of projectStatuses) {
        const status = ps.sections[sectionId as keyof typeof ps.sections];
        sectionSummary[sectionId][status]++;
      }
    }

    return {
      projects: projectStatuses,
      totalProjects: allProjects.length,
      sectionSummary,
    };
  }),
});
