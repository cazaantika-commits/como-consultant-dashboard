import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the database
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
}));

// Mock storage
vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ url: "https://s3.example.com/test.pdf", key: "test.pdf" }),
}));

// Mock agent chat
vi.mock("./agentChat", () => ({
  handleAgentChat: vi.fn().mockResolvedValue({ text: "رد الوكيل", model: "gpt-4o" }),
}));

// Mock LLM
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{ message: { content: JSON.stringify({
      summary: "ملخص الاجتماع",
      decisions: [{ decision: "قرار 1", responsible: "المدير" }],
      tasks: [{ task: "مهمة 1", assignee: "فاروق", deadline: "2026-03-01", priority: "عالية" }],
      keyPoints: ["نقطة 1"],
      knowledgeItems: [{ type: "insight", title: "رؤية 1", content: "محتوى الرؤية" }],
    }) } }],
  }),
}));

// Mock voice transcription
vi.mock("./_core/voiceTranscription", () => ({
  transcribeAudio: vi.fn().mockResolvedValue({ text: "نص مكتوب من الصوت", duration: 5 }),
}));

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };

  return { ctx };
}

describe("Meetings Router", () => {
  const { ctx } = createAuthContext();
  const caller = appRouter.createCaller(ctx);

  describe("meetings.list", () => {
    it("should return empty array when DB is not available", async () => {
      const result = await caller.meetings.list();
      expect(result).toEqual([]);
    });

    it("should accept status filter", async () => {
      const result = await caller.meetings.list({ status: "in_progress" });
      expect(result).toEqual([]);
    });

    it("should accept limit parameter", async () => {
      const result = await caller.meetings.list({ limit: 5 });
      expect(result).toEqual([]);
    });
  });

  describe("meetings.getMessages", () => {
    it("should return empty array when DB is not available", async () => {
      const result = await caller.meetings.getMessages({ meetingId: 1 });
      expect(result).toEqual([]);
    });

    it("should accept afterId parameter", async () => {
      const result = await caller.meetings.getMessages({ meetingId: 1, afterId: 5 });
      expect(result).toEqual([]);
    });
  });

  describe("meetings.create", () => {
    it("should throw error when DB is not available", async () => {
      await expect(
        caller.meetings.create({
          title: "اجتماع تجريبي",
          topic: "مناقشة المشروع",
          agentIds: [1, 2, 3],
        })
      ).rejects.toThrow();
    });

    it("should require at least one agent", async () => {
      await expect(
        caller.meetings.create({
          title: "اجتماع",
          agentIds: [],
        })
      ).rejects.toThrow();
    });

    it("should require a non-empty title", async () => {
      await expect(
        caller.meetings.create({
          title: "",
          agentIds: [1],
        })
      ).rejects.toThrow();
    });
  });

  describe("meetings.start", () => {
    it("should throw error when DB is not available", async () => {
      await expect(caller.meetings.start(1)).rejects.toThrow();
    });
  });

  describe("meetings.end", () => {
    it("should throw error when DB is not available", async () => {
      await expect(caller.meetings.end(1)).rejects.toThrow();
    });
  });

  describe("meetings.get", () => {
    it("should throw error when DB is not available", async () => {
      await expect(caller.meetings.get(1)).rejects.toThrow();
    });
  });

  describe("meetings.sendMessage", () => {
    it("should throw error when DB is not available", async () => {
      await expect(
        caller.meetings.sendMessage({ meetingId: 1, message: "مرحباً" })
      ).rejects.toThrow();
    });

    it("should require non-empty message", async () => {
      await expect(
        caller.meetings.sendMessage({ meetingId: 1, message: "" })
      ).rejects.toThrow();
    });
  });

  describe("meetings.askAgents", () => {
    it("should throw error when DB is not available", async () => {
      await expect(
        caller.meetings.askAgents({
          meetingId: 1,
          userMessage: "ما رأيكم في المشروع؟",
        })
      ).rejects.toThrow();
    });
  });

  describe("meetings.uploadFile", () => {
    it("should throw error when DB is not available", async () => {
      await expect(
        caller.meetings.uploadFile({
          meetingId: 1,
          fileName: "test.pdf",
          fileBase64: "dGVzdA==",
          mimeType: "application/pdf",
        })
      ).rejects.toThrow();
    });
  });

  describe("meetings.transcribeVoice", () => {
    it("should throw error when DB is not available", async () => {
      await expect(
        caller.meetings.transcribeVoice({
          meetingId: 1,
          audioBase64: "dGVzdA==",
          mimeType: "audio/webm",
        })
      ).rejects.toThrow();
    });
  });

  describe("meetings.generateMinutes", () => {
    it("should throw error when DB is not available", async () => {
      await expect(caller.meetings.generateMinutes(1)).rejects.toThrow();
    });
  });

  describe("meetings.saveToKnowledge", () => {
    it("should throw error when DB is not available", async () => {
      await expect(
        caller.meetings.saveToKnowledge({
          meetingId: 1,
          items: [
            { type: "insight", title: "رؤية", content: "محتوى", importance: "medium" },
          ],
        })
      ).rejects.toThrow();
    });

    it("should accept multiple knowledge items", async () => {
      await expect(
        caller.meetings.saveToKnowledge({
          meetingId: 1,
          items: [
            { type: "decision", title: "قرار 1", content: "محتوى 1" },
            { type: "lesson", title: "درس 1", content: "محتوى 2" },
            { type: "pattern", title: "نمط 1", content: "محتوى 3" },
          ],
        })
      ).rejects.toThrow();
    });
  });

  describe("meetings.analyzeFile", () => {
    it("should throw error when DB is not available", async () => {
      await expect(
        caller.meetings.analyzeFile({ meetingId: 1, fileId: 1 })
      ).rejects.toThrow();
    });
  });

  describe("meetings.delete", () => {
    it("should throw error when DB is not available", async () => {
      await expect(caller.meetings.delete(1)).rejects.toThrow();
    });
  });

  describe("Input validation", () => {
    it("should validate meeting create input schema", async () => {
      // Missing required fields
      await expect(
        caller.meetings.create({ title: "test" } as any)
      ).rejects.toThrow();
    });

    it("should validate sendMessage requires meetingId", async () => {
      await expect(
        caller.meetings.sendMessage({ message: "test" } as any)
      ).rejects.toThrow();
    });

    it("should validate askAgents requires meetingId and userMessage", async () => {
      await expect(
        caller.meetings.askAgents({ meetingId: 1 } as any)
      ).rejects.toThrow();
    });

    it("should validate saveToKnowledge items type enum", async () => {
      await expect(
        caller.meetings.saveToKnowledge({
          meetingId: 1,
          items: [
            { type: "invalid_type" as any, title: "test", content: "test" },
          ],
        })
      ).rejects.toThrow();
    });

    it("should validate uploadFile requires all fields", async () => {
      await expect(
        caller.meetings.uploadFile({ meetingId: 1, fileName: "test" } as any)
      ).rejects.toThrow();
    });
  });
});
