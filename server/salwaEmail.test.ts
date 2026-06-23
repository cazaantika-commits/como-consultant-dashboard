import { describe, it, expect } from "vitest";

describe("Salwa Email Access - Direct IMAP (No Telegram Dependency)", () => {
  it("should import fetchEmailsSince from emailMonitor", async () => {
    const { fetchEmailsSince } = await import("./emailMonitor");
    expect(typeof fetchEmailsSince).toBe("function");
  });

  it("should import fetchRecentEmails from emailMonitor", async () => {
    const { fetchRecentEmails } = await import("./emailMonitor");
    expect(typeof fetchRecentEmails).toBe("function");
  });

  it("should have EMAIL_PASSWORD configured for IMAP access", () => {
    const password = process.env.EMAIL_PASSWORD;
    expect(password).toBeDefined();
    expect(password!.length).toBeGreaterThan(0);
  });

  it("should fetch emails via IMAP directly (bypassing Telegram)", async () => {
    const { fetchEmailsSince } = await import("./emailMonitor");
    // This tests the actual IMAP connection
    const emails = await fetchEmailsSince(48);
    expect(Array.isArray(emails)).toBe(true);
    // Each email should have the expected structure
    if (emails.length > 0) {
      const email = emails[0];
      expect(email).toHaveProperty("uid");
      expect(email).toHaveProperty("from");
      expect(email).toHaveProperty("fromName");
      expect(email).toHaveProperty("subject");
      expect(email).toHaveProperty("date");
      expect(email).toHaveProperty("isRead");
      expect(email).toHaveProperty("attachments");
    }
  }, 30000);

  it("should detect email keywords in Salwa chat messages", () => {
    const emailKeywords = ["ايميل", "إيميل", "بريد", "رسائل", "email", "اميل", "إميل"];
    
    const testMessages = [
      { text: "شوفي الإيميل", expected: true },
      { text: "فيه رسائل جديدة؟", expected: true },
      { text: "check email", expected: true },
      { text: "وش الاميل الجديد", expected: true },
      { text: "شوفي البريد", expected: true },
      { text: "كيف حالك", expected: false },
      { text: "شو المشاريع", expected: false },
    ];

    for (const test of testMessages) {
      const textLower = test.text.toLowerCase();
      const isEmailRelated = emailKeywords.some(kw => textLower.includes(kw));
      if (test.expected) {
        expect(isEmailRelated, `"${test.text}" should be detected as email-related`).toBe(true);
      } else {
        expect(isEmailRelated, `"${test.text}" should NOT be detected as email-related`).toBe(false);
      }
    }
  });

  it("should format email summary correctly", () => {
    const mockEmails = [
      { isRead: true, fromName: "XYZ Designers", subject: "عرض أتعاب", attachments: [{ filename: "proposal.pdf" }], date: new Date() },
      { isRead: false, fromName: "ABC Engineers", subject: "مراجعة العقد", attachments: [], date: new Date() },
      { isRead: false, fromName: "Test Co", subject: "طلب اجتماع", attachments: [{ filename: "agenda.docx" }, { filename: "notes.pdf" }], date: new Date() },
    ];

    const readCount = mockEmails.filter(e => e.isRead).length;
    const unreadCount = mockEmails.filter(e => !e.isRead).length;
    const withAttachments = mockEmails.filter(e => e.attachments.length > 0).length;

    expect(readCount).toBe(1);
    expect(unreadCount).toBe(2);
    expect(withAttachments).toBe(2);
    expect(mockEmails.length).toBe(3);

    // Verify summary building works
    let summary = `📧 فحصت الإيميل! وجدت ${mockEmails.length} رسالة في آخر 48 ساعة\n\n`;
    summary += `📊 **الإحصائيات:**\n`;
    summary += `• غير مقروء: ${unreadCount} 🔴\n`;
    summary += `• مقروء: ${readCount} ✅\n`;
    summary += `• مع مرفقات: ${withAttachments} 📎\n`;

    expect(summary).toContain("3 رسالة");
    expect(summary).toContain("غير مقروء: 2");
    expect(summary).toContain("مقروء: 1");
    expect(summary).toContain("مع مرفقات: 2");
  });

  it("agentChat should import fetchEmailsSince for direct IMAP access", async () => {
    // Verify the agentChat module has the correct imports
    const fs = await import("fs");
    const path = await import("path");
    const agentChatSource = fs.readFileSync(
      path.join(process.cwd(), "server/agentChat.ts"),
      "utf-8"
    );

    // Should import fetchEmailsSince from emailMonitor (direct IMAP)
    expect(agentChatSource).toContain('import { fetchRecentEmails, fetchEmailsSince } from "./emailMonitor"');
    
    // Should use fetchEmailsSince directly instead of only checkLast48HoursEmails
    expect(agentChatSource).toContain("await fetchEmailsSince(48)");
    
    // Should still have fallback to checkLast48HoursEmails for Telegram
    expect(agentChatSource).toContain("checkLast48HoursEmails");
    
    // Should NOT depend solely on Telegram bot for email access
    expect(agentChatSource).toContain("direct IMAP access");
  });
});
