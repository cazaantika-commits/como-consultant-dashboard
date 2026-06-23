import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { consultantsRegistry, consultantsRegistryFiles, consultantsCategories } from "../../drizzle/schema";
import { eq, and, like, inArray } from "drizzle-orm";
import { storagePut } from "../storage";
import { TRPCError } from "@trpc/server";

const DEFAULT_CATEGORIES = [
  "Architects",
  "Engineers",
  "Surveyors",
  "Laboratories",
  "Contractors",
  "Consultants",
  "Inspectors",
  "Lawyers",
];

export const consultantsRegistryRouter = router({
  // Get all consultants for the user
  getAll: protectedProcedure
    .input(
      z.object({
        search: z.string().optional(),
        category: z.string().optional(),
        status: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const db = await getDb();
        if (!db) return [];

        let query = db.query.consultantsRegistry.findMany({
          where: eq(consultantsRegistry.userId, ctx.user.id),
        });

        const consultants = await query;

        // Apply filters
        let filtered = consultants;
        if (input.search) {
          const searchLower = input.search.toLowerCase();
          filtered = filtered.filter(
            (c) =>
              c.companyName.toLowerCase().includes(searchLower) ||
              c.contactPerson?.toLowerCase().includes(searchLower) ||
              c.emailAddress?.toLowerCase().includes(searchLower)
          );
        }
        if (input.category) {
          filtered = filtered.filter((c) => c.category === input.category);
        }
        if (input.status) {
          filtered = filtered.filter((c) => c.status === input.status);
        }

        return filtered;
      } catch (error) {
        console.error("[ConsultantsRegistry] Error fetching consultants:", error);
        return [];
      }
    }),

  // Get single consultant with files
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      try {
        const db = await getDb();
        if (!db) return null;

        const consultant = await db.query.consultantsRegistry.findFirst({
          where: and(
            eq(consultantsRegistry.id, input.id),
            eq(consultantsRegistry.userId, ctx.user.id)
          ),
        });

        if (!consultant) return null;

        const files = await db.query.consultantsRegistryFiles.findMany({
          where: eq(consultantsRegistryFiles.consultantId, input.id),
        });

        return { ...consultant, files };
      } catch (error) {
        console.error("[ConsultantsRegistry] Error fetching consultant:", error);
        return null;
      }
    }),

  // Create new consultant
  create: protectedProcedure
    .input(
      z.object({
        companyName: z.string().min(1, "Company name required"),
        category: z.string().min(1, "Category required"),
        contactPerson: z.string().optional(),
        mobileNumber: z.string().optional(),
        emailAddress: z.string().email().optional(),
        website: z.string().url().optional().or(z.literal("")),
        status: z.enum(["quoted_only", "under_review", "appointed", "not_selected"]).default("quoted_only"),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

        const result = await db.insert(consultantsRegistry).values({
          ...input,
          userId: ctx.user.id,
          website: input.website || null,
        });

        return { id: (result as any).insertId };
      } catch (error) {
        console.error("[ConsultantsRegistry] Error creating consultant:", error);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create consultant" });
      }
    }),

  // Update consultant
  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        companyName: z.string().optional(),
        category: z.string().optional(),
        contactPerson: z.string().optional(),
        mobileNumber: z.string().optional(),
        emailAddress: z.string().optional(),
        website: z.string().optional(),
        status: z.enum(["quoted_only", "under_review", "appointed", "not_selected"]).optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

        const { id, ...updateData } = input;

        await db
          .update(consultantsRegistry)
          .set(updateData)
          .where(
            and(
              eq(consultantsRegistry.id, id),
              eq(consultantsRegistry.userId, ctx.user.id)
            )
          );

        return { success: true };
      } catch (error) {
        console.error("[ConsultantsRegistry] Error updating consultant:", error);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to update consultant" });
      }
    }),

  // Delete consultant
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

        await db
          .delete(consultantsRegistry)
          .where(
            and(
              eq(consultantsRegistry.id, input.id),
              eq(consultantsRegistry.userId, ctx.user.id)
            )
          );

        return { success: true };
      } catch (error) {
        console.error("[ConsultantsRegistry] Error deleting consultant:", error);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to delete consultant" });
      }
    }),

  // Get files for consultant
  getFiles: protectedProcedure
    .input(z.object({ consultantId: z.number() }))
    .query(async ({ ctx, input }) => {
      try {
        const db = await getDb();
        if (!db) return [];

        // Verify ownership
        const consultant = await db.query.consultantsRegistry.findFirst({
          where: and(
            eq(consultantsRegistry.id, input.consultantId),
            eq(consultantsRegistry.userId, ctx.user.id)
          ),
        });

        if (!consultant) return [];

        return await db.query.consultantsRegistryFiles.findMany({
          where: eq(consultantsRegistryFiles.consultantId, input.consultantId),
        });
      } catch (error) {
        console.error("[ConsultantsRegistry] Error fetching files:", error);
        return [];
      }
    }),

  // Upload file
  uploadFile: protectedProcedure
    .input(
      z.object({
        consultantId: z.number(),
        fileName: z.string(),
        fileData: z.string(), // Base64 encoded
        fileType: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

        // Verify ownership
        const consultant = await db.query.consultantsRegistry.findFirst({
          where: and(
            eq(consultantsRegistry.id, input.consultantId),
            eq(consultantsRegistry.userId, ctx.user.id)
          ),
        });

        if (!consultant) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Consultant not found" });
        }

        // Upload to S3
        const buffer = Buffer.from(input.fileData, "base64");
        const fileKey = `consultants/${ctx.user.id}/${input.consultantId}/${Date.now()}-${input.fileName}`;
        const { url } = await storagePut(fileKey, buffer, input.fileType || "application/octet-stream");

        // Save to database
        await db.insert(consultantsRegistryFiles).values({
          consultantId: input.consultantId,
          fileName: input.fileName,
          fileKey,
          fileUrl: url,
          fileType: input.fileType,
          fileSizeBytes: buffer.length,
        });

        return { success: true, url };
      } catch (error) {
        console.error("[ConsultantsRegistry] Error uploading file:", error);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to upload file" });
      }
    }),

  // Delete file
  deleteFile: protectedProcedure
    .input(z.object({ fileId: z.number(), consultantId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

        // Verify ownership
        const consultant = await db.query.consultantsRegistry.findFirst({
          where: and(
            eq(consultantsRegistry.id, input.consultantId),
            eq(consultantsRegistry.userId, ctx.user.id)
          ),
        });

        if (!consultant) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Consultant not found" });
        }

        await db
          .delete(consultantsRegistryFiles)
          .where(eq(consultantsRegistryFiles.id, input.fileId));

        return { success: true };
      } catch (error) {
        console.error("[ConsultantsRegistry] Error deleting file:", error);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to delete file" });
      }
    }),

  // Get categories (default + custom)
  getCategories: protectedProcedure.query(async ({ ctx }) => {
    try {
      const db = await getDb();
      if (!db) return DEFAULT_CATEGORIES;

      const customCategories = await db.query.consultantsCategories.findMany({
        where: eq(consultantsCategories.userId, ctx.user.id),
      });

      const customNames = customCategories.map((c) => c.categoryName);
      return [...DEFAULT_CATEGORIES, ...customNames];
    } catch (error) {
      console.error("[ConsultantsRegistry] Error fetching categories:", error);
      return DEFAULT_CATEGORIES;
    }
  }),

  // Add custom category
  addCategory: protectedProcedure
    .input(z.object({ categoryName: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      try {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

        // Check if already exists
        const existing = await db.query.consultantsCategories.findFirst({
          where: and(
            eq(consultantsCategories.userId, ctx.user.id),
            eq(consultantsCategories.categoryName, input.categoryName)
          ),
        });

        if (existing) {
          return { success: true, message: "Category already exists" };
        }

        await db.insert(consultantsCategories).values({
          categoryName: input.categoryName,
          userId: ctx.user.id,
        });

        return { success: true };
      } catch (error) {
        console.error("[ConsultantsRegistry] Error adding category:", error);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to add category" });
      }
    }),
});
