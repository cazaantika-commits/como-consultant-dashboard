import { z } from "zod";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import {
  lifecycleStages,
  projectConsultantRequirements,
  projectConsultantRequirementSets,
  projectServiceInstances,
  projects,
} from "../../drizzle/schema";
import { getDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";
import { requireProjectAccess } from "../services/comoNextCommands";
import { loadMarketDecisionState } from "../services/comoNextMarketDecision";

type AppointmentPackSeed = {
	project: Record<string, unknown>;
	marketProfile?: Record<string, unknown>;
	verifiedEvidenceCount: number;
	approvedDecision?: { id: number; decidedAt: string; notes: string | null; isValid: boolean; status: string; reason: string };
  activeLifecycleStages: number;
  plannedServices: number;
  scopeSections: Array<{ label: string; items: Array<{ label: string; status: string }> }>;
};

const transactionLabels: Record<string, string> = { sale: "بيع", rent: "إيجار" };
const productLabels: Record<string, string> = {
  apartment: "شقق", villa: "فلل", townhouse: "تاون هاوس", plot: "أراضٍ",
  retail_unit: "محلات", office_unit: "مكاتب", mixed_use_unit: "وحدات متعددة الاستخدام", other: "أخرى",
};
const developmentLabels: Record<string, string> = { offplan: "أوف بلان", ready: "جاهز", any: "أي حالة" };

export function buildConsultantAppointmentPack(seed: AppointmentPackSeed) {
  const area = seed.project.gfaSqft || seed.project.manualBuaSqft || seed.project.bua;
  const profile = seed.marketProfile;
  const marketSearch = profile ? [
    transactionLabels[String(profile.transactionPurpose)] ?? "معاملة سوقية",
    productLabels[String(profile.productForm)] ?? "نوع منتج غير محدد",
    String(profile.primaryCommunity ?? "منطقة غير محددة"),
    developmentLabels[String(profile.developmentStatus)] ?? "",
  ].filter(Boolean).join(" · ") : null;
  const scopeCount = seed.scopeSections.reduce((total, section) => total + section.items.length, 0);

  return {
    readOnly: true,
    project: {
      id: seed.project.id,
      name: seed.project.name,
      plotNumber: seed.project.plotNumber ?? null,
      permittedUse: seed.project.permittedUse ?? null,
      area: area ?? null,
      documentFolderAvailable: Boolean(seed.project.driveFolderId),
    },
		readiness: {
			marketReady: Boolean(profile) && seed.verifiedEvidenceCount > 0 && Boolean(seed.approvedDecision?.isValid),
      programReady: seed.activeLifecycleStages > 0 && seed.plannedServices > 0,
      scopeReady: scopeCount > 0,
    },
    sections: {
      projectBrief: [
        { label: "رقم الأرض", value: seed.project.plotNumber || "غير موثق بعد" },
        { label: "الاستخدام المسموح", value: seed.project.permittedUse || "غير موثق بعد" },
        { label: "المساحة المرجعية", value: area ? `${Number(area).toLocaleString("en-US")} قدم²` : "غير موثقة بعد" },
        { label: "مجلد الوثائق", value: seed.project.driveFolderId ? "متاح في المصدر المعتمد" : "غير مربوط بعد" },
      ],
		market: {
			search: marketSearch,
			verifiedEvidenceCount: seed.verifiedEvidenceCount,
			approved: Boolean(seed.approvedDecision?.isValid),
			decisionId: seed.approvedDecision?.id ?? null,
			status: seed.approvedDecision?.status ?? "no_approved_decision",
			reason: seed.approvedDecision?.reason ?? "لا يوجد قرار سوق ساري.",
        approvedAt: seed.approvedDecision?.decidedAt ?? null,
        note: seed.approvedDecision?.notes ?? null,
      },
      program: {
        activeLifecycleStages: seed.activeLifecycleStages,
        plannedServices: seed.plannedServices,
      },
      scope: {
        source: "نطاق مستقل خاص بالمشروع",
        itemCount: scopeCount,
        sections: seed.scopeSections,
      },
    },
  };
}

export const consultantAppointmentPackRouter = router({
  get: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive() }))
		.query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("قاعدة البيانات غير متاحة");
			await requireProjectAccess(db, input.projectId, ctx.user.id, "read");

			const [projectRows, marketDecision, stageRows, serviceRows, draftRequirementSetRows] = await Promise.all([
        db.select().from(projects).where(eq(projects.id, input.projectId)).limit(1),
				loadMarketDecisionState(db, input.projectId),
        db.select({ id: lifecycleStages.id }).from(lifecycleStages).where(eq(lifecycleStages.isActive, 1)),
        db.select({ id: projectServiceInstances.id }).from(projectServiceInstances).where(and(eq(projectServiceInstances.projectId, input.projectId), isNotNull(projectServiceInstances.plannedDueDate))),
        db.select({ id: projectConsultantRequirementSets.id })
          .from(projectConsultantRequirementSets)
          .where(and(eq(projectConsultantRequirementSets.projectId, input.projectId), eq(projectConsultantRequirementSets.status, "DRAFT")))
          .orderBy(desc(projectConsultantRequirementSets.revisionNo))
          .limit(1),
      ]);

      const project = projectRows[0];
      if (!project) throw new Error("لم يُعثر على المشروع المطلوب");
      let requirementSetId = draftRequirementSetRows[0]?.id;
      if (!requirementSetId) {
        const approvedRows = await db.select({ id: projectConsultantRequirementSets.id })
          .from(projectConsultantRequirementSets)
          .where(and(eq(projectConsultantRequirementSets.projectId, input.projectId), eq(projectConsultantRequirementSets.status, "APPROVED")))
          .orderBy(desc(projectConsultantRequirementSets.revisionNo))
          .limit(1);
        requirementSetId = approvedRows[0]?.id;
      }
      const selectedRequirements = requirementSetId
        ? await db.select({
            label: projectConsultantRequirements.label,
            workstream: projectConsultantRequirements.workstream,
            requirementGroup: projectConsultantRequirements.requirementGroup,
          })
          .from(projectConsultantRequirements)
          .where(and(eq(projectConsultantRequirements.requirementSetId, requirementSetId), eq(projectConsultantRequirements.isRequired, 1)))
          .orderBy(projectConsultantRequirements.workstream, projectConsultantRequirements.requirementGroup, projectConsultantRequirements.sortOrder)
        : [];
      const sectionMap = new Map<string, Array<{ label: string; status: string }>>();
      for (const requirement of selectedRequirements) {
        const streamLabel = requirement.workstream === "SUPERVISION" ? "الإشراف" : "التصميم والخدمات الاستشارية";
        const sectionLabel = `${streamLabel} — ${requirement.requirementGroup}`;
        const items = sectionMap.get(sectionLabel) ?? [];
        items.push({ label: requirement.label, status: "REQUIRED" });
        sectionMap.set(sectionLabel, items);
      }
      const scopeSections = Array.from(sectionMap, ([label, items]) => ({ label, items }));

      return buildConsultantAppointmentPack({
        project,
				marketProfile: marketDecision.source.profile,
				verifiedEvidenceCount: marketDecision.verifiedEvidenceCount,
				approvedDecision: marketDecision.latestApproved ? { ...marketDecision.latestApproved, isValid: marketDecision.isValid, status: marketDecision.status, reason: marketDecision.reason } : undefined,
        activeLifecycleStages: stageRows.length,
        plannedServices: serviceRows.length,
        scopeSections,
      });
    }),
});
