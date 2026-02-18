import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { consultants, consultantProfiles, consultantNotes } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";

export const profilesRouter = router({
  // Get all consultants with their profiles
  listWithProfiles: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    const allConsultants = await db.select().from(consultants).where(eq(consultants.userId, ctx.user.id));
    const allProfiles = await db.select().from(consultantProfiles);
    
    return allConsultants.map(c => {
      const profile = allProfiles.find(p => p.consultantId === c.id);
      return { ...c, profile: profile || null };
    });
  }),

  // Get single consultant profile with notes
  getDetail: protectedProcedure
    .input(z.object({ consultantId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return null;

      const [consultant] = await db.select().from(consultants)
        .where(and(eq(consultants.id, input.consultantId), eq(consultants.userId, ctx.user.id)))
        .limit(1);
      if (!consultant) return null;

      const [profile] = await db.select().from(consultantProfiles)
        .where(eq(consultantProfiles.consultantId, input.consultantId))
        .limit(1);

      const notes = await db.select().from(consultantNotes)
        .where(and(
          eq(consultantNotes.consultantId, input.consultantId),
          eq(consultantNotes.userId, ctx.user.id)
        ))
        .orderBy(desc(consultantNotes.createdAt));

      return { consultant, profile: profile || null, notes };
    }),

  // Create or update profile
  upsertProfile: protectedProcedure
    .input(z.object({
      consultantId: z.number(),
      companyNameAr: z.string().optional(),
      founded: z.string().optional(),
      headquarters: z.string().optional(),
      website: z.string().optional(),
      employeeCount: z.string().optional(),
      specializations: z.string().optional(),
      keyProjects: z.string().optional(),
      certifications: z.string().optional(),
      overview: z.string().optional(),
      strengths: z.string().optional(),
      weaknesses: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Verify consultant belongs to user
      const [consultant] = await db.select().from(consultants)
        .where(and(eq(consultants.id, input.consultantId), eq(consultants.userId, ctx.user.id)))
        .limit(1);
      if (!consultant) throw new Error("Consultant not found");

      const { consultantId, ...profileData } = input;
      const [existing] = await db.select().from(consultantProfiles)
        .where(eq(consultantProfiles.consultantId, consultantId))
        .limit(1);

      if (existing) {
        await db.update(consultantProfiles).set(profileData)
          .where(eq(consultantProfiles.consultantId, consultantId));
      } else {
        await db.insert(consultantProfiles).values({ consultantId, ...profileData });
      }
      return { success: true };
    }),

  // Add a note
  addNote: protectedProcedure
    .input(z.object({
      consultantId: z.number(),
      title: z.string().optional(),
      content: z.string().min(1),
      category: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db.insert(consultantNotes).values({
        consultantId: input.consultantId,
        userId: ctx.user.id,
        title: input.title || null,
        content: input.content,
        category: input.category || "general",
      });
      return { success: true };
    }),

  // Update a note
  updateNote: protectedProcedure
    .input(z.object({
      noteId: z.number(),
      title: z.string().optional(),
      content: z.string().min(1),
      category: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [note] = await db.select().from(consultantNotes)
        .where(and(eq(consultantNotes.id, input.noteId), eq(consultantNotes.userId, ctx.user.id)))
        .limit(1);
      if (!note) throw new Error("Note not found");

      await db.update(consultantNotes).set({
        title: input.title || null,
        content: input.content,
        category: input.category || note.category,
      }).where(eq(consultantNotes.id, input.noteId));
      return { success: true };
    }),

  // Delete a note
  deleteNote: protectedProcedure
    .input(z.object({ noteId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [note] = await db.select().from(consultantNotes)
        .where(and(eq(consultantNotes.id, input.noteId), eq(consultantNotes.userId, ctx.user.id)))
        .limit(1);
      if (!note) throw new Error("Note not found");

      await db.delete(consultantNotes).where(eq(consultantNotes.id, input.noteId));
      return { success: true };
    }),
});
