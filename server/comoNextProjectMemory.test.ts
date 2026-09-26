import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import mysql from "mysql2/promise";
import { getProjectExecutiveFile } from "./services/comoNextProjectDossier";
import { buildSaraRealtimeInstructions, lookupExecutiveWorkspace } from "./services/saraRealtime";

const migration = readFileSync("drizzle/0087_como_next_project_memory.sql", "utf8");
const manifest = JSON.parse(readFileSync("migration/como-project-memory-reviewed.json", "utf8"));
const promotionSource = readFileSync("server/services/comoNextProjectMemory.ts", "utf8");
const projectPage = readFileSync("client/src/pages/ComoNextProjectPage.tsx", "utf8");
const officePage = readFileSync("client/src/pages/ComoNextTodayPage.tsx", "utf8");
const appSource = readFileSync("client/src/App.tsx", "utf8");

async function connection() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL unavailable");
  return mysql.createConnection(process.env.DATABASE_URL);
}

describe("COMO Next reviewed project memory", () => {
  it("keeps migration 0087 additive and project-scoped", () => {
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS `como_next_project_dossiers`");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS `como_next_memory_annotations`");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS `como_next_owner_preferences`");
    expect(migration).toContain("FOREIGN KEY (`project_id`) REFERENCES `projects`");
    expect(migration).not.toMatch(/^\s*(?:DROP|TRUNCATE|DELETE\s+FROM|UPDATE\s+)/im);
    expect(migration).not.toContain("ALTER TABLE");
  });

  it("promotes only the 16 reviewed candidates and keeps Al Satwa archive-only", () => {
    expect(manifest.workFilesFailed).toBe(0);
    expect(manifest.projectBlueprints).toHaveLength(2);
    expect(manifest.promotionCandidates).toHaveLength(16);
    expect(manifest.promotionCandidates.filter((item: any) => item.memoryType === "owner_preference")).toHaveLength(1);
    expect(manifest.promotionCandidates.filter((item: any) => item.targetWorkFileId)).toHaveLength(15);
    expect(manifest.promotionCandidates.filter((item: any) => item.sourceWorkFileId === "work-file-240001").every((item: any) => item.targetWorkFileId === 60016)).toBe(true);
    expect(JSON.stringify(manifest.promotionCandidates)).not.toContain("work-file-60001");
    expect(JSON.stringify(manifest.archiveOnly)).toContain("work-file-60001");
  });

  it("enforces idempotency, evidence annotations, and zero operational effects in code", () => {
    expect(promotionSource).toContain("PROJECT_MEMORY_SOURCE_SYSTEM");
    expect(promotionSource).toContain("sourceRecordId: candidate.dedupeKey");
    expect(promotionSource).toContain("evidenceRefsJson: JSON.stringify(candidate.evidenceRefs)");
    expect(promotionSource).toContain("operationalEffects: { decisions: 0, actions: 0, communications: 0, meetings: 0 }");
    expect(promotionSource).not.toContain("comoNextActions");
    expect(promotionSource).not.toContain("comoNextDecisions");
    expect(promotionSource).not.toContain("comoNextCommunications");
    expect(promotionSource).not.toContain("comoNextMeetings");
  });

  it("has exactly two dossiers, fifteen reviewed memories, and one owner preference live", async () => {
    const db = await connection();
    try {
      const [[dossiers], [memory], [annotations], [preferences], [events], [satwa]]: any = await Promise.all([
        db.query("SELECT COUNT(*) c FROM como_next_project_dossiers WHERE brief_status='reviewed'"),
        db.query("SELECT COUNT(*) c FROM como_next_work_memory WHERE source_system='como_followup_memory_audit'"),
        db.query("SELECT COUNT(*) c FROM como_next_memory_annotations"),
        db.query("SELECT COUNT(*) c FROM como_next_owner_preferences WHERE member_id='abdulrahman' AND is_current=1"),
        db.query("SELECT COUNT(*) c, COUNT(DISTINCT idempotency_key) d FROM como_next_work_file_events WHERE idempotency_key LIKE 'reviewed-project-memory:%'"),
        db.query("SELECT COUNT(*) c FROM como_next_work_memory WHERE source_record_id LIKE '%work-file-60001%'"),
      ]);
      expect(Number(dossiers[0].c)).toBe(2);
      expect(Number(memory[0].c)).toBe(15);
      expect(Number(annotations[0].c)).toBe(15);
      expect(Number(preferences[0].c)).toBe(1);
      expect(Number(events[0].c)).toBe(6);
      expect(Number(events[0].d)).toBe(6);
      expect(Number(satwa[0].c)).toBe(0);
    } finally {
      await db.end();
    }
  });

  it("serves Majan and villas as unified project files with reviewed memory", async () => {
    const majan = await getProjectExecutiveFile({ userId: 1, projectId: 1 });
    const villas = await getProjectExecutiveFile({ userId: 1, projectId: 6 });
    expect(majan.dossier?.briefStatus).toBe("reviewed");
    expect(majan.summary.reviewedMemory).toBe(12);
    expect(majan.summary.pendingDecisions).toBe(1);
    expect(majan.foundation.totalGateCount).toBe(4);
    expect(majan.foundation.gates[0]?.id).toBe("facts");
    expect(villas.dossier?.briefStatus).toBe("reviewed");
    expect(villas.summary.reviewedMemory).toBe(3);
    expect(majan.reviewedMemory.every((item: any) => item.sensitivity === "internal_only")).toBe(true);
    expect(villas.reviewedMemory.every((item: any) => item.evidenceRefs.length > 0)).toBe(true);
  });

  it("keeps project memory private to authorized project access", async () => {
    await expect(getProjectExecutiveFile({ userId: 999999, projectId: 1 })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("makes Sara read the reviewed memory and give a brief without claiming execution", async () => {
    const instructions = buildSaraRealtimeInstructions({ memberId: "abdulrahman", nameAr: "عبدالرحمن", role: "owner" });
    expect(instructions).toContain("موجز قصير عن أهم المستجدات الموثقة");
    expect(instructions).toContain("project_memory");
    expect(instructions).toContain("Manus هو العقل التنفيذي");
    const result: any = await lookupExecutiveWorkspace({ memberId: "abdulrahman", nameAr: "عبدالرحمن", role: "owner" }, JSON.stringify({ category: "project_memory", project_name: "مجان" }));
    expect(result.found).toBe(true);
    expect(result.source).toBe("COMO Next reviewed project memory");
    expect(result.dossiers[0].projectId).toBe(1);
    expect(result.reviewedMemory.length).toBe(12);
  });

  it("exposes a dedicated responsive project route and links work files back to it", () => {
    expect(appSource).toContain('<Route path="/como-next/projects/:id" component={ComoNextProjectPage} />');
    expect(projectPage).toContain("getProjectExecutiveFile.useQuery");
    expect(projectPage).toContain("الملف التنفيذي الموحد");
    expect(projectPage).toContain("ذاكرة المشروع");
    expect(projectPage).toContain("مراجع الإثبات");
    expect(projectPage).toContain("بوابة تأسيس المشروع");
    expect(projectPage).toContain("data.foundation.nextDecision");
    expect(projectPage).toContain("workFileId=${workFileId}");
    expect(projectPage).not.toContain("sendMail");
    expect(officePage).toContain("الملفات التنفيذية للمشاريع");
    expect(officePage).toContain('requestParams?.get("workFileId")');
  });
});
