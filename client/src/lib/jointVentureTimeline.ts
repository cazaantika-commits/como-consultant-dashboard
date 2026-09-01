export type JointVentureTimeline = {
  designMonths: number;
  materialsStartMonth: number;
  reraStartMonth: number;
  marketingStartMonth: number;
  salesStartMonth: number;
  constructionStartMonth: number;
  projectEndMonth: number;
};

export function deriveJointVentureTimelineFromSavedPlan(input: {
  plan: any;
  fallback: JointVentureTimeline;
  designMonths: number;
  constructionMonths: number;
  marketingPrepMonths: number;
  reraLeadMonths: number;
}): JointVentureTimeline {
  const { plan, fallback } = input;
  if (!plan) return fallback;

  let absorption: any = {};
  let results: any = {};
  try { absorption = JSON.parse(plan.salesAbsorptionJson || "{}"); } catch {}
  try { results = JSON.parse(plan.resultsJson || "{}"); } catch {}

  const escrowSaleRow = Array.isArray(results.escrowData)
    ? results.escrowData.find((row: any) => Number(row?.units) > 0)
    : undefined;
  const firstReceiptIndex = Array.isArray(results.actualEscrowCashInflow)
    ? results.actualEscrowCashInflow.findIndex((value: unknown) => Number(value) > 0)
    : -1;
  const designMonths = Math.max(0, Number(input.designMonths) || 0);
  const constructionStartMonth = designMonths + 1;
  const projectEndMonth = designMonths + Math.max(0, Number(input.constructionMonths) || 0);
  const salesStartMonth = Math.max(
    1,
    Number(escrowSaleRow?.month) || (firstReceiptIndex >= 0 ? firstReceiptIndex + 1 : constructionStartMonth),
  );
  const marketingStartMonth = Math.max(
    1,
    Number(absorption.marketingActualStart) || salesStartMonth,
  );

  return {
    ...fallback,
    designMonths,
    materialsStartMonth: Math.max(1, marketingStartMonth - Math.max(0, input.marketingPrepMonths)),
    reraStartMonth: Math.max(1, salesStartMonth - Math.max(0, input.reraLeadMonths)),
    marketingStartMonth,
    salesStartMonth,
    constructionStartMonth,
    projectEndMonth,
  };
}
