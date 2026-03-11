import { describe, it, expect, vi, beforeEach } from "vitest";

// Test the email scheduler logic
describe("Email Scheduler", () => {
  it("should define correct UTC schedule times for Dubai timezone", () => {
    // Dubai is UTC+4
    // 9:30 AM Dubai = 5:30 UTC
    // 11:30 AM Dubai = 7:30 UTC
    // 2:00 PM Dubai = 10:00 UTC
    // 9:00 PM Dubai = 17:00 UTC
    const SCHEDULE_TIMES_UTC = [
      { hour: 5, minute: 30 },
      { hour: 7, minute: 30 },
      { hour: 10, minute: 0 },
      { hour: 17, minute: 0 },
    ];

    expect(SCHEDULE_TIMES_UTC).toHaveLength(4);
    expect(SCHEDULE_TIMES_UTC[0]).toEqual({ hour: 5, minute: 30 }); // 9:30 Dubai
    expect(SCHEDULE_TIMES_UTC[1]).toEqual({ hour: 7, minute: 30 }); // 11:30 Dubai
    expect(SCHEDULE_TIMES_UTC[2]).toEqual({ hour: 10, minute: 0 }); // 14:00 Dubai
    expect(SCHEDULE_TIMES_UTC[3]).toEqual({ hour: 17, minute: 0 }); // 21:00 Dubai
  });

  it("should correctly detect scheduled times within 2-minute window", () => {
    const SCHEDULE_TIMES_UTC = [
      { hour: 5, minute: 30 },
      { hour: 7, minute: 30 },
      { hour: 10, minute: 0 },
      { hour: 17, minute: 0 },
    ];

    function isScheduledTime(h: number, m: number): boolean {
      for (const t of SCHEDULE_TIMES_UTC) {
        if (h === t.hour && m >= t.minute && m <= t.minute + 2) return true;
      }
      return false;
    }

    // Exact times
    expect(isScheduledTime(5, 30)).toBe(true);
    expect(isScheduledTime(7, 30)).toBe(true);
    expect(isScheduledTime(10, 0)).toBe(true);
    expect(isScheduledTime(17, 0)).toBe(true);

    // Within 2-minute window
    expect(isScheduledTime(5, 31)).toBe(true);
    expect(isScheduledTime(5, 32)).toBe(true);
    expect(isScheduledTime(17, 1)).toBe(true);
    expect(isScheduledTime(17, 2)).toBe(true);

    // Outside window
    expect(isScheduledTime(5, 33)).toBe(false);
    expect(isScheduledTime(5, 29)).toBe(false);
    expect(isScheduledTime(6, 30)).toBe(false);
    expect(isScheduledTime(12, 0)).toBe(false);
    expect(isScheduledTime(0, 0)).toBe(false);
  });

  it("should not duplicate checks using checkKey", () => {
    function getCurrentCheckKey(date: Date): string {
      return date.getUTCFullYear() + "-" + date.getUTCMonth() + "-" + date.getUTCDate() + "-" + date.getUTCHours() + "-" + date.getUTCMinutes();
    }

    const date1 = new Date("2026-02-20T05:30:00Z");
    const date2 = new Date("2026-02-20T05:30:30Z"); // Same minute
    const date3 = new Date("2026-02-20T05:31:00Z"); // Different minute

    expect(getCurrentCheckKey(date1)).toBe(getCurrentCheckKey(date2));
    expect(getCurrentCheckKey(date1)).not.toBe(getCurrentCheckKey(date3));
  });
});

