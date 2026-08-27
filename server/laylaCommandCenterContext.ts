import { desc } from "drizzle-orm";

type SnapshotProject = { id: number; name: string };

export type LaylaCommandCenterSnapshot = {
  generated_at: string;
  member_id: string;
  projects: SnapshotProject[];
  decisions: Array<Record<string, unknown>>;
  approvals: Array<Record<string, unknown>>;
  payment_requests: Array<Record<string, unknown>>;
  requests: Array<Record<string, unknown>>;
  tasks: Array<Record<string, unknown>>;
  meetings: Array<Record<string, unknown>>;
  evaluations: Array<Record<string, unknown>>;
  project_status: Array<Record<string, unknown>>;
  updates: Array<Record<string, unknown>>;
};

function safeJson(value: string | null | undefined): unknown {
  if (!value) return null;
  try { return JSON.parse(value); } catch { return value; }
}

function visibleToMember(targetMemberIds: string | null, createdByMemberId: string | null, memberId: string) {
  if (!targetMemberIds) return true;
  try {
    const targets = JSON.parse(targetMemberIds) as string[];
    return targets.includes(memberId) || createdByMemberId === memberId;
  } catch {
    return true;
  }
}

function findProjectId(projects: SnapshotProject[], requested?: string) {
  const normalized = requested?.trim().toLowerCase();
  if (!normalized) return null;
  const matches = projects.filter((project) => project.name.toLowerCase().includes(normalized));
  return matches.length === 1 ? matches[0].id : null;
}

