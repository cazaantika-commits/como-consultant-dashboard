import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { meetings, meetingParticipants, meetingFiles, meetingMessages, agents, knowledgeBase, chatHistory } from "../../drizzle/schema";
import { eq, desc, sql, and } from "drizzle-orm";
import { storagePut } from "../storage";
import { TRPCError } from "@trpc/server";
import { handleAgentChat } from "../agentChat";
import { transcribeAudio } from "../_core/voiceTranscription";
import { invokeLLM } from "../_core/llm";

const agentNameEnum = z.enum(["salwa", "farouq", "khazen", "buraq", "khaled", "alina", "baz", "joelle"]);

export const meetingsRouter = router({
  // Create a new meeting
  create: protectedProcedure
    .input(z.object({
      title: z.string().min(1),
      topic: z.string().optional(),
      agentIds: z.array(z.number()).min(1), // At least 1 agent
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Create meeting
      const [result] = await db.insert(meetings).values({
        userId: ctx.user.id,
        title: input.title,
        topic: input.topic || null,
        createdBy: "user",
      });

      const meetingId = result.insertId;

      // Add participants
      for (const agentId of input.agentIds) {
        await db.insert(meetingParticipants).values({
          meetingId: Number(meetingId),
          agentId,
        });
      }

      return { id: Number(meetingId) };
    }),

  // List all meetings
  list: protectedProcedure
    .input(z.object({
      status: z.enum(["preparing", "in_progress", "completed", "cancelled"]).optional(),
      limit: z.number().optional().default(20),
    }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];

      const conditions = [eq(meetings.userId, ctx.user.id)];
      if (input?.status) {
        conditions.push(eq(meetings.status, input.status));
      }

      const meetingList = await db.select().from(meetings)
        .where(and(...conditions))
        .orderBy(desc(meetings.createdAt))
        .limit(input?.limit || 20);

      // Get participants for each meeting
      const result = [];
      for (const meeting of meetingList) {
        const participants = await db.select({
          id: meetingParticipants.id,
          agentId: meetingParticipants.agentId,
          role: meetingParticipants.role,
          agentName: agents.name,
          agentNameEn: agents.nameEn,
          agentRole: agents.role,
          agentAvatar: agents.avatarUrl,
          agentColor: agents.color,
        })
          .from(meetingParticipants)
          .innerJoin(agents, eq(meetingParticipants.agentId, agents.id))
          .where(eq(meetingParticipants.meetingId, meeting.id));

        const fileCount = await db.select({ count: sql<number>`COUNT(*)` })
          .from(meetingFiles)
          .where(eq(meetingFiles.meetingId, meeting.id));

        const messageCount = await db.select({ count: sql<number>`COUNT(*)` })
          .from(meetingMessages)
          .where(eq(meetingMessages.meetingId, meeting.id));

        result.push({
          ...meeting,
          participants,
          fileCount: Number(fileCount[0]?.count || 0),
          messageCount: Number(messageCount[0]?.count || 0),
        });
      }

      return result;
    }),

  // Get a single meeting with full details
  get: protectedProcedure
    .input(z.number())
    .query(async ({ ctx, input: meetingId }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [meeting] = await db.select().from(meetings)
        .where(and(eq(meetings.id, meetingId), eq(meetings.userId, ctx.user.id)));

      if (!meeting) throw new TRPCError({ code: "NOT_FOUND", message: "الاجتماع غير موجود" });

      const participants = await db.select({
        id: meetingParticipants.id,
        agentId: meetingParticipants.agentId,
        role: meetingParticipants.role,
        agentName: agents.name,
        agentNameEn: agents.nameEn,
        agentRole: agents.role,
        agentAvatar: agents.avatarUrl,
        agentColor: agents.color,
      })
        .from(meetingParticipants)
        .innerJoin(agents, eq(meetingParticipants.agentId, agents.id))
        .where(eq(meetingParticipants.meetingId, meetingId));

      const files = await db.select().from(meetingFiles)
        .where(eq(meetingFiles.meetingId, meetingId))
        .orderBy(meetingFiles.uploadedAt);

      const messages = await db.select().from(meetingMessages)
        .where(eq(meetingMessages.meetingId, meetingId))
        .orderBy(meetingMessages.createdAt);

      return {
        ...meeting,
        participants,
        files,
        messages,
        decisionsJson: meeting.decisionsJson ? JSON.parse(meeting.decisionsJson) : [],
        extractedTasksJson: meeting.extractedTasksJson ? JSON.parse(meeting.extractedTasksJson) : [],
        knowledgeItemsJson: meeting.knowledgeItemsJson ? JSON.parse(meeting.knowledgeItemsJson) : [],
      };
    }),

  // Start a meeting (change status to in_progress)
  start: protectedProcedure
    .input(z.number())
    .mutation(async ({ ctx, input: meetingId }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db.update(meetings).set({
        status: "in_progress",
        startedAt: new Date(),
      }).where(and(eq(meetings.id, meetingId), eq(meetings.userId, ctx.user.id)));

      // Add system message
      await db.insert(meetingMessages).values({
        meetingId,
        speakerId: "system",
        speakerType: "agent",
        messageText: "🟢 تم بدء الاجتماع. يمكنكم الآن النقاش.",
      });

      return { success: true };
    }),

  // End a meeting
  end: protectedProcedure
    .input(z.number())
    .mutation(async ({ ctx, input: meetingId }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db.update(meetings).set({
        status: "completed",
        endedAt: new Date(),
      }).where(and(eq(meetings.id, meetingId), eq(meetings.userId, ctx.user.id)));

      // Add system message
      await db.insert(meetingMessages).values({
        meetingId,
        speakerId: "system",
        speakerType: "agent",
        messageText: "🔴 تم إنهاء الاجتماع. جاري توليد المخرجات...",
      });

      // === AUTO-GENERATE MINUTES ===
      try {
        const allMessages = await db.select().from(meetingMessages)
          .where(eq(meetingMessages.meetingId, meetingId))
          .orderBy(meetingMessages.createdAt);

        const files = await db.select().from(meetingFiles)
          .where(eq(meetingFiles.meetingId, meetingId));

        const participantsList = await db.select({
          agentId: meetingParticipants.agentId,
          agentName: agents.name,
          agentNameEn: agents.nameEn,
          agentRole: agents.role,
        })
          .from(meetingParticipants)
          .innerJoin(agents, eq(meetingParticipants.agentId, agents.id))
          .where(eq(meetingParticipants.meetingId, meetingId));

        const transcript = allMessages.map(m => {
          const speaker = m.speakerId === "user" ? "المدير (عبدالرحمن)" : m.speakerId;
          return `${speaker}: ${m.messageText}`;
        }).join("\n\n");

        if (allMessages.filter(m => m.speakerType !== "agent" || m.speakerId !== "system").length > 0) {
          // Generate minutes via LLM
          const response = await invokeLLM({
            messages: [
              {
                role: "system",
                content: `أنت مساعد ذكي لتوليد محاضر الاجتماعات. قم بتحليل النص التالي وإنتاج:\n1. ملخص تنفيذي للاجتماع (3-5 جمل)\n2. القرارات المتخذة (قائمة)\n3. المهام المستخرجة (مع المسؤول والموعد إن وُجد)\n4. النقاط الرئيسية التي تم مناقشتها\n5. المعرفة المؤسسية المستفادة (دروس، أنماط، رؤى)\n\nأجب بصيغة JSON فقط.`
              },
              {
                role: "user",
                content: `اجتماع: ${(await db.select().from(meetings).where(eq(meetings.id, meetingId)))[0]?.title || ""}\nالموضوع: ${(await db.select().from(meetings).where(eq(meetings.id, meetingId)))[0]?.topic || "عام"}\nالمشاركون: ${participantsList.map(p => `${p.agentName} (${p.agentRole})`).join("، ")} + المدير\nالملفات: ${files.map(f => f.fileName).join("، ") || "لا يوجد"}\n\nالنص الكامل:\n${transcript}`
              }
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "meeting_minutes",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    summary: { type: "string", description: "ملخص تنفيذي" },
                    decisions: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          decision: { type: "string" },
                          responsible: { type: "string" },
                        },
                        required: ["decision", "responsible"],
                        additionalProperties: false,
                      }
                    },
                    tasks: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          task: { type: "string" },
                          assignee: { type: "string" },
                          deadline: { type: "string" },
                          priority: { type: "string" },
                        },
                        required: ["task", "assignee", "deadline", "priority"],
                        additionalProperties: false,
                      }
                    },
                    keyPoints: {
                      type: "array",
                      items: { type: "string" }
                    },
                    knowledgeItems: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          type: { type: "string" },
                          title: { type: "string" },
                          content: { type: "string" },
                        },
                        required: ["type", "title", "content"],
                        additionalProperties: false,
                      }
                    },
                  },
                  required: ["summary", "decisions", "tasks", "keyPoints", "knowledgeItems"],
                  additionalProperties: false,
                }
              }
            }
          });

          const content = response.choices[0]?.message?.content;
          let minutes;
          try {
            minutes = typeof content === "string" ? JSON.parse(content) : content;
          } catch {
            minutes = { summary: "لم يتم توليد الملخص", decisions: [], tasks: [], keyPoints: [], knowledgeItems: [] };
          }

          // Save minutes to meeting
          await db.update(meetings).set({
            minutesSummary: minutes.summary,
            decisionsJson: JSON.stringify(minutes.decisions),
            extractedTasksJson: JSON.stringify(minutes.tasks),
            knowledgeItemsJson: JSON.stringify(minutes.knowledgeItems),
            fullTranscript: transcript,
          }).where(eq(meetings.id, meetingId));

          // === AUTO-SAVE TO KNOWLEDGE BASE ===
          if (minutes.knowledgeItems?.length > 0) {
            for (const item of minutes.knowledgeItems) {
              const validTypes = ["decision", "evaluation", "pattern", "insight", "lesson"];
              const itemType = validTypes.includes(item.type) ? item.type : "insight";
              await db.insert(knowledgeBase).values({
                userId: ctx.user.id,
                type: itemType,
                title: item.title,
                content: item.content,
                importance: "medium",
                sourceAgent: "meeting",
                tags: JSON.stringify([`meeting-${meetingId}`]),
              });
            }
          }

          // === SAVE MEETING SUMMARY TO EACH AGENT'S CHAT HISTORY ===
          const meetingMemory = `📋 [ذاكرة اجتماع] عنوان: ${(await db.select().from(meetings).where(eq(meetings.id, meetingId)))[0]?.title}\n` +
            `📅 التاريخ: ${new Date().toLocaleDateString("ar-SA")}\n` +
            `👥 المشاركون: ${participantsList.map(p => p.agentName).join("، ")}\n` +
            `📝 الملخص: ${minutes.summary}\n` +
            (minutes.decisions?.length > 0 ? `✅ القرارات: ${minutes.decisions.map((d: any) => d.decision).join(" | ")}\n` : "") +
            (minutes.tasks?.length > 0 ? `📌 المهام: ${minutes.tasks.map((t: any) => `${t.task} (${t.assignee})`).join(" | ")}\n` : "") +
            (minutes.keyPoints?.length > 0 ? `🔑 النقاط الرئيسية: ${minutes.keyPoints.join(" | ")}` : "");

          for (const participant of participantsList) {
            const agentKey = participant.agentNameEn?.toLowerCase() || "";
            if (agentKey) {
              // Save as system message in agent's chat history
              await db.insert(chatHistory).values({
                userId: ctx.user.id,
                agent: agentKey,
                role: "assistant",
                content: meetingMemory,
              });
            }
          }

          // Update system message with success
          await db.insert(meetingMessages).values({
            meetingId,
            speakerId: "system",
            speakerType: "agent",
            messageText: "✅ تم توليد محضر الاجتماع والمخرجات تلقائياً. اضغط على 'المخرجات' لعرضها.",
          });
        }
      } catch (err) {
        console.error("[Meeting] Auto-generate minutes failed:", err);
        await db.insert(meetingMessages).values({
          meetingId,
          speakerId: "system",
          speakerType: "agent",
          messageText: "⚠️ لم يتم توليد المخرجات تلقائياً. يمكنك توليدها يدوياً لاحقاً.",
        });
      }

      return { success: true };
    }),

  // Upload a file to a meeting
  uploadFile: protectedProcedure
    .input(z.object({
      meetingId: z.number(),
      fileName: z.string(),
      fileBase64: z.string(),
      mimeType: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Determine file type
      let fileType = "other";
      if (input.mimeType.includes("pdf")) fileType = "pdf";
      else if (input.mimeType.includes("word") || input.mimeType.includes("document")) fileType = "word";
      else if (input.mimeType.includes("excel") || input.mimeType.includes("spreadsheet")) fileType = "excel";
      else if (input.mimeType.includes("image")) fileType = "image";
      else if (input.mimeType.includes("audio")) fileType = "audio";

      // Upload to S3
      const fileBuffer = Buffer.from(input.fileBase64, "base64");
      const fileKey = `meetings/${input.meetingId}/${Date.now()}-${Math.random().toString(36).slice(2)}-${input.fileName}`;
      const { url: fileUrl } = await storagePut(fileKey, fileBuffer, input.mimeType);

      // Save to DB
      const [result] = await db.insert(meetingFiles).values({
        meetingId: input.meetingId,
        fileName: input.fileName,
        fileUrl,
        fileKey,
        fileType,
        mimeType: input.mimeType,
        fileSize: fileBuffer.length,
      });

      // Add system message about file upload
      await db.insert(meetingMessages).values({
        meetingId: input.meetingId,
        speakerId: "user",
        speakerType: "user",
        messageText: `📎 تم رفع ملف: ${input.fileName}`,
      });

      return { id: Number(result.insertId), fileUrl, fileName: input.fileName };
    }),

  // Send a user message in the meeting
  sendMessage: protectedProcedure
    .input(z.object({
      meetingId: z.number(),
      message: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Save user message
      await db.insert(meetingMessages).values({
        meetingId: input.meetingId,
        speakerId: "user",
        speakerType: "user",
        messageText: input.message,
      });

      return { success: true };
    }),

  // Ask agents to respond in the meeting (one at a time or all)
  askAgents: protectedProcedure
    .input(z.object({
      meetingId: z.number(),
      targetAgent: z.string().optional(), // specific agent or "all"
      userMessage: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Get meeting details
      const [meeting] = await db.select().from(meetings)
        .where(eq(meetings.id, input.meetingId));
      if (!meeting) throw new TRPCError({ code: "NOT_FOUND" });

      // Get participants
      const participants = await db.select({
        agentName: agents.name,
        agentNameEn: agents.nameEn,
      })
        .from(meetingParticipants)
        .innerJoin(agents, eq(meetingParticipants.agentId, agents.id))
        .where(eq(meetingParticipants.meetingId, input.meetingId));

      // Get meeting files for context
      const files = await db.select().from(meetingFiles)
        .where(eq(meetingFiles.meetingId, input.meetingId));

      // Get recent messages for context
      const recentMessages = await db.select().from(meetingMessages)
        .where(eq(meetingMessages.meetingId, input.meetingId))
        .orderBy(desc(meetingMessages.createdAt))
        .limit(30);

      const reversedMessages = recentMessages.reverse();

      // Build meeting context for agents
      const meetingContext = `
🏢 اجتماع: ${meeting.title}
📋 الموضوع: ${meeting.topic || "عام"}
👥 المشاركون: ${participants.map(p => p.agentName).join("، ")}
${files.length > 0 ? `📎 ملفات مرفقة: ${files.map(f => `${f.fileName} (${f.fileType})`).join("، ")}` : ""}
${files.length > 0 ? `\n📄 محتوى الملفات:\n${files.filter(f => f.extractedText).map(f => `--- ${f.fileName} ---\n${f.extractedText?.substring(0, 3000)}`).join("\n\n")}` : ""}

💬 سياق المحادثة الأخيرة:
${reversedMessages.map(m => `${m.speakerId === "user" ? "المدير" : m.speakerId}: ${m.messageText}`).join("\n")}
`;

      // Determine which agents to ask
      const agentNames = input.targetAgent && input.targetAgent !== "all"
        ? [input.targetAgent]
        : participants.map(p => p.agentNameEn?.toLowerCase() || "").filter(Boolean);

      const validAgents = agentNames.filter(name =>
        ["salwa", "farouq", "khazen", "buraq", "khaled", "alina", "baz", "joelle"].includes(name)
      );

      const responses: { agent: string; response: string; model: string }[] = [];

      for (const agentName of validAgents) {
        try {
          const meetingPromptAddition = `\n\n--- سياق الاجتماع ---\n${meetingContext}\n\nأنت الآن في اجتماع عمل مع المدير وزملائك. أجب على سؤال/طلب المدير بناءً على تخصصك وخبرتك. كن مختصراً ومركزاً. إذا كان هناك ملفات مرفقة، حللها حسب تخصصك.`;

          const result = await handleAgentChat({
            agent: agentName as any,
            message: meetingPromptAddition + "\n\nالمدير يقول: " + input.userMessage,
            userId: ctx.user.id,
          });

          // Save agent response as meeting message
          await db.insert(meetingMessages).values({
            meetingId: input.meetingId,
            speakerId: agentName,
            speakerType: "agent",
            messageText: result.text,
          });

          responses.push({ agent: agentName, response: result.text, model: result.model });
        } catch (err) {
          console.error(`[Meeting] Agent ${agentName} failed:`, err);
          const errorMsg = `عذراً، واجهت مشكلة تقنية. سأحاول مرة أخرى لاحقاً.`;
          await db.insert(meetingMessages).values({
            meetingId: input.meetingId,
            speakerId: agentName,
            speakerType: "agent",
            messageText: errorMsg,
          });
          responses.push({ agent: agentName, response: errorMsg, model: "error" });
        }
      }

      return { responses };
    }),

  // Transcribe voice message and send in meeting
  transcribeVoice: protectedProcedure
    .input(z.object({
      meetingId: z.number(),
      audioBase64: z.string(),
      mimeType: z.string().default("audio/webm"),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Upload audio to S3
      const audioBuffer = Buffer.from(input.audioBase64, "base64");
      const ext = input.mimeType.includes("webm") ? "webm" : input.mimeType.includes("mp4") ? "m4a" : "wav";
      const fileKey = `meetings/${input.meetingId}/voice/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { url: audioUrl } = await storagePut(fileKey, audioBuffer, input.mimeType);

      // Transcribe
      const result = await transcribeAudio({
        audioUrl,
        language: "ar",
        prompt: "تحويل الكلام العربي إلى نص - اجتماع عمل",
      });

      if ("error" in result) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: result.error });
      }

      return { text: result.text, audioUrl, duration: result.duration };
    }),

  // Generate meeting summary/minutes
  generateMinutes: protectedProcedure
    .input(z.number())
    .mutation(async ({ ctx, input: meetingId }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Get all meeting data
      const [meeting] = await db.select().from(meetings)
        .where(eq(meetings.id, meetingId));
      if (!meeting) throw new TRPCError({ code: "NOT_FOUND" });

      const allMessages = await db.select().from(meetingMessages)
        .where(eq(meetingMessages.meetingId, meetingId))
        .orderBy(meetingMessages.createdAt);

      const files = await db.select().from(meetingFiles)
        .where(eq(meetingFiles.meetingId, meetingId));

      const participants = await db.select({
        agentName: agents.name,
        agentNameEn: agents.nameEn,
        agentRole: agents.role,
      })
        .from(meetingParticipants)
        .innerJoin(agents, eq(meetingParticipants.agentId, agents.id))
        .where(eq(meetingParticipants.meetingId, meetingId));

      // Build full transcript
      const transcript = allMessages.map(m => {
        const speaker = m.speakerId === "user" ? "المدير (عبدالرحمن)" : m.speakerId;
        return `${speaker}: ${m.messageText}`;
      }).join("\n\n");

      // Use LLM to generate structured minutes
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `أنت مساعد ذكي لتوليد محاضر الاجتماعات. قم بتحليل النص التالي وإنتاج:
1. ملخص تنفيذي للاجتماع (3-5 جمل)
2. القرارات المتخذة (قائمة)
3. المهام المستخرجة (مع المسؤول والموعد إن وُجد)
4. النقاط الرئيسية التي تم مناقشتها
5. المعرفة المؤسسية المستفادة (دروس، أنماط، رؤى)

أجب بصيغة JSON فقط.`
          },
          {
            role: "user",
            content: `اجتماع: ${meeting.title}
الموضوع: ${meeting.topic || "عام"}
المشاركون: ${participants.map(p => `${p.agentName} (${p.agentRole})`).join("، ")} + المدير
الملفات: ${files.map(f => f.fileName).join("، ") || "لا يوجد"}

النص الكامل:
${transcript}`
          }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "meeting_minutes",
            strict: true,
            schema: {
              type: "object",
              properties: {
                summary: { type: "string", description: "ملخص تنفيذي" },
                decisions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      decision: { type: "string" },
                      responsible: { type: "string" },
                    },
                    required: ["decision", "responsible"],
                    additionalProperties: false,
                  }
                },
                tasks: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      task: { type: "string" },
                      assignee: { type: "string" },
                      deadline: { type: "string" },
                      priority: { type: "string" },
                    },
                    required: ["task", "assignee", "deadline", "priority"],
                    additionalProperties: false,
                  }
                },
                keyPoints: {
                  type: "array",
                  items: { type: "string" }
                },
                knowledgeItems: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      type: { type: "string" },
                      title: { type: "string" },
                      content: { type: "string" },
                    },
                    required: ["type", "title", "content"],
                    additionalProperties: false,
                  }
                },
              },
              required: ["summary", "decisions", "tasks", "keyPoints", "knowledgeItems"],
              additionalProperties: false,
            }
          }
        }
      });

      const content = response.choices[0]?.message?.content;
      let minutes;
      try {
        minutes = typeof content === "string" ? JSON.parse(content) : content;
      } catch {
        minutes = {
          summary: "لم يتم توليد الملخص بنجاح",
          decisions: [],
          tasks: [],
          keyPoints: [],
          knowledgeItems: [],
        };
      }

      // Update meeting with generated minutes
      await db.update(meetings).set({
        minutesSummary: minutes.summary,
        decisionsJson: JSON.stringify(minutes.decisions),
        extractedTasksJson: JSON.stringify(minutes.tasks),
        knowledgeItemsJson: JSON.stringify(minutes.knowledgeItems),
        fullTranscript: transcript,
      }).where(eq(meetings.id, meetingId));

      return minutes;
    }),

  // Save knowledge items from meeting to knowledge base
  saveToKnowledge: protectedProcedure
    .input(z.object({
      meetingId: z.number(),
      items: z.array(z.object({
        type: z.enum(["decision", "evaluation", "pattern", "insight", "lesson"]),
        title: z.string(),
        content: z.string(),
        importance: z.enum(["low", "medium", "high", "critical"]).optional(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      for (const item of input.items) {
        await db.insert(knowledgeBase).values({
          userId: ctx.user.id,
          type: item.type,
          title: item.title,
          content: item.content,
          importance: item.importance || "medium",
          sourceAgent: "meeting",
          tags: JSON.stringify([`meeting-${input.meetingId}`]),
        });
      }

      // Update meeting with saved knowledge items
      await db.update(meetings).set({
        knowledgeItemsJson: JSON.stringify(input.items),
      }).where(eq(meetings.id, input.meetingId));

      return { saved: input.items.length };
    }),

  // Extract text from uploaded file using LLM
  analyzeFile: protectedProcedure
    .input(z.object({
      meetingId: z.number(),
      fileId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [file] = await db.select().from(meetingFiles)
        .where(eq(meetingFiles.id, input.fileId));
      if (!file) throw new TRPCError({ code: "NOT_FOUND" });

      // Use LLM with file_url to analyze the document
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: "أنت محلل مستندات خبير. قم بقراءة الملف المرفق واستخراج النص والمعلومات الرئيسية منه. لخص المحتوى بشكل شامل."
          },
          {
            role: "user",
            content: [
              { type: "text", text: `حلل هذا الملف: ${file.fileName}` },
              {
                type: "file_url",
                file_url: {
                  url: file.fileUrl,
                  mime_type: (file.mimeType as any) || "application/pdf",
                }
              }
            ]
          }
        ]
      });

      const extractedText = typeof response.choices[0]?.message?.content === "string"
        ? response.choices[0].message.content
        : "لم يتم استخراج النص";

      // Update file with extracted text
      await db.update(meetingFiles).set({
        extractedText,
      }).where(eq(meetingFiles.id, input.fileId));

      return { extractedText };
    }),

  // Get meeting messages (for polling/refresh)
  getMessages: protectedProcedure
    .input(z.object({
      meetingId: z.number(),
      afterId: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];

      const conditions = [eq(meetingMessages.meetingId, input.meetingId)];
      if (input.afterId) {
        conditions.push(sql`${meetingMessages.id} > ${input.afterId}`);
      }

      return await db.select().from(meetingMessages)
        .where(and(...conditions))
        .orderBy(meetingMessages.createdAt);
    }),

  // Delete a meeting
  delete: protectedProcedure
    .input(z.number())
    .mutation(async ({ ctx, input: meetingId }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db.delete(meetings)
        .where(and(eq(meetings.id, meetingId), eq(meetings.userId, ctx.user.id)));

      return { success: true };
    }),
});
