import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  MajanBaseline,
  MajanInputs,
  MajanLocale,
  MajanModelResult,
} from "@shared/majanFinanceTypes";
import { getMajanStabilisedYear } from "@shared/majanModel";
import {
  displayMoney,
  displayNumber,
  displayPct,
  displayRatio,
  MajanIssueList,
  MajanMetric,
  MajanSection,
  MajanTable,
  MajanTableBody,
  MajanTableHeader,
  phrase,
  type Translation,
} from "./MajanUi";

const tr = (en: string, ar: string): Translation => ({ en, ar });
const words = {
  summary: tr("Summary", "الملخص"),
  development: tr("Development", "التطوير"),
  leasing: tr("Leasing", "التأجير"),
  operations: tr("Operations", "التشغيل"),
  finance: tr("Finance", "التمويل"),
  sources: tr("Sources & checks", "المصادر والاختبارات"),
  annual: tr("Annual", "سنوي"),
  monthly: tr("Monthly", "شهري"),
  openMonthly: tr("Show monthly detail", "إظهار التفاصيل الشهرية"),
  hideMonthly: tr("Hide monthly detail", "إخفاء التفاصيل الشهرية"),
  draft: tr("LIVE PREVIEW · UNSAVED", "معاينة حية · غير محفوظة"),
  saved: tr("SAVED VERSION", "نسخة محفوظة"),
  baseline: tr(
    "Archived original development baseline",
    "أساس التطوير الأصلي المؤرشف"
  ),
  baselineHelp: tr(
    "This is the retained 9 October 2026 recorded schedule, shown without operating income. It is not a certified budget, payment audit or approved financing use.",
    "هذا هو الجدول المسجل المحتفظ به بتاريخ 9 أكتوبر 2026 ويعرض دون دخل تشغيلي. وليس ميزانية معتمدة أو تدقيق دفعات أو استخدام تمويل معتمد."
  ),
  scenario: tr("Current editable scenario", "السيناريو الحالي القابل للتعديل"),
  recorded: tr("Recorded baseline cost", "تكلفة الأساس المسجلة"),
  scenarioCost: tr("Scenario development cost", "تكلفة تطوير السيناريو"),
  gla: tr("Grouped GLA", "المساحة التأجيرية المجمعة"),
  noi: tr("Cash NOI", "صافي الدخل التشغيلي النقدي"),
  cfads: tr("CFADS · pre-tax indicative", "CFADS · تقديري قبل الضريبة"),
  owner: tr("Peak owner funding", "ذروة تمويل المالك"),
  minDscr: tr("Minimum DSCR", "أدنى تغطية"),
  financeState: tr("Finance state", "حالة التمويل"),
  none: tr("No finance", "دون تمويل"),
  indicative: tr("Indicative only", "تقديري فقط"),
  area: tr("GLA sqft", "GLA قدم²"),
  rent: tr("Annual rent AED/sqft", "الإيجار السنوي درهم/قدم²"),
  opening: tr("Opening", "الافتتاح"),
  occ: tr("Occupancy", "الإشغال"),
  status: tr("Status", "الحالة"),
  item: tr("Line item", "البند"),
  category: tr("Category", "الفئة"),
  total: tr("Total", "الإجمالي"),
  tagged: tr("System-tagged paid", "موسوم مدفوع بالنظام"),
  monthlySchedule: tr("Monthly scheduled", "الجدول الشهري"),
  period: tr("Period", "الفترة"),
  uses: tr("Development uses", "استخدامات التطوير"),
  billed: tr("Billed rent", "الإيجار المفوتر"),
  collected: tr("Collected rent", "الإيجار المحصل"),
  arOpen: tr("Opening AR", "مدين أول المدة"),
  arClose: tr("Closing AR", "مدين آخر المدة"),
  opex: tr("Cash OPEX", "التشغيل النقدي"),
  recoveries: tr("Recoveries collected", "المستردات المحصلة"),
  reserve: tr("Restricted reserve", "الاحتياطي المقيد"),
  dscr: tr("DSCR", "تغطية خدمة الدين"),
  draw: tr("Draw", "السحب"),
  profit: tr("Profit / rental", "الربح / الأجرة"),
  capital: tr("Capital paid", "رأس مال مسدد"),
  service: tr("Debt service", "خدمة التمويل"),
  balance: tr("Closing economic balance", "الرصيد الاقتصادي الختامي"),
  contribution: tr("Owner contribution", "مساهمة المالك"),
  distribution: tr("Owner distribution", "توزيع المالك"),
  source: tr("Source", "المصدر"),
  asOf: tr("As of", "حتى تاريخ"),
  rationale: tr("Rationale", "المبرر"),
  result: tr("Result", "النتيجة"),
  message: tr("Message", "الرسالة"),
  difference: tr("Difference", "الفرق"),
  issues: tr(
    "Issues & missing-input register",
    "الملاحظات وسجل المدخلات الناقصة"
  ),
  noRows: tr("No rows available.", "لا توجد صفوف متاحة."),
  tax: tr("Tax / VAT treatment", "معالجة الضريبة / ضريبة القيمة"),
  taxHelp: tr(
    "The cash-tax input is a provisional pre-tax planning assumption. VAT is excluded from this net model; neither treatment is tax advice.",
    "مدخل الضريبة النقدية افتراض تخطيطي مؤقت قبل الضريبة. وضريبة القيمة مستبعدة من هذا النموذج الصافي؛ ولا تعد أي معالجة نصيحة ضريبية."
  ),
  sourceIntro: tr(
    "Data lineage is displayed exactly as carried in the editable DTO. Colliers and other market references are recommendations or explicit draft assumptions—not executed rent-roll, bank, facility or covenant evidence.",
    "يُعرض تسلسل البيانات كما ورد في DTO القابل للتعديل. مراجع Colliers وغيرها من المراجع السوقية توصيات أو افتراضات مسودة صريحة، وليست دليل جدول إيجارات أو بنك أو تسهيل أو تعهد."
  ),
  sensitivity: tr("Sensitivity (analytical only)", "الحساسية (تحليلية فقط)"),
  case: tr("Case", "الحالة"),
  rentChange: tr("Rent change", "تغير الإيجار"),
  occupancyChange: tr("Occupancy change", "تغير الإشغال"),
  annualCfads: tr("Annual CFADS", "CFADS السنوي"),
  annualDscr: tr("Annual DSCR", "تغطية سنوية"),
  calculationStatus: tr("Calculation status", "حالة الحساب"),
  sourceHash: tr("Original baseline source hash", "تجزئة مصدر الأساس الأصلي"),
  originalNoIncome: tr(
    "Archived development schedule only — no operating income is implied.",
    "جدول تطوير مؤرشف فقط — لا يُفترض منه دخل تشغيلي."
  ),
  noTax: tr("Pre-tax model input", "مدخل نموذج قبل الضريبة"),
  notCalculable: tr("Not calculable", "غير قابل للحساب"),
  coverage: tr("Stabilised coverage", "التغطية المستقرة"),
  weakCoverage: tr("Weak coverage", "تغطية ضعيفة"),
  meetsTarget: tr("At / above analytical target", "عند / فوق الهدف التحليلي"),
  debtCoverage: tr("Annual CFADS and debt service", "النقد السنوي وخدمة الدين"),
  funding: tr("Development funding profile", "ملف تمويل التطوير"),
};

