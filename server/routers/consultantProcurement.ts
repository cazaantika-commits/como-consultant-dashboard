import { z } from "zod";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import {
  consultantRfpDrafts,
  contractDeliverables,
  cpaProjects,
  marketDecisionApprovals,
  projectContracts,
  projectMarketEvidence,
  projectMarketSearchProfiles,
  projects,
  projectServiceInstances,
} from "../../drizzle/schema";
import { getDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";

export function deriveAppointmentReview(input: {
  projectExists: boolean;
  factsReady: boolean;
  marketProfileReady: boolean;
  verifiedEvidenceCount: number;
  approvedDecision: boolean;
  plannedServices: number;
  scopeReady: boolean;
}) {
  const items = [
    { key: "project_facts", label: "حقائق المشروع والوثائق المرجعية", source: "بطاقة المشروع وخازن", complete: input.projectExists && input.factsReady, action: "استكمل حقائق الأرض والاستخدام والمساحة في بطاقة المشروع." },
    { key: "market", label: "مرجع السوق وقرار المنتج", source: "المعرفة والتحليل", complete: input.marketProfileReady && input.verifiedEvidenceCount > 0 && input.approvedDecision, action: "احفظ فلترة السوق، وثّق دليلًا متوافقًا، ثم اعتمد قرار السوق." },
    { key: "program", label: "البرنامج الأولي", source: "جولة مراحل التطوير", complete: input.plannedServices > 0, action: "ضع مواعيد أولية للخدمات الرئيسية في جولة مراحل التطوير." },
    { key: "scope", label: "نطاق التكليف المطلوب", source: "مصفوفة نطاق الاستشاري", complete: input.scopeReady, action: "حدد فئة المشروع ونطاقه في مصفوفة الاستشاري قبل طلب العروض." },
  ];
  return { items, complete: items.every((item) => item.complete) };
}

async function loadAppointmentReview(projectId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة");
  const [projectRows, profileRows, evidenceRows, decisionRows, serviceRows, cpaProjectRows] = await Promise.all([
    db.select().from(projects).where(eq(projects.id, projectId)).limit(1),
    db.select().from(projectMarketSearchProfiles).where(eq(projectMarketSearchProfiles.projectId, projectId)).limit(1),
    db.select({ id: projectMarketEvidence.id }).from(projectMarketEvidence).where(and(eq(projectMarketEvidence.projectId, projectId), eq(projectMarketEvidence.verificationStatus, "verified"))),
    db.select({ id: marketDecisionApprovals.id }).from(marketDecisionApprovals).where(and(eq(marketDecisionApprovals.projectId, projectId), eq(marketDecisionApprovals.decisionStatus, "approved"))).limit(1),
    db.select({ id: projectServiceInstances.id }).from(projectServiceInstances).where(and(eq(projectServiceInstances.projectId, projectId), isNotNull(projectServiceInstances.plannedDueDate))),
    db.select({ id: cpaProjects.id, buildingCategoryId: cpaProjects.buildingCategoryId }).from(cpaProjects).where(eq(cpaProjects.projectId, projectId)).limit(1),
  ]);
  const project = projectRows[0];
  const factsReady = Boolean(project?.plotNumber && project?.permittedUse && (project?.gfaSqft || project?.manualBuaSqft || project?.bua));
  const review = deriveAppointmentReview({
    projectExists: Boolean(project),
    factsReady,
    marketProfileReady: Boolean(profileRows[0]),
    verifiedEvidenceCount: evidenceRows.length,
    approvedDecision: Boolean(decisionRows[0]),
    plannedServices: serviceRows.length,
    scopeReady: Boolean(cpaProjectRows[0]?.buildingCategoryId),
  });
  return { db, project, review, evidenceCount: evidenceRows.length, plannedServices: serviceRows.length, approvedDecisionId: decisionRows[0]?.id ?? null };
}

export const consultantProcurementRouter = router({
  getPackReview: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).query(async ({ input }) => {
    const result = await loadAppointmentReview(input.projectId);
    if (!result.project) throw new Error("لم يُعثر على المشروع المطلوب");
    return result.review;
  }),

  listRfpDrafts: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("قاعدة البيانات غير متاحة");
    return db.select().from(consultantRfpDrafts).where(eq(consultantRfpDrafts.projectId, input.projectId)).orderBy(desc(consultantRfpDrafts.createdAt));
  }),

  createRfpDraft: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), notes: z.string().max(4000).optional() })).mutation(async ({ ctx, input }) => {
    const result = await loadAppointmentReview(input.projectId);
    if (!result.project) throw new Error("لم يُعثر على المشروع المطلوب");
    if (!result.review.complete) throw new Error("لا يمكن إنشاء مسودة طلب عروض قبل اكتمال قائمة مراجعة حزمة التكليف.");
    const snapshot = {
      generatedAt: new Date().toISOString(),
      project: { id: result.project.id, name: result.project.name, plotNumber: result.project.plotNumber, permittedUse: result.project.permittedUse },
      review: result.review,
      evidenceCount: result.evidenceCount,
      plannedServices: result.plannedServices,
      approvedDecisionId: result.approvedDecisionId,
    };
    const insertResult = await result.db.insert(consultantRfpDrafts).values({
      projectId: input.projectId,
      userId: ctx.user.id,
      title: `مسودة طلب عروض استشاري — ${result.project.name}`,
      status: "draft",
      packSnapshotJson: JSON.stringify(snapshot),
      notes: input.notes?.trim() || null,
    });
    return { success: true, id: Number(insertResult[0].insertId), status: "draft" as const, message: "أنشئت مسودة داخلية فقط؛ لم يُرسل أي طلب إلى أي مكتب." };
  }),

  listContracts: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("قاعدة البيانات غير متاحة");
    return db.select({ id: projectContracts.id, title: projectContracts.title, contractNumber: projectContracts.contractNumber, contractStatus: projectContracts.contractStatus, partyB: projectContracts.partyB }).from(projectContracts).where(eq(projectContracts.projectId, input.projectId)).orderBy(desc(projectContracts.createdAt));
  }),

  listDeliverables: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), contractId: z.number().int().positive() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("قاعدة البيانات غير متاحة");
    return db.select().from(contractDeliverables).where(and(eq(contractDeliverables.projectId, input.projectId), eq(contractDeliverables.contractId, input.contractId))).orderBy(contractDeliverables.dueDate, contractDeliverables.createdAt);
  }),

  addDeliverable: protectedProcedure.input(z.object({
    projectId: z.number().int().positive(), contractId: z.number().int().positive(), title: z.string().min(2).max(500), description: z.string().max(5000).optional(), acceptanceCriteria: z.string().max(5000).optional(), dueDate: z.string().max(50).optional(), referenceUrl: z.string().url().max(1000).optional(), ownerNotes: z.string().max(5000).optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("قاعدة البيانات غير متاحة");
    const [contract] = await db.select({ id: projectContracts.id }).from(projectContracts).where(and(eq(projectContracts.id, input.contractId), eq(projectContracts.projectId, input.projectId))).limit(1);
    if (!contract) throw new Error("العقد المختار لا يرتبط بالمشروع المحدد.");
    const result = await db.insert(contractDeliverables).values({
      projectId: input.projectId, contractId: input.contractId, createdByUserId: ctx.user.id, title: input.title.trim(), description: input.description?.trim() || null, acceptanceCriteria: input.acceptanceCriteria?.trim() || null, dueDate: input.dueDate?.trim() || null, referenceUrl: input.referenceUrl?.trim() || null, ownerNotes: input.ownerNotes?.trim() || null,
    });
    return { success: true, id: Number(result[0].insertId) };
  }),

  updateDeliverableStatus: protectedProcedure.input(z.object({ id: z.number().int().positive(), status: z.enum(["not_started", "submitted", "accepted", "returned", "overdue"]) })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("قاعدة البيانات غير متاحة");
    await db.update(contractDeliverables).set({ status: input.status }).where(eq(contractDeliverables.id, input.id));
    return { success: true };
  }),
});
