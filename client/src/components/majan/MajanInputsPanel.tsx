import { useMemo, useState } from "react";
import type {
  FeeSpec,
  MajanBaseline,
  MajanInputs,
  MajanLocale,
  OpexRow,
  Provenance,
} from "@shared/majanFinanceTypes";
import {
  MajanEditableNumber,
  MajanSection,
  MajanTable,
  MajanTableBody,
  MajanTableHeader,
  MajanTextInput,
  phrase,
  type Translation,
} from "./MajanUi";

const t = (en: string, ar: string): Translation => ({ en, ar });

const labels = {
  development: t("Development basis", "أساس التطوير"),
  developmentHelp: t(
    "The original monthly programme remains preserved. Changing BUA, rate or fee mode creates a scenario calculation only.",
    "يبقى البرنامج الشهري الأصلي محفوظًا. ويُنشئ تغيير المساحة أو السعر أو طريقة الأتعاب حساب سيناريو فقط."
  ),
  bua: t("BUA (sqft)", "مساحة BUA (قدم²)"),
  rate: t("Construction rate (AED/sqft)", "سعر الإنشاء (درهم/قدم²)"),
  mode: t("Fee calculation mode", "طريقة احتساب الأتعاب"),
  amount: t("Amount (AED)", "المبلغ (درهم)"),
  percentage: t("Percentage (%)", "النسبة (%)"),
  minimum: t("Minimum (AED)", "الحد الأدنى (درهم)"),
  design: t("Design fee", "أتعاب التصميم"),
  supervision: t("Supervision fee", "أتعاب الإشراف"),
  programme: t("Scenario programme", "برنامج السيناريو"),
  programmeHelp: t(
    "These editable dates and durations apply to this scenario only; the archived original programme remains visible in the report.",
    "تسري هذه التواريخ والمدد القابلة للتعديل على هذا السيناريو فقط؛ ويبقى البرنامج الأصلي المؤرشف ظاهرًا في التقرير."
  ),
  start: t("Scenario start", "بداية السيناريو"),
  designMonths: t("Design months", "أشهر التصميم"),
  constructionMonths: t("Construction months", "أشهر الإنشاء"),
  handoverMonths: t("Handover months", "أشهر التسليم"),
  otherCosts: t("Other development cost lines", "بنود تكلفة التطوير الأخرى"),
  otherCostsHelp: t(
    "Blank retains the archived original amount; zero is an explicit scenario amount. Tagged-paid values are preserved and are not payment evidence.",
    "الخانة الفارغة تحفظ المبلغ الأصلي المؤرشف؛ والصفر مبلغ صريح للسيناريو. تبقى القيم الموسومة كمدفوعة محفوظة وليست دليل دفع."
  ),
  archivedAmount: t("Archived amount", "المبلغ المؤرشف"),
  scenarioAmount: t("Scenario amount", "مبلغ السيناريو"),
  paidTag: t("System-tagged paid", "موسوم مدفوع بالنظام"),
  sourceReference: t("Source reference", "مرجع المصدر"),
  rationale: t("Rationale", "المبرر"),
  leasing: t("Leasing programme", "برنامج التأجير"),
  leasingHelp: t(
    "Grouped assumptions, not a unit schedule. Current rows are draft assumptions and do not represent signed leases.",
    "افتراضات مجمعة وليست جدول وحدات. الصفوف الحالية افتراضات مسودة ولا تمثل عقود إيجار موقعة."
  ),
  addRow: t("Add leasing row", "إضافة صف تأجير"),
  floor: t("Floor", "الطابق"),
  use: t("Use / category", "الاستخدام / الفئة"),
  area: t("GLA sqft", "GLA قدم²"),
  treatment: t("Treatment", "المعالجة"),
  rent: t("Annual rent AED/sqft", "الإيجار السنوي درهم/قدم²"),
  rule: t("Rent rule", "قاعدة الإيجار"),
  opening: t("Opening", "الافتتاح"),
  initial: t("Initial occ. %", "إشغال أولي %"),
  stable: t("Stable occ. %", "إشغال مستقر %"),
  ramp: t("Ramp months", "أشهر التدرج"),
  free: t("Rent-free months", "أشهر الإعفاء"),
  escalation: t("Annual escalation %", "تصعيد سنوي %"),
  collection: t("Collection %", "التحصيل %"),
  lag: t("Collection lag", "تأخر التحصيل"),
  sales: t("Annual sales AED/sqft", "المبيعات السنوية درهم/قدم²"),
  turnover: t("Turnover rent %", "نسبة إيجار الدوران %"),
  source: t("Source", "المصدر"),
  sourceDate: t("Source date", "تاريخ المصدر"),
  sourceStatus: t("Source status", "حالة المصدر"),
  remove: t("Remove", "إزالة"),
  operation: t("Operations & cash basis", "التشغيل وأساس النقد"),
  operationHelp: t(
    "All operating values are editable draft budgeting allowances. Tax is a pre-tax planning input, not a tax conclusion.",
    "كل قيم التشغيل بدلات موازنة تقديرية قابلة للتعديل. الضريبة مدخل تخطيطي قبل الضريبة وليست نتيجة ضريبية."
  ),
  openingMonth: t("Operations opening month", "شهر بدء التشغيل"),
  horizon: t("Report horizon", "أفق التقرير"),
  capex: t("Maintenance capex / year", "صيانة رأسمالية / سنة"),
  reserve: t("Reserve deposit / year", "إيداع الاحتياطي / سنة"),
  release: t("Reserve release / year", "إطلاق الاحتياطي / سنة"),
  tax: t("Cash tax / year", "الضريبة النقدية / سنة"),
  other: t("Other income / year", "دخل آخر / سنة"),
  taxRationale: t("Tax rationale", "مبرر الضريبة"),
  opex: t("OPEX & recoveries", "التشغيل والاستردادات"),
  addOpex: t("Add OPEX row", "إضافة بند تشغيل"),
  name: t("Name", "الاسم"),
  value: t("Value", "القيمة"),
  recovery: t("Recoverable %", "قابل للاسترداد %"),
  recoveryCollection: t("Recovery collection %", "تحصيل الاسترداد %"),
  finance: t("Finance discussion overlay", "طبقة نقاش التمويل"),
  financeHelp: t(
    "Optional analytical overlay only. It does not alter development timing or create approved bank terms, covenants or commitments.",
    "طبقة تحليلية اختيارية فقط. لا تغير توقيت التطوير ولا تنشئ شروطًا مصرفية أو تعهدات أو موافقات معتمدة."
  ),
  noFinance: t("No finance", "دون تمويل"),
  indicative: t("Indicative finance", "تمويل تقديري"),
  structure: t("Structure", "الهيكل"),
  commitment: t("Commitment (AED)", "الالتزام (درهم)"),
  share: t("Finance share %", "حصة التمويل %"),
  profit: t("Profit rate %", "معدل الربح %"),
  drawStart: t("Draw start", "بداية السحب"),
  drawEnd: t("Draw end", "نهاية السحب"),
  repaymentStart: t("Repayment start", "بداية السداد"),
  repaymentMonths: t("Repayment months", "أشهر السداد"),
  repaymentMode: t("Repayment mode", "طريقة السداد"),
  balloon: t("Balloon %", "الدفعة الختامية %"),
  dsra: t("DSRA months", "أشهر احتياطي الخدمة"),
  fee: t("Arrangement fee %", "رسم الترتيب %"),
  target: t("Analytical target DSCR", "هدف تغطية تحليلي"),
  notes: t("Scenario notes", "ملاحظات السيناريو"),
  notesHelp: t(
    "Notes are part of the editable scenario and will be protected in exports from spreadsheet formula injection.",
    "الملاحظات جزء من السيناريو القابل للتعديل وتُحمى عند التصدير من إدخال صيغ الجداول."
  ),
};

