import { and, eq, isNotNull, sql } from "drizzle-orm";
import {
  consultantProposals,
  marketDecisionApprovals,
  projectContracts,
  projectMarketEvidence,
  projectMarketSearchProfiles,
  projectServiceInstances,
  projects,
} from "../../drizzle/schema";

type GateStatus = "complete" | "partial" | "missing";

type FoundationSeed = {
  project: Record<string, any>;
  protectedDocumentCount: number;
  indexedDocumentCount: number;
  hasMarketProfile: boolean;
  verifiedEvidenceCount: number;
  hasApprovedMarketDecision: boolean;
  projectStageCount: number;
  plannedServices: number;
  proposalCount: number;
  activeContractCount: number;
};

function hasValue(value: unknown) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function statusFromCount(filled: number, total: number): GateStatus {
  if (filled === total && total > 0) return "complete";
  if (filled > 0) return "partial";
  return "missing";
}

function rows<T>(result: unknown): T[] {
  if (Array.isArray(result) && Array.isArray(result[0])) return result[0] as T[];
  return result as T[];
}

export function buildProjectFoundation(seed: FoundationSeed) {
  const projectId = Number(seed.project.id);
  const documentCount = seed.protectedDocumentCount + seed.indexedDocumentCount;
  const factItems = [
    { label: "رقم الأرض", present: hasValue(seed.project.plotNumber) },
    { label: "سند الملكية أو المرجع الرسمي", present: hasValue(seed.project.titleDeedNumber) || hasValue(seed.project.ddaNumber) || hasValue(seed.project.masterDevRef) },
    { label: "الاستخدام المسموح", present: hasValue(seed.project.permittedUse) },
    { label: "مساحة الأرض أو المساحة البنائية", present: hasValue(seed.project.plotAreaSqm) || hasValue(seed.project.plotAreaSqft) || hasValue(seed.project.gfaSqft) || hasValue(seed.project.manualBuaSqft) || hasValue(seed.project.bua) },
    { label: "علاقة الشركة بالأرض", present: hasValue(seed.project.ownershipType) },
    { label: "استراتيجية التطوير", present: hasValue(seed.project.financingScenario) },
    { label: "وثيقة مشروع محفوظة", present: documentCount > 0 },
  ];
  const factsStatus = statusFromCount(factItems.filter(item => item.present).length, factItems.length);
  const missingFactLabels = factItems.filter(item => !item.present).map(item => item.label);

  const marketStatus: GateStatus = seed.hasApprovedMarketDecision && seed.verifiedEvidenceCount > 0 && seed.hasMarketProfile
    ? "complete"
    : seed.hasMarketProfile || seed.verifiedEvidenceCount > 0 || seed.hasApprovedMarketDecision
      ? "partial"
      : "missing";
  const programStatus: GateStatus = seed.projectStageCount > 0 && seed.plannedServices > 0
    ? "complete"
    : seed.projectStageCount > 0 || seed.plannedServices > 0
      ? "partial"
      : "missing";
  const appointmentStatus: GateStatus = seed.activeContractCount > 0
    ? "complete"
    : seed.proposalCount > 0
      ? "partial"
      : "missing";

  const marketMissing = [
    !seed.hasMarketProfile ? "فلترة سوق محفوظة" : null,
    seed.verifiedEvidenceCount === 0 ? "دليل سوق موثق" : null,
    !seed.hasApprovedMarketDecision ? "قرار سوق معتمد" : null,
  ].filter(Boolean) as string[];
  const programMissing = [
    seed.projectStageCount === 0 ? "مسار مشروع مسجل" : null,
    seed.plannedServices === 0 ? "خدمة لها موعد مخطط" : null,
  ].filter(Boolean) as string[];

  let nextDecision = "ثبّت هوية المشروع ووثائقه قبل الانتقال إلى الدراسات.";
  let nextActionHref = `/project/${projectId}`;
  if (factsStatus !== "complete") {
    nextDecision = `استكمل أساس المشروع أولًا: ${missingFactLabels.join("، ")}.`;
    nextActionHref = `/project/${projectId}`;
  } else if (marketStatus !== "complete") {
    nextDecision = "أكمل قرار السوق ودليل المقارنات ثم اعتمده قبل إصدار أي طلب عروض.";
    nextActionHref = `/knowledge-analysis?projectId=${projectId}`;
  } else if (programStatus !== "complete") {
    nextDecision = "حدد البرنامج الأولي ومتطلبات المسار التنظيمي قبل بدء طلب عروض الاستشاريين.";
    nextActionHref = `/development-phases?projectId=${projectId}`;
  } else if (appointmentStatus === "missing") {
    nextDecision = "المشروع جاهز لبدء طلب عروض الاستشاريين وإصدار حزمة التكليف.";
    nextActionHref = `/consultant-appointment-pack?projectId=${projectId}`;
  } else if (appointmentStatus === "partial") {
    nextDecision = "راجع عروض الاستشاريين وحدد قرار التعيين قبل إعداد خط الأساس.";
    nextActionHref = `/consultant-portal?projectId=${projectId}`;
  } else if (appointmentStatus === "complete") {
    nextDecision = "ثبّت خط الأساس المعتمد للبرنامج والميزانية والتسليمات قبل بدء التنفيذ.";
    nextActionHref = `/project-reference?projectId=${projectId}`;
  }

  const gates = [
    {
      id: "facts",
      title: "هوية المشروع ووثائقه",
      description: "تُقرأ من بطاقة المشروع ووثائق COMO المحمية والفهرس المرجعي؛ لا تُعدل من هذه البوابة.",
      status: factsStatus,
      detail: `${factItems.filter(item => item.present).length} من ${factItems.length} عناصر تأسيسية · ${seed.protectedDocumentCount} وثيقة محمية · ${seed.indexedDocumentCount} مرجع مفهرس`,
      reason: factsStatus === "complete" ? "هوية الأرض والاستراتيجية والوثائق الأساسية متاحة." : `ينقص: ${missingFactLabels.join("، ")}.`,
      nextAction: factsStatus === "complete" ? "انتقل إلى مراجعة قرار السوق." : `استكمل العناصر الناقصة في بطاقة المشروع: ${missingFactLabels.join("، ")}.`,
      items: factItems,
      href: `/project/${projectId}`,
      sourceLabel: "بطاقة المشروع والوثائق المحمية",
    },
    {
      id: "market",
      title: "قرار الاستثمار والسوق",
      description: "يتطلب فلترة سوق محفوظة ودليلًا موثقًا وقرار سوق معتمدًا.",
      status: marketStatus,
      detail: `${seed.verifiedEvidenceCount} دليل موثق${seed.hasApprovedMarketDecision ? " · قرار سوق معتمد" : " · لم يعتمد قرار سوق بعد"}`,
      reason: marketStatus === "complete" ? "فلترة السوق والدليل والقرار المعتمد مكتملة." : `ينقص: ${marketMissing.join("، ")}.`,
      nextAction: marketStatus === "complete" ? "احفظ قرار السوق مرجعًا لمرحلة البرنامج والتكليف." : "حدد ما تريد بحثه، وثّق الأدلة المتوافقة، ثم راجع قرار السوق واعتمده.",
      items: [
        { label: "فلترة سوق محفوظة", present: seed.hasMarketProfile },
        { label: "دليل سوق موثق", present: seed.verifiedEvidenceCount > 0 },
        { label: "قرار سوق معتمد", present: seed.hasApprovedMarketDecision },
      ],
      href: `/knowledge-analysis?projectId=${projectId}`,
      sourceLabel: "المعرفة والتحليل",
    },
    {
      id: "program",
      title: "البرنامج والمسار التنظيمي",
      description: "يعكس الخدمات والمراحل المسجلة لهذا المشروع فقط، لا المكتبة العامة.",
      status: programStatus,
      detail: `${seed.plannedServices} خدمة لها موعد مخطط ضمن ${seed.projectStageCount} مرحلة مستخدمة في المشروع`,
      reason: programStatus === "complete" ? "يوجد مسار مشروع وخدمة واحدة على الأقل بموعد مخطط." : `ينقص: ${programMissing.join("، ")}.`,
      nextAction: programStatus === "complete" ? "جهّز موجز ونطاق تكليف الاستشاري بالاستناد إلى البرنامج." : "افتح جولة المراحل وحدد البرنامج الأولي ومواعيد الخدمات الأساسية.",
      items: [
        { label: "مسار مشروع مسجل", present: seed.projectStageCount > 0 },
        { label: "خدمة واحدة على الأقل لها موعد مخطط", present: seed.plannedServices > 0 },
      ],
      href: `/development-phases?projectId=${projectId}`,
      sourceLabel: "جولة مراحل التطوير",
    },
    {
      id: "appointment",
      title: "التكليف والعقد",
      description: "يعرض الوضع الحالي للعروض والعقود فقط؛ لا ينشئ أو يغير عقدًا من هذه البوابة.",
      status: appointmentStatus,
      detail: `${seed.proposalCount} عرض استشاري · ${seed.activeContractCount} عقد نشط`,
      reason: appointmentStatus === "complete" ? "يوجد عقد أو تكليف نشط مسجل للمشروع." : appointmentStatus === "partial" ? "توجد عروض استشارية، لكن لم يسجل عقد أو تكليف نشط بعد." : "لا يوجد عرض استشاري أو عقد مسجل بعد.",
      nextAction: appointmentStatus === "complete" ? "ثبّت خط الأساس للتنفيذ قبل بدء الأعمال." : appointmentStatus === "partial" ? "قارن العروض وحدد قرار التعيين ثم سجل العقد أو التكليف." : "جهّز حزمة التكليف وابدأ طلب عروض الاستشاريين.",
      items: [
        { label: "عرض استشاري واحد على الأقل", present: seed.proposalCount > 0 },
        { label: "عقد أو تكليف نشط", present: seed.activeContractCount > 0 },
      ],
      href: appointmentStatus === "complete" ? `/contracts?projectId=${projectId}` : appointmentStatus === "missing" ? `/consultant-appointment-pack?projectId=${projectId}` : `/consultant-portal?projectId=${projectId}`,
      sourceLabel: appointmentStatus === "complete" ? "سجل العقود" : appointmentStatus === "missing" ? "حزمة التكليف" : "المكاتب الاستشارية",
    },
  ] as const;

  return {
    readyForTender: factsStatus === "complete" && marketStatus === "complete" && programStatus === "complete",
    completeGateCount: gates.filter(gate => gate.status === "complete").length,
    totalGateCount: gates.length,
    nextDecision,
    nextActionHref,
    evidence: {
      protectedDocumentCount: seed.protectedDocumentCount,
      indexedDocumentCount: seed.indexedDocumentCount,
      totalDocumentReferences: documentCount,
    },
    gates,
  };
}

