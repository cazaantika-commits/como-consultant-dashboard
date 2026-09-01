export interface DesignPaymentStage {
  id: string;
  label: string;
  labelEn: string;
  pct: number;
  durationWeeks: number;
}

/** The only default definition for the seven design stages. */
export const DEFAULT_DESIGN_PAYMENT_STAGES: DesignPaymentStage[] = [
  { id: "mobilization", label: "التعبئة وجمع البيانات", labelEn: "Mobilization & Data Collection", pct: 5, durationWeeks: 2 },
  { id: "concept", label: "التصميم المبدئي", labelEn: "Concept Design", pct: 15, durationWeeks: 4 },
  { id: "schematic", label: "التصميم التخطيطي", labelEn: "Schematic Design", pct: 20, durationWeeks: 4 },
  { id: "dd", label: "تطوير التصميم التفصيلي", labelEn: "Detailed Design Development", pct: 25, durationWeeks: 6 },
  { id: "authorities", label: "اعتماد الجهات", labelEn: "Authorities Approval", pct: 10, durationWeeks: 4 },
  { id: "tender", label: "تأهيل المقاولين ووثائق المناقصة", labelEn: "Prequalification & Tender Documents", pct: 15, durationWeeks: 4 },
  { id: "ifc", label: "صادر للتنفيذ", labelEn: "Issued for Construction", pct: 10, durationWeeks: 2 },
];

function readSavedStages(project: any): DesignPaymentStage[] {
  let saved: Record<string, Partial<DesignPaymentStage>> | undefined;
  try {
    saved = JSON.parse(project?.constructionScheduleJson || "{}")?.settings?.designPayments;
  } catch {
    saved = undefined;
  }

  return DEFAULT_DESIGN_PAYMENT_STAGES.map((stage) => {
    const override = saved?.[stage.id];
    return {
      ...stage,
      durationWeeks: Math.max(1, Number(override?.durationWeeks ?? stage.durationWeeks)),
      pct: Number(override?.pct ?? stage.pct),
    };
  });
}

type SavedPhaseTiming = {
  durationMonths?: number;
  startOffsetMonths?: number;
};

const DEFAULT_PHASE_TIMING: Record<string, Required<SavedPhaseTiming>> = {
  marketingPrep: { durationMonths: 2, startOffsetMonths: 0 },
  reraApprovals: { durationMonths: 2, startOffsetMonths: 1 },
  marketingLaunch: { durationMonths: 0, startOffsetMonths: 0 },
  salesStart: { durationMonths: 0, startOffsetMonths: 1 },
  construction: { durationMonths: 0, startOffsetMonths: 1 },
};

function readSavedPhaseTiming(project: any, phaseId: string): Required<SavedPhaseTiming> {
  let saved: SavedPhaseTiming | undefined;
  try {
    saved = JSON.parse(project?.constructionScheduleJson || "{}")?.settings?.projectPhases?.[phaseId];
  } catch {
    saved = undefined;
  }
  const fallback = DEFAULT_PHASE_TIMING[phaseId];
  return {
    durationMonths: Math.max(0, Number(saved?.durationMonths ?? fallback.durationMonths)),
    startOffsetMonths: Math.max(0, Number(saved?.startOffsetMonths ?? fallback.startOffsetMonths)),
  };
}

/**
 * Returns the design schedule saved in Settings and Rules. Design duration is
 * deliberately derived here rather than read from the legacy preConMonths field.
 */
export function getProjectDesignTiming(project: any) {
  const stages = readSavedStages(project);
  const totalWeeks = stages.reduce((sum, stage) => sum + stage.durationWeeks, 0);
  return {
    stages,
    totalWeeks,
    designMonths: Math.max(1, Math.ceil(totalWeeks / 4.33)),
    schematicCompletionMonth: Math.max(1, Math.ceil(stages.slice(0, 3).reduce((sum, stage) => sum + stage.durationWeeks, 0) / 4.33)),
  };
}

