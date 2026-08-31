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

  it("starts with the member greeting and limits the briefing to the two highest-priority points", () => {
    const text = buildLaylaOpeningBriefing({ memberId: "sheikh_issa", nameAr: "الشيخ عيسى", role: "executive" }, operations);
    expect(text.startsWith("حياك الله يا شيخ عيسى، أنا ليلى.")).toBe(true);
    expect(text).toContain("1 مهام عاجلة");
    expect(text).toContain("2 طلبات صرف معلقة");
    expect(text).not.toContain("قرارات ظاهرة");
    expect(text).not.toContain("جلسات تقييم");
    expect(text.length).toBeLessThan(220);
  });

  it("uses the actual member name and a concise all-clear sentence when nothing is urgent", () => {
    const text = buildLaylaOpeningBriefing(
      { memberId: "member_7", nameAr: "عبدالرحمن زقوت", role: "executive" },
      { ...operations, openTasks: 0, urgentTasks: 0, pendingPayments: 0, decisions: 0, evaluations: 0 },
    );
    expect(text).toBe("أهلاً عبدالرحمن زقوت، أنا ليلى. لا توجد عناصر عاجلة ظاهرة حاليًا.");
  });
});
