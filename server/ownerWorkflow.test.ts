import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const launchSource = readFileSync("server/routers/projectLaunchGate.ts", "utf8");
const meetingSource = readFileSync("server/routers/meetings.ts", "utf8");
const homeSource = readFileSync("client/src/pages/Home.tsx", "utf8");
const saraSource = readFileSync("client/src/pages/SaraPage.tsx", "utf8");
const marketDecisionSource = readFileSync("client/src/components/feasibility/MarketDecisionTab.tsx", "utf8");
const meetingRoomSource = readFileSync("client/src/pages/MeetingRoomPage.tsx", "utf8");

describe("owner workflow references", () => {
  it("keeps market reports and verified evidence visible inside the Market Decision without a financial write", () => {
    expect(marketDecisionSource).toContain("مراجع قرار السوق المرتبطة بالمشروع");
    expect(marketDecisionSource).toContain("getProjectEvidence.useQuery");
    expect(marketDecisionSource).toContain("getMarketReportLinks.useQuery");
    expect(marketDecisionSource).toContain("لا تنشئ نسخة جديدة ولا تغيّر التسعير أو التدفقات");
  });

  it("classifies meeting outputs from their stored buckets and avoids duplicate knowledge inserts", () => {
    expect(meetingRoomSource).toContain("تصنيف مخرجات الاجتماع");
    expect(meetingRoomSource).toContain("قرار، مهمة تنفيذية، أو درس مستفاد");
    expect(meetingRoomSource).toContain("الدروس والمعرفة المستفادة");
    expect(meetingSource).toContain("like(knowledgeBase.tags");
    expect(meetingSource).toContain("alreadyLinked");
    expect(meetingSource).toContain("role: meetingParticipants.participantRole");
    expect(meetingSource).not.toContain("meetingParticipants.role");
    const saveBlock = meetingSource.slice(meetingSource.indexOf("saveToKnowledge: protectedProcedure"), meetingSource.indexOf("// Extract text from uploaded file"));
    expect(saveBlock).not.toContain("db.update(meetings)");
  });

  it("keeps the removed legacy digest out of both the launch router and the rebuilt homepage", () => {
    expect(launchSource).not.toContain("getOwnerSummary");
    expect(launchSource).toContain("get: protectedProcedure");
    expect(launchSource).toContain("requireProjectAccess");
    expect(homeSource).not.toContain("projectLaunchGate.getOwnerSummary.useQuery");
    expect(homeSource).not.toContain("اليوم / يحتاج قرارًا");
    expect(homeSource).not.toContain("قراءة تشغيلية من المصادر القائمة");
    expect(homeSource).not.toContain("trpc.comoNext.getOverview.useQuery");
    expect(saraSource).toContain("trpc.comoNext.getOverview.useQuery");
    expect(saraSource).toContain("الأهم الآن");
  });
});
