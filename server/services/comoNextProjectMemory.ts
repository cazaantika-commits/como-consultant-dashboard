import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { and, eq } from "drizzle-orm";
import {
  comoNextMemoryAnnotations,
  comoNextOwnerPreferences,
  comoNextProjectDossiers,
  comoNextWorkFiles,
  comoNextWorkMemory,
  projects,
} from "../../drizzle/schema";
import { getDb } from "../db";
import { appendEvent } from "./comoNextCommands";

export const REVIEWED_PROJECT_MEMORY_MANIFEST =
  "/home/ubuntu/como-consultant-dashboard/migration/como-project-memory-reviewed.json";
export const PROJECT_MEMORY_SOURCE_SYSTEM = "como_followup_memory_audit";

type Blueprint = {
  projectName: string;
  executiveContext: string;
  currentPosition: string;
  lifecyclePhases: string[];
  keyParties: string[];
  dependencies: string[];
  openThreads: string[];
  memoryGaps: string[];
};

type Candidate = {
  body: string;
  confidence: "medium" | "high";
  dedupeKey: string;
  evidenceRefs: string[];
  memoryType: "fact" | "context" | "relationship" | "constraint" | "owner_preference";
  project: string;
  sensitivity: "internal_only";
  sourceWorkFileId: string;
  targetWorkFileId: number | null;
  title: string;
  sourceReportSha256: string;
};

type ReviewedMemoryManifest = {
  schemaVersion: number;
  sourceAuditJob: string;
  sourceReport: string;
  sourceReportSha256: string;
  auditedAt: string;
  workFilesAudited: number;
  workFilesFailed: number;
  projectBlueprints: Blueprint[];
  promotionCandidates: Candidate[];
};

function rows<T>(result: unknown): T[] {
  if (Array.isArray(result) && Array.isArray(result[0])) return result[0] as T[];
  return result as T[];
}

