import { createHash } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import {
  lifecycleServices,
  projectProgramApprovals,
  projectServiceInstances,
} from "../../drizzle/schema";

export const PROJECT_PROGRAM_SCHEMA_VERSION = "como.project-program.v1";

export type ProjectProgramStatus =
  | "no_program"
  | "incomplete_program"
  | "invalid_program"
  | "no_approved_program"
  | "needs_reapproval"
  | "current_valid";

type ProgramSourceRow = {
  id?: number;
  projectId: number;
  serviceCode: string;
  stageCode: string;
  plannedStartDate?: string | null;
  plannedDueDate?: string | null;
};

type ProgramApprovalRow = {
  id: number;
  decisionStatus: "reviewed" | "approved" | "rejected";
  sourceSchemaVersion: string;
  programHash: string;
  serviceCount: number;
  stageCount: number;
  earliestStartDate: string | null;
  latestDueDate: string | null;
  notes: string | null;
  decidedAt: string;
};

export type ProgramIssue = {
  serviceCode: string;
  reason: "missing_start" | "missing_due" | "invalid_start" | "invalid_due" | "start_after_due" | "unknown_service" | "stage_mismatch";
};

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }
  return value;
}

export function canonicalProgramJson(value: unknown) {
  return JSON.stringify(canonicalize(value));
}

export function hashProgramValue(value: unknown) {
  return createHash("sha256").update(canonicalProgramJson(value)).digest("hex");
}

const monthByName: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function validDateParts(year: number, month: number, day: number) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  const value = new Date(Date.UTC(year, month - 1, day));
  return value.getUTCFullYear() === year && value.getUTCMonth() === month - 1 && value.getUTCDate() === day;
}

export function normalizeProgramDate(raw: string | null | undefined): string | null {
  const value = String(raw || "").trim();
  if (!value || value.toUpperCase() === "NULL") return null;

  let year: number;
  let month: number;
  let day: number;
  let match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    year = Number(match[1]);
    month = Number(match[2]);
    day = Number(match[3]);
  } else {
    match = value.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (match) {
      day = Number(match[1]);
      month = Number(match[2]);
      year = Number(match[3]);
    } else {
      const named = value.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2}|\d{4})$/);
      if (!named) return null;
      day = Number(named[1]);
      month = monthByName[named[2].toLowerCase()] || 0;
      const parsedYear = Number(named[3]);
      year = named[3].length === 2 ? 2000 + parsedYear : parsedYear;
    }
  }

  if (!validDateParts(year, month, day)) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function inspectProgramSources(
  rows: ProgramSourceRow[],
  serviceDefinitions: Array<{ serviceCode: string; stageCode: string }> = [],
) {
  const definitions = new Map(serviceDefinitions.map(item => [item.serviceCode, item.stageCode]));
  const issues: ProgramIssue[] = [];
  const services = rows
    .map(row => {
      const plannedStartDate = normalizeProgramDate(row.plannedStartDate);
      const plannedDueDate = normalizeProgramDate(row.plannedDueDate);
      const rawStart = String(row.plannedStartDate || "").trim();
      const rawDue = String(row.plannedDueDate || "").trim();
      const definedStage = definitions.get(row.serviceCode);

      if (!rawStart || rawStart.toUpperCase() === "NULL") issues.push({ serviceCode: row.serviceCode, reason: "missing_start" });
      else if (!plannedStartDate) issues.push({ serviceCode: row.serviceCode, reason: "invalid_start" });
      if (!rawDue || rawDue.toUpperCase() === "NULL") issues.push({ serviceCode: row.serviceCode, reason: "missing_due" });
      else if (!plannedDueDate) issues.push({ serviceCode: row.serviceCode, reason: "invalid_due" });
      if (plannedStartDate && plannedDueDate && plannedStartDate > plannedDueDate) issues.push({ serviceCode: row.serviceCode, reason: "start_after_due" });
      if (serviceDefinitions.length && !definedStage) issues.push({ serviceCode: row.serviceCode, reason: "unknown_service" });
      else if (definedStage && definedStage !== row.stageCode) issues.push({ serviceCode: row.serviceCode, reason: "stage_mismatch" });

      return {
        serviceCode: row.serviceCode,
        stageCode: row.stageCode,
        plannedStartDate,
        plannedDueDate,
      };
    })
    .sort((left, right) => left.stageCode.localeCompare(right.stageCode) || left.serviceCode.localeCompare(right.serviceCode));

  const stageCount = new Set(services.map(service => service.stageCode)).size;
  const validServices = services.filter(service => service.plannedStartDate && service.plannedDueDate && service.plannedStartDate <= service.plannedDueDate);
  const dates = validServices.flatMap(service => [service.plannedStartDate!, service.plannedDueDate!]);
  const snapshot = {
    schemaVersion: PROJECT_PROGRAM_SCHEMA_VERSION,
    services,
  };

  return {
    snapshot,
    programHash: hashProgramValue(snapshot),
    serviceCount: services.length,
    stageCount,
    scheduledServiceCount: validServices.length,
    earliestStartDate: dates.length ? [...dates].sort()[0] : null,
    latestDueDate: dates.length ? [...dates].sort().at(-1) ?? null : null,
    issues,
    isSourceComplete: services.length > 0 && issues.length === 0,
  };
}

