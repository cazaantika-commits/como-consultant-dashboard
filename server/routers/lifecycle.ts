import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  lifecycleStages,
  lifecycleServices,
  lifecycleRequirements,
  projectProgramApprovals,
  projectServiceInstances,
  projectRequirementStatus,
  projectStageStatus,
} from "../../drizzle/schema";
import { eq, and, sql, lte, gte, isNotNull, max } from "drizzle-orm";
import { ENV } from "../_core/env";
import { requireProjectAccess } from "../services/comoNextCommands";
import {
  loadProjectProgramState,
  normalizeProgramDate,
  PROJECT_PROGRAM_SCHEMA_VERSION,
} from "../services/comoNextProjectProgram";

function assertProgramOwner(user: { openId?: string | null; role?: string | null }) {
  if (!ENV.ownerOpenId || user.openId !== ENV.ownerOpenId || user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "اعتماد البرنامج الأولي متاح لعبد الرحمن فقط." });
  }
}

async function requireLifecycleDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "قاعدة البيانات غير متاحة." });
  return db;
}

async function requireLifecycleService(db: any, serviceCode: string, stageCode?: string) {
  const [service] = await db.select().from(lifecycleServices).where(eq(lifecycleServices.serviceCode, serviceCode)).limit(1);
  if (!service) throw new TRPCError({ code: "BAD_REQUEST", message: "الخدمة غير موجودة في مكتبة دورة المشروع." });
  if (stageCode && service.stageCode !== stageCode) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "الخدمة لا تنتمي إلى المرحلة المحددة." });
  }
  return service;
}

async function requireLifecycleRequirement(db: any, serviceCode: string, requirementCode: string) {
  const [requirement] = await db.select().from(lifecycleRequirements).where(and(
    eq(lifecycleRequirements.serviceCode, serviceCode),
    eq(lifecycleRequirements.requirementCode, requirementCode),
  )).limit(1);
  if (!requirement) throw new TRPCError({ code: "BAD_REQUEST", message: "المتطلب لا ينتمي إلى الخدمة المحددة." });
  return requirement;
}

function normalizedOptionalDate(value: string | undefined, label: string) {
  if (value === undefined) return undefined;
  if (!value.trim()) return null;
  const normalized = normalizeProgramDate(value);
  if (!normalized) throw new TRPCError({ code: "BAD_REQUEST", message: `${label} غير صالح. استخدم YYYY-MM-DD.` });
  return normalized;
}

function rejectUnscopedCatalogueWrite(): void {
  throw new TRPCError({
    code: "PRECONDITION_FAILED",
    message: "أُوقف تعديل مكتبة دورة المشروع العامة. تُقرأ السجلات الحالية داخل ملف المشروع، وتحتاج التعديلات العامة إلى مسار حوكمة مستقل.",
  });
}

// -------------------------------------------------------------
// Helper: compute dynamic operational status for a service
// based on dependency completion and requirement status
// -------------------------------------------------------------
async function computeServiceStatus(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  projectId: number,
  serviceCode: string,
  dependsOn: string | null
): Promise<{ opStatus: string; timeStatus: string }> {
  // NOTE: Dependency locking is DISABLED — all services are always accessible
  // (dependsOn is ignored; re-enable later after field definitions are complete)

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
    // Handle both YYYY-MM-DD (ISO) and DD-MM-YYYY formats
    let dueDate: Date;
    const isoMatch = instance.plannedDueDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      dueDate = new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
    } else {
      const [day, month, year] = instance.plannedDueDate.split("-").map(Number);
      dueDate = new Date(year, month - 1, day);
    }
    const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) {
      timeStatus = `متأخرة ${Math.abs(diffDays)} يوم`;
    } else if (diffDays === 0) {
      timeStatus = "تستحق اليوم";
    } else {
      timeStatus = `متبقي ${diffDays} يوم`;
    }
  }

  // If the service has an actualStartDate it has physically started — never show "not_started"
  const hasActualStart = !!(instance?.actualStartDate);
  const opStatus = allMandatoryDone || hasActualStart ? "in_progress" : "not_started";
  return { opStatus, timeStatus };
}