type View =
  | "summary"
  | "development"
  | "leasing"
  | "operations"
  | "finance"
  | "sources";

function valueOrNA(
  value: number | null | undefined,
  locale: MajanLocale,
  ratio = false
) {
  return ratio ? displayRatio(value, locale) : displayMoney(value, locale);
}
function allIssues(result: MajanModelResult) {
  const merged = [
    ...result.issues,
    ...result.development.issues,
    ...result.leasing.issues,
    ...result.financing.issues,
  ];
  return merged.filter(
    (issue, index) =>
      merged.findIndex(
        candidate =>
          candidate.code === issue.code &&
          candidate.field === issue.field &&
          candidate.severity === issue.severity
      ) === index
  );
}

export default function MajanReportsPanel({
  inputs,
  baseline,
  result,
  locale,
  isSaved,
  revision,
}: {
  inputs: MajanInputs;
  baseline: MajanBaseline;
  result: MajanModelResult;
  locale: MajanLocale;
  isSaved: boolean;
  revision?: number;
}) {
  const [view, setView] = useState<View>("summary");
  const [showMonthly, setShowMonthly] = useState(false);
  const p = (value: Translation) => phrase(value, locale);
  const issues = useMemo(() => allIssues(result), [result]);
  const stabilisedYear = getMajanStabilisedYear(inputs);
  const stabilisedAnnual =
    result.annual.find(row => row.year === stabilisedYear) ?? null;
  const dscrText = (
    value: number | null | undefined,
    debtService?: number | null
  ) =>
    !inputs.finance.enabled || debtService === 0
      ? locale === "ar"
        ? "غير منطبق"
        : "N/A"
      : displayRatio(value, locale);
  const nav: { id: View; label: Translation }[] = [
    { id: "summary", label: words.summary },
    { id: "development", label: words.development },
    { id: "leasing", label: words.leasing },
    { id: "operations", label: words.operations },
    { id: "finance", label: words.finance },
    { id: "sources", label: words.sources },
  ];
  const moneyMillions = (value: number) => `${(value / 1_000_000).toFixed(0)}m`;
  const annualDebtChart = result.annual
    .filter(row => Number(row.year) >= 2029 && Number(row.year) <= 2039)
    .map(row => ({
      year: row.year,
      cfads: row.cfads ?? 0,
      debtService: row.debtService ?? 0,
    }));
  const fundingChart = result.annual
    .filter(row => Number(row.year) >= 2026 && Number(row.year) <= 2030)
    .map(row => ({
      year: row.year,
      developmentUses: row.developmentUses,
      draw: row.draw ?? 0,
      ownerContribution: row.ownerContribution ?? 0,
    }));
  const chartTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ name?: string; value?: number; color?: string }> }) =>
    active && payload?.length ? (
      <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-[12px] shadow-sm">
        {payload.map(item => (
          <p key={item.name} style={{ color: item.color }}>
            {item.name}: {displayMoney(item.value, locale)} AED
          </p>
        ))}
      </div>
    ) : null;
  const annualRows = result.annual.map(row => (
    <tr key={row.year}>
      <td className="font-semibold text-slate-800">{row.year}</td>
      <td>{displayMoney(row.developmentUses, locale)}</td>
      <td>{valueOrNA(row.collectedRent, locale)}</td>
      <td>{valueOrNA(row.opex, locale)}</td>
      <td>{valueOrNA(row.recoveries, locale)}</td>
      <td>{valueOrNA(row.cfads, locale)}</td>
      <td>{valueOrNA(row.draw, locale)}</td>
      <td>{valueOrNA(row.debtService, locale)}</td>
      <td>{dscrText(row.dscr, row.debtService)}</td>
      <td>{valueOrNA(row.ownerContribution, locale)}</td>
    </tr>
  ));
  const monthlyOperations = result.leasing.months.map(row => (
    <tr key={row.period}>
      <td>{row.period}</td>
      <td>{valueOrNA(row.billedRent, locale)}</td>
      <td>{valueOrNA(row.collectedRent, locale)}</td>
      <td>{valueOrNA(row.openingAr, locale)}</td>
      <td>{valueOrNA(row.closingAr, locale)}</td>
      <td>{valueOrNA(row.opex, locale)}</td>
      <td>{valueOrNA(row.serviceChargeCollected, locale)}</td>
      <td>{valueOrNA(row.cashNoi, locale)}</td>
      <td>{valueOrNA(row.cfads, locale)}</td>
      <td>{valueOrNA(row.restrictedCash, locale)}</td>
    </tr>
  ));
  const monthlyFinance = result.financing.months.map(row => (
    <tr key={row.period}>
      <td>{row.period}</td>
      <td>{valueOrNA(row.openingBalance, locale)}</td>
      <td>{valueOrNA(row.draw, locale)}</td>
      <td>{valueOrNA(row.profitCapitalised, locale)}</td>
      <td>{valueOrNA(row.profitPaid, locale)}</td>
      <td>{valueOrNA(row.capitalPaid, locale)}</td>
      <td>{valueOrNA(row.totalPayment, locale)}</td>
      <td>{valueOrNA(row.closingBalance, locale)}</td>
      <td>{dscrText(row.dscr, row.totalPayment)}</td>
      <td>{valueOrNA(row.ownerContribution, locale)}</td>
      <td>{valueOrNA(row.ownerDistribution, locale)}</td>
    </tr>
  ));

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-xl border border-[#214f47] bg-[#123e38] p-4 text-white shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div>
          <h1 className="text-[20px] font-bold">
            {locale === "ar"
              ? "تقرير ماجان المالي للنقاش"
              : "Majan financial discussion report"}
          </h1>
          <p className="mt-1 text-[13px] text-teal-50">
            {locale === "ar"
              ? "المشروع 1 · قطعة الأرض 6457956 · درهم إماراتي · قيم تقديرية قابلة للتعديل"
              : "Project 1 · Plot 6457956 · AED · editable indicative values"}
          </p>
          {revision !== undefined && (
            <p className="mt-1 text-[12px] text-teal-100">r{revision}</p>
          )}
        </div>
        <span
          className={`w-fit rounded-full border px-3 py-1.5 text-[11px] font-bold ${isSaved ? "border-teal-200 bg-teal-50 text-teal-900" : "border-amber-200 bg-amber-50 text-amber-950"}`}
        >
          {isSaved ? p(words.saved) : p(words.draft)}
        </span>
      </div>
      <div
        role="tablist"
        aria-label={locale === "ar" ? "أقسام التقرير" : "Report sections"}
        className="flex gap-1 overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-1"
      >
        {nav.map(item => (
          <button
            role="tab"
            aria-selected={view === item.id}
            key={item.id}
            type="button"
            onClick={() => setView(item.id)}
            className={`shrink-0 rounded-md px-3 py-2 text-[12px] font-bold transition ${view === item.id ? "bg-white text-teal-800 shadow-sm" : "text-slate-600 hover:bg-white/70"}`}
          >
            {p(item.label)}
          </button>
        ))}
      </div>

      {view === "summary" && (
        <>
          <MajanSection
            title={p(words.scenario)}
            subtitle={
              locale === "ar"
                ? "نتائج السيناريو الحية من المحرك الشهري نفسه. لا تمثل شروط تمويل أو موافقة مصرفية."
                : "Live results from the same monthly engine. They do not represent finance terms or bank approval."
            }
          >
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MajanMetric
                label={p(words.gla)}
                value={`${displayNumber(result.leasing.totalGla, locale, 0)} sqft`}
              />
              <MajanMetric
                label={p(words.scenarioCost)}
                value={displayMoney(result.development.totalCost, locale)}
              />
              <MajanMetric
                label={p(words.cfads)}
                value={valueOrNA(stabilisedAnnual?.cfads, locale)}
                note={
                  stabilisedAnnual
                    ? locale === "ar"
                      ? `أول سنة استقرار كاملة / ${stabilisedAnnual.year}`
                      : `First full stabilised year / ${stabilisedAnnual.year}`
                    : p(words.notCalculable)
                }
                tone="teal"
              />
              <MajanMetric
                label={p(words.minDscr)}
                value={dscrText(
                  result.financing.minDscr,
                  result.financing.months.every(row => row.totalPayment === 0)
                    ? 0
                    : undefined
                )}
                tone="amber"
              />
              <MajanMetric
                label={p(words.owner)}
                value={valueOrNA(result.financing.peakOwnerFunding, locale)}
                tone="slate"
              />
              <MajanMetric
                label={p(words.financeState)}
                value={
                  inputs.finance.enabled ? p(words.indicative) : p(words.none)
                }
                tone={inputs.finance.enabled ? "amber" : "slate"}
              />
              <MajanMetric
                label={p(words.noi)}
                value={valueOrNA(stabilisedAnnual?.cashNoi, locale)}
                note={
                  stabilisedAnnual
                    ? locale === "ar"
                      ? `أول سنة استقرار كاملة / ${stabilisedAnnual.year}`
                      : `First full stabilised year / ${stabilisedAnnual.year}`
                    : p(words.notCalculable)
                }
              />
              <MajanMetric
                label={p(words.coverage)}
                value={dscrText(stabilisedAnnual?.dscr, stabilisedAnnual?.debtService)}
                note={
                  stabilisedAnnual?.dscr !== null &&
                  stabilisedAnnual?.dscr !== undefined &&
                  inputs.finance.targetDscr !== null &&
                  inputs.finance.targetDscr !== undefined
                    ? stabilisedAnnual.dscr < inputs.finance.targetDscr
                      ? `${p(words.weakCoverage)} · ${stabilisedAnnual.year} · < ${displayRatio(inputs.finance.targetDscr, locale)}`
                      : `${p(words.meetsTarget)} · ${stabilisedAnnual.year}`
                    : undefined
                }
                tone={
                  stabilisedAnnual?.dscr !== null &&
                  stabilisedAnnual?.dscr !== undefined &&
                  inputs.finance.targetDscr !== null &&
                  inputs.finance.targetDscr !== undefined &&
                  stabilisedAnnual.dscr < inputs.finance.targetDscr
                    ? "rose"
                    : "teal"
                }
              />
              <MajanMetric
                label={p(words.calculationStatus)}
                value={
                  issues.some(issue => issue.severity === "error")
                    ? locale === "ar"
                      ? "يتطلب معالجة"
                      : "Requires attention"
                    : locale === "ar"
                      ? "معاينة قابلة للحساب"
                      : "Preview calculable"
                }
                tone={
                  issues.some(issue => issue.severity === "error")
                    ? "rose"
                    : "teal"
                }
              />
            </div>
          </MajanSection>
          <div className="grid gap-5 xl:grid-cols-2">
            <MajanSection title={p(words.debtCoverage)}>
              <div className="h-64 min-w-0" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={annualDebtChart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#dbe7e3" />
                    <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                    <YAxis tickFormatter={moneyMillions} tick={{ fontSize: 11 }} width={42} />
                    <Tooltip content={chartTooltip} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="cfads" name="CFADS" fill="#0f766e" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="debtService" name={locale === "ar" ? "خدمة الدين" : "Debt service"} fill="#c88719" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </MajanSection>
            <MajanSection title={p(words.funding)}>
              <div className="h-64 min-w-0" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={fundingChart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#dbe7e3" />
                    <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                    <YAxis tickFormatter={moneyMillions} tick={{ fontSize: 11 }} width={42} />
                    <Tooltip content={chartTooltip} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="developmentUses" name={locale === "ar" ? "استخدامات التطوير" : "Development uses"} fill="#475569" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="draw" name={locale === "ar" ? "سحب" : "Draw"} fill="#0f766e" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="ownerContribution" name={locale === "ar" ? "مساهمة المالك" : "Owner contribution"} fill="#c88719" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </MajanSection>
          </div>
          <MajanSection
            title={p(words.annual)}
            subtitle={
              locale === "ar"
                ? "التجميع السنوي للبرنامج الشهري؛ DSCR يحسب كنسبة مجموع CFADS إلى مجموع خدمة التمويل."
                : "Annual aggregation of the monthly programme; DSCR is the ratio of summed CFADS to summed debt service."
            }
          >
            <MajanTable>
              <MajanTableHeader>
                <tr>
                  <th>{p(words.period)}</th>
                  <th>{p(words.uses)}</th>
                  <th>{p(words.collected)}</th>
                  <th>{p(words.opex)}</th>
                  <th>{p(words.recoveries)}</th>
                  <th>{p(words.cfads)}</th>
                  <th>{p(words.draw)}</th>
                  <th>{p(words.service)}</th>
                  <th>{p(words.dscr)}</th>
                  <th>{p(words.contribution)}</th>
                </tr>
              </MajanTableHeader>
              <MajanTableBody>{annualRows}</MajanTableBody>
            </MajanTable>
          </MajanSection>
          <MajanSection title={p(words.issues)}>
            <MajanIssueList issues={issues} locale={locale} limit={8} />
          </MajanSection>
        </>
      )}

      {view === "development" && (
        <>
          <MajanSection
            title={p(words.baseline)}
            subtitle={p(words.baselineHelp)}
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <MajanMetric
                label={p(words.recorded)}
                value={displayMoney(baseline.totalCost, locale)}
                tone="slate"
              />
              <MajanMetric
                label={p(words.sourceHash)}
                value={`${baseline.sourceHash.slice(0, 14)}…`}
                tone="slate"
              />
              <MajanMetric
                label={p(words.status)}
                value={p(words.originalNoIncome)}
                tone="amber"
              />
            </div>
            <p className="mt-4 rounded-lg border-s-4 border-teal-600 bg-teal-50 px-3 py-2 text-[13px] leading-5 text-teal-900">
              {locale === "ar"
                ? "المبلغ المسجل وتوسيم المدفوعات محفوظان للشفافية فقط؛ لا يمثلان ميزانية معتمدة أو إثبات سداد أو مساهمة مالك مؤهلة."
                : "Recorded total and paid tagging are retained for transparency only; neither is an approved budget, payment proof, nor eligible owner equity evidence."}
            </p>
          </MajanSection>
          <MajanSection
            title={p(words.scenario)}
            subtitle={
              locale === "ar"
                ? "يعرض هذا الجدول البرنامج الأساسي قبل التمويل بعد أي تعديل صريح للسيناريو؛ لا تعدل طبقة التمويل توقيته."
                : "This shows base-before-finance development after any explicit scenario adjustment; the finance overlay cannot rewrite timing."
            }
          >
            <MajanTable className="max-h-[680px]">
              <MajanTableHeader>
                <tr>
                  <th>{p(words.item)}</th>
                  <th>{p(words.category)}</th>
                  <th>{p(words.total)}</th>
                  <th>{p(words.tagged)}</th>
                  <th>{p(words.monthlySchedule)}</th>
                </tr>
              </MajanTableHeader>
              <MajanTableBody>
                {result.development.rows.map(row => (
                  <tr key={row.id}>
                    <td className="font-semibold text-slate-800">
                      {locale === "ar" ? row.nameAr : row.nameEn}
                    </td>
                    <td>{row.category}</td>
                    <td>{displayMoney(row.total, locale)}</td>
                    <td>{displayMoney(row.taggedPaid, locale)}</td>
                    <td>
                      {displayMoney(
                        row.monthly.reduce((sum, value) => sum + value, 0),
                        locale
                      )}
                    </td>
                  </tr>
                ))}
              </MajanTableBody>
            </MajanTable>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <MajanMetric
                label={p(words.scenarioCost)}
                value={displayMoney(result.development.totalCost, locale)}
              />
              <MajanMetric
                label={
                  locale === "ar"
                    ? "فرق السيناريو عن الأساس"
                    : "Scenario delta to baseline"
                }
                value={displayMoney(result.development.baselineDelta, locale)}
                tone="amber"
              />
              <MajanMetric
                label={p(words.tagged)}
                value={displayMoney(result.development.taggedPaid, locale)}
                tone="slate"
              />
            </div>
          </MajanSection>
          <MajanSection title={p(words.issues)}>
            <MajanIssueList
              issues={result.development.issues}
              locale={locale}
            />
          </MajanSection>
        </>
      )}

      {view === "leasing" && (
        <>
          <MajanSection
            title={p(words.leasing)}
            subtitle={
              locale === "ar"
                ? "برنامج مجمع حسب الطابق والاستخدام دون عدد وحدات. لا يعرض أو يستخدم العدد التاريخي المرفوض 72."
                : "Grouped by floor and use without a unit count. The rejected legacy count of 72 is neither shown nor used."
            }
          >
            <MajanTable>
              <MajanTableHeader>
                <tr>
                  <th>{locale === "ar" ? "الطابق" : "Floor"}</th>
                  <th>{p(words.item)}</th>
                  <th>{p(words.area)}</th>
                  <th>{p(words.rent)}</th>
                  <th>{p(words.opening)}</th>
                  <th>{p(words.occ)}</th>
                  <th>{p(words.status)}</th>
                </tr>
              </MajanTableHeader>
              <MajanTableBody>
                {inputs.leasing.map(row => (
                  <tr key={row.id}>
                    <td>{row.floor}</td>
                    <td className="font-semibold text-slate-800">
                      {locale === "ar" ? row.nameAr : row.nameEn}
                    </td>
                    <td>{displayNumber(row.areaSqft, locale, 0)}</td>
                    <td>{valueOrNA(row.annualRentPsf, locale)}</td>
                    <td>{row.openingMonth}</td>
                    <td>
                      {displayPct(row.initialOccupancyPct, locale)} /{" "}
                      {displayPct(row.stabilisedOccupancyPct, locale)}
                    </td>
                    <td>
                      {row.source.status === "assumption"
                        ? locale === "ar"
                          ? "افتراض مسودة"
                          : "Draft assumption"
                        : row.source.status}
                    </td>
                  </tr>
                ))}
              </MajanTableBody>
            </MajanTable>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <MajanMetric
                label={p(words.gla)}
                value={`${displayNumber(result.leasing.totalGla, locale, 0)} sqft`}
              />
              <MajanMetric
                label={locale === "ar" ? "متوسط الإيجار" : "Blended rent"}
                value={valueOrNA(result.leasing.blendedRentPsf, locale)}
              />
              <MajanMetric
                label={locale === "ar" ? "حالة المصدر" : "Source status"}
                value={
                  locale === "ar"
                    ? "افتراضات مسودة قابلة للتعديل"
                    : "Editable draft assumptions"
                }
                tone="amber"
              />
            </div>
          </MajanSection>
          <MajanSection
            title={p(words.sensitivity)}
            subtitle={
              locale === "ar"
                ? "اختبار اتجاهي للسيناريو وليس تنبؤًا أو تعهدًا."
                : "Directional scenario testing, not a forecast or covenant."
            }
          >
            <MajanTable>
              <MajanTableHeader>
                <tr>
                  <th>{p(words.case)}</th>
                  <th>{p(words.rentChange)}</th>
                  <th>{p(words.occupancyChange)}</th>
                  <th>{p(words.annualCfads)}</th>
                  <th>{p(words.annualDscr)}</th>
                </tr>
              </MajanTableHeader>
              <MajanTableBody>
                {result.sensitivity.map(row => (
                  <tr key={row.nameEn}>
                    <td className="font-semibold text-slate-800">
                      {locale === "ar" ? row.nameAr : row.nameEn}
                    </td>
                    <td>{displayPct(row.rentChangePct, locale)}</td>
                    <td>{displayPct(row.occupancyChangePp, locale)}</td>
                    <td>{valueOrNA(row.annualCfads, locale)}</td>
                    <td>{displayRatio(row.annualDscr, locale)}</td>
                  </tr>
                ))}
              </MajanTableBody>
            </MajanTable>
          </MajanSection>
          <MajanSection title={p(words.issues)}>
            <MajanIssueList issues={result.leasing.issues} locale={locale} />
          </MajanSection>
        </>
      )}

      {view === "operations" && (
        <>
          <MajanSection
            title={p(words.operations)}
            subtitle={
              locale === "ar"
                ? "يعرض مسار النقد: التحصيلات ناقص التشغيل النقدي مع CFADS قبل الضريبة. لا تُعدل حركة المدينين مرة ثانية."
                : "Cash route: collections less cash OPEX with pre-tax CFADS. AR movements are not deducted a second time."
            }
            actions={
              <button
                type="button"
                onClick={() => setShowMonthly(value => !value)}
                className="rounded-md border border-teal-200 bg-white px-3 py-2 text-[12px] font-bold text-teal-800 hover:bg-teal-50"
              >
                {showMonthly ? p(words.hideMonthly) : p(words.openMonthly)}
              </button>
            }
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <MajanMetric
                label={p(words.tax)}
                value={
                  inputs.operations.cashTaxAnnual === 0
                    ? p(words.noTax)
                    : valueOrNA(inputs.operations.cashTaxAnnual, locale)
                }
                tone="amber"
              />
              <MajanMetric
                label={locale === "ar" ? "ضريبة القيمة" : "VAT"}
                value={
                  locale === "ar"
                    ? "مستبعدة من النموذج الصافي"
                    : "Excluded from net model"
                }
                tone="slate"
              />
              <MajanMetric
                label={p(words.cfads)}
                value={valueOrNA(stabilisedAnnual?.cfads, locale)}
                note={stabilisedAnnual?.year || p(words.notCalculable)}
              />
            </div>
            <p className="mt-4 rounded-lg border-s-4 border-amber-500 bg-amber-50 px-3 py-2 text-[13px] leading-5 text-amber-900">
              {p(words.taxHelp)}
            </p>
            {showMonthly && (
              <div className="mt-4">
                <MajanTable className="max-h-[700px]">
                  <MajanTableHeader>
                    <tr>
                      <th>{p(words.period)}</th>
                      <th>{p(words.billed)}</th>
                      <th>{p(words.collected)}</th>
                      <th>{p(words.arOpen)}</th>
                      <th>{p(words.arClose)}</th>
                      <th>{p(words.opex)}</th>
                      <th>{p(words.recoveries)}</th>
                      <th>{p(words.noi)}</th>
                      <th>{p(words.cfads)}</th>
                      <th>{p(words.reserve)}</th>
                    </tr>
                  </MajanTableHeader>
                  <MajanTableBody>{monthlyOperations}</MajanTableBody>
                </MajanTable>
              </div>
            )}
          </MajanSection>
          <MajanSection title={p(words.annual)}>
            <MajanTable>
              <MajanTableHeader>
                <tr>
                  <th>{p(words.period)}</th>
                  <th>{p(words.billed)}</th>
                  <th>{p(words.collected)}</th>
                  <th>{p(words.opex)}</th>
                  <th>{p(words.recoveries)}</th>
                  <th>{p(words.cfads)}</th>
                </tr>
              </MajanTableHeader>
              <MajanTableBody>
                {result.annual.map(row => (
                  <tr key={row.year}>
                    <td>{row.year}</td>
                    <td>{valueOrNA(row.billedRent, locale)}</td>
                    <td>{valueOrNA(row.collectedRent, locale)}</td>
                    <td>{valueOrNA(row.opex, locale)}</td>
                    <td>{valueOrNA(row.recoveries, locale)}</td>
                    <td>{valueOrNA(row.cfads, locale)}</td>
                  </tr>
                ))}
              </MajanTableBody>
            </MajanTable>
          </MajanSection>
        </>
      )}

      {view === "finance" && (
        <>
          <MajanSection
            title={p(words.finance)}
            subtitle={
              inputs.finance.enabled
                ? locale === "ar"
                  ? "هذه طبقة تحليلية تقديرية وليست عقدًا أو شروطًا بنكية أو تعهدات معتمدة. وتبقى استخدامات التطوير مستقلة."
                  : "This is an indicative analytical overlay, not a contract, bank terms or approved covenants. Development uses remain separate."
                : locale === "ar"
                  ? "اختيرت حالة دون تمويل؛ تظل مخرجات التشغيل غير الممولة معروضة."
                  : "No-finance state is selected; unlevered operating outputs remain visible."
            }
            actions={
              <button
                type="button"
                onClick={() => setShowMonthly(value => !value)}
                className="rounded-md border border-teal-200 bg-white px-3 py-2 text-[12px] font-bold text-teal-800 hover:bg-teal-50"
              >
                {showMonthly ? p(words.hideMonthly) : p(words.openMonthly)}
              </button>
            }
          >
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MajanMetric
                label={p(words.financeState)}
                value={
                  inputs.finance.enabled ? p(words.indicative) : p(words.none)
                }
                tone={inputs.finance.enabled ? "amber" : "slate"}
              />
              <MajanMetric
                label={p(words.draw)}
                value={valueOrNA(result.financing.totalDraw, locale)}
              />
              <MajanMetric
                label={locale === "ar" ? "إجمالي الربح" : "Total profit"}
                value={valueOrNA(result.financing.totalProfit, locale)}
              />
              <MajanMetric
                label={p(words.balance)}
                value={valueOrNA(result.financing.closingBalance, locale)}
              />
              <MajanMetric
                label={p(words.owner)}
                value={valueOrNA(result.financing.peakOwnerFunding, locale)}
              />
              <MajanMetric
                label={p(words.minDscr)}
                value={dscrText(
                  result.financing.minDscr,
                  result.financing.months.every(row => row.totalPayment === 0)
                    ? 0
                    : undefined
                )}
                tone="amber"
              />
              <MajanMetric
                label={locale === "ar" ? "الاستحقاق" : "Maturity"}
                value={result.financing.maturityMonth || p(words.notCalculable)}
              />
              <MajanMetric
                label={
                  locale === "ar"
                    ? "اكتمال بيانات التمويل"
                    : "Finance inputs complete"
                }
                value={
                  result.financing.financeComplete
                    ? locale === "ar"
                      ? "مكتملة تحليليًا"
                      : "Analytically complete"
                    : locale === "ar"
                      ? "غير مكتملة"
                      : "Incomplete"
                }
                tone={result.financing.financeComplete ? "teal" : "amber"}
              />
            </div>
            {showMonthly && (
              <div className="mt-4">
                <MajanTable className="max-h-[700px]">
                  <MajanTableHeader>
                    <tr>
                      <th>{p(words.period)}</th>
                      <th>
                        {locale === "ar" ? "رصيد افتتاحي" : "Opening balance"}
                      </th>
                      <th>{p(words.draw)}</th>
                      <th>
                        {locale === "ar" ? "ربح مرسمل" : "Capitalised profit"}
                      </th>
                      <th>{p(words.profit)}</th>
                      <th>{p(words.capital)}</th>
                      <th>{p(words.service)}</th>
                      <th>{p(words.balance)}</th>
                      <th>{p(words.dscr)}</th>
                      <th>{p(words.contribution)}</th>
                      <th>{p(words.distribution)}</th>
                    </tr>
                  </MajanTableHeader>
                  <MajanTableBody>{monthlyFinance}</MajanTableBody>
                </MajanTable>
              </div>
            )}
          </MajanSection>
          <MajanSection title={p(words.issues)}>
            <MajanIssueList issues={result.financing.issues} locale={locale} />
          </MajanSection>
        </>
      )}

      {view === "sources" && (
        <>
          <MajanSection
            title={p(words.sources)}
            subtitle={p(words.sourceIntro)}
          >
            <MajanTable>
              <MajanTableHeader>
                <tr>
                  <th>{p(words.source)}</th>
                  <th>{p(words.asOf)}</th>
                  <th>{p(words.status)}</th>
                  <th>{p(words.rationale)}</th>
                </tr>
              </MajanTableHeader>
              <MajanTableBody>
                {[
                  inputs.development.source,
                  ...inputs.leasing.map(row => row.source),
                  ...inputs.opex.map(row => row.source),
                  inputs.operations.source,
                  inputs.finance.source,
                ].map((source, index) => (
                  <tr key={`${source.source}-${index}`}>
                    <td className="font-semibold text-slate-800">
                      {source.source}
                    </td>
                    <td>{source.asOf}</td>
                    <td>
                      {source.status === "assumption"
                        ? locale === "ar"
                          ? "افتراض مسودة"
                          : "Draft assumption"
                        : source.status}
                    </td>
                    <td>{source.rationale || "—"}</td>
                  </tr>
                ))}
              </MajanTableBody>
            </MajanTable>
          </MajanSection>
          <MajanSection
            title={
              locale === "ar" ? "اختبارات المطابقة" : "Reconciliation checks"
            }
          >
            <MajanTable>
              <MajanTableHeader>
                <tr>
                  <th>{locale === "ar" ? "الرمز" : "Code"}</th>
                  <th>{p(words.result)}</th>
                  <th>{p(words.message)}</th>
                  <th>{p(words.difference)}</th>
                </tr>
              </MajanTableHeader>
              <MajanTableBody>
                {result.checks.map(check => (
                  <tr key={check.code}>
                    <td className="font-semibold text-slate-800">
                      {check.code}
                    </td>
                    <td>
                      <span
                        className={`rounded-full px-2 py-1 text-[11px] font-bold ${check.status === "pass" ? "bg-teal-50 text-teal-800" : check.status === "fail" ? "bg-rose-50 text-rose-800" : "bg-slate-100 text-slate-700"}`}
                      >
                        {check.status === "pass"
                          ? locale === "ar"
                            ? "مطابق"
                            : "Pass"
                          : check.status === "fail"
                            ? locale === "ar"
                              ? "غير مطابق"
                              : "Fail"
                            : p(words.notCalculable)}
                      </span>
                    </td>
                    <td>
                      {locale === "ar" ? check.messageAr : check.messageEn}
                    </td>
                    <td>
                      {check.difference === undefined
                        ? "—"
                        : displayMoney(check.difference, locale)}
                    </td>
                  </tr>
                ))}
              </MajanTableBody>
            </MajanTable>
          </MajanSection>
          <MajanSection title={p(words.issues)}>
            <MajanIssueList issues={issues} locale={locale} />
          </MajanSection>
        </>
      )}
    </div>
  );
}
