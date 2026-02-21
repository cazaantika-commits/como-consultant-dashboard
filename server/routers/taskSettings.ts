import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { taskProjects, taskCategories } from "../../drizzle/schema";
import { eq, asc } from "drizzle-orm";

export const taskSettingsRouter = router({
  // ===== المشاريع =====
  listProjects: protectedProcedure.query(async () => {
    const db = await getDb();
    return db.select().from(taskProjects).orderBy(asc(taskProjects.sortOrder));
  }),

  addProject: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      color: z.string().optional(),
      icon: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      const maxOrder = await db.select({ sortOrder: taskProjects.sortOrder })
        .from(taskProjects).orderBy(asc(taskProjects.sortOrder));
      const nextOrder = maxOrder.length > 0 ? Math.max(...maxOrder.map((r: any) => r.sortOrder || 0)) + 1 : 1;
      
      await db.insert(taskProjects).values({
        name: input.name,
        color: input.color || '#6366f1',
        icon: input.icon || null,
        sortOrder: nextOrder,
      });
      return { success: true };
    }),

  updateProject: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      color: z.string().optional(),
      icon: z.string().optional(),
      isActive: z.enum(['true', 'false']).optional(),
      sortOrder: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      const { id, ...updates } = input;
      const updateData: any = {};
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.color !== undefined) updateData.color = updates.color;
      if (updates.icon !== undefined) updateData.icon = updates.icon;
      if (updates.isActive !== undefined) updateData.isActive = updates.isActive;
      if (updates.sortOrder !== undefined) updateData.sortOrder = updates.sortOrder;
      
      await db.update(taskProjects).set(updateData).where(eq(taskProjects.id, id));
      return { success: true };
    }),

  deleteProject: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      await db.delete(taskProjects).where(eq(taskProjects.id, input.id));
      return { success: true };
    }),

  // ===== التصنيفات =====
  listCategories: protectedProcedure.query(async () => {
    const db = await getDb();
    return db.select().from(taskCategories).orderBy(asc(taskCategories.sortOrder));
  }),

  addCategory: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      color: z.string().optional(),
      icon: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      const maxOrder = await db.select({ sortOrder: taskCategories.sortOrder })
        .from(taskCategories).orderBy(asc(taskCategories.sortOrder));
      const nextOrder = maxOrder.length > 0 ? Math.max(...maxOrder.map((r: any) => r.sortOrder || 0)) + 1 : 1;
      
      await db.insert(taskCategories).values({
        name: input.name,
        color: input.color || '#8b5cf6',
        icon: input.icon || null,
        sortOrder: nextOrder,
      });
      return { success: true };
    }),

  updateCategory: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      color: z.string().optional(),
      icon: z.string().optional(),
      isActive: z.enum(['true', 'false']).optional(),
      sortOrder: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      const { id, ...updates } = input;
      const updateData: any = {};
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.color !== undefined) updateData.color = updates.color;
      if (updates.icon !== undefined) updateData.icon = updates.icon;
      if (updates.isActive !== undefined) updateData.isActive = updates.isActive;
      if (updates.sortOrder !== undefined) updateData.sortOrder = updates.sortOrder;
      
      await db.update(taskCategories).set(updateData).where(eq(taskCategories.id, id));
      return { success: true };
    }),

  deleteCategory: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      await db.delete(taskCategories).where(eq(taskCategories.id, input.id));
      return { success: true };
    }),
});
