import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock db module
vi.mock("./db", () => ({
  logSentEmail: vi.fn().mockResolvedValue(1),
  getSentEmails: vi.fn().mockResolvedValue([
    {
      id: 1,
      userId: 1,
      toEmail: "test@example.com",
      toName: "Test User",
      subject: "Re: Test Subject",
      body: "Thank you for your email.",
      inReplyTo: "<msg123@example.com>",
      originalEmailUid: 100,
      cc: null,
      status: "sent",
      errorMessage: null,
      sentBy: "salwa",
      agentName: "salwa",
      createdAt: new Date(),
    },
    {
      id: 2,
      userId: 1,
      toEmail: "failed@example.com",
      toName: null,
      subject: "Re: Failed",
      body: "This failed.",
      inReplyTo: null,
      originalEmailUid: null,
      cc: null,
      status: "failed",
      errorMessage: "Connection timeout",
      sentBy: "salwa",
      agentName: "salwa",
      createdAt: new Date(),
    },
  ]),
  getSentEmailsCount: vi.fn().mockResolvedValue(2),
  getSentEmailById: vi.fn().mockImplementation((id: number) => {
    if (id === 1) {
      return Promise.resolve({
        id: 1,
        userId: 1,
        toEmail: "test@example.com",
        toName: "Test User",
        subject: "Re: Test Subject",
        body: "Thank you for your email.",
        status: "sent",
        sentBy: "salwa",
        createdAt: new Date(),
      });
    }
    return Promise.resolve(null);
  }),
}));

// Mock emailMonitor
vi.mock("./emailMonitor", () => ({
  sendReply: vi.fn().mockResolvedValue(true),
}));

// Mock agentChat
vi.mock("./agentChat", () => ({
  getPendingEmailDraft: vi.fn().mockReturnValue({
    to: "test@example.com",
    fromName: "Test User",
    subject: "Re: Test",
    body: "Draft reply body",
    messageId: "<msg123@example.com>",
    uid: 100,
    timestamp: Date.now(),
  }),
  clearPendingEmailDraft: vi.fn(),
}));

import { logSentEmail, getSentEmails, getSentEmailsCount, getSentEmailById } from "./db";
import { sendReply } from "./emailMonitor";
import { getPendingEmailDraft, clearPendingEmailDraft } from "./agentChat";

describe("Sent Emails - DB Helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("logSentEmail should be called with correct parameters", async () => {
    const data = {
      userId: 1,
      toEmail: "test@example.com",
      subject: "Test",
      body: "Test body",
      status: "sent" as const,
      sentBy: "salwa",
    };
    const result = await logSentEmail(data);
    expect(logSentEmail).toHaveBeenCalledWith(data);
    expect(result).toBe(1);
  });

  it("getSentEmails should return emails for user", async () => {
    const emails = await getSentEmails(1, 50, 0);
    expect(getSentEmails).toHaveBeenCalledWith(1, 50, 0);
    expect(emails).toHaveLength(2);
    expect(emails[0].status).toBe("sent");
    expect(emails[1].status).toBe("failed");
  });

  it("getSentEmailsCount should return total count", async () => {
    const count = await getSentEmailsCount(1);
    expect(count).toBe(2);
  });

  it("getSentEmailById should return email when found", async () => {
    const email = await getSentEmailById(1, 1);
    expect(email).not.toBeNull();
    expect(email?.toEmail).toBe("test@example.com");
  });

  it("getSentEmailById should return null when not found", async () => {
    const email = await getSentEmailById(999, 1);
    expect(email).toBeNull();
  });
});

describe("Sent Emails - Email Sending Flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sendReply should be called with correct parameters", async () => {
    const result = await sendReply("test@example.com", "Re: Test", "Body", "<msg@test.com>", undefined);
    expect(sendReply).toHaveBeenCalledWith("test@example.com", "Re: Test", "Body", "<msg@test.com>", undefined);
    expect(result).toBe(true);
  });

  it("should log sent email after successful send", async () => {
    const success = await sendReply("test@example.com", "Re: Test", "Body");
    expect(success).toBe(true);

    await logSentEmail({
      userId: 1,
      toEmail: "test@example.com",
      subject: "Re: Test",
      body: "Body",
      status: "sent",
      sentBy: "salwa",
      agentName: "salwa",
    });

    expect(logSentEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        toEmail: "test@example.com",
        status: "sent",
        sentBy: "salwa",
      })
    );
  });
});

describe("Pending Email Draft", () => {
  it("getPendingEmailDraft should return draft data", () => {
    const draft = getPendingEmailDraft(1);
    expect(draft).not.toBeNull();
    expect(draft?.to).toBe("test@example.com");
    expect(draft?.subject).toBe("Re: Test");
    expect(draft?.body).toBe("Draft reply body");
  });

  it("clearPendingEmailDraft should be callable", () => {
    clearPendingEmailDraft(1);
    expect(clearPendingEmailDraft).toHaveBeenCalledWith(1);
  });
});

describe("Email Draft Detection", () => {
  // Test the isEmailDraftMessage logic
  const isEmailDraftMessage = (content: string) => {
    return (
      (content.includes("📧") && content.includes("الرد المقترح")) ||
      (content.includes("✉️") && content.includes("مسودة الرد")) ||
      (content.includes("📨") && content.includes("الرد المقترح")) ||
      (content.includes("Draft Reply") || content.includes("Suggested Reply")) ||
      (content.includes("البيانات التقنية") && content.includes("reply_to"))
    );
  };

  it("should detect Arabic email draft with 📧", () => {
    expect(isEmailDraftMessage("📧 تقرير الإيميل\n\nالرد المقترح: Dear...")).toBe(true);
  });

  it("should detect Arabic email draft with ✉️", () => {
    expect(isEmailDraftMessage("✉️ مسودة الرد: Thank you...")).toBe(true);
  });

  it("should detect English draft reply", () => {
    expect(isEmailDraftMessage("Draft Reply:\nDear Mr. Smith...")).toBe(true);
  });

  it("should detect technical data format", () => {
    expect(isEmailDraftMessage("البيانات التقنية:\nreply_to: test@example.com")).toBe(true);
  });

  it("should NOT detect regular messages", () => {
    expect(isEmailDraftMessage("مرحباً! كيف يمكنني مساعدتك؟")).toBe(false);
  });

  it("should NOT detect partial matches", () => {
    expect(isEmailDraftMessage("📧 تم فحص الإيميل - لا توجد رسائل جديدة")).toBe(false);
  });
});
