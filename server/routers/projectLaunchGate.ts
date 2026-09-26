import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { requireProjectAccess } from "../services/comoNextCommands";
import { buildProjectFoundation, loadProjectFoundation } from "../services/comoNextProjectFoundation";

export const buildProjectLaunchGate = buildProjectFoundation;

export const projectLaunchGateRouter = router({
  get: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "قاعدة البيانات غير متاحة" });
      await requireProjectAccess(db, input.projectId, ctx.user.id, "read");
      return loadProjectFoundation(db, input.projectId);
    }),
});