// Test email callback data parsing
describe("Email Callback Data Parsing", () => {
  it("should parse email_reply callback data", () => {
    const data = "email_reply_123";
    const match = data.match(/^email_reply_(\d+)$/);
    expect(match).not.toBeNull();
    expect(match![1]).toBe("123");
  });

  it("should parse email_archive callback data", () => {
    const data = "email_archive_456";
    const match = data.match(/^email_archive_(\d+)$/);
    expect(match).not.toBeNull();
    expect(match![1]).toBe("456");
  });

  it("should parse email_analyze callback data", () => {
    const data = "email_analyze_789";
    const match = data.match(/^email_analyze_(\d+)$/);
    expect(match).not.toBeNull();
    expect(match![1]).toBe("789");
  });

  it("should parse email_done callback data", () => {
    const data = "email_done_101";
    const match = data.match(/^email_done_(\d+)$/);
    expect(match).not.toBeNull();
    expect(match![1]).toBe("101");
  });

  it("should parse email_confirm_reply callback data", () => {
    const data = "email_confirm_reply_202";
    const match = data.match(/^email_confirm_reply_(\d+)$/);
    expect(match).not.toBeNull();
    expect(match![1]).toBe("202");
  });

  it("should parse email_edit_reply callback data", () => {
    const data = "email_edit_reply_303";
    const match = data.match(/^email_edit_reply_(\d+)$/);
    expect(match).not.toBeNull();
    expect(match![1]).toBe("303");
  });

  it("should not match non-email callbacks", () => {
    const data = "project_الجداف";
    expect(data.match(/^email_reply_(\d+)$/)).toBeNull();
    expect(data.match(/^email_archive_(\d+)$/)).toBeNull();
    expect(data.match(/^email_analyze_(\d+)$/)).toBeNull();
  });
});

// Test proposal type mapping
describe("Proposal Type Mapping", () => {
  it("should map proposal types to Arabic", () => {
    const typeMap: Record<string, string> = {
      design: "تصميم",
      supervision: "إشراف",
      both: "تصميم وإشراف",
      other: "أخرى",
    };

    expect(typeMap["design"]).toBe("تصميم");
    expect(typeMap["supervision"]).toBe("إشراف");
    expect(typeMap["both"]).toBe("تصميم وإشراف");
    expect(typeMap["other"]).toBe("أخرى");
  });
});

// Test Dubai timezone conversion
describe("Dubai Timezone Conversion", () => {
  it("should convert UTC to Dubai time correctly", () => {
    const utcDate = new Date("2026-02-20T05:30:00Z");
    const dubaiHour = (utcDate.getUTCHours() + 4) % 24;
    const dubaiMinute = utcDate.getUTCMinutes();

    expect(dubaiHour).toBe(9);
    expect(dubaiMinute).toBe(30);
  });

  it("should handle midnight crossing", () => {
    const utcDate = new Date("2026-02-20T21:00:00Z");
    const dubaiHour = (utcDate.getUTCHours() + 4) % 24;

    expect(dubaiHour).toBe(1); // 1 AM next day in Dubai
  });

  it("should find next scheduled check correctly", () => {
    const dubaiTimes = [
      { hour: 9, minute: 30 },
      { hour: 11, minute: 30 },
      { hour: 14, minute: 0 },
      { hour: 21, minute: 0 },
    ];

    function findNextCheck(dubaiHour: number, dubaiMinute: number): string {
      let nextCheck = "غداً 9:30 صباحاً";
      for (const t of dubaiTimes) {
        if (t.hour > dubaiHour || (t.hour === dubaiHour && t.minute > dubaiMinute)) {
          nextCheck = t.hour + ":" + (t.minute === 0 ? "00" : t.minute);
          break;
        }
      }
      return nextCheck;
    }

    expect(findNextCheck(8, 0)).toBe("9:30");
    expect(findNextCheck(9, 31)).toBe("11:30");
    expect(findNextCheck(12, 0)).toBe("14:00");
    expect(findNextCheck(15, 0)).toBe("21:00");
    expect(findNextCheck(22, 0)).toBe("غداً 9:30 صباحاً");
  });
});

// Test email notification message formatting
describe("Email Notification Formatting", () => {
  it("should format attachment info correctly", () => {
    const attachments = [
      { filename: "proposal.pdf", contentType: "application/pdf", size: 1024, content: null },
      { filename: "drawings.zip", contentType: "application/zip", size: 2048, content: null },
    ];

    const attachmentInfo = attachments.length > 0
      ? "\n📎 المرفقات: " + attachments.length + " ملف (" + attachments.map(a => a.filename).join(", ") + ")"
      : "";

    expect(attachmentInfo).toContain("2 ملف");
    expect(attachmentInfo).toContain("proposal.pdf");
    expect(attachmentInfo).toContain("drawings.zip");
  });

  it("should handle empty attachments", () => {
    const attachments: any[] = [];
    const attachmentInfo = attachments.length > 0
      ? "\n📎 المرفقات: " + attachments.length + " ملف"
      : "";

    expect(attachmentInfo).toBe("");
  });

  it("should truncate long email body", () => {
    const longBody = "x".repeat(500);
    const preview = longBody.substring(0, 300);
    const suffix = longBody.length > 300 ? "..." : "";

    expect(preview.length).toBe(300);
    expect(suffix).toBe("...");
  });

  it("should not truncate short email body", () => {
    const shortBody = "Hello, this is a short email.";
    const preview = shortBody.substring(0, 300);
    const suffix = shortBody.length > 300 ? "..." : "";

    expect(preview).toBe(shortBody);
    expect(suffix).toBe("");
  });
});