function stableSha256(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function dossierSourceRecordId(projectId: number) {
  return `reviewed-project-dossier:${projectId}`;
}

function projectKind(value: string) {
  if (/Majan|مجان/i.test(value)) return "majan";
  if (/Four Residential Villas|فلل|6180578/i.test(value)) return "villas";
  return null;
}

async function loadManifest(path = REVIEWED_PROJECT_MEMORY_MANIFEST): Promise<ReviewedMemoryManifest> {
  const parsed = JSON.parse(await readFile(path, "utf8")) as ReviewedMemoryManifest;
  if (parsed.schemaVersion !== 1 || parsed.workFilesFailed !== 0 || parsed.promotionCandidates.length !== 16) {
    throw new Error("Reviewed project-memory manifest failed its integrity gate");
  }
  return parsed;
}

export async function promoteReviewedProjectMemory(path = REVIEWED_PROJECT_MEMORY_MANIFEST) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const manifest = await loadManifest(path);

  return db.transaction(async tx => {
    const workFileIds = [...new Set(manifest.promotionCandidates.map(item => item.targetWorkFileId).filter((id): id is number => Number.isInteger(id)))];
    const workFiles = workFileIds.length
      ? await tx.select({ id: comoNextWorkFiles.id, projectId: comoNextWorkFiles.projectId, userId: comoNextWorkFiles.userId })
        .from(comoNextWorkFiles)
      : [];
    const workFileMap = new Map(workFiles.filter(row => workFileIds.includes(row.id)).map(row => [row.id, row]));
    if (workFileMap.size !== workFileIds.length) throw new Error("A reviewed memory target work file is missing");

    const projectRows = await tx.select({ id: projects.id, name: projects.name, isTestProject: projects.isTestProject }).from(projects);
    const projectRowsById = new Map(projectRows.map(project => [project.id, project]));
    const projectMap = new Map<string, { id: number; name: string }>();
    for (const candidate of manifest.promotionCandidates) {
      if (!candidate.targetWorkFileId) continue;
      const kind = projectKind(candidate.project);
      const workFile = workFileMap.get(candidate.targetWorkFileId);
      const project = workFile ? projectRowsById.get(workFile.projectId) : null;
      if (!kind || !project || Number(project.isTestProject) === 1 || projectKind(project.name) !== kind) {
        throw new Error(`Reviewed candidate ${candidate.dedupeKey} failed its approved work-file anchor`);
      }
      const current = projectMap.get(kind);
      if (current && current.id !== project.id) throw new Error(`Reviewed ${kind} candidates span multiple projects`);
      projectMap.set(kind, { id: project.id, name: project.name });
    }
    if (!projectMap.has("majan") || !projectMap.has("villas")) throw new Error("Approved project mapping is incomplete");

    let dossiersInserted = 0;
    let memoriesInserted = 0;
    let annotationsInserted = 0;
    let preferencesInserted = 0;
    const promotedByWorkFile = new Map<number, number>();

    for (const blueprint of manifest.projectBlueprints) {
      const kind = projectKind(blueprint.projectName);
      const targetProject = kind ? projectMap.get(kind) : null;
      if (!targetProject) throw new Error(`Unmapped reviewed blueprint: ${blueprint.projectName}`);
      const sourceRecordId = dossierSourceRecordId(targetProject.id);
      const sourceSha256 = stableSha256(blueprint);
      const [existing] = await tx.select({ id: comoNextProjectDossiers.id, sourceSha256: comoNextProjectDossiers.sourceSha256 })
        .from(comoNextProjectDossiers)
        .where(eq(comoNextProjectDossiers.projectId, targetProject.id))
        .limit(1);
      if (existing) {
        if (existing.sourceSha256 !== sourceSha256) throw new Error(`Project dossier ${targetProject.id} already exists with different reviewed content`);
        continue;
      }
      await tx.insert(comoNextProjectDossiers).values({
        projectId: targetProject.id,
        executiveContext: blueprint.executiveContext,
        currentPosition: blueprint.currentPosition,
        lifecyclePhasesJson: JSON.stringify(blueprint.lifecyclePhases),
        keyPartiesJson: JSON.stringify(blueprint.keyParties),
        dependenciesJson: JSON.stringify(blueprint.dependencies),
        openThreadsJson: JSON.stringify(blueprint.openThreads),
        memoryGapsJson: JSON.stringify(blueprint.memoryGaps),
        briefStatus: "reviewed",
        sourceSystem: PROJECT_MEMORY_SOURCE_SYSTEM,
        sourceRecordId,
        sourceSha256,
      });
      dossiersInserted += 1;
    }

    for (const candidate of manifest.promotionCandidates) {
      if (candidate.memoryType === "owner_preference") {
        const sourceSha256 = stableSha256(candidate);
        const [existing] = await tx.select({ id: comoNextOwnerPreferences.id, sourceSha256: comoNextOwnerPreferences.sourceSha256 })
          .from(comoNextOwnerPreferences)
          .where(and(eq(comoNextOwnerPreferences.memberId, "abdulrahman"), eq(comoNextOwnerPreferences.preferenceKey, "proactive_executive_briefing")))
          .limit(1);
        if (existing) {
          if (existing.sourceSha256 !== sourceSha256) throw new Error("Owner briefing preference exists with different reviewed content");
          continue;
        }
        await tx.insert(comoNextOwnerPreferences).values({
          memberId: "abdulrahman",
          preferenceKey: "proactive_executive_briefing",
          title: candidate.title,
          body: candidate.body,
          sensitivity: "internal_only",
          evidenceRefsJson: JSON.stringify(candidate.evidenceRefs),
          sourceSystem: PROJECT_MEMORY_SOURCE_SYSTEM,
          sourceRecordId: candidate.dedupeKey,
          sourceSha256,
          isCurrent: 1,
        });
        preferencesInserted += 1;
        continue;
      }

      if (!candidate.targetWorkFileId) throw new Error(`Candidate ${candidate.dedupeKey} has no target work file`);
      const target = workFileMap.get(candidate.targetWorkFileId);
      if (!target) throw new Error(`Candidate ${candidate.dedupeKey} targets an unavailable work file`);
      const candidateKind = projectKind(candidate.project);
      const expectedProject = candidateKind ? projectMap.get(candidateKind) : null;
      if (!expectedProject || expectedProject.id !== target.projectId) throw new Error(`Candidate ${candidate.dedupeKey} failed project scoping`);

      const [existing] = await tx.select({ id: comoNextWorkMemory.id, title: comoNextWorkMemory.title, body: comoNextWorkMemory.body })
        .from(comoNextWorkMemory)
        .where(and(eq(comoNextWorkMemory.sourceSystem, PROJECT_MEMORY_SOURCE_SYSTEM), eq(comoNextWorkMemory.sourceRecordId, candidate.dedupeKey)))
        .limit(1);
      let memoryId: number;
      if (existing) {
        if (existing.title !== candidate.title || existing.body !== candidate.body) throw new Error(`Memory ${candidate.dedupeKey} exists with different content`);
        memoryId = Number(existing.id);
      } else {
        const [inserted] = await tx.insert(comoNextWorkMemory).values({
          projectId: target.projectId,
          workFileId: target.id,
          memoryType: candidate.memoryType === "fact" ? "material" : "note",
          entryType: candidate.memoryType,
          title: candidate.title,
          body: candidate.body,
          sourceStatus: `reviewed_${candidate.confidence}_internal_only`,
          isCurrent: 1,
          sourceSystem: PROJECT_MEMORY_SOURCE_SYSTEM,
          sourceRecordId: candidate.dedupeKey,
        }).$returningId();
        memoryId = Number(inserted.id);
        memoriesInserted += 1;
        promotedByWorkFile.set(target.id, (promotedByWorkFile.get(target.id) || 0) + 1);
      }

      const [annotation] = await tx.select({ id: comoNextMemoryAnnotations.id })
        .from(comoNextMemoryAnnotations)
        .where(eq(comoNextMemoryAnnotations.memoryId, memoryId))
        .limit(1);
      if (!annotation) {
        await tx.insert(comoNextMemoryAnnotations).values({
          memoryId,
          confidence: candidate.confidence,
          sensitivity: "internal_only",
          evidenceRefsJson: JSON.stringify(candidate.evidenceRefs),
          sourceReportSha256: manifest.sourceReportSha256,
        });
        annotationsInserted += 1;
      }
    }

    for (const [workFileId, count] of promotedByWorkFile) {
      const target = workFileMap.get(workFileId)!;
      await appendEvent(tx, {
        userId: target.userId,
        projectId: target.projectId,
        workFileId,
        actorType: "system",
        eventType: "reviewed_memory_promoted",
        summary: `أضيفت ${count} عناصر ذاكرة موثقة من حزمة COMO السابقة بعد مراجعة الدليل ومنع التكرار، دون تغيير أي قرار أو إجراء أو مراسلة.`,
        payload: { count, sourceReportSha256: manifest.sourceReportSha256 },
        idempotencyKey: `reviewed-project-memory:${manifest.sourceReportSha256}:${workFileId}`,
      });
    }

    return {
      reportSha256: manifest.sourceReportSha256,
      dossiersInserted,
      memoriesInserted,
      annotationsInserted,
      preferencesInserted,
      operationalEffects: { decisions: 0, actions: 0, communications: 0, meetings: 0 },
    };
  });
}
