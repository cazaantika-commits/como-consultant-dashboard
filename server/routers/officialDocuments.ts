import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { documentIndex, projects } from "../../drizzle/schema";
import { listFilesInFolder } from "../googleDrive";
import { indexDriveFile } from "../documentIndexService";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import {
  OFFICIAL_LAND_FOLDERS,
  extractOfficialParkingFacts,
  officialDocumentProjectKey,
  parseOfficialProjectDocumentFilename,
  projectDocumentPrefix,
} from "../officialDocumentIndexing";

export const officialDocumentsRouter = router({
  indexLandOwnershipSources: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("قاعدة البيانات غير متاحة");

    const allProjects = await db.select({
      id: projects.id,
      areaCode: projects.areaCode,
      plotNumber: projects.plotNumber,
    }).from(projects);

    const byKey = new Map<number | string, number>();
    for (const project of allProjects) {
      const prefix = projectDocumentPrefix(project.areaCode);
      if (prefix && project.plotNumber) {
        byKey.set(officialDocumentProjectKey(prefix, project.plotNumber), project.id);
      }
    }

    const results: Array<{ fileName: string; projectId: number | null; status: "indexed" | "skipped" | "failed"; reason?: string }> = [];
    for (const folder of OFFICIAL_LAND_FOLDERS) {
      const { files } = await listFilesInFolder(folder.id);
      for (const file of files) {
        const parsed = parseOfficialProjectDocumentFilename(file.name);
        if (!parsed) {
          results.push({ fileName: file.name, projectId: null, status: "skipped", reason: "اسم الملف لا يحمل رمز مشروع ورقم قطعة معتمدين" });
          continue;
        }

        const projectId = byKey.get(officialDocumentProjectKey(parsed.areaPrefix, parsed.plotNumber));
        if (!projectId) {
          results.push({ fileName: file.name, projectId: null, status: "skipped", reason: "لا يوجد مشروع يطابق رمز المنطقة ورقم القطعة" });
          continue;
        }

        const indexed = await indexDriveFile(file.id, ctx.user.id, "خازن", {
          projectId,
          category: "official_land_document",
          sourcePath: `00_Land Ownership & Plot Info/${folder.name}`,
        });
        results.push({
          fileName: file.name,
          projectId,
          status: indexed.success ? "indexed" : "failed",
          reason: indexed.error,
        });
      }
    }

    return {
      indexed: results.filter((result) => result.status === "indexed").length,
      skipped: results.filter((result) => result.status === "skipped").length,
      failed: results.filter((result) => result.status === "failed").length,
      results,
    };
  }),

  syncOfficialParkingFacts: protectedProcedure.input(z.object({ projectId: z.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("قاعدة البيانات غير متاحة");

    const officialSources = await db.select({ sourceName: documentIndex.sourceName, extractedText: documentIndex.extractedText })
      .from(documentIndex)
      .where(and(eq(documentIndex.projectId, input.projectId), eq(documentIndex.category, "official_land_document"), eq(documentIndex.indexStatus, "indexed")));

    for (const source of officialSources) {
      const parking = extractOfficialParkingFacts(source.extractedText, source.sourceName);
      if (!parking) continue;
      await db.update(projects).set({
        parkingRequirementsText: parking.requirementsText,
        parkingSourceReference: parking.sourceReference,
        parkingRulesJson: JSON.stringify(parking.rules),
      }).where(eq(projects.id, input.projectId));
      return { applied: true, sourceReference: parking.sourceReference };
    }

    return { applied: false, sourceReference: null };
  }),
});
