/**
 * Financial Engine Adapter — محوّل المحرك المالي
 * 
 * يحوّل مخرجات المحرك الجديد (computeFullFinancials) إلى الشكل المتوقع
 * من الواجهات الأمامية الموجودة (PortfolioSummaryReport, CapitalPortfolioPage).
 * 
 * لا يحذف أو يعدل أي كود موجود — يعمل بالتوازي.
 */

import {
  computeFullFinancials,
  projectToInputs,
  type ProjectInputs,
  type FinancialResult,
  type CashFlowItem,
  type MonthlyItem,
  type FinancingScenario,
} from "./financialEngine";

// ═══════════════════════════════════════════════════════════════
// Types matching existing API contract
// ═══════════════════════════════════════════════════════════════

export interface ScenarioSummaryV2 {
  investorTotal: number;
  escrowTotal: number;
  grandTotal: number;
  totalProjectCost: number;
  monthlyInvestor: number[];
  monthlyEscrow: number[];
  monthlyTotal: number[];
  sectionTotals: Record<string, number>;
  monthlyBySection: Record<string, number[]>;
  monthlyInvestorBySection: Record<string, number[]>;
}

export interface PortfolioProjectV2 {
  projectId: number;
  name: string;
  startDate: string;
  totalMonths: number;
  totalCosts: number;
  totalRevenue: number;
  phaseInfo: {
    design: { duration: number; start: number };
    offplan: { duration: number; start: number };
    construction: { duration: number; start: number };
    handover: { duration: number; start: number };
  };
  durations: {
    design: number;
    offplan: number;
    construction: number;
    handover: number;
  };
  scenarios: Record<string, ScenarioSummaryV2>;
}

// ═══════════════════════════════════════════════════════════════
// Section classification for items
// ═══════════════════════════════════════════════════════════════

/**
 * Maps item IDs to their display section.
 * This determines which column/phase the item appears in.
 */
function getItemSection(itemId: string, scenario: FinancingScenario): string {
  // Land items (paid before project starts)
  if (["land_cost", "land_broker", "land_registration"].includes(itemId)) {
    return "paid";
  }
  
  // Design phase items
  if (["soil_test", "survey", "official_bodies_10pct", "design_fee"].includes(itemId)) {
    return "design";
  }
  
  // Developer fee spans multiple phases but we assign to design for section totals
  if (itemId === "developer_fee") {
    return "design";
  }
  
  // Off-plan registration items
  if (["fraz_fee", "rera_registration", "rera_units", "noc_fee", "escrow_fee"].includes(itemId)) {
    return scenario === "no_offplan" ? "construction" : "offplan";
  }
  
  // Construction items
  if ([
    "contractor_investor", "contingency", "bank_fees",
    "marketing", "community_fee",
  ].includes(itemId)) {
    return "construction";
  }
  
  // Escrow items
  if ([
    "gov_fees_escrow", "contractor_escrow", "supervision_fee",
    "sales_commission", "surveyor_fees", "rera_audit", "rera_inspection",
  ].includes(itemId)) {
    return "escrow";
  }
  
  return "construction"; // fallback
}

// ═══════════════════════════════════════════════════════════════
// Main adapter function
// ═══════════════════════════════════════════════════════════════

/**
 * Convert new engine result to the existing portfolio API shape.
 * This allows the new engine to be used alongside the old one.
 */
