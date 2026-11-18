import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { projects, tasks } from "../../drizzle/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { getBot, getBotInfo } from "../telegramBot";
import { TRPCError } from "@trpc/server";
import { deriveAuthorizedProjectIds, requireLegacyProjectWrite, type LegacyProjectActor } from "../services/comoLegacyProjectAccess";

/** Legacy tasks have only project text and a descriptive owner name, not userId.
 * Accept an exact UNIQUE official project name only; no number/name guessing.
 */
async function taskScope(actor: LegacyProjectActor) {
  const ids = await deriveAuthorizedProjectIds(actor);
  if (!ids.length) return sql`1 = 0`;
  return sql`${tasks.project} IN (SELECT name FROM projects WHERE is_test_project = 0
    AND id IN (${sql.join(ids.map(id => sql`${id}`), sql`, `)})
    AND name IN (SELECT name FROM projects WHERE is_test_project = 0 GROUP BY name HAVING COUNT(*) = 1))`;
}
async function requireTaskProjectWrite(actor: LegacyProjectActor, name: string) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
  const matches = await db.select({ id: projects.id }).from(projects).where(and(eq(projects.name, name), eq(projects.isTestProject, 0))).limit(2);
  if (matches.length !== 1) throw new TRPCError({ code: "FORBIDDEN", message: "المهمة بلا مشروع رسمي فريد؛ يلزم ربط صريح" });
  await requireLegacyProjectWrite(actor, matches[0].id);
}
async function requireTaskWrite(actor: LegacyProjectActor, id: number) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
  const [task] = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
  if (!task) throw new TRPCError({ code: "NOT_FOUND", message: "المهمة غير موجودة" });
  await requireTaskProjectWrite(actor, task.project);
  return task;
}

const taskInput = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  project: z.string().min(1),
  category: z.string().nullable().optional(),
  owner: z.string().min(1),
  priority: z.enum(["high", "medium", "low"]).default("medium"),
  status: z.enum(["new", "progress", "hold", "done", "cancelled"]).default("new"),
  progress: z.number().min(0).max(100).default(0),
  dueDate: z.string().nullable().optional(),
  attachment: z.string().nullable().optional(),
  source: z.enum(["manual", "agent", "command"]).default("manual"),
  sourceAgent: z.string().nullable().optional(),
});

