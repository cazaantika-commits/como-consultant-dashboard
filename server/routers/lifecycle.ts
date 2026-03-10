import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  lifecycleStages,
  lifecycleServices,
  lifecycleRequirements,
  projectServiceInstances,
  projectRequirementStatus,
  projectStageStatus,
} from "../../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";

// ─────────────────────────────────────────────────────────────
// Helper: compute dynamic operational status for a service
// based on dependency completion and requirement status
// ─────────────────────────────────────────────────────────────
async function computeServiceStatus(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  projectId: number,
  serviceCode: string,
  dependsOn: string | null
): Promise<{ opStatus: string; timeStatus: string }> {
  // Check if dependencies are completed
  if (dependsOn) {
    const depCodes = dependsOn.split(",").map((s) => s.trim()).filter(Boolean);
    for (const depCode of depCodes) {
      const [depInstance] = await db
        .select()
        .from(projectServiceInstances)
        .where(
          and(
            eq(projectServiceInstances.projectId, projectId),
            eq(projectServiceInstances.serviceCode, depCode)
          )
        );
      if (!depInstance || depInstance.operationalStatus !== "completed") {
        return { opStatus: "locked", timeStatus: "مقفلة (تعتمد على خدمة سابقة)" };
      }
    }
  }

  // Check requirement completion
  const reqs = await db
    .select()
    .from(lifecycleRequirements)
    .where(eq(lifecycleRequirements.serviceCode, serviceCode));

  const mandatoryReqs = reqs.filter((r) => r.isMandatory === 1);

  const statuses = await db
    .select()
    .from(projectRequirementStatus)
    .where(
      and(
        eq(projectRequirementStatus.projectId, projectId),
        eq(projectRequirementStatus.serviceCode, serviceCode)
      )
    );

  const completedMandatory = mandatoryReqs.filter((r) =>
    statuses.find(
      (s) => s.requirementCode === r.requirementCode && s.status === "completed"
    )
  );

  const allMandatoryDone = completedMandatory.length === mandatoryReqs.length;

  // Get instance for date info
  const [instance] = await db
    .select()
    .from(projectServiceInstances)
    .where(
      and(
        eq(projectServiceInstances.projectId, projectId),
        eq(projectServiceInstances.serviceCode, serviceCode)
      )
    );

  if (instance?.operationalStatus === "completed") {
    return { opStatus: "completed", timeStatus: "مكتملة" };
  }
  if (instance?.operationalStatus === "submitted") {
    return { opStatus: "submitted", timeStatus: "مقدّمة للمراجعة" };
  }

  // Compute time status
  let timeStatus = "";
  if (instance?.plannedDueDate) {
    const today = new Date();
    const [day, month, year] = instance.plannedDueDate.split("-").map(Number);
    const dueDate = new Date(year, month - 1, day);
    const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) {
      timeStatus = `متأخرة ${Math.abs(diffDays)} يوم`;
    } else if (diffDays === 0) {
      timeStatus = "تستحق اليوم";
    } else {
      timeStatus = `متبقي ${diffDays} يوم`;
    }
  }

  const opStatus = allMandatoryDone ? "in_progress" : "not_started";
  return { opStatus, timeStatus };
}

