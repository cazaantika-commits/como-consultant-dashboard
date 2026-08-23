import { z } from "zod";
import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import {
  cpaBuildinCategories,
  cpaProjects,
  cpaScopeCategoryMatrix,
  cpaScopeItems,
  cpaScopeSections,
  lifecycleStages,
  marketDecisionApprovals,
  projectMarketEvidence,
  projectMarketSearchProfiles,
  projectServiceInstances,
  projects,
} from "../../drizzle/schema";
import { getDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";

type AppointmentPackSeed = {
  project: Record<string, unknown>;
  marketProfile?: Record<string, unknown>;
  verifiedEvidenceCount: number;
  approvedDecision?: { decidedAt: string; notes: string | null };
  activeLifecycleStages: number;
  plannedServices: number;
  buildingCategory?: { label: string; description: string | null };
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
      marketReady: Boolean(profile) && seed.verifiedEvidenceCount > 0 && Boolean(seed.approvedDecision),
      programReady: seed.activeLifecycleStages > 0 && seed.plannedServices > 0,
      scopeReady: Boolean(seed.buildingCategory) && scopeCount > 0,
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
        approved: Boolean(seed.approvedDecision),
        approvedAt: seed.approvedDecision?.decidedAt ?? null,
        note: seed.approvedDecision?.notes ?? null,
      },
      program: {
        activeLifecycleStages: seed.activeLifecycleStages,
        plannedServices: seed.plannedServices,
      },
      scope: {
        category: seed.buildingCategory?.label ?? null,
        categoryDescription: seed.buildingCategory?.description ?? null,
        itemCount: scopeCount,
        sections: seed.scopeSections,
      },
    },
  };
}

export const consultantAppointmentPackRouter = router({
  get: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("قاعدة البيانات غير متاحة");

      const [projectRows, profileRows, evidenceRows, decisionRows, stageRows, serviceRows, cpaProjectRows] = await Promise.all([
        db.select().from(projects).where(eq(projects.id, input.projectId)).limit(1),
        db.select().from(projectMarketSearchProfiles).where(eq(projectMarketSearchProfiles.projectId, input.projectId)).limit(1),
        db.select({ id: projectMarketEvidence.id }).from(projectMarketEvidence).where(and(eq(projectMarketEvidence.projectId, input.projectId), eq(projectMarketEvidence.verificationStatus, "verified"))),
        db.select({ decidedAt: marketDecisionApprovals.decidedAt, notes: marketDecisionApprovals.notes }).from(marketDecisionApprovals).where(and(eq(marketDecisionApprovals.projectId, input.projectId), eq(marketDecisionApprovals.decisionStatus, "approved"))).orderBy(desc(marketDecisionApprovals.decidedAt)).limit(1),
        db.select({ id: lifecycleStages.id }).from(lifecycleStages).where(eq(lifecycleStages.isActive, 1)),
        db.select({ id: projectServiceInstances.id }).from(projectServiceInstances).where(and(eq(projectServiceInstances.projectId, input.projectId), isNotNull(projectServiceInstances.plannedDueDate))),
        db.select().from(cpaProjects).where(eq(cpaProjects.projectId, input.projectId)).limit(1),
      ]);

      const project = projectRows[0];
      if (!project) throw new Error("لم يُعثر على المشروع المطلوب");
      const cpaProject = cpaProjectRows[0];
      const categoryRows = cpaProject?.buildingCategoryId
        ? await db.select().from(cpaBuildinCategories).where(eq(cpaBuildinCategories.id, cpaProject.buildingCategoryId)).limit(1)
        : [];
      const matrixRows = cpaProject?.buildingCategoryId
        ? await db.select().from(cpaScopeCategoryMatrix).where(eq(cpaScopeCategoryMatrix.buildingCategoryId, cpaProject.buildingCategoryId))
        : [];
      const scopeIds = matrixRows.filter((row) => row.status !== "NOT_REQUIRED").map((row) => row.scopeItemId);
      const [scopeItems, sectionRows] = await Promise.all([
        scopeIds.length > 0
          ? db.select().from(cpaScopeItems).where(and(eq(cpaScopeItems.isActive, 1), inArray(cpaScopeItems.id, scopeIds))).orderBy(cpaScopeItems.sortOrder)
          : Promise.resolve([]),
        db.select().from(cpaScopeSections).where(eq(cpaScopeSections.isActive, 1)).orderBy(cpaScopeSections.sortOrder),
      ]);
      const matrixByItem = new Map(matrixRows.map((row) => [row.scopeItemId, row.status]));
      const scopeSections = sectionRows.map((section) => ({
        label: section.label,
        items: scopeItems.filter((item) => item.sectionId === section.id).map((item) => ({ label: item.label, status: matrixByItem.get(item.id) ?? "INCLUDED" })),
      })).filter((section) => section.items.length > 0);

      return buildConsultantAppointmentPack({
        project,
        marketProfile: profileRows[0],
        verifiedEvidenceCount: evidenceRows.length,
        approvedDecision: decisionRows[0],
        activeLifecycleStages: stageRows.length,
        plannedServices: serviceRows.length,
        buildingCategory: categoryRows[0],
        scopeSections,
      });
    }),
});