/**
 * Returns all project-relative timing rules from the saved Settings and Rules
 * phases. General Inputs supplies only the project start date and construction duration.
 */
export function getProjectMarketingTiming(project: any) {
  const designTiming = getProjectDesignTiming(project);
  const marketingPrep = readSavedPhaseTiming(project, "marketingPrep");
  const reraApprovals = readSavedPhaseTiming(project, "reraApprovals");
  const marketingLaunch = readSavedPhaseTiming(project, "marketingLaunch");
  const salesStart = readSavedPhaseTiming(project, "salesStart");
  const construction = readSavedPhaseTiming(project, "construction");
  const constructionMonths = Math.max(1, Number(project?.constructionMonths ?? 30));
  const materialsStartMonth = designTiming.schematicCompletionMonth + 1 + marketingPrep.startOffsetMonths;
  const materialsEndMonth = materialsStartMonth + marketingPrep.durationMonths - 1;
  const marketingStartMonth = materialsEndMonth + 1 + marketingLaunch.startOffsetMonths;
  const reraStartMonth = designTiming.schematicCompletionMonth + 1 + reraApprovals.startOffsetMonths;
  const reraEndMonth = reraStartMonth + reraApprovals.durationMonths - 1;
  const salesStartMonth = reraEndMonth + 1 + salesStart.startOffsetMonths;
  const constructionStartMonth = designTiming.designMonths + construction.startOffsetMonths;
  const projectEndMonth = constructionStartMonth + constructionMonths - 1;

  return {
    ...designTiming,
    marketingPrepMonths: marketingPrep.durationMonths,
    reraApprovalMonths: reraApprovals.durationMonths,
    reraPaymentMonth: reraEndMonth,
    materialsStartMonth,
    materialsEndMonth,
    marketingStartMonth,
    reraStartMonth,
    reraEndMonth,
    salesStartMonth,
    constructionStartMonth,
    projectEndMonth,
  };
}

/**
 * The construction canvas stores each month's incremental completion share in
 * constructionScheduleJson.monthlyProgress. Convert that approved plan into
 * cumulative milestones with true project months for buyer-payment timing.
 */
export function getConstructionProgressMilestones(project: any) {
  let monthlyProgress: number[] = [];
  try {
    const parsed = JSON.parse(project?.constructionScheduleJson || "{}");
    monthlyProgress = Array.isArray(parsed?.monthlyProgress)
      ? parsed.monthlyProgress.map((value: unknown) => Math.max(0, Number(value) || 0))
      : [];
  } catch {
    monthlyProgress = [];
  }
  const timing = getProjectMarketingTiming(project);
  let cumulative = 0;
  return monthlyProgress
    .map((increment, index) => {
      cumulative = Math.min(100, cumulative + increment);
      return { month: timing.constructionStartMonth + index, progressPct: Math.round(cumulative * 100) / 100 };
    })
    .filter((item) => item.progressPct > 0);
}

/**
 * RERA auditor and inspection reports are paid once every three construction
 * months. Their per-payment rates are saved in Settings and Rules, making the
 * same total available to Feasibility Study and Escrow Cash Flow.
 */
export function getProjectReraQuarterlyFeeSettings(project: any) {
  const isJointVenture = project?.financingScenario === "joint_venture_land_for_units";
  let savedRates: Record<string, unknown> | undefined;
  try {
    savedRates = JSON.parse(project?.constructionScheduleJson || "{}")?.settings?.configurableRates;
  } catch {
    savedRates = undefined;
  }
  const constructionMonths = isJointVenture
    ? Math.max(0, Number(project?.constructionMonths ?? 0))
    : Math.max(1, Number(project?.constructionMonths ?? 30));
  const paymentCount = constructionMonths > 0 ? Math.ceil(constructionMonths / 3) : 0;
  const auditorPerPayment = Math.max(0, Number(savedRates?.reraAuditorQuarterlyFee ?? 3500));
  const inspectionPerPayment = Math.max(0, Number(savedRates?.reraInspectionQuarterlyFee ?? 15020));

  return {
    constructionMonths,
    paymentCount,
    auditorPerPayment,
    inspectionPerPayment,
    auditorTotal: auditorPerPayment * paymentCount,
    inspectionTotal: inspectionPerPayment * paymentCount,
  };
}