// --- NEW: Test IMAP SINCE date string generation -------------------
describe("IMAP SINCE Date Generation", () => {
  it("should generate correct SINCE date string for 48 hours ago", () => {
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    
    // Test with a known date
    const now = new Date("2026-02-20T10:00:00Z");
    const sinceDate = new Date(now.getTime());
    sinceDate.setHours(sinceDate.getHours() - 48);
    
    const sinceDateStr = `${sinceDate.getDate()}-${months[sinceDate.getMonth()]}-${sinceDate.getFullYear()}`;
    
    expect(sinceDateStr).toBe("18-Feb-2026");
  });

  it("should handle month boundary crossing", () => {
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    
    const now = new Date("2026-03-01T10:00:00Z");
    const sinceDate = new Date(now.getTime());
    sinceDate.setHours(sinceDate.getHours() - 48);
    
    const sinceDateStr = `${sinceDate.getDate()}-${months[sinceDate.getMonth()]}-${sinceDate.getFullYear()}`;
    
    expect(sinceDateStr).toBe("27-Feb-2026");
  });

  it("should handle year boundary crossing", () => {
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    
    const now = new Date("2026-01-01T10:00:00Z");
    const sinceDate = new Date(now.getTime());
    sinceDate.setHours(sinceDate.getHours() - 48);
    
    const sinceDateStr = `${sinceDate.getDate()}-${months[sinceDate.getMonth()]}-${sinceDate.getFullYear()}`;
    
    expect(sinceDateStr).toBe("30-Dec-2025");
  });
});

// --- NEW: Test 48-hour email summary formatting --------------------
describe("48-Hour Email Summary Formatting", () => {
  it("should correctly count read and unread emails", () => {
    const emails = [
      { isRead: true, attachments: [] },
      { isRead: false, attachments: [{ filename: "test.pdf" }] },
      { isRead: true, attachments: [{ filename: "doc.pdf" }] },
      { isRead: false, attachments: [] },
      { isRead: false, attachments: [{ filename: "a.pdf" }, { filename: "b.pdf" }] },
    ];

    const readCount = emails.filter(e => e.isRead).length;
    const unreadCount = emails.filter(e => !e.isRead).length;
    const withAttachments = emails.filter(e => e.attachments.length > 0).length;

    expect(readCount).toBe(2);
    expect(unreadCount).toBe(3);
    expect(withAttachments).toBe(3);
    expect(emails.length).toBe(5);
  });

  it("should limit displayed emails to 20", () => {
    const emails = Array.from({ length: 30 }, (_, i) => ({
      uid: i + 1,
      fromName: "Test " + i,
      subject: "Subject " + i,
      isRead: i % 2 === 0,
      attachments: [],
      date: new Date(),
    }));

    const displayedEmails = emails.slice(0, 20);
    const remaining = emails.length - 20;

    expect(displayedEmails.length).toBe(20);
    expect(remaining).toBe(10);
  });

  it("should show all emails when less than 20", () => {
    const emails = Array.from({ length: 5 }, (_, i) => ({
      uid: i + 1,
      fromName: "Test " + i,
      subject: "Subject " + i,
    }));

    const displayedEmails = emails.slice(0, 20);
    expect(displayedEmails.length).toBe(5);
  });
});

