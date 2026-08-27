import { describe, expect, it } from "vitest";
import { buildLaylaOpeningBriefing } from "./laylaOpeningBriefing";

describe("Layla opening voice briefing", () => {
  const operations = {
    generatedAt: "2026-08-27T00:00:00.000Z",
    openTasks: 4,
    urgentTasks: 1,
    pendingPayments: 2,
    pendingRequests: 0,
    decisions: 1,
    evaluations: 3,
    meetings: 2,
    followUpProjects: ["مجان"],
  };

  it("personalizes the greeting and only uses supplied operational counts", () => {
    const text = buildLaylaOpeningBriefing({ memberId: "sheikh_issa", nameAr: "الشيخ عيسى", role: "executive" }, operations);
    expect(text).toContain("يا شيخ عيسى");
    expect(text).toContain("أنا ليلى");
    expect(text).toContain("1 مهام عاجلة");
    expect(text).toContain("2 طلبات صرف معلقة");
    expect(text).not.toContain("مستلم");
  });
});