export const lifecycleRouter = router({
  // -- Stages --------------------------------------------------

  /** Get all active master stages */
  getStages: protectedProcedure.query(async () => {
    const db = await requireLifecycleDb();
    return db
      .select()
      .from(lifecycleStages)
      .where(eq(lifecycleStages.isActive, 1))
      .orderBy(lifecycleStages.sortOrder);
  }),

  /** Get ALL stages including inactive (for settings UI) */
  getAllStages: protectedProcedure.query(async () => {
    const db = await requireLifecycleDb();
    return db
      .select()
      .from(lifecycleStages)
      .orderBy(lifecycleStages.sortOrder);
  }),

  /** Create a new stage */
  createStage: protectedProcedure
    .input(z.object({
      nameAr: z.string().min(1),
      nameEn: z.string().optional(),
      category: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      rejectUnscopedCatalogueWrite();
      const db = await requireLifecycleDb();
      const maxOrder = await db
        .select({ max: max(lifecycleStages.sortOrder) })
        .from(lifecycleStages);
      const nextOrder = (maxOrder[0]?.max ?? 0) + 1;
      const stageCode = `STG-CUSTOM-${Date.now()}`;
      await db.insert(lifecycleStages).values({
        stageCode,
        nameAr: input.nameAr,
        nameEn: input.nameEn ?? null,
        category: input.category ?? null,
        isActive: 1,
        sortOrder: nextOrder,
        defaultStatus: 'not_started',
      });
      return { success: true, stageCode };
    }),

  /** Update stage name, category, isActive, sortOrder */
  updateStage: protectedProcedure
    .input(z.object({
      id: z.number(),
      nameAr: z.string().min(1).optional(),
      nameEn: z.string().optional(),
      category: z.string().optional(),
      isActive: z.number().optional(),
      sortOrder: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      rejectUnscopedCatalogueWrite();
      const db = await requireLifecycleDb();
      const { id, ...updates } = input;
      await db.update(lifecycleStages).set(updates).where(eq(lifecycleStages.id, id));
      return { success: true };
    }),

  /** Reorder stages: update sortOrder for multiple stages at once */
  reorderStages: protectedProcedure
    .input(z.object({
      stages: z.array(z.object({ id: z.number(), sortOrder: z.number() }))
    }))
    .mutation(async ({ input }) => {
      rejectUnscopedCatalogueWrite();
      const db = await requireLifecycleDb();
      for (const s of input.stages) {
        await db.update(lifecycleStages).set({ sortOrder: s.sortOrder }).where(eq(lifecycleStages.id, s.id));
      }
      return { success: true };
    }),

  /** Get per-project stage statuses */
  getProjectStageStatuses: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = await requireLifecycleDb();
      await requireProjectAccess(db, input.projectId, ctx.user.id, "read");
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
    .mutation(async ({ input, ctx }) => {
      const db = await requireLifecycleDb();
      await requireProjectAccess(db, input.projectId, ctx.user.id, "write");
      const [stage] = await db.select({ stageCode: lifecycleStages.stageCode }).from(lifecycleStages)
        .where(eq(lifecycleStages.stageCode, input.stageCode)).limit(1);
      if (!stage) throw new TRPCError({ code: "BAD_REQUEST", message: "المرحلة غير موجودة في دورة المشروع." });
      await db.insert(projectStageStatus).values({
          projectId: input.projectId,
          stageCode: input.stageCode,
          status: input.status,
        }).onDuplicateKeyUpdate({ set: { status: input.status } });
      return { success: true };
    }),

  // -- Services -------------------------------------------------

  /** Get services for a stage with computed dynamic status per project */
  getStageServices: protectedProcedure
    .input(z.object({ stageCode: z.string(), projectId: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = await requireLifecycleDb();
      await requireProjectAccess(db, input.projectId, ctx.user.id, "read");
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
      const db = await requireLifecycleDb();
      await requireProjectAccess(db, input.projectId, ctx.user.id, "write");
      await requireLifecycleService(db, input.serviceCode, input.stageCode);

      // Only include fields that are explicitly provided (not undefined)
      // This prevents accidental overwrites when only updating status
	      const data: typeof projectServiceInstances.$inferInsert = {
        projectId: input.projectId,
        serviceCode: input.serviceCode,
        stageCode: input.stageCode,
      };
      const plannedStartDate = normalizedOptionalDate(input.plannedStartDate, "تاريخ البدء المخطط");
      const plannedDueDate = normalizedOptionalDate(input.plannedDueDate, "تاريخ الاستحقاق المخطط");
      const actualStartDate = normalizedOptionalDate(input.actualStartDate, "تاريخ البدء الفعلي");
      const actualCloseDate = normalizedOptionalDate(input.actualCloseDate, "تاريخ الإغلاق الفعلي");
      if (plannedStartDate !== undefined) data.plannedStartDate = plannedStartDate;
      if (plannedDueDate !== undefined) data.plannedDueDate = plannedDueDate;
      if (actualStartDate !== undefined) data.actualStartDate = actualStartDate;
      if (actualCloseDate !== undefined) data.actualCloseDate = actualCloseDate;
      if (input.notes !== undefined) data.notes = input.notes;
      if (input.operationalStatus) data.operationalStatus = input.operationalStatus;
      const [existing] = await db.select({
        plannedStartDate: projectServiceInstances.plannedStartDate,
        plannedDueDate: projectServiceInstances.plannedDueDate,
        actualStartDate: projectServiceInstances.actualStartDate,
        actualCloseDate: projectServiceInstances.actualCloseDate,
      }).from(projectServiceInstances).where(and(
        eq(projectServiceInstances.projectId, input.projectId),
        eq(projectServiceInstances.serviceCode, input.serviceCode),
      )).limit(1);
      const nextPlannedStart = data.plannedStartDate === undefined ? normalizeProgramDate(existing?.plannedStartDate) : data.plannedStartDate;
      const nextPlannedDue = data.plannedDueDate === undefined ? normalizeProgramDate(existing?.plannedDueDate) : data.plannedDueDate;
      const nextActualStart = data.actualStartDate === undefined ? normalizeProgramDate(existing?.actualStartDate) : data.actualStartDate;
      const nextActualClose = data.actualCloseDate === undefined ? normalizeProgramDate(existing?.actualCloseDate) : data.actualCloseDate;
      if (nextPlannedStart && nextPlannedDue && nextPlannedStart > nextPlannedDue) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "تاريخ بدء الخدمة بعد تاريخ استحقاقها." });
      }
      if (nextActualStart && nextActualClose && nextActualStart > nextActualClose) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "تاريخ البدء الفعلي بعد تاريخ الإغلاق." });
      }
      await db.insert(projectServiceInstances).values(data).onDuplicateKeyUpdate({ set: data });
      return { success: true };
    }),

  /** Submit a service (marks it as submitted if all mandatory reqs done) */
  submitService: protectedProcedure
    .input(z.object({ projectId: z.number(), serviceCode: z.string(), stageCode: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const db = await requireLifecycleDb();
      await requireProjectAccess(db, input.projectId, ctx.user.id, "write");
      await requireLifecycleService(db, input.serviceCode, input.stageCode);
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

      const now = new Date().toISOString().slice(0, 19).replace("T", " ");
      await db.insert(projectServiceInstances).values({
          projectId: input.projectId,
          serviceCode: input.serviceCode,
          stageCode: input.stageCode,
          operationalStatus: "submitted",
          submittedAt: now,
          submittedByUserId: ctx.user.id,
        }).onDuplicateKeyUpdate({ set: { operationalStatus: "submitted", submittedAt: now, submittedByUserId: ctx.user.id } });
      return { success: true };
    }),

  // -- Requirements ---------------------------------------------

  /** Get requirements for a service with per-project status */
  getServiceRequirements: protectedProcedure
    .input(z.object({ serviceCode: z.string(), projectId: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = await requireLifecycleDb();
      await requireProjectAccess(db, input.projectId, ctx.user.id, "read");
      await requireLifecycleService(db, input.serviceCode);
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
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await requireLifecycleDb();
      await requireProjectAccess(db, input.projectId, ctx.user.id, "write");
      await requireLifecycleService(db, input.serviceCode);
      await requireLifecycleRequirement(db, input.serviceCode, input.requirementCode);

      const now = new Date().toISOString().slice(0, 19).replace("T", " ");
      const data = {
        projectId: input.projectId,
        serviceCode: input.serviceCode,
        requirementCode: input.requirementCode,
        status: input.status,
        notes: input.notes,
        completedByUserId: input.status === "completed" ? ctx.user.id : null,
        completedAt: input.status === "completed" ? now : null,
      };
      await db.insert(projectRequirementStatus).values(data).onDuplicateKeyUpdate({ set: data });
      return { success: true };
    }),

  /** Read deadline counts only; outbound notifications remain disabled. */
  checkDeadlines: protectedProcedure.mutation(async ({ ctx }) => {
    assertProgramOwner(ctx.user);
    const db = await requireLifecycleDb();
    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const nowMs = now.getTime();
    const threeDaysMs = threeDaysFromNow.getTime();

    // Get all service instances that have a due date and are not completed
    const instances = await db
      .select()
      .from(projectServiceInstances)
      .where(
        and(
          isNotNull(projectServiceInstances.plannedDueDate),
          sql`${projectServiceInstances.operationalStatus} NOT IN ('completed', 'submitted', 'na')`
        )
      );

    const services = await db.select().from(lifecycleServices);
    const stages = await db.select().from(lifecycleStages);

    // Import projects table to get project names
    const { projects } = await import("../../drizzle/schema");
    const projectsList = await db.select({ id: projects.id, name: projects.name }).from(projects).where(eq(projects.isTestProject, 0));
    const officialProjectIds = new Set(projectsList.map((project) => project.id));

    const overdueItems: string[] = [];
    const upcomingItems: string[] = [];

    for (const inst of instances) {
      if (!inst.plannedDueDate) continue;
      if (!officialProjectIds.has(inst.projectId)) continue;
      const dueMs = new Date(inst.plannedDueDate).getTime();
      const service = services.find((s) => s.serviceCode === inst.serviceCode);
      const stage = stages.find((s) => s.stageCode === service?.stageCode);
      const project = projectsList.find((p) => p.id === inst.projectId);
      const label = `[${project?.name ?? `مشروع ${inst.projectId}`}] ${stage?.nameAr ?? ''} > ${service?.nameAr ?? inst.serviceCode}`;
      const dueDate = new Date(inst.plannedDueDate).toLocaleDateString('ar-AE');

      if (dueMs < nowMs) {
        overdueItems.push(`• ${label} — موعد الاستحقاق: ${dueDate} (متأخرة)`);
      } else if (dueMs <= threeDaysMs) {
        upcomingItems.push(`• ${label} — موعد الاستحقاق: ${dueDate} (خلال 3 أيام)`);
      }
    }

    const alerts = [...overdueItems, ...upcomingItems];
    if (alerts.length === 0) return { sent: false, count: 0 };

    const lines: string[] = [];
    if (overdueItems.length > 0) {
      lines.push(`🔴 خدمات متأخرة (${overdueItems.length}):\n${overdueItems.join('\n')}`);
    }
    if (upcomingItems.length > 0) {
      lines.push(`🟡 خدمات تستحق خلال 3 أيام (${upcomingItems.length}):\n${upcomingItems.join('\n')}`);
    }

    return {
      sent: false,
      count: alerts.length,
      overdue: overdueItems.length,
      upcoming: upcomingItems.length,
      note: "قراءة فقط — لم يُرسل أي تنبيه خارجي.",
    };
  }),

  /** Get upcoming and overdue services for a project (for UI display) */
  getDeadlineAlerts: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      const db = await requireLifecycleDb();
      await requireProjectAccess(db, input.projectId, ctx.user.id, "read");
      const now = new Date();
      const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const nowMs = now.getTime();
      const sevenDaysMs = sevenDaysFromNow.getTime();

      const whereClause = and(
        eq(projectServiceInstances.projectId, input.projectId),
        isNotNull(projectServiceInstances.plannedDueDate),
        sql`${projectServiceInstances.operationalStatus} NOT IN ('completed', 'submitted', 'na')`
      );

      const instances = await db
        .select()
        .from(projectServiceInstances)
        .where(whereClause);

      const services = await db.select().from(lifecycleServices);
      const stages = await db.select().from(lifecycleStages);
      const { projects } = await import("../../drizzle/schema");
      const projectsList = await db.select({ id: projects.id, name: projects.name })
        .from(projects)
        .where(eq(projects.id, input.projectId));
      const visibleProjectIds = new Set(projectsList.map((project) => project.id));

      const alerts = instances
        .filter((inst) => {
          if (!visibleProjectIds.has(inst.projectId)) return false;
          if (!inst.plannedDueDate) return false;
          const dueMs = new Date(inst.plannedDueDate).getTime();
          return dueMs <= sevenDaysMs; // overdue or within 7 days
        })
        .map((inst) => {
          const dueMs = new Date(inst.plannedDueDate!).getTime();
          const service = services.find((s) => s.serviceCode === inst.serviceCode);
          const stage = stages.find((s) => s.stageCode === service?.stageCode);
          const project = projectsList.find((p) => p.id === inst.projectId);
          const daysLeft = Math.ceil((dueMs - nowMs) / (24 * 60 * 60 * 1000));
          return {
            projectId: inst.projectId,
            projectName: project?.name ?? `مشروع ${inst.projectId}`,
            serviceCode: inst.serviceCode,
            serviceNameAr: service?.nameAr ?? inst.serviceCode,
            stageNameAr: stage?.nameAr ?? '',
            plannedDueDate: inst.plannedDueDate,
            daysLeft,
            severity: daysLeft < 0 ? 'overdue' : daysLeft <= 3 ? 'urgent' : 'soon',
          };
        })
        .sort((a, b) => a.daysLeft - b.daysLeft);

      return alerts;
    }),

  /** Get full work schedule data: all stages + services + requirements + instances in one call */
  getWorkSchedule: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = await requireLifecycleDb();
      await requireProjectAccess(db, input.projectId, ctx.user.id, "read");
      const stages = await db
        .select()
        .from(lifecycleStages)
        .where(eq(lifecycleStages.isActive, 1))
        .orderBy(lifecycleStages.sortOrder);

      const allServices = await db
        .select()
        .from(lifecycleServices)
        .orderBy(lifecycleServices.sortOrder);

      const allReqs = await db
        .select()
        .from(lifecycleRequirements)
        .orderBy(lifecycleRequirements.sortOrder);

      const instances = await db
        .select()
        .from(projectServiceInstances)
        .where(eq(projectServiceInstances.projectId, input.projectId));

      const reqStatuses = await db
        .select()
        .from(projectRequirementStatus)
        .where(eq(projectRequirementStatus.projectId, input.projectId));

      const stageStatuses = await db
        .select()
        .from(projectStageStatus)
        .where(eq(projectStageStatus.projectId, input.projectId));

      return stages.map((stage) => {
        const stageStatus = stageStatuses.find((s) => s.stageCode === stage.stageCode);
        const stageServices = allServices.filter((s) => s.stageCode === stage.stageCode);

        const servicesData = stageServices.map((svc) => {
          const instance = instances.find((i) => i.serviceCode === svc.serviceCode);
          const svcReqs = allReqs.filter((r) => r.serviceCode === svc.serviceCode);
          const svcReqStatuses = reqStatuses.filter((r) => r.serviceCode === svc.serviceCode);
          const completedReqs = svcReqStatuses.filter((s) => s.status === "completed").length;
          const mandatoryReqs = svcReqs.filter((r) => r.isMandatory === 1);
          const mandatoryComplete = mandatoryReqs.filter((r) =>
            svcReqStatuses.find((s) => s.requirementCode === r.requirementCode && s.status === "completed")
          ).length;

          return {
            serviceCode: svc.serviceCode,
            nameAr: svc.nameAr,
            descriptionAr: svc.descriptionAr,
            externalParty: svc.externalParty,
            internalOwner: svc.internalOwner,
            expectedDurationDays: svc.expectedDurationDays,
            dependsOn: svc.dependsOn,
            plannedStartDate: instance?.plannedStartDate ?? null,
            plannedDueDate: instance?.plannedDueDate ?? null,
            actualStartDate: instance?.actualStartDate ?? null,
            actualCloseDate: instance?.actualCloseDate ?? null,
            operationalStatus: instance?.operationalStatus ?? "not_started",
            notes: instance?.notes ?? null,
            totalReqs: svcReqs.length,
            completedReqs,
            mandatoryTotal: mandatoryReqs.length,
            mandatoryComplete,
            requirements: svcReqs.map((r) => {
              const rs = svcReqStatuses.find((s) => s.requirementCode === r.requirementCode);
              return {
                requirementCode: r.requirementCode,
                nameAr: r.nameAr,
                reqType: r.reqType,
                isMandatory: r.isMandatory,
                timing: r.timing,
                status: rs?.status ?? "pending",
              };
            }),
          };
        });

        const completedServices = servicesData.filter(
          (s) => s.operationalStatus === "completed" || s.operationalStatus === "submitted"
        ).length;

        return {
          stageCode: stage.stageCode,
          nameAr: stage.nameAr,
          nameEn: stage.nameEn,
          category: stage.category,
          status: stageStatus?.status ?? stage.defaultStatus ?? "not_started",
          totalServices: servicesData.length,
          completedServices,
          services: servicesData,
        };
      });
    }),

  /** Get summary stats for a project across all stages */
  getProjectLifecycleSummary: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = await requireLifecycleDb();
      await requireProjectAccess(db, input.projectId, ctx.user.id, "read");
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

  /** Current project-specific initial program and its derived approval validity. */
  getProjectProgramState: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      const db = await requireLifecycleDb();
      await requireProjectAccess(db, input.projectId, ctx.user.id, "read");
      return loadProjectProgramState(db, input.projectId);
    }),

  /** Append-only owner review. Approval is accepted only for a complete current program. */
  recordProjectProgramDecision: protectedProcedure
    .input(z.object({
      projectId: z.number().int().positive(),
      decisionStatus: z.enum(["reviewed", "approved", "rejected"]),
      notes: z.string().trim().max(4000).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      assertProgramOwner(ctx.user);
      const db = await requireLifecycleDb();
      await requireProjectAccess(db, input.projectId, ctx.user.id, "write");
      const state = await loadProjectProgramState(db, input.projectId);
      if (!state.serviceCount) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "لا يوجد برنامج مشروع يمكن مراجعته." });
      }
      if (input.decisionStatus === "approved" && !state.isSourceComplete) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: state.reason });
      }
      const snapshot = {
        ...state.snapshot,
        projectId: input.projectId,
        summary: {
          serviceCount: state.serviceCount,
          stageCount: state.stageCount,
          scheduledServiceCount: state.scheduledServiceCount,
          earliestStartDate: state.earliestStartDate,
          latestDueDate: state.latestDueDate,
          issues: state.issues,
        },
      };
      const [result] = await db.insert(projectProgramApprovals).values({
        projectId: input.projectId,
        userId: ctx.user.id,
        decisionStatus: input.decisionStatus,
        sourceSchemaVersion: PROJECT_PROGRAM_SCHEMA_VERSION,
        programHash: state.programHash,
        serviceCount: state.serviceCount,
        stageCount: state.stageCount,
        earliestStartDate: state.earliestStartDate,
        latestDueDate: state.latestDueDate,
        programSnapshotJson: JSON.stringify(snapshot),
        notes: input.notes || null,
      });
      return { id: Number(result.insertId), decisionStatus: input.decisionStatus, programHash: state.programHash };
    }),

  /** Add a custom service (task) to a stage */
  addCustomService: protectedProcedure
    .input(
      z.object({
        stageCode: z.string(),
        nameAr: z.string().min(1),
        expectedDurationDays: z.number().min(1).default(7),
        projectId: z.number(),
        plannedStartDate: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      rejectUnscopedCatalogueWrite();
      const db = await requireLifecycleDb();

      // Get the max sortOrder for this stage to append at end
      const existing = await db
        .select({ maxSort: max(lifecycleServices.sortOrder) })
        .from(lifecycleServices)
        .where(eq(lifecycleServices.stageCode, input.stageCode));
      const nextSort = (existing[0]?.maxSort ?? 0) + 1;

      // Generate a unique service code
      const serviceCode = `SRV-CUSTOM-${input.stageCode}-${Date.now()}`;

      // Insert into master services table
      await db.insert(lifecycleServices).values({
        serviceCode,
        stageCode: input.stageCode,
        nameAr: input.nameAr,
        expectedDurationDays: input.expectedDurationDays,
        sortOrder: nextSort,
        isMandatory: 0,
      });

      // Create project instance if start date provided
      if (input.plannedStartDate) {
        // Calculate end date from start + duration
        const start = new Date(input.plannedStartDate);
        const end = new Date(start);
        end.setDate(end.getDate() + input.expectedDurationDays);
        const fmtDate = (d: Date) => {
          const day = d.getDate();
          const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
          const mon = months[d.getMonth()];
          const yr = String(d.getFullYear()).slice(-2);
          return `${day}-${mon}-${yr}`;
        };
        await db.insert(projectServiceInstances).values({
          projectId: input.projectId,
          serviceCode,
          stageCode: input.stageCode,
          operationalStatus: 'not_started',
          plannedStartDate: fmtDate(start),
          plannedDueDate: fmtDate(end),
        });
      }

      return { success: true, serviceCode };
    }),

  /** Delete a custom service (task) from a stage */
  deleteCustomService: protectedProcedure
    .input(
      z.object({
        serviceCode: z.string(),
        projectId: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      rejectUnscopedCatalogueWrite();
      const db = await requireLifecycleDb();

      // Delete project instance first
      await db
        .delete(projectServiceInstances)
        .where(
          and(
            eq(projectServiceInstances.projectId, input.projectId),
            eq(projectServiceInstances.serviceCode, input.serviceCode)
          )
        );

      // Delete requirement statuses
      await db
        .delete(projectRequirementStatus)
        .where(
          and(
            eq(projectRequirementStatus.projectId, input.projectId),
            eq(projectRequirementStatus.serviceCode, input.serviceCode)
          )
        );

      // Delete master service record
      await db
        .delete(lifecycleServices)
        .where(eq(lifecycleServices.serviceCode, input.serviceCode));

      // Delete master requirements for this service
      await db
        .delete(lifecycleRequirements)
        .where(eq(lifecycleRequirements.serviceCode, input.serviceCode));

      return { success: true };
    }),

  /** Update a service's name and duration */
  updateService: protectedProcedure
    .input(
      z.object({
        serviceCode: z.string(),
        nameAr: z.string().min(1).optional(),
        descriptionAr: z.string().optional(),
        externalParty: z.string().optional(),
        internalOwner: z.string().optional(),
        expectedDurationDays: z.number().min(1).optional(),
        isMandatory: z.number().optional(),
        sortOrder: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      rejectUnscopedCatalogueWrite();
      const db = await requireLifecycleDb();
      const { serviceCode, ...rest } = input;
      const data: Record<string, any> = {};
      for (const [k, v] of Object.entries(rest)) {
        if (v !== undefined) data[k] = v;
      }
      if (Object.keys(data).length > 0) {
        await db
          .update(lifecycleServices)
          .set(data)
          .where(eq(lifecycleServices.serviceCode, serviceCode));
      }
      return { success: true };
    }),

  /** Add a new service to a stage (global - affects all projects) */
  addService: protectedProcedure
    .input(
      z.object({
        stageCode: z.string(),
        nameAr: z.string().min(1),
        descriptionAr: z.string().optional(),
        externalParty: z.string().optional(),
        internalOwner: z.string().optional(),
        expectedDurationDays: z.number().min(1).default(7),
        isMandatory: z.number().default(1),
      })
    )
    .mutation(async ({ input }) => {
      rejectUnscopedCatalogueWrite();
      const db = await requireLifecycleDb();
      const existing = await db
        .select({ maxSort: max(lifecycleServices.sortOrder) })
        .from(lifecycleServices)
        .where(eq(lifecycleServices.stageCode, input.stageCode));
      const nextSort = (existing[0]?.maxSort ?? 0) + 1;
      const serviceCode = `SRV-${input.stageCode}-${Date.now()}`;
      await db.insert(lifecycleServices).values({
        serviceCode,
        stageCode: input.stageCode,
        nameAr: input.nameAr,
        descriptionAr: input.descriptionAr ?? null,
        externalParty: input.externalParty ?? null,
        internalOwner: input.internalOwner ?? null,
        expectedDurationDays: input.expectedDurationDays,
        sortOrder: nextSort,
        isMandatory: input.isMandatory,
      });
      return { success: true, serviceCode };
    }),

  /** Delete a service globally (removes from all projects) */
  deleteService: protectedProcedure
    .input(z.object({ serviceCode: z.string() }))
    .mutation(async ({ input }) => {
      rejectUnscopedCatalogueWrite();
      const db = await requireLifecycleDb();
      await db.delete(projectRequirementStatus).where(eq(projectRequirementStatus.serviceCode, input.serviceCode));
      await db.delete(projectServiceInstances).where(eq(projectServiceInstances.serviceCode, input.serviceCode));
      await db.delete(lifecycleRequirements).where(eq(lifecycleRequirements.serviceCode, input.serviceCode));
      await db.delete(lifecycleServices).where(eq(lifecycleServices.serviceCode, input.serviceCode));
      return { success: true };
    }),

  /** Delete a stage globally */
  deleteStage: protectedProcedure
    .input(z.object({ stageCode: z.string() }))
    .mutation(async ({ input }) => {
      rejectUnscopedCatalogueWrite();
      const db = await requireLifecycleDb();
      const services = await db.select().from(lifecycleServices).where(eq(lifecycleServices.stageCode, input.stageCode));
      for (const svc of services) {
        await db.delete(projectRequirementStatus).where(eq(projectRequirementStatus.serviceCode, svc.serviceCode));
        await db.delete(projectServiceInstances).where(eq(projectServiceInstances.serviceCode, svc.serviceCode));
        await db.delete(lifecycleRequirements).where(eq(lifecycleRequirements.serviceCode, svc.serviceCode));
        await db.delete(lifecycleServices).where(eq(lifecycleServices.serviceCode, svc.serviceCode));
      }
      await db.delete(projectStageStatus).where(eq(projectStageStatus.stageCode, input.stageCode));
      await db.delete(lifecycleStages).where(eq(lifecycleStages.stageCode, input.stageCode));
      return { success: true };
    }),

  /** Get all requirements for a service (admin - no project context) */
  getServiceRequirementsAdmin: protectedProcedure
    .input(z.object({ serviceCode: z.string() }))
    .query(async ({ input }) => {
      const db = await requireLifecycleDb();
      return db
        .select()
        .from(lifecycleRequirements)
        .where(eq(lifecycleRequirements.serviceCode, input.serviceCode))
        .orderBy(lifecycleRequirements.sortOrder);
    }),

  /** Add a requirement to a service */
  addRequirement: protectedProcedure
    .input(
      z.object({
        serviceCode: z.string(),
        nameAr: z.string().min(1),
        reqType: z.enum(['document', 'data', 'approval', 'action']).default('document'),
        descriptionAr: z.string().optional(),
        sourceNote: z.string().optional(),
        isMandatory: z.number().default(1),
        timing: z.string().optional(),
        internalOwner: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      rejectUnscopedCatalogueWrite();
      const db = await requireLifecycleDb();
      const existing = await db
        .select({ maxSort: max(lifecycleRequirements.sortOrder) })
        .from(lifecycleRequirements)
        .where(eq(lifecycleRequirements.serviceCode, input.serviceCode));
      const nextSort = (existing[0]?.maxSort ?? 0) + 1;
      const requirementCode = `REQ-${input.serviceCode}-${Date.now()}`;
      await db.insert(lifecycleRequirements).values({
        requirementCode,
        serviceCode: input.serviceCode,
        nameAr: input.nameAr,
        reqType: input.reqType,
        descriptionAr: input.descriptionAr ?? null,
        sourceNote: input.sourceNote ?? null,
        isMandatory: input.isMandatory,
        timing: input.timing ?? null,
        internalOwner: input.internalOwner ?? null,
        sortOrder: nextSort,
      });
      return { success: true, requirementCode };
    }),

  /** Update a requirement */
  updateRequirement: protectedProcedure
    .input(
      z.object({
        requirementCode: z.string(),
        nameAr: z.string().min(1).optional(),
        reqType: z.enum(['document', 'data', 'approval', 'action']).optional(),
        descriptionAr: z.string().optional(),
        sourceNote: z.string().optional(),
        isMandatory: z.number().optional(),
        timing: z.string().optional(),
        internalOwner: z.string().optional(),
        sortOrder: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      rejectUnscopedCatalogueWrite();
      const db = await requireLifecycleDb();
      const { requirementCode, ...rest } = input;
      const data: Record<string, any> = {};
      for (const [k, v] of Object.entries(rest)) {
        if (v !== undefined) data[k] = v;
      }
      if (Object.keys(data).length > 0) {
        await db
          .update(lifecycleRequirements)
          .set(data)
          .where(eq(lifecycleRequirements.requirementCode, requirementCode));
      }
      return { success: true };
    }),

  /** Delete a requirement */
  deleteRequirement: protectedProcedure
    .input(z.object({ requirementCode: z.string() }))
    .mutation(async ({ input }) => {
      rejectUnscopedCatalogueWrite();
      const db = await requireLifecycleDb();
      await db.delete(projectRequirementStatus).where(eq(projectRequirementStatus.requirementCode, input.requirementCode));
      await db.delete(lifecycleRequirements).where(eq(lifecycleRequirements.requirementCode, input.requirementCode));
      return { success: true };
    }),

  /** Get services for a stage (admin - no project context) */
  getStageServicesAdmin: protectedProcedure
    .input(z.object({ stageCode: z.string() }))
    .query(async ({ input }) => {
      const db = await requireLifecycleDb();
      return db
        .select()
        .from(lifecycleServices)
        .where(eq(lifecycleServices.stageCode, input.stageCode))
        .orderBy(lifecycleServices.sortOrder);
    }),

  /** Reorder services within a stage */
  reorderServices: protectedProcedure
    .input(z.object({
      services: z.array(z.object({ serviceCode: z.string(), sortOrder: z.number() }))
    }))
    .mutation(async ({ input }) => {
      rejectUnscopedCatalogueWrite();
      const db = await requireLifecycleDb();
      for (const s of input.services) {
        await db.update(lifecycleServices).set({ sortOrder: s.sortOrder }).where(eq(lifecycleServices.serviceCode, s.serviceCode));
      }
      return { success: true };
    }),
});
