import { and, eq, isNotNull, sql } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  commandCenterMembers,
  consultantProposals,
  lifecycleStages,
  marketDecisionApprovals,
  projectContracts,
  projectMarketEvidence,
  projectMarketSearchProfiles,
  projectServiceInstances,
  projects,
  meetings,
  tasks,
} from "../../drizzle/schema";
import { getDb } from "../db";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";

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
  const missingFactLabels = factItems.filter((item) => !item.present).map((item) => item.label);

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

  const marketMissing = [
    !seed.hasMarketProfile ? "فلترة سوق محفوظة" : null,
    seed.verifiedEvidenceCount === 0 ? "دليل سوق موثق" : null,
    !seed.hasApprovedMarketDecision ? "قرار سوق معتمد" : null,
  ].filter(Boolean) as string[];
  const programMissing = [
    seed.activeLifecycleStages === 0 ? "مراحل تنظيمية نشطة" : null,
    seed.plannedServices === 0 ? "خدمة لها موعد مخطط" : null,
  ].filter(Boolean) as string[];

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
    nextActionHref = "/consultant-appointment-pack";
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
        reason: factsStatus === "complete" ? "تتوفر حقائق الأرض والوثائق الأساسية من المصادر الحالية." : `ينقص: ${missingFactLabels.join("، ")}.`,
        nextAction: factsStatus === "complete" ? "انتقل إلى مراجعة قرار السوق." : `استكمل الحقول الناقصة في بطاقة المشروع: ${missingFactLabels.join("، ")}.`,
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
        reason: marketStatus === "complete" ? "فلترة السوق والدليل والقرار المعتمد مكتملة." : `ينقص: ${marketMissing.join("، ")}.`,
        nextAction: marketStatus === "complete" ? "احفظ قرار السوق مرجعًا لمرحلة البرنامج والتكليف." : "حدد ما تريد بحثه، وثّق الأدلة المتوافقة، ثم راجع قرار السوق واعتمده.",
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
        reason: programStatus === "complete" ? "يوجد مسار تنظيمي نشط وخدمة واحدة على الأقل بموعد مخطط." : `ينقص: ${programMissing.join("، ")}.`,
        nextAction: programStatus === "complete" ? "جهّز موجز ونطاق تكليف الاستشاري بالاستناد إلى البرنامج." : "افتح جولة المراحل وحدد البرنامج الأولي ومواعيد الخدمات الأساسية.",
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
        reason: appointmentStatus === "complete" ? "يوجد عقد أو تكليف نشط مسجل للمشروع." : appointmentStatus === "partial" ? "توجد عروض استشارية، لكن لم يسجل عقد أو تكليف نشط بعد." : "لا يوجد عرض استشاري أو عقد مسجل بعد.",
        nextAction: appointmentStatus === "complete" ? "ثبّت خط الأساس للتنفيذ قبل بدء الأعمال." : appointmentStatus === "partial" ? "قارن العروض وحدد قرار التعيين ثم سجل العقد أو التكليف." : "جهّز حزمة التكليف وابدأ طلب عروض الاستشاريين.",
        items: [
          { label: "عرض استشاري واحد على الأقل", present: seed.proposalCount > 0 },
          { label: "عقد أو تكليف نشط", present: seed.activeContractCount > 0 },
        ],
        href: appointmentStatus === "complete" ? "/contracts" : appointmentStatus === "missing" ? "/consultant-appointment-pack" : "/consultant-portal",
        sourceLabel: appointmentStatus === "complete" ? "سجل العقود" : appointmentStatus === "missing" ? "حزمة التكليف" : "المكاتب الاستشارية",
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

  // Read-only owner digest. It composes existing task, meeting, launch, and
  // approved-change records only; it creates no parallel workflow or source data.
  getOwnerSummary: publicProcedure
    .input(z.object({ ccToken: z.string().min(1).optional() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("قاعدة البيانات غير متاحة");
      if (!ctx.user) {
        if (!input.ccToken) throw new TRPCError({ code: "UNAUTHORIZED", message: "يلزم تسجيل دخول معتمد لعرض ملخص المالك." });
        const members = await db.select({ id: commandCenterMembers.id }).from(commandCenterMembers)
          .where(and(eq(commandCenterMembers.accessToken, input.ccToken), eq(commandCenterMembers.isActive, 1))).limit(1);
        if (!members[0]) throw new TRPCError({ code: "UNAUTHORIZED", message: "رمز مركز القيادة غير صالح." });
      }

      const today = new Date().toISOString().slice(0, 10);
      const [projectRows, profileRows, evidenceRows, approvedMarketRows, activeStageRows, plannedServiceRows, proposalRows, activeContractRows, taskRows, meetingRows] = await Promise.all([
        db.select().from(projects).where(eq(projects.isTestProject, 0)),
        db.select({ projectId: projectMarketSearchProfiles.projectId }).from(projectMarketSearchProfiles),
        db.select({ projectId: projectMarketEvidence.projectId }).from(projectMarketEvidence).where(eq(projectMarketEvidence.verificationStatus, "verified")),
        db.select({ projectId: marketDecisionApprovals.projectId }).from(marketDecisionApprovals).where(eq(marketDecisionApprovals.decisionStatus, "approved")),
        db.select({ id: lifecycleStages.id }).from(lifecycleStages).where(eq(lifecycleStages.isActive, 1)),
        db.select({ projectId: projectServiceInstances.projectId }).from(projectServiceInstances).where(isNotNull(projectServiceInstances.plannedDueDate)),
        db.select({ projectId: consultantProposals.projectId }).from(consultantProposals),
        db.select({ projectId: projectContracts.projectId }).from(projectContracts).where(eq(projectContracts.contractStatus, "active")),
        db.select().from(tasks),
        db.select().from(meetings),
      ]);
      const approvedChangesResult = await db.execute(sql`
        SELECT id, project_id AS projectId, title, decision_notes AS decisionNotes, decided_at AS decidedAt
        FROM project_change_requests
        WHERE decision_status = 'approved'
      `);
      const approvedChangeRows = approvedChangesResult[0] as Array<{ id: number; projectId: number; title: string; decisionNotes: string | null; decidedAt: string | null }>;

      const profileProjectIds = new Set(profileRows.map((row) => row.projectId));
      const approvedMarketProjectIds = new Set(approvedMarketRows.map((row) => row.projectId));
      const countByProject = (rows: Array<{ projectId: number }>) => rows.reduce((counts, row) => counts.set(row.projectId, (counts.get(row.projectId) || 0) + 1), new Map<number, number>());
      const evidenceCounts = countByProject(evidenceRows);
      const serviceCounts = countByProject(plannedServiceRows);
      const proposalCounts = countByProject(proposalRows);
      const contractCounts = countByProject(activeContractRows);
      const projectNames = new Map(projectRows.map((project) => [project.id, project.name]));

      const decisions = projectRows.map((project) => {
        const gate = buildProjectLaunchGate({
          project,
          hasMarketProfile: profileProjectIds.has(project.id),
          verifiedEvidenceCount: evidenceCounts.get(project.id) || 0,
          hasApprovedMarketDecision: approvedMarketProjectIds.has(project.id),
          activeLifecycleStages: activeStageRows.length,
          plannedServices: serviceCounts.get(project.id) || 0,
          proposalCount: proposalCounts.get(project.id) || 0,
          activeContractCount: contractCounts.get(project.id) || 0,
        });
        return { projectId: project.id, projectName: project.name, ...gate };
      }).filter((project) => project.gates.some((gate) => gate.status !== "complete"))
        .slice(0, 4)
        .map((project) => ({
          kind: "launch" as const,
          projectId: project.projectId,
          projectName: project.projectName,
          title: project.nextDecision,
          detail: "المصدر: بوابة انطلاق المشروع من السجلات القائمة.",
          href: project.nextActionHref,
        }));

      const attentionTasks = taskRows
        .filter((task) => ["new", "progress"].includes(task.status) && (task.priority === "high" || Boolean(task.dueDate && task.dueDate <= today)))
        .sort((a, b) => (a.dueDate || "9999-12-31").localeCompare(b.dueDate || "9999-12-31"))
        .slice(0, 4)
        .map((task) => ({
          kind: "task" as const,
          title: task.title,
          detail: `${task.project} · ${task.dueDate && task.dueDate <= today ? "موعدها اليوم أو متأخر" : "أولوية عالية"}`,
          href: "/tasks",
        }));

      const recentMeetingCutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
      const preparingMeetings = meetingRows
        .filter((meeting) => (meeting.meetingStatus === "preparing" || meeting.meetingStatus === "in_progress") && new Date(meeting.updatedAt || meeting.createdAt).getTime() >= recentMeetingCutoff)
        .slice(0, 3)
        .map((meeting) => ({
          kind: "meeting" as const,
          title: meeting.title,
          detail: meeting.meetingStatus === "in_progress" ? "اجتماع جارٍ؛ راجع مخرجاته عند الإقفال." : "اجتماع قيد التحضير.",
          href: `/meetings/${meeting.id}`,
        }));

      const approvedChanges = approvedChangeRows
        .sort((a, b) => String(b.decidedAt || "").localeCompare(String(a.decidedAt || "")))
        .slice(0, 3)
        .map((change) => ({
          kind: "change" as const,
          projectId: change.projectId,
          projectName: projectNames.get(change.projectId) || "المشروع",
          title: change.title,
          detail: "تغيير معتمد للقراءة؛ لا يحدّث الكلفة أو البرنامج أو التدفقات تلقائيًا.",
          href: "/project-reference",
        }));

      return { today: [...attentionTasks, ...preparingMeetings, ...approvedChanges].slice(0, 6), decisions };
    }),
});
