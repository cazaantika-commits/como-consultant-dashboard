/** Canonical Majan orchestration: development base, operations and finance overlay. */
import type {
  AnnualResult,
  FinanceMonth,
  LeasingMonth,
  MajanBaseline,
  MajanInputs,
  MajanModelResult,
  ModelCheck,
  ModelIssue,
} from "./majanFinanceTypes";
import { addMajanMonths, calculateMajanDevelopment, isMajanMonth } from "./majanDevelopment";
import { calculateMajanLeasing } from "./majanLeasing";
import { calculateMajanFinance } from "./majanFinancing";
import { MAJAN_COLLIERS_FLOOR_GLA, MAJAN_GFA_SQFT } from "./majanAreaConstants";

const HORIZON_MAX_MONTHS = 360;
const TOLERANCE = 0.01;

function modelIssue(
  code: string,
  severity: ModelIssue["severity"],
  field: string,
  messageEn: string,
  messageAr: string,
): ModelIssue {
  return { code, severity, field, messageEn, messageAr };
}

function monthSerial(value: string): number {
  const [year, month] = value.split("-").map(Number);
  return year * 12 + month - 1;
}

/**
 * First calendar year with a full year of stabilised, lag-adjusted collections.
 * A January effective month may use its own year; an effective month from
 * February to December moves to the following calendar year.  This is a
 * reporting selection for an Indicative scenario, not a lease assertion.
 */
export function getMajanStabilisedYear(inputs: MajanInputs): string | null {
  const leasedRows = inputs.leasing.filter(row => row.treatment === "leased");
  if (leasedRows.length === 0) return null;
  let latestEffectiveMonth: string | null = null;
  for (const row of leasedRows) {
    if (!isMajanMonth(row.openingMonth) || !Number.isInteger(row.rampMonths) || row.rampMonths < 0 || !Number.isInteger(row.collectionLagMonths) || row.collectionLagMonths < 0) return null;
    const effectiveMonth = addMajanMonths(row.openingMonth, row.rampMonths + row.collectionLagMonths);
    if (latestEffectiveMonth === null || effectiveMonth > latestEffectiveMonth) latestEffectiveMonth = effectiveMonth;
  }
  if (latestEffectiveMonth === null) return null;
  const [year, month] = latestEffectiveMonth.split("-").map(Number);
  return String(month === 1 ? year : year + 1);
}

/**
 * Returns an inclusive, consecutive monthly time axis. It uses only YYYY-MM
 * arithmetic (no locale/time-zone Date conversion) and caps a model run at 360
 * months for controlled indicative planning performance.
 */
export function getMajanPeriods(startMonth: string, endMonth: string): string[] {
  if (!isMajanMonth(startMonth) || !isMajanMonth(endMonth)) {
    throw new RangeError("Majan model periods must use YYYY-MM.");
  }
  const count = monthSerial(endMonth) - monthSerial(startMonth) + 1;
  if (count < 1) throw new RangeError("Majan model horizon cannot end before it starts.");
  if (count > HORIZON_MAX_MONTHS) throw new RangeError("Majan model horizon may not exceed 360 months.");
  return Array.from({ length: count }, (_, index) => addMajanMonths(startMonth, index));
}