export async function loadLaylaCommandCenterSnapshot(db: any, member: { memberId: string; role: string }, schema: any): Promise<LaylaCommandCenterSnapshot> {
  const pendingStatuses = ["new", "pending_wael", "pending_sheikh", "needs_revision"];
  const [projectRows, changeRows, committeeRows, evaluationRows, evaluationSessionRows, paymentRows, requestRows, taskRows, meetingRows, milestoneRows, kpiRows, itemRows] = await Promise.all([
    db.select({ id: schema.projects.id, name: schema.projects.name }).from(schema.projects),
    db.select().from(schema.projectChangeRequests).orderBy(desc(schema.projectChangeRequests.createdAt)).limit(40),
    db.select().from(schema.committeeDecisions).orderBy(desc(schema.committeeDecisions.updatedAt)).limit(25),
    db.select().from(schema.evaluationApprovals).orderBy(desc(schema.evaluationApprovals.updatedAt)).limit(50),
    db.select().from(schema.evaluationSessions).orderBy(desc(schema.evaluationSessions.updatedAt)).limit(50),
    db.select().from(schema.paymentRequests).orderBy(desc(schema.paymentRequests.updatedAt)).limit(50),
    db.select().from(schema.generalRequests).orderBy(desc(schema.generalRequests.updatedAt)).limit(50),
    db.select().from(schema.tasks).orderBy(desc(schema.tasks.updatedAt)).limit(50),
    db.select().from(schema.meetings).orderBy(desc(schema.meetings.updatedAt)).limit(25),
    db.select().from(schema.projectMilestones).orderBy(desc(schema.projectMilestones.updatedAt)).limit(100),
    db.select().from(schema.projectKpis).orderBy(desc(schema.projectKpis.updatedAt)).limit(100),
    db.select().from(schema.commandCenterItems).orderBy(desc(schema.commandCenterItems.createdAt)).limit(50),
  ]);

  const projects = projectRows as SnapshotProject[];
  const projectName = (projectId: number | null | undefined) => projects.find((project) => project.id === projectId)?.name || "مشروع غير محدد";
  const belongsToCurrentRole = (status: string) => member.memberId === "abdulrahman"
    || (member.memberId === "wael" && status === "pending_wael")
    || (member.memberId === "sheikh_issa" && status === "pending_sheikh");

  return {
    generated_at: new Date().toISOString(),
    member_id: member.memberId,
    projects,
    decisions: [
      ...changeRows.filter((row: any) => row.decisionStatus === "submitted" || row.decisionStatus === "approved").map((row: any) => ({
        source: "طلب تغيير مشروع",
        project: projectName(row.projectId),
        title: row.title,
        status: row.decisionStatus,
        notes: row.decisionNotes || null,
        decided_at: row.decidedAt || null,
      })),
      ...committeeRows.filter((row: any) => row.isConfirmed === 1).map((row: any) => ({
        source: "قرار لجنة",
        project: projectName(row.projectId),
        decision_type: row.decisionType || null,
        decision_basis: row.decisionBasis || null,
        justification: row.justification || null,
        confirmed_at: row.confirmedAt || null,
      })),
    ].slice(0, 40),
    approvals: evaluationRows.map((row: any) => ({
      project: projectName(row.projectId),
      evaluator: row.evaluatorName,
      approved: row.isApproved === 1,
      approved_at: row.approvedAt || null,
    })).slice(0, 50),
    payment_requests: paymentRows.filter((row: any) => row.isArchived === 0 && pendingStatuses.includes(row.status) && belongsToCurrentRole(row.status)).map((row: any) => ({
      request_number: row.requestNumber,
      project: row.projectName || null,
      description: row.description,
      amount: Number(row.amount),
      currency: row.currency,
      status: row.status,
      created_at: row.createdAt,
    })),
    requests: requestRows.filter((row: any) => row.isArchived === 0 && pendingStatuses.includes(row.status) && belongsToCurrentRole(row.status)).map((row: any) => ({
      request_number: row.requestNumber,
      request_type: row.requestType,
      subject: row.subject,
      project: row.projectName || projectName(row.projectId),
      related_party: row.relatedParty || null,
      proposed_date: row.proposedDate || null,
      status: row.status,
      created_at: row.createdAt,
    })),
    tasks: taskRows.filter((row: any) => !["done", "cancelled"].includes(row.status)).map((row: any) => ({
      title: row.title,
      project: row.project,
      owner: row.owner,
      priority: row.priority,
      status: row.status,
      progress: row.progress,
      due_date: row.dueDate || null,
    })),
    meetings: meetingRows.filter((row: any) => row.meetingStatus !== "cancelled").map((row: any) => ({
      title: row.title,
      topic: row.topic || null,
      status: row.meetingStatus,
      started_at: row.startedAt || null,
      ended_at: row.endedAt || null,
      minutes_summary: row.minutesSummary || null,
      decisions: safeJson(row.decisionsJson),
      extracted_tasks: safeJson(row.extractedTasksJson),
    })),
    evaluations: evaluationSessionRows.filter((row: any) => row.status !== "completed" && !String(row.title || "").includes("تجريبية للاختبار")).map((row: any) => ({
      title: row.title || "جلسة تقييم بلا عنوان",
      project: projectName(row.projectId),
      completed_count: row.completedCount,
      required_count: row.requiredCount,
      status: row.status,
    })),
    project_status: projects.map((project) => ({
      project: project.name,
      milestones: milestoneRows.filter((row: any) => row.projectId === project.id && !["completed", "cancelled"].includes(row.milestoneStatus)).slice(0, 8).map((row: any) => ({
        title: row.titleAr || row.title,
        status: row.milestoneStatus,
        progress: row.progressPercent,
        planned_end: row.plannedEndDate || null,
        priority: row.milestonePriority,
      })),
      kpis: kpiRows.filter((row: any) => row.projectId === project.id && ["at_risk", "off_track"].includes(row.kpiStatus)).slice(0, 6).map((row: any) => ({
        name: row.nameAr || row.name,
        status: row.kpiStatus,
        current: row.currentValue === null ? null : Number(row.currentValue),
        target: row.targetValue === null ? null : Number(row.targetValue),
        unit: row.unit || null,
      })),
    })),
    updates: itemRows.filter((row: any) => visibleToMember(row.targetMemberIds, row.createdByMemberId, member.memberId) && ["active", "pending_response"].includes(row.itemStatus)).map((row: any) => ({
      type: row.bubbleType,
      title: row.title,
      summary: row.summary || null,
      priority: row.itemPriority,
      status: row.itemStatus,
      requires_response: row.requiresResponse === 1,
      project: projectName(row.projectId),
      created_at: row.createdAt,
    })),
  };
}

