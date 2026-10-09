import type {
  LeasingMonth,
  LeasingResult,
  MajanInputs,
  ModelIssue,
  OpexRow,
  LeasingRow,
} from "./majanFinanceTypes";

/**
 * Majan operating engine.  This is deliberately a cash-collections route:
 * receivables are rolled once from billings to collections and are not then
 * added to or deducted from CFADS a second time.
 *
 * All money values are AED and all rents are annual AED/sqft unless noted.
 * The engine produces Draft/Indicative calculations only; it does not create
 * a rent roll, tax calculation, approval, or contractual financing terms.
 */

const MAX_MONTHS = 360;
const GFA_LIMIT = 493_894.71;
const FLOOR_REFERENCE_GLA: Record<LeasingRow["floor"], number> = {
  G: 86_111,
  L1: 80_729,
  L2: 59_201,
  L3: 53_820,
  L4: 45_208,
};
const FLOORS: LeasingRow["floor"][] = ["G", "L1", "L2", "L3", "L4"];

type ParsedMonth = { year: number; month: number; serial: number };

type RowMonth = {
  potential: number;
  billed: number;
  badDebt: number;
  collectionMonth: number;
  collectionAmount: number;
  occupiedLeasedArea: number;
};

type OpexMonth = {
  gross: number;
  recoveryBilled: number;
  recoveryCollected: number;
};

