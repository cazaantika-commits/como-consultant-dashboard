import { describe, it, expect, vi, beforeEach } from "vitest";
import { AGENT_TOOLS, getToolsForAgent } from "./agentTools";

// ═══════════════════════════════════════════════════
// Agent Tools Tests
// ═══════════════════════════════════════════════════

describe("Agent Tools Definitions", () => {
  it("should have all required tools defined", () => {
    expect(AGENT_TOOLS.length).toBeGreaterThan(10);
    
    const toolNames = AGENT_TOOLS.map(t => t.function.name);
    
    // Read tools
    expect(toolNames).toContain("list_projects");
    expect(toolNames).toContain("list_consultants");
    expect(toolNames).toContain("get_project_consultants");
    expect(toolNames).toContain("get_evaluation_scores");
    expect(toolNames).toContain("get_evaluator_scores");
    expect(toolNames).toContain("get_financial_data");
    expect(toolNames).toContain("get_consultant_profile");
    expect(toolNames).toContain("get_committee_decision");
    expect(toolNames).toContain("get_feasibility_study");
    expect(toolNames).toContain("list_tasks");
    expect(toolNames).toContain("get_evaluation_criteria");
    
    // Write tools
    expect(toolNames).toContain("add_consultant");
    expect(toolNames).toContain("update_consultant");
    expect(toolNames).toContain("add_consultant_to_project");
    expect(toolNames).toContain("remove_consultant_from_project");
    expect(toolNames).toContain("set_evaluation_score");
    expect(toolNames).toContain("set_financial_data");
    expect(toolNames).toContain("add_project");
    expect(toolNames).toContain("add_task");
    expect(toolNames).toContain("update_task_status");
    expect(toolNames).toContain("update_consultant_profile");
    expect(toolNames).toContain("add_consultant_note");
  });

  it("each tool should have valid OpenAI function calling format", () => {
    for (const tool of AGENT_TOOLS) {
      expect(tool.type).toBe("function");
      expect(tool.function.name).toBeTruthy();
      expect(tool.function.description).toBeTruthy();
      expect(tool.function.parameters).toBeDefined();
      expect(tool.function.parameters.type).toBe("object");
      expect(tool.function.parameters.properties).toBeDefined();
      expect(Array.isArray(tool.function.parameters.required)).toBe(true);
    }
  });

  it("each tool should have Arabic description", () => {
    for (const tool of AGENT_TOOLS) {
      // All descriptions should contain Arabic characters
      const hasArabic = /[\u0600-\u06FF]/.test(tool.function.description);
      expect(hasArabic).toBe(true);
    }
  });

  it("write tools should have required parameters", () => {
    const addConsultant = AGENT_TOOLS.find(t => t.function.name === "add_consultant");
    expect(addConsultant?.function.parameters.required).toContain("name");

    const setScore = AGENT_TOOLS.find(t => t.function.name === "set_evaluation_score");
    expect(setScore?.function.parameters.required).toContain("projectId");
    expect(setScore?.function.parameters.required).toContain("consultantId");
    expect(setScore?.function.parameters.required).toContain("criterionId");
    expect(setScore?.function.parameters.required).toContain("score");

    const addProject = AGENT_TOOLS.find(t => t.function.name === "add_project");
    expect(addProject?.function.parameters.required).toContain("name");

    const addTask = AGENT_TOOLS.find(t => t.function.name === "add_task");
    expect(addTask?.function.parameters.required).toContain("title");
    expect(addTask?.function.parameters.required).toContain("project");
    expect(addTask?.function.parameters.required).toContain("owner");
  });
});

