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
 * Returns the approved project timing rules that constrain Marketing-page
 * allocations. Marketing starts immediately after the marketing-material
 * preparation period, which starts one month after schematic completion.
 */
export function getProjectMarketingTiming(project: any) {
  const designTiming = getProjectDesignTiming(project);
  const marketingPrepMonths = Math.max(1, Number(project?.marketingPrepMonths ?? 2));
  const reraLeadMonths = Math.max(1, Number(project?.reraLeadMonths ?? 2));
  const constructionMonths = Math.max(1, Number(project?.constructionMonths ?? 30));
  const materialsStartMonth = designTiming.schematicCompletionMonth + 1;
  const marketingStartMonth = materialsStartMonth + marketingPrepMonths;
  const reraStartMonth = designTiming.schematicCompletionMonth + 2;
  const salesStartMonth = reraStartMonth + reraLeadMonths + 1;
  const constructionStartMonth = designTiming.designMonths + 1;
  const projectEndMonth = constructionStartMonth + constructionMonths - 1;

  return {
    ...designTiming,
    marketingPrepMonths,
    reraLeadMonths,
    materialsStartMonth,
    marketingStartMonth,
    reraStartMonth,
    salesStartMonth,
    constructionStartMonth,
    projectEndMonth,
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
