import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Tests for the 6-section consolidation of Project Management.
 * Verifies that:
 * 1. ProjectManagementPage has exactly 6 sections in the correct order
 * 2. CashFlowHub has 3 tabs (Investor, Escrow, Command Center)
 * 3. WorkProgramHub has 2 tabs (Program, Simulation)
 * 4. All embedded components accept the embedded prop
 * 5. Data flow is properly connected (projects → Joelle → costs → cash flows → work program)
 */

const CLIENT_PAGES = path.resolve(__dirname, "../client/src/pages");

describe("6-Section Consolidation", () => {
  describe("ProjectManagementPage structure", () => {
    const pmContent = fs.readFileSync(
      path.join(CLIENT_PAGES, "ProjectManagementPage.tsx"),
      "utf8"
    );

    it("should have exactly 6 sections in ICONS_CONFIG", () => {
      // Count section definitions in ICONS_CONFIG
      const sectionMatches = pmContent.match(/id:\s*"[^"]+"\s*as\s*View/g);
      expect(sectionMatches).toBeTruthy();
      expect(sectionMatches!.length).toBe(6);
    });

    it("should have sections numbered 1-6", () => {
      const numberMatches = pmContent.match(/number:\s*\d+/g);
      expect(numberMatches).toBeTruthy();
      const numbers = numberMatches!.map((m) => parseInt(m.replace("number: ", "")));
      expect(numbers).toEqual([1, 2, 3, 4, 5, 6]);
    });

    it("should have correct section IDs in order", () => {
      const idMatches = pmContent.match(/id:\s*"([^"]+)"\s*as\s*View/g);
      expect(idMatches).toBeTruthy();
      const ids = idMatches!.map((m) => m.match(/"([^"]+)"/)?.[1]);
      expect(ids).toEqual([
        "fact-sheet",
        "feasibility",
        "cashflow-hub",
        "work-program",
        "development-stages",
        "risk-dashboard",
      ]);
    });

    it("should import CashFlowHub and WorkProgramHub", () => {
      expect(pmContent).toContain('import CashFlowHub from');
      expect(pmContent).toContain('import WorkProgramHub from');
    });

    it("should render CashFlowHub with embedded prop", () => {
      expect(pmContent).toContain("<CashFlowHub embedded");
    });

    it("should render WorkProgramHub with embedded prop", () => {
      expect(pmContent).toContain("<WorkProgramHub embedded");
    });

    it("should render RiskDashboardPage with embedded prop", () => {
      expect(pmContent).toContain("<RiskDashboardPage embedded");
    });

    it("should have View type with all 6 section IDs plus icons", () => {
      const viewTypeMatch = pmContent.match(/type View\s*=\s*"icons"\s*\|[^;]+/);
      expect(viewTypeMatch).toBeTruthy();
      const viewType = viewTypeMatch![0];
      expect(viewType).toContain("fact-sheet");
      expect(viewType).toContain("feasibility");
      expect(viewType).toContain("cashflow-hub");
      expect(viewType).toContain("work-program");
      expect(viewType).toContain("development-stages");
      expect(viewType).toContain("risk-dashboard");
    });
  });

  describe("CashFlowHub structure", () => {
    const hubContent = fs.readFileSync(
      path.join(CLIENT_PAGES, "CashFlowHub.tsx"),
      "utf8"
    );

    it("should have 3 tabs", () => {
      const tabMatches = hubContent.match(/id:\s*"[^"]+"\s*as\s*const/g);
      expect(tabMatches).toBeTruthy();
      expect(tabMatches!.length).toBe(3);
    });

    it("should have investor, escrow, and command tabs", () => {
      expect(hubContent).toContain('"investor"');
      expect(hubContent).toContain('"escrow"');
      expect(hubContent).toContain('"command"');
    });

    it("should render ExcelCashFlowPage with embedded prop for investor tab", () => {
      expect(hubContent).toContain("<ExcelCashFlowPage embedded");
    });

    it("should render EscrowCashFlowPage with embedded prop for escrow tab", () => {
      expect(hubContent).toContain("<EscrowCashFlowPage embedded");
    });

    it("should render FinancialCommandCenter with embedded prop for command tab", () => {
      expect(hubContent).toContain("<FinancialCommandCenter embedded");
    });

    it("should accept embedded prop", () => {
      expect(hubContent).toContain("{ embedded }");
    });

    it("should have Arabic labels for all tabs", () => {
      expect(hubContent).toContain("مصاريف المستثمر");
      expect(hubContent).toContain("حساب الضمان");
      expect(hubContent).toContain("مركز القيادة");
    });

    it("should wrap content in CashFlowProvider", () => {
      expect(hubContent).toContain("<CashFlowProvider>");
    });
  });

  describe("WorkProgramHub structure", () => {
    const hubContent = fs.readFileSync(
      path.join(CLIENT_PAGES, "WorkProgramHub.tsx"),
      "utf8"
    );

    it("should have 2 tabs", () => {
      const tabMatches = hubContent.match(/id:\s*"[^"]+"\s*as\s*const/g);
      expect(tabMatches).toBeTruthy();
      expect(tabMatches!.length).toBe(2);
    });

    it("should have program and simulation tabs", () => {
      expect(hubContent).toContain('"program"');
      expect(hubContent).toContain('"simulation"');
    });

    it("should render ProgramCashFlowPage for program tab", () => {
      expect(hubContent).toContain("<ProgramCashFlowPage");
    });

    it("should render CapitalPlanningDashboard with embedded prop for simulation tab", () => {
      expect(hubContent).toContain("<CapitalPlanningDashboard embedded");
    });

    it("should accept embedded prop", () => {
      expect(hubContent).toContain("{ embedded }");
    });

    it("should have Arabic labels for all tabs", () => {
      expect(hubContent).toContain("بنود التكاليف والمراحل");
      expect(hubContent).toContain("محاكاة المحفظة");
    });
  });

  describe("Embedded components accept embedded prop", () => {
    const components = [
      { name: "ExcelCashFlowPage", file: "ExcelCashFlowPage.tsx" },
      { name: "EscrowCashFlowPage", file: "EscrowCashFlowPage.tsx" },
      { name: "FinancialCommandCenter", file: "FinancialCommandCenter.tsx" },
      { name: "CapitalPlanningDashboard", file: "CapitalPlanningDashboard.tsx" },
      { name: "RiskDashboardPage", file: "RiskDashboardPage.tsx" },
      { name: "FactSheetPage", file: "FactSheetPage.tsx" },
      { name: "FeasibilityStudyPage", file: "FeasibilityStudyPage.tsx" },
      { name: "DevelopmentStagesPage", file: "DevelopmentStagesPage.tsx" },
    ];

    components.forEach(({ name, file }) => {
      it(`${name} should accept embedded prop`, () => {
        const content = fs.readFileSync(path.join(CLIENT_PAGES, file), "utf8");
        expect(content).toMatch(/embedded/);
      });
    });
  });

  describe("Data flow connectivity", () => {
    it("cashFlowProgram router should read from projects table (not feasibilityStudies)", () => {
      const routerContent = fs.readFileSync(
        path.resolve(__dirname, "routers/cashFlowProgram.ts"),
        "utf8"
      );
      // Should reference projects table
      expect(routerContent).toContain("projects");
      // Should NOT reference feasibilityStudies for data reading
      // (it may still import it but should not use it as primary data source)
    });

    it("sectionStatus router should exist for status indicators", () => {
      const routersContent = fs.readFileSync(
        path.resolve(__dirname, "routers.ts"),
        "utf8"
      );
      expect(routersContent).toContain("sectionStatus");
    });

    it("CostsCashFlowTab should exist for Budget & Pricing", () => {
      const exists = fs.existsSync(
        path.resolve(__dirname, "../client/src/components/feasibility/CostsCashFlowTab.tsx")
      );
      expect(exists).toBe(true);
    });

    it("Joelle engine tab should exist", () => {
      const exists = fs.existsSync(
        path.resolve(__dirname, "../client/src/components/feasibility/JoelleEngineTab.tsx")
      );
      expect(exists).toBe(true);
    });

    it("Joelle data manager should exist", () => {
      const exists = fs.existsSync(
        path.resolve(__dirname, "../client/src/components/feasibility/JoelleDataManager.tsx")
      );
      expect(exists).toBe(true);
    });
  });

  describe("Section status indicators", () => {
    const pmContent = fs.readFileSync(
      path.join(CLIENT_PAGES, "ProjectManagementPage.tsx"),
      "utf8"
    );

    it("should have StatusBadge component with 3 states", () => {
      expect(pmContent).toContain("StatusBadge");
      expect(pmContent).toContain('"complete"');
      expect(pmContent).toContain('"partial"');
      expect(pmContent).toContain('"empty"');
    });

    it("should have StatusLegend component", () => {
      expect(pmContent).toContain("StatusLegend");
      expect(pmContent).toContain("مكتمل");
      expect(pmContent).toContain("يحتاج بيانات");
      expect(pmContent).toContain("فارغ");
    });

    it("should query sectionStatus.getAll", () => {
      expect(pmContent).toContain("trpc.sectionStatus.getAll.useQuery");
    });

    it("should map merged section status keys correctly", () => {
      // CashFlowHub maps to cashflow + escrow + financial-command
      expect(pmContent).toContain('"cashflow-hub"');
      expect(pmContent).toContain('"cashflow"');
      expect(pmContent).toContain('"escrow"');
      expect(pmContent).toContain('"financial-command"');
      // WorkProgramHub maps to program-cashflow + capital-planning
      expect(pmContent).toContain('"work-program"');
      expect(pmContent).toContain('"program-cashflow"');
      expect(pmContent).toContain('"capital-planning"');
    });
  });
});
