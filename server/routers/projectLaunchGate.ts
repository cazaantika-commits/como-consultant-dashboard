import { and, eq, isNotNull } from "drizzle-orm";
import { z } from "zod";
import {
  consultantProposals,
  lifecycleStages,
  marketDecisionApprovals,
  projectContracts,
  projectMarketEvidence,
  projectMarketSearchProfiles,
  projectServiceInstances,
  projects,
} from "../../drizzle/schema";
import { getDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";

type GateStatus = "complete" | "partial" | "missing";

type LaunchGateSeed = {
  project: Record<string, unknown>;
  hasMarketProfile: boolean;
  verifiedEvidenceCount: number;
  hasApprovedMarketDecision: boolean;
  activeLifecycleStages: number;
  plannedServices: number;
  proposalCount: number;
  activeContractCount: number;
};

function statusFromCount(filled: number, total: number): GateStatus {
  if (filled === total && total > 0) return "complete";
  if (filled > 0) return "partial";
  return "missing";
}

export function buildProjectLaunchGate(seed: LaunchGateSeed) {
  const factItems = [
    { label: "رقم الأرض", present: Boolean(seed.project.plotNumber) },
    { label: "سند الملكية أو المرجع الرسمي", present: Boolean(seed.project.titleDeedNumber || seed.project.ddaNumber) },
    { label: "الاستخدام المسموح", present: Boolean(seed.project.permittedUse) },
    { label: "مساحة البناء أو المساحة المالية", present: Boolean(seed.project.gfaSqft || seed.project.manualBuaSqft || seed.project.bua) },
    { label: "مجلد وثائق المشروع", present: Boolean(seed.project.driveFolderId) },
  ];
  const factsStatus = statusFromCount(factItems.filter((item) => item.present).length, factItems.length);

  const marketStatus: GateStatus = seed.hasApprovedMarketDecision && seed.verifiedEvidenceCount > 0 && seed.hasMarketProfile
    ? "complete"
    : seed.hasMarketProfile || seed.verifiedEvidenceCount > 0
      ? "partial"
      : "missing";
  const programStatus: GateStatus = seed.activeLifecycleStages > 0 && seed.plannedServices > 0
    ? "complete"
    : seed.activeLifecycleStages > 0 || seed.plannedServices > 0
      ? "partial"
      : "missing";
  const appointmentStatus: GateStatus = seed.activeContractCount > 0
    ? "complete"
    : seed.proposalCount > 0
      ? "partial"
      : "missing";

  let nextDecision = "أكمل بطاقة المشروع ووثائق الأرض من المصدر المعتمد.";
  let nextActionHref = "/project";
  if (factsStatus === "complete" && marketStatus !== "complete") {
    nextDecision = "أكمل قرار السوق ودليل المقارنات ثم اعتمده قبل إصدار أي طلب عروض.";
    nextActionHref = "/knowledge-analysis";
  } else if (factsStatus === "complete" && marketStatus === "complete" && programStatus !== "complete") {
    nextDecision = "حدد البرنامج الأولي ومتطلبات المسار التنظيمي قبل بدء طلب عروض الاستشاريين.";
    nextActionHref = "/development-phases";
  } else if (factsStatus === "complete" && marketStatus === "complete" && programStatus === "complete" && appointmentStatus === "missing") {
    nextDecision = "المشروع جاهز لبدء طلب عروض الاستشاريين وإصدار حزمة التكليف.";
    nextActionHref = "/consultant-portal";
  } else if (appointmentStatus === "partial") {
    nextDecision = "راجع عروض الاستشاريين وحدد قرار التعيين قبل إعداد خط الأساس.";
    nextActionHref = "/consultant-portal";
  } else if (appointmentStatus === "complete") {
    nextDecision = "ثبّت خط الأساس المعتمد للبرنامج والميزانية والتسليمات قبل بدء التنفيذ.";
    nextActionHref = "/contracts";
  }

  return {
    readyForTender: factsStatus === "complete" && marketStatus === "complete" && programStatus === "complete",
    nextDecision,
    nextActionHref,
    gates: [
      {
        id: "facts",
        title: "حقائق المشروع والوثائق",
        description: "تُقرأ من بطاقة المشروع وملفات الوثائق؛ لا تُعدل من هذه البوابة.",
        status: factsStatus,
        detail: `${factItems.filter((item) => item.present).length} من ${factItems.length} حقول تأسيسية متاحة`,
        items: factItems,
        href: `/project/${seed.project.id}`,
        sourceLabel: "بطاقة المشروع وخازن",
      },
      {
        id: "market",
        title: "قرار الاستثمار والسوق",
        description: "يتطلب فلترة سوق محفوظة ودليلًا موثقًا وقرار سوق معتمدًا.",
        status: marketStatus,
        detail: `${seed.verifiedEvidenceCount} دليل موثق${seed.hasApprovedMarketDecision ? " · قرار سوق معتمد" : " · لم يعتمد قرار سوق بعد"}`,
        items: [
          { label: "فلترة سوق محفوظة", present: seed.hasMarketProfile },
          { label: "دليل سوق موثق", present: seed.verifiedEvidenceCount > 0 },
          { label: "قرار سوق معتمد", present: seed.hasApprovedMarketDecision },
        ],
        href: "/knowledge-analysis",
        sourceLabel: "المعرفة والتحليل",
      },
      {
        id: "program",
        title: "البرنامج والمسار التنظيمي",
        description: "يبيّن وجود برنامج أولي فقط؛ لا يغيّر تواريخ أو حالات مسار الامتثال.",
        status: programStatus,
        detail: `${seed.plannedServices} خدمة لها موعد مخطط ضمن ${seed.activeLifecycleStages} مراحل نشطة`,
        items: [
          { label: "مراحل تنظيمية نشطة", present: seed.activeLifecycleStages > 0 },
          { label: "خدمة واحدة على الأقل لها موعد مخطط", present: seed.plannedServices > 0 },
        ],
        href: "/development-phases",
        sourceLabel: "جولة مراحل التطوير",
      },
      {
        id: "appointment",
        title: "التكليف والعقد",
        description: "يعرض الوضع الحالي للعروض والعقود فقط؛ لا ينشئ أو يغير عقدًا من هذه البوابة.",
        status: appointmentStatus,
        detail: `${seed.proposalCount} عرض استشاري · ${seed.activeContractCount} عقد نشط`,
        items: [
          { label: "عرض استشاري واحد على الأقل", present: seed.proposalCount > 0 },
          { label: "عقد أو تكليف نشط", present: seed.activeContractCount > 0 },
        ],
        href: appointmentStatus === "complete" ? "/contracts" : "/consultant-portal",
        sourceLabel: appointmentStatus === "complete" ? "سجل العقود" : "المكاتب الاستشارية",
      },
    ],
  };
}

export const projectLaunchGateRouter = router({
  get: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("قاعدة البيانات غير متاحة");

      const [projectRows, profileRows, verifiedEvidenceRows, approvedDecisionRows, activeStageRows, plannedServiceRows, proposalRows, activeContractRows] = await Promise.all([
        db.select().from(projects).where(eq(projects.id, input.projectId)).limit(1),
        db.select({ id: projectMarketSearchProfiles.id }).from(projectMarketSearchProfiles).where(eq(projectMarketSearchProfiles.projectId, input.projectId)).limit(1),
        db.select({ id: projectMarketEvidence.id }).from(projectMarketEvidence).where(and(eq(projectMarketEvidence.projectId, input.projectId), eq(projectMarketEvidence.verificationStatus, "verified"))),
        db.select({ id: marketDecisionApprovals.id }).from(marketDecisionApprovals).where(and(eq(marketDecisionApprovals.projectId, input.projectId), eq(marketDecisionApprovals.decisionStatus, "approved"))).limit(1),
        db.select({ id: lifecycleStages.id }).from(lifecycleStages).where(eq(lifecycleStages.isActive, 1)),
        db.select({ id: projectServiceInstances.id }).from(projectServiceInstances).where(and(eq(projectServiceInstances.projectId, input.projectId), isNotNull(projectServiceInstances.plannedDueDate))),
        db.select({ id: consultantProposals.id }).from(consultantProposals).where(eq(consultantProposals.projectId, input.projectId)),
        db.select({ id: projectContracts.id }).from(projectContracts).where(and(eq(projectContracts.projectId, input.projectId), eq(projectContracts.contractStatus, "active"))),
      ]);

      const project = projectRows[0];
      if (!project) throw new Error("لم يُعثر على المشروع المطلوب");
      return {
        project: { id: project.id, name: project.name, financingScenario: project.financingScenario },
        ...buildProjectLaunchGate({
          project,
          hasMarketProfile: Boolean(profileRows[0]),
          verifiedEvidenceCount: verifiedEvidenceRows.length,
          hasApprovedMarketDecision: Boolean(approvedDecisionRows[0]),
          activeLifecycleStages: activeStageRows.length,
          plannedServices: plannedServiceRows.length,
          proposalCount: proposalRows.length,
          activeContractCount: activeContractRows.length,
        }),
      };
    }),
});
