import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const importer = readFileSync(new URL("../scripts/comoFollowupImporter.ts", import.meta.url), "utf8");
const stageLoader = readFileSync(new URL("../scripts/comoFollowupStage.ts", import.meta.url), "utf8");
const promotionLoader = readFileSync(new URL("../scripts/comoFollowupPromote.ts", import.meta.url), "utf8");
const documentLoader = readFileSync(new URL("../scripts/comoFollowupCopyDocuments.ts", import.meta.url), "utf8");
const documentRoute = readFileSync(new URL("./comoNextDocumentRoute.ts", import.meta.url), "utf8");
const comoNextRouterSource = readFileSync(new URL("./routers/comoNext.ts", import.meta.url), "utf8");
const comoNextPageSource = readFileSync(new URL("../client/src/pages/ComoNextTodayPage.tsx", import.meta.url), "utf8");
const serverIndexSource = readFileSync(new URL("./_core/index.ts", import.meta.url), "utf8");
const stageMigration = readFileSync(new URL("../drizzle/0078_como_next_transfer_staging.sql", import.meta.url), "utf8");
const promotionMigration = readFileSync(new URL("../drizzle/0079_como_next_operational_promotion.sql", import.meta.url), "utf8");
const documentMigration = readFileSync(new URL("../drizzle/0080_como_next_documents.sql", import.meta.url), "utf8");
const documentChunkMigration = readFileSync(new URL("../drizzle/0081_como_next_document_chunks.sql", import.meta.url), "utf8");
const decisionMigration = readFileSync(new URL("../drizzle/0082_como_next_decision_register.sql", import.meta.url), "utf8");
const communicationLoader = readFileSync(new URL("../scripts/comoFollowupPromoteCommunications.ts", import.meta.url), "utf8");
const communicationMigration = readFileSync(new URL("../drizzle/0083_como_next_communications.sql", import.meta.url), "utf8");
const mapping = JSON.parse(readFileSync(new URL("../migration/como-followup-candidate-mapping.json", import.meta.url), "utf8"));
const summary = JSON.parse(readFileSync(new URL("../migration-results/COMO-FUD-2026-09-25-02/dry-run-summary.json", import.meta.url), "utf8"));
const conflicts = JSON.parse(readFileSync(new URL("../migration-results/COMO-FUD-2026-09-25-02/conflicts.json", import.meta.url), "utf8"));
const stageResult = JSON.parse(readFileSync(new URL("../migration-results/COMO-FUD-2026-09-25-02/STAGE_RESULT.json", import.meta.url), "utf8"));
const promotionPlan = JSON.parse(readFileSync(new URL("../migration-results/COMO-FUD-2026-09-25-02/PROMOTION_PLAN.json", import.meta.url), "utf8"));
const documentPlan = JSON.parse(readFileSync(new URL("../migration-results/COMO-FUD-2026-09-25-02/DOCUMENT_COPY_PLAN.json", import.meta.url), "utf8"));