function issueSummary(issues: ProgramIssue[]) {
  const codes = new Set(issues.map(issue => issue.serviceCode));
  const missing = issues.filter(issue => issue.reason === "missing_start" || issue.reason === "missing_due").length;
  const invalid = issues.length - missing;
  if (missing && invalid) return `${codes.size} خدمة تحتاج استكمال أو تصحيح مواعيدها.`;
  if (missing) return `${codes.size} خدمة لا تحمل تاريخ بدء واستحقاق كاملين.`;
  return `${codes.size} خدمة تحمل تاريخًا غير صالح أو علاقة مرحلة غير متسقة.`;
}

export function deriveProjectProgramState(input: {
  source: ReturnType<typeof inspectProgramSources>;
  approvals: ProgramApprovalRow[];
}) {
  const latestDecision = input.approvals[0] ?? null;
  const latestApproved = input.approvals.find(item => item.decisionStatus === "approved") ?? null;
  let status: ProjectProgramStatus;
  let reason: string;
  let nextAction: string;

  if (input.source.serviceCount === 0) {
    status = "no_program";
    reason = "لم تُسجل أي خدمة ضمن البرنامج الأولي لهذا المشروع.";
    nextAction = "افتح جولة مراحل التطوير وحدد الخدمات الأساسية ومواعيدها.";
  } else if (!input.source.isSourceComplete) {
    const hasReferenceIssue = input.source.issues.some(issue => issue.reason === "unknown_service" || issue.reason === "stage_mismatch");
    status = hasReferenceIssue ? "invalid_program" : "incomplete_program";
    reason = issueSummary(input.source.issues);
    nextAction = "صحح مواعيد وخدمات البرنامج من جولة مراحل التطوير ثم راجعه من جديد.";
  } else if (!latestDecision || latestDecision.decisionStatus !== "approved") {
    status = "no_approved_program";
    reason = latestDecision
      ? `آخر مراجعة للبرنامج حالتها ${latestDecision.decisionStatus === "rejected" ? "مرفوض" : "تمت المراجعة دون اعتماد"}.`
      : "البرنامج مؤرخ بالكامل لكنه لم يعتمد بعد كأساس أولي للتكليف.";
    nextAction = "راجع لقطة البرنامج واعتمدها صراحة قبل فتح طلب عروض الاستشاريين.";
  } else if (latestDecision.sourceSchemaVersion !== PROJECT_PROGRAM_SCHEMA_VERSION || latestDecision.programHash !== input.source.programHash) {
    status = "needs_reapproval";
    reason = "تغيرت خدمات البرنامج أو مواعيده بعد آخر اعتماد؛ بقي الاعتماد السابق محفوظًا للتاريخ فقط.";
    nextAction = "راجع النسخة الحالية من البرنامج واعتمدها من جديد قبل متابعة التكليف.";
  } else {
    status = "current_valid";
    reason = "البرنامج الأولي المعتمد مطابق لكامل خدمات المشروع ومواعيدها الحالية.";
    nextAction = "يمكن متابعة حزمة التكليف مع بقاء النطاق وقرار التعيين بوابتين مستقلتين.";
  }

  return {
    status,
    isValid: status === "current_valid",
    reason,
    nextAction,
    ...input.source,
    latestDecision,
    latestApproved,
  };
}

export async function loadProjectProgramState(db: any, projectId: number) {
  const [instances, definitions, approvals] = await Promise.all([
    db.select({
      id: projectServiceInstances.id,
      projectId: projectServiceInstances.projectId,
      serviceCode: projectServiceInstances.serviceCode,
      stageCode: projectServiceInstances.stageCode,
      plannedStartDate: projectServiceInstances.plannedStartDate,
      plannedDueDate: projectServiceInstances.plannedDueDate,
    }).from(projectServiceInstances).where(eq(projectServiceInstances.projectId, projectId)),
    db.select({ serviceCode: lifecycleServices.serviceCode, stageCode: lifecycleServices.stageCode }).from(lifecycleServices),
    db.select({
      id: projectProgramApprovals.id,
      decisionStatus: projectProgramApprovals.decisionStatus,
      sourceSchemaVersion: projectProgramApprovals.sourceSchemaVersion,
      programHash: projectProgramApprovals.programHash,
      serviceCount: projectProgramApprovals.serviceCount,
      stageCount: projectProgramApprovals.stageCount,
      earliestStartDate: projectProgramApprovals.earliestStartDate,
      latestDueDate: projectProgramApprovals.latestDueDate,
      notes: projectProgramApprovals.notes,
      decidedAt: projectProgramApprovals.decidedAt,
    }).from(projectProgramApprovals)
      .where(eq(projectProgramApprovals.projectId, projectId))
      .orderBy(desc(projectProgramApprovals.decidedAt), desc(projectProgramApprovals.id)),
  ]);

  return deriveProjectProgramState({
    source: inspectProgramSources(instances, definitions),
    approvals,
  });
}