describe("Agent Tool Access Control", () => {
  it("salwa should have broad access (coordinator)", () => {
    const tools = getToolsForAgent("salwa");
    const names = tools.map(t => t.function.name);
    
    expect(names).toContain("list_projects");
    expect(names).toContain("list_consultants");
    expect(names).toContain("add_consultant");
    expect(names).toContain("add_project");
    expect(names).toContain("add_task");
    expect(names).toContain("update_task_status");
    expect(names).toContain("get_evaluation_criteria");
  });

  it("farouq should have evaluation and financial access (legal/financial analyst)", () => {
    const tools = getToolsForAgent("farouq");
    const names = tools.map(t => t.function.name);
    
    expect(names).toContain("get_evaluation_scores");
    expect(names).toContain("get_evaluator_scores");
    expect(names).toContain("get_financial_data");
    expect(names).toContain("set_evaluation_score");
    expect(names).toContain("set_financial_data");
    expect(names).toContain("add_consultant_note");
    expect(names).toContain("get_committee_decision");
  });

  it("khaled should have evaluation access (quality auditor)", () => {
    const tools = getToolsForAgent("khaled");
    const names = tools.map(t => t.function.name);
    
    expect(names).toContain("get_evaluation_scores");
    expect(names).toContain("get_evaluator_scores");
    expect(names).toContain("set_evaluation_score");
    expect(names).toContain("get_evaluation_criteria");
    // Should NOT have financial write access
    expect(names).not.toContain("set_financial_data");
    expect(names).not.toContain("add_project");
  });

  it("alina should have financial access (financial controller)", () => {
    const tools = getToolsForAgent("alina");
    const names = tools.map(t => t.function.name);
    
    expect(names).toContain("get_financial_data");
    expect(names).toContain("set_financial_data");
    expect(names).toContain("get_feasibility_study");
    // Should NOT have task management
    expect(names).not.toContain("add_task");
    expect(names).not.toContain("update_task_status");
  });

  it("joelle should have read-heavy access (market analyst)", () => {
    const tools = getToolsForAgent("joelle");
    const names = tools.map(t => t.function.name);
    
    expect(names).toContain("get_feasibility_study");
    expect(names).toContain("get_financial_data");
    expect(names).toContain("get_evaluation_scores");
    expect(names).toContain("get_committee_decision");
    // Should NOT have write access to evaluations
    expect(names).not.toContain("set_evaluation_score");
    expect(names).not.toContain("add_consultant");
  });

  it("buraq should have task management access (execution monitor)", () => {
    const tools = getToolsForAgent("buraq");
    const names = tools.map(t => t.function.name);
    
    expect(names).toContain("list_tasks");
    expect(names).toContain("add_task");
    expect(names).toContain("update_task_status");
    // Should NOT have evaluation access
    expect(names).not.toContain("set_evaluation_score");
    expect(names).not.toContain("get_evaluation_scores");
  });

  it("baz should have strategic read access (innovation advisor)", () => {
    const tools = getToolsForAgent("baz");
    const names = tools.map(t => t.function.name);
    
    expect(names).toContain("list_projects");
    expect(names).toContain("get_evaluation_scores");
    expect(names).toContain("get_committee_decision");
    expect(names).toContain("add_task");
  });

  it("khazen should have archive + fee extraction access", () => {
    const tools = getToolsForAgent("khazen");
    const names = tools.map(t => t.function.name);
    
    expect(names).toContain("list_consultants");
    expect(names).toContain("list_drive_files");
    expect(names).toContain("read_drive_file_content");
    expect(names).toContain("extract_proposal_fees");
    expect(names).toContain("set_financial_data");
    expect(names).toContain("get_financial_data");
    // Should NOT have evaluation access
    expect(names).not.toContain("set_evaluation_score");
    expect(names).not.toContain("add_project");
  });

  it("each agent should have at least some tools", () => {
    const agentTypes: Array<"salwa" | "farouq" | "khazen" | "buraq" | "khaled" | "alina" | "baz" | "joelle"> = 
      ["salwa", "farouq", "khazen", "buraq", "khaled", "alina", "baz", "joelle"];
    
    for (const agent of agentTypes) {
      const tools = getToolsForAgent(agent);
      expect(tools.length).toBeGreaterThan(2);
    }
  });

  it("no agent should have all tools (principle of least privilege)", () => {
    const agentTypes: Array<"salwa" | "farouq" | "khazen" | "buraq" | "khaled" | "alina" | "baz" | "joelle"> = 
      ["salwa", "farouq", "khazen", "buraq", "khaled", "alina", "baz", "joelle"];
    
    for (const agent of agentTypes) {
      const tools = getToolsForAgent(agent);
      expect(tools.length).toBeLessThan(AGENT_TOOLS.length);
    }
  });
});

describe("Tool Parameter Validation", () => {
  it("set_evaluation_score should accept valid criterion IDs (0-9)", () => {
    const tool = AGENT_TOOLS.find(t => t.function.name === "set_evaluation_score");
    expect(tool).toBeDefined();
    // The description should mention the criterion range
    expect(tool?.function.description).toContain("0");
    expect(tool?.function.description).toContain("9");
  });

  it("set_evaluation_score should accept valid scores (2,4,6,8,10)", () => {
    const tool = AGENT_TOOLS.find(t => t.function.name === "set_evaluation_score");
    expect(tool?.function.description).toContain("2,4,6,8,10");
  });

  it("set_financial_data should have design and supervision fields", () => {
    const tool = AGENT_TOOLS.find(t => t.function.name === "set_financial_data");
    const props = tool?.function.parameters.properties;
    expect(props).toHaveProperty("designType");
    expect(props).toHaveProperty("designValue");
    expect(props).toHaveProperty("supervisionType");
    expect(props).toHaveProperty("supervisionValue");
  });

  it("add_task should have priority enum", () => {
    const tool = AGENT_TOOLS.find(t => t.function.name === "add_task");
    const priorityProp = tool?.function.parameters.properties.priority;
    expect(priorityProp?.enum).toContain("high");
    expect(priorityProp?.enum).toContain("medium");
    expect(priorityProp?.enum).toContain("low");
  });

  it("update_task_status should have status enum", () => {
    const tool = AGENT_TOOLS.find(t => t.function.name === "update_task_status");
    const statusProp = tool?.function.parameters.properties.status;
    expect(statusProp?.enum).toContain("new");
    expect(statusProp?.enum).toContain("progress");
    expect(statusProp?.enum).toContain("hold");
    expect(statusProp?.enum).toContain("done");
    expect(statusProp?.enum).toContain("cancelled");
  });
});
