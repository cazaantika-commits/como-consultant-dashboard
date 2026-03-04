/**
 * Cash Flow Engine v2 — Dual Cash Flow Model
 * 
 * Two separate cash flows:
 * 1. Developer Funds: All costs the developer pays from own pocket
 * 2. Escrow Account: Sales revenue in, contractor payments out
 * 
 * 3 Phases: Pre-Development → Construction → Handover & Closeout
 * 
 * Construction Cost = BUA × Cost/sqft
 * Developer pays 35% of construction (20% escrow deposit + 10% advance + 5% buffer)
 * Escrow pays remaining 65% from buyer payments
 */

// ─── Types ───

export interface PhaseTimeline {
  preDev: { start: number; end: number; months: number };
  construction: { start: number; end: number; months: number };
  handover: { start: number; end: number; months: number };
  totalMonths: number;
}

export interface CostItemInput {
  id: number;
  name: string;
  category: string;
  totalAmount: number;
  paymentType: string;
  paymentParams: Record<string, any>;
  fundingSource: 'developer' | 'escrow' | 'mixed';
  escrowEligible: boolean;
  phaseTag: 'pre_dev' | 'construction' | 'handover' | 'all';
  phaseAllocation?: Record<string, any>;
}

export interface ProjectInput {
  startDate: string; // YYYY-MM
  preDevMonths: number;
  constructionMonths: number;
  handoverMonths: number;
  salesEnabled: boolean;
  salesStartMonth: number | null; // month number relative to project start
  totalSalesRevenue: number | null;
  buyerPlanBookingPct: number;
  buyerPlanConstructionPct: number;
  buyerPlanHandoverPct: number;
  escrowDepositPct: number;
  contractorAdvancePct: number;
  liquidityBufferPct: number;
  constructionCostTotal: number | null;
  buaSqft: number | null;
  constructionCostPerSqft: number | null;
}

export interface MonthlyRow {
  month: number; // 1-based
  label: string; // "Apr 2026"
  phase: 'pre_dev' | 'construction' | 'handover';
  // Developer side
  developerOutflow: number;
  developerCumulative: number;
  // Escrow side
  escrowInflow: number; // sales revenue
  escrowOutflow: number; // contractor payments from escrow
  escrowBalance: number;
  // Combined
  totalOutflow: number;
  totalInflow: number;
  netCashFlow: number;
  cumulativeNet: number;
  // Breakdown
  developerBreakdown: Record<string, number>;
  escrowBreakdown: Record<string, number>;
}

export interface CashFlowResult {
  phases: PhaseTimeline;
  totalMonths: number;
  monthLabels: string[];
  monthlyTable: MonthlyRow[];
  // Key numbers
  totalProjectCost: number;
  totalSalesRevenue: number;
  constructionCost: number;
  developerEarlyFunding: number;
  escrowConstructionFunding: number;
  developerMaxExposure: number;
  developerMaxExposureMonth: number;
  developerMaxExposureLabel: string;
  netProfit: number;
  roi: number;
  // Funding structure
  fundingStructure: {
    escrowDeposit: number;
    contractorAdvance: number;
    liquidityBuffer: number;
    totalDeveloperConstruction: number;
    escrowConstruction: number;
  };
  // Category breakdown
  costByCategory: Record<string, number>;
  developerCosts: number;
  escrowCosts: number;
}

// ─── Phase Timeline Builder ───

export function buildPhaseTimeline(
  preDevMonths: number,
  constructionMonths: number,
  handoverMonths: number
): PhaseTimeline {
  const preDev = { start: 1, end: preDevMonths, months: preDevMonths };
  const construction = {
    start: preDevMonths + 1,
    end: preDevMonths + constructionMonths,
    months: constructionMonths,
  };
  const handover = {
    start: preDevMonths + constructionMonths + 1,
    end: preDevMonths + constructionMonths + handoverMonths,
    months: handoverMonths,
  };
  const totalMonths = preDevMonths + constructionMonths + handoverMonths;

  return { preDev, construction, handover, totalMonths };
}

