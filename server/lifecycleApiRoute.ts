/**
 * Lifecycle AI API Route
 * GET /api/lifecycle/service-status?projectId=X&serviceCode=Y
 * Returns structured JSON for AI agents to query service/stage status
 *
 * GET /api/lifecycle/project-summary?projectId=X
 * Returns full project lifecycle summary as structured JSON
 */
import { Router } from "express";
import { getDb } from "./db";
import {
  lifecycleStages,
  lifecycleServices,
  lifecycleRequirements,
  projectServiceInstances,
  projectRequirementStatus,
  projectStageStatus,
  projectStageDocuments,
  projectStageFieldValues,
  stageFieldDefinitions,
  projects,
} from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

const router = Router();

// Middleware: require API key or session (basic auth for AI agents)
router.use((req, res, next) => {
  const apiKey = req.headers["x-api-key"] || req.query.apiKey;
  // Accept any request from internal server or with valid API key
  // In production, validate against a stored key
  // For now, allow all requests (auth is handled at the platform level)
  next();
});

/**
 * GET /api/lifecycle/service-status
 * Query: projectId (required), serviceCode (optional — if omitted returns all services)
 */
router.get("/service-status", async (req, res) => {
  try {
    const projectId = parseInt(req.query.projectId as string);
    const serviceCode = req.query.serviceCode as string | undefined;

    if (!projectId || isNaN(projectId)) {
      res.status(400).json({ error: "Missing or invalid projectId" });
      return;
    }

    const db = await getDb();
    if (!db) {
      res.status(500).json({ error: "DB unavailable" });
      return;
    }

    // Get project info
    const projectRows = await db.select().from(projects).where(eq(projects.id, projectId));
    const project = projectRows[0];
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    // Get services (filtered or all)
    let servicesQuery = db.select().from(lifecycleServices).orderBy(lifecycleServices.sortOrder);
    const allServices = await servicesQuery;
    const filteredServices = serviceCode
      ? allServices.filter((s) => s.serviceCode === serviceCode)
      : allServices;

    if (serviceCode && filteredServices.length === 0) {
      res.status(404).json({ error: `Service '${serviceCode}' not found` });
      return;
    }

    // Get all related data
    const instances = await db
      .select()
      .from(projectServiceInstances)
      .where(eq(projectServiceInstances.projectId, projectId));

    const allRequirements = await db.select().from(lifecycleRequirements).orderBy(lifecycleRequirements.sortOrder);
    const reqStatuses = await db
      .select()
      .from(projectRequirementStatus)
      .where(eq(projectRequirementStatus.projectId, projectId));

    const uploadedDocs = await db
      .select()
      .from(projectStageDocuments)
      .where(eq(projectStageDocuments.projectId, projectId));

    const fieldValues = await db
      .select()
      .from(projectStageFieldValues)
      .where(eq(projectStageFieldValues.projectId, projectId));

    const fieldDefs = await db.select().from(stageFieldDefinitions).orderBy(stageFieldDefinitions.sortOrder);

    // Build response
    const result = filteredServices.map((svc) => {
      const instance = instances.find((i) => i.serviceCode === svc.serviceCode);
      const svcReqs = allRequirements.filter((r) => r.serviceCode === svc.serviceCode);
      const svcReqStatuses = reqStatuses.filter((r) => r.serviceCode === svc.serviceCode);
      const svcDocs = uploadedDocs.filter((d) => d.serviceCode === svc.serviceCode);
      const svcFields = fieldDefs.filter((f) => f.serviceCode === svc.serviceCode);
      const svcFieldValues = fieldValues.filter((v) => v.serviceCode === svc.serviceCode);

      const docReqs = svcReqs.filter((r) => r.reqType === "document");
      const dataReqs = svcReqs.filter((r) => r.reqType === "data");

      const completedReqs = svcReqStatuses.filter((r) => r.status === "completed").length;
      const mandatoryTotal = svcReqs.filter((r) => r.isMandatory === 1).length;
      const mandatoryDone = svcReqs
        .filter((r) => r.isMandatory === 1)
        .filter((r) =>
          svcReqStatuses.find((s) => s.requirementCode === r.requirementCode && s.status === "completed")
        ).length;
      const mandatoryMissing = mandatoryTotal - mandatoryDone;

      const uploadedDocCount = docReqs.filter((r) =>
        svcDocs.find((d) => d.requirementCode === r.requirementCode)
      ).length;
      const missingMandatoryDocs = docReqs
        .filter((r) => r.isMandatory === 1)
        .filter((r) => !svcDocs.find((d) => d.requirementCode === r.requirementCode)).length;

      const filledFields = svcFieldValues.filter((v) => v.value && v.value.trim() !== "").length;
      const mandatoryFields = svcFields.filter((f) => f.isMandatory === 1).length;
      const filledMandatoryFields = svcFields
        .filter((f) => f.isMandatory === 1)
        .filter((f) => {
          const fv = svcFieldValues.find((v) => v.fieldKey === f.fieldKey);
          return fv?.value && fv.value.trim() !== "";
        }).length;

      const requirements = svcReqs.map((req) => {
        const rStatus = svcReqStatuses.find((s) => s.requirementCode === req.requirementCode);
        const doc = svcDocs.find((d) => d.requirementCode === req.requirementCode);
        return {
          requirementCode: req.requirementCode,
          nameAr: req.nameAr,
          nameEn: req.nameEn,
          reqType: req.reqType,
          isMandatory: req.isMandatory === 1,
          status: rStatus?.status ?? "not_started",
          hasDocument: !!doc,
          documentStatus: doc?.docStatus ?? null,
          documentFileName: doc?.fileName ?? null,
        };
      });

      const dataFields = svcFields.map((field) => {
        const fv = svcFieldValues.find((v) => v.fieldKey === field.fieldKey);
        return {
          fieldKey: field.fieldKey,
          labelAr: field.labelAr,
          labelEn: field.labelEn,
          source: field.source,
          requiredLevel: field.requiredLevel,
          stageGroup: field.stageGroup,
          isMandatory: field.isMandatory === 1,
          value: fv?.value ?? null,
          valueSource: fv?.valueSource ?? null,
          syncedAt: fv?.syncedAt ?? null,
          isFilled: !!(fv?.value && fv.value.trim() !== ""),
        };
      });

      return {
        serviceCode: svc.serviceCode,
        stageCode: svc.stageCode,
        nameAr: svc.nameAr,
        nameEn: svc.nameEn,
        operationalStatus: instance?.operationalStatus ?? "not_started",
        submittedAt: instance?.submittedAt ?? null,
        completedAt: instance?.completedAt ?? null,
        dueDate: instance?.dueDate ?? null,
        notes: instance?.notes ?? null,
        compliance: {
          totalRequirements: svcReqs.length,
          completedRequirements: completedReqs,
          mandatoryTotal,
          mandatoryDone,
          mandatoryMissing,
          isReadyToSubmit: mandatoryMissing === 0,
          documents: {
            total: docReqs.length,
            uploaded: uploadedDocCount,
            missingMandatory: missingMandatoryDocs,
          },
          dataFields: {
            total: svcFields.length,
            filled: filledFields,
            mandatoryTotal: mandatoryFields,
            mandatoryFilled: filledMandatoryFields,
            mandatoryMissing: mandatoryFields - filledMandatoryFields,
          },
        },
        requirements,
        dataFields,
      };
    });

    res.json({
      projectId,
      projectName: project.name,
      plotNumber: project.plotNumber,
      generatedAt: new Date().toISOString(),
      services: serviceCode ? result[0] : result,
    });
  } catch (err) {
    console.error("[LifecycleAPI] Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/lifecycle/project-summary
 * Returns full project lifecycle summary grouped by stage
 */
router.get("/project-summary", async (req, res) => {
  try {
    const projectId = parseInt(req.query.projectId as string);
    if (!projectId || isNaN(projectId)) {
      res.status(400).json({ error: "Missing or invalid projectId" });
      return;
    }

    const db = await getDb();
    if (!db) {
      res.status(500).json({ error: "DB unavailable" });
      return;
    }

    const projectRows = await db.select().from(projects).where(eq(projects.id, projectId));
    const project = projectRows[0];
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const stages = await db.select().from(lifecycleStages).orderBy(lifecycleStages.sortOrder);
    const stageStatuses = await db
      .select()
      .from(projectStageStatus)
      .where(eq(projectStageStatus.projectId, projectId));

    const allServices = await db.select().from(lifecycleServices).orderBy(lifecycleServices.sortOrder);
    const instances = await db
      .select()
      .from(projectServiceInstances)
      .where(eq(projectServiceInstances.projectId, projectId));

    const allRequirements = await db.select().from(lifecycleRequirements);
    const reqStatuses = await db
      .select()
      .from(projectRequirementStatus)
      .where(eq(projectRequirementStatus.projectId, projectId));

    const uploadedDocs = await db
      .select()
      .from(projectStageDocuments)
      .where(eq(projectStageDocuments.projectId, projectId));

    const fieldValues = await db
      .select()
      .from(projectStageFieldValues)
      .where(eq(projectStageFieldValues.projectId, projectId));

    const fieldDefs = await db.select().from(stageFieldDefinitions);

    const stagesSummary = stages.map((stage) => {
      const stageStatus = stageStatuses.find((s) => s.stageCode === stage.stageCode);
      const stageServices = allServices.filter((s) => s.stageCode === stage.stageCode);

      let totalReqs = 0, completedReqs = 0, mandatoryMissing = 0;
      let totalDocs = 0, uploadedDocsCount = 0;
      let totalFields = 0, filledFields = 0;

      const servicesInfo = stageServices.map((svc) => {
        const instance = instances.find((i) => i.serviceCode === svc.serviceCode);
        const svcReqs = allRequirements.filter((r) => r.serviceCode === svc.serviceCode);
        const svcReqStatuses = reqStatuses.filter((r) => r.serviceCode === svc.serviceCode);
        const svcDocs = uploadedDocs.filter((d) => d.serviceCode === svc.serviceCode);
        const svcFields = fieldDefs.filter((f) => f.serviceCode === svc.serviceCode);
        const svcFieldValues = fieldValues.filter((v) => v.serviceCode === svc.serviceCode);

        const docReqs = svcReqs.filter((r) => r.reqType === "document");
        const svcCompleted = svcReqStatuses.filter((r) => r.status === "completed").length;
        const svcMandatoryMissing = svcReqs
          .filter((r) => r.isMandatory === 1)
          .filter((r) => !svcReqStatuses.find((s) => s.requirementCode === r.requirementCode && s.status === "completed"))
          .length;
        const svcUploadedDocs = docReqs.filter((r) =>
          svcDocs.find((d) => d.requirementCode === r.requirementCode)
        ).length;
        const svcFilledFields = svcFieldValues.filter((v) => v.value && v.value.trim() !== "").length;

        totalReqs += svcReqs.length;
        completedReqs += svcCompleted;
        mandatoryMissing += svcMandatoryMissing;
        totalDocs += docReqs.length;
        uploadedDocsCount += svcUploadedDocs;
        totalFields += svcFields.length;
        filledFields += svcFilledFields;

        return {
          serviceCode: svc.serviceCode,
          nameAr: svc.nameAr,
          operationalStatus: instance?.operationalStatus ?? "not_started",
          mandatoryMissing: svcMandatoryMissing,
          isReadyToSubmit: svcMandatoryMissing === 0,
        };
      });

      return {
        stageCode: stage.stageCode,
        nameAr: stage.nameAr,
        status: stageStatus?.status ?? stage.defaultStatus ?? "not_started",
        services: servicesInfo,
        summary: {
          totalServices: stageServices.length,
          completedServices: servicesInfo.filter((s) => s.operationalStatus === "completed").length,
          totalRequirements: totalReqs,
          completedRequirements: completedReqs,
          mandatoryMissing,
          documents: { total: totalDocs, uploaded: uploadedDocsCount },
          dataFields: { total: totalFields, filled: filledFields },
        },
      };
    });

    const overallMandatoryMissing = stagesSummary.reduce((sum, s) => sum + s.summary.mandatoryMissing, 0);
    const overallCompletedServices = stagesSummary.reduce((sum, s) => sum + s.summary.completedServices, 0);
    const overallTotalServices = stagesSummary.reduce((sum, s) => sum + s.summary.totalServices, 0);

    res.json({
      projectId,
      projectName: project.name,
      plotNumber: project.plotNumber,
      generatedAt: new Date().toISOString(),
      overallStatus: {
        totalStages: stages.length,
        completedStages: stagesSummary.filter((s) => s.status === "completed").length,
        totalServices: overallTotalServices,
        completedServices: overallCompletedServices,
        overallMandatoryMissing,
        complianceScore: overallTotalServices > 0
          ? Math.round((overallCompletedServices / overallTotalServices) * 100)
          : 0,
      },
      stages: stagesSummary,
    });
  } catch (err) {
    console.error("[LifecycleAPI] Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