export const tasksRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.user) return [];
    const db = await getDb();
    if (!db) return [];
    const result = await db.select().from(tasks).where(await taskScope(ctx.user)).orderBy(desc(tasks.createdAt));
    return result;
  }),

  stats: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.user) return null;
    const db = await getDb();
    if (!db) return null;

    const allTasks = await db.select().from(tasks).where(await taskScope(ctx.user));
    const today = new Date().toISOString().split("T")[0];

    const total = allTasks.length;
    const newCount = allTasks.filter((t) => t.status === "new").length;
    const progress = allTasks.filter((t) => t.status === "progress").length;
    const hold = allTasks.filter((t) => t.status === "hold").length;
    const done = allTasks.filter((t) => t.status === "done").length;
    const cancelled = allTasks.filter((t) => t.status === "cancelled").length;
    const overdue = allTasks.filter(
      (t) =>
        t.dueDate &&
        t.dueDate < today &&
        t.status !== "done" &&
        t.status !== "cancelled"
    ).length;

    return { total, new: newCount, progress, hold, done, cancelled, overdue };
  }),

  create: protectedProcedure.input(taskInput).mutation(async ({ ctx, input }) => {
    if (!ctx.user) throw new Error("Unauthorized");
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    await requireTaskProjectWrite(ctx.user, input.project);
    const result = await db.insert(tasks).values({
      title: input.title,
      description: input.description ?? null,
      project: input.project,
      category: input.category ?? null,
      owner: input.owner,
      priority: input.priority,
      status: input.status,
      progress: input.progress,
      dueDate: input.dueDate ?? null,
      attachment: input.attachment ?? null,
      source: input.source,
      sourceAgent: input.sourceAgent ?? null,
    });

    return { id: result[0].insertId };
  }),

  update: protectedProcedure
    .input(z.object({ id: z.number() }).merge(taskInput.partial()))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await requireTaskWrite(ctx.user, input.id);
      if (input.project !== undefined) await requireTaskProjectWrite(ctx.user, input.project);
      const { id, ...data } = input;
      const cleanData: Record<string, any> = {};
      for (const [key, value] of Object.entries(data)) {
        if (value !== undefined) cleanData[key] = value;
      }

      await db.update(tasks).set(cleanData).where(eq(tasks.id, id));
      return { success: true };
    }),

  markDone: protectedProcedure.input(z.number()).mutation(async ({ ctx, input }) => {
    if (!ctx.user) throw new Error("Unauthorized");
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    await requireTaskWrite(ctx.user, input);
    await db
      .update(tasks)
      .set({ status: "done", progress: 100 })
      .where(eq(tasks.id, input));
    return { success: true };
  }),

  renew: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const original = await requireTaskWrite(ctx.user, input.id);
      if (!original) throw new Error("المهمة الأصلية غير موجودة");
      if (original.status === "done" || original.status === "cancelled") throw new Error("لا يمكن تجديد مهمة مكتملة أو ملغاة مباشرة");

      await db.update(tasks).set({ status: "cancelled", progress: 0 }).where(eq(tasks.id, input.id));
      const result = await db.insert(tasks).values({
        title: original.title,
        description: `${original.description ? `${original.description}\n\n` : ""}تجديد يدوي من المهمة الأصلية #${original.id}.`,
        project: original.project,
        category: original.category,
        owner: original.owner,
        priority: original.priority,
        status: "new",
        progress: 0,
        dueDate: null,
        attachment: original.attachment,
        source: "command",
        sourceAgent: `تجديد من المهمة #${original.id}`,
      });
      return { id: result[0].insertId, originalId: original.id };
    }),

  // Agent activity log - for the UI to show agent activity
  agentActivity: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.user) return [];
    const db = await getDb();
    if (!db) return [];
    try {
      const result = await db.execute(
        sql`SELECT * FROM agentActivityLog WHERE userId = ${ctx.user.id} ORDER BY createdAt DESC LIMIT 50`
      );
      const rows = result[0] as unknown as any[];
      return rows || [];
    } catch {
      return [];
    }
  }),

  // Agent-created tasks summary
  agentStats: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.user) return null;
    const db = await getDb();
    if (!db) return null;
    const agentTasks = await db.select().from(tasks).where(and(eq(tasks.source, "agent"), await taskScope(ctx.user)));
    const byAgent: Record<string, { total: number; new: number; progress: number; done: number }> = {};
    for (const t of agentTasks) {
      const name = t.sourceAgent || "غير معروف";
      if (!byAgent[name]) byAgent[name] = { total: 0, new: 0, progress: 0, done: 0 };
      byAgent[name].total++;
      if (t.status === "new") byAgent[name].new++;
      if (t.status === "progress") byAgent[name].progress++;
      if (t.status === "done") byAgent[name].done++;
    }
    return {
      totalAgentTasks: agentTasks.length,
      byAgent,
    };
  }),

  // Telegram bot status
  telegramStatus: protectedProcedure.query(async () => {
    const bot = getBot();
    if (!bot) {
      return { connected: false, username: "", firstName: "", id: 0 };
    }
    const info = await getBotInfo();
    return {
      connected: true,
      username: info?.username || "",
      firstName: info?.firstName || "",
      id: info?.id || 0,
    };
  }),

  // Agent API - allows agents to create tasks programmatically
  agentCreate: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1),
        description: z.string().optional(),
        project: z.string().min(1),
        category: z.string().optional(),
        owner: z.string().min(1),
        priority: z.enum(["high", "medium", "low"]).default("medium"),
        dueDate: z.string().optional(),
        agentName: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await requireTaskProjectWrite(ctx.user, input.project);
    const result = await db.insert(tasks).values({
        title: input.title,
        description: input.description ?? null,
        project: input.project,
        category: input.category ?? null,
        owner: input.owner,
        priority: input.priority,
        status: "new",
        progress: 0,
        dueDate: input.dueDate ?? null,
        source: "agent",
        sourceAgent: input.agentName,
      });

      return { id: result[0].insertId, message: "Task created by agent" };
    }),
});