// ─── Month Label Generator ───

export function generateMonthLabels(startDate: string, totalMonths: number): string[] {
  const [startYear, startMonthStr] = startDate.split('-');
  const startMonthNum = parseInt(startMonthStr) || 1;
  const startYearNum = parseInt(startYear) || 2026;
  const monthNamesAr = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  const monthNamesEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const labels: string[] = [];
  for (let m = 0; m < totalMonths; m++) {
    const monthIdx = (startMonthNum - 1 + m) % 12;
    const year = startYearNum + Math.floor((startMonthNum - 1 + m) / 12);
    labels.push(`${monthNamesEn[monthIdx]}-${String(year).slice(2)}`);
  }
  return labels;
}

// ─── Construction Payment Curve ───

function buildConstructionPaymentCurve(constructionMonths: number): number[] {
  // Based on the spec: 10% advance, 3%, 4%, 4%, 5%, then progressive for remaining
  // This is the FULL 100% curve across construction months
  const curve = new Array(constructionMonths).fill(0);
  
  if (constructionMonths <= 0) return curve;
  
  // First month: 10% advance payment
  curve[0] = 10;
  
  if (constructionMonths >= 2) curve[1] = 3;
  if (constructionMonths >= 3) curve[2] = 4;
  if (constructionMonths >= 4) curve[3] = 4;
  if (constructionMonths >= 5) curve[4] = 5;
  
  // Remaining percentage distributed across remaining months (progressive S-curve)
  const usedPct = curve.reduce((s, v) => s + v, 0);
  const remainingPct = 100 - usedPct;
  const remainingMonths = constructionMonths - 5;
  
  if (remainingMonths > 0 && remainingPct > 0) {
    // S-curve distribution for remaining months
    const weights: number[] = [];
    for (let i = 0; i < remainingMonths; i++) {
      const t = (i + 0.5) / remainingMonths;
      // S-curve: higher in the middle, lower at start and end
      const w = Math.sin(t * Math.PI);
      weights.push(w);
    }
    const totalWeight = weights.reduce((s, w) => s + w, 0);
    for (let i = 0; i < remainingMonths; i++) {
      curve[5 + i] = (weights[i] / totalWeight) * remainingPct;
    }
  }
  
  return curve;
}

// ─── Sales Inflow Calculator ───

function calculateSalesInflow(
  project: ProjectInput,
  phases: PhaseTimeline,
  totalMonths: number
): number[] {
  const inflow = new Array(totalMonths).fill(0);
  
  if (!project.salesEnabled || !project.totalSalesRevenue) return inflow;
  
  const totalRevenue = project.totalSalesRevenue;
  const salesStart = project.salesStartMonth || (phases.construction.start + 1); // Default: month 2 of construction
  
  // Buyer payment plan
  const bookingPct = project.buyerPlanBookingPct / 100;
  const constructionPct = project.buyerPlanConstructionPct / 100;
  const handoverPct = project.buyerPlanHandoverPct / 100;
  
  // Distribute sales across construction phase (linear)
  const salesMonths = Math.max(1, phases.construction.end - salesStart + 1);
  const monthlySalesRevenue = totalRevenue / salesMonths;
  
  for (let m = salesStart - 1; m < phases.construction.end && m < totalMonths; m++) {
    // Booking payment (immediate)
    inflow[m] += monthlySalesRevenue * bookingPct;
    
    // Construction installments (spread over remaining construction months)
    const remainingConstructionMonths = phases.construction.end - m;
    if (remainingConstructionMonths > 0) {
      const monthlyConstruction = (monthlySalesRevenue * constructionPct) / remainingConstructionMonths;
      for (let cm = m; cm < phases.construction.end && cm < totalMonths; cm++) {
        inflow[cm] += monthlyConstruction;
      }
    }
    
    // Handover payment (at handover)
    if (phases.handover.start - 1 < totalMonths) {
      const handoverMonth = Math.min(phases.handover.start - 1, totalMonths - 1);
      inflow[handoverMonth] += monthlySalesRevenue * handoverPct;
    }
  }
  
  return inflow;
}

