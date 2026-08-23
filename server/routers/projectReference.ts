import { z } from "zod";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import {
  designsAndPermits,
  documentIndex,
  legalSetupRecords,
  marketDecisionApprovals,
  projectBaselines,
  projectChangeRequests,
  projectContracts,
  projectMarketEvidence,
  projectServiceInstances,
  projects,
} from "../../drizzle/schema";
import { getDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";

type ReferenceSeed = {
  project: Record<string, unknown>;
  officialDocuments: Array<{ sourceName: string; category: string | null; updatedAt: string; sourceType: string; sourceId: string | null; sourcePath: string | null }>;
  approvedMarketDecision?: { decidedAt: string; notes: string | null };
  verifiedEvidenceCount: number;
  plannedServices: number;
  legalRecord?: Record<string, unknown>;
  permitRecord?: Record<string, unknown>;
  activeContracts: Array<{ title: string; contractNumber: string | null; startDate: string | null }>;
  activeBaseline?: { id: number; approvedAt: string; notes: string | null };
};

type ReferenceStatus = "ready" | "partial" | "not_ready";

function hasValue(value: unknown) {
  return value !== null && value !== undefined && value !== "";
}

function statusFromChecks(checks: boolean[]): ReferenceStatus {
  const available = checks.filter(Boolean).length;
  if (available === checks.length && available > 0) return "ready";
  if (available > 0) return "partial";
  return "not_ready";
}

function getDriveDocumentUrl(document: ReferenceSeed["officialDocuments"][number]) {
  if (document.sourceType !== "google_drive") return undefined;
  if (document.sourcePath?.startsWith("https://")) return document.sourcePath;
  return document.sourceId ? `https://drive.google.com/open?id=${document.sourceId}` : undefined;
}

function getDocumentGate(category: string | null) {
  if (category === "official_land_document") return { id: "facts", label: "حقائق الأرض والوثائق" };
  if (category === "proposal") return { id: "appointment", label: "حزمة التكليف والعروض" };
  if (category === "contract") return { id: "baseline", label: "العقد وخط الأساس" };
  return { id: "reference", label: "مرجع المشروع العام" };
}

export function buildProjectReference(seed: ReferenceSeed) {
  const project = seed.project;
  const factsChecks = [
    hasValue(project.plotNumber),
    hasValue(project.titleDeedNumber) || hasValue(project.ddaNumber),
    hasValue(project.permittedUse),
    hasValue(project.gfaSqft) || hasValue(project.manualBuaSqft) || hasValue(project.bua),
    hasValue(project.driveFolderId),
  ];
  const factsStatus = statusFromChecks(factsChecks);
  const marketReady = Boolean(seed.approvedMarketDecision) && seed.verifiedEvidenceCount > 0;
  const programReady = seed.plannedServices > 0;
  const legalReady = Boolean(seed.legalRecord) && [
    seed.legalRecord?.titleDeedStatus,
    seed.legalRecord?.ddaRegistrationStatus,
    seed.legalRecord?.municipalityApprovalStatus,
  ].some(hasValue);
  const permitReady = Boolean(seed.permitRecord) && [
    seed.permitRecord?.architecturalDesignStatus,
    seed.permitRecord?.engineeringDesignStatus,
    seed.permitRecord?.buildingPermitStatus,
    seed.permitRecord?.municipalityDesignApprovalStatus,
  ].some(hasValue);
  const contractReady = seed.activeContracts.length > 0;
  const officialDocCount = seed.officialDocuments.length;
  const hasReferencePack = factsStatus === "ready" && officialDocCount > 0 && marketReady && programReady;
  const baselineStatus = seed.activeBaseline ? "active" : contractReady && hasReferencePack ? "ready_to_confirm" : hasReferencePack ? "waiting_for_appointment" : "preparing";

  const sourceCards = [
    { id: "facts", title: "بطاقة المشروع", status: factsStatus, detail: `${factsChecks.filter(Boolean).length} من ${factsChecks.length} حقائق تأسيسية متاحة`, source: "بطاقة المشروع وخازن", href: `/project/${project.id}` },
    { id: "documents", title: "الوثائق الرسمية", status: officialDocCount > 0 ? "ready" : "not_ready" as ReferenceStatus, detail: officialDocCount > 0 ? `${officialDocCount} مستند رسمي مفهرس من المصدر المعتمد` : "لا يوجد مستند رسمي مفهرس للمشروع بعد", source: "Google Drive وفهرس خازن", href: "/drive" },
    { id: "market", title: "قرار السوق", status: marketReady ? "ready" : seed.verifiedEvidenceCount > 0 ? "partial" : "not_ready" as ReferenceStatus, detail: marketReady ? `قرار معتمد مع ${seed.verifiedEvidenceCount} دليل موثق` : `${seed.verifiedEvidenceCount} دليل موثق · قرار السوق لم يعتمد بعد`, source: "المعرفة والتحليل", href: "/knowledge-analysis" },
    { id: "program", title: "البرنامج والمسار", status: programReady ? "ready" : "not_ready" as ReferenceStatus, detail: programReady ? `${seed.plannedServices} خدمة لها موعد مخطط` : "لا توجد خدمات بموعد مخطط بعد", source: "جولة مراحل التطوير", href: "/development-phases" },
    { id: "legal", title: "المرجعية القانونية", status: legalReady ? "ready" : Boolean(seed.legalRecord) ? "partial" : "not_ready" as ReferenceStatus, detail: legalReady ? "سجل قانوني موجود مع حالة مرجعية" : "السجل القانوني يحتاج استكمالًا أو توثيقًا", source: "الإعداد القانوني", href: "/development-phases" },
    { id: "permits", title: "التصاميم والتصاريح", status: permitReady ? "ready" : Boolean(seed.permitRecord) ? "partial" : "not_ready" as ReferenceStatus, detail: permitReady ? "سجل التصميم أو التصاريح متاح للمراجعة" : "لا توجد حالة تصميم أو تصريح موثقة بعد", source: "التصاميم والتصاريح", href: "/development-phases" },
  ];

  return {
    readOnly: true,
    project: { id: project.id, name: project.name, financingScenario: project.financingScenario ?? null },
    driveFolder: hasValue(project.driveFolderId) ? { configured: true, url: `https://drive.google.com/drive/folders/${project.driveFolderId}` } : { configured: false, url: null },
    sources: sourceCards,
    officialDocuments: seed.officialDocuments.slice(0, 5).map((document) => ({ ...document, driveUrl: getDriveDocumentUrl(document), gate: getDocumentGate(document.category) })),
    baseline: {
      status: baselineStatus,
      statusLabel: seed.activeBaseline ? "خط أساس معتمد" : contractReady && hasReferencePack ? "جاهز لتثبيت خط الأساس" : hasReferencePack ? "بانتظار التعيين" : "قيد الإعداد",
      detail: seed.activeBaseline ? `ثبت خط الأساس في ${seed.activeBaseline.approvedAt}، وأي تغيير لاحق يجب أن يشير إليه صراحة.` : contractReady && hasReferencePack ? "تتوفر مراجع المشروع والقرار السوقي والبرنامج وعقد نشط؛ يمكن تثبيت خط أساس عند بدء التنفيذ." : hasReferencePack ? "المراجع الجوهرية جاهزة، لكن لا يوجد عقد نشط بعد لتثبيت خط أساس تنفيذي." : "لا يزال المشروع في مرحلة التحضير؛ يعرض هذا المرجع ما يجب أن يكتمل قبل خط الأساس.",
      checks: [
        { label: "حقائق المشروع والوثائق", present: factsStatus === "ready" && officialDocCount > 0 },
        { label: "قرار السوق المعتمد", present: marketReady },
        { label: "برنامج أولي مؤرخ", present: programReady },
        { label: "عقد أو تكليف نشط", present: contractReady },
      ],
      activeContracts: seed.activeContracts,
      activeBaseline: seed.activeBaseline ?? null,
    },
    changeControl: {
      state: seed.activeBaseline ? "active" : "prepared_only",
      title: "قرار التغيير",
      detail: seed.activeBaseline ? "يمكن تسجيل طلب تغيير مرتبط بخط الأساس المعتمد. لا يغير الطلب الكلفة أو البرنامج أو التدفقات تلقائيًا." : "لن يُفعّل طلب تغيير أو يكتب في الكلفة أو البرنامج أو التدفقات قبل تثبيت خط أساس معتمد وبدء المشروع فعليًا.",
      activationRule: seed.activeBaseline ? "يحتاج كل طلب تغيير إلى قرار صريح قبل أن يصبح معتمدًا." : "يتاح بعد تثبيت خط أساس تنفيذي معتمد فقط.",
      template: ["السبب والوثيقة المرجعية", "الأثر على النطاق والبرنامج والكلفة والتدفقات", "القرار المطلوب والاعتماد"],
    },
  };
}

async function loadReferenceSeed(db: any, projectId: number): Promise<ReferenceSeed> {
  const [projectRows, documentRows, decisionRows, evidenceRows, serviceRows, legalRows, permitRows, contractRows, baselineRows] = await Promise.all([
    db.select().from(projects).where(eq(projects.id, projectId)).limit(1),
    db.select({ sourceName: documentIndex.sourceName, category: documentIndex.category, updatedAt: documentIndex.updatedAt, sourceType: documentIndex.sourceType, sourceId: documentIndex.sourceId, sourcePath: documentIndex.sourcePath }).from(documentIndex).where(and(eq(documentIndex.projectId, projectId), eq(documentIndex.indexStatus, "indexed"))).orderBy(desc(documentIndex.updatedAt)),
    db.select({ decidedAt: marketDecisionApprovals.decidedAt, notes: marketDecisionApprovals.notes }).from(marketDecisionApprovals).where(and(eq(marketDecisionApprovals.projectId, projectId), eq(marketDecisionApprovals.decisionStatus, "approved"))).orderBy(desc(marketDecisionApprovals.decidedAt)).limit(1),
    db.select({ id: projectMarketEvidence.id }).from(projectMarketEvidence).where(and(eq(projectMarketEvidence.projectId, projectId), eq(projectMarketEvidence.verificationStatus, "verified"))),
    db.select({ id: projectServiceInstances.id }).from(projectServiceInstances).where(and(eq(projectServiceInstances.projectId, projectId), isNotNull(projectServiceInstances.plannedDueDate))),
    db.select().from(legalSetupRecords).where(eq(legalSetupRecords.projectId, projectId)).orderBy(desc(legalSetupRecords.updatedAt)).limit(1),
    db.select().from(designsAndPermits).where(eq(designsAndPermits.projectId, projectId)).orderBy(desc(designsAndPermits.updatedAt)).limit(1),
    db.select({ title: projectContracts.title, contractNumber: projectContracts.contractNumber, startDate: projectContracts.startDate }).from(projectContracts).where(and(eq(projectContracts.projectId, projectId), eq(projectContracts.contractStatus, "active"))),
    db.select({ id: projectBaselines.id, approvedAt: projectBaselines.approvedAt, notes: projectBaselines.notes }).from(projectBaselines).where(and(eq(projectBaselines.projectId, projectId), eq(projectBaselines.status, "active"))).orderBy(desc(projectBaselines.approvedAt)).limit(1),
  ]);
  const project = projectRows[0];
  if (!project) throw new Error("لم يُعثر على المشروع المطلوب");
  return { project, officialDocuments: documentRows, approvedMarketDecision: decisionRows[0], verifiedEvidenceCount: evidenceRows.length, plannedServices: serviceRows.length, legalRecord: legalRows[0], permitRecord: permitRows[0], activeContracts: contractRows, activeBaseline: baselineRows[0] };
}

export const projectReferenceRouter = router({
  get: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("قاعدة البيانات غير متاحة");
    return buildProjectReference(await loadReferenceSeed(db, input.projectId));
  }),
  approveBaseline: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), notes: z.string().max(3000).optional() })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("قاعدة البيانات غير متاحة");
    const reference = buildProjectReference(await loadReferenceSeed(db, input.projectId));
    if (reference.baseline.status !== "ready_to_confirm") throw new Error("لا يمكن اعتماد خط الأساس قبل اكتمال المصادر وعقد نشط.");
    const snapshot = JSON.stringify({ project: reference.project, sources: reference.sources, documents: reference.officialDocuments, activeContracts: reference.baseline.activeContracts, createdFrom: "project_reference" });
    const result = await db.insert(projectBaselines).values({ projectId: input.projectId, approvedByUserId: ctx.user.id, sourceSnapshotJson: snapshot, notes: input.notes ?? null });
    return { id: Number(result[0].insertId) };
  }),
  getChangeRequests: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("قاعدة البيانات غير متاحة");
    return db.select().from(projectChangeRequests).where(eq(projectChangeRequests.projectId, input.projectId)).orderBy(desc(projectChangeRequests.updatedAt));
  }),
  createChangeRequest: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), title: z.string().min(3).max(500), reason: z.string().min(5).max(5000), referenceUrl: z.string().url().optional().or(z.literal("")), scopeImpact: z.string().max(3000).optional(), scheduleImpact: z.string().max(3000).optional(), costImpact: z.string().max(3000).optional(), cashFlowImpact: z.string().max(3000).optional() })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("قاعدة البيانات غير متاحة");
    const [baseline] = await db.select({ id: projectBaselines.id }).from(projectBaselines).where(and(eq(projectBaselines.projectId, input.projectId), eq(projectBaselines.status, "active"))).orderBy(desc(projectBaselines.approvedAt)).limit(1);
    if (!baseline) throw new Error("لا يمكن إنشاء طلب تغيير قبل اعتماد خط أساس للمشروع.");
    const result = await db.insert(projectChangeRequests).values({ projectId: input.projectId, baselineId: baseline.id, createdByUserId: ctx.user.id, title: input.title, reason: input.reason, referenceUrl: input.referenceUrl || null, scopeImpact: input.scopeImpact ?? null, scheduleImpact: input.scheduleImpact ?? null, costImpact: input.costImpact ?? null, cashFlowImpact: input.cashFlowImpact ?? null });
    return { id: Number(result[0].insertId) };
  }),
  approveChangeRequest: protectedProcedure.input(z.object({ changeRequestId: z.number().int().positive(), decisionNotes: z.string().max(3000).optional() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("قاعدة البيانات غير متاحة");
    await db.update(projectChangeRequests).set({ decisionStatus: "approved", decisionNotes: input.decisionNotes ?? null, decidedAt: new Date().toISOString().slice(0, 19).replace("T", " ") }).where(eq(projectChangeRequests.id, input.changeRequestId));
    return { success: true };
  }),
});
