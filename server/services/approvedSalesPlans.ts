export type SalesPlanApprovalRecord = {
  id?: number | null;
  projectId: number;
  status?: string | null;
  updatedAt?: Date | string | number | null;
};

function salesPlanTimestamp(value: SalesPlanApprovalRecord["updatedAt"]): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

/**
 * Official financial reports may read approved sales plans only. A newer draft
 * remains editable in Wael's workspace, but it never replaces the approved
 * source until the explicit workspace approval action is completed.
 */
export function selectLatestApprovedSalesPlan<T extends SalesPlanApprovalRecord>(plans: readonly T[]): T | null {
  return plans
    .filter((plan) => plan.status === "approved")
    .slice()
    .sort((left, right) => {
      const timestampDifference = salesPlanTimestamp(right.updatedAt) - salesPlanTimestamp(left.updatedAt);
      if (timestampDifference !== 0) return timestampDifference;
      return Number(right.id || 0) - Number(left.id || 0);
    })[0] ?? null;
}

export function buildApprovedSalesPlanMap<T extends SalesPlanApprovalRecord>(plans: readonly T[]): Map<number, T> {
  const approvedByProject = new Map<number, T>();
  for (const plan of plans) {
    if (plan.status !== "approved") continue;
    const current = approvedByProject.get(plan.projectId);
    if (!current || selectLatestApprovedSalesPlan([current, plan]) === plan) {
      approvedByProject.set(plan.projectId, plan);
    }
  }
  return approvedByProject;
}

export function financialReportsRequireApprovedSalesPlan(scenario?: string | null): boolean {
  return scenario !== "build_for_rent";
}