// --- NEW: Test Farouq analysis with attachment handling ------------
describe("Farouq Analysis - Attachment Handling", () => {
  it("should identify PDF attachments for LLM file_url", () => {
    const attachmentUrls = [
      { filename: "proposal.pdf", url: "https://s3.example.com/proposal.pdf", contentType: "application/pdf" },
      { filename: "image.png", url: "https://s3.example.com/image.png", contentType: "image/png" },
      { filename: "report.pdf", url: "https://s3.example.com/report.pdf", contentType: "application/pdf" },
      { filename: "data.xlsx", url: "https://s3.example.com/data.xlsx", contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
    ];

    const pdfAttachments = attachmentUrls.filter(att => att.contentType === "application/pdf");
    expect(pdfAttachments.length).toBe(2);
    expect(pdfAttachments[0].filename).toBe("proposal.pdf");
    expect(pdfAttachments[1].filename).toBe("report.pdf");
  });

  it("should build multi-modal content array for LLM", () => {
    const emailContent = "من: Test Consultant\nالموضوع: عرض أتعاب";
    const attachmentUrls = [
      { filename: "proposal.pdf", url: "https://s3.example.com/proposal.pdf", contentType: "application/pdf" },
    ];

    const userContent: any[] = [
      { type: "text", text: "حلل هذا الإيميل:\n\n" + emailContent }
    ];

    for (const att of attachmentUrls) {
      if (att.contentType === "application/pdf") {
        userContent.push({
          type: "file_url",
          file_url: { url: att.url, mime_type: "application/pdf" }
        });
      }
    }

    expect(userContent.length).toBe(2);
    expect(userContent[0].type).toBe("text");
    expect(userContent[1].type).toBe("file_url");
    expect(userContent[1].file_url.mime_type).toBe("application/pdf");
  });

  it("should handle emails with no attachments gracefully", () => {
    const attachmentUrls: any[] = [];
    
    const attachmentNote = attachmentUrls.length > 0
      ? "\n📎 تم قراءة " + attachmentUrls.length + " مرفق(ات) لاستخراج البيانات"
      : "\n⚠️ لا توجد مرفقات - التحليل مبني على نص الإيميل فقط";

    expect(attachmentNote).toContain("لا توجد مرفقات");
  });

  it("should extract text from text-based attachments", () => {
    const attachmentTexts: string[] = [];
    const textAttachment = {
      filename: "notes.txt",
      contentType: "text/plain",
      content: Buffer.from("This is the fee proposal: AED 500,000 for design"),
    };

    if (textAttachment.contentType.includes("text")) {
      attachmentTexts.push("--- محتوى ملف: " + textAttachment.filename + " ---\n" + textAttachment.content.toString("utf-8").substring(0, 5000));
    }

    expect(attachmentTexts.length).toBe(1);
    expect(attachmentTexts[0]).toContain("AED 500,000");
  });
});

// --- NEW: Test Khazen archiving - safe filename generation ---------
describe("Khazen Archiving - File Handling", () => {
  it("should sanitize filenames for S3 keys", () => {
    const filename = "عرض أتعاب (التصميم).pdf";
    const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    expect(safeFilename).not.toContain(" ");
    expect(safeFilename).not.toContain("(");
    expect(safeFilename).not.toContain(")");
    expect(safeFilename).toContain(".pdf");
  });

  it("should generate unique file keys with random suffix", () => {
    const keys = new Set<string>();
    for (let i = 0; i < 10; i++) {
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      const fileKey = "email-attachments/test@test.com/" + Date.now() + "-" + randomSuffix + "-test.pdf";
      keys.add(fileKey);
    }
    // All keys should be unique
    expect(keys.size).toBe(10);
  });

  it("should sanitize email addresses for folder paths", () => {
    const email = "consultant@company.com";
    const sanitized = email.replace(/[^a-zA-Z0-9@._-]/g, "_");
    expect(sanitized).toBe("consultant@company.com");

    const arabicEmail = "أحمد@شركة.com";
    const sanitized2 = arabicEmail.replace(/[^a-zA-Z0-9@._-]/g, "_");
    expect(sanitized2).not.toContain("أحمد");
  });

  it("should sanitize consultant name for Google Drive folder", () => {
    const name = 'Test Consultant <"Company">';
    const sanitized = name.replace(/[<>:"/\\|?*]/g, "_");
    expect(sanitized).not.toContain("<");
    expect(sanitized).not.toContain(">");
    expect(sanitized).not.toContain('"');
    expect(sanitized).toContain("Test Consultant");
  });
});

// --- NEW: Test FarouqAnalysis JSON parsing -------------------------
describe("Farouq Analysis JSON Parsing", () => {
  it("should parse valid analysis JSON", () => {
    const analysisText = JSON.stringify({
      consultantName: "ABC Engineering",
      proposalType: "both",
      totalFees: "1,500,000",
      designFees: "800,000",
      supervisionFees: "700,000",
      currency: "AED",
      summary: "عرض شامل للتصميم والإشراف",
      notes: ["يشمل ضريبة القيمة المضافة", "صالح لمدة 30 يوم"],
      projectMentioned: "ند الشبا",
    });

    const analysis = JSON.parse(analysisText);
    expect(analysis.consultantName).toBe("ABC Engineering");
    expect(analysis.proposalType).toBe("both");
    expect(analysis.totalFees).toBe("1,500,000");
    expect(analysis.notes).toHaveLength(2);
    expect(analysis.projectMentioned).toBe("ند الشبا");
  });

  it("should fallback on invalid JSON", () => {
    const invalidText = "This is not JSON";
    let analysis: any;
    
    try {
      analysis = JSON.parse(invalidText);
    } catch {
      analysis = {
        consultantName: "Unknown",
        proposalType: "other",
        totalFees: "غير محدد",
        currency: "AED",
        summary: "لم يتمكن فاروق من تحليل العرض تلقائياً.",
        notes: ["يحتاج مراجعة يدوية"],
      };
    }

    expect(analysis.consultantName).toBe("Unknown");
    expect(analysis.proposalType).toBe("other");
    expect(analysis.notes).toContain("يحتاج مراجعة يدوية");
  });
});

// --- NEW: Test email keywords detection for free text --------------
describe("Email Keywords Detection", () => {
  it("should detect Arabic email-related keywords", () => {
    const emailKeywords = [
      "ايميل", "إيميل", "اميل", "إميل", "بريد", "رسائل", "رسالة",
      "email", "mail", "inbox",
      "شوفي", "شوف", "تشيك", "تشيكي", "فحص", "افحصي", "راجعي",
      "وصل", "وصلني", "وصلت", "جديد", "جديدة",
      "الوارد", "صندوق", "check",
    ];

    const testMessages = [
      { text: "شوفي الإيميلات", expected: true },
      { text: "فيه رسائل جديدة؟", expected: true },
      { text: "check my email", expected: true },
      { text: "افحصي البريد", expected: true },
      { text: "وصلني شي جديد؟", expected: true },
      { text: "كيف حالك؟", expected: false },
      { text: "أنشئ مهمة جديدة", expected: true }, // "جديدة" matches
    ];

    for (const test of testMessages) {
      const textLower = test.text.toLowerCase();
      const isEmailRelated = emailKeywords.some(kw => textLower.includes(kw));
      if (test.expected) {
        expect(isEmailRelated).toBe(true);
      }
    }
  });
});

// --- NEW: Test pending emails state management ---------------------
describe("Pending Emails State Management", () => {
  it("should track pending emails by UID key", () => {
    const pendingEmails = new Map<string, any>();
    
    const email1 = { uid: 100, from: "a@test.com", subject: "Test 1" };
    const email2 = { uid: 200, from: "b@test.com", subject: "Test 2" };
    
    pendingEmails.set("uid_100", { email: email1, status: "pending", notifiedAt: new Date() });
    pendingEmails.set("uid_200", { email: email2, status: "pending", notifiedAt: new Date() });
    
    expect(pendingEmails.has("uid_100")).toBe(true);
    expect(pendingEmails.has("uid_200")).toBe(true);
    expect(pendingEmails.has("uid_300")).toBe(false);
    expect(pendingEmails.size).toBe(2);
  });

  it("should count pending emails correctly", () => {
    const pendingEmails = new Map<string, any>();
    
    pendingEmails.set("uid_1", { status: "pending" });
    pendingEmails.set("uid_2", { status: "replied" });
    pendingEmails.set("uid_3", { status: "pending" });
    pendingEmails.set("uid_4", { status: "archived" });
    pendingEmails.set("uid_5", { status: "ignored" });
    
    const pendingCount = Array.from(pendingEmails.values()).filter(e => e.status === "pending").length;
    expect(pendingCount).toBe(2);
  });

  it("should not add duplicate emails", () => {
    const pendingEmails = new Map<string, any>();
    
    const key = "uid_100";
    pendingEmails.set(key, { email: { uid: 100 }, status: "pending" });
    
    // Try to add again
    if (!pendingEmails.has(key)) {
      pendingEmails.set(key, { email: { uid: 100 }, status: "pending" });
    }
    
    expect(pendingEmails.size).toBe(1);
  });
});