/** Drops any saved Marketing-page values that precede the permitted start. */
export function clampMarketingDistributionToStart(
  distribution: Record<string, number[]> | undefined,
  savedStartMonth: number,
  minimumStartMonth: number,
): Record<string, number[]> {
  const offset = Math.max(0, minimumStartMonth - savedStartMonth);
  return Object.fromEntries(
    Object.entries(distribution ?? {}).map(([channel, values]) => [channel, (values ?? []).slice(offset)])
  );
}

export type TimelineActivityWindow = {
  startMonth: number;
  endMonth: number;
  hasSavedActivity: boolean;
};

/**
 * Returns the Marketing-page activity window without allowing it to precede the
 * Settings-derived launch month or extend beyond the project horizon.
 */
export function getMarketingTimelineWindow({
  settingsStartMonth,
  projectEndMonth,
  savedStartMonth,
  savedEndMonth,
}: {
  settingsStartMonth: number;
  projectEndMonth: number;
  savedStartMonth?: number;
  savedEndMonth?: number;
}): TimelineActivityWindow {
  const hasSavedActivity = Number.isFinite(savedStartMonth) || Number.isFinite(savedEndMonth);
  const startMonth = Math.min(
    projectEndMonth,
    Math.max(settingsStartMonth, Number(savedStartMonth) || settingsStartMonth),
  );
  const endMonth = Math.min(
    projectEndMonth,
    Math.max(startMonth, Number(savedEndMonth) || projectEndMonth),
  );
  return { startMonth, endMonth, hasSavedActivity };
}

/**
 * Converts the saved Sales Plan distribution into the true project-month window.
 * Distribution index zero is the Settings-derived sales-start month.
 */
export function getSalesTimelineWindow({
  settingsStartMonth,
  projectEndMonth,
  salesDistribution,
}: {
  settingsStartMonth: number;
  projectEndMonth: number;
  salesDistribution?: number[];
}): TimelineActivityWindow {
  const activeIndexes = (salesDistribution ?? [])
    .map((amount, index) => ({ amount: Number(amount) || 0, index }))
    .filter(({ amount }) => amount > 0)
    .map(({ index }) => index);

  if (activeIndexes.length === 0) {
    return { startMonth: settingsStartMonth, endMonth: projectEndMonth, hasSavedActivity: false };
  }

  const startMonth = Math.min(projectEndMonth, Math.max(settingsStartMonth, settingsStartMonth + activeIndexes[0]));
  const endMonth = Math.min(projectEndMonth, Math.max(startMonth, settingsStartMonth + activeIndexes[activeIndexes.length - 1]));
  return { startMonth, endMonth, hasSavedActivity: true };
}

/**
 * Build-for-sale unit allocations are saved relative to the first direct-sale
 * month after completion. Convert their positive indexes into true project
 * months without applying Off-Plan sales-start rules.
 */
export function getBuildForSaleSalesTimelineWindow({
  projectEndMonth,
  directSalesUnits,
}: {
  projectEndMonth: number;
  directSalesUnits?: number[];
}): TimelineActivityWindow {
  const activeIndexes = (directSalesUnits ?? [])
    .map((amount, index) => ({ amount: Number(amount) || 0, index }))
    .filter(({ amount }) => amount > 0)
    .map(({ index }) => index);

  if (activeIndexes.length === 0) {
    return { startMonth: projectEndMonth + 1, endMonth: projectEndMonth + 1, hasSavedActivity: false };
  }

  return {
    startMonth: projectEndMonth + activeIndexes[0] + 1,
    endMonth: projectEndMonth + activeIndexes[activeIndexes.length - 1] + 1,
    hasSavedActivity: true,
  };
}