/** Stable, browser-safe canonical serialisation used before hashing scenario inputs. */
export function stableMajanStringify(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : `"${String(value)}"`;
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableMajanStringify).join(",")}]`;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${stableMajanStringify(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(String(value));
}

/**
 * Portable 64-character non-cryptographic digest for client/server identity.
 * Persistence may replace it with a backend SHA-256 if required; this output is
 * intentionally deterministic across browsers and does not depend on Node crypto.
 */
export function stableMajanHash(value: unknown): string {
  const text = stableMajanStringify(value);
  const seeds = [0x811c9dc5, 0x9e3779b9, 0x85ebca6b, 0xc2b2ae35, 0x27d4eb2f, 0x165667b1, 0xd3a2646c, 0xfd7046c5];
  const words = seeds.map(seed => {
    let hash = seed >>> 0;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193) >>> 0;
      hash ^= hash >>> 13;
      hash = Math.imul(hash, 0x5bd1e995) >>> 0;
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  });
  return words.join("");
}

function numberOrNull(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function sumNullable(values: Array<number | null | undefined>): number | null {
  let total = 0;
  for (const value of values) {
    if (numberOrNull(value) === null) return null;
    total += value as number;
  }
  return total;
}

function check(code: string, passed: boolean | null, messageEn: string, messageAr: string, difference?: number): ModelCheck {
  return {
    code,
    status: passed === null ? "not_calculable" : passed ? "pass" : "fail",
    messageEn,
    messageAr,
    ...(difference === undefined ? {} : { difference }),
  };
}

function byPeriod<T extends { period: string }>(rows: T[]): Map<string, T> {
  return new Map(rows.map(row => [row.period, row]));
}

function annualAggregate(
  periods: string[],
  developmentUses: Map<string, number>,
  leasingRows: LeasingMonth[],
  financeRows: FinanceMonth[],
): AnnualResult[] {
  const leasing = byPeriod(leasingRows);
  const financing = byPeriod(financeRows);
  const years = Array.from(new Set(periods.map(period => period.slice(0, 4))));
  return years.map(year => {
    const yearPeriods = periods.filter(period => period.startsWith(`${year}-`));
    const leaseMonths = yearPeriods.map(period => leasing.get(period));
    const financeMonths = yearPeriods.map(period => financing.get(period));
    const cfads = sumNullable(leaseMonths.map(month => month?.cfads));
    const debtService = sumNullable(financeMonths.map(month => month?.totalPayment));
    return {
      year,
      developmentUses: yearPeriods.reduce((total, period) => total + (developmentUses.get(period) ?? 0), 0),
      billedRent: sumNullable(leaseMonths.map(month => month?.billedRent)),
      collectedRent: sumNullable(leaseMonths.map(month => month?.collectedRent)),
      opex: sumNullable(leaseMonths.map(month => month?.opex)),
      recoveries: sumNullable(leaseMonths.map(month => month?.serviceChargeCollected)),
      cashNoi: sumNullable(leaseMonths.map(month => month?.cashNoi)),
      cfads,
      draw: sumNullable(financeMonths.map(month => month?.draw)),
      profit: sumNullable(financeMonths.map(month => {
        if (!month) return null;
        return (month.profitCapitalised ?? 0) + (month.profitPaid ?? 0);
      })),
      capital: sumNullable(financeMonths.map(month => month?.capitalPaid)),
      debtService,
      closingBalance: financeMonths.at(-1)?.closingBalance ?? null,
      dscr: cfads === null || debtService === null || debtService <= TOLERANCE ? null : cfads / debtService,
      ownerContribution: sumNullable(financeMonths.map(month => month?.ownerContribution)),
      ownerDistribution: sumNullable(financeMonths.map(month => month?.ownerDistribution)),
    };
  });
}

function calculateChecks(
  inputs: MajanInputs,
  result: Pick<MajanModelResult, "development" | "leasing" | "financing" | "annual">,
): ModelCheck[] {
  const checks: ModelCheck[] = [];
  const developmentScheduled = result.development.uses.reduce((total, value) => total + value, 0);
  const developmentDifference = result.development.totalCost - result.development.taggedPaid - developmentScheduled;
  checks.push(check(
    "development_cash_reconciliation",
    Math.abs(developmentDifference) <= TOLERANCE,
    "Development total reconciles to tagged-paid label plus scheduled uses (labels are not payment evidence).",
    "يتطابق إجمالي التطوير مع وسم المدفوع زائد الاستخدامات المجدولة (والوسوم ليست دليل دفع).",
    developmentDifference,
  ));

  const arCalculable = result.leasing.months.every(month => month.openingAr !== null && month.billedRent !== null && month.badDebt !== null && month.collectedRent !== null && month.closingAr !== null);
  const arDifference = arCalculable
    ? Math.max(...result.leasing.months.map(month => Math.abs((month.openingAr ?? 0) + (month.billedRent ?? 0) - (month.badDebt ?? 0) - (month.collectedRent ?? 0) - (month.closingAr ?? 0))))
    : undefined;
  checks.push(check(
    "ar_rollforward",
    arCalculable ? (arDifference ?? 0) <= TOLERANCE : null,
    "Receivables reconcile: opening AR + billings − bad debt − collections = closing AR.",
    "تتطابق الذمم المدينة: رصيد أول المدة + الفواتير − الديون المعدومة − التحصيلات = رصيد آخر المدة.",
    arDifference,
  ));

  let openingRestrictedCash: number | null = 0;
  let restrictedCashDifference: number | undefined;
  for (const month of result.leasing.months) {
    if (openingRestrictedCash === null || month.reserveDeposit === null || month.restrictedCash === null) {
      openingRestrictedCash = null;
      restrictedCashDifference = undefined;
      break;
    }
    const difference = Math.abs(openingRestrictedCash + month.reserveDeposit - month.reserveRelease - month.restrictedCash);
    restrictedCashDifference = Math.max(restrictedCashDifference ?? 0, difference);
    openingRestrictedCash = month.restrictedCash;
  }
  checks.push(check(
    "restricted_cash_rollforward",
    openingRestrictedCash === null ? null : (restrictedCashDifference ?? 0) <= TOLERANCE,
    "Restricted cash reconciles: opening restricted cash + deposit − release = closing restricted cash; it is separate from OPEX.",
    "يتطابق النقد المقيد: رصيد أول المدة + الإيداع − الإفراج = رصيد آخر المدة؛ وهو منفصل عن المصروفات التشغيلية.",
    restrictedCashDifference,
  ));

  const debtCalculable = result.financing.months.every(month => month.openingBalance !== null && month.draw !== null && month.profitCapitalised !== null && month.capitalPaid !== null && month.closingBalance !== null);
  const debtDifference = debtCalculable
    ? Math.max(...result.financing.months.map(month => Math.abs((month.openingBalance ?? 0) + (month.draw ?? 0) + (month.profitCapitalised ?? 0) - (month.capitalPaid ?? 0) - (month.closingBalance ?? 0))))
    : undefined;
  checks.push(check(
    "economic_finance_rollforward",
    debtCalculable ? (debtDifference ?? 0) <= TOLERANCE : null,
    "Economic finance balance reconciles; it is not a determination of legal exposure.",
    "يتطابق الرصيد الاقتصادي للتمويل؛ وليس تحديداً للتعرض القانوني.",
    debtDifference,
 ));

  const floorExcess = Object.entries(MAJAN_COLLIERS_FLOOR_GLA)
    .map(([floor, area]) => Math.max(0, (result.leasing.floorGla[floor] ?? 0) - area));
  const maxFloorExcess = Math.max(...floorExcess, 0);
  checks.push(check(
    "gla_floor_reference",
    maxFloorExcess <= TOLERANCE,
    "Each floor GLA is within the editable Colliers concept-area reference; it is not a final approved plan.",
    "مساحة كل طابق ضمن مرجع المساحة المفاهيمي القابل للتعديل من كوليرز؛ وليست مخططاً نهائياً معتمداً.",
    maxFloorExcess,
  ));
  const gfaDifference = result.leasing.totalGla - MAJAN_GFA_SQFT;
  checks.push(check(
    "gla_within_recorded_gfa",
    gfaDifference <= TOLERANCE,
    "Total planned GLA does not exceed the recorded GFA ceiling. GLA and GFA remain different definitions and are not mapped arithmetically.",
    "إجمالي المساحة القابلة للتأجير المخططة لا يتجاوز سقف المساحة الإجمالية المسجل. وتبقى GLA وGFA تعريفين مختلفين ولا تتم مواءمتهما حسابياً.",
    Math.max(0, gfaDifference),
  ));

  const financeNone = !inputs.finance.enabled;
  const noFinanceDifference = financeNone
    ? Math.max(...result.financing.months.map(month => Math.max(
      Math.abs(month.draw ?? Number.NaN),
      Math.abs((month.fundedNet ?? Number.NaN) - (month.unleveredNet ?? Number.NaN)),
    )), 0)
    : undefined;
  checks.push(check(
    "no_finance_overlay_equality",
    financeNone ? (Number.isFinite(noFinanceDifference) && noFinanceDifference! <= TOLERANCE) : null,
    "No-finance case has no facility draw, and funded net cash exactly equals unlevered net cash while retaining the base development schedule.",
    "حالة عدم التمويل لا تحتوي على سحب تسهيلات، ويتطابق صافي النقد الممول تماماً مع صافي النقد غير الممول مع الحفاظ على جدول التطوير الأساسي.",
    noFinanceDifference,
  ));

  const sourceUseCalculable = result.financing.months.every(month => month.fundedNet !== null && month.unleveredNet !== null && month.draw !== null && month.totalPayment !== null && month.fee !== null && month.dsraDeposit !== null && month.dsraRelease !== null);
  const sourceUseDifference = sourceUseCalculable
    ? Math.max(...result.financing.months.map(month => Math.abs(
      (month.fundedNet ?? 0)
      - ((month.unleveredNet ?? 0) - (month.totalPayment ?? 0) - (month.fee ?? 0) - (month.dsraDeposit ?? 0) + (month.dsraRelease ?? 0) + (month.draw ?? 0)),
    )))
    : undefined;
  checks.push(check(
    "finance_sources_uses_cash_identity",
    sourceUseCalculable ? (sourceUseDifference ?? 0) <= TOLERANCE : null,
    "Finance sources-and-uses cash identity reconciles: funded net cash equals unlevered net cash less facility cash uses plus draw.",
    "تتطابق هوية مصادر واستخدامات النقد للتمويل: صافي النقد الممول يساوي صافي النقد غير الممول ناقص الاستخدامات النقدية للتسهيل زائد السحب.",
    sourceUseDifference,
  ));

  const annualDscrCalculable = result.annual.filter(row => row.dscr !== null);
  checks.push(check(
    "annual_dscr_same_period_ratio",
    annualDscrCalculable.length > 0 ? annualDscrCalculable.every(row => {
      if (row.cfads === null || row.debtService === null || row.debtService <= TOLERANCE || row.dscr === null) return false;
      return Math.abs(row.dscr - row.cfads / row.debtService) <= TOLERANCE;
    }) : null,
    "Annual DSCR is the same-period annual CFADS sum divided by annual debt-service sum, not an average of monthly ratios.",
    "نسبة تغطية خدمة الدين السنوية هي مجموع النقد السنوي المتاح لنفس الفترة مقسوماً على مجموع خدمة الدين السنوية، وليست متوسط النسب الشهرية.",
  ));
  return checks;
}

function cloneInputs(inputs: MajanInputs): MajanInputs {
  return JSON.parse(JSON.stringify(inputs)) as MajanInputs;
}

function scenarioOutput(
  inputs: MajanInputs,
  development: MajanModelResult["development"],
  periods: string[],
  nameEn: string,
  nameAr: string,
  rentChangePct: number,
  occupancyChangePp: number,
): MajanModelResult["sensitivity"][number] {
  const scenario = cloneInputs(inputs);
  scenario.leasing = scenario.leasing.map(row => ({
    ...row,
    annualRentPsf: row.annualRentPsf === null ? null : row.annualRentPsf * (1 + rentChangePct / 100),
    initialOccupancyPct: Math.max(0, Math.min(100, row.initialOccupancyPct + occupancyChangePp)),
    stabilisedOccupancyPct: Math.max(0, Math.min(100, row.stabilisedOccupancyPct + occupancyChangePp)),
  }));
  const leasing = calculateMajanLeasing(scenario, periods);
  const financing = calculateMajanFinance(scenario, development, leasing);
  const annual = annualAggregate(periods, new Map(development.periods.map((period, index) => [period, development.uses[index] ?? 0])), leasing.months, financing.months);
  const stabilisedYear = getMajanStabilisedYear(scenario);
  const stabilisedAnnual = stabilisedYear === null ? undefined : annual.find(row => row.year === stabilisedYear);
  const debtServiceYears = annual.filter(row => row.dscr !== null);
  const minimumAnnualDscr = debtServiceYears.length === 0
    ? null
    : Math.min(...debtServiceYears.map(row => row.dscr as number));
  return {
    nameEn: `${nameEn}; CFADS: stabilised ${stabilisedYear ?? "not calculable"}; DSCR: minimum debt-service year`,
    nameAr: `${nameAr}؛ النقد المتاح لخدمة الدين: سنة الاستقرار ${stabilisedYear ?? "غير قابلة للحساب"}؛ نسبة التغطية: أدنى سنة لخدمة الدين`,
    rentChangePct,
    occupancyChangePp,
    annualCfads: stabilisedAnnual?.cfads ?? null,
    annualDscr: minimumAnnualDscr,
  };
}

/**
 * Runs the one monthly, scenario-controlled Majan model. Calculations are
 * always returned when their explicit inputs are complete: no bank-approval
 * gate is used. Missing inputs remain null only in dependent metrics.
 */
export function calculateMajanModel(inputs: MajanInputs, baseline: MajanBaseline): MajanModelResult {
  const development = calculateMajanDevelopment(inputs, baseline);
  const issues: ModelIssue[] = [];
  issues.push(modelIssue(
    "TECHNICAL_BUA_RECONCILIATION_PENDING",
    "warning",
    "development.buaSqft",
    "The editable application BUA is a planning cost basis, not a verified quantity. Khatib & Alami Technical Proposal pp.97–98 gives a provisional unique-area sum of 880,777.64 sqft, versus inconsistent summary totals of 987,790.28 and 988,405.98 sqft. No technical value is substituted silently; reconciliation is pending.",
    "مساحة البناء القابلة للتعديل أساس تكلفة تخطيطي وليست كمية مثبتة. مجموع المساحات الفريدة الأولي في عرض خطيب وعلمي (ص97–98) هو 880,777.64 قدم²، مقابل إجماليين متعارضين 987,790.28 و988,405.98 قدم². لم تستبدل مساحة المالك بصمت؛ المصالحة الفنية ما زالت مطلوبة.",
  ));
  let periods: string[];
  const startMonth = development.periods[0] ?? baseline.startMonth;
  try {
    periods = getMajanPeriods(startMonth, inputs.horizonMonth);
  } catch (error) {
    issues.push(modelIssue(
      "invalid_model_horizon",
      "error",
      "horizonMonth",
      `${error instanceof Error ? error.message : "Invalid model horizon"} The recorded development periods were used as a safe fallback.`,
      `أفق النموذج غير صالح. تم استخدام فترات التطوير المسجلة كبديل آمن.`,
    ));
    periods = [...development.periods];
  }
  const finalDevelopmentPeriod = development.periods.at(-1);
  if (finalDevelopmentPeriod && periods.at(-1)! < finalDevelopmentPeriod) {
    issues.push(modelIssue(
      "horizon_before_development_complete",
      "error",
      "horizonMonth",
      "The selected horizon ends before the edited development schedule; dependent reporting is incomplete.",
      "ينتهي الأفق المحدد قبل اكتمال جدول التطوير المعدل؛ والتقارير التابعة غير مكتملة.",
    ));
  }
  const leasing = calculateMajanLeasing(inputs, periods);
  const financing = calculateMajanFinance(inputs, development, leasing);
  const developmentUses = new Map(development.periods.map((period, index) => [period, development.uses[index] ?? 0]));
  const annual = annualAggregate(periods, developmentUses, leasing.months, financing.months);

  const output: MajanModelResult = {
    version: "majan-canonical-monthly-v1",
    inputHash: stableMajanHash({ inputs, baseline: { id: baseline.id, sourceHash: baseline.sourceHash } }),
    generatedAt: new Date().toISOString(),
    development,
    leasing,
    financing,
    annual,
    issues: [],
    checks: [],
    sensitivity: [],
  };
  output.checks = calculateChecks(inputs, output);
  output.sensitivity = [
    scenarioOutput(inputs, development, periods, "Downside: rent −10%, occupancy −10pp", "سيناريو هابط: الإيجار −10٪ والإشغال −10 نقاط مئوية", -10, -10),
    scenarioOutput(inputs, development, periods, "Base: current explicit assumptions", "الأساس: الافتراضات الصريحة الحالية", 0, 0),
    scenarioOutput(inputs, development, periods, "Upside: rent +10%, occupancy +10pp", "سيناريو صاعد: الإيجار +10٪ والإشغال +10 نقاط مئوية", 10, 10),
  ];
  output.issues = [...issues, ...development.issues, ...leasing.issues, ...financing.issues];
  return output;
}
