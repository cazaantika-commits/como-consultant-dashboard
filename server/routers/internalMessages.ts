import { z } from "zod";
import { router, publicProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { TRPCError } from "@trpc/server";
import { sql, eq, and } from "drizzle-orm";
import { commandCenterMembers } from "../../drizzle/schema";
import { storagePut } from "../storage";

const MEMBER_NAMES: Record<string, string> = {
  abdulrahman: "عبدالرحمن زقوت",
  wael: "وائل",
  sheikh_issa: "الشيخ عيسى",
};

function generateMessageNumber(): string {
  const now = new Date();
  const year = now.getFullYear();
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `MSG-${year}-${rand}`;
}

// Verify cc_token and return memberId, or throw UNAUTHORIZED
async function verifyCCToken(ccToken: string): Promise<string> {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
  const [member] = await db
    .select()
    .from(commandCenterMembers)
    .where(and(eq(commandCenterMembers.accessToken, ccToken), eq(commandCenterMembers.isActive, 1)));
  if (!member) throw new TRPCError({ code: "UNAUTHORIZED", message: "رمز الدخول غير صحيح" });
  return member.memberId;
}

export const internalMessagesRouter = router({
  // Get projects list for dropdown
  getProjects: publicProcedure
    .input(z.object({ ccToken: z.string() }))
    .query(async ({ input }) => {
      await verifyCCToken(input.ccToken);
      const db = await getDb();
      if (!db) return [];
      try {
        const result = await db.execute(
          sql`SELECT id, name FROM projects ORDER BY name ASC`
        );
        const rows = (result[0] as unknown as any[]) || [];
        return rows.map((r: any) => ({ id: r.id, name: r.name }));
      } catch {
        return [];
      }
    }),

  // Get all messages for the current member (inbox + sent)
  getAll: publicProcedure
    .input(
      z.object({
        ccToken: z.string(),
        view: z.enum(["inbox", "sent", "all"]).default("inbox"),
        isArchived: z.boolean().default(false),
        priority: z.enum(["normal", "important", "urgent", "all"]).default("all"),
        messageType: z.enum(["instruction", "inquiry", "info", "follow_up", "other", "all"]).default("all"),
        projectId: z.number().nullable().optional(), // null = all, 0 = عامة
      })
    )
    .query(async ({ input }) => {
      const currentMember = await verifyCCToken(input.ccToken);
      const db = await getDb();
      if (!db) return [];
      try {
        const archivedVal = input.isArchived ? 1 : 0;
        const result = await db.execute(
          sql`SELECT * FROM internal_messages WHERE is_archived = ${archivedVal} ORDER BY created_at DESC`
        );
        let rows = (result[0] as unknown as any[]) || [];

        if (input.view === "inbox") {
          rows = rows.filter((r: any) => r.to_member === currentMember);
        } else if (input.view === "sent") {
          rows = rows.filter((r: any) => r.from_member === currentMember);
        } else {
          rows = rows.filter(
            (r: any) => r.to_member === currentMember || r.from_member === currentMember
          );
        }

        if (input.priority !== "all") {
          rows = rows.filter((r: any) => r.priority === input.priority);
        }

        if (input.messageType !== "all") {
          rows = rows.filter((r: any) => r.message_type === input.messageType);
        }

        // Filter by project: 0 = عامة (null project_id), positive = specific project
        if (input.projectId !== null && input.projectId !== undefined) {
          if (input.projectId === 0) {
            rows = rows.filter((r: any) => !r.project_id);
          } else {
            rows = rows.filter((r: any) => r.project_id === input.projectId);
          }
        }

        return rows.map((r: any) => ({
          ...r,
          fromMemberName: MEMBER_NAMES[r.from_member] || r.from_member,
          toMemberName: MEMBER_NAMES[r.to_member] || r.to_member,
          attachments: r.attachments_json ? JSON.parse(r.attachments_json) : [],
          projectName: r.project_name || null,
          deadline: r.deadline || null,
          isConvertedToTask: !!r.is_converted_to_task,
          taskRef: r.task_ref || null,
          attachmentUrl: r.attachment_url || null,
          attachmentName: r.attachment_name || null,
        }));
      } catch (e) {
        console.error("[internalMessages.getAll] error:", e);
        return [];
      }
    }),

  // Get unread count for a member
  getUnreadCount: publicProcedure
    .input(z.object({ ccToken: z.string() }))
    .query(async ({ input }) => {
      const currentMember = await verifyCCToken(input.ccToken);
      const db = await getDb();
      if (!db) return { count: 0 };
      try {
        const result = await db.execute(
          sql`SELECT COUNT(*) as count FROM internal_messages WHERE to_member = ${currentMember} AND is_read = 0 AND is_archived = 0`
        );
        const rows = (result[0] as unknown as any[]) || [];
        return { count: Number(rows[0]?.count) || 0 };
      } catch {
        return { count: 0 };
      }
    }),

  // Get single message with replies
  getById: publicProcedure
    .input(z.object({ ccToken: z.string(), id: z.number() }))
    .query(async ({ input }) => {
      await verifyCCToken(input.ccToken);
      const db = await getDb();
      if (!db) return [];
      try {
        const result = await db.execute(
          sql`SELECT * FROM internal_messages WHERE id = ${input.id} OR parent_message_id = ${input.id} ORDER BY created_at ASC`
        );
        const rows = (result[0] as unknown as any[]) || [];
        return rows.map((r: any) => ({
          ...r,
          fromMemberName: MEMBER_NAMES[r.from_member] || r.from_member,
          toMemberName: MEMBER_NAMES[r.to_member] || r.to_member,
          attachments: r.attachments_json ? JSON.parse(r.attachments_json) : [],
          projectName: r.project_name || null,
          deadline: r.deadline || null,
          isConvertedToTask: !!r.is_converted_to_task,
          taskRef: r.task_ref || null,
          attachmentUrl: r.attachment_url || null,
          attachmentName: r.attachment_name || null,
        }));
      } catch (e) {
        console.error("[internalMessages.getById] error:", e);
        return [];
      }
    }),

  // Upload file attachment
  uploadAttachment: publicProcedure
    .input(z.object({
      ccToken: z.string(),
      fileName: z.string(),
      fileBase64: z.string(), // base64 encoded file content
      mimeType: z.string().default("application/octet-stream"),
    }))
    .mutation(async ({ input }) => {
      await verifyCCToken(input.ccToken);
      try {
        const buffer = Buffer.from(input.fileBase64, "base64");
        const suffix = Date.now().toString(36);
        const key = `internal-messages/${suffix}-${input.fileName}`;
        const { url } = await storagePut(key, buffer, input.mimeType);
        return { url, name: input.fileName };
      } catch (e) {
        console.error("[internalMessages.uploadAttachment] error:", e);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "فشل رفع الملف" });
      }
    }),

  // Create new message
  create: publicProcedure
    .input(
      z.object({
        ccToken: z.string(),
        toMember: z.enum(["abdulrahman", "wael", "sheikh_issa"]),
        subject: z.string().min(1).max(500),
        body: z.string().min(1),
        priority: z.enum(["normal", "important", "urgent"]).default("normal"),
        messageType: z.enum(["instruction", "inquiry", "info", "follow_up", "other"]).default("other"),
        attachments: z.array(z.object({ name: z.string(), url: z.string() })).default([]),
        parentMessageId: z.number().optional(),
        // New fields
        projectId: z.number().nullable().optional(),
        projectName: z.string().nullable().optional(),
        deadline: z.string().nullable().optional(), // ISO date string
        attachmentUrl: z.string().nullable().optional(),
        attachmentName: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const fromMember = await verifyCCToken(input.ccToken);
      if (fromMember === input.toMember) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "لا يمكن إرسال رسالة لنفسك" });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const messageNumber = generateMessageNumber();
      const attachmentsJson = JSON.stringify(input.attachments);
      const parentId = input.parentMessageId ?? null;
      const projectId = input.projectId ?? null;
      const projectName = input.projectName ?? null;
      const deadline = input.deadline ?? null;
      const attachmentUrl = input.attachmentUrl ?? null;
      const attachmentName = input.attachmentName ?? null;

      try {
        const result = await db.execute(
          sql`INSERT INTO internal_messages 
            (message_number, from_member, to_member, subject, body, priority, message_type, 
             attachments_json, parent_message_id, project_id, project_name, deadline, 
             attachment_url, attachment_name)
           VALUES (${messageNumber}, ${fromMember}, ${input.toMember}, ${input.subject}, ${input.body}, 
                   ${input.priority}, ${input.messageType}, ${attachmentsJson}, ${parentId},
                   ${projectId}, ${projectName}, ${deadline}, ${attachmentUrl}, ${attachmentName})`
        );
        const res = result[0] as any;
        return { id: res.insertId, messageNumber };
      } catch (e) {
        console.error("[internalMessages.create] error:", e);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create message" });
      }
    }),

  // Mark as read
  markRead: publicProcedure
    .input(z.object({ ccToken: z.string(), id: z.number() }))
    .mutation(async ({ input }) => {
      await verifyCCToken(input.ccToken);
      const db = await getDb();
      if (!db) return { success: false };
      try {
        await db.execute(
          sql`UPDATE internal_messages SET is_read = 1, read_at = NOW() WHERE id = ${input.id}`
        );
        return { success: true };
      } catch {
        return { success: false };
      }
    }),

  // Archive / unarchive
  archive: publicProcedure
    .input(z.object({ ccToken: z.string(), id: z.number(), archive: z.boolean() }))
    .mutation(async ({ input }) => {
      await verifyCCToken(input.ccToken);
      const db = await getDb();
      if (!db) return { success: false };
      try {
        if (input.archive) {
          await db.execute(
            sql`UPDATE internal_messages SET is_archived = 1, archived_at = NOW() WHERE id = ${input.id}`
          );
        } else {
          await db.execute(
            sql`UPDATE internal_messages SET is_archived = 0, archived_at = NULL WHERE id = ${input.id}`
          );
        }
        return { success: true };
      } catch {
        return { success: false };
      }
    }),

  // Convert message to task
  convertToTask: publicProcedure
    .input(z.object({
      ccToken: z.string(),
      id: z.number(),
      taskRef: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const memberId = await verifyCCToken(input.ccToken);
      const db = await getDb();
      if (!db) return { success: false };
      try {
        // Get the message
        const result = await db.execute(
          sql`SELECT * FROM internal_messages WHERE id = ${input.id}`
        );
        const rows = (result[0] as unknown as any[]) || [];
        if (!rows.length) throw new TRPCError({ code: "NOT_FOUND" });
        const msg = rows[0];

        // Create a task in the tasks table if it exists
        let taskRef = input.taskRef || `TASK-MSG-${input.id}`;
        try {
          const taskResult = await db.execute(
            sql`INSERT INTO tasks (title, description, status, priority, assigned_to, created_by, due_date, source_ref)
                VALUES (${msg.subject}, ${msg.body}, 'pending', ${msg.priority}, ${msg.to_member}, ${msg.from_member}, ${msg.deadline}, ${`MSG-${input.id}`})`
          );
          const taskRes = taskResult[0] as any;
          taskRef = `TASK-${taskRes.insertId}`;
        } catch {
          // tasks table may not exist or have different schema — just mark message
        }

        await db.execute(
          sql`UPDATE internal_messages SET is_converted_to_task = 1, task_ref = ${taskRef} WHERE id = ${input.id}`
        );
        return { success: true, taskRef };
      } catch (e) {
        console.error("[internalMessages.convertToTask] error:", e);
        return { success: false };
      }
    }),

  // Delete message
  delete: publicProcedure
    .input(z.object({ ccToken: z.string(), id: z.number() }))
    .mutation(async ({ input }) => {
      await verifyCCToken(input.ccToken);
      const db = await getDb();
      if (!db) return { success: false };
      try {
        await db.execute(
          sql`DELETE FROM internal_messages WHERE id = ${input.id} OR parent_message_id = ${input.id}`
        );
        return { success: true };
      } catch {
        return { success: false };
      }
    }),
});