export const laylaCommandCenterTools = [{
  type: "function" as const,
  function: {
    name: "lookup_command_center",
    description: "قراءة مصدر مركز القيادة الموثق للإجابة عن القرارات والاعتمادات وطلبات الصرف والطلبات والمهام والاجتماعات وحالة مشروع. لا يستخدم هذا المصدر لتنفيذ أي إجراء.",
    parameters: {
      type: "object",
      properties: {
        category: { type: "string", enum: ["overview", "decisions", "approvals", "payment_requests", "requests", "tasks", "meetings", "evaluations", "project_status", "updates"] },
        project_name: { type: "string", description: "اسم المشروع اختياري عند السؤال عن قرار أو مهمة أو حالة مشروع محدد" },
      },
      required: ["category"],
      additionalProperties: false,
    },
  },
}];

export function runLaylaCommandCenterTool(snapshot: LaylaCommandCenterSnapshot, rawArguments: string) {
  let input: { category?: keyof Omit<LaylaCommandCenterSnapshot, "generated_at" | "member_id" | "projects">; project_name?: string };
  try { input = JSON.parse(rawArguments || "{}"); } catch { return { found: false, reason: "صيغة طلب المصدر غير صالحة" }; }
  const category = input.category;
  const allowed = ["decisions", "approvals", "payment_requests", "requests", "tasks", "meetings", "evaluations", "project_status", "updates"] as const;
  if (category === "overview") {
    return {
      generated_at: snapshot.generated_at,
      projects: snapshot.projects.map((project) => project.name),
      counts: Object.fromEntries(allowed.map((key) => [key, snapshot[key].length])),
    };
  }
  if (!category || !allowed.includes(category as typeof allowed[number])) return { found: false, reason: "نوع معلومات مركز القيادة غير مدعوم" };
  const source = snapshot[category as typeof allowed[number]];
  const projectId = findProjectId(snapshot.projects, input.project_name);
  if (input.project_name && !projectId) return { found: false, reason: "اسم المشروع غير محدد بما يكفي في مصدر مركز القيادة", available_projects: snapshot.projects.map((project) => project.name) };
  const normalized = input.project_name?.trim().toLowerCase();
  const filtered = normalized
    ? source.filter((item: any) => JSON.stringify(item).toLowerCase().includes(normalized))
    : source;
  return { found: true, category, generated_at: snapshot.generated_at, items: filtered.slice(0, 30) };
}

export function formatLaylaCommandCenterFallback(result: any): string {
  if (!result?.found) return result?.reason || "لم يصل مصدر مركز القيادة إلى نتيجة قابلة للعرض.";
  if (result.category === "overview") {
    const counts = result.counts || {};
    return [
      "ملخص مركز القيادة الحالي:",
      `القرارات: ${counts.decisions || 0}`,
      `الاعتمادات: ${counts.approvals || 0}`,
      `طلبات الصرف المعلقة: ${counts.payment_requests || 0}`,
      `الطلبات المعلقة: ${counts.requests || 0}`,
      `المهام المفتوحة: ${counts.tasks || 0}`,
      `الاجتماعات: ${counts.meetings || 0}`,
    ].join("\n");
  }
  const items = Array.isArray(result.items) ? result.items : [];
  if (items.length === 0) return "لا توجد عناصر ظاهرة حاليًا في مصدر مركز القيادة ضمن هذا النوع.";
  const labels: Record<string, string> = {
    decisions: "القرارات", approvals: "الاعتمادات", payment_requests: "طلبات الصرف", requests: "الطلبات",
    tasks: "المهام", meetings: "الاجتماعات", evaluations: "جلسات التقييم", project_status: "حالة المشاريع", updates: "التحديثات",
  };
  const details = items.slice(0, 10).map((item: Record<string, unknown>) => {
    const title = item.title || item.subject || item.request_number || item.project || "عنصر بلا عنوان";
    const context = [item.project, item.status, item.amount ? `${item.amount} ${item.currency || "درهم"}` : null]
      .filter((value, index, list) => value && value !== title && list.indexOf(value) === index)
      .join(" — ");
    return `- ${title}${context ? ` (${context})` : ""}`;
  });
  return `${labels[result.category] || "المعلومات المطلوبة"}:\n${details.join("\n")}`;
}

