import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import {
  getAllProjects,
  getProjectPhases,
  getAllProjectPhases,
  upsertProjectPhase,
  updatePhaseDelay,
  getProjectCapitalSettings,
  getAllProjectCapitalSettings,
  upsertProjectCapitalSettings,
} from "../db";

// Phase names in Arabic
const PHASE_NAMES = [
  "دراسة السوق والجدوى",      // Market & Feasibility
  "الاستشاري والتصميم",        // Consultant & Design
  "الموافقات الحكومية",         // Authority Approvals
  "تعيين المقاول",              // Contractor Appointment
  "البناء والتسليم",            // Construction & Delivery
];

const PHASE_NAMES_EN = [
  "Market & Feasibility",
  "Consultant & Design",
  "Authority Approvals",
  "Contractor Appointment",
  "Construction & Delivery",
];

// Default phase templates (month offsets and durations)
const DEFAULT_PHASES = [
  { phaseNumber: 1, startMonth: 0, durationMonths: 3, estimatedCost: "0" },
  { phaseNumber: 2, startMonth: 3, durationMonths: 6, estimatedCost: "0" },
  { phaseNumber: 3, startMonth: 9, durationMonths: 3, estimatedCost: "0" },
  { phaseNumber: 4, startMonth: 12, durationMonths: 3, estimatedCost: "0" },
  { phaseNumber: 5, startMonth: 15, durationMonths: 18, estimatedCost: "0" },
];

export const capitalPlanningRouter = router({
  // Get all projects with their phases and settings
  getPortfolio: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.user) throw new Error("Unauthorized");
    
    const projects = await getAllProjects();
    const allPhases = await getAllProjectPhases();
    const allSettings = await getAllProjectCapitalSettings();
    
    return projects.map(project => {
      const phases = allPhases.filter(p => p.projectId === project.id);
      const settings = allSettings.find(s => s.projectId === project.id);
      return {
        ...project,
        phases: phases.length > 0 ? phases : [],
        settings: settings || null,
        phaseNames: PHASE_NAMES,
        phaseNamesEn: PHASE_NAMES_EN,
      };
    });
  }),

  // Get single project phases
  getProjectPhases: publicProcedure
    .input(z.number())
    .query(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      const phases = await getProjectPhases(input);
      return phases;
    }),

  // Get project capital settings
  getProjectSettings: publicProcedure
    .input(z.number())
    .query(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      return await getProjectCapitalSettings(input);
    }),

  // Initialize default phases for a project
  initializePhases: publicProcedure
    .input(z.object({
      projectId: z.number(),
      startDate: z.string(), // YYYY-MM
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      
      // Create settings
      await upsertProjectCapitalSettings(input.projectId, {
        startDate: input.startDate,
      });
      
      // Create default phases
      for (const phase of DEFAULT_PHASES) {
        await upsertProjectPhase(input.projectId, phase.phaseNumber, {
          phaseName: PHASE_NAMES[phase.phaseNumber - 1],
          startMonth: phase.startMonth,
          durationMonths: phase.durationMonths,
          estimatedCost: phase.estimatedCost,
        });
      }
      
      return { success: true };
    }),

  // Update a phase (dates, cost, etc.)
  updatePhase: publicProcedure
    .input(z.object({
      projectId: z.number(),
      phaseNumber: z.number().min(1).max(5),
      startMonth: z.number().optional(),
      durationMonths: z.number().optional(),
      estimatedCost: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      const { projectId, phaseNumber, ...data } = input;
      await upsertProjectPhase(projectId, phaseNumber, data);
      return { success: true };
    }),

  // Delay or accelerate a phase (shifts all subsequent phases)
  shiftPhase: publicProcedure
    .input(z.object({
      projectId: z.number(),
      phaseNumber: z.number().min(1).max(5),
      delayMonths: z.number(), // positive = delay, negative = accelerate
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      await updatePhaseDelay(input.projectId, input.phaseNumber, input.delayMonths);
      return { success: true };
    }),

  // Update project settings (start date, total budget)
  updateSettings: publicProcedure
    .input(z.object({
      projectId: z.number(),
      startDate: z.string().optional(),
      totalBudget: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      const { projectId, ...data } = input;
      await upsertProjectCapitalSettings(projectId, data);
      return { success: true };
    }),

  // Bulk update phases for a project
  bulkUpdatePhases: publicProcedure
    .input(z.object({
      projectId: z.number(),
      phases: z.array(z.object({
        phaseNumber: z.number().min(1).max(5),
        startMonth: z.number(),
        durationMonths: z.number(),
        estimatedCost: z.string(),
        delayMonths: z.number().optional(),
        notes: z.string().optional(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      
      for (const phase of input.phases) {
        await upsertProjectPhase(input.projectId, phase.phaseNumber, {
          phaseName: PHASE_NAMES[phase.phaseNumber - 1],
          startMonth: phase.startMonth,
          durationMonths: phase.durationMonths,
          estimatedCost: phase.estimatedCost,
          delayMonths: phase.delayMonths ?? 0,
          notes: phase.notes,
        });
      }
      
      return { success: true };
    }),

  // Get phase names
  getPhaseNames: publicProcedure.query(() => ({
    ar: PHASE_NAMES,
    en: PHASE_NAMES_EN,
  })),
});