describe("Follow-up Desk importer safety boundary", () => {
  it("supports plan and dry-run only", () => {
    expect(importer).toContain('["plan", "dry-run"].includes(mode)');
    expect(importer).toContain("apply/rollback are intentionally disabled");
    expect(importer).not.toMatch(/\b(INSERT\s+INTO|UPDATE\s+[`A-Za-z]|DELETE\s+FROM|DROP\s+TABLE|TRUNCATE\s+TABLE)\b/i);
  });

  it("rejects exported secrets and records zero side effects", () => {
    expect(importer).toContain('sourceTables.get("integrationSecrets")');
    expect(importer).toContain("Secret records are present in the export; dry-run stopped");
    expect(summary.writesExecuted).toBe(0);
    expect(summary.externalSideEffects).toBe(0);
    expect(summary.excludedSecretCount).toBe(1);
  });

  it("reconciles every exported record and verifies the file manifest", () => {
    expect(summary.sourceTableCount).toBe(23);
    expect(summary.sourceCount).toBe(1193);
    expect(summary.exportedRecordCount).toBe(1192);
    expect(summary.plannedRowCount).toBe(1192);
    expect(summary.manifestEntries).toBe(87);
    expect(summary.exportedFilesVerified).toBe(80);
    expect(summary.uniqueFilePayloads).toBe(71);
    expect(summary.sourceDuplicateFileReferences).toBe(9);
  });

  it("preserves target authority and records both approved project decisions", () => {
    expect(mapping.approved).toBe(true);
    expect(mapping.users["1"]).toMatchObject({ targetId: 3330456, status: "confirmed" });
    expect(mapping.users["750001"]).toMatchObject({ targetId: 1, status: "confirmed" });
    expect(mapping.users["10680001"]).toMatchObject({ targetId: 1890097, status: "confirmed" });
    expect(mapping.projects["1"]).toMatchObject({ targetId: 1, status: "confirmed" });
    expect(mapping.projects["2"]).toMatchObject({ targetId: 6, status: "confirmed" });
    expect(mapping.projects["30001"]).toMatchObject({ targetId: null, status: "exclude_temporarily" });
    expect(conflicts.summary).toEqual({ total: 0, blocking: 0 });
    expect(summary.readyForApply).toBe(true);
  });

  it("permits writes only to the three isolated staging tables", () => {
    const insertTargets = [...stageLoader.matchAll(/INSERT INTO ([a-zA-Z0-9_]+)/g)].map(match => match[1]);
    const updateTargets = [...stageLoader.matchAll(/UPDATE ([a-zA-Z0-9_]+)/g)].map(match => match[1]);
    expect(new Set(insertTargets)).toEqual(new Set(["como_next_import_batches", "como_next_import_rows", "como_next_import_files"]));
    expect(new Set(updateTargets)).toEqual(new Set(["como_next_import_batches"]));
    expect(stageLoader).not.toMatch(/storagePut|notifyOwner|sendMail|invokeLLM|createTask|schedule/i);
    expect(stageMigration).not.toMatch(/^\s*(DROP|TRUNCATE|DELETE\s+FROM|UPDATE\s+|ALTER\s+TABLE)/im);
    expect([...stageMigration.matchAll(/CREATE TABLE `([^`]+)`/g)].map(match => match[1])).toEqual([
      "como_next_import_batches",
      "como_next_import_rows",
      "como_next_import_files",
    ]);
  });

  it("reconciles the staged batch without promoting operational records", () => {
    expect(stageResult).toMatchObject({
      batchStatus: "staged",
      sourceRecordCount: 1193,
      stagedRecordCount: 1163,
      skippedRecordCount: 29,
      stagedFileCount: 87,
      actualRowCount: 1192,
      actualFileCount: 87,
      uniqueFilePayloads: 71,
      operationalRecordsPromoted: 0,
      externalSideEffects: 0,
      reversibleByBatchDelete: true,
    });
    expect(stageResult.writesLimitedTo).toEqual([
      "como_next_import_batches",
      "como_next_import_rows",
      "como_next_import_files",
    ]);
  });

  it("plans the operational projection with zero writes before apply", () => {
    expect(promotionPlan).toMatchObject({
      mode: "plan",
      batchId: "COMO-FUD-2026-09-25-02",
      expected: {
        projects: 2,
        parties: 15,
        workFiles: 11,
        decisions: 1,
        workEntries: 225,
        events: 586,
        meetings: 4,
      },
      writesExecuted: 0,
    });
  });

  it("limits promotion to clean COMO Next and staging records", () => {
    expect(promotionLoader).toContain('const apply = args.includes("--apply")');
    expect(promotionLoader).toContain("GET_LOCK");
    expect(promotionLoader).toContain("batch_status = 'reviewed'");
    expect(promotionLoader).toContain("batch_status = 'promoted'");
    expect(promotionLoader).not.toContain("await connection.beginTransaction()");
    expect(promotionLoader).toContain("como_next_work_file_events");
    expect(promotionLoader).toContain("followup:decision:");
    expect(promotionLoader).not.toMatch(/storagePut|notifyOwner|sendMail|invokeLLM|createTask|schedule/i);

    const insertTargets = [...promotionLoader.matchAll(/INSERT(?:\s+IGNORE)?\s+INTO\s+([a-zA-Z0-9_]+)/g)].map(match => match[1]);
    expect(new Set(insertTargets)).toEqual(new Set([
      "como_next_parties",
      "como_next_party_contacts",
      "como_next_project_parties",
      "como_next_work_files",
      "como_next_work_file_parties",
      "como_next_actions",
      "como_next_decisions",
      "como_next_work_memory",
      "como_next_work_file_events",
      "como_next_meetings",
      "como_next_meeting_participants",
      "como_next_meeting_agenda_items",
    ]));
    expect(promotionMigration).not.toMatch(/^\s*(DROP|TRUNCATE|DELETE\s+FROM|UPDATE\s+|ALTER\s+TABLE)/im);
    expect([...promotionMigration.matchAll(/CREATE TABLE `([^`]+)`/g)].map(match => match[1])).toEqual([
      "como_next_party_contacts",
      "como_next_work_memory",
      "como_next_meetings",
      "como_next_meeting_participants",
      "como_next_meeting_agenda_items",
    ]);
    expect(decisionMigration).not.toMatch(/^\s*(DROP|TRUNCATE|DELETE\s+FROM|UPDATE\s+|ALTER\s+TABLE)/im);
    expect(decisionMigration).toContain("CREATE TABLE IF NOT EXISTS `como_next_decisions`");
  });

  it("plans checksum-verified document storage with zero writes", () => {
    expect(documentPlan).toMatchObject({
      mode: "plan",
      batchId: "COMO-FUD-2026-09-25-02",
      matchedMemoryReferences: 37,
      uniqueFiles: 34,
      totalBytes: 231547515,
      externalSideEffects: 0,
      writesExecuted: 0,
    });
  });

  it("limits document copy to verified storage and clean COMO Next document tables", () => {
    expect(documentLoader).toContain('const apply = args.includes("--apply")');
    expect(documentLoader).toContain("GET_LOCK");
    expect(documentLoader).toContain("Checksum mismatch");
    expect(documentLoader).toContain("storagePutWithRetry(storageKey, content, mimeType)");
    expect(documentLoader).toContain("createHmac");
    expect(documentLoader).toContain("process.env.JWT_SECRET");
    expect(documentLoader).toContain("como-next/private/");
    expect(documentLoader).toContain("CHUNK_SIZE");
    expect(documentLoader).toContain("storagePutWithRetry");
    expect(documentLoader).not.toMatch(/notifyOwner|sendMail|invokeLLM|createTask|schedule/i);

    const insertTargets = [...documentLoader.matchAll(/INSERT(?:\s+IGNORE)?\s+INTO\s+([a-zA-Z0-9_]+)/g)].map(match => match[1]);
    expect(new Set(insertTargets)).toEqual(new Set([
      "como_next_documents",
      "como_next_document_chunks",
      "como_next_work_memory_documents",
    ]));
    expect(documentMigration).not.toMatch(/^\s*(DROP|TRUNCATE|DELETE\s+FROM|UPDATE\s+|ALTER\s+TABLE)/im);
    expect([...documentMigration.matchAll(/CREATE TABLE IF NOT EXISTS `([^`]+)`/g)].map(match => match[1])).toEqual([
      "como_next_documents",
      "como_next_work_memory_documents",
    ]);
    expect(documentChunkMigration).not.toMatch(/^\s*(DROP|TRUNCATE|DELETE\s+FROM|UPDATE\s+|ALTER\s+TABLE)/im);
    expect(documentChunkMigration).toContain("CREATE TABLE IF NOT EXISTS `como_next_document_chunks`");
  });

  it("delivers promoted documents only through authenticated project access", () => {
    expect(documentRoute).toContain("sdk.authenticateRequest(req)");
    expect(documentRoute).toContain("requireProjectAccess");
    expect(documentRoute).toContain("storageGet(links[0].storageKey)");
    expect(documentRoute).toContain("comoNextDocumentChunks");
    expect(documentRoute).toContain("res.write(bytes)");
    expect(documentRoute).toContain('createHash("sha256")');
    expect(documentRoute).toContain('res.set("Cache-Control", "private, no-store")');
    expect(documentRoute).not.toContain("res.redirect");
    expect(serverIndexSource).toContain("registerComoNextDocumentRoute(app)");
    expect(comoNextRouterSource).toContain("downloadPath: `/api/como-next/documents/");
    expect(comoNextRouterSource).not.toContain("document_row.storage_url AS storageUrl");
    expect(comoNextPageSource).toContain("href={document.downloadPath}");
    expect(comoNextPageSource).not.toContain("href={document.storageUrl}");
  });

  it("promotes correspondence only into the clean register and never sends externally", () => {
    expect(communicationLoader).toContain('const apply = process.argv.includes("--apply")');
    expect(communicationLoader).toContain("directCommunicationTypes");
    expect(communicationLoader).toContain("INSERT IGNORE INTO como_next_communications");
    expect(communicationLoader).toContain("externalSideEffects: 0");
    expect(communicationLoader).not.toMatch(/sendMail|nodemailer|smtpTransport|notifyOwner|invokeLLM|createTask|schedule/i);
    expect(communicationMigration).not.toMatch(/^\s*(DROP|TRUNCATE|DELETE\s+FROM|UPDATE\s+|ALTER\s+TABLE)/im);
    expect([...communicationMigration.matchAll(/CREATE TABLE `([^`]+)`/g)].map(match => match[1])).toEqual(["como_next_communications"]);
  });
});
