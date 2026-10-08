import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { formatDubaiMailTime } from "./dubaiMailTime";

describe("COMO mailbox clock", () => {
  it("displays the UTC SQL success timestamp at 5:00 pm in Dubai", () => {
    expect(formatDubaiMailTime("2026-10-07 13:00:37")).toContain("5:00 م");
    expect(formatDubaiMailTime("2026-10-07T13:00:37.000Z")).toContain("5:00 م");
  });

  it("does not apply Dubai offset twice to an offset-aware timestamp", () => {
    expect(formatDubaiMailTime("2026-10-07T17:00:37+04:00")).toContain("5:00 م");
    expect(formatDubaiMailTime(null)).toBe("غير مؤرخ");
    expect(formatDubaiMailTime("invalid")).toBe("غير مؤرخ");
  });

  it("reads each signed phase by its mailbox key rather than an arbitrary first row", () => {
    const router = readFileSync(new URL("../../../server/routers/comoNextEmail.ts", import.meta.url), "utf8");
    const inbox = readFileSync(new URL("../components/ComoNextEmailInbox.tsx", import.meta.url), "utf8");
    expect(router).toContain('row.mailboxKey === "owner-primary"');
    expect(router).toContain('row.mailboxKey === "owner-primary-processing"');
    expect(router).toContain('row.mailboxKey === "owner-primary-executive"');
    expect(inbox).toContain("formatDubaiMailTime(scheduledStatusQuery.data.lastSuccessAt)");
    expect(inbox).toContain("formatDubaiMailTime(scheduledStatusQuery.data.executiveLastSuccessAt)");
    expect(inbox).not.toContain("lastSuccessAt).toLocaleString()");
  });
});