export function isLaylaCommandCenterOverviewRequest(message: string) {
  const normalized = message.toLowerCase();
  const topics = ["قرار", "اعتماد", "صرف", "طلب", "مهمة", "اجتماع", "مشروع", "تقييم"];
  const topicMatches = topics.filter((topic) => normalized.includes(topic)).length;
  return (normalized.includes("ملخص") || normalized.includes("الوضع الحالي") || normalized.includes("مركز القيادة")) && topicMatches >= 2;
}

export function formatLaylaCommandCenterOverview(snapshot: LaylaCommandCenterSnapshot): string {
  const section = (label: string, items: Array<Record<string, unknown>>, titleKey: string = "title") => {
    if (items.length === 0) return `- ${label}: لا توجد عناصر ظاهرة حاليًا.`;
    const titles = items.slice(0, 3).map((item) => String(item[titleKey] || item.subject || item.request_number || item.project || "عنصر بلا عنوان"));
    return `- ${label} (${items.length}): ${titles.join("؛ ")}${items.length > 3 ? "؛ …" : ""}`;
  };
  const atRiskProjects = snapshot.project_status.filter((item) => {
    const milestones = Array.isArray(item.milestones) ? item.milestones : [];
    const kpis = Array.isArray(item.kpis) ? item.kpis : [];
    return milestones.length > 0 || kpis.length > 0;
  });
  return [
    "ملخص مركز القيادة الحالي من السجلات الظاهرة:",
    section("القرارات", snapshot.decisions),
    section("الاعتمادات", snapshot.approvals, "project"),
    section("طلبات الصرف المعلقة", snapshot.payment_requests, "request_number"),
    section("الطلبات المعلقة", snapshot.requests, "request_number"),
    section("المهام المفتوحة", snapshot.tasks),
    section("الاجتماعات", snapshot.meetings),
    section("جلسات التقييم", snapshot.evaluations),
    section("المشاريع ذات المتابعة", atRiskProjects, "project"),
  ].join("\n");
}

/** A small read-only payload for Layla's opening audio briefing. */
export function buildLaylaOpeningOperations(snapshot: LaylaCommandCenterSnapshot) {
  const urgentTasks = snapshot.tasks.filter((task) => task.priority === "urgent").length;
  const followUpProjects = snapshot.project_status.filter((item) => {
    const milestones = Array.isArray(item.milestones) ? item.milestones : [];
    const kpis = Array.isArray(item.kpis) ? item.kpis : [];
    return milestones.length > 0 || kpis.length > 0;
  }).map((item) => String(item.project)).filter(Boolean);
  return {
    generatedAt: snapshot.generated_at,
    openTasks: snapshot.tasks.length,
    urgentTasks,
    pendingPayments: snapshot.payment_requests.length,
    pendingRequests: snapshot.requests.length,
    decisions: snapshot.decisions.length,
    evaluations: snapshot.evaluations.length,
    meetings: snapshot.meetings.length,
    followUpProjects,
  };
}
