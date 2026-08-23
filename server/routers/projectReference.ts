import { and, desc, eq, isNotNull } from "drizzle-orm";
import { z } from "zod";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import {
  designsAndPermits,
  documentIndex,
  legalSetupRecords,
  marketDecisionApprovals,
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

  const sourceCards = [
    {
      id: "facts",
      title: "بطاقة المشروع",
      status: factsStatus,
      detail: `${factsChecks.filter(Boolean).length} من ${factsChecks.length} حقائق تأسيسية متاحة`,
      source: "بطاقة المشروع وخازن",
      href: `/project/${project.id}`,
    },
    {
      id: "documents",
      title: "الوثائق الرسمية",
      status: officialDocCount > 0 ? "ready" : "not_ready" as ReferenceStatus,
      detail: officialDocCount > 0 ? `${officialDocCount} مستند رسمي مفهرس من المصدر المعتمد` : "لا يوجد مستند رسمي مفهرس للمشروع بعد",
      source: "Google Drive وفهرس خازن",
      href: "/drive",
    },
    {
      id: "market",
      title: "قرار السوق",
      status: marketReady ? "ready" : seed.verifiedEvidenceCount > 0 ? "partial" : "not_ready" as ReferenceStatus,
      detail: marketReady ? `قرار معتمد مع ${seed.verifiedEvidenceCount} دليل موثق` : `${seed.verifiedEvidenceCount} دليل موثق · قرار السوق لم يعتمد بعد`,
      source: "المعرفة والتحليل",
      href: "/knowledge-analysis",
    },
    {
      id: "program",
      title: "البرنامج والمسار",
      status: programReady ? "ready" : "not_ready" as ReferenceStatus,
      detail: programReady ? `${seed.plannedServices} خدمة لها موعد مخطط` : "لا توجد خدمات بموعد مخطط بعد",
      source: "جولة مراحل التطوير",
      href: "/development-phases",
    },
    {
      id: "legal",
      title: "المرجعية القانونية",
      status: legalReady ? "ready" : Boolean(seed.legalRecord) ? "partial" : "not_ready" as ReferenceStatus,
      detail: legalReady ? "سجل قانوني موجود مع حالة مرجعية" : "السجل القانوني يحتاج استكمالًا أو توثيقًا",
      source: "الإعداد القانوني",
      href: "/development-phases",
    },
    {
      id: "permits",
      title: "التصاميم والتصاريح",
      status: permitReady ? "ready" : Boolean(seed.permitRecord) ? "partial" : "not_ready" as ReferenceStatus,
      detail: permitReady ? "سجل التصميم أو التصاريح متاح للمراجعة" : "لا توجد حالة تصميم أو تصريح موثقة بعد",
      source: "التصاميم والتصاريح",
      href: "/development-phases",
    },
  ];

  return {
    readOnly: true,
    project: { id: project.id, name: project.name, financingScenario: project.financingScenario ?? null },
    driveFolder: hasValue(project.driveFolderId)
      ? { configured: true, url: `https://drive.google.com/drive/folders/${project.driveFolderId}` }
      : { configured: false, url: null },
    sources: sourceCards,
    officialDocuments: seed.officialDocuments.slice(0, 5).map((document) => ({
      ...document,
      driveUrl: getDriveDocumentUrl(document),
    })),
    baseline: {
      status: contractReady && hasReferencePack ? "ready_to_confirm" : hasReferencePack ? "waiting_for_appointment" : "preparing",
      statusLabel: contractReady && hasReferencePack ? "جاهز لتثبيت خط الأساس" : hasReferencePack ? "بانتظار التعيين" : "قيد الإعداد",
      detail: contractReady && hasReferencePack
        ? "تتوفر مراجع المشروع والقرار السوقي والبرنامج وعقد نشط؛ يمكن تثبيت خط أساس عند بدء التنفيذ."
        : hasReferencePack
          ? "المراجع الجوهرية جاهزة، لكن لا يوجد عقد نشط بعد لتثبيت خط أساس تنفيذي."
          : "لا يزال المشروع في مرحلة التحضير؛ يعرض هذا المرجع ما يجب أن يكتمل قبل خط الأساس.",
      checks: [
        { label: "حقائق المشروع والوثائق", present: factsStatus === "ready" && officialDocCount > 0 },
        { label: "قرار السوق المعتمد", present: marketReady },
        { label: "برنامج أولي مؤرخ", present: programReady },
        { label: "عقد أو تكليف نشط", present: contractReady },
      ],
      activeContracts: seed.activeContracts,
    },
    changeControl: {
      state: "prepared_only",
      title: "قرار التغيير",
      detail: "لن يُفعّل طلب تغيير أو يكتب في الكلفة أو البرنامج أو التدفقات قبل تثبيت خط أساس معتمد وبدء المشروع فعليًا.",
      activationRule: "يتاح بعد تثبيت خط أساس تنفيذي معتمد فقط.",
      template: [
        "السبب والوثيقة المرجعية",
        "الأثر على النطاق والبرنامج والكلفة والتدفقات",
        "القرار المطلوب والاعتماد",
      ],
    },
  };
}