// ─── Cost Distribution Calculator ───

function distributeCostItem(
  item: CostItemInput,
  phases: PhaseTimeline,
  totalMonths: number
): number[] {
  const monthly = new Array(totalMonths).fill(0);
  const amount = item.totalAmount;
  
  if (amount <= 0) return monthly;
  
  const params = item.paymentParams || {};
  
  switch (item.paymentType) {
    case 'lump_sum': {
      const payMonth = (params.paymentMonth || 1) - 1;
      if (payMonth >= 0 && payMonth < totalMonths) {
        monthly[payMonth] = amount;
      }
      break;
    }
    
    case 'milestone': {
      const milestones = params.milestones || [];
      for (const ms of milestones) {
        const monthIdx = (ms.monthOffset || 1) - 1;
        if (monthIdx >= 0 && monthIdx < totalMonths) {
          monthly[monthIdx] += amount * ((ms.percent || 0) / 100);
        }
      }
      break;
    }
    
    case 'monthly_fixed': {
      // Determine which phase this cost belongs to
      let startMonth: number, endMonth: number;
      if (item.phaseTag === 'pre_dev') {
        startMonth = phases.preDev.start - 1;
        endMonth = phases.preDev.end;
      } else if (item.phaseTag === 'construction') {
        startMonth = phases.construction.start - 1;
        endMonth = phases.construction.end;
      } else if (item.phaseTag === 'handover') {
        startMonth = phases.handover.start - 1;
        endMonth = phases.handover.end;
      } else {
        // 'all' - spread across entire project
        startMonth = 0;
        endMonth = totalMonths;
      }
      
      // Allow custom start/end from params
      if (params.startMonth) startMonth = params.startMonth - 1;
      if (params.endMonth) endMonth = params.endMonth;
      
      const months = Math.max(1, endMonth - startMonth);
      const monthlyAmount = amount / months;
      for (let m = startMonth; m < endMonth && m < totalMonths; m++) {
        if (m >= 0) monthly[m] = monthlyAmount;
      }
      break;
    }
    
    case 'progress_based': {
      // Construction progress-based (S-curve)
      const constructionMonths = phases.construction.months;
      const curve = buildConstructionPaymentCurve(constructionMonths);
      const constructionStart = phases.construction.start - 1;
      
      for (let i = 0; i < constructionMonths && constructionStart + i < totalMonths; i++) {
        monthly[constructionStart + i] = amount * (curve[i] / 100);
      }
      break;
    }
    
    case 'sales_linked': {
      // Distributed proportionally to sales
      const salesStart = params.salesStartMonth || phases.construction.start + 1;
      const salesEnd = params.salesEndMonth || phases.construction.end;
      const months = Math.max(1, salesEnd - salesStart + 1);
      const monthlyAmount = amount / months;
      
      for (let m = salesStart - 1; m < salesEnd && m < totalMonths; m++) {
        if (m >= 0) monthly[m] = monthlyAmount;
      }
      break;
    }
    
    default: {
      // Fallback: spread evenly across the tagged phase
      let startMonth = 0, endMonth = totalMonths;
      if (item.phaseTag === 'pre_dev') {
        startMonth = phases.preDev.start - 1;
        endMonth = phases.preDev.end;
      } else if (item.phaseTag === 'construction') {
        startMonth = phases.construction.start - 1;
        endMonth = phases.construction.end;
      } else if (item.phaseTag === 'handover') {
        startMonth = phases.handover.start - 1;
        endMonth = phases.handover.end;
      }
      const months = Math.max(1, endMonth - startMonth);
      const monthlyAmount = amount / months;
      for (let m = startMonth; m < endMonth && m < totalMonths; m++) {
        if (m >= 0) monthly[m] = monthlyAmount;
      }
    }
  }
  
  return monthly;
}

