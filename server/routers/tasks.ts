import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { tasks } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";

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
  list: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.user) return [];
    const db = await getDb();
    if (!db) return [];
    const result = await db.select().from(tasks).orderBy(desc(tasks.createdAt));
    return result;
  }),

  stats: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.user) return null;
    const db = await getDb();
    if (!db) return null;

    const allTasks = await db.select().from(tasks);
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

  create: publicProcedure.input(taskInput).mutation(async ({ ctx, input }) => {
    if (!ctx.user) throw new Error("Unauthorized");
    const db = await getDb();
    if (!db) throw new Error("Database not available");

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

  update: publicProcedure
    .input(z.object({ id: z.number() }).merge(taskInput.partial()))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const { id, ...data } = input;
      const cleanData: Record<string, any> = {};
      for (const [key, value] of Object.entries(data)) {
        if (value !== undefined) cleanData[key] = value;
      }

      await db.update(tasks).set(cleanData).where(eq(tasks.id, id));
      return { success: true };
    }),

  markDone: publicProcedure.input(z.number()).mutation(async ({ ctx, input }) => {
    if (!ctx.user) throw new Error("Unauthorized");
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    await db
      .update(tasks)
      .set({ status: "done", progress: 100 })
      .where(eq(tasks.id, input));
    return { success: true };
  }),

  delete: publicProcedure.input(z.number()).mutation(async ({ ctx, input }) => {
    if (!ctx.user) throw new Error("Unauthorized");
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    await db.delete(tasks).where(eq(tasks.id, input));
    return { success: true };
  }),

  // Agent API - allows agents to create tasks programmatically
  agentCreate: publicProcedure
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