export function adaptToPortfolioShape(
  result: FinancialResult,
  inputs: ProjectInputs
): ScenarioSummaryV2 {
  const totalMonths = result.timeline.totalMonths;
  const scenario = inputs.financingScenario;
  
  // Initialize monthly arrays
  const monthlyInvestor = new Array(totalMonths).fill(0);
  const monthlyEscrow = new Array(totalMonths).fill(0);
  const monthlyTotal = new Array(totalMonths).fill(0);
  
  // Section totals
  const sectionTotals: Record<string, number> = {
    paid: 0,
    design: 0,
    offplan: 0,
    construction: 0,
    escrow: 0,
  };
  
  // Monthly by section (for delay calculations in the UI)
  const monthlyBySection: Record<string, number[]> = {
    paid: new Array(totalMonths).fill(0),
    design: new Array(totalMonths).fill(0),
    offplan: new Array(totalMonths).fill(0),
    construction: new Array(totalMonths).fill(0),
    escrow: new Array(totalMonths).fill(0),
  };
  
  const monthlyInvestorBySection: Record<string, number[]> = {
    paid: new Array(totalMonths).fill(0),
    design: new Array(totalMonths).fill(0),
    offplan: new Array(totalMonths).fill(0),
    construction: new Array(totalMonths).fill(0),
    escrow: new Array(totalMonths).fill(0),
  };
  
  // Process investor items
  for (const item of result.investorCashFlow) {
    const section = getItemSection(item.id, scenario);
    sectionTotals[section] = (sectionTotals[section] || 0) + item.total;
    
    for (const m of item.monthly) {
      // Month 0 = before start (paid/land), map to index 0
      const idx = Math.max(0, Math.min(m.month, totalMonths - 1));
      monthlyInvestor[idx] += m.amount;
      monthlyTotal[idx] += m.amount;
      monthlyBySection[section][idx] += m.amount;
      monthlyInvestorBySection[section][idx] += m.amount;
    }
  }
  
  // Process escrow items
  // Note: some items (retention, sales commission) may have months beyond totalMonths.
  // We extend the arrays to accommodate all months, matching the existing API behavior.
  let maxMonth = totalMonths;
  for (const item of result.escrowCashFlow) {
    for (const m of item.monthly) {
      if (m.month >= maxMonth) maxMonth = m.month + 1;
    }
  }
  // Extend arrays if needed
  if (maxMonth > totalMonths) {
    const extend = maxMonth - totalMonths;
    monthlyInvestor.push(...new Array(extend).fill(0));
    monthlyEscrow.push(...new Array(extend).fill(0));
    monthlyTotal.push(...new Array(extend).fill(0));
    for (const section of Object.keys(monthlyBySection)) {
      monthlyBySection[section].push(...new Array(extend).fill(0));
      monthlyInvestorBySection[section].push(...new Array(extend).fill(0));
    }
  }
  
  for (const item of result.escrowCashFlow) {
    const section = "escrow";
    sectionTotals[section] = (sectionTotals[section] || 0) + item.total;
    
    for (const m of item.monthly) {
      const idx = Math.max(0, Math.min(m.month, maxMonth - 1));
      monthlyEscrow[idx] += m.amount;
      monthlyTotal[idx] += m.amount;
      monthlyBySection[section][idx] += m.amount;
    }
  }
  
  const investorTotal = result.capitalRequired;
  const escrowTotal = result.escrowCashFlow.reduce((s, item) => s + item.total, 0);
  
  return {
    investorTotal,
    escrowTotal,
    grandTotal: investorTotal + escrowTotal,
    totalProjectCost: result.costs.totalCosts,
    monthlyInvestor,
    monthlyEscrow,
    monthlyTotal,
    sectionTotals,
    monthlyBySection,
    monthlyInvestorBySection,
  };
}

/**
 * Build a full portfolio project entry using the new engine.
 * Takes raw project data from DB and returns the same shape as getPortfolioAllScenarios.
 */
export function buildPortfolioProjectV2(
  project: any,
  overrides?: any,
  totalUnits?: number,
  calculatedRevenue?: number
): PortfolioProjectV2 | null {
  // Build base inputs
  const baseInputs = projectToInputs(project, overrides, totalUnits, calculatedRevenue);
  
  // Calculate for all 3 scenarios
  const scenarios: Record<string, ScenarioSummaryV2> = {};
  const scenarioList: FinancingScenario[] = ["offplan_escrow", "offplan_construction", "no_offplan"];
  
  for (const sc of scenarioList) {
    const inputs: ProjectInputs = { ...baseInputs, financingScenario: sc };
    
    // Adjust developer fee for O3
    if (sc === "no_offplan") {
      inputs.developerFeePct = Math.min(inputs.developerFeePct, 3);
    }
    
    const result = computeFullFinancials(inputs);
    scenarios[sc] = adaptToPortfolioShape(result, inputs);
  }
  
  // Use O1 result for timeline info
  const o1Inputs: ProjectInputs = { ...baseInputs, financingScenario: "offplan_escrow" };
  const o1Result = computeFullFinancials(o1Inputs);
  const timeline = o1Result.timeline;
  
  return {
    projectId: project.id,
    name: project.name || project.projectName || `مشروع ${project.id}`,
    startDate: project.startDate || "2026-04",
    totalMonths: timeline.totalMonths,
    totalCosts: o1Result.costs.totalCosts,
    totalRevenue: o1Result.costs.totalRevenue,
    phaseInfo: {
      design: { duration: baseInputs.designMonths, start: timeline.designStart },
      offplan: { duration: baseInputs.offplanMonths, start: timeline.offplanStart },
      construction: { duration: baseInputs.constructionMonths, start: timeline.constructionStart },
      handover: { duration: baseInputs.handoverMonths, start: timeline.handoverStart },
    },
    durations: {
      design: baseInputs.designMonths,
      offplan: baseInputs.offplanMonths,
      construction: baseInputs.constructionMonths,
      handover: baseInputs.handoverMonths,
    },
    scenarios,
  };
}