// ─── Main Calculation Engine ───

export function calculateDualCashFlow(
  project: ProjectInput,
  costItems: CostItemInput[]
): CashFlowResult {
  // Build timeline
  const phases = buildPhaseTimeline(
    project.preDevMonths,
    project.constructionMonths,
    project.handoverMonths
  );
  const totalMonths = phases.totalMonths;
  
  // Calculate construction cost
  let constructionCost = project.constructionCostTotal || 0;
  if (!constructionCost && project.buaSqft && project.constructionCostPerSqft) {
    constructionCost = project.buaSqft * project.constructionCostPerSqft;
  }
  
  // Funding structure
  const escrowDepositPct = project.escrowDepositPct / 100;
  const contractorAdvancePct = project.contractorAdvancePct / 100;
  const liquidityBufferPct = project.liquidityBufferPct / 100;
  const developerConstructionPct = escrowDepositPct + contractorAdvancePct + liquidityBufferPct;
  
  const escrowDeposit = constructionCost * escrowDepositPct;
  const contractorAdvance = constructionCost * contractorAdvancePct;
  const liquidityBuffer = constructionCost * liquidityBufferPct;
  const totalDeveloperConstruction = escrowDeposit + contractorAdvance + liquidityBuffer;
  const escrowConstruction = constructionCost * (1 - developerConstructionPct);
  
  // Month labels
  const monthLabels = generateMonthLabels(project.startDate, totalMonths);
  
  // Calculate sales inflow
  const salesInflow = calculateSalesInflow(project, phases, totalMonths);
  
  // Distribute each cost item
  const developerMonthly = new Array(totalMonths).fill(0);
  const escrowMonthly = new Array(totalMonths).fill(0);
  const categoryTotals: Record<string, number> = {};
  const developerBreakdowns: Record<string, number[]> = {};
  const escrowBreakdowns: Record<string, number[]> = {};
  
  let totalDeveloperCosts = 0;
  let totalEscrowCosts = 0;
  
  for (const item of costItems) {
    const distribution = distributeCostItem(item, phases, totalMonths);
    
    // Track category
    if (!categoryTotals[item.category]) categoryTotals[item.category] = 0;
    categoryTotals[item.category] += item.totalAmount;
    
    if (item.fundingSource === 'escrow') {
      // Paid from escrow
      for (let m = 0; m < totalMonths; m++) {
        escrowMonthly[m] += distribution[m];
      }
      totalEscrowCosts += item.totalAmount;
      
      if (!escrowBreakdowns[item.name]) escrowBreakdowns[item.name] = new Array(totalMonths).fill(0);
      for (let m = 0; m < totalMonths; m++) {
        escrowBreakdowns[item.name][m] += distribution[m];
      }
    } else if (item.fundingSource === 'mixed') {
      // Split: developer pays the early portion, escrow pays the rest
      // For contractor: developer pays advance (35%), escrow pays rest (65%)
      const devPct = developerConstructionPct;
      const escPct = 1 - devPct;
      
      for (let m = 0; m < totalMonths; m++) {
        // During pre-dev, developer pays
        if (m < phases.construction.start - 1) {
          developerMonthly[m] += distribution[m];
        } else {
          // During construction, escrow pays
          escrowMonthly[m] += distribution[m];
        }
      }
      // For tracking: split total
      totalDeveloperCosts += item.totalAmount * devPct;
      totalEscrowCosts += item.totalAmount * escPct;
    } else {
      // Developer pays
      for (let m = 0; m < totalMonths; m++) {
        developerMonthly[m] += distribution[m];
      }
      totalDeveloperCosts += item.totalAmount;
      
      if (!developerBreakdowns[item.name]) developerBreakdowns[item.name] = new Array(totalMonths).fill(0);
      for (let m = 0; m < totalMonths; m++) {
        developerBreakdowns[item.name][m] += distribution[m];
      }
    }
  }
  
  // Build monthly table
  const monthlyTable: MonthlyRow[] = [];
  let devCum = 0;
  let escrowBalance = 0;
  let cumNet = 0;
  let maxExposure = 0;
  let maxExposureMonth = 0;
  
  for (let m = 0; m < totalMonths; m++) {
    const devOut = developerMonthly[m];
    const escIn = salesInflow[m];
    const escOut = escrowMonthly[m];
    
    devCum += devOut;
    escrowBalance += escIn - escOut;
    
    const totalOut = devOut + escOut;
    const totalIn = escIn;
    const net = totalIn - totalOut;
    cumNet += net;
    
    // Developer exposure = cumulative developer spending
    if (devCum > maxExposure) {
      maxExposure = devCum;
      maxExposureMonth = m + 1;
    }
    
    // Determine phase
    let phase: 'pre_dev' | 'construction' | 'handover' = 'pre_dev';
    if (m + 1 >= phases.construction.start && m + 1 <= phases.construction.end) {
      phase = 'construction';
    } else if (m + 1 >= phases.handover.start) {
      phase = 'handover';
    }
    
    // Build breakdowns for this month
    const devBreak: Record<string, number> = {};
    for (const [name, arr] of Object.entries(developerBreakdowns)) {
      if (arr[m] > 0) devBreak[name] = arr[m];
    }
    const escBreak: Record<string, number> = {};
    for (const [name, arr] of Object.entries(escrowBreakdowns)) {
      if (arr[m] > 0) escBreak[name] = arr[m];
    }
    
    monthlyTable.push({
      month: m + 1,
      label: monthLabels[m],
      phase,
      developerOutflow: Math.round(devOut),
      developerCumulative: Math.round(devCum),
      escrowInflow: Math.round(escIn),
      escrowOutflow: Math.round(escOut),
      escrowBalance: Math.round(escrowBalance),
      totalOutflow: Math.round(totalOut),
      totalInflow: Math.round(totalIn),
      netCashFlow: Math.round(net),
      cumulativeNet: Math.round(cumNet),
      developerBreakdown: devBreak,
      escrowBreakdown: escBreak,
    });
  }
  
  const totalProjectCost = totalDeveloperCosts + totalEscrowCosts;
  const totalSalesRevenue = project.totalSalesRevenue || 0;
  
  return {
    phases,
    totalMonths,
    monthLabels,
    monthlyTable,
    totalProjectCost: Math.round(totalProjectCost),
    totalSalesRevenue: Math.round(totalSalesRevenue),
    constructionCost: Math.round(constructionCost),
    developerEarlyFunding: Math.round(totalDeveloperConstruction),
    escrowConstructionFunding: Math.round(escrowConstruction),
    developerMaxExposure: Math.round(maxExposure),
    developerMaxExposureMonth: maxExposureMonth,
    developerMaxExposureLabel: monthLabels[maxExposureMonth - 1] || '',
    netProfit: Math.round(totalSalesRevenue - totalProjectCost),
    roi: totalProjectCost > 0 ? Math.round(((totalSalesRevenue - totalProjectCost) / totalProjectCost) * 10000) / 100 : 0,
    fundingStructure: {
      escrowDeposit: Math.round(escrowDeposit),
      contractorAdvance: Math.round(contractorAdvance),
      liquidityBuffer: Math.round(liquidityBuffer),
      totalDeveloperConstruction: Math.round(totalDeveloperConstruction),
      escrowConstruction: Math.round(escrowConstruction),
    },
    costByCategory: Object.fromEntries(
      Object.entries(categoryTotals).map(([k, v]) => [k, Math.round(v)])
    ),
    developerCosts: Math.round(totalDeveloperCosts),
    escrowCosts: Math.round(totalEscrowCosts),
  };
}
