import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const hubSource = readFileSync("client/src/pages/KnowledgeHubPage.tsx", "utf8");
const decisionSource = readFileSync("client/src/components/feasibility/MarketDecisionTab.tsx", "utf8");
const profileSource = readFileSync("client/src/components/feasibility/MarketSearchProfilePanel.tsx", "utf8");

describe("Knowledge and Analysis market decision screen", () => {
  it("opens with a dedicated market decision tab ahead of the supporting research workflow", () => {
    expect(hubSource).toContain('id: "market-decision", label: "قرار السوق"');
    expect(hubSource).toContain('useState<TabId>("market-decision")');
    expect(hubSource).toContain('<MarketDecisionTab projectId={selectedProjectId} onOpenResearch={() => setActiveTab("research")} />');
  });

  it("keeps the first decision screen read-only and explicitly separates it from pricing and cash-flow writes", () => {
    expect(decisionSource).toContain("لا تكتب تلقائيًا في التسعير أو التدفقات النقدية");
    expect(decisionSource).toContain("يبقى مصدر سعر القدم المربع المعتمد في صفحة التسعير");
    expect(decisionSource).toContain("لا تُطبّق على التوزيع تلقائيًا");
    expect(decisionSource).not.toContain("useMutation");
  });

  it("requires a clear market search definition before it reveals evidence or import actions", () => {
    expect(decisionSource).toContain("const marketProfileQuery = trpc.marketEvidence.getSearchProfile");
    expect(decisionSource).toContain("{marketProfileQuery.data && <>");
    expect(profileSource).toContain("ماذا تريد أن تبحث عنه؟");
    expect(profileSource).toContain("ابدأ البحث في السوق");
    expect(profileSource).toContain("function ChoiceGroup");
    expect(profileSource).toContain("خيارات متقدمة لتضييق البحث");
  });
});
