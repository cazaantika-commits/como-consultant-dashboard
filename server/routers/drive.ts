import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import {
  verifyConnection,
  listFilesInFolder,
  getFileMetadata,
  copyFile,
  createFolder,
  searchFiles,
  listSharedDrives,
} from "../googleDrive";

export const driveRouter = router({
  /** Verify connection to Google Drive */
  verifyConnection: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.user) throw new Error("Unauthorized");
    try {
      const result = await verifyConnection();
      return result;
    } catch (error: any) {
      return {
        connected: false,
        email: "",
        sharedFilesCount: 0,
        error: error.message,
      };
    }
  }),

  /** List root-level shared folders/files */
  listShared: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.user) throw new Error("Unauthorized");
    return listSharedDrives();
  }),

  /** List files inside a folder */
  listFiles: publicProcedure
    .input(
      z.object({
        folderId: z.string(),
        pageToken: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      return listFilesInFolder(input.folderId, input.pageToken);
    }),

  /** Get file/folder metadata */
  getMetadata: publicProcedure
    .input(z.string())
    .query(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      return getFileMetadata(input);
    }),

  /** Copy a file to a destination folder */
  copyFile: publicProcedure
    .input(
      z.object({
        fileId: z.string(),
        destinationFolderId: z.string(),
        newName: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      return copyFile(input.fileId, input.destinationFolderId, input.newName);
    }),

  /** Create a new folder */
  createFolder: publicProcedure
    .input(
      z.object({
        name: z.string().min(1),
        parentFolderId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      return createFolder(input.name, input.parentFolderId);
    }),

  /** Search for files by name */
  searchFiles: publicProcedure
    .input(
      z.object({
        query: z.string().min(1),
        folderId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      return searchFiles(input.query, input.folderId);
    }),

  /** Copy multiple files to a destination folder (batch) */
  copyBatch: publicProcedure
    .input(
      z.object({
        fileIds: z.array(z.string()),
        destinationFolderId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      const results = [];
      const errors = [];
      for (const fileId of input.fileIds) {
        try {
          const copied = await copyFile(fileId, input.destinationFolderId);
          results.push(copied);
        } catch (error: any) {
          errors.push({ fileId, error: error.message });
        }
      }
      return { copied: results, errors };
    }),
});