function selectClass() {
  return "h-9 w-full min-w-[110px] rounded-md border border-slate-300 bg-white px-2 text-[13px] text-slate-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100";
}
function monthClass() {
  return "h-9 w-full min-w-[104px] rounded-md border border-slate-300 bg-white px-2 text-[13px] text-slate-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100";
}

function patchFee(current: FeeSpec, patch: Partial<FeeSpec>): FeeSpec {
  return { ...current, ...patch };
}
function newOpexRow(): OpexRow {
  return {
    id: `opex-${Date.now()}`,
    nameEn: "New operating allowance",
    nameAr: "بدل تشغيل جديد",
    mode: "annual_amount",
    value: 0,
    escalationPct: 0,
    recoverablePct: 0,
    recoveryCollectionPct: 95,
    source: {
      source: "Owner editable draft allowance",
      asOf: "2026-10-09",
      status: "assumption",
      rationale: "New editable operating allowance",
    },
  };
}
function defaultOverrideSource(asOf: string): Provenance {
  return {
    source: "Owner editable draft assumption",
    asOf,
    status: "assumption",
    rationale: "Scenario cost-line adjustment",
  };
}

export default function MajanInputsPanel({
  inputs,
  baseline,
  locale,
  onChange,
}: {
  inputs: MajanInputs;
  baseline: MajanBaseline;
  locale: MajanLocale;
  onChange: (next: MajanInputs) => void;
}) {
  const [advancedLeasing, setAdvancedLeasing] = useState(false);
  const p = (item: Translation) => phrase(item, locale);
  const update = (patch: Partial<MajanInputs>) =>
    onChange({ ...inputs, ...patch });
  const updateDevelopment = (patch: Partial<MajanInputs["development"]>) =>
    update({ development: { ...inputs.development, ...patch } });
  const updateOperations = (patch: Partial<MajanInputs["operations"]>) =>
    update({ operations: { ...inputs.operations, ...patch } });
  const updateFinance = (patch: Partial<MajanInputs["finance"]>) =>
    update({ finance: { ...inputs.finance, ...patch } });
  const updateLease = (
    index: number,
    patch: Partial<MajanInputs["leasing"][number]>
  ) =>
    update({
      leasing: inputs.leasing.map((row, rowIndex) =>
        rowIndex === index ? { ...row, ...patch } : row
      ),
    });
  const updateOpex = (index: number, patch: Partial<OpexRow>) =>
    update({
      opex: inputs.opex.map((row, rowIndex) =>
        rowIndex === index ? { ...row, ...patch } : row
      ),
    });
  const updateOverride = (
    rowId: string,
    amount: number | null,
    sourcePatch?: Partial<Provenance>
  ) => {
    const existing = inputs.development.costOverrides?.find(
      item => item.rowId === rowId
    );
    const remaining = (inputs.development.costOverrides || []).filter(
      item => item.rowId !== rowId
    );
    updateDevelopment({
      costOverrides:
        amount === null
          ? remaining
          : [
              ...remaining,
              {
                rowId,
                amount,
                source: {
                  ...(existing?.source || defaultOverrideSource(inputs.asOf)),
                  ...sourcePatch,
                },
              },
            ],
    });
  };
  const feeModes = useMemo(
    () =>
      [
        {
          id: "percentage",
          label: locale === "ar" ? "نسبة مئوية" : "Percentage",
        },
        { id: "amount", label: locale === "ar" ? "مبلغ ثابت" : "Fixed amount" },
        {
          id: "percentage_minimum",
          label:
            locale === "ar" ? "نسبة مع حد أدنى" : "Percentage with minimum",
        },
        { id: "none", label: locale === "ar" ? "غير مطبق" : "Not applicable" },
      ] as const,
    [locale]
  );

  const feeEditor = (
    title: Translation,
    fee: FeeSpec,
    key: "designFee" | "supervisionFee"
  ) => (
    <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
      <p className="mb-2 text-[13px] font-bold text-slate-800">{p(title)}</p>
      <div className="grid gap-2 sm:grid-cols-4">
        <label className="text-[11px] font-semibold text-slate-600">
          {p(labels.mode)}
          <select
            aria-label={`${p(title)} ${p(labels.mode)}`}
            value={fee.mode}
            onChange={event =>
              updateDevelopment({
                [key]: patchFee(fee, {
                  mode: event.target.value as FeeSpec["mode"],
                }),
              })
            }
            className={`${selectClass()} mt-1`}
          >
            {feeModes.map(mode => (
              <option key={mode.id} value={mode.id}>
                {mode.label}
              </option>
            ))}
          </select>
        </label>
        {(fee.mode === "amount" || fee.mode === "percentage_minimum") && (
          <label className="text-[11px] font-semibold text-slate-600">
            {p(labels.amount)}
            <span className="mt-1 block">
              <MajanEditableNumber
                ariaLabel={`${p(title)} ${p(labels.amount)}`}
                value={fee.amount}
                onChange={amount =>
                  updateDevelopment({ [key]: patchFee(fee, { amount }) })
                }
                min={0}
              />
            </span>
          </label>
        )}
        {(fee.mode === "percentage" || fee.mode === "percentage_minimum") && (
          <label className="text-[11px] font-semibold text-slate-600">
            {p(labels.percentage)}
            <span className="mt-1 block">
              <MajanEditableNumber
                ariaLabel={`${p(title)} ${p(labels.percentage)}`}
                value={fee.percentage}
                onChange={percentage =>
                  updateDevelopment({ [key]: patchFee(fee, { percentage }) })
                }
                min={0}
                max={100}
              />
            </span>
          </label>
        )}
        {fee.mode === "percentage_minimum" && (
          <label className="text-[11px] font-semibold text-slate-600">
            {p(labels.minimum)}
            <span className="mt-1 block">
              <MajanEditableNumber
                ariaLabel={`${p(title)} ${p(labels.minimum)}`}
                value={fee.minimum}
                onChange={minimum =>
                  updateDevelopment({ [key]: patchFee(fee, { minimum }) })
                }
                min={0}
              />
            </span>
          </label>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <MajanSection
        title={p(labels.development)}
        subtitle={p(labels.developmentHelp)}
      >
        <div className="grid gap-3 lg:grid-cols-2">
          <label className="text-[12px] font-semibold text-slate-700">
            {p(labels.bua)}
            <span className="mt-1 block">
              <MajanEditableNumber
                ariaLabel={p(labels.bua)}
                value={inputs.development.buaSqft}
                onChange={buaSqft =>
                  buaSqft !== null && updateDevelopment({ buaSqft })
                }
                min={0}
              />
            </span>
          </label>
          <label className="text-[12px] font-semibold text-slate-700">
            {p(labels.rate)}
            <span className="mt-1 block">
              <MajanEditableNumber
                ariaLabel={p(labels.rate)}
                value={inputs.development.constructionRate}
                onChange={constructionRate =>
                  constructionRate !== null &&
                  updateDevelopment({ constructionRate })
                }
                min={0}
              />
            </span>
          </label>
          {feeEditor(labels.design, inputs.development.designFee, "designFee")}
          {feeEditor(
            labels.supervision,
            inputs.development.supervisionFee,
            "supervisionFee"
          )}
        </div>
        <div className="mt-4 rounded-lg border border-teal-100 bg-teal-50/40 p-3">
          <p className="text-[13px] font-bold text-teal-900">
            {p(labels.programme)}
          </p>
          <p className="mt-1 text-[12px] leading-5 text-teal-800">
            {p(labels.programmeHelp)}
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-[12px] font-semibold text-slate-700">
              {p(labels.start)}
              <input
                aria-label={p(labels.start)}
                type="month"
                value={inputs.development.startMonth || baseline.startMonth}
                onChange={event =>
                  updateDevelopment({ startMonth: event.target.value })
                }
                className={`${monthClass()} mt-1`}
              />
            </label>
            <label className="text-[12px] font-semibold text-slate-700">
              {p(labels.designMonths)}
              <span className="mt-1 block">
                <MajanEditableNumber
                  ariaLabel={p(labels.designMonths)}
                  value={
                    inputs.development.designMonths ?? baseline.designMonths
                  }
                  onChange={designMonths =>
                    updateDevelopment({
                      designMonths: designMonths ?? undefined,
                    })
                  }
                  min={0}
                  max={360}
                />
              </span>
            </label>
            <label className="text-[12px] font-semibold text-slate-700">
              {p(labels.constructionMonths)}
              <span className="mt-1 block">
                <MajanEditableNumber
                  ariaLabel={p(labels.constructionMonths)}
                  value={
                    inputs.development.constructionMonths ??
                    baseline.constructionMonths
                  }
                  onChange={constructionMonths =>
                    updateDevelopment({
                      constructionMonths: constructionMonths ?? undefined,
                    })
                  }
                  min={0}
                  max={360}
                />
              </span>
            </label>
            <label className="text-[12px] font-semibold text-slate-700">
              {p(labels.handoverMonths)}
              <span className="mt-1 block">
                <MajanEditableNumber
                  ariaLabel={p(labels.handoverMonths)}
                  value={
                    inputs.development.handoverMonths ?? baseline.handoverMonths
                  }
                  onChange={handoverMonths =>
                    updateDevelopment({
                      handoverMonths: handoverMonths ?? undefined,
                    })
                  }
                  min={0}
                  max={360}
                />
              </span>
            </label>
          </div>
        </div>
        <div className="mt-4">
          <p className="text-[13px] font-bold text-slate-800">
            {p(labels.otherCosts)}
          </p>
          <p className="mt-1 text-[12px] leading-5 text-slate-600">
            {p(labels.otherCostsHelp)}
          </p>
          <MajanTable className="mt-3 max-h-[430px]">
            <MajanTableHeader>
              <tr>
                <th>{locale === "ar" ? "البند" : "Line item"}</th>
                <th>{p(labels.archivedAmount)}</th>
                <th>{p(labels.scenarioAmount)}</th>
                <th>{p(labels.paidTag)}</th>
                <th>{p(labels.sourceReference)}</th>
                <th>{p(labels.rationale)}</th>
              </tr>
            </MajanTableHeader>
            <MajanTableBody>
              {baseline.rows
                .filter(
                  row =>
                    ![
                      "construction",
                      "design",
                      "supervision",
                      "developer_fee",
                    ].includes(row.category)
                )
                .map(row => {
                  const override = inputs.development.costOverrides?.find(
                    item => item.rowId === row.id
                  );
                  return (
                    <tr key={row.id}>
                      <td>
                        <span className="font-semibold text-slate-800">
                          {locale === "ar" ? row.nameAr : row.nameEn}
                        </span>
                        <span className="block text-[10px] text-slate-500">
                          {row.category}
                        </span>
                      </td>
                      <td>
                        {row.total.toLocaleString("en-AE", {
                          maximumFractionDigits: 0,
                        })}
                      </td>
                      <td>
                        <MajanEditableNumber
                          ariaLabel={`${p(labels.scenarioAmount)} ${row.nameEn}`}
                          value={override?.amount ?? null}
                          onChange={amount => updateOverride(row.id, amount)}
                          min={0}
                        />
                      </td>
                      <td>
                        {row.taggedPaid.toLocaleString("en-AE", {
                          maximumFractionDigits: 0,
                        })}
                      </td>
                      <td>
                        <MajanTextInput
                          ariaLabel={`${p(labels.sourceReference)} ${row.nameEn}`}
                          value={override?.source.source || ""}
                          placeholder={
                            locale === "ar"
                              ? "الأصل محفوظ"
                              : "Archived original retained"
                          }
                          onChange={source =>
                            updateOverride(row.id, override?.amount ?? null, {
                              source,
                            })
                          }
                        />
                      </td>
                      <td>
                        <MajanTextInput
                          ariaLabel={`${p(labels.rationale)} ${row.nameEn}`}
                          value={override?.source.rationale || ""}
                          placeholder={
                            locale === "ar"
                              ? "مبرر التغيير"
                              : "Reason for adjustment"
                          }
                          onChange={rationale =>
                            updateOverride(row.id, override?.amount ?? null, {
                              rationale,
                            })
                          }
                        />
                      </td>
                    </tr>
                  );
                })}
            </MajanTableBody>
          </MajanTable>
        </div>
      </MajanSection>

      <MajanSection
        title={p(labels.leasing)}
        subtitle={p(labels.leasingHelp)}
        actions={
          <>
            <button
              type="button"
              onClick={() => setAdvancedLeasing(value => !value)}
              className="rounded-md border border-teal-200 bg-white px-3 py-2 text-[12px] font-bold text-teal-800 hover:bg-teal-50"
            >
              {advancedLeasing
                ? locale === "ar"
                  ? "إخفاء المتقدم"
                  : "Hide advanced"
                : locale === "ar"
                  ? "إظهار المتقدم"
                  : "Show advanced"}
            </button>
            <button
              type="button"
              onClick={() =>
                update({
                  leasing: [
                    ...inputs.leasing,
                    {
                      id: `lease-${Date.now()}`,
                      floor: "G",
                      nameEn: "New lease category",
                      nameAr: "فئة تأجير جديدة",
                      areaSqft: 0,
                      treatment: "leased",
                      annualRentPsf: 0,
                      rentRule: "base",
                      annualSalesPsf: null,
                      turnoverPct: null,
                      openingMonth: inputs.operations.openingMonth,
                      initialOccupancyPct: 0,
                      stabilisedOccupancyPct: 0,
                      rampMonths: 0,
                      rentFreeMonths: 0,
                      escalationPct: 0,
                      collectionPct: 98,
                      collectionLagMonths: 1,
                      source: {
                        source: "Owner editable draft assumption",
                        asOf: inputs.asOf,
                        status: "assumption",
                        rationale: "New grouped leasing row",
                      },
                    },
                  ],
                })
              }
              className="rounded-md bg-teal-700 px-3 py-2 text-[12px] font-bold text-white hover:bg-teal-800"
            >
              {p(labels.addRow)}
            </button>
          </>
        }
      >
        <MajanTable className="max-h-[600px]">
          <MajanTableHeader>
            <tr>
              <th>{p(labels.floor)}</th>
              <th>{p(labels.use)}</th>
              <th>{p(labels.area)}</th>
              <th>{p(labels.treatment)}</th>
              <th>{p(labels.rent)}</th>
              <th>{p(labels.opening)}</th>
              <th>{p(labels.initial)}</th>
              <th>{p(labels.stable)}</th>
              {advancedLeasing && (
                <>
                  <th>{p(labels.rule)}</th>
                  <th>{p(labels.ramp)}</th>
                  <th>{p(labels.free)}</th>
                  <th>{p(labels.escalation)}</th>
                  <th>{p(labels.collection)}</th>
                  <th>{p(labels.lag)}</th>
                  <th>{p(labels.sales)}</th>
                  <th>{p(labels.turnover)}</th>
                  <th>{p(labels.source)}</th>
                  <th>{p(labels.sourceDate)}</th>
                  <th>{p(labels.sourceStatus)}</th>
                  <th>{p(labels.rationale)}</th>
                </>
              )}
              <th aria-label={p(labels.remove)} />
            </tr>
          </MajanTableHeader>
          <MajanTableBody>
            {inputs.leasing.map((row, index) => (
              <tr key={row.id}>
                <td>
                  <select
                    aria-label={`${p(labels.floor)} ${index + 1}`}
                    value={row.floor}
                    onChange={event =>
                      updateLease(index, {
                        floor: event.target.value as typeof row.floor,
                      })
                    }
                    className={selectClass()}
                  >
                    {["G", "L1", "L2", "L3", "L4"].map(floor => (
                      <option key={floor}>{floor}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <div className="grid min-w-[165px] gap-1">
                    <MajanTextInput
                      ariaLabel={`${p(labels.use)} English ${index + 1}`}
                      value={row.nameEn}
                      onChange={nameEn => updateLease(index, { nameEn })}
                    />
                    <MajanTextInput
                      ariaLabel={`${p(labels.use)} Arabic ${index + 1}`}
                      value={row.nameAr}
                      onChange={nameAr => updateLease(index, { nameAr })}
                    />
                  </div>
                </td>
                <td>
                  <MajanEditableNumber
                    ariaLabel={`${p(labels.area)} ${index + 1}`}
                    value={row.areaSqft}
                    onChange={areaSqft =>
                      areaSqft !== null && updateLease(index, { areaSqft })
                    }
                    min={0}
                  />
                </td>
                <td>
                  <select
                    aria-label={`${p(labels.treatment)} ${index + 1}`}
                    value={row.treatment}
                    onChange={event =>
                      updateLease(index, {
                        treatment: event.target.value as typeof row.treatment,
                      })
                    }
                    className={selectClass()}
                  >
                    <option value="leased">
                      {locale === "ar" ? "مؤجر" : "Leased"}
                    </option>
                    <option value="owner_operated">
                      {locale === "ar" ? "تشغيل المالك" : "Owner-operated"}
                    </option>
                  </select>
                </td>
                <td>
                  <MajanEditableNumber
                    ariaLabel={`${p(labels.rent)} ${index + 1}`}
                    value={row.annualRentPsf}
                    onChange={annualRentPsf =>
                      updateLease(index, { annualRentPsf })
                    }
                    min={0}
                  />
                </td>
                <td>
                  <input
                    aria-label={`${p(labels.opening)} ${index + 1}`}
                    type="month"
                    value={row.openingMonth}
                    onChange={event =>
                      updateLease(index, { openingMonth: event.target.value })
                    }
                    className={monthClass()}
                  />
                </td>
                <td>
                  <MajanEditableNumber
                    ariaLabel={`${p(labels.initial)} ${index + 1}`}
                    value={row.initialOccupancyPct}
                    onChange={initialOccupancyPct =>
                      initialOccupancyPct !== null &&
                      updateLease(index, { initialOccupancyPct })
                    }
                    min={0}
                    max={100}
                  />
                </td>
                <td>
                  <MajanEditableNumber
                    ariaLabel={`${p(labels.stable)} ${index + 1}`}
                    value={row.stabilisedOccupancyPct}
                    onChange={stabilisedOccupancyPct =>
                      stabilisedOccupancyPct !== null &&
                      updateLease(index, { stabilisedOccupancyPct })
                    }
                    min={0}
                    max={100}
                  />
                </td>
                {advancedLeasing && (
                  <>
                    <td>
                      <select
                        aria-label={`${p(labels.rule)} ${index + 1}`}
                        value={row.rentRule}
                        onChange={event =>
                          updateLease(index, {
                            rentRule: event.target.value as typeof row.rentRule,
                          })
                        }
                        className={selectClass()}
                      >
                        <option value="base">
                          {locale === "ar" ? "أساسي" : "Base"}
                        </option>
                        <option value="max_base_turnover">
                          {locale === "ar"
                            ? "الأعلى من الأساسي أو دوران"
                            : "Max base / turnover"}
                        </option>
                        <option value="base_plus_turnover">
                          {locale === "ar"
                            ? "أساسي + دوران"
                            : "Base + turnover"}
                        </option>
                      </select>
                    </td>
                    <td>
                      <MajanEditableNumber
                        ariaLabel={`${p(labels.ramp)} ${index + 1}`}
                        value={row.rampMonths}
                        onChange={rampMonths =>
                          rampMonths !== null &&
                          updateLease(index, { rampMonths })
                        }
                        min={0}
                      />
                    </td>
                    <td>
                      <MajanEditableNumber
                        ariaLabel={`${p(labels.free)} ${index + 1}`}
                        value={row.rentFreeMonths}
                        onChange={rentFreeMonths =>
                          rentFreeMonths !== null &&
                          updateLease(index, { rentFreeMonths })
                        }
                        min={0}
                      />
                    </td>
                    <td>
                      <MajanEditableNumber
                        ariaLabel={`${p(labels.escalation)} ${index + 1}`}
                        value={row.escalationPct}
                        onChange={escalationPct =>
                          escalationPct !== null &&
                          updateLease(index, { escalationPct })
                        }
                        min={0}
                        max={100}
                      />
                    </td>
                    <td>
                      <MajanEditableNumber
                        ariaLabel={`${p(labels.collection)} ${index + 1}`}
                        value={row.collectionPct}
                        onChange={collectionPct =>
                          collectionPct !== null &&
                          updateLease(index, { collectionPct })
                        }
                        min={0}
                        max={100}
                      />
                    </td>
                    <td>
                      <MajanEditableNumber
                        ariaLabel={`${p(labels.lag)} ${index + 1}`}
                        value={row.collectionLagMonths}
                        onChange={collectionLagMonths =>
                          collectionLagMonths !== null &&
                          updateLease(index, { collectionLagMonths })
                        }
                        min={0}
                      />
                    </td>
                    <td>
                      <MajanEditableNumber
                        ariaLabel={`${p(labels.sales)} ${index + 1}`}
                        value={row.annualSalesPsf}
                        onChange={annualSalesPsf =>
                          updateLease(index, { annualSalesPsf })
                        }
                        min={0}
                      />
                    </td>
                    <td>
                      <MajanEditableNumber
                        ariaLabel={`${p(labels.turnover)} ${index + 1}`}
                        value={row.turnoverPct}
                        onChange={turnoverPct => updateLease(index, { turnoverPct })}
                        min={0}
                        max={100}
                      />
                    </td>
                    <td>
                      <MajanTextInput
                        ariaLabel={`${p(labels.source)} ${index + 1}`}
                        value={row.source.source}
                        onChange={source =>
                          updateLease(index, { source: { ...row.source, source } })
                        }
                      />
                    </td>
                    <td>
                      <input
                        aria-label={`${p(labels.sourceDate)} ${index + 1}`}
                        type="date"
                        value={row.source.asOf}
                        onChange={event =>
                          updateLease(index, {
                            source: { ...row.source, asOf: event.target.value },
                          })
                        }
                        className={monthClass()}
                      />
                    </td>
                    <td>
                      <select
                        aria-label={`${p(labels.sourceStatus)} ${index + 1}`}
                        value={row.source.status}
                        onChange={event =>
                          updateLease(index, {
                            source: {
                              ...row.source,
                              status: event.target.value as Provenance["status"],
                            },
                          })
                        }
                        className={selectClass()}
                      >
                        <option value="assumption">{locale === "ar" ? "افتراض مسودة" : "Draft assumption"}</option>
                        <option value="recorded">{locale === "ar" ? "مسجل" : "Recorded"}</option>
                        <option value="contractual">{locale === "ar" ? "تعاقدي" : "Contractual"}</option>
                      </select>
                    </td>
                    <td>
                      <MajanTextInput
                        ariaLabel={`${p(labels.rationale)} ${index + 1}`}
                        value={row.source.rationale || ""}
                        onChange={rationale =>
                          updateLease(index, {
                            source: { ...row.source, rationale },
                          })
                        }
                      />
                    </td>
                  </>
                )}
                <td>
                  <button
                    type="button"
                    disabled={inputs.leasing.length < 2}
                    onClick={() =>
                      update({
                        leasing: inputs.leasing.filter(
                          (_, rowIndex) => rowIndex !== index
                        ),
                      })
                    }
                    className="rounded px-2 py-2 text-[11px] font-bold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {p(labels.remove)}
                  </button>
                </td>
              </tr>
            ))}
          </MajanTableBody>
        </MajanTable>
      </MajanSection>

      <MajanSection
        title={p(labels.operation)}
        subtitle={p(labels.operationHelp)}
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-[12px] font-semibold text-slate-700">
            {p(labels.openingMonth)}
            <input
              aria-label={p(labels.openingMonth)}
              type="month"
              value={inputs.operations.openingMonth}
              onChange={event =>
                updateOperations({ openingMonth: event.target.value })
              }
              className={`${monthClass()} mt-1`}
            />
          </label>
          <label className="text-[12px] font-semibold text-slate-700">
            {p(labels.horizon)}
            <input
              aria-label={p(labels.horizon)}
              type="month"
              value={inputs.horizonMonth}
              onChange={event => update({ horizonMonth: event.target.value })}
              className={`${monthClass()} mt-1`}
            />
          </label>
          <label className="text-[12px] font-semibold text-slate-700">
            {p(labels.capex)}
            <span className="mt-1 block">
              <MajanEditableNumber
                ariaLabel={p(labels.capex)}
                value={inputs.operations.maintenanceCapexAnnual}
                onChange={maintenanceCapexAnnual =>
                  updateOperations({ maintenanceCapexAnnual })
                }
                min={0}
              />
            </span>
          </label>
          <label className="text-[12px] font-semibold text-slate-700">
            {p(labels.reserve)}
            <span className="mt-1 block">
              <MajanEditableNumber
                ariaLabel={p(labels.reserve)}
                value={inputs.operations.reserveAnnual}
                onChange={reserveAnnual => updateOperations({ reserveAnnual })}
                min={0}
              />
            </span>
          </label>
          <label className="text-[12px] font-semibold text-slate-700">
            {p(labels.release)}
            <span className="mt-1 block">
              <MajanEditableNumber
                ariaLabel={p(labels.release)}
                value={inputs.operations.reserveReleaseAnnual}
                onChange={reserveReleaseAnnual =>
                  updateOperations({ reserveReleaseAnnual })
                }
                min={0}
              />
            </span>
          </label>
          <label className="text-[12px] font-semibold text-slate-700">
            {p(labels.tax)}
            <span className="mt-1 block">
              <MajanEditableNumber
                ariaLabel={p(labels.tax)}
                value={inputs.operations.cashTaxAnnual}
                onChange={cashTaxAnnual => updateOperations({ cashTaxAnnual })}
                min={0}
              />
            </span>
          </label>
          <label className="text-[12px] font-semibold text-slate-700">
            {p(labels.other)}
            <span className="mt-1 block">
              <MajanEditableNumber
                ariaLabel={p(labels.other)}
                value={inputs.operations.otherIncomeAnnual}
                onChange={otherIncomeAnnual =>
                  updateOperations({ otherIncomeAnnual })
                }
                min={0}
              />
            </span>
          </label>
          <label className="text-[12px] font-semibold text-slate-700 sm:col-span-2 lg:col-span-1">
            {p(labels.taxRationale)}
            <span className="mt-1 block">
              <MajanTextInput
                ariaLabel={p(labels.taxRationale)}
                value={inputs.operations.taxRationale}
                onChange={taxRationale => updateOperations({ taxRationale })}
              />
            </span>
          </label>
        </div>
      </MajanSection>

      <MajanSection
        title={p(labels.opex)}
        actions={
          <button
            type="button"
            onClick={() => update({ opex: [...inputs.opex, newOpexRow()] })}
            className="rounded-md bg-teal-700 px-3 py-2 text-[12px] font-bold text-white hover:bg-teal-800"
          >
            {p(labels.addOpex)}
          </button>
        }
      >
        <MajanTable className="max-h-[520px]">
          <MajanTableHeader>
            <tr>
              <th>{p(labels.name)}</th>
              <th>{p(labels.mode)}</th>
              <th>{p(labels.value)}</th>
              <th>{p(labels.escalation)}</th>
              <th>{p(labels.recovery)}</th>
              <th>{p(labels.recoveryCollection)}</th>
              <th />
            </tr>
          </MajanTableHeader>
          <MajanTableBody>
            {inputs.opex.map((row, index) => (
              <tr key={row.id}>
                <td>
                  <div className="grid min-w-[180px] gap-1">
                    <MajanTextInput
                      ariaLabel={`${p(labels.name)} English ${index + 1}`}
                      value={row.nameEn}
                      onChange={nameEn => updateOpex(index, { nameEn })}
                    />
                    <MajanTextInput
                      ariaLabel={`${p(labels.name)} Arabic ${index + 1}`}
                      value={row.nameAr}
                      onChange={nameAr => updateOpex(index, { nameAr })}
                    />
                  </div>
                </td>
                <td>
                  <select
                    aria-label={`${p(labels.mode)} ${index + 1}`}
                    value={row.mode}
                    onChange={event =>
                      updateOpex(index, {
                        mode: event.target.value as OpexRow["mode"],
                      })
                    }
                    className={selectClass()}
                  >
                    <option value="annual_amount">
                      {locale === "ar" ? "مبلغ سنوي" : "Annual amount"}
                    </option>
                    <option value="per_gla">
                      {locale === "ar" ? "لكل GLA" : "Per GLA"}
                    </option>
                    <option value="percent_collected_rent">
                      {locale === "ar"
                        ? "من الإيجار المحصل"
                        : "% collected rent"}
                    </option>
                  </select>
                </td>
                <td>
                  <MajanEditableNumber
                    ariaLabel={`${p(labels.value)} ${index + 1}`}
                    value={row.value}
                    onChange={value => updateOpex(index, { value })}
                    min={0}
                  />
                </td>
                <td>
                  <MajanEditableNumber
                    ariaLabel={`${p(labels.escalation)} ${index + 1}`}
                    value={row.escalationPct}
                    onChange={escalationPct =>
                      updateOpex(index, { escalationPct })
                    }
                    min={0}
                    max={100}
                  />
                </td>
                <td>
                  <MajanEditableNumber
                    ariaLabel={`${p(labels.recovery)} ${index + 1}`}
                    value={row.recoverablePct}
                    onChange={recoverablePct =>
                      updateOpex(index, { recoverablePct })
                    }
                    min={0}
                    max={100}
                  />
                </td>
                <td>
                  <MajanEditableNumber
                    ariaLabel={`${p(labels.recoveryCollection)} ${index + 1}`}
                    value={row.recoveryCollectionPct}
                    onChange={recoveryCollectionPct =>
                      updateOpex(index, { recoveryCollectionPct })
                    }
                    min={0}
                    max={100}
                  />
                </td>
                <td>
                  <button
                    type="button"
                    onClick={() =>
                      update({
                        opex: inputs.opex.filter(
                          (_, rowIndex) => rowIndex !== index
                        ),
                      })
                    }
                    className="rounded px-2 py-2 text-[11px] font-bold text-rose-700 hover:bg-rose-50"
                  >
                    {p(labels.remove)}
                  </button>
                </td>
              </tr>
            ))}
          </MajanTableBody>
        </MajanTable>
      </MajanSection>

      <MajanSection title={p(labels.finance)} subtitle={p(labels.financeHelp)}>
        <div className="mb-4 inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
          <button
            type="button"
            onClick={() =>
              updateFinance({ enabled: false, status: "terms_pending" })
            }
            className={`rounded-md px-4 py-2 text-[13px] font-bold ${!inputs.finance.enabled ? "bg-white text-teal-800 shadow-sm" : "text-slate-600"}`}
          >
            {p(labels.noFinance)}
          </button>
          <button
            type="button"
            onClick={() =>
              updateFinance({ enabled: true, status: "indicative" })
            }
            className={`rounded-md px-4 py-2 text-[13px] font-bold ${inputs.finance.enabled ? "bg-teal-700 text-white shadow-sm" : "text-slate-600"}`}
          >
            {p(labels.indicative)}
          </button>
        </div>
        {inputs.finance.enabled && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-[12px] font-semibold text-slate-700">
              {p(labels.structure)}
              <select
                aria-label={p(labels.structure)}
                value={inputs.finance.structure}
                onChange={event =>
                  updateFinance({
                    structure: event.target
                      .value as MajanInputs["finance"]["structure"],
                  })
                }
                className={`${selectClass()} mt-1`}
              >
                <option value="istisna_forward_ijara">
                  Istisna + Forward Ijara
                </option>
                <option value="ijara">Ijara</option>
                <option value="diminishing_musharaka">
                  Diminishing Musharaka
                </option>
              </select>
            </label>
            <label className="text-[12px] font-semibold text-slate-700">
              {p(labels.commitment)}
              <span className="mt-1 block">
                <MajanEditableNumber
                  ariaLabel={p(labels.commitment)}
                  value={inputs.finance.commitment}
                  onChange={commitment => updateFinance({ commitment })}
                  min={0}
                />
              </span>
            </label>
            <label className="text-[12px] font-semibold text-slate-700">
              {p(labels.share)}
              <span className="mt-1 block">
                <MajanEditableNumber
                  ariaLabel={p(labels.share)}
                  value={inputs.finance.financeSharePct}
                  onChange={financeSharePct =>
                    updateFinance({ financeSharePct })
                  }
                  min={0}
                  max={100}
                />
              </span>
            </label>
            <label className="text-[12px] font-semibold text-slate-700">
              {p(labels.profit)}
              <span className="mt-1 block">
                <MajanEditableNumber
                  ariaLabel={p(labels.profit)}
                  value={inputs.finance.profitRatePct}
                  onChange={profitRatePct => updateFinance({ profitRatePct })}
                  min={0}
                  max={100}
                />
              </span>
            </label>
            <label className="text-[12px] font-semibold text-slate-700">
              {p(labels.drawStart)}
              <input
                aria-label={p(labels.drawStart)}
                type="month"
                value={inputs.finance.drawStartMonth}
                onChange={event =>
                  updateFinance({ drawStartMonth: event.target.value })
                }
                className={`${monthClass()} mt-1`}
              />
            </label>
            <label className="text-[12px] font-semibold text-slate-700">
              {p(labels.drawEnd)}
              <input
                aria-label={p(labels.drawEnd)}
                type="month"
                value={inputs.finance.drawEndMonth}
                onChange={event =>
                  updateFinance({ drawEndMonth: event.target.value })
                }
                className={`${monthClass()} mt-1`}
              />
            </label>
            <label className="text-[12px] font-semibold text-slate-700">
              {p(labels.repaymentStart)}
              <input
                aria-label={p(labels.repaymentStart)}
                type="month"
                value={inputs.finance.repaymentStartMonth}
                onChange={event =>
                  updateFinance({ repaymentStartMonth: event.target.value })
                }
                className={`${monthClass()} mt-1`}
              />
            </label>
            <label className="text-[12px] font-semibold text-slate-700">
              {p(labels.repaymentMonths)}
              <span className="mt-1 block">
                <MajanEditableNumber
                  ariaLabel={p(labels.repaymentMonths)}
                  value={inputs.finance.repaymentMonths}
                  onChange={repaymentMonths =>
                    updateFinance({ repaymentMonths })
                  }
                  min={1}
                  max={360}
                />
              </span>
            </label>
            <label className="text-[12px] font-semibold text-slate-700">
              {p(labels.repaymentMode)}
              <select
                aria-label={p(labels.repaymentMode)}
                value={inputs.finance.repaymentMode}
                onChange={event =>
                  updateFinance({
                    repaymentMode: event.target
                      .value as MajanInputs["finance"]["repaymentMode"],
                  })
                }
                className={`${selectClass()} mt-1`}
              >
                <option value="equal_principal">
                  {locale === "ar" ? "رأس مال متساوٍ" : "Equal principal"}
                </option>
                <option value="level_payment">
                  {locale === "ar" ? "دفعة متساوية" : "Level payment"}
                </option>
                <option value="bullet">
                  {locale === "ar" ? "دفعة نهائية" : "Bullet"}
                </option>
              </select>
            </label>
            <label className="text-[12px] font-semibold text-slate-700">
              {p(labels.balloon)}
              <span className="mt-1 block">
                <MajanEditableNumber
                  ariaLabel={p(labels.balloon)}
                  value={inputs.finance.balloonPct}
                  onChange={balloonPct => updateFinance({ balloonPct })}
                  min={0}
                  max={100}
                />
              </span>
            </label>
            <label className="text-[12px] font-semibold text-slate-700">
              {p(labels.dsra)}
              <span className="mt-1 block">
                <MajanEditableNumber
                  ariaLabel={p(labels.dsra)}
                  value={inputs.finance.dsraMonths}
                  onChange={dsraMonths => updateFinance({ dsraMonths })}
                  min={0}
                  max={36}
                />
              </span>
            </label>
            <label className="text-[12px] font-semibold text-slate-700">
              {p(labels.fee)}
              <span className="mt-1 block">
                <MajanEditableNumber
                  ariaLabel={p(labels.fee)}
                  value={inputs.finance.arrangementFeePct}
                  onChange={arrangementFeePct =>
                    updateFinance({ arrangementFeePct })
                  }
                  min={0}
                  max={100}
                />
              </span>
            </label>
            <label className="text-[12px] font-semibold text-slate-700">
              {p(labels.target)}
              <span className="mt-1 block">
                <MajanEditableNumber
                  ariaLabel={p(labels.target)}
                  value={inputs.finance.targetDscr}
                  onChange={targetDscr => updateFinance({ targetDscr })}
                  min={0}
                />
              </span>
            </label>
          </div>
        )}
      </MajanSection>

      <MajanSection title={p(labels.notes)} subtitle={p(labels.notesHelp)}>
        <textarea
          aria-label={p(labels.notes)}
          value={inputs.notes}
          onChange={event => update({ notes: event.target.value })}
          className="min-h-28 w-full rounded-md border border-slate-300 bg-white p-3 text-[14px] leading-6 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
        />
      </MajanSection>
    </div>
  );
}