export const projectReferenceRouter = router({
  get: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("قاعدة البيانات غير متاحة");

      const [projectRows, documentRows, decisionRows, evidenceRows, serviceRows, legalRows, permitRows, contractRows] = await Promise.all([
        db.select().from(projects).where(eq(projects.id, input.projectId)).limit(1),
        db.select({ sourceName: documentIndex.sourceName, category: documentIndex.category, updatedAt: documentIndex.updatedAt, sourceType: documentIndex.sourceType, sourceId: documentIndex.sourceId, sourcePath: documentIndex.sourcePath })
          .from(documentIndex).where(and(eq(documentIndex.projectId, input.projectId), eq(documentIndex.indexStatus, "indexed"))).orderBy(desc(documentIndex.updatedAt)),
        db.select({ decidedAt: marketDecisionApprovals.decidedAt, notes: marketDecisionApprovals.notes })
          .from(marketDecisionApprovals).where(and(eq(marketDecisionApprovals.projectId, input.projectId), eq(marketDecisionApprovals.decisionStatus, "approved"))).orderBy(desc(marketDecisionApprovals.decidedAt)).limit(1),
        db.select({ id: projectMarketEvidence.id }).from(projectMarketEvidence)
          .where(and(eq(projectMarketEvidence.projectId, input.projectId), eq(projectMarketEvidence.verificationStatus, "verified"))),
        db.select({ id: projectServiceInstances.id }).from(projectServiceInstances)
          .where(and(eq(projectServiceInstances.projectId, input.projectId), isNotNull(projectServiceInstances.plannedDueDate))),
        db.select().from(legalSetupRecords).where(eq(legalSetupRecords.projectId, input.projectId)).orderBy(desc(legalSetupRecords.updatedAt)).limit(1),
        db.select().from(designsAndPermits).where(eq(designsAndPermits.projectId, input.projectId)).orderBy(desc(designsAndPermits.updatedAt)).limit(1),
        db.select({ title: projectContracts.title, contractNumber: projectContracts.contractNumber, startDate: projectContracts.startDate })
          .from(projectContracts).where(and(eq(projectContracts.projectId, input.projectId), eq(projectContracts.contractStatus, "active"))),
      ]);

      const project = projectRows[0];
      if (!project) throw new Error("لم يُعثر على المشروع المطلوب");
      return buildProjectReference({
        project,
        officialDocuments: documentRows,
        approvedMarketDecision: decisionRows[0],
        verifiedEvidenceCount: evidenceRows.length,
        plannedServices: serviceRows.length,
        legalRecord: legalRows[0],
        permitRecord: permitRows[0],
        activeContracts: contractRows,
      });
    }),
});