export const lifecycleRouter = router({
  // ── Stages ──────────────────────────────────────────────────

  /** Get all master stages */
  getStages: protectedProcedure.query(async () => {
    const db = await getDb();
    return db
      .select()
      .from(lifecycleStages)
      .orderBy(lifecycleStages.sortOrder);
  }),

  /** Get per-project stage statuses */
  getProjectStageStatuses: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      const stages = await db
        .select()
        .from(lifecycleStages)
        .orderBy(lifecycleStages.sortOrder);

      const overrides = await db
        .select()
        .from(projectStageStatus)
        .where(eq(projectStageStatus.projectId, input.projectId));

      return stages.map((stage) => {
        const override = overrides.find((o) => o.stageCode === stage.stageCode);
        return {
          ...stage,
          status: override?.status ?? stage.defaultStatus ?? "not_started",
        };
      });
    }),

  /** Update a project's stage status */
  updateProjectStageStatus: protectedProcedure
    .input(
      z.object({
        projectId: z.number(),
        stageCode: z.string(),
        status: z.enum(["not_started", "in_progress", "completed", "locked"]),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      const existing = await db
        .select()
        .from(projectStageStatus)
        .where(
          and(
            eq(projectStageStatus.projectId, input.projectId),
            eq(projectStageStatus.stageCode, input.stageCode)
          )
        );

      if (existing.length > 0) {
        await db
          .update(projectStageStatus)
          .set({ status: input.status })
          .where(
            and(
              eq(projectStageStatus.projectId, input.projectId),
              eq(projectStageStatus.stageCode, input.stageCode)
            )
          );
      } else {
        await db.insert(projectStageStatus).values({
          projectId: input.projectId,
          stageCode: input.stageCode,
          status: input.status,
        });
      }
      return { success: true };
    }),

  // ── Services ─────────────────────────────────────────────────

  /** Get services for a stage with computed dynamic status per project */
  getStageServices: protectedProcedure
    .input(z.object({ stageCode: z.string(), projectId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      const services = await db
        .select()
        .from(lifecycleServices)
        .where(eq(lifecycleServices.stageCode, input.stageCode))
        .orderBy(lifecycleServices.sortOrder);

      const instances = await db
        .select()
        .from(projectServiceInstances)
        .where(eq(projectServiceInstances.projectId, input.projectId));

      return Promise.all(
        services.map(async (svc) => {
          const instance = instances.find((i) => i.serviceCode === svc.serviceCode);
          const { opStatus, timeStatus } = await computeServiceStatus(
            db,
            input.projectId,
            svc.serviceCode,
            svc.dependsOn ?? null
          );

          // Count requirements
          const reqs = await db
            .select()
            .from(lifecycleRequirements)
            .where(eq(lifecycleRequirements.serviceCode, svc.serviceCode));

          const reqStatuses = await db
            .select()
            .from(projectRequirementStatus)
            .where(
              and(
                eq(projectRequirementStatus.projectId, input.projectId),
                eq(projectRequirementStatus.serviceCode, svc.serviceCode)
              )
            );

          const totalReqs = reqs.length;
          const completedReqs = reqStatuses.filter((s) => s.status === "completed").length;
          const mandatoryIncomplete = reqs
            .filter((r) => r.isMandatory === 1)
            .filter(
              (r) =>
                !reqStatuses.find(
                  (s) => s.requirementCode === r.requirementCode && s.status === "completed"
                )
            ).length;

          return {
            ...svc,
            instance: instance ?? null,
            opStatus: instance?.operationalStatus ?? opStatus,
            timeStatus,
            totalReqs,
            completedReqs,
            mandatoryIncomplete,
            canSubmit: mandatoryIncomplete === 0,
          };
        })
      );
    }),

  /** Upsert a service instance (dates, notes) */
  upsertServiceInstance: protectedProcedure
    .input(
      z.object({
        projectId: z.number(),
        serviceCode: z.string(),
        stageCode: z.string(),
        plannedStartDate: z.string().optional(),
        plannedDueDate: z.string().optional(),
        actualStartDate: z.string().optional(),
        actualCloseDate: z.string().optional(),
        notes: z.string().optional(),
        operationalStatus: z
          .enum(["not_started", "in_progress", "completed", "locked", "submitted"])
          .optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      const existing = await db
        .select()
        .from(projectServiceInstances)
        .where(
          and(
            eq(projectServiceInstances.projectId, input.projectId),
            eq(projectServiceInstances.serviceCode, input.serviceCode)
          )
        );

      const data = {
        projectId: input.projectId,
        serviceCode: input.serviceCode,
        stageCode: input.stageCode,
        plannedStartDate: input.plannedStartDate,
        plannedDueDate: input.plannedDueDate,
        actualStartDate: input.actualStartDate,
        actualCloseDate: input.actualCloseDate,
        notes: input.notes,
        ...(input.operationalStatus ? { operationalStatus: input.operationalStatus } : {}),
      };

      if (existing.length > 0) {
        await db
          .update(projectServiceInstances)
          .set(data)
          .where(
            and(
              eq(projectServiceInstances.projectId, input.projectId),
              eq(projectServiceInstances.serviceCode, input.serviceCode)
            )
          );
      } else {
        await db.insert(projectServiceInstances).values(data);
      }
      return { success: true };
    }),

  /** Submit a service (marks it as submitted if all mandatory reqs done) */
  submitService: protectedProcedure
    .input(z.object({ projectId: z.number(), serviceCode: z.string(), stageCode: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      // Verify all mandatory reqs are complete
      const reqs = await db
        .select()
        .from(lifecycleRequirements)
        .where(eq(lifecycleRequirements.serviceCode, input.serviceCode));

      const mandatoryReqs = reqs.filter((r) => r.isMandatory === 1);
      const statuses = await db
        .select()
        .from(projectRequirementStatus)
        .where(
          and(
            eq(projectRequirementStatus.projectId, input.projectId),
            eq(projectRequirementStatus.serviceCode, input.serviceCode)
          )
        );

      const incomplete = mandatoryReqs.filter(
        (r) =>
          !statuses.find(
            (s) => s.requirementCode === r.requirementCode && s.status === "completed"
          )
      );

      if (incomplete.length > 0) {
        throw new Error(`يوجد ${incomplete.length} متطلبات إلزامية غير مكتملة`);
      }

      // Upsert as submitted
      const existing = await db
        .select()
        .from(projectServiceInstances)
        .where(
          and(
            eq(projectServiceInstances.projectId, input.projectId),
            eq(projectServiceInstances.serviceCode, input.serviceCode)
          )
        );

      const now = new Date().toISOString().slice(0, 19).replace("T", " ");
      if (existing.length > 0) {
        await db
          .update(projectServiceInstances)
          .set({ operationalStatus: "submitted", submittedAt: now, submittedByUserId: ctx.user.id })
          .where(
            and(
              eq(projectServiceInstances.projectId, input.projectId),
              eq(projectServiceInstances.serviceCode, input.serviceCode)
            )
          );
      } else {
        await db.insert(projectServiceInstances).values({
          projectId: input.projectId,
          serviceCode: input.serviceCode,
          stageCode: input.stageCode,
          operationalStatus: "submitted",
          submittedAt: now,
          submittedByUserId: ctx.user.id,
        });
      }
      return { success: true };
    }),

  // ── Requirements ─────────────────────────────────────────────

  /** Get requirements for a service with per-project status */
  getServiceRequirements: protectedProcedure
    .input(z.object({ serviceCode: z.string(), projectId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      const reqs = await db
        .select()
        .from(lifecycleRequirements)
        .where(eq(lifecycleRequirements.serviceCode, input.serviceCode))
        .orderBy(lifecycleRequirements.sortOrder);

      const statuses = await db
        .select()
        .from(projectRequirementStatus)
        .where(
          and(
            eq(projectRequirementStatus.projectId, input.projectId),
            eq(projectRequirementStatus.serviceCode, input.serviceCode)
          )
        );

      return reqs.map((req) => {
        const status = statuses.find((s) => s.requirementCode === req.requirementCode);
        return {
          ...req,
          status: status?.status ?? "pending",
          fileUrl: status?.fileUrl ?? null,
          notes: status?.notes ?? null,
          completedAt: status?.completedAt ?? null,
          statusId: status?.id ?? null,
        };
      });
    }),

  /** Update a single requirement's status */
  updateRequirementStatus: protectedProcedure
    .input(
      z.object({
        projectId: z.number(),
        serviceCode: z.string(),
        requirementCode: z.string(),
        status: z.enum(["pending", "completed", "not_applicable"]),
        fileUrl: z.string().optional(),
        fileKey: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      const existing = await db
        .select()
        .from(projectRequirementStatus)
        .where(
          and(
            eq(projectRequirementStatus.projectId, input.projectId),
            eq(projectRequirementStatus.serviceCode, input.serviceCode),
            eq(projectRequirementStatus.requirementCode, input.requirementCode)
          )
        );

      const now = new Date().toISOString().slice(0, 19).replace("T", " ");
      const data = {
        projectId: input.projectId,
        serviceCode: input.serviceCode,
        requirementCode: input.requirementCode,
        status: input.status,
        fileUrl: input.fileUrl,
        fileKey: input.fileKey,
        notes: input.notes,
        completedByUserId: input.status === "completed" ? ctx.user.id : undefined,
        completedAt: input.status === "completed" ? now : undefined,
      };

      if (existing.length > 0) {
        await db
          .update(projectRequirementStatus)
          .set(data)
          .where(
            and(
              eq(projectRequirementStatus.projectId, input.projectId),
              eq(projectRequirementStatus.serviceCode, input.serviceCode),
              eq(projectRequirementStatus.requirementCode, input.requirementCode)
            )
          );
      } else {
        await db.insert(projectRequirementStatus).values(data);
      }
      return { success: true };
    }),

  /** Get summary stats for a project across all stages */
  getProjectLifecycleSummary: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      const stages = await db
        .select()
        .from(lifecycleStages)
        .orderBy(lifecycleStages.sortOrder);

      const stageStatuses = await db
        .select()
        .from(projectStageStatus)
        .where(eq(projectStageStatus.projectId, input.projectId));

      const services = await db.select().from(lifecycleServices);
      const instances = await db
        .select()
        .from(projectServiceInstances)
        .where(eq(projectServiceInstances.projectId, input.projectId));

      return stages.map((stage) => {
        const stageStatus = stageStatuses.find((s) => s.stageCode === stage.stageCode);
        const stageServices = services.filter((s) => s.stageCode === stage.stageCode);
        const completedServices = stageServices.filter((s) =>
          instances.find(
            (i) =>
              i.serviceCode === s.serviceCode &&
              (i.operationalStatus === "completed" || i.operationalStatus === "submitted")
          )
        );

        return {
          stageCode: stage.stageCode,
          nameAr: stage.nameAr,
          status: stageStatus?.status ?? stage.defaultStatus ?? "not_started",
          totalServices: stageServices.length,
          completedServices: completedServices.length,
        };
      });
    }),
});
