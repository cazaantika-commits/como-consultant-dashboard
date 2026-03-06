import { describe, it, expect, beforeAll } from "vitest";
import * as fs from "fs";
import * as path from "path";

// Test the Joelle upgrade: new tools, system prompt, and report prompts

describe("Joelle Market Intelligence Upgrade", () => {
  const agentToolsPath = path.join(__dirname, "agentTools.ts");
  const agentChatPath = path.join(__dirname, "agentChat.ts");
  const marketOverviewPath = path.join(__dirname, "routers/marketOverview.ts");
  const competitionPricingPath = path.join(__dirname, "routers/competitionPricing.ts");
  const feasibilityPath = path.join(__dirname, "routers/feasibility.ts");

  let agentToolsContent: string;
  let agentChatContent: string;
  let marketOverviewContent: string;
  let competitionPricingContent: string;
  let feasibilityContent: string;

  // Read all files once
  beforeAll(() => {
    agentToolsContent = fs.readFileSync(agentToolsPath, "utf-8");
    agentChatContent = fs.readFileSync(agentChatPath, "utf-8");
    marketOverviewContent = fs.readFileSync(marketOverviewPath, "utf-8");
    competitionPricingContent = fs.readFileSync(competitionPricingPath, "utf-8");
    feasibilityContent = fs.readFileSync(feasibilityPath, "utf-8");
  });

  // ═══════════════════════════════════════
  // New Tools for Joelle
  // ═══════════════════════════════════════

  describe("New Market Intelligence Tools", () => {
    it("should define get_market_overview tool", () => {
      expect(agentToolsContent).toContain("get_market_overview");
      expect(agentToolsContent).toContain("marketOverview");
    });

    it("should define get_competition_pricing tool", () => {
      expect(agentToolsContent).toContain("get_competition_pricing");
      expect(agentToolsContent).toContain("competitionPricing");
    });

    it("should define get_cash_flow_summary tool", () => {
      expect(agentToolsContent).toContain("get_cash_flow_summary");
      expect(agentToolsContent).toContain("cfProjects");
    });

    it("should define get_all_market_data tool", () => {
      expect(agentToolsContent).toContain("get_all_market_data");
    });

    it("should include new tools in Joelle's allowed tools list", () => {
      // Find Joelle's tools section
      const joelleToolsMatch = agentToolsContent.match(/joelle:\s*\[([\s\S]*?)\]/);
      expect(joelleToolsMatch).toBeTruthy();
      const joelleTools = joelleToolsMatch![1];
      
      expect(joelleTools).toContain("get_market_overview");
      expect(joelleTools).toContain("get_competition_pricing");
      expect(joelleTools).toContain("get_cash_flow_summary");
      expect(joelleTools).toContain("get_all_market_data");
    });

    it("should include market tools in Alina's allowed tools list", () => {
      const alinaToolsMatch = agentToolsContent.match(/alina:\s*\[([\s\S]*?)\]/);
      expect(alinaToolsMatch).toBeTruthy();
      const alinaTools = alinaToolsMatch![1];
      
      expect(alinaTools).toContain("get_market_overview");
      expect(alinaTools).toContain("get_competition_pricing");
    });

    it("should have execution handlers for all new tools", () => {
      expect(agentToolsContent).toContain('case "get_market_overview"');
      expect(agentToolsContent).toContain('case "get_competition_pricing"');
      expect(agentToolsContent).toContain('case "get_cash_flow_summary"');
      expect(agentToolsContent).toContain('case "get_all_market_data"');
    });
  });

  // ═══════════════════════════════════════
  // Joelle System Prompt Upgrade
  // ═══════════════════════════════════════

  describe("Joelle System Prompt - Source Hierarchy", () => {
    it("should include source hierarchy (هرم المصادر)", () => {
      expect(agentChatContent).toContain("هرم المصادر");
    });

    it("should define 4 levels of sources", () => {
      expect(agentChatContent).toContain("المستوى 1");
      expect(agentChatContent).toContain("المستوى 2");
      expect(agentChatContent).toContain("المستوى 3");
      expect(agentChatContent).toContain("المستوى 4");
    });

    it("should mention internal platform data as top priority", () => {
      expect(agentChatContent).toContain("بيانات المنصة الداخلية");
      expect(agentChatContent).toContain("الأولوية القصوى");
    });

    it("should reference DXBInteract as official external source", () => {
      expect(agentChatContent).toContain("DXBInteract");
    });

    it("should reference JLL and Colliers as report standard", () => {
      expect(agentChatContent).toContain("JLL");
      expect(agentChatContent).toContain("Colliers");
    });
  });

  describe("Joelle System Prompt - Verification Protocol", () => {
    it("should include price verification protocol", () => {
      expect(agentChatContent).toContain("بروتوكول التحقق من الأسعار");
    });

    it("should require 3 sources minimum for pricing", () => {
      expect(agentChatContent).toContain("3 مصادر على الأقل");
    });

    it("should alert on >15% price discrepancy", () => {
      expect(agentChatContent).toContain("15%");
    });
  });

  describe("Joelle System Prompt - Report Standards", () => {
    it("should include JLL/Colliers report structure", () => {
      expect(agentChatContent).toContain("معايير التقارير");
      expect(agentChatContent).toContain("بمستوى JLL/Colliers");
    });

    it("should require Executive Summary section", () => {
      expect(agentChatContent).toContain("الملخص التنفيذي");
      expect(agentChatContent).toContain("Executive Summary");
    });

    it("should require source documentation", () => {
      expect(agentChatContent).toContain("قواعد التوثيق");
      expect(agentChatContent).toContain("كل رقم يجب أن يكون مرفقاً بمصدره");
    });

    it("should mention new tools in source hierarchy", () => {
      expect(agentChatContent).toContain("get_all_market_data");
      expect(agentChatContent).toContain("get_market_overview");
      expect(agentChatContent).toContain("get_competition_pricing");
      expect(agentChatContent).toContain("get_cash_flow_summary");
    });
  });

  // ═══════════════════════════════════════
  // AI Report Prompts Upgrade
  // ═══════════════════════════════════════

  describe("Market Overview Report Prompt", () => {
    it("should reference JLL/Colliers standard", () => {
      expect(marketOverviewContent).toContain("بمستوى JLL / Colliers");
    });

    it("should include Executive Summary section", () => {
      expect(marketOverviewContent).toContain("الملخص التنفيذي");
    });

    it("should include Macroeconomic Context section", () => {
      expect(marketOverviewContent).toContain("السياق الاقتصادي الكلي");
    });

    it("should include Location Analysis section", () => {
      expect(marketOverviewContent).toContain("تحليل الموقع");
    });

    it("should include Supply & Demand section", () => {
      expect(marketOverviewContent).toContain("تحليل العرض والطلب");
    });

    it("should require source documentation", () => {
      expect(marketOverviewContent).toContain("كل رقم يجب أن يكون مرفقاً بمصدره");
    });

    it("should require 1500-2500 words", () => {
      expect(marketOverviewContent).toContain("1500-2500 كلمة");
    });
  });

  describe("Competition Pricing Report Prompt", () => {
    it("should reference JLL/Colliers standard", () => {
      expect(competitionPricingContent).toContain("بمستوى JLL / Colliers");
    });

    it("should include Competitor Analysis with table structure", () => {
      expect(competitionPricingContent).toContain("تحليل المنافسين");
      expect(competitionPricingContent).toContain("5-8 مشاريع");
    });

    it("should include Payment Plan Analysis", () => {
      expect(competitionPricingContent).toContain("تحليل خطط السداد");
    });

    it("should include Sensitivity Analysis", () => {
      expect(competitionPricingContent).toContain("تحليل الحساسية");
      expect(competitionPricingContent).toContain("-20%");
    });

    it("should require source for every price", () => {
      expect(competitionPricingContent).toContain("كل سعر يجب أن يكون مرفقاً بمصدره");
    });
  });

  describe("Feasibility Study Report Prompts", () => {
    it("should upgrade summary prompt to JLL standard", () => {
      expect(feasibilityContent).toContain("ملخصاً تحليلياً احترافياً بمستوى JLL");
    });

    it("should include risk table in summary", () => {
      expect(feasibilityContent).toContain("المخاطرة | الاحتمالية | التأثير | التخفيف");
    });

    it("should include sensitivity analysis in summary", () => {
      expect(feasibilityContent).toContain("تحليل الحساسية");
      expect(feasibilityContent).toContain("انخفضت الأسعار 10%");
    });

    it("should upgrade market analysis prompt", () => {
      expect(feasibilityContent).toContain("محللة استخبارات السوق العقاري");
      expect(feasibilityContent).toContain("بمستوى JLL / Colliers لسوق منطقة");
    });

    it("should upgrade comprehensive report prompt", () => {
      expect(feasibilityContent).toContain("محللة استخبارات السوق ودراسات الجدوى");
      expect(feasibilityContent).toContain("تقريراً شاملاً بمستوى JLL / Colliers");
    });

    it("should upgrade board report to recommendation-first format", () => {
      expect(feasibilityContent).toContain("التوصية (أولاً)");
      expect(feasibilityContent).toContain("موافقة / ✅ موافقة بشروط / ❌ رفض");
    });

    it("should include financial data in comprehensive and board reports", () => {
      // Both prompts should now include actual financial data
      const comprehensiveMatch = feasibilityContent.match(/تقريراً شاملاً بمستوى[\s\S]*?البيانات المالية/);
      expect(comprehensiveMatch).toBeTruthy();
      
      const boardMatch = feasibilityContent.match(/تقريراً تنفيذياً موجزاً[\s\S]*?البيانات المالية/);
      expect(boardMatch).toBeTruthy();
    });
  });
});
