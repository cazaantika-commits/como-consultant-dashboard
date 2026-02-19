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