export async function loadProjectFoundation(db: any, projectId: number) {
  const [projectRows, profileRows, evidenceRows, decisionRows, stageRows, plannedRows, proposalRows, contractRows, indexedRows, protectedResult] = await Promise.all([
    db.select().from(projects).where(eq(projects.id, projectId)).limit(1),
    db.select({ id: projectMarketSearchProfiles.id }).from(projectMarketSearchProfiles).where(eq(projectMarketSearchProfiles.projectId, projectId)).limit(1),
    db.select({ id: projectMarketEvidence.id }).from(projectMarketEvidence).where(and(eq(projectMarketEvidence.projectId, projectId), eq(projectMarketEvidence.verificationStatus, "verified"))),
    db.select({ id: marketDecisionApprovals.id }).from(marketDecisionApprovals).where(and(eq(marketDecisionApprovals.projectId, projectId), eq(marketDecisionApprovals.decisionStatus, "approved"))).limit(1),
    db.selectDistinct({ stageCode: projectServiceInstances.stageCode }).from(projectServiceInstances).where(eq(projectServiceInstances.projectId, projectId)),
    db.select({ id: projectServiceInstances.id }).from(projectServiceInstances).where(and(eq(projectServiceInstances.projectId, projectId), isNotNull(projectServiceInstances.plannedDueDate))),
    db.select({ id: consultantProposals.id }).from(consultantProposals).where(eq(consultantProposals.projectId, projectId)),
    db.select({ id: projectContracts.id }).from(projectContracts).where(and(eq(projectContracts.projectId, projectId), eq(projectContracts.contractStatus, "active"))),
    db.execute(sql`SELECT COUNT(*) AS count FROM documentIndex WHERE projectId = ${projectId} AND indexStatus = 'indexed'`),
    db.execute(sql`
      SELECT COUNT(DISTINCT link.document_id) AS count
      FROM como_next_work_files work_file
      JOIN como_next_work_memory memory ON memory.work_file_id = work_file.id AND memory.project_id = work_file.project_id
      JOIN como_next_work_memory_documents link ON link.memory_id = memory.id AND link.project_id = work_file.project_id
      WHERE work_file.project_id = ${projectId}
    `),
  ]);
  const project = projectRows[0];
  if (!project) throw new Error("لم يُعثر على المشروع المطلوب");
  const indexedDocumentCount = Number(rows<{ count: number | string }>(indexedRows)[0]?.count || 0);
  const protectedDocumentCount = Number(rows<{ count: number | string }>(protectedResult)[0]?.count || 0);
  return {
    project: { id: project.id, name: project.name, financingScenario: project.financingScenario },
    ...buildProjectFoundation({
      project,
      protectedDocumentCount,
      indexedDocumentCount,
      hasMarketProfile: Boolean(profileRows[0]),
      verifiedEvidenceCount: evidenceRows.length,
      hasApprovedMarketDecision: Boolean(decisionRows[0]),
      projectStageCount: stageRows.length,
      plannedServices: plannedRows.length,
      proposalCount: proposalRows.length,
      activeContractCount: contractRows.length,
    }),
  };
}
