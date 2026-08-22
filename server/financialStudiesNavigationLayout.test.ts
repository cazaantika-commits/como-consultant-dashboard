import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Financial Studies flat project-first navigation", () => {
  const source = fs.readFileSync(
    path.resolve(process.cwd(), "client/src/pages/BateekhaPage.tsx"),
    "utf8",
  );

  it("opens compact horizontal reference-style study cards instead of nested groups", () => {
    expect(source).toContain('const [activeTab, setActiveTab] = useState<TabId | null>(null)');
    expect(source).toContain("كل الدراسات");
    expect(source).toContain("visibleTabs.map((tab, index)");
    expect(source).toContain('xl:grid-cols-4');
    expect(source).toContain("TONES");
    expect(source).toContain('min-h-[94px]');
    expect(source).toContain("absolute inset-x-0 top-0 h-1");
    expect(source).toContain("h-14 w-14");
    expect(source).not.toContain("NAVIGATION_GROUPS");
    expect(source).not.toContain("openGroupId");
    expect(source).not.toContain("العودة إلى جميع الأقسام");
  });

  it("uses the requested varied pink, turquoise, yellow, burgundy, and blue palette without repeated accents", () => {
    expect(source).toContain('accent: "#d65f9b"');
    expect(source).toContain('accent: "#149b9a"');
    expect(source).toContain('accent: "#d4a91f"');
    expect(source).toContain('accent: "#9b304a"');
    expect(source).toContain('accent: "#3c78d8"');
    const accents = source.match(/accent: "#[0-9a-f]{6}"/g) ?? [];
    expect(new Set(accents).size).toBe(accents.length);
    expect(source).toContain('linear-gradient(135deg, ${tone.wash} 0%, #ffffff 74%)');
    expect(source).toContain('boxShadow: `0 10px 20px ${tone.accent}22`');
  });

  it("owns project selection at the Financial Studies entry rather than the page cards", () => {
    expect(source).toContain("اختر المشروع مرة واحدة");
    expect(source).toContain("العودة تعيدك إلى هذا الدليل فقط");
    expect(source).toContain('<ProjectSelector selectedId={selectedProjectId} onSelect={setSelectedProjectId} />');
    expect(source).toContain("projectScoped");
    expect(source).toContain("اختر مشروعًا لفتح بطاقات المشروع");
    expect(source).toContain("المشروع المختار");
  });

  it("keeps type-aware visibility while applying the entry context to project pages", () => {
    expect(source).toContain("isFinancialStudiesTabVisible");
    expect(source).toContain("getFallbackFinancialStudiesTab");
    expect(source).toContain("const visibleTabs = TABS.filter((tab) => isFinancialStudiesTabVisible(tab.id, projectType));");
    expect(source).toContain("const disabled = tab.projectScoped && !selectedProjectId;");
    expect(source).toContain("Portfolio reports are company-wide reports. They stay visible after choosing a");
    expect(source).toContain("<PricingPage embedded />");
    expect(source).toContain("<ConstructionInputsPage embedded />");
    expect(source).toContain("<V2WaelSales embedded />");
    expect(source).toContain("<V2Feasibility embedded />");
  });

  it("retains the return path from each open study page to the single entry board", () => {
    expect(source).toContain("العودة إلى دليل الدراسات");
    expect(source).toContain("setActiveTab(null)");
  });

  it("reopens legacy Pricing links in the unified sales workspace", () => {
    expect(source).toContain('requestedTabParam === "pricing" ? "sales" : requestedTabParam');
  });
});