function parseMonth(value: string): ParsedMonth | null {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  return { year, month, serial: year * 12 + month - 1 };
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function nonNegative(value: unknown): value is number {
  return finiteNumber(value) && value >= 0;
}

function percentage(value: unknown): value is number {
  return nonNegative(value) && value <= 100;
}

function wholeNonNegative(value: unknown): value is number {
  return nonNegative(value) && Number.isInteger(value);
}

function knownFloor(value: unknown): value is LeasingRow["floor"] {
  return (
    typeof value === "string" && FLOORS.includes(value as LeasingRow["floor"])
  );
}

function issue(
  issues: ModelIssue[],
  code: string,
  severity: ModelIssue["severity"],
  field: string,
  messageEn: string,
  messageAr: string
): void {
  // A repeated issue per month makes reports unreadable. Inputs are validated
  // once, while calculation-dependent nulls are represented in the schedule.
  if (
    !issues.some(existing => existing.code === code && existing.field === field)
  ) {
    issues.push({ code, severity, field, messageEn, messageAr });
  }
}

function isAfterOrSame(period: ParsedMonth, start: ParsedMonth): boolean {
  return period.serial >= start.serial;
}

function escalationMultiplier(
  monthsSinceOpening: number,
  annualEscalationPct: number
): number {
  return Math.pow(
    1 + annualEscalationPct / 100,
    Math.floor(monthsSinceOpening / 12)
  );
}

function occupiedFraction(row: LeasingRow, monthsSinceOpening: number): number {
  const initial = row.initialOccupancyPct / 100;
  const stable = row.stabilisedOccupancyPct / 100;
  if (row.rampMonths === 0) return stable;
  const progress = Math.min(monthsSinceOpening / row.rampMonths, 1);
  return initial + (stable - initial) * progress;
}

function validLeasingRowAtOpen(row: LeasingRow): boolean {
  if (row.treatment !== "leased") {
    return nonNegative(row.areaSqft) && parseMonth(row.openingMonth) !== null;
  }
  return (
    nonNegative(row.areaSqft) &&
    nonNegative(row.annualRentPsf) &&
    (row.rentRule === "base" ||
      (nonNegative(row.annualSalesPsf) && percentage(row.turnoverPct))) &&
    percentage(row.initialOccupancyPct) &&
    percentage(row.stabilisedOccupancyPct) &&
    wholeNonNegative(row.rampMonths) &&
    wholeNonNegative(row.rentFreeMonths) &&
    nonNegative(row.escalationPct) &&
    percentage(row.collectionPct) &&
    wholeNonNegative(row.collectionLagMonths) &&
    parseMonth(row.openingMonth) !== null
  );
}

function addLeasingValidationIssues(
  row: LeasingRow,
  issues: ModelIssue[]
): void {
  const prefix = `leasing.${row.id}`;
  if (!nonNegative(row.areaSqft)) {
    issue(
      issues,
      "INVALID_LEASING_AREA",
      "error",
      `${prefix}.areaSqft`,
      "Leasing area must be a finite non-negative number.",
      "يجب أن تكون مساحة التأجير رقماً منتهياً وغير سالب."
    );
  }
  if (!knownFloor(row.floor)) {
    issue(
      issues,
      "INVALID_LEASING_FLOOR",
      "error",
      `${prefix}.floor`,
      "Leasing floor must be G, L1, L2, L3, or L4.",
      "يجب أن يكون طابق التأجير G أو L1 أو L2 أو L3 أو L4."
    );
  }
  if (row.treatment === "leased" && !nonNegative(row.annualRentPsf)) {
    issue(
      issues,
      "RENT_INPUT_MISSING",
      "error",
      `${prefix}.annualRentPsf`,
      "Annual base rent is required from this leased row opening month; zero is permitted when explicit.",
      "الإيجار السنوي الأساسي مطلوب من شهر افتتاح صف التأجير؛ ويُسمح بالصفر إذا كان صريحاً."
    );
  }
  if (
    row.treatment === "leased" &&
    row.rentRule !== "base" &&
    !nonNegative(row.annualSalesPsf)
  ) {
    issue(
      issues,
      "TURNOVER_SALES_INPUT_MISSING",
      "error",
      `${prefix}.annualSalesPsf`,
      "Annual sales per sqft is required for a turnover-rent rule.",
      "المبيعات السنوية لكل قدم مربع مطلوبة لقاعدة إيجار مرتبطة بالمبيعات."
    );
  }
  if (
    row.treatment === "leased" &&
    row.rentRule !== "base" &&
    !percentage(row.turnoverPct)
  ) {
    issue(
      issues,
      "TURNOVER_PERCENTAGE_INVALID",
      "error",
      `${prefix}.turnoverPct`,
      "Turnover percentage must be a finite value from 0% to 100%.",
      "يجب أن تكون نسبة إيجار المبيعات قيمة منتهية بين 0% و100%."
    );
  }
  if (
    row.treatment === "leased" &&
    (!percentage(row.initialOccupancyPct) ||
      !percentage(row.stabilisedOccupancyPct))
  ) {
    issue(
      issues,
      "OCCUPANCY_OUT_OF_RANGE",
      "error",
      `${prefix}.occupancy`,
      "Initial and stabilised occupancy must each be between 0% and 100%.",
      "يجب أن تكون نسبة الإشغال الابتدائية والمستقرة بين 0% و100%."
    );
  }
  if (row.treatment === "leased" && !wholeNonNegative(row.rampMonths)) {
    issue(
      issues,
      "INVALID_LEASE_UP_RAMP",
      "error",
      `${prefix}.rampMonths`,
      "Lease-up ramp months must be a non-negative whole number.",
      "يجب أن تكون أشهر التدرج في التأجير عدداً صحيحاً غير سالب."
    );
  }
  if (row.treatment === "leased" && !wholeNonNegative(row.rentFreeMonths)) {
    issue(
      issues,
      "INVALID_RENT_FREE_MONTHS",
      "error",
      `${prefix}.rentFreeMonths`,
      "Rent-free months must be a non-negative whole number.",
      "يجب أن تكون أشهر الإعفاء الإيجاري عدداً صحيحاً غير سالب."
    );
  }
  if (row.treatment === "leased" && !nonNegative(row.escalationPct)) {
    issue(
      issues,
      "INVALID_RENT_ESCALATION",
      "error",
      `${prefix}.escalationPct`,
      "Rent escalation must be a finite non-negative percentage.",
      "يجب أن تكون زيادة الإيجار نسبة منتهية وغير سالبة."
    );
  }
  if (row.treatment === "leased" && !percentage(row.collectionPct)) {
    issue(
      issues,
      "COLLECTION_PERCENTAGE_INVALID",
      "error",
      `${prefix}.collectionPct`,
      "Collection percentage must be a finite value from 0% to 100%.",
      "يجب أن تكون نسبة التحصيل قيمة منتهية بين 0% و100%."
    );
  }
  if (
    row.treatment === "leased" &&
    !wholeNonNegative(row.collectionLagMonths)
  ) {
    issue(
      issues,
      "INVALID_COLLECTION_LAG",
      "error",
      `${prefix}.collectionLagMonths`,
      "Collection lag must be a non-negative whole number of months.",
      "يجب أن يكون تأخر التحصيل عدداً صحيحاً غير سالب من الأشهر."
    );
  }
  if (!parseMonth(row.openingMonth)) {
    issue(
      issues,
      "INVALID_ROW_OPENING_MONTH",
      "error",
      `${prefix}.openingMonth`,
      "Row opening month must use YYYY-MM.",
      "يجب أن يستخدم شهر افتتاح الصف صيغة YYYY-MM."
    );
  }
}

function validOpexRow(row: OpexRow): boolean {
  return (
    nonNegative(row.value) &&
    nonNegative(row.escalationPct) &&
    percentage(row.recoverablePct) &&
    percentage(row.recoveryCollectionPct)
  );
}

function addOpexValidationIssues(row: OpexRow, issues: ModelIssue[]): void {
  const prefix = `opex.${row.id}`;
  if (!nonNegative(row.value)) {
    issue(
      issues,
      "OPEX_INPUT_MISSING",
      "error",
      `${prefix}.value`,
      "OPEX value is required after operational opening; zero is permitted when explicit.",
      "قيمة المصروف التشغيلي مطلوبة بعد الافتتاح التشغيلي؛ ويُسمح بالصفر إذا كان صريحاً."
    );
  }
  if (!nonNegative(row.escalationPct)) {
    issue(
      issues,
      "INVALID_OPEX_ESCALATION",
      "error",
      `${prefix}.escalationPct`,
      "OPEX escalation must be a finite non-negative percentage.",
      "يجب أن تكون زيادة المصروف التشغيلي نسبة منتهية وغير سالبة."
    );
  }
  if (!percentage(row.recoverablePct)) {
    issue(
      issues,
      "INVALID_RECOVERABLE_PERCENTAGE",
      "error",
      `${prefix}.recoverablePct`,
      "Recoverable percentage must be from 0% to 100%.",
      "يجب أن تكون نسبة القابل للاسترداد بين 0% و100%."
    );
  }
  if (!percentage(row.recoveryCollectionPct)) {
    issue(
      issues,
      "INVALID_RECOVERY_COLLECTION_PERCENTAGE",
      "error",
      `${prefix}.recoveryCollectionPct`,
      "Recovery collection percentage must be from 0% to 100%.",
      "يجب أن تكون نسبة تحصيل الاستردادات بين 0% و100%."
    );
  }
}

function calculateRowMonth(
  row: LeasingRow,
  period: ParsedMonth,
  periodIndex: number
): RowMonth | null {
  const opening = parseMonth(row.openingMonth);
  if (!opening) {
    return null;
  }
  if (period.serial < opening.serial) {
    return {
      potential: 0,
      billed: 0,
      badDebt: 0,
      collectionMonth: periodIndex,
      collectionAmount: 0,
      occupiedLeasedArea: 0,
    };
  }
  if (!validLeasingRowAtOpen(row)) {
    return null;
  }

  const monthsSinceOpening = period.serial - opening.serial;
  const physicalOccupancy = occupiedFraction(row, monthsSinceOpening);
  const escalation = escalationMultiplier(
    monthsSinceOpening,
    row.escalationPct
  );
  const baseRent =
    ((row.annualRentPsf as number) *
      row.areaSqft *
      physicalOccupancy *
      escalation) /
    12;
  const turnoverRent =
    row.rentRule === "base"
      ? 0
      : ((row.annualSalesPsf as number) *
          row.areaSqft *
          physicalOccupancy *
          (row.turnoverPct as number)) /
        100 /
        12;

  let potential: number;
  switch (row.rentRule) {
    case "max_base_turnover":
      potential = Math.max(baseRent, turnoverRent);
      break;
    case "base_plus_turnover":
      potential = baseRent + turnoverRent;
      break;
    case "base":
    default:
      potential = baseRent;
      break;
  }

  const billed = monthsSinceOpening < row.rentFreeMonths ? 0 : potential;
  const badDebt = billed * (1 - row.collectionPct / 100);
  return {
    potential,
    billed,
    badDebt,
    collectionMonth: periodIndex + row.collectionLagMonths,
    collectionAmount: (billed * row.collectionPct) / 100,
    // Physical occupancy still exists during rent-free months and is used only
    // for service-charge recovery, not as owner-operated income.
    occupiedLeasedArea: row.areaSqft * physicalOccupancy,
  };
}

function calculateOpexMonth(
  rows: OpexRow[],
  totalGla: number,
  occupiedLeasedArea: number,
  collectedRent: number | null,
  monthsSinceOpening: number
): OpexMonth | null {
  if (rows.length === 0 || totalGla <= 0) return null;

  let gross = 0;
  let recoveryBilled = 0;
  const leasedOccupiedFraction = Math.max(
    0,
    Math.min(1, occupiedLeasedArea / totalGla)
  );

  for (const row of rows) {
    if (!validOpexRow(row)) return null;
    const escalation = escalationMultiplier(
      monthsSinceOpening,
      row.escalationPct
    );
    let monthlyCost: number;
    switch (row.mode) {
      case "annual_amount":
        monthlyCost = ((row.value as number) * escalation) / 12;
        break;
      case "per_gla":
        monthlyCost = ((row.value as number) * totalGla * escalation) / 12;
        break;
      case "percent_collected_rent":
        if (collectedRent === null) return null;
        monthlyCost =
          ((collectedRent * (row.value as number)) / 100) * escalation;
        break;
      default:
        return null;
    }
    gross += monthlyCost;
    recoveryBilled +=
      ((monthlyCost * row.recoverablePct) / 100) * leasedOccupiedFraction;
  }

  // Recovery collection is deliberately a cash-rate applied once. It is not
  // treated as a reduction of gross OPEX, which keeps property cash NOI clear.
  const recoveryCollected = rows.reduce((sum, row) => {
    // A row has already passed validOpexRow above.
    const escalation = escalationMultiplier(
      monthsSinceOpening,
      row.escalationPct
    );
    let monthlyCost: number;
    switch (row.mode) {
      case "annual_amount":
        monthlyCost = ((row.value as number) * escalation) / 12;
        break;
      case "per_gla":
        monthlyCost = ((row.value as number) * totalGla * escalation) / 12;
        break;
      case "percent_collected_rent":
        monthlyCost =
          (((collectedRent as number) * (row.value as number)) / 100) *
          escalation;
        break;
    }
    return (
      sum +
      (((monthlyCost * row.recoverablePct) / 100) *
        leasedOccupiedFraction *
        row.recoveryCollectionPct) /
        100
    );
  }, 0);

  return { gross, recoveryBilled, recoveryCollected };
}

/**
 * Calculates Majan's monthly Draft/Indicative leasing, operating cash and
 * CFADS schedule.  Missing values produce null only in outputs that depend on
 * them. Explicit numeric zero remains a calculated zero.
 */
export function calculateMajanLeasing(
  inputs: MajanInputs,
  periods: string[]
): LeasingResult {
  const issues: ModelIssue[] = [];
  const floorGla: Record<string, number> = { G: 0, L1: 0, L2: 0, L3: 0, L4: 0 };

  if (periods.length > MAX_MONTHS) {
    issue(
      issues,
      "HORIZON_EXCEEDS_360_MONTHS",
      "error",
      "periods",
      "The monthly horizon may not exceed 360 months.",
      "لا يجوز أن يتجاوز الأفق الشهري 360 شهراً."
    );
  }
  if (periods.length === 0) {
    issue(
      issues,
      "EMPTY_MONTHLY_HORIZON",
      "error",
      "periods",
      "At least one YYYY-MM reporting period is required.",
      "مطلوب شهر تقريري واحد على الأقل بصيغة YYYY-MM."
    );
  }

  const monthPeriods = periods.map((period, index) => {
    const parsed = parseMonth(period);
    if (!parsed) {
      issue(
        issues,
        "INVALID_PERIOD",
        "error",
        `periods.${index}`,
        "Every reporting period must use YYYY-MM.",
        "يجب أن يستخدم كل شهر تقريري صيغة YYYY-MM."
      );
    }
    return parsed;
  });
  // Monthly sequence is a presentation/control issue, not a sort. Retain the
  // supplied order so a report cannot hide a source-period exception.
  for (let index = 1; index < monthPeriods.length; index += 1) {
    const previous = monthPeriods[index - 1];
    const current = monthPeriods[index];
    if (previous && current && current.serial !== previous.serial + 1) {
      issue(
        issues,
        "NON_CONSECUTIVE_PERIODS",
        "warning",
        "periods",
        "Reporting periods are not consecutive monthly periods; supplied order is retained.",
        "الفترات التقريرّية ليست أشهرًا متتالية؛ تم الاحتفاظ بالترتيب المقدم."
      );
      break;
    }
  }

  const operationsOpening = parseMonth(inputs.operations.openingMonth);
  if (!operationsOpening) {
    issue(
      issues,
      "INVALID_OPERATIONS_OPENING_MONTH",
      "error",
      "operations.openingMonth",
      "Operational opening month must use YYYY-MM.",
      "يجب أن يستخدم شهر الافتتاح التشغيلي صيغة YYYY-MM."
    );
  }

  if (inputs.leasing.length === 0) {
    issue(
      issues,
      "LEASING_PROGRAMME_EMPTY",
      "error",
      "leasing",
      "A grouped leasing programme is required; a unit count is not required.",
      "برنامج تأجير مجمع مطلوب؛ ولا يلزم عدد وحدات."
    );
  }

  for (const row of inputs.leasing) {
    addLeasingValidationIssues(row, issues);
    if (nonNegative(row.areaSqft) && knownFloor(row.floor))
      floorGla[row.floor] += row.areaSqft;
  }

  const totalGla = FLOORS.reduce((sum, floor) => sum + floorGla[floor], 0);
  if (totalGla <= 0) {
    issue(
      issues,
      "ZERO_GLA",
      "error",
      "leasing",
      "Total GLA must be greater than zero for an operating forecast.",
      "يجب أن يكون إجمالي المساحة القابلة للتأجير أكبر من صفر للتوقع التشغيلي."
    );
  }
  if (totalGla > GFA_LIMIT) {
    issue(
      issues,
      "GLA_EXCEEDS_GFA",
      "error",
      "leasing",
      `Total GLA ${totalGla.toFixed(2)} sqft exceeds the recorded GFA ceiling of ${GFA_LIMIT.toFixed(2)} sqft.`,
      `يتجاوز إجمالي المساحة القابلة للتأجير ${totalGla.toFixed(2)} قدم² سقف المساحة الإجمالية المسجل ${GFA_LIMIT.toFixed(2)} قدم².`
    );
  }
  for (const floor of FLOORS) {
    if (floorGla[floor] > FLOOR_REFERENCE_GLA[floor]) {
      issue(
        issues,
        "FLOOR_GLA_EXCEEDS_COLLIERS_REFERENCE",
        "warning",
        `leasing.floor.${floor}`,
        `${floor} leasing area exceeds the Colliers concept floor reference; confirm the editable allocation.`,
        `تتجاوز مساحة التأجير في ${floor} مرجع مساحة الطابق المفاهيمي من كوليرز؛ يرجى تأكيد التوزيع القابل للتعديل.`
      );
    }
  }

  if (inputs.opex.length === 0) {
    issue(
      issues,
      "OPEX_PROGRAMME_EMPTY",
      "error",
      "opex",
      "An operating expense programme is required after opening; an empty list is not assumed to be zero.",
      "برنامج المصروفات التشغيلية مطلوب بعد الافتتاح؛ ولا تُفترض القائمة الفارغة صفراً."
    );
  }
  for (const row of inputs.opex) addOpexValidationIssues(row, issues);

  if (!nonNegative(inputs.operations.maintenanceCapexAnnual)) {
    issue(
      issues,
      "CAPEX_INPUT_MISSING",
      "error",
      "operations.maintenanceCapexAnnual",
      "Maintenance capex is required after opening; zero is permitted when explicit.",
      "رأس المال التشغيلي للصيانة مطلوب بعد الافتتاح؛ ويُسمح بالصفر إذا كان صريحاً."
    );
  }
  if (!nonNegative(inputs.operations.capexEscalationPct)) {
    issue(
      issues,
      "INVALID_CAPEX_ESCALATION",
      "error",
      "operations.capexEscalationPct",
      "Maintenance capex escalation must be a finite non-negative percentage.",
      "يجب أن تكون زيادة رأس مال الصيانة نسبة منتهية وغير سالبة."
    );
  }
  if (!nonNegative(inputs.operations.reserveAnnual)) {
    issue(
      issues,
      "RESERVE_INPUT_MISSING",
      "error",
      "operations.reserveAnnual",
      "Annual reserve deposit is required after opening; zero is permitted when explicit.",
      "إيداع الاحتياطي السنوي مطلوب بعد الافتتاح؛ ويُسمح بالصفر إذا كان صريحاً."
    );
  }
  if (!nonNegative(inputs.operations.reserveReleaseAnnual)) {
    issue(
      issues,
      "INVALID_RESERVE_RELEASE",
      "error",
      "operations.reserveReleaseAnnual",
      "Annual reserve release must be a finite non-negative amount.",
      "يجب أن يكون الإفراج السنوي عن الاحتياطي مبلغاً منتهياً وغير سالب."
    );
  }
  if (!nonNegative(inputs.operations.cashTaxAnnual)) {
    issue(
      issues,
      "CASH_TAX_INPUT_MISSING",
      "error",
      "operations.cashTaxAnnual",
      "Cash tax is required after opening. Do not replace missing tax with zero.",
      "الضريبة النقدية مطلوبة بعد الافتتاح. لا تستبدل الضريبة المفقودة بصفر."
    );
  } else if (inputs.operations.cashTaxAnnual === 0) {
    issue(
      issues,
      "CASH_TAX_NOT_YET_ESTIMATED",
      "warning",
      "operations.cashTaxAnnual",
      "Cash tax is not yet estimated and is explicitly modelled as zero. CFADS is pre-tax and indicative; this is not a tax-free conclusion.",
      "لم تُقدّر الضريبة النقدية بعد ومثّلت صراحة بصفر. النقد المتاح لخدمة الدين قبل الضريبة وإرشادي؛ ولا يعني ذلك إعفاءً ضريبياً."
    );
  }
  if (!nonNegative(inputs.operations.otherIncomeAnnual)) {
    issue(
      issues,
      "INVALID_OTHER_INCOME",
      "error",
      "operations.otherIncomeAnnual",
      "Other income must be a finite non-negative annual amount and is not owner-operated revenue.",
      "يجب أن يكون الدخل الآخر مبلغاً سنوياً منتهياً وغير سالب، وليس إيراد تشغيل المالك."
    );
  }
  if (inputs.operations.vatMode === "excluded_net_model") {
    issue(
      issues,
      "VAT_EXCLUDED_NO_LIQUIDITY_FORECAST",
      "info",
      "operations.vatMode",
      "VAT is excluded from this net operating model; no VAT-liquidity forecast is included and a separate VAT ledger is required.",
      "ضريبة القيمة المضافة مستبعدة من هذا النموذج التشغيلي الصافي؛ ولا يشمل توقع سيولة لضريبة القيمة المضافة ويتطلب سجلاً منفصلاً لها."
    );
  }
  issue(
    issues,
    "OPENING_RESTRICTED_CASH_ASSUMED_ZERO",
    "info",
    "operations.reserveAnnual",
    "Opening restricted cash is assumed to be zero because the shared input contract has no opening-reserve field.",
    "يُفترض أن النقد المقيد الافتتاحي صفر لأن عقد المدخلات المشترك لا يحتوي على حقل للاحتياطي الافتتاحي."
  );
  issue(
    issues,
    "ANALYTIC_OPERATING_RESERVE",
    "info",
    "operations.reserveAnnual",
    "Operating reserve deposits reduce analytical CFADS and are not represented as an official facility-reserve requirement. DSRA, if any, belongs solely to the finance overlay.",
    "تخفض إيداعات الاحتياطي التشغيلي النقد المتاح لخدمة الدين تحليلياً ولا تمثل متطلب احتياطي تسهيلات رسمي. واحتياطي خدمة الدين إن وجد يخص طبقة التمويل فقط."
  );

  const leasedRows = inputs.leasing.filter(row => row.treatment === "leased");
  const leaseArea = leasedRows.reduce(
    (sum, row) => sum + (nonNegative(row.areaSqft) ? row.areaSqft : 0),
    0
  );
  const blendedRentPsf =
    leasedRows.length === 0 ||
    leaseArea === 0 ||
    leasedRows.some(row => !nonNegative(row.annualRentPsf))
      ? null
      : leasedRows.reduce(
          (sum, row) => sum + (row.annualRentPsf as number) * row.areaSqft,
          0
        ) / leaseArea;

  const scheduledCollections = new Array<number>(periods.length).fill(0);
  let arBalance: number | null = 0;
  let restrictedCash: number | null = 0;

  const months: LeasingMonth[] = periods.map((period, index) => {
    const parsedPeriod = monthPeriods[index];
    const operational = Boolean(
      parsedPeriod &&
        operationsOpening &&
        isAfterOrSame(parsedPeriod!, operationsOpening!)
    );

    // Before the known operational opening all operating cash lines are known
    // zero, irrespective of later missing forecast assumptions.
    if (!operational) {
      return {
        period,
        potentialRent: parsedPeriod && operationsOpening ? 0 : null,
        billedRent: parsedPeriod && operationsOpening ? 0 : null,
        collectedRent: parsedPeriod && operationsOpening ? 0 : null,
        openingAr: parsedPeriod && operationsOpening ? 0 : null,
        closingAr: parsedPeriod && operationsOpening ? 0 : null,
        badDebt: parsedPeriod && operationsOpening ? 0 : null,
        opex: parsedPeriod && operationsOpening ? 0 : null,
        serviceChargeBilled: parsedPeriod && operationsOpening ? 0 : null,
        serviceChargeCollected: parsedPeriod && operationsOpening ? 0 : null,
        cashNoi: parsedPeriod && operationsOpening ? 0 : null,
        capex: parsedPeriod && operationsOpening ? 0 : null,
        reserveDeposit: parsedPeriod && operationsOpening ? 0 : null,
        reserveRelease: 0,
        restrictedCash: parsedPeriod && operationsOpening ? 0 : null,
        cashTax: parsedPeriod && operationsOpening ? 0 : null,
        otherIncome: parsedPeriod && operationsOpening ? 0 : null,
        cfads: parsedPeriod && operationsOpening ? 0 : null,
      };
    }

    const monthsSinceOperationsOpening =
      parsedPeriod!.serial - operationsOpening!.serial;
    let rentComplete = inputs.leasing.length > 0;
    let physicalOccupancyComplete = inputs.leasing.length > 0 && totalGla > 0;
    let potentialRent = 0;
    let billedRent = 0;
    let badDebt = 0;
    let occupiedLeasedArea = 0;

    for (const row of leasedRows) {
      const rowMonth = calculateRowMonth(row, parsedPeriod!, index);
      if (!rowMonth) {
        rentComplete = false;
        physicalOccupancyComplete = false;
        continue;
      }
      potentialRent += rowMonth.potential;
      billedRent += rowMonth.billed;
      badDebt += rowMonth.badDebt;
      occupiedLeasedArea += rowMonth.occupiedLeasedArea;
      if (rowMonth.collectionMonth < scheduledCollections.length) {
        scheduledCollections[rowMonth.collectionMonth] +=
          rowMonth.collectionAmount;
      }
    }

    // Owner-operated space is not rent nor an automatic intercompany income.
    // Its area remains in gross GLA/OPEX but never in occupied leased recovery.
    const currentCollected = scheduledCollections[index];
    const openingAr = arBalance;
    let closingAr: number | null = null;
    if (rentComplete && openingAr !== null) {
      closingAr = openingAr + billedRent - badDebt - currentCollected;
      arBalance = closingAr;
    } else {
      arBalance = null;
    }

    const collectedRent =
      rentComplete && openingAr !== null ? currentCollected : null;
    const opexResult = physicalOccupancyComplete
      ? calculateOpexMonth(
          inputs.opex,
          totalGla,
          occupiedLeasedArea,
          collectedRent,
          monthsSinceOperationsOpening
        )
      : null;
    const grossOpex = opexResult?.gross ?? null;
    const serviceChargeBilled = opexResult?.recoveryBilled ?? null;
    const serviceChargeCollected = opexResult?.recoveryCollected ?? null;

    const otherIncome = nonNegative(inputs.operations.otherIncomeAnnual)
      ? inputs.operations.otherIncomeAnnual / 12
      : null;
    const cashNoi =
      collectedRent !== null &&
      grossOpex !== null &&
      serviceChargeCollected !== null &&
      otherIncome !== null
        ? collectedRent + otherIncome + serviceChargeCollected - grossOpex
        : null;

    const capex =
      nonNegative(inputs.operations.maintenanceCapexAnnual) &&
      nonNegative(inputs.operations.capexEscalationPct)
        ? (inputs.operations.maintenanceCapexAnnual *
            escalationMultiplier(
              monthsSinceOperationsOpening,
              inputs.operations.capexEscalationPct
            )) /
          12
        : null;
    const cashTax = nonNegative(inputs.operations.cashTaxAnnual)
      ? inputs.operations.cashTaxAnnual / 12
      : null;
    const reserveDeposit = nonNegative(inputs.operations.reserveAnnual)
      ? inputs.operations.reserveAnnual / 12
      : null;

    let reserveRelease = 0;
    if (restrictedCash !== null && reserveDeposit !== null) {
      const availableRestrictedCash = restrictedCash + reserveDeposit;
      const requestedRelease = nonNegative(
        inputs.operations.reserveReleaseAnnual
      )
        ? inputs.operations.reserveReleaseAnnual / 12
        : 0;
      // A reserve release can only fund actual maintenance capex; it is not an
      // operating gain or a way to manufacture CFADS.
      reserveRelease = Math.min(
        requestedRelease,
        Math.max(0, capex ?? 0),
        availableRestrictedCash
      );
      restrictedCash = availableRestrictedCash - reserveRelease;
    } else {
      restrictedCash = null;
    }

    const cfads =
      cashNoi !== null &&
      cashTax !== null &&
      capex !== null &&
      reserveDeposit !== null &&
      restrictedCash !== null
        ? cashNoi - cashTax - capex - reserveDeposit + reserveRelease
        : null;

    return {
      period,
      potentialRent: rentComplete ? potentialRent : null,
      billedRent: rentComplete ? billedRent : null,
      collectedRent,
      openingAr: rentComplete ? openingAr : null,
      closingAr,
      badDebt: rentComplete ? badDebt : null,
      opex: grossOpex,
      serviceChargeBilled,
      serviceChargeCollected,
      cashNoi,
      capex,
      reserveDeposit,
      reserveRelease,
      restrictedCash,
      cashTax,
      otherIncome: otherIncome ?? 0,
      cfads,
    };
  });

  return { months, issues, totalGla, blendedRentPsf, floorGla };
}
